import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import type {
  CompositionRequest,
  CompositionResponse,
  CompositionJobStatusResponse,
  CompositionJobStatus,
} from '@/types/composition.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useVideoComposition() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<CompositionJobStatus | null>(null);

  const {
    compositionJobId,
    setCompositionJobId,
    setFinalVideo,
    finalVideo,
  } = useAppStore();

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Poll job status
   */
  const pollJobStatus = useCallback(async (jobId: string): Promise<CompositionJobStatus | null> => {
    try {
      const response = await fetch(`${API_URL}/api/composition/status/${jobId}`);

      if (!response.ok) {
        // If job not found (404), clear the job ID and stop polling
        if (response.status === 404) {
          console.warn(`Job ${jobId} not found, clearing job ID`);
          setCompositionJobId(null);
          // Clear polling interval directly
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data: CompositionJobStatusResponse = await response.json();

      if (!data.success || !data.job_status) {
        return null;
      }

      return data.job_status;
    } catch (err) {
      // Only log non-404 errors
      if (!(err instanceof Error && err.message.includes('404'))) {
        console.error('Status polling error:', err);
      }
      return null;
    }
  }, [setCompositionJobId]);

  /**
   * Start polling for job updates
   */
  const startPolling = useCallback(
    (jobId: string) => {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Poll immediately
      pollJobStatus(jobId).then((status) => {
        if (status) {
          setJobStatus(status);

          if (status.status === 'completed' && status.video_url) {
            setFinalVideo({
              video_url: status.video_url,
              file_size_mb: status.file_size_mb,
              duration_seconds: status.duration_seconds,
            });
          }
        }
      });

      // Then poll every 2 seconds
      pollingIntervalRef.current = setInterval(async () => {
        const status = await pollJobStatus(jobId);

        if (status) {
          setJobStatus(status);

          // Update final video in store
          if (status.status === 'completed' && status.video_url) {
            setFinalVideo({
              video_url: status.video_url,
              file_size_mb: status.file_size_mb,
              duration_seconds: status.duration_seconds,
            });
          }

          // Stop polling if completed or failed
          if (status.status === 'completed' || status.status === 'failed') {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            if (status.status === 'failed') {
              setError(status.error || 'Composition failed');
            }
          }
        } else {
          // If status is null (e.g., job not found), stop polling
          // pollJobStatus already cleared the interval and job ID
          if (!pollingIntervalRef.current) {
            // Interval was cleared by pollJobStatus, stop here
            return;
          }
        }
      }, 2000); // Poll every 2 seconds
    },
    [pollJobStatus, setFinalVideo]
  );

  /**
   * Start video composition
   */
  const composeVideo = useCallback(
    async (request: CompositionRequest): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/composition/compose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const data: CompositionResponse = await response.json();

        if (!data.success || !data.job_id) {
          throw new Error(data.message || 'Failed to initiate composition');
        }

        // Store job ID and start polling
        setCompositionJobId(data.job_id);
        startPolling(data.job_id);

        return data.job_id;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to compose video';
        setError(message);
        console.error('Composition error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [setCompositionJobId, startPolling]
  );

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Resume polling for existing job
   */
  useEffect(() => {
    // If we already have a final video, don't poll
    if (finalVideo) {
      return;
    }

    if (compositionJobId && !pollingIntervalRef.current) {
      // Resume polling for existing job
      // First check if job exists before starting to poll
      pollJobStatus(compositionJobId).then((status) => {
        if (status) {
          // Job exists, start polling
          startPolling(compositionJobId);
        } else {
          // Job doesn't exist, clear the job ID
          setCompositionJobId(null);
        }
      });
    }

    return () => {
      stopPolling();
    };
  }, [compositionJobId, finalVideo, startPolling, stopPolling, pollJobStatus, setCompositionJobId]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    composeVideo,
    jobStatus,
    isLoading,
    error,
    clearError,
    startPolling,
    stopPolling,
  };
}
