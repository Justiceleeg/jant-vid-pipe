'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page - redirects to /projects
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/projects');
  }, [router]);

  return null;
}
