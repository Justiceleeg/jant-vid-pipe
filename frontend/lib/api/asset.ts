/**
 * Generic asset API client functions
 * Can be used for any asset type (brand, character, etc.)
 */

import type { Asset, AssetStatus } from '@/types/asset.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function uploadAsset(
  apiPrefix: string,
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<Asset> {
  if (!userId) {
    throw new Error('User ID is required to upload assets');
  }

  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          reject(new Error('Invalid response format'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.detail || 'Upload failed'));
        } catch (e) {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', `${API_URL}/api/${apiPrefix}/upload`);
    // Add user_id header for backend authentication
    xhr.setRequestHeader('X-User-Id', userId);
    xhr.send(formData);
  });
}

export async function getAsset(apiPrefix: string, assetId: string, userId: string): Promise<AssetStatus> {
  if (!userId) {
    throw new Error('User ID is required to access assets');
  }

  const response = await fetch(`${API_URL}/api/${apiPrefix}/${assetId}`, {
    headers: {
      'X-User-Id': userId,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get asset' }));
    throw new Error(error.detail);
  }
  
  return response.json();
}

export async function listAssets(apiPrefix: string, userId: string): Promise<AssetStatus[]> {
  if (!userId) {
    throw new Error('User ID is required to list assets');
  }

  const response = await fetch(`${API_URL}/api/${apiPrefix}`, {
    headers: {
      'X-User-Id': userId,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to list assets' }));
    throw new Error(error.detail);
  }
  
  return response.json();
}

export async function deleteAsset(apiPrefix: string, assetId: string, userId: string): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to delete assets');
  }

  const response = await fetch(`${API_URL}/api/${apiPrefix}/${assetId}`, {
    method: 'DELETE',
    headers: {
      'X-User-Id': userId,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete asset' }));
    throw new Error(error.detail);
  }
}

/**
 * Get asset image URL from asset data.
 * Returns the Firebase Storage URL directly from the asset object.
 *
 * @param asset - The asset object containing Firebase Storage URLs
 * @param thumbnail - Whether to get the thumbnail URL (default: false)
 * @returns The Firebase Storage URL
 */
export function getAssetImageUrlFromData(asset: AssetStatus, thumbnail: boolean = false): string {
  const url = thumbnail ? asset.public_thumbnail_url : asset.public_url;
  if (!url) {
    throw new Error('Asset does not have a Firebase Storage URL');
  }
  return url;
}

/**
 * DEPRECATED: This constructs a local backend URL, but we use Firebase Storage now.
 *
 * This function is kept for backward compatibility but will not work properly.
 * Components should instead:
 * 1. Fetch the asset using getAsset() or listAssets()
 * 2. Use asset.public_url or asset.public_thumbnail_url directly in img src
 *
 * Or use the getAssetImageUrlFromData() helper function.
 */
export function getAssetImageUrl(apiPrefix: string, assetId: string, userId: string, thumbnail: boolean = false): string {
  if (!userId) {
    throw new Error('User ID is required to access asset images');
  }

  const endpoint = thumbnail ? 'thumbnail' : 'image';
  // Include user_id as query parameter for img src tags (can't send headers)
  return `${API_URL}/api/${apiPrefix}/${assetId}/${endpoint}?user_id=${encodeURIComponent(userId)}`;
}


