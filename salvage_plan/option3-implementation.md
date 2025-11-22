# Option 3 Implementation: Full State Snapshot

## Why This Works
- **Captures EVERYTHING**: Any field your teammates add is automatically saved
- **No more drift**: Frontend changes are instantly persisted
- **Agent-friendly**: All agents see the same data structure
- **Quick to implement**: ~20 minutes of code changes
- **Easy to migrate later**: Can move to proper models in Option 2 when ready

## Step 1: Backend - Add Snapshot Field

### File: `backend/app/models/project_models.py`
Add to the Project class:
```python
from typing import Dict, Any

class Project(BaseModel):
    # ... existing fields ...
    
    # NEW: Complete UI state snapshot
    app_state_snapshot: Optional[Dict[str, Any]] = None
    
    # Track which fields are authoritative
    snapshot_version: int = 1  # Increment if snapshot structure changes
```

## Step 2: Frontend - Save Full State

### File: `frontend/store/projectStore.ts`
Modify `createProjectSnapshot` function (~line 65):

```typescript
const createProjectSnapshot = (): ProjectSnapshot => {
  const appState = useAppStore.getState();
  const project = get().projects[get().currentProjectId!];
  
  if (!project) {
    throw new Error('Cannot create snapshot: no current project');
  }

  // NEW: Just capture EVERYTHING from appStore
  const fullAppState = {
    creativeBrief: appState.creativeBrief,
    selectedMood: appState.selectedMood,
    scenes: appState.scenes,
    currentStep: appState.currentStep,
    backgroundAssets: appState.backgroundAssets,
    selectedBackgroundIds: appState.selectedBackgroundIds,
    // Add any other appStore fields here, or just use:
    // ...appState  // captures everything!
  };

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    // Keep existing structured fields for backwards compatibility
    storyboard: {
      id: project.storyboard?.id || `storyboard-${project.id}`,
      title: project.storyboard?.title || project.name,
      creativeBrief: appState.creativeBrief,
      selectedMood: appState.selectedMood,
    },
    // NEW: The magic field that captures everything
    appStateSnapshot: fullAppState,
    scenes: project.scenes || [],
    stats: project.stats,
  };
};
```

## Step 3: Frontend - Restore Full State

### File: `frontend/store/projectStore.ts`
Modify `loadProject` function (~line 100):

```typescript
loadProject: async (projectId: string) => {
  set({ isLoading: true, error: null });
  try {
    const project = await projectsApi.get(projectId);
    
    // Existing project loading
    set({
      projects: { ...get().projects, [project.id]: project },
      currentProjectId: project.id,
      isLoading: false,
    });
    
    // NEW: Restore full app state if snapshot exists
    if (project.appStateSnapshot) {
      const appStore = useAppStore.getState();
      const snapshot = project.appStateSnapshot;
      
      // Restore each field
      if (snapshot.creativeBrief) appStore.setCreativeBrief(snapshot.creativeBrief);
      if (snapshot.selectedMood) appStore.setSelectedMood(snapshot.selectedMood);
      if (snapshot.backgroundAssets) appStore.setBackgroundAssets(snapshot.backgroundAssets);
      if (snapshot.selectedBackgroundIds) appStore.setSelectedBackgroundIds(snapshot.selectedBackgroundIds);
      if (snapshot.currentStep) appStore.setCurrentStep(snapshot.currentStep);
      // Add more as needed, or loop through all keys
      
      console.log('[ProjectStore] Restored app state from snapshot');
    } else {
      // Fallback to existing sync logic for old projects
      syncProjectToAppStore(project);
    }
    
    return project;
  } catch (error) {
    set({ error: error.message, isLoading: false });
    throw error;
  }
},
```

## Step 4: Ensure Auto-Save Works

The existing auto-save in `projectStore.ts` should already handle this, but verify:

```typescript
// Around line 418 - this should already exist
useAppStore.subscribe(() => {
  const { currentProjectId } = useProjectStore.getState();
  if (currentProjectId) {
    useProjectStore.getState().scheduleAutoSave();
  }
});
```

## Step 5: Python Backend Handling

### File: `backend/app/services/firestore_service.py`
Make sure the service handles the new field:

```python
async def update_project(self, project_id: str, updates: dict) -> Project:
    """Update project with any fields including app_state_snapshot"""
    project_ref = self.db.collection('projects').document(project_id)
    
    # Convert to snake_case for Firestore
    firestore_updates = {}
    for key, value in updates.items():
        snake_key = to_snake_case(key)
        firestore_updates[snake_key] = value
    
    # Special handling for app_state_snapshot - store as-is
    if 'app_state_snapshot' in firestore_updates:
        # Don't try to convert the snapshot, it's already structured
        pass
    
    firestore_updates['updated_at'] = datetime.now()
    await project_ref.update(firestore_updates)
    
    # Return updated project
    return await self.get_project(project_id)
```

## Testing the Implementation

1. **Create a new project**
2. **Add data at each step**:
   - Fill creative brief
   - Select mood
   - Select backgrounds
   - Edit scenes
3. **Check Firestore Console**:
   - Project document should have `app_state_snapshot` field
   - It should contain ALL the UI state
4. **Refresh the page**:
   - Everything should restore perfectly
5. **Open in new tab**:
   - Should see the same state

## Benefits of This Approach

1. **Future-proof**: When teammates add new fields to appStore, they're automatically saved
2. **No coordination needed**: Frontend devs can add features without backend changes
3. **Agent-friendly**: All agents see the full state, no missing fields
4. **Easy rollback**: Can always read the snapshot to recover state
5. **Migration path**: Can gradually move fields to structured models later

## Migration to Option 2 Later

Track this as technical debt:
```typescript
// TODO: Migrate to structured asset management (Option 2)
// - Create user asset registry
// - Link assets to projects properly
// - Remove app_state_snapshot once all fields are modeled
```

## Common Issues & Fixes

### Issue: Snapshot too large
**Fix**: Exclude large transient data
```typescript
const fullAppState = {
  ...appState,
  // Exclude large temporary data
  tempVideoData: undefined,
  uploadProgress: undefined,
};
```

### Issue: Circular references
**Fix**: Use a serialization helper
```typescript
const fullAppState = JSON.parse(JSON.stringify(appState));
```

### Issue: Case conversion problems
**Fix**: Store snapshot as-is, don't convert cases
```python
# In Python, treat app_state_snapshot as opaque JSON
if 'app_state_snapshot' in updates:
    # Don't process, just store
    firestore_updates['app_state_snapshot'] = updates['app_state_snapshot']
```

## Next Steps After This Works

1. **Get it deployed and working**
2. **Tell team**: "The backend now saves everything. Just add to appStore and it persists."
3. **Document for agents**: "All UI state is in project.app_state_snapshot"
4. **Plan Option 2**: Schedule proper modeling for after demo
