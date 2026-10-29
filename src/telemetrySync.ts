/**
 * Robotics Telemetry Synchronizer (`/odom`, `/tf`, `/diagnostics`) -> HyperspaceDB + Foxglove 3D Scene.
 */

import { HyperspaceClient } from "hyperspace-sdk-ts";
import { lorentzGeodesicDistance, ProjectionMode } from "./projector";
import {
  buildFoxgloveSceneUpdate,
  FoxgloveSceneUpdate,
  HyperspaceVisualEdge,
  HyperspaceVisualNode,
} from "./sceneBuilder";

export interface RobotTelemetryFrame {
  id: number;
  robotId: string;
  timestampMs: number;
  position: { x: number; y: number; z: number };
  velocity?: { vx: number; vy: number; vz: number };
  batteryLevel?: number;
  status?: string;
  parentFrameId?: number;
}

export interface TelemetrySyncConfig {
  host?: string;
  apiKey?: string;
  collectionName?: string;
  dimension?: number;
  geodesicAnomalyThreshold?: number;
  projectionMode?: ProjectionMode;
}

/**
 * Lifts a 6-DoF robot telemetry frame (`position`, `velocity`, `batteryLevel`) onto a
 * $d$-dimensional Lorentz Hyperboloid ($\mathbb{H}^{d-1}$) where $x_0 = \sqrt{1 + \|\mathbf{x}\|^2}$.
 */
export function embedTelemetryFrameLorentz(
  frame: RobotTelemetryFrame,
  dimension = 16
): number[] {
  const dim = Math.max(8, dimension);
  const vec = new Array<number>(dim).fill(0);

  vec[1] = frame.position.x * 0.25;
  vec[2] = frame.position.y * 0.25;
  vec[3] = frame.position.z * 0.25;
  vec[4] = (frame.velocity?.vx ?? 0) * 0.5;
  vec[5] = (frame.velocity?.vy ?? 0) * 0.5;
  vec[6] = (frame.velocity?.vz ?? 0) * 0.5;
  vec[7] = ((100 - (frame.batteryLevel ?? 100)) / 100.0) * 1.5;

  let spatialSq = 0;
  for (let i = 1; i < dim; i++) {
    spatialSq += vec[i] * vec[i];
  }
  vec[0] = Math.sqrt(1.0 + spatialSq);
  return vec;
}

/**
 * Synchronizes robotics telemetry frames with HyperspaceDB and produces Foxglove 3D `SceneUpdate`s.
 */
export class HyperspaceTelemetrySynchronizer {
  private readonly client: HyperspaceClient;
  private readonly collectionName: string;
  private readonly dimension: number;
  private readonly anomalyThreshold: number;
  private readonly projectionMode: ProjectionMode;
  private readonly nominalOrigin: number[];

  constructor(config: TelemetrySyncConfig = {}) {
    this.client = new HyperspaceClient(
      config.host ?? "http://localhost:8080",
      config.apiKey
    );
    this.collectionName = config.collectionName ?? "robotics_telemetry";
    this.dimension = config.dimension ?? 16;
    this.anomalyThreshold = config.geodesicAnomalyThreshold ?? 2.0;
    this.projectionMode = config.projectionMode ?? "poincare_ball";

    this.nominalOrigin = new Array<number>(this.dimension).fill(0);
    this.nominalOrigin[0] = 1.0;
  }

  /**
   * Converts a batch of robotics telemetry frames into visual manifold nodes, temporal KAG trajectory
   * edges (`NEXT_TRAJECTORY_STATE`), and a Foxglove `SceneUpdate` payload, optionally persisting to HyperspaceDB.
   */
  async processTelemetryBatch(
    frames: RobotTelemetryFrame[],
    persistToDb = false
  ): Promise<{
    nodes: HyperspaceVisualNode[];
    edges: HyperspaceVisualEdge[];
    sceneUpdate: FoxgloveSceneUpdate;
  }> {
    const nodes: HyperspaceVisualNode[] = [];
    const edges: HyperspaceVisualEdge[] = [];

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const vector = embedTelemetryFrameLorentz(f, this.dimension);
      const geodesicDist = lorentzGeodesicDistance(vector, this.nominalOrigin);
      const isAnomalous =
        f.status === "ERROR" || geodesicDist > this.anomalyThreshold;

      const metadata: Record<string, string> = {
        robot_id: f.robotId,
        label: `${f.robotId}#${f.id}`,
        timestamp_ms: String(f.timestampMs),
        geodesic_dist: geodesicDist.toFixed(4),
        is_anomalous: String(isAnomalous),
      };

      nodes.push({
        id: f.id,
        vector,
        metadata,
        distance: geodesicDist,
        isAnomalous,
      });

      const prevId = f.parentFrameId ?? (i > 0 ? frames[i - 1].id : undefined);
      if (prevId !== undefined && prevId !== f.id) {
        edges.push({
          sourceId: prevId,
          targetId: f.id,
          relation: "NEXT_TRAJECTORY_STATE",
          weight: 1.0,
        });
      }

      if (persistToDb) {
        await this.client.insert(f.id, vector, metadata, this.collectionName);
      }
    }

    if (persistToDb && edges.length > 0) {
      await this.client.linkBatch(
        edges.map((e) => ({
          sourceId: e.sourceId,
          targetId: e.targetId,
          relation: e.relation,
          weight: e.weight ?? 1.0,
        })),
        this.collectionName
      );
    }

    const sceneUpdate = buildFoxgloveSceneUpdate(nodes, edges, {
      mode: this.projectionMode,
    });

    return { nodes, edges, sceneUpdate };
  }
}
