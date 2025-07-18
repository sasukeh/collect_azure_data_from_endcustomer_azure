import { useState } from 'react';

export const useFirebaseSync = () => {
  const [isLoading] = useState(false);

  return {
    syncData: () => Promise.resolve(),
    isLoading,
  };
};
