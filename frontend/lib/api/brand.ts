import type { BrandAsset, BrandAssetStatus } from '@/types/brand.types';
import * as assetAPI from './asset';

const API_PREFIX = 'brand';

export async function uploadBrandAsset(
  file: File,
  onProgress?: (progress: number) => void
): Promise<BrandAsset> {
  return assetAPI.uploadAsset(API_PREFIX, file, onProgress);
}

export async function getBrandAsset(assetId: string): Promise<BrandAssetStatus> {
  return assetAPI.getAsset(API_PREFIX, assetId);
}

export async function listBrandAssets(): Promise<BrandAssetStatus[]> {
  return assetAPI.listAssets(API_PREFIX);
}

export async function deleteBrandAsset(assetId: string): Promise<void> {
  return assetAPI.deleteAsset(API_PREFIX, assetId);
}

export function getBrandAssetImageUrl(assetId: string, thumbnail: boolean = false): string {
  return assetAPI.getAssetImageUrl(API_PREFIX, assetId, thumbnail);
}

