"""Firestore client for Cloud Functions."""
import firebase_admin
from firebase_admin import firestore
from typing import Optional


def _get_firestore_client():
    """Lazy initialization of Firestore client."""
    # Initialize Firebase Admin (only once)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app()
    
    # Return Firestore client
    return firestore.client()


class FirestoreClient:
    """Helper class for Firestore operations in Cloud Functions."""

    @staticmethod
    def get_scene(scene_id: str) -> Optional[dict]:
        """Get scene document by ID."""
        db = _get_firestore_client()
        doc = db.collection('scenes').document(scene_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None

    @staticmethod
    def update_scene(scene_id: str, updates: dict):
        """Update scene document."""
        db = _get_firestore_client()
        db.collection('scenes').document(scene_id).update(updates)

    @staticmethod
    def get_storyboard(storyboard_id: str) -> Optional[dict]:
        """Get storyboard document by ID."""
        db = _get_firestore_client()
        doc = db.collection('storyboards').document(storyboard_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['storyboard_id'] = doc.id
            return data
        return None

    @staticmethod
    def update_job(collection: str, job_id: str, updates: dict):
        """Update job document."""
        db = _get_firestore_client()
        db.collection(collection).document(job_id).update(updates)

    @staticmethod
    def get_job(collection: str, job_id: str) -> Optional[dict]:
        """Get job document."""
        db = _get_firestore_client()
        doc = db.collection(collection).document(job_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['job_id'] = doc.id
            return data
        return None

