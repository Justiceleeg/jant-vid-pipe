/**
 * Hook for managing scene planning and seed image generation.
 */
import { useState } from 'react';
import { generateScenePlan as apiGenerateScenePlan } from '@/lib/api/client';
import type {
  ScenePlanRequest,
  ScenePlanResponse,
  SeedImageRequest,
  SeedImageResponse,
  ScenePlan,
  Scene,
} from '@/types/scene.types';

interface UseScenePlanningReturn {
  scenePlan: ScenePlan | null;
  isLoading: boolean;
  error: string | null;
  generateScenePlan: (request: ScenePlanRequest) => Promise<ScenePlan | null>;
  generateSeedImages: (
    scenes: Scene[],
    moodStyleKeywords: string[],
    moodColorPalette: string[],
    moodAestheticDirection: string
  ) => Promise<Scene[] | null>;
  clearError: () => void;
}

export function useScenePlanning(): UseScenePlanningReturn {
  const [scenePlan, setScenePlan] = useState<ScenePlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const generateScenePlan = async (
    request: ScenePlanRequest
  ): Promise<ScenePlan | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Call actual API endpoint
      const response = await apiGenerateScenePlan(request);

      if (!response.success || !response.scene_plan) {
        throw new Error(response.message || 'Failed to generate scene plan');
      }

      setScenePlan(response.scene_plan);
      return response.scene_plan;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Scene plan generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const generateSeedImages = async (
    scenes: Scene[],
    moodStyleKeywords: string[],
    moodColorPalette: string[],
    moodAestheticDirection: string
  ): Promise<Scene[] | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/scenes/seeds`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scenes: scenes,
            mood_style_keywords: moodStyleKeywords,
            mood_color_palette: moodColorPalette,
            mood_aesthetic_direction: moodAestheticDirection,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SeedImageResponse = await response.json();

      if (!data.success || !data.scenes_with_images) {
        throw new Error(data.message || 'Failed to generate seed images');
      }

      // Log partial success warning
      if (data.successful_images < data.total_scenes) {
        console.warn(`Partial success: ${data.successful_images}/${data.total_scenes} images generated`);
      }

      // Update scene plan with seed images
      if (scenePlan) {
        const updatedScenePlan = {
          ...scenePlan,
          scenes: data.scenes_with_images,
        };
        setScenePlan(updatedScenePlan);
      }

      return data.scenes_with_images;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Seed image generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    scenePlan,
    isLoading,
    error,
    generateScenePlan,
    generateSeedImages,
    clearError,
  };
}
