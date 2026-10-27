// DealerCraft by Buggy Games YT  ·  Spooky Season Edition (endless world)
import * as THREE from './three.module.min.js';

// ================== CONSTANTS ==================
const H = 40, CH = 16;                          // world height, chunk size (world is endless in x/z)
const SEA = 9, G = 13;                          // water level, village ground
const VX = 32, VZ = 32;                         // village centre
const GX = VX - 13, GZ = VZ + 13;               // graveyard centre
const DAY = 600;                                // seconds per day
const VIEW = 4;                                 // chunks drawn around the player
const SAVE_KEY = 'dealercraft_save_v1';

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7,
      PLANKS = 8, FARM = 9, COBBLE = 10, GLASS = 11, BRICK = 12, JACK = 13, DEADGRASS = 14, PUMPKIN = 15;
const TRANSPARENT = new Set([WATER, LEAVES, GLASS]);
// tile per block: [top, bottom, side]
const BT = {
  [GRASS]: [0, 2, 1], [DIRT]: [2, 2, 2], [STONE]: [3, 3, 3], [SAND]: [4, 4, 4], [WATER]: [5, 5, 5],
  [LOG]: [7, 7, 6], [LEAVES]: [8, 8, 8], [PLANKS]: [9, 9, 9], [FARM]: [10, 2, 2], [COBBLE]: [11, 11, 11],
  [GLASS]: [12, 12, 12], [BRICK]: [13, 13, 13], [JACK]: [36, 36, 37], [DEADGRASS]: [38, 2, 40], [PUMPKIN]: [36, 36, 39],
};
const BNAME = { [GRASS]: 'Grass', [DIRT]: 'Dirt', [STONE]: 'Stone', [SAND]: 'Sand', [WATER]: 'Water', [LOG]: 'Log',
  [LEAVES]: 'Leaves', [PLANKS]: 'Planks', [FARM]: 'Farmland', [COBBLE]: 'Cobblestone', [GLASS]: 'Glass', [BRICK]: 'Bricks',
  [JACK]: "Jack o'Lantern", [DEADGRASS]: 'Dead Grass', [PUMPKIN]: 'Wild Pumpkin' };

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
  jack_o_lantern: { name: "Jack o'Lantern", block: JACK },
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
  candy: { name: 'Ghost Candy', emoji: '🍬' }, witch_brew: { name: "Witch's Brew", emoji: '⚗️' },
};
const CROP_ITEM = { wheat: 'wheat', carrot: 'carrot', potato: 'potato', berries: 'berries', pumpkin: 'pumpkin' };
const BLOCK_DROP = { [GRASS]: 'dirt', [DIRT]: 'dirt', [FARM]: 'dirt', [STONE]: 'cobble', [COBBLE]: 'cobble', [SAND]: 'sand',
  [LOG]: 'log', [LEAVES]: 'leaves', [PLANKS]: 'planks', [GLASS]: 'glass', [BRICK]: 'brick', [JACK]: 'jack_o_lantern',
  [DEADGRASS]: 'dirt', [PUMPKIN]: 'pumpkin' };

const RECIPES = [
  { out: 'planks', n: 4, need: { log: 1 } },
  { out: 'glass', n: 1, need: { sand: 2 } },
  { out: 'brick', n: 2, need: { cobble: 2 } },
  { out: 'jack_o_lantern', n: 1, need: { pumpkin: 1, planks: 1 } },
  { out: 'bread', n: 1, need: { wheat: 3 } },
  { out: 'carrot_cake', n: 1, need: { wheat: 2, carrot: 2 } },
  { out: 'baked_potato', n: 1, need: { potato: 1, planks: 1 } },
  { out: 'pumpkin_pie', n: 1, need: { pumpkin: 1, wheat: 1 } },
  { out: 'berry_juice', n: 1, need: { berries: 3, glass: 1 } },
  { out: 'veggie_stew', n: 1, need: { carrot: 1, potato: 1, pumpkin: 1 } },
  { out: 'witch_brew', n: 1, need: { berries: 2, pumpkin: 1, candy: 2, glass: 1 } },
];

const VILLAGERS = [
  { name: 'Farmer Fred', job: 'Scarecrow Farmer', robe: 0x3f8f3a, hat: 0xd9b35b, costume: 'pumpkin',
    sells: { seeds_wheat: 2, seeds_carrot: 4, seeds_potato: 4, seeds_berries: 6, seeds_pumpkin: 8 },
    buys: { wheat: 3, carrot: 5, potato: 5, berries: 4, pumpkin: 18 } },
  { name: 'Baker Betty', job: 'Baker', robe: 0xf2f2f2, hat: 0xff8fb1, costume: 'cat',
    sells: {}, buys: { bread: 14, carrot_cake: 30, pumpkin_pie: 32 } },
  { name: 'Count Carl', job: 'Vampire Chef', robe: 0x1a1a1a, hat: 0x1a1a1a, costume: 'vampire',
    sells: {}, buys: { baked_potato: 12, berry_juice: 22, veggie_stew: 45 } },
  { name: 'Merchant Mo', job: 'Merchant', robe: 0x7b3fb5, hat: 0x2a1a40, costume: 'wizard',
    sells: { fertilizer: 8, log: 2, glass: 3, golden_hoe: 150 }, buys: { planks: 1, cobble: 1, brick: 2, leaves: 1 } },
  { name: 'Witch Wanda', job: 'Witch', robe: 0x24132e, hat: 0x111111, costume: 'witch', skin: 0x7fbf5a,
    sells: { seeds_pumpkin: 7, fertilizer: 7 }, buys: { pumpkin: 20, jack_o_lantern: 26, candy: 6, witch_brew: 60 } },
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
  return { seed: (Math.random() * 1e9) | 0, edits: {}, crops: {}, inv: { hoe: 1, seeds_wheat: 8, seeds_carrot: 4, seeds_pumpkin: 3 },
    hotbar: ['hoe', 'seeds_wheat', 'seeds_carrot', 'seeds_pumpkin', null, null, null, null, null], sel: 0,
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

// ================== WORLD (endless, generated in chunks) ==================
const data = new Map();                 // "cx,cz" -> Uint8Array(CH*CH*H)
const ckey = (cx, cz) => cx + ',' + cz;
const lidx = (lx, y, lz) => lx + lz * CH + y * CH * CH;
const fdiv = (a, b) => Math.floor(a / b);
function get(x, y, z) {
  if (y >= H) return AIR; if (y < 0) return STONE;
  const c = data.get(ckey(fdiv(x, CH), fdiv(z, CH))); if (!c) return AIR;
  return c[lidx(x - fdiv(x, CH) * CH, y, z - fdiv(z, CH) * CH)];
}
function rawSet(x, y, z, v) {
  if (y < 0 || y >= H) return;
  const c = data.get(ckey(fdiv(x, CH), fdiv(z, CH))); if (!c) return;
  c[lidx(x - fdiv(x, CH) * CH, y, z - fdiv(z, CH) * CH)] = v;
}
const solid = id => id !== AIR && id !== WATER;

// edits indexed by chunk so they can be re-applied when a chunk generates
const editIdx = new Map();
function indexEdit(k) { const [x, , z] = k.split(',').map(Number); const ck = ckey(fdiv(x, CH), fdiv(z, CH)); if (!editIdx.has(ck)) editIdx.set(ck, new Set()); editIdx.get(ck).add(k); }

const clamp01 = v => Math.max(0, Math.min(1, v));
function heightAt(x, z) {
  const s = state.seed;
  const cont = clamp01((vnoise(x / 150, z / 150, s + 101) - 0.5) * 1.8 + 0.5);       // continents vs. seas
  const mount = clamp01((vnoise(x / 75, z / 75, s + 202) - 0.55) / 0.4);              // mountain ranges
  let h = 1 + cont * 19 + (fbm(x, z, s) - 0.5) * 9 + mount * mount * 20 * cont;
  const dist = Math.hypot(x - VX, z - VZ);
  const t = clamp01((dist - 13) / 9);                                                // flatten the village
  h = G * (1 - t) + h * t;
  return Math.max(1, Math.min(H - 8, Math.round(h)));
}
const deadAt = (x, z) => vnoise(x / 90, z / 90, state.seed + 303) > 0.6;              // spooky dead woods biome
const forestAt = (x, z) => vnoise(x / 45, z / 45, state.seed + 404);

function genChunk(cx, cz) {
  const c = new Uint8Array(CH * CH * H); data.set(ckey(cx, cz), c);
  const x0 = cx * CH, z0 = cz * CH, hm = new Int16Array(CH * CH);
  const L = (lx, y, lz, v) => { if (lx >= 0 && lz >= 0 && lx < CH && lz < CH && y >= 0 && y < H) c[lidx(lx, y, lz)] = v; };
  const Lget = (lx, y, lz) => c[lidx(lx, y, lz)];
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const x = x0 + lx, z = z0 + lz, h = heightAt(x, z); hm[lx + lz * CH] = h;
    const dead = deadAt(x, z);
    for (let y = 0; y <= h; y++) {
      let b = y < h - 3 ? STONE : DIRT;
      if (y === h) b = h <= SEA + 1 ? SAND : h >= 27 ? STONE : dead ? DEADGRASS : GRASS;
      L(lx, y, lz, b);
    }
    for (let y = h + 1; y <= SEA; y++) L(lx, y, lz, WATER);
  }
  // trees and wild pumpkins (kept inside the chunk so neighbours never matter)
  const rnd = mulberry(hash2(cx, cz, state.seed) * 1e9 | 0);
  const dens = forestAt(x0 + 8, z0 + 8), nTrees = Math.floor(dens * dens * 9);
  for (let i = 0; i < nTrees; i++) {
    const lx = 2 + Math.floor(rnd() * (CH - 4)), lz = 2 + Math.floor(rnd() * (CH - 4)), x = x0 + lx, z = z0 + lz;
    if (Math.hypot(x - VX, z - VZ) < 18 || Math.hypot(x - GX, z - GZ) < 6) continue;
    const h = hm[lx + lz * CH], top = Lget(lx, h, lz);
    if (top !== GRASS && top !== DEADGRASS) continue;
    const th = 4 + Math.floor(rnd() * 3);
    for (let y = 1; y <= th; y++) L(lx, h + y, lz, LOG);
    if (top === DEADGRASS) {                                    // bare, twisted dead tree
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let b = 0; b < 2 + Math.floor(rnd() * 2); b++) { const [dx, dz] = dirs[Math.floor(rnd() * 4)], by = h + th - Math.floor(rnd() * 2); L(lx + dx, by, lz + dz, LOG); L(lx + dx * 2, by + 1, lz + dz * 2, LOG); }
      continue;
    }
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = th - 1; dy <= th + 1; dy++) {
      const r = Math.abs(dx) + Math.abs(dz) + (dy > th ? 1 : 0);
      if (r <= 3 && Lget(lx + dx, h + dy, lz + dz) === AIR && !(dx === 0 && dz === 0 && dy <= th)) L(lx + dx, h + dy, lz + dz, LEAVES);
    }
  }
  if (rnd() < 0.3) {                                            // a wild pumpkin patch
    const px = 3 + Math.floor(rnd() * 10), pz = 3 + Math.floor(rnd() * 10);
    for (let i = 0; i < 4 + Math.floor(rnd() * 4); i++) {
      const lx = px + Math.floor(rnd() * 5) - 2, lz = pz + Math.floor(rnd() * 5) - 2, x = x0 + lx, z = z0 + lz;
      if (Math.hypot(x - VX, z - VZ) < 16) continue;
      const h = hm[lx + lz * CH], top = Lget(lx, h, lz);
      if ((top === GRASS || top === DEADGRASS) && Lget(lx, h + 1, lz) === AIR) L(lx, h + 1, lz, PUMPKIN);
    }
  }
  // village & graveyard (fixed structures; each chunk stamps only its own part)
  if (x0 < VX + 24 && x0 + CH > VX - 24 && z0 < VZ + 24 && z0 + CH > VZ - 24) stampVillage((x, y, z, v) => L(x - x0, y, z - z0, v));
  // re-apply the player's edits
  const ed = editIdx.get(ckey(cx, cz));
  if (ed) for (const k of ed) { const [x, y, z] = k.split(',').map(Number); L(x - x0, y, z - z0, state.edits[k]); }
}

function stampVillage(S) {
  // plaza
  for (let x = VX - 4; x <= VX + 4; x++) for (let z = VZ - 4; z <= VZ + 4; z++)
    if (Math.abs(x - VX) + Math.abs(z - VZ) <= 6) S(x, G, z, COBBLE);
  S(VX, G, VZ, WATER); // little well
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) S(VX + dx, G + 1, VZ + dz, COBBLE);
  for (const [dx, dz] of [[3, 3], [-3, 3], [3, -3], [-3, -3]]) S(VX + dx, G + 1, VZ + dz, JACK);   // jack o'lanterns round the plaza
  // houses
  const houses = [[VX - 13, VZ - 3], [VX + 9, VZ - 3], [VX - 3, VZ + 9], [VX - 3, VZ - 13]];
  for (const [hx, hz] of houses) {
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) {
      S(hx + x, G, hz + z, PLANKS);
      for (let y = 1; y <= 4; y++) S(hx + x, G + y, hz + z, AIR);
      const wall = x === 0 || z === 0 || x === 4 || z === 4;
      if (wall) for (let y = 1; y <= 3; y++) {
        const corner = (x === 0 || x === 4) && (z === 0 || z === 4);
        S(hx + x, G + y, hz + z, corner ? LOG : (y === 2 && (x === 2 || z === 2) ? GLASS : PLANKS));
      }
      S(hx + x, G + 4, hz + z, BRICK);
    }
    S(hx, G + 5, hz, JACK); S(hx + 4, G + 5, hz + 4, JACK);         // glowing roof corners
    const cx = hx + 2, cz = hz + 2, ddx = Math.sign(VX - cx), ddz = Math.sign(VZ - cz);
    const doorX = Math.abs(VX - cx) > Math.abs(VZ - cz) ? cx + ddx * 2 : cx, doorZ = Math.abs(VX - cx) > Math.abs(VZ - cz) ? cz : cz + ddz * 2;
    S(doorX, G + 1, doorZ, AIR); S(doorX, G + 2, doorZ, AIR);
  }
  // starter farm plot with water channel
  for (let x = VX + 6; x <= VX + 10; x++) for (let z = VZ + 6; z <= VZ + 10; z++) S(x, G, z, x === VX + 8 ? WATER : FARM);
  // graveyard: dead oak and a ring of jack o'lanterns
  const gh = heightAt(GX, GZ);
  if (gh > SEA + 1) {
    for (let y = 1; y <= 6; y++) S(GX, gh + y, GZ, LOG);
    S(GX + 1, gh + 4, GZ, LOG); S(GX + 2, gh + 5, GZ, LOG); S(GX - 1, gh + 5, GZ, LOG); S(GX - 2, gh + 6, GZ, LOG); S(GX, gh + 5, GZ + 1, LOG); S(GX, gh + 6, GZ + 2, LOG);
    for (const [dx, dz] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) S(GX + dx, heightAt(GX + dx, GZ + dz) + 1, GZ + dz, JACK);
  }
}

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
paintTile(0, (px, r) => noiseFill(px, r, [78, 128, 52], 40));
paintTile(2, (px, r) => noiseFill(px, r, [134, 96, 67], 40));
paintTile(1, (px, r) => { noiseFill(px, r, [134, 96, 67], 40); for (let x = 0; x < TS; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) { const k = (r() - .5) * 40; px(x, y, rgb(78 + k, 128 + k, 52 + k)); } } });
paintTile(3, (px, r) => { noiseFill(px, r, [125, 125, 125], 30); for (let i = 0; i < 6; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; px(x, y, '#6b6b6b'); px(x + 1, y, '#6b6b6b'); } });
paintTile(4, (px, r) => noiseFill(px, r, [219, 207, 160], 25));
paintTile(5, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = Math.sin((x + y * 0.5) * 0.8) * 12 + (r() - .5) * 10; px(x, y, rgb(40 + k, 90 + k, 200 + k, 0.75)); } });
paintTile(6, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (x % 4 === 0 ? -25 : 0) + (r() - .5) * 20; px(x, y, rgb(104 + k, 80 + k, 48 + k)); } });
paintTile(7, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const d = Math.hypot(x - 7.5, y - 7.5); const k = (Math.floor(d) % 2 ? -18 : 0) + (r() - .5) * 10; px(x, y, d > 7 ? rgb(104, 80, 48) : rgb(170 + k, 136 + k, 86 + k)); } });
paintTile(8, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (r() < 0.18) continue; const k = (r() - .5) * 40, q = r(); px(x, y, q < .45 ? rgb(214 + k, 92 + k, 22) : q < .75 ? rgb(170 + k, 40 + k, 24) : q < .9 ? rgb(120 + k, 70 + k, 30) : rgb(230, 170 + k, 40)); } });
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

// spooky tiles: pumpkin top, carved jack face, dead grass, plain pumpkin side, dead grass side
const emi = document.createElement('canvas'); emi.width = emi.height = TS * AT;
const ectx = emi.getContext('2d'); ectx.fillStyle = '#000'; ectx.fillRect(0, 0, emi.width, emi.height);
const pumpkinSide = (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (x % 4 === 0 ? -35 : 0) + (r() - .5) * 18; px(x, y, rgb(230 + k, 120 + k * 0.6, 20)); } };
paintTile(36, (px, r) => { pumpkinSide(px, r); for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) px(x, y, '#4a3a12'); });
const JFACE = ['................', '................', '................', '..##........##..', '..###......###..', '..####....####..', '................', '.......##.......', '......####......', '................', '..#..........#..', '..###.####.###..', '...##########...', '....###..###....', '................', '................'];
paintTile(37, (px, r) => { pumpkinSide(px, r); for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (JFACE[y][x] === '#') px(x, y, rgb(255, 210 + r() * 40, 60)); });
for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (JFACE[y][x] === '#') { ectx.fillStyle = '#ffb030'; ectx.fillRect((37 % AT) * TS + x, Math.floor(37 / AT) * TS + y, 1, 1); }
paintTile(38, (px, r) => noiseFill(px, r, [104, 96, 70], 34));
paintTile(39, pumpkinSide);
paintTile(40, (px, r) => { noiseFill(px, r, [110, 80, 58], 40); for (let x = 0; x < TS; x++) { const d = 2 + Math.floor(r() * 3); for (let y = 0; y < d; y++) { const k = (r() - .5) * 30; px(x, y, rgb(104 + k, 96 + k, 70 + k)); } } });
const emiTex = new THREE.CanvasTexture(emi);
emiTex.magFilter = THREE.NearestFilter; emiTex.minFilter = THREE.NearestFilter; emiTex.colorSpace = THREE.SRGBColorSpace; emiTex.generateMipmaps = false;
function tileTex(t) { const c = document.createElement('canvas'); c.width = c.height = TS; c.getContext('2d').drawImage(atlas, (t % AT) * TS, Math.floor(t / AT) * TS, TS, TS, 0, 0, TS, TS); const tx = new THREE.CanvasTexture(c); tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace; return tx; }
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
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 220);
scene.fog = new THREE.Fog(0x2a1838, 20, 60);
const ambient = new THREE.AmbientLight(0xb8a8ff, 0.5); scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffc89a, 0.6); sun.position.set(30, 50, 20); scene.add(sun);
const moonLight = new THREE.DirectionalLight(0x7f8cff, 0.3); scene.add(moonLight);
const wellGlow = new THREE.PointLight(0xff8a1a, 2.2, 14, 1.4); wellGlow.position.set(VX + 0.5, G + 2.5, VZ + 0.5); scene.add(wellGlow);
const graveGlow = new THREE.PointLight(0x5cff8a, 1.8, 12, 1.4); graveGlow.position.set(GX + 0.5, G + 3, GZ + 0.5); scene.add(graveGlow);
const matOpaque = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: emiTex });
const matWater = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
const matCrop = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// moon and stars follow the camera
function moonTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,200,.55)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = '#fff4d6'; x.beginPath(); x.arc(64, 64, 26, 0, 7); x.fill();
  x.fillStyle = 'rgba(200,190,160,.6)'; for (const [a, b, r] of [[56, 58, 6], [72, 70, 4], [62, 76, 3]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, depthWrite: false, transparent: true }));
moon.scale.set(40, 40, 1); moon.renderOrder = -1; scene.add(moon);
const starGeo = new THREE.BufferGeometry(), sp = [];
for (let i = 0; i < 400; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); if (u < 0.05) { i--; continue; } sp.push(Math.cos(a) * r * 180, u * 180, Math.sin(a) * r * 180); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -2; scene.add(stars);

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
function dropMesh(key) { const old = chunks[key]; if (old) { for (const m of old) { scene.remove(m); m.geometry.dispose(); } delete chunks[key]; } }
function buildChunk(cx, cz) {
  const key = ckey(cx, cz), c = data.get(key); if (!c) return;
  const A = { p: [], n: [], u: [], c: [], i: [] }, Bw = { p: [], n: [], u: [], c: [], i: [] };
  const x0 = cx * CH, z0 = cz * CH;
  for (let y = 0; y < H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const id = c[lidx(lx, y, lz)]; if (id === AIR) continue;
    const x = x0 + lx, z = z0 + lz, T = BT[id];
    for (const f of FACES) {
      const nx = lx + f.d[0], ny = y + f.d[1], nz = lz + f.d[2];
      const nb = (nx >= 0 && nz >= 0 && nx < CH && nz < CH) ? (ny < 0 ? STONE : ny >= H ? AIR : c[lidx(nx, ny, nz)]) : get(x + f.d[0], ny, z + f.d[2]);
      if (id === WATER) { if (nb !== AIR) continue; }
      else if (nb !== AIR && !(TRANSPARENT.has(nb) && nb !== id)) continue;
      const tgt = id === WATER ? Bw : A;
      const tile = f.f === 0 ? T[0] : f.f === 1 ? T[1] : T[2];
      const base = tgt.p.length / 3;
      const topDrop = (id === WATER && f.d[1] === 1) ? 0.12 : (id === FARM && f.d[1] === 1 ? 0.06 : 0);
      for (const q of f.c) {
        tgt.p.push(x + q[0], y + q[1] - (q[1] === 1 ? topDrop : 0), z + q[2]);
        tgt.n.push(f.d[0], f.d[1], f.d[2]);
        const uv = tileUV(tile, q[3], q[4]); tgt.u.push(uv[0], uv[1]);
        tgt.c.push(f.s, f.s, f.s);
      }
      tgt.i.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  dropMesh(key);
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
  if (y < 0 || y >= H) return;
  rawSet(x, y, z, id); const k = x + ',' + y + ',' + z; state.edits[k] = id; indexEdit(k);
  const cx = fdiv(x, CH), cz = fdiv(z, CH), lx = x - cx * CH, lz = z - cz * CH;
  buildChunk(cx, cz);
  if (lx === 0) buildChunk(cx - 1, cz);
  if (lx === CH - 1) buildChunk(cx + 1, cz);
  if (lz === 0) buildChunk(cx, cz - 1);
  if (lz === CH - 1) buildChunk(cx, cz + 1);
}

// chunk streaming: generate data one ring past what is drawn, so borders always mesh correctly
function hasNeighbours(cx, cz) { return data.has(ckey(cx + 1, cz)) && data.has(ckey(cx - 1, cz)) && data.has(ckey(cx, cz + 1)) && data.has(ckey(cx, cz - 1)); }
function streamChunks(genBudget, meshBudget) {
  const pcx = fdiv(Math.floor(player.pos.x), CH), pcz = fdiv(Math.floor(player.pos.z), CH);
  const todoG = [], todoM = [];
  for (let dx = -VIEW - 1; dx <= VIEW + 1; dx++) for (let dz = -VIEW - 1; dz <= VIEW + 1; dz++) {
    const cx = pcx + dx, cz = pcz + dz, d = dx * dx + dz * dz;
    if (d > (VIEW + 1.5) ** 2) continue;
    if (!data.has(ckey(cx, cz))) todoG.push([d, cx, cz]);
    else if (d <= (VIEW + 0.5) ** 2 && !chunks[ckey(cx, cz)] && hasNeighbours(cx, cz)) todoM.push([d, cx, cz]);
  }
  todoG.sort((a, b) => a[0] - b[0]); todoM.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Math.min(genBudget, todoG.length); i++) genChunk(todoG[i][1], todoG[i][2]);
  for (let i = 0; i < Math.min(meshBudget, todoM.length); i++) buildChunk(todoM[i][1], todoM[i][2]);
  // drop meshes (and untouched data) that are far behind the player
  for (const key in chunks) { const [cx, cz] = key.split(',').map(Number); if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (VIEW + 2.5) ** 2) dropMesh(key); }
  if (data.size > 600) for (const key of data.keys()) { const [cx, cz] = key.split(',').map(Number); if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (VIEW + 6) ** 2) { dropMesh(key); data.delete(key); } }
  return todoG.length + todoM.length;
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
  x.fillStyle = 'rgba(20,6,30,.65)'; x.fillRect(0, 8, 256, 48); x.fillStyle = '#ffb347'; x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; x.fillText(text, 128, 43);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(1.6, 0.4, 1); s.renderOrder = 5; return s;
}
const lam = (col, o = {}) => new THREE.MeshLambertMaterial({ color: col, ...o });
function witchHat(g, col, y = 1.78) {
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), lam(col)); brim.position.y = y; g.add(brim);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 10), lam(col)); cone.position.set(0, y + 0.4, -0.04); cone.rotation.x = -0.18; g.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 10), lam(0x8a2be2)); band.position.y = y + 0.07; g.add(band);
}
const villagers = VILLAGERS.map((v, i) => {
  const g = new THREE.Group();
  const skin = lam(v.skin || (v.costume === 'vampire' ? 0xd8d0e0 : 0xc58c63));
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.4), lam(v.robe)); body.position.y = 0.75; g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), lam(0x3b2a1d)); legs.position.y = 0.15; g.add(legs);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.3), lam(v.robe)); arms.position.set(0, 0.95, 0.22); g.add(arms);
  let tagY = 2.25;
  if (v.costume === 'pumpkin') {                                       // scarecrow with a jack o'lantern head
    const face = tileTex(37), side = tileTex(39), top = tileTex(36);
    const mk = t => new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t === face ? emiTexFace() : null, emissiveIntensity: t === face ? 1 : 0 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), [mk(side), mk(side), mk(top), mk(top), mk(face), mk(side)]);
    head.position.y = 1.52; g.add(head);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 12), lam(0xd9b35b)); straw.position.y = 1.86; g.add(straw);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.22, 10), lam(0xd9b35b)); crown.position.y = 1.98; g.add(crown);
    tagY = 2.4;
  } else {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), skin); head.position.y = 1.5; g.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, v.costume === 'witch' ? 0.3 : 0.22, 0.12), skin); nose.position.set(0, 1.42, v.costume === 'witch' ? 0.33 : 0.3); g.add(nose);
    const eyeM = v.costume === 'vampire' ? new THREE.MeshBasicMaterial({ color: 0xff2020 }) : lam(0x1a3d1a);
    for (const ex of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), eyeM); e.position.set(ex, 1.56, 0.26); g.add(e); }
    if (v.costume === 'witch' || v.costume === 'wizard') { witchHat(g, v.hat === 0x111111 ? 0x111111 : 0x3a1a6a); tagY = 2.75; }
    else if (v.costume === 'vampire') {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.52), lam(0x111111)); hair.position.y = 1.82; g.add(hair);
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.15, 0.06), lam(0x111111)); cape.position.set(0, 0.95, -0.24); g.add(cape);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.06), lam(0xb0102a)); collar.position.set(0, 1.32, -0.2); collar.rotation.x = 0.3; g.add(collar);
      for (const fx of [-0.06, 0.06]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.02), lam(0xffffff)); f.position.set(fx, 1.3, 0.26); g.add(f); }
    } else if (v.costume === 'cat') {
      const hat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.54), lam(0x111111)); hat.position.y = 1.82; g.add(hat);
      for (const ex of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), lam(0x111111)); e.position.set(ex, 1.98, 0); g.add(e); }
    }
  }
  const tag = nameSprite((v.costume === 'witch' ? '🧙 ' : v.costume === 'vampire' ? '🧛 ' : v.costume === 'pumpkin' ? '🎃 ' : '') + v.name); tag.position.y = tagY; g.add(tag);
  const a = (i / VILLAGERS.length) * Math.PI * 2;
  g.position.set(VX + 0.5 + Math.cos(a) * 3, G + 1, VZ + 0.5 + Math.sin(a) * 3);
  scene.add(g);
  return { ...v, g, target: null, wait: Math.random() * 3, idx: i };
});
function emiTexFace() {
  const c = document.createElement('canvas'); c.width = c.height = TS; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, TS, TS); x.fillStyle = '#ffb030';
  for (let y = 0; y < TS; y++) for (let xx = 0; xx < TS; xx++) if (JFACE[y][xx] === '#') x.fillRect(xx, y, 1, 1);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ================== SPOOKS: gravestones, ghosts, bats ==================
function graveMat() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 48; const x = c.getContext('2d');
  x.fillStyle = '#8a8a90'; x.fillRect(0, 0, 32, 48); for (let i = 0; i < 90; i++) { x.fillStyle = Math.random() < .5 ? '#7a7a80' : '#9a9aa0'; x.fillRect(Math.random() * 32 | 0, Math.random() * 48 | 0, 2, 2); }
  x.fillStyle = '#3a3a40'; x.font = 'bold 11px monospace'; x.textAlign = 'center'; x.fillText('R.I.P', 16, 20); x.fillRect(8, 26, 16, 2); x.fillRect(10, 32, 12, 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const plain = lam(0x85858b); return [plain, plain, plain, plain, new THREE.MeshLambertMaterial({ map: t }), plain];
}
const GM = graveMat(), graves = [];
for (let i = 0; i < 8; i++) {
  const gx = GX - 3 + (i % 4) * 2 + (i >= 4 ? 1 : 0), gz = GZ - 2 + (i >= 4 ? 3 : 0);
  const m = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.16), GM); slab.position.y = 0.4; m.add(slab);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 10, 1, false, 0, Math.PI), lam(0x85858b)); cap.rotation.set(Math.PI / 2, 0, Math.PI / 2); cap.position.y = 0.8; m.add(cap);
  m.position.set(gx + 0.5, heightAt(gx, gz) + 1, gz + 0.5); m.rotation.set((Math.random() - .5) * 0.25, (Math.random() - .5) * 0.4, (Math.random() - .5) * 0.25); m.userData = { gx, gz };
  scene.add(m); graves.push(m);
}

const ghostMat = new THREE.MeshLambertMaterial({ color: 0xf4f0ff, emissive: 0x9a9ac8, transparent: true, opacity: 0.7, depthWrite: false });
const blackMat = new THREE.MeshBasicMaterial({ color: 0x050008, transparent: true, opacity: 0.9 });
const ghosts = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 4, 10), ghostMat); g.add(body);
  for (let t = 0; t < 4; t++) { const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), ghostMat); const a = t / 4 * Math.PI * 2; tail.position.set(Math.cos(a) * 0.24, -0.72, Math.sin(a) * 0.24); tail.rotation.x = Math.PI; g.add(tail); }
  for (const ex of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), blackMat); e.position.set(ex, 0.25, 0.34); e.scale.z = 0.4; g.add(e); }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), blackMat); mouth.position.set(0, 0.02, 0.36); mouth.scale.set(0.8, 1.4, 0.4); g.add(mouth);
  for (const ax of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 3, 6), ghostMat); arm.position.set(ax * 0.42, 0.05, 0.15); arm.rotation.set(-1.1, 0, ax * 0.4); g.add(arm); }
  scene.add(g);
  ghosts.push({ g, target: null, phase: Math.random() * 7, cd: 0 });
}
function placeGhost(gh, far) {
  const a = Math.random() * Math.PI * 2, r = far ? 14 + Math.random() * 10 : 6 + Math.random() * 18;
  gh.g.position.set(VX + Math.cos(a) * r, G + 2, VZ + Math.sin(a) * r); gh.target = null;
}
ghosts.forEach(gh => placeGhost(gh));

const batMat = new THREE.MeshBasicMaterial({ color: 0x0a0410, side: THREE.DoubleSide });
const bats = [];
for (let i = 0; i < 9; i++) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.22), batMat));
  const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.1, 0.45, 0.05, -0.05, 0, 0, 0.12, 0.45, 0.05, -0.05, 0.3, -0.06, 0.1, 0, 0, 0.12], 3));
  const L = new THREE.Mesh(wing, batMat), R = new THREE.Mesh(wing, batMat); R.scale.x = -1; g.add(L); g.add(R);
  scene.add(g);
  const hs = [[VX - 11, VZ - 1], [VX + 11, VZ - 1], [VX - 1, VZ + 11], [VX - 1, VZ - 11], [GX, GZ]][i % 5];
  bats.push({ g, L, R, cx: hs[0], cz: hs[1], r: 2 + Math.random() * 4, sp: (0.8 + Math.random()) * (Math.random() < .5 ? -1 : 1), ph: Math.random() * 7, y: G + 6 + Math.random() * 4 });
}

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
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(g).connect(master || AC.destination); o.start(); o.stop(AC.currentTime + dur);
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
  if (id === PUMPKIN) toast('🎃 Picked a wild pumpkin!');
  if ((id === GRASS || id === DEADGRASS || id === LEAVES) && Math.random() < 0.18) { const s = ['seeds_wheat', 'seeds_wheat', 'seeds_carrot', 'seeds_potato', 'seeds_berries'][rint(0, 4)]; give(s, 1); toast(`Found ${ITEMS[s].name}!`); }
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
    if (h.n[1] !== 1 && h.id !== GRASS && h.id !== DIRT && h.id !== DEADGRASS) return;
    const r = it.tool === 3 ? 1 : 0; let n = 0;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = h.x + dx, z = h.z + dz, b = get(x, h.y, z);
      if ((b === GRASS || b === DIRT || b === DEADGRASS) && get(x, h.y + 1, z) === AIR) { setBlock(x, h.y, z, FARM); n++; }
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
document.getElementById('helpText').innerHTML = (isTouch ? helpTouch : helpPC) + '<br><br>🎃 It\'s spooky season! Grow pumpkins, carve Jack o\'Lanterns, catch 👻 ghosts for candy and brew potions for Witch Wanda. The world never ends: explore the hills, lakes and dead woods for wild pumpkins.';
function showStart() { playing = false; closePanels(); if (document.pointerLockElement) document.exitPointerLock(); document.getElementById('start').style.display = 'flex'; }
document.getElementById('start').addEventListener('click', () => {
  document.getElementById('start').style.display = 'none'; playing = true;
  if (AC && AC.state === 'suspended') AC.resume();
  startAmbience();
  if (!isTouch) canvas.requestPointerLock();
  if (freshGame && !state._welcomed) { state._welcomed = true; setTimeout(() => toast('🎃 Happy Halloween! Your farm is by the plaza. Bump into ghosts for candy!'), 400); }
});
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && playing && !uiOpen && !isTouch) showStart(); });

// ================== SPOOKY AUDIO ==================
let muted = localStorage.getItem('dealercraft_mute') === '1', master = null, ambStarted = false;
if (AC) { master = AC.createGain(); master.gain.value = muted ? 0 : 1; master.connect(AC.destination); }
function startAmbience() {
  if (!AC || ambStarted) return; ambStarted = true;
  try {
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const dg = AC.createGain(); dg.gain.value = 0.022; lp.connect(dg).connect(master);
    for (const f of [55, 82.4, 110.6]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 12; o.connect(lp); o.start(); }
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency); lfo.start();
    // wind: filtered noise that swells and fades
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const n = AC.createBufferSource(); n.buffer = buf; n.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
    const wg = AC.createGain(); wg.gain.value = 0.012; n.connect(bp).connect(wg).connect(master); n.start();
    const wl = AC.createOscillator(), wlg = AC.createGain(); wl.frequency.value = 0.11; wlg.gain.value = 0.01; wl.connect(wlg).connect(wg.gain); wl.start();
    const wl2 = AC.createOscillator(), wlg2 = AC.createGain(); wl2.frequency.value = 0.05; wlg2.gain.value = 300; wl2.connect(wlg2).connect(bp.frequency); wl2.start();
  } catch (e) {}
}
function owl() { beep(420, 0.25, 'sine', 0.05); setTimeout(() => beep(370, 0.45, 'sine', 0.05), 380); }
function booSnd() { if (!AC) return; try { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(600, AC.currentTime); o.frequency.exponentialRampToValueAtTime(180, AC.currentTime + 0.7); g.gain.setValueAtTime(0.08, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.8); o.connect(g).connect(master); o.start(); o.stop(AC.currentTime + 0.8); } catch (e) {} }
const muteBtn = document.getElementById('bMute');
function renderMute() { muteBtn.textContent = muted ? '🔇' : '🔊'; }
renderMute();
muteBtn.addEventListener('click', () => { muted = !muted; localStorage.setItem('dealercraft_mute', muted ? '1' : '0'); if (master) master.gain.value = muted ? 0 : 1; renderMute(); });

// ================== DAY / NIGHT ==================
const skyDay = new THREE.Color(0x8a6a9c), skyNight = new THREE.Color(0x090512), skyDusk = new THREE.Color(0xff6a1a), sky = new THREE.Color();
const ambDay = new THREE.Color(0xffe0c8), ambNight = new THREE.Color(0x8a78ff);
let nightAmt = 0;
function isNight() { const f = (state.time % DAY) / DAY; return f > 0.75 || f < 0.02; }
function updateSky() {
  const f = (state.time % DAY) / DAY, a = f * Math.PI * 2;
  const light = Math.max(0, Math.min(1, Math.sin(a) * 2 + 0.3));
  nightAmt = 1 - light;
  sky.copy(skyNight).lerp(skyDay, light * 0.85);
  const dusk = Math.max(0, 1 - Math.abs(Math.sin(a)) * 4) * (light > 0.05 ? 1 : 0.4);
  sky.lerp(skyDusk, dusk * 0.6);
  scene.background = sky; scene.fog.color.copy(sky).multiplyScalar(0.85);
  scene.fog.near = 12 + light * 16; scene.fog.far = 46 + light * 20;
  ambient.color.copy(ambNight).lerp(ambDay, light); ambient.intensity = 0.38 + light * 0.32;
  sun.intensity = 0.05 + light * 0.6; sun.position.set(Math.cos(a) * 50, Math.sin(a) * 50 + 10, 20);
  moonLight.intensity = nightAmt * 0.35; moonLight.position.set(-Math.cos(a) * 50, -Math.sin(a) * 50 + 10, -20);
  const md = new THREE.Vector3(-Math.cos(a), Math.max(0.25, -Math.sin(a)), -0.4).normalize();
  moon.position.copy(camera.position).addScaledVector(md, 160); moon.material.opacity = Math.min(1, nightAmt * 1.3 + 0.15);
  stars.position.copy(camera.position); starMat.opacity = Math.max(0, nightAmt - 0.3);
  const flick = 0.85 + Math.sin(performance.now() / 90) * 0.08 + Math.random() * 0.07;
  wellGlow.intensity = (0.8 + nightAmt * 2.2) * flick; graveGlow.intensity = 0.5 + nightAmt * 2;
  matOpaque.emissiveIntensity = (0.5 + nightAmt * 0.7) * flick;
}

// ================== LOOP ==================
let last = performance.now(), cropTick = 0, saveTick = 0, statTick = 0, owlT = 25, booT = 0;
function updatePlayer(dt) {
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
  const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  const sp = (keys.ShiftLeft ? 6.5 : 4.5) * (inWater() ? 0.55 : 1);
  const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw);
  let mx = -sn * fwd + cs * str, mz = -cs * fwd - sn * str; const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  player.vel.x = mx * sp; player.vel.z = mz * sp;
  const p = player.pos;
  // don't walk into land that hasn't generated yet
  if (!data.has(ckey(fdiv(Math.floor(p.x + mx), CH), fdiv(Math.floor(p.z + mz), CH)))) { player.vel.x = 0; player.vel.z = 0; }
  const water = inWater();
  if (water) { player.vel.y -= 9 * dt; player.vel.y = Math.max(player.vel.y, -2.5); if (keys.Space || wantJump) player.vel.y = 3.2; }
  else { player.vel.y -= 26 * dt; if ((keys.Space || wantJump) && player.onGround) player.vel.y = 8.4; }
  player.vel.y = Math.max(player.vel.y, -40);
  for (const ax of ['x', 'z']) {
    const old = p[ax]; p[ax] += player.vel[ax] * dt;
    if (collides(p)) {
      p[ax] = old;
      if (isTouch && player.onGround && m > 0.3) { p.y += 1.05; if (!collides(p)) player.vel.y = 8.4; p.y -= 1.05; }
    }
  }
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
function updateSpooks(dt, t) {
  ghostMat.opacity = 0.18 + nightAmt * 0.6; blackMat.opacity = 0.3 + nightAmt * 0.6;
  for (const gh of ghosts) {
    const g = gh.g; gh.cd -= dt;
    if (!gh.target) { const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 22; gh.target = new THREE.Vector2(VX + Math.cos(a) * r, VZ + Math.sin(a) * r); }
    const dx = gh.target.x - g.position.x, dz = gh.target.y - g.position.z, dd = Math.hypot(dx, dz);
    if (dd < 0.5) gh.target = null;
    else { const s = Math.min(dd, (0.9 + nightAmt * 0.8) * dt); g.position.x += dx / dd * s; g.position.z += dz / dd * s; }
    const gy = groundAt(g.position.x, g.position.z) + 1.3 + Math.sin(t * 1.6 + gh.phase) * 0.35;
    g.position.y += (gy - g.position.y) * Math.min(1, dt * 2);
    const px = player.pos.x - g.position.x, pz = player.pos.z - g.position.z, pd = Math.hypot(px, pz);
    g.rotation.y = pd < 8 ? Math.atan2(px, pz) : Math.atan2(dx, dz);
    g.rotation.z = Math.sin(t * 2 + gh.phase) * 0.1;
    if (playing && !uiOpen && pd < 1.4 && Math.abs(player.pos.y + 1 - g.position.y) < 2 && gh.cd <= 0) {
      const n = rint(1, 3); give('candy', n); booSnd(); toast(`👻 BOO! The ghost fled and dropped ${n} 🍬 Ghost Candy`);
      gh.cd = 3; placeGhost(gh, true);
    }
  }
  const showBats = nightAmt > 0.25;
  for (const b of bats) {
    b.g.visible = showBats; if (!showBats) continue;
    b.ph += dt * b.sp * 0.9;
    const x = b.cx + Math.cos(b.ph) * b.r, z = b.cz + Math.sin(b.ph * 1.3) * b.r;
    b.g.position.set(x, b.y + Math.sin(b.ph * 3) * 0.6, z); b.g.rotation.y = Math.atan2(-Math.sin(b.ph) * b.sp, Math.cos(b.ph * 1.3) * b.sp);
    const f = Math.sin(t * 22 + b.ph * 5) * 0.9; b.L.rotation.z = f; b.R.rotation.z = -f;
  }
  if (playing && nightAmt > 0.5) { owlT -= dt; if (owlT <= 0) { owl(); owlT = 25 + Math.random() * 30; } }
}
function updateTarget() {
  const h = raycast(), el = document.getElementById('target');
  if (h && (h.kind === 'block' || h.kind === 'crop')) { highlight.visible = true; highlight.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); }
  else highlight.visible = false;
  let txt = '';
  if (h && h.kind === 'villager') txt = `✋ Trade with ${h.v.name}`;
  else if (h && h.kind === 'crop') { const c = state.crops[h.key]; const pct = Math.min(100, Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100)); txt = `${CROPS[c.type].name}: ${pct >= 100 ? 'RIPE! ⛏️ harvest' : pct + '%'}`; }
  else if (h && h.kind === 'block' && h.id === PUMPKIN) txt = '🎃 Wild Pumpkin: ⛏️ break to pick';
  el.style.display = txt ? 'block' : 'none'; el.textContent = txt;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  streamChunks(2, 2);
  if (playing && !uiOpen) {
    updatePlayer(dt);
    if (holdBreak) { breakCd -= dt; if (breakCd <= 0) { breakAction(); breakCd = 0.28; } }
  } else { camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); }
  if (playing) { state.time += dt; state.gameTime += dt; }
  if (!playing) player.yaw += dt * 0.05; // slow pan on title
  updateVillagers(dt); updateSpooks(dt, now / 1000); updateSky(); updateTarget();
  cropTick += dt; if (cropTick > 1) { cropTick = 0; let ch = false; for (const k in state.crops) if (cropStage(state.crops[k]) !== state.crops[k]._st) ch = true; if (ch) buildCrops(); }
  statTick += dt; if (statTick > 0.5) { statTick = 0; renderStats(); }
  saveTick += dt; if (saveTick > 10 && playing) { saveTick = 0; save(); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  renderer.render(scene, camera);
}
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ================== BOOT ==================
for (const k in state.edits) indexEdit(k);
if (freshGame) {
  // a few starter crops already growing (two of them pumpkins, it's spooky season)
  const st = [[6, 6, 'wheat'], [7, 6, 'wheat'], [6, 7, 'pumpkin'], [7, 7, 'pumpkin']];
  for (const [dx, dz, ty] of st) state.crops[(VX + dx) + ',' + (G + 1) + ',' + (VZ + dz)] = { type: ty, t: -30 };
}
while (streamChunks(400, 400) > 0) {}             // build everything around the player before the first frame
if (collides(player.pos)) { player.pos.y = groundAt(player.pos.x, player.pos.z); }
buildCrops(); renderHotbar(); renderStats(); updateSky();
requestAnimationFrame(frame);
window.__dc = { state, player, villagers, raycast, data, chunks, ghosts };
