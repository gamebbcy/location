import {
  Footprints,
  Car,
  PersonStanding,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MotionState } from '@shared/api.interface';

export interface TimelineSegmentData {
  id: string;
  motionState: MotionState;
  startTime: number;
  endTime: number;
  durationMin: number;
  locationText: string;
  distanceKm: number;
  points: Array<{ lat: number; lng: number }>;
}

interface TimelineSegmentProps {
  segment: TimelineSegmentData;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
}

const motionConfig: Record<
  MotionState,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    dotClass: string;
  }
> = {
  stay: {
    icon: PersonStanding,
    label: '停留',
    color: 'text-[hsl(168_30%_55%)]',
    dotClass: 'bg-[hsl(168_30%_70%)]',
  },
  walk: {
    icon: Footprints,
    label: '步行',
    color: 'text-[hsl(168_65%_42%)]',
    dotClass: 'bg-[hsl(168_65%_42%)]',
  },
  run: {
    icon: Zap,
    label: '跑步',
    color: 'text-[hsl(25_85%_55%)]',
    dotClass: 'bg-[hsl(25_85%_55%)]',
  },
  vehicle: {
    icon: Car,
    label: '乘车',
    color: 'text-[hsl(210_70%_55%)]',
    dotClass: 'bg-[hsl(210_70%_55%)]',
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDuration(min: number): string {
  if (min < 1) return '片刻';
  if (min < 60) return `${Math.round(min)}分钟`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}小时${m}分` : `${h}小时`;
}

const TimelineSegment: React.FC<TimelineSegmentProps> = ({
  segment,
  isActive,
  isLast,
  onClick,
}) => {
  const cfg = motionConfig[segment.motionState];
  const Icon = cfg.icon;

  return (
    <div className="relative flex gap-3 pl-1">
      {/* 竖线 + 圆点 */}
      <div className="relative flex flex-col items-center pt-1">
        <div
          className={cn(
            'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-card shadow-sm',
            cfg.dotClass,
          )}
        >
          <Icon className="size-3.5 text-white" />
        </div>
        {!isLast && (
          <div
            className={cn(
              'w-0.5 flex-1 mt-1',
              isActive ? cfg.dotClass : 'bg-border',
            )}
          />
        )}
      </div>

      {/* 内容 */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group flex flex-1 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          isActive
            ? 'bg-primary/10'
            : 'hover:bg-accent/60 active:bg-accent',
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                isActive ? cfg.color : 'text-foreground',
              )}
            >
              {cfg.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
            </span>
          </div>
          <div className="mt-1 text-sm text-foreground/90 truncate">
            {segment.locationText}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatDuration(segment.durationMin)}</span>
            {segment.motionState !== 'stay' && segment.distanceKm > 0 && (
              <span>
                {segment.distanceKm < 1
                  ? `${Math.round(segment.distanceKm * 1000)}米`
                  : `${segment.distanceKm.toFixed(1)}公里`}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

export default TimelineSegment;
