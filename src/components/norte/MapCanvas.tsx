import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { circleRing } from "@/lib/norte/geo.ts";
import { SAO_PAULO, type Draft, type Fix, type Place } from "@/lib/norte/types.ts";

const STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
} as const;

export type MapStyleId = keyof typeof STYLES;

const EMPTY = { type: "FeatureCollection" as const, features: [] as const };

export type MapHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  resetNorth: () => void;
};

type Props = {
  styleId: MapStyleId;
  places: Place[];
  draft: Draft | null;
  selectedId: string | null;
  fix: Fix | null;
  follow: boolean;
  onPick: (lat: number, lng: number) => void;
  onSelect: (id: string) => void;
  onUserMove: () => void;
};

function signalColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-signal").trim();
  return value || "#e25c45";
}

function ensureAccuracy(map: MlMap, color: string) {
  if (map.getSource("accuracy")) return;
  map.addSource("accuracy", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "accuracy-fill",
    type: "fill",
    source: "accuracy",
    paint: { "fill-color": color, "fill-opacity": 0.16 },
  });
  map.addLayer({
    id: "accuracy-line",
    type: "line",
    source: "accuracy",
    paint: { "line-color": color, "line-width": 1.5, "line-opacity": 0.9 },
  });
}

function paintAccuracy(map: MlMap, fix: Fix | null) {
  const source = map.getSource("accuracy") as GeoJSONSource | undefined;
  if (!source) return;
  if (!fix || fix.accuracy <= 0 || fix.accuracy > 20_000) {
    source.setData(EMPTY);
    return;
  }
  source.setData({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [circleRing(fix.lat, fix.lng, fix.accuracy)] },
  });
}

function pinElement(label: string, kind: "place" | "draft" | "selected"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = kind === "place" ? "norte-pin" : `norte-pin is-${kind}`;
  button.textContent = label;
  button.setAttribute("aria-label", kind === "draft" ? "Ponto novo" : label);
  return button;
}

export const MapCanvas = forwardRef<MapHandle, Props>(function MapCanvas(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const userMarker = useRef<Marker | null>(null);
  const draftMarker = useRef<Marker | null>(null);
  const placeMarkers = useRef(new globalThis.Map<string, Marker>());
  const propsRef = useRef(props);
  const appliedStyle = useRef<MapStyleId>("dark");
  propsRef.current = props;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [epoch, setEpoch] = useState(0);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoom) {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({
        center: [lng, lat],
        zoom: zoom ?? Math.max(map.getZoom(), 15),
        essential: true,
        duration: 900,
      });
    },
    resetNorth() {
      mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 450, essential: true });
    },
  }));

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    let map: MlMap | null = null;

    void import("maplibre-gl")
      .then((ml) => {
        if (cancelled || !host.current) return;
        libRef.current = ml;
        ml.setWorkerUrl(workerUrl);
        const color = signalColor();
        map = new ml.Map({
          container: host.current,
          style: STYLES.dark,
          center: [SAO_PAULO.lng, SAO_PAULO.lat],
          zoom: 13,
          attributionControl: { compact: true },
          maxPitch: 0,
          pitchWithRotate: false,
          cooperativeGestures: false,
        });
        map.on("style.load", () => {
          if (cancelled || !map) return;
          ensureAccuracy(map, color);
          setEpoch((value) => value + 1);
          setStatus("ready");
        });
        map.on("click", (event) => {
          const target = event.originalEvent.target;
          if (target instanceof Element && target.closest(".norte-pin, .norte-you")) return;
          propsRef.current.onPick(event.lngLat.lat, event.lngLat.lng);
        });
        map.on("dragstart", () => propsRef.current.onUserMove());
        map.on("rotatestart", () => propsRef.current.onUserMove());
        map.on("error", (event) => {
          const message = event.error?.message ?? "";
          if (/webgl|failed to initialize/i.test(message)) setStatus("error");
        });
        mapRef.current = map;
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      userMarker.current?.remove();
      draftMarker.current?.remove();
      placeMarkers.current.forEach((marker) => marker.remove());
      placeMarkers.current.clear();
      userMarker.current = null;
      draftMarker.current = null;
      map?.remove();
      mapRef.current = null;
      libRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    if (appliedStyle.current === props.styleId) return;
    appliedStyle.current = props.styleId;
    map.setStyle(STYLES[props.styleId]);
  }, [props.styleId, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    paintAccuracy(map, props.fix);
  }, [props.fix, status, epoch]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || status !== "ready") return;

    if (!props.fix) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }

    if (!userMarker.current) {
      const element = document.createElement("div");
      element.className = "norte-you";
      element.innerHTML = '<span class="norte-you-ring"></span><span class="norte-you-dot"></span>';
      userMarker.current = new ml.Marker({ element, anchor: "center" })
        .setLngLat([props.fix.lng, props.fix.lat])
        .addTo(map);
    }
    userMarker.current.setLngLat([props.fix.lng, props.fix.lat]);
  }, [props.fix, status, epoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !props.follow || !props.fix) return;
    map.easeTo({ center: [props.fix.lng, props.fix.lat], duration: 700, essential: true });
  }, [props.follow, props.fix, status]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || status !== "ready") return;

    const seen = new Set<string>();
    props.places.forEach((place, index) => {
      seen.add(place.id);
      const kind = place.id === props.selectedId ? "selected" : "place";
      let marker = placeMarkers.current.get(place.id);
      if (!marker) {
        const element = pinElement(String(index + 1), kind);
        element.addEventListener("pointerdown", (event) => event.stopPropagation());
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          propsRef.current.onSelect(place.id);
        });
        marker = new ml.Marker({ element, anchor: "center" }).setLngLat([place.lng, place.lat]).addTo(map);
        placeMarkers.current.set(place.id, marker);
      } else {
        marker.setLngLat([place.lng, place.lat]);
        const element = marker.getElement();
        element.textContent = String(index + 1);
        element.className = kind === "place" ? "norte-pin" : "norte-pin is-selected";
      }
    });

    for (const [id, marker] of placeMarkers.current) {
      if (seen.has(id)) continue;
      marker.remove();
      placeMarkers.current.delete(id);
    }
  }, [props.places, props.selectedId, status, epoch]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || status !== "ready") return;

    if (!props.draft) {
      draftMarker.current?.remove();
      draftMarker.current = null;
      return;
    }

    if (!draftMarker.current) {
      const element = pinElement("+", "draft");
      element.addEventListener("pointerdown", (event) => event.stopPropagation());
      draftMarker.current = new ml.Marker({ element, anchor: "center" })
        .setLngLat([props.draft.lng, props.draft.lat])
        .addTo(map);
    }
    draftMarker.current.setLngLat([props.draft.lng, props.draft.lat]);
  }, [props.draft, status, epoch]);

  return (
    <div className="norte-map" ref={host} data-status={status}>
      {status === "loading" ? <p className="norte-map-note">Abrindo o mapa…</p> : null}
      {status === "error" ? (
        <p className="norte-map-note">O mapa vetorial não abriu neste navegador. A busca e os lugares salvos continuam aqui.</p>
      ) : null}
    </div>
  );
});
