export interface AzureSubscription {
  subscriptionId: string;
  displayName: string;
  state: string;
  tenantId: string;
}

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  resourceGroup: string;
  location: string;
  subscriptionId: string;
  tags?: Record<string, string>;
  kind?: string;
  sku?: {
    name: string;
    tier: string;
  };
  properties?: Record<string, any>;
  createdTime?: string;
  changedTime?: string;
}

export interface ResourceGroup {
  id: string;
  name: string;
  location: string;
  subscriptionId: string;
  tags?: Record<string, string>;
  properties: {
    provisioningState: string;
  };
}

export interface AzureResourceMetrics {
  resourceId: string;
  metrics: Array<{
    name: string;
    unit: string;
    timeseries: Array<{
      data: Array<{
        timeStamp: string;
        average?: number;
        maximum?: number;
        minimum?: number;
        total?: number;
      }>;
    }>;
  }>;
}

export interface AzureCostData {
  subscriptionId: string;
  resourceGroupName?: string;
  resourceId?: string;
  cost: number;
  currency: string;
  usageDate: string;
  serviceName: string;
  resourceLocation: string;
}

export interface AzureTenant {
  id: string;
  displayName: string;
  tenantType: string;
  defaultDomain: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  jobTitle?: string;
  officeLocation?: string;
  preferredLanguage?: string;
}

export interface TenantContext {
  currentTenant: AzureTenant | null;
  availableTenants: AzureTenant[];
  userProfile: UserProfile | null;
}
