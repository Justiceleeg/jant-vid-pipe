'use client';

import React from 'react';
import type { Scene } from '@/types/scene.types';

interface SceneTimelineProps {
  scenes: Scene[];
  totalDuration: number;
}

export function SceneTimeline({ scenes, totalDuration }: SceneTimelineProps) {
  // Calculate cumulative positions for each scene
  const scenePositions = scenes.reduce((acc, scene, idx) => {
    const prevDuration = idx === 0 ? 0 : acc[idx - 1].end;
    return [
      ...acc,
      {
        start: prevDuration,
        end: prevDuration + scene.duration,
        scene_number: scene.scene_number,
      },
    ];
  }, [] as Array<{ start: number; end: number; scene_number: number }>);

  return (
    <div className="w-full space-y-2">
      {/* Timeline header */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>Timeline</span>
        <span className="font-medium">{totalDuration.toFixed(1)}s total</span>
      </div>

      {/* Timeline visualization */}
      <div className="relative w-full h-16 bg-muted rounded-lg overflow-hidden border border-border">
        {/* Time markers */}
        <div className="absolute inset-0 flex">
          {[0, 5, 10, 15, 20, 25, 30].map((time) => (
            <div
              key={time}
              className="absolute h-full border-l border-border/50"
              style={{ left: `${(time / totalDuration) * 100}%` }}
            >
              <span className="absolute -top-5 left-0 -translate-x-1/2 text-xs text-muted-foreground">
                {time}s
              </span>
            </div>
          ))}
        </div>

        {/* Scene blocks */}
        <div className="relative h-full flex">
          {scenePositions.map((pos, idx) => {
            const widthPercentage = ((pos.end - pos.start) / totalDuration) * 100;
            const leftPercentage = (pos.start / totalDuration) * 100;

            // Generate a unique color for each scene
            const hue = (idx * 360) / scenes.length;
            const backgroundColor = `hsl(${hue}, 70%, 60%)`;
            const borderColor = `hsl(${hue}, 70%, 50%)`;

            return (
              <div
                key={pos.scene_number}
                className="absolute h-full flex items-center justify-center border-r-2 transition-all hover:opacity-80 cursor-pointer group"
                style={{
                  left: `${leftPercentage}%`,
                  width: `${widthPercentage}%`,
                  backgroundColor,
                  borderRightColor: borderColor,
                }}
                title={`Scene ${pos.scene_number}: ${pos.start.toFixed(1)}s - ${pos.end.toFixed(1)}s`}
              >
                <div className="flex flex-col items-center justify-center text-white drop-shadow-md">
                  <span className="font-bold text-sm">{pos.scene_number}</span>
                  <span className="text-xs opacity-90 group-hover:opacity-100">
                    {(pos.end - pos.start).toFixed(1)}s
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scene legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {scenes.map((scene, idx) => {
          const hue = (idx * 360) / scenes.length;
          const color = `hsl(${hue}, 70%, 60%)`;

          return (
            <div key={scene.scene_number} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-sm border border-border"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">
                Scene {scene.scene_number}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
