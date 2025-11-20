"""Firebase Storage Service for file uploads and management.

Handles uploading files to Firebase Storage and generating public/signed URLs.
"""
import logging
import uuid
import mimetypes
from pathlib import Path
from typing import Optional, BinaryIO
from datetime import timedelta
import firebase_admin
from firebase_admin import storage
from app.config import settings

logger = logging.getLogger(__name__)


class FirebaseStorageService:
    """Service for managing files in Firebase Storage."""

    def __init__(self):
        """Initialize Firebase Storage client."""
        self._bucket = None
        self._initialize()

    def _initialize(self):
        """Initialize Firebase Storage bucket."""
        try:
            # Get default bucket (Firebase will use the correct bucket name automatically)
            # Newer projects use .firebasestorage.app, older ones use .appspot.com
            self._bucket = storage.bucket()
            logger.info(f"Firebase Storage initialized for project: {settings.FIREBASE_PROJECT_ID}")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Storage: {e}")
            raise

    def upload_file(
        self,
        file_data: bytes,
        path: str,
        content_type: Optional[str] = None,
        make_public: bool = True
    ) -> str:
        """
        Upload a file to Firebase Storage.

        Args:
            file_data: File content as bytes
            path: Storage path (e.g., "products/uuid/original.png")
            content_type: MIME type (auto-detected if not provided)
            make_public: Whether to make file publicly accessible

        Returns:
            Public URL to the uploaded file

        Raises:
            Exception: If upload fails
        """
        try:
            # Auto-detect content type if not provided
            if not content_type:
                content_type = mimetypes.guess_type(path)[0] or 'application/octet-stream'

            # Create blob reference
            blob = self._bucket.blob(path)

            # Upload file
            blob.upload_from_string(
                file_data,
                content_type=content_type
            )

            if make_public:
                # Make publicly accessible
                blob.make_public()
                url = blob.public_url
            else:
                # Generate signed URL (valid for 1 hour)
                url = blob.generate_signed_url(
                    expiration=timedelta(hours=1),
                    version="v4"
                )

            logger.info(f"Uploaded file to Firebase Storage: {path}")
            return url

        except Exception as e:
            logger.error(f"Error uploading file to Firebase Storage: {e}")
            raise

    def upload_from_url(
        self,
        url: str,
        path: str,
        content_type: Optional[str] = None,
        make_public: bool = True
    ) -> str:
        """
        Download a file from URL and upload to Firebase Storage.

        Useful for saving Replicate-generated images/videos.

        Args:
            url: Source URL to download from
            path: Destination path in Firebase Storage
            content_type: MIME type
            make_public: Whether to make file publicly accessible

        Returns:
            Public URL to the uploaded file
        """
        try:
            import requests

            # Download file
            response = requests.get(url, timeout=60)
            response.raise_for_status()

            # Upload to Firebase Storage
            return self.upload_file(
                file_data=response.content,
                path=path,
                content_type=content_type,
                make_public=make_public
            )

        except Exception as e:
            logger.error(f"Error uploading from URL {url}: {e}")
            raise

    def get_signed_url(
        self,
        path: str,
        expiration_minutes: int = 60
    ) -> str:
        """
        Generate a temporary signed URL for private files.

        Args:
            path: Path to file in Firebase Storage
            expiration_minutes: URL validity in minutes

        Returns:
            Signed URL
        """
        try:
            blob = self._bucket.blob(path)
            url = blob.generate_signed_url(
                expiration=timedelta(minutes=expiration_minutes),
                version="v4"
            )
            return url

        except Exception as e:
            logger.error(f"Error generating signed URL for {path}: {e}")
            raise

    def delete_file(self, path: str) -> bool:
        """
        Delete a file from Firebase Storage.

        Args:
            path: Path to file

        Returns:
            True if deleted, False if not found
        """
        try:
            blob = self._bucket.blob(path)

            if not blob.exists():
                logger.warning(f"File not found in Firebase Storage: {path}")
                return False

            blob.delete()
            logger.info(f"Deleted file from Firebase Storage: {path}")
            return True

        except Exception as e:
            logger.error(f"Error deleting file {path}: {e}")
            raise

    def file_exists(self, path: str) -> bool:
        """
        Check if a file exists in Firebase Storage.

        Args:
            path: Path to file

        Returns:
            True if exists, False otherwise
        """
        try:
            blob = self._bucket.blob(path)
            return blob.exists()
        except Exception as e:
            logger.error(f"Error checking file existence {path}: {e}")
            return False

    # Convenience methods for common upload patterns

    def upload_product_image(
        self,
        file_data: bytes,
        product_id: str,
        filename: str
    ) -> str:
        """
        Upload a product image.

        Args:
            file_data: Image bytes
            product_id: Product UUID
            filename: Original filename (for extension)

        Returns:
            Public URL
        """
        # Extract extension
        ext = Path(filename).suffix.lower()
        if not ext:
            ext = '.png'

        # Generate path
        path = f"products/{product_id}/original{ext}"

        # Determine content type
        content_type = 'image/png' if ext == '.png' else 'image/jpeg'

        return self.upload_file(file_data, path, content_type, make_public=True)

    def upload_product_thumbnail(
        self,
        file_data: bytes,
        product_id: str
    ) -> str:
        """
        Upload a product thumbnail (always PNG).

        Args:
            file_data: Thumbnail bytes
            product_id: Product UUID

        Returns:
            Public URL
        """
        path = f"products/{product_id}/thumbnail.png"
        return self.upload_file(file_data, path, 'image/png', make_public=True)

    def upload_scene_image(
        self,
        file_data: bytes,
        storyboard_id: str,
        scene_id: str,
        version: Optional[int] = None
    ) -> str:
        """
        Upload a scene image.

        Args:
            file_data: Image bytes
            storyboard_id: Storyboard UUID
            scene_id: Scene UUID
            version: Optional version number for regeneration tracking

        Returns:
            Public URL
        """
        version_suffix = f"_v{version}" if version else ""
        path = f"storyboards/{storyboard_id}/scenes/{scene_id}/image{version_suffix}.png"
        return self.upload_file(file_data, path, 'image/png', make_public=True)

    def upload_scene_video(
        self,
        file_data: bytes,
        storyboard_id: str,
        scene_id: str,
        version: Optional[int] = None
    ) -> str:
        """
        Upload a scene video.

        Args:
            file_data: Video bytes
            storyboard_id: Storyboard UUID
            scene_id: Scene UUID
            version: Optional version number

        Returns:
            Public URL
        """
        version_suffix = f"_v{version}" if version else ""
        path = f"storyboards/{storyboard_id}/scenes/{scene_id}/video{version_suffix}.mp4"
        return self.upload_file(file_data, path, 'video/mp4', make_public=True)

    def upload_final_composite(
        self,
        file_data: bytes,
        storyboard_id: str
    ) -> str:
        """
        Upload final composite video.

        Args:
            file_data: Video bytes
            storyboard_id: Storyboard UUID

        Returns:
            Public URL
        """
        path = f"storyboards/{storyboard_id}/final/composite.mp4"
        return self.upload_file(file_data, path, 'video/mp4', make_public=True)

    def save_replicate_asset(
        self,
        replicate_url: str,
        storyboard_id: str,
        scene_id: str,
        asset_type: str = "image"
    ) -> str:
        """
        Download asset from Replicate and save to Firebase Storage.

        Args:
            replicate_url: Temporary Replicate URL
            storyboard_id: Storyboard UUID
            scene_id: Scene UUID
            asset_type: "image" or "video"

        Returns:
            Permanent Firebase Storage URL
        """
        ext = ".png" if asset_type == "image" else ".mp4"
        content_type = "image/png" if asset_type == "image" else "video/mp4"

        path = f"storyboards/{storyboard_id}/scenes/{scene_id}/{asset_type}{ext}"

        return self.upload_from_url(
            url=replicate_url,
            path=path,
            content_type=content_type,
            make_public=True
        )


# Global service instance
_storage_service: Optional[FirebaseStorageService] = None


def get_storage_service() -> FirebaseStorageService:
    """Get or create Firebase Storage service singleton."""
    global _storage_service
    if _storage_service is None:
        _storage_service = FirebaseStorageService()
    return _storage_service

