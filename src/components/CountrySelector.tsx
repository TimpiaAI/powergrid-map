"use client";

import { useState } from "react";
import { Globe, ChevronDown, ChevronUp } from "lucide-react";

// Country code → flag emoji
function countryFlag(code: string): string {
  if (code === "XK") return "\u{1F1FD}\u{1F1F0}"; // Kosovo unofficial
  const base = 0x1f1e6;
  const c0 = code.charCodeAt(0) - 65;
  const c1 = code.charCodeAt(1) - 65;
  return String.fromCodePoint(base + c0, base + c1);
}

export const COUNTRIES = [
  { code: "AL", name: "Albania" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgia" },
  { code: "BA", name: "Bosnia" },
  { code: "BG", name: "Bulgaria" },
  { code: "CZ", name: "Cehia" },
  { code: "HR", name: "Croatia" },
  { code: "DK", name: "Danemarca" },
  { code: "CH", name: "Elvetia" },
  { code: "FI", name: "Finlanda" },
  { code: "FR", name: "Franta" },
  { code: "DE", name: "Germania" },
  { code: "GR", name: "Grecia" },
  { code: "IE", name: "Irlanda" },
  { code: "IT", name: "Italia" },
  { code: "XK", name: "Kosovo" },
  { code: "LV", name: "Letonia" },
  { code: "LT", name: "Lituania" },
  { code: "LU", name: "Luxemburg" },
  { code: "MK", name: "Macedonia de Nord" },
  { code: "MD", name: "Moldova" },
  { code: "ME", name: "Muntenegru" },
  { code: "NO", name: "Norvegia" },
  { code: "NL", name: "Olanda" },
  { code: "PL", name: "Polonia" },
  { code: "PT", name: "Portugalia" },
  { code: "GB", name: "Regatul Unit" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "SK", name: "Slovacia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spania" },
  { code: "SE", name: "Suedia" },
  { code: "TR", name: "Turcia" },
  { code: "UA", name: "Ucraina" },
  { code: "HU", name: "Ungaria" },
];

// Approximate bounding boxes: [minLng, minLat, maxLng, maxLat]
export const COUNTRY_BOUNDS: Record<string, [number, number, number, number]> = {
  AL: [19.3, 39.6, 21.1, 42.7],
  AT: [9.5, 46.4, 17.2, 49.0],
  BE: [2.5, 49.5, 6.4, 51.5],
  BA: [15.7, 42.6, 19.6, 45.3],
  BG: [22.4, 41.2, 28.6, 44.2],
  CZ: [12.1, 48.6, 18.9, 51.1],
  HR: [13.5, 42.4, 19.4, 46.6],
  DK: [8.1, 54.6, 15.2, 57.8],
  CH: [5.9, 45.8, 10.5, 47.8],
  FI: [20.6, 59.8, 31.6, 70.1],
  FR: [-5.1, 42.3, 8.2, 51.1],
  DE: [5.9, 47.3, 15.0, 55.1],
  GR: [19.4, 34.8, 29.6, 41.7],
  IE: [-10.5, 51.4, -6.0, 55.4],
  IT: [6.6, 36.6, 18.5, 47.1],
  XK: [20.0, 41.8, 21.8, 43.3],
  LV: [21.0, 55.7, 28.2, 58.1],
  LT: [21.0, 53.9, 26.8, 56.5],
  LU: [5.7, 49.4, 6.5, 50.2],
  MK: [20.5, 40.9, 23.0, 42.4],
  MD: [26.6, 45.5, 30.2, 48.5],
  ME: [18.5, 41.9, 20.4, 43.6],
  NO: [4.6, 58.0, 31.1, 71.2],
  NL: [3.4, 50.8, 7.2, 53.5],
  PL: [14.1, 49.0, 24.2, 54.9],
  PT: [-9.5, 37.0, -6.2, 42.2],
  GB: [-8.2, 49.9, 1.8, 60.9],
  RO: [20.2, 43.6, 29.7, 48.3],
  RS: [18.8, 42.2, 23.0, 46.2],
  SK: [16.8, 47.7, 22.6, 49.6],
  SI: [13.4, 45.4, 16.6, 46.9],
  ES: [-9.3, 36.0, 3.3, 43.8],
  SE: [11.1, 55.3, 24.2, 69.1],
  TR: [26.0, 36.0, 44.8, 42.1],
  UA: [22.1, 44.4, 40.2, 52.4],
  HU: [16.1, 45.7, 22.9, 48.6],
};

interface CountrySelectorProps {
  selectedCountries: string[];
  onToggleCountry: (code: string) => void;
  maxCountries?: number;
}

export default function CountrySelector({
  selectedCountries,
  onToggleCountry,
  maxCountries = 3,
}: CountrySelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const atMax = selectedCountries.length >= maxCountries;

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e24" }}>
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: expanded ? 10 : 0,
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Globe style={{ width: 14, height: 14, color: "#71717a" }} />
        <h3
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#71717a",
            textTransform: "uppercase" as const,
            letterSpacing: "0.08em",
            margin: 0,
          }}
        >
          Tari vizibile
        </h3>
        <span
          style={{
            fontSize: 10,
            color: "#3b82f6",
            fontWeight: 600,
            marginLeft: "auto",
          }}
        >
          {selectedCountries.length}/{maxCountries} selectate
        </span>
        {expanded ? (
          <ChevronUp style={{ width: 14, height: 14, color: "#71717a" }} />
        ) : (
          <ChevronDown style={{ width: 14, height: 14, color: "#71717a" }} />
        )}
      </button>

      {expanded && (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              gap: 2,
              maxHeight: 260,
              overflowY: "auto" as const,
            }}
          >
            {COUNTRIES.map(({ code, name }) => {
              const isSelected = selectedCountries.includes(code);
              const isDisabled = !isSelected && atMax;

              return (
                <button
                  key={code}
                  onClick={() => {
                    if (!isDisabled) onToggleCountry(code);
                  }}
                  title={isDisabled ? `Max ${maxCountries} tari selectate` : name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    textAlign: "left" as const,
                    background: isSelected
                      ? "rgba(59, 130, 246, 0.1)"
                      : "transparent",
                    color: isSelected
                      ? "#e4e4e7"
                      : isDisabled
                      ? "#27272a"
                      : "#71717a",
                    opacity: isDisabled ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      border: isSelected
                        ? "none"
                        : `1px solid ${isDisabled ? "#27272a" : "#3f3f46"}`,
                      backgroundColor: isSelected
                        ? "#3b82f6"
                        : "transparent",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#fff",
                    }}
                  >
                    {isSelected && "✓"}
                  </div>

                  {/* Flag */}
                  <span style={{ fontSize: 14, lineHeight: 1 }}>
                    {countryFlag(code)}
                  </span>

                  {/* Name */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {name}
                  </span>
                </button>
              );
            })}
          </div>

          <p
            style={{
              fontSize: 9,
              color: "#3f3f46",
              marginTop: 8,
              textAlign: "center" as const,
            }}
          >
            Selecteaza max. {maxCountries} tari pentru performanta
          </p>
        </>
      )}
    </div>
  );
}
