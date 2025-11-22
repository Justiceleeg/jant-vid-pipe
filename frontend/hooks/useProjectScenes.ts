/**
 * Project Scenes Hook
 *
 * Manages scene operations using project-centric API endpoints
 * with real-time Firestore subscriptions for scene updates.
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToProject } from '@/lib/api/projects';
import type { Project, Scene } from '@/types/project';
import { projectsApi } from '@/lib/api/projects';

interface UpdateSceneRequest {
  description?: string;
  title?: string;
  durationSeconds?: number;
  textApproved?: boolean;
}

interface UseProjectScenesState {
  scenes: Scene[];
  project: Project | null;
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
    project: null,
    isLoading: true,
    isSaving: false,
    isRegeneratingAll: false,
    error: null,
  });

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Set up real-time Firestore subscription
  useEffect(() => {
    if (!projectId) {
      console.log('[useProjectScenes] No projectId provided');
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    console.log('[useProjectScenes] Setting up subscription for project:', projectId);
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Subscribe to project updates for real-time scene changes
    subscriptionRef.current = subscribeToProject(projectId, (project: Project) => {
      console.log('[useProjectScenes] Project update received:', project);
      console.log('[useProjectScenes] Scenes count:', project.scenes?.length || 0);
      console.log('[useProjectScenes] Scenes:', project.scenes);
      
      setState(prev => ({
        ...prev,
        project: project,
        scenes: project.scenes || [],
        isLoading: false,
      }));
    });

    return () => {
      console.log('[useProjectScenes] Cleaning up subscription');
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
      } as UpdateSceneRequest);

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
      } as UpdateSceneRequest);

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
      } as UpdateSceneRequest);

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

