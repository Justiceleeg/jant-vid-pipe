#!/bin/bash

# Deploy Backend to Cloud Run using Firebase CLI
# Usage: ./deploy-backend.sh

set -e

PROJECT="jant-vid-pipe-fire"
REGION="us-central1"

echo "================================================"
echo "Deploying Backend to Cloud Run"
echo "================================================"
echo "Project: $PROJECT"
echo ""

cd "$(dirname "$0")/backend"

# Firebase CLI can use gcloud under the hood for Cloud Run
# First, authenticate with gcloud if needed
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "Configuring Docker for GCR..."
gcloud auth configure-docker

echo ""
echo "Building and pushing Docker image..."
IMAGE="gcr.io/$PROJECT/backend:latest"
docker build --platform linux/amd64 -t "$IMAGE" .
docker push "$IMAGE"

echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy jant-vid-pipe-backend \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --port 8080

echo ""
echo "================================================"
echo "✅ Backend Deployed Successfully!"
echo "================================================"
echo ""
echo "Get your backend URL:"
BACKEND_URL=$(gcloud run services describe jant-vid-pipe-backend --region $REGION --project $PROJECT --format 'value(status.url)')
echo "  $BACKEND_URL"
echo ""
echo "Or visit: https://console.cloud.google.com/run?project=$PROJECT"
echo ""
echo "⚠️  NEXT STEPS:"
echo "1. Set environment variables (see DEPLOYMENT_GUIDE.md):"
echo "   gcloud run services update jant-vid-pipe-backend \\"
echo "     --region $REGION \\"
echo "     --set-env-vars=\"REPLICATE_API_TOKEN=***,OPENAI_API_KEY=***,FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app,API_BASE_URL=$BACKEND_URL,CORS_ORIGINS=https://your-frontend-url\""
echo ""
echo "2. Deploy frontend with this backend URL:"
echo "   ./deploy-frontend.sh $BACKEND_URL"
echo ""