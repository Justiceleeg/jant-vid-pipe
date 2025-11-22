# Current Architecture Map

## The Real Flow (Not What We Planned)

```
User Journey:
1. Projects Page → Creates project in backend
2. Chat Page → Creative brief (stored in appStore)  
3. Mood Page → Select mood (stored in appStore + images to Firebase)
4. Backgrounds Page → Select backgrounds (stored in appStore only!)
5. Scenes Page → Edit scenes (uses projectScenes hook → backend)
6. Final Page → Compose final video

Data Storage:
- Project doc in Firestore (partial data)
- appStore in memory (full working state)
- Assets in Firebase Storage (some linked, some orphaned)
```

## The Three-Store Problem

### 1. appStore (frontend/store/appStore.ts)
**Purpose**: Current working state for the pipeline  
**Contains**: 
- Creative brief
- Selected mood  
- Background assets & selections
- Character assets (planned)
- Brand assets (planned)
- Scenes data
- Current step

**Problem**: This is the actual source of truth during editing, but it's not fully persisted

### 2. projectStore (frontend/store/projectStore.ts)
**Purpose**: Bridge between appStore and backend  
**Does**:
- Takes snapshots of appStore
- Syncs to backend via API calls
- Auto-saves on appStore changes

**Problem**: Only saves what the backend project model supports (missing backgrounds, characters, brands)

### 3. firestoreProjectStore (frontend/store/firestoreProjectStore.ts)
**Purpose**: Direct Firestore real-time sync (unused alternative)  
**Status**: Created but not actively used  
**Problem**: Competing implementation that adds confusion

## Asset Management Confusion

### Global Assets (Not Project-Specific)
- `/brand-assets` - Upload brand logos/materials
- `/character-assets` - Upload character images
- `/backgrounds` - Background images

**Problem**: These are user-level assets, not tied to projects. No clear association model.

### Project Assets
- Mood images → `projects/{projectId}/moods/` ✅
- Scene images → Where?
- Videos → Where?
- Audio → Temporary URLs only ❌
- Compositions → Where?

## What the Backend Project Model Actually Has

```python
class Project:
    # Basic info
    id, name, description, user_id
    created_at, updated_at
    
    # Embedded storyboard
    storyboard:
        id, title
        creative_brief  # ✅ Synced from appStore
        selected_mood   # ✅ Synced from appStore
    
    # Scenes array
    scenes: [
        id, scene_number, title, description
        duration_seconds
        assets:  # Paths to Firebase Storage
            composition_path
            video_path
            audio_path
            thumbnail_path
        active_job: {...}  # Current generation status
        composition: {...}  # AI-generated composition
    ]
    
    # Stats
    stats:
        total_scenes
        completed_scenes
        last_activity
```

## What's Missing from Backend

1. **Backgrounds**
   - Selected background IDs
   - Background metadata
   - Association with project

2. **Characters** (if implemented)
   - Character selections
   - Character positioning

3. **Brand Assets** (if implemented)
   - Brand logo placement
   - Brand color overrides

4. **User Assets Management**
   - No model for user-uploaded assets
   - No way to track asset usage across projects
   - No cleanup/orphan detection

## The Bridge Points (Where Frontend ↔ Backend Connect)

### Working Connections ✅
1. **Project Creation**: `/api/projects` creates project doc
2. **Mood Images**: Saved to Firebase via backend
3. **Scene Updates**: `useProjectScenes` → `/api/projects/{id}/scenes`
4. **Real-time Updates**: Firestore subscriptions for project changes

### Broken/Missing Connections ❌
1. **Backgrounds**: Selected in frontend, never saved to backend
2. **Scene Images**: Generation happens but storage location unclear
3. **Videos**: May use temp URLs or Firebase (inconsistent)
4. **Audio**: Still temporary Replicate URLs
5. **Storyboard Init**: Creates separate doc, not integrated with project

## Current Data Flow

```
Frontend Action              →  Store Update           →  Backend Update
─────────────────────────────────────────────────────────────────────
Create Project              →  projectStore           →  POST /api/projects ✅
Update Creative Brief       →  appStore              →  Auto-save via projectStore ✅  
Select Mood                 →  appStore              →  Auto-save + Firebase images ✅
Select Backgrounds          →  appStore              →  NOT SAVED ❌
Edit Scene Text            →  useProjectScenes      →  PATCH /api/projects/{id}/scenes ✅
Generate Video             →  useProjectScenes      →  POST ../generate-video (broken?)
Upload Brand Asset         →  (separate system)     →  POST /api/brand-assets
Upload Character           →  (separate system)     →  POST /api/character-assets
```

## The Real Problem

The architecture grew organically with different developers adding features:
1. Original: localStorage + simple scenes
2. Tom adds: Firestore projects + real-time sync
3. Someone adds: Backgrounds step
4. Someone adds: Brand/character assets
5. Someone adds: More UI pages

Result: Partial integration where some data flows through the new system and some doesn't.

## Next Steps

See `02-salvage-strategy.md` for how to fix this incrementally.
