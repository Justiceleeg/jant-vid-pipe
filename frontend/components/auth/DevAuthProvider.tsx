'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

/**
 * Development Auth Provider
 * 
 * Provides a mock user session in development mode
 * to bypass Clerk authentication for testing
 */
export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    // In development, inject a mock user if Clerk isn't authenticated
    if (process.env.NODE_ENV === 'development' && isLoaded && !user) {
      console.log('[DevAuthProvider] Development mode - creating mock user session');
      
      // Store mock user data in session storage for other components to use
      sessionStorage.setItem('dev-user', JSON.stringify({
        id: 'demo-user-dev',
        primaryEmailAddress: { emailAddress: 'dev@example.com' },
        fullName: 'Dev User',
        firstName: 'Dev',
        lastName: 'User',
      }));
      
      // Dispatch a custom event to notify components
      window.dispatchEvent(new CustomEvent('dev-auth-ready', {
        detail: { userId: 'demo-user-dev' }
      }));
    }
  }, [isLoaded, user]);

  return <>{children}</>;
}

/**
 * Hook to get the current user in development mode
 * Falls back to mock user if not authenticated
 */
export function useDevUser() {
  const { user, isLoaded } = useUser();
  
  if (process.env.NODE_ENV === 'development' && isLoaded && !user) {
    const devUser = sessionStorage.getItem('dev-user');
    if (devUser) {
      return JSON.parse(devUser);
    }
  }
  
  return user;
}
