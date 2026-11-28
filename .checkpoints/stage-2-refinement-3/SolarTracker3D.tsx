import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { computeRenderProfile, computeSunPosition, computeTrackerAngles } from '../lib/solarKinematics';

export interface SolarTracker3DProps {
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onUnavailable?: () => void;
  onReady?: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createSolarCellTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
    bgGrad.addColorStop(0, '#092344');
    bgGrad.addColorStop(0.5, '#0e3666');
    bgGrad.addColorStop(1, '#081e3b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    const cols = 6;
    const rows = 10;
    const pad = 10;
    const gap = 5;
    const cellW = (512 - pad * 2 - gap * (cols - 1)) / cols;
    const cellH = (512 - pad * 2 - gap * (rows - 1)) / rows;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = pad + c * (cellW + gap);
        const y = pad + r * (cellH + gap);

        const cellGrad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
        cellGrad.addColorStop(0, '#103c73');
        cellGrad.addColorStop(0.55, '#17549a');
        cellGrad.addColorStop(1, '#0b2c57');
        ctx.fillStyle = cellGrad;
        ctx.fillRect(x, y, cellW, cellH);

        // Chamfered monocrystalline wafer corners
        ctx.fillStyle = '#d4e9f7';
        const cut = 5;
        for (const [cx, cy] of [
          [x, y],
          [x + cellW, y],
          [x, y + cellH],
          [x + cellW, y + cellH],
        ]) {
          ctx.beginPath();
          ctx.arc(cx, cy, cut * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }

        // Fine silver horizontal collector fingers
        ctx.strokeStyle = 'rgba(182, 228, 255, 0.24)';
        ctx.lineWidth = 1;
        for (let f = 1; f <= 4; f += 1) {
          const fy = y + (cellH * f) / 5;
          ctx.beginPath();
          ctx.moveTo(x + 2, fy);
          ctx.lineTo(x + cellW - 2, fy);
          ctx.stroke();
        }

        // Dual vertical busbars per cell
        ctx.fillStyle = 'rgba(218, 238, 252, 0.72)';
        ctx.fillRect(x + cellW * 0.31, y, 1.5, cellH);
        ctx.fillRect(x + cellW * 0.69, y, 1.5, cellH);
      }
    }

    // Subtle warm-gold perimeter trace
    ctx.strokeStyle = 'rgba(255, 198, 106, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 504, 504);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  texture.needsUpdate = true;
  return texture;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(2, 8, 16, 0.72)');
    grad.addColorStop(0.55, 'rgba(3, 11, 22, 0.34)');
    grad.addColorStop(1, 'rgba(3, 11, 22, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSunGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 249, 214, 1)');
    grad.addColorStop(0.28, 'rgba(255, 205, 106, 0.85)');
    grad.addColorStop(0.62, 'rgba(243, 154, 52, 0.24)');
    grad.addColorStop(1, 'rgba(243, 154, 52, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function SolarTracker3D({
  onInteractionStart,
  onInteractionEnd,
  onUnavailable,
  onReady,
}: SolarTracker3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onInteractionStart, onInteractionEnd, onUnavailable, onReady });
  callbacksRef.current = { onInteractionStart, onInteractionEnd, onUnavailable, onReady };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      callbacksRef.current.onUnavailable?.();
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL();
    const coarseQuery = window.matchMedia('(pointer: coarse)');
    const computeCurrentProfile = () =>
      computeRenderProfile({
        isSoftwareGl,
        isCoarsePointer: coarseQuery.matches,
        devicePixelRatio: window.devicePixelRatio || 1,
        viewportWidth: window.innerWidth,
        hardwareConcurrency: navigator.hardwareConcurrency,
      });

    let profile = computeCurrentProfile();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: profile.antialias,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      callbacksRef.current.onUnavailable?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(profile.pixelRatio);
    renderer.shadowMap.enabled = profile.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const width = Math.max(240, container.clientWidth || 520);
    const height = Math.max(240, container.clientHeight || 460);
    renderer.setSize(width, height, false);
    renderer.domElement.className = 'solar-tracker-3d-canvas';
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D Dual Axis Solar Tracker model');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x061322, 0.045);

    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    if (!isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envRenderTarget.texture;
      roomEnv.dispose();
      pmremGenerator.dispose();
    }

    const camera = new THREE.PerspectiveCamera(39, width / height, 0.1, 60);
    const baseCameraPos = new THREE.Vector3(2.65, 1.45, 5.0);
    camera.position.copy(baseCameraPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.22, 0);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.65;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.update();

    // Lighting rig: warm tracking Sun key + cool atmospheric sky/ground + cyan rim
    const hemiLight = new THREE.HemisphereLight(0x78e2ff, 0x091625, isSoftwareGl ? 1.25 : 0.92);
    scene.add(hemiLight);

    const sunKeyLight = new THREE.DirectionalLight(0xffd796, isSoftwareGl ? 2.9 : 2.7);
    sunKeyLight.castShadow = profile.shadows;
    sunKeyLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    sunKeyLight.shadow.camera.near = 0.5;
    sunKeyLight.shadow.camera.far = 20;
    sunKeyLight.shadow.camera.left = -2.6;
    sunKeyLight.shadow.camera.right = 2.6;
    sunKeyLight.shadow.camera.top = 2.6;
    sunKeyLight.shadow.camera.bottom = -2.6;
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.02;
    scene.add(sunKeyLight);

    const rimLight = new THREE.DirectionalLight(0x49d4ff, isSoftwareGl ? 1.2 : 0.95);
    rimLight.position.set(-4.2, 2.6, -3.5);
    scene.add(rimLight);

    if (isSoftwareGl) {
      const fillLight = new THREE.DirectionalLight(0xa3dcff, 0.72);
      fillLight.position.set(1.8, 1.4, 3.8);
      scene.add(fillLight);
    }

    // Ground & calibration platform (bottom-center grounded at floorY = -1.05)
    const floorY = -1.05;
    const trackerRoot = new THREE.Group();
    trackerRoot.position.y = floorY;
    scene.add(trackerRoot);

    // Materials library (varied roughness/metalness for believable contrast)
    const darkAnodizedMat = new THREE.MeshStandardMaterial({
      color: 0x162433,
      metalness: 0.72,
      roughness: 0.42,
    });
    const brushedAluminumMat = new THREE.MeshStandardMaterial({
      color: 0xb7cadb,
      metalness: 0.88,
      roughness: 0.24,
    });
    const solarGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf1b65a,
      metalness: 0.9,
      roughness: 0.22,
    });
    const stainlessMat = new THREE.MeshStandardMaterial({
      color: 0xe2edf7,
      metalness: 0.94,
      roughness: 0.16,
    });

    const cellTexture = createSolarCellTexture(renderer.capabilities.getMaxAnisotropy());
    const cellSurfaceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: cellTexture,
      roughness: 0.28,
      metalness: 0.35,
    });
    const temperedGlassMat = profile.shadows
      ? new THREE.MeshPhysicalMaterial({
          color: 0xbfefff,
          metalness: 0.05,
          roughness: 0.07,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xbfefff,
          metalness: 0.15,
          roughness: 0.08,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
        });
    const sensorHousingMat = new THREE.MeshStandardMaterial({
      color: 0x0d1722,
      metalness: 0.45,
      roughness: 0.62,
    });
    const sensorDomeMat = new THREE.MeshStandardMaterial({
      color: 0xffb84d,
      emissive: 0x5c3405,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.2,
    });

    // Soft radial contact shadow plane
    const contactTexture = createContactShadowTexture();
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5), contactMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.015;
    trackerRoot.add(contactShadow);

    // Subtle calibration floor ring + 36 instanced degree ticks
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x4ed7ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.155, 64), outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.022;
    trackerRoot.add(outerRing);

    const tickGeo = new THREE.BoxGeometry(0.016, 0.008, 0.065);
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0xffcb74,
      transparent: true,
      opacity: 0.48,
    });
    const tickCount = 36;
    const ticks = new THREE.InstancedMesh(tickGeo, tickMat, tickCount);
    const tickDummy = new THREE.Object3D();
    for (let i = 0; i < tickCount; i += 1) {
      const theta = (i / tickCount) * Math.PI * 2;
      const r = 1.05;
      tickDummy.position.set(Math.sin(theta) * r, 0.026, Math.cos(theta) * r);
      tickDummy.rotation.set(0, theta, 0);
      tickDummy.scale.set(1, 1, i % 3 === 0 ? 1.4 : 0.75);
      tickDummy.updateMatrix();
      ticks.setMatrixAt(i, tickDummy.matrix);
    }
    ticks.instanceMatrix.needsUpdate = true;
    ticks.computeBoundingSphere();
    trackerRoot.add(ticks);

    // Stationary Stepped Plinth (LatheGeometry)
    const plinthPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.76, 0),
      new THREE.Vector2(0.74, 0.09),
      new THREE.Vector2(0.62, 0.13),
      new THREE.Vector2(0.56, 0.22),
      new THREE.Vector2(0.32, 0.25),
      new THREE.Vector2(0.3, 0.36),
      new THREE.Vector2(0, 0.36),
    ];
    const plinthMesh = new THREE.Mesh(new THREE.LatheGeometry(plinthPoints, 48), darkAnodizedMat);
    plinthMesh.castShadow = profile.shadows;
    plinthMesh.receiveShadow = profile.shadows;
    trackerRoot.add(plinthMesh);

    const plinthGoldCollar = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.022, 16, 48), solarGoldMat);
    plinthGoldCollar.rotation.x = Math.PI / 2;
    plinthGoldCollar.position.y = 0.15;
    trackerRoot.add(plinthGoldCollar);

    // Azimuth Pivot Group (Y-axis rotation)
    const azimuthPivot = new THREE.Group();
    azimuthPivot.position.y = 0.36;
    trackerRoot.add(azimuthPivot);

    const slewRing = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.09, 36), solarGoldMat);
    slewRing.position.y = 0.045;
    slewRing.castShadow = profile.shadows;
    azimuthPivot.add(slewRing);

    const riserColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.56, 28), darkAnodizedMat);
    riserColumn.position.y = 0.36;
    riserColumn.castShadow = profile.shadows;
    azimuthPivot.add(riserColumn);

    const motorCan = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 24), brushedAluminumMat);
    motorCan.rotation.z = Math.PI / 2;
    motorCan.position.set(0.19, 0.28, 0);
    azimuthPivot.add(motorCan);

    // Twin chamfered yoke arms (ExtrudeGeometry)
    const yokeShape = new THREE.Shape();
    yokeShape.moveTo(-0.075, 0);
    yokeShape.lineTo(0.075, 0);
    yokeShape.lineTo(0.055, 0.62);
    yokeShape.lineTo(-0.055, 0.62);
    yokeShape.closePath();

    const yokeGeo = new THREE.ExtrudeGeometry(yokeShape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    yokeGeo.center();

    const yokeCrossbar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.09, 0.14), darkAnodizedMat);
    yokeCrossbar.position.y = 0.61;
    yokeCrossbar.castShadow = profile.shadows;
    azimuthPivot.add(yokeCrossbar);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(yokeGeo, brushedAluminumMat);
      arm.position.set(side * 0.52, 0.94, 0);
      arm.rotation.y = Math.PI / 2;
      arm.castShadow = profile.shadows;
      azimuthPivot.add(arm);

      const bearingCap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.09, 20), solarGoldMat);
      bearingCap.rotation.z = Math.PI / 2;
      bearingCap.position.set(side * 0.57, 1.21, 0);
      azimuthPivot.add(bearingCap);
    }

    // Actuator base bracket on azimuth riser (for plausible linkage strut)
    const actuatorAnchor = new THREE.Object3D();
    actuatorAnchor.position.set(0, 0.58, -0.14);
    azimuthPivot.add(actuatorAnchor);

    const actuatorBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.42, 16), darkAnodizedMat);
    const actuatorPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 16), stainlessMat);
    actuatorBarrel.geometry.translate(0, 0.21, 0);
    actuatorBarrel.geometry.rotateX(Math.PI / 2);
    actuatorPiston.geometry.translate(0, 0.22, 0);
    actuatorPiston.geometry.rotateX(Math.PI / 2);
    azimuthPivot.add(actuatorBarrel);
    azimuthPivot.add(actuatorPiston);

    // Elevation Pivot Group (X-axis rotation at yoke axle height)
    const elevationPivot = new THREE.Group();
    elevationPivot.position.set(0, 1.21, 0);
    azimuthPivot.add(elevationPivot);

    const axleShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.18, 20), stainlessMat);
    axleShaft.rotation.z = Math.PI / 2;
    elevationPivot.add(axleShaft);

    // Rear H-frame panel cradle
    const cradleBar = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.64), darkAnodizedMat);
    cradleBar.position.set(0, 0.03, 0);
    elevationPivot.add(cradleBar);

    const panelClevis = new THREE.Object3D();
    panelClevis.position.set(0, -0.02, -0.34);
    elevationPivot.add(panelClevis);

    // Photovoltaic Panel Assembly
    const panelWidth = 1.98;
    const panelDepth = 1.24;
    const panelThickness = 0.055;
    const panelGroup = new THREE.Group();
    panelGroup.position.set(0, 0.085, 0);
    elevationPivot.add(panelGroup);

    // Beveled frame rails
    const railH = new THREE.Mesh(new THREE.BoxGeometry(panelWidth + 0.07, panelThickness, 0.05), brushedAluminumMat);
    for (const zSign of [-1, 1]) {
      const rail = railH.clone();
      rail.position.z = zSign * (panelDepth / 2 + 0.012);
      rail.castShadow = profile.shadows;
      panelGroup.add(rail);
    }
    const railV = new THREE.Mesh(new THREE.BoxGeometry(0.05, panelThickness, panelDepth + 0.07), brushedAluminumMat);
    for (const xSign of [-1, 1]) {
      const rail = railV.clone();
      rail.position.x = xSign * (panelWidth / 2 + 0.012);
      rail.castShadow = profile.shadows;
      panelGroup.add(rail);
    }

    // Back sheet & active monocrystalline cell array
    const backSheet = new THREE.Mesh(
      new THREE.BoxGeometry(panelWidth, 0.026, panelDepth),
      darkAnodizedMat,
    );
    backSheet.castShadow = profile.shadows;
    backSheet.receiveShadow = profile.shadows;
    panelGroup.add(backSheet);

    const cellArray = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth - 0.03, panelDepth - 0.03),
      cellSurfaceMat,
    );
    cellArray.rotation.x = -Math.PI / 2;
    cellArray.position.y = 0.016;
    cellArray.receiveShadow = profile.shadows;
    panelGroup.add(cellArray);

    const temperedGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth - 0.01, panelDepth - 0.01),
      temperedGlassMat,
    );
    temperedGlass.rotation.x = -Math.PI / 2;
    temperedGlass.position.y = 0.026;
    temperedGlass.renderOrder = 2;
    panelGroup.add(temperedGlass);

    // 4-Quadrant Optical LDR Sensor Module (top-right edge of panel)
    const sensorMount = new THREE.Group();
    sensorMount.position.set(panelWidth * 0.42, 0.032, -panelDepth * 0.38);
    panelGroup.add(sensorMount);

    const sensorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.024, 20), sensorHousingMat);
    sensorMount.add(sensorBase);

    const baffleWallA = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.038, 0.006), sensorHousingMat);
    baffleWallA.position.y = 0.024;
    const baffleWallB = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.038, 0.088), sensorHousingMat);
    baffleWallB.position.y = 0.024;
    sensorMount.add(baffleWallA, baffleWallB);

    const domeGeo = new THREE.SphereGeometry(0.011, 10, 8);
    for (const [sx, sz] of [
      [-0.02, -0.02],
      [0.02, -0.02],
      [-0.02, 0.02],
      [0.02, 0.02],
    ]) {
      const dome = new THREE.Mesh(domeGeo, sensorDomeMat);
      dome.position.set(sx, 0.014, sz);
      sensorMount.add(dome);
    }

    // Simulated Sun Orb + Halo + Sky Arc (framed inside sky dome above the tracker)
    const projectSunToSkyDome = (sunPt: { x: number; y: number; z: number }) => ({
      x: sunPt.x * 0.35,
      y: 1.05 + (sunPt.y - 2.35) * 0.11,
      z: -0.42 + (sunPt.z - 3.0) * 0.18,
    });

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9ad }),
    );
    scene.add(sunOrb);

    const sunGlowTexture = createSunGlowTexture();
    const sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunGlowTexture,
        color: 0xffc66a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sunHalo.scale.set(0.84, 0.84, 1);
    sunOrb.add(sunHalo);

    const arcPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i += 1) {
      const p = -1.25 + (i / 48) * 2.5;
      const domePt = projectSunToSkyDome(computeSunPosition(p, 5.2));
      arcPoints.push(new THREE.Vector3(domePt.x, domePt.y, domePt.z));
    }
    const sunArcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const sunArcMat = new THREE.LineBasicMaterial({
      color: 0xffcb78,
      transparent: true,
      opacity: 0.28,
    });
    const sunArcLine = new THREE.Line(sunArcGeo, sunArcMat);
    scene.add(sunArcLine);

    // Optional light atmospheric motes (skipped on low-tier mobile & software GL)
    let motesMesh: THREE.InstancedMesh | null = null;
    const moteCount = 34;
    const moteSeeds: { x: number; y: number; z: number; speed: number; offset: number }[] = [];
    if (profile.enableDriftParticles) {
      const moteGeo = new THREE.SphereGeometry(0.015, 6, 6);
      const moteMat = new THREE.MeshBasicMaterial({
        color: 0x9cecff,
        transparent: true,
        opacity: 0.52,
      });
      motesMesh = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
      motesMesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < moteCount; i += 1) {
        const seed = {
          x: (Math.random() - 0.5) * 4.4,
          y: -0.7 + Math.random() * 2.7,
          z: (Math.random() - 0.5) * 3.8,
          speed: 0.35 + Math.random() * 0.55,
          offset: Math.random() * Math.PI * 2,
        };
        moteSeeds.push(seed);
        dummy.position.set(seed.x, seed.y, seed.z);
        dummy.updateMatrix();
        motesMesh.setMatrixAt(i, dummy.matrix);
      }
      motesMesh.instanceMatrix.needsUpdate = true;
      scene.add(motesMesh);
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Track user interaction so Welcome screen auto-advance pauses smoothly
    let userDragging = false;
    let userHasInteracted = false;
    let sunPhase = 0.65;
    let currentAzimuth = 0.55;
    let currentElevation = 0.68;
    let elapsed = 0;
    let lastTimestamp = performance.now();
    let frameHandle = 0;
    let disposed = false;
    let isVisible = document.visibilityState === 'visible';
    let isInViewport = true;

    const handleControlStart = () => {
      userDragging = true;
      userHasInteracted = true;
      callbacksRef.current.onInteractionStart?.();
    };
    const handleControlEnd = () => {
      userDragging = false;
      callbacksRef.current.onInteractionEnd?.();
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);

    // Pre-allocate scratch objects outside loop for zero-GC actuator alignment
    const moteDummy = new THREE.Object3D();
    const _worldAnchor = new THREE.Vector3();
    const _worldClevis = new THREE.Vector3();
    const _localClevis = new THREE.Vector3();
    const updateLinkageZeroGC = () => {
      azimuthPivot.updateMatrixWorld(true);
      actuatorAnchor.getWorldPosition(_worldAnchor);
      panelClevis.getWorldPosition(_worldClevis);
      _localClevis.copy(_worldClevis);
      azimuthPivot.worldToLocal(_localClevis);

      actuatorBarrel.position.copy(actuatorAnchor.position);
      actuatorBarrel.lookAt(_worldClevis);

      actuatorPiston.position.copy(actuatorAnchor.position).lerp(_localClevis, 0.48);
      actuatorPiston.lookAt(_worldClevis);
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameHandle = window.setTimeout(cb, 150);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameHandle = window.setTimeout(poll, 10);
        } else {
          if (sync) gl.deleteSync(sync);
          frameHandle = window.setTimeout(cb, 150);
        }
      };
      frameHandle = window.setTimeout(poll, 10);
    };

    const tick = (now = performance.now()) => {
      if (disposed || !isVisible || !isInViewport) return;

      const dt = Math.min(0.06, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      elapsed += dt;
      sunPhase += dt * 0.38;

      // Simulated Sun trajectory and smooth independent 2-axis tracking
      const sunPos = computeSunPosition(sunPhase, 5.2);
      const domePos = projectSunToSkyDome(sunPos);
      sunOrb.position.set(domePos.x, domePos.y, domePos.z);
      sunKeyLight.position.set(sunPos.x, sunPos.y + 0.6, sunPos.z);

      const { azimuthRad, elevationRad } = computeTrackerAngles(sunPos, 0.16);
      currentAzimuth = THREE.MathUtils.damp(currentAzimuth, azimuthRad, 3.2, dt);
      currentElevation = THREE.MathUtils.damp(currentElevation, elevationRad, 3.2, dt);

      azimuthPivot.rotation.y = currentAzimuth;
      elevationPivot.rotation.x = currentElevation;
      updateLinkageZeroGC();

      // Subtle atmospheric camera drift until user grabs OrbitControls
      if (!userDragging && !userHasInteracted) {
        camera.position.x = baseCameraPos.x + Math.sin(elapsed * 0.42) * 0.24;
        camera.position.y = baseCameraPos.y + Math.cos(elapsed * 0.31) * 0.1;
        camera.position.z = baseCameraPos.z + Math.cos(elapsed * 0.42) * 0.14;
      }

      if (motesMesh) {
        for (let i = 0; i < moteCount; i += 1) {
          const s = moteSeeds[i];
          moteDummy.position.set(
            s.x + Math.sin(elapsed * s.speed + s.offset) * 0.08,
            s.y + Math.cos(elapsed * s.speed * 0.8 + s.offset) * 0.09,
            s.z,
          );
          moteDummy.updateMatrix();
          motesMesh.setMatrixAt(i, moteDummy.matrix);
        }
        motesMesh.instanceMatrix.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);

      if (profile.paceWithAfterDraw) {
        afterDraw(() => {
          if (!disposed) tick(performance.now());
        });
      } else {
        frameHandle = window.requestAnimationFrame(tick);
      }
    };

    const startLoop = (skipImmediateRender = false) => {
      if (disposed || frameHandle || !isVisible || !isInViewport) return;
      lastTimestamp = performance.now();
      if (profile.paceWithAfterDraw) {
        if (!skipImmediateRender) {
          renderer.render(scene, camera);
        }
        afterDraw(() => {
          frameHandle = 0;
          if (!disposed && isVisible && isInViewport) {
            tick(performance.now());
          }
        });
      } else {
        frameHandle = window.requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      if (frameHandle) {
        window.cancelAnimationFrame(frameHandle);
        window.clearTimeout(frameHandle);
        frameHandle = 0;
      }
    };

    // Initial frame render + readiness callback
    const initSun = computeSunPosition(sunPhase, 5.2);
    const initDome = projectSunToSkyDome(initSun);
    sunOrb.position.set(initDome.x, initDome.y, initDome.z);
    sunKeyLight.position.set(initSun.x, initSun.y + 0.6, initSun.z);
    const initAngles = computeTrackerAngles(initSun, 0.16);
    currentAzimuth = initAngles.azimuthRad;
    currentElevation = initAngles.elevationRad;
    azimuthPivot.rotation.y = currentAzimuth;
    elevationPivot.rotation.x = currentElevation;
    updateLinkageZeroGC();
    renderer.render(scene, camera);
    callbacksRef.current.onReady?.();

    startLoop(true);

    // Pause when tab hidden or container leaves viewport
    const handleVisibility = () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible) startLoop();
      else stopLoop();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          isInViewport = entries.some((entry) => entry.isIntersecting);
          if (isInViewport) startLoop();
          else stopLoop();
        },
        { threshold: 0.05 },
      );
      observer.observe(container);
    }

    const handleResize = () => {
      if (disposed) return;
      profile = computeCurrentProfile();
      const nextW = Math.max(240, container.clientWidth || 520);
      const nextH = Math.max(240, container.clientHeight || 460);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(profile.pixelRatio);
      renderer.setSize(nextW, nextH, false);
      if (isVisible && isInViewport) renderer.render(scene, camera);
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);
    window.addEventListener('resize', handleResize, { passive: true });

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      stopLoop();
      callbacksRef.current.onUnavailable?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    return () => {
      disposed = true;
      stopLoop();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      observer?.disconnect();
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('end', handleControlEnd);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        } else if (obj instanceof THREE.Sprite) {
          obj.material.dispose();
        }
      });

      cellTexture.dispose();
      contactTexture.dispose();
      sunGlowTexture.dispose();
      envRenderTarget?.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="solar-tracker-3d-mount" data-testid="solar-tracker-3d" />;
}
