"""
Pydantic Models for Character Asset Upload
"""

from ..models.asset_models import AssetUploadResponse, AssetStatus

# Character assets use the generic asset models
CharacterAssetUploadResponse = AssetUploadResponse
CharacterAssetStatus = AssetStatus

