/**
 * React Hook for Project Management
 *
 * Provides a comprehensive interface for managing projects with
 * real-time updates, optimistic updates, and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  projectsApi,
  subscribeToProject,
  subscribeToUserProjects,
  type ProjectSubscription,
} from '@/lib/api/projects';
import type {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddSceneRequest,
  UpdateSceneRequest,
  Scene,
} from '@/types/project';

/**
 * Hook state interface
 */
interface UseProjectState {
  project: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
}

/**
 * Hook return interface
 */
interface UseProjectReturn extends UseProjectState {
  // Project CRUD operations
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  loadProject: (projectId: string) => Promise<Project>;
  updateProject: (data: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;

  // Scene operations
  addScene: (data: AddSceneRequest) => Promise<void>;
  updateScene: (sceneId: string, data: UpdateSceneRequest) => Promise<void>;
  generateVideo: (sceneId: string) => Promise<void>;
  generateComposition: (sceneId: string, prompt?: string) => Promise<void>;

  // Utility functions
  loadProjects: () => Promise<void>;
  clearError: () => void;
  findScene: (sceneId: string) => Scene | undefined;
}

/**
 * Main hook for project management
 */
export function useProject(projectId?: string): UseProjectReturn {
  const [state, setState] = useState<UseProjectState>({
    project: null,
    projects: [],
    isLoading: false,
    error: null,
    isSaving: false,
  });

  const subscriptionRef = useRef<ProjectSubscription | null>(null);
  const currentProjectIdRef = useRef<string | undefined>(undefined);

  // Load a specific project
  const loadProject = useCallback(async (id: string): Promise<Project> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const project = await projectsApi.get(id);
      setState((prev) => ({ ...prev, project, isLoading: false }));
      return project;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error as Error,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  // Load all projects for the user
  const loadProjects = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await projectsApi.list();
      setState((prev) => ({
        ...prev,
        projects: response.projects,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error as Error,
        isLoading: false,
      }));
    }
  }, []);

  // Create a new project
  const createProject = useCallback(
    async (data: CreateProjectRequest): Promise<Project> => {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        const project = await projectsApi.create(data);
        setState((prev) => ({
          ...prev,
          project,
          projects: [...prev.projects, project],
          isSaving: false,
        }));
        return project;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error as Error,
          isSaving: false,
        }));
        throw error;
      }
    },
    []
  );

  // Update the current project
  const updateProject = useCallback(
    async (data: UpdateProjectRequest): Promise<Project> => {
      if (!state.project) {
        throw new Error('No project loaded');
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      // Optimistic update
      const optimisticProject = { ...state.project, ...data };
      setState((prev) => ({ ...prev, project: optimisticProject }));

      try {
        const updated = await projectsApi.update(state.project.id, data);
        setState((prev) => ({
          ...prev,
          project: updated,
          projects: prev.projects.map((p) =>
            p.id === updated.id ? updated : p
          ),
          isSaving: false,
        }));
        return updated;
      } catch (error) {
        // Revert optimistic update
        setState((prev) => ({
          ...prev,
          project: state.project,
          error: error as Error,
          isSaving: false,
        }));
        throw error;
      }
    },
    [state.project]
  );

  // Delete a project
  const deleteProject = useCallback(
    async (id: string) => {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        await projectsApi.delete(id);
        setState((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          project: prev.project?.id === id ? null : prev.project,
          isSaving: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error as Error,
          isSaving: false,
        }));
        throw error;
      }
    },
    []
  );

  // Add a scene to the current project
  const addScene = useCallback(
    async (data: AddSceneRequest) => {
      if (!state.project) {
        throw new Error('No project loaded');
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        const updated = await projectsApi.addScene(state.project.id, data);
        setState((prev) => ({
          ...prev,
          project: updated,
          isSaving: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error as Error,
          isSaving: false,
        }));
        throw error;
      }
    },
    [state.project]
  );

  // Update a specific scene
  const updateScene = useCallback(
    async (sceneId: string, data: UpdateSceneRequest) => {
      if (!state.project) {
        throw new Error('No project loaded');
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      // Optimistic update
      const optimisticProject = {
        ...state.project,
        scenes: state.project.scenes.map((scene) =>
          scene.id === sceneId ? { ...scene, ...data } : scene
        ),
      };
      setState((prev) => ({ ...prev, project: optimisticProject }));

      try {
        const updated = await projectsApi.updateScene(
          state.project.id,
          sceneId,
          data
        );
        setState((prev) => ({
          ...prev,
          project: updated,
          isSaving: false,
        }));
      } catch (error) {
        // Revert optimistic update
        setState((prev) => ({
          ...prev,
          project: state.project,
          error: error as Error,
          isSaving: false,
        }));
        throw error;
      }
    },
    [state.project]
  );

  // Generate video for a scene
  const generateVideo = useCallback(
    async (sceneId: string) => {
      if (!state.project) {
        throw new Error('No project loaded');
      }

      setState((prev) => ({ ...prev, error: null }));
      try {
        const response = await projectsApi.generateVideo(
          state.project.id,
          sceneId
        );
        // The job status will be updated via real-time subscription
        console.log('Video generation started:', response);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error as Error,
        }));
        throw error;
      }
    },
    [state.project]
  );

  // Generate composition for a scene
  const generateComposition = useCallback(
    async (sceneId: string, prompt?: string) => {
      if (!state.project) {
        throw new Error('No project loaded');
      }

      setState((prev) => ({ ...prev, error: null }));
      try {
        const response = await projectsApi.generateComposition(
          state.project.id,
          sceneId,
          prompt
        );
        // The job status will be updated via real-time subscription
        console.log('Composition generation started:', response);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error as Error,
        }));
        throw error;
      }
    },
    [state.project]
  );

  // Find a scene by ID
  const findScene = useCallback(
    (sceneId: string): Scene | undefined => {
      return state.project?.scenes.find((scene) => scene.id === sceneId);
    },
    [state.project]
  );

  // Clear error state
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    // Clean up previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    // Subscribe to new project if ID provided
    if (projectId && projectId !== currentProjectIdRef.current) {
      currentProjectIdRef.current = projectId;

      // Load initial data
      loadProject(projectId).catch(err => 
        console.error('[useProject] Failed to load project:', err)
      );

      // Set up real-time subscription for project updates
      subscriptionRef.current = subscribeToProject(projectId, (project) => {
        setState((prev) => ({
          ...prev,
          project,
          isLoading: false,
          projects: prev.projects.map((p) =>
            p.id === project.id ? project : p
          ),
        }));
      });
    }

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [projectId, loadProject]);

  return {
    ...state,
    createProject,
    loadProject,
    updateProject,
    deleteProject,
    addScene,
    updateScene,
    generateVideo,
    generateComposition,
    loadProjects,
    clearError,
    findScene,
  };
}

/**
 * Hook for managing multiple projects (project list view)
 */
export function useProjects(userId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<ProjectSubscription | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await projectsApi.list();
      setProjects(response.projects);
      setIsLoading(false);
    } catch (error) {
      setError(error as Error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // TEMPORARY: Skip backend API call, use only Firestore subscription
    // TODO: Fix auth token passing, then re-enable backend API
    // loadProjects();

    // Set up real-time subscription if userId is provided
    if (userId) {
      subscriptionRef.current = subscribeToUserProjects(userId, (projects) => {
        console.log('[useProjects] Real-time update received:', projects.length, 'projects');
        setProjects(projects);
        setIsLoading(false);
      });
    } else {
      // No userId, can't subscribe - set loading false
      setIsLoading(false);
    }

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [userId]);

  return {
    projects,
    isLoading,
    error,
    refresh: loadProjects,
  };
}