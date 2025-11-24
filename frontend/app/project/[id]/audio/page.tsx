'use client';

import { Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import { useAppStore } from '@/store/appStore';
import { ToastProvider } from '@/components/ui/Toast';
import { STEPS } from '@/lib/steps';
import * as LazyComponents from '@/components/LazyComponents';

/**
 * Audio page - allows users to add audio to rendered video
 */
function AudioPageContent() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { setCurrentStep } = useAppStore();

  return (
    <div className="h-screen pt-[calc(3.5rem+1.5rem)] flex flex-col overflow-hidden">
      <main className="flex-1 flex flex-col animate-fadeIn overflow-hidden relative">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Top bar with Title */}
          <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 mb-0 flex-shrink-0">
            <div className="w-full max-w-7xl flex items-center justify-center">
              {/* Title - centered */}
              <h2 className="text-base sm:text-lg font-display font-bold tracking-tight">
                <span className="text-foreground">Add </span>
                <span className="text-gradient">Audio</span>
              </h2>
            </div>
          </div>

          {/* Content area - two column layout like chat page */}
          <div className="flex-1 min-h-0 w-full flex items-start justify-center animate-slideUp animation-delay-100 overflow-hidden pt-2 sm:pt-4">
            <div className="w-full max-w-7xl h-full flex gap-2 sm:gap-3 px-2 sm:px-3 p-2 sm:p-3">
              <Suspense fallback={<StepSkeleton />}>
                <LazyComponents.AudioPage />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Wrap with ToastProvider
export default function AudioPage() {
  return (
    <ToastProvider>
      <AudioPageContent />
    </ToastProvider>
  );
}

