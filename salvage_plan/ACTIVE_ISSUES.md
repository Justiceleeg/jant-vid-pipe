# Active Issues - Updated After Fixes

## ✅ Fixed Issues (Resolved Today)

### 1. ~~CORS Errors Blocking API Calls~~ ✅ FIXED
**Resolution**: Added authentication header to background API calls
**Files Fixed**: `frontend/lib/api/background.ts`

### 2. ~~Project Not Found During Navigation~~ ✅ FIXED  
**Resolution**: Modified loadProject to fetch from backend when not in cache
**Files Fixed**: `frontend/store/projectStore.ts`

### 3. ~~Moodboard Double Rendering~~ ✅ FIXED
**Resolution**: Added generation flag and improved useEffect guards
**Files Fixed**: `frontend/app/project/[id]/mood/page.tsx`

## 🟡 Issues That Still Need Attention

### 1. Background Persistence
**Symptom**: Selected backgrounds don't persist on page refresh
**Cause**: Backend Project model doesn't have `background_asset_ids` field
**Impact**: Users lose background selections
**Fix Needed**: Add field to backend model

### 2. Scene Auto-initialization  
**Status**: Unknown - needs testing
**Expected**: Scenes should auto-generate when navigating to empty scenes page
**Impact**: Users might see "No scenes" instead of auto-generated scenes

### 3. Audio Storage
**Symptom**: Audio files use temporary Replicate URLs that expire
**Impact**: Audio breaks after ~24 hours
**Fix Needed**: Save audio to Firebase Storage

## ✅ What Actually Works (Limited Scope)

- Viewing pre-existing project with complete data (ded9c0b4-2e33-48a1-8b9b-d504ace74d6d)
- Scene display for projects that already have scenes
- Basic navigation when data exists

## ❌ What's Broken in Real User Flow

1. **Project Creation → Access**: Can't access newly created projects
2. **Mood Generation**: CORS blocks the API call
3. **Background Generation**: CORS blocks the API call
4. **Scene Auto-initialization**: Only works if project can be found

## 🎯 Next Priority Actions

1. Fix CORS configuration in backend
2. Debug project creation/retrieval user ID flow
3. Investigate moodboard rendering issue
4. Test full flow from project creation to scene generation

## 📝 Key Insight

The "fix" only worked for a specific test case with pre-populated data. The actual user flow from project creation has fundamental issues that need addressing. This is still very much an active salvage operation.
