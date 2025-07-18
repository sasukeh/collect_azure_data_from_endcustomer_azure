// Placeholder for Firebase imports - completely mocked for Azure migration
export const collection = () => null;
export const onSnapshot = () => () => {};
export const getDocs = () => Promise.resolve({ docs: [] });
export const writeBatch = () => ({ 
  set: () => {},
  update: () => {},
  delete: () => {},
  commit: () => Promise.resolve() 
});
export const query = (...args: any[]) => null;
export const orderBy = (...args: any[]) => null;
export const limit = (...args: any[]) => null;
export const doc = (...args: any[]) => null;
export const setDoc = () => Promise.resolve();
export const addDoc = () => Promise.resolve();
export const updateDoc = () => Promise.resolve();
export const serverTimestamp = () => null;
export const Timestamp = { now: () => null };

export const db = {};
export const auth = {};

// Mock Firebase auth functions
export const getAuth = () => auth;
export const connectAuthEmulator = () => {};
export const getFirestore = () => db;
export const connectFirestoreEmulator = () => {};
export const initializeApp = () => ({});

// Firebase config placeholder
export const firebaseConfig = {};

// Initialize app placeholder
export const app = initializeApp(firebaseConfig);
