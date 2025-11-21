/**
 * Firebase Configuration
 *
 * Initializes Firebase app and exports Firestore instance
 * for use throughout the application.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate required config
if (typeof window !== 'undefined') {
  const requiredFields = ['apiKey', 'authDomain', 'projectId'] as const;
  const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

  if (missingFields.length > 0) {
    console.warn(
      `Missing Firebase configuration fields: ${missingFields.join(', ')}. ` +
      'Firebase features will not be available. Please check your .env.local file.'
    );
  }
}

// Initialize Firebase app (singleton)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firestore with offline persistence
let db;
if (typeof window !== 'undefined' && firebaseConfig.projectId) {
  // Only initialize Firestore if we have a valid projectId
  if (!db) {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } else {
    db = getFirestore(app);
  }

  // Connect to emulator in development if configured
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST &&
    !(db as any)._settings?.host?.includes('localhost')
  ) {
    connectFirestoreEmulator(
      db,
      process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST,
      parseInt(process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_PORT || '8080')
    );
  }
} else {
  // Server-side or missing config: use regular initialization
  db = firebaseConfig.projectId ? getFirestore(app) : null;
}

// Initialize Auth
const auth = firebaseConfig.apiKey ? getAuth(app) : null;

// Connect to Auth emulator in development if configured
if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST &&
  auth &&
  !(auth as any).emulatorConfig
) {
  connectAuthEmulator(
    auth,
    `http://${process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST}:${
      process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_PORT || '9099'
    }`
  );
}

export { app, db, auth };

// Export typed Firestore for better TypeScript support
export const firestore = db;