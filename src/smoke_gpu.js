import * as THREE from 'three/webgpu';
import { Fn, If, Loop, instanceIndex, storage, uniform, uint, int, float,
  vec3, vec4, uvec3, floor, fract, clamp, max, min, exp, sqrt, sin, cos,
  hash, mx_noise_vec3, atomicAdd, atomicLoad, atomicStore, textureStore,
  abs, sign, dot, normalize } from 'three/tsl';

export const SMOKE_BOUNDS = { low: [-64, 0, -64], size: [128, 80, 128], grid: [96, 60, 96] };
export const SMOKE_DT = 1 / 30;
const CAPACITY = 65536, LIFE = 12, FIXED = 65536;
const [NX, NY, NZ] = SMOKE_BOUNDS.grid;
const CELLS = NX * NY * NZ, CELL = SMOKE_BOUNDS.size[0] / NX;

// Every evolving sample and every density voxel lives on the GPU. JavaScript
// schedules dispatches and updates controls; it never advances particle data.
export function createSmokeGPU() {
  const positionAttribute = new THREE.StorageBufferAttribute(CAPACITY, 4);
  const velocityAttribute = new THREE.StorageBufferAttribute(CAPACITY, 4);
  const binsAttribute = new THREE.StorageBufferAttribute(CELLS, 1, Uint32Array);
  const positions = storage(positionAttribute, 'vec4', CAPACITY);
  const velocities = storage(velocityAttribute, 'vec4', CAPACITY);
  const bins = storage(binsAttribute, 'uint', CELLS).setAtomic(true);
  const a = storage(new THREE.StorageBufferAttribute(CELLS, 1), 'float', CELLS);
  const b = storage(new THREE.StorageBufferAttribute(CELLS, 1), 'float', CELLS);
  const volume = new THREE.Storage3DTexture(NX, NY, NZ);
  volume.type = THREE.HalfFloatType;
  volume.minFilter = volume.magFilter = THREE.LinearFilter;
  const controls = {
    velocity: uniform(14), decay: uniform(0.24), buoyancy: uniform(2.8),
    buoyancyDecay: uniform(0.18), turbulence: uniform(2.5),
    particleSize: uniform(1.3), count: uniform(16384, 'uint')
  };
  const time = uniform(0);
  const sigma = uniform(1);
  const emitter = uniform(new THREE.Matrix4().makeTranslation(0, 3, 0));
  const collider = uniform(new THREE.Matrix4());
  const colliderInverse = uniform(new THREE.Matrix4());
  const colliderEnabled = uniform(0);
  const half = vec3(3);
  const insideCube = (point) => {
    const local = abs(colliderInverse.mul(vec4(point, 1)).xyz);
    return local.x.lessThan(3).and(local.y.lessThan(3)).and(local.z.lessThan(3));
  };
  const id3 = () => uvec3(instanceIndex.mod(NX), instanceIndex.div(NX).mod(NY), instanceIndex.div(NX * NY));
  const init = Fn(() => {
    positions.element(instanceIndex).assign(vec4(0, 3, 0, -1));
    velocities.element(instanceIndex).assign(vec4(0));
  })().compute(CAPACITY);

  const curl = Fn(([p]) => {
    const e = 0.08;
    const dx = mx_noise_vec3(p.add(vec3(e, 0, 0))).sub(mx_noise_vec3(p.sub(vec3(e, 0, 0))));
    const dy = mx_noise_vec3(p.add(vec3(0, e, 0))).sub(mx_noise_vec3(p.sub(vec3(0, e, 0))));
    const dz = mx_noise_vec3(p.add(vec3(0, 0, e))).sub(mx_noise_vec3(p.sub(vec3(0, 0, e))));
    return vec3(dy.z.sub(dz.y), dz.x.sub(dx.z), dx.y.sub(dy.x)).div(2 * e);
  });
  const move = Fn(() => {
    If(instanceIndex.lessThan(controls.count), () => {
      const p = positions.element(instanceIndex).toVar();
      const v = velocities.element(instanceIndex).toVar();
      const birth = float(instanceIndex).div(float(controls.count)).mul(LIFE);
      If(time.greaterThanEqual(birth), () => {
        If(p.w.lessThan(0).or(p.w.greaterThanEqual(LIFE - SMOKE_DT)), () => {
          const seed = instanceIndex.add(uint(floor(time.div(LIFE))).mul(CAPACITY));
          const r = sqrt(hash(seed.add(17))).mul(0.78);
          const theta = hash(seed.add(193)).mul(Math.PI * 2);
          p.assign(vec4(emitter.mul(vec4(0.05, cos(theta).mul(r), sin(theta).mul(r), 1)).xyz, 0));
          v.assign(vec4(emitter.mul(vec4(controls.velocity.mul(float(1).sub(r.mul(r).mul(0.22))), 0, 0, 0)).xyz, 1));
        });
        const q = p.xyz.mul(0.2).add(vec3(time.mul(-0.17), time.mul(0.11), time.mul(0.09)));
        const force = curl(q).add(curl(q.mul(2.31).add(13.7)).mul(0.35)).mul(controls.turbulence);
        v.xyz.addAssign(force.add(vec3(0, controls.buoyancy.mul(v.w), 0)).mul(SMOKE_DT));
        v.xyz.mulAssign(exp(controls.decay.mul(-SMOKE_DT)));
        v.w.mulAssign(exp(controls.buoyancyDecay.mul(-SMOKE_DT)));
        const oldPosition = p.xyz.toVar();
        p.xyz.addAssign(v.xyz.mul(SMOKE_DT));
        If(colliderEnabled.greaterThan(0), () => {
          const from = colliderInverse.mul(vec4(oldPosition, 1)).xyz;
          const to = colliderInverse.mul(vec4(p.xyz, 1)).xyz.toVar();
          const delta = to.sub(from);
          // Segment versus oriented box prevents fast samples tunnelling through.
          const inv = vec3(1).div(delta.add(0.000001));
          const t0 = half.negate().sub(from).mul(inv), t1 = half.sub(from).mul(inv);
          const near = min(t0, t1), far = max(t0, t1);
          const enter = max(max(near.x, near.y), near.z);
          const exit = min(min(far.x, far.y), far.z);
          const within = abs(to).lessThan(half).all();
          const hit = enter.greaterThanEqual(0).and(enter.lessThanEqual(1)).and(exit.greaterThanEqual(enter));
          If(within.or(hit), () => {
            const normal = vec3(0).toVar();
            If(hit, () => {
              If(near.x.greaterThanEqual(near.y).and(near.x.greaterThanEqual(near.z)), () => { normal.x.assign(sign(delta.x).negate()); })
                .ElseIf(near.y.greaterThanEqual(near.z), () => { normal.y.assign(sign(delta.y).negate()); })
                .Else(() => { normal.z.assign(sign(delta.z).negate()); });
              to.assign(from.add(delta.mul(max(enter.sub(0.001), float(0)))).add(normal.mul(0.04)));
            }).Else(() => {
              // Also expel samples when the user moves the box onto the plume.
              const gap = half.sub(abs(to));
              const cost = gap.toVar();
              // A face below the ground is not a valid escape route: the ground
              // constraint would otherwise push the particle back into the box.
              for (const axis of ['x', 'y', 'z']) {
                const candidate = to.toVar();
                candidate[axis].addAssign(sign(to[axis].add(0.0001)).mul(gap[axis].add(0.04)));
                If(collider.mul(vec4(candidate, 1)).y.lessThan(0.4), () => { cost[axis].assign(1000000); });
              }
              If(cost.x.lessThanEqual(cost.y).and(cost.x.lessThanEqual(cost.z)), () => { normal.x.assign(sign(to.x.add(0.0001))); })
                .ElseIf(cost.y.lessThanEqual(cost.z), () => { normal.y.assign(sign(to.y.add(0.0001))); })
                .Else(() => { normal.z.assign(sign(to.z.add(0.0001))); });
              to.addAssign(normal.mul(dot(gap, abs(normal)).add(0.04)));
            });
            const localVelocity = colliderInverse.mul(vec4(v.xyz, 0)).xyz.toVar();
            const inward = min(dot(localVelocity, normal), float(0));
            const tangent = normalize(to.sub(normal.mul(dot(to, normal)))
              .add(vec3(0.13, 0.29, 0.17).mul(vec3(1).sub(abs(normal)))));
            // Inelastic contact removes inward momentum and spreads the jet
            // along the surface, so smoke can travel around the obstruction.
            localVelocity.subAssign(normal.mul(inward));
            localVelocity.addAssign(tangent.mul(inward.negate()).mul(0.65));
            p.xyz.assign(collider.mul(vec4(to, 1)).xyz);
            v.xyz.assign(collider.mul(vec4(localVelocity, 0)).xyz);
          });
        });
        p.w.addAssign(SMOKE_DT);
        If(p.y.lessThan(0.4), () => { p.y.assign(0.4); v.y.assign(max(v.y, float(0))); });
        positions.element(instanceIndex).assign(p);
        velocities.element(instanceIndex).assign(v);
      });
    });
  })().compute(CAPACITY);
  const clear = Fn(() => { atomicStore(bins.element(instanceIndex), uint(0)); })().compute(CELLS);
  const splat = Fn(() => {
    If(instanceIndex.lessThan(controls.count), () => {
      const p = positions.element(instanceIndex);
      const q = p.xyz.sub(vec3(...SMOKE_BOUNDS.low)).div(CELL).sub(0.5);
      const base = floor(q), f = fract(q);
      If(p.w.greaterThanEqual(0).and(base.x.greaterThanEqual(0)).and(base.y.greaterThanEqual(0))
        .and(base.z.greaterThanEqual(0)).and(base.x.lessThan(NX - 1))
        .and(base.y.lessThan(NY - 1)).and(base.z.lessThan(NZ - 1)), () => {
        const mass = float(1700 * FIXED / CELL ** 3).div(float(controls.count))
          .mul(clamp(float(LIFE).sub(p.w).div(3), 0, 1)).mul(exp(p.w.mul(-0.035)));
        for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
          const index = uint(base.x.add(x)).add(uint(base.y.add(y)).mul(NX)).add(uint(base.z.add(z)).mul(NX * NY));
          const weight = (x ? f.x : float(1).sub(f.x)).mul(y ? f.y : float(1).sub(f.y)).mul(z ? f.z : float(1).sub(f.z));
          atomicAdd(bins.element(index), uint(mass.mul(weight).add(0.5)));
        }
      });
    });
  })().compute(CAPACITY);

  // Three separable Gaussian passes reconstruct a continuous volume. Smaller
  // sample footprints are supported as count increases; mass rate stays fixed.
  function blur(axis) {
    const stride = [1, NX, NX * NY][axis], length = [NX, NY, NZ][axis];
    return Fn(() => {
      const coordinate = int(instanceIndex.div(stride).mod(length));
      const sum = float(0).toVar(), norm = float(0).toVar();
      Loop({ start: int(-6), end: int(7), type: 'int' }, ({ i }) => {
        const w = exp(float(i.mul(i)).div(sigma.mul(sigma).mul(-2)));
        norm.addAssign(w);
        const c = coordinate.add(i);
        If(c.greaterThanEqual(0).and(c.lessThan(length)), () => {
          const index = uint(int(instanceIndex).add(i.mul(stride)));
          const value = axis === 0 ? float(atomicLoad(bins.element(index))).div(FIXED)
            : (axis === 1 ? a : b).element(index);
          sum.addAssign(value.mul(w));
        });
      });
      const result = sum.div(norm);
      if (axis === 2) {
        const density = result.toVar();
        const world = vec3(id3()).add(0.5).mul(CELL).add(vec3(...SMOKE_BOUNDS.low));
        If(colliderEnabled.greaterThan(0).and(insideCube(world)), () => { density.assign(0); });
        textureStore(volume, id3(), vec4(density, 0, 0, 0));
      }
      else (axis === 0 ? a : b).element(instanceIndex).assign(result);
    })().compute(CELLS);
  }
  const blurX = blur(0), blurY = blur(1), blurZ = blur(2);
  let step = 0, needsInit = true, dirty = true;
  function reset() { step = 0; needsInit = true; dirty = true; }
  function advance(renderer, targetTime) {
    const target = Math.max(0, Math.floor(targetTime / SMOKE_DT + 0.0001));
    if (target < step) reset();
    if (needsInit) { renderer.compute(init); needsInit = false; }
    let iterations = 0;
    while (step < target && iterations < 6) {
      time.value = (step + 1) * SMOKE_DT;
      renderer.compute(move);
      step++; iterations++; dirty = true;
    }
    if (dirty) {
      renderer.compute(clear); renderer.compute(splat);
      renderer.compute(blurX); renderer.compute(blurY); renderer.compute(blurZ);
      dirty = false;
    }
    return step * SMOKE_DT;
  }
  function setParams(params) {
    let changed = false;
    for (const [key, value] of Object.entries(params)) {
      if (controls[key] && controls[key].value !== value) { controls[key].value = value; changed = true; }
    }
    sigma.value = Math.max(0.45, controls.particleSize.value / CELL * Math.cbrt(16384 / controls.count.value));
    if (changed) reset();
  }
  setParams({});
  return {
    volume, advance, reset, setParams, colliderInverse, colliderEnabled,
    setObjects(emitterMatrix, cubeMatrix) {
      emitter.value.copy(emitterMatrix);
      if (cubeMatrix) {
        collider.value.copy(cubeMatrix);
        colliderInverse.value.copy(cubeMatrix).invert();
      }
      colliderEnabled.value = cubeMatrix ? 1 : 0;
      dirty = true;
    },
    dispose(renderer) {
      for (const kernel of [init, move, clear, splat, blurX, blurY, blurZ]) kernel.dispose();
      volume.dispose();
      // Three r186 has no public disposal method for standalone storage
      // attributes. Use its attribute manager to destroy buffers and accounting.
      for (const attribute of [positionAttribute, velocityAttribute, binsAttribute, a.value, b.value]) {
        renderer._attributes.delete(attribute);
      }
    },
    get active() { return Math.min(controls.count.value, Math.floor(step * SMOKE_DT / LIFE * controls.count.value) + (step ? 1 : 0)); },
    // Explicit diagnostic readback only; the live application never calls it.
    async inspect(renderer) {
      return {
        positions: new Float32Array(await renderer.getArrayBufferAsync(positionAttribute)),
        velocities: new Float32Array(await renderer.getArrayBufferAsync(velocityAttribute)),
        bins: new Uint32Array(await renderer.getArrayBufferAsync(binsAttribute))
      };
    }
  };
}
