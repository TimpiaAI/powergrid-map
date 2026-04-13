"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Se incarca harta...
          </p>
          <p className="text-xs text-muted mt-1">
            PowerGrid AI - Vizualizare retea electrica
          </p>
        </div>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="w-full h-full">
      <MapView />
    </main>
  );
}
