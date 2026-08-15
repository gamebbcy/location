import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { trajectoriesStore } from '@client/src/lib/storage';
import {
  haversineDistance,
  calculateSpeed,
  detectMotionState,
  type MotionState,
} from '@client/src/lib/utils/geo';
import { getDateKey } from '@client/src/lib/utils/time';
import { APP_CONFIG } from '@client/src/config';

export interface TrajectoryPoint {
  id: string;
  dateKey: string;
  lat: number;
  lng: number;
  timestamp: number;
  motionState: string;
}

export interface UseTrajectoryReturn {
  trajectoryPoints: TrajectoryPoint[];
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  getPointsByDate: (dateKey: string) => Promise<TrajectoryPoint[]>;
  getPointsByDateRange: (
    startDate: string,
    endDate: string,
  ) => Promise<Map<string, TrajectoryPoint[]>>;
  clearAllTrajectories: () => Promise<void>;
  cleanupOldData: () => Promise<void>;
}

const MIN_DISTANCE_METERS = 10;
const MIN_INTERVAL_MS = 30_000;

function genPointId(ts: number): string {
  return `traj_${ts}_${Math.random().toString(36).slice(2, 8)}`;
}

function pointToRecord(
  pt: TrajectoryPoint,
): TrajectoryPoint & { date: string } {
  return { ...pt, date: pt.dateKey };
}

function recordToPoint(record: any): TrajectoryPoint {
  return {
    id: record.id,
    dateKey: record.dateKey ?? record.date ?? '',
    lat: record.lat,
    lng: record.lng,
    timestamp: record.timestamp,
    motionState: record.motionState ?? 'stay',
  };
}

function shouldRecord(
  prev: TrajectoryPoint | null,
  lat: number,
  lng: number,
  timestamp: number,
): boolean {
  if (!prev) return true;
  const distanceKm = haversineDistance(prev.lat, prev.lng, lat, lng);
  if (distanceKm * 1000 >= MIN_DISTANCE_METERS) return true;
  if (timestamp - prev.timestamp >= MIN_INTERVAL_MS) return true;
  return false;
}

export function useTrajectory(): UseTrajectoryReturn {
  const [trajectoryPoints, setTrajectoryPoints] = useState<TrajectoryPoint[]>(
    [],
  );
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<TrajectoryPoint | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  const cleanupOldData = useCallback(async (): Promise<void> => {
    try {
      const all: any[] = await trajectoriesStore.getAll();
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - APP_CONFIG.trajectoryRetentionDays,
      );
      const cutoffKey = getDateKey(cutoffDate);

      const toDelete: string[] = [];
      for (const rec of all) {
        const dk: string = rec.dateKey ?? rec.date ?? '';
        if (dk && dk < cutoffKey) toDelete.push(rec.id);
      }

      if (toDelete.length > 0) {
        for (const id of toDelete) {
          await trajectoriesStore.delete(id);
        }
        logger.info('useTrajectory: cleaned up old points', {
          count: toDelete.length,
          cutoff: cutoffKey,
        });
      }
    } catch (err: unknown) {
      logger.error('useTrajectory: cleanupOldData failed', err);
    }
  }, []);

  const loadAllPoints = useCallback(async (): Promise<void> => {
    try {
      const all: any[] = await trajectoriesStore.getAll();
      const points: TrajectoryPoint[] = all
        .map(recordToPoint)
        .sort((a, b) => a.timestamp - b.timestamp);
      setTrajectoryPoints(points);
      if (points.length > 0) {
        lastPointRef.current = points[points.length - 1];
      }
    } catch (err: unknown) {
      logger.error('useTrajectory: loadAllPoints failed', err);
    }
  }, []);

  const recordPoint = useCallback(
    async (lat: number, lng: number, timestamp: number): Promise<void> => {
      if (!isRecordingRef.current) return;

      const last = lastPointRef.current;
      if (!shouldRecord(last, lat, lng, timestamp)) return;

      const dateKey = getDateKey(new Date(timestamp));
      const motion: MotionState = last
        ? detectMotionState(
            calculateSpeed(last.lat, last.lng, last.timestamp, lat, lng, timestamp),
          )
        : 'stay';

      const point: TrajectoryPoint = {
        id: genPointId(timestamp),
        dateKey,
        lat,
        lng,
        timestamp,
        motionState: motion,
      };

      try {
        await trajectoriesStore.put(pointToRecord(point));
        lastPointRef.current = point;
        setTrajectoryPoints((prev) => [...prev, point]);
        // Periodic cleanup: every 50th point
        if (Math.random() < 0.02) {
          void cleanupOldData();
        }
      } catch (err: unknown) {
        logger.error('useTrajectory: recordPoint failed', err);
      }
    },
    [cleanupOldData],
  );

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      void recordPoint(
        pos.coords.latitude,
        pos.coords.longitude,
        pos.timestamp,
      );
    },
    [recordPoint],
  );

  const handleError = useCallback((err: GeolocationPositionError) => {
    logger.warn('useTrajectory: geolocation error', {
      code: err.code,
      message: err.message,
    });
  }, []);

  const startRecording = useCallback((): void => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      logger.warn('useTrajectory: geolocation not available');
      return;
    }
    if (watchIdRef.current !== null) return;

    isRecordingRef.current = true;
    setIsRecording(true);

    const id = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    );
    watchIdRef.current = id;

    void cleanupOldData();
    logger.info('useTrajectory: recording started');
  }, [handlePosition, handleError, cleanupOldData]);

  const stopRecording = useCallback((): void => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    logger.info('useTrajectory: recording stopped');
  }, []);

  const getPointsByDate = useCallback(
    async (dateKey: string): Promise<TrajectoryPoint[]> => {
      try {
        const all: any[] = await trajectoriesStore.getAll();
        return all
          .filter((rec: any) => (rec.dateKey ?? rec.date) === dateKey)
          .map(recordToPoint)
          .sort((a, b) => a.timestamp - b.timestamp);
      } catch (err: unknown) {
        logger.error('useTrajectory: getPointsByDate failed', err);
        return [];
      }
    },
    [],
  );

  const getPointsByDateRange = useCallback(
    async (
      startDate: string,
      endDate: string,
    ): Promise<Map<string, TrajectoryPoint[]>> => {
      const result = new Map<string, TrajectoryPoint[]>();
      try {
        const all: any[] = await trajectoriesStore.getAll();
        for (const rec of all) {
          const dk: string = rec.dateKey ?? rec.date ?? '';
          if (dk >= startDate && dk <= endDate) {
            const list = result.get(dk) ?? [];
            list.push(recordToPoint(rec));
            result.set(dk, list);
          }
        }
        for (const [key, list] of result) {
          list.sort((a, b) => a.timestamp - b.timestamp);
          result.set(key, list);
        }
      } catch (err: unknown) {
        logger.error('useTrajectory: getPointsByDateRange failed', err);
      }
      return result;
    },
    [],
  );

  const clearAllTrajectories = useCallback(async (): Promise<void> => {
    try {
      await trajectoriesStore.clear();
      setTrajectoryPoints([]);
      lastPointRef.current = null;
      logger.info('useTrajectory: all trajectories cleared');
    } catch (err: unknown) {
      logger.error('useTrajectory: clearAllTrajectories failed', err);
    }
  }, []);

  useEffect(() => {
    void loadAllPoints();
  }, [loadAllPoints]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    trajectoryPoints,
    isRecording,
    startRecording,
    stopRecording,
    getPointsByDate,
    getPointsByDateRange,
    clearAllTrajectories,
    cleanupOldData,
  };
}
