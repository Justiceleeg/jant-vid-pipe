'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { BrandAssetUpload } from '@/components/brand/BrandAssetUpload';
import { BrandAssetList } from '@/components/brand/BrandAssetList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Protected brand assets page - brand asset management interface
 * This route is protected by Clerk middleware
 */
export default function BrandAssetsPage() {
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
                    Brand Assets Required
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    You need at least one brand asset to create a project. Upload your brand assets below, then return to create your project.
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
            <h1 className="text-3xl font-bold mb-2">Brand Assets</h1>
            <p className="text-muted-foreground">
              Manage your brand assets including logos, colors, fonts, and style guidelines
            </p>
          </div>

          {/* Upload Section */}
          <BrandAssetUpload onUploadComplete={handleUploadComplete} />

          {/* Asset List Section */}
          <BrandAssetList 
            onAssetDeleted={handleAssetDeleted}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </main>
    </div>
  );
}
