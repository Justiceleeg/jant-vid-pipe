"""In-memory database fallback (legacy, mostly unused).

This is a simple in-memory implementation for development.
The storyboard system has been removed - this is kept only as a fallback.
"""
from typing import Dict, List, Optional, Any
# from app.models.storyboard_models import Storyboard, StoryboardScene  # Removed - storyboard system deleted
from datetime import datetime


class InMemoryDatabase:
    """Simple in-memory database (legacy fallback)."""

    def __init__(self):
        """Initialize empty database."""
        self.storyboards: Dict[str, Any] = {}  # Changed from Storyboard type
        self.scenes: Dict[str, Any] = {}  # Changed from StoryboardScene type

    # Storyboard operations (legacy - no longer used)

    def create_storyboard(self, storyboard: Any) -> Any:
        """Create a new storyboard (legacy)."""
        if hasattr(storyboard, 'storyboard_id'):
            self.storyboards[storyboard.storyboard_id] = storyboard
        elif isinstance(storyboard, dict) and 'storyboard_id' in storyboard:
            self.storyboards[storyboard['storyboard_id']] = storyboard
        return storyboard

    def get_storyboard(self, storyboard_id: str) -> Optional[Any]:
        """Get a storyboard by ID (legacy)."""
        return self.storyboards.get(storyboard_id)

    def update_storyboard(self, storyboard_id: str, storyboard: Any) -> Optional[Any]:
        """Update a storyboard (legacy)."""
        if storyboard_id not in self.storyboards:
            return None
        if hasattr(storyboard, 'updated_at'):
            storyboard.updated_at = datetime.utcnow()
        elif isinstance(storyboard, dict):
            storyboard['updated_at'] = datetime.utcnow()
        self.storyboards[storyboard_id] = storyboard
        return storyboard

    def delete_storyboard(self, storyboard_id: str) -> bool:
        """Delete a storyboard and all its scenes (legacy)."""
        if storyboard_id not in self.storyboards:
            return False

        # Delete all scenes for this storyboard
        scene_ids_to_delete = []
        for scene_id, scene in self.scenes.items():
            if hasattr(scene, 'storyboard_id') and scene.storyboard_id == storyboard_id:
                scene_ids_to_delete.append(scene_id)
            elif isinstance(scene, dict) and scene.get('storyboard_id') == storyboard_id:
                scene_ids_to_delete.append(scene_id)
        
        for scene_id in scene_ids_to_delete:
            del self.scenes[scene_id]

        # Delete the storyboard
        del self.storyboards[storyboard_id]
        return True

    # Scene operations (legacy - no longer used)

    def create_scene(self, scene: Any) -> Any:
        """Create a new scene (legacy)."""
        scene_id = scene.id if hasattr(scene, 'id') else scene.get('id') if isinstance(scene, dict) else None
        if scene_id:
            self.scenes[scene_id] = scene
        return scene

    def get_scene(self, scene_id: str) -> Optional[Any]:
        """Get a scene by ID (legacy)."""
        return self.scenes.get(scene_id)

    def get_scenes_by_storyboard(self, storyboard_id: str) -> List[Any]:
        """Get all scenes for a storyboard (legacy)."""
        scenes = []
        for scene in self.scenes.values():
            if hasattr(scene, 'storyboard_id') and scene.storyboard_id == storyboard_id:
                scenes.append(scene)
            elif isinstance(scene, dict) and scene.get('storyboard_id') == storyboard_id:
                scenes.append(scene)
        return scenes

    def update_scene(self, scene_id: str, scene: Any) -> Optional[Any]:
        """Update a scene (legacy)."""
        if scene_id not in self.scenes:
            return None
        if hasattr(scene, 'updated_at'):
            scene.updated_at = datetime.utcnow()
        elif isinstance(scene, dict):
            scene['updated_at'] = datetime.utcnow()
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
