/**
 * Voltage color scheme based on OpenInfraMap conventions
 * Used to visually distinguish power lines by voltage class
 */

export const VOLTAGE_COLORS: Record<string, [number, number, number]> = {
  unknown: [122, 122, 133],
  "10": [110, 151, 184],
  "20": [110, 151, 184],
  "110": [85, 181, 85],
  "220": [199, 48, 48],
  "400": [181, 78, 178],
  "750": [0, 193, 207],
};

export const VOLTAGE_LABELS: Record<string, string> = {
  unknown: "Necunoscut",
  "10": "10 kV",
  "20": "20 kV",
  "110": "110 kV",
  "220": "220 kV",
  "400": "400 kV",
  "750": "750 kV",
};

/**
 * Normalize a voltage string to kV.
 * OSM stores voltage in volts (110000) — we need kV (110).
 */
function normalizeToKv(voltageStr: string): number {
  const v = parseInt(voltageStr.trim(), 10);
  if (isNaN(v)) return 0;
  // If > 1000, it's in volts → convert to kV
  if (v > 1000) return Math.round(v / 1000);
  return v;
}

/**
 * Get the display color for a given voltage string.
 * Handles compound voltages like "220000;110000" or "220;110"
 * Handles both volts (110000) and kV (110) formats.
 */
export function getVoltageColor(
  voltage: string | null | undefined
): [number, number, number] {
  if (!voltage) return VOLTAGE_COLORS.unknown;

  const cleanVoltage = voltage.replace(/\s/g, "");

  // Handle compound voltages like "220000;110000" or "220/110"
  const parts = cleanVoltage.split(/[;/,]/);
  const kvValues = parts.map(normalizeToKv).filter((n) => n > 0);

  if (kvValues.length === 0) return VOLTAGE_COLORS.unknown;

  const maxKv = Math.max(...kvValues);
  const key = String(maxKv);

  if (VOLTAGE_COLORS[key]) return VOLTAGE_COLORS[key];

  // Find the closest voltage class
  const voltageClasses = [10, 20, 110, 220, 400, 750];
  const closest = voltageClasses.reduce((prev, curr) =>
    Math.abs(curr - maxKv) < Math.abs(prev - maxKv) ? curr : prev
  );
  return VOLTAGE_COLORS[String(closest)] || VOLTAGE_COLORS.unknown;
}

/**
 * Get line width based on voltage class.
 * Higher voltage = thicker line.
 */
export function getVoltageWidth(voltage: string | null | undefined): number {
  if (!voltage) return 1;

  const parts = voltage.replace(/\s/g, "").split(/[;/,]/);
  const kvValues = parts.map(normalizeToKv).filter((n) => n > 0);
  const maxKv = kvValues.length > 0 ? Math.max(...kvValues) : 0;

  if (maxKv >= 750) return 4;
  if (maxKv >= 400) return 3.5;
  if (maxKv >= 220) return 3;
  if (maxKv >= 110) return 2.5;
  if (maxKv >= 20) return 1.5;
  return 1;
}

/**
 * Convert RGB tuple to hex string for MapLibre style expressions
 */
export function rgbToHex(color: [number, number, number]): string {
  return (
    "#" +
    color
      .map((c) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

/**
 * Get all voltage classes as an array for filter UI
 */
export function getVoltageClasses(): {
  key: string;
  label: string;
  color: [number, number, number];
}[] {
  return Object.entries(VOLTAGE_COLORS)
    .filter(([key]) => key !== "unknown")
    .map(([key, color]) => ({
      key,
      label: VOLTAGE_LABELS[key] || `${key} kV`,
      color,
    }));
}
