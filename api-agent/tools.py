import os
import json
import re
from langchain_core.tools import tool

# Resolve data directory relative to this file
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")


def _load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _load_geojson_count(filename):
    data = _load_json(filename)
    return len(data.get("features", []))


# Load data at startup
STATION_SUMMARY = _load_json("station_summary.json")
ATR_LOOKUP = _load_json("atr_lookup.json")
GRID_STATS = {
    "romania_lines": _load_geojson_count("romania_lines.geojson"),
    "romania_substations": _load_geojson_count("romania_substations.geojson"),
    "romania_towers": _load_geojson_count("romania_towers.geojson"),
    "romania_plants": _load_geojson_count("romania_plants.geojson"),
    "europe_solar": _load_geojson_count("europe_solar.geojson"),
    "europe_wind": _load_geojson_count("europe_wind.geojson"),
    "europe_powerplants": _load_geojson_count("europe_powerplants.geojson"),
    "gridkit_europe_lines": _load_geojson_count("gridkit_europe_lines.geojson"),
    "gridkit_europe_vertices": _load_geojson_count("gridkit_europe_vertices.geojson"),
}

# Load substation names + coords for fly-to
SUBSTATIONS = {}
subs_data = _load_json("romania_substations.geojson")
for feat in subs_data.get("features", []):
    name = feat.get("properties", {}).get("name", "")
    if not name:
        continue
    geom = feat.get("geometry", {})
    if geom.get("type") == "Point":
        SUBSTATIONS[name] = geom["coordinates"][:2]
    elif geom.get("type") == "Polygon":
        ring = geom["coordinates"][0]
        SUBSTATIONS[name] = [
            sum(c[0] for c in ring) / len(ring),
            sum(c[1] for c in ring) / len(ring),
        ]

# Romanian city coordinates
CITIES = {
    "bucuresti": [26.1025, 44.4268], "cluj": [23.5897, 46.7712],
    "timisoara": [21.2087, 45.7489], "iasi": [27.5615, 47.1585],
    "constanta": [28.6348, 44.1598], "craiova": [23.7949, 44.3302],
    "brasov": [25.5887, 45.6427], "galati": [28.0353, 45.4353],
    "ploiesti": [26.0225, 44.9462], "oradea": [21.9189, 47.0722],
    "bacau": [26.9144, 46.5670], "arad": [21.3114, 46.1866],
    "pitesti": [24.8689, 44.8565], "sibiu": [24.1469, 45.7983],
    "targu mures": [24.5575, 46.5386], "baia mare": [23.5802, 47.6567],
    "buzau": [26.8308, 45.1509], "suceava": [26.2558, 47.6514],
    "botosani": [26.6583, 47.7487], "satu mare": [22.8774, 47.7921],
    "cernavoda": [28.0325, 44.3418], "focsani": [27.1797, 45.6947],
    "deva": [22.9014, 45.8842], "alba iulia": [23.5714, 46.0764],
}

print(f"[tools] Loaded: {len(STATION_SUMMARY)} stations, {len(SUBSTATIONS)} named substations, {len(ATR_LOOKUP)} ATR groups")


# ==================== GRID DATA TOOLS ====================

@tool
def search_station(query: str) -> str:
    """Search for a substation/station by name. Returns matching stations with project count and total MW."""
    results = []
    q = query.upper().strip()
    for station, data in STATION_SUMMARY.items():
        if q in station.upper():
            results.append(f"Statie: {station} - {data['count']} proiecte, {data['total_mw']:.1f} MW, tipuri: {data['types']}")
    if not results:
        for station in STATION_SUMMARY:
            for word in q.split():
                if len(word) >= 4 and word in station.upper():
                    data = STATION_SUMMARY[station]
                    results.append(f"Statie: {station} - {data['count']} proiecte, {data['total_mw']:.1f} MW")
                    break
    if not results:
        return f"Nu am gasit statii cu '{query}'. Disponibile: {', '.join(list(STATION_SUMMARY.keys())[:15])}..."
    return "\n".join(results[:10])


@tool
def get_grid_stats() -> str:
    """Get overall statistics about all power grid data loaded in the system."""
    total_projects = sum(d["count"] for d in STATION_SUMMARY.values())
    total_mw = sum(d["total_mw"] for d in STATION_SUMMARY.values())
    return f"""Statistici PowerGrid AI:

ROMANIA (OSM): {GRID_STATS.get('romania_lines',0):,} linii, {GRID_STATS.get('romania_substations',0):,} statii, {GRID_STATS.get('romania_towers',0):,} stalpi, {GRID_STATS.get('romania_plants',0):,} centrale
EUROPA (GridKit+WRI): {GRID_STATS.get('gridkit_europe_lines',0):,} linii, {GRID_STATS.get('gridkit_europe_vertices',0):,} statii, {GRID_STATS.get('europe_powerplants',0):,} centrale
SATELIT (Microsoft GRW): {GRID_STATS.get('europe_solar',0):,} parcuri solare, {GRID_STATS.get('europe_wind',0):,} turbine eoliene
PROIECTE (Transelectrica): {total_projects:,} proiecte, {total_mw:,.1f} MW in {len(STATION_SUMMARY)} statii"""


@tool
def list_stations_by_capacity(min_mw: float = 0) -> str:
    """List stations sorted by total MW capacity."""
    stations = [(n, d) for n, d in STATION_SUMMARY.items() if d["total_mw"] >= min_mw]
    stations.sort(key=lambda x: -x[1]["total_mw"])
    lines = [f"{n}: {d['total_mw']:.1f} MW ({d['count']} proiecte) - {d['types']}" for n, d in stations[:20]]
    return "\n".join(lines) if lines else "Nicio statie gasita."


@tool
def get_station_projects(station_name: str) -> str:
    """Get detailed list of projects connected to a station."""
    for key in ATR_LOOKUP:
        if station_name.upper() in key.upper() or key.upper() in station_name.upper():
            projects = ATR_LOOKUP[key]
            lines = [f"Proiecte la {key} ({len(projects)} total):"]
            for p in projects[:20]:
                lines.append(f"  - {p.get('name','?')} | {p.get('investor','')} | {p['power_mw']} MW | {p['type']} | {p['status']}")
            if len(projects) > 20:
                lines.append(f"  ... +{len(projects)-20} proiecte")
            return "\n".join(lines)
    return f"Nu am gasit proiecte pentru '{station_name}'."


@tool
def analyze_capacity_by_type() -> str:
    """Analyze total capacity and project count by energy type."""
    type_stats: dict = {}
    for data in STATION_SUMMARY.values():
        for typ, count in data["types"].items():
            if typ not in type_stats:
                type_stats[typ] = {"count": 0, "stations": 0}
            type_stats[typ]["count"] += count
            type_stats[typ]["stations"] += 1
    lines = ["Analiza pe tip energie:"]
    for typ, stats in sorted(type_stats.items(), key=lambda x: -x[1]["count"]):
        lines.append(f"  {typ}: {stats['count']} proiecte in {stats['stations']} statii")
    return "\n".join(lines)


# ==================== MAP CONTROL TOOLS ====================

@tool
def fly_to_location(location: str) -> str:
    """Navigate the map to a location. Returns a JSON command the frontend executes.
    Use for: cities (Bucuresti, Cluj), stations (Cernavoda), regions (Dobrogea), or coordinates (45.5, 26.1).
    ALWAYS use this when the user asks to see a place, go to a location, or show something on the map."""
    loc = location.strip()

    # Try coordinates
    m = re.match(r"([\d.]+)\s*,\s*([\d.]+)", loc)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        lat, lng = (b, a) if a > 90 else (a, b)
        return json.dumps({"action": "fly_to", "lat": lat, "lng": lng, "zoom": 14, "label": location})

    # Try city
    loc_norm = loc.lower().replace("ș","s").replace("ț","t").replace("ă","a").replace("â","a").replace("î","i")
    for city, coords in CITIES.items():
        if city in loc_norm or loc_norm in city:
            return json.dumps({"action": "fly_to", "lat": coords[1], "lng": coords[0], "zoom": 12, "label": loc})

    # Try substation
    for name, coords in SUBSTATIONS.items():
        if loc.upper() in name.upper() or name.upper() in loc.upper():
            return json.dumps({"action": "fly_to", "lat": coords[1], "lng": coords[0], "zoom": 15, "label": name})

    # Try regions
    regions = {
        "dobrogea": [28.5, 44.6, 8], "moldova": [27.0, 47.0, 8],
        "transilvania": [24.5, 46.5, 8], "muntenia": [26.0, 44.5, 8],
        "oltenia": [23.5, 44.5, 8], "banat": [21.5, 45.5, 8],
    }
    for reg, (lng, lat, z) in regions.items():
        if reg in loc_norm:
            return json.dumps({"action": "fly_to", "lat": lat, "lng": lng, "zoom": z, "label": loc})

    return f"Nu am gasit '{location}'. Incearca: Bucuresti, Cluj, Constanta, Cernavoda, Dobrogea, etc."


@tool
def highlight_area(description: str) -> str:
    """Focus the map on a specific region or area of interest.
    Use for broader areas like 'judetul Bacau', 'zona Dobrogea', 'sud-estul Romaniei'."""
    return fly_to_location.invoke(description)


# ==================== WEB SEARCH TOOL ====================

@tool
def web_search(query: str) -> str:
    """Search the web for information about energy, power grids, regulations, prices, news, or any topic.
    Use when the user asks about something NOT in the local database — regulations, prices, news, technical standards, etc."""
    import urllib.request
    import urllib.parse

    try:
        encoded = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        results = []
        snippets = re.findall(r'class="result__snippet">(.*?)</a>', html, re.DOTALL)
        titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', html, re.DOTALL)
        for i, (title, snippet) in enumerate(zip(titles[:5], snippets[:5])):
            t = re.sub(r"<[^>]+>", "", title).strip()
            s = re.sub(r"<[^>]+>", "", snippet).strip()
            results.append(f"{i+1}. {t}\n   {s}")
        return "Rezultate web:\n\n" + "\n\n".join(results) if results else f"Niciun rezultat pentru '{query}'."
    except Exception as e:
        return f"Eroare cautare: {e}"
