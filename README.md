<p align="center">
  <img src="assets/aerosculpt_logo.png" alt="AeroSculpt Logo" width="120" />
</p>

<h1 align="center">AeroSculpt</h1>
<h3 align="center">Capture Once. Reconstruct Reality.</h3>

<p align="center">
  <em>Single-Pass UAV Video → Georeferenced, Metrically Accurate 3D World</em>
</p>

<p align="center">
  <a href="https://dineshsugumar-01.github.io/Aerosculpt/">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-Online-00f0ff?style=for-the-badge&logoColor=black" alt="Live Demo" />
  </a>
  <a href="https://github.com/dineshsugumar-01/Aerosculpt/actions/workflows/deploy.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/dineshsugumar-01/Aerosculpt/deploy.yml?branch=main&style=for-the-badge&label=CI%2FCD" alt="Build Status" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Three.js-r183-000000?style=flat-square&logo=threedotjs" alt="Three.js" />
  <img src="https://img.shields.io/badge/WebGL-Hardware%20Accelerated-ff3e00?style=flat-square&logo=webgl" alt="WebGL" />
  <img src="https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=flat-square&logo=opencv" alt="OpenCV" />
  <img src="https://img.shields.io/badge/GDAL-Geospatial-4CAF50?style=flat-square" alt="GDAL" />
  <img src="https://img.shields.io/badge/CUDA-GPU%20Accelerated-76B900?style=flat-square&logo=nvidia" alt="CUDA" />
</p>

---

## What is AeroSculpt?

**AeroSculpt** is an AI-powered platform that transforms a single UAV flight video and onboard telemetry into an accurate, measurable, and geographically aligned 3D environment. Unlike conventional photogrammetry workflows that demand dense image overlap, repeated flight passes, and extensive manual intervention, AeroSculpt extracts maximum usable information from **one continuous drone video** — producing georeferenced textured meshes, dense point clouds, and GIS-ready outputs for real-world visualization, measurement, and analysis.

> 🌐 **Live Web Application** → [https://dineshsugumar-01.github.io/Aerosculpt/](https://dineshsugumar-01.github.io/Aerosculpt/)

### The Problem

| Challenge | Impact |
| :--- | :--- |
| Conventional UAV reconstruction relies on dense image overlap and repeated processing | High processing time and redundant data |
| Single-pass video introduces blur, limited viewpoints, occlusion and dynamic objects | Unreliable geometry in difficult scenes |
| Image-only reconstruction lacks real-world geographic reference | Limited spatial accuracy and GIS integration |
| A 10-minute video can contain 18,000 frames at 30 FPS — most are redundant | Expensive computation on unusable data |

### The Solution

AeroSculpt delivers a **unified data pipeline** — from raw UAV video capture to an interactive, metrically accurate 3D world — with near-real-time processing, geographic positioning, and evidence-aware output.

---

## Key Capabilities

- ✦ **Single-Pass 3D Reconstruction** — One UAV flight to complete 3D scene, eliminating repeated data capture
- ✦ **AI-Driven Keyframe Engine** — Intelligent frame selection using blur/quality filtering, viewpoint coverage scoring, and temporal redundancy removal
- ✦ **Scene Understanding** — Instance segmentation, dynamic-object masking, and static-structure extraction before reconstruction
- ✦ **Adaptive Reconstruction** — Automatically selects reconstruction depth (Easy → Medium → Hard) based on scene complexity
- ✦ **Multi-Source Spatial Fusion** — Combines Video + GPS/GNSS + IMU + RTK/PPK + Camera Metadata for robust alignment
- ✦ **Georeferenced Output** — CRS transformation, metric alignment, and coordinate system integration (UTM, WGS84)
- ✦ **Evidence-Aware 3D** — Distinguishes between observed, reconstructed, inferred, and unknown regions
- ✦ **Metric Validation** — Checks geometric consistency, reprojection error, confidence, coverage, and spatial accuracy before delivery
- ✦ **Interactive 3D Workstation** — WebGL-powered viewer with orbit controls, wireframe modes, measurement tools, and Draco compression
- ✦ **Real-Time Visual Odometry** — Live camera tracking with HUD telemetry and RTK GPS coordinate geodesy

---

## How It Works — The 6-Stage Pipeline

AeroSculpt processes UAV data through a modular, GPU-accelerated pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AEROSCULPT PIPELINE                             │
│                                                                        │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│  │ UAV      │   │ GNSS /   │   │ IMU /    │   │ Flight   │           │
│  │ Video    │   │ GPS      │   │ Sensors  │   │ Metadata │           │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘           │
│       │              │              │              │                   │
│       ▼              ▼              ▼              ▼                   │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  01  UAV INPUT — Video + Telemetry Ingestion           │            │
│  └──────────────────────┬─────────────────────────────────┘            │
│                         ▼                                              │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  02  QUALITY + KEYFRAME — Blur · Exposure · Coverage   │            │
│  │      → Redundancy Removal → Informative Keyframes      │            │
│  └──────────────────────┬─────────────────────────────────┘            │
│                         ▼                                              │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  03  AI SCENE + MOTION UNDERSTANDING                   │            │
│  │      → Instance Segmentation → Dynamic Masking         │            │
│  │      → Camera Trajectory / Pose Estimation             │            │
│  │      → Visual Geometry Cues                            │            │
│  └──────────────────────┬─────────────────────────────────┘            │
│                         ▼                                              │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  04  ADAPTIVE 3D RECONSTRUCTION                        │            │
│  │      → Global Structure-from-Motion                    │            │
│  │      → Geometric Priors & Bundle Adjustment            │            │
│  │      → Multi-View Stereo Dense Reconstruction          │            │
│  │      → Dense Point Cloud + Mesh Generation             │            │
│  └──────────────────────┬─────────────────────────────────┘            │
│                         ▼                                              │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  05  GEOREFERENCING + METRIC VALIDATION                │            │
│  │      → GNSS / RTK / PPK Alignment                     │            │
│  │      → CRS Transformation → Metric Checks             │            │
│  │      → Validation: VERIFIED / UNVERIFIED               │            │
│  └──────────────────────┬─────────────────────────────────┘            │
│                         ▼                                              │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  06  3D WORLD — Interactive Visualization              │            │
│  │      → Textured Mesh · Point Cloud · GIS Data          │            │
│  │      → Measurement · Analysis · Export                  │            │
│  └────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages Explained

| Stage | Module | Description |
| :---: | :--- | :--- |
| **01** | **UAV Input** | Ingests UAV video (MP4/MOV/MKV), GNSS/GPS logs, IMU orientation data, RTK/PPK corrections, and flight metadata |
| **02** | **Quality + Keyframe** | Filters blur, exposure issues, and poor viewpoints. Scores viewpoint coverage and removes temporal redundancy. Selects ~500–600 informative keyframes from ~18,000 raw frames |
| **03** | **AI Scene + Motion** | Instance segmentation detects and masks dynamic objects (vehicles, people). Estimates camera trajectory and pose. Extracts visual geometry cues and scene complexity indicators |
| **04** | **Adaptive Reconstruction** | Selects reconstruction strategy based on scene complexity (Easy → Medium → Hard). Performs structure-from-motion, geometric prior estimation, bundle adjustment, and multi-view stereo dense reconstruction |
| **05** | **Georeferencing** | Fuses GPS/GNSS + IMU + RTK/PPK for spatial alignment. Applies CRS transformation and metric validation. Checks geometric consistency, reprojection error, and coverage |
| **06** | **3D World** | Generates georeferenced textured mesh, dense point cloud, and GIS data. Delivers an interactive 3D viewer with measurement, inspection, and export tools |

---

## Engineering Principles

| # | Principle | Description |
| :---: | :--- | :--- |
| 01 | **Single-Pass Processing** | Extract maximum usable information from one UAV flight instead of requiring repeated surveys |
| 02 | **Quality-Driven Frame Selection** | Filter blur, exposure, redundancy, and poor viewpoints before expensive 3D processing |
| 03 | **Adaptive Reconstruction** | Adjust reconstruction depth based on scene complexity and available visual evidence |
| 04 | **Multi-Source Fusion** | Combine Video + GPS/GNSS + IMU + RTK/PPK + Camera Metadata for stronger spatial alignment |
| 05 | **Evidence-Aware 3D** | Distinguish between observed, reconstructed, inferred, and unknown regions rather than silently filling gaps |
| 06 | **Metric Validation First** | Check geometric consistency, reprojection error, confidence, coverage, and spatial accuracy before final delivery |

---

## Platform Modules

| Module | Interface | Description |
| :--- | :--- | :--- |
| **Mission Home** | Landing Page | Cinematic hero with SLAM visual odometry tracking, mission selection, and dataset ingestion |
| **Upload & Configure** | Data Ingestion | UAV video payload review, sensor telemetry cards, reconstruction mode selection (Easy / Medium / Hard) |
| **Input Validation** | Quality Checks | Mission summary, tactical flight path & swath visualization, 6-point data quality checklist, CRS configuration |
| **Processing Pipeline** | 7-Stage Engine | Real-time progress tracking, selected keyframe filmstrip, scene understanding preview with semantic tiles |
| **3D Viewer & Analysis** | WebGL Workstation | Full-viewport Three.js viewer with orbit controls, wireframe modes, measurement tools, layer toggles, and 360° auto-orbit |
| **Validation & Export** | Deliverables | Metric accuracy table, evidence breakdown donut chart, CAD-ready exports (GLB, PLY, GeoTIFF, LAS) |

---

## Project Architecture

```
Aerosculpt/
│
├── .github/
│   └── workflows/
│       └── deploy.yml                  # CI/CD → GitHub Pages (with Git LFS)
│
├── pipeline/                           # Core Processing Engine (Python)
│   ├── ingest/
│   │   ├── video_decoder.py            # FFmpeg-based frame extraction & decoding
│   │   ├── telemetry_parser.py         # GNSS/IMU/RTK log parsing & synchronization
│   │   └── sensor_fusion.py            # Multi-source temporal alignment
│   │
│   ├── keyframe/
│   │   ├── quality_filter.py           # Blur detection, exposure analysis, sharpness scoring
│   │   ├── coverage_scorer.py          # Viewpoint diversity & spatial coverage assessment
│   │   ├── redundancy_remover.py       # Temporal redundancy elimination
│   │   └── selector.py                 # Intelligent keyframe selection engine
│   │
│   ├── scene/
│   │   ├── instance_segmentation.py    # AI instance segmentation for scene parsing
│   │   ├── dynamic_masking.py          # Dynamic object detection & mask generation
│   │   ├── complexity_analyzer.py      # Scene complexity classification (Easy/Medium/Hard)
│   │   └── static_extractor.py         # Static structure isolation
│   │
│   ├── reconstruction/
│   │   ├── sfm_engine.py               # Structure-from-Motion sparse reconstruction
│   │   ├── pose_estimator.py           # Camera trajectory & pose estimation
│   │   ├── geometric_priors.py         # Depth & geometric guidance integration
│   │   ├── bundle_adjuster.py          # Bundle adjustment & optimization
│   │   ├── mvs_dense.py               # Multi-View Stereo dense point cloud generation
│   │   ├── mesh_builder.py             # Surface reconstruction & mesh generation
│   │   └── texture_mapper.py           # High-resolution texture projection
│   │
│   ├── georef/
│   │   ├── gnss_aligner.py             # GPS/GNSS position alignment
│   │   ├── rtk_ppk_fuser.py            # RTK/PPK carrier-phase correction fusion
│   │   ├── crs_transform.py            # Coordinate Reference System transformation
│   │   ├── metric_aligner.py           # Real-world scale & metric alignment
│   │   └── validator.py                # Geometric consistency & accuracy validation
│   │
│   └── export/
│       ├── mesh_exporter.py            # GLB / OBJ / FBX mesh export
│       ├── pointcloud_exporter.py      # PLY / LAS / LAZ point cloud export
│       ├── geotiff_writer.py           # GeoTIFF orthomosaic generation
│       └── geojson_writer.py           # GeoJSON boundary & metadata export
│
├── src/                                # Web Application (ES6+ Modules)
│   ├── main.js                         # Global controller, routing, telemetry sync, pipeline UI
│   ├── missionStore.js                 # Central mission data store & photogrammetry metrics
│   ├── studioViewer.js                 # Full-screen 3D workstation viewer
│   └── viewer3d.js                     # Three.js viewport, orbit controls, loaders, shaders
│
├── styles/
│   ├── main.css                        # Core dark theme design system & HUD styling
│   └── workflow.css                    # Workflow screens, pipeline stages, modal styles
│
├── assets/                             # Application assets
│   ├── aerosculpt_logo.png             # Brand logo
│   ├── hero_bg.jpg                     # Landing page hero background
│   ├── aerosculpt_slam_tracking.mp4    # Visual odometry demo clip
│   ├── matching_video.mp4              # Feature matching visualization
│   └── ray_video.mp4                   # Ray casting demonstration
│
├── public/                             # Static production assets
│   ├── draco/                          # Draco WASM decoder modules
│   ├── datasets/                       # Pre-built mission datasets & calibrated frames
│   └── *.glb                           # High-fidelity 3D reconstruction models
│
├── index.html                          # Single-page application entry point
├── package.json                        # Node.js dependencies & scripts
├── vite.config.js                      # Vite bundling & dev server configuration
├── requirements.txt                    # Python processing dependencies
├── TECHNICAL_DESIGN.md                 # Technical Design Document (Markdown)
├── TECHNICAL_DESIGN.docx               # Technical Design Document (Word / DOCX format)
└── LICENSE                             # MIT License
```

---

## Technology Stack

### Processing Engine

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Video & Preprocessing** | Python · OpenCV · FFmpeg | Frame extraction, quality filtering, blur detection, exposure analysis |
| **AI & Segmentation** | PyTorch · Ultralytics | Instance segmentation, dynamic-object masking, scene understanding |
| **Pose & Trajectory** | Visual Odometry Engine | Camera pose estimation, motion tracking, trajectory reconstruction |
| **Geometric Priors** | Depth Estimation Networks | Monocular depth prediction, geometric guidance for reconstruction |
| **3D Reconstruction** | Structure-from-Motion · MVS | Sparse & dense point cloud generation, mesh construction, texture mapping |
| **Geospatial** | GDAL · PROJ · pyproj | CRS transformation, coordinate conversion, GeoTIFF / GeoJSON generation |
| **GPU Acceleration** | CUDA · cuDNN | Hardware-accelerated AI inference & dense reconstruction |

### Web Application

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Core Framework** | Vanilla ES6+ Modules | Single-page architecture with modular controllers |
| **3D Rendering** | [Three.js](https://threejs.org/) r183 | WebGL viewport, OrbitControls, DRACOLoader, PBR lighting |
| **Build & Bundling** | [Vite](https://vite.dev/) 8.0 | Hot module replacement, tree-shaking, optimized production builds |
| **Design System** | Vanilla CSS | Aerospace glassmorphic dark theme, HUD overlays, micro-animations |
| **Typography** | Plus Jakarta Sans · Inter · JetBrains Mono | Premium font stack via Google Fonts |
| **Icons** | FontAwesome 6 | SVG iconography across all UI components |
| **CI/CD & Hosting** | GitHub Actions · GitHub Pages · Git LFS | Automated deployment with large file support |

---

## Unified Data Pipeline

```
╔══════════════════╗   ╔══════════════════╗   ╔══════════════════╗
║    VIDEO DATA    ║   ║   POSE / IMU     ║   ║   GNSS / RTK     ║
║    Frames        ║   ║   Orientation     ║   ║   Geolocation     ║
╚════════╤═════════╝   ╚════════╤═════════╝   ╚════════╤═════════╝
         │                      │                      │
         ▼                      ▼                      ▼
╔═══════════════════════════════════════════════════════════════════╗
║                  AEROSCULPT PROCESSING ENGINE                    ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║   ╔════════════╗   ╔════════════╗   ╔═════════════════╗          ║
║   ║ SEMANTIC   ║   ║ GEOMETRY   ║   ║ GIS METADATA    ║          ║
║   ║ Labels /   ║   ║ Point Cloud║   ║ GeoTIFF /       ║          ║
║   ║ Masks      ║   ║ / Mesh     ║   ║ GeoJSON         ║          ║
║   ╚════════════╝   ╚════════════╝   ╚═════════════════╝          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
         │                      │                      │
         ▼                      ▼                      ▼
╔══════════════════╗   ╔══════════════════╗   ╔══════════════════╗
║  Textured Mesh   ║   ║   Point Cloud    ║   ║ Geospatial Data  ║
║  .obj/.glb/.fbx  ║   ║  .ply/.las/.laz  ║   ║ GeoTIFF/GeoJSON  ║
╚══════════════════╝   ╚══════════════════╝   ╚══════════════════╝
                              │
                              ▼
                 ╔═════════════════════════╗
                 ║  Interactive 3D Viewer  ║
                 ║  Three.js Web + Desktop ║
                 ╚═════════════════════════╝
```

---

## System Outputs

| Output | Format | Description |
| :--- | :--- | :--- |
| **Textured Mesh** | `.obj` · `.glb` · `.fbx` | High-fidelity surface mesh with photographic texture projection |
| **Dense Point Cloud** | `.ply` · `.las` · `.laz` | Georeferenced 3D point cloud with RGB color |
| **Orthomosaic** | `GeoTIFF` | Georeferenced top-down aerial image composite |
| **Boundary Data** | `GeoJSON` | Survey boundary, flight path, and metadata |
| **Interactive Viewer** | Three.js WebGL | Browser-native 3D inspection, measurement, and analysis workstation |

---

## Sample Data & Demo Assets

AeroSculpt ships with **3 fully calibrated UAV mission datasets** and standalone demo assets for immediate testing and evaluation. All sample data is included in the repository via Git LFS.

### Bundled Mission Datasets

| Mission | Terrain | UAV Platform | Video | 3D Model | Keyframes | Accuracy |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **M01 — Komorowice Cadastral** | Urban / Infrastructure | DJI Mini 3 Pro | [`pb1_video.mp4`](public/datasets/pb1_video.mp4) (54.4 MB) | [`pb1_model.glb`](public/datasets/pb1_model.glb) (27.5 MB) | 94 | 0.021 m |
| **M02 — Svalbard Arctic Recon** ⭐ | Polar Glacial / Coastal | DJI Mavic 3E RTK | [`pb2_video.mp4`](public/datasets/pb2_video.mp4) (113.9 MB) | [`pb2_model.glb`](public/datasets/pb2_model.glb) (36.4 MB) | 513 | 0.031 m |
| **M03 — Zermatt Alpine Survey** | Mountainous / Extreme Relief | senseFly eBee X | [`pb3_video.mp4`](public/datasets/pb3_video.mp4) (38.2 MB) | [`pb3_model.glb`](public/datasets/pb3_model.glb) (33.2 MB) | 181 | 0.011 m |

> [!NOTE]
> Each mission includes the raw UAV video, reconstructed 3D model (GLB with Draco compression), and a full set of calibrated keyframe images in `public/datasets/frames_pbX/`.

### Mission Details

<details>
<summary><strong>M02 — Svalbard Arctic Reconnaissance (Recommended)</strong></summary>

| Parameter | Value |
| :--- | :--- |
| Scene Type | Rural / Glacial · Coastal Fjord |
| Video Duration | 05:18 (318 seconds) |
| Resolution | 1920 × 1080 FHD @ 30 FPS |
| Camera Sensor | 4/3 CMOS 20MP (Hasselblad L2D-20c) |
| CRS Datum | EPSG:32633 (WGS 84 / UTM Zone 33N) |
| Altitude Range | 45m – 82m AGL |
| Flight Speed | 7.2 m/s avg |
| Reprojection Error | 0.44 px |
| GSD | 2.4 cm/px |
| Tie Points | 72,140 |
| Dense Points | 3,118,000 |
| Mesh Faces | 612,400 |
| Bounding Area | 480m × 390m |
| Coverage | 91.8% |

</details>

<details>
<summary><strong>M01 — Komorowice Cadastral Survey (Urban)</strong></summary>

| Parameter | Value |
| :--- | :--- |
| Scene Type | Urban Area · Infrastructure |
| Video Duration | 03:42 (222 seconds) |
| Resolution | 1920 × 1080 FHD @ 30 FPS |
| Camera Sensor | 1/1.3" CMOS 48MP |
| CRS Datum | EPSG:2180 (PUWG 2000) |
| Bounding Area | 320m × 240m |

</details>

<details>
<summary><strong>M03 — Zermatt Alpine Survey (Extreme Relief)</strong></summary>

| Parameter | Value |
| :--- | :--- |
| Scene Type | Mountainous · Extreme Vertical Relief |
| Video Duration | 04:02 (242 seconds) |
| Resolution | 1920 × 1080 FHD @ 30 FPS |
| CRS Datum | EPSG:2056 (Swiss LV95) |
| Bounding Area | 410m × 310m |

</details>

### Standalone Demo Assets

Pre-extracted demonstration videos and sample 3D model data are available in the [`sample data/`](<sample data>) directory, split into dedicated `video/` and `data/` subdirectories for quick evaluation:

```
sample data/
├── data/
│   └── aerosculpt_sample_model.glb              # 9.6 MB  — Reconstructed 3D textured mesh (GLB)
└── video/
    ├── aerosculpt_sample_reconstruction.mp4     # 11.0 MB — Full reconstruction walkthrough video
    ├── aerosculpt_visual_odometry.mp4           # 5.7 MB  — Visual odometry & camera tracking demo
    ├── aerosculpt_feature_matching.mp4          # 346 KB  — Cross-frame feature matching visualization
    └── aerosculpt_ray_casting.mp4              # 4.6 MB  — Ray casting & point cloud intersection demo
```

| Asset | Subdirectory | Size | Description |
| :--- | :--- | :---: | :--- |
| [`aerosculpt_sample_model.glb`](<sample data/data/aerosculpt_sample_model.glb>) | `data/` | 9.6 MB | Draco-compressed textured mesh from a complete UAV reconstruction pipeline run |
| [`aerosculpt_sample_reconstruction.mp4`](<sample data/video/aerosculpt_sample_reconstruction.mp4>) | `video/` | 11.0 MB | End-to-end reconstruction walkthrough showing input → processing → 3D output |
| [`aerosculpt_visual_odometry.mp4`](<sample data/video/aerosculpt_visual_odometry.mp4>) | `video/` | 5.7 MB | Real-time camera pose tracking with HUD telemetry overlay and RTK coordinate display |
| [`aerosculpt_feature_matching.mp4`](<sample data/video/aerosculpt_feature_matching.mp4>) | `video/` | 346 KB | Cross-frame visual feature detection and correspondence matching |
| [`aerosculpt_ray_casting.mp4`](<sample data/video/aerosculpt_ray_casting.mp4>) | `video/` | 4.6 MB | Interactive ray casting for 3D measurement and point cloud intersection |

### Additional Reconstruction Assets

| Asset | Format | Size | Description |
| :--- | :--- | :---: | :--- |
| [`01_odm_mesh.glb`](public/datasets/01_odm_mesh.glb) | GLB | 31.1 MB | Dense reconstruction mesh from orthophoto drone mapping |
| [`03_building_model.glb`](public/datasets/03_building_model.glb) | GLB | 7.8 MB | Building-scale 3D reconstruction with facade textures |
| [`03_confidence_map.glb`](public/datasets/03_confidence_map.glb) | GLB | 804 KB | Reconstruction confidence heatmap overlay model |
| [`03_fountain_mesh.ply`](public/datasets/03_fountain_mesh.ply) | PLY | 19.9 MB | High-density point cloud mesh (PLY format demo) |

---

## Performance Targets

| Metric | Target | Description |
| :---: | :---: | :--- |
| **Processing Time** | ≤ 15 min | End-to-end for a 10-minute UAV video (GPU accelerated) |
| **Spatial Accuracy** | ≤ 1 m | Georeferenced model alignment to real-world coordinates |
| **RTK/PPK Alignment** | 5–20 cm | When carrier-phase correction data is available |
| **Informative Keyframes** | ~500–600 | Selected from ~18,000 raw frames per 10-min video |
| **GSD (Ground Sampling Distance)** | 2–3 cm/px | Typical resolution at standard flight altitudes |

---

## Real-World Applications

| Domain | Application |
| :--- | :--- |
| 🛡️ **Defence & Border Surveillance** | Terrain & infrastructure mapping, route assessment in difficult-to-access areas |
| 🚨 **Disaster Response** | Rapid 3D assessment of affected zones for situational awareness and response planning |
| 🏗️ **Infrastructure & Urban Planning** | 3D inspection, measurement, and progress monitoring of roads, buildings, and terrain |
| 🌍 **Government & Strategic Mapping** | Georeferenced spatial data for planning, monitoring, and decision support |
| 📐 **Surveying & GIS** | Mesh, point cloud, and GIS-ready data from a single UAV flight |
| 🌿 **Environmental Monitoring** | Terrain, vegetation, and conservation mapping with reduced repeated field visits |
| 🔬 **Research & Academic** | Platform for 3D reconstruction, spatial analysis, and geospatial research |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18.0.0+ (for the web application)
- [Python](https://www.python.org/) 3.10+ (for the processing pipeline)
- [Git LFS](https://git-lfs.com/) (for large binary assets)
- NVIDIA GPU with CUDA 11.8+ (recommended for processing)

### 1. Clone the Repository

```bash
git clone https://github.com/dineshsugumar-01/Aerosculpt.git
cd Aerosculpt
git lfs pull
```

### 2. Install Web Application Dependencies

```bash
npm install
```

### 3. Install Processing Pipeline Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The application loads with Hot Module Replacement (HMR) enabled.

### 5. Build for Production

```bash
npm run build
```

Generates an optimized, tree-shaken static bundle in the `dist/` directory.

---

## Deployment & CI/CD

This project uses continuous deployment via **GitHub Actions**. On every push to `main`:

1. **Checkout** — Clones the repository with **Git LFS** for 3D models and video assets
2. **Setup** — Configures Node.js 20 and installs dependencies
3. **Build** — Executes `npm run build` via Vite
4. **Copy Assets** — Merges `public/` binary assets into `dist/`
5. **Deploy** — Publishes to **GitHub Pages** via `actions/deploy-pages@v4`

> [!TIP]
> The site runs continuously on GitHub Pages — no local server instances or container management required.

See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the full workflow configuration.

---

## Documentation

| Document | Description |
| :--- | :--- |
| [`README.md`](README.md) | This file — project overview, architecture, and quickstart |
| [`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) | Technical Design Document with architectural diagrams, data flows, and component specifications |
| [`TECHNICAL_DESIGN.docx`](TECHNICAL_DESIGN.docx) | Technical Design Document in Microsoft Word format (publication-styled with embedded charts) |
| [`LICENSE`](LICENSE) | MIT License |

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **MIT License** — see the [`LICENSE`](LICENSE) file for details.

---

<p align="center">
  <strong>AeroSculpt</strong> — Capture Once. Reconstruct Reality.<br/>
  <sub>Built for strategic mapping, disaster response, infrastructure inspection, and reconnaissance.</sub>
</p>

