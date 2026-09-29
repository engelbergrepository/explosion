# Proving Ground — plan

A browser film of historical atmospheric tests, from Trinity through Tsar Bomba. The picture is a documentary camera on a desert, reef, or ice plain. Yields shown in the UI are the public historical record, used only as captions. Every cloud, shock, and flash control is an art parameter.

## What the operator does

1. Pick a test. That loads the place, the hour, the settlement, and a starting mix.
2. Pick a camera from the bank (bunker Mitchell, ridge Fastax, or a drone at one of three ranges).
3. Set focal length, focus distance, and f-stop. Depth of field is driven by those, on a 35mm gate.
4. Set the playback clock (scrub or let it run) and press **Ignite**.
5. While it runs, move the live mix: particle count, dust amount / size / divergence, shock speed and thickness, spectacle scale, plume rise, flash, stem, cap spread, wind, grain.

Cameras sit kilometres out, the way the site cameras did. Light is immediate. The low rumble is delayed by distance at the speed of sound, so a far bunker sees the fireball in silence.

## Picture

- WebGPU renderer, logarithmic depth, half-float scene pass.
- GPU compute advects the smoke field and places the ground ejecta sprites from the clock. The plume is rendered as a volume.
- The fireball is a rough mesh blended into the same smoke volume. Condensation is a brief, irregular volume around the shock front; later ground effects continue after the front stops being visible.
- Terrain, height fog, and a sun-and-cloud sky share the test’s biome (pre-dawn desert, noon desert, lagoon, arctic).
- A few built things stand on the flat: the Trinity tower, Nevada wood houses, reef huts, a polar hut. The shock topples them into pieces. This is a visual collapse, not a structural code.
- Grade: halation bloom, depth of field, grain, gate weave, vignette, optional black-and-white or warm stock, letterbox for the film cameras.

## Tests

| Card | Place on the clock | Ground |
| --- | --- | --- |
| Trinity | 16 July 1945, before dawn | Jornada flat, shot tower |
| Annie | 17 March 1953, morning | Nevada houses in a row |
| Castle Bravo | 1 March 1954 | Reef ring and lagoon |
| Tsar Bomba | 30 October 1961 | Snow plain, cameras much farther out |

## Checklist

- [x] WebGPU path comes up
- [x] Four test cards, camera bank, clock, and live mix are on the panel
- [x] Ignite runs the clock and the dawn frame stays a photograph (gradient sky, pale ground, film grain, letterbox)
- [x] Depth of field, focal length, focus, and f-stop feed the post chain
- [ ] Keep tuning the cap until a 9 km frame matches the public Trinity still: white core, ochre stem, wide cap
- [ ] Confirm house collapse and the three drone orbits in the browser after a full roll
