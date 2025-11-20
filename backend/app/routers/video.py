"""FastAPI router for video generation endpoints."""
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request

from app.models.video_models import (
    VideoGenerationRequest,
    VideoGenerationResponse,
    VideoJobStatus,
    VideoJobStatusResponse,
    VideoClip,
    JobStatus
)
from app.services.replicate_service import ReplicateVideoService
from app.firestore_database import db
from app.middleware.clerk_auth import get_current_user_id, get_optional_user_id

router = APIRouter(prefix="/api/video", tags=["video"])

# Initialize video service
video_service = None  # Will be initialized on first request


def get_video_service() -> ReplicateVideoService:
    """Get or initialize Replicate video service."""
    global video_service
    if video_service is None:
        try:
            video_service = ReplicateVideoService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Replicate video service not available: {str(e)}"
            )
    return video_service


async def _create_job(request: VideoGenerationRequest, user_id: Optional[str] = None) -> str:
    """
    Create a new video generation job in Firestore.

    Args:
        request: Video generation request with scenes
        user_id: Optional user ID from Clerk authentication

    Returns:
        job_id: Unique identifier for the job
    """
    job_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Initialize clips for each scene
    clips = [
        VideoClip(
            scene_number=scene.scene_number,
            video_url=None,
            duration=scene.duration,
            status=JobStatus.PENDING,
            progress_percent=0
        )
        for scene in request.scenes
    ]

    # Create job status
    job_status = VideoJobStatus(
        job_id=job_id,
        status=JobStatus.PENDING,
        total_scenes=len(request.scenes),
        completed_scenes=0,
        failed_scenes=0,
        progress_percent=0,
        clips=clips,
        audio_url=request.audio_url,
        final_video_url=None,
        created_at=now,
        updated_at=now
    )

    # Save to Firestore (synchronous operation)
    job_data = job_status.model_dump()
    if user_id:
        job_data["user_id"] = user_id
    
    db.collection("video_jobs").document(job_id).set(job_data)

    return job_id


async def _update_job_progress(job_id: str):
    """
    Update overall job progress based on clip statuses in Firestore.

    Args:
        job_id: Job identifier
    """
    # Get job from Firestore (synchronous operation)
    job_ref = db.collection("video_jobs").document(job_id)
    job_doc = job_ref.get()
    
    if not job_doc.exists:
        return

    job_data = job_doc.to_dict()
    job = VideoJobStatus(**job_data)

    # Count completed and failed clips
    completed = sum(1 for clip in job.clips if clip.status == JobStatus.COMPLETED)
    failed = sum(1 for clip in job.clips if clip.status == JobStatus.FAILED)
    processing = sum(1 for clip in job.clips if clip.status == JobStatus.PROCESSING)

    job.completed_scenes = completed
    job.failed_scenes = failed

    # Calculate overall progress (average of all clip progress)
    if job.clips:
        total_progress = sum(clip.progress_percent for clip in job.clips)
        job.progress_percent = total_progress // len(job.clips)

    # Update overall job status
    if completed + failed == job.total_scenes:
        # All scenes processed
        if failed == job.total_scenes:
            job.status = JobStatus.FAILED
            job.error = "All scene video generations failed"
        elif completed > 0:
            job.status = JobStatus.COMPLETED
        else:
            job.status = JobStatus.FAILED
            job.error = "No scenes were successfully generated"
    elif processing > 0 or completed > 0:
        job.status = JobStatus.PROCESSING

    job.updated_at = datetime.utcnow().isoformat()
    
    # Save back to Firestore (synchronous operation)
    job_ref.update(job.model_dump())


async def _update_clip_progress(job_id: str, scene_number: int, status: str, video_url: str = None, error: str = None):
    """
    Update progress for a specific clip in a job in Firestore.

    Args:
        job_id: Job identifier
        scene_number: Scene number being updated
        status: New status (processing, completed, failed)
        video_url: Video URL if completed
        error: Error message if failed
    """
    # Get job from Firestore (synchronous operation)
    job_ref = db.collection("video_jobs").document(job_id)
    job_doc = job_ref.get()
    
    if not job_doc.exists:
        return

    job_data = job_doc.to_dict()
    job = VideoJobStatus(**job_data)

    # Find the clip and update it
    for clip in job.clips:
        if clip.scene_number == scene_number:
            if status == "processing":
                clip.status = JobStatus.PROCESSING
                clip.progress_percent = 50
            elif status == "completed":
                clip.status = JobStatus.COMPLETED
                clip.video_url = video_url
                clip.progress_percent = 100
            elif status == "failed":
                clip.status = JobStatus.FAILED
                clip.error = error
                clip.progress_percent = 0
            break

    # Save updated job back to Firestore (synchronous operation)
    job_ref.update(job.model_dump())

    # Update overall job progress
    await _update_job_progress(job_id)


async def _process_video_generation(job_id: str, request: VideoGenerationRequest):
    """
    Background task to process video generation using Replicate img2vid.

    Generates videos in parallel for all scenes and updates job progress in Firestore.

    Args:
        job_id: Job identifier
        request: Video generation request
    """
    # Check if job exists in Firestore (synchronous operation)
    job_ref = db.collection("video_jobs").document(job_id)
    job_doc = job_ref.get()
    
    if not job_doc.exists:
        return

    try:
        # Get video service
        video_svc = get_video_service()

        # Update job status to processing (synchronous operation)
        job_ref.update({
            "status": JobStatus.PROCESSING.value,
            "updated_at": datetime.utcnow().isoformat()
        })

        # Prepare scenes data for video generation
        scenes_data = [
            {
                "scene_number": scene.scene_number,
                "seed_image_url": scene.seed_image_url,
                "duration": scene.duration,
                "description": scene.description,
                "style_prompt": scene.style_prompt
            }
            for scene in request.scenes
        ]

        # Create progress callback
        async def progress_callback(scene_number: int, status: str, video_url: str = None, error: str = None):
            await _update_clip_progress(job_id, scene_number, status, video_url, error)

        # Generate videos in parallel
        results = await video_svc.generate_videos_parallel(
            scenes=scenes_data,
            progress_callback=progress_callback
        )

        # Final update
        await _update_job_progress(job_id)

    except Exception as e:
        # Job failed - update in Firestore (synchronous operation)
        job_doc = job_ref.get()
        if job_doc.exists:
            job_ref.update({
                "status": JobStatus.FAILED.value,
                "error": f"Video generation failed: {str(e)}",
                "updated_at": datetime.utcnow().isoformat()
            })


@router.post("/generate", response_model=VideoGenerationResponse)
async def generate_videos(
    req: Request,
    request: VideoGenerationRequest,
    background_tasks: BackgroundTasks
) -> VideoGenerationResponse:
    """
    Initiate async video clip generation for all scenes.

    This endpoint:
    1. Accepts scene data with seed image URLs
    2. Creates a job ID for tracking in Firestore
    3. Initiates parallel video generation in the background
    4. Returns immediately with job ID for status polling

    Args:
        req: FastAPI Request object (for auth)
        request: Video generation request with scenes and seed images
        background_tasks: FastAPI background tasks manager

    Returns:
        VideoGenerationResponse with job_id for tracking
    """
    try:
        # Get user ID (optional - video generation can work without auth for now)
        user_id = await get_optional_user_id(req)
        
        # Validate request
        if not request.scenes:
            raise HTTPException(
                status_code=400,
                detail="At least one scene is required"
            )

        # Validate all scenes have seed images
        scenes_without_images = [
            s.scene_number for s in request.scenes
            if not s.seed_image_url
        ]
        if scenes_without_images:
            raise HTTPException(
                status_code=400,
                detail=f"Scenes missing seed images: {scenes_without_images}"
            )

        # Create job in Firestore
        job_id = await _create_job(request, user_id)

        # Start background video generation
        background_tasks.add_task(_process_video_generation, job_id, request)

        return VideoGenerationResponse(
            success=True,
            job_id=job_id,
            message=f"Video generation job created for {len(request.scenes)} scenes",
            total_scenes=len(request.scenes)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate video generation: {str(e)}"
        )


@router.get("/status/{job_id}", response_model=VideoJobStatusResponse)
async def get_video_status(job_id: str) -> VideoJobStatusResponse:
    """
    Get the current status of a video generation job from Firestore.

    This endpoint provides:
    1. Overall job status (pending, processing, completed, failed)
    2. Progress percentage (0-100)
    3. Individual clip statuses and URLs
    4. Error messages if any failures occurred

    Args:
        job_id: Unique job identifier from /generate endpoint

    Returns:
        VideoJobStatusResponse with current job status
    """
    try:
        # Get job from Firestore (synchronous operation)
        job_ref = db.collection("video_jobs").document(job_id)
        job_doc = job_ref.get()
        
        if not job_doc.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )

        job_data = job_doc.to_dict()
        job_status = VideoJobStatus(**job_data)

        return VideoJobStatusResponse(
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


# Admin/debug endpoint to list all jobs (can be removed in production)
@router.get("/jobs")
async def list_jobs(req: Request):
    """List all video generation jobs from Firestore (for debugging)."""
    try:
        # Optional: Get user_id to filter by user
        user_id = await get_optional_user_id(req)
        
        # Query Firestore (synchronous operations)
        jobs_ref = db.collection("video_jobs")
        
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
                "total_scenes": job_data.get("total_scenes"),
                "completed": job_data.get("completed_scenes"),
                "failed": job_data.get("failed_scenes")
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
