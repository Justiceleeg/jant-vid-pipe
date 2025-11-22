# Salvage Strategy: Pragmatic Path Forward

## Core Insight
Your backend architecture is actually fine. The problem is incomplete integration - some features bypass it entirely. Instead of rebuilding, we need to extend the project model to capture ALL the data the frontend is using.

## Option 1: Quick Extension (2-3 hours)

### A. Extend Project Model
Add to `backend/app/models/project_models.py`:

```python
class BackgroundSelection(BaseModel):
    """Background assets selected for the project"""
    asset_ids: List[str] = []
    primary_background_id: Optional[str] = None

class BrandAssets(BaseModel):
    """Brand assets used in the project"""
    logo_id: Optional[str] = None
    color_overrides: Dict[str, str] = {}

class CharacterAssets(BaseModel):
    """Character assets used in the project"""
    character_ids: List[str] = []
    positions: Dict[str, dict] = {}  # character_id -> position data

class Project(BaseModel):
    # ... existing fields ...
    
    # NEW: Asset selections
    background_selection: Optional[BackgroundSelection] = None
    brand_assets: Optional[BrandAssets] = None  
    character_assets: Optional[CharacterAssets] = None
    
    # NEW: Pipeline metadata
    current_step: str = "chat"
    step_status: Dict[str, str] = {}  # step -> "completed" | "in_progress" | "pending"
```

### B. Update Frontend Sync
In `frontend/store/projectStore.ts`, modify `createProjectSnapshot`:

```typescript
const snapshot = {
  // ... existing fields ...
  
  // Add new fields
  backgroundSelection: {
    assetIds: appState.selectedBackgroundIds || [],
    primaryBackgroundId: appState.selectedBackgroundIds?.[0] || null,
  },
  currentStep: appState.currentStep,
  // ... etc
};
```

### C. Create Asset Association
Backend endpoint to track asset usage:

```python
@router.post("/{project_id}/assets/associate")
async def associate_assets(
    project_id: str,
    request: AssociateAssetsRequest,
    http_request: Request
):
    """Associate uploaded assets with a project"""
    # Update project doc with asset IDs
    # This creates the link between user assets and projects
```

## Option 2: Unified Asset System (Better, 4-5 hours)

### A. Create Asset Registry
New Firestore collections:

```
users/{userId}/assets
├── {assetId}
    ├── type: "background" | "character" | "brand"
    ├── url: Firebase Storage URL
    ├── metadata: {}
    ├── uploaded_at: timestamp
    ├── used_in_projects: [projectId1, projectId2]
```

### B. Extend Project to Reference Assets
```python
class Project:
    # Store asset references, not copies
    asset_references: {
        "backgrounds": ["assetId1", "assetId2"],
        "characters": ["assetId3"],
        "brand": ["assetId4"]
    }
```

### C. Asset Management Service
```python
class AssetManagementService:
    async def upload_asset(user_id, asset_type, file):
        # Save to Firebase Storage
        # Create asset registry entry
        # Return asset ID
    
    async def associate_with_project(asset_id, project_id):
        # Add project to asset's used_in_projects
        # Add asset to project's asset_references
    
    async def get_user_assets(user_id, asset_type=None):
        # Fetch all assets for user
    
    async def cleanup_orphaned_assets(user_id):
        # Find assets not used in any projects
```

## Option 3: Minimal Fix (1 hour)

Just make it work for the demo:

### A. Add Missing Fields
```python
# In project_models.py, just add:
class Project(BaseModel):
    # ... existing ...
    app_state_snapshot: Optional[Dict[str, Any]] = None  # Store EVERYTHING
```

### B. Save Full State
```typescript
// In projectStore.ts
const snapshot = {
  id: project.id,
  appStateSnapshot: JSON.stringify(appState),  // Just dump it all
  // ... other fields
};
```

### C. Restore Full State
```typescript
// On project load
if (project.appStateSnapshot) {
  const savedState = JSON.parse(project.appStateSnapshot);
  Object.keys(savedState).forEach(key => {
    appStore[`set${capitalize(key)}`](savedState[key]);
  });
}
```

## Recommended Approach

**For Demo: Option 3** (1 hour)
- Just serialize entire appStore to project doc
- Fixes all synchronization issues immediately
- Can refactor later

**For Production: Option 2** (4-5 hours)
- Proper asset management system
- Tracks usage and ownership
- Enables sharing/collaboration later

## Implementation Priority

1. **Fix Immediate Break** (30 min)
   - Add `app_state_snapshot` field
   - Save/restore full app state
   - Test full pipeline

2. **Deploy What Works** (30 min)
   - Deploy Firestore rules/indexes
   - Deploy cloud functions
   - Test with team

3. **Document for Team** (30 min)
   - Which endpoints to use
   - How data flows
   - What's stored where

## Critical Questions to Answer

1. **Asset Storage**: Are ALL generated assets being saved to Firebase Storage?
   - Check: Scene images, videos, audio files
   - Fix: Add storage upload to any missing generations

2. **Cloud Functions**: Are project-based cloud functions deployed?
   - Check: `functions/project_functions.py`
   - Fix: Deploy if not active

3. **Real-time Updates**: Is the frontend subscribing to project changes?
   - Check: useProjectScenes using subscribeToProject
   - Fix: Ensure Firestore listeners are active

## Testing Checklist

```bash
# Quick smoke test
1. Create new project
2. Fill creative brief → Check Firestore has brief ✓/✗
3. Select mood → Check images in Firebase Storage ✓/✗
4. Select backgrounds → Check saved to project ✓/✗
5. Generate scene → Check video in Firebase Storage ✓/✗
6. Refresh page → Check all state restored ✓/✗
7. Open in new tab → Check real-time sync ✓/✗
```

## Message to Team

"I've mapped out the architecture. The core issue is that new features (backgrounds, assets) aren't integrated with the backend. I can either:
1. Quick fix: Store everything as JSON blob (1 hour)
2. Proper fix: Extend models for all features (3 hours)
3. Just document what works and what doesn't

What's the priority for the demo?"
