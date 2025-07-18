import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { azureApiClient } from '../services/azureApiClient';

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  tags: Record<string, string>;
  createdTime?: string;
}

export interface CostData {
  scope: string;
  period: {
    start: string;
    end: string;
  };
  totalCost: number;
  currency: string;
  breakdown?: Array<{
    service: string;
    cost: number;
    date: string;
  }>;
}

export interface TenantConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  enabled: boolean;
  name: string;
  description?: string;
  lastUpdated: string;
}

interface AzureDataState {
  // State
  resources: AzureResource[];
  costData: CostData | null;
  tenantConfigs: TenantConfig[];
  selectedTenantId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  setSelectedTenant: (tenantId: string) => void;
  fetchResources: (tenantId: string, filters?: any) => Promise<void>;
  fetchCostData: (tenantId: string, dateRange?: { start: string; end: string }) => Promise<void>;
  fetchTenantConfigs: () => Promise<void>;
  updateTenantConfig: (tenantId: string, config: Partial<TenantConfig>) => Promise<void>;
  clearData: () => void;
  setError: (error: string | null) => void;
}

export const useAzureDataStore = create<AzureDataState>()(
  devtools(
    (set) => ({
      // Initial state
      resources: [],
      costData: null,
      tenantConfigs: [],
      selectedTenantId: null,
      loading: false,
      error: null,

      // Actions
      setSelectedTenant: (tenantId: string) => {
        set({ selectedTenantId: tenantId });
      },

      fetchResources: async (tenantId: string, filters?: any) => {
        set({ loading: true, error: null });
        try {
          const data = await azureApiClient.getResources(tenantId, filters);
          const resources = data.map((item: any) => ({
            id: item.data?.resources?.[0]?.id || item.id,
            name: item.data?.resources?.[0]?.name || item.name,
            type: item.data?.resources?.[0]?.type || item.type,
            location: item.data?.resources?.[0]?.location || item.location,
            resourceGroup: item.data?.resources?.[0]?.resourceGroup || item.resourceGroup,
            tags: item.data?.resources?.[0]?.tags || item.tags || {},
            createdTime: item.data?.resources?.[0]?.createdTime || item.createdTime,
          }));
          set({ resources, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch resources';
          set({ error: errorMessage, loading: false });
        }
      },

      fetchCostData: async (tenantId: string, dateRange?: { start: string; end: string }) => {
        set({ loading: true, error: null });
        try {
          const data = await azureApiClient.getCostData(tenantId, dateRange);
          // データが配列の場合は最新のものを取得
          const costData = Array.isArray(data) ? data[0]?.data : data;
          set({ costData, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch cost data';
          set({ error: errorMessage, loading: false });
        }
      },

      fetchTenantConfigs: async () => {
        set({ loading: true, error: null });
        try {
          // TODO: テナント設定一覧取得APIを実装
          // const configs = await azureApiClient.getTenantConfigs();
          // set({ tenantConfigs: configs, loading: false });
          
          // 暫定的にダミーデータ
          const dummyConfigs: TenantConfig[] = [
            {
              tenantId: 'tenant-1',
              clientId: 'client-1',
              clientSecret: 'secret-1',
              subscriptionId: 'sub-1',
              enabled: true,
              name: 'Production Tenant',
              description: 'Main production environment',
              lastUpdated: new Date().toISOString(),
            },
          ];
          set({ tenantConfigs: dummyConfigs, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tenant configs';
          set({ error: errorMessage, loading: false });
        }
      },

      updateTenantConfig: async (tenantId: string, config: Partial<TenantConfig>) => {
        set({ loading: true, error: null });
        try {
          const updatedConfig = await azureApiClient.updateTenantConfig(tenantId, config);
          
          set((state) => ({
            tenantConfigs: state.tenantConfigs.map((tenant) =>
              tenant.tenantId === tenantId
                ? { ...tenant, ...updatedConfig, lastUpdated: new Date().toISOString() }
                : tenant
            ),
            loading: false,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update tenant config';
          set({ error: errorMessage, loading: false });
        }
      },

      clearData: () => {
        set({
          resources: [],
          costData: null,
          selectedTenantId: null,
          error: null,
        });
      },

      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: 'azure-data-store',
    }
  )
);
