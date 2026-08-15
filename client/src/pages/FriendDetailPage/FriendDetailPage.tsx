import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { ArrowLeft, Zap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFriendLocations } from '@client/src/hooks/useFriendLocations';
import { useWebSocket } from '@client/src/hooks/useWebSocket';
import { friendsStore } from '@client/src/lib/storage';
import { cn } from '@/lib/utils';
import AmapView, {
  type AmapViewRef,
  type AmapMarker,
  type AmapPolyline,
} from '@client/src/components/AmapView/AmapView';
import TrajectoryPanel from './TrajectoryPanel';
import PhoneDialog from './PhoneDialog';
import NavigateDialog from './NavigateDialog';
import AlertConfirmDialog from './AlertConfirmDialog';
import {
  generateMockTodayTrajectory,
  groupPointsIntoSegments,
  getLocationLabel,
  computeBounds,
  interpolateAlongPath,
  MOTION_COLORS,
  MOTION_REPLAY_DURATION,
  type TrajectoryPoint,
  type TrajectorySegment,
} from './trajectory-utils';
import type { FriendLocationUpdate, MotionState } from '@shared/api.interface';

interface FriendInfo {
  userId: string;
  nickname: string;
  avatar?: string;
  phone?: string;
}

const FriendDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { friendLocations, isOnline, requestFriendLocation } =
    useFriendLocations();
  const { send } = useWebSocket();

  const [friend, setFriend] = useState<FriendInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [navigateOpen, setNavigateOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  // Replay state
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayPosition, setReplayPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const animationRef = useRef<number | null>(null);
  const replayStartTimeRef = useRef<number>(0);
  const replaySegmentRef = useRef<TrajectorySegment | null>(null);

  const mapRef = useRef<AmapViewRef>(null);

  // Load friend info
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    friendsStore
      .get<FriendInfo>(id)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setFriend(data);
          requestFriendLocation(id);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        logger.error('FriendDetailPage: load friend failed', err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, requestFriendLocation]);

  const location: FriendLocationUpdate | undefined = friendLocations.get(id);
  const online = isOnline(id);

  // Generate today trajectory (mock data for demo)
  const trajectoryPoints: TrajectoryPoint[] = useMemo(() => {
    const baseLat = location?.lat ?? 39.9042;
    const baseLng = location?.lng ?? 116.4074;
    return generateMockTodayTrajectory(baseLat, baseLng);
  }, [location?.lat, location?.lng]);

  // Group into segments
  const segments: TrajectorySegment[] = useMemo(() => {
    const segs = groupPointsIntoSegments(trajectoryPoints);
    const baseLat = location?.lat ?? 39.9042;
    const baseLng = location?.lng ?? 116.4074;
    // Add location labels for stay segments
    return segs.map((seg) => {
      if (seg.motionState === 'stay') {
        const mid = seg.points[Math.floor(seg.points.length / 2)];
        return {
          ...seg,
          locationLabel: getLocationLabel(mid.lat, mid.lng, baseLat, baseLng),
        };
      }
      return seg;
    });
  }, [trajectoryPoints, location?.lat, location?.lng]);

  // Summary stats
  const totalDistanceKm = useMemo(
    () => segments.reduce((sum, s) => sum + s.distanceKm, 0),
    [segments],
  );

  const totalDurationMs = useMemo(() => {
    return segments.reduce(
      (sum, s) => sum + (s.endTime - s.startTime),
      0,
    );
  }, [segments]);

  const stayCount = useMemo(
    () => segments.filter((s) => s.motionState === 'stay').length,
    [segments],
  );

  // Build colored polylines (one per motion state type, but actually segment by segment)
  const polylines: AmapPolyline[] = useMemo(() => {
    const lines: AmapPolyline[] = [];
    for (const seg of segments) {
      if (seg.motionState === 'stay') continue; // stays are markers, not lines
      if (seg.points.length < 2) continue;
      const color = MOTION_COLORS[seg.motionState];
      lines.push({
        id: seg.id,
        path: seg.points.map((p) => ({ lat: p.lat, lng: p.lng })),
        color,
        weight: 5,
      });
    }
    return lines;
  }, [segments]);

  // Stay markers (circles — size grows with duration)
  const stayMarkers: AmapMarker[] = useMemo(() => {
    const markers: AmapMarker[] = [];
    const color = MOTION_COLORS.stay;
    for (const seg of segments) {
      if (seg.motionState !== 'stay') continue;
      const mid = seg.points[Math.floor(seg.points.length / 2)];
      const size = Math.min(48, Math.max(16, 12 + (seg.endTime - seg.startTime) / 300_000));
      const content = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color}40;border:2px solid ${color};box-shadow:0 0 8px ${color}40;transform:translate(-50%,-50%);"></div>`;
      markers.push({ id: `stay-${seg.id}`, lat: mid.lat, lng: mid.lng, content, title: seg.locationLabel || '停留' });
    }
    return markers;
  }, [segments]);

  // Friend current location marker (avatar bubble with pulse)
  const currentMarker: AmapMarker | null = useMemo(() => {
    if (!location || !friend) return null;
    const color = MOTION_COLORS[location.motionState as MotionState] ?? MOTION_COLORS.walk;
    const initials = friend.nickname?.slice(0, 1) || '?';
    const avatarEl = friend.avatar
      ? `<img src="${friend.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);" />`
      : `<div style="width:36px;height:36px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;border:2px solid white;">${initials}</div>`;
    const content = `<div style="position:relative;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${color}30;animation:frdPulse 2s infinite;"></div>${avatarEl}</div><style>@keyframes frdPulse{0%{transform:scale(.8);opacity:.8}50%{transform:scale(1.2);opacity:.3}100%{transform:scale(.8);opacity:.8}}</style>`;
    return { id: 'friend-current', lat: location.lat, lng: location.lng, content, title: friend.nickname };
  }, [location, friend]);

  // Replay marker (pulsing dot)
  const replayMarker: AmapMarker | null = useMemo(() => {
    if (!replayPosition || !activeSegmentId) return null;
    const activeSeg = segments.find((s) => s.id === activeSegmentId);
    if (!activeSeg) return null;
    const color = MOTION_COLORS[activeSeg.motionState];
    const content = `<div style="position:relative;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:32px;height:32px;border-radius:50%;background:${color}40;animation:rpPulse 1.2s infinite;"></div><div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2);"></div></div><style>@keyframes rpPulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.4);opacity:0}}</style>`;
    return { id: 'replay-marker', lat: replayPosition.lat, lng: replayPosition.lng, content, title: '回放中' };
  }, [replayPosition, activeSegmentId, segments]);

  // All markers
  const allMarkers: AmapMarker[] = useMemo(() => {
    const markers: AmapMarker[] = [...stayMarkers];
    if (currentMarker) markers.push(currentMarker);
    if (replayMarker) markers.push(replayMarker);
    return markers;
  }, [stayMarkers, currentMarker, replayMarker]);

  // Map center
  const mapCenter = useMemo(() => {
    if (replayPosition) return replayPosition;
    if (location) return { lat: location.lat, lng: location.lng };
    return { lat: 39.9042, lng: 116.4074 };
  }, [location, replayPosition]);

  // ===== Replay animation =====

  const stopReplay = useCallback((): void => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsReplaying(false);
  }, []);

  const resetReplay = useCallback((): void => {
    stopReplay();
    setActiveSegmentId(null);
    setReplayPosition(null);
    replaySegmentRef.current = null;
    // Return to current location view
    if (location && mapRef.current) {
      mapRef.current.panTo(location.lat, location.lng);
      mapRef.current.setZoom(15);
    }
  }, [stopReplay, location]);

  const startReplay = useCallback(
    (segmentId: string): void => {
      const seg = segments.find((s) => s.id === segmentId);
      if (!seg || seg.points.length === 0) return;

      stopReplay();
      setActiveSegmentId(segmentId);
      replaySegmentRef.current = seg;

      // Fit bounds to segment
      const bounds = computeBounds(seg.points);
      if (mapRef.current) {
        mapRef.current.fitBounds(bounds.southWest, bounds.northEast);
      }

      // Start position
      setReplayPosition({ lat: seg.points[0].lat, lng: seg.points[0].lng });
      setIsReplaying(true);
      replayStartTimeRef.current = performance.now();

      const duration = MOTION_REPLAY_DURATION[seg.motionState];

      const animate = (now: number): void => {
        const elapsed = now - replayStartTimeRef.current;
        const progress = Math.min(1, elapsed / duration);
        const pos = interpolateAlongPath(
          seg.points.map((p) => ({ lat: p.lat, lng: p.lng })),
          progress,
        );
        setReplayPosition({ lat: pos.lat, lng: pos.lng });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Replay complete — hold for 1s then reset
          animationRef.current = window.setTimeout(() => {
            resetReplay();
          }, 1000) as unknown as number;
        }
      };
      animationRef.current = requestAnimationFrame(animate);
    },
    [segments, stopReplay, resetReplay],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // ===== Action handlers =====

  const handleCall = useCallback((): void => {
    if (friend?.phone) {
      window.location.assign(`tel:${friend.phone}`);
    } else {
      setPhoneDialogOpen(true);
    }
  }, [friend?.phone]);

  const handleSavePhone = useCallback(
    (phone: string): void => {
      if (!friend) return;
      const updated: FriendInfo = { ...friend, phone };
      setFriend(updated);
      void friendsStore.put(updated).catch((err: unknown) => {
        logger.error('save phone failed', err);
      });
      window.location.assign(`tel:${phone}`);
    },
    [friend],
  );

  const handleNavigate = useCallback((): void => {
    if (!location) return;
    setNavigateOpen(true);
  }, [location]);

  const handleAlertRequest = useCallback((): void => {
    setAlertOpen(true);
  }, []);

  const handleAlertConfirm = useCallback((): void => {
    send('alert:send', {
      toUserId: id,
      messageId: `alert_${Date.now()}`,
      timestamp: Date.now(),
      content: '请查看一下',
    });
    setAlertOpen(false);
  }, [send, id]);

  const handleBack = useCallback((): void => {
    navigate(-1);
  }, [navigate]);

  const handlePlaySegment = useCallback(
    (segmentId: string): void => {
      if (activeSegmentId === segmentId && isReplaying) {
        stopReplay();
        return;
      }
      startReplay(segmentId);
    },
    [activeSegmentId, isReplaying, startReplay, stopReplay],
  );

  const handleToggleExpand = useCallback((): void => {
    setPanelExpanded((prev) => !prev);
  }, []);

  // Online status text
  const statusText = useMemo(() => {
    if (!online) return '离线';
    return '在线';
  }, [online]);

  if (loading || !friend) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* Full-screen map */}
      <AmapView
        ref={mapRef}
        center={mapCenter}
        zoom={15}
        polylines={polylines}
        markers={allMarkers}
        className="absolute inset-0 w-full h-full"
      />

      {/* Top floating bar (glass) */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between px-4 pt-4 pb-3 bg-card/70 backdrop-blur-lg border-b border-border/40">
          <button
            type="button"
            onClick={handleBack}
            className="flex size-10 items-center justify-center rounded-full bg-card/80 backdrop-blur-md shadow-sm hover:bg-card transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="size-5 text-foreground" />
          </button>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <Avatar className="size-6">
                <AvatarImage src={friend.avatar} alt={friend.nickname} />
                <AvatarFallback className="text-xs">
                  {friend.nickname.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-foreground text-sm">
                {friend.nickname}
              </span>
              <span
                className={cn(
                  'size-2 rounded-full',
                  online
                    ? 'bg-[hsl(152_60%_40%)] animate-pulse'
                    : 'bg-muted-foreground/40',
                )}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {statusText}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAlertRequest}
            className="flex size-10 items-center justify-center rounded-full bg-card/80 backdrop-blur-md shadow-sm text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="强提醒"
          >
            <Zap className="size-5" fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Bottom trajectory panel */}
      <TrajectoryPanel
        segments={segments}
        totalDistanceKm={totalDistanceKm}
        totalDurationMs={totalDurationMs}
        stayCount={stayCount}
        isExpanded={panelExpanded}
        onToggleExpand={handleToggleExpand}
        activeSegmentId={activeSegmentId}
        isPlaying={isReplaying}
        onPlaySegment={handlePlaySegment}
        onCall={handleCall}
        onNavigate={handleNavigate}
        onAlert={handleAlertRequest}
      />

      {/* Dialogs */}
      <PhoneDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
        phone={friend.phone}
        onSave={handleSavePhone}
      />
      <NavigateDialog
        open={navigateOpen}
        onOpenChange={setNavigateOpen}
        lat={location?.lat ?? null}
        lng={location?.lng ?? null}
        destinationName={friend.nickname}
      />
      <AlertConfirmDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        nickname={friend.nickname}
        onConfirm={handleAlertConfirm}
      />
    </div>
  );
};

export default FriendDetailPage;
