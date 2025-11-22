"""
Product Upload Router

API endpoints for uploading product photos for NeRF processing.

NOTE: NeRF functionality is currently DISABLED for Cloud Run deployment.
The upload endpoint will return 501 Not Implemented.
"""

import logging
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, status
from fastapi.responses import JSONResponse
from typing import List, Optional

from ..models.nerf_models import UploadResponse, UploadStatusResponse
from ..utils.image_validation import get_supported_extensions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["upload"])

# NeRF/Upload functionality is disabled for Cloud Run deployment
UPLOAD_DISABLED_MESSAGE = "NeRF upload functionality is currently disabled for this deployment"


@router.post("/photos", response_model=UploadResponse)
async def upload_photos(
    files: List[UploadFile] = File(..., description="Product photos to upload"),
    auto_start_nerf: bool = Form(False, description="Auto-start NeRF processing after upload"),
    strict_validation: bool = Form(False, description="Treat warnings as errors"),
):
    """NeRF upload functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=UPLOAD_DISABLED_MESSAGE
    )


@router.get("/status/{job_id}", response_model=UploadStatusResponse)
async def get_upload_status(job_id: str):
    """NeRF upload functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=UPLOAD_DISABLED_MESSAGE
    )


@router.get("/info")
async def get_upload_info():
    """
    Get upload requirements and supported formats.
    
    **Returns:**
    - Supported file formats
    - Image count requirements
    - File size limits
    - Resolution requirements
    """
    return {
        "supported_formats": get_supported_extensions(),
        "image_count": {
            "minimum": 20,
            "recommended": 80,
            "maximum": 200,
        },
        "file_size": {
            "maximum_mb": 50,
        },
        "resolution": {
            "minimum_width": 512,
            "minimum_height": 512,
            "maximum_width": 8192,
            "maximum_height": 8192,
        },
        "recommendations": [
            "Take photos from diverse angles around the product",
            "Use consistent lighting",
            "Ensure product is clearly visible",
            "Avoid motion blur",
            "Use high-resolution images for best quality",
        ],
    }


@router.delete("/{job_id}")
async def delete_upload(job_id: str):
    """NeRF upload functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=UPLOAD_DISABLED_MESSAGE
    )

