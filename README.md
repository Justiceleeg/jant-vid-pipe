# AI Video Generation Pipeline

A project-based AI video generation pipeline that transforms user vision into 30-second vertical videos optimized for social media. Built with Next.js 16 (App Router) and FastAPI.

## 🎯 User Flow

The application follows a streamlined 4-step workflow within projects:

1. **Projects Dashboard** - Create, manage, and switch between multiple video projects
2. **Vision & Brief** (`/project/[id]/chat`) - Conversational AI interface to capture your video concept
3. **Mood Selection** (`/project/[id]/mood`) - Choose from AI-generated mood boards
4. **Scene Storyboard** (`/project/[id]/scenes`) - Progressive scene generation (text → image → video)
5. **Final Composition** (`/project/[id]/final`) - Generate the complete video with audio

### State Management

- **Project-Based**: All work is organized into projects with automatic saving
- **Multi-Project Support**: Switch between projects without losing progress
- **Persistent State**: Project data saves to Firestore (with localStorage fallback)
- **Scene Store**: Real-time scene updates via Server-Sent Events (SSE)
- **Backend Persistence**: Storyboards and scenes persist in Firestore database

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm** (package manager)
- **Python 3.11, 3.12, or 3.13** (Python 3.14+ has compatibility issues with Pydantic V1 used by the `replicate` package)
- **FFmpeg** installed on your system
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (RHEL/CentOS)
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **Firebase Project** (for authentication and database)
  - Create a project at [Firebase Console](https://console.firebase.google.com)
  - Enable Authentication (Email/Password) and Firestore Database
  - Download service account key for backend

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jant-vid-pipe
   ```

2. **Install root dependencies**
   ```bash
   pnpm install
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   pnpm install
   ```

4. **Set up the backend**
   ```bash
   cd ../backend
   # Use Python 3.11, 3.12, or 3.13 (not 3.14+)
   python3.13 -m venv venv  # Or python3.12, python3.11
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. **Set up Firebase**

   **Backend Setup:**
   - Download your Firebase service account key from [Firebase Console](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk)
   - Save it as `backend/serviceAccountKey.json`
   - The backend requires this file to initialize Firestore

   **Frontend Setup:**
   - Get your Firebase web config from [Firebase Console](https://console.firebase.google.com/project/_/settings/general)
   - Copy the Firebase configuration values for use in `frontend/.env.local`

6. **Configure environment variables**

   **Backend** (`backend/.env`):
   ```env
   # Required API Keys
   REPLICATE_API_TOKEN=your_replicate_api_token_here
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Firebase Configuration
   # Service account key should be placed at: backend/serviceAccountKey.json
   FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com  # Optional: auto-detected from service account
   
   # Environment Configuration (defaults to "development")
   ENVIRONMENT=development  # Options: development, production
   
   # Optional: Override model selection
   # REPLICATE_IMAGE_MODEL=stability-ai/sdxl:...  # Override default model
   # OPENAI_MODEL=gpt-4o  # Override default model
   
   # Product Compositing (optional)
   USE_KONTEXT_COMPOSITE=true
   COMPOSITE_METHOD=kontext
   KONTEXT_MODEL_ID=flux-kontext-apps/multi-image-kontext-pro
   
   # CORS Configuration
   CORS_ORIGINS=http://localhost:3000
   
   # Backend API Base URL (for webhooks)
   API_BASE_URL=http://localhost:8000
   ```
   
   > 💡 **Performance & Cost Optimization:** In development mode, the app automatically optimizes for speed:
   > - **Replicate Image Generation**:
   >   - **Dev**: 20 inference steps, guidance scale 7.0, resolution 1280×720 = ~15-25s/image
   >   - **Prod**: 50 inference steps, guidance scale 7.5, resolution 1920×1080 = ~30-60s/image
   > - **Images per mood**: 1 (configurable via `IMAGES_PER_MOOD` env var)
   > - **OpenAI**: GPT-3.5-turbo (~$0.0015/1K tokens) in dev, GPT-4o (~$0.005/1K tokens) in prod
   > 
   > **Expected generation time:**
   > - **Dev**: ~15-30 seconds for 3 images (3 moods × 1 image) at lower quality
   > - **Prod**: ~1-2 minutes for 3 images (3 moods × 1 image) at full quality
   > 
   > **To customize quality settings**, set these environment variables in `backend/.env`:
   > 
   > ```env
   > # Image generation settings
   > IMAGES_PER_MOOD=1        # Number of images per mood (default: 1)
   > IMAGE_WIDTH=1920          # Image width (default: 1280 dev, 1920 prod)
   > IMAGE_HEIGHT=1080         # Image height (default: 720 dev, 1080 prod)
   > ```
   > 
   > Set `ENVIRONMENT=production` to use full-quality settings automatically.

   **Frontend** (`frontend/.env.local`):
   ```env
   # API Configuration
   NEXT_PUBLIC_API_URL=http://localhost:8000
   
   # Firebase Web Configuration (required for authentication and data persistence)
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   
   # OpenAI (optional - for chat features)
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   > 💡 **Tip:** Copy `.env.example` from the root directory as a template.

### Running the Development Servers

**Option 1: Run both servers simultaneously (Recommended)**
```bash
# From the root directory
pnpm dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

**Option 2: Run servers separately**

Terminal 1 (Frontend):
```bash
cd frontend
pnpm dev
```

Terminal 2 (Backend):
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

## 📁 Project Structure

```
jant-vid-pipe/
├── frontend/                    # Next.js 16 App (App Router)
│   ├── app/                    # App Router pages and API routes
│   │   ├── projects/           # Projects dashboard
│   │   ├── project/[id]/       # Project-specific pages
│   │   │   ├── chat/           # Step 1: Vision & Brief
│   │   │   ├── mood/           # Step 2: Mood Selection
│   │   │   ├── scenes/         # Step 3: Scene Storyboard
│   │   │   └── final/          # Step 4: Final Composition
│   │   ├── sign-in/            # Authentication
│   │   └── sign-up/            # User registration
│   ├── components/             # React components
│   │   ├── storyboard/         # Scene carousel & timeline
│   │   ├── moods/              # Mood gallery
│   │   └── ui/                 # Shared UI components
│   ├── lib/                    # Utilities and API client
│   ├── store/                  # Zustand state management
│   │   ├── appStore.ts         # Workflow state (ephemeral)
│   │   ├── projectStore.ts     # Project management (persistent)
│   │   └── sceneStore.ts       # Scene state (ephemeral, API-backed)
│   ├── types/                  # TypeScript type definitions
│   └── hooks/                  # Custom React hooks
│
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── config.py          # Configuration settings
│   │   ├── database.py        # Database interface (Firestore)
│   │   ├── firestore_database.py  # Firestore implementation
│   │   ├── routers/             # API endpoint routers
│   │   │   ├── admin.py        # Admin metrics endpoints
│   │   │   ├── audio.py        # Audio generation
│   │   │   ├── backgrounds.py  # Background assets
│   │   │   ├── brand.py        # Brand assets
│   │   │   ├── character.py    # Character assets
│   │   │   ├── composition.py  # Video composition
│   │   │   ├── moods.py        # Mood board generation
│   │   │   ├── product.py      # Product assets
│   │   │   ├── scenes.py       # Scene operations
│   │   │   ├── storyboards.py  # Storyboard CRUD + SSE
│   │   │   ├── video.py        # Video generation
│   │   │   ├── webhooks.py     # Replicate webhooks
│   │   │   └── whisper.py      # Speech-to-text
│   │   ├── services/           # Business logic services
│   │   │   ├── audio_service.py
│   │   │   ├── background_service.py
│   │   │   ├── brand_service.py
│   │   │   ├── character_service.py
│   │   │   ├── ffmpeg_service.py
│   │   │   ├── firebase_storage_service.py
│   │   │   ├── metrics_service.py
│   │   │   ├── mood_service.py
│   │   │   ├── product_service.py
│   │   │   ├── rate_limiter.py
│   │   │   ├── replicate_service.py
│   │   │   ├── scene_service.py
│   │   │   ├── storyboard_service.py
│   │   │   └── whisper_service.py
│   │   ├── models/             # Pydantic models
│   │   └── utils/              # Utility functions
│   ├── uploads/                # Temporary file uploads
│   ├── serviceAccountKey.json  # Firebase service account (required)
│   ├── requirements.txt        # Python dependencies
│   └── tests/                  # Backend tests
│
├── docs/                       # Documentation
│   ├── architecture.md         # Technical Architecture
│   ├── composite_deployment.md # Compositing deployment guide
│   ├── composite_testing.md    # Compositing testing guide
│   ├── implementation-notes.md # Implementation details
│   └── USER_GUIDE.md           # User guide
│
└── .cursor/                    # Cursor IDE configuration
```

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Authentication:** Firebase Auth (email/password)
- **Database:** Firestore (with localStorage fallback)
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand (3 stores: appStore, projectStore, sceneStore)
- **AI/Chat:** Vercel AI SDK with OpenAI
- **Real-time Updates:** Server-Sent Events (SSE)
- **Package Manager:** pnpm

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** Firestore (via Firebase Admin SDK)
- **Storage:** Firebase Storage (for generated assets)
- **AI Services:** Replicate API (image & video generation)
- **Video Processing:** FFmpeg (via `ffmpeg-python`)
- **Async Processing:** Python asyncio/async-await

### External Services
- **Firebase:** Authentication, Firestore database, and Storage
- **OpenAI API:** GPT-4o/GPT-3.5-turbo (chat & creative brief synthesis)
- **Replicate:** 
  - Image generation (SDXL)
  - Video generation (img2vid)
  - Product compositing (FLUX Kontext)

## 📚 Documentation

### User Documentation
- **[User Guide](docs/USER_GUIDE.md)** - Complete walkthrough of the 4-step workflow
- **[Architecture Overview](docs/architecture.md)** - System architecture and technical design

### Developer Documentation
- **[Frontend README](frontend/README.md)** - Frontend architecture and state management
- **[Implementation Notes](docs/implementation-notes.md)** - Technical implementation details and decisions
- **[Storyboard Components](frontend/components/storyboard/README.md)** - Scene carousel and timeline documentation
- **[Error Handling](frontend/components/storyboard/ERROR_HANDLING.md)** - Comprehensive error handling system

### Deployment & Testing
- **[Composite Testing Guide](docs/composite_testing.md)** - Testing guide for product compositing
- **[Composite Deployment Guide](docs/composite_deployment.md)** - Deployment instructions for compositing features

## 🎨 Product Compositing

This application supports AI-powered product compositing using FLUX Kontext multi-image model.

### Configuration

Set these environment variables in `backend/.env`:

```bash
# Product Compositing Configuration
USE_KONTEXT_COMPOSITE=true          # Enable Kontext compositing
COMPOSITE_METHOD=kontext            # "kontext" or "pil"
KONTEXT_MODEL_ID=flux-kontext-apps/multi-image-kontext-pro
KONTEXT_TIMEOUT_SECONDS=60         # Timeout for Kontext API
MAX_CONCURRENT_KONTEXT=10          # Max concurrent requests
MAX_KONTEXT_PER_HOUR=100           # Rate limit per hour
KONTEXT_DAILY_GENERATION_LIMIT=1000 # Daily alert threshold
```

### Features

- **Intelligent Integration**: AI-powered product placement with natural lighting and shadows
- **Automatic Fallback**: Gracefully falls back to PIL method if Kontext fails
- **Rate Limiting**: Prevents API abuse with configurable limits
- **Metrics Tracking**: Monitor usage and performance via admin endpoints

### Admin Endpoints

- `GET /api/admin/metrics/composite` - Get composite generation statistics
- `GET /api/admin/metrics/daily-generations?days=7` - Get daily generation counts
- `GET /api/admin/metrics/health` - Get health status and warnings
- `POST /api/admin/metrics/reset` - Reset all metrics

### Example Usage

**Get Metrics:**
```bash
curl http://localhost:8000/api/admin/metrics/composite
```

**Get Daily Generations:**
```bash
curl http://localhost:8000/api/admin/metrics/daily-generations?days=7
```

**Check Health:**
```bash
curl http://localhost:8000/api/admin/metrics/health
```

### Switching Methods

To use the PIL method instead of Kontext:

```bash
COMPOSITE_METHOD=pil
# or
USE_KONTEXT_COMPOSITE=false
```

### Documentation

- [Manual Testing Guide](docs/composite_testing.md) - Comprehensive testing checklist
- [Deployment Guide](docs/composite_deployment.md) - Production deployment instructions

## 🔐 Authentication & Database

### Firebase Setup

The application uses Firebase for authentication and data persistence:

1. **Authentication**: Firebase Auth with email/password
   - Users can sign up and sign in through the frontend
   - Authentication state is managed client-side with Firebase SDK
   - Protected routes use `AuthGuard` components

2. **Database**: Firestore
   - Storyboards and scenes persist in Firestore
   - User assets are stored per user in Firestore collections
   - Backend uses Firebase Admin SDK for server-side operations
   - Frontend uses Firebase SDK with localStorage fallback

3. **Storage**: Firebase Storage
   - Generated images, videos, and assets are stored in Firebase Storage
   - Public URLs are generated for frontend access

### Required Firebase Services

Enable these in your Firebase Console:
- **Authentication** → Sign-in method: Email/Password
- **Firestore Database** → Create database (start in test mode for development)
- **Storage** → Create storage bucket

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:8000/health
```

### Frontend
Open http://localhost:3000 in your browser.
