/**
 * Generic asset API client functions
 * Can be used for any asset type (brand, character, etc.)
 */

import type { Asset, AssetStatus } from '@/types/asset.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function uploadAsset(
  apiPrefix: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<Asset> {
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
    xhr.send(formData);
  });
}

export async function getAsset(apiPrefix: string, assetId: string): Promise<AssetStatus> {
  const response = await fetch(`${API_URL}/api/${apiPrefix}/${assetId}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get asset' }));
    throw new Error(error.detail);
  }
  
  return response.json();
}

export async function listAssets(apiPrefix: string): Promise<AssetStatus[]> {
  const response = await fetch(`${API_URL}/api/${apiPrefix}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to list assets' }));
    throw new Error(error.detail);
  }
  
  return response.json();
}

export async function deleteAsset(apiPrefix: string, assetId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/${apiPrefix}/${assetId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete asset' }));
    throw new Error(error.detail);
  }
}

export function getAssetImageUrl(apiPrefix: string, assetId: string, thumbnail: boolean = false): string {
  const endpoint = thumbnail ? 'thumbnail' : 'image';
  return `${API_URL}/api/${apiPrefix}/${assetId}/${endpoint}`;
}


