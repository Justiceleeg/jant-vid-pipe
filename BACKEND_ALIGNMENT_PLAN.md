# Backend Data Alignment Implementation Plan

## Current Status: Phase 6 🚧 IN PROGRESS (Critical Fixes Applied)

### Progress Summary
- ✅ **Phase 1**: Project Data Model & Firestore Setup - COMPLETED
- ✅ **Phase 2**: Backend API Endpoints - COMPLETED
- ✅ **Phase 3**: Frontend API Integration Layer - COMPLETED
- ✅ **Phase 4**: Cloud Functions & Job Processing - COMPLETED
- ✅ **Phase 5**: State Management & UI Updates - COMPLETED
- 🚧 **Phase 6**: Migration & Cleanup - IN PROGRESS

### Critical Issues Identified
1. **✅ FIXED: Mood board images not persisting to Firebase Storage**
   - Updated `/api/moods/generate` to accept `project_id` parameter
   - Implemented Firebase Storage upload for all mood images
   - Path structure: `projects/{project_id}/moods/{mood_id}/{image_id}.png`
   - Frontend updated to pass project ID when generating moods

2. **🟡 Authentication: Fixed but needs verification**
   - Frontend now sends Clerk tokens correctly
   - Project creation now calls backend API properly

3. **🟢 Understood: Replicate polling is normal behavior**
   - SDK polls until generation completes
   - Consider adding progress UI for better UX

4. **🟡 Partial Coverage: Asset Storage Status**
   - ✅ Video generation: Cloud functions save to Firebase Storage
   - ✅ Image generation: Cloud functions save to Firebase Storage
   - ✅ Mood images: Backend now saves to Firebase Storage
   - ⚠️ Audio generation: Still returns temporary Replicate URLs
   - ⚠️ Composition assets: Need verification

## Executive Summary
This plan addresses the critical data misalignment issues between frontend and backend systems identified in the research document. The core solution moves from a mixed localStorage/backend architecture to a unified Firestore-based system where Projects are the primary entity containing all related data.

## Problem Statement
Based on the research in `frontend-backend-data-misalignment-research.md`, key issues include:
- Data type mismatches (creative brief as string vs object)
- Projects only exist in frontend localStorage (no persistence)
- Mixed state synchronization patterns (SSE, polling, manual sync)
- Inconsistent naming conventions (camelCase vs snake_case)
- Job status lost on page refresh
- No proper association between cloud function outputs and projects/scenes

## Solution Architecture

### Core Principle: Project-Centric Data Model
All data lives within a single Project document in Firestore, eliminating synchronization issues and providing a single source of truth.

### Final Project Structure
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;

  // Embedded storyboard (no longer separate)
  storyboard: {
    id: string;
    title: string;
    creative_brief: {  // Properly typed as object
      brand_name: string;
      product_description: string;
      target_audience: string;
      key_message: string;
      tone: string;
      additional_notes?: string;
    };
    selected_mood: {  // Properly typed as Mood object
      id: string;
      name: string;
      description: string;
      visual_style: string;
      color_palette: string[];
      mood_keywords: string[];
    };
  };

  // Scenes as array (no reordering complexity for now)
  scenes: Array<{
    id: string;  // UUID for cloud function reference
    scene_number: number;
    title: string;
    description: string;
    duration_seconds: number;

    // Generated assets (Firebase Storage paths, not full URLs)
    assets: {
      composition_path?: string;
      video_path?: string;
      audio_path?: string;
      thumbnail_path?: string;
      generated_at?: Timestamp;
    };

    // Current active job (only track current, not history)
    active_job?: {
      job_id: string;
      type: 'composition' | 'video' | 'audio';
      status: 'queued' | 'processing' | 'completed' | 'failed';
      progress: number;  // 0-100 for smooth UI updates
      started_at: Timestamp;
      last_update: Timestamp;  // For stale job detection
      error_message?: string;
    };

    // AI-generated composition
    composition?: {
      description: string;
      styling: string;
      animation: string;
      generated_at: Timestamp;
    };
  }>;

  // Project-level stats for monitoring
  stats: {
    total_scenes: number;
    completed_scenes: number;
    last_activity: Timestamp;
  };
}
```

### Key Architecture Decisions

1. **Everything in Firestore**: Projects, storyboards, scenes, job status - all in one place
2. **Real-time listeners**: Replace polling/SSE with Firestore's built-in real-time updates
3. **Cloud functions write directly to projects**: No separate job tracking system
4. **Asset paths, not URLs**: Store Firebase Storage paths, generate signed URLs as needed
5. **Simple scene array**: No complex reordering logic for now (can be added later)
6. **Single active job per scene**: Simplifies tracking, supports concurrent generation across scenes

## Implementation Phases

### Phase 1: Firestore Schema & Security Rules (Day 1)

**Objectives:**
- [x] Define complete TypeScript/Python data models
- [x] Set up Firestore security rules
- [x] Create necessary indexes

**Key Files to Create/Modify:**
```
shared/types/firestore-schema.ts  (NEW) - ✅ Created
firestore.rules                   (MODIFY) - ✅ Updated
firestore.indexes.json           (MODIFY) - ✅ Updated
backend/app/models/project_models.py (NEW) - ✅ Created
```

**Automated Verification:**
- [x] TypeScript models compile without errors
- [x] Python models compile without errors
- [x] Firestore rules syntax is valid
- [x] Firestore indexes JSON is valid

**Manual Verification Required:**
- [x] Deploy Firestore rules to Firebase Console (`firebase deploy --only firestore:rules`) - ✅ Completed
- [x] Deploy Firestore indexes to Firebase Console (`firebase deploy --only firestore:indexes`) - ✅ Completed
- [ ] Verify authentication is properly configured in Firebase Console (deferred)
- [ ] Test security rules in Firebase Console Rules Playground (deferred)

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.user_id;
    }
  }
}
```

### Phase 2: Backend API Refactoring (Day 2) - ✅ COMPLETED

**Objectives:**
- [x] Create new project-centric API endpoints
- [x] Implement proper data models with Pydantic
- [ ] Remove old storyboard-only endpoints (deferred for legacy support)

**New Endpoints:**
```
POST   /api/projects                                    - Create project - ✅ Implemented
GET    /api/projects                                   - List user projects - ✅ Implemented
GET    /api/projects/{project_id}                      - Get complete project - ✅ Implemented
PATCH  /api/projects/{project_id}                      - Update project - ✅ Implemented
POST   /api/projects/{project_id}/scenes               - Add scene - ✅ Implemented
PATCH  /api/projects/{project_id}/scenes/{scene_id}    - Update specific scene - ✅ Implemented
POST   /api/projects/{project_id}/scenes/{scene_id}/generate-video  - Trigger generation - ✅ Implemented
POST   /api/projects/{project_id}/scenes/{scene_id}/generate-composition - Trigger composition - ✅ Implemented
DELETE /api/projects/{project_id}                      - Delete project - ✅ Implemented
```

**Key Files:**
```
backend/app/models/project_models.py  (NEW) - ✅ Created
backend/app/routers/projects.py       (NEW) - ✅ Created
backend/app/services/firestore_service.py (NEW) - ✅ Created
backend/app/main.py                   (MODIFIED) - ✅ Updated
backend/app/routers/storyboards.py    (DELETE after migration) - ⏳ Kept for legacy support
backend/app/routers/sse.py           (DELETE) - ⏳ To be removed after testing
```

**Automated Verification:**
- [x] Python models compile without errors
- [x] API router imports correctly
- [x] Firestore service module compiles
- [x] Main app includes new routes

**Manual Verification Required:**
- [ ] Start backend server and test endpoints with curl/Postman
- [ ] Test project creation endpoint
- [ ] Test project retrieval endpoints
- [ ] Test scene management endpoints
- [ ] Test video generation triggers
- [ ] Verify Firestore document structure in Firebase Console

### Phase 3: Frontend TypeScript & API Layer (Day 3) - ✅ COMPLETED

**Objectives:**
- [x] Create TypeScript interfaces matching backend
- [x] Implement API client with proper type conversion
- [x] Create React hooks for project management

**Key Components:**
```typescript
// Core API client structure
projectsApi = {
  create(data): Promise<Project>
  get(id): Promise<Project>
  update(id, data): Promise<Project>
  subscribe(id, callback): Unsubscribe  // Real-time listener
  updateScene(projectId, sceneId, data): Promise<void>
  generateVideo(projectId, sceneId): Promise<{jobId}>
}
```

**Key Files:**
```
frontend/types/project.ts        (NEW) - ✅ Created
frontend/lib/api/projects.ts     (NEW) - ✅ Created
frontend/hooks/useProject.ts     (NEW) - ✅ Created
frontend/lib/caseConversion.ts   (NEW) - ✅ Created
```

**Automated Verification:**
- [x] TypeScript interfaces compile without errors
- [x] API client compiles without errors
- [x] React hooks compile without errors
- [x] Case conversion utilities compile without errors

**Manual Verification Required:**
- [ ] Test API client with backend endpoints
- [ ] Test case conversion between snake_case and camelCase
- [ ] Test React hooks in a component
- [ ] Verify real-time subscription setup (placeholder for now)

### Phase 4: Cloud Functions Integration (Day 4) - ✅ COMPLETED

**Objectives:**
- [x] Update cloud functions to write directly to project documents
- [x] Implement progress updates
- [x] Handle errors properly

**Cloud Function Pattern:**
```python
def generate_video_for_scene(project_id, scene_id, job_id):
    # 1. Update project doc: job status = 'processing'
    # 2. Generate video with progress updates to project doc
    # 3. Upload to Firebase Storage
    # 4. Update project doc: add video_path, job status = 'completed'
    # 5. On error: Update project doc with error status
```

**Key Files:**
```
functions/project_functions.py                     (NEW) - ✅ Created
functions/services/project_firestore_client.py     (NEW) - ✅ Created
functions/services/openai_handler.py               (MODIFIED) - ✅ Updated
functions/services/firebase_storage_service.py     (MODIFIED) - ✅ Updated
backend/app/services/cloud_functions.py            (NEW) - ✅ Created
backend/app/routers/projects.py                    (MODIFIED) - ✅ Updated
```

**Automated Verification:**
- [x] Python cloud functions compile without errors
- [x] Project Firestore client compiles without errors
- [x] Backend cloud function trigger service compiles without errors
- [x] OpenAI handler with composition generation compiles without errors

**Manual Verification Required:**
- [ ] Deploy cloud functions to Firebase
- [ ] Test video generation trigger from backend
- [ ] Test composition generation trigger from backend
- [ ] Verify progress updates in Firestore
- [ ] Test error handling and recovery

### Phase 5: Redux State Management & UI Updates (Day 5) - ✅ COMPLETED

**Objectives:**
- [x] Update Redux store for project-centric state (Note: Project uses Zustand, not Redux)
- [x] Implement real-time listeners in components
- [x] Remove all localStorage usage

**Actual Implementation (Zustand instead of Redux):**
- [x] Created Firebase configuration and setup
- [x] Implemented real-time Firestore subscriptions in API layer
- [x] Updated useProject hook to use real-time subscriptions
- [x] Removed localStorage persistence from projectStore
- [x] Updated projectStore to sync with backend API

**Key Files Created/Modified:**
```
frontend/lib/firebase/config.ts (NEW) - ✅ Created
frontend/store/firestoreProjectStore.ts (NEW) - ✅ Created
frontend/hooks/useFirestoreProject.ts (NEW) - ✅ Created
frontend/lib/api/projects.ts (MODIFIED) - ✅ Updated with real-time subscriptions
frontend/hooks/useProject.ts (MODIFIED) - ✅ Updated to use real-time subscriptions
frontend/store/projectStore.ts (MODIFIED) - ✅ Removed localStorage persistence
```

**Automated Verification:**
- [x] TypeScript compiles without errors
- [x] Firebase SDK installed and configured
- [x] Real-time subscriptions implemented in API layer
- [x] localStorage persistence removed from projectStore

**Manual Verification Required:**
- [ ] Test Firebase connection with valid credentials
- [ ] Test real-time updates across multiple browser tabs
- [ ] Test project creation and updates sync to Firestore
- [ ] Verify old localStorage data is cleaned up
- [ ] Test page refresh maintains state through Firestore

### Phase 6: Migration & Cleanup (Day 6) - IN PROGRESS

**Objectives:**
- Remove all deprecated code
- Update remaining components
- Fix identified issues
- Comprehensive testing

**Identified Issues to Fix:**
1. **Authentication Issues:**
   - [x] Fixed: Frontend wasn't sending auth tokens
   - [x] Fixed: Project creation wasn't calling backend API
   - [ ] Remaining: Verify Clerk token format matches backend expectations

2. **Asset Storage Issue:**
   - [x] **Mood images now being saved to Firebase Storage**
     - Updated `/api/moods/generate` to accept project_id and save images
     - Images saved to `projects/{project_id}/moods/{mood_id}/{image_id}.png`
     - Frontend updated to pass project ID
   - [x] Verified video assets are saved by cloud functions
   - [x] Verified image assets are saved by cloud functions
   - [ ] Audio generation still returns temporary URLs - needs fixing
   - [ ] Composition asset storage needs verification

3. **Replicate API Polling:**
   - [x] Understood: Continuous polling is expected behavior from Replicate SDK
   - [ ] Consider: Add progress UI to show generation status
   - [ ] Optional: Reduce httpx logging verbosity in backend

**Code to Remove:**
- [x] localStorage project management (removed from projectStore)
- [ ] SSE endpoints and listeners
- [ ] Old polling mechanisms (replaced by Firestore listeners)
- [ ] Old storyboard-only APIs (kept for legacy support)
- [ ] Separate job tracking systems

**Testing Checklist:**
- [ ] Create project with full storyboard
- [ ] Generate mood boards and verify images persist in Firebase Storage
- [ ] Generate assets for multiple scenes concurrently
- [ ] Verify real-time updates across browser tabs
- [ ] Test page refresh maintains all state
- [ ] Verify proper error handling
- [ ] Test with multiple users simultaneously
- [ ] Confirm no data loss scenarios
- [ ] Verify all Replicate assets (images, videos) are saved to Firebase Storage

## Next Steps (Priority Order)

### 1. Fix Mood Board Image Storage (CRITICAL)
Update `/api/moods/generate` endpoint to:
```python
# After generating each image via Replicate
storage_service = get_storage_service()
for mood in moods:
    for i, image in enumerate(mood.images):
        if image.url:  # If Replicate generated successfully
            firebase_url = await storage_service.upload_from_url(
                url=image.url,
                path=f"projects/{project_id}/moods/{mood.id}/{uuid.uuid4()}.png",
                content_type="image/png"
            )
            image.url = firebase_url  # Replace temporary URL with permanent one
```

### 2. Verify All Asset Storage
Check that these endpoints also save to Firebase Storage:
- `/api/storyboards/{id}/generate-images` - Scene images
- `/api/video/generate` - Video generation
- `/api/composition/generate` - Composition assets
- `/api/audio/generate` - Audio files

### 3. Complete Phase 6 Cleanup
- Remove SSE endpoints if no longer needed
- Clean up old polling mechanisms
- Remove deprecated storyboard-only APIs
- Consolidate job tracking systems

### 4. Add Progress UI
- Show generation progress for Replicate jobs
- Display upload progress for Firebase Storage
- Add loading states for all async operations

### 5. Comprehensive Testing
- Test full project creation flow
- Verify assets persist after Replicate URLs expire
- Test multi-user scenarios
- Verify real-time updates work across tabs

## Technical Implementation Details

### Case Conversion Strategy
Use snake_case for all API communication, convert to camelCase in frontend:
```typescript
// Frontend API calls
const response = await fetch('/api/projects', {
  body: JSON.stringify(snakeCaseKeys(data))
});
return camelCaseKeys(await response.json());
```

### Real-time Listener Pattern
```typescript
// In React hook
useEffect(() => {
  const unsubscribe = firestore
    .collection('projects')
    .doc(projectId)
    .onSnapshot((doc) => {
      const project = camelCaseKeys(doc.data());
      dispatch(setCurrentProject(project));
    });

  return () => unsubscribe();
}, [projectId]);
```

### Cloud Function Update Pattern
```python
# Direct Firestore update from cloud function
def update_scene_job_status(project_id, scene_id, updates):
    project_ref = db.collection('projects').document(project_id)
    project_doc = project_ref.get()
    scenes = project_doc.to_dict()['scenes']

    # Find and update specific scene
    for scene in scenes:
        if scene['id'] == scene_id:
            scene['active_job'] = {**scene.get('active_job', {}), **updates}
            break

    project_ref.update({
        'scenes': scenes,
        'updated_at': datetime.now()
    })
```

## Success Criteria

1. **Data Consistency**: All data types properly aligned between frontend/backend
2. **Persistence**: Complete project state persisted in Firestore
3. **Real-time Sync**: All updates reflect immediately across all clients
4. **Performance**: Support for concurrent operations (6+ simultaneous video generations)
5. **Reliability**: No data loss on refresh, navigation, or connection issues
6. **Developer Experience**: Clear TypeScript types throughout the codebase

## Risk Mitigation

- **Gradual Rollout**: Each phase can be tested independently
- **No Production Data**: Can freely modify schema without migration concerns
- **Firestore Transactions**: Use for critical updates to prevent race conditions
- **Error Boundaries**: Implement in UI to gracefully handle sync failures
- **Stale Job Detection**: Use last_update timestamp to identify stuck jobs

## Timeline

- **Day 1**: Firestore schema and rules
- **Day 2**: Backend API implementation
- **Day 3**: Frontend TypeScript and API layer
- **Day 4**: Cloud function integration
- **Day 5**: Redux and UI updates
- **Day 6**: Cleanup and testing

Total: 6 days of focused development

## Next Steps

1. Review and approve this plan
2. Set up development branch for changes
3. Begin with Phase 1: Firestore schema definition
4. Daily sync on progress and blockers
5. Incremental testing after each phase

## Notes

- Scene reordering intentionally excluded from this phase (add later if needed)
- No collaboration features in this phase (single user per project)
- Using simple active_job tracking (not full history) for simplicity
- Assets stored as paths, not full URLs, for better security control