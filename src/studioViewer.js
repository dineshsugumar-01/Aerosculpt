import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

if (typeof window !== 'undefined') {
  window.THREE = THREE;
}

export class AeroSculptStudioViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.modelContainer = null;
    this.pointsObject = null;
    this.grid = null;
    this.roiBox = null;
    this.cameraPyramids = [];
    this.cameraPositions = [];
    this.sightlineBeam = null;
    this.gcpMarkers = [];
    this.activeKeyframeIndex = 23; // 0-indexed (frame 24)
    this.pointSize = 1.0;
    this.shadingMode = 'rgb'; // 'rgb', 'turbo', 'depth', 'cad'
    this.originalMaterials = new Map();
    this.cadMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.4,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide
    });

    // Layer visibility states
    this.layers = {
      frustums: true,
      landmarks: false,
      mesh: true,
      grid: true,
      roi: true,
      gcp: true
    };

    // Measurement & Reticle tools
    this.measureMode = false;
    this.measurePoints = [];
    this.measureMarkers = [];
    this.measureLine = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 650;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // WebODM slate-900 theme

    // 2. Camera (Perspective)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1200);
    this.camera.position.set(-22, 18, -60);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(2, 6.2, 0);
    this.controls.minDistance = 4;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.08;

    // 5. Lighting
    this.setupLighting();

    // 6. Metric Datum Grid (WebODM Blue & Slate)
    this.grid = new THREE.GridHelper(300, 60, 0x2563eb, 0x334155);
    this.grid.position.y = 0;
    this.grid.material.opacity = 0.45;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);

    // 7. 3D Region of Interest (ROI) Box
    this.createRoiBox();

    // 8. 50 Calibrated Camera Frustums along UAV Flight Path
    this.createCameraFrustums();

    // 9. Optical Sightline Dynamic Laser Beam
    this.createSightlineBeam();

    // 10. Ground Control Point 3D Target Pins
    this.createGcpMarkers();

    // 11. Load Reconstructed GLB Mesh
    const baseUrl = import.meta.env.BASE_URL || './';
    const modelPath = baseUrl.endsWith('/')
      ? `${baseUrl}Task-of-2026-09-10T143406911Z-textured_model.glb`
      : `${baseUrl}/Task-of-2026-09-10T143406911Z-textured_model.glb`;
    this.loadModel(modelPath);

    // 12. Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.onWindowResize());
      ro.observe(this.container);
    }

    this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 13. Render Loop
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    this.scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(120, 220, 100);
    this.scene.add(sun);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    fillLight.position.set(-100, 150, -100);
    this.scene.add(fillLight);
  }

  createRoiBox() {
    // Metric bounding box around Dumbarton Castle ramparts (approx 45m x 22m x 55m)
    const geom = new THREE.BoxGeometry(46, 22, 54);
    const edges = new THREE.EdgesGeometry(geom);
    this.roiBox = new THREE.LineSegments(
      edges,
      new THREE.LineDashedMaterial({
        color: 0x2563eb,
        dashSize: 1.5,
        gapSize: 0.8,
        transparent: true,
        opacity: 0.85
      })
    );
    this.roiBox.computeLineDistances();
    this.roiBox.position.set(2, 10.5, 0);
    this.scene.add(this.roiBox);
  }

  createCameraFrustums(datasetId = '01') {
    // Remove previous pyramids if any
    if (this.cameraPyramids && this.cameraPyramids.length) {
      this.cameraPyramids.forEach(p => {
        if (p.group) this.scene.remove(p.group);
      });
    }
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine = null;
    }

    this.currentTrajectoryDataset = datasetId;
    const isOrbit = datasetId === '03';
    const totalWaypoints = isOrbit ? 33 : 50;
    this.cameraPyramids = [];
    this.cameraPositions = [];

    // Flight trajectory line
    const trajPoints = [];

    for (let i = 0; i < totalWaypoints; i++) {
      let pos;
      if (isOrbit) {
        // True 360-degree orbital survey around centroid (2, 6.2, 0)
        const angle = (i / totalWaypoints) * Math.PI * 2;
        const radius = 25.0;
        const px = 2 + Math.cos(angle) * radius;
        const pz = 0 + Math.sin(angle) * radius;
        const py = 12.0 + Math.sin(i * 0.4) * 1.5;
        pos = new THREE.Vector3(px, py, pz);
      } else {
        const t = i / totalWaypoints;
        const angle = t * Math.PI * 4;
        const radiusX = 26 + Math.sin(t * Math.PI * 2) * 8;
        const radiusZ = 22 + Math.cos(t * Math.PI * 2) * 6;
        const px = Math.cos(angle) * radiusX;
        const pz = Math.sin(angle) * radiusZ;
        const py = 13 + Math.sin(i * 0.45) * 3;
        pos = new THREE.Vector3(px, py, pz);
      }

      this.cameraPositions.push(pos);
      trajPoints.push(pos);

      // Camera Frustum Pyramid Geometry
      const frustumGroup = new THREE.Group();
      frustumGroup.position.copy(pos);

      // Look at model centroid
      frustumGroup.lookAt(2, 6.2, 0);

      // Pyramid wireframe
      const coneGeom = new THREE.ConeGeometry(1.0, 1.8, 4, 1, false);
      coneGeom.rotateY(Math.PI / 4);
      coneGeom.rotateX(Math.PI / 2);
      const edges = new THREE.EdgesGeometry(coneGeom);

      const isCurrent = i === this.activeKeyframeIndex;
      const mat = new THREE.LineBasicMaterial({
        color: isCurrent ? 0x38bdf8 : 0x3b82f6,
        linewidth: isCurrent ? 2 : 1,
        transparent: true,
        opacity: isCurrent ? 1.0 : 0.6
      });

      const pyramidMesh = new THREE.LineSegments(edges, mat);
      frustumGroup.add(pyramidMesh);

      // Waypoint index data
      frustumGroup.userData = { waypointIndex: i };
      this.scene.add(frustumGroup);
      this.cameraPyramids.push({ group: frustumGroup, lines: pyramidMesh });
    }

    // Trajectory spline
    const spline = new THREE.CatmullRomCurve3(trajPoints, true);
    const splineGeom = new THREE.BufferGeometry().setFromPoints(spline.getPoints(200));
    const splineMat = new THREE.LineBasicMaterial({
      color: isOrbit ? 0x38bdf8 : 0xf59e0b,
      transparent: true,
      opacity: 0.75,
      linewidth: 1.5
    });
    this.trajectoryLine = new THREE.Line(splineGeom, splineMat);
    this.scene.add(this.trajectoryLine);

    if (this.sightlineBeam) {
      this.updateSightlineBeam();
    }
  }

  setDatasetTrajectory(datasetId) {
    this.createCameraFrustums(datasetId);
  }


  createSightlineBeam() {
    const activePos = this.cameraPositions[this.activeKeyframeIndex] || new THREE.Vector3(0, 14, 25);
    const targetPos = new THREE.Vector3(2, 6.2, 0);

    const geom = new THREE.BufferGeometry().setFromPoints([activePos, targetPos]);
    const mat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      linewidth: 2
    });
    this.sightlineBeam = new THREE.Line(geom, mat);
    this.scene.add(this.sightlineBeam);
  }

  updateSightlineBeam() {
    if (!this.sightlineBeam) return;
    const activePos = this.cameraPositions[this.activeKeyframeIndex];
    if (!activePos) return;

    const targetPos = new THREE.Vector3(2, 6.2, 0);
    this.sightlineBeam.geometry.setFromPoints([activePos, targetPos]);
  }

  createGcpMarkers() {
    const gcpCoords = [
      { id: 'GCP-01', name: 'South Rampart', pos: new THREE.Vector3(-12.4, 2.5, 14.2) },
      { id: 'GCP-02', name: 'Castle Gate', pos: new THREE.Vector3(10.8, 5.2, -8.4) },
      { id: 'GCP-03', name: 'River Wall', pos: new THREE.Vector3(-18.2, 0.4, -12.1) },
      { id: 'GCP-04', name: 'North Ridge', pos: new THREE.Vector3(16.5, 10.1, 12.8) }
    ];

    gcpCoords.forEach(gcp => {
      const group = new THREE.Group();
      group.position.copy(gcp.pos);

      // Red cross marker
      const markerGeom = new THREE.SphereGeometry(0.45, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const sphere = new THREE.Mesh(markerGeom, markerMat);
      group.add(sphere);

      // Pin stem to ground
      const stemGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -gcp.pos.y, 0)
      ]);
      const stemMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 });
      const stem = new THREE.Line(stemGeom, stemMat);
      group.add(stem);

      this.scene.add(group);
      this.gcpMarkers.push(group);
    });
  }

  loadModel(url, rotationY = 0, scaleFactor = 1, rotX = -Math.PI / 2) {
    this.currentLoadId = (this.currentLoadId || 0) + 1;
    const loadId = this.currentLoadId;

    // Immediately remove existing model and containers
    const toRemove = [];
    this.scene.children.forEach(child => {
      if (child.name === 'StudioTerrainContainer' || child === this.modelContainer || child === this.model) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(obj => this.scene.remove(obj));
    this.modelContainer = null;
    this.model = null;
    this.originalMaterials.clear();

    const loaderElem = document.getElementById('studio-viewport-loader');
    if (loaderElem) loaderElem.style.display = 'flex';

    const onModelReady = (rootObject) => {
      // Discard stale asynchronous loads
      if (loadId !== this.currentLoadId) return;

      // Ensure any older containers are thoroughly purged
      const stale = [];
      this.scene.children.forEach(child => {
        if (child.name === 'StudioTerrainContainer') stale.push(child);
      });
      stale.forEach(obj => this.scene.remove(obj));

      this.model = rootObject;

      // 1. Wrap in container to manage photogrammetry coordinate transform
      this.modelContainer = new THREE.Group();
      this.modelContainer.name = 'StudioTerrainContainer';
      this.modelContainer.add(this.model);

      // 2. Enable DoubleSide, shadows, and cache materials
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.depthWrite = true;
            child.material.roughness = child.material.roughness !== undefined ? child.material.roughness : 0.55;
            child.material.metalness = child.material.metalness !== undefined ? child.material.metalness : 0.05;
            child.material.needsUpdate = true;
            this.originalMaterials.set(child, child.material.clone());
          }
          if (child.geometry) {
            child.geometry.computeBoundingBox();
            child.geometry.computeBoundingSphere();
          }
        }
      });

      // 3. Center model locally inside container and apply elevation tilt (rotX)
      this.model.position.set(0, 0, 0);
      this.model.rotation.set(rotX, 0, 0);
      this.model.updateMatrixWorld(true);

      const rawBox = new THREE.Box3().setFromObject(this.model);
      const rawCenter = rawBox.getCenter(new THREE.Vector3());
      this.model.position.set(-rawCenter.x, -rawCenter.y, -rawCenter.z);
      if (scaleFactor && scaleFactor !== 1) {
        this.model.scale.setScalar(scaleFactor);
      }
      this.model.updateMatrixWorld(true);

      // 4. World orientation (azimuth/heading rotation around vertical Y)
      this.modelContainer.position.set(0, 0, 0);
      this.modelContainer.rotation.set(0, rotationY, 0);
      this.scene.add(this.modelContainer);
      this.modelContainer.updateMatrixWorld(true);

      // 5. Offset container so terrain base sits flat at ground grid (Y=0) and centered at target (2, 0)
      const worldBox = new THREE.Box3().setFromObject(this.modelContainer);
      const worldCenter = worldBox.getCenter(new THREE.Vector3());
      this.modelContainer.position.set(2 - worldCenter.x, -worldBox.min.y, 0 - worldCenter.z);
      this.modelContainer.updateMatrixWorld(true);

      // Hide loading indicator if present
      if (loaderElem) loaderElem.style.display = 'none';

      // Set initial camera to front facade
      this.setCameraPreset('front');
    };

    if (url.toLowerCase().endsWith('.ply')) {
      const plyLoader = new PLYLoader();
      plyLoader.load(
        url,
        (geometry) => {
          geometry.computeVertexNormals();
          const hasColors = geometry.hasAttribute('color');
          const material = new THREE.MeshStandardMaterial({
            vertexColors: hasColors,
            color: hasColors ? 0xffffff : 0xdfd7ca,
            roughness: 0.65,
            metalness: 0.08,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, material);
          const group = new THREE.Group();
          group.add(mesh);
          onModelReady(group);
        },
        undefined,
        (err) => {
          console.error('Error loading Studio PLY:', err);
          if (loaderElem) loaderElem.style.display = 'none';
        }
      );
    } else {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      loader.setDRACOLoader(dracoLoader);

      loader.load(
        url,
        (gltf) => onModelReady(gltf.scene),
        undefined,
        (err) => {
          console.error('Error loading Studio GLB:', err);
          if (loaderElem) loaderElem.style.display = 'none';
        }
      );
    }
  }


  // Set Keyframe 1..50
  setActiveKeyframe(index) {
    if (index < 0 || index >= this.cameraPositions.length) return;
    this.activeKeyframeIndex = index;

    // Update pyramid colors
    this.cameraPyramids.forEach((p, idx) => {
      const isCurrent = idx === index;
      p.lines.material.color.setHex(isCurrent ? 0x60a5fa : 0x2563eb);
      p.lines.material.opacity = isCurrent ? 1.0 : 0.6;
      p.group.scale.setScalar(isCurrent ? 1.4 : 1.0);
    });

    this.updateSightlineBeam();
  }

  // Shading modes: 'rgb', 'turbo', 'depth', 'cad'
  setShadingMode(mode) {
    this.shadingMode = mode;
    if (!this.model) return;

    if (mode === 'cad') {
      this.model.traverse(c => {
        if (c.isMesh) c.material = this.cadMaterial;
      });
    } else if (mode === 'turbo') {
      this.applyElevationTurboShading();
    } else if (mode === 'depth') {
      this.applyDepthShading();
    } else {
      // Default RGB photorealistic PBR
      this.model.traverse(c => {
        if (c.isMesh && this.originalMaterials.has(c)) {
          c.material = this.originalMaterials.get(c);
          c.material.needsUpdate = true;
        }
      });
    }
  }

  applyElevationTurboShading() {
    this.model.traverse(c => {
      if (c.isMesh && c.geometry && c.geometry.attributes.position) {
        const pos = c.geometry.attributes.position;
        const colors = [];
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const t = Math.min(1, Math.max(0, (y + 2) / 16));
          // Turbo elevation gradient
          const col = new THREE.Color();
          col.setHSL(0.65 - t * 0.65, 0.95, 0.52);
          colors.push(col.r, col.g, col.b);
        }
        c.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        c.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      }
    });
  }

  applyDepthShading() {
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      side: THREE.DoubleSide
    });
    this.model.traverse(c => {
      if (c.isMesh) c.material = depthMat;
    });
  }

  // Point size stepper
  setPointSize(size) {
    this.pointSize = Math.max(0.4, Math.min(5.0, size));
    if (this.pointsObject && this.pointsObject.material) {
      this.pointsObject.material.size = this.pointSize;
    }
  }

  // Camera Orientation Presets
  setCameraPreset(preset) {
    if (!this.controls || !this.camera) return;

    const target = new THREE.Vector3(2, 6.2, 0);
    this.controls.target.copy(target);

    switch (preset) {
      case 'top': // Nadir 90°
        this.camera.position.set(2, 85, 0.5);
        break;
      case 'front': // Front elevation
        this.camera.position.set(-16, 14, -52);
        break;
      case 'side': // Profile elevation
        this.camera.position.set(-52, 12, 4);
        break;
      case 'iso': // 45° isometric
        this.camera.position.set(-42, 38, -42);
        break;
      case 'reset': // Recenter extents
      default:
        this.camera.position.set(-22, 18, -60);
        break;
    }

    this.controls.update();
  }

  // D-Pad navigation
  panOrbit(dx, dy) {
    if (!this.controls || !this.camera) return;

    if (dx === 0 && dy === 0) {
      this.setCameraPreset('reset');
      return;
    }

    // Horizontal orbit
    if (dx !== 0) {
      const angle = (dx * Math.PI) / 12;
      const x = this.camera.position.x - this.controls.target.x;
      const z = this.camera.position.z - this.controls.target.z;
      this.camera.position.x = this.controls.target.x + x * Math.cos(angle) - z * Math.sin(angle);
      this.camera.position.z = this.controls.target.z + x * Math.sin(angle) + z * Math.cos(angle);
    }

    // Vertical orbit / elevation
    if (dy !== 0) {
      this.camera.position.y = Math.max(4, Math.min(100, this.camera.position.y + dy * 4));
    }

    this.controls.update();
  }

  // Zoom controls
  zoom(factor) {
    if (!this.camera || !this.controls) return;
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    dir.multiplyScalar(factor);
    this.camera.position.copy(this.controls.target).add(dir);
    this.controls.update();
  }

  // Layer Toggles
  toggleFrustums() {
    this.layers.frustums = !this.layers.frustums;
    this.cameraPyramids.forEach(p => p.group.visible = this.layers.frustums);
    if (this.trajectoryLine) this.trajectoryLine.visible = this.layers.frustums;
    if (this.sightlineBeam) this.sightlineBeam.visible = this.layers.frustums;
    return this.layers.frustums;
  }

  toggleLandmarks() {
    this.layers.landmarks = !this.layers.landmarks;
    if (this.layers.landmarks) {
      this.createPointCloudMode();
    } else if (this.pointsObject) {
      this.pointsObject.visible = false;
    }
    return this.layers.landmarks;
  }

  toggleMesh() {
    this.layers.mesh = !this.layers.mesh;
    if (this.model) this.model.visible = this.layers.mesh;
    return this.layers.mesh;
  }

  toggleGrid() {
    this.layers.grid = !this.layers.grid;
    if (this.grid) this.grid.visible = this.layers.grid;
    return this.layers.grid;
  }

  toggleRoi() {
    this.layers.roi = !this.layers.roi;
    if (this.roiBox) this.roiBox.visible = this.layers.roi;
    return this.layers.roi;
  }

  toggleGcp() {
    this.layers.gcp = !this.layers.gcp;
    this.gcpMarkers.forEach(m => m.visible = this.layers.gcp);
    return this.layers.gcp;
  }

  toggleTurntable() {
    if (this.controls) {
      this.controls.autoRotate = !this.controls.autoRotate;
      this.controls.autoRotateSpeed = 1.4;
      return this.controls.autoRotate;
    }
    return false;
  }

  createPointCloudMode() {
    if (this.pointsObject) {
      this.pointsObject.visible = true;
      return;
    }

    if (!this.model) return;

    const pointsGeom = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    this.model.traverse((child) => {
      if (child.isMesh && child.geometry && child.geometry.attributes.position) {
        const posAttr = child.geometry.attributes.position;
        const matrixWorld = child.matrixWorld;
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i += 2) {
          v.fromBufferAttribute(posAttr, i);
          v.applyMatrix4(matrixWorld);
          positions.push(v.x, v.y, v.z);

          const elevation = (v.y + 2) / 16;
          const color = new THREE.Color();
          color.setHSL(0.55 - Math.min(1, Math.max(0, elevation)) * 0.45, 0.9, 0.55);
          colors.push(color.r, color.g, color.b);
        }
      }
    });

    pointsGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pointsGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const pointsMat = new THREE.PointsMaterial({
      size: this.pointSize,
      vertexColors: true,
      sizeAttenuation: true
    });

    this.pointsObject = new THREE.Points(pointsGeom, pointsMat);
    this.scene.add(this.pointsObject);
  }

  // Pointer interactions for real-time Coordinate Reticle HUD
  onPointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.model ? [this.model] : [], true);

    const hudCoords = document.getElementById('studio-hud-coords');
    if (intersects.length > 0) {
      const p = intersects[0].point;
      if (hudCoords) {
        hudCoords.innerHTML = `X: <strong>${p.x.toFixed(2)}m</strong> · Y: <strong>${p.y.toFixed(2)}m</strong> · Z: <strong>${p.z.toFixed(2)}m</strong>`;
      }
    }
  }

  // Measurement Ruler tool
  toggleRulerMode() {
    this.measureMode = !this.measureMode;
    this.clearMeasurement();
    return this.measureMode;
  }

  clearMeasurement() {
    this.measurePoints = [];
    this.measureMarkers.forEach(m => this.scene.remove(m));
    this.measureMarkers = [];
    if (this.measureLine) {
      this.scene.remove(this.measureLine);
      this.measureLine = null;
    }
    const readout = document.getElementById('studio-ruler-readout');
    if (readout) readout.style.display = 'none';
  }

  onPointerDown(event) {
    if (!this.measureMode) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.model ? [this.model] : [], true);

    if (intersects.length > 0) {
      const p = intersects[0].point.clone();
      this.measurePoints.push(p);

      // Marker sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      sphere.position.copy(p);
      this.scene.add(sphere);
      this.measureMarkers.push(sphere);

      if (this.measurePoints.length === 2) {
        const dist = this.measurePoints[0].distanceTo(this.measurePoints[1]);
        const lineGeom = new THREE.BufferGeometry().setFromPoints(this.measurePoints);
        this.measureLine = new THREE.Line(
          lineGeom,
          new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
        );
        this.scene.add(this.measureLine);

        const readout = document.getElementById('studio-ruler-readout');
        const readoutVal = document.getElementById('studio-ruler-val');
        if (readout && readoutVal) {
          readoutVal.textContent = `${dist.toFixed(3)} m (${(dist * 3.28084).toFixed(2)} ft)`;
          readout.style.display = 'flex';
        }
      } else if (this.measurePoints.length > 2) {
        this.clearMeasurement();
        this.measurePoints.push(p);
        this.measureMarkers.push(sphere);
        this.scene.add(sphere);
      }
    }
  }

  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
