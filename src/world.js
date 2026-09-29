import * as THREE from 'three/webgpu';
import { float, mix, positionWorld, positionGeometry, smoothstep, vec3, length, sin, fract, cos, normalize, pow, uniform, Fn, vec2, floor, dot, normalWorld, clamp, exp } from 'three/tsl';

const TAU = Math.PI * 2;

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0);
  const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1);
  const d = hash2(x0 + 1, z0 + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x, z) {
  let a = 0;
  let f = 1;
  let w = 0.5;
  for (let i = 0; i < 5; i++) {
    a += w * vnoise(x * f, z * f);
    f *= 2.02;
    w *= 0.5;
  }
  return a;
}

function heightAt(x, z, biome) {
  const d = Math.hypot(x, z);
  const flat = smooth01((d - 700) / 1800);
  let h = fbm(x * 0.00035, z * 0.00035) * 22;
  h += fbm(x * 0.00008, z * 0.00008) * 160;
  h *= flat;
  if (biome === 'atoll') {
    const ring = Math.exp(-(((d - 2800) / 520) ** 2)) * 14;
    const lip = Math.exp(-(((d - 1800) / 260) ** 2)) * 7;
    return ring + lip - (d < 1500 ? 6 : 0);
  }
  if (biome === 'arctic') return h * 0.35 + fbm(x * 0.0005, z * 0.0005) * 6;
  return h;
}

function smooth01(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function house(w, d, h, paint) {
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.86, metalness: 0.02 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xc8b49a, roughness: 0.7, metalness: 0.05 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6e4a3a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
  body.position.y = h / 2;
  body.castShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.45, 4), roofMat);
  roof.position.y = h + h * 0.18;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, h * 0.38, 0.08), trim);
  door.position.set(0, h * 0.22, d / 2 + 0.02);
  g.add(door);
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, h * 0.16, 0.06), new THREE.MeshStandardMaterial({
      color: 0x1c2428, roughness: 0.25, metalness: 0.4, emissive: 0x22180e, emissiveIntensity: 0.3
    }));
    win.position.set(s * w * 0.28, h * 0.55, d / 2 + 0.02);
    g.add(win);
  }
  tagParts(g);
  return g;
}

function tower() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8178, roughness: 0.45, metalness: 0.75 });
  const legH = 30;
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, legH, 6), steel);
    leg.position.set(x, legH / 2, z);
    g.add(leg);
  }
  for (const y of [8, 16, 24]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 6.2), steel);
    deck.position.y = y;
    g.add(deck);
  }
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.4 }));
  cab.position.y = 31.2;
  g.add(cab);
  tagParts(g);
  g.userData.vapor = true;
  return g;
}

function hut() {
  const g = house(6, 5, 3.2, 0xd9c7a0);
  return g;
}

function shed() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.8, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 6), m);
  body.position.y = 2;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 7), new THREE.MeshStandardMaterial({ color: 0x6a5c50, roughness: 0.7, metalness: 0.2 }));
  roof.position.y = 4.2;
  g.add(roof);
  tagParts(g);
  return g;
}

function tagParts(group) {
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.userData.home = {
      px: obj.position.x, py: obj.position.y, pz: obj.position.z,
      qx: obj.quaternion.x, qy: obj.quaternion.y, qz: obj.quaternion.z, qw: obj.quaternion.w
    };
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

function place(group, x, z, y, yaw) {
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  group.userData.anchor = new THREE.Vector2(x, z);
  return group;
}

function scrub(count, radius) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6d7348, roughness: 1, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(1.6, 1.1);
  for (let i = 0; i < count; i++) {
    const a = (i * 2.399) % TAU;
    const r = 400 + (hash2(i, 3) ** 0.6) * radius;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * r, 0.7, Math.sin(a) * r);
    m.rotation.y = a;
    m.scale.setScalar(0.6 + hash2(i, 9));
    const m2 = m.clone();
    m2.rotation.y += 1.2;
    g.add(m, m2);
  }
  return g;
}

export function createWorld() {
  const group = new THREE.Group();
  const sunDir = uniform(new THREE.Vector3(0.2, 0.4, 0.1).normalize());
  const uSandA = uniform(new THREE.Color(0xc2a37a));
  const uSandB = uniform(new THREE.Color(0x8d704d));
  const uScorch = uniform(0);
  const uFlash = uniform(0);
  const uFogCol = uniform(new THREE.Color(0xc4b19a));
  const uFogDen = uniform(0.000045);
  const uShockR = uniform(0);
  const uMachH = uniform(0);
  const uPush = uniform(0);
  const uSuck = uniform(0);

  const groundGeo = new THREE.PlaneGeometry(90000, 90000, 380, 380);
  groundGeo.rotateX(-Math.PI / 2);

  const groundMat = new THREE.MeshBasicNodeMaterial();
  groundMat.fog = false;
  const grd = length(positionGeometry.xz);
  const band = grd.sub(uShockR);
  const sigma = float(70).add(uShockR.mul(0.012));
  const front = exp(band.div(sigma).mul(band.div(sigma)).negate());
  const lift = front.mul(uPush).mul(float(22).add(uMachH.mul(0.015)));
  const sideways = normalize(vec2(positionGeometry.x, positionGeometry.z).add(0.001)).mul(front).mul(uPush).mul(30);
  groundMat.positionNode = positionGeometry.add(vec3(sideways.x, lift, sideways.y));
  const vary = fract(sin(dot(positionWorld.xz, vec2(0.013, 0.021))).mul(43758.5));
  const dune = sin(positionWorld.x.mul(0.002)).mul(sin(positionWorld.z.mul(0.0017))).mul(0.5).add(0.5);
  let albedo = mix(uSandA, uSandB, vary.mul(0.65).add(dune.mul(0.35)));
  const dist = length(positionWorld.xz);
  const scorch = smoothstep(uScorch, uScorch.mul(0.15).add(1), dist);
  albedo = mix(albedo.mul(0.18), albedo, scorch);
  const ndl = clamp(normalWorld.dot(sunDir), 0, 1);
  const fog = float(1).sub(pow(float(2.71828), dist.mul(uFogDen).negate()));
  const lit = albedo.mul(ndl.mul(0.45).add(1.05));
  const hot = vec3(1, 0.85, 0.65).mul(uFlash).mul(smoothstep(uScorch.add(4000), float(0), dist));
  groundMat.colorNode = mix(lit.add(hot), uFogCol, fog.mul(0.92));

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.frustumCulled = false;
  group.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(90000, 90000),
    new THREE.MeshStandardMaterial({ color: 0x1c4c58, roughness: 0.22, metalness: 0.35, transparent: true, opacity: 0.92 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.2;
  water.visible = false;
  group.add(water);

  const skyGeo = new THREE.SphereGeometry(70000, 48, 24);
  const uHorizon = uniform(new THREE.Color(0xe7c39a));
  const uZenith = uniform(new THREE.Color(0x6e8eb8));
  const uCloud = uniform(0.55);
  const uTime = uniform(0);
  const skyMat = new THREE.MeshBasicNodeMaterial();
  skyMat.side = THREE.BackSide;
  skyMat.fog = false;
  skyMat.depthWrite = false;
  const skyColor = Fn(() => {
    const dir = normalize(positionWorld);
    const h = smoothstep(float(0.0), float(0.22), dir.y);
    let col = mix(uHorizon, uZenith, h);
    const sun = smoothstep(float(0.997), float(0.9998), dir.dot(sunDir));
    col = mix(col, vec3(1, 0.92, 0.75), sun);
    const p = vec2(dir.x, dir.z).mul(16).add(vec2(uTime.mul(0.008), dir.y.mul(2)));
    const i = floor(p);
    const f = p.sub(i);
    const u = f.mul(f).mul(float(3).sub(f.mul(2)));
    const hn = (q) => fract(sin(dot(q, vec2(127.1, 311.7))).mul(43758.5453));
    const n = mix(
      mix(hn(i), hn(i.add(vec2(1, 0))), u.x),
      mix(hn(i.add(vec2(0, 1))), hn(i.add(vec2(1, 1))), u.x),
      u.y
    );
    const cloud = smoothstep(float(0.58), float(0.82), n).mul(smoothstep(float(0.04), float(0.16), dir.y));
    col = mix(col, vec3(0.95, 0.93, 0.9), cloud.mul(0.28));
    const flashLift = uFlash.mul(smoothstep(float(0.4), float(-0.05), dir.y)).mul(0.85);
    col = mix(col, vec3(1, 0.97, 0.92), flashLift);
    return col;
  })();
  skyMat.colorNode = skyColor;
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  group.add(sky);

  const props = new THREE.Group();
  group.add(props);
  const plants = scrub(80, 6000);
  group.add(plants);

  let biome = 'desert-dawn';
  const buildings = [];

  function remember(obj) {
    buildings.push(obj);
    props.add(obj);
  }

  function load(test) {
    for (const b of buildings) props.remove(b);
    buildings.length = 0;
    city.length = 0;
    debrisN = 0;
    debrisGeo.setDrawRange(0, 0);
    biome = test.biome;
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z, biome));
    }
    pos.needsUpdate = true;
    groundGeo.computeVertexNormals();

    const palettes = {
      'desert-dawn': { a: 0xe0b07a, b: 0xa87848, h: 0xffd2a8, z: 0x8eb6dc, fog: 0xf0d2b4, den: 0.000006, cloud: 0.55, water: false, plants: true },
      'desert-day': { a: 0xd2b48a, b: 0x9a7b52, h: 0xf0d2a8, z: 0x7eadd8, fog: 0xe4d2bc, den: 0.00004, cloud: 0.52, water: false, plants: true },
      atoll: { a: 0xe6d3a8, b: 0xc4a36e, h: 0xf7e2c2, z: 0x4f93c8, fog: 0xd5e4ee, den: 0.00003, cloud: 0.48, water: true, plants: false },
      arctic: { a: 0xe7eef4, b: 0xb7c4d0, h: 0xf4f7fb, z: 0x9aa8b8, fog: 0xd5dde6, den: 0.000035, cloud: 0.58, water: false, plants: false }
    };
    const p = palettes[biome];
    uSandA.value.set(p.a);
    uSandB.value.set(p.b);
    uHorizon.value.set(p.h);
    uZenith.value.set(p.z);
    uFogCol.value.set(p.fog);
    uFogDen.value = p.den;
    uCloud.value = p.cloud;
    water.visible = p.water;
    plants.visible = p.plants;

    const yOf = (x, z) => heightAt(x, z, biome);
    if (test.settlement === 'none') {
      // The separate gas simulation uses the site's ground and sky alone.
    } else if (test.settlement === 'city') {
      buildCity(remember, yOf);
    } else if (test.settlement === 'trinity') {
      remember(place(tower(), 0, 0, yOf(0, 0), 0));
      remember(place(shed(), 820, 240, yOf(820, 240), 0.4));
      remember(place(shed(), -640, 1100, yOf(-640, 1100), -0.6));
    } else if (test.settlement === 'houses') {
      const paints = [0xd8c3a0, 0xc9b7a0, 0xe4d5c0, 0xb7a48c, 0xefe2cf];
      for (let i = 0; i < 5; i++) {
        const x = -80 + i * 38;
        const z = 1050;
        remember(place(house(8 + (i % 2), 7, 4.2 + (i % 3) * 0.3, paints[i]), x, z, yOf(x, z), 0.15));
      }
    } else if (test.settlement === 'reef') {
      remember(place(hut(), 2300, 900, Math.max(1, yOf(2300, 900)), 0.8));
      remember(place(hut(), 2500, 1400, Math.max(1, yOf(2500, 1400)), -0.3));
      remember(place(shed(), -2100, 1600, Math.max(1, yOf(-2100, 1600)), 1));
    } else {
      remember(place(shed(), 1800, 2600, yOf(1800, 2600), 0.2));
    }

    const az = THREE.MathUtils.degToRad(test.sun.azimuth);
    const el = THREE.MathUtils.degToRad(test.sun.elevation);
    sunDir.value.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  }

  function resetStructures() {
    for (const g of buildings) {
      g.visible = true;
      g.traverse((obj) => {
        if (!obj.isMesh || !obj.userData.home) return;
        const h = obj.userData.home;
        obj.position.set(h.px, h.py, h.pz);
        obj.quaternion.set(h.qx, h.qy, h.qz, h.qw);
        obj.userData.vel = null;
        obj.userData.spin = null;
      });
      g.userData.broken = false;
    }
  }

  const city = [];
  const DEBRIS = 32000;
  const debrisPos = new Float32Array(DEBRIS * 3);
  const debrisVel = new Float32Array(DEBRIS * 3);
  let debrisN = 0;
  const debrisGeo = new THREE.BufferGeometry();
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
  debrisGeo.setDrawRange(0, 0);
  const debrisPts = new THREE.Points(debrisGeo, new THREE.PointsMaterial({
    color: 0x9a8168, size: 18, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false
  }));
  debrisPts.frustumCulled = false;
  group.add(debrisPts);

  function splash(b, d) {
    const inv = d > 1 ? 1 / d : 0;
    const bits = 10;
    for (let k = 0; k < bits; k++) {
      if (debrisN >= DEBRIS) return;
      const i = debrisN++;
      debrisPos[i * 3] = b.x + (Math.random() - 0.5) * b.w;
      debrisPos[i * 3 + 1] = b.y + Math.random() * b.h;
      debrisPos[i * 3 + 2] = b.z + (Math.random() - 0.5) * b.d;
      debrisVel[i * 3] = b.x * inv * (22 + Math.random() * 36) + (Math.random() - 0.5) * 6;
      debrisVel[i * 3 + 1] = 0.4 + Math.random() * 1.2;
      debrisVel[i * 3 + 2] = b.z * inv * (22 + Math.random() * 36) + (Math.random() - 0.5) * 6;
    }
  }

  function stepDebris(dt, suck) {
    for (let i = 0; i < debrisN; i++) {
      debrisVel[i * 3 + 1] -= 18 * dt;
      const x = debrisPos[i * 3];
      const z = debrisPos[i * 3 + 2];
      const d = Math.hypot(x, z) || 1;
      if (suck > 0.02) {
        debrisVel[i * 3] -= (x / d) * 14 * suck * dt;
        debrisVel[i * 3 + 2] -= (z / d) * 14 * suck * dt;
      }
      debrisPos[i * 3] += debrisVel[i * 3] * dt;
      debrisPos[i * 3 + 1] += debrisVel[i * 3 + 1] * dt;
      debrisPos[i * 3 + 2] += debrisVel[i * 3 + 2] * dt;
      if (debrisPos[i * 3 + 1] < 0) {
        debrisPos[i * 3 + 1] = 0;
        debrisVel[i * 3 + 1] *= -0.08;
        debrisVel[i * 3] *= 0.4;
        debrisVel[i * 3 + 2] *= 0.4;
      }
    }
    debrisGeo.setDrawRange(0, debrisN);
    debrisGeo.attributes.position.needsUpdate = true;
  }

  function buildCity(remember, yOf) {
    const dummy = new THREE.Object3D();
    const wall = new THREE.MeshStandardMaterial({ color: 0xcbb89a, roughness: 0.9 });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8d8278, roughness: 0.75, metalness: 0.08 });
    const carMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.6, metalness: 0.3 });
    const blocks = [];
    const cars = [];
    const towers = [];
    for (let gz = -28; gz <= 28; gz++) {
      for (let gx = -36; gx <= 36; gx++) {
        if (Math.abs(gx) % 7 === 0 || Math.abs(gz) % 6 === 0) continue;
        const x = gx * 22;
        const z = gz * 22;
        if (Math.hypot(x, z) < 160 || Math.hypot(x, z) > 780) continue;
        const n = hash2(gx + 40, gz + 40);
        blocks.push({ x, z, y: yOf(x, z), w: 6 + n * 3, d: 5 + hash2(gz, gx) * 2, h: 3 + n * 2.5, yaw: 0 });
      }
    }
    for (let i = 0; i < 1600; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 180 + (hash2(i, 2) ** 0.7) * 560;
      const x = Math.cos(a) * r + (hash2(i, 4) - 0.5) * 8;
      const z = Math.sin(a) * r + (hash2(i, 5) - 0.5) * 8;
      cars.push({ x, z, y: yOf(x, z), w: 4.2, d: 1.7, h: 1.4, yaw: a });
    }
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 220 + (i % 3) * 70;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      towers.push({ x, z, y: yOf(x, z), w: 10, d: 10, h: 28 + (i % 4) * 8, yaw: 0 });
    }
    const blockMesh = fleet(blocks, new THREE.BoxGeometry(1, 1, 1), wall, dummy);
    const carMesh = fleet(cars, new THREE.BoxGeometry(1, 1, 1), carMat, dummy);
    const towerMesh = fleet(towers, new THREE.BoxGeometry(1, 1, 1), towerMat, dummy);
    city.push(blockMesh, carMesh, towerMesh);
    remember(blockMesh);
    remember(carMesh);
    remember(towerMesh);
  }

  function fleet(items, geo, mat, dummy) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.userData.fleet = items.map((b) => ({ ...b, alive: true, vx: 0, vy: 0, vz: 0, spin: 0 }));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    writeFleet(mesh, dummy);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function writeFleet(mesh, dummy) {
    const list = mesh.userData.fleet;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      dummy.position.set(b.x, b.y + (b.alive ? b.h * 0.5 : -500), b.z);
      dummy.rotation.set(0, b.yaw || 0, 0);
      dummy.scale.set(b.alive ? b.w : 0.001, b.alive ? b.h : 0.001, b.alive ? b.d : 0.001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  const fleetDummy = new THREE.Object3D();

  function updateShock(time, shockRadius, dt) {
    uScorch.value = shockRadius;
    const suck = uSuck.value;
    for (const mesh of city) {
      let dirty = false;
      for (const b of mesh.userData.fleet) {
        const d = Math.hypot(b.x, b.z);
        if (b.alive && shockRadius > d) {
          b.alive = false;
          splash(b, d);
          dirty = true;
        }
      }
      if (dirty) writeFleet(mesh, fleetDummy);
    }
    stepDebris(dt, suck);
    for (const g of buildings) {
      if (g.userData.fleet) continue;
      if (g.userData.vapor) {
        g.visible = time < 0.04;
        continue;
      }
      const d = g.userData.anchor.length();
      if (!g.userData.broken && shockRadius > d) {
        g.userData.broken = true;
        const away = g.userData.anchor.clone().normalize();
        g.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.userData.vel = new THREE.Vector3(away.x, 0, away.y)
            .multiplyScalar(18 + Math.random() * 30)
            .add(new THREE.Vector3((Math.random() - 0.5) * 16, 12 + Math.random() * 22, (Math.random() - 0.5) * 16));
          obj.userData.spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.5);
        });
      }
      if (!g.userData.broken) continue;
      g.traverse((obj) => {
        if (!obj.isMesh || !obj.userData.vel) return;
        obj.userData.vel.y -= 18 * dt;
        obj.position.addScaledVector(obj.userData.vel, dt);
        obj.rotation.x += obj.userData.spin.x * dt;
        obj.rotation.y += obj.userData.spin.y * dt;
        obj.rotation.z += obj.userData.spin.z * dt;
        const floorY = heightAt(g.position.x + obj.position.x, g.position.z + obj.position.z, biome);
        if (obj.position.y < floorY) {
          obj.position.y = floorY;
          obj.userData.vel.y *= -0.15;
          obj.userData.vel.x *= 0.7;
          obj.userData.vel.z *= 0.7;
        }
        const inward = uSuck.value;
        if (inward > 0.02 && g.userData.anchor.lengthSq() > 1) {
          const back = g.userData.anchor.clone().normalize().multiplyScalar(-14 * inward);
          obj.userData.vel.x += back.x * dt;
          obj.userData.vel.z += back.y * dt;
        }
      });
    }
  }

  return {
    group, ground, sky, water, load, resetStructures, updateShock,
    sunDir, uFlash, uTime, uFogCol, uFogDen, uShockR, uMachH, uPush, uSuck, heightAt
  };
}


