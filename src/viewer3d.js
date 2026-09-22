import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class SkyScapeViewer {
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
    this.viewMode = 'textured'; // 'textured', 'wireframe', 'points', 'normal'
    this.cameraAnimationId = null;

    // Measurement state
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
    const height = this.container.clientHeight || 472;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);

    // 2. Camera: Positioned at front facade survey perspective (matching river-facing castle ramparts)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 800);
    this.camera.position.set(-16, 14, -52);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // Preserve exact photogrammetry drone texture colors
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls with strict distance bounds to NEVER lose the model
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(2, 6.2, 0); // Lock center on Dumbarton Castle front elevation
    this.controls.minDistance = 5;       // Close-up stone inspection
    this.controls.maxDistance = 140;     // Prevent model from shrinking into infinity
    this.controls.maxPolarAngle = Math.PI / 2 + 0.08; // Keep terrain right-side-up

    // 5. Lighting: 360-degree illumination
    this.setupLighting();

    // 6. Metric Ground Grid (EPSG:32630 UTM metric scale)
    const grid = new THREE.GridHelper(250, 50, 0x00d4b2, 0x1a2130);
    grid.position.y = 0;
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    this.scene.add(grid);

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

  loadModel(url) {
    const loadingElem = document.getElementById('viewer-loading-spinner');

    const tryLoad = (decoderPath) => {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(decoderPath);

      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      loader.load(
        url,
        (gltf) => {
          this.model = gltf.scene;

          // 1. Wrap in container to manage photogrammetry Z-up -> Three.js Y-up transform
          this.modelContainer = new THREE.Group();
          this.modelContainer.name = 'TerrainModelContainer';
          this.modelContainer.add(this.model);

          let totalVertices = 0;
          let totalTriangles = 0;

          // 2. Enable DoubleSide and cache materials
          this.model.traverse((child) => {
            if (child.isMesh) {
              child.frustumCulled = false; // Prevent premature culling
              if (child.material) {
                child.material.side = THREE.DoubleSide; // Render both sides of terrain
                child.material.depthWrite = true;
                child.material.needsUpdate = true;
                this.originalMaterials.set(child, child.material);
              }
              if (child.geometry) {
                child.geometry.computeBoundingBox();
                child.geometry.computeBoundingSphere();
                totalVertices += child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
                totalTriangles += child.geometry.index ? child.geometry.index.count / 3 : (child.geometry.attributes.position ? child.geometry.attributes.position.count / 3 : 0);
              }
            }
          });

          // 3. Center model locally inside container
          const rawBox = new THREE.Box3().setFromObject(this.model);
          const rawCenter = rawBox.getCenter(new THREE.Vector3());
          this.model.position.set(-rawCenter.x, -rawCenter.y, -rawCenter.z);

          // 4. Photogrammetry coordinate conversion: Rotate -90° on X to align Z-up (elevation) to Three.js Y-up
          this.modelContainer.rotation.x = -Math.PI / 2;

          this.scene.add(this.modelContainer);
          this.modelContainer.updateMatrixWorld(true);

          // 5. Offset container so terrain base sits flat at y = 0 ground grid
          const worldBox = new THREE.Box3().setFromObject(this.modelContainer);
          this.modelContainer.position.y = -worldBox.min.y;
          this.modelContainer.updateMatrixWorld(true);

          // 6. Recenter camera smoothly onto the terrain
          this.recenterCamera(true);

          // 7. Update UI stats
          const infoMesh = document.getElementById('viewer-stat-mesh');
          if (infoMesh) {
            infoMesh.innerHTML = `<strong>Vertices:</strong> ${totalVertices.toLocaleString()} | <strong>Faces:</strong> ${Math.round(totalTriangles).toLocaleString()}`;
          }

          // 8. Fade out loading spinner
          if (loadingElem) {
            loadingElem.style.transition = 'opacity 0.3s ease';
            loadingElem.style.opacity = '0';
            setTimeout(() => {
              loadingElem.classList.add('hidden');
            }, 300);
          }

          // 9. Show brief "Model Loaded & Centered" notification badge
          this.flashStatusBadge('✓ 3D Model Loaded & Recentered');
        },
        (xhr) => {
          if (loadingElem && xhr.total) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            loadingElem.innerHTML = `<div class="spinner"></div><div style="font-family:var(--font-mono);font-size:12px;color:var(--accent);">DECOMPRESSING 3D MESH (${pct}%)...</div>`;
          }
        },
        (error) => {
          console.warn(`Draco load with path "${decoderPath}" failed, trying CDN fallback:`, error);
          if (decoderPath !== 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/') {
            tryLoad('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
          } else {
            console.error('Final GLTF load error:', error);
            if (loadingElem) {
              loadingElem.innerHTML = `<span style="color:#ef4444;font-family:var(--font-mono)">Model load error: ${error.message || 'Check browser console'}</span>`;
            }
          }
        }
      );
    };

    const base = import.meta.env.BASE_URL || './';
    const localDraco = base.endsWith('/') ? `${base}draco/gltf/` : `${base}/draco/gltf/`;
    tryLoad(localDraco);
  }

  /**
   * Smoothly animates the camera and controls target to desired positions
   */
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
      // Ease-out cubic
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

  /**
   * Recenter Camera: Locks target on front Dumbarton Castle facade (2, 6.2, 0) from river viewpoint (-16, 14, -52)
   */
  recenterCamera(immediate = false) {
    const target = new THREE.Vector3(2, 6.2, 0);
    const position = new THREE.Vector3(-16, 14, -52);

    if (immediate) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
    } else {
      this.flyTo({ position, target, duration: 600 });
      this.flashStatusBadge('🎯 Recentered to Front Facade');
    }
  }

  /**
   * Camera Presets:
   * - oblique: Front survey perspective facing Dumbarton Castle ramparts & lawn
   * - top: 90° nadir ortho GIS view
   * - closeup: Close inspection of castle ramparts and historic fortress
   */
  setCameraPreset(preset) {
    if (preset === 'top') {
      // Nadir GIS Ortho View
      this.flyTo({
        position: new THREE.Vector3(2, 85, -0.5),
        target: new THREE.Vector3(2, 6.2, 0),
        duration: 700
      });
    } else if (preset === 'oblique') {
      // Front Facade View (matching shared reference)
      this.flyTo({
        position: new THREE.Vector3(-16, 14, -52),
        target: new THREE.Vector3(2, 6.2, 0),
        duration: 650
      });
    } else if (preset === 'closeup') {
      // Close inspection of castle rock & fortress
      this.flyTo({
        position: new THREE.Vector3(-7, 10, -26),
        target: new THREE.Vector3(2, 6.2, 0),
        duration: 650
      });
    }
  }

  /**
   * View modes: Textured PBR, Wireframe, Elevation Point Cloud, Surface Normals
   */
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
          color.setHSL(0.5 - Math.min(1, Math.max(0, elevation)) * 0.45, 0.9, 0.55);
          colors.push(color.r, color.g, color.b);
        }
      }
    });

    pointsGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pointsGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const pointsMat = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      sizeAttenuation: true
    });

    this.pointsObject = new THREE.Points(pointsGeom, pointsMat);
    this.scene.add(this.pointsObject);
  }

  toggleMeasureTool(active) {
    this.measureMode = active;
    if (!active) {
      this.clearMeasurements();
    }
  }

  clearMeasurements() {
    this.measurePoints = [];
    this.measureMarkers.forEach((m) => this.scene.remove(m));
    this.measureMarkers = [];
    if (this.measureLine) {
      this.scene.remove(this.measureLine);
      this.measureLine = null;
    }
    const badge = document.getElementById('viewer-measure-badge');
    if (badge) badge.classList.remove('show');
  }

  onPointerDown(event) {
    if (!this.measureMode) return;
    const targetObj = this.modelContainer || this.model;
    if (!targetObj) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(targetObj.children, true);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;
      this.addMeasurePoint(hitPoint);
    }
  }

  addMeasurePoint(point) {
    if (this.measurePoints.length >= 2) {
      this.clearMeasurements();
    }

    this.measurePoints.push(point);

    // Drop spherical marker
    const markerGeom = new THREE.SphereGeometry(1.2, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00d4b2 });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.copy(point);
    this.scene.add(marker);
    this.measureMarkers.push(marker);

    if (this.measurePoints.length === 2) {
      // Connecting line
      const lineGeom = new THREE.BufferGeometry().setFromPoints([this.measurePoints[0], this.measurePoints[1]]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00d4b2, linewidth: 2 });
      this.measureLine = new THREE.Line(lineGeom, lineMat);
      this.scene.add(this.measureLine);

      // Distance calculation in real metric meters
      const rawDistance = this.measurePoints[0].distanceTo(this.measurePoints[1]);
      const metricDistance = rawDistance.toFixed(2);

      const badge = document.getElementById('viewer-measure-badge');
      if (badge) {
        badge.innerHTML = `<strong>Survey Distance:</strong> ${metricDistance} m`;
        badge.classList.add('show');
      }
    }
  }

  flashStatusBadge(message) {
    let badge = document.getElementById('viewer-status-toast');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'viewer-status-toast';
      badge.style.position = 'absolute';
      badge.style.top = '14px';
      badge.style.left = '50%';
      badge.style.transform = 'translateX(-50%)';
      badge.style.backgroundColor = 'rgba(10, 14, 22, 0.88)';
      badge.style.border = '1px solid rgba(0, 212, 178, 0.4)';
      badge.style.borderRadius = '4px';
      badge.style.padding = '5px 12px';
      badge.style.fontSize = '11px';
      badge.style.fontFamily = 'var(--font-mono)';
      badge.style.color = '#00d4b2';
      badge.style.pointerEvents = 'none';
      badge.style.zIndex = '20';
      badge.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
      this.container.appendChild(badge);
    }

    badge.innerText = message;
    badge.style.opacity = '1';
    badge.style.transform = 'translateX(-50%) translateY(0)';

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translateX(-50%) translateY(-6px)';
    }, 2200);
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
