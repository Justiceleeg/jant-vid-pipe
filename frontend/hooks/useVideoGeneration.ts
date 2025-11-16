/**
 * Hook for managing video generation with polling and progress tracking.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoJobStatus,
  VideoJobStatusResponse,
} from '@/types/video.types';

interface UseVideoGenerationReturn {
  jobStatus: VideoJobStatus | null;
  isGenerating: boolean;
  error: string | null;
  startGeneration: (request: VideoGenerationRequest) => Promise<string | null>;
  stopPolling: () => void;
  clearError: () => void;
  retryGeneration: () => Promise<void>;
}

const POLLING_INTERVAL = 3000; // 3 seconds
const MAX_POLL_RETRIES = 3; // Max retries for failed poll requests

export function useVideoGeneration(): UseVideoGenerationReturn {
  const [jobStatus, setJobStatus] = useState<VideoJobStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<VideoGenerationRequest | null>(null);

  // Refs for cleanup and polling control
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRetryCountRef = useRef(0);
  const isUnmountedRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollRetryCountRef.current = 0;
  }, []);

  const pollJobStatus = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/video/status/${jobId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: VideoJobStatusResponse = await response.json();

      if (!data.success || !data.job_status) {
        throw new Error(data.message || 'Failed to get job status');
      }

      // Update job status if component is still mounted
      if (!isUnmountedRef.current) {
        setJobStatus(data.job_status);
        pollRetryCountRef.current = 0; // Reset retry count on success

        // Check if job is complete or failed
        const isFinished =
          data.job_status.status === 'completed' || data.job_status.status === 'failed';

        if (isFinished) {
          setIsGenerating(false);
          return true; // Stop polling
        }
      }

      return false; // Continue polling
    } catch (err) {
      console.error('Polling error:', err);
      pollRetryCountRef.current++;

      // If we've exceeded max retries, stop polling and set error
      if (pollRetryCountRef.current >= MAX_POLL_RETRIES) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to poll job status';
        if (!isUnmountedRef.current) {
          setError(`Polling failed: ${errorMessage}`);
          setIsGenerating(false);
        }
        return true; // Stop polling
      }

      return false; // Continue polling (retry)
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      // Clear any existing polling interval
      stopPolling();

      // Start polling
      pollingIntervalRef.current = setInterval(async () => {
        const shouldStop = await pollJobStatus(jobId);
        if (shouldStop) {
          stopPolling();
        }
      }, POLLING_INTERVAL);

      // Also poll immediately
      pollJobStatus(jobId).then((shouldStop) => {
        if (shouldStop) {
          stopPolling();
        }
      });
    },
    [pollJobStatus, stopPolling]
  );

  const startGeneration = useCallback(
    async (request: VideoGenerationRequest): Promise<string | null> => {
      setIsGenerating(true);
      setError(null);
      setJobStatus(null);
      setLastRequest(request);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/video/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: VideoGenerationResponse = await response.json();

        if (!data.success || !data.job_id) {
          throw new Error(data.message || 'Failed to start video generation');
        }

        // Start polling for job status
        startPolling(data.job_id);

        return data.job_id;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setIsGenerating(false);
        console.error('Video generation error:', err);
        return null;
      }
    },
    [startPolling]
  );

  const retryGeneration = useCallback(async (): Promise<void> => {
    if (!lastRequest) {
      setError('No previous request to retry');
      return;
    }

    await startGeneration(lastRequest);
  }, [lastRequest, startGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      stopPolling();
    };
  }, [stopPolling]);

  // Auto-stop polling when job is complete or failed
  useEffect(() => {
    if (jobStatus) {
      const isFinished =
        jobStatus.status === 'completed' || jobStatus.status === 'failed';
      if (isFinished) {
        stopPolling();
      }
    }
  }, [jobStatus, stopPolling]);

  return {
    jobStatus,
    isGenerating,
    error,
    startGeneration,
    stopPolling,
    clearError,
    retryGeneration,
  };
}
