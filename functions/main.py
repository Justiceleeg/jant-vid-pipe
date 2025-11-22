"""
Firebase Cloud Functions for Jant Video Pipeline.

This module contains all Cloud Functions that handle async generation tasks.
Functions are triggered by Firestore document creation.
"""
import os
from datetime import datetime
from firebase_functions import firestore_fn, options
from firebase_admin import firestore
from services.firestore_client import FirestoreClient
from services.replicate_handler import ReplicateHandler
from services.openai_handler import OpenAIHandler


@firestore_fn.on_document_created(
    document="image_generation_jobs/{job_id}",
    timeout_sec=540,  # 9 minutes for long-running Replicate jobs
    memory=options.MemoryOption.GB_1,
    max_instances=10,
    secrets=["REPLICATE_API_TOKEN", "OPENAI_API_KEY"]
)
def handle_image_generation(event: firestore_fn.Event) -> None:
    """
    DEPRECATED: This function is for legacy storyboard-based flow.
    Use project-based functions in project_functions.py instead.
    
    This function will be removed in a future release.
    
    Cloud Function triggered when a new image generation job is created.
    
    Job document schema:
    {
        "scene_id": str,
        "storyboard_id": str,
        "user_id": str,
        "text": str,
        "style_prompt": str,
        "use_product_composite": bool,
        "product_id": str | None,
        "status": "pending" | "processing" | "complete" | "error",
        "created_at": timestamp,
        "updated_at": timestamp,
        "error_message": str | None
    }
    """
    print("[DEPRECATED] handle_image_generation called - use project-based functions instead")
    print(f"[Image Generation] Function triggered for job {event.params['job_id']}")
    
    try:
        job_data = event.data.data
        job_id = event.params['job_id']
        scene_id = job_data.get('scene_id')
        
        if not scene_id:
            raise ValueError("scene_id missing from job data")
        
        # Update job status to processing
        FirestoreClient.update_job('image_generation_jobs', job_id, {
            'status': 'processing',
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update scene status
        FirestoreClient.update_scene(scene_id, {
            'generation_status.image': 'generating'
        })
        
        # Initialize Replicate handler
        replicate_handler = ReplicateHandler()
        
        # Check if product compositing is needed
        use_product = job_data.get('use_product_composite', False)
        product_id = job_data.get('product_id')
        
        storyboard_id = job_data.get('storyboard_id')
        if not storyboard_id:
            raise ValueError("storyboard_id missing from job data")
        
        if use_product and product_id:
            # TODO: Implement product compositing
            # For now, just generate without product
            print(f"[Image Generation] Product compositing requested but not yet implemented in Cloud Functions")
            image_url = replicate_handler.generate_image(
                prompt=job_data.get('text', ''),
                style_prompt=job_data.get('style_prompt', ''),
                storyboard_id=storyboard_id,
                scene_id=scene_id,
                width=1080,
                height=1920
            )
        else:
            # Standard image generation
            image_url = replicate_handler.generate_image(
                prompt=job_data.get('text', ''),
                style_prompt=job_data.get('style_prompt', ''),
                storyboard_id=storyboard_id,
                scene_id=scene_id,
                width=1080,
                height=1920
            )
        
        if not image_url:
            raise Exception("No image URL returned from Replicate")
        
        # Update scene with generated image
        FirestoreClient.update_scene(scene_id, {
            'image_url': image_url,
            'state': 'image',
            'generation_status.image': 'complete',
            'error_message': None
        })
        
        # Update job to complete
        FirestoreClient.update_job('image_generation_jobs', job_id, {
            'status': 'complete',
            'image_url': image_url,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        print(f"[Image Generation] Successfully generated image for scene {scene_id}")
        
    except Exception as e:
        print(f"[Image Generation] Error: {str(e)}")
        
        # Update job with error
        FirestoreClient.update_job('image_generation_jobs', job_id, {
            'status': 'error',
            'error_message': str(e),
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update scene with error
        if 'scene_id' in job_data:
            FirestoreClient.update_scene(job_data['scene_id'], {
                'generation_status.image': 'error',
                'error_message': f"Image generation failed: {str(e)}"
            })
        
        # Re-raise to trigger retry
        raise


@firestore_fn.on_document_created(
    document="video_generation_jobs/{job_id}",
    timeout_sec=540,  # 9 minutes for long-running Replicate jobs
    memory=options.MemoryOption.GB_1,
    max_instances=10,
    secrets=["REPLICATE_API_TOKEN", "OPENAI_API_KEY"]
)
def handle_video_generation(event: firestore_fn.Event) -> None:
    """
    DEPRECATED: This function is for legacy storyboard-based flow.
    Use project-based functions in project_functions.py instead.
    
    This function will be removed in a future release.
    
    Cloud Function triggered when a new video generation job is created.
    
    Job document schema:
    {
        "scene_id": str,
        "storyboard_id": str,
        "user_id": str,
        "image_url": str,
        "text": str,
        "duration": float,
        "status": "pending" | "processing" | "complete" | "error",
        "created_at": timestamp,
        "updated_at": timestamp,
        "error_message": str | None
    }
    """
    print("[DEPRECATED] handle_video_generation called - use project-based functions instead")
    print(f"[Video Generation] Function triggered for job {event.params['job_id']}")
    
    try:
        job_data = event.data.data
        job_id = event.params['job_id']
        scene_id = job_data.get('scene_id')
        
        if not scene_id:
            raise ValueError("scene_id missing from job data")
        
        # Update job status to processing
        FirestoreClient.update_job('video_generation_jobs', job_id, {
            'status': 'processing',
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update scene status
        FirestoreClient.update_scene(scene_id, {
            'generation_status.video': 'generating'
        })
        
        storyboard_id = job_data.get('storyboard_id')
        if not storyboard_id:
            raise ValueError("storyboard_id missing from job data")
        
        # Initialize Replicate handler
        replicate_handler = ReplicateHandler()
        
        # Generate video from image
        video_url = replicate_handler.generate_video(
            image_url=job_data.get('image_url', ''),
            prompt=job_data.get('text', ''),
            storyboard_id=storyboard_id,
            scene_id=scene_id,
            duration=job_data.get('duration', 5.0)
        )
        
        if not video_url:
            raise Exception("No video URL returned from Replicate")
        
        # Update scene with generated video
        FirestoreClient.update_scene(scene_id, {
            'video_url': video_url,
            'state': 'video',
            'generation_status.video': 'complete',
            'error_message': None
        })
        
        # Update job to complete
        FirestoreClient.update_job('video_generation_jobs', job_id, {
            'status': 'complete',
            'video_url': video_url,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        print(f"[Video Generation] Successfully generated video for scene {scene_id}")
        
    except Exception as e:
        print(f"[Video Generation] Error: {str(e)}")
        
        # Update job with error
        FirestoreClient.update_job('video_generation_jobs', job_id, {
            'status': 'error',
            'error_message': str(e),
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Update scene with error
        if 'scene_id' in job_data:
            FirestoreClient.update_scene(job_data['scene_id'], {
                'generation_status.video': 'error',
                'error_message': f"Video generation failed: {str(e)}"
            })
        
        # Re-raise to trigger retry
        raise


@firestore_fn.on_document_created(
    document="multi_video_jobs/{job_id}",
    timeout_sec=540,  # 9 minutes for long-running Replicate jobs
    memory=options.MemoryOption.GB_1,
    max_instances=10,
    secrets=["REPLICATE_API_TOKEN", "OPENAI_API_KEY"]
)
def handle_multi_video_generation(event: firestore_fn.Event) -> None:
    """
    DEPRECATED: This function is for legacy storyboard-based flow.
    Use generate_videos_for_all_scenes in project_functions.py instead.
    
    This function will be removed in a future release.
    
    Cloud Function for generating videos for multiple scenes.
    
    Job document schema:
    {
        "scenes": [{"scene_number": int, "seed_image_url": str, "duration": float, ...}],
        "audio_url": str | None,
        "user_id": str,
        "status": "pending" | "processing" | "complete" | "error",
        "progress_percent": int,
        "clips": [{"scene_number": int, "video_url": str, "status": str}],
        "created_at": timestamp,
        "updated_at": timestamp,
        "error_message": str | None
    }
    """
    print("[DEPRECATED] handle_multi_video_generation called - use project-based functions instead")
    print(f"[Multi-Video Generation] Function triggered for job {event.params['job_id']}")
    
    try:
        job_data = event.data.data
        job_id = event.params['job_id']
        scenes = job_data.get('scenes', [])
        
        if not scenes:
            raise ValueError("No scenes provided in job data")
        
        storyboard_id = job_data.get('storyboard_id')
        if not storyboard_id:
            raise ValueError("storyboard_id missing from job data")
        
        # Update job status to processing
        FirestoreClient.update_job('multi_video_jobs', job_id, {
            'status': 'processing',
            'progress_percent': 0,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Initialize Replicate handler
        replicate_handler = ReplicateHandler()
        
        # Process each scene
        clips = []
        total_scenes = len(scenes)
        
        for idx, scene in enumerate(scenes):
            scene_number = scene.get('scene_number', idx + 1)
            scene_id = scene.get('scene_id', scene.get('id', f"scene_{scene_number}"))
            print(f"[Multi-Video Generation] Processing scene {scene_number}/{total_scenes}")
            
            try:
                # Generate video
                video_url = replicate_handler.generate_video(
                    image_url=scene.get('seed_image_url', ''),
                    prompt=scene.get('description', ''),
                    storyboard_id=storyboard_id,
                    scene_id=scene_id,
                    duration=scene.get('duration', 5.0)
                )
                
                clips.append({
                    'scene_number': scene_number,
                    'video_url': video_url,
                    'status': 'complete',
                    'duration': scene.get('duration', 5.0)
                })
                
            except Exception as scene_error:
                print(f"[Multi-Video Generation] Error on scene {scene_number}: {scene_error}")
                clips.append({
                    'scene_number': scene_number,
                    'status': 'error',
                    'error_message': str(scene_error)
                })
            
            # Update progress
            progress = int(((idx + 1) / total_scenes) * 100)
            FirestoreClient.update_job('multi_video_jobs', job_id, {
                'progress_percent': progress,
                'clips': clips,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
        
        # Mark job as complete
        FirestoreClient.update_job('multi_video_jobs', job_id, {
            'status': 'complete',
            'progress_percent': 100,
            'clips': clips,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        print(f"[Multi-Video Generation] Completed all {total_scenes} scenes")
        
    except Exception as e:
        print(f"[Multi-Video Generation] Error: {str(e)}")
        
        # Update job with error
        FirestoreClient.update_job('multi_video_jobs', job_id, {
            'status': 'error',
            'error_message': str(e),
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Re-raise to trigger retry
        raise


@firestore_fn.on_document_created(
    document="composition_jobs/{job_id}",
    timeout_sec=540,  # 9 minutes for long-running Replicate jobs
    memory=options.MemoryOption.GB_1,
    max_instances=10,
    secrets=["REPLICATE_API_TOKEN", "OPENAI_API_KEY"]
)
def handle_composition(event: firestore_fn.Event) -> None:
    """
    DEPRECATED: This function is for legacy storyboard-based flow.
    Use generate_composition_for_scene in project_functions.py instead.
    
    This function will be removed in a future release.
    
    Cloud Function for composing multiple video clips into final video.
    
    Job document schema:
    {
        "clips": [{"scene_number": int, "video_url": str, "duration": float}],
        "audio_url": str | None,
        "include_crossfade": bool,
        "optimize_size": bool,
        "user_id": str,
        "status": "pending" | "processing" | "complete" | "error",
        "progress_percent": int,
        "video_url": str | None,
        "created_at": timestamp,
        "updated_at": timestamp,
        "error_message": str | None
    }
    """
    print("[DEPRECATED] handle_composition called - use project-based functions instead")
    print(f"[Composition] Function triggered for job {event.params['job_id']}")
    
    try:
        job_data = event.data.data
        job_id = event.params['job_id']
        clips = job_data.get('clips', [])
        
        if not clips:
            raise ValueError("No clips provided for composition")
        
        # Update job status to processing
        FirestoreClient.update_job('composition_jobs', job_id, {
            'status': 'processing',
            'progress_percent': 10,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # TODO: Implement actual video composition logic
        # This would involve:
        # 1. Download all clip URLs to temp storage
        # 2. Use ffmpeg or similar to stitch them together
        # 3. Add audio if provided
        # 4. Add crossfades if requested
        # 5. Upload final video to Firebase Storage
        # 6. Return the final video URL
        
        # For now, just mark as complete with placeholder
        print("[Composition] Video composition not yet implemented in Cloud Functions")
        
        # Placeholder: return first clip as "composed" video
        video_url = clips[0].get('video_url') if clips else None
        
        # Update job to complete
        FirestoreClient.update_job('composition_jobs', job_id, {
            'status': 'complete',
            'progress_percent': 100,
            'video_url': video_url,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        print(f"[Composition] Marked job {job_id} as complete (placeholder)")
        
    except Exception as e:
        print(f"[Composition] Error: {str(e)}")
        
        # Update job with error
        FirestoreClient.update_job('composition_jobs', job_id, {
            'status': 'error',
            'error_message': str(e),
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Re-raise to trigger retry
        raise

