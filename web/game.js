// DealerCraft by Buggy Games YT
import * as THREE from './three.module.min.js';

// ================== CONSTANTS ==================
const W = 64, D = 64, H = 32, CH = 16;          // world size, chunk size
const SEA = 9, G = 13;                          // water level, village ground
const VX = 32, VZ = 32;                         // village centre
const DAY = 600;                                // seconds per day
const SAVE_KEY = 'dealercraft_save_v1';

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7,
      PLANKS = 8, FARM = 9, COBBLE = 10, GLASS = 11, BRICK = 12;
const TRANSPARENT = new Set([WATER, LEAVES, GLASS]);
// tile per block: [top, bottom, side]
const BT = {
  [GRASS]: [0, 2, 1], [DIRT]: [2, 2, 2], [STONE]: [3, 3, 3], [SAND]: [4, 4, 4], [WATER]: [5, 5, 5],
  [LOG]: [7, 7, 6], [LEAVES]: [8, 8, 8], [PLANKS]: [9, 9, 9], [FARM]: [10, 2, 2], [COBBLE]: [11, 11, 11],
  [GLASS]: [12, 12, 12], [BRICK]: [13, 13, 13],
};
const BNAME = { [GRASS]: 'Grass', [DIRT]: 'Dirt', [STONE]: 'Stone', [SAND]: 'Sand', [WATER]: 'Water', [LOG]: 'Log',
  [LEAVES]: 'Leaves', [PLANKS]: 'Planks', [FARM]: 'Farmland', [COBBLE]: 'Cobblestone', [GLASS]: 'Glass', [BRICK]: 'Bricks' };

// crops: tile base (4 stages), grow seconds, harvest yield
const CROPS = {
  wheat:   { name: 'Wheat',   tile: 16, grow: 45,  yield: [1, 2], seeds: [1, 2] },
  carrot:  { name: 'Carrots', tile: 20, grow: 60,  yield: [2, 3], seeds: [0, 1] },
  potato:  { name: 'Potatoes',tile: 24, grow: 60,  yield: [2, 3], seeds: [0, 1] },
  berries: { name: 'Berries', tile: 28, grow: 75,  yield: [2, 4], seeds: [0, 1] },
  pumpkin: { name: 'Pumpkin', tile: 32, grow: 100, yield: [1, 1], seeds: [1, 1] },
};

// items
const ITEMS = {
  dirt:   { name: 'Dirt', block: DIRT }, cobble: { name: 'Cobblestone', block: COBBLE }, sand: { name: 'Sand', block: SAND },
  log:    { name: 'Log', block: LOG }, leaves: { name: 'Leaves', block: LEAVES }, planks: { name: 'Planks', block: PLANKS },
  glass:  { name: 'Glass', block: GLASS }, brick: { name: 'Bricks', block: BRICK },
  hoe:    { name: 'Wooden Hoe', emoji: '⛏️', tool: 1 },
  golden_hoe: { name: 'Golden Hoe (tills 3x3)', emoji: '⚒️', tool: 3 },
  fertilizer: { name: 'Fertilizer (instant grow)', emoji: '🧪' },
  seeds_wheat:   { name: 'Wheat Seeds',   emoji: '🌱', tag: 'WHT', crop: 'wheat' },
  seeds_carrot:  { name: 'Carrot Seeds',  emoji: '🌱', tag: 'CAR', crop: 'carrot' },
  seeds_potato:  { name: 'Potato Seeds',  emoji: '🌱', tag: 'POT', crop: 'potato' },
  seeds_berries: { name: 'Berry Seeds',   emoji: '🌱', tag: 'BER', crop: 'berries' },
  seeds_pumpkin: { name: 'Pumpkin Seeds', emoji: '🌱', tag: 'PMP', crop: 'pumpkin' },
  wheat: { name: 'Wheat', emoji: '🌾' }, carrot: { name: 'Carrot', emoji: '🥕' }, potato: { name: 'Potato', emoji: '🥔' },
  berries: { name: 'Berries', emoji: '🫐' }, pumpkin: { name: 'Pumpkin', emoji: '🎃' },
  bread: { name: 'Bread', emoji: '🍞' }, carrot_cake: { name: 'Carrot Cake', emoji: '🍰' },
  baked_potato: { name: 'Baked Potato', emoji: '🍠' }, pumpkin_pie: { name: 'Pumpkin Pie', emoji: '🥧' },
  berry_juice: { name: 'Berry Juice', emoji: '🧃' }, veggie_stew: { name: 'Veggie Stew', emoji: '🍲' },
};
const CROP_ITEM = { wheat: 'wheat', carrot: 'carrot', potato: 'potato', berries: 'berries', pumpkin: 'pumpkin' };
const BLOCK_DROP = { [GRASS]: 'dirt', [DIRT]: 'dirt', [FARM]: 'dirt', [STONE]: 'cobble', [COBBLE]: 'cobble', [SAND]: 'sand',
  [LOG]: 'log', [LEAVES]: 'leaves', [PLANKS]: 'planks', [GLASS]: 'glass', [BRICK]: 'brick' };

const RECIPES = [
  { out: 'planks', n: 4, need: { log: 1 } },
  { out: 'glass', n: 1, need: { sand: 2 } },
  { out: 'brick', n: 2, need: { cobble: 2 } },
  { out: 'bread', n: 1, need: { wheat: 3 } },
  { out: 'carrot_cake', n: 1, need: { wheat: 2, carrot: 2 } },
  { out: 'baked_potato', n: 1, need: { potato: 1, planks: 1 } },
  { out: 'pumpkin_pie', n: 1, need: { pumpkin: 1, wheat: 1 } },
  { out: 'berry_juice', n: 1, need: { berries: 3, glass: 1 } },
  { out: 'veggie_stew', n: 1, need: { carrot: 1, potato: 1, pumpkin: 1 } },
];

const VILLAGERS = [
  { name: 'Farmer Fred', job: 'Farmer', robe: 0x3f8f3a, hat: 0xd9b35b,
    sells: { seeds_wheat: 2, seeds_carrot: 4, seeds_potato: 4, seeds_berries: 6, seeds_pumpkin: 10 },
    buys: { wheat: 3, carrot: 5, potato: 5, berries: 4, pumpkin: 18 } },
  { name: 'Baker Betty', job: 'Baker', robe: 0xf2f2f2, hat: 0xff8fb1,
    sells: {}, buys: { bread: 14, carrot_cake: 30, pumpkin_pie: 32 } },
  { name: 'Chef Carl', job: 'Chef', robe: 0xc0392b, hat: 0xffffff,
    sells: {}, buys: { baked_potato: 12, berry_juice: 22, veggie_stew: 45 } },
  { name: 'Merchant Mo', job: 'Merchant', robe: 0x7b3fb5, hat: 0x2a1a40,
    sells: { fertilizer: 8, log: 2, glass: 3, golden_hoe: 150 }, buys: { planks: 1, cobble: 1, brick: 2, leaves: 1 } },
];
const RANKS = [[0, 'Rookie Grower'], [100, 'Street Farmer'], [400, 'Market Dealer'], [1200, 'Crop Boss'], [3000, 'DealerCraft Tycoon']];

// ================== RANDOM / NOISE ==================
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, z, s) { let h = x * 374761393 + z * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s) { return vnoise(x / 24, z / 24, s) * 0.6 + vnoise(x / 11, z / 11, s + 7) * 0.3 + vnoise(x / 5, z / 5, s + 13) * 0.1; }
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ================== STATE ==================
let state = null;
function newState() {
  return { seed: (Math.random() * 1e9) | 0, edits: {}, crops: {}, inv: { hoe: 1, seeds_wheat: 8, seeds_carrot: 4 },
    hotbar: ['hoe', 'seeds_wheat', 'seeds_carrot', null, null, null, null, null, null], sel: 0,
    coins: 20, earned: 0, time: DAY * 0.3, gameTime: 0, pos: [VX + 0.5, G + 1, VZ - 4.5], yaw: Math.PI, pitch: -0.2 };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.seed != null) return Object.assign(newState(), s); } catch (e) {}
  return null;
}
function save() {
  state.pos = [player.pos.x, player.pos.y, player.pos.z]; state.yaw = player.yaw; state.pitch = player.pitch;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
state = load();
const freshGame = !state;
if (!state) state = newState();

// ================== WORLD ==================
const world = new Uint8Array(W * D * H);
const idx = (x, y, z) => x + z * W + y * W * D;
function get(x, y, z) { if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return AIR; if (y < 0) return STONE; return world[idx(x, y, z)]; }
function rawSet(x, y, z, v) { if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H) return; world[idx(x, y, z)] = v; }
const solid = id => id !== AIR && id !== WATER;

function generate() {
  const s = state.seed, rnd = mulberry(s);
  const hm = [];
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    let h = 6 + fbm(x, z, s) * 16;
    const dist = Math.hypot(x - VX, z - VZ);
    const t = Math.min(1, Math.max(0, (dist - 13) / 9));       // flatten village
    h = Math.round(G * (1 - t) + h * t);
    // edge falloff so the world is an island
    const edge = Math.min(x, z, W - 1 - x, D - 1 - z);
    if (edge < 5) h = Math.min(h, SEA - 2 + edge);
    hm[x + z * W] = h;
    for (let y = 0; y <= h; y++) {
      let b = y < h - 3 ? STONE : DIRT;
      if (y === h) b = h <= SEA + 1 ? SAND : GRASS;
      rawSet(x, y, z, b);
    }
    for (let y = h + 1; y <= SEA; y++) rawSet(x, y, z, WATER);
  }
  // trees
  for (let i = 0; i < 70; i++) {
    const x = 3 + Math.floor(rnd() * (W - 6)), z = 3 + Math.floor(rnd() * (D - 6));
    if (Math.hypot(x - VX, z - VZ) < 18) continue;
    const h = hm[x + z * W];
    if (get(x, h, z) !== GRASS) continue;
    const th = 4 + Math.floor(rnd() * 2);
    for (let y = 1; y <= th; y++) rawSet(x, h + y, z, LOG);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = th - 1; dy <= th + 1; dy++) {
      const r = Math.abs(dx) + Math.abs(dz) + (dy > th ? 1 : 0);
      if (r <= 3 && get(x + dx, h + dy, z + dz) === AIR && !(dx === 0 && dz === 0 && dy <= th)) rawSet(x + dx, h + dy, z + dz, LEAVES);
    }
  }
  // plaza
  for (let x = VX - 4; x <= VX + 4; x++) for (let z = VZ - 4; z <= VZ + 4; z++)
    if (Math.abs(x - VX) + Math.abs(z - VZ) <= 6) rawSet(x, G, z, COBBLE);
  rawSet(VX, G, VZ, WATER); // little well
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) rawSet(VX + dx, G + 1, VZ + dz, COBBLE);
  // houses
  const houses = [[VX - 13, VZ - 3, 'S'], [VX + 9, VZ - 3, 'N'], [VX - 3, VZ + 9, 'W'], [VX - 3, VZ - 13, 'E']];
  for (const [hx, hz] of houses) {
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) {
      rawSet(hx + x, G, hz + z, PLANKS);
      for (let y = 1; y <= 4; y++) rawSet(hx + x, G + y, hz + z, AIR);
      const wall = x === 0 || z === 0 || x === 4 || z === 4;
      if (wall) for (let y = 1; y <= 3; y++) {
        const corner = (x === 0 || x === 4) && (z === 0 || z === 4);
        rawSet(hx + x, G + y, hz + z, corner ? LOG : (y === 2 && (x === 2 || z === 2) ? GLASS : PLANKS));
      }
      rawSet(hx + x, G + 4, hz + z, BRICK);
    }
    // door facing the plaza
    const cx = hx + 2, cz = hz + 2, ddx = Math.sign(VX - cx), ddz = Math.sign(VZ - cz);
    const doorX = Math.abs(VX - cx) > Math.abs(VZ - cz) ? cx + ddx * 2 : cx, doorZ = Math.abs(VX - cx) > Math.abs(VZ - cz) ? cz : cz + ddz * 2;
    rawSet(doorX, G + 1, doorZ, AIR); rawSet(doorX, G + 2, doorZ, AIR);
  }
  // starter farm plot with water channel
  for (let x = VX + 6; x <= VX + 10; x++) for (let z = VZ + 6; z <= VZ + 10; z++) rawSet(x, G, z, x === VX + 8 ? WATER : FARM);
}

function applyEdits() { for (const k in state.edits) { const [x, y, z] = k.split(',').map(Number); rawSet(x, y, z, state.edits[k]); } }

// ================== TEXTURES ==================
const TS = 16, AT = 8; // tile px, atlas tiles per row
const atlas = document.createElement('canvas'); atlas.width = atlas.height = TS * AT;
const actx = atlas.getContext('2d');
function paintTile(t, fn) {
  const ox = (t % AT) * TS, oy = Math.floor(t / AT) * TS, r = mulberry(t * 9973 + 17);
  const px = (x, y, c) => { actx.fillStyle = c; actx.fillRect(ox + x, oy + y, 1, 1); };
  fn(px, r);
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const noiseFill = (px, r, base, v, a = 1) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - 0.5) * v; px(x, y, rgb(base[0] + k, base[1] + k, base[2] + k, a)); } };
paintTile(0, (px, r) => noiseFill(px, r, [92, 170, 60], 40));
paintTile(2, (px, r) => noiseFill(px, r, [134, 96, 67], 40));
paintTile(1, (px, r) => { noiseFill(px, r, [134, 96, 67], 40); for (let x = 0; x < TS; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) { const k = (r() - .5) * 40; px(x, y, rgb(92 + k, 170 + k, 60 + k)); } } });
paintTile(3, (px, r) => { noiseFill(px, r, [125, 125, 125], 30); for (let i = 0; i < 6; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; px(x, y, '#6b6b6b'); px(x + 1, y, '#6b6b6b'); } });
paintTile(4, (px, r) => noiseFill(px, r, [219, 207, 160], 25));
paintTile(5, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = Math.sin((x + y * 0.5) * 0.8) * 12 + (r() - .5) * 10; px(x, y, rgb(40 + k, 90 + k, 200 + k, 0.75)); } });
paintTile(6, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (x % 4 === 0 ? -25 : 0) + (r() - .5) * 20; px(x, y, rgb(104 + k, 80 + k, 48 + k)); } });
paintTile(7, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const d = Math.hypot(x - 7.5, y - 7.5); const k = (Math.floor(d) % 2 ? -18 : 0) + (r() - .5) * 10; px(x, y, d > 7 ? rgb(104, 80, 48) : rgb(170 + k, 136 + k, 86 + k)); } });
paintTile(8, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (r() < 0.18) continue; const k = (r() - .5) * 50; px(x, y, rgb(50 + k, 130 + k, 40 + k)); } });
paintTile(9, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (y % 4 === 3 ? -40 : 0) + ((x + (y >> 2) * 5) % 8 === 0 ? -25 : 0) + (r() - .5) * 14; px(x, y, rgb(184 + k, 148 + k, 95 + k)); } });
paintTile(10, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (y % 4 < 1 ? -30 : 0) + (r() - .5) * 20; px(x, y, rgb(92 + k, 60 + k, 38 + k)); } });
paintTile(11, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const cell = (Math.floor(x / 5) * 7 + Math.floor((y + (Math.floor(x / 5) % 2) * 2) / 4) * 3) % 5; const edge = x % 5 === 0 || (y + (Math.floor(x / 5) % 2) * 2) % 4 === 0; const k = edge ? -45 : cell * 8 + (r() - .5) * 15; px(x, y, rgb(130 + k, 130 + k, 130 + k)); } });
paintTile(12, (px) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const e = x === 0 || y === 0 || x === 15 || y === 15; const shine = (x - y === 3 || x - y === 4) && x > 3 && x < 12; if (e) px(x, y, 'rgba(220,240,255,.95)'); else if (shine) px(x, y, 'rgba(255,255,255,.6)'); } });
paintTile(13, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const row = y >> 2, off = row % 2 ? 4 : 0; const mortar = y % 4 === 3 || (x + off) % 8 === 7; const k = (r() - .5) * 25; px(x, y, mortar ? rgb(190, 180, 170) : rgb(160 + k, 70 + k, 55 + k)); } });
// crop tiles: stage 0..3
function paintCrop(base, stem, fruit, fruitShape) {
  for (let s = 0; s < 4; s++) paintTile(base + s, (px, r) => {
    const hgt = 3 + s * 4;
    for (let i = 0; i < 6; i++) {
      const x = 1 + i * 2 + (r() * 2 | 0);
      const hh = hgt - (r() * 3 | 0);
      for (let y = 0; y < hh; y++) px(x, 15 - y, s === 3 && fruitShape === 'top' && y > hh - 4 ? fruit : stem);
      if (s >= 2 && fruitShape === 'leaf') { px(x - 1, 15 - hh + 2, stem); px(x + 1, 15 - hh + 3, stem); }
    }
    if (s === 3 && fruitShape === 'root') for (let i = 0; i < 4; i++) { const x = 2 + i * 4; px(x, 15, fruit); px(x + 1, 15, fruit); px(x, 14, fruit); px(x + 1, 14, fruit); }
    if (s === 3 && fruitShape === 'dots') for (let i = 0; i < 9; i++) { const x = 2 + (r() * 12 | 0), y = 4 + (r() * 9 | 0); px(x, y, fruit); px(x + 1, y, fruit); px(x, y + 1, fruit); }
    if (fruitShape === 'big') {
      const R = s === 3 ? 5 : s === 2 ? 3 : 0;
      if (R) for (let y = -R; y <= R; y++) for (let x = -R - 1; x <= R + 1; x++) if (x * x / ((R + 1.5) ** 2) + y * y / ((R + .5) ** 2) <= 1) px(8 + x, 15 - R + y, (x % 3 === 0) ? '#c45a0c' : fruit);
    }
  });
}
paintCrop(16, '#7cb342', '#e6c84a', 'top');
paintCrop(20, '#43a047', '#ff8f1f', 'root');
paintCrop(24, '#558b2f', '#c9a36b', 'root');
paintCrop(28, '#2e7d32', '#3f51b5', 'dots');
paintCrop(32, '#689f38', '#ff8c1a', 'big');

const tex = new THREE.CanvasTexture(atlas);
tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
function tileURL(t) { const c = document.createElement('canvas'); c.width = c.height = TS; c.getContext('2d').drawImage(atlas, (t % AT) * TS, Math.floor(t / AT) * TS, TS, TS, 0, 0, TS, TS); return c.toDataURL(); }
const iconCache = {};
function iconHTML(id) {
  const it = ITEMS[id]; if (!it) return '';
  if (it.block != null) { if (!iconCache[id]) iconCache[id] = tileURL(BT[it.block][2]); return `<img src="${iconCache[id]}">`; }
  return it.emoji;
}

// ================== RENDERER ==================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
scene.fog = new THREE.Fog(0x87ceeb, 30, 70);
const ambient = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(30, 50, 20); scene.add(sun);
const matOpaque = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 });
const matWater = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
const matCrop = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ================== MESHING ==================
const FACES = [
  { d: [-1, 0, 0], s: 0.75, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { d: [1, 0, 0], s: 0.75, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { d: [0, -1, 0], s: 0.5, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]], f: 1 },
  { d: [0, 1, 0], s: 1.0, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]], f: 0 },
  { d: [0, 0, -1], s: 0.85, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { d: [0, 0, 1], s: 0.85, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const chunks = {};
function tileUV(t, u, v) { const e = 0.001, s = 1 / AT; return [(t % AT) * s + e + u * (s - 2 * e), 1 - (Math.floor(t / AT) + 1) * s + e + v * (s - 2 * e)]; }
function buildChunk(cx, cz) {
  const key = cx + ',' + cz;
  const A = { p: [], n: [], u: [], c: [], i: [] }, Bw = { p: [], n: [], u: [], c: [], i: [] };
  for (let x = cx * CH; x < cx * CH + CH; x++) for (let z = cz * CH; z < cz * CH + CH; z++) for (let y = 0; y < H; y++) {
    const id = world[idx(x, y, z)]; if (id === AIR) continue;
    const T = BT[id];
    for (const f of FACES) {
      const nb = get(x + f.d[0], y + f.d[1], z + f.d[2]);
      if (id === WATER) { if (nb !== AIR) continue; }
      else if (nb !== AIR && !(TRANSPARENT.has(nb) && nb !== id)) continue;
      const tgt = id === WATER ? Bw : A;
      const tile = f.f === 0 ? T[0] : f.f === 1 ? T[1] : T[2];
      const base = tgt.p.length / 3;
      const topDrop = (id === WATER && f.d[1] === 1) ? 0.12 : (id === FARM && f.d[1] === 1 ? 0.06 : 0);
      for (const c of f.c) {
        tgt.p.push(x + c[0], y + c[1] - (c[1] === 1 ? topDrop : 0), z + c[2]);
        tgt.n.push(...f.d);
        tgt.u.push(...tileUV(tile, c[3], c[4]));
        tgt.c.push(f.s, f.s, f.s);
      }
      tgt.i.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  const old = chunks[key];
  if (old) { for (const m of old) { scene.remove(m); m.geometry.dispose(); } }
  const meshes = [];
  for (const [arr, mat] of [[A, matOpaque], [Bw, matWater]]) {
    if (!arr.i.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(arr.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(arr.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr.c, 3));
    g.setIndex(arr.i);
    const m = new THREE.Mesh(g, mat); if (mat === matWater) m.renderOrder = 1;
    scene.add(m); meshes.push(m);
  }
  chunks[key] = meshes;
}
function setBlock(x, y, z, id) {
  if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H) return;
  rawSet(x, y, z, id); state.edits[x + ',' + y + ',' + z] = id;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  buildChunk(cx, cz);
  if (x % CH === 0 && cx > 0) buildChunk(cx - 1, cz);
  if (x % CH === CH - 1 && cx < W / CH - 1) buildChunk(cx + 1, cz);
  if (z % CH === 0 && cz > 0) buildChunk(cx, cz - 1);
  if (z % CH === CH - 1 && cz < D / CH - 1) buildChunk(cx, cz + 1);
}

// crops mesh
let cropMesh = null;
function cropStage(c) { return Math.min(3, Math.floor(Math.min(1, (state.gameTime - c.t) / CROPS[c.type].grow) * 3.999)); }
function buildCrops() {
  if (cropMesh) { scene.remove(cropMesh); cropMesh.geometry.dispose(); }
  const p = [], u = [], n = [], ind = [];
  for (const k in state.crops) {
    const c = state.crops[k], [x, y, z] = k.split(',').map(Number);
    c._st = cropStage(c);
    const tile = CROPS[c.type].tile + c._st;
    const y0 = y - 0.06;
    for (const [ax, az, bx, bz] of [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]]) {
      const b = p.length / 3;
      p.push(x + ax, y0, z + az, x + bx, y0, z + bz, x + ax, y0 + 1, z + az, x + bx, y0 + 1, z + bz);
      u.push(...tileUV(tile, 0, 0), ...tileUV(tile, 1, 0), ...tileUV(tile, 0, 1), ...tileUV(tile, 1, 1));
      n.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      ind.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setIndex(ind);
  cropMesh = new THREE.Mesh(g, matCrop); scene.add(cropMesh);
}

// ================== VILLAGERS ==================
function nameSprite(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 8, 256, 48); x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(text, 128, 43);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(1.6, 0.4, 1); s.renderOrder = 5; return s;
}
const villagers = VILLAGERS.map((v, i) => {
  const g = new THREE.Group();
  const lam = col => new THREE.MeshLambertMaterial({ color: col });
  const skin = lam(0xc58c63);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.4), lam(v.robe)); body.position.y = 0.75; g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), lam(0x3b2a1d)); legs.position.y = 0.15; g.add(legs);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), skin); head.position.y = 1.5; g.add(head);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), skin); nose.position.set(0, 1.42, 0.3); g.add(nose);
  const eyeM = lam(0x1a3d1a);
  for (const ex of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), eyeM); e.position.set(ex, 1.56, 0.26); g.add(e); }
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.62), lam(v.hat)); hat.position.y = 1.84; g.add(hat);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.3), lam(v.robe)); arms.position.set(0, 0.95, 0.22); g.add(arms);
  const tag = nameSprite(v.name); tag.position.y = 2.25; g.add(tag);
  const a = (i / VILLAGERS.length) * Math.PI * 2;
  g.position.set(VX + 0.5 + Math.cos(a) * 3, G + 1, VZ + 0.5 + Math.sin(a) * 3);
  scene.add(g);
  return { ...v, g, target: null, wait: Math.random() * 3, idx: i };
});

// ================== PLAYER ==================
const player = { pos: new THREE.Vector3(...state.pos), vel: new THREE.Vector3(), yaw: state.yaw, pitch: state.pitch, onGround: false };
const PW = 0.3, PH = 1.8, EYE = 1.62;
function collides(p) {
  for (let x = Math.floor(p.x - PW); x <= Math.floor(p.x + PW); x++)
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + PH - 0.01); y++)
      for (let z = Math.floor(p.z - PW); z <= Math.floor(p.z + PW); z++) if (solid(get(x, y, z))) return true;
  return false;
}
function inWater() { return get(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.4), Math.floor(player.pos.z)) === WATER; }

// ================== INPUT ==================
const keys = {};
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');
let playing = false, uiOpen = false;
const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 }, look = { id: null, x: 0, y: 0 };
let wantJump = false, holdBreak = false, breakCd = 0;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!playing) return;
  if (e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); uiOpen ? closePanels() : openBag(); }
  if (e.code === 'Escape' && uiOpen) closePanels();
  if (/^Digit[1-9]$/.test(e.code)) { state.sel = +e.code.slice(5) - 1; renderHotbar(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('wheel', e => { if (!playing || uiOpen) return; state.sel = (state.sel + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar(); });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0025; player.pitch -= e.movementY * 0.0025;
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
});
canvas.addEventListener('mousedown', e => {
  if (isTouch || !playing || uiOpen) return;
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (e.button === 0) { holdBreak = true; breakCd = 0; }
  if (e.button === 2) useAction();
});
addEventListener('mouseup', e => { if (e.button === 0) holdBreak = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// touch
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); if (!playing || uiOpen) return;
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.4 && joy.id === null) { joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY; joy.x = joy.y = 0; }
    else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy; const m = Math.hypot(dx, dy), R = 55;
      if (m > R) { dx *= R / m; dy *= R / m; }
      joy.x = dx / R; joy.y = dy / R;
      document.getElementById('knob').style.transform = `translate(${dx}px,${dy}px)`;
    } else if (t.identifier === look.id) {
      player.yaw -= (t.clientX - look.x) * 0.006; player.pitch -= (t.clientY - look.y) * 0.006;
      player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
      look.x = t.clientX; look.y = t.clientY;
    }
  }
}, { passive: false });
const endTouch = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; document.getElementById('knob').style.transform = ''; }
    if (t.identifier === look.id) look.id = null;
  }
};
canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
function holdBtn(id, down, up) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); down(); }, { passive: false });
  const u = e => { e.preventDefault(); el.classList.remove('on'); up && up(); };
  el.addEventListener('touchend', u); el.addEventListener('touchcancel', u);
}
holdBtn('bJump', () => { wantJump = true; }, () => { wantJump = false; });
holdBtn('bBreak', () => { holdBreak = true; breakCd = 0; }, () => { holdBreak = false; });
holdBtn('bUse', () => useAction());
document.getElementById('bBag').addEventListener('click', () => { if (playing) (uiOpen ? closePanels() : openBag()); });
document.getElementById('bHelp').addEventListener('click', () => showStart());

// ================== RAYCAST ==================
const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
scene.add(highlight);
function getDir() { return new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)); }
function raycast(maxD = 6) {
  const o = camera.position, d = getDir();
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / (d.x || 1e-9)), tdy = Math.abs(1 / (d.y || 1e-9)), tdz = Math.abs(1 / (d.z || 1e-9));
  let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
  let n = [0, 0, 0], t = 0, hit = null;
  while (t <= maxD) {
    const k = x + ',' + y + ',' + z;
    if (state.crops[k]) { hit = { kind: 'crop', x, y, z, n, t, key: k }; break; }
    const id = get(x, y, z);
    if (id !== AIR && id !== WATER) { hit = { kind: 'block', x, y, z, n, t, id }; break; }
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  // villagers
  const ray = new THREE.Ray(o.clone(), d);
  for (const v of villagers) {
    const b = new THREE.Box3(new THREE.Vector3(v.g.position.x - 0.4, v.g.position.y, v.g.position.z - 0.4), new THREE.Vector3(v.g.position.x + 0.4, v.g.position.y + 1.95, v.g.position.z + 0.4));
    const p = ray.intersectBox(b, new THREE.Vector3());
    if (p) { const dist = p.distanceTo(o); if (dist < maxD && (!hit || dist < hit.t)) hit = { kind: 'villager', v, t: dist }; }
  }
  return hit;
}

// ================== ACTIONS ==================
const AC = window.AudioContext ? new AudioContext() : null;
function beep(f = 440, dur = 0.08, type = 'square', vol = 0.06) {
  if (!AC) return; try {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch (e) {}
}
const coinSnd = () => { beep(988, 0.07, 'square', 0.05); setTimeout(() => beep(1319, 0.12, 'square', 0.05), 70); };
function give(id, n = 1) {
  state.inv[id] = (state.inv[id] || 0) + n;
  if (!state.hotbar.includes(id)) { const e = state.hotbar.indexOf(null); if (e >= 0) state.hotbar[e] = id; }
  renderHotbar();
}
function take(id, n = 1) {
  if ((state.inv[id] || 0) < n) return false;
  state.inv[id] -= n;
  if (state.inv[id] <= 0) { delete state.inv[id]; const i = state.hotbar.indexOf(id); if (i >= 0) state.hotbar[i] = null; }
  renderHotbar(); return true;
}
let toastT = 0;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); toastT = 2.2; }

function removeCrop(key, drop) {
  const c = state.crops[key]; if (!c) return;
  delete state.crops[key];
  if (drop) {
    const cr = CROPS[c.type];
    if (cropStage(c) >= 3) {
      const a = rint(...cr.yield), s = rint(...cr.seeds);
      give(CROP_ITEM[c.type], a); if (s) give('seeds_' + c.type, s);
      toast(`+${a} ${ITEMS[CROP_ITEM[c.type]].name}${s ? `, +${s} seeds` : ''}`); beep(660, 0.09, 'triangle', 0.08);
    } else { give('seeds_' + c.type, 1); toast('Not ripe yet, got the seed back'); }
  }
  buildCrops();
}
function breakAction() {
  const h = raycast(); if (!h) return;
  if (h.kind === 'villager') { toast(`${h.v.name}: "Hey! Use ✋ to trade with me."`); return; }
  if (h.kind === 'crop') { removeCrop(h.key, true); return; }
  const id = h.id;
  const above = h.x + ',' + (h.y + 1) + ',' + h.z;
  if (state.crops[above]) removeCrop(above, true);
  setBlock(h.x, h.y, h.z, AIR);
  const drop = BLOCK_DROP[id];
  if (drop && !(id === LEAVES && Math.random() < 0.5)) give(drop, 1);
  if ((id === GRASS || id === LEAVES) && Math.random() < 0.18) { const s = ['seeds_wheat', 'seeds_wheat', 'seeds_carrot', 'seeds_potato', 'seeds_berries'][rint(0, 4)]; give(s, 1); toast(`Found ${ITEMS[s].name}!`); }
  beep(180 + Math.random() * 60, 0.06, 'square', 0.05);
}
function useAction() {
  if (AC && AC.state === 'suspended') AC.resume();
  const h = raycast(); if (!h) return;
  if (h.kind === 'villager') { openTrade(h.v); return; }
  const held = state.hotbar[state.sel], it = ITEMS[held];
  if (h.kind === 'crop') {
    if (held === 'fertilizer') { const c = state.crops[h.key]; if (cropStage(c) < 3) { take('fertilizer'); c.t = state.gameTime - CROPS[c.type].grow - 1; buildCrops(); toast('✨ Fully grown!'); beep(880, 0.15, 'sine', 0.08); } else toast('Already ripe! Break it to harvest.'); }
    else if (cropStage(state.crops[h.key]) >= 3) removeCrop(h.key, true);
    else toast(`${CROPS[state.crops[h.key].type].name}: growing (${Math.round((state.gameTime - state.crops[h.key].t) / CROPS[state.crops[h.key].type].grow * 100)}%)`);
    return;
  }
  if (!it) return;
  if (it.tool) {
    if (h.n[1] !== 1 && h.id !== GRASS && h.id !== DIRT) return;
    const r = it.tool === 3 ? 1 : 0; let n = 0;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = h.x + dx, z = h.z + dz, b = get(x, h.y, z);
      if ((b === GRASS || b === DIRT) && get(x, h.y + 1, z) === AIR) { setBlock(x, h.y, z, FARM); n++; }
    }
    if (n) beep(300, 0.07, 'triangle', 0.07); else toast('Use the hoe on grass or dirt');
    return;
  }
  if (it.crop) {
    if (h.id !== FARM || h.n[1] !== 1) { toast('Plant seeds on farmland (use a hoe first)'); return; }
    const k = h.x + ',' + (h.y + 1) + ',' + h.z;
    if (state.crops[k] || get(h.x, h.y + 1, h.z) !== AIR) return;
    if (!take(held)) return;
    state.crops[k] = { type: it.crop, t: state.gameTime }; buildCrops(); beep(520, 0.06, 'triangle', 0.07);
    return;
  }
  if (it.block != null) {
    const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
    if (get(x, y, z) !== AIR && get(x, y, z) !== WATER) return;
    if (state.crops[x + ',' + y + ',' + z]) return;
    const p = player.pos;
    if (x + 1 > p.x - PW && x < p.x + PW && z + 1 > p.z - PW && z < p.z + PW && y + 1 > p.y && y < p.y + PH) return;
    for (const v of villagers) if (Math.floor(v.g.position.x) === x && Math.floor(v.g.position.z) === z && (y === Math.floor(v.g.position.y) || y === Math.floor(v.g.position.y) + 1)) return;
    if (!take(held)) return;
    setBlock(x, y, z, it.block); beep(240, 0.05, 'square', 0.05);
    const below = (x + ',' + (y + 1) + ',' + z); if (state.crops[below]) removeCrop(below, true);
    return;
  }
  if (held === 'fertilizer') toast('Use fertilizer on a growing crop');
  else toast(`Sell ${it.name} to a villager`);
}

// ================== ECONOMY ==================
const day = () => Math.floor(state.time / DAY) + 1;
function priceMult(id) { return 0.8 + hash2(day(), id.length * 31 + id.charCodeAt(0) * 7 + id.charCodeAt(id.length - 1), 99) * 0.5; }
function sellPrice(base, id) { return Math.max(1, Math.round(base * priceMult(id))); }
function rank() { let r = RANKS[0]; for (const x of RANKS) if (state.earned >= x[0]) r = x; return r; }
function nextRank() { return RANKS.find(x => x[0] > state.earned); }

// ================== UI ==================
function renderHotbar() {
  const hb = document.getElementById('hotbar');
  hb.innerHTML = state.hotbar.map((id, i) => {
    const it = id && ITEMS[id];
    return `<div class="slot ${i === state.sel ? 'sel' : ''}" data-i="${i}">${it ? iconHTML(id) : ''}${it && it.tag ? `<span class="t">${it.tag}</span>` : ''}${it && !it.tool ? `<span class="n">${state.inv[id] || 0}</span>` : ''}</div>`;
  }).join('');
}
document.getElementById('hotbar').addEventListener('pointerdown', e => {
  const s = e.target.closest('.slot'); if (!s) return; e.stopPropagation(); state.sel = +s.dataset.i; renderHotbar();
});
function renderStats() {
  const r = rank(), nr = nextRank(), night = isNight();
  document.getElementById('stats').innerHTML =
    `💰 <b>${state.coins}</b> coins<br>🏆 ${r[1]}${nr ? ` <span style="opacity:.7;font-size:12px">(${nr[0] - state.earned} to ${nr[1]})</span>` : ''}<br>${night ? '🌙' : '☀️'} Day ${day()}`;
}
function closePanels() { document.querySelectorAll('.panel').forEach(p => p.classList.remove('show')); uiOpen = false; holdBreak = false; if (!isTouch && playing) canvas.requestPointerLock(); }
function openPanel(id) { uiOpen = true; holdBreak = false; if (document.pointerLockElement) document.exitPointerLock(); document.getElementById(id).classList.add('show'); }
function need(n) { return Object.entries(n).map(([k, v]) => `${v}× ${iconHTML(k)}`).join(' + '); }
function openBag() { renderBag(); openPanel('bag'); }
function renderBag() {
  const inv = Object.keys(state.inv).filter(k => state.inv[k] > 0);
  let h = `<button class="btn close" data-a="close">✕</button><h2>🎒 Bag</h2><div style="font-size:13px;opacity:.75">Tap an item to put it in hotbar slot ${state.sel + 1}.</div><h3>Items</h3><div class="grid">`;
  h += inv.map(k => `<div class="slot" data-a="pick" data-k="${k}" title="${ITEMS[k].name}">${iconHTML(k)}${ITEMS[k].tag ? `<span class="t">${ITEMS[k].tag}</span>` : ''}<span class="n">${ITEMS[k].tool ? '' : state.inv[k]}</span></div>`).join('') || '<i>Empty</i>';
  h += `</div><h3>Crafting</h3>`;
  for (let i = 0; i < RECIPES.length; i++) {
    const r = RECIPES[i], ok = Object.entries(r.need).every(([k, v]) => (state.inv[k] || 0) >= v);
    h += `<div class="row"><span class="ic">${iconHTML(r.out)}</span><span class="nm">${r.n > 1 ? r.n + '× ' : ''}${ITEMS[r.out].name}<br><span style="font-size:12px;opacity:.8">${need(r.need)}</span></span><button class="btn" data-a="craft" data-i="${i}" ${ok ? '' : 'disabled'}>Craft</button></div>`;
  }
  h += `<h3>Game</h3><div class="row"><span class="nm">Start a brand new world (deletes this save)</span><button class="btn" data-a="reset">New world</button></div>`;
  document.getElementById('bagBox').innerHTML = h;
}
document.getElementById('bagBox').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'close') closePanels();
  if (a === 'pick') { const k = b.dataset.k; const old = state.hotbar.indexOf(k); if (old >= 0) state.hotbar[old] = state.hotbar[state.sel]; state.hotbar[state.sel] = k; renderHotbar(); toast(`${ITEMS[k].name} → slot ${state.sel + 1}`); }
  if (a === 'craft') { const r = RECIPES[+b.dataset.i]; if (Object.entries(r.need).every(([k, v]) => (state.inv[k] || 0) >= v)) { for (const [k, v] of Object.entries(r.need)) take(k, v); give(r.out, r.n); beep(700, 0.08, 'triangle', 0.08); renderBag(); } }
  if (a === 'reset') { if (confirm('Start a new world? Your current farm and coins will be lost.')) { localStorage.removeItem(SAVE_KEY); location.reload(); } }
});
let tradeV = null;
function openTrade(v) { tradeV = v; renderTrade(); openPanel('trade'); beep(500, 0.06, 'sine', 0.06); }
function renderTrade() {
  const v = tradeV;
  let h = `<button class="btn close" data-a="close">✕</button><h2>${v.name}</h2><div style="font-size:13px;opacity:.8">${v.job} · Day ${day()} prices · You have 💰 ${state.coins}</div>`;
  if (Object.keys(v.buys).length) {
    h += `<h3>I'll buy from you</h3>`;
    for (const [k, base] of Object.entries(v.buys)) {
      const p = sellPrice(base, k), have = state.inv[k] || 0, m = priceMult(k);
      const trend = m > 1.08 ? '<span class="up">▲ hot</span>' : m < 0.92 ? '<span class="down">▼ low</span>' : '';
      h += `<div class="row"><span class="ic">${iconHTML(k)}</span><span class="nm">${ITEMS[k].name} <span style="opacity:.7">(have ${have})</span> ${trend}</span><span class="pr">💰 ${p}</span><button class="btn" data-a="sell" data-k="${k}" data-n="1" ${have ? '' : 'disabled'}>Sell 1</button><button class="btn gold" data-a="sell" data-k="${k}" data-n="all" ${have ? '' : 'disabled'}>All</button></div>`;
    }
  }
  if (Object.keys(v.sells).length) {
    h += `<h3>I'll sell to you</h3>`;
    for (const [k, p] of Object.entries(v.sells)) {
      const owned = ITEMS[k].tool && state.inv[k];
      h += `<div class="row"><span class="ic">${iconHTML(k)}</span><span class="nm">${ITEMS[k].name}</span><span class="pr">💰 ${p}</span><button class="btn" data-a="buy" data-k="${k}" data-n="1" ${state.coins >= p && !owned ? '' : 'disabled'}>${owned ? 'Owned' : 'Buy'}</button>${ITEMS[k].tool ? '' : `<button class="btn gold" data-a="buy" data-k="${k}" data-n="5" ${state.coins >= p * 5 ? '' : 'disabled'}>×5</button>`}</div>`;
    }
  }
  document.getElementById('tradeBox').innerHTML = h;
}
document.getElementById('tradeBox').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, k = b.dataset.k;
  if (a === 'close') closePanels();
  if (a === 'sell') {
    const have = state.inv[k] || 0, n = b.dataset.n === 'all' ? have : 1; if (!n) return;
    const p = sellPrice(tradeV.buys[k], k) * n, before = rank();
    take(k, n); state.coins += p; state.earned += p; coinSnd(); toast(`Sold ${n} ${ITEMS[k].name} for 💰${p}`);
    const after = rank(); if (after !== before) setTimeout(() => { toast(`🏆 RANK UP: ${after[1]}!`); beep(523, .1); setTimeout(() => beep(659, .1), 100); setTimeout(() => beep(784, .2), 200); }, 900);
    renderTrade(); renderStats();
  }
  if (a === 'buy') {
    const n = +b.dataset.n, p = tradeV.sells[k] * n; if (state.coins < p) return;
    state.coins -= p; give(k, n); coinSnd(); toast(`Bought ${n} ${ITEMS[k].name}`); renderTrade(); renderStats();
  }
});
for (const id of ['bag', 'trade']) document.getElementById(id).addEventListener('pointerdown', e => { if (e.target.id === id) closePanels(); });

const helpPC = 'WASD move · Space jump · Mouse look<br>Left click: break / harvest · Right click: use, plant, place, trade<br>E: bag & crafting · 1-9 / wheel: hotbar';
const helpTouch = 'Left stick: move · Drag right side: look · ⬆️ jump<br>⛏️ break / harvest · ✋ use, plant, place, trade<br>🎒 Bag: crafting & items';
document.getElementById('helpText').innerHTML = (isTouch ? helpTouch : helpPC) + '<br><br>Hoe grass into farmland, plant seeds, wait for them to ripen, craft food, and sell it to the villagers in the plaza. Prices change every day!';
function showStart() { playing = false; closePanels(); if (document.pointerLockElement) document.exitPointerLock(); document.getElementById('start').style.display = 'flex'; }
document.getElementById('start').addEventListener('click', () => {
  document.getElementById('start').style.display = 'none'; playing = true;
  if (AC && AC.state === 'suspended') AC.resume();
  if (!isTouch) canvas.requestPointerLock();
  if (freshGame && !state._welcomed) { state._welcomed = true; setTimeout(() => toast('Welcome! Visit Farmer Fred for seeds. Your farm plot is next to the plaza.'), 400); }
});
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && playing && !uiOpen && !isTouch) showStart(); });

// ================== DAY / NIGHT ==================
const skyDay = new THREE.Color(0x87ceeb), skyNight = new THREE.Color(0x0b1030), skyDusk = new THREE.Color(0xff9a5a), sky = new THREE.Color();
function isNight() { const f = (state.time % DAY) / DAY; return f > 0.75 || f < 0.02; }
function updateSky() {
  const f = (state.time % DAY) / DAY, a = f * Math.PI * 2;
  const light = Math.max(0, Math.min(1, Math.sin(a) * 2 + 0.3));
  sky.copy(skyNight).lerp(skyDay, light);
  const dusk = Math.max(0, 1 - Math.abs(Math.sin(a)) * 4) * (light > 0.05 ? 1 : 0.4);
  sky.lerp(skyDusk, dusk * 0.5);
  scene.background = sky; scene.fog.color.copy(sky);
  ambient.intensity = 0.25 + light * 0.45; sun.intensity = 0.1 + light * 0.75;
  sun.position.set(Math.cos(a) * 50, Math.sin(a) * 50 + 10, 20);
}

// ================== LOOP ==================
let last = performance.now(), cropTick = 0, saveTick = 0, statTick = 0;
function updatePlayer(dt) {
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
  const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  const sp = (keys.ShiftLeft ? 6.5 : 4.5) * (inWater() ? 0.55 : 1);
  const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw);
  let mx = -sn * fwd + cs * str, mz = -cs * fwd - sn * str; const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  player.vel.x = mx * sp; player.vel.z = mz * sp;
  const water = inWater();
  if (water) { player.vel.y -= 9 * dt; player.vel.y = Math.max(player.vel.y, -2.5); if (keys.Space || wantJump) player.vel.y = 3.2; }
  else { player.vel.y -= 26 * dt; if ((keys.Space || wantJump) && player.onGround) player.vel.y = 8.4; }
  player.vel.y = Math.max(player.vel.y, -40);
  const p = player.pos;
  // axis-separated movement with auto step-up off for simplicity
  for (const ax of ['x', 'z']) {
    const old = p[ax]; p[ax] += player.vel[ax] * dt;
    if (collides(p)) {
      p[ax] = old;
      if (isTouch && player.onGround && m > 0.3) { p.y += 1.05; if (!collides(p)) player.vel.y = 8.4; p.y -= 1.05; }
    }
  }
  p.x = Math.max(0.4, Math.min(W - 0.4, p.x)); p.z = Math.max(0.4, Math.min(D - 0.4, p.z));
  const oy = p.y; p.y += player.vel.y * dt; player.onGround = false;
  if (collides(p)) { if (player.vel.y < 0) { p.y = Math.floor(oy + 0.001); if (collides(p)) p.y = oy; player.onGround = true; } else p.y = oy; player.vel.y = 0; }
  if (p.y < -10) { p.set(VX + 0.5, G + 2, VZ - 4.5); player.vel.set(0, 0, 0); }
  camera.position.set(p.x, p.y + EYE, p.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}
function groundAt(x, z) { for (let y = H - 1; y >= 0; y--) if (solid(get(Math.floor(x), y, Math.floor(z)))) return y + 1; return G + 1; }
function updateVillagers(dt) {
  for (const v of villagers) {
    const g = v.g, dp = player.pos.distanceTo(g.position);
    if (dp < 3.5) { g.rotation.y = Math.atan2(player.pos.x - g.position.x, player.pos.z - g.position.z); continue; }
    if (v.wait > 0) { v.wait -= dt; continue; }
    if (!v.target) { const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3.5; v.target = new THREE.Vector2(VX + 0.5 + Math.cos(a) * r, VZ + 0.5 + Math.sin(a) * r); }
    const dx = v.target.x - g.position.x, dz = v.target.y - g.position.z, dd = Math.hypot(dx, dz);
    if (dd < 0.1) { v.target = null; v.wait = 2 + Math.random() * 4; continue; }
    const st = Math.min(dd, 1.1 * dt);
    const nx = g.position.x + dx / dd * st, nz = g.position.z + dz / dd * st, ny = groundAt(nx, nz);
    if (ny > g.position.y + 1.1 || get(Math.floor(nx), ny, Math.floor(nz)) === WATER) { v.target = null; v.wait = 1; continue; }
    g.position.set(nx, ny, nz); g.rotation.y = Math.atan2(dx, dz);
  }
}
function updateTarget() {
  const h = raycast(), el = document.getElementById('target');
  if (h && h.kind === 'block') { highlight.visible = true; highlight.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); }
  else if (h && h.kind === 'crop') { highlight.visible = true; highlight.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); }
  else highlight.visible = false;
  let txt = '';
  if (h && h.kind === 'villager') txt = `✋ Trade with ${h.v.name}`;
  else if (h && h.kind === 'crop') { const c = state.crops[h.key]; const pct = Math.min(100, Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100)); txt = `${CROPS[c.type].name}: ${pct >= 100 ? 'RIPE! ⛏️ harvest' : pct + '%'}`; }
  el.style.display = txt ? 'block' : 'none'; el.textContent = txt;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing && !uiOpen) {
    updatePlayer(dt);
    if (holdBreak) { breakCd -= dt; if (breakCd <= 0) { breakAction(); breakCd = 0.28; } }
  } else { camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); }
  if (playing) { state.time += dt; state.gameTime += dt; }
  if (!playing) player.yaw += dt * 0.05; // slow pan on title
  updateVillagers(dt); updateSky(); updateTarget();
  cropTick += dt; if (cropTick > 1) { cropTick = 0; let ch = false; for (const k in state.crops) if (cropStage(state.crops[k]) !== state.crops[k]._st) ch = true; if (ch) buildCrops(); }
  statTick += dt; if (statTick > 0.5) { statTick = 0; renderStats(); }
  saveTick += dt; if (saveTick > 10 && playing) { saveTick = 0; save(); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  renderer.render(scene, camera);
}
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ================== BOOT ==================
generate();
applyEdits();
if (freshGame) {
  // a few starter crops already growing
  for (const [dx, dz] of [[6, 6], [7, 6], [6, 7], [7, 7]]) state.crops[(VX + dx) + ',' + (G + 1) + ',' + (VZ + dz)] = { type: 'wheat', t: -30 };
}
for (let cx = 0; cx < W / CH; cx++) for (let cz = 0; cz < D / CH; cz++) buildChunk(cx, cz);
buildCrops(); renderHotbar(); renderStats(); updateSky();
requestAnimationFrame(frame);
window.__dc = { state, player, villagers, raycast };
