import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, supabase } from '@/api/client';

const AuthContext = createContext(/** @type {any} */ (null));

/** @param {{ children: React.ReactNode }} props */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(/** @type {{ type: string; message: string } | null} */ (null));
  const [appPublicSettings] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const withTimeout = useCallback((promise, timeoutMs) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = new Error('Auth check timed out');
        timeoutError.code = 'auth_timeout';
        reject(timeoutError);
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const currentUser = await withTimeout(api.auth.me(), 10000);
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
    } catch (error) {
      const err = /** @type {any} */ (error);

      if (supabase) {
        try {
          const { data } = await supabase.auth.getUser();
          const authUser = data?.user;

          if (authUser) {
            setUser({
              id: authUser.id,
              email: authUser.email,
              full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
              role: authUser.user_metadata?.role || 'user'
            });
            setIsAuthenticated(true);
            setAuthChecked(true);
            return;
          }
        } catch {
          // Ignore fallback errors and continue with normal unauthenticated handling.
        }
      }

      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);

      if (err?.status === 401 || err?.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      } else {
        setAuthError({
          type: 'unknown',
          message: err?.message || 'Authentication check failed'
        });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();

    if (!supabase) {
      return undefined;
    }

    const { data } = supabase.auth.onAuthStateChange(() => {
      checkUserAuth();
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, [checkAppState, checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);

    if (shouldRedirect) {
      await api.auth.logout('/login');
    } else {
      await api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
