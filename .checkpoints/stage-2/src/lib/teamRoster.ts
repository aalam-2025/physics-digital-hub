export type DesignationKind = 'tech-leader' | 'project-leader';

export interface MemberDesignation {
  kind: DesignationKind;
  label: string;
  shortRole: string;
  accentVariant: 'electric-silver' | 'solar-platinum';
  entranceDelayMs: number;
  floatDurationSec: number;
  floatDelaySec: number;
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

/**
 * Returns the visual 3D designation metadata for the approved leadership roles.
 * Strictly visual — never alters database roles or authorization.
 */
export function getMemberDesignation(code: string): MemberDesignation | null {
  return DESIGNATION_BY_CODE[code] ?? null;
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
