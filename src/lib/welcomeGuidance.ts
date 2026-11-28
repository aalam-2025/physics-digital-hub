export const WELCOME_GUIDANCE_DELAY_MS = 5000;
export const AUTO_SCREEN_ADVANCE_ENABLED = false;

export type PublicScreen = 'welcome' | 'members' | 'video';
export type GuidanceInputMode = 'desktop' | 'touch';
export type GuidancePlacement = 'right' | 'below';

export interface LayoutRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface GuidanceLayoutInput {
  viewportWidth: number;
  viewportHeight: number;
  copyRect: LayoutRect;
  buttonRect: LayoutRect;
  artRect: LayoutRect | null;
  footerRect: LayoutRect | null;
}

export interface GuidancePlacementResult {
  placement: GuidancePlacement;
  maxWidth: number;
  compact: boolean;
}

export interface GuidanceSchedulerState {
  visible: boolean;
  dismissed: boolean;
  pending: boolean;
}

export interface GuidanceScheduler {
  start: () => boolean;
  dismiss: () => void;
  cleanup: () => void;
  getState: () => GuidanceSchedulerState;
}

export interface TimerAdapter {
  setTimeoutFn: (callback: () => void, ms: number) => number;
  clearTimeoutFn: (handle: number) => void;
}

const DEFAULT_TIMER_ADAPTER: TimerAdapter = {
  setTimeoutFn: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeoutFn: (handle) => window.clearTimeout(handle),
};

export function getWelcomeGuidanceMessage(inputMode: GuidanceInputMode): string {
  return inputMode === 'touch'
    ? 'Ready to explore? Tap MEET THE TEAM to continue!'
    : 'Ready to explore? Click MEET THE TEAM to continue!';
}

export function detectGuidanceInputMode(
  hasCoarsePointer: boolean,
  viewportWidth: number,
): GuidanceInputMode {
  return hasCoarsePointer || viewportWidth <= 760 ? 'touch' : 'desktop';
}

/**
 * Pure presentation transition guard: automatic screen switching is permanently
 * disabled so visitors advance exclusively via manual controls.
 */
export function resolveNextScreenOnAction(
  current: PublicScreen,
  action: 'manual-meet-team' | 'manual-watch-explanation' | 'timer-elapsed' | 'video-ended',
): PublicScreen {
  if (action === 'manual-meet-team' && current === 'welcome') {
    return 'members';
  }
  if (action === 'manual-watch-explanation' && current === 'members') {
    return 'video';
  }
  return current;
}

/**
 * Checks whether two bounding boxes overlap within an optional safety margin.
 */
export function rectsIntersect(a: LayoutRect, b: LayoutRect, marginPx = 4): boolean {
  return (
    a.left < b.right + marginPx &&
    a.right > b.left - marginPx &&
    a.top < b.bottom + marginPx &&
    a.bottom > b.top - marginPx
  );
}

/**
 * Computes responsive, overlap-free guidance cloud placement using real element
 * measurements so the callout never encroaches on the 3D Solar Tracker, heading,
 * button, or bottom stage bar.
 */
export function computeGuidancePlacement(input: GuidanceLayoutInput): GuidancePlacementResult {
  const gapPx = 18;
  const artSafetyGap = 24;
  const artLeftBound = input.artRect ? input.artRect.left - artSafetyGap : input.viewportWidth - 24;
  const rightUpperBound = Math.min(input.copyRect.right, artLeftBound);
  const availableRightWidth = rightUpperBound - (input.buttonRect.right + gapPx);
  const compact = input.viewportWidth <= 420 || input.viewportHeight <= 700;

  if (input.viewportWidth >= 980 && availableRightWidth >= 236) {
    return {
      placement: 'right',
      maxWidth: Math.min(340, Math.floor(availableRightWidth)),
      compact,
    };
  }

  const maxBelowWidth = Math.max(
    220,
    Math.min(360, Math.floor(input.copyRect.width)),
  );
  return {
    placement: 'below',
    maxWidth: maxBelowWidth,
    compact,
  };
}

/**
 * Deterministic 5-second visual hint scheduler for Screen 01 only.
 * Guarantees no duplicate timers, immediate cancellation on activation/unmount,
 * and zero automatic screen transitions.
 */
export function createWelcomeGuidanceScheduler(
  onRevealChange: (visible: boolean) => void,
  delayMs = WELCOME_GUIDANCE_DELAY_MS,
  timers: TimerAdapter = DEFAULT_TIMER_ADAPTER,
): GuidanceScheduler {
  let timerId: number | null = null;
  let visible = false;
  let dismissed = false;

  const clearPendingTimer = () => {
    if (timerId !== null) {
      timers.clearTimeoutFn(timerId);
      timerId = null;
    }
  };

  return {
    start() {
      if (dismissed || visible || timerId !== null) {
        return false;
      }
      timerId = timers.setTimeoutFn(() => {
        timerId = null;
        if (dismissed) return;
        visible = true;
        onRevealChange(true);
      }, delayMs);
      return true;
    },
    dismiss() {
      clearPendingTimer();
      dismissed = true;
      if (visible) {
        visible = false;
        onRevealChange(false);
      }
    },
    cleanup() {
      clearPendingTimer();
    },
    getState() {
      return {
        visible,
        dismissed,
        pending: timerId !== null,
      };
    },
  };
}
