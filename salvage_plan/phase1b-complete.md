# Phase 1B Complete: Regenerate Endpoints Added ✅

## What We Did

### Backend Changes (backend/app/routers/projects.py)

1. **Added `/regenerate-text` endpoint**:
   - Gets creative brief and mood from project
   - Calls storyboard_service.generate_scene_texts() for now
   - Updates scene with new text
   - Returns updated scene

2. **Added `/regenerate-image` endpoint**:
   - Verifies project and scene exist
   - Creates job tracking  
   - Returns job ID for progress tracking
   - TODO: Hook up to actual image generation pipeline

### Frontend Changes

1. **Updated projectsApi** (frontend/lib/api/projects.ts):
   - Added `regenerateText()` method
   - Added `regenerateImage()` method

2. **Updated useProjectScenes hook**:
   - `regenerateText()` now calls backend endpoint
   - `regenerateImage()` now calls backend endpoint
   - Real-time subscriptions handle UI updates

## Current Implementation Status

### Text Regeneration
- ✅ Endpoint exists and works
- ⚠️ Still uses storyboard_service (should be moved later)
- ✅ Falls back to placeholder if OpenAI not configured
- ✅ Updates Firestore document

### Image Regeneration  
- ✅ Endpoint exists
- ⚠️ Not connected to actual image generation pipeline
- ✅ Creates job tracking
- ⚠️ Needs cloud function integration

## Testing the Endpoints

### Test Text Regeneration:
```bash
curl -X POST http://localhost:8000/api/projects/{projectId}/scenes/{sceneId}/regenerate-text \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

### Test Image Regeneration:
```bash
curl -X POST http://localhost:8000/api/projects/{projectId}/scenes/{sceneId}/regenerate-image \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

## Known Issues

1. **OpenAI Logic Still in Storyboard Service**
   - Working but not clean architecture
   - Should be moved to project service (Phase 3)

2. **Image Generation Not Fully Connected**
   - Endpoint creates job but doesn't trigger generation
   - Needs cloud function or Replicate integration

3. **No Style Prompt Storage**
   - Scene model doesn't have `style_prompt` field
   - Needed for proper image generation

## Quick Wins Before Demo

If short on time, these would help:

1. **Ensure OpenAI API key is configured**:
   ```bash
   # In backend/.env
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```

2. **Add style_prompt to Scene model**:
   ```python
   class Scene(BaseModel):
       # ... existing fields ...
       style_prompt: Optional[str] = None
   ```

3. **Connect image generation to existing pipeline**:
   - Reuse code from storyboards router
   - Or trigger existing cloud functions

## Next: Phase 1C - State Persistence

Now we need to implement Option 3 - storing the entire appStore as JSON.
This will ensure backgrounds, characters, and any other UI state persists.
