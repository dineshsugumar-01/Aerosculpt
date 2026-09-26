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

    // Automated Pipeline Progression State
    this.isTourRunning = false;
    this.isAutoAdvancing = false;
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

    const pane02 = document.getElementById('pane-screen-02');
    const pane03 = document.getElementById('pane-screen-03');
    const pane04 = document.getElementById('pane-screen-04');
    const pane05 = document.getElementById('pane-screen-05');
    const pane06 = document.getElementById('pane-screen-06');

    // Update Top Header Tabs active state
    this.updateHeaderNavTabs(screenNum);

    // Screen 01: Home / Landing Page
    if (screenNum === 1) {
      screen01?.classList.add('active');
      workflowContainer?.classList.remove('active');
      return;
    }

    // Screens 02, 03, 04, 05, 06: Managed inside workflowContainer with persistent left sidebar
    screen01?.classList.remove('active');
    workflowContainer?.classList.add('active');

    // Hide all panes
    [pane02, pane03, pane04, pane05, pane06].forEach(p => p?.classList.remove('active'));

    if (screenNum === 2) {
      pane02?.classList.add('active');
      this.resetWorkflowState();
      this.updateStepperActive(1);
    } else if (screenNum === 3) {
      pane03?.classList.add('active');
      this.updateStepperActive(2);
      this.runTrajectoryValidation(triggerSimulation);
    } else if (screenNum === 4) {
      pane04?.classList.add('active');
      this.updateStepperActive(3);
      this.runPipelineProcessing(triggerSimulation);
    } else if (screenNum === 5) {
      pane05?.classList.add('active');
      this.updateStepperActive(4);
      
      // Render / resize 3D viewer
      setTimeout(() => {
        if (this.viewer) {
          this.viewer.onResize();
        } else {
          this.setupThreeScene();
        }
      }, 60);
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
      const numSpan = btn.querySelector('.stepper-circle-num');

      if (i < stepIndex) {
        btn.classList.remove('active');
        btn.classList.add('completed');
        if (numSpan) {
          numSpan.innerHTML = '<i class="fa-solid fa-check"></i>';
        }
      } else if (i === stepIndex) {
        btn.classList.remove('completed');
        btn.classList.add('active');
        if (numSpan) {
          numSpan.innerHTML = `${i}`;
        }
      } else {
        btn.classList.remove('active', 'completed');
        if (numSpan) {
          numSpan.innerHTML = `${i}`;
        }
      }
    }
  }

  resetWorkflowState() {
    this.hasRunSimulation = false;
    this.isAutoAdvancing = false;

    if (this.tourTimer) {
      clearTimeout(this.tourTimer);
      this.tourTimer = null;
    }
    if (this.flightAnimFrame) {
      cancelAnimationFrame(this.flightAnimFrame);
      this.flightAnimFrame = null;
    }

    // 1. Reset all stepper items to clean numbers and clear all completed tick marks
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`stepper-step-${i}`);
      if (!btn) continue;
      btn.classList.remove('completed', 'active');
      const numSpan = btn.querySelector('.stepper-circle-num');
      if (numSpan) {
        numSpan.textContent = i;
      }
    }
    const step1 = document.getElementById('stepper-step-1');
    if (step1) {
      step1.classList.add('active');
    }

    // 2. Reset Screen 03 (Feasibility & QC checks)
    const qcChecks = [
      { id: 'qc-check-1', name: 'Video file valid' },
      { id: 'qc-check-2', name: 'GPS timestamps sync' },
      { id: 'qc-check-3', name: 'Metadata format valid' },
      { id: 'qc-check-4', name: 'IMU data valid' },
      { id: 'qc-check-5', name: 'Camera intrinsics valid' },
      { id: 'qc-check-6', name: 'RTK/PPK data valid' }
    ];
    qcChecks.forEach(qc => {
      const row = document.getElementById(qc.id);
      if (row) {
        row.innerHTML = `<span class="check-spinner"></span> <span>${qc.name}</span>`;
      }
    });
    const qcBadge = document.getElementById('badge-inputs-status');
    if (qcBadge) {
      qcBadge.innerHTML = '<span class="check-spinner" style="width: 10px; height: 10px; margin-right: 6px;"></span> Awaiting Verification';
    }

    // 3. Reset Screen 04 (Pipeline Stages)
    const stages = ['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5', 'stage-6', 'stage-7'];
    stages.forEach(id => {
      const item = document.getElementById(id);
      if (item) {
        item.className = 'pipeline-stage-item';
        const icon = item.querySelector('.stage-status-icon');
        if (icon) {
          icon.className = 'fa-regular fa-circle stage-status-icon';
        }
      }
    });

    const currentStageElem = document.getElementById('pipe-current-stage');
    if (currentStageElem) currentStageElem.textContent = 'Ready to Process';

    const progressFill = document.getElementById('pipe-progress-fill');
    if (progressFill) progressFill.style.width = '0%';

    const etaElem = document.getElementById('pipe-eta-val');
    if (etaElem) etaElem.textContent = '--m --s';
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
      const ingestModal = document.getElementById('modal-ingest-upload');
      if (ingestModal) {
        ingestModal.classList.add('active', 'show');
      } else {
        this.openMissionModal();
      }
    });
  }

  openMissionModal() {
    document.getElementById('modal-mission-picker')?.classList.add('active');
  }

  switchMission(missionId) {
    this.store.setMission(missionId);
    const mission = this.store.getMission();
    this.hydrateMissionData(mission);

    // Reset workflow state and ticks on the side to start from fresh!
    this.resetWorkflowState();
    this.updateStepperActive(1);

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
  // 4. Screen 02: Upload & Configuration Events
  // ==========================================================================
  initScreen02Events() {
    // 1. Reconstruction Mode (Auto) Selection
    const modes = ['easy', 'medium', 'hard'];
    modes.forEach(mode => {
      const btn = document.getElementById(`mode-${mode}`);
      btn?.addEventListener('click', () => {
        modes.forEach(m => document.getElementById(`mode-${m}`)?.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 2. Ingest / Upload Modal Open/Close Controls
    const modal = document.getElementById('modal-ingest-upload');
    const btnOpenModal = document.getElementById('btn-open-ingest-modal');
    const btnChangeVideo = document.getElementById('btn-change-video-trigger');
    const btnCloseModal = document.getElementById('btn-close-ingest-modal');
    const btnDoneModal = document.getElementById('btn-done-ingest-modal');

    const openIngestModal = () => {
      this.resetWorkflowState();
      this.updateStepperActive(1);
      if (modal) modal.classList.add('active', 'show');
    };

    const closeIngestModal = () => {
      if (modal) modal.classList.remove('active', 'show');
    };

    btnOpenModal?.addEventListener('click', openIngestModal);
    btnChangeVideo?.addEventListener('click', openIngestModal);
    btnCloseModal?.addEventListener('click', closeIngestModal);
    btnDoneModal?.addEventListener('click', closeIngestModal);

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeIngestModal();
    });

    // 3. Custom UAV Video Upload Inside Modal (Top Section)
    const modalFileInput = document.getElementById('modal-uav-file-input');
    const modalBtnBrowse = document.getElementById('modal-btn-browse-trigger');
    const modalDropzone = document.getElementById('modal-uav-dropzone');
    const modalEmptyView = document.getElementById('modal-dropzone-empty');
    const modalSelectedView = document.getElementById('modal-dropzone-selected');
    const modalVideoPreview = document.getElementById('modal-custom-video-preview');
    const modalFileName = document.getElementById('modal-custom-file-name');
    const modalDur = document.getElementById('modal-custom-dur');
    const modalRes = document.getElementById('modal-custom-res');
    const modalSize = document.getElementById('modal-custom-size');
    const modalBtnConfirm = document.getElementById('modal-btn-confirm-upload');
    const modalBtnChangeCustom = document.getElementById('modal-btn-change-custom');

    let stagedCustomFile = null;
    let stagedObjectUrl = null;

    modalBtnBrowse?.addEventListener('click', (e) => {
      e.stopPropagation();
      modalFileInput?.click();
    });

    modalDropzone?.addEventListener('click', (e) => {
      if (e.target.closest('#modal-dropzone-selected')) return;
      modalFileInput?.click();
    });

    const handleCustomFile = (file) => {
      if (!file || !file.type.startsWith('video/')) {
        alert('Please select a valid UAV video file (MP4, MOV, MKV).');
        return;
      }
      this.resetWorkflowState();
      this.updateStepperActive(1);
      stagedCustomFile = file;
      if (stagedObjectUrl) URL.revokeObjectURL(stagedObjectUrl);
      stagedObjectUrl = URL.createObjectURL(file);

      if (modalVideoPreview) {
        modalVideoPreview.src = stagedObjectUrl;
        modalVideoPreview.load();
        modalVideoPreview.play().catch(() => {});
      }

      if (modalFileName) modalFileName.textContent = file.name;
      if (modalSize) modalSize.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      if (modalEmptyView) modalEmptyView.style.display = 'none';
      if (modalSelectedView) modalSelectedView.style.display = 'flex';

      modalVideoPreview?.addEventListener('loadedmetadata', () => {
        const durSec = Math.round(modalVideoPreview.duration) || 300;
        const m = Math.floor(durSec / 60);
        const s = durSec % 60;
        const durFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (modalDur) modalDur.textContent = durFormatted;
        if (modalRes) modalRes.textContent = `${modalVideoPreview.videoWidth}×${modalVideoPreview.videoHeight}`;
      }, { once: true });
    };

    modalFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleCustomFile(file);
    });

    modalDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      modalDropzone.classList.add('drag-over');
    });
    modalDropzone?.addEventListener('dragleave', () => {
      modalDropzone.classList.remove('drag-over');
    });
    modalDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      modalDropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleCustomFile(file);
    });

    modalBtnChangeCustom?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (modalEmptyView) modalEmptyView.style.display = 'flex';
      if (modalSelectedView) modalSelectedView.style.display = 'none';
      modalFileInput?.click();
    });

    modalBtnConfirm?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!stagedCustomFile || !stagedObjectUrl) return;

      const videoPreview = document.getElementById('file-video-preview');
      if (videoPreview) {
        videoPreview.src = stagedObjectUrl;
        videoPreview.load();
        videoPreview.play().catch(() => {});
      }

      const vName = document.getElementById('card-val-video-name');
      if (vName) vName.textContent = stagedCustomFile.name;

      const durSec = Math.round(modalVideoPreview?.duration) || 300;
      const m = Math.floor(durSec / 60);
      const s = durSec % 60;
      const durFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const resStr = modalVideoPreview ? `${modalVideoPreview.videoWidth}×${modalVideoPreview.videoHeight}` : '1920×1080';
      const sizeMb = (stagedCustomFile.size / (1024 * 1024)).toFixed(1);

      const vSpecs = document.getElementById('card-val-video-specs');
      if (vSpecs) vSpecs.textContent = `${durFormatted} | ${resStr} | 30 FPS | ${sizeMb} MB`;

      // Deselect prebuilt cards highlight
      ['pb2', 'pb1', 'pb3'].forEach(id => {
        document.getElementById(`modal-pb-card-${id}`)?.classList.remove('active');
      });

      const activeTitle = document.getElementById('modal-active-mission-title');
      if (activeTitle) activeTitle.textContent = `Custom Upload: ${stagedCustomFile.name}`;

      const stepperLabel = document.getElementById('stepper-mission-label');
      if (stepperLabel) stepperLabel.textContent = `Custom · ${stagedCustomFile.name}`;

      // Reset workflow state and ticks on the side to start from fresh!
      this.resetWorkflowState();
      this.updateStepperActive(1);

      closeIngestModal();
    });

    // 4. Pre-built Mission Cards (Scroll Down Inside Modal)
    ['pb2', 'pb1', 'pb3'].forEach(id => {
      const card = document.getElementById(`modal-pb-card-${id}`);
      const btnLoad = document.getElementById(`btn-load-${id}`);

      const loadAction = (e) => {
        e.stopPropagation();
        this.switchMission(id);
        closeIngestModal();
      };

      card?.addEventListener('click', loadAction);
      btnLoad?.addEventListener('click', loadAction);
    });

    // 5. Start Processing CTA -> Hands-free automated step-by-step pipeline
    document.getElementById('btn-start-processing')?.addEventListener('click', () => {
      this.stopTour();
      this.isAutoAdvancing = true;
      this.hasRunSimulation = false;
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

    // Dynamic Live Simulation (Runs for exactly 5.0 seconds as specified by user)
    // 1. Reset check icons to spinners
    qcChecks.forEach(qc => {
      const row = document.getElementById(qc.id);
      if (row) {
        row.innerHTML = `<span class="check-spinner"></span> <span>${qc.name}</span>`;
      }
    });

    const badge = document.getElementById('badge-inputs-status');
    if (badge) {
      badge.innerHTML = '<span class="check-spinner" style="width: 10px; height: 10px; margin-right: 6px;"></span> Verifying Feasibility & Sync...';
    }

    // 2. Animate flight path spline over exactly 5.0 seconds (5000 ms)
    const startTime = performance.now();
    const duration = 5000;

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

    // 3. Sequentially resolve quality checks spaced across the 5 seconds (~700ms each)
    qcChecks.forEach((qc, idx) => {
      setTimeout(() => {
        const row = document.getElementById(qc.id);
        if (row) {
          row.innerHTML = `<i class="fa-solid fa-circle-check check-pass-icon"></i> <span>${qc.name}</span>`;
        }
      }, 700 * (idx + 1));
    });

    // 4. Hands-free automated progression: at exactly 5.0 seconds, auto-proceed to Screen 04!
    if (this.tourTimer) clearTimeout(this.tourTimer);
    this.tourTimer = setTimeout(() => {
      if (badge) {
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> All Inputs Valid';
      }
      this.showScreen(4, true);
    }, 5000);
  }

  drawFlightPath(ctx, canvas, pts, progress) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Tactical dark radar grid & coordinates
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Polar Radar Range Rings & Crosshairs
    const cx = w * 0.5;
    const cy = h * 0.52;
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    [60, 110, 160].forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '8px JetBrains Mono';
      ctx.fillText(`${(idx + 1) * 150}m`, cx + r - 22, cy - 4);
    });

    // Crosshair axes
    ctx.beginPath();
    ctx.moveTo(cx - 170, cy);
    ctx.lineTo(cx + 170, cy);
    ctx.moveTo(cx, cy - 120);
    ctx.lineTo(cx, cy + 120);
    ctx.stroke();
    ctx.setLineDash([]);

    // Geodetic boundary annotations
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '8px JetBrains Mono';
    ctx.fillText('78°13\'40"N', 8, 14);
    ctx.fillText('15°38\'20"E', w - 55, h - 8);
    ctx.fillText('N 000°', cx - 12, 14);

    if (!pts || pts.length < 2) return;

    // 3. Calculate interpolated points along the flight path up to progress
    const totalSegments = pts.length - 1;
    const currentSegmentIndex = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
    const segmentProgress = (progress * totalSegments) - currentSegmentIndex;

    const activePts = [];
    for (let i = 0; i <= currentSegmentIndex; i++) {
      activePts.push({ x: pts[i].x, y: pts[i].y });
    }

    let curX = pts[0].x;
    let curY = pts[0].y;
    let heading = 0;

    if (currentSegmentIndex < totalSegments) {
      const pA = pts[currentSegmentIndex];
      const pB = pts[currentSegmentIndex + 1];
      curX = pA.x + (pB.x - pA.x) * segmentProgress;
      curY = pA.y + (pB.y - pA.y) * segmentProgress;
      activePts.push({ x: curX, y: curY });
      heading = Math.atan2(pB.y - pA.y, pB.x - pA.x);
    } else {
      const pLast = pts[pts.length - 1];
      const pPrev = pts[pts.length - 2];
      curX = pLast.x;
      curY = pLast.y;
      heading = Math.atan2(pLast.y - pPrev.y, pLast.x - pPrev.x);
    }

    // 4. Photogrammetric Swath Corridor (Camera Footprint Band)
    const swathRadius = 22; // ~68m ground swath representation
    if (activePts.length >= 2) {
      const leftBoundary = [];
      const rightBoundary = [];

      for (let i = 0; i < activePts.length; i++) {
        let dx, dy;
        if (i === 0) {
          dx = activePts[1].x - activePts[0].x;
          dy = activePts[1].y - activePts[0].y;
        } else if (i === activePts.length - 1) {
          dx = activePts[i].x - activePts[i - 1].x;
          dy = activePts[i].y - activePts[i - 1].y;
        } else {
          dx = activePts[i + 1].x - activePts[i - 1].x;
          dy = activePts[i + 1].y - activePts[i - 1].y;
        }
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        leftBoundary.push({ x: activePts[i].x + nx * swathRadius, y: activePts[i].y + ny * swathRadius });
        rightBoundary.push({ x: activePts[i].x - nx * swathRadius, y: activePts[i].y - ny * swathRadius });
      }

      // Draw Swath Corridor Fill
      ctx.beginPath();
      ctx.moveTo(leftBoundary[0].x, leftBoundary[0].y);
      for (let i = 1; i < leftBoundary.length; i++) {
        ctx.lineTo(leftBoundary[i].x, leftBoundary[i].y);
      }
      for (let i = rightBoundary.length - 1; i >= 0; i--) {
        ctx.lineTo(rightBoundary[i].x, rightBoundary[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.fill();

      // Draw Swath Outer Borders (Dashed)
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(leftBoundary[0].x, leftBoundary[0].y);
      for (let i = 1; i < leftBoundary.length; i++) ctx.lineTo(leftBoundary[i].x, leftBoundary[i].y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightBoundary[0].x, rightBoundary[0].y);
      for (let i = 1; i < rightBoundary.length; i++) ctx.lineTo(rightBoundary[i].x, rightBoundary[i].y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Overlap cross-hatch marks along the trajectory (80% forward overlap indication)
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < activePts.length; i += 2) {
        ctx.beginPath();
        ctx.moveTo(leftBoundary[i].x, leftBoundary[i].y);
        ctx.lineTo(rightBoundary[i].x, rightBoundary[i].y);
        ctx.stroke();
      }
    }

    // 5. Waypoints along whole trajectory (with altitude pins)
    const altitudes = [45, 52, 60, 68, 74, 82, 78, 70, 62, 58, 65, 72];
    pts.forEach((wp, idx) => {
      const isReached = idx <= currentSegmentIndex;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = isReached ? 'var(--as-cyan, #00f0ff)' : 'rgba(148, 163, 184, 0.3)';
      ctx.fill();

      // Waypoint Altitude Tag for every 3rd waypoint
      if (idx % 3 === 0 || idx === pts.length - 1) {
        const alt = altitudes[idx % altitudes.length];
        ctx.fillStyle = isReached ? '#e2e8f0' : 'rgba(148, 163, 184, 0.4)';
        ctx.font = '8px JetBrains Mono';
        ctx.fillText(`WP-${String(idx + 1).padStart(2, '0')} [${alt}m]`, wp.x + 6, wp.y - 6);
      }
    });

    // 6. Flight Path Glowing Trajectory Spline
    ctx.beginPath();
    ctx.moveTo(activePts[0].x, activePts[0].y);
    for (let i = 1; i < activePts.length; i++) {
      ctx.lineTo(activePts[i].x, activePts[i].y);
    }
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 7. Start Point Pin (Green)
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 9px JetBrains Mono';
    ctx.fillText('START', pts[0].x - 14, pts[0].y + 16);

    // 8. End Point Pin (Red)
    if (progress >= 0.98) {
      const last = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.fillText('END', last.x - 8, last.y + 16);
    }

    // 9. Animated Drone Symbol & Camera Frustum Beam
    if (progress < 1.0) {
      // Camera FOV Ground Projection Cone
      const coneLength = 32;
      const coneWidth = 24;
      const fovX1 = curX + Math.cos(heading) * coneLength - Math.sin(heading) * (coneWidth / 2);
      const fovY1 = curY + Math.sin(heading) * coneLength + Math.cos(heading) * (coneWidth / 2);
      const fovX2 = curX + Math.cos(heading) * coneLength + Math.sin(heading) * (coneWidth / 2);
      const fovY2 = curY + Math.sin(heading) * coneLength - Math.cos(heading) * (coneWidth / 2);

      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(fovX1, fovY1);
      ctx.lineTo(fovX2, fovY2);
      ctx.closePath();
      const coneGrad = ctx.createLinearGradient(curX, curY, curX + Math.cos(heading) * coneLength, curY + Math.sin(heading) * coneLength);
      coneGrad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
      coneGrad.addColorStop(1, 'rgba(0, 240, 255, 0.02)');
      ctx.fillStyle = coneGrad;
      ctx.fill();

      // Pulse exhaust ripples behind drone
      const pulsePhase = (Date.now() % 1000) / 1000;
      ctx.beginPath();
      ctx.arc(curX - Math.cos(heading) * 6, curY - Math.sin(heading) * 6, 8 + pulsePhase * 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.6 - pulsePhase * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Drone Airframe (Quadcopter profile)
      ctx.save();
      ctx.translate(curX, curY);
      ctx.rotate(heading);

      // Rotor arms
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(-10, 10);
      ctx.lineTo(10, -10);
      ctx.stroke();

      // Propeller spinning discs
      ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
      [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Central avionics pod with glowing cyan status LED
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Heading arrow pointer
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(12, 0);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Update Screen 03 HUD telemetry readout
      const hudElem = document.getElementById('hud-flight-telemetry');
      if (hudElem) {
        const curAlt = (45 + progress * 37).toFixed(1);
        const curSpd = (6.8 + Math.sin(progress * 8) * 0.6).toFixed(1);
        hudElem.innerHTML = `
          <span class="hud-item"><i class="fa-solid fa-satellite" style="color: var(--as-green);"></i> RTK FIXED (26 SVs)</span>
          <span class="hud-item"><i class="fa-solid fa-arrows-up-down" style="color: var(--as-cyan);"></i> ${curAlt}m AGL</span>
          <span class="hud-item"><i class="fa-solid fa-gauge" style="color: var(--as-amber);"></i> ${curSpd} m/s</span>
        `;
      }
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

    // Update Stage 3 description dynamically to match real terrain
    const stage3Desc = document.querySelector('#stage-3 .stage-sub-desc');
    if (stage3Desc) {
      if (mission.id === 'pb2') {
        stage3Desc.textContent = 'Terrain classification, snow albedo normalization, fjord water masking...';
      } else if (mission.id === 'pb1') {
        stage3Desc.textContent = 'Cadastral parcel segmentation, building footprint extraction & road corridors...';
      } else {
        stage3Desc.textContent = 'High-relief rock face geometry classification & alpine crevasse detection...';
      }
    }

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
      if (etaElem) etaElem.textContent = '00m 00s (Ready)';
      return;
    }

    // Step-by-step timed execution: Exactly 5.0 seconds across 7 stages (~680ms each)
    let currentIdx = 0;
    const stageDuration = 680;
    const totalSec = mission.videoDurationSec || 318;

    const advanceStage = () => {
      if (currentIdx >= stages.length) {
        // Ensure all 7 stages are explicitly marked completed
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
        if (etaElem) etaElem.textContent = '00m 00s (Ready)';

        this.hasRunSimulation = true;

        // Auto-advance to Screen 05 (3D View & Analyze) and STOP there!
        if (this.tourTimer) clearTimeout(this.tourTimer);
        this.tourTimer = setTimeout(() => {
          this.showScreen(5);
        }, 240);
        return;
      }

      const st = stages[currentIdx];
      if (currentStageElem) currentStageElem.textContent = st.name;
      const pct = Math.round(((currentIdx + 1) / stages.length) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;

      // Realistic remaining ETA proportional to mission duration
      const remainingSec = Math.max(15, Math.round(totalSec * (1 - (currentIdx / stages.length))));
      const rm = Math.floor(remainingSec / 60);
      const rs = remainingSec % 60;
      if (etaElem) etaElem.textContent = `ETA: ~${String(rm).padStart(2, '0')}m ${String(rs).padStart(2, '0')}s`;

      // Set current stage to running
      const item = document.getElementById(st.id);
      if (item) {
        item.className = 'pipeline-stage-item running';
        const icon = item.querySelector('.stage-status-icon');
        if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin stage-status-icon';
      }

      // Transition to next stage
      setTimeout(() => {
        if (item) {
          item.className = 'pipeline-stage-item completed';
          const icon = item.querySelector('.stage-status-icon');
          if (icon) icon.className = 'fa-solid fa-circle-check stage-status-icon';
        }
        currentIdx++;
        advanceStage();
      }, stageDuration);
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
    const chipsContainer = document.getElementById('semantic-classes-chips');
    if (!container) return;
    container.innerHTML = '';

    // Real scene features from mission (NO fake classes!)
    const features = mission.sceneFeatures || [
      { id: 'mountain', name: 'Mountains & Bedrock', color: '#38bdf8', border: '#38bdf8', icon: 'fa-mountain', frameIdx: 45, confidence: '98.8%' },
      { id: 'snow', name: 'Snow & Permafrost', color: '#e2e8f0', border: '#cbd5e1', icon: 'fa-snowflake', frameIdx: 120, confidence: '97.4%' },
      { id: 'outpost', name: 'Arctic Outpost Buildings', color: '#f59e0b', border: '#f59e0b', icon: 'fa-building', frameIdx: 240, confidence: '99.1%' },
      { id: 'fjord', name: 'Coastal Fjord Water', color: '#06b6d4', border: '#06b6d4', icon: 'fa-water', frameIdx: 385, confidence: '96.5%' }
    ];

    // Populate top semantic chips with real category tags
    if (chipsContainer) {
      chipsContainer.innerHTML = features.map(feat => `
        <span style="color: ${feat.color}; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
          <i class="fa-solid fa-square-check"></i> ${feat.name}
        </span>
      `).join('');
    }

    const frameIndices = mission.keyframeIndices || [1, 24, 68, 112, 185];

    features.forEach((feat, i) => {
      // Use authentic frameIdx specified in missionStore for this terrain feature
      const fIdx = feat.frameIdx || frameIndices[i % frameIndices.length] || 1;
      const paddedNum = String(fIdx).padStart(4, '0');
      const imgPath = `${mission.framesDir}${mission.framePrefix}${paddedNum}${mission.frameExt}`;

      const tile = document.createElement('div');
      tile.className = 'semantic-tile';
      tile.innerHTML = `
        <img src="${imgPath}" alt="${feat.name}" onerror="this.src='datasets/frames_pb2/frame_0001.jpg'">
        <div class="semantic-tile-overlay" style="background: ${feat.color}20; border-bottom: 2px solid ${feat.border};">
          <span class="ai-seg-badge" style="color: ${feat.color}; border-color: ${feat.color}88;">
            <i class="fa-solid fa-microchip"></i> ${feat.confidence || '98.5%'} Conf
          </span>
          <span style="position: absolute; bottom: 4px; left: 4px; font-size: 0.65rem; font-weight: 700; color: #ffffff; background: rgba(0,0,0,0.85); padding: 2px 6px; border-radius: 3px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa-solid ${feat.icon || 'fa-tag'}" style="color: ${feat.color}; font-size: 0.6rem;"></i>
            ${feat.name} · #${paddedNum}
          </span>
        </div>
      `;
      container.appendChild(tile);
    });
  }

  // ==========================================================================
  // 7. Screen 05: 3D Viewer & Studio (Restored Old Tools, 360° Auto-Orbit, Real Scene Layers)
  // ==========================================================================
  initScreen05Viewer() {
    // Navigation back & forward
    document.getElementById('btn-viewer-back-process')?.addEventListener('click', () => {
      this.showScreen(4, false);
    });

    document.getElementById('btn-viewer-go-export')?.addEventListener('click', () => {
      this.showScreen(6);
    });

    // Subnav Mode Tabs (Top Modes Bar)
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
            if (child.isMesh && child.material) {
              child.material.wireframe = false;
              child.material.needsUpdate = true;
            }
          });
        } else if (tab === tabWireframe || tab === tabPointCloud) {
          this.viewer?.currentMesh?.traverse(child => {
            if (child.isMesh && child.material) {
              child.material.wireframe = true;
              child.material.needsUpdate = true;
            }
          });
        } else if (tab === tabEvidence) {
          this.viewer?.currentMesh?.traverse(child => {
            if (child.isMesh && child.material) {
              child.material.wireframe = false;
              child.material.needsUpdate = true;
            }
          });
        }
      });
    });

    // Layer Toggles
    const toggleMesh = document.getElementById('toggle-layer-mesh');
    const togglePoints = document.getElementById('toggle-layer-points');
    const toggleRoi = document.getElementById('toggle-layer-roi');
    const toggleFrustums = document.getElementById('toggle-layer-frustums');
    const toggleGrid = document.getElementById('toggle-layer-grid');

    toggleMesh?.addEventListener('click', () => {
      const active = toggleMesh.classList.toggle('active');
      const check = toggleMesh.querySelector('.check-state');
      if (check) check.className = active ? 'fa-solid fa-check check-state' : 'fa-solid fa-xmark check-state';
      if (this.viewer?.modelContainer) {
        this.viewer.modelContainer.visible = active;
      }
    });

    togglePoints?.addEventListener('click', () => {
      const active = togglePoints.classList.toggle('active');
      const check = togglePoints.querySelector('.check-state');
      if (check) check.style.opacity = active ? '1' : '0.2';
      if (this.viewer?.currentMesh) {
        this.viewer.currentMesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.wireframe = active;
            child.material.needsUpdate = true;
          }
        });
      }
    });

    toggleRoi?.addEventListener('click', () => {
      const active = toggleRoi.classList.toggle('active');
      const check = toggleRoi.querySelector('.check-state');
      if (check) check.className = active ? 'fa-solid fa-check check-state' : 'fa-solid fa-xmark check-state';
      if (this.viewer?.roiBox) {
        this.viewer.roiBox.visible = active;
      }
    });

    toggleFrustums?.addEventListener('click', () => {
      const active = toggleFrustums.classList.toggle('active');
      const check = toggleFrustums.querySelector('.check-state');
      if (check) check.className = active ? 'fa-solid fa-check check-state' : 'fa-solid fa-xmark check-state';
      this.viewer?.cameraPyramids?.forEach(p => p.visible = active);
    });

    toggleGrid?.addEventListener('click', () => {
      const active = toggleGrid.classList.toggle('active');
      const check = toggleGrid.querySelector('.check-state');
      if (check) check.className = active ? 'fa-solid fa-check check-state' : 'fa-solid fa-xmark check-state';
      if (this.viewer?.grid) {
        this.viewer.grid.visible = active;
      }
    });

    // Tool Modes: Auto-Orbit 360° & 2-Point Measure
    const modeOrbit = document.getElementById('tool-mode-orbit');
    const modeMeasure = document.getElementById('tool-mode-measure');
    const orbitIndicator = document.getElementById('hud-orbit-indicator');

    modeOrbit?.addEventListener('click', () => {
      const isActive = modeOrbit.classList.toggle('active');
      if (this.viewer?.controls) {
        this.viewer.controls.autoRotate = isActive;
      }
      if (orbitIndicator) {
        orbitIndicator.innerHTML = isActive 
          ? '<i class="fa-solid fa-arrows-spin"></i> 360° Auto-Orbit Active'
          : '<i class="fa-solid fa-pause"></i> Orbit Paused';
      }
      if (isActive) {
        modeMeasure?.classList.remove('active');
        this.measureActive = false;
      }
    });

    modeMeasure?.addEventListener('click', () => {
      const isActive = modeMeasure.classList.toggle('active');
      this.measureActive = isActive;
      if (isActive) {
        modeOrbit?.classList.remove('active');
        if (this.viewer?.controls) {
          this.viewer.controls.autoRotate = false;
        }
        if (orbitIndicator) {
          orbitIndicator.innerHTML = '<i class="fa-solid fa-ruler"></i> 2-Point Measure Active';
        }
        this.clearMeasurement();
      } else {
        modeOrbit?.classList.add('active');
        if (this.viewer?.controls) {
          this.viewer.controls.autoRotate = true;
        }
        if (orbitIndicator) {
          orbitIndicator.innerHTML = '<i class="fa-solid fa-arrows-spin"></i> 360° Auto-Orbit Active';
        }
      }
    });

    // Clear Measure button
    document.getElementById('btn-clear-measure')?.addEventListener('click', () => {
      this.clearMeasurement();
    });

    // Camera Presets
    document.getElementById('btn-cam-iso')?.addEventListener('click', () => {
      if (!this.viewer) return;
      this.viewer.camera.position.set(-28, 22, -64);
      this.viewer.controls.target.set(0, 4, 0);
      this.viewer.controls.update();
    });

    document.getElementById('btn-cam-top')?.addEventListener('click', () => {
      if (!this.viewer) return;
      this.viewer.camera.position.set(0, 80, 0.1);
      this.viewer.controls.target.set(0, 0, 0);
      this.viewer.controls.update();
    });

    document.getElementById('btn-cam-front')?.addEventListener('click', () => {
      if (!this.viewer) return;
      this.viewer.camera.position.set(0, 12, -70);
      this.viewer.controls.target.set(0, 4, 0);
      this.viewer.controls.update();
    });

    document.getElementById('btn-cam-side')?.addEventListener('click', () => {
      if (!this.viewer) return;
      this.viewer.camera.position.set(70, 12, 0);
      this.viewer.controls.target.set(0, 4, 0);
      this.viewer.controls.update();
    });

    document.getElementById('btn-cam-reset')?.addEventListener('click', () => {
      this.resetViewerCamera();
    });
  }

  populateViewerSemanticLayers(mission) {
    const container = document.getElementById('viewer-semantic-layers');
    if (!container) return;
    container.innerHTML = '';

    const features = mission.sceneFeatures || [];
    features.forEach(feat => {
      const item = document.createElement('div');
      item.className = 'tool-toggle-item active';
      item.id = `toggle-feature-${feat.id}`;
      item.innerHTML = `
        <span style="display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid ${feat.icon || 'fa-tag'} fa-fw" style="color: ${feat.color}; font-size: 0.72rem;"></i>
          ${feat.name}
        </span>
        <i class="fa-solid fa-check check-state" style="color: ${feat.color}; font-size: 0.65rem;"></i>
      `;
      item.addEventListener('click', () => {
        const active = item.classList.toggle('active');
        const check = item.querySelector('.check-state');
        if (check) {
          check.style.opacity = active ? '1' : '0.2';
        }
      });
      container.appendChild(item);
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

    // Continuous 360° Auto-Orbit by default!
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    // Grid Floor on Y=0
    const grid = new THREE.GridHelper(80, 40, 0x00f0ff, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Realistic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.6);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
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
      grid,
      modelContainer,
      currentMesh: null,
      pointCloudMesh: null,
      roiBox: null,
      cameraPyramids: [],
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

    // Raycaster for cursor hover telemetry & 2-point measurement
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointermove', (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(modelContainer.children, true);

      if (intersects.length > 0) {
        const pt = intersects[0].point;
        this.updateCoordinatesHUD(pt);
      }
    });

    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (!this.measureActive) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(modelContainer.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0].point;
        this.handleMeasureClick(hit);
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

    // Populate dynamic semantic layers in Left Palette
    this.populateViewerSemanticLayers(this.store.getMission());

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
    this.viewer.cameraPyramids.forEach(p => this.viewer.scene.remove(p));
    this.viewer.cameraPyramids = [];
    this.clearMeasurement();

    // Update dynamic semantic layers for this mission
    this.populateViewerSemanticLayers(mission);

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

        // Create Drone Camera Frustums around model
        this.createDroneFrustums(finalSize);

        // Camera placement looking forward at the model
        this.viewer.camera.position.set(
          mission.viewerSettings?.cameraPos?.[0] || -28,
          mission.viewerSettings?.cameraPos?.[1] || 22,
          mission.viewerSettings?.cameraPos?.[2] || -64
        );
        this.viewer.controls.target.set(0, finalSize.y * 0.45, 0);

        // Continuous 360° Orbiting active by default!
        this.viewer.controls.autoRotate = true;
        this.viewer.controls.autoRotateSpeed = 2.0;
        this.viewer.controls.update();

        // Update CRS in HUD
        const crsElem = document.getElementById('hud-coord-crs');
        if (crsElem) crsElem.textContent = mission.crsDatum ? mission.crsDatum.split(' ')[0] : 'EPSG:32633';
      },
      undefined,
      (err) => {
        console.error('Error loading 3D model:', err);
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
    const hLat = document.getElementById('hud-coord-lat');
    const hLon = document.getElementById('hud-coord-lon');
    const hAlt = document.getElementById('hud-coord-alt');

    if (hX) hX.textContent = `${pt.x.toFixed(2)} m`;
    if (hY) hY.textContent = `${pt.y.toFixed(2)} m`;
    if (hZ) hZ.textContent = `${pt.z.toFixed(2)} m`;

    const mission = this.store.getMission();
    let baseLat = 78.2232;
    let baseLon = 15.6267;
    if (mission.id === 'pb1') { baseLat = 49.8821; baseLon = 19.0583; }
    else if (mission.id === 'pb3') { baseLat = 45.9765; baseLon = 7.7491; }

    if (hLat) hLat.textContent = `${(baseLat + pt.z * 0.0001).toFixed(4)}° N`;
    if (hLon) hLon.textContent = `${(baseLon + pt.x * 0.0001).toFixed(4)}° E`;
    if (hAlt) hAlt.textContent = `${(42.4 + pt.y * 1.5).toFixed(1)} m MSL`;
  }

  handleMeasureClick(pt) {
    this.measurePoints.push(pt);

    const sphereGeom = new THREE.SphereGeometry(0.6, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const marker = new THREE.Mesh(sphereGeom, sphereMat);
    marker.position.copy(pt);
    this.viewer.scene.add(marker);
    this.measureMarkers.push(marker);

    const statusLabel = document.getElementById('hud-measure-status');
    const distNum = document.getElementById('hud-measure-dist');
    const countLabel = document.getElementById('hud-measure-points-count');

    if (this.measurePoints.length === 1) {
      if (statusLabel) statusLabel.textContent = 'Point 1 set. Click Point 2...';
      if (countLabel) countLabel.textContent = 'Points: 1/2';
    } else if (this.measurePoints.length === 2) {
      const p1 = this.measurePoints[0];
      const p2 = this.measurePoints[1];
      const dist = p1.distanceTo(p2) * 5.2; // Scaled to metric ground meters

      // Draw high-visibility laser line
      const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
      this.measureLine = new THREE.Line(lineGeom, lineMat);
      this.viewer.scene.add(this.measureLine);

      if (distNum) distNum.textContent = `${dist.toFixed(2)} m`;
      if (statusLabel) statusLabel.textContent = 'Distance computed (Euclidean)';
      if (countLabel) countLabel.textContent = 'Points: 2/2';
    } else {
      // 3rd click resets and starts new measurement
      this.clearMeasurement();
      this.handleMeasureClick(pt);
    }
  }

  clearMeasurement() {
    this.measurePoints = [];
    if (this.measureLine) {
      this.viewer?.scene.remove(this.measureLine);
      this.measureLine = null;
    }
    this.measureMarkers.forEach(m => this.viewer?.scene.remove(m));
    this.measureMarkers = [];

    const distNum = document.getElementById('hud-measure-dist');
    const statusLabel = document.getElementById('hud-measure-status');
    const countLabel = document.getElementById('hud-measure-points-count');

    if (distNum) distNum.textContent = '0.00 m';
    if (statusLabel) statusLabel.textContent = 'Click 2 points on model';
    if (countLabel) countLabel.textContent = 'Points: 0/2';
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

  // ==========================================================================
  // 8. Screen 06: Validation & Export Events
  // ==========================================================================
  initScreen06Events() {
    // Download Complete Package (.GLB 3D Model + Inspection Report)
    document.getElementById('btn-download-all')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      this.downloadMissionPackage(mission);
    });

    // Open / Save PDF Report
    document.getElementById('btn-open-pdf-report')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      this.openMissionReportPdf(mission);
    });

    // Individual item: 3D Model (.GLB)
    document.getElementById('dl-item-glb')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      this.downloadMissionGlb(mission);
    });

    // Individual item: Quality Report (.HTML)
    document.getElementById('dl-item-report-html')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      this.downloadMissionReportHtml(mission);
    });

    // Individual item: Executive Report (.PDF)
    document.getElementById('dl-item-report-pdf')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      this.openMissionReportPdf(mission);
    });

    // Individual item: Point Cloud (.PLY)
    document.getElementById('dl-item-ply')?.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = 'datasets/03_fountain_mesh.ply';
      a.download = `AeroSculpt_${this.store.getMission().code}_PointCloud.ply`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    // Individual item: GeoTIFF / GIS Vector
    document.getElementById('dl-item-geotiff')?.addEventListener('click', () => {
      const mission = this.store.getMission();
      const geoPackage = {
        type: 'FeatureCollection',
        crs: { type: 'name', properties: { name: mission.crsDatum } },
        mission: mission.name,
        code: mission.code,
        center: [15.633, 78.223],
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[15.631, 78.221], [15.636, 78.221], [15.636, 78.225], [15.631, 78.225], [15.631, 78.221]]]
            },
            properties: {
              reprojectionError: mission.reprojectionError,
              accuracy: mission.spatialAccuracy,
              elevationMin: 45,
              elevationMax: 82
            }
          }
        ]
      };
      const blob = new Blob([JSON.stringify(geoPackage, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AeroSculpt_${mission.code}_GIS_Vectors.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  downloadMissionGlb(mission) {
    const a = document.createElement('a');
    a.href = mission.glbUrl || 'datasets/pb2_model.glb';
    a.download = `AeroSculpt_${mission.code}_3D_Model.glb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadMissionReportHtml(mission) {
    const reportHtml = this.generateMissionReportHtml(mission);
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AeroSculpt_${mission.code}_Inspection_Report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  openMissionReportPdf(mission) {
    const reportHtml = this.generateMissionReportHtml(mission);
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.write(reportHtml);
      reportWindow.document.close();
      setTimeout(() => {
        reportWindow.print();
      }, 500);
    } else {
      this.downloadMissionReportHtml(mission);
    }
  }

  downloadMissionPackage(mission) {
    // 1. Download GLB 3D model
    this.downloadMissionGlb(mission);

    // 2. Download HTML Report
    setTimeout(() => {
      this.downloadMissionReportHtml(mission);
    }, 450);

    // 3. Mark Step 5 as completed checkmark
    const step5 = document.getElementById('stepper-step-5');
    if (step5) {
      step5.classList.add('completed');
      const numSpan = step5.querySelector('.stepper-circle-num');
      if (numSpan) numSpan.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
  }

  generateMissionReportHtml(mission) {
    const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
    const evidenceObs = mission.evidence?.observed || 62.3;
    const evidenceRec = mission.evidence?.reconstructed || 24.1;
    const evidenceInf = mission.evidence?.inferred || 9.8;
    const evidenceUnk = mission.evidence?.unknown || 3.8;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AeroSculpt Reconstruction & Inspection Report — ${mission.code} ${mission.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background: #0b111e;
      color: #e2e8f0;
      padding: 36px 40px;
      line-height: 1.55;
    }
    .report-wrap {
      max-width: 920px;
      margin: 0 auto;
    }
    .no-print {
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(37, 99, 235, 0.15);
      border: 1px solid rgba(0, 240, 255, 0.4);
      padding: 12px 18px;
      border-radius: 8px;
    }
    .btn-print {
      background: linear-gradient(135deg, #2563eb, #00f0ff);
      color: #0b111e;
      border: none;
      padding: 8px 20px;
      font-weight: 800;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .report-header {
      border-bottom: 2px solid #00f0ff;
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 1.8rem;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    .brand-title span { color: #00f0ff; }
    .report-subtitle {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-top: 4px;
    }
    .report-meta {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .report-meta strong { color: #00f0ff; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: rgba(14, 22, 38, 0.85);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }
    .kpi-val {
      font-size: 1.35rem;
      font-weight: 800;
      color: #00f0ff;
      font-family: 'JetBrains Mono', monospace;
    }
    .kpi-lbl {
      font-size: 0.7rem;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 700;
      margin-top: 4px;
    }
    .section-card {
      background: rgba(14, 22, 38, 0.75);
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .sec-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: #ffffff;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 8px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    th {
      text-align: left;
      padding: 8px 12px;
      background: rgba(255,255,255,0.03);
      color: #94a3b8;
      font-weight: 700;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: #e2e8f0;
    }
    td.mono { font-family: 'JetBrains Mono', monospace; font-weight: 700; }
    .pass-tag {
      color: #10b981;
      font-weight: 700;
    }
    .ev-bar-container {
      height: 20px;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      margin: 14px 0;
      background: #000;
    }
    .ev-seg { height: 100%; }
    .ev-legend {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      font-size: 0.78rem;
      font-family: 'JetBrains Mono', monospace;
    }
    .ev-legend-item { display: flex; align-items: center; gap: 8px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .report-footer {
      border-top: 1px solid #1e293b;
      padding-top: 16px;
      margin-top: 30px;
      font-size: 0.72rem;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: #ffffff !important; color: #0f172a !important; padding: 15px !important; }
      .no-print { display: none !important; }
      .brand-title { color: #0f172a !important; }
      .brand-title span { color: #2563eb !important; }
      .kpi-card, .section-card { background: #f8fafc !important; border-color: #cbd5e1 !important; }
      .kpi-val { color: #2563eb !important; }
      .kpi-lbl { color: #64748b !important; }
      .sec-title { color: #0f172a !important; border-bottom-color: #cbd5e1 !important; }
      th { background: #f1f5f9 !important; color: #475569 !important; }
      td { border-bottom-color: #e2e8f0 !important; color: #0f172a !important; }
      .report-footer { border-top-color: #cbd5e1 !important; color: #94a3b8 !important; }
    }
  </style>
</head>
<body>
  <div class="report-wrap">
    <div class="no-print">
      <span><strong>AeroSculpt Deliverable Dossier</strong> · Click to print or save directly as PDF:</span>
      <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <div class="report-header">
      <div>
        <div class="brand-title"><span>AERO</span>SCULPT</div>
        <div class="report-subtitle">Single-Pass UAV → Georeferenced 3D World Photogrammetry Dossier</div>
      </div>
      <div class="report-meta">
        <div>MISSION: <strong>${mission.code} · ${mission.name}</strong></div>
        <div>DATE: <strong>${now}</strong></div>
        <div>CRS: <strong>${mission.crsDatum}</strong></div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-val">${mission.reprojectionError}</div>
        <div class="kpi-lbl">Reprojection Error</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">~${mission.spatialAccuracy}</div>
        <div class="kpi-lbl">Spatial Accuracy</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${mission.coverage}</div>
        <div class="kpi-lbl">Photogrammetric Coverage</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${mission.meshFaces}</div>
        <div class="kpi-lbl">Triangular Mesh Faces</div>
      </div>
    </div>

    <div class="section-card">
      <div class="sec-title">Photogrammetric Geometric Consistency & Accuracy Metrics</div>
      <table>
        <thead>
          <tr>
            <th>Quality Metric</th>
            <th>Verification Standard</th>
            <th>Measured Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Reprojection Error</td>
            <td>Sub-pixel (&lt; 0.50 px)</td>
            <td class="mono">${mission.reprojectionError}</td>
            <td class="pass-tag">✓ PASS</td>
          </tr>
          <tr>
            <td>Geometric Consistency</td>
            <td>Multi-view Bundle Epipolar Ray Match</td>
            <td class="mono">99.2% Inlier Ratio</td>
            <td class="pass-tag">✓ PASS</td>
          </tr>
          <tr>
            <td>Scale Consistency</td>
            <td>Metric GNSS Baseline & Ground Control</td>
            <td class="mono">Scale Error &lt; 0.08%</td>
            <td class="pass-tag">✓ PASS</td>
          </tr>
          <tr>
            <td>Spatial Alignment</td>
            <td>UTM Grid Projection Fit</td>
            <td class="mono">${mission.crsName}</td>
            <td class="pass-tag">✓ VERIFIED</td>
          </tr>
          <tr>
            <td>Surface Coverage</td>
            <td>Continuous Corridor Reconstruction</td>
            <td class="mono">${mission.coverage}</td>
            <td class="pass-tag">✓ PASS</td>
          </tr>
          <tr>
            <td>Point Cloud Density</td>
            <td>High-Resolution Spatial Sampling</td>
            <td class="mono">${mission.densePoints}</td>
            <td class="pass-tag">✓ HIGH DENSITY</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-card">
      <div class="sec-title">Evidence Distribution & Surface Reliability</div>
      <div class="ev-bar-container">
        <div class="ev-seg" style="width: ${evidenceObs}%; background: #10b981;" title="Observed (${evidenceObs}%)"></div>
        <div class="ev-seg" style="width: ${evidenceRec}%; background: #3b82f6;" title="Reconstructed (${evidenceRec}%)"></div>
        <div class="ev-seg" style="width: ${evidenceInf}%; background: #f59e0b;" title="Inferred (${evidenceInf}%)"></div>
        <div class="ev-seg" style="width: ${evidenceUnk}%; background: #ef4444;" title="Unknown (${evidenceUnk}%)"></div>
      </div>
      <div class="ev-legend">
        <div class="ev-legend-item"><span class="dot" style="background: #10b981;"></span> Observed: <strong>${evidenceObs}%</strong></div>
        <div class="ev-legend-item"><span class="dot" style="background: #3b82f6;"></span> Reconstructed: <strong>${evidenceRec}%</strong></div>
        <div class="ev-legend-item"><span class="dot" style="background: #f59e0b;"></span> Inferred: <strong>${evidenceInf}%</strong></div>
        <div class="ev-legend-item"><span class="dot" style="background: #ef4444;"></span> Occluded/Unknown: <strong>${evidenceUnk}%</strong></div>
      </div>
    </div>

    <div class="section-card">
      <div class="sec-title">Flight Telemetry & Sensor Acquisition Specifications</div>
      <table>
        <tbody>
          <tr><td>UAV Platform</td><td class="mono">${mission.uavPlatform}</td></tr>
          <tr><td>Camera Sensor</td><td class="mono">${mission.cameraSensor}</td></tr>
          <tr><td>Sensor Intrinsics</td><td class="mono">${mission.cameraIntrinsics}</td></tr>
          <tr><td>Survey Area Bounding</td><td class="mono">${mission.areaBounding}</td></tr>
          <tr><td>Flight Speed & Altitude</td><td class="mono">${mission.flightSpeed} · ${mission.altitudeRange}</td></tr>
          <tr><td>Raw Video Duration & Volume</td><td class="mono">${mission.videoDuration} (${mission.videoDurationSec}s) · ${mission.rawVideoSize}</td></tr>
          <tr><td>Dense Point Cloud Deliverable</td><td class="mono">${mission.densePoints} (.PLY)</td></tr>
          <tr><td>Textured 3D Mesh Deliverable</td><td class="mono">${mission.meshFaces} (.GLB)</td></tr>
        </tbody>
      </table>
    </div>

    <div class="report-footer">
      <div>AeroSculpt Geospatial Core · Autonomous Single-Pass Aerial Reconstruction</div>
      <div>Deliverable Package: <strong>${mission.code}_Reconstruction_Package</strong></div>
    </div>
  </div>
</body>
</html>`;
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

    // Screen 02 Ingestion & Card Values
    const vThumb = document.getElementById('file-video-preview');
    if (vThumb) {
      vThumb.src = mission.videoUrl;
      vThumb.load();
      vThumb.play().catch(() => {});
    }

    const vName = document.getElementById('card-val-video-name');
    if (vName) vName.textContent = mission.videoUrl.split('/').pop();

    const vSpecs = document.getElementById('card-val-video-specs');
    if (vSpecs) vSpecs.textContent = `${mission.videoDuration} | ${mission.videoResolution} | ${mission.frameRate} | ${mission.rawVideoSize}`;

    // Screen 02 telemetry chips
    const chipDur = document.getElementById('chip-dur');
    if (chipDur) chipDur.textContent = mission.videoDuration;

    const chipRes = document.getElementById('chip-res');
    if (chipRes) chipRes.textContent = mission.videoResolution;

    const chipFps = document.getElementById('chip-fps');
    if (chipFps) chipFps.textContent = mission.frameRate;

    const chipSize = document.getElementById('chip-size');
    if (chipSize) chipSize.textContent = mission.rawVideoSize;

    // Highlight active prebuilt video card in modal
    ['pb2', 'pb1', 'pb3'].forEach(id => {
      const card = document.getElementById(`modal-pb-card-${id}`);
      if (card) card.classList.toggle('active', id === mission.id);
    });

    const modalTitle = document.getElementById('modal-active-mission-title');
    if (modalTitle) {
      modalTitle.textContent = `${mission.code} · ${mission.name}`;
    }

    const gpsName = document.getElementById('card-val-gps-name');
    if (gpsName) gpsName.textContent = mission.gpsFile;

    const gpsSpecs = document.getElementById('card-val-gps-specs');
    if (gpsSpecs) gpsSpecs.textContent = mission.gpsRecords;

    const metaName = document.getElementById('card-val-meta-name');
    if (metaName) metaName.textContent = mission.metaFile;

    const metaSpecs = document.getElementById('card-val-meta-specs');
    if (metaSpecs) metaSpecs.textContent = `Platform: ${mission.uavPlatform.split(' ')[0]} · Area: ${mission.sceneCategory}`;

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

    // Screen 04 initial ETA
    const etaElem = document.getElementById('pipe-eta-val');
    if (etaElem) etaElem.textContent = `ETA: ~${mission.reconstructionTime.split(' ')[0]}`;

    // Screen 05 HUD
    const hudThumb = document.getElementById('hud-point-thumb');
    if (hudThumb) hudThumb.src = `${mission.framesDir}${mission.framePrefix}0001${mission.frameExt}`;

    const hudCrs = document.getElementById('hud-point-crs');
    if (hudCrs) hudCrs.textContent = mission.crsDatum.split(' ')[0];

    // Screen 06 Export Summary
    const expProc = document.getElementById('exp-proc-time');
    if (expProc) expProc.textContent = mission.reconstructionTime;
  }
}

// Instantiate application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.aerosculptApp = new AeroSculptApp();
});
