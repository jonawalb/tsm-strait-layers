// Layer, site and route definitions. Ranges marked notional are round teaching numbers.
// Sourced ranges: CSIS Missile Defense Project, "Missile Threat" (China overview; DF-15, DF-16 via country table, DF-21, DF-26, ATACMS pages).
// SRBM: DF-15 600-900 km and DF-16 800-1,000 km per CSIS; the ring is drawn at 900 km. ATACMS: 300 km (Block 1A) per CSIS.

export const FUJIAN = [119.78, 25.50]; // Pingtan area, the closest mainland point to Taiwan

/** PLA layers. role: ship = anti-ship, land = land attack, air = air defense, sensor. */
export const PLA = [
  { id: 'df26', group: 'Anti-ship ballistic', name: 'DF-26 IRBM', r: 4000, c: [112.9, 27.3], col: '--df26', role: 'ship', c2: true,
    rng: '4,000 km', src: 'CSIS', kmPerMin: 190, ballistic: true },
  { id: 'df21', group: 'Anti-ship ballistic', name: 'DF-21D ASBM', r: 1500, c: [115.9, 26.3], col: '--df21', role: 'ship', c2: true,
    rng: '~1,500 km', src: 'CSIS', kmPerMin: 130, ballistic: true },
  { id: 'ascm', group: 'Anti-ship cruise', name: 'Coastal anti-ship missiles', r: 400, c: FUJIAN, col: '--ascm', role: 'ship', c2: false,
    rng: '~400 km*', kmPerMin: 25 },
  { id: 'srbm', group: 'Land attack', name: 'DF-15/16 SRBM', r: 900, c: [117.7, 25.7], col: '--srbm', role: 'land', rng: '600–1,000 km', src: 'CSIS' },
  { id: 'sam', group: 'Air defense', name: 'Long-range SAM (HQ-9 / S-400 class)', short: 'Long-range SAM', r: 250, c: FUJIAN, col: '--sam', role: 'air', rng: '~250 km*' },
  { id: 'sky', group: 'Sensors', name: 'Skywave OTH radar', r: 2800, rin: 800, c: [114.7, 30.4], col: '--sky', role: 'sensor', rng: '800–2,800 km*' },
  { id: 'sig', group: 'Sensors', name: 'Passive signals intercept', r: 1000, c: FUJIAN, col: '--sig', role: 'sensor', rng: '~1,000 km*' },
  { id: 'aew', group: 'Sensors', name: 'KJ-500 airborne early warning', short: 'KJ-500', r: 400, c: [119.25, 24.35], col: '--aew', role: 'sensor', rng: '~400 km*' },
  { id: 'surf', group: 'Sensors', name: 'Surface-wave OTH radar', r: 300, c: FUJIAN, col: '--surf', role: 'sensor', rng: '~300 km*' },
];

const TW_WEST = [[121.3, 25.1], [120.6, 24.4], [120.25, 23.6], [120.3, 22.7], [121.75, 24.3]];

/** Taiwan layers used in the crossing scenario. */
export const TAIWAN = [
  { id: 'twatacms', group: 'Taiwan strike', name: 'HIMARS / ATACMS (land attack)', short: 'ATACMS', r: 300, cs: [[120.7, 24.5], [120.35, 23.1]],
    col: '--twland', role: 'land', rng: '300 km', src: 'CSIS' },
  { id: 'twmpa', group: 'Taiwan sensors', name: 'Maritime patrol (P-3C / MQ-9B)', short: 'Maritime patrol', r: 400, cs: [[120.6, 23.7]],
    col: '--twsense', role: 'sensor', rng: '~400 km*' },
  { id: 'twradar', group: 'Taiwan sensors', name: 'Coastal surveillance radar', short: 'Coastal radar', r: 100, cs: TW_WEST,
    col: '--twsense', role: 'sensor', rng: '~100 km*' },
  { id: 'twascm', group: 'Taiwan anti-ship', name: 'Coastal anti-ship missiles (Hsiung Feng / Harpoon)', short: 'Coastal anti-ship missiles', r: 150, cs: TW_WEST,
    col: '--tw', role: 'ship', rng: '~125–150 km*' },
  { id: 'twdrone', group: 'Taiwan anti-ship', name: 'Attack drones & uncrewed surface vessels', short: 'Drones & USVs', r: 60, cs: TW_WEST,
    col: '--twdrone', role: 'ship', rng: '~60 km*', optional: true },
];

export const BASES = [
  { n: 'Kadena AB, Okinawa', short: 'Kadena AB', c: [127.77, 26.35] },
  { n: 'Ishigaki (JGSDF)', short: 'Ishigaki', c: [124.18, 24.40], dy: -14 },
  { n: 'Yonaguni (JGSDF)', short: 'Yonaguni', c: [122.95, 24.45] },
  { n: 'Batanes, Philippines', short: 'Batanes', c: [121.97, 20.45] },
  { n: 'Santa Ana EDCA site', short: 'Santa Ana EDCA', c: [122.15, 18.50] },
  { n: 'Taipei', c: [121.56, 25.04], hidden: true },
  { n: 'Guam', c: [144.8, 13.44], hidden: true },
];

export const BLUE_ROUTES = [
  { id: 'phil', n: 'Philippine Sea approach', pts: [[133.6, 19.4], [128.5, 21.4], [125.0, 22.7], [122.55, 23.45]] },
  { id: 'strait', n: 'Strait transit, north to south', pts: [[122.8, 28.3], [121.0, 25.9], [119.95, 24.65], [119.1, 23.3], [117.6, 21.4]] },
  { id: 'bashi', n: 'Bashi Channel to South China Sea', pts: [[130.5, 20.6], [124.5, 20.9], [121.2, 21.1], [118.5, 20.4], [114.8, 19.3]] },
  { id: 'miyako', n: 'Miyako Strait to East China Sea', pts: [[132.0, 23.4], [127.3, 25.0], [126.2, 25.55], [124.4, 27.1], [122.8, 28.8]] },
];

/** Notional crossing lanes, from embarkation areas to west-coast landing areas. */
export const RED_ROUTES = [
  { id: 'north', n: 'Pingtan to Taoyuan coast', port: 'Pingtan', pts: [[119.85, 25.45], [120.5, 25.3], [121.05, 25.08]] },
  { id: 'central', n: 'Xiamen to Taichung coast', port: 'Xiamen', pts: [[118.2, 24.38], [118.6, 24.25], [119.6, 24.25], [120.45, 24.27]] },
  { id: 'south', n: 'Shantou to Tainan coast', port: 'Shantou', pts: [[116.8, 23.3], [117.4, 23.05], [119.2, 23.0], [120.1, 23.0]] },
];

export const MEDIAN_LINE = [[122.0, 27.0], [118.0, 23.0]];
export const FIRST_ISLAND_CHAIN = [[130.6, 31.4], [129.5, 28.3], [127.8, 26.4], [125.3, 24.8], [123.0, 24.45], [121.9, 24.9],
  [121.7, 23.0], [121.0, 21.8], [121.9, 20.4], [122.2, 18.5], [121.2, 16.2]];

/** CCG incident locations as recorded in the TSM tracker. offmap: drawn at the map edge. */
export const CCG_LOCS = {
  'Kinmen': { c: [118.35, 24.43] },
  'Dongsha': { c: [116.73, 20.7] },
  'Penghu': { c: [119.57, 23.57] },
  'East of Taiwan': { c: [122.35, 22.7] },
  'Taiwan': { c: [120.6, 21.6], label: 'Off southern Taiwan' },
  'Taiping Island': { c: [114.4, 16.35], offmap: 'Taiping Island (Spratlys) ↓' },
};

export const PLACES = [
  ['Taipei', 121.56, 25.04, 1], ['Kaohsiung', 120.3, 22.63, 1], ['Taichung', 120.68, 24.15, 1], ['Fuzhou', 119.3, 26.08, -1],
  ['Xiamen', 118.09, 24.48, -1], ['Shantou', 116.68, 23.35, -1], ['Shanghai', 121.47, 31.23, 1], ['Hong Kong', 114.17, 22.3, -1],
  ['Naha', 127.68, 26.21, 1], ['Pingtan', 119.78, 25.5, -1], ['Manila ↓', 121.0, 16.2, 1],
];

export const SEAS = [
  ['EAST CHINA SEA', 125.3, 29.6, 0], ['PHILIPPINE SEA', 129.2, 19.2, 0], ['SOUTH CHINA SEA', 114.6, 18.0, 0],
  ['Taiwan Strait', 119.15, 23.8, -58], ['Luzon Strait', 121.4, 20.95, 0], ['Miyako Strait', 126.1, 24.75, 0],
];
