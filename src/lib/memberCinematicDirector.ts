import type { TimerAdapter } from './welcomeGuidance';

export type MemberRevealConcept =
  | 'solar-tech-awakening'
  | 'golden-solar-crown'
  | 'orbital-emergence'
  | 'platinum-spotlight'
  | 'chrome-light-trail'
  | 'floating-platinum'
  | 'radiant-precision'
  | 'particle-finale';

export type MemberRevealPhase = 'waiting' | 'introducing' | 'settled';

export interface MemberRevealSpec {
  code: string;
  name: string;
  tier: 'flagship' | 'standard';
  concept: MemberRevealConcept;
  durationMs: number;
  nameRevealOffsetMs: number;
  tagRevealOffsetMs: number | null;
}

export interface CinematicDirectorSnapshot {
  phases: MemberRevealPhase[];
  tagVisible: boolean[];
  activeIndex: number;
  activeConcept: MemberRevealConcept | null;
  started: boolean;
  complete: boolean;
  paused: boolean;
}

export interface MemberCinematicDirector {
  start: () => boolean;
  setPaused: (paused: boolean) => void;
  completeImmediately: () => void;
  cleanup: () => void;
  getSnapshot: () => CinematicDirectorSnapshot;
}

export const MEMBER_CINEMATIC_SEQUENCE: readonly MemberRevealSpec[] = [
  {
    code: '01',
    name: 'Aman Alam',
    tier: 'flagship',
    concept: 'solar-tech-awakening',
    durationMs: 2650,
    nameRevealOffsetMs: 1050,
    tagRevealOffsetMs: 1620,
  },
  {
    code: '02',
    name: 'Abhirup Baru',
    tier: 'flagship',
    concept: 'golden-solar-crown',
    durationMs: 2950,
    nameRevealOffsetMs: 1180,
    tagRevealOffsetMs: 1820,
  },
  {
    code: '03',
    name: 'Anik Ghosh',
    tier: 'flagship',
    concept: 'orbital-emergence',
    durationMs: 2650,
    nameRevealOffsetMs: 1050,
    tagRevealOffsetMs: 1620,
  },
  {
    code: '04',
    name: 'Saheb Mukherjee',
    tier: 'standard',
    concept: 'platinum-spotlight',
    durationMs: 1550,
    nameRevealOffsetMs: 520,
    tagRevealOffsetMs: null,
  },
  {
    code: '05',
    name: 'Sandipan Mukherjee',
    tier: 'standard',
    concept: 'chrome-light-trail',
    durationMs: 1550,
    nameRevealOffsetMs: 520,
    tagRevealOffsetMs: null,
  },
  {
    code: '06',
    name: 'Ananya Gope',
    tier: 'standard',
    concept: 'floating-platinum',
    durationMs: 1550,
    nameRevealOffsetMs: 520,
    tagRevealOffsetMs: null,
  },
  {
    code: '07',
    name: 'Neha Kumari',
    tier: 'standard',
    concept: 'radiant-precision',
    durationMs: 1550,
    nameRevealOffsetMs: 520,
    tagRevealOffsetMs: null,
  },
  {
    code: '08',
    name: 'Khushi Rawani',
    tier: 'standard',
    concept: 'particle-finale',
    durationMs: 1850,
    nameRevealOffsetMs: 640,
    tagRevealOffsetMs: null,
  },
] as const;

export function getMemberRevealSpec(code: string): MemberRevealSpec {
  return (
    MEMBER_CINEMATIC_SEQUENCE.find((item) => item.code === code) ?? {
      code,
      name: '',
      tier: 'standard',
      concept: 'platinum-spotlight',
      durationMs: 1550,
      nameRevealOffsetMs: 520,
      tagRevealOffsetMs: null,
    }
  );
}

const DEFAULT_TIMERS: TimerAdapter = {
  setTimeoutFn: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeoutFn: (handle) => window.clearTimeout(handle),
};

export function createInitialSnapshot(specs: readonly MemberRevealSpec[] = MEMBER_CINEMATIC_SEQUENCE): CinematicDirectorSnapshot {
  return {
    phases: specs.map(() => 'waiting'),
    tagVisible: specs.map(() => false),
    activeIndex: -1,
    activeConcept: null,
    started: false,
    complete: false,
    paused: false,
  };
}

/**
 * Deterministic sequential cinematic reveal director for the eight Team Showcase members.
 * Guarantees strict sequential progression, zero double-starts, retained settled cards,
 * coordinated floating tag timing for 01-03, clean pause/resume on tab visibility,
 * instant completion under reduced motion, and zero screen navigation side effects.
 */
export function createMemberCinematicDirector(
  onUpdate: (snapshot: CinematicDirectorSnapshot) => void,
  specs: readonly MemberRevealSpec[] = MEMBER_CINEMATIC_SEQUENCE,
  timers: TimerAdapter = DEFAULT_TIMERS,
  nowFn: () => number = () => Date.now(),
): MemberCinematicDirector {
  const phases: MemberRevealPhase[] = specs.map(() => 'waiting');
  const tagVisible: boolean[] = specs.map(() => false);
  let activeIndex = -1;
  let started = false;
  let complete = false;
  let paused = false;
  let cleanedUp = false;

  let stepTimerId: number | null = null;
  let tagTimerId: number | null = null;
  let stepStartedAt = 0;
  let stepRemainingMs = 0;
  let tagRemainingMs = 0;

  const clearTimers = () => {
    if (stepTimerId !== null) {
      timers.clearTimeoutFn(stepTimerId);
      stepTimerId = null;
    }
    if (tagTimerId !== null) {
      timers.clearTimeoutFn(tagTimerId);
      tagTimerId = null;
    }
  };

  const buildSnapshot = (): CinematicDirectorSnapshot => ({
    phases: [...phases],
    tagVisible: [...tagVisible],
    activeIndex,
    activeConcept: activeIndex >= 0 && activeIndex < specs.length ? specs[activeIndex].concept : null,
    started,
    complete,
    paused,
  });

  const emit = () => {
    if (!cleanedUp) {
      onUpdate(buildSnapshot());
    }
  };

  const scheduleCurrentStepTimers = () => {
    clearTimers();
    if (paused || complete || cleanedUp || activeIndex < 0 || activeIndex >= specs.length) {
      return;
    }

    const index = activeIndex;
    const spec = specs[index];
    stepStartedAt = nowFn();

    if (spec.tagRevealOffsetMs !== null && !tagVisible[index]) {
      const waitTagMs = Math.max(0, tagRemainingMs);
      tagTimerId = timers.setTimeoutFn(() => {
        tagTimerId = null;
        if (cleanedUp || complete || paused || activeIndex !== index) return;
        tagVisible[index] = true;
        emit();
      }, waitTagMs);
    }

    const waitStepMs = Math.max(0, stepRemainingMs);
    stepTimerId = timers.setTimeoutFn(() => {
      stepTimerId = null;
      if (cleanedUp || complete || paused || activeIndex !== index) return;
      if (spec.tagRevealOffsetMs !== null) {
        tagVisible[index] = true;
      }
      phases[index] = 'settled';
      const nextIndex = index + 1;
      if (nextIndex >= specs.length) {
        activeIndex = -1;
        complete = true;
        emit();
        return;
      }
      enterStep(nextIndex);
    }, waitStepMs);
  };

  const enterStep = (index: number) => {
    const spec = specs[index];
    activeIndex = index;
    phases[index] = 'introducing';
    stepRemainingMs = spec.durationMs;
    tagRemainingMs = spec.tagRevealOffsetMs ?? 0;
    emit();
    scheduleCurrentStepTimers();
  };

  return {
    start() {
      if (started || complete || cleanedUp || specs.length === 0) {
        return false;
      }
      started = true;
      enterStep(0);
      return true;
    },

    setPaused(nextPaused: boolean) {
      if (!started || complete || cleanedUp || paused === nextPaused) {
        return;
      }
      if (nextPaused) {
        const elapsed = Math.max(0, nowFn() - stepStartedAt);
        stepRemainingMs = Math.max(0, stepRemainingMs - elapsed);
        tagRemainingMs = Math.max(0, tagRemainingMs - elapsed);
        paused = true;
        clearTimers();
        emit();
      } else {
        paused = false;
        emit();
        scheduleCurrentStepTimers();
      }
    },

    completeImmediately() {
      if (cleanedUp) return;
      clearTimers();
      started = true;
      paused = false;
      complete = true;
      activeIndex = -1;
      for (let i = 0; i < specs.length; i += 1) {
        phases[i] = 'settled';
        tagVisible[i] = specs[i].tagRevealOffsetMs !== null;
      }
      emit();
    },

    cleanup() {
      cleanedUp = true;
      clearTimers();
    },

    getSnapshot: buildSnapshot,
  };
}
