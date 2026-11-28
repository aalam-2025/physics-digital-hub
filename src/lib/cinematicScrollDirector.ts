import type { MemberRevealConcept, MemberRevealSpec } from './memberCinematicDirector';

export type ScrollMotionState =
  | 'idle'
  | 'following'
  | 'settled'
  | 'interrupted-by-user'
  | 'paused'
  | 'complete'
  | 'reduced-motion';

export interface ScrollLayoutBox {
  top: number;
  bottom: number;
  height: number;
  left: number;
  right: number;
  width: number;
}

export interface ScrollViewportMetrics {
  width: number;
  height: number;
  scrollY: number;
  scrollHeight: number;
}

export interface ComputeScrollTargetInput {
  memberIndex: number;
  spec: MemberRevealSpec;
  hasDesignation: boolean;
  cardBox: ScrollLayoutBox;
  rowGroupBox?: ScrollLayoutBox | null;
  viewport: ScrollViewportMetrics;
  topOffsetPx?: number;
  bottomOffsetPx?: number;
}

export interface ScrollTargetDecision {
  shouldScroll: boolean;
  targetY: number;
  durationMs: number;
  reason:
    | 'already-visible'
    | 'tiny-delta'
    | 'flagship-group-visible'
    | 'frame-row'
    | 'frame-card';
}

export type ScrollEasingKind = 'precision' | 'royal' | 'orbital' | 'silk';

export const MANUAL_RESUME_QUIET_MS = 1600;
const MIN_MEANINGFUL_SCROLL_PX = 18;

const CONCEPT_EASING: Record<MemberRevealConcept, ScrollEasingKind> = {
  'solar-tech-awakening': 'precision',
  'golden-solar-crown': 'royal',
  'orbital-emergence': 'orbital',
  'platinum-spotlight': 'precision',
  'chrome-light-trail': 'orbital',
  'floating-platinum': 'silk',
  'radiant-precision': 'precision',
  'particle-finale': 'royal',
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function easeCinematicScroll(progress: number, kind: ScrollEasingKind = 'precision'): number {
  const t = clamp(progress, 0, 1);
  if (t === 0 || t === 1) return t;

  switch (kind) {
    case 'royal': {
      // Smooth symmetric quintic-like curve for sweeping crown & finale moments
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    }
    case 'orbital': {
      // Slightly faster initial glide into soft deceleration
      return 1 - Math.pow(1 - t, 3.2);
    }
    case 'silk': {
      return -(Math.cos(Math.PI * t) - 1) / 2;
    }
    case 'precision':
    default: {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
  }
}

export function computeScrollDurationMs(distancePx: number, spec: MemberRevealSpec): number {
  const absDistance = Math.abs(distancePx);
  if (absDistance < MIN_MEANINGFUL_SCROLL_PX) return 0;

  // Align camera arrival so the active nameplate is framed cleanly right as its 3D typography settles
  const baseByDistance = 420 + Math.min(540, absDistance * 1.15);
  const maxAlignedDuration =
    spec.tier === 'flagship'
      ? Math.min(1060, Math.max(620, spec.nameRevealOffsetMs + 80))
      : Math.min(760, Math.max(460, spec.nameRevealOffsetMs + 180));

  return Math.round(clamp(baseByDistance, 440, maxAlignedDuration));
}

/**
 * Pure geometric decision engine determining whether the viewport should move
 * for a newly introduced member, and where to frame their card + 3D designation tag.
 */
export function computeCinematicScrollTarget(input: ComputeScrollTargetInput): ScrollTargetDecision {
  const {
    spec,
    hasDesignation,
    cardBox,
    rowGroupBox = null,
    viewport,
    topOffsetPx = 0,
    bottomOffsetPx = 0,
  } = input;

  const maxScrollY = Math.max(0, viewport.scrollHeight - viewport.height);
  if (maxScrollY <= 4 || viewport.height <= 0) {
    return {
      shouldScroll: false,
      targetY: clamp(viewport.scrollY, 0, maxScrollY),
      durationMs: 0,
      reason: 'already-visible',
    };
  }

  const isDesktop = viewport.width >= 1024;
  const isTablet = viewport.width >= 768 && viewport.width < 1024;
  const tagHeadroomPx = hasDesignation ? 28 : 10;
  const chassisTailPx = 14;

  const safeTopMargin =
    topOffsetPx + (isDesktop ? Math.max(40, Math.round(viewport.height * 0.065)) : isTablet ? Math.max(34, Math.round(viewport.height * 0.06)) : Math.max(26, Math.round(viewport.height * 0.055)));
  const safeBottomMargin =
    bottomOffsetPx + (isDesktop ? Math.max(44, Math.round(viewport.height * 0.075)) : isTablet ? Math.max(40, Math.round(viewport.height * 0.075)) : Math.max(32, Math.round(viewport.height * 0.075)));

  const visualTop = cardBox.top - tagHeadroomPx;
  const visualBottom = cardBox.bottom + chassisTailPx;

  const comfortTop = viewport.scrollY + safeTopMargin;
  const comfortBottom = viewport.scrollY + viewport.height - safeBottomMargin;

  // On desktop/multi-column rows, check if the card (or flagship ensemble) is already comfortably framed
  if (visualTop >= comfortTop && visualBottom <= comfortBottom) {
    return {
      shouldScroll: false,
      targetY: viewport.scrollY,
      durationMs: 0,
      reason: spec.tier === 'flagship' && isDesktop ? 'flagship-group-visible' : 'already-visible',
    };
  }

  // Choose an ideal reading vertical anchor inside the viewport
  let anchorRatio = 0.28;
  if (isDesktop) {
    anchorRatio = spec.tier === 'flagship' ? 0.22 : 0.34;
  } else if (isTablet) {
    anchorRatio = spec.tier === 'flagship' ? 0.24 : 0.30;
  } else {
    // Mobile: comfortable upper-middle framing leaving tag headroom & reading context
    anchorRatio = spec.code === '01' ? 0.20 : spec.code === '02' ? 0.26 : 0.28;
  }

  const anchorTop = Math.max(safeTopMargin, Math.round(viewport.height * anchorRatio));
  let desiredY = visualTop - anchorTop;

  // If framing a shared horizontal row (e.g., Row 2 on Desktop or 2-up row on Tablet/Mobile), ensure the whole row fits comfortably
  let reason: ScrollTargetDecision['reason'] = 'frame-card';
  if (rowGroupBox && rowGroupBox.height > 0) {
    const groupVisualTop = rowGroupBox.top - (spec.tier === 'flagship' ? 28 : 10);
    const groupVisualBottom = rowGroupBox.bottom + chassisTailPx;
    const availableComfortHeight = viewport.height - safeTopMargin - safeBottomMargin;
    if (groupVisualBottom - groupVisualTop <= availableComfortHeight) {
      if (groupVisualTop >= comfortTop && groupVisualBottom <= comfortBottom) {
        return {
          shouldScroll: false,
          targetY: viewport.scrollY,
          durationMs: 0,
          reason: spec.tier === 'flagship' ? 'flagship-group-visible' : 'already-visible',
        };
      }
      // Adjust desiredY if needed so groupVisualBottom never clips below bottom safe zone
      if (groupVisualBottom - desiredY > viewport.height - safeBottomMargin) {
        desiredY = groupVisualBottom - (viewport.height - safeBottomMargin);
      }
      reason = 'frame-row';
    }
  }

  // Final guarantee that card visualBottom also fits comfortably above bottomSafeMargin
  const projectedBottom = visualBottom - desiredY;
  const maxVisibleBottom = viewport.height - safeBottomMargin;
  if (projectedBottom > maxVisibleBottom) {
    desiredY += projectedBottom - maxVisibleBottom;
  }
  const projectedTop = visualTop - desiredY;
  if (projectedTop < safeTopMargin) {
    desiredY -= safeTopMargin - projectedTop;
  }

  const clampedTargetY = Math.round(clamp(desiredY, 0, maxScrollY));
  const delta = clampedTargetY - viewport.scrollY;

  if (Math.abs(delta) < MIN_MEANINGFUL_SCROLL_PX) {
    return {
      shouldScroll: false,
      targetY: viewport.scrollY,
      durationMs: 0,
      reason: 'tiny-delta',
    };
  }

  return {
    shouldScroll: true,
    targetY: clampedTargetY,
    durationMs: computeScrollDurationMs(delta, spec),
    reason,
  };
}

/**
 * Computes CSS layout coordinates (unaffected by temporary 3D entrance transforms)
 * so mid-animation bounds never skew camera scroll targets.
 */
export function measureLayoutBox(element: HTMLElement): ScrollLayoutBox {
  let top = 0;
  let left = 0;
  let current: HTMLElement | null = element;
  while (current) {
    top += current.offsetTop;
    left += current.offsetLeft;
    current = current.offsetParent as HTMLElement | null;
  }
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
  };
}

export interface ScrollEnvironmentAdapter {
  getViewport: () => ScrollViewportMetrics;
  scrollToY: (y: number) => void;
  requestFrame: (callback: (now: number) => void) => number;
  cancelFrame: (id: number) => void;
  now: () => number;
  addListener: (type: string, handler: EventListener, options?: AddEventListenerOptions) => void;
  removeListener: (type: string, handler: EventListener) => void;
}

function createBrowserScrollAdapter(): ScrollEnvironmentAdapter {
  return {
    getViewport: () => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY ?? window.pageYOffset ?? 0,
      scrollHeight: Math.max(
        document.documentElement?.scrollHeight ?? 0,
        document.body?.scrollHeight ?? 0,
      ),
    }),
    scrollToY: (y: number) => {
      // Bypass html { scroll-behavior: smooth } so rAF easing stays smooth and deterministic
      window.scrollTo({ top: y, behavior: 'auto' });
    },
    requestFrame: (cb) => window.requestAnimationFrame(cb),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
    now: () => performance.now(),
    addListener: (type, handler, options) => window.addEventListener(type, handler, options),
    removeListener: (type, handler) => window.removeEventListener(type, handler),
  };
}

export interface CinematicScrollDirectorOptions {
  reducedMotion: boolean;
  getCardElement: (memberCode: string) => HTMLElement | null;
  getRowGroupElements?: (memberCode: string, viewportWidth: number) => HTMLElement[];
  onStateChange?: (state: ScrollMotionState) => void;
  adapter?: ScrollEnvironmentAdapter;
}

export interface CinematicScrollDirector {
  followMember: (memberIndex: number, spec: MemberRevealSpec, hasDesignation: boolean) => ScrollTargetDecision;
  recheckLayout: () => void;
  setPaused: (paused: boolean) => void;
  markSequenceComplete: () => void;
  getState: () => ScrollMotionState;
  cleanup: () => void;
}

const SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Home',
  'End',
  ' ',
  'Spacebar',
]);

export function createCinematicScrollDirector(
  options: CinematicScrollDirectorOptions,
): CinematicScrollDirector {
  const adapter = options.adapter ?? createBrowserScrollAdapter();
  let state: ScrollMotionState = options.reducedMotion ? 'reduced-motion' : 'idle';
  let cleanedUp = false;
  let paused = false;
  let completed = false;

  let activeRafId: number | null = null;
  let activeMemberIndex = -1;
  let activeSpec: MemberRevealSpec | null = null;
  let activeHasDesignation = false;

  let manualInterrupted = false;
  let interruptedAtMemberIndex = -1;
  let lastManualGestureAt = -Infinity;
  let isTouchActive = false;
  let lastProgrammaticScrollY: number | null = null;
  let lastScrolledMemberIndex = -1;

  const setState = (next: ScrollMotionState) => {
    if (state === next) return;
    state = next;
    options.onStateChange?.(state);
  };

  const cancelActiveTween = () => {
    if (activeRafId !== null) {
      adapter.cancelFrame(activeRafId);
      activeRafId = null;
    }
    lastProgrammaticScrollY = null;
  };

  const interruptForManualGesture = () => {
    if (cleanedUp || completed || options.reducedMotion) return;
    lastManualGestureAt = adapter.now();
    const wasFollowing = activeRafId !== null || state === 'following';
    cancelActiveTween();
    manualInterrupted = true;
    interruptedAtMemberIndex = activeMemberIndex;
    if (wasFollowing || activeMemberIndex >= 0) {
      setState('interrupted-by-user');
    }
  };

  const onWheel: EventListener = () => {
    interruptForManualGesture();
  };

  const onTouchStart: EventListener = () => {
    isTouchActive = true;
  };

  const onTouchMove: EventListener = () => {
    if (isTouchActive) {
      interruptForManualGesture();
    }
  };

  const onTouchEnd: EventListener = () => {
    isTouchActive = false;
  };

  const onKeyDown: EventListener = (event) => {
    const key = (event as KeyboardEvent).key;
    if (SCROLL_KEYS.has(key)) {
      interruptForManualGesture();
    }
  };

  const onScroll: EventListener = () => {
    if (cleanedUp || completed || options.reducedMotion) return;
    const currentY = adapter.getViewport().scrollY;
    // Detect scrollbar drag / external scroll during active animation
    if (activeRafId !== null && lastProgrammaticScrollY !== null) {
      if (Math.abs(currentY - lastProgrammaticScrollY) > 10) {
        interruptForManualGesture();
      }
    }
  };

  if (!options.reducedMotion) {
    adapter.addListener('wheel', onWheel, { passive: true });
    adapter.addListener('touchstart', onTouchStart, { passive: true });
    adapter.addListener('touchmove', onTouchMove, { passive: true });
    adapter.addListener('touchend', onTouchEnd, { passive: true });
    adapter.addListener('touchcancel', onTouchEnd, { passive: true });
    adapter.addListener('keydown', onKeyDown, { passive: true });
    adapter.addListener('scroll', onScroll, { passive: true });
  }

  const animateScrollTo = (targetY: number, durationMs: number, easingKind: ScrollEasingKind) => {
    cancelActiveTween();
    const startY = adapter.getViewport().scrollY;
    const distance = targetY - startY;
    if (Math.abs(distance) < MIN_MEANINGFUL_SCROLL_PX || durationMs <= 0) {
      setState('settled');
      return;
    }

    const startTime = adapter.now();
    lastProgrammaticScrollY = startY;
    setState('following');

    const step = (frameNow: number) => {
      if (cleanedUp || paused || completed || manualInterrupted) {
        activeRafId = null;
        lastProgrammaticScrollY = null;
        return;
      }

      const elapsed = Math.max(0, frameNow - startTime);
      const rawProgress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      const eased = easeCinematicScroll(rawProgress, easingKind);
      const nextY = Math.round(startY + distance * eased);

      lastProgrammaticScrollY = nextY;
      adapter.scrollToY(nextY);

      if (rawProgress < 1) {
        activeRafId = adapter.requestFrame(step);
      } else {
        activeRafId = null;
        lastProgrammaticScrollY = null;
        setState('settled');
      }
    };

    activeRafId = adapter.requestFrame(step);
  };

  const evaluateAndFollow = (
    memberIndex: number,
    spec: MemberRevealSpec,
    hasDesignation: boolean,
    isRecheck: boolean,
  ): ScrollTargetDecision => {
    const viewport = adapter.getViewport();
    const cardEl = options.getCardElement(spec.code);

    if (options.reducedMotion) {
      setState('reduced-motion');
      return {
        shouldScroll: false,
        targetY: viewport.scrollY,
        durationMs: 0,
        reason: 'already-visible',
      };
    }

    if (cleanedUp || completed || paused || !cardEl) {
      return {
        shouldScroll: false,
        targetY: viewport.scrollY,
        durationMs: 0,
        reason: 'already-visible',
      };
    }

    // Prevent duplicate scroll choreography on the same member unless layout genuinely shifted
    if (!isRecheck && lastScrolledMemberIndex === memberIndex) {
      return {
        shouldScroll: false,
        targetY: viewport.scrollY,
        durationMs: 0,
        reason: 'already-visible',
      };
    }

    // Respect user's manual scrolling interruption until quiet window passes on a later member
    if (manualInterrupted) {
      const stillInSameMember = memberIndex === interruptedAtMemberIndex;
      const recentlyInteracted = adapter.now() - lastManualGestureAt < MANUAL_RESUME_QUIET_MS;
      if (stillInSameMember || isTouchActive || recentlyInteracted || isRecheck) {
        return {
          shouldScroll: false,
          targetY: viewport.scrollY,
          durationMs: 0,
          reason: 'already-visible',
        };
      }
      // Viewer stopped scrolling and a new member is beginning: allow polite resume
      manualInterrupted = false;
      interruptedAtMemberIndex = -1;
    }

    const cardBox = measureLayoutBox(cardEl);
    let rowGroupBox: ScrollLayoutBox | null = null;
    const rowElements = options.getRowGroupElements?.(spec.code, viewport.width) ?? [];
    if (rowElements.length > 1) {
      const boxes = rowElements.map(measureLayoutBox);
      const top = Math.min(...boxes.map((b) => b.top));
      const bottom = Math.max(...boxes.map((b) => b.bottom));
      const left = Math.min(...boxes.map((b) => b.left));
      const right = Math.max(...boxes.map((b) => b.right));
      rowGroupBox = { top, bottom, height: bottom - top, left, right, width: right - left };
    }

    const decision = computeCinematicScrollTarget({
      memberIndex,
      spec,
      hasDesignation,
      cardBox,
      rowGroupBox,
      viewport,
    });

    if (!isRecheck) {
      lastScrolledMemberIndex = memberIndex;
    }

    if (decision.shouldScroll) {
      const easingKind = CONCEPT_EASING[spec.concept];
      animateScrollTo(decision.targetY, decision.durationMs, easingKind);
    } else if (activeRafId === null && state !== 'interrupted-by-user') {
      setState('settled');
    }

    return decision;
  };

  return {
    followMember(memberIndex: number, spec: MemberRevealSpec, hasDesignation: boolean) {
      activeMemberIndex = memberIndex;
      activeSpec = spec;
      activeHasDesignation = hasDesignation;
      return evaluateAndFollow(memberIndex, spec, hasDesignation, false);
    },

    recheckLayout() {
      if (cleanedUp || completed || paused || options.reducedMotion) return;
      if (activeMemberIndex < 0 || !activeSpec) return;
      evaluateAndFollow(activeMemberIndex, activeSpec, activeHasDesignation, true);
    },

    setPaused(nextPaused: boolean) {
      if (cleanedUp || completed || options.reducedMotion || paused === nextPaused) return;
      paused = nextPaused;
      if (paused) {
        cancelActiveTween();
        setState('paused');
      } else if (activeMemberIndex >= 0 && activeSpec && !manualInterrupted) {
        evaluateAndFollow(activeMemberIndex, activeSpec, activeHasDesignation, true);
      } else if (!manualInterrupted) {
        setState('idle');
      }
    },

    markSequenceComplete() {
      if (cleanedUp || completed) return;
      completed = true;
      cancelActiveTween();
      // Release manual scroll override cleanly and leave user strictly in charge
      if (!options.reducedMotion) {
        adapter.removeListener('wheel', onWheel);
        adapter.removeListener('touchstart', onTouchStart);
        adapter.removeListener('touchmove', onTouchMove);
        adapter.removeListener('touchend', onTouchEnd);
        adapter.removeListener('touchcancel', onTouchEnd);
        adapter.removeListener('keydown', onKeyDown);
        adapter.removeListener('scroll', onScroll);
      }
      setState(options.reducedMotion ? 'reduced-motion' : 'complete');
    },

    getState: () => state,

    cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      cancelActiveTween();
      if (!options.reducedMotion) {
        adapter.removeListener('wheel', onWheel);
        adapter.removeListener('touchstart', onTouchStart);
        adapter.removeListener('touchmove', onTouchMove);
        adapter.removeListener('touchend', onTouchEnd);
        adapter.removeListener('touchcancel', onTouchEnd);
        adapter.removeListener('keydown', onKeyDown);
        adapter.removeListener('scroll', onScroll);
      }
    },
  };
}
