export type LatLng = {
  lat: number;
  lng: number;
};

export type Place = {
  id: string;
  name: string;
  note: string;
  lat: number;
  lng: number;
  savedAt: number;
};

export type Draft = {
  lat: number;
  lng: number;
  name: string;
  note: string;
};

export type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
};

export type Hit = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
};

/** Avenida Paulista — partida visual até o GPS responder. */
export const SAO_PAULO: LatLng = { lat: -23.561414, lng: -46.655881 };
