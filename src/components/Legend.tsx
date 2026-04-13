"use client";

import { VOLTAGE_COLORS, VOLTAGE_LABELS, rgbToHex } from "@/lib/colors";

interface LegendProps {
  className?: string;
}

export default function Legend({ className = "" }: LegendProps) {
  const entries = Object.entries(VOLTAGE_COLORS).filter(
    ([key]) => key !== "unknown"
  );

  return (
    <div className={className}>
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
        Legenda tensiune
      </h4>
      <div className="space-y-2">
        {entries.map(([voltage, color]) => {
          const widthScale =
            voltage === "750"
              ? 4
              : voltage === "400"
                ? 3.5
                : voltage === "220"
                  ? 3
                  : voltage === "110"
                    ? 2.5
                    : 1.5;

          return (
            <div key={voltage} className="flex items-center gap-3">
              <div className="w-8 flex items-center justify-center">
                <div
                  className="rounded-full"
                  style={{
                    backgroundColor: rgbToHex(color),
                    height: `${widthScale}px`,
                    width: "100%",
                  }}
                />
              </div>
              <span className="text-xs text-zinc-400">
                {VOLTAGE_LABELS[voltage] || `${voltage} kV`}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-3">
          <div className="w-8 flex items-center justify-center">
            <div
              className="rounded-full"
              style={{
                backgroundColor: rgbToHex(VOLTAGE_COLORS.unknown),
                height: "1px",
                width: "100%",
              }}
            />
          </div>
          <span className="text-xs text-zinc-400">Necunoscut</span>
        </div>
      </div>
    </div>
  );
}
