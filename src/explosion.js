import * as THREE from 'three/webgpu';
import {
  Fn, storage, instanceIndex, float, vec2, vec3, vec4, uniform, int, uint, ivec3, uvec3,
  sin, cos, fract, pow, exp, max, min, mix, step, smoothstep, clamp, floor, abs,
  attribute, textureStore, texture3D, storageTexture3D, normalize, length, cameraPosition,
  positionWorld, Loop, If
} from 'three/tsl';

const N = 72;
const CELLS = N * N * N;
const DUST = 524288;

function smokeNoise() {
  const size = 128;
  const data = new Uint8Array(size * size * size);
  let seed = 0x7f4a7c15;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed >>> 24;
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function gridIndex() {
  const s = uint(N);
  return uvec3(instanceIndex.mod(s), instanceIndex.div(s).mod(s), instanceIndex.div(s.mul(s)));
}

function field() {
  const tex = new THREE.Storage3DTexture(N, N, N);
  tex.type = THREE.HalfFloatType;
  tex.format = THREE.RGBAFormat;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  return tex;
}

function loadClamp(tex, x, y, z) {
  const ix = uint(clamp(float(x), float(0), float(N - 1)));
  const iy = uint(clamp(float(y), float(0), float(N - 1)));
  const iz = uint(clamp(float(z), float(0), float(N - 1)));
  const texel = storageTexture3D(tex, uvec3(ix, iy, iz)).setSampler(false);
  texel.access = 'readWrite';
  return texel;
}

function sampleTrilinear(tex) {
  return Fn(([p]) => {
    const p0 = floor(p);
    const f = fract(p);
    const x0 = int(p0.x);
    const y0 = int(p0.y);
    const z0 = int(p0.z);
    const c000 = loadClamp(tex, x0, y0, z0);
    const c100 = loadClamp(tex, x0.add(1), y0, z0);
    const c010 = loadClamp(tex, x0, y0.add(1), z0);
    const c110 = loadClamp(tex, x0.add(1), y0.add(1), z0);
    const c001 = loadClamp(tex, x0, y0, z0.add(1));
    const c101 = loadClamp(tex, x0.add(1), y0, z0.add(1));
    const c011 = loadClamp(tex, x0, y0.add(1), z0.add(1));
    const c111 = loadClamp(tex, x0.add(1), y0.add(1), z0.add(1));
    const c00 = mix(c000, c100, f.x);
    const c10 = mix(c010, c110, f.x);
    const c01 = mix(c001, c101, f.x);
    const c11 = mix(c011, c111, f.x);
    return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
  });
}

function neighbor(tex, i, dx, dy, dz) {
  return loadClamp(tex, i.x.add(dx), i.y.add(dy), i.z.add(dz)).xyz;
}

function neighborX(tex, i, dx, dy, dz) {
  return loadClamp(tex, i.x.add(dx), i.y.add(dy), i.z.add(dz)).x;
}

export function createExplosion() {
  const noise = smokeNoise();
  const uDt = uniform(0.05);
  const uTime = uniform(0);
  const uCell = uniform(40);
  const uOrigin = uniform(new THREE.Vector3(-1400, 0, -1400));
  const uSize = uniform(new THREE.Vector3(2800, 2800, 2800));
  const uBuoy = uniform(18);
  const uVort = uniform(12);
  const uWind = uniform(0.15);
  const uShockR = uniform(0);
  const uMachH = uniform(0);
  const uImpulse = uniform(40);
  const uThick = uniform(50);
  const uInject = uniform(1);
  const uFireR = uniform(120);
  const uCool = uniform(0.25);
  const uDustN = uniform(DUST);
  const uDustSize = uniform(1);
  const uDustDiv = uniform(0.45);
  const uSideDust = uniform(1);
  const uStem = uniform(1);
  const uRingY = uniform(80);
  const uRingR = uniform(200);
  const uTube = uniform(120);
  const uCirc = uniform(8e5);
  const uSuck = uniform(0);
  const uOut = uniform(1);
  const uVapor = uniform(0);

  const velA = field();
  const velB = field();
  const denA = field();
  const denB = field();
  const divT = field();
  const preA = field();
  const preB = field();
  const shown = field();

  const posAttr = new THREE.StorageBufferAttribute(DUST, 3);
  const velAttr = new THREE.StorageBufferAttribute(DUST, 3);
  const metaAttr = new THREE.StorageBufferAttribute(DUST, 4);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', posAttr);
  dustGeo.setAttribute('sprite', metaAttr);
  dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  const posS = storage(posAttr, 'vec3', DUST);
  const velS = storage(velAttr, 'vec3', DUST);
  const metaS = storage(metaAttr, 'vec4', DUST);
  const U = {
    uDt, uTime, uCell, uOrigin, uSize, uBuoy, uVort, uWind,
    uShockR, uMachH, uImpulse, uThick, uInject, uFireR, uCool,
    uDustN, uDustSize, uDustDiv, uStem, uRingY, uRingR, uTube, uCirc, uSuck, uOut,
    posS, velS, metaS, shown
  };

  const kernels = {
    clearA: Fn(() => {
      const id = gridIndex();
      textureStore(velA, id, vec4(0, 0, 0, 0));
      textureStore(velB, id, vec4(0, 0, 0, 0));
      textureStore(denA, id, vec4(0, 0, 0, 0));
      textureStore(denB, id, vec4(0, 0, 0, 0));
    })().compute(CELLS, [64]),
    clearB: Fn(() => {
      const id = gridIndex();
      textureStore(preA, id, vec4(0, 0, 0, 0));
      textureStore(preB, id, vec4(0, 0, 0, 0));
      textureStore(divT, id, vec4(0, 0, 0, 0));
      textureStore(shown, id, vec4(0, 0, 0, 0));
    })().compute(CELLS, [64]),
    initDust: Fn(() => {
      const i = instanceIndex;
      const fi = float(i);
      const h = fract(sin(fi.mul(91.17)).mul(43758.5));
      const h2 = fract(sin(fi.mul(12.98)).mul(23421.6));
      const ang = h.mul(Math.PI * 2);
      const rad = pow(h2, float(0.5)).mul(uSize.x.mul(0.38));
      posS.element(i).assign(vec3(cos(ang).mul(rad), h.mul(8).add(1), sin(ang).mul(rad)));
      velS.element(i).assign(vec3(0, 0, 0));
      metaS.element(i).assign(vec4(30, 0, 0, 1));
    })().compute(DUST, [64]),
    aToB: pipe(velA, velB, denA, denB, divT, preA, preB, U),
    bToA: pipe(velB, velA, denB, denA, divT, preA, preB, U),
    dust: dustStep(U)
  };

  const marched = Fn(() => {
    const acc = vec4(0, 0, 0, 0).toVar();
    const rd = normalize(positionWorld.sub(cameraPosition));
    const ro = cameraPosition;
    const inv = vec3(1).div(rd.add(1e-5));
    const t0v = uOrigin.sub(ro).mul(inv);
    const t1v = uOrigin.add(uSize).sub(ro).mul(inv);
    const tsm = min(t0v, t1v);
    const tbg = max(t0v, t1v);
    const tNear = max(max(tsm.x, tsm.y), tsm.z);
    const tFar = min(min(tbg.x, tbg.y), tbg.z);
    const steps = float(80);
    const span = max(tFar.sub(max(tNear, float(0))), float(0));
    const stepLen = span.div(steps);
    const start = max(tNear, float(0));
    Loop(80, ({ i }) => {
      const t = start.add(float(i).add(0.5).mul(stepLen));
      const p = ro.add(rd.mul(t));
      const uvw = p.sub(uOrigin).div(uSize);
      const inside = smoothstep(float(0), float(0.001), uvw.x).mul(smoothstep(float(1), float(0.999), uvw.x))
        .mul(smoothstep(float(0), float(0.001), uvw.y)).mul(smoothstep(float(1), float(0.999), uvw.y))
        .mul(smoothstep(float(0), float(0.001), uvw.z)).mul(smoothstep(float(1), float(0.999), uvw.z));
      const s = texture3D(shown, clamp(uvw, vec3(0.001), vec3(0.999)));
      // The reference Blender material drives extinction with density and light with
      // a separate emission ramp. Keep those channels distinct in the raymarch.
      const radius = length(p.xz);
      const head = uRingY;
      const capRadius = max(uRingR, float(1));
      const capHeight = max(uTube.mul(0.74), uCell.mul(3));
      const age = smoothstep(float(0.25), float(3.5), uTime);
      // Advected 3D noise breaks the repeated horizontal bands made by the old
      // sine waves. The two scales give large folds and smaller edge detail.
      const drift = vec3(uTime.mul(uCell.mul(0.09)), uTime.mul(uCell.mul(-0.18)), 0);
      const broad = texture3D(noise, p.add(drift).div(uCell.mul(1024))).r.sub(0.5);
      const detail = texture3D(noise, p.add(drift.mul(1.7)).add(vec3(419, 173, 311))
        .div(uCell.mul(384))).r.sub(0.5);
      const ridge = broad.mul(1.55).add(detail.mul(0.62));
      const warp = ridge.mul(uCell.mul(3.1));
      // Couple radial and vertical motion without a repeating roll phase.
      const rollNoise = texture3D(noise, vec3(
        p.x.add(radius.mul(0.23)),
        p.y.sub(radius.mul(0.38)).sub(uTime.mul(uCell.mul(0.3))),
        p.z.sub(radius.mul(0.19))
      ).div(uCell.mul(640))).r.sub(0.5);
      const rollMask = smoothstep(head.sub(capHeight.mul(1.6)), head, p.y).mul(age);
      const rolledY = p.y.add(rollNoise.mul(uCell.mul(6.5)).mul(rollMask));
      const rolledRadius = radius.add(warp).add(rollNoise.mul(uCell.mul(4.5)).mul(rollMask));
      const stemRadius = mix(uFireR.mul(0.78), capRadius.mul(0.43), clamp(p.y.div(head.add(1)), 0, 1)).mul(uStem);
      const stem = smoothstep(stemRadius.add(uCell.mul(2)), stemRadius.sub(uCell.mul(0.9)), radius.add(warp))
        .mul(smoothstep(float(0), uCell.mul(2), p.y))
        .mul(smoothstep(head.add(uCell.mul(3)), head.sub(uCell.mul(2)), p.y));
      const dome = smoothstep(float(1.14), float(0.77), length(vec2(
        rolledRadius.div(capRadius), rolledY.sub(head).div(capHeight)
      )));
      const rim = smoothstep(float(1.18), float(0.65), length(vec2(
        rolledRadius.sub(capRadius.mul(0.75)).div(uTube.mul(0.72).add(1)),
        rolledY.sub(head.sub(capHeight.mul(0.3))).div(capHeight.mul(0.56))
      )));
      const cap = max(dome, rim.mul(0.75));
      const wisps = clamp(float(0.88).add(ridge.mul(0.38)).add(rollNoise.mul(rollMask).mul(0.38)), 0.3, 1.45);
      const capReveal = smoothstep(float(2.5), float(6.5), uTime)
        .mul(smoothstep(uFireR.mul(0.9), uFireR.mul(1.7), head));
      const plume = max(stem.mul(1.28), cap.mul(capReveal).mul(1.18)).mul(wisps).mul(age);
      // The hot ball becomes the dense foot of the same volume that grows the stem.
      const fireCenter = vec3(0, uFireR.mul(0.22).add(uTime.mul(uCell.mul(0.12))), 0);
      const fireDistance = length(p.sub(fireCenter));
      const fireBall = smoothstep(uFireR.mul(1.28), uFireR.mul(0.78), fireDistance.add(warp.mul(0.22)))
        .mul(float(1).sub(smoothstep(float(1.1), float(3.8), uTime)));
      const sourceSmoke = s.r.mul(float(1).sub(smoothstep(float(2), float(6), uTime))).mul(0.35);

      // Eight low, radial dust streams. Their height advances much more slowly
      // than the head and their angular bands are cut into broad, billowy lobes.
      const nx = p.x.div(radius.add(1));
      const nz = p.z.div(radius.add(1));
      const cos2 = nx.mul(nx).sub(nz.mul(nz));
      const cos4 = cos2.mul(cos2).mul(2).sub(1);
      const cos8 = cos4.mul(cos4).mul(2).sub(1);
      const fineDust = texture3D(noise, p.add(vec3(227, 509, 83))
        .div(uCell.mul(256))).r.sub(0.5).mul(0.6);
      const eightLobes = smoothstep(float(-0.12), float(0.72), cos8.add(fineDust.mul(0.45)));
      const sideFront = uFireR.mul(0.95).add(min(uTime, float(8)).mul(uCell.mul(1.95)));
      const sideRadius = radius.add(warp.mul(0.26)).add(fineDust.mul(uCell.mul(0.55)));
      const sideY = uCell.mul(1.3).add(radius.mul(0.075)).add(min(uTime, float(7)).mul(uCell.mul(0.16)));
      const sideHeight = uCell.mul(1.45).add(radius.mul(0.05));
      // A dense common base joins the eight streams at ground zero.
      const sharedBase = smoothstep(uFireR.mul(1.35), uFireR.mul(0.55), sideRadius).mul(0.95);
      const sideDust = max(eightLobes, sharedBase)
        .mul(smoothstep(sideFront.add(uCell.mul(2)), sideFront.sub(uCell.mul(5)), sideRadius))
        .mul(smoothstep(sideHeight, sideHeight.mul(0.18), abs(p.y.sub(sideY))))
        .mul(smoothstep(float(0.35), float(1.8), uTime))
        .mul(float(1).sub(smoothstep(float(32), float(62), uTime)))
        .mul(clamp(float(0.92).add(fineDust).add(ridge.mul(0.22)), 0.3, 1.5))
        .mul(uSideDust);

      // Condensation is a short-lived, uneven skin around the moving blast.
      // Its lower part evaporates first; beyond this interval the pressure
      // front remains in the ground effects, without a visible sphere or tail.
      const shockDistance = length(p.sub(vec3(0, uFireR.mul(0.23), 0)));
      const shellBand = smoothstep(uThick.mul(1.8), uThick.mul(0.22),
        abs(shockDistance.sub(uShockR)).add(warp.mul(0.2)));
      const inversion = min(uSize.y.mul(0.32), uShockR.mul(0.5).add(uCell.mul(3)));
      const clearHeight = max(uTime.sub(1.1), float(0)).mul(inversion.mul(0.65));
      const condensation = shellBand
        .mul(smoothstep(float(0.2), float(0.9), uTime))
        .mul(float(1).sub(smoothstep(float(1.8), float(3.6), uTime)))
        .mul(smoothstep(clearHeight.sub(uCell), clearHeight.add(uCell), p.y))
        .mul(smoothstep(inversion.add(uCell.mul(2)), inversion.sub(uCell), p.y))
        .mul(mix(float(0.38), float(0.8), uVapor));
      const dens = max(max(sourceSmoke, plume), fireBall.mul(0.9))
        .add(sideDust.mul(3.2)).add(condensation.mul(0.38));
      const ballHeat = fireBall.mul(float(1).sub(smoothstep(float(1.4), float(3.6), uTime)));
      const hot = max(s.g.mul(float(1).sub(smoothstep(float(5), float(13), uTime))), ballHeat);
      const heat = smoothstep(float(0.12), float(0.8), hot);
      const smoke = mix(vec3(0.58, 0.48, 0.4), vec3(0.18, 0.16, 0.15), smoothstep(float(0.2), float(1.15), dens));
      const dustySmoke = mix(smoke, vec3(0.34, 0.27, 0.2), clamp(sideDust.mul(0.8), 0, 0.8));
      const sunSide = clamp(float(0.55).add(p.x.div(radius.add(1)).mul(0.25)), 0.25, 0.85);
      const litSmoke = mix(
        dustySmoke.mul(sunSide.add(smoothstep(float(0.2), float(0.9), cap).mul(0.25))),
        vec3(0.68, 0.7, 0.68), clamp(condensation.mul(0.85), 0, 0.75)
      );
      const fire = mix(vec3(0.82, 0.15, 0.015), vec3(1.0, 0.92, 0.76), smoothstep(float(0.3), float(1), hot));
      const transmittance = float(1).sub(acc.w);
      const opticalDepth = dens.mul(stepLen).mul(0.028).mul(inside);
      const alpha = float(1).sub(exp(opticalDepth.negate()));
      acc.xyz.addAssign(mix(litSmoke, fire.mul(1.5), heat).mul(alpha).mul(transmittance));
      const innerRed = stem.mul(float(1).sub(smoothstep(float(5), float(27), uTime)))
        .mul(float(1).sub(smoothstep(uSize.y.mul(0.2), uSize.y.mul(0.62), head)))
        .mul(smoothstep(float(0), uCell.mul(4), p.y));
      acc.xyz.addAssign(vec3(0.8, 0.035, 0.008).mul(innerRed.mul(stepLen).mul(0.007)).mul(transmittance));
      acc.w.addAssign(alpha.mul(transmittance));
    });
    return vec4(acc.xyz, clamp(acc.w, 0, 1));
  })();

  const volumeMat = new THREE.MeshBasicNodeMaterial();
  volumeMat.transparent = true;
  volumeMat.depthWrite = false;
  // The box's back face is behind buildings *inside* it. Depth testing that
  // face makes the smoke disappear over those buildings even when smoke is near.
  volumeMat.depthTest = false;
  volumeMat.side = THREE.BackSide;
  // The raymarch accumulates premultiplied color; Three's alpha blend expects
  // straight color and would otherwise apply opacity a second time.
  volumeMat.colorNode = marched.rgb.div(max(marched.a, float(0.001)));
  volumeMat.opacityNode = marched.a;
  const volume = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), volumeMat);
  volume.frustumCulled = false;
  volume.renderOrder = 2;
  volume.visible = false;

  const dustMat = new THREE.PointsNodeMaterial();
  dustMat.transparent = true;
  dustMat.depthWrite = false;
  dustMat.sizeAttenuation = true;
  const sprite = attribute('sprite', 'vec4');
  dustMat.colorNode = mix(vec3(0.66, 0.52, 0.36), vec3(0.32, 0.26, 0.2), sprite.z);
  dustMat.opacityNode = sprite.y;
  dustMat.sizeNode = sprite.x;
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 4;
  dust.visible = false;

  const skin = plasmaSkin();
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xfff1c4,
    map: skin,
    emissive: 0xff4a10,
    emissiveMap: skin,
    emissiveIntensity: 7.5,
    roughness: 0.58,
    metalness: 0
  });
  const coreGeometry = new THREE.SphereGeometry(1, 72, 56);
  const vertices = coreGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i);
    const y = vertices.getY(i);
    const z = vertices.getZ(i);
    const roll = Math.sin(x * 11 + Math.sin(y * 7)) * Math.sin(z * 9 - y * 5);
    const billow = Math.sin(x * 4 + z * 3) * Math.cos(y * 6 - z * 2);
    const r = 1 + roll * 0.035 + billow * 0.065;
    vertices.setXYZ(i, x * r, y * r, z * r);
  }
  coreGeometry.computeVertexNormals();
  const core = new THREE.Mesh(coreGeometry, coreMat);
  core.visible = false;
  core.renderOrder = 1;

  const root = new THREE.Group();
  root.add(volume, core, dust);

  const state = { shockRadius: 0, machH: 0, flash: 0, plumeH: 0, simTime: 0 };
  let readA = true;
  let cleared = false;

  function reset() {
    cleared = false;
    readA = true;
    state.simTime = 0;
  }

  function sync(p, time, spectacle, overWater = false) {
    const spec = Math.max(0.35, p.scale * Math.pow(Math.max(spectacle, 0.4), 0.42));
    const box = 1100 * spec;
    uCell.value = box / N;
    uOrigin.value.set(-box * 0.5, 0, -box * 0.5);
    uSize.value.set(box, box, box);
    uBuoy.value = 3.2 * (36 / Math.max(12, p.plume));
    uVort.value = 5.5 * p.cap;
    uWind.value = p.wind * 6;
    uCool.value = 0.03;
    uDustN.value = Math.min(DUST, Math.max(20000, p.particles * p.dust * 0.35));
    uDustSize.value = p.dustSize;
    uDustDiv.value = p.dustDiv;
    uSideDust.value = Math.max(0.2, Math.min(1.6, p.dust / 0.5));
    uStem.value = p.stem;
    uVapor.value = overWater ? 1 : 0;
    uThick.value = 36 * p.shockThick * Math.sqrt(spec);
    const t = Math.max(time, 0);
    const shockMs = Math.min(700, Math.max(343, p.shock));
    const shockR = shockMs * 0.35 * t * Math.exp(-t / 140);
    const mass = Math.max(0.4, p.mass || 8);
    const fireR = 55 * Math.cbrt(mass) * p.scale * (1 - Math.exp(-t / 0.13));
    const machH = shockR > 40 ? Math.min(22 * p.shockThick, 48) : 0;
    const over = Math.exp(-shockR / (700 * spec)) * Math.exp(-Math.max(t - 0.4, 0) / 4.5);
    const suck = t > 1.1 ? (1 - Math.exp(-(t - 1.1) / 2.4)) * Math.exp(-t / 28) : 0;
    const rise = 1 - Math.exp(-t / Math.max(18, p.plume * 0.85));
    uShockR.value = shockR;
    uMachH.value = machH;
    uSuck.value = time >= 0 ? suck : 0;
    uOut.value = time >= 0 ? over : 0;
    const head = Math.min(box * 0.68, 45 + rise * box * 0.56 * (p.plume / 36));
    uRingY.value = head;
    uRingR.value = Math.min(box * 0.31, 45 + head * 0.42 * p.cap);
    uTube.value = Math.max(55, uRingR.value * 0.55);
    uCirc.value = uTube.value * uTube.value * (30 + 55 * rise) * p.cap * Math.sqrt(spec);
    uFireR.value = Math.max(30, fireR);
    uImpulse.value = 90 * p.shockThick * spec;
    uInject.value = time >= 0 && time < 2.8 ? p.flash : 0;
    uTime.value = time;
    state.shockRadius = time >= 0 ? shockR : 0;
    state.machH = time >= 0 ? machH : 0;
    state.suck = time >= 0 ? suck : 0;
    state.outward = time >= 0 ? over : 0;
    state.flash = time >= 0 ? Math.exp(-time * 2.2) * p.flash : 0;
    state.plumeH = head;
    const show = time >= 0;
    volume.visible = show;
    const ball = t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) / 2.1);
    coreMat.transparent = true;
    coreMat.opacity = ball;
    coreMat.emissiveIntensity = 7.5 * ball;
    core.visible = show && ball > 0.04 && fireR > 2;
    core.scale.setScalar(Math.max(2, fireR * (0.4 + 0.6 * Math.min(1, t / 0.22)) * (0.45 + 0.55 * ball)));
    core.position.y = Math.max(8, fireR * 0.2);
    core.rotation.y = t * 0.11;
    dust.visible = show;
    volume.position.set(0, box * 0.5, 0);
    volume.scale.setScalar(box);
  }

  function step(renderer, dt, live) {
    if (!live) return;
    if (!cleared) {
      renderer.compute(kernels.clearA);
      renderer.compute(kernels.clearB);
      renderer.compute(kernels.initDust);
      cleared = true;
      readA = true;
      state.simTime = 0;
    }
    if (uTime.value + 0.02 < state.simTime) {
      renderer.compute(kernels.clearA);
      renderer.compute(kernels.clearB);
      renderer.compute(kernels.initDust);
      readA = true;
      state.simTime = 0;
    }
    let guard = 0;
    while (state.simTime < uTime.value - 1e-3 && guard < 3) {
      uDt.value = Math.min(0.05, uTime.value - state.simTime);
      const pipeK = readA ? kernels.aToB : kernels.bToA;
      renderer.compute(pipeK.advectV);
      renderer.compute(pipeK.advectD);
      renderer.compute(pipeK.force);
      renderer.compute(pipeK.div);
      for (let i = 0; i < 8; i++) renderer.compute(i % 2 === 0 ? pipeK.jacobi0 : pipeK.jacobi1);
      renderer.compute(pipeK.project);
      renderer.compute(pipeK.copyDen);
      renderer.compute(pipeK.publish);
      renderer.compute(kernels.dust);
      readA = !readA;
      state.simTime += uDt.value;
      guard++;
    }
  }

  return { root, sync, step, reset, state };
}

function pipe(velR, velW, denR, denW, divT, preA, preB, U) {
  const sVel = sampleTrilinear(velR);
  const sDen = sampleTrilinear(denR);

  const advectV = Fn(() => {
    const id = gridIndex();
    const p = vec3(float(id.x), float(id.y), float(id.z));
    const v = loadClamp(velR, id.x, id.y, id.z).xyz;
    const back = clamp(p.sub(v.mul(U.uDt).div(U.uCell)), vec3(0.5), vec3(N - 1.5));
    textureStore(velW, id, vec4(sVel(back).xyz, 0));
  })().compute(CELLS, [64]);

  const advectD = Fn(() => {
    const id = gridIndex();
    const p = vec3(float(id.x), float(id.y), float(id.z));
    const v = loadClamp(velW, id.x, id.y, id.z).xyz;
    const back = clamp(p.sub(v.mul(U.uDt).div(U.uCell)), vec3(0.5), vec3(N - 1.5));
    textureStore(denW, id, vec4(sDen(back).xyz, 0));
  })().compute(CELLS, [64]);

  const force = Fn(() => {
    const id = gridIndex();
    const i = ivec3(id);
    const p = vec3(float(id.x), float(id.y), float(id.z));
    const v = loadClamp(velW, i.x, i.y, i.z).xyz.toVar();
    const d = loadClamp(denW, i.x, i.y, i.z).toVar();
    const curlAt = (ox, oy, oz) => {
      const c = ivec3(i.x.add(ox), i.y.add(oy), i.z.add(oz));
      const l = neighbor(velW, c, 1, 0, 0);
      const rgt = neighbor(velW, c, -1, 0, 0);
      const up = neighbor(velW, c, 0, 1, 0);
      const dn = neighbor(velW, c, 0, -1, 0);
      const fr = neighbor(velW, c, 0, 0, 1);
      const bk = neighbor(velW, c, 0, 0, -1);
      return vec3(
        up.z.sub(dn.z).sub(fr.y.sub(bk.y)),
        fr.x.sub(bk.x).sub(l.z.sub(rgt.z)),
        l.y.sub(rgt.y).sub(up.x.sub(dn.x))
      ).mul(0.5);
    };
    const curl = curlAt(0, 0, 0);
    const mag = length(curl);
    const eta = vec3(
      length(curlAt(1, 0, 0)).sub(length(curlAt(-1, 0, 0))),
      length(curlAt(0, 1, 0)).sub(length(curlAt(0, -1, 0))),
      length(curlAt(0, 0, 1)).sub(length(curlAt(0, 0, -1)))
    );
    const etaN = eta.div(length(eta).add(1e-4));
    v.addAssign(etaN.cross(curl).mul(U.uVort).mul(U.uDt));
    v.y.addAssign(d.g.mul(U.uBuoy).mul(U.uDt));
    v.x.addAssign(U.uWind.mul(U.uDt).mul(d.g));
    v.mulAssign(float(1).sub(U.uDt.mul(0.06)));

    const center = vec3(float(N).mul(0.5), float(4), float(N).mul(0.5));
    const inside = smoothstep(float(5.5), float(1.2), length(p.sub(center)));
    d.g.assign(max(d.g, inside.mul(U.uInject)));
    d.r.assign(max(d.r, inside.mul(U.uInject)));
    d.g.mulAssign(float(1).sub(U.uDt.mul(U.uCool)));
    d.r.mulAssign(float(1).sub(U.uDt.mul(0.012)));
    d.b.assign(max(d.b.mul(float(1).sub(U.uDt.mul(0.02))), d.g.mul(0.2)));
    If(id.y.equal(uint(0)), () => { v.y.assign(max(v.y, float(0))); });
    If(id.y.equal(uint(N - 1)), () => { v.y.assign(min(v.y, float(0))); });
    textureStore(velR, id, vec4(v, mag));
    textureStore(denR, id, vec4(clamp(d.rgb, vec3(0), vec3(4)), 0));
  })().compute(CELLS, [64]);

  const div = Fn(() => {
    const id = gridIndex();
    const i = ivec3(id);
    const divergence = neighbor(velR, i, 1, 0, 0).x.sub(neighbor(velR, i, -1, 0, 0).x)
      .add(neighbor(velR, i, 0, 1, 0).y.sub(neighbor(velR, i, 0, -1, 0).y))
      .add(neighbor(velR, i, 0, 0, 1).z.sub(neighbor(velR, i, 0, 0, -1).z))
      .mul(0.5);
    textureStore(divT, id, vec4(divergence, 0, 0, 0));
    textureStore(preA, id, vec4(0, 0, 0, 0));
    textureStore(preB, id, vec4(0, 0, 0, 0));
  })().compute(CELLS, [64]);

  const jacobi = (readP, writeP) => Fn(() => {
    const id = gridIndex();
    const i = ivec3(id);
    const sum = neighborX(readP, i, 1, 0, 0).add(neighborX(readP, i, -1, 0, 0))
      .add(neighborX(readP, i, 0, 1, 0)).add(neighborX(readP, i, 0, -1, 0))
      .add(neighborX(readP, i, 0, 0, 1)).add(neighborX(readP, i, 0, 0, -1));
    textureStore(writeP, id, vec4(sum.sub(loadClamp(divT, i.x, i.y, i.z).x).mul(1 / 6), 0, 0, 0));
  })().compute(CELLS, [64]);

  const project = Fn(() => {
    const id = gridIndex();
    const i = ivec3(id);
    const v = loadClamp(velR, i.x, i.y, i.z).xyz.toVar();
    v.x.subAssign(neighborX(preA, i, 1, 0, 0).sub(neighborX(preA, i, -1, 0, 0)).mul(0.5));
    v.y.subAssign(neighborX(preA, i, 0, 1, 0).sub(neighborX(preA, i, 0, -1, 0)).mul(0.5));
    v.z.subAssign(neighborX(preA, i, 0, 0, 1).sub(neighborX(preA, i, 0, 0, -1)).mul(0.5));
    If(id.y.equal(uint(0)), () => { v.y.assign(max(v.y, float(0))); });
    textureStore(velW, id, vec4(v, 0));
  })().compute(CELLS, [64]);

  const copyDen = Fn(() => {
    const id = gridIndex();
    textureStore(denW, id, loadClamp(denR, id.x, id.y, id.z));
  })().compute(CELLS, [64]);

  const publish = Fn(() => {
    const id = gridIndex();
    textureStore(U.shown, id, loadClamp(denW, id.x, id.y, id.z));
  })().compute(CELLS, [64]);

  return { advectV, advectD, force, div, jacobi0: jacobi(preA, preB), jacobi1: jacobi(preB, preA), project, copyDen, publish };
}

function dustStep(U) {
  return Fn(() => {
    const i = instanceIndex;
    const fi = float(i);
    const alive = step(fi, U.uDustN);
    const h = fract(sin(fi.mul(91.17)).mul(43758.5));
    const h2 = fract(sin(fi.mul(12.98)).mul(23421.6));
    const ang = h.mul(Math.PI * 2);
    const lane = h2.sub(0.5);
    const front = step(float(8), U.uShockR);
    const r = max(U.uShockR.add(lane.mul(U.uThick).mul(float(0.35).add(U.uDustDiv.mul(0.4)))), float(0));
    const y = float(0.3).add(h2.mul(U.uCell.mul(0.7)));
    const pos = vec3(cos(ang).mul(r), y, sin(ang).mul(r));
    const alpha = front.mul(alive).mul(U.uOut)
      .mul(float(1).sub(smoothstep(float(2.5), float(5.5), U.uTime)))
      .mul(float(0.26).add(U.uDustSize.mul(0.2)));
    U.posS.element(i).assign(pos);
    U.metaS.element(i).assign(vec4(
      U.uDustSize.mul(float(14).add(h.mul(22))),
      clamp(alpha, 0, 0.75),
      0,
      1
    ));
  })().compute(DUST, [64]);
}

function plasmaSkin() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(512, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const n = Math.sin(x * 0.17) * Math.sin(y * 0.23) + Math.sin(x * 0.05 + y * 0.08) * 0.6;
      const f = (n + 1.4) / 2.4;
      const i = (y * 512 + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 70 + f * 170;
      img.data[i + 2] = 20 + (1 - f) * 40;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

