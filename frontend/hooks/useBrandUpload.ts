import { uploadBrandAsset, deleteBrandAsset } from '@/lib/api/brand';
import type { BrandAsset, BrandAssetStatus } from '@/types/brand.types';
import { useAssetUpload } from './useAssetUpload';

export function useBrandUpload() {
  return useAssetUpload<BrandAsset, BrandAssetStatus>({
    uploadFn: uploadBrandAsset,
    deleteFn: deleteBrandAsset,
  });
}

