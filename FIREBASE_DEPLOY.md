# Firebase Cloud Run Deployment Guide

## ✅ You're All Set!

You already have:
- ✅ Firebase CLI installed
- ✅ Project selected: `jant-vid-pipe-fire`

## 🚀 Quick Start Deployment

### Step 1: Install gcloud CLI (One-time setup)

Firebase CLI uses `gcloud` under the hood for Cloud Run. Quick install:

```bash
# Install gcloud
curl https://sdk.cloud.google.com | bash

# Restart your shell
exec -l $SHELL

# Initialize and authenticate
gcloud init

# Select project: jant-vid-pipe-fire
# Select region: us-central1
```

### Step 2: Enable Required APIs

```bash
firebase projects:list
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 3: Deploy Backend

```bash
./deploy-backend.sh
```

This will:
1. Build the Docker image
2. Push to Google Container Registry
3. Deploy to Cloud Run
4. Give you the backend URL

### Step 4: Set Backend Environment Variables

Go to Cloud Run console:
https://console.cloud.google.com/run?project=jant-vid-pipe-fire

1. Click on `jant-vid-pipe-backend` service
2. Click "Edit & Deploy New Revision"
3. Under "Variables & Secrets", add:

```
ENVIRONMENT=production
REPLICATE_API_TOKEN=your_replicate_token_here
OPENAI_API_KEY=your_openai_key_here
IMGBB_API_KEY=your_imgbb_key_here
API_BASE_URL=https://[your-backend-url].run.app
CORS_ORIGINS=http://localhost:3000
```

(We'll update CORS_ORIGINS with the real frontend URL in Step 7)

### Step 5: Test Backend

```bash
# Get your backend URL
gcloud run services describe jant-vid-pipe-backend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --format 'value(status.url)'

# Test it
curl [YOUR-BACKEND-URL]/health
# Should return: {"status":"healthy"}
```

### Step 6: Deploy Frontend

```bash
./deploy-frontend.sh https://[YOUR-BACKEND-URL].run.app
```

Replace `[YOUR-BACKEND-URL]` with the URL from Step 5.

### Step 7: Update Backend CORS

```bash
# Get your frontend URL
gcloud run services describe jant-vid-pipe-frontend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --format 'value(status.url)'

# Update backend CORS
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --project jant-vid-pipe-fire \
  --update-env-vars CORS_ORIGINS=https://[YOUR-FRONTEND-URL].run.app
```

### Step 8: Test Everything!

Open your frontend URL in a browser and test:
- ✓ Homepage loads
- ✓ Can create a project
- ✓ Can upload images (will use ImgBB)
- ✓ Can generate scenes with Replicate

---

## 📋 Environment Variables Reference

### Backend Required Variables

| Variable | Where to Get It | Required? |
|----------|----------------|-----------|
| `REPLICATE_API_TOKEN` | https://replicate.com/account/api-tokens | ✅ Yes |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | ✅ Yes |
| `IMGBB_API_KEY` | https://api.imgbb.com/ (free) | ✅ Yes |
| `API_BASE_URL` | Your backend Cloud Run URL | ✅ Yes |
| `CORS_ORIGINS` | Your frontend Cloud Run URL | ✅ Yes |
| `ENVIRONMENT` | Set to `production` | ✅ Yes |

### Frontend Optional Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | If using Clerk auth |
| `CLERK_SECRET_KEY` | If using Clerk auth |

---

## 🔍 Troubleshooting

### "gcloud: command not found"

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### "Docker is not running"

Start Docker Desktop and try again.

### "permission denied" when pushing to GCR

```bash
gcloud auth configure-docker
```

### CORS errors in browser

Make sure you updated backend `CORS_ORIGINS` with your frontend URL (Step 7).

### Images not loading

1. Check ImgBB API key is set in backend
2. Verify `NEXT_PUBLIC_API_URL` in frontend points to backend
3. Check browser console for errors

### Get Logs

```bash
# Backend logs
gcloud run logs tail jant-vid-pipe-backend \
  --project jant-vid-pipe-fire \
  --region us-central1

# Frontend logs  
gcloud run logs tail jant-vid-pipe-frontend \
  --project jant-vid-pipe-fire \
  --region us-central1
```

---

## 💰 Cost Estimate

With scale-to-zero enabled:
- **Idle**: $0/month
- **Light use** (10K requests): ~$5/month
- **Medium use** (100K requests): ~$30/month

---

## 🔄 Redeploying Updates

```bash
# Backend only
./deploy-backend.sh

# Frontend only (use your backend URL)
./deploy-frontend.sh https://[backend-url].run.app

# Both
./deploy-backend.sh
./deploy-frontend.sh https://[backend-url].run.app
```

---

## 📝 Quick Command Reference

```bash
# View all services
gcloud run services list --project jant-vid-pipe-fire

# Get service URL
gcloud run services describe SERVICE_NAME \
  --project jant-vid-pipe-fire \
  --region us-central1 \
  --format 'value(status.url)'

# Update environment variable
gcloud run services update SERVICE_NAME \
  --project jant-vid-pipe-fire \
  --region us-central1 \
  --update-env-vars KEY=value

# View logs
gcloud run logs tail SERVICE_NAME \
  --project jant-vid-pipe-fire \
  --region us-central1
```

---

## ✅ Post-Deployment Checklist

- [ ] Backend deployed and healthy (`/health` endpoint works)
- [ ] Backend environment variables set
- [ ] Frontend deployed and accessible
- [ ] Frontend can reach backend (check Network tab)
- [ ] CORS configured correctly
- [ ] Images upload to ImgBB
- [ ] Replicate image generation works
- [ ] OpenAI chat works (if using)

---

**You're ready to deploy!** 🚀

Just run:
1. `./deploy-backend.sh`
2. Set environment variables in Cloud Console
3. `./deploy-frontend.sh https://your-backend-url.run.app`
4. Update CORS
5. Test!

