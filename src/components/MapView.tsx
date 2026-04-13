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
import { Protocol } from "pmtiles";
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

// Hardcoded stats — PMTiles cannot be counted in the browser
const stats: DataStats = {
  lines: 394053,
  substations: 470305,
  towers: 111310,
  plants: 717720,
  projects: 0,
  solarSatellite: 30880,
  windSatellite: 99242,
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

  // Register PMTiles protocol on mount
  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => {
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);

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
      // 330kV
      ["any", ["in", "330", volts], ["in", "330000", volts]],
      rgbToHex(VOLTAGE_COLORS["330"]),
      // 220kV
      ["any", ["in", "220", volts], ["in", "220000", volts]],
      rgbToHex(VOLTAGE_COLORS["220"]),
      // 110kV
      ["any", ["in", "110", volts], ["in", "110000", volts]],
      rgbToHex(VOLTAGE_COLORS["110"]),
      // 35kV
      ["any", ["in", "35", volts], ["in", "35000", volts]],
      rgbToHex(VOLTAGE_COLORS["35"]),
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
      "lines-hv": "lines",
      "lines-hv-glow": "lines",
      "lines-mv": "lines",
      "lines-mv-glow": "lines",
      "lines-lv": "lines",
      "lines-lv-glow": "lines",
      "ro-lines": "lines",
      "ro-lines-glow": "lines",
      "substations-fill": "substations",
      "substations-outline": "substations",
      "substations-point": "substations",
      "substations-glow": "substations",
      "ro-substations-fill": "substations",
      "ro-substations-outline": "substations",
      "ro-substations-point": "substations",
      "ro-substations-glow": "substations",
      "ro-towers": "towers",
      "plants-fill": "plants",
      "plants-point": "plants",
      "plants-centroid": "plants",
      "plants-outline": "plants",
      "ro-plants-fill": "plants",
      "ro-plants-point": "plants",
      "ro-plants-centroid": "plants",
      "ro-plants-outline": "plants",
      "powerplants-circle": "plants",
      "solar-circle": "solarSatellite",
      "wind-circle": "windSatellite",
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

  // ─── Layer definitions ─────────────────────────────────────────────
  // Lines (HV) — glow
  const linesHvGlowLayer: LayerProps = useMemo(
    () => ({
      id: "lines-hv-glow",
      type: "line" as const,
      "source-layer": "lines_hv",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 6,
          12, 14,
        ] as any,
        "line-opacity": 0.15,
        "line-blur": 4,
      },
    }),
    [lineColorExpression, combinedFilter, layers.lines]
  );

  // Lines (HV)
  const linesHvLayer: LayerProps = useMemo(
    () => ({
      id: "lines-hv",
      type: "line" as const,
      "source-layer": "lines_hv",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": lineWidthExpression,
        "line-opacity": 0.9,
      },
    }),
    [lineColorExpression, lineWidthExpression, combinedFilter, layers.lines]
  );

  // Lines (MV) — glow
  const linesMvGlowLayer: LayerProps = useMemo(
    () => ({
      id: "lines-mv-glow",
      type: "line" as const,
      "source-layer": "lines_mv",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 6,
          12, 14,
        ] as any,
        "line-opacity": 0.15,
        "line-blur": 4,
      },
    }),
    [lineColorExpression, combinedFilter, layers.lines]
  );

  // Lines (MV)
  const linesMvLayer: LayerProps = useMemo(
    () => ({
      id: "lines-mv",
      type: "line" as const,
      "source-layer": "lines_mv",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": lineWidthExpression,
        "line-opacity": 0.9,
      },
    }),
    [lineColorExpression, lineWidthExpression, combinedFilter, layers.lines]
  );

  // Lines (LV) — glow
  const linesLvGlowLayer: LayerProps = useMemo(
    () => ({
      id: "lines-lv-glow",
      type: "line" as const,
      "source-layer": "lines_lv",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 6,
          12, 14,
        ] as any,
        "line-opacity": 0.15,
        "line-blur": 4,
      },
    }),
    [lineColorExpression, combinedFilter, layers.lines]
  );

  // Lines (LV)
  const linesLvLayer: LayerProps = useMemo(
    () => ({
      id: "lines-lv",
      type: "line" as const,
      "source-layer": "lines_lv",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": lineWidthExpression,
        "line-opacity": 0.9,
      },
    }),
    [lineColorExpression, lineWidthExpression, combinedFilter, layers.lines]
  );

  // Romania lines — glow
  const roLinesGlowLayer: LayerProps = useMemo(
    () => ({
      id: "ro-lines-glow",
      type: "line" as const,
      "source-layer": "ro_lines",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 6,
          12, 14,
        ] as any,
        "line-opacity": 0.15,
        "line-blur": 4,
      },
    }),
    [lineColorExpression, combinedFilter, layers.lines]
  );

  // Romania lines
  const roLinesLayer: LayerProps = useMemo(
    () => ({
      id: "ro-lines",
      type: "line" as const,
      "source-layer": "ro_lines",
      ...(combinedFilter ? { filter: combinedFilter as any } : {}),
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: layers.lines ? "visible" : "none",
      },
      paint: {
        "line-color": lineColorExpression,
        "line-width": lineWidthExpression,
        "line-opacity": 0.9,
      },
    }),
    [lineColorExpression, lineWidthExpression, combinedFilter, layers.lines]
  );

  // Substations (Europe) — fill
  const substationsFillLayer: LayerProps = useMemo(
    () => ({
      id: "substations-fill",
      type: "fill" as const,
      "source-layer": "substations",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
      paint: {
        "fill-color": "#f59e0b",
        "fill-opacity": 0.2,
      },
    }),
    [layers.substations]
  );

  const substationsOutlineLayer: LayerProps = useMemo(
    () => ({
      id: "substations-outline",
      type: "line" as const,
      "source-layer": "substations",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
      paint: {
        "line-color": "#fbbf24",
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 14, 2.5] as any,
        "line-opacity": 0.85,
      },
    }),
    [layers.substations]
  );

  const substationsGlowLayer: LayerProps = useMemo(
    () => ({
      id: "substations-glow",
      type: "circle" as const,
      "source-layer": "substations",
      filter: ["==", ["geometry-type"], "Point"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
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
    [layers.substations]
  );

  const substationsPointLayer: LayerProps = useMemo(
    () => ({
      id: "substations-point",
      type: "circle" as const,
      "source-layer": "substations",
      filter: ["==", ["geometry-type"], "Point"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
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
    [layers.substations]
  );

  const substationsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "substations-label",
      type: "symbol" as const,
      "source-layer": "substations",
      minzoom: 8,
      layout: {
        visibility: layers.substations ? "visible" : "none",
        "text-field": ["coalesce", ["get", "name"], ""] as any,
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          8, 8,
          11, 10,
          14, 12,
        ] as any,
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
    [layers.substations]
  );

  // Romania substations
  const roSubstationsFillLayer: LayerProps = useMemo(
    () => ({
      id: "ro-substations-fill",
      type: "fill" as const,
      "source-layer": "ro_substations",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
      paint: {
        "fill-color": "#f59e0b",
        "fill-opacity": 0.2,
      },
    }),
    [layers.substations]
  );

  const roSubstationsOutlineLayer: LayerProps = useMemo(
    () => ({
      id: "ro-substations-outline",
      type: "line" as const,
      "source-layer": "ro_substations",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
      paint: {
        "line-color": "#fbbf24",
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 14, 2.5] as any,
        "line-opacity": 0.85,
      },
    }),
    [layers.substations]
  );

  const roSubstationsGlowLayer: LayerProps = useMemo(
    () => ({
      id: "ro-substations-glow",
      type: "circle" as const,
      "source-layer": "ro_substations",
      filter: ["==", ["geometry-type"], "Point"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
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
    [layers.substations]
  );

  const roSubstationsPointLayer: LayerProps = useMemo(
    () => ({
      id: "ro-substations-point",
      type: "circle" as const,
      "source-layer": "ro_substations",
      filter: ["==", ["geometry-type"], "Point"] as any,
      layout: { visibility: layers.substations ? "visible" : "none" },
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
    [layers.substations]
  );

  const roSubstationsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "ro-substations-label",
      type: "symbol" as const,
      "source-layer": "ro_substations",
      minzoom: 8,
      layout: {
        visibility: layers.substations ? "visible" : "none",
        "text-field": ["coalesce", ["get", "name"], ""] as any,
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          8, 8,
          11, 10,
          14, 12,
        ] as any,
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
    [layers.substations]
  );

  // Romania towers
  const roTowersLayer: LayerProps = useMemo(
    () => ({
      id: "ro-towers",
      type: "circle" as const,
      "source-layer": "ro_towers",
      minzoom: 7,
      layout: { visibility: layers.towers ? "visible" : "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          7, 0.3,
          10, 1,
          13, 3,
          16, 5,
          18, 7,
        ] as any,
        "circle-color": "#94a3b8",
        "circle-opacity": [
          "interpolate", ["linear"], ["zoom"],
          7, 0.3,
          11, 0.6,
          14, 0.8,
        ] as any,
        "circle-stroke-color": "#cbd5e1",
        "circle-stroke-width": [
          "interpolate", ["linear"], ["zoom"],
          10, 0,
          14, 0.5,
          17, 1,
        ] as any,
        "circle-stroke-opacity": 0.4,
      },
    }),
    [layers.towers]
  );

  const roTowersLabelLayer: LayerProps = useMemo(
    () => ({
      id: "ro-towers-label",
      type: "symbol" as const,
      "source-layer": "ro_towers",
      minzoom: 14,
      layout: {
        visibility: layers.towers ? "visible" : "none",
        "text-field": ["coalesce", ["get", "ref"], ""] as any,
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          14, 8,
          17, 11,
        ] as any,
        "text-offset": [0, 1.2] as [number, number],
        "text-anchor": "top" as const,
        "text-max-width": 8,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#94a3b8",
        "text-halo-color": "rgba(0, 0, 0, 0.9)",
        "text-halo-width": 1,
        "text-opacity": 0.7,
      },
    }),
    [layers.towers]
  );

  // Plants (Europe OSM) — uses short property names: n=name, s=source, v=voltage
  const plantsFillLayer: LayerProps = useMemo(
    () => ({
      id: "plants-fill",
      type: "fill" as const,
      "source-layer": "plants",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": 0.25,
      },
    }),
    [layers.plants]
  );

  const plantsOutlineLayer: LayerProps = useMemo(
    () => ({
      id: "plants-outline",
      type: "line" as const,
      "source-layer": "plants",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "line-color": "#4ade80",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 2] as any,
        "line-opacity": 0.7,
      },
    }),
    [layers.plants]
  );

  const plantsCentroidLayer: LayerProps = useMemo(
    () => ({
      id: "plants-centroid",
      type: "circle" as const,
      "source-layer": "plants",
      maxzoom: 12,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 3,
          7, 5,
          10, 7,
          12, 9,
        ] as any,
        "circle-color": "#22c55e",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#4ade80",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.6,
      },
    }),
    [layers.plants]
  );

  const plantsPointLayer: LayerProps = useMemo(
    () => ({
      id: "plants-point",
      type: "circle" as const,
      "source-layer": "plants",
      filter: ["==", ["geometry-type"], "Point"] as any,
      minzoom: 12,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          12, 6,
          15, 10,
          18, 14,
        ] as any,
        "circle-color": "#22c55e",
        "circle-opacity": 0.8,
        "circle-stroke-color": "#4ade80",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.5,
      },
    }),
    [layers.plants]
  );

  // Plants label — uses short "n" for name in PMTiles
  const plantsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "plants-label",
      type: "symbol" as const,
      "source-layer": "plants",
      minzoom: 7,
      layout: {
        visibility: layers.plants ? "visible" : "none",
        "text-field": ["coalesce", ["get", "n"], ["get", "name"], ""] as any,
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          7, 8,
          10, 10,
          14, 12,
        ] as any,
        "text-offset": [0, 1.5] as [number, number],
        "text-anchor": "top" as const,
        "text-max-width": 10,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#4ade80",
        "text-halo-color": "rgba(0, 0, 0, 0.9)",
        "text-halo-width": 1.5,
        "text-opacity": [
          "interpolate", ["linear"], ["zoom"],
          7, 0.5,
          10, 0.8,
          14, 1,
        ] as any,
      },
    }),
    [layers.plants]
  );

  // Romania plants — uses full property names
  const roPlantsFilLayer: LayerProps = useMemo(
    () => ({
      id: "ro-plants-fill",
      type: "fill" as const,
      "source-layer": "ro_plants",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": 0.25,
      },
    }),
    [layers.plants]
  );

  const roPlantsOutlineLayer: LayerProps = useMemo(
    () => ({
      id: "ro-plants-outline",
      type: "line" as const,
      "source-layer": "ro_plants",
      filter: ["==", ["geometry-type"], "Polygon"] as any,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "line-color": "#4ade80",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 2] as any,
        "line-opacity": 0.7,
      },
    }),
    [layers.plants]
  );

  const roPlantsCentroidLayer: LayerProps = useMemo(
    () => ({
      id: "ro-plants-centroid",
      type: "circle" as const,
      "source-layer": "ro_plants",
      maxzoom: 12,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 3,
          7, 5,
          10, 7,
          12, 9,
        ] as any,
        "circle-color": "#22c55e",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#4ade80",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.6,
      },
    }),
    [layers.plants]
  );

  const roPlantsPointLayer: LayerProps = useMemo(
    () => ({
      id: "ro-plants-point",
      type: "circle" as const,
      "source-layer": "ro_plants",
      filter: ["==", ["geometry-type"], "Point"] as any,
      minzoom: 12,
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          12, 6,
          15, 10,
          18, 14,
        ] as any,
        "circle-color": "#22c55e",
        "circle-opacity": 0.8,
        "circle-stroke-color": "#4ade80",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.5,
      },
    }),
    [layers.plants]
  );

  const roPlantsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "ro-plants-label",
      type: "symbol" as const,
      "source-layer": "ro_plants",
      minzoom: 7,
      layout: {
        visibility: layers.plants ? "visible" : "none",
        "text-field": ["coalesce", ["get", "name"], ""] as any,
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          7, 8,
          10, 10,
          14, 12,
        ] as any,
        "text-offset": [0, 1.5] as [number, number],
        "text-anchor": "top" as const,
        "text-max-width": 10,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#4ade80",
        "text-halo-color": "rgba(0, 0, 0, 0.9)",
        "text-halo-width": 1.5,
        "text-opacity": [
          "interpolate", ["linear"], ["zoom"],
          7, 0.5,
          10, 0.8,
          14, 1,
        ] as any,
      },
    }),
    [layers.plants]
  );

  // Heatmap layer — on substations source-layer
  const heatmapLayer: LayerProps = useMemo(
    () => ({
      id: "heatmap",
      type: "heatmap" as const,
      "source-layer": "substations",
      maxzoom: 12,
      layout: { visibility: layers.heatmap ? "visible" : "none" },
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
    [layers.heatmap]
  );

  // Microsoft satellite-detected solar parks
  const solarCircleLayer: LayerProps = useMemo(
    () => ({
      id: "solar-circle",
      type: "circle" as const,
      "source-layer": "solar",
      layout: { visibility: layers.solarSatellite ? "visible" : "none" },
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
    [layers.solarSatellite]
  );

  const solarLabelLayer: LayerProps = useMemo(
    () => ({
      id: "solar-label",
      type: "symbol" as const,
      "source-layer": "solar",
      minzoom: 11,
      layout: {
        visibility: layers.solarSatellite ? "visible" : "none",
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
    [layers.solarSatellite]
  );

  // Microsoft satellite-detected wind turbines
  const windCircleLayer: LayerProps = useMemo(
    () => ({
      id: "wind-circle",
      type: "circle" as const,
      "source-layer": "wind",
      layout: { visibility: layers.windSatellite ? "visible" : "none" },
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
    [layers.windSatellite]
  );

  // WRI Power Plants — all types, color by fuel
  const powerplantsCircleLayer: LayerProps = useMemo(
    () => ({
      id: "powerplants-circle",
      type: "circle" as const,
      "source-layer": "powerplants",
      layout: { visibility: layers.plants ? "visible" : "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, ["interpolate", ["linear"], ["get", "capacity_mw"], 0, 2, 100, 4, 1000, 7, 5000, 12] as any,
          10, ["interpolate", ["linear"], ["get", "capacity_mw"], 0, 4, 100, 7, 1000, 12, 5000, 18] as any,
        ] as any,
        "circle-color": [
          "match", ["get", "fuel"],
          "solar", "#fbbf24",
          "eolian", "#22d3ee",
          "hidro", "#3b82f6",
          "nuclear", "#f43f5e",
          "carbune", "#78716c",
          "gaz", "#f97316",
          "petrol", "#a16207",
          "biomasa", "#4ade80",
          "deseuri", "#a3a3a3",
          "geotermal", "#e879f9",
          "cogenerare", "#fb923c",
          "stocare", "#c084fc",
          "#71717a",
        ] as any,
        "circle-opacity": 0.85,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": [
          "interpolate", ["linear"], ["get", "capacity_mw"],
          0, 0.5, 100, 1, 1000, 1.5,
        ] as any,
        "circle-stroke-opacity": 0.4,
      },
    }),
    [layers.plants]
  );

  const powerplantsLabelLayer: LayerProps = useMemo(
    () => ({
      id: "powerplants-label",
      type: "symbol" as const,
      "source-layer": "powerplants",
      minzoom: 8,
      filter: [">", ["get", "capacity_mw"], 50] as any,
      layout: {
        visibility: layers.plants ? "visible" : "none",
        "text-field": [
          "concat",
          ["get", "name"],
          "\n",
          ["to-string", ["round", ["get", "capacity_mw"]]],
          " MW",
        ] as any,
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          8, 9, 12, 11,
        ] as any,
        "text-offset": [0, 1.8] as [number, number],
        "text-anchor": "top" as const,
        "text-max-width": 12,
        "text-font": ["Open Sans Regular"],
      },
      paint: {
        "text-color": "#e4e4e7",
        "text-halo-color": "rgba(0, 0, 0, 0.9)",
        "text-halo-width": 1.5,
        "text-opacity": 0.85,
      },
    }),
    [layers.plants]
  );

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = [];
    if (layers.lines) ids.push("lines-hv", "lines-mv", "lines-lv", "ro-lines");
    if (layers.substations)
      ids.push(
        "substations-fill", "substations-outline", "substations-point",
        "ro-substations-fill", "ro-substations-outline", "ro-substations-point"
      );
    if (layers.towers) ids.push("ro-towers");
    if (layers.plants)
      ids.push(
        "plants-fill", "plants-point", "plants-centroid",
        "ro-plants-fill", "ro-plants-point", "ro-plants-centroid",
        "powerplants-circle"
      );
    if (layers.solarSatellite) ids.push("solar-circle");
    if (layers.windSatellite) ids.push("wind-circle");
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
        onLoad={() => setIsLoading(false)}
        cursor="default"
        attributionControl={true}
        maxZoom={19}
        minZoom={4}
      >
        <NavigationControl position="bottom-right" showCompass visualizePitch />
        <ScaleControl position="bottom-left" maxWidth={200} unit="metric" />

        {/* Single PMTiles vector source for all layers */}
        <Source
          id="powergrid"
          type="vector"
          url="pmtiles:///data/powergrid.pmtiles"
        >
          {/* Lines (HV) */}
          <Layer {...linesHvGlowLayer} />
          <Layer {...linesHvLayer} />

          {/* Lines (MV) */}
          <Layer {...linesMvGlowLayer} />
          <Layer {...linesMvLayer} />

          {/* Lines (LV) */}
          <Layer {...linesLvGlowLayer} />
          <Layer {...linesLvLayer} />

          {/* Romania Lines */}
          <Layer {...roLinesGlowLayer} />
          <Layer {...roLinesLayer} />

          {/* Heatmap */}
          <Layer {...heatmapLayer} />

          {/* Substations (Europe) */}
          <Layer {...substationsGlowLayer} />
          <Layer {...substationsFillLayer} />
          <Layer {...substationsOutlineLayer} />
          <Layer {...substationsPointLayer} />
          <Layer {...substationsLabelLayer} />

          {/* Romania Substations */}
          <Layer {...roSubstationsGlowLayer} />
          <Layer {...roSubstationsFillLayer} />
          <Layer {...roSubstationsOutlineLayer} />
          <Layer {...roSubstationsPointLayer} />
          <Layer {...roSubstationsLabelLayer} />

          {/* Romania Towers */}
          <Layer {...roTowersLayer} />
          <Layer {...roTowersLabelLayer} />

          {/* Plants (Europe OSM) */}
          <Layer {...plantsCentroidLayer} />
          <Layer {...plantsFillLayer} />
          <Layer {...plantsOutlineLayer} />
          <Layer {...plantsPointLayer} />
          <Layer {...plantsLabelLayer} />

          {/* Romania Plants */}
          <Layer {...roPlantsCentroidLayer} />
          <Layer {...roPlantsFilLayer} />
          <Layer {...roPlantsOutlineLayer} />
          <Layer {...roPlantsPointLayer} />
          <Layer {...roPlantsLabelLayer} />

          {/* Microsoft satellite-detected solar parks */}
          <Layer {...solarCircleLayer} />
          <Layer {...solarLabelLayer} />

          {/* Microsoft satellite-detected wind turbines */}
          <Layer {...windCircleLayer} />

          {/* WRI Power Plants */}
          <Layer {...powerplantsCircleLayer} />
          <Layer {...powerplantsLabelLayer} />
        </Source>
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
