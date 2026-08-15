import type { MotionState } from '@shared/api.interface';
import { haversineDistance } from '@client/src/lib/utils/geo';

export interface TrajectoryPoint {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  motionState: MotionState;
}

export interface TrajectorySegment {
  id: string;
  motionState: MotionState;
  points: TrajectoryPoint[];
  startTime: number;
  endTime: number;
  distanceKm: number;
  locationLabel?: string;
}

export const MOTION_COLORS: Record<MotionState, string> = {
  vehicle: 'hsl(210 70% 55%)',
  walk: 'hsl(168 65% 42%)',
  run: 'hsl(25 85% 55%)',
  stay: 'hsl(168 30% 70%)',
};

export const MOTION_LABELS: Record<MotionState, string> = {
  vehicle: '乘车',
  walk: '步行',
  run: '跑步',
  stay: '停留',
};

export const MOTION_ICONS: Record<MotionState, string> = {
  vehicle: '🚗',
  walk: '🚶',
  run: '🏃',
  stay: '⏸',
};

// Replay speed factor: pixels/second (relative to total distance ratio)
// Higher = faster. These are multipliers applied to a base duration.
export const MOTION_REPLAY_DURATION: Record<MotionState, number> = {
  vehicle: 2000, // 2 seconds for a vehicle segment (fast)
  walk: 4000,    // 4 seconds for walking
  run: 3000,     // 3 seconds for running
  stay: 1500,    // 1.5 seconds for stay (just show static)
};

/**
 * Group consecutive points with the same motion state into segments.
 */
export function groupPointsIntoSegments(
  points: TrajectoryPoint[],
): TrajectorySegment[] {
  if (points.length === 0) return [];

  const segments: TrajectorySegment[] = [];
  let currentPoints: TrajectoryPoint[] = [points[0]];
  let currentState: MotionState = points[0].motionState;

  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    if (p.motionState === currentState) {
      currentPoints.push(p);
    } else {
      segments.push(buildSegment(currentState, currentPoints));
      currentState = p.motionState;
      currentPoints = [p];
    }
  }
  segments.push(buildSegment(currentState, currentPoints));

  // Merge very short stay segments (< 30s) into adjacent motion segments
  return mergeShortStaySegments(segments);
}

function buildSegment(
  state: MotionState,
  pts: TrajectoryPoint[],
): TrajectorySegment {
  let distance = 0;
  for (let i = 1; i < pts.length; i += 1) {
    distance += haversineDistance(
      pts[i - 1].lat,
      pts[i - 1].lng,
      pts[i].lat,
      pts[i].lng,
    );
  }
  return {
    id: `seg-${pts[0].timestamp}-${state}`,
    motionState: state,
    points: pts,
    startTime: pts[0].timestamp,
    endTime: pts[pts.length - 1].timestamp,
    distanceKm: distance,
  };
}

function mergeShortStaySegments(segments: TrajectorySegment[]): TrajectorySegment[] {
  if (segments.length <= 1) return segments;
  const result: TrajectorySegment[] = [segments[0]];
  for (let i = 1; i < segments.length; i += 1) {
    const seg = segments[i];
    const prev = result[result.length - 1];
    const isShortStay =
      seg.motionState === 'stay' &&
      seg.endTime - seg.startTime < 30_000; // < 30s
    if (isShortStay && prev) {
      // Absorb into previous segment
      prev.points = [...prev.points, ...seg.points];
      prev.endTime = seg.endTime;
      prev.distanceKm += seg.distanceKm;
    } else {
      result.push(seg);
    }
  }
  return result;
}

/**
 * Generate mock today trajectory for demo purposes.
 * Produces a realistic set of segments around a base location.
 */
export function generateMockTodayTrajectory(
  baseLat: number,
  baseLng: number,
): TrajectoryPoint[] {
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(8, 0, 0, 0);
  const startTs = dayStart.getTime();

  const points: TrajectoryPoint[] = [];
  let lat = baseLat;
  let lng = baseLng;
  let ts = startTs;
  let state: MotionState = 'stay';

  // Morning: stay at home (8:00 - 9:30)
  state = 'stay';
  const homeStayEnd = startTs + 90 * 60 * 1000;
  while (ts < homeStayEnd) {
    points.push(makePoint(lat, lng, ts, state));
    ts += 5 * 60 * 1000; // every 5 min
  }

  // Walk to station (9:30 - 9:50)
  state = 'walk';
  const walkEnd = homeStayEnd + 20 * 60 * 1000;
  const walkSteps = 20;
  for (let i = 0; i < walkSteps; i += 1) {
    lat += 0.0008;
    lng += 0.0006;
    ts += 60 * 1000; // every minute
    points.push(makePoint(lat, lng, ts, state));
  }

  // Vehicle ride (9:50 - 10:30)
  state = 'vehicle';
  const vehicleEnd = walkEnd + 40 * 60 * 1000;
  const vehicleSteps = 20;
  for (let i = 0; i < vehicleSteps; i += 1) {
    lat += 0.003;
    lng += 0.004;
    ts += 2 * 60 * 1000; // every 2 min
    points.push(makePoint(lat, lng, ts, state));
  }

  // Stay at work (10:30 - 12:00)
  state = 'stay';
  const workStayEnd = vehicleEnd + 90 * 60 * 1000;
  while (ts < workStayEnd) {
    points.push(makePoint(lat, lng, ts, state));
    ts += 5 * 60 * 1000;
  }

  // Walk to lunch (12:00 - 12:15)
  state = 'walk';
  const lunchWalkEnd = workStayEnd + 15 * 60 * 1000;
  for (let i = 0; i < 8; i += 1) {
    lat -= 0.0005;
    lng += 0.0007;
    ts += 2 * 60 * 1000;
    points.push(makePoint(lat, lng, ts, state));
  }

  // Stay at lunch (12:15 - 13:00)
  state = 'stay';
  const lunchEnd = lunchWalkEnd + 45 * 60 * 1000;
  while (ts < lunchEnd) {
    points.push(makePoint(lat, lng, ts, state));
    ts += 5 * 60 * 1000;
  }

  // Walk back to work (13:00 - 13:15)
  state = 'walk';
  for (let i = 0; i < 8; i += 1) {
    lat += 0.0005;
    lng -= 0.0007;
    ts += 2 * 60 * 1000;
    points.push(makePoint(lat, lng, ts, state));
  }

  // Stay at work (13:15 - 17:30)
  state = 'stay';
  const afternoonEnd = lunchEnd + (4 * 60 + 15) * 60 * 1000;
  while (ts < afternoonEnd && ts < now) {
    points.push(makePoint(lat, lng, ts, state));
    ts += 5 * 60 * 1000;
  }

  // If we haven't reached now yet, add an evening run + walk
  if (ts < now) {
    // Run in park (17:30 - 18:10)
    state = 'run';
    const runEnd = afternoonEnd + 40 * 60 * 1000;
    const runSteps = 20;
    for (let i = 0; i < runSteps && ts < now; i += 1) {
      const angle = (i / runSteps) * Math.PI;
      lat += Math.sin(angle) * 0.0015;
      lng += 0.001;
      ts += 2 * 60 * 1000;
      points.push(makePoint(lat, lng, ts, state));
    }

    // Walk home (18:10 - 18:40)
    state = 'walk';
    const walkHomeEnd = runEnd + 30 * 60 * 1000;
    const walkHomeSteps = 15;
    for (let i = 0; i < walkHomeSteps && ts < now; i += 1) {
      lat -= 0.0025;
      lng -= 0.003;
      ts += 2 * 60 * 1000;
      points.push(makePoint(lat, lng, ts, state));
    }

    // Stay at home (until now)
    state = 'stay';
    while (ts < now) {
      points.push(makePoint(lat, lng, ts, state));
      ts += 5 * 60 * 1000;
    }
  }

  return points;
}

function makePoint(
  lat: number,
  lng: number,
  ts: number,
  state: MotionState,
): TrajectoryPoint {
  return {
    id: `mock-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    lat: lat + (Math.random() - 0.5) * 0.0001,
    lng: lng + (Math.random() - 0.5) * 0.0001,
    timestamp: ts,
    motionState: state,
  };
}

/**
 * Get location label for a stay segment based on coordinates.
 * Returns descriptive labels for demo purposes.
 */
export function getLocationLabel(
  lat: number,
  lng: number,
  baseLat: number,
  baseLng: number,
): string {
  const distKm = haversineDistance(lat, lng, baseLat, baseLng);
  if (distKm < 0.5) return '在家';
  if (distKm < 3) return '在公司';
  if (distKm < 5) return '在公园';
  return '在附近';
}

/**
 * Compute bounding box of a set of points with padding.
 */
export function computeBounds(
  points: Array<{ lat: number; lng: number }>,
): {
  southWest: { lat: number; lng: number };
  northEast: { lat: number; lng: number };
} {
  if (points.length === 0) {
    return {
      southWest: { lat: 0, lng: 0 },
      northEast: { lat: 0, lng: 0 },
    };
  }
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.001);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.001);
  return {
    southWest: { lat: minLat - padLat, lng: minLng - padLng },
    northEast: { lat: maxLat + padLat, lng: maxLng + padLng },
  };
}

/**
 * Interpolate a point along a polyline at progress [0, 1].
 * Uses distance-weighted interpolation for smooth motion.
 */
export function interpolateAlongPath(
  path: Array<{ lat: number; lng: number }>,
  progress: number,
): { lat: number; lng: number; index: number } {
  if (path.length === 0) return { lat: 0, lng: 0, index: 0 };
  if (path.length === 1) return { lat: path[0].lat, lng: path[0].lng, index: 0 };
  if (progress <= 0) return { lat: path[0].lat, lng: path[0].lng, index: 0 };
  if (progress >= 1) {
    return {
      lat: path[path.length - 1].lat,
      lng: path[path.length - 1].lng,
      index: path.length - 1,
    };
  }

  // Compute cumulative distances
  const cumDist: number[] = [0];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += haversineDistance(
      path[i - 1].lat,
      path[i - 1].lng,
      path[i].lat,
      path[i].lng,
    );
    cumDist.push(total);
  }

  if (total === 0) return { lat: path[0].lat, lng: path[0].lng, index: 0 };

  const targetDist = progress * total;
  // Find segment
  for (let i = 1; i < cumDist.length; i += 1) {
    if (cumDist[i] >= targetDist) {
      const segStart = cumDist[i - 1];
      const segLen = cumDist[i] - segStart;
      const t = segLen === 0 ? 0 : (targetDist - segStart) / segLen;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
        index: i - 1,
      };
    }
  }
  return {
    lat: path[path.length - 1].lat,
    lng: path[path.length - 1].lng,
    index: path.length - 1,
  };
}

export function formatTimeRange(startTs: number, endTs: number): string {
  const fmt = (ts: number): string => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `${fmt(startTs)}-${fmt(endTs)}`;
}

export function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}分钟`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}小时${remainMins}分` : `${hours}小时`;
}
