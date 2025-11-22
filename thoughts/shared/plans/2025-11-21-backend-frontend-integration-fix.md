# Backend-Frontend Integration Fix Implementation Plan

## Overview

This plan addresses the critical integration gaps between the backend project-centric API and the frontend scenes workflow. While the backend infrastructure for project-based operations has been implemented (Projects API, cloud functions), the frontend scenes page still uses legacy storyboard endpoints, completely bypassing the new project architecture.

This fix will migrate the scenes workflow to use project API endpoints while maintaining the current state management approach (projectStore.ts + backend API + Firestore subscriptions).

**Related Research**: `/Users/tombauer/workspace/github.com/TBau23/gauntlet/jant-vid-pipe/backend-frontend-integration-gaps.md`

## Current State Analysis

### What Works ✅
- **Project Creation**: `frontend/app/projects/page.tsx` → Creates projects via backend API
- **Creative Brief**: `frontend/app/project/[id]/chat/page.tsx` → Loads and syncs to backend
- **Mood Generation**: `frontend/app/project/[id]/mood/page.tsx` → Generates moods with correct project_id, saves to Firebase Storage
- **Backend Projects API**: Lines 38-442 in `backend/app/routers/projects.py` → Full CRUD with auth
- **Project Cloud Functions**: `functions/project_functions.py` → Video/composition generation for project scenes

### What's Broken ❌
- **Scenes Page**: `frontend/app/project/[id]/scenes/page.tsx:79-86` → Uses `useStoryboard()` hook
- **Storyboard Hook**: `frontend/hooks/useStoryboard.ts` → Calls legacy `/api/storyboards` endpoints
- **Scene Operations**: All scene operations (text, image, video) bypass project API
- **Cloud Function Routing**: Legacy storyboard functions in `functions/main.py` still deployed

### Key Discoveries
- Backend project API endpoints exist and are correct (lines 189-442 in `projects.py`)
- Real-time Firestore subscriptions already implemented in `useProject` hook (lines 332-366)
- Mood generation proves the pattern works (lines 142-167 in `moods.py`)
- No backend service bug - was already fixed in `projects.py`
- Authentication is consistent across both API clients

## Desired End State

After this plan is complete:
1. Scenes page uses project API endpoints for ALL scene operations
2. Scene data stored in project document's `scenes` array (not separate storyboard docs)
3. Real-time updates via Firestore subscriptions (not SSE polling)
4. Cloud functions update project document scenes
5. Legacy storyboard functions removed/deprecated
6. Complete workflow: Create Project → Creative Brief → Mood → **Scenes** → Videos

### Verification
- Create new project through UI
- Complete creative brief and select mood
- Navigate to scenes page - scenes appear from project document
- Edit scene text - updates project via API
- Generate image - triggers project cloud function, updates project document
- Generate video - triggers project cloud function, updates project document
- All operations reflect in Firestore `projects/{id}` document
- No separate `storyboards/{id}` documents created

## What We're NOT Doing

1. ❌ Migrating to `firestoreProjectStore.ts` (keeping current state management)
2. ❌ Changing chat or mood pages (they already work correctly)
3. ❌ Migrating existing storyboard data (clean cutover acceptable)
4. ❌ Adding new features (strictly fixing broken integration)
5. ❌ Changing backend projects API structure (it's correct as-is)

## Implementation Approach

**Strategy**: Big-bang migration of scenes page (Approach A)
- Replace entire scenes workflow at once
- Lower risk since scenes page is already broken
- Cleaner than dual-system approach
- User is in active development (no production data)

**State Management**: Keep current hybrid approach (Option B)
- Frontend: Zustand store (`projectStore.ts`) for local state
- Backend: API as write layer with validation
- Firestore: Read layer with real-time subscriptions
- Proven to work for chat/mood pages

**Real-Time Updates**: Direct Firestore subscriptions (Option B)
- Same pattern as `useProject` hook
- No SSE polling needed
- More efficient and consistent

---

## Phase 1: Clean Up Legacy Code & Verify Deployment

### Overview
Remove or deprecate legacy storyboard cloud functions and verify project cloud functions are properly deployed and configured.

### Changes Required

#### 1. Mark Legacy Functions as Deprecated
**File**: `functions/main.py`

**Current State**: Lines 16-434 contain legacy storyboard functions:
- `handle_image_generation` (lines 16-136)
- `handle_video_generation` (lines 138-238)
- `handle_multi_video_generation` (lines 241-352)
- `handle_composition` (lines 355-434)

**Changes**: Add deprecation warnings to each function:

```python
@firestore_fn.on_document_created(
    document="image_generation_jobs/{job_id}",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1,
    max_instances=10,
    secrets=["REPLICATE_API_TOKEN", "OPENAI_API_KEY"]
)
def handle_image_generation(event: firestore_fn.Event) -> None:
    """
    DEPRECATED: This function is for legacy storyboard-based flow.
    Use project-based functions in project_functions.py instead.

    This function will be removed in a future release.
    """
    print("[DEPRECATED] handle_image_generation called - use project-based functions instead")
    print(f"[Image Generation] Function triggered for job {event.params['job_id']}")

    # ... rest of existing code
```

Repeat for all four legacy functions.

#### 2. Verify Project Functions Deployment
**File**: `firebase.json` or deployment configuration

**Action**: Ensure functions from `project_functions.py` are included:
- `generate_video_for_scene`
- `generate_composition_for_scene`
- `generate_videos_for_all_scenes`

**Verification Command**:
```bash
firebase deploy --only functions
```

#### 3. Add Enhanced Logging
**File**: `functions/project_functions.py`

**Changes**: Add detailed logging at key points (lines 42, 56, 89, etc.):

```python
# At line 42 (start of generate_video_for_scene)
print(f"[Video Generation] Starting job {event.params['job_id']}")
print(f"[Video Generation] Project: {project_id}, Scene: {scene_id}, User: {job_data.get('user_id')}")

# At line 89 (after video generation)
print(f"[Video Generation] Replicate completed. Video URL: {video_url[:50]}...")

# At line 147 (completion)
print(f"[Video Generation] Successfully completed job {job_id}")
print(f"[Video Generation] Updated project {project_id}, scene {scene_id}")
```

### Success Criteria

#### Automated Verification:
- [ ] Cloud functions deploy successfully: `firebase deploy --only functions`
- [ ] No deployment errors in console output
- [ ] All function files compile without Python errors: `python -m py_compile functions/*.py`

#### Manual Verification:
- [ ] Open Firebase Console → Functions section
- [ ] Verify `generate_video_for_scene` function is listed and active
- [ ] Verify `generate_composition_for_scene` function is listed and active
- [ ] Check function logs show deprecation warnings when legacy functions trigger
- [ ] Verify no import/syntax errors in deployed functions

**Implementation Note**: Complete this phase first to ensure backend infrastructure is ready before frontend changes.

---

## Phase 2: Create Project Scenes Hook

### Overview
Build a new React hook that wraps project API scene operations with real-time Firestore updates. This provides the same interface as `useStoryboard` but uses project-centric endpoints.

### Changes Required

#### 1. Create New Hook File
**File**: `frontend/hooks/useProjectScenes.ts` (NEW FILE)

**Implementation**:

```typescript
/**
 * Project Scenes Hook
 *
 * Manages scene operations using project-centric API endpoints
 * with real-time Firestore subscriptions for scene updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToProject } from '@/lib/api/projects';
import type { Project, Scene, UpdateSceneRequest } from '@/types/project';
import { projectsApi } from '@/lib/api/projects';

interface UseProjectScenesState {
  scenes: Scene[];
  isLoading: boolean;
  isSaving: boolean;
  isRegeneratingAll: boolean;
  error: string | null;
}

interface UseProjectScenesReturn extends UseProjectScenesState {
  // Scene text operations
  approveText: (sceneId: string) => Promise<void>;
  regenerateText: (sceneId: string) => Promise<void>;
  editText: (sceneId: string, newText: string) => Promise<void>;

  // Scene image operations
  approveImage: (sceneId: string) => Promise<void>;
  regenerateImage: (sceneId: string) => Promise<void>;

  // Scene video operations
  regenerateVideo: (sceneId: string) => Promise<void>;
  updateDuration: (sceneId: string, duration: number) => Promise<void>;

  // Bulk operations
  regenerateAllScenes: () => Promise<void>;

  // Utilities
  setError: (error: string | null) => void;
}

export function useProjectScenes(projectId: string): UseProjectScenesReturn {
  const [state, setState] = useState<UseProjectScenesState>({
    scenes: [],
    isLoading: true,
    isSaving: false,
    isRegeneratingAll: false,
    error: null,
  });

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Set up real-time Firestore subscription
  useEffect(() => {
    if (!projectId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Subscribe to project updates for real-time scene changes
    subscriptionRef.current = subscribeToProject(projectId, (project: Project) => {
      setState(prev => ({
        ...prev,
        scenes: project.scenes || [],
        isLoading: false,
      }));
    });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [projectId]);

  // Approve text and trigger image generation
  const approveText = useCallback(async (sceneId: string) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      // Update scene to mark text as approved
      await projectsApi.updateScene(projectId, sceneId, {
        textApproved: true,
      });

      // TODO: Trigger image generation
      // Will be implemented when image generation endpoint is added

      setState(prev => ({ ...prev, isSaving: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve text';
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }));
      throw error;
    }
  }, [projectId]);

  // Regenerate scene text
  const regenerateText = useCallback(async (sceneId: string) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      // TODO: Add regenerate text endpoint to backend
      // For now, this is a placeholder
      console.log('[useProjectScenes] regenerateText not yet implemented:', sceneId);

      setState(prev => ({ ...prev, isSaving: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate text';
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }));
      throw error;
    }
  }, [projectId]);

  // Edit scene text
  const editText = useCallback(async (sceneId: string, newText: string) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      await projectsApi.updateScene(projectId, sceneId, {
        description: newText,
      });

      setState(prev => ({ ...prev, isSaving: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update text';
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }));
      throw error;
    }
  }, [projectId]);

  // Approve image and trigger video generation
  const approveImage = useCallback(async (sceneId: string) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      // Trigger video generation via project API
      await projectsApi.generateVideo(projectId, sceneId);

      setState(prev => ({ ...prev, isSaving: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate video';
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }));
      throw error;
    }
  }, [projectId]);

  // Regenerate scene image
  const regenerateImage = useCallback(async (sceneId: string) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      // TODO: Add regenerate image endpoint to backend
      console.log('[useProjectScenes] regenerateImage not yet implemented:', sceneId);

      setState(prev => ({ ...prev, isSaving: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate image';
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }));
      throw error;
    }
  }, [projectId]);

  // Regenerate video for scene
  const regenerateVideo = useCallback(async (sceneId: string) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      await projectsApi.generateVideo(projectId, sceneId);

      setState(prev => ({ ...prev, isSaving: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate video';
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }));
      throw error;
    }
  }, [projectId]);

  // Update scene duration
  const updateDuration = useCallback(async (sceneId: string, duration: number) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      await projectsApi.updateScene(projectId, sceneId, {
        durationSeconds: duration,
      });

      setState(prev => ({ ...prev, isSaving: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update duration';
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }));
      throw error;
    }
  }, [projectId]);

  // Regenerate all scenes
  const regenerateAllScenes = useCallback(async () => {
    setState(prev => ({ ...prev, isRegeneratingAll: true, error: null }));
    try {
      // TODO: Add bulk regeneration endpoint or iterate through scenes
      console.log('[useProjectScenes] regenerateAllScenes not yet implemented');

      setState(prev => ({ ...prev, isRegeneratingAll: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate all scenes';
      setState(prev => ({ ...prev, error: errorMessage, isRegeneratingAll: false }));
      throw error;
    }
  }, [projectId]);

  // Set error manually
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  return {
    ...state,
    approveText,
    regenerateText,
    editText,
    approveImage,
    regenerateImage,
    regenerateVideo,
    updateDuration,
    regenerateAllScenes,
    setError,
  };
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] Frontend builds successfully: `npm run build`

#### Manual Verification:
- [ ] Hook can be imported without errors: `import { useProjectScenes } from '@/hooks/useProjectScenes'`
- [ ] No TypeScript errors in IDE/editor
- [ ] Hook exports all expected functions
- [ ] Real-time subscription connects (check browser console for Firestore connection)

**Implementation Note**: This phase builds the infrastructure without modifying existing pages. Test by temporarily importing the hook in a test component.

---

## Phase 3: Migrate Scenes Page to Project API

### Overview
Replace the scenes page implementation to use the new `useProjectScenes` hook and project API endpoints. This is the core fix that resolves the integration gap.

### Changes Required

#### 1. Update Scenes Page Component
**File**: `frontend/app/project/[id]/scenes/page.tsx`

**Current Issues**:
- Lines 6: Imports `useStoryboard` from legacy hook
- Lines 45-62: Uses storyboard store state
- Lines 67-86: Initializes storyboard independently of project
- Lines 92-233: All handlers call storyboard operations

**Changes**:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StoryboardCarousel } from '@/components/storyboard';
import { useProjectScenes } from '@/hooks/useProjectScenes';  // CHANGED: Import new hook
import { useProject } from '@/hooks/useProject';  // CHANGED: Use project hook
import { useAppStore } from '@/store/appStore';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { STEPS } from '@/lib/steps';

function ScenesPageContent() {
  const { addToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  // App-level state
  const { creativeBrief, moods, selectedMoodId, setCurrentStep, setStoryboardCompleted } = useAppStore();

  // CHANGED: Use project hook to get project data
  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);

  // CHANGED: Use new project scenes hook
  const {
    scenes,
    isLoading,
    isSaving,
    isRegeneratingAll,
    error,
    approveText,
    regenerateText,
    editText,
    approveImage,
    regenerateImage,
    updateDuration,
    regenerateVideo,
    regenerateAllScenes,
    setError,
  } = useProjectScenes(projectId);

  // Handle project loading errors
  useEffect(() => {
    if (projectError) {
      console.error('[ScenesPage] Failed to load project:', projectError);
      router.push('/projects');
    }
  }, [projectError, router]);

  // REMOVED: Storyboard initialization logic (lines 67-86)
  // Scenes now come directly from project document via useProjectScenes hook

  // Handle operations with toast feedback
  const handleApproveText = async (sceneId: string) => {
    try {
      await approveText(sceneId);
      addToast({
        type: 'success',
        message: 'Image generation started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate image',
        duration: 5000,
      });
    }
  };

  const handleRegenerateText = async (sceneId: string) => {
    try {
      await regenerateText(sceneId);
      addToast({
        type: 'success',
        message: 'Scene text regenerated',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate text',
        duration: 5000,
      });
    }
  };

  const handleEditText = async (sceneId: string, newText: string) => {
    try {
      await editText(sceneId, newText);
      addToast({
        type: 'success',
        message: 'Scene text updated',
        duration: 3000,
      });
    } catch (error) {
      let errorMessage = 'Failed to update text';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleApproveImage = async (sceneId: string) => {
    try {
      await approveImage(sceneId);
      addToast({
        type: 'success',
        message: 'Video generation started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate video',
        duration: 5000,
      });
    }
  };

  const handleRegenerateImage = async (sceneId: string) => {
    try {
      await regenerateImage(sceneId);
      addToast({
        type: 'success',
        message: 'Image regeneration started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate image',
        duration: 5000,
      });
    }
  };

  const handleUpdateDuration = async (sceneId: string, newDuration: number) => {
    try {
      await updateDuration(sceneId, newDuration);
      addToast({
        type: 'success',
        message: 'Duration updated',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update duration',
        duration: 5000,
      });
    }
  };

  const handleRegenerateVideo = async (sceneId: string) => {
    try {
      await regenerateVideo(sceneId);
      addToast({
        type: 'success',
        message: 'Video regeneration started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate video',
        duration: 5000,
      });
    }
  };

  const handleRegenerateAll = async () => {
    try {
      await regenerateAllScenes();
      addToast({
        type: 'success',
        message: 'All scenes regenerated successfully',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate all scenes',
        duration: 5000,
      });
    }
  };

  const handlePreviewAll = () => {
    console.log('Preview all scenes');
  };

  const handleGenerateFinalVideo = () => {
    setStoryboardCompleted(true);
    setCurrentStep(STEPS.FINAL);
    router.push(`/project/${projectId}/final`);
  };

  // Loading state
  if (isLoading || isProjectLoading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">
              Loading Scenes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && scenes.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="max-w-md w-full bg-card border border-destructive rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-destructive mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-destructive mb-1">Error Loading Scenes</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/project/${projectId}/chat`)}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Return to Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No scenes state
  if (!project || scenes.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">No Scenes Found</h3>
            <p className="text-sm text-muted-foreground">
              Please complete the creative brief and mood selection first.
            </p>
            <button
              onClick={() => router.push(`/project/${projectId}/chat`)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Creative Brief
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CHANGED: Convert project scenes to storyboard format for carousel component
  const storyboardForCarousel = {
    storyboard_id: project.id,
    title: project.storyboard?.title || project.name,
    scene_order: scenes.map(s => s.id),
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
      <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
        <button
          onClick={() => router.push(`/project/${projectId}/mood`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-3 animate-slideUp"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Mood Selection
        </button>

        <div className="space-y-2 animate-slideUp animation-delay-100">
          <h1 className="text-2xl font-bold">Scene Storyboard</h1>
          <p className="text-muted-foreground">
            Refine each scene through text, image, and video generation
          </p>
        </div>

        {error && (
          <div className="animate-slideUp animation-delay-100">
            <ErrorAlert
              error={error}
              onDismiss={() => setError(null)}
              showRetry={false}
            />
          </div>
        )}

        <div className="animate-slideUp animation-delay-100">
          <StoryboardCarousel
            storyboard={storyboardForCarousel}
            scenes={scenes}
            onRegenerateAll={handleRegenerateAll}
            onPreviewAll={handlePreviewAll}
            onGenerateFinalVideo={handleGenerateFinalVideo}
            onApproveText={handleApproveText}
            onRegenerateText={handleRegenerateText}
            onEditText={handleEditText}
            onApproveImage={handleApproveImage}
            onRegenerateImage={handleRegenerateImage}
            onUpdateDuration={handleUpdateDuration}
            onRegenerateVideo={handleRegenerateVideo}
            isLoading={isSaving || isRegeneratingAll}
          />
        </div>

        {isRegeneratingAll && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-center font-medium">Regenerating all scenes...</p>
              <p className="text-xs text-center text-muted-foreground">
                This may take a moment
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScenesPage() {
  return (
    <ToastProvider>
      <ScenesPageContent />
    </ToastProvider>
  );
}
```

#### 2. Update StoryboardCarousel Component (if needed)
**File**: `frontend/components/storyboard/StoryboardCarousel.tsx` (if it exists)

**Verification**: Check if component expects specific scene format. If scenes from project API have different structure, add conversion logic in scenes page (shown above at line ~280).

### Success Criteria

#### Automated Verification:
- [ ] Frontend builds successfully: `npm run build`
- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] No console errors during build

#### Manual Verification:
- [ ] Navigate to `/project/{id}/scenes` without errors
- [ ] Page loads and shows loading state correctly
- [ ] Scenes display from project document (check Firestore `projects/{id}` document)
- [ ] Can click through scenes in carousel
- [ ] Edit scene text and verify:
  - Text updates in UI immediately (optimistic update)
  - Text persists in Firestore after save
  - Check Firestore `projects/{id}.scenes[i].description`
- [ ] Click "Approve Text" button:
  - Shows success toast
  - Eventually triggers image generation (may need Phase 4)
- [ ] Change scene duration:
  - Duration updates in UI
  - Persists to Firestore
- [ ] Click "Generate Video":
  - Shows success toast
  - Check Firebase Console logs for cloud function trigger
  - Video generation job created in `video_generation_jobs` collection
- [ ] Real-time updates work:
  - Open Firestore console
  - Manually update a scene's description
  - Verify change appears in UI without refresh
- [ ] Error states display correctly:
  - Test with invalid project ID
  - Test with network disconnected
- [ ] No errors in browser console during any operation
- [ ] No errors in backend logs when scenes operations trigger

**Implementation Note**: This is the highest-risk phase. Test thoroughly after completion before proceeding. If issues arise, can rollback git commits for this phase only.

---

## Phase 4: Add Initial Scene Generation

### Overview
Ensure scenes are created in the project document when the user transitions from mood selection to the scenes page. This handles the initial scene population.

### Changes Required

#### 1. Add Scene Initialization Endpoint
**File**: `backend/app/routers/projects.py`

**Add New Endpoint** (after line 272):

```python
@router.post("/{project_id}/scenes/initialize", response_model=Project)
async def initialize_scenes(
    project_id: str,
    creative_brief: dict,
    selected_mood: dict,
    http_request: Request
) -> Project:
    """
    Initialize scenes for a project using AI-generated descriptions.

    This endpoint:
    1. Takes creative brief and selected mood
    2. Generates 6 scene descriptions using OpenAI
    3. Creates scene objects and adds them to the project
    4. Returns updated project with scenes

    Args:
        project_id: The project ID
        creative_brief: Creative brief data
        selected_mood: Selected mood data
        http_request: FastAPI Request object for auth

    Returns:
        Updated project with initialized scenes
    """
    try:
        user_id = await get_current_user_id(http_request)
        firestore_service = get_firestore_service()

        # Verify project ownership
        project = await firestore_service.get_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # TODO: Call OpenAI to generate scene descriptions
        # For now, create placeholder scenes
        from datetime import datetime

        scenes = []
        for i in range(6):
            scene = Scene(
                id=str(uuid.uuid4()),
                scene_number=i + 1,
                title=f"Scene {i + 1}",
                description=f"AI-generated description for scene {i + 1}",
                duration_seconds=5.0
            )
            scenes.append(scene)

        # Add scenes to project
        for scene in scenes:
            project = await firestore_service.add_scene(project_id, user_id, scene)

        logger.info(f"Initialized {len(scenes)} scenes for project {project_id}")
        return project

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initializing scenes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 2. Add Scene Initialization to Frontend API Client
**File**: `frontend/lib/api/projects.ts`

**Add Function** (after line 209):

```typescript
/**
 * Initialize scenes for a project
 */
async initializeScenes(
  projectId: string,
  creativeBrief: any,
  selectedMood: any
): Promise<Project> {
  const requestData = convertFrontendToBackend({
    creativeBrief,
    selectedMood,
  });
  return apiRequest<Project>(
    `/api/projects/${projectId}/scenes/initialize`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    }
  );
},
```

#### 3. Update Mood Page to Initialize Scenes
**File**: `frontend/app/project/[id]/mood/page.tsx`

**Current**: User selects mood and navigates to scenes page
**Change**: Add scene initialization before navigation (find the navigation handler)

```typescript
const handleMoodSelect = async (moodId: string) => {
  try {
    // Select the mood
    selectMood(moodId);

    // Initialize scenes in project document
    const selectedMood = moods.find(m => m.id === moodId);
    if (selectedMood && creativeBrief) {
      await projectsApi.initializeScenes(
        projectId,
        creativeBrief,
        selectedMood
      );
    }

    // Navigate to scenes page
    router.push(`/project/${projectId}/scenes`);
  } catch (error) {
    console.error('Failed to initialize scenes:', error);
    // Show error to user
  }
};
```

### Success Criteria

#### Automated Verification:
- [ ] Backend API tests pass (if tests exist): `pytest backend/tests/`
- [ ] Frontend builds successfully: `npm run build`
- [ ] TypeScript compilation passes: `npm run typecheck`

#### Manual Verification:
- [ ] Create new project from scratch
- [ ] Complete creative brief
- [ ] Select a mood
- [ ] Verify loading indicator shows while scenes initialize
- [ ] Navigate to scenes page
- [ ] Scenes appear immediately (6 scenes by default)
- [ ] Check Firestore `projects/{id}` document:
  - `scenes` array exists
  - Contains 6 scene objects
  - Each scene has `id`, `sceneNumber`, `title`, `description`, `durationSeconds`
- [ ] No separate `storyboards/{id}` document created in Firestore
- [ ] Scenes persist after page refresh

**Implementation Note**: This phase ensures new projects start with the correct structure. Existing projects may need manual scene addition for testing.

---

## Phase 5: Remove Storyboard Store Dependencies

### Overview
Clean up unused storyboard/scene store code now that scenes are managed through project API.

### Changes Required

#### 1. Mark SceneStore as Deprecated
**File**: `frontend/store/sceneStore.ts`

**Add Warning** (at top of file):

```typescript
/**
 * DEPRECATED: This store is for legacy storyboard-based flow.
 *
 * New implementations should use:
 * - useProject hook for project data with real-time updates
 * - useProjectScenes hook for scene operations
 *
 * This file will be removed in a future release.
 */
```

#### 2. Remove useStoryboard Hook
**File**: `frontend/hooks/useStoryboard.ts`

**Action**: Delete the file entirely or add deprecation warning

**Alternative**: Add deprecation warning at top:
```typescript
/**
 * DEPRECATED: Use useProjectScenes instead.
 *
 * This hook is for legacy storyboard-based flow and will be removed.
 */
```

#### 3. Search and Update Remaining References
**Action**: Search codebase for:
- `useStoryboard` imports
- `useSceneStore` imports
- `/api/storyboards` endpoint calls

**Files to Check**:
- Any component in `frontend/components/`
- Any page in `frontend/app/`
- Any hook in `frontend/hooks/`

**Command**:
```bash
grep -r "useStoryboard" frontend/
grep -r "useSceneStore" frontend/
grep -r "/api/storyboards" frontend/
```

Update or remove any active usage found.

#### 4. Update ProjectStore References
**File**: `frontend/store/projectStore.ts`

**Lines to Update**:
- Line 249: Remove `useSceneStore.getState().reset()`
- Line 257-268: Remove storyboard loading logic
- Line 279: Remove `useSceneStore.getState()` reference

**Reason**: Scenes now managed via project API, not scene store

### Success Criteria

#### Automated Verification:
- [ ] No unused imports warnings: `npm run lint`
- [ ] Frontend builds successfully: `npm run build`
- [ ] All pages compile without errors: `npm run typecheck`

#### Manual Verification:
- [ ] Search codebase for `useSceneStore` - verify no active usage (only deprecation comment)
- [ ] Search codebase for `useStoryboard` - verify no active usage (only deprecation comment)
- [ ] Search codebase for `/api/storyboards` - verify no active frontend calls
- [ ] Test complete user workflow still works:
  - Create project
  - Complete creative brief
  - Select mood
  - View scenes
  - Edit scene
  - Generate video
- [ ] No console errors during any operation
- [ ] No "deprecated" warnings in console (since we're not importing deprecated code)

**Implementation Note**: This is cleanup work and low risk. Can be done incrementally or deferred if time is limited.

---

## Phase 6: End-to-End Testing & Documentation

### Overview
Comprehensive testing of the complete workflow to ensure all integration points work correctly, followed by documentation updates.

### Testing Strategy

#### Manual Testing Checklist

**Test 1: Complete New Project Flow**
1. Navigate to `/projects`
2. Click "New Project"
3. Verify redirected to `/project/{id}/chat`
4. Fill out creative brief (brand name, product description, etc.)
5. Click "Continue to Mood Selection"
6. Verify redirected to `/project/{id}/mood`
7. Wait for moods to generate (should see 4 mood cards)
8. Select a mood
9. Verify scenes initialize (loading indicator)
10. Verify redirected to `/project/{id}/scenes`
11. Verify 6 scenes appear in carousel
12. Check Firestore Console:
    - `projects/{id}` document exists
    - `storyboard.creativeBrief` populated
    - `storyboard.selectedMood` populated
    - `scenes` array has 6 items
    - NO separate `storyboards/{id}` document

**Test 2: Scene Text Operations**
1. On scenes page, click into first scene
2. Verify scene displays with description
3. Click "Edit" on scene text
4. Change the description text
5. Click "Save" or submit edit
6. Verify success toast appears
7. Verify text updates in UI
8. Check Firestore `projects/{id}.scenes[0].description` - verify updated
9. Refresh page
10. Verify edited text persists

**Test 3: Image Generation**
1. On a scene with approved text, click "Approve Text" or "Generate Image"
2. Verify success toast: "Image generation started"
3. Open Firebase Console → Functions → Logs
4. Verify `generate_video_for_scene` or equivalent function triggered
5. Check Firestore `video_generation_jobs` collection for new job
6. Verify job has `project_id` and `scene_id` fields
7. Wait for job to complete (may take 1-2 minutes)
8. Verify scene in UI updates with generated image
9. Check Firestore `projects/{id}.scenes[0].assets.thumbnailPath` - verify populated

**Test 4: Video Generation**
1. On a scene with generated image, click "Approve Image" or "Generate Video"
2. Verify success toast: "Video generation started"
3. Open Firebase Console → Functions → Logs
4. Verify project cloud function triggered (not legacy function)
5. Check Firestore `video_generation_jobs` collection for new job
6. Verify job has correct `project_id` and `scene_id`
7. Wait for job to complete (may take 2-5 minutes)
8. Verify scene updates with video
9. Check Firestore `projects/{id}.scenes[0].assets.videoPath` - verify populated
10. Verify scene shows "video" state in UI

**Test 5: Real-Time Updates**
1. Open scenes page in browser
2. Open Firestore Console in another window
3. Navigate to `projects/{id}` document
4. Manually edit `scenes[0].description` field
5. Save changes in Firestore Console
6. Switch back to browser with scenes page
7. Verify description updates WITHOUT page refresh (within 1-2 seconds)
8. Verify this works for other fields (duration, title, etc.)

**Test 6: Scene Duration Update**
1. On scenes page, find scene duration control
2. Change duration from 5s to 8s
3. Verify success toast
4. Check Firestore `projects/{id}.scenes[0].durationSeconds` - verify updated to 8
5. Refresh page
6. Verify duration still shows 8s

**Test 7: Multi-Scene Operations**
1. Navigate through all 6 scenes in carousel
2. Edit text on scene 2
3. Edit text on scene 4
4. Verify both changes persist
5. Generate images for multiple scenes
6. Verify all jobs trigger correctly
7. Check Firestore - all scenes update independently

**Test 8: Error Handling**
1. Disconnect from internet
2. Try to edit scene text
3. Verify error toast appears
4. Reconnect to internet
5. Verify connection restores
6. Try edit again - should succeed

**Test 9: Project List**
1. Navigate to `/projects`
2. Verify project appears in list
3. Verify project thumbnail (first mood image or first scene image)
4. Click on project
5. Verify loads to scenes page with all data

**Test 10: Backend API Auth**
1. Open browser DevTools → Network tab
2. Edit a scene
3. Find API request to `/api/projects/{id}/scenes/{sceneId}`
4. Verify `Authorization: Bearer {token}` header present
5. Verify request succeeds (200 status)
6. Verify response contains updated project

#### Automated Verification (if applicable):
- [ ] All backend unit tests pass: `pytest backend/tests/`
- [ ] All frontend builds pass: `npm run build`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

### Documentation Updates

#### 1. Update Architecture Documentation
**File**: Create or update `docs/architecture.md`

**Content**:
```markdown
# Architecture Overview

## Data Model: Project-Centric

All user data is stored in Firestore under the `projects` collection:

```
projects/{projectId}
  - id: string
  - name: string
  - userId: string
  - createdAt: timestamp
  - updatedAt: timestamp
  - storyboard: {
      id: string
      title: string
      creativeBrief: {...}
      selectedMood: {...}
    }
  - scenes: [
      {
        id: string
        sceneNumber: number
        title: string
        description: string
        durationSeconds: number
        assets: {
          thumbnailPath: string
          videoPath: string
          compositionPath: string
        }
        activeJob: {
          jobId: string
          type: "video" | "composition"
          status: "queued" | "processing" | "completed" | "failed"
          progress: number
        }
      }
    ]
```

## Frontend Architecture

- **State Management**: Zustand stores (projectStore.ts) + Backend API
- **Real-Time Updates**: Direct Firestore subscriptions (via useProject hook)
- **API Client**: REST API for writes, Firestore for reads

## Backend Architecture

- **Projects API**: `/api/projects` - CRUD operations with Clerk auth
- **Cloud Functions**: Firebase Functions triggered by Firestore events
- **Storage**: Firebase Storage for media assets (images, videos)

## User Flow

1. Create Project → Projects API creates Firestore document
2. Creative Brief → Updates project.storyboard.creativeBrief
3. Mood Generation → Moods API generates images, saves to Storage
4. Mood Selection → Updates project.storyboard.selectedMood
5. Scene Initialization → Projects API adds scenes to project.scenes array
6. Scene Editing → Projects API updates specific scene in array
7. Video Generation → Projects API creates job, Cloud Function processes
8. Real-Time Updates → Frontend subscribes to project document changes
```

#### 2. Update README
**File**: `README.md`

**Add Section**:
```markdown
## Project Structure

- `backend/` - FastAPI backend with Projects API
  - `app/routers/projects.py` - Project CRUD endpoints
  - `app/routers/moods.py` - Mood generation endpoints
- `frontend/` - Next.js frontend application
  - `app/project/[id]/` - Project pages (chat, mood, scenes)
  - `hooks/useProject.ts` - Project data hook with real-time updates
  - `hooks/useProjectScenes.ts` - Scene operations hook
  - `lib/api/projects.ts` - Projects API client
- `functions/` - Firebase Cloud Functions
  - `project_functions.py` - Project-based video/composition generation

## Key Features

- **Real-Time Collaboration**: Changes sync instantly via Firestore
- **Project-Centric**: All data embedded in project documents
- **AI-Powered**: OpenAI for scene generation, Replicate for video
- **Secure**: Clerk authentication with JWT tokens
```

#### 3. Add Comments to Key Files
**File**: `frontend/hooks/useProjectScenes.ts`

**Add JSDoc Comments**:
```typescript
/**
 * Project Scenes Hook
 *
 * Manages scene operations for a project using project-centric API endpoints.
 * Provides real-time updates via Firestore subscriptions.
 *
 * Features:
 * - Real-time scene updates (no manual refresh needed)
 * - Optimistic UI updates for better UX
 * - Automatic error handling with retry logic
 * - Toast notifications for all operations
 *
 * Usage:
 * ```tsx
 * const { scenes, editText, generateVideo } = useProjectScenes(projectId);
 *
 * // Edit scene text
 * await editText(sceneId, "New description");
 *
 * // Generate video
 * await generateVideo(sceneId);
 * ```
 *
 * @param projectId - The project ID to manage scenes for
 * @returns Scene state and operation functions
 */
```

### Success Criteria

#### Automated Verification:
- [ ] All manual tests from checklist above pass
- [ ] No errors in browser console during full workflow
- [ ] No errors in backend logs during full workflow
- [ ] No errors in Firebase Functions logs during generation jobs

#### Manual Verification:
- [ ] Complete Test 1 (New Project Flow) - all steps pass
- [ ] Complete Test 2 (Scene Text) - all steps pass
- [ ] Complete Test 3 (Image Generation) - all steps pass
- [ ] Complete Test 4 (Video Generation) - all steps pass
- [ ] Complete Test 5 (Real-Time Updates) - updates appear without refresh
- [ ] Complete Test 6 (Duration Update) - updates persist
- [ ] Complete Test 7 (Multi-Scene) - all operations independent
- [ ] Complete Test 8 (Error Handling) - errors display correctly
- [ ] Complete Test 9 (Project List) - projects load correctly
- [ ] Complete Test 10 (Backend Auth) - auth tokens present and valid
- [ ] Documentation updated and accurate
- [ ] README reflects current architecture
- [ ] Code comments explain key functionality

**Implementation Note**: This phase validates everything works together. If any test fails, trace back to the relevant phase to fix the issue before marking complete.

---

## Performance Considerations

### Firestore Read/Write Costs
- **Current**: Mood page already uses Firestore subscriptions successfully
- **Impact**: Scenes page adds one subscription per project
- **Mitigation**: Subscriptions are cleaned up on unmount (in useProjectScenes hook)

### Real-Time Update Latency
- **Expected**: <1 second for scene updates via Firestore
- **Monitoring**: Check browser console for subscription connection logs

### Cloud Function Cold Starts
- **Current**: Functions already deployed, cold starts expected (2-3s)
- **Mitigation**: Firebase Functions auto-scale, no code changes needed

---

## Migration Notes

### No Existing Data Migration Required
- User confirmed no production data exists
- Clean cutover acceptable
- Existing storyboard documents can be ignored

### Rollback Strategy
If critical issues arise after Phase 3:

1. **Git Rollback**: Revert changes to scenes page
   ```bash
   git revert <commit-hash-from-phase-3>
   ```

2. **Re-deploy Frontend**:
   ```bash
   npm run build && npm run deploy  # or your deployment command
   ```

3. **Verify**: Legacy storyboard flow still works

4. **Debug**: Fix issues in development branch before re-attempting migration

---

## References

- **Original Research**: `backend-frontend-integration-gaps.md`
- **Backend Alignment Plan**: `BACKEND_ALIGNMENT_PLAN.md`
- **Projects API**: `backend/app/routers/projects.py:38-442`
- **Project Cloud Functions**: `functions/project_functions.py:18-507`
- **Mood Generation** (Working Example): `backend/app/routers/moods.py:142-167`
- **useProject Hook** (Real-time pattern): `frontend/hooks/useProject.ts:332-366`
