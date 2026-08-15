import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Navigation, Map, Globe } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface NavigateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lat: number | null;
  lng: number | null;
  destinationName: string;
}

interface NavOption {
  id: 'amap' | 'baidu' | 'web';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const NAV_OPTIONS: NavOption[] = [
  { id: 'amap', label: '高德地图', icon: Navigation, color: 'bg-blue-500' },
  { id: 'baidu', label: '百度地图', icon: Map, color: 'bg-rose-500' },
  { id: 'web', label: '网页版', icon: Globe, color: 'bg-primary' },
];

const NavigateDialog: React.FC<NavigateDialogProps> = ({
  open,
  onOpenChange,
  lat,
  lng,
  destinationName,
}) => {
  const handleNavigate = (optionId: NavOption['id']): void => {
    if (lat === null || lng === null) return;
    const name = encodeURIComponent(destinationName || '好友位置');
    let url = '';
    switch (optionId) {
      case 'amap':
        url = `https://uri.amap.com/navigation?to=${lng},${lat},${name}&mode=car&policy=1&src=friendlocation&coordinate=gaode&callnative=1`;
        break;
      case 'baidu':
        url = `https://api.map.baidu.com/direction?destination=latlng:${lat},${lng}|name:${name}&mode=driving&origin=我的位置&output=html&src=friendlocation`;
        break;
      case 'web':
        url = `https://www.amap.com/navigation?to=${lng},${lat},${name}&mode=car`;
        break;
      default:
        break;
    }
    if (url) {
      try {
        window.open(url, '_blank');
      } catch (err) {
        logger.error('NavigateDialog: open failed', err);
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Navigation className="size-5 text-primary" />
            选择导航方式
          </DialogTitle>
          <DialogDescription>
            跳转到外部地图应用进行导航
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {NAV_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <Button
                key={opt.id}
                variant="outline"
                className="flex flex-col gap-2 h-auto py-4"
                onClick={() => handleNavigate(opt.id)}
                disabled={lat === null || lng === null}
              >
                <div
                  className={`flex size-10 items-center justify-center rounded-full text-white ${opt.color}`}
                >
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-normal">{opt.label}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NavigateDialog;
