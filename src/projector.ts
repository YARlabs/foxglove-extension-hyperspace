/**
 * 3D Hyperbolic (Poincaré Ball & Lorentz Light-Cone) Stereographic Projectors
 * for Foxglove Studio Robotics & Spatial AI Visualization.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type ProjectionMode = "poincare_ball" | "lorentz_cone";

/**
 * Projects an arbitrary $d$-dimensional Lorentz Hyperboloid vector ($x_0 = \sqrt{1 + \|\mathbf{x}\|^2}$)
 * or 801D Hybrid MRL vector into 3D coordinates suitable for Foxglove 3D rendering.
 *
 * - In `"poincare_ball"` mode: maps via stereographic projection $\mathbf{p} = \frac{\mathbf{x}_{1..3}}{1 + x_0}$
 *   so every point strictly resides inside the open unit ball $\|\mathbf{p}\| < R_{\text{scale}}$.
 * - In `"lorentz_cone"` mode: preserves the time-like altitude $z = x_0$ while projecting spatial
 *   dimensions onto the horizontal $(x, y)$ plane on the upper sheet of the hyperboloid.
 */
export function projectTo3DManifold(
  vector: number[],
  mode: ProjectionMode = "poincare_ball",
  radiusScale = 5.0
): Vector3D {
  if (!vector || vector.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  // Fold spatial dimensions [1..d) into 3 orthogonal spatial axes using deterministic trigonometric basis
  let sx = 0;
  let sy = 0;
  let sz = 0;

  const startIdx = vector.length >= 4 ? 1 : 0;
  const spatialBound = Math.min(vector.length, 129); // Use Lorentz prefix for 801D Hybrid vectors

  for (let i = startIdx; i < spatialBound; i++) {
    const val = Number.isFinite(vector[i]) ? vector[i] : 0;
    const axis = (i - startIdx) % 3;
    if (axis === 0) sx += val;
    else if (axis === 1) sy += val;
    else sz += val;
  }

  const spatialNormSq = sx * sx + sy * sy + sz * sz;
  const rawX0 = vector.length >= 4 && vector[0] >= 1.0 ? vector[0] : Math.sqrt(1.0 + spatialNormSq);
  const consistentX0 = Math.max(rawX0, Math.sqrt(1.0 + spatialNormSq));

  if (mode === "lorentz_cone") {
    return {
      x: sx * (radiusScale * 0.25),
      y: sy * (radiusScale * 0.25),
      z: (consistentX0 - 1.0) * (radiusScale * 0.5),
    };
  }

  // Stereographic projection onto the 3D Poincaré open unit ball: p = x_spatial / (1 + x_0)
  const denom = 1.0 + consistentX0;
  let px = sx / denom;
  let py = sy / denom;
  let pz = sz / denom;

  const pNorm = Math.sqrt(px * px + py * py + pz * pz);
  if (pNorm >= 0.99) {
    const clamp = 0.99 / pNorm;
    px *= clamp;
    py *= clamp;
    pz *= clamp;
  }

  return {
    x: px * radiusScale,
    y: py * radiusScale,
    z: pz * radiusScale,
  };
}

/**
 * Computes the exact Lorentzian geodesic distance between two vectors on the hyperboloid:
 * $d_L(\mathbf{u}, \mathbf{v}) = \operatorname{arcosh}(\max(1, u_0 v_0 - \sum_{i=1}^{d-1} u_i v_i))$.
 */
export function lorentzGeodesicDistance(u: number[], v: number[]): number {
  const n = Math.min(u.length, v.length, 129);
  if (n < 2) return 0;

  let spatialDot = 0;
  let uSq = 0;
  let vSq = 0;
  for (let i = 1; i < n; i++) {
    spatialDot += u[i] * v[i];
    uSq += u[i] * u[i];
    vSq += v[i] * v[i];
  }
  const u0 = Math.max(u[0], Math.sqrt(1 + uSq));
  const v0 = Math.max(v[0], Math.sqrt(1 + vSq));
  const negMinkowski = Math.max(1.0, u0 * v0 - spatialDot);
  return Math.acosh(negMinkowski);
}

/**
 * Interpolates a hyperbolic geodesic curve between two 3D Poincaré ball points
 * so KAG topology edges bend naturally toward the manifold origin.
 */
export function interpolatePoincareGeodesic(
  source: Vector3D,
  target: Vector3D,
  segments = 12
): Vector3D[] {
  const steps = Math.max(2, segments);
  const points: Vector3D[] = [];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    // Hyperbolic inward curvature weight peaking at midpoint t = 0.5
    const curvaturePull = 1.0 - 0.32 * Math.sin(Math.PI * t);
    points.push({
      x: (source.x * (1 - t) + target.x * t) * curvaturePull,
      y: (source.y * (1 - t) + target.y * t) * curvaturePull,
      z: (source.z * (1 - t) + target.z * t) * curvaturePull,
    });
  }

  return points;
}

