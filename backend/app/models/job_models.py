"""Pydantic models for async job documents."""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime


class ImageGenerationJob(BaseModel):
    """Job document for image generation."""
    job_id: Optional[str] = None
    scene_id: str
    storyboard_id: str
    user_id: str
    text: str
    style_prompt: str
    use_product_composite: bool = False
    product_id: Optional[str] = None
    status: Literal["pending", "processing", "complete", "error"] = "pending"
    image_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class VideoGenerationJob(BaseModel):
    """Job document for single video generation."""
    job_id: Optional[str] = None
    scene_id: str
    storyboard_id: str
    user_id: str
    image_url: str
    text: str
    duration: float = 5.0
    status: Literal["pending", "processing", "complete", "error"] = "pending"
    video_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class VideoClipInput(BaseModel):
    """Input for a single video clip in multi-video generation."""
    scene_number: int
    seed_image_url: str
    duration: float = 5.0
    description: str = ""
    style_prompt: Optional[str] = None


class VideoClipOutput(BaseModel):
    """Output for a single generated video clip."""
    scene_number: int
    video_url: Optional[str] = None
    duration: float
    status: Literal["pending", "complete", "error"]
    error_message: Optional[str] = None


class MultiVideoGenerationJob(BaseModel):
    """Job document for multi-scene video generation."""
    job_id: Optional[str] = None
    user_id: str
    scenes: List[VideoClipInput]
    audio_url: Optional[str] = None
    status: Literal["pending", "processing", "complete", "error"] = "pending"
    progress_percent: int = 0
    clips: List[VideoClipOutput] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CompositionClipInput(BaseModel):
    """Input for a single clip in video composition."""
    scene_number: int
    video_url: str
    duration: float


class CompositionJob(BaseModel):
    """Job document for video composition."""
    job_id: Optional[str] = None
    user_id: str
    clips: List[CompositionClipInput]
    audio_url: Optional[str] = None
    include_crossfade: bool = True
    optimize_size: bool = False
    status: Literal["pending", "processing", "complete", "error"] = "pending"
    progress_percent: int = 0
    video_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

