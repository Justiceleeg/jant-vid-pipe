"""
Character Asset Service

Handles character asset upload, validation, storage, and thumbnail generation.
"""

from pathlib import Path
from typing import Optional

from ..models.character_models import CharacterAssetUploadResponse, CharacterAssetStatus
from .base_asset_service import BaseAssetService


class CharacterAssetService(BaseAssetService[CharacterAssetUploadResponse, CharacterAssetStatus]):
    """Service for managing character assets."""
    
    def __init__(self, upload_dir: Path = Path("uploads/characters")):
        super().__init__(
            upload_dir=upload_dir,
            api_prefix="character",
            response_class=CharacterAssetUploadResponse,
            status_class=CharacterAssetStatus
        )
    
    # Alias methods for backward compatibility
    def validate_character_image(self, file_data: bytes, filename: str):
        """Alias for validate_image."""
        return self.validate_image(file_data, filename)
    
    def save_character_asset(self, file_data: bytes, filename: str) -> CharacterAssetUploadResponse:
        """Alias for save_asset."""
        return self.save_asset(file_data, filename)
    
    def get_character_asset(self, asset_id: str) -> Optional[CharacterAssetStatus]:
        """Alias for get_asset."""
        return self.get_asset(asset_id)
    
    def list_character_assets(self) -> list[CharacterAssetStatus]:
        """Alias for list_assets."""
        return self.list_assets()
    
    def delete_character_asset(self, asset_id: str) -> bool:
        """Alias for delete_asset."""
        return self.delete_asset(asset_id)
    
    def get_character_asset_path(self, asset_id: str, thumbnail: bool = False):
        """Alias for get_asset_path."""
        return self.get_asset_path(asset_id, thumbnail)


# Singleton instance
_character_service: Optional[CharacterAssetService] = None

def get_character_service() -> CharacterAssetService:
    """Get or create character service singleton."""
    global _character_service
    if _character_service is None:
        _character_service = CharacterAssetService()
    return _character_service
