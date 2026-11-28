import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMBER_CINEMATIC_SEQUENCE,
  createInitialSnapshot,
  createMemberCinematicDirector,
  getMemberRevealSpec,
  type CinematicDirectorSnapshot,
} from '../src/lib/memberCinematicDirector.ts';
import type { TimerAdapter } from '../src/lib/welcomeGuidance.ts';

function createDeterministicTimerHarness(initialNow = 0) {
  let now = initialNow;
  let nextId = 1;
  const scheduled = new Map<number, { dueAt: number; callback: () => void; cleared: boolean }>();

  const timers: TimerAdapter = {
    setTimeoutFn(callback, ms) {
      const id = nextId++;
      scheduled.set(id, { dueAt: now + Math.max(0, ms), callback, cleared: false });
      return id;
    },
    clearTimeoutFn(handle) {
      const item = scheduled.get(handle);
      if (item) item.cleared = true;
    },
  };

  const advanceBy = (ms: number) => {
    const target = now + ms;
    while (true) {
      let earliestId: number | null = null;
      let earliestDue = Infinity;
      for (const [id, item] of scheduled.entries()) {
        if (!item.cleared && item.dueAt <= target && item.dueAt < earliestDue) {
          earliestDue = item.dueAt;
          earliestId = id;
        }
      }
      if (earliestId === null) break;
      const item = scheduled.get(earliestId)!;
      item.cleared = true;
      scheduled.delete(earliestId);
      now = earliestDue;
      item.callback();
    }
    now = target;
  };

  const activeCount = () => Array.from(scheduled.values()).filter((item) => !item.cleared).length;

  return {
    timers,
    now: () => now,
    advanceBy,
    activeCount,
  };
}

test('sequence preserves exact eight-member order with eight distinct reveal concepts', () => {
  const expectedNames = [
    'Aman Alam',
    'Abhirup Baru',
    'Anik Ghosh',
    'Saheb Mukherjee',
    'Sandipan Mukherjee',
    'Ananya Gope',
    'Neha Kumari',
    'Khushi Rawani',
  ];

  assert.equal(MEMBER_CINEMATIC_SEQUENCE.length, 8);
  assert.deepEqual(
    MEMBER_CINEMATIC_SEQUENCE.map((item) => item.name),
    expectedNames,
  );
  assert.deepEqual(
    MEMBER_CINEMATIC_SEQUENCE.map((item) => item.code),
    ['01', '02', '03', '04', '05', '06', '07', '08'],
  );

  const uniqueConcepts = new Set(MEMBER_CINEMATIC_SEQUENCE.map((item) => item.concept));
  assert.equal(uniqueConcepts.size, 8, 'Every member must have an individual reveal concept');

  // Top three flagship concepts are completely distinct, with Abhirup crowned longest
  assert.equal(getMemberRevealSpec('01').concept, 'solar-tech-awakening');
  assert.equal(getMemberRevealSpec('02').concept, 'golden-solar-crown');
  assert.equal(getMemberRevealSpec('03').concept, 'orbital-emergence');
  assert.ok(getMemberRevealSpec('02').durationMs > getMemberRevealSpec('01').durationMs);
  assert.ok(getMemberRevealSpec('01').durationMs > getMemberRevealSpec('04').durationMs);
});

test('sequential progression introduces members one by one while keeping completed cards settled and visible', () => {
  const harness = createDeterministicTimerHarness(1000);
  const snapshots: CinematicDirectorSnapshot[] = [];
  const director = createMemberCinematicDirector(
    (snapshot) => snapshots.push(snapshot),
    MEMBER_CINEMATIC_SEQUENCE,
    harness.timers,
    harness.now,
  );

  // Initial state leaves all waiting cleanly
  const initial = createInitialSnapshot();
  assert.deepEqual(initial.phases, Array(8).fill('waiting'));
  assert.deepEqual(initial.tagVisible, Array(8).fill(false));

  // Start introduces 01 Aman Alam only
  assert.equal(director.start(), true);
  assert.equal(director.start(), false, 'Duplicate start must be ignored');

  let snap = director.getSnapshot();
  assert.equal(snap.activeIndex, 0);
  assert.equal(snap.activeConcept, 'solar-tech-awakening');
  assert.deepEqual(snap.phases, [
    'introducing',
    'waiting',
    'waiting',
    'waiting',
    'waiting',
    'waiting',
    'waiting',
    'waiting',
  ]);
  assert.equal(snap.tagVisible[0], false);

  // Aman's TECH LEADER tag unlocks at 1620ms while Aman stays introducing
  harness.advanceBy(1620);
  snap = director.getSnapshot();
  assert.equal(snap.activeIndex, 0);
  assert.equal(snap.tagVisible[0], true);

  // At 2650ms total, 01 Aman settles permanently and 02 Abhirup Baru begins Golden Solar Crown
  harness.advanceBy(1030);
  snap = director.getSnapshot();
  assert.equal(snap.activeIndex, 1);
  assert.equal(snap.activeConcept, 'golden-solar-crown');
  assert.equal(snap.phases[0], 'settled');
  assert.equal(snap.phases[1], 'introducing');
  assert.equal(snap.tagVisible[0], true);
  assert.equal(snap.tagVisible[1], false);

  // At 1820ms into Abhirup's crown reveal, PROJECT LEADER seal descends
  harness.advanceBy(1820);
  snap = director.getSnapshot();
  assert.equal(snap.tagVisible[1], true);

  // Complete Abhirup -> 03 Anik Ghosh Orbital Emergence
  harness.advanceBy(1130);
  snap = director.getSnapshot();
  assert.equal(snap.activeIndex, 2);
  assert.equal(snap.activeConcept, 'orbital-emergence');
  assert.equal(snap.phases[0], 'settled');
  assert.equal(snap.phases[1], 'settled');
  assert.equal(snap.phases[2], 'introducing');

  // Advance remaining steps cleanly through 08 Khushi Rawani finale
  harness.advanceBy(2650 + 1550 * 4 + 1850);
  snap = director.getSnapshot();
  assert.equal(snap.complete, true);
  assert.equal(snap.activeIndex, -1);
  assert.equal(snap.activeConcept, null);
  assert.deepEqual(snap.phases, Array(8).fill('settled'));
  assert.deepEqual(snap.tagVisible, [true, true, true, false, false, false, false, false]);
  assert.equal(harness.activeCount(), 0);
});

test('pause and resume preserve remaining step timing and tab visibility never corrupts state', () => {
  const harness = createDeterministicTimerHarness(500);
  const director = createMemberCinematicDirector(
    () => undefined,
    MEMBER_CINEMATIC_SEQUENCE,
    harness.timers,
    harness.now,
  );

  director.start();
  harness.advanceBy(1000);
  director.setPaused(true);
  assert.equal(director.getSnapshot().paused, true);
  assert.equal(harness.activeCount(), 0, 'Paused director clears active timers');

  // Even 30 seconds passing while hidden must not advance the active member
  harness.advanceBy(30_000);
  assert.equal(director.getSnapshot().activeIndex, 0);
  assert.equal(director.getSnapshot().tagVisible[0], false);

  director.setPaused(false);
  assert.equal(director.getSnapshot().paused, false);
  // Remaining tag offset is 620ms, remaining step duration is 1650ms
  harness.advanceBy(620);
  assert.equal(director.getSnapshot().tagVisible[0], true);
  harness.advanceBy(1030);
  assert.equal(director.getSnapshot().phases[0], 'settled');
  assert.equal(director.getSnapshot().activeIndex, 1);

  director.cleanup();
  assert.equal(harness.activeCount(), 0);
});

test('completeImmediately reveals all eight cards and exact three leader tags at once', () => {
  const harness = createDeterministicTimerHarness();
  let latest = createInitialSnapshot();
  const director = createMemberCinematicDirector(
    (snapshot) => {
      latest = snapshot;
    },
    MEMBER_CINEMATIC_SEQUENCE,
    harness.timers,
    harness.now,
  );

  director.start();
  director.completeImmediately();

  assert.equal(latest.complete, true);
  assert.equal(latest.started, true);
  assert.equal(latest.activeIndex, -1);
  assert.deepEqual(latest.phases, Array(8).fill('settled'));
  assert.deepEqual(latest.tagVisible, [true, true, true, false, false, false, false, false]);
  assert.equal(harness.activeCount(), 0);
});
