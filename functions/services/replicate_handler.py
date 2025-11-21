"""Replicate API handler for Cloud Functions."""
import os
import replicate
from typing import Optional
from services.firebase_storage_service import get_storage_service


class ReplicateHandler:
    """Handler for Replicate API calls."""

    def __init__(self):
        """Initialize Replicate client."""
        self.client = None
        self.storage_service = get_storage_service()
    
    def _get_client(self):
        """Lazy initialization of Replicate client."""
        if self.client is None:
            api_token = os.getenv('REPLICATE_API_TOKEN')
            if not api_token:
                raise ValueError("REPLICATE_API_TOKEN environment variable not set")
            self.client = replicate.Client(api_token=api_token)
        return self.client

    def generate_image(
        self,
        prompt: str,
        style_prompt: str,
        storyboard_id: str,
        scene_id: str,
        width: int = 1080,
        height: int = 1920
    ) -> Optional[str]:
        """
        Generate image using Replicate Flux model and save to Firebase Storage.

        Returns: Permanent Firebase Storage URL
        """
        full_prompt = f"{prompt}. Style: {style_prompt}"
        
        print(f"[Replicate] Generating image for scene {scene_id}")
        
        output = self._get_client().run(
            "black-forest-labs/flux-1.1-pro",
            input={
                "prompt": full_prompt,
                "width": width,
                "height": height,
                "output_format": "png"
            }
        )
        
        # Extract temporary URL from output
        temp_url = None
        if output:
            if isinstance(output, list):
                temp_url = str(output[0]) if output else None
            else:
                temp_url = str(output)
        
        if not temp_url:
            return None
        
        print(f"[Replicate] Got temporary URL: {temp_url}")
        
        # Upload to Firebase Storage for permanent storage
        storage_path = f"generations/storyboards/{storyboard_id}/scenes/{scene_id}/image.png"
        storage_url = self.storage_service.upload_from_url(
            url=temp_url,
            path=storage_path,
            content_type="image/png"
        )
        
        return storage_url

    def generate_video(
        self,
        image_url: str,
        prompt: str,
        storyboard_id: str,
        scene_id: str,
        duration: float = 5.0
    ) -> Optional[str]:
        """
        Generate video from image using Replicate SeeDance model and save to Firebase Storage.

        Returns: Permanent Firebase Storage URL
        """
        print(f"[Replicate] Generating video for scene {scene_id}")
        
        output = self._get_client().run(
            "bytedance/seedance-1-pro-fast",
            input={
                "image": image_url,
                "prompt": prompt,
                "duration": duration
            }
        )
        
        # Extract temporary URL from output
        temp_url = None
        if output:
            if isinstance(output, list):
                temp_url = str(output[0]) if output else None
            else:
                temp_url = str(output)
        
        if not temp_url:
            return None
        
        print(f"[Replicate] Got temporary URL: {temp_url}")
        
        # Upload to Firebase Storage for permanent storage
        storage_path = f"generations/storyboards/{storyboard_id}/scenes/{scene_id}/video.mp4"
        storage_url = self.storage_service.upload_from_url(
            url=temp_url,
            path=storage_path,
            content_type="video/mp4"
        )
        
        return storage_url

    def generate_image_with_product(
        self,
        prompt: str,
        style_prompt: str,
        product_image_url: str,
        storyboard_id: str,
        scene_id: str,
        width: int = 1080,
        height: int = 1920
    ) -> Optional[str]:
        """
        Generate image with product compositing and save to Firebase Storage.
        
        NOTE: This is a simplified version. The full implementation in
        backend/app/services/replicate_service.py handles PIL compositing
        and Kontext methods. For Cloud Functions, we'll use a simpler approach.
        
        Returns: Permanent Firebase Storage URL
        """
        # For now, just generate the scene and return
        # TODO: Implement product compositing logic here or in a separate service
        full_prompt = f"{prompt}. Style: {style_prompt}. Include product placement."
        
        print(f"[Replicate] Generating image with product for scene {scene_id}")
        
        output = self._get_client().run(
            "black-forest-labs/flux-1.1-pro",
            input={
                "prompt": full_prompt,
                "width": width,
                "height": height,
                "output_format": "png"
            }
        )
        
        # Extract temporary URL from output
        temp_url = None
        if output:
            if isinstance(output, list):
                temp_url = str(output[0]) if output else None
            else:
                temp_url = str(output)
        
        if not temp_url:
            return None
        
        print(f"[Replicate] Got temporary URL: {temp_url}")
        
        # Upload to Firebase Storage for permanent storage
        storage_path = f"generations/storyboards/{storyboard_id}/scenes/{scene_id}/image.png"
        storage_url = self.storage_service.upload_from_url(
            url=temp_url,
            path=storage_path,
            content_type="image/png"
        )
        
        return storage_url

