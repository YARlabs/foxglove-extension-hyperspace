/**
 * Foxglove `foxglove.SceneUpdate` 3D Entity Builder for HyperspaceDB Manifold Nodes & CSR KAG Edges.
 */

import {
  interpolatePoincareGeodesic,
  ProjectionMode,
  projectTo3DManifold,
  Vector3D,
} from "./projector";

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HyperspaceVisualNode {
  id: number;
  vector: number[];
  metadata?: Record<string, string>;
  distance?: number;
  isAnomalous?: boolean;
}

export interface HyperspaceVisualEdge {
  sourceId: number;
  targetId: number;
  relation: string;
  weight?: number;
}

export interface FoxgloveSceneEntity {
  timestamp: { sec: number; nsec: number };
  frame_id: string;
  id: string;
  lifetime: { sec: number; nsec: number };
  frame_locked: boolean;
  metadata: Array<{ key: string; value: string }>;
  spheres: Array<{
    pose: {
      position: Vector3D;
      orientation: { x: number; y: number; z: number; w: number };
    };
    size: Vector3D;
    color: RgbaColor;
  }>;
  lines: Array<{
    type: number;
    pose: {
      position: Vector3D;
      orientation: { x: number; y: number; z: number; w: number };
    };
    thickness: number;
    scale_invariant: boolean;
    points: Vector3D[];
    color: RgbaColor;
    colors: RgbaColor[];
    indices: number[];
  }>;
  texts: Array<{
    pose: {
      position: Vector3D;
      orientation: { x: number; y: number; z: number; w: number };
    };
    billboard: boolean;
    font_size: number;
    scale_invariant: boolean;
    color: RgbaColor;
    text: string;
  }>;
}

export interface FoxgloveSceneUpdate {
  deletions: Array<{ timestamp: { sec: number; nsec: number }; type: number; id: string }>;
  entities: FoxgloveSceneEntity[];
}

export interface SceneBuildOptions {
  frameId?: string;
  mode?: ProjectionMode;
  radiusScale?: number;
  nodeSize?: number;
  edgeThickness?: number;
}

/**
 * Converts a set of HyperspaceDB manifold nodes and CSR KAG edges into a standard
 * Foxglove `foxglove.SceneUpdate` message for real-time 3D rendering.
 */
export function buildFoxgloveSceneUpdate(
  nodes: HyperspaceVisualNode[],
  edges: HyperspaceVisualEdge[],
  options: SceneBuildOptions = {}
): FoxgloveSceneUpdate {
  const frameId = options.frameId ?? "hyperspace_manifold";
  const mode = options.mode ?? "poincare_ball";
  const radiusScale = options.radiusScale ?? 5.0;
  const nodeSize = options.nodeSize ?? 0.18;
  const edgeThickness = options.edgeThickness ?? 0.025;

  const nowMs = Date.now();
  const timestamp = {
    sec: Math.floor(nowMs / 1000),
    nsec: (nowMs % 1000) * 1_000_000,
  };

  const nodePositions = new Map<number, Vector3D>();
  const spheres: FoxgloveSceneEntity["spheres"] = [];
  const texts: FoxgloveSceneEntity["texts"] = [];

  for (const node of nodes) {
    const pos = projectTo3DManifold(node.vector, mode, radiusScale);
    nodePositions.set(node.id, pos);

    const color: RgbaColor = node.isAnomalous
      ? { r: 1.0, g: 0.18, b: 0.24, a: 0.95 }
      : { r: 0.12, g: 0.78, b: 0.96, a: 0.9 };

    spheres.push({
      pose: {
        position: pos,
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      size: { x: nodeSize, y: nodeSize, z: nodeSize },
      color,
    });

    const label =
      node.metadata?.label ??
      node.metadata?.name ??
      node.metadata?.["service.name"] ??
      `node:${node.id}`;

    texts.push({
      pose: {
        position: { x: pos.x, y: pos.y, z: pos.z + nodeSize * 0.85 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      billboard: true,
      font_size: 11,
      scale_invariant: true,
      color: { r: 0.92, g: 0.96, b: 1.0, a: 0.95 },
      text: label,
    });
  }

  const lines: FoxgloveSceneEntity["lines"] = [];
  for (const edge of edges) {
    const srcPos = nodePositions.get(edge.sourceId);
    const dstPos = nodePositions.get(edge.targetId);
    if (!srcPos || !dstPos) continue;

    const curvePoints =
      mode === "poincare_ball"
        ? interpolatePoincareGeodesic(srcPos, dstPos, 10)
        : [srcPos, dstPos];

    const edgeColor: RgbaColor =
      edge.relation === "SUPERSEDES" || edge.relation === "CAUSED_SPAN"
        ? { r: 0.98, g: 0.68, b: 0.15, a: 0.85 }
        : { r: 0.45, g: 0.88, b: 0.62, a: 0.75 };

    lines.push({
      type: 0, // LINE_STRIP
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      thickness: edgeThickness,
      scale_invariant: false,
      points: curvePoints,
      color: edgeColor,
      colors: [],
      indices: [],
    });
  }

  return {
    deletions: [],
    entities: [
      {
        timestamp,
        frame_id: frameId,
        id: "hyperspace_kag_topology",
        lifetime: { sec: 0, nsec: 0 },
        frame_locked: true,
        metadata: [
          { key: "projection_mode", value: mode },
          { key: "node_count", value: String(nodes.length) },
          { key: "edge_count", value: String(lines.length) },
        ],
        spheres,
        lines,
        texts,
      },
    ],
  };
}
