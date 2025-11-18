'use client';

import React, { useState } from 'react';
import type { Storyboard, StoryboardScene } from '@/types/storyboard.types';
import { Button } from '@/components/ui/button';
import { SceneTimelineNew } from './SceneTimelineNew';
import { SceneCardNew } from './SceneCardNew';
import { PreviewPlayer } from './PreviewPlayer';

interface StoryboardCarouselProps {
  storyboard: Storyboard;
  scenes: StoryboardScene[];
  onRegenerateAll: () => Promise<void>;
  onPreviewAll: () => void;
  onGenerateFinalVideo: () => void;
  // Scene actions
  onApproveText: (sceneId: string) => Promise<void>;
  onRegenerateText: (sceneId: string) => Promise<void>;
  onEditText: (sceneId: string, newText: string) => Promise<void>;
  onApproveImage: (sceneId: string) => Promise<void>;
  onRegenerateImage: (sceneId: string) => Promise<void>;
  onUpdateDuration: (sceneId: string, newDuration: number) => Promise<void>;
  onRegenerateVideo: (sceneId: string) => Promise<void>;
  isLoading?: boolean;
}

export function StoryboardCarousel({
  storyboard,
  scenes,
  onRegenerateAll,
  onPreviewAll,
  onGenerateFinalVideo,
  onApproveText,
  onRegenerateText,
  onEditText,
  onApproveImage,
  onRegenerateImage,
  onUpdateDuration,
  onRegenerateVideo,
  isLoading = false,
}: StoryboardCarouselProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Get current scene based on scene_order
  const currentSceneId = storyboard.scene_order[currentSceneIndex];
  const currentScene = scenes.find(s => s.id === currentSceneId);

  // Calculate readiness for final video generation
  const allScenesReady = scenes.every(scene => scene.state === 'video' && scene.generation_status.video === 'complete');
  const readyCount = scenes.filter(scene => scene.state === 'video' && scene.generation_status.video === 'complete').length;
  const totalScenes = scenes.length;

  // Handle timeline click to navigate to scene
  const handleTimelineClick = (index: number) => {
    setCurrentSceneIndex(index);
  };

  // Handle regenerate all with confirmation
  const handleRegenerateAll = async () => {
    const confirmed = window.confirm(
      'All scenes and progress will be erased. This cannot be undone. Are you sure?'
    );

    if (confirmed) {
      setIsRegeneratingAll(true);
      try {
        await onRegenerateAll();
      } finally {
        setIsRegeneratingAll(false);
      }
    }
  };

  if (!currentScene) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No scene found</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Timeline */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-4">
        <SceneTimelineNew
          scenes={scenes}
          sceneOrder={storyboard.scene_order}
          currentSceneIndex={currentSceneIndex}
          onSceneClick={handleTimelineClick}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => setIsPreviewOpen(true)}
          disabled={isLoading || scenes.length === 0}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Preview All Scenes
        </Button>

        <Button
          variant="destructive"
          onClick={handleRegenerateAll}
          disabled={isLoading || isRegeneratingAll}
        >
          {isRegeneratingAll ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Regenerating...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Regenerate All Scenes
            </>
          )}
        </Button>
      </div>

      {/* Carousel Container */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentSceneIndex * 100}%)` }}
        >
          {storyboard.scene_order.map((sceneId) => {
            const scene = scenes.find(s => s.id === sceneId);
            if (!scene) return null;

            return (
              <div
                key={scene.id}
                className="w-full flex-shrink-0"
                style={{ minWidth: '100%' }}
              >
                <SceneCardNew
                  scene={scene}
                  sceneNumber={storyboard.scene_order.indexOf(scene.id) + 1}
                  onApproveText={() => onApproveText(scene.id)}
                  onRegenerateText={() => onRegenerateText(scene.id)}
                  onEditText={(newText) => onEditText(scene.id, newText)}
                  onApproveImage={() => onApproveImage(scene.id)}
                  onRegenerateImage={() => onRegenerateImage(scene.id)}
                  onUpdateDuration={(newDuration) => onUpdateDuration(scene.id, newDuration)}
                  onRegenerateVideo={() => onRegenerateVideo(scene.id)}
                  isLoading={isLoading}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate Final Video Button */}
      {allScenesReady && (
        <div className="flex flex-col items-center gap-3 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {readyCount}/{totalScenes} scenes ready
          </p>
          <Button
            size="lg"
            onClick={onGenerateFinalVideo}
            disabled={!allScenesReady || isLoading}
          >
            Generate Final Video
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Button>
        </div>
      )}

      {/* Preview Player Modal */}
      <PreviewPlayer
        scenes={scenes}
        sceneOrder={storyboard.scene_order}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
