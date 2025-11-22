"""
Project-centric Firebase Cloud Functions for Jant Video Pipeline.

These functions work with the new project-centric data model where
all data is embedded within project documents.
"""
import os
from datetime import datetime
from typing import Dict, Any, Optional
from firebase_functions import firestore_fn, options
from firebase_admin import firestore
from services.project_firestore_client import ProjectFirestoreClient
from services.replicate_handler import ReplicateHandler
from services.openai_handler import OpenAIHandler
from services.firebase_storage_service import FirebaseStorageService


@firestore_fn.on_document_created(
    document="video_generation_jobs/{job_id}",
    timeout_sec=540,  # 9 minutes for long-running jobs
    memory=options.MemoryOption.GB_1,
    max_instances=10,
    secrets=["REPLICATE_API_TOKEN", "OPENAI_API_KEY"]
)
def generate_video_for_scene(event: firestore_fn.Event) -> None:
    """
    Generate video for a specific scene in a project.

    Job document schema:
    {
        "project_id": str,
        "scene_id": str,
        "user_id": str,
        "image_url": str,  # Input image URL or path
        "prompt": str,
        "duration": float,
        "status": "pending" | "processing" | "completed" | "failed",
        "created_at": timestamp,
        "error_message": str | None
    }
    """
    job_id = event.params['job_id']
    job_data = event.data.data
    project_id = job_data.get('project_id')
    scene_id = job_data.get('scene_id')
    
    print(f"[Video Generation] Starting job {job_id}")
    print(f"[Video Generation] Project: {project_id}, Scene: {scene_id}, User: {job_data.get('user_id')}")

    if not project_id or not scene_id:
        print(f"[Video Generation] Missing project_id or scene_id")
        _handle_error(job_id, "Missing project_id or scene_id", project_id, scene_id)
        return

    try:
        # Update job status to processing
        ProjectFirestoreClient.update_job('video_generation_jobs', job_id, {
            'status': 'processing',
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        # Update scene job status in project
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='video',
            status='processing',
            job_id=job_id,
            progress=10
        )

        # Get scene data from project
        scene = ProjectFirestoreClient.get_scene_from_project(project_id, scene_id)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found in project {project_id}")

        # Initialize handlers
        replicate_handler = ReplicateHandler()
        storage_service = FirebaseStorageService()

        # Update progress
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='video',
            status='processing',
            job_id=job_id,
            progress=30
        )

        # Generate video using Replicate
        video_url = replicate_handler.generate_video(
            image_url=job_data.get('image_url', ''),
            prompt=job_data.get('prompt', scene.get('description', '')),
            storyboard_id=project_id,  # Use project_id as storyboard reference
            scene_id=scene_id,
            duration=job_data.get('duration', scene.get('duration_seconds', 5.0))
        )

        if not video_url:
            raise Exception("No video URL returned from Replicate")
        
        print(f"[Video Generation] Replicate completed. Video URL: {video_url[:50]}...")

        # Update progress
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='video',
            status='processing',
            job_id=job_id,
            progress=70
        )

        # Upload to Firebase Storage if it's an external URL
        storage_path = None
        if video_url.startswith('http'):
            storage_path = f"projects/{project_id}/scenes/{scene_id}/video.mp4"
            storage_url = storage_service.upload_from_url(video_url, storage_path)
            if storage_url:
                storage_path = storage_path  # Store path, not full URL
        else:
            storage_path = video_url  # Already a storage path

        # Update scene with generated video path
        ProjectFirestoreClient.update_scene_assets(
            project_id=project_id,
            scene_id=scene_id,
            asset_type='video',
            storage_path=storage_path
        )

        # Mark job as completed
        ProjectFirestoreClient.update_job('video_generation_jobs', job_id, {
            'status': 'completed',
            'video_url': storage_path,
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        # Update scene job status to completed
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='video',
            status='completed',
            job_id=job_id,
            progress=100
        )

        print(f"[Video Generation] Successfully completed job {job_id}")
        print(f"[Video Generation] Updated project {project_id}, scene {scene_id}")

    except Exception as e:
        _handle_error(job_id, str(e), project_id, scene_id, job_type='video')


@firestore_fn.on_document_created(
    document="composition_generation_jobs/{job_id}",
    timeout_sec=300,  # 5 minutes for OpenAI generation
    memory=options.MemoryOption.MB_512,
    max_instances=10,
    secrets=["OPENAI_API_KEY"]
)
def generate_composition_for_scene(event: firestore_fn.Event) -> None:
    """
    Generate AI composition for a specific scene in a project.

    Job document schema:
    {
        "project_id": str,
        "scene_id": str,
        "user_id": str,
        "prompt": str | None,  # Optional custom prompt
        "status": "pending" | "processing" | "completed" | "failed",
        "created_at": timestamp,
        "error_message": str | None
    }
    """
    job_id = event.params['job_id']
    job_data = event.data.data
    project_id = job_data.get('project_id')
    scene_id = job_data.get('scene_id')
    
    print(f"[Composition Generation] Starting job {job_id}")
    print(f"[Composition Generation] Project: {project_id}, Scene: {scene_id}, User: {job_data.get('user_id')}")

    if not project_id or not scene_id:
        print(f"[Composition Generation] Missing project_id or scene_id")
        _handle_error(job_id, "Missing project_id or scene_id", project_id, scene_id)
        return

    try:
        # Update job status to processing
        ProjectFirestoreClient.update_job('composition_generation_jobs', job_id, {
            'status': 'processing',
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        # Update scene job status in project
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='composition',
            status='processing',
            job_id=job_id,
            progress=10
        )

        # Get project data for context
        project = ProjectFirestoreClient.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        scene = ProjectFirestoreClient.get_scene_from_project(project_id, scene_id)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found in project {project_id}")

        # Initialize OpenAI handler
        openai_handler = OpenAIHandler()

        # Prepare context for composition generation
        storyboard = project.get('storyboard', {})
        creative_brief = storyboard.get('creative_brief', {})
        selected_mood = storyboard.get('selected_mood', {})

        # Update progress
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='composition',
            status='processing',
            job_id=job_id,
            progress=30
        )

        # Generate composition using OpenAI
        custom_prompt = job_data.get('prompt')
        composition = openai_handler.generate_scene_composition(
            scene_title=scene.get('title', ''),
            scene_description=scene.get('description', ''),
            brand_name=creative_brief.get('brand_name', ''),
            product_description=creative_brief.get('product_description', ''),
            target_audience=creative_brief.get('target_audience', ''),
            key_message=creative_brief.get('key_message', ''),
            tone=creative_brief.get('tone', ''),
            mood_name=selected_mood.get('name', ''),
            visual_style=selected_mood.get('visual_style', ''),
            custom_prompt=custom_prompt
        )

        if not composition:
            raise Exception("No composition returned from OpenAI")

        # Update progress
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='composition',
            status='processing',
            job_id=job_id,
            progress=70
        )

        # Update scene with composition details
        ProjectFirestoreClient.update_scene_composition(
            project_id=project_id,
            scene_id=scene_id,
            description=composition.get('description', ''),
            styling=composition.get('styling', ''),
            animation=composition.get('animation', '')
        )

        # Also store composition as an asset path (save to Storage)
        storage_service = FirebaseStorageService()
        composition_json = {
            'scene_id': scene_id,
            'composition': composition,
            'generated_at': datetime.now().isoformat()
        }

        storage_path = f"projects/{project_id}/scenes/{scene_id}/composition.json"
        storage_service.upload_json(composition_json, storage_path)

        ProjectFirestoreClient.update_scene_assets(
            project_id=project_id,
            scene_id=scene_id,
            asset_type='composition',
            storage_path=storage_path
        )

        # Mark job as completed
        ProjectFirestoreClient.update_job('composition_generation_jobs', job_id, {
            'status': 'completed',
            'composition': composition,
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        # Update scene job status to completed
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type='composition',
            status='completed',
            job_id=job_id,
            progress=100
        )

        print(f"[Composition Generation] Successfully completed job {job_id}")
        print(f"[Composition Generation] Updated project {project_id}, scene {scene_id}")

    except Exception as e:
        _handle_error(job_id, str(e), project_id, scene_id, job_type='composition')


@firestore_fn.on_document_created(
    document="multi_scene_generation_jobs/{job_id}",
    timeout_sec=540,  # 9 minutes for multiple scenes
    memory=options.MemoryOption.GB_1,
    max_instances=5,
    secrets=["REPLICATE_API_TOKEN", "OPENAI_API_KEY"]
)
def generate_videos_for_all_scenes(event: firestore_fn.Event) -> None:
    """
    Generate videos for all scenes in a project.

    Job document schema:
    {
        "project_id": str,
        "user_id": str,
        "scene_ids": [str],  # List of scene IDs to process
        "status": "pending" | "processing" | "completed" | "failed",
        "progress": int,  # Overall progress 0-100
        "results": [{scene_id: str, status: str, video_path: str | None}],
        "created_at": timestamp,
        "error_message": str | None
    }
    """
    job_id = event.params['job_id']
    job_data = event.data.data
    project_id = job_data.get('project_id')
    scene_ids = job_data.get('scene_ids', [])
    
    print(f"[Multi-Scene Generation] Starting job {job_id}")
    print(f"[Multi-Scene Generation] Project: {project_id}, Scenes: {len(scene_ids)}, User: {job_data.get('user_id')}")

    if not project_id or not scene_ids:
        print(f"[Multi-Scene Generation] Missing project_id or scene_ids")
        _handle_error(job_id, "Missing project_id or scene_ids", project_id)
        return

    try:
        # Update job status to processing
        ProjectFirestoreClient.update_job('multi_scene_generation_jobs', job_id, {
            'status': 'processing',
            'progress': 0,
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        # Initialize handlers
        replicate_handler = ReplicateHandler()
        storage_service = FirebaseStorageService()

        results = []
        total_scenes = len(scene_ids)

        for idx, scene_id in enumerate(scene_ids):
            print(f"[Multi-Scene Generation] Processing scene {idx + 1}/{total_scenes}: {scene_id}")

            try:
                # Update progress
                progress = int((idx / total_scenes) * 100)
                ProjectFirestoreClient.update_job('multi_scene_generation_jobs', job_id, {
                    'progress': progress,
                    'updated_at': firestore.SERVER_TIMESTAMP
                })

                # Update scene job status
                ProjectFirestoreClient.update_scene_job_status(
                    project_id=project_id,
                    scene_id=scene_id,
                    job_type='video',
                    status='processing',
                    job_id=f"{job_id}_{scene_id}",
                    progress=0
                )

                # Get scene data
                scene = ProjectFirestoreClient.get_scene_from_project(project_id, scene_id)
                if not scene:
                    raise ValueError(f"Scene {scene_id} not found")

                # Generate video
                image_url = scene.get('assets', {}).get('thumbnail_path', '')
                if not image_url:
                    raise ValueError(f"No image available for scene {scene_id}")

                video_url = replicate_handler.generate_video(
                    image_url=image_url,
                    prompt=scene.get('description', ''),
                    storyboard_id=project_id,
                    scene_id=scene_id,
                    duration=scene.get('duration_seconds', 5.0)
                )

                if video_url:
                    # Upload to Storage
                    storage_path = f"projects/{project_id}/scenes/{scene_id}/video.mp4"
                    if video_url.startswith('http'):
                        storage_service.upload_from_url(video_url, storage_path)

                    # Update scene assets
                    ProjectFirestoreClient.update_scene_assets(
                        project_id=project_id,
                        scene_id=scene_id,
                        asset_type='video',
                        storage_path=storage_path
                    )

                    results.append({
                        'scene_id': scene_id,
                        'status': 'completed',
                        'video_path': storage_path
                    })

                    # Update scene job status to completed
                    ProjectFirestoreClient.update_scene_job_status(
                        project_id=project_id,
                        scene_id=scene_id,
                        job_type='video',
                        status='completed',
                        job_id=f"{job_id}_{scene_id}",
                        progress=100
                    )
                else:
                    raise Exception("No video URL returned")

            except Exception as scene_error:
                print(f"[Multi-Scene Generation] Error on scene {scene_id}: {str(scene_error)}")
                results.append({
                    'scene_id': scene_id,
                    'status': 'failed',
                    'error': str(scene_error)
                })

                # Update scene job status to failed
                ProjectFirestoreClient.update_scene_job_status(
                    project_id=project_id,
                    scene_id=scene_id,
                    job_type='video',
                    status='failed',
                    job_id=f"{job_id}_{scene_id}",
                    progress=0,
                    error_message=str(scene_error)
                )

        # Mark job as completed
        ProjectFirestoreClient.update_job('multi_scene_generation_jobs', job_id, {
            'status': 'completed',
            'progress': 100,
            'results': results,
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        print(f"[Multi-Scene Generation] Completed job {job_id}")

    except Exception as e:
        _handle_error(job_id, str(e), project_id, job_type='multi-scene')


def _handle_error(
    job_id: str,
    error_message: str,
    project_id: Optional[str] = None,
    scene_id: Optional[str] = None,
    job_type: str = 'video'
) -> None:
    """
    Handle errors in cloud functions.

    Args:
        job_id: The job ID
        error_message: The error message
        project_id: Optional project ID
        scene_id: Optional scene ID
        job_type: Type of job
    """
    print(f"[Error Handler] Job {job_id} failed: {error_message}")

    # Determine collection name based on job type
    collection_map = {
        'video': 'video_generation_jobs',
        'composition': 'composition_generation_jobs',
        'multi-scene': 'multi_scene_generation_jobs'
    }
    collection = collection_map.get(job_type, 'video_generation_jobs')

    # Update job with error
    ProjectFirestoreClient.update_job(collection, job_id, {
        'status': 'failed',
        'error_message': error_message,
        'updated_at': firestore.SERVER_TIMESTAMP
    })

    # Update scene job status if we have the IDs
    if project_id and scene_id:
        ProjectFirestoreClient.update_scene_job_status(
            project_id=project_id,
            scene_id=scene_id,
            job_type=job_type.replace('-scene', '').replace('multi', 'video'),
            status='failed',
            job_id=job_id,
            progress=0,
            error_message=error_message
        )