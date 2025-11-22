"""
Pydantic Models for Brand Asset Upload
"""

from ..models.asset_models import AssetUploadResponse, AssetStatus

# Brand assets use the generic asset models
BrandAssetUploadResponse = AssetUploadResponse
BrandAssetStatus = AssetStatus

