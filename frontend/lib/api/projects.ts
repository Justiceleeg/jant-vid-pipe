/**
 * Projects API Client
 *
 * Handles all project-related API calls with proper type conversion
 * between frontend (camelCase) and backend (snake_case) formats.
 */

import {
  convertBackendToFrontend,
  convertFrontendToBackend,
} from '@/lib/caseConversion';
import type {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddSceneRequest,
  UpdateSceneRequest,
  GenerateVideoRequest,
  GenerateCompositionRequest,
  ProjectListResponse,
  GenerateJobResponse,
} from '@/types/project';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Base fetch wrapper with error handling and case conversion
 */
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get auth token if available (from Clerk or other auth provider)
  const authToken = await getAuthToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return convertBackendToFrontend<T>(data);
}

/**
 * Get authentication token from Clerk
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    // Server-side: no token available
    return null;
  }

  // DEVELOPMENT: Use demo token in development mode
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
    console.log('[API] Using demo token for development');
    return 'demo-token';
  }

  try {
    // Wait for Clerk to be loaded
    const clerk = (window as any).Clerk;
    if (!clerk) {
      console.warn('Clerk not initialized');
      return null;
    }

    // Wait for Clerk to be ready
    await clerk.load();

    // Get the active session
    const session = clerk.session;
    if (!session) {
      console.warn('No active Clerk session');
      return null;
    }

    // Get the JWT token
    const token = await session.getToken();
    if (!token) {
      console.warn('No auth token available from session');
      return null;
    }

    return token;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    // In development, fall back to demo token
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Falling back to demo token after auth error');
      return 'demo-token';
    }
    return null;
  }
}

/**
 * Project API Methods
 */
export const projectsApi = {
  /**
   * Create a new project
   */
  async create(data: CreateProjectRequest): Promise<Project> {
    const requestData = convertFrontendToBackend(data);
    return apiRequest<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  /**
   * Get a single project by ID
   */
  async get(projectId: string): Promise<Project> {
    const response = await apiRequest<any>(`/api/projects/${projectId}`);
    // Backend wraps response in { project: ..., signed_urls: ... }
    const projectData = response.project || response;
    return projectData;
  },

  /**
   * List all projects for the current user
   */
  async list(): Promise<ProjectListResponse> {
    return apiRequest<ProjectListResponse>('/api/projects');
  },

  /**
   * Update a project
   */
  async update(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    const requestData = convertFrontendToBackend(data);
    return apiRequest<Project>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(requestData),
    });
  },

  /**
   * Delete a project
   */
  async delete(projectId: string): Promise<void> {
    await apiRequest<void>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Add a scene to a project
   */
  async addScene(projectId: string, data: AddSceneRequest): Promise<Project> {
    const requestData = convertFrontendToBackend(data);
    return apiRequest<Project>(`/api/projects/${projectId}/scenes`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  /**
   * Update a specific scene
   */
  async updateScene(
    projectId: string,
    sceneId: string,
    data: UpdateSceneRequest
  ): Promise<Project> {
    const requestData = convertFrontendToBackend(data);
    return apiRequest<Project>(
      `/api/projects/${projectId}/scenes/${sceneId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(requestData),
      }
    );
  },

  /**
   * Generate video for a scene
   */
  async generateVideo(
    projectId: string,
    sceneId: string
  ): Promise<GenerateJobResponse> {
    return apiRequest<GenerateJobResponse>(
      `/api/projects/${projectId}/scenes/${sceneId}/generate-video`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
  },

  /**
   * Generate composition for a scene
   */
  async generateComposition(
    projectId: string,
    sceneId: string,
    prompt?: string
  ): Promise<GenerateJobResponse> {
    const requestData = prompt ? { prompt } : {};
    return apiRequest<GenerateJobResponse>(
      `/api/projects/${projectId}/scenes/${sceneId}/generate-composition`,
      {
        method: 'POST',
        body: JSON.stringify(requestData),
      }
    );
  },

  /**
   * Initialize scenes for a project
   */
  async initializeScenes(projectId: string): Promise<Project> {
    const response = await apiRequest<any>(
      `/api/projects/${projectId}/scenes/initialize`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    // Backend might wrap response
    return response.project || response;
  },

  /**
   * Regenerate text for a specific scene
   */
  async regenerateText(projectId: string, sceneId: string): Promise<Scene> {
    return apiRequest<Scene>(
      `/api/projects/${projectId}/scenes/${sceneId}/regenerate-text`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
  },

  /**
   * Regenerate image for a specific scene
   */
  async regenerateImage(projectId: string, sceneId: string): Promise<GenerateVideoResponse> {
    return apiRequest<GenerateVideoResponse>(
      `/api/projects/${projectId}/scenes/${sceneId}/regenerate-image`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
  },
};

/**
 * Real-time subscription to project updates (using Firestore)
 */
export interface ProjectSubscription {
  unsubscribe: () => void;
}

/**
 * Subscribe to real-time project updates
 */
export function subscribeToProject(
  projectId: string,
  callback: (project: Project) => void
): ProjectSubscription {
  if (!firestore) {
    console.warn('Firestore not initialized');
    return { unsubscribe: () => {} };
  }

  const projectRef = doc(firestore, 'projects', projectId);

  const unsubscribe = onSnapshot(
    projectRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const project = convertBackendToFrontend<Project>({
          ...data,
          id: snapshot.id,
        });
        callback(project);
      }
    },
    (error) => {
      console.error('Error subscribing to project:', error);
    }
  );

  return { unsubscribe };
}

/**
 * Subscribe to real-time updates for all user projects
 */
export function subscribeToUserProjects(
  userId: string,
  callback: (projects: Project[]) => void
): ProjectSubscription {
  if (!firestore) {
    console.warn('Firestore not initialized');
    return { unsubscribe: () => {} };
  }

  // Note: Removed orderBy to avoid requiring Firestore composite index
  // Sorting is handled on the frontend instead
  const projectsQuery = query(
    collection(firestore, 'projects'),
    where('user_id', '==', userId)
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
      callback(projects);
    },
    (error) => {
      console.error('Error subscribing to projects:', error);
    }
  );

  return { unsubscribe };
}

/**
 * Export individual functions for convenience
 */
export const createProject = projectsApi.create;
export const getProject = projectsApi.get;
export const listProjects = projectsApi.list;
export const updateProject = projectsApi.update;
export const deleteProject = projectsApi.delete;
export const addScene = projectsApi.addScene;
export const updateScene = projectsApi.updateScene;
export const generateVideo = projectsApi.generateVideo;
export const generateComposition = projectsApi.generateComposition;