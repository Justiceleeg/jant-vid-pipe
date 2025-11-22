'use client';

import { useEffect, Suspense, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMoodGeneration } from '@/hooks/useMoodGeneration';
import { useAppStore } from '@/store/appStore';
import { useProject } from '@/hooks/useProject';
import { projectsApi } from '@/lib/api/projects';
import { MoodBoard } from '@/components/moods/MoodBoard';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import type { MoodGenerationRequest } from '@/types/mood.types';
import { STEPS } from '@/lib/steps';

/**
 * Mood selection page - allows users to select a mood board
 * for their video generation pipeline.
 */
export default function MoodPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const {
    creativeBrief,
    moods,
    selectedMoodId,
    setCurrentStep,
  } = useAppStore();
  
  // Use the new project hook to load from Firestore
  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);

  // Handle project loading errors
  useEffect(() => {
    if (projectError) {
      console.error('[MoodPage] Failed to load project:', projectError);
      router.push('/projects');
    }
  }, [projectError, router]);

  const {
    isLoading: isMoodLoading,
    error: moodError,
    generateMoodsFromBrief,
    selectMood,
  } = useMoodGeneration();
  
  const [isInitializingScenes, setIsInitializingScenes] = useState(false);
  const [isGeneratingMoods, setIsGeneratingMoods] = useState(false);

  // Track the last brief used for mood generation
  const lastBriefRef = useRef<string | null>(null);

  // Create a hash of the brief to detect changes
  const getBriefHash = (brief: typeof creativeBrief): string => {
    if (!brief) return '';
    return JSON.stringify({
      product_name: brief.product_name,
      target_audience: brief.target_audience,
      emotional_tone: brief.emotional_tone,
      visual_style_keywords: brief.visual_style_keywords,
      key_messages: brief.key_messages,
    });
  };

  // Auto-generate or regenerate moods when brief changes
  useEffect(() => {
    if (!creativeBrief || isMoodLoading || isGeneratingMoods) return;

    const currentBriefHash = getBriefHash(creativeBrief);
    const lastBriefHash = lastBriefRef.current;

    // Only regenerate if:
    // 1. No moods exist (first time) AND we haven't already generated for this brief
    // 2. Brief hash actually changed (brief was updated)
    const shouldRegenerate = 
      (moods.length === 0 && lastBriefHash !== currentBriefHash) || // No moods AND brief is new/changed
      (moods.length > 0 && currentBriefHash !== lastBriefHash && currentBriefHash !== ''); // Has moods but brief changed

    if (shouldRegenerate) {
      console.log('[MoodPage] Generating moods:', {
        moodsLength: moods.length,
        currentBriefHash: currentBriefHash?.substring(0, 20) + '...',
        lastBriefHash: lastBriefHash?.substring(0, 20) + '...',
        timestamp: new Date().toISOString()
      });
      
      // Set flag to prevent concurrent calls
      setIsGeneratingMoods(true);
      
      // Update the ref BEFORE generating to prevent double-trigger
      lastBriefRef.current = currentBriefHash;
      
      const request: MoodGenerationRequest = {
        product_name: creativeBrief.product_name || 'Product',
        target_audience: creativeBrief.target_audience || 'General Audience',
        emotional_tone: creativeBrief.emotional_tone || [],
        visual_style_keywords: creativeBrief.visual_style_keywords || [],
        key_messages: creativeBrief.key_messages || [],
      };
      
      // Clear existing moods and selection when regenerating
      if (moods.length > 0) {
        const { setMoods } = useAppStore.getState();
        setMoods([]);
        useAppStore.setState({ selectedMoodId: null });
      }

      generateMoodsFromBrief(request, projectId).finally(() => {
        setIsGeneratingMoods(false);
      });
    }
  }, [creativeBrief, isMoodLoading, isGeneratingMoods, moods.length, generateMoodsFromBrief, projectId]);

  // Auto-select first mood after moods are generated
  useEffect(() => {
    if (moods.length > 0 && !selectedMoodId) {
      selectMood(moods[0].id);
    }
  }, [moods, selectedMoodId, selectMood]);

  const handleGenerateMoods = async () => {
    if (!creativeBrief || isGeneratingMoods) return;

    console.log('[MoodPage] Manual mood regeneration triggered');
    setIsGeneratingMoods(true);
    
    // Clear existing moods and selection when regenerating
    const { setMoods } = useAppStore.getState();
    setMoods([]);
    useAppStore.setState({ selectedMoodId: null });
    
    const request: MoodGenerationRequest = {
      product_name: creativeBrief.product_name || 'Product',
      target_audience: creativeBrief.target_audience || 'General Audience',
      emotional_tone: creativeBrief.emotional_tone || [],
      visual_style_keywords: creativeBrief.visual_style_keywords || [],
      key_messages: creativeBrief.key_messages || [],
    };

    // Update the ref to match current brief
    lastBriefRef.current = getBriefHash(creativeBrief);

    await generateMoodsFromBrief(request, projectId).finally(() => {
      setIsGeneratingMoods(false);
    });
  };

  const handleContinue = () => {
    // Navigate to backgrounds page
    setCurrentStep(STEPS.BACKGROUNDS);
    router.push(`/project/${projectId}/backgrounds`);
  };

  const handleBack = () => {
    // Navigate back to chat
    setCurrentStep(STEPS.CHAT);
    router.push(`/project/${projectId}/chat`);
  };

  return (
    <div className="min-h-screen pt-[calc(3.5rem+1.5rem)] flex flex-col">
      <main className="flex-1 flex flex-col animate-fadeIn overflow-visible">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Back button - centered with padding */}
          <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 mb-2">
            <div className="w-full max-w-7xl">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-2 animate-slideUp flex-shrink-0"
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
                Back to Chat
              </button>
            </div>
          </div>

          {/* Mood Board Component - centered, full width available, overflow allowed */}
          <div className="flex-1 min-h-0 w-full flex justify-center animate-slideUp animation-delay-100 overflow-visible">
            <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 overflow-visible">
              <Suspense fallback={<StepSkeleton />}>
                <MoodBoard
                  moods={moods}
                  selectedMoodId={selectedMoodId}
                  onSelectMood={selectMood}
                  onGenerate={handleGenerateMoods}
                  onContinue={handleContinue}
                  isLoading={isMoodLoading}
                  error={moodError}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

