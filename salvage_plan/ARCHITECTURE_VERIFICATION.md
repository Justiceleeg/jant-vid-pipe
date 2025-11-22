# Architecture Verification Report

## Executive Summary
After thorough investigation, the architecture description in ARCHITECTURE_CLARIFIED.md is **ACCURATE**. The system indeed has three competing store systems, hook confusion, and data persistence issues as described.

## ✅ Verified: Three Competing Systems

### 1. appStore (Confirmed as Primary Working State)
**Location**: `frontend/store/appStore.ts`
- **Verified**: Contains all pipeline state (creative brief, moods, backgrounds, scenes)
- **Confirmed**: Not persisted directly to localStorage
- **Evidence**: Line 14-15 comment states "NOT persisted to localStorage directly"
- **Auto-sync**: Line 485-491 in projectStore subscribes to appStore changes

### 2. projectStore (Confirmed as Bridge)
**Location**: `frontend/store/projectStore.ts`
- **Verified**: Syncs appStore → Backend API
- **Mechanism**: `createAppStateSnapshot()` (lines 57-77) captures appStore state
- **Auto-save**: Debounced 1.5s after any appStore change (lines 399-407)
- **Backend Sync**: Sends to `/api/projects` with `appStateSnapshot` field (line 379)
- **Fix Applied**: Lines 260-276 now fetch from backend if not in cache

### 3. firestoreProjectStore (Confirmed Unused)
**Location**: `frontend/store/firestoreProjectStore.ts`
- **Verified**: NOT imported or used anywhere except:
  - Its own file
  - `frontend/lib/firebase/migration.ts` (also unused)
- **Status**: Dead code that adds confusion
- **Recommendation**: Delete entirely

## ✅ Verified: Hook Confusion

### Two Hooks Return Same Data
Both hooks can return project data, causing confusion:

1. **useProject()** (`frontend/hooks/useProject.ts`)
   - Returns: `{ project, isLoading, error, updateProject, ... }`
   - Uses: `projectsApi.get()` for fetching
   - Real-time: Firestore subscription via `subscribeToProject`

2. **useProjectScenes()** (`frontend/hooks/useProjectScenes.ts`)
   - Returns: `{ project, scenes, isLoading, editText, ... }`
   - Also uses: `subscribeToProject` for real-time updates
   - Specialized for scene operations

### Evidence of Confusion
`frontend/app/project/[id]/scenes/page.tsx`:
- Line 30: Loads project via `useProject`
- Line 35: Also loads project via `useProjectScenes`
- Line 52: Comment admits confusion: "Use the project from useProjectScenes since it's more reliable"

## ✅ Verified: Data Flow

### Confirmed Flow Pattern
```
User Action → appStore → projectStore → Backend API → Firestore
     ↓           ↓           ↓              ↓           ↓
  (memory)  (local state) (auto-save)   (validation) (database)
```

### Auto-Save Mechanism (Verified)
1. **Trigger**: Any appStore change (line 485 projectStore)
2. **Debounce**: 1.5 seconds (AUTO_SAVE_DEBOUNCE_MS)
3. **Snapshot**: `createAppStateSnapshot()` captures full state
4. **Backend**: Sends via `projectsApi.update()`
5. **Storage**: Saved as `appStateSnapshot` in Firestore

## ✅ Verified: Background Persistence Issue

### The Problem
Background selections ARE captured but NOT properly persisted due to type mismatches.

### Evidence Found

#### Frontend Has TWO Project Types (!)
1. **`frontend/types/project.types.ts`** (Used by projectStore)
   - HAS these fields:
     - `brandAssetIds?: string[]`
     - `characterAssetIds?: string[]`
     - `backgroundAssetIds?: string[]`

2. **`frontend/types/project.ts`** (Used by hooks)
   - LACKS these fields
   - Only has: `appStateSnapshot?: Record<string, any>`

#### Backend Missing Fields
**`backend/app/models/project_models.py`** (lines 115-143):
- NO `background_asset_ids` field
- NO `character_asset_ids` field
- NO `brand_asset_ids` field
- Only has: `app_state_snapshot: Optional[Dict[str, Any]]` (Option 3)

### Why Backgrounds Don't Persist
1. Frontend saves `selectedBackgroundIds` in appStore ✅
2. projectStore captures it in snapshot ✅
3. Backend receives it in `appStateSnapshot` ✅
4. BUT frontend expects it in top-level `backgroundAssetIds` field ❌
5. Backend doesn't have this field ❌
6. Data lost on page refresh ❌

## 🆕 Additional Findings

### 1. Type System Chaos
- Two different Project types in frontend
- Different components use different types
- Backend type doesn't match either frontend type
- This causes silent data loss

### 2. Mixed API Patterns
- Some endpoints use project-centric approach
- Others use resource-centric (scenes, storyboards)
- Inconsistent data fetching strategies

### 3. Real-time Subscription Mess
- Multiple subscription mechanisms
- Some use Firestore directly
- Others use backend API subscriptions
- Race conditions between different subscriptions

### 4. The "Option 3" Implementation
The system is partially implementing "Option 3" from the salvage plan:
- `appStateSnapshot` field exists in backend
- projectStore sends full snapshot
- But not all components know how to read it back

## 📊 Impact Assessment

### Critical Issues
1. **Data Loss**: Background/asset selections don't persist
2. **Type Mismatches**: Silent failures due to incompatible types
3. **Dead Code**: firestoreProjectStore adds 520 lines of confusion

### Medium Issues
1. **Hook Duplication**: Same data fetched multiple ways
2. **Double Rendering**: Some pages load data twice
3. **Inconsistent State**: Different components see different data

### Low Priority
1. **Code Cleanup**: Remove unused localStorage cleanup
2. **Consolidate Types**: Merge the two Project types
3. **Documentation**: Update types to match reality

## ✅ Recommendations

### Immediate Fixes
1. **Pick ONE Project type** and use everywhere
2. **Delete firestoreProjectStore.ts** entirely
3. **Add missing fields to backend** OR **fully commit to Option 3**

### Option 3 Implementation (Recommended)
Since `appStateSnapshot` already exists:
1. Make ALL components read from `appStateSnapshot`
2. Stop expecting top-level asset ID fields
3. Treat `appStateSnapshot` as single source of truth
4. This is future-proof for new features

### Alternative: Add Backend Fields
1. Add to backend Project model:
   - `background_asset_ids: List[str]`
   - `character_asset_ids: List[str]`
   - `brand_asset_ids: List[str]`
2. Update projectStore to save these fields
3. More work but cleaner separation

## 🎯 Conclusion

The ARCHITECTURE_CLARIFIED.md document is **100% accurate**. The system has:
- ✅ Three competing stores (verified)
- ✅ Hook confusion (verified)
- ✅ Data flow as described (verified)
- ✅ Background persistence issues (verified)
- 🆕 Additional type system chaos (newly discovered)

The fix applied to `loadProject` is working but only addresses symptoms, not root causes. The system needs architectural decisions about:
1. Which store system to use
2. Which Project type to standardize on
3. Whether to fully implement Option 3 or add backend fields
