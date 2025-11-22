import type { ProductImage } from '@/types/product.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authentication token from Clerk
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const clerk = (window as any).Clerk;
    if (!clerk) return null;

    await clerk.load();
    const session = clerk.session;
    if (!session) return null;

    const token = await session.getToken();
    return token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

export async function uploadProductImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ProductImage> {
  const formData = new FormData();
  formData.append('file', file);

  // Get auth token
  const authToken = await getAuthToken();

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

    xhr.open('POST', `${API_URL}/api/product/upload`);
    
    // Add auth header if token available
    if (authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }
    
    xhr.send(formData);
  });
}

export async function getProductImage(productId: string): Promise<ProductImage> {
  const response = await fetch(`${API_URL}/api/product/${productId}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get product' }));
    throw new Error(error.detail);
  }
  
  return response.json();
}

export async function deleteProductImage(productId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/product/${productId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete product' }));
    throw new Error(error.detail);
  }
}
