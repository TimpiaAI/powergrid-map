/**
 * TypeScript type definitions for power infrastructure features
 */

export interface PowerFeatureProperties {
  id?: string | number;
  name?: string;
  voltage?: string;
  operator?: string;
  type?: string;
  power?: string;
  substation?: string;
  ref?: string;
  cables?: string;
  wires?: string;
  circuits?: string;
  frequency?: string;
  output?: string;
  source?: string;
  "plant:source"?: string;
  "generator:source"?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface PowerFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: PowerFeatureProperties;
}

export interface PowerFeatureCollection {
  type: "FeatureCollection";
  features: PowerFeature[];
}

export type LayerType =
  | "lines"
  | "substations"
  | "towers"
  | "plants"
  | "projects"
  | "solarSatellite"
  | "windSatellite"
  | "heatmap";

export interface LayerVisibility {
  lines: boolean;
  substations: boolean;
  towers: boolean;
  plants: boolean;
  projects: boolean;
  solarSatellite: boolean;
  windSatellite: boolean;
  heatmap: boolean;
}

export interface DataStats {
  lines: number;
  substations: number;
  towers: number;
  plants: number;
  projects: number;
  solarSatellite: number;
  windSatellite: number;
}

export interface SelectedFeature {
  properties: PowerFeatureProperties;
  layerType: LayerType;
  lngLat: [number, number];
}

export interface VoltageFilter {
  [voltage: string]: boolean;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: 24.9,
  latitude: 45.9,
  zoom: 7,
  pitch: 0,
  bearing: 0,
};

export const LAYER_LABELS: Record<LayerType, string> = {
  lines: "Linii electrice",
  substations: "Statii de transformare",
  towers: "Stalpi",
  plants: "Centrale (OSM)",
  projects: "Proiecte energie",
  solarSatellite: "Parcuri solare (satelit)",
  windSatellite: "Turbine eoliene (satelit)",
  heatmap: "Harta termica",
};
