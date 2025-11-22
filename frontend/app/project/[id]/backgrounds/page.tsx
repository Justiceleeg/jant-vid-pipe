'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useBackgroundGeneration } from '@/hooks/useBackgroundGeneration';
import { useAppStore } from '@/store/appStore';
import { useProject } from '@/hooks/useProject';
import { BackgroundGallery } from '@/components/backgrounds/BackgroundGallery';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import { listBackgroundAssets } from '@/lib/api/background';
import type { BackgroundGenerationRequest } from '@/types/background.types';
import { STEPS } from '@/lib/steps';

/**
 * Background selection page - allows users to select background images
 * for their video generation pipeline.
 */
export default function BackgroundsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const {
    creativeBrief,
    backgroundAssets,
    selectedBackgroundIds,
    setCurrentStep,
  } = useAppStore();
  
  // Use the same hook as mood page for consistency
  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);

  // Restore appStore from project's appStateSnapshot
  useEffect(() => {
    if (project?.appStateSnapshot) {
      console.log('[BackgroundsPage] Restoring appStore from project snapshot');
      const snapshot = project.appStateSnapshot;
      const appStore = useAppStore.getState();
      
      // Restore creative brief (this is what we need for background generation!)
      if (snapshot.creativeBrief) {
        console.log('[BackgroundsPage] Restoring creative brief:', snapshot.creativeBrief);
        appStore.setCreativeBrief(snapshot.creativeBrief);
      }
      
      // Restore other relevant state
      if (snapshot.moods) appStore.setMoods(snapshot.moods);
      if (snapshot.selectedMoodId) appStore.selectMood(snapshot.selectedMoodId);
      if (snapshot.backgroundAssets) appStore.setBackgroundAssets(snapshot.backgroundAssets);
      if (snapshot.selectedBackgroundIds) appStore.setSelectedBackgroundIds(snapshot.selectedBackgroundIds);
    }
  }, [project]);

  // Handle project loading errors
  useEffect(() => {
    if (projectError) {
      console.error('[BackgroundsPage] Failed to load project:', projectError);
      router.push('/projects');
    }
  }, [projectError, router]);

  const {
    isLoading: isBackgroundLoading,
    error: backgroundError,
    generateBackgroundsFromBrief,
    selectBackgrounds,
  } = useBackgroundGeneration();

  // Load existing background assets from appStateSnapshot
  useEffect(() => {
    const projectBackgroundAssetIds = project?.appStateSnapshot?.selectedBackgroundIds || [];
    
    if (projectBackgroundAssetIds.length > 0 && backgroundAssets.length === 0 && !isBackgroundLoading) {
      // Try to load existing background assets
      listBackgroundAssets()
        .then(allBackgrounds => {
          // Filter to only show assets that are in the project
          const projectBackgrounds = allBackgrounds.filter(asset => 
            projectBackgroundAssetIds.includes(asset.asset_id)
          );
          if (projectBackgrounds.length > 0) {
            const { setBackgroundAssets } = useAppStore.getState();
            setBackgroundAssets(projectBackgrounds);
            // Also restore selected IDs from project
            if (projectBackgroundAssetIds.length > 0) {
              const { setSelectedBackgroundIds } = useAppStore.getState();
              setSelectedBackgroundIds(projectBackgroundAssetIds);
            }
          }
        })
        .catch(error => {
          console.error('Failed to load background assets:', error);
        });
    }
  }, [project, backgroundAssets.length, isBackgroundLoading]);

  // Auto-generate backgrounds when page loads if no backgrounds exist
  useEffect(() => {
    if (backgroundAssets.length === 0 && !isBackgroundLoading && creativeBrief) {
      const request: BackgroundGenerationRequest = {
        product_name: creativeBrief.product_name || 'Product',
        target_audience: creativeBrief.target_audience || 'General Audience',
        emotional_tone: creativeBrief.emotional_tone || [],
        visual_style_keywords: creativeBrief.visual_style_keywords || [],
        key_messages: creativeBrief.key_messages || [],
      };
      generateBackgroundsFromBrief(request);
    }
  }, [backgroundAssets.length, isBackgroundLoading, creativeBrief, generateBackgroundsFromBrief]);

  const handleGenerateBackgrounds = async () => {
    console.log('[BackgroundsPage] handleGenerateBackgrounds called');
    console.log('[BackgroundsPage] creativeBrief:', creativeBrief);
    
    if (!creativeBrief) {
      console.warn('[BackgroundsPage] No creative brief available, cannot generate backgrounds');
      return;
    }
    
    // Clear existing backgrounds and selection when regenerating
    const { setBackgroundAssets, setSelectedBackgroundIds } = useAppStore.getState();
    setBackgroundAssets([]);
    setSelectedBackgroundIds([]);
    
    const request: BackgroundGenerationRequest = {
      product_name: creativeBrief.product_name || 'Product',
      target_audience: creativeBrief.target_audience || 'General Audience',
      emotional_tone: creativeBrief.emotional_tone || [],
      visual_style_keywords: creativeBrief.visual_style_keywords || [],
      key_messages: creativeBrief.key_messages || [],
    };
    
    console.log('[BackgroundsPage] Calling generateBackgroundsFromBrief with:', request);
    await generateBackgroundsFromBrief(request);
  };

  const handleBackgroundSelect = (backgroundId: string, selected: boolean) => {
    const currentIds = selectedBackgroundIds || [];
    const newIds = selected
      ? [...currentIds, backgroundId]
      : currentIds.filter(id => id !== backgroundId);
    selectBackgrounds(newIds);
    
    // The selection is automatically saved via appStateSnapshot
    // through the auto-save mechanism in projectStore
  };

  const handleContinue = () => {
    // Background selections are already saved via appStateSnapshot auto-save
    
    // Navigate to scenes page
    setCurrentStep(STEPS.SCENES);
    router.push(`/project/${projectId}/scenes`);
  };

  const handleBack = () => {
    // Navigate back to mood
    setCurrentStep(STEPS.MOOD);
    router.push(`/project/${projectId}/mood`);
  };

  const canContinue = backgroundAssets.length > 0 && selectedBackgroundIds.length > 0;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col p-2 sm:p-3 animate-fadeIn overflow-hidden">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-2 animate-slideUp mb-2 flex-shrink-0"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Mood Selection
      </button>

      {/* Header */}
      <div className="space-y-1 animate-slideUp flex-shrink-0 mb-4">
        <h2 className="text-base sm:text-lg font-display font-bold tracking-tight">
          Select your <span className="text-gradient">background images</span>
        </h2>
        <p className="text-[10px] sm:text-xs text-muted-foreground max-w-2xl">
          Choose one or more background images to use in your scenes. These will be available when creating scenes.
        </p>
      </div>

      {/* Error display */}
      {backgroundError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/50 p-1.5 animate-slideUp flex-shrink-0 mb-4">
          <p className="text-[10px] font-medium text-destructive">{backgroundError}</p>
        </div>
      )}

      {/* Action buttons */}
      {backgroundAssets.length === 0 && (
        <div className="flex gap-2 items-center animate-bounceIn flex-shrink-0 mb-4">
          <button
            onClick={handleGenerateBackgrounds}
            disabled={isBackgroundLoading}
            className="btn-primary-bold text-xs px-3 py-1.5"
          >
            {isBackgroundLoading ? 'Generating...' : 'Generate Background Images'}
          </button>
        </div>
      )}

      {/* Regenerate option when backgrounds exist */}
      {backgroundAssets.length > 0 && !isBackgroundLoading && (
        <div className="flex gap-2 items-center animate-slideUp flex-shrink-0 mb-4">
          <button
            onClick={handleGenerateBackgrounds}
            disabled={isBackgroundLoading}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Regenerate
          </button>
        </div>
      )}

      {/* Background Gallery */}
      <div className="flex-1 min-h-0 animate-slideUp animation-delay-100 overflow-auto">
        <Suspense fallback={<StepSkeleton />}>
          <BackgroundGallery
            backgrounds={backgroundAssets}
            selectedIds={selectedBackgroundIds}
            onSelect={handleBackgroundSelect}
            isLoading={isBackgroundLoading}
          />
        </Suspense>
      </div>

      {/* Continue button */}
      {backgroundAssets.length > 0 && (
        <div className="flex justify-end mt-4 flex-shrink-0 animate-slideUp animation-delay-200">
          <button
            onClick={handleContinue}
            disabled={!canContinue || isBackgroundLoading}
            className="btn-primary-bold text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Scenes
          </button>
        </div>
      )}
    </div>
  );
}

