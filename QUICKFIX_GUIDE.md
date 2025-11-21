# Quick Fix Guide - Get Your App Working

## Current Status
- ✅ Backend code fixed (3 bugs squashed)
- ❌ Frontend missing Firebase config
- ❌ Data flow using both old (localStorage) and new (Firestore) systems

## Fix #1: Get Firebase Config (5 minutes)

### Step 1: Get Firebase Config from Console

1. Go to: https://console.firebase.google.com/
2. Select your project: `jant-vid-pipe-fire`
3. Click ⚙️ (Settings) → Project Settings
4. Scroll to "Your apps" section
5. Click on your web app (or create one if none exists)
6. Copy the `firebaseConfig` object

### Step 2: Add to Frontend .env.local

Add these to `frontend/.env.local`:

```env
# Firebase Configuration (get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=jant-vid-pipe-fire.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=jant-vid-pipe-fire
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Already have these (keep them):
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/projects
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/projects
```

---

## Fix #2: Test Backend (5 minutes)

### Start the backend:
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000
```

### Test it works:
```bash
curl http://localhost:8000/health
# Should return: {"status": "healthy"}
```

### Check logs for Firebase:
Look for this line in the backend output:
```
INFO: Firestore client initialized successfully
```

If you see errors about Firebase, check:
- `backend/serviceAccountKey.json` exists
- `backend/.env` has `FIREBASE_PROJECT_ID=jant-vid-pipe-fire`

---

## Fix #3: Test Frontend (5 minutes)

### Start the frontend:
```bash
cd frontend
npm run dev
# or
pnpm dev
```

### Open browser:
1. Go to: http://localhost:3000
2. Open browser console (F12)
3. Look for Firebase errors

### Expected Console Output:
- ❌ BAD: "Missing Firebase configuration fields"
- ✅ GOOD: No Firebase warnings/errors

---

## Fix #4: Test the Integration (10 minutes)

### Test Project Creation:

1. **Sign in** with Clerk at http://localhost:3000/sign-in
2. **Go to Projects page**: http://localhost:3000/projects
3. **Create a new project**: Click "Create New Project"
4. **Check it appears** in the UI

### Verify in Firestore:

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select `jant-vid-pipe-fire`
3. Go to **Firestore Database**
4. Look for `projects` collection
5. You should see your newly created project!

### Test Real-time Updates:

1. Open http://localhost:3000/projects in **two browser tabs**
2. In Tab 1: Create a new project
3. In Tab 2: Project should **automatically appear** (without refresh)

If this works: 🎉 **Your real-time sync is working!**

---

## Common Issues & Fixes

### Issue: "Not authenticated - missing Authorization header"

**Problem**: Frontend not sending Clerk token

**Fix**:
1. Check browser console for auth errors
2. Make sure you're signed in
3. Try signing out and back in
4. Check `frontend/.env.local` has `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

### Issue: Projects list is empty but I created projects

**Problem**: Frontend and backend out of sync

**Quick Fix**:
1. Open browser console
2. Run: `localStorage.clear()`
3. Refresh page
4. Sign in again

**Real Fix**: Remove localStorage from `projectStore.ts` (see below)

### Issue: "Firestore not initialized"

**Backend Issue**:
- Check `backend/serviceAccountKey.json` exists
- Check `backend/.env` has `FIREBASE_PROJECT_ID`
- Restart backend

**Frontend Issue**:
- Check `frontend/.env.local` has all 6 Firebase vars
- Restart frontend dev server

### Issue: Projects created but not saved to Firestore

**Problem**: Backend API not being called

**Debug**:
1. Open browser Network tab (F12 → Network)
2. Create a project
3. Look for `POST http://localhost:8000/api/projects`
4. Check the response

**If 401 Unauthorized**: Auth issue (see above)
**If 500 Server Error**: Check backend logs

---

## Next Steps (Optional but Recommended)

### 1. Remove localStorage Completely

The old system (localStorage) and new system (Firestore) are fighting each other.

Edit `frontend/store/projectStore.ts`:

```typescript
// REMOVE this line:
persist: {
  name: 'jant-vid-pipe-projects',
},
```

Replace with:
```typescript
// No persistence needed - Firestore handles it!
```

### 2. Test Multi-User Access

1. Sign in as User A in Chrome
2. Create a project
3. Sign in as User B in Firefox
4. User B should NOT see User A's projects
5. Firestore security rules prevent this ✅

### 3. Test Cloud Functions (Later)

The video/image generation stuff uses Firebase Cloud Functions.
That's a separate deployment step (not covered here).

---

## Success Checklist

After following this guide, you should have:

- ✅ Backend running without errors
- ✅ Frontend running without Firebase warnings
- ✅ Can sign in with Clerk
- ✅ Can create projects
- ✅ Projects appear in Firestore Console
- ✅ Projects appear in UI
- ✅ Real-time updates work across tabs

---

## Still Broken?

1. **Check backend logs** - most errors show there
2. **Check browser console** - frontend errors show here
3. **Check Firebase Console** - verify data is being written
4. **Check Firestore Rules** - may be blocking writes

### Debug Commands:

```bash
# Check backend health
curl http://localhost:8000/health

# Test Firestore connection (backend)
cd backend
./venv/bin/python -c "from app.firestore_database import db; print('OK' if db.db else 'FAIL')"

# Check environment variables (frontend)
cd frontend
grep NEXT_PUBLIC .env.local

# Check environment variables (backend)
cd backend
grep FIREBASE .env
```

---

## Get Help

If still stuck after following this guide:

1. **Capture error messages** from:
   - Backend terminal
   - Browser console
   - Firebase Console
2. **Check these files** for obvious issues:
   - `backend/.env`
   - `frontend/.env.local`
   - `backend/serviceAccountKey.json` (exists?)
3. **Try the diagnosis script**:
   ```bash
   cd backend
   ./venv/bin/python -c "
   from app.firestore_database import db
   from app.services.firestore_service import get_firestore_service
   print('Firestore:', 'OK' if db.db else 'FAIL')
   print('Service:', 'OK' if get_firestore_service() else 'FAIL')
   "
   ```

Good luck! 🚀

