#!/bin/bash
# TrafficAI – Multi-Region GCP Deployment Script
# Usage: ./deploy.sh [PROJECT_ID]

set -euo pipefail

PROJECT_ID="${1:-mineral-liberty-490805-r0}"
REGIONS=("us-central1" "europe-west1" "asia-south1")
IMAGE="gcr.io/$PROJECT_ID/trafficai-api:latest"

echo "======================================================"
echo " TrafficAI – Multi-Region Deployment"
echo " Project: $PROJECT_ID"
echo "======================================================"

# 1. Build & push Docker image
echo "[1/4] Building Docker image..."
gcloud builds submit --tag "$IMAGE" ./backend --quiet

# 2. Deploy Cloud Run to all regions
echo "[2/4] Deploying Cloud Run API to ${#REGIONS[@]} regions..."
for REGION in "${REGIONS[@]}"; do
  echo "  → Deploying to $REGION..."
  gcloud run deploy trafficai-api \
    --image="$IMAGE" \
    --region="$REGION" \
    --platform=managed \
    --min-instances=1 \
    --max-instances=50 \
    --cpu=2 --memory=2Gi \
    --concurrency=200 \
    --allow-unauthenticated \
    --set-env-vars="GCP_PROJECT=$PROJECT_ID" \
    --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
    --quiet
  echo "  ✓ $REGION done"
done

# 3. Deploy frontend to App Engine
echo "[3/4] Deploying frontend to App Engine..."
gcloud app deploy --quiet

# 4. Print live URLs
echo ""
echo "======================================================"
echo " ✅ Deployment Complete!"
echo "======================================================"
echo " Frontend: https://$PROJECT_ID.uc.r.appspot.com"
for REGION in "${REGIONS[@]}"; do
  echo " API ($REGION): $(gcloud run services describe trafficai-api \
    --region=$REGION --format='value(status.url)' 2>/dev/null || echo 'pending')"
done
echo "======================================================"
echo " To view logs: gcloud app logs tail --service=default"
echo " To view map: https://$PROJECT_ID.uc.r.appspot.com/map.html"
echo "======================================================"
