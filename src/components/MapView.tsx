"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import MapGL, {
  NavigationControl,
  ScaleControl,
  MapLayerMouseEvent,
  MapRef,
  useControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { MVTLayer } from "@deck.gl/geo-layers";
import type { Feature, Geometry } from "geojson";
import Sidebar from "./Sidebar";
import InfoPanel from "./InfoPanel";
import SearchBar from "./SearchBar";
import ChatSidebar from "./ChatSidebar";
import {
  LayerVisibility,
  DataStats,
  SelectedFeature,
  VoltageFilter,
  DEFAULT_VIEW_STATE,
} from "@/lib/types";
import { VOLTAGE_COLORS } from "@/lib/colors";
import { COUNTRY_BOUNDS } from "./CountrySelector";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAP_STYLE: any = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri",
      maxzoom: 19,
    },
    labels: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
    },
    {
      id: "labels",
      type: "raster",
      source: "labels",
      paint: {
        "raster-opacity": 0.75,
      },
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

// Hardcoded stats -- PMTiles cannot be counted in the browser
const stats: DataStats = {
  lines: 394053,
  substations: 470305,
  towers: 111310,
  plants: 717720,
  projects: 0,
  solarSatellite: 30880,
  windSatellite: 99242,
};

// ── Voltage color helpers ──────────────────────────────────────────────
// Returns [R, G, B, A] for a voltage string (handles both kV and V)
function voltageToColor(voltage: string | undefined | null): [number, number, number, number] {
  if (!voltage) return [...VOLTAGE_COLORS.unknown, 230];
  const v = String(voltage);
  if (v.includes("750") || v.includes("750000")) return [...VOLTAGE_COLORS["750"], 230];
  if (v.includes("400") || v.includes("400000")) return [...VOLTAGE_COLORS["400"], 230];
  if (v.includes("330") || v.includes("330000")) return [...VOLTAGE_COLORS["330"], 230];
  if (v.includes("220") || v.includes("220000")) return [...VOLTAGE_COLORS["220"], 230];
  if (v.includes("110") || v.includes("110000")) return [...VOLTAGE_COLORS["110"], 230];
  if (v.includes("35") || v.includes("35000")) return [...VOLTAGE_COLORS["35"], 230];
  if (v.includes("20") || v.includes("20000")) return [...VOLTAGE_COLORS["20"], 230];
  if (v.includes("10") || v.includes("10000")) return [...VOLTAGE_COLORS["10"], 230];
  return [...VOLTAGE_COLORS.unknown, 230];
}

function voltageToWidth(voltage: string | undefined | null): number {
  if (!voltage) return 1;
  const v = String(voltage);
  if (v.includes("750") || v.includes("750000")) return 4;
  if (v.includes("400") || v.includes("400000")) return 3.5;
  if (v.includes("220") || v.includes("220000")) return 3;
  if (v.includes("110") || v.includes("110000")) return 2.5;
  if (v.includes("35") || v.includes("35000")) return 1.8;
  if (v.includes("20") || v.includes("20000")) return 1.5;
  if (v.includes("10") || v.includes("10000")) return 1.2;
  return 1;
}

// Fuel type -> RGBA color for WRI power plants
function fuelToColor(fuel: string | undefined | null): [number, number, number, number] {
  switch (fuel) {
    case "solar": return [251, 191, 36, 220];
    case "eolian": return [34, 211, 238, 220];
    case "hidro": return [59, 130, 246, 220];
    case "nuclear": return [244, 63, 94, 220];
    case "carbune": return [120, 113, 108, 220];
    case "gaz": return [249, 115, 22, 220];
    case "petrol": return [161, 98, 7, 220];
    case "biomasa": return [74, 222, 128, 220];
    case "deseuri": return [163, 163, 163, 220];
    case "geotermal": return [232, 121, 249, 220];
    case "cogenerare": return [251, 146, 60, 220];
    case "stocare": return [192, 132, 252, 220];
    default: return [113, 113, 122, 220];
  }
}

// ── DeckGL overlay component for react-map-gl/maplibre ─────────────────
function DeckGLOverlay(props: { layers: any[] }) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ interleaved: true })
  );
  overlay.setProps({ layers: props.layers });
  return null;
}

// ── Tile URL ──────────────────────────────────────────────────────────
const TILE_URL = "/api/tiles/{z}/{x}/{y}";

// ── Main component ────────────────────────────────────────────────────
export default function MapView() {
  const mapRef = useRef<MapRef>(null);

  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
  const [layers, setLayers] = useState<LayerVisibility>({
    lines: true,
    substations: true,
    towers: true,
    plants: true,
    projects: true,
    solarSatellite: true,
    windSatellite: true,
    heatmap: false,
  });

  const [voltageFilter, setVoltageFilter] = useState<VoltageFilter>(() => {
    const filter: VoltageFilter = {};
    Object.keys(VOLTAGE_COLORS).forEach((v) => {
      if (v !== "unknown") filter[v] = true;
    });
    return filter;
  });

  const [selectedFeature, setSelectedFeature] =
    useState<SelectedFeature | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [cursorPosition, setCursorPosition] = useState<[number, number] | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["RO"]);

  // Active voltage set for filtering
  const activeVoltages = useMemo(() => {
    return new Set(
      Object.entries(voltageFilter)
        .filter(([, active]) => active)
        .map(([v]) => v)
    );
  }, [voltageFilter]);

  const allVoltagesActive = activeVoltages.size === Object.keys(voltageFilter).length;

  // Filter function: checks if a feature's voltage matches the active filter
  const matchesVoltageFilter = useCallback(
    (voltage: string | undefined | null): boolean => {
      if (allVoltagesActive) return true;
      if (!voltage) return false;
      const v = String(voltage);
      for (const kv of activeVoltages) {
        if (v.includes(kv) || v.includes(String(parseInt(kv) * 1000))) return true;
      }
      return false;
    },
    [activeVoltages, allVoltagesActive]
  );

  // Filter function: checks if a feature matches the search query
  const matchesSearch = useCallback(
    (props: Record<string, any>): boolean => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = String(props.name || props.n || "").toLowerCase();
      const voltage = String(props.voltage || props.v || "").toLowerCase();
      const operator = String(props.operator || "").toLowerCase();
      const ref = String(props.ref || "").toLowerCase();
      return (
        name.includes(q) ||
        voltage.includes(q) ||
        operator.includes(q) ||
        ref.includes(q)
      );
    },
    [searchQuery]
  );

  const handleToggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleToggleVoltage = useCallback((voltage: string) => {
    setVoltageFilter((prev) => ({ ...prev, [voltage]: !prev[voltage] }));
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleToggleCountry = useCallback((code: string) => {
    setSelectedCountries((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      if (prev.length >= 3) return prev;
      return [...prev, code];
    });
  }, []);

  // ── Country bounding-box helpers ─────────────────────────────────────
  const isInSelectedCountries = useCallback(
    (coords: [number, number] | null): boolean => {
      if (!coords) return false;
      const [lng, lat] = coords;
      for (const code of selectedCountries) {
        const bounds = COUNTRY_BOUNDS[code];
        if (
          bounds &&
          lng >= bounds[0] &&
          lat >= bounds[1] &&
          lng <= bounds[2] &&
          lat <= bounds[3]
        )
          return true;
      }
      return false;
    },
    [selectedCountries]
  );

  // Extract representative coordinate from an MVT feature
  function getFeatureCoords(f: Feature<Geometry>): [number, number] | null {
    const geom = f.geometry;
    if (!geom) return null;
    if (geom.type === "Point") return geom.coordinates as [number, number];
    if (geom.type === "MultiPoint" && geom.coordinates.length > 0)
      return geom.coordinates[0] as [number, number];
    if (geom.type === "LineString" && geom.coordinates.length > 0)
      return geom.coordinates[0] as [number, number];
    if (
      geom.type === "MultiLineString" &&
      geom.coordinates.length > 0 &&
      geom.coordinates[0].length > 0
    )
      return geom.coordinates[0][0] as [number, number];
    if (
      geom.type === "Polygon" &&
      geom.coordinates.length > 0 &&
      geom.coordinates[0].length > 0
    )
      return geom.coordinates[0][0] as [number, number];
    if (
      geom.type === "MultiPolygon" &&
      geom.coordinates.length > 0 &&
      geom.coordinates[0].length > 0 &&
      geom.coordinates[0][0].length > 0
    )
      return geom.coordinates[0][0][0] as [number, number];
    return null;
  }

  // ── Click handler for deck.gl picking ────────────────────────────────
  const handleDeckClick = useCallback((info: any) => {
    if (!info.object) {
      setSelectedFeature(null);
      return;
    }

    const f = info.object;
    const props = f.properties || {};
    const layerId: string = info.layer?.id || "";

    let layerType: SelectedFeature["layerType"] = "lines";
    if (layerId.includes("substation")) layerType = "substations";
    else if (layerId.includes("tower")) layerType = "towers";
    else if (layerId.includes("plant") || layerId.includes("powerplant")) layerType = "plants";
    else if (layerId.includes("solar")) layerType = "solarSatellite";
    else if (layerId.includes("wind")) layerType = "windSatellite";
    else if (layerId.includes("line") || layerId.includes("ro-line")) layerType = "lines";

    const coord = info.coordinate || [0, 0];
    setSelectedFeature({
      properties: props,
      layerType,
      lngLat: [coord[0], coord[1]],
    });
  }, []);

  // Keep MapLibre click handler for the base map (dismiss selection)
  const handleMapClick = useCallback((_e: MapLayerMouseEvent) => {
    // deck.gl handles picking; this only fires when clicking empty space
  }, []);

  // ── Compute combined bounding box of selected countries ─────────────
  const selectedExtent = useMemo((): [number, number, number, number] | undefined => {
    if (selectedCountries.length === 0) return undefined;
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    for (const code of selectedCountries) {
      const b = COUNTRY_BOUNDS[code];
      if (!b) continue;
      if (b[0] < minLng) minLng = b[0];
      if (b[1] < minLat) minLat = b[1];
      if (b[2] > maxLng) maxLng = b[2];
      if (b[3] > maxLat) maxLat = b[3];
    }
    return [minLng, minLat, maxLng, maxLat];
  }, [selectedCountries]);

  // ── Build deck.gl layers ─────────────────────────────────────────────
  const deckLayers = useMemo(() => {
    const result: any[] = [];
    // extent limits which tiles are loaded — no per-feature coordinate checks needed
    const extent = selectedExtent;

    // ── Lines layers (source-layers: "lines" and "ro_lines") ──────────
    if (layers.lines) {
      // Lines glow
      result.push(
        new MVTLayer({
          id: "lines-glow",
          data: TILE_URL,
          minZoom: 0,
          maxZoom: 14,
          extent,
          binary: false,
          // Render only features from the "lines" source-layer
          getFilterValue: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            return (ln === "lines" || ln === "ro_lines") ? 1 : 0;
          },
          filterRange: [1, 1],
          extensions: [],
          getLineColor: (f: Feature<Geometry>) => {
            const p = (f.properties as any) || {};

            if (!matchesVoltageFilter(p.voltage) || !matchesSearch(p)) return [0, 0, 0, 0];
            const c = voltageToColor(p.voltage);
            return [c[0], c[1], c[2], 38]; // low opacity for glow
          },
          getLineWidth: 12,
          lineWidthUnits: "pixels" as const,
          pickable: false,
          stroked: false,
          filled: false,
        })
      );

      // Lines main
      result.push(
        new MVTLayer({
          id: "lines-main",
          data: TILE_URL,
          minZoom: 0,
          maxZoom: 14,
          extent,
          binary: false,
          getLineColor: (f: Feature<Geometry>) => {
            const p = (f.properties as any) || {};
            const ln = p.layerName;
            if (ln !== "lines" && ln !== "ro_lines") return [0, 0, 0, 0];

            if (!matchesVoltageFilter(p.voltage) || !matchesSearch(p)) return [0, 0, 0, 0];
            return voltageToColor(p.voltage);
          },
          getLineWidth: (f: Feature<Geometry>) => {
            const p = (f.properties as any) || {};
            const ln = p.layerName;
            if (ln !== "lines" && ln !== "ro_lines") return 0;

            return voltageToWidth(p.voltage);
          },
          lineWidthUnits: "pixels" as const,
          lineWidthMinPixels: 1,
          pickable: true,
          stroked: false,
          filled: false,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          onClick: handleDeckClick,
        })
      );
    }

    // ── Substations layers (source-layers: "substations", "ro_substations") ──
    if (layers.substations) {
      result.push(
        new MVTLayer({
          id: "substations-main",
          data: TILE_URL,
          minZoom: 0,
          maxZoom: 14,
          extent,
          binary: false,
          getFillColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "substations" && ln !== "ro_substations") return [0, 0, 0, 0];

            return [245, 158, 11, 50]; // amber fill
          },
          getLineColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "substations" && ln !== "ro_substations") return [0, 0, 0, 0];

            return [251, 191, 36, 220]; // amber outline
          },
          getLineWidth: 2,
          lineWidthUnits: "pixels" as const,
          getPointRadius: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "substations" && ln !== "ro_substations") return 0;

            return 6;
          },
          pointRadiusUnits: "pixels" as const,
          pointRadiusMinPixels: 3,
          pointRadiusMaxPixels: 12,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          onClick: handleDeckClick,
        })
      );
    }

    // ── Towers (source-layer: "ro_towers") ────────────────────────────
    if (layers.towers) {
      result.push(
        new MVTLayer({
          id: "towers-main",
          data: TILE_URL,
          minZoom: 7,
          maxZoom: 14,
          binary: false,
          getFillColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "ro_towers") return [0, 0, 0, 0];

            return [148, 163, 184, 200];
          },
          getLineColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "ro_towers") return [0, 0, 0, 0];

            return [203, 213, 225, 100];
          },
          getPointRadius: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "ro_towers") return 0;

            return 3;
          },
          pointRadiusUnits: "pixels" as const,
          pointRadiusMinPixels: 1,
          pointRadiusMaxPixels: 8,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          onClick: handleDeckClick,
        })
      );
    }

    // ── Plants (source-layers: "plants", "ro_plants") ─────────────────
    if (layers.plants) {
      result.push(
        new MVTLayer({
          id: "plants-main",
          data: TILE_URL,
          minZoom: 0,
          maxZoom: 14,
          extent,
          binary: false,
          getFillColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "plants" && ln !== "ro_plants") return [0, 0, 0, 0];

            return [34, 197, 94, 65]; // green fill
          },
          getLineColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "plants" && ln !== "ro_plants") return [0, 0, 0, 0];

            return [74, 222, 128, 180]; // green outline
          },
          getLineWidth: 2,
          lineWidthUnits: "pixels" as const,
          getPointRadius: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "plants" && ln !== "ro_plants") return 0;

            return 6;
          },
          pointRadiusUnits: "pixels" as const,
          pointRadiusMinPixels: 3,
          pointRadiusMaxPixels: 14,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          onClick: handleDeckClick,
        })
      );

      // WRI Power Plants layer
      result.push(
        new MVTLayer({
          id: "powerplants-main",
          data: TILE_URL,
          minZoom: 0,
          maxZoom: 14,
          extent,
          binary: false,
          getFillColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "powerplants") return [0, 0, 0, 0];

            return fuelToColor((f.properties as any)?.fuel);
          },
          getLineColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "powerplants") return [0, 0, 0, 0];

            return [255, 255, 255, 100] as [number, number, number, number];
          },
          getLineWidth: 1,
          lineWidthUnits: "pixels" as const,
          getPointRadius: (f: Feature<Geometry>) => {
            const p = (f.properties as any) || {};
            if (p.layerName !== "powerplants") return 0;

            const mw = p.capacity_mw || 0;
            if (mw >= 5000) return 14;
            if (mw >= 1000) return 10;
            if (mw >= 100) return 7;
            return 4;
          },
          pointRadiusUnits: "pixels" as const,
          pointRadiusMinPixels: 2,
          pointRadiusMaxPixels: 20,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          onClick: handleDeckClick,
        })
      );
    }

    // ── Solar satellite parks (source-layer: "solar") ─────────────────
    if (layers.solarSatellite) {
      result.push(
        new MVTLayer({
          id: "solar-main",
          data: TILE_URL,
          minZoom: 0,
          maxZoom: 14,
          extent,
          binary: false,
          getFillColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "solar") return [0, 0, 0, 0];

            return [251, 191, 36, 220];
          },
          getLineColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "solar") return [0, 0, 0, 0];

            return [245, 158, 11, 180];
          },
          getPointRadius: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "solar") return 0;

            return 6;
          },
          pointRadiusUnits: "pixels" as const,
          pointRadiusMinPixels: 3,
          pointRadiusMaxPixels: 16,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          onClick: handleDeckClick,
        })
      );
    }

    // ── Wind turbines (source-layer: "wind") ──────────────────────────
    if (layers.windSatellite) {
      result.push(
        new MVTLayer({
          id: "wind-main",
          data: TILE_URL,
          minZoom: 0,
          maxZoom: 14,
          extent,
          binary: false,
          getFillColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "wind") return [0, 0, 0, 0];

            return [34, 211, 238, 220];
          },
          getLineColor: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "wind") return [0, 0, 0, 0];

            return [6, 182, 212, 180];
          },
          getPointRadius: (f: Feature<Geometry>) => {
            const ln = (f.properties as any)?.layerName;
            if (ln !== "wind") return 0;

            return 5;
          },
          pointRadiusUnits: "pixels" as const,
          pointRadiusMinPixels: 2,
          pointRadiusMaxPixels: 14,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          onClick: handleDeckClick,
        })
      );
    }

    return result;
  }, [
    layers,
    matchesVoltageFilter,
    matchesSearch,
    handleDeckClick,
    selectedExtent,
  ]);

  return (
    <div className="relative w-full h-full">
      <MapGL
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={MAP_STYLE}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        onMouseMove={(e) => setCursorPosition([e.lngLat.lng, e.lngLat.lat])}
        onLoad={() => setIsLoading(false)}
        cursor="default"
        attributionControl={true}
        maxZoom={19}
        minZoom={4}
      >
        <NavigationControl position="bottom-right" showCompass visualizePitch />
        <ScaleControl position="bottom-left" maxWidth={200} unit="metric" />

        {/* deck.gl overlay renders all data layers via WebGL/GPU */}
        <DeckGLOverlay layers={deckLayers} />
      </MapGL>

      {/* Search Bar */}
      <SearchBar
        onSearch={handleSearch}
        onFlyTo={(lng, lat, zoom) => {
          mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1500 });
        }}
        mapRef={mapRef}
      />

      {/* Sidebar */}
      <Sidebar
        layers={layers}
        onToggleLayer={handleToggleLayer}
        stats={stats}
        voltageFilter={voltageFilter}
        onToggleVoltage={handleToggleVoltage}
        isLoading={isLoading}
        selectedCountries={selectedCountries}
        onToggleCountry={handleToggleCountry}
      />

      {/* Info Panel */}
      <InfoPanel
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        onFlyTo={(lng, lat, zoom) => {
          mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom || 15, duration: 1500 });
        }}
      />

      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        onFlyTo={(lng, lat, zoom) => {
          mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1500 });
        }}
      />

      {/* Coordinate Bar */}
      {cursorPosition && !isLoading && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-surface/80 backdrop-blur-md border border-border rounded-md">
          <span className="text-[11px] font-mono text-muted">
            {cursorPosition[1].toFixed(5)}°N, {cursorPosition[0].toFixed(5)}°E
            <span className="ml-3 text-zinc-600">Z{viewState.zoom.toFixed(1)}</span>
          </span>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Se incarca datele...
              </p>
              <p className="text-xs text-muted mt-1">
                PowerGrid AI - Vizualizare retea
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
