---
date: 2025-11-21T16:32:27-06:00
researcher: tombauer
git_commit: 7dcd21289dd16452b07e5b0727c144d02ba12f89
branch: tom-backend
repository: jant-vid-pipe
topic: "Backend-Frontend Integration Gaps Analysis"
tags: [research, codebase, integration, backend, frontend, firestore, projects]
status: complete
last_updated: 2025-11-21
last_updated_by: tombauer
---

# Research: Backend-Frontend Integration Gaps Analysis

**Date**: 2025-11-21T16:32:27-06:00
**Researcher**: tombauer
**Git Commit**: 7dcd21289dd16452b07e5b0727c144d02ba12f89
**Branch**: tom-backend
**Repository**: jant-vid-pipe

## Research Question

We were working through the frontend-backend data misalignment research and backend alignment plan. The user flow seems very broken right now, even though the endpoints are up and running. What was missed in the step of introducing this backend infrastructure to connect with our frontend flow?

## Summary

The research reveals that while the backend infrastructure for project-based operations has been implemented (Phase 1-5 of the plan), there are critical integration gaps causing the broken user flow:

1. **Dual Store Architecture Confusion**: The frontend has two competing state management systems - `projectStore.ts` (localStorage-based) and `firestoreProjectStore.ts` (Firestore-based). Components are using the localStorage-based store while the backend expects Firestore integration.

2. **Missing Project Integration in Core Workflow**: The scenes/storyboard workflow (`/project/{id}/scenes`) still uses legacy storyboard endpoints that don't integrate with the project document structure. The storyboard is created independently and only linked via `storyboardId` reference.

3. **Backend Service Bug**: The `generate_video` endpoint in `projects.py` has uninitialized `firestore_service` references (lines 299, 386), which would cause runtime errors when attempting to generate videos through the project API.

4. **Incomplete Cloud Function Integration**: While cloud functions for project-based operations exist (`project_functions.py`), the frontend workflow still triggers legacy storyboard-based cloud functions through the old API endpoints.

5. **Authentication Token Inconsistency**: Some API clients use Clerk authentication (`projects.ts`) while others don't (`client.ts` for moods/scenes), creating inconsistent auth behavior.

## Detailed Findings

### 1. State Management Architecture Mismatch

#### Current Implementation (`frontend/store/projectStore.ts`)
- Lines 393-408: Actively removes localStorage keys but still uses them internally
- Lines 271-323: Auto-saves to backend API but maintains local state snapshots
- Lines 98-151: Creates projects with temporary IDs, then replaces with backend IDs
- Lines 411-417: Subscribes to `appStore` changes for auto-save

#### Unused Implementation (`frontend/store/firestoreProjectStore.ts`)
- Lines 176-229: Sets up Firestore real-time listeners that aren't used
- Lines 474-519: Client-side auto-sync that's not activated
- Lines 82-139: Project creation from app state that doesn't run

**Impact**: Components use `projectStore` expecting localStorage persistence, but the backend expects direct Firestore integration. This creates a disconnect where project updates may not properly sync.

### 2. Storyboard/Scenes Workflow Not Integrated with Projects

#### Frontend Scene Operations (`frontend/app/project/[id]/scenes/page.tsx`)
- Lines 79-98: Initializes storyboard independently of project
- Uses `useStoryboard()` hook that calls legacy `/api/storyboards` endpoints
- Storyboard is only linked to project via `storyboardId` reference

#### Backend Legacy Endpoints (`backend/app/routers/storyboards.py`)
- Lines 45-85: `initialize_storyboard` creates separate storyboard documents
- Lines 439-498: Image generation uses `image_generation_jobs` collection
- Lines 569-633: Video generation uses `video_generation_jobs` collection
- These endpoints don't update the project document's scenes array

#### Backend Project Endpoints (`backend/app/routers/projects.py`)
- Lines 189-230: `add_scene` endpoint exists but isn't used by frontend
- Lines 274-360: `generate_video` for project scenes exists but has bugs
- Lines 363-435: `generate_composition` for project scenes exists but unused

**Impact**: The storyboard/scenes workflow operates completely independently from the project structure, defeating the purpose of the project-centric architecture.

### 3. Critical Backend Bugs

#### Uninitialized Service References (`backend/app/routers/projects.py`)
```python
# Line 299 - Missing initialization
if not firestore_service.get_project(project_id, user_id):  # firestore_service not defined!

# Line 386 - Same issue
if not firestore_service.get_project(project_id, user_id):  # firestore_service not defined!
```

**Fix Required**:
```python
firestore_service = get_firestore_service()  # Add this line before usage
```

**Impact**: Runtime error when attempting to use project-based video/composition generation endpoints.

### 4. Cloud Function Routing Issues

#### Legacy Cloud Functions Still Used (`functions/main.py`)
- `handle_image_generation` - Triggered by storyboard image jobs
- `handle_video_generation` - Triggered by storyboard video jobs
- Updates storyboard/scene documents, not project documents

#### Project Cloud Functions Exist But Unused (`functions/project_functions.py`)
- `generate_video_for_scene` - Should handle project-based video generation
- `generate_composition_for_scene` - Should handle project-based compositions
- These update project document scenes array as intended

**Impact**: Even if frontend called project endpoints, the cloud functions would update different document structures.

### 5. Authentication Inconsistencies

#### Authenticated API Client (`frontend/lib/api/projects.ts`)
- Lines 61-87: `getAuthToken()` retrieves Clerk token
- Lines 38-46: Includes `Authorization: Bearer {token}` header

#### Non-Authenticated API Client (`frontend/lib/api/client.ts`)
- Lines 19-25: No auth token retrieval
- Used for moods, scenes, audio APIs
- Line 22: Only sets `Content-Type: application/json`

**Impact**: Some operations fail silently due to missing authentication, while others work fine.

### 6. Mood Generation Integration Success

#### Working Implementation (`backend/app/routers/moods.py`)
- Lines 142-167: Successfully saves mood images to Firebase Storage
- Storage path: `projects/{project_id}/moods/{mood_id}/{image_id}.png`
- Frontend properly passes project_id parameter

**This is the only fully integrated project-based feature working end-to-end**.

### 7. Missing Frontend Integration Points

#### Projects Page (`frontend/app/projects/page.tsx`)
- Lines 47-67: Creates project and navigates to `/project/{id}/chat`
- ✅ Works correctly with backend

#### Chat Page (`frontend/app/project/[id]/chat/page.tsx`)
- Lines 23-24: Uses `useProject` hook to load project
- Lines 36-40: Syncs creative brief to app store
- ✅ Works correctly

#### Mood Page (`frontend/app/project/[id]/mood/page.tsx`)
- Lines 58-69: Auto-generates moods with project_id
- ✅ Works correctly with Firebase Storage

#### Scenes Page (`frontend/app/project/[id]/scenes/page.tsx`)
- ❌ **Does not use project API for scene operations**
- ❌ Uses legacy storyboard endpoints
- ❌ Doesn't update project document

### 8. Real-Time Update Mechanisms

#### SSE for Storyboards (Legacy)
- Backend polls Firestore every 2 seconds
- Frontend uses EventSource for updates
- Works but only for storyboard documents

#### Firestore Subscriptions for Projects (New)
- `subscribeToProject()` in `projects.ts`
- Would provide instant updates
- Not used for scene updates

**Impact**: Real-time updates work for legacy flow but not integrated with project updates.

## Architecture Documentation

### Current Broken Flow
```
Frontend                     Backend                      Firestore
────────                     ────────                      ─────────
Create Project ──────────► Projects API ────────────► projects/{id}
                               ✅                           ✅

Load Project ────────────► Projects API ────────────► projects/{id}
  (useProject)                 ✅                           ✅

Generate Moods ──────────► Moods API ────────────────► Firebase Storage
  (with project_id)            ✅                     projects/{id}/moods/
                                                            ✅

Initialize Storyboard ───► Storyboards API ──────────► storyboards/{id}
  (WITHOUT project!)           ❌                      scenes/{id}
                                                       (separate docs!)
                                                            ❌

Generate Images ─────────► Storyboards API ──────────► image_generation_jobs
                              ❌                        (legacy trigger)
                                                            ❌

Generate Videos ─────────► Storyboards API ──────────► video_generation_jobs
                              ❌                        (legacy trigger)
                                                            ❌
```

### Intended Flow (Per Plan)
```
Frontend                     Backend                      Firestore
────────                     ────────                      ─────────
Create Project ──────────► Projects API ────────────► projects/{id}
                               ✅                           ✅

Add Scenes ──────────────► Projects API ────────────► projects/{id}
                          /projects/{id}/scenes           scenes: [...]
                               🔧                           🔧

Generate Video ──────────► Projects API ────────────► projects/{id}
                   /projects/{id}/scenes/{sid}/           active_job: {...}
                        generate-video                         ↓
                               🔧                     video_generation_jobs
                                                      (triggers cloud func)
                                                              🔧
```

## Related Research

- `/Users/tombauer/workspace/github.com/TBau23/gauntlet/jant-vid-pipe/frontend-backend-data-misalignment-research.md` - Original misalignment analysis
- `/Users/tombauer/workspace/github.com/TBau23/gauntlet/jant-vid-pipe/BACKEND_ALIGNMENT_PLAN.md` - Implementation plan (partially completed)

## Critical Fixes Required

### 1. Fix Backend Service Bug (IMMEDIATE)
**File**: `backend/app/routers/projects.py`
**Lines**: 299, 386
**Fix**: Add `firestore_service = get_firestore_service()` before usage

### 2. Update Frontend Scenes Workflow (PRIORITY)
**Files**:
- `frontend/app/project/[id]/scenes/page.tsx`
- `frontend/hooks/useStoryboard.ts` (needs creation/update)

**Changes Required**:
- Use project API endpoints for scene operations
- Call `/api/projects/{id}/scenes` to add scenes
- Call `/api/projects/{id}/scenes/{sid}/generate-video` for videos
- Subscribe to project document for real-time updates

### 3. Activate Project Cloud Functions (REQUIRED)
**File**: `functions/main.py` or deployment configuration
**Action**: Ensure `project_functions.py` functions are registered:
- `generate_video_for_scene`
- `generate_composition_for_scene`

### 4. Consolidate State Management (RECOMMENDED)
**Action**: Choose one approach:
- Option A: Complete migration to `firestoreProjectStore.ts`
- Option B: Keep `projectStore.ts` but ensure it properly syncs with backend

### 5. Fix Authentication Consistency (IMPORTANT)
**File**: `frontend/lib/api/client.ts`
**Action**: Add Clerk authentication to all API calls

## Why the Flow is Broken

The core issue is that **the scenes/storyboard workflow was never migrated to use the new project-based backend infrastructure**. The implementation completed phases 1-5 of the plan but didn't update the most critical user-facing workflow - the actual video generation pipeline.

The system is currently running two parallel architectures:
1. **New**: Project-based with embedded scenes (partially implemented)
2. **Legacy**: Storyboard-based with separate documents (still in use)

The frontend creates projects correctly and saves moods to the right location, but then falls back to legacy storyboard endpoints for the core video generation workflow, completely bypassing the new project infrastructure.

## Next Steps

1. **Immediate**: Fix the backend service initialization bug
2. **Critical**: Update frontend scenes page to use project API endpoints
3. **Important**: Ensure cloud functions for projects are deployed and working
4. **Cleanup**: Remove or clearly mark legacy endpoints
5. **Testing**: End-to-end test of complete workflow using only project APIs

The good news is that most of the infrastructure is in place - it just needs to be properly connected. The mood generation integration proves the pattern works when properly implemented.