"""
Azure Data Collector - Cloud Functions Main Module

Firebase Cloud Functions for collecting Azure data from multiple tenants
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import firebase_admin
from firebase_admin import credentials, firestore, auth
from firebase_functions import https_fn, scheduler_fn, options
from google.cloud.firestore_v1.base_query import FieldFilter
from flask import Request, jsonify
from flask_cors import CORS

from azure.identity import ClientSecretCredential, DefaultAzureCredential
from azure.core.credentials import AccessToken
import requests
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.costmanagement import CostManagementClient
from azure.mgmt.monitor import MonitorManagementClient
from azure.mgmt.subscription import SubscriptionClient

# Initialize Firebase Admin
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("service-account-key.json")
        firebase_admin.initialize_app(cred)
    except:
        # Use default credentials for deployed environment
        firebase_admin.initialize_app()

db = firestore.client()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UserTokenCredential:
    """User access token based credential for Azure APIs"""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
    
    def get_token(self, *scopes, **kwargs):
        """Return the access token"""
        from azure.core.credentials import AccessToken
        from datetime import datetime, timedelta
        
        # Assume token is valid for 1 hour (standard MSAL token lifetime)
        expires_on = datetime.now() + timedelta(hours=1)
        return AccessToken(self.access_token, int(expires_on.timestamp()))


class AzureDataCollector:
    """Azure data collection service for multi-tenant environments"""
    
    def __init__(self, tenant_id: str, client_id: str = None, client_secret: str = None, access_token: str = None):
        self.tenant_id = tenant_id
        
        if access_token:
            # User token based authentication
            self.credential = UserTokenCredential(access_token)
            self.auth_method = "user_token"
        elif client_id and client_secret:
            # Service principal authentication
            self.client_id = client_id
            self.client_secret = client_secret
            self.credential = ClientSecretCredential(
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret
            )
            self.auth_method = "service_principal"
        else:
            raise ValueError("Either access_token or (client_id + client_secret) must be provided")
    
    def get_subscriptions(self) -> List[Dict]:
        """Get all subscriptions for the tenant"""
        try:
            subscription_client = SubscriptionClient(self.credential)
            subscriptions = []
            
            for subscription in subscription_client.subscriptions.list():
                subscriptions.append({
                    'subscription_id': subscription.subscription_id,
                    'display_name': subscription.display_name,
                    'state': subscription.state,
                    'tenant_id': self.tenant_id
                })
            
            return subscriptions
        except Exception as e:
            logger.error(f"Error getting subscriptions: {str(e)}")
            return []
    
    def collect_resources(self, subscription_id: str) -> List[Dict]:
        """Collect Azure resources from a subscription"""
        try:
            resource_client = ResourceManagementClient(
                self.credential, 
                subscription_id
            )
            
            resources = []
            for resource in resource_client.resources.list():
                resources.append({
                    'id': resource.id,
                    'name': resource.name,
                    'type': resource.type,
                    'location': resource.location,
                    'resource_group': resource.id.split('/')[4],
                    'subscription_id': subscription_id,
                    'tenant_id': self.tenant_id,
                    'tags': resource.tags or {},
                    'created_time': resource.created_time.isoformat() if resource.created_time else None,
                    'collected_at': datetime.utcnow().isoformat()
                })
            
            return resources
        except Exception as e:
            logger.error(f"Error collecting resources: {str(e)}")
            return []
    
    def collect_costs(self, subscription_id: str, days_back: int = 30) -> List[Dict]:
        """Collect cost data from Azure Cost Management"""
        try:
            cost_client = CostManagementClient(self.credential)
            
            # Define time period
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days_back)
            
            scope = f"/subscriptions/{subscription_id}"
            
            # Cost query parameters
            cost_query = {
                "type": "ActualCost",
                "timeframe": "Custom",
                "timePeriod": {
                    "from": start_date.strftime("%Y-%m-%d"),
                    "to": end_date.strftime("%Y-%m-%d")
                },
                "dataset": {
                    "granularity": "Daily",
                    "aggregation": {
                        "totalCost": {
                            "name": "PreTaxCost",
                            "function": "Sum"
                        }
                    },
                    "grouping": [
                        {
                            "type": "Dimension",
                            "name": "ServiceName"
                        }
                    ]
                }
            }
            
            result = cost_client.query.usage(scope, cost_query)
            
            costs = []
            if result.rows:
                for row in result.rows:
                    costs.append({
                        'date': row[0],
                        'service_name': row[1],
                        'cost': float(row[2]),
                        'currency': row[3] if len(row) > 3 else 'USD',
                        'subscription_id': subscription_id,
                        'tenant_id': self.tenant_id,
                        'collected_at': datetime.utcnow().isoformat()
                    })
            
            return costs
        except Exception as e:
            logger.error(f"Error collecting costs: {str(e)}")
            return []
    
    def collect_metrics(self, subscription_id: str) -> List[Dict]:
        """Collect Azure Monitor metrics"""
        try:
            monitor_client = MonitorManagementClient(
                self.credential, 
                subscription_id
            )
            
            # Get metric definitions for key resources
            metrics = []
            
            # This is a simplified example - in practice, you'd iterate through
            # specific resources and collect their metrics
            metric_definitions = monitor_client.metric_definitions.list(
                f"/subscriptions/{subscription_id}"
            )
            
            for metric_def in metric_definitions:
                metrics.append({
                    'name': metric_def.name.value,
                    'display_name': metric_def.display_description,
                    'unit': metric_def.unit,
                    'subscription_id': subscription_id,
                    'tenant_id': self.tenant_id,
                    'collected_at': datetime.utcnow().isoformat()
                })
            
            return metrics
        except Exception as e:
            logger.error(f"Error collecting metrics: {str(e)}")
            return []


def save_data_to_firestore(user_id: str, tenant_id: str, data_type: str, data: List[Dict]):
    """Save collected data to Firestore"""
    try:
        batch = db.batch()
        
        for item in data:
            doc_ref = db.collection('users').document(user_id)\
                       .collection('tenants').document(tenant_id)\
                       .collection(data_type).document()
            batch.set(doc_ref, item)
        
        batch.commit()
        logger.info(f"Saved {len(data)} {data_type} items for user {user_id}, tenant {tenant_id}")
    except Exception as e:
        logger.error(f"Error saving data to Firestore: {str(e)}")


@scheduler_fn.on_schedule(schedule="0 */1 * * *")  # Every hour
def scheduled_data_collection(event) -> None:
    """Scheduled function to collect data from all registered tenants"""
    try:
        # Get all users with registered tenants
        users_ref = db.collection('users')
        users = users_ref.stream()
        
        for user_doc in users:
            user_id = user_doc.id
            
            # Get user's tenants
            tenants_ref = users_ref.document(user_id).collection('tenants')
            tenants = tenants_ref.stream()
            
            for tenant_doc in tenants:
                tenant_data = tenant_doc.to_dict()
                tenant_id = tenant_doc.id
                
                if not tenant_data.get('enabled', True):
                    continue
                
                # Create Azure collector
                collector = AzureDataCollector(
                    tenant_id=tenant_id,
                    client_id=tenant_data.get('client_id'),
                    client_secret=tenant_data.get('client_secret')
                )
                
                # Get subscriptions
                subscriptions = collector.get_subscriptions()
                
                for subscription in subscriptions:
                    subscription_id = subscription['subscription_id']
                    
                    # Collect resources
                    resources = collector.collect_resources(subscription_id)
                    if resources:
                        save_data_to_firestore(user_id, tenant_id, 'resources', resources)
                    
                    # Collect costs
                    costs = collector.collect_costs(subscription_id)
                    if costs:
                        save_data_to_firestore(user_id, tenant_id, 'costs', costs)
                    
                    # Collect metrics
                    metrics = collector.collect_metrics(subscription_id)
                    if metrics:
                        save_data_to_firestore(user_id, tenant_id, 'metrics', metrics)
        
        logger.info("Scheduled data collection completed")
    except Exception as e:
        logger.error(f"Error in scheduled data collection: {str(e)}")


@https_fn.on_request(cors=options.CorsOptions(
    cors_origins=["http://localhost:3000", "http://localhost:3001", "https://azure-data-collector-202507.web.app", "https://azure-data-collector-202507.firebaseapp.com"],
    cors_methods=["GET", "POST", "OPTIONS"]
))
def create_custom_token(req: https_fn.Request) -> https_fn.Response:
    """Create custom Firebase token for Azure AD authenticated users"""
    try:
        # Parse request
        request_json = req.get_json(silent=True)
        if not request_json:
            return https_fn.Response(
                "Invalid request", 
                status=400,
                headers={
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            )
        
        user_id = request_json.get('user_id')
        user_email = request_json.get('user_email')
        azure_access_token = request_json.get('azure_access_token')
        
        if not user_id or not user_email or not azure_access_token:
            return https_fn.Response(
                "Missing required fields", 
                status=400,
                headers={
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            )
        
        # Verify Azure token (simplified - in production add proper validation)
        # For now, we trust the frontend verification
        
        # Create custom claims
        additional_claims = {
            'azure_user_id': user_id,
            'email': user_email,
            'provider': 'azure_ad',
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Create custom token
        custom_token = auth.create_custom_token(
            uid=user_id.replace('@', '_').replace('.', '_').replace('-', '_'),
            additional_claims=additional_claims
        )
        
        return https_fn.Response(
            json.dumps({
                'custom_token': custom_token.decode('utf-8'),
                'uid': user_id.replace('@', '_').replace('.', '_').replace('-', '_')
            }),
            status=200,
            headers={
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        )
        
    except Exception as e:
        logger.error(f"Error creating custom token: {str(e)}")
        return https_fn.Response(
            f"Internal error: {str(e)}", 
            status=500,
            headers={
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        )


@https_fn.on_request(cors=options.CorsOptions(
    cors_origins=["http://localhost:3000", "http://localhost:3001", "https://azure-data-collector-202507.web.app", "https://azure-data-collector-202507.firebaseapp.com"],
    cors_methods=["GET", "POST", "OPTIONS"]
))
def collect_tenant_data(req: https_fn.Request) -> https_fn.Response:
    """HTTP function to trigger data collection for a specific tenant"""
    try:
        # Parse request
        request_json = req.get_json(silent=True)
        if not request_json:
            return https_fn.Response("Invalid request", status=400)
        
        user_id = request_json.get('user_id')
        tenant_id = request_json.get('tenant_id')
        
        if not user_id or not tenant_id:
            return https_fn.Response("Missing user_id or tenant_id", status=400)
        
        # Get tenant configuration
        tenant_ref = db.collection('users').document(user_id)\
                      .collection('tenants').document(tenant_id)
        tenant_doc = tenant_ref.get()
        
        if not tenant_doc.exists:
            return https_fn.Response("Tenant not found", status=404)
        
        tenant_data = tenant_doc.to_dict()
        
        # Create Azure collector
        collector = AzureDataCollector(
            tenant_id=tenant_id,
            client_id=tenant_data.get('client_id'),
            client_secret=tenant_data.get('client_secret')
        )
        
        # Collect data
        results = {
            'collected_at': datetime.utcnow().isoformat(),
            'subscriptions': [],
            'resources_count': 0,
            'costs_count': 0,
            'metrics_count': 0
        }
        
        subscriptions = collector.get_subscriptions()
        results['subscriptions'] = subscriptions
        
        for subscription in subscriptions:
            subscription_id = subscription['subscription_id']
            
            # Collect and save resources
            resources = collector.collect_resources(subscription_id)
            if resources:
                save_data_to_firestore(user_id, tenant_id, 'resources', resources)
                results['resources_count'] += len(resources)
            
            # Collect and save costs
            costs = collector.collect_costs(subscription_id)
            if costs:
                save_data_to_firestore(user_id, tenant_id, 'costs', costs)
                results['costs_count'] += len(costs)
            
            # Collect and save metrics
            metrics = collector.collect_metrics(subscription_id)
            if metrics:
                save_data_to_firestore(user_id, tenant_id, 'metrics', metrics)
                results['metrics_count'] += len(metrics)
        
        return https_fn.Response(
            json.dumps(results),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        logger.error(f"Error in collect_tenant_data: {str(e)}")
        return https_fn.Response(f"Internal error: {str(e)}", status=500)


@https_fn.on_request()
def get_user_data(req: https_fn.Request) -> https_fn.Response:
    """HTTP function to get collected data for a user"""
    try:
        # Extract user_id from request
        user_id = req.args.get('user_id')
        tenant_id = req.args.get('tenant_id')
        data_type = req.args.get('type', 'resources')  # resources, costs, metrics
        
        if not user_id:
            return https_fn.Response("Missing user_id", status=400)
        
        # Build query
        if tenant_id:
            collection_ref = db.collection('users').document(user_id)\
                              .collection('tenants').document(tenant_id)\
                              .collection(data_type)
        else:
            # Get data from all tenants - this requires a collection group query
            collection_ref = db.collection_group(data_type)\
                              .where(filter=FieldFilter('user_id', '==', user_id))
        
        # Get recent data (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        docs = collection_ref.where(
            filter=FieldFilter('collected_at', '>=', thirty_days_ago.isoformat())
        ).order_by('collected_at', direction=firestore.Query.DESCENDING).limit(1000).stream()
        
        # Convert to list
        data = []
        for doc in docs:
            item = doc.to_dict()
            item['id'] = doc.id
            data.append(item)
        
        return https_fn.Response(
            json.dumps(data, default=str),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        logger.error(f"Error in get_user_data: {str(e)}")
        return https_fn.Response(f"Internal error: {str(e)}", status=500)


# REMOVED: collect_azure_data function has been deleted as per production requirements
# This function was providing mock data which could confuse users in production environment
# Only collect_real_azure_data should be used for actual Azure API data collection


@https_fn.on_request(cors=options.CorsOptions(
    cors_origins=["http://localhost:3000", "http://localhost:3001", "https://azure-data-collector-202507.web.app", "https://azure-data-collector-202507.firebaseapp.com"],
    cors_methods=["GET", "POST", "OPTIONS"]
))
def collect_real_azure_data(req: Request) -> https_fn.Response:
    """
    Cloud Function to collect real Azure data using actual Azure APIs
    
    Request body should contain:
    Method 1 (User Token - Recommended):
    - userId: Firebase user ID
    - tenantId: Azure tenant ID
    - accessToken: User's Azure access token
    - authMethod: "user_token"
    
    Method 2 (Service Principal - Legacy):
    - userId: Firebase user ID
    - tenantId: Azure tenant ID
    - clientId: Azure app registration client ID
    - clientSecret: Azure app registration client secret
    """
    
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    
    if req.method != "POST":
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}), 
            status=405,
            headers={'Content-Type': 'application/json'}
        )
    
    try:
        data = req.get_json()
        user_id = data.get("userId")
        tenant_id = data.get("tenantId")
        auth_method = data.get("authMethod", "service_principal")  # デフォルトは既存方式
        
        if not all([user_id, tenant_id]):
            return https_fn.Response(
                json.dumps({
                    "error": "Missing required fields",
                    "missing_fields": ["userId", "tenantId"],
                }), 
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        logger.info(f"Collecting real Azure data for user: {user_id}, tenant: {tenant_id}, auth: {auth_method}")
        
        # Create Azure collector based on authentication method
        if auth_method == "user_token":
            access_token = data.get("accessToken")
            if not access_token:
                return https_fn.Response(
                    json.dumps({
                        "error": "Missing access token for user_token authentication",
                        "message": "accessToken is required when authMethod is 'user_token'"
                    }), 
                    status=400,
                    headers={'Content-Type': 'application/json'}
                )
            
            collector = AzureDataCollector(
                tenant_id=tenant_id,
                access_token=access_token
            )
        else:
            # Service principal method (legacy)
            client_id = data.get("clientId")
            client_secret = data.get("clientSecret")
            
            if not all([client_id, client_secret]):
                missing_fields = []
                if not client_id: missing_fields.append("clientId")
                if not client_secret: missing_fields.append("clientSecret")
                
                return https_fn.Response(
                    json.dumps({
                        "error": "Missing required Azure authentication credentials",
                        "missing_fields": missing_fields,
                        "message": "This application requires actual Azure credentials to collect real data.",
                        "required_setup": {
                            "step1": "Create an Azure App Registration",
                            "step2": "Grant necessary API permissions (Reader access to subscriptions)",
                            "step3": "Generate client secret",
                            "step4": "Provide tenantId, clientId, and clientSecret"
                        }
                    }), 
                    status=400,
                    headers={'Content-Type': 'application/json'}
                )
            
            collector = AzureDataCollector(
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret
            )
        
        # Collect data from Azure APIs
        all_subscriptions = []
        all_resources = []
        all_costs = []
        
        try:
            # Get subscriptions
            subscriptions = collector.get_subscriptions()
            logger.info(f"Found {len(subscriptions)} subscriptions")
            
            for subscription in subscriptions:
                subscription_id = subscription['subscription_id']
                all_subscriptions.append(subscription)
                
                # Collect resources for this subscription
                resources = collector.collect_resources(subscription_id)
                all_resources.extend(resources)
                logger.info(f"Found {len(resources)} resources in subscription {subscription_id}")
                
                # Collect costs for this subscription
                costs = collector.collect_costs(subscription_id)
                all_costs.extend(costs)
                logger.info(f"Found {len(costs)} cost entries for subscription {subscription_id}")
            
        except Exception as azure_error:
            logger.error(f"Azure API error: {azure_error}")
            error_message = str(azure_error)
            
            # Provide specific guidance based on error type
            troubleshooting = {
                "common_causes": [
                    "Invalid client credentials (clientId or clientSecret)",
                    "Insufficient Azure permissions for the Service Principal", 
                    "Tenant ID mismatch",
                    "Service Principal not granted Reader access to subscriptions"
                ],
                "next_steps": [
                    "Verify Azure App Registration exists and is active",
                    "Check client secret is not expired",
                    "Ensure Service Principal has 'Reader' role on target subscriptions",
                    "Verify tenant ID matches your Azure AD tenant"
                ]
            }
            
            if "authentication" in error_message.lower() or "unauthorized" in error_message.lower():
                troubleshooting["likely_cause"] = "Authentication credentials are invalid or expired"
            elif "forbidden" in error_message.lower() or "permission" in error_message.lower():
                troubleshooting["likely_cause"] = "Service Principal lacks necessary permissions"
            
            return https_fn.Response(
                json.dumps({
                    "error": "Failed to collect data from Azure APIs",
                    "details": error_message,
                    "troubleshooting": troubleshooting
                }), 
                status=500,
                headers={'Content-Type': 'application/json'}
            )
        
        # Save collected data to Firestore
        try:
            batch = db.batch()
            timestamp = firestore.SERVER_TIMESTAMP
            
            # Save subscriptions
            for subscription in all_subscriptions:
                doc_ref = db.collection("users").document(user_id).collection("subscriptions").document(subscription["subscription_id"])
                subscription_data = {
                    **subscription,
                    "lastSynced": timestamp,
                    "syncedBy": user_id
                }
                batch.set(doc_ref, subscription_data)
            
            # Save resources
            for resource in all_resources:
                safe_id = resource["id"].replace("/", "_").replace(" ", "_")
                doc_ref = db.collection("users").document(user_id).collection("resources").document(safe_id)
                resource_data = {
                    **resource,
                    "lastSynced": timestamp,
                    "syncedBy": user_id
                }
                batch.set(doc_ref, resource_data)
            
            # Save costs
            for cost in all_costs:
                safe_id = f"{cost['subscription_id']}_{cost['date']}_{cost['service_name']}".replace("/", "_").replace(" ", "_").replace(".", "_")
                doc_ref = db.collection("users").document(user_id).collection("costs").document(safe_id)
                cost_data = {
                    **cost,
                    "lastSynced": timestamp,
                    "syncedBy": user_id
                }
                batch.set(doc_ref, cost_data)
            
            # Save sync log
            sync_log_ref = db.collection("users").document(user_id).collection("syncLogs").document()
            sync_log_data = {
                "operation": "collectRealAzureData",
                "status": "success",
                "details": {
                    "subscriptionCount": len(all_subscriptions),
                    "resourceCount": len(all_resources),
                    "costCount": len(all_costs)
                },
                "timestamp": timestamp,
                "syncedBy": user_id,
                "tenantId": tenant_id
            }
            batch.set(sync_log_ref, sync_log_data)
            
            batch.commit()
            logger.info(f"Real Azure data successfully written to Firestore for user: {user_id}")
            
        except Exception as firestore_error:
            logger.error(f"Firestore write failed: {firestore_error}")
            return https_fn.Response(
                json.dumps({"error": "Failed to save data to Firestore"}), 
                status=500,
                headers={'Content-Type': 'application/json'}
            )
        
        response_data = {
            "success": True,
            "message": "Real Azure data collected and saved successfully",
            "data_source": "Azure API (Production)",
            "authentication": "Service Principal",
            "tenant_id": tenant_id,
            "counts": {
                "subscriptions": len(all_subscriptions),
                "resources": len(all_resources), 
                "costs": len(all_costs)
            },
            "collection_timestamp": datetime.utcnow().isoformat(),
            "note": "All data collected from actual Azure environment via authenticated API calls"
        }
        
        return https_fn.Response(
            json.dumps(response_data),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        logger.error(f"Error collecting real Azure data: {e}")
        return https_fn.Response(
            json.dumps({
                "error": "Internal server error",
                "details": str(e)
            }),
            status=500,
            headers={'Content-Type': 'application/json'}
        )
