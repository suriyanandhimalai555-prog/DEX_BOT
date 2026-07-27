#!/bin/bash

set -e

NAMESPACE="dexbot"

BACKEND_DEPLOYMENT="dex-backend"
FRONTEND_DEPLOYMENT="dex-frontend"
WORKER_DEPLOYMENT="dex-worker"

BACKEND_IMAGE="ghcr.io/suriyanandhimalai555-prog/dex-backend:latest"
FRONTEND_IMAGE="ghcr.io/suriyanandhimalai555-prog/dex-frontend:latest"


echo "================================="
echo " Kubernetes Deployment Started"
echo "================================="


####################################
# Update Frontend
####################################

echo ""
echo "========== Updating Frontend =========="


kubectl annotate deployment $FRONTEND_DEPLOYMENT \
kubernetes.io/change-cause="Frontend deployment $(date)" \
-n $NAMESPACE --overwrite


kubectl set image deployment/$FRONTEND_DEPLOYMENT \
dex-frontend=$FRONTEND_IMAGE \
-n $NAMESPACE



####################################
# Update Backend
####################################

echo ""
echo "========== Updating Backend =========="


kubectl annotate deployment $BACKEND_DEPLOYMENT \
kubernetes.io/change-cause="Backend deployment $(date)" \
-n $NAMESPACE --overwrite


kubectl set image deployment/$BACKEND_DEPLOYMENT \
dex-backend=$BACKEND_IMAGE \
-n $NAMESPACE



####################################
# Update Worker
####################################

echo ""
echo "========== Updating Worker =========="


kubectl annotate deployment $WORKER_DEPLOYMENT \
kubernetes.io/change-cause="Worker deployment $(date)" \
-n $NAMESPACE --overwrite


kubectl set image deployment/$WORKER_DEPLOYMENT \
dex-worker=$BACKEND_IMAGE \
-n $NAMESPACE



####################################
# Rollout Check
####################################

check_rollout(){

DEPLOYMENT=$1

echo ""
echo "========== Waiting $DEPLOYMENT Rollout =========="


if kubectl rollout status deployment/$DEPLOYMENT \
-n $NAMESPACE \
--timeout=180s

then

echo "✅ $DEPLOYMENT rollout successful"


else

echo "❌ $DEPLOYMENT rollout failed"

echo "========== Starting Rollback =========="


kubectl rollout undo deployment/$DEPLOYMENT \
-n $NAMESPACE


echo "Rollback completed"

exit 1

fi

}



####################################
# Rollout Validation
####################################


check_rollout $FRONTEND_DEPLOYMENT

check_rollout $BACKEND_DEPLOYMENT

check_rollout $WORKER_DEPLOYMENT



####################################
# Backend Health Check
####################################


echo ""
echo "========== Backend Health Check =========="


BACKEND_POD=$(kubectl get pods \
-n $NAMESPACE \
-l app=dex-backend \
-o jsonpath="{.items[0].metadata.name}")


HEALTH=$(kubectl exec -n $NAMESPACE $BACKEND_POD -- wget -qO- http://localhost:4000/health)



if [[ "$HEALTH" == *"true"* ]]

then

echo "✅ Backend Health OK"


else


echo "❌ Backend Health Failed"

echo "========== Backend Rollback =========="


kubectl rollout undo deployment/$BACKEND_DEPLOYMENT \
-n $NAMESPACE


exit 1

fi



####################################
# Pod Status
####################################


echo ""
echo "========== Current Pods =========="


kubectl get pods -n $NAMESPACE



####################################
# Rollout History
####################################


echo ""
echo "========== Deployment History =========="


echo "--- Backend History ---"

kubectl rollout history deployment/$BACKEND_DEPLOYMENT -n $NAMESPACE



echo ""

echo "--- Frontend History ---"

kubectl rollout history deployment/$FRONTEND_DEPLOYMENT -n $NAMESPACE



echo ""

echo "--- Worker History ---"

kubectl rollout history deployment/$WORKER_DEPLOYMENT -n $NAMESPACE



echo ""
echo "================================="
echo " ✅ Kubernetes Deployment Success"
echo "================================="
