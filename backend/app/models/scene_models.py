"""Pydantic models for scene planning and generation."""
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class Scene(BaseModel):
    """Model for a single scene in the video timeline."""
    scene_number: int = Field(..., description="Scene number in sequence (1-indexed)", ge=1)
    duration: float = Field(..., description="Duration in seconds", gt=0)
    description: str = Field(..., description="Description of what happens in this scene")
    style_prompt: str = Field(..., description="Style keywords and visual direction for this scene")


class ScenePlan(BaseModel):
    """Model for a complete scene plan."""
    total_duration: float = Field(..., description="Total duration in seconds (should be 30)")
    scenes: List[Scene] = Field(..., description="List of scenes in order", min_length=5, max_length=7)

    @field_validator('total_duration')
    @classmethod
    def validate_duration(cls, v: float) -> float:
        """Ensure total duration is approximately 30 seconds."""
        if not (29.0 <= v <= 31.0):
            raise ValueError(f"Total duration must be approximately 30 seconds, got {v}")
        return v

    @field_validator('scenes')
    @classmethod
    def validate_scenes_duration(cls, v: List[Scene]) -> List[Scene]:
        """Ensure scene durations sum to total_duration."""
        total = sum(scene.duration for scene in v)
        if not (29.0 <= total <= 31.0):
            raise ValueError(f"Sum of scene durations must equal approximately 30 seconds, got {total}")
        return v


class ScenePlanRequest(BaseModel):
    """Request model for scene plan generation."""
    # Creative brief fields
    product_name: str = Field(..., description="Name of the product")
    target_audience: str = Field(..., description="Target audience description")
    emotional_tone: List[str] = Field(..., description="List of emotional tones")
    visual_style_keywords: List[str] = Field(..., description="List of visual style keywords")
    key_messages: List[str] = Field(..., description="List of key messages")

    # Selected mood data
    mood_id: str = Field(..., description="Selected mood ID")
    mood_name: str = Field(..., description="Selected mood name")
    mood_style_keywords: List[str] = Field(..., description="Style keywords from selected mood")
    mood_color_palette: List[str] = Field(..., description="Color palette from selected mood")
    mood_aesthetic_direction: str = Field(..., description="Aesthetic direction from selected mood")


class ScenePlanResponse(BaseModel):
    """Response model for scene plan generation."""
    success: bool = Field(..., description="Whether generation was successful")
    scene_plan: Optional[ScenePlan] = Field(None, description="Generated scene plan")
    message: Optional[str] = Field(None, description="Optional message about the generation")


class ScenePlanError(BaseModel):
    """Error response model for scene planning."""
    success: bool = Field(False, description="Always false for errors")
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")


# Seed Image Generation Models

class SceneWithSeedImage(BaseModel):
    """Model for a scene with its generated seed image."""
    scene_number: int = Field(..., description="Scene number in sequence (1-indexed)", ge=1)
    duration: float = Field(..., description="Duration in seconds", gt=0)
    description: str = Field(..., description="Description of what happens in this scene")
    style_prompt: str = Field(..., description="Style keywords and visual direction for this scene")
    seed_image_url: Optional[str] = Field(None, description="URL of the generated seed image")
    generation_success: bool = Field(True, description="Whether seed image generation was successful")
    generation_error: Optional[str] = Field(None, description="Error message if generation failed")


class SeedImageRequest(BaseModel):
    """Request model for generating seed images for scenes."""
    scenes: List[Scene] = Field(..., description="List of scenes to generate seed images for")
    mood_style_keywords: List[str] = Field(..., description="Style keywords from selected mood")
    mood_color_palette: List[str] = Field(..., description="Color palette from selected mood")
    mood_aesthetic_direction: str = Field(..., description="Aesthetic direction from selected mood")


class SeedImageResponse(BaseModel):
    """Response model for seed image generation."""
    success: bool = Field(..., description="Whether generation was successful")
    scenes_with_images: List[SceneWithSeedImage] = Field(..., description="Scenes with generated seed images")
    message: Optional[str] = Field(None, description="Optional message about the generation")
    total_scenes: int = Field(..., description="Total number of scenes")
    successful_images: int = Field(..., description="Number of successfully generated images")
