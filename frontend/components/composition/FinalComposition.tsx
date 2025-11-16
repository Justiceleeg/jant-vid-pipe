'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useVideoComposition } from '@/hooks/useVideoComposition';
import { Button } from '@/components/ui/button';
import type { CompositionRequest } from '@/types/composition.types';

interface FinalCompositionProps {
  onBack: () => void;
}

export function FinalComposition({ onBack }: FinalCompositionProps) {
  const {
    generatedClips,
    audioUrl,
    finalVideo,
    compositionProgress,
  } = useAppStore();

  const {
    composeVideo,
    jobStatus,
    isLoading,
    error,
    clearError,
  } = useVideoComposition();

  const [hasStarted, setHasStarted] = useState(false);

  const handleStartComposition = async () => {
    if (!generatedClips || generatedClips.length === 0) {
      alert('No video clips available');
      return;
    }

    const request: CompositionRequest = {
      clips: generatedClips
        .filter((clip) => clip.video_url && clip.status === 'completed')
        .map((clip) => ({
          scene_number: clip.scene_number,
          video_url: clip.video_url!,
          duration: clip.duration,
        })),
      audio_url: audioUrl,
      include_crossfade: true,
      optimize_size: true,
      target_size_mb: 50,
    };

    if (request.clips.length === 0) {
      alert('No completed video clips available');
      return;
    }

    setHasStarted(true);
    await composeVideo(request);
  };

  const isComplete = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed';

  // Auto-start composition when component mounts (if not already started)
  useEffect(() => {
    if (!hasStarted && !finalVideo && generatedClips.length > 0) {
      handleStartComposition();
    }
  }, []);

  const handleDownload = () => {
    if (jobStatus?.video_url) {
      // Download URL is relative to API
      const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${jobStatus.video_url}`;
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Step 5: Final Video Composition</h2>
          <p className="text-muted-foreground mt-1">
            Composing your final video with music and transitions
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Back to Video Generation
        </Button>
      </div>

      {/* Not Started */}
      {!hasStarted && !isLoading && !jobStatus && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 text-center space-y-4">
          <div className="text-4xl">🎥</div>
          <h3 className="text-xl font-semibold">Ready to Compose Final Video</h3>
          <p className="text-muted-foreground">
            We'll stitch together {generatedClips.filter((c) => c.status === 'completed').length} clips
            with crossfade transitions and background music.
          </p>
          <Button onClick={handleStartComposition} size="lg">
            Start Final Composition
          </Button>
        </div>
      )}

      {/* In Progress */}
      {(hasStarted || isLoading || (jobStatus && !isComplete && !isFailed)) && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-4xl animate-pulse">🎬</div>
            <h3 className="text-xl font-semibold">
              {jobStatus?.current_step || 'Composing video...'}
            </h3>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-500 ease-out"
                style={{ width: `${compositionProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {compositionProgress}% complete
            </p>

            {jobStatus && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Total clips: {jobStatus.total_clips}</p>
                {jobStatus.file_size_mb && (
                  <p>Current size: {jobStatus.file_size_mb.toFixed(2)} MB</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed */}
      {isComplete && finalVideo && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h3 className="text-2xl font-bold">Your Video is Ready!</h3>
            <p className="text-muted-foreground">
              Your 30-second video has been successfully created
            </p>

            {/* Video Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              {jobStatus?.duration_seconds && (
                <div className="text-center">
                  <div className="text-2xl font-bold">{jobStatus.duration_seconds.toFixed(1)}s</div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                </div>
              )}
              {jobStatus?.file_size_mb && (
                <div className="text-center">
                  <div className="text-2xl font-bold">{jobStatus.file_size_mb.toFixed(1)} MB</div>
                  <div className="text-xs text-muted-foreground">File Size</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold">{generatedClips.length}</div>
                <div className="text-xs text-muted-foreground">Clips</div>
              </div>
            </div>

            {/* Download Button */}
            <div className="flex justify-center gap-4 pt-4">
              <Button onClick={handleDownload} size="lg">
                📥 Download Video
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Create Another Video
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
            <Button size="sm" onClick={handleStartComposition}>
              Retry Composition
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
