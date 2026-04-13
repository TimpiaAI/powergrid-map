from langchain_core.tools import tool
import json
import os

# Resolve data directory relative to this file
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")


def load_data():
    """Load grid data summaries at startup."""
    # Load station summary
    with open(os.path.join(DATA_DIR, "station_summary.json")) as f:
        station_summary = json.load(f)

    # Load basic stats from GeoJSON files
    stats = {}
    for name in [
        "romania_lines",
        "romania_substations",
        "romania_towers",
        "romania_plants",
    ]:
        try:
            with open(os.path.join(DATA_DIR, f"{name}.geojson")) as f:
                data = json.load(f)
                stats[name] = len(data["features"])
        except Exception:
            stats[name] = 0

    return station_summary, stats


STATION_SUMMARY, GRID_STATS = load_data()


@tool
def search_station(query: str) -> str:
    """Search for a substation/station by name. Returns matching stations with their connected projects count and total MW."""
    results = []
    q = query.upper()
    for station, data in STATION_SUMMARY.items():
        if q in station.upper():
            results.append(
                f"Statie: {station} - {data['count']} proiecte, "
                f"{data['total_mw']} MW total, tipuri: {data['types']}"
            )
    if not results:
        return (
            f"Nu am gasit statii cu numele '{query}'. "
            f"Statii disponibile: {', '.join(list(STATION_SUMMARY.keys())[:10])}"
        )
    return "\n".join(results[:10])


@tool
def get_grid_stats() -> str:
    """Get overall statistics about the power grid data loaded in the system."""
    return f"""Statistici retea electrica Romania:
- Linii electrice: {GRID_STATS.get('romania_lines', 0)}
- Statii de transformare: {GRID_STATS.get('romania_substations', 0)}
- Stalpi: {GRID_STATS.get('romania_towers', 0)}
- Centrale (OSM): {GRID_STATS.get('romania_plants', 0)}
- Statii cu proiecte ATR: {len(STATION_SUMMARY)}
- Total proiecte energie: {sum(d['count'] for d in STATION_SUMMARY.values())}
- Total capacitate proiecte: {sum(d['total_mw'] for d in STATION_SUMMARY.values()):.1f} MW"""


@tool
def list_stations_by_capacity(min_mw: float = 0) -> str:
    """List all stations sorted by total connected MW capacity. Use min_mw to filter."""
    stations = [
        (name, data)
        for name, data in STATION_SUMMARY.items()
        if data["total_mw"] >= min_mw
    ]
    stations.sort(key=lambda x: -x[1]["total_mw"])
    lines = []
    for name, data in stations[:20]:
        lines.append(
            f"{name}: {data['total_mw']:.1f} MW ({data['count']} proiecte) - {data['types']}"
        )
    return "\n".join(lines) if lines else "Nu am gasit statii cu capacitatea ceruta."


@tool
def get_station_projects(station_name: str) -> str:
    """Get detailed list of projects connected to a specific station."""
    # Try exact match first, then partial
    projects = None
    matched_name = station_name
    for key in STATION_SUMMARY:
        if (
            station_name.upper() in key.upper()
            or key.upper() in station_name.upper()
        ):
            # Load full ATR data
            try:
                with open(os.path.join(DATA_DIR, "atr_lookup.json")) as f:
                    atr_data = json.load(f)
                projects = atr_data.get(key, [])
                matched_name = key
            except Exception:
                pass
            break

    if not projects:
        return f"Nu am gasit proiecte pentru statia '{station_name}'."

    lines = [f"Proiecte conectate la {matched_name} ({len(projects)} total):"]
    for p in projects[:15]:
        lines.append(
            f"  - {p.get('name', 'Fara nume')} | {p.get('investor', '')} | "
            f"{p['power_mw']} MW | {p['type']} | {p['status']}"
        )
    if len(projects) > 15:
        lines.append(f"  ... si inca {len(projects) - 15} proiecte")
    return "\n".join(lines)


@tool
def analyze_capacity_by_type() -> str:
    """Analyze total capacity by energy type across all stations."""
    type_stats: dict[str, dict[str, int]] = {}
    for data in STATION_SUMMARY.values():
        for typ, count in data["types"].items():
            if typ not in type_stats:
                type_stats[typ] = {"count": 0, "stations": 0}
            type_stats[typ]["count"] += count
            type_stats[typ]["stations"] += 1

    lines = ["Analiza capacitate pe tip energie:"]
    for typ, stats in sorted(type_stats.items(), key=lambda x: -x[1]["count"]):
        lines.append(
            f"  {typ}: {stats['count']} proiecte in {stats['stations']} statii"
        )
    return "\n".join(lines)
