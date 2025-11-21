"""API router for storyboard operations."""
from fastapi import APIRouter, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
from pydantic import BaseModel
from app.models.storyboard_models import (
    StoryboardInitializeRequest,
    StoryboardInitializeResponse,
    StoryboardGetResponse,
    SceneTextUpdateRequest,
    SceneTextGenerateRequest,
    SceneDurationUpdateRequest,
    SceneUpdateResponse,
    SSESceneUpdate,
    ErrorResponse,
)
from app.models.job_models import ImageGenerationJob, VideoGenerationJob
from app.services.storyboard_service import storyboard_service
from app.services.product_service import get_product_service
from app.services.replicate_service import get_replicate_service
from app.services.metrics_service import get_composite_metrics
from app.services.firebase_storage_service import get_storage_service
from app.middleware.clerk_auth import get_current_user_id, get_optional_user_id
from app.firestore_database import db
from app.config import settings
import json
import asyncio
from datetime import datetime
import uuid

router = APIRouter(
    prefix="/api/storyboards",
    tags=["storyboards"],
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    }
)


# ============================================================================
# Storyboard Endpoints
# ============================================================================

@router.post("/initialize", response_model=StoryboardInitializeResponse)
async def initialize_storyboard(
    request: StoryboardInitializeRequest,
    http_request: Request
):
    """
    Initialize a new storyboard with AI-generated scene texts.

    This endpoint:
    1. Accepts creative brief and selected mood
    2. Generates 6 scene descriptions using OpenAI
    3. Creates a storyboard and scenes in the database
    4. Returns the storyboard with all scenes
    
    Requires authentication via Clerk.
    """
    try:
        # Get authenticated user ID from Clerk
        user_id = await get_current_user_id(http_request)
        
        # Initialize storyboard with user_id
        storyboard, scenes = await storyboard_service.initialize_storyboard(request, user_id)

        return StoryboardInitializeResponse(
            success=True,
            storyboard=storyboard,
            scenes=scenes,
            message=f"Successfully initialized storyboard with {len(scenes)} scenes"
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error initializing storyboard: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize storyboard: {str(e)}"
        )


@router.get("/{storyboard_id}", response_model=StoryboardGetResponse)
async def get_storyboard(storyboard_id: str):
    """
    Get a storyboard with all its scenes.

    This endpoint is used for:
    - Page load / refresh recovery
    - Fetching latest state
    """
    try:
        storyboard, scenes = await storyboard_service.get_storyboard_with_scenes(storyboard_id)

        return StoryboardGetResponse(
            storyboard=storyboard,
            scenes=scenes
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve storyboard: {str(e)}"
        )


@router.post("/{storyboard_id}/regenerate-all", response_model=StoryboardInitializeResponse)
async def regenerate_all_scenes(storyboard_id: str):
    """
    Regenerate all scenes in a storyboard.

    WARNING: This erases all progress and generates new scene texts.
    """
    try:
        # Get existing storyboard
        storyboard = db.get_storyboard(storyboard_id)
        if not storyboard:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storyboard {storyboard_id} not found"
            )

        # Delete existing scenes
        for scene_id in storyboard.scene_order:
            db.delete_scene(scene_id)

        # Generate new scenes
        # Note: storyboard.creative_brief is stored as a string, so we pass it directly
        # The service will handle both string and dict formats
        scene_texts = await storyboard_service.generate_scene_texts(
            creative_brief=storyboard.creative_brief,  # String format from database
            selected_mood=storyboard.selected_mood,
            num_scenes=6
        )

        # Create new scenes
        scenes = []
        for scene_data in scene_texts:
            from app.models.storyboard_models import StoryboardScene, SceneGenerationStatus
            scene = StoryboardScene(
                storyboard_id=storyboard.storyboard_id,
                state="text",
                text=scene_data["text"],
                style_prompt=scene_data["style_prompt"],
                video_duration=scene_data["duration"],
                generation_status=SceneGenerationStatus(
                    image="pending",
                    video="pending"
                )
            )
            scenes.append(scene)
            db.create_scene(scene)

        # Update storyboard with new scene order
        storyboard.scene_order = [scene.id for scene in scenes]
        storyboard.updated_at = datetime.utcnow()
        db.update_storyboard(storyboard_id, storyboard)

        return StoryboardInitializeResponse(
            success=True,
            storyboard=storyboard,
            scenes=scenes,
            message=f"Successfully regenerated {len(scenes)} scenes"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate scenes: {str(e)}"
        )


# ============================================================================
# Scene Text Endpoints
# ============================================================================

@router.put("/{storyboard_id}/scenes/{scene_id}/text", response_model=SceneUpdateResponse)
async def update_scene_text(storyboard_id: str, scene_id: str, request: SceneTextUpdateRequest):
    """
    Update scene text manually.

    This resets the scene to text state and clears image/video.
    """
    try:
        scene = await storyboard_service.update_scene_text(scene_id, request.text)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene text updated successfully"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update scene text: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/text/generate", response_model=SceneUpdateResponse)
async def generate_scene_text(storyboard_id: str, scene_id: str, request: SceneTextGenerateRequest):
    """
    Regenerate scene text using AI.

    This generates new text based on the creative brief and resets the scene to text state.
    """
    try:
        scene = await storyboard_service.regenerate_scene_text(scene_id, request.creative_brief)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene text regenerated successfully"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate scene text: {str(e)}"
        )


# ============================================================================
# Scene Duration Endpoint
# ============================================================================

@router.put("/{storyboard_id}/scenes/{scene_id}/duration", response_model=SceneUpdateResponse)
async def update_scene_duration(storyboard_id: str, scene_id: str, request: SceneDurationUpdateRequest):
    """
    Update scene video duration.

    If the scene is in video state, this resets it to image state.
    """
    try:
        scene = await storyboard_service.update_scene_duration(scene_id, request.duration)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene duration updated successfully"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update scene duration: {str(e)}"
        )


# ============================================================================
# Scene Status Endpoint (for polling fallback)
# ============================================================================

@router.get("/{storyboard_id}/scenes/{scene_id}/status", response_model=SceneUpdateResponse)
async def get_scene_status(storyboard_id: str, scene_id: str):
    """
    Get current scene status.

    Used for polling fallback when SSE is not available.
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene status retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scene status: {str(e)}"
        )


# ============================================================================
# Product Composite Endpoints
# ============================================================================

class EnableProductCompositeRequest(BaseModel):
    """Request to enable product compositing for a scene."""
    product_id: str


@router.post("/{storyboard_id}/scenes/{scene_id}/product-composite")
async def enable_product_composite(
    storyboard_id: str,
    scene_id: str,
    request: EnableProductCompositeRequest
):
    """
    Enable product compositing for a scene.
    
    This marks the scene to include the product in image generation.
    If the scene already has an image, it will need to be regenerated.
    """
    # Check if product mode is enabled
    if not settings.is_product_mode():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Product compositing not available in NeRF mode"
        )
    
    try:
        # Validate product exists
        product_service = get_product_service()
        product = product_service.get_product_image(request.product_id)
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {request.product_id} not found"
            )
        
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.use_product_composite = True
        scene.product_id = request.product_id
        
        # If scene already has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Product compositing enabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable product composite: {str(e)}"
        )


@router.delete("/{storyboard_id}/scenes/{scene_id}/product-composite")
async def disable_product_composite(
    storyboard_id: str,
    scene_id: str
):
    """
    Disable product compositing for a scene.
    
    Removes product from the scene. If the scene has an image with product,
    it will need to be regenerated.
    """
    try:
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.use_product_composite = False
        scene.product_id = None
        
        # If scene has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Product compositing disabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable product composite: {str(e)}"
        )


# ============================================================================
# Image Generation Endpoints
# ============================================================================

# Note: Image generation is now handled by Cloud Functions (functions/main.py)
# The old generate_image_task background function has been removed.

@router.post("/{storyboard_id}/scenes/{scene_id}/image/generate", response_model=SceneUpdateResponse)
async def generate_scene_image(
    storyboard_id: str,
    scene_id: str,
    http_request: Request
):
    """
    Approve text and generate image for a scene.

    This creates a Firestore job document that triggers a Cloud Function.
    """
    try:
        # Get user_id from Clerk
        user_id = await get_current_user_id(http_request)
        
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        # Create image generation job document
        job = ImageGenerationJob(
            job_id=str(uuid.uuid4()),
            scene_id=scene_id,
            storyboard_id=storyboard_id,
            user_id=user_id,
            text=scene.text,
            style_prompt=scene.style_prompt or "",
            use_product_composite=scene.use_product_composite,
            product_id=scene.product_id,
            status="pending"
        )
        
        # Save job to Firestore (this triggers the Cloud Function)
        db.db.collection('image_generation_jobs').document(job.job_id).set(
            job.model_dump(exclude_none=True, by_alias=True),
            merge=False
        )
        
        print(f"[Image Generation] Created job document {job.job_id} for scene {scene_id}")

        # Update scene status to generating
        scene.generation_status.image = "generating"
        db.update_scene(scene_id, scene)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Image generation started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start image generation: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/image/regenerate", response_model=SceneUpdateResponse)
async def regenerate_scene_image(
    storyboard_id: str,
    scene_id: str,
    http_request: Request
):
    """
    Regenerate image for a scene.

    This clears the existing image and starts new generation.
    """
    try:
        # Get user_id from Clerk
        user_id = await get_current_user_id(http_request)
        
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        # Reset image state
        scene.image_url = None
        scene.generation_status.image = "generating"
        db.update_scene(scene_id, scene)

        # Create image generation job document
        job = ImageGenerationJob(
            job_id=str(uuid.uuid4()),
            scene_id=scene_id,
            storyboard_id=storyboard_id,
            user_id=user_id,
            text=scene.text,
            style_prompt=scene.style_prompt or "",
            use_product_composite=scene.use_product_composite,
            product_id=scene.product_id,
            status="pending"
        )
        
        # Save job to Firestore (this triggers the Cloud Function)
        db.db.collection('image_generation_jobs').document(job.job_id).set(
            job.model_dump(exclude_none=True, by_alias=True),
            merge=False
        )

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Image regeneration started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start image regeneration: {str(e)}"
        )


# ============================================================================
# Video Generation Endpoints
# ============================================================================

# Note: Video generation is now handled by Cloud Functions (functions/main.py)
# The old generate_video_task background function has been removed.

@router.post("/{storyboard_id}/scenes/{scene_id}/video/generate", response_model=SceneUpdateResponse)
async def generate_scene_video(
    storyboard_id: str,
    scene_id: str,
    http_request: Request
):
    """
    Approve image and generate video for a scene.

    This creates a Firestore job document that triggers a Cloud Function.
    """
    try:
        # Get user_id from Clerk
        user_id = await get_current_user_id(http_request)
        
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        if not scene.image_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate video without an image"
            )

        # Create video generation job document
        job = VideoGenerationJob(
            job_id=str(uuid.uuid4()),
            scene_id=scene_id,
            storyboard_id=storyboard_id,
            user_id=user_id,
            image_url=scene.image_url,
            text=scene.text,
            duration=scene.video_duration or 5.0,
            status="pending"
        )
        
        # Save job to Firestore (this triggers the Cloud Function)
        db.db.collection('video_generation_jobs').document(job.job_id).set(
            job.model_dump(exclude_none=True, by_alias=True),
            merge=False
        )
        
        print(f"[Video Generation] Created job document {job.job_id} for scene {scene_id}")

        # Update scene status to generating
        scene.generation_status.video = "generating"
        db.update_scene(scene_id, scene)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Video generation started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start video generation: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/video/regenerate", response_model=SceneUpdateResponse)
async def regenerate_scene_video(
    storyboard_id: str,
    scene_id: str,
    http_request: Request
):
    """
    Regenerate video for a scene.

    This clears the existing video and starts new generation.
    """
    try:
        # Get user_id from Clerk
        user_id = await get_current_user_id(http_request)
        
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        if not scene.image_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate video without an image"
            )

        # Reset video state
        scene.video_url = None
        scene.generation_status.video = "generating"
        db.update_scene(scene_id, scene)

        # Create video generation job document
        job = VideoGenerationJob(
            job_id=str(uuid.uuid4()),
            scene_id=scene_id,
            storyboard_id=storyboard_id,
            user_id=user_id,
            image_url=scene.image_url,
            text=scene.text,
            duration=scene.video_duration or 5.0,
            status="pending"
        )
        
        # Save job to Firestore (this triggers the Cloud Function)
        db.db.collection('video_generation_jobs').document(job.job_id).set(
            job.model_dump(exclude_none=True, by_alias=True),
            merge=False
        )

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Video regeneration started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start video regeneration: {str(e)}"
        )


# ============================================================================
# Server-Sent Events (SSE) Endpoint
# ============================================================================

async def scene_update_generator(storyboard_id: str) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for scene updates.

    This watches for changes to scenes in the storyboard and sends updates.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Track last known state for each scene
    last_states = {}
    
    try:
        # Send initial connection success message
        yield f"event: connected\ndata: {{'storyboard_id': '{storyboard_id}'}}\n\n"
        logger.info(f"SSE connection established for storyboard {storyboard_id}")
        
        while True:
            try:
                # Get all scenes for this storyboard
                scenes = db.get_scenes_by_storyboard(storyboard_id)

                # Check for changes
                for scene in scenes:
                    current_state = {
                        "state": scene.state,
                        "image_status": scene.generation_status.image,
                        "video_status": scene.generation_status.video,
                        "image_url": scene.image_url,
                        "video_url": scene.video_url,
                        "error": scene.error_message
                    }

                    # Compare with last known state
                    last_state = last_states.get(scene.id)
                    
                    if last_state != current_state:
                        # State changed, send update with BOTH statuses
                        update = SSESceneUpdate(
                            scene_id=scene.id,
                            state=scene.state,
                            image_status=scene.generation_status.image,
                            video_status=scene.generation_status.video,
                            image_url=scene.image_url,
                            video_url=scene.video_url,
                            error=scene.error_message
                        )

                        # Format as SSE event
                        data = f"event: scene_update\ndata: {update.model_dump_json()}\n\n"
                        yield data

                        # Update last known state
                        last_states[scene.id] = current_state

                # Send keepalive ping every poll cycle to prevent timeout
                yield f": keepalive\n\n"
                
                # Wait before next poll
                await asyncio.sleep(2)  # Poll every 2 seconds
                
            except Exception as e:
                logger.error(f"Error in SSE update loop: {e}", exc_info=True)
                # Send error to client
                error_data = f"event: error\ndata: {{'error': 'Internal server error'}}\n\n"
                yield error_data
                await asyncio.sleep(5)  # Wait before retrying

    except asyncio.CancelledError:
        logger.info(f"SSE connection cancelled for storyboard {storyboard_id}")
        raise
    except Exception as e:
        logger.error(f"Fatal error in SSE generator: {e}", exc_info=True)
        raise


@router.get("/test-sse")
async def test_sse():
    """
    Test SSE endpoint to verify EventSource connectivity.
    Returns a simple heartbeat every second for 10 seconds.
    """
    async def heartbeat_generator():
        import logging
        logger = logging.getLogger(__name__)
        logger.info("SSE test endpoint called")
        
        try:
            for i in range(10):
                yield f"event: heartbeat\ndata: {{\"count\": {i+1}}}\n\n"
                await asyncio.sleep(1)
            yield f"event: complete\ndata: {{\"message\": \"Test completed\"}}\n\n"
        except Exception as e:
            logger.error(f"Error in test SSE: {e}")
            
    return StreamingResponse(
        heartbeat_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/{storyboard_id}/events")
async def scene_updates_sse(storyboard_id: str):
    """
    Server-Sent Events endpoint for real-time scene updates.

    Clients connect to this endpoint to receive real-time updates
    about scene generation progress (image/video generation status).
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"SSE connection requested for storyboard {storyboard_id}")
    
    # Verify storyboard exists
    storyboard = db.get_storyboard(storyboard_id)
    if not storyboard:
        logger.warning(f"SSE connection rejected: Storyboard {storyboard_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Storyboard {storyboard_id} not found"
        )

    logger.info(f"Starting SSE stream for storyboard {storyboard_id}")
    
    return StreamingResponse(
        scene_update_generator(storyboard_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            # CORS headers for SSE
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "*",
        }
    )
