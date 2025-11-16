/**
 * TypeScript types for video generation and progress tracking.
 */

/**
 * Video generation job status.
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Represents a single video clip being generated.
 */
export interface VideoClip {
  scene_number: number;
  video_url: string | null;
  duration: number;
  status: JobStatus;
  error: string | null;
  progress_percent: number;
}

/**
 * Complete video generation job status.
 */
export interface VideoJobStatus {
  job_id: string;
  status: JobStatus;
  total_scenes: number;
  completed_scenes: number;
  failed_scenes: number;
  progress_percent: number;
  clips: VideoClip[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Request payload for video generation.
 */
export interface VideoGenerationRequest {
  scenes: Array<{
    scene_number: number;
    duration: number;
    description: string;
    style_prompt: string;
    seed_image_url: string;
  }>;
  mood_style_keywords?: string[];
  mood_aesthetic_direction?: string;
}

/**
 * Response from video generation initiation API.
 */
export interface VideoGenerationResponse {
  success: boolean;
  job_id: string;
  message: string;
  total_scenes: number;
}

/**
 * Response from job status polling API.
 */
export interface VideoJobStatusResponse {
  success: boolean;
  job_status: VideoJobStatus | null;
  message?: string;
}
