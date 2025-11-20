"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import moods, scenes, video, audio, composition

logger = logging.getLogger(__name__)

# Initialize Firebase/Firestore on startup
try:
    from app.firestore_database import db as firestore_db
    logger.info("Firestore database initialized")
except Exception as e:
    logger.error(f"Failed to initialize Firestore: {e}")
    logger.warning("Falling back to in-memory database (data will not persist!)")
    from app.database import db as firestore_db

# Create FastAPI app
app = FastAPI(
    title="AI Video Generation Pipeline API",
    description="Backend API for AI-powered video generation pipeline",
    version="0.1.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(moods.router)
app.include_router(scenes.router)
app.include_router(video.router)
app.include_router(audio.router)
app.include_router(composition.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Video Generation Pipeline API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}

