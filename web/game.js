// DealerCraft by Buggy Games YT  ·  Spooky Season · Survival Update
import * as THREE from './three.module.min.js';

// ================== CONSTANTS ==================
const H = 40, CH = 16;                          // world height, chunk size (world is endless in x/z)
const SEA = 9, G = 13;                          // water level, village ground
const VX = 32, VZ = 32;                         // village centre
const GX = VX - 13, GZ = VZ + 13;               // graveyard centre
const DAY = 1200;                               // seconds per day (20 min, like Minecraft)
const VIEW = 4;                                 // chunks drawn around the player
const SLOTS = 3, SLOT = Math.min(SLOTS, Math.max(1, +(localStorage.getItem('dealercraft_slot') || 1)));   // multiple worlds
const slotKey = n => n === 1 ? 'dealercraft_save_v1' : 'dealercraft_save_v1_s' + n;
const SAVE_KEY = slotKey(SLOT);
const SAFE_R = 24;                              // no monster spawns / explosion damage this close to the plaza

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7,
      PLANKS = 8, FARM = 9, COBBLE = 10, GLASS = 11, BRICK = 12, JACK = 13, DEADGRASS = 14, PUMPKIN = 15,
      BEDROCK = 16, COAL_ORE = 17, IRON_ORE = 18, CTABLE = 19, FURNACE = 20, GRAVE = 21,
      FLOW1 = 22, FALL = 29, DOOR0 = 30, CHEST = 46;          // FLOW1..FLOW7 = 22..28 (flowing water levels), doors = 30..45
const isWater = id => id === WATER || (id >= FLOW1 && id <= FALL);
const isDoor = id => id >= DOOR0 && id < DOOR0 + 16;
const doorId = (f, open, top) => DOOR0 + f * 4 + (open ? 2 : 0) + (top ? 1 : 0);
const doorF = id => (id - DOOR0) >> 2, doorOpen = id => !!((id - DOOR0) & 2), doorTop = id => !!((id - DOOR0) & 1);
const TRANSPARENT = new Set([LEAVES, GLASS]);
const seeThrough = id => TRANSPARENT.has(id) || isDoor(id) || isWater(id);
// tile per block: [top, bottom, side]
const BT = {
  [GRASS]: [0, 2, 1], [DIRT]: [2, 2, 2], [STONE]: [3, 3, 3], [SAND]: [4, 4, 4], [WATER]: [5, 5, 5],
  [LOG]: [7, 7, 6], [LEAVES]: [8, 8, 8], [PLANKS]: [9, 9, 9], [FARM]: [10, 2, 2], [COBBLE]: [11, 11, 11],
  [GLASS]: [12, 12, 12], [BRICK]: [13, 13, 13], [JACK]: [36, 36, 37], [DEADGRASS]: [38, 2, 40], [PUMPKIN]: [36, 36, 39],
  [BEDROCK]: [14, 14, 14], [COAL_ORE]: [15, 15, 15], [IRON_ORE]: [41, 41, 41], [CTABLE]: [42, 9, 43], [FURNACE]: [45, 45, 44], [CHEST]: [49, 49, 50],
  [GRAVE]: [3, 3, 46],
};
for (let i = FLOW1; i <= FALL; i++) BT[i] = [5, 5, 5];
// hardness (seconds-ish), the tool that speeds it up, and whether that tool is REQUIRED for a drop (with min tier)
const HARD = {
  [GRASS]: [0.6, 'hoe'], [DIRT]: [0.5, 'hoe'], [DEADGRASS]: [0.6, 'hoe'], [FARM]: [0.6, 'hoe'], [SAND]: [0.5, null],
  [STONE]: [1.5, 'pick', 1], [COBBLE]: [2, 'pick', 1], [BRICK]: [2, 'pick', 1], [COAL_ORE]: [3, 'pick', 1], [IRON_ORE]: [3, 'pick', 2],
  [FURNACE]: [3.5, 'pick', 1], [GRAVE]: [1.5, 'pick'],
  [LOG]: [2, 'axe'], [PLANKS]: [2, 'axe'], [CTABLE]: [2.5, 'axe'], [CHEST]: [2.5, 'axe'], [JACK]: [1, 'axe'], [PUMPKIN]: [1, 'axe'],
  [LEAVES]: [0.2, null], [GLASS]: [0.3, null, 99],
};
const TIERS = { wood: { lvl: 1, speed: 2, dur: 60, dmg: 0 }, stone: { lvl: 2, speed: 4, dur: 132, dmg: 1 }, iron: { lvl: 3, speed: 6, dur: 251, dmg: 2 } };

// crops: tile base (4 stages), grow seconds, harvest yield
const CROPS = {
  wheat:   { name: 'Wheat',   tile: 16, grow: 45,  yield: [1, 2], seeds: [1, 2] },
  carrot:  { name: 'Carrots', tile: 20, grow: 60,  yield: [2, 3], seeds: [0, 1] },
  potato:  { name: 'Potatoes',tile: 24, grow: 60,  yield: [2, 3], seeds: [0, 1] },
  berries: { name: 'Berries', tile: 28, grow: 75,  yield: [2, 4], seeds: [0, 1] },
  pumpkin: { name: 'Pumpkin', tile: 32, grow: 100, yield: [1, 1], seeds: [1, 1] },
};

// ================== ITEMS ==================
// icon: pixel-art template name (drawn later) or emoji; block: places this block; tool: {kind, tier}; food: hunger points
const ITEMS = {
  dirt: { name: 'Dirt', block: DIRT }, cobble: { name: 'Cobblestone', block: COBBLE }, sand: { name: 'Sand', block: SAND },
  stone: { name: 'Stone', block: STONE }, log: { name: 'Log', block: LOG }, leaves: { name: 'Leaves', block: LEAVES },
  planks: { name: 'Planks', block: PLANKS }, glass: { name: 'Glass', block: GLASS }, brick: { name: 'Bricks', block: BRICK },
  jack_o_lantern: { name: "Jack o'Lantern", block: JACK }, pumpkin_block: { name: 'Pumpkin Block', block: PUMPKIN },
  coal_ore: { name: 'Coal Ore', block: COAL_ORE }, iron_ore: { name: 'Iron Ore', block: IRON_ORE },
  crafting_table: { name: 'Crafting Table', block: CTABLE }, furnace: { name: 'Furnace', block: FURNACE }, chest: { name: 'Chest', block: CHEST },
  door: { name: 'Wooden Door', px: 'door', door: true },
  stick: { name: 'Stick', px: 'stick' }, coal: { name: 'Coal', px: 'coal', fuel: 8 }, iron_ingot: { name: 'Iron Ingot', px: 'ingot' },
  leather: { name: 'Leather', px: 'leather' }, bone: { name: 'Bone', px: 'bone' }, gunpowder: { name: 'Gunpowder', px: 'powder' },
  arrow: { name: 'Arrow', px: 'arrow' }, rotten_flesh: { name: 'Rotten Flesh', px: 'flesh', food: 4 },
  bucket: { name: 'Bucket', px: 'bucket', stack: 16 }, water_bucket: { name: 'Water Bucket', px: 'wbucket', stack: 1 },
  seeds_wheat:   { name: 'Wheat Seeds',   emoji: '🌱', tag: 'WHT', crop: 'wheat' },
  seeds_carrot:  { name: 'Carrot Seeds',  emoji: '🌱', tag: 'CAR', crop: 'carrot' },
  seeds_potato:  { name: 'Potato Seeds',  emoji: '🌱', tag: 'POT', crop: 'potato' },
  seeds_berries: { name: 'Berry Seeds',   emoji: '🌱', tag: 'BER', crop: 'berries' },
  seeds_pumpkin: { name: 'Pumpkin Seeds', emoji: '🌱', tag: 'PMP', crop: 'pumpkin' },
  wheat: { name: 'Wheat', emoji: '🌾' }, carrot: { name: 'Carrot', emoji: '🥕', food: 3 }, potato: { name: 'Potato', emoji: '🥔', food: 1 },
  berries: { name: 'Berries', emoji: '🫐', food: 2 }, pumpkin: { name: 'Pumpkin', emoji: '🎃' },
  bread: { name: 'Bread', emoji: '🍞', food: 5 }, carrot_cake: { name: 'Carrot Cake', emoji: '🍰', food: 6 },
  baked_potato: { name: 'Baked Potato', emoji: '🍠', food: 5 }, pumpkin_pie: { name: 'Pumpkin Pie', emoji: '🥧', food: 8 },
  berry_juice: { name: 'Berry Juice', emoji: '🧃', food: 4 }, veggie_stew: { name: 'Veggie Stew', emoji: '🍲', food: 10, stack: 1 },
  raw_beef: { name: 'Raw Beef', emoji: '🥩', food: 3 }, steak: { name: 'Steak', emoji: '🍖', food: 8 },
  candy: { name: 'Ghost Candy', emoji: '🍬', food: 2 }, witch_brew: { name: "Witch's Brew", emoji: '⚗️' },
  fertilizer: { name: 'Fertilizer (instant grow)', emoji: '🧪' },
};
const MATS = { wood: ['Wooden', 'planks'], stone: ['Stone', 'cobble'], iron: ['Iron', 'iron_ingot'] };
for (const [t, [label]] of Object.entries(MATS)) {
  ITEMS[t + '_pickaxe'] = { name: label + ' Pickaxe', px: 'pick', mat: t, tool: { kind: 'pick', tier: t }, stack: 1 };
  ITEMS[t + '_axe'] = { name: label + ' Hatchet', px: 'axe', mat: t, tool: { kind: 'axe', tier: t }, stack: 1 };
  ITEMS[t + '_hoe'] = { name: label + ' Hoe' + (t === 'iron' ? ' (3x3)' : ''), px: 'hoe', mat: t, tool: { kind: 'hoe', tier: t }, stack: 1 };
  ITEMS[t + '_sword'] = { name: label + ' Sword', px: 'sword', mat: t, tool: { kind: 'sword', tier: t }, stack: 1 };
}
const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots'];
const ARMOR_PTS = { leather: [1, 3, 2, 1], iron: [2, 6, 5, 2] };
for (const m of ['leather', 'iron']) ARMOR_SLOTS.forEach((s, i) => {
  ITEMS[m + '_' + s] = { name: (m === 'leather' ? 'Leather ' : 'Iron ') + ['Cap', 'Tunic', 'Pants', 'Boots'][i], px: s, mat: m, armor: { slot: i, pts: ARMOR_PTS[m][i] }, stack: 1 };
});
const stackOf = id => (ITEMS[id] && ITEMS[id].stack) || 64;
const CROP_ITEM = { wheat: 'wheat', carrot: 'carrot', potato: 'potato', berries: 'berries', pumpkin: 'pumpkin' };
const BLOCK_DROP = { [GRASS]: 'dirt', [DIRT]: 'dirt', [FARM]: 'dirt', [STONE]: 'cobble', [COBBLE]: 'cobble', [SAND]: 'sand',
  [LOG]: 'log', [LEAVES]: 'leaves', [PLANKS]: 'planks', [GLASS]: 'glass', [BRICK]: 'brick', [JACK]: 'jack_o_lantern',
  [DEADGRASS]: 'dirt', [PUMPKIN]: 'pumpkin', [COAL_ORE]: 'coal', [IRON_ORE]: 'iron_ore', [CTABLE]: 'crafting_table', [FURNACE]: 'furnace', [CHEST]: 'chest' };
const FUEL = { log: 1.5, planks: 1.5, stick: 0.5, coal: 8, crafting_table: 1.5, door: 1, chest: 1.5 };   // items smelted per fuel item
const SMELT = { iron_ore: 'iron_ingot', sand: 'glass', cobble: 'stone', raw_beef: 'steak', potato: 'baked_potato', log: 'coal' };

// ================== CRAFTING (shaped like Minecraft) ==================
// pattern rows use letters mapped in key; '.' is empty. Shapeless recipes list ingredients.
const RECIPES = [];
const shaped = (out, n, rows, key) => RECIPES.push({ out, n, rows, key });
const shapeless = (out, n, items) => RECIPES.push({ out, n, items });
shapeless('planks', 4, ['log']);
shaped('stick', 4, ['P', 'P'], { P: 'planks' });
shaped('crafting_table', 1, ['PP', 'PP'], { P: 'planks' });
shaped('furnace', 1, ['CCC', 'C.C', 'CCC'], { C: 'cobble' });
for (const [t, [, m]] of Object.entries(MATS)) {
  shaped(t + '_pickaxe', 1, ['MMM', '.S.', '.S.'], { M: m, S: 'stick' });
  shaped(t + '_axe', 1, ['MM', 'MS', '.S'], { M: m, S: 'stick' });
  shaped(t + '_hoe', 1, ['MM', '.S', '.S'], { M: m, S: 'stick' });
  shaped(t + '_sword', 1, ['M', 'M', 'S'], { M: m, S: 'stick' });
}
shaped('bucket', 1, ['I.I', '.I.'], { I: 'iron_ingot' });
shaped('door', 3, ['PP', 'PP', 'PP'], { P: 'planks' });
shaped('chest', 1, ['PPP', 'P.P', 'PPP'], { P: 'planks' });
for (const [m, mat] of [['leather', 'leather'], ['iron', 'iron_ingot']]) {
  shaped(m + '_helmet', 1, ['LLL', 'L.L'], { L: mat });
  shaped(m + '_chest', 1, ['L.L', 'LLL', 'LLL'], { L: mat });
  shaped(m + '_legs', 1, ['LLL', 'L.L', 'L.L'], { L: mat });
  shaped(m + '_boots', 1, ['L.L', 'L.L'], { L: mat });
}
shaped('brick', 4, ['CC', 'CC'], { C: 'stone' });
shaped('bread', 1, ['WWW'], { W: 'wheat' });
shaped('jack_o_lantern', 1, ['P', 'C'], { P: 'pumpkin', C: 'coal' });
shapeless('pumpkin_block', 1, ['pumpkin']);
shapeless('carrot_cake', 1, ['wheat', 'wheat', 'carrot', 'carrot']);
shapeless('pumpkin_pie', 1, ['pumpkin', 'wheat']);
shapeless('berry_juice', 1, ['berries', 'berries', 'berries', 'glass']);
shapeless('veggie_stew', 1, ['carrot', 'potato', 'pumpkin']);
shapeless('witch_brew', 1, ['berries', 'berries', 'pumpkin', 'candy', 'candy', 'glass']);
shapeless('fertilizer', 2, ['bone', 'rotten_flesh']);

const VILLAGERS = [
  { name: 'Farmer Fred', job: 'Scarecrow Farmer', robe: 0x3f8f3a, hat: 0xd9b35b, costume: 'pumpkin',
    sells: { seeds_wheat: 2, seeds_carrot: 4, seeds_potato: 4, seeds_berries: 6, seeds_pumpkin: 8, wood_hoe: 10 },
    buys: { wheat: 3, carrot: 5, potato: 5, berries: 4, pumpkin: 18 } },
  { name: 'Baker Betty', job: 'Baker', robe: 0xf2f2f2, hat: 0xff8fb1, costume: 'cat',
    sells: { bread: 9 }, buys: { bread: 14, carrot_cake: 30, pumpkin_pie: 32 } },
  { name: 'Count Carl', job: 'Vampire Chef', robe: 0x1a1a1a, hat: 0x1a1a1a, costume: 'vampire',
    sells: { steak: 12 }, buys: { baked_potato: 12, berry_juice: 22, veggie_stew: 45, steak: 10, raw_beef: 5 } },
  { name: 'Merchant Mo', job: 'Merchant', robe: 0x7b3fb5, hat: 0x2a1a40, costume: 'wizard',
    sells: { fertilizer: 8, log: 2, coal: 4, iron_ingot: 15, bucket: 40, iron_hoe: 150 }, buys: { planks: 1, cobble: 1, brick: 2, leaves: 1, leather: 6, iron_ingot: 8 } },
  { name: 'Witch Wanda', job: 'Witch', robe: 0x24132e, hat: 0x111111, costume: 'witch', skin: 0x7fbf5a,
    sells: { seeds_pumpkin: 7, fertilizer: 7 }, buys: { pumpkin: 20, jack_o_lantern: 26, candy: 6, witch_brew: 60, bone: 4, gunpowder: 8, rotten_flesh: 2 } },
];
const RANKS = [[0, 'Rookie Grower'], [100, 'Street Farmer'], [400, 'Market Dealer'], [1200, 'Crop Boss'], [3000, 'DealerCraft Tycoon']];

// ================== RANDOM / NOISE ==================
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, z, s) { let h = x * 374761393 + z * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function hash3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 1103515245) ^ Math.imul(z, 668265263) ^ Math.imul(s, 982451653); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
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
const emptySlots = n => Array.from({ length: n }, () => null);
function newState() {
  const slots = emptySlots(36);
  slots[0] = { id: 'wood_hoe', n: 1, d: TIERS.wood.dur }; slots[1] = { id: 'seeds_wheat', n: 8 }; slots[2] = { id: 'seeds_carrot', n: 4 };
  slots[3] = { id: 'seeds_pumpkin', n: 3 }; slots[4] = { id: 'bread', n: 3 };
  return { seed: (Math.random() * 1e9) | 0, edits: {}, crops: {}, slots, armor: emptySlots(4), sel: 0,
    coins: 20, earned: 0, time: DAY * 0.3, gameTime: 0, pos: [VX + 0.5, G + 1, VZ - 4.5], yaw: Math.PI, pitch: -0.2,
    hp: 20, food: 20, sat: 5, furnaces: {}, graves: {}, chests: {}, v: 2 };
}
function migrate(s) {
  // older saves kept an item->count map plus a hotbar list; turn that into Minecraft-style slots
  if (s.inv) {
    const slots = emptySlots(36), rename = { hoe: 'wood_hoe', golden_hoe: 'iron_hoe' };
    const order = [...(s.hotbar || []).filter(Boolean), ...Object.keys(s.inv)];
    const seen = new Set(); let i = 0;
    for (let id of order) {
      if (seen.has(id) || !s.inv[id]) continue; seen.add(id);
      let n = s.inv[id]; id = rename[id] || id; if (!ITEMS[id]) continue;
      while (n > 0 && i < 36) { const k = Math.min(n, stackOf(id)); slots[i++] = { id, n: k, d: ITEMS[id].tool ? TIERS[ITEMS[id].tool.tier].dur : undefined }; n -= k; }
    }
    s.slots = slots; delete s.inv; delete s.hotbar;
  }
  if (!s.armor) s.armor = emptySlots(4);
  for (const k of ['hp', 'food']) if (s[k] == null) s[k] = 20;
  if (s.sat == null) s.sat = 5; if (!s.furnaces) s.furnaces = {}; if (!s.graves) s.graves = {}; if (!s.chests) s.chests = {};
  s.v = 2; return s;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.seed != null) return migrate(Object.assign(newState(), s)); } catch (e) {}
  return null;
}
let saveBlocked = false;
function save() {
  if (saveBlocked) return;
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
const solid = id => id !== AIR && !isWater(id) && !(isDoor(id) && doorOpen(id));

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
      if (b === STONE) { const r = hash3(x, y, z, state.seed); if (y <= 20 && r < 0.012) b = IRON_ORE; else if (r > 0.982) b = COAL_ORE; }
      if (y === 0) b = BEDROCK;
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
  // cows graze in grassy chunks
  if (rnd() < 0.28) spawnCowsIn(x0, z0, hm, rnd);
  // village & graveyard (fixed structures; each chunk stamps only its own part)
  if (x0 < VX + 24 && x0 + CH > VX - 24 && z0 < VZ + 24 && z0 + CH > VZ - 24) stampVillage((x, y, z, v) => L(x - x0, y, z - z0, v));
  // re-apply the player's edits
  const ed = editIdx.get(ckey(cx, cz));
  if (ed) for (const k of ed) { const [x, y, z] = k.split(',').map(Number); let v = state.edits[k];
    const lx = x - x0, lz = z - z0, g = (lx >= 0 && lz >= 0 && lx < CH && lz < CH && y >= 0 && y < H) ? c[lidx(lx, y, lz)] : AIR;
    if (isDoor(v) && isDoor(g) && doorF(v) !== doorF(g)) { v = doorId(doorF(g), doorOpen(v), doorTop(v)); state.edits[k] = v; }   // village doors keep their new outside-facing side in old saves
    L(lx, y, lz, v); }
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
    const f = Math.abs(VX - cx) > Math.abs(VZ - cz) ? (ddx > 0 ? 1 : 3) : (ddz > 0 ? 2 : 0);   // door sits flush with the outside wall
    S(doorX, G + 1, doorZ, doorId(f, false, false)); S(doorX, G + 2, doorZ, doorId(f, false, true));
  }
  S(VX + 5, G + 1, VZ - 1, CTABLE); S(VX + 5, G + 1, VZ + 1, FURNACE);   // a public crafting table and furnace
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
// survival tiles: bedrock, ores, crafting table, furnace, grave, door
paintTile(14, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const v = r(); px(x, y, v < .3 ? '#1c1c1c' : v < .7 ? '#3b3b3b' : '#5a5a5a'); } });
const ore = (dot) => (px, r) => { noiseFill(px, r, [125, 125, 125], 30); for (let i = 0; i < 5; i++) { const x = 1 + (r() * 12 | 0), y = 1 + (r() * 12 | 0); px(x, y, dot); px(x + 1, y, dot); px(x, y + 1, dot); px(x + 1, y + 1, '#222'); } };
paintTile(15, ore('#1a1a1a'));
paintTile(41, ore('#d8a47f'));
paintTile(42, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const e = x % 5 === 0 || y % 5 === 0; const k = (r() - .5) * 14; px(x, y, e ? rgb(90, 60, 30) : rgb(184 + k, 140 + k, 85 + k)); } });
paintTile(43, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (y % 4 === 3 ? -40 : 0) + (r() - .5) * 14; px(x, y, rgb(184 + k, 148 + k, 95 + k)); }
  for (let x = 3; x < 13; x++) { px(x, 3, '#555'); px(x, 4, '#777'); } for (let y = 5; y < 12; y++) { px(4, y, '#6b4a2a'); px(11, y, '#9a9a9a'); } px(10, 5, '#ccc'); px(12, 5, '#ccc'); });
const furnaceBase = (px, r) => noiseFill(px, r, [118, 118, 118], 34);
paintTile(45, furnaceBase);
paintTile(44, (px, r) => { furnaceBase(px, r); for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, y > 11 ? '#ff8a1a' : '#1a1a1a'); for (let x = 3; x < 13; x++) { px(x, 7, '#555'); px(x, 3, '#555'); } });
paintTile(46, (px, r) => { noiseFill(px, r, [125, 125, 130], 26); const R = ['.###..###..###..', '.#.#...#...#.#..', '.##....#...###..', '.#.#...#...#....', '.#.#..###..#....']; R.forEach((row, y) => [...row].forEach((c, x) => c === '#' && px(x, 5 + y, '#3a3a40'))); });
const doorTile = (win) => (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (win && y >= 3 && y < 9 && x >= 3 && x < 13 && x !== 8 && y !== 6) continue; const fr = x < 2 || x > 13 || y < 2 || y > 13; const k = (r() - .5) * 14; px(x, y, fr ? rgb(110 + k, 74 + k, 40 + k) : rgb(160 + k, 116 + k, 66 + k)); }
  if (!win) { px(12, 4, '#333'); px(12, 5, '#333'); } };
paintTile(47, doorTile(false));
paintTile(48, doorTile(true));

// chest: wooden planks with a dark band and an iron latch on the front
const chestBase = (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 16, edge = x === 0 || x === 15 || y === 0 || y === 15; px(x, y, edge ? rgb(80, 50, 22) : rgb(160 + k, 108 + k, 50 + k)); } };
paintTile(49, chestBase);
paintTile(50, (px, r) => { chestBase(px, r); for (let x = 0; x < TS; x++) px(x, 6, rgb(70, 44, 20)); for (let y = 5; y < 10; y++) for (let x = 7; x < 9; x++) px(x, y, y === 5 || y === 9 ? '#555' : '#c8c8c8'); });
const tex = new THREE.CanvasTexture(atlas);
tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
function tileURL(t) { const c = document.createElement('canvas'); c.width = c.height = TS; c.getContext('2d').drawImage(atlas, (t % AT) * TS, Math.floor(t / AT) * TS, TS, TS, 0, 0, TS, TS); return c.toDataURL(); }

// ================== ITEM ICONS (pixel art drawn in code) ==================
const MATCOL = { wood: ['#c49a5c', '#7a5a30'], stone: ['#a5a5a5', '#5f5f5f'], iron: ['#eeeeee', '#9c9c9c'], leather: ['#a8622c', '#6a3a18'] };
function drawIcon(kind, mat) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  const P = (px, py, col) => { if (px < 0 || py < 0 || px > 15 || py > 15) return; x.fillStyle = col; x.fillRect(px | 0, py | 0, 1, 1); };
  const [ml, md] = MATCOL[mat] || MATCOL.iron;
  const handle = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n; P(px, py, '#8a5a2c'); P(px + 1, py, '#5a3818'); } };
  // shape raster in (u = along handle toward top-right, v = across it) around centre (cx, cy)
  const shape = (cx, cy, test) => { for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) { const dx = px + .5 - cx, dy = py + .5 - cy; const u = (dx - dy) * 0.7071, v = (dx + dy) * 0.7071; const t = test(u, v); if (t) P(px, py, t === 2 ? md : ml); } };
  switch (kind) {
    case 'pick': handle(2, 13, 9, 6); shape(10.5, 5.5, (u, v) => { const a = Math.abs(v); return a < 6.2 && u > 1.2 - a * a * 0.1 - 0.9 && u < 3 - a * a * 0.1 ? (u > 2.2 - a * a * 0.1 ? 2 : 1) : 0; }); break;
    case 'axe': handle(2, 13, 10, 5); shape(10.5, 5.5, (u, v) => v > -0.5 && v < 4.5 && Math.abs(u) < 1.2 + v * 0.45 ? (v > 3.4 ? 1 : 2) : 0); break;
    case 'hoe': handle(2, 13, 10, 5); shape(10.5, 5.5, (u, v) => v > -4.5 && v < 0.8 && u > -0.2 && u < 1.6 ? (v < -3.4 ? 1 : 2) : 0); break;
    case 'sword': handle(2, 13, 4, 11); shape(5.5, 10.5, (u, v) => (Math.abs(v) < 2.6 && Math.abs(u) < 0.8) ? 3 : 0); shape(9.5, 6.5, (u, v) => (u > -4.5 && u < 6 && Math.abs(v) < 1.1 - Math.max(0, u - 4.5) * 0.7) ? (v > 0.2 ? 2 : 1) : 0);
      for (let i = -2; i <= 2; i++) { P(5 + i, 10 + i, '#4a3018'); P(6 + i, 10 + i, '#4a3018'); } break;
    case 'stick': handle(4, 12, 11, 5); break;
    case 'coal': for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) { const d = Math.hypot(px - 7.5, (py - 8) * 1.2); if (d < 5.5) P(px, py, d < 2 && px < 8 ? '#555' : (px + py) % 3 ? '#262626' : '#111'); } break;
    case 'ingot': for (let py = 6; py < 12; py++) for (let px = 2; px < 14; px++) { const s = py - 6; if (px >= 2 + (5 - s) * 0.5 && px <= 13 - (5 - s) * 0.5) P(px, py, py === 6 ? '#fff' : py > 9 ? md : ml); } break;
    case 'leather': for (let py = 2; py < 14; py++) for (let px = 3; px < 13; px++) { const notch = (py < 4 && (px === 7 || px === 8)) || ((py === 2 || py === 13) && (px === 3 || px === 12)); if (!notch) P(px, py, (px * 7 + py * 3) % 5 ? '#a8622c' : '#7a421a'); } break;
    case 'bone': for (let i = 3; i <= 12; i++) { P(i, 15 - i, '#f0ead8'); P(i + 1, 15 - i, '#cfc7b0'); } for (const [a, b] of [[2, 12], [3, 13], [2, 13], [12, 2], [13, 3], [13, 2]]) P(a, b, '#f0ead8'); break;
    case 'powder': for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = Math.random() * 5; P(8 + Math.cos(a) * r, 10 + Math.sin(a) * r * 0.6, i % 2 ? '#555' : '#888'); } break;
    case 'arrow': handle(3, 12, 11, 4); P(12, 3, '#ccc'); P(11, 3, '#ccc'); P(12, 4, '#ccc'); P(13, 2, '#eee'); P(2, 13, '#fff'); P(3, 13, '#fff'); P(2, 12, '#fff'); break;
    case 'flesh': for (let py = 4; py < 13; py++) for (let px = 3; px < 13; px++) if (Math.hypot(px - 8, py - 8.5) < 4.8) P(px, py, (px + py) % 4 ? '#8a6a3a' : '#5a7a2a'); break;
    case 'bucket': case 'wbucket': for (let py = 6; py < 14; py++) for (let px = 3; px < 13; px++) { const s = (py - 6) * 0.25; if (px >= 3 + s && px < 13 - s) P(px, py, py === 6 ? (kind === 'wbucket' ? '#3a6ae8' : '#555') : px < 6 ? '#ddd' : '#aaa'); }
      if (kind === 'wbucket') for (let px = 4; px < 12; px++) P(px, 7, '#5a8af8'); for (let px = 4; px < 12; px++) P(px, 3 + Math.abs(px - 7.5) * 0.5, '#888'); break;
    case 'door': for (let py = 1; py < 15; py++) for (let px = 4; px < 12; px++) { const win = py > 2 && py < 7 && px > 5 && px < 10; P(px, py, win ? '#9ad' : (px === 4 || px === 11 || py === 1 || py === 14) ? '#6e4a28' : '#a0743e'); } P(10, 9, '#333'); break;
    case 'helmet': for (let py = 4; py < 11; py++) for (let px = 3; px < 13; px++) if (!(py > 7 && px > 4 && px < 11)) P(px, py, py === 4 ? md : ml); break;
    case 'chest': for (let py = 2; py < 14; py++) for (let px = 2; px < 14; px++) { const arm = py < 7 ? true : px > 3 && px < 12; const neck = py < 4 && px > 5 && px < 10; if (arm && !neck) P(px, py, (px === 2 || px === 13 || py === 13) ? md : ml); } break;
    case 'legs': for (let py = 2; py < 14; py++) for (let px = 3; px < 13; px++) { const gap = py > 5 && px > 6 && px < 9; if (!gap) P(px, py, py === 2 ? md : ml); } break;
    case 'boots': for (let py = 6; py < 13; py++) for (let px = 2; px < 14; px++) { const gap = px > 6 && px < 9; const toe = py > 10 || (px < 5 || (px > 8 && px < 12)); if (!gap && toe) P(px, py, py === 12 ? md : ml); } break;
  }
  return c;
}
const iconCache = {}, iconCanvas = {};
function itemCanvas(id) {
  if (iconCanvas[id]) return iconCanvas[id];
  const it = ITEMS[id]; let c = null;
  if (it.px) c = drawIcon(it.px, it.mat);
  else if (it.block != null) { c = document.createElement('canvas'); c.width = c.height = TS; c.getContext('2d').drawImage(atlas, (BT[it.block][2] % AT) * TS, Math.floor(BT[it.block][2] / AT) * TS, TS, TS, 0, 0, TS, TS); }
  else { c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = '52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.emoji || '?', 32, 36); }
  return (iconCanvas[id] = c);
}
function iconHTML(id) {
  const it = ITEMS[id]; if (!it) return '';
  if (!it.px && it.block == null) return it.emoji;
  if (!iconCache[id]) iconCache[id] = itemCanvas(id).toDataURL();
  return `<img src="${iconCache[id]}">`;
}

// block-breaking crack overlays (10 stages, like Minecraft)
const crackTex = [];
{
  const rr = mulberry(77), lines = [];
  for (let i = 0; i < 40; i++) { let x = 8, y = 8; const seg = []; const a0 = rr() * 6.28; for (let k = 0; k < 8; k++) { const a = a0 + (rr() - .5) * 1.4; x += Math.cos(a) * 1.3; y += Math.sin(a) * 1.3; seg.push([x | 0, y | 0]); } lines.push(seg); }
  for (let s = 0; s < 10; s++) {
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.75)';
    for (let i = 0; i < 4 + s * 4; i++) { const seg = lines[i]; for (let k = 0; k < Math.min(8, 2 + s); k++) { const [px, py] = seg[k]; if (px >= 0 && py >= 0 && px < 16 && py < 16) x.fillRect(px, py, 1, 1); } }
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; crackTex.push(t);
  }
}
// average colour of each block, used for break particles
const blockColor = {};
function blockCol(id) {
  if (blockColor[id]) return blockColor[id];
  const t = (BT[id] || BT[STONE])[2], d = actx.getImageData((t % AT) * TS, Math.floor(t / AT) * TS, TS, TS).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return (blockColor[id] = new THREE.Color(r / n / 255, g / n / 255, b / n / 255).convertSRGBToLinear());
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
// height of a water surface inside its block
function waterTop(id, above) { if (isWater(above)) return 1; if (id === WATER) return 0.88; if (id === FALL) return 0.88; return 0.88 - (id - FLOW1 + 1) * 0.1; }
// a door is a thin slab against one side of its block; open doors swing to the next side
function doorBox(id) { const s = doorOpen(id) ? (doorF(id) + 1) % 4 : doorF(id), t = 0.1875;
  return [[0, 0, 0, 1, 1, t], [1 - t, 0, 0, 1, 1, 1], [0, 0, 1 - t, 1, 1, 1], [0, 0, 0, t, 1, 1]][s]; }
function pushBox(A, x, y, z, b, tile) {
  const [x0, y0, z0, x1, y1, z1] = b;
  for (const f of FACES) {
    const base = A.p.length / 3;
    for (const q of f.c) {
      A.p.push(x + (q[0] ? x1 : x0), y + (q[1] ? y1 : y0), z + (q[2] ? z1 : z0));
      A.n.push(f.d[0], f.d[1], f.d[2]);
      const uv = tileUV(tile, q[3], q[4]); A.u.push(uv[0], uv[1]); A.c.push(f.s, f.s, f.s);
    }
    A.i.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
}
function buildChunk(cx, cz) {
  const key = ckey(cx, cz), c = data.get(key); if (!c) return;
  const A = { p: [], n: [], u: [], c: [], i: [] }, Bw = { p: [], n: [], u: [], c: [], i: [] };
  const x0 = cx * CH, z0 = cz * CH;
  const nbAt = (lx, y, lz, dx, dy, dz) => { const nx = lx + dx, ny = y + dy, nz = lz + dz; return (nx >= 0 && nz >= 0 && nx < CH && nz < CH) ? (ny < 0 ? STONE : ny >= H ? AIR : c[lidx(nx, ny, nz)]) : get(x0 + nx, ny, z0 + nz); };
  for (let y = 0; y < H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const id = c[lidx(lx, y, lz)]; if (id === AIR) continue;
    const x = x0 + lx, z = z0 + lz;
    if (isDoor(id)) { pushBox(A, x, y, z, doorBox(id), doorTop(id) ? 48 : 47); continue; }
    const T = BT[id], wat = isWater(id);
    const top = wat ? waterTop(id, nbAt(lx, y, lz, 0, 1, 0)) : 1;
    for (const f of FACES) {
      const nb = nbAt(lx, y, lz, f.d[0], f.d[1], f.d[2]);
      if (wat) { if (isWater(nb) || (nb !== AIR && !seeThrough(nb))) { if (!(f.d[1] === 1 && top < 1 && nb === AIR)) continue; } }
      else if (nb !== AIR && !(seeThrough(nb) && nb !== id)) continue;
      const tgt = wat ? Bw : A;
      const tile = f.f === 0 ? T[0] : f.f === 1 ? T[1] : T[2];
      const base = tgt.p.length / 3;
      const topDrop = wat ? 1 - top : (id === FARM && f.d[1] === 1 ? 0.06 : 0);
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
const dirtyChunks = new Set();
function markDirty(x, z) {
  const cx = fdiv(x, CH), cz = fdiv(z, CH), lx = x - cx * CH, lz = z - cz * CH;
  dirtyChunks.add(ckey(cx, cz));
  if (lx === 0) dirtyChunks.add(ckey(cx - 1, cz)); if (lx === CH - 1) dirtyChunks.add(ckey(cx + 1, cz));
  if (lz === 0) dirtyChunks.add(ckey(cx, cz - 1)); if (lz === CH - 1) dirtyChunks.add(ckey(cx, cz + 1));
}
function flushDirty() { for (const k of dirtyChunks) { if (chunks[k]) { const [cx, cz] = k.split(',').map(Number); buildChunk(cx, cz); } } dirtyChunks.clear(); }
// change a block, remember the edit, wake up nearby water, and remesh (batched)
function setBlock(x, y, z, id, now = true) {
  if (y < 0 || y >= H) return;
  rawSet(x, y, z, id); const k = x + ',' + y + ',' + z; state.edits[k] = id; indexEdit(k);
  markDirty(x, z); wakeWater(x, y, z);
  if (now) flushDirty();
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
  for (const key in chunks) { const [cx, cz] = key.split(',').map(Number); if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (VIEW + 2.5) ** 2) dropMesh(key); }
  if (data.size > 600) for (const key of data.keys()) { const [cx, cz] = key.split(',').map(Number); if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (VIEW + 6) ** 2) { dropMesh(key); data.delete(key); } }
  return todoG.length + todoM.length;
}

// ================== FLOWING WATER (Minecraft-style levels) ==================
// WATER = source (level 0), FLOW1..FLOW7 = spreading levels, FALL = water pouring down
const waterQ = new Set();
const wlevel = id => id === WATER || id === FALL ? 0 : isWater(id) ? id - FLOW1 + 1 : 99;
const canFlowInto = id => id === AIR;
function wakeWater(x, y, z) { for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) { if (isWater(get(x + dx, y + dy, z + dz))) waterQ.add((x + dx) + ',' + (y + dy) + ',' + (z + dz)); } }
function wSet(x, y, z, id) {
  const k = x + ',' + y + ',' + z;
  if (id !== AIR && state.crops[k]) removeCrop(k, true);
  rawSet(x, y, z, id); state.edits[k] = id; indexEdit(k); markDirty(x, z);
  for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) if (isWater(get(x + dx, y + dy, z + dz)) || (dx === 0 && dy === 0 && dz === 0)) waterQ.add((x + dx) + ',' + (y + dy) + ',' + (z + dz));
}
function waterTick() {
  if (!waterQ.size) return;
  const batch = [...waterQ].slice(0, 220); for (const k of batch) waterQ.delete(k);
  const side = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const k of batch) {
    const [x, y, z] = k.split(',').map(Number);
    if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
    const id = get(x, y, z); if (!isWater(id)) continue;
    const above = get(x, y + 1, z), below = get(x, y - 1, z);
    if (id !== WATER) {
      // two sources side by side over something solid make a new source (infinite water)
      let srcN = 0; for (const [dx, dz] of side) if (get(x + dx, y, z + dz) === WATER) srcN++;
      if (srcN >= 2 && (solid(below) || below === WATER)) { wSet(x, y, z, WATER); continue; }
      // is this flowing water still fed? (its level is one more than its best neighbour)
      let feed = 99; for (const [dx, dz] of side) { const n = get(x + dx, y, z + dz); if (isWater(n)) feed = Math.min(feed, wlevel(n)); }
      const want = isWater(above) ? FALL : feed >= 7 ? AIR : FLOW1 + feed;
      if (want !== id) { wSet(x, y, z, want); if (want === AIR) continue; }
    }
    const cur = get(x, y, z);
    if (y > 0 && canFlowInto(below)) { wSet(x, y - 1, z, FALL); continue; }
    if (isWater(below) && below !== WATER) { if (below !== FALL) wSet(x, y - 1, z, FALL); continue; }
    const next = (cur === FALL ? 0 : wlevel(cur)) + 1;
    if (next > 7) continue;
    for (const [dx, dz] of side) { const n = get(x + dx, y, z + dz); if (canFlowInto(n) || (isWater(n) && n !== WATER && n !== FALL && wlevel(n) > next)) wSet(x + dx, y, z + dz, FLOW1 + next - 1); }
  }
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

// ================== SETTINGS ==================
const SETTINGS_KEY = 'dealercraft_settings';
const settings = Object.assign({ jumpscares: true, sound: true, peaceful: false, difficulty: null, sens: 1 }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })());
if (localStorage.getItem('dealercraft_mute') === '1' && settings._muteMigrated == null) { settings.sound = false; }
settings._muteMigrated = true;
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }

// ================== PLAYER ==================
const player = { pos: new THREE.Vector3(...state.pos), vel: new THREE.Vector3(), yaw: state.yaw, pitch: state.pitch, onGround: false,
  alive: true, sprint: false, fallStart: null, air: 15, hurtT: 0, regenT: 0, starveT: 0, exhaust: 0, eatT: 0 };
const PW = 0.3, PH = 1.8, EYE = 1.62;
function collides(p) {
  for (let x = Math.floor(p.x - PW); x <= Math.floor(p.x + PW); x++)
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + PH - 0.01); y++)
      for (let z = Math.floor(p.z - PW); z <= Math.floor(p.z + PW); z++) {
        const id = get(x, y, z); if (!solid(id)) continue;
        if (isDoor(id)) {   // a closed door only blocks its thin slab, so you can stand in the doorway
          const b = doorBox(id);
          if (p.x + PW > x + b[0] && p.x - PW < x + b[3] && p.z + PW > z + b[2] && p.z - PW < z + b[5]) return true;
          continue;
        }
        return true;
      }
  return false;
}
function inWater() { return isWater(get(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.4), Math.floor(player.pos.z))); }
function headInWater() { return isWater(get(Math.floor(player.pos.x), Math.floor(player.pos.y + EYE), Math.floor(player.pos.z))); }
function armorPoints() { let p = 0; for (const s of state.armor) if (s && ITEMS[s.id].armor) p += ITEMS[s.id].armor.pts; return p; }
function exhaust(v) { player.exhaust += v * diff().hunger; while (player.exhaust >= 4) { player.exhaust -= 4; if (state.sat > 0) state.sat = Math.max(0, state.sat - 1); else state.food = Math.max(0, state.food - 1); } }
if (!settings.difficulty) settings.difficulty = settings.peaceful ? 'peaceful' : 'normal';
const DIFFS = {   // monster damage, how many monsters, monster health & speed, how fast hunger drains
  peaceful: { label: '🕊️ Peaceful', sub: 'No monsters', dmg: 0, max: 0, hp: 1, spd: 1, hunger: 0.5 },
  easy:     { label: '🙂 Easy', sub: 'Fewer, weaker monsters', dmg: 0.5, max: 4, hp: 0.75, spd: 0.9, hunger: 0.75 },
  normal:   { label: '😐 Normal', sub: 'Classic survival', dmg: 1, max: 7, hp: 1, spd: 1, hunger: 1 },
  hard:     { label: '😠 Hard', sub: 'More monsters that hit harder', dmg: 1.5, max: 11, hp: 1.25, spd: 1.1, hunger: 1.25 },
  insane:   { label: '💀 Insane', sub: 'Swarms of fast, brutal monsters', dmg: 2.5, max: 16, hp: 1.6, spd: 1.3, hunger: 1.6 } };
const diff = () => DIFFS[settings.difficulty] || DIFFS.normal;
const MOBHIT = new Set(['zombie', 'skeleton', 'explosion']);
function damage(n, cause, from) {
  if (MOBHIT.has(cause)) n = Math.round(n * diff().dmg);
  if (!player.alive || n <= 0) return;
  if (cause !== 'fall' && cause !== 'starve' && cause !== 'drown') n = Math.max(1, Math.round(n * (1 - armorPoints() * 0.04)));
  state.hp = Math.max(0, state.hp - n); player.hurtT = 0.5; exhaust(0.1);
  if (from) { const k = player.pos.clone().sub(from).setY(0); if (k.lengthSq() > 0) { k.normalize().multiplyScalar(7); player.vel.x += k.x; player.vel.z += k.z; player.kb = 0.25; player.vel.y = Math.max(player.vel.y, 5); } }
  hurtSnd(); const fl = document.getElementById('hurt'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
  renderVitals();
  if (state.hp <= 0) die(cause);
}
function die(cause) {
  player.alive = false; holdBreak = false;
  // like Minecraft you drop everything, but here it is kept safe in a gravestone where you fell
  const items = [...state.slots, ...state.armor].filter(Boolean);
  if (items.length) {
    let gx = Math.floor(player.pos.x), gy = Math.max(1, Math.floor(player.pos.y)), gz = Math.floor(player.pos.z);
    while (gy < H - 1 && get(gx, gy, gz) !== AIR && !isWater(get(gx, gy, gz))) gy++;
    setBlock(gx, gy, gz, GRAVE); state.graves[gx + ',' + gy + ',' + gz] = items;
    state.slots = emptySlots(36); state.armor = emptySlots(4); renderHotbar();
  }
  const msg = { zombie: 'was eaten by a zombie', skeleton: 'was shot by a skeleton', explosion: 'was blown up by a creeper', fall: 'hit the ground too hard', drown: 'drowned', starve: 'starved to death' }[cause] || 'died';
  const show = () => { document.getElementById('deathMsg').textContent = 'Buggy ' + msg; document.getElementById('death').classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); };
  if (settings.jumpscares && (cause === 'zombie' || cause === 'skeleton' || cause === 'explosion' || nightAmt > 0.5)) jumpscare(show, cause); else show();
}
function respawn() {
  document.getElementById('death').classList.remove('show');
  state.hp = 20; state.food = 20; state.sat = 5; player.air = 15; player.alive = true; player.vel.set(0, 0, 0); player.fallStart = null;
  player.pos.set(VX + 0.5, G + 1, VZ - 4.5); renderVitals(); save();
  if (!isTouch) canvas.requestPointerLock();
}
function updateVitals(dt) {
  if (!player.alive) return;
  // natural regeneration when well fed, starvation when empty (stops at half a heart, like Normal mode)
  if (state.food >= 18 && state.hp < 20) { player.regenT += dt; if (player.regenT >= 4) { player.regenT = 0; state.hp++; exhaust(6); renderVitals(); } } else player.regenT = 0;
  if (state.food <= 0) { player.starveT += dt; if (player.starveT >= 4) { player.starveT = 0; if (state.hp > 1) damage(1, 'starve'); } } else player.starveT = 0;
  // drowning
  if (headInWater()) { player.air -= dt; if (player.air <= 0) { player.air = 1; damage(2, 'drown'); } } else player.air = Math.min(15, player.air + dt * 5);
  if (player.eatT > 0) player.eatT -= dt;
}

// ================== FIRST-PERSON HAND & TOOL SWING ==================
scene.add(camera);
const hand = new THREE.Group(); camera.add(hand);
hand.position.set(0.5, -0.45, -0.75);
const handMats = {};
let handItem = null, swingT = 0, swingDur = 0.28, bobT = 0;
function setHandItem() {
  const s = state.slots[state.sel], id = s ? s.id : null;
  if (id === handItem) return; handItem = id;
  while (hand.children.length) hand.remove(hand.children[0]);
  const noDepth = m => { m.depthTest = false; m.depthWrite = false; return m; };
  let mesh;
  if (!id) { mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), noDepth(new THREE.MeshLambertMaterial({ color: 0xc58c63 }))); mesh.position.set(0.05, -0.05, 0.1); mesh.rotation.set(0.1, -0.15, 0); }
  else if (ITEMS[id].block != null && !ITEMS[id].door) {
    const T = BT[ITEMS[id].block], mk = t => noDepth(new THREE.MeshLambertMaterial({ map: tileTex(t), transparent: true, alphaTest: 0.5 }));
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), [mk(T[2]), mk(T[2]), mk(T[0]), mk(T[1]), mk(T[2]), mk(T[2])]); mesh.rotation.set(0.2, 0.7, 0);
  } else {
    if (!handMats[id]) { const t = new THREE.CanvasTexture(itemCanvas(id)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; handMats[id] = noDepth(new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })); }
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), handMats[id]);
    const tool = ITEMS[id].tool; mesh.rotation.set(0, -1.2, tool ? 0.15 : 0); mesh.position.set(0, 0.08, 0);
  }
  mesh.renderOrder = 10; hand.add(mesh);
}
function swing() { if (swingT <= 0) swingT = swingDur; }
function updateHand(dt, moving) {
  setHandItem();
  if (swingT > 0) swingT = Math.max(0, swingT - dt);
  const s = swingT > 0 ? Math.sin((1 - swingT / swingDur) * Math.PI) : 0;
  bobT += dt * (moving ? (player.sprint ? 13 : 9) : 0);
  const eat = player.eatT > 0 ? Math.sin(player.eatT * 30) * 0.03 : 0;
  hand.position.set(0.5 - s * 0.18 + Math.cos(bobT) * 0.015 * (moving ? 1 : 0), -0.45 + s * 0.12 + Math.abs(Math.sin(bobT)) * 0.02 * (moving ? 1 : 0) + eat + (player.eatT > 0 ? 0.12 : 0), -0.75 - s * 0.1);
  hand.rotation.set(-s * 1.1, s * 0.45, s * 0.25);
}

// ================== JUMPSCARES (Five Nights at Freddy's style, toggle in Settings) ==================
function scareFace(kind) {
  const c = document.createElement('canvas'); c.width = 600; c.height = 600; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 600, 600);
  const furs = { zombie: ['#3d6a2e', '#22401a'], skeleton: ['#d8d8d0', '#9a9a90'], explosion: ['#3f9a3f', '#1d5a1d'], night: ['#6a3e1e', '#3a200e'] };
  const [f1, f2] = furs[kind] || furs.night;
  // head
  const grd = x.createRadialGradient(300, 260, 40, 300, 300, 300); grd.addColorStop(0, f1); grd.addColorStop(1, f2);
  x.fillStyle = grd; x.beginPath(); x.ellipse(300, 290, 250, 270, 0, 0, 7); x.fill();
  if (kind === 'night' || !furs[kind]) { x.fillStyle = f2; for (const ex of [90, 510]) { x.beginPath(); x.arc(ex, 70, 75, 0, 7); x.fill(); x.fillStyle = '#2a1408'; x.beginPath(); x.arc(ex, 70, 38, 0, 7); x.fill(); x.fillStyle = f2; } }
  // dents and wires
  x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 3; for (let i = 0; i < 14; i++) { x.beginPath(); const a = Math.random() * 600, b = Math.random() * 500; x.moveTo(a, b); x.lineTo(a + (Math.random() - .5) * 80, b + Math.random() * 60); x.stroke(); }
  // hollow eyes with white pinprick pupils
  for (const ex of [195, 405]) { x.fillStyle = '#000'; x.beginPath(); x.ellipse(ex, 230, 72, 62, 0, 0, 7); x.fill(); const g = x.createRadialGradient(ex, 232, 2, ex, 232, 26); g.addColorStop(0, '#fff'); g.addColorStop(0.3, kind === 'zombie' ? '#cfff6a' : kind === 'explosion' ? '#ffffff' : '#ff3030'); g.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(ex, 232, 26, 0, 7); x.fill(); }
  // gaping jaw full of jagged teeth
  x.fillStyle = '#120000'; x.beginPath(); x.ellipse(300, 445, 175, 115, 0, 0, 7); x.fill();
  x.fillStyle = '#e8e2c8';
  for (let i = 0; i < 9; i++) { const tx = 140 + i * 40; x.beginPath(); x.moveTo(tx, 350); x.lineTo(tx + 40, 350); x.lineTo(tx + 20, 405 + Math.random() * 20); x.fill(); x.beginPath(); x.moveTo(tx, 545); x.lineTo(tx + 40, 545); x.lineTo(tx + 20, 490 - Math.random() * 20); x.fill(); }
  x.fillStyle = 'rgba(120,0,0,.35)'; for (let i = 0; i < 6; i++) { x.fillRect(150 + Math.random() * 300, 350, 4 + Math.random() * 5, 40 + Math.random() * 90); }
  return c.toDataURL();
}
let scaring = false, lastScare = -999;
function jumpscare(after, kind = 'night') {
  if (!settings.jumpscares || scaring) { if (after) after(); return; }
  scaring = true; lastScare = state.gameTime;
  const el = document.getElementById('scare'), img = document.getElementById('scareImg');
  img.src = scareFace(kind); el.classList.add('show');
  screamSnd();
  if (navigator.vibrate) try { navigator.vibrate([300, 60, 400]); } catch (e) {}
  setTimeout(() => { el.classList.remove('show'); scaring = false; if (after) after(); }, 1300);
}

// ================== MOBS (cows, zombies, skeletons, creepers) ==================
const MOBDEF = {
  cow:      { hp: 10, w: 0.45, h: 1.3, speed: 1.0, hostile: false, drops: () => [['raw_beef', rint(1, 3)], ['leather', rint(0, 2)]] },
  zombie:   { hp: 20, w: 0.3, h: 1.9, speed: 2.3, hostile: true, dmg: 3, burns: true, drops: () => [['rotten_flesh', rint(0, 2)]] },
  skeleton: { hp: 20, w: 0.3, h: 1.9, speed: 2.4, hostile: true, burns: true, drops: () => [['bone', rint(0, 2)], ['arrow', rint(0, 2)]] },
  creeper:  { hp: 20, w: 0.3, h: 1.7, speed: 2.2, hostile: true, drops: () => [['gunpowder', rint(0, 2)]] },
};
const mobs = [], arrows = [];
const box = (w, h, d, col, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); parent.add(m); return m; };
function pivotLimb(parent, w, h, d, col, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); const m = box(w, h, d, col, 0, -h / 2, 0, p); return p; }
function buildMob(type) {
  const g = new THREE.Group(), legs = [], arms = [];
  if (type === 'cow') {
    const body = box(0.9, 0.6, 1.3, 0x5a3a22, 0, 0.85, 0, g);
    box(0.92, 0.3, 0.5, 0xf0f0f0, 0, 0.95, 0.2, g); box(0.5, 0.35, 0.3, 0xf0f0f0, 0.15, 0.75, -0.35, g);
    const head = new THREE.Group(); head.position.set(0, 1.05, 0.75); g.add(head);
    box(0.5, 0.5, 0.4, 0x5a3a22, 0, 0, 0.1, head); box(0.36, 0.22, 0.12, 0xf2c2b0, 0, -0.12, 0.33, head);
    for (const hx of [-0.3, 0.3]) box(0.1, 0.12, 0.08, 0xdddddd, hx, 0.25, 0.05, head);
    for (const ex of [-0.14, 0.14]) box(0.07, 0.07, 0.02, 0x111111, ex, 0.07, 0.31, head);
    for (const [lx, lz] of [[-0.3, 0.45], [0.3, 0.45], [-0.3, -0.45], [0.3, -0.45]]) legs.push(pivotLimb(g, 0.22, 0.55, 0.22, 0x4a2e1a, lx, 0.55, lz));
    return { g, legs, arms, head };
  }
  if (type === 'creeper') {
    const col = 0x4caf50;
    box(0.5, 0.8, 0.3, col, 0, 0.95, 0, g);
    const head = new THREE.Group(); head.position.set(0, 1.6, 0); g.add(head);
    box(0.5, 0.5, 0.5, 0x5cc060, 0, 0, 0, head);
    for (const [fx, fy, fw, fh] of [[-0.12, 0.08, 0.12, 0.12], [0.12, 0.08, 0.12, 0.12], [0, -0.06, 0.1, 0.14], [-0.08, -0.14, 0.06, 0.12], [0.08, -0.14, 0.06, 0.12]]) box(fw, fh, 0.02, 0x0a2a0a, fx, fy, 0.26, head);
    for (const [lx, lz] of [[-0.13, 0.2], [0.13, 0.2], [-0.13, -0.2], [0.13, -0.2]]) legs.push(pivotLimb(g, 0.22, 0.55, 0.22, 0x3a9a3e, lx, 0.55, lz));
    return { g, legs, arms, head };
  }
  const skel = type === 'skeleton';
  const shirt = skel ? 0xc8c8c8 : 0x2aa6a6, pants = skel ? 0xb8b8b8 : 0x3a3aa0, skin = skel ? 0xdadada : 0x5c9a4a;
  box(skel ? 0.4 : 0.5, 0.75, 0.26, shirt, 0, 1.1, 0, g);
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); g.add(head);
  box(0.5, 0.5, 0.5, skin, 0, 0, 0, head);
  for (const ex of [-0.12, 0.12]) box(0.1, 0.08, 0.02, skel ? 0x111111 : 0x0a2a0a, ex, 0.03, 0.26, head);
  if (skel) box(0.26, 0.04, 0.02, 0x333333, 0, -0.13, 0.26, head);
  for (const lx of [-0.12, 0.12]) legs.push(pivotLimb(g, skel ? 0.12 : 0.24, 0.72, skel ? 0.12 : 0.24, pants, lx, 0.72, 0));
  for (const ax of [-0.33, 0.33]) { const a = pivotLimb(g, skel ? 0.12 : 0.2, 0.7, skel ? 0.12 : 0.2, skel ? skin : skin, ax, 1.45, 0); a.rotation.x = -1.45; arms.push(a); }
  if (skel) { const bow = box(0.05, 0.7, 0.05, 0x6b4a2a, 0, -0.75, 0.06, arms[1]); }
  return { g, legs, arms, head };
}
function spawnMob(type, x, y, z) {
  if (mobs.length >= 26) return null;
  const parts = buildMob(type), d = MOBDEF[type];
  parts.g.position.set(x, y, z); for (let i = 0; i < 6 && mobCollides(parts.g.position, d.w, d.h); i++) parts.g.position.y = Math.floor(parts.g.position.y) + 1; scene.add(parts.g);
  const m = { type, ...parts, hp: d.hostile ? Math.round(d.hp * diff().hp) : d.hp, vel: new THREE.Vector3(), onGround: false, target: null, wait: Math.random() * 3, walk: 0, hurt: 0, atk: 0, fuse: 0, burn: 0 };
  mobs.push(m); return m;
}
function removeMob(m, poof) { scene.remove(m.g); mobs.splice(mobs.indexOf(m), 1); if (poof) particles(m.g.position.x, m.g.position.y + 0.8, m.g.position.z, new THREE.Color(0.9, 0.9, 0.9), 10); }
function spawnCowsIn(x0, z0, hm, rnd) {
  if (mobs.filter(m => m.type === 'cow').length >= 14) return;
  for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) {
    const lx = 2 + Math.floor(rnd() * 12), lz = 2 + Math.floor(rnd() * 12), h = hm[lx + lz * CH];
    if (h <= SEA + 1 || h >= 26 || deadAt(x0 + lx, z0 + lz)) continue;
    if (Math.hypot(x0 + lx - VX, z0 + lz - VZ) < 14) continue;
    spawnMob('cow', x0 + lx + 0.5, h + 1, z0 + lz + 0.5);
  }
}
function mobCollides(p, w, h) {
  for (let x = Math.floor(p.x - w); x <= Math.floor(p.x + w); x++) for (let y = Math.floor(p.y); y <= Math.floor(p.y + h - 0.01); y++) for (let z = Math.floor(p.z - w); z <= Math.floor(p.z + w); z++) if (solid(get(x, y, z))) return true;
  return false;
}
function lineOfSight(a, b) {
  const d = b.clone().sub(a), n = Math.ceil(d.length() * 3); d.divideScalar(n);
  const p = a.clone(); for (let i = 0; i < n; i++) { p.add(d); if (solid(get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) return false; }
  return true;
}
function skyAbove(x, y, z) { for (let yy = Math.floor(y) + 2; yy < H; yy++) if (get(Math.floor(x), yy, Math.floor(z)) !== AIR) return false; return true; }
function hurtMob(m, dmg, from) {
  m.hp -= dmg; m.hurt = 0.35;
  const k = m.g.position.clone().sub(from).setY(0).normalize().multiplyScalar(6); m.vel.x = k.x; m.vel.z = k.z; m.vel.y = 5;
  hitSnd();
  if (m.type === 'cow') { m.target = null; m.panic = 4; }
  if (m.hp <= 0) {
    for (const [id, n] of MOBDEF[m.type].drops()) if (n > 0) give(id, n);
    const got = MOBDEF[m.type].drops; toast(m.type === 'cow' ? '🐄 Got beef and leather' : `💀 Defeated a ${m.type}!`);
    removeMob(m, true);
  }
}
function explode(x, y, z, power) {
  boomSnd();
  particles(x, y, z, new THREE.Color(0.25, 0.25, 0.25), 30);
  const safe = Math.hypot(x - VX, z - VZ) < SAFE_R;
  if (!safe) for (let dx = -power; dx <= power; dx++) for (let dy = -power; dy <= power; dy++) for (let dz = -power; dz <= power; dz++) {
    if (dx * dx + dy * dy + dz * dz > power * power + Math.random() * 2) continue;
    const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz, id = get(bx, by, bz);
    if (id === AIR || id === BEDROCK || id === GRAVE || isWater(id) || by <= 0) continue;
    const k = bx + ',' + (by + 1) + ',' + bz; if (state.crops[k]) removeCrop(k, false);
    rawSet(bx, by, bz, AIR); const ek = bx + ',' + by + ',' + bz; state.edits[ek] = AIR; indexEdit(ek); markDirty(bx, bz); wakeWater(bx, by, bz);
  }
  flushDirty();
  const d = player.pos.distanceTo(new THREE.Vector3(x, y, z));
  if (d < power * 2.2) { damage(Math.round((1 - d / (power * 2.2)) * 22), 'explosion', new THREE.Vector3(x, y, z)); }
  for (const m of [...mobs]) { const md = m.g.position.distanceTo(new THREE.Vector3(x, y, z)); if (md < power * 2) hurtMob(m, Math.round((1 - md / (power * 2)) * 18), new THREE.Vector3(x, y, z)); }
}
let spawnT = 0;
function updateMobs(dt, t) {
  // night-time monster spawning (not in the village, not in peaceful mode)
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = settings.difficulty === 'insane' ? 1.2 : settings.difficulty === 'hard' ? 1.8 : 2.5;
    const hostile = mobs.filter(m => MOBDEF[m.type].hostile).length;
    if (nightAmt > 0.62 && hostile < diff().max) {
      const a = Math.random() * 6.28, r = 18 + Math.random() * 14, x = player.pos.x + Math.cos(a) * r, z = player.pos.z + Math.sin(a) * r;
      if (Math.hypot(x - VX, z - VZ) > SAFE_R + 4 && data.has(ckey(fdiv(Math.floor(x), CH), fdiv(Math.floor(z), CH)))) {
        const y = groundAt(x, z), below = get(Math.floor(x), y - 1, Math.floor(z));
        if (!isWater(below) && below !== AIR && get(Math.floor(x), y, Math.floor(z)) === AIR && y < H - 2) spawnMob(['zombie', 'zombie', 'skeleton', 'creeper'][rint(0, 3)], Math.floor(x) + 0.5, y, Math.floor(z) + 0.5);
      }
    }
  }
  const pp = player.pos;
  for (const m of [...mobs]) {
    const d = MOBDEF[m.type], g = m.g, p = g.position;
    const dist = p.distanceTo(pp);
    if (dist > 90 || (d.hostile && diff().max === 0)) { removeMob(m, false); continue; }
    if (!data.has(ckey(fdiv(Math.floor(p.x), CH), fdiv(Math.floor(p.z), CH)))) continue;   // frozen until its land loads
    m.hurt = Math.max(0, m.hurt - dt); m.atk = Math.max(0, m.atk - dt);
    let mx = 0, mz = 0, speed = d.hostile ? d.speed * diff().spd : d.speed;
    const chase = d.hostile && dist < 18 && player.alive;
    if (chase) {
      const dx = pp.x - p.x, dz = pp.z - p.z, dd = Math.hypot(dx, dz) || 1;
      if (m.type === 'skeleton') {
        const want = dist < 7 ? -1 : dist > 12 ? 1 : 0; mx = dx / dd * want; mz = dz / dd * want;
        if (m.atk <= 0 && dist < 16 && lineOfSight(p.clone().setY(p.y + 1.6), pp.clone().setY(pp.y + 1.5))) { shootArrow(m); m.atk = 2.2; }
      } else { mx = dx / dd; mz = dz / dd; }
      g.rotation.y = Math.atan2(dx, dz);
      if (m.type === 'zombie' && dist < 1.5 && m.atk <= 0) { damage(d.dmg, 'zombie', p); m.atk = 1; }
      if (m.type === 'creeper') {
        if (dist < 2.8) { m.fuse += dt; if (m.fuse < dt * 1.5) hissSnd(); speed = 0.3; } else m.fuse = Math.max(0, m.fuse - dt);
        const s = 1 + m.fuse * 0.25; g.scale.set(s, 1 + m.fuse * 0.1, s);
        const flash = m.fuse > 0 && Math.floor(t * 8) % 2 === 0;
        g.traverse(o => { if (o.material) o.material.emissive && o.material.emissive.setScalar(flash ? 0.6 : 0); });
        if (m.fuse >= 1.5) { removeMob(m, false); explode(p.x, p.y + 0.8, p.z, 3); continue; }
      }
    } else {
      if (m.panic > 0) { m.panic -= dt; if (!m.target || Math.random() < 0.02) m.target = new THREE.Vector2(p.x + (Math.random() - .5) * 12, p.z + (Math.random() - .5) * 12); speed *= 2.2; }
      if (m.wait > 0) m.wait -= dt;
      else {
        if (!m.target) m.target = new THREE.Vector2(p.x + (Math.random() - .5) * 10, p.z + (Math.random() - .5) * 10);
        const dx = m.target.x - p.x, dz = m.target.y - p.z, dd = Math.hypot(dx, dz);
        if (dd < 0.3) { m.target = null; m.wait = 2 + Math.random() * 5; }
        else { mx = dx / dd; mz = dz / dd; g.rotation.y = Math.atan2(dx, dz); }
      }
    }
    // undead burn in daylight
    if (d.burns && nightAmt < 0.35 && skyAbove(p.x, p.y, p.z)) { m.burn += dt; if (m.burn > 1) { m.burn = 0; particles(p.x, p.y + 1.5, p.z, new THREE.Color(1, 0.5, 0.1), 5); m.hp -= 2; m.hurt = 0.2; if (m.hp <= 0) { removeMob(m, true); continue; } } }
    // physics (knockback decays into walking)
    const k = Math.min(1, dt * 6);
    m.vel.x += (mx * speed - m.vel.x) * k; m.vel.z += (mz * speed - m.vel.z) * k;
    const inW = isWater(get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)));
    m.vel.y -= (inW ? 8 : 24) * dt; if (inW) m.vel.y = Math.max(m.vel.y, 1.5 * (Math.random() < 0.5 ? 1 : 0.2));
    let blocked = false;
    for (const ax of ['x', 'z']) { const o = p[ax]; p[ax] += m.vel[ax] * dt; if (mobCollides(p, d.w, d.h)) { p[ax] = o; blocked = true; } }
    if (blocked && m.onGround && (mx || mz)) m.vel.y = 7.5;
    const oy = p.y; p.y += m.vel.y * dt; m.onGround = false;
    if (mobCollides(p, d.w, d.h)) { if (m.vel.y < 0) { p.y = Math.floor(oy + 0.001); if (mobCollides(p, d.w, d.h)) p.y = oy; m.onGround = true; } else p.y = oy; m.vel.y = 0; }
    if (p.y < -5) { removeMob(m, false); continue; }
    // animation
    const moving = Math.hypot(m.vel.x, m.vel.z); m.walk += dt * moving * 3.2;
    const sw = Math.sin(m.walk) * Math.min(0.8, moving * 0.4);
    m.legs.forEach((l, i) => l.rotation.x = (i % 2 ? sw : -sw) * (m.type === 'cow' || m.type === 'creeper' ? (i < 2 ? 1 : -1) : 1));
    if (m.type === 'cow' && m.head) m.head.rotation.x = m.wait > 0 && !m.panic ? 0.5 + Math.sin(t * 2) * 0.1 : 0;
    const red = m.hurt > 0;
    if (m.wasRed !== red) { m.wasRed = red; g.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setRGB(red ? 0.6 : 0, 0, 0); }); }
  }
  // arrows
  for (const a of [...arrows]) {
    a.vel.y -= 14 * dt; a.m.position.addScaledVector(a.vel, dt); a.life -= dt;
    a.m.lookAt(a.m.position.clone().add(a.vel));
    const ap = a.m.position;
    if (player.alive && ap.distanceTo(pp.clone().setY(pp.y + 0.9)) < 0.8) { damage(rint(2, 4), 'skeleton', ap.clone().sub(a.vel)); scene.remove(a.m); arrows.splice(arrows.indexOf(a), 1); continue; }
    if (a.life <= 0 || solid(get(Math.floor(ap.x), Math.floor(ap.y), Math.floor(ap.z)))) { scene.remove(a.m); arrows.splice(arrows.indexOf(a), 1); }
  }
}
const arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.6), arrowMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
function shootArrow(m) {
  const from = m.g.position.clone().setY(m.g.position.y + 1.5), to = player.pos.clone().setY(player.pos.y + 1.2);
  const dir = to.clone().sub(from), dist = dir.length(); dir.normalize();
  const v = dir.multiplyScalar(16); v.y += dist * 0.45 + (Math.random() - .5) * 1.5; v.x += (Math.random() - .5) * 1.2; v.z += (Math.random() - .5) * 1.2;
  const a = new THREE.Mesh(arrowGeo, arrowMat); a.position.copy(from); scene.add(a);
  arrows.push({ m: a, vel: v, life: 4 }); beep(900, 0.05, 'triangle', 0.04);
}

// ================== PARTICLES ==================
const parts = [], partGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
function particles(x, y, z, col, n = 8) {
  const mat = new THREE.MeshLambertMaterial({ color: col });
  for (let i = 0; i < n; i++) {
    if (parts.length > 160) break;
    const m = new THREE.Mesh(partGeo, mat); m.position.set(x + (Math.random() - .5) * 0.6, y + (Math.random() - .5) * 0.6, z + (Math.random() - .5) * 0.6); scene.add(m);
    parts.push({ m, v: new THREE.Vector3((Math.random() - .5) * 4, Math.random() * 4, (Math.random() - .5) * 4), life: 0.5 + Math.random() * 0.4 });
  }
}
function updateParticles(dt) { for (const p of [...parts]) { p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); p.life -= dt; if (p.life <= 0) { scene.remove(p.m); parts.splice(parts.indexOf(p), 1); } } }

// ================== INPUT ==================
const keys = {};
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');
let playing = false, uiOpen = false;
const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 }, look = { id: null, x: 0, y: 0 };
let wantJump = false, holdBreak = false, lastWTap = 0, lastTouchTap = 0, lastJoyTap = 0;

addEventListener('keydown', e => {
  if (!keys[e.code] && e.code === 'KeyW') { const n = performance.now(); if (n - lastWTap < 300) player.sprint = true; lastWTap = n; }   // double-tap W to sprint
  keys[e.code] = true;
  if (!playing) return;
  if (e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); uiOpen ? closePanels() : openInventory(false); }
  if (e.code === 'Escape' && uiOpen) closePanels();
  if (e.code === 'ControlLeft') player.sprint = true;
  if (/^Digit[1-9]$/.test(e.code)) { state.sel = +e.code.slice(5) - 1; renderHotbar(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyW') player.sprint = false; });
addEventListener('wheel', e => { if (!playing || uiOpen) return; state.sel = (state.sel + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar(); });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0025 * settings.sens; player.pitch -= e.movementY * 0.0025 * settings.sens;
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
});
canvas.addEventListener('mousedown', e => {
  if (isTouch || !playing || uiOpen || !player.alive) return;
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (e.button === 0) { holdBreak = true; attackOrSwing(); }
  if (e.button === 2) useAction();
});
addEventListener('mouseup', e => { if (e.button === 0) holdBreak = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// touch: left side = joystick, right side = look. Double-tap the screen while walking to sprint.
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); if (!playing || uiOpen || !player.alive) return;
  const n = performance.now();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.4 && joy.id === null) {
      joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY; joy.x = joy.y = 0;
      if (n - lastJoyTap < 350) player.sprint = true; lastJoyTap = n;
    } else if (look.id === null) {
      look.id = t.identifier; look.x = t.clientX; look.y = t.clientY;
      if (n - lastTouchTap < 350 && joy.id !== null) player.sprint = true; lastTouchTap = n;
    }
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
      player.yaw -= (t.clientX - look.x) * 0.006 * settings.sens; player.pitch -= (t.clientY - look.y) * 0.006 * settings.sens;
      player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
      look.x = t.clientX; look.y = t.clientY;
    }
  }
}, { passive: false });
const endTouch = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; player.sprint = false; document.getElementById('knob').style.transform = ''; }
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
holdBtn('bBreak', () => { if (!player.alive) return; holdBreak = true; attackOrSwing(); }, () => { holdBreak = false; });
holdBtn('bUse', () => useAction());
holdBtn('bRun', () => { player.sprint = !player.sprint; });
document.getElementById('bBag').addEventListener('click', () => { if (playing && player.alive) (uiOpen ? closePanels() : openInventory(false)); });
document.getElementById('bHelp').addEventListener('click', () => showStart());
document.getElementById('bSet').addEventListener('click', () => openSettings());
document.getElementById('bRespawn').addEventListener('click', () => respawn());

// ================== RAYCAST ==================
const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
scene.add(highlight);
const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
crackMesh.visible = false; scene.add(crackMesh);
function getDir() { return new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)); }
function raycast(maxD = 5, water = false) {
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
    if (water && id === WATER) { hit = { kind: 'water', x, y, z, n, t, id }; break; }
    if (id !== AIR && !isWater(id)) { hit = { kind: 'block', x, y, z, n, t, id }; break; }
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  if (water) return hit;
  const ray = new THREE.Ray(o.clone(), d), tmp = new THREE.Vector3();
  for (const v of villagers) {
    const b = new THREE.Box3(new THREE.Vector3(v.g.position.x - 0.4, v.g.position.y, v.g.position.z - 0.4), new THREE.Vector3(v.g.position.x + 0.4, v.g.position.y + 1.95, v.g.position.z + 0.4));
    const p = ray.intersectBox(b, tmp); if (p) { const dist = p.distanceTo(o); if (dist < maxD && (!hit || dist < hit.t)) hit = { kind: 'villager', v, t: dist }; }
  }
  for (const m of mobs) {
    const def = MOBDEF[m.type], gp = m.g.position, w = def.w + 0.15 + (m.type === 'cow' ? 0.35 : 0);
    const b = new THREE.Box3(new THREE.Vector3(gp.x - w, gp.y, gp.z - w), new THREE.Vector3(gp.x + w, gp.y + def.h, gp.z + w));
    const p = ray.intersectBox(b, tmp); if (p) { const dist = p.distanceTo(o); if (dist < maxD && (!hit || dist < hit.t)) hit = { kind: 'mob', m, t: dist }; }
  }
  return hit;
}

// ================== INVENTORY (Minecraft-style slots) ==================
const AC = window.AudioContext ? new AudioContext() : null;
let master = null;
if (AC) { master = AC.createGain(); master.gain.value = settings.sound ? 1 : 0; master.connect(AC.destination); }
function beep(f = 440, dur = 0.08, type = 'square', vol = 0.06) {
  if (!AC) return; try {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(g).connect(master); o.start(); o.stop(AC.currentTime + dur);
  } catch (e) {}
}
const coinSnd = () => { beep(988, 0.07, 'square', 0.05); setTimeout(() => beep(1319, 0.12, 'square', 0.05), 70); };
const newStack = (id, n) => ({ id, n, d: ITEMS[id].tool ? TIERS[ITEMS[id].tool.tier].dur : undefined });
function count(id) { let n = 0; for (const s of state.slots) if (s && s.id === id) n += s.n; return n; }
function give(id, n = 1) {
  if (!ITEMS[id]) return n;
  const max = stackOf(id);
  for (const s of state.slots) if (n > 0 && s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
  for (let i = 0; i < 36 && n > 0; i++) if (!state.slots[i]) { const k = Math.min(n, max); state.slots[i] = newStack(id, k); n -= k; }
  if (n > 0) toast('🎒 Inventory full!');
  renderHotbar(); return n;
}
function take(id, n = 1) {
  if (count(id) < n) return false;
  for (let i = 35; i >= 0 && n > 0; i--) { const s = state.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) state.slots[i] = null; } }
  renderHotbar(); return true;
}
function useHeld(n = 1) { const s = state.slots[state.sel]; if (!s) return; s.n -= n; if (s.n <= 0) state.slots[state.sel] = null; renderHotbar(); }
function wearTool(amount = 1) {
  const s = state.slots[state.sel]; if (!s || !ITEMS[s.id].tool) return;
  s.d -= amount; if (s.d <= 0) { toast(`💥 Your ${ITEMS[s.id].name} broke!`); beep(150, 0.2, 'sawtooth', 0.06); state.slots[state.sel] = null; }
  renderHotbar();
}
let toastT = 0;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); toastT = 2.2; }

// ================== ACTIONS ==================
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
const held = () => { const s = state.slots[state.sel]; return s ? s.id : null; };
const heldTool = () => { const id = held(); return id && ITEMS[id].tool ? ITEMS[id].tool : null; };
// how long a block takes to break with what you're holding, and whether it drops
function breakInfo(id) {
  const h = HARD[id] || [0.5, null], t = heldTool();
  const right = t && t.kind === h[1], lvl = right ? TIERS[t.tier].lvl : 0;
  const canDrop = h[2] == null || lvl >= h[2];
  const speed = right ? TIERS[t.tier].speed : 1;
  return { time: Math.max(0.05, h[0] * (canDrop ? 1.5 : 5) / speed), canDrop: canDrop && h[2] !== 99, right };
}
const mine = { key: null, prog: 0, total: 1, cd: 0 };
function attackOrSwing() {
  if (AC && AC.state === 'suspended') AC.resume();
  swing();
  const h = raycast();
  if (h && h.kind === 'mob' && mine.cd <= 0) {
    const t = heldTool(), base = t ? (t.kind === 'sword' ? 4 : t.kind === 'axe' ? 3 : t.kind === 'pick' ? 2 : 1) + TIERS[t.tier].dmg : 1;
    const crit = player.vel.y < -1 ? 1.5 : 1;
    hurtMob(h.m, Math.round(base * crit), player.pos); exhaust(0.1); if (t) wearTool(t.kind === 'sword' ? 1 : 2);
    mine.cd = 0.5;
  } else if (h && h.kind === 'villager') toast(`${h.v.name}: "Hey! Use ✋ to trade with me."`);
}
function finishBreak(h) {
  const id = h.id, info = breakInfo(id);
  if (id === BEDROCK) return;
  const above = h.x + ',' + (h.y + 1) + ',' + h.z;
  if (state.crops[above]) removeCrop(above, true);
  const key = h.x + ',' + h.y + ',' + h.z;
  if (isDoor(id)) { const oy = doorTop(id) ? h.y - 1 : h.y + 1; if (isDoor(get(h.x, oy, h.z))) setBlock(h.x, oy, h.z, AIR, false); setBlock(h.x, h.y, h.z, AIR); give('door', 1); }
  else if (id === GRAVE) { setBlock(h.x, h.y, h.z, AIR); openGrave(key); }
  else {
    setBlock(h.x, h.y, h.z, AIR);
    if (id === CHEST && state.chests[key]) { for (const s of state.chests[key]) if (s) give(s.id, s.n); delete state.chests[key]; }
    if (id === FURNACE && state.furnaces[key]) { const f = state.furnaces[key]; for (const s of [f.in, f.fuel, f.out]) if (s) give(s.id, s.n); delete state.furnaces[key]; }
    const drop = BLOCK_DROP[id];
    if (info.canDrop && drop && !(id === LEAVES && Math.random() < 0.6)) give(drop, id === COAL_ORE ? rint(1, 2) : 1);
    else if (!info.canDrop && HARD[id] && HARD[id][2] && HARD[id][2] < 99) toast(HARD[id][2] >= 2 ? '⛏️ You need a stone pickaxe or better for that' : '⛏️ You need a pickaxe to collect that');
    if (id === LEAVES && Math.random() < 0.08) give('stick', 1);
    if ((id === GRASS || id === DEADGRASS || id === LEAVES) && Math.random() < 0.15) { const s = ['seeds_wheat', 'seeds_wheat', 'seeds_carrot', 'seeds_potato', 'seeds_berries'][rint(0, 4)]; give(s, 1); toast(`Found ${ITEMS[s].name}!`); }
    if (id === PUMPKIN) toast('🎃 Picked a wild pumpkin!');
  }
  particles(h.x + 0.5, h.y + 0.5, h.z + 0.5, blockCol(id), 10);
  beep(160 + Math.random() * 60, 0.07, 'square', 0.05);
  exhaust(0.005); if (heldTool()) wearTool(info.right ? 1 : 2);
}
function updateMining(dt) {
  mine.cd = Math.max(0, mine.cd - dt);
  const h = holdBreak && playing && !uiOpen && player.alive ? raycast() : null;
  if (!h || h.kind !== 'block' && h.kind !== 'crop') { mine.key = null; crackMesh.visible = false; if (h && h.kind === 'mob' && holdBreak) { attackOrSwing(); } return; }
  if (holdBreak) swing();
  if (h.kind === 'crop') { if (mine.cd <= 0) { removeCrop(h.key, true); mine.cd = 0.25; } return; }
  const key = h.x + ',' + h.y + ',' + h.z;
  if (mine.key !== key) { mine.key = key; mine.prog = 0; mine.total = breakInfo(h.id).time; mine.tick = 0; }
  if (mine.cd > 0) return;
  mine.prog += dt; mine.tick -= dt;
  if (mine.tick <= 0) { mine.tick = 0.22; beep(110 + Math.random() * 40, 0.04, 'square', 0.03); particles(h.x + 0.5 + h.n[0] * 0.5, h.y + 0.5 + h.n[1] * 0.5, h.z + 0.5 + h.n[2] * 0.5, blockCol(h.id), 2); }
  const stage = Math.min(9, Math.floor(mine.prog / mine.total * 10));
  crackMesh.visible = true; crackMesh.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); crackMesh.material.map = crackTex[stage]; crackMesh.material.needsUpdate = true;
  if (mine.prog >= mine.total) { finishBreak(h); mine.key = null; crackMesh.visible = false; mine.cd = 0.15; }
}
function eat(id) {
  if (state.food >= 20) { toast("You're not hungry"); return; }
  const f = ITEMS[id].food; state.food = Math.min(20, state.food + f); state.sat = Math.min(state.food, state.sat + f * 0.6);
  useHeld(1); player.eatT = 0.5; for (let i = 0; i < 4; i++) setTimeout(() => beep(260 + Math.random() * 80, 0.05, 'square', 0.05), i * 110);
  if (id === 'rotten_flesh' && Math.random() < 0.8) { exhaust(8); toast('🤢 That was rotten...'); }
  renderVitals();
}
function placeBlock(h, block) {
  const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
  const tgt = get(x, y, z); if (tgt !== AIR && !isWater(tgt)) return null;
  if (state.crops[x + ',' + y + ',' + z]) return null;
  const p = player.pos;
  const inside = (yy) => x + 1 > p.x - PW && x < p.x + PW && z + 1 > p.z - PW && z < p.z + PW && yy + 1 > p.y && yy < p.y + PH;
  if (solid(block) && inside(y)) return null;
  for (const v of villagers) if (Math.floor(v.g.position.x) === x && Math.floor(v.g.position.z) === z && (y === Math.floor(v.g.position.y) || y === Math.floor(v.g.position.y) + 1)) return null;
  return [x, y, z, inside];
}
function useAction() {
  if (AC && AC.state === 'suspended') AC.resume();
  if (!player.alive) return;
  const id = held(), it = id ? ITEMS[id] : null;
  // buckets look at water too
  if (id === 'bucket') {
    const w = raycast(5, true);
    if (w && w.kind === 'water') { setBlock(w.x, w.y, w.z, AIR); useHeld(1); give('water_bucket', 1); swing(); beep(300, 0.15, 'sine', 0.06); return; }
  }
  const h = raycast(); if (!h) { if (it && it.food) eat(id); return; }
  if (h.kind === 'villager') { openTrade(h.v); return; }
  if (h.kind === 'mob') { if (it && it.food) eat(id); return; }
  if (h.kind === 'block') {
    if (isDoor(h.id)) {   // open / close both halves
      const top = doorTop(h.id), oy = top ? h.y - 1 : h.y + 1, f = doorF(h.id), open = !doorOpen(h.id);
      setBlock(h.x, h.y, h.z, doorId(f, open, top), false); if (isDoor(get(h.x, oy, h.z))) setBlock(h.x, oy, h.z, doorId(f, open, !top), false);
      if (!open && collides(player.pos)) {   // never shut a door on yourself: nudge out to whichever side of the slab you're on
        const b = doorBox(doorId(f, false, false)), dx = Math.floor(player.pos.x) === h.x, dz = Math.floor(player.pos.z) === h.z;
        if (f % 2 === 1) { const mid = h.x + (b[0] + b[3]) / 2; player.pos.x = player.pos.x < mid ? h.x + b[0] - PW - 0.01 : h.x + b[3] + PW + 0.01; }
        else { const mid = h.z + (b[2] + b[5]) / 2; player.pos.z = player.pos.z < mid ? h.z + b[2] - PW - 0.01 : h.z + b[5] + PW + 0.01; }
        if (collides(player.pos)) { setBlock(h.x, h.y, h.z, doorId(f, true, top), false); if (isDoor(get(h.x, oy, h.z))) setBlock(h.x, oy, h.z, doorId(f, true, !top), false); flushDirty(); toast('Step out of the doorway first'); return; }
      }
      flushDirty();
      beep(open ? 200 : 150, 0.12, 'triangle', 0.07); swing();
      if (open && settings.jumpscares && nightAmt > 0.6 && Math.random() < 0.06 && state.gameTime - lastScare > 120) setTimeout(() => jumpscare(null, 'night'), 250);
      return;
    }
    if (h.id === CTABLE) { openInventory(true); return; }
    if (h.id === FURNACE) { openFurnace(h.x + ',' + h.y + ',' + h.z); return; }
    if (h.id === CHEST) { openChest(h.x, h.y, h.z); return; }
    if (h.id === GRAVE) { const k = h.x + ',' + h.y + ',' + h.z; setBlock(h.x, h.y, h.z, AIR); openGrave(k); return; }
  }
  if (h.kind === 'crop') {
    const c = state.crops[h.key];
    if (id === 'fertilizer') { if (cropStage(c) < 3) { useHeld(1); c.t = state.gameTime - CROPS[c.type].grow - 1; buildCrops(); toast('✨ Fully grown!'); beep(880, 0.15, 'sine', 0.08); } else toast('Already ripe!'); return; }
    if (it && it.tool && it.tool.kind === 'hoe') {   // hoes gather ripe crops and replant them
      const r = it.tool.tier === 'iron' ? 1 : 0; let got = 0;
      const [cx0, cy, cz0] = h.key.split(',').map(Number);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const k = (cx0 + dx) + ',' + cy + ',' + (cz0 + dz), cc = state.crops[k];
        if (cc && cropStage(cc) >= 3) { const type = cc.type; removeCrop(k, true); if (take('seeds_' + type, 1)) state.crops[k] = { type, t: state.gameTime }; got++; }
      }
      if (got) { buildCrops(); swing(); wearTool(1); } else toast(`${CROPS[c.type].name}: growing (${Math.min(99, Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100))}%)`);
      return;
    }
    if (cropStage(c) >= 3) removeCrop(h.key, true);
    else toast(`${CROPS[c.type].name}: growing (${Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100)}%)`);
    return;
  }
  if (!it) return;
  if (it.food && !(it.crop)) { eat(id); return; }
  if (it.tool && it.tool.kind === 'hoe') {
    if (h.id !== GRASS && h.id !== DIRT && h.id !== DEADGRASS) { toast('Use the hoe on grass or dirt'); return; }
    const r = it.tool.tier === 'iron' ? 1 : 0; let n = 0;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = h.x + dx, z = h.z + dz, b = get(x, h.y, z);
      if ((b === GRASS || b === DIRT || b === DEADGRASS) && get(x, h.y + 1, z) === AIR) { setBlock(x, h.y, z, FARM, false); n++; }
    }
    flushDirty(); if (n) { beep(300, 0.07, 'triangle', 0.07); swing(); wearTool(1); }
    return;
  }
  if (it.crop) {
    if (h.id !== FARM || h.n[1] !== 1) { toast('Plant seeds on farmland (use a hoe first)'); return; }
    const k = h.x + ',' + (h.y + 1) + ',' + h.z;
    if (state.crops[k] || get(h.x, h.y + 1, h.z) !== AIR) return;
    useHeld(1); state.crops[k] = { type: it.crop, t: state.gameTime }; buildCrops(); beep(520, 0.06, 'triangle', 0.07); swing();
    return;
  }
  if (id === 'water_bucket') {
    const pl = placeBlock(h, WATER); if (!pl) return;
    setBlock(pl[0], pl[1], pl[2], WATER); useHeld(1); give('bucket', 1); swing(); beep(240, 0.15, 'sine', 0.06); return;
  }
  if (it.door) {
    const pl = placeBlock(h, DOOR0); if (!pl) return; const [x, y, z, inside] = pl;
    if (get(x, y + 1, z) !== AIR || !solid(get(x, y - 1, z)) || inside(y) || inside(y + 1)) { toast('A door needs 2 free blocks on solid ground'); return; }
    const d = getDir(), f = Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 3 : 1) : (d.z > 0 ? 0 : 2);
    setBlock(x, y, z, doorId(f, false, false), false); setBlock(x, y + 1, z, doorId(f, false, true)); useHeld(1); swing(); beep(240, 0.05, 'square', 0.05); return;
  }
  if (it.armor) { const s = it.armor.slot, old = state.armor[s]; state.armor[s] = state.slots[state.sel]; state.slots[state.sel] = old; renderHotbar(); renderVitals(); toast(`Equipped ${it.name}`); return; }
  if (it.block != null) {
    const pl = placeBlock(h, it.block); if (!pl) return;
    setBlock(pl[0], pl[1], pl[2], it.block); useHeld(1); swing(); beep(240, 0.05, 'square', 0.05);
    return;
  }
  if (it.food) { eat(id); return; }
  if (id === 'fertilizer') toast('Use fertilizer on a growing crop');
  else if (!it.tool) toast(`Sell ${it.name} to a villager`);
}
function openGrave(key) {
  const items = state.graves[key] || []; delete state.graves[key];
  for (const s of items) { if (ITEMS[s.id].armor && !state.armor[ITEMS[s.id].armor.slot]) state.armor[ITEMS[s.id].armor.slot] = s; else { const left = give(s.id, s.n); if (!left && ITEMS[s.id].tool) { /* keep durability on recovered tools */ const t = state.slots.find(x => x && x.id === s.id && x.d === TIERS[ITEMS[s.id].tool.tier].dur); if (t) t.d = s.d; } } }
  toast('🪦 You recovered your things'); renderHotbar(); renderVitals();
}

// ================== ECONOMY ==================
const day = () => Math.floor(state.time / DAY) + 1;
function priceMult(id) { return 0.8 + hash2(day(), id.length * 31 + id.charCodeAt(0) * 7 + id.charCodeAt(id.length - 1), 99) * 0.5; }
function sellPrice(base, id) { return Math.max(1, Math.round(base * priceMult(id))); }
function rank() { let r = RANKS[0]; for (const x of RANKS) if (state.earned >= x[0]) r = x; return r; }
function nextRank() { return RANKS.find(x => x[0] > state.earned); }

// ================== HUD ==================
function slotHTML(s, attrs, sel) {
  const it = s && ITEMS[s.id];
  const dur = it && it.tool && s.d < TIERS[it.tool.tier].dur ? `<span class="dur"><i style="width:${Math.round(s.d / TIERS[it.tool.tier].dur * 100)}%;background:hsl(${Math.round(s.d / TIERS[it.tool.tier].dur * 120)},90%,50%)"></i></span>` : '';
  return `<div class="slot ${sel ? 'sel' : ''}" ${attrs}>${it ? iconHTML(s.id) : ''}${it && it.tag ? `<span class="t">${it.tag}</span>` : ''}${it && s.n > 1 ? `<span class="n">${s.n}</span>` : ''}${dur}</div>`;
}
function renderHotbar() {
  document.getElementById('hotbar').innerHTML = state.slots.slice(0, 9).map((s, i) => slotHTML(s, `data-i="${i}"`, i === state.sel)).join('');
  const s = state.slots[state.sel]; document.getElementById('heldName').textContent = s ? ITEMS[s.id].name : '';
  document.getElementById('heldName').classList.remove('fade'); void document.getElementById('heldName').offsetWidth; document.getElementById('heldName').classList.add('fade');
  if (uiOpen && invOpen) renderInventory();
}
document.getElementById('hotbar').addEventListener('pointerdown', e => {
  const s = e.target.closest('.slot'); if (!s) return; e.stopPropagation(); state.sel = +s.dataset.i; renderHotbar();
});
// hearts, hunger, armour and air drawn as pixel art like Minecraft
const vit = document.getElementById('vitals'), vctx = vit.getContext('2d');
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const DRUM = ['...##', '..###', '.####', '###..', '##...', '#....'];
const SHIELD = ['#######', '#######', '#######', '.#####.', '..###..', '...#...'];
function pix(tmpl, ox, oy, full, half, empty, s = 2) { tmpl.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '#') return; vctx.fillStyle = full === null ? empty : half && x >= row.length / 2 ? empty : full; vctx.fillRect(ox + x * s, oy + y * s, s, s); })); }
function renderVitals() {
  vctx.clearRect(0, 0, vit.width, vit.height);
  const ap = armorPoints();
  for (let i = 0; i < 10; i++) {
    if (ap > 0) { const v = ap - i * 2; pix(SHIELD, i * 17, 0, v >= 2 ? '#cfd8e8' : v === 1 ? '#cfd8e8' : null, v === 1, 'rgba(0,0,0,.45)'); }
    const hv = state.hp - i * 2; pix(HEART, i * 17, 16, hv >= 2 ? '#ff2a2a' : hv === 1 ? '#ff2a2a' : null, hv === 1, 'rgba(0,0,0,.5)');
    const fv = state.food - (9 - i) * 2; pix(DRUM, 196 + i * 17, 16, fv >= 2 ? '#c7782a' : fv === 1 ? '#c7782a' : null, fv === 1, 'rgba(0,0,0,.5)');
  }
  if (player.air < 15) for (let i = 0; i < Math.ceil(player.air / 1.5); i++) { vctx.fillStyle = '#7fd4ff'; vctx.beginPath(); vctx.arc(203 + (9 - i) * 17 + 6, 6, 5, 0, 7); vctx.fill(); }
}
function renderStats() {
  const r = rank(), nr = nextRank(), night = isNight();
  document.getElementById('stats').innerHTML =
    `💰 <b>${state.coins}</b> coins<br>🏆 ${r[1]}${nr ? ` <span style="opacity:.7;font-size:12px">(${nr[0] - state.earned} to ${nr[1]})</span>` : ''}<br>${night ? '🌙' : '☀️'} Day ${day()}${player.sprint ? ' · 🏃' : ''}`;
}

// ================== PANELS ==================
let invOpen = false, bigCraft = false, cursor = null, oneMode = false, furnaceKey = null, chestKeys = null;
const grid = emptySlots(9);
function closePanels() {
  if (invOpen) { for (let i = 0; i < 9; i++) if (grid[i]) { give(grid[i].id, grid[i].n); grid[i] = null; } }
  if (cursor) { const left = give(cursor.id, cursor.n); cursor = null; }
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('show')); uiOpen = false; invOpen = false; furnaceKey = null; chestKeys = null; holdBreak = false;
  if (!isTouch && playing && player.alive) canvas.requestPointerLock();
}
function openPanel(id) { uiOpen = true; holdBreak = false; if (document.pointerLockElement) document.exitPointerLock(); document.getElementById(id).classList.add('show'); }

// --- crafting grid matching (shaped recipes can sit anywhere in the grid and may be mirrored) ---
function gridMatch(cells, w) {
  const h = cells.length / w; let minX = w, minY = h, maxX = -1, maxY = -1;
  cells.forEach((c, i) => { if (c) { const x = i % w, y = Math.floor(i / w); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } });
  if (maxX < 0) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1, at = (x, y) => { const c = cells[(minY + y) * w + minX + x]; return c ? c.id : null; };
  const present = cells.filter(Boolean).map(c => c.id).sort();
  for (const r of RECIPES) {
    if (r.items) { const need = [...r.items].sort(); if (need.length === present.length && need.every((v, i) => v === present[i])) return r; continue; }
    if (r.rows.length !== bh || r.rows[0].length !== bw) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < bh && ok; y++) for (let x = 0; x < bw && ok; x++) { const ch = r.rows[y][mirror ? bw - 1 - x : x], want = ch === '.' ? null : r.key[ch]; if (want !== at(x, y)) ok = false; }
      if (ok) return r;
    }
  }
  return null;
}
const gridW = () => bigCraft ? 3 : 2;
const gridCells = () => { const w = gridW(); const out = []; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) out.push(grid[y * 3 + x]); return out; };
function craftResult() { return gridMatch(gridCells(), gridW()); }
function takeCraft() {
  const r = craftResult(); if (!r) return;
  if (cursor && (cursor.id !== r.out || cursor.n + r.n > stackOf(r.out))) return;
  const w = gridW(); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const i = y * 3 + x; if (grid[i]) { grid[i].n--; if (grid[i].n <= 0) grid[i] = null; } }
  if (cursor) cursor.n += r.n; else cursor = newStack(r.out, r.n);
  beep(700, 0.08, 'triangle', 0.08);
}
// fill the grid from a recipe in the recipe book (like Minecraft's recipe book)
function autoFill(ri) {
  const r = RECIPES[ri];
  for (let i = 0; i < 9; i++) if (grid[i]) { give(grid[i].id, grid[i].n); grid[i] = null; }
  let cells;
  if (r.items) cells = r.items.map((id, i) => [i % gridW(), Math.floor(i / gridW()), id]);
  else { cells = []; r.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.push([x, y, r.key[ch]]); })); }
  const need = {}; for (const c of cells) need[c[2]] = (need[c[2]] || 0) + 1;
  if (!Object.entries(need).every(([k, v]) => count(k) >= v)) { toast('Not enough materials'); return; }
  for (const [x, y, id] of cells) { take(id, 1); grid[y * 3 + x] = newStack(id, 1); }
}
function canMake(r) {
  const need = {}; if (r.items) r.items.forEach(id => need[id] = (need[id] || 0) + 1); else r.rows.forEach(row => [...row].forEach(ch => { if (ch !== '.') need[r.key[ch]] = (need[r.key[ch]] || 0) + 1; }));
  return Object.entries(need).every(([k, v]) => count(k) + grid.filter(g => g && g.id === k).reduce((a, g) => a + g.n, 0) >= v);
}
const fits = r => r.items ? r.items.length <= gridW() * gridW() : r.rows.length <= gridW() && r.rows[0].length <= gridW();

// generic slot clicking: whole stack or one item, swap, merge (works on touch and mouse)
function slotRef(c, i) {
  if (c === 'inv') return [state.slots, i]; if (c === 'grid') return [grid, i]; if (c === 'armor') return [state.armor, i];
  if (c === 'chest') { const key = chestKeys[Math.floor(i / 27)]; return [state.chests[key], i % 27]; }
  if (c === 'fur') { const f = state.furnaces[furnaceKey]; return [f, ['in', 'fuel', 'out'][i]]; }
}
function clickSlot(c, i, one) {
  const [arr, k] = slotRef(c, i), s = arr[k];
  if (c === 'armor' && cursor && !(ITEMS[cursor.id].armor && ITEMS[cursor.id].armor.slot === i)) return;
  if (c === 'fur' && k === 'out' && cursor) { if (s && cursor.id === s.id && cursor.n + s.n <= stackOf(s.id)) { cursor.n += s.n; arr[k] = null; } return; }
  if (c === 'fur' && k === 'fuel' && cursor && !FUEL[cursor.id]) return;
  if (!cursor) { if (!s) return; if (one && s.n > 1) { const h = Math.ceil(s.n / 2); cursor = { ...s, n: h }; s.n -= h; } else { cursor = s; arr[k] = null; } return; }
  if (!s) { if (one && cursor.n > 1) { arr[k] = { ...cursor, n: 1 }; cursor.n--; } else { arr[k] = cursor; cursor = null; } return; }
  if (s.id === cursor.id && stackOf(s.id) > 1) { const room = stackOf(s.id) - s.n, mv = Math.min(room, one ? 1 : cursor.n); s.n += mv; cursor.n -= mv; if (cursor.n <= 0) cursor = null; return; }
  arr[k] = cursor; cursor = s;
}
function cursorBar() { return `<div class="cursor">${cursor ? `Holding: ${iconHTML(cursor.id)} <b>${cursor.n > 1 ? cursor.n + '× ' : ''}${ITEMS[cursor.id].name}</b> <span style="opacity:.7">· tap a slot to drop it</span>` : '<span style="opacity:.7">Tap an item to pick it up, then tap a slot to put it down.</span>'}</div>`; }
function invGridHTML() {
  let h = `<h3>Inventory</h3><div class="sgrid">`;
  for (let i = 9; i < 36; i++) h += slotHTML(state.slots[i], `data-c="inv" data-i="${i}"`);
  h += `</div><div class="sgrid hb">`;
  for (let i = 0; i < 9; i++) h += slotHTML(state.slots[i], `data-c="inv" data-i="${i}"`, i === state.sel);
  return h + '</div>';
}
function openInventory(table) { bigCraft = table; invOpen = true; renderInventory(); openPanel('bag'); if (table) beep(420, 0.05, 'triangle', 0.06); }
function renderInventory() {
  const r = craftResult(), w = gridW();
  let h = `<button class="btn close" data-a="close">✕</button><h2>${bigCraft ? '🪵 Crafting Table' : '🎒 Inventory'}</h2>${cursorBar()}
  <div class="top"><div class="armorcol">${state.armor.map((s, i) => s ? slotHTML(s, `data-c="armor" data-i="${i}"`) : `<div class="slot ghost" data-c="armor" data-i="${i}">${['⛑️', '👕', '👖', '🥾'][i]}</div>`).join('')}<div class="ap">🛡️ ${armorPoints()}</div></div>
  <div class="craft"><div class="cgrid g${w}">`;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) h += slotHTML(grid[y * 3 + x], `data-c="grid" data-i="${y * 3 + x}"`);
  h += `</div><div class="arrow">➜</div>${r ? slotHTML(newStack(r.out, r.n), 'data-a="out"') : '<div class="slot" data-a="out"></div>'}</div>
  <div class="modes"><button class="btn ${oneMode ? '' : 'gold'}" data-a="mode">${oneMode ? 'Move: half / 1' : 'Move: whole stack'}</button><button class="btn" data-a="book">📖 Recipes</button></div></div>`;
  h += invGridHTML();
  if (!bigCraft) h += `<div style="font-size:12px;opacity:.7;margin-top:8px">2×2 crafting here. Use a 🪵 Crafting Table (4 planks) for 3×3 recipes like tools, doors and armour.</div>`;
  h += `<div id="book" style="display:${showBook ? 'block' : 'none'}"><h3>Recipe book (tap to fill the grid)</h3>${RECIPES.map((rc, i) => fits(rc) || bigCraft ? `<div class="row recipe ${canMake(rc) ? '' : 'dim'}" data-a="fill" data-r="${i}"><span class="ic">${iconHTML(rc.out)}</span><span class="nm">${rc.n > 1 ? rc.n + '× ' : ''}${ITEMS[rc.out].name}<br><span style="font-size:11px;opacity:.75">${recipeText(rc)}</span></span></div>` : '').join('')}</div>`;
  h += `<h3>Game</h3><div class="row"><span class="nm">Start a brand new world (deletes this save)</span><button class="btn" data-a="reset">New world</button></div>`;
  document.getElementById('bagBox').innerHTML = h;
}
let showBook = false;
function recipeText(r) { if (r.items) { const c = {}; r.items.forEach(i => c[i] = (c[i] || 0) + 1); return Object.entries(c).map(([k, v]) => `${v}× ${ITEMS[k].name}`).join(' + ') + ' (any shape)'; } return r.rows.map(row => [...row].map(ch => ch === '.' ? '·' : ch).join('')).join(' / ') + ' — ' + Object.entries(r.key).map(([k, v]) => `${k}=${ITEMS[v].name}`).join(', '); }
document.getElementById('bagBox').addEventListener('click', e => {
  const b = e.target.closest('[data-a],[data-c]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'close') { closePanels(); return; }
  if (b.dataset.c) clickSlot(b.dataset.c, +b.dataset.i, oneMode);
  if (a === 'out') takeCraft();
  if (a === 'mode') oneMode = !oneMode;
  if (a === 'book') showBook = !showBook;
  if (a === 'fill') autoFill(+b.dataset.r);
  if (a === 'reset') { if (confirm('Start a new world? Your current farm and coins will be lost.')) { saveBlocked = true; localStorage.removeItem(SAVE_KEY); location.reload(); } return; }
  renderInventory(); renderHotbar();
});
document.getElementById('bagBox').addEventListener('contextmenu', e => { const b = e.target.closest('[data-c]'); if (!b) return; e.preventDefault(); clickSlot(b.dataset.c, +b.dataset.i, true); renderInventory(); renderHotbar(); });

// --- chests: two chests side by side join into one big chest ---
function openChest(x, y, z) {
  const keys = [x + ',' + y + ',' + z];
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (get(x + dx, y, z + dz) === CHEST) { const k2 = (x + dx) + ',' + y + ',' + (z + dz); if (dx < 0 || dz < 0) keys.unshift(k2); else keys.push(k2); break; }
  for (const k of keys) if (!state.chests[k]) state.chests[k] = Array(27).fill(null);
  chestKeys = keys; furnaceKey = null; invOpen = false; renderChest(); openPanel('trade'); beep(180, 0.1, 'triangle', 0.06);
}
function renderChest() {
  let cells = '';
  chestKeys.forEach((k, ci) => state.chests[k].forEach((s, i) => cells += slotHTML(s, `data-c="chest" data-i="${ci * 27 + i}"`)));
  document.getElementById('tradeBox').innerHTML = `<button class="btn close" data-a="close">✕</button><h2>📦 ${chestKeys.length > 1 ? 'Large Chest' : 'Chest'}</h2>${cursorBar()}
  <div class="sgrid">${cells}</div>
  <div class="modes" style="margin-top:6px"><button class="btn ${oneMode ? '' : 'gold'}" data-a="mode">${oneMode ? 'Move: half / 1' : 'Move: whole stack'}</button></div>` + invGridHTML();
}
// --- furnace ---
function openFurnace(key) { if (!state.furnaces[key]) state.furnaces[key] = { in: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0 }; furnaceKey = key; invOpen = false; renderFurnace(); openPanel('trade'); }
function renderFurnace() {
  const f = state.furnaces[furnaceKey]; if (!f) return;
  let h = `<button class="btn close" data-a="close">✕</button><h2>🔥 Furnace</h2>${cursorBar()}
  <div class="furn"><div>${slotHTML(f.in, 'data-c="fur" data-i="0"')}<div class="flame"><i style="height:${f.burnMax ? Math.round(f.burn / f.burnMax * 100) : 0}%"></i></div>${slotHTML(f.fuel, 'data-c="fur" data-i="1"')}</div>
  <div class="prog"><i style="width:${Math.round(f.prog / 3 * 100)}%"></i></div>${slotHTML(f.out, 'data-c="fur" data-i="2"')}</div>
  <div style="font-size:12px;opacity:.75">Top: thing to smelt (iron ore, raw beef, sand, cobblestone, potato, log). Bottom: fuel (coal, logs, planks, sticks).</div>
  <div class="modes"><button class="btn ${oneMode ? '' : 'gold'}" data-a="mode">${oneMode ? 'Move: half / 1' : 'Move: whole stack'}</button></div>` + invGridHTML();
  document.getElementById('tradeBox').innerHTML = h;
}
function updateFurnaces(dt) {
  for (const k in state.furnaces) {
    const f = state.furnaces[k], out = f.in && SMELT[f.in.id];
    const canSmelt = out && (!f.out || (f.out.id === out && f.out.n < stackOf(out)));
    if (f.burn <= 0 && canSmelt && f.fuel) { f.burnMax = f.burn = FUEL[f.fuel.id] * 3; f.fuel.n--; if (f.fuel.n <= 0) f.fuel = f.fuel.id === 'water_bucket' ? null : null; }
    if (f.burn > 0) { f.burn -= dt; if (canSmelt) { f.prog += dt; if (f.prog >= 3) { f.prog = 0; f.in.n--; if (f.in.n <= 0) f.in = null; if (f.out) f.out.n++; else f.out = newStack(out, 1); } } else f.prog = 0; }
    else f.prog = Math.max(0, f.prog - dt);
  }
  if (furnaceKey && uiOpen) { furnT -= dt; if (furnT <= 0) { furnT = 0.25; renderFurnace(); } }
}
let furnT = 0;

// --- trading ---
let tradeV = null;
function openTrade(v) { tradeV = v; furnaceKey = null; renderTrade(); openPanel('trade'); beep(500, 0.06, 'sine', 0.06); }
function renderTrade() {
  const v = tradeV;
  let h = `<button class="btn close" data-a="close">✕</button><h2>${v.name}</h2><div style="font-size:13px;opacity:.8">${v.job} · Day ${day()} prices · You have 💰 ${state.coins}</div>`;
  if (Object.keys(v.buys).length) {
    h += `<h3>I'll buy from you</h3>`;
    for (const [k, base] of Object.entries(v.buys)) {
      const p = sellPrice(base, k), have = count(k), m = priceMult(k);
      const trend = m > 1.08 ? '<span class="up">▲ hot</span>' : m < 0.92 ? '<span class="down">▼ low</span>' : '';
      h += `<div class="row"><span class="ic">${iconHTML(k)}</span><span class="nm">${ITEMS[k].name} <span style="opacity:.7">(have ${have})</span> ${trend}</span><span class="pr">💰 ${p}</span><button class="btn" data-a="sell" data-k="${k}" data-n="1" ${have ? '' : 'disabled'}>Sell 1</button><button class="btn gold" data-a="sell" data-k="${k}" data-n="all" ${have ? '' : 'disabled'}>All</button></div>`;
    }
  }
  if (Object.keys(v.sells).length) {
    h += `<h3>I'll sell to you</h3>`;
    for (const [k, p] of Object.entries(v.sells)) {
      const single = stackOf(k) === 1;
      h += `<div class="row"><span class="ic">${iconHTML(k)}</span><span class="nm">${ITEMS[k].name}</span><span class="pr">💰 ${p}</span><button class="btn" data-a="buy" data-k="${k}" data-n="1" ${state.coins >= p ? '' : 'disabled'}>Buy</button>${single ? '' : `<button class="btn gold" data-a="buy" data-k="${k}" data-n="5" ${state.coins >= p * 5 ? '' : 'disabled'}>×5</button>`}</div>`;
    }
  }
  document.getElementById('tradeBox').innerHTML = h;
}
document.getElementById('tradeBox').addEventListener('click', e => {
  const b = e.target.closest('[data-a],[data-c]'); if (!b) return;
  const a = b.dataset.a, k = b.dataset.k;
  if (a === 'close') { closePanels(); return; }
  if (chestKeys) { if (b.dataset.c) clickSlot(b.dataset.c, +b.dataset.i, oneMode); if (a === 'mode') oneMode = !oneMode; renderChest(); renderHotbar(); return; }
  if (furnaceKey) { if (b.dataset.c) clickSlot(b.dataset.c, +b.dataset.i, oneMode); if (a === 'mode') oneMode = !oneMode; renderFurnace(); renderHotbar(); return; }
  if (a === 'sell') {
    const have = count(k), n = b.dataset.n === 'all' ? have : 1; if (!n) return;
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
document.getElementById('tradeBox').addEventListener('contextmenu', e => { const b = e.target.closest('[data-c]'); if (!b || !(furnaceKey || chestKeys)) return; e.preventDefault(); clickSlot(b.dataset.c, +b.dataset.i, true); if (chestKeys) renderChest(); else renderFurnace(); renderHotbar(); });
for (const id of ['bag', 'trade', 'settings']) document.getElementById(id).addEventListener('pointerdown', e => { if (e.target.id === id) closePanels(); });

// --- settings ---
function openSettings() { renderSettings(); openPanel('settings'); }
function renderSettings() {
  const tog = (k, label, sub) => `<div class="row"><span class="nm">${label}<br><span style="font-size:12px;opacity:.7">${sub}</span></span><button class="btn ${settings[k] ? 'gold' : ''}" data-s="${k}">${settings[k] ? 'ON' : 'OFF'}</button></div>`;
  document.getElementById('setBox').innerHTML = `<button class="btn close" data-a="close">✕</button><h2>⚙️ Settings</h2>
    ${tog('jumpscares', '😱 Jumpscares', 'Five Nights at Freddy\'s style scares at night and when you die')}
    ${tog('sound', '🔊 Sound', 'Music, ambience and sound effects')}
    <div class="row" style="flex-wrap:wrap"><span class="nm">⚔️ Difficulty<br><span style="font-size:12px;opacity:.7">${diff().sub}</span></span>${Object.entries(DIFFS).map(([k, v]) => `<button class="btn ${settings.difficulty === k ? 'gold' : ''}" data-diff="${k}">${v.label}</button>`).join('')}</div>
    <div class="row"><span class="nm">🎮 Look sensitivity</span><button class="btn" data-sens="-1">−</button><b style="min-width:40px;text-align:center">${settings.sens.toFixed(1)}</b><button class="btn" data-sens="1">+</button></div>
    <div class="row"><span class="nm">Test a jumpscare</span><button class="btn" data-a="test" ${settings.jumpscares ? '' : 'disabled'}>Scare me</button></div>`;
}
document.getElementById('setBox').addEventListener('click', e => {
  const b = e.target.closest('[data-s],[data-a],[data-sens],[data-diff]'); if (!b) return;
  if (b.dataset.diff) settings.difficulty = b.dataset.diff;
  if (b.dataset.a === 'close') { closePanels(); return; }
  if (b.dataset.a === 'test') { closePanels(); setTimeout(() => jumpscare(null, 'night'), 300); return; }
  if (b.dataset.sens) settings.sens = Math.max(0.3, Math.min(3, settings.sens + (+b.dataset.sens) * 0.1));
  if (b.dataset.s) { settings[b.dataset.s] = !settings[b.dataset.s]; if (b.dataset.s === 'sound' && master) master.gain.value = settings.sound ? 1 : 0; }
  saveSettings(); renderSettings();
});

const helpPC = 'WASD move · Space jump · Double-tap W (or Ctrl) to sprint · Mouse look<br>Hold left click: mine / attack · Right click: use, plant, place, open doors, trade<br>E: inventory & crafting · 1-9 / wheel: hotbar';
const helpTouch = 'Left stick: move · Double-tap the screen while walking (or 🏃) to sprint · Drag right side: look<br>Hold ⛏️ mine / attack · ✋ use, plant, place, open doors, trade · ⬆️ jump<br>🎒 inventory & crafting · ⚙️ settings';
document.getElementById('helpText').innerHTML = (isTouch ? helpTouch : helpPC) + '<br><br>🪓 Punch trees for logs, craft planks, sticks and a crafting table, then make a hatchet, pickaxe and hoe. Mine cobblestone and iron to upgrade, kill cows for steak and leather armour, and survive the night: zombies, skeletons and creepers come out after dark. 🎃 Grow crops and sell to the villagers to become a Tycoon.';
function showStart() { if (playing) save(); renderWorlds(); playing = false; closePanels(); if (document.pointerLockElement) document.exitPointerLock(); document.getElementById('start').style.display = 'flex'; document.body.classList.add('menu'); }
// --- main menu: pick one of several worlds ---
function slotInfo(n) { try { const s = JSON.parse(localStorage.getItem(slotKey(n))); if (s && s.seed != null) return s; } catch (e) {} return null; }
function renderWorlds() {
  let h = '';
  for (let n = 1; n <= SLOTS; n++) {
    const s = n === SLOT ? state : slotInfo(n), cur = n === SLOT;
    const info = s && (n !== SLOT || !freshGame || s._welcomed) ? `Day ${Math.floor((s.time || 0) / DAY) + 1} · 💰 ${s.coins}` : 'Empty: new world';
    h += `<div class="wslot ${cur ? 'cur' : ''}" data-w="${n}"><b>🌍 World ${n}</b><span>${info}</span>${cur ? '<i>▶ selected</i>' : ''}${s && (n !== SLOT || !freshGame || s._welcomed) ? `<button class="btn" data-del="${n}">🗑</button>` : ''}</div>`;
  }
  document.getElementById('worlds').innerHTML = h;
}
document.getElementById('worlds').addEventListener('click', e => {
  e.stopPropagation();
  if (e.target.closest('[data-del]')) return;
  const w = e.target.closest('[data-w]'); if (!w || +w.dataset.w === SLOT) return;
  save(); localStorage.setItem('dealercraft_slot', w.dataset.w); saveBlocked = true; location.reload();
});
// hold the trash button for a second, then confirm, to delete a world
let delHold = null;
const endHold = () => { if (delHold) { clearTimeout(delHold.t); delHold.b.classList.remove('holding'); delHold = null; } };
document.getElementById('worlds').addEventListener('pointerdown', e => {
  const del = e.target.closest('[data-del]'); if (!del) return; e.stopPropagation(); endHold();
  del.classList.add('holding');
  delHold = { b: del, t: setTimeout(() => { const n = +del.dataset.del; endHold(); deleteWorld(n); }, 1000) };
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => document.getElementById('worlds').addEventListener(ev, endHold));
document.getElementById('worlds').addEventListener('contextmenu', e => e.preventDefault());
function deleteWorld(n) {   // our own confirm box (Android WebView can swallow confirm())
  const box = document.createElement('div'); box.className = 'wconfirm';
  box.innerHTML = `<div>Delete <b>World ${n}</b>?<br><span style="font-size:12px;opacity:.75">This can't be undone.</span></div><button class="btn" data-no>Cancel</button><button class="btn" data-yes style="background:#c22">Delete</button>`;
  box.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('[data-yes]')) reallyDelete(n); box.remove(); });
  document.getElementById('start').appendChild(box);
}
function reallyDelete(n) {
  { { if (n === SLOT) { saveBlocked = true; localStorage.removeItem(slotKey(n)); location.reload(); } else { localStorage.removeItem(slotKey(n)); renderWorlds(); } } }
}
renderWorlds();
document.getElementById('playBtn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('start').style.display = 'none'; document.body.classList.remove('menu'); playing = true;
  if (AC && AC.state === 'suspended') AC.resume();
  startAmbience();
  if (!isTouch) canvas.requestPointerLock();
  if (freshGame && !state._welcomed) { state._welcomed = true; setTimeout(() => toast('🎃 Welcome! Punch a tree, then open 🎒 to craft. Survive the night!'), 400); }
});
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && playing && !uiOpen && !isTouch && player.alive && !scaring) showStart(); });

// ================== SOUNDS ==================
let ambStarted = false;
function startAmbience() {
  if (!AC || ambStarted) return; ambStarted = true;
  try {
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const dg = AC.createGain(); dg.gain.value = 0.02; lp.connect(dg).connect(master);
    for (const f of [55, 82.4, 110.6]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 12; o.connect(lp); o.start(); }
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency); lfo.start();
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const n = AC.createBufferSource(); n.buffer = buf; n.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
    const wg = AC.createGain(); wg.gain.value = 0.012; n.connect(bp).connect(wg).connect(master); n.start();
    const wl = AC.createOscillator(), wlg = AC.createGain(); wl.frequency.value = 0.11; wlg.gain.value = 0.01; wl.connect(wlg).connect(wg.gain); wl.start();
  } catch (e) {}
}
function sweep(f0, f1, dur, type, vol) { if (!AC) return; try { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, AC.currentTime); o.frequency.exponentialRampToValueAtTime(f1, AC.currentTime + dur); g.gain.setValueAtTime(vol, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(g).connect(master); o.start(); o.stop(AC.currentTime + dur); } catch (e) {} }
function noiseBurst(dur, vol, freq = 800) { if (!AC) return; try { const b = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / c.length); const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = AC.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(master); s.start(); } catch (e) {} }
const owl = () => { beep(420, 0.25, 'sine', 0.05); setTimeout(() => beep(370, 0.45, 'sine', 0.05), 380); };
const booSnd = () => sweep(600, 180, 0.8, 'triangle', 0.08);
const hurtSnd = () => { sweep(320, 140, 0.18, 'square', 0.08); noiseBurst(0.1, 0.1, 1200); };
const hitSnd = () => { noiseBurst(0.08, 0.12, 2000); sweep(200, 90, 0.1, 'square', 0.05); };
const boomSnd = () => { noiseBurst(1.2, 0.5, 400); sweep(120, 30, 1, 'sine', 0.3); };
const hissSnd = () => noiseBurst(1.4, 0.08, 5000);
function screamSnd() {
  if (!AC) return; try {
    const t = AC.currentTime, g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.04); g.gain.setValueAtTime(0.4, t + 1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    const ws = AC.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); } ws.curve = curve;
    ws.connect(g).connect(master);
    for (const [f, d] of [[900, 0], [1340, 14], [610, -9]]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.6, t + 1.3); o.detune.value = d; const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 38; lg.gain.value = f * 0.08; lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 1.35); o.connect(ws); o.start(t); o.stop(t + 1.35); }
    noiseBurst(1.3, 0.35, 4000);
  } catch (e) {}
}

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
  const under = headInWater();
  scene.fog.near = under ? 1 : 12 + light * 16; scene.fog.far = under ? 14 : 46 + light * 20;
  if (under) scene.fog.color.setRGB(0.05, 0.12, 0.35);
  ambient.color.copy(ambNight).lerp(ambDay, light); ambient.intensity = 0.4 + light * 0.3;
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
let last = performance.now(), cropTick = 0, saveTick = 0, statTick = 0, owlT = 25, waterT = 0, scareT = 150 + Math.random() * 200;
function updatePlayer(dt) {
  let fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
  const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  if (player.sprint && (fwd <= 0.2 || state.food <= 6)) player.sprint = false;
  const water = inWater();
  const sp = (player.sprint ? 6.4 : 4.3) * (water ? 0.55 : 1);
  const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw);
  let mx = -sn * fwd + cs * str, mz = -cs * fwd - sn * str; const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  const p = player.pos;
  if (player.kb > 0) { player.kb -= dt; player.vel.x *= 0.92; player.vel.z *= 0.92; }
  else { player.vel.x = mx * sp; player.vel.z = mz * sp; }
  if (!data.has(ckey(fdiv(Math.floor(p.x + mx), CH), fdiv(Math.floor(p.z + mz), CH)))) { player.vel.x = 0; player.vel.z = 0; }
  if (water) { player.vel.y -= 9 * dt; player.vel.y = Math.max(player.vel.y, -2.5); if (keys.Space || wantJump) player.vel.y = 3.2; player.fallStart = null; }
  else { player.vel.y -= 26 * dt; if ((keys.Space || wantJump) && player.onGround) { player.vel.y = 8.4; exhaust(player.sprint ? 0.2 : 0.05); } }
  player.vel.y = Math.max(player.vel.y, -40);
  const ox = p.x, oz = p.z;
  for (const ax of ['x', 'z']) {
    const old = p[ax]; p[ax] += player.vel[ax] * dt;
    if (collides(p)) {
      p[ax] = old;
      if (isTouch && player.onGround && m > 0.3) { p.y += 1.05; if (!collides(p)) player.vel.y = 8.4; p.y -= 1.05; }
    }
  }
  if (player.sprint) exhaust(Math.hypot(p.x - ox, p.z - oz) * 0.1);
  const oy = p.y; p.y += player.vel.y * dt; const wasGround = player.onGround; player.onGround = false;
  if (collides(p)) { if (player.vel.y < 0) { p.y = Math.floor(oy + 0.001); if (collides(p)) p.y = oy; player.onGround = true; } else p.y = oy; player.vel.y = 0; }
  // fall damage (more than 3 blocks), cancelled by landing in water
  if (!player.onGround && !water) { if (player.fallStart === null || p.y > player.fallStart) player.fallStart = p.y; }
  if (player.onGround && player.fallStart !== null) { const fall = player.fallStart - p.y; player.fallStart = null; if (fall > 3.4) damage(Math.floor(fall - 3), 'fall'); }
  if (p.y < -10) { p.set(VX + 0.5, G + 2, VZ - 4.5); player.vel.set(0, 0, 0); player.fallStart = null; }
  camera.position.set(p.x, p.y + EYE, p.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  const fov = player.sprint ? 85 : 75; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
  return m > 0.1;
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
    if (ny > g.position.y + 1.1 || isWater(get(Math.floor(nx), ny, Math.floor(nz))) || isWater(get(Math.floor(nx), ny - 1, Math.floor(nz)))) { v.target = null; v.wait = 1; continue; }
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
    if (playing && !uiOpen && player.alive && pd < 1.4 && Math.abs(player.pos.y + 1 - g.position.y) < 2 && gh.cd <= 0) {
      const n = rint(1, 3); give('candy', n); gh.cd = 3; placeGhost(gh, true);
      if (settings.jumpscares && nightAmt > 0.6 && Math.random() < 0.3 && state.gameTime - lastScare > 60) jumpscare(() => toast(`👻 ...it dropped ${n} 🍬 Ghost Candy`), 'night');
      else { booSnd(); toast(`👻 BOO! The ghost fled and dropped ${n} 🍬 Ghost Candy`); }
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
  // the occasional night-time jumpscare when you're out in the dark, away from the village lights
  if (playing && !uiOpen && player.alive && settings.jumpscares && nightAmt > 0.7 && Math.hypot(player.pos.x - VX, player.pos.z - VZ) > SAFE_R) {
    scareT -= dt; if (scareT <= 0 && state.gameTime - lastScare > 180) { scareT = 200 + Math.random() * 300; jumpscare(null, Math.random() < 0.5 ? 'night' : 'zombie'); }
  }
}
function updateTarget() {
  const h = raycast(), el = document.getElementById('target');
  if (h && (h.kind === 'block' || h.kind === 'crop')) { highlight.visible = true; highlight.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); }
  else highlight.visible = false;
  let txt = '';
  if (h && h.kind === 'villager') txt = `✋ Trade with ${h.v.name}`;
  else if (h && h.kind === 'mob') txt = h.m.type === 'cow' ? '🐄 Cow' : `⚔️ ${h.m.type[0].toUpperCase() + h.m.type.slice(1)}`;
  else if (h && h.kind === 'crop') { const c = state.crops[h.key]; const pct = Math.min(100, Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100)); txt = `${CROPS[c.type].name}: ${pct >= 100 ? 'RIPE! use a hoe to gather' : pct + '%'}`; }
  else if (h && h.kind === 'block') {
    if (h.id === PUMPKIN) txt = '🎃 Wild Pumpkin'; else if (isDoor(h.id)) txt = '🚪 ✋ open / close'; else if (h.id === CTABLE) txt = '🪵 ✋ Crafting Table'; else if (h.id === CHEST) txt = '📦 ✋ Chest'; else if (h.id === FURNACE) txt = '🔥 ✋ Furnace'; else if (h.id === GRAVE) txt = '🪦 ✋ get your things back';
    else if (h.id === IRON_ORE) txt = 'Iron Ore (stone pickaxe)'; else if (h.id === COAL_ORE) txt = 'Coal Ore';
  }
  el.style.display = txt ? 'block' : 'none'; el.textContent = txt;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  streamChunks(2, 2);
  let moving = false;
  if (playing && !uiOpen && player.alive && !scaring) moving = updatePlayer(dt);
  else { camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); }
  updateMining(dt);
  if (playing) { state.time += dt; state.gameTime += dt; updateVitals(dt); }
  if (!playing) player.yaw += dt * 0.05; // slow pan on title
  waterT += dt; if (waterT > 0.25) { waterT = 0; waterTick(); flushDirty(); }
  updateVillagers(dt); updateSpooks(dt, now / 1000); if (playing) updateMobs(dt, now / 1000); updateParticles(dt); updateFurnaces(dt);
  updateSky(); updateTarget(); updateHand(dt, moving);
  cropTick += dt; if (cropTick > 1) { cropTick = 0; let ch = false; for (const k in state.crops) if (cropStage(state.crops[k]) !== state.crops[k]._st) ch = true; if (ch) buildCrops(); }
  statTick += dt; if (statTick > 0.5) { statTick = 0; renderStats(); renderVitals(); }
  saveTick += dt; if (saveTick > 10 && playing) { saveTick = 0; save(); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  renderer.render(scene, camera);
}
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ================== BOOT ==================
for (const k in state.edits) indexEdit(k);
if (freshGame) {
  const st = [[6, 6, 'wheat'], [7, 6, 'wheat'], [6, 7, 'pumpkin'], [7, 7, 'pumpkin']];
  for (const [dx, dz, ty] of st) state.crops[(VX + dx) + ',' + (G + 1) + ',' + (VZ + dz)] = { type: ty, t: -30 };
}
while (streamChunks(400, 400) > 0) {}
if (collides(player.pos)) { player.pos.y = groundAt(player.pos.x, player.pos.z); }
buildCrops(); renderHotbar(); renderStats(); renderVitals(); updateSky();
requestAnimationFrame(frame);
window.__dc = { state, player, villagers, raycast, data, chunks, ghosts, mobs, spawnMob, give, settings, jumpscare, get, setBlock, collides, VX, VZ, useAction, openChest, openSettings, diff };
