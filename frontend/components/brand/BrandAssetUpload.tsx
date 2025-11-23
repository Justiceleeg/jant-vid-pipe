'use client';

import { useBrandUpload } from '@/hooks/useBrandUpload';
import { AssetUpload } from '@/components/asset/AssetUpload';

interface BrandAssetUploadProps {
  onUploadComplete?: (assetId: string) => void;
}

export function BrandAssetUpload({ onUploadComplete }: BrandAssetUploadProps) {
  const uploadHook = useBrandUpload();

  return (
    <AssetUpload
      assetType="brand"
      title="Upload Brand Asset"
      description="Upload a PNG or JPG image of your brand asset (logo, brand photo, etc.)"
      successTitle="Brand Asset Uploaded ✓"
      successMessage="Your brand asset has been uploaded successfully"
      onUploadComplete={onUploadComplete}
      uploadHook={uploadHook}
    />
  );
}

