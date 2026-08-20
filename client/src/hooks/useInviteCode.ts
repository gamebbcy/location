import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { friendRepository } from '@client/src/data/friend-repository';

interface InviteCodeInfo {
  code: string;
  expiresAt: number;
}

interface StoredInviteCode extends InviteCodeInfo {
  userId: string;
}

const CACHE_PREFIX = 'fl_friend_invite:';
const LEGACY_CODE_KEY = 'fl_my_invite_code';
const LEGACY_EXPIRY_KEY = 'fl_my_invite_expires_at';
const EXPIRY_SAFETY_MS = 1_000;

const memoryCache = new Map<string, InviteCodeInfo>();
const pendingRequests = new Map<string, Promise<InviteCodeInfo>>();
const listeners = new Map<string, Set<(invite: InviteCodeInfo) => void>>();

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

function isUsable(invite: InviteCodeInfo | null | undefined): invite is InviteCodeInfo {
  return Boolean(
    invite?.code
      && Number.isFinite(invite.expiresAt)
      && invite.expiresAt > Date.now() + EXPIRY_SAFETY_MS,
  );
}

function readCachedInvite(userId: string): InviteCodeInfo | null {
  const memoryInvite = memoryCache.get(userId);
  if (isUsable(memoryInvite)) return memoryInvite;
  memoryCache.delete(userId);

  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredInviteCode;
    if (stored.userId !== userId || !isUsable(stored)) {
      localStorage.removeItem(cacheKey(userId));
      return null;
    }
    const invite = { code: stored.code, expiresAt: stored.expiresAt };
    memoryCache.set(userId, invite);
    return invite;
  } catch {
    localStorage.removeItem(cacheKey(userId));
    return null;
  }
}

function publishInvite(userId: string, invite: InviteCodeInfo): void {
  memoryCache.set(userId, invite);
  try {
    const stored: StoredInviteCode = { userId, ...invite };
    localStorage.setItem(cacheKey(userId), JSON.stringify(stored));
    // 清掉旧版在浏览器本地随机生成的第二套邀请码。
    localStorage.removeItem(LEGACY_CODE_KEY);
    localStorage.removeItem(LEGACY_EXPIRY_KEY);
  } catch {
    // localStorage 不可用时仍保留当前页面内的共享缓存。
  }
  listeners.get(userId)?.forEach((listener) => listener(invite));
}

async function getOrCreateInvite(userId: string, force = false): Promise<InviteCodeInfo> {
  if (!force) {
    const cached = readCachedInvite(userId);
    if (cached) return cached;
  }

  const pending = pendingRequests.get(userId);
  if (pending) return pending;

  const request = friendRepository.createInvite()
    .then((invite) => {
      publishInvite(userId, invite);
      return invite;
    })
    .finally(() => {
      pendingRequests.delete(userId);
    });

  pendingRequests.set(userId, request);
  return request;
}

function subscribe(userId: string, listener: (invite: InviteCodeInfo) => void): () => void {
  const userListeners = listeners.get(userId) ?? new Set();
  userListeners.add(listener);
  listeners.set(userId, userListeners);
  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

/**
 * 全应用唯一的邀请码状态。
 * 所有页面复用同一份由 Supabase 创建的短期邀请码，刷新后同步通知其他页面实例。
 */
export function useInviteCode(userId: string | null | undefined) {
  const [invite, setInvite] = useState<InviteCodeInfo | null>(() => (
    userId ? readCachedInvite(userId) : null
  ));

  const load = useCallback(async (): Promise<InviteCodeInfo> => {
    if (!userId) throw new Error('请先登录');
    return getOrCreateInvite(userId);
  }, [userId]);

  const refresh = useCallback(async (): Promise<InviteCodeInfo> => {
    if (!userId) throw new Error('请先登录');
    return getOrCreateInvite(userId, true);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setInvite(null);
      return;
    }

    setInvite(readCachedInvite(userId));
    const unsubscribe = subscribe(userId, setInvite);
    void load().then(setInvite).catch((error) => {
      logger.error('加载邀请码失败', error);
    });
    return unsubscribe;
  }, [load, userId]);

  useEffect(() => {
    if (!invite?.expiresAt || !userId) return;
    const delay = Math.max(0, invite.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      void refresh().catch((error) => logger.error('自动刷新邀请码失败', error));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [invite?.expiresAt, refresh, userId]);

  return {
    code: invite?.code ?? '',
    expiresAt: invite?.expiresAt ?? null,
    load,
    refresh,
  };
}
