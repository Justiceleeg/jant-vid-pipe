'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/button';
import { STEPS } from '@/lib/steps';
import type { AudioGenerationRequest } from '@/types/audio.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function AudioPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { addToast } = useToast();
  const { setCurrentStep } = useAppStore();

  const {
    renderedVideoUrl,
    renderedVideoDuration,
    isRenderingVideo,
    creativeBrief,
    moods,
    selectedMoodId,
    setAudioUrl,
  } = useAppStore();

  const { generateAudio, isLoading: isGeneratingAudio, error: audioError } = useAudioGeneration();

  const [hasError, setHasError] = useState(false);

  // Show toast for audio errors
  useEffect(() => {
    if (audioError) {
      setHasError(true);
      addToast({
        type: 'error',
        message: audioError,
        duration: 5000,
      });
    }
  }, [audioError, addToast]);

  // Redirect if no rendered video and not rendering
  useEffect(() => {
    if (!renderedVideoUrl && !isRenderingVideo) {
      router.push(`/project/${projectId}/scenes`);
    }
  }, [renderedVideoUrl, isRenderingVideo, projectId, router]);

  const handleSkipAudio = () => {
    // Navigate to final page without audio
    setCurrentStep(STEPS.FINAL);
    router.push(`/project/${projectId}/final`);
  };

  const handleGenerateAudio = async () => {
    if (!creativeBrief || !selectedMoodId || !moods.length || !renderedVideoDuration) {
      addToast({
        type: 'error',
        message: 'Missing required data for audio generation',
        duration: 5000,
      });
      return;
    }

    const selectedMood = moods.find((m) => (m as any).mood_id === selectedMoodId || m.id === selectedMoodId);
    if (!selectedMood) {
      addToast({
        type: 'error',
        message: 'Selected mood not found',
        duration: 5000,
      });
      return;
    }

    const moodName = (selectedMood as any).style_name || selectedMood.name;

    const audioRequest: AudioGenerationRequest = {
      mood_name: moodName,
      mood_description: selectedMood.aesthetic_direction || '',
      emotional_tone: creativeBrief.emotional_tone || [],
      aesthetic_direction: selectedMood.aesthetic_direction || '',
      style_keywords: selectedMood.style_keywords || [],
      duration: Math.round(renderedVideoDuration), // Use rendered video duration
    };

    setHasError(false);
    const audioUrl = await generateAudio(audioRequest);

    if (audioUrl) {
      // Navigate to final page with audio
      setCurrentStep(STEPS.FINAL);
      router.push(`/project/${projectId}/final`);
    }
  };

  const handleRetryAudio = () => {
    setHasError(false);
    handleGenerateAudio();
  };

  // Show loading state while rendering
  if (isRenderingVideo || !renderedVideoUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Rendering Your Video</h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we combine all your scenes into a single video...
          </p>
        </div>
      </div>
    );
  }

  // Construct full video URL
  const videoUrl = renderedVideoUrl.startsWith('http') 
    ? renderedVideoUrl 
    : `${API_URL}${renderedVideoUrl}`;

  return (
    <div className="w-full max-w-4xl h-full flex flex-col min-h-0 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center space-y-6 py-4">
        {/* Rendered Video Display */}
        <div className="bg-card border rounded-lg p-6 space-y-4 flex-shrink-0">
          <h3 className="text-lg font-semibold">Your Rendered Video</h3>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Duration: {renderedVideoDuration ? `${renderedVideoDuration.toFixed(1)}s` : 'Unknown'}
          </p>
        </div>

        {/* Audio Options */}
        <div className="bg-card border rounded-lg p-6 space-y-4 flex-shrink-0">
          <h3 className="text-lg font-semibold">Would you like to add audio to this video?</h3>
          <p className="text-sm text-muted-foreground">
            Generate background music that matches your video's mood and duration.
          </p>

          {/* Error State */}
          {hasError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-destructive font-medium">Audio generation failed</p>
              <div className="flex gap-2">
                <Button
                  onClick={handleRetryAudio}
                  disabled={isGeneratingAudio}
                  variant="outline"
                  size="sm"
                >
                  Retry
                </Button>
                <Button
                  onClick={handleSkipAudio}
                  variant="outline"
                  size="sm"
                >
                  Skip Audio
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!hasError && (
            <div className="flex gap-4 justify-center pt-4">
              <Button
                onClick={handleSkipAudio}
                variant="outline"
                size="lg"
                disabled={isGeneratingAudio}
              >
                Skip Audio
              </Button>
              <Button
                onClick={handleGenerateAudio}
                size="lg"
                disabled={isGeneratingAudio}
                className="bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
              >
                {isGeneratingAudio ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[rgb(196,230,43)] border-t-transparent rounded-full animate-spin mr-2" />
                    Generating Audio...
                  </>
                ) : (
                  'Generate Audio'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

