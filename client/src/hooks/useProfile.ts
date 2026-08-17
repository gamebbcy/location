import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getProfile,
  setProfile as setStoredProfile,
  getSensitiveWords,
  type ProfileState,
  type MusicState,
} from '@client/src/lib/storage';
import { filterSensitiveWords } from '@client/src/lib/utils/sensitive';
import { APP_CONFIG } from '@client/src/config';
import { useWebSocket } from './useWebSocket';
import { isSupabaseConfigured } from '@client/src/lib/supabase';
import { profileRepository } from '@client/src/data/profile-repository';

interface UseProfileReturn {
  profile: ProfileState | null;
  statusExpireAt: number | null;
  statusRemainingText: string | null;
  loadProfile: () => void;
  updateNickname: (nickname: string) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
  updateStatus: (status: string, durationMinutes?: number) => Promise<void>;
  updateMusicState: (musicState: MusicState | null) => Promise<void>;
}

const STATUS_EXPIRE_KEY = 'fl_status_expire_at';

function filterOnSave(text: string): string {
  try {
    return filterSensitiveWords(text, getSensitiveWords());
  } catch {
    return text;
  }
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '已过期';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
}

function initialProfile(): ProfileState {
  return getProfile() ?? {
    nickname: APP_CONFIG.defaultNickname,
    avatar: '',
    status: '在线',
    musicState: null,
  };
}

export function useProfile(): UseProfileReturn {
  const initial = useRef(initialProfile());
  const [profile, setProfileState] = useState<ProfileState>(initial.current);
  const profileRef = useRef(initial.current);
  const [statusExpireAt, setStatusExpireAt] = useState<number | null>(() => {
    const stored = localStorage.getItem(STATUS_EXPIRE_KEY);
    return stored ? Number(stored) : null;
  });
  const [statusRemainingText, setStatusRemainingText] = useState<string | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const { send } = useWebSocket();

  const applyProfile = useCallback((next: ProfileState) => {
    profileRef.current = next;
    setProfileState(next);
    setStoredProfile(next);
  }, []);

  const saveProfile = useCallback((next: ProfileState) => {
    applyProfile(next);
    if (isSupabaseConfigured) {
      void profileRepository.updateMine(next).catch((error) => {
        logger.error('同步个人资料到 Supabase 失败', error);
      });
    }
  }, [applyProfile]);

  const notifyStatusUpdate = useCallback((next: ProfileState) => {
    send('status:update', { status: next.status, musicState: next.musicState });
  }, [send]);

  const loadProfile = useCallback(() => {
    const cached = initialProfile();
    applyProfile(cached);
    if (isSupabaseConfigured) {
      void profileRepository.getMine()
        .then(applyProfile)
        .catch((error) => logger.error('从 Supabase 加载个人资料失败', error));
    }
  }, [applyProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
    if (!statusExpireAt) return;

    const delay = statusExpireAt - Date.now();
    if (delay <= 0) {
      const next = { ...profileRef.current, status: '在线' };
      saveProfile(next);
      notifyStatusUpdate(next);
      setStatusExpireAt(null);
      localStorage.removeItem(STATUS_EXPIRE_KEY);
      return;
    }

    statusTimerRef.current = window.setTimeout(() => {
      const next = { ...profileRef.current, status: '在线' };
      saveProfile(next);
      notifyStatusUpdate(next);
      setStatusExpireAt(null);
      localStorage.removeItem(STATUS_EXPIRE_KEY);
    }, delay);

    return () => {
      if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
    };
  }, [notifyStatusUpdate, saveProfile, statusExpireAt]);

  useEffect(() => {
    if (!statusExpireAt) {
      setStatusRemainingText(null);
      return;
    }
    const update = () => {
      const remaining = statusExpireAt - Date.now();
      setStatusRemainingText(remaining > 0 ? `还剩 ${formatRemaining(remaining)}` : null);
    };
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [statusExpireAt]);

  const updateNickname = useCallback(async (nickname: string) => {
    saveProfile({ ...profileRef.current, nickname: filterOnSave(nickname) });
  }, [saveProfile]);

  const updateAvatar = useCallback(async (avatar: string) => {
    saveProfile({ ...profileRef.current, avatar });
  }, [saveProfile]);

  const updateStatus = useCallback(async (status: string, durationMinutes?: number) => {
    const next = { ...profileRef.current, status: filterOnSave(status) };
    saveProfile(next);
    notifyStatusUpdate(next);

    if (durationMinutes && durationMinutes > 0) {
      const expiresAt = Date.now() + durationMinutes * 60_000;
      setStatusExpireAt(expiresAt);
      localStorage.setItem(STATUS_EXPIRE_KEY, String(expiresAt));
    } else {
      setStatusExpireAt(null);
      localStorage.removeItem(STATUS_EXPIRE_KEY);
    }
  }, [notifyStatusUpdate, saveProfile]);

  const updateMusicState = useCallback(async (musicState: MusicState | null) => {
    const next = { ...profileRef.current, musicState };
    saveProfile(next);
    notifyStatusUpdate(next);
  }, [notifyStatusUpdate, saveProfile]);

  return {
    profile,
    statusExpireAt,
    statusRemainingText,
    loadProfile,
    updateNickname,
    updateAvatar,
    updateStatus,
    updateMusicState,
  };
}
