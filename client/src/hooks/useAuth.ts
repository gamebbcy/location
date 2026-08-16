import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getAuth,
  setAuth as setStoredAuth,
  clearAuth as clearStoredAuth,
  getProfile,
  setProfile,
  getOnboarding,
  getPermissions,
  setPermissions,
  type AuthState,
  type ProfileState,
  type PermissionState,
} from '@client/src/lib/storage';
import { APP_CONFIG } from '@client/src/config';

/**
 * 简单字符串 hashCode，用于从手机号生成稳定的 userId 前缀
 */
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转为 32 位整数
  }
  return Math.abs(hash).toString(36);
}

/**
 * 生成随机字符串 token
 */
function generateToken(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${rand}${ts}`;
}

interface UseAuthReturn {
  isLoggedIn: boolean;
  user: AuthState | null;
  login: (phone: string) => void;
  logout: () => void;
  checkAuth: () => boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthState | null>(() =>
    typeof window !== 'undefined' ? getAuth() : null,
  );

  const isLoggedIn = user !== null;

  const checkAuth = useCallback((): boolean => {
    const stored = getAuth();
    return stored !== null;
  }, []);

  const login = useCallback((phone: string): void => {
    const userId = `u_${hashCode(phone)}`;
    const token = generateToken();

    const authState: AuthState = { phone, userId, token };
    setStoredAuth(authState);
    setUser(authState);

    // 初始化 profile（若不存在）
    const existingProfile: ProfileState | null = getProfile();
    if (!existingProfile) {
      const tail4 = phone.slice(-4);
      const defaultNickname = tail4
        ? `用户${tail4}`
        : APP_CONFIG.defaultNickname;
      setProfile({
        nickname: defaultNickname,
        avatar: '',
        status: '在线',
        musicState: null,
      });
    }

    // 初始化 permissions（若不存在）
    const existingPerms: PermissionState = getPermissions();
    if (!existingPerms) {
      setPermissions({ location: false, notification: false });
    }

    logger.info('用户登录成功', { userId });
  }, []);

  const logout = useCallback((): void => {
    clearStoredAuth();
    setUser(null);
    logger.info('用户已登出');
  }, []);

  // 初始化时同步一次（防止 SSR / 首帧延迟）
  useEffect(() => {
    const stored = getAuth();
    if (stored && !user) {
      setUser(stored);
    }
  }, [user]);

  return { isLoggedIn, user, login, logout, checkAuth };
}

export default useAuth;
