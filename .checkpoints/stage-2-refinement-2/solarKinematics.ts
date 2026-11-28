export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TrackerAngles {
  azimuthRad: number;
  elevationRad: number;
}

export interface RenderProfileInput {
  isSoftwareGl: boolean;
  isCoarsePointer: boolean;
  devicePixelRatio: number;
  viewportWidth: number;
  hardwareConcurrency?: number;
}

export interface RenderProfile {
  pixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  enableDriftParticles: boolean;
  paceWithAfterDraw: boolean;
}

const MIN_ELEVATION_RAD = 0.18;
const MAX_ELEVATION_RAD = 1.12;

/**
 * Computes a smooth, naturally arched solar trajectory above the tracker.
 * `phase` advances continuously; the Sun sweeps across the southern/front sky dome.
 */
export function computeSunPosition(phase: number, radius = 6.2): Vec3 {
  const sweep = Math.sin(phase) * 1.08;
  const zenithArc = Math.cos(sweep * 0.72);
  return {
    x: Math.sin(sweep) * radius,
    y: 2.35 + zenithArc * 2.55,
    z: 2.4 + Math.cos(sweep) * (radius * 0.42),
  };
}

/**
 * Derives independent azimuth (Y-axis yaw) and elevation (X-axis tilt) target angles
 * so the photovoltaic panel normal aligns smoothly toward the simulated Sun vector.
 */
export function computeTrackerAngles(sun: Vec3, pivotY = 0.45): TrackerAngles {
  const dx = sun.x;
  const dy = Math.max(0.2, sun.y - pivotY);
  const dz = sun.z;

  const horizontalDist = Math.hypot(dx, dz) || 0.001;
  // Azimuth rotates the yoke around Y so local +Z faces the Sun's horizontal bearing.
  const rawAzimuth = Math.atan2(dx, dz);
  const azimuthRad = Math.max(-1.35, Math.min(1.35, rawAzimuth));

  // Elevation pitches the panel cradle around local +X so panel normal (+Y) tilts toward the Sun.
  // When Sun is directly overhead (dx=0, dz=0), tilt is near 0; as Sun lowers toward horizon, tilt increases.
  const sunAltitude = Math.atan2(dy, horizontalDist);
  const targetTilt = Math.PI / 2 - sunAltitude;
  const elevationRad = Math.max(MIN_ELEVATION_RAD, Math.min(MAX_ELEVATION_RAD, targetTilt));

  return { azimuthRad, elevationRad };
}

/**
 * Chooses safe resolution clamping and shadow tiers for ordinary Android phones,
 * desktop GPUs, and software-WebGL environments.
 */
export function computeRenderProfile(input: RenderProfileInput): RenderProfile {
  const safeDpr = Number.isFinite(input.devicePixelRatio) && input.devicePixelRatio > 0
    ? input.devicePixelRatio
    : 1;

  if (input.isSoftwareGl) {
    return {
      pixelRatio: 1,
      antialias: false,
      shadows: false,
      shadowMapSize: 512,
      enableDriftParticles: false,
      paceWithAfterDraw: true,
    };
  }

  const isMobileViewport = input.isCoarsePointer || input.viewportWidth < 768;
  const cores = input.hardwareConcurrency ?? 8;
  const isLowTierDevice = isMobileViewport && cores <= 4;

  if (isMobileViewport) {
    return {
      pixelRatio: Math.min(safeDpr, 1.5),
      antialias: true,
      shadows: false,
      shadowMapSize: 512,
      enableDriftParticles: !isLowTierDevice,
      paceWithAfterDraw: false,
    };
  }

  return {
    pixelRatio: Math.min(safeDpr, 2),
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    enableDriftParticles: true,
    paceWithAfterDraw: false,
  };
}
