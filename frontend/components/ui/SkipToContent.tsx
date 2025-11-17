/**
 * Skip to main content button for accessibility
 * Allows keyboard users to skip navigation and go directly to main content
 */

'use client';

export function SkipToContent() {
  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main instanceof HTMLElement) {
      main.focus();
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href="#main-content"
      onClick={handleSkip}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg transition-all"
    >
      Skip to main content
    </a>
  );
}

