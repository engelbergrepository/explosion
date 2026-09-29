import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export function createSmokeEditor(camera, canvas, scene, simulation) {
  const orbit = new OrbitControls(camera, canvas);
  orbit.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: null };
  orbit.enableDamping = true;
  orbit.screenSpacePanning = true;
  orbit.minDistance = 2;
  orbit.maxDistance = 500;
  orbit.target.set(22, 10, 0);
  const transform = new TransformControls(camera, canvas);
  transform.setSize(0.85);
  const helper = transform.getHelper();
  scene.add(helper);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const events = new AbortController();
  const { signal } = events;
  const selector = document.getElementById('smoke-object');
  const fields = [...document.querySelectorAll('[data-smoke-transform]')];
  let enabled = true, dragged = false, down = null;
  function refresh() {
    const object = transform.object;
    selector.value = object === simulation.cannon ? 'cannon' : object === simulation.cube ? 'cube' : '';
    for (const input of fields) {
      input.disabled = !object;
      const [property, axis] = input.dataset.smokeTransform.split('.');
      input.value = object ? (object[property][axis] * (property === 'rotation' ? 180 / Math.PI : 1)).toFixed(2) : '';
    }
  }
  function select(object) {
    if (object) transform.attach(object); else transform.detach();
    refresh();
  }
  function mode(value) {
    transform.setMode(value);
    transform.setSpace(value === 'rotate' ? 'local' : 'world');
    document.getElementById('smoke-move').classList.toggle('on', value === 'translate');
    document.getElementById('smoke-rotate').classList.toggle('on', value === 'rotate');
  }
  function focus() {
    if (!transform.object) return;
    const box = new THREE.Box3().setFromObject(transform.object);
    const center = box.getCenter(new THREE.Vector3());
    const direction = camera.position.clone().sub(orbit.target).normalize();
    const distance = Math.max(18, box.getSize(new THREE.Vector3()).length() * 2.5);
    orbit.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    orbit.update();
  }
  transform.addEventListener('dragging-changed', event => {
    orbit.enabled = enabled && !event.value;
    if (event.value) dragged = true;
  });
  transform.addEventListener('objectChange', () => { simulation.updateObjects(); refresh(); });
  selector.addEventListener('change', () => select(selector.value === 'cannon' ? simulation.cannon : selector.value === 'cube' ? simulation.cube : null), { signal });
  document.getElementById('smoke-move').addEventListener('click', () => mode('translate'), { signal });
  document.getElementById('smoke-rotate').addEventListener('click', () => mode('rotate'), { signal });
  document.getElementById('smoke-focus').addEventListener('click', focus, { signal });
  for (const input of fields) input.addEventListener('input', () => {
    if (!transform.object || !Number.isFinite(input.valueAsNumber)) return;
    const [property, axis] = input.dataset.smokeTransform.split('.');
    transform.object[property][axis] = input.valueAsNumber * (property === 'rotation' ? Math.PI / 180 : 1);
    simulation.updateObjects();
  }, { signal });
  canvas.addEventListener('pointerdown', e => {
    if (!enabled || e.button !== 0) return;
    dragged = transform.dragging || transform.axis !== null;
    down = [e.clientX, e.clientY];
  }, { signal });
  canvas.addEventListener('pointerup', e => {
    if (!enabled || e.button !== 0 || !down) return;
    const distance = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null;
    if (dragged || distance > 4) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointer, camera);
    let object = raycaster.intersectObjects([simulation.cannon, simulation.cube], true)[0]?.object;
    while (object && object !== simulation.cannon && object !== simulation.cube) object = object.parent;
    select(object || null);
  }, { signal });
  window.addEventListener('keydown', e => {
    if (!enabled || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyG') mode('translate');
    if (e.code === 'KeyR') mode('rotate');
    if (e.code === 'KeyF') focus();
  }, { signal });
  mode('translate'); select(simulation.cannon);
  return {
    orbit,
    update(isFree) {
      enabled = isFree;
      orbit.enabled = isFree && !transform.dragging;
      transform.enabled = isFree;
      helper.visible = isFree && !!transform.object;
      if (isFree) orbit.update();
    },
    resetView() { orbit.target.set(22, 10, 0); orbit.update(); },
    dispose() {
      events.abort(); transform.detach(); helper.removeFromParent();
      transform.dispose(); orbit.dispose();
    }
  };
}
