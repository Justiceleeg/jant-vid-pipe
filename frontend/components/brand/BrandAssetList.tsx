'use client';

import { listBrandAssets, deleteBrandAsset, getBrandAssetImageUrl } from '@/lib/api/brand';
import { AssetList } from '@/components/asset/AssetList';

interface BrandAssetListProps {
  onAssetDeleted?: (assetId: string) => void;
  refreshTrigger?: number;
}

export function BrandAssetList({ onAssetDeleted, refreshTrigger }: BrandAssetListProps) {
  return (
    <AssetList
      assetType="brand"
      title="Your Brand Assets"
      emptyMessage="No brand assets yet. Upload your first brand asset above!"
      onAssetDeleted={onAssetDeleted}
      refreshTrigger={refreshTrigger}
      listFn={listBrandAssets}
      deleteFn={deleteBrandAsset}
      getImageUrl={getBrandAssetImageUrl}
    />
  );
}
