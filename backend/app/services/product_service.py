"""
Product Image Service

Handles product image upload, validation, storage, and thumbnail generation.
Now uses Firebase Storage instead of local filesystem.
"""

import uuid
from typing import Optional, Tuple
from datetime import datetime
from PIL import Image
import io

from ..models.product_models import (
    ProductImageUploadResponse,
    ProductImageStatus,
    ImageDimensions
)
from ..services.firebase_storage_service import get_storage_service
from ..firestore_database import db


class ProductImageService:
    """Service for managing product images using Firebase Storage and Firestore."""
    
    def __init__(self):
        """Initialize product image service with Firebase."""
        self.storage_service = get_storage_service()
    
    def validate_product_image(self, file_data: bytes, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate image meets requirements.
        
        Validation Rules:
        - File size: 0 < size <= 50MB (52,428,800 bytes exactly)
        - Format: PNG or JPEG (check magic bytes, not extension)
        - Dimensions: 512 <= width, height <= 4096
        - Image mode: RGB, RGBA, or L (grayscale)
        - Must be openable by PIL
        
        Returns: (is_valid, error_message)
        """
        # Check file size (50MB max = 52,428,800 bytes)
        MAX_SIZE = 50 * 1024 * 1024
        if len(file_data) == 0:
            return False, "Empty file"
        if len(file_data) > MAX_SIZE:
            return False, f"File size must be under 50MB (got {len(file_data) / (1024*1024):.1f}MB)"
        
        # Check magic bytes for valid image format
        if len(file_data) < 4:
            return False, "File too small to be a valid image"
        
        # PNG magic bytes: \x89PNG
        is_png = file_data[:8] == b'\x89PNG\r\n\x1a\n'
        # JPEG magic bytes: \xFF\xD8 (third byte can vary: \xFF for JFIF, \xE0 for Exif, etc.)
        is_jpeg = len(file_data) >= 2 and file_data[:2] == b'\xff\xd8'
        
        if not (is_png or is_jpeg):
            return False, "Only PNG and JPG images are supported (invalid file format)"
        
        # Try to open with PIL
        try:
            img = Image.open(io.BytesIO(file_data))
            img.verify()  # Verify it's a valid image
            # Re-open after verify (verify closes the file)
            img = Image.open(io.BytesIO(file_data))
        except Exception as e:
            return False, f"Invalid image file: {str(e)}"
        
        # Check format matches magic bytes
        if img.format not in ['PNG', 'JPEG']:
            return False, f"Unsupported image format: {img.format}"
        
        # Check dimensions (min 512x512, max 4096x4096)
        width, height = img.size
        if width < 512 or height < 512:
            return False, f"Image must be at least 512×512 pixels (got {width}×{height})"
        if width > 4096 or height > 4096:
            return False, f"Image dimensions must not exceed 4096×4096 pixels (got {width}×{height})"
        
        # Check image mode (accept common modes, will convert if needed)
        # P = Palette mode (common in PNGs), will be converted to RGB/RGBA
        # Valid modes: RGB, RGBA, L (grayscale), P (palette), PA (palette with alpha)
        if img.mode not in ['RGB', 'RGBA', 'L', 'P', 'PA']:
            return False, f"Unsupported image mode: {img.mode}. Cannot process this image type"
        
        return True, None
    
    def generate_thumbnail(self, image: Image.Image, size: int = 512) -> Image.Image:
        """
        Generate square thumbnail with aspect ratio preservation.
        
        Specifications:
        - Exact size: 512×512 pixels
        - Resampling: LANCZOS (highest quality)
        - Maintains aspect ratio
        - Centers image in square canvas
        - Background: Transparent for RGBA, white for RGB
        
        Args:
            image: PIL Image
            size: Target size (default 512x512)
        
        Returns:
            Thumbnail image (512x512)
        """
        # Create thumbnail maintaining aspect ratio
        # thumbnail() modifies in place but preserves aspect ratio
        img = image.copy()
        img.thumbnail((size, size), Image.Resampling.LANCZOS)
        
        # Create square canvas with appropriate background
        if img.mode == 'RGBA':
            # Transparent background for RGBA
            thumb = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        else:
            # White background for RGB
            thumb = Image.new('RGB', (size, size), (255, 255, 255))
        
        # Calculate center position
        offset_x = (size - img.width) // 2
        offset_y = (size - img.height) // 2
        
        # Paste centered (use alpha channel if available)
        if img.mode == 'RGBA':
            thumb.paste(img, (offset_x, offset_y), img)
        else:
            thumb.paste(img, (offset_x, offset_y))
        
        return thumb
    
    async def save_product_image(
        self, 
        file_data: bytes, 
        filename: str,
        user_id: Optional[str] = None
    ) -> ProductImageUploadResponse:
        """
        Save product image with thumbnail generation to Firebase Storage.
        
        Steps:
        1. Validate image
        2. Generate UUID product_id
        3. Process image (convert formats if needed)
        4. Generate thumbnail
        5. Upload original to Firebase Storage
        6. Upload thumbnail to Firebase Storage
        7. Save metadata to Firestore
        8. Return response with Firebase Storage URLs
        """
        # Validate
        is_valid, error = self.validate_product_image(file_data, filename)
        if not is_valid:
            raise ValueError(error)
        
        # Load image
        img = Image.open(io.BytesIO(file_data))
        
        # Save original format before any conversions (PIL loses this after convert)
        original_format = img.format
        
        # Convert palette mode images to RGB/RGBA
        if img.mode == 'P':
            # Check if image has transparency
            if 'transparency' in img.info:
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
        elif img.mode == 'PA':
            img = img.convert('RGBA')
        elif img.mode == 'L':
            # Keep grayscale as-is, but convert to RGB for consistency
            img = img.convert('RGB')
        
        # Generate product_id
        product_id = str(uuid.uuid4())
        
        # Determine format and extension (use saved format)
        img_format = original_format.lower()
        if img_format == 'jpeg':
            img_format = 'jpg'
        ext = 'png' if img_format == 'png' else 'jpg'
        
        # Save original to bytes buffer
        original_buffer = io.BytesIO()
        if img_format == 'png':
            # Save PNG with full quality, preserve alpha
            img.save(original_buffer, 'PNG', optimize=False)
        else:
            # Convert RGBA to RGB for JPEG (JPEG doesn't support transparency)
            if img.mode == 'RGBA':
                # Create white background
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[3])  # Use alpha as mask
                img = rgb_img
            elif img.mode == 'L':
                img = img.convert('RGB')
            img.save(original_buffer, 'JPEG', quality=95, optimize=True)
        original_buffer.seek(0)
        
        # Generate and save thumbnail (always 512x512)
        thumb = self.generate_thumbnail(img, size=512)
        thumb_buffer = io.BytesIO()
        if img_format == 'png':
            # PNG thumbnails preserve transparency
            thumb.save(thumb_buffer, 'PNG', optimize=True)
        else:
            # JPEG thumbnails need RGB conversion
            if thumb.mode == 'RGBA':
                rgb_thumb = Image.new('RGB', thumb.size, (255, 255, 255))
                rgb_thumb.paste(thumb, mask=thumb.split()[3])
                thumb = rgb_thumb
            thumb.save(thumb_buffer, 'JPEG', quality=90, optimize=True)
        thumb_buffer.seek(0)
        
        # Upload to Firebase Storage
        original_url = self.storage_service.upload_product_image(
            file_data=original_buffer.read(),
            product_id=product_id,
            filename=filename
        )
        
        thumb_buffer.seek(0)
        thumbnail_url = self.storage_service.upload_product_thumbnail(
            file_data=thumb_buffer.read(),
            product_id=product_id
        )
        
        # Extract metadata
        width, height = img.size
        file_size = len(file_data)
        has_alpha = img.mode == 'RGBA'
        uploaded_at = datetime.utcnow().isoformat()
        
        # Save metadata to Firestore (synchronous operation)
        metadata = {
            "product_id": product_id,
            "user_id": user_id,
            "filename": filename,
            "format": img_format,  # "png" or "jpg"
            "dimensions": {"width": width, "height": height},
            "file_size": file_size,  # bytes
            "has_alpha": has_alpha,  # boolean
            "storage_urls": {
                "original": original_url,
                "thumbnail": thumbnail_url
            },
            "uploaded_at": uploaded_at  # ISO 8601 format
        }
        
        db.collection("products").document(product_id).set(metadata)
        
        # Return response with Firebase Storage URLs
        return ProductImageUploadResponse(
            product_id=product_id,
            filename=filename,
            url=original_url,  # Direct Firebase Storage URL
            thumbnail_url=thumbnail_url,  # Direct Firebase Storage URL
            size=file_size,
            dimensions=ImageDimensions(width=width, height=height),
            format=img_format,
            has_alpha=has_alpha,
            uploaded_at=uploaded_at
        )
    
    async def get_product_image(self, product_id: str) -> Optional[ProductImageStatus]:
        """Get product metadata and URLs from Firestore."""
        # Get product from Firestore (synchronous operation)
        product_ref = db.collection("products").document(product_id)
        product_doc = product_ref.get()
        
        if not product_doc.exists:
            return None
        
        metadata = product_doc.to_dict()
        storage_urls = metadata.get("storage_urls", {})
        
        return ProductImageStatus(
            product_id=product_id,
            status="active",
            url=storage_urls.get("original", ""),
            thumbnail_url=storage_urls.get("thumbnail", ""),
            dimensions=ImageDimensions(**metadata["dimensions"]),
            format=metadata["format"],
            has_alpha=metadata["has_alpha"],
            metadata=metadata
        )
    
    async def delete_product_image(self, product_id: str) -> bool:
        """Remove product from Firestore and Firebase Storage."""
        # Get product metadata from Firestore (synchronous operation)
        product_ref = db.collection("products").document(product_id)
        product_doc = product_ref.get()
        
        if not product_doc.exists:
            return False
        
        # Delete files from Firebase Storage (synchronous operations)
        try:
            self.storage_service.delete_file(f"products/{product_id}/original.png")
        except:
            pass  # File might not exist or be .jpg
        
        try:
            self.storage_service.delete_file(f"products/{product_id}/original.jpg")
        except:
            pass
        
        try:
            self.storage_service.delete_file(f"products/{product_id}/thumb.png")
        except:
            pass
        
        try:
            self.storage_service.delete_file(f"products/{product_id}/thumb.jpg")
        except:
            pass
        
        # Delete metadata from Firestore (synchronous operation)
        product_ref.delete()
        
        return True


# Singleton instance
_product_service: Optional[ProductImageService] = None

def get_product_service() -> ProductImageService:
    """Get or create product service singleton."""
    global _product_service
    if _product_service is None:
        _product_service = ProductImageService()
    return _product_service

