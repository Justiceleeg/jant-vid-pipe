# 🚀 Deployment Ready!

Your jant-vid-pipe application is now ready for deployment to Google Cloud Platform (GCP).

## ✅ What's Been Prepared

### 1. Firebase Configuration Files Created ✨
All required Firebase config files have been created and are ready to deploy:

- **`firestore.rules`** - Security rules for Firestore database
  - User-scoped access control
  - All collections protected by authentication
  - Users can only read/write their own data

- **`firestore.indexes.json`** - Composite indexes for efficient queries
  - Indexes for all major collections (projects, assets, jobs)
  - Optimized for common query patterns

- **`storage.rules`** - Security rules for Firebase Storage
  - User-scoped file access
  - File type validation (images, videos, audio)
  - Size limits enforced

- **`.firebaserc`** - Firebase project configuration
  - Points to `jant-vid-pipe-fire` project

- **`firebase.json`** - Firebase deployment configuration
  - Links rules and indexes files

### 2. Docker Configuration Updated 🐳

**Backend Dockerfile:**
- ✅ Python 3.11 slim image
- ✅ FFmpeg installed for video processing
- ✅ Firebase service account key included
- ✅ Health check configured
- ✅ Port 8080 exposed for Cloud Run

**Frontend Dockerfile:**
- ✅ Multi-stage build (deps → builder → runner)
- ✅ **Standalone output mode enabled** (required for Docker)
- ✅ Firebase config passed as build args
- ✅ Next.js 15 optimized production build
- ✅ Non-root user for security

**Docker Ignore Files:**
- ✅ Backend `.dockerignore` excludes dev files
- ✅ Frontend `.dockerignore` excludes dev files

### 3. Deployment Scripts Enhanced 📜

**`deploy-backend.sh`:**
- ✅ Builds and pushes to Google Container Registry
- ✅ Deploys to Cloud Run with proper resources (2GB RAM, 2 CPU)
- ✅ Shows backend URL after deployment
- ✅ Provides next steps for env vars and frontend deployment

**`deploy-frontend.sh`:**
- ✅ Requires backend URL as argument
- ✅ Validates Firebase env vars before building
- ✅ Builds with Firebase config baked in
- ✅ Deploys to Cloud Run with proper resources (1GB RAM, 1 CPU)
- ✅ Shows frontend URL and final CORS update command

### 4. Documentation Updated 📚

**`DEPLOYMENT_GUIDE.md`:**
- ✅ Complete step-by-step deployment instructions
- ✅ Firebase Auth setup (replaces Clerk)
- ✅ Comprehensive environment variable documentation
- ✅ Troubleshooting section
- ✅ Cost optimization tips
- ✅ Verification checklist

**`DEPLOY_CHECKLIST.md`:**
- ✅ Quick reference checklist
- ✅ Pre-flight checks
- ✅ Firebase config deployment steps
- ✅ Verification steps for all features
- ✅ Common issues and solutions

### 5. Next.js Configuration Fixed 🔧

**`frontend/next.config.ts`:**
- ✅ **`output: 'standalone'`** added (critical for Docker)
- ✅ Firebase Storage domain added to image remotePatterns
- ✅ Proper image optimization settings

### 6. Git Configuration Updated 📝

**`.gitignore`:**
- ✅ Firebase config files are **NOT ignored** (they should be committed)
- ✅ Service account key remains protected (never commit!)
- ✅ Clear comments explaining what should and shouldn't be ignored

---

## 🎯 Quick Start - Deploy Now!

### Prerequisites
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Login to GCP
gcloud auth login
gcloud config set project jant-vid-pipe-fire
gcloud auth configure-docker
```

### Step 1: Deploy Firebase Config
```bash
# From project root
firebase deploy --only firestore,storage

# Wait for indexes to build (check console)
# https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/indexes
```

### Step 2: Enable Firebase Auth
Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/authentication/providers
- Enable Email/Password ✅

### Step 3: Deploy Backend
```bash
./deploy-backend.sh

# Get backend URL (it will be displayed after deployment)
# Example: https://jant-vid-pipe-backend-xxx-uc.a.run.app
```

### Step 4: Set Backend Environment Variables
```bash
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --set-env-vars="REPLICATE_API_TOKEN=r8_YOUR_KEY,OPENAI_API_KEY=sk-YOUR_KEY,FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app,API_BASE_URL=https://YOUR-BACKEND-URL,CORS_ORIGINS=https://YOUR-FRONTEND-URL"
```

### Step 5: Deploy Frontend
```bash
# Set Firebase env vars (get from Firebase Console → Project Settings)
export NEXT_PUBLIC_FIREBASE_API_KEY="AIza***"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="jant-vid-pipe-fire.firebaseapp.com"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="jant-vid-pipe-fire"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="jant-vid-pipe-fire.firebasestorage.app"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="***"
export NEXT_PUBLIC_FIREBASE_APP_ID="1:***:web:***"

# Deploy with backend URL
./deploy-frontend.sh https://YOUR-BACKEND-URL.run.app

# Frontend URL will be displayed after deployment
```

### Step 6: Update Backend CORS
```bash
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --update-env-vars="CORS_ORIGINS=https://YOUR-FRONTEND-URL.run.app"
```

---

## 🎉 You're Done!

Test your deployed app:
1. Visit your frontend URL
2. Sign up with email/password
3. Upload assets
4. Create a project
5. Generate backgrounds
6. Create scenes and storyboards

---

## 📖 More Resources

- **Full Guide:** `DEPLOYMENT_GUIDE.md` - Comprehensive deployment documentation
- **Quick Reference:** `DEPLOY_CHECKLIST.md` - Quick checklist for deployment
- **Firebase Console:** https://console.firebase.google.com/project/jant-vid-pipe-fire
- **GCP Console:** https://console.cloud.google.com/run?project=jant-vid-pipe-fire

---

## ⚠️ Important Notes

### Firebase Auth (Not Clerk!)
This project now uses **Firebase Authentication**, not Clerk. All auth is handled through Firebase:
- Email/Password authentication
- User session management
- Protected routes
- User-scoped data access

### Service Account Key
**CRITICAL:** The `backend/serviceAccountKey.json` file must exist before building the backend Docker image. This file is:
- ✅ Required for Firestore and Firebase Storage access
- ✅ Included in the Docker image (not in .gitignore during build)
- ❌ NEVER committed to Git (listed in .gitignore)
- ❌ NEVER shared publicly

### Firebase Config Files vs Service Account Key
**Firebase Config Files** (firestore.rules, storage.rules, etc.):
- ✅ Safe to commit to Git
- ✅ No sensitive information
- ✅ Should be version controlled

**Service Account Key**:
- ❌ Contains private keys - NEVER commit!
- ❌ Download from Firebase Console when needed
- ❌ Keep secure and never share

### Environment Variables
- **Backend env vars:** Can be updated anytime via Cloud Run console
- **Frontend env vars:** Baked into the build - require rebuild to change

---

## 🆘 Need Help?

If something goes wrong:
1. Check `DEPLOYMENT_GUIDE.md` → Troubleshooting section
2. View logs: `gcloud run logs tail SERVICE_NAME --region us-central1`
3. Verify Firebase rules are deployed
4. Check Firestore indexes are built (green checkmarks)
5. Ensure all environment variables are set

**Common Issues:**
- "Permission denied" → Deploy Firestore rules
- "CORS error" → Update backend CORS_ORIGINS
- "Assets not persisting" → Wait for Firestore indexes to build
- "Auth error" → Enable Firebase Auth Email/Password

---

**Ready to deploy? Start with Step 1 above! 🚀**

