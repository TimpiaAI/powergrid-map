"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import MapGL, {
  NavigationControl,
  ScaleControl,
  Source,
  Layer,
  MapLayerMouseEvent,
  MapRef,
  type LayerProps,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import Sidebar from "./Sidebar";
import InfoPanel from "./InfoPanel";
import SearchBar from "./SearchBar";
import {
  LayerVisibility,
  DataStats,
  SelectedFeature,
  VoltageFilter,
  DEFAULT_VIEW_STATE,
  PowerFeatureCollection,
} from "@/lib/types";
import { VOLTAGE_COLORS, rgbToHex } from "@/lib/colors";

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

const EMPTY_GEOJSON: PowerFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export default function MapView() {
  const mapRef = useRef<MapRef>(null);

  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
  const [layers, setLayers] = useState<LayerVisibility>({
    lines: true,
    substations: true,
    towers: true,
    plants: true,
    projects: true,
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

  const [linesData, setLinesData] =
    useState<PowerFeatureCollection>(EMPTY_GEOJSON);
  const [substationsData, setSubstationsData] =
    useState<PowerFeatureCollection>(EMPTY_GEOJSON);
  const [towersData, setTowersData] =
    useState<PowerFeatureCollection>(EMPTY_GEOJSON);
  const [plantsData, setPlantsData] =
    useState<PowerFeatureCollection>(EMPTY_GEOJSON);
  const [projectsData, setProjectsData] =
    useState<PowerFeatureCollection>(EMPTY_GEOJSON);
  const [solarData, setSolarData] =
    useState<PowerFeatureCollection>(EMPTY_GEOJSON);
  const [windData, setWindData] =
    useState<PowerFeatureCollection>(EMPTY_GEOJSON);

  const [isLoading, setIsLoading] = useState(true);
  const [cursorPosition, setCursorPosition] = useState<[number, number] | null>(null);

  // Load GeoJSON data — Romania first, then Europe if available
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      // Load Romania data first (fast, small files)
      const roFiles = [
        { name: "romania_lines.geojson", setter: setLinesData },
        { name: "romania_substations.geojson", setter: setSubstationsData },
        { name: "romania_towers.geojson", setter: setTowersData },
        { name: "romania_plants.geojson", setter: setPlantsData },
        { name: "romania_projects.geojson", setter: setProjectsData },
        { name: "microsoft_solar_romania.geojson", setter: setSolarData },
        { name: "microsoft_wind_romania.geojson", setter: setWindData },
      ];

      await Promise.allSettled(
        roFiles.map(async ({ name, setter }) => {
          try {
            const res = await fetch(`/data/${name}`);
            if (res.ok) {
              const data = await res.json();
              setter(data);
            }
          } catch {
            // File not available yet
          }
        })
      );

      setIsLoading(false);

      // Load Europe GridKit data and merge with Romania data
      const euFiles = [
        { name: "gridkit_europe_lines.geojson", setter: setLinesData },
        { name: "gridkit_europe_vertices.geojson", setter: setSubstationsData },
        { name: "europe_lines.geojson", setter: setLinesData },
        { name: "europe_substations.geojson", setter: setSubstationsData },
        { name: "europe_plants.geojson", setter: setPlantsData },
      ];

      await Promise.allSettled(
        euFiles.map(async ({ name, setter }) => {
          try {
            const res = await fetch(`/data/${name}`);
            if (res.ok) {
              const euData = await res.json();
              if (euData.features && euData.features.length > 0) {
                setter((prev: PowerFeatureCollection) => ({
                  type: "FeatureCollection",
                  features: [...prev.features, ...euData.features],
                }));
              }
            }
          } catch {
            // Europe data not available yet
          }
        })
      );
    };

    loadData();
  }, []);

  // Compute stats
  const stats: DataStats = useMemo(
    () => ({
      lines: linesData.features.length,
      substations: substationsData.features.length,
      towers: towersData.features.length,
      plants: plantsData.features.length,
      projects: projectsData.features.length,
    }),
    [linesData, substationsData, towersData, plantsData, projectsData]
  );

  // Build voltage filter expression for MapLibre (matches both V and kV)
  const voltageFilterExpression = useMemo((): any[] | undefined => {
    const activeVoltages = Object.entries(voltageFilter)
      .filter(([, active]) => active)
      .map(([v]) => v);

    if (activeVoltages.length === Object.keys(voltageFilter).length) {
      return undefined;
    }

    if (activeVoltages.length === 0) {
      return ["==", ["get", "voltage"], "__none__"];
    }

    const volts = ["to-string", ["coalesce", ["get", "voltage"], ""]];
    const conditions = activeVoltages.flatMap((v) => [
      ["in", v, volts],
      ["in", String(parseInt(v) * 1000), volts],
    ]);

    return ["any", ...conditions];
  }, [voltageFilter]);

  // Search filter
  const searchFilterExpression = useMemo((): any[] | undefined => {
    if (!searchQuery) return undefined;
    const q = searchQuery.toLowerCase();
    return [
      "any",
      ["in", q, ["downcase", ["to-string", ["coalesce", ["get", "name"], ""]]]],
      [
        "in",
        q,
        ["downcase", ["to-string", ["coalesce", ["get", "voltage"], ""]]],
      ],
      [
        "in",
        q,
        ["downcase", ["to-string", ["coalesce", ["get", "operator"], ""]]],
      ],
      ["in", q, ["downcase", ["to-string", ["coalesce", ["get", "ref"], ""]]]],
    ];
  }, [searchQuery]);

  // Combine filters
  const combinedFilter = useMemo((): any[] | undefined => {
    const filters: any[][] = [];
    if (voltageFilterExpression) filters.push(voltageFilterExpression);
    if (searchFilterExpression) filters.push(searchFilterExpression);

    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    return ["all", ...filters];
  }, [voltageFilterExpression, searchFilterExpression]);

  // Build color expression for lines
  // Handles both kV (110) and V (110000) formats from OSM
  const lineColorExpression: any = useMemo(() => {
    const volts = ["to-string", ["coalesce", ["get", "voltage"], ""]];
    return [
      "case",
      // 750kV
      ["any", ["in", "750", volts], ["in", "750000", volts]],
      rgbToHex(VOLTAGE_COLORS["750"]),
      // 400kV
      ["any", ["in", "400", volts], ["in", "400000", volts]],
      rgbToHex(VOLTAGE_COLORS["400"]),
      // 220kV
      ["any", ["in", "220", volts], ["in", "220000", volts]],
      rgbToHex(VOLTAGE_COLORS["220"]),
      // 110kV
      ["any", ["in", "110", volts], ["in", "110000", volts]],
      rgbToHex(VOLTAGE_COLORS["110"]),
      // 20kV
      ["any", ["in", "20", volts], ["in", "20000", volts]],
      rgbToHex(VOLTAGE_COLORS["20"]),
      // 10kV
      ["any", ["in", "10", volts], ["in", "10000", volts]],
      rgbToHex(VOLTAGE_COLORS["10"]),
      // default
      rgbToHex(VOLTAGE_COLORS.unknown),
    ];
  }, []);

  // Build width expression for lines (handles both V and kV)
  const lineWidthExpression: any = useMemo(() => {
    const volts = ["to-string", ["coalesce", ["get", "voltage"], ""]];
    const is750 = ["any", ["in", "750", volts], ["in", "750000", volts]];
    const is400 = ["any", ["in", "400", volts], ["in", "400000", volts]];
    const is220 = ["any", ["in", "220", volts], ["in", "220000", volts]];
    const is110 = ["any", ["in", "110", volts], ["in", "110000", volts]];
    return [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      ["case", is750, 2, is400, 1.8, is220, 1.5, is110, 1.2, 0.8],
      12,
      ["case", is750, 5, is400, 4.5, is220, 4, is110, 3, 1.5],
    ];
  }, []);

  const handleToggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleToggleVoltage = useCallback((voltage: string) => {
    setVoltageFilter((prev) => ({ ...prev, [voltage]: !prev[voltage] }));
  }, []);

  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (!e.features || e.features.length === 0) {
      setSelectedFeature(null);
      return;
    }

    const feature = e.features[0];
    const layerIdToType: Record<string, SelectedFeature["layerType"]> = {
      "power-lines": "lines",
      "power-lines-glow": "lines",
      "substations-fill": "substations",
      "substations-outline": "substations",
      "substations-point": "substations",
      "substations-glow": "substations",
      towers: "towers",
      "plants-fill": "plants",
      "plants-point": "plants",
      "projects-circle": "projects",
      "solar-circle": "plants",
      "wind-circle": "plants",
    };

    setSelectedFeature({
      properties: feature.properties || {},
      layerType: layerIdToType[feature.layer.id] || "lines",
      lngLat: [e.lngLat.lng, e.lngLat.lat],
    });
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Layer definitions
  const linesGlowLayer: LayerProps = useMemo(
    () => ({
      id: "power-lines-glow",
      type: "line" as const,
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          6,
          12,
          14,
        ] as any,
        "line-opacity": 0.15,
        "line-blur": 4,
      },
    }),
    [lineColorExpression, combinedFilter]
  );

  const linesLayer: LayerProps = useMemo(
    () => ({
      id: "power-lines",
      type: "line" as const,
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": lineWidthExpression,
        "line-opacity": 0.9,
      },
    }),
    [lineColorExpression, lineWidthExpression, combinedFilter]
  );

  const substationsFillLayer: LayerProps = useMemo(
    () => ({
      id: "substations-fill",
      type: "fill" as const,
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      paint: {
        "fill-color": "#f59e0b",
        "fill-opacity": 0.2,
      },
    }),
    []
  );

  const substationsOutlineLayer: LayerProps = useMemo(
    () => ({
      id: "substations-outline",
      type: "line" as const,
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      paint: {
        "line-color": "#fbbf24",
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 14, 2.5] as any,
        "line-opacity": 0.85,
      },
    }),
    []
  );

  // Glow ring around substations — makes them pop and look like connection nodes
  const substationsGlowLayer: LayerProps = useMemo(
    () => ({
      id: "substations-glow",
      type: "circle" as const,
      filter: ["==", ["geometry-type"], "Point"] as any,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 6,
          10, 14,
          15, 22,
        ] as any,
        "circle-color": "#f59e0b",
        "circle-opacity": 0.08,
        "circle-blur": 1,
      },
    }),
    []
  );

  const substationsPointLayer: LayerProps = useMemo(
    () => ({
      id: "substations-point",
      type: "circle" as const,
      filter: ["==", ["geometry-type"], "Point"] as any,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 3,
          10, 6,
          15, 10,
        ] as any,
        "circle-color": "#f59e0b",
        "circle-opacity": 0.9,
        "circle-stroke-color": "#fbbf24",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.6,
      },
    }),
    []
  );

  const substationsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "substations-label",
      type: "symbol" as const,
      minzoom: 10,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""] as any,
        "text-size": 11,
        "text-offset": [0, 1.5] as [number, number],
        "text-anchor": "top" as const,
        "text-max-width": 10,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#fbbf24",
        "text-halo-color": "rgba(0, 0, 0, 0.8)",
        "text-halo-width": 1.5,
        "text-opacity": 0.9,
      },
    }),
    []
  );

  const towersLayer: LayerProps = useMemo(
    () => ({
      id: "towers",
      type: "circle" as const,
      minzoom: 11,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          1.5,
          15,
          4,
          18,
          6,
        ] as any,
        "circle-color": "#94a3b8",
        "circle-opacity": 0.7,
        "circle-stroke-color": "#cbd5e1",
        "circle-stroke-width": 0.5,
        "circle-stroke-opacity": 0.4,
      },
    }),
    []
  );

  const plantsFillLayer: LayerProps = useMemo(
    () => ({
      id: "plants-fill",
      type: "fill" as const,
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": 0.15,
      },
    }),
    []
  );

  const plantsPointLayer: LayerProps = useMemo(
    () => ({
      id: "plants-point",
      type: "circle" as const,
      filter: ["==", ["geometry-type"], "Point"] as any,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          4,
          10,
          8,
          15,
          12,
        ] as any,
        "circle-color": "#22c55e",
        "circle-opacity": 0.8,
        "circle-stroke-color": "#4ade80",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.5,
      },
    }),
    []
  );

  const plantsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "plants-label",
      type: "symbol" as const,
      minzoom: 9,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""] as any,
        "text-size": 11,
        "text-offset": [0, 1.5] as [number, number],
        "text-anchor": "top" as const,
        "text-max-width": 10,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#4ade80",
        "text-halo-color": "rgba(0, 0, 0, 0.8)",
        "text-halo-width": 1.5,
        "text-opacity": 0.9,
      },
    }),
    []
  );

  const heatmapLayer: LayerProps = useMemo(
    () => ({
      id: "heatmap",
      type: "heatmap" as const,
      maxzoom: 12,
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.5,
          12,
          2,
        ] as any,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.1,
          "rgba(59, 130, 246, 0.3)",
          0.3,
          "rgba(34, 197, 94, 0.5)",
          0.5,
          "rgba(234, 179, 8, 0.6)",
          0.7,
          "rgba(249, 115, 22, 0.7)",
          1,
          "rgba(239, 68, 68, 0.8)",
        ] as any,
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          15,
          12,
          30,
        ] as any,
        "heatmap-opacity": 0.7,
      },
    }),
    []
  );

  // Microsoft satellite-detected solar parks
  const solarCircleLayer: LayerProps = useMemo(
    () => ({
      id: "solar-circle",
      type: "circle" as const,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 3, 8, 5, 12, 8, 16, 14,
        ] as any,
        "circle-color": "#fbbf24",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#f59e0b",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.7,
      },
    }),
    []
  );

  const solarLabelLayer: LayerProps = useMemo(
    () => ({
      id: "solar-label",
      type: "symbol" as const,
      minzoom: 11,
      layout: {
        "text-field": ["concat", ["to-string", ["round", ["get", "area_ha"]]], " ha"] as any,
        "text-size": 10,
        "text-offset": [0, 1.5] as [number, number],
        "text-anchor": "top" as const,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#fbbf24",
        "text-halo-color": "rgba(0,0,0,0.9)",
        "text-halo-width": 1.5,
      },
    }),
    []
  );

  // Microsoft satellite-detected wind turbines
  const windCircleLayer: LayerProps = useMemo(
    () => ({
      id: "wind-circle",
      type: "circle" as const,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 2.5, 8, 4, 12, 7, 16, 12,
        ] as any,
        "circle-color": "#22d3ee",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#06b6d4",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.7,
      },
    }),
    []
  );

  // Projects layer — color by status
  const projectsCircleLayer: LayerProps = useMemo(
    () => ({
      id: "projects-circle",
      type: "circle" as const,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          5, 3, 10, 6, 15, 10,
        ] as any,
        "circle-color": [
          "match", ["get", "status"],
          "operational", "#ffffff",
          "certificat", "#22c55e",
          "contract_activ", "#3b82f6",
          "contract_prelungit", "#6366f1",
          "ss_aprobat", "#8b5cf6",
          "ss_analiza", "#a855f7",
          "atr", "#eab308",
          "contract_reziliat", "#ef4444",
          "ss_expirat", "#71717a",
          "#f59e0b",
        ] as any,
        "circle-opacity": 0.9,
        "circle-stroke-color": [
          "match", ["get", "type"],
          "fotovoltaic", "#fbbf24",
          "eolian", "#38bdf8",
          "hidro", "#22d3ee",
          "biomasa", "#4ade80",
          "stocare", "#c084fc",
          "#94a3b8",
        ] as any,
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.8,
      },
    }),
    []
  );

  const projectsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "projects-label",
      type: "symbol" as const,
      minzoom: 10,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""] as any,
        "text-size": 10,
        "text-offset": [0, 1.8] as [number, number],
        "text-anchor": "top" as const,
        "text-max-width": 12,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#fde68a",
        "text-halo-color": "rgba(0, 0, 0, 0.9)",
        "text-halo-width": 1.5,
        "text-opacity": 0.85,
      },
    }),
    []
  );

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = [];
    if (layers.lines) ids.push("power-lines");
    if (layers.substations)
      ids.push("substations-fill", "substations-outline", "substations-point");
    if (layers.towers) ids.push("towers");
    if (layers.plants) ids.push("plants-fill", "plants-point");
    if (layers.projects) ids.push("projects-circle", "solar-circle", "wind-circle");
    return ids;
  }, [layers]);

  return (
    <div className="relative w-full h-full">
      <MapGL
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={MAP_STYLE}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        interactiveLayerIds={interactiveLayerIds}
        onMouseMove={(e) => setCursorPosition([e.lngLat.lng, e.lngLat.lat])}
        cursor="default"
        attributionControl={true}
        maxZoom={19}
        minZoom={4}
      >
        <NavigationControl position="bottom-right" showCompass visualizePitch />
        <ScaleControl position="bottom-left" maxWidth={200} unit="metric" />

        {/* Power Lines */}
        <Source id="lines" type="geojson" data={linesData}>
          {layers.lines && <Layer {...linesGlowLayer} />}
          {layers.lines && <Layer {...linesLayer} />}
        </Source>

        {/* Substations */}
        <Source id="substations" type="geojson" data={substationsData}>
          {layers.heatmap && <Layer {...heatmapLayer} />}
          {layers.substations && <Layer {...substationsGlowLayer} />}
          {layers.substations && <Layer {...substationsFillLayer} />}
          {layers.substations && <Layer {...substationsOutlineLayer} />}
          {layers.substations && <Layer {...substationsPointLayer} />}
          {layers.substations && <Layer {...substationsLabelLayer} />}
        </Source>

        {/* Towers */}
        <Source id="towers" type="geojson" data={towersData}>
          {layers.towers && <Layer {...towersLayer} />}
        </Source>

        {/* Power Plants (OSM) */}
        <Source id="plants" type="geojson" data={plantsData}>
          {layers.plants && <Layer {...plantsFillLayer} />}
          {layers.plants && <Layer {...plantsPointLayer} />}
          {layers.plants && <Layer {...plantsLabelLayer} />}
        </Source>

        {/* Energy Projects (ATR/SS/Contracte/PIF) */}
        <Source id="projects" type="geojson" data={projectsData}>
          {layers.projects && <Layer {...projectsCircleLayer} />}
          {layers.projects && <Layer {...projectsLabelLayer} />}
        </Source>

        {/* Microsoft satellite-detected solar parks */}
        <Source id="solar" type="geojson" data={solarData}>
          {layers.projects && <Layer {...solarCircleLayer} />}
          {layers.projects && <Layer {...solarLabelLayer} />}
        </Source>

        {/* Microsoft satellite-detected wind turbines */}
        <Source id="wind" type="geojson" data={windData}>
          {layers.projects && <Layer {...windCircleLayer} />}
        </Source>
      </MapGL>

      {/* Search Bar */}
      <SearchBar
        onSearch={handleSearch}
        onFlyTo={(lng, lat, zoom) => {
          mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1500 });
        }}
        linesData={linesData}
        substationsData={substationsData}
        plantsData={plantsData}
      />

      {/* Sidebar */}
      <Sidebar
        layers={layers}
        onToggleLayer={handleToggleLayer}
        stats={stats}
        voltageFilter={voltageFilter}
        onToggleVoltage={handleToggleVoltage}
        isLoading={isLoading}
      />

      {/* Info Panel */}
      <InfoPanel
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
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
