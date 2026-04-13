"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import MapGL, {
  NavigationControl,
  ScaleControl,
  MapRef,
  useControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer } from "@deck.gl/layers";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAP_STYLE: any = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "© Esri",
      maxzoom: 19,
    },
    labels: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.75 } },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

// Voltage color helpers
function voltageToColor(voltage: string | undefined | null): [number, number, number, number] {
  if (!voltage) return [...VOLTAGE_COLORS.unknown, 200];
  const v = String(voltage);
  if (v.includes("750") || v.includes("750000")) return [...VOLTAGE_COLORS["750"], 220];
  if (v.includes("400") || v.includes("400000")) return [...VOLTAGE_COLORS["400"], 220];
  if (v.includes("330") || v.includes("330000")) return [...VOLTAGE_COLORS["330"], 220];
  if (v.includes("220") || v.includes("220000")) return [...VOLTAGE_COLORS["220"], 220];
  if (v.includes("110") || v.includes("110000")) return [...VOLTAGE_COLORS["110"], 220];
  if (v.includes("35") || v.includes("35000")) return [...VOLTAGE_COLORS["35"], 220];
  if (v.includes("20") || v.includes("20000")) return [...VOLTAGE_COLORS["20"], 220];
  if (v.includes("10") || v.includes("10000")) return [...VOLTAGE_COLORS["10"], 220];
  return [...VOLTAGE_COLORS.unknown, 200];
}

function voltageToWidth(voltage: string | undefined | null): number {
  if (!voltage) return 1;
  const v = String(voltage);
  if (v.includes("750") || v.includes("750000")) return 4;
  if (v.includes("400") || v.includes("400000")) return 3.5;
  if (v.includes("220") || v.includes("220000")) return 3;
  if (v.includes("110") || v.includes("110000")) return 2.5;
  return 1.5;
}

function fuelToColor(fuel: string | undefined | null): [number, number, number, number] {
  switch (fuel) {
    case "solar": return [251, 191, 36, 220];
    case "eolian": return [34, 211, 238, 220];
    case "hidro": return [59, 130, 246, 220];
    case "nuclear": return [244, 63, 94, 220];
    case "carbune": return [120, 113, 108, 220];
    case "gaz": return [249, 115, 22, 220];
    case "biomasa": return [74, 222, 128, 220];
    case "stocare": return [192, 132, 252, 220];
    default: return [113, 113, 122, 220];
  }
}

// DeckGL overlay
function DeckGLOverlay(props: { layers: any[] }) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay({ interleaved: true }));
  overlay.setProps({ layers: props.layers });
  return null;
}

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
  const [layers, setLayers] = useState<LayerVisibility>({
    lines: true, substations: true, towers: true, plants: true,
    projects: false, solarSatellite: true, windSatellite: true, heatmap: false,
  });
  const [voltageFilter, setVoltageFilter] = useState<VoltageFilter>(() => {
    const f: VoltageFilter = {};
    Object.keys(VOLTAGE_COLORS).forEach((v) => { if (v !== "unknown") f[v] = true; });
    return f;
  });
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [cursorPosition, setCursorPosition] = useState<[number, number] | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const [selectedCountries, setSelectedCountries] = useState<string[]>(["RO"]);

  // Data states — merged from all selected countries
  const [linesData, setLinesData] = useState<any>(null);
  const [substationsData, setSubstationsData] = useState<any>(null);
  const [towersData, setTowersData] = useState<any>(null);
  const [plantsData, setPlantsData] = useState<any>(null);
  const [solarData, setSolarData] = useState<any>(null);
  const [windData, setWindData] = useState<any>(null);
  const [powerplantsData, setPowerplantsData] = useState<any>(null);

  const loadJson = useCallback(async (name: string) => {
    try {
      const r = await fetch(`/data/${name}`);
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }, []);

  // Load Romania + global data on mount
  useEffect(() => {
    Promise.all([
      loadJson("romania_lines.geojson").then(setLinesData),
      loadJson("romania_substations.geojson").then(setSubstationsData),
      loadJson("romania_towers.geojson").then(setTowersData),
      loadJson("romania_plants.geojson").then(setPlantsData),
      loadJson("europe_solar.geojson").then(setSolarData),
      loadJson("europe_wind.geojson").then(setWindData),
      loadJson("europe_powerplants.geojson").then(setPowerplantsData),
    ]).then(() => setIsLoading(false));
  }, [loadJson]);

  // Load additional country data when countries change
  // Note: bounding boxes overlap at borders — this is intentional,
  // cross-border power lines are useful for grid engineers
  useEffect(() => {
    const loadCountryData = async () => {
      // Always start with Romania
      const [roLines, roSubs] = await Promise.all([
        loadJson("romania_lines.geojson"),
        loadJson("romania_substations.geojson"),
      ]);

      let allLines: any[] = roLines?.features || [];
      let allSubs: any[] = roSubs?.features || [];

      // Add each extra selected country
      const extras = selectedCountries.filter(c => c !== "RO");
      if (extras.length > 0) {
        const loads = extras.flatMap(code => [
          loadJson(`countries/${code}_lines.geojson`),
          loadJson(`countries/${code}_substations.geojson`),
        ]);
        const results = await Promise.all(loads);
        for (const r of results) {
          if (r?.features) allLines = [...allLines, ...r.features];
        }
        // Actually separate lines and substations properly
        allLines = roLines?.features || [];
        allSubs = roSubs?.features || [];
        for (let i = 0; i < extras.length; i++) {
          const cl = results[i * 2];
          const cs = results[i * 2 + 1];
          if (cl?.features) allLines.push(...cl.features);
          if (cs?.features) allSubs.push(...cs.features);
        }
      }

      setLinesData({ type: "FeatureCollection", features: allLines });
      setSubstationsData({ type: "FeatureCollection", features: allSubs });
    };

    if (!isLoading) loadCountryData();
  }, [selectedCountries, isLoading, loadJson]);

  const handleToggleCountry = useCallback((code: string) => {
    setSelectedCountries(prev => {
      if (code === "RO") return prev; // Romania always selected
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (prev.length >= 3) return prev;
      return [...prev, code];
    });
  }, []);

  // Stats
  const stats: DataStats = useMemo(() => ({
    lines: linesData?.features?.length || 0,
    substations: substationsData?.features?.length || 0,
    towers: towersData?.features?.length || 0,
    plants: (plantsData?.features?.length || 0) + (powerplantsData?.features?.length || 0),
    projects: 0,
    solarSatellite: solarData?.features?.length || 0,
    windSatellite: windData?.features?.length || 0,
  }), [linesData, substationsData, towersData, plantsData, solarData, windData, powerplantsData]);

  const handleToggleLayer = useCallback((l: keyof LayerVisibility) => {
    setLayers((p) => ({ ...p, [l]: !p[l] }));
  }, []);
  const handleToggleVoltage = useCallback((v: string) => {
    setVoltageFilter((p) => ({ ...p, [v]: !p[v] }));
  }, []);
  const handleSearch = useCallback((q: string) => { setSearchQuery(q); }, []);

  // Click handler
  const handleDeckClick = useCallback((info: any) => {
    if (!info.object) { setSelectedFeature(null); return; }
    const props = info.object.properties || {};
    const id: string = info.layer?.id || "";
    let layerType: SelectedFeature["layerType"] = "lines";
    if (id.includes("substation")) layerType = "substations";
    else if (id.includes("tower")) layerType = "towers";
    else if (id.includes("plant") || id.includes("powerplant")) layerType = "plants";
    else if (id.includes("solar")) layerType = "solarSatellite";
    else if (id.includes("wind")) layerType = "windSatellite";
    const coord = info.coordinate || [0, 0];
    setSelectedFeature({ properties: props, layerType, lngLat: [coord[0], coord[1]] });
  }, []);

  // Build deck.gl layers — simple GeoJsonLayer, GPU-rendered
  const deckLayers = useMemo(() => {
    const result: any[] = [];

    if (layers.lines && linesData) {
      result.push(new GeoJsonLayer({
        id: "lines",
        data: linesData,
        getLineColor: (f: any) => voltageToColor(f.properties?.voltage),
        getLineWidth: (f: any) => voltageToWidth(f.properties?.voltage),
        lineWidthUnits: "pixels" as const,
        pickable: true,
        onClick: handleDeckClick,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
      }));
    }

    if (layers.substations && substationsData) {
      result.push(new GeoJsonLayer({
        id: "substations",
        data: substationsData,
        getFillColor: [245, 158, 11, 50],
        getLineColor: [251, 191, 36, 180],
        getLineWidth: 1.5,
        lineWidthUnits: "pixels" as const,
        getPointRadius: 5,
        pointRadiusUnits: "pixels" as const,
        pointRadiusMinPixels: 3,
        pointRadiusMaxPixels: 12,
        pickable: true,
        onClick: handleDeckClick,
        autoHighlight: true,
        highlightColor: [251, 191, 36, 120],
      }));
    }

    if (layers.towers && towersData) {
      result.push(new GeoJsonLayer({
        id: "towers",
        data: towersData,
        getFillColor: [148, 163, 184, 150],
        getPointRadius: 2,
        pointRadiusUnits: "pixels" as const,
        pointRadiusMinPixels: 1,
        pointRadiusMaxPixels: 5,
        pickable: true,
        onClick: handleDeckClick,
      }));
    }

    if (layers.plants && plantsData) {
      result.push(new GeoJsonLayer({
        id: "plants",
        data: plantsData,
        getFillColor: [34, 197, 94, 180],
        getLineColor: [74, 222, 128, 200],
        getLineWidth: 1,
        lineWidthUnits: "pixels" as const,
        getPointRadius: 6,
        pointRadiusUnits: "pixels" as const,
        pointRadiusMinPixels: 3,
        pointRadiusMaxPixels: 14,
        pickable: true,
        onClick: handleDeckClick,
        autoHighlight: true,
        highlightColor: [74, 222, 128, 120],
      }));
    }

    if (layers.plants && powerplantsData) {
      result.push(new GeoJsonLayer({
        id: "powerplants",
        data: powerplantsData,
        getFillColor: (f: any) => fuelToColor(f.properties?.fuel),
        getPointRadius: (f: any) => {
          const mw = f.properties?.capacity_mw || 0;
          if (mw >= 1000) return 12;
          if (mw >= 100) return 8;
          if (mw >= 10) return 5;
          return 3;
        },
        pointRadiusUnits: "pixels" as const,
        pointRadiusMinPixels: 2,
        pointRadiusMaxPixels: 20,
        getLineColor: [255, 255, 255, 80],
        getLineWidth: 1,
        lineWidthUnits: "pixels" as const,
        pickable: true,
        onClick: handleDeckClick,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 100],
      }));
    }

    if (layers.solarSatellite && solarData) {
      result.push(new GeoJsonLayer({
        id: "solar",
        data: solarData,
        getFillColor: [251, 191, 36, 200],
        getPointRadius: 4,
        pointRadiusUnits: "pixels" as const,
        pointRadiusMinPixels: 2,
        pointRadiusMaxPixels: 10,
        getLineColor: [245, 158, 11, 180],
        getLineWidth: 1.5,
        lineWidthUnits: "pixels" as const,
        pickable: true,
        onClick: handleDeckClick,
        autoHighlight: true,
        highlightColor: [251, 191, 36, 120],
      }));
    }

    if (layers.windSatellite && windData) {
      result.push(new GeoJsonLayer({
        id: "wind",
        data: windData,
        getFillColor: [34, 211, 238, 200],
        getPointRadius: 3,
        pointRadiusUnits: "pixels" as const,
        pointRadiusMinPixels: 1,
        pointRadiusMaxPixels: 8,
        pickable: true,
        onClick: handleDeckClick,
      }));
    }

    return result;
  }, [layers, linesData, substationsData, towersData, plantsData, powerplantsData, solarData, windData, handleDeckClick]);

  return (
    <div className="relative w-full h-full">
      <MapGL
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={MAP_STYLE}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        onMouseMove={(e) => setCursorPosition([e.lngLat.lng, e.lngLat.lat])}
        cursor="default"
        attributionControl={true}
        maxZoom={19}
        minZoom={3}
        onLoad={() => setIsLoading(false)}
      >
        <NavigationControl position="bottom-right" showCompass visualizePitch />
        <ScaleControl position="bottom-left" maxWidth={200} unit="metric" />
        <DeckGLOverlay layers={deckLayers} />
      </MapGL>

      <SearchBar
        onSearch={handleSearch}
        onFlyTo={(lng, lat, zoom) => {
          mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1500 });
        }}
        mapRef={mapRef}
      />

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

      <InfoPanel
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        onFlyTo={(lng, lat, zoom) => {
          mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom || 15, duration: 1500 });
        }}
      />

      <ChatSidebar
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        onFlyTo={(lng, lat, zoom) => {
          mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1500 });
        }}
      />

      {cursorPosition && !isLoading && (
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 10, padding: "4px 12px", background: "rgba(13,13,18,0.8)", backdropFilter: "blur(8px)", border: "1px solid #27272a", borderRadius: 6 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#71717a" }}>
            {cursorPosition[1].toFixed(5)}°N, {cursorPosition[0].toFixed(5)}°E
            <span style={{ marginLeft: 12, color: "#3f3f46" }}>Z{viewState.zoom.toFixed(1)}</span>
          </span>
        </div>
      )}

      {isLoading && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,15,0.8)", backdropFilter: "blur(4px)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 48, height: 48, border: "2px solid #27272a", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: "#e4e4e7" }}>Se incarca datele...</p>
            <p style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>PowerGrid AI</p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <button
        onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: "absolute", top: 12, right: 12, zIndex: 20,
          width: 40, height: 40, borderRadius: 10,
          background: chatOpen ? "rgba(59,130,246,0.2)" : "rgba(13,13,18,0.95)",
          border: chatOpen ? "1px solid rgba(59,130,246,0.5)" : "1px solid #27272a",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(16px)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
        title="Chat AI"
      >
        <span style={{ fontSize: 18 }}>💬</span>
      </button>
    </div>
  );
}
