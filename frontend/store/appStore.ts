import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CreativeBrief } from '@/types/chat.types';
import type { Mood } from '@/types/mood.types';
import type { ScenePlan } from '@/types/scene.types';

/**
 * Global application state store using Zustand.
 * This store manages state across all pipeline steps.
 */
interface AppState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5;
  setCurrentStep: (step: number) => void;

    // Step 1: Vision & Creative Brief
    creativeBrief: CreativeBrief | null;
    setCreativeBrief: (brief: CreativeBrief | null) => void;

  // Step 2: Moods
  moods: Mood[];
  selectedMoodId: string | null;
  setMoods: (moods: Mood[]) => void;
  selectMood: (moodId: string) => void;

  // Step 3: Scenes
  scenePlan: ScenePlan | null;
  setScenePlan: (plan: ScenePlan | null) => void;

  // Step 4: Video Clips
  videoJobId: string | null;
  generatedClips: any[];
  clipGenerationProgress: number;
  setVideoJobId: (jobId: string | null) => void;
  setGeneratedClips: (clips: any[]) => void;
  updateClipProgress: (progress: number) => void;

  // Audio
  audioUrl: string | null;
  setAudioUrl: (url: string | null) => void;

  // Step 5: Final Video Composition
  compositionJobId: string | null;
  finalVideo: any | null;
  compositionProgress: number;
  setCompositionJobId: (jobId: string | null) => void;
  setFinalVideo: (video: any) => void;
  updateCompositionProgress: (progress: number) => void;

  // Error Handling
  error: string | null;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

const STORAGE_KEY = 'jant-vid-pipe-app-state';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      currentStep: 1,
      setCurrentStep: (step) => set({ currentStep: step as 1 | 2 | 3 | 4 | 5 }),

      // Step 1: Vision
      creativeBrief: null,
      setCreativeBrief: (brief) => set({ creativeBrief: brief }),

      // Step 2: Moods
      moods: [],
      selectedMoodId: null,
      setMoods: (moods) => set({ moods }),
      selectMood: (moodId) => set({ selectedMoodId: moodId }),

      // Step 3: Scenes
      scenePlan: null,
      setScenePlan: (plan) => set({ scenePlan: plan }),

      // Step 4: Video Clips
      videoJobId: null,
      generatedClips: [],
      clipGenerationProgress: 0,
      setVideoJobId: (jobId) => set({ videoJobId: jobId }),
      setGeneratedClips: (clips) => set({ generatedClips: clips }),
      updateClipProgress: (progress) => set({ clipGenerationProgress: progress }),

      // Audio
      audioUrl: null,
      setAudioUrl: (url) => set({ audioUrl: url }),

      // Step 5: Final Video Composition
      compositionJobId: null,
      finalVideo: null,
      compositionProgress: 0,
      setCompositionJobId: (jobId) => set({ compositionJobId: jobId }),
      setFinalVideo: (video) => set({ finalVideo: video }),
      updateCompositionProgress: (progress) => set({ compositionProgress: progress }),

      // Error Handling
      error: null,
      setError: (error) => set({ error }),

      // Reset
      reset: () => {
        // Clear localStorage for this app
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        // Reset state
        set({
          currentStep: 1,
          creativeBrief: null,
          moods: [],
          selectedMoodId: null,
          scenePlan: null,
          videoJobId: null,
          generatedClips: [],
          clipGenerationProgress: 0,
          audioUrl: null,
          compositionJobId: null,
          finalVideo: null,
          compositionProgress: 0,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields (exclude error state and temporary progress)
      partialize: (state) => ({
        currentStep: state.currentStep,
        creativeBrief: state.creativeBrief,
        moods: state.moods,
        selectedMoodId: state.selectedMoodId,
        scenePlan: state.scenePlan,
        videoJobId: state.videoJobId,
        generatedClips: state.generatedClips,
        audioUrl: state.audioUrl,
        compositionJobId: state.compositionJobId,
        finalVideo: state.finalVideo,
        // Don't persist: error, clipGenerationProgress, compositionProgress
      }),
    }
  )
);

