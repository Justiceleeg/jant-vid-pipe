"""
Project API endpoints for the project-centric data model.

This module provides all API endpoints for managing projects,
including creation, retrieval, updates, and scene management.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from typing import List, Optional
import logging
import uuid
from datetime import datetime

from ..models.project_models import (
    Project,
    ProjectResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
    UpdateSceneRequest,
    GenerateVideoRequest,
    GenerateVideoResponse,
    Scene,
    ActiveJob,
    JobType,
    JobStatus,
)
from ..services.firestore_service import get_firestore_service
from ..services.cloud_functions import CloudFunctionTrigger
from ..middleware.clerk_auth import get_current_user_id, get_optional_user_id

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=Project)
async def create_project(
    request: CreateProjectRequest,
    http_request: Request
) -> Project:
    """
    Create a new project with embedded storyboard.

    Args:
        request: Project creation request
        http_request: FastAPI Request object for auth

    Returns:
        Created project object
    """
    try:
        user_id = await get_current_user_id(http_request)
        firestore_service = get_firestore_service()
        project = await firestore_service.create_project(user_id, request)
        logger.info(f"Created project {project.id} for user {user_id}")
        return project
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[Project])
async def get_user_projects(
    http_request: Request
) -> List[Project]:
    """
    Get all projects for the current user.

    Args:
        http_request: FastAPI Request object for auth

    Returns:
        List of user's projects
    """
    try:
        user_id = await get_current_user_id(http_request)
        firestore_service = get_firestore_service()
        projects = await firestore_service.get_user_projects(user_id)
        logger.info(f"Retrieved {len(projects)} projects for user {user_id}")
        return projects
    except Exception as e:
        logger.error(f"Error getting user projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    http_request: Request
) -> ProjectResponse:
    """
    Get a specific project by ID.

    Args:
        project_id: The project ID
        http_request: FastAPI Request object for auth

    Returns:
        Project data with optional signed URLs
    """
    try:
        user_id = await get_current_user_id(http_request)
        firestore_service = get_firestore_service()
        project = await firestore_service.get_project(project_id, user_id)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # TODO: Generate signed URLs for assets if needed
        # This would involve Firebase Storage operations
        signed_urls = {}

        return ProjectResponse(project=project, signed_urls=signed_urls)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    request: UpdateProjectRequest,
    http_request: Request
) -> Project:
    """
    Update project metadata.

    Args:
        project_id: The project ID
        request: Update request data
        http_request: FastAPI Request object for auth

    Returns:
        Updated project object
    """
    try:
        user_id = await get_current_user_id(http_request)
        firestore_service = get_firestore_service()
        project = await firestore_service.update_project(project_id, user_id, request)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        logger.info(f"Updated project {project_id}")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    http_request: Request
) -> dict:
    """
    Delete a project and all associated data.

    Args:
        project_id: The project ID
        http_request: FastAPI Request object for auth

    Returns:
        Success message
    """
    try:
        user_id = await get_current_user_id(http_request)
        firestore_service = get_firestore_service()
        success = await firestore_service.delete_project(project_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Project not found")

        logger.info(f"Deleted project {project_id}")
        return {"message": f"Project {project_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/scenes", response_model=Project)
async def add_scene(
    project_id: str,
    scene_data: dict,  # Scene creation data
    http_request: Request
) -> Project:
    """
    Add a new scene to a project.

    Args:
        project_id: The project ID
        scene_data: Scene data
        http_request: FastAPI Request object for auth

    Returns:
        Updated project with new scene
    """
    try:
        user_id = await get_current_user_id(http_request)

        # Create scene object
        scene = Scene(
            id=str(uuid.uuid4()),
            scene_number=scene_data.get("scene_number", 0),
            title=scene_data.get("title", ""),
            description=scene_data.get("description", ""),
            duration_seconds=scene_data.get("duration_seconds", 5.0)
        )

        firestore_service = get_firestore_service()
        project = await firestore_service.add_scene(project_id, user_id, scene)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        logger.info(f"Added scene {scene.id} to project {project_id}")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding scene to project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{project_id}/scenes/{scene_id}", response_model=Project)
async def update_scene(
    project_id: str,
    scene_id: str,
    request: UpdateSceneRequest,
    http_request: Request
) -> Project:
    """
    Update a specific scene in a project.

    Args:
        project_id: The project ID
        scene_id: The scene ID
        request: Scene update data
        http_request: FastAPI Request object for auth

    Returns:
        Updated project object
    """
    try:
        user_id = await get_current_user_id(http_request)
        firestore_service = get_firestore_service()
        project = await firestore_service.update_scene(
            project_id, scene_id, user_id, request
        )

        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project or scene not found"
            )

        logger.info(f"Updated scene {scene_id} in project {project_id}")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating scene {scene_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/scenes/initialize", response_model=Project)
async def initialize_scenes(
    project_id: str,
    http_request: Request
) -> Project:
    """
    Initialize scenes for a project using AI-generated descriptions.
    
    This endpoint:
    1. Gets creative brief and selected mood from the project
    2. Generates 6 scene descriptions (placeholder for now)
    3. Creates scene objects and adds them to the project
    4. Returns updated project with scenes
    
    Args:
        project_id: The project ID
        http_request: FastAPI Request object for auth
    
    Returns:
        Updated project with initialized scenes
    """
    try:
        logger.info(f"[initialize_scenes] Starting for project {project_id}")
        user_id = await get_current_user_id(http_request)
        logger.info(f"[initialize_scenes] User ID: {user_id}")
        
        firestore_service = get_firestore_service()
        
        # Verify project ownership
        logger.info(f"[initialize_scenes] Getting project...")
        project = await firestore_service.get_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info(f"[initialize_scenes] Project found. Checking existing scenes...")
        logger.info(f"[initialize_scenes] project.scenes type: {type(project.scenes)}, value: {project.scenes}")
        
        # Check if scenes already exist (handle None case)
        existing_scenes = getattr(project, 'scenes', None) or []
        logger.info(f"[initialize_scenes] Existing scenes count: {len(existing_scenes)}")
        
        if len(existing_scenes) > 0:
            logger.info(f"Project {project_id} already has {len(existing_scenes)} scenes, skipping initialization")
            return project
        
        # Get creative brief and mood for context
        logger.info(f"[initialize_scenes] Getting creative brief and mood...")
        creative_brief = None
        selected_mood = None
        if project.storyboard:
            creative_brief = getattr(project.storyboard, 'creative_brief', None)
            selected_mood = getattr(project.storyboard, 'selected_mood', None)
        logger.info(f"[initialize_scenes] Creative brief exists: {creative_brief is not None}")
        
        # TODO: Call OpenAI to generate scene descriptions
        # For now, create placeholder scenes with basic structure
        logger.info(f"[initialize_scenes] Creating scene objects...")
        scenes = []
        for i in range(6):
            scene = Scene(
                id=str(uuid.uuid4()),
                scene_number=i + 1,
                title=f"Scene {i + 1}",
                description=f"AI-generated description for scene {i + 1}",
                duration_seconds=5.0
            )
            scenes.append(scene)
        logger.info(f"[initialize_scenes] Created {len(scenes)} scene objects")
        
        # Add scenes to project
        logger.info(f"[initialize_scenes] Adding scenes to project...")
        for idx, scene in enumerate(scenes):
            logger.info(f"[initialize_scenes] Adding scene {idx + 1}/{len(scenes)}: {scene.id}")
            project = await firestore_service.add_scene(project_id, user_id, scene)
            logger.info(f"[initialize_scenes] Scene {idx + 1} added successfully")
        
        logger.info(f"Initialized {len(scenes)} scenes for project {project_id}")
        return project
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Error initializing scenes: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/scenes/{scene_id}/generate-video", response_model=GenerateVideoResponse)
async def generate_video(
    project_id: str,
    scene_id: str,
    request: GenerateVideoRequest,
    background_tasks: BackgroundTasks,
    http_request: Request
) -> GenerateVideoResponse:
    """
    Trigger video generation for a scene.

    Args:
        project_id: The project ID
        scene_id: The scene ID
        request: Video generation request
        background_tasks: FastAPI background tasks
        http_request: FastAPI Request object for auth

    Returns:
        Job information for tracking progress
    """
    try:
        user_id = await get_current_user_id(http_request)

        # Get firestore service
        firestore_service = get_firestore_service()

        # Verify project ownership
        project = await firestore_service.get_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Find the scene
        scene = None
        for s in project.scenes:
            if s.id == scene_id:
                scene = s
                break

        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")

        # Check if there's already an active job (unless force regenerate)
        if scene.active_job and not request.force_regenerate:
            if scene.active_job.status in [JobStatus.QUEUED, JobStatus.PROCESSING]:
                return GenerateVideoResponse(
                    success=False,
                    job_id=scene.active_job.job_id,
                    scene_id=scene_id,
                    message="Video generation already in progress"
                )

        # Create new job
        job_id = str(uuid.uuid4())
        active_job = ActiveJob(
            job_id=job_id,
            type=JobType.VIDEO,
            status=JobStatus.QUEUED,
            progress=0,
            started_at=datetime.now(),
            last_update=datetime.now()
        )

        # Update scene with job info
        firestore_service = get_firestore_service()
        await firestore_service.update_scene_job(project_id, scene_id, active_job)

        # Trigger cloud function for video generation
        cloud_job_id = await CloudFunctionTrigger.trigger_video_generation(
            project_id=project_id,
            scene_id=scene_id,
            user_id=user_id,
            image_url=request.image_url or scene.assets.thumbnail_path or "",
            prompt=request.prompt or scene.description,
            duration=request.duration or scene.duration_seconds
        )

        logger.info(f"Video generation cloud function triggered for scene {scene_id} with job {cloud_job_id}")

        return GenerateVideoResponse(
            success=True,
            job_id=job_id,
            scene_id=scene_id,
            message="Video generation started"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering video generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/scenes/{scene_id}/generate-composition", response_model=GenerateVideoResponse)
async def generate_composition(
    project_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks,
    http_request: Request,
    custom_prompt: Optional[str] = None
) -> GenerateVideoResponse:
    """
    Trigger composition generation for a scene.

    Args:
        project_id: The project ID
        scene_id: The scene ID
        background_tasks: FastAPI background tasks
        http_request: FastAPI Request object for auth
        custom_prompt: Optional custom prompt for composition

    Returns:
        Job information for tracking progress
    """
    try:
        user_id = await get_current_user_id(http_request)

        # Get firestore service
        firestore_service = get_firestore_service()

        # Verify project ownership
        project = await firestore_service.get_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Find the scene
        scene = None
        for s in project.scenes:
            if s.id == scene_id:
                scene = s
                break

        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")

        # Create new job
        job_id = str(uuid.uuid4())
        active_job = ActiveJob(
            job_id=job_id,
            type=JobType.COMPOSITION,
            status=JobStatus.QUEUED,
            progress=0,
            started_at=datetime.now(),
            last_update=datetime.now()
        )

        # Update scene with job info
        await firestore_service.update_scene_job(project_id, scene_id, active_job)

        # Trigger cloud function for composition generation
        cloud_job_id = await CloudFunctionTrigger.trigger_composition_generation(
            project_id=project_id,
            scene_id=scene_id,
            user_id=user_id,
            custom_prompt=custom_prompt
        )

        logger.info(f"Composition generation cloud function triggered for scene {scene_id} with job {cloud_job_id}")

        return GenerateVideoResponse(
            success=True,
            job_id=job_id,
            scene_id=scene_id,
            message="Composition generation started"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering composition generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))