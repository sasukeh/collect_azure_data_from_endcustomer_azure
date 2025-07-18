import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { Request, Response } from 'express'

// Initialize Firebase Admin SDK with service account key
try {
  // Only try to parse if service account config exists
  const serviceAccountString = functions.config().admin?.service_account
  if (serviceAccountString && typeof serviceAccountString === 'string') {
    try {
      const serviceAccount = JSON.parse(serviceAccountString)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'azure-data-collector-202507'
      })
      console.log('Firebase Admin initialized with service account from config')
    } catch (parseError) {
      console.error('Failed to parse service account JSON:', parseError)
      // Fallback to default initialization
      admin.initializeApp({
        projectId: 'azure-data-collector-202507'
      })
      console.log('Firebase Admin initialized with default credentials')
    }
  } else {
    // Fallback to default initialization
    admin.initializeApp({
      projectId: 'azure-data-collector-202507'
    })
    console.log('Firebase Admin initialized with default credentials')
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error)
  // Try minimal initialization without credentials
  admin.initializeApp({
    projectId: 'azure-data-collector-202507'
  })
  console.log('Firebase Admin initialized with minimal config')
}

// Define the expected structure of the request body
interface CreateCustomTokenRequest {
  idToken: string
  accountType: 'personal' | 'work'
}

// Cloud Function to create custom token
export const createCustomToken = functions.https.onRequest(
  async (req: Request, res: Response): Promise<void> => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    try {
      const { idToken, accountType } = req.body as CreateCustomTokenRequest

      if (!idToken) {
        res.status(400).json({ error: 'ID token is required' })
        return
      }

      console.log('Creating custom token for account type:', accountType)

      // Verify the Azure AD ID token (basic validation)
      // In production, you should verify the token signature and issuer
      const decodedToken = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString())
      
      const uid = decodedToken.oid || decodedToken.sub
      if (!uid) {
        res.status(400).json({ error: 'Invalid token: missing user ID' })
        return
      }

      // Create custom claims
      const customClaims = {
        provider: 'azure-ad',
        accountType: accountType || 'work',
        email: decodedToken.email || decodedToken.preferred_username,
        tenantId: decodedToken.tid,
        name: decodedToken.name
      }

      // Create custom token
      const customToken = await admin.auth().createCustomToken(uid, customClaims)

      console.log('Custom token created successfully for user:', uid)

      // Save user data to Firestore
      try {
        const userDoc = {
          uid: uid,
          email: decodedToken.email || decodedToken.preferred_username,
          name: decodedToken.name,
          accountType: accountType || 'work',
          tenantId: decodedToken.tid,
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          provider: 'azure-ad',
          azureADData: {
            oid: decodedToken.oid,
            tid: decodedToken.tid,
            preferred_username: decodedToken.preferred_username,
            given_name: decodedToken.given_name,
            family_name: decodedToken.family_name,
            upn: decodedToken.upn
          }
        }

        // Check if user already exists
        const userRef = admin.firestore().collection('users').doc(uid)
        const userSnapshot = await userRef.get()

        if (userSnapshot.exists) {
          // Update existing user with last login time
          await userRef.update({
            lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
            email: decodedToken.email || decodedToken.preferred_username,
            name: decodedToken.name,
            azureADData: userDoc.azureADData
          })
          console.log('Updated existing user in Firestore:', uid)
        } else {
          // Create new user document
          await userRef.set(userDoc)
          console.log('Created new user in Firestore:', uid)
        }
      } catch (firestoreError) {
        console.error('Error saving user to Firestore:', firestoreError)
        // Continue execution even if Firestore save fails
      }

      res.status(200).json({ 
        customToken,
        uid,
        claims: customClaims
      })

    } catch (error) {
      console.error('Error creating custom token:', error)
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Azure data collection types
interface AzureSubscription {
  subscriptionId: string
  displayName: string
  state: string
  tenantId: string
}

interface AzureResource {
  id: string
  name: string
  type: string
  location: string
  resourceGroup: string
  subscriptionId: string
  tags?: Record<string, string>
}

interface AzureCost {
  subscriptionId: string
  usageDate: string
  serviceName: string
  meterCategory: string
  pretaxCost: number
  currency: string
}

// Clean data function to remove undefined values
const cleanData = (obj: any): any => {
  if (obj === null || obj === undefined) return null
  if (Array.isArray(obj)) return obj.map(cleanData)
  if (typeof obj === 'object') {
    const cleaned: any = {}
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        cleaned[key] = cleanData(obj[key])
      }
    })
    return cleaned
  }
  return obj
}

// Cloud Function to collect Azure data
export const collectAzureData = functions.https.onRequest(
  async (req: Request, res: Response): Promise<void> => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    try {
      const { userId } = req.body
      // azureToken would be used for actual Azure API calls

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' })
        return
      }

      console.log('Collecting Azure data for user:', userId)

      // For now, generate mock data
      // In a real implementation, you would use azureToken to call Azure APIs
      const mockSubscriptions: AzureSubscription[] = [
        {
          subscriptionId: '89c9edaa-1cd0-4f1f-9e57-432deff27dde',
          displayName: 'Development Subscription',
          state: 'Enabled',
          tenantId: '1d6a8635-6904-4cbf-bedd-c849732cbb39'
        },
        {
          subscriptionId: 'b2c8f7e1-9a3d-4c5b-8e2f-1a2b3c4d5e6f',
          displayName: 'Production Subscription', 
          state: 'Enabled',
          tenantId: '1d6a8635-6904-4cbf-bedd-c849732cbb39'
        }
      ]
      
      const mockResources: AzureResource[] = [
        {
          id: '/subscriptions/89c9edaa-1cd0-4f1f-9e57-432deff27dde/resourceGroups/dev-rg/providers/Microsoft.Compute/virtualMachines/dev-vm',
          name: 'dev-vm',
          type: 'Microsoft.Compute/virtualMachines',
          location: 'eastus',
          resourceGroup: 'dev-rg',
          subscriptionId: '89c9edaa-1cd0-4f1f-9e57-432deff27dde',
          tags: { environment: 'dev', owner: 'team-a' }
        },
        {
          id: '/subscriptions/89c9edaa-1cd0-4f1f-9e57-432deff27dde/resourceGroups/dev-rg/providers/Microsoft.Storage/storageAccounts/devstorageacct',
          name: 'devstorageacct',
          type: 'Microsoft.Storage/storageAccounts',
          location: 'eastus',
          resourceGroup: 'dev-rg',
          subscriptionId: '89c9edaa-1cd0-4f1f-9e57-432deff27dde',
          tags: { environment: 'dev', tier: 'standard' }
        },
        {
          id: '/subscriptions/b2c8f7e1-9a3d-4c5b-8e2f-1a2b3c4d5e6f/resourceGroups/prod-rg/providers/Microsoft.Web/sites/prod-webapp',
          name: 'prod-webapp',
          type: 'Microsoft.Web/sites',
          location: 'westus2',
          resourceGroup: 'prod-rg',
          subscriptionId: 'b2c8f7e1-9a3d-4c5b-8e2f-1a2b3c4d5e6f',
          tags: { environment: 'production', tier: 'premium' }
        }
      ]
      
      const mockCosts: AzureCost[] = [
        {
          subscriptionId: '89c9edaa-1cd0-4f1f-9e57-432deff27dde',
          usageDate: '2025-07-11',
          serviceName: 'Virtual Machines',
          meterCategory: 'Compute',
          pretaxCost: 125.50,
          currency: 'USD'
        },
        {
          subscriptionId: '89c9edaa-1cd0-4f1f-9e57-432deff27dde',
          usageDate: '2025-07-11', 
          serviceName: 'Storage',
          meterCategory: 'Storage',
          pretaxCost: 25.75,
          currency: 'USD'
        },
        {
          subscriptionId: 'b2c8f7e1-9a3d-4c5b-8e2f-1a2b3c4d5e6f',
          usageDate: '2025-07-11',
          serviceName: 'App Service',
          meterCategory: 'Web',
          pretaxCost: 89.99,
          currency: 'USD'
        }
      ]

      // Save data to Firestore
      try {
        const db = admin.firestore()
        const batch = db.batch()
        
        // Save subscriptions
        mockSubscriptions.forEach(subscription => {
          const cleanSubscription = cleanData({
            ...subscription,
            lastSynced: admin.firestore.FieldValue.serverTimestamp(),
            syncedBy: userId
          })
          
          const docRef = db.collection('users').doc(userId).collection('subscriptions').doc(subscription.subscriptionId)
          batch.set(docRef, cleanSubscription)
        })
        
        // Save resources
        mockResources.forEach(resource => {
          const cleanResource = cleanData({
            ...resource,
            lastSynced: admin.firestore.FieldValue.serverTimestamp(),
            syncedBy: userId
          })
          
          const safeId = resource.id.replace(/\//g, '_').replace(/\s+/g, '_')
          const docRef = db.collection('users').doc(userId).collection('resources').doc(safeId)
          batch.set(docRef, cleanResource)
        })
        
        // Save costs
        mockCosts.forEach(cost => {
          const cleanCost = cleanData({
            ...cost,
            lastSynced: admin.firestore.FieldValue.serverTimestamp(),
            syncedBy: userId
          })
          
          const safeId = `${cost.subscriptionId}_${cost.usageDate}_${cost.serviceName}`.replace(/[\/\s]+/g, '_')
          const docRef = db.collection('users').doc(userId).collection('costs').doc(safeId)
          batch.set(docRef, cleanCost)
        })
        
        // Save sync log
        const syncLogRef = db.collection('users').doc(userId).collection('syncLogs').doc()
        batch.set(syncLogRef, cleanData({
          operation: 'collectAzureData',
          status: 'success',
          details: {
            subscriptionCount: mockSubscriptions.length,
            resourceCount: mockResources.length,
            costCount: mockCosts.length
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          syncedBy: userId
        }))
        
        await batch.commit()
        console.log('Azure data successfully written to Firestore for user:', userId)
      } catch (firestoreError) {
        console.error('Firestore write failed:', firestoreError)
        res.status(500).json({ error: 'Failed to save data to Firestore' })
        return
      }

      const responseData = {
        subscriptions: mockSubscriptions,
        resources: mockResources,
        costs: mockCosts,
        timestamp: new Date().toISOString()
      }

      res.status(200).json(responseData)

    } catch (error) {
      console.error('Error collecting Azure data:', error)
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)
