import type { Place } from "./types.ts";

export const PLACES_KEY = "norte.places.v1";
export const STYLE_KEY = "norte.style.v1";
export const MAX_PLACES = 200;

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const place = value as Partial<Place>;
  return (
    typeof place.id === "string" &&
    place.id.length > 0 &&
    place.id.length < 80 &&
    typeof place.name === "string" &&
    place.name.length > 0 &&
    place.name.length <= 80 &&
    typeof place.note === "string" &&
    place.note.length <= 200 &&
    isNum(place.lat) &&
    place.lat >= -90 &&
    place.lat <= 90 &&
    isNum(place.lng) &&
    place.lng >= -180 &&
    place.lng <= 180 &&
    isNum(place.savedAt)
  );
}

export function parsePlaces(value: unknown): Place[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlace).slice(0, MAX_PLACES);
}

export function loadPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(PLACES_KEY);
    if (!raw) return [];
    return parsePlaces(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function persistPlaces(places: Place[]): void {
  localStorage.setItem(PLACES_KEY, JSON.stringify(places.slice(0, MAX_PLACES)));
}
