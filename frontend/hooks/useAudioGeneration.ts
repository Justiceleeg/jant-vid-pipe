import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import type { AudioGenerationRequest, AudioGenerationResponse } from '@/types/audio.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useAudioGeneration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAudioUrl } = useAppStore();

  /**
   * Generate background music for a mood
   */
  const generateAudio = useCallback(
    async (request: AudioGenerationRequest): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/audio/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const data: AudioGenerationResponse = await response.json();

        if (!data.success || !data.audio_url) {
          throw new Error(data.error || 'Failed to generate audio');
        }

        // Store audio URL
        setAudioUrl(data.audio_url);

        return data.audio_url;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate audio';
        setError(message);
        console.error('Audio generation error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [setAudioUrl]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generateAudio,
    isLoading,
    error,
    clearError,
  };
}
