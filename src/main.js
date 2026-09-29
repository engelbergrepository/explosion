import * as THREE from 'three/webgpu';
import { createWorld } from './world.js';
import { createSmokeSimulation } from './smoke_sim.js';
import { createSmokeEditor } from './smoke_editor.js';
import { createPost } from './post.js';

const SENSOR_HEIGHT_MM = 24;
const canvas = document.getElementById('view');
const flashVeil = document.getElementById('flash');
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

const sun = new THREE.DirectionalLight(0xfff1dd, 6.5);
sun.position.set(200, 80, 40);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xc5c2ba, 1.15));
scene.add(new THREE.HemisphereLight(0xd5e4f4, 0xc4a27a, 1.35));

const world = createWorld();
scene.add(world.group);
world.load({
  biome: 'desert-dawn',
  settlement: 'none',
  sun: { elevation: 18, azimuth: 78 }
});
sun.position.copy(world.sunDir.value).multiplyScalar(800);

const post = createPost(renderer, scene, camera);
post.uBokeh.value = 0;
post.uRange.value = 80;

let smokeSim = null;
let smokeEditor = null;
let smokeLayout = null;
const clock = { time: 0, roll: 30, rate: 1, playing: false, focal: 28, focus: 40, focusManual: false, fstop: 8 };

function num(id) { return Number(document.getElementById(id).value); }

function readSmokeParams() {
  return {
    velocity: num('smoke-velocity'), decay: num('smoke-decay'), buoyancy: num('smoke-buoyancy'),
    buoyancyDecay: num('smoke-buoyancy-decay'), turbulence: num('smoke-turbulence'),
    particleSize: num('smoke-size'), count: num('smoke-count'), opacity: num('smoke-density'),
    color: document.getElementById('smoke-color').value
  };
}

function bindRange(id, outId, format, on) {
  const el = document.getElementById(id);
  const out = document.getElementById(outId);
  const pull = () => {
    out.textContent = format(Number(el.value));
    on(Number(el.value));
  };
  el.addEventListener('input', pull);
  pull();
}

function setStatus(text) { document.getElementById('smoke-status').textContent = text; }
function setTime(v) {
  clock.time = v;
  document.getElementById('time').value = String(v);
  document.getElementById('time-out').textContent = `${v.toFixed(1)} s`;
}
function showFocus(metres) {
  if (clock.focusManual) return;
  clock.focus = metres;
  document.getElementById('focus').value = String(metres);
  document.getElementById('focus-out').textContent = `${metres.toFixed(1)} m`;
}

function ensureSmoke() {
  if (smokeSim) return;
  smokeSim = createSmokeSimulation(world.sunDir);
  if (smokeLayout) {
    for (const name of ['cannon', 'cube']) {
      smokeSim[name].position.fromArray(smokeLayout[name].position);
      smokeSim[name].quaternion.fromArray(smokeLayout[name].quaternion);
    }
  }
  smokeSim.setParams(readSmokeParams());
  smokeSim.updateObjects();
  scene.add(smokeSim.root);
  smokeEditor = createSmokeEditor(camera, canvas, scene, smokeSim);
  document.getElementById('stop').disabled = false;
  document.getElementById('smoke-editor').disabled = false;
  document.getElementById('hold').disabled = false;
  seedView();
}

function stopSmoke() {
  if (!smokeSim) return;
  smokeLayout = {};
  for (const name of ['cannon', 'cube']) smokeLayout[name] = {
    position: smokeSim[name].position.toArray(),
    quaternion: smokeSim[name].quaternion.toArray()
  };
  smokeEditor.dispose();
  smokeEditor = null;
  smokeSim.dispose(renderer);
  smokeSim = null;
  clock.playing = false;
  setTime(0);
  document.getElementById('stop').disabled = true;
  document.getElementById('smoke-editor').disabled = true;
  document.getElementById('hold').disabled = true;
  setStatus('Stopped. Smoke GPU resources released. Emit smoke to restart.');
}

function seedView() {
  camera.position.set(24, 18, 65);
  camera.lookAt(22, 10, 0);
  smokeEditor?.resetView();
}

function stockGrade() {
  const stock = document.getElementById('stock').value;
  if (stock === 'tri-x') {
    post.uBW.value = 1; post.uWarm.value = 0.15; post.uExposure.value = 1.15;
  } else if (stock === 'kodachrome') {
    post.uBW.value = 0; post.uWarm.value = 0.75; post.uExposure.value = 1.25;
  } else {
    post.uBW.value = 0; post.uWarm.value = 0.28; post.uExposure.value = 1.2;
  }
  post.uGrain.value = 0.35;
}

bindRange('focal', 'focal-out', (v) => `${v.toFixed(0)} mm`, (v) => { clock.focal = v; });
bindRange('focus', 'focus-out', (v) => `${v.toFixed(1)} m`, (v) => { clock.focus = v; clock.focusManual = true; });
bindRange('fstop', 'fstop-out', (v) => `ƒ/${v.toFixed(1)}`, (v) => { clock.fstop = v; });
bindRange('bright', 'bright-out', (v) => v.toFixed(2), (v) => { renderer.toneMappingExposure = v; });
bindRange('time', 'time-out', (v) => `${v.toFixed(1)} s`, (v) => {
  if (Math.abs(v - clock.time) > 0.08) clock.playing = false;
  clock.time = v;
});
bindRange('roll', 'roll-out', (v) => `${v.toFixed(0)} s`, (v) => {
  clock.roll = v;
  document.getElementById('time').max = String(v);
});
bindRange('rate', 'rate-out', (v) => `${v.toFixed(1)}×`, (v) => { clock.rate = v; });
for (const id of ['velocity', 'decay', 'buoyancy', 'buoyancy-decay', 'turbulence', 'size', 'count', 'density']) {
  const format = id === 'count' ? (v) => v.toLocaleString()
    : id === 'velocity' ? (v) => `${v.toFixed(1)} m/s`
    : id.endsWith('decay') ? (v) => `${v.toFixed(2)} /s`
    : id === 'buoyancy' ? (v) => `${v.toFixed(1)} m/s²`
    : id === 'size' ? (v) => `${v.toFixed(2)} m`
    : (v) => v.toFixed(id === 'turbulence' ? 1 : 2);
  bindRange('smoke-' + id, 'smoke-' + id + '-out', format, () => smokeSim?.setParams(readSmokeParams()));
}
document.getElementById('smoke-color').addEventListener('input', () => smokeSim?.setParams(readSmokeParams()));

document.getElementById('ignite').addEventListener('click', () => {
  ensureSmoke();
  smokeSim.reset();
  clock.playing = true;
  setTime(0);
});
document.getElementById('hold').addEventListener('click', () => {
  if (!smokeSim) return;
  if (clock.time >= clock.roll) clock.time = 0;
  clock.playing = !clock.playing;
});
document.getElementById('reset').addEventListener('click', () => {
  clock.playing = false;
  smokeSim?.reset();
  setTime(0);
});
document.getElementById('stop').addEventListener('click', stopSmoke);

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
await renderer.init();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (clock.playing && smokeSim) {
    clock.time = Math.min(clock.roll, clock.time + dt * clock.rate);
    if (clock.time >= clock.roll) clock.playing = false;
    document.getElementById('time').value = String(clock.time);
    document.getElementById('time-out').textContent = `${clock.time.toFixed(1)} s`;
  }
  smokeEditor?.update(true);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(SENSOR_HEIGHT_MM / (2 * clock.focal)));
  camera.updateProjectionMatrix();
  const plume = camera.position.distanceTo(new THREE.Vector3(22, 10, 0));
  if (!clock.focusManual) showFocus(plume);
  post.uFocus.value = clock.focus;
  if (smokeSim) {
    const simulatedTime = smokeSim.advance(renderer, clock.time);
    setStatus(simulatedTime + 0.04 < clock.time
      ? `Simulating ${simulatedTime.toFixed(1)} / ${clock.time.toFixed(1)} s…`
      : `GPU smoke · ${simulatedTime.toFixed(1)} s · ${smokeSim.active.toLocaleString()} samples`);
  }
  world.uTime.value = now * 0.001;
  world.uFlash.value = 0;
  world.uShockR.value = 0;
  world.uMachH.value = 0;
  world.uPush.value = 0;
  world.uSuck.value = 0;
  flashVeil.style.opacity = '0';
  post.uFlash.value = 0;
  stockGrade();
  const mm = Math.floor(clock.time / 60);
  const ss = Math.floor(clock.time % 60);
  const fr = Math.floor((clock.time % 1) * 24);
  tc.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  post.pipeline.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
