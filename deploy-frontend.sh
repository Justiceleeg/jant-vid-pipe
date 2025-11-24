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

# Build with Firebase configuration
# Set these environment variables before running:
#   export NEXT_PUBLIC_FIREBASE_API_KEY="..."
#   export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
#   export NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
#   export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
#   export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
#   export NEXT_PUBLIC_FIREBASE_APP_ID="..."

# Verify required Firebase env vars are set
if [ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ]; then
    echo "❌ Error: NEXT_PUBLIC_FIREBASE_API_KEY is required"
    echo "Set Firebase environment variables before deploying. See DEPLOYMENT_GUIDE.md"
    exit 1
fi

docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID" \
  --build-arg NEXT_PUBLIC_API_URL="$BACKEND_URL" \
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
FRONTEND_URL=$(gcloud run services describe jant-vid-pipe-frontend --region $REGION --project $PROJECT --format 'value(status.url)')
echo "  $FRONTEND_URL"
echo ""
echo "Or visit: https://console.cloud.google.com/run?project=$PROJECT"
echo ""
echo "⚠️  FINAL STEP - Update backend CORS:"
echo "   gcloud run services update jant-vid-pipe-backend \\"
echo "     --region $REGION \\"
echo "     --update-env-vars=\"CORS_ORIGINS=$FRONTEND_URL\""
echo ""
echo "🎉 Deployment complete! Test your app at: $FRONTEND_URL"
echo ""