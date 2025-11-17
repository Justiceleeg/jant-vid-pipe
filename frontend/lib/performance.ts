/**
 * Performance monitoring with Web Vitals
 * Tracks core web vitals (LCP, FID, CLS) and custom metrics
 */

import { onCLS, onFID, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

type PerformanceMetric = Metric & {
  timestamp: number;
  pathname: string;
};

// Store performance metrics for analysis
const metrics: PerformanceMetric[] = [];

/**
 * Report metric to analytics service
 * In production, this would send to a service like Google Analytics, DataDog, etc.
 */
function reportMetric(metric: Metric) {
  const enhancedMetric: PerformanceMetric = {
    ...metric,
    timestamp: Date.now(),
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
  };

  metrics.push(enhancedMetric);

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 [Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    });
  }

  // In production, send to analytics service
  if (process.env.NODE_ENV === 'production') {
    // Example: Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', metric.name, {
        value: Math.round(metric.value),
        metric_id: metric.id,
        metric_value: metric.value,
        metric_delta: metric.delta,
        metric_rating: metric.rating,
      });
    }

    // Example: Custom analytics endpoint
    // fetch('/api/analytics/vitals', {
    //   method: 'POST',
    //   body: JSON.stringify(enhancedMetric),
    //   headers: { 'Content-Type': 'application/json' },
    // }).catch(console.error);
  }
}

/**
 * Initialize Web Vitals tracking
 * Call this once when the app loads
 */
export function initPerformanceTracking() {
  if (typeof window === 'undefined') return;

  // Track Core Web Vitals
  onCLS(reportMetric); // Cumulative Layout Shift
  onFID(reportMetric); // First Input Delay
  onFCP(reportMetric); // First Contentful Paint
  onLCP(reportMetric); // Largest Contentful Paint
  onTTFB(reportMetric); // Time to First Byte

  console.log('✅ Performance tracking initialized');
}

/**
 * Get all collected metrics
 */
export function getMetrics(): PerformanceMetric[] {
  return [...metrics];
}

/**
 * Get metrics summary
 */
export function getMetricsSummary() {
  const summary: Record<string, { value: number; rating: string }> = {};

  metrics.forEach((metric) => {
    if (!summary[metric.name]) {
      summary[metric.name] = {
        value: metric.value,
        rating: metric.rating || 'unknown',
      };
    }
  });

  return summary;
}

/**
 * Track custom performance metric
 */
export function trackCustomMetric(name: string, value: number, metadata?: Record<string, any>) {
  const metric = {
    name,
    value,
    timestamp: Date.now(),
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    ...metadata,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 [Custom Metric] ${name}:`, value, metadata);
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Example: Custom analytics
    // fetch('/api/analytics/custom', {
    //   method: 'POST',
    //   body: JSON.stringify(metric),
    //   headers: { 'Content-Type': 'application/json' },
    // }).catch(console.error);
  }
}

/**
 * Track pipeline step completion time
 */
export function trackStepCompletion(stepName: string, duration: number) {
  trackCustomMetric('step_completion', duration, { step: stepName });
}

/**
 * Track API call performance
 */
export function trackAPICall(endpoint: string, duration: number, success: boolean) {
  trackCustomMetric('api_call', duration, {
    endpoint,
    success,
  });
}

/**
 * Track component render time
 */
export function trackComponentRender(componentName: string, duration: number) {
  trackCustomMetric('component_render', duration, { component: componentName });
}

