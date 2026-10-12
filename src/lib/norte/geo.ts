import type { LatLng } from "./types.ts";

const EARTH_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);
  const h =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Azimute inicial, graus a partir do norte, sentido horário. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const CARDINALS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"] as const;

export function compass(deg: number): string {
  const index = Math.round(deg / 45) % 8;
  return CARDINALS[index] ?? "N";
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const digits = km < 10 ? 2 : 1;
  return `${km.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}

export function formatAccuracy(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "";
  if (meters < 1000) return `± ${Math.round(meters)} m`;
  return `± ${formatDistance(meters)}`;
}

export function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "L" : "O";
  const latAbs = Math.abs(lat).toFixed(5);
  const lngAbs = Math.abs(lng).toFixed(5);
  return `${latAbs}° ${ns} · ${lngAbs}° ${ew}`;
}

export function formatPair(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Anel aproximado em graus, para o círculo de precisão no mapa. */
export function circleRing(lat: number, lng: number, radiusM: number, steps = 64): [number, number][] {
  const latRad = toRad(lat);
  const mPerDegLat = 111_320;
  const mPerDegLng = Math.max(1, 111_320 * Math.cos(latRad));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const θ = (i / steps) * Math.PI * 2;
    const dLat = (radiusM * Math.sin(θ)) / mPerDegLat;
    const dLng = (radiusM * Math.cos(θ)) / mPerDegLng;
    ring.push([lng + dLng, lat + dLat]);
  }
  return ring;
}
