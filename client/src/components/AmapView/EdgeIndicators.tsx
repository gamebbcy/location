import { memo, useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface EdgeFriend {
  id: string;
  lat: number;
  lng: number;
  avatarUrl?: string;
  name: string;
  isOnline?: boolean;
  /** 距离，单位 km，用于控制透明度 */
  distanceKm?: number;
}

interface EdgeIndicatorItem extends EdgeFriend {
  /** 在边缘上的位置比例，0~1 */
  position: number;
  /** 方位角 0~360° */
  bearing: number;
  /** 在哪一侧 */
  side: 'top' | 'right' | 'bottom' | 'left';
}

interface EdgeIndicatorsProps {
  /** 视野外好友列表（含 distanceKm / bearing / side / position 预计算） */
  friends: EdgeIndicatorItem[];
  /** 点击边缘头像回调 */
  onAvatarClick?: (friend: EdgeFriend) => void;
  /** 头像大小 px，默认 36 */
  avatarSize?: number;
  /** 边缘内边距 px，默认 12 */
  edgeInset?: number;
}

/**
 * 将同一边的多个好友沿边缘均匀分布。
 * 当好友数量 > 1 时，把 position 做「拉伸 + 居中」处理，避免挤在角落。
 */
function spreadAlongEdge(items: EdgeIndicatorItem[]): EdgeIndicatorItem[] {
  if (items.length <= 1) return items;

  const sorted = [...items].sort((a, b) => a.position - b.position);
  const spread: EdgeIndicatorItem[] = [];
  const total = sorted.length;
  const margin = 0.08; // 两端各留 8% 避免贴角

  for (let i = 0; i < total; i++) {
    const t = total === 1 ? 0.5 : margin + (i * (1 - 2 * margin)) / (total - 1);
    spread.push({ ...sorted[i], position: t });
  }

  return spread;
}

const EdgeIndicators: React.FC<EdgeIndicatorsProps> = ({
  friends,
  onAvatarClick,
  avatarSize = 36,
  edgeInset = 12,
}) => {
  // 按侧分组
  const groups = useMemo(() => {
    const raw: Record<EdgeIndicatorItem['side'], EdgeIndicatorItem[]> = {
      top: [],
      right: [],
      bottom: [],
      left: [],
    };
    for (const f of friends) {
      raw[f.side].push(f);
    }
    return {
      top: spreadAlongEdge(raw.top),
      right: spreadAlongEdge(raw.right),
      bottom: spreadAlongEdge(raw.bottom),
      left: spreadAlongEdge(raw.left),
    };
  }, [friends]);

  const renderAvatar = (friend: EdgeIndicatorItem): React.ReactNode => {
    const opacity =
      friend.distanceKm !== undefined
        ? Math.max(0.55, Math.min(1, 1 - friend.distanceKm / 20))
        : 1;

    return (
      <button
        type="button"
        onClick={() => onAvatarClick?.(friend)}
        className="group relative flex shrink-0 items-center justify-center rounded-full bg-white/60 p-0.5 shadow-lg backdrop-blur-md transition-transform active:scale-95"
        style={{ opacity, width: avatarSize, height: avatarSize }}
        aria-label={`定位到 ${friend.name}`}
      >
        {/* 方向箭头：以头像中心为原点旋转，指向好友方位 */}
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 text-primary drop-shadow-[0_1px_2px_rgba(0_0_0_0.3)]"
          style={{
            transform: `translate(-50%, -50%) rotate(${friend.bearing}deg) translateY(-${avatarSize / 2 + 2}px)`,
            transformOrigin: '50% 50%',
          }}
        >
          <Navigation className="size-5 stroke-[2.5px]" />
        </span>

        <Avatar
          className={cn(
            'border-2 border-white shadow-sm',
            !friend.isOnline && 'grayscale opacity-60',
          )}
          style={{ width: avatarSize - 4, height: avatarSize - 4 }}
        >
          <AvatarImage src={friend.avatarUrl} alt={friend.name} />
          <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
            {friend.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>

        {/* 在线点 */}
        {friend.isOnline && (
          <span className="absolute -bottom-0 -right-0 size-2.5 rounded-full border-2 border-white bg-[hsl(152_60%_40%)] shadow-sm" />
        )}
      </button>
    );
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      data-slot="edge-indicators"
    >
      {/* Top edge */}
      <div
        className="pointer-events-auto absolute left-0 right-0 flex justify-center"
        style={{ top: edgeInset }}
      >
        <div className="relative flex w-full justify-center">
          {groups.top.map((f) => (
            <div
              key={f.id}
              className="absolute"
              style={{ left: `${f.position * 100}%`, transform: 'translateX(-50%)' }}
            >
              {renderAvatar(f)}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom edge */}
      <div
        className="pointer-events-auto absolute left-0 right-0 flex justify-center"
        style={{ bottom: edgeInset }}
      >
        <div className="relative flex w-full justify-center">
          {groups.bottom.map((f) => (
            <div
              key={f.id}
              className="absolute"
              style={{ left: `${f.position * 100}%`, transform: 'translateX(-50%)' }}
            >
              {renderAvatar(f)}
            </div>
          ))}
        </div>
      </div>

      {/* Left edge */}
      <div
        className="pointer-events-auto absolute top-0 bottom-0 flex flex-col items-center"
        style={{ left: edgeInset }}
      >
        <div className="relative flex h-full flex-col items-center">
          {groups.left.map((f) => (
            <div
              key={f.id}
              className="absolute"
              style={{ top: `${f.position * 100}%`, transform: 'translateY(-50%)' }}
            >
              {renderAvatar(f)}
            </div>
          ))}
        </div>
      </div>

      {/* Right edge */}
      <div
        className="pointer-events-auto absolute top-0 bottom-0 flex flex-col items-center"
        style={{ right: edgeInset }}
      >
        <div className="relative flex h-full flex-col items-center">
          {groups.right.map((f) => (
            <div
              key={f.id}
              className="absolute"
              style={{ top: `${f.position * 100}%`, transform: 'translateY(-50%)' }}
            >
              {renderAvatar(f)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(EdgeIndicators);
