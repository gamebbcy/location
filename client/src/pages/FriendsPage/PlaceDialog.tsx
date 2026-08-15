import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import type { Place } from '@client/src/hooks/usePlaces';

interface PlaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place?: Place | null;
  onSave: (data: Omit<Place, 'id'>) => void;
  onDelete?: (id: string) => void;
}

export function PlaceDialog({ open, onOpenChange, place, onSave, onDelete }: PlaceDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [tag, setTag] = useState<Place['tag']>('other');

  useEffect(() => {
    if (open) {
      if (place) {
        setName(place.name);
        setAddress(place.address);
        setLat(String(place.lat));
        setLng(String(place.lng));
        setTag(place.tag);
      } else {
        setName('');
        setAddress('');
        setLat('');
        setLng('');
        setTag('other');
      }
    }
  }, [open, place]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => {
        // 失败静默
      },
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const latNum = parseFloat(lat) || 0;
    const lngNum = parseFloat(lng) || 0;
    onSave({ name: name.trim(), address: address.trim(), lat: latNum, lng: lngNum, tag, radius: 200 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>{place ? '编辑地点' : '添加地点'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="place-name">名称</Label>
            <Input
              id="place-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：家、公司"
              maxLength={20}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="place-address">地址</Label>
            <Input
              id="place-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="详细地址（选填）"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="place-lat">纬度</Label>
              <Input
                id="place-lat"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="39.9042"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="place-lng">经度</Label>
              <Input
                id="place-lng"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="116.4074"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
            className="w-full"
          >
            使用当前位置
          </Button>
          <div className="flex flex-col gap-1.5">
            <Label>标签</Label>
            <Select value={tag} onValueChange={(v) => setTag(v as Place['tag'])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">家</SelectItem>
                <SelectItem value="company">公司</SelectItem>
                <SelectItem value="school">学校</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {place && onDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
              onClick={() => onDelete(place.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              删除
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              取消
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
