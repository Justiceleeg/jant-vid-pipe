# Implementation Phases - Quick Fix Plan

## Phase 1: Fix Critical Breaks (45 min)
**Goal**: Get basic flow working end-to-end

### 1A. Fix Scene Initialization (15 min)
- Add auto-init to scenes page when scenes array is empty
- Call `projectsApi.initializeScenes()` in useEffect
- File: `frontend/app/project/[id]/scenes/page.tsx`

### 1B. Add Missing Endpoints (15 min)
- Add `/regenerate-text` and `/regenerate-image` endpoints
- Wire them up in `useProjectScenes` hook
- File: `backend/app/routers/projects.py`

### 1C. Full State Persistence with Option 3 (20 min)
- Add `app_state_snapshot: Optional[Dict[str, Any]]` to Project model
- Save ENTIRE appStore as JSON blob (catches all current and future fields!)
- Restore full state on project load
- Files: `backend/app/models/project_models.py`, `frontend/store/projectStore.ts`
- **This solves the drift problem permanently**

## Phase 2: Deploy & Test (30 min)
**Goal**: Get everything running

### 2A. Deploy Infrastructure (10 min)
```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

### 2B. Start Services (5 min)
```bash
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

### 2C. Smoke Test (15 min)
- Create project → Brief → Mood → Backgrounds → Scenes (MUST INITIALIZE!)
- Edit scene text → Generate image → Generate video
- Refresh page → Verify state persists

## Phase 3: Clean Up Confusion (30 min)
**Goal**: Remove competing systems

### 3A. Delete Storyboard System & Move Logic (30 min)
- Extract OpenAI scene generation logic from `storyboard_service.py`
- Move to new `project_service.py` or enhance existing
- Delete all `/api/storyboards` endpoints
- Delete `useStoryboard` hook
- Remove `initializeStoryboard` from sceneStore
- Delete storyboard files after extracting logic

### 3B. Document What Works (10 min)
- Update README with actual flow
- Note which features work vs pending

## Phase 4: Polish for Demo (30 min)
**Goal**: Fix remaining gaps if time allows

### 4A. Asset Storage Fixes
- Audio: Save to Firebase instead of temp URLs
- Verify videos save to Firebase
- Add background IDs to project model

### 4B. OpenAI Integration
- Make scene initialization actually call OpenAI
- Currently returns placeholder text

## Decisions Made:

1. **OpenAI Logic**: Move from storyboard_service to project service (cleaner architecture)

2. **Priority**: Full cleanup - make it clean and professional (all phases)

3. **Demo Requirements**: EVERYTHING must work
   - ✓ Scene generation with AI
   - ✓ Video generation
   - ✓ Real-time sync
   - ✓ Asset persistence
   - ✓ Full pipeline flow

## Time Estimate
- ~~Minimum viable: Phase 1-2 = 1.25 hours~~
- ~~Recommended: Phase 1-3 = 2 hours~~
- **Selected: Full implementation** = 2.5-3 hours
  - Includes moving OpenAI logic
  - Full storyboard system removal
  - Complete testing

## Next Step
Start with Phase 1A - fix scene initialization. This unblocks everything else.
