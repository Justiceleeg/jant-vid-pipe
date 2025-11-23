'use client';

import { listCharacterAssets, deleteCharacterAsset } from '@/lib/api/character';
import { AssetList } from '@/components/asset/AssetList';

interface CharacterAssetListProps {
  onAssetDeleted?: (assetId: string) => void;
  refreshTrigger?: number;
}

export function CharacterAssetList({ onAssetDeleted, refreshTrigger }: CharacterAssetListProps) {
  return (
    <AssetList
      assetType="character"
      title="Your Character Assets"
      emptyMessage="No character assets yet. Upload your first character asset above!"
      onAssetDeleted={onAssetDeleted}
      refreshTrigger={refreshTrigger}
      listFn={listCharacterAssets}
      deleteFn={deleteCharacterAsset}
    />
  );
}
