import { Music } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { MUSIC_APPS, openMusicApp } from '@client/src/hooks/useMusicState';
import type { MusicState } from '@shared/api.interface';

interface MusicStateCardProps {
  musicState: MusicState;
  playing?: boolean;
}

function getMusicAppInfo(app: string): {
  label: string;
  brandColor: string;
} {
  const found = MUSIC_APPS.find((a) => a.key === app);
  if (found) return { label: found.label, brandColor: found.brandColor };
  // 中文/别名兼容
  const lower = app.toLowerCase();
  if (lower.includes('网易') || lower.includes('netease')) {
    return { label: '网易云音乐', brandColor: '#C20C0C' };
  }
  if (lower.includes('qq') || lower.includes('tencent')) {
    return { label: 'QQ音乐', brandColor: '#31C27C' };
  }
  if (lower.includes('spotify')) {
    return { label: 'Spotify', brandColor: '#1DB954' };
  }
  if (lower.includes('apple')) {
    return { label: 'Apple Music', brandColor: '#FC3C44' };
  }
  return { label: app || '其他', brandColor: '#6B7280' };
}

const MusicStateCard: React.FC<MusicStateCardProps> = ({
  musicState,
  playing = true,
}) => {
  const info = getMusicAppInfo(musicState.app);

  const handleOpen = (): void => {
    try {
      openMusicApp(musicState.app, musicState.song);
    } catch (err) {
      logger.error('MusicStateCard: open app failed', err);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent
        className={cn(
          'flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/40 transition-colors',
        )}
        onClick={handleOpen}
      >
        <div
          className="flex size-11 items-center justify-center rounded-xl text-white shadow-sm shrink-0"
          style={{ backgroundColor: info.brandColor }}
        >
          <Music
            className={cn(
              'size-5',
              playing ? 'animate-[marker-music-pulse_1.6s_ease-in-out_infinite]' : 'opacity-60',
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {musicState.song}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {info.label}
          </div>
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 text-[10px] px-2 py-0 h-5"
        >
          {playing ? '正在听' : '已暂停'}
        </Badge>
      </CardContent>
    </Card>
  );
};

export default MusicStateCard;
