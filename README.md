# `foxglove-extension-hyperspace` — Foxglove Studio 3D Manifold & KAG Robotics Visualizer

[![npm version](https://img.shields.io/npm/v/foxglove-extension-hyperspace.svg)](https://www.npmjs.com/package/foxglove-extension-hyperspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Official **[Foxglove Studio](https://foxglove.dev)** extension and robotics telemetry synchronizer for **[HyperspaceDB](https://yar.ink)**.

Projects high-dimensional **801D Hybrid MRL** and **Lorentz Hyperboloid** ($\mathbb{H}^{d-1}$) robot/drone telemetry states into **3D Poincaré Ball** and **3D Lorentz Light-Cone** coordinates, rendering real-time hyperbolic geodesic KAG trajectories and anomaly heatmaps inside Foxglove's 3D viewport (`foxglove.SceneUpdate`).

Depends exclusively on the published [`hyperspace-sdk-ts`](https://www.npmjs.com/package/hyperspace-sdk-ts) (`^4.2.0`) package.

---

## Key Capabilities

1. **Stereographic 3D Poincaré Ball & Lorentz Light-Cone Projection**
   - Maps Lorentzian vectors ($x_0 = \sqrt{1 + \|\mathbf{x}\|^2}$) onto the open 3D Poincaré ball via $\mathbf{p} = \frac{\mathbf{x}_{1..3}}{1 + x_0}$ or onto the 3D Lorentz light cone.
2. **Hyperbolic Geodesic KAG Arc Rendering**
   - Renders CSR KAG edges (`NEXT_TRAJECTORY_STATE`, `SUPERSEDES`, `CAUSED_SPAN`) as curved hyperbolic geodesics bending naturally toward the manifold origin.
3. **Real-Time 6-DoF Telemetry Anomaly Detection**
   - `HyperspaceTelemetrySynchronizer` embeds `/odom`, `/tf`, and `/diagnostics` frames into Lorentz space, computes exact Minkowski geodesic divergence $d_L(\mathbf{u}, \mathbf{v})$, and highlights anomalous states in crimson inside Foxglove 3D.

---

## Installation

```bash
npm install foxglove-extension-hyperspace
```

---

## Quick Start

```typescript
import { HyperspaceTelemetrySynchronizer } from "foxglove-extension-hyperspace";

const sync = new HyperspaceTelemetrySynchronizer({
  host: "http://localhost:8080",
  collectionName: "drone_swarm_kag",
  projectionMode: "poincare_ball",
  geodesicAnomalyThreshold: 1.8,
});

const { sceneUpdate } = await sync.processTelemetryBatch([
  {
    id: 101,
    robotId: "uav_01",
    timestampMs: Date.now(),
    position: { x: 1.2, y: -0.4, z: 12.5 },
    velocity: { vx: 0.8, vy: 0.1, vz: 0.0 },
    batteryLevel: 92,
  },
]);
```

---

## License

MIT. Copyright © 2026 **YARlabs**.

