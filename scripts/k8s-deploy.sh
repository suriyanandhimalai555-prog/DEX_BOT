#!/bin/bash

set -e

NAMESPACE="dexbot"

BACKEND_DEPLOYMENT="dex-backend"
FRONTEND_DEPLOYMENT="dex-frontend"
WORKER_DEPLOYMENT="dex-worker"

REPO="ghcr.io/suriyanandhimalai555-prog"

###################################
# Image Tag
###################################

IMAGE_TAG="$1"

if [ -z "$IMAGE_TAG" ]; then
    echo "ERROR: No image tag supplied."
    echo "Usage:"
    echo "./scripts/k8s-deploy.sh <commit-sha>"
    exit 1
fi

echo "================================="
echo "Deploying Image Tag: $IMAGE_TAG"
echo "================================="

BACKEND_IMAGE="${REPO}/dex-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${REPO}/dex-frontend:${IMAGE_TAG}"

###################################
# Wait until GHCR image exists
###################################

echo ""
echo "Waiting for GHCR images..."

for i in {1..30}
do
    if docker manifest inspect "$BACKEND_IMAGE" >/dev/null 2>&1 &&
       docker manifest inspect "$FRONTEND_IMAGE" >/dev/null 2>&1
    then
        echo "Images available."
        break
    fi

    echo "Waiting... ($i/30)"
    sleep 10
done

###################################
# Frontend
###################################

kubectl set image deployment/$FRONTEND_DEPLOYMENT \
dex-frontend=$FRONTEND_IMAGE \
-n $NAMESPACE

###################################
# Backend
###################################

kubectl set image deployment/$BACKEND_DEPLOYMENT \
dex-backend=$BACKEND_IMAGE \
-n $NAMESPACE

###################################
# Worker
###################################

kubectl set image deployment/$WORKER_DEPLOYMENT \
dex-worker=$BACKEND_IMAGE \
-n $NAMESPACE

###################################
# Rollout
###################################

kubectl rollout status deployment/$FRONTEND_DEPLOYMENT -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/$BACKEND_DEPLOYMENT -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/$WORKER_DEPLOYMENT -n $NAMESPACE --timeout=300s

echo ""
echo "Deployment Successful"

kubectl get pods -n $NAMESPACE
