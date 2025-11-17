'use client';

/**
 * Performance monitoring component that initializes Web Vitals tracking
 * This runs on the client side and tracks performance metrics
 */

import { useEffect } from 'react';
import { initPerformanceTracking } from '@/lib/performance';

export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize performance tracking once when the app loads
    initPerformanceTracking();
  }, []);

  // This component doesn't render anything
  return null;
}

