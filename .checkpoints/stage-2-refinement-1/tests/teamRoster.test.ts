import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCardRevealTiming,
  getMemberDesignation,
  getMemberIdentityProfile,
} from '../src/lib/teamRoster';

test('getMemberDesignation assigns exact three floating 3D tags and leaves 04-08 clean', () => {
  const aman = getMemberDesignation('01');
  const abhirup = getMemberDesignation('02');
  const anik = getMemberDesignation('03');

  assert.equal(aman?.kind, 'tech-leader');
  assert.equal(aman?.label, 'TECH LEADER');
  assert.equal(aman?.accentVariant, 'electric-silver');

  assert.equal(abhirup?.kind, 'project-leader');
  assert.equal(abhirup?.label, 'PROJECT LEADER');
  assert.equal(abhirup?.accentVariant, 'solar-platinum');

  assert.equal(anik?.kind, 'tech-leader');
  assert.equal(anik?.label, 'TECH LEADER');
  assert.equal(anik?.accentVariant, 'electric-silver');
  assert.notEqual(aman?.entranceDelayMs, anik?.entranceDelayMs, 'Tech Leader tags should enter independently');

  for (const code of ['04', '05', '06', '07', '08']) {
    assert.equal(getMemberDesignation(code), null, `Member ${code} should not receive a leadership tag`);
  }
});

test('getMemberIdentityProfile distinguishes the three flagship cards cleanly from 04-08', () => {
  const aman = getMemberIdentityProfile('01');
  const abhirup = getMemberIdentityProfile('02');
  const anik = getMemberIdentityProfile('03');

  assert.equal(aman.tier, 'flagship');
  assert.equal(aman.variant, 'aman-tech-crown');

  assert.equal(abhirup.tier, 'flagship');
  assert.equal(abhirup.variant, 'abhirup-project-crown');
  assert.ok(abhirup.extrusionDepthPx >= aman.extrusionDepthPx);

  assert.equal(anik.tier, 'flagship');
  assert.equal(anik.variant, 'anik-tech-crown');
  assert.notEqual(aman.variant, anik.variant, 'Aman and Anik should share Tech Leader tier with individual distinction');

  for (const code of ['04', '05', '06', '07', '08']) {
    const profile = getMemberIdentityProfile(code);
    assert.equal(profile.tier, 'standard');
    assert.equal(profile.variant, 'standard-platinum');
    assert.ok(profile.extrusionDepthPx < aman.extrusionDepthPx);
  }
});

test('getCardRevealTiming completes all eight card entrances inside the 5-second reading window', () => {
  for (let i = 0; i < 8; i += 1) {
    const timing = getCardRevealTiming(i);
    assert.equal(timing.cardDelayMs, i * 300);
    assert.ok(timing.nameDelayMs > timing.cardDelayMs);
    assert.ok(timing.sheenDelayMs <= 2600, `Expected card ${i} sheen to trigger early inside 5000ms window`);
  }
});
