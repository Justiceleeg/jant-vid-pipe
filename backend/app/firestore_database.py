"""Firestore database implementation.

This provides access to Firestore collections.
"""
from typing import Dict, List, Optional
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class FirestoreDatabase:
    """Firestore database for generic collection access."""

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

    def collection(self, collection_name: str):
        """
        Access a Firestore collection directly.
        
        This method delegates to the underlying Firestore client for all collections.
        
        Args:
            collection_name: Name of the collection
            
        Returns:
            Firestore collection reference
        """
        return self.db.collection(collection_name)


# Global database instance
db = FirestoreDatabase()