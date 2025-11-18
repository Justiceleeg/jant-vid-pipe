"""In-memory database for storyboards and scenes.

This is a simple in-memory implementation for development.
In production, this should be replaced with PostgreSQL, SQLite, or another persistent database.
"""
from typing import Dict, List, Optional
from app.models.storyboard_models import Storyboard, StoryboardScene
from datetime import datetime


class InMemoryDatabase:
    """Simple in-memory database for storyboards and scenes."""

    def __init__(self):
        """Initialize empty database."""
        self.storyboards: Dict[str, Storyboard] = {}
        self.scenes: Dict[str, StoryboardScene] = {}

    # Storyboard operations

    def create_storyboard(self, storyboard: Storyboard) -> Storyboard:
        """Create a new storyboard."""
        self.storyboards[storyboard.storyboard_id] = storyboard
        return storyboard

    def get_storyboard(self, storyboard_id: str) -> Optional[Storyboard]:
        """Get a storyboard by ID."""
        return self.storyboards.get(storyboard_id)

    def update_storyboard(self, storyboard_id: str, storyboard: Storyboard) -> Optional[Storyboard]:
        """Update a storyboard."""
        if storyboard_id not in self.storyboards:
            return None
        storyboard.updated_at = datetime.utcnow()
        self.storyboards[storyboard_id] = storyboard
        return storyboard

    def delete_storyboard(self, storyboard_id: str) -> bool:
        """Delete a storyboard and all its scenes."""
        if storyboard_id not in self.storyboards:
            return False

        # Delete all scenes for this storyboard
        scene_ids_to_delete = [
            scene_id for scene_id, scene in self.scenes.items()
            if scene.storyboard_id == storyboard_id
        ]
        for scene_id in scene_ids_to_delete:
            del self.scenes[scene_id]

        # Delete the storyboard
        del self.storyboards[storyboard_id]
        return True

    # Scene operations

    def create_scene(self, scene: StoryboardScene) -> StoryboardScene:
        """Create a new scene."""
        self.scenes[scene.id] = scene
        return scene

    def get_scene(self, scene_id: str) -> Optional[StoryboardScene]:
        """Get a scene by ID."""
        return self.scenes.get(scene_id)

    def get_scenes_by_storyboard(self, storyboard_id: str) -> List[StoryboardScene]:
        """Get all scenes for a storyboard."""
        return [
            scene for scene in self.scenes.values()
            if scene.storyboard_id == storyboard_id
        ]

    def update_scene(self, scene_id: str, scene: StoryboardScene) -> Optional[StoryboardScene]:
        """Update a scene."""
        if scene_id not in self.scenes:
            return None
        scene.updated_at = datetime.utcnow()
        self.scenes[scene_id] = scene
        return scene

    def delete_scene(self, scene_id: str) -> bool:
        """Delete a scene."""
        if scene_id not in self.scenes:
            return False
        del self.scenes[scene_id]
        return True


# Global database instance
db = InMemoryDatabase()
