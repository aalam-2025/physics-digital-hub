export type DesignationKind = 'tech-leader' | 'project-leader';

export type IdentityTier = 'flagship' | 'standard';

export type IdentityVariant =
  | 'aman-tech-crown'
  | 'abhirup-project-crown'
  | 'anik-tech-crown'
  | 'standard-platinum';

export interface MemberDesignation {
  kind: DesignationKind;
  label: string;
  shortRole: string;
  accentVariant: 'electric-silver' | 'solar-platinum';
  entranceDelayMs: number;
  floatDurationSec: number;
  floatDelaySec: number;
}

export interface MemberIdentityProfile {
  tier: IdentityTier;
  variant: IdentityVariant;
  extrusionDepthPx: number;
  elevationZPx: number;
}

export interface CardRevealTiming {
  cardDelayMs: number;
  nameDelayMs: number;
  sheenDelayMs: number;
}

const DESIGNATION_BY_CODE: Record<string, MemberDesignation> = {
  '01': {
    kind: 'tech-leader',
    label: 'TECH LEADER',
    shortRole: 'Systems & Telemetry Lead',
    accentVariant: 'electric-silver',
    entranceDelayMs: 360,
    floatDurationSec: 4.6,
    floatDelaySec: 0,
  },
  '02': {
    kind: 'project-leader',
    label: 'PROJECT LEADER',
    shortRole: 'Project Command & Integration',
    accentVariant: 'solar-platinum',
    entranceDelayMs: 580,
    floatDurationSec: 5.2,
    floatDelaySec: -1.4,
  },
  '03': {
    kind: 'tech-leader',
    label: 'TECH LEADER',
    shortRole: 'Hardware & Tracking Architecture',
    accentVariant: 'electric-silver',
    entranceDelayMs: 800,
    floatDurationSec: 4.9,
    floatDelaySec: -2.6,
  },
};

const IDENTITY_PROFILE_BY_CODE: Record<string, MemberIdentityProfile> = {
  '01': {
    tier: 'flagship',
    variant: 'aman-tech-crown',
    extrusionDepthPx: 5,
    elevationZPx: 14,
  },
  '02': {
    tier: 'flagship',
    variant: 'abhirup-project-crown',
    extrusionDepthPx: 6,
    elevationZPx: 16,
  },
  '03': {
    tier: 'flagship',
    variant: 'anik-tech-crown',
    extrusionDepthPx: 5,
    elevationZPx: 14,
  },
};

const STANDARD_IDENTITY_PROFILE: MemberIdentityProfile = {
  tier: 'standard',
  variant: 'standard-platinum',
  extrusionDepthPx: 3,
  elevationZPx: 8,
};

/**
 * Returns the visual 3D designation metadata for the approved leadership roles.
 * Strictly visual — never alters database roles or authorization.
 */
export function getMemberDesignation(code: string): MemberDesignation | null {
  return DESIGNATION_BY_CODE[code] ?? null;
}

/**
 * Returns the visual 3D metallic identity profile for each team member.
 * Flagship tier applies exclusively to 01–03; 04–08 receive standard platinum plaques.
 */
export function getMemberIdentityProfile(code: string): MemberIdentityProfile {
  return IDENTITY_PROFILE_BY_CODE[code] ?? STANDARD_IDENTITY_PROFILE;
}

/**
 * Computes coordinated reveal timings so all eight cards and three designation tags
 * complete their entrance well within the 5-second visitor reading window.
 */
export function getCardRevealTiming(index: number): CardRevealTiming {
  const safeIndex = Math.max(0, Math.min(7, index));
  const cardDelayMs = safeIndex * 300;
  return {
    cardDelayMs,
    nameDelayMs: cardDelayMs + 140,
    sheenDelayMs: cardDelayMs + 420,
  };
}
