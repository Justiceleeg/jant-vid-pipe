# Agent Handoff Document v2

## 🚨 READ THIS FIRST 🚨

You're continuing work on a salvage operation. The codebase had TWO competing systems (storyboard + project) causing massive confusion. We've cleaned this up but the app still needs testing and fixes.

## Current Status: Phase 3 Complete ✅

### ✅ Completed Phases
1. **Phase 1**: Critical fixes (scene init, endpoints, state persistence)
2. **Phase 2**: Deployed infrastructure 
3. **Phase 3**: Removed storyboard system entirely

### 📍 You Are Here: Need to Test & Fix

## 🎯 Your Immediate Priority

1. **Start the services:**
   ```bash
   # Terminal 1: Backend
   cd backend && source venv/bin/activate
   uvicorn app.main:app --reload
   
   # Terminal 2: Frontend  
   cd frontend && pnpm dev
   ```

2. **Test this exact flow:**
   - Create project → Should work
   - Add creative brief → Should save
   - Select mood → Should generate images
   - Select backgrounds → **TEST IF PERSISTS**
   - Go to scenes → **SHOULD AUTO-INITIALIZE 6 SCENES**
   - Refresh page → **STATE SHOULD PERSIST**

3. **Check the console/logs for errors**

## 🔴 Known Issues to Fix

### CRITICAL
- **Scenes may not auto-initialize** - Check `frontend/app/project/[id]/scenes/page.tsx`
- **Project not found errors** - Auth/user ID mismatch (we added debug logging)
- **State not persisting** - appStateSnapshot should work but needs testing

### HIGH PRIORITY
- **Audio uses temp URLs** - Need to save to Firebase Storage
- **OpenAI placeholders** - Need `OPENAI_API_KEY` in backend `.env`

## 🏗️ What We Changed (Context)

### Before (Messy)
```
Two Systems:
1. Storyboard system (legacy, broken)
2. Project system (new, incomplete)
Result: Nobody knew which to use!
```

### After (Clean)
```
One System:
- Project system ONLY
- All storyboard code DELETED
- OpenAI logic moved to scene_generation_service.py
```

### Key Files Changed
- **Added**: `backend/app/services/scene_generation_service.py` (OpenAI logic)
- **Deleted**: All storyboard files (routers, services, models, hooks, types)
- **Updated**: `projects.py` router now handles everything

## 📂 Important Files to Know

### Backend
- `backend/app/routers/projects.py` - Main API (scenes, regenerate, etc)
- `backend/app/services/scene_generation_service.py` - OpenAI scene generation
- `backend/app/services/firestore_service.py` - Database operations
- `backend/app/middleware/clerk_auth.py` - Auth (returns demo-user-dev in dev mode)

### Frontend  
- `frontend/app/project/[id]/scenes/page.tsx` - Should auto-init scenes
- `frontend/hooks/useProjectScenes.ts` - Main hook for scene management
- `frontend/store/projectStore.ts` - Primary state management
- `frontend/lib/api/projects.ts` - API client

## 🔧 Environment Setup

```bash
# Backend .env
OPENAI_API_KEY=sk-...  # REQUIRED for real scenes
REPLICATE_API_TOKEN=... # For video generation
ENVIRONMENT=development # Enables demo auth

# Frontend .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🐛 Debug Guide

### "Project not found"
- Check backend logs for `[DEBUG]` messages
- Should see user IDs being logged
- Demo mode should allow any demo-user-dev access

### Scenes don't generate
- Check for `[initialize_scenes]` in backend logs
- Verify OpenAI API key is set
- Check `scene_generation_service.py` 

### State doesn't persist
- Check if `appStateSnapshot` is being sent in network tab
- Verify Firestore has the field in project document
- Check `projectStore.ts` save/load functions

## 📋 Remaining Work (Your Tasks)

### Phase 4: Polish (30 min)
- [ ] Fix audio storage (Firebase not temp URLs)
- [ ] Verify OpenAI integration works
- [ ] Test full persistence

### Phase 2C: Full Testing (15 min)
- [ ] Create project → scenes → video (full flow)
- [ ] Verify state persists on refresh
- [ ] Check real-time sync works

## 💡 Quick Wins

1. **Set OPENAI_API_KEY** - Instant real scene generation
2. **Test the flow** - Find what's actually broken
3. **Check logs** - We added debug logging everywhere

## 📚 Documentation Trail

Read these in order for full context:
1. `salvage_plan/PHASE3_COMPLETE.md` - What we just finished
2. `salvage_plan/04-storyboard-project-overlap.md` - The core problem
3. `salvage_plan/implementation-phases.md` - The full plan

## ⚡ One-Line Summary

**We deleted the confusing dual-system mess. Now there's ONE project system. Test it, fix what's broken, ship it.**

---
*Previous agent spent ~3 hours on Phases 1-3. You're starting Phase 4. Estimated 30-60 min to completion.*
