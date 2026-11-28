import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MANUAL_RESUME_QUIET_MS,
  computeCinematicScrollTarget,
  computeScrollDurationMs,
  createCinematicScrollDirector,
  easeCinematicScroll,
  type ScrollEnvironmentAdapter,
  type ScrollLayoutBox,
  type ScrollViewportMetrics,
} from '../src/lib/cinematicScrollDirector.ts';
import { MEMBER_CINEMATIC_SEQUENCE } from '../src/lib/memberCinematicDirector.ts';

function box(top: number, height: number, left = 24, width = 320): ScrollLayoutBox {
  return { top, bottom: top + height, height, left, right: left + width, width };
}

function createFakeScrollHarness(initialViewport: ScrollViewportMetrics) {
  let now = 0;
  let nextRafId = 1;
  let viewport = { ...initialViewport };
  const scrolledYHistory: number[] = [];
  const listeners = new Map<string, Set<EventListener>>();
  const rafQueue = new Map<number, (time: number) => void>();

  const adapter: ScrollEnvironmentAdapter = {
    getViewport: () => ({ ...viewport }),
    scrollToY: (y) => {
      viewport.scrollY = y;
      scrolledYHistory.push(y);
    },
    requestFrame: (cb) => {
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    },
    cancelFrame: (id) => {
      rafQueue.delete(id);
    },
    now: () => now,
    addListener: (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
    removeListener: (type, handler) => {
      listeners.get(type)?.delete(handler);
    },
  };

  const stepFrame = (deltaMs: number) => {
    now += deltaMs;
    const batch = Array.from(rafQueue.entries());
    rafQueue.clear();
    for (const [, cb] of batch) {
      cb(now);
    }
  };

  const emitEvent = (type: string, payload: Partial<KeyboardEvent> = {}) => {
    const handlers = Array.from(listeners.get(type) ?? []);
    for (const handler of handlers) {
      handler(payload as Event);
    }
  };

  const listenerCount = () => {
    let total = 0;
    for (const set of listeners.values()) total += set.size;
    return total;
  };

  return {
    adapter,
    viewport: () => ({ ...viewport }),
    setScrollY: (y: number) => {
      viewport.scrollY = y;
    },
    stepFrame,
    advanceTime: (ms: number) => {
      now += ms;
    },
    emitEvent,
    scrolledYHistory,
    activeRafCount: () => rafQueue.size,
    listenerCount,
  };
}

test('computeCinematicScrollTarget keeps desktop flagship row cohesive without unnecessary jumps', () => {
  const viewport: ScrollViewportMetrics = { width: 1440, height: 900, scrollY: 0, scrollHeight: 900 };
  const row1Group = box(330, 152, 100, 1240);

  for (let i = 0; i < 3; i += 1) {
    const spec = MEMBER_CINEMATIC_SEQUENCE[i];
    const decision = computeCinematicScrollTarget({
      memberIndex: i,
      spec,
      hasDesignation: true,
      cardBox: box(330, 152, 100 + i * 410, 390),
      rowGroupBox: row1Group,
      viewport,
    });
    assert.equal(decision.shouldScroll, false, `Desktop flagship ${spec.code} should not scroll when Row 1 fits`);
  }
});

test('desktop short viewport transitions cleanly from Row 1 to Row 2 once without micro-jumping', () => {
  const viewport: ScrollViewportMetrics = { width: 1280, height: 700, scrollY: 0, scrollHeight: 940 };
  const row1Group = box(360, 152, 60, 1160);
  const row2Group = box(590, 114, 60, 1160);

  // Row 1 stays comfortably visible at scrollY = 0
  for (let i = 0; i < 3; i += 1) {
    const d1 = computeCinematicScrollTarget({
      memberIndex: i,
      spec: MEMBER_CINEMATIC_SEQUENCE[i],
      hasDesignation: true,
      cardBox: box(360, 152, 60 + i * 380, 360),
      rowGroupBox: row1Group,
      viewport,
    });
    assert.equal(d1.shouldScroll, false);
  }

  // Row 2 overflows bottom -> computes smooth pan into Row 2, bounded cleanly within [0, 240]
  const row2Decision = computeCinematicScrollTarget({
    memberIndex: 3,
    spec: MEMBER_CINEMATIC_SEQUENCE[3],
    hasDesignation: false,
    cardBox: box(590, 114, 60, 220),
    rowGroupBox: row2Group,
    viewport,
  });
  assert.equal(row2Decision.shouldScroll, true);
  assert.ok(row2Decision.targetY > 0 && row2Decision.targetY <= 240);

  // After viewport lands on targetY, members 05-08 in Row 2 require zero additional scroll
  const settledViewport = { ...viewport, scrollY: row2Decision.targetY };
  for (let i = 4; i < 8; i += 1) {
    const peerDecision = computeCinematicScrollTarget({
      memberIndex: i,
      spec: MEMBER_CINEMATIC_SEQUENCE[i],
      hasDesignation: false,
      cardBox: box(590, 114, 60 + (i - 3) * 230, 220),
      rowGroupBox: row2Group,
      viewport: settledViewport,
    });
    assert.equal(peerDecision.shouldScroll, false, `Row 2 peer ${i + 1} should not re-scroll after Row 2 is framed`);
  }
});

test('mobile and narrow mobile reserve headroom for 3D designation tags and clamp within scroll boundaries', () => {
  const mobileViewport: ScrollViewportMetrics = { width: 390, height: 844, scrollY: 0, scrollHeight: 1580 };
  const abhirupBox = box(410, 108, 18, 354);
  const khushiBox = box(1090, 94, 100, 185);

  const abhirupDecision = computeCinematicScrollTarget({
    memberIndex: 1,
    spec: MEMBER_CINEMATIC_SEQUENCE[1],
    hasDesignation: true,
    cardBox: abhirupBox,
    viewport: mobileViewport,
  });
  // Fits cleanly inside 844px at y=0, no unnecessary scroll yet
  assert.equal(abhirupDecision.shouldScroll, false);

  // Narrow mobile puts 08 Khushi way below fold -> frames smoothly without exceeding maxScrollY (1580 - 780 = 800)
  const narrowViewport: ScrollViewportMetrics = { width: 360, height: 780, scrollY: 0, scrollHeight: 1580 };
  const khushiNarrow = computeCinematicScrollTarget({
    memberIndex: 7,
    spec: MEMBER_CINEMATIC_SEQUENCE[7],
    hasDesignation: false,
    cardBox: khushiBox,
    viewport: narrowViewport,
  });
  assert.equal(khushiNarrow.shouldScroll, true);
  assert.ok(khushiNarrow.targetY <= narrowViewport.scrollHeight - narrowViewport.height);
  assert.ok(khushiBox.top - 10 - khushiNarrow.targetY >= 26, 'Card top must stay clear of top viewport edge');
  assert.ok(khushiBox.bottom + 14 - khushiNarrow.targetY <= narrowViewport.height - 32, 'Card bottom must stay clear of bottom edge');

  // With designation tag at tight top margin, visualTop accounts for 28px floating 3D badge headroom
  const tagCard = box(920, 108, 18, 324);
  const tagDecision = computeCinematicScrollTarget({
    memberIndex: 2,
    spec: MEMBER_CINEMATIC_SEQUENCE[2],
    hasDesignation: true,
    cardBox: tagCard,
    viewport: narrowViewport,
  });
  assert.equal(tagDecision.shouldScroll, true);
  assert.ok(tagCard.top - 28 - tagDecision.targetY >= 26, 'Floating TECH LEADER badge must remain comfortably inside viewport');
});

test('CinematicScrollDirector coordinates easing, prevents duplicates, handles manual interruption & polite resume, and stops after member 08', () => {
  const harness = createFakeScrollHarness({ width: 360, height: 780, scrollY: 0, scrollHeight: 1920 });
  const cardTops: Record<string, number> = {
    '01': 260,
    '02': 410,
    '03': 560,
    '04': 710,
    '05': 880,
    '06': 1060,
    '07': 1240,
    '08': 1420,
  };

  const fakeCards = new Map<string, HTMLElement>();
  for (const [code, top] of Object.entries(cardTops)) {
    fakeCards.set(code, {
      offsetTop: top,
      offsetLeft: 18,
      offsetWidth: 324,
      offsetHeight: 95,
      offsetParent: null,
    } as unknown as HTMLElement);
  }

  const director = createCinematicScrollDirector({
    reducedMotion: false,
    getCardElement: (code) => fakeCards.get(code) ?? null,
    adapter: harness.adapter,
  });

  // Member 05 overflows 780px viewport -> smoothly begins following
  const d5 = director.followMember(4, MEMBER_CINEMATIC_SEQUENCE[4], false);
  assert.equal(d5.shouldScroll, true);
  assert.equal(director.getState(), 'following');

  // Duplicate call for same active member 05 is ignored
  const dup5 = director.followMember(4, MEMBER_CINEMATIC_SEQUENCE[4], false);
  assert.equal(dup5.shouldScroll, false);

  // Advance two animation frames smoothly
  harness.stepFrame(180);
  harness.stepFrame(180);
  assert.ok(harness.viewport().scrollY > 0 && harness.viewport().scrollY < d5.targetY);

  // User manually scrolls with mouse wheel -> cancels active scroll immediately without snapping back
  const userY = Math.max(0, harness.viewport().scrollY - 60);
  harness.setScrollY(userY);
  harness.emitEvent('wheel');
  assert.equal(director.getState(), 'interrupted-by-user');
  assert.equal(harness.activeRafCount(), 0);
  assert.equal(harness.viewport().scrollY, userY, 'User scroll position must never snap back');

  // Advancing frame must not move viewport after manual interruption
  harness.stepFrame(200);
  assert.equal(harness.viewport().scrollY, userY);

  // Next member arrives too soon during active manual interaction -> director politely yields
  harness.advanceTime(400);
  const d6DuringOverride = director.followMember(5, MEMBER_CINEMATIC_SEQUENCE[5], false);
  assert.equal(d6DuringOverride.shouldScroll, false);
  assert.equal(director.getState(), 'interrupted-by-user');

  // After manual quiet window expires and member 08 begins, auto-follow resumes cleanly
  harness.advanceTime(MANUAL_RESUME_QUIET_MS + 100);
  const d8 = director.followMember(7, MEMBER_CINEMATIC_SEQUENCE[7], false);
  assert.equal(d8.shouldScroll, true);
  assert.equal(director.getState(), 'following');

  // Completing sequence detaches listeners and stops following cleanly without jumping to top
  const beforeCompleteY = harness.viewport().scrollY;
  director.markSequenceComplete();
  assert.equal(director.getState(), 'complete');
  assert.equal(harness.activeRafCount(), 0);
  assert.equal(harness.listenerCount(), 0);
  assert.equal(harness.viewport().scrollY, beforeCompleteY);
});

test('reducedMotion disables auto-scrolling completely and cleanup detaches all listeners', () => {
  const harness = createFakeScrollHarness({ width: 390, height: 844, scrollY: 0, scrollHeight: 1600 });
  const fakeCard = {
    offsetTop: 1120,
    offsetLeft: 18,
    offsetWidth: 354,
    offsetHeight: 100,
    offsetParent: null,
  } as unknown as HTMLElement;

  const reducedDirector = createCinematicScrollDirector({
    reducedMotion: true,
    getCardElement: () => fakeCard,
    adapter: harness.adapter,
  });

  assert.equal(reducedDirector.getState(), 'reduced-motion');
  assert.equal(harness.listenerCount(), 0);
  const decision = reducedDirector.followMember(7, MEMBER_CINEMATIC_SEQUENCE[7], false);
  assert.equal(decision.shouldScroll, false);
  assert.equal(harness.scrolledYHistory.length, 0);

  // Normal director cleanup verifies zero leaked listeners/rAFs
  const normalDirector = createCinematicScrollDirector({
    reducedMotion: false,
    getCardElement: () => fakeCard,
    adapter: harness.adapter,
  });
  assert.ok(harness.listenerCount() > 0);
  normalDirector.followMember(7, MEMBER_CINEMATIC_SEQUENCE[7], false);
  assert.ok(harness.activeRafCount() > 0);
  normalDirector.cleanup();
  assert.equal(harness.activeRafCount(), 0);
  assert.equal(harness.listenerCount(), 0);
});

test('easing curves remain monotonic and scroll durations respect reveal alignment window', () => {
  for (const kind of ['precision', 'royal', 'orbital', 'silk'] as const) {
    assert.equal(easeCinematicScroll(0, kind), 0);
    assert.equal(easeCinematicScroll(1, kind), 1);
    let prev = 0;
    for (let step = 1; step <= 10; step += 1) {
      const value = easeCinematicScroll(step / 10, kind);
      assert.ok(value >= prev && value <= 1);
      prev = value;
    }
  }

  for (const spec of MEMBER_CINEMATIC_SEQUENCE) {
    const dur = computeScrollDurationMs(260, spec);
    assert.ok(dur >= 440 && dur <= spec.durationMs, `Duration ${dur}ms must fit comfortably inside ${spec.code} (${spec.durationMs}ms)`);
  }
});
