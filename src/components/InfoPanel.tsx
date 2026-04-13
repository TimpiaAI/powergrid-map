"use client";

import { X, MapPin, Zap, Building2, User, Activity, Hash } from "lucide-react";
import { SelectedFeature } from "@/lib/types";
import { getVoltageColor, rgbToHex, VOLTAGE_LABELS } from "@/lib/colors";

interface InfoPanelProps {
  feature: SelectedFeature | null;
  onClose: () => void;
}

const PROPERTY_ICONS: Record<string, React.ReactNode> = {
  name: <Building2 style={{ width: 14, height: 14 }} />,
  voltage: <Zap style={{ width: 14, height: 14 }} />,
  operator: <User style={{ width: 14, height: 14 }} />,
  type: <Hash style={{ width: 14, height: 14 }} />,
  power: <Activity style={{ width: 14, height: 14 }} />,
  ref: <Hash style={{ width: 14, height: 14 }} />,
};

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
};

const LAYER_TYPE_LABELS: Record<string, string> = {
  lines: "Linie electrica",
  substations: "Statie de transformare",
  towers: "Stalp",
  plants: "Centrala",
  heatmap: "Zona de interes",
};

function formatVoltage(voltage: string): string {
  const parts = voltage.split(/[;/,]/);
  return parts
    .map((p) => {
      const v = p.trim();
      const num = parseInt(v, 10);
      if (isNaN(num)) return v;
      // Convert volts to kV if > 1000
      const kv = num > 1000 ? Math.round(num / 1000) : num;
      return VOLTAGE_LABELS[String(kv)] || `${kv} kV`;
    })
    .join(" / ");
}

export default function InfoPanel({ feature, onClose }: InfoPanelProps) {
  if (!feature) return null;

  const { properties, layerType } = feature;
  const voltageColor = getVoltageColor(properties.voltage as string);

  const displayProperties = Object.entries(properties).filter(
    ([key, value]) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      key !== "id" &&
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
        width: 320,
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
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "16px",
            borderBottom: "1px solid #1e1e24",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: rgbToHex(voltageColor),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#71717a",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                }}
              >
                {LAYER_TYPE_LABELS[layerType] || layerType}
              </span>
            </div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#e4e4e7",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
              }}
            >
              {(properties.name as string) ||
                (properties.voltage
                  ? `${LAYER_TYPE_LABELS[layerType] || layerType} ${formatVoltage(String(properties.voltage))}`
                  : `${LAYER_TYPE_LABELS[layerType] || layerType} (fara nume)`)}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              marginLeft: 8,
              flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16, color: "#71717a" }} />
          </button>
        </div>

        {/* Voltage Banner */}
        {properties.voltage && (
          <div
            style={{
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: `rgba(${voltageColor[0]}, ${voltageColor[1]}, ${voltageColor[2]}, 0.1)`,
              borderBottom: `1px solid rgba(${voltageColor[0]}, ${voltageColor[1]}, ${voltageColor[2]}, 0.2)`,
            }}
          >
            <Zap style={{ width: 16, height: 16, color: rgbToHex(voltageColor) }} />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: rgbToHex(voltageColor),
              }}
            >
              {formatVoltage(properties.voltage as string)}
            </span>
          </div>
        )}

        {/* Properties */}
        <div style={{ flex: 1, overflowY: "auto" as const, padding: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
            {displayProperties.map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(39,39,42,0.3)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 110,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: "#71717a" }}>
                    {PROPERTY_ICONS[key] || <Hash style={{ width: 14, height: 14 }} />}
                  </span>
                  <span style={{ fontSize: 11, color: "#71717a" }}>
                    {PROPERTY_LABELS[key] || key}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#e4e4e7",
                    fontWeight: 500,
                    wordBreak: "break-word" as const,
                  }}
                >
                  {key === "voltage" ? formatVoltage(String(value)) : String(value)}
                </span>
              </div>
            ))}
          </div>

          {displayProperties.length === 0 && (
            <p style={{ fontSize: 12, color: "#71717a", textAlign: "center" as const, padding: "32px 0" }}>
              Nu sunt disponibile proprietati pentru acest element.
            </p>
          )}
        </div>

        {/* Coordinates */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1e1e24",
            background: "rgba(10, 10, 15, 0.5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#71717a" }}>
            <MapPin style={{ width: 12, height: 12 }} />
            <span style={{ fontFamily: "monospace" }}>
              {feature.lngLat[1].toFixed(5)}, {feature.lngLat[0].toFixed(5)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
