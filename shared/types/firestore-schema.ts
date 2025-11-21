/**
 * Firestore Schema Definitions for Project-Centric Data Model
 *
 * This is the single source of truth for all project-related data.
 * All data lives within a Project document in Firestore.
 */

// Using a type-compatible Timestamp interface to avoid Firebase SDK dependency
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

/**
 * Creative Brief embedded in storyboard
 */
export interface CreativeBrief {
  brand_name: string;
  product_description: string;
  target_audience: string;
  key_message: string;
  tone: string;
  additional_notes?: string;
}

/**
 * Mood selection embedded in storyboard
 */
export interface SelectedMood {
  id: string;
  name: string;
  description: string;
  visual_style: string;
  color_palette: string[];
  mood_keywords: string[];
}

/**
 * Embedded storyboard data (no longer a separate collection)
 */
export interface EmbeddedStoryboard {
  id: string;
  title: string;
  creative_brief: CreativeBrief;
  selected_mood: SelectedMood;
}

/**
 * Job types for tracking generation progress
 */
export type JobType = 'composition' | 'video' | 'audio';

/**
 * Job status states
 */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Active job tracking for a scene
 */
export interface ActiveJob {
  job_id: string;
  type: JobType;
  status: JobStatus;
  progress: number;  // 0-100 for smooth UI updates
  started_at: Timestamp;
  last_update: Timestamp;  // For stale job detection
  error_message?: string;
}

/**
 * Asset storage references (Firebase Storage paths, not URLs)
 */
export interface SceneAssets {
  composition_path?: string;
  video_path?: string;
  audio_path?: string;
  thumbnail_path?: string;
  generated_at?: Timestamp;
}

/**
 * AI-generated composition details
 */
export interface Composition {
  description: string;
  styling: string;
  animation: string;
  generated_at: Timestamp;
}

/**
 * Scene data structure
 */
export interface Scene {
  id: string;  // UUID for cloud function reference
  scene_number: number;
  title: string;
  description: string;
  duration_seconds: number;

  // Generated assets (Firebase Storage paths)
  assets: SceneAssets;

  // Current active job (only track current, not history)
  active_job?: ActiveJob;

  // AI-generated composition
  composition?: Composition;
}

/**
 * Project-level statistics for monitoring
 */
export interface ProjectStats {
  total_scenes: number;
  completed_scenes: number;
  last_activity: Timestamp;
}

/**
 * Main Project Document Structure
 * This is the complete data model for a project in Firestore.
 */
export interface Project {
  // Core fields
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;

  // Embedded storyboard (no longer separate collection)
  storyboard: EmbeddedStoryboard;

  // Scenes as array (no reordering complexity for now)
  scenes: Scene[];

  // Project-level stats for monitoring
  stats: ProjectStats;
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
  return job.last_update.toDate() < fiveMinutesAgo;
}

/**
 * Helper to check if a scene has completed assets
 */
export function isSceneComplete(scene: Scene): boolean {
  return !!(scene.assets.video_path && scene.assets.composition_path);
}

/**
 * Helper to calculate project completion percentage
 */
export function calculateProjectProgress(project: Project): number {
  if (project.scenes.length === 0) return 0;

  const completedScenes = project.scenes.filter(isSceneComplete).length;
  return Math.round((completedScenes / project.scenes.length) * 100);
}