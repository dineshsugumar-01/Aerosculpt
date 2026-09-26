// AeroSculpt NTRO Main Application Controller v4.0
// Exact Implementation of 6-Panel Design Reference:
// Screen 01: Mission Home / Landing Page
// Screen 02: Upload & Configuration
// Screen 03: Input Validation (Dynamic Trajectory & Quality Checks)
// Screen 04: Processing Pipeline (7 Stages, Differentiated Keyframes, SAM Tiles)
// Screen 05: 3D Viewer & Analysis (Auto-Fit GLB, Flat on Y=0, Compass, Raycaster Measurement)
// Screen 06: Validation & Export (NTRO Metric Table, SVG Donut Chart, Downloads)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MISSIONS, MissionStore } from './missionStore.js';

class AeroSculptApp {
  constructor() {
    this.store = new MissionStore('pb2'); // Default to pb2 (Svalbard Arctic Reconnaissance)
    this.currentScreen = 1; // 1: Landing, 2: Upload, 3: Validation, 4: Pipeline, 5: 3D Viewer, 6: Export
    this.viewer = null;
    this.hasRunSimulation = false;

    // Automated Tour State
    this.isTourRunning = false;
    this.tourTimer = null;

    // 3D Measurement & Inspection State
    this.measureMode = 'dist'; // dist, area, elev
    this.measurePoints = [];
    this.measureLine = null;
    this.measureMarkers = [];

    // Flight Canvas Animation
    this.flightAnimFrame = null;
    this.flightProgress = 1.0;

    this.init();
  }

  init() {
    this.initGlobalNavigation();
    this.initLandingEvents();
    this.initMissionModal();
    this.initStepperNavigation();
    this.initScreen02Events();
    this.initScreen03Events();
    this.initScreen04Events();
    this.initScreen05Viewer();
    this.initScreen06Events();
    this.initDocsModal();

    // Hydrate initial data for default mission (PB2)
    this.hydrateMissionData(this.store.getMission());

    // Show Screen 01 (Landing Page) by default on initial load
    this.showScreen(1);
  }

  // ==========================================================================
  // Screen Router & View Manager
  // ==========================================================================
  showScreen(screenNum, triggerSimulation = false) {
    this.currentScreen = screenNum;

    const screen01 = document.getElementById('screen-01-landing');
    const workflowContainer = document.getElementById('workflow-app-container');
    const screen05Viewer = document.getElementById('screen-05-viewer');

    const pane02 = document.getElementById('pane-screen-02');
    const pane03 = document.getElementById('pane-screen-03');
    const pane04 = document.getElementById('pane-screen-04');
    const pane06 = document.getElementById('pane-screen-06');

    // Update Top Header Tabs active state
    this.updateHeaderNavTabs(screenNum);

    // Screen 01: Home / Landing Page
    if (screenNum === 1) {
      screen01?.classList.add('active');
      workflowContainer?.classList.remove('active');
      screen05Viewer?.classList.remove('active');
      return;
    }

    // Screen 05: 3D Viewer & Analysis (Full-screen viewport)
    if (screenNum === 5) {
      screen01?.classList.remove('active');
      workflowContainer?.classList.remove('active');
      screen05Viewer?.classList.add('active');
      
      // Update left stepper active indicator
      this.updateStepperActive(4);

      // Render / resize 3D viewer
      setTimeout(() => {
        if (this.viewer) {
          this.viewer.onResize();
        } else {
          this.setupThreeScene();
        }
      }, 50);
      return;
    }

    // Screens 02, 03, 04, 06: Managed inside workflowContainer
    screen01?.classList.remove('active');
    screen05Viewer?.classList.remove('active');
    workflowContainer?.classList.add('active');

    // Hide all panes
    [pane02, pane03, pane04, pane06].forEach(p => p?.classList.remove('active'));

    if (screenNum === 2) {
      pane02?.classList.add('active');
      this.updateStepperActive(1);
    } else if (screenNum === 3) {
      pane03?.classList.add('active');
      this.updateStepperActive(2);
      this.runTrajectoryValidation(triggerSimulation);
    } else if (screenNum === 4) {
      pane04?.classList.add('active');
      this.updateStepperActive(3);
      this.runPipelineProcessing(triggerSimulation);
    } else if (screenNum === 6) {
      pane06?.classList.add('active');
      this.updateStepperActive(5);
      this.renderScreen06Metrics();
    }
  }

  updateHeaderNavTabs(screenNum) {
    const tabHome = document.getElementById('nav-tab-home');
    const tabProcess = document.getElementById('nav-tab-process');
    const tabViewer = document.getElementById('nav-tab-viewer');
    const tabExport = document.getElementById('nav-tab-export');

    [tabHome, tabProcess, tabViewer, tabExport].forEach(t => t?.classList.remove('active'));

    if (screenNum === 1) tabHome?.classList.add('active');
    else if (screenNum >= 2 && screenNum <= 4) tabProcess?.classList.add('active');
    else if (screenNum === 5) tabViewer?.classList.add('active');
    else if (screenNum === 6) tabExport?.classList.add('active');
  }

  updateStepperActive(stepIndex) {
    // Stepper items: 1 (Upload), 2 (Validate), 3 (Process), 4 (3D View), 5 (Export)
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`stepper-step-${i}`);
      if (!btn) continue;
      btn.classList.remove('active');
      if (i < stepIndex || this.hasRunSimulation) {
        btn.classList.add('completed');
        const numSpan = btn.querySelector('.stepper-circle-num');
        if (numSpan && !numSpan.querySelector('i')) {
          numSpan.innerHTML = '<i class="fa-solid fa-check"></i>';
        }
      }
      if (i === stepIndex) {
        btn.classList.add('active');
      }
    }
  }

  // ==========================================================================
  // 1. Global Navigation & Landing Events
  // ==========================================================================
  initGlobalNavigation() {
    document.getElementById('header-brand-logo')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(1);
    });

    document.getElementById('nav-tab-home')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(1);
    });

    document.getElementById('nav-tab-process')?.addEventListener('click', () => {
      this.stopTour();
      // If we haven't processed yet, go to Screen 02, else Screen 03 or 04
      this.showScreen(2);
    });

    document.getElementById('nav-tab-viewer')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(5);
    });

    document.getElementById('nav-tab-export')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(6);
    });

    document.getElementById('nav-tab-docs')?.addEventListener('click', () => {
      this.openDocsModal();
    });
  }

  initLandingEvents() {
    // "Load Demo Mission" -> Directly starts the automated step-by-step walkthrough
    document.getElementById('btn-hero-demo')?.addEventListener('click', () => {
      this.startAutomatedDemoTour('pb2');
    });

    // "Upload Your Own Mission" -> Directly opens Screen 02 (Upload & Configuration)
    document.getElementById('btn-hero-upload')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(2);
    });
  }

  // ==========================================================================
  // 2. Mission Selection Modal
  // ==========================================================================
  initMissionModal() {
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
      this.switchMission(missionId);
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });

    document.getElementById('btn-demo-dataset')?.addEventListener('click', () => {
      this.openMissionModal();
    });

    document.getElementById('btn-switch-dataset-stepper')?.addEventListener('click', () => {
      this.openMissionModal();
    });
  }

  openMissionModal() {
    document.getElementById('modal-mission-picker')?.classList.add('active');
  }

  switchMission(missionId) {
    this.store.setMission(missionId);
    const mission = this.store.getMission();
    this.hydrateMissionData(mission);

    // Reload 3D model in background or next time Screen 05 is viewed
    if (this.viewer) {
      this.loadMissionModel(mission);
    }
  }

  // ==========================================================================
  // 3. Persistent Stepper Navigation
  // ==========================================================================
  initStepperNavigation() {
    document.getElementById('stepper-step-1')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(2);
    });

    document.getElementById('stepper-step-2')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(3, false); // Instant inspection if already run
    });

    document.getElementById('stepper-step-3')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(4, false); // Instant inspection if already run
    });

    document.getElementById('stepper-step-4')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(5);
    });

    document.getElementById('stepper-step-5')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(6);
    });
  }

  // ==========================================================================
  // 4. Screen 02: Upload & Configuration Events
  // ==========================================================================
  initScreen02Events() {
    // Scene Type Buttons
    const sceneTypes = ['urban', 'rural', 'mountain', 'coastal'];
    sceneTypes.forEach(type => {
      const btn = document.getElementById(`scene-type-${type}`);
      btn?.addEventListener('click', () => {
        sceneTypes.forEach(t => document.getElementById(`scene-type-${t}`)?.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Reconstruction Mode Buttons
    const modes = ['easy', 'medium', 'hard'];
    modes.forEach(mode => {
      const btn = document.getElementById(`mode-${mode}`);
      btn?.addEventListener('click', () => {
        modes.forEach(m => document.getElementById(`mode-${m}`)?.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Start Processing CTA -> Transitions to Screen 03 with dynamic animation
    document.getElementById('btn-start-processing')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(3, true);
    });
  }

  // ==========================================================================
  // 5. Screen 03: Input Validation & Dynamic Flight Spline Animation
  // ==========================================================================
  initScreen03Events() {
    document.getElementById('btn-proceed-processing')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(4, true);
    });
  }

  runTrajectoryValidation(animate = true) {
    const mission = this.store.getMission();
    const canvas = document.getElementById('screen03-flight-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const waypoints = mission.flightPath || [
      { x: 40, y: 150 }, { x: 90, y: 110 }, { x: 150, y: 80 },
      { x: 210, y: 120 }, { x: 270, y: 140 }, { x: 330, y: 90 },
      { x: 390, y: 70 }, { x: 430, y: 130 }
    ];

    const qcChecks = [
      { id: 'qc-check-1', name: 'Video file valid' },
      { id: 'qc-check-2', name: 'GPS timestamps sync' },
      { id: 'qc-check-3', name: 'Metadata format valid' },
      { id: 'qc-check-4', name: 'IMU data valid' },
      { id: 'qc-check-5', name: 'Camera intrinsics valid' },
      { id: 'qc-check-6', name: 'RTK/PPK data valid' }
    ];

    if (!animate || this.hasRunSimulation) {
      // Instant completed state
      this.drawFlightPath(ctx, canvas, waypoints, 1.0);
      qcChecks.forEach(qc => {
        const row = document.getElementById(qc.id);
        if (row) {
          row.innerHTML = `<i class="fa-solid fa-circle-check check-pass-icon"></i> <span>${qc.name}</span>`;
        }
      });
      const badge = document.getElementById('badge-inputs-status');
      if (badge) {
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> All Inputs Valid';
      }
      return;
    }

    // Dynamic Live Simulation
    // 1. Reset check icons to spinners
    qcChecks.forEach(qc => {
      const row = document.getElementById(qc.id);
      if (row) {
        row.innerHTML = `<span class="check-spinner"></span> <span>${qc.name}</span>`;
      }
    });

    const badge = document.getElementById('badge-inputs-status');
    if (badge) {
      badge.innerHTML = '<span class="check-spinner" style="width: 10px; height: 10px; margin-right: 6px;"></span> Verifying Feasibility...';
    }

    // 2. Animate flight path spline over ~2.0 seconds
    const startTime = performance.now();
    const duration = 2000;

    const animateTrajectory = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      this.drawFlightPath(ctx, canvas, waypoints, progress);

      if (progress < 1.0) {
        this.flightAnimFrame = requestAnimationFrame(animateTrajectory);
      } else {
        this.flightAnimFrame = null;
      }
    };

    if (this.flightAnimFrame) cancelAnimationFrame(this.flightAnimFrame);
    this.flightAnimFrame = requestAnimationFrame(animateTrajectory);

    // 3. Sequentially resolve quality checks every ~300ms
    qcChecks.forEach((qc, idx) => {
      setTimeout(() => {
        const row = document.getElementById(qc.id);
        if (row) {
          row.innerHTML = `<i class="fa-solid fa-circle-check check-pass-icon"></i> <span>${qc.name}</span>`;
        }
        if (idx === qcChecks.length - 1) {
          if (badge) {
            badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> All Inputs Valid';
          }
          // If in automated tour, proceed to processing in 1.8s
          if (this.isTourRunning) {
            this.tourTimer = setTimeout(() => {
              this.showScreen(4, true);
            }, 1800);
          }
        }
      }, 350 * (idx + 1));
    });
  }

  drawFlightPath(ctx, canvas, pts, progress) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Background grid
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 35;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 2. Flight path spline
    const totalSegments = pts.length - 1;
    const currentSegmentIndex = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
    const segmentProgress = (progress * totalSegments) - currentSegmentIndex;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i <= currentSegmentIndex; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }

    if (progress < 1.0 && currentSegmentIndex < totalSegments) {
      const pA = pts[currentSegmentIndex];
      const pB = pts[currentSegmentIndex + 1];
      const curX = pA.x + (pB.x - pA.x) * segmentProgress;
      const curY = pA.y + (pB.y - pA.y) * segmentProgress;
      ctx.lineTo(curX, curY);
    } else if (progress >= 1.0) {
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Start Point (Green dot)
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Start text
    ctx.fillStyle = '#f8fafc';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('Start', pts[0].x - 12, pts[0].y - 10);

    // 4. End Point (Red dot) if reached
    if (progress >= 0.98) {
      const last = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#f8fafc';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText('End', last.x - 10, last.y - 10);
    }
  }

  // ==========================================================================
  // 6. Screen 04: Processing Pipeline Simulation
  // ==========================================================================
  initScreen04Events() {
    document.getElementById('btn-stop-pipeline')?.addEventListener('click', () => {
      this.stopTour();
      alert('Pipeline paused. You can inspect keyframes or proceed manually.');
    });

    document.getElementById('btn-proceed-viewer')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(5);
    });
  }

  runPipelineProcessing(animate = true) {
    const mission = this.store.getMission();
    this.populateKeyframesFilmstrip(mission);
    this.populateSemanticTiles(mission);

    const stages = [
      { id: 'stage-1', name: 'Input Analysis', time: '00:05' },
      { id: 'stage-2', name: 'Keyframe Selection', time: '00:18' },
      { id: 'stage-3', name: 'Scene Understanding', time: '00:32' },
      { id: 'stage-4', name: 'Adaptive 3D Reconstruction', time: '01:10' },
      { id: 'stage-5', name: 'Georeferencing', time: '01:45' },
      { id: 'stage-6', name: 'Metric Validation', time: '02:15' },
      { id: 'stage-7', name: 'Generating Output', time: '02:40' }
    ];

    const currentStageElem = document.getElementById('pipe-current-stage');
    const progressFill = document.getElementById('pipe-progress-fill');
    const etaElem = document.getElementById('pipe-eta-val');

    if (!animate || this.hasRunSimulation) {
      // Completed state
      stages.forEach(s => {
        const item = document.getElementById(s.id);
        if (item) {
          item.className = 'pipeline-stage-item completed';
          const icon = item.querySelector('.stage-status-icon');
          if (icon) icon.className = 'fa-solid fa-circle-check stage-status-icon';
        }
      });
      if (currentStageElem) currentStageElem.textContent = 'Generating Output (Complete)';
      if (progressFill) progressFill.style.width = '100%';
      if (etaElem) etaElem.textContent = 'Ready';
      return;
    }

    // Step-by-step timed execution
    let currentIdx = 0;
    const advanceStage = () => {
      if (currentIdx >= stages.length) {
        if (currentStageElem) currentStageElem.textContent = 'Reconstruction Complete';
        if (progressFill) progressFill.style.width = '100%';
        if (etaElem) etaElem.textContent = 'Finished';

        this.hasRunSimulation = true;

        if (this.isTourRunning) {
          this.tourTimer = setTimeout(() => {
            this.showScreen(5);
          }, 1500);
        }
        return;
      }

      const st = stages[currentIdx];
      if (currentStageElem) currentStageElem.textContent = st.name;
      const pct = Math.round(((currentIdx + 1) / stages.length) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (etaElem) etaElem.textContent = `ETA: ~${Math.max(1, 7 - currentIdx)} min`;

      // Set current stage to running
      const item = document.getElementById(st.id);
      if (item) {
        item.className = 'pipeline-stage-item running';
        const icon = item.querySelector('.stage-status-icon');
        if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin stage-status-icon';
      }

      // After 450ms, mark completed and move next
      setTimeout(() => {
        if (item) {
          item.className = 'pipeline-stage-item completed';
          const icon = item.querySelector('.stage-status-icon');
          if (icon) icon.className = 'fa-solid fa-circle-check stage-status-icon';
        }
        currentIdx++;
        advanceStage();
      }, 450);
    };

    advanceStage();
  }

  populateKeyframesFilmstrip(mission) {
    const strip = document.getElementById('pipeline-filmstrip');
    if (!strip) return;
    strip.innerHTML = '';

    const kfCountElem = document.getElementById('pipe-kf-count');
    const totalFramesElem = document.getElementById('pipe-total-frames');
    if (kfCountElem) kfCountElem.textContent = mission.frameCount;
    if (totalFramesElem) totalFramesElem.textContent = mission.gpsRecords ? mission.gpsRecords.split(' ')[0] : '18,000';

    // Differentiated sharpness scores matching user requirement!
    const sampleScores = [0.98, 0.94, 0.89, 0.96, 0.91, 0.97, 0.93, 0.95];
    const frameIndices = mission.keyframeIndices || [1, 24, 68, 112, 185, 240, 310, 385];

    frameIndices.slice(0, 8).forEach((fIdx, i) => {
      const paddedNum = String(fIdx).padStart(4, '0');
      const imgPath = `${mission.framesDir}${mission.framePrefix}${paddedNum}${mission.frameExt}`;
      const score = sampleScores[i % sampleScores.length];

      const thumb = document.createElement('div');
      thumb.className = 'keyframe-film-thumb';
      thumb.innerHTML = `
        <img src="${imgPath}" alt="Frame ${fIdx}" onerror="this.src='datasets/frames_pb2/frame_0001.jpg'">
        <div class="keyframe-score-label">
          <span>#${fIdx}</span>
          <span>Score: ${score.toFixed(2)}</span>
        </div>
      `;
      strip.appendChild(thumb);
    });
  }

  populateSemanticTiles(mission) {
    const container = document.getElementById('semantic-tiles-container');
    if (!container) return;
    container.innerHTML = '';

    const labels = [
      { name: 'Buildings', color: 'rgba(0, 240, 255, 0.25)', border: 'var(--as-cyan)' },
      { name: 'Roads', color: 'rgba(96, 165, 250, 0.25)', border: '#60a5fa' },
      { name: 'Vegetation', color: 'rgba(16, 185, 129, 0.25)', border: 'var(--as-green)' },
      { name: 'Vehicles', color: 'rgba(192, 132, 252, 0.25)', border: '#c084fc' }
    ];

    const frameIndices = mission.keyframeIndices || [1, 24, 68, 112];

    labels.forEach((lbl, i) => {
      const fIdx = frameIndices[i] || 1;
      const paddedNum = String(fIdx).padStart(4, '0');
      const imgPath = `${mission.framesDir}${mission.framePrefix}${paddedNum}${mission.frameExt}`;

      const tile = document.createElement('div');
      tile.className = 'semantic-tile';
      tile.innerHTML = `
        <img src="${imgPath}" alt="${lbl.name}" onerror="this.src='datasets/frames_pb2/frame_0001.jpg'">
        <div class="semantic-tile-overlay" style="background: ${lbl.color}; border-color: ${lbl.border};">
          <span style="position: absolute; bottom: 4px; left: 4px; font-size: 0.65rem; font-weight: 700; color: #ffffff; background: rgba(0,0,0,0.7); padding: 1px 4px; border-radius: 3px;">
            ${lbl.name}
          </span>
        </div>
      `;
      container.appendChild(tile);
    });
  }

  // ==========================================================================
  // 7. Screen 05: 3D Viewer & Studio (Auto-Fit, Centered, Facing Forward)
  // ==========================================================================
  initScreen05Viewer() {
    // Navigation back & forward pills
    document.getElementById('btn-viewer-back-process')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(4, false);
    });

    document.getElementById('btn-viewer-go-export')?.addEventListener('click', () => {
      this.stopTour();
      this.showScreen(6);
    });

    // Subnav Tabs
    document.getElementById('vtab-3d')?.addEventListener('click', () => this.setViewerMode('3d'));
    document.getElementById('vtab-ortho')?.addEventListener('click', () => this.setViewerMode('ortho'));
    document.getElementById('vtab-points')?.addEventListener('click', () => this.setViewerMode('points'));
    document.getElementById('vtab-evidence')?.addEventListener('click', () => this.setViewerMode('evidence'));

    // Layer checkboxes
    document.getElementById('layer-mesh')?.addEventListener('change', (e) => {
      if (this.viewer?.currentMesh) this.viewer.currentMesh.visible = e.target.checked;
    });

    document.getElementById('layer-points')?.addEventListener('change', (e) => {
      if (this.viewer?.pointCloudMesh) this.viewer.pointCloudMesh.visible = e.target.checked;
    });

    // Measurement tab buttons
    document.getElementById('mtab-dist')?.addEventListener('click', () => this.setMeasureMode('dist'));
    document.getElementById('mtab-area')?.addEventListener('click', () => this.setMeasureMode('area'));
    document.getElementById('mtab-elev')?.addEventListener('click', () => this.setMeasureMode('elev'));

    // Zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      if (this.viewer?.camera) this.viewer.camera.position.multiplyScalar(0.85);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      if (this.viewer?.camera) this.viewer.camera.position.multiplyScalar(1.15);
    });

    document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
      this.resetViewerCamera();
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      const v = document.getElementById('screen-05-viewer');
      if (!document.fullscreenElement) {
        v?.requestFullscreen().catch(err => console.log(err));
      } else {
        document.exitFullscreen().catch(err => console.log(err));
      }
    });
  }

  setupThreeScene() {
    const canvas = document.getElementById('screen05-webgl-canvas');
    if (!canvas) return;

    const parent = canvas.parentElement;
    const width = parent.clientWidth || 800;
    const height = parent.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090e1a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(-28, 22, -64);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't flip under the floor
    controls.target.set(0, 4, 0);

    // Grid Floor on Y=0
    const gridHelper = new THREE.GridHelper(80, 40, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Realistic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.6);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(45, 80, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 0.4);
    dirLight2.position.set(-40, 30, -40);
    scene.add(dirLight2);

    const modelContainer = new THREE.Group();
    scene.add(modelContainer);

    this.viewer = {
      scene,
      camera,
      renderer,
      controls,
      modelContainer,
      currentMesh: null,
      pointCloudMesh: null,
      roiBox: null,
      onResize: () => {
        const w = parent.clientWidth || 800;
        const h = parent.clientHeight || 600;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    window.addEventListener('resize', () => {
      if (this.currentScreen === 5) this.viewer?.onResize();
    });

    // Raycaster for inspection & measurement
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(modelContainer.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0].point;
        this.handle3DClick(hit);
      }
    });

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      // Rotate Compass Rose to match camera azimuth
      const compassArrow = document.querySelector('.compass-arrow-n');
      if (compassArrow) {
        const angle = Math.atan2(camera.position.x, camera.position.z) * (180 / Math.PI);
        compassArrow.style.transform = `rotate(${-angle}deg)`;
      }
    };
    animate();

    // Load initial model (PB2 Svalbard)
    this.loadMissionModel(this.store.getMission());
  }

  loadMissionModel(mission) {
    if (!this.viewer) return;

    this.viewer.modelContainer.clear();
    if (this.viewer.roiBox) {
      this.viewer.scene.remove(this.viewer.roiBox);
      this.viewer.roiBox = null;
    }
    this.clearMeasurement();

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      mission.glbUrl,
      (gltf) => {
        const rawModel = gltf.scene;

        // Auto-Fit Bounding Box Calculation
        const bbox = new THREE.Box3().setFromObject(rawModel);
        const rawSize = bbox.getSize(new THREE.Vector3());

        // Desired bounding dimensions inside studio viewport
        const targetW = 40;
        const targetD = 42;
        const targetH = 22;
        const scaleH = Math.min(targetW / Math.max(rawSize.x, 0.001), targetD / Math.max(rawSize.z, 0.001));
        const autoScale = (rawSize.y * scaleH > targetH) ? (targetH / Math.max(rawSize.y, 0.001)) : scaleH;
        const finalScale = (mission.viewerSettings?.scale || 1.0) * autoScale;

        rawModel.scale.setScalar(finalScale);
        rawModel.updateMatrixWorld(true);

        // Center on X and Z, rest bottom exactly on Y=0
        const scaledBox = new THREE.Box3().setFromObject(rawModel);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        rawModel.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
        rawModel.updateMatrixWorld(true);

        this.viewer.modelContainer.add(rawModel);
        this.viewer.currentMesh = rawModel;

        // Bounding wireframe box
        const finalBox = new THREE.Box3().setFromObject(this.viewer.modelContainer);
        const finalSize = finalBox.getSize(new THREE.Vector3());
        const finalCenter = finalBox.getCenter(new THREE.Vector3());

        const boxGeom = new THREE.BoxGeometry(finalSize.x * 1.05, finalSize.y * 1.05, finalSize.z * 1.05);
        const boxEdges = new THREE.EdgesGeometry(boxGeom);
        const boxMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.5 });
        this.viewer.roiBox = new THREE.LineSegments(boxEdges, boxMat);
        this.viewer.roiBox.position.copy(finalCenter);
        this.viewer.scene.add(this.viewer.roiBox);

        // Camera placement looking forward at the model
        this.viewer.camera.position.set(
          mission.viewerSettings?.cameraPos?.[0] || -28,
          mission.viewerSettings?.cameraPos?.[1] || 22,
          mission.viewerSettings?.cameraPos?.[2] || -64
        );
        this.viewer.controls.target.set(0, finalSize.y * 0.45, 0);
        this.viewer.controls.update();

        // Auto-rotation during automated tour
        if (this.isTourRunning) {
          this.viewer.controls.autoRotate = true;
          this.viewer.controls.autoRotateSpeed = 2.0;
          setTimeout(() => {
            if (this.viewer?.controls) this.viewer.controls.autoRotate = false;
          }, 3800);
        }
      },
      undefined,
      (err) => {
        console.error('Error loading 3D model:', err);
      }
    );
  }

  resetViewerCamera() {
    const mission = this.store.getMission();
    if (!this.viewer) return;
    this.viewer.camera.position.set(
      mission.viewerSettings?.cameraPos?.[0] || -28,
      mission.viewerSettings?.cameraPos?.[1] || 22,
      mission.viewerSettings?.cameraPos?.[2] || -64
    );
    this.viewer.controls.target.set(0, 4, 0);
    this.viewer.controls.update();
  }

  setViewerMode(mode) {
    const tabs = ['3d', 'ortho', 'points', 'evidence'];
    tabs.forEach(t => {
      const btn = document.getElementById(`vtab-${t}`);
      btn?.classList.remove('active');
      if (t === mode) btn?.classList.add('active');
    });

    if (!this.viewer) return;

    if (mode === '3d') {
      this.resetViewerCamera();
      if (this.viewer.currentMesh) {
        this.viewer.currentMesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.wireframe = false;
          }
        });
      }
    } else if (mode === 'ortho') {
      // Top-down orthographic angle
      this.viewer.camera.position.set(0, 75, 0.01);
      this.viewer.controls.target.set(0, 0, 0);
      this.viewer.controls.update();
    } else if (mode === 'points') {
      if (this.viewer.currentMesh) {
        this.viewer.currentMesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.wireframe = true;
          }
        });
      }
    } else if (mode === 'evidence') {
      this.resetViewerCamera();
      // Heatmap tint
      if (this.viewer.currentMesh) {
        this.viewer.currentMesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.wireframe = false;
          }
        });
      }
    }
  }

  setMeasureMode(mode) {
    this.measureMode = mode;
    ['dist', 'area', 'elev'].forEach(m => {
      const btn = document.getElementById(`mtab-${m}`);
      btn?.classList.remove('active');
      if (m === mode) btn?.classList.add('active');
    });
  }

  handle3DClick(pt) {
    // Update Point Info HUD
    const baseLat = 78.2232;
    const baseLon = 15.6267;
    const hitLat = (baseLat + pt.z * 0.0001).toFixed(4);
    const hitLon = (baseLon + pt.x * 0.0001).toFixed(4);
    const hitElev = (42.4 + pt.y * 1.5).toFixed(1);

    const latElem = document.getElementById('hud-point-lat');
    const lonElem = document.getElementById('hud-point-lon');
    const elevElem = document.getElementById('hud-point-elev');
    if (latElem) latElem.textContent = `${hitLat}° N`;
    if (lonElem) lonElem.textContent = `${hitLon}° E`;
    if (elevElem) elevElem.textContent = `${hitElev} m MSL`;

    // Measurement logic (Point A -> Point B)
    this.measurePoints.push(pt);

    const sphereGeom = new THREE.SphereGeometry(0.6, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: this.measurePoints.length === 1 ? 0x10b981 : 0x00f0ff });
    const marker = new THREE.Mesh(sphereGeom, sphereMat);
    marker.position.copy(pt);
    this.viewer.scene.add(marker);
    this.measureMarkers.push(marker);

    if (this.measurePoints.length === 1) {
      const ptA = document.getElementById('hud-point-a-coords');
      if (ptA) ptA.textContent = `${hitLat}° N, ${hitLon}° E`;
    } else if (this.measurePoints.length === 2) {
      const p1 = this.measurePoints[0];
      const p2 = this.measurePoints[1];
      const dist = p1.distanceTo(p2) * 5.2; // Scaled to metric ground meters

      const ptB = document.getElementById('hud-point-b-coords');
      if (ptB) ptB.textContent = `${hitLat}° N, ${hitLon}° E`;

      const distElem = document.getElementById('hud-measure-dist-val');
      if (distElem) distElem.textContent = `${dist.toFixed(1)} m`;

      const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
      this.measureLine = new THREE.Line(lineGeom, lineMat);
      this.viewer.scene.add(this.measureLine);
    } else if (this.measurePoints.length > 2) {
      this.clearMeasurement();
      this.handle3DClick(pt);
    }
  }

  clearMeasurement() {
    this.measurePoints = [];
    this.measureMarkers.forEach(m => this.viewer?.scene.remove(m));
    this.measureMarkers = [];
    if (this.measureLine) {
      this.viewer?.scene.remove(this.measureLine);
      this.measureLine = null;
    }
  }

  // ==========================================================================
  // 8. Screen 06: Validation & Export Events
  // ==========================================================================
  initScreen06Events() {
    document.getElementById('btn-download-all')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      const exportData = {
        mission: mission.name,
        code: mission.code,
        crs: mission.crsDatum,
        reprojectionError: mission.reprojectionError,
        spatialAccuracy: mission.spatialAccuracy,
        coverage: mission.coverage,
        meshFaces: mission.meshFaces,
        timestamp: new Date().toISOString(),
        evidence: mission.evidence
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AeroSculpt_${mission.id}_Reconstruction_Package.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  renderScreen06Metrics() {
    const mission = this.store.getMission();

    const reprojElem = document.getElementById('exp-reproj-val');
    const covElem = document.getElementById('exp-coverage-val');
    const accElem = document.getElementById('exp-accuracy-val');
    const totFramesElem = document.getElementById('exp-total-frames');
    const kfElem = document.getElementById('exp-keyframes');
    const procTimeElem = document.getElementById('exp-proc-time');
    const outSizeElem = document.getElementById('exp-output-size');

    if (reprojElem) reprojElem.textContent = mission.reprojectionError;
    if (covElem) covElem.textContent = mission.coverage;
    if (accElem) accElem.textContent = `~${mission.spatialAccuracy} (Est.)`;
    if (totFramesElem) totFramesElem.textContent = mission.gpsRecords ? mission.gpsRecords.split(' ')[0] : '18,000';
    if (kfElem) kfElem.textContent = mission.frameCount;
    if (procTimeElem) procTimeElem.textContent = mission.reconstructionTime;
    if (outSizeElem) outSizeElem.textContent = mission.outputSize;

    // Donut percentages
    const obs = mission.evidence?.observed || 62.3;
    const recon = mission.evidence?.reconstructed || 24.1;
    const inf = mission.evidence?.inferred || 9.8;
    const unk = mission.evidence?.unknown || 3.8;

    document.getElementById('donut-pct-obs').textContent = `${obs}%`;
    document.getElementById('donut-pct-recon').textContent = `${recon}%`;
    document.getElementById('donut-pct-inf').textContent = `${inf}%`;
    document.getElementById('donut-pct-unk').textContent = `${unk}%`;
  }

  // ==========================================================================
  // 9. Automated Demo Tour (Hands-Free Evaluator Walkthrough)
  // ==========================================================================
  startAutomatedDemoTour(missionId = 'pb2') {
    this.stopTour();
    this.isTourRunning = true;
    this.hasRunSimulation = false;
    this.switchMission(missionId);

    // Step 1: Start on Screen 02 (Upload & Configuration)
    this.showScreen(2);

    // After 2.0s, advance to Screen 03 (Input Validation)
    this.tourTimer = setTimeout(() => {
      if (!this.isTourRunning) return;
      this.showScreen(3, true);
      // Screen 03 dynamically advances to Screen 04 after quality checks complete (~3.8s)
    }, 2000);
  }

  stopTour() {
    this.isTourRunning = false;
    if (this.tourTimer) {
      clearTimeout(this.tourTimer);
      this.tourTimer = null;
    }
    if (this.flightAnimFrame) {
      cancelAnimationFrame(this.flightAnimFrame);
      this.flightAnimFrame = null;
    }
  }

  // ==========================================================================
  // 10. Data Hydration Across All Screens
  // ==========================================================================
  hydrateMissionData(mission) {
    if (!mission) return;

    // Stepper label
    const stepLabel = document.getElementById('stepper-mission-label');
    if (stepLabel) stepLabel.textContent = `${mission.code} · ${mission.name}`;

    // Screen 02 Card Values
    const vThumb = document.getElementById('file-video-preview');
    if (vThumb) vThumb.src = mission.videoUrl;

    const vName = document.getElementById('card-val-video-name');
    if (vName) vName.textContent = mission.videoUrl.split('/').pop();

    const vSpecs = document.getElementById('card-val-video-specs');
    if (vSpecs) vSpecs.textContent = `${mission.videoDuration} | ${mission.videoResolution} | ${mission.frameRate} | ${mission.rawVideoSize}`;

    const gpsName = document.getElementById('card-val-gps-name');
    if (gpsName) gpsName.textContent = mission.gpsFile;

    const gpsSpecs = document.getElementById('card-val-gps-specs');
    if (gpsSpecs) gpsSpecs.textContent = mission.gpsRecords;

    const metaName = document.getElementById('card-val-meta-name');
    if (metaName) metaName.textContent = mission.metaFile;

    const metaSpecs = document.getElementById('card-val-meta-specs');
    if (metaSpecs) metaSpecs.textContent = `Platform: ${mission.uavPlatform.split(' ')[0]} | Area: ${mission.sceneCategory}`;

    // Screen 03 Mission Summary Table
    const statDur = document.getElementById('stat-duration');
    if (statDur) statDur.textContent = `${mission.videoDuration} (${mission.videoDurationSec} s)`;

    const statRes = document.getElementById('stat-res');
    if (statRes) statRes.textContent = mission.videoResolution;

    const statFps = document.getElementById('stat-fps');
    if (statFps) statFps.textContent = mission.frameRate;

    const statTot = document.getElementById('stat-total-frames');
    if (statTot) statTot.textContent = mission.gpsRecords.split(' ')[0];

    const statGps = document.getElementById('stat-gps');
    if (statGps) statGps.textContent = mission.gpsRecords;

    const statCam = document.getElementById('stat-camera');
    if (statCam) statCam.textContent = mission.cameraSensor.split('(')[0];

    const statArea = document.getElementById('stat-area-type');
    if (statArea) statArea.textContent = mission.sceneType;

    const statProc = document.getElementById('stat-est-proc');
    if (statProc) statProc.textContent = mission.reconstructionTime;

    const crsUtm = document.getElementById('val-crs-utm');
    if (crsUtm) crsUtm.textContent = mission.crsName;

    // Screen 05 HUD
    const hudThumb = document.getElementById('hud-point-thumb');
    if (hudThumb) hudThumb.src = `${mission.framesDir}${mission.framePrefix}0001${mission.frameExt}`;

    const hudCrs = document.getElementById('hud-point-crs');
    if (hudCrs) hudCrs.textContent = mission.crsDatum.split(' ')[0];
  }

  // ==========================================================================
  // 11. Documentation Modal
  // ==========================================================================
  initDocsModal() {
    const modal = document.getElementById('modal-docs');
    const btnClose = document.getElementById('btn-close-docs-modal');
    const btnFooterClose = document.getElementById('btn-close-docs-footer');

    btnClose?.addEventListener('click', () => modal?.classList.remove('active'));
    btnFooterClose?.addEventListener('click', () => modal?.classList.remove('active'));

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  openDocsModal() {
    document.getElementById('modal-docs')?.classList.add('active');
  }
}

// Instantiate application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.aerosculptApp = new AeroSculptApp();
});
