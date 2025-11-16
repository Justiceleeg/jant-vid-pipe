"""Pydantic models for video generation."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class JobStatus(str, Enum):
    """Video generation job status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SceneVideoInput(BaseModel):
    """Model for a scene with seed image for video generation."""
    scene_number: int = Field(..., description="Scene number in sequence (1-indexed)", ge=1)
    duration: float = Field(..., description="Duration in seconds", gt=0)
    description: str = Field(..., description="Description of what happens in this scene")
    style_prompt: str = Field(..., description="Style keywords and visual direction for this scene")
    seed_image_url: str = Field(..., description="URL of the seed image for img2vid")


class VideoGenerationRequest(BaseModel):
    """Request model for video generation."""
    scenes: List[SceneVideoInput] = Field(..., description="List of scenes with seed images to generate videos for")
    mood_style_keywords: Optional[List[str]] = Field(None, description="Style keywords from selected mood")
    mood_aesthetic_direction: Optional[str] = Field(None, description="Aesthetic direction from selected mood")
    audio_url: Optional[str] = Field(None, description="URL of background music for the final composition")


class VideoGenerationResponse(BaseModel):
    """Response model for video generation initiation."""
    success: bool = Field(..., description="Whether job was successfully initiated")
    job_id: str = Field(..., description="Unique job ID for tracking progress")
    message: str = Field(..., description="Status message")
    total_scenes: int = Field(..., description="Total number of scenes to generate")


class VideoClip(BaseModel):
    """Model for a generated video clip."""
    scene_number: int = Field(..., description="Scene number in sequence")
    video_url: Optional[str] = Field(None, description="URL of the generated video clip")
    duration: float = Field(..., description="Duration in seconds")
    status: JobStatus = Field(..., description="Status of this clip generation")
    error: Optional[str] = Field(None, description="Error message if generation failed")
    progress_percent: int = Field(0, description="Progress percentage (0-100)")


class VideoJobStatus(BaseModel):
    """Model for video generation job status."""
    job_id: str = Field(..., description="Unique job ID")
    status: JobStatus = Field(..., description="Overall job status")
    total_scenes: int = Field(..., description="Total number of scenes")
    completed_scenes: int = Field(0, description="Number of completed scenes")
    failed_scenes: int = Field(0, description="Number of failed scenes")
    progress_percent: int = Field(0, description="Overall progress percentage (0-100)")
    clips: List[VideoClip] = Field(default_factory=list, description="List of video clips with their status")
    audio_url: Optional[str] = Field(None, description="URL of background music for the final composition")
    final_video_url: Optional[str] = Field(None, description="URL of the final composed video with audio")
    error: Optional[str] = Field(None, description="Error message if job failed")
    created_at: str = Field(..., description="Job creation timestamp (ISO format)")
    updated_at: str = Field(..., description="Last update timestamp (ISO format)")


class VideoJobStatusResponse(BaseModel):
    """Response model for video job status polling."""
    success: bool = Field(..., description="Whether status retrieval was successful")
    job_status: Optional[VideoJobStatus] = Field(None, description="Current job status")
    message: Optional[str] = Field(None, description="Optional message")
