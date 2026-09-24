import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

export class AeroSculptViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.modelContainer = null;
    this.originalMaterials = new Map();
    this.pointsObject = null;
    this.grid = null;
    this.viewMode = 'textured'; // 'textured', 'wireframe', 'points', 'normal'
    this.cameraAnimationId = null;
    this.isLoaded = false;

    // Measurement tool state
    this.measureMode = false;
    this.measurePoints = [];
    this.measureMarkers = [];
    this.measureLine = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 520;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);

    // 2. Camera: Positioned at front facade perspective
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 800);
    this.camera.position.set(-16, 14, -52);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls with strict distance bounds
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(2, 6.2, 0);
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.08;

    // 5. Lighting: 360-degree illumination
    this.setupLighting();

    // 6. Metric Ground Grid (EPSG:32630 UTM metric scale)
    this.grid = new THREE.GridHelper(250, 50, 0x2563eb, 0x1e293b);
    this.grid.position.y = 0;
    this.grid.material.opacity = 0.4;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);

    // 7. Load Reconstructed GLB Model
    const baseUrl = import.meta.env.BASE_URL || './';
    const modelPath = baseUrl.endsWith('/')
      ? `${baseUrl}Task-of-2026-09-10T143406911Z-textured_model.glb`
      : `${baseUrl}/Task-of-2026-09-10T143406911Z-textured_model.glb`;
    this.loadModel(modelPath);

    // 8. Event Listeners & Resize Observer
    window.addEventListener('resize', () => this.onWindowResize());
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.onWindowResize());
      ro.observe(this.container);
    }
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 9. Animation Loop
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    this.scene.add(ambientLight);

    const mainSun = new THREE.DirectionalLight(0xffffff, 2.0);
    mainSun.position.set(100, 200, 100);
    this.scene.add(mainSun);

    const fillSky = new THREE.DirectionalLight(0xa0c4ff, 1.2);
    fillSky.position.set(-100, 150, -100);
    this.scene.add(fillSky);

    const underLight = new THREE.DirectionalLight(0xffffff, 0.6);
    underLight.position.set(0, -100, 0);
    this.scene.add(underLight);
  }

  loadModel(url, rotationY = 0, scaleFactor = 1, rotX = -Math.PI / 2) {
    this.currentLoadId = (this.currentLoadId || 0) + 1;
    const loadId = this.currentLoadId;

    // Immediately remove existing model and containers
    const toRemove = [];
    this.scene.children.forEach(child => {
      if (child.name === 'TerrainModelContainer' || child === this.modelContainer || child === this.model) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(obj => this.scene.remove(obj));
    this.modelContainer = null;
    this.model = null;
    this.originalMaterials.clear();

    const loaderOverlay = document.getElementById('model-loader');
    if (loaderOverlay) {
      loaderOverlay.style.display = 'flex';
      loaderOverlay.style.opacity = '1';
    }

    const onModelReady = (rootObject) => {
      // Discard stale asynchronous loads
      if (loadId !== this.currentLoadId) return;

      // Ensure any older containers are thoroughly purged
      const stale = [];
      this.scene.children.forEach(child => {
        if (child.name === 'TerrainModelContainer') stale.push(child);
      });
      stale.forEach(obj => this.scene.remove(obj));

      this.model = rootObject;

      // 1. Wrap in container to manage photogrammetry coordinate transform
      this.modelContainer = new THREE.Group();
      this.modelContainer.name = 'TerrainModelContainer';
      this.modelContainer.add(this.model);

      // 2. Enable DoubleSide and cache materials
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.frustumCulled = false;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.depthWrite = true;
            child.material.needsUpdate = true;
            this.originalMaterials.set(child, child.material);
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

      // 6. Recenter camera smoothly onto the terrain
      this.recenterCamera(true);
      this.isLoaded = true;

      // 7. Hide loading overlay
      if (loaderOverlay) {
        loaderOverlay.style.transition = 'opacity 0.4s ease';
        loaderOverlay.style.opacity = '0';
        setTimeout(() => {
          loaderOverlay.style.display = 'none';
        }, 400);
      }


      // 8. Snapshot to thumbnail canvas if present
      setTimeout(() => {
        this.captureThumbnail();
      }, 300);
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
          console.error('Error loading PLY in viewer3d:', err);
          if (loaderOverlay) {
            loaderOverlay.innerHTML = `<span style="color:#ef4444;font-family:var(--font-mono)">Model load error: ${err.message}</span>`;
          }
        }
      );
    } else {
      const tryLoad = (decoderPath) => {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(decoderPath);

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        loader.load(
          url,
          (gltf) => onModelReady(gltf.scene),
          (xhr) => {
            if (loaderOverlay && xhr.total) {
              const pct = Math.round((xhr.loaded / xhr.total) * 100);
              const sub = loaderOverlay.querySelector('.loader-sub');
              if (sub) {
                sub.textContent = `Streaming 3D Mesh Assets (${pct}%)...`;
              }
            }
          },
          (error) => {
            console.warn(`Draco load with path "${decoderPath}" failed, trying CDN fallback:`, error);
            if (decoderPath !== 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/') {
              tryLoad('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
            } else {
              console.error('Final GLTF load error:', error);
              if (loaderOverlay) {
                loaderOverlay.innerHTML = `<span style="color:#ef4444;font-family:var(--font-mono)">Model load error: ${error.message}</span>`;
              }
            }
          }
        );
      };

      const base = import.meta.env.BASE_URL || './';
      const localDraco = base.endsWith('/') ? `${base}draco/gltf/` : `${base}/draco/gltf/`;
      tryLoad(localDraco);
    }
  }

  captureThumbnail() {
    const thumbCanvas = document.getElementById('thumb-canvas');
    if (!thumbCanvas || !this.renderer) return;

    // Render snapshot
    this.renderer.render(this.scene, this.camera);
    const ctx = thumbCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(this.renderer.domElement, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }
  }

  flyTo({ position, target, duration = 650, onComplete = null }) {
    if (this.cameraAnimationId) {
      cancelAnimationFrame(this.cameraAnimationId);
      this.cameraAnimationId = null;
    }

    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endPos = position.clone();
    const endTarget = target.clone();
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.controls.target.lerpVectors(startTarget, endTarget, ease);
      this.controls.update();

      if (progress < 1) {
        this.cameraAnimationId = requestAnimationFrame(step);
      } else {
        this.camera.position.copy(endPos);
        this.controls.target.copy(endTarget);
        this.controls.update();
        this.cameraAnimationId = null;
        if (onComplete) onComplete();
      }
    };

    this.cameraAnimationId = requestAnimationFrame(step);
  }

  recenterCamera(immediate = false) {
    const target = new THREE.Vector3(2, 6.2, 0);
    const position = new THREE.Vector3(-16, 14, -52);

    if (immediate) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
    } else {
      this.flyTo({ position, target, duration: 600 });
    }
  }

  setCameraPreset(preset) {
    if (preset === 'top') {
      this.flyTo({
        position: new THREE.Vector3(2, 90, -0.5),
        target: new THREE.Vector3(2, 6.2, 0),
        duration: 700
      });
    } else if (preset === 'front' || preset === 'oblique') {
      this.flyTo({
        position: new THREE.Vector3(-16, 14, -52),
        target: new THREE.Vector3(2, 6.2, 0),
        duration: 650
      });
    } else if (preset === 'iso') {
      this.flyTo({
        position: new THREE.Vector3(-36, 28, -42),
        target: new THREE.Vector3(2, 6.2, 0),
        duration: 650
      });
    } else if (preset === 'reset') {
      this.recenterCamera(false);
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;
    if (!this.model) return;

    if (this.pointsObject) {
      this.scene.remove(this.pointsObject);
      this.pointsObject = null;
    }

    if (mode === 'points') {
      this.model.visible = false;
      this.createPointCloudMode();
    } else {
      this.model.visible = true;
      this.model.traverse((child) => {
        if (child.isMesh) {
          const originalMat = this.originalMaterials.get(child);
          if (mode === 'textured') {
            child.material = originalMat;
            child.material.wireframe = false;
          } else if (mode === 'wireframe') {
            child.material = originalMat;
            child.material.wireframe = true;
          } else if (mode === 'normal') {
            child.material = new THREE.MeshNormalMaterial({ wireframe: false, side: THREE.DoubleSide });
          }
        }
      });
    }
  }

  createPointCloudMode() {
    const pointsGeom = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    const targetObj = this.modelContainer || this.model;
    targetObj.updateMatrixWorld(true);

    this.model.traverse((child) => {
      if (child.isMesh && child.geometry && child.geometry.attributes.position) {
        const posAttr = child.geometry.attributes.position;
        const matrixWorld = child.matrixWorld;
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i += 2) {
          v.fromBufferAttribute(posAttr, i);
          v.applyMatrix4(matrixWorld);
          positions.push(v.x, v.y, v.z);

          // Elevation color gradient
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
      size: 1.5,
      vertexColors: true,
      sizeAttenuation: true
    });

    this.pointsObject = new THREE.Points(pointsGeom, pointsMat);
    this.scene.add(this.pointsObject);
  }

  toggleGrid() {
    if (this.grid) {
      this.grid.visible = !this.grid.visible;
      return this.grid.visible;
    }
    return false;
  }

  toggleAutoRotate() {
    if (this.controls) {
      this.controls.autoRotate = !this.controls.autoRotate;
      this.controls.autoRotateSpeed = 1.4;
      return this.controls.autoRotate;
    }
    return false;
  }

  onPointerDown(event) {
    // Optional click handler
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

// Export alias
export const SkyScapeViewer = AeroSculptViewer;
