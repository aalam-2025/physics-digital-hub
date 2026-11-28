import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_SCREEN_ADVANCE_ENABLED,
  WELCOME_GUIDANCE_DELAY_MS,
  computeGuidancePlacement,
  createWelcomeGuidanceScheduler,
  detectGuidanceInputMode,
  getWelcomeGuidanceMessage,
  rectsIntersect,
  resolveNextScreenOnAction,
  type LayoutRect,
  type TimerAdapter,
} from '../src/lib/welcomeGuidance.ts';

function createFakeTimerHarness() {
  let nextHandle = 1;
  const tasks = new Map<number, { callback: () => void; ms: number; cleared: boolean }>();

  const timers: TimerAdapter = {
    setTimeoutFn(callback, ms) {
      const id = nextHandle++;
      tasks.set(id, { callback, ms, cleared: false });
      return id;
    },
    clearTimeoutFn(handle) {
      const entry = tasks.get(handle);
      if (entry) entry.cleared = true;
    },
  };

  const activeCount = () => Array.from(tasks.values()).filter((task) => !task.cleared).length;
  const flushNext = () => {
    for (const [id, task] of tasks.entries()) {
      if (!task.cleared) {
        task.cleared = true;
        tasks.delete(id);
        task.callback();
        return task.ms;
      }
    }
    return null;
  };

  return { timers, tasks, activeCount, flushNext };
}

function rect(left: number, top: number, width: number, height: number): LayoutRect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

test('guidance cloud appears strictly after 5,000 ms delay', () => {
  assert.equal(WELCOME_GUIDANCE_DELAY_MS, 5000);
  const harness = createFakeTimerHarness();
  const reveals: boolean[] = [];
  const scheduler = createWelcomeGuidanceScheduler((visible) => reveals.push(visible), WELCOME_GUIDANCE_DELAY_MS, harness.timers);

  assert.deepEqual(scheduler.getState(), { visible: false, dismissed: false, pending: false });
  assert.equal(scheduler.start(), true);
  assert.equal(harness.activeCount(), 1);
  assert.deepEqual(scheduler.getState(), { visible: false, dismissed: false, pending: true });
  assert.deepEqual(reveals, []);

  const firedDelay = harness.flushNext();
  assert.equal(firedDelay, 5000);
  assert.deepEqual(reveals, [true]);
  assert.deepEqual(scheduler.getState(), { visible: true, dismissed: false, pending: false });
});

test('guidance timer cancels cleanly on manual navigation or unmount cleanup', () => {
  const harness = createFakeTimerHarness();
  const reveals: boolean[] = [];
  const scheduler = createWelcomeGuidanceScheduler((visible) => reveals.push(visible), 5000, harness.timers);

  scheduler.start();
  assert.equal(harness.activeCount(), 1);
  scheduler.cleanup();
  assert.equal(harness.activeCount(), 0);
  assert.equal(harness.flushNext(), null);
  assert.deepEqual(reveals, []);

  // Re-entering Welcome Screen starts fresh cleanly, and manual dismiss cancels pending reveal
  const freshScheduler = createWelcomeGuidanceScheduler((visible) => reveals.push(visible), 5000, harness.timers);
  freshScheduler.start();
  assert.equal(harness.activeCount(), 1);
  freshScheduler.dismiss();
  assert.equal(harness.activeCount(), 0);
  assert.equal(freshScheduler.getState().dismissed, true);
  assert.equal(harness.flushNext(), null);
  assert.deepEqual(reveals, []);
});

test('automatic screen switching is disabled across Welcome, Team Showcase, and Video screens', () => {
  assert.equal(AUTO_SCREEN_ADVANCE_ENABLED, false);
  assert.equal(resolveNextScreenOnAction('welcome', 'timer-elapsed'), 'welcome');
  assert.equal(resolveNextScreenOnAction('members', 'timer-elapsed'), 'members');
  assert.equal(resolveNextScreenOnAction('video', 'timer-elapsed'), 'video');
  assert.equal(resolveNextScreenOnAction('video', 'video-ended'), 'video');
});

test('manual navigation transitions preserve strict user-initiated progression', () => {
  assert.equal(resolveNextScreenOnAction('welcome', 'manual-meet-team'), 'members');
  assert.equal(resolveNextScreenOnAction('members', 'manual-watch-explanation'), 'video');
  assert.equal(resolveNextScreenOnAction('video', 'manual-meet-team'), 'video');
});

test('desktop mouse and mobile touch guidance copy variants follow device capability', () => {
  assert.equal(detectGuidanceInputMode(false, 1440), 'desktop');
  assert.equal(detectGuidanceInputMode(true, 1440), 'touch');
  assert.equal(detectGuidanceInputMode(false, 390), 'touch');
  assert.equal(detectGuidanceInputMode(false, 768), 'desktop');

  assert.equal(
    getWelcomeGuidanceMessage('desktop'),
    'Ready to explore? Click MEET THE TEAM to continue!',
  );
  assert.equal(
    getWelcomeGuidanceMessage('touch'),
    'Ready to explore? Tap MEET THE TEAM to continue!',
  );
});

test('activating MEET THE TEAM dismisses visible guidance permanently for that visit', () => {
  const harness = createFakeTimerHarness();
  const reveals: boolean[] = [];
  const scheduler = createWelcomeGuidanceScheduler((visible) => reveals.push(visible), 5000, harness.timers);

  scheduler.start();
  harness.flushNext();
  assert.deepEqual(reveals, [true]);

  scheduler.dismiss();
  assert.deepEqual(reveals, [true, false]);
  assert.deepEqual(scheduler.getState(), { visible: false, dismissed: true, pending: false });
  assert.equal(scheduler.start(), false);
  assert.equal(harness.activeCount(), 0);
});

test('repeated start calls cannot schedule duplicate guidance timers', () => {
  const harness = createFakeTimerHarness();
  const scheduler = createWelcomeGuidanceScheduler(() => undefined, 5000, harness.timers);

  assert.equal(scheduler.start(), true);
  assert.equal(scheduler.start(), false);
  assert.equal(scheduler.start(), false);
  assert.equal(harness.activeCount(), 1);
});

test('responsive placement avoids overlapping 3D Solar Tracker across desktop, tablet, and mobile', () => {
  const desktop = computeGuidancePlacement({
    viewportWidth: 1440,
    viewportHeight: 900,
    copyRect: rect(72, 180, 620, 480),
    buttonRect: rect(72, 560, 204, 50),
    artRect: rect(720, 140, 640, 520),
    footerRect: rect(72, 850, 1296, 20),
  });
  assert.equal(desktop.placement, 'right');
  assert.ok(desktop.maxWidth >= 236 && desktop.maxWidth <= 340);

  const tablet = computeGuidancePlacement({
    viewportWidth: 768,
    viewportHeight: 1024,
    copyRect: rect(38, 170, 331, 480),
    buttonRect: rect(38, 560, 204, 50),
    artRect: rect(399, 200, 331, 440),
    footerRect: rect(38, 980, 692, 20),
  });
  assert.equal(tablet.placement, 'below');

  const mobile = computeGuidancePlacement({
    viewportWidth: 390,
    viewportHeight: 844,
    copyRect: rect(18, 80, 354, 340),
    buttonRect: rect(18, 350, 198, 46),
    artRect: rect(18, 440, 354, 275),
    footerRect: rect(18, 790, 354, 20),
  });
  assert.equal(mobile.placement, 'below');
  assert.equal(mobile.compact, true);

  assert.equal(rectsIntersect(rect(72, 550, 290, 62), rect(720, 140, 640, 520), 12), false);
  assert.equal(rectsIntersect(rect(18, 410, 330, 56), rect(18, 490, 354, 275), 12), false);
});
