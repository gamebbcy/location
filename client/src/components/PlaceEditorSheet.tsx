import { useState, useCallback, useEffect, type ChangeEvent } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@client/src/components/ui/sheet';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Home, Briefcase, GraduationCap, MapPin, X } from 'lucide-react';
import { useSensitiveWords } from '@client/src/hooks/useSensitiveWords';
import { cn } from '@/lib/utils';
import type { Place } from '@client/src/hooks/usePlaces';

interface PlaceEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 初始纬度（新增时自动填充当前位置） */
  initialLat?: number;
  /** 初始经度（新增时自动填充当前位置） */
  initialLng?: number;
  /** 初始地址描述 */
  initialAddress?: string;
  /** 编辑模式下的现有地点 */
  place?: Place | null;
  onSave: (data: Omit<Place, 'id'>) => void;
}

const TAG_OPTIONS: Array<{
  value: Place['tag'];
  label: string;
  icon: typeof Home;
  color: string;
}> = [
  { value: 'home', label: '家', icon: Home, color: 'text-orange-500' },
  { value: 'company', label: '公司', icon: Briefcase, color: 'text-blue-500' },
  { value: 'school', label: '学校', icon: GraduationCap, color: 'text-purple-500' },
  { value: 'other', label: '其他', icon: MapPin, color: 'text-muted-foreground' },
];

const PlaceEditorSheet: React.FC<PlaceEditorSheetProps> = ({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  initialAddress,
  place,
  onSave,
}) => {
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [radius, setRadius] = useState<string>('200');
  const [tag, setTag] = useState<Place['tag']>('other');
  const { filter } = useSensitiveWords();

  // 打开时初始化表单
  useEffect(() => {
    if (!open) return;
    if (place) {
      setName(place.name);
      setAddress(place.address);
      setLat(String(place.lat));
      setLng(String(place.lng));
      setTag(place.tag);
      setRadius('200');
    } else {
      setName('');
      setAddress(initialAddress ?? '');
      setLat(initialLat !== undefined ? initialLat.toFixed(6) : '');
      setLng(initialLng !== undefined ? initialLng.toFixed(6) : '');
      setTag('other');
      setRadius('200');
    }
  }, [open, place, initialLat, initialLng, initialAddress]);

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    setName(e.target.value.slice(0, 20));
  }, []);

  const handleAddressChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    setAddress(e.target.value.slice(0, 50));
  }, []);

  const handleRadiusChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    setRadius(e.target.value.replace(/[^\d]/g, '').slice(0, 5));
  }, []);

  const handleSave = useCallback((): void => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const filteredName = filter(trimmedName);
    const latNum = parseFloat(lat) || 0;
    const lngNum = parseFloat(lng) || 0;
    const radiusNum = parseInt(radius, 10) || 200;
    onSave({
      name: filteredName,
      address: address.trim(),
      lat: latNum,
      lng: lngNum,
      radius: radiusNum > 0 ? radiusNum : 200,
      tag,
    });
    onOpenChange(false);
  }, [name, address, lat, lng, tag, filter, onSave, onOpenChange]);

  const isSaveDisabled = !name.trim() || !lat || !lng;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="p-0 pb-2">
          <SheetTitle>{place ? '编辑地点' : '添加地点'}</SheetTitle>
          <SheetDescription>
            {place ? '修改地点信息' : '使用当前位置快速添加常用地点'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* 地点名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="place-name">地点名称</Label>
            <div className="relative">
              <Input
                id="place-name"
                value={name}
                onChange={handleNameChange}
                placeholder="例如：家、公司（最多 20 字）"
                maxLength={20}
                className="h-11 pr-8"
              />
              {name && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="清除"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* 位置 */}
          <div className="space-y-1.5">
            <Label>位置</Label>
            <div className="rounded-xl border border-border bg-accent/30 p-3">
              {address && (
                <p className="text-sm text-foreground">{address}</p>
              )}
              <p className="text-xs text-muted-foreground">
                纬度 {lat || '—'} · 经度 {lng || '—'}
              </p>
            </div>
          </div>

          {/* 半径 */}
          <div className="space-y-1.5">
            <Label htmlFor="place-radius">围栏半径（米）</Label>
            <Input
              id="place-radius"
              value={radius}
              onChange={handleRadiusChange}
              placeholder="200"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              进出该半径范围时会触发状态提醒，默认 200 米
            </p>
          </div>

          {/* 标签 */}
          <div className="space-y-2">
            <Label>标签图标</Label>
            <div className="grid grid-cols-4 gap-2">
              {TAG_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = tag === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTag(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors',
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-5',
                        selected ? 'text-primary' : opt.color,
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs',
                        selected ? 'text-primary font-medium' : 'text-foreground',
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleSave}
            disabled={isSaveDisabled}
          >
            保存
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PlaceEditorSheet;
