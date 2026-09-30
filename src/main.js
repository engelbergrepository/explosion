import * as THREE from 'three/webgpu';
import { findTest, camerasForTest } from './presets.js';
import { createWorld } from './world.js';
import { createExplosion } from './explosion.js';
import { createGasSimulation } from './gas_sim.js';
import { createSmokeSimulation } from './smoke_sim.js';
import { createSmokeEditor } from './smoke_editor.js';
import { createPost } from './post.js';
import { bindUI } from './ui.js';

const SENSOR_HEIGHT_MM = 24;

const canvas = document.getElementById('view');
const gate = document.getElementById('gate');
const flashVeil = document.getElementById('flash');
const camLabel = document.getElementById('cam-id');
const tc = document.getElementById('tc');

if (!navigator.gpu) {
  const err = document.createElement('div');
  err.id = 'err';
  err.textContent = 'This picture needs WebGPU. Open it in a current Chrome or Edge build with WebGPU enabled.';
  document.getElementById('stage').appendChild(err);
  throw new Error('WebGPU unavailable');
}

const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0c7a4);
renderer.setClearColor(0xf0c7a4, 1);

const camera = new THREE.PerspectiveCamera(30, 1, 0.4, 120000);
scene.add(camera);

const sun = new THREE.DirectionalLight(0xfff1dd, 3.4);
sun.position.set(200, 80, 40);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xc5c2ba, 1.15));
scene.add(new THREE.HemisphereLight(0xd5e4f4, 0xc4a27a, 1.35));
const blast = new THREE.PointLight(0xfff1dd, 0, 0, 2);
scene.add(blast);

const world = createWorld();
scene.add(world.group);
const explosion = createExplosion();
scene.add(explosion.root);
const gasSim = createGasSimulation(world.sunDir);
scene.add(gasSim.root);
let smokeSim = null;
let smokeEditor = null;
let smokeLayout = null;

const post = createPost(renderer, scene, camera);

const clock = {
  source: 'simulation',
  testId: 'trinity',
  camId: 'south-bunker',
  distance: 1,
  focal: 85,
  focus: 9000,
  focusManual: false,
  fstop: 8,
  time: 0,
  roll: 90,
  rate: 1,
  playing: false,
  ignited: false,
  countdown: 0,
  mix: null
};

const rig = { home: new THREE.Vector3(), look: new THREE.Vector3(), style: 'film', orbit: 0 };
const freeCam = {
  yaw: 0.6,
  pitch: -0.18,
  pos: new THREE.Vector3(-2800, 900, 2800),
  seeded: false,
  manualLook: false
};
const held = new Set();
canvas.addEventListener('pointerdown', () => {
  if (clock.camId === 'free' && clock.source !== 'smoke') canvas.requestPointerLock();
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || clock.camId !== 'free') return;
  freeCam.yaw -= e.movementX * 0.0022;
  freeCam.pitch = Math.max(-1.2, Math.min(0.6, freeCam.pitch - e.movementY * 0.0022));
  freeCam.manualLook = true;
});
window.addEventListener('keydown', (e) => { held.add(e.code); });
window.addEventListener('keyup', (e) => { held.delete(e.code); });

let audioCtx = null;
let rumbleStop = null;
let activeCameras = [];
let simulationRoll = clock.roll;

function resize() {
  const w = canvas.clientWidth || window.innerWidth - 340;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function applyTest(id) {
  const test = findTest(id);
  clock.testId = test.id;
  clock.ignited = false;
  clock.playing = false;
  clock.time = 0;
  clock.countdown = 0;
  ui.markTest(test.id);
  ui.setCaption(test.caption);
  ui.setMix(test.mix);
  clock.mix = readMix();
  world.load(clock.source !== 'simulation' ? { ...test, settlement: 'none' } : test);
  world.resetStructures();
  explosion.reset();
  sun.intensity = 6.5;
  sun.position.copy(world.sunDir.value).multiplyScalar(800);
  sun.color.set(0xfff0d2);
  activeCameras = camerasForTest(test);
  const first = activeCameras[0];
  ui.setCameras(activeCameras, first.id, (camId) => applyCamera(camId));
  applyCamera(first.id);
  if (clock.source === 'gas') {
    gasSim.reset();
    applyCamera('free');
    seedGasView();
  }
  if (clock.source === 'smoke') {
    ensureSmoke();
    smokeSim.reset();
    applyCamera('free');
    ui.setCaption('Two smoke cannons · compare gray and blue plumes in the selected landscape.');
  }
  ui.setTime(0);
}

function seedGasView() {
  freeCam.pos.set(-1200, 350, 1200);
  const dx = -freeCam.pos.x;
  const dy = 120 - freeCam.pos.y;
  const dz = -freeCam.pos.z;
  freeCam.yaw = Math.atan2(dx, dz);
  freeCam.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  freeCam.manualLook = false;
  clock.focal = 38;
  clock.fstop = 5.6;
  ui.setLens(clock.focal, Math.hypot(dx, dy, dz), clock.fstop);
  clock.focusManual = false;
}

function ensureSmoke() {
  if (smokeSim) return;
  smokeSim = createSmokeSimulation(world.sunDir);
  if (smokeLayout) {
    for (const name of ['cannon', 'cannon2', 'cube']) {
      smokeSim[name].position.fromArray(smokeLayout[name].position);
      smokeSim[name].quaternion.fromArray(smokeLayout[name].quaternion);
    }
  }
  smokeSim.setParams(readSmokeParams());
  smokeSim.setSecondParams(readSmokeParams('smoke2'));
  smokeSim.updateObjects();
  scene.add(smokeSim.root);
  smokeEditor = createSmokeEditor(camera, canvas, scene, smokeSim);
  ui.setSmokeStopped(false);
}

function stopSmoke() {
  if (smokeSim) {
    smokeLayout = {};
    for (const name of ['cannon', 'cannon2', 'cube']) smokeLayout[name] = {
      position: smokeSim[name].position.toArray(), quaternion: smokeSim[name].quaternion.toArray()
    };
    smokeEditor.dispose(); smokeEditor = null;
    smokeSim.dispose(renderer); smokeSim = null;
  }
  clock.playing = false; clock.ignited = false; clock.time = 0;
  ui.setTime(0);
  ui.setSmokeStopped(true);
  ui.setSmokeStatus('Stopped. Smoke GPU resources released. Emit smoke to restart.');
}

function seedSmokeView() {
  freeCam.pos.set(24, 18, 65);
  const target = new THREE.Vector3(22, 10, 0);
  const delta = target.sub(freeCam.pos);
  freeCam.yaw = Math.atan2(delta.x, delta.z);
  freeCam.pitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
  freeCam.manualLook = false;
  clock.focal = 28;
  clock.fstop = 8;
  ui.setLens(clock.focal, delta.length(), clock.fstop);
  clock.focusManual = false;
  camera.position.copy(freeCam.pos);
  camera.lookAt(22, 10, 0);
  smokeEditor?.resetView();
}

function applyCamera(camId) {
  const cam = activeCameras.find((c) => c.id === camId) ?? activeCameras[0];
  clock.camId = cam.id;
  rig.home.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  rig.look.set(cam.look[0], cam.look[1], cam.look[2]);
  rig.style = cam.style;
  if (cam.style === 'free') {
    freeCam.pos.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    freeCam.manualLook = false;
    const dx = cam.look[0] - cam.pos[0];
    const dy = cam.look[1] - cam.pos[1];
    const dz = cam.look[2] - cam.pos[2];
    freeCam.yaw = Math.atan2(dx, dz);
    freeCam.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  clock.focal = cam.focal;
  clock.fstop = cam.fstop;
  clock.focus = rig.home.distanceTo(rig.look);
  ui.setCameras(activeCameras, cam.id, (id) => applyCamera(id));
  ui.setLens(clock.focal, clock.focus, clock.fstop);
  clock.focusManual = false;
  gate.classList.toggle('film', cam.style === 'film');
  camLabel.textContent = `${cam.name.toUpperCase()}  ${cam.detail.toUpperCase()}`;
  if (clock.source === 'smoke' && cam.style === 'free') {
    seedSmokeView();
    camLabel.textContent = 'FREE CAMERA · SMOKE CANNON';
  }
}

function focalToFov(mm) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(SENSOR_HEIGHT_MM / (2 * mm)));
}

function placeCamera(dt) {
  const cam = activeCameras.find((c) => c.id === clock.camId);
  camera.up.set(0, 1, 0);
  smokeEditor?.update(cam.style === 'free');
  if (clock.source === 'smoke' && cam.style === 'free') {
    // OrbitControls owns this camera while editing; no pointer lock or WASD.
  } else if (cam.style === 'free') {
    if (clock.source === 'gas' && !freeCam.manualLook) {
      const targetY = Math.max(120, Math.min(1000, gasSim.focusY));
      const desiredPitch = Math.atan2(targetY - freeCam.pos.y, Math.hypot(freeCam.pos.x, freeCam.pos.z));
      freeCam.pitch += (desiredPitch - freeCam.pitch) * (1 - Math.exp(-dt * 2));
    }
    const speed = (clock.source === 'smoke' ? (held.has('ShiftLeft') ? 35 : 10) : (held.has('ShiftLeft') ? 900 : 280)) * dt * clock.distance;
    const cy = Math.cos(freeCam.pitch);
    const fx = Math.sin(freeCam.yaw) * cy;
    const fy = Math.sin(freeCam.pitch);
    const fz = Math.cos(freeCam.yaw) * cy;
    const rx = Math.cos(freeCam.yaw);
    const rz = -Math.sin(freeCam.yaw);
    if (held.has('KeyW')) freeCam.pos.addScaledVector(new THREE.Vector3(fx, fy, fz), speed);
    if (held.has('KeyS')) freeCam.pos.addScaledVector(new THREE.Vector3(fx, fy, fz), -speed);
    if (held.has('KeyD')) freeCam.pos.addScaledVector(new THREE.Vector3(rx, 0, rz), speed);
    if (held.has('KeyA')) freeCam.pos.addScaledVector(new THREE.Vector3(rx, 0, rz), -speed);
    if (held.has('KeyE')) freeCam.pos.y += speed;
    if (held.has('KeyQ')) freeCam.pos.y -= speed;
    camera.position.copy(freeCam.pos);
    camera.lookAt(freeCam.pos.x + fx, freeCam.pos.y + fy, freeCam.pos.z + fz);
  } else {
  const pos = rig.home.clone().multiply(new THREE.Vector3(clock.distance, 1, clock.distance));
  const look = rig.look.clone();
  camera.position.copy(pos);
  camera.lookAt(look);
  }
  const weave = clock.mix ? clock.mix.grain : 0.3;
  if (rig.style === 'film') {
    camera.rotateZ(Math.sin(clock.time * 17 + performance.now() * 0.002) * 0.0006 * weave);
  }
  camera.fov = focalToFov(clock.focal);
  camera.updateProjectionMatrix();

  const dist = camera.position.distanceTo(rig.look);
  const focusY = clock.source === 'gas' ? gasSim.focusY : explosion.state.plumeH * 0.65;
  const plumeDepth = camera.position.distanceTo(clock.source === 'smoke' ? new THREE.Vector3(22, 10, 0) : new THREE.Vector3(0, focusY, 0));
  const autoFocus = (clock.source !== 'simulation' || (clock.ignited && clock.countdown <= 0)) && !clock.focusManual;
  const focus = autoFocus ? plumeDepth : clock.focus;
  post.uFocus.value = focus;
  if (autoFocus) ui.showAutoFocus(focus);
  const coc = (clock.focal / Math.max(1.2, clock.fstop)) / 40;
  post.uRange.value = clock.source === 'gas' ? 1800
    : Math.max(300, dist * (clock.fstop / 16) * 0.5, explosion.state.plumeH * 1.25);
  post.uBokeh.value = clock.source === 'smoke' ? 0 : 0.9 + coc * 2.5;
}

function stockGrade() {
  const stock = ui.stock();
  if (stock === 'tri-x') {
    post.uBW.value = 1;
    post.uWarm.value = 0.15;
    post.uExposure.value = 1.15;
  } else if (stock === 'kodachrome') {
    post.uBW.value = 0;
    post.uWarm.value = 0.75;
    post.uExposure.value = 1.25;
  } else {
    post.uBW.value = 0;
    post.uWarm.value = 0.28;
    post.uExposure.value = 1.2;
  }
  post.uGrain.value = clock.mix ? clock.mix.grain * (rig.style === 'drone' ? 0.35 : 1) : 0.4;
}

function playRumble() {
  if (!ui.sound()) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioCtx) audioCtx = new AudioCtx();
  audioCtx.resume();
  if (rumbleStop) rumbleStop();
  const dist = camera.position.length();
  const delay = dist / 343;
  const dur = 14;
  const rate = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, Math.floor(rate * dur), rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = last * 0.98 + (Math.random() * 2 - 1) * 0.02;
    const env = Math.min(1, i / (rate * 0.6)) * Math.exp(-i / (rate * 6));
    data[i] = last * env * 3;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 140;
  const gain = audioCtx.createGain();
  gain.gain.value = Math.min(0.7, 8000 / Math.max(dist, 400));
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(audioCtx.currentTime + delay);
  rumbleStop = () => { try { src.stop(); } catch { /* already ended */ } };
}

const ui = bindUI({
  onTest: applyTest,
  onSource: (source) => {
    if (clock.source === 'simulation') simulationRoll = clock.roll;
    if (clock.source === 'smoke' && source !== 'smoke') stopSmoke();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    clock.source = source;
    renderer.toneMappingExposure = Number(document.getElementById(source === 'gas' ? 'gas-bright' : 'bright').value);
    ui.setSourceMode(source);
    ui.setRoll(source !== 'simulation' ? 30 : simulationRoll);
    applyTest(clock.testId);
    if (source === 'gas') ui.setGasStatus('Hot gas starts at ground zero. Play from 0 s.');
  },
  onGas: () => gasSim.setParams(readGasParams()),
  onSmoke: () => { smokeSim?.setParams(readSmokeParams()); smokeSim?.setSecondParams(readSmokeParams('smoke2')); },
  onStop: stopSmoke,
  onDistance: (v) => { clock.distance = v; },
  onFocal: (v) => { clock.focal = v; },
  onFocus: (v) => { clock.focus = v; clock.focusManual = true; },
  onFStop: (v) => { clock.fstop = v; },
  onTime: (v) => {
    const scrub = Math.abs(v - clock.time) > 0.08;
    clock.time = v;
    if (scrub && (clock.ignited || clock.source !== 'simulation')) clock.playing = false;
  },
  onRoll: (v) => {
    clock.roll = v;
    document.getElementById('time').max = String(v);
  },
  onRate: (v) => { clock.rate = v; },
  onMix: () => { clock.mix = readMix(); },
  onBrightness: (v) => { renderer.toneMappingExposure = v; },
  onStock: () => {},
  onIgnite: () => {
    if (clock.source !== 'simulation') {
      if (clock.source === 'smoke') {
        const restarting = !smokeSim;
        ensureSmoke();
        if (restarting) applyCamera('free');
      }
      (clock.source === 'smoke' ? smokeSim : gasSim).reset();
      clock.ignited = true;
      clock.playing = true;
      clock.time = 0;
      clock.countdown = 0;
      ui.setTime(0);
      return;
    }
    clock.ignited = true;
    clock.playing = true;
    clock.time = 0;
    clock.countdown = 4;
    ui.setTime(0);
    world.resetStructures();
    playRumble();
  },
  onHold: () => {
    if (clock.source !== 'simulation' && clock.time >= clock.roll) clock.time = 0;
    clock.playing = !clock.playing;
  },
  onReset: () => {
    if (clock.source !== 'simulation') {
      clock.playing = false;
      clock.time = 0;
      (clock.source === 'smoke' ? smokeSim : gasSim)?.reset();
      ui.setTime(0);
    } else applyTest(clock.testId);
  }
});

function readMix() {
  const n = (id) => Number(document.getElementById(id).value);
  return {
    particles: n('particles'), mass: n('mass'), dust: n('dust'), dustSize: n('dust-size'), dustDiv: n('dust-div'),
    shock: n('shock'), shockThick: n('shock-thick'), scale: n('scale'), plume: n('plume'),
    flash: n('flash'), stem: n('stem'), cap: n('cap'), wind: n('wind'), grain: n('grain')
  };
}

function readSmokeParams(prefix = 'smoke') {
  const n = (id) => Number(document.getElementById(prefix + '-' + id).value);
  return { velocity: n('velocity'), decay: n('decay'), buoyancy: n('buoyancy'),
    buoyancyDecay: n('buoyancy-decay'), turbulence: n('turbulence'),
    particleSize: n('size'), count: n('count'), opacity: n('density'),
    color: document.getElementById(prefix + '-color').value };
}

function readGasParams() {
  const n = (id) => Number(document.getElementById(id).value);
  return {
    density: n('gas-density'),
    smokeColor: document.getElementById('gas-smoke-color').value,
    emissionColor: document.getElementById('gas-glow-color').value,
    emission: n('gas-glow'), sun: n('gas-sun'), shadow: n('gas-shadow'),
    anisotropy: n('gas-anisotropy'),
    radialVelocity: n('gas-velocity'), initialRise: n('gas-rise'),
    duration: n('gas-duration'), pressure: n('gas-pressure'),
    buoyancy: n('gas-buoyancy'), drag: n('gas-drag'),
    cooling: n('gas-cooling'), thinning: n('gas-thinning')
  };
}

applyTest('custom');
resize();

await renderer.init();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (clock.playing) {
    if (clock.source !== 'simulation') {
      clock.time = Math.min(clock.roll, clock.time + dt * clock.rate);
      if (clock.time >= clock.roll) clock.playing = false;
      const slider = document.getElementById('time');
      slider.value = String(clock.time);
      document.getElementById('time-out').textContent = `${clock.time.toFixed(1)} s`;
    } else if (clock.countdown > 0) {
      clock.countdown -= dt;
      document.getElementById('count').hidden = false;
      document.getElementById('count').textContent = `T− ${Math.max(0, Math.ceil(clock.countdown)).toString().padStart(2, '0')}`;
      if (clock.countdown <= 0) {
        document.getElementById('count').hidden = true;
        clock.time = 0;
      }
    } else if (clock.ignited) {
      clock.time = Math.min(clock.roll, clock.time + dt * clock.rate);
      const slider = document.getElementById('time');
      slider.value = String(clock.time);
      document.getElementById('time-out').textContent = `${clock.time.toFixed(1)} s`;
    }
  }

  const test = findTest(clock.testId);
  const usingGas = clock.source === 'gas';
  const usingSmoke = clock.source === 'smoke';
  const usingFlow = usingGas || usingSmoke;
  const live = !usingFlow && clock.ignited && clock.countdown <= 0;
  const t = live ? clock.time : -1;
  clock.mix = readMix();
  explosion.root.visible = !usingFlow;
  gasSim.root.visible = usingGas;
  if (smokeSim) smokeSim.root.visible = usingSmoke;
  if (usingSmoke && smokeSim) {
    const simulatedTime = smokeSim.advance(renderer, clock.time);
    ui.setSmokeStatus(simulatedTime + 0.04 < clock.time
      ? `Simulating ${simulatedTime.toFixed(1)} / ${clock.time.toFixed(1)} s…`
      : `GPU smoke · ${simulatedTime.toFixed(1)} s · ${smokeSim.active.toLocaleString()} samples`);
  } else if (usingGas) {
    const simulatedTime = gasSim.advance(renderer, clock.time);
    gasSim.root.visible = gasSim.ready;
    ui.setGasStatus(simulatedTime + 0.11 < clock.time
      ? `Simulating ${simulatedTime.toFixed(1)} / ${clock.time.toFixed(1)} s…`
      : `Gas simulation · ${simulatedTime.toFixed(1)} s`);
  } else if (!usingSmoke) {
    gasSim.root.visible = false;
    explosion.sync(clock.mix, t, test.spectacle, test.biome === 'atoll');
    explosion.step(renderer, dt, live);
  }
  world.uShockR.value = usingFlow ? 0 : explosion.state.shockRadius;
  world.uMachH.value = usingFlow ? 0 : explosion.state.machH;
  world.uPush.value = live ? clock.mix.shockThick * explosion.state.outward : 0;
  world.uSuck.value = live ? explosion.state.suck : 0;

  world.uFlash.value = live ? explosion.state.flash : 0;
  world.uTime.value = now * 0.001;
  world.updateShock(live ? t : -1, live ? explosion.state.shockRadius : 0, dt);
  flashVeil.style.opacity = live ? String(Math.min(0.92, explosion.state.flash * 0.75)) : '0';
  post.uFlash.value = live ? explosion.state.flash * 1.4 : 0;

  blast.position.set(0, explosion.state.plumeH * 0.25, 0);
  blast.intensity = live ? explosion.state.flash * 250000 * test.spectacle * clock.mix.flash : 0;

  placeCamera(dt);
  stockGrade();

  const mm = Math.floor(clock.time / 60);
  const ss = Math.floor(clock.time % 60);
  const fr = Math.floor((clock.time % 1) * 24);
  tc.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;

  post.pipeline.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
