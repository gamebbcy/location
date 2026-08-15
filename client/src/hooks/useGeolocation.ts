import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  calculateSpeed,
  detectMotionState,
  type MotionState,
} from '@client/src/lib/utils/geo';

export interface UseGeolocationReturn {
  position: GeolocationPosition | null;
  accuracy: number;
  motionState: MotionState;
  stayDuration: number; // seconds
  isWatching: boolean;
  startWatch: () => void;
  stopWatch: () => void;
  error: GeolocationPositionError | null;
}

const STAY_DISTANCE_THRESHOLD_METERS = 50;
const DEFAULT_HIGH_ACCURACY = true;
const DEFAULT_MAX_AGE = 1000;
const DEFAULT_TIMEOUT = 10000;

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [motionState, setMotionState] = useState<MotionState>('stay');
  const [stayDuration, setStayDuration] = useState<number>(0);
  const [isWatching, setIsWatching] = useState<boolean>(false);
  const [error, setError] = useState<GeolocationPositionError | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const prevPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const stayStartRef = useRef<number>(Date.now());
  const stayAnchorRef = useRef<{ lat: number; lng: number } | null>(null);

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    setPosition(pos);
    setAccuracy(pos.coords.accuracy);
    setError(null);

    const currLat = pos.coords.latitude;
    const currLng = pos.coords.longitude;
    const currTime = pos.timestamp;

    // Calculate motion state
    if (prevPositionRef.current) {
      const prev = prevPositionRef.current;
      const speedKmh = calculateSpeed(
        prev.lat,
        prev.lng,
        prev.time,
        currLat,
        currLng,
        currTime,
      );
      const state = detectMotionState(speedKmh);
      setMotionState(state);

      // Stay duration tracking
      if (stayAnchorRef.current) {
        // Distance in km -> meters
        const distanceKm =
          // Re-use haversine via speed calc helper fallback — do inline
          // haversineDistance: calculateSpeed uses it internally; do direct calc
          // to avoid extra import ambiguity
          (() => {
            const toRad = (deg: number): number => (deg * Math.PI) / 180;
            const dLat = toRad(currLat - stayAnchorRef.current!.lat);
            const dLng = toRad(currLng - stayAnchorRef.current!.lng);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(stayAnchorRef.current!.lat)) *
                Math.cos(toRad(currLat)) *
                Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return 6371 * c; // km
          })();

        if (distanceKm * 1000 < STAY_DISTANCE_THRESHOLD_METERS) {
          // Still staying
          const seconds = Math.floor((currTime - stayStartRef.current) / 1000);
          setStayDuration(seconds);
        } else {
          // Moved — reset stay anchor
          stayAnchorRef.current = { lat: currLat, lng: currLng };
          stayStartRef.current = currTime;
          setStayDuration(0);
        }
      } else {
        stayAnchorRef.current = { lat: currLat, lng: currLng };
        stayStartRef.current = currTime;
      }
    } else {
      // First position — init stay anchor
      stayAnchorRef.current = { lat: currLat, lng: currLng };
      stayStartRef.current = currTime;
    }

    prevPositionRef.current = { lat: currLat, lng: currLng, time: currTime };
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    logger.warn('useGeolocation error', {
      code: err.code,
      message: err.message,
    });
    setError(err);
  }, []);

  const startWatch = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      logger.warn('Geolocation API not available');
      return;
    }
    if (watchIdRef.current !== null) return;

    const id = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: DEFAULT_HIGH_ACCURACY,
        maximumAge: DEFAULT_MAX_AGE,
        timeout: DEFAULT_TIMEOUT,
      },
    );
    watchIdRef.current = id;
    setIsWatching(true);
  }, [handlePosition, handleError]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    position,
    accuracy,
    motionState,
    stayDuration,
    isWatching,
    startWatch,
    stopWatch,
    error,
  };
}
