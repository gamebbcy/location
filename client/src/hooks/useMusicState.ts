import { useCallback, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { type MusicState } from '@client/src/lib/storage';
import { useProfile } from './useProfile';

// 音乐 App 列表常量
export const MUSIC_APPS = [
  { key: 'netease', label: '网易云音乐', brandColor: '#C20C0C' },
  { key: 'qqmusic', label: 'QQ音乐', brandColor: '#31C27C' },
  { key: 'spotify', label: 'Spotify', brandColor: '#1DB954' },
  { key: 'apple', label: 'Apple Music', brandColor: '#FC3C44' },
  { key: 'other', label: '其他', brandColor: '#6B7280' },
] as const;

export type MusicAppKey = (typeof MUSIC_APPS)[number]['key'];

interface UseMusicStateReturn {
  musicState: MusicState | null;
  setMusic: (app: string, song: string) => Promise<void>;
  clearMusic: () => Promise<void>;
  startAutoDetect: () => void;
  stopAutoDetect: () => void;
  isAutoDetecting: boolean;
}

// URL Scheme 跳转函数
export function openMusicApp(app: string, song?: string): void {
  const encodedSong = song ? encodeURIComponent(song) : '';
  let url = '';
  switch (app) {
    case 'netease':
      url = encodedSong
        ? `orpheus://search?keyword=${encodedSong}`
        : 'orpheus://';
      break;
    case 'qqmusic':
      url = encodedSong
        ? `qqmusic://search?key=${encodedSong}`
        : 'qqmusic://';
      break;
    case 'spotify':
      url = encodedSong
        ? `spotify://search?q=${encodedSong}`
        : 'spotify://';
      break;
    case 'apple':
      url = encodedSong
        ? `music://search?term=${encodedSong}`
        : 'music://';
      break;
    case 'other':
    default:
      logger.info('other music app, no url scheme');
      return;
  }
  try {
    window.location.assign(url);
  } catch (err) {
    logger.error('open music app failed', err);
  }
}

export function getMusicAppLabel(app: string): string {
  const found = MUSIC_APPS.find((a) => a.key === app);
  return found?.label ?? '其他';
}

const AUTO_DETECT_INTERVAL_MS = 3000;
const PAUSE_CLEAR_DEBOUNCE_MS = 30000;
const AUTO_DETECT_LS_KEY = 'fl_music_auto_detect';

// 模块级共享状态：多页面实例共享 auto-detect 开关
let autoDetectEnabled = false;
const autoDetectSubscribers = new Set<(v: boolean) => void>();

try {
  autoDetectEnabled = localStorage.getItem(AUTO_DETECT_LS_KEY) === '1';
} catch {
  autoDetectEnabled = false;
}

function setAutoDetectEnabled(value: boolean): void {
  autoDetectEnabled = value;
  try {
    localStorage.setItem(AUTO_DETECT_LS_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
  // 通知所有实例同步状态
  for (const subscriber of autoDetectSubscribers) {
    subscriber(value);
  }
}

export function useMusicState(): UseMusicStateReturn {
  const { profile, updateMusicState } = useProfile();
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(autoDetectEnabled);

  // 订阅模块级 auto-detect 状态变更，保持多实例同步
  useEffect(() => {
    autoDetectSubscribers.add(setIsAutoDetecting);
    return () => {
      autoDetectSubscribers.delete(setIsAutoDetecting);
    };
  }, []);

  const pollTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  // 标记当前 musicState 是否由自动检测设置，手动设置后自动检测不再覆盖
  const isAutoSetRef = useRef<boolean>(false);
  // 上一次检测到的歌曲标识，用于判断是否变化
  const lastDetectedRef = useRef<string>('');

  const clearPendingClearTimer = useCallback((): void => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const handleDetectedPlaying = useCallback(
    (app: string, song: string): void => {
      clearPendingClearTimer();
      // 手动设置优先：当前状态不是自动设置的，就不要覆盖
      if (!isAutoSetRef.current && profile?.musicState) {
        lastDetectedRef.current = `${app}:${song}`;
        return;
      }
      const signature = `${app}:${song}`;
      if (lastDetectedRef.current === signature) return;
      lastDetectedRef.current = signature;
      isAutoSetRef.current = true;
      void updateMusicState({ app, song });
    },
    [clearPendingClearTimer, profile?.musicState, updateMusicState],
  );

  const handleDetectedPaused = useCallback((): void => {
    // 只有自动设置的状态才清除
    if (!isAutoSetRef.current) {
      clearPendingClearTimer();
      return;
    }
    // 已经在倒计时则不重复设置
    if (clearTimerRef.current !== null) return;
    clearTimerRef.current = window.setTimeout(() => {
      clearTimerRef.current = null;
      if (!isAutoSetRef.current) return;
      isAutoSetRef.current = false;
      lastDetectedRef.current = '';
      void updateMusicState(null);
    }, PAUSE_CLEAR_DEBOUNCE_MS);
  }, [clearPendingClearTimer, updateMusicState]);

  const pollMediaSession = useCallback((): void => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    const session = navigator.mediaSession;
    const playbackState = session.playbackState ?? 'none';
    const metadata = session.metadata;

    if (playbackState === 'playing' && metadata) {
      const title = metadata.title?.trim();
      if (title) {
        // 浏览器无法真正识别来源 App，默认标记为 netease（按需求与网易云 URL scheme 关联）
        handleDetectedPlaying('netease', title);
        return;
      }
    }
    // 暂停 / 无播放 / 无歌名
    if (isAutoSetRef.current) {
      handleDetectedPaused();
    }
  }, [handleDetectedPlaying, handleDetectedPaused]);

  const startAutoDetect = useCallback((): void => {
    if (pollTimerRef.current !== null) return;
    if (typeof navigator === 'undefined' || !navigator.mediaSession) {
      logger.info('Media Session API not supported, auto-detect skipped');
      return;
    }
    setAutoDetectEnabled(true);
    setIsAutoDetecting(true);
    // 先检测一次，再进入轮询
    pollMediaSession();
    pollTimerRef.current = window.setInterval(() => {
      pollMediaSession();
    }, AUTO_DETECT_INTERVAL_MS);
  }, [pollMediaSession]);

  const stopAutoDetect = useCallback((): void => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    clearPendingClearTimer();
    setAutoDetectEnabled(false);
    setIsAutoDetecting(false);
  }, [clearPendingClearTimer]);

  const setMusic = useCallback(
    async (app: string, song: string): Promise<void> => {
      // 手动设置：清除自动状态标记和待定的清除定时器
      isAutoSetRef.current = false;
      clearPendingClearTimer();
      lastDetectedRef.current = `${app}:${song}`;
      await updateMusicState({ app, song });
    },
    [clearPendingClearTimer, updateMusicState],
  );

  const clearMusic = useCallback(async (): Promise<void> => {
    isAutoSetRef.current = false;
    clearPendingClearTimer();
    lastDetectedRef.current = '';
    await updateMusicState(null);
  }, [clearPendingClearTimer, updateMusicState]);

  return {
    musicState: profile?.musicState ?? null,
    setMusic,
    clearMusic,
    startAutoDetect,
    stopAutoDetect,
    isAutoDetecting,
  };
}
