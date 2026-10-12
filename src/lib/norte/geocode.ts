import type { Hit, LatLng } from "./types.ts";

const PHOTON = "https://photon.komoot.io";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function hitsFromPhoton(payload: unknown): Hit[] {
  if (!payload || typeof payload !== "object") return [];
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];

  const hits: Hit[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const row = feature as {
      geometry?: { coordinates?: unknown };
      properties?: Record<string, unknown>;
    };
    const coords = row.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = finite(coords[0]);
    const lat = finite(coords[1]);
    if (lat === null || lng === null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const props = row.properties ?? {};
    const name = text(props.name) || text(props.street) || text(props.city) || "Lugar";
    const detailParts = [text(props.street), text(props.city) || text(props.county), text(props.state), text(props.country)]
      .filter((part) => part.length > 0 && part !== name);
    const detail = [...new Set(detailParts)].slice(0, 3).join(" · ");
    const osmId = text(props.osm_id) || `${lat.toFixed(5)},${lng.toFixed(5)}`;
    hits.push({
      id: `${text(props.osm_type) || "p"}:${osmId}`,
      name: name.slice(0, 80),
      detail,
      lat,
      lng,
    });
    if (hits.length >= 6) break;
  }
  return hits;
}

function photonUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, PHOTON);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export async function searchPlaces(query: string, bias: LatLng, signal: AbortSignal): Promise<Hit[]> {
  const url = photonUrl("/api/", {
    q: query,
    limit: "6",
    lat: String(bias.lat),
    lon: String(bias.lng),
  });
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("busca indisponível");
  return hitsFromPhoton(await response.json());
}

export async function reversePlace(point: LatLng, signal: AbortSignal): Promise<string | null> {
  const url = photonUrl("/reverse", {
    lat: String(point.lat),
    lon: String(point.lng),
  });
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const [hit] = hitsFromPhoton(await response.json());
  return hit?.name ?? null;
}
