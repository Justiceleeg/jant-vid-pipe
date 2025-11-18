import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Storyboard, StoryboardScene, SSESceneUpdate } from '@/types/storyboard.types';
import * as storyboardAPI from '@/lib/api/storyboard';
import { retryOperation, StoryboardError, ERROR_CODES } from '@/lib/errors';

/**
 * Storyboard Store
 *
 * Manages storyboard state with automatic persistence and real-time updates via SSE.
 */
interface StoryboardState {
  // Core data
  storyboard: Storyboard | null;
  scenes: StoryboardScene[];
  currentSceneIndex: number;

  // SSE connection
  sseConnection: EventSource | null;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isRegeneratingAll: boolean;

  // Error handling
  error: string | null;

  // Actions - Storyboard operations
  initializeStoryboard: (creativeBrief: any, selectedMood: any) => Promise<void>;
  loadStoryboard: (storyboardId: string) => Promise<void>;
  regenerateAllScenes: () => Promise<void>;

  // Actions - Scene operations
  setCurrentSceneIndex: (index: number) => void;
  approveText: (sceneId: string) => Promise<void>;
  regenerateText: (sceneId: string) => Promise<void>;
  editText: (sceneId: string, newText: string) => Promise<void>;
  approveImage: (sceneId: string) => Promise<void>;
  regenerateImage: (sceneId: string) => Promise<void>;
  updateDuration: (sceneId: string, newDuration: number) => Promise<void>;
  regenerateVideo: (sceneId: string) => Promise<void>;

  // Actions - SSE
  connectSSE: (storyboardId: string) => void;
  disconnectSSE: () => void;
  handleSSEUpdate: (event: MessageEvent) => void;

  // Actions - Utilities
  updateScene: (sceneId: string, updates: Partial<StoryboardScene>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const STORAGE_KEY = 'jant-vid-pipe-storyboard-state';

export const useStoryboardStore = create<StoryboardState>()(
  persist(
    (set, get) => ({
      // Initial state
      storyboard: null,
      scenes: [],
      currentSceneIndex: 0,
      sseConnection: null,
      isLoading: false,
      isSaving: false,
      isRegeneratingAll: false,
      error: null,

      // Initialize new storyboard
      initializeStoryboard: async (creativeBrief, selectedMood) => {
        set({ isLoading: true, error: null });
        try {
          const response = await retryOperation(
            () => storyboardAPI.initializeStoryboard({
              creative_brief: creativeBrief,
              selected_mood: selectedMood,
            }),
            {
              maxRetries: 2,
              operationName: 'Initialize Storyboard',
              onRetry: (attempt) => {
                console.log(`Retrying storyboard initialization (attempt ${attempt})...`);
              },
            }
          );

          if (response.success) {
            set({
              storyboard: response.storyboard,
              scenes: response.scenes,
              currentSceneIndex: 0,
              isLoading: false,
            });

            // Connect SSE for real-time updates
            get().connectSSE(response.storyboard.storyboard_id);
          } else {
            throw new StoryboardError(
              response.message || 'Failed to initialize storyboard',
              ERROR_CODES.STORYBOARD_INIT_FAILED,
              true
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize storyboard';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      // Load existing storyboard
      loadStoryboard: async (storyboardId) => {
        set({ isLoading: true, error: null });
        try {
          const { storyboard, scenes } = await retryOperation(
            () => storyboardAPI.getStoryboard(storyboardId),
            {
              maxRetries: 3,
              operationName: 'Load Storyboard',
            }
          );

          set({
            storyboard,
            scenes,
            currentSceneIndex: 0,
            isLoading: false,
          });

          // Connect SSE
          get().connectSSE(storyboardId);

          // Check for any ongoing generations and poll status
          const generatingScenes = scenes.filter(
            (s) =>
              s.generation_status.image === 'generating' ||
              s.generation_status.video === 'generating'
          );

          if (generatingScenes.length > 0 && !get().sseConnection) {
            // Fallback to polling if SSE not available
            generatingScenes.forEach((scene) => {
              pollSceneStatus(scene.id, get);
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load storyboard';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.STORYBOARD_LOAD_FAILED,
            true
          );
        }
      },

      // Regenerate all scenes
      regenerateAllScenes: async () => {
        const { storyboard } = get();
        if (!storyboard) return;

        set({ isRegeneratingAll: true, error: null });
        try {
          const { storyboard: newStoryboard, scenes: newScenes } =
            await storyboardAPI.regenerateAllScenes(storyboard.storyboard_id);

          set({
            storyboard: newStoryboard,
            scenes: newScenes,
            currentSceneIndex: 0,
            isRegeneratingAll: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to regenerate scenes',
            isRegeneratingAll: false,
          });
        }
      },

      // Set current scene index
      setCurrentSceneIndex: (index) => set({ currentSceneIndex: index }),

      // Approve text and generate image
      approveText: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          const updatedScene = await retryOperation(
            () => storyboardAPI.generateSceneImage(sceneId),
            {
              maxRetries: 2,
              operationName: 'Generate Scene Image',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_IMAGE_GENERATION_FAILED,
            true,
            sceneId
          );
        }
      },

      // Regenerate text
      regenerateText: async (sceneId) => {
        const { storyboard } = get();
        if (!storyboard) return;

        set({ isSaving: true, error: null });
        try {
          const updatedScene = await retryOperation(
            () => storyboardAPI.generateSceneText(sceneId, storyboard.creative_brief),
            {
              maxRetries: 2,
              operationName: 'Regenerate Scene Text',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate text';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_TEXT_GENERATION_FAILED,
            true,
            sceneId
          );
        }
      },

      // Edit text
      editText: async (sceneId, newText) => {
        set({ isSaving: true, error: null });
        try {
          const updatedScene = await retryOperation(
            () => storyboardAPI.updateSceneText(sceneId, newText),
            {
              maxRetries: 2,
              operationName: 'Update Scene Text',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update text';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_TEXT_UPDATE_FAILED,
            true,
            sceneId
          );
        }
      },

      // Approve image and generate video
      approveImage: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          await storyboardAPI.generateSceneVideo(sceneId);
          // SSE will handle the update
          set({ isSaving: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to generate video',
            isSaving: false,
          });
        }
      },

      // Regenerate image
      regenerateImage: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          const updatedScene = await retryOperation(
            () => storyboardAPI.regenerateSceneImage(sceneId),
            {
              maxRetries: 2,
              operationName: 'Regenerate Scene Image',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate image';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_IMAGE_GENERATION_FAILED,
            true,
            sceneId
          );
        }
      },

      // Update duration
      updateDuration: async (sceneId, newDuration) => {
        set({ isSaving: true, error: null });
        try {
          const updatedScene = await retryOperation(
            () => storyboardAPI.updateSceneDuration(sceneId, newDuration),
            {
              maxRetries: 2,
              operationName: 'Update Scene Duration',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update duration';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_DURATION_UPDATE_FAILED,
            true,
            sceneId
          );
        }
      },

      // Regenerate video
      regenerateVideo: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          await storyboardAPI.regenerateSceneVideo(sceneId);
          // SSE will handle the update
          set({ isSaving: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to regenerate video',
            isSaving: false,
          });
        }
      },

      // Connect SSE
      connectSSE: (storyboardId) => {
        // Disconnect existing connection
        get().disconnectSSE();

        try {
          const eventSource = storyboardAPI.createSSEConnection(
            storyboardId,
            get().handleSSEUpdate,
            (error) => {
              console.error('SSE connection error:', error);
              // Attempt to reconnect after 5 seconds
              setTimeout(() => {
                if (get().storyboard?.storyboard_id === storyboardId) {
                  get().connectSSE(storyboardId);
                }
              }, 5000);
            }
          );

          set({ sseConnection: eventSource });
        } catch (error) {
          console.error('Failed to create SSE connection:', error);
        }
      },

      // Disconnect SSE
      disconnectSSE: () => {
        const { sseConnection } = get();
        if (sseConnection) {
          storyboardAPI.closeSSEConnection(sseConnection);
          set({ sseConnection: null });
        }
      },

      // Handle SSE updates
      handleSSEUpdate: (event) => {
        try {
          const data: SSESceneUpdate = JSON.parse(event.data);
          const { scene_id, state, status, video_url, image_url, error } = data;

          get().updateScene(scene_id, {
            state,
            generation_status: {
              ...get().scenes.find((s) => s.id === scene_id)?.generation_status,
              [state === 'video' ? 'video' : 'image']: status,
            },
            video_url: video_url || undefined,
            image_url: image_url || undefined,
            error_message: error || null,
          });
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      },

      // Update a specific scene
      updateScene: (sceneId, updates) => {
        set((state) => ({
          scenes: state.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, ...updates } : scene
          ),
        }));
      },

      // Set error
      setError: (error) => set({ error }),

      // Reset state
      reset: () => {
        get().disconnectSSE();
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        set({
          storyboard: null,
          scenes: [],
          currentSceneIndex: 0,
          sseConnection: null,
          isLoading: false,
          isSaving: false,
          isRegeneratingAll: false,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist storyboard and scenes, not connection state
      partialize: (state) => ({
        storyboard: state.storyboard,
        scenes: state.scenes,
        currentSceneIndex: state.currentSceneIndex,
      }),
    }
  )
);

/**
 * Polling fallback for scene status when SSE is not available
 */
async function pollSceneStatus(sceneId: string, get: () => StoryboardState) {
  const maxAttempts = 60; // 5 minutes max (5s intervals)
  let attempts = 0;

  const poll = async () => {
    if (attempts >= maxAttempts) return;

    try {
      const status = await storyboardAPI.getSceneStatus(sceneId);
      get().updateScene(sceneId, {
        state: status.state,
        generation_status: status.generation_status,
        error_message: status.error_message,
      });

      // Continue polling if still generating
      if (
        status.generation_status.image === 'generating' ||
        status.generation_status.video === 'generating'
      ) {
        attempts++;
        setTimeout(poll, 5000); // Poll every 5 seconds
      }
    } catch (error) {
      console.error('Failed to poll scene status:', error);
    }
  };

  poll();
}
