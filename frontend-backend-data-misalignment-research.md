---
date: 2025-11-21T10:59:17-06:00
researcher: tombauer
git_commit: 5e77aba555f97c0f55d885d3cb72a2f9202b323c
branch: tom-backend
repository: jant-vid-pipe
topic: "Frontend-Backend Data Structure Misalignment Analysis"
tags: [research, codebase, data-structures, frontend, backend, firebase, zustand]
status: complete
last_updated: 2025-11-21
last_updated_by: tombauer
---

# Research: Frontend-Backend Data Structure Misalignment Analysis

**Date**: 2025-11-21T10:59:17-06:00
**Researcher**: tombauer
**Git Commit**: 5e77aba555f97c0f55d885d3cb72a2f9202b323c
**Branch**: tom-backend
**Repository**: jant-vid-pipe

## Research Question

The whole goal is to provide a backend that is flexible and matches the steps in the frontend. Right now there is some misalignment between what we save to Firebase and what we do in our frontend store. We want to research the core data structures and flows of this app on both frontend and backend to understand the misalignment.

## Summary

The research reveals significant architectural misalignments between the frontend Zustand stores and backend Firebase/Firestore data structures. The key issue is that the frontend maintains a hybrid persistence model where projects and app state are stored locally in localStorage, while storyboards and scenes are stored in Firebase. This creates several data consistency challenges:

1. **Creative Brief Storage**: Frontend expects objects, backend stores strings
2. **Project Management**: Entirely frontend-only with no backend representation
3. **State Synchronization**: Mix of SSE, polling, and manual sync patterns
4. **Naming Conventions**: Mixed camelCase and snake_case in frontend
5. **Type Safety**: Missing TypeScript interfaces for job polling responses

## Detailed Findings

### 1. Frontend Store Architecture

The frontend uses three main Zustand stores:

#### appStore (frontend/store/appStore.ts)
- **Purpose**: Global application state for current session
- **Persistence**: NOT persisted directly, saved via project snapshots
- **Key Data**:
  - `currentStep`: Pipeline navigation (CHAT, MOOD, SCENES, FINAL)
  - `creativeBrief`: Structured creative brief object
  - `moods`: Array of mood board options
  - `selectedMoodId`: Selected mood identifier
  - `storyboardCompleted`: Completion flag
  - `audioUrl`, `compositionJobId`, `finalVideo`: Final composition data

#### projectStore (frontend/store/projectStore.ts)
- **Purpose**: Manages project CRUD and persistence
- **Persistence**: localStorage key `'jant-vid-pipe-projects'`
- **Key Data**:
  - `projects`: Array of Project objects with embedded `appState` snapshots
  - `currentProjectId`: Active project identifier
  - Auto-save mechanism with 1500ms debounce
  - Project names auto-generated as "Project 1", "Project 2", etc.

#### sceneStore (frontend/store/sceneStore.ts)
- **Purpose**: Manages storyboard and scene state
- **Persistence**: NOT persisted, loaded from backend on demand
- **Key Data**:
  - `storyboard`: Current storyboard from Firebase
  - `scenes`: Array of scene objects
  - `sseConnection`: EventSource for real-time updates
  - Scene state transitions: text → image → video

### 2. Backend Firebase Structure

#### Firestore Collections

**storyboards** (Root collection)
- `storyboard_id`: UUID primary key
- `user_id`: Clerk authentication ID
- `creative_brief`: String (not object)
- `selected_mood`: Generic dict (not typed Mood)
- `scene_order`: Ordered array of scene IDs
- `total_duration`: Sum of scene durations (missing in frontend)

**scenes** (Subcollection: storyboards/{id}/scenes)
- `id`: UUID primary key
- `storyboard_id`: Foreign key to parent
- `state`: Literal["text", "image", "video"]
- `generation_status`: Object with image/video status
- `use_product_composite`, `product_id`: Product compositing
- All timestamps, URLs, and error states

**Job Collections** (For async processing)
- `image_generation_jobs`: Image generation via Replicate
- `video_generation_jobs`: Video generation via Replicate
- `composition_jobs`: Final video composition
- `video_jobs`: Multi-scene batch video generation
- All triggered by Cloud Functions on document creation

### 3. Key Data Structure Misalignments

#### Storyboard Model Differences

**Frontend** (types/storyboard.types.ts):
```typescript
interface Storyboard {
  storyboard_id: string;
  session_id: string;  // ⚠️ Frontend only
  creative_brief: CreativeBriefInput;  // ⚠️ Object type
  selected_mood: Mood;  // ⚠️ Full Mood object
  // Missing: total_duration
}
```

**Backend** (models/storyboard_models.py):
```python
class Storyboard:
  storyboard_id: str
  creative_brief: str  # ⚠️ String, not object
  selected_mood: dict  # ⚠️ Generic dict
  total_duration: float  # ⚠️ Backend only
  # Missing: session_id
```

#### Creative Brief Handling

**Frontend Types**:
- `CreativeBrief`: Includes `conversation_history` field
- `CreativeBriefInput`: Without conversation history (matches backend)

**Backend**:
- Only has `CreativeBriefInput` type
- Stores as string in Storyboard model, not structured object

#### Project Management

**Frontend Only**:
```typescript
interface Project {
  id: string;
  name: string;
  createdAt: string;  // ⚠️ camelCase
  updatedAt: string;  // ⚠️ camelCase
  storyboardId?: string;  // ⚠️ Reference only
  appState: AppStateSnapshot;
}
```

**Backend**: No project concept exists

#### Naming Convention Issues

- API types use `snake_case` (matching backend)
- Project types use `camelCase` (frontend-only)
- Creates inconsistency in frontend codebase

### 4. Data Flow Patterns

#### Pattern 1: Storyboard Creation
1. Frontend sends `StoryboardInitializeRequest` with object types
2. Backend converts creative_brief to string for storage
3. Backend stores mood as generic dict
4. Frontend receives and stores without type validation
5. JavaScript's dynamic typing masks the mismatch

#### Pattern 2: Real-Time Updates via SSE
1. Backend polls Firestore every 2 seconds
2. Detects changes by comparing with last known state
3. Sends SSE event only when state changes
4. Frontend applies updates via `handleSSEUpdate()`
5. 2-4 second latency from Firestore update to UI

#### Pattern 3: Job Status Polling
1. Backend creates job document in Firestore
2. Returns job_id immediately
3. Frontend polls status endpoint every 2-3 seconds
4. Cloud Function updates job document asynchronously
5. Polling stops at terminal state (completed/failed)

#### Pattern 4: Project Switching
1. Save current project to localStorage
2. Reset scene store completely (prevent cross-contamination)
3. Load new project from localStorage
4. Restore app state from snapshot
5. Fetch storyboard from Firebase if exists
6. Establish new SSE connection

### 5. State Synchronization Issues

#### No Optimistic Updates
- Frontend always waits for backend confirmation
- Loading flags provide UI feedback without data changes
- All state mutations go through backend first

#### SSE Connection Failures
- Browser EventSource auto-retries on network errors
- Custom 5-second retry on connection failure
- No automatic fallback to polling when SSE fails
- Manual polling only triggered if SSE null at page load

#### Race Conditions Identified

1. **Duplicate SSE Connections**: Rapid calls may create multiple connections
2. **Polling Interval Overlap**: Immediate poll runs parallel with first interval
3. **State Update During Unmount**: Protected by `isUnmountedRef` flag
4. **Job Creation Timing**: Polling starts before `setVideoJobId` completes
5. **SSE vs User Updates**: Last update wins, no conflict resolution
6. **Storyboard Initialization**: Early exit check may fail on simultaneous calls

#### Timing Issues

1. **Polling Before Job Exists**: 1-2 second delay for Cloud Function trigger
2. **SSE Lag**: 2-second polling interval causes update delays
3. **Lost State on Refresh**: Job status not persisted, must re-poll

### 6. Data Persistence Patterns

#### Persisted to localStorage
- Project list and metadata
- Current project ID
- App state snapshots (creative brief, moods, etc.)
- Storyboard ID references (not data)

#### Persisted to Firestore
- Storyboards and scenes
- Generated assets (images, videos)
- Job documents for async processing
- Product images and metadata

#### Never Persisted
- SSE connection state
- Active polling intervals
- In-progress job status (must re-poll)
- Scene generation progress

### 7. Critical Misalignment Impact

#### Data Consistency Issues
1. Creative brief type mismatch may cause runtime errors
2. Missing TypeScript interfaces reduce type safety
3. Project-storyboard one-way reference creates orphan risk
4. No backend validation of frontend-expected structures

#### User Experience Impact
1. SSE failures show stale data without user awareness
2. Page refresh loses job progress tracking
3. Mixed naming conventions confuse developers
4. No project backup/sync across devices

#### Development Friction
1. Type mismatches discovered at runtime
2. Debugging requires checking multiple data layers
3. State sync issues hard to reproduce
4. No single source of truth for project data

## Architecture Documentation

### Current Data Flow
```
Frontend (Browser)          Backend (FastAPI)         Cloud Services
┌─────────────────┐        ┌──────────────┐         ┌──────────────┐
│  localStorage   │        │   Firestore  │         │Cloud Function│
│  - Projects     │        │  - Storyboards│        │  - Process   │
│  - AppState     │◄──────►│  - Scenes    │◄────────│    Jobs      │
│                 │  API   │  - Jobs      │ Trigger │              │
│  Zustand Stores │  SSE   │  - Products  │         │  Firebase    │
│  - appStore     │        │              │         │   Storage    │
│  - projectStore │        │  No Project  │         │  - Images    │
│  - sceneStore   │        │   Concept    │         │  - Videos    │
└─────────────────┘        └──────────────┘         └──────────────┘
```

### State Synchronization Methods
- **SSE**: Storyboard scene updates (2-second backend polling)
- **Polling**: Video/composition jobs (2-3 second intervals)
- **Auto-save**: Project snapshots (1.5 second debounce)
- **Manual Load**: Storyboard fetch on project switch

## Related Research

This is the first comprehensive analysis of the frontend-backend data architecture for this project.

## Open Questions

1. Should projects be moved to backend for multi-device sync?
2. Should creative_brief remain as object throughout the system?
3. Should we standardize on snake_case naming convention?
4. Should we implement automatic SSE-to-polling fallback?
5. Should job status be persisted for page refresh recovery?
6. Should we add TypeScript interfaces for all backend responses?
7. Should we implement proper optimistic updates for better UX?
8. Should we add conflict resolution for concurrent updates?