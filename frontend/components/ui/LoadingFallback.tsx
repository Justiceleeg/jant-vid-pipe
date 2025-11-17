/**
 * Loading fallback component for lazy-loaded components
 * Provides a smooth loading experience with skeleton UI
 */

interface LoadingFallbackProps {
  message?: string;
}

export function LoadingFallback({ message = 'Loading...' }: LoadingFallbackProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center space-y-4">
        {/* Spinner */}
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 border-4 border-zinc-200 dark:border-zinc-800 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
        </div>
        
        {/* Loading message */}
        <p className="text-sm text-muted-foreground animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for step components
 */
export function StepSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/3" />
      
      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
      
      {/* Button skeleton */}
      <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/4" />
    </div>
  );
}

