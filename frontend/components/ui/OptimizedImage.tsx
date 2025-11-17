/**
 * Optimized Image component with lazy loading and blur-up effect
 * Uses Next.js Image component with optimizations for mood boards and scene images
 */

'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  onLoad?: () => void;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  onLoad,
  aspectRatio = '16:9',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Calculate dimensions based on aspect ratio if not provided
  const getDimensions = () => {
    if (width && height) return { width, height };

    const ratios = {
      '1:1': { width: 800, height: 800 },
      '16:9': { width: 800, height: 450 },
      '9:16': { width: 450, height: 800 },
      '4:3': { width: 800, height: 600 },
    };

    return ratios[aspectRatio];
  };

  const dimensions = getDimensions();

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 ${className}`}
        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
      >
        <div className="text-center p-4">
          <svg
            className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Failed to load image
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading skeleton */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 animate-pulse"
          style={{ aspectRatio: aspectRatio.replace(':', '/') }}
        />
      )}

      {/* Optimized image with Next.js Image component */}
      <Image
        src={src}
        alt={alt}
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        quality={85}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
      />
    </div>
  );
}

/**
 * Lazy loaded image with intersection observer
 * For images that should only load when visible
 */
export function LazyImage({
  src,
  alt,
  className = '',
  aspectRatio = '16:9',
}: Omit<OptimizedImageProps, 'width' | 'height' | 'priority'>) {
  const [isInView, setIsInView] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !hasLoaded) {
        setIsInView(true);
        setHasLoaded(true);
      }
    });
  };

  // Set up intersection observer
  if (typeof window !== 'undefined' && !hasLoaded) {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: '50px', // Start loading 50px before entering viewport
      threshold: 0.01,
    });

    const element = document.querySelector(`[data-lazy-image="${src}"]`);
    if (element) {
      observer.observe(element);
    }
  }

  return (
    <div data-lazy-image={src} className={className}>
      {isInView ? (
        <OptimizedImage src={src} alt={alt} className={className} aspectRatio={aspectRatio} />
      ) : (
        <div
          className="bg-zinc-200 dark:bg-zinc-800 animate-pulse"
          style={{ aspectRatio: aspectRatio.replace(':', '/') }}
        />
      )}
    </div>
  );
}

