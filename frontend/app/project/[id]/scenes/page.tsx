'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StoryboardCarousel } from '@/components/storyboard';
import { useProjectScenes } from '@/hooks/useProjectScenes';
import { useProject } from '@/hooks/useProject';
import { useAppStore } from '@/store/appStore';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { STEPS } from '@/lib/steps';

/**
 * Scenes Page - Project-Centric Implementation
 *
 * This page displays and manages scenes for a project using the new
 * project-centric API and real-time Firestore subscriptions.
 */
function ScenesPageContent() {
  const { addToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  // App-level state
  const { setCurrentStep, setStoryboardCompleted } = useAppStore();

  // Load project data with real-time updates
  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);

  // Load scenes with real-time updates via project API
  const {
    scenes,
    isLoading,
    isSaving,
    isRegeneratingAll,
    error,
    approveText,
    regenerateText,
    editText,
    approveImage,
    regenerateImage,
    updateDuration,
    regenerateVideo,
    regenerateAllScenes,
    setError,
  } = useProjectScenes(projectId);

  // Debug logging
  useEffect(() => {
    console.log('[ScenesPage] Scenes updated:', scenes);
    console.log('[ScenesPage] Scenes count:', scenes.length);
    console.log('[ScenesPage] isLoading:', isLoading);
    console.log('[ScenesPage] error:', error);
  }, [scenes, isLoading, error]);

  // Handle project loading errors
  useEffect(() => {
    if (projectError) {
      console.error('[ScenesPage] Failed to load project:', projectError);
      router.push('/projects');
    }
  }, [projectError, router]);

  // Handle operations with toast feedback
  const handleApproveText = async (sceneId: string) => {
    try {
      await approveText(sceneId);
      addToast({
        type: 'success',
        message: 'Image generation started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate image',
        duration: 5000,
      });
    }
  };

  const handleRegenerateText = async (sceneId: string) => {
    try {
      await regenerateText(sceneId);
      addToast({
        type: 'success',
        message: 'Scene text regenerated',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate text',
        duration: 5000,
      });
    }
  };

  const handleEditText = async (sceneId: string, newText: string) => {
    try {
      await editText(sceneId, newText);
      addToast({
        type: 'success',
        message: 'Scene text updated',
        duration: 3000,
      });
    } catch (error) {
      let errorMessage = 'Failed to update text';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleApproveImage = async (sceneId: string) => {
    try {
      await approveImage(sceneId);
      addToast({
        type: 'success',
        message: 'Video generation started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate video',
        duration: 5000,
      });
    }
  };

  const handleRegenerateImage = async (sceneId: string) => {
    try {
      await regenerateImage(sceneId);
      addToast({
        type: 'success',
        message: 'Image regeneration started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate image',
        duration: 5000,
      });
    }
  };

  const handleUpdateDuration = async (sceneId: string, newDuration: number) => {
    try {
      await updateDuration(sceneId, newDuration);
      addToast({
        type: 'success',
        message: 'Duration updated',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update duration',
        duration: 5000,
      });
    }
  };

  const handleRegenerateVideo = async (sceneId: string) => {
    try {
      await regenerateVideo(sceneId);
      addToast({
        type: 'success',
        message: 'Video regeneration started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate video',
        duration: 5000,
      });
    }
  };

  const handleRegenerateAll = async () => {
    try {
      await regenerateAllScenes();
      addToast({
        type: 'success',
        message: 'All scenes regenerated successfully',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate all scenes',
        duration: 5000,
      });
    }
  };

  const handlePreviewAll = () => {
    console.log('Preview all scenes');
  };

  const handleGenerateFinalVideo = () => {
    setStoryboardCompleted(true);
    setCurrentStep(STEPS.FINAL);
    router.push(`/project/${projectId}/final`);
  };

  // Loading state
  if (isLoading || isProjectLoading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">
              Loading Scenes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && scenes.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="max-w-md w-full bg-card border border-destructive rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-destructive mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-destructive mb-1">Error Loading Scenes</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/project/${projectId}/chat`)}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Return to Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No scenes state
  if (!project || scenes.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">No Scenes Found</h3>
            <p className="text-sm text-muted-foreground">
              Please complete the creative brief and mood selection first.
            </p>
            <button
              onClick={() => router.push(`/project/${projectId}/chat`)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Creative Brief
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Convert project scenes to storyboard format for carousel component
  const storyboardForCarousel = {
    storyboard_id: project.id,
    title: project.storyboard?.title || project.name,
    scene_order: scenes.map(s => s.id),
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    session_id: project.userId, // Legacy field
    user_id: project.userId,
    creative_brief: project.storyboard?.creativeBrief || {},
    selected_mood: project.storyboard?.selectedMood || {},
  };

  // Convert Scene objects to StoryboardScene format
  const storyboardScenes = scenes.map(scene => ({
    id: scene.id,
    storyboard_id: project.id,
    state: (scene.assets?.videoPath ? 'video' : scene.assets?.thumbnailPath ? 'image' : 'text') as 'text' | 'image' | 'video',
    text: scene.description,
    style_prompt: '', // Not stored in Scene model
    image_url: scene.assets?.thumbnailPath || null,
    seed_image_urls: scene.assets?.thumbnailPath ? [scene.assets.thumbnailPath] : null,
    video_url: scene.assets?.videoPath || null,
    video_duration: scene.durationSeconds,
    generation_status: {
      image: scene.activeJob?.type === 'video' && scene.activeJob?.status === 'processing' ? 'generating' : 
             scene.assets?.thumbnailPath ? 'complete' : 'pending',
      video: scene.activeJob?.type === 'video' && scene.activeJob?.status === 'processing' ? 'generating' :
             scene.assets?.videoPath ? 'complete' : 'pending',
    },
    error_message: scene.activeJob?.errorMessage || null,
    created_at: project.createdAt, // Scene doesn't have its own timestamps
    updated_at: project.updatedAt,
    use_product_composite: false,
    product_id: null,
  }));

  return (
    <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
      <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
        <button
          onClick={() => router.push(`/project/${projectId}/mood`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-3 animate-slideUp"
        >
          <svg
            className="w-4 h-4"
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

        <div className="space-y-2 animate-slideUp animation-delay-100">
          <h1 className="text-2xl font-bold">Scene Storyboard</h1>
          <p className="text-muted-foreground">
            Refine each scene through text, image, and video generation
          </p>
        </div>

        {error && (
          <div className="animate-slideUp animation-delay-100">
            <ErrorAlert
              error={error}
              onDismiss={() => setError(null)}
              showRetry={false}
            />
          </div>
        )}

        <div className="animate-slideUp animation-delay-100">
          <StoryboardCarousel
            storyboard={storyboardForCarousel}
            scenes={storyboardScenes}
            onRegenerateAll={handleRegenerateAll}
            onPreviewAll={handlePreviewAll}
            onGenerateFinalVideo={handleGenerateFinalVideo}
            onApproveText={handleApproveText}
            onRegenerateText={handleRegenerateText}
            onEditText={handleEditText}
            onApproveImage={handleApproveImage}
            onRegenerateImage={handleRegenerateImage}
            onUpdateDuration={handleUpdateDuration}
            onRegenerateVideo={handleRegenerateVideo}
            isLoading={isSaving || isRegeneratingAll}
          />
        </div>

        {isRegeneratingAll && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-center font-medium">Regenerating all scenes...</p>
              <p className="text-xs text-center text-muted-foreground">
                This may take a moment
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScenesPage() {
  return (
    <ToastProvider>
      <ScenesPageContent />
    </ToastProvider>
  );
}
