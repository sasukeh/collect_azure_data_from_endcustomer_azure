import { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'

interface AdminConsentState {
  hasAdminConsent: boolean | null // null = checking, true = has consent, false = needs consent
  loading: boolean
  error: string | null
  checkAdminConsent: () => Promise<void>
  getAdminConsentUrl: () => string
}

// Azure Management API のスコープ（管理者同意が必要なスコープ）
const MANAGEMENT_SCOPES = ['https://management.azure.com/user_impersonation']
const GRAPH_ADMIN_SCOPES = ['https://graph.microsoft.com/Directory.Read.All']

export const useAdminConsent = (): AdminConsentState => {
  const { accounts, instance } = useMsal()
  const [hasAdminConsent, setHasAdminConsent] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkAdminConsent = async () => {
    if (accounts.length === 0) {
      setHasAdminConsent(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const account = accounts[0]
      
      // Check if this is a personal account
      const isPersonalAccount = account.username.includes('@outlook.com') || 
                               account.username.includes('@hotmail.com') || 
                               account.username.includes('@live.com') ||
                               account.tenantId === '9188040d-6c67-4c5b-b112-36a304b66dad'

      if (isPersonalAccount) {
        console.log('Personal account detected - skipping admin consent check')
        setHasAdminConsent(true) // Personal accounts don't need admin consent
        return
      }
      
      // Check Management API scope first
      try {
        const managementRequest = {
          scopes: MANAGEMENT_SCOPES,
          account: account,
          forceRefresh: false
        }
        
        await instance.acquireTokenSilent(managementRequest)
        console.log('Management API access verified')
        
        // Then check Graph API admin scopes
        try {
          const graphRequest = {
            scopes: GRAPH_ADMIN_SCOPES,
            account: account,
            forceRefresh: false
          }
          
          await instance.acquireTokenSilent(graphRequest)
          console.log('Graph API admin access verified')
          setHasAdminConsent(true)
        } catch (graphError: any) {
          console.log('Graph admin scopes not available:', graphError.message)
          // Even if Graph admin scopes fail, we can still work with Management API
          setHasAdminConsent(true)
        }
        
      } catch (managementError: any) {
        console.log('Management API access failed:', managementError.message)
        
        // Check if the error is specifically about admin consent
        if (managementError.errorCode === 'invalid_grant' || 
            managementError.message?.includes('AADSTS65001') ||
            managementError.message?.includes('consent') ||
            managementError.message?.includes('28000')) {
          console.log('Admin consent required')
          setHasAdminConsent(false)
        } else {
          console.warn('Unexpected error during admin consent check:', managementError)
          setHasAdminConsent(false)
        }
      }
    } catch (error) {
      console.error('Error checking admin consent:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
      setHasAdminConsent(false)
    } finally {
      setLoading(false)
    }
  }

  const getAdminConsentUrl = (): string => {
    if (accounts.length === 0) return ''
    
    const account = accounts[0]
    const tenantId = account.tenantId || 'common'
    const clientId = '7a6d794f-1aff-48c4-926c-f96d757247b1' // Azure Data Collector App ID
    
    const baseUrl = `https://login.microsoftonline.com/${tenantId}/adminconsent`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin,
      state: 'admin_consent_completed'
    })
    
    return `${baseUrl}?${params.toString()}`
  }

  // Auto-check on component mount and when accounts change
  useEffect(() => {
    if (accounts.length > 0) {
      checkAdminConsent()
    }
  }, [accounts.length])

  // Check URL parameters for admin consent callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const adminConsentState = urlParams.get('state')
    const adminConsentResult = urlParams.get('admin_consent')
    
    if (adminConsentState === 'admin_consent_completed') {
      if (adminConsentResult === 'True') {
        console.log('Admin consent granted successfully')
        setHasAdminConsent(true)
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname)
      } else {
        console.log('Admin consent was denied or failed')
        setHasAdminConsent(false)
      }
    }
  }, [])

  return {
    hasAdminConsent,
    loading,
    error,
    checkAdminConsent,
    getAdminConsentUrl
  }
}
