"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, MapPin, Zap, Building2 } from "lucide-react";
import type { MapRef } from "react-map-gl/maplibre";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SearchResult {
  name: string;
  voltage?: string;
  type: string;
  coordinates: [number, number]; // [lng, lat]
  layerType: string;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  onFlyTo?: (lng: number, lat: number, zoom?: number) => void;
  mapRef?: React.RefObject<MapRef | null>;
}

function getFeatureCenter(feature: any): [number, number] | null {
  const geom = feature.geometry;
  if (!geom) return null;

  if (geom.type === "Point") {
    return geom.coordinates as [number, number];
  }

  if (geom.type === "LineString") {
    const coords = geom.coordinates;
    const mid = coords[Math.floor(coords.length / 2)];
    return mid ? [mid[0], mid[1]] : null;
  }

  if (geom.type === "Polygon") {
    const coords = geom.coordinates[0];
    if (!coords || coords.length === 0) return null;
    let sumLng = 0, sumLat = 0;
    for (const c of coords) {
      sumLng += c[0];
      sumLat += c[1];
    }
    return [sumLng / coords.length, sumLat / coords.length];
  }

  if (geom.type === "MultiPolygon") {
    const coords = geom.coordinates[0]?.[0];
    if (!coords || coords.length === 0) return null;
    let sumLng = 0, sumLat = 0;
    for (const c of coords) {
      sumLng += c[0];
      sumLat += c[1];
    }
    return [sumLng / coords.length, sumLat / coords.length];
  }

  return null;
}

/**
 * Search rendered features on the map via queryRenderedFeatures.
 * This works with vector tile sources (PMTiles).
 */
function searchRenderedFeatures(
  query: string,
  mapRef: React.RefObject<MapRef | null>
): SearchResult[] {
  const map = mapRef.current?.getMap();
  if (!map) return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Query all rendered features from the vector source
  const layerConfigs = [
    { layers: ["substations-point", "substations-fill", "ro-substations-point", "ro-substations-fill"], layerType: "substations", label: "Statie" },
    { layers: ["plants-point", "plants-fill", "plants-centroid", "ro-plants-point", "ro-plants-fill", "powerplants-circle"], layerType: "plants", label: "Centrala" },
    { layers: ["lines-hv", "lines-mv", "lines-lv", "ro-lines"], layerType: "lines", label: "Linie" },
  ];

  for (const { layers, layerType, label } of layerConfigs) {
    const existingLayers = layers.filter((l) => map.getLayer(l));
    if (existingLayers.length === 0) continue;

    const features = map.queryRenderedFeatures(undefined, { layers: existingLayers });

    for (const feature of features) {
      const props = feature.properties || {};
      const name = (props.name || props.n || "").toString().toLowerCase();
      const voltage = (props.voltage || props.v || "").toString().toLowerCase();
      const operator = (props.operator || "").toString().toLowerCase();
      const ref = (props.ref || "").toString().toLowerCase();

      if (
        name.includes(q) ||
        voltage.includes(q) ||
        operator.includes(q) ||
        ref.includes(q)
      ) {
        const displayName = props.name || props.n || `${label} ${props.voltage || props.v || ""}`.trim();
        const key = `${displayName}-${layerType}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const center = getFeatureCenter(feature);
        if (center) {
          results.push({
            name: displayName,
            voltage: props.voltage || props.v,
            type: label,
            coordinates: center,
            layerType,
          });
        }
      }
      if (results.length >= 20) break;
    }
    if (results.length >= 20) break;
  }

  return results;
}

export default function SearchBar({
  onSearch,
  onFlyTo,
  mapRef,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(value.trim());
        if (value.trim().length >= 2 && mapRef) {
          const found = searchRenderedFeatures(value.trim(), mapRef);
          setResults(found);
          setShowResults(found.length > 0);
        } else {
          setResults([]);
          setShowResults(false);
        }
      }, 300);
    },
    [onSearch, mapRef]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onSearch("");
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  }, [onSearch]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      setQuery(result.name);
      setShowResults(false);
      onSearch(result.name);
      if (onFlyTo) {
        onFlyTo(result.coordinates[0], result.coordinates[1], 14);
      }
    },
    [onSearch, onFlyTo]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        handleClear();
        inputRef.current?.blur();
        setShowResults(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClear]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getResultIcon = (type: string) => {
    switch (type) {
      case "Statie": return <Building2 style={{ width: 14, height: 14, color: "#f59e0b" }} />;
      case "Centrala": return <Zap style={{ width: 14, height: 14, color: "#22c55e" }} />;
      default: return <MapPin style={{ width: 14, height: 14, color: "#3b82f6" }} />;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        width: "100%",
        maxWidth: 440,
        padding: "0 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "rgba(13, 13, 18, 0.95)",
          backdropFilter: "blur(20px)",
          border: isFocused
            ? "1px solid rgba(59, 130, 246, 0.5)"
            : "1px solid rgba(39, 39, 42, 0.8)",
          borderRadius: showResults ? "10px 10px 0 0" : 10,
          boxShadow: isFocused
            ? "0 0 0 2px rgba(59, 130, 246, 0.15), 0 4px 24px rgba(0,0,0,0.5)"
            : "0 4px 24px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
        }}
      >
        <Search style={{ width: 16, height: 16, color: "#71717a", flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Cauta statie, linie, tensiune..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 13,
            color: "#e4e4e7",
            minWidth: 0,
            fontFamily: "inherit",
          }}
        />
        {query ? (
          <button
            onClick={handleClear}
            style={{
              padding: 2,
              borderRadius: 4,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <X style={{ width: 14, height: 14, color: "#71717a" }} />
          </button>
        ) : (
          <kbd
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: "2px 6px",
              fontSize: 10,
              color: "#71717a",
              background: "rgba(10, 10, 15, 0.8)",
              borderRadius: 4,
              border: "1px solid #27272a",
              fontFamily: "monospace",
            }}
          >
            <span style={{ fontSize: 9 }}>&#8984;</span>K
          </kbd>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div
          style={{
            background: "rgba(13, 13, 18, 0.97)",
            backdropFilter: "blur(20px)",
            borderLeft: "1px solid rgba(39, 39, 42, 0.8)",
            borderRight: "1px solid rgba(39, 39, 42, 0.8)",
            borderBottom: "1px solid rgba(39, 39, 42, 0.8)",
            borderRadius: "0 0 10px 10px",
            maxHeight: 320,
            overflowY: "auto" as const,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {results.map((result, i) => (
            <button
              key={`${result.name}-${result.coordinates[0]}-${i}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectResult(result);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                borderBottom: i < results.length - 1 ? "1px solid rgba(39,39,42,0.3)" : "none",
                cursor: "pointer",
                textAlign: "left" as const,
                color: "#e4e4e7",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(59, 130, 246, 0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {getResultIcon(result.type)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {result.name}
                </div>
                <div style={{ fontSize: 10, color: "#71717a", marginTop: 1 }}>
                  {result.type}
                  {result.voltage && ` · ${result.voltage} kV`}
                </div>
              </div>
              <MapPin style={{ width: 12, height: 12, color: "#3f3f46", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
