# Firestore Permissions Error - Fix Guide

## The Error You're Seeing

```
Error subscribing to projects: FirebaseError: Missing or insufficient permissions.
```

## Root Cause

Your architecture has a **Clerk vs Firebase Auth mismatch**:

```
❌ Current Flow:
Frontend (Clerk user) → Firestore (expects Firebase Auth user)
                     ↓
                "Missing permissions" error
```

Firestore rules check `request.auth.uid`, but Clerk users don't have Firebase auth tokens.

## Architecture Problem

You have **two conflicting data flows**:

1. **Backend API Flow** (CORRECT):
   ```
   Frontend → Backend API → Firestore
              ↑ Validates Clerk token
   ```

2. **Direct Firestore Flow** (BROKEN):
   ```
   Frontend → Firestore
              ↑ No Clerk auth, gets blocked
   ```

The frontend code in `frontend/lib/api/projects.ts` tries to subscribe directly to Firestore for "real-time updates", but this bypasses your backend authentication.

## Quick Fix: Deploy Open Rules (Development Only)

I've already updated `firestore.rules` to allow all access temporarily. Deploy it:

```bash
firebase deploy --only firestore:rules
```

This will let you test the app immediately, but **it's not secure for production**.

## Better Fix: Remove Direct Firestore Access (30 minutes)

The **proper architecture** should be:

```
Frontend → Backend API ONLY
           ↓
           Firestore
```

### Step 1: Use Backend API Instead of Firestore Subscriptions

Edit `frontend/hooks/useProject.ts` and `useProjects` hook:

**REMOVE**: Direct Firestore subscriptions (lines 332-366 in useProject.ts, lines 406-426 in useProjects)

**REPLACE WITH**: Polling the backend API:

```typescript
// Instead of subscribing to Firestore, poll the backend
useEffect(() => {
  if (!projectId) return;

  const interval = setInterval(async () => {
    try {
      const updated = await projectsApi.get(projectId);
      setState(prev => ({ ...prev, project: updated }));
    } catch (error) {
      console.error('Failed to poll project:', error);
    }
  }, 2000); // Poll every 2 seconds

  return () => clearInterval(interval);
}, [projectId]);
```

### Step 2: Update Projects List Hook

For the projects list page, poll the backend instead of subscribing:

```typescript
export function useProjects(userId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await projectsApi.list();
      setProjects(response.projects);
      setIsLoading(false);
    } catch (error) {
      setError(error as Error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load initial data
    loadProjects();

    // Poll for updates every 3 seconds
    const interval = setInterval(loadProjects, 3000);

    return () => clearInterval(interval);
  }, [loadProjects]);

  return {
    projects,
    isLoading,
    error,
    refresh: loadProjects,
  };
}
```

### Step 3: Remove Firebase Config from Frontend (Optional)

Since you're not using Firestore subscriptions anymore, you can remove:
- Firebase SDK from `frontend/package.json`
- `frontend/lib/firebase/config.ts`
- All `NEXT_PUBLIC_FIREBASE_*` env vars

## Even Better Fix: Server-Sent Events (SSE) (1 hour)

For true real-time updates without direct Firestore access:

1. Backend opens Firestore listener
2. Backend sends updates via SSE to frontend
3. Frontend receives real-time updates through backend

This is what your old system was doing (see `backend/app/routers/sse.py`).

You could re-enable SSE for real-time updates:
- Backend listens to Firestore changes
- Backend broadcasts to connected SSE clients
- Frontend maintains SSE connection for updates

## Why This Happened

Looking at your git history:
```
b8bf003 feat: Firebase/Firestore integration with Clerk auth
```

Someone (probably an AI) tried to add "real-time Firestore subscriptions" without understanding that:
1. You're using Clerk (not Firebase Auth)
2. The backend already handles auth
3. Direct Firestore access bypasses your security layer

## Decision Matrix

| Solution | Time | Security | Real-time | Complexity |
|----------|------|----------|-----------|------------|
| **Open Firestore rules** | 1 min | ❌ Low | ✅ Yes | Easy |
| **Poll backend API** | 30 min | ✅ Good | 🟡 2-3s delay | Easy |
| **SSE from backend** | 1 hour | ✅ Good | ✅ Yes | Medium |
| **Clerk → Firebase token exchange** | 2+ hours | ✅ Good | ✅ Yes | Hard |

## My Recommendation

1. **Now**: Deploy open Firestore rules (get app working)
2. **Today**: Switch to polling backend API (secure enough)
3. **Later**: Add SSE if you need sub-second real-time updates

## Manual Steps to Fix NOW

### 1. Deploy the Updated Firestore Rules:

```bash
cd /Users/tombauer/workspace/github.com/TBau23/gauntlet/jant-vid-pipe
firebase deploy --only firestore:rules
```

You should see:
```
✔  Deploy complete!
```

### 2. Refresh Your Frontend:

Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+F5)

### 3. Test Again:

1. Go to http://localhost:3000/projects
2. Create a new project
3. The error should be GONE

### 4. Check Firestore Console:

Go to Firebase Console → Firestore → projects collection
You should see your newly created project!

## Next Steps After It's Working

Once you confirm the app works with open rules:

1. Read `QUICKFIX_GUIDE.md` for testing checklist
2. Decide if you want polling or SSE for real-time updates
3. Update the frontend to use chosen approach
4. Re-enable proper Firestore security rules

## Questions?

- **"Is this secure?"** - No, but it's fine for local development
- **"Will this work in production?"** - No, you need to fix the auth flow first
- **"Should I keep direct Firestore access?"** - No, use backend API instead
- **"What about real-time updates?"** - Backend polling (2-3s delay) or SSE (instant)


