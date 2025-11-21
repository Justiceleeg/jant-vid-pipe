/**
 * Firestore-backed Project Store
 *
 * This store replaces localStorage with Firestore for project persistence,
 * providing real-time synchronization across all clients.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { convertBackendToFrontend, convertFrontendToBackend } from '@/lib/caseConversion';
import type { Project } from '@/types/project';
import { useAppStore } from './appStore';
import { useSceneStore } from './sceneStore';

interface FirestoreProjectState {
  // Current project state
  currentProject: Project | null;
  currentProjectId: string | null;

  // All user's projects
  projects: Project[];

  // Loading and error states
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Subscriptions
  projectSubscription: Unsubscribe | null;
  projectsSubscription: Unsubscribe | null;

  // Actions
  initializeStore: (userId: string) => Promise<void>;
  createProject: (data: Partial<Project>) => Promise<string>;
  loadProject: (projectId: string) => Promise<void>;
  updateProject: (updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  syncCurrentProjectState: () => Promise<void>;

  // Cleanup
  cleanup: () => void;
}

/**
 * Helper to get current user ID from Clerk or other auth provider
 */
async function getCurrentUserId(): Promise<string | null> {
  // TODO: Integrate with Clerk or your auth provider
  // For now, use a placeholder or localStorage fallback
  if (typeof window !== 'undefined') {
    // Check if Clerk is available
    const clerk = (window as any).Clerk;
    if (clerk?.user) {
      return clerk.user.id;
    }
  }

  // Fallback to a demo user ID for development
  return process.env.NODE_ENV === 'development' ? 'demo-user' : null;
}

/**
 * Convert app state to project structure for Firestore
 */
function createProjectFromAppState(name?: string): Partial<Project> {
  const appState = useAppStore.getState();
  const sceneState = useSceneStore.getState();

  // Build storyboard structure if creative brief exists
  let storyboard = null;
  if (appState.creativeBrief) {
    storyboard = {
      id: sceneState.storyboard?.storyboard_id || crypto.randomUUID(),
      title: appState.creativeBrief.brandName || 'Untitled Storyboard',
      creativeBrief: appState.creativeBrief,
      selectedMood: appState.moods.find(m => m.id === appState.selectedMoodId) || null,
    };
  }

  // Convert scenes from sceneStore
  const scenes = sceneState.scenes.map((scene, index) => ({
    id: scene.scene_id || crypto.randomUUID(),
    sceneNumber: index + 1,
    title: scene.title || `Scene ${index + 1}`,
    description: scene.description || '',
    durationSeconds: scene.duration || 5,
    assets: {
      compositionPath: scene.compositionPath,
      videoPath: scene.videoPath,
      audioPath: scene.audioPath,
      thumbnailPath: scene.imageUrl,
      generatedAt: scene.generatedAt ? Timestamp.fromDate(new Date(scene.generatedAt)) : null,
    },
    activeJob: scene.jobStatus ? {
      jobId: scene.jobId || crypto.randomUUID(),
      type: scene.jobType || 'composition',
      status: scene.jobStatus,
      progress: scene.progress || 0,
      startedAt: Timestamp.now(),
      lastUpdate: Timestamp.now(),
      errorMessage: scene.errorMessage,
    } : null,
    composition: scene.composition ? {
      description: scene.composition.description || '',
      styling: scene.composition.styling || '',
      animation: scene.composition.animation || '',
      generatedAt: Timestamp.now(),
    } : null,
  }));

  return {
    name: name || `Project ${new Date().toLocaleDateString()}`,
    description: '',
    storyboard,
    scenes,
    stats: {
      totalScenes: scenes.length,
      completedScenes: scenes.filter(s => s.assets.videoPath).length,
      lastActivity: Timestamp.now(),
    },
  };
}

/**
 * Sync app state to project in Firestore
 */
async function syncAppStateToFirestore(projectId: string, userId: string) {
  if (!firestore) {
    console.warn('Firestore not initialized, skipping sync');
    return;
  }

  const projectData = createProjectFromAppState();
  const firestoreData = convertFrontendToBackend({
    ...projectData,
    userId,
    updatedAt: serverTimestamp(),
  });

  try {
    await updateDoc(doc(firestore, 'projects', projectId), firestoreData);
  } catch (error) {
    console.error('Failed to sync app state to Firestore:', error);
    throw error;
  }
}

export const useFirestoreProjectStore = create<FirestoreProjectState>()(
  subscribeWithSelector((set, get) => ({
    currentProject: null,
    currentProjectId: null,
    projects: [],
    isLoading: false,
    isSaving: false,
    error: null,
    projectSubscription: null,
    projectsSubscription: null,

    initializeStore: async (userId: string) => {
      if (!firestore) {
        console.warn('Firestore not initialized');
        set({ error: 'Firebase not configured. Please check your environment variables.' });
        return;
      }

      set({ isLoading: true, error: null });

      try {
        // Clean up existing subscriptions
        get().cleanup();

        // Set up real-time subscription to user's projects
        const projectsQuery = query(
          collection(firestore, 'projects'),
          where('user_id', '==', userId),
          orderBy('updated_at', 'desc')
        );

        const unsubscribe = onSnapshot(
          projectsQuery,
          (snapshot) => {
            const projects = snapshot.docs.map(doc => {
              const data = doc.data();
              return convertBackendToFrontend<Project>({
                ...data,
                id: doc.id,
              });
            });

            set({ projects, isLoading: false });

            // If we have a current project ID but no subscription, set it up
            const { currentProjectId, projectSubscription } = get();
            if (currentProjectId && !projectSubscription) {
              get().loadProject(currentProjectId);
            }
          },
          (error) => {
            console.error('Error fetching projects:', error);
            set({ error: error.message, isLoading: false });
          }
        );

        set({ projectsSubscription: unsubscribe });
      } catch (error) {
        console.error('Failed to initialize store:', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to initialize store',
          isLoading: false
        });
      }
    },

    createProject: async (data: Partial<Project>) => {
      if (!firestore) {
        throw new Error('Firestore not initialized');
      }

      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      set({ isSaving: true, error: null });

      try {
        const projectId = crypto.randomUUID();
        const now = Timestamp.now();

        const projectData = {
          ...createProjectFromAppState(data.name),
          ...data,
          id: projectId,
          userId,
          createdAt: now,
          updatedAt: now,
        };

        const firestoreData = convertFrontendToBackend(projectData);

        await setDoc(doc(firestore, 'projects', projectId), firestoreData);

        // Load the new project
        await get().loadProject(projectId);

        set({ isSaving: false });

        return projectId;
      } catch (error) {
        console.error('Failed to create project:', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to create project',
          isSaving: false
        });
        throw error;
      }
    },

    loadProject: async (projectId: string) => {
      if (!firestore) {
        console.warn('Firestore not initialized');
        return;
      }

      set({ isLoading: true, error: null });

      try {
        // Clean up existing project subscription
        const { projectSubscription } = get();
        if (projectSubscription) {
          projectSubscription();
        }

        // Set up real-time subscription to the project
        const projectRef = doc(firestore, 'projects', projectId);

        const unsubscribe = onSnapshot(
          projectRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              set({
                error: 'Project not found',
                currentProject: null,
                currentProjectId: null,
                isLoading: false,
              });
              return;
            }

            const data = snapshot.data();
            const project = convertBackendToFrontend<Project>({
              ...data,
              id: snapshot.id,
            });

            set({
              currentProject: project,
              currentProjectId: projectId,
              isLoading: false,
              error: null,
            });

            // Update app stores with project data
            if (project.storyboard) {
              const appStore = useAppStore.getState();
              appStore.setCreativeBrief(project.storyboard.creativeBrief);

              if (project.storyboard.selectedMood) {
                appStore.selectMood(project.storyboard.selectedMood.id);
                appStore.setMoods([project.storyboard.selectedMood]);
              }
            }

            // Update scene store with project scenes
            if (project.scenes && project.scenes.length > 0) {
              const sceneStore = useSceneStore.getState();
              // Convert project scenes to scene store format
              const scenes = project.scenes.map(scene => ({
                scene_id: scene.id,
                title: scene.title,
                description: scene.description,
                duration: scene.durationSeconds,
                imageUrl: scene.assets?.thumbnailPath,
                videoPath: scene.assets?.videoPath,
                audioPath: scene.assets?.audioPath,
                compositionPath: scene.assets?.compositionPath,
                jobId: scene.activeJob?.jobId,
                jobStatus: scene.activeJob?.status,
                jobType: scene.activeJob?.type,
                progress: scene.activeJob?.progress,
                errorMessage: scene.activeJob?.errorMessage,
                composition: scene.composition,
                generatedAt: scene.assets?.generatedAt?.toDate().toISOString(),
              }));
              sceneStore.setScenes(scenes);
            }
          },
          (error) => {
            console.error('Error loading project:', error);
            set({
              error: error.message,
              isLoading: false,
            });
          }
        );

        set({ projectSubscription: unsubscribe });
      } catch (error) {
        console.error('Failed to load project:', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to load project',
          isLoading: false
        });
      }
    },

    updateProject: async (updates: Partial<Project>) => {
      const { currentProjectId } = get();
      if (!currentProjectId || !firestore) {
        throw new Error('No project selected or Firestore not initialized');
      }

      set({ isSaving: true, error: null });

      try {
        const firestoreData = convertFrontendToBackend({
          ...updates,
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(firestore, 'projects', currentProjectId), firestoreData);

        set({ isSaving: false });
      } catch (error) {
        console.error('Failed to update project:', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to update project',
          isSaving: false
        });
        throw error;
      }
    },

    deleteProject: async (projectId: string) => {
      if (!firestore) {
        throw new Error('Firestore not initialized');
      }

      set({ isSaving: true, error: null });

      try {
        await deleteDoc(doc(firestore, 'projects', projectId));

        // If deleting current project, clear state
        if (get().currentProjectId === projectId) {
          set({
            currentProject: null,
            currentProjectId: null,
          });

          // Reset app stores
          useAppStore.getState().reset();
          useSceneStore.getState().reset();
        }

        set({ isSaving: false });
      } catch (error) {
        console.error('Failed to delete project:', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to delete project',
          isSaving: false
        });
        throw error;
      }
    },

    syncCurrentProjectState: async () => {
      const { currentProjectId } = get();
      if (!currentProjectId) {
        return;
      }

      const userId = await getCurrentUserId();
      if (!userId) {
        console.warn('User not authenticated, skipping sync');
        return;
      }

      try {
        await syncAppStateToFirestore(currentProjectId, userId);
      } catch (error) {
        console.error('Failed to sync project state:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to sync project' });
      }
    },

    cleanup: () => {
      const { projectSubscription, projectsSubscription } = get();

      if (projectSubscription) {
        projectSubscription();
      }

      if (projectsSubscription) {
        projectsSubscription();
      }

      set({
        projectSubscription: null,
        projectsSubscription: null,
      });
    },
  }))
);

// Auto-sync app state changes to Firestore
if (typeof window !== 'undefined') {
  // Debounce sync to avoid too many writes
  let syncTimer: NodeJS.Timeout | null = null;
  const SYNC_DEBOUNCE_MS = 2000;

  const scheduleSync = () => {
    const { currentProjectId } = useFirestoreProjectStore.getState();
    if (!currentProjectId) return;

    if (syncTimer) {
      clearTimeout(syncTimer);
    }

    syncTimer = setTimeout(async () => {
      await useFirestoreProjectStore.getState().syncCurrentProjectState();
      syncTimer = null;
    }, SYNC_DEBOUNCE_MS);
  };

  // Subscribe to app store changes
  useAppStore.subscribe(scheduleSync);

  // Subscribe to scene store changes
  useSceneStore.subscribe(scheduleSync);

  // Initialize store when user is available
  const initializeWhenReady = async () => {
    const userId = await getCurrentUserId();
    if (userId) {
      await useFirestoreProjectStore.getState().initializeStore(userId);
    }
  };

  // Try to initialize immediately
  initializeWhenReady();

  // Also set up a listener for auth state changes if using Clerk
  if ((window as any).Clerk) {
    (window as any).Clerk.addListener(({ user }: any) => {
      if (user?.id) {
        useFirestoreProjectStore.getState().initializeStore(user.id);
      } else {
        useFirestoreProjectStore.getState().cleanup();
      }
    });
  }
}