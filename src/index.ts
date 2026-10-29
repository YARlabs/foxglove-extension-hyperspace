/**
 * Official Foxglove Studio Extension for HyperspaceDB (`foxglove-extension-hyperspace`).
 *
 * Registers the "HyperspaceDB 3D Manifold & KAG Topology" panel and message converters
 * for real-time Poincaré Ball & Lorentz Light-Cone trajectory visualization.
 */

export * from "./projector";
export * from "./sceneBuilder";
export * from "./telemetrySync";

import { buildFoxgloveSceneUpdate, HyperspaceVisualEdge, HyperspaceVisualNode } from "./sceneBuilder";

export interface FoxgloveExtensionContext {
  registerPanel(params: {
    name: string;
    initPanel: (context: any) => void;
  }): void;
  registerMessageConverter?<Src>(params: {
    fromSchemaName: string;
    toSchemaName: string;
    converter: (msg: Src) => unknown;
  }): void;
}

export interface HyperspaceGraphMessage {
  nodes?: HyperspaceVisualNode[];
  edges?: HyperspaceVisualEdge[];
  projectionMode?: "poincare_ball" | "lorentz_cone";
}

/**
 * Foxglove Studio extension entrypoint.
 */
export function activate(extensionContext: FoxgloveExtensionContext): void {
  extensionContext.registerPanel({
    name: "HyperspaceDB 3D Manifold & KAG Topology",
    initPanel: (panelContext: any) => {
      if (panelContext && typeof panelContext.watch === "function") {
        panelContext.watch("currentFrame");
      }
    },
  });

  if (typeof extensionContext.registerMessageConverter === "function") {
    extensionContext.registerMessageConverter<HyperspaceGraphMessage>({
      fromSchemaName: "hyperspace.GraphTopology",
      toSchemaName: "foxglove.SceneUpdate",
      converter: (msg: HyperspaceGraphMessage) =>
        buildFoxgloveSceneUpdate(msg.nodes ?? [], msg.edges ?? [], {
          mode: msg.projectionMode ?? "poincare_ball",
        }),
    });
  }
}
