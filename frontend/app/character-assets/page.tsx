'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { CharacterAssetUpload } from '@/components/character/CharacterAssetUpload';
import { CharacterAssetList } from '@/components/character/CharacterAssetList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Protected character assets page - character asset management interface
 * This route is protected by Clerk middleware
 */
export default function CharacterAssetsPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromCreateProject = searchParams.get('from') === 'create-project';

  const handleUploadComplete = (assetId: string) => {
    // Trigger refresh of the asset list
    setRefreshTrigger(prev => prev + 1);
    
    // If redirected from project creation, redirect back after upload
    if (fromCreateProject) {
      // Small delay to ensure the asset is visible in the list
      setTimeout(() => {
        router.push('/projects');
      }, 500);
    }
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
          {fromCreateProject && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Character Assets Required
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    You need at least one character asset to create a project. Upload your character assets below, then return to create your project.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/projects')}
                  className="ml-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Projects
                </Button>
              </div>
            </div>
          )}
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


