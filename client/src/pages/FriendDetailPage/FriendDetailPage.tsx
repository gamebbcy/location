import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Battery, Hand, MapPin, Navigation, Palette, Phone, Zap } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@client/src/components/ui/button';
import { cn } from '@/lib/utils';
import AmapView, { type AmapMarker } from '@client/src/components/AmapView/AmapView';
import { buildMarkerContent } from '@client/src/components/AmapView/marker-utils';
import { useFriendLocations } from '@client/src/hooks/useFriendLocations';
import { useWebSocket } from '@client/src/hooks/useWebSocket';
import { friendsStore } from '@client/src/lib/storage';
import { friendRepository } from '@client/src/data/friend-repository';
import PhoneDialog from './PhoneDialog';
import NavigateDialog from './NavigateDialog';
import AlertConfirmDialog from './AlertConfirmDialog';
import type { Friend } from '@shared/api.interface';
import { usePoke } from '@client/src/hooks/usePoke';
import { toast } from 'sonner';

const DEFAULT_CENTER = { lat: 39.9042, lng: 116.4074 };
const MOTION_LABELS = {
  stay: '停留中',
  walk: '步行中',
  run: '跑步中',
  vehicle: '乘车中',
} as const;

const FriendDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { friendLocations, isOnline, requestFriendLocation } = useFriendLocations();
  const { send } = useWebSocket();
  const { sendPoke } = usePoke(false);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [navigateOpen, setNavigateOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void friendRepository.get(id)
      .then((result) => {
        if (cancelled) return;
        setFriend(result ?? null);
        if (result) requestFriendLocation(id);
      })
      .catch((error) => logger.error('加载好友资料失败', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, requestFriendLocation]);

  const location = friendLocations.get(id);
  const online = isOnline(id);
  const center = location ? { lat: location.lat, lng: location.lng } : DEFAULT_CENTER;
  const markers = useMemo<AmapMarker[]>(() => {
    if (!location || !friend) return [];
    return [{
      id: friend.userId,
      lat: location.lat,
      lng: location.lng,
      title: friend.remark || friend.nickname,
      content: buildMarkerContent({
        avatarUrl: friend.avatar,
        name: friend.remark || friend.nickname,
        motionState: location.motionState,
        isOnline: online,
        musicState: location.musicState,
        musicPlaying: Boolean(location.musicState),
      }),
    }];
  }, [friend, location, online]);

  const handleCall = useCallback(() => {
    if (friend?.phone) window.location.assign(`tel:${friend.phone}`);
    else setPhoneDialogOpen(true);
  }, [friend?.phone]);

  const handleSavePhone = useCallback((phone: string) => {
    if (!friend) return;
    const updated = { ...friend, phone };
    setFriend(updated);
    void friendsStore.put(updated).catch((error) => logger.error('保存电话失败', error));
    window.location.assign(`tel:${phone}`);
  }, [friend]);

  const handleAlertConfirm = useCallback(() => {
    send('alert:send', {
      toUserId: id,
      messageId: `alert_${Date.now()}`,
      timestamp: Date.now(),
      title: '强提醒',
      content: '看看手机',
    });
    setAlertOpen(false);
  }, [id, send]);

  const handlePoke = useCallback(() => {
    if (!friend) return;
    if (sendPoke(friend.userId)) toast.success(`已戳了戳 ${friend.remark || friend.nickname}`);
    else toast.info('戳一戳冷却中，请稍后再试');
  }, [friend, sendPoke]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">加载中…</div>;
  }
  if (!friend) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-sm text-muted-foreground">
      好友不存在或关系已解除
      <Button variant="outline" onClick={() => navigate('/friends')}>返回好友列表</Button>
    </div>;
  }

  const displayName = friend.remark || friend.nickname;
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <AmapView center={center} zoom={location ? 16 : 11} markers={markers} className="absolute inset-0 h-full w-full" />

      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-card/75 px-4 pb-3 pt-4 backdrop-blur-lg">
        <Button variant="ghost" size="icon" className="rounded-full bg-card/80 shadow-sm" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarImage src={friend.avatar} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {displayName}
              <span className={cn('size-2 rounded-full', online ? 'bg-success animate-pulse' : 'bg-muted-foreground/40')} />
            </div>
            <div className="text-[11px] text-muted-foreground">{online ? '实时连接中' : '当前离线'}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full bg-card/80 text-destructive shadow-sm" onClick={() => setAlertOpen(true)} aria-label="强提醒">
          <Zap className="size-5" fill="currentColor" />
        </Button>
      </div>

      <div className="absolute inset-x-4 bottom-6 z-30 mx-auto max-w-md rounded-2xl border border-border/60 bg-card/90 p-4 shadow-md backdrop-blur-lg">
        {location ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <MapPin className="size-4 text-primary" />实时位置
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {MOTION_LABELS[location.motionState]} · 精度约 {Math.round(location.accuracy)} 米
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Battery className="size-4" />{location.battery}%
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              仅显示当前实时位置，不保存或生成历史轨迹。
            </p>
          </>
        ) : (
          <div className="py-2 text-center text-sm text-muted-foreground">
            {online ? '等待好友发送位置…' : '好友离线，暂无实时位置'}
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={handleCall}><Phone className="size-4" />电话</Button>
          <Button variant="outline" className="rounded-xl" disabled={!location} onClick={() => setNavigateOpen(true)}><Navigation className="size-4" />导航</Button>
          <Button className="rounded-xl" onClick={() => setAlertOpen(true)}><Zap className="size-4" />提醒</Button>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/draw/${friend.userId}`)}><Palette className="size-4" />画板</Button>
        </div>
        <Button className="mt-2 w-full rounded-xl" variant="secondary" onClick={handlePoke}>
          <Hand className="size-4" />戳一戳
        </Button>
      </div>

      <PhoneDialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen} phone={friend.phone} onSave={handleSavePhone} />
      <NavigateDialog open={navigateOpen} onOpenChange={setNavigateOpen} lat={location?.lat ?? null} lng={location?.lng ?? null} destinationName={displayName} />
      <AlertConfirmDialog open={alertOpen} onOpenChange={setAlertOpen} nickname={displayName} onConfirm={handleAlertConfirm} />
    </div>
  );
};

export default FriendDetailPage;
