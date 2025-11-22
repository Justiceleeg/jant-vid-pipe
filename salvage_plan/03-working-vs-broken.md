# What's Working vs What's Broken

## ✅ WORKING

### Project Management
- Creating projects via `/projects` page
- Project saved to Firestore with ID
- Basic project metadata persisted
- User authentication with Clerk

### Creative Brief
- Input via chat interface
- Saved to project document
- Synced via projectStore → backend

### Mood Generation
- AI generates mood options
- Images saved to Firebase Storage
- Paths: `projects/{projectId}/moods/{moodId}/{imageId}.png`
- Selection saved to project

### Scene Management (Partial)
- Scene text editing works
- Updates sync to Firestore
- Real-time updates via subscriptions
- `useProjectScenes` hook functioning

## 🟡 PARTIALLY WORKING

### Background Selection
- UI works for selecting backgrounds
- Stored in appStore during session
- **NOT persisted to backend**
- Lost on page refresh

### Video Generation
- Endpoint exists: `/api/projects/{id}/scenes/{sid}/generate-video`
- Has uninitialized service bug (now fixed)
- Cloud functions may not be deployed
- Storage location inconsistent

### Asset Uploads
- Brand assets upload works
- Character assets upload works
- But no association with projects
- No way to query "assets for this project"

## ❌ BROKEN

### Scene Initialization (CRITICAL!)
- **NO scenes are created when user reaches scenes page**
- `projectsApi.initializeScenes()` exists but is NEVER CALLED
- `sceneStore.initializeStoryboard()` exists but is NEVER CALLED  
- Users see empty scenes page with no way to proceed

### Scene Image Generation
- Frontend expects it but endpoints return "not implemented"
- `regenerateImage` in useProjectScenes is a stub

### Scene Text Regeneration
- Frontend expects it but endpoints return "not implemented"
- `regenerateText` in useProjectScenes is a stub

### Audio Storage
- Still returns temporary Replicate URLs
- Not saved to Firebase Storage
- Lost after ~24 hours

### Storyboard Integration
- Creates separate storyboard document
- Not properly linked to project scenes
- Dual system confusion

### Asset Association
- No link between uploaded assets and projects
- Can't track which assets used where
- No cleanup mechanism

## 🔧 QUICK FIXES NEEDED

### 1. Save Backgrounds to Project (15 min)
```python
# Add to project model
background_ids: List[str] = []

# Save from frontend
projectStore.updateProject({ backgroundIds: selectedBackgroundIds })
```

### 2. Implement Regenerate Endpoints (30 min)
```python
@router.post("/{project_id}/scenes/{scene_id}/regenerate-text")
@router.post("/{project_id}/scenes/{scene_id}/regenerate-image")
```

### 3. Fix Audio Storage (15 min)
```python
# In audio generation
firebase_url = storage_service.upload_from_url(replicate_url)
return firebase_url  # not replicate_url
```

## 📊 Data Flow Status

| Feature | Frontend → Store | Store → Backend | Backend → Firestore | Firebase Storage |
|---------|-----------------|-----------------|-------------------|------------------|
| Project Creation | ✅ | ✅ | ✅ | N/A |
| Creative Brief | ✅ | ✅ | ✅ | N/A |
| Mood Selection | ✅ | ✅ | ✅ | ✅ |
| Mood Images | ✅ | ✅ | N/A | ✅ |
| Background Selection | ✅ | ❌ | ❌ | ❓ |
| Scene Text | ✅ | ✅ | ✅ | N/A |
| Scene Images | ❓ | ❓ | ❓ | ❓ |
| Scene Videos | ❓ | ❓ | ❓ | ❓ |
| Audio | ❓ | ❓ | ❓ | ❌ |
| Brand Assets | ✅ | ❌ | ❌ | ✅ |
| Character Assets | ✅ | ❌ | ❌ | ✅ |

## 🚀 Minimum Viable Fix

To get everything working for demo:

1. **Store full appState in project** (30 min)
   ```python
   class Project:
       app_state: Optional[Dict] = None  # Just store everything
   ```

2. **Deploy cloud functions** (10 min)
   ```bash
   firebase deploy --only functions
   ```

3. **Add missing endpoints** (20 min)
   - Regenerate text
   - Regenerate image

4. **Test full flow** (10 min)

Total: ~1 hour to functional demo

## 🎯 Success Criteria

A complete flow should:
1. ✅ Create project
2. ✅ Input creative brief
3. ✅ Select mood (images persist)
4. 🔧 Select backgrounds (needs persistence)
5. 🔧 Edit/generate scenes (needs endpoints)
6. 🔧 Generate videos (needs cloud functions)
7. ❌ Generate audio (needs storage fix)
8. ✅ Real-time sync across tabs

Current Score: 4/8 working fully
