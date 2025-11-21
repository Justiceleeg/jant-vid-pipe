'use client';

import { useState } from 'react';
import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { CharacterAssetUpload } from '@/components/character/CharacterAssetUpload';
import { CharacterAssetList } from '@/components/character/CharacterAssetList';

/**
 * Protected character assets page - character asset management interface
 * This route is protected by Clerk middleware
 */
export default function CharacterAssetsPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = (assetId: string) => {
    // Trigger refresh of the asset list
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAssetDeleted = (assetId: string) => {
    // Asset list will automatically refresh via refreshTrigger
    // This callback is here for potential future use (e.g., analytics)
  };

  return (
    <div
      className={cn(
        layoutClasses.fullScreen,
        "flex flex-col pt-16"
      )}
    >
      <main className={cn(layoutClasses.scrollableContainer, "flex-1 p-6")}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Character Assets</h1>
            <p className="text-muted-foreground">
              Manage your character assets for use in ads
            </p>
          </div>

          {/* Upload Section */}
          <CharacterAssetUpload onUploadComplete={handleUploadComplete} />

          {/* Asset List Section */}
          <CharacterAssetList 
            onAssetDeleted={handleAssetDeleted}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </main>
    </div>
  );
}


