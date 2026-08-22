import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Locate, Layers, Smile, MapPin, Plus } from 'lucide-react';
import AmapView, {
  type AmapViewRef,
  type AmapMarker,
} from '@client/src/components/AmapView/AmapView';
import { buildMarkerContent } from '@client/src/components/AmapView/marker-utils';
import { useGeolocation } from '@client/src/hooks/useGeolocation';
import { useFriendLocations } from '@client/src/hooks/useFriendLocations';
import { useMusicState } from '@client/src/hooks/useMusicState';
import { useWebSocket } from '@client/src/hooks/useWebSocket';
import { usePoke } from '@client/src/hooks/usePoke';
import AlertNotification from '@client/src/components/AlertNotification';
import {
  getBattery,
  getNetworkType,
  parseDeviceModel,
} from '@client/src/lib/utils/device';
import { getProfile } from '@client/src/lib/storage';
import { APP_CONFIG } from '@client/src/config';
import StatusPicker from './StatusPicker';
import StatusSettingDialog from '@client/src/pages/ProfilePage/StatusSettingDialog';
import PlaceEditorSheet from '@client/src/components/PlaceEditorSheet';
import PlaceListSheet from '@client/src/components/PlaceListSheet';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import { useProfile } from '@client/src/hooks/useProfile';
import { usePlaces, type Place } from '@client/src/hooks/usePlaces';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type {
  FriendLocationUpdate,
  LocationUpdatePayload,
} from '@shared/api.interface';
import { friendRepository } from '@client/src/data/friend-repository';

interface FriendInfo {
  userId: string;
  nickname: string;
  avatar?: string;
  phone?: string;
}

const DEFAULT_CENTER = { lat: 39.9087, lng: 116.3975 }; // Beijing fallback

const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const mapRef = useRef<AmapViewRef>(null);
  const avatarTapRef = useRef<Map<string, { at: number; timer: number }>>(new Map());
  const {
    position,
    accuracy,
    motionState,
    stayDuration,
    startWatch,
    isWatching,
  } = useGeolocation();
  const { friendLocations, onlineFriends, isOnline, alertNotification, dismissAlertNotification } = useFriendLocations();
  const { send, connect, isConnected } = useWebSocket();
  const { musicState, startAutoDetect, stopAutoDetect } = useMusicState();
  const {
    shakingUserIds,
    sendPoke,
    isCooldown,
    setFriendInfoMap,
    triggerShake,
  } = usePoke(false);

  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [selfActionOpen, setSelfActionOpen] = useState<boolean>(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState<boolean>(false);
  const [placeEditorOpen, setPlaceEditorOpen] = useState<boolean>(false);
  const [placeListOpen, setPlaceListOpen] = useState<boolean>(false);
  const { places, addPlace, deletePlace } = usePlaces();
  const { profile, updateStatus } = useProfile();
  const myStatus = profile?.status || '空闲中';

  // Load friends on mount
  useEffect(() => {
    friendRepository
      .syncCache()
      .then((list) => setFriends(list))
      .catch((err: unknown) => {
        logger.error('MapPage: load friends failed', err);
      });
  }, []);

  // Sync friend info to poke hook for notification display
  useEffect(() => {
    const map = new Map<string, { nickname: string; avatar?: string }>();
    for (const friend of friends) {
      map.set(friend.userId, { nickname: friend.nickname, avatar: friend.avatar });
    }
    setFriendInfoMap(map);
  }, [friends, setFriendInfoMap]);

  // Handle double-click (poke) on friend marker
  const handleFriendDoubleClick = useCallback(
    async (friend: FriendInfo) => {
      const ok = await sendPoke(friend.userId);
      if (!ok) {
        // Still trigger a visual flash to indicate cooldown
        triggerShake(friend.userId);
        logger.warn('poke on cooldown for', friend.nickname);
        toast.error('戳一戳发送失败或仍在冷却，请稍后再试');
      } else {
        toast.success(`已戳了戳 ${friend.nickname}`);
      }
    },
    [sendPoke, triggerShake],
  );

  useEffect(() => () => {
    for (const tap of avatarTapRef.current.values()) window.clearTimeout(tap.timer);
    avatarTapRef.current.clear();
  }, []);

  // Start watching position on mount
  useEffect(() => {
    if (!isWatching) {
      startWatch();
    }
  }, [isWatching, startWatch]);

  // Ensure WebSocket connection
  useEffect(() => {
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  // 启动音乐状态自动检测
  useEffect(() => {
    startAutoDetect();
    return stopAutoDetect;
  }, [startAutoDetect, stopAutoDetect]);

  // Periodic location reporting
  useEffect(() => {
    if (!position) return;

    const report = async (): Promise<void> => {
      try {
        const batteryInfo = await getBattery();
        const networkType = getNetworkType();
        const deviceModel = parseDeviceModel();
        const profile = getProfile();

        const payload: LocationUpdatePayload = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy,
          motionState,
          battery: Math.round(batteryInfo.level * 100),
          batteryCharging: batteryInfo.charging,
          networkType,
          deviceModel,
          status: profile?.status || '空闲中',
          musicState: profile?.musicState || null,
          stayDuration,
        };

        send('location:update', payload);
      } catch (err) {
        logger.error('MapPage: location report failed', err);
      }
    };

    // Report immediately on first position
    void report();

    const interval = setInterval(() => {
      void report();
    }, APP_CONFIG.locationUpdateInterval);

    return () => clearInterval(interval);
  }, [position, accuracy, motionState, stayDuration, send]);

  // Center
  const center = useMemo(() => {
    if (position) {
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    }
    return DEFAULT_CENTER;
  }, [position]);

  // Build markers
  const markers: AmapMarker[] = useMemo(() => {
    const result: AmapMarker[] = [];

    // Self marker
    const profile = getProfile();
    result.push({
      id: 'self',
      lat: center.lat,
      lng: center.lng,
      content: buildMarkerContent({
        avatarUrl: profile?.avatar,
        name: profile?.nickname || '我',
        motionState,
        isSelf: true,
        isOnline: true,
        musicState: musicState,
        musicPlaying: true,
      }),
      title: profile?.nickname || '我',
      onClick: () => {
        setSelfActionOpen(true);
      },
    });

    // Friend markers
    for (const friend of friends) {
      const loc = friendLocations.get(friend.userId);
      if (!loc) continue;
      const online = isOnline(friend.userId);
      const shaking = shakingUserIds.has(friend.userId);
      const onCooldown = isCooldown(friend.userId);
      result.push({
        id: `friend-${friend.userId}`,
        lat: loc.lat,
        lng: loc.lng,
        content: buildMarkerContent({
          avatarUrl: friend.avatar,
          name: friend.nickname,
          motionState: loc.motionState,
          isOnline: online,
          musicState: loc.musicState,
          musicPlaying: true,
          isShaking: shaking,
          showPokeRipple: shaking && !onCooldown,
        }),
        title: friend.nickname,
        onClick: () => {
          navigate(`/friend/${friend.userId}`);
        },
        onDoubleClick: () => {
          handleFriendDoubleClick(friend);
        },
      });
    }

    return result;
  }, [
    center,
    motionState,
    friends,
    friendLocations,
    isOnline,
    navigate,
    shakingUserIds,
    isCooldown,
    handleFriendDoubleClick,
    musicState,
  ]);

  // 边缘指示好友列表（视野外时显示）
  const edgeFriends = useMemo(() => {
    return friends
      .map((friend) => {
        const loc = friendLocations.get(friend.userId);
        if (!loc) return null;
        return {
          id: friend.userId,
          lat: loc.lat,
          lng: loc.lng,
          avatarUrl: friend.avatar,
          name: friend.nickname,
          isOnline: isOnline(friend.userId),
        };
      })
      .filter(
        (f): f is NonNullable<typeof f> => f !== null,
      );
  }, [friends, friendLocations, isOnline]);

  // Locate self
  const handleLocate = (): void => {
    if (position && mapRef.current) {
      mapRef.current.panTo(
        position.coords.latitude,
        position.coords.longitude,
      );
      mapRef.current.setZoom(16);
    }
  };

  // Locate a friend on the map
  const handleLocateFriend = useCallback((friend: FriendInfo): void => {
    const loc = friendLocations.get(friend.userId);
    if (loc && mapRef.current) {
      mapRef.current.panTo(loc.lat, loc.lng);
      mapRef.current.setZoom(16);
    }
  }, [friendLocations]);

  const handleFriendAvatarTap = useCallback((friend: FriendInfo): void => {
    const now = Date.now();
    const previous = avatarTapRef.current.get(friend.userId);
    if (previous && now - previous.at <= 320) {
      window.clearTimeout(previous.timer);
      avatarTapRef.current.delete(friend.userId);
      handleFriendDoubleClick(friend);
      return;
    }
    const timer = window.setTimeout(() => {
      avatarTapRef.current.delete(friend.userId);
      handleLocateFriend(friend);
    }, 330);
    avatarTapRef.current.set(friend.userId, { at: now, timer });
  }, [handleFriendDoubleClick, handleLocateFriend]);

  // Toggle map type (placeholder — satellite layer requires AMap plugin)
  const handleToggleLayer = (): void => {
    // Full satellite layer switching requires AMap satellite plugin.
    // Placeholder action for UI demonstration.
  };

  // Online count
  const onlineCount = onlineFriends.length;

  return (
    <div className="relative h-screen w-full overflow-hidden" data-ai-section-type="card-list">
      {/* Map */}
      <AmapView
        ref={mapRef}
        center={center}
        directionOrigin={center}
        zoom={15}
        markers={markers}
        edgeFriends={edgeFriends}
        onEdgeAvatarClick={(friend) => {
          if (mapRef.current) {
            mapRef.current.panTo(friend.lat, friend.lng);
            mapRef.current.setZoom(16);
          }
        }}
        className="absolute inset-0 h-full w-full rounded-none"
      />

      {/* Top status bar */}
      <div className="absolute left-0 right-0 top-0 z-20 p-4">
        <div className="mx-auto flex max-w-md items-start justify-between">
          <div className="flex flex-col items-start gap-2">
            <div className="rounded-full bg-card/90 px-4 py-2 shadow-md backdrop-blur-lg">
              <span className="text-sm font-medium">
                在线好友 <span className="text-primary">{onlineCount}</span> 人
              </span>
            </div>
            <StatusPicker
              currentStatus={myStatus}
              onSelect={(status) => {
                void updateStatus(status);
              }}
              onSaveWithDuration={(status, durationMinutes) => {
                void updateStatus(status, durationMinutes);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLocate}
              className="flex size-10 items-center justify-center rounded-full bg-card/90 text-foreground shadow-md backdrop-blur-lg active:scale-95 transition-transform"
              aria-label="定位到我的位置"
            >
              <Locate className="size-5" />
            </button>
            <button
              type="button"
              onClick={handleToggleLayer}
              className="flex size-10 items-center justify-center rounded-full bg-card/90 text-foreground shadow-md backdrop-blur-lg active:scale-95 transition-transform"
              aria-label="切换图层"
            >
              <Layers className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom friend bubbles */}
      <div className="absolute bottom-16 left-0 right-0 z-20 px-4 pb-2">
        <div className="mx-auto max-w-md">
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {friends.length === 0 && (
              <div className="flex w-full justify-center">
                <div className="rounded-full bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-md backdrop-blur-lg">
                  暂无好友，去添加吧
                </div>
              </div>
            )}
            {friends.map((friend) => {
              const online = isOnline(friend.userId);
              const loc: FriendLocationUpdate | undefined = friendLocations.get(
                friend.userId,
              );
              return (
                <button
                  key={friend.userId}
                  type="button"
                  onClick={() => handleFriendAvatarTap(friend)}
                  className="flex shrink-0 flex-col items-center gap-1"
                  aria-label={`单击定位 ${friend.nickname}，双击戳一戳`}
                >
                  <div className="relative">
                    <Avatar
                      className={cn(
                        'size-12 border-2 border-card shadow-md',
                        !online && 'grayscale opacity-60',
                      )}
                    >
                      <AvatarImage src={friend.avatar} alt={friend.nickname} />
                      <AvatarFallback>{friend.nickname.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    {/* Online dot */}
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card',
                        online
                          ? 'bg-[hsl(152_60%_40%)] animate-pulse'
                          : 'bg-muted-foreground/40',
                      )}
                    />
                    {/* Motion indicator */}
                    {loc && online && (
                      <span
                        className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-card text-[8px]"
                        style={{
                          backgroundColor:
                            loc.motionState === 'vehicle'
                              ? 'hsl(210 70% 55%)'
                              : loc.motionState === 'run'
                                ? 'hsl(25 85% 55%)'
                                : loc.motionState === 'walk'
                                  ? 'hsl(168 65% 42%)'
                                  : 'hsl(168 30% 70%)',
                        }}
                      >
                        {loc.motionState === 'vehicle'
                          ? '🚗'
                          : loc.motionState === 'run'
                            ? '🏃'
                            : loc.motionState === 'walk'
                              ? '🚶'
                              : '●'}
                      </span>
                    )}
                  </div>
                  <span className="max-w-[60px] truncate text-[11px] text-card-foreground drop-shadow">
                    {friend.nickname}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alert notification */}
      <AlertNotification
        notification={alertNotification}
        onDismiss={dismissAlertNotification}
      />

      {/* 自己头像操作菜单 */}
      <Sheet open={selfActionOpen} onOpenChange={setSelfActionOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="p-0 pb-2">
            <SheetTitle className="text-base">我的操作</SheetTitle>
          </SheetHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setSelfActionOpen(false);
                setStatusDialogOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Smile className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">设置状态</p>
                <p className="text-xs text-muted-foreground">
                  当前：{myStatus || '未设置'}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelfActionOpen(false);
                setPlaceEditorOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                <Plus className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">使用当前位置添加地点</p>
                <p className="text-xs text-muted-foreground">
                  自动填充坐标，输入名称即可保存
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelfActionOpen(false);
                setPlaceListOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                <MapPin className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">查看常用地点</p>
                <p className="text-xs text-muted-foreground">
                  已保存 {places.length} 个地点
                </p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 状态设置弹窗 */}
      <StatusSettingDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        currentStatus={myStatus}
        onSave={(status, durationMinutes) => {
          void updateStatus(status, durationMinutes);
        }}
      />

      {/* 添加地点弹窗 */}
      <PlaceEditorSheet
        open={placeEditorOpen}
        onOpenChange={setPlaceEditorOpen}
        initialLat={position?.coords.latitude}
        initialLng={position?.coords.longitude}
        initialAddress="当前位置"
        onSave={async (data: Omit<Place, 'id'>) => {
          await addPlace(data);
        }}
      />

      {/* 常用地点列表弹窗 */}
      <PlaceListSheet
        open={placeListOpen}
        onOpenChange={setPlaceListOpen}
        places={places}
        onAdd={() => setPlaceEditorOpen(true)}
        onDelete={deletePlace}
      />
    </div>
  );
};

export default MapPage;
