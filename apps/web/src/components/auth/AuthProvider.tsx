'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { useGameStore } from '@/lib/store/game-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useGameStore((s) => s.setUser);

  useEffect(() => {
    const initAuth = async () => {
      const token = apiClient.getToken();
      if (token) {
        try {
          const user = await apiClient.getMe();
          setUser(user);
        } catch (err) {
          // Token invalid or expired, clear it
          apiClient.setToken(null);
          setUser(null);
        }
      }
    };

    initAuth();
  }, [setUser]);

  return <>{children}</>;
}
