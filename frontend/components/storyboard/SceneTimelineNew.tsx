'use client';

import React from 'react';
import type { StoryboardScene, SceneState, GenerationStatus } from '@/types/storyboard.types';

interface SceneTimelineNewProps {
  scenes: StoryboardScene[];
  sceneOrder: string[];
  currentSceneIndex: number;
  onSceneClick: (index: number) => void;
}

// Color coding based on PRD specifications
const getSceneColor = (state: SceneState, generationStatus: GenerationStatus | undefined, hasError: boolean): string => {
  if (hasError) {
    return 'hsl(0, 70%, 50%)'; // Red for errors
  }

  switch (state) {
    case 'text':
      return 'hsl(220, 10%, 40%)'; // Gray
    case 'image':
      return 'hsl(45, 90%, 60%)'; // Yellow
    case 'video':
      return 'hsl(140, 70%, 50%)'; // Green
    default:
      return 'hsl(220, 10%, 40%)'; // Default gray
  }
};

const getSceneLabel = (state: SceneState): string => {
  switch (state) {
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    default:
      return 'Unknown';
  }
};

const isGenerating = (scene: StoryboardScene): boolean => {
  return (
    scene.generation_status.image === 'generating' ||
    scene.generation_status.video === 'generating'
  );
};

export function SceneTimelineNew({
  scenes,
  sceneOrder,
  currentSceneIndex,
  onSceneClick,
}: SceneTimelineNewProps) {
  return (
    <div className="w-full space-y-3">
      {/* Timeline header */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-medium">Scene Timeline</h3>
        <span className="text-xs text-muted-foreground">
          {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
        </span>
      </div>

      {/* Timeline visualization */}
      <div className="relative w-full">
        <div className="flex gap-2">
          {sceneOrder.map((sceneId, index) => {
            const scene = scenes.find(s => s.id === sceneId);
            if (!scene) return null;

            const hasError = scene.error_message !== null && scene.error_message !== undefined;
            const color = getSceneColor(
              scene.state,
              scene.state === 'image' ? scene.generation_status.image : scene.generation_status.video,
              hasError
            );
            const isActive = index === currentSceneIndex;
            const isSceneGenerating = isGenerating(scene);

            return (
              <button
                key={scene.id}
                onClick={() => onSceneClick(index)}
                className={`
                  flex-1 min-h-[80px] rounded-lg border-2 transition-all duration-200
                  hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                  ${isActive ? 'border-primary shadow-lg scale-105' : 'border-transparent'}
                  ${isSceneGenerating ? 'animate-pulse' : ''}
                `}
                style={{ backgroundColor: color }}
                aria-label={`Scene ${index + 1}: ${getSceneLabel(scene.state)} state${isActive ? ' (current)' : ''}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-white drop-shadow-md">
                  {/* Scene number */}
                  <div className="text-xl font-bold">
                    {index + 1}
                  </div>

                  {/* State label */}
                  <div className="text-[10px] uppercase font-medium tracking-wide mt-1">
                    {getSceneLabel(scene.state)}
                  </div>

                  {/* Generating indicator */}
                  {isSceneGenerating && (
                    <div className="mt-1">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Error indicator */}
                  {hasError && (
                    <div className="mt-1" title={scene.error_message || 'Error occurred'}>
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: 'hsl(220, 10%, 40%)' }}
          />
          <span className="text-xs text-muted-foreground">Text</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: 'hsl(45, 90%, 60%)' }}
          />
          <span className="text-xs text-muted-foreground">Image</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: 'hsl(140, 70%, 50%)' }}
          />
          <span className="text-xs text-muted-foreground">Video</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: 'hsl(0, 70%, 50%)' }}
          />
          <span className="text-xs text-muted-foreground">Error</span>
        </div>
      </div>
    </div>
  );
}
