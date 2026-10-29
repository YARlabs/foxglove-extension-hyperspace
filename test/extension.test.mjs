import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activate,
  buildFoxgloveSceneUpdate,
  embedTelemetryFrameLorentz,
  HyperspaceTelemetrySynchronizer,
  interpolatePoincareGeodesic,
  lorentzGeodesicDistance,
  projectTo3DManifold,
} from "../dist/index.js";

test("Poincaré Ball & Lorentz Light-Cone 3D stereographic projection invariants", () => {
  const vec = [Math.sqrt(1 + 4 + 9 + 16), 2.0, 3.0, 4.0];
  const ballPos = projectTo3DManifold(vec, "poincare_ball", 1.0);
  const norm = Math.sqrt(ballPos.x ** 2 + ballPos.y ** 2 + ballPos.z ** 2);
  assert.ok(norm < 1.0, `Expected Poincaré ball point strictly inside unit sphere, got norm=${norm}`);

  const conePos = projectTo3DManifold(vec, "lorentz_cone", 2.0);
  assert.ok(conePos.z > 0, "Expected positive time-like altitude on Lorentz cone");
});

test("Geodesic arc interpolation bends toward Poincaré origin", () => {
  const src = { x: 4.0, y: 0.0, z: 0.0 };
  const dst = { x: 0.0, y: 4.0, z: 0.0 };
  const curve = interpolatePoincareGeodesic(src, dst, 10);
  assert.equal(curve.length, 11);

  const mid = curve[5];
  const euclideanMidNorm = Math.sqrt(2.0 ** 2 + 2.0 ** 2);
  const hyperbolicMidNorm = Math.sqrt(mid.x ** 2 + mid.y ** 2 + mid.z ** 2);
  assert.ok(hyperbolicMidNorm < euclideanMidNorm);
});

test("HyperspaceTelemetrySynchronizer builds Foxglove SceneUpdate with trajectory KAG edges", async () => {
  const sync = new HyperspaceTelemetrySynchronizer({
    geodesicAnomalyThreshold: 1.5,
    projectionMode: "poincare_ball",
  });

  const frames = [
    {
      id: 1,
      robotId: "drone_alpha",
      timestampMs: 1000,
      position: { x: 0.2, y: 0.1, z: 0.5 },
      velocity: { vx: 0.1, vy: 0.0, vz: 0.0 },
      batteryLevel: 98,
    },
    {
      id: 2,
      robotId: "drone_alpha",
      timestampMs: 2000,
      position: { x: 18.0, y: -12.0, z: 9.0 },
      velocity: { vx: 5.5, vy: -3.2, vz: 1.8 },
      batteryLevel: 15,
      status: "ERROR",
    },
  ];

  const { nodes, edges, sceneUpdate } = await sync.processTelemetryBatch(frames, false);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].isAnomalous, false);
  assert.equal(nodes[1].isAnomalous, true);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].relation, "NEXT_TRAJECTORY_STATE");

  assert.equal(sceneUpdate.entities.length, 1);
  assert.equal(sceneUpdate.entities[0].spheres.length, 2);
  assert.equal(sceneUpdate.entities[0].lines.length, 1);

  // Verify extension registration
  let registeredPanel = "";
  let registeredConverter = false;
  activate({
    registerPanel: ({ name }) => {
      registeredPanel = name;
    },
    registerMessageConverter: () => {
      registeredConverter = true;
    },
  });
  assert.equal(registeredPanel, "HyperspaceDB 3D Manifold & KAG Topology");
  assert.equal(registeredConverter, true);
});
