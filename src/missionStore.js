// AeroSculpt Central Mission Store
// Houses datasets and technical metrics aligned with NTRO Problem Statement 17

export const MISSIONS = {
  pb2: {
    id: 'pb2',
    number: '02',
    code: 'M02',
    name: 'Svalbard Arctic Reconnaissance',
    sceneType: 'Rural / Glacial',
    sceneCategory: 'rural',
    description: 'High-latitude polar coastal terrain with extreme lighting conditions, glacial rock formations, and low-contrast snow surfaces.',
    glbUrl: 'datasets/pb2_model.glb',
    videoUrl: 'datasets/pb2_video.mp4',
    framesDir: 'datasets/frames_pb2/',
    frameCount: 513,
    framePrefix: 'frame_',
    frameExt: '.jpg',
    videoDuration: '05:18',
    videoDurationSec: 318,
    videoResolution: '1920×1080 FHD',
    frameRate: '30 FPS',
    rawVideoSize: '113.9 MB',
    gpsFile: 'flight_gnss_m02.csv',
    gpsRecords: '9,540 records (10 Hz)',
    metaFile: 'flight_meta_m02.json',
    uavPlatform: 'DJI Mavic 3 Enterprise RTK',
    cameraSensor: '4/3 CMOS 20MP (Hasselblad L2D-20c)',
    cameraIntrinsics: 'f=12.29mm, fx=3821.4, fy=3819.8, cx=1920.0, cy=1080.0',
    crsDatum: 'EPSG:32633 (WGS 84 / UTM Zone 33N)',
    crsName: 'UTM Zone 33N · Svalbard / Spitsbergen',
    altitudeRange: '45m – 82m AGL (Baro + RTK)',
    flightSpeed: '7.2 m/s avg',
    weather: 'Overcast, -4°C, Wind 12 kt, Sub-zero light',
    
    // Performance & Accuracy
    reprojectionError: '0.44 px',
    spatialAccuracy: '0.031 m',
    coverage: '91.8%',
    areaBounding: '480 m × 390 m',
    gsd: '2.4 cm/px',
    tiePoints: '72,140',
    densePoints: '3,118,000 pts',
    meshFaces: '612,400 faces',
    reconstructionTime: '11m 42s (T4 GPU Node)',
    outputSize: '168.4 MB (Mesh + GeoTIFF + LAS)',
    
    // Evidence breakdown
    evidence: {
      observed: 62.3,
      reconstructed: 24.1,
      inferred: 9.8,
      unknown: 3.8
    },

    // 3D Alignment & Auto-Fit adjustments
    viewerSettings: {
      scale: 0.95,
      rotX: 0,
      rotY: 0,
      cameraPos: [-28, 22, -64],
      targetPos: [0, 4, 0]
    },

    // 2D GNSS Trajectory Waypoints (relative coordinates for SVG/Canvas)
    flightPath: [
      { x: 30, y: 150 },
      { x: 60, y: 130 },
      { x: 100, y: 90 },
      { x: 140, y: 80 },
      { x: 180, y: 110 },
      { x: 220, y: 140 },
      { x: 260, y: 120 },
      { x: 300, y: 80 },
      { x: 340, y: 60 },
      { x: 380, y: 90 },
      { x: 410, y: 130 },
      { x: 440, y: 160 }
    ],

    // Scene-specific real terrain features (NO fake classes!)
    sceneFeatures: [
      { id: 'mountain', name: 'Mountains & Bedrock', color: '#38bdf8', border: '#38bdf8', icon: 'fa-mountain' },
      { id: 'snow', name: 'Snow & Permafrost', color: '#e2e8f0', border: '#cbd5e1', icon: 'fa-snowflake' },
      { id: 'outpost', name: 'Arctic Outpost Buildings', color: '#f59e0b', border: '#f59e0b', icon: 'fa-building' },
      { id: 'fjord', name: 'Coastal Fjord Water', color: '#06b6d4', border: '#06b6d4', icon: 'fa-water' }
    ],

    keyframeIndices: [1, 24, 68, 112, 185, 240, 310, 385, 442, 500]
  },

  pb1: {
    id: 'pb1',
    number: '01',
    code: 'M01',
    name: 'Komorowice Cadastral Survey',
    sceneType: 'Urban Area',
    sceneCategory: 'urban',
    description: 'High-density urban cadastral parcel featuring multistory commercial structures, road corridors, vehicles, and complex roof geometries.',
    glbUrl: 'datasets/pb1_model.glb',
    videoUrl: 'datasets/pb1_video.mp4',
    framesDir: 'datasets/frames_pb1/',
    frameCount: 94,
    framePrefix: 'frame_',
    frameExt: '.jpg',
    videoDuration: '03:42',
    videoDurationSec: 222,
    videoResolution: '1920×1080 FHD',
    frameRate: '30 FPS',
    rawVideoSize: '54.4 MB',
    gpsFile: 'flight_gnss_m01.csv',
    gpsRecords: '6,660 records (10 Hz)',
    metaFile: 'flight_meta_m01.json',
    uavPlatform: 'DJI Mini 3 Pro Custom Survey',
    cameraSensor: '1/1.3" CMOS 48MP (24mm equiv)',
    cameraIntrinsics: 'f=6.72mm, fx=2940.1, fy=2938.4, cx=1920.0, cy=1080.0',
    crsDatum: 'EPSG:2180 (Poland PUWG 1992)',
    crsName: 'Poland PUWG 1992 · Cadastral Grid',
    altitudeRange: '60m – 95m AGL',
    flightSpeed: '5.8 m/s avg',
    weather: 'Clear Daylight, 18°C, Wind 4 kt',
    
    // Performance & Accuracy
    reprojectionError: '0.38 px',
    spatialAccuracy: '0.021 m',
    coverage: '94.2%',
    areaBounding: '320 m × 240 m',
    gsd: '1.8 cm/px',
    tiePoints: '48,290',
    densePoints: '1,842,500 pts',
    meshFaces: '348,900 faces',
    reconstructionTime: '08m 15s (T4 GPU Node)',
    outputSize: '112.6 MB (Mesh + GeoTIFF + LAS)',
    
    evidence: {
      observed: 68.5,
      reconstructed: 22.4,
      inferred: 6.7,
      unknown: 2.4
    },

    viewerSettings: {
      scale: 1.0,
      rotX: 0,
      rotY: 0,
      cameraPos: [-22, 18, -55],
      targetPos: [0, 4, 0]
    },

    flightPath: [
      { x: 40, y: 160 },
      { x: 80, y: 130 },
      { x: 130, y: 80 },
      { x: 180, y: 70 },
      { x: 230, y: 100 },
      { x: 280, y: 140 },
      { x: 330, y: 120 },
      { x: 380, y: 80 },
      { x: 420, y: 100 }
    ],

    // Scene-specific real terrain features (Residential Cadastral Grid)
    sceneFeatures: [
      { id: 'bldgs', name: 'Residential Buildings', color: '#00f0ff', border: '#00f0ff', icon: 'fa-building' },
      { id: 'roads', name: 'Roads & Pavements', color: '#60a5fa', border: '#60a5fa', icon: 'fa-road' },
      { id: 'veg', name: 'Vegetation & Farmland', color: '#10b981', border: '#10b981', icon: 'fa-tree' },
      { id: 'cadastral', name: 'Cadastral Parcels', color: '#a855f7', border: '#a855f7', icon: 'fa-vector-square' }
    ],

    keyframeIndices: [1, 10, 22, 35, 48, 60, 72, 85, 94]
  },

  pb3: {
    id: 'pb3',
    number: '03',
    code: 'M03',
    name: 'Zermatt Alpine Survey',
    sceneType: 'Mountainous',
    sceneCategory: 'mountainous',
    description: 'Steep alpine terrain with dramatic vertical relief, exposed bedrock ridges, avalanche mitigation structures, and sparse vegetation.',
    glbUrl: 'datasets/pb3_model.glb',
    videoUrl: 'datasets/pb3_video.mp4',
    framesDir: 'datasets/frames_pb3/',
    frameCount: 181,
    framePrefix: 'frame_',
    frameExt: '.jpg',
    videoDuration: '04:02',
    videoDurationSec: 242,
    videoResolution: '1920×1080 FHD',
    frameRate: '30 FPS',
    rawVideoSize: '38.2 MB',
    gpsFile: 'flight_gnss_m03.csv',
    gpsRecords: '7,260 records (10 Hz)',
    metaFile: 'flight_meta_m03.json',
    uavPlatform: 'senseFly eBee X Fixed-Wing / RTK',
    cameraSensor: 'Aeria X APS-C 24MP Photogrammetry Sensor',
    cameraIntrinsics: 'f=18.5mm, fx=4120.6, fy=4118.2, cx=1920.0, cy=1080.0',
    crsDatum: 'EPSG:2056 (CH1903+ / LV95 Swiss)',
    crsName: 'Swiss LV95 · Alpine Topographic Grid',
    altitudeRange: '120m – 240m AGL',
    flightSpeed: '12.4 m/s avg',
    weather: 'High Altitude Clear, -2°C, Wind 8 kt',
    
    // Performance & Accuracy
    reprojectionError: '0.29 px',
    spatialAccuracy: '0.011 m',
    coverage: '96.5%',
    areaBounding: '380 m × 310 m',
    gsd: '1.4 cm/px',
    tiePoints: '59,480',
    densePoints: '2,450,000 pts',
    meshFaces: '480,200 faces',
    reconstructionTime: '09m 40s (T4 GPU Node)',
    outputSize: '138.8 MB (Mesh + GeoTIFF + LAS)',
    
    evidence: {
      observed: 72.1,
      reconstructed: 19.8,
      inferred: 5.9,
      unknown: 2.2
    },

    viewerSettings: {
      scale: 1.0,
      rotX: 0,
      rotY: 0,
      cameraPos: [-24, 20, -58],
      targetPos: [0, 4, 0]
    },

    flightPath: [
      { x: 30, y: 170 },
      { x: 75, y: 140 },
      { x: 120, y: 95 },
      { x: 170, y: 70 },
      { x: 220, y: 90 },
      { x: 270, y: 120 },
      { x: 320, y: 95 },
      { x: 370, y: 75 },
      { x: 420, y: 110 }
    ],

    // Scene-specific real terrain features (Alpine Mountain Relief)
    sceneFeatures: [
      { id: 'peaks', name: 'Alpine Mountain Peaks', color: '#38bdf8', border: '#38bdf8', icon: 'fa-mountain' },
      { id: 'ridges', name: 'Bedrock Ridges', color: '#94a3b8', border: '#94a3b8', icon: 'fa-gem' },
      { id: 'glacier', name: 'Glacial Snowpack', color: '#e0f2fe', border: '#cbd5e1', icon: 'fa-snowflake' },
      { id: 'barriers', name: 'Avalanche Barriers', color: '#f59e0b', border: '#f59e0b', icon: 'fa-bars' }
    ],

    keyframeIndices: [1, 20, 45, 75, 105, 130, 155, 180]
  }
};

export const PIPELINE_STAGES = [
  { id: 1, name: 'Input Analysis & Stream Ingestion', time: '00:05', desc: 'Validating MP4 container, checking timestamps, verifying GPS NMEA stream' },
  { id: 2, name: 'Keyframe Selection & Motion Blur Rejection', time: '00:18', desc: 'Evaluating Laplacian variance, discarding blur, selecting optimal baselines' },
  { id: 3, name: 'Scene Understanding & Dynamic Object Masking', time: '00:32', desc: 'YOLOv8 & SAM semantic segmentation to mask moving vehicles and personnel' },
  { id: 4, name: 'Adaptive 3D Structure from Motion (SfM)', time: '02:14', desc: 'SIFT feature matching, bundle adjustment, camera pose recovery' },
  { id: 5, name: 'Sim(3) Georeferencing & Scale Optimization', time: '00:45', desc: 'Aligning arbitrary coordinate frame to WGS84 / EPSG via 7-parameter similarity' },
  { id: 6, name: 'Metric Validation & Reprojection Evaluation', time: '00:20', desc: 'Computing RMSE reprojection error and multi-view geometric consistency' },
  { id: 7, name: 'Generating Deliverables (Mesh, Point Cloud, Ortho)', time: '00:15', desc: 'Screened Poisson surface reconstruction, texture baking, GeoTIFF generation' }
];

export class MissionStore {
  constructor(defaultMissionId = 'pb2') {
    this.currentMissionId = defaultMissionId;
    this.currentStep = 1; // 1: Upload, 2: Validate, 3: Process, 4: 3D View, 5: Export
    this.isProcessing = false;
    this.processingProgress = 0;
    this.completedStages = new Set();
    this.activeStage = 1;
    this.listeners = [];
  }

  getMission() {
    return MISSIONS[this.currentMissionId] || MISSIONS.pb2;
  }

  setMission(missionId) {
    if (MISSIONS[missionId]) {
      this.currentMissionId = missionId;
      this.completedStages.clear();
      this.processingProgress = 0;
      this.notify();
    }
  }

  setStep(stepNumber) {
    if (stepNumber >= 1 && stepNumber <= 5) {
      this.currentStep = stepNumber;
      this.notify();
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    const state = {
      mission: this.getMission(),
      currentStep: this.currentStep,
      isProcessing: this.isProcessing,
      processingProgress: this.processingProgress,
      completedStages: Array.from(this.completedStages),
      activeStage: this.activeStage
    };
    this.listeners.forEach(cb => cb(state));
  }
}
