import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalInstance, AZURE_SCOPES, API_CONFIG } from '../config/azure';

export class AzureApiClient {
  private client: AxiosInstance;
  private msalInstance: PublicClientApplication;

  constructor() {
    this.msalInstance = msalInstance;
    this.client = axios.create({
      baseURL: API_CONFIG.FUNCTIONS_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエストインターセプターでトークンを追加
    this.client.interceptors.request.use(
      async (config) => {
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          try {
            const tokenResponse = await this.msalInstance.acquireTokenSilent({
              scopes: AZURE_SCOPES.RESOURCE_MANAGEMENT,
              account: accounts[0],
            });
            
            config.headers.Authorization = `Bearer ${tokenResponse.accessToken}`;
          } catch (error) {
            console.error('Token acquisition failed:', error);
            // フォールバック: インタラクティブ認証
            try {
              const interactiveResponse = await this.msalInstance.acquireTokenPopup({
                scopes: AZURE_SCOPES.RESOURCE_MANAGEMENT,
                account: accounts[0],
              });
              config.headers.Authorization = `Bearer ${interactiveResponse.accessToken}`;
            } catch (interactiveError) {
              console.error('Interactive token acquisition failed:', interactiveError);
            }
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプターでエラーハンドリング
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // 認証エラーの場合、再ログインが必要
          this.msalInstance.loginRedirect();
        }
        return Promise.reject(error);
      }
    );
  }

  // Azure データ取得
  async getAzureData(tenantId: string, dataType?: string) {
    const params = dataType ? { type: dataType } : {};
    const response = await this.client.get(`/api/azure-data/${tenantId}`, { params });
    return response.data;
  }

  // テナント設定取得
  async getTenantConfig(tenantId: string) {
    const response = await this.client.get(`/api/tenant-config/${tenantId}`);
    return response.data;
  }

  // テナント設定更新
  async updateTenantConfig(tenantId: string, config: any) {
    const response = await this.client.put(`/api/tenant-config/${tenantId}`, config);
    return response.data;
  }

  // リソース一覧取得
  async getResources(tenantId: string, filters?: any) {
    const response = await this.client.get(`/api/azure-data/${tenantId}`, {
      params: { type: 'resources', ...filters }
    });
    return response.data;
  }

  // コストデータ取得
  async getCostData(tenantId: string, dateRange?: { start: string; end: string }) {
    const response = await this.client.get(`/api/azure-data/${tenantId}`, {
      params: { type: 'costs', ...dateRange }
    });
    return response.data;
  }

  // ヘルスチェック
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Azure Management API (直接呼び出し用)
  async callAzureManagementApi(endpoint: string, config?: AxiosRequestConfig) {
    const managementClient = axios.create({
      baseURL: 'https://management.azure.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // トークンを取得してヘッダーに追加
    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const tokenResponse = await this.msalInstance.acquireTokenSilent({
          scopes: AZURE_SCOPES.RESOURCE_MANAGEMENT,
          account: accounts[0],
        });
        
        if (config?.headers) {
          config.headers.Authorization = `Bearer ${tokenResponse.accessToken}`;
        } else {
          config = {
            ...config,
            headers: {
              ...config?.headers,
              Authorization: `Bearer ${tokenResponse.accessToken}`,
            },
          };
        }
      } catch (error) {
        console.error('Failed to acquire token for Azure Management API:', error);
        throw error;
      }
    }

    const response = await managementClient.get(endpoint, config);
    return response.data;
  }
}

// シングルトンインスタンス
export const azureApiClient = new AzureApiClient();
