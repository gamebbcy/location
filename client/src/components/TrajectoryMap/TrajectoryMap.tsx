import { useMemo, useRef, forwardRef, type ReactElement } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_CONFIG } from '@client/src/config';
import AmapView, {
  type AmapViewRef,
  type AmapPolyline,
} from '@client/src/components/AmapView/AmapView';
import {
  haversineDistance,
} from '@client/src/lib/utils/geo';

export interface TrajectoryPoint {
  id: string;
  dateKey: string;
  lat: number;
  lng: number;
  timestamp: number;
  motionState: string;
}

export interface TrajectoryMapProps {
  pointsByDate: Map<string, TrajectoryPoint[]>;
  selectedDates?: string[];
  center?: { lat: number; lng: number };
  height?: string;
  className?: string;
}

export type TrajectoryMapRef = AmapViewRef;

// 7-day gradient palette (teal / cyan family, warm → cool)
const DAY_COLORS: string[] = [
  'hsl(168 70% 45%)', // Day 0 (today) — primary teal
  'hsl(172 65% 48%)', // Day 1
  'hsl(176 60% 50%)', // Day 2
  'hsl(180 55% 48%)', // Day 3
  'hsl(185 55% 48%)', // Day 4
  'hsl(190 60% 50%)', // Day 5
  'hsl(195 65% 52%)', // Day 6
];

function getColorForDate(dateKey: string, sortedKeys: string[]): string {
  const idx = sortedKeys.indexOf(dateKey);
  if (idx === -1) return DAY_COLORS[0];
  return DAY_COLORS[idx % DAY_COLORS.length];
}

function computeCenter(
  pointsByDate: Map<string, TrajectoryPoint[]>,
): { lat: number; lng: number } | undefined {
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;
  for (const list of pointsByDate.values()) {
    for (const p of list) {
      sumLat += p.lat;
      sumLng += p.lng;
      count += 1;
    }
  }
  if (count === 0) return undefined;
  return { lat: sumLat / count, lng: sumLng / count };
}

// Simple SVG trajectory fallback (no amap key)
function SvgTrajectoryFallback({
  pointsByDate,
  sortedKeys,
}: {
  pointsByDate: Map<string, TrajectoryPoint[]>;
  sortedKeys: string[];
}): ReactElement {
  const allPts: TrajectoryPoint[] = [];
  for (const list of pointsByDate.values()) {
    allPts.push(...list);
  }

  if (allPts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="flex flex-col items-center gap-3 text-muted-foreground p-6 text-center">
          <div className="size-12 rounded-full bg-accent flex items-center justify-center">
            <MapPin className="size-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">暂无轨迹数据</p>
          <p className="text-xs">开启位置记录后，你的活动轨迹将显示在这里</p>
        </div>
      </div>
    );
  }

  const lats = allPts.map((p) => p.lat);
  const lngs = allPts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const padLat = Math.max((maxLat - minLat) * 0.15, 0.0005);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.0005);

  const latRange = maxLat - minLat + padLat * 2;
  const lngRange = maxLng - minLng + padLng * 2;

  const width = 400;
  const height = 300;

  const toX = (lng: number): number =>
    ((lng - minLng + padLng) / lngRange) * width;
  const toY = (lat: number): number =>
    height - ((lat - minLat + padLat) / latRange) * height;

  // Estimate total distance
  let totalKm = 0;
  for (const list of pointsByDate.values()) {
    for (let i = 1; i < list.length; i += 1) {
      totalKm += haversineDistance(
        list[i - 1].lat,
        list[i - 1].lng,
        list[i].lat,
        list[i].lng,
      );
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3 p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-sm rounded-xl bg-accent/40"
        preserveAspectRatio="xMidYMid meet"
      >
        {sortedKeys.map((dateKey) => {
          const pts = pointsByDate.get(dateKey) ?? [];
          if (pts.length < 2) return null;
          const path = pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.lng)} ${toY(p.lat)}`)
            .join(' ');
          const color = getColorForDate(dateKey, sortedKeys);
          return (
            <path
              key={dateKey}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {sortedKeys.map((dateKey) => {
          const pts = pointsByDate.get(dateKey) ?? [];
          if (pts.length === 0) return null;
          const first = pts[0];
          const last = pts[pts.length - 1];
          const color = getColorForDate(dateKey, sortedKeys);
          return (
            <g key={`dots-${dateKey}`}>
              <circle cx={toX(first.lng)} cy={toY(first.lat)} r="4" fill={color} />
              <circle cx={toX(last.lng)} cy={toY(last.lat)} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
      <div className="text-xs text-muted-foreground">
        共 {allPts.length} 个轨迹点 · 约 {totalKm.toFixed(2)} 公里
      </div>
    </div>
  );
}

const TrajectoryMap = forwardRef<TrajectoryMapRef, TrajectoryMapProps>(
  function TrajectoryMap(
    { pointsByDate, selectedDates, center, height = '400px', className },
    ref,
  ) {
    const hasKey = useMemo(
      () => {
        const key = APP_CONFIG.amapKey as string;
        return Boolean(key && key.trim());
      },
      [],
    );

    const sortedKeys = useMemo(() => {
      const keys = Array.from(pointsByDate.keys()).sort();
      if (selectedDates && selectedDates.length > 0) {
        const set = new Set(selectedDates);
        return keys.filter((k) => set.has(k));
      }
      return keys;
    }, [pointsByDate, selectedDates]);

    const polylines: AmapPolyline[] = useMemo(() => {
      return sortedKeys
        .map((dateKey) => {
          const pts = pointsByDate.get(dateKey) ?? [];
          if (pts.length < 2) return null;
          return {
            id: `traj-${dateKey}`,
            path: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
            color: getColorForDate(dateKey, sortedKeys),
            weight: 4,
          };
        })
        .filter((p) => p !== null) as AmapPolyline[];
    }, [pointsByDate, sortedKeys]);

    const mapCenter = useMemo(() => {
      if (center) return center;
      return computeCenter(pointsByDate);
    }, [center, pointsByDate]);

    const containerStyle = useMemo(
      () => ({ height, minHeight: height }),
      [height],
    );

    // Debug log
    useMemo(() => {
      logger.debug('TrajectoryMap render', {
        dateCount: sortedKeys.length,
        polylineCount: polylines.length,
        hasKey,
      });
    }, [sortedKeys.length, polylines.length, hasKey]);

    if (!hasKey) {
      return (
        <div
          className={cn(
            'w-full overflow-hidden rounded-xl bg-muted/30',
            className,
          )}
          style={containerStyle}
        >
          <SvgTrajectoryFallback
            pointsByDate={pointsByDate}
            sortedKeys={sortedKeys}
          />
        </div>
      );
    }

    return (
      <div
        className={cn('w-full overflow-hidden rounded-xl', className)}
        style={containerStyle}
      >
        <AmapView
          ref={ref}
          center={mapCenter}
          zoom={15}
          polylines={polylines}
          className="w-full h-full"
        />
      </div>
    );
  },
);

export default TrajectoryMap;
