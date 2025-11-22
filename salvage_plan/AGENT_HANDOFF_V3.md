# Agent Handoff V3 - Salvage Operation Status

## Current Situation

**Status**: ACTIVE SALVAGE - Multiple issues in user flow  
**Previous Work**: 3 phases completed by prior agents (dual-system removed)

##  Mission
Fix the video pipeline so it works end-to-end from project creation to scene generation without errors.

## What's Actually Working
- **Specific test project** (ded9c0b4-2e33-48a1-8b9b-d504ace74d6d) displays scenes correctly
- Backend/frontend servers start with `pnpm run dev`
- Auth bypass partially working in development
- Mood generation works (but has double-render issue)

## Critical Issues in User Flow

### 1. CORS Errors on Some Endpoints
```
Access to fetch at 'http://localhost:8000/api/background/generate' blocked by CORS
```
**Impact**: Background generation fails
**Note**: Mood generation works, so CORS is partially configured

### 2. Project Not Found After Creation
```
[ProjectStore] Project not found: a06a1ad5-365a-4324-ae58-a5743f629667
```
**Impact**: New projects created but can't be accessed immediately - this error happens when we move from the moodboard to the next stage - which I believe is backgrounds
**Likely cause**: User ID mismatch or timing issue between creation and retrieval

### 3. Mood Double Rendering (Not Blocking, But Bad UX)
**Symptom**: Mood images render once, then immediately re-render with completely different images
**Impact**: Confusing UX, wastes API calls, user loses first set of images
**Likely cause**: Duplicate API call or state update triggering re-render

## What Was Fixed Today
1. **Scene display issue** - Fixed by using `projectFromScenes` instead of broken `useProject` hook
2. **Creative brief/mood data** - Added to test project for scene regeneration
3. **Auth bypass enhanced** - Updated middleware and API client for development

If you ever have questions about .env files let me know.

## Key Files to Know

### For Background CORS Issue
- `backend/app/routers/backgrounds.py` - Check route registration
- `backend/app/main.py` - Line 67: `app.include_router(backgrounds.router)`
- Compare with working `moods.py` router setup

### For Project Access Issue  
- `backend/app/middleware/clerk_auth.py` - Returns 'demo-user-dev' in dev mode
- `frontend/store/projectStore.ts` - Project creation/retrieval logic
- `backend/app/services/firestore_service.py` - User ID filtering in queries

### For Mood Double Rendering
- `frontend/app/project/[id]/mood/page.tsx` - Check for duplicate useEffect calls
- `frontend/hooks/useMoodGeneration.ts` - Look for multiple API triggers
- Check React StrictMode (dev mode renders twice)

### Scene Display (Already Fixed)
- `frontend/app/project/[id]/scenes/page.tsx` - Line 48: Now uses `projectFromScenes`

## 🚀 Next Steps (Priority Order)

1. **Fix Project Access** (45 min) - BLOCKING
   - Add logging to track user IDs at creation vs retrieval
   - Check timing - might need to wait for Firestore write to propagate
   - Verify 'demo-user-dev' is used consistently

2. **Fix Background CORS** (20 min) - BLOCKING
   - Compare backgrounds router with working moods router
   - Check if route is properly prefixed
   - Verify CORS middleware applies to all routes

3. **Fix Mood Double Rendering** (30 min) - UX Issue
   - Add console logs to track when/why generation is triggered
   - Check for React StrictMode double-mounting
   - Look for state updates that trigger re-generation

## 💡 Testing Flow
```bash
# Start servers
pnpm run clean
pnpm run dev

# Test FULL flow:
1. Projects page → Create project (check if accessible after creation)
2. Chat → Enter creative brief 
3. Mood → Generate moods (watch for double render)
4. Backgrounds → Select backgrounds (CORS error here)
5. Scenes → Should auto-generate if reached

# Working test project:
http://localhost:3000/project/ded9c0b4-2e33-48a1-8b9b-d504ace74d6d/scenes
```

## 🐛 Debug Tips

### For Project Access
```javascript
// Add to projectStore.ts create method
console.log('[CREATE] User ID:', userId);
console.log('[CREATE] Project ID:', newProject.id);

// Add to get/list methods
console.log('[GET] User ID:', userId);
console.log('[GET] Looking for:', projectId);
```

### For Mood Double Render
```javascript
// Add to mood generation hook/component
console.log('[MOOD] Generation triggered:', new Date().toISOString());
console.trace(); // See what triggered it
```

## 📚 Context Documents
- `ACTIVE_ISSUES.md` - Issue details
- `PHASE3_COMPLETE.md` - Storyboard system removal
- `phase1a/b/c-complete.md` - Previous fixes
- Previous handoffs have incomplete understanding

## ⚠️ Key Insights
1. **Partial functionality** - Some things work (moods) while similar things don't (backgrounds)
2. **Race conditions** - Project creation might have timing issues
3. **React dev mode** - Could cause double renders (StrictMode)
4. **Auth complexity** - 'demo-user-dev' must be consistent everywhere

## 🎬 Bottom Line
The system is close to working but has several friction points in the user flow. The architecture is sound (proven by test project working), but the flow from project creation through scene generation has multiple bugs that compound. Fix the blocking issues first (project access, backgrounds), then polish (mood double-render).

---
*Status: Active debugging, not complete*  
*Next agent should start with project access issue - it's the most critical*