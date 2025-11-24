# 🚀 Quick Deployment Checklist

## Pre-Flight ✈️

- [ ] Docker Desktop is running
- [ ] Logged into GCP: `gcloud auth login`
- [ ] Project set: `gcloud config set project jant-vid-pipe-fire`
- [ ] Docker configured: `gcloud auth configure-docker`
- [ ] Firebase CLI installed: `npm install -g firebase-tools`
- [ ] Firebase logged in: `firebase login`

### Firebase Configuration Files
- [ ] `backend/serviceAccountKey.json` exists ✅
- [ ] `firestore.rules` exists (in project root) ✅
- [ ] `firestore.indexes.json` exists (in project root) ✅
- [ ] `storage.rules` exists (in project root) ✅
- [ ] `.firebaserc` exists (in project root) ✅
- [ ] `firebase.json` exists (in project root) ✅

### Deploy Firebase Config
```bash
# Deploy Firestore rules, indexes, and Storage rules
firebase deploy --only firestore,storage
```

- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] Firestore indexes building (check console - wait for green checkmarks)

### Enable Firebase Authentication
- [ ] Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/authentication/providers
- [ ] Enable Email/Password authentication ✅
- [ ] (Optional) Enable Google Sign-In or other providers

## Environment Variables 📝

### Backend (set after deployment)
- [ ] `REPLICATE_API_TOKEN`
- [ ] `OPENAI_API_KEY`
- [ ] `FIREBASE_STORAGE_BUCKET`
- [ ] `API_BASE_URL` (your backend URL)
- [ ] `CORS_ORIGINS` (your frontend URL)

### Frontend (export before deployment)
```bash
export NEXT_PUBLIC_FIREBASE_API_KEY="AIza***"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="jant-vid-pipe-fire.firebaseapp.com"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="jant-vid-pipe-fire"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="jant-vid-pipe-fire.firebasestorage.app"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="***"
export NEXT_PUBLIC_FIREBASE_APP_ID="1:***:web:***"
```

## Deployment Steps 🎯

1. **Deploy Backend:**
   ```bash
   ./deploy-backend.sh
   ```
   
2. **Get Backend URL:**
   ```bash
   gcloud run services describe jant-vid-pipe-backend \
     --region us-central1 --format 'value(status.url)'
   ```
   
3. **Set Backend Env Vars:**
   ```bash
   gcloud run services update jant-vid-pipe-backend \
     --region us-central1 \
     --set-env-vars="REPLICATE_API_TOKEN=***,OPENAI_API_KEY=***,FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app,API_BASE_URL=https://backend-url,CORS_ORIGINS=https://frontend-url"
   ```

4. **Deploy Frontend:**
   ```bash
   # Export Firebase vars first (see above)
   ./deploy-frontend.sh https://YOUR-BACKEND-URL.run.app
   ```
   
5. **Get Frontend URL:**
   ```bash
   gcloud run services describe jant-vid-pipe-frontend \
     --region us-central1 --format 'value(status.url)'
   ```
   
6. **Update Backend CORS:**
   ```bash
   gcloud run services update jant-vid-pipe-backend \
     --region us-central1 \
     --update-env-vars="CORS_ORIGINS=https://YOUR-FRONTEND-URL.run.app"
   ```

## Verification ✅

### Backend Health
- [ ] Backend health: `curl https://backend-url/health`
- [ ] Backend logs show no errors: `gcloud run logs tail jant-vid-pipe-backend --region us-central1`

### Frontend & Firebase Auth
- [ ] Frontend loads in browser
- [ ] Can sign up with email/password (Firebase Auth)
- [ ] Can sign in with existing credentials
- [ ] Auth state persists after refresh
- [ ] Sign out works correctly

### Asset Management
- [ ] Can upload brand asset
- [ ] Can upload character asset
- [ ] Can upload product asset
- [ ] Assets appear in list after upload
- [ ] Assets persist after page refresh

### Project Features
- [ ] Can create a new project
- [ ] Can generate backgrounds
- [ ] Can create scenes
- [ ] Can generate storyboard
- [ ] Scene assets persist correctly

### Firestore Data Verification
- [ ] Check Firestore console: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/data
- [ ] See `projects` collection with your userId ✅
- [ ] See `brand_assets`, `character_assets`, `product_assets` collections ✅
- [ ] See `background_assets` collection (after generating backgrounds) ✅
- [ ] All data is scoped by userId (security rules working) ✅

## Common Issues 🔧

**"Firebase Storage not configured"**
→ Check serviceAccountKey.json is in backend/ before build

**"Permission denied" in Firestore**
→ Deploy firestore.rules: `firebase deploy --only firestore:rules`
→ Ensure user is authenticated with Firebase Auth

**CORS errors**
→ Update CORS_ORIGINS in backend

**Assets not persisting**
→ Wait for Firestore indexes to finish building (check console)
→ Check Firestore rules are deployed correctly

**"Auth error" or "User not found"**
→ Ensure Firebase Auth Email/Password is enabled
→ Check Firebase config env vars are correct in frontend build

## Quick Commands 📟

```bash
# View logs
gcloud run logs tail jant-vid-pipe-backend --region us-central1
gcloud run logs tail jant-vid-pipe-frontend --region us-central1

# Redeploy after changes
./deploy-backend.sh  # Backend changes
./deploy-frontend.sh https://backend-url  # Frontend changes

# Update env vars
gcloud run services update SERVICE_NAME \
  --region us-central1 \
  --set-env-vars="KEY=value"
```

---

**Full Guide:** See `DEPLOYMENT_GUIDE.md` for detailed instructions!

