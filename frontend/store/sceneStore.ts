import { create } from 'zustand';

/**
 * DEPRECATED: Scene Store (Legacy - Being Phased Out)
 *
 * This store is kept for compatibility with existing components
 * but should not be used for new features. Use projectStore and
 * useProjectScenes hook instead.
 *
 * Most functionality has been removed as the storyboard system
 * has been deleted. Only minimal state management remains.
 */

interface SceneStoreState {
  // Legacy state - kept for compatibility
  storyboard: any | null;
  scenes: any[];
  currentSceneIndex: number;
  isLoading: boolean;
  error: string | null;
  
  // Basic actions
  reset: () => void;
  setScenes: (scenes: any[]) => void;
  setCurrentSceneIndex: (index: number) => void;
}

export const useSceneStore = create<SceneStoreState>((set) => ({
  // Initial state
  storyboard: null,
  scenes: [],
  currentSceneIndex: 0,
  isLoading: false,
  error: null,
  
  // Basic actions for compatibility
  reset: () => {
    set({
      storyboard: null,
      scenes: [],
      currentSceneIndex: 0,
      isLoading: false,
      error: null,
    });
  },
  
  setScenes: (scenes) => {
    set({ scenes });
  },
  
  setCurrentSceneIndex: (index) => {
    set({ currentSceneIndex: index });
  },
}));