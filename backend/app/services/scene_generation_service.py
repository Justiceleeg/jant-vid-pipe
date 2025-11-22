"""
Scene Generation Service using OpenAI

This service handles AI-powered scene generation for projects.
Extracted from the deprecated storyboard_service.py
"""
import json
import uuid
from typing import List, Dict, Any, Union, Optional
from app.config import settings
from app.models.project_models import Scene
from openai import OpenAI


class SceneGenerationService:
    """Service for AI-powered scene generation."""

    def __init__(self):
        """Initialize the service with OpenAI client."""
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

    def _format_creative_brief(self, creative_brief: Dict[str, Any]) -> str:
        """Convert creative brief object to formatted string for prompts."""
        if isinstance(creative_brief, str):
            return creative_brief
        
        if not creative_brief:
            return "No creative brief provided"
        
        return f"""Product: {creative_brief.get('product_name', 'Unknown')}
Target Audience: {creative_brief.get('target_audience', 'General')}
Emotional Tone: {', '.join(creative_brief.get('emotional_tone', [])) if isinstance(creative_brief.get('emotional_tone'), list) else creative_brief.get('emotional_tone', 'N/A')}
Visual Style Keywords: {', '.join(creative_brief.get('visual_style_keywords', [])) if isinstance(creative_brief.get('visual_style_keywords'), list) else creative_brief.get('visual_style_keywords', 'N/A')}
Key Messages: {', '.join(creative_brief.get('key_messages', [])) if isinstance(creative_brief.get('key_messages'), list) else creative_brief.get('key_messages', 'N/A')}"""

    async def generate_scenes(
        self,
        creative_brief: Optional[Dict[str, Any]] = None,
        selected_mood: Optional[Dict[str, Any]] = None,
        num_scenes: int = 6
    ) -> List[Scene]:
        """
        Generate scenes using OpenAI based on creative brief and mood.

        Args:
            creative_brief: Creative brief data (optional)
            selected_mood: Selected mood data (optional)
            num_scenes: Number of scenes to generate (default: 6)

        Returns:
            List of Scene objects
        """
        # Generate scene descriptions using OpenAI or fallback
        scene_descriptions = await self._generate_scene_texts(
            creative_brief,
            selected_mood,
            num_scenes
        )
        
        # Convert to Scene objects
        scenes = []
        for i, desc in enumerate(scene_descriptions):
            scene = Scene(
                id=str(uuid.uuid4()),
                scene_number=i + 1,
                title=f"Scene {i + 1}",
                description=desc.get("text", f"Scene {i + 1} description"),
                duration_seconds=float(desc.get("duration", 5.0)),
                # Store style prompt for future image generation
                composition={
                    "style_prompt": desc.get("style_prompt", ""),
                    "generated_by": "openai" if self.client else "placeholder"
                }
            )
            scenes.append(scene)
        
        return scenes

    async def _generate_scene_texts(
        self,
        creative_brief: Optional[Dict[str, Any]],
        selected_mood: Optional[Dict[str, Any]],
        num_scenes: int
    ) -> List[Dict[str, Any]]:
        """
        Generate scene text descriptions using OpenAI.

        Returns list of dicts with 'text', 'style_prompt', and 'duration' keys.
        """
        if not self.client:
            # Fallback for development without API key
            return self._generate_placeholder_scenes(num_scenes)

        # Format inputs
        creative_brief_str = self._format_creative_brief(creative_brief) if creative_brief else "No creative brief provided"
        
        # Extract mood information
        mood_name = selected_mood.get('name', 'Unknown') if selected_mood else 'No mood selected'
        mood_style = ", ".join(selected_mood.get("style_keywords", [])) if selected_mood else "modern, professional"
        mood_aesthetic = selected_mood.get("aesthetic_direction", "") if selected_mood else "clean and polished"

        prompt = f"""You are an expert video storyboard creator. Generate {num_scenes} scene descriptions for a 30-second video advertisement.

Creative Brief:
{creative_brief_str}

Selected Mood:
- Name: {mood_name}
- Style: {mood_style}
- Aesthetic: {mood_aesthetic}

Requirements:
1. Each scene should be 4-6 seconds long
2. Scenes should flow naturally from one to the next
3. Match the mood and aesthetic direction
4. Include dynamic action and visual interest
5. Be specific about what's shown on screen

Return ONLY a JSON object with a "scenes" array containing exactly {num_scenes} scene objects. Each object must have:
- "text": A concise scene description (1-2 sentences, what happens)
- "style_prompt": Visual style keywords for AI image generation (comma-separated)
- "duration": Duration in seconds (4-6)

Example format:
{{
  "scenes": [
    {{
      "text": "A runner bursts through a neon-lit doorway into a futuristic cityscape",
      "style_prompt": "cyberpunk, neon lights, dynamic movement, urban, high contrast",
      "duration": 5
    }},
    ...
  ]
}}
"""

        try:
            response = self.client.chat.completions.create(
                model=settings.OPENAI_MODEL or "gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional video storyboard creator. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.8,
                response_format={"type": "json_object"}
            )

            # Parse response
            content = response.choices[0].message.content
            result = json.loads(content)

            # Handle both direct array and wrapped array formats
            scenes_data = result if isinstance(result, list) else result.get("scenes", [])

            # Validate and normalize
            scenes = []
            for i, scene in enumerate(scenes_data[:num_scenes]):
                scenes.append({
                    "text": scene.get("text", f"Scene {i+1}"),
                    "style_prompt": scene.get("style_prompt", mood_style),
                    "duration": float(scene.get("duration", 5.0))
                })

            # Ensure we have exactly num_scenes
            while len(scenes) < num_scenes:
                scenes.append({
                    "text": f"Scene {len(scenes) + 1} description",
                    "style_prompt": mood_style,
                    "duration": 5.0
                })

            return scenes[:num_scenes]

        except Exception as e:
            print(f"Error generating scene texts with OpenAI: {e}")
            # Fallback to placeholder scenes
            return self._generate_placeholder_scenes(num_scenes)

    def _generate_placeholder_scenes(self, num_scenes: int) -> List[Dict[str, Any]]:
        """Generate placeholder scenes for development."""
        scenes = []
        for i in range(num_scenes):
            scenes.append({
                "text": f"Scene {i+1}: Dynamic product showcase with engaging visuals",
                "style_prompt": "cinematic, professional, high quality, modern",
                "duration": 5.0
            })
        return scenes

    async def regenerate_scene_text(
        self,
        scene_number: int,
        creative_brief: Optional[Dict[str, Any]] = None,
        selected_mood: Optional[Dict[str, Any]] = None,
        previous_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Regenerate text for a specific scene.

        Args:
            scene_number: The scene number (1-based)
            creative_brief: Creative brief data (optional)
            selected_mood: Selected mood data (optional)
            previous_text: Previous scene text for context (optional)

        Returns:
            Dict with 'text' and 'style_prompt' keys
        """
        if not self.client:
            return {
                "text": f"Scene {scene_number}: Regenerated placeholder scene description",
                "style_prompt": "cinematic, professional, high quality"
            }
        
        creative_brief_str = self._format_creative_brief(creative_brief) if creative_brief else "No creative brief provided"
        mood_style = ", ".join(selected_mood.get("style_keywords", [])) if selected_mood else "modern, professional"
        
        prompt = f"""Generate a new description for Scene {scene_number} of a video advertisement.

Creative Brief:
{creative_brief_str}

Mood Style: {mood_style}

{f"Previous text to replace: {previous_text}" if previous_text else ""}

Generate a fresh, creative scene description that:
1. Is 4-6 seconds long
2. Has dynamic visual action
3. Matches the mood and style

Return a JSON object with:
- "text": Scene description
- "style_prompt": Visual style keywords
"""

        try:
            response = self.client.chat.completions.create(
                model=settings.OPENAI_MODEL or "gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a creative video storyboard writer. Respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.9,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return {
                "text": result.get("text", f"Scene {scene_number} description"),
                "style_prompt": result.get("style_prompt", mood_style)
            }
            
        except Exception as e:
            print(f"Error regenerating scene text: {e}")
            return {
                "text": f"Scene {scene_number}: New creative scene description",
                "style_prompt": "cinematic, dynamic, engaging"
            }


# Singleton instance
_scene_generation_service = None

def get_scene_generation_service() -> SceneGenerationService:
    """Get or create the scene generation service singleton."""
    global _scene_generation_service
    if _scene_generation_service is None:
        _scene_generation_service = SceneGenerationService()
    return _scene_generation_service
