import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  clearAuth as clearStoredAuth,
  setAuth as setStoredAuth,
  type AuthState,
} from '@client/src/lib/storage';
import {
  assertSupabaseConfigured,
  isSupabaseConfigured,
  supabase,
} from '@client/src/lib/supabase';

interface AuthContextValue {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: AuthState | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToAuth(session: Session): AuthState {
  return {
    email: session.user.email ?? '',
    userId: session.user.id,
    token: session.access_token,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((session: Session | null) => {
    if (!session) {
      clearStoredAuth();
      setUser(null);
      return;
    }

    const next = sessionToAuth(session);
    setStoredAuth(next);
    setUser(next);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      clearStoredAuth();
      setIsLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) logger.warn('恢复登录状态失败', error);
      applySession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
      setIsLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (!data.session) throw new Error('登录失败，请稍后再试');
    applySession(data.session);
    logger.info('用户登录成功', { userId: data.user.id });
  }, [applySession]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    applySession(null);
    logger.info('用户已登出');
  }, [applySession]);

  const value = useMemo<AuthContextValue>(() => ({
    isLoading,
    isLoggedIn: user !== null,
    user,
    login,
    logout,
    checkAuth: () => user !== null,
  }), [isLoading, login, logout, user]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return context;
}

export default useAuth;
