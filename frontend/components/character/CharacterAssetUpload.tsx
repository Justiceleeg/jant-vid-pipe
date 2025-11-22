'use client';

import { useCharacterUpload } from '@/hooks/useCharacterUpload';
import { getCharacterAssetImageUrl } from '@/lib/api/character';
import { AssetUpload } from '@/components/asset/AssetUpload';

interface CharacterAssetUploadProps {
  onUploadComplete?: (assetId: string) => void;
}

export function CharacterAssetUpload({ onUploadComplete }: CharacterAssetUploadProps) {
  const uploadHook = useCharacterUpload();

  return (
    <AssetUpload
      assetType="character"
      title="Upload Character Asset"
      description="Upload a PNG or JPG image of your character (for use in ads)"
      successTitle="Character Asset Uploaded ✓"
      successMessage="Your character asset has been uploaded successfully"
      onUploadComplete={onUploadComplete}
      uploadHook={uploadHook}
      getImageUrl={getCharacterAssetImageUrl}
    />
  );
}

