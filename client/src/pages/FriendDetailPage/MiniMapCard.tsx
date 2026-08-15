import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Expand, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import AmapView, {
  type AmapMarker,
  type AmapPolyline,
} from '@client/src/components/AmapView/AmapView';
import { buildMarkerContent } from '@client/src/components/AmapView/marker-utils';
import type { FriendLocationUpdate } from '@shared/api.interface';
import { APP_CONFIG } from '@client/src/config';
import { trajectoriesStore } from '@client/src/lib/storage';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface MiniMapCardProps {
  location: FriendLocationUpdate | undefined;
  nickname: string;
  avatar?: string;
  online: boolean;
  friendId: string;
}

type DateRangeKey = 'today' | 'yesterday' | 'dayBefore' | 'week';

const DATE_TABS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'dayBefore', label: '前天' },
  { key: 'week', label: '近7天' },
];

const MiniMapCard: React.FC<MiniMapCardProps> = ({
  location,
  nickname,
  avatar,
  online,
  friendId,
}) => {
  const [dateRange, setDateRange] = useState<DateRangeKey>('today');
  const [trajectoryPoints, setTrajectoryPoints] = useState<
    Array<{ lat: number; lng: number }>
  >([]);

  // Load trajectory for date range
  useEffect(() => {
    if (!APP_CONFIG.amapKey) return;
    let cancelled = false;
    void trajectoriesStore
      .getAll<{
        friendId: string;
        lat: number;
        lng: number;
        timestamp: number;
      }>()
      .then((all) => {
        if (cancelled) return;
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        let cutoffMs = dayMs; // today default
        if (dateRange === 'yesterday') cutoffMs = dayMs * 2;
        else if (dateRange === 'dayBefore') cutoffMs = dayMs * 3;
        else if (dateRange === 'week') cutoffMs = dayMs * 7;
        const filtered = all
          .filter(
            (t) =>
              t.friendId === friendId &&
              now - (t.timestamp || 0) <= cutoffMs,
          )
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .map((t) => ({ lat: t.lat, lng: t.lng }));
        setTrajectoryPoints(filtered);
      })
      .catch((err: unknown) => {
        logger.error('load trajectory failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange, friendId]);

  const mapMarkers: AmapMarker[] = useMemo(() => {
    if (!location) return [];
    return [
      {
        id: 'friend',
        lat: location.lat,
        lng: location.lng,
        content: buildMarkerContent({
          avatarUrl: avatar,
          name: nickname,
          motionState: location.motionState,
          isOnline: online,
        }),
        title: nickname,
      },
    ];
  }, [location, nickname, avatar, online]);

  const polylines: AmapPolyline[] = useMemo(() => {
    if (trajectoryPoints.length < 2) return [];
    return [
      {
        id: 'trajectory',
        path: trajectoryPoints,
        color: 'hsl(168 65% 42%)',
        weight: 4,
      },
    ];
  }, [trajectoryPoints]);

  const mapCenter = useMemo(() => {
    if (location) return { lat: location.lat, lng: location.lng };
    return undefined;
  }, [location]);

  const handleExpand = (): void => {
    // 简化版：跳转到地图页面
    const url = `/map?friendId=${encodeURIComponent(friendId)}`;
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        {/* 日期选择 Tab */}
        <div className="px-4 pt-3 pb-2">
          <Tabs
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRangeKey)}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-4 h-8">
              {DATE_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* 小地图 */}
        <div className="relative mx-3 mb-3 overflow-hidden rounded-xl">
          <div
            className={cn(
              'w-full bg-muted/30',
              APP_CONFIG.amapKey ? 'h-[200px]' : 'h-[160px]',
            )}
          >
            {APP_CONFIG.amapKey ? (
              <AmapView
                center={mapCenter}
                zoom={15}
                markers={mapMarkers}
                polylines={polylines}
                className="h-full w-full rounded-none"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center">
                <div className="size-12 rounded-full bg-accent flex items-center justify-center">
                  <MapPin className="size-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  请配置高德地图 Key
                </p>
                <p className="text-xs text-muted-foreground">
                  配置后可查看地图与轨迹
                </p>
                {location && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 展开按钮 右上角 */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExpand}
            className="absolute top-2 right-2 h-7 gap-1 bg-card/90 backdrop-blur-sm shadow-sm hover:bg-card"
          >
            <Expand className="size-3.5" />
            <span className="text-xs">展开</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MiniMapCard;
