import type { BackgroundAssetStatus, BackgroundGenerationRequest, BackgroundGenerationResponse } from '@/types/background.types';
import * as assetAPI from './asset';

const API_PREFIX = 'background';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authentication token - similar to other API modules
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  // In development, use demo token
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
    return 'demo-token';
  }

  try {
    const clerk = (window as any).Clerk;
    if (!clerk) {
      console.warn('Clerk not initialized');
      return null;
    }

    await clerk.load();
    const session = clerk.session;
    if (!session) {
      console.warn('No active Clerk session');
      return null;
    }

    const token = await session.getToken();
    return token;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    // In development, fall back to demo token
    if (process.env.NODE_ENV === 'development') {
      return 'demo-token';
    }
    return null;
  }
}

export async function generateBackgrounds(
  creativeBrief: BackgroundGenerationRequest
): Promise<BackgroundGenerationResponse> {
  console.log('[API] generateBackgrounds called with:', creativeBrief);
  const authToken = await getAuthToken();
  console.log('[API] Auth token:', authToken ? 'present' : 'missing');
  
  const url = `${API_URL}/api/background/generate`;
  console.log('[API] Making request to:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    body: JSON.stringify(creativeBrief),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate backgrounds' }));
    throw new Error(error.detail || error.message || 'Failed to generate backgrounds');
  }
  
  return response.json();
}

export async function getBackgroundAsset(assetId: string): Promise<BackgroundAssetStatus> {
  return assetAPI.getAsset(API_PREFIX, assetId);
}

export async function listBackgroundAssets(): Promise<BackgroundAssetStatus[]> {
  return assetAPI.listAssets(API_PREFIX);
}

export async function deleteBackgroundAsset(assetId: string): Promise<void> {
  return assetAPI.deleteAsset(API_PREFIX, assetId);
}

export function getBackgroundImageUrl(assetId: string, thumbnail: boolean = false): string {
  return assetAPI.getAssetImageUrl(API_PREFIX, assetId, thumbnail);
}

