import { useState } from 'react';

export const useFirebaseAuth = () => {
  const [firebaseUser] = useState<any>({ uid: 'mock-user' });
  const [isFirebaseAuthenticated] = useState(false);

  return {
    firebaseUser,
    isFirebaseAuthenticated,
    signInWithAzureToken: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
  };
};
