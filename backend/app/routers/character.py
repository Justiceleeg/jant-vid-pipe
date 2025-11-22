"""
Character Asset Router

API endpoints for uploading and managing character assets.
"""

from ..models.character_models import CharacterAssetUploadResponse
from ..models.asset_models import AssetStatus
from ..services.character_service import get_character_service
from .base_asset_router import create_asset_router

# Create router using the generic factory
router = create_asset_router(
    prefix="character",
    tag="character",
    service=get_character_service(),
    response_class=CharacterAssetUploadResponse,
    asset_type_name="character"
)
