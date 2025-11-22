# Current Status - Verified Research Report

## 📅 Date: November 22, 2025

## 🔍 Research Summary

After thorough investigation of the codebase, I've verified the accuracy of ARCHITECTURE_CLARIFIED.md and identified the true current state of the system.

## ✅ What's Actually Fixed

### 1. Project Loading Issue (PARTIALLY FIXED)
- **Fix Applied**: `loadProject` now fetches from backend if not in cache
- **Location**: `frontend/store/projectStore.ts` lines 260-276
- **Status**: Works for navigation between pages
- **Caveat**: Only fixes symptom, not root cause

### 2. Auth Bypass for Development (APPEARS FIXED)
- Development middleware bypass exists
- Mock user provider created
- Demo token mechanism in place

## ⚠️ What's Still Broken

### 1. Background Persistence (CONFIRMED BROKEN)
**Root Cause Identified**:
- Frontend expects `backgroundAssetIds` field (project.types.ts)
- Backend doesn't have this field (project_models.py)
- Data saved in `appStateSnapshot` but not read properly
- **Impact**: Background selections lost on refresh

### 2. Type System Chaos (NEWLY DISCOVERED)
**Major Issue**:
- TWO different Project types in frontend:
  - `types/project.types.ts` (has asset ID fields)
  - `types/project.ts` (doesn't have asset ID fields)
- Different components use different types
- Backend type matches neither
- **Impact**: Silent data loss, confusion

### 3. Dead Code (CONFIRMED)
- `firestoreProjectStore.ts` - 520 lines of unused code
- Storyboard UI components (though backend already removed)
- Migration utilities that were never used

### 4. Hook Duplication (CONFIRMED)
- `useProject` and `useProjectScenes` both return project data
- Scenes page loads BOTH hooks
- Comment admits: "Use project from useProjectScenes since it's more reliable"
- **Impact**: Double data fetching, confusion

## 🏗️ Architecture Reality

### The Three Stores (All Confirmed)
1. **appStore** - Primary working state (memory only)
2. **projectStore** - Bridge to backend (auto-saves)
3. **firestoreProjectStore** - Unused alternative (dead code)

### Data Flow (Verified)
```
User Action → appStore → projectStore → Backend API → Firestore
              ↓            ↓                ↓           ↓
           (1.5s debounce) (snapshot)   (partial save) (storage)
```

### The "Option 3" Implementation (Partially Done)
- Backend has `app_state_snapshot` field ✅
- projectStore sends full snapshot ✅
- But frontend still expects individual fields ❌
- Components don't know how to read snapshot ❌

## 🚨 Critical Finding

**The system is in a transitional state between two architectures:**
1. Old: Individual fields for each data type
2. New: Single `appStateSnapshot` containing everything

This transition is incomplete, causing data loss and confusion.

## 📊 Risk Assessment

### High Risk
- Background/asset selections don't persist
- Type mismatches cause silent failures
- New features will hit same issues

### Medium Risk  
- Performance issues from double data fetching
- Confusing codebase for new developers
- Race conditions between different subscriptions

### Low Risk
- Extra localStorage cleanup code
- Unused imports and dependencies

## 🎯 Recommended Actions

### Option A: Complete "Option 3" Implementation (Recommended)
1. Fully commit to `appStateSnapshot` as single source of truth
2. Update ALL components to read from snapshot
3. Remove expectations of individual fields
4. Delete the extra Project type
5. Delete firestoreProjectStore entirely

**Pros**: Future-proof, simpler, already partially done
**Cons**: Requires updating multiple components

### Option B: Add Missing Backend Fields
1. Add to backend Project model:
   - `background_asset_ids: List[str]`
   - `character_asset_ids: List[str]`  
   - `brand_asset_ids: List[str]`
2. Update API endpoints to handle these
3. Keep current frontend expectations

**Pros**: Minimal frontend changes
**Cons**: More backend work, doesn't fix type confusion

### Option C: Emergency Patch (Not Recommended)
1. Manually restore background IDs from appStateSnapshot on load
2. Add wrapper functions to handle both data shapes
3. Leave architecture as-is

**Pros**: Quick fix
**Cons**: Technical debt, makes problem worse

## 📝 Key Insights

1. **Previous "fixes" only addressed symptoms** - The root architectural issues remain
2. **The system works by accident** - Different parts expect different data shapes
3. **Type safety is an illusion** - Multiple conflicting types create false confidence
4. **Dead code adds confusion** - 520+ lines of unused store code
5. **"Option 3" is half-implemented** - Causing the worst of both worlds

## ⚡ Quick Test Commands

```bash
# Test if backgrounds persist
1. Select backgrounds on a project
2. Refresh the page
3. Check if selections are maintained (they won't be)

# Test type confusion
1. Check projectStore imports (uses project.types.ts)
2. Check useProjectScenes imports (uses project.ts)
3. Notice they expect different fields

# Find dead code
grep -r "useFirestoreProjectStore" frontend/
# Only found in its own file and unused migration
```

## 🏁 Conclusion

The system is functional but fragile. It works for the happy path but breaks on edge cases. The architecture description in ARCHITECTURE_CLARIFIED.md is 100% accurate. The real issue is an incomplete architectural transition that needs to be completed one way or another.

**Bottom Line**: Pick Option A or B and commit fully. The current hybrid state is unsustainable.
