# Cloud Run Deployment Guide

This guide walks you through deploying the Jant Video Pipeline application to Google Cloud Run.

## 🎯 Overview

The application consists of two services:
- **Backend**: FastAPI application (Python)
- **Frontend**: Next.js application (Node.js)

Both are deployed as containers to Google Cloud Run.

## 📋 Prerequisites

### 1. Install Google Cloud SDK

```bash
# macOS
brew install --cask google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud auth application-default login
```

### 3. Create or Select a Google Cloud Project

```bash
# Create new project
gcloud projects create YOUR-PROJECT-ID --name="Jant Video Pipeline"

# Or list existing projects
gcloud projects list

# Set active project
gcloud config set project YOUR-PROJECT-ID
```

### 4. Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 5. Set Up Billing

Ensure billing is enabled for your project:
https://console.cloud.google.com/billing

## 🔑 Environment Variables

### Backend Environment Variables

Set these in Cloud Run after deployment:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ENVIRONMENT` | Yes | Environment mode | `production` |
| `REPLICATE_API_TOKEN` | Yes | Replicate API key | `r8_xxx...` |
| `OPENAI_API_KEY` | Yes | OpenAI API key | `sk-xxx...` |
| `IMGBB_API_KEY` | Yes | ImgBB API key | `xxx...` |
| `CORS_ORIGINS` | Yes | Frontend URL | `https://your-frontend-hash.run.app` |
| `API_BASE_URL` | Yes | Backend URL | `https://your-backend-hash.run.app` |

### Frontend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Node environment | `production` |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL | `https://your-backend-hash.run.app` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional | Clerk auth key | `pk_xxx...` |
| `CLERK_SECRET_KEY` | Optional | Clerk secret | `sk_xxx...` |

## 🚀 Deployment Steps

### Step 1: Deploy Backend

```bash
# Run the deployment script
./deploy-backend.sh YOUR-PROJECT-ID us-central1

# Or manually:
cd backend
gcloud run deploy jant-vid-pipe-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --port 8080
```

### Step 2: Get Backend URL

```bash
gcloud run services describe jant-vid-pipe-backend \
  --region us-central1 \
  --format 'value(status.url)'
```

Save this URL - you'll need it for:
- Frontend configuration
- Backend `API_BASE_URL` variable

### Step 3: Set Backend Environment Variables

```bash
# Using gcloud CLI
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --set-env-vars \
ENVIRONMENT=production,\
REPLICATE_API_TOKEN=your_replicate_token,\
OPENAI_API_KEY=your_openai_key,\
IMGBB_API_KEY=your_imgbb_key,\
API_BASE_URL=https://your-backend-hash.run.app

# Or use Cloud Console: 
# https://console.cloud.google.com/run
```

### Step 4: Deploy Frontend

```bash
# Get the backend URL from Step 2
BACKEND_URL="https://your-backend-hash.run.app"

# Run the deployment script
./deploy-frontend.sh YOUR-PROJECT-ID us-central1 $BACKEND_URL

# Or manually:
cd frontend
gcloud run deploy jant-vid-pipe-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,NEXT_PUBLIC_API_URL=$BACKEND_URL \
  --min-instances 0 \
  --max-instances 5 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 60 \
  --port 3000
```

### Step 5: Get Frontend URL

```bash
gcloud run services describe jant-vid-pipe-frontend \
  --region us-central1 \
  --format 'value(status.url)'
```

### Step 6: Update Backend CORS

Now that you have the frontend URL, update the backend CORS settings:

```bash
FRONTEND_URL="https://your-frontend-hash.run.app"

gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --update-env-vars CORS_ORIGINS=$FRONTEND_URL
```

## ✅ Verification

### 1. Test Backend

```bash
curl https://your-backend-hash.run.app/health
# Should return: {"status":"healthy"}
```

### 2. Test Frontend

Open your frontend URL in a browser:
```
https://your-frontend-hash.run.app
```

### 3. Check Logs

```bash
# Backend logs
gcloud run logs tail jant-vid-pipe-backend --region us-central1

# Frontend logs
gcloud run logs tail jant-vid-pipe-frontend --region us-central1
```

## 🔄 Redeployment

To redeploy after code changes:

```bash
# Backend
./deploy-backend.sh YOUR-PROJECT-ID us-central1

# Frontend
./deploy-frontend.sh YOUR-PROJECT-ID us-central1 YOUR-BACKEND-URL
```

## 💰 Cost Optimization

### Current Configuration

| Service | Min Instances | Max Instances | Memory | CPU |
|---------|--------------|---------------|--------|-----|
| Backend | 0 | 10 | 2Gi | 2 |
| Frontend | 0 | 5 | 1Gi | 1 |

### Cost Estimates (approximate)

- **Idle**: $0/month (scales to zero)
- **Light usage** (10,000 requests/month): ~$5-10/month
- **Medium usage** (100,000 requests/month): ~$30-50/month

Cloud Run pricing: https://cloud.google.com/run/pricing

### Reduce Costs

```bash
# Lower backend resources for development
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 3
```

## 🔒 Security Best Practices

### 1. Use Secret Manager (Recommended)

Instead of environment variables, use Google Secret Manager:

```bash
# Create secrets
echo -n "your_replicate_token" | gcloud secrets create replicate-api-token --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding replicate-api-token \
  --member="serviceAccount:YOUR-PROJECT-NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service to use secret
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --set-secrets=REPLICATE_API_TOKEN=replicate-api-token:latest
```

### 2. Enable VPC Connector (Optional)

For private database access or internal services:

```bash
# Create VPC connector
gcloud compute networks vpc-access connectors create jant-connector \
  --region us-central1 \
  --range 10.8.0.0/28

# Update service
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --vpc-connector jant-connector
```

## 🐛 Troubleshooting

### Issue: Backend not responding

```bash
# Check logs
gcloud run logs tail jant-vid-pipe-backend --region us-central1

# Common issues:
# - Missing environment variables
# - Port mismatch (ensure PORT=8080)
# - Memory/CPU limits too low
```

### Issue: CORS errors

```bash
# Verify CORS_ORIGINS is set correctly
gcloud run services describe jant-vid-pipe-backend \
  --region us-central1 \
  --format 'value(spec.template.spec.containers[0].env)'

# Update CORS_ORIGINS
gcloud run services update jant-vid-pipe-backend \
  --region us-central1 \
  --update-env-vars CORS_ORIGINS=https://your-frontend-url.run.app
```

### Issue: Frontend build fails

```bash
# Check if all dependencies are in package.json
# Ensure standalone output is enabled in next.config.ts

# Try local Docker build first:
cd frontend
docker build -t test-frontend .
docker run -p 3000:3000 test-frontend
```

### Issue: Images not loading

- Ensure `NEXT_PUBLIC_API_URL` points to backend
- Check that ImgBB API key is set in backend
- Verify image remote patterns in `next.config.ts`

## 🔄 Local Testing with Docker

### Test Backend Locally

```bash
cd backend
docker build -t jant-backend .
docker run -p 8080:8080 \
  -e REPLICATE_API_TOKEN=your_token \
  -e OPENAI_API_KEY=your_key \
  -e IMGBB_API_KEY=your_key \
  jant-backend
```

### Test Frontend Locally

```bash
cd frontend
docker build -t jant-frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8080 \
  jant-frontend
```

## 📊 Monitoring

### View Metrics

Cloud Run Console: https://console.cloud.google.com/run

Metrics available:
- Request count
- Request latency
- Instance count
- Memory usage
- CPU usage
- Error rate

### Set Up Alerts

```bash
# Example: Alert on high error rate
# Configure in Cloud Console > Monitoring > Alerting
```

## 🔗 Useful Links

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Cloud Build](https://cloud.google.com/build/docs)

## 📝 Notes

- **In-Memory Database**: The backend uses an in-memory database that resets on each deployment/restart. This is acknowledged and will be replaced with Firestore in the future.
- **Modal Integration**: NeRF functionality is currently disabled.
- **ImgBB**: All user uploads are stored on ImgBB. Ensure you have a valid API key.
- **Cold Starts**: First request after idle may take 5-10 seconds due to cold start. Consider setting `--min-instances 1` for production.

## 🆘 Support

For issues or questions:
1. Check logs: `gcloud run logs tail SERVICE_NAME`
2. Review environment variables
3. Verify API keys are valid
4. Check Cloud Run quotas and billing

---

Last updated: November 2025

