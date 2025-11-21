"""OpenAI API handler for Cloud Functions."""
import os
import json
from openai import OpenAI
from typing import List, Dict, Any, Optional


class OpenAIHandler:
    """Handler for OpenAI API calls."""

    def __init__(self):
        """Initialize OpenAI client."""
        self.client = None
    
    def _get_client(self):
        """Lazy initialization of OpenAI client."""
        if self.client is None:
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self.client = OpenAI(api_key=api_key)
        return self.client

    def generate_scene_texts(
        self,
        creative_brief: str,
        mood_data: Dict[str, Any],
        num_scenes: int = 6
    ) -> List[Dict[str, Any]]:
        """
        Generate scene texts using GPT-4.

        Args:
            creative_brief: Formatted creative brief string
            mood_data: Selected mood dictionary
            num_scenes: Number of scenes to generate

        Returns: List of scene data dicts with 'text', 'style_prompt', 'duration'
        """
        mood_style = ", ".join(mood_data.get("style_keywords", []))
        mood_aesthetic = mood_data.get("aesthetic_direction", "")

        prompt = f"""You are an expert video storyboard creator. Generate {num_scenes} scene descriptions for a 30-second video advertisement.

Creative Brief:
{creative_brief}

Selected Mood:
- Name: {mood_data.get('name', 'Unknown')}
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
            response = self._get_client().chat.completions.create(
                model="gpt-4o-mini",
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
            print(f"Error generating scene texts: {e}")
            # Return placeholder scenes on error
            return [
                {
                    "text": f"Scene {i+1}: Placeholder scene description",
                    "style_prompt": mood_style or "cinematic, professional",
                    "duration": 5.0
                }
                for i in range(num_scenes)
            ]

    def generate_scene_composition(
        self,
        scene_title: str,
        scene_description: str,
        brand_name: str,
        product_description: str,
        target_audience: str,
        key_message: str,
        tone: str,
        mood_name: str,
        visual_style: str,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate detailed composition for a scene using GPT-4.

        Args:
            scene_title: Title of the scene
            scene_description: Description of the scene
            brand_name: Brand name from creative brief
            product_description: Product description
            target_audience: Target audience
            key_message: Key message to convey
            tone: Tone of the content
            mood_name: Selected mood name
            visual_style: Visual style description
            custom_prompt: Optional custom prompt to override/augment

        Returns:
            Dictionary with 'description', 'styling', and 'animation' keys
        """
        base_prompt = f"""You are an expert video composition specialist. Create a detailed composition for this scene.

Scene Information:
- Title: {scene_title}
- Description: {scene_description}

Brand Context:
- Brand: {brand_name}
- Product: {product_description}
- Target Audience: {target_audience}
- Key Message: {key_message}
- Tone: {tone}

Visual Style:
- Mood: {mood_name}
- Style: {visual_style}

Create a composition with three components:

1. **Description**: A detailed visual description of the scene (2-3 sentences)
2. **Styling**: Specific visual styling instructions (colors, lighting, composition)
3. **Animation**: Motion and transition details (camera movements, object animations)

{custom_prompt if custom_prompt else ""}

Return ONLY a JSON object with these three keys:
{{
  "description": "detailed visual description",
  "styling": "visual styling instructions",
  "animation": "motion and animation details"
}}
"""

        try:
            response = self._get_client().chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional video composition specialist. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": base_prompt
                    }
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            # Parse response
            content = response.choices[0].message.content
            result = json.loads(content)

            # Validate and return
            return {
                "description": result.get("description", scene_description),
                "styling": result.get("styling", visual_style),
                "animation": result.get("animation", "Smooth transition with subtle motion")
            }

        except Exception as e:
            print(f"Error generating scene composition: {e}")
            # Return fallback composition
            return {
                "description": scene_description,
                "styling": visual_style or "Professional, cinematic",
                "animation": "Smooth transition with subtle motion"
            }

