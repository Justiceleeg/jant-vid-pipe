'use client';

import React from 'react';
import type { VideoClip } from '@/types/video.types';

interface ClipProgressProps {
  clip: VideoClip;
  sceneDescription?: string;
}

export function ClipProgress({ clip, sceneDescription }: ClipProgressProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Complete';
      case 'processing':
        return 'Generating...';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className={`rounded-lg border-2 p-4 transition-all duration-300 ${getStatusColor(clip.status)}`}>
      <div className="flex items-center justify-between mb-3">
        {/* Scene number and status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-current/10 font-bold text-sm">
            {clip.scene_number}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(clip.status)}
            <span className="font-medium text-sm">{getStatusText(clip.status)}</span>
          </div>
        </div>

        {/* Duration */}
        <div className="text-xs font-medium opacity-75">
          {clip.duration.toFixed(1)}s
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="opacity-75">Progress</span>
          <span className="font-medium">{clip.progress_percent}%</span>
        </div>
        <div className="h-2 bg-current/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-current transition-all duration-500 ease-out rounded-full"
            style={{ width: `${clip.progress_percent}%` }}
          />
        </div>
      </div>

      {/* Scene description */}
      {sceneDescription && (
        <p className="text-xs opacity-75 line-clamp-2">{sceneDescription}</p>
      )}

      {/* Error message */}
      {clip.error && (
        <div className="mt-2 text-xs bg-current/10 rounded px-2 py-1">
          {clip.error}
        </div>
      )}

      {/* Video preview for completed clips */}
      {clip.status === 'completed' && clip.video_url && (
        <div className="mt-3">
          <a
            href={clip.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium hover:underline flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            View video
          </a>
        </div>
      )}
    </div>
  );
}
