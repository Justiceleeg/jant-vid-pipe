"""FastAPI router for video generation endpoints."""
import uuid
from datetime import datetime
from typing import Dict
from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.models.video_models import (
    VideoGenerationRequest,
    VideoGenerationResponse,
    VideoJobStatus,
    VideoJobStatusResponse,
    VideoClip,
    JobStatus
)
from app.services.replicate_service import ReplicateVideoService

router = APIRouter(prefix="/api/video", tags=["video"])

# In-memory job tracking
# In production, this should be replaced with Redis or a database
_jobs: Dict[str, VideoJobStatus] = {}

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


def _create_job(request: VideoGenerationRequest) -> str:
    """
    Create a new video generation job.

    Args:
        request: Video generation request with scenes

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

    # Store in memory
    _jobs[job_id] = job_status

    return job_id


def _update_job_progress(job_id: str):
    """
    Update overall job progress based on clip statuses.

    Args:
        job_id: Job identifier
    """
    if job_id not in _jobs:
        return

    job = _jobs[job_id]

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


async def _update_clip_progress(job_id: str, scene_number: int, status: str, video_url: str = None, error: str = None):
    """
    Update progress for a specific clip in a job.

    Args:
        job_id: Job identifier
        scene_number: Scene number being updated
        status: New status (processing, completed, failed)
        video_url: Video URL if completed
        error: Error message if failed
    """
    if job_id not in _jobs:
        return

    job = _jobs[job_id]

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

    # Update overall job progress
    _update_job_progress(job_id)


async def _process_video_generation(job_id: str, request: VideoGenerationRequest):
    """
    Background task to process video generation using Replicate img2vid.

    Generates videos in parallel for all scenes and updates job progress.

    Args:
        job_id: Job identifier
        request: Video generation request
    """
    if job_id not in _jobs:
        return

    try:
        # Get video service
        video_svc = get_video_service()

        # Update job status to processing
        job = _jobs[job_id]
        job.status = JobStatus.PROCESSING
        job.updated_at = datetime.utcnow().isoformat()

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
        _update_job_progress(job_id)

    except Exception as e:
        # Job failed
        if job_id in _jobs:
            job = _jobs[job_id]
            job.status = JobStatus.FAILED
            job.error = f"Video generation failed: {str(e)}"
            job.updated_at = datetime.utcnow().isoformat()


@router.post("/generate", response_model=VideoGenerationResponse)
async def generate_videos(
    request: VideoGenerationRequest,
    background_tasks: BackgroundTasks
) -> VideoGenerationResponse:
    """
    Initiate async video clip generation for all scenes.

    This endpoint:
    1. Accepts scene data with seed image URLs
    2. Creates a job ID for tracking
    3. Initiates parallel video generation in the background
    4. Returns immediately with job ID for status polling

    Args:
        request: Video generation request with scenes and seed images
        background_tasks: FastAPI background tasks manager

    Returns:
        VideoGenerationResponse with job_id for tracking
    """
    try:
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

        # Create job
        job_id = _create_job(request)

        # Start background video generation
        # This will be implemented in subtask 5.2
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
    Get the current status of a video generation job.

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
        # Check if job exists
        if job_id not in _jobs:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )

        job_status = _jobs[job_id]

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
async def list_jobs():
    """List all video generation jobs (for debugging)."""
    return {
        "total_jobs": len(_jobs),
        "jobs": [
            {
                "job_id": job.job_id,
                "status": job.status.value,
                "progress": job.progress_percent,
                "total_scenes": job.total_scenes,
                "completed": job.completed_scenes,
                "failed": job.failed_scenes
            }
            for job in _jobs.values()
        ]
    }
