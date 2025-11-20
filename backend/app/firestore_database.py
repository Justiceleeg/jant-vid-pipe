"""Firestore database implementation for storyboards and scenes.

This replaces the in-memory database with persistent Firestore storage.
"""
from typing import Dict, List, Optional
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from app.models.storyboard_models import Storyboard, StoryboardScene
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class FirestoreDatabase:
    """Firestore database for storyboards and scenes."""

    def __init__(self):
        """Initialize Firestore client."""
        self._initialized = False
        self.db = None
        self._initialize()

    def _initialize(self):
        """Initialize Firebase Admin SDK."""
        if self._initialized:
            return

        try:
            # Check if Firebase is already initialized
            try:
                firebase_admin.get_app()
                logger.info("Firebase already initialized")
            except ValueError:
                # Initialize Firebase Admin SDK
                if settings.has_firebase_credentials():
                    cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
                    firebase_admin.initialize_app(cred, {
                        'projectId': settings.FIREBASE_PROJECT_ID,
                        'storageBucket': f"{settings.FIREBASE_PROJECT_ID}.firebasestorage.app"
                    })
                    logger.info(f"Firebase initialized with project: {settings.FIREBASE_PROJECT_ID}")
                else:
                    # For local development without credentials, use emulator
                    logger.warning("No Firebase credentials found. Using default initialization.")
                    firebase_admin.initialize_app()

            self.db = firestore.client()
            self._initialized = True
            logger.info("Firestore client initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Firestore: {e}")
            raise

    # Generic collection access for non-storyboard collections
    def collection(self, collection_name: str):
        """
        Access a Firestore collection directly.
        
        This method delegates to the underlying Firestore client for collections
        that don't have dedicated methods (e.g., video_jobs, composition_jobs, products).
        
        Args:
            collection_name: Name of the collection
            
        Returns:
            Firestore collection reference
        """
        return self.db.collection(collection_name)

    # Storyboard operations

    def create_storyboard(self, storyboard: Storyboard) -> Storyboard:
        """Create a new storyboard."""
        try:
            doc_ref = self.db.collection('storyboards').document(storyboard.storyboard_id)
            doc_ref.set(storyboard.model_dump())
            logger.info(f"Created storyboard: {storyboard.storyboard_id}")
            return storyboard
        except Exception as e:
            logger.error(f"Error creating storyboard: {e}")
            raise

    def get_storyboard(self, storyboard_id: str) -> Optional[Storyboard]:
        """Get a storyboard by ID."""
        try:
            doc_ref = self.db.collection('storyboards').document(storyboard_id)
            doc = doc_ref.get()
            
            if doc.exists:
                return Storyboard.model_validate(doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Error getting storyboard {storyboard_id}: {e}")
            raise

    def update_storyboard(self, storyboard_id: str, storyboard: Storyboard) -> Optional[Storyboard]:
        """Update a storyboard."""
        try:
            doc_ref = self.db.collection('storyboards').document(storyboard_id)
            
            # Check if exists
            if not doc_ref.get().exists:
                return None
            
            # Update timestamp
            storyboard.updated_at = datetime.utcnow()
            doc_ref.set(storyboard.model_dump())
            
            logger.info(f"Updated storyboard: {storyboard_id}")
            return storyboard
        except Exception as e:
            logger.error(f"Error updating storyboard {storyboard_id}: {e}")
            raise

    def delete_storyboard(self, storyboard_id: str) -> bool:
        """Delete a storyboard and all its scenes."""
        try:
            # Delete all scenes first
            scenes_ref = self.db.collection('storyboards').document(storyboard_id).collection('scenes')
            scenes = scenes_ref.stream()
            
            for scene in scenes:
                scene.reference.delete()
            
            # Delete storyboard
            doc_ref = self.db.collection('storyboards').document(storyboard_id)
            if not doc_ref.get().exists:
                return False
            
            doc_ref.delete()
            logger.info(f"Deleted storyboard: {storyboard_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting storyboard {storyboard_id}: {e}")
            raise

    def get_storyboards_by_user(self, user_id: str) -> List[Storyboard]:
        """Get all storyboards for a user."""
        try:
            storyboards_ref = self.db.collection('storyboards')
            query = storyboards_ref.where(filter=FieldFilter('user_id', '==', user_id))
            docs = query.stream()
            
            storyboards = []
            for doc in docs:
                storyboards.append(Storyboard.model_validate(doc.to_dict()))
            
            return storyboards
        except Exception as e:
            logger.error(f"Error getting storyboards for user {user_id}: {e}")
            raise

    # Scene operations

    def create_scene(self, scene: StoryboardScene) -> StoryboardScene:
        """Create a new scene."""
        try:
            # Scenes are stored as subcollection under storyboard
            doc_ref = (self.db.collection('storyboards')
                      .document(scene.storyboard_id)
                      .collection('scenes')
                      .document(scene.id))
            
            doc_ref.set(scene.model_dump())
            logger.info(f"Created scene: {scene.id} in storyboard: {scene.storyboard_id}")
            return scene
        except Exception as e:
            logger.error(f"Error creating scene: {e}")
            raise

    def get_scene(self, scene_id: str) -> Optional[StoryboardScene]:
        """Get a scene by ID.
        
        Note: This requires searching across all storyboards since we don't have
        the storyboard_id. For better performance, use get_scene_by_storyboard.
        """
        try:
            # Search across all storyboards
            storyboards_ref = self.db.collection('storyboards')
            storyboards = storyboards_ref.stream()
            
            for storyboard in storyboards:
                scene_ref = storyboard.reference.collection('scenes').document(scene_id)
                scene_doc = scene_ref.get()
                
                if scene_doc.exists:
                    return StoryboardScene.model_validate(scene_doc.to_dict())
            
            return None
        except Exception as e:
            logger.error(f"Error getting scene {scene_id}: {e}")
            raise

    def get_scene_by_storyboard(self, storyboard_id: str, scene_id: str) -> Optional[StoryboardScene]:
        """Get a scene by ID within a specific storyboard (more efficient)."""
        try:
            scene_ref = (self.db.collection('storyboards')
                        .document(storyboard_id)
                        .collection('scenes')
                        .document(scene_id))
            
            scene_doc = scene_ref.get()
            if scene_doc.exists:
                return StoryboardScene.model_validate(scene_doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Error getting scene {scene_id} from storyboard {storyboard_id}: {e}")
            raise

    def get_scenes_by_storyboard(self, storyboard_id: str) -> List[StoryboardScene]:
        """Get all scenes for a storyboard."""
        try:
            scenes_ref = (self.db.collection('storyboards')
                         .document(storyboard_id)
                         .collection('scenes'))
            
            docs = scenes_ref.stream()
            
            scenes = []
            for doc in docs:
                scenes.append(StoryboardScene.model_validate(doc.to_dict()))
            
            return scenes
        except Exception as e:
            logger.error(f"Error getting scenes for storyboard {storyboard_id}: {e}")
            raise

    def update_scene(self, scene_id: str, scene: StoryboardScene) -> Optional[StoryboardScene]:
        """Update a scene."""
        try:
            scene_ref = (self.db.collection('storyboards')
                        .document(scene.storyboard_id)
                        .collection('scenes')
                        .document(scene_id))
            
            if not scene_ref.get().exists:
                return None
            
            # Update timestamp
            scene.updated_at = datetime.utcnow()
            scene_ref.set(scene.model_dump())
            
            logger.info(f"Updated scene: {scene_id}")
            return scene
        except Exception as e:
            logger.error(f"Error updating scene {scene_id}: {e}")
            raise

    def delete_scene(self, scene_id: str) -> bool:
        """Delete a scene.
        
        Note: This requires searching across all storyboards.
        For better performance, use delete_scene_by_storyboard.
        """
        try:
            # Search across all storyboards
            storyboards_ref = self.db.collection('storyboards')
            storyboards = storyboards_ref.stream()
            
            for storyboard in storyboards:
                scene_ref = storyboard.reference.collection('scenes').document(scene_id)
                if scene_ref.get().exists:
                    scene_ref.delete()
                    logger.info(f"Deleted scene: {scene_id}")
                    return True
            
            return False
        except Exception as e:
            logger.error(f"Error deleting scene {scene_id}: {e}")
            raise

    def delete_scene_by_storyboard(self, storyboard_id: str, scene_id: str) -> bool:
        """Delete a scene from a specific storyboard (more efficient)."""
        try:
            scene_ref = (self.db.collection('storyboards')
                        .document(storyboard_id)
                        .collection('scenes')
                        .document(scene_id))
            
            if not scene_ref.get().exists:
                return False
            
            scene_ref.delete()
            logger.info(f"Deleted scene: {scene_id} from storyboard: {storyboard_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting scene {scene_id}: {e}")
            raise


# Global database instance
db = FirestoreDatabase()

