---
date: 2025-11-19T06:16:15Z
researcher: Tom Bauer
git_commit: 474c0c886a7f8fcf9d6c5cf2a9b1f11656ace72e
branch: tom-backend
repository: jant-vid-pipe
topic: "Codebase Architecture: Endpoints, Backend, Data Models, and Core Functionality"
tags: [research, codebase, architecture, backend, endpoints, data-models, replicate, video-pipeline, frontend-integration]
status: complete
last_updated: 2025-11-19
last_updated_by: Tom Bauer
---

# Research: Codebase Architecture - Video Generation Pipeline

**Date**: 2025-11-19T06:16:15Z
**Researcher**: Tom Bauer
**Git Commit**: `474c0c886a7f8fcf9d6c5cf2a9b1f11656ace72e`
**Branch**: `tom-backend`
**Repository**: jant-vid-pipe

## Research Question

Research this codebase with particular attention to the endpoints, backend, data models and core functionality. Document the video generation pipeline - essentially a UX that guides people looking to make an AI generated ad through a creative storyboarding process, hitting models on Replicate APIs to generate assets.

## Executive Summary

This codebase implements an **AI-powered video generation pipeline** that creates 30-second vertical (9:16) video ads through a **5-step wizard process**:

1. **Vision & Brief** - Conversational chat interface extracts creative requirements
2. **Mood Selection** - AI generates 3 mood boards (visual style directions) with sample images
3. **Storyboard** - AI plans 5-7 scenes with timing and generates seed images
4. **Video Clips** - Parallel generation of video clips from seed images using Replicate
5. **Final Composition** - FFmpeg assembles clips with crossfades and background music

### Technology Stack

**Frontend:**
- Next.js (React) with TypeScript
- Zustand for state management (with localStorage persistence)
- Vercel AI SDK for chat streaming
- Native fetch API (no Axios)

**Backend:**
- FastAPI (Python) on port 8000
- Pydantic for request/response validation
- In-memory job tracking (no database)
- CORS enabled for frontend communication

**External APIs:**
- **Replicate API** - Image generation (SDXL), Video generation (Seedance), Audio (MusicGen)
- **OpenAI API** - Chat (GPT-4o), Scene planning, Mood generation

**Media Processing:**
- FFmpeg for video composition with crossfade transitions

### Architecture Highlights

- **No production infrastructure** - In-memory job storage, no database, no Redis
- **Polling pattern** - Frontend polls video generation status every 3 seconds
- **Parallel processing** - All images/videos generated in parallel via `asyncio.gather()`
- **Environment-based optimization** - Dev mode uses lower resolution and fewer assets for speed
- **Async/await throughout** - Replicate SDK calls wrapped in `asyncio.to_thread()` to prevent blocking

---

## Detailed Findings

### 1. Backend API Endpoints

**Framework**: FastAPI with modular router organization

**Main Application**: `backend/app/main.py:1-46`

#### API Routers

All routers included at `main.py:24-28` with prefix `/api`:

**Moods Router** (`backend/app/routers/moods.py`)
- **POST** `/api/moods/generate` - Generate 3 mood boards with images
  - Input: Creative brief (product, audience, tone, style, messages)
  - Output: 3 moods × 1-4 images each (environment-dependent)
  - Uses OpenAI for mood directions, Replicate SDXL for images

**Scenes Router** (`backend/app/routers/scenes.py`)
- **POST** `/api/scenes/plan` - Generate scene breakdown for 30-second video
  - Input: Creative brief + selected mood data
  - Output: 5-7 scenes with descriptions, timing, and style prompts
  - Uses OpenAI GPT-4o for scene planning
- **POST** `/api/scenes/seeds` - Generate seed images for each scene
  - Input: Scene descriptions + mood styling
  - Output: One seed image per scene
  - Uses Replicate SDXL with scene-specific prompts

**Video Router** (`backend/app/routers/video.py`)
- **POST** `/api/video/generate` - Initiate parallel video clip generation
  - Input: Scenes with seed image URLs
  - Output: Job ID for async processing
  - Returns immediately, processes in background
- **GET** `/api/video/status/{job_id}` - Poll video generation status
  - Returns job progress, clip statuses, video URLs
- **GET** `/api/video/jobs` - Debug endpoint listing all jobs

**Audio Router** (`backend/app/routers/audio.py`)
- **POST** `/api/audio/generate` - Generate 30-second background music
  - Input: Mood data and emotional tone
  - Output: Audio URL from Replicate MusicGen

**Composition Router** (`backend/app/routers/composition.py`)
- **POST** `/api/composition/compose` - Compose final video
  - Input: Video clip URLs + audio URL
  - Output: Job ID for composition process
- **GET** `/api/composition/status/{job_id}` - Poll composition status
- **GET** `/api/composition/download/{job_id}` - Download final video

**Health Endpoints** (`main.py:31-44`)
- **GET** `/` - Root endpoint with service metadata
- **GET** `/health` - Health check returning `{"status": "healthy"}`

#### CORS Configuration

CORS middleware at `main.py:15-21`:
- Origins from config: `settings.get_cors_origins()` (default: `http://localhost:3000`)
- Credentials: enabled
- Methods/Headers: all allowed

---

### 2. Data Models and Schemas

#### Backend Models (Pydantic)

Location: `backend/app/models/`

**Scene Planning** (`scene_models.py`)
- `Scene` - Single scene with duration, description, style_prompt
- `ScenePlan` - Complete plan with total_duration and scenes list (validates 29-31 seconds)
- `ScenePlanRequest` - Input combining creative brief + mood data
- `ScenePlanResponse` - Output with generated scene plan
- `SceneWithSeedImage` - Scene with generated seed_image_url
- `SeedImageRequest` / `SeedImageResponse` - Seed image generation

**Video Generation** (`video_models.py`)
- `JobStatus` enum - `pending | processing | completed | failed`
- `SceneVideoInput` - Scene with seed image for generation
- `VideoGenerationRequest` - Payload for video generation
- `VideoGenerationResponse` - Job initiation response
- `VideoClip` - Individual clip with status tracking
- `VideoJobStatus` - Complete job status with progress metrics
- `VideoJobStatusResponse` - Status polling response

**Mood Boards** (`mood_models.py`)
- `CreativeBriefInput` - Creative brief data
- `MoodImage` - Single image with generation status
- `Mood` - Complete mood board with style keywords, color palette, aesthetic direction
- `MoodGenerationResponse` - List of generated moods

**Audio Generation** (`audio_models.py`)
- `AudioGenerationRequest` - Request for audio from mood data
- `AudioGenerationResponse` - Response with audio URL
- `MoodAudioRequest` - Mood-specific audio request

**Video Composition** (`composition_models.py`)
- `CompositionStatus` enum - `pending | downloading | composing | optimizing | completed | failed`
- `VideoClipInput` - Clip for composition with duration
- `CompositionRequest` - Request for composing clips
- `CompositionResponse` - Job initiation response
- `CompositionJobStatus` - Status with file metrics
- `CompositionJobStatusResponse` - Status polling response

#### Frontend Type Definitions (TypeScript)

Location: `frontend/types/`

All frontend types mirror backend models exactly:
- `video.types.ts` - Video generation types
- `scene.types.ts` - Scene planning types
- `mood.types.ts` - Mood board types
- `audio.types.ts` - Audio generation types
- `composition.types.ts` - Composition types
- `chat.types.ts` - Chat messages and creative brief types

**Technology**: TypeScript interfaces with union types for enums

**No ORM Models**: No database models found (SQLAlchemy, Prisma, etc.)

---

### 3. Replicate API Integration

**Service Files:**
- `backend/app/services/replicate_service.py` - Image and video generation
- `backend/app/services/audio_service.py` - Audio generation

#### Credentials Management

**Configuration**: `backend/app/config.py:13-14, 39-41`
- Environment variables: `REPLICATE_API_TOKEN` or `REPLICATE_API_KEY`
- Retrieved via `settings.get_replicate_token()`
- Client initialization: `replicate.Client(api_token=token)`

**Service Initialization Pattern** (all services):
```python
token = settings.get_replicate_token()
if not token:
    raise ValueError("Replicate API token not configured...")
self.client = replicate.Client(api_token=token)
```

#### Models Being Called

**Image Generation**: `replicate_service.py:15-43`
- Model: `stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b`
- Used for: Mood board images and scene seed images
- Parameters (dev): 20 inference steps, guidance 7.0, resolution 640×1136
- Parameters (prod): 50 inference steps, guidance 7.5, resolution 1080×1920

**Video Generation**: `replicate_service.py:418-442`
- Model: `bytedance/seedance-1-pro-fast`
- Image-to-video with prompt support
- Duration: 3-10 seconds (clamped)
- Resolution: 720p (dev) or 1080p (prod)
- Aspect ratio: 9:16 (vertical)

**Audio Generation**: `audio_service.py:11-32`
- Model: `meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb`
- Max duration: 30 seconds
- Model version: "large" (dev) or "stereo-large" (prod)
- Output: MP3 format

#### Core API Call Pattern

**Sync-to-Async Wrapper** (`replicate_service.py:101-123`):
```python
output = await asyncio.wait_for(
    asyncio.to_thread(
        self.client.run,
        model_id,
        input=input_params
    ),
    timeout=timeout
)
```

- `asyncio.wait_for()` enforces timeout
- `asyncio.to_thread()` runs blocking SDK call in thread pool
- Prevents blocking FastAPI event loop

**Timeouts:**
- Images: 60s (dev) / 90s (prod)
- Videos: 300s (5 minutes)
- Audio: 120s

#### Parallel Batch Processing

**Image Generation** (`replicate_service.py:125-191`):
```python
tasks = [_generate_single_image_safe(prompt, ...) for prompt in prompts]
results = await asyncio.gather(*tasks, return_exceptions=True)
```

**Video Generation** (`replicate_service.py:557-589`):
```python
tasks = [_generate_scene_video_safe(scene, ...) for scene in scenes]
results = await asyncio.gather(*tasks, return_exceptions=True)
```

#### Retry Logic

**Video Generation Retry** (`replicate_service.py:626-677`):
- Max retries: 2 (3 total attempts)
- Base delay: 2.0 seconds
- Exponential backoff: delay × 2^attempt
- Error categorization at lines 591-624:
  - **Retryable**: Network errors, timeouts, rate limits (429), server errors (500-504)
  - **Not retryable**: Content policy violations, invalid input (400)

**Audio Generation Retry** (`audio_service.py:279-349`):
- Same retry pattern with exponential backoff

#### Polling Pattern (No Webhooks)

**Video Generation Flow**:
1. POST `/api/video/generate` → Returns job_id immediately
2. Background task `_process_video_generation` starts
3. Frontend polls GET `/api/video/status/{job_id}` every 3 seconds
4. Backend updates in-memory `_jobs` dictionary via callbacks
5. Polling stops when `progress_percent == 100` or status is `completed/failed`

**No webhook implementation** - All Replicate calls use synchronous `client.run()` which blocks until complete

---

### 4. Video Generation Pipeline

**End-to-End Flow**: 5 stages creating a 30-second vertical video ad

#### Stage 1: Mood Generation

**Endpoint**: POST `/api/moods/generate` (`moods.py:35-174`)

**Process**:
1. Generate 3 mood directions using OpenAI (`mood_service.py:92-137`)
   - Model: GPT-3.5-turbo (dev) or GPT-4o (prod)
   - Prompt requests: name, description, style keywords, color palette, aesthetic direction
2. Build image prompts for each mood (`moods.py:82-105`)
   - Add variation suffixes: "close-up", "wide angle", "dramatic lighting", "minimalist"
3. Generate all images in parallel (`moods.py:112-116`)
   - Dev: 1 image per mood (3 total)
   - Prod: 4 images per mood (12 total)
4. Organize results by mood with success/error tracking

#### Stage 2: Scene Planning

**Endpoint**: POST `/api/scenes/plan` (`scenes.py:38-105`)

**Process**:
1. Call `SceneGenerationService.generate_scene_breakdown()` (`scene_service.py:44-61`)
2. Build prompt requesting scene breakdown (`scene_service.py:63-128`)
   - Opening hook: 3-4 seconds
   - Product intro: 4-6 seconds
   - Key features: 12-16 seconds (2-3 scenes)
   - Closing/CTA: 4-6 seconds
   - Must sum to exactly 30 seconds
3. Use OpenAI GPT-4o with JSON mode (`scene_service.py:136-154`)
4. Validate: 5-7 scenes, duration 29-31 seconds (`scene_service.py:54-59`)
5. Return structured scene plan with scene_number, duration, description, style_prompt

#### Stage 3: Seed Image Generation

**Endpoint**: POST `/api/scenes/seeds` (`scenes.py:108-189`)

**Process**:
1. Build prompts for each scene (`replicate_service.py:275-339`)
   - Prioritize scene description (what to show)
   - Add scene-specific style
   - Add mood aesthetic for consistency
   - Add style keywords (max 5) and color palette (max 4)
   - Specify: "Professional cinematic frame", "Vertical 9:16", "SFW content"
2. Generate all seed images in parallel (`replicate_service.py:392-396`)
3. Return scenes with seed_image_url, generation_success, generation_error

#### Stage 4: Audio Generation

**Endpoint**: POST `/api/audio/generate` (`audio.py:32-82`)

**Process**:
1. Build music prompt from mood data (`audio_service.py:34-112`)
   - Mood name + "instrumental background music"
   - Top 3 emotional tones
   - Visual style keywords mapped to musical characteristics:
     - 'modern' → 'electronic, contemporary'
     - 'vintage' → 'retro, analog'
     - 'minimalist' → 'simple, clean melody'
     - 'bold' → 'powerful, dynamic'
     - 'elegant' → 'sophisticated, smooth'
   - Specify: "no vocals", "suitable for video background", "consistent volume"
   - Limit to 300 characters
2. Call Meta MusicGen with retry logic (`audio_service.py:279-349`)
3. Return audio URL (30 seconds max)

#### Stage 5: Video Clip Generation

**Endpoint**: POST `/api/video/generate` (`video.py:221-281`)

**Process**:
1. Validate scenes have seed_image_url (`video.py:251-259`)
2. Create job with UUID, initialize VideoClip objects with PENDING status (`video.py:41-84`)
3. Store in in-memory `_jobs` dict
4. Start background task `_process_video_generation` (`video.py:165-219`)
5. Return job_id immediately
6. Background task:
   - Calls `generate_videos_parallel()` (`replicate_service.py:557-589`)
   - Progress callback updates clip status (`video.py:200-201`)
   - Each clip generation uses retry logic (`replicate_service.py:626-677`)
   - Uses Seedance model with scene description as prompt
   - Duration clamped to 3-10 seconds
7. Frontend polls GET `/api/video/status/{job_id}` every 3 seconds
8. Polling continues until `progress_percent == 100` or status is `completed/failed`

#### Stage 6: Final Composition

**Endpoint**: POST `/api/composition/compose` (`composition.py:229-288`)

**Process**:
1. Create composition job, start background task (`composition.py:120-227`)
2. **Download assets** (10% progress)
   - Downloads clips and audio in parallel using `httpx.AsyncClient` (`ffmpeg_service.py:61-138`)
   - Creates unique job directory: `{temp}/video_composition/{job_id_hash}`
3. **Compose video** (30% progress)
   - Get clip durations using `ffmpeg.probe()` (`ffmpeg_service.py:237`)
   - Build crossfade filter chain (`ffmpeg_service.py:381-506`)
   - For each transition: `xfade` filter at `offset = duration - 0.5s`
   - Encode with H.264, AAC audio, 1080×1920 @ 30fps
4. **Add audio** (if provided)
   - Mix background music with video (`ffmpeg_service.py:508-568`)
   - Trim audio to video duration, apply 1-second fadeout
5. **Optimize** (80% progress, if requested)
   - Calculate target bitrate to meet size limit (`ffmpeg_service.py:587-653`)
   - Re-encode with lower bitrate if needed
6. **Complete** (100% progress)
   - Store file_path and create download URL
   - Return via GET `/api/composition/download/{job_id}` as FileResponse

**FFmpeg Settings** (`ffmpeg_service.py:465-490`):
- Codec: H.264 (libx264)
- Bitrate: 2500k-3M
- Audio: AAC @ 192k (128k for optimized)
- Preset: medium
- Pixel format: yuv420p
- Crossfade: 0.5 seconds between clips

---

### 5. Storyboarding/Creative UX Patterns

**5-Step Wizard Pattern** with progressive disclosure

#### Step Indicator Component

**File**: `frontend/components/ui/StepIndicator.tsx:1-74`

**Pattern**: Horizontal step indicator with connector lines
- Fixed 5 steps: Vision & Brief → Mood Selection → Storyboard → Video Clips → Final Video
- Visual states:
  - Current step: Blue circle with number
  - Completed steps: Green circle with checkmark
  - Upcoming steps: Gray circle with number
- Connector lines show progress between steps
- Sticky header positioning

#### Step 1: Vision & Brief (Chat Interface)

**File**: `frontend/components/vision/ChatInterface.tsx:1-162`

**Pattern**: Conversational chat interface
- Empty state with instructional text and bot icon
- Message bubbles differentiated by role (user: right, assistant: left)
- Streaming indicator with animated cursor
- Auto-scroll to latest message
- Timestamp display
- Integrated textarea input with "Enter to send, Shift+Enter for new line"

**Creative Brief Summary** (`CreativeBriefSummary.tsx:1-151`):
- Structured grid layout displaying extracted brief
- Tag display for arrays (emotional_tone, visual_style_keywords)
- Bulleted list for key_messages
- Success indicator (green checkmark)
- Edit and Continue actions

#### Step 2: Mood Selection

**File**: `frontend/components/moods/MoodBoard.tsx:1-128`

**Pattern**: Gallery with selectable cards
- Generate button when no moods exist
- Loading states with contextual messages
- Continue button only enabled when selected mood fully loaded

**Individual Mood Card** (`MoodCard.tsx:1-147`):
- Clickable card with hover effects
- Selected state: border highlight, scale transform, ring, checkmark overlay
- 2×2 grid displaying 4 sample images (9:16 aspect ratio)
- Style keyword tags with truncation ("+ N more")
- Color palette visualization with circular swatches
- Keyboard accessible (role, tabIndex, aria attributes)

#### Step 3: Storyboard

**File**: `frontend/components/scenes/Storyboard.tsx:1-179`

**Pattern**: Timeline + card grid
- Empty state with clear CTA: "Generate Scene Plan"
- Loading states: "Creating scene breakdown..." → "Generating seed images..."

**Scene Timeline** (`SceneTimeline.tsx:1-107`):
- Proportional time visualization (0-30 seconds)
- Time markers every 5 seconds
- Color-coded scene blocks with HSL hue generation
- Scene duration labels on each block
- Hover tooltips with time ranges
- Legend with color swatches

**Scene Card** (`SceneCard.tsx:1-86`):
- 9:16 aspect ratio image display
- Overlaid badges: scene number (top-left), duration (top-right)
- Image states: loading, success, error, no image
- Structured details: description and style sections
- Hover shadow effect

#### Step 4: Video Generation

**File**: `frontend/components/composition/VideoGeneration.tsx:1-460`

**Pattern**: Progress tracking with status display
- Audio preview with native `<audio>` player
- Scene validation grid showing which have seed images
- Large emoji icons for visual feedback (🎵 🎬)
- Multi-clip progress display
- Continue button appears when all clips complete

#### Step 5: Final Composition

**File**: `frontend/components/composition/FinalComposition.tsx:1-396`

**Pattern**: Multi-phase progress
- Phase indicator with animated emojis:
  - 🎵 Generating Background Music
  - 🎬 Composing Video
  - ✅ Processing Complete
- Dual progress bars (audio 0-100%, composition 0-100%)
- Phase completion checkmarks
- Final video preview with native `<video>` player (autoplay, loop)
- Stats grid: duration, file size, clip count, aspect ratio
- Download and restart actions

#### State Management

**Zustand Store** (`frontend/store/appStore.ts:1-148`):
- Centralized state for entire pipeline
- Tracks: currentStep, creativeBrief, moods, selectedMoodId, scenePlan, videoJobId, generatedClips, audioUrl, compositionJobId, finalVideo
- localStorage persistence (key: `'jant-vid-pipe-app-state'`)
- Selective persistence: progress values not persisted, core data persisted

**Custom Hooks** (`frontend/hooks/`):
- `useVisionChat` - Chat and brief extraction
- `useMoodGeneration` - Mood board generation
- `useScenePlanning` - Scene plan and seed images
- `useVideoGeneration` - Video polling with 3-second interval
- `useAudioGeneration` - Audio generation
- Each hook manages: loading, error, API calls, store integration

---

### 6. Frontend-Backend Integration

#### API Client Setup

**File**: `frontend/lib/api/client.ts:1-82`

**Pattern**: Lightweight fetch-based client (no Axios)
- Base URL: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`
- Generic wrapper: `async function apiRequest<T>(endpoint, options)`
- Automatic JSON headers
- Error extraction from response

**Public Functions**:
- `checkHealth()` - GET /health
- `generateMoods(creativeBrief)` - POST /api/moods/generate
- `generateScenePlan(request)` - POST /api/scenes/plan
- `generateAudio(request)` - POST /api/audio/generate

#### Chat Integration (Vercel AI SDK)

**File**: `frontend/app/api/chat/route.ts:1-127`

**Pattern**: Next.js API route with streaming
- Uses Vercel AI SDK `streamText` function
- Model: OpenAI GPT-4o
- Temperature: 0.8 for natural conversation
- System prompt: `CREATIVE_BRIEF_SYSTEM_PROMPT`
- Error handling: 401 (API key), 429 (rate limit), 504 (timeout), 503 (network)

**Hook**: `frontend/hooks/useVisionChat.ts:1-244`
- Uses `useChat` from Vercel AI SDK
- Converts AI SDK messages to custom format
- Auto-extracts creative brief when conversation sufficient
- Calculates conversation progress (0-100%)

#### Video Generation Polling

**File**: `frontend/hooks/useVideoGeneration.ts:1-331`

**Pattern**: Poll-based async job monitoring
- Polling interval: 3 seconds
- Max poll retries: 3
- State: jobStatus, isGenerating, error, failedClips

**Flow**:
1. `startGeneration()` - POST `/api/video/generate` → Returns job_id
2. `startPolling(job_id)` - Sets interval to poll every 3 seconds
3. `pollJobStatus(job_id)` - GET `/api/video/status/{job_id}`
4. Update React state with fresh object reference (forces re-render)
5. Stop polling when `progress_percent == 100` or status terminal
6. Retry logic: stops after 3 failed polls

**Cleanup**: useEffect clears interval on unmount

#### Error Handling

**File**: `frontend/lib/errors.ts:1-509`

**Custom Error Classes**:
- `ChatError`, `ExtractionError`, `NetworkError`
- `MoodGenerationError`, `ScenePlanningError`
- `VideoGenerationError`, `AudioGenerationError`, `CompositionError`

**Error Codes**: Enum with 40+ codes (API_KEY_MISSING, RATE_LIMIT, TIMEOUT, etc.)

**Retry Logic** (`errors.ts:233-279`):
- `retryWithBackoff()` - exponential backoff
- Max retries: 3
- Initial delay: 1000ms
- Max delay: 10000ms
- Multiplier: 2x

**Retryable Errors**: Network, timeout, rate limit (429), server (500-504)

#### Request/Response Flow

**Example: Mood Generation**
1. User clicks generate → `useMoodGeneration.generateMoodsFromBrief()`
2. Hook calls `generateMoods()` from API client
3. POST to `/api/moods/generate` with creative brief
4. Backend generates mood directions (OpenAI) + images (Replicate)
5. Returns `MoodGenerationResponse` with moods array
6. Hook updates Zustand store
7. Store persists to localStorage
8. UI components re-render from store

---

## Code References

### Backend Entry Points
- `backend/app/main.py:8` - FastAPI application initialization
- `backend/app/main.py:24-28` - Router registration
- `backend/app/routers/moods.py:35` - POST /api/moods/generate
- `backend/app/routers/scenes.py:38` - POST /api/scenes/plan
- `backend/app/routers/scenes.py:108` - POST /api/scenes/seeds
- `backend/app/routers/video.py:221` - POST /api/video/generate
- `backend/app/routers/video.py:284` - GET /api/video/status/{job_id}
- `backend/app/routers/audio.py:32` - POST /api/audio/generate
- `backend/app/routers/composition.py:229` - POST /api/composition/compose

### Replicate Integration
- `backend/app/services/replicate_service.py:25-33` - Client initialization
- `backend/app/services/replicate_service.py:101-123` - API call wrapper
- `backend/app/services/replicate_service.py:125-191` - Parallel image generation
- `backend/app/services/replicate_service.py:557-589` - Parallel video generation
- `backend/app/services/replicate_service.py:626-677` - Retry logic with backoff
- `backend/app/services/audio_service.py:114-206` - Audio generation

### Frontend API Communication
- `frontend/lib/api/client.ts:13` - Generic fetch wrapper
- `frontend/store/appStore.ts:60-147` - Zustand store with persistence
- `frontend/hooks/useMoodGeneration.ts:34-71` - Mood generation hook
- `frontend/hooks/useVideoGeneration.ts:53-160` - Polling implementation
- `frontend/hooks/useVisionChat.ts:47-62` - Vercel AI SDK integration

### UI Components
- `frontend/components/ui/StepIndicator.tsx:9-16` - Step definitions
- `frontend/components/vision/ChatInterface.tsx:1-162` - Chat UI
- `frontend/components/moods/MoodCard.tsx:1-147` - Selectable mood card
- `frontend/components/scenes/SceneTimeline.tsx:1-107` - Timeline visualization
- `frontend/components/scenes/SceneCard.tsx:1-86` - Scene card with seed image

---

## Architecture Documentation

### Current Architecture Patterns

**1. Modular Router Pattern**
- FastAPI app with 5 separate routers
- Each router handles one domain: moods, scenes, video, audio, composition
- Services layer abstracts business logic
- Routers convert between Pydantic models and service dicts

**2. In-Memory Job Tracking**
- Video jobs: `_jobs: Dict[str, VideoJobStatus]` at `video.py:21`
- Composition jobs: `_jobs: Dict[str, CompositionJobStatus]` at `composition.py:22`
- Production note: "should be replaced with Redis or a database" (`video.py:20`)

**3. Polling Pattern for Async Operations**
- No webhooks from Replicate
- Frontend polls status endpoints every 3 seconds
- Backend uses FastAPI BackgroundTasks for async processing
- In-memory job state updated via callbacks

**4. Parallel Processing with asyncio**
- All images/videos generated in parallel via `asyncio.gather()`
- Safe wrapper pattern: catches exceptions, returns None on error
- Allows partial failures without blocking other operations

**5. Environment-Based Optimization**
- Dev mode: Lower resolution (640×1136), fewer assets (1 per mood), faster models
- Prod mode: Full resolution (1080×1920), more assets (4 per mood), quality models
- Determined by `settings.is_development()` (`config.py:29-31`)

**6. Sync-to-Async Wrapper**
- Replicate SDK is synchronous (blocking)
- Wrapped in `asyncio.to_thread()` to run in thread pool
- Timeout enforced with `asyncio.wait_for()`
- Prevents blocking FastAPI event loop

**7. Frontend State Management**
- Zustand store for global pipeline state
- localStorage persistence for recovery
- Custom hooks per step manage local state + API calls
- Single source of truth for UI

**8. No Database**
- All state in memory (jobs, progress)
- No ORM models
- Pydantic for request/response validation only
- Temporary files in system temp directory

### Data Flow Patterns

**Mood Generation**: User → Chat → Extract Brief → Generate Moods (OpenAI) → Generate Images (Replicate) → Store

**Scene Planning**: Brief + Mood → Generate Scenes (OpenAI) → Generate Seed Images (Replicate) → Store

**Video Generation**: Scenes → Create Job → Background Task → Parallel Video Gen (Replicate) → Poll Status → Complete

**Composition**: Video Clips + Audio → Download → FFmpeg Compose → Optimize → Complete

### Technology Decisions

**Why FastAPI**: Async support, automatic OpenAPI docs, Pydantic validation

**Why Zustand**: Lightweight state management, persistence built-in, no boilerplate

**Why Native Fetch**: Simplicity, no heavyweight dependencies, sufficient for needs

**Why Polling**: Replicate SDK is synchronous, no webhook support needed

**Why In-Memory Jobs**: Prototype/MVP stage, production infra not built yet

---

## Configuration

### Backend Environment Variables
- `ENVIRONMENT` - "development" or "production" (default: development)
- `REPLICATE_API_TOKEN` / `REPLICATE_API_KEY` - Replicate API access
- `OPENAI_API_KEY` - OpenAI API access
- `REPLICATE_IMAGE_MODEL` - Override default SDXL model
- `OPENAI_MODEL` - Override default GPT model
- `IMAGES_PER_MOOD` - 0=auto (1 dev, 4 prod) or explicit count
- `IMAGE_WIDTH` / `IMAGE_HEIGHT` - 0=auto or explicit dimensions
- `CORS_ORIGINS` - Comma-separated allowed origins

### Frontend Environment Variables
- `NEXT_PUBLIC_API_URL` - Backend URL (default: http://localhost:8000)
- `OPENAI_API_KEY` - Used in `/api/chat` route (server-side only)

---

## Open Questions

1. **Production Infrastructure**: How will job tracking be implemented? (Redis, PostgreSQL, MongoDB?)
2. **File Storage**: Where will generated videos be stored long-term? (S3, GCS, local storage?)
3. **Authentication**: How will users be authenticated? (Auth0, Clerk, custom?)
4. **Scaling**: How will parallel video generation scale? (Job queue, worker pools?)
5. **Error Recovery**: How to handle partial failures? (Retry failed clips, regenerate entire batch?)
6. **Cost Management**: How to track and limit Replicate API costs per user?
7. **Video Limits**: What are the constraints on video length, resolution, file size?
8. **Concurrent Users**: How many simultaneous video generations can the system handle?
