"""Service layer for storyboard operations."""
from typing import List, Dict, Any, Union
from app.models.storyboard_models import (
    Storyboard,
    StoryboardScene,
    SceneGenerationStatus,
    StoryboardInitializeRequest,
)
from app.database import db
from app.config import settings
from openai import OpenAI
import json
import uuid


class StoryboardService:
    """Service for storyboard and scene management."""

    def __init__(self):
        """Initialize the service."""
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

    def _format_creative_brief(self, creative_brief: Dict[str, Any]) -> str:
        """Convert creative brief object to formatted string for prompts."""
        if isinstance(creative_brief, str):
            return creative_brief
        
        return f"""Product: {creative_brief.get('product_name', 'Unknown')}
Target Audience: {creative_brief.get('target_audience', 'General')}
Emotional Tone: {', '.join(creative_brief.get('emotional_tone', [])) if isinstance(creative_brief.get('emotional_tone'), list) else creative_brief.get('emotional_tone', 'N/A')}
Visual Style Keywords: {', '.join(creative_brief.get('visual_style_keywords', [])) if isinstance(creative_brief.get('visual_style_keywords'), list) else creative_brief.get('visual_style_keywords', 'N/A')}
Key Messages: {', '.join(creative_brief.get('key_messages', [])) if isinstance(creative_brief.get('key_messages'), list) else creative_brief.get('key_messages', 'N/A')}"""

    async def generate_scene_texts(
        self,
        creative_brief: Union[Dict[str, Any], str],
        selected_mood: Dict[str, Any],
        num_scenes: int = 6
    ) -> List[Dict[str, str]]:
        """
        Generate scene texts using OpenAI based on creative brief and mood.

        Args:
            creative_brief: Creative brief data (dict or string)
            selected_mood: Selected mood data (dict)
            num_scenes: Number of scenes to generate

        Returns list of dicts with 'text' and 'style_prompt' keys.
        """
        if not self.client:
            # Fallback for development without API key
            return self._generate_placeholder_scenes(num_scenes)

        # Convert creative brief to string format
        creative_brief_str = self._format_creative_brief(creative_brief)

        # Build prompt for scene generation
        mood_style = ", ".join(selected_mood.get("style_keywords", []))
        mood_aesthetic = selected_mood.get("aesthetic_direction", "")

        prompt = f"""You are an expert video storyboard creator. Generate {num_scenes} scene descriptions for a 30-second video advertisement.

Creative Brief:
{creative_brief_str}

Selected Mood:
- Name: {selected_mood.get('name', 'Unknown')}
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
            print(f"Error generating scene texts: {e}")
            # Fallback to placeholder scenes
            return self._generate_placeholder_scenes(num_scenes)

    def _generate_placeholder_scenes(self, num_scenes: int) -> List[Dict[str, str]]:
        """Generate placeholder scenes for development."""
        scenes = []
        for i in range(num_scenes):
            scenes.append({
                "text": f"Scene {i+1}: Placeholder scene description for testing",
                "style_prompt": "cinematic, professional, high quality",
                "duration": 5.0
            })
        return scenes

    async def initialize_storyboard(
        self,
        request: StoryboardInitializeRequest
    ) -> tuple[Storyboard, List[StoryboardScene]]:
        """
        Initialize a new storyboard with generated scene texts.

        Returns (storyboard, scenes) tuple.
        """
        # Convert creative brief Pydantic model to dict for processing
        try:
            creative_brief_dict = request.creative_brief.model_dump()
        except AttributeError:
            # Fallback: if it's already a dict, use it directly
            creative_brief_dict = request.creative_brief if isinstance(request.creative_brief, dict) else dict(request.creative_brief)
        except Exception as e:
            print(f"Error converting creative brief to dict: {e}")
            print(f"Type of creative_brief: {type(request.creative_brief)}")
            raise
        
        # Generate scene texts using AI
        scene_texts = await self.generate_scene_texts(
            creative_brief=creative_brief_dict,
            selected_mood=request.selected_mood,
            num_scenes=6
        )

        # Serialize creative brief to string for storage
        creative_brief_str = self._format_creative_brief(creative_brief_dict)

        # Generate storyboard ID first (needed for scenes)
        storyboard_id = str(uuid.uuid4())

        # Create scenes first (they need the storyboard_id)
        scenes = []
        for scene_data in scene_texts:
            scene = StoryboardScene(
                storyboard_id=storyboard_id,
                state="text",
                text=scene_data["text"],
                style_prompt=scene_data["style_prompt"],
                video_duration=scene_data["duration"],
                generation_status=SceneGenerationStatus(
                    image="pending",
                    video="pending"
                )
            )
            scenes.append(scene)

        # Create storyboard with scene_order already populated
        # (Pydantic validation requires scene_order to have at least 5 items)
        storyboard = Storyboard(
            storyboard_id=storyboard_id,
            creative_brief=creative_brief_str,
            selected_mood=request.selected_mood,
            scene_order=[scene.id for scene in scenes],
            total_duration=sum(s["duration"] for s in scene_texts)
        )

        # Save to database
        db.create_storyboard(storyboard)
        for scene in scenes:
            db.create_scene(scene)

        return storyboard, scenes

    async def get_storyboard_with_scenes(
        self,
        storyboard_id: str
    ) -> tuple[Storyboard, List[StoryboardScene]]:
        """Get storyboard with all its scenes in order."""
        storyboard = db.get_storyboard(storyboard_id)
        if not storyboard:
            raise ValueError(f"Storyboard {storyboard_id} not found")

        # Get all scenes
        all_scenes = db.get_scenes_by_storyboard(storyboard_id)

        # Order scenes according to scene_order
        scenes_by_id = {scene.id: scene for scene in all_scenes}
        scenes = [scenes_by_id[scene_id] for scene_id in storyboard.scene_order if scene_id in scenes_by_id]

        return storyboard, scenes

    async def update_scene_text(
        self,
        scene_id: str,
        new_text: str
    ) -> StoryboardScene:
        """Update scene text manually."""
        scene = db.get_scene(scene_id)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found")

        # Update text and reset to text state
        scene.text = new_text
        scene.state = "text"
        scene.image_url = None
        scene.video_url = None
        scene.generation_status.image = "pending"
        scene.generation_status.video = "pending"
        scene.error_message = None

        # Save
        updated_scene = db.update_scene(scene_id, scene)
        return updated_scene

    async def regenerate_scene_text(
        self,
        scene_id: str,
        creative_brief: Dict[str, Any]
    ) -> StoryboardScene:
        """Regenerate scene text using AI."""
        scene = db.get_scene(scene_id)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found")

        # Get storyboard for context
        storyboard = db.get_storyboard(scene.storyboard_id)
        if not storyboard:
            raise ValueError(f"Storyboard {scene.storyboard_id} not found")

        # Convert creative brief to dict (handles both Pydantic model and dict)
        if isinstance(creative_brief, dict):
            creative_brief_dict = creative_brief
        else:
            # It's a Pydantic model, convert to dict
            creative_brief_dict = creative_brief.model_dump()

        # Generate new scene text
        new_scenes = await self.generate_scene_texts(
            creative_brief=creative_brief_dict,
            selected_mood=storyboard.selected_mood,
            num_scenes=1
        )

        if new_scenes:
            scene.text = new_scenes[0]["text"]
            scene.style_prompt = new_scenes[0]["style_prompt"]
            scene.state = "text"
            scene.image_url = None
            scene.video_url = None
            scene.generation_status.image = "pending"
            scene.generation_status.video = "pending"
            scene.error_message = None

        # Save
        updated_scene = db.update_scene(scene_id, scene)
        return updated_scene

    async def update_scene_duration(
        self,
        scene_id: str,
        new_duration: float
    ) -> StoryboardScene:
        """Update scene video duration."""
        scene = db.get_scene(scene_id)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found")

        # Update duration and potentially reset video
        scene.video_duration = new_duration

        if scene.state == "video":
            # Reset to image state if video was already generated
            scene.state = "image"
            scene.video_url = None
            scene.generation_status.video = "pending"

        # Save
        updated_scene = db.update_scene(scene_id, scene)
        return updated_scene


# Global service instance
storyboard_service = StoryboardService()
