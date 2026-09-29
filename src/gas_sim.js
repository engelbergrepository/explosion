import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, cameraPosition, clamp, dot, exp, float, fract, instanceIndex,
  int, max, min, mix, normalize, positionWorld, pow,
  smoothstep, storageTexture3D, texture3D, textureStore, uint, uniform,
  uvec3, vec3, vec4, floor
} from 'three/tsl';

// This solver is separate from the historical animated explosion. It evolves
// density, temperature, and velocity from a compact source at ground zero.
const N = 64;
const CELLS = N * N * N;
const BOX = 1500;
const CELL = BOX / N;
const DT = 0.1;
const RAY_STEPS = 96;

function field() {
  const texture = new THREE.Storage3DTexture(N, N, N);
  texture.type = THREE.HalfFloatType;
  texture.format = THREE.RGBAFormat;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  return texture;
}

function gridIndex() {
  const s = uint(N);
  return uvec3(instanceIndex.mod(s), instanceIndex.div(s).mod(s), instanceIndex.div(s.mul(s)));
}

function load(tex, x, y, z) {
  const coord = uvec3(
    uint(clamp(float(x), 0, N - 1)),
    uint(clamp(float(y), 0, N - 1)),
    uint(clamp(float(z), 0, N - 1))
  );
  const value = storageTexture3D(tex, coord).setSampler(false);
  value.access = 'readWrite';
  return value;
}

function trilinear(tex) {
  return Fn(([p]) => {
    const base = floor(p);
    const f = fract(p);
    const x = int(base.x);
    const y = int(base.y);
    const z = int(base.z);
    const c00 = mix(load(tex, x, y, z), load(tex, x.add(1), y, z), f.x);
    const c10 = mix(load(tex, x, y.add(1), z), load(tex, x.add(1), y.add(1), z), f.x);
    const c01 = mix(load(tex, x, y, z.add(1)), load(tex, x.add(1), y, z.add(1)), f.x);
    const c11 = mix(load(tex, x, y.add(1), z.add(1)), load(tex, x.add(1), y.add(1), z.add(1)), f.x);
    return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
  });
}

export function createGasSimulation(sunDirection) {
  const velocity = field();
  const density = field();
  const velocityAdvected = field();
  const densityAdvected = field();
  const velocityNext = field();
  const densityNext = field();

  const uStepTime = uniform(0);
  const uOutward = uniform(120);
  const uUpward = uniform(45);
  const uDuration = uniform(0.9);
  const uPressure = uniform(800);
  const uBuoyancy = uniform(24);
  const uDrag = uniform(0.18);
  const uCooling = uniform(0.06);
  const uThinning = uniform(0.008);
  const uDensity = uniform(1);
  const uSmokeColor = uniform(new THREE.Color('#786c60'));
  const uEmissionColor = uniform(new THREE.Color('#ff4b12'));
  const uEmission = uniform(1.6);
  const uSun = uniform(1.2);
  const uShadow = uniform(1.1);
  const uAnisotropy = uniform(0.5);

  const source = vec3(0, CELL * 3, 0);
  const sampleVelocity = trilinear(velocity);
  const sampleDensity = trilinear(density);

  const initialize = Fn(() => {
    const id = gridIndex();
    const p = vec3(float(id.x).add(0.5), float(id.y).add(0.5), float(id.z).add(0.5));
    const world = p.mul(CELL).sub(vec3(BOX * 0.5, 0, BOX * 0.5));
    const offset = world.sub(source);
    const radius2 = dot(offset, offset);
    const seed = exp(radius2.div(-2 * (CELL * 1.65) ** 2));
    const direction = normalize(offset.add(vec3(0, CELL * 0.18, 0)));
    const v = direction.mul(uOutward).add(vec3(0, uUpward, 0)).mul(seed);
    const gas = vec4(seed.mul(2.1), seed.mul(1.5), 0, 0);
    textureStore(velocity, id, vec4(v, 0));
    textureStore(density, id, gas);
  })().compute(CELLS, [64]);

  const advect = Fn(() => {
    const id = gridIndex();
    const p = vec3(float(id.x), float(id.y), float(id.z));
    const v = load(velocity, id.x, id.y, id.z).xyz;
    const back = clamp(p.sub(v.mul(DT / CELL)), vec3(0.5), vec3(N - 1.5));
    textureStore(velocityAdvected, id, sampleVelocity(back));
    textureStore(densityAdvected, id, sampleDensity(back));
  })().compute(CELLS, [64]);

  const forces = Fn(() => {
    const id = gridIndex();
    const ix = int(id.x);
    const iy = int(id.y);
    const iz = int(id.z);
    const p = vec3(float(id.x).add(0.5), float(id.y).add(0.5), float(id.z).add(0.5));
    const world = p.mul(CELL).sub(vec3(BOX * 0.5, 0, BOX * 0.5));
    const offset = world.sub(source);
    const sourceWeight = exp(dot(offset, offset).div(-2 * (CELL * 1.45) ** 2));
    const feed = float(1).sub(smoothstep(uDuration.mul(0.75), uDuration, uStepTime));
    const v = load(velocityAdvected, ix, iy, iz).xyz.toVar();
    const d = load(densityAdvected, ix, iy, iz).xy.toVar();

    const pressureAt = (dx, dy, dz) => {
      const s = load(densityAdvected, ix.add(dx), iy.add(dy), iz.add(dz));
      return s.r.mul(s.g);
    };
    const grad = vec3(
      pressureAt(1, 0, 0).sub(pressureAt(-1, 0, 0)),
      pressureAt(0, 1, 0).sub(pressureAt(0, -1, 0)),
      pressureAt(0, 0, 1).sub(pressureAt(0, 0, -1))
    ).mul(0.5 / CELL);
    v.subAssign(grad.mul(uPressure).mul(DT));
    v.y.addAssign(d.y.mul(uBuoyancy).mul(DT));
    v.mulAssign(exp(uDrag.mul(-DT)));

    const sourceDirection = normalize(offset.add(vec3(0, CELL * 0.2, 0)));
    v.addAssign(sourceDirection.mul(uOutward).add(vec3(0, uUpward, 0))
      .mul(sourceWeight).mul(feed).mul(DT * 1.5));
    d.x.addAssign(sourceWeight.mul(feed).mul(DT * 2.5));
    d.y.addAssign(sourceWeight.mul(feed).mul(DT * 1.8));
    d.x.mulAssign(exp(uThinning.mul(-DT)));
    d.y.mulAssign(exp(uCooling.mul(-DT)));

    // Keep the field inside the domain; the ground cannot pull gas below it.
    If(id.x.equal(uint(0)), () => { v.x.assign(max(v.x, float(0))); });
    If(id.x.equal(uint(N - 1)), () => { v.x.assign(min(v.x, float(0))); });
    If(id.y.equal(uint(0)), () => { v.y.assign(max(v.y, float(0))); });
    If(id.y.equal(uint(N - 1)), () => { v.y.assign(min(v.y, float(0))); });
    If(id.z.equal(uint(0)), () => { v.z.assign(max(v.z, float(0))); });
    If(id.z.equal(uint(N - 1)), () => { v.z.assign(min(v.z, float(0))); });
    textureStore(velocityNext, id, vec4(v, 0));
    textureStore(densityNext, id, vec4(clamp(d, 0, 8), 0, 0));
  })().compute(CELLS, [64]);

  const publish = Fn(() => {
    const id = gridIndex();
    const v = load(velocityNext, id.x, id.y, id.z);
    const d = load(densityNext, id.x, id.y, id.z);
    textureStore(velocity, id, v);
    textureStore(density, id, d);
  })().compute(CELLS, [64]);

  const marched = Fn(() => {
    const acc = vec4(0, 0, 0, 0).toVar();
    const rd = normalize(positionWorld.sub(cameraPosition));
    const ro = cameraPosition;
    const low = vec3(-BOX * 0.5, 0, -BOX * 0.5);
    const high = low.add(BOX);
    const inv = vec3(1).div(rd.add(1e-5));
    const near3 = min(low.sub(ro).mul(inv), high.sub(ro).mul(inv));
    const far3 = max(low.sub(ro).mul(inv), high.sub(ro).mul(inv));
    const start = max(max(max(near3.x, near3.y), near3.z), float(0));
    const end = min(min(far3.x, far3.y), far3.z);
    const stepLength = max(end.sub(start), float(0)).div(RAY_STEPS);
    const lightDir = normalize(sunDirection);
    const viewLight = clamp(dot(rd.negate(), lightDir), -1, 1);
    const g = uAnisotropy;
    const phase = clamp(float(1).sub(g.mul(g)).div(pow(
      float(1).add(g.mul(g)).sub(g.mul(viewLight).mul(2)), float(1.5)
    )), 0.25, 2.8);

    Loop(RAY_STEPS, ({ i }) => {
      const p = ro.add(rd.mul(start.add(float(i).add(0.5).mul(stepLength))));
      const uvw = p.sub(low).div(BOX);
      const inside = smoothstep(float(0), float(0.002), uvw.x)
        .mul(float(1).sub(smoothstep(float(0.998), float(1), uvw.x)))
        .mul(smoothstep(float(0), float(0.002), uvw.y))
        .mul(float(1).sub(smoothstep(float(0.998), float(1), uvw.y)))
        .mul(smoothstep(float(0), float(0.002), uvw.z))
        .mul(float(1).sub(smoothstep(float(0.998), float(1), uvw.z)));
      const gas = texture3D(density, clamp(uvw, vec3(0.001), vec3(0.999)));
      const mass = gas.r.mul(uDensity).mul(inside);
      const alpha = float(1).sub(exp(mass.mul(stepLength).mul(-0.035)));
      const shadowUv = clamp(uvw.add(lightDir.mul(0.055)), vec3(0.001), vec3(0.999));
      const shadowMass = texture3D(density, shadowUv).r;
      const sunlight = exp(shadowMass.mul(uShadow).mul(-0.45)).mul(phase).mul(uSun);
      const hot = smoothstep(float(0.08), float(0.9), gas.g);
      const smoke = uSmokeColor.mul(float(0.3).add(sunlight));
      const color = smoke.add(uEmissionColor.mul(hot).mul(uEmission));
      const transmittance = float(1).sub(acc.w);
      acc.xyz.addAssign(color.mul(alpha).mul(transmittance));
      acc.w.addAssign(alpha.mul(transmittance));
    });
    return vec4(acc.xyz, clamp(acc.w, 0, 1));
  })();

  const material = new THREE.MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.side = THREE.BackSide;
  material.colorNode = marched.rgb.div(max(marched.a, float(0.001)));
  material.opacityNode = marched.a;
  const root = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  root.position.set(0, BOX * 0.5, 0);
  root.scale.setScalar(BOX);
  root.frustumCulled = false;
  root.renderOrder = 2;
  root.visible = false;

  let currentStep = 0;
  let needsInit = true;
  let physicalSettings = '';
  function reset() {
    currentStep = 0;
    needsInit = true;
  }

  function setParams({ density: densityScale, smokeColor, emissionColor, emission,
    sun, shadow, anisotropy, radialVelocity, initialRise, duration,
    pressure, buoyancy, drag, cooling, thinning }) {
    uDensity.value = densityScale;
    uSmokeColor.value.set(smokeColor);
    uEmissionColor.value.set(emissionColor);
    uEmission.value = emission;
    uSun.value = sun;
    uShadow.value = shadow;
    uAnisotropy.value = anisotropy;
    const settings = JSON.stringify([radialVelocity, initialRise, duration, pressure,
      buoyancy, drag, cooling, thinning]);
    if (settings !== physicalSettings) {
      physicalSettings = settings;
      uOutward.value = radialVelocity;
      uUpward.value = initialRise;
      uDuration.value = duration;
      uPressure.value = pressure;
      uBuoyancy.value = buoyancy;
      uDrag.value = drag;
      uCooling.value = cooling;
      uThinning.value = thinning;
      reset();
    }
  }

  function advance(renderer, targetTime, maxSteps = 6) {
    const targetStep = Math.max(0, Math.floor(targetTime / DT + 1e-4));
    if (targetStep < currentStep) reset();
    if (needsInit) {
      renderer.compute(initialize);
      needsInit = false;
    }
    let count = 0;
    while (currentStep < targetStep && count < maxSteps) {
      uStepTime.value = currentStep * DT;
      renderer.compute(advect);
      renderer.compute(forces);
      renderer.compute(publish);
      currentStep++;
      count++;
    }
    return currentStep * DT;
  }

  return {
    root, advance, reset, setParams,
    get ready() { return !needsInit; },
    get simTime() { return currentStep * DT; },
    get focusY() { return Math.max(85, Math.min(900, 85 + currentStep * DT * 17)); }
  };
}
