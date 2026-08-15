import {
  BatteryCharging,
  TrendingDown,
  MapPin,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatStayDuration } from '@client/src/lib/utils/time';
import type { FriendLocationUpdate } from '@shared/api.interface';
import type { Place } from '@client/src/hooks/usePlaces';

interface BatteryCardProps {
  location: FriendLocationUpdate | undefined;
  nearbyPlace: Place | null;
}

const BatteryCard: React.FC<BatteryCardProps> = ({ location, nearbyPlace }) => {
  const battery = location?.battery ?? 0;
  const charging = location?.batteryCharging ?? false;
  const lowBattery = battery < 20 && battery > 0;
  const batteryTrend: 'down' | 'charging' = charging
    ? 'charging'
    : 'down'; // 简化：非充电默认下降趋势

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* 电量区域 */}
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-3xl font-semibold leading-none',
                lowBattery && 'text-destructive',
              )}
            >
              {location ? `${Math.round(battery)}%` : '—'}
            </span>
            {batteryTrend === 'charging' && (
              <BatteryCharging
                className={cn(
                  'size-5 mb-1',
                  lowBattery ? 'text-destructive' : 'text-[hsl(152_60%_40%)]',
                )}
              />
            )}
            {batteryTrend === 'down' && location && (
              <TrendingDown
                className={cn(
                  'size-4 mb-1',
                  lowBattery ? 'text-destructive' : 'text-muted-foreground',
                )}
              />
            )}
          </div>
          <span className="text-xs text-muted-foreground">电量</span>
        </div>

        {/* 电量条 */}
        <div className="space-y-1.5">
          <Progress
            value={location ? battery : 0}
            className={cn(
              'h-2.5',
              lowBattery &&
                '[&_[data-slot=progress-indicator]]:bg-destructive animate-pulse',
            )}
          />
          <div className="flex justify-between">
            {charging && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 border border-[hsl(152_60%_40%)]/30 text-[hsl(152_60%_40%)] bg-[hsl(152_60%_40%)]/5"
              >
                充电中
              </Badge>
            )}
            {lowBattery && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 border border-destructive/30 text-destructive bg-destructive/5 animate-pulse"
              >
                低电量
              </Badge>
            )}
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-border/60 pt-4" />

        {/* 当前位置地址 */}
        <div className="flex items-start gap-2">
          <MapPin className="size-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-snug">
              {nearbyPlace ? (
                <span className="inline-flex items-center gap-1.5">
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20 border">
                    {nearbyPlace.tag === 'home'
                      ? '在家'
                      : nearbyPlace.tag === 'company'
                        ? '在公司'
                        : nearbyPlace.tag === 'school'
                          ? '在学校'
                          : '在附近'}
                  </Badge>
                  <span>{nearbyPlace.name}</span>
                </span>
              ) : location ? (
                `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
              ) : (
                <span className="text-muted-foreground">暂无位置信息</span>
              )}
            </div>
            {location && !nearbyPlace && (
              <div className="text-xs text-muted-foreground mt-0.5">
                配置高德 Key 后显示详细地址
              </div>
            )}
          </div>
        </div>

        {/* 停留时长 */}
        {location && location.stayDuration > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>已停留 {formatStayDuration(location.stayDuration)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BatteryCard;
