# PowerGrid AI — Full System Plan
## From Research to Production

---

## STATUS: What's Done

### Frontend MVP (COMPLETE)
- [x] MapLibre GL JS + ESRI satellite imagery + place labels
- [x] Romania OSM data: 3,159 lines, 1,665 substations, 111K towers, 4,644 plants
- [x] GridKit European transmission topology (6,001 lines, 3,657 substations)
- [x] Voltage-colored lines (110kV=green, 220kV=red, 400kV=purple)
- [x] Dark engineering UI, sidebar, layer toggles, voltage filters
- [x] Search with fly-to, click-to-inspect info panel
- [x] Heatmap density overlay
- [x] Coordinate display, zoom level indicator
- [x] GitHub repo: https://github.com/TimpiaAI/powergrid-map

---

## REMAINING: Full System Build

### PHASE 1 — Backend & Database (Week 1-2)

**Goal:** Replace static GeoJSON files with PostGIS database + FastAPI

#### 1.1 PostgreSQL + PostGIS Setup
```
Database: powergrid_db

Tables:
├── power_lines
│   ├── id (serial PK)
│   ├── geom (LineString, SRID 4326)
│   ├── voltage_kv (integer)
│   ├── operator (varchar)
│   ├── name (varchar)
│   ├── cables (integer)
│   ├── source (enum: osm, ml, manual, verified)
│   ├── confidence (float, 0-1, nullable)
│   ├── country (varchar)
│   ├── osm_id (bigint, nullable)
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
├── power_substations
│   ├── id (serial PK)
│   ├── geom (Point or Polygon, SRID 4326)
│   ├── voltage_kv (integer)
│   ├── name (varchar)
│   ├── operator (varchar)
│   ├── type (enum: substation, plant, transformer)
│   ├── capacity_mva (float, nullable)
│   ├── source (enum: osm, ml, manual, verified)
│   ├── confidence (float, 0-1, nullable)
│   ├── country (varchar)
│   ├── osm_id (bigint, nullable)
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
├── power_towers
│   ├── id (serial PK)
│   ├── geom (Point, SRID 4326)
│   ├── tower_type (enum: lattice, monopole, wood, unknown)
│   ├── voltage_kv (integer, nullable)
│   ├── source (enum: osm, ml, manual, verified)
│   ├── confidence (float, 0-1, nullable)
│   ├── line_id (FK → power_lines, nullable)
│   ├── country (varchar)
│   └── created_at (timestamp)
│
├── ml_detections (raw ML output before review)
│   ├── id (serial PK)
│   ├── geom (geometry, SRID 4326)
│   ├── detection_type (enum: tower, substation, line_corridor)
│   ├── model_name (varchar)
│   ├── model_version (varchar)
│   ├── confidence (float)
│   ├── status (enum: pending, approved, rejected)
│   ├── reviewed_by (varchar, nullable)
│   ├── reviewed_at (timestamp, nullable)
│   ├── imagery_source (varchar)
│   ├── imagery_date (date)
│   ├── raw_metadata (jsonb)
│   └── created_at (timestamp)
│
└── imagery_tiles (tracking processed tiles)
    ├── id (serial PK)
    ├── tile_x, tile_y, tile_z (integer)
    ├── source (enum: sentinel1, sentinel2, ancpi, copernicus_vhr)
    ├── processed_at (timestamp)
    ├── model_name (varchar)
    ├── detections_count (integer)
    └── bbox (geometry, SRID 4326)

Indexes:
├── GIST spatial on all geom columns
├── B-tree on voltage_kv, source, country, confidence
└── B-tree on ml_detections.status for review queue
```

#### 1.2 FastAPI Backend
```
powergrid_api/
├── app/
│   ├── main.py                 # FastAPI app
│   ├── core/
│   │   ├── config.py           # Pydantic Settings
│   │   └── database.py         # SQLAlchemy + PostGIS
│   ├── api/
│   │   ├── grid.py             # GET /api/grid/lines, /api/grid/substations
│   │   ├── tiles.py            # GET /api/tiles/{z}/{x}/{y}.mvt (vector tiles)
│   │   ├── search.py           # GET /api/search?q=galati
│   │   ├── ml.py               # POST /api/ml/detect, GET /api/ml/queue
│   │   └── review.py           # POST /api/review/{id}/approve|reject
│   ├── services/
│   │   ├── osm_importer.py     # Import OSM data → PostGIS
│   │   ├── tile_server.py      # Generate MVT tiles from PostGIS
│   │   ├── ml_pipeline.py      # Orchestrate ML inference
│   │   └── geocoder.py         # Search infrastructure by name
│   └── models/
│       └── grid.py             # SQLAlchemy models
├── alembic/                    # DB migrations
├── requirements.txt
└── Dockerfile
```

**Key API Endpoints:**
```
GET  /api/grid/lines?bbox=25,45,26,46&voltage_min=110
GET  /api/grid/substations?bbox=...
GET  /api/grid/towers?bbox=...
GET  /api/tiles/{z}/{x}/{y}.mvt          # Vector tiles for MapLibre
GET  /api/search?q=galati&type=substation
POST /api/ml/detect                       # Trigger ML on area
GET  /api/ml/queue                        # Review queue
POST /api/ml/review/{id}                  # Approve/reject detection
GET  /api/stats                           # Dashboard stats
```

#### 1.3 Vector Tile Server
Two options (choose one):
- **Martin** (Rust, fastest) — auto-discovers PostGIS tables, serves MVT
- **Built-in** — FastAPI endpoint using `ST_AsMVT()` directly

For MVP: built-in with FastAPI. For production: Martin.

#### 1.4 Data Import Pipeline
```python
# Import flow:
OSM Overpass → GeoJSON → normalize voltage (V→kV) → PostGIS
PyPSA-Eur CSV → normalize → PostGIS
GridKit CSV → normalize → PostGIS
ML detections → ml_detections table → review → power_* tables
```

---

### PHASE 2 — ML Pipeline: Tower Detection from SAR (Week 3-6)

**Goal:** Detect transmission towers from Sentinel-1 SAR imagery (FREE)

#### 2.1 Download Sentinel-1 SAR Data
```
Source: Copernicus Data Space Ecosystem (CDSE)
URL: https://dataspace.copernicus.eu/
Product: Sentinel-1 GRD (Ground Range Detected)
Resolution: 10m
Coverage: All of Romania (238,397 km²)
Cost: FREE
Format: GeoTIFF
Band: VV polarization (best for metal detection)

Download via:
- CDSE OData API
- sentinelsat Python library
- Google Earth Engine (if commercial license)
```

**Why SAR works for towers:**
Metal transmission towers cause strong radar backscatter (glare).
They appear as bright spots against dark vegetation background.
Works through clouds, at night — unlike optical imagery.
World Bank project proved 75-85% accuracy.

#### 2.2 Tile Processing Pipeline
```
Sentinel-1 GRD scene (~250km × ~250km)
    │
    ▼
GDAL preprocessing:
├── Calibration (DN → sigma0)
├── Speckle filtering (Lee filter)
├── Terrain correction (SRTM DEM)
└── Reproject to EPSG:4326
    │
    ▼
Cut into 512×512 tiles with 64px overlap
    │
    ▼
Store tiles in S3/local with spatial index
    │
    ▼
Track processed tiles in imagery_tiles table
```

#### 2.3 YOLOv8 Tower Detection Model
```
Architecture: YOLOv8m (medium — balance speed/accuracy)
Framework: Ultralytics
Input: 512×512 SAR tiles (VV band, normalized)
Output: Bounding boxes + confidence scores

Training data:
├── EPD Dataset (Kaggle) — 1,500 images, 3,000+ pylons
├── SRSPTD Dataset — satellite power towers
├── Auto-labels from OSM:
│   ├── Query OSM tower locations in Romania
│   ├── Download corresponding Sentinel-1 tiles
│   └── Create YOLO annotations (bbox around each tower)
└── Total: ~5,000-10,000 training images

Training config:
├── Epochs: 100
├── Batch size: 16
├── Image size: 512
├── Augmentation: flip, rotate, brightness, noise
├── GPU: A100 or RTX 4090 (RunPod ~$1-2/hr)
└── Expected training time: 4-8 hours

Expected performance:
├── mAP@0.5: 75-85% (SAR 10m resolution)
├── Precision: ~80%
├── Recall: ~75%
└── Reference: World Bank project achieved similar
```

#### 2.4 Inference Pipeline
```python
# Pseudocode
for tile in unprocessed_tiles(country="Romania"):
    image = load_tile(tile)
    detections = yolo_model.predict(image, conf=0.5)

    for det in detections:
        # Convert pixel coords to lat/lng
        lat, lng = tile_pixel_to_latlng(det.bbox_center, tile)

        # Check if already known in PostGIS
        existing = query_nearest_tower(lat, lng, radius=50m)

        if existing:
            # ML confirms known tower — increase confidence
            update_tower(existing.id, confidence=max(existing.conf, det.conf))
        else:
            # NEW DISCOVERY — add to review queue
            insert_ml_detection(
                geom=Point(lng, lat),
                type="tower",
                confidence=det.conf,
                model="YOLOv8-SAR-v1",
                status="pending"
            )

    mark_tile_processed(tile)
```

---

### PHASE 3 — ML Pipeline: Line Corridor Detection from NDVI (Week 5-8)

**Goal:** Detect power line corridors from vegetation clearance patterns (FREE)

#### 3.1 Download Sentinel-2 Data
```
Source: Copernicus CDSE
Product: Sentinel-2 L2A (atmospherically corrected)
Resolution: 10m (B02, B03, B04, B08)
Coverage: Romania, cloud-free composite
Cost: FREE

Compute NDVI = (B08 - B04) / (B08 + B04)
HV corridors: 30-60m wide cleared vegetation strips
At 10m resolution: 3-6 pixels wide → detectable!
```

#### 3.2 U-Net Corridor Segmentation
```
Architecture: U-Net with attention gates
Framework: PyTorch / segmentation_models_pytorch
Input: 256×256 NDVI tiles
Output: Binary mask (corridor / not corridor)

Training data (auto-generated):
├── Download OSM power line routes for Romania
├── Buffer each line by 40m → polygon
├── Rasterize onto Sentinel-2 NDVI grid
├── Create tile pairs: NDVI tile ↔ corridor mask
└── ~10,000 training pairs

Post-processing:
├── Threshold mask at 0.5
├── Skeletonize to 1px centerline (scikit-image)
├── Douglas-Peucker simplification
├── Snap endpoints to nearest detected towers
├── Merge segments across tile boundaries
└── Output: LineString geometries
```

---

### PHASE 4 — Tower-to-Line Graph Connection (Week 7-10)

**Goal:** Connect detected towers into power line routes

#### 4.1 GridTracer Algorithm (Based on Duke University paper)
```
Input: Detected tower locations (Phase 2) + corridor masks (Phase 3)

Step 1: Build candidate graph
├── For each tower, find k nearest neighbors (k=8, max dist=5km)
├── Filter by angle constraint (>120° between consecutive segments)
└── Score each edge: distance + corridor overlap + voltage match

Step 2: Graph optimization
├── Minimum spanning tree as baseline
├── Add edges that follow corridor masks
├── Remove edges that cross forbidden areas (water, dense urban)
└── Optimize for minimum total wire length

Step 3: Voltage classification
├── Tower spacing → voltage estimate
│   ├── 200-300m spacing → likely 110kV
│   ├── 300-500m spacing → likely 220kV
│   └── 400-600m spacing → likely 400kV
├── Cross-reference with nearby substation voltages
└── Assign voltage to each line segment

Output: LineString geometries with voltage, stored in power_lines table
```

---

### PHASE 5 — High-Resolution Detection with ANCPI (Week 10-14)

**Goal:** Precise detection using Romania's 10-40cm ortophoto

#### 5.1 ANCPI Ortophoto Access
```
Source: ANCPI (Agentia Nationala de Cadastru si Publicitate Imobiliara)
Portal: https://geoportal.ancpi.ro/
Resolution: 10-40cm (EXCELLENT for infrastructure detection)
Coverage: All of Romania
Access: WMS endpoint + e-payment for bulk download
Cost: ~$5,000-20,000 for target areas
Legal: Verify ML use licensing with ANCPI
```

#### 5.2 Enhanced Models on High-Res
```
Tower Detection:
├── Fine-tune YOLOv8 on ANCPI imagery (much higher accuracy than SAR)
├── Can detect individual tower types (lattice, monopole, wood)
├── Expected: 90-95% mAP
└── Can detect distribution poles (not possible from satellite)

Substation Detection:
├── Faster R-CNN or Mask R-CNN (Detectron2)
├── Substations are large, geometrically distinct
├── Output: Polygon boundaries + classification
├── Expected: 85-95% accuracy

Power Line Detection:
├── At 10-40cm, actual wires may be visible
├── U-Net segmentation on RGB tiles
├── Or: detect tower shadows → estimate line direction
└── Much more accurate than NDVI corridor approach
```

---

### PHASE 6 — Review UI & Active Learning (Week 12-16)

**Goal:** Engineers verify ML detections, corrections improve models

#### 6.1 Review Interface
```
Features:
├── Map shows ML detections in distinct style (dashed lines, pulsing dots)
├── Queue panel: list of pending detections sorted by confidence
├── One-click approve/reject with keyboard shortcuts
├── Bulk approve: "approve all >90% confidence"
├── Draw tools: manually add/adjust infrastructure
├── Split view: satellite imagery | detection overlay
└── Progress tracker: X/Y reviewed, Z approved

Status flow:
pending → approved → merged into power_* tables
pending → rejected → excluded from future training
```

#### 6.2 Active Learning Loop
```
Every month:
├── Export approved detections as training data
├── Export rejected detections as negative examples
├── Retrain YOLOv8 / U-Net with expanded dataset
├── Run inference on previously failed areas
└── Accuracy improves: 75% → 85% → 92% → 95%+

After 3 cycles: engineers only review edge cases (<5% of detections)
```

---

### PHASE 7 — Scale to Europe (Week 16-24)

**Goal:** Apply trained models to all of Europe

```
Data pipeline:
├── Download Sentinel-1 SAR for each European country
├── Download Sentinel-2 for corridor detection
├── Run inference with Romania-trained models
├── Merge with OSM + PyPSA-Eur existing data
├── Use Copernicus VHR (2m, free for EU institutions) for validation
└── Country-by-country rollout

Priority order:
1. Romania (done)
2. Neighbors: Hungary, Bulgaria, Serbia, Moldova, Ukraine
3. Western Europe: Germany, France, Italy, Spain
4. Rest of EU

Estimated coverage after Phase 7:
├── OSM baseline: 60-70%
├── + ML towers (SAR): +15-20%
├── + ML corridors (NDVI): +5-10%
├── + High-res (ANCPI/equivalent): +5-10%
└── Total: ~90-95% of European transmission grid
```

---

## TECH STACK SUMMARY

| Layer | Technology | Status |
|-------|-----------|--------|
| **Frontend** | Next.js + MapLibre GL JS + deck.gl | DONE |
| **Satellite tiles** | ESRI World Imagery (free) | DONE |
| **Grid data (bootstrap)** | OSM + GridKit + PyPSA-Eur | DONE |
| **Database** | PostgreSQL + PostGIS | TODO |
| **API** | FastAPI + SQLAlchemy | TODO |
| **Vector tiles** | Martin (Rust) or ST_AsMVT | TODO |
| **ML: Tower detection** | YOLOv8 + Sentinel-1 SAR | TODO |
| **ML: Corridor detection** | U-Net + Sentinel-2 NDVI | TODO |
| **ML: Graph connection** | GridTracer algorithm | TODO |
| **ML: High-res detection** | RCNN + ANCPI ortophoto | TODO |
| **ML training infra** | RunPod A100 (~$1-2/hr) | TODO |
| **Review UI** | React + MapLibre + review queue | TODO |
| **Orchestration** | Airflow or Prefect | TODO |
| **Deployment** | Docker + Railway/Render | TODO |

---

## BUDGET

| Phase | Cost | Timeline |
|-------|------|----------|
| Phase 1: Backend + DB | $0 (self-hosted) | 2 weeks |
| Phase 2: SAR tower detection | $100-300 (GPU rental) | 4 weeks |
| Phase 3: NDVI corridor detection | $100-200 (GPU rental) | 3 weeks |
| Phase 4: GridTracer connections | $0 (CPU) | 3 weeks |
| Phase 5: ANCPI high-res | $5,000-20,000 (imagery) + $500 (GPU) | 4 weeks |
| Phase 6: Review UI + active learning | $0 (engineering time) | 4 weeks |
| Phase 7: Scale to Europe | $500-2,000/mo (compute) | 8 weeks |
| **Total MVP (Romania)** | **$5,500-21,000** | **~16 weeks** |
| **Total Full System** | **$7,000-25,000** | **~28 weeks** |

---

## KEY RESEARCH SOURCES

### Models & Code
- [YOLOv8 (Ultralytics)](https://github.com/ultralytics/ultralytics)
- [GridTracer — Duke University](https://github.com/bohaohuang/transmission_grid)
- [Dev Seed ML Grid Detection](https://github.com/developmentseed/ml-hv-grid-pub)
- [GridFinder — Meta/World Bank](https://github.com/carderne/gridfinder)
- [SatlasPretrain — Allen AI](https://github.com/allenai/satlaspretrain_models)
- [Detectron2 — Meta](https://github.com/facebookresearch/detectron2)

### Training Datasets
- [EPD — Electric Pylon Detection (Kaggle)](https://www.kaggle.com/qiaosijia/epd-dataset)
- [SRSPTD — Satellite Power Towers](https://github.com/ZX815/LSKF-YOLO)
- [TTPLA — Towers + Power Lines Aerial](https://github.com/R3ab/ttpla_dataset)
- [GridTracer — 263km² annotated](https://arxiv.org/abs/2101.06390)

### Grid Data
- [PyPSA-Eur (6,001 lines, all Europe)](https://github.com/PyPSA/pypsa-eur)
- [GridKit (Zenodo)](https://zenodo.org/records/47317)
- [OSM Overpass API](https://overpass-turbo.eu/)
- [Awesome Electrical Grid Mapping](https://github.com/open-energy-transition/Awesome-Electrical-Grid-Mapping)

### Imagery
- [Copernicus CDSE (Sentinel-1/2, free)](https://dataspace.copernicus.eu/)
- [ANCPI Romania Ortophoto](https://geoportal.ancpi.ro/)
- [Copernicus VHR (2m, free for EU research)](https://land.copernicus.eu/)
- ESRI World Imagery (frontend display only, NOT for ML)

### Papers
- [Deep Learning in Power Line Inspection — 2025 survey](https://arxiv.org/abs/2502.07826)
- [Deep learning pipeline for power infrastructure — 2025](https://www.tandfonline.com/doi/full/10.1080/20964471.2025.2490408)
- [YOLOv9-GDV power pylon detection — 2025](https://www.mdpi.com/2072-4292/17/13/2229)
- [Geospatial mapping of distribution grid — Nature 2023](https://www.nature.com/articles/s41467-023-39647-3)
- [GridFinder — Nature Scientific Data 2019](https://www.nature.com/articles/s41597-019-0347-4)

### Competitors (none doing what we do)
- [OpenInfraMap (OSM viz only)](https://openinframap.org/)
- [AiDash (vegetation management)](https://www.aidash.com/)
- [LiveEO (vegetation monitoring)](https://www.live-eo.com/)
- [Buzz Solutions (drone inspection)](https://www.buzzsolutions.co/)
- [Sharper Shape (drone mapping)](https://sharpershape.com/)
