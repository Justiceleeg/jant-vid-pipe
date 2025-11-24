# Deployment Guide - GCP Cloud Run

Complete guide for deploying jant-vid-pipe to Google Cloud Platform.

## 🎯 Prerequisites

### 1. Install Required Tools

```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Verify installations
gcloud --version
docker --version
```

### 2. Authenticate with GCP

```bash
# Login to GCP
gcloud auth login

# Set project
gcloud config set project jant-vid-pipe-fire

# Configure Docker for GCR
gcloud auth configure-docker
```

### 3. Verify Firebase Configuration

**Check that these files exist:**
- `backend/serviceAccountKey.json` ✅ (Required for Firestore & Firebase Storage)
- `firestore.rules` ✅ (Security rules for Firestore)
- `firestore.indexes.json` ✅ (Indexes for Firestore queries)
- `storage.rules` ✅ (Security rules for Firebase Storage)
- Frontend Firebase config in code ✅

**Note:** This project uses **Firebase Auth** (not Clerk). All authentication is handled through Firebase.

---

## 📋 Pre-Deployment Checklist

### Backend Environment Variables

Create these as Cloud Run environment variables or secrets:

#### Required Variables:
```bash
# API Keys (REQUIRED for generation features)
REPLICATE_API_TOKEN=r8_***                    # Get from: https://replicate.com/account/api-tokens
OPENAI_API_KEY=sk-***                         # Get from: https://platform.openai.com/api-keys

# Firebase Configuration (REQUIRED)
FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app
FIREBASE_CREDENTIALS_PATH=serviceAccountKey.json  # Included in Docker image
```

#### Production Configuration:
```bash
ENVIRONMENT=production                         # Enables production optimizations
API_BASE_URL=https://your-backend-url.run.app # Your Cloud Run backend URL
CORS_ORIGINS=https://your-frontend-url.run.app # Comma-separated list of allowed origins
```

#### Optional - Feature Flags:
```bash
USE_KONTEXT_COMPOSITE=true                    # Enable FLUX Kontext for compositing
COMPOSITE_METHOD=kontext                      # Options: 'kontext' or 'pil'
KONTEXT_MODEL_ID=flux-kontext-apps/multi-image-kontext-pro
```

#### Optional - Rate Limiting:
```bash
MAX_CONCURRENT_KONTEXT=10                     # Max concurrent Kontext jobs
MAX_KONTEXT_PER_HOUR=100                      # Hourly rate limit
KONTEXT_TIMEOUT_SECONDS=60                    # Timeout for Kontext API calls
KONTEXT_DAILY_GENERATION_LIMIT=1000          # Daily generation alert threshold
```

#### Optional - Image Generation:
```bash
IMAGES_PER_MOOD=4                             # Images generated per mood (default: 4 prod, 2 dev)
IMAGE_WIDTH=1920                              # Image width (default: 1920 prod, 1280 dev)
IMAGE_HEIGHT=1080                             # Image height (default: 1080 prod, 720 dev)
```

### Frontend Environment Variables

These are **build-time** arguments (passed during `docker build`):

#### Firebase Configuration (REQUIRED):
Get these from: Firebase Console → Project Settings → General → Your apps

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza***                        # Public API key (safe to expose)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=jant-vid-pipe-fire.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=jant-vid-pipe-fire
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=***
NEXT_PUBLIC_FIREBASE_APP_ID=1:***:web:***
```

#### Backend URL (REQUIRED):
```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.run.app  # Set after backend deployment
```

#### Runtime Environment (Optional):
```bash
NODE_ENV=production                            # Next.js environment
```

**⚠️ Important Notes:**
- Frontend env vars are **baked into the build** - they cannot be changed at runtime
- To update frontend env vars, you must rebuild and redeploy
- `NEXT_PUBLIC_*` variables are exposed to the browser (don't put secrets here!)
- Backend env vars can be updated without rebuilding via Cloud Run console

### Firebase Configuration (CRITICAL)

#### 1. Deploy Firestore Rules & Indexes

Install Firebase CLI if you haven't already:
```bash
npm install -g firebase-tools
firebase login
```

Deploy all Firebase config files:
```bash
# From project root
firebase deploy --only firestore,storage
```

This deploys:
- `firestore.rules` - Security rules for Firestore (user-scoped access)
- `firestore.indexes.json` - Composite indexes for queries
- `storage.rules` - Security rules for Firebase Storage (user-scoped access)

**Or manually deploy via console:**
- Firestore Rules: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/rules
- Firestore Indexes: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/indexes
- Storage Rules: https://console.firebase.google.com/project/jant-vid-pipe-fire/storage/rules

#### 2. Enable Firebase Authentication

Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/authentication/providers

Enable these sign-in methods:
- ✅ Email/Password
- ✅ (Optional) Google Sign-In
- ✅ (Optional) Other providers as needed

#### 3. Verify Indexes are Building

After deploying, check: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/indexes

Wait for all indexes to show green checkmarks ✅ (can take a few minutes)

---

## 🚀 Deployment Steps

### Step 1: Deploy Backend

```bash
# Navigate to project root
cd /path/to/jant-vid-pipe

# Run deployment script
./deploy-backend.sh
```

**What it does:**
1. Builds Docker image for linux/amd64
2. Pushes to Google Container Registry
3. Deploys to Cloud Run in us-central1
4. Allocates 2GB RAM, 2 CPUs
5. Allows unauthenticated access (handled by Firebase Auth)

**Get your backend URL:**
```bash
gcloud run services describe jant-vid-pipe-backend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --format 'value(status.url)'
```

Save this URL - you'll need it for the frontend!

### Step 2: Set Backend Environment Variables

```bash
# Set secrets in Cloud Run
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --set-env-vars="ENVIRONMENT=production" \
  --set-env-vars="REPLICATE_API_TOKEN=your_key_here" \
  --set-env-vars="OPENAI_API_KEY=your_key_here" \
  --set-env-vars="FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app" \
  --set-env-vars="API_BASE_URL=https://your-backend-url.run.app" \
  --set-env-vars="CORS_ORIGINS=https://your-frontend-url.run.app"
```

**OR** use Secret Manager (recommended for sensitive data):
```bash
# Create secrets
echo -n "r8_your_replicate_key" | gcloud secrets create replicate-api-token --data-file=-
echo -n "sk-your_openai_key" | gcloud secrets create openai-api-key --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding replicate-api-token \
  --member="serviceAccount:YOUR-PROJECT-NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service to use secrets
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --update-secrets="REPLICATE_API_TOKEN=replicate-api-token:latest,OPENAI_API_KEY=openai-api-key:latest"
```

### Step 3: Deploy Frontend

**First, set your Firebase config as environment variables:**

```bash
export NEXT_PUBLIC_FIREBASE_API_KEY="AIza***"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="jant-vid-pipe-fire.firebaseapp.com"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="jant-vid-pipe-fire"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="jant-vid-pipe-fire.firebasestorage.app"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="***"
export NEXT_PUBLIC_FIREBASE_APP_ID="1:***:web:***"
```

**Then deploy:**

```bash
# Use your backend URL from Step 1
./deploy-frontend.sh https://your-backend-url.run.app
```

**Get your frontend URL:**
```bash
gcloud run services describe jant-vid-pipe-frontend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --format 'value(status.url)'
```

### Step 4: Update Backend CORS

Now that you have your frontend URL, update the backend CORS:

```bash
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --update-env-vars="CORS_ORIGINS=https://your-frontend-url.run.app"
```

---

## ✅ Verification

### 1. Test Backend Health

```bash
curl https://your-backend-url.run.app/health
# Should return: {"status": "healthy"}
```

### 2. Test Firebase Auth

Visit your frontend URL and try to:
- ✅ Sign up with email/password (new user registration)
- ✅ Sign in with existing credentials
- ✅ Upload a brand/character/product asset
- ✅ Create a new project
- ✅ Generate backgrounds/moods
- ✅ Create scenes and storyboards

**All of these should work with Firebase Auth** - no Clerk dependencies!

### 3. Check Logs

```bash
# Backend logs
gcloud run logs tail jant-vid-pipe-backend --region us-central1

# Frontend logs
gcloud run logs tail jant-vid-pipe-frontend --region us-central1
```

### 4. Verify Firestore Data

Go to [Firestore Console](https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/data) and check:
- `projects/{projectId}` - User projects ✅
- `projects/{projectId}/scenes/{sceneId}` - Scene data ✅
- `projects/{projectId}/scene_assets/{assetId}` - Scene-specific assets ✅
- `brand_assets/{assetId}` - Brand uploads ✅
- `character_assets/{assetId}` - Character uploads ✅
- `product_assets/{assetId}` - Product uploads ✅
- `background_assets/{assetId}` - Generated backgrounds ✅
- `composite_jobs/{jobId}` - Composite generation jobs ✅
- `video_jobs/{jobId}` - Video generation jobs ✅
- `audio_jobs/{jobId}` - Audio generation jobs ✅

**Security:** All data should be scoped by `userId` - users can only see their own data.

---

## 🔧 Troubleshooting

### Issue: "Firebase Storage not configured"

**Solution:** Ensure `serviceAccountKey.json` is in `backend/` before building Docker image.

```bash
# Verify it's in the image:
docker run --rm your-image ls -la /app/serviceAccountKey.json
```

### Issue: "Permission denied" in Firestore

**Solution:** Deploy Firestore security rules:
```bash
firebase deploy --only firestore:rules
```

### Issue: CORS errors in frontend

**Solution:** Update backend CORS_ORIGINS:
```bash
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --update-env-vars="CORS_ORIGINS=https://your-frontend-url.run.app,https://another-domain.com"
```

### Issue: Assets not persisting

**Solution:** Verify Firestore indexes are built:
1. Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/indexes
2. Ensure `assets` indexes show green checkmarks ✅

### Issue: "Module not found" errors in frontend

**Solution:** Rebuild with correct Firebase env vars:
```bash
# Make sure ALL Firebase env vars are exported before building
./deploy-frontend.sh https://your-backend-url.run.app
```

---

## 🔄 Re-deploying After Changes

### Backend Changes:
```bash
./deploy-backend.sh
# No need to update env vars again unless they changed
```

### Frontend Changes:
```bash
# Set Firebase env vars first
export NEXT_PUBLIC_FIREBASE_API_KEY="..."
# ... (other vars)

./deploy-frontend.sh https://your-backend-url.run.app
```

---

## 💰 Cost Optimization

### Cloud Run Pricing

**Backend (2GB RAM, 2 CPU):**
- $0.00002400 per vCPU-second
- $0.00000250 per GiB-second
- ~$10-50/month for light usage

**Frontend (1GB RAM, 1 CPU):**
- $0.00001200 per vCPU-second
- $0.00000125 per GiB-second
- ~$5-20/month for light usage

### Reduce Costs:

1. **Set max instances:**
   ```bash
   gcloud run services update jant-vid-pipe-backend \
     --max-instances=5 \
     --region us-central1
   ```

2. **Set min instances to 0** (cold starts but cheaper):
   ```bash
   gcloud run services update jant-vid-pipe-backend \
     --min-instances=0 \
     --region us-central1
   ```

3. **Use Firestore in Native mode** (cheaper than Datastore mode)

4. **Monitor usage:**
   - https://console.cloud.google.com/run?project=jant-vid-pipe-fire

---

## 📚 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firebase Hosting](https://firebase.google.com/docs/hosting) (alternative for frontend)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)

---

## 🆘 Getting Help

If deployment fails:

1. Check logs: `gcloud run logs tail SERVICE_NAME --region us-central1`
2. Verify service account permissions
3. Ensure all environment variables are set
4. Check Firestore rules and indexes
5. Verify serviceAccountKey.json is present in backend

Need help? Check the error logs - they're usually very specific about what's wrong!

