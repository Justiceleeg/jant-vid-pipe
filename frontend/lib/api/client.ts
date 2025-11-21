/**
 * API Client for FastAPI Backend
 * 
 * This module provides typed API client functions for communicating
 * with the FastAPI backend at localhost:8000.
 */

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
    throw new Error(error.message || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Health check endpoint
 */
export async function checkHealth(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/health');
}

import type { MoodGenerationRequest, MoodGenerationResponse } from '@/types/mood.types';
import type { ScenePlanRequest, ScenePlanResponse } from '@/types/scene.types';
import type { AudioGenerationRequest, AudioGenerationResponse } from '@/types/audio.types';

/**
 * Generate mood boards from a creative brief
 */
export async function generateMoods(
  creativeBrief: MoodGenerationRequest,
  projectId?: string
): Promise<MoodGenerationResponse> {
  // Build URL with optional project ID query parameter
  const url = projectId
    ? `/api/moods/generate?project_id=${encodeURIComponent(projectId)}`
    : '/api/moods/generate';

  return apiRequest<MoodGenerationResponse>(url, {
    method: 'POST',
    body: JSON.stringify(creativeBrief),
  });
}

/**
 * Generate scene plan with seed images from creative brief and mood
 */
export async function generateScenePlan(
  request: ScenePlanRequest
): Promise<ScenePlanResponse> {
  return apiRequest<ScenePlanResponse>('/api/scenes/plan', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Generate background music for a mood
 */
export async function generateAudio(
  request: AudioGenerationRequest
): Promise<AudioGenerationResponse> {
  return apiRequest<AudioGenerationResponse>('/api/audio/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

