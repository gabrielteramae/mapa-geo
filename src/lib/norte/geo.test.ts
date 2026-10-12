import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bearingDegrees, compass, formatCoord, haversineMeters } from "./geo.ts";
import { hitsFromPhoton } from "./geocode.ts";
import { parsePlaces } from "./places.ts";

describe("haversineMeters", () => {
  it("é zero no mesmo ponto", () => {
    const aqui = { lat: -23.561414, lng: -46.655881 };
    assert.equal(haversineMeters(aqui, aqui), 0);
  });

  it("mede cerca de 1,1 km para 0,01° de latitude", () => {
    const meters = haversineMeters({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
    assert.ok(meters > 1100 && meters < 1120, String(meters));
  });
});

describe("bearingDegrees", () => {
  it("aponta para o norte", () => {
    const deg = bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    assert.ok(deg < 1 || deg > 359, String(deg));
    assert.equal(compass(deg), "N");
  });

  it("aponta para o leste", () => {
    const deg = bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    assert.ok(Math.abs(deg - 90) < 1, String(deg));
    assert.equal(compass(90), "L");
  });
});

describe("formatCoord", () => {
  it("usa S e O no hemisfério de São Paulo", () => {
    assert.equal(formatCoord(-23.56141, -46.65588), "23.56141° S · 46.65588° O");
  });
});

describe("hitsFromPhoton", () => {
  it("lê nome e coordenada GeoJSON", () => {
    const hits = hitsFromPhoton({
      features: [
        {
          geometry: { coordinates: [-46.656, -23.561] },
          properties: { name: "Avenida Paulista", city: "São Paulo", state: "São Paulo", country: "Brasil", osm_id: 1, osm_type: "W" },
        },
      ],
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.name, "Avenida Paulista");
    assert.equal(hits[0]?.lat, -23.561);
    assert.equal(hits[0]?.lng, -46.656);
    assert.match(hits[0]?.detail ?? "", /São Paulo/);
  });

  it("ignora payload inválido", () => {
    assert.deepEqual(hitsFromPhoton(null), []);
    assert.deepEqual(hitsFromPhoton({ features: [{ geometry: { coordinates: [0] } }] }), []);
  });
});

describe("parsePlaces", () => {
  it("descarta registro sem nota ou fora do globo", () => {
    const places = parsePlaces([
      { id: "a", name: "Sé", note: "", lat: -23.55, lng: -46.63, savedAt: 1 },
      { id: "b", name: "Quebrado", note: "", lat: 120, lng: 0, savedAt: 1 },
      { id: "c", name: "", note: "", lat: 0, lng: 0, savedAt: 1 },
    ]);
    assert.equal(places.length, 1);
    assert.equal(places[0]?.id, "a");
  });
});
