import { SkyScapeViewer } from './viewer3d.js';

// ==========================================================================
// 20-Stage End-to-End Pipeline Data Model
// ==========================================================================
const PIPELINE_STAGES = [
  {
    step: "01",
    id: "video-ingest",
    category: "ingest",
    categoryName: "Ingestion & SLAM",
    title: "UAV Flight Video Ingestion",
    tech: "FFmpeg / PyAV / OpenCV",
    desc: "Decodes 4K/1080p continuous drone video streams into discrete timestamped frames with color space normalization.",
    input: "Raw MP4/MOV aerial video, frame rate 30/60 FPS",
    output: "Demuxed RGB frame tensors with monotonic millisecond timestamps",
    rationale: "For a 10-min flight at 30 FPS, processing all 18,000 frames is computationally prohibitive. Demuxing isolates metadata and timestamps early.",
    math: "Total Frames N = T_{flight} \\times FPS = 600s \\times 30 = 18,000"
  },
  {
    step: "02",
    id: "quality-gate",
    category: "ingest",
    categoryName: "Ingestion & SLAM",
    title: "Frame Quality Engine",
    tech: "Laplacian & Tenengrad Operators",
    desc: "Evaluates blur, sharpness, exposure clipping, compression artifacts, and visual entropy to discard degraded frames.",
    input: "Demuxed raw frames",
    output: "Quality-approved frames with sharpness scores",
    rationale: "UAV banking turns, propeller vibrations, and sudden lighting shifts create motion blur that corrupts visual feature matching.",
    math: "\\text{Sharpness Score } S = \\text{Var}(\\nabla^2 I) \\ge \\tau_{blur}"
  },
  {
    step: "03",
    id: "gnss-sync",
    category: "ingest",
    categoryName: "Ingestion & SLAM",
    title: "GNSS / RTK / PPK Time Synchronization",
    tech: "PROJ & Trajectory Matching",
    desc: "Matches visual frame acquisition timestamps with satellite positioning logs, RTK base station corrections, and IMU priors.",
    input: "NMEA / RINEX / CSV flight telemetry logs",
    output: "Time-synchronized spatial pose priors with covariance matrices",
    rationale: "Separates relative geometric optimization from absolute positioning, attaching geodetic uncertainty tags to each camera station.",
    math: "P_{camera}(t) = \\text{Interp}(GNSS, t_{frame}) \\pm \\sigma_{rtk}"
  },
  {
    step: "04",
    id: "mast3r-slam",
    category: "ingest",
    categoryName: "Ingestion & SLAM",
    title: "Aerosculpt Trajectory Front-End",
    tech: "Aerosculpt SLAM (CVPR 2025)",
    desc: "Performs fast visual tracking, relative camera pose regression, local pointmap estimation, and tracking confidence evaluation via Aerosculpt SLAM.",
    input: "Quality-approved UAV frames & optional camera intrinsics",
    output: "Continuous relative camera poses, local 3D pointmaps, tracking confidence",
    rationale: "Acts as a rapid geometric front-end, recovering camera motion and visual coverage without expensive global bundle adjustment.",
    math: "(\\hat{X}, \\hat{C}, \\hat{q}) = \\text{Aerosculpt}(I_t, I_{t-1}) \\implies T_{t, t-1} \\in SE(3)"
  },
  {
    step: "05",
    id: "keyframe-engine",
    category: "ingest",
    categoryName: "Ingestion & SLAM",
    title: "Intelligent Keyframe Engine",
    tech: "Multi-Criteria Parallax Optimization",
    desc: "Reduces 18,000 video frames down to 400-800 optimal reconstruction keyframes based on baseline, parallax, and novelty.",
    input: "Trajectory poses, sharpness scores, GNSS baseline",
    output: "Optimized reconstruction keyframe graph (~550 keyframes)",
    rationale: "A 96.8% reduction in data volume preserves survey-grade coverage while keeping global reconstruction runtime under 15 minutes.",
    math: "Score = w_1 S + w_2 \\Delta\\theta_{parallax} + w_3 D_{gnss} - w_4 R_{redundant}"
  },
  {
    step: "06",
    id: "scene-analyzer",
    category: "neural",
    categoryName: "Neural Reconstruction",
    title: "Adaptive Scene Analyzer",
    tech: "Dynamic Compute Router",
    desc: "Estimates scene difficulty (texture, parallax, occlusion, repetitive structures) and routes frames through Easy, Moderate, or Hard pipelines.",
    input: "Keyframe subset, pointmap residuals, entropy",
    output: "Reconstruction compute profile (Faster Geometry vs Normal vs Extra Refinement)",
    rationale: "Avoids spending maximum GPU compute on simple open fields while allocating dense multi-view attention to complex architecture.",
    math: "\\text{Profile} = \\arg\\max (D_{texture}, \\sigma_{reproj}, R_{occlusion})"
  },
  {
    step: "07",
    id: "semantic-yolo",
    category: "semantics",
    categoryName: "Semantics & Masking",
    title: "YOLO26-Seg & Dynamic Object Masking",
    tech: "YOLO26-Seg + SAM 2 Refinement",
    desc: "Detects 11 aerial semantic classes and masks out transient moving objects (cars, pedestrians, animals) to prevent geometry corruption.",
    input: "Keyframe RGB images",
    output: "Static aerial masks (buildings, roads, vegetation) & dynamic exclusion masks",
    rationale: "Moving vehicles and pedestrians inject catastrophic ghosting and reprojection error into bundle adjustment and dense MVS.",
    math: "M_{static} = \\neg (M_{vehicle} \\cup M_{person} \\cup M_{animal})"
  },
  {
    step: "08",
    id: "gluemap-backbone",
    category: "neural",
    categoryName: "Neural Reconstruction",
    title: "GLUEMAP Global Multi-View Reconstruction",
    tech: "MapAnything Multi-View Backbone",
    desc: "Employs MapAnything as learned metric multi-view geometry backbone inside GLUEMAP with global rotation and similarity averaging.",
    input: "Keyframes, static semantic masks, retrieval match pairs",
    output: "Global metric 3D point cloud & camera rotation graph",
    rationale: "MapAnything provides robust learned depth and matching across wide-baseline aerial views, stabilized by GLUEMAP's global averaging.",
    math: "\\min_{R_i} \\sum_{(i,j)} \\rho(R_i R_j^T - R_{ij})"
  },
  {
    step: "09",
    id: "global-sfm",
    category: "optimization",
    categoryName: "Classical Optimization",
    title: "Global SfM & Ceres Bundle Adjustment",
    tech: "COLMAP / Ceres Solver",
    desc: "Jointly refines 3D structure, camera poses, and lens distortion parameters by non-linear least squares minimization of reprojection error.",
    input: "GLUEMAP camera poses and multi-view feature correspondences",
    output: "Globally consistent sparse 3D geometry and refined camera parameters",
    rationale: "Eliminates visual drift accumulated over long flight loops and guarantees mathematical consistency across all camera rays.",
    math: "\\min_{C_k, X_j} \\sum_{k} \\sum_{j} \\| x_{kj} - \\pi(C_k, X_j) \\|^2"
  },
  {
    step: "10",
    id: "georeferencing",
    category: "geodesy",
    categoryName: "Geodesy & GIS",
    title: "GNSS / RTK Georeferencing & PROJ",
    tech: "PROJ, ECEF & Local ENU Alignment",
    desc: "Converts ellipsoidal WGS84 GPS coordinates to Earth-Centered Earth-Fixed (ECEF) and projected metric CRS using robust 3D Sim(3) alignment.",
    input: "Optimized camera centers, RTK/PPK antenna phase coordinates",
    output: "Georeferenced 3D model with true metric scale and real-world coordinates",
    rationale: "Distinguishes relative 3D shape accuracy from absolute geographic positioning on Earth's crust.",
    math: "X_{ENU} = s R X_{slam} + T, \\quad [s, R, T] \\in \\text{Sim}(3)"
  },
  {
    step: "11",
    id: "dense-mvs",
    category: "optimization",
    categoryName: "Classical Optimization",
    title: "COLMAP Dense Multi-View Stereo",
    tech: "PatchMatch MVS & Depth Fusion",
    desc: "Recovers high-resolution photometric depth and normal maps across all calibrated keyframes to generate a dense 3D point cloud.",
    input: "Calibrated keyframes, refined poses, geometric bounds",
    output: "Dense multi-million point cloud with surface normal vectors",
    rationale: "Recovers intricate building facades, roof geometry, terrain contours, and structural details beyond sparse feature points.",
    math: "\\text{Depth } d(p) = \\arg\\min_d \\text{NCC}(I_{ref}(p), I_{src}(\\pi(p, d)))"
  },
  {
    step: "12",
    id: "confidence-filter",
    category: "optimization",
    categoryName: "Classical Optimization",
    title: "Confidence & Dynamic Outlier Filtering",
    tech: "Open3D / PDAL Statistical Filtering",
    desc: "Removes low-confidence geometric noise, sky artifacts, floating points, and lingering dynamic object remnants.",
    input: "Raw dense point cloud",
    output: "Cleaned, high-density metric point cloud with surface normals",
    rationale: "Ensures surface meshes are built exclusively from repeatable, geometrically verified multi-view observations.",
    math: "\\text{Keep } p \\iff \\text{Observations}(p) \\ge 3 \\land \\sigma_{depth} < \\epsilon"
  },
  {
    step: "13",
    id: "semantic-fusion",
    category: "semantics",
    categoryName: "Semantics & Masking",
    title: "Semantic 3D Multi-View Fusion",
    tech: "Bayesian 3D Label Projection",
    desc: "Fuses 2D YOLO26-Seg masks into the 3D point cloud by back-projecting ray observations with multi-view Bayesian consensus.",
    input: "Filtered point cloud, calibrated cameras, 2D semantic masks",
    output: "Semantically labeled 3D point cloud (Building, Road, Tree, Terrain)",
    rationale: "Converts raw dumb geometry into an intelligent GIS digital twin with distinct object class metadata for each 3D point.",
    math: "P(c_k | X) \\propto \\prod_{i} P(c_k | I_i, \\pi_i(X))"
  },
  {
    step: "14",
    id: "evidence-states",
    category: "semantics",
    categoryName: "Semantics & Masking",
    title: "Evidence-Aware 3D State Machine",
    tech: "Confidence & Provenance Engine",
    desc: "Classifies each surface element into OBSERVED, RECONSTRUCTED, INFERRED, or UNKNOWN to prevent inferred surfaces being passed as measured truth.",
    input: "Multi-view ray counts, geometry visibility, reference data",
    output: "Per-vertex evidence state and uncertainty scalar",
    rationale: "Crucial for survey integrity: users must know whether a roof surface was directly seen or interpolated under tree canopies.",
    math: "\\text{State} \\in \\{ \\text{OBSERVED}, \\text{RECONSTRUCTED}, \\text{INFERRED}, \\text{UNKNOWN} \\}"
  },
  {
    step: "15",
    id: "occlusion-handling",
    category: "semantics",
    categoryName: "Semantics & Masking",
    title: "Occlusion Handling & External Reference",
    tech: "Bhuvan / Bhoonidhi / OSM Integration",
    desc: "Cross-checks occluded areas against open GIS layers (OpenStreetMap, DEMs, satellite) for contextual completeness without overwriting UAV truths.",
    input: "Occluded geometry zones, public GIS basemaps",
    output: "Contextual bounding boundaries and completeness report",
    rationale: "External data provides geographic context and sanity validation but does not silently substitute real drone observations.",
    math: "\\text{Coverage Ratio } C = \\frac{A_{observed}}{A_{flight\\_envelope}}"
  },
  {
    step: "16",
    id: "mesh-generation",
    category: "optimization",
    categoryName: "Classical Optimization",
    title: "Watertight 3D Mesh Generation",
    tech: "Screened Poisson / Open3D",
    desc: "Extracts an optimal continuous triangular mesh from oriented point normals with UV texture mapping from original high-res keyframes.",
    input: "Semantically filtered point cloud with normals",
    output: "Textured 3D GLB/OBJ mesh with semantic vertex attributes",
    rationale: "Creates lightweight 3D assets suitable for real-time WebGL rendering and engineering volume calculations.",
    math: "\\nabla^2 \\chi = \\nabla \\cdot \\vec{V}"
  },
  {
    step: "17",
    id: "gis-products",
    category: "geodesy",
    categoryName: "Geodesy & GIS",
    title: "GIS Product Generation & GDAL",
    tech: "GDAL / PROJ / GeoTIFF Engine",
    desc: "Exports standard geospatial layers including True Orthophotos, Digital Surface Models (DSM), Digital Elevation Models (DEM), and LAZ point clouds.",
    input: "Georeferenced mesh and semantic 3D cloud",
    output: "GeoTIFF rasters, GeoJSON feature vectors, ASPRS LAS 1.4",
    rationale: "Ensures 100% interoperability with ArcGIS, QGIS, Civil 3D, and municipal urban planning databases.",
    math: "\\text{CRS: EPSG:4326 / EPSG:32630 (UTM Zone 30N)}"
  },
  {
    step: "18",
    id: "accuracy-validation",
    category: "geodesy",
    categoryName: "Geodesy & GIS",
    title: "Quantitative Accuracy Validation",
    tech: "Survey Checkpoint RMSE / MAE",
    desc: "Evaluates reprojection error, scale consistency, and independent ground survey checkpoint residuals (horizontal & vertical error).",
    input: "Model coordinates & independent Ground Control Checkpoints",
    output: "Formal survey-grade accuracy & completeness audit report",
    rationale: "Reconstruction is only as good as its measured error; prevents false marketing claims of precision without checkpoint verification.",
    math: "\\text{RMSE} = \\sqrt{\\frac{1}{N} \\sum_{i=1}^N \\| X_{model, i} - X_{checkpoint, i} \\|^2}"
  },
  {
    step: "19",
    id: "isolated-workers",
    category: "ingest",
    categoryName: "Ingestion & SLAM",
    title: "Isolated Microservices Architecture",
    tech: "Docker / FastAPI / CUDA Virtual Envs",
    desc: "Decouples Aerosculpt, GLUEMAP, YOLO26-Seg, and GDAL into separate containerized worker processes to avoid PyTorch/CUDA conflicts.",
    input: "Job payloads & shared NVMe artifact volume",
    output: "Deterministic multi-stage pipeline execution",
    rationale: "Eliminates dependency collisions between conflicting research repositories and enables independent GPU scaling.",
    math: "\\text{API} \\xrightarrow{Job} \\text{Worker}_k \\xrightarrow{Artifact} \\text{Worker}_{k+1}"
  },
  {
    step: "20",
    id: "webgis-viewer",
    category: "geodesy",
    categoryName: "Geodesy & GIS",
    title: "Interactive Three.js WebGIS Interface",
    tech: "Three.js / WebGL / WebGPU Ready",
    desc: "Interactive browser-based 3D digital twin visualization with OrbitControls, visual shaders, and live metric distance/area measurement.",
    input: "Exported GLB mesh & GIS metadata",
    output: "Responsive 60 FPS real-time 3D inspection console",
    rationale: "Provides non-technical municipal planners, emergency responders, and engineers immediate interactive access without GIS desktop software.",
    math: "\\text{WebGL ACESFilmic PBR Shader Pipeline}"
  }
];

// ==========================================================================
// Runtime Simulator Calculation Data
// ==========================================================================
const BASE_STAGE_TIMES_10MIN = {
  // minutes for 10 min flight, moderate scene
  ingest: 0.8,
  semantic: 1.5,
  slam: 1.8,
  keyframe: 0.7,
  gluemap: 3.2,
  mvs: 3.5,
  mesh: 1.4,
  validation: 0.7
};

// ==========================================================================
// App Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Three.js 3D Viewer
  const viewer3D = new SkyScapeViewer('canvas-container');
  window.skyscapeViewer = viewer3D;

  // 2. Setup 3D Viewer Toolbar Handlers
  setupViewerToolbar(viewer3D);

  // 3. Setup Video Showcase Console Controller
  setupVideoConsole();

  // 4. Setup Interactive Pipeline Architecture
  renderPipelineGrid();
  setupPipelineModal();
  setupPipelineFilters();

  // 5. Setup Runtime Budget Simulator
  setupRuntimeSimulator();

  // 6. Setup Operating Modes Toggle
  setupOperatingModes();
});

// ==========================================================================
// 3D Viewer Toolbar Controls
// ==========================================================================
function setupViewerToolbar(viewer) {
  // View mode buttons
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      viewer.setViewMode(mode);
    });
  });

  // Camera preset buttons
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.dataset.preset;
      viewer.setCameraPreset(preset);
    });
  });

  // Measure tool toggle
  const measureBtn = document.getElementById('btn-measure-tool');
  const clearMeasureBtn = document.getElementById('btn-clear-measure');

  if (measureBtn) {
    measureBtn.addEventListener('click', () => {
      const isActive = measureBtn.classList.toggle('active');
      viewer.toggleMeasureTool(isActive);
      if (isActive) {
        measureBtn.innerHTML = `<span>📏 Click 2 points</span>`;
      } else {
        measureBtn.innerHTML = `<span>📏 Measure (m)</span>`;
      }
    });
  }

  // Recenter button
  const recenterBtn = document.getElementById('btn-recenter-view');
  if (recenterBtn) {
    recenterBtn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      const obliqueBtn = document.querySelector('.preset-btn[data-preset="oblique"]');
      if (obliqueBtn) obliqueBtn.classList.add('active');
      viewer.recenterCamera();
    });
  }

  if (clearMeasureBtn) {
    clearMeasureBtn.addEventListener('click', () => {
      viewer.clearMeasurements();
    });
  }
}

// ==========================================================================
// Video Showcase Console Controller
// ==========================================================================
function setupVideoConsole() {
  const tabs = document.querySelectorAll('.console-tab');
  const videoElements = document.querySelectorAll('.feed-element');
  const metaTitle = document.getElementById('console-meta-title');
  const metaDesc = document.getElementById('console-meta-desc');
  const metaCitation = document.getElementById('console-meta-citation');

  const metaData = {
    'mast3r-slam': {
      title: "Aerosculpt Real-Time SLAM Output (Live Tracking)",
      desc: "Live Aerosculpt visual SLAM output demonstrating real-time dense camera tracking, pointmap alignment, and robust local geometry recovery without offline bundle adjustment.",
      citation: "Aerosculpt SLAM Engine (Murai, Dexheimer, Davison Foundation — CVPR 2025 Highlight)"
    },
    'cvpr-yt': {
      title: "MASt3R-SLAM Full Research Video Presentation",
      desc: "Complete video presentation and oral demonstration by the Imperial College London research authors detailing 3D reconstruction priors.",
      citation: "Imperial College London Dyson Robotics Lab & CVPR 2025 Conference Proceedings"
    },
    'matching': {
      title: "Multi-View Pointmap Cross-Attention Matching",
      desc: "Visualizing pairwise dense correspondence prediction and matching confidence fields that form the geometric constraint network.",
      citation: "MASt3R Architectural Core — Pointmap Cross-Matching Engine"
    },
    'rays': {
      title: "Pointmap-to-Rays Geometry Regression",
      desc: "Converting continuous pointmaps into calibrated camera rays and dense depth geometry for camera pose optimization.",
      citation: "MASt3R-SLAM Ray Optimization & Gauss-Newton Pose Solver"
    },
    'raw-drone': {
      title: "Raw UAV Aerial Ingestion Feed (Dumbarton Castle)",
      desc: "High-resolution 1080p drone flight input captured over coastal terrain, castle fortifications, and surrounding urban infrastructure.",
      citation: "SkyScape Flight Dataset — Survey Flight Alpha (1080p / 30 FPS)"
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetFeed = tab.dataset.feed;

      // Pause all local videos
      videoElements.forEach(elem => {
        elem.classList.remove('active');
        if (elem.tagName === 'VIDEO') {
          elem.pause();
        }
      });

      // Activate selected feed
      const activeElem = document.getElementById(`feed-${targetFeed}`);
      if (activeElem) {
        activeElem.classList.add('active');
        if (activeElem.tagName === 'VIDEO') {
          activeElem.play().catch(e => console.log('Autoplay prevented:', e));
        }
      }

      // Update metadata
      if (metaData[targetFeed]) {
        metaTitle.textContent = metaData[targetFeed].title;
        metaDesc.textContent = metaData[targetFeed].desc;
        metaCitation.textContent = metaData[targetFeed].citation;
      }
    });
  });

  // Simulated live telemetry fluctuation
  setInterval(() => {
    const hudFps = document.getElementById('hud-fps');
    const hudLatency = document.getElementById('hud-latency');
    const hudPoints = document.getElementById('hud-points');
    const hudDrift = document.getElementById('hud-drift');

    if (hudFps) {
      const fps = (29.7 + Math.random() * 0.6).toFixed(1);
      hudFps.textContent = `${fps} FPS`;
    }
    if (hudLatency) {
      const latency = (22.8 + Math.random() * 2.8).toFixed(1);
      hudLatency.textContent = `${latency} ms`;
    }
    if (hudPoints) {
      const points = 12400 + Math.floor(Math.random() * 250);
      hudPoints.textContent = points.toLocaleString();
    }
    if (hudDrift) {
      const drift = (0.015 + Math.random() * 0.006).toFixed(3);
      hudDrift.textContent = `${drift} m`;
    }
  }, 1000);
}

// ==========================================================================
// 20-Stage Architecture Pipeline Grid & Modals
// ==========================================================================
function renderPipelineGrid(filterCategory = 'all') {
  const grid = document.getElementById('pipeline-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const filtered = filterCategory === 'all' 
    ? PIPELINE_STAGES 
    : PIPELINE_STAGES.filter(s => s.category === filterCategory);

  filtered.forEach(stage => {
    const card = document.createElement('div');
    card.className = 'pipeline-node-card';
    card.dataset.stageId = stage.id;

    card.innerHTML = `
      <div>
        <div class="node-header">
          <span class="node-step-num">STAGE ${stage.step}</span>
          <span class="node-badge">${stage.categoryName}</span>
        </div>
        <h3 class="node-title">${stage.title}</h3>
        <p class="node-desc">${stage.desc}</p>
      </div>
      <div class="node-footer">
        <span class="node-tech-tag">${stage.tech}</span>
        <span>Inspect Rationale ↗</span>
      </div>
    `;

    card.addEventListener('click', () => openStageModal(stage));
    grid.appendChild(card);
  });
}

function setupPipelineFilters() {
  const filterBtns = document.querySelectorAll('.cat-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.category;
      renderPipelineGrid(cat);
    });
  });
}

function setupPipelineModal() {
  const modalBackdrop = document.getElementById('pipeline-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn && modalBackdrop) {
    closeBtn.addEventListener('click', () => {
      modalBackdrop.classList.remove('open');
    });

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.remove('open');
      }
    });
  }
}

function openStageModal(stage) {
  const modalBackdrop = document.getElementById('pipeline-modal');
  const modalTitle = document.getElementById('modal-stage-title');
  const modalTech = document.getElementById('modal-stage-tech');
  const modalInput = document.getElementById('modal-stage-input');
  const modalOutput = document.getElementById('modal-stage-output');
  const modalRationale = document.getElementById('modal-stage-rationale');
  const modalMath = document.getElementById('modal-stage-math');

  if (!modalBackdrop) return;

  modalTitle.textContent = `Stage ${stage.step}: ${stage.title}`;
  modalTech.textContent = `Technology: ${stage.tech} | Layer: ${stage.categoryName}`;
  modalInput.textContent = stage.input;
  modalOutput.textContent = stage.output;
  modalRationale.textContent = stage.rationale;
  modalMath.textContent = stage.math;

  modalBackdrop.classList.add('open');
}

// ==========================================================================
// Runtime Budget Simulator
// ==========================================================================
function setupRuntimeSimulator() {
  const durationBtns = document.querySelectorAll('.sim-duration-btn');
  const sceneBtns = document.querySelectorAll('.sim-scene-btn');

  let activeDuration = 10; // minutes
  let activeSceneMultiplier = 1.0; // moderate = 1.0

  function updateBudget() {
    const durationRatio = activeDuration / 10;
    let totalMinutes = 0;

    const stages = [
      { key: 'ingest', id: 'budget-ingest', base: BASE_STAGE_TIMES_10MIN.ingest },
      { key: 'semantic', id: 'budget-semantic', base: BASE_STAGE_TIMES_10MIN.semantic },
      { key: 'slam', id: 'budget-slam', base: BASE_STAGE_TIMES_10MIN.slam },
      { key: 'keyframe', id: 'budget-keyframe', base: BASE_STAGE_TIMES_10MIN.keyframe },
      { key: 'gluemap', id: 'budget-gluemap', base: BASE_STAGE_TIMES_10MIN.gluemap },
      { key: 'mvs', id: 'budget-mvs', base: BASE_STAGE_TIMES_10MIN.mvs },
      { key: 'mesh', id: 'budget-mesh', base: BASE_STAGE_TIMES_10MIN.mesh },
      { key: 'validation', id: 'budget-validation', base: BASE_STAGE_TIMES_10MIN.validation },
    ];

    stages.forEach(stg => {
      // Scene complexity impacts MVS, GLUEMAP, and semantics most
      let stageMultiplier = activeSceneMultiplier;
      if (stg.key === 'ingest' || stg.key === 'keyframe') {
        stageMultiplier = 1.0 + (activeSceneMultiplier - 1.0) * 0.3;
      }

      const stageTime = stg.base * durationRatio * stageMultiplier;
      totalMinutes += stageTime;

      const fillElem = document.getElementById(`${stg.id}-fill`);
      const valElem = document.getElementById(`${stg.id}-val`);

      if (valElem) {
        valElem.textContent = `${stageTime.toFixed(1)} min`;
      }
      if (fillElem) {
        // Max stage scale is ~5 mins = 100%
        const pct = Math.min(100, (stageTime / 5.0) * 100);
        fillElem.style.width = `${pct}%`;
      }
    });

    // Update total
    const totalElem = document.getElementById('sim-total-display');
    const statusElem = document.getElementById('sim-total-status');
    const fallbackNotice = document.getElementById('sim-fallback-notice');

    if (totalElem) {
      totalElem.textContent = `${totalMinutes.toFixed(1)} min`;
    }

    if (statusElem) {
      if (totalMinutes <= 15.0) {
        statusElem.textContent = `TARGET MET (<15m Budget)`;
        statusElem.style.background = `rgba(16, 185, 129, 0.15)`;
        statusElem.style.color = `var(--emerald-core)`;
        statusElem.style.borderColor = `rgba(16, 185, 129, 0.3)`;
        if (fallbackNotice) fallbackNotice.style.display = 'none';
      } else {
        statusElem.textContent = `OPTIMIZATION TRIGGERED`;
        statusElem.style.background = `rgba(255, 183, 3, 0.15)`;
        statusElem.style.color = `var(--amber-core)`;
        statusElem.style.borderColor = `rgba(255, 183, 3, 0.3)`;
        if (fallbackNotice) {
          fallbackNotice.style.display = 'block';
          fallbackNotice.innerHTML = `
            <strong>Adaptive Fallback Active:</strong> Auto-pruned 15% redundant keyframes & reduced MVS window to maintain real-time survey delivery.
          `;
        }
      }
    }
  }

  durationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      durationBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDuration = parseFloat(btn.dataset.duration);
      updateBudget();
    });
  });

  sceneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sceneBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSceneMultiplier = parseFloat(btn.dataset.multiplier);
      updateBudget();
    });
  });

  // Initial calculation
  updateBudget();
}

// ==========================================================================
// Operating Modes Interactive Showcase
// ==========================================================================
function setupOperatingModes() {
  const modeToggles = document.querySelectorAll('.accuracy-mode-toggle');
  const modeCards = document.querySelectorAll('.mode-detail-card');

  modeToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      modeToggles.forEach(t => t.classList.remove('active'));
      toggle.classList.add('active');

      const mode = toggle.dataset.mode;
      modeCards.forEach(card => {
        if (card.dataset.mode === mode) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}
