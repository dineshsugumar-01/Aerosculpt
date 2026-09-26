// AeroSculpt NTRO Main Application Controller v3.0
// Landing Page Home + Automated Tab-by-Tab Tour + Authentic NTRO Emblem

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MISSIONS, PIPELINE_STAGES, MissionStore } from './missionStore.js';

class AeroSculptApp {
  constructor() {
    this.store = new MissionStore('pb2'); // Default to pb2 (Svalbard Arctic Reconnaissance)
    this.currentStep = 1;
    this.viewer = null;
    this.processingTimer = null;

    // Automated Tour State
    this.isTourRunning = false;
    this.tourStep = 1;
    this.tourCountdownTimer = null;
    this.tourRemainingSec = 0;
    this.tourPaused = false;

    // 3D Measurement & Inspection State
    this.measureActive = false;
    this.measurePoints = [];
    this.measureLine = null;
    this.measureMarkers = [];

    this.init();
  }

  init() {
    this.bindLandingEvents();
    this.bindMissionModal();
    this.bindSidebarNav();
    this.bindWorkflowNavigation();
    this.bindTourControls();
    this.bind3DViewerControls();
    this.bindExportActions();
    this.bindDocsModal();

    // Subscribe to mission store
    this.store.subscribe((state) => {
      this.hydrateMissionData(state.mission);
    });

    // Initial hydration
    this.hydrateMissionData(this.store.getMission());
    this.showLandingPage();
  }

  // ==========================================================================
  // 1. Landing Page Navigation
  // ==========================================================================
  showLandingPage() {
    this.stopAutomatedTour();
    document.getElementById('view-landing')?.classList.add('active');
    document.getElementById('view-workflow')?.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showWorkflowView(initialStep = 1) {
    document.getElementById('view-landing')?.classList.remove('active');
    document.getElementById('view-workflow')?.classList.add('active');
    this.goToStep(initialStep, false);
  }

  bindLandingEvents() {
    const btnHeroDemo = document.getElementById('btn-hero-demo');
    const btnHeroSelect = document.getElementById('btn-hero-select');

    // Click "Load Demo Mission" -> directly launches automated tour on PB2
    btnHeroDemo?.addEventListener('click', () => {
      this.startAutomatedDemoTour('pb2');
    });

    // Click "Select Mission" -> opens modal to choose PB1, PB2, or PB3
    btnHeroSelect?.addEventListener('click', () => {
      this.openMissionModal();
    });

    // Header Home buttons
    document.getElementById('btn-header-home')?.addEventListener('click', () => {
      this.showLandingPage();
    });

    document.getElementById('sidebar-brand-home')?.addEventListener('click', () => {
      this.showLandingPage();
    });
  }

  // ==========================================================================
  // 2. Mission Selection Modal
  // ==========================================================================
  bindMissionModal() {
    const modal = document.getElementById('modal-mission-picker');
    const btnClose = document.getElementById('btn-close-mission-modal');
    const btnConfirm = document.getElementById('btn-confirm-mission');
    const cards = document.querySelectorAll('.mission-card[data-mission-id]');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        const missionId = card.getAttribute('data-mission-id');
        const mission = MISSIONS[missionId];
        const summary = document.getElementById('modal-summary-mission-name');
        if (summary && mission) {
          summary.textContent = `${mission.code} · ${mission.name}`;
        }
      });
    });

    btnClose?.addEventListener('click', () => modal?.classList.remove('active'));

    btnConfirm?.addEventListener('click', () => {
      const selected = document.querySelector('.mission-card.selected');
      const missionId = selected?.getAttribute('data-mission-id') || 'pb2';
      modal?.classList.remove('active');
      this.startAutomatedDemoTour(missionId);
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });

    document.getElementById('btn-sidebar-switch-mission')?.addEventListener('click', () => {
      this.openMissionModal();
    });
  }

  openMissionModal() {
    document.getElementById('modal-mission-picker')?.classList.add('active');
  }

  // ==========================================================================
  // 3. Left Sidebar Navigation (Evaluator can "scroll it back" anytime)
  // ==========================================================================
  bindSidebarNav() {
    const navItems = document.querySelectorAll('.sidebar-nav-item[data-step]');
    navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const stepNum = parseInt(btn.getAttribute('data-step') || '1', 10);
        this.stopAutomatedTour(); // Manual click stops auto-tour so user can freely inspect
        this.goToStep(stepNum);
      });
    });
  }

  goToStep(stepNum, shouldStopTour = true) {
    if (shouldStopTour && this.isTourRunning) {
      this.stopAutomatedTour();
    }

    this.currentStep = stepNum;
    this.store.setStep(stepNum);

    // Update Sidebar active state
    document.querySelectorAll('.sidebar-nav-item[data-step]').forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.getAttribute('data-step'), 10) === stepNum) {
        btn.classList.add('active');
      }
    });

    // Update Step Panes
    document.querySelectorAll('.step-pane').forEach((pane, idx) => {
      if (idx + 1 === stepNum) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Update Top Breadcrumb
    const breadcrumb = document.getElementById('breadcrumb-current-step');
    const stepTitles = [
      'Trajectory Validation & Feasibility',
      'Processing Pipeline & Feature Detection',
      '3D Model & Studio Inspection',
      'Validation Criteria & Deliverables'
    ];
    if (breadcrumb) {
      breadcrumb.textContent = stepTitles[stepNum - 1] || 'Trajectory Validation';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Step-specific initializations
    if (stepNum === 1) {
      setTimeout(() => this.drawGnssFlightPath(), 60);
    } else if (stepNum === 2) {
      this.runProcessingPipelineSimulation();
    } else if (stepNum === 3) {
      this.initOrUpdate3DViewer();
    }
  }

  // ==========================================================================
  // 4. Hands-Free Automated Demo Tour Engine (Step-by-Step Tab Progression)
  // ==========================================================================
  startAutomatedDemoTour(missionId = 'pb2') {
    this.store.setMission(missionId);
    this.showWorkflowView(1);

    this.isTourRunning = true;
    this.tourPaused = false;
    this.tourStep = 1;

    const banner = document.getElementById('auto-tour-banner');
    if (banner) banner.classList.add('active');

    const btnPause = document.getElementById('btn-tour-pause');
    const btnResume = document.getElementById('btn-tour-resume');
    if (btnPause) btnPause.style.display = 'inline-flex';
    if (btnResume) btnResume.style.display = 'none';

    this.executeTourStep(1);
  }

  executeTourStep(stepNum) {
    if (!this.isTourRunning) return;
    this.tourStep = stepNum;
    this.goToStep(stepNum, false);

    const bannerText = document.getElementById('tour-banner-text');
    const stepDurations = { 1: 3.5, 2: 6.0, 3: 5.5, 4: 0 }; // in seconds
    const duration = stepDurations[stepNum] || 4.5;

    const stepNames = [
      'Step 1/4: Trajectory Validation',
      'Step 2/4: Processing Pipeline (7 Stages)',
      'Step 3/4: 3D Model & Studio Viewer',
      'Step 4/4: Validation & Deliverables'
    ];

    if (stepNum < 4) {
      this.tourRemainingSec = duration;
      if (bannerText) {
        bannerText.textContent = `⚡ AUTOMATED DEMO TOUR ACTIVE · ${stepNames[stepNum - 1]} · Auto-advancing in ${this.tourRemainingSec.toFixed(1)}s`;
      }

      if (this.tourCountdownTimer) clearInterval(this.tourCountdownTimer);

      this.tourCountdownTimer = setInterval(() => {
        if (this.tourPaused) return;

        this.tourRemainingSec -= 0.5;
        if (bannerText) {
          bannerText.textContent = `⚡ AUTOMATED DEMO TOUR ACTIVE · ${stepNames[stepNum - 1]} · Auto-advancing in ${Math.max(0, this.tourRemainingSec).toFixed(1)}s`;
        }

        if (this.tourRemainingSec <= 0) {
          clearInterval(this.tourCountdownTimer);
          if (this.isTourRunning && this.tourStep < 4) {
            this.executeTourStep(this.tourStep + 1);
          }
        }
      }, 500);
    } else {
      // Step 4 (Final Deliverables) reached!
      if (this.tourCountdownTimer) clearInterval(this.tourCountdownTimer);
      if (bannerText) {
        bannerText.textContent = `✓ AUTOMATED DEMO TOUR COMPLETE · Evaluator may now click any tab in the left sidebar to explore.`;
      }
      setTimeout(() => {
        this.stopAutomatedTour();
      }, 4500);
    }
  }

  stopAutomatedTour() {
    this.isTourRunning = false;
    this.tourPaused = false;
    if (this.tourCountdownTimer) clearInterval(this.tourCountdownTimer);

    const banner = document.getElementById('auto-tour-banner');
    if (banner) banner.classList.remove('active');
  }

  bindTourControls() {
    const btnPause = document.getElementById('btn-tour-pause');
    const btnResume = document.getElementById('btn-tour-resume');
    const btnSkip = document.getElementById('btn-tour-skip');

    btnPause?.addEventListener('click', () => {
      this.tourPaused = true;
      btnPause.style.display = 'none';
      if (btnResume) btnResume.style.display = 'inline-flex';
      const bannerText = document.getElementById('tour-banner-text');
      if (bannerText) bannerText.textContent = `⏸ TOUR PAUSED · Click Resume to continue, or click any sidebar item to explore freely.`;
    });

    btnResume?.addEventListener('click', () => {
      this.tourPaused = false;
      btnResume.style.display = 'none';
      if (btnPause) btnPause.style.display = 'inline-flex';
    });

    btnSkip?.addEventListener('click', () => {
      this.stopAutomatedTour();
      this.goToStep(3); // Jump straight to 3D model
    });
  }

  // ==========================================================================
  // 5. In-Step Navigation Buttons
  // ==========================================================================
  bindWorkflowNavigation() {
    // Step 1
    document.getElementById('btn-step1-home')?.addEventListener('click', () => this.showLandingPage());
    document.getElementById('btn-step1-proceed')?.addEventListener('click', () => this.goToStep(2));

    // Step 2
    document.getElementById('btn-step2-back')?.addEventListener('click', () => this.goToStep(1));
    document.getElementById('btn-step2-proceed')?.addEventListener('click', () => this.goToStep(3));

    // Step 3
    document.getElementById('btn-step3-back')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('btn-step3-proceed')?.addEventListener('click', () => this.goToStep(4));

    // Step 4
    document.getElementById('btn-step4-back')?.addEventListener('click', () => this.goToStep(3));
    document.getElementById('btn-step4-home')?.addEventListener('click', () => this.showLandingPage());
  }

  // ==========================================================================
  // 6. Dynamic Mission Hydration
  // ==========================================================================
  hydrateMissionData(mission) {
    if (!mission) return;

    // Sidebar Active Mission Card
    const sideName = document.getElementById('sidebar-mission-name-display');
    const sideDatum = document.getElementById('sidebar-datum-display');
    if (sideName) sideName.textContent = `${mission.code} · ${mission.name}`;
    if (sideDatum) sideDatum.textContent = mission.crsDatum.split(' ')[0];

    // Step 1 - Trajectory Details
    const s1Dur = document.getElementById('step1-duration');
    const s1Gps = document.getElementById('step1-gps-count');
    const s1Gsd = document.getElementById('step1-gsd');
    const s1Comp = document.getElementById('step1-compute-time');
    const s1Crs = document.getElementById('step1-crs-name');
    if (s1Dur) s1Dur.textContent = `${mission.videoDuration} (${mission.videoDurationSec} s)`;
    if (s1Gps) s1Gps.textContent = mission.gpsRecords;
    if (s1Gsd) s1Gsd.textContent = mission.gsd;
    if (s1Comp) s1Comp.textContent = mission.reconstructionTime;
    if (s1Crs) s1Crs.textContent = mission.crsDatum;

    // Step 2 - Keyframes & SAM Masks
    this.renderKeyframeStrip(mission);
    this.renderSemanticPreviews(mission);

    // Step 4 - Validation Table & Metrics
    const valReproj = document.getElementById('val-reproj');
    const valSpatial = document.getElementById('val-spatial');
    const valCoverage = document.getElementById('val-coverage');
    const valTime = document.getElementById('val-time');
    if (valReproj) valReproj.textContent = mission.reprojectionError;
    if (valSpatial) valSpatial.textContent = mission.spatialAccuracy;
    if (valCoverage) valCoverage.textContent = mission.coverage;
    if (valTime) valTime.textContent = mission.reconstructionTime;

    // Step 4 - Donut Chart
    this.updateDonutChart(mission.evidence);

    // Step 4 - Deliverable card filename
    const meshMeta = document.getElementById('dl-mesh-meta');
    if (meshMeta) meshMeta.textContent = `${mission.id}_model.glb · ${mission.outputSize.split(' ')[0]} MB`;

    // Redraw flight path if on step 1
    if (this.currentStep === 1) {
      this.drawGnssFlightPath();
    }
  }

  // ==========================================================================
  // 7. 2D GNSS Flight Trajectory Canvas (Step 1)
  // ==========================================================================
  drawGnssFlightPath() {
    const canvas = document.getElementById('flight-path-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mission = this.store.getMission();
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Flight spline
    const pts = mission.flightPath || [];
    if (pts.length > 1) {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const xc = (pts[i - 1].x + pts[i].x) / 2;
        const yc = (pts[i - 1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Waypoints
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      pts.forEach((pt, index) => {
        if (index > 0 && index < pts.length - 1) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Start Waypoint (Green)
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '11px JetBrains Mono';
      ctx.fillStyle = '#10b981';
      ctx.fillText('TAKEOFF (0.00s)', pts[0].x + 12, pts[0].y + 4);

      // End Waypoint (Red)
      const last = pts[pts.length - 1];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.fillText(`LAND (${mission.videoDuration})`, last.x + 12, last.y + 4);
    }
  }

  // ==========================================================================
  // 8. Processing Pipeline Simulation (Step 2)
  // ==========================================================================
  runProcessingPipelineSimulation(forceReplay = false) {
    if (this.store.isProcessing && !forceReplay) return;

    this.store.isProcessing = true;
    const progressBar = document.getElementById('pipeline-progress-fill');
    const percentText = document.getElementById('pipeline-percent-text');
    const statusText = document.getElementById('pipeline-status-text');
    const stageChips = document.querySelectorAll('.pipeline-stage-chip');

    stageChips.forEach(chip => chip.classList.remove('completed', 'running'));
    if (progressBar) progressBar.style.width = '0%';
    if (percentText) percentText.textContent = '0%';

    let currentStageIndex = 0;
    const totalStages = PIPELINE_STAGES.length;

    if (this.processingTimer) clearInterval(this.processingTimer);

    this.processingTimer = setInterval(() => {
      if (currentStageIndex < totalStages) {
        const stage = PIPELINE_STAGES[currentStageIndex];

        if (currentStageIndex > 0) {
          stageChips[currentStageIndex - 1]?.classList.remove('running');
          stageChips[currentStageIndex - 1]?.classList.add('completed');
        }

        stageChips[currentStageIndex]?.classList.add('running');
        if (statusText) {
          statusText.innerHTML = `<span class="ntro-dot-pulse"></span> Stage ${stage.id}/7: ${stage.name}...`;
        }

        const progress = Math.round(((currentStageIndex + 1) / totalStages) * 100);
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (percentText) percentText.textContent = `${progress}%`;

        currentStageIndex++;
      } else {
        clearInterval(this.processingTimer);
        this.store.isProcessing = false;
        stageChips[totalStages - 1]?.classList.remove('running');
        stageChips[totalStages - 1]?.classList.add('completed');

        if (progressBar) progressBar.style.width = '100%';
        if (percentText) percentText.textContent = '100%';
        if (statusText) {
          statusText.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--as-green);"></i> PROCESSING COMPLETE · 3D WORLD READY FOR EVALUATION`;
        }
      }
    }, 700);
  }

  renderKeyframeStrip(mission) {
    const strip = document.getElementById('keyframe-strip-container');
    if (!strip) return;
    strip.innerHTML = '';

    const badge = document.getElementById('keyframe-count-badge');
    if (badge) badge.textContent = `${mission.frameCount} keyframes extracted · 30 FPS stream`;

    const sampleIndices = mission.keyframeIndices || [1, 24, 68, 112, 185, 240, 310, 385, 442, 500];

    sampleIndices.forEach(idx => {
      const padNum = String(idx).padStart(4, '0');
      const imgPath = `${mission.framesDir}frame_${padNum}.jpg`;

      const card = document.createElement('div');
      card.className = 'keyframe-card';
      card.innerHTML = `
        <img src="${imgPath}" alt="Frame ${idx}" class="keyframe-img" loading="lazy" onerror="this.src='assets/hero_bg.jpg'">
        <div class="keyframe-meta">
          <span>FR-${padNum}</span>
          <span style="color: var(--as-cyan);">Score: 0.94</span>
        </div>
      `;
      strip.appendChild(card);
    });
  }

  renderSemanticPreviews(mission) {
    const grid = document.getElementById('semantic-previews-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const sampleIndices = (mission.keyframeIndices || [1, 24, 68, 112]).slice(0, 4);
    const classes = ['Building Facades', 'Ground / Terrain', 'Dynamic Vehicles', 'Moving Personnel'];

    sampleIndices.forEach((idx, i) => {
      const padNum = String(idx).padStart(4, '0');
      const imgPath = `${mission.framesDir}frame_${padNum}.jpg`;

      const tile = document.createElement('div');
      tile.className = 'semantic-preview-card';
      tile.innerHTML = `
        <img src="${imgPath}" alt="Semantic frame ${idx}" class="semantic-preview-img" onerror="this.src='assets/hero_bg.jpg'">
        <div class="semantic-overlay-mask"></div>
        <div class="semantic-preview-label">
          <span>${classes[i] || 'Feature Mask'}</span>
          <span style="color: var(--as-cyan);">SAM Masked</span>
        </div>
      `;
      grid.appendChild(tile);
    });
  }

  // ==========================================================================
  // 9. Three.js 3D Studio & Viewer Engine (Step 3)
  // ==========================================================================
  initOrUpdate3DViewer() {
    const container = document.getElementById('viewer3d-canvas-container');
    if (!container) return;

    const mission = this.store.getMission();
    const loadFilename = document.getElementById('viewer-load-filename');
    if (loadFilename) loadFilename.textContent = `${mission.id}_model.glb`;

    const loaderElem = document.getElementById('viewer3d-loading');
    if (loaderElem) loaderElem.style.display = 'flex';

    if (!this.viewer) {
      this.initThreeJsScene(container);
    }

    this.loadMissionModel(mission);
  }

  initThreeJsScene(container) {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    camera.position.set(-28, 22, -64);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 4, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.0;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(40, 60, 40);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6);
    dirLight2.position.set(-40, 20, -40);
    scene.add(dirLight2);

    const grid = new THREE.GridHelper(160, 40, 0x2563eb, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    this.viewer = {
      scene,
      camera,
      renderer,
      controls,
      grid,
      modelContainer: new THREE.Group(),
      roiBox: null,
      cameraPyramids: [],
      currentMesh: null,
      raycaster,
      mouse,
      container
    };

    scene.add(this.viewer.modelContainer);

    renderer.domElement.addEventListener('mousemove', (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(this.viewer.modelContainer.children, true);

      if (intersects.length > 0) {
        this.updateCoordinatesHUD(intersects[0].point);
      }
    });

    renderer.domElement.addEventListener('click', (e) => {
      if (!this.measureActive) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(this.viewer.modelContainer.children, true);

      if (intersects.length > 0) {
        this.handleMeasureClick(intersects[0].point);
      }
    });

    window.addEventListener('resize', () => {
      if (!this.viewer) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 580;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  loadMissionModel(mission) {
    if (!this.viewer) return;

    this.viewer.modelContainer.clear();
    if (this.viewer.roiBox) {
      this.viewer.scene.remove(this.viewer.roiBox);
      this.viewer.roiBox = null;
    }
    this.viewer.cameraPyramids.forEach(p => this.viewer.scene.remove(p));
    this.viewer.cameraPyramids = [];
    this.clearMeasurement();

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      mission.glbUrl,
      (gltf) => {
        const rawModel = gltf.scene;

        const bbox = new THREE.Box3().setFromObject(rawModel);
        const rawSize = bbox.getSize(new THREE.Vector3());

        const targetW = 40;
        const targetD = 42;
        const targetH = 22;
        const scaleH = Math.min(targetW / Math.max(rawSize.x, 0.001), targetD / Math.max(rawSize.z, 0.001));
        const autoScale = (rawSize.y * scaleH > targetH) ? (targetH / Math.max(rawSize.y, 0.001)) : scaleH;
        const finalScale = (mission.viewerSettings?.scale || 1.0) * autoScale;

        rawModel.scale.setScalar(finalScale);
        rawModel.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(rawModel);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        rawModel.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
        rawModel.updateMatrixWorld(true);

        this.viewer.modelContainer.add(rawModel);
        this.viewer.currentMesh = rawModel;

        const worldBox = new THREE.Box3().setFromObject(this.viewer.modelContainer);
        const worldCenter = worldBox.getCenter(new THREE.Vector3());
        this.viewer.modelContainer.position.set(-worldCenter.x, -worldBox.min.y, -worldCenter.z);
        this.viewer.modelContainer.updateMatrixWorld(true);

        const finalBox = new THREE.Box3().setFromObject(this.viewer.modelContainer);
        const finalSize = finalBox.getSize(new THREE.Vector3());
        const finalCenter = finalBox.getCenter(new THREE.Vector3());

        const boxGeom = new THREE.BoxGeometry(finalSize.x * 1.08, finalSize.y * 1.08, finalSize.z * 1.08);
        const boxEdges = new THREE.EdgesGeometry(boxGeom);
        const boxMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 });
        this.viewer.roiBox = new THREE.LineSegments(boxEdges, boxMat);
        this.viewer.roiBox.position.copy(finalCenter);
        this.viewer.scene.add(this.viewer.roiBox);

        this.createDroneFrustums(finalSize);

        this.viewer.camera.position.set(
          mission.viewerSettings?.cameraPos?.[0] || -28,
          mission.viewerSettings?.cameraPos?.[1] || 22,
          mission.viewerSettings?.cameraPos?.[2] || -64
        );
        this.viewer.controls.target.set(0, finalSize.y * 0.45, 0);
        this.viewer.controls.update();

        // Auto-rotation during automated demo tour
        if (this.isTourRunning) {
          this.viewer.controls.autoRotate = true;
          setTimeout(() => {
            if (this.viewer?.controls) this.viewer.controls.autoRotate = false;
          }, 4500);
        }

        const loaderElem = document.getElementById('viewer3d-loading');
        if (loaderElem) loaderElem.style.display = 'none';
      },
      undefined,
      (err) => {
        console.error('Error loading 3D model:', err);
        const loaderElem = document.getElementById('viewer3d-loading');
        if (loaderElem) loaderElem.style.display = 'none';
      }
    );
  }

  createDroneFrustums(size) {
    const numFrustums = 10;
    const radius = Math.max(size.x, size.z) * 0.85;
    const height = size.y * 1.35;

    for (let i = 0; i < numFrustums; i++) {
      const angle = (i / numFrustums) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const pyrGeom = new THREE.ConeGeometry(1.4, 2.2, 4);
      const pyrMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true });
      const pyramid = new THREE.Mesh(pyrGeom, pyrMat);
      pyramid.position.set(x, height, z);
      pyramid.lookAt(0, size.y * 0.4, 0);

      this.viewer.scene.add(pyramid);
      this.viewer.cameraPyramids.push(pyramid);
    }
  }

  updateCoordinatesHUD(pt) {
    const hX = document.getElementById('hud-coord-x');
    const hY = document.getElementById('hud-coord-y');
    const hZ = document.getElementById('hud-coord-z');
    const hAlt = document.getElementById('hud-coord-alt');

    if (hX) hX.textContent = `${pt.x.toFixed(2)} m`;
    if (hY) hY.textContent = `${pt.y.toFixed(2)} m`;
    if (hZ) hZ.textContent = `${pt.z.toFixed(2)} m`;
    if (hAlt) hAlt.textContent = `${(50 + pt.y * 1.8).toFixed(1)} m MSL`;
  }

  handleMeasureClick(point) {
    this.measurePoints.push(point);

    const sphereGeom = new THREE.SphereGeometry(0.5, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const marker = new THREE.Mesh(sphereGeom, sphereMat);
    marker.position.copy(point);
    this.viewer.scene.add(marker);
    this.measureMarkers.push(marker);

    const statusLabel = document.getElementById('hud-measure-status');
    const distNum = document.getElementById('hud-measure-dist');

    if (this.measurePoints.length === 1) {
      if (statusLabel) statusLabel.textContent = 'Point 1 set. Click Point 2...';
    } else if (this.measurePoints.length === 2) {
      const p1 = this.measurePoints[0];
      const p2 = this.measurePoints[1];
      const dist = p1.distanceTo(p2);

      const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
      this.measureLine = new THREE.Line(lineGeom, lineMat);
      this.viewer.scene.add(this.measureLine);

      if (distNum) distNum.textContent = `${dist.toFixed(2)} m`;
      if (statusLabel) statusLabel.textContent = 'Distance computed (Euclidean)';
    } else {
      this.clearMeasurement();
      this.handleMeasureClick(point);
    }
  }

  clearMeasurement() {
    this.measurePoints = [];
    if (this.measureLine) {
      this.viewer.scene.remove(this.measureLine);
      this.measureLine = null;
    }
    this.measureMarkers.forEach(m => this.viewer.scene.remove(m));
    this.measureMarkers = [];

    const distNum = document.getElementById('hud-measure-dist');
    const statusLabel = document.getElementById('hud-measure-status');
    if (distNum) distNum.textContent = '0.00 m';
    if (statusLabel) statusLabel.textContent = 'Click 2 points on model';
  }

  bind3DViewerControls() {
    const toggleMesh = document.getElementById('toggle-layer-mesh');
    const togglePoints = document.getElementById('toggle-layer-points');
    const toggleRoi = document.getElementById('toggle-layer-roi');
    const toggleFrustums = document.getElementById('toggle-layer-frustums');
    const toggleGrid = document.getElementById('toggle-layer-grid');

    toggleMesh?.addEventListener('click', () => {
      toggleMesh.classList.toggle('active');
      if (this.viewer?.modelContainer) {
        this.viewer.modelContainer.visible = toggleMesh.classList.contains('active');
      }
    });

    togglePoints?.addEventListener('click', () => {
      togglePoints.classList.toggle('active');
      if (this.viewer?.currentMesh) {
        this.viewer.currentMesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.wireframe = togglePoints.classList.contains('active');
          }
        });
      }
    });

    toggleRoi?.addEventListener('click', () => {
      toggleRoi.classList.toggle('active');
      if (this.viewer?.roiBox) {
        this.viewer.roiBox.visible = toggleRoi.classList.contains('active');
      }
    });

    toggleFrustums?.addEventListener('click', () => {
      toggleFrustums.classList.toggle('active');
      const visible = toggleFrustums.classList.contains('active');
      this.viewer?.cameraPyramids.forEach(p => p.visible = visible);
    });

    toggleGrid?.addEventListener('click', () => {
      toggleGrid.classList.toggle('active');
      if (this.viewer?.grid) {
        this.viewer.grid.visible = toggleGrid.classList.contains('active');
      }
    });

    // Tool Modes
    const modeOrbit = document.getElementById('tool-mode-orbit');
    const modeMeasure = document.getElementById('tool-mode-measure');

    modeOrbit?.addEventListener('click', () => {
      modeOrbit.classList.add('active');
      modeMeasure?.classList.remove('active');
      this.measureActive = false;
    });

    modeMeasure?.addEventListener('click', () => {
      modeMeasure.classList.add('active');
      modeOrbit?.classList.remove('active');
      this.measureActive = true;
      this.clearMeasurement();
    });

    // Camera Presets
    document.getElementById('btn-cam-iso')?.addEventListener('click', () => {
      this.viewer?.camera.position.set(-28, 22, -64);
      this.viewer?.controls.target.set(0, 4, 0);
      this.viewer?.controls.update();
    });

    document.getElementById('btn-cam-top')?.addEventListener('click', () => {
      this.viewer?.camera.position.set(0, 80, 0.1);
      this.viewer?.controls.target.set(0, 0, 0);
      this.viewer?.controls.update();
    });

    document.getElementById('btn-cam-front')?.addEventListener('click', () => {
      this.viewer?.camera.position.set(0, 12, -70);
      this.viewer?.controls.target.set(0, 4, 0);
      this.viewer?.controls.update();
    });

    document.getElementById('btn-cam-side')?.addEventListener('click', () => {
      this.viewer?.camera.position.set(70, 12, 0);
      this.viewer?.controls.target.set(0, 4, 0);
      this.viewer?.controls.update();
    });

    document.getElementById('btn-cam-reset')?.addEventListener('click', () => {
      this.viewer?.camera.position.set(-28, 22, -64);
      this.viewer?.controls.target.set(0, 4, 0);
      this.viewer?.controls.update();
    });

    // Sub-nav tabs
    const tabModel = document.getElementById('tab-3d-model');
    const tabPointCloud = document.getElementById('tab-3d-pointcloud');
    const tabWireframe = document.getElementById('tab-3d-wireframe');
    const tabEvidence = document.getElementById('tab-3d-evidence');

    const subTabs = [tabModel, tabPointCloud, tabWireframe, tabEvidence];
    subTabs.forEach(tab => {
      tab?.addEventListener('click', () => {
        subTabs.forEach(t => t?.classList.remove('active'));
        tab.classList.add('active');

        if (tab === tabModel) {
          this.viewer?.currentMesh?.traverse(child => {
            if (child.isMesh && child.material) child.material.wireframe = false;
          });
        } else if (tab === tabWireframe || tab === tabPointCloud) {
          this.viewer?.currentMesh?.traverse(child => {
            if (child.isMesh && child.material) child.material.wireframe = true;
          });
        }
      });
    });
  }

  // ==========================================================================
  // 10. Step 4 (Validation & Export) Actions
  // ==========================================================================
  updateDonutChart(evidence) {
    if (!evidence) return;

    const segObserved = document.getElementById('donut-seg-observed');
    const segRecon = document.getElementById('donut-seg-reconstructed');
    const segInferred = document.getElementById('donut-seg-inferred');
    const segUnknown = document.getElementById('donut-seg-unknown');

    const centerPct = document.getElementById('donut-observed-pct');
    const legObs = document.getElementById('legend-pct-observed');
    const legRec = document.getElementById('legend-pct-reconstructed');
    const legInf = document.getElementById('legend-pct-inferred');
    const legUnk = document.getElementById('legend-pct-unknown');

    const obs = evidence.observed;
    const rec = evidence.reconstructed;
    const inf = evidence.inferred;
    const unk = evidence.unknown;

    if (segObserved) segObserved.setAttribute('stroke-dasharray', `${obs} ${100 - obs}`);
    if (segRecon) {
      segRecon.setAttribute('stroke-dasharray', `${rec} ${100 - rec}`);
      segRecon.setAttribute('stroke-dashoffset', `-${obs}`);
    }
    if (segInferred) {
      segInferred.setAttribute('stroke-dasharray', `${inf} ${100 - inf}`);
      segInferred.setAttribute('stroke-dashoffset', `-${obs + rec}`);
    }
    if (segUnknown) {
      segUnknown.setAttribute('stroke-dasharray', `${unk} ${100 - unk}`);
      segUnknown.setAttribute('stroke-dashoffset', `-${obs + rec + inf}`);
    }

    if (centerPct) centerPct.textContent = `${obs}%`;
    if (legObs) legObs.textContent = `${obs}%`;
    if (legRec) legRec.textContent = `${rec}%`;
    if (legInf) legInf.textContent = `${inf}%`;
    if (legUnk) legUnk.textContent = `${unk}%`;
  }

  bindExportActions() {
    const triggerDownload = (filename, label) => {
      const mission = this.store.getMission();
      const actualFile = filename.replace('pb2', mission.id);

      const link = document.createElement('a');
      link.href = mission.glbUrl;
      link.download = actualFile;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`Downloaded: ${label} (${actualFile})`);
    };

    document.getElementById('btn-dl-mesh')?.addEventListener('click', () => {
      triggerDownload('pb2_model.glb', 'Textured 3D Mesh');
    });

    document.getElementById('btn-dl-ply')?.addEventListener('click', () => {
      triggerDownload('pb2_pointcloud.ply', 'Dense Point Cloud');
    });

    document.getElementById('btn-dl-ortho')?.addEventListener('click', () => {
      triggerDownload('pb2_ortho.tif', 'GeoTIFF Orthomosaic');
    });

    document.getElementById('btn-dl-pdf')?.addEventListener('click', () => {
      triggerDownload('AeroSculpt_NTRO_Report.pdf', 'NTRO Quality Report');
    });

    document.getElementById('btn-dl-all-zip')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      alert(`Preparing Complete NTRO Deliverable Package for ${mission.name} (168.4 MB)... Download started.`);
    });
  }

  // ==========================================================================
  // 11. NTRO Documentation Modal
  // ==========================================================================
  bindDocsModal() {
    const modal = document.getElementById('modal-docs');
    const btnOpen = document.getElementById('nav-btn-docs');
    const btnClose = document.getElementById('btn-close-docs-modal');
    const btnConfirm = document.getElementById('btn-close-docs-confirm');

    btnOpen?.addEventListener('click', () => modal?.classList.add('active'));
    btnClose?.addEventListener('click', () => modal?.classList.remove('active'));
    btnConfirm?.addEventListener('click', () => modal?.classList.remove('active'));

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.aerosculptApp = new AeroSculptApp();
});
