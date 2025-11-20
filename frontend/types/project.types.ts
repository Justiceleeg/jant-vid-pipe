import type { CreativeBrief } from '@/types/chat.types';
import type { Mood } from '@/types/mood.types';
import type { ScenePlan } from '@/types/scene.types';
import type { COLMAPState, NeRFTrainingState, RenderingState } from '@/types/nerf.types';
import type { ProductImage } from '@/types/product.types';

/**
 * Project interface representing a complete video generation project.
 * Stores full app state snapshot and references to storyboard.
 */
export interface Project {
  id: string;
  name: string;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  thumbnail?: string; // Base64 or URL to thumbnail image
  storyboardId?: string; // Reference to storyboard (not full state)
  appState: AppStateSnapshot; // Full snapshot of appStore state
}

/**
 * Lightweight project metadata for listings.
 * Used when displaying project cards without loading full state.
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  storyboardId?: string;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Snapshot of appStore state for persistence.
 * This is a serializable representation of the app state.
 */
export interface AppStateSnapshot {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  creativeBrief: CreativeBrief | null;
  uploadedProduct: ProductImage | null;
  colmap: COLMAPState | null;
  nerfTraining: NeRFTrainingState | null;
  rendering: RenderingState | null;
  moods: Mood[];
  selectedMoodId: string | null;
  storyboardCompleted: boolean;
  scenePlan: ScenePlan | null;
  videoJobId: string | null;
  generatedClips: any[];
  audioUrl: string | null;
  compositionJobId: string | null;
  finalVideo: any | null;
  // Note: productImages (File[]) is not included as it cannot be serialized
}

/**
 * Request type for creating a new project.
 */
export interface CreateProjectRequest {
  name?: string; // Optional - will auto-generate if not provided
}

/**
 * Request type for updating a project.
 */
export interface UpdateProjectRequest {
  name?: string;
  thumbnail?: string;
}
