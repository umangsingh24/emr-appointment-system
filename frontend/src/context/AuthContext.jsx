import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { refreshSession, setSessionExpiredHandler, tokenStore } from '../api/client.js';
import { authApi } from '../api/endpoints.js';

const AuthContext = createContext(null);

/**
 * Owns the logged-in user. On first load it tries to restore the session from the
 * httpOnly refresh cookie, so a page reload does not log the user out.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const clearSession = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear(); // never show one user's cached data to the next
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    let cancelled = false;
    refreshSession()
      .then(({ user: restored }) => {
        if (cancelled) return;
        setUser(restored);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    const { data } = await authApi.login(credentials);
    tokenStore.set(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, status, isAuthenticated: status === 'authenticated', login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Convenience for role checks in components: hasRole('SUPER_ADMIN', 'RECEPTIONIST'). */
export function useHasRole() {
  const { user } = useAuth();
  return useCallback((...roles) => Boolean(user && roles.includes(user.role)), [user]);
}
