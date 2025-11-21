'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectStore } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';
import { listBrandAssets, getBrandAssetImageUrl } from '@/lib/api/brand';
import { listCharacterAssets, getCharacterAssetImageUrl } from '@/lib/api/character';
import type { StoryboardScene } from '@/types/storyboard.types';
import type { BrandAssetStatus } from '@/types/brand.types';
import type { CharacterAssetStatus } from '@/types/character.types';

interface SceneAssetToggleSectionProps {
  scene: StoryboardScene;
}

export function SceneAssetToggleSection({ scene }: SceneAssetToggleSectionProps) {
  const { getCurrentProject } = useProjectStore();
  const { enableBrandAsset, disableBrandAsset, enableCharacterAsset, disableCharacterAsset } = useSceneStore();
  
  const [brandAssets, setBrandAssets] = useState<BrandAssetStatus[]>([]);
  const [characterAssets, setCharacterAssets] = useState<CharacterAssetStatus[]>([]);
  const [isLoadingBrand, setIsLoadingBrand] = useState(false);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(false);
  const [isTogglingBrand, setIsTogglingBrand] = useState(false);
  const [isTogglingCharacter, setIsTogglingCharacter] = useState(false);

  const project = getCurrentProject();
  const projectBrandAssetIds = project?.brandAssetIds || [];
  const projectCharacterAssetIds = project?.characterAssetIds || [];

  // Load brand assets
  useEffect(() => {
    if (projectBrandAssetIds.length === 0) return;
    
    setIsLoadingBrand(true);
    listBrandAssets()
      .then(allBrandAssets => {
        // Filter to only show assets that are in the project
        const projectBrandAssets = allBrandAssets.filter(asset => 
          projectBrandAssetIds.includes(asset.asset_id)
        );
        setBrandAssets(projectBrandAssets);
      })
      .catch(error => {
        console.error('Failed to load brand assets:', error);
      })
      .finally(() => {
        setIsLoadingBrand(false);
      });
  }, [projectBrandAssetIds]);

  // Load character assets
  useEffect(() => {
    if (projectCharacterAssetIds.length === 0) return;
    
    setIsLoadingCharacter(true);
    listCharacterAssets()
      .then(allCharacterAssets => {
        // Filter to only show assets that are in the project
        const projectCharacterAssets = allCharacterAssets.filter(asset => 
          projectCharacterAssetIds.includes(asset.asset_id)
        );
        setCharacterAssets(projectCharacterAssets);
      })
      .catch(error => {
        console.error('Failed to load character assets:', error);
      })
      .finally(() => {
        setIsLoadingCharacter(false);
      });
  }, [projectCharacterAssetIds]);

  const handleBrandToggle = async (checked: boolean, assetId: string) => {
    setIsTogglingBrand(true);
    try {
      if (checked) {
        // If another brand asset is already selected, it will be replaced
        await enableBrandAsset(scene.id, assetId);
        if (scene.image_url) {
          console.log('Scene will be regenerated with brand asset');
        }
      } else {
        // Only disable if this is the currently selected asset
        if (scene.brand_asset_id === assetId) {
          await disableBrandAsset(scene.id);
          if (scene.image_url) {
            console.log('Scene will be regenerated without brand asset');
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle brand asset:', error);
    } finally {
      setIsTogglingBrand(false);
    }
  };

  const handleCharacterToggle = async (checked: boolean, assetId: string) => {
    setIsTogglingCharacter(true);
    try {
      if (checked) {
        // If another character asset is already selected, it will be replaced
        await enableCharacterAsset(scene.id, assetId);
        if (scene.image_url) {
          console.log('Scene will be regenerated with character asset');
        }
      } else {
        // Only disable if this is the currently selected asset
        if (scene.character_asset_id === assetId) {
          await disableCharacterAsset(scene.id);
          if (scene.image_url) {
            console.log('Scene will be regenerated without character asset');
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle character asset:', error);
    } finally {
      setIsTogglingCharacter(false);
    }
  };

  // Don't show if project has no assets
  if (projectBrandAssetIds.length === 0 && projectCharacterAssetIds.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg border">
      <h4 className="text-sm font-semibold text-foreground">Assets</h4>
      
      {/* Brand Asset Toggle */}
      {projectBrandAssetIds.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Brand Asset</label>
          {isLoadingBrand ? (
            <div className="text-xs text-muted-foreground">Loading brand assets...</div>
          ) : brandAssets.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No brand assets available</div>
          ) : (
            <div className="space-y-2">
              {brandAssets.map((asset) => {
                const isSelected = scene.brand_asset_id === asset.asset_id;
                return (
                  <label
                    key={asset.asset_id}
                    className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleBrandToggle(checked === true, asset.asset_id)}
                      disabled={isTogglingBrand}
                    />
                    <div className="relative w-8 h-8 flex-shrink-0 rounded border bg-background overflow-hidden">
                      <Image
                        src={getBrandAssetImageUrl(asset.asset_id, true)}
                        alt={asset.metadata?.filename || 'Brand asset'}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className="text-xs text-foreground flex-1">
                      {asset.metadata?.filename || 'Brand asset'}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Character Asset Toggle */}
      {projectCharacterAssetIds.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Character Asset</label>
          {isLoadingCharacter ? (
            <div className="text-xs text-muted-foreground">Loading character assets...</div>
          ) : characterAssets.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No character assets available</div>
          ) : (
            <div className="space-y-2">
              {characterAssets.map((asset) => {
                const isSelected = scene.character_asset_id === asset.asset_id;
                return (
                  <label
                    key={asset.asset_id}
                    className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleCharacterToggle(checked === true, asset.asset_id)}
                      disabled={isTogglingCharacter}
                    />
                    <div className="relative w-8 h-8 flex-shrink-0 rounded border bg-background overflow-hidden">
                      <Image
                        src={getCharacterAssetImageUrl(asset.asset_id, true)}
                        alt={asset.metadata?.filename || 'Character asset'}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className="text-xs text-foreground flex-1">
                      {asset.metadata?.filename || 'Character asset'}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

