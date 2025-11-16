'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import { VideoGenerationProgress } from '@/components/video';
import { Button } from '@/components/ui/button';
import type { VideoGenerationRequest } from '@/types/video.types';
import type { AudioGenerationRequest } from '@/types/audio.types';

interface VideoGenerationProps {
  onComplete: () => void;
  onBack: () => void;
}

export function VideoGeneration({ onComplete, onBack }: VideoGenerationProps) {
  const {
    scenePlan,
    moods,
    selectedMoodId,
    creativeBrief,
    generatedClips,
    audioUrl,
    setGeneratedClips,
  } = useAppStore();

  const {
    jobStatus: videoStatus,
    isGenerating,
    error: videoError,
    startGeneration,
    clearError: clearVideoError,
  } = useVideoGeneration();

  const {
    generateAudio,
    isLoading: isAudioLoading,
    error: audioError,
    clearError: clearAudioError,
  } = useAudioGeneration();

  const [hasStarted, setHasStarted] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const selectedMood = moods.find((m) => m.id === selectedMoodId);

  // Debug: Log what's in the store
  useEffect(() => {
    console.log('🔍 Checking for existing clips:', {
      generatedClips,
      length: generatedClips?.length,
      hasClips: generatedClips && generatedClips.length > 0
    });
  }, []);

  // Check if we have existing clips (from previous session or page refresh)
  useEffect(() => {
    if (generatedClips && generatedClips.length > 0) {
      console.log('✅ Found existing clips, setting hasStarted to true');
      setHasStarted(true);
    }
  }, [generatedClips]);

  // Sync video clips from job status to store
  useEffect(() => {
    console.log('📊 Job Status Update:', {
      hasVideoStatus: !!videoStatus,
      status: videoStatus?.status,
      clipsLength: videoStatus?.clips?.length,
      clips: videoStatus?.clips
    });

    if (videoStatus?.clips && videoStatus.clips.length > 0) {
      console.log('💾 Saving clips to store:', videoStatus.clips);
      setGeneratedClips(videoStatus.clips);
    }
  }, [videoStatus, setGeneratedClips]);

  // Auto-generate audio when component mounts (if not already generated)
  useEffect(() => {
    if (!audioUrl && selectedMood && creativeBrief && !isAudioLoading && !isGeneratingAudio) {
      setIsGeneratingAudio(true);
      handleGenerateAudio();
    }
  }, []);

  const handleGenerateAudio = async () => {
    if (!selectedMood || !creativeBrief) return;

    const audioRequest: AudioGenerationRequest = {
      mood_name: selectedMood.name,
      mood_description: selectedMood.description,
      emotional_tone: creativeBrief.emotional_tone,
      aesthetic_direction: selectedMood.aesthetic_direction,
      style_keywords: selectedMood.style_keywords,
      duration: 30,
    };

    await generateAudio(audioRequest);
    setIsGeneratingAudio(false);
  };

  const handleStartGeneration = async () => {
    if (!scenePlan || !selectedMood) {
      return;
    }

    // Filter scenes with seed images
    const scenesWithImages = scenePlan.scenes.filter((s) => s.seed_image_url);

    if (scenesWithImages.length === 0) {
      alert('No scenes with seed images found');
      return;
    }

    const request: VideoGenerationRequest = {
      scenes: scenesWithImages.map((scene) => ({
        scene_number: scene.scene_number,
        duration: scene.duration,
        description: scene.description,
        style_prompt: scene.style_prompt,
        seed_image_url: scene.seed_image_url!,
      })),
      mood_style_keywords: selectedMood.style_keywords,
      mood_aesthetic_direction: selectedMood.aesthetic_direction,
    };

    setHasStarted(true);
    await startGeneration(request);
  };

  const isComplete = videoStatus?.status === 'completed' ||
    (generatedClips.length > 0 && generatedClips.every(c => c.status === 'completed'));
  const hasFailed = videoStatus?.status === 'failed';
  const hasExistingClips = generatedClips && generatedClips.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Step 4: Generate Video Clips</h2>
          <p className="text-muted-foreground mt-1">
            Generate video clips from your storyboard scenes
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Back to Storyboard
        </Button>
      </div>

      {/* Audio Generation Status */}
      {isAudioLoading && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            🎵 Generating background music...
          </p>
        </div>
      )}

      {audioUrl && !isAudioLoading && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <p className="text-sm font-semibold text-green-900 dark:text-green-100">
              Background music ready!
            </p>
          </div>

          {/* Audio Player */}
          <div className="bg-white dark:bg-zinc-900 rounded-md p-3 border border-green-200 dark:border-green-700">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎵</span>
              <div className="flex-1">
                <audio
                  controls
                  src={audioUrl}
                  className="w-full"
                  preload="metadata"
                  style={{
                    height: '32px',
                    accentColor: '#22c55e',
                  }}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Preview your 30-second background music
            </p>
          </div>
        </div>
      )}

      {audioError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{audioError}</p>
        </div>
      )}

      {/* Video Generation Status */}
      {!hasStarted && !isGenerating && !hasExistingClips && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 text-center space-y-4">
          <div className="text-4xl">🎬</div>
          <h3 className="text-xl font-semibold">Ready to Generate Video Clips</h3>
          <p className="text-muted-foreground">
            We'll generate {scenePlan?.scenes.length || 0} video clips from your storyboard.
            <br />
            This may take several minutes.
          </p>
          <Button
            onClick={handleStartGeneration}
            size="lg"
            disabled={!audioUrl || isAudioLoading}
          >
            Start Video Generation
          </Button>
        </div>
      )}

      {/* Progress Display */}
      {((hasStarted || isGenerating || isComplete || hasExistingClips) && videoStatus) && (
        <VideoGenerationProgress
          jobStatus={videoStatus}
          scenes={scenePlan?.scenes}
        />
      )}

      {/* Show clips even without job status (for resumed sessions) */}
      {hasExistingClips && !videoStatus && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Generated Video Clips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedClips.map((clip) => (
              <div key={clip.scene_number} className="bg-white dark:bg-zinc-900 border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 font-bold text-sm text-green-600 dark:text-green-400">
                      {clip.scene_number}
                    </div>
                    <span className="font-medium text-sm text-green-600 dark:text-green-400">Complete</span>
                  </div>
                  <div className="text-xs font-medium opacity-75">
                    {clip.duration.toFixed(1)}s
                  </div>
                </div>
                {clip.video_url && (
                  <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-black border-2 border-green-200 dark:border-green-800">
                      <video
                        controls
                        preload="metadata"
                        className="w-full aspect-[9/16] object-contain"
                        style={{ maxHeight: '300px' }}
                      >
                        <source src={clip.video_url} type="video/mp4" />
                        Your browser does not support the video element.
                      </video>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {videoError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{videoError}</p>
          <Button variant="outline" size="sm" onClick={clearVideoError} className="mt-2">
            Dismiss
          </Button>
        </div>
      )}

      {/* Continue Button */}
      {(isComplete || hasExistingClips) && generatedClips.length > 0 && (
        <div className="flex justify-center">
          <Button onClick={onComplete} size="lg">
            Continue to Final Composition →
          </Button>
        </div>
      )}
    </div>
  );
}
