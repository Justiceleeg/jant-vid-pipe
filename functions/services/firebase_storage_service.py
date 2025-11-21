"""Firebase Storage Service for Cloud Functions.

Handles uploading generated content from Replicate to permanent Firebase Storage.
"""
import mimetypes
import json
from typing import Optional, Dict, Any
import requests
from firebase_admin import storage


class FirebaseStorageService:
    """Service for managing files in Firebase Storage."""

    def __init__(self):
        """Initialize Firebase Storage client."""
        self._bucket = None

    def _get_bucket(self):
        """Lazy initialization of Firebase Storage bucket."""
        if self._bucket is None:
            self._bucket = storage.bucket()
        return self._bucket

    def upload_from_url(
        self,
        url: str,
        path: str,
        content_type: Optional[str] = None,
        make_public: bool = True
    ) -> str:
        """
        Download a file from URL and upload to Firebase Storage.

        Args:
            url: Source URL (e.g., temporary Replicate URL)
            path: Destination path in Firebase Storage
            content_type: MIME type (auto-detected if not provided)
            make_public: Whether to make file publicly accessible

        Returns:
            Permanent Firebase Storage URL

        Raises:
            Exception: If download or upload fails
        """
        try:
            print(f"[Storage] Downloading from {url}")
            
            # Download file from URL
            response = requests.get(url, timeout=120)  # 2 min timeout for large videos
            response.raise_for_status()
            
            print(f"[Storage] Downloaded {len(response.content)} bytes")

            # Auto-detect content type if not provided
            if not content_type:
                content_type = mimetypes.guess_type(path)[0] or 'application/octet-stream'

            # Get bucket and create blob reference
            bucket = self._get_bucket()
            blob = bucket.blob(path)

            # Upload file
            blob.upload_from_string(
                response.content,
                content_type=content_type
            )

            if make_public:
                # Make publicly accessible
                blob.make_public()
                storage_url = blob.public_url
            else:
                # Use blob's media link for authenticated access
                storage_url = blob.media_link

            print(f"[Storage] Uploaded to {path}")
            print(f"[Storage] Public URL: {storage_url}")
            
            return storage_url

        except requests.RequestException as e:
            print(f"[Storage] Error downloading from {url}: {e}")
            raise Exception(f"Failed to download file: {str(e)}")
        except Exception as e:
            print(f"[Storage] Error uploading to {path}: {e}")
            raise Exception(f"Failed to upload to Storage: {str(e)}")

    def upload_json(
        self,
        data: Dict[str, Any],
        path: str,
        make_public: bool = False
    ) -> str:
        """
        Upload JSON data to Firebase Storage.

        Args:
            data: Dictionary to upload as JSON
            path: Destination path in Firebase Storage
            make_public: Whether to make file publicly accessible

        Returns:
            Firebase Storage URL

        Raises:
            Exception: If upload fails
        """
        try:
            bucket = self._get_bucket()
            blob = bucket.blob(path)

            # Upload JSON data
            json_str = json.dumps(data, indent=2)
            blob.upload_from_string(
                json_str,
                content_type='application/json'
            )

            if make_public:
                blob.make_public()
                return blob.public_url

            # Return signed URL for private access
            from datetime import timedelta
            storage_url = blob.generate_signed_url(
                expiration=timedelta(days=7),
                method='GET'
            )

            print(f"[Storage] JSON uploaded to {path}")
            return storage_url

        except Exception as e:
            print(f"[Storage] Error uploading JSON to {path}: {e}")
            raise Exception(f"Failed to upload JSON to Storage: {str(e)}")


# Singleton instance
_storage_service: Optional[FirebaseStorageService] = None


def get_storage_service() -> FirebaseStorageService:
    """Get or create Firebase Storage service singleton."""
    global _storage_service
    if _storage_service is None:
        _storage_service = FirebaseStorageService()
    return _storage_service

