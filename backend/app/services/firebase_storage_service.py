"""
Firebase Storage Service

Uploads images to Firebase Storage and returns public URLs.
"""
import logging
from typing import Optional
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)

# Global Firebase app instance
_firebase_app = None
_storage_bucket = None


def _initialize_firebase():
    """Initialize Firebase Admin SDK (only once)."""
    global _firebase_app, _storage_bucket
    
    if _firebase_app is not None:
        return True
    
    try:
        import firebase_admin
        from firebase_admin import credentials, storage
        from app.config import settings
        
        # Check if credentials file exists
        creds_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
        if not creds_path.exists():
            logger.warning(f"Firebase credentials file not found at {creds_path}")
            return False
        
        # Initialize Firebase Admin SDK
        cred = credentials.Certificate(str(creds_path))
        
        # Get bucket name from settings or credentials
        bucket_name = settings.FIREBASE_STORAGE_BUCKET
        if not bucket_name:
            # Try to get project_id from credentials and construct default bucket name
            import json
            with open(creds_path, 'r') as f:
                creds_data = json.load(f)
            project_id = creds_data.get('project_id', '')
            if project_id:
                # Try new format first (.firebasestorage.app), then fall back to old format (.appspot.com)
                # Newer Firebase projects use .firebasestorage.app
                bucket_name = f"{project_id}.firebasestorage.app"
        
        if not bucket_name:
            logger.error("Firebase storage bucket name could not be determined")
            return False

        # Initialize app with storage bucket (or use existing app)
        try:
            _firebase_app = firebase_admin.get_app()
            logger.info("Using existing Firebase app instance")
            # When using existing app, must specify bucket name explicitly
            _storage_bucket = storage.bucket(bucket_name)
        except ValueError:
            # App doesn't exist yet, initialize it
            _firebase_app = firebase_admin.initialize_app(cred, {
                'storageBucket': bucket_name
            })
            _storage_bucket = storage.bucket()
        
        logger.info(f"Firebase Storage initialized with bucket: {bucket_name}")
        print(f"[Firebase Storage] ✓ Initialized with bucket: {bucket_name}")
        return True
        
    except ImportError:
        logger.warning("firebase-admin package not installed. Run: pip install firebase-admin")
        print("[Firebase Storage] ⚠️  firebase-admin not installed")
        return False
    except Exception as e:
        logger.error(f"Error initializing Firebase: {e}", exc_info=True)
        print(f"[Firebase Storage] ❌ Initialization error: {e}")
        return False


class FirebaseStorageService:
    """Service for uploading images to Firebase Storage."""
    
    def __init__(self):
        """Initialize Firebase Storage service."""
        if not _initialize_firebase():
            raise ValueError("Firebase Storage could not be initialized")
    
    def upload_image(self, image_path: Path, folder: str = "assets") -> Optional[str]:
        """
        Upload an image to Firebase Storage and return the public URL.
        
        Args:
            image_path: Path to the image file to upload
            folder: Folder path in Firebase Storage (default: "assets")
            
        Returns:
            Public URL to the uploaded image, or None if upload failed
        """
        if not image_path.exists():
            logger.error(f"Image file not found: {image_path}")
            return None
        
        if _storage_bucket is None:
            logger.error("Firebase Storage not initialized")
            return None
        
        try:
            # Generate unique filename to avoid conflicts
            file_extension = image_path.suffix
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            blob_path = f"{folder}/{unique_filename}"
            
            print(f"[Firebase Storage] Uploading image to Firebase Storage: {image_path.name}")
            logger.info(f"Uploading image to Firebase Storage: {image_path.name} -> {blob_path}")
            
            # Upload file to Firebase Storage
            blob = _storage_bucket.blob(blob_path)
            blob.upload_from_filename(str(image_path))
            
            # Make the blob publicly accessible
            blob.make_public()
            
            # Get public URL
            public_url = blob.public_url
            
            print(f"[Firebase Storage] ✓ Successfully uploaded! Public URL: {public_url}")
            logger.info(f"Successfully uploaded to Firebase Storage: {public_url}")
            
            return public_url
            
        except Exception as e:
            logger.error(f"Error uploading to Firebase Storage: {e}", exc_info=True)
            print(f"[Firebase Storage] ❌ Upload error: {e}")
            return None


def get_firebase_storage_service() -> Optional[FirebaseStorageService]:
    """Get Firebase Storage service instance. Returns None if not configured."""
    try:
        if not _initialize_firebase():
            print("[Firebase Storage] ⚠️  Firebase Storage not configured. Public URL uploads will be skipped.")
            logger.warning("Firebase Storage not configured. Public URL uploads will be skipped.")
            return None
        
        return FirebaseStorageService()
    except Exception as e:
        logger.warning(f"Could not create Firebase Storage service: {e}")
        print(f"[Firebase Storage] ⚠️  Service creation failed: {e}")
        return None

