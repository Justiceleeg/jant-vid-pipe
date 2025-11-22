"""FastAPI router for scene planning endpoints."""
from fastapi import APIRouter, HTTPException

from app.models.scene_models import (
    ScenePlanRequest,
    ScenePlanResponse,
    ScenePlan,
    ScenePlanError,
    SeedImageRequest,
    SeedImageResponse,
    SceneWithSeedImage
)
from app.services.scene_service import SceneGenerationService
from app.services.replicate_service import ReplicateImageService
from app.config import settings

router = APIRouter(prefix="/api/scenes", tags=["scenes"])

# Initialize services
scene_service = SceneGenerationService()
replicate_service = None  # Will be initialized on first request


def get_replicate_service() -> ReplicateImageService:
    """Get or initialize Replicate service."""
    global replicate_service
    if replicate_service is None:
        try:
            replicate_service = ReplicateImageService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Replicate service not available: {str(e)}"
            )
    return replicate_service


@router.post("/plan", response_model=ScenePlanResponse)
async def plan_scenes(
    request: ScenePlanRequest
) -> ScenePlanResponse:
    """
    Generate a scene-by-scene breakdown for a 30-second video.

    This endpoint:
    1. Takes creative brief and selected mood data
    2. Uses GPT-4o to analyze narrative structure
    3. Generates 5-7 scenes with descriptions and timing
    4. Ensures scenes follow storytelling best practices
    5. Returns structured scene plan with exact timing

    Args:
        request: Scene plan request containing creative brief and mood data

    Returns:
        ScenePlanResponse with scene breakdown (5-7 scenes totaling 30 seconds)
    """
    try:
        # Convert Pydantic model to dict for service
        creative_brief = {
            "product_name": request.product_name,
            "target_audience": request.target_audience,
            "emotional_tone": request.emotional_tone,
            "visual_style_keywords": request.visual_style_keywords,
            "key_messages": request.key_messages
        }

        selected_mood = {
            "mood_id": request.mood_id,
            "mood_name": request.mood_name,
            "mood_style_keywords": request.mood_style_keywords,
            "mood_color_palette": request.mood_color_palette,
            "mood_aesthetic_direction": request.mood_aesthetic_direction
        }

        # Generate scene breakdown
        scene_plan_dict = await scene_service.generate_scene_breakdown(
            creative_brief=creative_brief,
            selected_mood=selected_mood
        )

        # Convert to Pydantic model
        scene_plan = ScenePlan(**scene_plan_dict)

        # Count scenes
        num_scenes = len(scene_plan.scenes)
        total_duration = scene_plan.total_duration

        message = f"Generated {num_scenes} scenes totaling {total_duration:.1f} seconds"

        return ScenePlanResponse(
            success=True,
            scene_plan=scene_plan,
            message=message
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during scene planning: {str(e)}"
        )


@router.post("/seeds", response_model=SeedImageResponse)
async def generate_seed_images(
    request: SeedImageRequest
) -> SeedImageResponse:
    """
    Generate seed images for each scene using Replicate.

    This endpoint:
    1. Takes scene descriptions and mood style data
    2. Generates seed images in parallel for each scene
    3. Ensures images match the selected mood aesthetic
    4. Returns scenes with seed image URLs

    Args:
        request: Seed image request containing scenes and mood data

    Returns:
        SeedImageResponse with scenes including seed image URLs

    """
    try:
        # Get replicate service
        replicate_svc = get_replicate_service()

        # Convert scenes to dictionaries for service
        scenes_list = [scene.model_dump() for scene in request.scenes]

        # Determine image resolution based on environment
        if settings.IMAGE_WIDTH > 0 and settings.IMAGE_HEIGHT > 0:
            image_width = settings.IMAGE_WIDTH
            image_height = settings.IMAGE_HEIGHT
        elif settings.is_development():
            # Dev: Lower resolution for faster generation (16:9 aspect ratio)
            image_width = 1280
            image_height = 720
        else:
            # Prod: Full HD landscape (16:9 aspect ratio)
            image_width = 1920
            image_height = 1080

        # Generate seed images for all scenes in parallel
        print(f"Generating {len(scenes_list)} seed images at {image_width}x{image_height}...")
        scenes_with_images_data = await replicate_svc.generate_scene_seed_images(
            scenes=scenes_list,
            mood_style_keywords=request.mood_style_keywords,
            mood_color_palette=request.mood_color_palette,
            mood_aesthetic_direction=request.mood_aesthetic_direction,
            width=image_width,
            height=image_height
        )

        # Convert to Pydantic models
        scenes_with_images = [
            SceneWithSeedImage(**scene_data)
            for scene_data in scenes_with_images_data
        ]

        # Count successful generations
        total_scenes = len(scenes_with_images)
        successful_images = sum(1 for scene in scenes_with_images if scene.generation_success)

        message = f"Generated seed images for {successful_images}/{total_scenes} scenes"
        if successful_images < total_scenes:
            message += f" ({total_scenes - successful_images} failed or filtered)"

        return SeedImageResponse(
            success=successful_images > 0,
            scenes_with_images=scenes_with_images,
            message=message,
            total_scenes=total_scenes,
            successful_images=successful_images
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during seed image generation: {str(e)}"
        )
