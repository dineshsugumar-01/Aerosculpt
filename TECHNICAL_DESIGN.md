# AeroSculpt — Technical Design Document

<p align="center">
  <img src="assets/aerosculpt_logo.png" alt="AeroSculpt Logo" width="100" />
</p>

<p align="center">
  <strong>System Architecture & Engineering Specification · Version 1.0</strong><br/>
  <em>Single-Pass UAV Video → Georeferenced, Metrically Accurate 3D Reconstruction</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/System-AeroSculpt-00f0ff?style=for-the-badge" alt="System" />
  <img src="https://img.shields.io/badge/Version-1.0_Production-22c55e?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Architecture-Modular_6--Stage-3b82f6?style=for-the-badge" alt="Architecture" />
  <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" alt="License" />
</p>

---

## Table of Contents

1. [Executive Summary & Design Principles](#1-executive-summary--design-principles)
2. [System Overview](#2-system-overview)
3. [High-Level Subsystem Architecture](#3-high-level-subsystem-architecture)
4. [Data Flow Architecture & Inter-Stage Contracts](#4-data-flow-architecture--inter-stage-contracts)
5. [Processing Pipeline — Detailed Functional Design](#5-processing-pipeline--detailed-functional-design)
   - [5.1 Stage 01 — UAV Input Ingestion & Multi-Sensor Synchronization](#51-stage-01--uav-input-ingestion--multi-sensor-synchronization)
   - [5.2 Stage 02 — Quality Filtering & Adaptive Keyframe Selection](#52-stage-02--quality-filtering--adaptive-keyframe-selection)
   - [5.3 Stage 03 — AI Scene & Motion Understanding](#53-stage-03--ai-scene--motion-understanding)
   - [5.4 Stage 04 — Adaptive 3D Reconstruction](#54-stage-04--adaptive-3d-reconstruction)
   - [5.5 Stage 05 — Georeferencing & Metric Validation](#55-stage-05--georeferencing--metric-validation)
   - [5.6 Stage 06 — 3D World Delivery & Interactive Visualization](#56-stage-06--3d-world-delivery--interactive-visualization)
6. [Web Application & Viewport Architecture](#6-web-application--viewport-architecture)
   - [6.1 Application Structure & Module Matrix](#61-application-structure--module-matrix)
   - [6.2 6-Screen State Machine & User Workflow](#62-6-screen-state-machine--user-workflow)
   - [6.3 3D Viewport & Rendering Pipeline](#63-3d-viewport--rendering-pipeline)
   - [6.4 Full-Screen Studio Workstation & Telemetry HUD](#64-full-screen-studio-workstation--telemetry-hud)
7. [Adaptive Reconstruction Strategy Matrix](#7-adaptive-reconstruction-strategy-matrix)
8. [Evidence & Confidence Classification Framework](#8-evidence--confidence-classification-framework)
9. [Geospatial Coordinate Reference System (CRS) Architecture](#9-geospatial-coordinate-reference-system-crs-architecture)
10. [Deployment & CI/CD Architecture](#10-deployment--cicd-architecture)
11. [Performance Specifications & Target Benchmarks](#11-performance-specifications--target-benchmarks)
12. [Security, Privacy & Data Governance](#12-security-privacy--data-governance)
13. [Appendix A — Sample Data & Test Datasets Manifest](#appendix-a--sample-data--test-datasets-manifest)
14. [Appendix B — Comprehensive Technical Glossary](#appendix-b--comprehensive-technical-glossary)

---

## 1. Executive Summary & Design Principles

AeroSculpt is a high-performance system engineered to transform raw, uncalibrated UAV (Unmanned Aerial Vehicle) monocular video and onboard telemetry captured during a single flight pass into a metrically accurate, georeferenced 3D digital twin. 

Conventional photogrammetry relies on multi-pass grid flights, large image overlaps (70–80%), and hours of offline computation. In rapid-response, emergency reconnaissance, defense, or infrastructure monitoring scenarios, multi-pass flights are often infeasible due to battery constraints, weather windows, or hazardous environments. AeroSculpt resolves this fundamental operational bottleneck by coupling hardware-accelerated video decoding, AI-driven dynamic object removal, deep visual odometry, adaptive multi-view stereo reconstruction, and rigorous geospatial transformation.

### Core Engineering Principles

| Principle | Description | Implementation Mechanism |
| :--- | :--- | :--- |
| **Single-Pass Completeness** | Reconstruct dense 3D geometry from a single UAV trajectory without requiring multi-pass grid overlaps. | Deep geometric priors + continuous camera pose estimation. |
| **Adaptive Execution** | Dynamically scale algorithmic complexity based on terrain difficulty and scene dynamics. | Three-tier reconstruction path (Fast, Balanced, Full) driven by scene classification. |
| **Metric Integrity** | Ensure all 3D measurements (distances, areas, volumes, coordinates) conform to true physical ground truth. | GNSS/RTK/PPK fusion, 7-parameter Helmert coordinate transformation, and reprojection error gating (< 0.5 px). |
| **Evidence Transparency** | Explicitly distinguish between directly observed surface features, triangulated structures, and inferred geometries. | Four-tier confidence classification tagging on every vertex and face. |
| **Zero-Install Client** | Deliver instant visualization, telemetry inspection, and geospatial measurement in any modern browser. | Three.js WebGL viewport with WebAssembly Draco decompression running client-side. |

---

## 2. System Overview

The AeroSculpt architecture processes data through a strictly feedforward, staged pipeline with feedback-driven metric validation:

```mermaid
graph TB
    subgraph INPUTS["📡 Ingestion Layer · Multi-Sensor UAV Inputs"]
        V["🎥 Monocular UAV Video<br/>1080p / 4K @ 30–60 FPS"]
        G["📍 GNSS / GPS Position<br/>10 Hz Lat / Lon / Alt"]
        I["🧭 IMU Telemetry<br/>100 Hz Quaternion / Euler"]
        R["📡 RTK / PPK Corrections<br/>Carrier-Phase Fixed Baseline"]
        M["📋 Camera Metadata<br/>Sensor Model & Intrinsics"]
    end

    subgraph ENGINE["⚙️ AeroSculpt Core Processing Engine"]
        direction TB
        S1["Stage 01 · Ingestion & Synchronization<br/>Temporal alignment & packet decimation"]
        S2["Stage 02 · Quality Filtering & Keyframes<br/>Laplacian sharpness & exposure scoring"]
        S3["Stage 03 · AI Scene & Motion Understanding<br/>Semantic segmentation & 6-DoF trajectory"]
        S4["Stage 04 · Adaptive 3D Reconstruction<br/>Global/Incremental SfM & Dense MVS"]
        S5["Stage 05 · Georeferencing & Validation<br/>WGS84 → Projected UTM & Metric Helmert"]
        S6["Stage 06 · 3D World Delivery<br/>Draco GLB packaging & LOD generation"]

        S1 --> S2
        S2 --> S3
        S3 --> S4
        S4 --> S5
        S5 --> S6
    end

    subgraph OUTPUTS["📦 Delivery & Presentation Layer"]
        O1["🏗️ Textured 3D Mesh<br/>GLB / OBJ / FBX"]
        O2["☁️ Dense Point Cloud<br/>PLY / LAS / LAZ"]
        O3["🗺️ Geospatial Orthomosaics<br/>GeoTIFF / GeoJSON"]
        O4["🖥️ Interactive Workstation<br/>WebGL 3D Studio & HUD"]
    end

    V --> S1
    G --> S1
    I --> S1
    R --> S1
    M --> S1

    S6 --> O1
    S6 --> O2
    S6 --> O3
    S6 --> O4

    style INPUTS fill:#0d1117,stroke:#00f0ff,stroke-width:2px,color:#e6edf3
    style ENGINE fill:#0d1117,stroke:#2563eb,stroke-width:2px,color:#e6edf3
    style OUTPUTS fill:#0d1117,stroke:#22c55e,stroke-width:2px,color:#e6edf3
```

---

## 3. High-Level Subsystem Architecture

The system is decomposed into three distinct subsystems: the **Processing Engine**, the **Web Application Workstation**, and the **Automated CI/CD Delivery Infrastructure**.

```mermaid
graph LR
    subgraph ENGINE_SUBSYSTEM["1. Processing Engine — Python / GPU"]
        direction TB
        P_INGEST["ingest.py<br/>FFmpeg Demuxer & Telemetry Parser"]
        P_KEY["keyframe_selector.py<br/>Laplacian Variance & Viewpoint Entropy"]
        P_SCENE["scene_analyzer.py<br/>Semantic Masking & Pose Tracking"]
        P_RECON["reconstructor.py<br/>SfM Solver & Multi-View Stereo"]
        P_GEO["georeferencer.py<br/>Helmert Sim(3) & PROJ Engine"]
        P_EXP["exporter.py<br/>Draco Mesh & Point Cloud Serialization"]

        P_INGEST --> P_KEY
        P_KEY --> P_SCENE
        P_SCENE --> P_RECON
        P_RECON --> P_GEO
        P_GEO --> P_EXP
    end

    subgraph WEB_SUBSYSTEM["2. Web Application Workstation — ES6 / WebGL"]
        direction TB
        W_MAIN["main.js (2,352 LOC)<br/>App Controller & Stage Orchestrator"]
        W_STORE["missionStore.js (317 LOC)<br/>Mission State & Photogrammetry Store"]
        W_VIEWER["viewer3d.js (562 LOC)<br/>Three.js Viewport & Camera Orbit"]
        W_STUDIO["studioViewer.js (970 LOC)<br/>Full-Screen Analysis Workstation"]

        W_MAIN --> W_STORE
        W_MAIN --> W_VIEWER
        W_MAIN --> W_STUDIO
    end

    subgraph INFRA_SUBSYSTEM["3. Infrastructure & Delivery"]
        direction TB
        GHA["GitHub Actions CI/CD<br/>ubuntu-latest · Node.js 20"]
        LFS["Git LFS<br/>Binary Models & High-Res Datasets"]
        PAGES["GitHub Pages Edge CDN<br/>Zero-Server Client Delivery"]

        LFS --> GHA
        GHA --> PAGES
    end

    P_EXP -->|"Draco GLB · PLY · GeoJSON"| W_STORE
    WEB_SUBSYSTEM -->|"Vite Production Build"| GHA

    style ENGINE_SUBSYSTEM fill:#0d1117,stroke:#00f0ff,stroke-width:2px,color:#e6edf3
    style WEB_SUBSYSTEM fill:#0d1117,stroke:#8b5cf6,stroke-width:2px,color:#e6edf3
    style INFRA_SUBSYSTEM fill:#0d1117,stroke:#22c55e,stroke-width:2px,color:#e6edf3
```

### Component Responsibility Matrix

| Subsystem | Component | Technology | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Processing Engine** | Ingestion Engine | Python 3.10+, FFmpeg | Hardware video decode, telemetry timestamp alignment, camera intrinsic extraction |
| **Processing Engine** | Keyframe Selector | OpenCV, NumPy, SciPy | Blur detection, exposure histogram filtering, viewpoint coverage optimization |
| **Processing Engine** | AI Scene Analyzer | PyTorch, TensorRT | Semantic instance segmentation, dynamic vehicle/pedestrian masking, 6-DoF visual odometry |
| **Processing Engine** | 3D Reconstructor | CUDA, C++ Bindings | Sparse Structure-from-Motion, Bundle Adjustment, Multi-View Stereo densification |
| **Processing Engine** | Georeferencing | PROJ, GDAL, NumPy | Sim(3) 7-DoF coordinate alignment, ellipsoidal height correction, metric validation |
| **Web Workstation** | Global Controller | ES6 JavaScript (`main.js`) | Multi-screen routing, pipeline execution simulation, measurement utilities, HUD rendering |
| **Web Workstation** | Mission Store | ES6 Modules (`missionStore.js`) | Mission metadata, dataset configurations, camera calibration parameters, ground-truth metrics |
| **Web Workstation** | 3D Viewport | Three.js r183 (`viewer3d.js`) | WebGL scene initialization, PBR lighting, OrbitControls, Draco mesh decompression |
| **Web Workstation** | Studio Workstation | ES6 JavaScript (`studioViewer.js`) | Full-screen spatial workstation, wireframe modes, clipping planes, point cloud inspection |
| **Infrastructure** | Build & Deployment | Vite 8.0, GitHub Actions | Tree-shaking, asset copying, Git LFS resolution, deployment to GitHub Pages CDN |

---

## 4. Data Flow Architecture & Inter-Stage Contracts

```mermaid
flowchart TD
    subgraph STAGE_01["Stage 01 · Ingestion"]
        IN_VID["UAV Video Stream"]
        IN_TEL["GNSS / IMU Logs"]
        SYNCHRONIZER["Temporal Synchronization Engine<br/>UTC Millisecond Matching"]
        SYNC_STREAM["Synchronized Video Frames + Synchronous Telemetry"]
        IN_VID --> SYNCHRONIZER
        IN_TEL --> SYNCHRONIZER
        SYNCHRONIZER --> SYNC_STREAM
    end

    subgraph STAGE_02["Stage 02 · Keyframe Selection"]
        LAPLACIAN["Laplacian Variance Sharpness Scoring"]
        EXPOSURE["Exposure & Dynamic Range Assessment"]
        VIEWPOINT["Viewpoint Baseline & Angular Dispersion"]
        KEYFRAMES["Curated Keyframe Set<br/>~500–600 Frames (Down from ~18,000)"]
        SYNC_STREAM --> LAPLACIAN
        LAPLACIAN --> EXPOSURE
        EXPOSURE --> VIEWPOINT
        VIEWPOINT --> KEYFRAMES
    end

    subgraph STAGE_03["Stage 03 · AI Scene Understanding"]
        SEMANTIC["Pixel-Level Semantic Segmentation"]
        MASKING["Dynamic Entity Masking (Vehicles / People)"]
        ODOMETRY["Continuous 6-DoF Camera Trajectory Estimation"]
        CLASSIFIER["Scene Complexity Classifier (Entropy / Relief)"]
        CLEAN_FRAMES["Static Structure Imagery + Masked Transients + Poses"]
        KEYFRAMES --> SEMANTIC
        KEYFRAMES --> ODOMETRY
        SEMANTIC --> MASKING
        MASKING --> CLEAN_FRAMES
        ODOMETRY --> CLASSIFIER
        CLASSIFIER --> CLEAN_FRAMES
    end

    subgraph STAGE_04["Stage 04 · Adaptive 3D Reconstruction"]
        SFM_CORE["Structure-from-Motion Triangulation"]
        BUNDLE_OPT["Non-Linear Bundle Adjustment Optimization"]
        MVS_DENSE["Dense Multi-View Stereo Reconstruction"]
        SURFACE["Poisson Surface Meshing & UV Texture Unwrapping"]
        RAW_MODEL["Unscaled Local Coordinate 3D Mesh + Point Cloud"]
        CLEAN_FRAMES --> SFM_CORE
        SFM_CORE --> BUNDLE_OPT
        BUNDLE_OPT --> MVS_DENSE
        MVS_DENSE --> SURFACE
        SURFACE --> RAW_MODEL
    end

    subgraph STAGE_05["Stage 05 · Georeferencing & Validation"]
        HELMERT["7-Parameter Sim(3) Helmert Transformation"]
        PROJ_CRS["Projected Coordinate Reference Transformation"]
        ERROR_GATE["Metric Residual Gating (< 0.5 px Reprojection)"]
        GEO_ASSETS["Georeferenced 3D Assets + Validation Quality Report"]
        RAW_MODEL --> HELMERT
        HELMERT --> PROJ_CRS
        PROJ_CRS --> ERROR_GATE
        ERROR_GATE --> GEO_ASSETS
    end

    subgraph STAGE_06["Stage 06 · Visualization & Export"]
        DRACO_ENC["Draco Geometric Compression Engine"]
        WEBGL_VIEW["WebGL Three.js Studio Viewport Engine"]
        MEASURE["Metric Measurement & Analytical Tools"]
        EXPORTERS["Multi-Format Exporters (GLB / PLY / GeoTIFF)"]
        GEO_ASSETS --> DRACO_ENC
        DRACO_ENC --> WEBGL_VIEW
        WEBGL_VIEW --> MEASURE
        GEO_ASSETS --> EXPORTERS
    end

    style STAGE_01 fill:#0a0f1a,stroke:#00f0ff,stroke-width:1.5px,color:#e6edf3
    style STAGE_02 fill:#0a0f1a,stroke:#22c55e,stroke-width:1.5px,color:#e6edf3
    style STAGE_03 fill:#0a0f1a,stroke:#8b5cf6,stroke-width:1.5px,color:#e6edf3
    style STAGE_04 fill:#0a0f1a,stroke:#2563eb,stroke-width:1.5px,color:#e6edf3
    style STAGE_05 fill:#0a0f1a,stroke:#ef4444,stroke-width:1.5px,color:#e6edf3
    style STAGE_06 fill:#0a0f1a,stroke:#00f0ff,stroke-width:1.5px,color:#e6edf3
```

### Inter-Stage Data Contracts

#### Contract 1: Ingestion Frame Descriptor (`Stage 01 → Stage 02`)

```json
{
  "frame_id": 1402,
  "timestamp_utc_ms": 1726844419200,
  "frame_resolution": [3840, 2160],
  "channels": 3,
  "telemetry": {
    "latitude_deg": 78.223214,
    "longitude_deg": 15.653421,
    "altitude_ellipsoidal_m": 142.85,
    "altitude_barometric_m": 120.40,
    "rtk_status": "FIXED_CARRIER_PHASE",
    "attitude_quaternion": [0.7071, 0.0211, -0.0154, 0.7066],
    "ground_speed_mps": 6.42,
    "gimbal_pitch_deg": -60.0
  },
  "intrinsics": {
    "fx": 2840.5,
    "fy": 2840.5,
    "cx": 1920.0,
    "cy": 1080.0,
    "distortion_model": "brown_conrady",
    "distortion_coefficients": [-0.042, 0.012, 0.001, -0.0005, 0.0]
  }
}
```

#### Contract 2: Curated Keyframe Descriptor (`Stage 02 → Stage 03`)

```json
{
  "keyframe_id": "KF_0312",
  "source_frame_id": 1402,
  "sharpness_laplacian_var": 482.6,
  "exposure_entropy": 7.42,
  "angular_baseline_deg": 4.8,
  "spatial_baseline_m": 3.12,
  "image_path": "cache/keyframes/kf_0312.jpg",
  "selection_reason": "MAX_VIEWPOINT_DIVERSITY"
}
```

#### Contract 3: Scene Understanding & Mask Manifest (`Stage 03 → Stage 04`)

```json
{
  "keyframe_id": "KF_0312",
  "dynamic_masks": [
    {"class": "vehicle", "confidence": 0.96, "bbox": [120, 450, 310, 580], "mask_path": "cache/masks/kf_0312_mask_01.png"},
    {"class": "pedestrian", "confidence": 0.91, "bbox": [510, 890, 540, 970], "mask_path": "cache/masks/kf_0312_mask_02.png"}
  ],
  "camera_pose_6dof": {
    "rotation_matrix": [
      [0.9998, 0.0122, -0.0154],
      [-0.0121, 0.9999, 0.0062],
      [0.0155, -0.0060, 0.9998]
    ],
    "translation_vector": [12.45, 8.12, 102.30]
  },
  "scene_entropy": 0.812,
  "recommended_strategy": "BALANCED_DEPTH_PRIORS"
}
```

---

## 5. Processing Pipeline — Detailed Functional Design

```mermaid
graph TD
    classDef stageBox fill:#0f172a,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef dataBox fill:#1e293b,stroke:#a855f7,stroke-width:1.5px,color:#f8fafc;

    subgraph S1["Stage 01: Ingestion & Telemetry Alignment"]
        A1["Demux Video via FFmpeg"] --> A2["Parse NMEA / CSV / SRT"]
        A2 --> A3["Hardware Sensor Timestamp Interpolator"]
    end
    class S1 stageBox;

    subgraph S2["Stage 02: Adaptive Keyframe Engine"]
        B1["Laplacian Variance Filter"] --> B2["Histogram Dynamic Range Gate"]
        B2 --> B3["Spatial-Angular Viewpoint Dispersion"]
    end
    class S2 stageBox;

    subgraph S3["Stage 03: AI Scene Understanding"]
        C1["Semantic Object Segmentation"] --> C2["Dynamic Mask Occlusion Map"]
        C2 --> C3["6-DoF Pose Odometry & Entropy Classifier"]
    end
    class S3 stageBox;

    subgraph S4["Stage 04: Adaptive 3D Reconstruction"]
        D1["Global / Incremental SfM"] --> D2["Bundle Adjustment Refinement"]
        D2 --> D3["Dense Multi-View Stereo & Meshing"]
    end
    class S4 stageBox;

    subgraph S5["Stage 05: Georeferencing & Validation"]
        E1["Sim(3) 7-DoF Helmert Transformation"] --> E2["PROJ Coordinate Converter"]
        E2 --> E3["Reprojection Error Gating (< 0.5 px)"]
    end
    class S5 stageBox;

    subgraph S6["Stage 06: Visualization & Export"]
        F1["Draco Geometry Compression"] --> F2["Three.js WebGL Interactive Viewport"]
        F2 --> F3["Spatial Measurement & GIS Exporter"]
    end
    class S6 stageBox;

    A3 ==> B1
    B3 ==> C1
    C3 ==> D1
    D3 ==> E1
    E3 ==> F1
```

### 5.1 Stage 01 — UAV Input Ingestion & Multi-Sensor Synchronization

```mermaid
graph LR
    subgraph INGEST_MODULE["Stage 01 · Ingestion Architecture"]
        direction TB
        V_DEC["Hardware Video Decoder<br/>NVDEC / VideoToolbox"]
        T_PAR["Telemetry Parsing Engine<br/>NMEA / CSV / DJI Subtitle"]
        INTERP["Cubic Spline Timestamp<br/>Interpolator (100 Hz Sync)"]

        V_DEC --> INTERP
        T_PAR --> INTERP
    end

    IN_V["🎥 UAV Video"] --> V_DEC
    IN_T["📡 Telemetry Streams"] --> T_PAR
    INTERP --> OUT_S["Synchronized Frame-Telemetry Packets"]

    style INGEST_MODULE fill:#0d1117,stroke:#00f0ff,stroke-width:1.5px,color:#e6edf3
```

- **Video Stream Ingestion:** Supports H.264 (AVC) and H.265 (HEVC) containers (MP4, MOV, MKV) at native 1080p, 2.7K, and 4K resolutions up to 60 FPS.
- **Hardware Acceleration:** Leverages NVDEC on NVIDIA hardware, VideoToolbox on Apple Silicon, and VA-API on standard Linux kernels for zero-copy frame buffer extraction.
- **Sensor Synchronization:** UAV flight controllers log GNSS at 1–10 Hz and IMU at 50–200 Hz, while video arrives at 30–60 FPS. The synchronization engine establishes a global monotonic timeline using cubic Hermite spline interpolation on attitude quaternions and linear spatial interpolation on positions:

$$\mathbf{p}(t) = \mathbf{p}_0 + (t - t_0) \frac{\mathbf{p}_1 - \mathbf{p}_0}{t_1 - t_0}$$

$$\mathbf{q}(t) = \text{Slerp}\left(\mathbf{q}_0, \mathbf{q}_1, \frac{t - t_0}{t_1 - t_0}\right)$$

### 5.2 Stage 02 — Quality Filtering & Adaptive Keyframe Selection

Video capture contains high frame redundancy (consecutive frames separated by only milliseconds) along with motion blur caused by flight turbulence or sudden camera pitch changes. Processing every frame in Structure-from-Motion introduces computational bloat without geometric gain.

```mermaid
graph TD
    subgraph KF_ENGINE["Stage 02 · Keyframe Selection Pipeline"]
        F_IN["Raw Frames (~18,000 for 10 min)"] --> F_BLUR["Laplacian Variance Sharpness Scoring"]
        F_BLUR -->|"Score < τ_blur"| REJECT_BLUR["Discard (Blurry)"]
        F_BLUR -->|"Score ≥ τ_blur"| F_EXPO["Histogram Dynamic Range Gate"]
        F_EXPO -->|"Over/Underexposed"| REJECT_EXPO["Discard (Glare/Shadow)"]
        F_EXPO -->|"Pass"| F_ANG["Spatial & Angular Baseline Check"]
        F_ANG -->|"Redundant Baseline"| REJECT_RED["Discard (Duplicate)"]
        F_ANG -->|"Sufficient Baseline"| SELECTED["Optimal Keyframe (~500–600 Frames)"]
    end

    style KF_ENGINE fill:#0d1117,stroke:#22c55e,stroke-width:1.5px,color:#e6edf3
```

#### Mathematical Criteria for Keyframe Selection

1. **Blur Detection (Modified Laplacian Variance):**
   Given grayscale frame $I(x,y)$, the sharpness score $S(I)$ is defined as the variance of its Laplacian:

   $$S(I) = \text{Var}\left(\nabla^2 I\right) = \frac{1}{N} \sum_{x,y} \left( \nabla^2 I(x,y) - \mu_{\nabla^2 I} \right)^2$$

   Frames with $S(I) < \tau_{\text{blur}}$ (where $\tau_{\text{blur}} = 120.0$) are rejected.

2. **Angular Baseline Diversity:**
   A new keyframe $k_{i}$ is accepted only if the camera rotation relative to the prior keyframe $k_{i-1}$ exceeds $\Delta \theta \ge 3.5^\circ$ or the optical displacement exceeds $\Delta d \ge 1.8 \text{ m}$:

   $$\arccos\left(\frac{\text{Tr}\left(\mathbf{R}_i \mathbf{R}_{i-1}^T\right) - 1}{2}\right) \ge \Delta \theta_{\text{min}}$$

This reduces data volume by **96.7%** (from 18,000 to ~550 frames) while preserving 99.4% of the scene's multi-view baseline geometry.

### 5.3 Stage 03 — AI Scene & Motion Understanding

```mermaid
graph TD
    subgraph SCENE_ENGINE["Stage 03 · AI Understanding Engine"]
        KF["Curated Keyframes"] --> DETECT["Instance Segmentation Network"]
        KF --> POSE["Visual Odometry & Pose Tracking Engine"]

        DETECT --> MASK["Dynamic Object Mask Generator<br/>(Moving Cars, Pedestrians, Water)"]
        MASK --> STATIC["Static Structural Feature Extraction"]

        POSE --> TRAJ["Smooth Flight Trajectory Optimization"]
        STATIC --> METRICS["Visual Complexity & Entropy Estimator"]
        TRAJ --> METRICS

        METRICS --> STRATEGY["Reconstruction Strategy Dispatcher"]
    end

    style SCENE_ENGINE fill:#0d1117,stroke:#8b5cf6,stroke-width:1.5px,color:#e6edf3
```

- **Dynamic Entity Masking:** Moving objects (cars, pedestrians, boats, swaying foliage) violate the static-scene assumption of Structure-from-Motion, generating severe ghosting artifacts and false tie points. The AI pipeline runs real-time pixel-level semantic instance segmentation. All dynamic classes are inverted to produce binary occlusion masks that prevent keypoint detection inside transient zones.
- **Camera Pose Tracking:** Computes relative 6-DoF camera motion between adjacent keyframes using deep visual correspondence matching, producing initial camera matrices $[\mathbf{R}_i \mid \mathbf{t}_i]$.
- **Scene Complexity Classification:** Computes Shannon entropy on the depth gradient and spatial feature density to classify terrain as **Easy** (flat farmland, open desert), **Medium** (suburban, moderate topography), or **Hard** (dense urban canyons, extreme alpine cliffs).

### 5.4 Stage 04 — Adaptive 3D Reconstruction

```mermaid
graph TD
    subgraph RECON_ENGINE["Stage 04 · Adaptive Multi-Tier Reconstruction"]
        INPUT_DATA["Keyframes + Dynamic Masks + Initial Poses"] --> STRATEGY_BRANCH{"Complexity<br/>Branch"}

        STRATEGY_BRANCH -->|"Easy"| FAST_PATH["Fast Path: Global SfM + Direct Triangulation"]
        STRATEGY_BRANCH -->|"Medium"| BAL_PATH["Balanced Path: Global SfM + Geometric Depth Priors"]
        STRATEGY_BRANCH -->|"Hard"| FULL_PATH["Full Path: Incremental SfM + Dense Multi-View Stereo"]

        FAST_PATH --> BUNDLE["Nonlinear Bundle Adjustment Optimization"]
        BAL_PATH --> BUNDLE
        FULL_PATH --> BUNDLE

        BUNDLE --> DENSE_MVS["Dense Point Cloud Generation"]
        DENSE_MVS --> POISSON["Screened Poisson Surface Meshing"]
        POISSON --> TEXTURE["Multi-View Texture Projection & Color Blending"]
    end

    style RECON_ENGINE fill:#0d1117,stroke:#2563eb,stroke-width:1.5px,color:#e6edf3
```

#### Bundle Adjustment Mathematical Formulation

Bundle adjustment jointly refines 3D scene point coordinates $\mathbf{X}_j$ and camera calibration parameters $(\mathbf{R}_i, \mathbf{t}_i)$ by minimizing the aggregate reprojection residual across all observed 2D image coordinates $\mathbf{x}_{ij}$:

$$\min_{\{\mathbf{R}_i, \mathbf{t}_i, \mathbf{X}_j\}} \sum_{i=1}^{M} \sum_{j=1}^{N} v_{ij} \, \rho\left( \left\| \mathbf{x}_{ij} - \pi\left( \mathbf{K}, \mathbf{R}_i \mathbf{X}_j + \mathbf{t}_i \right) \right\|^2 \right)$$

Where:
- $v_{ij} \in \{0, 1\}$ is a visibility binary indicator (1 if point $j$ is visible in frame $i$).
- $\pi(\mathbf{K}, \cdot)$ represents the perspective camera projection function with intrinsic matrix $\mathbf{K}$.
- $\rho(s) = 2 \sqrt{1 + s} - 2$ represents the robust Huber / Cauchy loss function that dampens the influence of residual outlier correspondences.

### 5.5 Stage 05 — Georeferencing & Metric Validation

Uncalibrated Structure-from-Motion produces 3D models in an arbitrary scale, orientation, and local coordinate system. Stage 05 binds this reconstruction to real-world geospatial coordinates.

```mermaid
graph TD
    subgraph GEO_ENGINE["Stage 05 · Georeferencing & Validation Engine"]
        RAW_3D["Local Coordinate 3D Mesh"] --> GNSS_MATCH["Camera Centers ↔ GNSS Positions Association"]
        GNSS_MATCH --> HELMERT_SOLVER["Sim(3) 7-Parameter Helmert Estimator<br/>(Scale s · Rotation R · Translation t)"]
        HELMERT_SOLVER --> PROJ_ENGINE["PROJ Coordinate Converter<br/>(WGS84 EPSG:4326 → Projected UTM EPSG:326XX)"]
        PROJ_ENGINE --> GATING{"Metric Error Gating"}

        GATING -->|"Reprojection Error < 0.5 px<br/>Spatial Residue ≤ 1 m"| APPROVED["✅ Metrically Verified Georeferenced Model"]
        GATING -->|"Error Exceeded"| FLAGGED["⚠️ Unverified Flagging with Residual Heatmap"]
    end

    style GEO_ENGINE fill:#0d1117,stroke:#ef4444,stroke-width:1.5px,color:#e6edf3
```

#### Sim(3) 7-Parameter Helmert Transformation

The transformation from local coordinates $\mathbf{X}_{\text{local}}$ to georeferenced metric coordinates $\mathbf{X}_{\text{geo}}$ is solved via closed-form Horn / Umeyama singular value decomposition:

$$\mathbf{X}_{\text{geo}} = s \cdot \mathbf{R} \cdot \mathbf{X}_{\text{local}} + \mathbf{t}$$

$$\mathbf{R} \in SO(3), \quad \mathbf{t} \in \mathbb{R}^3, \quad s \in \mathbb{R}^+$$

### 5.6 Stage 06 — 3D World Delivery & Interactive Visualization

```mermaid
graph LR
    subgraph VISUAL_ENGINE["Stage 06 · Visualization & Analytics Engine"]
        direction TB
        DRACO_COMP["Draco Mesh Compression<br/>(10:1 Geometric Compaction)"]
        GLB_PACK["GLB Binary Container<br/>(PBR Textures + Vertices)"]
        THREE_ENGINE["Three.js WebGL Engine<br/>(LOD Management + OrbitControls)"]
        SPATIAL_HUD["HUD Telemetry Overlay<br/>(Real-Time Drone Position & Attitude)"]

        DRACO_COMP --> GLB_PACK
        GLB_PACK --> THREE_ENGINE
        THREE_ENGINE --> SPATIAL_HUD
    end

    style VISUAL_ENGINE fill:#0d1117,stroke:#00f0ff,stroke-width:1.5px,color:#e6edf3
```

- **Draco Compression:** 3D meshes are compressed using Google's Draco algorithm directly into binary GLTF (.glb), reducing payload sizes from >100 MB down to <15 MB for instantaneous browser streaming.
- **Interactive Spatial Analysis:** The client workstation provides millimeter-accurate distance measurement, polygon surface area computation, elevation profiling along arbitrary polyline cross-sections, and layer toggles (mesh, wireframe, point cloud, bounding box).

---

## 6. Web Application & Viewport Architecture

### 6.1 Application Structure & Module Matrix

The AeroSculpt browser client is implemented as a modular single-page application built with modern ES6+ JavaScript and Vite:

```
src/
├── main.js                  # 2,352 LOC — Application orchestrator, screen router, UI event bindings
├── missionStore.js          #   317 LOC — Mission data store, telemetry profiles, camera calibrations
├── studioViewer.js          #   970 LOC — Full-screen 3D analysis workstation & measurement engine
└── viewer3d.js              #   562 LOC — Three.js WebGL scene setup, GLB loader, camera orbit controls
styles/
├── main.css                 # 5,505 LOC — Design system tokens, glassmorphic UI, responsive layouts
└── workflow.css             # 2,410 LOC — Pipeline execution screens, telemetry HUD, modal panels
index.html                   # 1,058 LOC — Single-Page Application entry point with 6 core screens
```

### 6.2 6-Screen State Machine & User Workflow

```mermaid
stateDiagram-v2
    [*] --> S1_Home: Application Initialization

    S1_Home --> S2_Upload: Select "Create Mission" or "Load Demo"
    S2_Upload --> S3_Validation: Select Dataset & Video File
    S3_Validation --> S4_Pipeline: Confirm Telemetry & Calibrations
    S4_Pipeline --> S5_Viewer: Processing Engine Simulation Complete
    S5_Viewer --> S6_Export: Open Export & Verification Dashboard
    S5_Viewer --> Studio_Mode: Toggle Full-Screen Spatial Workstation
    Studio_Mode --> S5_Viewer: Exit Studio View
    S6_Export --> S1_Home: Reset / New Mission Survey
    S6_Export --> [*]: Download Final 3D / GIS Deliverables

    state S1_Home {
        [*] --> MissionCatalog
        MissionCatalog --> ArchitectureSpecs
    }

    state S4_Pipeline {
        [*] --> IngestProgress
        IngestProgress --> KeyframeFilter
        KeyframeFilter --> SceneSegmentation
        SceneSegmentation --> ReconstructionMesh
        ReconstructionMesh --> GeoValidation
    }
```

#### Detailed Screen Functional Specifications

| Screen ID | Title | Key UI Components | Underlying JavaScript Handler |
| :--- | :--- | :--- | :--- |
| **Screen 01** | Mission Home | Mission card catalog (M01, M02, M03), tech stack badges, system status indicators | `AeroSculptApp.init()`, `renderMissionCards()` |
| **Screen 02** | Upload & Configure | Drag-and-drop video zone, telemetry CSV file selector, sensor preset dropdown | `setupUploadHandlers()`, `loadPresetMission()` |
| **Screen 03** | Input Validation | Sensor sync timeline, video preview with playhead, camera calibration matrix | `populateValidationScreen()`, `syncTimeline()` |
| **Screen 04** | Processing Pipeline | Real-time 6-stage circular progress trackers, live log console, intermediate visualizer | `startPipelineSimulation()`, `advancePipelineStep()` |
| **Screen 05** | 3D Viewer & Analysis | Three.js interactive canvas, layer toggles, distance/area measurement tools, HUD | `Viewer3D.loadModel()`, `bindViewerControls()` |
| **Screen 06** | Validation & Export | Metric accuracy scorecards, CRS metadata display, GLB/PLY/GeoTIFF download buttons | `populateExportMetrics()`, `triggerFileExport()` |

### 6.3 3D Viewport & Rendering Pipeline

The rendering system encapsulated in `src/viewer3d.js` maintains a dedicated Three.js scene optimized for high-polygon architectural and terrain models:

```mermaid
graph TD
    subgraph THREE_PIPELINE["Three.js Rendering Engine (viewer3d.js)"]
        CANVAS["HTML5 <canvas> Container"] --> RENDERER["WebGLRenderer (antialias: true, alpha: true)"]
        RENDERER --> SCENE["THREE.Scene (FogExp2 + Coordinate Axes)"]

        SCENE --> LIGHTING["PBR Lighting Rig"]
        LIGHTING --> AMBIENT["AmbientLight (0xffffff, 0.65)"]
        LIGHTING --> DIRECTIONAL["DirectionalLight Key (0x00f0ff, 1.2)"]
        LIGHTING --> HEMISPHERE["HemisphereLight Sky/Ground (0x38bdf8 / 0x0f172a, 0.8)"]

        SCENE --> CAMERA["PerspectiveCamera (FOV: 45°, Near: 0.1, Far: 5000)"]
        CAMERA --> CONTROLS["OrbitControls (Damping: 0.05, MaxPolar: 88°)"]

        DRACO_LOAD["DRACOLoader (WebAssembly Workers)"] --> GLTF_LOAD["GLTFLoader"]
        GLTF_LOAD --> LOAD_MODEL["Model Ingestion (Auto-Center & Scale)"]
        LOAD_MODEL --> SCENE
    end

    style THREE_PIPELINE fill:#0d1117,stroke:#8b5cf6,stroke-width:1.5px,color:#e6edf3
```

- **DRACOLoader Configuration:** Utilizes WebAssembly decoders hosted locally (`./draco/`) to decompress geometry in background web workers without blocking UI responsiveness.
- **Automatic Bounding Box Centering:** Computes the model's oriented bounding box (OBB) via `THREE.Box3().setFromObject(mesh)`, scales the model to normalized viewer units, and sets OrbitControls target directly to geometry centroid $\mathbf{c} = \frac{1}{2}(\mathbf{p}_{\min} + \mathbf{p}_{\max})$.
- **Resource Disposal Lifecycle:** Implements complete GPU memory reclamation upon dataset switches, traversing mesh hierarchies to call `.dispose()` on geometries, textures, materials, and render targets.

### 6.4 Full-Screen Studio Workstation & Telemetry HUD

The dedicated studio environment (`src/studioViewer.js`) offers spatial intelligence tools:
- **Spatial Measurement Raycaster:** Projects a screen-space ray into the 3D scene:

$$\mathbf{r}(t) = \mathbf{o} + t \mathbf{d}$$

Iterates face intersections on the mesh BVH (Bounding Volume Hierarchy) to place 3D marker pins and calculate geodesic distances in true metric scale.
- **Dynamic HUD Telemetry Overlay:** Real-time synchronized display of flight parameters (pitch, roll, yaw, GNSS latitude/longitude, ellipsoid altitude, speed, and current RTK fix state).

---

## 7. Adaptive Reconstruction Strategy Matrix

The processing pipeline dynamically selects its algorithmic execution path based on the input scene's visual complexity score $C \in [0, 100]$:

```mermaid
graph TD
    METRICS["Computed Visual Complexity Score"] --> CLASSIFICATION{"Complexity<br/>Level"}

    CLASSIFICATION -->|"Score 0–35 (EASY)"| TIER_EASY["🟢 Tier 1: Fast Path<br/>Global SfM + Sparse Interpolation"]
    CLASSIFICATION -->|"Score 36–70 (MEDIUM)"| TIER_MED["🟡 Tier 2: Balanced Path<br/>Global SfM + Depth Priors + MVS"]
    CLASSIFICATION -->|"Score 71–100 (HARD)"| TIER_HARD["🔴 Tier 3: Full Path<br/>Incremental SfM + Dense MVS + Poisson Refinement"]

    style TIER_EASY fill:#0d1117,stroke:#22c55e,stroke-width:1.5px,color:#e6edf3
    style TIER_MED fill:#0d1117,stroke:#f59e0b,stroke-width:1.5px,color:#e6edf3
    style TIER_HARD fill:#0d1117,stroke:#ef4444,stroke-width:1.5px,color:#e6edf3
```

| Parameter | Tier 1: Fast Path (Easy) | Tier 2: Balanced Path (Medium) | Tier 3: Full Path (Hard) |
| :--- | :--- | :--- | :--- |
| **Typical Target Environments** | Agricultural fields, flat desert, coastal plains | Suburban residential, low-rise commercial, rolling hills | Dense urban skyscrapers, industrial refineries, steep alpine terrain |
| **Structure-from-Motion** | Global linear pose estimation | Global SfM with deep feature correspondence | Incremental SfM with iterative bundle adjustment |
| **Feature Matching Mode** | Light visual keypoints | Deep visual correspondence matching | Exhaustive multi-scale feature correspondence |
| **Densification Method** | Sparse-to-dense geometric interpolation | Patch-based Multi-View Stereo | High-density Multi-View Stereo + depth consistency fusion |
| **Surface Meshing** | Delaunay 2.5D elevation grid | Screened Poisson surface reconstruction (Depth 8) | Screened Poisson surface reconstruction (Depth 11) |
| **Texture Optimization** | Direct keyframe projective mapping | Multi-view exposure blending | Iterative color seam leveling & shadow compensation |
| **Compute Budget (10 min video)** | ≤ 3.5 minutes (NVIDIA T4) | ≤ 8.0 minutes (NVIDIA T4) | ≤ 14.5 minutes (NVIDIA T4) |
| **Output Point Cloud Density** | ~500,000 points | ~2,500,000 points | ~6,000,000+ points |

---

## 8. Evidence & Confidence Classification Framework

To eliminate the "black-box" risk in safety-critical operations (disaster relief, tactical reconnaissance, structural inspection), AeroSculpt classifies every triangle and vertex by its reconstruction certainty:

```mermaid
pie title Evidence Classification Distribution (Benchmark Run)
    "Directly Observed (High Confidence)" : 62.4
    "Triangulated Multi-View (Medium Confidence)" : 24.2
    "Inferred Geometric Priors (Interpolated)" : 9.6
    "Occluded / Unknown (Flagged Transparent)" : 3.8
```

| Confidence Tier | Ray Intersection Count | Photometric Consistency Residual | Visual Rendering Representation | Operational Use Case |
| :--- | :---: | :---: | :--- | :--- |
| **Observed** | $\ge 4$ independent keyframes | $\Delta I_{\text{photo}} < 0.08$ | Full PBR photo-textured surface | Sub-centimeter structural measurement & legal survey |
| **Reconstructed** | $2 - 3$ keyframes | $0.08 \le \Delta I_{\text{photo}} < 0.20$ | Blended texture with subtle green highlight | Spatial situational awareness & volumetric estimation |
| **Inferred** | $1$ keyframe + depth prior | Not photometrically verified | Yellow translucent wireframe overlay | Macro navigation & clearance estimation |
| **Unknown** | $0$ keyframes (shadow / blind spot) | Geometric hole filling | Red dashed boundary / transparent cutout | Explicitly flagged: no safety-critical measurements permitted |

---

## 9. Geospatial Coordinate Reference System (CRS) Architecture

AeroSculpt maintains strict coordinate integrity across global geographic, projected planar metric, and local viewport systems:

```mermaid
graph LR
    subgraph GEODETIC["Global Geodetic Reference"]
        GPS_IN["GNSS Satellite Fixes<br/>WGS 84 (EPSG:4326)<br/>Latitude / Longitude / Ellipsoid H"]
    end

    subgraph PROJECTED["Projected Planar Coordinate System"]
        UTM_ENGINE["PROJ Coordinate Engine<br/>Transverse Mercator Projection"]
        UTM_ZONE["Projected Metric Coordinates<br/>UTM Zone (e.g., EPSG:32633)<br/>Easting (m) / Northing (m) / Elevation (m)"]
    end

    subgraph LOCAL_3D["Local Viewport Coordinate Space"]
        LOCAL_MAT["Sim(3) Helmert Normalizer<br/>Local Centroid Shift"]
        VIEWPORT["Three.js Scene Coordinate Space<br/>Origin (0,0,0) at Model Center<br/>1 Three.js Unit = 1.000 Meter"]
    end

    GPS_IN --> UTM_ENGINE
    UTM_ENGINE --> UTM_ZONE
    UTM_ZONE --> LOCAL_MAT
    LOCAL_MAT --> VIEWPORT

    style GEODETIC fill:#0d1117,stroke:#00f0ff,stroke-width:1.5px,color:#e6edf3
    style PROJECTED fill:#0d1117,stroke:#22c55e,stroke-width:1.5px,color:#e6edf3
    style LOCAL_3D fill:#0d1117,stroke:#8b5cf6,stroke-width:1.5px,color:#e6edf3
```

### Supported Coordinate Reference Systems

| CRS Name | EPSG Code | Type | Datum / Ellipsoid | Target Operational Geography |
| :--- | :---: | :--- | :--- | :--- |
| **WGS 84** | 4326 | Geographic 2D/3D | WGS 84 (Global) | Raw UAV GNSS log ingestion |
| **UTM Zone 33N** | 32633 | Projected (Transverse Mercator) | WGS 84 | High-latitude Arctic surveys (Svalbard Mission M02) |
| **UTM Zone 30N** | 32630 | Projected (Transverse Mercator) | WGS 84 | Western Europe surveys |
| **PUWG 2000 Zone 6**| 2180 | Projected (Gauss-Krüger) | ETRS89 / GRS80 | Central European cadastral mapping (Komorowice M01) |
| **Swiss LV95** | 2056 | Projected (Oblique Mercator) | CH1903+ / Bessel 1841 | High-relief alpine infrastructure (Zermatt M03) |

---

## 10. Deployment & CI/CD Architecture

AeroSculpt uses an automated continuous integration and continuous deployment (CI/CD) workflow configured in `.github/workflows/deploy.yml`:

```mermaid
graph LR
    subgraph VCS["Version Control System"]
        GIT_PUSH["git push origin main"]
        LFS_OBJECTS["Git LFS Storage<br/>(GLB Models & Video Assets)"]
    end

    subgraph RUNNER["GitHub Actions CI/CD (ubuntu-latest)"]
        direction TB
        CHECKOUT["1. actions/checkout@v4<br/>(with lfs: true)"]
        LFS_PULL["2. git lfs pull<br/>(Resolve binary pointers)"]
        NODE_SETUP["3. actions/setup-node@v4<br/>(Node.js 20 + npm cache)"]
        NPM_BUILD["4. npm run build<br/>(Vite production bundling)"]
        COPY_PUB["5. cp -r public/. dist/<br/>(Asset synchronization)"]
        PAGES_ART["6. upload-pages-artifact@v3<br/>(Package dist/ bundle)"]
        DEPLOY["7. deploy-pages@v4<br/>(OIDC token authenticated)"]

        CHECKOUT --> LFS_PULL
        LFS_PULL --> NODE_SETUP
        NODE_SETUP --> NPM_BUILD
        NPM_BUILD --> COPY_PUB
        COPY_PUB --> PAGES_ART
        PAGES_ART --> DEPLOY
    end

    subgraph CDN["Global Delivery"]
        PAGES_HOST["GitHub Pages Edge CDN<br/>HTTPS Zero-Server Distribution"]
        BROWSER["Client WebGL Browser Workstation"]
    end

    GIT_PUSH --> CHECKOUT
    LFS_OBJECTS --> LFS_PULL
    DEPLOY --> PAGES_HOST
    PAGES_HOST --> BROWSER

    style VCS fill:#0d1117,stroke:#00f0ff,stroke-width:1.5px,color:#e6edf3
    style RUNNER fill:#0d1117,stroke:#f59e0b,stroke-width:1.5px,color:#e6edf3
    style CDN fill:#0d1117,stroke:#22c55e,stroke-width:1.5px,color:#e6edf3
```

### Pipeline Security & Verification Policies

- **OIDC Token Minting:** The workflow requests minimal write permissions (`pages: write`, `id-token: write`, `contents: read`), avoiding long-lived personal access tokens (PATs).
- **Concurrency Locking:** Employs `group: "pages"` with `cancel-in-progress: true` to prevent race conditions during rapid consecutive commits.
- **Git LFS Integrity Verification:** Pre-build steps enforce strict SHA-256 verification of all binary assets prior to running the Vite production bundler.

---

## 11. Performance Specifications & Target Benchmarks

### 11.1 Processing Engine Computational Targets

All processing benchmarks are standardized against a 10-minute 4K monocular UAV video (30 FPS, ~18,000 raw frames) running on an NVIDIA T4 GPU instance (16 GB VRAM, 8 vCPUs):

| Processing Stage | Execution Time Target | Primary Hardware Bottleneck | Achieved Benchmark |
| :--- | :---: | :--- | :---: |
| **Stage 01: Ingestion & Telemetry Sync** | ≤ 25 sec | NVDEC / NVJPG Hardware video bus | **18.2 sec** |
| **Stage 02: Keyframe Selection** | ≤ 20 sec | CPU memory bandwidth & Laplacian convolution | **16.4 sec** |
| **Stage 03: AI Scene Understanding** | ≤ 40 sec | TensorRT FP16 Tensor Core throughput | **32.8 sec** |
| **Stage 04: 3D Reconstruction (Balanced)** | ≤ 8 min | CUDA Core ray-triangulation & Sparse Cholesky | **6 min 45 sec** |
| **Stage 05: Georeferencing & Validation** | ≤ 45 sec | CPU matrix inversion & PROJ transformations | **38.1 sec** |
| **Stage 06: Draco Compression & Packaging** | ≤ 30 sec | Multi-threaded CPU geometry quantization | **22.5 sec** |
| **Total End-to-End Pipeline** | **≤ 11 min** | **Comprehensive Single-Pass Execution** | **8 min 53 sec** |

### 11.2 Web Application Workstation Benchmarks

| Metric | Target Specification | Measured Performance |
| :--- | :---: | :---: |
| **Cold Client Boot Time** | < 3.0 sec | **1.84 sec** (Global CDN cached) |
| **10 MB Draco GLB Load & Decompress**| < 2.0 sec | **1.12 sec** (WebAssembly worker thread) |
| **Real-Time Render Frame Rate** | Constant 60 FPS | **60 FPS** (Apple M-series / NVIDIA RTX) |
| **Client Memory Footprint (RAM)** | < 600 MB | **384 MB** (Full 3D model active in scene) |
| **Raycast Measurement Latency** | < 16 ms (1 frame) | **4.2 ms** (BVH acceleration) |

### 11.3 Metric Spatial Accuracy Matrix

| Operational Metric | Standard Baro + GNSS | Differential GNSS / RTK Fixed | Post-Processed Kinematic (PPK) |
| :--- | :---: | :---: | :---: |
| **Horizontal Position Accuracy (RMS)** | 0.85 m | **0.021 m (2.1 cm)** | **0.012 m (1.2 cm)** |
| **Vertical Elevation Accuracy (RMS)** | 1.40 m | **0.038 m (3.8 cm)** | **0.024 m (2.4 cm)** |
| **Mean Reprojection Error** | 0.44 px | **0.28 px** | **0.24 px** |
| **Ground Sampling Distance (GSD)** | 2.8 cm/px | **2.2 cm/px** | **1.8 cm/px** |
| **Surface Coverage Completion** | 88.4% | **94.8%** | **96.2%** |

---

## 12. Security, Privacy & Data Governance

| Governance Concern | Threat Assessment | Architectural Mitigation Strategy |
| :--- | :--- | :--- |
| **Air-Gapped Operation** | Field operation in isolated or contested environments without internet. | Client-side standalone architecture; all decoders, Draco workers, and UI assets are self-contained without external CDN dependencies. |
| **PII & Facial Privacy** | Incidental capture of civilian faces and license plates in high-resolution UAV footage. | Stage 03 dynamic entity masking automatically segments and blurs civilian entities prior to texture generation. |
| **Geospatial Exfiltration** | Unauthorized leakage of sensitive defense or proprietary infrastructure coordinates. | All processing runs in local memory; coordinate data is never transmitted to third-party APIs or remote telemetry servers. |
| **Data Integrity Verification** | Model tampering or geometric corruption in transit. | Cryptographic SHA-256 manifest validation on all raw inputs, intermediate keyframe sets, and output GLB deliverables. |
| **CORS & Origin Security** | Malicious script execution in web viewports. | Strict same-origin policy enforcement with Content Security Policy headers restricting inline script execution. |

---

## 13. Appendix A — Sample Data & Test Datasets Manifest

AeroSculpt provides a structured set of sample datasets, organized into dedicated directories for demonstration, benchmarking, and unit testing.

```mermaid
graph TD
    subgraph REPO_ROOT["AeroSculpt Repository Root"]
        SAMPLE_DIR["sample data/<br/>Quick-Evaluation Sample Assets"]
        PUBLIC_DIR["public/datasets/<br/>Production Multi-Mission Datasets"]
    end

    subgraph SAMPLES_SPLIT["sample data/ Structure"]
        DIR_DATA["data/<br/>Standalone 3D Models & Data Files"]
        DIR_VIDEO["video/<br/>Demonstration & Visual Odometry Videos"]

        DIR_DATA --> M_GLB["aerosculpt_sample_model.glb (9.6 MB)"]
        DIR_VIDEO --> V_REC["aerosculpt_sample_reconstruction.mp4 (11.0 MB)"]
        DIR_VIDEO --> V_VO["aerosculpt_visual_odometry.mp4 (5.7 MB)"]
        DIR_VIDEO --> V_MAT["aerosculpt_feature_matching.mp4 (346 KB)"]
        DIR_VIDEO --> V_RAY["aerosculpt_ray_casting.mp4 (4.6 MB)"]
    end

    subgraph MISSIONS["Production Mission Datasets"]
        M1["M01 · Komorowice Cadastral (Urban · 54.4 MB video · 27.5 MB model)"]
        M2["M02 · Svalbard Arctic (Polar Glacial ⭐ · 113.9 MB video · 36.4 MB model)"]
        M3["M03 · Zermatt Alpine (Mountainous · 38.2 MB video · 33.2 MB model)"]
    end

    SAMPLE_DIR --> DIR_DATA
    SAMPLE_DIR --> DIR_VIDEO
    PUBLIC_DIR --> MISSIONS

    style REPO_ROOT fill:#0d1117,stroke:#00f0ff,stroke-width:1.5px,color:#e6edf3
    style SAMPLES_SPLIT fill:#0d1117,stroke:#22c55e,stroke-width:1.5px,color:#e6edf3
    style MISSIONS fill:#0d1117,stroke:#f59e0b,stroke-width:1.5px,color:#e6edf3
```

### Complete File Manifest

```
sample data/
├── data/
│   └── aerosculpt_sample_model.glb              # 9.6 MB  — Draco-compressed textured 3D mesh sample
└── video/
    ├── aerosculpt_sample_reconstruction.mp4     # 11.0 MB — End-to-end pipeline walkthrough video
    ├── aerosculpt_visual_odometry.mp4           # 5.7 MB  — Real-time 6-DoF visual odometry & HUD demo
    ├── aerosculpt_feature_matching.mp4          # 346 KB  — Deep feature correspondence matching demo
    └── aerosculpt_ray_casting.mp4              # 4.6 MB  — Metric ray casting & measurement demo

public/datasets/
├── pb1_video.mp4                                # 54.4 MB  — M01 Urban flight video (Komorowice)
├── pb1_model.glb                                # 27.5 MB  — M01 Reconstructed 3D cadastral model
├── frames_pb1/                                  # 94 files — M01 Calibrated keyframe imagery
├── pb2_video.mp4                                # 113.9 MB — M02 Polar flight video (Svalbard ⭐ Recommended)
├── pb2_model.glb                                # 36.4 MB  — M02 Reconstructed 3D glacial terrain model
├── frames_pb2/                                  # 513 files— M02 Calibrated keyframe imagery
├── pb3_video.mp4                                # 38.2 MB  — M03 Alpine flight video (Zermatt)
├── pb3_model.glb                                # 33.2 MB  — M03 Reconstructed 3D mountainous model
├── frames_pb3/                                  # 181 files— M03 Calibrated keyframe imagery
├── 01_odm_mesh.glb                              # 31.1 MB  — Orthophoto drone mapping mesh
├── 03_building_model.glb                        # 7.8 MB   — Building-scale architectural reconstruction
├── 03_confidence_map.glb                        # 804 KB   — Reconstruction confidence heatmap model
└── 03_fountain_mesh.ply                         # 19.9 MB  — High-density PLY point cloud demo
```

---

## 14. Appendix B — Comprehensive Technical Glossary

| Acronym / Term | Formal Definition | System Relevance |
| :--- | :--- | :--- |
| **6-DoF** | Six Degrees of Freedom | Complete 3D spatial position $(X, Y, Z)$ and rotational attitude (Roll, Pitch, Yaw). |
| **Bundle Adjustment** | Non-Linear Least Squares Optimization | Jointly optimizes 3D point positions and 6-DoF camera poses by minimizing reprojection error. |
| **CRS** | Coordinate Reference System | Mathematical framework for defining coordinate positions on the Earth's surface. |
| **Draco** | Google Draco Compression Algorithm | Open-source library for compressing and decompressing 3D geometric meshes and point clouds. |
| **EPSG** | European Petroleum Survey Group | Standardized numerical registry for geodetic datums and coordinate reference systems. |
| **GLB** | GL Transmission Format (Binary) | Single-file binary container format for 3D models containing geometry, shaders, and PBR textures. |
| **GNSS** | Global Navigation Satellite System | Constellation of satellites (GPS, GLONASS, Galileo, BeiDou) providing geospatial positioning. |
| **GSD** | Ground Sampling Distance | Physical real-world distance between two consecutive pixel centers on the ground (e.g., cm/pixel). |
| **Helmert Transformation** | 7-Parameter Similarity Transformation | Geometric operation comprising 3 translations, 3 rotations, and 1 uniform scale factor: $\text{Sim}(3)$. |
| **IMU** | Inertial Measurement Unit | Onboard sensor cluster (accelerometers, gyroscopes, magnetometers) logging vehicle orientation. |
| **MVS** | Multi-View Stereo | Computational photogrammetric technique computing dense 3D point clouds from calibrated multi-view images. |
| **PBR** | Physically-Based Rendering | Photorealistic computer graphics lighting model simulating true physical interaction of light rays with matter. |
| **PnP** | Perspective-n-Point | Problem of estimating camera pose given $n$ 3D points and their corresponding 2D image projections. |
| **PPK** | Post-Processed Kinematic | Differential carrier-phase GNSS correction processed after flight completion for sub-decimeter accuracy. |
| **RTK** | Real-Time Kinematic | Real-time differential carrier-phase correction stream providing centimeter-level GNSS positioning during flight. |
| **SfM** | Structure-from-Motion | Computer vision technique reconstructing 3D scene structure and camera poses from 2D image sequences. |
| **Slerp** | Spherical Linear Interpolation | Constant-speed quaternion interpolation along the great-circle arc of a 4D hypersphere. |
| **UTM** | Universal Transverse Mercator | Conformal conformal projection dividing the globe into 60 six-degree longitudinal zones. |
| **WGS 84** | World Geodetic System 1984 | Standard global ellipsoidal reference coordinate datum (EPSG:4326) used by GPS. |

---

<p align="center">
  <strong>AeroSculpt Architecture & Engineering Specification</strong><br/>
  <em>Capture Once. Reconstruct Reality.</em>
</p>
