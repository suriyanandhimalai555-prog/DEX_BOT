#!/bin/bash

set -Eeuo pipefail

NAMESPACE="dexbot"

BACKEND_DEPLOYMENT="dex-backend"
FRONTEND_DEPLOYMENT="dex-frontend"

REPO="ghcr.io/suriyanandhimalai555-prog"

IMAGE_TAG="${1:-}"

if [[ -z "$IMAGE_TAG" ]]; then
    echo "ERROR: No image tag supplied."
    echo "Usage: ./scripts/k8s-deploy.sh <commit-sha>"
    exit 1
fi

BACKEND_IMAGE="${REPO}/dex-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${REPO}/dex-frontend:${IMAGE_TAG}"

echo "=============================================="
echo "DEX BOT ZERO-DOWNTIME DEPLOYMENT"
echo "=============================================="
echo "Namespace : $NAMESPACE"
echo "Commit    : $IMAGE_TAG"
echo "Backend   : $BACKEND_IMAGE"
echo "Frontend  : $FRONTEND_IMAGE"
echo "=============================================="

echo
echo "========== VERIFY KUBERNETES =========="

kubectl get namespace "$NAMESPACE" >/dev/null

kubectl get deployment "$BACKEND_DEPLOYMENT" -n "$NAMESPACE" >/dev/null
kubectl get deployment "$FRONTEND_DEPLOYMENT" -n "$NAMESPACE" >/dev/null

echo "DEX BOT frontend/backend resources found."

echo
echo "========== SAVE CURRENT IMAGES =========="

OLD_FRONTEND_IMAGE="$(
    kubectl get deployment "$FRONTEND_DEPLOYMENT" \
        -n "$NAMESPACE" \
        -o jsonpath='{.spec.template.spec.containers[?(@.name=="dex-frontend")].image}'
)"

OLD_BACKEND_IMAGE="$(
    kubectl get deployment "$BACKEND_DEPLOYMENT" \
        -n "$NAMESPACE" \
        -o jsonpath='{.spec.template.spec.containers[?(@.name=="dex-backend")].image}'
)"

if [[ -z "$OLD_FRONTEND_IMAGE" || -z "$OLD_BACKEND_IMAGE" ]]; then
    echo "ERROR: Could not determine currently running images."
    echo "Deployment cancelled before making changes."
    exit 1
fi

echo "Previous frontend: $OLD_FRONTEND_IMAGE"
echo "Previous backend : $OLD_BACKEND_IMAGE"

ROLLBACK_REQUIRED=false

rollback() {
    echo
    echo "=============================================="
    echo "DEPLOYMENT FAILED"
    echo "ROLLING BACK DEX BOT FRONTEND/BACKEND"
    echo "=============================================="

    set +e

    echo
    echo "========== RESTORE FRONTEND =========="

    kubectl set image deployment/"$FRONTEND_DEPLOYMENT" \
        dex-frontend="$OLD_FRONTEND_IMAGE" \
        -n "$NAMESPACE"

    echo
    echo "========== RESTORE BACKEND =========="

    kubectl set image deployment/"$BACKEND_DEPLOYMENT" \
        dex-backend="$OLD_BACKEND_IMAGE" \
        -n "$NAMESPACE"

    echo
    echo "========== WAIT FOR FRONTEND ROLLBACK =========="

    kubectl rollout status deployment/"$FRONTEND_DEPLOYMENT" \
        -n "$NAMESPACE" \
        --timeout=300s

    echo
    echo "========== WAIT FOR BACKEND ROLLBACK =========="

    kubectl rollout status deployment/"$BACKEND_DEPLOYMENT" \
        -n "$NAMESPACE" \
        --timeout=300s

    echo
    echo "========== PODS AFTER ROLLBACK =========="

    kubectl get pods -n "$NAMESPACE" -o wide

    echo
    echo "========== IMAGES AFTER ROLLBACK =========="

    kubectl get deployment "$FRONTEND_DEPLOYMENT" \
        -n "$NAMESPACE" \
        -o jsonpath='Frontend: {.spec.template.spec.containers[?(@.name=="dex-frontend")].image}{"\n"}'

    kubectl get deployment "$BACKEND_DEPLOYMENT" \
        -n "$NAMESPACE" \
        -o jsonpath='Backend: {.spec.template.spec.containers[?(@.name=="dex-backend")].image}{"\n"}'

    echo
    echo "Rollback completed."

    set -e
}

deployment_failed() {
    local exit_code=$?

    echo
    echo "ERROR: Deployment command failed with exit code $exit_code"

    if [[ "$ROLLBACK_REQUIRED" == "true" ]]; then
        rollback
    fi

    exit "$exit_code"
}

trap deployment_failed ERR

echo
echo "========== FRONTEND DEPLOYMENT =========="

ROLLBACK_REQUIRED=true

kubectl set image deployment/"$FRONTEND_DEPLOYMENT" \
    dex-frontend="$FRONTEND_IMAGE" \
    -n "$NAMESPACE"

echo
echo "Waiting for frontend to become Ready..."

kubectl rollout status deployment/"$FRONTEND_DEPLOYMENT" \
    -n "$NAMESPACE" \
    --timeout=300s

echo "Frontend rollout completed successfully."

echo
echo "========== BACKEND DEPLOYMENT =========="

kubectl set image deployment/"$BACKEND_DEPLOYMENT" \
    dex-backend="$BACKEND_IMAGE" \
    -n "$NAMESPACE"

echo
echo "Waiting for backend to become Ready..."

kubectl rollout status deployment/"$BACKEND_DEPLOYMENT" \
    -n "$NAMESPACE" \
    --timeout=300s

echo "Backend rollout completed successfully."

ROLLBACK_REQUIRED=false

echo
echo "=============================================="
echo "DEX BOT DEPLOYMENT SUCCESSFUL"
echo "=============================================="

echo
echo "========== DEPLOYMENTS =========="

kubectl get deployments -n "$NAMESPACE"

echo
echo "========== PODS =========="

kubectl get pods -n "$NAMESPACE" -o wide

echo
echo "========== RUNNING IMAGES =========="

kubectl get deployment "$FRONTEND_DEPLOYMENT" \
    -n "$NAMESPACE" \
    -o jsonpath='Frontend: {.spec.template.spec.containers[?(@.name=="dex-frontend")].image}{"\n"}'

kubectl get deployment "$BACKEND_DEPLOYMENT" \
    -n "$NAMESPACE" \
    -o jsonpath='Backend: {.spec.template.spec.containers[?(@.name=="dex-backend")].image}{"\n"}'

echo
echo "Deployment completed successfully."
