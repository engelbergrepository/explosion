/** Public historical cards. Numbers in `spectacle` and distances are staging, not a design code. */
export const TESTS = [
  {
    id: 'custom',
    name: 'Custom',
    when: 'Not a historical shot',
    where: 'Trinity ground, invented city',
    caption: 'Same pre-dawn desert as Trinity. A dense city sits on the flat. Plasma mass sets the size of the opaque fireball. The gas that leaves it stays in the stem and the plume.',
    biome: 'desert-dawn',
    spectacle: 1,
    mix: {
      particles: 2000000, dust: 0.55, dustSize: 1.15, dustDiv: 0.5,
      shock: 400, shockThick: 1, scale: 1, plume: 36, flash: 1.3,
      stem: 1, cap: 1.1, wind: 0.08, grain: 0.4, mass: 8
    },
    settlement: 'city',
    sun: { elevation: 0.4, azimuth: 78, intensity: 0.55 },
    cameras: [
      { id: 'south-bunker', name: 'South bunker', detail: 'Mitchell · 9 km', style: 'film', pos: [0, 40, 9000], look: [0, 900, 0], focal: 80, fstop: 8 },
      { id: 'city-edge', name: 'City edge', detail: 'Eyemo · 1.4 km', style: 'film', pos: [900, 8, 1100], look: [0, 80, 0], focal: 35, fstop: 4 },
      { id: 'west-ridge', name: 'West ridge', detail: 'Fastax · 16 km', style: 'film', pos: [-16000, 40, 1200], look: [0, 400, 0], focal: 180, fstop: 5.6 },
      { id: 'drone-near', name: 'Drone, close', detail: 'Fixed · 1.6 km', style: 'drone', pos: [1100, 420, 1100], look: [0, 200, 0], focal: 35, fstop: 4 },
      { id: 'drone-mid', name: 'Drone, mid', detail: 'Fixed · 4 km', style: 'drone', pos: [-2800, 900, 2800], look: [0, 400, 0], focal: 50, fstop: 4 },
      { id: 'free', name: 'Free camera', detail: 'Mouse · starts at mid drone', style: 'free', pos: [-2800, 900, 2800], look: [0, 400, 0], focal: 40, fstop: 4 },
      { id: 'drone-far', name: 'Drone, far', detail: 'Fixed · 12 km', style: 'drone', pos: [7000, 1800, 10000], look: [0, 700, 0], focal: 70, fstop: 5.6 }
    ]
  },
  {
    id: 'trinity',
    name: 'Trinity',
    when: '16 July 1945 · 05:29',
    where: 'Jornada del Muerto',
    caption: 'First test. The public yield is about 21 kilotons. Pre-dawn desert, a steel tower on the flat, cameras miles out.',
    biome: 'desert-dawn',
    spectacle: 1,
    mix: {
      particles: 140000, dust: 0.46, dustSize: 1.05, dustDiv: 0.42,
      shock: 820, shockThick: 1, scale: 1, plume: 26, flash: 1.15,
      stem: 0.85, cap: 1, wind: 0.12, grain: 0.55
    },
    settlement: 'trinity',
    sun: { elevation: 0.4, azimuth: 78, intensity: 0.55 },
    cameras: [
      { id: 'south-bunker', name: 'South bunker', detail: 'Mitchell · 9 km', style: 'film', pos: [0, 40, 9000], look: [0, 1600, 0], focal: 50, fstop: 8 },
      { id: 'west-ridge', name: 'West ridge', detail: 'Fastax · 16 km', style: 'film', pos: [-16000, 40, 1200], look: [0, 400, 0], focal: 180, fstop: 5.6 },
      { id: 'north-shelter', name: 'North shelter', detail: 'Mitchell · 6 km', style: 'film', pos: [400, 6, -6000], look: [0, 220, 0], focal: 85, fstop: 8 },
      { id: 'drone-near', name: 'Drone, close', detail: 'Survey · 1.6 km', style: 'drone', pos: [1100, 420, 1100], look: [0, 180, 0], focal: 35, fstop: 4 },
      { id: 'drone-mid', name: 'Drone, mid', detail: 'Survey · 4 km', style: 'drone', pos: [-2800, 900, 2800], look: [0, 350, 0], focal: 50, fstop: 4 },
      { id: 'drone-far', name: 'Drone, far', detail: 'Survey · 12 km', style: 'drone', pos: [7000, 1800, 10000], look: [0, 600, 0], focal: 70, fstop: 5.6 }
    ]
  },
  {
    id: 'annie',
    name: 'Annie',
    when: '17 March 1953',
    where: 'Nevada Test Site',
    caption: 'Public yield about 16 kilotons. Morning desert and a short row of wood houses, the civil-effects picture.',
    biome: 'desert-day',
    spectacle: 0.85,
    mix: {
      particles: 120000, dust: 0.5, dustSize: 0.9, dustDiv: 0.5,
      shock: 760, shockThick: 1.1, scale: 0.9, plume: 22, flash: 0.9,
      stem: 0.9, cap: 0.95, wind: 0.2, grain: 0.4
    },
    settlement: 'houses',
    sun: { elevation: 28, azimuth: 150, intensity: 1.15 },
    cameras: [
      { id: 'newsreel', name: 'Newsreel trench', detail: 'Mitchell · 2.3 km', style: 'film', pos: [180, 3, 2300], look: [0, 80, 0], focal: 50, fstop: 5.6 },
      { id: 'house-row', name: 'Beside the row', detail: 'Eyemo · 1.1 km', style: 'film', pos: [900, 2.2, 700], look: [0, 40, 0], focal: 35, fstop: 4 },
      { id: 'ridge', name: 'East ridge', detail: 'Mitchell · 7 km', style: 'film', pos: [6800, 30, 1800], look: [0, 200, 0], focal: 135, fstop: 8 },
      { id: 'drone-near', name: 'Drone, close', detail: 'Survey · 800 m', style: 'drone', pos: [500, 260, 600], look: [0, 40, 0], focal: 28, fstop: 2.8 },
      { id: 'drone-mid', name: 'Drone, mid', detail: 'Survey · 3 km', style: 'drone', pos: [-1800, 700, 2200], look: [0, 160, 0], focal: 40, fstop: 4 },
      { id: 'drone-far', name: 'Drone, far', detail: 'Survey · 8 km', style: 'drone', pos: [2000, 1400, 7800], look: [0, 300, 0], focal: 85, fstop: 5.6 }
    ]
  },
  {
    id: 'bravo',
    name: 'Castle Bravo',
    when: '1 March 1954',
    where: 'Bikini Atoll',
    caption: 'Public yield about 15 megatons, far above the forecast. A reef ring at first light, cameras well offshore.',
    biome: 'atoll',
    spectacle: 6,
    mix: {
      particles: 180000, dust: 0.28, dustSize: 1.4, dustDiv: 0.55,
      shock: 1400, shockThick: 1.4, scale: 1.15, plume: 40, flash: 1.4,
      stem: 1.2, cap: 1.45, wind: 0.35, grain: 0.35
    },
    settlement: 'reef',
    sun: { elevation: 8, azimuth: 100, intensity: 0.85 },
    cameras: [
      { id: 'ship', name: 'Instrument ship', detail: 'Mitchell · 30 km', style: 'film', pos: [0, 18, 30000], look: [0, 800, 0], focal: 200, fstop: 8 },
      { id: 'island', name: 'Neighboring islet', detail: 'Mitchell · 18 km', style: 'film', pos: [-15000, 12, 11000], look: [0, 500, 0], focal: 135, fstop: 5.6 },
      { id: 'drone-near', name: 'Drone, close', detail: 'Survey · 4 km', style: 'drone', pos: [2500, 600, 2500], look: [0, 200, 0], focal: 28, fstop: 4 },
      { id: 'drone-mid', name: 'Drone, mid', detail: 'Survey · 12 km', style: 'drone', pos: [-8000, 1600, 8000], look: [0, 600, 0], focal: 40, fstop: 4 },
      { id: 'drone-far', name: 'Drone, far', detail: 'Survey · 28 km', style: 'drone', pos: [14000, 2800, 24000], look: [0, 1200, 0], focal: 70, fstop: 5.6 }
    ]
  },
  {
    id: 'tsar',
    name: 'Tsar Bomba',
    when: '30 October 1961',
    where: 'Novaya Zemlya',
    caption: 'Public yield about 50 megatons. Arctic daylight, a pale plain, and cameras far enough that the cap still fills the gate.',
    biome: 'arctic',
    spectacle: 14,
    mix: {
      particles: 200000, dust: 0.34, dustSize: 1.8, dustDiv: 0.6,
      shock: 2200, shockThick: 1.6, scale: 1.2, plume: 55, flash: 1.6,
      stem: 1.35, cap: 1.7, wind: -0.05, grain: 0.3
    },
    settlement: 'arctic',
    sun: { elevation: 6, azimuth: 190, intensity: 0.7 },
    cameras: [
      { id: 'observer', name: 'Observer aircraft gate', detail: 'Film · 40 km', style: 'film', pos: [18000, 3500, 36000], look: [0, 2000, 0], focal: 85, fstop: 8 },
      { id: 'coast', name: 'Coast battery', detail: 'Mitchell · 55 km', style: 'film', pos: [-2000, 40, 55000], look: [0, 2500, 0], focal: 300, fstop: 11 },
      { id: 'drone-near', name: 'Drone, close', detail: 'Survey · 8 km', style: 'drone', pos: [5000, 1200, 6000], look: [0, 400, 0], focal: 24, fstop: 4 },
      { id: 'drone-mid', name: 'Drone, mid', detail: 'Survey · 20 km', style: 'drone', pos: [-12000, 2500, 15000], look: [0, 1500, 0], focal: 35, fstop: 4 },
      { id: 'drone-far', name: 'Drone, far', detail: 'Survey · 45 km', style: 'drone', pos: [20000, 4000, 40000], look: [0, 3000, 0], focal: 50, fstop: 5.6 }
    ]
  }
];

export function findTest(id) {
  return TESTS.find((t) => t.id === id) ?? TESTS[0];
}

export function camerasForTest(test) {
  if (test.cameras.some((camera) => camera.id === 'free')) return test.cameras;
  const start = test.cameras.find((camera) => camera.id === 'drone-mid') ?? test.cameras[0];
  return [
    ...test.cameras,
    {
      id: 'free', name: 'Free camera', detail: 'Mouse · starts at mid drone', style: 'free',
      pos: [...start.pos], look: [...start.look], focal: 40, fstop: 4
    }
  ];
}
