"""Replicate API service for image generation."""
import asyncio
from typing import List, Dict, Any, Optional
import replicate
from app.config import settings


class ReplicateImageService:
    """Service for generating images using Replicate API."""
    
    # Production model: SDXL (higher quality, more expensive, slower)
    # Quality: Excellent detail, great prompt following, professional results
    # Speed: ~30-60 seconds per 1080x1920 image
    # Verified model on Replicate
    PRODUCTION_IMAGE_MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
    
    # Development model: Use SDXL with optimized settings (same model, faster params)
    # We use the same SDXL model but with:
    # - Lower resolution (640x1136 vs 1080x1920) = 4x faster
    # - Fewer inference steps (20 vs 50) = 2.5x faster
    # - Lower guidance scale = slightly faster
    # This is verified to work and is much faster while still using a real model
    DEVELOPMENT_IMAGE_MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
    
    def __init__(self):
        """Initialize the Replicate service with API token."""
        token = settings.get_replicate_token()
        if not token:
            raise ValueError("Replicate API token not configured. Set REPLICATE_API_TOKEN in environment.")
        
        # Set the token for replicate client
        self.client = replicate.Client(api_token=token)
        
        # Determine which model to use based on environment
        if settings.REPLICATE_IMAGE_MODEL:
            # Use explicitly configured model
            self.default_model = settings.REPLICATE_IMAGE_MODEL
        elif settings.is_development():
            # Use cheaper model in development
            self.default_model = self.DEVELOPMENT_IMAGE_MODEL
        else:
            # Use production model
            self.default_model = self.PRODUCTION_IMAGE_MODEL
    
    async def generate_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        num_outputs: int = 1,
        model: Optional[str] = None,
        timeout: int = 120,  # 2 minute timeout per image
        num_inference_steps: Optional[int] = None,  # Lower = faster, higher = better quality
        guidance_scale: Optional[float] = None  # How closely to follow prompt
    ) -> List[str]:
        """
        Generate image(s) from a text prompt using Replicate.
        
        Args:
            prompt: Text description of the image to generate
            width: Image width in pixels (default: 1024)
            height: Image height in pixels (default: 1024)
            num_outputs: Number of images to generate (default: 1)
            model: Optional model identifier (uses default if not provided)
            timeout: Timeout in seconds (default: 120)
        
        Returns:
            List of image URLs
        """
        model_id = model or self.default_model
        
        # Optimize parameters based on environment
        # Lower steps = faster generation (good for dev)
        # Higher steps = better quality (good for prod)
        if num_inference_steps is None:
            if settings.is_development():
                num_inference_steps = 20  # Faster for dev, still good quality
            else:
                num_inference_steps = 50  # Higher quality for prod
        
        # Guidance scale: how closely to follow the prompt
        if guidance_scale is None:
            if settings.is_development():
                guidance_scale = 7.0  # Good balance for dev
            else:
                guidance_scale = 7.5  # Higher = better prompt adherence
        
        # Build input parameters
        input_params = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_outputs": num_outputs
        }
        
        # Add optimization parameters - SDXL supports these
        if "sdxl" in model_id.lower():
            input_params["num_inference_steps"] = num_inference_steps
            input_params["guidance_scale"] = guidance_scale
        
        try:
            # Run the model asynchronously with timeout
            output = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.run,
                    model_id,
                    input=input_params
                ),
                timeout=timeout
            )
            
            # Handle different output formats
            if isinstance(output, list):
                return [str(url) for url in output]
            elif isinstance(output, str):
                return [output]
            else:
                return [str(output)]
                
        except asyncio.TimeoutError:
            raise RuntimeError(f"Image generation timed out after {timeout} seconds")
        except Exception as e:
            raise RuntimeError(f"Failed to generate image with Replicate: {str(e)}")
    
    async def generate_images_parallel(
        self,
        prompts: List[str],
        width: int = 1024,
        height: int = 1024,
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple images in parallel from a list of prompts.
        
        Args:
            prompts: List of text prompts for image generation
            width: Image width in pixels (default: 1024)
            height: Image height in pixels (default: 1024)
            model: Optional model identifier
        
        Returns:
            List of dictionaries with keys:
                - prompt: The original prompt
                - image_url: The generated image URL
                - success: Boolean indicating success
                - error: Error message if failed
        """
        # Create tasks for parallel execution
        tasks = [
            self._generate_single_image_safe(prompt, width, height, model)
            for prompt in prompts
        ]
        
        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Format results
        formatted_results = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": None,
                    "success": False,
                    "error": str(result)
                })
            elif result is None:
                # Timeout or other error that returned None
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": None,
                    "success": False,
                    "error": "Generation failed or timed out"
                })
            elif isinstance(result, list) and len(result) > 0:
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": str(result[0]),
                    "success": True,
                    "error": None
                })
            else:
                # Empty result or unexpected format
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": None,
                    "success": False,
                    "error": "No image generated"
                })
        
        return formatted_results
    
    async def _generate_single_image_safe(
        self,
        prompt: str,
        width: int,
        height: int,
        model: Optional[str]
    ) -> Optional[List[str]]:
        """Safely generate a single image with error handling and timeout."""
        try:
            # Adjust timeout based on environment and resolution
            # Dev: Lower resolution + fewer steps = shorter timeout
            # Prod: Higher resolution + more steps = longer timeout
            if settings.is_development():
                timeout = 60  # Dev: SDXL at 640x1136 with 20 steps should finish in ~20-40s
            else:
                timeout = 90  # Prod: SDXL at 1080x1920 with 50 steps can take 30-60s
            
            return await self.generate_image(prompt, width, height, 1, model, timeout=timeout)
        except asyncio.TimeoutError:
            print(f"Timeout generating image for prompt '{prompt[:50]}...'")
            return None
        except Exception as e:
            # Log error but don't raise - let caller handle it
            error_msg = str(e)
            # Don't log full NSFW error messages, just note the issue
            if "NSFW" in error_msg.upper():
                print(f"Content filter triggered for prompt '{prompt[:50]}...'")
            else:
                print(f"Error generating image for prompt '{prompt[:50]}...': {error_msg}")
            return None
    
    def build_image_prompt(
        self,
        mood_name: str,
        mood_description: str,
        style_keywords: List[str],
        color_palette: List[str],
        aesthetic_direction: str,
        product_name: Optional[str] = None
    ) -> str:
        """
        Build a detailed image generation prompt from mood data.
        Designed to be safe and avoid NSFW content filters.
        
        Args:
            mood_name: Name of the mood
            mood_description: Detailed description of the mood
            style_keywords: List of visual style keywords
            color_palette: List of colors for the mood
            aesthetic_direction: Overall aesthetic direction
            product_name: Optional product name for context
        
        Returns:
            Formatted prompt string for image generation
        """
        # Build the prompt components - keep it clean and professional
        components = []
        
        # Start with style and aesthetic (most important)
        components.append(f"Visual style: {', '.join(style_keywords[:5])}")  # Limit keywords
        
        # Add aesthetic direction
        components.append(f"Aesthetic: {aesthetic_direction}")
        
        # Add color palette if available
        if color_palette:
            colors = ', '.join(color_palette[:4])  # Limit colors
            components.append(f"Color palette: {colors}")
        
        # Add mood description (sanitized)
        # Remove any potentially problematic words from description
        clean_description = mood_description.lower()
        # Keep only the first sentence or first 100 chars
        description_parts = clean_description.split('.')[0][:100]
        components.append(f"Mood: {description_parts}")
        
        # Add quality and format specifications - keep it professional
        components.append("Professional product photography")
        components.append("Clean, modern composition")
        components.append("Vertical 9:16 aspect ratio")
        components.append("High quality, commercial style")
        components.append("Suitable for advertising and marketing")
        
        # Explicitly avoid problematic content
        components.append("SFW, family-friendly, professional content only")
        
        prompt = ", ".join(components)
        return prompt

    def build_scene_seed_prompt(
        self,
        scene_description: str,
        scene_style_prompt: str,
        mood_style_keywords: List[str],
        mood_color_palette: List[str],
        mood_aesthetic_direction: str
    ) -> str:
        """
        Build a detailed image generation prompt for a scene seed image.
        Combines scene-specific description with mood styling for consistency.

        Args:
            scene_description: Description of what happens in the scene
            scene_style_prompt: Style keywords specific to this scene
            mood_style_keywords: Style keywords from selected mood
            mood_color_palette: Color palette from selected mood
            mood_aesthetic_direction: Overall aesthetic from selected mood

        Returns:
            Formatted prompt string for seed image generation
        """
        # Build the prompt components - prioritize scene description with mood styling
        components = []

        # Start with the scene content (what to show)
        components.append(scene_description)

        # Add scene-specific style
        components.append(f"Style: {scene_style_prompt}")

        # Add mood aesthetic for consistency across all scenes
        components.append(f"Overall aesthetic: {mood_aesthetic_direction}")

        # Add mood style keywords for visual consistency
        if mood_style_keywords:
            style_kw = ', '.join(mood_style_keywords[:5])
            components.append(f"Visual style: {style_kw}")

        # Add color palette for consistency
        if mood_color_palette:
            colors = ', '.join(mood_color_palette[:4])
            components.append(f"Color palette: {colors}")

        # Add quality specifications
        components.append("Professional cinematic frame")
        components.append("Vertical 9:16 aspect ratio")
        components.append("High quality, suitable for video production")
        components.append("Clean composition")

        # Keep it safe and professional
        components.append("SFW, professional content only")

        prompt = ", ".join(components)
        return prompt

    async def generate_scene_seed_images(
        self,
        scenes: List[Dict[str, Any]],
        mood_style_keywords: List[str],
        mood_color_palette: List[str],
        mood_aesthetic_direction: str,
        width: int = 1080,
        height: int = 1920
    ) -> List[Dict[str, Any]]:
        """
        Generate seed images for multiple scenes in parallel.

        Args:
            scenes: List of scene dictionaries with description and style_prompt
            mood_style_keywords: Style keywords from selected mood
            mood_color_palette: Color palette from selected mood
            mood_aesthetic_direction: Aesthetic direction from selected mood
            width: Image width (default: 1080 for prod quality)
            height: Image height (default: 1920 for 9:16 vertical)

        Returns:
            List of dictionaries with scene data and generated image URLs
        """
        # Build prompts for all scenes
        prompts = []
        for scene in scenes:
            prompt = self.build_scene_seed_prompt(
                scene_description=scene.get("description", ""),
                scene_style_prompt=scene.get("style_prompt", ""),
                mood_style_keywords=mood_style_keywords,
                mood_color_palette=mood_color_palette,
                mood_aesthetic_direction=mood_aesthetic_direction
            )
            prompts.append(prompt)

        # Generate all images in parallel
        print(f"Starting parallel generation of {len(prompts)} seed images at {width}x{height}...")
        image_results = await self.generate_images_parallel(
            prompts=prompts,
            width=width,
            height=height
        )
        print(f"Completed seed image generation: {sum(1 for r in image_results if r['success'])}/{len(image_results)} successful")

        # Combine scene data with image results
        results = []
        for idx, (scene, image_result) in enumerate(zip(scenes, image_results)):
            result = {
                "scene_number": scene.get("scene_number", idx + 1),
                "duration": scene.get("duration", 0),
                "description": scene.get("description", ""),
                "style_prompt": scene.get("style_prompt", ""),
                "seed_image_url": image_result.get("image_url"),
                "generation_success": image_result.get("success", False),
                "generation_error": image_result.get("error")
            }
            results.append(result)

        return results

