# Quick Start for Next Agent

## You're fixing Tom's branch (`tom-backend`) - 70% working, needs integration fixes

## THE #1 CRITICAL BUG
**Scenes don't initialize!** When users reach `/project/{id}/scenes`, it's empty with no way to proceed.

### Fix (Do this FIRST):
```typescript
// In frontend/app/project/[id]/scenes/page.tsx, add around line 50:
useEffect(() => {
  if (!isLoading && project && scenes.length === 0) {
    projectsApi.initializeScenes(projectId);
  }
}, [project, scenes, isLoading]);
```

## Your Mission
Transform a partially integrated backend into a clean, working demo. Tom built good architecture but teammates added features that bypass it. You need to connect everything properly.

## The Plan (in order)
1. **Fix scene initialization** (above)
2. **Add missing endpoints** (regenerate text/image)  
3. **Add state persistence** (app_state_snapshot field)
4. **Deploy & test**
5. **Delete storyboard system** (it's the old way, confusing everyone)
6. **Move OpenAI logic** from storyboard_service to project service

## Key Files You'll Touch
- `frontend/app/project/[id]/scenes/page.tsx` - Add init
- `backend/app/routers/projects.py` - Add endpoints
- `backend/app/models/project_models.py` - Add app_state field
- `backend/app/services/storyboard_service.py` - Extract OpenAI logic then delete

## Read These Docs (in salvage_plan/)
1. `CONTEXT_HANDOFF.md` - Full context
2. `implementation-phases.md` - Detailed plan
3. `04-storyboard-project-overlap.md` - Why scenes are broken

## Success = 
User can: Create project → Generate mood → Select backgrounds → **See scenes appear** → Edit scenes → Generate videos → Everything persists

Good luck! Start with the scene init fix - it unblocks everything.
