"""
Shared Pydantic Models for Asset Upload
"""

from pydantic import BaseModel, Field
from typing import Literal, Dict, Any

class ImageDimensions(BaseModel):
    """Image dimensions."""
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")

class AssetUploadResponse(BaseModel):
    """Generic response from asset upload."""
    asset_id: str = Field(..., description="UUID for asset")
    filename: str = Field(..., description="Original filename")
    url: str = Field(..., description="Accessible URL to asset image")
    thumbnail_url: str = Field(..., description="URL to 512x512 thumbnail")
    size: int = Field(..., description="File size in bytes")
    dimensions: ImageDimensions = Field(..., description="Image dimensions")
    format: str = Field(..., description="png or jpg")
    has_alpha: bool = Field(..., description="Whether image has alpha channel")
    uploaded_at: str = Field(..., description="ISO timestamp")

class AssetStatus(BaseModel):
    """Generic status of uploaded asset."""
    asset_id: str
    status: Literal["active", "deleted"]
    url: str
    thumbnail_url: str
    dimensions: ImageDimensions
    format: str
    has_alpha: bool
    metadata: Dict[str, Any]


