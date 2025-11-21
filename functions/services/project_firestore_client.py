"""
Project-centric Firestore client for Cloud Functions.

This client works with the new project-centric data model where
all data is embedded within project documents.
"""
import firebase_admin
from firebase_admin import firestore
from typing import Optional, Dict, Any, List
from datetime import datetime


def _get_firestore_client():
    """Lazy initialization of Firestore client."""
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app()

    return firestore.client()


class ProjectFirestoreClient:
    """Helper class for project-centric Firestore operations in Cloud Functions."""

    @staticmethod
    def get_project(project_id: str) -> Optional[dict]:
        """Get project document by ID."""
        db = _get_firestore_client()
        doc = db.collection('projects').document(project_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None

    @staticmethod
    def get_scene_from_project(project_id: str, scene_id: str) -> Optional[dict]:
        """Get a specific scene from a project."""
        project = ProjectFirestoreClient.get_project(project_id)
        if not project:
            return None

        scenes = project.get('scenes', [])
        for scene in scenes:
            if scene.get('id') == scene_id:
                return scene
        return None

    @staticmethod
    def update_scene_in_project(
        project_id: str,
        scene_id: str,
        updates: Dict[str, Any],
        progress: Optional[int] = None
    ) -> bool:
        """
        Update a specific scene within a project document.

        Args:
            project_id: The project ID
            scene_id: The scene ID
            updates: Dictionary of updates to apply to the scene
            progress: Optional progress percentage (0-100)

        Returns:
            True if successful, False otherwise
        """
        db = _get_firestore_client()

        try:
            # Get current project
            project_ref = db.collection('projects').document(project_id)
            project = project_ref.get()

            if not project.exists:
                print(f"Project {project_id} not found")
                return False

            project_data = project.to_dict()
            scenes = project_data.get('scenes', [])

            # Find and update the specific scene
            scene_found = False
            for i, scene in enumerate(scenes):
                if scene.get('id') == scene_id:
                    # Apply updates to the scene
                    scenes[i].update(updates)
                    scene_found = True
                    break

            if not scene_found:
                print(f"Scene {scene_id} not found in project {project_id}")
                return False

            # Prepare the update
            update_data = {
                'scenes': scenes,
                'updated_at': firestore.SERVER_TIMESTAMP
            }

            # Update stats if needed
            if 'assets' in updates and (updates['assets'].get('video_path') or updates['assets'].get('composition_path')):
                # Recalculate completed scenes
                completed_count = sum(1 for s in scenes if s.get('assets', {}).get('video_path'))
                update_data['stats.completed_scenes'] = completed_count

            update_data['stats.last_activity'] = firestore.SERVER_TIMESTAMP

            # Apply the update
            project_ref.update(update_data)
            return True

        except Exception as e:
            print(f"Error updating scene {scene_id} in project {project_id}: {str(e)}")
            return False

    @staticmethod
    def update_scene_job_status(
        project_id: str,
        scene_id: str,
        job_type: str,
        status: str,
        job_id: str,
        progress: int = 0,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update the active job status for a scene.

        Args:
            project_id: The project ID
            scene_id: The scene ID
            job_type: Type of job ('video', 'composition', 'audio')
            status: Job status ('queued', 'processing', 'completed', 'failed')
            job_id: The job ID
            progress: Progress percentage (0-100)
            error_message: Optional error message if status is 'failed'
        """
        active_job = {
            'job_id': job_id,
            'type': job_type,
            'status': status,
            'progress': progress,
            'started_at': firestore.SERVER_TIMESTAMP if status == 'processing' else None,
            'last_update': firestore.SERVER_TIMESTAMP
        }

        if error_message:
            active_job['error_message'] = error_message

        return ProjectFirestoreClient.update_scene_in_project(
            project_id,
            scene_id,
            {'active_job': active_job},
            progress=progress
        )

    @staticmethod
    def update_scene_assets(
        project_id: str,
        scene_id: str,
        asset_type: str,
        storage_path: str
    ) -> bool:
        """
        Update scene assets with a new generated asset.

        Args:
            project_id: The project ID
            scene_id: The scene ID
            asset_type: Type of asset ('video', 'composition', 'audio', 'thumbnail')
            storage_path: Firebase Storage path (not full URL)
        """
        asset_key = f"{asset_type}_path"
        updates = {
            f'assets.{asset_key}': storage_path,
            'assets.generated_at': firestore.SERVER_TIMESTAMP
        }

        # If video is complete, clear the active job
        if asset_type in ['video', 'composition']:
            updates['active_job.status'] = 'completed'
            updates['active_job.progress'] = 100
            updates['active_job.last_update'] = firestore.SERVER_TIMESTAMP

        return ProjectFirestoreClient.update_scene_in_project(
            project_id,
            scene_id,
            updates
        )

    @staticmethod
    def update_scene_composition(
        project_id: str,
        scene_id: str,
        description: str,
        styling: str,
        animation: str
    ) -> bool:
        """
        Update scene with AI-generated composition details.

        Args:
            project_id: The project ID
            scene_id: The scene ID
            description: Composition description
            styling: Composition styling
            animation: Animation details
        """
        composition = {
            'description': description,
            'styling': styling,
            'animation': animation,
            'generated_at': firestore.SERVER_TIMESTAMP
        }

        return ProjectFirestoreClient.update_scene_in_project(
            project_id,
            scene_id,
            {'composition': composition}
        )

    @staticmethod
    def get_job(collection: str, job_id: str) -> Optional[dict]:
        """Get job document (for backward compatibility)."""
        db = _get_firestore_client()
        doc = db.collection(collection).document(job_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['job_id'] = doc.id
            return data
        return None

    @staticmethod
    def update_job(collection: str, job_id: str, updates: dict):
        """Update job document (for backward compatibility)."""
        db = _get_firestore_client()
        db.collection(collection).document(job_id).update(updates)

    @staticmethod
    def batch_update_scenes(
        project_id: str,
        scene_updates: List[Dict[str, Any]]
    ) -> bool:
        """
        Batch update multiple scenes in a project.

        Args:
            project_id: The project ID
            scene_updates: List of dicts with 'scene_id' and 'updates' keys

        Returns:
            True if successful, False otherwise
        """
        db = _get_firestore_client()

        try:
            # Get current project
            project_ref = db.collection('projects').document(project_id)
            project = project_ref.get()

            if not project.exists:
                print(f"Project {project_id} not found")
                return False

            project_data = project.to_dict()
            scenes = project_data.get('scenes', [])

            # Apply all updates
            for update_item in scene_updates:
                scene_id = update_item.get('scene_id')
                updates = update_item.get('updates', {})

                for i, scene in enumerate(scenes):
                    if scene.get('id') == scene_id:
                        scenes[i].update(updates)
                        break

            # Update the project
            project_ref.update({
                'scenes': scenes,
                'updated_at': firestore.SERVER_TIMESTAMP,
                'stats.last_activity': firestore.SERVER_TIMESTAMP
            })

            return True

        except Exception as e:
            print(f"Error batch updating scenes in project {project_id}: {str(e)}")
            return False