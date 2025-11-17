/**
 * Analytics and user feedback collection utilities
 * Integrates with performance monitoring and error tracking
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
}

export interface UserFeedback {
  step: number;
  rating: number; // 1-5
  comment?: string;
  timestamp: number;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private feedback: UserFeedback[] = [];

  /**
   * Track a custom event
   */
  track(eventName: string, properties?: Record<string, any>) {
    const event: AnalyticsEvent = {
      name: eventName,
      properties,
      timestamp: Date.now(),
    };

    this.events.push(event);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 [Analytics Event]', eventName, properties);
    }

    // Send to analytics service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(event);
    }
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string, properties?: Record<string, any>) {
    this.track('page_view', {
      page: pageName,
      ...properties,
    });
  }

  /**
   * Track user interaction
   */
  trackClick(element: string, properties?: Record<string, any>) {
    this.track('click', {
      element,
      ...properties,
    });
  }

  /**
   * Track pipeline step completion
   */
  trackStepComplete(stepNumber: number, stepName: string, duration?: number) {
    this.track('step_complete', {
      step: stepNumber,
      name: stepName,
      duration,
    });
  }

  /**
   * Track user feedback
   */
  trackFeedback(step: number, rating: number, comment?: string) {
    const feedback: UserFeedback = {
      step,
      rating,
      comment,
      timestamp: Date.now(),
    };

    this.feedback.push(feedback);

    console.log('💬 [User Feedback]', feedback);

    // Send to analytics
    this.track('user_feedback', feedback);

    // In production, also send to feedback API
    if (process.env.NODE_ENV === 'production') {
      this.sendFeedback(feedback);
    }
  }

  /**
   * Track error occurrence
   */
  trackError(errorName: string, errorMessage: string, context?: Record<string, any>) {
    this.track('error', {
      error_name: errorName,
      error_message: errorMessage,
      ...context,
    });
  }

  /**
   * Track generation success/failure
   */
  trackGeneration(type: string, success: boolean, duration?: number, metadata?: Record<string, any>) {
    this.track('generation', {
      type,
      success,
      duration,
      ...metadata,
    });
  }

  /**
   * Get all collected events
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Get all collected feedback
   */
  getFeedback(): UserFeedback[] {
    return [...this.feedback];
  }

  /**
   * Send event to analytics service
   */
  private async sendToAnalytics(event: AnalyticsEvent) {
    try {
      // Example: Google Analytics 4
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', event.name, event.properties);
      }

      // Example: Custom analytics endpoint
      // await fetch('/api/analytics/events', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event),
      // });
    } catch (error) {
      console.error('Failed to send analytics:', error);
    }
  }

  /**
   * Send feedback to backend
   */
  private async sendFeedback(feedback: UserFeedback) {
    try {
      // await fetch('/api/feedback', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(feedback),
      // });
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

/**
 * React hook for analytics tracking
 */
export function useAnalytics() {
  return {
    track: (eventName: string, properties?: Record<string, any>) =>
      analytics.track(eventName, properties),
    trackPageView: (pageName: string) => analytics.trackPageView(pageName),
    trackClick: (element: string) => analytics.trackClick(element),
    trackStepComplete: (stepNumber: number, stepName: string, duration?: number) =>
      analytics.trackStepComplete(stepNumber, stepName, duration),
    trackFeedback: (step: number, rating: number, comment?: string) =>
      analytics.trackFeedback(step, rating, comment),
    trackError: (errorName: string, errorMessage: string, context?: Record<string, any>) =>
      analytics.trackError(errorName, errorMessage, context),
    trackGeneration: (type: string, success: boolean, duration?: number, metadata?: Record<string, any>) =>
      analytics.trackGeneration(type, success, duration, metadata),
  };
}

