# The Storyboard vs Project System Overlap

## THE CRITICAL ISSUE

You have **TWO competing scene initialization systems** and **NEITHER IS BEING USED**!

### System 1: Legacy Storyboard (ORPHANED)
- **Endpoint**: `/api/storyboards/initialize`
- **Creates**: Separate `storyboards/{id}` and `scenes/{id}` documents in Firestore
- **Frontend Hook**: `useStoryboard()` (marked as DEPRECATED)
- **Store**: `sceneStore.initializeStoryboard()`
- **Status**: ❌ **NOT CALLED ANYWHERE IN FRONTEND**

### System 2: New Project System (INCOMPLETE)
- **Endpoint**: `/api/projects/{id}/scenes/initialize`  
- **Creates**: Scenes array within project document
- **Frontend Hook**: `useProjectScenes()`
- **API Method**: `projectsApi.initializeScenes()`
- **Status**: ❌ **NEVER CALLED IN FRONTEND**

## THE ACTUAL PROBLEM

When user navigates to `/project/{id}/scenes`:
1. Page loads and calls `useProjectScenes(projectId)`
2. Hook subscribes to Firestore project document
3. Finds `scenes: []` (empty array)
4. **Shows empty scene list - no initialization happens!**

There's literally NO code that calls either initialization system!

## How This Happened (Timeline Reconstruction)

1. **Original**: Storyboard system with separate documents
2. **Tom adds**: Project system with embedded scenes
3. **Migration attempt**: Created `useProjectScenes` to replace `useStoryboard`
4. **Critical mistake**: Removed the initialization call but didn't add it to new system
5. **Result**: Scenes page shows empty, users confused

## The Missing Link

Look at the flow:
```
Mood Page → handleContinue() → router.push('/project/{id}/backgrounds')
Backgrounds Page → handleContinue() → router.push('/project/{id}/scenes')
Scenes Page → useProjectScenes() → Shows whatever's in project.scenes (EMPTY!)
```

**NOWHERE** in this flow does anyone call:
- `projectsApi.initializeScenes(projectId)` OR
- `sceneStore.initializeStoryboard(...)`

## The Fix (30 minutes)

### Option A: Auto-Initialize on Empty (RECOMMENDED)
In `frontend/app/project/[id]/scenes/page.tsx`, add after line ~50:

```typescript
// Auto-initialize scenes if none exist
useEffect(() => {
  if (!isLoading && project && scenes.length === 0 && !isInitializing) {
    setIsInitializing(true);
    projectsApi.initializeScenes(projectId)
      .then(() => {
        addToast({ type: 'success', message: 'Scenes initialized!' });
      })
      .catch((err) => {
        addToast({ type: 'error', message: 'Failed to initialize scenes' });
      })
      .finally(() => setIsInitializing(false));
  }
}, [project, scenes, isLoading]);
```

### Option B: Initialize After Background Selection
In `frontend/app/project/[id]/backgrounds/page.tsx`, modify `handleContinue`:

```typescript
const handleContinue = async () => {
  // Save backgrounds
  if (project && selectedBackgroundIds.length > 0) {
    await updateProject(projectId, {
      backgroundAssetIds: selectedBackgroundIds,
    });
  }
  
  // Initialize scenes before navigating
  try {
    await projectsApi.initializeScenes(projectId);
  } catch (err) {
    console.error('Failed to initialize scenes:', err);
  }
  
  // Navigate to scenes
  setCurrentStep(STEPS.SCENES);
  router.push(`/project/${projectId}/scenes`);
};
```

### Option C: Manual Initialize Button
Show a "Generate Scenes" button when scenes array is empty.

## Backend Changes Needed

The `/api/projects/{id}/scenes/initialize` endpoint exists but needs to:

1. **Use the creative brief and mood from project**
2. **Actually call OpenAI** (currently returns placeholder data)
3. **Generate proper scene descriptions**

Current code (line 329 in projects.py):
```python
# TODO: Call OpenAI to generate scene descriptions
# For now, create placeholder scenes with basic structure
```

## Cleanup Actions

### 1. Remove Storyboard System Entirely
```bash
# Backend
rm backend/app/routers/storyboards.py
rm backend/app/services/storyboard_service.py
rm backend/app/models/storyboard_models.py

# Frontend
rm frontend/hooks/useStoryboard.ts
rm -rf frontend/components/storyboard/
# Remove initializeStoryboard from sceneStore.ts
```

### 2. OR Keep as Fallback (Not Recommended)
If you want to keep both systems, at least pick ONE to use consistently.

## The Real Architecture Should Be

```
Project Document
├── id
├── name
├── storyboard (embedded)
│   ├── creative_brief
│   └── selected_mood
├── scenes[] (embedded array)
│   ├── id
│   ├── description
│   ├── assets
│   └── active_job
├── background_ids[]  # Add this
└── stats
```

**ONE document, ONE source of truth, NO separate storyboard documents.**

## Decision Required

**Question for you**: Should we:
1. **Fix and use the project system** (recommended - cleaner architecture)
2. **Revert to storyboard system** (not recommended - adds complexity)
3. **Keep both** (worst option - maximum confusion)

## Time Estimate

- **Option 1 (Project system)**: 30 min to add initialization + 30 min to test
- **Option 2 (Storyboard system)**: 1 hour to reconnect everything
- **Option 3 (Both)**: Don't do this

## My Strong Recommendation

1. **Add auto-initialization to scenes page** (Option A above)
2. **Delete all storyboard code**
3. **Make sure the OpenAI integration actually works**
4. **Test the complete flow**

This gets you to ONE clear system with no confusion.
