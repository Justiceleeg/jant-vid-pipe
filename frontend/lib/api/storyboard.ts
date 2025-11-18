/**
 * API Client for Storyboard Operations
 *
 * This module provides typed API client functions for the Unified Storyboard Interface.
 * Based on the PRD endpoint specifications.
 */

import type {
  StoryboardInitializeRequest,
  StoryboardInitializeResponse,
  StoryboardScene,
  SceneTextUpdateRequest,
  SceneTextGenerateRequest,
  SceneImageGenerateRequest,
  SceneDurationUpdateRequest,
  SceneVideoGenerateRequest,
  SceneVideoGenerateResponse,
  SceneStatusResponse,
  StoryboardPreviewResponse,
  Storyboard,
} from '@/types/storyboard.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Base fetch wrapper with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    
    // Provide helpful error messages for common status codes
    if (response.status === 404) {
      throw new Error(
        `Backend endpoint not found: ${endpoint}. The backend API may not be fully implemented yet. Please check with the backend team.`
      );
    }
    
    throw new Error(error.message || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 1. Initialize a new storyboard with generated scene texts
 * POST /api/storyboards/initialize
 */
export async function initializeStoryboard(
  request: StoryboardInitializeRequest
): Promise<StoryboardInitializeResponse> {
  return apiRequest<StoryboardInitializeResponse>('/api/storyboards/initialize', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * 2. Retrieve full storyboard with all scenes
 * GET /api/storyboards/{storyboard_id}
 */
export async function getStoryboard(
  storyboardId: string
): Promise<{ storyboard: Storyboard; scenes: StoryboardScene[] }> {
  return apiRequest<{ storyboard: Storyboard; scenes: StoryboardScene[] }>(
    `/api/storyboards/${storyboardId}`
  );
}

/**
 * 3. Update scene text manually
 * PATCH /api/scenes/{scene_id}/text
 */
export async function updateSceneText(
  sceneId: string,
  newText: string
): Promise<StoryboardScene> {
  return apiRequest<StoryboardScene>(`/api/scenes/${sceneId}/text`, {
    method: 'PATCH',
    body: JSON.stringify({ new_text: newText } as SceneTextUpdateRequest),
  });
}

/**
 * 4. Regenerate scene text with AI
 * POST /api/scenes/{scene_id}/generate-text
 */
export async function generateSceneText(
  sceneId: string,
  creativeBrief: any
): Promise<StoryboardScene> {
  return apiRequest<StoryboardScene>(`/api/scenes/${sceneId}/generate-text`, {
    method: 'POST',
    body: JSON.stringify({ creative_brief: creativeBrief } as SceneTextGenerateRequest),
  });
}

/**
 * 5. Generate image for scene
 * POST /api/scenes/{scene_id}/generate-image
 */
export async function generateSceneImage(
  sceneId: string
): Promise<StoryboardScene> {
  return apiRequest<StoryboardScene>(`/api/scenes/${sceneId}/generate-image`, {
    method: 'POST',
  });
}

/**
 * 6. Regenerate scene image
 * POST /api/scenes/{scene_id}/regenerate-image
 */
export async function regenerateSceneImage(
  sceneId: string
): Promise<StoryboardScene> {
  return apiRequest<StoryboardScene>(`/api/scenes/${sceneId}/regenerate-image`, {
    method: 'POST',
  });
}

/**
 * 7. Update scene duration
 * PATCH /api/scenes/{scene_id}/duration
 */
export async function updateSceneDuration(
  sceneId: string,
  newDuration: number
): Promise<StoryboardScene> {
  return apiRequest<StoryboardScene>(`/api/scenes/${sceneId}/duration`, {
    method: 'PATCH',
    body: JSON.stringify({ new_duration: newDuration } as SceneDurationUpdateRequest),
  });
}

/**
 * 8. Generate video for scene (async)
 * POST /api/scenes/{scene_id}/generate-video
 */
export async function generateSceneVideo(
  sceneId: string
): Promise<SceneVideoGenerateResponse> {
  return apiRequest<SceneVideoGenerateResponse>(`/api/scenes/${sceneId}/generate-video`, {
    method: 'POST',
  });
}

/**
 * 9. Regenerate scene video (async)
 * POST /api/scenes/{scene_id}/regenerate-video
 */
export async function regenerateSceneVideo(
  sceneId: string
): Promise<SceneVideoGenerateResponse> {
  return apiRequest<SceneVideoGenerateResponse>(`/api/scenes/${sceneId}/regenerate-video`, {
    method: 'POST',
  });
}

/**
 * 10. Get scene status (polling fallback for SSE)
 * GET /api/scenes/{scene_id}/status
 */
export async function getSceneStatus(
  sceneId: string
): Promise<SceneStatusResponse> {
  return apiRequest<SceneStatusResponse>(`/api/scenes/${sceneId}/status`);
}

/**
 * 11. Regenerate all scenes
 * POST /api/storyboards/{storyboard_id}/regenerate-all
 */
export async function regenerateAllScenes(
  storyboardId: string
): Promise<{ storyboard: Storyboard; scenes: StoryboardScene[] }> {
  return apiRequest<{ storyboard: Storyboard; scenes: StoryboardScene[] }>(
    `/api/storyboards/${storyboardId}/regenerate-all`,
    { method: 'POST' }
  );
}

/**
 * 12. Get preview data for concatenated video
 * GET /api/storyboards/{storyboard_id}/preview
 */
export async function getStoryboardPreview(
  storyboardId: string
): Promise<StoryboardPreviewResponse> {
  return apiRequest<StoryboardPreviewResponse>(`/api/storyboards/${storyboardId}/preview`);
}

/**
 * 13. Create SSE connection for real-time updates
 * GET /api/storyboards/{storyboard_id}/events (SSE)
 */
export function createSSEConnection(
  storyboardId: string,
  onUpdate: (event: MessageEvent) => void,
  onError?: (error: Event) => void
): EventSource {
  const eventSource = new EventSource(`${API_BASE_URL}/api/storyboards/${storyboardId}/events`);

  eventSource.addEventListener('scene_update', onUpdate);
  eventSource.addEventListener('error', onError || ((e) => console.error('SSE error:', e)));
  eventSource.addEventListener('complete', onUpdate);

  return eventSource;
}

/**
 * Close SSE connection
 */
export function closeSSEConnection(eventSource: EventSource): void {
  eventSource.close();
}
