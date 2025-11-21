import type { CharacterAsset, CharacterAssetStatus } from '@/types/character.types';
import * as assetAPI from './asset';

const API_PREFIX = 'character';

export async function uploadCharacterAsset(
  file: File,
  onProgress?: (progress: number) => void
): Promise<CharacterAsset> {
  return assetAPI.uploadAsset(API_PREFIX, file, onProgress);
}

export async function getCharacterAsset(assetId: string): Promise<CharacterAssetStatus> {
  return assetAPI.getAsset(API_PREFIX, assetId);
}

export async function listCharacterAssets(): Promise<CharacterAssetStatus[]> {
  return assetAPI.listAssets(API_PREFIX);
}

export async function deleteCharacterAsset(assetId: string): Promise<void> {
  return assetAPI.deleteAsset(API_PREFIX, assetId);
}

export function getCharacterAssetImageUrl(assetId: string, thumbnail: boolean = false): string {
  return assetAPI.getAssetImageUrl(API_PREFIX, assetId, thumbnail);
}

