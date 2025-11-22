# Complete Deployment Guide - What Actually Worked

This is the real-world deployment guide with all the issues we encountered and how to fix them.

## 🎯 Your Project

- **Firebase Project:** `jant-vid-pipe-fire`
- **Backend URL:** https://jant-vid-pipe-backend-1018725040008.us-central1.run.app
- **Frontend URL:** https://jant-vid-pipe-frontend-hi3trfseeq-uc.a.run.app

---

## 📋 Prerequisites

1. **Docker Desktop** - Must be running
2. **gcloud CLI** - Install: `curl https://sdk.cloud.google.com | bash`
3. **Firebase CLI** - You already have this
4. **API Keys:**
   - Replicate: https://replicate.com/account/api-tokens
   - OpenAI: https://platform.openai.com/api-keys
   - ImgBB: https://api.imgbb.com/
   - Clerk (dev keys): https://dashboard.clerk.com/

---

## 🚀 Step-by-Step Deployment

### 1. Deploy Backend

```bash
# Make sure Docker is running first!
./deploy-backend.sh
```

**What happens:**
- Builds Docker image for AMD64 (important for Apple Silicon Macs)
- Pushes to Google Container Registry
- Deploys to Cloud Run

**Expected output:**
```
Service URL: https://jant-vid-pipe-backend-XXXXX.us-central1.run.app
```

### 2. Make Backend Publicly Accessible

The deployment might fail to set IAM policy. Fix it via Cloud Console:

1. Go to: https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-backend/security?project=jant-vid-pipe-fire
2. Click "Security" tab
3. Check ✅ "Allow unauthenticated invocations"
4. Click "Save"

**Test it:**
```bash
curl https://jant-vid-pipe-backend-1018725040008.us-central1.run.app/health
# Should return: {"status":"healthy"}
```

### 3. Set Backend Environment Variables

Go to: https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-backend/variables?project=jant-vid-pipe-fire

Click "Edit & Deploy New Revision" → Add these variables:

```
ENVIRONMENT=production
REPLICATE_API_TOKEN=r8_your_token
OPENAI_API_KEY=sk-your_key
IMGBB_API_KEY=your_imgbb_key
API_BASE_URL=https://jant-vid-pipe-backend-1018725040008.us-central1.run.app
CORS_ORIGINS=http://localhost:3000
```

(We'll update CORS_ORIGINS after frontend deployment)

Click "Deploy" and wait ~1 minute.

### 4. Deploy Frontend

```bash
# Set Clerk keys as environment variables first
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
export CLERK_SECRET_KEY=sk_test_your_secret

# Deploy
./deploy-frontend.sh https://jant-vid-pipe-backend-1018725040008.us-central1.run.app
```

**What happens:**
- Builds Docker image with Clerk keys (needed for build)
- Pushes to Google Container Registry
- Deploys to Cloud Run with `NEXT_PUBLIC_API_URL` set

### 5. Make Frontend Publicly Accessible

Same as backend:

1. Go to: https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-frontend/security?project=jant-vid-pipe-fire
2. Click "Security" tab
3. Check ✅ "Allow unauthenticated invocations"
4. Click "Save"

### 6. Set Frontend Environment Variables

**CRITICAL:** Every time you redeploy, you need to add these back!

Go to: https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-frontend/variables?project=jant-vid-pipe-fire

Click "Edit & Deploy New Revision" → Add:

```
CLERK_SECRET_KEY=sk_test_your_secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
NEXT_PUBLIC_API_URL=https://jant-vid-pipe-backend-1018725040008.us-central1.run.app
```

Click "Deploy" and wait ~1 minute.

### 7. Update Backend CORS

Go to: https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-backend/variables?project=jant-vid-pipe-fire

Click "Edit & Deploy New Revision" → Find `CORS_ORIGINS` and update to:

```
http://localhost:3000,https://jant-vid-pipe-frontend-hi3trfseeq-uc.a.run.app
```

Click "Deploy" and wait ~1 minute.

### 8. Configure Clerk Dashboard

**Required for authentication to work:**

1. Go to https://dashboard.clerk.com/
2. Select your application

**Add Domain:**
- Go to "Domains" (left sidebar)
- Add: `jant-vid-pipe-frontend-hi3trfseeq-uc.a.run.app`

**Set Paths:**
- Go to "Paths" (left sidebar)
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/projects`
- After sign-up URL: `/projects`

**Email Settings (Development):**
- Go to "Email, Phone, Username"
- Under "Email address" → Settings
- Set verification to "Off" or "Optional" for testing
- Save

**Account Portal:**
- Look for settings about "Custom Pages" vs "Clerk-hosted pages"
- Make sure "Application" or "Custom pages" is selected
- This ensures your custom sign-in page is used

---

## ✅ Testing Checklist

- [ ] Backend health check works: `curl [backend-url]/health`
- [ ] Frontend homepage loads: https://jant-vid-pipe-frontend-hi3trfseeq-uc.a.run.app
- [ ] Going to `/` redirects to custom `/sign-in` page (not Clerk's hosted page)
- [ ] Can sign up with email/password
- [ ] Can sign in
- [ ] After sign-in, redirects to `/projects`
- [ ] Can create a new project
- [ ] Can upload brand/character assets (saves to ImgBB)
- [ ] Can generate scenes with Replicate

---

## 🔧 Common Issues & Fixes

### Issue: "Docker is not running"
**Fix:** Start Docker Desktop and wait for it to fully start.

### Issue: "Bad syntax for dict arg" with gcloud
**Fix:** Use Cloud Console instead. The GUI is easier for setting env vars with special characters.

### Issue: 403 Forbidden
**Fix:** Enable "Allow unauthenticated invocations" in Cloud Run Security settings.

### Issue: Internal Server Error / Missing Clerk Keys
**Fix:** Add `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to frontend environment variables in Cloud Run.

### Issue: CORS errors in browser console
**Fix:** Update backend `CORS_ORIGINS` to include your frontend URL.

### Issue: Redirects to Clerk's hosted sign-in page
**Fix:** 
1. Check Clerk Dashboard → Paths are set correctly
2. Check Clerk Dashboard → "Custom pages" is enabled
3. Redeploy frontend after middleware fix

### Issue: "Email verification required" but you disabled it
**Fix:** 
1. Check Clerk Dashboard → Email settings
2. Make sure verification is "Off" or "Optional"
3. May need to create a new test user

### Issue: Env vars disappear after redeployment
**Fix:** Always re-add environment variables after running deployment scripts. They don't persist automatically.

---

## 🔄 Redeployment Process

When you update code:

**Backend:**
```bash
./deploy-backend.sh
# Environment variables persist ✅
```

**Frontend:**
```bash
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
export CLERK_SECRET_KEY=sk_test_your_secret
./deploy-frontend.sh https://jant-vid-pipe-backend-1018725040008.us-central1.run.app

# Then re-add env vars in Cloud Console! ⚠️
# https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-frontend/variables
```

---

## 📊 Monitoring

**View Logs:**
```bash
# Backend
gcloud run services logs read jant-vid-pipe-backend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --limit 50

# Frontend
gcloud run services logs read jant-vid-pipe-frontend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --limit 50
```

**Or use Cloud Console (easier):**
- Backend: https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-backend/logs?project=jant-vid-pipe-fire
- Frontend: https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-frontend/logs?project=jant-vid-pipe-fire

---

## 💡 Important Notes

1. **In-Memory Database:** Data resets on every backend restart/redeploy
2. **File Storage:** All images stored on ImgBB (not locally)
3. **NeRF Disabled:** All `/api/nerf/*` and `/api/upload/*` endpoints return 501
4. **Apple Silicon:** Docker builds use `--platform linux/amd64` flag
5. **Clerk Keys:** Need to be set both during build (as export) AND runtime (in Cloud Run)
6. **CORS:** Must include both localhost and production frontend URL

---

## 🆘 Quick Links

- **Cloud Run Services:** https://console.cloud.google.com/run?project=jant-vid-pipe-fire
- **Clerk Dashboard:** https://dashboard.clerk.com/
- **Backend Env Vars:** https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-backend/variables?project=jant-vid-pipe-fire
- **Frontend Env Vars:** https://console.cloud.google.com/run/detail/us-central1/jant-vid-pipe-frontend/variables?project=jant-vid-pipe-fire
- **Backend URL:** https://jant-vid-pipe-backend-1018725040008.us-central1.run.app
- **Frontend URL:** https://jant-vid-pipe-frontend-hi3trfseeq-uc.a.run.app

---

**Last Updated:** November 22, 2025
**Status:** ✅ Deployed and Working

