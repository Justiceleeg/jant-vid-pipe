"""
Brand Asset Service

Handles brand asset upload, validation, storage, and thumbnail generation.
"""

from pathlib import Path
from typing import Optional

from ..models.brand_models import BrandAssetUploadResponse, BrandAssetStatus
from .base_asset_service import BaseAssetService


class BrandAssetService(BaseAssetService[BrandAssetUploadResponse, BrandAssetStatus]):
    """Service for managing brand assets."""
    
    def __init__(self, upload_dir: Path = Path("uploads/brands")):
        super().__init__(
            upload_dir=upload_dir,
            api_prefix="brand",
            response_class=BrandAssetUploadResponse,
            status_class=BrandAssetStatus
        )
    
    # Alias methods for backward compatibility
    def validate_brand_image(self, file_data: bytes, filename: str):
        """Alias for validate_image."""
        return self.validate_image(file_data, filename)
    
    def save_brand_asset(self, file_data: bytes, filename: str) -> BrandAssetUploadResponse:
        """Alias for save_asset."""
        return self.save_asset(file_data, filename)
    
    def get_brand_asset(self, asset_id: str) -> Optional[BrandAssetStatus]:
        """Alias for get_asset."""
        return self.get_asset(asset_id)
    
    def list_brand_assets(self) -> list[BrandAssetStatus]:
        """Alias for list_assets."""
        return self.list_assets()
    
    def delete_brand_asset(self, asset_id: str) -> bool:
        """Alias for delete_asset."""
        return self.delete_asset(asset_id)
    
    def get_brand_asset_path(self, asset_id: str, thumbnail: bool = False):
        """Alias for get_asset_path."""
        return self.get_asset_path(asset_id, thumbnail)


# Singleton instance
_brand_service: Optional[BrandAssetService] = None

def get_brand_service() -> BrandAssetService:
    """Get or create brand service singleton."""
    global _brand_service
    if _brand_service is None:
        _brand_service = BrandAssetService()
    return _brand_service
