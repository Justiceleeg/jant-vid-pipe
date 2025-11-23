'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { STEPS } from '@/lib/steps';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function AudioPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { setCurrentStep } = useAppStore();

  const {
    renderedVideoUrl,
    renderedVideoDuration,
    isRenderingVideo,
  } = useAppStore();


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

  const handleWantAudio = () => {
    // Navigate to audio generation page
    router.push(`/project/${projectId}/audio/generate`);
  };

  // Show loading state while rendering
  if (isRenderingVideo || !renderedVideoUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
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
    <div className="w-full max-w-4xl space-y-6">
      {/* Rendered Video Display */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
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
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Would you like to add audio to this video?</h3>
        <p className="text-sm text-muted-foreground">
          Generate background music that matches your video's mood and duration.
        </p>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center pt-4">
          <Button
            onClick={handleSkipAudio}
            variant="outline"
            size="lg"
          >
            I don't want audio
          </Button>
          <Button
            onClick={handleWantAudio}
            size="lg"
            className="bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
          >
            I want audio
          </Button>
        </div>
      </div>
    </div>
  );
}

