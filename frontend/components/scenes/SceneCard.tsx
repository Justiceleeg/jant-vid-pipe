'use client';

import React from 'react';
import Image from 'next/image';
import type { Scene } from '@/types/scene.types';

interface SceneCardProps {
  scene: Scene;
  isLoading?: boolean;
}

export function SceneCard({ scene, isLoading = false }: SceneCardProps) {
  return (
    <div className="relative rounded-lg border-2 border-border bg-card transition-all duration-300 hover:shadow-md">
      {/* Scene number badge */}
      <div className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
        {scene.scene_number}
      </div>

      {/* Duration badge */}
      <div className="absolute top-3 right-3 z-10 bg-background/90 backdrop-blur-sm text-foreground rounded-full px-3 py-1 text-xs font-medium border border-border">
        {scene.duration.toFixed(1)}s
      </div>

      {/* Seed image */}
      <div className="relative aspect-[9/16] rounded-t-lg overflow-hidden bg-muted">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">
              Generating image...
            </div>
          </div>
        ) : scene.seed_image_url ? (
          <Image
            src={scene.seed_image_url}
            alt={`Scene ${scene.scene_number}: ${scene.description}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : scene.generation_error ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <svg
              className="w-12 h-12 text-muted-foreground mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-xs text-muted-foreground">Image generation failed</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-muted-foreground text-sm">No image</div>
          </div>
        )}
      </div>

      {/* Scene details */}
      <div className="p-4 space-y-3">
        {/* Description */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
          <p className="text-sm leading-relaxed">{scene.description}</p>
        </div>

        {/* Style prompt */}
        {scene.style_prompt && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Style</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {scene.style_prompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
