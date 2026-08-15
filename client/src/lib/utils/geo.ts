const EARTH_RADIUS_KM = 6371;

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function calculateSpeed(
  prevLat: number,
  prevLng: number,
  prevTime: number,
  currLat: number,
  currLng: number,
  currTime: number,
): number {
  const distanceKm = haversineDistance(prevLat, prevLng, currLat, currLng);
  const timeHours = Math.max((currTime - prevTime) / 3_600_000, 1e-6);
  return distanceKm / timeHours;
}

export type MotionState = 'stay' | 'walk' | 'run' | 'vehicle';

export function detectMotionState(speedKmh: number): MotionState {
  if (speedKmh < 1) return 'stay';
  if (speedKmh < 7) return 'walk';
  if (speedKmh < 15) return 'run';
  return 'vehicle';
}

export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters}米`;
  }
  return `${km.toFixed(1)}公里`;
}

/**
 * Calculate bearing (azimuth) from point 1 to point 2.
 * Returns angle in degrees: 0° = north, 90° = east, 180° = south, 270° = west.
 * Range: 0° (inclusive) to 360° (exclusive).
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const toDeg = (rad: number): number => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return ((toDeg(θ) + 360) % 360);
}
