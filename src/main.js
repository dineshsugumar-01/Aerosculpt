import { AeroSculptViewer } from './viewer3d.js';
import { AeroSculptStudioViewer } from './studioViewer.js';

// ==========================================================================
// Benchmark Reconstruction Datasets (DEMO 01, 02, 03)
// ==========================================================================
const baseUrl = import.meta.env.BASE_URL || './';
const formatUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return baseUrl.endsWith('/') ? `${baseUrl}${cleanPath}` : `${baseUrl}/${cleanPath}`;
};

export const DEMO_DATASETS = {
  '01': {
    id: '01',
    badge: 'PREBUILT 01',
    name: 'Komorowice Cadastral Land Survey',
    location: 'Komorowice, ul. Sambora — Building Plots',
    modelUrl: formatUrl('datasets/pb1_model.glb'),
    videoUrl: formatUrl('datasets/pb1_video.mp4'),
    framesDir: 'datasets/frames_pb1',
    depthDir: null,
    framePrefix: 'frame_',
    frameExt: '.jpg',
    thumbUrl: formatUrl('datasets/frames_pb1/frame_0047.jpg'),
    maxFrames: 94,
    format: 'pb1_model.glb',
    rotationY: 0,
    rotX: 0,
    scaleFactor: 1.0,
    fileSize: '26.2 MB',
    videoSize: '51.8 MB',
    videoRes: '1920×1080 · 30 FPS',
    vertices: '240,000',
    triangles: '480,000',
    gsd: '1.42 cm/px',
    reprojectionError: '0.38 px',
    datum: 'EPSG:2180 PUWG 1992',
    horizontalRmse: '0.021 m',
    verticalRmse: '0.034 m',
    reconstructedArea: '38,200 m²',
    sensor: 'DJI 20MP Wide-Angle 1" CMOS',
    description: 'Aerial photogrammetric survey of residential building plots in Komorowice. Captures full cadastral boundary geometry, road infrastructure, and terrain contour for planning authority submissions.'
  },
  '02': {
    id: '02',
    badge: 'PREBUILT 02',
    name: 'Longyearbyen Svalbard — Arctic Drone 3D Scan',
    location: 'Longyearbyen, Svalbard Archipelago (78°N)',
    modelUrl: formatUrl('datasets/pb2_model.glb'),
    videoUrl: formatUrl('datasets/pb2_video.mp4'),
    framesDir: 'datasets/frames_pb2',
    depthDir: null,
    framePrefix: 'frame_',
    frameExt: '.jpg',
    thumbUrl: formatUrl('datasets/frames_pb2/frame_0256.jpg'),
    maxFrames: 513,
    format: 'pb2_model.glb',
    rotationY: 0,
    rotX: 0,
    scaleFactor: 1.0,
    fileSize: '34.7 MB',
    videoSize: '108.6 MB',
    videoRes: '848×478 · 30 FPS',
    vertices: '310,000',
    triangles: '620,000',
    gsd: '2.1 cm/px',
    reprojectionError: '0.44 px',
    datum: 'EPSG:32633 UTM 33N',
    horizontalRmse: '0.031 m',
    verticalRmse: '0.048 m',
    reconstructedArea: '65,000 m²',
    sensor: 'DJI Mavic 3 Enterprise Wide',
    description: 'High-resolution drone 3D scan of the Arctic settlement of Longyearbyen on Svalbard — capturing town infrastructure, glacial terrain, and permafrost geology in extreme sub-zero conditions.'
  },
  '03': {
    id: '03',
    badge: 'PREBUILT 03',
    name: 'Hotel Gornergrat Kulm — Zermatt Alpine Survey',
    location: 'Zermatt, Switzerland — 3089m ASL',
    modelUrl: formatUrl('datasets/pb3_model.glb'),
    videoUrl: formatUrl('datasets/pb3_video.mp4'),
    framesDir: 'datasets/frames_pb3',
    depthDir: null,
    framePrefix: 'frame_',
    frameExt: '.jpg',
    thumbUrl: formatUrl('datasets/frames_pb3/frame_0090.jpg'),
    maxFrames: 181,
    format: 'pb3_model.glb',
    rotationY: 0,
    rotX: 0,
    scaleFactor: 1.0,
    fileSize: '31.7 MB',
    videoSize: '36.4 MB',
    videoRes: '848×478 · 30 FPS',
    vertices: '280,000',
    triangles: '560,000',
    gsd: '0.82 cm/px',
    reprojectionError: '0.29 px',
    datum: 'EPSG:2056 Swiss LV95',
    horizontalRmse: '0.011 m',
    verticalRmse: '0.018 m',
    reconstructedArea: '12,400 m²',
    sensor: 'DJI Mini 3 Pro (24mm f/1.7)',
    description: 'Drone 3D survey of the iconic Hotel Gornergrat Kulm at 3089m above sea level in Zermatt, Switzerland. Captures alpine hotel architecture, rocky terrain, and snow coverage in high-altitude conditions.'
  }
};

// ==========================================================================
// AeroSculpt Application State & Controller
// ==========================================================================
class AeroSculptApp {
  constructor() {
    this.viewer3d = null;
    this.studioViewer = null;
    this.currentView = 'dashboard';
    this.currentDemoId = '02';
    this.activeLayers = {
      ortho: true,
      cameras: true,
      gcp: true,
      polygon: true
    };
    this.cameraWaypoints = [];
    this.gcpPoints = [
      { name: 'GCP-01 (South Rampart)', x: 0.35, y: 0.72, residual: '0.023m' },
      { name: 'GCP-02 (Castle Gate)', x: 0.52, y: 0.38, residual: '0.023m' },
      { name: 'GCP-03 (River Wall)', x: 0.22, y: 0.45, residual: '0.027m' },
      { name: 'GCP-04 (North Ridge)', x: 0.78, y: 0.55, residual: '0.023m' }
    ];

    // Studio Tactical State
    this.isPlayingTimeline = false;
    this.timelineTimer = null;
    this.activeKeyframe = 24;
    this.isLeftDrawerOpen = true;
    this.isRightDrawerOpen = true;
    this.depthColormap = 'inferno';
    this.keyframeLayers = { image: true, features: true, landmarks: true, residuals: true };
    this.imageCache = new Map();

    this.init();
  }

  getFrameUrl(demoId, frameNum) {
    const dataset = DEMO_DATASETS[demoId] || DEMO_DATASETS['01'];
    const max = dataset.maxFrames || 50;
    const clamped = Math.max(1, Math.min(max, frameNum));
    const padNum = String(clamped).padStart(4, '0');
    return formatUrl(`${dataset.framesDir}/${dataset.framePrefix || 'frame_'}${padNum}${dataset.frameExt || '.jpg'}`);
  }

  getDepthUrl(demoId, frameNum) {
    const dataset = DEMO_DATASETS[demoId] || DEMO_DATASETS['01'];
    if (!dataset.depthDir) return null;
    const max = dataset.maxFrames || 50;
    const clamped = Math.max(1, Math.min(max, frameNum));
    const padNum = String(clamped).padStart(3, '0');
    return formatUrl(`${dataset.depthDir}/depth_${padNum}.png`);
  }


  init() {
    // 1. Initialize 3D Viewer inside canvas box
    this.init3DViewer();

    // 2. Initialize Navigation & View Switching
    this.initNavigation();

    // 3. Initialize Dashboard Task & Project Handlers
    this.initDashboardEvents();

    // 4. Initialize Deep Project Tabs
    this.initProjectTabs();

    // 5. Initialize Modals
    this.initModals();

    // 6. Initialize 2D Canvas Flight Map
    this.initFlightMap();

    // 7. Initialize Dropdowns & Outside Clicks
    this.initDropdowns();

    // 8. Initialize Multi-Feed Video Switcher (Downloaded AeroSculpt SLAM & UAV feeds)
    this.initVideoFeedSwitcher();

    // 9. Initialize AeroSculpt Studio Workstation
    this.initStudio();

    // 10. Initialize Benchmark Demo Datasets (01, 02, 03)
    this.initDemoDatasets();

    // 10b. Initialize Nextgen Unified Dashboard Controls & Stepped Selector
    this.initNextgenDashboard();

    // 11. Check URL hash on startup
    this.handleHashChange();
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  // ==========================================================================
  // 3D Viewer Initialization & Controls
  // ==========================================================================
  init3DViewer() {
    const container = document.getElementById('viewer-3d-canvas-box');
    if (container) {
      this.viewer3d = new AeroSculptViewer('viewer-3d-canvas-box');
    }

    // Render mode buttons
    const btnTextured = document.getElementById('btn-mode-textured');
    const btnWireframe = document.getElementById('btn-mode-wireframe');
    const btnPoints = document.getElementById('btn-mode-points');

    const setModeActive = (activeBtn) => {
      [btnTextured, btnWireframe, btnPoints].forEach(btn => {
        if (btn) {
          btn.classList.toggle('active', btn === activeBtn);
          btn.classList.toggle('btn-primary', btn === activeBtn);
          btn.classList.toggle('btn-default', btn !== activeBtn);
        }
      });
    };

    if (btnTextured) {
      btnTextured.addEventListener('click', () => {
        setModeActive(btnTextured);
        if (this.viewer3d) this.viewer3d.setViewMode('textured');
      });
    }

    if (btnWireframe) {
      btnWireframe.addEventListener('click', () => {
        setModeActive(btnWireframe);
        if (this.viewer3d) this.viewer3d.setViewMode('wireframe');
      });
    }

    if (btnPoints) {
      btnPoints.addEventListener('click', () => {
        setModeActive(btnPoints);
        if (this.viewer3d) this.viewer3d.setViewMode('points');
      });
    }

    // Camera presets
    const btnFront = document.getElementById('btn-cam-front');
    const btnTop = document.getElementById('btn-cam-top');
    const btnIso = document.getElementById('btn-cam-iso');
    const btnReset = document.getElementById('btn-cam-reset');

    if (btnFront) btnFront.addEventListener('click', () => this.viewer3d?.setCameraPreset('front'));
    if (btnTop) btnTop.addEventListener('click', () => this.viewer3d?.setCameraPreset('top'));
    if (btnIso) btnIso.addEventListener('click', () => this.viewer3d?.setCameraPreset('iso'));
    if (btnReset) btnReset.addEventListener('click', () => this.viewer3d?.setCameraPreset('reset'));

    // Metric grid & auto-rotate
    const btnGrid = document.getElementById('btn-toggle-grid');
    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        const visible = this.viewer3d?.toggleGrid();
        btnGrid.classList.toggle('active', visible);
      });
    }

    const btnSpin = document.getElementById('btn-toggle-spin');
    if (btnSpin) {
      btnSpin.addEventListener('click', () => {
        const spinning = this.viewer3d?.toggleAutoRotate();
        btnSpin.classList.toggle('active', spinning);
      });
    }

    const btnFullscreen = document.getElementById('btn-fullscreen-3d');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        const elem = document.getElementById('viewer-3d-canvas-box');
        if (!document.fullscreenElement) {
          elem?.requestFullscreen().catch(err => console.warn(err));
        } else {
          document.exitFullscreen();
        }
      });
    }
  }

  // ==========================================================================
  // Navigation & View Routing
  // ==========================================================================
  initNavigation() {
    // Sidebar links
    document.querySelectorAll('.side-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // "Back to Dashboard" buttons inside view toolbars
    document.querySelectorAll('.btn-back-dashboard').forEach(btn => {
      btn.addEventListener('click', () => this.switchView('dashboard'));
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('show-sidebar');
      });
    }

    // Video view jump to 3D button
    const btnVideoJump3D = document.getElementById('btn-video-jump-3d');
    if (btnVideoJump3D) {
      btnVideoJump3D.addEventListener('click', () => this.switchView('3d-model'));
    }
  }

  handleHashChange() {
    const rawHash = window.location.hash.replace('#', '');
    const [viewName, tabName] = rawHash.split('/');

    if (['dashboard', '3d-model', 'map', 'video', 'studio'].includes(viewName)) {
      this.switchView(viewName, false);
      if (tabName) {
        const targetBtn = document.querySelector(`.project-tab-btn[data-tab="${tabName}"]`) ||
                          document.querySelector(`.project-tab-btn[data-tab="tab-${tabName}"]`);
        if (targetBtn) {
          setTimeout(() => targetBtn.click(), 50);
        }
      }
    }
  }

  switchView(viewName, updateHash = true) {
    this.currentView = viewName;

    // Toggle studio view class on body for edge-to-edge screen fitting
    if (viewName === 'studio') {
      document.body.classList.add('studio-view-active');
    } else {
      document.body.classList.remove('studio-view-active');
      document.body.classList.remove('studio-fullscreen-active');
      const fsBtn = document.getElementById('btn-studio-fullscreen');
      if (fsBtn) {
        const icon = fsBtn.querySelector('i');
        if (icon) icon.className = 'fa fa-expand';
      }
    }

    // Consolidated single dashboard: 'dashboard', '3d-model', 'map', and 'video' are all in #view-dashboard
    const isSingleDashView = ['dashboard', '3d-model', 'map', 'video'].includes(viewName);
    const activeSectionName = isSingleDashView ? 'dashboard' : viewName;

    // Update active content section
    document.querySelectorAll('.content-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${activeSectionName}`);
    });

    // Update active sidebar link
    document.querySelectorAll('.side-link').forEach(link => {
      const match = link.getAttribute('data-view') === viewName;
      link.classList.toggle('active', match);
    });

    // Update URL hash
    if (updateHash) {
      window.location.hash = viewName;
    }

    // View specific handlers & smooth scrolling on single dashboard
    if (viewName === '3d-model') {
      document.getElementById('dash-section-3d')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        this.viewer3d?.onWindowResize();
      }, 150);
    } else if (viewName === 'map') {
      document.getElementById('dash-section-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        this.drawFlightMap();
      }, 150);
    } else if (viewName === 'video') {
      document.getElementById('dash-section-video')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (viewName === 'dashboard') {
      document.getElementById('page-wrapper')?.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        this.viewer3d?.onWindowResize();
        this.drawFlightMap();
      }, 100);
    } else if (viewName === 'studio') {
      if (!this.studioViewer) {
        this.studioViewer = new AeroSculptStudioViewer('studio-viewport-canvas-box');
      }
      setTimeout(() => {
        this.studioViewer?.onWindowResize();
        this.drawKeyframeCanvas();
        this.drawDepthCanvas();
      }, 80);
    }

    // Close mobile sidebar if open
    document.getElementById('app-sidebar')?.classList.remove('show-sidebar');
  }

  // ==========================================================================
  // Multi-Channel Video Feed Switcher (Strictly Local Downloaded Videos)
  // ==========================================================================
  initVideoFeedSwitcher() {
    const videoElem = document.getElementById('drone-inspection-video');
    const feedBtns = document.querySelectorAll('.feed-tab-btn');
    const breadcrumbName = document.getElementById('video-breadcrumb-feed-name');
    const hudTitle = document.getElementById('hud-feed-title');
    const metaName = document.getElementById('meta-video-name');
    const metaSize = document.getElementById('meta-video-size');
    const metaRes = document.getElementById('meta-video-res');
    const metaType = document.getElementById('meta-video-type');

    feedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        feedBtns.forEach(b => {
          b.classList.remove('active', 'btn-primary');
          b.classList.add('btn-default');
        });
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-default');

        const videoSrc = btn.getAttribute('data-video');
        const title = btn.getAttribute('data-title');
        const size = btn.getAttribute('data-size');
        const res = btn.getAttribute('data-res');
        const type = btn.getAttribute('data-type');

        if (videoElem && videoSrc) {
          videoElem.src = videoSrc;
          videoElem.play().catch(e => console.log('Autoplay deferred:', e));
        }

        if (breadcrumbName) breadcrumbName.textContent = title;
        if (hudTitle) hudTitle.textContent = `${title.toUpperCase()}: STREAM ACTIVE`;
        if (metaName) metaName.textContent = videoSrc;
        if (metaSize) metaSize.textContent = `${size} (Local Asset)`;
        if (metaRes) metaRes.textContent = res;
        if (metaType) metaType.textContent = type;

        this.showToast(`Switched video feed: ${title}`);
      });
    });

    // Dashboard SLAM video card click
    const dashSlamCard = document.getElementById('dash-slam-video-card');
    if (dashSlamCard) {
      dashSlamCard.addEventListener('click', () => {
        this.switchView('video');
        document.getElementById('tab-feed-aerosculpt')?.click();
      });
    }
  }

  // ==========================================================================
  // Dashboard Task & Project Handlers
  // ==========================================================================
  initDashboardEvents() {
    // Task details expand/collapse toggle
    const expandBtn = document.getElementById('task-expand-btn');
    const taskNameLink = document.getElementById('task-name-link');
    const expandedPanel = document.getElementById('task-expanded-panel');
    const expandIcon = document.getElementById('task-expand-icon');

    const toggleExpand = () => {
      if (!expandedPanel) return;
      const isVisible = expandedPanel.style.display !== 'none';
      expandedPanel.style.display = isVisible ? 'none' : 'block';
      if (expandIcon) {
        expandIcon.className = isVisible ? 'fa fa-square-plus' : 'fa fa-square-minus';
      }
    };

    if (expandBtn) expandBtn.addEventListener('click', toggleExpand);
    if (taskNameLink) taskNameLink.addEventListener('click', toggleExpand);

    // Toggle Task List collapse
    const toggleTaskList = document.getElementById('toggle-task-list');
    const taskListBody = document.getElementById('task-list-body');
    const taskListCaret = document.getElementById('task-list-caret');

    if (toggleTaskList && taskListBody) {
      toggleTaskList.addEventListener('click', () => {
        const isHidden = taskListBody.style.display === 'none';
        taskListBody.style.display = isHidden ? 'block' : 'none';
        if (taskListCaret) {
          taskListCaret.className = isHidden ? 'fa fa-caret-down' : 'fa fa-caret-right';
        }
      });
    }

    // Action buttons inside Task Expanded Panel
    const btnOpen3D = document.getElementById('btn-open-3d');
    const actionView3D = document.getElementById('action-view-3d');
    const thumbBox = document.getElementById('thumb-preview-box');

    [btnOpen3D, actionView3D, thumbBox].forEach(el => {
      if (el) el.addEventListener('click', () => this.switchView('3d-model'));
    });

    const btnOpenMap = document.getElementById('btn-open-map');
    const actionViewMap = document.getElementById('action-view-map');
    [btnOpenMap, actionViewMap].forEach(el => {
      if (el) el.addEventListener('click', () => this.switchView('map'));
    });

    const btnOpenVideo = document.getElementById('btn-open-video');
    const actionViewVideo = document.getElementById('action-view-video');
    [btnOpenVideo, actionViewVideo].forEach(el => {
      if (el) el.addEventListener('click', () => this.switchView('video'));
    });

    const btnOpenReport = document.getElementById('btn-open-report');
    const actionViewReport = document.getElementById('action-view-report');
    [btnOpenReport, actionViewReport].forEach(el => {
      if (el) el.addEventListener('click', () => this.openModal('modal-report-backdrop'));
    });

    // Copy Task ID
    const btnCopyTaskId = document.getElementById('btn-copy-task-id');
    const copyIcon = document.getElementById('copy-task-icon');
    if (btnCopyTaskId) {
      btnCopyTaskId.addEventListener('click', () => {
        const taskId = document.getElementById('task-id-text')?.textContent.trim() || 'Task-of-2026-09-10T143406911Z';
        navigator.clipboard.writeText(taskId).then(() => {
          if (copyIcon) copyIcon.className = 'fa-solid fa-check visible text-success';
          this.showToast('Task ID copied to clipboard: ' + taskId);
          setTimeout(() => {
            if (copyIcon) copyIcon.className = 'fa-regular fa-clipboard';
          }, 2000);
        });
      });
    }

    // Console Toggle buttons [On] / [Off]
    const btnConsoleOn = document.getElementById('btn-console-on');
    const btnConsoleOff = document.getElementById('btn-console-off');
    const consoleBox = document.getElementById('console-stream-box');
    const btnClearConsole = document.getElementById('btn-clear-console');
    const btnCopyConsole = document.getElementById('btn-copy-console');

    const setConsoleVisibility = (show) => {
      if (consoleBox) consoleBox.style.display = show ? 'block' : 'none';
      if (btnConsoleOn && btnConsoleOff) {
        btnConsoleOn.classList.toggle('btn-primary', show);
        btnConsoleOn.classList.toggle('btn-default', !show);
        btnConsoleOff.classList.toggle('btn-primary', !show);
        btnConsoleOff.classList.toggle('btn-default', show);
      }
    };

    if (btnConsoleOn) btnConsoleOn.addEventListener('click', () => setConsoleVisibility(true));
    if (btnConsoleOff) btnConsoleOff.addEventListener('click', () => setConsoleVisibility(false));
    if (btnClearConsole) btnClearConsole.addEventListener('click', () => setConsoleVisibility(false));

    if (btnCopyConsole) {
      btnCopyConsole.addEventListener('click', () => {
        const text = document.getElementById('console-output-text')?.innerText || '';
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('AeroSculpt terminal execution log copied!');
        });
      });
    }

    // Delete task action
    const btnDeleteTask = document.getElementById('btn-delete-task-action');
    const actionDelete = document.getElementById('action-delete');
    const handleDelete = () => {
      if (confirm('Are you sure you want to delete this photogrammetry task and all reconstructed assets?')) {
        this.showToast('Task deletion is restricted for prebuilt datasets.');
      }
    };
    if (btnDeleteTask) btnDeleteTask.addEventListener('click', handleDelete);
    if (actionDelete) actionDelete.addEventListener('click', handleDelete);

    // Edit project description
    const btnEditProject = document.getElementById('btn-edit-project');
    if (btnEditProject) {
      btnEditProject.addEventListener('click', () => {
        const heading = document.getElementById('project-heading');
        const newTitle = prompt('Enter new Project Name:', heading?.textContent || '');
        if (newTitle && heading) {
          heading.textContent = newTitle;
          this.showToast('Project updated successfully.');
        }
      });
    }

    // Add project button
    const btnAddProject = document.getElementById('btn-add-project');
    if (btnAddProject) {
      btnAddProject.addEventListener('click', () => {
        const name = prompt('Enter New Survey Project Name:');
        if (name) {
          this.showToast(`Project "${name}" created.`);
        }
      });
    }

    // Meaningful Re-Run Pipeline button
    const btnRerunPipeline = document.getElementById('btn-rerun-pipeline');
    if (btnRerunPipeline) {
      btnRerunPipeline.addEventListener('click', () => {
        this.showToast('Re-running AeroSculpt 20-Stage Photogrammetry Pipeline...');
        setConsoleVisibility(true);
        const consoleOutput = document.getElementById('console-output-text');
        if (consoleOutput) {
          const timestamp = new Date().toISOString();
          consoleOutput.innerText += `\n[${timestamp}] [AeroSculpt-Dispatcher] Pipeline re-run request queued.
[${timestamp}] [Stage 01/20] Ingestion verification passed. Validating keyframe caches... [OK]
[${timestamp}] [Stage 04/20] AeroSculpt SLAM visual odometry verified against telemetry.
[${timestamp}] [Stage 12/20] Bundle adjustment convergence confirmed: RMSE = 0.024m.
[${timestamp}] [AeroSculpt-Dispatcher] Re-run completed in 1.2s (using cached geometric pointmaps).`;
          if (consoleBox) consoleBox.scrollTop = consoleBox.scrollHeight;
        }
      });
    }
  }

  // ==========================================================================
  // Project Tabs Navigation (Deep Project Details)
  // ==========================================================================
  initProjectTabs() {
    const tabBtns = document.querySelectorAll('.project-tab-btn');
    const panes = document.querySelectorAll('.project-tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (!targetTab) return;

        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        panes.forEach(pane => {
          pane.classList.toggle('active', pane.id === `pane-${targetTab}`);
        });

        const tabTitle = btn.querySelector('span')?.textContent || btn.textContent.trim();
        this.showToast(`Active Section: ${tabTitle}`);

        if (this.currentView === 'dashboard') {
          const cleanTab = targetTab.replace('tab-', '');
          if (cleanTab === 'tasks') {
            window.location.hash = 'dashboard';
          } else {
            window.location.hash = `dashboard/${cleanTab}`;
          }
        }
      });
    });
  }

  // ==========================================================================
  // Modals & Upload Dropzone
  // ==========================================================================
  initModals() {
    // Open Upload Modal
    const btnSelectImages = document.getElementById('btn-select-images-gcp');
    const menuImportAssets = document.getElementById('menu-import-assets');
    const menuImportVideo = document.getElementById('menu-import-video');
    const menuImportGcp = document.getElementById('menu-import-gcp');

    [btnSelectImages, menuImportAssets, menuImportVideo, menuImportGcp].forEach(el => {
      if (el) el.addEventListener('click', () => this.openModal('modal-upload-backdrop'));
    });

    // Close Upload Modal
    const btnCloseUpload = document.getElementById('btn-close-upload-modal');
    const btnCancelUpload = document.getElementById('btn-cancel-upload');
    [btnCloseUpload, btnCancelUpload].forEach(el => {
      if (el) el.addEventListener('click', () => this.closeModal('modal-upload-backdrop'));
    });

    // Ingest Benchmark Demo 01, 02, 03 Buttons inside Upload Modal
    const demoLoadBtns = document.querySelectorAll('.btn-load-demo-action');
    demoLoadBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const demoId = btn.getAttribute('data-demo');
        if (demoId) {
          this.loadDemoDatasetWithTimedIngestion(demoId);
        }
      });
    });

    // Dropzone interaction
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input-field');
    const btnBrowse = document.getElementById('btn-browse-files');

    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
    }
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', (e) => {
        if (e.target !== btnBrowse) fileInput.click();
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      ['dragleave', 'dragend'].forEach(ev => {
        dropzone.addEventListener(ev, () => dropzone.classList.remove('dragover'));
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer?.files?.length) {
          this.handleSelectedFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files?.length) {
          this.handleSelectedFiles(fileInput.files);
        }
      });
    }

    // Start processing simulation
    const btnStartProc = document.getElementById('btn-start-processing');
    const progressBox = document.getElementById('upload-progress-box');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressPct = document.getElementById('upload-progress-percent');

    if (btnStartProc) {
      btnStartProc.addEventListener('click', () => {
        btnStartProc.disabled = true;
        if (progressBox) progressBox.style.display = 'block';

        let pct = 0;
        const interval = setInterval(() => {
          pct += 20;
          if (progressFill) progressFill.style.width = `${pct}%`;
          if (progressPct) progressPct.textContent = `${pct}%`;

          if (pct >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              this.closeModal('modal-upload-backdrop');
              btnStartProc.disabled = false;
              if (progressBox) progressBox.style.display = 'none';
              this.showToast('✓ Survey task queued to AeroSculpt Local Node (8 vCPUs · RTX GPU)');
            }, 400);
          }
        }, 150);
      });
    }

    // Report Modal
    const btnCloseReport = document.getElementById('btn-close-report-modal');
    const btnCloseReportBtn = document.getElementById('btn-close-report-btn');
    const btnDlPdf = document.getElementById('btn-download-pdf-report');
    const menuReport = document.getElementById('btn-show-report-menu');
    const dlReport = document.getElementById('dl-report');

    [btnCloseReport, btnCloseReportBtn].forEach(el => {
      if (el) el.addEventListener('click', () => this.closeModal('modal-report-backdrop'));
    });

    [menuReport, dlReport].forEach(el => {
      if (el) el.addEventListener('click', () => this.openModal('modal-report-backdrop'));
    });

    if (btnDlPdf) {
      btnDlPdf.addEventListener('click', () => {
        this.showToast('Generating AeroSculpt Quality PDF Report...');
        setTimeout(() => {
          this.showToast('✓ AeroSculpt-Report-2026-09-10.pdf ready');
        }, 1000);
      });
    }

    // Node Status Modal
    const btnNodeStatus = document.getElementById('btn-node-status');
    const sideLinkNodes = document.getElementById('side-link-nodes');
    const btnShowNodesMenu = document.getElementById('btn-show-nodes-menu');
    const btnCloseNode = document.getElementById('btn-close-node-modal');
    const btnCloseNodeBtn = document.getElementById('btn-close-node-btn');

    [btnNodeStatus, sideLinkNodes, btnShowNodesMenu].forEach(el => {
      if (el) el.addEventListener('click', () => this.openModal('modal-node-backdrop'));
    });

    [btnCloseNode, btnCloseNodeBtn].forEach(el => {
      if (el) el.addEventListener('click', () => this.closeModal('modal-node-backdrop'));
    });

    // Tactical Keyboard Guide Modal (F1)
    const btnStudioHelp = document.getElementById('btn-studio-help');
    const btnCloseManual = document.getElementById('btn-close-manual-modal');
    const btnCloseManualBtn = document.getElementById('btn-close-manual-btn');
    if (btnStudioHelp) btnStudioHelp.addEventListener('click', () => this.openModal('modal-manual-backdrop'));
    [btnCloseManual, btnCloseManualBtn].forEach(el => {
      if (el) el.addEventListener('click', () => this.closeModal('modal-manual-backdrop'));
    });

    // Deliverables Export Modal
    const btnStudioExport = document.getElementById('btn-studio-export');
    const btnCloseExport = document.getElementById('btn-close-export-modal');
    const btnCloseExportBtn = document.getElementById('btn-close-export-btn');
    const btnExportPly = document.getElementById('btn-export-ply');
    const btnExportJson = document.getElementById('btn-export-json');
    if (btnStudioExport) btnStudioExport.addEventListener('click', () => this.openModal('modal-export-backdrop'));
    [btnCloseExport, btnCloseExportBtn].forEach(el => {
      if (el) el.addEventListener('click', () => this.closeModal('modal-export-backdrop'));
    });
    if (btnExportPly) {
      btnExportPly.addEventListener('click', () => {
        this.showToast('Generating dense point cloud export (.ply)...');
        setTimeout(() => this.showToast('✓ Dumbarton-Dense-Points.ply exported (48.2 MB)'), 800);
      });
    }
    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        this.showToast('✓ Camera calibration & GCP telemetry exported (.json)');
      });
    }

    // Close on backdrop click
    document.querySelectorAll('.as-modal-backdrop').forEach(bd => {
      bd.addEventListener('click', (e) => {
        if (e.target === bd) {
          bd.classList.remove('show');
        }
      });
    });
  }

  handleSelectedFiles(files) {
    const preview = document.getElementById('upload-files-preview');
    if (!preview) return;

    preview.innerHTML = '';
    const fileList = Array.from(files);
    fileList.slice(0, 5).forEach(f => {
      const chip = document.createElement('div');
      chip.className = 'file-item-chip';
      const isVideo = f.type.includes('video') || f.name.endsWith('.mp4');
      const isCsv = f.name.endsWith('.csv') || f.name.endsWith('.txt');
      const icon = isVideo ? 'fa-video' : (isCsv ? 'fa-crosshairs' : 'fa-image');
      chip.innerHTML = `<i class="fa ${icon}"></i> ${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`;
      preview.appendChild(chip);
    });

    if (fileList.length > 5) {
      const more = document.createElement('div');
      more.className = 'file-item-chip chip-more';
      more.textContent = `+ ${fileList.length - 5} more files selected`;
      preview.appendChild(more);
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
  }

  // ==========================================================================
  // Dropdown Menus Management
  // ==========================================================================
  initDropdowns() {
    const setupToggle = (triggerId, menuId) => {
      const trigger = document.getElementById(triggerId);
      const menu = document.getElementById(menuId);
      if (trigger && menu) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = menu.classList.contains('show');
          document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
          if (!isOpen) menu.classList.add('show');
        });
      }
    };

    setupToggle('user-menu-toggle', 'user-dropdown-menu');
    setupToggle('btn-import-dropdown', 'import-dropdown-menu');
    setupToggle('task-actions-btn', 'task-actions-dropdown');
    setupToggle('btn-download-assets', 'download-dropdown-menu');

    // Close when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    });
  }

  // ==========================================================================
  // 2D Flight Map Canvas Implementation
  // ==========================================================================
  initFlightMap() {
    const canvas = document.getElementById('flight-map-canvas');
    if (!canvas) return;

    // Generate 50 realistic survey camera waypoints across a lawn and rampart perimeter
    this.cameraWaypoints = [];
    const totalWaypoints = 50;
    for (let i = 0; i < totalWaypoints; i++) {
      const t = i / totalWaypoints;
      // Multi-pass figure-eight and perimeter survey lawn path
      const angle = t * Math.PI * 4;
      const radiusX = 0.28 + Math.sin(t * Math.PI * 2) * 0.12;
      const radiusY = 0.24 + Math.cos(t * Math.PI * 2) * 0.08;
      const cx = 0.5 + Math.cos(angle) * radiusX;
      const cy = 0.5 + Math.sin(angle) * radiusY;
      const alt = 62 + Math.sin(i * 0.5) * 4;
      this.cameraWaypoints.push({ index: i + 1, x: cx, y: cy, alt: alt.toFixed(1) });
    }

    // Layer toggles
    const setupLayer = (btnId, layerKey) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          this.activeLayers[layerKey] = !this.activeLayers[layerKey];
          btn.classList.toggle('active', this.activeLayers[layerKey]);
          btn.classList.toggle('btn-primary', this.activeLayers[layerKey]);
          btn.classList.toggle('btn-default', !this.activeLayers[layerKey]);
          this.drawFlightMap();
        });
      }
    };

    setupLayer('btn-layer-ortho', 'ortho');
    setupLayer('btn-layer-cameras', 'cameras');
    setupLayer('btn-layer-gcp', 'gcp');
    setupLayer('btn-layer-polygon', 'polygon');

    const btnResetZoom = document.getElementById('btn-reset-map-zoom');
    if (btnResetZoom) {
      btnResetZoom.addEventListener('click', () => {
        this.drawFlightMap();
        this.showToast('Map view reset to survey bounds.');
      });
    }

    window.addEventListener('resize', () => {
      if (this.currentView === 'map') this.drawFlightMap();
    });
  }

  drawFlightMap() {
    const canvas = document.getElementById('flight-map-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const w = canvas.width;
    const h = canvas.height;

    // 1. Dark Satellite / Orthophoto Background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw UTM Metric Grid Lines (50m grid)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 60;
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

    // Coordinate text labels
    ctx.fillStyle = '#475569';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('340500 E', 10, h - 10);
    ctx.fillText('6203100 N', w - 80, 20);

    // 3. Draw Orthomosaic Survey Footprint
    if (this.activeLayers.ortho) {
      const orthoGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, Math.min(w, h) * 0.45);
      orthoGrad.addColorStop(0, 'rgba(34, 197, 94, 0.28)');
      orthoGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.16)');
      orthoGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      ctx.fillStyle = orthoGrad;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.5, w * 0.38, h * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner terrain contour hints
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.5, w * 0.22, h * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Draw Survey Boundary Polygon
    if (this.activeLayers.polygon) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.rect(w * 0.14, h * 0.14, w * 0.72, h * 0.72);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.font = '11px Inter';
      ctx.fillText('SURVEY BOUNDS (42,500 m²)', w * 0.14 + 10, h * 0.14 + 18);
    }

    // 5. Draw Flight Trajectory Line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.cameraWaypoints.forEach((wp, idx) => {
      const px = wp.x * w;
      const py = wp.y * h;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // 6. Draw 50 Camera Stations
    if (this.activeLayers.cameras) {
      this.cameraWaypoints.forEach((wp) => {
        const px = wp.x * w;
        const py = wp.y * h;

        // Outer glow
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // 7. Draw GCP Markers (Red Crosses)
    if (this.activeLayers.gcp) {
      this.gcpPoints.forEach(gcp => {
        const gx = gcp.x * w;
        const gy = gcp.y * h;

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx - 7, gy);
        ctx.lineTo(gx + 7, gy);
        ctx.moveTo(gx, gy - 7);
        ctx.lineTo(gx, gy + 7);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Inter';
        ctx.fillText(gcp.name, gx + 9, gy + 3);
      });
    }

    // 8. North Arrow & Scale Bar
    const naX = w - 40;
    const naY = 40;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(naX, naY - 14);
    ctx.lineTo(naX - 6, naY + 6);
    ctx.lineTo(naX + 6, naY + 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter';
    ctx.fillText('N', naX - 4, naY - 18);

    // Scale bar 50m
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, h - 30, 90, 4);
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('0', 30, h - 36);
    ctx.fillText('50m', 105, h - 36);
  }

  // ==========================================================================
  // Tactical Studio Workstation Controller & Interactivity
  // ==========================================================================
  initStudio() {
    // Return to dashboard button
    const btnBackDash = document.getElementById('btn-studio-back-dash');
    if (btnBackDash) {
      btnBackDash.addEventListener('click', () => this.switchView('dashboard'));
    }

    // Launch from project tab CTA & preview banner
    const btnLaunchFromTab = document.getElementById('btn-launch-studio-from-tab');
    if (btnLaunchFromTab) {
      btnLaunchFromTab.addEventListener('click', () => this.switchView('studio'));
    }

    const btnLaunchFromPreview = document.getElementById('btn-launch-studio-from-preview');
    if (btnLaunchFromPreview) {
      btnLaunchFromPreview.addEventListener('click', () => this.switchView('studio'));
    }

    // Tab preview camera preset shortcuts
    document.getElementById('tab-preview-cam-front')?.addEventListener('click', () => {
      this.switchView('studio');
      setTimeout(() => this.studioViewer?.setCameraPreset('front'), 100);
    });
    document.getElementById('tab-preview-cam-top')?.addEventListener('click', () => {
      this.switchView('studio');
      setTimeout(() => this.studioViewer?.setCameraPreset('top'), 100);
    });
    document.getElementById('tab-preview-cam-iso')?.addEventListener('click', () => {
      this.switchView('studio');
      setTimeout(() => this.studioViewer?.setCameraPreset('iso'), 100);
    });

    // Full Screen Toggle Button (Fits 100% of Screen Edge-to-Edge)
    const btnFullscreen = document.getElementById('btn-studio-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        const isFull = document.body.classList.toggle('studio-fullscreen-active');
        const icon = btnFullscreen.querySelector('i');
        if (icon) {
          icon.className = isFull ? 'fa fa-compress' : 'fa fa-expand';
        }
        btnFullscreen.title = isFull ? 'Exit Full Screen' : 'Full Screen Viewport (Fits Screen 100%)';

        if (isFull) {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
          this.showToast('Full Screen Workstation Activated (100% Display Fit)');
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          this.showToast('Standard Viewport Layout Restored');
        }

        setTimeout(() => this.studioViewer?.onWindowResize(), 150);
      });

      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && document.body.classList.contains('studio-fullscreen-active')) {
          document.body.classList.remove('studio-fullscreen-active');
          const icon = btnFullscreen.querySelector('i');
          if (icon) icon.className = 'fa fa-expand';
          btnFullscreen.title = 'Full Screen Viewport (Fits Screen 100%)';
          setTimeout(() => this.studioViewer?.onWindowResize(), 150);
        }
      });
    }

    // Studio Mode Switcher Tabs
    const btnModeTwin = document.getElementById('btn-mode-twin');
    const btnModeSensor = document.getElementById('btn-mode-sensor');
    const btnModeGcp = document.getElementById('btn-mode-gcp');
    const leftDrawer = document.getElementById('studio-left-drawer');
    const rightDrawer = document.getElementById('studio-right-drawer');

    if (btnModeTwin) {
      btnModeTwin.addEventListener('click', () => {
        [btnModeTwin, btnModeSensor, btnModeGcp].forEach(b => b?.classList.remove('active'));
        btnModeTwin.classList.add('active');
        leftDrawer?.classList.add('collapsed');
        rightDrawer?.classList.add('collapsed');
        this.isLeftDrawerOpen = false;
        this.isRightDrawerOpen = false;
        setTimeout(() => this.studioViewer?.onWindowResize(), 220);
        this.showToast('3D Twin Studio: Full canvas viewport activated');
      });
    }

    if (btnModeSensor) {
      btnModeSensor.addEventListener('click', () => {
        this.isRightDrawerOpen = !this.isRightDrawerOpen;
        rightDrawer?.classList.toggle('collapsed', !this.isRightDrawerOpen);
        btnModeSensor.classList.toggle('active', this.isRightDrawerOpen);
        setTimeout(() => this.studioViewer?.onWindowResize(), 220);
      });
    }

    if (btnModeGcp) {
      btnModeGcp.addEventListener('click', () => {
        this.isLeftDrawerOpen = !this.isLeftDrawerOpen;
        leftDrawer?.classList.toggle('collapsed', !this.isLeftDrawerOpen);
        btnModeGcp.classList.toggle('active', this.isLeftDrawerOpen);
        setTimeout(() => this.studioViewer?.onWindowResize(), 220);
      });
    }

    // Drawer close buttons
    document.getElementById('btn-close-left-drawer')?.addEventListener('click', () => {
      this.isLeftDrawerOpen = false;
      leftDrawer?.classList.add('collapsed');
      btnModeGcp?.classList.remove('active');
      setTimeout(() => this.studioViewer?.onWindowResize(), 220);
    });

    document.getElementById('btn-close-right-drawer')?.addEventListener('click', () => {
      this.isRightDrawerOpen = false;
      rightDrawer?.classList.add('collapsed');
      btnModeSensor?.classList.remove('active');
      setTimeout(() => this.studioViewer?.onWindowResize(), 220);
    });

    // Focus Mode toggle button (Tab)
    const btnStudioFocus = document.getElementById('btn-studio-focus');
    const toggleFocus = () => {
      const bothOpen = this.isLeftDrawerOpen || this.isRightDrawerOpen;
      this.isLeftDrawerOpen = !bothOpen;
      this.isRightDrawerOpen = !bothOpen;
      leftDrawer?.classList.toggle('collapsed', !this.isLeftDrawerOpen);
      rightDrawer?.classList.toggle('collapsed', !this.isRightDrawerOpen);
      btnModeSensor?.classList.toggle('active', this.isRightDrawerOpen);
      btnModeGcp?.classList.toggle('active', this.isLeftDrawerOpen);
      setTimeout(() => this.studioViewer?.onWindowResize(), 220);
      this.showToast(bothOpen ? 'Focus Mode: Drawers collapsed' : 'Tactical Drawers expanded');
    };
    if (btnStudioFocus) btnStudioFocus.addEventListener('click', toggleFocus);

    // Quick Actions
    document.getElementById('btn-studio-ingest')?.addEventListener('click', () => this.openModal('modal-upload-backdrop'));
    document.getElementById('btn-studio-compute')?.addEventListener('click', () => {
      this.showToast('Computing 3D Multi-View Stereo Reconstruction...');
      setTimeout(() => this.showToast('✓ Multi-view bundle adjustment converged: RMSE 0.024m'), 1200);
    });

    // Floating Viewport HUD Toolbar buttons
    document.getElementById('studio-btn-reset-extents')?.addEventListener('click', () => {
      this.studioViewer?.setCameraPreset('reset');
      this.showToast('Camera centered on Dumbarton Castle extents');
    });

    const toggleHudButton = (id, toggleFn, label) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          const visible = toggleFn();
          btn.classList.toggle('active', visible);
          this.showToast(`${label}: ${visible ? 'Visible' : 'Hidden'}`);
        });
      }
    };

    toggleHudButton('studio-btn-toggle-frustums', () => this.studioViewer?.toggleFrustums(), 'UAV Camera Frustums');
    toggleHudButton('studio-btn-toggle-landmarks', () => this.studioViewer?.toggleLandmarks(), '3D Landmarks');
    toggleHudButton('studio-btn-toggle-mesh', () => this.studioViewer?.toggleMesh(), 'Surface Mesh');
    toggleHudButton('studio-btn-toggle-grid', () => this.studioViewer?.toggleGrid(), 'Metric Datum Grid');
    toggleHudButton('studio-btn-toggle-roi', () => this.studioViewer?.toggleRoi(), '3D ROI Bounding Box');
    toggleHudButton('studio-btn-toggle-gcp', () => this.studioViewer?.toggleGcp(), 'Ground Control Points');
    toggleHudButton('studio-btn-toggle-orbit', () => this.studioViewer?.toggleTurntable(), '360° Continuous Orbit');

    // Ruler tool
    const btnRuler = document.getElementById('studio-btn-ruler');
    if (btnRuler) {
      btnRuler.addEventListener('click', () => {
        const active = this.studioViewer?.toggleRulerMode();
        btnRuler.classList.toggle('active', active);
        this.showToast(active ? 'Ruler Active: Click two points in 3D scene to measure' : 'Ruler deactivated');
      });
    }

    document.getElementById('studio-btn-clear-ruler')?.addEventListener('click', () => {
      this.studioViewer?.clearMeasurement();
      btnRuler?.classList.remove('active');
    });

    // Shading Mode Dropdown
    const shadingSelect = document.getElementById('studio-shading-select');
    if (shadingSelect) {
      shadingSelect.addEventListener('change', (e) => {
        this.studioViewer?.setShadingMode(e.target.value);
        this.showToast(`Shading Mode: ${shadingSelect.options[shadingSelect.selectedIndex].text}`);
      });
    }

    // GCP Table Row Clicks
    const gcpRows = document.querySelectorAll('#studio-gcp-table-body tr');
    const inpLat = document.getElementById('inp-gcp-lat');
    const inpLon = document.getElementById('inp-gcp-lon');
    const inpElev = document.getElementById('inp-gcp-elev');
    const activeGcpTitle = document.getElementById('active-gcp-title');

    gcpRows.forEach(row => {
      row.addEventListener('click', () => {
        gcpRows.forEach(r => r.classList.remove('active-gcp-row'));
        row.classList.add('active-gcp-row');
        const id = row.getAttribute('data-gcp');
        const lat = row.getAttribute('data-lat');
        const lon = row.getAttribute('data-lon');
        const elev = row.getAttribute('data-elev');
        if (activeGcpTitle) activeGcpTitle.textContent = id;
        if (inpLat && lat) inpLat.value = lat;
        if (inpLon && lon) inpLon.value = lon;
        if (inpElev && elev) inpElev.value = elev;
        this.showToast(`Inspector: ${id} selected`);
      });
    });

    document.getElementById('btn-pin-gcp')?.addEventListener('click', () => {
      this.showToast('Click in 3D viewport to pin survey checkpoint.');
    });
    document.getElementById('btn-revert-gcp')?.addEventListener('click', () => {
      this.showToast('GCP coordinates reverted to survey baseline.');
    });
    document.getElementById('btn-delete-gcp')?.addEventListener('click', () => {
      this.showToast('GCP deletion restricted for prebuilt datasets.');
    });

    // D-Pad Cluster & Zoom
    document.getElementById('dpad-up')?.addEventListener('click', () => this.studioViewer?.panOrbit(0, 1));
    document.getElementById('dpad-down')?.addEventListener('click', () => this.studioViewer?.panOrbit(0, -1));
    document.getElementById('dpad-left')?.addEventListener('click', () => this.studioViewer?.panOrbit(1, 0));
    document.getElementById('dpad-right')?.addEventListener('click', () => this.studioViewer?.panOrbit(-1, 0));
    document.getElementById('dpad-home')?.addEventListener('click', () => this.studioViewer?.panOrbit(0, 0));

    document.getElementById('btn-dock-zoom-in')?.addEventListener('click', () => this.studioViewer?.zoom(0.85));
    document.getElementById('btn-dock-zoom-out')?.addEventListener('click', () => this.studioViewer?.zoom(1.18));
    document.getElementById('btn-dock-turntable')?.addEventListener('click', () => {
      const spinning = this.studioViewer?.toggleTurntable();
      this.showToast(`Auto-Orbit Turntable: ${spinning ? 'Active' : 'Stopped'}`);
    });

    // Camera Presets
    const presetBtns = [
      { id: 'dock-cam-top', preset: 'top' },
      { id: 'dock-cam-front', preset: 'front' },
      { id: 'dock-cam-side', preset: 'side' },
      { id: 'dock-cam-iso', preset: 'iso' }
    ];
    presetBtns.forEach(({ id, preset }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          presetBtns.forEach(p => document.getElementById(p.id)?.classList.remove('active'));
          btn.classList.add('active');
          this.studioViewer?.setCameraPreset(preset);
        });
      }
    });

    // Point Size Stepper
    let currentPointSize = 1.0;
    const valPtSize = document.getElementById('val-point-size');
    document.getElementById('btn-pt-minus')?.addEventListener('click', () => {
      currentPointSize = Math.max(0.4, +(currentPointSize - 0.2).toFixed(1));
      if (valPtSize) valPtSize.textContent = `${currentPointSize.toFixed(1)}px`;
      this.studioViewer?.setPointSize(currentPointSize);
    });
    document.getElementById('btn-pt-plus')?.addEventListener('click', () => {
      currentPointSize = Math.min(4.0, +(currentPointSize + 0.2).toFixed(1));
      if (valPtSize) valPtSize.textContent = `${currentPointSize.toFixed(1)}px`;
      this.studioViewer?.setPointSize(currentPointSize);
    });

    // Sensor Tabs (Keyframe / Spectral Depth)
    const btnTabKeyframe = document.getElementById('btn-tab-keyframe');
    const btnTabDepth = document.getElementById('btn-tab-depth');
    const paneKeyframe = document.getElementById('pane-keyframe-view');
    const paneDepth = document.getElementById('pane-depth-view');

    if (btnTabKeyframe && btnTabDepth) {
      btnTabKeyframe.addEventListener('click', () => {
        btnTabKeyframe.classList.add('active');
        btnTabDepth.classList.remove('active');
        paneKeyframe?.classList.add('active');
        paneDepth?.classList.remove('active');
        this.drawKeyframeCanvas();
      });

      btnTabDepth.addEventListener('click', () => {
        btnTabDepth.classList.add('active');
        btnTabKeyframe.classList.remove('active');
        paneDepth?.classList.add('active');
        paneKeyframe?.classList.remove('active');
        this.drawDepthCanvas();
      });
    }

    // Keyframe layer buttons
    const keyframeToggles = [
      { id: 'toggle-layer-image', key: 'image' },
      { id: 'toggle-layer-features', key: 'features' },
      { id: 'toggle-layer-landmarks', key: 'landmarks' },
      { id: 'toggle-layer-residuals', key: 'residuals' }
    ];
    keyframeToggles.forEach(({ id, key }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          this.keyframeLayers[key] = !this.keyframeLayers[key];
          btn.classList.toggle('active', this.keyframeLayers[key]);
          this.drawKeyframeCanvas();
        });
      }
    });

    // Depth Colormap Selector
    const colormapBtns = document.querySelectorAll('#depth-colormap-group button');
    colormapBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colormapBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.depthColormap = btn.getAttribute('data-map');
        this.drawDepthCanvas();
      });
    });

    // Timeline Scrubber & Slideshow Playback
    const timelineSlider = document.getElementById('timeline-slider');
    const frameSpinbox = document.getElementById('timeline-frame-spinbox');
    const btnPlay = document.getElementById('btn-timeline-play');
    const speedSlider = document.getElementById('timeline-speed-slider');
    const speedVal = document.getElementById('timeline-speed-val');

    if (timelineSlider) {
      timelineSlider.addEventListener('input', (e) => {
        this.setKeyframe(parseInt(e.target.value, 10));
      });
    }
    if (frameSpinbox) {
      frameSpinbox.addEventListener('change', (e) => {
        this.setKeyframe(parseInt(e.target.value, 10));
      });
    }

    if (btnPlay) {
      btnPlay.addEventListener('click', () => this.toggleTimelinePlayback());
    }

    if (speedSlider && speedVal) {
      speedSlider.addEventListener('input', (e) => {
        speedVal.textContent = `${e.target.value}x`;
        if (this.isPlayingTimeline) {
          this.startTimelinePlayback();
        }
      });
    }

    // Global Tactical Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.currentView !== 'studio') return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        toggleFocus();
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.toggleTimelinePlayback();
      } else if (e.key === 'r' || e.key === 'R') {
        this.studioViewer?.setCameraPreset('reset');
      } else if (e.key === 'c' || e.key === 'C') {
        document.getElementById('studio-btn-toggle-frustums')?.click();
      } else if (e.key === 'l' || e.key === 'L') {
        document.getElementById('studio-btn-toggle-landmarks')?.click();
      } else if (e.key === 'g' || e.key === 'G') {
        document.getElementById('studio-btn-toggle-grid')?.click();
      } else if (e.key === 's' || e.key === 'S') {
        document.getElementById('studio-btn-toggle-roi')?.click();
      } else if (e.key === 'F1') {
        e.preventDefault();
        this.openModal('modal-manual-backdrop');
      } else if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        this.openModal('modal-upload-backdrop');
      }
    });

    // Initialize keyframe 24
    this.setKeyframe(24);
  }

  setKeyframe(index) {
    const dataset = DEMO_DATASETS[this.currentDemoId] || DEMO_DATASETS['01'];
    const maxFrames = dataset.maxFrames || 50;
    const clamped = Math.max(1, Math.min(maxFrames, index));
    this.activeKeyframe = clamped;

    const timelineSlider = document.getElementById('timeline-slider');
    const frameSpinbox = document.getElementById('timeline-frame-spinbox');
    const badgeVal = document.getElementById('timeline-badge-val');
    const filenameChip = document.getElementById('keyframe-filename-chip');

    if (timelineSlider) {
      timelineSlider.max = maxFrames;
      timelineSlider.value = clamped;
    }
    if (frameSpinbox) {
      frameSpinbox.max = maxFrames;
      frameSpinbox.value = clamped;
    }
    if (badgeVal) badgeVal.textContent = `Station ${clamped}/${maxFrames}`;
    if (filenameChip) {
      const padNum = String(clamped).padStart(3, '0');
      filenameChip.textContent = `${dataset.framePrefix || 'frame_'}${padNum}${dataset.frameExt || '.jpg'}`;
    }

    // Telemetry updates based on keyframe position
    const t = clamped / maxFrames;
    const yaw = (t * 360 + 45) % 360;
    const pitch = (-3.2 + Math.sin(t * Math.PI * 4) * 2.5).toFixed(1);
    const roll = (Math.cos(t * Math.PI * 4) * 1.8).toFixed(1);
    const altAgl = (dataset.id === '03' ? 12.0 : (62 + Math.sin(t * Math.PI * 2) * 5)).toFixed(1);
    const altMsl = (dataset.id === '03' ? 430.5 : (86.3 + Math.sin(t * Math.PI * 2) * 5)).toFixed(1);
    const distTarget = (dataset.id === '03' ? 25.0 : (42 + Math.cos(t * Math.PI * 2) * 8)).toFixed(1);

    const valYaw = document.getElementById('val-yaw');
    const valPitch = document.getElementById('val-pitch');
    const valRoll = document.getElementById('val-roll');
    const needleYaw = document.getElementById('needle-yaw');
    const needlePitch = document.getElementById('needle-pitch');
    const needleRoll = document.getElementById('needle-roll');
    const valAltAgl = document.getElementById('val-alt-agl');
    const valAltMsl = document.getElementById('val-alt-msl');
    const valDistTarget = document.getElementById('val-dist-target');

    if (valYaw) valYaw.textContent = `${yaw.toFixed(1)}°`;
    if (needleYaw) needleYaw.style.transform = `rotate(${yaw.toFixed(0)}deg)`;
    if (valPitch) valPitch.textContent = `${pitch}°`;
    if (needlePitch) needlePitch.style.transform = `translateY(${Math.round(parseFloat(pitch) * 2)}px)`;
    if (valRoll) valRoll.textContent = `${roll > 0 ? '+' : ''}${roll}°`;
    if (needleRoll) needleRoll.style.transform = `rotate(${roll}deg)`;
    if (valAltAgl) valAltAgl.textContent = `${altAgl} m`;
    if (valAltMsl) valAltMsl.textContent = `${altMsl} m`;
    if (valDistTarget) valDistTarget.textContent = `${distTarget} m`;

    // Update 3D camera frustum highlight and sightline laser beam
    this.studioViewer?.setActiveKeyframe(clamped - 1);

    // Redraw 2D keyframe canvas (which also updates depth canvas)
    this.drawKeyframeCanvas();
  }

  toggleTimelinePlayback() {
    this.isPlayingTimeline = !this.isPlayingTimeline;
    const icon = document.getElementById('icon-timeline-play');
    if (icon) {
      icon.className = this.isPlayingTimeline ? 'fa fa-pause' : 'fa fa-play';
    }

    if (this.isPlayingTimeline) {
      this.startTimelinePlayback();
      this.showToast('Slideshow: Playing UAV flight trajectory');
    } else {
      clearInterval(this.timelineTimer);
    }
  }

  startTimelinePlayback() {
    clearInterval(this.timelineTimer);
    const speed = parseInt(document.getElementById('timeline-speed-slider')?.value || '2', 10);
    const intervalMs = Math.max(100, Math.floor(1000 / speed));
    const dataset = DEMO_DATASETS[this.currentDemoId] || DEMO_DATASETS['01'];
    const maxFrames = dataset.maxFrames || 50;

    this.timelineTimer = setInterval(() => {
      let nextFrame = this.activeKeyframe + 1;
      if (nextFrame > maxFrames) nextFrame = 1;
      this.setKeyframe(nextFrame);
    }, intervalMs);
  }

  drawKeyframeCanvas() {
    const canvas = document.getElementById('studio-keyframe-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Dark slate canvas base
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    const frameUrl = this.getFrameUrl(this.currentDemoId, this.activeKeyframe);

    // 1. Draw Real Image Frame
    if (this.keyframeLayers.image) {
      let img = this.imageCache.get(frameUrl);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = frameUrl;
        img.onload = () => {
          if (this.getFrameUrl(this.currentDemoId, this.activeKeyframe) === frameUrl) {
            this.drawKeyframeCanvas();
          }
        };
        this.imageCache.set(frameUrl, img);
      }

      if (img.complete && img.naturalWidth > 0) {
        // Draw real image to fit canvas bounds
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        // Subtle loading backdrop
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`STREAMING REAL SENSOR FRAME ${this.activeKeyframe}...`, w / 2, h / 2);
      }
    }

    // 2. Overlay Computer Vision Telemetry (Features, Landmarks, Residuals)
    const t = this.activeKeyframe;

    if (this.keyframeLayers.features) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 32; i++) {
        const seed = (t * 7 + i * 13) % 100;
        const fx = ((seed * 3.7) % (w - 40)) + 20;
        const fy = ((seed * 2.3) % (h - 60)) + 30;
        ctx.beginPath();
        ctx.moveTo(fx - 4, fy);
        ctx.lineTo(fx + 4, fy);
        ctx.moveTo(fx, fy - 4);
        ctx.lineTo(fx, fy + 4);
        ctx.stroke();
      }
    }

    if (this.keyframeLayers.landmarks) {
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < 20; i++) {
        const seed = (t * 11 + i * 19) % 100;
        const lx = ((seed * 3.4) % (w - 60)) + 30;
        const ly = ((seed * 2.1) % (h - 70)) + 35;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.keyframeLayers.residuals) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 14; i++) {
        const seed = (t * 13 + i * 23) % 100;
        const rx = ((seed * 3.2) % (w - 50)) + 25;
        const ry = ((seed * 1.9) % (h - 60)) + 40;
        const dx = Math.sin(seed) * 6;
        const dy = Math.cos(seed) * 6;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + dx, ry + dy);
        ctx.stroke();
      }
    }

    // Always update depth canvas
    this.drawDepthCanvas();
  }

  drawDepthCanvas() {
    const canvas = document.getElementById('studio-depth-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const depthUrl = this.getDepthUrl(this.currentDemoId, this.activeKeyframe);

    if (depthUrl) {
      let img = this.imageCache.get(depthUrl);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = depthUrl;
        img.onload = () => {
          if (this.getDepthUrl(this.currentDemoId, this.activeKeyframe) === depthUrl) {
            this.drawDepthCanvas();
          }
        };
        this.imageCache.set(depthUrl, img);
      }

      if (img.complete && img.naturalWidth > 0) {
        // Draw real depth map onto canvas
        ctx.drawImage(img, 0, 0, w, h);

        // Auto-stretch dynamic range and apply chosen colormap
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let minVal = 255;
        let maxVal = 0;
        for (let i = 0; i < data.length; i += 4) {
          const v = data[i];
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
        const range = Math.max(1, maxVal - minVal);

        for (let i = 0; i < data.length; i += 4) {
          const dNorm = (data[i] - minVal) / range;
          let r = 0, g = 0, b = 0;
          if (this.depthColormap === 'inferno') {
            r = Math.min(255, Math.floor(dNorm * 300));
            g = Math.min(255, Math.floor(Math.pow(dNorm, 2) * 255));
            b = Math.min(255, Math.floor(Math.sin(dNorm * Math.PI) * 180 + (dNorm < 0.3 ? 80 : 0)));
          } else if (this.depthColormap === 'turbo') {
            r = Math.min(255, Math.floor(Math.sin(dNorm * Math.PI * 0.9) * 255));
            g = Math.min(255, Math.floor(Math.sin(dNorm * Math.PI) * 255));
            b = Math.min(255, Math.floor(Math.cos(dNorm * Math.PI * 0.8) * 255));
          } else if (this.depthColormap === 'rainbow') {
            r = Math.min(255, Math.floor(Math.abs(dNorm * 2 - 1) * 255));
            g = Math.min(255, Math.floor(Math.sin(dNorm * Math.PI) * 255));
            b = Math.min(255, Math.floor((1 - dNorm) * 255));
          } else {
            const gray = Math.floor(dNorm * 255);
            r = gray; g = gray; b = gray;
          }
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);

        // Concentric depth reticle overlays
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.55, 45, 0, Math.PI * 2);
        ctx.arc(w * 0.5, h * 0.55, 80, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
    }

    // Fallback: Synthesize dense colormapped depth map
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const idx = (y * w + x) * 4;

        const distToCenter = Math.hypot(nx - 0.5, ny - 0.55);
        let depthNorm = ny * 0.7 + (1 - Math.min(1, distToCenter * 2.2)) * 0.35;
        depthNorm = Math.min(1, Math.max(0, depthNorm));

        let r = 0, g = 0, b = 0;

        if (this.depthColormap === 'inferno') {
          r = Math.min(255, Math.floor(depthNorm * 300));
          g = Math.min(255, Math.floor(Math.pow(depthNorm, 2) * 255));
          b = Math.min(255, Math.floor(Math.sin(depthNorm * Math.PI) * 180 + (depthNorm < 0.3 ? 80 : 0)));
        } else if (this.depthColormap === 'turbo') {
          r = Math.min(255, Math.floor(Math.sin(depthNorm * Math.PI * 0.9) * 255));
          g = Math.min(255, Math.floor(Math.sin(depthNorm * Math.PI) * 255));
          b = Math.min(255, Math.floor(Math.cos(depthNorm * Math.PI * 0.8) * 255));
        } else if (this.depthColormap === 'rainbow') {
          r = Math.min(255, Math.floor(Math.abs(depthNorm * 2 - 1) * 255));
          g = Math.min(255, Math.floor(Math.sin(depthNorm * Math.PI) * 255));
          b = Math.min(255, Math.floor((1 - depthNorm) * 255));
        } else {
          const gray = Math.floor(depthNorm * 255);
          r = gray; g = gray; b = gray;
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.55, 45, 0, Math.PI * 2);
    ctx.arc(w * 0.5, h * 0.55, 80, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ==========================================================================
  // Benchmark Demo Datasets Controller (01, 02, 03)
  // ==========================================================================
  initDemoDatasets() {
    // 1. Dashboard Studio Tab Launch Buttons
    const dashDemoBtns = document.querySelectorAll('.btn-launch-demo-card');
    dashDemoBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const demoId = btn.getAttribute('data-demo');
        if (demoId) {
          this.loadDemoDatasetWithTimedIngestion(demoId);
        }
      });
    });

    // 2. Studio Top Bar Dataset Selector Dropdown
    const studioSelector = document.getElementById('studio-dataset-selector');
    if (studioSelector) {
      studioSelector.addEventListener('change', (e) => {
        const demoId = e.target.value;
        if (demoId) {
          this.loadDemoDatasetWithTimedIngestion(demoId);
        }
      });
    }
  }

  // ==========================================================================
  // Nextgen Unified Dashboard Controller (Dribbble 10778721 Style)
  // ==========================================================================
  initNextgenDashboard() {
    // 1. Hero Action Buttons
    const btnHeroIngest = document.getElementById('btn-hero-ingest');
    if (btnHeroIngest) {
      btnHeroIngest.addEventListener('click', () => {
        this.openModal('modal-upload-backdrop');
      });
    }

    const btnHeroStudio = document.getElementById('btn-hero-studio');
    if (btnHeroStudio) {
      btnHeroStudio.addEventListener('click', () => {
        this.switchView('studio');
      });
    }

    // 2. Nextgen Stepped Dataset Switcher: (1) ──── (2) ──── (3)
    const stepNodes = document.querySelectorAll('.nextgen-stepped-selector .step-node');
    stepNodes.forEach(node => {
      node.addEventListener('click', () => {
        const step = node.getAttribute('data-step');
        if (step) {
          const demoId = step.padStart(2, '0');
          this.selectDatasetOnDashboard(demoId, true);
        }
      });
    });

    // 3. Quick Model Bar buttons on 3D Card
    const quickModelBtns = document.querySelectorAll('.btn-quick-model');
    quickModelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const modelNum = btn.getAttribute('data-model');
        if (modelNum) {
          const demoId = modelNum.padStart(2, '0');
          this.selectDatasetOnDashboard(demoId, true);
        }
      });
    });

    // 4. Auto-load PB2 (Svalbard) into dashboard 3D viewer on startup
    setTimeout(() => {
      this.selectDatasetOnDashboard('02', false, false);
    }, 300);
  }

  selectDatasetOnDashboard(demoId, showToast = true, metaOnlyNoModel = false) {
    const dataset = DEMO_DATASETS[demoId];
    if (!dataset) return;
    this.currentDemoId = demoId;

    // 1. Update Stepped Selector active state & progress line
    const stepNum = parseInt(demoId, 10);
    document.querySelectorAll('.nextgen-stepped-selector .step-node').forEach(node => {
      node.classList.toggle('active', parseInt(node.getAttribute('data-step'), 10) === stepNum);
    });
    const progressLine = document.getElementById('step-progress-line');
    if (progressLine) {
      progressLine.style.width = stepNum === 1 ? '0%' : stepNum === 2 ? '50%' : '100%';
    }

    // 2. Update 3D card title to dataset name
    const modelCardTitle = document.getElementById('model-card-title');
    if (modelCardTitle) modelCardTitle.textContent = dataset.name;

    // 3. Load 3D Model into Viewport (skip on initial meta-only call)
    if (!metaOnlyNoModel && this.viewer3d) {
      this.viewer3d.loadModel(
        dataset.modelUrl,
        dataset.rotationY || 0,
        dataset.scaleFactor || 1,
        dataset.rotX || 0
      );
    } else if (metaOnlyNoModel && this.viewer3d) {
      // Show empty placeholder state - no model loaded
      this.viewer3d.showEmptyState && this.viewer3d.showEmptyState();
    }

    // 4. Update HUD Overlays (polygons / vertices)
    const polyElem = document.getElementById('hud-poly-count');
    if (polyElem) polyElem.textContent = dataset.triangles;
    const vertElem = document.getElementById('hud-vertex-count');
    if (vertElem) vertElem.textContent = dataset.vertices;
    const filenameElem = document.getElementById('model-loader-filename');
    if (filenameElem) filenameElem.textContent = dataset.modelUrl.split('/').pop();

    // 5. Update Video Player — swap src to dataset's paired video
    const videoSubtitle = document.getElementById('video-breadcrumb-feed-name');
    if (videoSubtitle) videoSubtitle.textContent = dataset.name;

    const videoElem = document.getElementById('drone-inspection-video');
    if (videoElem && dataset.videoUrl) {
      const newSrc = new URL(dataset.videoUrl, window.location.href).href;
      if (!videoElem.src || videoElem.src !== newSrc) {
        videoElem.src = dataset.videoUrl;
        videoElem.load();
        videoElem.play().catch(() => {});
      }
    }

    const hudTitle = document.getElementById('hud-feed-title');
    if (hudTitle) hudTitle.textContent = `${dataset.name.toUpperCase()} · LIVE`;

    const metaName = document.getElementById('meta-video-name');
    if (metaName) metaName.textContent = dataset.videoUrl.split('/').pop();
    const metaSize = document.getElementById('meta-video-size');
    if (metaSize) metaSize.textContent = dataset.videoSize;
    const metaRes = document.getElementById('meta-video-res');
    if (metaRes) metaRes.textContent = `${dataset.videoRes} · LOCKED`;
    const metaType = document.getElementById('meta-video-type');
    if (metaType) metaType.textContent = dataset.sensor;

    // 6. Update Hero Intel Card mission title
    const missionTitle = document.getElementById('nextgen-active-mission-title');
    if (missionTitle) missionTitle.textContent = `${dataset.name} (${dataset.format})`;

    // 7. Update Executive KPI Metrics
    const kpiReproj = document.getElementById('kpi-val-reproj');
    if (kpiReproj && dataset.reprojectionError) kpiReproj.innerHTML = `${dataset.reprojectionError.replace(' px', '')}<span class="kpi-unit">px</span>`;

    const kpiGsd = document.getElementById('kpi-val-gsd');
    if (kpiGsd && dataset.gsd) kpiGsd.innerHTML = `${dataset.gsd.replace(' cm/px', '')}<span class="kpi-unit">cm/px</span>`;

    const kpiAcc = document.getElementById('kpi-val-accuracy');
    if (kpiAcc && dataset.horizontalRmse) kpiAcc.innerHTML = `${dataset.horizontalRmse.replace('m', '')}<span class="kpi-unit">m</span>`;

    const kpiPoints = document.getElementById('kpi-val-points');
    if (kpiPoints) {
      const pts = dataset.vertices || dataset.pointCloud || '1,428,950';
      kpiPoints.innerHTML = `${pts.replace(' points', '').replace(' vertices', '')}`;
    }

    const kpiMesh = document.getElementById('kpi-val-mesh');
    if (kpiMesh && dataset.triangles) kpiMesh.innerHTML = `${dataset.triangles}`;

    // 8. Redraw 2D Map Canvas
    this.drawFlightMap();

    if (showToast) {
      this.showToast(`Nextgen Dataset ${demoId} Activated: ${dataset.name}`);
    }
  }

  loadDemoDatasetWithTimedIngestion(demoId) {
    const dataset = DEMO_DATASETS[demoId];
    if (!dataset) return;

    const overlay = document.getElementById('demo-timed-progress-box');
    const fill = document.getElementById('timed-progress-fill');
    const title = document.getElementById('timed-progress-title');
    const subtitle = document.getElementById('timed-progress-subtitle');
    const s1 = document.getElementById('tstep-1');
    const s2 = document.getElementById('tstep-2');
    const s3 = document.getElementById('tstep-3');
    const s4 = document.getElementById('tstep-4');

    // If modal is not active, open it so user sees the progress bar
    const modalBackdrop = document.getElementById('modal-upload-backdrop');
    if (modalBackdrop && !modalBackdrop.classList.contains('active')) {
      this.openModal('modal-upload-backdrop');
    }

    if (overlay) overlay.style.display = 'block';

    // Stage 1 (0ms): Ingesting UAV Video Feed
    if (fill) fill.style.width = '20%';
    if (title) title.textContent = `Demuxing ${dataset.name} UAV Video Feed...`;
    if (subtitle) subtitle.textContent = `Ingesting high-resolution optical video stream & sensor telemetry (GSD target: ${dataset.gsd})...`;
    if (s1) s1.className = 't-step active';
    if (s2) s2.className = 't-step';
    if (s3) s3.className = 't-step';
    if (s4) s4.className = 't-step';

    // Stage 2 (700ms): Multi-View Pose & Bundle Adjustment
    setTimeout(() => {
      if (fill) fill.style.width = '55%';
      if (title) title.textContent = `Computing Geodetic Consensus & Bundle Adjustment...`;
      if (subtitle) subtitle.textContent = `Registering camera stations in ${dataset.datum} (Mean reprojection error: ${dataset.reprojectionError})...`;
      if (s1) s1.className = 't-step done';
      if (s2) s2.className = 't-step active';
    }, 700);

    // Stage 3 (1400ms): Screened Poisson Watertight Surface Reconstruction
    setTimeout(() => {
      if (fill) fill.style.width = '85%';
      if (title) title.textContent = `Synthesizing Watertight Screened Poisson Surface...`;
      if (subtitle) subtitle.textContent = `Extracting ${dataset.triangles} watertight triangles and applying PBR UV textures...`;
      if (s2) s2.className = 't-step done';
      if (s3) s3.className = 't-step active';
    }, 1400);

    // Stage 4 (2100ms): Output Deliverables Finalized
    setTimeout(() => {
      if (fill) fill.style.width = '100%';
      if (title) title.textContent = `Ingestion Complete! Output Deliverables Ready`;
      if (subtitle) subtitle.textContent = `Loading ${dataset.format} and calibrated sensor feeds into 3D Workstation...`;
      if (s3) s3.className = 't-step done';
      if (s4) s4.className = 't-step done';
    }, 2100);

    // Completion (2600ms): Close modal and apply dataset to studio & viewers
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
      this.closeModal('modal-upload-backdrop');
      this.applyDemoDataset(demoId);
    }, 2600);
  }

  applyDemoDataset(demoId) {
    const dataset = DEMO_DATASETS[demoId];
    if (!dataset) return;

    this.currentDemoId = demoId;

    // 1. Switch to Tactical Studio Workstation
    this.switchView('studio');

    // 2. Load 3D model into Studio Viewer & setup trajectory
    if (this.studioViewer) {
      this.studioViewer.loadModel(
        dataset.modelUrl,
        dataset.rotationY || 0,
        dataset.scaleFactor || 1,
        dataset.rotX || 0,
        demoId
      );
    }

    // 3. Keep Main 3D Viewer & Dashboard synchronized
    this.selectDatasetOnDashboard(demoId, false, false);



    // 4. Update Studio Header Dataset Switcher
    const studioSelector = document.getElementById('studio-dataset-selector');
    if (studioSelector) studioSelector.value = demoId;

    const missionTag = document.getElementById('studio-mission-tag');
    if (missionTag) missionTag.textContent = `MISSION ${demoId} · ${dataset.datum}`;

    // 5. Update Studio Output Deliverables & Precision Card
    const badgeElem = document.getElementById('studio-output-badge');
    if (badgeElem) badgeElem.textContent = 'DELIVERABLES READY';

    const gsdElem = document.getElementById('studio-out-gsd');
    if (gsdElem) gsdElem.textContent = dataset.gsd;

    const reprojElem = document.getElementById('studio-out-reproj');
    if (reprojElem) reprojElem.textContent = dataset.reprojectionError;

    const polyElem = document.getElementById('studio-out-poly');
    if (polyElem) polyElem.textContent = `${dataset.triangles} Triangles · ${dataset.vertices} Verts`;

    const rmseElem = document.getElementById('studio-out-rmse');
    if (rmseElem) rmseElem.textContent = `H: ${dataset.horizontalRmse} · V: ${dataset.verticalRmse}`;

    const glbNameElem = document.getElementById('studio-out-glb-name');
    if (glbNameElem) glbNameElem.textContent = dataset.format;

    const glbSizeElem = document.getElementById('studio-out-glb-size');
    if (glbSizeElem) glbSizeElem.textContent = dataset.fileSize;

    const vidNameElem = document.getElementById('studio-out-vid-name');
    if (vidNameElem) vidNameElem.textContent = `${dataset.name} Stream`;

    const vidSizeElem = document.getElementById('studio-out-vid-size');
    if (vidSizeElem) vidSizeElem.textContent = dataset.videoSize;

    const datumBadge = document.getElementById('studio-datum-badge');
    if (datumBadge) datumBadge.textContent = `${dataset.datum} Locked`;

    // 6. Update Video Player and Video View
    const videoElem = document.getElementById('drone-inspection-video');
    if (videoElem && dataset.videoUrl) {
      videoElem.src = dataset.videoUrl;
      videoElem.play().catch(() => {});
    }

    const hudTitle = document.getElementById('hud-feed-title');
    if (hudTitle) hudTitle.textContent = `DATASET ${demoId}: ${dataset.name.toUpperCase()} STREAM ACTIVE`;

    const metaName = document.getElementById('meta-video-name');
    if (metaName) metaName.textContent = dataset.videoUrl;

    const metaSize = document.getElementById('meta-video-size');
    if (metaSize) metaSize.textContent = `${dataset.videoSize} (Local Asset)`;

    const metaRes = document.getElementById('meta-video-res');
    if (metaRes) metaRes.textContent = dataset.videoRes;

    const metaType = document.getElementById('meta-video-type');
    if (metaType) metaType.textContent = dataset.sensor;

    // Highlight corresponding button in video view
    const feedBtns = document.querySelectorAll('.feed-tab-btn');
    feedBtns.forEach(btn => {
      const match = btn.getAttribute('data-video') === dataset.videoUrl ||
                    btn.getAttribute('data-video')?.includes(`0${demoId}`);
      btn.classList.toggle('active', match);
      btn.classList.toggle('btn-primary', match);
      btn.classList.toggle('btn-default', !match);
    });

    // 7. Update Dashboard Project Header & KPIs
    const taskNameElem = document.getElementById('task-name-link');
    if (taskNameElem) {
      taskNameElem.textContent = `[${dataset.name}] ${dataset.location}`;
    }

    const taskDescElem = document.getElementById('task-summary-desc');
    if (taskDescElem) {
      taskDescElem.textContent = dataset.description;
    }

    // Update Dashboard KPIs with dataset deliverables
    const kpiGsd = document.getElementById('kpi-val-gsd');
    if (kpiGsd) kpiGsd.textContent = dataset.gsd;

    const kpiReproj = document.getElementById('kpi-val-reproj');
    if (kpiReproj) kpiReproj.textContent = dataset.reprojectionError;

    const kpiArea = document.getElementById('kpi-val-area');
    if (kpiArea) kpiArea.textContent = dataset.reconstructedArea;

    const kpiAccuracy = document.getElementById('kpi-val-accuracy');
    if (kpiAccuracy) kpiAccuracy.textContent = dataset.horizontalRmse;

    const kpiMesh = document.getElementById('kpi-val-mesh');
    if (kpiMesh) {
      const kVal = Math.round(parseInt(dataset.triangles.replace(/,/g, ''), 10) / 1000);
      kpiMesh.innerHTML = `${kVal}<span class="kpi-unit">k</span>`;
    }

    // 8. Update Quality Report Modal stats
    const rGsd = document.querySelector('.report-stats-cards .r-card:nth-child(1) .r-val');
    if (rGsd) rGsd.textContent = dataset.gsd;

    const rReproj = document.querySelector('.report-stats-cards .r-card:nth-child(3) .r-val');
    if (rReproj) rReproj.textContent = dataset.reprojectionError;

    // 8b. Update Studio GCP Table Body
    const gcpTableBody = document.getElementById('studio-gcp-table-body');
    if (gcpTableBody) {
      gcpTableBody.innerHTML = `
        <tr class="active-gcp-row" data-gcp="GCP-01"><td><strong>GCP-01</strong></td><td>South Rampart</td><td><span class="pill-locked">Locked 🟢</span></td></tr>
        <tr data-gcp="GCP-02"><td><strong>GCP-02</strong></td><td>Castle Gate</td><td><span class="pill-locked">Locked 🟢</span></td></tr>
        <tr data-gcp="GCP-03"><td><strong>GCP-03</strong></td><td>River Wall</td><td><span class="pill-locked">Locked 🟢</span></td></tr>
        <tr data-gcp="GCP-04"><td><strong>GCP-04</strong></td><td>North Ridge</td><td><span class="pill-locked">Locked 🟢</span></td></tr>
      `;
    }

    // 9. Reset Keyframe to station appropriate for dataset
    this.setKeyframe(demoId === '03' ? 15 : 24);

    // 10. Toast notification
    this.showToast(`✓ ${dataset.name} Ingested & Watertight 3D Deliverables Loaded!`);
  }

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<i class="fa fa-circle-check text-success"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Instantiate on DOM load or immediately if already loaded
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.aeroSculptApp = new AeroSculptApp();
  });
} else {
  window.aeroSculptApp = new AeroSculptApp();
}
