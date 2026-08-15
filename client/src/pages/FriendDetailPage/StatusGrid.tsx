import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Wifi, Signal, MapPin, Crosshair } from 'lucide-react';
import type { FriendLocationUpdate } from '@shared/api.interface';
import { cn } from '@/lib/utils';

interface StatusGridProps {
  location: FriendLocationUpdate | undefined;
  distance: string | null;
}

interface StatusItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  iconAlt?: React.ComponentType<{ className?: string }>;
  label: string;
  getValue: (loc?: FriendLocationUpdate, distance?: string | null) => string;
  getIconAlt?: (loc?: FriendLocationUpdate) => boolean;
  iconColor?: string;
}

// 简化设备型号字符串（处理如 "iPhone15,2" → "iPhone 15"，"SM-G9910" → "Galaxy G9910"）
function formatDeviceModel(model: string): string {
  if (!model) return '未知设备';
  const trimmed = model.trim();
  // iPhone15,2 / iPhone14_Pro → iPhone 15
  const iphoneMatch = trimmed.match(/iPhone\s*(\d+)/i);
  if (iphoneMatch) return `iPhone ${iphoneMatch[1]}`;
  // Pixel 6 / Pixel6Pro → Pixel 6
  const pixelMatch = trimmed.match(/Pixel\s*(\d+(?:\s*Pro)?)/i);
  if (pixelMatch) return `Pixel ${pixelMatch[1].replace(/\s+/g, ' ')}`;
  // SM-G9910 → Galaxy G9910
  const samsungMatch = trimmed.match(/SM-([A-Z0-9]+)/i);
  if (samsungMatch) return `Galaxy ${samsungMatch[1]}`;
  // 小米14 / Mi 14 → 保留原名
  if (/小米|mi\s*\d/i.test(trimmed)) {
    return trimmed.replace(/^mi\s*/i, '小米 ').trim();
  }
  // 华为 / HUAWEI / Mate → 保留原名，控制长度
  if (trimmed.length <= 12) return trimmed;
  return trimmed.slice(0, 10) + '…';
}

const STATUS_ITEMS: StatusItem[] = [
  {
    key: 'device',
    icon: Smartphone,
    label: '设备机型',
    getValue: (loc) => {
      if (!loc?.deviceModel) return '未知设备';
      return formatDeviceModel(loc.deviceModel);
    },
  },
  {
    key: 'network',
    icon: Wifi,
    iconAlt: Signal,
    label: '网络类型',
    getValue: (loc) => {
      const t = loc?.networkType?.toUpperCase() ?? '未知';
      if (t === 'WIFI') return 'WiFi';
      return t;
    },
    getIconAlt: (loc) =>
      loc?.networkType?.toLowerCase() !== 'wifi' && !!loc?.networkType,
  },
  {
    key: 'distance',
    icon: MapPin,
    label: '与你的距离',
    iconColor: 'text-primary',
    getValue: (_loc, distance) => distance || '计算中…',
  },
  {
    key: 'accuracy',
    icon: Crosshair,
    label: 'GPS 精度',
    getValue: (loc) =>
      loc ? `±${Math.round(loc.accuracy)}米` : '—',
  },
];

const StatusGrid: React.FC<StatusGridProps> = ({ location, distance }) => {
  return (
    <div className="grid grid-cols-2 gap-3" data-ai-section-type="card-list">
      {STATUS_ITEMS.map((item) => {
        const value = item.getValue(location, distance);
        const useAlt = item.getIconAlt ? item.getIconAlt(location) : false;
        const Icon = useAlt && item.iconAlt ? item.iconAlt : item.icon;
        return (
          <Card key={item.key}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    'size-4',
                    item.iconColor ?? 'text-muted-foreground',
                  )}
                />
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <div className="text-lg font-semibold truncate">{value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StatusGrid;
