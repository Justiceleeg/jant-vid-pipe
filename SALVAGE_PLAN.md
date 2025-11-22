# Quick Fix & Deploy Plan (Demo Version)

## Why Fix Instead of Scrap
- **80% Complete**: Core architecture works (Firestore, real-time, auth)
- **Frontend Already Migrated**: Uses `useProjectScenes` not `useStoryboard`
- **It's a Demo**: No migration needed, can delete data anytime
- **Latest Merged**: You have all teammates' changes

## 1-Hour Fix List

### 1. Deploy Firebase (10 min)
```bash
# Deploy rules and indexes
firebase deploy --only firestore:rules,firestore:indexes

# Deploy cloud functions
cd functions && firebase deploy --only functions
```

### 2. Add Missing Endpoints (20 min)
In `backend/app/routers/projects.py`, add after line 530:
```python
@router.post("/{project_id}/scenes/{scene_id}/regenerate-text")
async def regenerate_scene_text(
    project_id: str,
    scene_id: str,
    http_request: Request
):
    """Regenerate scene text using AI"""
    user_id = await get_current_user_id(http_request)
    firestore_service = get_firestore_service()
    
    # Get scene data
    project = await firestore_service.get_project(project_id, user_id)
    scene = next((s for s in project.scenes if s.id == scene_id), None)
    
    # Call existing storyboard service (reuse existing logic)
    from app.services.storyboard_service import StoryboardService
    new_text = await StoryboardService.regenerate_scene_text(
        scene.description, 
        project.storyboard.creative_brief
    )
    
    # Update scene
    await firestore_service.update_scene(project_id, scene_id, {
        "description": new_text,
        "updated_at": datetime.now()
    })
    
    return {"success": True, "description": new_text}

@router.post("/{project_id}/scenes/{scene_id}/regenerate-image")
async def regenerate_scene_image(
    project_id: str,
    scene_id: str,
    http_request: Request
):
    """Regenerate scene image"""
    # Reuse existing image generation logic
    from app.routers.storyboards import generate_images_for_scene
    return await generate_images_for_scene(project_id, scene_id, http_request)
```

### 3. Fix Audio Storage (15 min)
In `backend/app/routers/audio.py`:
```python
# After line where audio_url is generated from Replicate
from app.services.firebase_storage_service import get_storage_service

storage_service = get_storage_service()
firebase_url = await storage_service.upload_from_url(
    url=audio_url,
    path=f"projects/{project_id}/audio/{scene_id}_{uuid.uuid4()}.mp3",
    content_type="audio/mp3"
)
# Use firebase_url instead of audio_url
```

### 4. Wire Frontend TODOs (10 min)
In `frontend/hooks/useProjectScenes.ts`:
```typescript
// Line 141 - replace console.log with:
await projectsApi.regenerateText(projectId, sceneId);

// Line 187 - replace console.log with:
await projectsApi.regenerateImage(projectId, sceneId);
```

Add to `frontend/lib/api/projects.ts`:
```typescript
async regenerateText(projectId: string, sceneId: string) {
  return this.request(`/projects/${projectId}/scenes/${sceneId}/regenerate-text`, {
    method: 'POST'
  });
}

async regenerateImage(projectId: string, sceneId: string) {
  return this.request(`/projects/${projectId}/scenes/${sceneId}/regenerate-image`, {
    method: 'POST'
  });
}
```

### 5. Quick Test (5 min)
```bash
# Start backend
cd backend && uvicorn app.main:app --reload

# Start frontend (new terminal)
cd frontend && npm run dev

# Test flow:
# 1. Create project
# 2. Generate mood
# 3. Initialize scenes
# 4. Generate video
# 5. Check Firebase Storage for assets
```

## What to Tell Your Team

"Backend is ready. It's using Firestore for real-time updates and Firebase Storage for all assets. Since it's a demo, I'm just going to deploy and test. Should take 1 hour."

## If Something Breaks

### Quick Rollback:
```bash
git checkout main
```

### Or Fix Forward:
Most issues will be:
1. **Missing env vars**: Check `.env` has all Firebase/Clerk keys
2. **CORS errors**: Add frontend URL to backend CORS settings
3. **Auth failures**: Verify Clerk tokens match between frontend/backend
4. **Import errors**: Some services might need to be imported differently

## Success Criteria
✅ Projects save to Firestore  
✅ Moods save images to Firebase Storage  
✅ Scenes can be edited and regenerated  
✅ Videos generate and save to Firebase Storage  
✅ Real-time updates work (no refresh needed)

## Don't Worry About (For Now)
- Removing legacy code (works fine in parallel)
- Performance optimization
- Error handling improvements
- UI polish
- Old data migration (it's a demo!)

**Total Time: ~1 hour to functioning demo**
