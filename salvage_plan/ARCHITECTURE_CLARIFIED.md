# Architecture Clarified - The Real Data Flow

## 🚨 The Core Problem: Three Competing Systems

### 1. appStore (The Real Working State)
**Location**: `frontend/store/appStore.ts`  
**Purpose**: Live editing state for the entire pipeline  
**Contains**: Everything - creative brief, moods, backgrounds, scenes tracking  
**Problem**: Not fully persisted to backend

### 2. projectStore (The Bridge)
**Location**: `frontend/store/projectStore.ts`  
**Purpose**: Syncs appStore → Backend API  
**Method**: Takes snapshots of appStore, saves via `/api/projects`  
**Problem**: Only saves what backend supports (missing backgrounds, assets)

### 3. firestoreProjectStore (The Unused Alternative)
**Location**: `frontend/store/firestoreProjectStore.ts`  
**Purpose**: Direct Firestore access (bypasses backend)  
**Status**: ❌ NOT USED - Just adds confusion  
**Problem**: Competing implementation

## 📊 The Hook Confusion

### Two Hooks, Same Data, Different Approaches

#### useProject()
- Generic project management hook
- Fetches via `projectsApi.get()`
- Returns: `{ project, isLoading, error, updateProject, ... }`
- Used by: Various pages that need project metadata

#### useProjectScenes()  
- Specialized for scene management
- Real-time Firestore subscription
- Returns: `{ project, scenes, isLoading, editText, ... }`
- Used by: Scenes page specifically

**The Problem**: Both can return project data! Pages randomly use one or the other.

## 🔄 The Actual Data Flow (What Really Happens)

```mermaid
User Action → appStore → projectStore → Backend API → Firestore
                ↓           ↓              ↓            ↓
            (memory)   (localStorage)  (validation)  (database)
```

### Example: User Selects a Mood

1. **User clicks mood** → `selectMood()` called
2. **appStore updated** → `selectedMoodId` set in memory
3. **projectStore auto-save** → Detects change, calls `saveCurrentProject()`
4. **API call** → `PATCH /api/projects/{id}` with snapshot
5. **Backend** → Updates Firestore document
6. **Real-time sync** → Other clients see update

### But Wait! Background Selection is Different:

1. **User selects background** → `setSelectedBackgroundIds()` 
2. **appStore updated** → `selectedBackgroundIds` set
3. **projectStore saves** → But backend doesn't have a field for this!
4. **Data lost on refresh** ❌

## 🎯 The Fix We Applied

### For Project Access Issue (mood → background transition)

The `loadProject` method only looked in local cache. When navigating between pages:
- Mood page uses one hook
- Background page uses different store
- Project not in cache = "Project not found"

**Fixed by**: Making `loadProject` fetch from backend if not in cache:

```typescript
loadProject: async (id) => {
  let project = state.projects.find(p => p.id === id);
  
  if (!project) {
    // NEW: Fetch from backend if not cached
    project = await projectsApi.get(id);
    // Add to cache for next time
    set({ projects: [...state.projects, project] });
  }
  
  // Continue with loading...
}
```

## 🧹 What Should Be Cleaned Up

### 1. Delete Unused Code
- Remove `firestoreProjectStore.ts` entirely
- Remove storyboard UI components (already backend deleted)

### 2. Pick ONE Approach
- Either `useProject` OR `useProjectScenes`, not both
- Recommend: `useProjectScenes` for scenes page, `useProject` elsewhere

### 3. Fix the Backend Model
Add missing fields to backend `Project` model:
- `background_asset_ids: List[str]`
- `character_asset_ids: List[str]`  
- `brand_asset_ids: List[str]`

### 4. Simplify State Management
Option: Use the `app_state_snapshot` approach (Option 3 from salvage plan)
- Store entire appStore as JSON blob
- No more field mapping issues
- Future-proof for new features

## 🚀 Current Status After Our Fix

✅ **Fixed**: Project now loads from backend when not in cache
⏳ **Next**: Fix CORS for background generation
⏳ **Next**: Fix mood double-rendering
❌ **Still Broken**: Background selections don't persist

## 📝 Key Takeaway

The architecture isn't broken - it's just **overcomplicated** with multiple ways to do the same thing. The data flow works when all pieces align, but fails when:
- Different pages use different systems
- Backend model missing fields
- Cache assumptions are wrong

The fix is to **pick one way** and use it consistently.
