"""
ImgBB Image Upload Service

Uploads images to ImgBB and returns public URLs.
"""
import requests
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ImgBBService:
    """Service for uploading images to ImgBB."""
    
    UPLOAD_URL = "https://api.imgbb.com/1/upload"
    
    def __init__(self, api_key: str):
        """
        Initialize ImgBB service.
        
        Args:
            api_key: API key from https://api.imgbb.com/ (free, quick signup)
        """
        if not api_key:
            raise ValueError("ImgBB API key is required. Get it free from https://api.imgbb.com/")
        self.api_key = api_key
    
    def upload_image(self, image_path: Path, expiration: Optional[int] = None) -> Optional[str]:
        """
        Upload an image to ImgBB and return the public URL.
        
        Args:
            image_path: Path to the image file to upload
            expiration: Optional expiration time in seconds (max 15552000 = 180 days)
            
        Returns:
            Public URL to the uploaded image, or None if upload failed
        """
        if not image_path.exists():
            logger.error(f"Image file not found: {image_path}")
            return None
        
        try:
            with open(image_path, 'rb') as f:
                files = {'image': (image_path.name, f)}
                data = {'key': self.api_key}
                
                if expiration:
                    data['expiration'] = expiration
                
                print(f"[ImgBB] Uploading image to ImgBB: {image_path.name}")
                logger.info(f"Uploading image to ImgBB: {image_path.name}")
                response = requests.post(
                    self.UPLOAD_URL,
                    files=files,
                    data=data,
                    timeout=30
                )
                
                print(f"[ImgBB] Response status: {response.status_code}")
                if response.status_code == 200:
                    result = response.json()
                    print(f"[ImgBB] Response: {result}")
                    if result.get('success') and 'data' in result:
                        public_url = result['data']['url']
                        print(f"[ImgBB] ✓ Successfully uploaded! Public URL: {public_url}")
                        logger.info(f"Successfully uploaded to ImgBB: {public_url}")
                        return public_url
                    else:
                        print(f"[ImgBB] ❌ Upload failed: {result}")
                        logger.error(f"ImgBB upload failed: {result}")
                        return None
                else:
                    print(f"[ImgBB] ❌ Upload failed with status {response.status_code}: {response.text}")
                    logger.error(f"ImgBB upload failed with status {response.status_code}: {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error uploading to ImgBB: {e}", exc_info=True)
            return None


def get_imgbb_service() -> Optional[ImgBBService]:
    """Get ImgBB service instance. Returns None if API key not configured."""
    from app.config import settings
    api_key = getattr(settings, 'IMGBB_API_KEY', None)
    if not api_key:
        print(f"[ImgBB] ⚠️  IMGBB_API_KEY not configured. Public URL uploads will be skipped.")
        logger.warning("IMGBB_API_KEY not configured. Public URL uploads will be skipped.")
        return None
    print(f"[ImgBB] ✓ ImgBB service initialized with API key (length: {len(api_key)})")
    return ImgBBService(api_key=api_key)

