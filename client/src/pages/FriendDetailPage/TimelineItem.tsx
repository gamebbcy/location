import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MOTION_COLORS,
  MOTION_ICONS,
  MOTION_LABELS,
  formatTimeRange,
  formatDuration,
  type TrajectorySegment,
} from './trajectory-utils';

interface TimelineItemProps {
  segment: TrajectorySegment;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  segment,
  isActive,
  isPlaying,
  onPlay,
}) => {
  const color = MOTION_COLORS[segment.motionState];
  const isStay = segment.motionState === 'stay';
  const duration = segment.endTime - segment.startTime;

  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
        'hover:bg-accent/60 active:scale-[0.98]',
        isActive && 'bg-accent ring-1 ring-primary/20',
      )}
    >
      {/* Left: status icon + timeline dot */}
      <div className="relative flex flex-col items-center">
        <div
          className="flex size-10 items-center justify-center rounded-full text-base shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {MOTION_ICONS[segment.motionState]}
        </div>
      </div>

      {/* Middle: info */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">
            {MOTION_LABELS[segment.motionState]}
          </span>
          {isStay && segment.locationLabel && (
            <span className="text-xs text-muted-foreground truncate">
              · {segment.locationLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatTimeRange(segment.startTime, segment.endTime)}
          </span>
          <span className="text-xs text-muted-foreground/60">·</span>
          <span className="text-xs text-muted-foreground">
            {isStay ? formatDuration(duration) : `${segment.distanceKm.toFixed(1)}公里`}
          </span>
        </div>
      </div>

      {/* Right: play button */}
      <div
        className={cn(
          'flex size-8 items-center justify-center rounded-full shrink-0 transition-colors',
          isPlaying
            ? 'bg-primary text-primary-foreground'
            : 'bg-accent text-foreground hover:bg-primary/10 hover:text-primary',
        )}
      >
        <Play className="size-4" fill="currentColor" />
      </div>
    </button>
  );
};

export default TimelineItem;
