"""
Cloud Function Trigger Service

Handles triggering cloud functions by creating job documents in Firestore.
"""
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from google.cloud import firestore
from app.firestore_database import db


class CloudFunctionTrigger:
    """Service for triggering cloud functions via Firestore document creation."""

    @staticmethod
    async def trigger_video_generation(
        project_id: str,
        scene_id: str,
        user_id: str,
        image_url: str,
        prompt: str,
        duration: float = 5.0
    ) -> str:
        """
        Trigger video generation for a scene.

        Args:
            project_id: Project ID
            scene_id: Scene ID
            user_id: User ID
            image_url: Input image URL or storage path
            prompt: Generation prompt
            duration: Video duration in seconds

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        job_data = {
            'project_id': project_id,
            'scene_id': scene_id,
            'user_id': user_id,
            'image_url': image_url,
            'prompt': prompt,
            'duration': duration,
            'status': 'pending',
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        }

        # Create job document to trigger cloud function
        await db.collection('video_generation_jobs').document(job_id).set(job_data)

        return job_id

    @staticmethod
    async def trigger_composition_generation(
        project_id: str,
        scene_id: str,
        user_id: str,
        custom_prompt: Optional[str] = None
    ) -> str:
        """
        Trigger AI composition generation for a scene.

        Args:
            project_id: Project ID
            scene_id: Scene ID
            user_id: User ID
            custom_prompt: Optional custom prompt for generation

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        job_data = {
            'project_id': project_id,
            'scene_id': scene_id,
            'user_id': user_id,
            'status': 'pending',
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        }

        if custom_prompt:
            job_data['prompt'] = custom_prompt

        # Create job document to trigger cloud function
        await db.collection('composition_generation_jobs').document(job_id).set(job_data)

        return job_id

    @staticmethod
    async def trigger_multi_scene_generation(
        project_id: str,
        scene_ids: List[str],
        user_id: str
    ) -> str:
        """
        Trigger video generation for multiple scenes.

        Args:
            project_id: Project ID
            scene_ids: List of scene IDs to process
            user_id: User ID

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        job_data = {
            'project_id': project_id,
            'scene_ids': scene_ids,
            'user_id': user_id,
            'status': 'pending',
            'progress': 0,
            'results': [],
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        }

        # Create job document to trigger cloud function
        await db.collection('multi_scene_generation_jobs').document(job_id).set(job_data)

        return job_id

    @staticmethod
    async def trigger_audio_generation(
        project_id: str,
        user_id: str,
        mood_description: str,
        duration: float = 60.0
    ) -> str:
        """
        Trigger audio/music generation for a project.

        Args:
            project_id: Project ID
            user_id: User ID
            mood_description: Description of the desired mood/music
            duration: Audio duration in seconds

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        job_data = {
            'project_id': project_id,
            'user_id': user_id,
            'mood_description': mood_description,
            'duration': duration,
            'status': 'pending',
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        }

        # Create job document to trigger cloud function
        await db.collection('audio_generation_jobs').document(job_id).set(job_data)

        return job_id

    @staticmethod
    async def get_job_status(collection: str, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a job.

        Args:
            collection: Firestore collection name
            job_id: Job ID

        Returns:
            Job document data or None if not found
        """
        doc = await db.collection(collection).document(job_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['job_id'] = doc.id
            return data
        return None

    @staticmethod
    async def cancel_job(collection: str, job_id: str) -> bool:
        """
        Cancel a pending or processing job.

        Args:
            collection: Firestore collection name
            job_id: Job ID

        Returns:
            True if cancelled, False otherwise
        """
        try:
            await db.collection(collection).document(job_id).update({
                'status': 'cancelled',
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            return True
        except Exception as e:
            print(f"Error cancelling job {job_id}: {str(e)}")
            return False

    @staticmethod
    async def retry_failed_job(collection: str, job_id: str) -> bool:
        """
        Retry a failed job by resetting its status.

        Args:
            collection: Firestore collection name
            job_id: Job ID

        Returns:
            True if retry initiated, False otherwise
        """
        try:
            # Get current job data
            doc = await db.collection(collection).document(job_id).get()
            if not doc.exists:
                return False

            job_data = doc.to_dict()
            if job_data.get('status') != 'failed':
                return False

            # Reset status to trigger retry
            await db.collection(collection).document(job_id).update({
                'status': 'pending',
                'error_message': None,
                'retry_count': job_data.get('retry_count', 0) + 1,
                'updated_at': firestore.SERVER_TIMESTAMP
            })

            return True
        except Exception as e:
            print(f"Error retrying job {job_id}: {str(e)}")
            return False

    @staticmethod
    async def batch_trigger_scenes(
        project_id: str,
        user_id: str,
        scene_configs: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Trigger generation for multiple scenes with different configurations.

        Args:
            project_id: Project ID
            user_id: User ID
            scene_configs: List of scene configurations

        Returns:
            List of job IDs
        """
        job_ids = []

        for config in scene_configs:
            scene_id = config.get('scene_id')
            if not scene_id:
                continue

            # Trigger video generation if requested
            if config.get('generate_video'):
                job_id = await CloudFunctionTrigger.trigger_video_generation(
                    project_id=project_id,
                    scene_id=scene_id,
                    user_id=user_id,
                    image_url=config.get('image_url', ''),
                    prompt=config.get('prompt', ''),
                    duration=config.get('duration', 5.0)
                )
                job_ids.append(job_id)

            # Trigger composition generation if requested
            if config.get('generate_composition'):
                job_id = await CloudFunctionTrigger.trigger_composition_generation(
                    project_id=project_id,
                    scene_id=scene_id,
                    user_id=user_id,
                    custom_prompt=config.get('composition_prompt')
                )
                job_ids.append(job_id)

        return job_ids