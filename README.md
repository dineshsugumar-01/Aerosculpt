# 🛰️ AeroSculpt — Drone Photogrammetry & 3D Reconstruction Platform

<p align="center">
  <a href="https://dineshsugumar-01.github.io/Aerosculpt/">
    <img src="https://img.shields.io/badge/Live%20Demo-Online-00f0ff?style=for-the-badge&logo=githubpages&logoColor=black" alt="Live Demo" />
  </a>
  <a href="https://github.com/dineshsugumar-01/Aerosculpt/actions/workflows/deploy.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/dineshsugumar-01/Aerosculpt/deploy.yml?branch=main&style=for-the-badge&label=Deployment" alt="Build Status" />
  </a>
  <img src="https://img.shields.io/badge/Three.js-r183-black?style=for-the-badge&logo=threedotjs" alt="Three.js" />
  <img src="https://img.shields.io/badge/WebGL-Hardware%20Accelerated-ff3e00?style=for-the-badge&logo=webgl" alt="WebGL" />
  <img src="https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
</p>

---

**AeroSculpt** is a high-performance, browser-native 3D photogrammetry workstation and UAV survey intelligence platform. It processes continuous aerial drone feeds, telemetry, and spatial imagery into high-fidelity textured 3D models (`GLB`/`DRACO`), georeferenced orthomosaics, and real-time visual odometry (SLAM) tracking.

> 🌐 **Live Web Application**: [https://dineshsugumar-01.github.io/Aerosculpt/](https://dineshsugumar-01.github.io/Aerosculpt/)

---

## 📸 Platform Overview

| Module | Interface | Description |
| :--- | :--- | :--- |
| **Mission Dashboard** | `[Dashboard]` | Real-time flight mission parameters, processing node telemetry, quality metrics, and task analytics. |
| **3D GLB Model Viewer** | `[3D Model]` | WebGL/Three.js interactive inspection workstation with PBR lighting, orbit controls, wireframe modes, and Draco decompression. |
| **2D GIS Map** | `[2D Map]` | Geospatial flight path visualization, waypoint telemetry, camera capture positions, and boundary geofencing. |
| **Video Telemetry** | `[Video Feeds]` | Multi-stream UAV playback with real-time frame extraction, sharpness scoring, and ray casting. |
| **Live SLAM Feed** | `[Demo]` | Full-width visual odometry hero tracking with live point tracking and RTK coordinate geodesy (`EPSG:32630`). |

---

## ⚡ How It Works (Simple 4-Step Pipeline)

Similar to Google Earth 3D mapping, AeroSculpt converts raw drone video into realistic, true-scale 3D models:

1. **Capture & Filter**: Drone captures overlapping aerial video. Blurry, shaky, or glare frames are automatically filtered out, keeping only the clearest imagery.
2. **Track & Match**: Finds matching visual landmarks across frames to determine the exact camera angle and position for each shot.
3. **Build 3D Shape**: Connects matching points across multiple angles into a dense 3D wireframe mesh representing the terrain and structures.
4. **Texture & Color**: Projects high-resolution photographic colors onto the 3D mesh, creating a realistic, interactive digital twin ready for web inspection.

---

## 🎮 Workstation Features
- **Interactive 3D Viewport**: Full-bleed WebGL viewer powered by Three.js with orbit navigation, wireframe modes, and Draco compression.
- **Real-Time Visual Odometry (SLAM)**: Live camera tracking with HUD telemetry and RTK GPS coordinate geodesy (`EPSG:32630`).
- **2D GIS & Orthomosaics**: Flight path mapping, geofencing safety boundaries, and high-resolution map tiles.
- **Metric Measurement**: True-to-scale 1:1 dimension measurements, elevation profiles, and CAD-ready exports (`GLB`, `PLY`, `GeoTIFF`).

---

## 📂 Project Architecture

```
Aerosculpt/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Automated CI/CD deployment to GitHub Pages (with Git LFS)
├── assets/                     # Core demo videos, telemetry streams, and tracking clips
│   ├── aerosculpt_slam_tracking.mp4
│   ├── matching_video.mp4
│   └── ray_video.mp4
├── public/                     # Static production assets
│   ├── draco/                  # Draco decoder web workers & WebAssembly modules
│   └── Task-...-textured_model.glb # High-fidelity 3D reconstruction model
├── src/                        # Core application modules
│   ├── main.js                 # Global controller, routing, and telemetry synchronization
│   ├── studioViewer.js         # Dedicated full-screen 3D workstation viewer
│   └── viewer3d.js             # Three.js viewport, orbit controls, loaders, and shaders
├── styles/
│   └── main.css                # Dark theme design system, typography, and HUD styling
├── index.html                  # Single-page application entry point
├── package.json                # Dependencies and build scripts
└── vite.config.js              # Vite bundling configuration
```

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Core Framework** | Vanilla ES6+ Modules & Single Page Architecture |
| **3D Rendering Engine** | [Three.js](https://threejs.org/) (r183) + OrbitControls + DracoLoader |
| **Build & Bundling** | [Vite](https://vite.dev/) 8.0 |
| **Styling & HUD** | Custom Cyberpunk / Aerospace Glassmorphic Design System (Vanilla CSS) |
| **Typography** | Plus Jakarta Sans, Inter, JetBrains Mono |
| **Icons & Visuals** | FontAwesome 6 Pro / SVG HUD Overlays |
| **CI/CD & Hosting** | GitHub Actions + GitHub Pages + Git LFS |

---

## 🚀 Quickstart Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- [Git](https://git-scm.com/) & [Git LFS](https://git-lfs.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/dineshsugumar-01/Aerosculpt.git
cd Aerosculpt
git lfs pull
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application with Hot Module Replacement (HMR).

### 4. Build for Production
```bash
npm run build
```
Generates an optimized, tree-shaken static bundle in the `dist/` directory ready for deployment.

---

## 🌐 Deployment & CI/CD

This project is configured with continuous deployment via **GitHub Actions**:
- Whenever changes are pushed to the `main` branch, the workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) automatically:
  1. Checks out the repository with **Git LFS** to pull 3D models and high-res video assets.
  2. Sets up Node.js and installs dependencies.
  3. Executes `npm run build` using Vite.
  4. Copies public binary assets into `dist/`.
  5. Deploys directly to **GitHub Pages**.

> [!TIP]
> The site runs automatically 24/7 on GitHub Pages without requiring local server instances or third-party container management.

---

## 📄 License

This project is licensed under the MIT License — see the repository files for details.
