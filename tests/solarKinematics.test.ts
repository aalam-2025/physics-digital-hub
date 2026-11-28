import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRenderProfile, computeSunPosition, computeTrackerAngles } from '../src/lib/solarKinematics';

test('computeSunPosition stays elevated above the tracker horizon', () => {
  for (let i = 0; i < 20; i += 1) {
    const pos = computeSunPosition(i * 0.4);
    assert.ok(pos.y > 2.0, `Expected sun y > 2.0, got ${pos.y}`);
    assert.ok(pos.z > 0.5, `Expected sun z > 0.5, got ${pos.z}`);
  }
});

test('computeTrackerAngles tracks east/west azimuth and clamps elevation safely', () => {
  const east = computeTrackerAngles({ x: 4, y: 3.5, z: 3 });
  const west = computeTrackerAngles({ x: -4, y: 3.5, z: 3 });
  assert.ok(east.azimuthRad > 0.4, 'Positive X sun should produce positive azimuth');
  assert.ok(west.azimuthRad < -0.4, 'Negative X sun should produce negative azimuth');
  assert.ok(east.elevationRad >= 0.18 && east.elevationRad <= 1.12);

  const highNoon = computeTrackerAngles({ x: 0, y: 12, z: 0.2 });
  const lowHorizon = computeTrackerAngles({ x: 0, y: 0.5, z: 12 });
  assert.ok(lowHorizon.elevationRad > highNoon.elevationRad, 'Lower sun requires steeper panel tilt');
});

test('computeRenderProfile clamps resolution on Android/coarse mobile and software WebGL', () => {
  const software = computeRenderProfile({
    isSoftwareGl: true,
    isCoarsePointer: false,
    devicePixelRatio: 3,
    viewportWidth: 1440,
  });
  assert.equal(software.pixelRatio, 1);
  assert.equal(software.shadows, false);
  assert.equal(software.paceWithAfterDraw, true);

  const androidPhone = computeRenderProfile({
    isSoftwareGl: false,
    isCoarsePointer: true,
    devicePixelRatio: 3,
    viewportWidth: 390,
    hardwareConcurrency: 4,
  });
  assert.equal(androidPhone.pixelRatio, 1.5);
  assert.equal(androidPhone.shadows, false);
  assert.equal(androidPhone.enableDriftParticles, false);

  const desktop = computeRenderProfile({
    isSoftwareGl: false,
    isCoarsePointer: false,
    devicePixelRatio: 2.5,
    viewportWidth: 1440,
    hardwareConcurrency: 12,
  });
  assert.equal(desktop.pixelRatio, 2);
  assert.equal(desktop.shadows, true);
  assert.equal(desktop.shadowMapSize, 1024);
});
