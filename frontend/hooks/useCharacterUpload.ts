import { uploadCharacterAsset, deleteCharacterAsset } from '@/lib/api/character';
import type { CharacterAsset, CharacterAssetStatus } from '@/types/character.types';
import { useAssetUpload } from './useAssetUpload';

export function useCharacterUpload() {
  return useAssetUpload<CharacterAsset, CharacterAssetStatus>({
    uploadFn: uploadCharacterAsset,
    deleteFn: deleteCharacterAsset,
  });
}

