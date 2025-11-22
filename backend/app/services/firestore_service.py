"""
Firestore service for managing project documents.

This module handles all Firestore operations for the project-centric data model.
"""

import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from google.cloud.firestore import FieldFilter, Query
import logging

from ..models.project_models import (
    Project,
    CreateProjectRequest,
    UpdateProjectRequest,
    UpdateSceneRequest,
    Scene,
    SceneAssets,
    ActiveJob,
    JobStatus,
    JobType,
    EmbeddedStoryboard,
    ProjectStats,
    update_project_stats,
)

# Set up logging
logger = logging.getLogger(__name__)


class FirestoreService:
    """Service class for Firestore operations."""

    def __init__(self):
        """Initialize the Firestore service."""
        # Import here to avoid circular dependencies
        from ..firestore_database import db as firestore_db

        if not firestore_db.db:
            logger.error("Firestore database not initialized")
            raise RuntimeError("Firestore database not initialized. Check Firebase configuration.")

        self.db = firestore_db.db
        self.projects_collection = self.db.collection('projects')

    async def create_project(
        self,
        user_id: str,
        request: CreateProjectRequest
    ) -> Project:
        """
        Create a new project in Firestore.

        Args:
            user_id: The ID of the user creating the project
            request: Project creation request data

        Returns:
            The created Project object
        """
        project_id = str(uuid.uuid4())
        storyboard_id = str(uuid.uuid4())

        # Create the embedded storyboard
        storyboard = EmbeddedStoryboard(
            id=storyboard_id,
            title=request.storyboard_title,
            creative_brief=request.creative_brief,
            selected_mood=request.selected_mood
        )

        # Create initial project stats
        stats = ProjectStats(
            total_scenes=0,
            completed_scenes=0,
            last_activity=datetime.now()
        )

        # Create the project
        project = Project(
            id=project_id,
            name=request.name,
            description=request.description,
            user_id=user_id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            storyboard=storyboard,
            scenes=[],
            stats=stats
        )

        # Convert to dict and save to Firestore
        project_data = project.dict()
        self.projects_collection.document(project_id).set(project_data)

        logger.info(f"Created project {project_id} for user {user_id}")
        return project

    async def get_project(self, project_id: str, user_id: str) -> Optional[Project]:
        """
        Get a project by ID.

        Args:
            project_id: The project ID
            user_id: The user ID (for security check)

        Returns:
            The Project object if found and user has access, None otherwise
        """
        doc = self.projects_collection.document(project_id).get()

        if not doc.exists:
            logger.warning(f"Project {project_id} not found")
            return None

        data = doc.to_dict()

        # Security check
        if data.get('user_id') != user_id:
            logger.warning(f"User {user_id} attempted to access project {project_id} owned by {data.get('user_id')}")
            return None

        # Convert datetime strings back to datetime objects
        for field in ['created_at', 'updated_at']:
            if field in data and isinstance(data[field], str):
                data[field] = datetime.fromisoformat(data[field])

        # Handle nested datetime fields
        if 'stats' in data and 'last_activity' in data['stats']:
            if isinstance(data['stats']['last_activity'], str):
                data['stats']['last_activity'] = datetime.fromisoformat(data['stats']['last_activity'])

        # Handle scene dates
        for scene in data.get('scenes', []):
            if 'active_job' in scene and scene['active_job'] is not None:
                for field in ['started_at', 'last_update']:
                    if field in scene['active_job'] and isinstance(scene['active_job'][field], str):
                        scene['active_job'][field] = datetime.fromisoformat(scene['active_job'][field])

            if 'assets' in scene and scene['assets'] is not None and 'generated_at' in scene['assets']:
                if isinstance(scene['assets']['generated_at'], str):
                    scene['assets']['generated_at'] = datetime.fromisoformat(scene['assets']['generated_at'])

            if 'composition' in scene and scene['composition'] is not None and 'generated_at' in scene['composition']:
                if isinstance(scene['composition']['generated_at'], str):
                    scene['composition']['generated_at'] = datetime.fromisoformat(scene['composition']['generated_at'])

        return Project(**data)

    async def update_project(
        self,
        project_id: str,
        user_id: str,
        request: UpdateProjectRequest
    ) -> Optional[Project]:
        """
        Update project metadata.

        Args:
            project_id: The project ID
            user_id: The user ID (for security check)
            request: Update request data

        Returns:
            Updated Project object if successful, None otherwise
        """
        # First get the project to verify ownership
        project = await self.get_project(project_id, user_id)
        if not project:
            return None

        # Build update dict
        updates = {
            'updated_at': datetime.now().isoformat(),
            'stats.last_activity': datetime.now().isoformat()
        }

        if request.name is not None:
            updates['name'] = request.name
        if request.description is not None:
            updates['description'] = request.description
        if request.storyboard is not None:
            updates['storyboard'] = request.storyboard.model_dump()

        # Update in Firestore
        self.projects_collection.document(project_id).update(updates)

        # Return updated project
        return await self.get_project(project_id, user_id)

    async def get_user_projects(self, user_id: str) -> List[Project]:
        """
        Get all projects for a user.

        Args:
            user_id: The user ID

        Returns:
            List of Project objects
        """
        # Query projects where user_id matches
        # Note: Removed order_by to avoid requiring Firestore composite index
        # Sorting is handled on the frontend instead
        query = self.projects_collection.where(
            filter=FieldFilter('user_id', '==', user_id)
        )

        projects = []
        for doc in query.stream():
            data = doc.to_dict()
            data['id'] = doc.id

            # Convert datetime strings
            for field in ['created_at', 'updated_at']:
                if field in data and isinstance(data[field], str):
                    data[field] = datetime.fromisoformat(data[field])

            if 'stats' in data and 'last_activity' in data['stats']:
                if isinstance(data['stats']['last_activity'], str):
                    data['stats']['last_activity'] = datetime.fromisoformat(data['stats']['last_activity'])

            projects.append(Project(**data))

        logger.info(f"Found {len(projects)} projects for user {user_id}")
        return projects

    async def add_scene(
        self,
        project_id: str,
        user_id: str,
        scene: Scene
    ) -> Optional[Project]:
        """
        Add a scene to a project.

        Args:
            project_id: The project ID
            user_id: The user ID (for security check)
            scene: The scene to add

        Returns:
            Updated Project object if successful, None otherwise
        """
        # Get the project
        project = await self.get_project(project_id, user_id)
        if not project:
            return None

        # Initialize scenes list if it doesn't exist
        if project.scenes is None:
            project.scenes = []

        # Add scene
        project.scenes.append(scene)

        # Update stats
        update_project_stats(project)

        # Convert to dict and update Firestore
        project_data = project.dict()
        self.projects_collection.document(project_id).set(project_data)

        logger.info(f"Added scene {scene.id} to project {project_id}")
        return project

    async def update_scene(
        self,
        project_id: str,
        scene_id: str,
        user_id: str,
        request: UpdateSceneRequest
    ) -> Optional[Project]:
        """
        Update a specific scene in a project.

        Args:
            project_id: The project ID
            scene_id: The scene ID to update
            user_id: The user ID (for security check)
            request: Scene update request

        Returns:
            Updated Project object if successful, None otherwise
        """
        # Get the project
        project = await self.get_project(project_id, user_id)
        if not project:
            return None

        # Initialize scenes list if it doesn't exist
        if project.scenes is None:
            project.scenes = []

        # Find and update the scene
        scene_found = False
        for scene in project.scenes:
            if scene.id == scene_id:
                if request.title is not None:
                    scene.title = request.title
                if request.description is not None:
                    scene.description = request.description
                if request.duration_seconds is not None:
                    scene.duration_seconds = request.duration_seconds
                scene_found = True
                break

        if not scene_found:
            logger.warning(f"Scene {scene_id} not found in project {project_id}")
            return None

        # Update project timestamp
        project.updated_at = datetime.now()
        update_project_stats(project)

        # Save to Firestore
        project_data = project.dict()
        self.projects_collection.document(project_id).set(project_data)

        logger.info(f"Updated scene {scene_id} in project {project_id}")
        return project

    async def update_scene_job(
        self,
        project_id: str,
        scene_id: str,
        job: ActiveJob
    ) -> bool:
        """
        Update the active job for a scene.

        Args:
            project_id: The project ID
            scene_id: The scene ID
            job: The job information to update

        Returns:
            True if successful, False otherwise
        """
        # Get the project document
        doc_ref = self.projects_collection.document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            logger.error(f"Project {project_id} not found")
            return False

        data = doc.to_dict()
        scenes = data.get('scenes', [])

        # Find and update the scene
        scene_found = False
        for scene in scenes:
            if scene['id'] == scene_id:
                scene['active_job'] = job.dict()
                scene_found = True
                break

        if not scene_found:
            logger.error(f"Scene {scene_id} not found in project {project_id}")
            return False

        # Update the document
        doc_ref.update({
            'scenes': scenes,
            'updated_at': datetime.now().isoformat(),
            'stats.last_activity': datetime.now().isoformat()
        })

        logger.info(f"Updated job for scene {scene_id} in project {project_id}")
        return True

    async def update_scene_assets(
        self,
        project_id: str,
        scene_id: str,
        assets: SceneAssets
    ) -> bool:
        """
        Update the assets for a scene.

        Args:
            project_id: The project ID
            scene_id: The scene ID
            assets: The assets information to update

        Returns:
            True if successful, False otherwise
        """
        # Get the project document
        doc_ref = self.projects_collection.document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            logger.error(f"Project {project_id} not found")
            return False

        data = doc.to_dict()
        scenes = data.get('scenes', [])

        # Find and update the scene
        scene_found = False
        for scene in scenes:
            if scene['id'] == scene_id:
                scene['assets'] = assets.dict()
                scene_found = True
                break

        if not scene_found:
            logger.error(f"Scene {scene_id} not found in project {project_id}")
            return False

        # Count completed scenes
        completed_scenes = sum(
            1 for s in scenes
            if s.get('assets', {}).get('video_path') and s.get('assets', {}).get('composition_path')
        )

        # Update the document
        doc_ref.update({
            'scenes': scenes,
            'updated_at': datetime.now().isoformat(),
            'stats.completed_scenes': completed_scenes,
            'stats.last_activity': datetime.now().isoformat()
        })

        logger.info(f"Updated assets for scene {scene_id} in project {project_id}")
        return True

    async def delete_project(
        self,
        project_id: str,
        user_id: str
    ) -> bool:
        """
        Delete a project.

        Args:
            project_id: The project ID
            user_id: The user ID (for security check)

        Returns:
            True if successful, False otherwise
        """
        # Verify ownership first
        project = await self.get_project(project_id, user_id)
        if not project:
            return False

        # Delete the document
        self.projects_collection.document(project_id).delete()

        logger.info(f"Deleted project {project_id}")
        return True


# Create a singleton instance - lazy initialization
_firestore_service = None


def get_firestore_service() -> FirestoreService:
    """Get or create the Firestore service singleton."""
    global _firestore_service
    if _firestore_service is None:
        _firestore_service = FirestoreService()
    return _firestore_service