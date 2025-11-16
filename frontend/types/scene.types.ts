/**
 * TypeScript types for scene planning and storyboarding system.
 */

/**
 * Represents a single scene in the video timeline.
 */
export interface Scene {
  scene_number: number;
  duration: number;
  description: string;
  style_prompt: string;
  seed_image_url?: string | null;
  generation_success?: boolean;
  generation_error?: string | null;
}

/**
 * Complete scene plan for a 30-second video.
 */
export interface ScenePlan {
  total_duration: number;
  scenes: Scene[];
}

/**
 * Request payload for scene plan generation.
 */
export interface ScenePlanRequest {
  // Creative brief fields
  product_name: string;
  target_audience: string;
  emotional_tone: string[];
  visual_style_keywords: string[];
  key_messages: string[];

  // Selected mood data
  mood_id: string;
  mood_name: string;
  mood_style_keywords: string[];
  mood_color_palette: string[];
  mood_aesthetic_direction: string;
}

/**
 * Response from scene plan generation API.
 */
export interface ScenePlanResponse {
  success: boolean;
  scene_plan: ScenePlan;
  message?: string | null;
}

/**
 * Request payload for seed image generation.
 */
export interface SeedImageRequest {
  scenes: Scene[];
  mood_style_keywords: string[];
  mood_color_palette: string[];
  mood_aesthetic_direction: string;
}

/**
 * Response from seed image generation API.
 */
export interface SeedImageResponse {
  success: boolean;
  scenes_with_images: Scene[];
  message?: string | null;
  total_scenes: number;
  successful_images: number;
}
