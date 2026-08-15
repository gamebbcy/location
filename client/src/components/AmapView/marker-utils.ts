import type { MotionState } from '@shared/api.interface';
import type { MusicState } from '@shared/api.interface';
import { MUSIC_APPS } from '@client/src/hooks/useMusicState';

export interface MarkerAvatarOptions {
  avatarUrl?: string;
  name: string;
  motionState?: MotionState;
  isOnline?: boolean;
  isSelf?: boolean;
  showName?: boolean;
  musicState?: MusicState | null;
  musicPlaying?: boolean;
  isShaking?: boolean;
  showPokeRipple?: boolean;
}

const motionColors: Record<MotionState, string> = {
  stay: 'hsl(168 30% 70%)',
  walk: 'hsl(168 65% 42%)',
  run: 'hsl(25 85% 55%)',
  vehicle: 'hsl(210 70% 55%)',
};

const motionIcons: Record<MotionState, string> = {
  stay: '●',
  walk: '🚶',
  run: '🏃',
  vehicle: '🚗',
};

function getMusicBrandColor(app: string): string {
  const found = MUSIC_APPS.find((a) => a.key === app);
  if (found) return found.brandColor;
  // 兼容中文 App 名
  const lower = app.toLowerCase();
  if (lower.includes('网易') || lower.includes('netease')) return '#C20C0C';
  if (lower.includes('qq') || lower.includes('tencent')) return '#31C27C';
  if (lower.includes('spotify')) return '#1DB954';
  if (lower.includes('apple')) return '#FC3C44';
  return '#6B7280';
}

const POKE_STYLES_ID = 'amap-poke-styles';

function ensurePokeStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(POKE_STYLES_ID)) return;

  const style = document.createElement('style');
  style.id = POKE_STYLES_ID;
  style.textContent = `
    @keyframes amap-marker-shake {
      0%, 100% { transform: rotate(0deg); }
      20% { transform: rotate(-5deg); }
      40% { transform: rotate(5deg); }
      60% { transform: rotate(-5deg); }
      80% { transform: rotate(5deg); }
    }
    .amap-marker-shake {
      animation: amap-marker-shake 0.5s ease-in-out !important;
    }
    @keyframes amap-poke-ripple {
      0% { transform: scale(0.8); opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    .amap-poke-ripple {
      animation: amap-poke-ripple 0.8s ease-out forwards !important;
    }
    @keyframes amap-cooldown-flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .amap-marker-cooldown-flash {
      animation: amap-cooldown-flash 0.3s ease-in-out 2 !important;
    }
  `;
  document.head.appendChild(style);
}

export function buildMarkerContent(opts: MarkerAvatarOptions): string {
  const {
    avatarUrl,
    name,
    motionState = 'stay',
    isOnline = true,
    isSelf = false,
    showName = true,
    musicState = null,
    musicPlaying = true,
    isShaking = false,
    showPokeRipple = false,
  } = opts;

  ensurePokeStyles();

  const initial = name.slice(0, 1).toUpperCase();
  const color = motionColors[motionState];
  const icon = motionIcons[motionState];
  const hasMusic = !!musicState?.song;
  const musicColor = hasMusic ? getMusicBrandColor(musicState.app) : '';

  const glowStyle = isSelf
    ? `box-shadow: 0 0 0 3px hsl(152 60% 40% / 0.3), 0 0 12px 4px hsl(152 60% 40% / 0.5);`
    : '';

  const grayscale = isOnline ? '' : 'filter: grayscale(100%); opacity: 0.6;';

  const shakeClass = isShaking ? 'amap-marker-shake' : '';
  const rippleHtml = showPokeRipple
    ? `<div class="amap-poke-ripple" style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; border-radius: 50%; border: 3px solid hsl(168 65% 42%); pointer-events: none;"></div>`
    : '';

  const musicBadge = hasMusic
    ? `
        <div style="
          position: absolute;
          bottom: -2px; right: -2px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: ${musicColor};
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px;
          color: white;
          font-weight: bold;
          ${musicPlaying ? 'animation: marker-music-pulse 1.6s ease-in-out infinite;' : 'opacity: 0.5;'}
        ">♪</div>
      `
    : '';

  const musicLine = hasMusic
    ? `<div style="
        margin-top: 2px;
        padding: 1px 6px;
        background: ${musicColor};
        color: white;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      ">正在听：${musicState.song}</div>`
    : '';

  const nameLine = showName
    ? `<div style="
        margin-top: 2px;
        padding: 1px 6px;
        background: rgba(255,255,255,0.95);
        border-radius: 10px;
        font-size: 11px;
        font-weight: 500;
        color: hsl(168 20% 20%);
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        filter: drop-shadow(0 1px 1px rgba(0,0,0,0.05));
      ">${name}</div>`
    : '';

  return `
    <style>
      @keyframes marker-music-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 ${musicColor}55; }
        50% { transform: scale(1.08); box-shadow: 0 0 0 4px ${musicColor}22; }
      }
    </style>
    <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none; min-width: 44px;">
      <div class="${shakeClass}" style="position: relative; width: 40px; height: 40px; transform-origin: center bottom; pointer-events: auto; cursor: pointer;">
        ${rippleHtml}
        <div style="
          width: 40px; height: 40px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid ${color};
          background: hsl(168 20% 90%);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 600; color: hsl(168 20% 30%);
          ${glowStyle}
          ${grayscale}
        ">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`
              : `<span>${initial}</span>`
          }
        </div>
        <div style="
          position: absolute;
          top: -2px; right: -2px;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          font-size: 8px;
        ">${icon}</div>
        ${musicBadge}
      </div>
      ${musicLine || nameLine}
    </div>
  `;
}
