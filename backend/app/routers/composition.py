"""FastAPI router for video composition endpoints."""
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import FileResponse
from pathlib import Path

from app.models.composition_models import (
    CompositionRequest,
    CompositionResponse,
    CompositionJobStatus,
    CompositionJobStatusResponse,
    CompositionStatus
)
from app.services.ffmpeg_service import FFmpegCompositionService
from app.firestore_database import db
from app.middleware.clerk_auth import get_current_user_id, get_optional_user_id

router = APIRouter(prefix="/api/composition", tags=["composition"])

# Initialize composition service
composition_service = None  # Will be initialized on first request


def get_composition_service() -> FFmpegCompositionService:
    """Get or initialize FFmpeg composition service."""
    global composition_service
    if composition_service is None:
        try:
            composition_service = FFmpegCompositionService()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Composition service not available: {str(e)}"
            )
    return composition_service


async def _create_composition_job(request: CompositionRequest, user_id: Optional[str] = None) -> str:
    """
    Create a new video composition job in Firestore.

    Args:
        request: Composition request with clips and settings
        user_id: Optional user ID from Clerk authentication

    Returns:
        job_id: Unique identifier for the job
    """
    job_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Create job status
    job_status = CompositionJobStatus(
        job_id=job_id,
        status=CompositionStatus.PENDING,
        progress_percent=0,
        total_clips=len(request.clips),
        current_step="Job created",
        video_url=None,
        file_size_mb=None,
        duration_seconds=None,
        error=None,
        created_at=now,
        updated_at=now
    )

    # Save to Firestore
    job_data = job_status.model_dump()
    if user_id:
        job_data["user_id"] = user_id
    
    db.collection("composition_jobs").document(job_id).set(job_data)

    return job_id


async def _update_job_status(
    job_id: str,
    status: CompositionStatus,
    progress: int,
    current_step: Optional[str] = None,
    video_url: Optional[str] = None,
    file_size_mb: Optional[float] = None,
    duration_seconds: Optional[float] = None,
    error: Optional[str] = None,
    file_path: Optional[str] = None
):
    """
    Update composition job status in Firestore.

    Args:
        job_id: Job identifier
        status: New status
        progress: Progress percentage (0-100)
        current_step: Current processing step description
        video_url: URL of final video (if completed)
        file_size_mb: File size in MB (if completed)
        duration_seconds: Duration in seconds (if completed)
        error: Error message (if failed)
        file_path: Local file path (temporary, will migrate to Firebase Storage later)
    """
    job_ref = db.collection("composition_jobs").document(job_id)
    
    # Build update dict
    update_data = {
        "status": status.value,
        "progress_percent": progress,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if current_step:
        update_data["current_step"] = current_step
    if video_url:
        update_data["video_url"] = video_url
    if file_size_mb is not None:
        update_data["file_size_mb"] = file_size_mb
    if duration_seconds is not None:
        update_data["duration_seconds"] = duration_seconds
    if error:
        update_data["error"] = error
    if file_path:
        update_data["file_path"] = file_path
    
    job_ref.update(update_data)


async def _process_composition(job_id: str, request: CompositionRequest):
    """
    Background task to process video composition.

    Args:
        job_id: Job identifier
        request: Composition request
    """
    # Check if job exists in Firestore
    job_ref = db.collection("composition_jobs").document(job_id)
    job_doc = job_ref.get()
    
    if not job_doc.exists:
        return

    try:
        # Get composition service
        service = get_composition_service()

        # Step 1: Downloading
        await _update_job_status(
            job_id,
            CompositionStatus.DOWNLOADING,
            10,
            current_step=f"Downloading {len(request.clips)} clips and audio..."
        )

        # Step 2: Composing
        await _update_job_status(
            job_id,
            CompositionStatus.COMPOSING,
            30,
            current_step="Composing video with transitions..."
        )

        # Prepare clip data for composition
        clips_data = [
            {
                "scene_number": clip.scene_number,
                "video_url": clip.video_url,
                "duration": clip.duration
            }
            for clip in request.clips
        ]

        # Compose video
        output_path = await service.compose_video(
            video_clips=clips_data,
            audio_url=request.audio_url,
            include_crossfade=request.include_crossfade,
            target_bitrate="3M" if not request.optimize_size else "2500k"
        )

        if not output_path or not output_path.exists():
            raise Exception("Video composition failed to produce output file")

        # Step 3: Optimizing (if requested)
        if request.optimize_size:
            await _update_job_status(
                job_id,
                CompositionStatus.OPTIMIZING,
                80,
                current_step="Optimizing file size..."
            )

            output_path = await service.optimize_file_size(
                output_path,
                target_size_mb=request.target_size_mb
            )

        # Step 4: Completed
        # Get file info
        file_size_mb = output_path.stat().st_size / (1024 * 1024)

        # Calculate duration
        from ffmpeg import probe
        probe_data = probe(str(output_path))
        duration_seconds = float(probe_data['format']['duration'])

        # For now, video_url is the local file path
        # TODO: Upload to Firebase Storage in Phase 2
        video_url = f"/api/composition/download/{job_id}"

        await _update_job_status(
            job_id,
            CompositionStatus.COMPLETED,
            100,
            current_step="Composition complete",
            video_url=video_url,
            file_size_mb=file_size_mb,
            duration_seconds=duration_seconds,
            file_path=str(output_path)
        )

        print(f"✅ Composition job {job_id} completed successfully")

    except Exception as e:
        # Job failed
        error_msg = f"Composition failed: {str(e)}"
        print(f"✗ Job {job_id} failed: {error_msg}")

        await _update_job_status(
            job_id,
            CompositionStatus.FAILED,
            0,
            current_step="Failed",
            error=error_msg
        )


@router.post("/compose", response_model=CompositionResponse)
async def compose_video(
    req: Request,
    request: CompositionRequest,
    background_tasks: BackgroundTasks
) -> CompositionResponse:
    """
    Initiate video composition with transitions and audio.

    This endpoint:
    1. Accepts video clips and optional audio
    2. Creates a composition job in Firestore
    3. Processes composition in the background
    4. Returns job ID for status polling

    Args:
        req: FastAPI Request object (for auth)
        request: Composition request with clips and settings
        background_tasks: FastAPI background tasks manager

    Returns:
        CompositionResponse with job_id for tracking
    """
    try:
        # Get user ID (optional)
        user_id = await get_optional_user_id(req)
        
        # Validate request
        if not request.clips:
            raise HTTPException(
                status_code=400,
                detail="At least one video clip is required"
            )

        # Validate clip URLs
        clips_without_urls = [
            c.scene_number for c in request.clips
            if not c.video_url
        ]
        if clips_without_urls:
            raise HTTPException(
                status_code=400,
                detail=f"Clips missing video URLs: {clips_without_urls}"
            )

        # Create job in Firestore
        job_id = await _create_composition_job(request, user_id)

        # Start background composition
        background_tasks.add_task(_process_composition, job_id, request)

        return CompositionResponse(
            success=True,
            job_id=job_id,
            message=f"Composition job created for {len(request.clips)} clips",
            total_clips=len(request.clips)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate composition: {str(e)}"
        )


@router.get("/status/{job_id}", response_model=CompositionJobStatusResponse)
async def get_composition_status(job_id: str) -> CompositionJobStatusResponse:
    """
    Get the current status of a composition job from Firestore.

    Args:
        job_id: Unique job identifier from /compose endpoint

    Returns:
        CompositionJobStatusResponse with current job status
    """
    try:
        # Get job from Firestore
        job_ref = db.collection("composition_jobs").document(job_id)
        job_doc = job_ref.get()
        
        if not job_doc.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )

        job_data = job_doc.to_dict()
        job_status = CompositionJobStatus(**job_data)

        return CompositionJobStatusResponse(
            success=True,
            job_status=job_status,
            message=f"Job status: {job_status.status.value}"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve job status: {str(e)}"
        )


@router.get("/download/{job_id}")
async def download_video(job_id: str):
    """
    Download the composed video file.

    Args:
        job_id: Unique job identifier

    Returns:
        FileResponse with the video file
    """
    try:
        # Get job from Firestore
        job_ref = db.collection("composition_jobs").document(job_id)
        job_doc = job_ref.get()
        
        if not job_doc.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )

        job_data = job_doc.to_dict()
        job = CompositionJobStatus(**job_data)

        # Check if job is completed
        if job.status != CompositionStatus.COMPLETED:
            raise HTTPException(
                status_code=400,
                detail=f"Job {job_id} is not completed yet (status: {job.status.value})"
            )

        # Get video file path
        if not job.file_path:
            raise HTTPException(
                status_code=404,
                detail=f"Video file not found for job {job_id}"
            )

        video_path = Path(job.file_path)
        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video file does not exist: {video_path}"
            )

        # Return file
        # TODO: In Phase 2, this should redirect to Firebase Storage URL
        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=f"composed_video_{job_id}.mp4"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download video: {str(e)}"
        )


@router.get("/jobs")
async def list_jobs(req: Request):
    """List all composition jobs from Firestore (for debugging)."""
    try:
        # Optional: Get user_id to filter by user
        user_id = await get_optional_user_id(req)
        
        # Query Firestore
        jobs_ref = db.collection("composition_jobs")
        
        # If user_id provided, filter by user
        if user_id:
            jobs_query = jobs_ref.where("user_id", "==", user_id)
        else:
            jobs_query = jobs_ref
        
        # Limit to recent jobs (last 100)
        jobs_query = jobs_query.order_by("created_at", direction="DESCENDING").limit(100)
        
        jobs_docs = jobs_query.stream()
        
        jobs_list = []
        for doc in jobs_docs:
            job_data = doc.to_dict()
            jobs_list.append({
                "job_id": job_data.get("job_id"),
                "status": job_data.get("status"),
                "progress": job_data.get("progress_percent"),
                "total_clips": job_data.get("total_clips"),
                "current_step": job_data.get("current_step"),
                "video_url": job_data.get("video_url"),
                "file_size_mb": job_data.get("file_size_mb"),
                "duration_seconds": job_data.get("duration_seconds")
            })
        
        return {
            "total_jobs": len(jobs_list),
            "jobs": jobs_list
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list jobs: {str(e)}"
        )
