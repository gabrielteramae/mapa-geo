import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, LocateFixed, Moon, Navigation, Search, Sun, Trash2, X } from "lucide-react";
import { reversePlace, searchPlaces } from "@/lib/norte/geocode.ts";
import { bearingDegrees, compass, formatAccuracy, formatCoord, formatDistance, formatPair, haversineMeters } from "@/lib/norte/geo.ts";
import { MAX_PLACES, STYLE_KEY, loadPlaces, persistPlaces } from "@/lib/norte/places.ts";
import { SAO_PAULO, type Draft, type Fix, type Hit, type Place } from "@/lib/norte/types.ts";
import { MapCanvas, type MapHandle, type MapStyleId } from "./MapCanvas.tsx";

function geoMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "O navegador bloqueou a localização. Busque um lugar ou toque no mapa.";
  }
  if (error.code === error.TIMEOUT) return "O GPS demorou demais. Tente de novo.";
  return "Sem sinal de GPS neste aparelho.";
}

function toFix(position: GeolocationPosition): Fix {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    at: position.timestamp,
  };
}

function placeCount(count: number): string {
  return count === 1 ? "1 lugar" : `${count} lugares`;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NorteApp() {
  const mapRef = useRef<MapHandle>(null);
  const reverseRef = useRef<AbortController | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [fix, setFix] = useState<Fix | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [follow, setFollow] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [styleId, setStyleId] = useState<MapStyleId>("dark");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = places.find((place) => place.id === selectedId) ?? null;

  useEffect(() => {
    setPlaces(loadPlaces());
    const stored = localStorage.getItem(STYLE_KEY);
    if (stored === "light" || stored === "dark") setStyleId(stored);
  }, []);

  const biasRef = useRef(SAO_PAULO);
  biasRef.current = fix ?? SAO_PAULO;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchPlaces(q, biasRef.current, controller.signal)
        .then((next) => {
          setHits(next);
          setSearching(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setHits([]);
          setSearching(false);
          setSearchError("Não deu para buscar agora.");
        });
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!follow || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setFix(toFix(position));
        setFixError(null);
      },
      (error) => setFixError(geoMessage(error)),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [follow]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const kicker = useMemo(() => {
    if (locating) return "Lendo o GPS…";
    if (fixError) return fixError;
    if (fix) return formatAccuracy(fix.accuracy) || "Posição lida";
    return "Partindo de São Paulo";
  }, [locating, fixError, fix]);

  const coordLine = fix ? formatCoord(fix.lat, fix.lng) : formatCoord(SAO_PAULO.lat, SAO_PAULO.lng);

  function stopFollow() {
    setFollow(false);
  }

  function locate() {
    if (!navigator.geolocation) {
      setFixError("Este navegador não entrega a posição.");
      return;
    }
    if (!window.isSecureContext) {
      setFixError("A localização pede uma página segura.");
      return;
    }
    setLocating(true);
    setFixError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = toFix(position);
        setFix(next);
        setLocating(false);
        setFollow(true);
        mapRef.current?.flyTo(next.lat, next.lng, 16);
      },
      (error) => {
        setLocating(false);
        setFollow(false);
        setFixError(geoMessage(error));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  }

  function pick(lat: number, lng: number) {
    stopFollow();
    setSelectedId(null);
    setConfirmDelete(false);
    setQuery("");
    setHits([]);
    const next: Draft = { lat, lng, name: "Ponto no mapa", note: "" };
    setDraft(next);
    setOpen(true);
    reverseRef.current?.abort();
    const controller = new AbortController();
    reverseRef.current = controller;
    void reversePlace({ lat, lng }, controller.signal)
      .then((name) => {
        if (!name) return;
        setDraft((current) => {
          if (!current) return current;
          if (Math.abs(current.lat - lat) > 1e-6 || Math.abs(current.lng - lng) > 1e-6) return current;
          if (current.name !== "Ponto no mapa") return current;
          return { ...current, name };
        });
      })
      .catch(() => undefined);
  }

  function chooseHit(hit: Hit) {
    stopFollow();
    setQuery("");
    setHits([]);
    setSelectedId(null);
    setConfirmDelete(false);
    setDraft({ lat: hit.lat, lng: hit.lng, name: hit.name, note: "" });
    setOpen(true);
    mapRef.current?.flyTo(hit.lat, hit.lng, 16);
  }

  function saveDraft() {
    if (!draft) return;
    if (places.length >= MAX_PLACES) return;
    const place: Place = {
      id: newId(),
      name: draft.name.trim() || "Ponto no mapa",
      note: draft.note.trim(),
      lat: draft.lat,
      lng: draft.lng,
      savedAt: Date.now(),
    };
    const next = [place, ...places];
    setPlaces(next);
    persistPlaces(next);
    setDraft(null);
    setSelectedId(place.id);
    setOpen(true);
  }

  function patchPlace(id: string, patch: Partial<Pick<Place, "name" | "note">>) {
    setPlaces((current) => {
      const next = current.map((place) => (place.id === id ? { ...place, ...patch } : place));
      persistPlaces(next);
      return next;
    });
  }

  function removeSelected() {
    if (!selected) return;
    const next = places.filter((place) => place.id !== selected.id);
    setPlaces(next);
    persistPlaces(next);
    setSelectedId(null);
    setConfirmDelete(false);
  }

  async function copyCoords(lat: number, lng: number) {
    const text = formatPair(lat, lng);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      setFixError("Não foi possível copiar.");
    }
  }

  function selectPlace(id: string) {
    const place = places.find((item) => item.id === id);
    if (!place) return;
    stopFollow();
    setDraft(null);
    setConfirmDelete(false);
    setSelectedId(id);
    setOpen(true);
    mapRef.current?.flyTo(place.lat, place.lng, 16);
  }

  const measure =
    fix && selected
      ? `${formatDistance(haversineMeters(fix, selected))} · ${compass(bearingDegrees(fix, selected))}`
      : null;

  return (
    <main className="norte-shell">
      <h1 className="sr-only">Norte — mapa de geolocalização</h1>
      <MapCanvas
        ref={mapRef}
        styleId={styleId}
        places={places}
        draft={draft}
        selectedId={selectedId}
        fix={fix}
        follow={follow}
        onPick={pick}
        onSelect={selectPlace}
        onUserMove={stopFollow}
      />

      <header className="norte-top">
        <div className="norte-brand">
          <Navigation className="norte-mark" aria-hidden="true" strokeWidth={2.25} />
          <p className="norte-word">Norte</p>
        </div>
        <form
          className="norte-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const first = hits[0];
            if (first) chooseHit(first);
          }}
        >
          <Search className="norte-search-icon" aria-hidden="true" strokeWidth={2} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar rua, praça, cidade"
            aria-label="Buscar lugar"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              className="norte-clear"
              aria-label="Limpar busca"
              onClick={() => {
                setQuery("");
                setHits([]);
              }}
            >
              <X aria-hidden="true" strokeWidth={2} />
            </button>
          ) : null}
        </form>
        {query.trim().length >= 2 ? (
          <ul className="norte-results" role="listbox" aria-label="Resultados">
            {searching ? <li className="norte-hit is-muted">Buscando…</li> : null}
            {searchError ? <li className="norte-hit is-muted">{searchError}</li> : null}
            {!searching && !searchError && hits.length === 0 ? (
              <li className="norte-hit is-muted">Nenhum lugar com esse nome.</li>
            ) : null}
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" className="norte-hit" onClick={() => chooseHit(hit)}>
                  <span className="norte-hit-name">{hit.name}</span>
                  {hit.detail ? <span className="norte-hit-detail">{hit.detail}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="norte-tools">
        <button type="button" className="norte-iconbtn" onClick={locate} aria-label="Onde estou">
          <LocateFixed className={locating ? "norte-spin" : undefined} aria-hidden="true" strokeWidth={2} />
        </button>
        {fix ? (
          <button
            type="button"
            className={follow ? "norte-iconbtn is-on" : "norte-iconbtn"}
            onClick={() => setFollow((value) => !value)}
            aria-pressed={follow}
            aria-label={follow ? "Parar de seguir" : "Seguir minha posição"}
          >
            <Navigation aria-hidden="true" strokeWidth={2} />
          </button>
        ) : null}
        <button type="button" className="norte-iconbtn" aria-label="Apontar para o norte" onClick={() => mapRef.current?.resetNorth()}>
          <span className="norte-n">N</span>
        </button>
        <button
          type="button"
          className="norte-iconbtn"
          aria-label={styleId === "dark" ? "Mapa claro" : "Mapa escuro"}
          onClick={() => {
            const next = styleId === "dark" ? "light" : "dark";
            setStyleId(next);
            localStorage.setItem(STYLE_KEY, next);
          }}
        >
          {styleId === "dark" ? <Sun aria-hidden="true" strokeWidth={2} /> : <Moon aria-hidden="true" strokeWidth={2} />}
        </button>
      </div>

      <aside className="norte-panel" data-open={open ? "true" : "false"}>
        <div className="norte-peek">
          <div className="min-w-0">
            <p className="norte-kicker">{kicker}</p>
            <p className="norte-coords">{coordLine}</p>
          </div>
          <button type="button" className="norte-count md:hidden" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? "Fechar" : placeCount(places.length)}
          </button>
          <p className="norte-count is-label">{placeCount(places.length)}</p>
        </div>

        <div className="norte-body">
          {draft ? (
            <form
              className="norte-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveDraft();
              }}
            >
              <p className="norte-kicker">Novo lugar</p>
              <label className="norte-field">
                <span>Nome</span>
                <input
                  value={draft.name}
                  maxLength={80}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>
              <label className="norte-field">
                <span>Nota</span>
                <input
                  value={draft.note}
                  maxLength={200}
                  placeholder="Opcional"
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
              </label>
              <p className="norte-coords">{formatCoord(draft.lat, draft.lng)}</p>
              <div className="norte-actions">
                <button type="submit" className="norte-primary" disabled={places.length >= MAX_PLACES}>
                  Salvar
                </button>
                <button type="button" className="norte-ghost" onClick={() => setDraft(null)}>
                  Descartar
                </button>
              </div>
              {places.length >= MAX_PLACES ? <p className="norte-kicker">Limite de {MAX_PLACES} lugares neste aparelho.</p> : null}
            </form>
          ) : null}

          {!draft && selected ? (
            <div className="norte-form">
              <p className="norte-kicker">{measure ?? "Localize-se para medir a distância"}</p>
              <label className="norte-field">
                <span>Nome</span>
                <input
                  value={selected.name}
                  maxLength={80}
                  onChange={(event) => patchPlace(selected.id, { name: event.target.value || "Ponto no mapa" })}
                />
              </label>
              <label className="norte-field">
                <span>Nota</span>
                <input
                  value={selected.note}
                  maxLength={200}
                  placeholder="Opcional"
                  onChange={(event) => patchPlace(selected.id, { note: event.target.value })}
                />
              </label>
              <p className="norte-coords">{formatCoord(selected.lat, selected.lng)}</p>
              <div className="norte-actions">
                <button type="button" className="norte-ghost" onClick={() => void copyCoords(selected.lat, selected.lng)}>
                  <Copy aria-hidden="true" strokeWidth={2} />
                  {copied ? "Copiado" : "Copiar"}
                </button>
                <button
                  type="button"
                  className="norte-ghost is-danger"
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    removeSelected();
                  }}
                >
                  <Trash2 aria-hidden="true" strokeWidth={2} />
                  {confirmDelete ? "Apagar agora" : "Apagar"}
                </button>
              </div>
            </div>
          ) : null}

          {!draft && !selected ? (
            places.length === 0 ? (
              <p className="norte-empty">Nada salvo ainda. Toque no mapa para cravar um ponto, ou busque um endereço.</p>
            ) : (
              <ul className="norte-list">
                {places.map((place, index) => {
                  const line = fix
                    ? `${formatDistance(haversineMeters(fix, place))} · ${compass(bearingDegrees(fix, place))}`
                    : formatCoord(place.lat, place.lng);
                  return (
                    <li key={place.id}>
                      <button type="button" className="norte-row" onClick={() => selectPlace(place.id)}>
                        <span className="norte-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0">
                          <span className="norte-hit-name">{place.name}</span>
                          <span className="norte-hit-detail">{place.note || line}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {(draft || selected) && places.length > 0 ? (
            <button
              type="button"
              className="norte-ghost norte-back"
              onClick={() => {
                setDraft(null);
                setSelectedId(null);
                setConfirmDelete(false);
              }}
            >
              Ver lugares
            </button>
          ) : null}
        </div>
      </aside>
    </main>
  );
}
