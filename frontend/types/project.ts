/**
 * Frontend Project Types
 *
 * These types match the Firestore schema but are converted to camelCase
 * for frontend usage. They extend the shared types with frontend-specific
 * interfaces and utilities.
 */

import type {
  CreativeBrief as SharedCreativeBrief,
  SelectedMood as SharedSelectedMood,
  EmbeddedStoryboard as SharedEmbeddedStoryboard,
  Scene as SharedScene,
  ProjectStats as SharedProjectStats,
  Project as SharedProject,
  ActiveJob as SharedActiveJob,
  SceneAssets as SharedSceneAssets,
  Composition as SharedComposition,
  JobType,
  JobStatus
} from '../../shared/types/firestore-schema';

/**
 * Frontend-friendly timestamp representation
 * Converts Firestore Timestamp to ISO string for easier handling
 */
export type FrontendTimestamp = string; // ISO 8601 date string

/**
 * Convert snake_case fields to camelCase for frontend
 */
export interface CreativeBrief {
  brandName: string;
  productDescription: string;
  targetAudience: string;
  keyMessage: string;
  tone: string;
  additionalNotes?: string;
}

export interface SelectedMood {
  id: string;
  name: string;
  description: string;
  visualStyle: string;
  colorPalette: string[];
  moodKeywords: string[];
}

export interface EmbeddedStoryboard {
  id: string;
  title: string;
  creativeBrief: CreativeBrief;
  selectedMood: SelectedMood;
}

export interface ActiveJob {
  jobId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  startedAt: FrontendTimestamp;
  lastUpdate: FrontendTimestamp;
  errorMessage?: string;
}

export interface SceneAssets {
  compositionPath?: string;
  videoPath?: string;
  audioPath?: string;
  thumbnailPath?: string;
  generatedAt?: FrontendTimestamp;
}

export interface Composition {
  description: string;
  styling: string;
  animation: string;
  generatedAt: FrontendTimestamp;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  description: string;
  durationSeconds: number;
  assets: SceneAssets;
  activeJob?: ActiveJob;
  composition?: Composition;
}

export interface ProjectStats {
  totalScenes: number;
  completedScenes: number;
  lastActivity: FrontendTimestamp;
}

/**
 * Main Project interface for frontend
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: FrontendTimestamp;
  updatedAt: FrontendTimestamp;
  storyboard: EmbeddedStoryboard;
  scenes: Scene[];
  stats: ProjectStats;
}

/**
 * Request types for API calls
 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  creativeBrief: CreativeBrief;
  selectedMood: SelectedMood;
  storyboardTitle?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export interface AddSceneRequest {
  title: string;
  description: string;
  durationSeconds: number;
}

export interface UpdateSceneRequest {
  title?: string;
  description?: string;
  durationSeconds?: number;
  assets?: Partial<SceneAssets>;
  composition?: Composition;
}

export interface GenerateVideoRequest {
  sceneId: string;
}

export interface GenerateCompositionRequest {
  sceneId: string;
  prompt?: string;
}

/**
 * Response types
 */
export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface GenerateJobResponse {
  jobId: string;
  status: JobStatus;
}

/**
 * Type guards for runtime validation
 */
export function isValidJobStatus(status: string): status is JobStatus {
  return ['queued', 'processing', 'completed', 'failed'].includes(status);
}

export function isValidJobType(type: string): type is JobType {
  return ['composition', 'video', 'audio'].includes(type);
}

/**
 * Helper to check if a job is stale (no update in 5 minutes)
 */
export function isJobStale(job: ActiveJob): boolean {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return new Date(job.lastUpdate) < fiveMinutesAgo;
}

/**
 * Helper to check if a scene has completed assets
 */
export function isSceneComplete(scene: Scene): boolean {
  return !!(scene.assets.videoPath && scene.assets.compositionPath);
}

/**
 * Helper to calculate project completion percentage
 */
export function calculateProjectProgress(project: Project): number {
  if (project.scenes.length === 0) return 0;

  const completedScenes = project.scenes.filter(isSceneComplete).length;
  return Math.round((completedScenes / project.scenes.length) * 100);
}

// Re-export shared types that don't need conversion
export type { JobType, JobStatus };