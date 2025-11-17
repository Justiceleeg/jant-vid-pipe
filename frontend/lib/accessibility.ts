/**
 * Accessibility utilities and keyboard navigation helpers
 */

/**
 * Trap focus within a container (useful for modals, dialogs)
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Add keyboard navigation to a list of items
 */
export function addKeyboardNavigation(
  container: HTMLElement,
  itemSelector: string,
  options: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical';
  } = {}
) {
  const { loop = true, orientation = 'vertical' } = options;

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    // Determine which keys to handle based on orientation
    const prevKeys = orientation === 'vertical' ? ['ArrowUp'] : ['ArrowLeft'];
    const nextKeys = orientation === 'vertical' ? ['ArrowDown'] : ['ArrowRight'];

    if (prevKeys.includes(e.key)) {
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = loop ? items.length - 1 : 0;
      }
      e.preventDefault();
    } else if (nextKeys.includes(e.key)) {
      nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        nextIndex = loop ? 0 : items.length - 1;
      }
      e.preventDefault();
    } else if (e.key === 'Home') {
      nextIndex = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      nextIndex = items.length - 1;
      e.preventDefault();
    }

    if (nextIndex !== currentIndex) {
      items[nextIndex]?.focus();
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get appropriate animation duration based on user preference
 */
export function getAnimationDuration(defaultDuration: number): number {
  return prefersReducedMotion() ? 0 : defaultDuration;
}

/**
 * Skip to main content (accessibility helper)
 */
export function skipToMainContent() {
  const main = document.querySelector('main') || document.querySelector('[role="main"]');
  if (main instanceof HTMLElement) {
    main.focus();
    main.scrollIntoView({ behavior: 'smooth' });
  }
}

