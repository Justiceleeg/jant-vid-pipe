#!/bin/bash

# Deploy Frontend to Cloud Run using Firebase CLI
# Usage: ./deploy-frontend.sh [BACKEND_URL]

set -e

PROJECT="jant-vid-pipe-fire"
REGION="us-central1"
BACKEND_URL="${1}"

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Error: Backend URL is required"
    echo "Usage: ./deploy-frontend.sh https://your-backend-url.run.app"
    exit 1
fi

echo "================================================"
echo "Deploying Frontend to Cloud Run"
echo "================================================"
echo "Project: $PROJECT"
echo "Backend: $BACKEND_URL"
echo ""

cd "$(dirname "$0")/frontend"

if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "Configuring Docker for GCR..."
gcloud auth configure-docker

echo ""
echo "Building and pushing Docker image..."
IMAGE="gcr.io/$PROJECT/frontend:latest"

# Build with Clerk keys if provided via environment variables
# Set these before running: export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
# If not set, will use dummy values
CLERK_PUB_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-pk_test_dummy}"
CLERK_SECRET="${CLERK_SECRET_KEY:-sk_test_dummy}"

docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUB_KEY" \
  --build-arg CLERK_SECRET_KEY="$CLERK_SECRET" \
  -t "$IMAGE" .
docker push "$IMAGE"

echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy jant-vid-pipe-frontend \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,NEXT_PUBLIC_API_URL=$BACKEND_URL" \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 5 \
  --port 3000

echo ""
echo "================================================"
echo "✅ Frontend Deployed Successfully!"
echo "================================================"
echo ""
echo "Get your frontend URL:"
echo "  gcloud run services describe jant-vid-pipe-frontend --region $REGION --project $PROJECT --format 'value(status.url)'"
echo ""
echo "Or visit: https://console.cloud.google.com/run?project=$PROJECT"
echo ""
echo "⚠️  Remember to update backend CORS_ORIGINS with your frontend URL!"
echo ""
