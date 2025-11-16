'use client';

import { ChatInterface, CreativeBriefSummary } from '@/components/vision';
import { MoodBoard } from '@/components/moods';
import { Storyboard } from '@/components/scenes';
import { VideoGeneration } from '@/components/composition/VideoGeneration';
import { FinalComposition } from '@/components/composition/FinalComposition';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { useVisionChat } from '@/hooks/useVisionChat';
import { useMoodGeneration } from '@/hooks/useMoodGeneration';
import { useScenePlanning } from '@/hooks/useScenePlanning';
import { useAppStore } from '@/store/appStore';
import type { MoodGenerationRequest } from '@/types/mood.types';
import type { ScenePlanRequest } from '@/types/scene.types';

/**
 * Main page that conditionally renders different steps based on currentStep.
 */
export default function Home() {
  const {
    currentStep,
    setCurrentStep,
    creativeBrief,
    moods,
    selectedMoodId,
    scenePlan,
    setScenePlan,
  } = useAppStore();

  // Step 1: Vision Chat
  const {
    messages,
    onSendMessage,
    isLoading: isChatLoading,
    isStreaming,
    error: chatError,
    creativeBrief: chatBrief,
    canProceed,
  } = useVisionChat();

  // Step 2: Mood Generation
  const {
    isLoading: isMoodLoading,
    error: moodError,
    generateMoodsFromBrief,
    selectMood,
    clearError: clearMoodError,
  } = useMoodGeneration();

  // Step 3: Scene Planning
  const {
    scenePlan: generatedScenePlan,
    isLoading: isSceneLoading,
    error: sceneError,
    generateScenePlan,
    generateSeedImages,
    clearError: clearSceneError,
  } = useScenePlanning();

  // Use creativeBrief from store (persisted) or from chat hook
  const activeBrief = creativeBrief || chatBrief;

  const handleContinueToMoods = () => {
    if (canProceed && activeBrief) {
      setCurrentStep(2);
    }
  };

  const handleGenerateMoods = async () => {
    if (!activeBrief) return;
    
    const request: MoodGenerationRequest = {
      product_name: activeBrief.product_name,
      target_audience: activeBrief.target_audience,
      emotional_tone: activeBrief.emotional_tone,
      visual_style_keywords: activeBrief.visual_style_keywords,
      key_messages: activeBrief.key_messages,
    };
    
    await generateMoodsFromBrief(request);
  };

  const handleContinueFromMoods = () => {
    if (selectedMoodId) {
      setCurrentStep(3);
    }
  };

  const handleGenerateScenePlan = async () => {
    if (!activeBrief || !selectedMoodId) return;

    // Find selected mood from store
    const selectedMood = moods.find((m) => m.id === selectedMoodId);

    if (!selectedMood) {
      console.error('Selected mood not found');
      return;
    }

    const request: ScenePlanRequest = {
      product_name: activeBrief.product_name,
      target_audience: activeBrief.target_audience,
      emotional_tone: activeBrief.emotional_tone,
      visual_style_keywords: activeBrief.visual_style_keywords,
      key_messages: activeBrief.key_messages,
      mood_id: selectedMood.id,
      mood_name: selectedMood.name,
      mood_style_keywords: selectedMood.style_keywords,
      mood_color_palette: selectedMood.color_palette,
      mood_aesthetic_direction: selectedMood.aesthetic_direction,
    };

    const plan = await generateScenePlan(request);

    if (plan) {
      // Save to store
      setScenePlan(plan);

      // Generate seed images
      const scenesWithImages = await generateSeedImages(
        plan.scenes,
        selectedMood.style_keywords,
        selectedMood.color_palette,
        selectedMood.aesthetic_direction
      );

      // Update store with seed images
      if (scenesWithImages) {
        setScenePlan({
          ...plan,
          scenes: scenesWithImages,
        });
      }
    }
  };

  const handleContinueFromScenes = () => {
    setCurrentStep(4);
  };

  // Render based on current step
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Step Indicator */}
      <div className="sticky top-0 bg-white dark:bg-zinc-950 border-b z-10">
        <StepIndicator currentStep={currentStep} />
      </div>

      {/* Content */}
      {currentStep === 1 && (
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="w-full max-w-4xl space-y-4">
          {/* Creative Brief Summary */}
          {activeBrief && (
            <CreativeBriefSummary
              brief={activeBrief}
              onContinue={canProceed ? handleContinueToMoods : undefined}
            />
          )}

          {/* Chat Interface */}
          <ChatInterface
            messages={messages}
            onSendMessage={onSendMessage}
            isLoading={isChatLoading}
            isStreaming={isStreaming}
            error={chatError}
            className="h-[calc(100vh-200px)]"
          />
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="w-full max-w-6xl space-y-4">
          {/* Back button */}
          <button
            onClick={() => setCurrentStep(1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
            Back to Chat
          </button>
          
          <MoodBoard
            moods={moods}
            selectedMoodId={selectedMoodId}
            onSelectMood={selectMood}
            onGenerate={handleGenerateMoods}
            onContinue={handleContinueFromMoods}
            isLoading={isMoodLoading}
            error={moodError}
          />
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="w-full max-w-7xl space-y-4">
          {/* Back button */}
          <button
            onClick={() => setCurrentStep(2)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
            Back to Moods
          </button>

          <Storyboard
            scenePlan={scenePlan || generatedScenePlan}
            onGenerate={handleGenerateScenePlan}
            onContinue={handleContinueFromScenes}
            isLoading={isSceneLoading}
            error={sceneError}
          />
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="w-full max-w-6xl">
            <VideoGeneration
              onComplete={() => setCurrentStep(5)}
              onBack={() => setCurrentStep(3)}
            />
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <FinalComposition onBack={() => setCurrentStep(4)} />
          </div>
        </div>
      )}
    </div>
  );
}
