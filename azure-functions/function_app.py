import azure.functions as func
import logging
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from azure.identity import DefaultAzureCredential, ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.costmanagement import CostManagementClient
from azure.mgmt.monitor import MonitorManagementClient
from azure.cosmos import CosmosClient
from azure.keyvault.secrets import SecretClient

# Azure Functions アプリケーション
app = func.FunctionApp()

# 環境変数
COSMOS_ENDPOINT = os.environ.get("COSMOS_ENDPOINT")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
COSMOS_DATABASE_NAME = os.environ.get("COSMOS_DATABASE_NAME", "azure-data-collector")
KEY_VAULT_URL = os.environ.get("KEY_VAULT_URL")

# Cosmos DB クライアント
cosmos_client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
database = cosmos_client.get_database_client(COSMOS_DATABASE_NAME)

def get_azure_credentials(tenant_id: str, client_id: str, client_secret: str):
    """Azure認証情報を取得"""
    return ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret
    )

def get_tenant_config(tenant_id: str) -> Dict[str, Any]:
    """テナント設定をCosmos DBから取得"""
    try:
        container = database.get_container_client("tenant_configs")
        response = container.read_item(
            item=tenant_id,
            partition_key=tenant_id
        )
        return response
    except Exception as e:
        logging.error(f"Failed to get tenant config for {tenant_id}: {str(e)}")
        return None

def save_azure_data(tenant_id: str, data_type: str, data: Dict[str, Any]):
    """AzureデータをCosmos DBに保存"""
    try:
        container = database.get_container_client("azure_data")
        document = {
            "id": f"{tenant_id}_{data_type}_{datetime.utcnow().isoformat()}",
            "tenant_id": tenant_id,
            "data_type": data_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
            "ttl": 86400 * 90  # 90日後に自動削除
        }
        container.create_item(document)
        logging.info(f"Saved {data_type} data for tenant {tenant_id}")
    except Exception as e:
        logging.error(f"Failed to save data for {tenant_id}: {str(e)}")

def collect_resource_data(credentials, subscription_id: str) -> List[Dict[str, Any]]:
    """Azure リソース情報を収集"""
    try:
        resource_client = ResourceManagementClient(credentials, subscription_id)
        resources = []
        
        for resource in resource_client.resources.list():
            resources.append({
                "id": resource.id,
                "name": resource.name,
                "type": resource.type,
                "location": resource.location,
                "resource_group": resource.id.split('/')[4],
                "tags": resource.tags or {},
                "created_time": resource.created_time.isoformat() if resource.created_time else None
            })
        
        return resources
    except Exception as e:
        logging.error(f"Failed to collect resource data: {str(e)}")
        return []

def collect_cost_data(credentials, subscription_id: str) -> Dict[str, Any]:
    """Azure コストデータを収集"""
    try:
        cost_client = CostManagementClient(credentials)
        
        # 過去30日間のコストデータを取得
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        scope = f"/subscriptions/{subscription_id}"
        
        # コスト分析クエリ（簡略化）
        cost_data = {
            "scope": scope,
            "period": {
                "start": start_date.strftime("%Y-%m-%d"),
                "end": end_date.strftime("%Y-%m-%d")
            },
            "total_cost": 0.0,  # 実際のAPIレスポンスから取得
            "currency": "USD"
        }
        
        return cost_data
    except Exception as e:
        logging.error(f"Failed to collect cost data: {str(e)}")
        return {}

@app.function_name(name="collect_azure_data")
@app.timer_trigger(schedule="0 0 * * * *", arg_name="timer", run_on_startup=False)
def collect_azure_data_timer(timer: func.TimerRequest) -> None:
    """1時間毎にAzureデータを収集するタイマー関数"""
    if timer.past_due:
        logging.info('The timer is past due!')

    logging.info('Starting Azure data collection...')
    
    try:
        # 全テナント設定を取得
        container = database.get_container_client("tenant_configs")
        query = "SELECT * FROM c WHERE c.enabled = true"
        tenant_configs = list(container.query_items(query=query, enable_cross_partition_query=True))
        
        for config in tenant_configs:
            tenant_id = config["tenant_id"]
            
            try:
                # 認証情報を取得
                credentials = get_azure_credentials(
                    tenant_id=config["tenant_id"],
                    client_id=config["client_id"],
                    client_secret=config["client_secret"]
                )
                
                subscription_id = config["subscription_id"]
                
                # リソースデータ収集
                resources = collect_resource_data(credentials, subscription_id)
                if resources:
                    save_azure_data(tenant_id, "resources", {"resources": resources})
                
                # コストデータ収集
                cost_data = collect_cost_data(credentials, subscription_id)
                if cost_data:
                    save_azure_data(tenant_id, "costs", cost_data)
                
                logging.info(f"Completed data collection for tenant: {tenant_id}")
                
            except Exception as e:
                logging.error(f"Failed to collect data for tenant {tenant_id}: {str(e)}")
                continue
    
    except Exception as e:
        logging.error(f"Timer function failed: {str(e)}")

@app.function_name(name="health_check")
@app.route(route="health", auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """ヘルスチェック用のHTTP関数"""
    return func.HttpResponse(
        json.dumps({
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }),
        status_code=200,
        headers={"Content-Type": "application/json"}
    )

@app.function_name(name="get_azure_data")
@app.route(route="api/azure-data/{tenant_id}", auth_level=func.AuthLevel.FUNCTION)
def get_azure_data_http(req: func.HttpRequest) -> func.HttpResponse:
    """テナントのAzureデータを取得するHTTP関数"""
    tenant_id = req.route_params.get('tenant_id')
    data_type = req.params.get('type', 'all')
    
    if not tenant_id:
        return func.HttpResponse(
            json.dumps({"error": "tenant_id is required"}),
            status_code=400,
            headers={"Content-Type": "application/json"}
        )
    
    try:
        container = database.get_container_client("azure_data")
        
        if data_type == 'all':
            query = f"SELECT * FROM c WHERE c.tenant_id = '{tenant_id}' ORDER BY c.timestamp DESC"
        else:
            query = f"SELECT * FROM c WHERE c.tenant_id = '{tenant_id}' AND c.data_type = '{data_type}' ORDER BY c.timestamp DESC"
        
        items = list(container.query_items(query=query, enable_cross_partition_query=True))
        
        return func.HttpResponse(
            json.dumps(items, default=str),
            status_code=200,
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        )
    
    except Exception as e:
        logging.error(f"Failed to get azure data: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )
