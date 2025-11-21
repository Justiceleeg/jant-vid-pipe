/**
 * Migration Helper for localStorage to Firestore
 *
 * Helps migrate existing projects from localStorage to Firestore
 * on first run after the update.
 */

import { useProjectStore } from '@/store/projectStore';
import { useFirestoreProjectStore } from '@/store/firestoreProjectStore';
import { Timestamp } from 'firebase/firestore';

const MIGRATION_FLAG_KEY = 'jant-vid-pipe-firestore-migrated';

/**
 * Check if migration has already been performed
 */
export function hasMigrated(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
}

/**
 * Mark migration as complete
 */
function markMigrationComplete() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  }
}

/**
 * Migrate projects from localStorage to Firestore
 */
export async function migrateToFirestore(): Promise<void> {
  if (typeof window === 'undefined' || hasMigrated()) {
    return;
  }

  console.log('Starting migration from localStorage to Firestore...');

  try {
    // Get projects from localStorage-based store
    const localStore = useProjectStore.getState();
    const firestoreStore = useFirestoreProjectStore.getState();

    // Wait for Firestore to be ready
    if (!firestoreStore.projects) {
      console.log('Waiting for Firestore to initialize...');
      await new Promise((resolve) => {
        const unsubscribe = useFirestoreProjectStore.subscribe(
          (state) => state.projects,
          (projects) => {
            if (projects) {
              unsubscribe();
              resolve(true);
            }
          }
        );
      });
    }

    const localProjects = localStore.projects;

    if (!localProjects || localProjects.length === 0) {
      console.log('No projects to migrate');
      markMigrationComplete();
      return;
    }

    console.log(`Migrating ${localProjects.length} projects to Firestore...`);

    // Migrate each project
    for (const localProject of localProjects) {
      try {
        console.log(`Migrating project: ${localProject.name}`);

        // Convert dates to Firestore Timestamps
        const projectData = {
          name: localProject.name,
          description: '',
          storyboard: localProject.appState.creativeBrief ? {
            id: localProject.storyboardId || crypto.randomUUID(),
            title: localProject.appState.creativeBrief.brandName || localProject.name,
            creativeBrief: localProject.appState.creativeBrief,
            selectedMood: localProject.appState.moods.find(
              m => m.id === localProject.appState.selectedMoodId
            ) || null,
          } : null,
          scenes: [], // Scenes will be migrated separately if needed
          stats: {
            totalScenes: 0,
            completedScenes: 0,
            lastActivity: Timestamp.fromDate(new Date(localProject.updatedAt)),
          },
        };

        // Create project in Firestore
        await firestoreStore.createProject(projectData);

        console.log(`Successfully migrated project: ${localProject.name}`);
      } catch (error) {
        console.error(`Failed to migrate project ${localProject.name}:`, error);
        // Continue with other projects even if one fails
      }
    }

    console.log('Migration complete!');

    // Mark migration as complete
    markMigrationComplete();

    // Optional: Clear localStorage after successful migration
    // This is commented out for safety - uncomment if you want to clean up
    // localStorage.removeItem('jant-vid-pipe-projects');

  } catch (error) {
    console.error('Migration failed:', error);
    // Don't mark as complete if migration failed
  }
}

/**
 * Clean up old localStorage data after successful migration
 */
export function cleanupLocalStorage(): void {
  if (typeof window === 'undefined' || !hasMigrated()) {
    return;
  }

  const keysToRemove = [
    'jant-vid-pipe-projects',
    'jant-vid-pipe-current-project-id',
    'jant-vid-pipe-app-state',
    'jant-vid-pipe-storyboard-state',
  ];

  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      console.log(`Removing old localStorage key: ${key}`);
      localStorage.removeItem(key);
    }
  });
}