"use client";

import { useState } from "react";
import {
  Zap,
  Layers,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Activity,
  Cable,
  Building2,
  Columns2,
  Flame,
  Map,
  Sun,
  Wind,
  Filter,
  Database,
} from "lucide-react";
import {
  LayerVisibility,
  DataStats,
  VoltageFilter,
  LAYER_LABELS,
} from "@/lib/types";
import { getVoltageClasses, rgbToHex } from "@/lib/colors";
import Legend from "./Legend";
import CountrySelector from "./CountrySelector";

interface SidebarProps {
  layers: LayerVisibility;
  onToggleLayer: (layer: keyof LayerVisibility) => void;
  stats: DataStats;
  voltageFilter: VoltageFilter;
  onToggleVoltage: (voltage: string) => void;
  isLoading: boolean;
  selectedCountries?: string[];
  onToggleCountry?: (code: string) => void;
}

const LAYER_ICONS: Record<string, React.ReactNode> = {
  lines: <Cable className="w-4 h-4" />,
  substations: <Building2 className="w-4 h-4" />,
  towers: <Columns2 className="w-4 h-4" />,
  plants: <Flame className="w-4 h-4" />,
  projects: <Sun className="w-4 h-4" />,
  solarSatellite: <Sun className="w-4 h-4" />,
  windSatellite: <Wind className="w-4 h-4" />,
  heatmap: <Map className="w-4 h-4" />,
};

const PROJECT_TYPES = [
  { key: "fotovoltaic", label: "Fotovoltaic", color: "#fbbf24" },
  { key: "eolian", label: "Eolian", color: "#22d3ee" },
  { key: "hidro", label: "Hidro", color: "#3b82f6" },
  { key: "biomasa", label: "Biomasa", color: "#4ade80" },
  { key: "stocare", label: "Stocare", color: "#c084fc" },
  { key: "cogenerare", label: "Cogenerare", color: "#f97316" },
];

export default function Sidebar({
  layers,
  onToggleLayer,
  stats,
  voltageFilter,
  onToggleVoltage,
  isLoading,
  selectedCountries = ["RO"],
  onToggleCountry,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [projectTypeFilter, setProjectTypeFilter] = useState<Record<string, boolean>>(() => {
    const filter: Record<string, boolean> = {};
    PROJECT_TYPES.forEach((t) => { filter[t.key] = true; });
    return filter;
  });
  const voltageClasses = getVoltageClasses();

  if (collapsed) {
    return (
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 20 }}>
        <button
          onClick={() => setCollapsed(false)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            background: "rgba(19, 19, 24, 0.95)",
            border: "1px solid #27272a",
            borderRadius: 10,
            cursor: "pointer",
            backdropFilter: "blur(16px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
          title="Deschide panoul lateral"
        >
          <ChevronRight className="w-4 h-4" style={{ color: "#e4e4e7" }} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        bottom: 12,
        width: 288,
        zIndex: 20,
      }}
      className="animate-slide-in-left"
    >
      <div
        style={{
          height: "100%",
          background: "rgba(13, 13, 18, 0.96)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(39, 39, 42, 0.8)",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset",
          display: "flex",
          flexDirection: "column" as const,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid #1e1e24",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(59, 130, 246, 0.15)",
              }}
            >
              <Zap style={{ width: 17, height: 17, color: "#3b82f6" }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#e4e4e7",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                PowerGrid AI
              </h1>
              <p style={{ fontSize: 10, color: "#71717a", fontWeight: 500, marginTop: 1 }}>
                Vizualizare retea electrica
              </p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            style={{
              padding: 6,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            title="Minimizeaza"
          >
            <ChevronLeft style={{ width: 16, height: 16, color: "#71717a" }} />
          </button>
        </div>

        {/* Stats */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e24" }}>
          <h3
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#71717a",
              textTransform: "uppercase" as const,
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            Statistici
          </h3>
          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(10, 10, 15, 0.6)",
                    borderRadius: 8,
                    padding: 10,
                    border: "1px solid rgba(39,39,42,0.4)",
                    height: 52,
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatCard icon={<Cable style={{ width: 14, height: 14 }} />} label="Linii" value={stats.lines} />
              <StatCard icon={<Building2 style={{ width: 14, height: 14 }} />} label="Statii" value={stats.substations} />
              <StatCard icon={<Columns2 style={{ width: 14, height: 14 }} />} label="Stalpi" value={stats.towers} />
              <StatCard icon={<Flame style={{ width: 14, height: 14 }} />} label="Centrale" value={stats.plants} />
              <StatCard icon={<Sun style={{ width: 14, height: 14 }} />} label="Proiecte" value={stats.projects} />
              <StatCard icon={<Sun style={{ width: 14, height: 14, color: "#fbbf24" }} />} label="Solar (satelit)" value={stats.solarSatellite} />
              <StatCard icon={<Wind style={{ width: 14, height: 14, color: "#22d3ee" }} />} label="Eolian (satelit)" value={stats.windSatellite} />
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto" as const }}>
          {/* Country Selector */}
          {onToggleCountry && (
            <CountrySelector
              selectedCountries={selectedCountries}
              onToggleCountry={onToggleCountry}
              maxCountries={3}
            />
          )}

          {/* Layer Toggles */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e24" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Layers style={{ width: 14, height: 14, color: "#71717a" }} />
              <h3
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#71717a",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                }}
              >
                Straturi
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
              {(Object.keys(layers) as Array<keyof LayerVisibility>).map((layer) => (
                <button
                  key={layer}
                  onClick={() => onToggleLayer(layer)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left" as const,
                    transition: "all 0.15s",
                    background: layers[layer] ? "rgba(59, 130, 246, 0.1)" : "transparent",
                    color: layers[layer] ? "#e4e4e7" : "#71717a",
                  }}
                >
                  <span style={{ color: layers[layer] ? "#3b82f6" : "#3f3f46" }}>
                    {LAYER_ICONS[layer]}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>
                    {LAYER_LABELS[layer]}
                  </span>
                  {layers[layer] ? (
                    <Eye style={{ width: 14, height: 14, color: "#3b82f6" }} />
                  ) : (
                    <EyeOff style={{ width: 14, height: 14, color: "#3f3f46" }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Voltage Filter */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e24" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Activity style={{ width: 14, height: 14, color: "#71717a" }} />
              <h3
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#71717a",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                }}
              >
                Filtru tensiune
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
              {voltageClasses.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => onToggleVoltage(key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left" as const,
                    background: "transparent",
                    color: voltageFilter[key] ? "#e4e4e7" : "#3f3f46",
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      border: voltageFilter[key] ? "none" : "1px solid #3f3f46",
                      backgroundColor: voltageFilter[key] ? rgbToHex(color) : "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{label}</span>
                  <div
                    style={{
                      width: 24,
                      height: 2,
                      borderRadius: 4,
                      backgroundColor: rgbToHex(color),
                      opacity: voltageFilter[key] ? 1 : 0.3,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Project Type Filter */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e24" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Filter style={{ width: 14, height: 14, color: "#71717a" }} />
              <h3
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#71717a",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                }}
              >
                Filtru tip
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
              {PROJECT_TYPES.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() =>
                    setProjectTypeFilter((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left" as const,
                    background: "transparent",
                    color: projectTypeFilter[key] ? "#e4e4e7" : "#3f3f46",
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      border: projectTypeFilter[key] ? "none" : "1px solid #3f3f46",
                      backgroundColor: projectTypeFilter[key] ? color : "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e24" }}>
            <Legend />
          </div>

          {/* Data Sources */}
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Database style={{ width: 14, height: 14, color: "#71717a" }} />
              <h3
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#71717a",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                }}
              >
                Surse date
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              <DataSourceRow
                name="OSM"
                detail="linii, statii, stalpi, centrale"
                count={stats.lines + stats.substations + stats.towers + stats.plants}
              />
              <DataSourceRow
                name="Transelectrica"
                detail="ATR, contracte"
                count={stats.projects}
              />
              <DataSourceRow
                name="Microsoft GRW"
                detail="solar, eolian satelit"
                count={stats.solarSatellite + stats.windSatellite}
              />
              <DataSourceRow
                name="GridKit"
                detail="retea europeana"
                count={0}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid #1e1e24",
          }}
        >
          <p style={{ fontSize: 10, color: "#3f3f46", textAlign: "center" as const }}>
            Date: OSM &middot; Transelectrica &middot; Microsoft GRW &middot; Esri
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "rgba(10, 10, 15, 0.6)",
        borderRadius: 8,
        padding: 10,
        border: "1px solid rgba(39,39,42,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ color: "#71717a" }}>{icon}</span>
        <span style={{ fontSize: 10, color: "#71717a", fontWeight: 500 }}>{label}</span>
      </div>
      <p
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#e4e4e7",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {value.toLocaleString("ro-RO")}
      </p>
    </div>
  );
}

function DataSourceRow({
  name,
  detail,
  count,
}: {
  name: string;
  detail: string;
  count: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column" as const }}>
        <span style={{ fontSize: 11, color: "#a1a1aa", fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 9, color: "#52525b" }}>{detail}</span>
      </div>
      <span
        style={{
          fontSize: 10,
          color: count > 0 ? "#4ade80" : "#52525b",
          fontFamily: "monospace",
          fontWeight: 500,
        }}
      >
        {count > 0 ? count.toLocaleString("ro-RO") : "-"}
      </span>
    </div>
  );
}
