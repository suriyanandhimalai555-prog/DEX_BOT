#!/bin/bash

set -e

NAMESPACE=dexbot


echo "========== Updating Frontend =========="

kubectl set image deployment/dex-frontend \
dex-frontend=ghcr.io/suriyanandhimalai555-prog/dex-frontend:latest \
-n $NAMESPACE


echo "========== Updating Backend =========="

kubectl set image deployment/dex-backend \
dex-backend=ghcr.io/suriyanandhimalai555-prog/dex-backend:latest \
-n $NAMESPACE


echo "========== Updating Worker =========="

kubectl set image deployment/dex-worker \
dex-worker=ghcr.io/suriyanandhimalai555-prog/dex-backend:latest \
-n $NAMESPACE



echo "========== Waiting Frontend =========="

kubectl rollout status deployment/dex-frontend \
-n $NAMESPACE \
--timeout=120s


echo "========== Waiting Backend =========="

kubectl rollout status deployment/dex-backend \
-n $NAMESPACE \
--timeout=120s


echo "========== Waiting Worker =========="

kubectl rollout status deployment/dex-worker \
-n $NAMESPACE \
--timeout=120s



echo "========== Current Pods =========="

kubectl get pods -n $NAMESPACE


echo "========== Deployment Successful =========="
