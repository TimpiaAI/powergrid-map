"use client";

import { useState, useEffect } from "react";
import { X, MapPin, Zap, Building2, User, Activity, Hash, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { SelectedFeature } from "@/lib/types";
import { getVoltageColor, rgbToHex, VOLTAGE_LABELS } from "@/lib/colors";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface InfoPanelProps {
  feature: SelectedFeature | null;
  onClose: () => void;
  onFlyTo?: (lng: number, lat: number, zoom?: number) => void;
}

interface AtrRecord {
  name: string;
  investor: string;
  power_mw: number;
  type: string;
  status: string;
  atr_number: string;
  county: string;
  voltage_kv: string;
}

interface StationSummary {
  count: number;
  total_mw: number;
  types: Record<string, number>;
  statuses: Record<string, number>;
}

const PROPERTY_LABELS: Record<string, string> = {
  name: "Denumire",
  voltage: "Tensiune",
  operator: "Operator",
  type: "Tip",
  power: "Tip infrastructura",
  substation: "Statie",
  ref: "Referinta",
  cables: "Cabluri",
  wires: "Conductoare",
  circuits: "Circuite",
  frequency: "Frecventa",
  output: "Putere",
  source: "Sursa",
  "plant:source": "Sursa centrala",
  "generator:source": "Sursa generator",
  COUNTRY: "Tara",
  construction_year: "An constructie",
  area_ha: "Suprafata (ha)",
  capacity_mw: "Capacitate (MW)",
  fuel: "Combustibil",
  fuel_original: "Tip (original)",
  owner: "Proprietar",
  commissioning_year: "An punere in functiune",
  country: "Tara",
  power_mw: "Putere (MW)",
  investor: "Investitor",
  station: "Statie racordare",
  atr_number: "Nr. ATR",
  status: "Status",
  county: "Judet",
};

const LAYER_TYPE_LABELS: Record<string, string> = {
  lines: "Linie electrica",
  substations: "Statie de transformare",
  towers: "Stalp",
  plants: "Centrala",
  projects: "Proiect energie",
  solarSatellite: "Parc solar (detectat satelit)",
  windSatellite: "Turbina eoliana (detectata satelit)",
  heatmap: "Zona de interes",
};

const STATUS_LABELS: Record<string, string> = {
  atr: "ATR (in avizare)",
  operational: "Operational (PIF)",
  contract_activ: "Contract activ",
  ss_aprobat: "Studiu aprobat",
};

const TYPE_COLORS: Record<string, string> = {
  fotovoltaic: "#fbbf24",
  eolian: "#22d3ee",
  hidro: "#3b82f6",
  biomasa: "#4ade80",
  stocare: "#c084fc",
  cogenerare: "#f97316",
};

function formatVoltage(voltage: string): string {
  const parts = voltage.split(/[;/,]/);
  return parts
    .map((p) => {
      const v = p.trim();
      const num = parseInt(v, 10);
      if (isNaN(num)) return v;
      const kv = num > 1000 ? Math.round(num / 1000) : num;
      return VOLTAGE_LABELS[String(kv)] || `${kv} kV`;
    })
    .join(" / ");
}

export default function InfoPanel({ feature, onClose, onFlyTo }: InfoPanelProps) {
  const [stationData, setStationData] = useState<Record<string, AtrRecord[]> | null>(null);
  const [stationSummary, setStationSummary] = useState<Record<string, StationSummary> | null>(null);
  const [expandedStation, setExpandedStation] = useState<string | null>(null);

  // Load ATR lookup data once
  useEffect(() => {
    Promise.all([
      fetch("/data/atr_lookup.json").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/data/station_summary.json").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([atr, summary]) => {
      setStationData(atr);
      setStationSummary(summary);
    });
  }, []);

  if (!feature) return null;

  const { properties, layerType } = feature;
  const voltageColor = getVoltageColor(properties.voltage as string);
  const isSatellite = layerType === "solarSatellite" || layerType === "windSatellite";
  const isSubstation = layerType === "substations";

  // Find matching station name in ATR data
  const stationName = properties.name as string || "";
  const matchedStationKeys = stationData ? Object.keys(stationData).filter(key => {
    const normKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normName = stationName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return normName && normKey && (normKey.includes(normName) || normName.includes(normKey));
  }) : [];

  const enrichedProperties = { ...properties };
  if (isSatellite && !enrichedProperties.source) {
    enrichedProperties.source = "Microsoft Global Renewables Watch";
  }

  const displayProperties = Object.entries(enrichedProperties).filter(
    ([key, value]) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      key !== "id" &&
      key !== "matched" &&
      key !== "atr_link" &&
      key !== "layer" &&
      !key.startsWith("@") &&
      !key.startsWith("_")
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        bottom: 12,
        width: 340,
        zIndex: 20,
      }}
      className="animate-slide-in-right"
    >
      <div
        style={{
          height: "100%",
          background: "rgba(13, 13, 18, 0.96)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(39, 39, 42, 0.8)",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column" as const,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: 16, borderBottom: "1px solid #1e1e24" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: rgbToHex(voltageColor), flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: "#71717a", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                {LAYER_TYPE_LABELS[layerType] || layerType}
              </span>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {stationName ||
                (properties.voltage
                  ? `${LAYER_TYPE_LABELS[layerType] || layerType} ${formatVoltage(String(properties.voltage))}`
                  : `${LAYER_TYPE_LABELS[layerType] || layerType} (fara nume)`)}
            </h3>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", marginLeft: 8, flexShrink: 0 }}>
            <X style={{ width: 16, height: 16, color: "#71717a" }} />
          </button>
        </div>

        {/* Voltage Banner */}
        {properties.voltage && (
          <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, backgroundColor: `rgba(${voltageColor[0]}, ${voltageColor[1]}, ${voltageColor[2]}, 0.1)`, borderBottom: `1px solid rgba(${voltageColor[0]}, ${voltageColor[1]}, ${voltageColor[2]}, 0.2)` }}>
            <Zap style={{ width: 16, height: 16, color: rgbToHex(voltageColor) }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: rgbToHex(voltageColor) }}>
              {formatVoltage(properties.voltage as string)}
            </span>
          </div>
        )}

        {/* Properties */}
        <div style={{ flex: 1, overflowY: "auto" as const, padding: 16 }}>
          {/* Feature properties */}
          <div style={{ display: "flex", flexDirection: "column" as const }}>
            {displayProperties.map(([key, value]) => (
              <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "6px 0", borderBottom: "1px solid rgba(39,39,42,0.3)" }}>
                <span style={{ fontSize: 11, color: "#71717a", minWidth: 100, flexShrink: 0 }}>
                  {PROPERTY_LABELS[key] || key}
                </span>
                <span style={{ fontSize: 11, color: "#e4e4e7", fontWeight: 500, wordBreak: "break-word" as const }}>
                  {key === "voltage" ? formatVoltage(String(value)) : String(value)}
                </span>
              </div>
            ))}
          </div>

          {/* ATR/Projects linked to this substation */}
          {isSubstation && matchedStationKeys.length > 0 && stationData && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#71717a", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
                Proiecte racordate
              </div>
              {matchedStationKeys.map(stKey => {
                const summary = stationSummary?.[stKey];
                const records = stationData[stKey] || [];
                const isExpanded = expandedStation === stKey;

                return (
                  <div key={stKey} style={{ marginBottom: 8, background: "rgba(10,10,15,0.6)", borderRadius: 8, border: "1px solid rgba(39,39,42,0.4)", overflow: "hidden" }}>
                    <button
                      onClick={() => setExpandedStation(isExpanded ? null : stKey)}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const, color: "#e4e4e7" }}
                    >
                      <Building2 style={{ width: 14, height: 14, color: "#f59e0b", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{stKey}</div>
                        <div style={{ fontSize: 10, color: "#71717a" }}>
                          {summary?.count || records.length} proiecte · {(summary?.total_mw || 0).toFixed(1)} MW
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp style={{ width: 14, height: 14, color: "#71717a" }} /> : <ChevronDown style={{ width: 14, height: 14, color: "#71717a" }} />}
                    </button>

                    {isExpanded && (
                      <div style={{ borderTop: "1px solid rgba(39,39,42,0.3)", maxHeight: 200, overflowY: "auto" as const }}>
                        {records.slice(0, 20).map((rec: AtrRecord, i: number) => (
                          <div key={i} style={{ padding: "6px 12px", borderBottom: "1px solid rgba(39,39,42,0.2)", fontSize: 11 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TYPE_COLORS[rec.type] || "#71717a", flexShrink: 0 }} />
                              <span style={{ color: "#e4e4e7", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                                {rec.name || rec.investor || "Fara nume"}
                              </span>
                              <span style={{ color: "#71717a", fontSize: 10, flexShrink: 0 }}>
                                {rec.power_mw > 0 ? `${rec.power_mw} MW` : ""}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 2, marginLeft: 12 }}>
                              <span style={{ color: "#71717a", fontSize: 10 }}>{rec.type}</span>
                              <span style={{ color: rec.status === "operational" ? "#22c55e" : "#eab308", fontSize: 10 }}>
                                {STATUS_LABELS[rec.status] || rec.status}
                              </span>
                            </div>
                          </div>
                        ))}
                        {records.length > 20 && (
                          <div style={{ padding: "6px 12px", fontSize: 10, color: "#71717a", textAlign: "center" as const }}>
                            +{records.length - 20} proiecte
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Satellite source note */}
          {isSatellite && (
            <div style={{ marginTop: 16, padding: "10px 12px", background: "rgba(59, 130, 246, 0.08)", borderRadius: 8, border: "1px solid rgba(59, 130, 246, 0.15)" }}>
              <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600, marginBottom: 4 }}>DETECTAT DIN SATELIT</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Locatie detectata automat din imagini satelitare de Microsoft Global Renewables Watch.
              </div>
            </div>
          )}
        </div>

        {/* Coordinates + fly-to */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #1e1e24", background: "rgba(10, 10, 15, 0.5)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#71717a" }}>
            <MapPin style={{ width: 12, height: 12 }} />
            <span style={{ fontFamily: "monospace" }}>
              {feature.lngLat[1].toFixed(5)}, {feature.lngLat[0].toFixed(5)}
            </span>
          </div>
          {onFlyTo && (
            <button
              onClick={() => onFlyTo(feature.lngLat[0], feature.lngLat[1], 15)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", cursor: "pointer", fontSize: 10, color: "#3b82f6", fontWeight: 500 }}
            >
              <ExternalLink style={{ width: 10, height: 10 }} />
              Zoom
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
