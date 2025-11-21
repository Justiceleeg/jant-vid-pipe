"""
Brand Asset Router

API endpoints for uploading and managing brand assets.
"""

from ..models.brand_models import BrandAssetUploadResponse
from ..models.asset_models import AssetStatus
from ..services.brand_service import get_brand_service
from .base_asset_router import create_asset_router

# Create router using the generic factory
router = create_asset_router(
    prefix="brand",
    tag="brand",
    service=get_brand_service(),
    response_class=BrandAssetUploadResponse,
    asset_type_name="brand"
)
