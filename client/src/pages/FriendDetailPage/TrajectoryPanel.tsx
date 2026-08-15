import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Phone, Navigation, Zap } from 'lucide-react';
import TimelineItem from './TimelineItem';
import {
  formatDuration,
  type TrajectorySegment,
} from './trajectory-utils';

interface TrajectoryPanelProps {
  segments: TrajectorySegment[];
  totalDistanceKm: number;
  totalDurationMs: number;
  stayCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  activeSegmentId: string | null;
  isPlaying: boolean;
  onPlaySegment: (segmentId: string) => void;
  phoneNumber?: string;
  onCall: () => void;
  onNavigate: () => void;
  onAlert: () => void;
}

const TrajectoryPanel: React.FC<TrajectoryPanelProps> = ({
  segments,
  totalDistanceKm,
  totalDurationMs,
  stayCount,
  isExpanded,
  onToggleExpand,
  activeSegmentId,
  isPlaying,
  onPlaySegment,
  onCall,
  onNavigate,
  onAlert,
}) => {
  return (
    <div
      className={cn(
        'absolute left-0 right-0 bottom-0 z-20',
        'bg-card/90 backdrop-blur-xl rounded-t-3xl shadow-[0_-4px_24px_rgba(0_0_0_0.08)]',
        'transition-all duration-300 ease-out',
        isExpanded ? 'h-[80vh]' : 'h-[45vh]',
        'flex flex-col',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex flex-col items-center pt-2 pb-1 shrink-0 active:opacity-70"
        aria-label={isExpanded ? '收起面板' : '展开面板'}
      >
        <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 mb-1" />
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          {isExpanded ? (
            <>
              <span>收起</span>
              <ChevronDown className="size-3.5" />
            </>
          ) : (
            <>
              <span>展开</span>
              <ChevronUp className="size-3.5" />
            </>
          )}
        </div>
      </button>

      {/* Panel header: today summary */}
      <div className="px-5 pt-1 pb-3 shrink-0">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">
            今日活动轨迹
          </h2>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {totalDistanceKm.toFixed(1)}km
            </span>
            <span className="mx-1.5">·</span>
            <span>{formatDuration(totalDurationMs)}</span>
          </div>
        </div>
        <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
          <span>停留 {stayCount} 次</span>
          <span>共 {segments.length} 段行程</span>
        </div>
      </div>

      {/* Timeline list */}
      <div
        className={cn(
          'flex-1 overflow-y-auto px-3',
          'scrollbar-thin scrollbar-thumb-muted-foreground/20',
        )}
      >
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">今日暂无轨迹数据</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-4">
            {segments.map((seg) => (
              <TimelineItem
                key={seg.id}
                segment={seg}
                isActive={activeSegmentId === seg.id}
                isPlaying={activeSegmentId === seg.id && isPlaying}
                onPlay={() => onPlaySegment(seg.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom quick actions */}
      <div className="px-5 py-3 border-t border-border/60 bg-card/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3" data-ai-section-type="button">
          {/* Call button - most prominent */}
          <button
            type="button"
            onClick={onCall}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm active:scale-[0.97] transition-transform"
          >
            <Phone className="size-5" />
            <span>打电话</span>
          </button>

          {/* Navigate */}
          <button
            type="button"
            onClick={onNavigate}
            className="flex flex-col items-center justify-center size-12 rounded-xl bg-accent text-accent-foreground active:scale-95 transition-transform"
            aria-label="导航"
          >
            <Navigation className="size-5" />
          </button>

          {/* Alert */}
          <button
            type="button"
            onClick={onAlert}
            className="flex flex-col items-center justify-center size-12 rounded-xl bg-destructive/10 text-destructive active:scale-95 transition-transform"
            aria-label="强提醒"
          >
            <Zap className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrajectoryPanel;
