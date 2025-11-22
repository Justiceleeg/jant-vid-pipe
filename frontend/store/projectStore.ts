import { create } from 'zustand';
import type { Project, ProjectMetadata, AppStateSnapshot, CreateProjectRequest, UpdateProjectRequest } from '@/types/project.types';
import { migrateNumericStep } from '@/lib/steps';
import { useAppStore } from './appStore';
import { useSceneStore } from './sceneStore';
import { projectsApi } from '@/lib/api/projects';
import type { CreateProjectRequest as ApiCreateProjectRequest } from '@/types/project';

const PROJECTS_STORAGE_KEY = 'jant-vid-pipe-projects';
const CURRENT_PROJECT_STORAGE_KEY = 'jant-vid-pipe-current-project-id';

interface ProjectStoreState {
  projects: Project[];
  currentProjectId: string | null;

  // CRUD operations
  createProject: (request?: CreateProjectRequest) => Promise<string>;
  updateProject: (id: string, updates: UpdateProjectRequest) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string;
  renameProject: (id: string, newName: string) => void;

  // Project selection
  selectProject: (id: string) => void;
  loadProject: (id: string) => void;

  // Auto-save
  saveCurrentProject: () => void;
  scheduleAutoSave: () => void;

  // Utilities
  getProjectMetadata: () => ProjectMetadata[];
  getCurrentProject: () => Project | null;
  generateThumbnail: (projectId: string) => Promise<string | undefined>;
}

let autoSaveTimer: NodeJS.Timeout | null = null;
const AUTO_SAVE_DEBOUNCE_MS = 1500;

// Helper to generate project name
function generateProjectName(existingProjects: Project[]): string {
  const projectNumbers = existingProjects
    .map(p => {
      const match = p.name.match(/^Project (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);
  
  const nextNumber = projectNumbers.length > 0 
    ? Math.max(...projectNumbers) + 1 
    : 1;
  
  return `Project ${nextNumber}`;
}

// Helper to create app state snapshot
function createAppStateSnapshot(): AppStateSnapshot {
  const appState = useAppStore.getState();
  return {
    currentStep: appState.currentStep,
    creativeBrief: appState.creativeBrief,
    chatMessages: appState.chatMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    })),
    moods: appState.moods,
    selectedMoodId: appState.selectedMoodId,
    backgroundAssets: appState.backgroundAssets || [],
    selectedBackgroundIds: appState.selectedBackgroundIds || [],
    storyboardCompleted: appState.storyboardCompleted,
    audioUrl: appState.audioUrl,
    compositionJobId: appState.compositionJobId,
    finalVideo: appState.finalVideo,
  };
}

// Helper to restore app state from snapshot
function restoreAppState(snapshot: AppStateSnapshot): void {
  const appStore = useAppStore.getState();
  
  // Migrate old numeric steps to string-based steps
  const currentStep = typeof snapshot.currentStep === 'number' 
    ? migrateNumericStep(snapshot.currentStep)
    : snapshot.currentStep;
  
  appStore.setCurrentStep(currentStep);
  appStore.setCreativeBrief(snapshot.creativeBrief);
  // Restore chat messages, converting ISO strings back to Date objects
  appStore.setChatMessages(
    (snapshot.chatMessages || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }))
  );
  appStore.setMoods(snapshot.moods);
  // Set selectedMoodId - if null, clear by setting to empty string
  appStore.selectMood(snapshot.selectedMoodId || '');
  appStore.setBackgroundAssets(snapshot.backgroundAssets || []);
  appStore.setSelectedBackgroundIds(snapshot.selectedBackgroundIds || []);
  appStore.setStoryboardCompleted(snapshot.storyboardCompleted);
  // Always set audioUrl, even if null, to clear previous project's audio
  appStore.setAudioUrl(snapshot.audioUrl || null);
  // Always set compositionJobId, even if null
  appStore.setCompositionJobId(snapshot.compositionJobId || null);
  // Always set finalVideo, even if null
  appStore.setFinalVideo(snapshot.finalVideo || null);
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
      projects: [],
      currentProjectId: null,

      createProject: async (request) => {
        const state = get();
        const name = request?.name || generateProjectName(state.projects);

        // First create the project locally for immediate UI feedback
        const tempId = crypto.randomUUID();
        const now = new Date().toISOString();
        const newProject: Project = {
          id: tempId,
          name,
          createdAt: now,
          updatedAt: now,
          brandAssetIds: request?.brandAssetIds || [],
          characterAssetIds: request?.characterAssetIds || [],
          backgroundAssetIds: request?.backgroundAssetIds || [],
          appState: createAppStateSnapshot(),
        };

        set({
          projects: [...state.projects, newProject],
          currentProjectId: tempId,
        });

        // Reset app store for new project
        useAppStore.getState().reset();
        useSceneStore.getState().reset();

        try {
          // Create project in backend with minimal data
          const createRequest: any = {
            name,
            description: '',
            storyboardTitle: name,
            // Don't send creative_brief or selectedMood until they're actually created
            creativeBrief: null,
            selectedMood: null,
          };

          const createdProject = await projectsApi.create(createRequest);

          // Update local state with the real project from backend
          const updatedProjects = state.projects.map(p =>
            p.id === tempId ? { ...p, id: createdProject.id } : p
          );

          set({
            projects: updatedProjects,
            currentProjectId: createdProject.id,
          });

          console.log('[ProjectStore] Created project in backend:', { id: createdProject.id, name });
          return createdProject.id;
        } catch (error) {
          console.error('[ProjectStore] Failed to create project in backend:', error);
          // Keep the local project for now, but return the temp ID
          // The next sync attempt will try to create it again
          return tempId;
        }
      },

      updateProject: (id, updates) => {
        const state = get();
        const projectIndex = state.projects.findIndex(p => p.id === id);
        if (projectIndex === -1) return;

        const updatedProjects = [...state.projects];
        updatedProjects[projectIndex] = {
          ...updatedProjects[projectIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        set({ projects: updatedProjects });
      },

      deleteProject: (id) => {
        const state = get();
        const filteredProjects = state.projects.filter(p => p.id !== id);
        
        let newCurrentProjectId = state.currentProjectId;
        if (state.currentProjectId === id) {
          // If deleting current project, select first available or null
          newCurrentProjectId = filteredProjects.length > 0 ? filteredProjects[0].id : null;
          if (newCurrentProjectId) {
            get().loadProject(newCurrentProjectId);
          } else {
            // Reset stores if no projects left
            useAppStore.getState().reset();
            useSceneStore.getState().reset();
          }
        }

        set({
          projects: filteredProjects,
          currentProjectId: newCurrentProjectId,
        });
      },

      duplicateProject: (id) => {
        const state = get();
        const project = state.projects.find(p => p.id === id);
        if (!project) return id;

        const newProjectId = crypto.randomUUID();
        const now = new Date().toISOString();
        const duplicatedName = `${project.name} (Copy)`;

        const duplicatedProject: Project = {
          ...project,
          id: newProjectId,
          name: duplicatedName,
          createdAt: now,
          updatedAt: now,
          thumbnail: undefined, // Don't copy thumbnail
        };

        set({
          projects: [...state.projects, duplicatedProject],
          currentProjectId: newProjectId,
        });

        // Load the duplicated project
        get().loadProject(newProjectId);

        return newProjectId;
      },

      renameProject: (id, newName) => {
        get().updateProject(id, { name: newName });
      },

      selectProject: (id) => {
        set({ currentProjectId: id });
      },

      loadProject: (id) => {
        const state = get();
        const project = state.projects.find(p => p.id === id);
        if (!project) {
          console.error(`[ProjectStore] Project not found: ${id}`);
          return;
        }

        console.log('[ProjectStore] Loading project:', { 
          id, 
          name: project.name,
          hasCreativeBrief: !!project.appState.creativeBrief,
          moodsCount: project.appState.moods.length,
          currentStep: project.appState.currentStep,
          storyboardId: project.storyboardId 
        });

        // Set as current project
        set({ currentProjectId: id });

        // Reset scene store FIRST to clear any previous project's scenes
        useSceneStore.getState().reset();

        // Check if project has app_state_snapshot from backend (Option 3)
        if ((project as any).appStateSnapshot) {
          console.log('[ProjectStore] Restoring from backend appStateSnapshot');
          // Restore from the full snapshot saved in backend
          const snapshot = (project as any).appStateSnapshot;
          const appStore = useAppStore.getState();
          
          // Restore all fields from the snapshot
          if (snapshot.currentStep) appStore.setCurrentStep(snapshot.currentStep);
          if (snapshot.creativeBrief) appStore.setCreativeBrief(snapshot.creativeBrief);
          if (snapshot.chatMessages) {
            appStore.setChatMessages(
              snapshot.chatMessages.map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
              }))
            );
          }
          if (snapshot.moods) appStore.setMoods(snapshot.moods);
          if (snapshot.selectedMoodId !== undefined) appStore.selectMood(snapshot.selectedMoodId || '');
          if (snapshot.backgroundAssets) appStore.setBackgroundAssets(snapshot.backgroundAssets);
          if (snapshot.selectedBackgroundIds) appStore.setSelectedBackgroundIds(snapshot.selectedBackgroundIds);
          if (snapshot.storyboardCompleted !== undefined) appStore.setStoryboardCompleted(snapshot.storyboardCompleted);
          if (snapshot.audioUrl !== undefined) appStore.setAudioUrl(snapshot.audioUrl);
          if (snapshot.compositionJobId !== undefined) appStore.setCompositionJobId(snapshot.compositionJobId);
          if (snapshot.finalVideo !== undefined) appStore.setFinalVideo(snapshot.finalVideo);
          
          // Any other fields in the snapshot should also be restored
          // This ensures forward compatibility
        } else {
          // Fallback to existing appState format
          restoreAppState(project.appState);
        }

        // Load storyboard if storyboardId exists
        if (project.storyboardId) {
          console.log('[ProjectStore] Loading storyboard for project:', project.storyboardId);
          useSceneStore.getState().loadStoryboard(project.storyboardId).catch(err => {
            // If storyboard not found, clear the reference
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes('STORYBOARD_NOT_FOUND') || 
                errorMessage.includes('404') || 
                errorMessage.includes('not found')) {
              console.warn('[ProjectStore] Storyboard not found, clearing reference from project');
              get().updateProject(id, { storyboardId: undefined });
            } else {
              console.error('[ProjectStore] Failed to load storyboard:', err);
            }
          });
        } else {
          console.log('[ProjectStore] No storyboard associated with this project yet');
        }
      },

      saveCurrentProject: async () => {
        const state = get();
        if (!state.currentProjectId) return;

        const projectIndex = state.projects.findIndex(p => p.id === state.currentProjectId);
        if (projectIndex === -1) return;

        const appStateSnapshot = createAppStateSnapshot();
        const sceneState = useSceneStore.getState();
        const storyboardId = sceneState.storyboard?.storyboard_id;

        const updatedProjects = [...state.projects];
        const projectName = updatedProjects[projectIndex].name;
        const projectToUpdate = {
          ...updatedProjects[projectIndex],
          appState: appStateSnapshot,
          storyboardId,
          updatedAt: new Date().toISOString(),
        };

        // Update local state optimistically
        updatedProjects[projectIndex] = projectToUpdate;
        set({ projects: updatedProjects });

        // Sync with backend API
        try {
          // Convert local project format to backend format
          const updateData: any = {
            name: projectToUpdate.name,
            storyboard: appStateSnapshot.creativeBrief ? {
              id: storyboardId || crypto.randomUUID(),
              title: (appStateSnapshot.creativeBrief as any).product_name || projectName,
              creativeBrief: appStateSnapshot.creativeBrief,
              selectedMood: appStateSnapshot.moods.find(m => m.id === appStateSnapshot.selectedMoodId) || null,
            } : undefined,  // Use undefined instead of null for optional field
            // NEW: Option 3 - Store entire appStore state for perfect sync
            appStateSnapshot: appStateSnapshot,
            // Note: scenes will be handled separately via scene APIs
          };

          await projectsApi.update(state.currentProjectId, updateData);

          console.log('[ProjectStore] Synced project to backend:', {
            id: state.currentProjectId,
            name: projectName,
            hasCreativeBrief: !!appStateSnapshot.creativeBrief,
            moodsCount: appStateSnapshot.moods.length,
            currentStep: appStateSnapshot.currentStep
          });
        } catch (error) {
          console.error('[ProjectStore] Failed to sync to backend:', error);
          // Keep the optimistic update even if backend sync fails
          // The next sync attempt will retry
        }
      },

      scheduleAutoSave: () => {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
          get().saveCurrentProject();
          autoSaveTimer = null;
        }, AUTO_SAVE_DEBOUNCE_MS);
      },

      getProjectMetadata: () => {
        const state = get();
        return state.projects.map(project => ({
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          thumbnail: project.thumbnail,
          storyboardId: project.storyboardId,
          currentStep: project.appState.currentStep,
        }));
      },

      getCurrentProject: () => {
        const state = get();
        if (!state.currentProjectId) return null;
        return state.projects.find(p => p.id === state.currentProjectId) || null;
      },

      generateThumbnail: async (projectId) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return undefined;

        // Priority 1: Try to get thumbnail from storyboard scenes
        if (project.storyboardId) {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_URL}/api/storyboards/${project.storyboardId}`);
            if (response.ok) {
              const data = await response.json();
              const scenes = data.scenes || [];
              // Find first scene with an image
              const sceneWithImage = scenes.find((scene: any) => scene.image_url);
              if (sceneWithImage) {
                return sceneWithImage.image_url;
              }
            }
          } catch (error) {
            console.error('[ProjectStore] Failed to fetch storyboard for thumbnail:', error);
          }
        }

        // Priority 2: Try to get thumbnail from mood images
        if (project.appState.moods.length > 0) {
          const firstMood = project.appState.moods[0];
          if (firstMood.images.length > 0) {
            return firstMood.images[0].url;
          }
        }

        // Priority 3: No image available, will use project name fallback
        return undefined;
      },
}));

// Subscribe to appStore changes to trigger auto-save to backend
if (typeof window !== 'undefined') {
  // Clean up old localStorage keys from previous persistence system
  const cleanupOldStorage = () => {
    const oldKeys = [
      'jant-vid-pipe-app-state',
      'jant-vid-pipe-storyboard-state',
      'jant-vid-pipe-projects',
      'jant-vid-pipe-current-project-id'
    ];
    oldKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log('[ProjectStore] Cleaning up old localStorage key:', key);
        localStorage.removeItem(key);
      }
    });
  };
  cleanupOldStorage();

  // Subscribe to app state changes to sync with backend
  useAppStore.subscribe(() => {
    const { currentProjectId } = useProjectStore.getState();
    if (currentProjectId) {
      // Instead of saving to localStorage, we'll sync to backend via API
      useProjectStore.getState().scheduleAutoSave();
    }
  });

  // Note: Project loading will now be handled by components using the
  // useProject hook with real-time Firestore subscriptions
}

