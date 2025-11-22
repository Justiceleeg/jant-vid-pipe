"""
NeRF Pipeline Router

This router handles all NeRF-related endpoints:
- COLMAP camera pose estimation
- NeRF training
- Frame rendering

NOTE: NeRF functionality is currently DISABLED for Cloud Run deployment.
All endpoints return 501 Not Implemented.
"""

from fastapi import APIRouter, HTTPException, status
import logging

from ..models.nerf_models import (
    COLMAPRequest,
    COLMAPResponse,
    COLMAPStatus,
    TrainingRequest,
    TrainingResponse,
    TrainingStatus,
    RenderRequest,
    RenderResponse,
    RenderStatus,
)


# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# NeRF is disabled for Cloud Run deployment
NERF_DISABLED_MESSAGE = "NeRF functionality is currently disabled for this deployment"


@router.post("/colmap", response_model=COLMAPResponse)
async def start_colmap(request: COLMAPRequest):
    """NeRF/COLMAP functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


@router.get("/colmap/status/{job_id}", response_model=COLMAPStatus)
async def get_colmap_status(job_id: str):
    """NeRF/COLMAP functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


@router.post("/colmap/retry/{job_id}", response_model=COLMAPResponse)
async def retry_colmap(job_id: str, request: COLMAPRequest):
    """NeRF/COLMAP functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


# ============================================================================
# Training Endpoints
# ============================================================================

@router.post("/train", response_model=TrainingResponse)
async def start_training(request: TrainingRequest):
    """NeRF training functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


@router.get("/train/status/{job_id}", response_model=TrainingStatus)
async def get_training_status(job_id: str):
    """NeRF training functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


@router.post("/train/retry/{job_id}", response_model=TrainingResponse)
async def retry_training(job_id: str, request: TrainingRequest):
    """NeRF training functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


# ============================================================================
# Rendering Endpoints
# ============================================================================

@router.post("/render", response_model=RenderResponse)
async def start_rendering(request: RenderRequest):
    """NeRF rendering functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


@router.get("/render/status/{job_id}", response_model=RenderStatus)
async def get_rendering_status(job_id: str):
    """NeRF rendering functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


@router.post("/render/retry/{job_id}", response_model=RenderResponse)
async def retry_rendering(job_id: str, request: RenderRequest):
    """NeRF rendering functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )


@router.get("/frames/{job_id}/{frame_number}")
async def get_frame(job_id: str, frame_number: int):
    """NeRF rendering functionality is disabled for this deployment."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NERF_DISABLED_MESSAGE
    )

