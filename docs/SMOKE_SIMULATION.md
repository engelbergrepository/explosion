# GPU smoke cannon

Select **Smoke simulation**, then **Emit smoke**. Two horizontal cannons emit
continuously into the existing landscape. Cannon 1 produces gray smoke; Cannon 2
starts with blue smoke, slower launch speed, stronger buoyancy and more turbulence.
Each cannon has its own motion, density, and color controls. Free camera starts close to the cannons.
Middle-drag orbits, Shift + middle-drag pans, and the wheel zooms. Left-click a
cannon or cube mesh to select it. G selects the move gizmo, R selects rotation,
and F frames the selection. The sidebar also provides selection, mode buttons,
and numerical position/rotation inputs.
Pause, reset, and timeline seeking are supported. Motion parameter changes replay
the simulation to the selected time; density and color update without replay.

Each cannon has an independent GPU sample and density volume. `src/smoke_gpu.js` owns GPU storage buffers for particle position/age and
velocity/heat. Fixed 1/30-second compute steps emit samples through the muzzle,
integrate velocity with exponential drag, apply heat-driven buoyancy and cooling,
and add coherent curl-noise turbulence. Samples fade and recycle over 12 seconds.
This is a Lagrangian VFX transport model with prescribed turbulent forces; it does
not solve pressure or fluid interactions between particles.

GPU atomics accumulate particle mass into a 96 × 60 × 96 grid. Three GPU Gaussian
passes reconstruct density in a 3D storage texture. Sample mass is inversely
proportional to particle count, and reconstruction footprints decrease as count
increases. This improves detail without increasing the smoke emission rate.
Particle size scales the reconstruction footprint; detail is ultimately limited
by the approximately 1.33 m voxel spacing. The volume domain covers X/Z ±64 m
and Y 0–80 m, allowing the cannon to aim in any horizontal direction.

Cannon transforms update the emission matrix without moving existing smoke.
The dark metallic cube is an oriented collision box. GPU segment/box tests
prevent tunnelling, remove inward momentum, and deflect samples along its faces.
Moving the cube onto existing smoke expels intersecting samples on the next
simulation step. Density inside the cube is zeroed, and volume rays terminate
at its front surface so smoke behind it cannot show through. This is a VFX
collision response, not a pressure/wake solver. Timeline replay uses the current
object layout; object movement itself is not recorded as animation.

**Stop & unload GPU** disposes the smoke compute nodes, five storage buffers,
volume texture, cannon/cube geometry and materials, and editor gizmos. The
landscape and shared renderer stay available. **Emit smoke** recreates the assets
with the last object placements. Switching away from smoke also releases them.

`src/smoke_sim.js` builds both cannons and raymarches both density fields together with
exponential extinction, density-weighted smoke colors, and internal light attenuation. Its density
and scattering approach follows the ActionVFX material inspection in
`ACTIONVFX_VDB_NOTES.md`; it uses no baked VDB shape and no visible particle sprites.

JavaScript only schedules dispatches and updates uniform controls. There is no
CPU particle stepping, voxel reconstruction, or routine GPU readback. The
`inspect()` method exists solely for explicit diagnostics.

`scripts/smoke-gpu-check.html` runs GPU numerical checks for empty initialization,
emission, velocity, drag, buoyancy, cooling, turbulence, mass versus sample count,
deterministic replay, rewind, and compute/render shader validation. Run it through
the local Vite server. It renders offscreen and reports pass/fail as text.
`scripts/smoke-editor-check.html` additionally checks transformed emission,
rotated and moving collisions, GPU resource accounting, and repeated restarts.
