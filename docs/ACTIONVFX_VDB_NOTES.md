# ActionVFX reference and browser translation

`ActionVFX_Free_VDB_Shader_3D0114_LOD0` contains a Blender 3.6 material scene and three individual OpenVDB frames: a gas explosion, a meteor, and a large smoke plume. The `.blend` file points at the creator's `X:` drive, so its volume objects do not load these local copies automatically. The files are useful shape and shading references, but a single frame of each cannot reproduce the original explosion animation.

The two main Blender materials read three named fields: `density`, `temperature`, and `scatter`. They multiply density and emission strength independently, then feed a Principled Volume. Their emission color ramps start at black, move through deep red and orange, and end in pale grey. Blackbody intensity is zero in these materials; the warm glow comes from the emission ramp. The gas and plume materials use different density and emission multipliers. `scripts/inspect_actionvfx.py` prints the exact node links, operations, and ramp stops with Blender in background mode.

The Three.js implementation now keeps the same separation. The raymarch integrates opacity from density with exponential extinction, and uses a separate hot color only while the source is hot. A procedural stem and cap provide a continuously animated silhouette; the GPU density field still contributes to the ignition stage. The cap and stem are scaled to the volume bounds so large test presets do not clip. The cap fades in only after the column has risen above the fireball. The early toroidal vapor ring was removed because its underside read as an inverted mushroom cap; the atoll preset instead strengthens the brief shock condensation.

The plume shape now uses advected, trilinearly filtered 3D noise at broad and fine scales. This replaced spatial sine waves whose regular periods produced moire and horizontal bands. The raymarch uses 80 depth samples to reduce slice banding. These changes increase the fragment shader's texture sampling cost.

The hot ball now also contributes to the volume, so the opaque fireball mesh fades into the rising smoke without the former plasma point sprites. A red contribution is confined to the interior of the young stem and disappears as the head climbs. Eight broad, dusty radial streams travel near the ground with weaker upward motion than the main column.

The shock front remains a driver of the ground response. Its visible condensation is a brief, irregular density band that clears from below; the previous persistent sphere and visible cylindrical Mach tail are gone. This is an art-directed timing model. The historical description in *The Effects of Nuclear Weapons*, chapter II, describes a Wilson cloud in humid Bikini air appearing after the shock, changing from a dome to a ring, and dispersing within a few seconds; it does not imply every atmospheric test has the same visible cloud.

Next visual improvements worth trying are an actual sequence of VDB frames with interpolation and a deeper light-ray integration for internal shadows. Those would require more GPU memory and rendering work; the supplied files do not include the sequence needed for the first option.

## Separate gas fluid simulation

The **Explosion source** selector offers a separate gas fluid simulation over the selected site's terrain and sky. It hides site structures and selects the free camera. The original **Animated simulation** remains a separate implementation in `src/explosion.js`.

`src/gas_sim.js` initializes density, temperature, and velocity in a compact region near ground zero. Every fixed 0.1-second step semi-Lagrangian advects those three fields on a 64³ grid, then applies an expansion pressure gradient, buoyancy, drag, a short-lived gas source, cooling, and thinning. A volume raymarch renders the evolving density and temperature. The gas live mix exposes the corresponding controls. This is a simplified compressible flow model; it does not copy, collapse, or expand the baked VDB frame.

Timeline seeking is deterministic but requires replaying simulation steps from time zero. The UI reports replay progress when jumping forward or changing physical parameters. The supplied VDBs and `scripts/export_actionvfx_volume.py` remain available as reference assets, but they are not inputs to this solver.
