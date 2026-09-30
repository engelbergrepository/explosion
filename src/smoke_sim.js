import * as THREE from 'three/webgpu';
import { Fn, Loop, If, Break, vec3, vec4, float, uniform, cameraPosition,
  positionWorld, normalize, min, max, clamp, exp, texture3D, dot } from 'three/tsl';
import { createSmokeGPU, SMOKE_BOUNDS } from './smoke_gpu.js';

export function createSmokeSimulation(sunDirection) {
  const gpu = createSmokeGPU();
  const gpu2 = createSmokeGPU();
  const { low, size } = SMOKE_BOUNDS;
  const volume = gpu.volume;
  const density = uniform(1.8);
  const smokeColor = uniform(new THREE.Color('#a6a9ad'));
  const density2 = uniform(1.5);
  const smokeColor2 = uniform(new THREE.Color('#54a9cf'));
  const sampled = texture3D(volume);
  const sampled2 = texture3D(gpu2.volume);

  // Principled-volume style density extinction and scattering, with light
  // attenuation through the actual reconstructed smoke. No emissive fireball.
  const marched = Fn(() => {
    const rd = normalize(positionWorld.sub(cameraPosition));
    const lo = vec3(...low), hi = lo.add(vec3(...size));
    const inv = vec3(1).div(rd.add(0.000001));
    const a = lo.sub(cameraPosition).mul(inv), b = hi.sub(cameraPosition).mul(inv);
    const n = min(a, b), f = max(a, b);
    const start = max(max(n.x, n.y), max(n.z, float(0)));
    const end = min(min(f.x, f.y), f.z).toVar();
    // Stop integrating at the opaque cube's front face. Smoke behind the cube
    // must not composite over it when rendering the transparent volume bounds.
    const cubeOrigin = gpu.colliderInverse.mul(vec4(cameraPosition, 1)).xyz;
    const cubeDirection = gpu.colliderInverse.mul(vec4(rd, 0)).xyz;
    const cubeInv = vec3(1).div(cubeDirection.add(0.000001));
    const ca = vec3(-3).sub(cubeOrigin).mul(cubeInv);
    const cb = vec3(3).sub(cubeOrigin).mul(cubeInv);
    const cn = min(ca, cb), cf = max(ca, cb);
    const cubeNear = max(max(cn.x, cn.y), cn.z);
    const cubeFar = min(min(cf.x, cf.y), cf.z);
    If(gpu.colliderEnabled.greaterThan(0).and(cubeFar.greaterThanEqual(max(cubeNear, float(0)))), () => {
      end.assign(min(end, max(cubeNear, float(0))));
    });
    const stepLength = max(end.sub(start), float(0)).div(160);
    const acc = vec4(0).toVar();
    const light = normalize(sunDirection);
    const phase = float(0.85).add(max(dot(rd.negate(), light), float(0)).mul(0.35));
    Loop(160, ({ i }) => {
      If(acc.a.greaterThan(0.995), () => { Break(); });
      const p = cameraPosition.add(rd.mul(start.add(float(i).add(0.5).mul(stepLength))));
      const uv = p.sub(lo).div(vec3(...size));
      const mass1 = sampled.sample(uv).r.mul(density);
      const mass2 = sampled2.sample(uv).r.mul(density2);
      const mass = mass1.add(mass2);
      If(mass.greaterThan(0.0001), () => {
        const shadow1 = float(0).toVar(), shadow2 = float(0).toVar();
        Loop(4, ({ i: j }) => {
          const q = p.add(light.mul(float(j).add(0.5).mul(2.5))).sub(lo).div(vec3(...size));
          shadow1.addAssign(sampled.sample(clamp(q, vec3(0), vec3(1))).r.mul(2.5));
          shadow2.addAssign(sampled2.sample(clamp(q, vec3(0), vec3(1))).r.mul(2.5));
        });
        const lighting = exp(shadow1.mul(density).add(shadow2.mul(density2)).mul(-0.65)).mul(phase).mul(1.6).add(0.3);
        const alpha = float(1).sub(exp(mass.mul(stepLength).mul(-0.8)));
        const contribution = alpha.mul(float(1).sub(acc.a));
        const mixedColor = smokeColor.mul(mass1).add(smokeColor2.mul(mass2)).div(max(mass, float(0.0001)));
        acc.rgb.addAssign(mixedColor.mul(lighting).mul(contribution));
        acc.a.addAssign(contribution);
      });
    });
    return acc;
  })();
  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = marched.rgb.div(max(marched.a, float(0.0001)));
  material.opacityNode = marched.a;
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.side = THREE.BackSide;
  const smoke = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  smoke.position.set(...low).add(new THREE.Vector3(...size).multiplyScalar(0.5));
  smoke.renderOrder = 3;
  smoke.frustumCulled = false;

  const root = new THREE.Group();
  root.visible = false;
  root.add(smoke);
  function makeCannon(name, position, tint) {
    const cannon = new THREE.Group();
    cannon.name = name;
    cannon.position.set(...position);
    root.add(cannon);
    const metal = new THREE.MeshStandardMaterial({ color: tint, metalness: 0.65, roughness: 0.45, side: THREE.DoubleSide });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 7, 48, 1, true), metal);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(-3.5, 0, 0);
    cannon.add(barrel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.12, 12, 48), metal);
    rim.rotation.y = Math.PI / 2;
    cannon.add(rim);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.96, 48), new THREE.MeshStandardMaterial({ color: '#111518', side: THREE.DoubleSide }));
    back.rotation.y = Math.PI / 2;
    back.position.set(-6.9, 0, 0);
    cannon.add(back);
    for (const x of [-5.5, -1.5]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 2.8), metal);
      support.position.set(x, -1.9, 0);
      cannon.add(support);
    }
    return cannon;
  }
  const cannon = makeCannon('Cannon 1', [0, 3, 0], '#444c50');
  const cannon2 = makeCannon('Cannon 2', [0, 3, 12], '#416879');
  const cube = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6),
    new THREE.MeshStandardMaterial({ color: '#30363d', metalness: 0.8, roughness: 0.32 }));
  cube.name = 'Collision cube';
  cube.position.set(20, 3, 0);
  root.add(cube);
  const lastEmitter = new THREE.Matrix4(), lastEmitter2 = new THREE.Matrix4(), lastCube = new THREE.Matrix4();
  let firstSync = true;
  function updateObjects() {
    root.updateMatrixWorld(true);
    if (firstSync || !lastEmitter.equals(cannon.matrixWorld) || !lastCube.equals(cube.matrixWorld)) {
      gpu.setObjects(cannon.matrixWorld, cube.matrixWorld);
      lastEmitter.copy(cannon.matrixWorld);
    }
    if (firstSync || !lastEmitter2.equals(cannon2.matrixWorld) || !lastCube.equals(cube.matrixWorld)) {
      gpu2.setObjects(cannon2.matrixWorld, cube.matrixWorld);
      lastEmitter2.copy(cannon2.matrixWorld);
    }
    lastCube.copy(cube.matrixWorld); firstSync = false;
  }
  updateObjects();
  return {
    root, cannon, cannon2, cube, updateObjects,
    advance(renderer, targetTime) { updateObjects(); const t = gpu.advance(renderer, targetTime); gpu2.advance(renderer, targetTime); return t; },
    reset() { gpu.reset(); gpu2.reset(); },
    setParams(params) {
      const { opacity, color, ...motion } = params;
      density.value = opacity;
      smokeColor.value.set(color);
      gpu.setParams(motion);
    },
    setSecondParams(params) {
      const { opacity, color, ...motion } = params;
      density2.value = opacity;
      smokeColor2.value.set(color);
      gpu2.setParams(motion);
    },
    inspect: gpu.inspect,
    inspectSecond: gpu2.inspect,
    dispose(renderer) {
      root.removeFromParent();
      gpu.dispose(renderer);
      gpu2.dispose(renderer);
      const geometries = new Set(), materials = new Set();
      root.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) for (const m of [object.material].flat()) materials.add(m);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
      root.clear();
    },
    get active() { return gpu.active + gpu2.active; }
  };
}
