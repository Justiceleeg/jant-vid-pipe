"""
Pydantic models for the Project-Centric Data Model.

This module defines the complete data structure for projects in Firestore,
where all data lives within a single Project document.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timedelta
from enum import Enum


class JobType(str, Enum):
    """Types of generation jobs."""
    COMPOSITION = "composition"
    VIDEO = "video"
    AUDIO = "audio"


class JobStatus(str, Enum):
    """Status states for generation jobs."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class CreativeBrief(BaseModel):
    """Creative brief embedded in storyboard."""
    brand_name: str
    product_description: str
    target_audience: str
    key_message: str
    tone: str
    additional_notes: Optional[str] = None


class SelectedMood(BaseModel):
    """Mood selection embedded in storyboard."""
    id: str
    name: str
    description: str
    visual_style: str
    color_palette: List[str]
    mood_keywords: List[str]


class EmbeddedStoryboard(BaseModel):
    """Embedded storyboard data (no longer a separate collection)."""
    id: str
    title: str
    creative_brief: Optional[CreativeBrief] = None
    selected_mood: Optional[SelectedMood] = None


class ActiveJob(BaseModel):
    """Active job tracking for a scene."""
    job_id: str
    type: JobType
    status: JobStatus
    progress: int = Field(ge=0, le=100, description="Progress percentage 0-100")
    started_at: datetime
    last_update: datetime
    error_message: Optional[str] = None

    @validator('progress')
    def validate_progress(cls, v):
        """Ensure progress is between 0 and 100."""
        return max(0, min(100, v))


class SceneAssets(BaseModel):
    """Asset storage references (Firebase Storage paths, not URLs)."""
    composition_path: Optional[str] = None
    video_path: Optional[str] = None
    audio_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    generated_at: Optional[datetime] = None


class Composition(BaseModel):
    """AI-generated composition details."""
    description: str
    styling: str
    animation: str
    generated_at: datetime


class Scene(BaseModel):
    """Scene data structure."""
    id: str  # UUID for cloud function reference
    scene_number: int
    title: str
    description: str
    duration_seconds: float = Field(gt=0, le=30, description="Duration in seconds")

    # Generated assets (Firebase Storage paths)
    assets: SceneAssets = Field(default_factory=SceneAssets)

    # Current active job (only track current, not history)
    active_job: Optional[ActiveJob] = None

    # AI-generated composition
    composition: Optional[Composition] = None


class ProjectStats(BaseModel):
    """Project-level statistics for monitoring."""
    total_scenes: int = 0
    completed_scenes: int = 0
    last_activity: datetime


class Project(BaseModel):
    """
    Main Project Document Structure.
    This is the complete data model for a project in Firestore.
    """
    # Core fields
    id: str
    name: str
    description: Optional[str] = None
    user_id: str
    created_at: datetime
    updated_at: datetime

    # Embedded storyboard (no longer separate collection)
    storyboard: EmbeddedStoryboard

    # Scenes as array (no reordering complexity for now)
    scenes: List[Scene] = Field(default_factory=list)

    # Project-level stats for monitoring
    stats: ProjectStats

    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Request/Response Models for API endpoints

class CreateProjectRequest(BaseModel):
    """Request model for creating a new project."""
    name: str
    description: Optional[str] = None
    creative_brief: Optional[CreativeBrief] = None
    selected_mood: Optional[SelectedMood] = None
    storyboard_title: str = "New Storyboard"


class UpdateProjectRequest(BaseModel):
    """Request model for updating project metadata."""
    name: Optional[str] = None
    description: Optional[str] = None


class UpdateSceneRequest(BaseModel):
    """Request model for updating a specific scene."""
    title: Optional[str] = None
    description: Optional[str] = None
    duration_seconds: Optional[float] = Field(None, gt=0, le=30)


class GenerateVideoRequest(BaseModel):
    """Request model for triggering video generation."""
    scene_id: str
    force_regenerate: bool = False


class GenerateVideoResponse(BaseModel):
    """Response model for video generation request."""
    success: bool
    job_id: str
    scene_id: str
    message: Optional[str] = None


class ProjectResponse(BaseModel):
    """Response model for project data."""
    project: Project
    signed_urls: Optional[Dict[str, str]] = None  # Map of asset paths to signed URLs


# Utility functions

def is_job_stale(job: ActiveJob, threshold_minutes: int = 5) -> bool:
    """
    Check if a job is stale (no update in specified minutes).

    Args:
        job: The active job to check
        threshold_minutes: Minutes without update to consider stale

    Returns:
        True if the job hasn't been updated within threshold
    """
    threshold = datetime.now() - timedelta(minutes=threshold_minutes)
    return job.last_update < threshold


def is_scene_complete(scene: Scene) -> bool:
    """
    Check if a scene has completed assets.

    Args:
        scene: The scene to check

    Returns:
        True if scene has both video and composition paths
    """
    return bool(
        scene.assets.video_path and
        scene.assets.composition_path
    )


def calculate_project_progress(project: Project) -> int:
    """
    Calculate project completion percentage.

    Args:
        project: The project to calculate progress for

    Returns:
        Percentage of completion (0-100)
    """
    if not project.scenes:
        return 0

    completed_scenes = sum(1 for scene in project.scenes if is_scene_complete(scene))
    return round((completed_scenes / len(project.scenes)) * 100)


def update_project_stats(project: Project) -> None:
    """
    Update project statistics based on current state.

    Args:
        project: The project to update stats for
    """
    project.stats.total_scenes = len(project.scenes)
    project.stats.completed_scenes = sum(
        1 for scene in project.scenes if is_scene_complete(scene)
    )
    project.stats.last_activity = datetime.now()
    project.updated_at = datetime.now()