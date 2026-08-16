import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { APP_CONFIG } from '@client/src/config';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateBearing, haversineDistance } from '@/lib/utils/geo';
import EdgeIndicators from './EdgeIndicators';

// ===== Types =====

export interface AmapMarker {
  id: string;
  lat: number;
  lng: number;
  content?: string; // HTML string for custom marker
  title?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export interface AmapPolyline {
  id: string;
  path: Array<{ lat: number; lng: number }>;
  color?: string;
  weight?: number;
}

export interface AmapEdgeFriend {
  id: string;
  lat: number;
  lng: number;
  avatarUrl?: string;
  name: string;
  isOnline?: boolean;
}

export interface AmapViewProps {
  amapKey?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: AmapMarker[];
  polylines?: AmapPolyline[];
  /** 视野外边缘方向指示：好友列表 */
  edgeFriends?: AmapEdgeFriend[];
  /** 点击边缘头像回调 */
  onEdgeAvatarClick?: (friend: AmapEdgeFriend) => void;
  className?: string;
  onClick?: (lat: number, lng: number) => void;
}

export interface AmapViewRef {
  getMap: () => unknown | null;
  setCenter: (lat: number, lng: number) => void;
  setZoom: (zoom: number) => void;
  panTo: (lat: number, lng: number) => void;
  fitBounds: (
    southWest: { lat: number; lng: number },
    northEast: { lat: number; lng: number },
  ) => void;
}

// ===== Global state =====

let scriptLoadingPromise: Promise<void> | null = null;
let scriptLoaded = false;

function loadAmapScript(key: string, securityCode?: string): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded
    if (typeof window !== 'undefined' && (window as any).AMap) {
      scriptLoaded = true;
      resolve();
      return;
    }

    // Set AMap security config before loading the script
    if (securityCode && typeof window !== 'undefined') {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: securityCode,
      };
    }

    const callbackName = `__amap_init_${Date.now()}`;
    (window as any)[callbackName] = () => {
      scriptLoaded = true;
      delete (window as any)[callbackName];
      resolve();
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      key,
    )}&plugin=AMap.Scale,AMap.ToolBar&callback=${callbackName}`;
    script.onerror = () => {
      scriptLoadingPromise = null;
      delete (window as any)[callbackName];
      reject(new Error('高德地图脚本加载失败'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

const AmapView = forwardRef<AmapViewRef, AmapViewProps>(function AmapView(
  {
    amapKey = APP_CONFIG.amapKey,
    center,
    zoom = 15,
    markers = [],
    polylines = [],
    edgeFriends = [],
    onEdgeAvatarClick,
    className,
    onClick,
  },
  ref,
) {
  const securityCode = APP_CONFIG.amapSecurityCode;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerInstancesRef = useRef<Map<string, unknown>>(new Map());
  const polylineInstancesRef = useRef<Map<string, unknown>>(new Map());
  const clickHandlerRef = useRef<((e: any) => void) | null>(null);

  // 当前地图视野 bounds 快照（用于边缘指示计算）
  const [bounds, setBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
    centerLat: number;
    centerLng: number;
  } | null>(null);

  const hasKey = useMemo(() => Boolean(amapKey && amapKey.trim()), [amapKey]);

  // 读取当前 bounds 并更新 state
  const updateBounds = useCallback((): void => {
    const map = mapRef.current as any;
    if (!map || !map.getBounds) return;
    const b = map.getBounds();
    if (!b) return;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const c = map.getCenter();
    setBounds({
      north: ne.getLat(),
      south: sw.getLat(),
      east: ne.getLng(),
      west: sw.getLng(),
      centerLat: c?.getLat() ?? 0,
      centerLng: c?.getLng() ?? 0,
    });
  }, []);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    setCenter: (lat: number, lng: number) => {
      const map = mapRef.current as any;
      if (map && map.setCenter) {
        map.setCenter([lng, lat]);
      }
    },
    setZoom: (z: number) => {
      const map = mapRef.current as any;
      if (map && map.setZoom) {
        map.setZoom(z);
      }
    },
    panTo: (lat: number, lng: number) => {
      const map = mapRef.current as any;
      if (map && map.panTo) {
        map.panTo([lng, lat]);
      }
    },
    fitBounds: (sw, ne) => {
      const map = mapRef.current as any;
      const AMap = (window as any).AMap;
      if (!map || !AMap?.Bounds) return;
      const bounds = new AMap.Bounds(
        [sw.lng, sw.lat],
        [ne.lng, ne.lat],
      );
      if (map.setBounds) {
        map.setBounds(bounds, false, [40, 40, 40, 40]);
      }
    },
  }));

  // Initialize map
  useEffect(() => {
    if (!hasKey || !containerRef.current) return;

    let cancelled = false;

    loadAmapScript(amapKey, securityCode)
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const AMap = (window as any).AMap;
        if (!AMap) {
          logger.error('AMap not found after script load');
          return;
        }

        const map = new AMap.Map(containerRef.current, {
          zoom,
          center: center ? [center.lng, center.lat] : undefined,
          viewMode: '2D',
          mapStyle: 'amap://styles/whitesmoke',
        });

        mapRef.current = map;

        // Map click
        if (onClick) {
          const handler = (e: any) => {
            onClick(e.lnglat.getLat(), e.lnglat.getLng());
          };
          clickHandlerRef.current = handler;
          map.on('click', handler);
        }

        // Bounds change → 用于边缘指示
        const onMoveEnd = (): void => updateBounds();
        const onZoomEnd = (): void => updateBounds();
        map.on('moveend', onMoveEnd);
        map.on('zoomend', onZoomEnd);
        // 首次获取 bounds
        const initBoundsTimer = window.setTimeout(updateBounds, 150);

        // 将处理器存到 ref，便于外部 effect 解绑（此处只用本地变量）
        (map as any).__edgeMoveHandler = onMoveEnd;
        (map as any).__edgeZoomHandler = onZoomEnd;
        (map as any).__edgeBoundsTimer = initBoundsTimer;
      })
      .catch((err: unknown) => {
        logger.error('AmapView: init failed', err);
      });

    return () => {
      cancelled = true;
      const map = mapRef.current as any;
      if (map) {
        const onMoveEnd = (map as any).__edgeMoveHandler;
        const onZoomEnd = (map as any).__edgeZoomHandler;
        const timer = (map as any).__edgeBoundsTimer;
        if (onMoveEnd) map.off?.('moveend', onMoveEnd);
        if (onZoomEnd) map.off?.('zoomend', onZoomEnd);
        if (timer) window.clearTimeout(timer);
        if (map.destroy) map.destroy();
      }
      mapRef.current = null;
      markerInstancesRef.current.clear();
      polylineInstancesRef.current.clear();
      setBounds(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey, amapKey]);

  // Update center
  useEffect(() => {
    const map = mapRef.current as any;
    if (!map || !center) return;
    if (map.setCenter) {
      map.setCenter([center.lng, center.lat]);
    }
  }, [center?.lat, center?.lng]);

  // Update zoom
  useEffect(() => {
    const map = mapRef.current as any;
    if (!map) return;
    if (map.setZoom) {
      map.setZoom(zoom);
    }
  }, [zoom]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current as any;
    const AMap = (window as any).AMap;
    if (!map || !AMap) return;

    const existingIds = new Set(markerInstancesRef.current.keys());
    const newIds = new Set(markers.map((m) => m.id));

    // Remove stale markers
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        const marker = markerInstancesRef.current.get(id) as any;
        if (marker) {
          map.remove(marker);
          if (marker.setMap) marker.setMap(null);
        }
        markerInstancesRef.current.delete(id);
      }
    }

    // Add/update markers
    for (const markerData of markers) {
      const existing = markerInstancesRef.current.get(markerData.id) as any;
      if (existing) {
        if (existing.setPosition) {
          existing.setPosition([markerData.lng, markerData.lat]);
        }
        if (existing.setContent && markerData.content !== undefined) {
          existing.setContent(markerData.content);
        }
      } else {
        const marker = new AMap.Marker({
          position: [markerData.lng, markerData.lat],
          content: markerData.content || '',
          title: markerData.title || '',
          offset: new AMap.Pixel(-20, -40),
          anchor: 'bottom-center',
        });

        // Use dblclick for fast double-tap detection on mobile
        // AMap supports 'dblclick' event on markers
        if (markerData.onDoubleClick) {
          marker.on('dblclick', markerData.onDoubleClick);
        }

        if (markerData.onClick) {
          marker.on('click', markerData.onClick);
        }

        map.add(marker);
        markerInstancesRef.current.set(markerData.id, marker);
      }
    }
  }, [markers]);

  // Update polylines
  useEffect(() => {
    const map = mapRef.current as any;
    const AMap = (window as any).AMap;
    if (!map || !AMap) return;

    const existingIds = new Set(polylineInstancesRef.current.keys());
    const newIds = new Set(polylines.map((p) => p.id));

    for (const id of existingIds) {
      if (!newIds.has(id)) {
        const polyline = polylineInstancesRef.current.get(id) as any;
        if (polyline) map.remove(polyline);
        polylineInstancesRef.current.delete(id);
      }
    }

    for (const polyData of polylines) {
      const existing = polylineInstancesRef.current.get(polyData.id) as any;
      const path = polyData.path.map((p) => [p.lng, p.lat]);
      if (existing) {
        if (existing.setPath) existing.setPath(path);
      } else {
        const polyline = new AMap.Polyline({
          path,
          strokeColor: polyData.color || '#14b8a6',
          strokeWeight: polyData.weight ?? 4,
          strokeOpacity: 0.8,
          lineJoin: 'round',
        });
        map.add(polyline);
        polylineInstancesRef.current.set(polyData.id, polyline);
      }
    }
  }, [polylines]);

  // Map click handler update
  useEffect(() => {
    const map = mapRef.current as any;
    if (!map) return;

    // Remove old handler if exists
    const oldHandler = clickHandlerRef.current;
    if (oldHandler) {
      map.off('click', oldHandler);
      clickHandlerRef.current = null;
    }

    // Add new handler if onClick is provided
    if (onClick) {
      const handler = (e: any) => {
        onClick(e.lnglat.getLat(), e.lnglat.getLng());
      };
      clickHandlerRef.current = handler;
      map.on('click', handler);
    }
  }, [onClick]);

  // 计算视野外好友及其边缘位置
  const offscreenIndicators = useMemo(() => {
    if (!bounds || edgeFriends.length === 0) return [];

    const { north, south, east, west, centerLat, centerLng } = bounds;
    const latSpan = Math.max(north - south, 1e-6);
    const lngSpan = Math.max(east - west, 1e-6);

    const offscreen: Array<{
      id: string;
      lat: number;
      lng: number;
      avatarUrl?: string;
      name: string;
      isOnline?: boolean;
      distanceKm: number;
      bearing: number;
      side: 'top' | 'right' | 'bottom' | 'left';
      position: number;
    }> = [];

    for (const f of edgeFriends) {
      const inView =
        f.lat >= south &&
        f.lat <= north &&
        f.lng >= west &&
        f.lng <= east;
      if (inView) continue;

      const bearing = calculateBearing(centerLat, centerLng, f.lat, f.lng);
      const distanceKm = haversineDistance(centerLat, centerLng, f.lat, f.lng);

      // 相对偏移（以视野 span 为单位，中心为 0）
      const dLat = (f.lat - centerLat) / latSpan; // 北正南负
      const dLng = (f.lng - centerLng) / lngSpan; // 东正西负

      // 根据方位角确定在哪一侧（45°~135° 为右，以此类推）
      let side: 'top' | 'right' | 'bottom' | 'left';
      let position: number;

      if (bearing >= 45 && bearing < 135) {
        // 东 → 右边缘，position 按纬度比例计算（北→南：0→1）
        side = 'right';
        // 将 dLat 映射到 0~1：北 = 0，南 = 1
        position = 0.5 - dLat / 2;
        // 确保在 0.05~0.95 之间，避免贴角
        position = Math.max(0.05, Math.min(0.95, position));
      } else if (bearing >= 135 && bearing < 225) {
        // 南 → 底边缘，position 按经度比例计算（西→东：0→1）
        side = 'bottom';
        position = 0.5 + dLng / 2;
        position = Math.max(0.05, Math.min(0.95, position));
      } else if (bearing >= 225 && bearing < 315) {
        // 西 → 左边缘，position 按纬度比例计算（北→南：0→1）
        side = 'left';
        position = 0.5 - dLat / 2;
        position = Math.max(0.05, Math.min(0.95, position));
      } else {
        // 北 → 顶边缘，position 按经度比例计算（西→东：0→1）
        side = 'top';
        position = 0.5 + dLng / 2;
        position = Math.max(0.05, Math.min(0.95, position));
      }

      offscreen.push({
        id: f.id,
        lat: f.lat,
        lng: f.lng,
        avatarUrl: f.avatarUrl,
        name: f.name,
        isOnline: f.isOnline,
        distanceKm,
        bearing,
        side,
        position,
      });
    }

    return offscreen;
  }, [bounds, edgeFriends]);

  // Fallback UI when no key
  if (!hasKey) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center w-full h-full bg-muted/30 rounded-xl',
          className,
        )}
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground p-6 text-center">
          <div className="size-12 rounded-full bg-accent flex items-center justify-center">
            <MapPin className="size-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">请配置高德地图 Key</p>
          <p className="text-xs">
            在 <code className="px-1 py-0.5 bg-accent rounded">APP_CONFIG.amapKey</code> 中配置后即可使用地图
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full rounded-xl overflow-hidden', className)}
      data-slot="amap-view"
    >
      {bounds && offscreenIndicators.length > 0 && (
        <EdgeIndicators
          friends={offscreenIndicators}
          onAvatarClick={(f) => {
            if (onEdgeAvatarClick) {
              const match = edgeFriends.find((ef) => ef.id === f.id);
              if (match) onEdgeAvatarClick(match);
            }
          }}
        />
      )}
    </div>
  );
});

AmapView.displayName = 'AmapView';

export default AmapView;
