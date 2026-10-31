// DealerCraft by Buggy Games YT  ·  Spooky Season · Survival Update
import * as THREE from './three.module.min.js';

// ================== CONSTANTS ==================
const H = 64, CH = 16;                          // world height, chunk size (world is endless in x/z)
const SEA = 9, G = 13;                          // water level, village ground
const VX = 32, VZ = 32;                         // village centre
const GX = VX - 13, GZ = VZ + 13;               // graveyard centre
const DAY = 1200;                               // seconds per day (20 min, like Minecraft)
let VIEW = 4;                                   // chunks drawn around the player (Settings: render distance)
const SLOTS = 3, SLOT = Math.min(SLOTS, Math.max(1, +(localStorage.getItem('dealercraft_slot') || 1)));   // multiple worlds
const slotKey = n => n === 1 ? 'dealercraft_save_v1' : 'dealercraft_save_v1_s' + n;
const SAVE_KEY = slotKey(SLOT);
const SAFE_R = 24;                              // no monster spawns / explosion damage this close to the plaza

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7,
      PLANKS = 8, FARM = 9, COBBLE = 10, GLASS = 11, BRICK = 12, JACK = 13, DEADGRASS = 14, PUMPKIN = 15,
      BEDROCK = 16, COAL_ORE = 17, IRON_ORE = 18, CTABLE = 19, FURNACE = 20, GRAVE = 21,
      FLOW1 = 22, FALL = 29, DOOR0 = 30, CHEST = 46,
      RED_MUSH = 47, BROWN_MUSH = 48, TORCH = 49, POOP = 50,
      ASPHALT = 51, SIDEWALK = 52, CONCRETE = 53, TINT = 54, ROOF = 55, GARAGE = 56, WHITEWALL = 57, ROADLINE = 58,
      SIDING_B = 59, SIDING_Y = 60, LAMP = 61, OFFICE = 62, CROSSWALK = 63, SHOPGLASS = 64;          // FLOW1..FLOW7 = 22..28 (flowing water levels), doors = 30..45
const isWater = id => id === WATER || (id >= FLOW1 && id <= FALL);
const isDoor = id => id >= DOOR0 && id < DOOR0 + 16;
const doorId = (f, open, top) => DOOR0 + f * 4 + (open ? 2 : 0) + (top ? 1 : 0);
const doorF = id => (id - DOOR0) >> 2, doorOpen = id => !!((id - DOOR0) & 2), doorTop = id => !!((id - DOOR0) & 1);
const TRANSPARENT = new Set([LEAVES, GLASS, TINT, SHOPGLASS]);
const PLANT = new Set([RED_MUSH, BROWN_MUSH, TORCH, POOP]);          // small non-solid blocks (walk through, break instantly)
const isPlant = id => PLANT.has(id);
const MODEL = new Set();                                             // solid blocks drawn as small boxes (stairs, tombstones)
const seeThrough = id => TRANSPARENT.has(id) || isDoor(id) || isWater(id) || PLANT.has(id) || MODEL.has(id);
// tile per block: [top, bottom, side]
const BT = {
  [GRASS]: [0, 2, 1], [DIRT]: [2, 2, 2], [STONE]: [3, 3, 3], [SAND]: [4, 4, 4], [WATER]: [5, 5, 5],
  [LOG]: [7, 7, 6], [LEAVES]: [8, 8, 8], [PLANKS]: [9, 9, 9], [FARM]: [10, 2, 2], [COBBLE]: [11, 11, 11],
  [GLASS]: [12, 12, 12], [BRICK]: [13, 13, 13], [JACK]: [36, 36, 37], [DEADGRASS]: [38, 2, 40], [PUMPKIN]: [36, 36, 39],
  [BEDROCK]: [14, 14, 14], [COAL_ORE]: [15, 15, 15], [IRON_ORE]: [41, 41, 41], [CTABLE]: [42, 9, 43], [FURNACE]: [45, 45, 44], [CHEST]: [49, 49, 50],
  [GRAVE]: [3, 3, 46], [RED_MUSH]: [55, 55, 55], [BROWN_MUSH]: [56, 56, 56], [TORCH]: [57, 57, 57], [POOP]: [58, 58, 58],
  [ASPHALT]: [64, 64, 64], [SIDEWALK]: [65, 65, 65], [CONCRETE]: [66, 66, 66], [TINT]: [67, 67, 67], [ROOF]: [68, 68, 68], [GARAGE]: [69, 69, 69],
  [WHITEWALL]: [70, 70, 70], [ROADLINE]: [71, 64, 64], [SIDING_B]: [72, 72, 72], [SIDING_Y]: [73, 73, 73], [LAMP]: [74, 74, 74], [OFFICE]: [66, 66, 75],
  [CROSSWALK]: [76, 64, 64], [SHOPGLASS]: [77, 77, 77],
};
for (let i = FLOW1; i <= FALL; i++) BT[i] = [5, 5, 5];
// hardness (seconds-ish), the tool that speeds it up, and whether that tool is REQUIRED for a drop (with min tier)
const HARD = {
  [GRASS]: [0.6, 'hoe'], [DIRT]: [0.5, 'hoe'], [DEADGRASS]: [0.6, 'hoe'], [FARM]: [0.6, 'hoe'], [SAND]: [0.5, null],
  [STONE]: [1.5, 'pick', 1], [COBBLE]: [2, 'pick', 1], [BRICK]: [2, 'pick', 1], [COAL_ORE]: [3, 'pick', 1], [IRON_ORE]: [3, 'pick', 2],
  [FURNACE]: [3.5, 'pick', 1], [GRAVE]: [1.5, 'pick'],
  [LOG]: [2, 'axe'], [PLANKS]: [2, 'axe'], [CTABLE]: [2.5, 'axe'], [CHEST]: [2.5, 'axe'], [JACK]: [1, 'axe'], [PUMPKIN]: [1, 'axe'],
  [LEAVES]: [0.2, null], [GLASS]: [0.3, null, 99],
  [RED_MUSH]: [0.05, null], [BROWN_MUSH]: [0.05, null], [TORCH]: [0.05, null], [POOP]: [0.1, 'hoe'],
  [ASPHALT]: [1.5, 'pick', 1], [SIDEWALK]: [1.5, 'pick', 1], [CONCRETE]: [1.8, 'pick', 1], [ROADLINE]: [1.5, 'pick', 1], [CROSSWALK]: [1.5, 'pick', 1], [OFFICE]: [1.8, 'pick', 1],
  [TINT]: [0.3, null, 99], [SHOPGLASS]: [0.3, null, 99], [LAMP]: [0.4, null], [ROOF]: [1.5, 'pick', 1], [GARAGE]: [2, 'axe'], [WHITEWALL]: [2, 'axe'], [SIDING_B]: [2, 'axe'], [SIDING_Y]: [2, 'axe'],
};
const TIERS = { wood: { lvl: 1, speed: 2, dur: 60, dmg: 0 }, stone: { lvl: 2, speed: 4, dur: 132, dmg: 1 }, iron: { lvl: 3, speed: 6, dur: 251, dmg: 2 } };

// crops: tile base (4 stages), grow seconds, harvest yield
const CROPS = {
  wheat:   { name: 'Wheat',   tile: 16, grow: 45,  yield: [1, 2], seeds: [1, 2] },
  carrot:  { name: 'Carrots', tile: 20, grow: 60,  yield: [2, 3], seeds: [0, 1] },
  potato:  { name: 'Potatoes',tile: 24, grow: 60,  yield: [2, 3], seeds: [0, 1] },
  berries: { name: 'Berries', tile: 28, grow: 75,  yield: [2, 4], seeds: [0, 1] },
  pumpkin: { name: 'Pumpkin', tile: 32, grow: 100, yield: [1, 1], seeds: [1, 1] },
  weed:    { name: 'Marijuana', tile: 51, grow: 1200, yield: [2, 3], seeds: [1, 2], tall: true },         // a whole day to grow; 2 blocks tall, rarely 3 with cow poop
  brown_mush: { name: 'Psychedelic Brown Mushroom', tile: 56, grow: 300, yield: [1, 2], seeds: [0, 0], seed: 'brown_mushroom', dark: true, scale: true, anySoil: true },
  red_mush:   { name: 'Psychedelic Red Mushroom',   tile: 55, grow: 360, yield: [1, 1], seeds: [0, 0], seed: 'red_mushroom', dark: true, scale: true, anySoil: true },
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
  seeds_weed: { name: 'Marijuana Seeds', emoji: '🌱', tag: 'MJ', crop: 'weed' }, weed: { name: 'Marijuana', emoji: '🌿' },
  cow_poop: { name: 'Cow Poop (fertilizer)', emoji: '💩' },
  brown_mushroom: { name: 'Psychedelic Brown Mushroom (rare)', crop: 'brown_mush', sprite: true, tile: 56, food: 1 }, red_mushroom: { name: 'Psychedelic Red Mushroom (rare)', crop: 'red_mush', sprite: true, tile: 55, food: 1 },
  mushroom_stew: { name: 'Shroom Soup', emoji: '🥣', food: 4, stack: 1 },
  torch: { name: 'Torch', block: TORCH, px: 'torch' },
  raw_chicken: { name: 'Raw Chicken', emoji: '🍗', tag: 'RAW', food: 2 }, cooked_chicken: { name: 'Cooked Chicken', emoji: '🍗', food: 6 },
  raw_pork: { name: 'Raw Porkchop', emoji: '🥓', tag: 'RAW', food: 3 }, cooked_pork: { name: 'Cooked Porkchop', emoji: '🥓', food: 8 },
  raw_mutton: { name: 'Raw Mutton', emoji: '🍖', tag: 'RAW', food: 2 }, cooked_mutton: { name: 'Cooked Mutton', emoji: '🍖', food: 6 },
  asphalt: { name: 'Asphalt', block: ASPHALT }, concrete: { name: 'Concrete', block: CONCRETE }, roof_tiles: { name: 'Roof Tiles', block: ROOF }, lamp: { name: 'Street Lamp', block: LAMP },
  white_wall: { name: 'White Wall', block: WHITEWALL }, blue_siding: { name: 'Blue Siding', block: SIDING_B }, yellow_siding: { name: 'Yellow Siding', block: SIDING_Y },
  map: { name: 'Map', px: 'map', stack: 1 },
  feather: { name: 'Feather', emoji: '🪶' }, wool: { name: 'Wool', emoji: '🧶' }, egg: { name: 'Egg', emoji: '🥚', stack: 16 },
};
const seedOf = type => CROPS[type].seed || 'seeds_' + type;
const MATS = { wood: ['Wooden', 'planks'], stone: ['Stone', 'cobble'], iron: ['Iron', 'iron_ingot'] };
for (const [t, [label]] of Object.entries(MATS)) {
  ITEMS[t + '_pickaxe'] = { name: label + ' Pickaxe', px: 'pick', mat: t, tool: { kind: 'pick', tier: t }, stack: 1 };
  ITEMS[t + '_axe'] = { name: label + ' Hatchet', px: 'axe', mat: t, tool: { kind: 'axe', tier: t }, stack: 1 };
  ITEMS[t + '_hoe'] = { name: label + ' Hoe' + (t === 'iron' ? ' (3x3)' : ''), px: 'hoe', mat: t, tool: { kind: 'hoe', tier: t }, stack: 1 };
  ITEMS[t + '_sword'] = { name: label + ' Sword', px: 'sword', mat: t, tool: { kind: 'sword', tier: t }, stack: 1 };
}
const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots'];
const ARMOR_PTS = { leather: [1, 3, 2, 1], wood: [1, 3, 2, 1], stone: [2, 4, 3, 1], iron: [2, 6, 5, 2] };
const ARMOR_MATS = { leather: ['Leather', 'leather'], wood: ['Wooden', 'planks'], stone: ['Stone', 'cobble'], iron: ['Iron', 'iron_ingot'] };
for (const [m, [label]] of Object.entries(ARMOR_MATS)) ARMOR_SLOTS.forEach((s, i) => {
  ITEMS[m + '_' + s] = { name: label + ' ' + ['Helmet', 'Chestplate', 'Leggings', 'Boots'][i], px: s, mat: m, armor: { slot: i, pts: ARMOR_PTS[m][i] }, stack: 1 };
});
const stackOf = id => (ITEMS[id] && ITEMS[id].stack) || 64;
const CROP_ITEM = { wheat: 'wheat', carrot: 'carrot', potato: 'potato', berries: 'berries', pumpkin: 'pumpkin', weed: 'weed', brown_mush: 'brown_mushroom', red_mush: 'red_mushroom' };
const BLOCK_DROP = { [GRASS]: 'dirt', [DIRT]: 'dirt', [FARM]: 'dirt', [STONE]: 'cobble', [COBBLE]: 'cobble', [SAND]: 'sand',
  [LOG]: 'log', [LEAVES]: 'leaves', [PLANKS]: 'planks', [GLASS]: 'glass', [BRICK]: 'brick', [JACK]: 'jack_o_lantern',
  [DEADGRASS]: 'dirt', [PUMPKIN]: 'pumpkin', [COAL_ORE]: 'coal', [IRON_ORE]: 'iron_ore', [CTABLE]: 'crafting_table', [FURNACE]: 'furnace', [CHEST]: 'chest',
  [RED_MUSH]: 'red_mushroom', [BROWN_MUSH]: 'brown_mushroom', [TORCH]: 'torch', [POOP]: 'cow_poop',
  [ASPHALT]: 'asphalt', [ROADLINE]: 'asphalt', [CROSSWALK]: 'asphalt', [SIDEWALK]: 'concrete', [CONCRETE]: 'concrete', [OFFICE]: 'concrete', [ROOF]: 'roof_tiles', [LAMP]: 'lamp',
  [WHITEWALL]: 'white_wall', [SIDING_B]: 'blue_siding', [SIDING_Y]: 'yellow_siding', [GARAGE]: 'planks' };
const FUEL = { log: 1.5, planks: 1.5, stick: 0.5, coal: 8, crafting_table: 1.5, door: 1, chest: 1.5 };   // items smelted per fuel item
const SMELT = { iron_ore: 'iron_ingot', sand: 'glass', cobble: 'stone', raw_beef: 'steak', potato: 'baked_potato', log: 'coal',
  raw_chicken: 'cooked_chicken', raw_pork: 'cooked_pork', raw_mutton: 'cooked_mutton', egg: 'cooked_chicken', cocaine: 'crack' };

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
for (const [m, [, mat]] of Object.entries(ARMOR_MATS)) {
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
shaped('torch', 4, ['C', 'S'], { C: 'coal', S: 'stick' });
shaped('map', 1, ['SSS', 'SCS', 'SSS'], { S: 'stick', C: 'coal' });
shapeless('mushroom_stew', 1, ['brown_mushroom', 'red_mushroom', 'brown_mushroom']);
// ---- v1.11 Drug Update: craftable drugs & drinks (effects live in the DRUGS section near the game loop)
Object.assign(ITEMS, {
  beer: { name: 'Beer', emoji: '🍺', food: 2, stack: 16 }, vodka: { name: 'Vodka', emoji: '🍾', food: 1, stack: 16 },
  sprite: { name: 'Sprite', emoji: '🥤', food: 2, stack: 16 },
  cough_syrup: { name: 'Promethazine & Codeine Cough Syrup', emoji: '🧴', food: 1, stack: 16 },
  purple_sprite: { name: 'Purple Sprite (Lean)', emoji: '🥤', tag: 'LEAN', food: 2, stack: 16 },
  pills: { name: 'Pills', emoji: '💊', food: 1 }, xanax: { name: 'Xanax', emoji: '💊', tag: 'XAN', food: 1 },
  ecstasy: { name: 'Ecstasy', emoji: '💊', tag: 'XTC', food: 1 }, acid: { name: 'Acid Tab', emoji: '🌈', tag: 'LSD', food: 1 },
  cocaine: { name: 'Cocaine', emoji: '❄️', food: 1 }, crack: { name: 'Crack', emoji: '🪨', food: 1 }, meth: { name: 'Meth', emoji: '🧊', food: 1 },
});
shapeless('beer', 1, ['wheat', 'wheat', 'wheat', 'glass']);
shapeless('vodka', 1, ['potato', 'potato', 'potato', 'glass']);
shapeless('sprite', 1, ['berries', 'wheat', 'glass']);
shapeless('pills', 2, ['bone', 'wheat', 'glass']);
shapeless('cough_syrup', 1, ['pills', 'berries', 'glass']);
shapeless('purple_sprite', 1, ['cough_syrup', 'sprite', 'candy']);
shapeless('xanax', 1, ['pills', 'pills', 'wheat']);
shapeless('ecstasy', 2, ['pills', 'candy', 'gunpowder']);
shapeless('acid', 3, ['witch_brew', 'candy']);
shapeless('cocaine', 1, ['leaves', 'leaves', 'leaves', 'leaves', 'gunpowder']);
shapeless('crack', 2, ['cocaine', 'coal']);
shapeless('meth', 2, ['fertilizer', 'gunpowder', 'coal', 'glass']);
shapeless('fertilizer', 1, ['cow_poop', 'cow_poop', 'bone']);

const VILLAGERS = [
  { name: 'Farmer Fred', job: 'Scarecrow Farmer', robe: 0x3f8f3a, hat: 0xd9b35b, costume: 'pumpkin',
    sells: { seeds_wheat: 2, seeds_carrot: 4, seeds_potato: 4, seeds_berries: 6, seeds_pumpkin: 8, wood_hoe: 10 },
    buys: { wheat: 3, carrot: 5, potato: 5, berries: 4, pumpkin: 18 } },
  { name: 'Baker Betty', job: 'Baker', robe: 0xf2f2f2, hat: 0xff8fb1, costume: 'cat',
    sells: { bread: 9 }, buys: { bread: 14, carrot_cake: 30, pumpkin_pie: 32 } },
  { name: 'Count Carl', job: 'Vampire Chef', robe: 0x1a1a1a, hat: 0x1a1a1a, costume: 'vampire',
    sells: { steak: 12 }, buys: { baked_potato: 12, berry_juice: 22, veggie_stew: 45, steak: 10, raw_beef: 5, cooked_chicken: 8, cooked_pork: 10, cooked_mutton: 8, mushroom_stew: 90 } },
  { name: 'Merchant Mo', job: 'Merchant', robe: 0x7b3fb5, hat: 0x2a1a40, costume: 'wizard',
    sells: { fertilizer: 8, log: 2, coal: 4, torch: 2, map: 15, seeds_weed: 20, iron_ingot: 15, bucket: 40, iron_hoe: 150, sprite: 3 }, buys: { planks: 1, cobble: 1, brick: 2, leaves: 1, leather: 6, iron_ingot: 8, weed: 90, wool: 4, egg: 2,
      meth: 70, cocaine: 60, crack: 45, pills: 15, xanax: 30, ecstasy: 35, acid: 40, cough_syrup: 30, purple_sprite: 55, beer: 8, vodka: 14 } },
  { name: 'Witch Wanda', job: 'Witch', robe: 0x24132e, hat: 0x111111, costume: 'witch', skin: 0x7fbf5a,
    sells: { seeds_pumpkin: 7, fertilizer: 7 }, buys: { pumpkin: 20, jack_o_lantern: 26, candy: 6, witch_brew: 60, bone: 4, gunpowder: 8, rotten_flesh: 2, brown_mushroom: 25, red_mushroom: 35, feather: 3 } },
];
const RANKS = [[0, 'Rookie Grower'], [100, 'Street Farmer'], [400, 'Market Dealer'], [1200, 'Crop Boss'], [3000, 'DealerCraft Tycoon']];

// ================== FURNITURE & ELECTRONICS (beds, laptops, TVs, radios) ==================
// each is 4 block ids (one per facing); the front faces the player who placed it
const BED0 = 65, LAPTOP0 = 69, TV0 = 73, RADIO0 = 77;
const FURN_BASES = [BED0, LAPTOP0, TV0, RADIO0];
const furnBase = id => (id >= 65 && id < 81) ? 65 + ((id - 65) >> 2) * 4 : -1;
const furnF = id => (id - 65) & 3;
const isFurn = id => id >= 65 && id < 81;
const FURN_ITEM = { [BED0]: 'bed', [LAPTOP0]: 'laptop', [TV0]: 'tv', [RADIO0]: 'radio' };
for (let id = 65; id < 81; id++) {
  PLANT.add(id); BT[id] = [9, 9, 9]; HARD[id] = [0.35, null]; BLOCK_DROP[id] = FURN_ITEM[furnBase(id)];
}
Object.assign(ITEMS, {
  bed: { name: 'Bed', emoji: '🛏️', furn: BED0, stack: 1 },
  laptop: { name: 'Laptop', emoji: '💻', furn: LAPTOP0, stack: 1 },
  tv: { name: 'TV', emoji: '📺', furn: TV0, stack: 1 },
  radio: { name: 'Radio', emoji: '📻', furn: RADIO0, stack: 1 },
});
shaped('bed', 1, ['WWW', 'PPP'], { W: 'wool', P: 'planks' });
shaped('laptop', 1, ['GGG', 'ICI', 'III'], { G: 'glass', I: 'iron_ingot', C: 'coal' });
shaped('tv', 1, ['GGG', 'GCG', 'III'], { G: 'glass', I: 'iron_ingot', C: 'coal' });
shaped('radio', 1, ['..I', 'PCP', 'PPP'], { I: 'iron_ingot', P: 'planks', C: 'coal' });
Object.assign(VILLAGERS[3].sells, { bed: 30, radio: 45, tv: 90, laptop: 140 });
FUEL.bed = 1.5; FUEL.radio = 1;
// rotate a model box (made facing +z) to facing f: 0 +z, 1 +x, 2 -z, 3 -x
function rotBox(b, f) {
  const r = (x, z) => f === 0 ? [x, z] : f === 1 ? [z, 1 - x] : f === 2 ? [1 - x, 1 - z] : [1 - z, x];
  const [ax, az] = r(b[0], b[2]), [bx, bz] = r(b[3], b[5]);
  return [Math.min(ax, bx), b[1], Math.min(az, bz), Math.max(ax, bx), b[4], Math.max(az, bz)];
}
// [box, tile] lists; tiles 78.. painted in p_d_tiles_furn
const FURN_MODEL = {
  [BED0]: [[[0, 0, 0, 1, 0.2, 1], 9], [[0.03, 0.2, 0.06, 0.97, 0.5, 0.98], 78], [[0.1, 0.5, 0.1, 0.9, 0.62, 0.34], 79], [[0, 0, 0, 1, 0.9, 0.08], 9], [[0, 0, 0.92, 1, 0.42, 1], 9]],
  [LAPTOP0]: [[[0.18, 0, 0.3, 0.82, 0.05, 0.78], 80], [[0.18, 0.05, 0.26, 0.82, 0.5, 0.3], 80], [[0.21, 0.08, 0.3, 0.79, 0.47, 0.31], 81]],
  [TV0]: [[[0.35, 0, 0.36, 0.65, 0.05, 0.62], 82], [[0.46, 0.05, 0.45, 0.54, 0.14, 0.52], 82], [[0.02, 0.14, 0.42, 0.98, 0.96, 0.56], 82], [[0.06, 0.18, 0.56, 0.94, 0.92, 0.565], 83]],
  [RADIO0]: [[[0.16, 0, 0.32, 0.84, 0.44, 0.68], 84], [[0.19, 0.04, 0.68, 0.81, 0.4, 0.69], 85], [[0.72, 0.44, 0.44, 0.75, 0.92, 0.47], 86], [[0.18, 0.44, 0.48, 0.3, 0.48, 0.52], 86]],
};
// facing a newly placed piece toward the player
function facingToPlayer() { const d = getDir(); return Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 3 : 1) : (d.z > 0 ? 2 : 0); }

// ================== v1.09: precious metals, shovels, jewelry, graveyards, stairs, animal goods ==================
// tool tiers above iron (gold is fast but weak and breaks quickly, like Minecraft)
Object.assign(TIERS, { gold: { lvl: 1, speed: 12, dur: 33, dmg: 0 }, silver: { lvl: 3, speed: 7, dur: 500, dmg: 3 }, platinum: { lvl: 4, speed: 9, dur: 1200, dmg: 4 } });
const hoeR = tier => tier === 'platinum' ? 2 : (TIERS[tier] && TIERS[tier].lvl >= 3 ? 1 : 0);   // iron/silver hoes work 3x3, platinum 5x5
Object.assign(ITEMS, {
  gold_ingot: { name: 'Gold Bar', px: 'ingot', mat: 'gold' }, silver_ingot: { name: 'Silver Bar', px: 'ingot', mat: 'silver' }, platinum_ingot: { name: 'Platinum Bar', px: 'ingot', mat: 'platinum' },
  iron_jewelry: { name: 'Iron Jewelry', px: 'ring', mat: 'iron' }, silver_jewelry: { name: 'Silver Jewelry', px: 'ring', mat: 'silver' },
  gold_jewelry: { name: 'Gold Jewelry', px: 'ring', mat: 'gold' }, platinum_jewelry: { name: 'Platinum Jewelry', px: 'ring', mat: 'platinum' },
  diamond_jewelry: { name: 'Diamond Jewelry (valuable)', px: 'ring', mat: 'diamond' },
  apple: { name: 'Apple', emoji: '🍎', food: 4 }, saddle: { name: 'Saddle', px: 'saddle', mat: 'leather', stack: 1 },
  raw_bear: { name: 'Raw Bear Meat', emoji: '🥩', tag: 'BEAR', food: 3 }, cooked_bear: { name: 'Bear Steak', emoji: '🍖', tag: 'BEAR', food: 9 },
  raw_goat: { name: 'Raw Goat Meat', emoji: '🥩', tag: 'GOAT', food: 2 }, cooked_goat: { name: 'Cooked Goat', emoji: '🍖', tag: 'GOAT', food: 6 },
});
const MATS2 = { gold: ['Golden', 'gold_ingot'], silver: ['Silver', 'silver_ingot'], platinum: ['Platinum', 'platinum_ingot'] };
for (const [t, [label]] of Object.entries(MATS2)) {
  ITEMS[t + '_pickaxe'] = { name: label + ' Pickaxe', px: 'pick', mat: t, tool: { kind: 'pick', tier: t }, stack: 1 };
  ITEMS[t + '_axe'] = { name: label + ' Hatchet', px: 'axe', mat: t, tool: { kind: 'axe', tier: t }, stack: 1 };
  ITEMS[t + '_hoe'] = { name: label + ' Hoe' + (t === 'platinum' ? ' (5x5)' : t === 'silver' ? ' (3x3)' : ''), px: 'hoe', mat: t, tool: { kind: 'hoe', tier: t }, stack: 1 };
  ITEMS[t + '_sword'] = { name: label + ' Sword', px: 'sword', mat: t, tool: { kind: 'sword', tier: t }, stack: 1 };
}
Object.assign(MATS, MATS2);
for (const [t, [label]] of Object.entries(MATS)) ITEMS[t + '_shovel'] = { name: label + ' Shovel', px: 'shovel', mat: t, tool: { kind: 'shovel', tier: t }, stack: 1 };
Object.assign(ARMOR_PTS, { gold: [2, 5, 3, 1], silver: [2, 7, 5, 2], platinum: [3, 8, 6, 3] });
const ARMOR_MATS2 = { gold: ['Golden', 'gold_ingot'], silver: ['Silver', 'silver_ingot'], platinum: ['Platinum', 'platinum_ingot'] };
for (const [m, [label]] of Object.entries(ARMOR_MATS2)) ARMOR_SLOTS.forEach((s, i) => {
  ITEMS[m + '_' + s] = { name: label + ' ' + ['Helmet', 'Chestplate', 'Leggings', 'Boots'][i], px: s, mat: m, armor: { slot: i, pts: ARMOR_PTS[m][i] }, stack: 1 };
});
Object.assign(ARMOR_MATS, ARMOR_MATS2);
for (const [t, [, m]] of Object.entries(MATS2)) {
  shaped(t + '_pickaxe', 1, ['MMM', '.S.', '.S.'], { M: m, S: 'stick' });
  shaped(t + '_axe', 1, ['MM', 'MS', '.S'], { M: m, S: 'stick' });
  shaped(t + '_hoe', 1, ['MM', '.S', '.S'], { M: m, S: 'stick' });
  shaped(t + '_sword', 1, ['M', 'M', 'S'], { M: m, S: 'stick' });
}
for (const [t, [, m]] of Object.entries(MATS)) shaped(t + '_shovel', 1, ['M', 'S', 'S'], { M: m, S: 'stick' });
for (const [m, [, mat]] of Object.entries(ARMOR_MATS2)) {
  shaped(m + '_helmet', 1, ['LLL', 'L.L'], { L: mat });
  shaped(m + '_chest', 1, ['L.L', 'LLL', 'LLL'], { L: mat });
  shaped(m + '_legs', 1, ['LLL', 'L.L', 'L.L'], { L: mat });
  shaped(m + '_boots', 1, ['L.L', 'L.L'], { L: mat });
}
shaped('saddle', 1, ['LLL', 'LIL'], { L: 'leather', I: 'iron_ingot' });
// smelt grave jewelry back into bars (diamond jewelry stays a valuable to sell: there are no loose diamonds yet)
Object.assign(SMELT, { iron_jewelry: 'iron_ingot', silver_jewelry: 'silver_ingot', gold_jewelry: 'gold_ingot', platinum_jewelry: 'platinum_ingot', raw_bear: 'cooked_bear', raw_goat: 'cooked_goat' });

// ---- new blocks: graveyards (tombstone + grave dirt) and stairs (4 facings each)
const TOMB = 81, GRAVE_DIRT = 82, WSTAIR0 = 83, SSTAIR0 = 87;
const isStair = id => id >= WSTAIR0 && id < SSTAIR0 + 4;
const stairBase = id => id >= SSTAIR0 ? SSTAIR0 : WSTAIR0;
Object.assign(BT, { [TOMB]: [89, 89, 89], [GRAVE_DIRT]: [87, 2, 88] });
Object.assign(HARD, { [TOMB]: [1.5, 'pick', 1], [GRAVE_DIRT]: [0.8, 'shovel'], [SAND]: [0.5, 'shovel'] });
Object.assign(BLOCK_DROP, { [TOMB]: 'cobble', [GRAVE_DIRT]: 'dirt' });
MODEL.add(TOMB);
// a stair made facing +z: full bottom slab, top half at the back; the low step faces the player who placed it
const STAIR_BOXES = [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]];
const stairBoxes = id => STAIR_BOXES.map(b => rotBox(b, (id - stairBase(id)) & 3));
for (let f = 0; f < 4; f++) {
  BT[WSTAIR0 + f] = [9, 9, 9]; HARD[WSTAIR0 + f] = [2, 'axe']; BLOCK_DROP[WSTAIR0 + f] = 'wood_stairs'; MODEL.add(WSTAIR0 + f);
  BT[SSTAIR0 + f] = [11, 11, 11]; HARD[SSTAIR0 + f] = [2, 'pick', 1]; BLOCK_DROP[SSTAIR0 + f] = 'stone_stairs'; MODEL.add(SSTAIR0 + f);
}
// [box, tile] lists for every model block
function modelBoxes(id) {
  if (isStair(id)) { const t = BT[id][0]; return stairBoxes(id).map(b => [b, t]); }
  { const m3 = typeof modelBoxes3 === 'function' ? modelBoxes3(id) : null; if (m3) return m3; }
  if (id === TOMB) return [[[0.12, 0, 0.3, 0.88, 0.14, 0.7], 89], [[0.2, 0.14, 0.4, 0.8, 0.86, 0.6], 90], [[0.3, 0.86, 0.4, 0.7, 0.96, 0.6], 89]];
  return [[[0, 0, 0, 1, 1, 1], BT[id] ? BT[id][2] : 3]];
}
Object.assign(ITEMS, {
  wood_stairs: { name: 'Wooden Stairs', px: 'stairs', mat: 'wood', block: WSTAIR0, stairs: true },
  stone_stairs: { name: 'Stone Stairs', px: 'stairs', mat: 'stone', block: SSTAIR0, stairs: true },
  tombstone: { name: 'Tombstone', block: TOMB }, grave_dirt: { name: 'Grave Dirt', block: GRAVE_DIRT },
});
shaped('wood_stairs', 4, ['P..', 'PP.', 'PPP'], { P: 'planks' });
shaped('stone_stairs', 4, ['C..', 'CC.', 'CCC'], { C: 'cobble' });
FUEL.wood_stairs = 1.5; FUEL.saddle = 0.5;
// grave loot when you dig grave dirt with a shovel
function graveLoot() {
  const out = []; const r = Math.random;
  if (r() < 0.7) out.push(['bone', rint(1, 3)]);
  if (r() < 0.22) out.push(['iron_jewelry', 1]);
  if (r() < 0.13) out.push(['silver_jewelry', 1]);
  if (r() < 0.09) out.push(['gold_jewelry', 1]);
  if (r() < 0.05) out.push(['platinum_jewelry', 1]);
  if (r() < 0.015) out.push(['diamond_jewelry', 1]);
  if (r() < 0.25) out.push(['rotten_flesh', 1]);
  return out;
}
// prices: Merchant Mo buys precious things, Count Carl & butchers buy the new meats
Object.assign(VILLAGERS[3].buys, { iron_jewelry: 7, silver_jewelry: 22, gold_jewelry: 34, platinum_jewelry: 55, diamond_jewelry: 260, gold_ingot: 18, silver_ingot: 12, platinum_ingot: 30, apple: 2 });
Object.assign(VILLAGERS[3].sells, { saddle: 45, iron_shovel: 25 });
Object.assign(VILLAGERS[2].buys, { cooked_bear: 14, cooked_goat: 9, raw_bear: 6, raw_goat: 4 });
Object.assign(VILLAGERS[0].sells, { wood_shovel: 8 });

// ================== v1.10 step 2: world & weather blocks ==================
// snowy grass, snow, snow layer, spruce leaves, fire, ice, cactus (tiles 91-100, see p_d_tiles_v110.js)
const SNOW_GRASS = 91, SNOW = 92, SNOW_LAYER = 93, SPRUCE = 94, FIRE = 95, ICE = 96, CACTUS = 97;
Object.assign(BT, { [SNOW_GRASS]: [95, 2, 96], [SNOW]: [95, 95, 95], [SNOW_LAYER]: [95, 95, 95], [SPRUCE]: [94, 94, 94], [FIRE]: [97, 97, 97], [ICE]: [98, 98, 98], [CACTUS]: [100, 100, 99] });
Object.assign(HARD, { [SNOW_GRASS]: [0.6, 'shovel'], [SNOW]: [0.4, 'shovel'], [SNOW_LAYER]: [0.05, null], [SPRUCE]: [0.2, null], [FIRE]: [0.02, null], [ICE]: [0.5, 'pick'], [CACTUS]: [0.4, null] });
Object.assign(BLOCK_DROP, { [SNOW_GRASS]: 'dirt', [SNOW]: 'snow_block', [SPRUCE]: 'spruce_leaves', [ICE]: 'ice', [CACTUS]: 'cactus' });
PLANT.add(SNOW_LAYER); PLANT.add(FIRE); TRANSPARENT.add(SPRUCE);
Object.assign(ITEMS, {
  snow_block: { name: 'Snow Block', block: SNOW }, ice: { name: 'Ice', block: ICE }, cactus: { name: 'Cactus', block: CACTUS },
  spruce_leaves: { name: 'Spruce Leaves', block: SPRUCE },
});
// things fire can burn (wood, planks, leaves, wooden stairs, crafting tables)
const FLAMMABLE = new Set([LOG, PLANKS, LEAVES, SPRUCE, CTABLE, 83, 84, 85, 86]);

// ================== v1.10 step 3: city blocks, furniture, boats ==================
// graffiti walls, broken windows, coloured skyscraper glass, couches, chairs, tables, kitchen counters, trash bags
// (tiles 101-113, 119 in p_d_tiles_v110s3.js)
const GRAFF1 = 98, GRAFF2 = 99, BROKEN_GLASS = 100, GL_BLUE = 101, GL_GREEN = 102, GL_GOLD = 103, GL_DARK = 104,
      COUCH0 = 105, CHAIR0 = 109, TABLE = 113, COUNTER0 = 114, TRASH = 118, GL_TEAL = 119;
Object.assign(BT, { [GRAFF1]: [13, 13, 101], [GRAFF2]: [66, 66, 102], [BROKEN_GLASS]: [103, 103, 103], [GL_BLUE]: [66, 66, 104], [GL_GREEN]: [66, 66, 105],
  [GL_GOLD]: [66, 66, 106], [GL_DARK]: [66, 66, 107], [GL_TEAL]: [66, 66, 119], [TABLE]: [113, 113, 113], [TRASH]: [112, 112, 112] });
Object.assign(HARD, { [GRAFF1]: [2, 'pick', 1], [GRAFF2]: [1.8, 'pick', 1], [BROKEN_GLASS]: [0.2, null, 99], [GL_BLUE]: [1.8, 'pick', 1], [GL_GREEN]: [1.8, 'pick', 1],
  [GL_GOLD]: [1.8, 'pick', 1], [GL_DARK]: [1.8, 'pick', 1], [GL_TEAL]: [1.8, 'pick', 1], [TABLE]: [1, 'axe'], [TRASH]: [0.1, null] });
Object.assign(BLOCK_DROP, { [GRAFF1]: 'brick', [GRAFF2]: 'concrete', [GL_BLUE]: 'glass', [GL_GREEN]: 'glass', [GL_GOLD]: 'glass', [GL_DARK]: 'glass', [GL_TEAL]: 'glass', [TABLE]: 'table' });
TRANSPARENT.add(BROKEN_GLASS);
const FACED3 = { [COUCH0]: 'couch', [CHAIR0]: 'chair', [COUNTER0]: 'counter' };
for (let f = 0; f < 4; f++) {
  BT[COUCH0 + f] = [108, 108, 108]; HARD[COUCH0 + f] = [0.6, 'axe']; BLOCK_DROP[COUCH0 + f] = 'couch'; MODEL.add(COUCH0 + f); PLANT.add(COUCH0 + f);
  BT[CHAIR0 + f] = [113, 113, 113]; HARD[CHAIR0 + f] = [0.5, 'axe']; BLOCK_DROP[CHAIR0 + f] = 'chair'; MODEL.add(CHAIR0 + f); PLANT.add(CHAIR0 + f);
  BT[COUNTER0 + f] = [110, 111, 111]; HARD[COUNTER0 + f] = [1.2, 'pick']; BLOCK_DROP[COUNTER0 + f] = 'counter'; MODEL.add(COUNTER0 + f);
}
MODEL.add(TABLE); MODEL.add(TRASH); PLANT.add(TRASH);
FLAMMABLE.add(TABLE); for (let f = 0; f < 4; f++) { FLAMMABLE.add(COUCH0 + f); FLAMMABLE.add(CHAIR0 + f); }
// box models, made facing +z (the front / seat side is +z)
const MODEL3 = {
  [COUCH0]: [[[0, 0, 0.1, 1, 0.42, 0.95], 108], [[0, 0.42, 0.08, 1, 0.95, 0.32], 108], [[0.04, 0.42, 0.32, 0.96, 0.54, 0.93], 109], [[0, 0.42, 0.32, 0.1, 0.7, 0.95], 108], [[0.9, 0.42, 0.32, 1, 0.7, 0.95], 108]],
  [CHAIR0]: [[[0.2, 0, 0.2, 0.28, 0.46, 0.28], 113], [[0.72, 0, 0.2, 0.8, 0.46, 0.28], 113], [[0.2, 0, 0.72, 0.28, 0.46, 0.8], 113], [[0.72, 0, 0.72, 0.8, 0.46, 0.8], 113],
    [[0.17, 0.46, 0.17, 0.83, 0.54, 0.83], 113], [[0.17, 0.54, 0.17, 0.83, 1.05, 0.25], 113]],
  [COUNTER0]: [[[0, 0, 0.04, 1, 0.88, 1], 111], [[0, 0.88, 0, 1, 1, 1], 110]],
};
const TABLE_BOXES = [[[0, 0.86, 0, 1, 0.98, 1], 113], [[0.06, 0, 0.06, 0.18, 0.86, 0.18], 113], [[0.82, 0, 0.06, 0.94, 0.86, 0.18], 113], [[0.06, 0, 0.82, 0.18, 0.86, 0.94], 113], [[0.82, 0, 0.82, 0.94, 0.86, 0.94], 113]];
const TRASH_BOXES = [[[0.14, 0, 0.18, 0.7, 0.52, 0.74], 112], [[0.36, 0.52, 0.4, 0.5, 0.64, 0.54], 112], [[0.55, 0, 0.5, 0.92, 0.34, 0.9], 112]];
const base3 = id => id >= COUCH0 && id < COUCH0 + 4 ? COUCH0 : id >= CHAIR0 && id < CHAIR0 + 4 ? CHAIR0 : id >= COUNTER0 && id < COUNTER0 + 4 ? COUNTER0 : -1;
function modelBoxes3(id) {
  if (id === TABLE) return TABLE_BOXES; if (id === TRASH) return TRASH_BOXES;
  const b = base3(id); if (b < 0) return null; const f = id - b; return MODEL3[b].map(([bx, t]) => [rotBox(bx, f), t]);
}
Object.assign(ITEMS, {
  couch: { name: 'Couch', emoji: '🛋️', block: COUCH0, facing: true }, chair: { name: 'Chair', emoji: '🪑', block: CHAIR0, facing: true },
  table: { name: 'Table', emoji: '🟫', block: TABLE }, counter: { name: 'Kitchen Counter', emoji: '🗄️', block: COUNTER0, facing: true },
  graffiti_wall: { name: 'Graffiti Wall', block: GRAFF1 }, blue_glass: { name: 'Blue Office Glass', block: GL_BLUE }, green_glass: { name: 'Green Office Glass', block: GL_GREEN },
  gold_glass: { name: 'Gold Office Glass', block: GL_GOLD }, dark_glass: { name: 'Dark Office Glass', block: GL_DARK }, teal_glass: { name: 'Teal Office Glass', block: GL_TEAL },
  boat: { name: 'Wooden Boat', emoji: '🛶', stack: 1 }, paddle: { name: 'Paddle', emoji: '🏏', stack: 1 },
});
shaped('couch', 1, ['W..', 'WWW', 'PPP'], { W: 'wool', P: 'planks' });
shaped('chair', 2, ['P..', 'PPP', 'P.P'], { P: 'planks' });
shaped('table', 1, ['PPP', 'S.S', 'S.S'], { P: 'planks', S: 'stick' });
shaped('counter', 2, ['CCC', 'PPP', 'PPP'], { C: 'cobble', P: 'planks' });
shaped('boat', 1, ['P.P', 'PPP'], { P: 'planks' });
shaped('paddle', 1, ['.P', 'S.'], { P: 'planks', S: 'stick' });
FUEL.boat = 3; FUEL.paddle = 1; FUEL.chair = 1; FUEL.table = 1.5;
Object.assign(VILLAGERS[3].sells, { boat: 18, paddle: 5, couch: 24, table: 10, chair: 6, counter: 12 });

// ================== v1.10 step 4: military / sci-fi blocks and items ==================
// (tiles 114-118, 120-124 in p_d_tiles_v110s4.js)
const STEEL = 120, FENCE = 121, BARS = 122, WASTE = 123, SCORCH = 124, HAZARD = 125, REACTOR = 126, ALIEN_METAL = 127, CRATE = 128;
Object.assign(BT, { [STEEL]: [114, 114, 114], [FENCE]: [115, 115, 115], [BARS]: [116, 116, 116], [WASTE]: [118, 118, 117], [SCORCH]: [120, 2, 120],
  [HAZARD]: [121, 121, 121], [REACTOR]: [122, 122, 122], [ALIEN_METAL]: [123, 123, 123], [CRATE]: [124, 124, 124] });
Object.assign(HARD, { [STEEL]: [3, 'pick', 1], [FENCE]: [2, 'pick', 1], [BARS]: [4, 'pick', 2], [WASTE]: [1.5, 'pick', 1], [SCORCH]: [0.6, 'shovel'],
  [HAZARD]: [2, 'pick', 1], [REACTOR]: [8, 'pick', 3], [ALIEN_METAL]: [4, 'pick', 2], [CRATE]: [1, 'axe'] });
Object.assign(BLOCK_DROP, { [STEEL]: 'steel', [FENCE]: 'fence', [BARS]: 'bars', [WASTE]: 'uranium', [SCORCH]: 'dirt', [HAZARD]: 'hazard_block', [REACTOR]: 'uranium', [ALIEN_METAL]: 'alien_tech', [CRATE]: 'rifle_ammo' });
TRANSPARENT.add(FENCE); TRANSPARENT.add(BARS);
Object.assign(ITEMS, {
  pistol: { name: 'Pistol', px: 'pistol', stack: 1, gun: 1 }, rifle: { name: 'Assault Rifle', px: 'rifle', stack: 1, gun: 1 }, minigun: { name: 'Minigun', px: 'minigun', stack: 1, gun: 1 },
  pistol_ammo: { name: 'Pistol Ammo', px: 'ammo', mat: 'gold' }, rifle_ammo: { name: 'Rifle Ammo', px: 'ammo', mat: 'iron' },
  grenade: { name: 'Grenade', px: 'grenade', stack: 16 }, nuke: { name: 'Nuke', px: 'nuke', stack: 1 },
  alien_tech: { name: 'Alien Tech', px: 'alientech' }, uranium: { name: 'Uranium', px: 'uranium' },
  plane: { name: 'Airplane', px: 'plane', stack: 1 }, helicopter: { name: 'Helicopter', px: 'heli', stack: 1 },
  steel: { name: 'Steel Panel', block: STEEL }, fence: { name: 'Chain-link Fence', block: FENCE }, bars: { name: 'Iron Bars', block: BARS },
  hazard_block: { name: 'Hazard Stripes', block: HAZARD }, toxic_barrel: { name: 'Toxic Waste Barrel', block: WASTE }, crate: { name: 'Military Crate', block: CRATE },
  scorched: { name: 'Scorched Earth', block: SCORCH }, alien_hull: { name: 'Alien Hull', block: ALIEN_METAL },
});
shaped('pistol', 1, ['III', '..P'], { I: 'iron_ingot', P: 'planks' });
shaped('rifle', 1, ['III', 'IIP', '..P'], { I: 'iron_ingot', P: 'planks' });
shaped('minigun', 1, ['III', 'IGI', 'III'], { I: 'iron_ingot', G: 'gold_ingot' });
shapeless('pistol_ammo', 12, ['iron_ingot', 'gunpowder']);
shapeless('rifle_ammo', 12, ['iron_ingot', 'iron_ingot', 'gunpowder']);
shaped('grenade', 2, ['.I.', 'IGI', '.I.'], { I: 'iron_ingot', G: 'gunpowder' });
shaped('nuke', 1, ['GUG', 'UGU', 'GUG'], { G: 'gunpowder', U: 'uranium' });
shaped('fence', 6, ['ISI', 'ISI'], { I: 'iron_ingot', S: 'stick' });
shaped('bars', 8, ['III', 'III'], { I: 'iron_ingot' });
const GUNS = {
  pistol: { ammo: 'pistol_ammo', dmg: 6, rate: 0.28, auto: false, spread: 0.012, range: 60, kick: 0.035, vol: 0.32, f: 1500 },
  rifle: { ammo: 'rifle_ammo', dmg: 8, rate: 0.11, auto: true, spread: 0.018, range: 90, kick: 0.022, vol: 0.36, f: 1100 },
  minigun: { ammo: 'rifle_ammo', dmg: 5, rate: 0.05, auto: true, spread: 0.05, range: 70, kick: 0.012, vol: 0.28, f: 900, spin: 0.45 },
};
// pixel-art icons for the new items (16x16, P(x, y, colour))
function drawIconS4(kind, mat, P) {
  const R = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c); };
  switch (kind) {
    case 'pistol': R(2, 5, 13, 7, (x, y) => y === 5 ? '#6a6e76' : '#3a3d42'); P(14, 6, '#18191b'); P(14, 5, '#2a2c30'); R(2, 8, 12, 8, '#2c2e32');
      for (let y = 8; y <= 13; y++) { const s = Math.round((y - 8) * 0.35); R(3 - s, y, 6 - s, y, (x) => x === 3 - s ? '#3a2a1c' : '#5a4028'); }
      P(8, 9, '#222'); P(9, 10, '#222'); P(7, 10, '#222'); P(8, 10, '#222'); P(10, 9, '#222'); return true;
    case 'rifle': R(0, 7, 3, 10, (x, y) => (x + y) % 3 ? '#6a4626' : '#4a3018'); R(4, 6, 10, 8, (x, y) => y === 6 ? '#555a60' : '#2e3034'); R(11, 6, 15, 7, (x, y) => y === 6 ? '#4a4e54' : '#26282c');
      R(5, 4, 9, 5, (x, y) => x === 5 || x === 9 ? '#111' : '#2a2c30'); P(7, 3, '#7ad0ff'); R(7, 9, 8, 12, (x, y) => '#1e2024'); R(5, 9, 5, 10, '#2e3034'); P(12, 8, '#26282c'); return true;
    case 'minigun': for (let y = 4; y <= 9; y++) R(8, y, 15, y, (x) => y % 2 ? '#2a2c30' : '#7a8088'); R(2, 3, 8, 10, (x, y) => x === 2 || y === 3 ? '#8a9098' : '#4a4e56');
      R(3, 1, 6, 2, '#2a2a2a'); R(3, 11, 7, 14, (x, y) => (x + y) % 4 ? '#5a6a30' : '#3a4a1a'); P(15, 4, '#111'); P(15, 9, '#111'); return true;
    case 'grenade': for (let y = 4; y < 16; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot((x - 7.5) / 4.6, (y - 9.5) / 5.2); if (d < 1) P(x, y, x % 3 === 0 || y % 3 === 0 ? '#2e4a1e' : d < 0.45 && x < 8 ? '#7aa04a' : '#4a6e2a'); }
      R(6, 2, 9, 4, '#8a8e94'); R(10, 3, 12, 3, '#b0b4ba'); P(12, 4, '#b0b4ba'); P(5, 1, '#d0c050'); P(4, 2, '#d0c050'); P(5, 3, '#d0c050'); P(6, 1, '#d0c050'); return true;
    case 'nuke': for (let y = 4; y < 13; y++) for (let x = 3; x < 15; x++) { const d = Math.hypot((x - 9) / 5.8, (y - 8.5) / 4); if (d < 1) P(x, y, y < 7 ? '#f6ec7a' : y > 10 ? '#b0a020' : '#e0d040'); }
      for (const [x, y] of [[0, 3], [1, 4], [2, 5], [0, 13], [1, 12], [2, 11]]) { P(x, y, '#70706a'); P(x + 1, y, '#8a8a84'); } R(1, 6, 3, 10, '#6a6a64');
      P(9, 8, '#111'); P(9, 9, '#111'); for (const [x, y] of [[7, 6], [8, 6], [7, 7], [11, 6], [10, 6], [11, 7], [8, 11], [9, 11], [10, 11]]) P(x, y, '#111'); return true;
    case 'ammo': { const [ml, md] = MATCOL[mat] || MATCOL.gold; for (const bx of [2, 6, 10]) { R(bx, 7, bx + 2, 14, (x, y) => x === bx ? md : y === 14 ? md : ml); R(bx, 4, bx + 2, 6, (x, y) => x === bx ? '#8a5a2a' : '#c0803a'); P(bx + 1, 3, '#c0803a'); } return true; }
    case 'alientech': for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) { const hx = Math.abs(x - 7.5) + Math.abs(y - 7.5) * 0.6; if (hx < 7) P(x, y, hx > 5.8 ? '#5a4a8a' : (x * 3 + y) % 5 === 0 ? '#c0ffe0' : hx < 2.4 ? '#7affa0' : '#3a9a6a'); }
      for (let x = 3; x < 13; x++) if (x % 3 === 0) P(x, 7, '#e0fff0'); P(7, 7, '#ffffff'); P(8, 8, '#ffffff'); return true;
    case 'uranium': for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot(x - 7.5, (y - 8.5) * 1.2) + Math.sin(x * 2.1 + y) * 0.7; if (d < 5.3) P(x, y, d < 2 ? '#d0ffa0' : (x + y) % 3 ? '#5ae030' : '#2a9a1a'); } return true;
    case 'plane': R(1, 7, 14, 8, (x, y) => y === 7 ? '#f4f4f4' : '#c8ccd0'); R(15, 7, 15, 8, '#2a6ad2'); for (let i = 0; i < 6; i++) { R(6 - i * 0.2 | 0, 6 - i, 9, 6 - i, '#b8bcc0'); R(6 - i * 0.2 | 0, 9 + i, 9, 9 + i, '#9ca0a6'); }
      R(1, 4, 2, 6, '#d02020'); R(1, 9, 2, 11, '#b01010'); P(13, 7, '#7ad0ff'); P(12, 7, '#7ad0ff'); return true;
    case 'heli': R(4, 7, 11, 11, (x, y) => y === 7 ? '#5a8a3a' : '#3a6a2a'); R(9, 8, 11, 10, '#9ad0ff'); R(0, 8, 4, 8, '#3a6a2a'); R(0, 6, 0, 9, '#2a4a1a');
      R(1, 4, 14, 4, '#222'); R(7, 5, 8, 6, '#444'); R(4, 13, 12, 13, '#333'); P(5, 12, '#333'); P(10, 12, '#333'); return true;
  }
  return false;
}

// ================== v1.12 HUSTLE UPDATE: items, blocks, recipes (gameplay lives in the v1.12 section near the game loop) ==================
// hidden stash: works like a chest but looks exactly like planks, so police raids never find it
const STASH = 129;
Object.assign(BT, { [STASH]: [9, 9, 9] });
Object.assign(HARD, { [STASH]: [2, 'axe'] });
Object.assign(BLOCK_DROP, { [STASH]: 'stash_chest' });
Object.assign(ITEMS, {
  stash_chest: { name: 'Hidden Stash (looks like planks)', block: STASH },
  fishing_rod: { name: 'Fishing Rod', emoji: '🎣', tool: { kind: 'rod', tier: 'wood' }, stack: 1 },
  raw_cod: { name: 'Raw Cod', emoji: '🐟', tag: 'RAW', food: 2 }, cooked_cod: { name: 'Cooked Cod', emoji: '🐟', tag: 'COD', food: 6 },
  raw_salmon: { name: 'Raw Salmon', emoji: '🐟', tag: 'SAL', food: 2 }, cooked_salmon: { name: 'Cooked Salmon', emoji: '🍣', food: 7 },
  tropical_fish: { name: 'Tropical Fish', emoji: '🐠', food: 1 }, pufferfish: { name: 'Pufferfish (don\'t eat it)', emoji: '🐡', food: 1 },
  moonfish: { name: 'Glowing Moonfish (rare, night)', emoji: '🐟', tag: '🌙', food: 3 }, golden_koi: { name: 'Golden Koi (rare, rain)', emoji: '🐠', tag: '⭐', food: 3 },
  fish_stew: { name: 'Fish Stew', emoji: '🍲', tag: 'FISH', food: 10, stack: 1 },
  halloween_candy: { name: 'Halloween Candy', emoji: '🍭', food: 1 },
  plug_package: { name: 'Plug Package (deliver it!)', emoji: '📦', stack: 1 },
  laundromat: { name: 'Laundromat Deed (✋ to open it)', emoji: '🧺', stack: 1 },
  car_wash: { name: 'Car Wash Deed (✋ to open it)', emoji: '🚿', stack: 1 },
});
shaped('stash_chest', 1, ['PPP', 'PCP', 'PPP'], { P: 'planks', C: 'chest' });
shaped('fishing_rod', 1, ['..S', '.SW', 'S.W'], { S: 'stick', W: 'wool' });
shapeless('halloween_candy', 4, ['berries', 'berries', 'wheat']);
shapeless('fish_stew', 1, ['cooked_cod', 'cooked_salmon', 'potato']);
Object.assign(SMELT, { raw_cod: 'cooked_cod', raw_salmon: 'cooked_salmon' });
FUEL.fishing_rod = 0.5; FUEL.stash_chest = 1.5;
Object.assign(VILLAGERS[2].buys, { cooked_cod: 9, cooked_salmon: 11, fish_stew: 40, raw_cod: 4, raw_salmon: 5, moonfish: 120, golden_koi: 150 });
Object.assign(VILLAGERS[3].sells, { fishing_rod: 14, halloween_candy: 2 });
Object.assign(VILLAGERS[3].buys, { tropical_fish: 12, pufferfish: 18, moonfish: 110, golden_koi: 140 });
Object.assign(VILLAGERS[4].sells, { halloween_candy: 2 });
Object.assign(VILLAGERS[4].buys, { halloween_candy: 3, pufferfish: 20 });

// ================== v1.13 KINGPIN UPDATE: items, blocks, recipes (gameplay lives in the v1.13 section near the game loop) ==================
// drug lab block: ✋ it to cook (steel sides, hazard-stripe top)
const LAB = 130;
Object.assign(BT, { [LAB]: [121, 114, 114] });
Object.assign(HARD, { [LAB]: [2.5, 'pick'] });
Object.assign(BLOCK_DROP, { [LAB]: 'drug_lab' });
Object.assign(ITEMS, {
  drug_lab: { name: 'Drug Lab (✋ to cook)', block: LAB },
  // heist loot (only the pawn shop wants it)
  stolen_watch: { name: 'Stolen Gold Watch', emoji: '⌚', tag: 'HOT' },
  stolen_necklace: { name: 'Stolen Necklace', emoji: '📿', tag: 'HOT' },
  diamond_ring: { name: 'Stolen Diamond Ring', emoji: '💍', tag: 'HOT' },
  vault_gold: { name: 'Vault Gold Bar (stolen)', emoji: '🪙', tag: 'HOT' },
  scratch_ticket: { name: 'Scratch-off Ticket (✋ to scratch)', emoji: '🎟️', stack: 16 },
  // lab-cooked drugs: higher purity sells for more (Pure = 70-89%, Blue Sky / Fishscale / Rock Star = 90%+)
  meth_pure: { name: 'Pure Meth (70-89%)', emoji: '🧊', tag: 'PURE', food: 1 }, meth_prime: { name: 'Blue Sky Meth (90%+)', emoji: '💎', tag: '99%', food: 1 },
  cocaine_pure: { name: 'Pure Cocaine (70-89%)', emoji: '❄️', tag: 'PURE', food: 1 }, cocaine_prime: { name: 'Fishscale Cocaine (90%+)', emoji: '❄️', tag: '99%', food: 1 },
  crack_pure: { name: 'Pure Crack (70-89%)', emoji: '🪨', tag: 'PURE', food: 1 }, crack_prime: { name: 'Rock Star Crack (90%+)', emoji: '🪨', tag: '99%', food: 1 },
  // property deeds (DealerNet 🏠 Property): ✋ one to move in where you stand
  deed_apartment: { name: 'Apartment Deed (✋ to move in)', emoji: '🏢', stack: 1 },
  deed_house: { name: 'House Deed (✋ to move in)', emoji: '🏠', stack: 1 },
  deed_penthouse: { name: 'Penthouse Deed (✋ to move in)', emoji: '🌆', stack: 1 },
});
shaped('drug_lab', 1, ['GGG', 'IFI', 'III'], { G: 'glass', I: 'iron_ingot', F: 'furnace' });


// ================== v1.14 STORY UPDATE: items + recipes (gameplay lives in the v1.14 section near the game loop) ==================
// boss drops, the ray gun's plasma cells, and hot pizzas for the delivery job. No new block ids.
Object.assign(ITEMS, {
  gold_rifle: { name: 'Don Calavera\'s Golden AK', px: 'goldrifle', stack: 1, gun: 1 },
  ray_gun: { name: 'Mothership Ray Gun', px: 'raygun', stack: 1, gun: 1 },
  plasma_cell: { name: 'Plasma Cell (ray gun ammo)', emoji: '🔋' },
  mothership_core: { name: 'Mothership Power Core', emoji: '🔮', tag: 'BOSS' },
  kingpin_crown: { name: 'Kingpin\'s Crown', emoji: '👑', tag: 'BOSS', stack: 1 },
  pizza_box: { name: 'Hot Pizza (deliver it!)', emoji: '🍕', food: 4, stack: 8 },
});
Object.assign(GUNS, {
  gold_rifle: { ammo: 'rifle_ammo', dmg: 11, rate: 0.1, auto: true, spread: 0.013, range: 95, kick: 0.02, vol: 0.36, f: 1000 },
  ray_gun: { ammo: 'plasma_cell', dmg: 14, rate: 0.32, auto: false, spread: 0.004, range: 120, kick: 0.015, vol: 0.25, f: 2600 },
});
shapeless('plasma_cell', 8, ['alien_tech', 'gunpowder']);
{ const di4 = drawIconS4; drawIconS4 = function (kind, mat, P) {
  const R = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c); };
  if (kind === 'goldrifle') {
    R(0, 7, 3, 10, (x, y) => (x + y) % 3 ? '#c99a12' : '#8a6a08'); R(4, 6, 10, 8, (x, y) => y === 6 ? '#ffe680' : '#e0b020'); R(11, 6, 15, 7, (x, y) => y === 6 ? '#fff2a0' : '#c99a12');
    for (let y = 9; y <= 13; y++) { const s = Math.round((y - 9) * 0.5); R(7 + s, y, 8 + s, y, '#b08010'); } R(5, 9, 5, 10, '#a07a10'); P(12, 8, '#c99a12'); P(9, 5, '#ffffff'); return true;
  }
  if (kind === 'raygun') {
    R(2, 6, 10, 9, (x, y) => y === 6 ? '#e8e8f0' : '#a8acb8'); R(11, 7, 14, 8, '#6aff8a'); P(15, 7, '#d0ffe0'); P(15, 8, '#d0ffe0');
    for (const x of [4, 6, 8]) R(x, 5, x, 5, '#6aff8a'); R(3, 10, 5, 14, (x, y) => x === 3 ? '#5a5e6a' : '#7a7e8a'); P(7, 10, '#5a5e6a'); P(8, 11, '#5a5e6a'); return true;
  }
  return di4(kind, mat, P);
}; }


// ================== v1.14 round 2: deep caves, the Moon, player shops, glitch easter eggs (data) ==================
// blocks 131-142 (tiles 128-142 in p_d_tiles_v114r2.js). Gameplay lives in p_z4_v114r2.js near the game loop.
const GOLD_ORE = 131, PLAT_ORE = 132, DIAMOND_ORE = 133, EMERALD_ORE = 134, MOON_DUST = 135, MOON_ROCK = 136, MOON_CRYSTAL = 137,
  BR_WALL = 138, BR_CARPET = 139, BR_LIGHT = 140, GLITCH = 141, SHOP = 142;
Object.assign(BT, { [GOLD_ORE]: [128, 128, 128], [PLAT_ORE]: [129, 129, 129], [DIAMOND_ORE]: [130, 130, 130], [EMERALD_ORE]: [131, 131, 131],
  [MOON_DUST]: [132, 134, 133], [MOON_ROCK]: [134, 134, 134], [MOON_CRYSTAL]: [135, 135, 135], [BR_WALL]: [136, 136, 136], [BR_CARPET]: [137, 137, 137],
  [BR_LIGHT]: [138, 138, 138], [GLITCH]: [140, 140, 140], [SHOP]: [142, 9, 141] });
Object.assign(HARD, { [GOLD_ORE]: [3, 'pick', 2], [PLAT_ORE]: [4, 'pick', 3], [DIAMOND_ORE]: [5, 'pick', 3], [EMERALD_ORE]: [4.5, 'pick', 3],
  [MOON_DUST]: [0.5, 'shovel'], [MOON_ROCK]: [2, 'pick', 1], [MOON_CRYSTAL]: [1.2, 'pick', 1], [BR_WALL]: [1, 'axe'], [BR_CARPET]: [0.6, null], [BR_LIGHT]: [0.5, null],
  [GLITCH]: [99, 'pick', 9], [SHOP]: [2, 'axe'] });
Object.assign(BLOCK_DROP, { [GOLD_ORE]: 'gold_ore', [PLAT_ORE]: 'platinum_ore', [DIAMOND_ORE]: 'diamond', [EMERALD_ORE]: 'emerald', [MOON_DUST]: 'moon_dust',
  [MOON_ROCK]: 'moon_rock', [MOON_CRYSTAL]: 'moon_crystal', [BR_WALL]: 'br_wall', [BR_CARPET]: 'br_carpet', [BR_LIGHT]: 'br_light', [SHOP]: 'shop_stall' });
Object.assign(TIERS, { diamond: { lvl: 5, speed: 11, dur: 2000, dmg: 5 } });
Object.assign(ITEMS, {
  gold_ore: { name: 'Gold Ore', block: GOLD_ORE }, platinum_ore: { name: 'Platinum Ore', block: PLAT_ORE },
  diamond_ore: { name: 'Diamond Ore', block: DIAMOND_ORE }, emerald_ore: { name: 'Emerald Ore', block: EMERALD_ORE },
  diamond: { name: 'Diamond', px: 'gem', mat: 'diamond' }, emerald: { name: 'Emerald', px: 'gem', mat: 'emerald' },
  moon_dust: { name: 'Moon Dust', block: MOON_DUST }, moon_rock: { name: 'Moon Rock', block: MOON_ROCK },
  moon_crystal: { name: 'Moon Crystal (glows)', px: 'gem', mat: 'moon' }, moon_cheese: { name: 'Moon Cheese (it\'s real!)', emoji: '🧀', food: 5 },
  alien_relic: { name: 'Alien Relic', emoji: '🗿', tag: 'MOON' },
  shop_stall: { name: 'Shop Stall (place it, ✋ to sell)', block: SHOP },
  br_wall: { name: 'Yellow Wallpaper (???)', block: BR_WALL }, br_carpet: { name: 'Damp Carpet (???)', block: BR_CARPET }, br_light: { name: 'Buzzing Ceiling Light', block: BR_LIGHT },
  golden_bug: { name: 'Buggy\'s Golden Bug 🐛 (one of a kind)', emoji: '🐛', tag: '★', stack: 1 },
  torn_note: { name: 'Torn Note (✋ to read)', emoji: '📜', stack: 8 },
});
ITEMS.diamond_pickaxe = { name: 'Diamond Pickaxe', px: 'pick', mat: 'diamond', tool: { kind: 'pick', tier: 'diamond' }, stack: 1 };
ITEMS.diamond_axe = { name: 'Diamond Hatchet', px: 'axe', mat: 'diamond', tool: { kind: 'axe', tier: 'diamond' }, stack: 1 };
ITEMS.diamond_hoe = { name: 'Diamond Hoe (3x3)', px: 'hoe', mat: 'diamond', tool: { kind: 'hoe', tier: 'diamond' }, stack: 1 };
ITEMS.diamond_sword = { name: 'Diamond Sword', px: 'sword', mat: 'diamond', tool: { kind: 'sword', tier: 'diamond' }, stack: 1 };
ITEMS.diamond_shovel = { name: 'Diamond Shovel', px: 'shovel', mat: 'diamond', tool: { kind: 'shovel', tier: 'diamond' }, stack: 1 };
ARMOR_PTS.diamond = [3, 9, 7, 3];
ARMOR_SLOTS.forEach((s, i) => { ITEMS['diamond_' + s] = { name: 'Diamond ' + ['Helmet', 'Chestplate', 'Leggings', 'Boots'][i], px: s, mat: 'diamond', armor: { slot: i, pts: ARMOR_PTS.diamond[i] }, stack: 1 }; });
ARMOR_MATS.diamond = ['Diamond', 'diamond'];
shaped('diamond_pickaxe', 1, ['MMM', '.S.', '.S.'], { M: 'diamond', S: 'stick' });
shaped('diamond_axe', 1, ['MM', 'MS', '.S'], { M: 'diamond', S: 'stick' });
shaped('diamond_hoe', 1, ['MM', '.S', '.S'], { M: 'diamond', S: 'stick' });
shaped('diamond_sword', 1, ['M', 'M', 'S'], { M: 'diamond', S: 'stick' });
shaped('diamond_shovel', 1, ['M', 'S', 'S'], { M: 'diamond', S: 'stick' });
shaped('diamond_helmet', 1, ['LLL', 'L.L'], { L: 'diamond' });
shaped('diamond_chest', 1, ['L.L', 'LLL', 'LLL'], { L: 'diamond' });
shaped('diamond_legs', 1, ['LLL', 'L.L', 'L.L'], { L: 'diamond' });
shaped('diamond_boots', 1, ['L.L', 'L.L'], { L: 'diamond' });
shaped('shop_stall', 1, ['WWW', 'PCP'], { W: 'wool', P: 'planks', C: 'chest' });
Object.assign(SMELT, { gold_ore: 'gold_ingot', platinum_ore: 'platinum_ingot', moon_dust: 'glass' });
// gem icon (diamond / emerald / moon crystal)
{ const di5 = drawIconS4; drawIconS4 = function (kind, mat, P) {
  if (kind === 'gem') {
    const [l, d] = MATCOL[mat] || MATCOL.diamond;
    const rows = ['....######....', '...#LLLLLL#...', '..#LLWLLLLL#..', '.#LLWLLLLLDD#.', '#DDDDDDDDDDDD#', '.#DLLLLLLLDD#.', '..#DLLLLLDD#..', '...#DLLLDD#...', '....#DLDD#....', '.....#DD#.....', '......##......'];
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') return; P(x + 1, y + 3, ch === '#' ? '#1a2a3a' : ch === 'W' ? '#ffffff' : ch === 'L' ? l : d); }));
    return true;
  }
  return di5(kind, mat, P);
}; }

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
// online: a guest plays in the host's world (sent before the reload) but keeps their own bag
const MP = (() => { try { return JSON.parse(localStorage.getItem('dc_mp')); } catch (e) { return null; } })();
const MP_GUEST = !!(MP && MP.role === 'guest');
const INV_KEYS = ['slots', 'armor', 'off', 'sel', 'coins', 'earned', 'hp', 'food', 'sat'];
const emptySlots = n => Array.from({ length: n }, () => null);
function newState() {
  const slots = emptySlots(36);
  slots[0] = { id: 'wood_hoe', n: 1, d: TIERS.wood.dur }; slots[1] = { id: 'seeds_wheat', n: 8 }; slots[2] = { id: 'seeds_carrot', n: 4 };
  slots[3] = { id: 'seeds_pumpkin', n: 3 }; slots[4] = { id: 'bread', n: 3 };
  return { seed: (Math.random() * 1e9) | 0, edits: {}, crops: {}, slots, armor: emptySlots(4), sel: 0,
    coins: 20, earned: 0, time: DAY * 0.3, gameTime: 0, pos: [VX + 0.5, G + 1, VZ - 4.5], yaw: Math.PI, pitch: -0.2,
    hp: 20, food: 20, sat: 5, furnaces: {}, graves: {}, chests: {}, poops: {}, dev: {}, spawn: null, off: null, v: 2, v109: 1, genV: 2, townV: 3, siteV: 4, pets: [], waypoints: [], boats: [] };
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
  if (s.sat == null) s.sat = 5; if (!s.furnaces) s.furnaces = {}; if (!s.graves) s.graves = {}; if (!s.chests) s.chests = {}; if (!s.poops) s.poops = {}; if (!s.dev) s.dev = {}; if (!Array.isArray(s.pets)) s.pets = []; if (!Array.isArray(s.waypoints)) s.waypoints = []; if (!Array.isArray(s.boats)) s.boats = [];
  s.v = 2; return s;
}
function load() {
  if (MP_GUEST) try { const w = JSON.parse(localStorage.getItem('dc_mp_world')), inv = JSON.parse(localStorage.getItem('dc_mp_inv')) || {};
    if (w && w.seed != null) { const s = migrate(Object.assign(newState(), w, inv)); if (!w.genV) keepOldTerrain(s, w, null); if (!w.townV) s.townV = 0; if (!w.siteV) s.siteV = 0; s._welcomed = true; return s; } } catch (e) {}
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.seed != null) { const old = !s.v109, st = migrate(Object.assign(newState(), s));
    if (old) { const ks = new Set(); for (const k in s.edits || {}) { const p = k.split(','); ks.add(Math.floor(+p[0] / 16) + ',' + Math.floor(+p[2] / 16)); } st.gyOld = [...ks]; }   // no new graveyards where you already built
    if (!s.genV) keepOldTerrain(st, s, 'dealercraft_map_' + SLOT);   // v1.10: land you built on or explored keeps its old shape
    if (!s.townV) keepOldTowns(st, s, 'dealercraft_map_' + SLOT);    // v1.10 step 3: towns you've seen keep their old buildings
    if (!s.siteV) keepOldSites(st, s, 'dealercraft_map_' + SLOT);    // v1.10 step 4: no new sites where you've built or explored
    return st; } } catch (e) {}
  return null;
}
// pre-1.10 world: remember every chunk that has edits or is on your explored map, those keep the old terrain
function keepOldTerrain(st, s, mapKey) {
  const ks = new Set(); for (const k in s.edits || {}) { const p = k.split(','); ks.add(Math.floor(+p[0] / 16) + ',' + Math.floor(+p[2] / 16)); }
  if (mapKey) try { const o = JSON.parse(localStorage.getItem(mapKey)); if (o && o.seed === s.seed && o.c) for (const k in o.c) ks.add(k); } catch (e) {}
  st.oldCh = [...ks]; st.genV = 2;
}
// pre-step-3 world: towns in regions you built in or explored keep their step-2 buildings (no big cities / interiors there)
function keepOldTowns(st, s, mapKey) {
  const ks = new Set(st.oldCh || []); for (const k in s.edits || {}) { const p = k.split(','); ks.add(Math.floor(+p[0] / 16) + ',' + Math.floor(+p[2] / 16)); }
  if (mapKey) try { const o = JSON.parse(localStorage.getItem(mapKey)); if (o && o.seed === s.seed && o.c) for (const k in o.c) ks.add(k); } catch (e) {}
  st.townOld = [...ks]; st.townV = 3;
}
// pre-step-4 world: regions you built in or explored never get a prison / Area 51 / power plant / airport / crash site
function keepOldSites(st, s, mapKey) {
  const ks = new Set(st.townOld || []); for (const k in s.edits || {}) { const p = k.split(','); ks.add(Math.floor(+p[0] / 16) + ',' + Math.floor(+p[2] / 16)); }
  if (mapKey) try { const o = JSON.parse(localStorage.getItem(mapKey)); if (o && o.seed === s.seed && o.c) for (const k in o.c) ks.add(k); } catch (e) {}
  st.siteOld = [...ks]; st.siteV = 4;
}
let saveBlocked = false;
function save() {
  if (saveBlocked) return;
  state.pos = [player.pos.x, player.pos.y, player.pos.z]; state.yaw = player.yaw; state.pitch = player.pitch;
  try { syncPets(); saveExplored(); syncBoats(); } catch (e) {}
  if (MP_GUEST) { const inv = {}; for (const k of INV_KEYS) inv[k] = state[k]; try { localStorage.setItem('dc_mp_inv', JSON.stringify(inv)); } catch (e) {} return; }
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
const solid = id => id !== AIR && !isWater(id) && !(isDoor(id) && doorOpen(id)) && !PLANT.has(id);

// edits indexed by chunk so they can be re-applied when a chunk generates
const editIdx = new Map();
function indexEdit(k) { const [x, , z] = k.split(',').map(Number); const ck = ckey(fdiv(x, CH), fdiv(z, CH)); if (!editIdx.has(ck)) editIdx.set(ck, new Set()); editIdx.get(ck).add(k); }

const clamp01 = v => Math.max(0, Math.min(1, v));
// ---- towns: the world is cut into regions of TREG x TREG chunks; some regions hold a village or a city
// laid out on a road grid (4-wide roads every 16 blocks, sidewalks, 10x10 building lots)
const TREG = 5, townMemo = new Map();
function townOf(rx, rz) {
  const k = rx + ',' + rz; if (townMemo.has(k)) return townMemo.get(k);
  let t = metroOf(fdiv(rx, 2), fdiv(rz, 2));   // v1.10 step 3: a massive city can cover a 2x2 block of regions
  if (t) { townMemo.set(k, t); return t; }
  const x0 = (rx * TREG + 1) * CH, z0 = (rz * TREG + 1) * CH, cx = x0 + 26, cz = z0 + 26;
  if (Math.hypot(cx - VX, cz - VZ) > 110) {
    const r = hash2(rx, rz, state.seed + 900);
    const type = r < 0.14 ? 'city' : r < 0.4 ? 'village' : null;
    if (type) t = { type, rx, rz, x0, z0, x1: x0 + 3 * CH + 4, z1: z0 + 3 * CH + 4, base: Math.round(Math.max(SEA + 3, Math.min(20, regionOld(rx, rz) ? heightOld(cx, cz) : terrainNat(cx, cz).h))), id: k, nb: 3, legacy: regionTownOld(rx, rz) };
  }
  townMemo.set(k, t); return t;
}
const townAt = (x, z) => townOf(fdiv(fdiv(x, CH), TREG), fdiv(fdiv(z, CH), TREG));
const inTown = (t, x, z, m = 0) => t && x >= t.x0 - m && x < t.x1 + m && z >= t.z0 - m && z < t.z1 + m;
// what a town cell is: 'road' (with lane info), 'walk' or 'lot'
function townCell(t, x, z) {
  const u = (x - t.x0) % 16, v = (z - t.z0) % 16, ru = u < 4 || x >= t.x1 - 4, rv = v < 4 || z >= t.z1 - 4;
  if (ru || rv) return 'road';
  if (u === 4 || u === 15 || v === 4 || v === 15) return 'walk';
  return 'lot';
}
function heightAt(x, z) { return oldAt(x, z) ? heightAtOld(x, z) : terrainAt(x, z).h; }
function heightAtOld(x, z) {
  let h = heightOld(x, z); const t = townAt(x, z);
  if (t) {
    const dx = Math.max(t.x0 - x, 0, x - (t.x1 - 1)), dz = Math.max(t.z0 - z, 0, z - (t.z1 - 1)), d = Math.hypot(dx, dz);
    if (d < 14) { const k = d / 14, s = k * k * (3 - 2 * k); h = Math.round(t.base + (h - t.base) * s); }
  }
  return h;
}
function heightNat(x, z) { return oldAt(x, z) ? heightOld(x, z) : terrainNat(x, z).h; }
function heightOld(x, z) {   // the pre-1.10 terrain (kept for chunks you had built in or explored)
  const s = state.seed;
  const cont = clamp01((vnoise(x / 150, z / 150, s + 101) - 0.5) * 1.8 + 0.5);       // continents vs. seas
  const mount = clamp01((vnoise(x / 75, z / 75, s + 202) - 0.55) / 0.4);              // mountain ranges
  let h = 1 + cont * 19 + (fbm(x, z, s) - 0.5) * 9 + mount * mount * 20 * cont;
  const dist = Math.hypot(x - VX, z - VZ);
  const t = clamp01((dist - 13) / 9);                                                // flatten the village
  h = G * (1 - t) + h * t;
  return Math.max(1, Math.min(32, Math.round(h)));
}
const deadAt = (x, z) => vnoise(x / 90, z / 90, state.seed + 303) > 0.6;              // spooky dead woods biome
const forestAt = (x, z) => vnoise(x / 45, z / 45, state.seed + 404);

// ================== v1.10 terrain: mountains, rivers, lakes, ponds, biomes ==================
// Chunks from a pre-1.10 save that you had built in or explored (state.oldCh) keep the old generator above,
// and so do towns whose region touches one of them.
let oldChSet = null;
const legacyWorld = () => !(state.genV >= 2);
function isOldCh(cx, cz) { if (legacyWorld()) return true; if (!oldChSet) oldChSet = new Set(state.oldCh || []); return oldChSet.size > 0 && oldChSet.has(cx + ',' + cz); }
const oldAt = (x, z) => isOldCh(fdiv(x, CH), fdiv(z, CH));
function regionOld(rx, rz) { if (legacyWorld()) return true; for (let i = 0; i < TREG; i++) for (let j = 0; j < TREG; j++) if (isOldCh(rx * TREG + i, rz * TREG + j)) return true; return false; }
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
// climate: temperature and moisture drift slowly across the world
const tempAt = (x, z) => vnoise(x / 260, z / 260, state.seed + 707) * 0.8 + vnoise(x / 61, z / 61, state.seed + 717) * 0.2;
const moistAt = (x, z) => vnoise(x / 200, z / 200, state.seed + 808);
function biomeOf(x, z) {
  const t = tempAt(x, z), m = moistAt(x, z);
  if (t < 0.35) return 'snow';
  if (t > 0.6) return m < 0.46 ? 'desert' : 'savanna';
  if (m > 0.58 || forestAt(x, z) > 0.64) return 'forest';
  return 'plains';
}
// natural height + water level of one column (before towns flatten it)
function terrainNat(x, z) {
  const s = state.seed;
  const cont = clamp01((vnoise(x / 150, z / 150, s + 101) - 0.5) * 1.8 + 0.5);
  const hs = 1 + cont * 19;                                                          // smooth land level
  let h = hs + (fbm(x, z, s) - 0.5) * 9;
  const dist = Math.hypot(x - VX, z - VZ), sp = clamp01((dist - 13) / 9), far = sstep(48, 90, dist);
  // rivers: the zero line of a warped noise field winds across the land and runs out to the sea
  const rn = (vnoise(x / 150, z / 150, s + 505) - 0.5) + (vnoise(x / 47, z / 47, s + 515) - 0.5) * 0.32, rd = Math.abs(rn), RW = 0.02;
  const riv = far * (1 - sstep(RW, RW * 5, rd));
  // mountains: tall ridged ranges, kept away from spawn and river valleys
  let mm = sstep(0.52, 0.8, vnoise(x / 125, z / 125, s + 202));
  const ridge = 1 - Math.abs(vnoise(x / 36, z / 36, s + 212) * 2 - 1);
  const mountH = mm * (10 + ridge * ridge * 28 + vnoise(x / 8, z / 8, s + 222) * 4) * (0.45 + 0.55 * cont) * far * (1 - riv);
  h += mountH;
  let wl = SEA;
  if (riv > 0 && h > SEA + 1) h = h + (SEA + 1 - h) * riv;
  if (far > 0.99 && rd < RW) h = Math.min(h, SEA - 1 - Math.round((1 - rd / RW) * 2.4));
  // lakes and ponds sit at their own level (can be above the sea)
  const flatOK = (1 - sstep(0.04, 0.22, mm)) * (1 - riv) * far;
  if (flatOK > 0) {
    const lake = (n, a, b, dmax) => {
      const w = sstep(a, b, n) * flatOK; if (w <= 0) return;
      const rim = Math.round(hs); h = h + (rim - h) * w;
      if (w > 0.995 && n > b) { const lv = Math.max(SEA, rim - 1); h = Math.min(h, lv - 1 - Math.round((n - b) / (1 - b) * dmax)); wl = Math.max(wl, lv); }
    };
    lake(vnoise(x / 46, z / 46, s + 909), 0.7, 0.77, 6);
    lake(vnoise(x / 13, z / 13, s + 919), 0.8, 0.86, 3);
  }
  if (wl > SEA) {   // a raised lake can't step down to a lower level next door: leave a little dam there instead
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c2 = clamp01((vnoise((x + dx) / 150, (z + dz) / 150, s + 101) - 0.5) * 1.8 + 0.5);
      if (Math.max(SEA, Math.round(1 + c2 * 19) - 1) < wl) { h = wl; wl = SEA; break; }
    }
  }
  h = G * (1 - sp) + h * sp;
  return { h: Math.max(1, Math.min(58, Math.round(h))), wl, mm, riv };
}
// with towns flattened in (rivers and lakes stop at the town's edge); raised water never hangs over lower ground
function terrainAt(x, z) {
  const n = terrainRaw(x, z);
  if (n.wl > SEA && n.h < n.wl) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = terrainRaw(x + dx, z + dz); if (u.h < n.wl && u.wl < n.wl) { n.h = n.wl; n.wl = SEA; break; } }
  return n;
}
function terrainRaw(x, z) {
  const n = terrainNat(x, z), t = townAt(x, z);
  if (t) {
    const dx = Math.max(t.x0 - x, 0, x - (t.x1 - 1)), dz = Math.max(t.z0 - z, 0, z - (t.z1 - 1)), d = Math.hypot(dx, dz);
    if (d < 18 && n.wl > SEA) { n.h = Math.max(n.h, n.wl); n.wl = SEA; }   // no raised lakes right next to a town
    if (d < 14) { const k = d / 14, s = k * k * (3 - 2 * k); n.h = Math.round(t.base + (n.h - t.base) * s); }
  }
  return n;
}

function genChunk(cx, cz) {
  const c = new Uint8Array(CH * CH * H); data.set(ckey(cx, cz), c);
  const x0 = cx * CH, z0 = cz * CH, hm = new Int16Array(CH * CH);
  const L = (lx, y, lz, v) => { if (lx >= 0 && lz >= 0 && lx < CH && lz < CH && y >= 0 && y < H) c[lidx(lx, y, lz)] = v; };
  const Lget = (lx, y, lz) => c[lidx(lx, y, lz)];
  const town = townAt(x0 + 8, z0 + 8), townChunk = town && inTown(town, x0 + 8, z0 + 8, 8);
  const rnd = mulberry(hash2(cx, cz, state.seed) * 1e9 | 0);
  if (!isOldCh(cx, cz)) genNew(cx, cz, c, hm, L, Lget, town, rnd);
  else {   // ---- pre-1.10 generator (unchanged)
    for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
      const x = x0 + lx, z = z0 + lz, h = heightAtOld(x, z); hm[lx + lz * CH] = h;
      const dead = deadAt(x, z);
      for (let y = 0; y <= h; y++) {
        let b = y < h - 3 ? STONE : DIRT;
        if (y === h) b = h <= SEA + 1 ? SAND : h >= 27 ? STONE : dead ? DEADGRASS : GRASS;
        if (b === STONE) { const r = hash3(x, y, z, state.seed); if (y <= 20 && r < 0.012) b = IRON_ORE; else if (r > 0.982) b = COAL_ORE; }
        if (y === 0) b = BEDROCK;
        if (y === h && town && inTown(town, x, z)) { const tc = townCell(town, x, z); b = tc === 'road' ? ASPHALT : tc === 'walk' ? (town.type === 'city' ? SIDEWALK : GRASS) : (town.type === 'city' ? SIDEWALK : GRASS); }
        L(lx, y, lz, b);
      }
      for (let y = h + 1; y <= SEA; y++) L(lx, y, lz, WATER);
    }
    // trees and wild pumpkins (kept inside the chunk so neighbours never matter)
    const dens = forestAt(x0 + 8, z0 + 8), nTrees = Math.floor(dens * dens * 9);
    for (let i = 0; i < nTrees; i++) {
      const lx = 2 + Math.floor(rnd() * (CH - 4)), lz = 2 + Math.floor(rnd() * (CH - 4)), x = x0 + lx, z = z0 + lz;
      if (Math.hypot(x - VX, z - VZ) < 18 || Math.hypot(x - GX, z - GZ) < 6 || inTown(town, x, z, 3)) continue;
      const h = hm[lx + lz * CH], top = Lget(lx, h, lz);
      if (top !== GRASS && top !== DEADGRASS) continue;
      const th = 4 + Math.floor(rnd() * 3);
      for (let y = 1; y <= th; y++) L(lx, h + y, lz, LOG);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 1], [-1, 2], [1, -2], [-2, -1]]) {   // red mushrooms pop up around tree roots
        if (hash3(x + dx, h, z + dz, state.seed + 77) < 0.015 && Lget(lx + dx, h, lz + dz) === GRASS && Lget(lx + dx, h + 1, lz + dz) === AIR) L(lx + dx, h + 1, lz + dz, RED_MUSH);
      }
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
        if (Math.hypot(x - VX, z - VZ) < 16 || inTown(town, x, z, 2)) continue;
        const h = hm[lx + lz * CH], top = Lget(lx, h, lz);
        if ((top === GRASS || top === DEADGRASS) && Lget(lx, h + 1, lz) === AIR) L(lx, h + 1, lz, PUMPKIN);
      }
    }
  }
  // cows graze in grassy chunks
  if (rnd() < 0.28 && !townChunk) spawnCowsIn(x0, z0, hm, rnd);
  if (town) stampTown(town, cx, cz, L, Lget);
  // village & graveyard (fixed structures; each chunk stamps only its own part)
  if (x0 < VX + 24 && x0 + CH > VX - 24 && z0 < VZ + 24 && z0 + CH > VZ - 24) stampVillage((x, y, z, v) => L(x - x0, y, z - z0, v));
  // old graveyards, scattered by chunk hash (never in a chunk you had already built in before v1.09)
  if (!townChunk && hash2(cx, cz, state.seed + 1717) < 0.03 && Math.hypot(x0 + 8 - VX, z0 + 8 - VZ) > 70) {
    if (!gyOldSet) gyOldSet = new Set(state.gyOld || []);
    if (!gyOldSet.has(ckey(cx, cz))) stampGraveyard(cx, cz, hm, L, Lget);
  }
  stampSites(cx, cz, hm, L, Lget, townChunk);   // v1.10 step 4: prisons, Area 51, power plants, airports, UFO crash sites
  // re-apply the player's edits
  const ed = editIdx.get(ckey(cx, cz));
  if (ed) for (const k of ed) { const [x, y, z] = k.split(',').map(Number); let v = state.edits[k];
    const lx = x - x0, lz = z - z0, g = (lx >= 0 && lz >= 0 && lx < CH && lz < CH && y >= 0 && y < H) ? c[lidx(lx, y, lz)] : AIR;
    if (isDoor(v) && isDoor(g) && doorF(v) !== doorF(g)) { v = doorId(doorF(g), doorOpen(v), doorTop(v)); state.edits[k] = v; }   // village doors keep their new outside-facing side in old saves
    L(lx, y, lz, v); }
  chunkColors(cx, cz);   // remember it for the map / GPS
}
let gyOldSet = null;
// ---- v1.10 chunk filler: biomes, stone cliffs, snow caps, rivers/lakes, biome trees
const chunkBiome = new Map();   // chunk key -> biome at its centre (wildlife, HUD)
function genNew(cx, cz, c, hm, L, Lget, town, rnd) {
  const x0 = cx * CH, z0 = cz * CH, W = CH + 2, th = new Int16Array(W * W), tw = new Int16Array(W * W);
  for (let dz = 0; dz < W; dz++) for (let dx = 0; dx < W; dx++) { const t = terrainAt(x0 + dx - 1, z0 + dz - 1); th[dz * W + dx] = t.h; tw[dz * W + dx] = t.wl; }
  const bio = biomeOf(x0 + 8, z0 + 8); chunkBiome.set(ckey(cx, cz), bio);
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const x = x0 + lx, z = z0 + lz, i = (lz + 1) * W + lx + 1, h = th[i], wl = tw[i]; hm[lx + lz * CH] = h;
    const b0 = biomeOf(x, z), dead = deadAt(x, z) && b0 !== 'snow' && b0 !== 'desert';
    let slope = 0; for (const o of [1, -1, W, -W]) slope = Math.max(slope, Math.abs(th[i + o] - h));
    const snowLine = b0 === 'snow' ? 30 : b0 === 'desert' ? 99 : 44 + Math.floor(hash2(x, z, state.seed + 31) * 4);
    let top;
    if (h <= wl + 1) top = (b0 === 'snow' && h > wl) ? SNOW_GRASS : SAND;
    else if (h >= snowLine) top = SNOW;
    else if (h >= 38 || (slope >= 3 && h >= 22) || slope >= 5) top = STONE;
    else if (b0 === 'snow') top = SNOW_GRASS;
    else if (b0 === 'desert') top = SAND;
    else top = dead ? DEADGRASS : GRASS;
    const soil = top === SAND && b0 === 'desert' ? SAND : top === STONE || h >= 38 || (top === SNOW && slope >= 3) ? STONE : DIRT;
    for (let y = 0; y <= h; y++) {
      let b = y < h - 3 ? STONE : soil;
      if (y === h) b = top;
      if (b === STONE) { const r = hash3(x, y, z, state.seed); if (y <= 20 && r < 0.012) b = IRON_ORE; else if (r > 0.982) b = COAL_ORE; }
      if (y === 0) b = BEDROCK;
      if (y === h && town && inTown(town, x, z)) { const tc = townCell(town, x, z); b = tc === 'road' ? ASPHALT : town.type === 'city' ? SIDEWALK : GRASS; }
      L(lx, y, lz, b);
    }
    for (let y = h + 1; y <= wl; y++) L(lx, y, lz, y === wl && b0 === 'snow' && tempAt(x, z) < 0.34 ? ICE : WATER);
    if ((top === SNOW_GRASS || top === SNOW) && h >= wl && hash2(x, z, state.seed + 41) < 0.55 && !inTown(town, x, z, 2)) L(lx, h + 1, lz, SNOW_LAYER);
  }
  // trees by biome (kept inside the chunk so neighbours never matter)
  const nearSpawn = (x, z) => Math.hypot(x - VX, z - VZ) < 18 || Math.hypot(x - GX, z - GZ) < 6 || inTown(town, x, z, 3);
  const fd = forestAt(x0 + 8, z0 + 8);
  const nTrees = bio === 'forest' ? 5 + Math.floor(rnd() * 5) : bio === 'snow' ? 2 + Math.floor(rnd() * 4) : bio === 'savanna' ? Math.floor(rnd() * 2.6) : bio === 'desert' ? Math.floor(rnd() * 4) : Math.floor(fd * fd * 4 + rnd() * 1.2);
  for (let i = 0; i < nTrees; i++) {
    const lx = 3 + Math.floor(rnd() * (CH - 6)), lz = 3 + Math.floor(rnd() * (CH - 6)), x = x0 + lx, z = z0 + lz;
    if (nearSpawn(x, z)) continue;
    const h = hm[lx + lz * CH], top = Lget(lx, h, lz), b = biomeOf(x, z);
    if (top === SAND && b === 'desert' && h > SEA + 1) {   // cactus
      const ch = 1 + Math.floor(rnd() * 3); if (Lget(lx, h + 1, lz) !== AIR) continue; for (let y = 1; y <= ch; y++) L(lx, h + y, lz, CACTUS); continue;
    }
    if (top !== GRASS && top !== DEADGRASS && top !== SNOW_GRASS) continue;
    if (Lget(lx, h + 1, lz) === SNOW_LAYER) L(lx, h + 1, lz, AIR);
    if (top === SNOW_GRASS || (b === 'forest' && tempAt(x, z) < 0.45 && rnd() < 0.6)) {   // spruce: tall trunk, stacked cones
      const t = 6 + Math.floor(rnd() * 4);
      for (let y = 1; y <= t; y++) L(lx, h + y, lz, LOG);
      for (let dy = 2; dy <= t + 1; dy++) { const k = t + 1 - dy, r = dy === t + 1 ? 0 : k % 2 === 0 ? 1 : Math.min(2, 1 + (k >> 2));
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (Math.abs(dx) + Math.abs(dz) <= r + (r > 1 ? 0 : 1) && !(dx === 0 && dz === 0 && dy <= t) && Lget(lx + dx, h + dy, lz + dz) === AIR) L(lx + dx, h + dy, lz + dz, SPRUCE); }
      L(lx, h + t + 2, lz, SPRUCE); continue;
    }
    if (b === 'savanna') {   // acacia: a leaning trunk and a flat umbrella crown
      const t = 4 + Math.floor(rnd() * 2), [ox, oz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)];
      let px = lx, pz = lz; for (let y = 1; y <= t; y++) { if (y === t - 1) { px += ox; pz += oz; } L(px, h + y, pz, LOG); }
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { if (Math.abs(dx) + Math.abs(dz) > 4) continue; if (Lget(px + dx, h + t + 1, pz + dz) === AIR) L(px + dx, h + t + 1, pz + dz, LEAVES); }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Lget(px + dx, h + t + 2, pz + dz) === AIR) L(px + dx, h + t + 2, pz + dz, LEAVES);
      continue;
    }
    const t = 4 + Math.floor(rnd() * 3);
    for (let y = 1; y <= t; y++) L(lx, h + y, lz, LOG);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 1], [-1, 2], [1, -2], [-2, -1]])
      if (hash3(x + dx, h, z + dz, state.seed + 77) < 0.015 && Lget(lx + dx, h, lz + dz) === GRASS && Lget(lx + dx, h + 1, lz + dz) === AIR) L(lx + dx, h + 1, lz + dz, RED_MUSH);
    if (top === DEADGRASS) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) { const [dx, dz] = dirs[Math.floor(rnd() * 4)], by = h + t - Math.floor(rnd() * 2); L(lx + dx, by, lz + dz, LOG); L(lx + dx * 2, by + 1, lz + dz * 2, LOG); }
      continue;
    }
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = t - 1; dy <= t + 1; dy++) {
      const r = Math.abs(dx) + Math.abs(dz) + (dy > t ? 1 : 0);
      if (r <= 3 && Lget(lx + dx, h + dy, lz + dz) === AIR && !(dx === 0 && dz === 0 && dy <= t)) L(lx + dx, h + dy, lz + dz, LEAVES);
    }
  }
  if (rnd() < 0.3 && (bio === 'plains' || bio === 'forest')) {   // a wild pumpkin patch
    const px = 3 + Math.floor(rnd() * 10), pz = 3 + Math.floor(rnd() * 10);
    for (let i = 0; i < 4 + Math.floor(rnd() * 4); i++) {
      const lx = px + Math.floor(rnd() * 5) - 2, lz = pz + Math.floor(rnd() * 5) - 2, x = x0 + lx, z = z0 + lz;
      if (Math.hypot(x - VX, z - VZ) < 16 || inTown(town, x, z, 2)) continue;
      const h = hm[lx + lz * CH], top = Lget(lx, h, lz);
      if ((top === GRASS || top === DEADGRASS) && Lget(lx, h + 1, lz) === AIR) L(lx, h + 1, lz, PUMPKIN);
    }
  }
}
function stampGraveyard(cx, cz, hm, L, Lget) {
  const r = mulberry(hash2(cx, cz, state.seed + 1718) * 1e9 | 0), cols = 2 + Math.floor(r() * 3), rows = 2 + Math.floor(r() * 2);
  const ox = 2 + Math.floor(r() * (13 - cols * 3)), oz = 2 + Math.floor(r() * (12 - rows * 4));
  const ok = (lx, lz) => { const h = hm[lx + lz * CH], t = Lget(lx, h, lz); return h > SEA + 1 && (t === GRASS || t === DEADGRASS || t === DIRT) && Lget(lx, h + 1, lz) === AIR; };
  let n = 0;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const lx = ox + i * 3, lz = oz + 1 + j * 4; if (lx > 14 || lz + 1 > 14 || r() < 0.15) continue;
    if (!ok(lx, lz) || !ok(lx, lz + 1) || !ok(lx, lz - 1)) continue;
    const h = hm[lx + lz * CH];
    if (Math.abs(hm[lx + (lz + 1) * CH] - h) > 1 || Math.abs(hm[lx + (lz - 1) * CH] - h) > 1) continue;
    L(lx, h, lz, GRAVE_DIRT); L(lx, hm[lx + (lz + 1) * CH], lz + 1, GRAVE_DIRT);
    L(lx, hm[lx + (lz - 1) * CH] + 1, lz - 1, TOMB); n++;
  }
  if (n && r() < 0.7) {   // a spooky lantern post at the corner
    const lx = Math.max(1, ox - 1), lz = Math.max(1, oz - 1), h = hm[lx + lz * CH];
    if (h > SEA + 1 && Lget(lx, h + 1, lz) === AIR) { L(lx, h + 1, lz, LOG); L(lx, h + 2, lz, JACK); }
  }
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

// ---- town builder: each chunk of a town stamps only its own lot, sidewalk lamps and garages
const townSpots = new Map();   // chunk key -> [{kind:'car'|'trader', x, z, f}] for the town spawner
function stampTown(t, cx, cz, L, Lget) {
  const x0 = cx * CH, z0 = cz * CH, B = t.base, city = t.type === 'city';
  const i = cx - (t.rx * TREG + 1), j = cz - (t.rz * TREG + 1);
  const spots = []; townSpots.set(ckey(cx, cz), spots);
  const lamp = (lx, lz, tall = 3) => { if (lx < 0 || lz < 0 || lx >= CH || lz >= CH) return; for (let y = 1; y < tall; y++) L(lx, B + y, lz, CONCRETE); L(lx, B + tall, lz, LAMP); torches.add((x0 + lx) + ',' + (B + tall) + ',' + (z0 + lz)); };
  // crosswalk stripes next to each intersection
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const x = x0 + lx, z = z0 + lz; if (!inTown(t, x, z)) continue;
    const u = (x - t.x0) % 16, v = (z - t.z0) % 16, ru = u < 4 || x >= t.x1 - 4, rv = v < 4 || z >= t.z1 - 4;
    if (ru && !rv && (v === 4 || v === 15)) L(lx, B, lz, CROSSWALK);
    if (rv && !ru && (u === 4 || u === 15)) L(lx, B, lz, CROSSWALK);
    if (ru && !rv && (u === 1 || u === 2) && v % 3 === 0 && v > 5 && v < 14 && x < t.x1 - 4) L(lx, B, lz, ROADLINE);
    if (rv && !ru && (v === 1 || v === 2) && u % 3 === 0 && u > 5 && u < 14 && z < t.z1 - 4) L(lx, B, lz, ROADLINE);
  }
  if (i < 0 || j < 0 || i > t.nb - 1 || j > t.nb - 1) return;   // the last road strip has no lot
  lamp(4, 4, city ? 4 : 3); if (city) lamp(15, 4, 4);
  const r = mulberry(hash2(cx, cz, state.seed + 31) * 1e9 | 0), R = (a, b) => a + Math.floor(r() * (b - a + 1)), pick = a => a[Math.floor(r() * a.length)];
  const X = 5, Z = 5;                                        // lot corner (local), 10x10, front faces -z
  const fill = (ax, ay, az, bx, by, bz, id) => { for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) L(x, y, z, id); };
  const door = (lx, y, lz) => { L(lx, y, lz, doorId(0, false, false)); L(lx, y + 1, lz, doorId(0, false, true)); };
  const tree = (lx, lz) => { for (let y = 1; y <= 4; y++) L(lx, B + y, lz, LOG); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 5; dy++) if (Math.abs(dx) + Math.abs(dz) + (dy > 4 ? 1 : 0) <= 3 && !(dx === 0 && dz === 0 && dy <= 4)) L(lx + dx, B + dy, lz + dz, LEAVES); };
  // a house: walls, windows, a door to the street, peaked tiled roof, torch inside
  const house = (ax, az, w, d, floors, wall, roof) => {
    const top = B + floors * 4;
    fill(ax, B, az, ax + w - 1, B, az + d - 1, PLANKS);
    for (let x = ax; x < ax + w; x++) for (let z = az; z < az + d; z++) {
      const edge = x === ax || z === az || x === ax + w - 1 || z === az + d - 1, corner = (x === ax || x === ax + w - 1) && (z === az || z === az + d - 1);
      for (let y = B + 1; y <= top; y++) {
        const fy = (y - B) % 4;
        if (fy === 0) { L(x, y, z, edge ? wall : PLANKS); continue; }      // floor / ceiling
        if (!edge) { L(x, y, z, AIR); continue; }
        L(x, y, z, corner ? (wall === PLANKS ? LOG : wall) : (fy === 2 && ((x + z) % 2 === 0) ? GLASS : wall));
      }
    }
    for (let k = 0; ; k++) {                                  // gable roof along x
      const z1 = az + k - 1, z2 = az + d - k; if (z1 > z2) break;
      for (let x = ax - 1; x <= ax + w; x++) { L(x, top + k, z1, roof); L(x, top + k, z2, roof); for (let z = z1 + 1; z < z2; z++) if (k > 0 && (x === ax - 1 || x === ax + w)) {} }
      if (z1 + 1 >= z2) break;
      for (const x of [ax, ax + w - 1]) for (let z = z1 + 1; z < z2; z++) L(x, top + k, z, wall);   // gable ends
    }
    const dx = ax + (w >> 1); door(dx, B + 1, az);
    for (let z = Z - 1; z < az; z++) L(dx, B, z, SIDEWALK);    // walkway to the sidewalk
    L(ax + 1, B + 3, az + d - 2, TORCH); torches.add((x0 + ax + 1) + ',' + (B + 3) + ',' + (z0 + az + d - 2));
    if (r() < 0.5) L(ax + w - 2, B + 1, az + d - 2, r() < 0.5 ? CHEST : CTABLE);
  };
  const garage = (ax, az, wall) => {   // 4 wide, 6 deep, open door rolled up, driveway to the road, a car parked inside
    fill(ax, B, az, ax + 3, B, az + 5, CONCRETE);
    for (let x = ax; x <= ax + 3; x++) for (let z = az; z <= az + 5; z++) {
      const edge = x === ax || x === ax + 3 || z === az + 5;
      for (let y = B + 1; y <= B + 3; y++) L(x, y, z, edge ? wall : (z === az && y === B + 3 ? GARAGE : AIR));
      L(x, B + 4, z, CONCRETE);
    }
    for (let z = 4; z < az; z++) for (const x of [ax + 1, ax + 2]) L(x, B, z, ASPHALT);
    spots.push({ kind: 'car', x: x0 + ax + 2, z: z0 + az + 3, f: 0 });
  };
  if (!t.legacy) { stampLot3({ t, i, j, L, Lget, x0, z0, B, city, spots, lamp, r, R, pick, fill, door, tree, garage, X, Z }); return; }   // v1.10 step 3 buildings
  if (!city) {
    const kind = (i === 1 && j === 1) ? 'square' : pick(['house', 'house', 'house', 'big', 'garage', 'garage', 'park', 'farm']);
    const wall = pick([PLANKS, BRICK, WHITEWALL, SIDING_B, SIDING_Y, COBBLE]), roof = pick([ROOF, ROOF, PLANKS, COBBLE, BRICK]);
    if (kind === 'house') { const w = R(5, 7), d = R(5, 7); house(X + R(0, 10 - w), Z + 1 + R(0, 9 - d), w, d, 1, wall, roof); if (r() < 0.6) tree(X + 1, Z + 8); }
    if (kind === 'big') house(X, Z + 1, 9, 8, 2, wall, roof);
    if (kind === 'garage') { const w = R(5, 6); house(X, Z + 2, w, 6, r() < 0.4 ? 2 : 1, wall, roof); garage(X + w + 0, Z + 1, wall); }
    if (kind === 'park') { tree(X + 2, Z + 3); tree(X + 7, Z + 7); lamp(X + 5, Z + 5, 3); if (hash3(X, B, Z, state.seed + 78) < 0.08) L(X + 4, B + 1, Z + 8, RED_MUSH); for (let x = X + 1; x < X + 9; x++) L(x, B, Z + 5, SIDEWALK); }
    if (kind === 'farm') { for (let x = X; x < X + 10; x++) for (let z = Z + 1; z < Z + 10; z++) L(x, B, z, x === X + 5 ? WATER : FARM); for (let x = X; x < X + 10; x += 3) L(x, B + 1, Z + 9, PUMPKIN); }
    if (kind === 'square') { fill(X, B, Z, X + 9, B, Z + 9, COBBLE); L(X + 4, B, Z + 4, WATER); L(X + 5, B, Z + 4, WATER); lamp(X, Z, 3); lamp(X + 9, Z + 9, 3); lamp(X + 9, Z, 3); lamp(X, Z + 9, 3);
      spots.push({ kind: 'trader', x: x0 + X + 2, z: z0 + Z + 6 }); spots.push({ kind: 'trader', x: x0 + X + 7, z: z0 + Z + 3 }); }
    return;
  }
  // city lots
  const kind = pick(['tower', 'tower', 'tower', 'tower', 'shops', 'shops', 'parking', 'plaza']);
  if (kind === 'tower') {
    const w = R(7, 10), d = R(7, 10), ax = X + ((10 - w) >> 1), az = Z + ((10 - d) >> 1), top = Math.min(H - 3, B + R(18, 44)), skin = pick([OFFICE, OFFICE, TINT, OFFICE]);
    for (let x = ax; x < ax + w; x++) for (let z = az; z < az + d; z++) {
      const edge = x === ax || z === az || x === ax + w - 1 || z === az + d - 1, corner = (x === ax || x === ax + w - 1) && (z === az || z === az + d - 1);
      for (let y = B + 1; y <= top; y++) {
        if (y <= B + 3) { L(x, y, z, edge ? (corner || y === B + 3 ? CONCRETE : SHOPGLASS) : (y === B + 3 ? CONCRETE : AIR)); continue; }   // glass lobby
        L(x, y, z, !edge ? CONCRETE : corner || (y - B) % 5 === 0 ? CONCRETE : skin);
      }
    }
    door(ax + (w >> 1), B + 1, az);
    fill(ax + 2, top + 1, az + 2, ax + 3, top + 2, az + 3, CONCRETE); L(ax + 2, top + 3, az + 2, LAMP);
  }
  if (kind === 'shops') {
    const floors = R(2, 5), wall = pick([BRICK, WHITEWALL, CONCRETE, SIDING_B]), top = B + floors * 4;
    for (let x = X; x < X + 10; x++) for (let z = Z + 1; z < Z + 9; z++) {
      const edge = x === X || z === Z + 1 || x === X + 9 || z === Z + 8;
      for (let y = B + 1; y <= top; y++) {
        const fy = (y - B) % 4;
        if (fy === 0) { L(x, y, z, edge ? wall : PLANKS); continue; }
        if (!edge) { L(x, y, z, AIR); continue; }
        L(x, y, z, y <= B + 3 && z === Z + 1 && x > X && x < X + 9 ? (fy === 3 ? wall : SHOPGLASS) : (fy === 2 && x % 2 ? GLASS : wall));
      }
    }
    door(X + 3, B + 1, Z + 1); door(X + 7, B + 1, Z + 1);
    L(X + 2, B + 3, Z + 6, TORCH); torches.add((x0 + X + 2) + ',' + (B + 3) + ',' + (z0 + Z + 6));
  }
  if (kind === 'parking') {
    fill(X, B, Z, X + 9, B, Z + 9, ASPHALT);
    for (let x = X; x < X + 10; x += 3) for (let z = Z + 5; z < Z + 10; z++) L(x, B, z, ROADLINE);
    for (let k = 0; k < 3; k++) if (r() < 0.75) spots.push({ kind: 'car', x: x0 + X + 2 + k * 3, z: z0 + Z + 7, f: 0 });
    lamp(X + 9, Z + 9, 4);
  }
  if (kind === 'plaza') { tree(X + 2, Z + 2); tree(X + 7, Z + 7); tree(X + 2, Z + 7); lamp(X + 5, Z + 5, 4); L(X + 7, B + 1, Z + 2, PUMPKIN); }
}


// ================== v1.10 step 3: massive cities, districts, ghetto, building interiors ==================
// A metro covers a 2x2 block of town regions (8x8 lots). Worlds from before step 3 keep their step-2 towns in every
// region you built in or explored (state.townOld), and no metro is placed over one of those.
const ghettoZones = [];   // { x0, z0, x1, z1, townId, base }  hook: gangs can spawn here later
let townOldSet = null;
function townChOld(cx, cz) { if (!(state.townV >= 3)) return true; if (!townOldSet) townOldSet = new Set(state.townOld || []); return townOldSet.size > 0 && townOldSet.has(cx + ',' + cz); }
function regionTownOld(rx, rz) { if (!(state.townV >= 3)) return true; for (let i = 0; i < TREG; i++) for (let j = 0; j < TREG; j++) if (townChOld(rx * TREG + i, rz * TREG + j)) return true; return false; }
const metroMemo = new Map();
function metroOf(mx, mz) {
  const k = mx + ',' + mz; if (metroMemo.has(k)) return metroMemo.get(k);
  let t = null; metroMemo.set(k, null);
  if (state.townV >= 3 && hash2(mx, mz, state.seed + 4242) < 0.08) {
    const rx = mx * 2, rz = mz * 2, NB = 8;
    const x0 = (rx * TREG + 1) * CH, z0 = (rz * TREG + 1) * CH, x1 = x0 + NB * CH + 4, z1 = z0 + NB * CH + 4, cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
    let ok = Math.hypot(cx - VX, cz - VZ) > 200;
    for (let a = 0; a < 2 && ok; a++) for (let b = 0; b < 2 && ok; b++) if (regionTownOld(rx + a, rz + b) || regionOld(rx + a, rz + b)) ok = false;
    if (ok) {
      let hs = 0, n = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { hs += terrainNat(x0 + 20 + a * 50, z0 + 20 + b * 50).h; n++; }
      const r = mulberry(hash2(mx, mz, state.seed + 4243) * 1e9 | 0), gq = Math.floor(r() * 4);   // ghetto corner
      t = { type: 'city', metro: true, rx, rz, x0, z0, x1, z1, nb: NB, base: Math.round(Math.max(SEA + 3, Math.min(20, hs / n))), id: 'M' + k, legacy: false,
        ghetto: [gq % 2 ? NB - 3 : 0, gq < 2 ? 0 : NB - 3] };
      const gx = x0 + t.ghetto[0] * 16, gz = z0 + t.ghetto[1] * 16;
      ghettoZones.push({ x0: gx, z0: gz, x1: gx + 3 * 16 + 4, z1: gz + 3 * 16 + 4, townId: t.id, base: t.base });
    }
  }
  metroMemo.set(k, t); return t;
}
const inGhetto = (x, z) => ghettoZones.some(g => x >= g.x0 && x < g.x1 && z >= g.z0 && z < g.z1);
// which district a lot of a town sits in
function districtOf(t, i, j) {
  if (t.ghetto && i >= t.ghetto[0] && i < t.ghetto[0] + 3 && j >= t.ghetto[1] && j < t.ghetto[1] + 3) return 'ghetto';
  const c = (t.nb - 1) / 2, d = Math.max(Math.abs(i - c), Math.abs(j - c)) / (c + 0.5);
  if (t.type !== 'city') return 'village';
  if (!t.metro) return d < 0.5 ? 'midtown' : 'outer';
  return d < 0.35 ? 'downtown' : d < 0.7 ? 'midtown' : 'outer';
}
const SKY_SKINS = [GL_BLUE, GL_GREEN, GL_GOLD, GL_DARK, GL_TEAL, OFFICE, TINT];
// one 10x10 lot (X..X+9, Z..Z+9 local; front faces -z / the street at Z-1)
function stampLot3(o) {
  const { t, i, j, L, Lget, x0, z0, B, spots, lamp, r, R, pick, fill, door, tree, garage, X, Z } = o;
  const dist = districtOf(t, i, j), ghetto = dist === 'ghetto';
  const torch = (lx, y, lz) => { L(lx, y, lz, TORCH); torches.add((x0 + lx) + ',' + y + ',' + (z0 + lz)); };
  const inLot = (lx, lz) => lx >= 0 && lz >= 0 && lx < CH && lz < CH;
  // furnish one storey: floor top at y, interior ax+1..ax+w-2, az+1..az+d-2; `keep` = cells to leave free (stairs)
  const furnish = (ax, az, w, d, y, kind, keep) => {
    const free = (lx, lz) => !keep.has(lx + ',' + lz) && Lget(lx, y, lz) === AIR && Lget(lx, y + 1, lz) === AIR && !(lx === ax + (w >> 1) && lz <= az + 1);
    const put = (lx, lz, id) => { if (inLot(lx, lz) && free(lx, lz)) { L(lx, y, lz, id); keep.add(lx + ',' + lz); return true; } return false; };
    const xr = ax + w - 2, zb = az + d - 2;   // right wall / back wall interior cells
    if (kind === 'home' || kind === 'flat') {
      put(xr, zb, BED0 + 3); if (d > 6) put(xr, zb - 2, BED0 + 3);   // beds against the right wall (pillow side facing -x side)
      put(xr, az + 2, COUCH0 + 3); put(xr - 3 > ax + 2 ? xr - 3 : xr - 2, az + 2, TABLE);
      if (put(ax + 3, az + 1 + (d > 6 ? 1 : 0), TV0 + 0) && ghetto && r() < 0.4) {}
      for (let x = ax + 3; x <= Math.min(xr - 1, ax + 5); x++) put(x, zb, x === ax + 4 ? (r() < 0.5 ? RADIO0 + 2 : COUNTER0 + 2) : COUNTER0 + 2);   // kitchen along the back wall
      put(xr - 1, zb - 2, CHAIR0 + 1); put(xr - 2, az + 3, CHAIR0 + 2);
      if (r() < 0.5) put(xr - 1, az + 4, LAPTOP0 + 3);
      if (ghetto) { put(ax + 3, az + 3, TRASH); put(xr - 1, zb - 1, TRASH); }
    } else if (kind === 'office') {
      for (let x = ax + 3; x <= xr - 1; x += 3) for (let z = az + 2; z <= zb - 1; z += 3) { if (put(x, z, TABLE)) { L(x, y + 1, z, LAPTOP0 + 2); put(x, z + 1, CHAIR0 + 2); } }
      put(xr, zb, RADIO0 + 3);
    } else if (kind === 'shop') {
      for (let x = ax + 3; x <= xr; x++) put(x, zb, COUNTER0 + 2);
      put(ax + 3, az + 2, TABLE); put(ax + 4, az + 2, CHAIR0 + 3); put(xr, az + 2, TV0 + 3);
    }
  };
  // a building with storeys every 4 blocks, stairs up one wall, furnished floors.
  // interiorFloors = how many storeys get an inside (the rest of a tall tower is a solid core behind the glass)
  const building = (ax, az, w, d, floors, wall, win, opt = {}) => {
    if (d < 7) floors = 1;                                       // too shallow for a staircase
    const top = B + floors * 4, inner = Math.min(floors, opt.interior ?? floors), kinds = opt.kinds || ['home'];
    const sx = ax + 1, sz0 = az + d - 3;                       // stair column: x = sx, landing at sz0+1, ascending toward -z, 4 cells long
    const stairCell = new Set(); for (let k = -1; k < 5; k++) stairCell.add(sx + ',' + (sz0 - k)); for (let k = -1; k < 5; k++) stairCell.add((sx + 1) + ',' + (sz0 - k));
    fill(ax, B, az, ax + w - 1, B, az + d - 1, opt.floor || PLANKS);
    for (let x = ax; x < ax + w; x++) for (let z = az; z < az + d; z++) {
      const edge = x === ax || z === az || x === ax + w - 1 || z === az + d - 1, corner = (x === ax || x === ax + w - 1) && (z === az || z === az + d - 1);
      for (let y = B + 1; y <= top; y++) {
        const st = Math.floor((y - B - 1) / 4), fy = (y - B) % 4;
        if (st >= inner && !edge) { L(x, y, z, CONCRETE); continue; }               // solid core above the furnished storeys
        if (fy === 0) { L(x, y, z, edge ? (opt.band || wall) : (st < inner - 1 && x === sx && z >= sz0 - 2 && z <= sz0 ? AIR : (opt.floor || PLANKS))); continue; }
        if (!edge) { L(x, y, z, AIR); continue; }
        if (corner) { L(x, y, z, opt.corner || wall); continue; }
        if (opt.lobby && y <= B + 3 && z === az) { L(x, y, z, fy === 3 ? (opt.band || wall) : SHOPGLASS); continue; }
        const winRow = opt.curtain ? fy !== 0 : fy === 2, winCol = opt.curtain ? true : (x + z) % 2 === 0;
        L(x, y, z, winRow && winCol ? (ghetto && hash3(x0 + x, y, z0 + z, 5) < 0.45 ? BROKEN_GLASS : win) : wall);
      }
    }
    // stairs + furniture for each furnished storey
    for (let s = 0; s < inner; s++) {
      const fyb = B + s * 4 + 1;   // walking level (block cells start here)
      if (s < inner - 1) for (let k = 0; k < 4; k++) L(sx, fyb + k, sz0 - k, (opt.stone ? SSTAIR0 : WSTAIR0) + 0);
      furnish(ax, az, w, d, fyb, kinds[s % kinds.length], new Set(stairCell));
      if (s === 0 || (opt.lights !== false && s % 2 === 0)) torch(ax + w - 2, fyb, az + 1);
    }
    door(ax + (w >> 1), B + 1, az);
    for (let z = Z - 1; z < az; z++) L(ax + (w >> 1), B, z, SIDEWALK);
    return top;
  };
  const roofGable = (ax, az, w, d, top, wall, roof) => {
    for (let k = 0; ; k++) { const z1 = az + k - 1, z2 = az + d - k; if (z1 > z2) break;
      for (let x = ax - 1; x <= ax + w; x++) { L(x, top + k, z1, roof); L(x, top + k, z2, roof); }
      if (z1 + 1 >= z2) break; for (const x of [ax, ax + w - 1]) for (let z = z1 + 1; z < z2; z++) L(x, top + k, z, wall); }
  };
  const trash = n => { for (let q = 0; q < n; q++) { const lx = X + R(0, 9), lz = Z + R(0, 1); if (Lget(lx, B + 1, lz) === AIR) L(lx, B + 1, lz, TRASH); } };
  const graffWall = () => { const z = Z + 9; for (let x = X; x < X + 10; x++) for (let y = B + 1; y <= B + 3; y++) L(x, y, z, y === B + 3 && r() < 0.4 ? AIR : (r() < 0.6 ? GRAFF1 : GRAFF2)); };
  // ---------------- villages (new style: same streets, houses get stairs + furniture)
  if (t.type !== 'city') {
    const kind = (i === 1 && j === 1) ? 'square' : pick(['house', 'house', 'house', 'big', 'garage', 'garage', 'park', 'farm']);
    const wall = pick([PLANKS, BRICK, WHITEWALL, SIDING_B, SIDING_Y, COBBLE]), roof = pick([ROOF, ROOF, PLANKS, COBBLE, BRICK]);
    if (kind === 'house') { const w = R(6, 8), d = R(6, 8), ax = X + R(0, 10 - w), az = Z + 1 + R(0, 9 - d), fl = r() < 0.3 ? 2 : 1, top = building(ax, az, w, d, fl, wall, GLASS, { corner: wall === PLANKS ? LOG : wall }); roofGable(ax, az, w, d, top, wall, roof); if (r() < 0.6 && ax > X + 1) tree(X + 1, Z + 8); }
    if (kind === 'big') { const top = building(X, Z + 1, 9, 8, 2, wall, GLASS, { corner: wall === PLANKS ? LOG : wall }); roofGable(X, Z + 1, 9, 8, top, wall, roof); }
    if (kind === 'garage') { const top = building(X, Z + 2, 6, 7, 1, wall, GLASS, {}); roofGable(X, Z + 2, 6, 7, top, wall, roof); garage(X + 6, Z + 1, wall); }
    if (kind === 'park') { tree(X + 2, Z + 3); tree(X + 7, Z + 7); lamp(X + 5, Z + 5, 3); if (hash3(X, B, Z, state.seed + 78) < 0.08) L(X + 4, B + 1, Z + 8, RED_MUSH); for (let x = X + 1; x < X + 9; x++) L(x, B, Z + 5, SIDEWALK); }
    if (kind === 'farm') { for (let x = X; x < X + 10; x++) for (let z = Z + 1; z < Z + 10; z++) L(x, B, z, x === X + 5 ? WATER : FARM); for (let x = X; x < X + 10; x += 3) L(x, B + 1, Z + 9, PUMPKIN); }
    if (kind === 'square') { fill(X, B, Z, X + 9, B, Z + 9, COBBLE); L(X + 4, B, Z + 4, WATER); L(X + 5, B, Z + 4, WATER); lamp(X, Z, 3); lamp(X + 9, Z + 9, 3); lamp(X + 9, Z, 3); lamp(X, Z + 9, 3);
      spots.push({ kind: 'trader', x: x0 + X + 2, z: z0 + Z + 6 }); spots.push({ kind: 'trader', x: x0 + X + 7, z: z0 + Z + 3 }); }
    return;
  }
  // ---------------- ghetto: run-down walk-ups, graffiti, broken windows, trash, vacant lots
  if (ghetto) {
    const kind = pick(['walkup', 'walkup', 'walkup', 'vacant', 'court', 'store']);
    const wall = pick([BRICK, GRAFF1, CONCRETE, GRAFF2, BRICK]);
    if (kind === 'walkup') { building(X, Z + 1, 10, 8, R(2, 4), wall, GLASS, { band: pick([BRICK, CONCRETE]), kinds: ['flat'], lights: false }); for (let x = X; x < X + 10; x++) if (r() < 0.5) L(x, B + 1 + R(0, 2), Z + 1, r() < 0.5 ? GRAFF1 : GRAFF2); }
    if (kind === 'store') building(X, Z + 1, 10, 8, R(1, 2), wall, GLASS, { lobby: true, kinds: ['shop', 'flat'], band: CONCRETE });
    if (kind === 'vacant') { for (let x = X; x < X + 10; x++) for (let z = Z + 1; z < Z + 10; z++) L(x, B, z, r() < 0.6 ? DIRT : r() < 0.5 ? DEADGRASS : SIDEWALK); graffWall(); for (let q = 0; q < 6; q++) { const lx = X + R(1, 8), lz = Z + R(2, 8); L(lx, B + 1, lz, TRASH); } }
    if (kind === 'court') { fill(X, B, Z + 1, X + 9, B, Z + 9, ASPHALT); for (let x = X; x < X + 10; x++) L(x, B, Z + 5, ROADLINE); graffWall(); L(X + 1, B + 1, Z + 2, TRASH); L(X + 8, B + 1, Z + 3, TRASH); lamp(X + 9, Z + 1, 3); }
    trash(R(2, 4));
    return;
  }
  // ---------------- downtown / midtown / outer city
  const lotKinds = dist === 'downtown' ? ['sky', 'sky', 'sky', 'sky', 'sky', 'plaza'] : dist === 'midtown' ? ['sky', 'sky', 'tower', 'shops', 'shops', 'parking', 'plaza'] : ['flats', 'flats', 'shops', 'house', 'parking', 'plaza', 'house'];
  const kind = pick(lotKinds);
  if (kind === 'sky' || kind === 'tower') {
    const tall = kind === 'sky' ? (dist === 'downtown' ? R(30, 46) : R(20, 34)) : R(12, 20), floors = Math.max(3, Math.floor(Math.min(H - 4 - B, tall) / 4));
    const skin = pick(SKY_SKINS), band = pick([CONCRETE, CONCRETE, WHITEWALL, GL_DARK]), shape = pick(['box', 'setback', 'setback', 'cut', 'twin', 'spire']);
    const w = shape === 'twin' ? 10 : R(8, 10), d = R(8, 9), ax = X + ((10 - w) >> 1), az = Z + 1;
    if (shape === 'twin') {   // two slim towers sharing a lobby podium
      building(X, az, 10, d, 1, band, SHOPGLASS, { lobby: true, kinds: ['office'], stone: true, floor: CONCRETE });
      for (const tx of [X, X + 6]) { const top = B + floors * 4; for (let x = tx; x < tx + 4; x++) for (let z = az + 1; z < az + d - 1; z++) for (let y = B + 5; y <= top; y++) { const e = x === tx || x === tx + 3 || z === az + 1 || z === az + d - 2; L(x, y, z, e ? ((y - B) % 4 === 0 ? band : skin) : CONCRETE); } L(tx + 1, top + 1, az + 2, LAMP); }
      return;
    }
    const top = building(ax, az, w, d, floors, skin, skin, { curtain: true, band, corner: band, lobby: true, interior: 3, kinds: ['shop', 'office', 'office'], stone: true, floor: CONCRETE, lights: true });
    if (shape === 'cut') for (let y = B + 5; y <= top; y++) for (const [cx2, cz2] of [[ax, az], [ax + w - 1, az], [ax, az + d - 1], [ax + w - 1, az + d - 1]]) L(cx2, y, cz2, AIR);
    let rt = top;
    if (shape === 'setback') {   // stacked, narrower tiers on top
      let bx = ax + 1, bz = az + 1, bw = w - 2, bd = d - 2, tiers = R(1, 2);
      for (let q = 0; q < tiers && bw >= 4 && rt < H - 6; q++) { const th = Math.min(H - 3 - rt, R(6, 10)); for (let x = bx; x < bx + bw; x++) for (let z = bz; z < bz + bd; z++) for (let y = rt + 1; y <= rt + th; y++) { const e = x === bx || z === bz || x === bx + bw - 1 || z === bz + bd - 1; L(x, y, z, e ? ((y - B) % 4 === 0 ? band : skin) : CONCRETE); } rt += th; bx++; bz++; bw -= 2; bd -= 2; }
    }
    const cx2 = ax + (w >> 1), cz2 = az + (d >> 1);
    if (shape === 'spire' && rt < H - 6) { for (let y = rt + 1; y < Math.min(H - 1, rt + 8); y++) L(cx2, y, cz2, y === Math.min(H - 2, rt + 7) ? LAMP : CONCRETE); }
    else if (rt < H - 3) { fill(cx2 - 1, rt + 1, cz2 - 1, cx2, rt + 2, cz2, CONCRETE); L(cx2 - 1, rt + 3, cz2 - 1, LAMP); }
    if (dist === 'downtown') lamp(X + 9, Z, 4);
    return;
  }
  if (kind === 'shops') { const wall = pick([BRICK, WHITEWALL, CONCRETE, SIDING_B]); building(X, Z + 1, 10, 8, R(2, 4), wall, GLASS, { lobby: true, kinds: ['shop', 'flat', 'office'], band: wall }); return; }
  if (kind === 'flats') { const wall = pick([BRICK, WHITEWALL, SIDING_B, SIDING_Y, CONCRETE]); building(X, Z + 1, 10, 8, R(3, 5), wall, GLASS, { kinds: ['flat'], band: pick([CONCRETE, wall]) }); return; }
  if (kind === 'house') { const wall = pick([BRICK, WHITEWALL, SIDING_B, SIDING_Y]), w = R(6, 8), d = R(6, 8), ax = X + R(0, 10 - w), top = building(ax, Z + 2, w, d, R(1, 2), wall, GLASS, {}); roofGable(ax, Z + 2, w, d, top, wall, pick([ROOF, BRICK])); if (ax > X + 1) tree(X + 1, Z + 8); return; }
  if (kind === 'parking') {
    fill(X, B, Z, X + 9, B, Z + 9, ASPHALT);
    for (let x = X; x < X + 10; x += 3) for (let z = Z + 5; z < Z + 10; z++) L(x, B, z, ROADLINE);
    for (let k = 0; k < 3; k++) if (r() < 0.75) spots.push({ kind: 'car', x: x0 + X + 2 + k * 3, z: z0 + Z + 7, f: 0 });
    lamp(X + 9, Z + 9, 4); return;
  }
  tree(X + 2, Z + 2); tree(X + 7, Z + 7); tree(X + 2, Z + 7); lamp(X + 5, Z + 5, 4); L(X + 7, B + 1, Z + 2, PUMPKIN);   // plaza
}

// ================== TEXTURES ==================
const TS = 16, AT = 8, AR = 32; // tile px, atlas tiles per row, rows
const atlas = document.createElement('canvas'); atlas.width = TS * AT; atlas.height = TS * AR;
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
const emi = document.createElement('canvas'); emi.width = TS * AT; emi.height = TS * AR;
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
function tileTex(t) { const c = hdBlit(document.createElement('canvas'), t); const tx = new THREE.CanvasTexture(c); tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace; return tx; }
// furniture tiles: 78 bed blanket, 79 pillow, 80 laptop shell, 81 laptop screen (DealerNet), 82 TV plastic, 83 TV glass (off), 84 radio wood, 85 radio front, 86 metal
paintTile(78, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 16, stripe = y % 6 === 0; px(x, y, stripe ? rgb(240, 230, 220) : rgb(196 + k, 34 + k * .4, 40 + k * .4)); } });
paintTile(79, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 10, e = x === 0 || y === 0 || x === 15 || y === 15; px(x, y, e ? rgb(200, 200, 205) : rgb(240 + k, 240 + k, 244 + k)); } });
paintTile(80, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 8, key = y > 3 && y < 12 && x > 1 && x < 14 && x % 2 === 0 && y % 2 === 0; px(x, y, key ? rgb(30, 30, 34) : rgb(120 + k, 124 + k, 132 + k)); } });
paintTile(81, (px) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(x, y, '#f4f6fb');
  for (let x = 0; x < TS; x++) { px(x, 0, '#1b1b22'); px(x, 1, '#3a7bf2'); px(x, 2, '#3a7bf2'); }
  for (let x = 1; x < 6; x++) px(x, 1, '#ffd84a');
  for (let i = 0; i < 4; i++) { const y = 4 + i * 3; px(1, y, ['#e84b3c', '#3fa34d', '#f2c21a', '#8a3fd2'][i]); px(2, y, ['#e84b3c', '#3fa34d', '#f2c21a', '#8a3fd2'][i]); for (let x = 4; x < 11; x++) px(x, y, '#9aa0ad'); px(12, y, '#2fb35a'); px(13, y, '#2fb35a'); }
  for (let y = 0; y < TS; y++) { px(0, y, '#1b1b22'); px(15, y, '#1b1b22'); } for (let x = 0; x < TS; x++) px(x, 15, '#1b1b22');
});
paintTile(82, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 6; px(x, y, rgb(28 + k, 28 + k, 32 + k)); } });
paintTile(83, (px) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const sh = (x - y > 6 && x - y < 9); px(x, y, sh ? '#2a3440' : '#10161c'); } });
paintTile(84, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (y % 5 === 0 ? -30 : 0) + (r() - .5) * 14; px(x, y, rgb(140 + k, 86 + k, 44 + k)); } });
paintTile(85, (px, r) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(x, y, rgb(150, 96, 52));
  for (let y = 2; y < 14; y++) for (let x = 1; x < 9; x++) { const d = Math.hypot(x - 4.5, y - 7.5); px(x, y, d < 4.3 ? ((x + y) % 2 ? '#2a2420' : '#4a4038') : rgb(150, 96, 52)); }
  for (let x = 10; x < 15; x++) { px(x, 3, '#e8d9a0'); px(x, 4, '#e8d9a0'); } px(12, 3, '#d22'); px(12, 4, '#d22');
  for (const [cx, cy] of [[11, 9], [13, 12]]) { px(cx, cy, '#ddd'); px(cx + 1, cy, '#999'); px(cx, cy + 1, '#999'); px(cx + 1, cy + 1, '#666'); }
});
paintTile(86, (px, r) => noiseFill(px, r, [176, 180, 188], 16));
// v1.09 tiles: 87 grave dirt top (sunken soil with a cross), 88 grave dirt side, 89 tombstone stone, 90 engraved tombstone face
paintTile(87, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 34, edge = x < 2 || x > 13; px(x, y, edge ? rgb(70 + k, 92 + k, 46 + k) : rgb(88 + k, 62 + k * .8, 44 + k * .6)); }
  for (let y = 3; y < 12; y++) px(7, y, '#3a2a1c'), px(8, y, '#3a2a1c'); for (let x = 5; x < 11; x++) px(x, 5, '#3a2a1c'); });
paintTile(88, (px, r) => { noiseFill(px, r, [100, 72, 52], 40); for (let x = 0; x < TS; x++) { const d = 1 + Math.floor(r() * 2); for (let y = 0; y < d; y++) { const k = (r() - .5) * 30; px(x, y, rgb(70 + k, 92 + k, 46 + k)); } } });
paintTile(89, (px, r) => { noiseFill(px, r, [132, 134, 140], 28); for (let i = 0; i < 7; i++) { const x = r() * 15 | 0, y = r() * 15 | 0; px(x, y, '#5e6066'); } for (let i = 0; i < 5; i++) px(r() * 15 | 0, r() * 15 | 0, '#4f7a3a'); });
paintTile(90, (px, r) => { noiseFill(px, r, [138, 140, 146], 24);
  const R = ['..###..###..', '..#.#...#...', '..##....#...', '..#.#...#...', '..#.#...#...', '............', '....####....', '.....##.....', '.....##.....', '.....##.....'];
  R.forEach((row, y) => [...row].forEach((c, x) => c === '#' && px(x + 2, 2 + y, '#45474e'))); for (let i = 0; i < 6; i++) px(r() * 15 | 0, 12 + (r() * 4 | 0), '#4f7a3a'); });

// v1.10 tiles: 91 summer leaves, 92 spring leaves, 93 snowy leaves, 94 spruce needles, 95 snow, 96 snowy grass side,
// 97 fire, 98 ice, 99 cactus side, 100 cactus top
const leafTile = (cols, gap = 0.18, snow = 0) => (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (r() < gap) continue; const k = (r() - .5) * 36, q = r();
  if (snow && (r() < snow * (1 - y / 22))) { const s = 225 + (r() - .5) * 30; px(x, y, rgb(s, s, s + 8)); continue; }
  const c = cols[q < .45 ? 0 : q < .8 ? 1 : 2]; px(x, y, rgb(c[0] + k, c[1] + k, c[2] + k * 0.5)); } };
paintTile(91, leafTile([[58, 122, 40], [42, 98, 30], [86, 150, 54]]));
paintTile(92, leafTile([[96, 168, 62], [120, 190, 80], [226, 170, 210]], 0.2));     // fresh green with blossom
paintTile(93, leafTile([[52, 92, 44], [40, 76, 36], [70, 110, 56]], 0.16, 0.75));
paintTile(94, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (r() < 0.12) continue; const k = (r() - .5) * 26, n = (x + y * 3) % 5 === 0 ? -18 : 0; px(x, y, rgb(34 + k + n, 70 + k + n, 46 + k * 0.6 + n)); } });
paintTile(95, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 16; px(x, y, rgb(236 + k, 240 + k, 248 + k * 0.5)); } });
paintTile(96, (px, r) => { noiseFill(px, r, [134, 96, 67], 40); for (let x = 0; x < TS; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) { const k = (r() - .5) * 14; px(x, y, rgb(234 + k, 238 + k, 246)); } } });
const FIRE_SHAPE = (x, y, r) => { const h = 7 + Math.sin(x * 1.7) * 3 + Math.sin(x * 0.6 + 1) * 3 + r() * 2; return 15 - y < h; };
paintTile(97, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (!FIRE_SHAPE(x, y, r)) continue; const t = y / 15; px(x, y, t > 0.75 ? rgb(255, 240, 150) : t > 0.5 ? rgb(255, 170 + r() * 40, 40) : rgb(230, 70 + r() * 50, 20)); } });
{ const rr = mulberry(97 * 9973 + 17); for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (FIRE_SHAPE(x, y, rr)) { ectx.fillStyle = y > 10 ? '#ffd070' : '#ff7a20'; ectx.fillRect((97 % AT) * TS + x, Math.floor(97 / AT) * TS + y, 1, 1); } }
paintTile(98, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 12, crack = (x - y * 0.6 + 40) % 11 < 0.8; px(x, y, crack ? rgb(220, 240, 255) : rgb(150 + k, 196 + k, 238)); } });
paintTile(99, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const rib = x % 4 === 1, k = (r() - .5) * 20; px(x, y, rib ? rgb(40 + k, 110 + k, 40) : rgb(70 + k, 150 + k, 60)); if (rib && y % 4 === 2) px(x, y, '#e8e0b0'); } });
paintTile(100, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const d = Math.hypot(x - 7.5, y - 7.5), k = (r() - .5) * 18; px(x, y, d > 6.8 ? rgb(50 + k, 120 + k, 46) : rgb(96 + k, 166 + k, 80)); } });

// v1.10 step 3 tiles: 101 graffiti brick, 102 graffiti concrete, 103 broken glass, 104-107 + 119 skyscraper glass,
// 108 couch fabric, 109 cushion, 110 counter top, 111 cabinet front, 112 trash bag, 113 dark wood
{
  const brickPx = (px, r, x, y) => { const row = y >> 2, off = row % 2 ? 4 : 0, mortar = y % 4 === 3 || (x + off) % 8 === 7, k = (r() - .5) * 25; px(x, y, mortar ? rgb(150, 140, 130) : rgb(128 + k, 58 + k, 46 + k)); };
  const spray = (px, r, cols, n) => { for (let s = 0; s < n; s++) { const c = cols[s % cols.length]; let x = 2 + r() * 12, y = 3 + r() * 10; const dx = (r() - .5) * 1.6, dy = (r() - .5) * 1.6;
    for (let i = 0; i < 9; i++) { x += dx + (r() - .5); y += dy + (r() - .5); const xi = Math.round(x), yi = Math.round(y); if (xi < 1 || yi < 1 || xi > 14 || yi > 14) break; px(xi, yi, c); if (r() < 0.6) px(xi + 1, yi, c); if (r() < 0.3) px(xi, yi + 1, '#111'); } } };
  paintTile(101, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) brickPx(px, r, x, y); spray(px, r, ['#ff3aa0', '#30d0ff', '#ffe030', '#40e060'], 5); });
  paintTile(102, (px, r) => { noiseFill(px, r, [140, 140, 136], 18); spray(px, r, ['#ff5020', '#a040ff', '#ffffff', '#20e0a0'], 6); for (let x = 3; x < 13; x++) if (r() < 0.7) px(x, 12 + (x % 2), '#111'); });
  paintTile(103, (px, r) => { const cx = 6 + r() * 4, cy = 5 + r() * 5;
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const e = x === 0 || y === 0 || x === 15 || y === 15, d = Math.hypot(x - cx, y - cy), ang = Math.atan2(y - cy, x - cx);
      if (e) px(x, y, '#3a3a3a'); else if (d < 2.6) continue; else if (Math.abs(Math.sin(ang * 3.5)) < 0.12 || Math.abs(d - 5) < 0.4) px(x, y, 'rgba(235,245,255,.9)'); else if (r() < 0.12) continue; else px(x, y, 'rgba(150,180,190,.45)'); } });
  const skyGlass = (t, top, bot, mull, litCol) => {
    paintTile(t, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const m = x % 8 === 0 || y === 0, k = y / 15, shine = (x + y) % 13 < 2 && x % 8 > 1;
      if (m) { px(x, y, mull); continue; }
      const c = [top[0] + (bot[0] - top[0]) * k, top[1] + (bot[1] - top[1]) * k, top[2] + (bot[2] - top[2]) * k];
      px(x, y, shine ? rgb(c[0] + 50, c[1] + 50, c[2] + 50) : rgb(c[0] + (r() - .5) * 6, c[1] + (r() - .5) * 6, c[2] + (r() - .5) * 6)); } });
    if (litCol) { const rr = mulberry(t * 31 + 5); for (const [ox, oy] of [[1, 1], [9, 1], [1, 9], [9, 9]]) if (rr() < 0.35) { ectx.fillStyle = litCol; ectx.fillRect((t % AT) * TS + ox, Math.floor(t / AT) * TS + oy, 6, 6); } }
  };
  skyGlass(104, [70, 130, 200], [30, 70, 140], '#5a6470', '#d8c890');
  skyGlass(105, [90, 170, 150], [30, 100, 90], '#4a5a56', '#e0d090');
  skyGlass(106, [230, 190, 90], [150, 100, 30], '#6a5030', null);
  skyGlass(107, [50, 56, 66], [18, 22, 30], '#202428', '#f0d080');
  skyGlass(119, [110, 210, 220], [40, 120, 140], '#d8dde0', '#e8e0b0');
  paintTile(108, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 14, w = (x + y) % 4 === 0 ? -10 : 0; px(x, y, rgb(70 + k + w, 96 + k + w, 140 + k + w)); } });
  paintTile(109, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 10, seam = x === 7 || x === 8 || y === 0 || y === 15; px(x, y, seam ? rgb(60, 80, 118) : rgb(100 + k, 128 + k, 170 + k)); } });
  paintTile(110, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const v = Math.sin((x * 0.7 + y * 0.3) + Math.sin(y * 0.5) * 2) > 0.92, k = (r() - .5) * 8; px(x, y, v ? rgb(160, 160, 168) : rgb(228 + k, 228 + k, 232 + k)); } });
  paintTile(111, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 10, frame = x === 0 || x === 7 || x === 8 || x === 15 || y === 0 || y === 15, knob = (x === 5 || x === 10) && (y === 4 || y === 5);
    px(x, y, knob ? '#d0d0d0' : frame ? rgb(200 + k, 196 + k, 186 + k) : rgb(232 + k, 228 + k, 218 + k)); } });
  paintTile(112, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 16, fold = Math.sin(x * 1.3 + y * 0.4) > 0.8; px(x, y, fold ? rgb(70 + k, 72 + k, 78 + k) : rgb(30 + k, 32 + k, 36 + k)); } });
  paintTile(113, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (y % 5 === 0 ? -22 : 0) + (r() - .5) * 12; px(x, y, rgb(110 + k, 70 + k, 42 + k)); } });
}

// v1.10 step 4 tiles: 114 corrugated steel, 115 chain-link fence, 116 prison bars, 117 toxic barrel side, 118 toxic barrel top,
// 120 scorched ground, 121 hazard stripes, 122 reactor core, 123 alien hull, 124 military crate
{
  const emit = (t, x, y, c) => { ectx.fillStyle = c; ectx.fillRect((t % AT) * TS + x, Math.floor(t / AT) * TS + y, 1, 1); };
  paintTile(114, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (x % 4 === 0 ? -28 : x % 4 === 2 ? 16 : 0) + (r() - .5) * 10; px(x, y, rgb(150 + k, 156 + k, 162 + k)); } for (const y of [0, 15]) for (let x = 0; x < TS; x++) px(x, y, '#6a7076'); });
  paintTile(115, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const a = (x + y) % 6 === 0, b = (x - y + 18) % 6 === 0, post = x === 0 || x === 15, top = y === 0; if (a || b || post || top) px(x, y, post || top ? '#7a8086' : rgb(170 + (r() - .5) * 20, 176, 182)); } });
  paintTile(116, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const bar = x % 4 === 1 || x % 4 === 2, rail = y === 1 || y === 2 || y === 13 || y === 14; if (bar || rail) px(x, y, (x % 4 === 1 && !rail) ? '#8a9096' : rgb(60 + (r() - .5) * 14, 64, 70)); } });
  paintTile(117, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const rib = y === 3 || y === 12, sym = Math.hypot(x - 7.5, y - 7.5) < 3.2; const k = (r() - .5) * 14;
    px(x, y, rib ? rgb(90 + k, 100, 40) : sym ? '#1a1a1a' : x < 2 || x > 13 ? rgb(150 + k, 160 + k, 40) : rgb(200 + k, 210 + k, 40)); }
    for (let i = 0; i < 6; i++) { const x = 3 + (r() * 10 | 0); for (let y = 0; y < 3 + (r() * 4 | 0); y++) px(x, y, '#5aff3a'); } });
  for (let y = 0; y < 7; y++) for (let x = 3; x < 13; x++) if ((x * 7 + y * 3) % 5 < 2) emit(117, x, y, '#46e030');
  paintTile(118, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const d = Math.hypot(x - 7.5, y - 7.5); px(x, y, d > 7 ? '#5a6020' : d > 5.8 ? '#8a9a30' : rgb(90 + r() * 40, 250, 60 + r() * 30)); } });
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (Math.hypot(x - 7.5, y - 7.5) <= 5.8) emit(118, x, y, '#58ff40');
  paintTile(120, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = r(); px(x, y, k < 0.08 ? rgb(200, 90, 30) : k < 0.5 ? rgb(38 + k * 20, 34, 30) : rgb(62 + k * 18, 56 + k * 10, 48)); } });
  paintTile(121, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const s = Math.floor((x + y) / 4) % 2; const k = (r() - .5) * 10; px(x, y, s ? rgb(24 + k, 24 + k, 24 + k) : rgb(240 + k, 196 + k, 20)); } });
  paintTile(122, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const e = x === 0 || y === 0 || x === 15 || y === 15, rod = x % 4 === 1 && y > 1 && y < 14;
    px(x, y, e ? '#4a5058' : rod ? rgb(170, 255, 255) : rgb(30, 110 + r() * 40, 200 + r() * 40)); } });
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) emit(122, x, y, x % 4 === 1 ? '#a8ffff' : '#2080ff');
  paintTile(123, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const seam = x % 8 === 0 || y % 8 === 0, dot = (x % 8 === 4 && y % 8 === 4); const k = (r() - .5) * 12 + Math.sin(x * 0.4) * 10;
    px(x, y, dot ? '#7aff9a' : seam ? rgb(90, 80, 120) : rgb(170 + k, 176 + k, 196 + k)); } });
  for (const [x, y] of [[4, 4], [12, 4], [4, 12], [12, 12]]) emit(123, x, y, '#5aff8a');
  paintTile(124, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const e = x < 2 || y < 2 || x > 13 || y > 13, d = Math.abs(x - y) < 1.5 || Math.abs(x + y - 15) < 1.5; const k = (r() - .5) * 14;
    px(x, y, e || d ? rgb(60 + k, 72 + k, 40) : rgb(86 + k, 104 + k, 56)); } for (let x = 5; x < 11; x++) px(x, 7, '#e8e0b0'); });
}

// v1.14 round 2 tiles: 128 gold ore, 129 platinum ore, 130 diamond ore, 131 emerald ore, 132 moon dust top, 133 moon dust side, 134 moon rock,
// 135 moon crystal (+glow), 136 yellow wallpaper, 137 damp carpet, 138 ceiling light (+glow), 140 glitch block (+glow), 141 shop stall side, 142 shop stall top
{
  const emit = (t, x, y, c) => { ectx.fillStyle = c; ectx.fillRect((t % AT) * TS + x, Math.floor(t / AT) * TS + y, 1, 1); };
  const oreT = (t, a, b) => paintTile(t, (px, r) => { noiseFill(px, r, [118, 118, 120], 30);
    for (let i = 0; i < 5; i++) { const x = 1 + (r() * 12 | 0), y = 1 + (r() * 12 | 0); px(x, y, a); px(x + 1, y, b); px(x, y + 1, b); px(x + 1, y + 1, '#222'); if (r() < 0.5) px(x + 2, y + 1, a); } });
  oreT(128, '#ffe14a', '#c9951a'); oreT(129, '#cff8fa', '#5fa0a8'); oreT(130, '#a8faff', '#2fb8c8'); oreT(131, '#7affa0', '#1a9a4a');
  paintTile(132, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 26 + (r() < 0.05 ? -40 : 0); px(x, y, rgb(178 + k, 178 + k, 184 + k)); } });
  paintTile(133, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 24; px(x, y, y < 4 ? rgb(176 + k, 176 + k, 182 + k) : rgb(120 + k, 120 + k, 126 + k)); } });
  paintTile(134, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 22, pit = Math.hypot(x - 5, y - 10) < 2.2 || Math.hypot(x - 11, y - 4) < 1.6 ? -30 : 0; px(x, y, rgb(104 + k + pit, 104 + k + pit, 112 + k + pit)); } });
  paintTile(135, (px, r) => { noiseFill(px, r, [60, 60, 70], 20); for (let i = 0; i < 4; i++) { const cx = 3 + (r() * 10 | 0); for (let y = 15; y > 5 + (r() * 5 | 0); y--) { px(cx, y, '#c0e8ff'); px(cx + 1, y, '#7a9cff'); } } });
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const d = actx.getImageData((135 % AT) * TS + x, Math.floor(135 / AT) * TS + y, 1, 1).data; if (d[2] > 200) emit(135, x, y, '#6a9cff'); }
  paintTile(136, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 12, stripe = (x % 4 === 0) ? -16 : 0, stain = Math.hypot(x - 11, y - 13) < 3 ? -22 : 0;
    px(x, y, rgb(206 + k + stripe + stain, 190 + k + stripe + stain, 112 + k * 0.5 + stain)); } for (let x = 0; x < TS; x += 4) px(x + 2, (x * 3) % 16, '#a89850'); });
  paintTile(137, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 20; px(x, y, rgb(150 + k, 136 + k, 82 + k)); } });
  paintTile(138, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const panel = x > 1 && x < 14 && y > 3 && y < 12; px(x, y, panel ? rgb(250, 250, 236) : rgb(196 + (r() - .5) * 10, 192, 170)); } });
  for (let y = 4; y < 12; y++) for (let x = 2; x < 14; x++) emit(138, x, y, '#fffbe0');
  paintTile(139, (px, r) => noiseFill(px, r, [196, 192, 170], 14));
  paintTile(140, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const v = r(); px(x, y, v < 0.25 ? '#ff00ff' : v < 0.5 ? '#000000' : v < 0.7 ? '#00ffff' : v < 0.85 ? '#ffffff' : '#30ff30'); } });
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if ((x * 5 + y * 3) % 4 === 0) emit(140, x, y, (x + y) % 2 ? '#ff40ff' : '#40ffff');
  paintTile(141, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 14; px(x, y, y < 5 ? (Math.floor(x / 2) % 2 ? rgb(230, 60, 50) : rgb(245, 240, 230)) : y === 5 ? '#6a4020' : rgb(170 + k, 120 + k, 70 + k)); }
    for (let x = 4; x < 12; x++) px(x, 9, '#ffd84a'); for (let x = 5; x < 11; x++) px(x, 10, '#c99a12'); });
  paintTile(142, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 12; px(x, y, (Math.floor(x / 2) % 2 ? rgb(226 + k, 60, 50) : rgb(245 + k * 0.3, 240, 230))); } });
}
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

// ---- marijuana crop (4 stages, 51..54), mushrooms (55 red, 56 brown), torch (57), cow poop (58)
function weedLeaf(px, cx, cy, sz, col) {   // a 5-7 finger fan leaf
  for (const a of [-1.3, -0.7, 0, 0.7, 1.3, -1.0, 1.0].slice(0, sz > 3 ? 7 : 5)) {
    const len = sz * (1 - Math.abs(a) * 0.3);
    for (let i = 1; i <= len; i++) px(Math.round(cx + Math.sin(a) * i), Math.round(cy - Math.cos(a) * i), col);
  }
}
for (let s = 0; s < 4; s++) paintTile(51 + s, (px, r) => {
  const stem = '#4f8a2b', leaf = s === 3 ? '#3f9a32' : '#4caf3a', dark = '#2e6b22';
  const hgt = s === 0 ? 5 : s === 1 ? 10 : 16;
  for (let y = 0; y < hgt; y++) { px(7, 15 - y, stem); px(8, 15 - y, s > 1 ? dark : stem); }
  const n = s === 0 ? 1 : s === 1 ? 2 : 4;
  for (let i = 0; i < n; i++) { const y = 15 - Math.round((i + 1) * hgt / (n + 1)); weedLeaf(px, 4, y + 1, s === 0 ? 2 : 3, i % 2 ? leaf : dark); weedLeaf(px, 11, y, s === 0 ? 2 : 3, i % 2 ? dark : leaf); }
  if (s >= 2) weedLeaf(px, 7, 4, 3, leaf);
  if (s === 3) for (let i = 0; i < 16; i++) { const x = 5 + (r() * 6 | 0), y = 1 + (r() * 8 | 0); px(x, y, r() < 0.5 ? '#a9d65a' : r() < 0.6 ? '#e08a3c' : '#8ac04a'); }   // sticky buds
});
const mushTile = (cap, spot) => (px, r) => {
  for (let y = 10; y < 16; y++) for (let x = 6; x < 10; x++) px(x, y, x === 6 ? '#cfc6b0' : '#efe8d6');
  for (let y = 4; y < 11; y++) for (let x = 2; x < 14; x++) { const dx = (x - 7.5) / 6, dy = (y - 10) / 6.5; if (dx * dx + dy * dy < 1) px(x, y, y === 10 ? '#7a5a40' : cap); }
  if (spot) for (const [x, y] of [[5, 6], [9, 5], [11, 8], [4, 9], [7, 8]]) px(x, y, spot);
  else for (let i = 0; i < 6; i++) px(4 + (r() * 8 | 0), 6 + (r() * 3 | 0), '#8a6446');
};
paintTile(55, mushTile('#d23a2a', '#ffffff'));
paintTile(56, mushTile('#a57650', null));
paintTile(57, (px, r) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    if (y < 4) px(x, y, y === 0 ? '#fff6b0' : y === 1 ? '#ffd23a' : y === 2 ? '#ff9a1a' : '#e05a10');
    else if (y < 6) px(x, y, '#3a2a1a');
    else px(x, y, rgb(120 + (r() - .5) * 20, 84, 44));
  }
});
for (let y = 0; y < 4; y++) for (let x = 0; x < TS; x++) { ectx.fillStyle = y < 2 ? '#ffe070' : '#ff8a20'; ectx.fillRect((57 % AT) * TS + x, Math.floor(57 / AT) * TS + y, 1, 1); }
paintTile(58, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 26, swirl = Math.sin(x * 0.9 + y * 0.5) > 0.6 ? -18 : 0; px(x, y, rgb(96 + k + swirl, 64 + k * 0.7 + swirl, 30 + k * 0.4)); } });

// ---- town & city tiles (64..77)
const asphalt = (px, r) => noiseFill(px, r, [52, 52, 56], 18);
paintTile(64, asphalt);
paintTile(65, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 14, j = x === 0 || y === 0 ? -26 : 0; px(x, y, rgb(178 + k + j, 176 + k + j, 170 + k + j)); } });
paintTile(66, (px, r) => noiseFill(px, r, [150, 150, 148], 12));
paintTile(67, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const f = x === 0 || y === 0 || x === 15 || y === 15; px(x, y, f ? '#2a3440' : rgb(60 + y * 3, 120 + y * 3, 170 + y * 2, 0.75)); } px(4, 4, 'rgba(255,255,255,.8)'); px(5, 3, 'rgba(255,255,255,.8)'); });
paintTile(68, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const row = y % 4, off = (Math.floor(y / 4) % 2) * 4, edge = row === 3 || (x + off) % 8 === 0; const k = (r() - .5) * 16; px(x, y, edge ? rgb(110, 34, 26) : rgb(170 + k, 58 + k * .5, 40)); } });
paintTile(69, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 8, seam = y % 4 === 3, fr = x === 0 || x === 15; px(x, y, fr ? '#555' : seam ? rgb(180, 182, 186) : rgb(222 + k, 224 + k, 228 + k)); } for (let x = 6; x < 10; x++) px(x, 13, '#444'); });
paintTile(70, (px, r) => noiseFill(px, r, [236, 234, 226], 10));
paintTile(71, (px, r) => { asphalt(px, r); for (let x = 2; x < 14; x++) { px(x, 7, '#f2c21a'); px(x, 8, '#f2c21a'); } });
paintTile(72, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 8; px(x, y, y % 4 === 3 ? rgb(60, 92, 140) : rgb(96 + k, 140 + k, 196 + k)); } });
paintTile(73, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const k = (r() - .5) * 8; px(x, y, y % 4 === 3 ? rgb(176, 150, 60) : rgb(236 + k, 208 + k, 110 + k)); } });
paintTile(74, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const f = x < 2 || x > 13 || y < 2 || y > 13; px(x, y, f ? '#2a2a2e' : rgb(255, 236, 170 - Math.hypot(x - 7.5, y - 7.5) * 6)); } });
for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) { ectx.fillStyle = '#ffe9a8'; ectx.fillRect((74 % AT) * TS + x, Math.floor(74 / AT) * TS + y, 1, 1); }
const officeLit = new Set();
paintTile(75, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const frame = x % 8 < 1 || y % 8 < 1; px(x, y, frame ? '#8a8e94' : rgb(40 + y * 2, 70 + y * 2, 100 + y * 2)); }
  for (const [wx, wy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) if (r() < 0.55) { officeLit.add(wx + ',' + wy); for (let y = wy + 1; y < wy + 8; y++) for (let x = wx + 1; x < wx + 8; x++) px(x, y, rgb(255, 222, 140 + (r() - .5) * 30)); } });
for (const k of officeLit) { const [wx, wy] = k.split(',').map(Number); ectx.fillStyle = '#e8c070'; ectx.fillRect((75 % AT) * TS + wx + 1, Math.floor(75 / AT) * TS + wy + 1, 7, 7); }
paintTile(76, (px, r) => { asphalt(px, r); for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (x % 4 < 2) px(x, y, rgb(236, 236, 230)); });
paintTile(77, (px, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const f = x === 0 || x === 15 || y === 0 || y === 15; px(x, y, f ? '#3a3a3a' : rgb(170, 210, 230, 0.45)); } });

// ================== HD TEXTURE PACK (64px tiles, toggle in Settings) ==================
const HS = 64;
let HD_ON = (() => { try { return (JSON.parse(localStorage.getItem('dealercraft_settings')) || {}).hdTex !== false; } catch (e) { return true; } })();
const hdAtlas = document.createElement('canvas'); hdAtlas.width = HS * AT; hdAtlas.height = HS * AR;
const hctx = hdAtlas.getContext('2d');
// smooth tileable value noise
function tnoise(seed, cells) { const r = mulberry(seed), g = []; for (let i = 0; i < cells * cells; i++) g.push(r());
  const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)], sm = t => t * t * (3 - 2 * t);
  return (u, v) => { const x = u * cells, y = v * cells, x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0);
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy; }; }
function tfbm(seed, oct = 4, base = 4) { const ns = []; for (let o = 0; o < oct; o++) ns.push(tnoise(seed + o * 101, base << o)); return (u, v) => { let s = 0, a = 0.5, t = 0; for (const n of ns) { s += n(u, v) * a; t += a; a *= 0.5; } return s / t; }; }
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
// paint an HD tile pixel by pixel: fn(x, y, u, v, r) returns [r,g,b,a?] or null (transparent)
function paintHD(t, fn) {
  const ox = (t % AT) * HS, oy = Math.floor(t / AT) * HS, img = hctx.createImageData(HS, HS), d = img.data, r = mulberry(t * 7919 + 3);
  for (let y = 0; y < HS; y++) for (let x = 0; x < HS; x++) { const c = fn(x, y, (x + 0.5) / HS, (y + 0.5) / HS, r); const i = (y * HS + x) * 4;
    if (c) { d[i] = clamp255(c[0]); d[i + 1] = clamp255(c[1]); d[i + 2] = clamp255(c[2]); d[i + 3] = c[3] == null ? 255 : c[3]; } }
  hctx.putImageData(img, ox, oy);
}
// generic upgrade for every tile without a hand-made HD version: upscale, then add fine grain and a soft bevel per texel
(function upscaleAll() {
  hctx.imageSmoothingEnabled = false; hctx.drawImage(atlas, 0, 0, HS * AT, HS * AR);
  const img = hctx.getImageData(0, 0, HS * AT, HS * AR), d = img.data, r = mulberry(4242), W = HS * AT, k = HS / TS;
  for (let y = 0; y < HS * AR; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (!d[i + 3]) continue;
    const lx = x % k, ly = y % k, bev = (lx === 0 || ly === 0 ? 10 : 0) - (lx === k - 1 || ly === k - 1 ? 12 : 0), n = (r() - 0.5) * 14 + bev;
    d[i] = clamp255(d[i] + n); d[i + 1] = clamp255(d[i + 1] + n); d[i + 2] = clamp255(d[i + 2] + n); }
  hctx.putImageData(img, 0, 0);
})();
const cmix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cshade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
// grass top: dense blades
const grassN = tfbm(11, 4, 4), grassB = tnoise(12, 32);
const grassCol = (u, v, r) => { const n = grassN(u, v), b = grassB(u * 2, v * 2); return cshade(cmix([62, 112, 38], [104, 160, 62], n), 0.82 + b * 0.32 + (r() - 0.5) * 0.08); };
paintHD(0, (x, y, u, v, r) => grassCol(u, v, r));
// dirt: clumps, pebbles, dark specks
const dirtN = tfbm(21, 4, 4), dirtP = tnoise(22, 16);
const dirtCol = (u, v, r) => { const n = dirtN(u, v), p = dirtP(u, v); let c = cmix([96, 66, 42], [150, 108, 74], n); if (p > 0.82) c = cmix(c, [128, 120, 110], 0.6); if (r() < 0.04) c = cshade(c, 0.7); return cshade(c, 0.94 + (r() - 0.5) * 0.1); };
paintHD(2, (x, y, u, v, r) => dirtCol(u, v, r));
paintHD(10, (x, y, u, v, r) => { const row = Math.floor(v * 4), f = (v * 4) % 1, c = dirtCol(u, v, r); return cshade(c, f < 0.18 ? 0.62 : 0.78 + f * 0.15); });
// grass side: dirt with a ragged grassy fringe that drips down
const fringe = tnoise(31, 8);
paintHD(1, (x, y, u, v, r) => { const edge = 0.16 + fringe(u, 0.5) * 0.14 + (Math.floor(u * 32) % 3 === 0 ? 0.05 : 0); return v < edge ? cshade(grassCol(u, v, r), v > edge - 0.03 ? 0.75 : 1) : dirtCol(u, v, r); });
// stone: soft blotches with crack lines
const stoneN = tfbm(41, 5, 3), stoneC = tnoise(42, 6);
const stoneCol = (u, v, r) => { const n = stoneN(u, v), c = Math.abs(stoneC(u, v) - 0.5); let k = 98 + n * 62 + (r() - 0.5) * 8; if (c < 0.02) k -= 34; return [k, k, k + 2]; };
paintHD(3, (x, y, u, v, r) => stoneCol(u, v, r));
// ores
const oreHD = (t, col, seed) => { const on = tnoise(seed, 5); paintHD(t, (x, y, u, v, r) => { const o = on(u, v), s = stoneCol(u, v, r); if (o > 0.72) { const h = (o - 0.72) / 0.28; return cshade(col, 0.75 + h * 0.5 + (r() - 0.5) * 0.1); } if (o > 0.69) return cshade(s, 0.7); return s; }); };
oreHD(15, [38, 38, 40], 51); oreHD(41, [216, 168, 128], 52);
paintHD(14, (x, y, u, v, r) => { const n = tfbm(61, 3, 4)(u, v); const k = n < 0.4 ? 28 : n < 0.6 ? 58 : 88; return [k + (r() - .5) * 10, k, k]; });
// sand: fine grain with ripples
const sandN = tfbm(71, 3, 4);
paintHD(4, (x, y, u, v, r) => { const k = 0.92 + Math.sin((v + sandN(u, v) * 0.3) * 40) * 0.03 + (r() - 0.5) * 0.08; return cshade([222, 208, 160], k); });
// water: wavy caustics
const watN = tfbm(81, 3, 3);
paintHD(5, (x, y, u, v, r) => { const w = Math.sin((u + watN(u, v) * 0.6) * 18 + v * 9) * 0.5 + 0.5; return [36 + w * 30, 82 + w * 36, 190 + w * 40, 196]; });
// log bark: vertical furrows
const barkN = tnoise(91, 12), barkF = tfbm(92, 3, 4);
paintHD(6, (x, y, u, v, r) => { const f = barkN(u * 1, v * 0.25 + 0.0); const furrow = Math.abs(Math.sin((u + barkF(u, v) * 0.15) * Math.PI * 7)); const k = 0.62 + furrow * 0.42 + (r() - .5) * 0.08; return cshade(cmix([86, 64, 38], [118, 90, 56], f), k); });
// log top: growth rings
paintHD(7, (x, y, u, v, r) => { const d = Math.hypot(u - 0.5, v - 0.5) * 2; if (d > 0.88) return cshade([96, 72, 44], 0.8 + (r() - .5) * 0.15); const ring = Math.sin((d + barkF(u, v) * 0.08) * 34) * 0.5 + 0.5; return cshade([176, 140, 90], 0.86 + ring * 0.14 + (r() - .5) * 0.05); });
// autumn leaves: overlapping leaf clusters with see-through gaps
const leafN = tnoise(101, 14), leafH = tnoise(102, 5);
paintHD(8, (x, y, u, v, r) => { const l = leafN(u, v); if (l < 0.33) return null; const hue = leafH(u, v), b = 0.7 + (l - 0.33) * 0.6; const c = hue < 0.4 ? [214, 92, 24] : hue < 0.7 ? [178, 46, 26] : hue < 0.85 ? [226, 160, 42] : [130, 76, 32]; return cshade(c, b + (r() - .5) * 0.1); });
// planks: four boards with grain and nail holes
const grain = tfbm(111, 3, 6);
paintHD(9, (x, y, u, v, r) => { const row = Math.floor(v * 4), f = (v * 4) % 1, off = row * 0.37; if (f < 0.05 || f > 0.96) return [96, 70, 40]; const seam = ((u + off) % 1) < 0.015; if (seam) return [110, 80, 46];
  const g = Math.sin((v * 4 + grain(u * 0.3 + off, v) * 2.2) * 9) * 0.5 + 0.5; let c = cshade([184, 146, 94], 0.86 + g * 0.16 + (r() - .5) * 0.05); const nx = ((u + off) % 1); if ((Math.abs(nx - 0.06) < 0.012 || Math.abs(nx - 0.94) < 0.012) && Math.abs(f - 0.5) < 0.05) c = [70, 52, 34]; return c; });
// cobblestone: rounded stones with mortar
const cobR = mulberry(121), cobPts = Array.from({ length: 14 }, () => [cobR(), cobR(), 0.85 + cobR() * 0.3]);
paintHD(11, (x, y, u, v, r) => { let d1 = 9, d2 = 9, kk = 1; for (const [px, py, k] of cobPts) for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) { const d = Math.hypot(u - px - ox, v - py - oy); if (d < d1) { d2 = d1; d1 = d; kk = k; } else if (d < d2) d2 = d; }
  const e = d2 - d1; if (e < 0.025) return [62, 62, 64]; const s = stoneCol(u, v, r); return cshade(s, kk * (0.85 + Math.min(1, e * 6) * 0.2)); });
// bricks
paintHD(13, (x, y, u, v, r) => { const row = Math.floor(v * 4), f = (v * 4) % 1, bu = (u * 2 + (row % 2) * 0.5) % 1; if (f < 0.08 || bu < 0.04) return cshade([186, 180, 168], 0.9 + (r() - .5) * 0.1); const n = stoneN(u, v); return cshade(cmix([140, 58, 44], [178, 82, 60], n), 0.9 + (r() - .5) * 0.12); });
// dead grass (spooky) top and side
const deadCol = (u, v, r) => cshade(cmix([86, 78, 56], [124, 114, 82], grassN(u, v)), 0.84 + grassB(u * 2, v * 2) * 0.28 + (r() - 0.5) * 0.08);
paintHD(38, (x, y, u, v, r) => deadCol(u, v, r));
paintHD(40, (x, y, u, v, r) => { const edge = 0.14 + fringe(u, 0.5) * 0.12; return v < edge ? deadCol(u, v, r) : dirtCol(u, v, r); });
function hdBlit(c, t) { const s = HD_ON ? HS : TS; c.width = c.height = s; c.getContext('2d').drawImage(HD_ON ? hdAtlas : atlas, (t % AT) * s, Math.floor(t / AT) * s, s, s, 0, 0, s, s); return c; }
// v1.14 round 2: HD versions of the new ores (the rest use the generic upscale)
oreHD(128, [255, 214, 60], 1281); oreHD(129, [200, 244, 248], 1291); oreHD(130, [120, 240, 255], 1301); oreHD(131, [90, 240, 130], 1311);

const tex = new THREE.CanvasTexture(HD_ON ? hdAtlas : atlas);
tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
function tileURL(t) { return hdBlit(document.createElement('canvas'), t).toDataURL(); }

// ================== ITEM ICONS (pixel art drawn in code) ==================
const MATCOL = { wood: ['#c49a5c', '#7a5a30'], stone: ['#a5a5a5', '#5f5f5f'], iron: ['#eeeeee', '#9c9c9c'], leather: ['#a8622c', '#6a3a18'], gold: ['#ffe14a', '#c9951a'], silver: ['#dfe6f0', '#8f9bb0'], platinum: ['#bfeff0', '#5fa0a8'], diamond: ['#9ff4ff', '#2fb8c8'] };
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
    case 'shovel': handle(2, 13, 9, 6); shape(11, 5, (u, v) => { const a = Math.abs(v); return a < 2.3 && u > -1.6 && u < 3 - a * a * 0.25 ? (a > 1.4 || u > 2.2 - a * a * 0.25 ? 2 : 1) : 0; }); break;
    case 'ring': for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) { const d = Math.hypot(px - 7.5, (py - 9.5) * 1.15); if (d > 3.2 && d < 5.4) P(px, py, px + py < 16 ? ml : md); }
      if (mat === 'diamond') { for (const [a, b, c2] of [[7, 2, '#e8ffff'], [8, 2, '#9ff4ff'], [6, 3, '#9ff4ff'], [7, 3, '#ffffff'], [8, 3, '#6fe0f0'], [9, 3, '#2fb8c8'], [7, 4, '#2fb8c8'], [8, 4, '#2fb8c8']]) P(a, b, c2); for (const a of [6, 9]) P(a, 4, '#c9951a'); }
      else { P(7, 3, '#ff4a6a'); P(8, 3, '#d02040'); P(7, 4, '#d02040'); P(8, 4, '#901030'); } break;
    case 'stairs': for (let py = 2; py < 15; py++) for (let px = 1; px < 15; px++) { const step = py >= 9 || px >= 8; if (step) P(px, py, (px === 1 || py === 14 || px === 14 || (py === 9 && px < 8) || (px === 8 && py < 9) || py === 2) ? md : ((px * 3 + py * 5) % 7 ? ml : md)); } break;
    case 'saddle': for (let py = 3; py < 13; py++) for (let px = 1; px < 15; px++) { const yy = 6 + Math.abs(px - 7.5) * 0.45 - (px < 4 ? 2 : 0); if (py >= yy && py < yy + 4) P(px, py, py === Math.ceil(yy) ? '#d08a4c' : (px + py) % 4 ? ml : md); }
      for (let py = 9; py < 15; py++) { P(5, py, '#555'); P(10, py, '#555'); } P(5, 14, '#bbb'); P(10, 14, '#bbb'); break;
    case 'map': for (let py = 1; py < 15; py++) for (let px = 1; px < 15; px++) { const e = px === 1 || py === 1 || px === 14 || py === 14; const n = Math.sin(px * 0.9) + Math.cos(py * 0.7 + px * 0.3); P(px, py, e ? '#8a6a3a' : n > 0.9 ? '#3a6ad8' : n > -0.2 ? '#4caf3a' : n > -1 ? '#d8c890' : '#2e7a2a'); } P(8, 7, '#d02020'); P(7, 8, '#d02020'); break;
    case 'torch': handle(4, 13, 9, 8); for (const [a, b, c2] of [[10, 6, '#ffd23a'], [11, 6, '#ff9a1a'], [10, 7, '#ff9a1a'], [11, 5, '#fff6b0'], [10, 5, '#ffd23a'], [12, 5, '#ff9a1a'], [11, 4, '#ffd23a'], [12, 4, '#fff6b0'], [11, 7, '#e05a10'], [12, 6, '#e05a10'], [9, 7, '#3a2a1a'], [10, 8, '#3a2a1a']]) P(a, b, c2); break;
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
  else if (it.tile != null || it.block != null) c = hdBlit(document.createElement('canvas'), it.tile != null ? it.tile : BT[it.block][2]);
  else { c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = '52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.emoji || '?', 32, 36); }
  return (iconCanvas[id] = c);
}
function iconHTML(id) {
  const it = ITEMS[id]; if (!it) return '';
  if (!it.px && it.block == null && it.tile == null) return it.emoji;
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
function tileUV(t, u, v) { const e = 0.001, s = 1 / AT, r = 1 / AR; return [(t % AT) * s + e + u * (s - 2 * e), 1 - (Math.floor(t / AT) + 1) * r + e * 0.5 + v * (r - e)]; }
function dropMesh(key) { const old = chunks[key]; if (old) { for (const m of old) { scene.remove(m); m.geometry.dispose(); } delete chunks[key]; } }
// height of a water surface inside its block
function waterTop(id, above) { if (isWater(above)) return 1; if (id === WATER) return 0.88; if (id === FALL) return 0.88; return 0.88 - (id - FLOW1 + 1) * 0.1; }
// a door is a thin slab against one side of its block; open doors swing to the next side
function doorBox(id) { const s = doorOpen(id) ? (doorF(id) + 1) % 4 : doorF(id), t = 0.1875;
  return [[0, 0, 0, 1, 1, t], [1 - t, 0, 0, 1, 1, 1], [0, 0, 1 - t, 1, 1, 1], [0, 0, 0, t, 1, 1]][s]; }
// ---- lighting: sky shadows (caves, roofs, tree shade) + light baked from torches
const mapMem = new Map();   // map item / GPS: remembered top colours per chunk (saved per world, see p_r_v109)
const mapDirty = new Set();
const glows = id => id === TORCH || id === LAMP || id === FIRE;
const torches = new Set(Object.keys(state.edits).filter(k => glows(state.edits[k])));
const blocksSky = id => id !== AIR && !isWater(id) && !PLANT.has(id) && id !== GLASS && id !== LEAVES;
function lightKit(x0, z0) {
  const W = CH + 6, top = new Int16Array(W * W), leaf = new Int16Array(W * W);   // highest sky-blocking block / leaf per column (3 block margin)
  for (let dz = 0; dz < W; dz++) for (let dx = 0; dx < W; dx++) {
    const x = x0 + dx - 3, z = z0 + dz - 3; let t = -1, l = -1;
    for (let y = H - 1; y >= 0; y--) { const id = get(x, y, z); if (l < 0 && id === LEAVES) l = y; if (blocksSky(id)) { t = y; break; } }
    top[dz * W + dx] = t; leaf[dz * W + dx] = l;
  }
  const near = [...torches].map(k => k.split(',').map(Number)).filter(([tx, , tz]) => tx > x0 - 9 && tx < x0 + CH + 9 && tz > z0 - 9 && tz < z0 + CH + 9);
  const sky = (x, y, z) => { const dx = x - x0 + 3, dz = z - z0 + 3; if (dx < 0 || dz < 0 || dx >= W || dz >= W) return true; return y > top[dz * W + dx]; };
  return (x, y, z) => {   // light of an (air) cell: [brightness, torch warmth]
    let L;
    if (sky(x, y, z)) { const dx = x - x0 + 3, dz = z - z0 + 3; L = (dx >= 0 && dz >= 0 && dx < W && dz < W && y < leaf[dz * W + dx]) ? 0.8 : 1; }
    else {
      L = 0.24;
      for (let r = 1; r <= 3 && L < 0.3; r++) for (const [ax, az] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) if (sky(x + ax, y, z + az) || sky(x + ax, y + r, z + az)) { L = [0, 0.66, 0.48, 0.34][r]; break; }
    }
    let T = 0; for (const [tx, ty, tz] of near) { const d = Math.hypot(tx - x, ty - y, tz - z); if (d < 8) T = Math.max(T, 1 - d / 8); }
    return [Math.max(L, Math.min(1, T * 1.15)), T];
  };
}
function pushBox(A, x, y, z, b, tile, lv = 1, wt = 0) {
  const [x0, y0, z0, x1, y1, z1] = b;
  for (const f of FACES) {
    const base = A.p.length / 3;
    for (const q of f.c) {
      A.p.push(x + (q[0] ? x1 : x0), y + (q[1] ? y1 : y0), z + (q[2] ? z1 : z0));
      A.n.push(f.d[0], f.d[1], f.d[2]);
      const uv = tileUV(tile, q[3], q[4]); A.u.push(uv[0], uv[1]); const sh = f.s * lv; A.c.push(sh + wt * 0.22, sh + wt * 0.08, sh);
    }
    A.i.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
}
function buildChunk(cx, cz) {
  const key = ckey(cx, cz), c = data.get(key); if (!c) return;
  const A = { p: [], n: [], u: [], c: [], i: [] }, Bw = { p: [], n: [], u: [], c: [], i: [] };
  const x0 = cx * CH, z0 = cz * CH, lit = lightKit(x0, z0);
  const look = chunkLook(x0, z0);   // v1.10: season/biome colours and snow cover per column
  const cull = caveCullFor(cx, cz);   // v1.14: far-away cave interiors are not drawn (see p_z4)
  const nbAt = (lx, y, lz, dx, dy, dz) => { const nx = lx + dx, ny = y + dy, nz = lz + dz; return (nx >= 0 && nz >= 0 && nx < CH && nz < CH) ? (ny < 0 ? STONE : ny >= H ? AIR : c[lidx(nx, ny, nz)]) : get(x0 + nx, ny, z0 + nz); };
  for (let y = 0; y < H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const id = c[lidx(lx, y, lz)]; if (id === AIR) continue;
    const x = x0 + lx, z = z0 + lz;
    if (isDoor(id)) { pushBox(A, x, y, z, doorBox(id), doorTop(id) ? 48 : 47); continue; }
    if (id >= 65 && id < 81) { const f = furnF(id); for (const [b, t] of FURN_MODEL[furnBase(id)]) pushBox(A, x, y, z, rotBox(b, f), t); continue; }
    if (MODEL.has(id)) { const [lv, wt] = lit(x, y, z); for (const [b, t] of modelBoxes(id)) pushBox(A, x, y, z, b, t, lv, wt); continue; }
    if (id === TORCH) { pushBox(A, x, y, z, [0.44, 0, 0.44, 0.56, 0.62, 0.56], 57); continue; }
    if (id === SNOW_LAYER) { const [lv, wt] = lit(x, y, z); pushBox(A, x, y, z, [0, 0, 0, 1, 0.125, 1], 95, lv, wt); continue; }
    if (id === FIRE) {   // crossed flame sprites, always bright
      for (const [ax, az, bx, bz] of [[0.1, 0.1, 0.9, 0.9], [0.1, 0.9, 0.9, 0.1], [0.9, 0.9, 0.1, 0.1], [0.9, 0.1, 0.1, 0.9]]) {
        const b = A.p.length / 3; A.p.push(x + ax, y, z + az, x + bx, y, z + bz, x + ax, y + 1, z + az, x + bx, y + 1, z + bz);
        A.u.push(...tileUV(97, 0, 0), ...tileUV(97, 1, 0), ...tileUV(97, 0, 1), ...tileUV(97, 1, 1));
        for (let q = 0; q < 4; q++) { A.n.push(0, 1, 0); A.c.push(1.2, 1.05, 0.9); } A.i.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
      }
      continue;
    }
    if (id === POOP) { pushBox(A, x, y, z, [0.28, 0, 0.3, 0.72, 0.16, 0.7], 58); pushBox(A, x, y, z, [0.36, 0.16, 0.38, 0.64, 0.28, 0.62], 58); pushBox(A, x, y, z, [0.44, 0.28, 0.46, 0.56, 0.36, 0.54], 58); continue; }
    if (id === RED_MUSH || id === BROWN_MUSH) {   // crossed sprite, both sides
      const tile = BT[id][0], [lv, wt] = lit(x, y, z), cc = [lv + wt * 0.25, lv + wt * 0.1, lv];
      for (const [ax, az, bx, bz] of [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15], [0.85, 0.85, 0.15, 0.15], [0.85, 0.15, 0.15, 0.85]]) {
        const b = A.p.length / 3, s = 0.7;
        A.p.push(x + ax, y, z + az, x + bx, y, z + bz, x + ax, y + s, z + az, x + bx, y + s, z + bz);
        A.u.push(...tileUV(tile, 0, 0), ...tileUV(tile, 1, 0), ...tileUV(tile, 0, 1), ...tileUV(tile, 1, 1));
        for (let q = 0; q < 4; q++) { A.n.push(0, 1, 0); A.c.push(...cc); }
        A.i.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
      }
      continue;
    }
    const T = BT[id], wat = isWater(id);
    const top = wat ? waterTop(id, nbAt(lx, y, lz, 0, 1, 0)) : 1;
    for (const f of FACES) {
      const nb = nbAt(lx, y, lz, f.d[0], f.d[1], f.d[2]);
      if (wat) { if (isWater(nb) || (nb !== AIR && !seeThrough(nb))) { if (!(f.d[1] === 1 && top < 1 && nb === AIR)) continue; } }
      else if (nb !== AIR && !(seeThrough(nb) && (nb !== id || PLANT.has(nb)))) continue;
      if (cull && nb === AIR && cull(x + f.d[0], y + f.d[1], z + f.d[2])) continue;
      const tgt = wat ? Bw : A;
      let tile = f.f === 0 ? T[0] : f.f === 1 ? T[1] : T[2], tr = 1, tg = 1, tb = 1;
      if (id === GRASS || id === DEADGRASS || id === LEAVES) { const ci = lx + lz * CH;
        if (id === LEAVES) tile = look.leaf[ci];
        else if (look.cold[ci]) { if (f.f === 0) tile = 95; else if (f.f !== 1) tile = 96; }
        else if (f.f === 0) { tr = look.tint[ci * 3]; tg = look.tint[ci * 3 + 1]; tb = look.tint[ci * 3 + 2]; } }
      const base = tgt.p.length / 3;
      const topDrop = wat ? 1 - top : (id === FARM && f.d[1] === 1 ? 0.06 : 0);
      const [lv, wt] = lit(x + f.d[0], y + f.d[1], z + f.d[2]), sh = f.s * lv, cr = (sh + wt * 0.22) * tr, cg = (sh + wt * 0.08) * tg;
      for (const q of f.c) {
        tgt.p.push(x + q[0], y + q[1] - (q[1] === 1 ? topDrop : 0), z + q[2]);
        tgt.n.push(f.d[0], f.d[1], f.d[2]);
        const uv = tileUV(tile, q[3], q[4]); tgt.u.push(uv[0], uv[1]);
        tgt.c.push(cr, cg, sh * tb);
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
  const old = get(x, y, z);
  rawSet(x, y, z, id); const k = x + ',' + y + ',' + z; state.edits[k] = id; indexEdit(k);
  if (furnBase(old) !== furnBase(id) && state.dev && state.dev[k] != null) delete state.dev[k];
  if (typeof netEdit === 'function') netEdit(k, id);
  markDirty(x, z); wakeWater(x, y, z);
  if (glows(id)) torches.add(k); else torches.delete(k);
  mapDirty.add(ckey(fdiv(x, CH), fdiv(z, CH)));
  // light/shadow can change around this spot: remesh neighbouring chunks too
  const reach = glows(old) || glows(id) ? 8 : (blocksSky(old) !== blocksSky(id) ? 3 : 0);
  if (reach) for (const dx of [-reach, 0, reach]) for (const dz of [-reach, 0, reach]) markDirty(x + dx, z + dz);
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
  if (data.size > Math.max(600, (2 * VIEW + 13) ** 2)) for (const key of data.keys()) { const [cx, cz] = key.split(',').map(Number); if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (VIEW + 6) ** 2) { dropMesh(key); data.delete(key); } }
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

// ---- torch glow: a few warm point lights follow the torches closest to you
const torchLights = [];
for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffa04a, 0, 12, 1.4); scene.add(l); torchLights.push(l); }
let torchPick = [], torchPickT = 0;
function updateTorchLights(dt) {
  torchPickT -= dt;
  if (torchPickT <= 0) {
    torchPickT = 0.4; const p = player.pos;
    torchPick = [...torches].map(k => k.split(',').map(Number)).map(c => [c, (c[0] - p.x) ** 2 + (c[1] - p.y) ** 2 + (c[2] - p.z) ** 2]).filter(a => a[1] < 900).sort((a, b) => a[1] - b[1]).slice(0, torchLights.length).map(a => a[0]);
  }
  const t = performance.now() / 1000;
  torchLights.forEach((l, i) => {
    const c = torchPick[i]; if (!c) { l.intensity = 0; return; }
    l.position.set(c[0] + 0.5, c[1] + 0.75, c[2] + 0.5);
    l.intensity = (1.2 + nightAmt * 2.3) * (0.88 + Math.sin(t * 9 + i * 2.1) * 0.06 + Math.sin(t * 23 + i) * 0.04);
  });
}

// crops mesh (marijuana grows 2 blocks tall, rarely 3 with cow poop; mushrooms swell as they grow)
let cropMesh = null, weedMesh = null;
// ---- a real-looking cannabis plant: hand-drawn serrated 7-finger fan leaves, frosty buds with orange hairs
const weedTex = (() => {  // eslint-disable-line
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  // fan leaf (0..128): 7 serrated leaflets from one point, a petiole down to the bottom centre
  const ox = 64, oy = 112;
  x.strokeStyle = '#5f9a3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox, 127); x.stroke();
  const fingers = [[-88, 0.36], [-58, 0.62], [-28, 0.86], [0, 1], [28, 0.86], [58, 0.62], [88, 0.36]];
  for (const [deg, len] of fingers) {
    const a = deg * Math.PI / 180, L = 100 * len, W = 9 * (0.55 + len * 0.45), ux = Math.sin(a), uy = -Math.cos(a), nx = -uy, ny = ux;
    const pts = [], N = 22;
    for (let s = 0; s <= 1; s++) for (let i = 0; i <= N; i++) {
      const t = s ? 1 - i / N : i / N, w = Math.sin(Math.PI * Math.pow(t, 0.75)) * W * (1 - t * 0.15), saw = (i % 2 ? 0.55 : 1.0), side = s ? -1 : 1;
      pts.push([ox + ux * L * t + nx * w * saw * side, oy + uy * L * t + ny * w * saw * side]);
    }
    const g = x.createLinearGradient(ox, oy, ox + ux * L, oy + uy * L); g.addColorStop(0, '#2f6d22'); g.addColorStop(0.5, '#3f8f2c'); g.addColorStop(1, '#5aa83a');
    x.fillStyle = g; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts) x.lineTo(...p); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(190,230,140,.75)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + ux * L * 0.95, oy + uy * L * 0.95); x.stroke();
    x.strokeStyle = 'rgba(160,210,120,.35)'; x.lineWidth = 0.7;
    for (let t = 0.15; t < 0.9; t += 0.09) for (const side of [-1, 1]) { const bx = ox + ux * L * t, by = oy + uy * L * t, w = Math.sin(Math.PI * Math.pow(t, 0.75)) * W * 0.9; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + ux * w * 0.8 + nx * w * side, by + uy * w * 0.8 + ny * w * side); x.stroke(); }
  }
  // bud / cola (128..192): dense frosty calyxes, sugar leaves, orange pistils, trichomes
  for (let i = 0; i < 420; i++) {
    const t = Math.random(), yy = 6 + t * 116, half = 6 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 22 * (0.6 + t * 0.4), xx = 160 + (Math.random() - .5) * 2 * half;
    const g = 70 + Math.random() * 90; x.fillStyle = `rgb(${g * 0.55 | 0},${g + 40 | 0},${g * 0.45 | 0})`; x.beginPath(); x.ellipse(xx, yy, 3 + Math.random() * 3, 4 + Math.random() * 4, Math.random() * 3, 0, 7); x.fill();
  }
  for (let i = 0; i < 70; i++) { const yy = 8 + Math.random() * 110, xx = 160 + (Math.random() - .5) * 40; x.strokeStyle = Math.random() < 0.6 ? '#e2862a' : '#c9542a'; x.lineWidth = 1; x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx + (Math.random() - .5) * 10, yy - 4, xx + (Math.random() - .5) * 12, yy - 7 - Math.random() * 5); x.stroke(); }
  for (let i = 0; i < 260; i++) { const yy = 6 + Math.random() * 116, xx = 160 + (Math.random() - .5) * 46; const d = x.getImageData(xx | 0, yy | 0, 1, 1).data; if (d[3]) { x.fillStyle = 'rgba(245,250,235,.85)'; x.fillRect(xx, yy, 1, 1); } }
  for (let i = 0; i < 16; i++) { const yy = 20 + Math.random() * 100, side = Math.random() < 0.5 ? -1 : 1, xx = 160 + side * (10 + Math.random() * 10); x.fillStyle = '#3f8f2c'; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + side * 14, yy - 10); x.lineTo(xx + side * 4, yy - 2); x.fill(); }
  // stalk (192..256)
  const sg = x.createLinearGradient(208, 0, 240, 0); sg.addColorStop(0, '#3e6e24'); sg.addColorStop(0.5, '#6aa840'); sg.addColorStop(1, '#3e6e24'); x.fillStyle = sg; x.fillRect(208, 0, 32, 128);
  for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(30,60,20,.35)'; x.fillRect(208 + Math.random() * 32, Math.random() * 128, 1, 6 + Math.random() * 10); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const weedMat = new THREE.MeshLambertMaterial({ map: weedTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
// adds one plant at (x,y0,z) to the arrays; g = growth 0..1, ht = final height in blocks
function addWeed(A, x, y0, z, g, ht, seed) {
  const r = mulberry(seed), H = 0.25 + Math.min(1, g * 1.15) * (ht - 0.3);
  const quad = (p0, p1, p2, p3, u0, u1) => { const b = A.p.length / 3; A.p.push(...p0, ...p1, ...p2, ...p3); A.u.push(u0, 0, u1, 0, u1, 1, u0, 1); for (let i = 0; i < 4; i++) A.n.push(0, 1, 0); A.i.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const cx = x + 0.5, cz = z + 0.5, sw = 0.035 + g * 0.03;
  for (const [ax, az] of [[1, 0], [0, 1]]) quad([cx - ax * sw, y0, cz - az * sw], [cx + ax * sw, y0, cz + az * sw], [cx + ax * sw * 0.6, y0 + H, cz + az * sw * 0.6], [cx - ax * sw * 0.6, y0 + H, cz - az * sw * 0.6], 0.8125, 0.9375);
  // fan leaves in alternating pairs up the stalk, bigger near the bottom, drooping a little
  const nodes = Math.max(2, Math.round(H * 6)), rot0 = r() * 6.28;
  for (let n = 0; n < nodes; n++) {
    const t = (n + 0.5) / (nodes + 0.3), y = y0 + H * t * 0.93, size = (0.78 - t * 0.48) * (0.5 + g * 0.6), rot = rot0 + n * 1.1, per = t < 0.75 ? 3 : 2;
    for (let q = 0; q < per; q++) {
      const a = rot + q * Math.PI * 2 / per + (r() - .5) * 0.5, dx = Math.sin(a), dz = Math.cos(a), px = -dz, pz = dx, tilt = 0.2 + t * 0.45 + r() * 0.2;
      const bx = cx + dx * 0.02, bz = cz + dz * 0.02, out = size, up = size * tilt, wid = size * 0.5;
      quad([bx - px * wid, y - 0.04, bz - pz * wid], [bx + px * wid, y - 0.04, bz + pz * wid], [bx + px * wid + dx * out, y + up, bz + pz * wid + dz * out], [bx - px * wid + dx * out, y + up, bz - pz * wid + dz * out], 0, 0.5);
    }
  }
  // buds once it flowers: a big top cola and side buds
  if (g > 0.55) {
    const k = Math.min(1, (g - 0.55) / 0.45), colaH = (0.25 + 0.35 * k) * Math.min(1.4, ht / 2), colaW = 0.07 + 0.09 * k;
    for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) { const dx = Math.cos(a) * colaW, dz = Math.sin(a) * colaW; quad([cx - dx, y0 + H - colaH * 0.75, cz - dz], [cx + dx, y0 + H - colaH * 0.75, cz + dz], [cx + dx, y0 + H + colaH * 0.25, cz + dz], [cx - dx, y0 + H + colaH * 0.25, cz - dz], 0.5, 0.75); }
    const side = Math.round(H * 3 * k);
    for (let i = 0; i < side; i++) { const t = 0.35 + 0.55 * (i / Math.max(1, side)), y = y0 + H * t, a = rot0 + i * 2.1, ox = cx + Math.sin(a) * 0.14, oz = cz + Math.cos(a) * 0.14, bh = 0.12 + 0.1 * k, bw = 0.05 + 0.04 * k;
      for (const b of [0, Math.PI / 2]) { const dx = Math.cos(a + b) * bw, dz = Math.sin(a + b) * bw; quad([ox - dx, y - bh * 0.4, oz - dz], [ox + dx, y - bh * 0.4, oz + dz], [ox + dx, y + bh * 0.6, oz + dz], [ox - dx, y + bh * 0.6, oz - dz], 0.5, 0.75); } }
  }
}
function cropStage(c) { return Math.min(3, Math.floor(Math.min(1, (state.gameTime - c.t) / CROPS[c.type].grow) * 3.999)); }
function cropHeight(c) {
  const cr = CROPS[c.type]; if (!cr.tall) return 1;
  if (c._st < 2) return 1;
  if (c._st === 2) return 1.5;
  if (c.tall == null) c.tall = c.fert && Math.random() < 0.25 ? 3 : 2;   // decided once, when it ripens
  return c.tall;
}
function buildCrops() {
  if (cropMesh) { scene.remove(cropMesh); cropMesh.geometry.dispose(); }
  if (weedMesh) { scene.remove(weedMesh); weedMesh.geometry.dispose(); }
  const p = [], u = [], n = [], ind = [], WA = { p: [], u: [], n: [], i: [] };
  const quad = (x, y0, z, tile, w, h) => {
    const a = 0.5 - w / 2, b = 0.5 + w / 2;
    for (const [ax, az, bx, bz] of [[a, a, b, b], [a, b, b, a]]) {
      const i = p.length / 3;
      p.push(x + ax, y0, z + az, x + bx, y0, z + bz, x + ax, y0 + h, z + az, x + bx, y0 + h, z + bz);
      u.push(...tileUV(tile, 0, 0), ...tileUV(tile, 1, 0), ...tileUV(tile, 0, 1), ...tileUV(tile, 1, 1));
      n.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      ind.push(i, i + 1, i + 2, i + 2, i + 1, i + 3);
    }
  };
  for (const k in state.crops) {
    const c = state.crops[k], [x, y, z] = k.split(',').map(Number), cr = CROPS[c.type];
    c._st = cropStage(c);
    const y0 = y - (get(x, y - 1, z) === FARM ? 0.06 : 0);
    if (cr.scale) { const s = [0.35, 0.55, 0.75, 1][c._st]; quad(x, y0, z, cr.tile, 0.7 * s, 0.7 * s); continue; }
    if (c.type === 'weed') { const g = Math.min(1, (state.gameTime - c.t) / cr.grow); if (c._st >= 3) cropHeight(c); c._g = Math.round(g * 40); addWeed(WA, x, y0, z, g, c.tall || 2, (x * 73856093) ^ (z * 19349663) ^ y); continue; }
    quad(x, y0, z, cr.tile + c._st, 0.7, 1);
  }
  if (WA.i.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(WA.p, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(WA.u, 2)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(WA.n, 3)); wg.setIndex(WA.i);
    weedMesh = new THREE.Mesh(wg, weedMat); scene.add(weedMesh);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setIndex(ind);
  cropMesh = new THREE.Mesh(g, matCrop); scene.add(cropMesh);
}
// is this spot dark enough for mushrooms? (night, or no open sky, and no torch close by)
function isDarkAt(x, y, z) {
  for (const k of torches) { const [tx, ty, tz] = k.split(',').map(Number); if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(tz - z) < 5) return false; }
  if (nightAmt > 0.55) return true;
  for (let yy = y + 1; yy < H; yy++) if (blocksSky(get(x, yy, z))) return true;
  return false;
}
// mushrooms only grow in the dark; wild cow poop that sits a while sprouts brown mushrooms
let poopT = 0;
function tickCropsAndPoop(dt) {
  for (const k in state.crops) { const c = state.crops[k]; if (!CROPS[c.type].dark || cropStage(c) >= 3) continue; const [x, y, z] = k.split(',').map(Number); if (!isDarkAt(x, y, z)) c.t += dt; }
  poopT += dt; if (poopT < 5) return; poopT = 0;
  for (const k in state.poops) {
    const [x, y, z] = k.split(',').map(Number);
    if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
    if (get(x, y, z) !== POOP) { delete state.poops[k]; continue; }
    if (state.gameTime - state.poops[k] > 120 && isDarkAt(x, y, z) && Math.random() < 0.015) { delete state.poops[k]; setBlock(x, y, z, BROWN_MUSH); }
  }
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

const ghostTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#cfd8ee'); g.addColorStop(1, '#5a6a8c'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${Math.random() < .5 ? '90,100,140' : '255,255,255'},${0.15 + Math.random() * 0.3})`; x.lineWidth = 1 + Math.random() * 3; x.beginPath(); const a = Math.random() * 128, b = Math.random() * 128; x.moveTo(a, b); x.bezierCurveTo(a + 20, b + 10, a - 15, b + 30, a + (Math.random() - .5) * 30, b + 45); x.stroke(); }
  for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(40,40,70,.25)'; x.fillRect(Math.random() * 128, 90 + Math.random() * 30, 2, 20 + Math.random() * 20); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const ghostMat = new THREE.MeshLambertMaterial({ color: 0xf4f0ff, map: ghostTex, emissive: 0x6a78b8, emissiveMap: ghostTex, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
const blackMat = new THREE.MeshBasicMaterial({ color: 0x050008, transparent: true, opacity: 0.9 });
const ghostEyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.9 });
const ghosts = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 4, 10), ghostMat); g.add(body);
  for (let t = 0; t < 4; t++) { const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), ghostMat); const a = t / 4 * Math.PI * 2; tail.position.set(Math.cos(a) * 0.24, -0.72, Math.sin(a) * 0.24); tail.rotation.x = Math.PI; g.add(tail); }
  for (const ex of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), blackMat); e.position.set(ex, 0.25, 0.34); e.scale.set(1.2, 1.6, 0.4); g.add(e); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), ghostEyeMat); pu.position.set(ex, 0.24, 0.37); g.add(pu); }
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
const settings = Object.assign({ hdTex: true, jumpscares: true, sound: true, peaceful: false, difficulty: null, sens: 1 }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })());
if (localStorage.getItem('dealercraft_mute') === '1' && settings._muteMigrated == null) { settings.sound = false; }
settings._muteMigrated = true;
VIEW = [2, 3, 4, 6, 8].includes(settings.view) ? settings.view : 4;
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }

// ================== PLAYER ==================
const player = { pos: new THREE.Vector3(...state.pos), vel: new THREE.Vector3(), yaw: state.yaw, pitch: state.pitch, onGround: false,
  alive: true, sprint: false, fallStart: null, air: 15, hurtT: 0, regenT: 0, starveT: 0, exhaust: 0, eatT: 0 };
const PW = 0.3, PH = 1.8, EYE = 1.62;
// boxes of a solid block in block-local units (doors: thin slab, stairs: two boxes, everything else: the full cube)
const FULLBOX = [[0, 0, 0, 1, 1, 1]];
function solidBoxes(id) { if (isDoor(id)) return [doorBox(id)]; if (isStair(id)) return stairBoxes(id); return FULLBOX; }
function eachHit(p, fn) {
  for (let x = Math.floor(p.x - PW); x <= Math.floor(p.x + PW); x++)
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + PH - 0.01); y++)
      for (let z = Math.floor(p.z - PW); z <= Math.floor(p.z + PW); z++) {
        const id = get(x, y, z); if (!solid(id)) continue;
        for (const b of solidBoxes(id)) {
          if (isDoor(id) ? (p.x + PW > x + b[0] && p.x - PW < x + b[3] && p.z + PW > z + b[2] && p.z - PW < z + b[5])
            : (p.x + PW > x + b[0] && p.x - PW < x + b[3] && p.z + PW > z + b[2] && p.z - PW < z + b[5] && p.y + PH > y + b[1] + 1e-4 && p.y < y + b[4] - 1e-4)) { if (fn(y + b[4])) return true; }
        }
      }
  return false;
}
function collides(p) { return eachHit(p, () => true); }
// where to stand after falling into something: the highest box top under where we came from
function landTop(p, oy) { let best = -1; eachHit(p, top => { if (top <= oy + 0.01 && top > best) best = top; return false; }); return best >= 0 ? best : Math.floor(oy + 0.001); }
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
const MOBHIT = new Set(['zombie', 'skeleton', 'explosion', 'wolf', 'bear', 'tiger', 'cheetah']);
// peaceful: nothing (monsters, cops, wild animals) may chase or hurt you
function canHurtPlayer() { return settings.difficulty !== 'peaceful'; }
const CREATURE_HIT = new Set(['zombie', 'skeleton', 'creeper', 'wolf', 'bear', 'tiger', 'cheetah', 'cop', 'ghost', 'car']);
function damage(n, cause, from) {
  if (from && typeof mobs !== 'undefined') { let bd = 3, bm = null; for (const m of mobs) { const d = m.g.position.distanceTo(from); if (d < bd && !m.tamed) { bd = d; bm = m; } } if (bm) player.lastAttacker = bm; }
  if (!canHurtPlayer() && CREATURE_HIT.has(cause)) return;
  if (MOBHIT.has(cause)) n = Math.round(n * diff().dmg);
  if (!player.alive || n <= 0) return;
  if (cause !== 'fall' && cause !== 'starve' && cause !== 'drown' && cause !== 'fire') n = Math.max(1, Math.round(n * (1 - armorPoints() * 0.04)));
  state.hp = Math.max(0, state.hp - n); player.hurtT = 0.5; exhaust(0.1);
  if (from) { const k = player.pos.clone().sub(from).setY(0); if (k.lengthSq() > 0) { k.normalize().multiplyScalar(7); player.vel.x += k.x; player.vel.z += k.z; player.kb = 0.25; player.vel.y = Math.max(player.vel.y, 5); } }
  hurtSnd(); const fl = document.getElementById('hurt'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
  renderVitals();
  if (state.hp <= 0) die(cause);
}
function die(cause) {
  player.alive = false; holdBreak = false;
  // like Minecraft you drop everything, but here it is kept safe in a gravestone where you fell
  const keep = s => s && s.id === 'map';   // maps never drop: they stay in your bag (your phone is always with you too)
  const items = [...state.slots.filter(s => !keep(s)), ...state.armor, keep(state.off) ? null : state.off].filter(Boolean);
  if (player.horse) dismountHorse();
  if (items.length) {
    let gx = Math.floor(player.pos.x), gy = Math.max(1, Math.floor(player.pos.y)), gz = Math.floor(player.pos.z);
    while (gy < H - 1 && get(gx, gy, gz) !== AIR && !isWater(get(gx, gy, gz))) gy++;
    setBlock(gx, gy, gz, GRAVE); state.graves[gx + ',' + gy + ',' + gz] = items;
    state.slots = state.slots.map(s => keep(s) ? s : null); state.armor = emptySlots(4); state.off = keep(state.off) ? state.off : null; renderHotbar();
  }
  const msg = { crackhead: 'got jumped by a crackhead looking for drugs', cop: 'was arrested the hard way by a cop', wolf: 'was mauled by a wolf pack', bear: 'was mauled by a bear', tiger: 'was hunted by a tiger', cheetah: 'was caught by a cheetah', car: 'got hit by a car', zombie: 'was eaten by a zombie', skeleton: 'was shot by a skeleton', explosion: 'was blown up', gang: 'got caught in a gang shootout', soldier: 'was shot by Area 51 soldiers', alien: 'was zapped by an alien', radiation: 'died of radiation poisoning', taser: 'was tased', fall: 'hit the ground too hard', fire: 'burned to death', lightning: 'was struck by lightning', drown: 'drowned', starve: 'starved to death' }[cause] || 'died';
  const show = () => { document.getElementById('deathMsg').textContent = 'Buggy ' + msg; document.getElementById('death').classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); };
  if (settings.jumpscares && (cause === 'zombie' || cause === 'skeleton' || cause === 'explosion' || nightAmt > 0.5)) jumpscare(show, cause); else show();
}
function respawn() {
  document.getElementById('death').classList.remove('show');
  state.hp = 20; state.food = 20; state.sat = 5; player.air = 15; player.alive = true; player.vel.set(0, 0, 0); player.fallStart = null;
  if (state.spawn && isFurn(get(...state.spawn))) player.pos.set(state.spawn[0] + 0.5, state.spawn[1] + 0.6, state.spawn[2] + 0.5); else player.pos.set(VX + 0.5, G + 1, VZ - 4.5);
  if (collides(player.pos)) player.pos.y = groundAt(player.pos.x, player.pos.z); renderVitals(); save();
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
  else if (ITEMS[id].block != null && !ITEMS[id].door && !ITEMS[id].px) {
    const T = BT[ITEMS[id].block], mk = t => noDepth(new THREE.MeshLambertMaterial({ map: tileTex(t), transparent: true, alphaTest: 0.5 }));
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), [mk(T[2]), mk(T[2]), mk(T[0]), mk(T[1]), mk(T[2]), mk(T[2])]); mesh.rotation.set(0.2, 0.7, 0);
  } else {
    if (ITEMS[id].px || ITEMS[id].sprite) {   // tools, weapons and other pixel items: a 3D extruded model like Minecraft, every one the same size
      mesh = new THREE.Mesh(extrudeIcon(id), noDepth(new THREE.MeshLambertMaterial({ vertexColors: true })));
      mesh.rotation.set(0.05, -0.62, 0.42); mesh.position.set(0.1, 0.22, 0.02);
      mesh.renderOrder = 10; hand.add(mesh); return;
    }
    if (!handMats[id]) { const t = new THREE.CanvasTexture(itemCanvas(id)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; handMats[id] = noDepth(new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })); }
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), handMats[id]);
    const tool = ITEMS[id].tool; mesh.rotation.set(0, -1.2, tool ? 0.15 : 0); mesh.position.set(0, 0.08, 0);
  }
  mesh.renderOrder = 10; hand.add(mesh);
}
const extCache = {};
function extrudeIcon(id) {
  if (extCache[id]) return extCache[id];
  const it = ITEMS[id], c = it.px ? itemCanvas(id) : (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 16; cv.getContext('2d').drawImage(atlas, ((it.tile ?? BT[it.block][2]) % AT) * TS, Math.floor((it.tile ?? BT[it.block][2]) / AT) * TS, TS, TS, 0, 0, 16, 16); return cv; })(), N = 16, d = c.getContext('2d').getImageData(0, 0, N, N).data, SIZE = 0.72, s = SIZE / N, th = s * 1.1;
  const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && d[(y * N + x) * 4 + 3] > 100;
  const pos = [], col = [], nor = [], C = new THREE.Color();
  const quad = (a, b, cc, dd, n, k) => { for (const p of [a, b, cc, a, cc, dd]) { pos.push(...p); nor.push(...n); col.push(C.r * k, C.g * k, C.b * k); } };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (!on(x, y)) continue; const i = (y * N + x) * 4; C.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace);
    const x0 = (x - N / 2) * s, x1 = x0 + s, y1 = (N / 2 - y) * s, y0 = y1 - s, z0 = -th / 2, z1 = th / 2;
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], 1);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], 0.8);
    if (!on(x - 1, y)) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], 0.7);
    if (!on(x + 1, y)) quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], 0.7);
    if (!on(x, y - 1)) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 0.9);
    if (!on(x, y + 1)) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], 0.6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return (extCache[id] = g);
}
function applyTexturePack() {
  HD_ON = settings.hdTex !== false; tex.dispose(); tex.image = HD_ON ? hdAtlas : atlas; tex.needsUpdate = true;
  for (const id in iconCache) if (ITEMS[id] && (ITEMS[id].block != null || ITEMS[id].tile != null)) { delete iconCache[id]; delete iconCanvas[id]; }
  handItem = '__refresh'; if (typeof renderHotbar === 'function') renderHotbar();
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
function ghostFace() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 600; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 600, 600);
  const halo = x.createRadialGradient(300, 300, 60, 300, 300, 320); halo.addColorStop(0, 'rgba(160,200,255,.55)'); halo.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = halo; x.fillRect(0, 0, 600, 600);
  // pale stretched head that melts into wisps
  const sk = x.createRadialGradient(290, 230, 30, 300, 290, 290); sk.addColorStop(0, '#ffffff'); sk.addColorStop(0.55, '#d9e2f2'); sk.addColorStop(1, '#6f7f9a');
  x.fillStyle = sk; x.beginPath(); x.moveTo(90, 300); x.bezierCurveTo(80, 40, 520, 40, 510, 300);
  for (let i = 0; i <= 8; i++) { const px = 510 - i * 52.5; x.lineTo(px, 560 + (i % 2 ? -70 : 40) + Math.random() * 30); } x.closePath(); x.fill();
  x.strokeStyle = 'rgba(80,90,120,.35)'; x.lineWidth = 2; for (let i = 0; i < 30; i++) { x.beginPath(); const a = 110 + Math.random() * 380, b = 120 + Math.random() * 350; x.moveTo(a, b); x.quadraticCurveTo(a + (Math.random() - .5) * 60, b + 40, a + (Math.random() - .5) * 40, b + 90); x.stroke(); }
  // huge hollow eyes with red glowing pupils, dripping
  for (const [ex, ey, r] of [[200, 220, 1], [400, 228, 1.08]]) { x.fillStyle = '#05000a'; x.beginPath(); x.ellipse(ex, ey, 70 * r, 95 * r, ex < 300 ? -0.25 : 0.25, 0, 7); x.fill();
    x.fillRect(ex - 12, ey + 60, 10, 90 + Math.random() * 60); x.fillRect(ex + 14, ey + 70, 6, 50 + Math.random() * 50);
    const g = x.createRadialGradient(ex, ey + 8, 1, ex, ey + 8, 30); g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#ff2020'); g.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(ex, ey + 8, 30, 0, 7); x.fill(); }
  // long screaming mouth
  x.fillStyle = '#05000a'; x.beginPath(); x.ellipse(300, 430, 70, 135, 0, 0, 7); x.fill();
  const mg = x.createRadialGradient(300, 450, 5, 300, 450, 90); mg.addColorStop(0, 'rgba(120,0,30,.6)'); mg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = mg; x.beginPath(); x.ellipse(300, 440, 60, 120, 0, 0, 7); x.fill();
  return c.toDataURL();
}
function scareFace(kind) {
  if (kind === 'ghost') return ghostFace();
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
  if (kind === 'ghost') ghostShriek(); else screamSnd();
  if (navigator.vibrate) try { navigator.vibrate([300, 60, 400]); } catch (e) {}
  setTimeout(() => { el.classList.remove('show'); scaring = false; if (after) after(); }, 1300);
}

// ================== MOBS (cows, zombies, skeletons, creepers) ==================
const MOBDEF = {
  cow:      { hp: 10, w: 0.45, h: 1.3, speed: 1.0, hostile: false, drops: () => [['raw_beef', rint(1, 3)], ['leather', rint(0, 2)]] },
  chicken:  { hp: 4, w: 0.25, h: 0.8, speed: 1.1, hostile: false, drops: () => [['raw_chicken', 1], ['feather', rint(0, 2)]] },
  pig:      { hp: 10, w: 0.45, h: 1.0, speed: 1.0, hostile: false, drops: () => [['raw_pork', rint(1, 3)]] },
  sheep:    { hp: 8, w: 0.45, h: 1.3, speed: 0.9, hostile: false, drops: () => [['raw_mutton', rint(1, 2)], ['wool', rint(1, 2)]] },
  ped:      { hp: 12, w: 0.3, h: 1.9, speed: 1.25, hostile: false, human: true, drops: () => [] },
  cop:      { hp: 24, w: 0.3, h: 1.9, speed: 1.2, hostile: false, human: true, dmg: 3, drops: () => [] },
  zombie:   { hp: 20, w: 0.3, h: 1.9, speed: 2.3, hostile: true, dmg: 3, burns: true, drops: () => [['rotten_flesh', rint(0, 2)]] },
  skeleton: { hp: 20, w: 0.3, h: 1.9, speed: 2.4, hostile: true, burns: true, drops: () => [['bone', rint(0, 2)], ['arrow', rint(0, 2)]] },
  creeper:  { hp: 20, w: 0.3, h: 1.7, speed: 2.2, hostile: true, drops: () => [['gunpowder', rint(0, 2)]] },
};
const mobs = [], arrows = [];
const box = (w, h, d, col, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); parent.add(m); return m; };
function pivotLimb(parent, w, h, d, col, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); const m = box(w, h, d, col, 0, -h / 2, 0, p); return p; }
function buildMob(type, v = 0) {
  const wb = buildWild(type, v); if (wb) return wb;
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
  if (type === 'pig') {
    box(0.8, 0.55, 1.1, 0xf0a0a8, 0, 0.62, 0, g);
    const head = new THREE.Group(); head.position.set(0, 0.75, 0.6); g.add(head);
    box(0.5, 0.48, 0.45, 0xf2a8b0, 0, 0, 0.1, head); box(0.26, 0.18, 0.1, 0xe0808c, 0, -0.06, 0.36, head);
    for (const nx of [-0.06, 0.06]) box(0.04, 0.05, 0.02, 0x7a3a42, nx, -0.06, 0.42, head);
    for (const ex of [-0.14, 0.14]) box(0.07, 0.07, 0.02, 0x111111, ex, 0.1, 0.33, head);
    for (const [lx, lz] of [[-0.25, 0.35], [0.25, 0.35], [-0.25, -0.35], [0.25, -0.35]]) legs.push(pivotLimb(g, 0.2, 0.36, 0.2, 0xe08f98, lx, 0.36, lz));
    return { g, legs, arms, head };
  }
  if (type === 'sheep') {
    box(0.95, 0.75, 1.25, 0xf4f4f0, 0, 0.92, 0, g);
    const head = new THREE.Group(); head.position.set(0, 1.12, 0.7); g.add(head);
    box(0.52, 0.52, 0.42, 0xf4f4f0, 0, 0.04, 0, head); box(0.36, 0.36, 0.2, 0xb89c88, 0, -0.04, 0.2, head);
    for (const ex of [-0.11, 0.11]) box(0.07, 0.07, 0.02, 0x111111, ex, 0.02, 0.31, head);
    for (const [lx, lz] of [[-0.28, 0.42], [0.28, 0.42], [-0.28, -0.42], [0.28, -0.42]]) legs.push(pivotLimb(g, 0.2, 0.55, 0.2, 0xb89c88, lx, 0.55, lz));
    return { g, legs, arms, head };
  }
  if (type === 'chicken') {
    box(0.4, 0.38, 0.5, 0xffffff, 0, 0.48, 0, g);
    for (const wx of [-0.22, 0.22]) box(0.06, 0.26, 0.36, 0xeeeeee, wx, 0.5, 0, g);
    const head = new THREE.Group(); head.position.set(0, 0.78, 0.22); g.add(head);
    box(0.24, 0.3, 0.2, 0xffffff, 0, 0, 0, head); box(0.16, 0.08, 0.1, 0xf0b020, 0, 0, 0.14, head); box(0.08, 0.1, 0.06, 0xd82020, 0, -0.08, 0.12, head);
    for (const ex of [-0.08, 0.08]) box(0.05, 0.05, 0.02, 0x111111, ex, 0.06, 0.1, head);
    for (const lx of [-0.09, 0.09]) legs.push(pivotLimb(g, 0.05, 0.3, 0.05, 0xf0b020, lx, 0.3, 0));
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
  if (type === 'ped' || type === 'cop') {   // townsfolk: random outfits; cops in blue with a cap; some smoke a joint
    const cop = type === 'cop', skin = [0xf1c27d, 0xc58c63, 0x8d5524, 0xe0ac69, 0x5c3a21][Math.floor(Math.random() * 5)];
    const shirt = cop ? 0x1f3a8a : [0xd23a2a, 0x2a8ad2, 0x3fa34d, 0xf2c21a, 0x8a3fd2, 0xeeeeee, 0x222222, 0xff7a1a][Math.floor(Math.random() * 8)];
    const pants = cop ? 0x14234f : [0x2a3a6a, 0x222222, 0x6b5a3a, 0x555555][Math.floor(Math.random() * 4)];
    box(0.5, 0.75, 0.28, shirt, 0, 1.1, 0, g);
    const head = new THREE.Group(); head.position.set(0, 1.72, 0); g.add(head);
    box(0.46, 0.5, 0.46, skin, 0, 0, 0, head);
    box(0.48, 0.14, 0.48, cop ? 0x14234f : [0x2a1a0a, 0x111111, 0xd9b35b, 0x8a4a1a][Math.floor(Math.random() * 4)], 0, 0.22, 0, head);
    if (cop) { box(0.5, 0.06, 0.6, 0x111111, 0, 0.28, 0.06, head); box(0.12, 0.12, 0.02, 0xf2c21a, -0.12, 1.25, 0.15, g); }
    for (const ex of [-0.1, 0.1]) box(0.08, 0.07, 0.02, 0x111111, ex, 0.03, 0.24, head);
    for (const lx of [-0.12, 0.12]) legs.push(pivotLimb(g, 0.22, 0.72, 0.22, pants, lx, 0.72, 0));
    for (const ax of [-0.34, 0.34]) arms.push(pivotLimb(g, 0.18, 0.7, 0.18, shirt, ax, 1.45, 0));
    let joint = null;
    if (!cop && Math.random() < 0.35) { joint = new THREE.Group(); joint.position.set(0.06, -0.12, 0.25); joint.rotation.y = 0.3; head.add(joint); box(0.03, 0.03, 0.16, 0xf4f0e6, 0, 0, 0.08, joint); const tip = box(0.035, 0.035, 0.03, 0xff5a10, 0, 0, 0.17, joint); tip.material.emissive.setHex(0xff3300); }
    return { g, legs, arms, head, joint };
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
function spawnMob(type, x, y, z, v = rint(0, 99)) {
  if (mobs.length >= 64) return null;
  const parts = buildMob(type, v), d = MOBDEF[type];
  parts.g.position.set(x, y, z); for (let i = 0; i < 6 && mobCollides(parts.g.position, d.w, d.h); i++) parts.g.position.y = Math.floor(parts.g.position.y) + 1; scene.add(parts.g);
  const m = { type, v, ...parts, home: null, hp: d.hostile ? Math.round(d.hp * diff().hp) : d.hp, vel: new THREE.Vector3(), onGround: false, target: null, wait: Math.random() * 3, walk: 0, hurt: 0, atk: 0, fuse: 0, burn: 0 };
  mobs.push(m); return m;
}
function removeMob(m, poof) { if (m.petId) syncPet(m); if (m.leash) { scene.remove(m.leash); m.leash = null; } if (m === player.horse) dismountHorse(); scene.remove(m.g); mobs.splice(mobs.indexOf(m), 1); if (poof) particles(m.g.position.x, m.g.position.y + 0.8, m.g.position.z, new THREE.Color(0.9, 0.9, 0.9), 10); }
const ANIMALS = ['cow', 'pig', 'sheep', 'chicken'];
const isAnimal = t => ANIMALS.includes(t) || !!(MOBDEF[t] && MOBDEF[t].animal);
function spawnCowsIn(x0, z0, hm, rnd) {   // a small herd of one kind of farm animal
  if (mobs.filter(m => ANIMALS.includes(m.type)).length >= 20) return;
  const kind = ANIMALS[Math.floor(hash2(x0, z0, state.seed + 5) * 4)];
  for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) {
    const lx = 2 + Math.floor(rnd() * 12), lz = 2 + Math.floor(rnd() * 12), h = hm[lx + lz * CH];
    if (h <= SEA + 1 || h >= 26 || deadAt(x0 + lx, z0 + lz)) continue;
    if (Math.hypot(x0 + lx - VX, z0 + lz - VZ) < 14) continue;
    spawnMob(kind, x0 + lx + 0.5, h + 1, z0 + lz + 0.5);
  }
}
function mobCollides(p, w, h) {
  for (let x = Math.floor(p.x - w); x <= Math.floor(p.x + w); x++) for (let y = Math.floor(p.y); y <= Math.floor(p.y + h - 0.01); y++) for (let z = Math.floor(p.z - w); z <= Math.floor(p.z + w); z++) if (solid(get(x, y, z))) return true;
  return false;
}
// pop a mob out of solid blocks: straight up first, then the nearest open spot with ground under it
function unstickMob(m, d) {
  const p = m.g.position, fx = p.x, fy = p.y, fz = p.z;
  p.y = Math.floor(fy + 0.5); if (!mobCollides(p, d.w, d.h)) { m.vel.y = 0; return true; }   // only sunk into the floor a bit
  for (let r = 1; r <= 4; r++) for (let i = 0; i < 8 * r; i++) {   // nearest open spot beside the wall, on the ground
    const a = i / (8 * r) * Math.PI * 2, x = Math.floor(fx + Math.cos(a) * r) + 0.5, z = Math.floor(fz + Math.sin(a) * r) + 0.5;
    for (const dy of [0, 1, -1]) { p.set(x, Math.floor(fy) + dy, z); if (!mobCollides(p, d.w, d.h) && solid(get(Math.floor(x), Math.floor(p.y) - 1, Math.floor(z)))) { m.vel.set(0, 0, 0); m.target = null; return true; } }
  }
  for (let dy = 1; dy <= 3; dy++) { p.set(fx, Math.floor(fy) + dy, fz); if (!mobCollides(p, d.w, d.h)) { m.vel.y = 0; return true; } }
  p.set(fx, groundAt(fx, fz), fz); m.vel.set(0, 0, 0); return false;
}
function lineOfSight(a, b) {
  const d = b.clone().sub(a), n = Math.ceil(d.length() * 3); d.divideScalar(n);
  const p = a.clone(); for (let i = 0; i < n; i++) { p.add(d); if (solid(get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) return false; }
  return true;
}
function skyAbove(x, y, z) { for (let yy = Math.floor(y) + 2; yy < H; yy++) if (get(Math.floor(x), yy, Math.floor(z)) !== AIR) return false; return true; }
function hurtMob(m, dmg, from, noDrop) {
  if (!mobs.includes(m)) return;
  m.hp -= dmg; m.hurt = 0.35;
  const byPlayer = from === player.pos, def = MOBDEF[m.type];
  const k = m.g.position.clone().sub(from).setY(0).normalize().multiplyScalar(6); m.vel.x = k.x; m.vel.z = k.z; m.vel.y = 5;
  if (isAnimal(m.type)) { noiseBurst(0.06, 0.08, 1500); animalSnd(m.type, 0.12, true); m.target = null; m.panic = m.tamed || m === player.horse ? 0 : 4; } else hitSnd();
  if (def.predator && !m.tamed && byPlayer && canHurtPlayer()) { m.panic = 0; m.angry = 25; m.prey = null; if (def.pack) for (const o of mobs) if (o.type === m.type && !o.tamed && o.g.position.distanceTo(m.g.position) < 16) { o.angry = 25; o.panic = 0; } }
  if (byPlayer && !m.tamed) for (const o of mobs) if (o.tamed && !o.sit && o.type !== 'horse' && o.type !== 'cat') o.foe = m;
  if (MOBDEF[m.type].human && from === player.pos) { if (m.type === 'ped') { m.panic = 6; m.target = null; } setWanted(); }
  if (m.type === 'ped' && m.townId) { if (m.hp <= 0) pedDown(m, true); else if (m.hp < MOBDEF.ped.hp * 0.4) pedDown(m, false); }
  if (m.hp <= 0) {
    if (m.petId) { state.pets = (state.pets || []).filter(r => r.id !== m.petId); m.petId = null; toast(`💔 Your ${m.type} died`); removeMob(m, true); return; }
    if (noDrop) { removeMob(m, true); return; }
    for (const [id, n] of MOBDEF[m.type].drops()) if (n > 0) give(id, n);
    const got = MOBDEF[m.type].drops; if (MOBDEF[m.type].human) { const c = rint(1, 6); state.coins += c; toast(m.type === 'cop' ? `🚔 You knocked out a cop! +${c} coins` : `😵 Knocked out. They dropped ${c} coins`); removeMob(m, true); return; }
    toast({ cow: '🐄 Got beef and leather', pig: '🐖 Got porkchops', sheep: '🐑 Got mutton and wool', chicken: '🐔 Got chicken and feathers', bear: '🐻 Got bear meat', goat: '🐐 Got goat meat' }[m.type] || (def.animal ? `${MOB_NAMES[m.type] || m.type} defeated` : `💀 Defeated a ${m.type}!`));
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
    const hostile = mobs.filter(m => MOBDEF[m.type].hostile && m.type !== 'crackhead').length;
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
    if (isAnimal(m.type)) { m.moo = (m.moo ?? 3 + Math.random() * 15) - dt; if (m.moo <= 0) { m.moo = (m.type === 'chicken' ? 6 : 12) + Math.random() * 20; if (dist < 22 && !uiOpen) animalSnd(m.type, 0.09 * (1 - dist / 22)); } }
    if (m.type === 'cow') {   // cows poop now and then; left alone in the dark it can sprout mushrooms
      m.poop = (m.poop ?? 40 + Math.random() * 80) - dt;
      if (m.poop <= 0 && m.onGround) {
        m.poop = 70 + Math.random() * 110;
        const bx = Math.floor(p.x), by = Math.floor(p.y + 0.01), bz = Math.floor(p.z), k = bx + ',' + by + ',' + bz;
        if (Object.keys(state.poops).length < 40 && get(bx, by, bz) === AIR && solid(get(bx, by - 1, bz)) && !state.crops[k] && Math.hypot(bx - VX, bz - VZ) > 12) {
          setBlock(bx, by, bz, POOP); state.poops[k] = state.gameTime; if (dist < 12) { noiseBurst(0.12, 0.05 * (1 - dist / 12), 260); }
        }
      }
    }
    if (m.type === 'chicken') { m.egg = (m.egg ?? 60 + Math.random() * 120) - dt; if (m.egg <= 0) { m.egg = 90 + Math.random() * 150; if (dist < 3 && player.alive) { give('egg', 1); toast('🥚 A chicken laid an egg for you'); } } }
    if (d.fly) { updateBird(m, dt, t); continue; }
    let mx = 0, mz = 0, speed = d.hostile ? d.speed * diff().spd : d.speed;
    const chase = (d.hostile || (m.type === 'cop' && wanted > 0)) && !(m.calm > 0) && dist < (m.type === 'cop' ? 30 : 18) && player.alive && canHurtPlayer() && !(m.type === 'cop' && player.car);
    if (m.type === 'cop') speed = wanted > 0 ? 3.4 : 1.2;
    if (m.joint) { m.puff = (m.puff ?? Math.random() * 3) - dt; if (m.puff <= 0) { m.puff = 2.5 + Math.random() * 3; const w = new THREE.Vector3(); m.joint.getWorldPosition(w); smokePuff(w.x, w.y, w.z, 4); } }
    const wild = (d.ai || m.tamed) ? wildAI(m, d, dt, dist, t) : null;
    if (wild) { mx = wild[0]; mz = wild[1]; speed = wild[2]; }
    else if (chase) {
      const dx = pp.x - p.x, dz = pp.z - p.z, dd = Math.hypot(dx, dz) || 1;
      if (m.type === 'skeleton') {
        const want = dist < 7 ? -1 : dist > 12 ? 1 : 0; mx = dx / dd * want; mz = dz / dd * want;
        if (m.atk <= 0 && dist < 16 && lineOfSight(p.clone().setY(p.y + 1.6), pp.clone().setY(pp.y + 1.5))) { shootArrow(m); m.atk = 2.2; }
      } else { mx = dx / dd; mz = dz / dd; }
      g.rotation.y = Math.atan2(dx, dz);
      if ((m.type === 'zombie' || m.type === 'cop' || m.type === 'crackhead') && dist < 1.5 && m.atk <= 0) { damage(d.dmg, m.type, p); m.atk = 1; if (m.type === 'cop') m.arms[1].rotation.x = -1.4; }
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
        if (!m.target) { m.target = new THREE.Vector2(p.x + (Math.random() - .5) * 10, p.z + (Math.random() - .5) * 10); if (m.home && Math.hypot(m.target.x - m.home.x, m.target.y - m.home.y) > 22) m.target.set(m.home.x + (Math.random() - .5) * 16, m.home.y + (Math.random() - .5) * 16); }
        const dx = m.target.x - p.x, dz = m.target.y - p.z, dd = Math.hypot(dx, dz);
        if (dd < 0.3) { m.target = null; m.wait = 2 + Math.random() * 5; }
        else { mx = dx / dd; mz = dz / dd; g.rotation.y = Math.atan2(dx, dz); }
      }
    }
    // undead burn in daylight
    if (d.burns && nightAmt < 0.35 && skyAbove(p.x, p.y, p.z)) { m.burn += dt; if (m.burn > 1) { m.burn = 0; particles(p.x, p.y + 1.5, p.z, new THREE.Color(1, 0.5, 0.1), 5); m.hp -= 2; m.hurt = 0.2; if (m.hp <= 0) { removeMob(m, true); continue; } } }
    if (m.detour) { m.detour.t -= dt; if (m.detour.t <= 0 || !(mx || mz)) m.detour = null; else { mx = m.detour.x; mz = m.detour.z; } }
    // physics (knockback decays into walking)
    const k = Math.min(1, dt * 6);
    m.vel.x += (mx * speed - m.vel.x) * k; m.vel.z += (mz * speed - m.vel.z) * k;
    const inW = isWater(get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)));
    m.vel.y -= (inW ? 8 : 24) * dt; if (inW) m.vel.y = Math.max(m.vel.y, 1.5 * (Math.random() < 0.5 ? 1 : 0.2));
    if (mobCollides(p, d.w, d.h)) unstickMob(m, d);   // spawned or pushed inside a block: pop out
    let blocked = false, canStep = false;
    for (const ax of ['x', 'z']) {
      const o = p[ax]; p[ax] += m.vel[ax] * dt;
      if (mobCollides(p, d.w, d.h)) {
        // only hop when the obstacle is exactly 1 block high with room to stand on top
        if (m.onGround && !canStep) { const oy = p.y; p.y = Math.floor(oy + 0.001) + 1; if (!mobCollides(p, d.w, d.h)) canStep = true; p.y = oy; }
        p[ax] = o; blocked = true;
      }
    }
    m.jumpCd = Math.max(0, (m.jumpCd || 0) - dt);
    if (blocked && m.onGround && (mx || mz)) {
      if (canStep && m.jumpCd <= 0) { m.vel.y = 7.5; m.jumpCd = 0.45; m.stuckT = 0; }
      else if (!canStep) {   // a wall: turn and pick a new way instead of jumping into it
        m.stuckT = (m.stuckT || 0) + dt; m.vel.x *= 0.3; m.vel.z *= 0.3;
        if (!chase && !wild) { const a = Math.atan2(mz, mx) + Math.PI * (0.5 + Math.random()); m.target = new THREE.Vector2(p.x + Math.cos(a) * (3 + Math.random() * 5), p.z + Math.sin(a) * (3 + Math.random() * 5)); m.wait = 0; m.stuckT = 0; }
        else if (m.stuckT > 0.35) { const s = Math.random() < 0.5 ? 1 : -1; m.detour = { x: -mz * s, z: mx * s, t: 0.9 }; m.stuckT = 0; }
      }
    } else if (!blocked) m.stuckT = 0;
    const oy = p.y; p.y += m.vel.y * dt; m.onGround = false;
    if (mobCollides(p, d.w, d.h)) { if (m.vel.y < 0) { p.y = Math.floor(oy + 0.001); if (mobCollides(p, d.w, d.h)) p.y = oy; m.onGround = true; } else p.y = oy; m.vel.y = 0; }
    if (p.y < -5) { removeMob(m, false); continue; }
    // animation
    const moving = Math.hypot(m.vel.x, m.vel.z); m.walk += dt * moving * 3.2;
    const sw = Math.sin(m.walk) * Math.min(0.8, moving * 0.4);
    const quad = m.type === 'cow' || m.type === 'creeper' || m.type === 'pig' || m.type === 'sheep' || d.quad;
    m.legs.forEach((l, i) => l.rotation.x = (i % 2 ? sw : -sw) * (quad ? (i < 2 ? 1 : -1) : 1));
    if (d.human) { m.arms.forEach((a, i) => { if (!(m.type === 'cop' && chase && i === 1)) a.rotation.x = (i % 2 ? -sw : sw) * 0.8; }); }
    if (isAnimal(m.type) && m.head && !m.tamed && !m.ridden) m.head.rotation.x = m.wait > 0 && !m.panic && !m.angry ? 0.5 + Math.sin(t * 2) * 0.1 : 0;
    const red = m.hurt > 0;
    if (m.wasRed !== red) { m.wasRed = red; g.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setRGB(red ? 0.6 : 0, 0, 0); }); }
  }
  // arrows
  for (const a of [...arrows]) {
    a.vel.y -= 14 * dt; a.m.position.addScaledVector(a.vel, dt); a.life -= dt;
    a.m.lookAt(a.m.position.clone().add(a.vel));
    const ap = a.m.position;
    if (player.alive && canHurtPlayer() && ap.distanceTo(pp.clone().setY(pp.y + 0.9)) < 0.8) { damage(rint(2, 4), 'skeleton', ap.clone().sub(a.vel)); scene.remove(a.m); arrows.splice(arrows.indexOf(a), 1); continue; }
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

// ================== TOWN LIFE: wanted level, smoke, cars, police, townsfolk, map, off-hand ==================
let wanted = 0;
function setWanted() { if (!canHurtPlayer()) { wanted = 0; return; } if (wanted <= 0) { toast('🚨 The cops are after you!'); sirenT = 0; } wanted = 45; }

// ---- smoke clouds (joints, exhaust)
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(235,235,230,.9)'); g.addColorStop(0.5, 'rgba(210,210,205,.45)'); g.addColorStop(1, 'rgba(200,200,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const smokes = [];
function smokePuff(x, y, z, n = 3, tint = 0xdedcd6) {
  for (let i = 0; i < n && smokes.length < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: tint, transparent: true, depthWrite: false, opacity: 0.6 }));
    s.position.set(x + (Math.random() - .5) * 0.1, y, z + (Math.random() - .5) * 0.1); s.scale.setScalar(0.25); scene.add(s);
    smokes.push({ s, v: new THREE.Vector3((Math.random() - .5) * 0.3, 0.45 + Math.random() * 0.3, (Math.random() - .5) * 0.3), life: 2.6 + Math.random(), max: 3.4, d: i * 0.15 });
  }
}
function updateSmoke(dt) {
  for (const p of [...smokes]) {
    if (p.d > 0) { p.d -= dt; continue; }
    p.life -= dt; p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(0.985);
    const k = 1 - p.life / p.max; p.s.scale.setScalar(0.25 + k * 1.6); p.s.material.opacity = Math.max(0, 0.55 * (1 - k));
    if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); smokes.splice(smokes.indexOf(p), 1); }
  }
}

// ---- cars: 2 seats (driver + passenger); AI cars follow the lanes, police chase you when you're wanted
const cars = [];
const CAR_COLS = [0xd2302a, 0x2a6ad2, 0xf2f2f2, 0x222428, 0x3fa34d, 0xf2c21a, 0x8a8e94, 0x7a2ad2, 0xff7a1a];
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.35, depthWrite: false });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x151515 }), rimMat = new THREE.MeshLambertMaterial({ color: 0xbababa });
function personMesh() {
  const g = new THREE.Group(), skin = [0xf1c27d, 0xc58c63, 0x8d5524, 0xe0ac69][Math.floor(Math.random() * 4)];
  box(0.42, 0.5, 0.26, CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)], 0, 0, 0, g); box(0.36, 0.38, 0.36, skin, 0, 0.45, 0, g); box(0.38, 0.1, 0.38, 0x2a1a0a, 0, 0.66, 0, g);
  return g;
}
function buildCar(kind, nPeople) {
  const g = new THREE.Group(), police = kind === 'police', col = police ? 0xf4f4f4 : CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)];
  box(1.7, 0.5, 3.6, col, 0, 0.55, 0, g);
  if (police) { box(1.72, 0.22, 2.2, 0x111111, 0, 0.45, 0, g); }
  box(1.72, 0.12, 3.62, 0x333333, 0, 0.3, 0, g);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.9), glassMat); cabin.position.set(0, 1.1, -0.15); g.add(cabin);
  box(1.52, 0.08, 1.92, col, 0, 1.43, -0.15, g);
  for (const px of [-0.74, 0.74]) for (const pz of [-1.08, 0.78]) box(0.06, 0.6, 0.08, col, px, 1.1, pz, g);
  for (const [wx, wz] of [[-0.82, 1.15], [0.82, 1.15], [-0.82, -1.15], [0.82, -1.15]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12), tyreMat); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.34, wz); g.add(w);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.27, 8), rimMat); r.rotation.z = Math.PI / 2; r.position.copy(w.position); g.add(r);
  }
  for (const hx of [-0.55, 0.55]) { const h = box(0.36, 0.16, 0.04, 0xfff2b0, hx, 0.62, 1.81, g); h.material.emissive.setHex(0xffe080); const t = box(0.32, 0.14, 0.04, 0xd01010, hx, 0.62, -1.81, g); t.material.emissive.setHex(0x600000); }
  const lights = [];
  if (police) { lights.push(box(0.5, 0.14, 0.26, 0xff2020, -0.3, 1.54, -0.15, g), box(0.5, 0.14, 0.26, 0x2040ff, 0.3, 1.54, -0.15, g)); }
  const seats = [null, null];   // [driver (left), passenger (right)]
  for (let i = 0; i < nPeople; i++) { const p = police ? copSeatMesh() : personMesh(); p.position.set(i === 0 ? 0.38 : -0.38, 0.95, -0.15); g.add(p); seats[i] = p; }
  return { g, lights, seats };
}
function copSeatMesh() { const g = new THREE.Group(); box(0.42, 0.5, 0.26, 0x1f3a8a, 0, 0, 0, g); box(0.36, 0.38, 0.36, 0xc58c63, 0, 0.45, 0, g); box(0.4, 0.1, 0.44, 0x14234f, 0, 0.67, 0.04, g); return g; }
const laneCoord = (t, dir, strip) => (dir % 2 === 1 ? t.x0 : t.z0) + strip * 16 + (dir === 1 || dir === 2 ? 1 : 3);   // right-hand traffic
const DIRV = [[1, 0], [0, 1], [-1, 0], [0, -1]], dirHead = d => Math.atan2(DIRV[d][0], DIRV[d][1]);
function spawnCar(t, opts) {
  const kind = opts.kind || 'car', parts = buildCar(kind, opts.people ?? 0);
  const c = { ...parts, kind, t, dir: opts.dir ?? 1, strip: opts.strip ?? 0, ai: !!opts.ai, speed: 0, head: opts.head ?? dirHead(opts.dir ?? 1), spot: opts.spot || null, x: opts.x, z: opts.z, y: t.base + 1, honk: 0, vy: 0 };
  c.g.position.set(c.x, c.y, c.z); c.g.rotation.y = c.head; scene.add(c.g); cars.push(c); if (data.has(ckey(fdiv(Math.floor(c.x), CH), fdiv(Math.floor(c.z), CH)))) snapCarGround(c); return c;
}
// settle a car onto the ground: highest block top under its centre / wheels, at or below where it is now
function snapCarGround(c) {
  const fx = Math.sin(c.head), fz = Math.cos(c.head), pts = [[0, 0], [1.2, 0.6], [1.2, -0.6], [-1.2, 0.6], [-1.2, -0.6]].map(([a, s]) => [c.x + fx * a + fz * s, c.z + fz * a - fx * s]);
  let top = -1; const y0 = Math.floor(c.y + 0.5);
  for (const [x, z] of pts) { let y = y0; while (y > 0 && !solid(get(Math.floor(x), y - 1, Math.floor(z)))) y--; if (y > 0) top = Math.max(top, y); }
  if (top < 0) return;
  while (top < H - 2 && solid(get(Math.floor(c.x), top, Math.floor(c.z)))) top++;
  c.snapped = true; c.y = top; c.vy = 0; c.g.position.set(c.x, c.y, c.z);
}
function removeCar(c) { scene.remove(c.g); cars.splice(cars.indexOf(c), 1); if (c.spot) spawnedSpots.delete(c.spot); }
// is anything in front of this car? (player, people, animals, other cars)
function blockedAhead(c, reach = 3.6) {
  const fx = Math.sin(c.head), fz = Math.cos(c.head);
  const hit = (x, z) => { const dx = x - c.x, dz = z - c.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx); return along > 0.5 && along < reach && side < 1.25; };
  if (!player.car && hit(player.pos.x, player.pos.z) && Math.abs(player.pos.y - c.y) < 2) return 'player';
  for (const m of mobs) if (hit(m.g.position.x, m.g.position.z)) return m;
  for (const o of cars) if (o !== c && hit(o.x, o.z)) return o;
  for (const o of services) if (hit(o.x, o.z)) return o;
  return null;
}
function carSolidAt(x, y, z) { for (const dy of [0, 1]) if (solid(get(Math.floor(x), Math.floor(y + dy + 0.2), Math.floor(z)))) return true; return false; }
let sirenT = 0;
function updateCars(dt, t) {
  const pp = player.pos;
  if (player.car && !player.alive) exitCar();
  for (const c of [...cars]) {
    const d = Math.hypot(c.x - pp.x, c.z - pp.z);
    if (c !== player.car && d > 110) { removeCar(c); continue; }
    if (c.lights.length) { const on = wanted > 0 || c.ai; const f = Math.floor(t * 6) % 2; c.lights[0].material.emissive.setHex(on && f ? 0xff0000 : 0x200000); c.lights[1].material.emissive.setHex(on && !f ? 0x0030ff : 0x000020); }
    if (c === player.car) { driveCar(c, dt); continue; }
    if (!c.ai) { if (!c.snapped && data.has(ckey(fdiv(Math.floor(c.x), CH), fdiv(Math.floor(c.z), CH)))) snapCarGround(c); continue; }
    const chasing = c.kind === 'police' && wanted > 0 && d < 45 && canHurtPlayer();
    if (chasing) {   // police: head straight for you, stop close by and let a cop out
      const want = Math.atan2(pp.x - c.x, pp.z - c.z); let dh = ((want - c.head + Math.PI * 3) % (Math.PI * 2)) - Math.PI; c.head += Math.max(-2.5 * dt, Math.min(2.5 * dt, dh));
      c.speed += ((d > 7 ? 9 : 0) - c.speed) * Math.min(1, dt * 2);
      const nx = c.x + Math.sin(c.head) * c.speed * dt, nz = c.z + Math.cos(c.head) * c.speed * dt;
      const ba = blockedAhead(c, 2.6);
      if (!carSolidAt(nx + Math.sin(c.head) * 1.8, c.y, nz + Math.cos(c.head) * 1.8) && !(ba && ba !== 'player')) { c.x = nx; c.z = nz; } else c.speed = 0;
      if (d < 9 && !c.dropped && c.seats[0]) { c.dropped = true; const m = spawnMob('cop', c.x + Math.cos(c.head) * 1.6, c.y, c.z - Math.sin(c.head) * 1.6); if (m) m.home = new THREE.Vector2(c.x, c.z); }
      c.offRoad = true;
    } else if (c.offRoad) {   // drive back to the nearest lane once the chase is over
      c.offRoad = false; snapToLane(c);
    } else {
      const ahead = blockedAhead(c);
      const target = ahead ? 0 : (c.kind === 'police' ? 6 : 5);
      c.speed += (target - c.speed) * Math.min(1, dt * (ahead ? 6 : 1.5));
      if (ahead === 'player') { c.honk -= dt; if (c.honk <= 0 && d < 20) { c.honk = 2.5; beep(330, 0.25, 'square', 0.05); setTimeout(() => beep(300, 0.3, 'square', 0.05), 260); } } else c.honk = 0.6;
      laneDrive(c, dt);
      const want = dirHead(c.dir); let dh = ((want - c.head + Math.PI * 3) % (Math.PI * 2)) - Math.PI; c.head += dh * Math.min(1, dt * 6);
    }
    c.g.position.set(c.x, c.y, c.z); c.g.rotation.y = c.head;
    if (c.speed > 1 && Math.random() < dt * 1.5) smokePuff(c.x - Math.sin(c.head) * 1.9, c.y + 0.35, c.z - Math.cos(c.head) * 1.9, 1, 0x9a9a9a);
  }
  if (wanted > 0 && !canHurtPlayer()) wanted = 0;
  if (wanted > 0) {
    wanted -= dt; sirenT -= dt;
    if (sirenT <= 0 && cars.some(c => c.kind === 'police' && Math.hypot(c.x - pp.x, c.z - pp.z) < 50)) { sirenT = 1.2; beep(760, 0.5, 'sawtooth', 0.035); setTimeout(() => beep(980, 0.5, 'sawtooth', 0.035), 550); }
    if (wanted <= 0) toast('😮‍💨 You lost the cops');
  }
}
function snapToLane(c) {
  const t = c.t, ax = Math.abs(Math.sin(c.head)) > Math.abs(Math.cos(c.head));
  c.dir = ax ? (Math.sin(c.head) > 0 ? 0 : 2) : (Math.cos(c.head) > 0 ? 1 : 3);
  const across = c.dir % 2 === 1 ? c.x - t.x0 : c.z - t.z0; c.strip = Math.max(0, Math.min(t.nb || 3, Math.round((across - 2) / 16)));
  const lc = laneCoord(t, c.dir, c.strip); if (c.dir % 2 === 1) c.x = lc; else c.z = lc;
}
function laneDrive(c, dt) {
  const t = c.t, pos = c.dir === 0 || c.dir === 1, alongX = c.dir % 2 === 0;
  const a0 = alongX ? c.x : c.z, a1 = a0 + (pos ? 1 : -1) * c.speed * dt, base = alongX ? t.x0 : t.z0;
  // crossing the centre of an intersection? pick straight / left / right
  const NB = t.nb || 3;
  for (let m = 0; m <= NB; m++) {
    const cm = base + m * 16 + 2;
    if (!(pos ? a0 < cm && a1 >= cm : a0 > cm && a1 <= cm)) continue;
    const opts = [];
    if (pos ? m < NB : m > 0) opts.push(c.dir, c.dir);
    for (const d2 of [(c.dir + 1) % 4, (c.dir + 3) % 4]) { const p2 = d2 === 0 || d2 === 1; if (p2 ? c.strip < NB : c.strip > 0) opts.push(d2); }
    const nd = opts[Math.floor(Math.random() * opts.length)];
    if (nd !== c.dir) { const oldLane = alongX ? c.z : c.x; c.dir = nd; const nstrip = m; const lc = laneCoord(t, nd, nstrip); if (nd % 2 === 1) { c.x = lc; c.z = oldLane; } else { c.z = lc; c.x = oldLane; } c.strip = nstrip; return; }
    break;
  }
  if (alongX) c.x = a1; else c.z = a1;
  const end = alongX ? t.x1 - 2 : t.z1 - 2, start = base + 2;
  if (pos && (alongX ? c.x : c.z) > end) c.dir = (c.dir + 2) % 4, snapToLane(c);
  if (!pos && (alongX ? c.x : c.z) < start) c.dir = (c.dir + 2) % 4, snapToLane(c);
}
// ---- you behind the wheel: joystick / WASD to drive, jump to get out
function enterCar(c) {
  if (c.seats[0]) {   // someone's driving: they jump out (that's carjacking)
    c.g.remove(c.seats[0]); c.seats[0] = null;
    const m = spawnMob('ped', c.x + Math.cos(c.head) * 1.8, c.y, c.z - Math.sin(c.head) * 1.8); if (m) { m.panic = 6; m.home = new THREE.Vector2(c.x, c.z); }
    if (c.kind === 'police' || Math.random() < 0.6) setWanted();
  }
  c.ai = false; player.car = c; player.yaw = c.head + Math.PI; player.pitch = -0.08; c.lastHead = c.head;
  if (c.spot) { spawnedSpots.delete(c.spot); c.spot = null; }
  toast(c.seats[1] ? '🚗 Driving, with a passenger! Jump to get out' : '🚗 Driving! Jump to get out'); beep(120, 0.3, 'sawtooth', 0.05);
}
function exitCar() {
  const c = player.car; if (!c) return; if (c.vessel) { exitVessel(); return; } player.car = null; c.speed = 0; snapCarGround(c);
  const sx = c.x + Math.cos(c.head) * 1.6, sz = c.z - Math.sin(c.head) * 1.6;
  let y = Math.floor(c.y); while (y < H - 2 && (solid(get(Math.floor(sx), y, Math.floor(sz))) || solid(get(Math.floor(sx), y + 1, Math.floor(sz))))) y++;
  player.pos.set(sx, y, sz); player.vel.set(0, 0, 0); player.fallStart = null;
}
function driveCar(c, dt) {
  let thr = 0, steer = 0;
  if (keys.KeyW || keys.ArrowUp) thr += 1; if (keys.KeyS || keys.ArrowDown) thr -= 1;
  if (keys.KeyA || keys.ArrowLeft) steer += 1; if (keys.KeyD || keys.ArrowRight) steer -= 1;
  if (joy.id !== null) { thr -= joy.y; steer -= joy.x; }
  thr = Math.max(-1, Math.min(1, thr)); steer = Math.max(-1, Math.min(1, steer));
  const md = c.mods || {}, max = (thr >= 0 ? 13 : 5) * (1 + (md.eng || 0) * 0.12);   // v1.14: engine / handling stages from the garage
  c.speed += (thr * max - c.speed) * Math.min(1, dt * (thr ? 1.2 * (1 + (md.eng || 0) * 0.2) : 2.5));
  c.head += steer * dt * 1.9 * (1 + (md.hand || 0) * 0.12) * Math.min(1, Math.abs(c.speed) / 4) * Math.sign(c.speed || 1);
  const fx = Math.sin(c.head), fz = Math.cos(c.head), nx = c.x + fx * c.speed * dt, nz = c.z + fz * c.speed * dt, sgn = Math.sign(c.speed) || 1;
  const probe = [[0, 1.85], [0.75, 1.85], [-0.75, 1.85]].map(([sx, a]) => [nx + fx * a * sgn + fz * sx, nz + fz * a * sgn - fx * sx]);
  let blocked = false, step = 0;
  for (const [px, pz] of probe) { if (solid(get(Math.floor(px), Math.floor(c.y + 1.2), Math.floor(pz)))) blocked = true; else if (solid(get(Math.floor(px), Math.floor(c.y + 0.2), Math.floor(pz)))) step = 1; }
  if (!blocked) {
    const ahead = blockedAhead(c, 2.4);
    if (ahead && ahead !== 'player' && ahead.g && ahead.hp != null && Math.abs(c.speed) > 3) { hurtMob(ahead, Math.round(Math.abs(c.speed) * 1.4), new THREE.Vector3(c.x, c.y, c.z)); if (MOBDEF[ahead.type].human) setWanted(); noiseBurst(0.1, 0.1, 400); }
    if (ahead && ahead.kind && ahead.g && Math.abs(c.speed) > 2) { noiseBurst(0.15, 0.12, 300); c.speed = -c.speed * 0.3; }
    else { c.x = nx; c.z = nz; if (step) c.y += 1; }
  } else { if (Math.abs(c.speed) > 6) noiseBurst(0.12, 0.1, 300); c.speed = -c.speed * 0.25; }
  // gravity: drop down when the ground falls away
  if (!solid(get(Math.floor(c.x), Math.floor(c.y - 0.1), Math.floor(c.z)))) { c.vy -= 24 * dt; c.y += c.vy * dt; if (solid(get(Math.floor(c.x), Math.floor(c.y - 0.1), Math.floor(c.z)))) { c.y = Math.floor(c.y - 0.1) + 1; c.vy = 0; } }
  else c.vy = 0;
  if (c.y < -5) { exitCar(); removeCar(c); return; }
  c.g.position.set(c.x, c.y, c.z); c.g.rotation.y = c.head;
  player.yaw += c.head - c.lastHead; c.lastHead = c.head;
  const sx = 0.38, seat = new THREE.Vector3(c.x + Math.cos(c.head) * sx - Math.sin(c.head) * 0.15, c.y + 1.2, c.z - Math.sin(c.head) * sx - Math.cos(c.head) * 0.15);
  player.pos.set(seat.x, seat.y - EYE, seat.z);
  // chase camera behind the car; drag to look around it
  const pt = Math.min(0.6, Math.max(-0.9, player.pitch)), cp = Math.cos(pt), fwd = new THREE.Vector3(-Math.sin(player.yaw) * cp, Math.sin(pt), -Math.cos(player.yaw) * cp);
  const focus = new THREE.Vector3(c.x, c.y + 1.3, c.z); let dist = 6.5;
  for (let s = 1; s <= 6.5; s += 0.5) { const q = focus.clone().addScaledVector(fwd, -s); q.y += 0.8; if (solid(get(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z)))) { dist = Math.max(1.2, s - 0.6); break; } }
  camera.position.copy(focus).addScaledVector(fwd, -dist); camera.position.y += 0.8; camera.lookAt(focus.x + fwd.x * 3, focus.y + 0.3 + fwd.y * 3, focus.z + fwd.z * 3);
  if (keys.Space || wantJump) { wantJump = false; keys.Space = false; exitCar(); }
  if (Math.abs(c.speed) > 0.5 && Math.random() < dt * 3) smokePuff(c.x - fx * 1.9, c.y + 0.35, c.z - fz * 1.9, 1, 0x9a9a9a);
  engineT -= dt; if (engineT <= 0) { engineT = 0.18; beep(55 + Math.abs(c.speed) * 9, 0.17, 'sawtooth', 0.018); }
}
let engineT = 0;

// ---- the spawner: fills nearby towns with townsfolk, cops, traffic, parked cars and traders
const spawnedSpots = new Set(); let townT = 0;
const TRADE_NAMES = ['Sam', 'Rosa', 'Dee', 'Jay', 'Kim', 'Leo', 'Mia', 'Ray', 'Tia', 'Omar', 'Zoe', 'Gus'];
const TOWN_TRADES = [
  { job: 'Farmer', robe: 0x3f8f3a, sells: { seeds_wheat: 2, seeds_carrot: 4, seeds_potato: 4, wheat: 4, bread: 9 }, buys: { wheat: 3, carrot: 5, potato: 5, pumpkin: 16, egg: 3 } },
  { job: 'Butcher', robe: 0xb0302a, sells: { steak: 12, cooked_pork: 11 }, buys: { raw_beef: 5, raw_pork: 5, raw_chicken: 4, raw_mutton: 4, leather: 6 } },
  { job: 'Builder', robe: 0xf2a21a, sells: { asphalt: 2, concrete: 2, roof_tiles: 2, white_wall: 2, blue_siding: 2, yellow_siding: 2, lamp: 6, glass: 3 }, buys: { cobble: 1, planks: 1, log: 2 } },
  { job: 'Street Dealer', robe: 0x2a2a2a, sells: { seeds_weed: 25 }, buys: { weed: 120 } },
  { job: 'Cartographer', robe: 0x6a4ad2, sells: { map: 12, torch: 2 }, buys: { feather: 4, wool: 5 } },
];
function spawnTrader(t, x, z, key) {
  const k = Math.floor(hash2(x, z, state.seed + 7) * TOWN_TRADES.length), tr = t.type === 'city' && hash2(x, z, 9) < 0.5 ? TOWN_TRADES[3] : TOWN_TRADES[k];
  const name = TRADE_NAMES[Math.floor(hash2(z, x, state.seed + 3) * TRADE_NAMES.length)] + ' the ' + tr.job;
  const g = new THREE.Group(), skin = lam(0xc58c63);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.4), lam(tr.robe)); body.position.y = 0.75; g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), lam(0x3b2a1d)); legs.position.y = 0.15; g.add(legs);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.3), lam(tr.robe)); arms.position.set(0, 0.95, 0.22); g.add(arms);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), skin); head.position.y = 1.5; g.add(head);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), skin); nose.position.set(0, 1.42, 0.3); g.add(nose);
  for (const ex of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), lam(0x1a3d1a)); e.position.set(ex, 1.56, 0.26); g.add(e); }
  const tag = nameSprite('💰 ' + name); tag.position.y = 2.25; g.add(tag);
  g.position.set(x + 0.5, t.base + 1, z + 0.5); scene.add(g);
  villagers.push({ name, job: tr.job, robe: tr.robe, sells: tr.sells, buys: tr.buys, g, target: null, wait: Math.random() * 3, home: new THREE.Vector2(x + 0.5, z + 0.5), spot: key, town: true });
}
function townsNear(r) {
  const out = [], rx = fdiv(fdiv(Math.floor(player.pos.x), CH), TREG), rz = fdiv(fdiv(Math.floor(player.pos.z), CH), TREG);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const t = townOf(rx + dx, rz + dz); if (!t || out.includes(t)) continue;
    const px = player.pos.x, pz = player.pos.z, ddx = Math.max(t.x0 - px, 0, px - t.x1), ddz = Math.max(t.z0 - pz, 0, pz - t.z1);
    if (Math.hypot(ddx, ddz) < r) out.push(t);
  }
  return out;
}
function randomTownCell(t, want) {
  for (let i = 0; i < 30; i++) {
    const x = t.x0 + Math.floor(Math.random() * (t.x1 - t.x0)), z = t.z0 + Math.floor(Math.random() * (t.z1 - t.z0));
    const d = Math.hypot(x - player.pos.x, z - player.pos.z); if (d < 16 || d > 60) continue;
    if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
    const c = townCell(t, x, z); if (want && c !== want) continue;
    if (solid(get(x, t.base + 1, z)) || solid(get(x, t.base + 2, z))) continue;
    return [x, z];
  }
  return null;
}
const pedTarget = t => t.metro ? 18 : t.type === 'city' ? 12 : 6;
function updateTowns(dt) {
  townT -= dt; if (townT > 0) return; townT = 1;
  const near = townsNear(70), pp = player.pos;
  // tidy up traders far away
  for (const v of [...villagers]) if (v.town && v.g.position.distanceTo(pp) > 110) { scene.remove(v.g); villagers.splice(villagers.indexOf(v), 1); spawnedSpots.delete(v.spot); }
  for (const t of near) {
    const city = t.type === 'city';
    const folk = mobs.filter(m => m.townId === t.id);
    if (folk.filter(m => m.type === 'ped').length < pedTarget(t)) { const c = randomTownCell(t, city ? 'walk' : null); if (c) { const m = spawnMob('ped', c[0] + 0.5, t.base + 1, c[1] + 0.5); if (m) { m.townId = t.id; m.home = new THREE.Vector2(c[0], c[1]); maybeLeash(m); } } }
    townAnimals(t, folk, city);
    if (folk.filter(m => m.type === 'cop').length < (city ? 2 : 1)) { const c = randomTownCell(t, 'walk'); if (c) { const m = spawnMob('cop', c[0] + 0.5, t.base + 1, c[1] + 0.5); if (m) { m.townId = t.id; m.home = new THREE.Vector2(c[0], c[1]); } } }
    const traffic = cars.filter(c => c.t === t && c.ai);
    const wantCars = t.metro ? 9 : city ? 6 : 3, wantPolice = city ? 2 : 1;
    const nPol = traffic.filter(c => c.kind === 'police').length;
    if (traffic.length < wantCars + wantPolice) {
      const police = nPol < wantPolice && (city || Math.random() < 0.5), dir = Math.floor(Math.random() * 4), strip = Math.floor(Math.random() * ((t.nb || 3) + 1));
      const along = (dir % 2 === 0 ? t.x0 : t.z0) + 8 + Math.floor(Math.random() * (t.nb || 3)) * 16, lc = laneCoord(t, dir, strip);
      const x = dir % 2 === 1 ? lc : along, z = dir % 2 === 1 ? along : lc, d = Math.hypot(x - pp.x, z - pp.z);
      if (d > 22 && d < 70 && data.has(ckey(fdiv(x, CH), fdiv(z, CH))) && !cars.some(o => Math.hypot(o.x - x, o.z - z) < 7))
        spawnCar(t, { kind: police ? 'police' : 'car', people: police ? 1 + (Math.random() < 0.6 ? 1 : 0) : 1 + (Math.random() < 0.45 ? 1 : 0), dir, strip, x, z, ai: true });
    }
    // parked cars and traders from the town plan
    for (let cx = t.rx * TREG + 1; cx <= t.rx * TREG + (t.nb || 3); cx++) for (let cz = t.rz * TREG + 1; cz <= t.rz * TREG + (t.nb || 3); cz++) {
      const spots = townSpots.get(ckey(cx, cz)); if (!spots) continue;
      for (const s of spots) {
        const key = s.kind + s.x + ',' + s.z; if (spawnedSpots.has(key)) continue;
        if (Math.hypot(s.x - pp.x, s.z - pp.z) > 55) continue;
        spawnedSpots.add(key);
        if (s.kind === 'car') spawnCar(t, { x: s.x, z: s.z, head: Math.PI, people: 0, spot: key });
        else spawnTrader(t, s.x, s.z, key);
      }
    }
  }
}

// ---- the holdable map: a top-down picture of the land around you
const mapEl = document.createElement('div'); mapEl.id = 'mapView';
mapEl.innerHTML = '<canvas width="256" height="256"></canvas>';
document.body.appendChild(mapEl);
const mapCv = mapEl.querySelector('canvas'), mapCtx = mapCv.getContext('2d');
let mapT = 0;
const colCache = {};
function topColor(id, y) {
  if (!colCache[id]) { const t = (BT[id] || BT[STONE])[0], d = actx.getImageData((t % AT) * TS, Math.floor(t / AT) * TS, TS, TS).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } colCache[id] = n ? [r / n, g / n, b / n] : [200, 200, 200]; }
  const base = colCache[id], k = 0.75 + (y - 10) * 0.018;
  return [base[0] * k, base[1] * k, base[2] * k];
}
// explored land is remembered per chunk, so the map keeps places you've been even after they unload
function chunkColors(cx, cz) {
  const k = ckey(cx, cz), c = data.get(k), have = mapMem.get(k);
  if (!c || (have && !have.coarse && !mapDirty.has(k))) return have || null;
  const out = new Uint8ClampedArray(CH * CH * 3);
  for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    let col = [214, 196, 150];
    for (let y = H - 1; y >= 0; y--) { const id = c[lidx(lx, y, lz)]; if (id === AIR || PLANT.has(id)) continue; col = isWater(id) ? [60, 100, 220] : id === LEAVES ? [40, 110, 40] : topColor(id, y); break; }
    const o = (lz * CH + lx) * 3; out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2];
  }
  mapMem.set(k, out); mapDirty.delete(k); regionPut(cx, cz, out); mapChanged = true; return out;
}
// the holdable map shows the WHOLE explored world (remembered per world), with you, waypoints, pets and police on it
function drawMap() {
  for (const k of mapDirty) { const [cx, cz] = k.split(',').map(Number); chunkColors(cx, cz); }
  drawHeldMap(mapCtx, 256);
}
function updateMap(dt) {
  const show = playing && !uiOpen && player.alive && (held() === 'map' || (state.off && state.off.id === 'map'));
  mapEl.style.display = show ? 'block' : 'none';
  if (!show) return; mapT -= dt; if (mapT <= 0) { mapT = 0.7; drawMap(); }
}

// ---- the off-hand: hold a torch (or anything) in your left hand while you use a tool in the right
const lhand = new THREE.Group(); camera.add(lhand); lhand.position.set(-0.52, -0.47, -0.75);
let lhandItem = '__none';
const heldLight = new THREE.PointLight(0xffb060, 0, 11, 1.3); camera.add(heldLight); heldLight.position.set(0, 0, -0.4);
function swapOffhand() {
  const a = state.slots[state.sel]; state.slots[state.sel] = state.off || null; state.off = a || null;
  renderHotbar(); beep(420, 0.05, 'triangle', 0.05);
  toast(state.off ? `🤚 Left hand: ${ITEMS[state.off.id].name}` : '🤚 Left hand empty');
}
function updateOffhand(dt) {
  const id = state.off ? state.off.id : null;
  if (id !== lhandItem) {
    lhandItem = id; while (lhand.children.length) lhand.remove(lhand.children[0]);
    if (id) {
      const it = ITEMS[id]; let mesh;
      const nd = m => { m.depthTest = false; m.depthWrite = false; return m; };
      if (it.px || it.sprite) { mesh = new THREE.Mesh(extrudeIcon(id), nd(new THREE.MeshLambertMaterial({ vertexColors: true }))); mesh.scale.set(-0.85, 0.85, 0.85); mesh.rotation.set(0.05, 0.62, -0.42); mesh.position.set(-0.1, 0.22, 0.02); mesh.material.side = THREE.DoubleSide; }
      else if (it.block != null) { mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), nd(new THREE.MeshLambertMaterial({ map: tileTex(BT[it.block][2]) }))); mesh.rotation.set(0.2, -0.7, 0); }
      else { const t = new THREE.CanvasTexture(itemCanvas(id)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), nd(new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }))); mesh.rotation.set(0, 1.2, 0); }
      mesh.renderOrder = 10; lhand.add(mesh);
    }
    const o = document.getElementById('offSlot'); if (o) o.innerHTML = state.off ? slotHTML(state.off, '', false) : '<div class="slot"></div>';
    placeOffSlot();
  }
  lhand.visible = !player.car && id !== 'map'; hand.visible = !player.car && held() !== 'map';
  lhand.position.y = -0.47 + Math.abs(Math.sin(bobT)) * 0.02;
  // a torch in either hand lights up the space around you
  const lit = id === 'torch' || held() === 'torch';
  heldLight.intensity = lit ? (1.0 + nightAmt * 1.8) * (0.9 + Math.sin(performance.now() / 70) * 0.05) : 0;
}

function placeOffSlot() { const o = document.getElementById('offSlot'), hb = document.getElementById('hotbar'); if (!o || !hb) return; const r = hb.getBoundingClientRect(); o.style.left = Math.max(4, r.left - o.offsetWidth - 10) + 'px'; }
addEventListener('resize', () => setTimeout(placeOffSlot, 50));
setTimeout(placeOffSlot, 600); setInterval(placeOffSlot, 3000);

// ================== INPUT ==================
const keys = {};
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');
let playing = false, uiOpen = false;
const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 }, look = { id: null, x: 0, y: 0 };
let wantJump = false, holdBreak = false, lastWTap = 0, lastTouchTap = 0, lastJoyTap = 0;

addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!keys[e.code] && e.code === 'KeyW') { const n = performance.now(); if (n - lastWTap < 300) player.sprint = true; lastWTap = n; }   // double-tap W to sprint
  keys[e.code] = true;
  if (!playing) return;
  if (e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); uiOpen ? closePanels() : openInventory(false); }
  if (e.code === 'Escape' && uiOpen) closePanels();
  if (e.code === 'ControlLeft') player.sprint = true;
  if (e.code === 'KeyF' && !uiOpen) swapOffhand();
  if (e.code === 'KeyP') { if (uiOpen) { if (document.getElementById('phone').classList.contains('show')) closePanels(); } else openPhone(); }
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') && player.horse && !uiOpen) dismountHorse();
  if (e.code === 'KeyV' && !uiOpen) { settings.view3 = !settings.view3; saveSettings(); }
  if (e.code === 'Space' && player.car && !e.repeat) { exitCar(); keys.Space = false; }
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
// mine button: keep holding to mine AND drag the same finger to look around; the button rides under your
// finger while you drag and slides back home when you let go
(() => {
  const el = document.getElementById('bBreak'); let id = null, sx = 0, sy = 0, lx = 0, ly = 0;
  el.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation(); if (id !== null) return;
    const t = e.changedTouches[0]; id = t.identifier; sx = lx = t.clientX; sy = ly = t.clientY;
    el.classList.add('on', 'drag'); if (!player.alive) return; holdBreak = true; attackOrSwing();
  }, { passive: false });
  el.addEventListener('touchmove', e => {
    e.preventDefault(); e.stopPropagation();
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      if (playing && !uiOpen && player.alive) {
        player.yaw -= (t.clientX - lx) * 0.006 * settings.sens; player.pitch -= (t.clientY - ly) * 0.006 * settings.sens;
        player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
      }
      lx = t.clientX; ly = t.clientY;
      el.style.transform = `translate(${lx - sx}px,${ly - sy}px)`;
    }
  }, { passive: false });
  const up = e => {
    for (const t of e.changedTouches) if (t.identifier === id) {
      e.preventDefault(); id = null; holdBreak = false;
      el.classList.remove('on', 'drag'); el.style.transform = '';
    }
  };
  el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
})();
holdBtn('bUse', () => useAction());
holdBtn('bRun', () => { player.sprint = !player.sprint; });
holdBtn('bOff', () => { if (playing && player.alive) swapOffhand(); });
holdBtn('bDismount', () => { if (player.horse) dismountHorse(); });
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
  const o = new THREE.Vector3(player.pos.x, player.pos.y + EYE, player.pos.z), d = getDir();
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / (d.x || 1e-9)), tdy = Math.abs(1 / (d.y || 1e-9)), tdz = Math.abs(1 / (d.z || 1e-9));
  let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
  let n = [0, 0, 0], t = 0, hit = null;
  while (t <= maxD) {
    const k = x + ',' + y + ',' + z;
    if (state.crops[k]) { hit = { kind: 'crop', x, y, z, n, t, key: k }; break; }
    for (const dy of [1, 2]) { const k2 = x + ',' + (y - dy) + ',' + z, c2 = state.crops[k2]; if (c2 && CROPS[c2.type].tall && c2._st >= 2 && cropHeight(c2) > dy) { hit = { kind: 'crop', x, y: y - dy, z, n, t, key: k2 }; break; } }
    if (hit) break;
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
  for (const c of cars) {
    if (c === player.car) continue;
    const sx = Math.abs(Math.sin(c.head)), w = 0.85 + sx * 0.95, l = 1.8 - sx * 0.95;
    const b = new THREE.Box3(new THREE.Vector3(c.x - w, c.y, c.z - l), new THREE.Vector3(c.x + w, c.y + 1.5, c.z + l));
    const p = ray.intersectBox(b, tmp); if (p) { const dist = p.distanceTo(o); if (dist < maxD && (!hit || dist < hit.t)) hit = { kind: 'car', c, t: dist }; }
  }
  hit = vesselHit(ray, o, maxD, hit, tmp);
  for (const m of mobs) {
    if (m.ridden) continue;
    const def = MOBDEF[m.type], gp = m.g.position, w = def.w + 0.15 + (def.hitX != null ? def.hitX : m.type === 'cow' || m.type === 'pig' || m.type === 'sheep' ? 0.35 : m.type === 'chicken' ? 0.15 : 0);
    const b = new THREE.Box3(new THREE.Vector3(gp.x - w, gp.y, gp.z - w), new THREE.Vector3(gp.x + w, gp.y + (def.hitH || def.h), gp.z + w));
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
      const a = rint(...cr.yield) * (cr.tall ? (c.tall || 2) - 1 : 1), s = rint(...cr.seeds);
      give(CROP_ITEM[c.type], a); if (s) give(seedOf(c.type), s);
      if (cr.tall && c.tall === 3) toast('🌿 A rare 3-block plant!');
      toast(`+${a} ${ITEMS[CROP_ITEM[c.type]].name}${s ? `, +${s} seeds` : ''}`); beep(660, 0.09, 'triangle', 0.08);
    } else { give(seedOf(c.type), 1); toast(CROPS[c.type].seed ? 'Not grown yet, picked it back up' : 'Not ripe yet, got the seed back'); }
  }
  buildCrops();
}
const held = () => { const s = state.slots[state.sel]; return s ? s.id : null; };
const heldTool = () => { const id = held(); return id && ITEMS[id].tool ? ITEMS[id].tool : null; };
// how long a block takes to break with what you're holding, and whether it drops
function breakInfo(id) {
  const h = HARD[id] || [0.5, null], t = heldTool();
  const right = t && (t.kind === h[1] || (t.kind === 'shovel' && (h[1] === 'hoe' || h[1] === 'shovel'))), lvl = right ? TIERS[t.tier].lvl : 0;
  const canDrop = h[2] == null || lvl >= h[2];
  const speed = right ? TIERS[t.tier].speed : 1;
  return { time: Math.max(0.05, h[0] * (canDrop ? 1.5 : 5) / speed), canDrop: canDrop && h[2] !== 99, right };
}
const mine = { key: null, prog: 0, total: 1, cd: 0 };
function attackOrSwing() {
  if (AC && AC.state === 'suspended') AC.resume();
  swing();
  { const st = heldTool(); if (st && st.kind === 'sword' && mine.cd <= 0) cutSnd(); }
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
  if (isSoil(id)) shovelSnd(1.3);
  const above = h.x + ',' + (h.y + 1) + ',' + h.z;
  if (state.crops[above]) removeCrop(above, true);
  if (!isPlant(id) && isPlant(get(h.x, h.y + 1, h.z))) { const pid = get(h.x, h.y + 1, h.z); setBlock(h.x, h.y + 1, h.z, AIR, false); if (BLOCK_DROP[pid]) give(BLOCK_DROP[pid], 1); }
  const key = h.x + ',' + h.y + ',' + h.z;
  if (isDoor(id)) { const oy = doorTop(id) ? h.y - 1 : h.y + 1; if (isDoor(get(h.x, oy, h.z))) setBlock(h.x, oy, h.z, AIR, false); setBlock(h.x, h.y, h.z, AIR); give('door', 1); }
  else if (id === GRAVE) { setBlock(h.x, h.y, h.z, AIR); openGrave(key); }
  else if (id === GRAVE_DIRT) {   // dig up an old grave: bones, sometimes jewelry (shovel only)
    setBlock(h.x, h.y, h.z, DIRT);
    const t = heldTool();
    if (t && t.kind === 'shovel') { const loot = graveLoot(); for (const [it, n] of loot) give(it, n);
      const best = loot.find(l => /jewelry/.test(l[0])); toast(best ? `💍 You dug up ${ITEMS[best[0]].name}!` : loot.length ? `🦴 Dug up ${loot.map(l => l[1] + ' ' + ITEMS[l[0]].name).join(', ')}` : '🪦 Nothing but dirt down there');
      if (best) { beep(1200, 0.1, 'triangle', 0.07); setTimeout(() => beep(1600, 0.15, 'triangle', 0.07), 120); } }
    else toast('🪦 Use a shovel to dig up grave dirt');
  }
  else {
    setBlock(h.x, h.y, h.z, AIR);
    if (id === CHEST && state.chests[key]) { for (const s of state.chests[key]) if (s) give(s.id, s.n); delete state.chests[key]; }
    if (id === FURNACE && state.furnaces[key]) { const f = state.furnaces[key]; for (const s of [f.in, f.fuel, f.out]) if (s) give(s.id, s.n); delete state.furnaces[key]; }
    const drop = BLOCK_DROP[id];
    if (info.canDrop && drop && !(id === LEAVES && Math.random() < 0.6)) give(drop, id === COAL_ORE ? rint(1, 2) : 1);
    else if (!info.canDrop && HARD[id] && HARD[id][2] && HARD[id][2] < 99) toast(HARD[id][2] >= 2 ? '⛏️ You need a stone pickaxe or better for that' : '⛏️ You need a pickaxe to collect that');
    if (id === LEAVES && Math.random() < 0.08) give('stick', 1);
    if (id === LEAVES && Math.random() < 0.06) { give('apple', 1); toast('🍎 Found an apple!'); }
    if ((id === GRASS || id === DEADGRASS || id === LEAVES) && Math.random() < 0.15) { const s = ['seeds_wheat', 'seeds_wheat', 'seeds_carrot', 'seeds_potato', 'seeds_berries', 'seeds_weed'][rint(0, 5)]; give(s, 1); toast(`Found ${ITEMS[s].name}!`); }
    if (id === PUMPKIN) toast('🎃 Picked a wild pumpkin!');
  }
  particles(h.x + 0.5, h.y + 0.5, h.z + 0.5, blockCol(id), 10);
  beep(160 + Math.random() * 60, 0.07, 'square', 0.05);
  exhaust(0.005); if (heldTool()) wearTool(info.right ? 1 : 2);
}
function updateMining(dt) {
  mine.cd = Math.max(0, mine.cd - dt); if (player.car) { crackMesh.visible = false; return; }
  const h = holdBreak && playing && !uiOpen && player.alive ? raycast() : null;
  if (holdBreak && vesselBreak(h, dt)) { mine.key = null; crackMesh.visible = false; return; }
  if (!h || h.kind !== 'block' && h.kind !== 'crop') { mine.key = null; crackMesh.visible = false; if (h && h.kind === 'mob' && holdBreak) { attackOrSwing(); } return; }
  if (holdBreak) swing();
  if (h.kind === 'crop') { if (mine.cd <= 0) { removeCrop(h.key, true); mine.cd = 0.25; } return; }
  const key = h.x + ',' + h.y + ',' + h.z;
  if (mine.key !== key) { mine.key = key; mine.prog = 0; mine.total = breakInfo(h.id).time; mine.tick = 0; }
  if (mine.cd > 0) return;
  mine.prog += dt; mine.tick -= dt;
  if (mine.tick <= 0) { mine.tick = 0.22; if (isSoil(h.id)) shovelSnd(0.8); else beep(110 + Math.random() * 40, 0.04, 'square', 0.03); particles(h.x + 0.5 + h.n[0] * 0.5, h.y + 0.5 + h.n[1] * 0.5, h.z + 0.5 + h.n[2] * 0.5, blockCol(h.id), 2); }
  const stage = Math.min(9, Math.floor(mine.prog / mine.total * 10));
  crackMesh.visible = true; crackMesh.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); crackMesh.material.map = crackTex[stage]; crackMesh.material.needsUpdate = true;
  if (mine.prog >= mine.total) { finishBreak(h); mine.key = null; crackMesh.visible = false; mine.cd = 0.15; }
}
function eat(id) {
  const drug = DRUGS[id];
  if (!drug && state.food >= 20) { toast("You're not hungry"); return; }
  const f = ITEMS[id].food; state.food = Math.min(20, state.food + f); state.sat = Math.min(state.food, state.sat + f * 0.6);
  useHeld(1); player.eatT = 0.5; for (let i = 0; i < 4; i++) setTimeout(() => beep(260 + Math.random() * 80, 0.05, 'square', 0.05), i * 110);
  if (id === 'rotten_flesh' && Math.random() < 0.8) { exhaust(8); toast('🤢 That was rotten...'); }
  if (drug) takeDrug(id);
  renderVitals();
}
function placeBlock(h, block) {
  const rep = h.kind === 'block' && h.id === SNOW_LAYER, x = rep ? h.x : h.x + h.n[0], y = rep ? h.y : h.y + h.n[1], z = rep ? h.z : h.z + h.n[2];
  const tgt = get(x, y, z); if (tgt !== AIR && !isWater(tgt) && tgt !== SNOW_LAYER) return null;
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
  if (player.car) return;
  if (player.horse) { dismountHorse(); return; }
  { const hv = raycast(); if (hv && hv.kind === 'vessel') { boardVessel(hv.c); return; } if (id === 'boat' && placeBoat()) return; }
  const h = raycast(); if (!h) { if (it && it.food) eat(id); return; }
  if (h.kind === 'villager') { openTrade(h.v); return; }
  if (h.kind === 'car') { enterCar(h.c); return; }
  if (h.kind === 'mob') { if (interactMob(h.m, id, it)) return; if (it && it.food) eat(id); return; }
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
    if (isFurn(h.id)) { useFurn(h); return; }
    if (h.id === CTABLE) { openInventory(true); return; }
    if (h.id === FURNACE) { openFurnace(h.x + ',' + h.y + ',' + h.z); return; }
    if (h.id === CHEST) { openChest(h.x, h.y, h.z); return; }
    if (h.id === GRAVE) { const k = h.x + ',' + h.y + ',' + h.z; setBlock(h.x, h.y, h.z, AIR); openGrave(k); return; }
  }
  if (h.kind === 'crop') {
    const c = state.crops[h.key];
    if (id === 'cow_poop') {
      if (cropStage(c) >= 3) { toast('Already ripe!'); return; }
      useHeld(1); c.fert = true; c.t -= CROPS[c.type].grow * 0.35; buildCrops(); swing(); shovelSnd(0.6);
      toast(c.type === 'weed' ? '💩 Fertilized! Might grow extra tall...' : '💩 Fertilized! Growing faster'); return;
    }
    if (id === 'fertilizer') { if (cropStage(c) < 3) { useHeld(1); c.t = state.gameTime - CROPS[c.type].grow - 1; buildCrops(); toast('✨ Fully grown!'); beep(880, 0.15, 'sine', 0.08); } else toast('Already ripe!'); return; }
    if (it && it.tool && it.tool.kind === 'hoe') {   // hoes gather ripe crops and replant them
      const r = hoeR(it.tool.tier); let got = 0;
      const [cx0, cy, cz0] = h.key.split(',').map(Number);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const k = (cx0 + dx) + ',' + cy + ',' + (cz0 + dz), cc = state.crops[k];
        if (cc && cropStage(cc) >= 3) { const type = cc.type; removeCrop(k, true); if (take(seedOf(type), 1)) state.crops[k] = { type, t: state.gameTime }; got++; }
      }
      if (got) { buildCrops(); swing(); wearTool(1); } else toast(`${CROPS[c.type].name}: growing (${Math.min(99, Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100))}%)`);
      return;
    }
    if (cropStage(c) >= 3) removeCrop(h.key, true);
    else toast(`${CROPS[c.type].name}: growing (${Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100)}%)${CROPS[c.type].dark ? ' · grows only in the dark' : ''}`);
    return;
  }
  if (!it) return;
  if (it.food && !(it.crop)) { eat(id); return; }
  if (it.tool && it.tool.kind === 'hoe') {
    const hb = h.id === SNOW_LAYER ? { ...h, y: h.y - 1, id: get(h.x, h.y - 1, h.z) } : h;
    if (hb.id !== GRASS && hb.id !== DIRT && hb.id !== DEADGRASS && hb.id !== SNOW_GRASS) { toast('Use the hoe on grass or dirt'); return; }
    const r = hoeR(it.tool.tier); let n = 0;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = hb.x + dx, z = hb.z + dz, b = get(x, hb.y, z);
      if ((b === GRASS || b === DIRT || b === DEADGRASS || b === SNOW_GRASS) && (get(x, hb.y + 1, z) === AIR || get(x, hb.y + 1, z) === SNOW_LAYER)) { if (get(x, hb.y + 1, z) === SNOW_LAYER) setBlock(x, hb.y + 1, z, AIR, false); setBlock(x, hb.y, z, FARM, false); n++; }
    }
    flushDirty(); if (n) { beep(300, 0.07, 'triangle', 0.07); swing(); wearTool(1); }
    return;
  }
  if (it.crop && CROPS[it.crop].anySoil) {   // mushrooms: plant on any block, or right on top of cow poop
    let k;
    if (h.id === POOP) { setBlock(h.x, h.y, h.z, AIR); delete state.poops[h.x + ',' + h.y + ',' + h.z]; k = h.x + ',' + h.y + ',' + h.z; useHeld(1); state.crops[k] = { type: it.crop, t: state.gameTime - CROPS[it.crop].grow * 0.4, fert: true }; }
    else {
      if (h.n[1] !== 1 || !solid(h.id)) { if (it.food) { eat(id); return; } toast('Plant mushrooms on top of a block or on cow poop'); return; }   // v1.11: side of a block = eat it
      k = h.x + ',' + (h.y + 1) + ',' + h.z; if (state.crops[k] || get(h.x, h.y + 1, h.z) !== AIR) return;
      useHeld(1); state.crops[k] = { type: it.crop, t: state.gameTime };
    }
    buildCrops(); beep(520, 0.06, 'triangle', 0.07); swing();
    const [x, y, z] = k.split(',').map(Number); toast(isDarkAt(x, y, z) ? '🍄 Planted. It likes the dark!' : '🍄 Planted. Mushrooms only grow in the dark');
    return;
  }
  if (id === 'cow_poop') {
    if (h.kind !== 'block') return;
    const pl = placeBlock(h, POOP); if (!pl || !solid(get(pl[0], pl[1] - 1, pl[2]))) return;
    setBlock(pl[0], pl[1], pl[2], POOP); state.poops[pl[0] + ',' + pl[1] + ',' + pl[2]] = state.gameTime; useHeld(1); swing(); shovelSnd(0.5); return;
  }
  if (it.crop) {
    if (h.id !== FARM || h.n[1] !== 1) { toast('Plant seeds on farmland (use a hoe first)'); return; }
    const k = h.x + ',' + (h.y + 1) + ',' + h.z;
    if (state.crops[k] || get(h.x, h.y + 1, h.z) !== AIR) return;
    useHeld(1); state.crops[k] = { type: it.crop, t: state.gameTime }; buildCrops(); beep(520, 0.06, 'triangle', 0.07); swing();
    return;
  }
  if (id === 'water_bucket') {
    if (h && h.kind === 'block') { const tx = h.id === FIRE ? h.x : h.x + h.n[0], ty = h.id === FIRE ? h.y : h.y + h.n[1], tz = h.id === FIRE ? h.z : h.z + h.n[2];
      if (douseNear(tx, ty, tz)) { useHeld(1); give('bucket', 1); swing(); toast('💦 Fire put out'); return; } }
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
  if (it.furn != null) {
    if (h.kind !== 'block') return; const pl = placeBlock(h, it.furn); if (!pl) return;
    if (!solid(get(pl[0], pl[1] - 1, pl[2]))) { toast('Put it on top of a block'); return; }
    setBlock(pl[0], pl[1], pl[2], it.furn + facingToPlayer()); useHeld(1); swing(); beep(240, 0.05, 'square', 0.05);
    if (it.furn === LAPTOP0) toast('💻 Tap the laptop to open DealerNet'); if (it.furn === BED0) toast('🛏️ Sleep in it at night to skip to morning');
    return;
  }
  if (it.block != null) {
    const pl = placeBlock(h, it.block); if (!pl) return;
    setBlock(pl[0], pl[1], pl[2], (it.stairs || it.facing) ? it.block + facingToPlayer() : it.block); useHeld(1); swing(); beep(240, 0.05, 'square', 0.05);
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
    `💰 <b>${state.coins}</b> coins<br>🏆 ${r[1]}${nr ? ` <span style="opacity:.7;font-size:12px">(${nr[0] - state.earned} to ${nr[1]})</span>` : ''}<br>${night ? '🌙' : '☀️'} Day ${day()}${player.sprint ? ' · 🏃' : ''}<br>${hudWx()}`;
}

// ================== PANELS ==================
let invOpen = false, bigCraft = false, cursor = null, oneMode = false, furnaceKey = null, chestKeys = null;
const grid = emptySlots(9);
function closePanels() {
  if (invOpen) { for (let i = 0; i < 9; i++) if (grid[i]) { give(grid[i].id, grid[i].n); grid[i] = null; } }
  if (cursor) { const left = give(cursor.id, cursor.n); cursor = null; }
  if (chestKeys && typeof netChests === 'function') netChests(chestKeys);
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
  if (a === 'reset') { if (confirm('Start a new world? Your current farm and coins will be lost.')) { saveBlocked = true; localStorage.removeItem(SAVE_KEY); localStorage.removeItem(MAP_KEY); location.reload(); } return; }
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
  <div style="font-size:12px;opacity:.75">Top: thing to smelt (iron ore, grave jewelry → bars, raw meat, sand, cobblestone, potato, log). Bottom: fuel (coal, logs, planks, sticks).</div>
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
    <div class="row"><span class="nm">🖼️ Texture pack<br><span style="font-size:12px;opacity:.7">HD 64x textures or the Original 16x look. Switches instantly.</span></span><button class="btn ${settings.hdTex !== false ? 'gold' : ''}" data-tex="1">HD</button><button class="btn ${settings.hdTex === false ? 'gold' : ''}" data-tex="0">Original</button></div>
    <div class="row" style="flex-wrap:wrap"><span class="nm">🔭 Render distance<br><span style="font-size:12px;opacity:.7">How far you can see. Lower is faster on older phones.</span></span>${[[2, 'Tiny'], [3, 'Short'], [4, 'Normal'], [6, 'Far'], [8, 'Extreme']].map(([v, n]) => `<button class="btn ${VIEW === v ? 'gold' : ''}" data-view="${v}">${n}</button>`).join('')}</div>
    ${tog('view3', '👁 Third-person view', 'See your own character from behind (V key or 👁 button)')}
    <div class="row"><span class="nm">☁️ Cloud save<br><span style="font-size:12px;opacity:.7">${auth ? 'Logged in as ' + esc(auth.name) + '. ' + esc(cloudStatus) : 'Log in to back up your worlds'}</span></span><button class="btn gold" data-a="cloud">${auth ? '☁️ Upload now' : '👤 Log in'}</button></div>
    <div class="row" style="flex-wrap:wrap"><span class="nm">⚔️ Difficulty<br><span style="font-size:12px;opacity:.7">${diff().sub}</span></span>${Object.entries(DIFFS).map(([k, v]) => `<button class="btn ${settings.difficulty === k ? 'gold' : ''}" data-diff="${k}">${v.label}</button>`).join('')}</div>
    <div class="row"><span class="nm">🎮 Look sensitivity</span><button class="btn" data-sens="-1">−</button><b style="min-width:40px;text-align:center">${settings.sens.toFixed(1)}</b><button class="btn" data-sens="1">+</button></div>
    <div class="row"><span class="nm">Test a jumpscare</span><button class="btn" data-a="test" ${settings.jumpscares ? '' : 'disabled'}>Scare me</button></div>`;
}
document.getElementById('setBox').addEventListener('click', e => {
  const b = e.target.closest('[data-s],[data-a],[data-sens],[data-diff],[data-tex],[data-view]'); if (!b) return;
  if (b.dataset.a === 'cloud') { if (auth) cloudUpload(true).then(renderSettings); else { closePanels(); openAccount(); } return; }
  if (b.dataset.view) { VIEW = +b.dataset.view; settings.view = VIEW; saveSettings(); renderSettings(); return; }
  if (b.dataset.tex) { const hd = b.dataset.tex === '1'; if (hd === (settings.hdTex !== false)) return;
    settings.hdTex = hd; saveSettings(); applyTexturePack(); renderSettings(); toast(`🖼️ ${hd ? 'HD' : 'Original'} textures on`); return; }
  if (b.dataset.diff) settings.difficulty = b.dataset.diff;
  if (b.dataset.a === 'close') { closePanels(); return; }
  if (b.dataset.a === 'test') { closePanels(); setTimeout(() => jumpscare(null, 'night'), 300); return; }
  if (b.dataset.sens) settings.sens = Math.max(0.3, Math.min(3, settings.sens + (+b.dataset.sens) * 0.1));
  if (b.dataset.s) { settings[b.dataset.s] = !settings[b.dataset.s]; if (b.dataset.s === 'sound' && master) master.gain.value = settings.sound ? 1 : 0; if (b.dataset.s === 'hdTex') applyTexturePack(); }
  saveSettings(); renderSettings();
});

const helpPC = 'WASD move · Space jump · Double-tap W (or Ctrl) to sprint · Mouse look<br>Hold left click: mine / attack · Right click: use, plant, place, open doors, trade, tame, ride<br>E: inventory & crafting · 1-9 / wheel: hotbar · P: 📱 phone · Shift: get off a horse';
const helpTouch = 'Left stick: move · Double-tap the screen while walking (or 🏃) to sprint · Drag right side: look<br>Hold ⛏️ mine / attack · ✋ use, plant, place, open doors, trade · ⬆️ jump<br>🎒 inventory & crafting · 📱 phone · 🐴 get off a horse · ⚙️ settings';
document.getElementById('helpText').innerHTML = (isTouch ? helpTouch : helpPC) + '<br><br>🪓 Punch trees for logs, craft planks, sticks and a crafting table, then make a hatchet, pickaxe and hoe. Mine cobblestone and iron to upgrade, kill cows for steak and leather armour, and survive the night: zombies, skeletons and creepers come out after dark. 🎃 Grow crops and sell to the villagers to become a Tycoon. 🛏️ Sleep in a bed to skip the night, 📱 use your phone for radio, GPS and DealerNet, 🐴 tame and ride horses, 🐺 tame wolves with bones, 🪦 dig graves with a shovel for jewelry, 💻 shop on DealerNet from a laptop, 📺📻 tap TVs and radios to change channels, and 🌐 log in to save to the cloud and play online with up to 4 friends.';
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
  const del = e.target.closest('[data-del]'); if (del) { deleteWorld(+del.dataset.del); return; }
  const w = e.target.closest('[data-w]'); if (!w || +w.dataset.w === SLOT) return;
  save(); localStorage.setItem('dealercraft_slot', w.dataset.w); saveBlocked = true; location.reload();
});
document.getElementById('worlds').addEventListener('contextmenu', e => e.preventDefault());
function deleteWorld(n) {   // our own confirm box (Android WebView can swallow confirm())
  const box = document.createElement('div'); box.className = 'wconfirm';
  box.innerHTML = `<div>Are you sure you want to <b style="color:#f44">DELETE</b> World ${n}?<br><span style="font-size:12px;opacity:.75">This can't be undone.</span></div><button class="btn" data-no>Cancel</button><button class="btn" data-yes style="background:#c22">Delete</button>`;
  box.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('[data-yes]')) reallyDelete(n); box.remove(); });
  document.getElementById('start').appendChild(box);
}
function reallyDelete(n) {
  { { localStorage.removeItem('dealercraft_map_' + n); if (n === SLOT) { saveBlocked = true; localStorage.removeItem(slotKey(n)); location.reload(); } else { localStorage.removeItem(slotKey(n)); renderWorlds(); } } }
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

// ================== ELECTRONICS: beds, laptops (DealerNet), TVs, radios ==================
function useFurn(h) {
  const b = furnBase(h.id), k = h.x + ',' + h.y + ',' + h.z;
  if (b === BED0) return useBed(h);
  if (b === LAPTOP0) { webFromPhone = false; openWeb(); beep(660, 0.05, 'sine', 0.05); return; }
  if (b === TV0) { const n = ((state.dev[k] || 0) + 1) % (TV_CH.length + 1); if (n) state.dev[k] = n; else delete state.dev[k]; tvStatic = 0.35; toast(n ? `📺 Channel ${n}: ${TV_CH[n - 1]}` : '📺 TV off'); beep(n ? 900 : 300, 0.05, 'square', 0.04); swing(); return; }
  if (b === RADIO0) { const n = ((state.dev[k] || 0) + 1) % (STATIONS.length + 1); if (n) state.dev[k] = n; else delete state.dev[k]; toast(n ? `📻 ${STATIONS[n - 1].name}` : '📻 Radio off'); beep(n ? 700 : 250, 0.04, 'sine', 0.05); swing(); return; }
}

// ---------- beds: sleep through the night (online, everyone must be in bed) ----------
const sleepEl = document.createElement('div'); sleepEl.id = 'sleepFade'; document.body.appendChild(sleepEl);
const sleepMsg = document.createElement('div'); sleepMsg.id = 'sleepMsg'; sleepEl.appendChild(sleepMsg);
const canSleep = () => { const f = (state.time % DAY) / DAY; return f > 0.72 || f < 0.02; };
function useBed(h) {
  state.spawn = [h.x, h.y, h.z];
  if (!canSleep()) { toast('🛏️ Spawn point set. You can only sleep at night'); return; }
  if (player.car) return;
  player.sleeping = { x: h.x, y: h.y, z: h.z, t: 0 };
  player.pos.set(h.x + 0.5, h.y + 0.2, h.z + 0.5); player.vel.set(0, 0, 0);
  sleepEl.classList.add('on'); sleepMsg.textContent = '💤 Sleeping...'; holdBreak = false;
}
function wakeUp(morning) {
  if (!player.sleeping) return; const s = player.sleeping; player.sleeping = null;
  sleepEl.classList.remove('on');
  player.pos.set(s.x + 0.5, s.y + 1, s.z + 0.5); if (collides(player.pos)) player.pos.y = groundAt(player.pos.x, player.pos.z);
  if (morning) toast('☀️ Good morning!');
}
function skipToMorning() {   // jump to the next sunrise; crops keep growing through the night
  const f = (state.time % DAY) / DAY, day0 = Math.floor(state.time / DAY) * DAY;
  const target = (f < 0.02 ? day0 : day0 + DAY) + DAY * 0.02, dt = Math.max(0, target - state.time);
  state.time += dt; state.gameTime += dt; return dt;
}
function updateSleep(dt) {
  const s = player.sleeping; if (!s) return;
  if (keys.Space || wantJump || !isFurn(get(s.x, s.y, s.z))) { wakeUp(false); return; }
  s.t += dt;
  if (!canSleep()) { wakeUp(true); return; }
  if (net.on && net.count() > 1) { const [a, n] = net.sleepers(); sleepMsg.textContent = `💤 Waiting for everyone to sleep (${a}/${n})`; return; }
  if (s.t > 2.6) { skipToMorning(); wakeUp(true); }
}

// ---------- item values for the DealerNet web shop ----------
const RAW_VALUE = { dirt: 1, cobble: 1, sand: 1, stone: 2, log: 2, leaves: 1, coal_ore: 3, iron_ore: 6, coal: 3, stick: 1, bone: 3, gunpowder: 6,
  arrow: 2, rotten_flesh: 1, feather: 2, wool: 4, egg: 2, raw_beef: 4, raw_chicken: 3, raw_pork: 4, raw_mutton: 3, leather: 6, candy: 4, cow_poop: 2,
  seeds_wheat: 2, seeds_carrot: 3, seeds_potato: 3, seeds_berries: 4, seeds_pumpkin: 6, seeds_weed: 18, water_bucket: 40, asphalt: 2, concrete: 2,
  roof_tiles: 2, lamp: 8, white_wall: 3, blue_siding: 3, yellow_siding: 3, jack_o_lantern: 20, pumpkin_block: 16,
  tombstone: 4, grave_dirt: 2, raw_bear: 6, raw_goat: 4, apple: 2 };
const valCache = {};
function itemValue(id, depth = 0) {
  if (valCache[id] != null) return valCache[id];
  let v = 0;
  for (const vl of VILLAGERS) { if (vl.buys[id]) v = Math.max(v, vl.buys[id]); }
  if (!v) for (const vl of VILLAGERS) if (vl.sells[id]) v = v ? Math.min(v, vl.sells[id] * 0.7) : vl.sells[id] * 0.7;
  if (!v && RAW_VALUE[id]) v = RAW_VALUE[id];
  if (!v && depth < 6) {
    for (const r of RECIPES) { if (r.out !== id) continue;
      const ing = r.items || r.rows.join('').split('').filter(c => c !== '.').map(c => r.key[c]);
      let s = 0; for (const x of ing) s += itemValue(x, depth + 1); s = s * 1.15 / r.n;
      if (s > 0 && (!v || s < v)) v = s; }
    if (!v) for (const [inp, out] of Object.entries(SMELT)) if (out === id) { const s = itemValue(inp, depth + 1) + 1; if (!v || s < v) v = s; }
  }
  if (!v) v = 3;
  if (depth === 0) valCache[id] = v;
  return v;
}
const webBuy = id => Math.max(2, Math.ceil(itemValue(id) * 1.5));
const webSell = id => Math.max(1, Math.floor(itemValue(id) * 0.8));
const WEB_CATS = { all: '🌐 All', blocks: '🧱 Blocks', tools: '⛏️ Tools & Armor', food: '🍔 Food', farm: '🌱 Farming', tech: '💻 Electronics', other: '📦 Other' };
function webCat(id) { const it = ITEMS[id]; if (it.furn != null) return 'tech'; if (it.tool || it.armor) return 'tools'; if (it.block != null) return 'blocks'; if (it.food) return 'food'; if (it.crop || CROP_ITEM[id] || id === 'fertilizer' || id === 'cow_poop' || id === 'weed') return 'farm'; return 'other'; }
let webTab = 'buy', webQ = '', webC = 'all';
const webEl = document.createElement('div'); webEl.className = 'panel'; webEl.id = 'web'; webEl.innerHTML = '<div class="box webbox" id="webBox"></div>'; document.body.appendChild(webEl);
function openWeb() { webTab = 'buy'; renderWeb(); openPanel('web'); }
function renderWeb(keepList) {
  const ids = Object.keys(ITEMS).filter(id => (webC === 'all' || webCat(id) === webC) && ITEMS[id].name.toLowerCase().includes(webQ.toLowerCase()) && (webTab === 'buy' || count(id) > 0));
  const rows = ids.map(id => {
    const p = webTab === 'buy' ? webBuy(id) : webSell(id), have = count(id), one = stackOf(id) === 1;
    const btns = webTab === 'buy'
      ? `<button class="btn" data-wb="${id}" data-n="1" ${state.coins >= p ? '' : 'disabled'}>Buy</button>${one ? '' : `<button class="btn gold" data-wb="${id}" data-n="10" ${state.coins >= p * 10 ? '' : 'disabled'}>×10</button>`}`
      : `<button class="btn" data-ws="${id}" data-n="1">Sell 1</button><button class="btn gold" data-ws="${id}" data-n="all">All ${have}</button>`;
    return `<div class="row"><span class="ic">${iconHTML(id)}</span><span class="nm">${ITEMS[id].name}${have ? ` <span style="opacity:.6">(have ${have})</span>` : ''}</span><span class="pr">💰 ${p}</span>${btns}</div>`;
  }).join('') || `<div style="opacity:.7;padding:18px;text-align:center">${webTab === 'buy' ? 'No items match your search.' : 'Nothing to sell here. Your matching items will show up in this list.'}</div>`;
  const box = (webFromPhone && document.getElementById('pWebBox')) || document.getElementById('webBox');   // phone browser renders inside the phone screen
  if (keepList && box.querySelector('#webList')) { box.querySelector('#webList').innerHTML = rows; box.querySelector('#webBal').textContent = '💰 ' + state.coins; return; }
  box.innerHTML = `<div class="wbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${webFromPhone ? '📱 ' : ''}🔒 https://dealernet.dc/${webTab === 'buy' ? 'shop' : 'sell'}</span><button class="btn close" data-a="close">✕</button></div>
    <div class="whead"><b>Dealer<span>Net</span></b><span class="wsub">Buy &amp; sell anything, delivered instantly to your bag</span><span id="webBal" class="wbal">💰 ${state.coins}</span></div>
    <div class="wtabs"><button class="btn ${webTab === 'buy' ? 'gold' : ''}" data-wt="buy">🛒 Buy</button><button class="btn ${webTab === 'sell' ? 'gold' : ''}" data-wt="sell">💰 Sell</button><input id="webQ" placeholder="🔍 Search DealerNet..." value="${webQ.replace(/"/g, '')}"></div>
    <div class="wcats">${Object.entries(WEB_CATS).map(([k, v]) => `<button class="chip ${webC === k ? 'on' : ''}" data-wc="${k}">${v}</button>`).join('')}</div>
    <div id="webList">${rows}</div>`;
  const q = box.querySelector('#webQ'); q.addEventListener('input', () => { webQ = q.value; renderWeb(true); });
}
webEl.addEventListener('click', e => webClick(e, webEl));
function webClick(e, root) {
  const back = () => { if (root !== webEl) { webFromPhone = false; phoneApp = 'home'; renderPhone(); } else closePanels(); };
  const b = e.target.closest('[data-a],[data-wt],[data-wc],[data-wb],[data-ws]'); if (!b) { if (e.target === root) back(); return; }
  if (b.dataset.a === 'close') { back(); return; }
  if (b.dataset.wt) { webTab = b.dataset.wt; renderWeb(); return; }
  if (b.dataset.wc) { webC = b.dataset.wc; renderWeb(); return; }
  if (b.dataset.wb) { const id = b.dataset.wb, n = +b.dataset.n, p = webBuy(id) * n; if (state.coins < p) return; const left = give(id, n); const got = n - left; state.coins -= webBuy(id) * got; if (got) { coinSnd(); toast(`📦 DealerNet delivered ${got} ${ITEMS[id].name}`); } }
  if (b.dataset.ws) { const id = b.dataset.ws, have = count(id), n = b.dataset.n === 'all' ? have : 1; if (!n) return; take(id, n); const p = webSell(id) * n; state.coins += p; state.earned += p; coinSnd(); toast(`💸 Sold ${n} ${ITEMS[id].name} online for 💰${p}`); }
  renderWeb(true); renderStats();
}

// ---------- TVs: animated channels on the screen ----------
const TV_CH = ['DCN News', 'Toon Town', 'DC Sports', 'Weather 24/7', 'Music TV'];
const tvCanvas = TV_CH.map(() => { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t, x: c.getContext('2d') }; });
const tvMats = tvCanvas.map(o => new THREE.MeshBasicMaterial({ map: o.t, toneMapped: false }));
const staticMat = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const t = new THREE.CanvasTexture(c); return { c, t, x: c.getContext('2d'), m: new THREE.MeshBasicMaterial({ map: t }) }; })();
const tvGeo = new THREE.PlaneGeometry(0.88, 0.74);
const tvScreens = new Map(); let tvStatic = 0, tvT = 0;
const HEADLINES = ['WEED HITS 120 COINS IN THE CITY', 'COPS: CARJACKINGS ON THE RISE', 'GHOST SIGHTINGS UP 300%', 'LOCAL FARMER GROWS 3-BLOCK PLANT', 'CREEPER BLOWS UP GARAGE', 'MERCHANT MO HAS A SALE ON TORCHES', 'SKYSCRAPER WINDOWS LIGHT UP AT NIGHT', 'DEALERNET SALES BREAK RECORDS'];
function drawTV(i, t) {
  const { x, t: tex } = tvCanvas[i], W = 128, Hh = 96;
  if (i === 0) {   // news desk + ticker
    x.fillStyle = '#123a8a'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#1f56c4'; for (let k = 0; k < 6; k++) x.fillRect(k * 24 + (t * 6 % 24), 0, 10, 70);
    x.fillStyle = '#f1c27d'; x.fillRect(52, 18, 24, 24); x.fillStyle = '#2a1a0a'; x.fillRect(52, 14, 24, 7); x.fillStyle = '#111'; x.fillRect(57, 26, 4, 3); x.fillRect(67, 26, 4, 3);
    x.fillRect(60, 35 + (Math.sin(t * 14) > 0 ? 1 : 0), 8, 2); x.fillStyle = '#333'; x.fillRect(46, 42, 36, 22); x.fillStyle = '#c33'; x.fillRect(62, 42, 4, 14);
    x.fillStyle = '#8a5a2a'; x.fillRect(20, 58, 88, 14); x.fillStyle = '#c00'; x.fillRect(0, 72, W, 24); x.fillStyle = '#fff'; x.font = 'bold 11px monospace';
    const s = HEADLINES.join('  ●  '), off = (t * 40) % (s.length * 6.6 + W); x.fillText(s, W - off, 88); x.fillStyle = '#ffd84a'; x.fillRect(0, 72, 28, 10); x.fillStyle = '#000'; x.font = 'bold 8px monospace'; x.fillText('LIVE', 4, 80);
  } else if (i === 1) {   // cartoon: a bouncing blob chased by a creeper
    x.fillStyle = '#7fd0ff'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#5fbf4a'; x.fillRect(0, 70, W, 26); x.fillStyle = '#fff'; x.beginPath(); x.arc((t * 20) % 160 - 16, 18, 10, 0, 7); x.arc((t * 20) % 160, 16, 12, 0, 7); x.fill();
    const bx = 64 + Math.sin(t * 1.3) * 40, by = 62 - Math.abs(Math.sin(t * 5)) * 30;
    x.fillStyle = '#ff6ad5'; x.beginPath(); x.arc(bx, by, 9, 0, 7); x.fill(); x.fillStyle = '#000'; x.fillRect(bx - 4, by - 3, 2, 3); x.fillRect(bx + 2, by - 3, 2, 3);
    const cx = bx - 30 * Math.cos(t * 1.3); x.fillStyle = '#4caf50'; x.fillRect(cx - 6, 46, 12, 24); x.fillStyle = '#0a2a0a'; x.fillRect(cx - 4, 50, 3, 3); x.fillRect(cx + 1, 50, 3, 3); x.fillRect(cx - 1, 54, 2, 4);
  } else if (i === 2) {   // football match
    x.fillStyle = '#2e8b3a'; x.fillRect(0, 0, W, Hh); x.strokeStyle = '#fff'; x.lineWidth = 1; x.strokeRect(6, 14, W - 12, Hh - 20); x.beginPath(); x.moveTo(64, 14); x.lineTo(64, Hh - 6); x.stroke(); x.beginPath(); x.arc(64, 55, 12, 0, 7); x.stroke();
    const ballX = 64 + Math.sin(t * 0.9) * 50, ballY = 55 + Math.sin(t * 1.7) * 25; for (let p = 0; p < 8; p++) { x.fillStyle = p < 4 ? '#d22' : '#22d'; x.fillRect(ballX + Math.sin(t + p * 2) * (20 + p * 4) - 2, ballY + Math.cos(t * 0.8 + p) * 18 - 3, 4, 6); }
    x.fillStyle = '#fff'; x.fillRect(ballX - 2, ballY - 2, 4, 4); x.fillStyle = '#000'; x.fillRect(0, 0, W, 12); x.fillStyle = '#fff'; x.font = 'bold 9px monospace'; x.fillText(`RED ${Math.floor(t / 20) % 5}  -  ${Math.floor(t / 33) % 4} BLU`, 22, 9);
  } else if (i === 3) {   // weather map
    x.fillStyle = '#1a2a4a'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#3a8a3a'; x.beginPath(); x.moveTo(10, 30); x.lineTo(60, 18); x.lineTo(110, 28); x.lineTo(118, 70); x.lineTo(70, 84); x.lineTo(14, 72); x.fill();
    x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(38, 44, 9, 0, 7); x.fill(); x.fillStyle = '#ddd'; x.beginPath(); x.arc(84 + Math.sin(t) * 4, 46, 9, 0, 7); x.arc(94 + Math.sin(t) * 4, 44, 11, 0, 7); x.fill();
    x.fillStyle = '#7ad'; for (let d = 0; d < 6; d++) x.fillRect(82 + d * 4, 58 + ((t * 30 + d * 7) % 12), 1, 3);
    x.fillStyle = '#fff'; x.font = 'bold 10px monospace'; x.fillText('72°', 30, 64); x.fillText('58°', 84, 76); x.fillStyle = '#000a'; x.fillRect(0, 84, W, 12); x.fillStyle = '#ffd84a'; x.font = 'bold 8px monospace'; x.fillText('TONIGHT: ZOMBIES 90%  CREEPERS 40%', 2, 93);
  } else {   // music video equalizer
    x.fillStyle = '#12001f'; x.fillRect(0, 0, W, Hh);
    for (let b = 0; b < 16; b++) { const hgt = 10 + Math.abs(Math.sin(t * (3 + b * 0.37) + b)) * 60; x.fillStyle = `hsl(${(b * 22 + t * 60) % 360},90%,60%)`; x.fillRect(4 + b * 7.6, 84 - hgt, 6, hgt); }
    x.fillStyle = '#fff'; x.font = 'bold 9px monospace'; x.fillText('♪ NOW PLAYING: DC BEATS', 8, 94);
  }
  tex.needsUpdate = true;
}
function updateTVs(dt) {
  tvT += dt; if (tvT < 0.1) return; const step = tvT; tvT = 0; tvStatic = Math.max(0, tvStatic - step);
  const want = new Map(), px = player.pos.x, pz = player.pos.z;
  for (const k in state.dev) { const [x, y, z] = k.split(',').map(Number); if (Math.abs(x - px) > 40 || Math.abs(z - pz) > 40) continue; const id = get(x, y, z); if (furnBase(id) === TV0) want.set(k, [x, y, z, furnF(id), state.dev[k]]); }
  for (const [k, m] of tvScreens) if (!want.has(k) || m.userData.f !== want.get(k)[3]) { scene.remove(m); tvScreens.delete(k); }
  const used = new Set(), t = performance.now() / 1000;
  for (const [k, [x, y, z, f, ch]] of want) {
    let m = tvScreens.get(k);
    if (!m) { m = new THREE.Mesh(tvGeo, tvMats[0]); m.userData.f = f; const cx = 0.5, cz = 0.568, r = f === 0 ? [cx, cz] : f === 1 ? [cz, 1 - cx] : f === 2 ? [1 - cx, 1 - cz] : [1 - cz, cx];
      m.position.set(x + r[0], y + 0.55, z + r[1]); m.rotation.y = f * Math.PI / 2; scene.add(m); tvScreens.set(k, m); }
    m.material = tvStatic > 0 ? staticMat.m : tvMats[ch - 1]; used.add(ch - 1);
  }
  if (tvStatic > 0) { const { x, t: tx } = staticMat; const img = x.createImageData(64, 48); for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } x.putImageData(img, 0, 0); tx.needsUpdate = true; }
  for (const i of used) drawTV(i, t);
}

// ---------- radios: six stations of generated music, louder the closer you are ----------
const STATIONS = [
  { name: '88.1 Lo-Fi Chill', bpm: 78, swing: 0.2, root: 50, scale: [0, 3, 5, 7, 10], prog: [[0, [0, 3, 7, 10, 14]], [5, [0, 3, 7, 10]], [8, [0, 4, 7, 11]], [7, [0, 4, 7, 10]]],
    k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', b: 'x.......x.....o.', c: 'x...............', bass: 'sine', chord: 'pad', lead: 'keys', dens: 0.22, crackle: true, vol: 0.9 },
  { name: '94.5 Rock Radio', bpm: 132, swing: 0, root: 40, scale: [0, 3, 5, 7, 10], prog: [[0, [0, 7, 12]], [-4, [0, 7, 12]], [3, [0, 7, 12]], [-2, [0, 7, 12]]],
    k: 'x...x.x.x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', b: 'x.x.x.x.x.x.x.x.', c: 'x.xxx.x.x.xxx.x.', bass: 'rockbass', chord: 'guitar', lead: 'solo', dens: 0.3, crash: true, vol: 0.75 },
  { name: '98.7 Hip-Hop Hits', bpm: 90, swing: 0.12, root: 48, scale: [0, 3, 5, 7, 10], prog: [[0, [0, 3, 7]], [-4, [0, 4, 7]], [5, [0, 3, 7]], [7, [0, 3, 7]]],
    k: 'x.....x...x..x..', s: '....x.......x...', h: 'x.xxx.x.x.xxx.xx', b: 'x.....x...x.....', c: '..x.......x.....', bass: '808', chord: 'piano', lead: 'bell', dens: 0.18, vol: 1 },
  { name: '101.3 Chiptune FM', bpm: 150, swing: 0, root: 57, scale: [0, 2, 4, 7, 9], prog: [[0, [0, 4, 7]], [-3, [0, 3, 7]], [5, [0, 4, 7]], [7, [0, 4, 7]]],
    k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', b: 'x.o.x.o.x.o.x.o.', c: 'xxxxxxxxxxxxxxxx', bass: 'tri', chord: 'arp', lead: 'square', dens: 0.6, vol: 0.55 },
  { name: '104.9 Country Roads', bpm: 112, swing: 0.15, root: 43, scale: [0, 2, 4, 7, 9], prog: [[0, [0, 4, 7]], [5, [0, 4, 7]], [7, [0, 4, 7]], [0, [0, 4, 7]]],
    k: 'x.......x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', b: 'x...o...x...o...', c: '....x.......x...', bass: 'tri', chord: 'strum', lead: 'pluck', dens: 0.35, vol: 0.8 },
  { name: '107.7 Techno Club', bpm: 128, swing: 0, root: 45, scale: [0, 3, 5, 7, 10], prog: [[0, [0, 3, 7]], [0, [0, 3, 7]], [-2, [0, 4, 7]], [0, [0, 3, 7]]],
    k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', b: 'xxoxxoxxoxxoxxox', c: '...x.....x......', bass: 'acid', chord: 'stab', lead: null, dens: 0, vol: 0.7 },
];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let radioBus = null, radioSt = -1, radioStep = 0, radioNext = 0, radioBar = 0, radioRng = mulberry(7), leadNote = 0;
let distCurve = null;
function rVoice(type, freq, t, dur, vol, o = {}) {
  const osc = AC.createOscillator(), g = AC.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, t);
  if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur * 0.6);
  if (o.det) osc.detune.value = o.det;
  const a = o.a || 0.005; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * (o.sus || 0.3)), t + a + (o.dec || dur * 0.5)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.cut) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.cut, t); if (o.cut2) f.frequency.exponentialRampToValueAtTime(o.cut2, t + dur); node.connect(f); node = f; }
  if (o.dist) { if (!distCurve) { distCurve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; distCurve[i] = Math.tanh(x * 5); } } const w = AC.createWaveShaper(); w.curve = distCurve; node.connect(w); node = w; }
  node.connect(g).connect(radioBus); osc.start(t); osc.stop(t + dur + 0.05);
}
function rNoise(t, dur, vol, type, freq, q = 1) {
  const b = AC.createBuffer(1, Math.ceil(AC.sampleRate * dur), AC.sampleRate), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(radioBus); s.start(t);
}
function playStep(S, step, t, sd) {
  const bar = radioBar % S.prog.length, [off, chord] = S.prog[bar], root = S.root + off, v = S.vol;
  const on = (p) => p[step] && p[step] !== '.';
  if (on(S.k)) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(S.bass === '808' ? 120 : 150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32); o.connect(g).connect(radioBus); o.start(t); o.stop(t + 0.35); }
  if (on(S.s)) { rNoise(t, S.chord === 'pad' ? 0.18 : 0.14, 0.35 * v, 'bandpass', S.chord === 'pad' ? 1800 : 2600, 0.8); rVoice('triangle', 190, t, 0.08, 0.2 * v); }
  if (on(S.h)) rNoise(t, step % 4 === 2 && S.bass === 'acid' ? 0.12 : 0.04, (S.chord === 'pad' ? 0.06 : 0.12) * v, 'highpass', 7500);
  if (S.crash && step === 0 && radioBar % 4 === 0) rNoise(t, 1.2, 0.18 * v, 'highpass', 5000);
  if (S.crackle && Math.random() < 0.5) rNoise(t + Math.random() * sd, 0.01, 0.04, 'highpass', 3000);
  if (on(S.b)) {
    const n = root - 12 + (S.b[step] === 'o' ? 7 : 0), f = mtof(n);
    if (S.bass === 'sine') rVoice('sine', f, t, sd * 6, 0.45 * v, { a: 0.02, sus: 0.6 });
    else if (S.bass === '808') rVoice('sine', f * 1.5, t, sd * 6, 0.6 * v, { glide: f, sus: 0.7, dec: sd * 4 });
    else if (S.bass === 'rockbass') rVoice('sawtooth', f, t, sd * 1.8, 0.28 * v, { cut: 700 });
    else if (S.bass === 'acid') rVoice('sawtooth', f * (step % 7 === 3 ? 2 : 1), t, sd * 0.95, 0.25 * v, { cut: 300 + 1700 * (0.5 + 0.5 * Math.sin(radioBar * 0.7 + step * 0.4)), cut2: 200, q: 12 });
    else rVoice('triangle', f, t, sd * 3, 0.4 * v, { sus: 0.5 });
  }
  if (on(S.c)) {
    const notes = chord.map(i => root + i);
    if (S.chord === 'pad') notes.forEach((n, i) => rVoice('triangle', mtof(n + 12), t + i * 0.02, sd * 15, 0.06 * v, { a: 0.3, sus: 0.8, dec: sd * 6, det: (i % 2 ? 6 : -6) }));
    else if (S.chord === 'guitar') notes.forEach(n => rVoice('sawtooth', mtof(n + 12), t, sd * 0.9, 0.09 * v, { dist: true, cut: 2600, sus: 0.6 }));
    else if (S.chord === 'piano') notes.forEach(n => rVoice('triangle', mtof(n + 12), t, sd * 5, 0.1 * v, { sus: 0.2, dec: sd * 2 }));
    else if (S.chord === 'arp') rVoice('square', mtof(notes[step % notes.length] + 12 + (step % 8 >= 4 ? 12 : 0)), t, sd * 0.9, 0.06 * v, { cut: 3200 });
    else if (S.chord === 'strum') notes.forEach((n, i) => rVoice('sawtooth', mtof(n + 12), t + i * 0.025, sd * 3, 0.06 * v, { cut: 1800, cut2: 600, sus: 0.15 }));
    else if (S.chord === 'stab') notes.forEach(n => rVoice('sawtooth', mtof(n + 12), t, sd * 1.5, 0.07 * v, { cut: 2400, cut2: 500, q: 4, sus: 0.2 }));
  }
  if (S.lead && step % 2 === 0 && radioRng() < S.dens) {
    const sc = S.scale; leadNote = Math.max(-2, Math.min(8, leadNote + Math.floor(radioRng() * 5) - 2));
    const deg = ((leadNote % sc.length) + sc.length) % sc.length, oct = Math.floor(leadNote / sc.length), f = mtof(S.root + 24 + sc[deg] + oct * 12 + (S.chord === 'pad' ? -12 : 0));
    const L = S.lead, len = sd * (radioRng() < 0.3 ? 4 : 2);
    if (L === 'keys') rVoice('sine', f, t, len * 2, 0.12 * v, { sus: 0.3, dec: len });
    else if (L === 'solo') rVoice('square', f, t, len, 0.05 * v, { dist: true, cut: 3000, sus: 0.7 });
    else if (L === 'bell') { rVoice('sine', f, t, len * 3, 0.08 * v, { sus: 0.1 }); rVoice('sine', f * 2.01, t, len * 2, 0.03 * v, { sus: 0.05 }); }
    else if (L === 'square') rVoice('square', f, t, len * 0.9, 0.06 * v, { sus: 0.7 });
    else if (L === 'pluck') rVoice('sawtooth', f, t, len * 1.5, 0.07 * v, { cut: 2500, cut2: 400, sus: 0.1 });
  }
}
let radioCheck = 0, radioNear = null;
function updateRadio(dt) {
  if (!AC || !master) return;
  radioCheck -= dt;
  if (radioCheck <= 0) {   // nearest playing radio within earshot
    radioCheck = 0.4; radioNear = null; let best = 24;
    for (const k in state.dev) { const [x, y, z] = k.split(',').map(Number); const d = Math.hypot(x + 0.5 - player.pos.x, y + 0.5 - player.pos.y - 1, z + 0.5 - player.pos.z); if (d < best && furnBase(get(x, y, z)) === RADIO0) { best = d; radioNear = { st: state.dev[k] - 1, d }; } }
  }
  if (phoneSt >= 0) radioNear = { st: phoneSt, d: 0, phone: true };   // the phone radio plays wherever you are
  else if (radioNear && radioNear.phone) radioNear = null;
  if (!radioBus) { radioBus = AC.createGain(); radioBus.gain.value = 0; radioBus.connect(master); }
  const vol = radioNear && playing ? (radioNear.phone ? 0.5 * phoneVol : 0.5 * Math.max(0, 1 - radioNear.d / 24) ** 1.3) : 0;
  radioBus.gain.setTargetAtTime(vol, AC.currentTime, 0.15);
  if (!radioNear || !playing) { radioSt = -1; return; }
  if (radioNear.st !== radioSt) { radioSt = radioNear.st; radioStep = 0; radioBar = 0; radioNext = AC.currentTime + 0.05; radioRng = mulberry(radioSt * 977 + 3); }
  const S = STATIONS[radioSt]; if (!S) return; const sd = 60 / S.bpm / 4;
  if (radioNext < AC.currentTime - 0.3) radioNext = AC.currentTime + 0.05;
  while (radioNext < AC.currentTime + 0.18) {
    const len = sd * (radioStep % 2 === 0 ? 1 + S.swing : 1 - S.swing);
    try { playStep(S, radioStep, radioNext, sd); } catch (e) {}
    radioNext += len; radioStep++; if (radioStep >= 16) { radioStep = 0; radioBar++; }
  }
}

// ================== v1.09: WILD ANIMALS, PETS, HORSES ==================
// passive herds, predators that hunt, tameable wolves/dogs/cats, rideable horses, flying bird flocks, leashed town pets
Object.assign(MOBDEF, {
  horse:   { hp: 22, w: 0.45, h: 1.7, speed: 1.4, animal: true, quad: true, ai: true, wild: true, hitX: 0.45, drops: () => [['leather', rint(0, 2)]] },
  zebra:   { hp: 18, w: 0.45, h: 1.6, speed: 1.5, animal: true, quad: true, ai: true, wild: true, hitX: 0.45, drops: () => [['leather', rint(0, 2)]] },
  giraffe: { hp: 26, w: 0.5, h: 2.2, speed: 1.2, animal: true, quad: true, ai: true, wild: true, hitX: 0.45, hitH: 4.3, drops: () => [['leather', rint(1, 2)]] },
  goat:    { hp: 10, w: 0.3, h: 1.1, speed: 1.2, animal: true, quad: true, ai: true, wild: true, hitX: 0.25, drops: () => [['raw_goat', rint(1, 2)], ['leather', rint(0, 1)]] },
  bear:    { hp: 30, w: 0.5, h: 1.4, speed: 1.2, run: 4.6, dmg: 5, animal: true, quad: true, ai: true, wild: true, predator: true, hitX: 0.5, drops: () => [['raw_bear', rint(1, 3)], ['leather', rint(0, 2)]] },
  wolf:    { hp: 10, w: 0.3, h: 0.9, speed: 1.6, run: 5.2, dmg: 3, bite: 4, animal: true, quad: true, ai: true, wild: true, predator: true, pack: true, prey: ['sheep'], tameWith: 'bone', hitX: 0.25, drops: () => [['bone', rint(0, 1)]] },
  tiger:   { hp: 26, w: 0.4, h: 1.2, speed: 1.3, run: 5.4, dmg: 6, bite: 6, animal: true, quad: true, ai: true, wild: true, predator: true, prey: ['goat', 'zebra'], hitX: 0.5, drops: () => [['leather', rint(0, 2)]] },
  cheetah: { hp: 14, w: 0.3, h: 1.1, speed: 2.0, run: 9, dmg: 3, bite: 4, animal: true, quad: true, ai: true, wild: true, predator: true, prey: ['zebra'], hitX: 0.4, drops: () => [['leather', rint(0, 1)]] },
  cat:     { hp: 6, w: 0.2, h: 0.6, speed: 1.3, animal: true, quad: true, ai: true, tameWith: 'raw_chicken', hitX: 0.12, drops: () => [] },
  dog:     { hp: 10, w: 0.25, h: 0.8, speed: 1.5, bite: 3, animal: true, quad: true, ai: true, tameWith: 'bone', hitX: 0.2, drops: () => [] },
  lizard:  { hp: 3, w: 0.15, h: 0.25, speed: 2.6, animal: true, quad: true, ai: true, wild: true, hitX: 0.15, drops: () => [] },
  bird:    { hp: 3, w: 0.15, h: 0.3, speed: 4, animal: true, ai: true, wild: true, fly: true, hitX: 0.2, drops: () => [['feather', rint(1, 2)]] },
});
const MOB_NAMES = { cow: '🐄 Cow', pig: '🐖 Pig', sheep: '🐑 Sheep', chicken: '🐔 Chicken', horse: '🐴 Horse', zebra: '🦓 Zebra', giraffe: '🦒 Giraffe', goat: '🐐 Goat', bear: '🐻 Bear', wolf: '🐺 Wolf',
  tiger: '🐅 Tiger', cheetah: '🐆 Cheetah', cat: '🐈 Cat', dog: '🐕 Dog', lizard: '🦎 Lizard', bird: '🐦 Bird', ped: '🧍 Townsperson', cop: '👮 Cop' };
const pickV = (arr, v) => arr[((v % arr.length) + arr.length) % arr.length];
// a four-legged animal: body, head group, 4 pivoting legs (front-left, front-right, back-left, back-right)
function quadBody(g, o) {
  const legs = [];
  box(o.bw, o.bh, o.bl, o.col, 0, o.by, 0, g);
  const head = new THREE.Group(); head.position.set(0, o.hy, Math.min(o.hz, o.bl / 2 + o.hd * 0.2 - 0.03)); g.add(head);   // back of the head always overlaps the body
  box(o.hw, o.hh, o.hd, o.hcol || o.col, 0, 0, o.hd * 0.3, head);
  const ex = o.hw * 0.3, ez = o.hd * 0.8 + 0.01;
  for (const s of [-1, 1]) box(0.05, 0.05, 0.02, 0x111111, s * ex, o.hh * 0.15, ez, head);
  const lx = o.bw / 2 - o.lw / 2, lz = o.bl / 2 - o.lw / 2 - 0.04;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) legs.push(pivotLimb(g, o.lw, o.lh, o.lw, o.lcol || o.col, sx * lx, o.lh, sz * lz));
  return { legs, head };
}
// a tail hinged at the body's back edge, angled up (+ang) or down (-ang)
function tailPivot(g, w, len, col, y, z, ang) { const t = new THREE.Group(); t.position.set(0, y, z); t.rotation.x = ang; g.add(t); box(w, w, len, col, 0, 0, -len / 2 + w * 0.5, t); return t; }
function stripes(g, n, w, h, l, y, col, z0 = 0, thick = 0.07) { for (let i = 0; i < n; i++) { const z = z0 - l / 2 + (i + 0.5) * l / n; box(w + 0.02, h * 0.7, thick, col, 0, y + h * 0.15, z, g); } }
function spots(g, n, w, h, l, y, col, rnd) { for (let i = 0; i < n; i++) { const side = rnd() < 0.5 ? -1 : 1, top = rnd() < 0.35;
  const s = 0.06 + rnd() * 0.06; if (top) box(s, 0.02, s, col, (rnd() - .5) * w * 0.8, y + h / 2 + 0.005, (rnd() - .5) * l * 0.9, g);
  else box(0.02, s, s, col, side * (w / 2 + 0.005), y + (rnd() - .5) * h * 0.7, (rnd() - .5) * l * 0.9, g); } }
function buildWild(type, v) {
  const g = new THREE.Group(), rnd = mulberry((v + 1) * 7919), arms = [];
  if (type === 'horse' || type === 'zebra') {
    const zeb = type === 'zebra', col = zeb ? 0xf2f2f2 : pickV([0x7a4a24, 0x5a3418, 0xe8e2d4, 0x2a2420, 0x9a7a5a, 0xc89a5a], v);
    const legs = []; box(0.7, 0.68, 1.5, col, 0, 1.24, 0, g);
    if (zeb) stripes(g, 7, 0.7, 0.68, 1.5, 1.24 - 0.34, 0x151515);
    const neck = new THREE.Group(); neck.position.set(0, 1.45, 0.62); neck.rotation.x = 0.55; g.add(neck);
    box(0.32, 0.95, 0.42, col, 0, 0.4, 0, neck); box(0.08, 0.95, 0.3, zeb ? 0x111111 : 0x2a1a10, 0, 0.45, -0.18, neck);   // mane
    if (zeb) for (let i = 0; i < 4; i++) box(0.34, 0.06, 0.44, 0x151515, 0, 0.1 + i * 0.22, 0, neck);
    const hd = new THREE.Group(); hd.position.set(0, 0.88, 0.05); hd.rotation.x = -1.1; neck.add(hd);
    box(0.34, 0.34, 0.72, col, 0, 0, 0.25, hd); box(0.3, 0.3, 0.12, zeb ? 0x222222 : 0x3a2a20, 0, -0.02, 0.62, hd);
    for (const s of [-1, 1]) { box(0.05, 0.05, 0.02, 0x111111, s * 0.18, 0.06, 0.2, hd); box(0.08, 0.16, 0.06, col, s * 0.11, 0.24, -0.05, hd); }
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = pivotLimb(g, 0.2, 0.92, 0.2, col, sx * 0.24, 0.92, sz * 0.6); legs.push(l); box(0.22, 0.14, 0.22, zeb ? 0x111111 : 0x2a1a10, 0, -0.85, 0, l); if (zeb) for (let i = 0; i < 3; i++) box(0.22, 0.05, 0.22, 0x151515, 0, -0.2 - i * 0.2, 0, l); }
    const tail = box(0.12, 0.7, 0.12, zeb ? 0x111111 : 0x2a1a10, 0, 1.1, -0.82, g); tail.rotation.x = 0.35;
    let saddle = null;
    if (!zeb) { saddle = new THREE.Group(); g.add(saddle); box(0.74, 0.08, 0.6, 0x6a3a18, 0, 1.6, 0.05, saddle); box(0.76, 0.3, 0.06, 0x4a2a10, 0, 1.45, 0.05, saddle); box(0.3, 0.12, 0.1, 0x6a3a18, 0, 1.68, 0.3, saddle); saddle.visible = false; }
    return { g, legs, arms, head: neck, saddle };
  }
  if (type === 'giraffe') {
    const col = 0xe2b45a, legs = []; box(0.8, 0.8, 1.3, col, 0, 1.85, 0, g); spots(g, 26, 0.8, 0.8, 1.3, 1.85, 0x7a4a1c, rnd);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = pivotLimb(g, 0.18, 1.48, 0.18, col, sx * 0.28, 1.48, sz * 0.5); legs.push(l); box(0.2, 0.12, 0.2, 0x3a2a1a, 0, -1.42, 0, l); }
    const neck = new THREE.Group(); neck.position.set(0, 2.1, 0.5); neck.rotation.x = 0.25; g.add(neck);
    box(0.3, 1.7, 0.3, col, 0, 0.85, 0, neck); spots(neck, 10, 0.3, 1.7, 0.3, 0.85, 0x7a4a1c, rnd);
    const hd = new THREE.Group(); hd.position.set(0, 1.75, 0.1); neck.add(hd); box(0.3, 0.28, 0.55, col, 0, 0, 0.12, hd); box(0.24, 0.2, 0.12, 0xb0884a, 0, -0.04, 0.42, hd);
    for (const s of [-1, 1]) { box(0.05, 0.05, 0.02, 0x111111, s * 0.16, 0.05, 0.15, hd); box(0.05, 0.18, 0.05, 0x7a4a1c, s * 0.08, 0.22, -0.05, hd); }
    return { g, legs, arms, head: neck };
  }
  if (type === 'bear') {
    const col = pickV([0x5a3a20, 0x4a2c16, 0x222222, 0x6a4a2a], v), q = quadBody(g, { bw: 0.9, bh: 0.85, bl: 1.4, col, by: 0.95, hy: 1.1, hz: 0.85, hw: 0.56, hh: 0.5, hd: 0.5, lw: 0.3, lh: 0.58 });
    box(0.3, 0.22, 0.2, 0xb08a60, 0, -0.08, 0.4, q.head); box(0.1, 0.07, 0.04, 0x111111, 0, -0.02, 0.5, q.head);
    for (const s of [-1, 1]) box(0.14, 0.14, 0.08, col, s * 0.22, 0.3, 0.05, q.head);
    return { g, ...q, arms };
  }
  if (type === 'wolf' || type === 'dog') {
    const dog = type === 'dog', col = dog ? pickV([0x9a6a3a, 0xd8b06a, 0x222222, 0xeeeeee, 0x6a4a2a, 0xb07a40], v) : pickV([0xb8b8b8, 0xa0a0a6, 0xd0d0d0, 0x8a8a90], v);
    const s = dog ? 0.85 : 1, q = quadBody(g, { bw: 0.4 * s, bh: 0.4 * s, bl: 0.82 * s, col, by: 0.62 * s, hy: 0.8 * s, hz: 0.5 * s, hw: 0.36 * s, hh: 0.34 * s, hd: 0.32 * s, lw: 0.13 * s, lh: 0.45 * s });
    box(0.18 * s, 0.14 * s, 0.2 * s, dog ? 0x3a2a1a : 0x6a6a6a, 0, -0.07 * s, 0.3 * s, q.head);
    for (const e of [-1, 1]) { const ear = box(0.09 * s, dog ? 0.16 * s : 0.13 * s, 0.05 * s, dog ? 0x5a3a20 : col, e * 0.12 * s, dog ? 0.08 * s : 0.22 * s, 0.02, q.head); if (dog) { ear.position.x = e * 0.2 * s; } }
    if (!dog) box(0.44 * s, 0.2 * s, 0.3 * s, 0xc8c8c8, 0, 0.7, 0.28, g);   // shaggy neck
    const tail = tailPivot(g, 0.1 * s, 0.45 * s, col, 0.74 * s, -0.37 * s, dog ? 0.75 : 0.35);
    const collar = box(0.39 * s, 0.07, 0.36 * s, 0xd02020, 0, -0.18 * s, 0.05, q.head); collar.visible = false;
    return { g, ...q, arms, collar, tail };
  }
  if (type === 'cat') {
    const col = pickV([0xe08a2a, 0x222222, 0x8a8a8a, 0xeeeeee, 0x9a6a3a, 0xd0b080], v), q = quadBody(g, { bw: 0.24, bh: 0.24, bl: 0.55, col, by: 0.36, hy: 0.48, hz: 0.34, hw: 0.24, hh: 0.22, hd: 0.2, lw: 0.08, lh: 0.25 });
    for (const e of [-1, 1]) box(0.06, 0.08, 0.04, col, e * 0.08, 0.14, 0.02, q.head);
    box(0.08, 0.05, 0.03, 0xf2a0b0, 0, -0.04, 0.175, q.head);   // nose sits on the face (front = 0.8 x head depth)
    const tail = tailPivot(g, 0.06, 0.5, col, 0.44, -0.25, 0.9);
    const collar = box(0.25, 0.04, 0.22, 0x2060d0, 0, -0.12, 0.04, q.head); collar.visible = false;
    return { g, ...q, arms, collar, tail };
  }
  if (type === 'tiger' || type === 'cheetah') {
    const tig = type === 'tiger', col = tig ? 0xe8781a : 0xe6c25a, sz = tig ? 1 : 0.8;
    const q = quadBody(g, { bw: 0.6 * sz, bh: 0.55 * sz, bl: 1.4 * sz, col, by: tig ? 0.78 : 0.78, hy: tig ? 0.95 : 0.9, hz: 0.85 * sz, hw: 0.46 * sz, hh: 0.42 * sz, hd: 0.4 * sz, lw: 0.2 * sz, lh: tig ? 0.52 : 0.6 });
    box(0.62 * sz, 0.12, 1.2 * sz, 0xf4f0e6, 0, 0.78 - 0.26 * sz, 0, g);   // pale belly
    if (tig) { stripes(g, 8, 0.6, 0.55, 1.4, 0.78 - 0.275, 0x151515, 0, 0.06); for (let i = 0; i < 3; i++) box(0.48, 0.04, 0.06, 0x151515, 0, 0.12 - i * 0.08, 0.05 + i * 0.08, q.head); }
    else { spots(g, 34, 0.6 * sz, 0.55 * sz, 1.4 * sz, 0.78, 0x241a0a, rnd); box(0.03, 0.18, 0.02, 0x241a0a, -0.1, -0.05, 0.33, q.head); box(0.03, 0.18, 0.02, 0x241a0a, 0.1, -0.05, 0.33, q.head); }
    box(0.22 * sz, 0.14, 0.12, 0xf4f0e6, 0, -0.1, 0.32 * sz, q.head); for (const e of [-1, 1]) box(0.1, 0.1, 0.05, col, e * 0.16 * sz, 0.22 * sz, 0.02, q.head);
    const tail = box(0.08, 0.08, 0.7 * sz, col, 0, 0.82, -0.95 * sz, g); tail.rotation.x = 0.3;
    if (!tig) for (let i = 0; i < 3; i++) box(0.09, 0.09, 0.05, 0x241a0a, 0, 0, -0.18 + i * 0.18, tail);   // rings ride on the tail
    return { g, ...q, arms, tail };
  }
  if (type === 'goat') {
    const col = pickV([0xf0eee6, 0xb8b0a0, 0x7a5a3a, 0x3a3030], v), q = quadBody(g, { bw: 0.52, bh: 0.5, bl: 0.85, col, by: 0.78, hy: 1.02, hz: 0.48, hw: 0.3, hh: 0.32, hd: 0.36, lw: 0.14, lh: 0.53 });
    for (const s of [-1, 1]) { const h = box(0.06, 0.28, 0.06, 0x8a7a60, s * 0.09, 0.26, -0.05, q.head); h.rotation.x = -0.5; }
    box(0.08, 0.16, 0.06, 0xdddddd, 0, -0.22, 0.32, q.head);
    return { g, ...q, arms };
  }
  if (type === 'lizard') {
    const col = pickV([0x4caf50, 0xc8a060, 0x3a8a6a, 0x8aa040], v), legs = [];
    box(0.18, 0.08, 0.42, col, 0, 0.08, 0, g); const tail = box(0.08, 0.05, 0.4, col, 0, 0.07, -0.38, g);
    const head = new THREE.Group(); head.position.set(0, 0.09, 0.26); g.add(head); box(0.14, 0.07, 0.16, col, 0, 0, 0.04, head);
    for (const s of [-1, 1]) box(0.03, 0.03, 0.02, 0x111111, s * 0.06, 0.02, 0.1, head);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = new THREE.Group(); l.position.set(sx * 0.1, 0.08, sz * 0.14); g.add(l); box(0.12, 0.03, 0.04, col, sx * 0.05, -0.04, 0, l); legs.push(l); }
    return { g, legs, arms, head, tail };
  }
  if (type === 'bird') {
    const col = pickV([0x2a5ad0, 0xd02a2a, 0x3a3a3a, 0x8a5a2a, 0xf2c21a, 0x6aaa3a], v);
    box(0.16, 0.14, 0.3, col, 0, 0, 0, g); const head = new THREE.Group(); head.position.set(0, 0.08, 0.16); g.add(head);
    box(0.12, 0.12, 0.12, col, 0, 0, 0, head); box(0.04, 0.04, 0.08, 0xf0b020, 0, -0.01, 0.09, head);
    box(0.1, 0.03, 0.14, col, 0, 0.02, -0.2, g);
    const wings = [];
    for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.08, 0.04, 0); g.add(w); box(0.26, 0.02, 0.18, col, s * 0.13, 0, 0, w); wings.push(w); }
    return { g, legs: [], arms, head, wings };
  }
  return null;
}
// ---- what you can do with an animal by tapping ✋ on it
const hearts = m => { for (let i = 0; i < 2; i++) setTimeout(() => particles(m.g.position.x, m.g.position.y + MOBDEF[m.type].h + 0.3, m.g.position.z, new THREE.Color(1, 0.2, 0.35), 6), i * 180); };
const HORSE_FOOD = { wheat: 2, apple: 3, carrot: 2 };
function tameAnimal(m) {
  m.tamed = true; m.sit = false; m.panic = 0; m.angry = 0; m.prey = null; m.owner = null; if (m.leash) { scene.remove(m.leash); m.leash = null; }
  m.home = new THREE.Vector2(m.g.position.x, m.g.position.z); if (m.collar) m.collar.visible = true;
  m.petId = m.petId || 'p' + Math.random().toString(36).slice(2, 9);
  if (!state.pets) state.pets = []; state.pets.push({ id: m.petId, type: m.type, v: m.v, x: m.g.position.x, y: m.g.position.y, z: m.g.position.z, saddle: !!m.hasSaddle, sit: false });
  hearts(m); beep(880, 0.08, 'sine', 0.06); setTimeout(() => beep(1175, 0.12, 'sine', 0.06), 100);
}
function interactMob(m, id, it) {
  const d = MOBDEF[m.type]; if (!d) return false;
  if (m.type === 'horse') {
    if (!m.tamed) {
      if (HORSE_FOOD[id]) { useHeld(1); m.tame = (m.tame || 0) + HORSE_FOOD[id]; hearts(m); animalSnd('horse', 0.12); }
      else { m.tame = (m.tame || 0) + 1; m.vel.y = 5; m.panic = 0; particles(m.g.position.x, m.g.position.y + 1.6, m.g.position.z, new THREE.Color(0.6, 0.5, 0.4), 6); animalSnd('horse', 0.14, true); }
      m.tameNeed = m.tameNeed || rint(3, 6);
      if (m.tame >= m.tameNeed) { tameAnimal(m); toast('🐴 Tamed! Tap ✋ on it again to ride (a saddle makes it faster)'); }
      else toast(`🐴 The horse bucks! Keep trying or feed it wheat/apples (${m.tame}/${m.tameNeed})`);
      swing(); return true;
    }
    if (id === 'saddle' && !m.hasSaddle) { useHeld(1); m.hasSaddle = true; if (m.saddle) m.saddle.visible = true; syncPet(m); toast('🐴 Saddled up! Faster riding'); beep(300, 0.1, 'triangle', 0.06); swing(); return true; }
    if (HORSE_FOOD[id] && m.hp < d.hp) { useHeld(1); m.hp = Math.min(d.hp, m.hp + 4); hearts(m); return true; }
    mountHorse(m); return true;
  }
  if (m.type === 'zebra') { toast('🦓 Zebras are far too wild to ride'); return !(it && it.food); }
  if (d.tameWith) {
    if (m.owner) { toast(`That's someone's pet ${m.type}!`); return true; }
    if (m.tamed) {
      if (id === d.tameWith && m.hp < d.hp) { useHeld(1); m.hp = Math.min(d.hp, m.hp + 4); hearts(m); return true; }
      m.sit = !m.sit; m.foe = null; syncPet(m); toast(m.sit ? `🐾 Your ${m.type} sits and waits` : `🐾 Your ${m.type} follows you`); swing(); return true;
    }
    if (id === d.tameWith) {
      if (m.angry > 0) { toast(`😠 The ${m.type} is too angry right now`); return true; }
      useHeld(1); swing();
      if (Math.random() < (m.type === 'wolf' ? 0.34 : 0.45)) { tameAnimal(m); toast(`❤️ You tamed the ${m.type}! Tap ✋ to make it sit / follow`); }
      else { particles(m.g.position.x, m.g.position.y + d.h, m.g.position.z, new THREE.Color(0.4, 0.4, 0.4), 6); toast(`The ${m.type} sniffs it... try again`); }
      return true;
    }
    if (!it || !it.food) { toast(`${MOB_NAMES[m.type]}: tame it with ${ITEMS[d.tameWith].name}`); return true; }
  }
  return false;
}
function mobLabel(m) {
  const n = MOB_NAMES[m.type] || `⚔️ ${m.type[0].toUpperCase() + m.type.slice(1)}`, d = MOBDEF[m.type] || {};
  if (m.type === 'horse') return m.tamed ? `${n} · ✋ ride${m.hasSaddle ? '' : ' (saddle optional)'}` : `${n} (wild) · ✋ tame or feed wheat / apples`;
  if (m.tamed) return `${n} (yours) · ✋ ${m.sit ? 'follow' : 'sit'}`;
  if (m.owner) return `${n} on a leash`;
  if (d.tameWith) return `${n} · tame with ${ITEMS[d.tameWith].name}`;
  if (m.angry > 0) return `😠 ${n}`;
  return n;
}
// ---- riding
function mountHorse(m) {
  if (player.car || player.horse) return;
  player.horse = m; m.ridden = true; m.target = null; m.panic = 0; document.body.classList.add('riding');
  toast(isTouch ? '🐴 Riding! Stick to move, ⬆️ jump, 🐴 or ✋ to get off' : '🐴 Riding! WASD to move, Space jump, Shift / right-click to get off'); animalSnd('horse', 0.12);
}
function dismountHorse() {
  const m = player.horse; if (!m) return; player.horse = null; m.ridden = false; document.body.classList.remove('riding');
  const p = m.g.position; m.home = new THREE.Vector2(p.x, p.z); m.wait = 4; syncPet(m);
  const yaw = m.g.rotation.y;
  for (const [ox, oz] of [[Math.cos(yaw), -Math.sin(yaw)], [-Math.cos(yaw), Math.sin(yaw)], [Math.sin(yaw) * -1.5, Math.cos(yaw) * -1.5], [0, 0]]) {
    player.pos.set(p.x + ox * 1.2, Math.floor(p.y) + 0.01, p.z + oz * 1.2); let k = 0; while (collides(player.pos) && k++ < 4) player.pos.y += 1; if (!collides(player.pos)) break;
  }
  player.vel.set(0, 0, 0); player.fallStart = null;
}
function rideInput(m, d, dt) {
  if (uiOpen || !playing || !player.alive) return [0, 0, 0];
  let fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
  const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw); let mx = -sn * fwd + cs * str, mz = -cs * fwd - sn * str; const mm = Math.hypot(mx, mz);
  if (mm > 1) { mx /= mm; mz /= mm; }
  if ((keys.Space || wantJump) && m.onGround) { m.vel.y = 10; exhaust(0.05); }
  if (mm > 0.1) m.g.rotation.y = Math.atan2(mx, mz);
  return [mx, mz, (m.hasSaddle ? 9.5 : 7.5) * (player.sprint ? 1.3 : 1)];
}
function updateRider() {
  const m = player.horse; if (!m) return;
  if (!mobs.includes(m) || !player.alive) { player.horse = null; document.body.classList.remove('riding'); return; }
  const p = m.g.position; player.pos.set(p.x, p.y + 1.15, p.z); if (m.head) m.head.rotation.x = 0.95; player.vel.copy(m.vel); player.fallStart = null; player.onGround = true;
  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}
// ---- brains for the new animals; returns [mx, mz, speed] or null to just wander
const seek = (m, tx, tz, sp) => { const p = m.g.position, dx = tx - p.x, dz = tz - p.z, dd = Math.hypot(dx, dz) || 1; m.g.rotation.y = Math.atan2(dx, dz); return [dx / dd, dz / dd, sp]; };
const alive = m => m && mobs.includes(m);
function wildAI(m, d, dt, dist, t) {
  const p = m.g.position, pp = player.pos;
  if (m === player.horse) return rideInput(m, d, dt);
  if (m.owner) {   // a townsperson's leashed pet trots along behind them
    if (!alive(m.owner)) { m.owner = null; if (m.leash) { scene.remove(m.leash); m.leash = null; } return null; }
    const o = m.owner.g.position, od = Math.hypot(o.x - p.x, o.z - p.z);
    if (od > 12) { p.set(o.x - 0.8, o.y, o.z - 0.8); return [0, 0, 0]; }
    return od > 1.9 ? seek(m, o.x, o.z, Math.min(3.5, 1.4 + od * 0.5)) : [0, 0, 0];
  }
  if (m.tamed) {
    if (m.type === 'horse') return null;
    if (m.sit) { m.foe = null; return [0, 0, 0]; }
    if (!alive(m.foe)) m.foe = null;
    if (!m.foe && alive(player.lastAttacker) && !player.lastAttacker.tamed && player.lastAttacker.g.position.distanceTo(pp) < 16 && m.type !== 'cat') m.foe = player.lastAttacker;
    if (m.foe) {
      const f = m.foe.g.position, fd = p.distanceTo(f);
      if (fd > 20) { m.foe = null; return null; }
      if (fd < 1.5 && m.atk <= 0) { m.atk = 0.9; hurtMob(m.foe, d.bite || 4, p); if (!alive(m.foe)) { m.foe = null; if (player.lastAttacker && !alive(player.lastAttacker)) player.lastAttacker = null; } }
      return seek(m, f.x, f.z, 5);
    }
    if (dist > 24 && player.alive && !player.car) { const a = Math.random() * 6.28; p.set(pp.x + Math.cos(a) * 2, groundAt(pp.x + Math.cos(a) * 2, pp.z + Math.sin(a) * 2), pp.z + Math.sin(a) * 2); m.vel.set(0, 0, 0); return [0, 0, 0]; }
    if (dist > 3.2) return seek(m, pp.x, pp.z, Math.min(6.5, 2 + dist * 0.4));
    m.g.rotation.y = Math.atan2(pp.x - p.x, pp.z - p.z); return [0, 0, 0];
  }
  if (d.predator) {
    if (m.angry > 0) {
      m.angry -= dt;
      if (!player.alive || player.car || dist > 26 || !canHurtPlayer()) { m.angry = 0; return null; }
      if (dist < 1.7 && m.atk <= 0 && Math.abs(pp.y - p.y) < 2) { m.atk = 1.1; damage(d.dmg, m.type, p); }
      return seek(m, pp.x, pp.z, d.run * (m.type === 'cheetah' ? 1 : diff().spd));
    }
    // bears and tigers charge if you get too close
    if (player.alive && canHurtPlayer() && !player.car && !player.horse && ((m.type === 'bear' && dist < 5) || (m.type === 'tiger' && dist < (nightAmt > 0.5 ? 9 : 4.5)))) {
      m.angry = 10; if (!m.warned) { m.warned = true; toast(m.type === 'bear' ? '🐻 A bear is charging at you!' : '🐅 A tiger is hunting you!'); animalSnd(m.type, 0.16, true); }
    }
    // hunting
    if (d.prey) {
      if (m.prey && !alive(m.prey)) { m.prey = null; m.wait = 4 + Math.random() * 4; }
      m.huntT = (m.huntT ?? 3 + Math.random() * 6) - dt;
      if (!m.prey && m.huntT <= 0) { m.huntT = 6 + Math.random() * 10; if (Math.random() < 0.45) { let best = 16; for (const o of mobs) if (d.prey.includes(o.type) && !o.tamed) { const od = o.g.position.distanceTo(p); if (od < best) { best = od; m.prey = o; } } } }
      if (m.prey) {
        const f = m.prey.g.position, fd = p.distanceTo(f);
        if (fd > 30) { m.prey = null; return null; }
        if (fd < 1.4 && m.atk <= 0) { m.atk = 1; m.prey.panic = 5; hurtMob(m.prey, d.bite || 3, p, true); }
        return seek(m, f.x, f.z, d.run * 0.85);
      }
    }
    if (m.wait > 0) return null;
    if (m.type === 'cheetah' && Math.random() < dt * 0.05) m.panic = 2;   // short sprints
  }
  return null;
}
// birds: flocks that circle in the sky and land for a while now and then
function updateBird(m, dt, t) {
  const p = m.g.position;
  if (!m.flock) { m.flock = { x: p.x, z: p.z, hx: p.x, hz: p.z, y: p.y, ang: Math.random() * 6.28, sp: 4.5, seed: Math.random() * 9, timer: 1e9, land: m.sit, t: -1 }; m.off = Math.random() * 6; }
  const F = m.flock;
  if (F.t !== t) {
    F.t = t; F.timer -= dt;
    if (F.timer <= 0) { F.land = !F.land && Math.random() < 0.6; F.timer = F.land ? 9 + Math.random() * 8 : 22 + Math.random() * 25; }
    if (F.land && Math.hypot(player.pos.x - F.x, player.pos.z - F.z) < 6) { F.land = false; F.timer = 20; animalSnd('bird', 0.1); }
    if (!F.land) { F.ang += Math.sin(t * 0.25 + F.seed) * 0.7 * dt; if (Math.hypot(F.x - F.hx, F.z - F.hz) > 45) F.ang += 1.2 * dt; F.x += Math.sin(F.ang) * F.sp * dt; F.z += Math.cos(F.ang) * F.sp * dt; }
    const gy = groundAt(F.x, F.z); F.y += ((F.land ? gy : Math.max(gy + 9, SEA + 12)) - F.y) * Math.min(1, dt * 0.8);
  }
  const a = m.off + (F.land ? 0 : t * 0.6), r = F.land ? 1 + (m.v % 3) * 0.7 : 2.5 + (m.v % 3);
  const tx = F.x + Math.cos(a) * r, tz = F.z + Math.sin(a) * r, ty = F.land ? groundAt(tx, tz) + (Math.sin(t * 7 + m.off) > 0.95 ? 0.15 : 0) : F.y + Math.sin(t * 1.3 + m.off) * 1.2;
  const k = Math.min(1, dt * (F.land ? 3 : 1.6)), ox = p.x, oz = p.z;
  p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.z += (tz - p.z) * k;
  if (Math.hypot(p.x - ox, p.z - oz) > 0.002) m.g.rotation.y = Math.atan2(p.x - ox, p.z - oz);
  const flying = !F.land || Math.abs(p.y - ty) > 0.3, f = flying ? Math.sin(t * 20 + m.off * 3) * 0.9 : 0.1;
  if (m.wings) { m.wings[0].rotation.z = f; m.wings[1].rotation.z = -f; }
  m.hurt = Math.max(0, m.hurt - dt);
}

// ---- wildlife spawner: keeps animals around you by biome (works in old worlds too)
const savannaAt = (x, z) => vnoise(x / 130, z / 130, state.seed + 606) > 0.62 && !deadAt(x, z);
function biomeAt(x, z, h, top) {
  if (!oldAt(x, z)) {   // v1.10 biomes
    const b = biomeOf(x, z);
    if (h >= 32 || top === STONE || top === SNOW) return 'mount';
    if (b === 'snow') return 'snow'; if (b === 'desert') return 'desert';
    if (top === SAND) return 'beach';
    return b;
  }
  if (top === SAND) return 'beach';
  if (h >= 22 || top === STONE) return 'mount';
  if (savannaAt(x, z)) return 'savanna';
  if (forestAt(x, z) > 0.55 || deadAt(x, z)) return 'forest';
  return 'plains';
}
const SPAWN_TABLE = {
  plains: [['horse', 3, 2, 4], ['bird', 3, 4, 7], ['wolf', 0.5, 2, 3], ['lizard', 0.3, 1, 2]],
  forest: [['wolf', 3, 3, 4], ['bear', 1.6, 1, 1], ['bird', 2, 4, 6], ['tiger', 0.3, 1, 1]],
  savanna: [['zebra', 3, 3, 5], ['giraffe', 2, 1, 3], ['cheetah', 1.2, 1, 1], ['tiger', 1, 1, 1], ['lizard', 1.5, 2, 3], ['bird', 0.8, 3, 5]],
  mount: [['goat', 4, 2, 4], ['wolf', 0.6, 2, 3], ['bird', 0.6, 3, 5]],
  beach: [['lizard', 3, 2, 3], ['bird', 1, 3, 5]],
  snow: [['wolf', 3, 2, 4], ['goat', 2, 2, 3], ['bear', 1, 1, 1], ['bird', 0.8, 3, 5]],
  desert: [['lizard', 4, 2, 3], ['cheetah', 0.5, 1, 1], ['bird', 0.6, 3, 4]],
};
let wildT = 2;
function spawnGroup(type, n, x, z) {
  const flock = type === 'bird' ? { x, z, hx: x, hz: z, y: groundAt(x, z) + 10, ang: Math.random() * 6.28, sp: 4 + Math.random() * 2, seed: Math.random() * 9, timer: 15 + Math.random() * 20, land: false, t: -1 } : null;
  const v = rint(0, 99);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, r = Math.random() * 3, sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
    const y = flock ? flock.y : groundAt(sx, sz); if (!flock && (isWater(get(Math.floor(sx), y - 1, Math.floor(sz))) || isWater(get(Math.floor(sx), y, Math.floor(sz))))) continue;
    const m = spawnMob(type, sx, y, sz, type === 'horse' || type === 'goat' ? v + (Math.random() < 0.3 ? i : 0) : rint(0, 99)); if (!m) return;
    if (flock) { m.flock = flock; m.off = i * 1.3 + Math.random(); }
    else m.home = new THREE.Vector2(x, z);
  }
}
function updateWildlife(dt) {
  wildT -= dt; if (wildT > 0) return; wildT = 3;
  const wild = mobs.filter(m => MOBDEF[m.type].wild && !m.tamed).length;
  if (wild >= 18 || mobs.length > 52) return;
  const a = Math.random() * 6.28, r = 28 + Math.random() * 26, x = player.pos.x + Math.cos(a) * r, z = player.pos.z + Math.sin(a) * r;
  const bx = Math.floor(x), bz = Math.floor(z);
  if (!data.has(ckey(fdiv(bx, CH), fdiv(bz, CH))) || Math.hypot(x - VX, z - VZ) < 30) return;
  const tn = townAt(bx, bz); if (inTown(tn, bx, bz, 6)) return;
  const h = groundAt(x, z) - 1, top = get(bx, h, bz); if (isWater(top) || top === AIR || h <= SEA) return;
  const tab = SPAWN_TABLE[biomeAt(x, z, h, top)]; let tot = 0; for (const e of tab) tot += e[1];
  let pick = Math.random() * tot; for (const [type, w, n0, n1] of tab) { pick -= w; if (pick <= 0) { spawnGroup(type, rint(n0, n1), x, z); break; } }
}
// ---- strays in towns, and townsfolk walking their pets on a leash
const leashMat = new THREE.LineBasicMaterial({ color: 0x5a3a20 });
function maybeLeash(ped) {
  if (!ped || Math.random() > 0.18) return;
  const type = Math.random() < 0.65 ? 'dog' : 'cat', p = ped.g.position, pet = spawnMob(type, p.x + 0.8, p.y, p.z + 0.8, rint(0, 99)); if (!pet) return;
  pet.owner = ped; pet.townId = ped.townId;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  pet.leash = new THREE.Line(geo, leashMat); pet.leash.frustumCulled = false; scene.add(pet.leash);
}
function townAnimals(t, folk, city) {
  const strays = folk.filter(m => (m.type === 'cat' || m.type === 'dog') && !m.owner && !m.tamed).length;
  if (strays < (city ? 3 : 2)) { const c = randomTownCell(t, null); if (c) { const m = spawnMob(Math.random() < 0.5 ? 'cat' : 'dog', c[0] + 0.5, t.base + 1, c[1] + 0.5, rint(0, 99)); if (m) { m.townId = t.id; m.home = new THREE.Vector2(c[0], c[1]); } } }
}
const _lv = new THREE.Vector3();
function updateLeashes() {
  for (const m of mobs) {
    if (!m.leash) continue;
    if (!alive(m.owner)) { scene.remove(m.leash); m.leash = null; m.owner = null; continue; }
    const o = m.owner.g, a = m.leash.geometry.attributes.position, ry = o.rotation.y;
    a.setXYZ(0, o.position.x + Math.cos(ry) * 0.36, o.position.y + 0.85, o.position.z - Math.sin(ry) * 0.36);
    const p = m.g.position, h = MOBDEF[m.type].h, fy = m.g.rotation.y; a.setXYZ(1, p.x + Math.sin(fy) * 0.3, p.y + h * 0.75, p.z + Math.cos(fy) * 0.3); a.needsUpdate = true;
  }
}
// ---- tamed animals are remembered in the save and come back when you're near
function syncPet(m) { if (!m || !m.petId || !state.pets) return; const r = state.pets.find(q => q.id === m.petId); if (!r) return; const p = m.g.position; r.x = p.x; r.y = p.y; r.z = p.z; r.saddle = !!m.hasSaddle; r.sit = !!m.sit; }
function syncPets() { if (typeof mobs === 'undefined') return; for (const m of mobs) if (m.petId) syncPet(m); }
let petT = 1;
function updatePets(dt) {
  petT -= dt; if (petT > 0 || MP_GUEST || !state.pets) return; petT = 2;
  for (const r of state.pets) {
    if (mobs.some(m => m.petId === r.id)) continue;
    if (Math.hypot(r.x - player.pos.x, r.z - player.pos.z) > 64 || !data.has(ckey(fdiv(Math.floor(r.x), CH), fdiv(Math.floor(r.z), CH)))) continue;
    const m = spawnMob(r.type, r.x, Math.max(r.y, 1), r.z, r.v || 0); if (!m) continue;
    m.tamed = true; m.petId = r.id; m.sit = !!r.sit; m.hasSaddle = !!r.saddle; if (m.saddle) m.saddle.visible = m.hasSaddle; if (m.collar) m.collar.visible = true; m.home = new THREE.Vector2(r.x, r.z);
  }
}
// ---- extra animal noises
function wildSnd(type, vol, pain) {
  if (type === 'horse' || type === 'zebra') { sweep(pain ? 900 : 700, 380, 0.5, 'sawtooth', vol * 0.35); setTimeout(() => sweep(520, 300, 0.35, 'sawtooth', vol * 0.25), 300); return; }
  if (type === 'wolf' || type === 'dog') { if (pain) { sweep(1100, 600, 0.2, 'triangle', vol * 0.6); return; } if (type === 'wolf' && nightAmt > 0.5 && Math.random() < 0.5) { sweep(380, 620, 1.4, 'sine', vol * 0.5); return; } for (let i = 0; i < 2; i++) setTimeout(() => { noiseBurst(0.06, vol * 0.5, 900); beep(type === 'dog' ? 330 : 260, 0.08, 'sawtooth', vol * 0.4); }, i * 160); return; }
  if (type === 'cat') { sweep(pain ? 900 : 700, pain ? 1200 : 520, 0.45, 'triangle', vol * 0.5); return; }
  if (type === 'bear' || type === 'tiger' || type === 'cheetah') { noiseBurst(0.6, vol * 0.7, 300); sweep(type === 'bear' ? 140 : 200, 70, 0.7, 'sawtooth', vol * 0.5); return; }
  if (type === 'goat') { for (let i = 0; i < 6; i++) setTimeout(() => beep(460 + (i % 2) * 40, 0.06, 'sawtooth', vol * 0.4), i * 55); return; }
  if (type === 'bird') { for (let i = 0; i < 3; i++) setTimeout(() => sweep(2400 + Math.random() * 800, 3400, 0.07, 'sine', vol * 0.35), i * 110); return; }
  if (type === 'giraffe' || type === 'lizard') return;
}

// ================== EXPLORED MAP (saved per world) + GPS + holdable map ==================
const MAP_KEY = 'dealercraft_map_' + (MP_GUEST ? 'mp' : SLOT), REGC = 16, RS = REGC * CH;
const mapRegions = new Map(); let mapBounds = null, mapChanged = false, mapWarned = false;
const _mimg = document.createElement('canvas').getContext('2d').createImageData(CH, CH);
function regionPut(cx, cz, arr) {
  const rx = fdiv(cx, REGC), rz = fdiv(cz, REGC), k = rx + ',' + rz; let c = mapRegions.get(k);
  if (!c) { c = document.createElement('canvas'); c.width = c.height = RS; c.rx = rx; c.rz = rz; mapRegions.set(k, c); }
  const d = _mimg.data; for (let i = 0; i < CH * CH; i++) { d[i * 4] = arr[i * 3]; d[i * 4 + 1] = arr[i * 3 + 1]; d[i * 4 + 2] = arr[i * 3 + 2]; d[i * 4 + 3] = 255; }
  c.getContext('2d').putImageData(_mimg, (cx - rx * REGC) * CH, (cz - rz * REGC) * CH);
  const x0 = cx * CH, z0 = cz * CH;
  if (!mapBounds) mapBounds = [x0, z0, x0 + CH, z0 + CH]; else { mapBounds[0] = Math.min(mapBounds[0], x0); mapBounds[1] = Math.min(mapBounds[1], z0); mapBounds[2] = Math.max(mapBounds[2], x0 + CH); mapBounds[3] = Math.max(mapBounds[3], z0 + CH); }
}
function loadExplored() {
  try {
    const o = JSON.parse(localStorage.getItem(MAP_KEY)); if (!o || o.seed !== state.seed || !o.c) return;
    for (const k in o.c) {
      const s = atob(o.c[k]); if (s.length !== 192) continue; const out = new Uint8ClampedArray(CH * CH * 3); out.coarse = true;
      for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) { const si = ((z >> 1) * 8 + (x >> 1)) * 3, di = (z * CH + x) * 3; out[di] = s.charCodeAt(si); out[di + 1] = s.charCodeAt(si + 1); out[di + 2] = s.charCodeAt(si + 2); }
      mapMem.set(k, out); const [cx, cz] = k.split(',').map(Number); regionPut(cx, cz, out);
    }
  } catch (e) {}
}
function saveExplored(force) {
  if (!mapChanged && !force) return; mapChanged = false;
  try {
    const c = {};
    for (const [k, a] of mapMem) { let s = ''; for (let z = 0; z < CH; z += 2) for (let x = 0; x < CH; x += 2) { const i = (z * CH + x) * 3; s += String.fromCharCode(a[i], a[i + 1], a[i + 2]); } c[k] = btoa(s); }
    localStorage.setItem(MAP_KEY, JSON.stringify({ seed: state.seed, c }));
  } catch (e) { if (!mapWarned) { mapWarned = true; console.warn('map save failed', e); } }
}
loadExplored();
const WP_COLS = ['#ff3b3b', '#3ba0ff', '#ffd23b', '#3bff7a', '#ff6ad5', '#ffffff', '#ff9a2a', '#9a6aff'];
function drawPin(ctx, x, y, col, n, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 1, 5, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-3, -6, -8, -9, -8, -15); ctx.arc(0, -15, 8, Math.PI, 0); ctx.bezierCurveTo(8, -9, 3, -6, 0, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 0, -15); ctx.restore();
}
// paint the explored world into ctx (W x H canvas units), centred on block (vx, vz) at sc canvas units per block
function drawWorld(ctx, W, H, vx, vz, sc, o = {}) {
  ctx.fillStyle = o.bg || '#d6c496'; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = sc < 0.95;
  const bx0 = vx - W / 2 / sc, bz0 = vz - H / 2 / sc, bx1 = vx + W / 2 / sc, bz1 = vz + H / 2 / sc;
  for (const c of mapRegions.values()) { const x0 = c.rx * RS, z0 = c.rz * RS; if (x0 > bx1 || x0 + RS < bx0 || z0 > bz1 || z0 + RS < bz0) continue; ctx.drawImage(c, (x0 - vx) * sc + W / 2, (z0 - vz) * sc + H / 2, RS * sc, RS * sc); }
  const S = (x, z) => [(x - vx) * sc + W / 2, (z - vz) * sc + H / 2];
  if (o.grid && sc > 0.6) { ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = Math.ceil(bx0 / CH) * CH; x < bx1; x += CH) { const [sx] = S(x, 0); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); } for (let z = Math.ceil(bz0 / CH) * CH; z < bz1; z += CH) { const [, sy] = S(0, z); ctx.moveTo(0, sy); ctx.lineTo(W, sy); } ctx.stroke(); }
  if (o.police) { ctx.fillStyle = '#ff3030'; for (const c of cars) if (c.kind === 'police') { const [sx, sy] = S(c.x, c.z); ctx.fillRect(sx - 2, sy - 2, 4, 4); } }
  if (state.pets) { ctx.fillStyle = '#ff8ac8'; for (const r of state.pets) { const [sx, sy] = S(r.x, r.z); ctx.beginPath(); ctx.arc(sx, sy, 3 * (o.pin || 1), 0, 7); ctx.fill(); } }
  if (state.spawn) { const [sx, sy] = S(state.spawn[0] + 0.5, state.spawn[2] + 0.5); ctx.font = `${Math.round(12 * (o.pin || 1))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🛏️', sx, sy); }
  (state.waypoints || []).forEach((w, i) => { const [sx, sy] = S(w.x + 0.5, w.z + 0.5); drawPin(ctx, sx, sy, w.c, i + 1, o.pin || 1); });
  const [px, py] = S(player.pos.x, player.pos.z), k = o.pin || 1;
  ctx.save(); ctx.translate(px, py); ctx.rotate(-player.yaw); ctx.scale(k, k);
  ctx.fillStyle = '#ff2020'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
}
// whole explored world, fitted into the holdable map
function drawHeldMap(ctx, W) {
  let b = mapBounds ? mapBounds.slice() : [player.pos.x - 64, player.pos.z - 64, player.pos.x + 64, player.pos.z + 64];
  b = [Math.min(b[0], player.pos.x - 8), Math.min(b[1], player.pos.z - 8), Math.max(b[2], player.pos.x + 8), Math.max(b[3], player.pos.z + 8)];
  for (const w of state.waypoints || []) b = [Math.min(b[0], w.x - 8), Math.min(b[1], w.z - 8), Math.max(b[2], w.x + 8), Math.max(b[3], w.z + 8)];
  const span = Math.max(160, b[2] - b[0], b[3] - b[1]) * 1.06;
  drawWorld(ctx, W, W, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, W / span, { police: true, pin: W / 256 });
}

// ================== THE PHONE (📱): Radio, GPS Map, Browser ==================
let phoneApp = 'home', phoneSt = -1, phoneVol = settings.phoneVol != null ? settings.phoneVol : 0.7, webFromPhone = false;
const gps = { x: 0, z: 0, sc: 2, follow: true };
const phoneEl = document.createElement('div'); phoneEl.className = 'panel'; phoneEl.id = 'phone';
phoneEl.innerHTML = '<div class="phone"><div class="pnotch"></div><div class="pscreen" id="pScreen"></div><div class="pnav"><button class="pbtn" data-p="back">◀</button><button class="pbtn phomeb" data-p="home">⬤</button><button class="pbtn" data-p="close">✕</button></div></div>';
document.body.appendChild(phoneEl);
const gameClock = () => { const f = (state.time % DAY) / DAY, h = (f * 24 + 6) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${(hh % 12) || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };
function openPhone(app) { if (!playing || !player.alive) return; phoneApp = app || phoneApp || 'home'; if (phoneApp === 'gps') { gps.follow = true; } renderPhone(); openPanel('phone'); beep(1320, 0.04, 'sine', 0.04); }
function phoneStatus() { return `<div class="pstatus"><span>${gameClock()}</span><span>${phoneSt >= 0 ? '📻 ' : ''}${state.waypoints && state.waypoints.length ? '📍 ' : ''}📶 🔋</span></div>`; }
function renderPhone() {
  const el = document.getElementById('pScreen'); let h = phoneStatus();
  if (phoneApp === 'home') {
    h += `<div class="phomescr"><div class="pclock">${gameClock()}</div><div class="pdate">${isNight() ? '🌙' : '☀️'} Day ${day()} · 💰 ${state.coins}</div>
      <div class="papps"><button class="papp" data-app="radio"><i style="background:linear-gradient(#ff8a3a,#d0401a)">📻</i>Radio</button><button class="papp" data-app="gps"><i style="background:linear-gradient(#4ad07a,#1a8a4a)">🗺️</i>GPS Map</button><button class="papp" data-app="web"><i style="background:linear-gradient(#5aa0ff,#1f56c4)">🌐</i>Browser</button></div>
      <div class="phint">Your phone is always with you, even after you die.</div></div>`;
  } else if (phoneApp === 'radio') {
    h += `<div class="pappbar">📻 Radio</div><div class="pradio">${phoneSt >= 0 ? `<div class="pnow">Now playing<br><b>${STATIONS[phoneSt].name}</b></div>` : '<div class="pnow">Radio off</div>'}
      <div class="pvol"><button class="pst stop" data-st="-1">⏹ Stop</button>🔈<input type="range" id="pVol" min="0" max="100" value="${Math.round(phoneVol * 100)}">🔊</div>
      ${STATIONS.map((s, i) => `<button class="pst ${i === phoneSt ? 'on' : ''}" data-st="${i}">${i === phoneSt ? '🔊' : '▶'} ${s.name}</button>`).join('')}
      <div class="phint">The phone radio keeps playing while you walk around. Stop it here.</div></div>`;
  } else if (phoneApp === 'gps') {
    const wp = state.waypoints || [];
    h += `<div class="pappbar">🗺️ GPS <span class="gbtns"><button class="pbtn2" data-g="out">➖</button><button class="pbtn2" data-g="in">➕</button><button class="pbtn2" data-g="me">◎</button><button class="pbtn2" data-g="fit">⤢</button></span></div>
      <div class="gpswrap"><canvas id="gpsCv"></canvas><div class="gcoord" id="gCoord"></div></div>
      <div class="gwp" id="gWp">${wp.length ? wp.map((w, i) => `<div class="gwrow"><b style="color:${w.c}">📍${i + 1}</b> <span id="gwd${i}">${Math.round(Math.hypot(w.x + 0.5 - player.pos.x, w.z + 0.5 - player.pos.z))} m</span><button class="pbtn2" data-wdel="${i}">✕</button></div>`).join('') + '<button class="pbtn2 wide" data-g="clear">Clear all waypoints</button>' : '<div class="phint">Tap the map to drop a waypoint · tap a pin to remove it · drag to pan · pinch / wheel to zoom</div>'}</div>`;
  }
  else if (phoneApp === 'web') h += '<div class="box webbox pweb" id="pWebBox"></div>';
  el.innerHTML = h;
  if (phoneApp === 'web') { webFromPhone = true; renderWeb(); }
  if (phoneApp === 'radio') { const v = el.querySelector('#pVol'); v.addEventListener('input', () => { phoneVol = v.value / 100; settings.phoneVol = phoneVol; saveSettings(); }); }
  if (phoneApp === 'gps') bindGPS(el.querySelector('#gpsCv'));
}
phoneEl.addEventListener('pointerdown', e => { if (e.target === phoneEl) closePanels(); });
phoneEl.addEventListener('click', e => {
  const pw = e.target.closest('#pWebBox'); if (pw) { webClick(e, pw); return; }   // DealerNet inside the phone
  const b = e.target.closest('[data-p],[data-app],[data-st],[data-g],[data-wdel]'); if (!b) return;
  if (b.dataset.p === 'close') { closePanels(); return; }
  if (b.dataset.p === 'home' || b.dataset.p === 'back') { phoneApp = 'home'; webFromPhone = false; renderPhone(); return; }
  if (b.dataset.app === 'web') { phoneApp = 'web'; webTab = 'buy'; renderPhone(); beep(990, 0.03, 'sine', 0.04); return; }
  if (b.dataset.app) { phoneApp = b.dataset.app; if (phoneApp === 'gps') gps.follow = true; renderPhone(); beep(990, 0.03, 'sine', 0.04); return; }
  if (b.dataset.st != null) { phoneSt = +b.dataset.st; renderPhone(); if (AC && AC.state === 'suspended') AC.resume(); toast(phoneSt >= 0 ? `📻 ${STATIONS[phoneSt].name} on your phone` : '📻 Phone radio off'); return; }
  if (b.dataset.wdel != null) { state.waypoints.splice(+b.dataset.wdel, 1); renderPhone(); return; }
  const g = b.dataset.g;
  if (g === 'in' || g === 'out') { gps.sc = Math.max(0.04, Math.min(16, gps.sc * (g === 'in' ? 1.6 : 1 / 1.6))); }
  if (g === 'me') { gps.follow = true; gps.sc = Math.max(gps.sc, 1.5); }
  if (g === 'fit') fitGPS();
  if (g === 'clear') { state.waypoints = []; renderPhone(); }
});
function fitGPS() {
  const cv = document.getElementById('gpsCv'); if (!cv || !mapBounds) return; const W = cv.clientWidth, H = cv.clientHeight;
  gps.follow = false; gps.x = (mapBounds[0] + mapBounds[2]) / 2; gps.z = (mapBounds[1] + mapBounds[3]) / 2;
  gps.sc = Math.max(0.04, Math.min(W / (mapBounds[2] - mapBounds[0] + 16), H / (mapBounds[3] - mapBounds[1] + 16)));
}
function bindGPS(cv) {
  const ptrs = new Map(); let down = null;
  const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const zoomAt = (sx, sy, f) => { const W = cv.clientWidth, H = cv.clientHeight, ns = Math.max(0.04, Math.min(16, gps.sc * f));
    const wx = gps.x + (sx - W / 2) / gps.sc, wz = gps.z + (sy - H / 2) / gps.sc; gps.x = wx - (sx - W / 2) / ns; gps.z = wz - (sy - H / 2) / ns; gps.sc = ns; gps.follow = false; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} ptrs.set(e.pointerId, rel(e)); down = ptrs.size === 1 ? { moved: 0, t: performance.now() } : (down && (down.moved = 99), down); });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; const prev = ptrs.get(e.pointerId), cur = rel(e);
    if (ptrs.size === 1) { gps.x -= (cur[0] - prev[0]) / gps.sc; gps.z -= (cur[1] - prev[1]) / gps.sc; if (down) down.moved += Math.abs(cur[0] - prev[0]) + Math.abs(cur[1] - prev[1]); if (down && down.moved > 6) gps.follow = false; }
    else if (ptrs.size === 2) { const other = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1]; const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(cur[0] - other[0], cur[1] - other[1]);
      if (d0 > 4) zoomAt((cur[0] + other[0]) / 2, (cur[1] + other[1]) / 2, d1 / d0); }
    ptrs.set(e.pointerId, cur);
  });
  const up = e => { if (!ptrs.has(e.pointerId)) return; const pos = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size === 0) { if (down && down.moved < 8 && performance.now() - down.t < 600) tapGPS(pos[0], pos[1], cv); down = null; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const [sx, sy] = rel(e); zoomAt(sx, sy, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
}
function tapGPS(sx, sy, cv) {
  const W = cv.clientWidth, H = cv.clientHeight, wx = gps.x + (sx - W / 2) / gps.sc, wz = gps.z + (sy - H / 2) / gps.sc;
  if (!state.waypoints) state.waypoints = [];
  const hitI = state.waypoints.findIndex(w => { const px = (w.x + 0.5 - gps.x) * gps.sc + W / 2, py = (w.z + 0.5 - gps.z) * gps.sc + H / 2; return Math.hypot(sx - px, sy - (py - 15)) < 13 || Math.hypot(sx - px, sy - py) < 9; });
  if (hitI >= 0) { state.waypoints.splice(hitI, 1); beep(400, 0.05, 'triangle', 0.05); toast('📍 Waypoint removed'); }
  else { if (state.waypoints.length >= 30) { toast('📍 30 waypoints max'); return; } state.waypoints.push({ x: Math.floor(wx), z: Math.floor(wz), c: WP_COLS[state.waypoints.length % WP_COLS.length] }); beep(880, 0.05, 'triangle', 0.05); toast(`📍 Waypoint ${state.waypoints.length} added`); }
  renderPhone();
}
let gpsListT = 0;
function updatePhone(dt) {
  if (!phoneEl.classList.contains('show')) return;
  if (phoneApp !== 'gps') return;
  const cv = document.getElementById('gpsCv'); if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1); if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  if (gps.follow) { gps.x = player.pos.x; gps.z = player.pos.z; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWorld(ctx, W, H, gps.x, gps.z, gps.sc, { bg: '#1b2028', grid: true, police: true, pin: 1 });
  const sc = gps.sc; const bar = sc >= 1 ? 16 : sc >= 0.25 ? 64 : 256; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, H - 22, bar * sc + 44, 16); ctx.fillStyle = '#fff'; ctx.fillRect(12, H - 15, bar * sc, 3); ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(bar + ' m', 16 + bar * sc, H - 14);
  gpsListT -= dt; if (gpsListT <= 0) { gpsListT = 0.5; const c = document.getElementById('gCoord'); if (c) c.textContent = `X ${Math.floor(player.pos.x)}  Z ${Math.floor(player.pos.z)}  ·  ${['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'][((Math.round(player.yaw / (Math.PI / 4)) % 8) + 8) % 8]}`;
    (state.waypoints || []).forEach((w, i) => { const e = document.getElementById('gwd' + i); if (e) e.textContent = Math.round(Math.hypot(w.x + 0.5 - player.pos.x, w.z + 0.5 - player.pos.z)) + ' m'; }); }
}
// the phone button sits flush against the right side of the stats box, same top and height
function placePhoneBtn() {
  const s = document.getElementById('stats'), b = document.getElementById('bPhone'); if (!s || !b) return;
  const r = s.getBoundingClientRect(); if (!r.height) return;
  const h = Math.round(r.height), w = Math.round(h * 0.55), key = r.right + ',' + r.top + ',' + h; if (b._k === key) return; b._k = key;
  b.style.left = Math.round(r.right + 6) + 'px'; b.style.top = Math.round(r.top) + 'px'; b.style.height = h + 'px'; b.style.width = w + 'px';
  const sp = b.querySelector('span'); if (sp) sp.style.fontSize = Math.max(14, Math.round(w * 0.62)) + 'px';
}
addEventListener('resize', () => requestAnimationFrame(placePhoneBtn));
{ const _rs = renderStats; renderStats = function () { _rs(); placePhoneBtn(); }; }
document.getElementById('bPhone').addEventListener('click', e => { e.stopPropagation(); if (!playing || !player.alive) return; if (uiOpen) closePanels(); else openPhone(); });

// ================== per-frame hook ==================
let mapSaveT = 20, mapFlushT = 1;
function updateV109(dt, t) {
  updateRider(); updateWildlife(dt); updatePets(dt); updateLeashes(); updatePhone(dt); placePhoneBtn();
  mapFlushT -= dt; if (mapFlushT <= 0) { mapFlushT = 1; for (const k of mapDirty) { const [cx, cz] = k.split(',').map(Number); chunkColors(cx, cz); } }
  mapSaveT -= dt; if (mapSaveT <= 0) { mapSaveT = 30; saveExplored(); }
}

// ================== ONLINE: accounts, cloud saves, 4-player worlds, player characters ==================
const FB_KEY = 'AIzaSyBxkzswFQCuE8zVVungvRCUAbkeicff3sQ';
const FB_DB = 'https://bugsquash-leaderboard-default-rtdb.firebaseio.com/dealercraft';
const MAX_PLAYERS = 4;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- accounts (Firebase email/password, username@dealercraft.game behind the scenes) ----------
let auth = (() => { try { return JSON.parse(localStorage.getItem('dc_auth')); } catch (e) { return null; } })();
const saveAuth = () => { if (auth) localStorage.setItem('dc_auth', JSON.stringify(auth)); else localStorage.removeItem('dc_auth'); };
const AUTH_ERR = { EMAIL_EXISTS: 'That username is already taken', INVALID_LOGIN_CREDENTIALS: 'Wrong username or password', INVALID_PASSWORD: 'Wrong username or password', EMAIL_NOT_FOUND: 'Wrong username or password',
  WEAK_PASSWORD: 'Password needs at least 6 characters', TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Wait a minute and try again', USER_DISABLED: 'This account is disabled', INVALID_EMAIL: 'Usernames can use letters, numbers and _' };
const NET_HELP = "Can't reach the DealerCraft server. Check your internet. On GrapheneOS: Settings › Apps › DealerCraft › Permissions › turn on Network, then reopen the app.";
async function netFetch(url, opts) { try { return await fetch(url, opts); } catch (e) { throw new Error(NET_HELP); } }
async function fbAuth(kind, name, pass) {
  const r = await netFetch(`https://identitytoolkit.googleapis.com/v1/accounts:${kind}?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: name.toLowerCase() + '@dealercraft.game', password: pass, returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok) { const code = ((j.error && j.error.message) || 'ERROR').split(' ')[0]; throw new Error(AUTH_ERR[code] || 'Could not reach the server (' + code + ')'); }
  auth = { name, uid: j.localId, idToken: j.idToken, refresh: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000 }; saveAuth(); return auth;
}
async function token() {
  if (!auth) return null;
  if (Date.now() < auth.exp - 120000) return auth.idToken;
  const r = await netFetch(`https://securetoken.googleapis.com/v1/token?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refresh) });
  const j = await r.json(); if (!r.ok) { if (r.status === 400) { auth = null; saveAuth(); renderAccount(); } throw new Error('Session expired, please log in again'); }
  auth.idToken = j.id_token; auth.refresh = j.refresh_token; auth.exp = Date.now() + (+j.expires_in || 3600) * 1000; saveAuth(); return auth.idToken;
}
async function db(method, path, body, opts = {}) {
  const t = await token(); if (!t) throw new Error('Log in first');
  const r = await netFetch(`${FB_DB}/${path}.json?auth=${t}`, { method, body: body === undefined ? undefined : JSON.stringify(body), keepalive: !!opts.keepalive });
  if (!r.ok) throw new Error('Server error ' + r.status);
  return r.json();
}
const validName = n => /^[A-Za-z0-9_]{3,16}$/.test(n);
async function signUp(name, pass) {
  if (!validName(name)) throw new Error('Username: 3-16 letters, numbers or _');
  await fbAuth('signUp', name, pass);
  try { await db('PUT', 'users/' + name.toLowerCase(), auth.uid); } catch (e) {}
  await db('PUT', `saves/${auth.uid}/profile`, { name, skin: mySkin(), created: Date.now() });
}
async function logIn(name, pass) {
  if (!validName(name)) throw new Error('Wrong username or password');
  await fbAuth('signInWithPassword', name, pass);
  try { const p = await db('GET', `saves/${auth.uid}/profile`); if (p && p.name) { auth.name = p.name; saveAuth(); } if (p && p.skin && !localStorage.getItem('dc_skin')) { localStorage.setItem('dc_skin', JSON.stringify(p.skin)); } } catch (e) {}
}
function logOut() { if (net.on) leaveOnline(); auth = null; saveAuth(); renderAccount(); renderAcctBtn(); }

// ---------- cloud saves ----------
const lastUp = {}; let cloudStatus = '', cloudBusy = false;
async function cloudUpload(manual) {
  if (!auth) { if (manual) { openAccount(); toast('👤 Log in to save to the cloud'); } return; }
  if (cloudBusy) return; cloudBusy = true;
  try {
    if (playing) save();
    let n = 0;
    for (let s = 1; s <= SLOTS; s++) {
      const raw = localStorage.getItem(slotKey(s)); if (!raw || (!manual && lastUp[s] === raw)) continue;
      let info = {}; try { const j = JSON.parse(raw); info = { day: Math.floor((j.time || 0) / DAY) + 1, coins: j.coins | 0 }; } catch (e) {}
      await db('PUT', `saves/${auth.uid}/w${s}`, raw); await db('PUT', `saves/${auth.uid}/meta/w${s}`, Object.assign({ t: Date.now() }, info)); lastUp[s] = raw; n++;
    }
    await db('PATCH', `saves/${auth.uid}/profile`, { name: auth.name, skin: mySkin() });
    cloudStatus = '☁️ Saved to cloud ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (manual) toast(n ? '☁️ Game saved to the cloud!' : '☁️ Cloud save is already up to date');
  } catch (e) { cloudStatus = '⚠️ Cloud save failed: ' + e.message; if (manual) toast('⚠️ ' + e.message); }
  cloudBusy = false; renderAccount();
}
async function cloudList() { const m = await db('GET', `saves/${auth.uid}/meta`); return m || {}; }
async function cloudRestore(s) {
  const raw = await db('GET', `saves/${auth.uid}/w${s}`); if (!raw) throw new Error('Nothing saved there');
  if (s === SLOT) saveBlocked = true;
  localStorage.setItem(slotKey(s), raw); lastUp[s] = raw;
  if (s === SLOT) location.reload(); else { renderWorlds(); toast(`☁️ World ${s} restored from the cloud`); }
}
setInterval(() => { if (auth && playing && !MP_GUEST) cloudUpload(false); }, 120000);
addEventListener('visibilitychange', () => { if (document.hidden && auth && !MP_GUEST) cloudUpload(false); });

// ---------- characters: every player gets their own look ----------
const SK = {
  skin: [0xf6d2b0, 0xf1c27d, 0xe0ac69, 0xc58c63, 0x8d5524, 0x5c3a21, 0x7fbf5a, 0x9ad0ff],
  hair: [0x1a1208, 0x4a2a10, 0x8a4a1a, 0xd9b35b, 0xeeeeee, 0xd23a2a, 0x2a8ad2, 0xff6ad5, 0x3fa34d],
  shirt: [0xd23a2a, 0x2a8ad2, 0x3fa34d, 0xf2c21a, 0x8a3fd2, 0xeeeeee, 0x222222, 0xff7a1a, 0x1fb5b5, 0xff6ad5],
  pants: [0x2a3a6a, 0x222222, 0x6b5a3a, 0x555555, 0x7a1a1a, 0x1a5a2a, 0xdedede],
  shoes: [0x111111, 0xeeeeee, 0x8a4a1a, 0xd23a2a, 0x2a8ad2],
};
const SK_STYLE = { style: ['Short', 'Long', 'Mohawk', 'Bald', 'Spiky', 'Bun', 'Afro'], hat: ['None', 'Cap', 'Beanie', 'Top hat', 'Crown', 'Headphones', 'Cowboy'], acc: ['None', 'Glasses', 'Shades', 'Gold chain', 'Mask', 'Beard'] };
function randomSkin(seedStr) {
  let h = 0; for (const c of String(seedStr || Math.random())) h = Math.imul(h ^ c.charCodeAt(0), 2654435761);
  const r = mulberry(h), pick = a => Math.floor(r() * a.length);
  return { skin: pick(SK.skin.slice(0, 6)), hair: pick(SK.hair), shirt: pick(SK.shirt), pants: pick(SK.pants), shoes: pick(SK.shoes), style: pick(SK_STYLE.style), hat: r() < 0.5 ? 0 : pick(SK_STYLE.hat), acc: r() < 0.6 ? 0 : pick(SK_STYLE.acc) };
}
function mySkin() { try { const s = JSON.parse(localStorage.getItem('dc_skin')); if (s && s.shirt != null) return s; } catch (e) {} const s = randomSkin(auth ? auth.name : Math.random()); localStorage.setItem('dc_skin', JSON.stringify(s)); return s; }
const SKCOL = (s, k) => SK[k][(s && s[k]) | 0] ?? SK[k][0];
function buildAvatar(s) {
  const g = new THREE.Group(), legs = [], arms = [], skin = SKCOL(s, 'skin'), hair = SKCOL(s, 'hair'), shirt = SKCOL(s, 'shirt'), pants = SKCOL(s, 'pants'), shoes = SKCOL(s, 'shoes');
  const body = new THREE.Group(); g.add(body);
  box(0.5, 0.75, 0.28, shirt, 0, 1.1, 0, body);
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); body.add(head);
  box(0.46, 0.5, 0.46, skin, 0, 0, 0, head);
  for (const ex of [-0.1, 0.1]) { box(0.09, 0.08, 0.02, 0xffffff, ex, 0.04, 0.235, head); box(0.045, 0.06, 0.02, 0x2a2a6a, ex + 0.02, 0.035, 0.245, head); }
  box(0.14, 0.03, 0.02, 0x7a3a2a, 0, -0.12, 0.235, head);
  const st = s.style | 0;
  if (st !== 3) box(0.5, 0.12, 0.5, hair, 0, 0.24, 0, head);
  if (st === 0 || st === 1 || st === 5 || st === 6) box(0.5, st === 1 ? 0.5 : 0.22, 0.08, hair, 0, st === 1 ? -0.02 : 0.13, -0.23, head);
  if (st === 1) for (const sx of [-0.24, 0.24]) box(0.06, 0.36, 0.44, hair, sx, 0.05, -0.02, head);
  if (st === 2) box(0.12, 0.2, 0.5, hair, 0, 0.36, 0, head);
  if (st === 4) for (let i = 0; i < 4; i++) box(0.1, 0.16, 0.1, hair, -0.15 + i * 0.1, 0.36, (i % 2) * 0.1 - 0.05, head);
  if (st === 5) box(0.2, 0.18, 0.2, hair, 0, 0.36, -0.12, head);
  if (st === 6) box(0.62, 0.36, 0.6, hair, 0, 0.3, -0.02, head);
  const ht = s.hat | 0;
  if (ht === 1) { box(0.5, 0.14, 0.5, shirt, 0, 0.32, 0, head); box(0.44, 0.04, 0.24, shirt, 0, 0.26, 0.32, head); }
  if (ht === 2) box(0.52, 0.22, 0.52, pants, 0, 0.32, 0, head);
  if (ht === 3) { box(0.62, 0.04, 0.62, 0x111111, 0, 0.29, 0, head); box(0.4, 0.4, 0.4, 0x111111, 0, 0.5, 0, head); box(0.41, 0.06, 0.41, 0xd23a2a, 0, 0.35, 0, head); }
  if (ht === 4) { box(0.48, 0.14, 0.48, 0xf2c21a, 0, 0.34, 0, head); for (const [cx, cz] of [[-0.2, 0], [0.2, 0], [0, 0.2], [0, -0.2]]) box(0.08, 0.12, 0.08, 0xf2c21a, cx, 0.46, cz, head); }
  if (ht === 5) { box(0.06, 0.12, 0.54, 0x222222, 0, 0.3, 0, head); for (const hx of [-0.27, 0.27]) box(0.08, 0.18, 0.18, 0x222222, hx, 0.02, 0, head); }
  if (ht === 6) { box(0.8, 0.04, 0.8, 0x8a5a2a, 0, 0.28, 0, head); box(0.44, 0.24, 0.44, 0x8a5a2a, 0, 0.4, 0, head); }
  const ac = s.acc | 0;
  if (ac === 1 || ac === 2) { const c = ac === 1 ? 0x222222 : 0x050505; for (const ex of [-0.11, 0.11]) box(0.14, 0.1, 0.02, ac === 1 ? 0x9ad0ff : c, ex, 0.04, 0.25, head); box(0.44, 0.03, 0.02, c, 0, 0.08, 0.25, head); }
  if (ac === 3) box(0.3, 0.06, 0.02, 0xf2c21a, 0, 1.38, 0.15, body);
  if (ac === 4) box(0.48, 0.2, 0.02, 0x222222, 0, -0.1, 0.24, head);
  if (ac === 5) box(0.4, 0.16, 0.04, hair, 0, -0.17, 0.235, head);
  for (const lx of [-0.12, 0.12]) { const l = pivotLimb(body, 0.22, 0.72, 0.22, pants, lx, 0.72, 0); box(0.23, 0.12, 0.26, shoes, 0, -0.66, 0.02, l); legs.push(l); }
  for (const ax of [-0.34, 0.34]) { const a = pivotLimb(body, 0.18, 0.7, 0.18, shirt, ax, 1.45, 0); box(0.17, 0.2, 0.17, skin, 0, -0.62, 0, a); arms.push(a); }
  return { g, body, legs, arms, head };
}
function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.55)'; const w = Math.min(250, x.measureText ? 30 + text.length * 17 : 200); x.fillRect((256 - w) / 2, 4, w, 40); x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; x.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(1.9, 0.36, 1); sp.position.y = 2.35; sp.renderOrder = 20; return sp;
}
function animAvatar(av, speed, t, sleeping) {
  if (sleeping) { av.body.rotation.x = -Math.PI / 2; av.body.position.set(0, 0.55, 0.9); for (const l of [...av.legs, ...av.arms]) l.rotation.x = 0; return; }
  av.body.rotation.x = 0; av.body.position.set(0, 0, 0);
  const sw = Math.min(1, speed / 4) * Math.sin(t * 9) * 0.8;
  av.legs[0].rotation.x = sw; av.legs[1].rotation.x = -sw; av.arms[0].rotation.x = -sw; av.arms[1].rotation.x = sw;
}

// ---------- third-person camera (V or 👁) and my own character ----------
let myAv = null, myAvKey = '';
function updateMyAvatar(dt, t) {
  const k = JSON.stringify(mySkin()); if (k !== myAvKey) { if (myAv) scene.remove(myAv.g); myAv = buildAvatar(mySkin()); scene.add(myAv.g); myAvKey = k; }
  const show = settings.view3 && playing && !player.car;
  myAv.g.visible = show; hand.visible = !show;
  if (!show) return;
  myAv.g.position.copy(player.pos); myAv.g.rotation.y = player.yaw + Math.PI;
  myAv.head.rotation.x = -player.pitch * 0.6;
  animAvatar(myAv, Math.hypot(player.vel.x, player.vel.z), t, !!player.sleeping);
  if (swingT > 0) myAv.arms[1].rotation.x = -1.5 * Math.sin((1 - swingT / swingDur) * Math.PI);
  if (player.horse) { myAv.legs[0].rotation.x = myAv.legs[1].rotation.x = -1.4; myAv.legs[0].rotation.z = 0.35; myAv.legs[1].rotation.z = -0.35; myAv.g.position.y -= 0.75; } else { myAv.legs[0].rotation.z = myAv.legs[1].rotation.z = 0; }
  // pull the camera back behind the head, stopping before walls
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + EYE, player.pos.z), back = getDir().multiplyScalar(-1);
  let d = 0.3; while (d < 3.6) { const p = eye.clone().addScaledVector(back, d + 0.25); if (solid(get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) break; d += 0.15; }
  camera.position.copy(eye).addScaledVector(back, d);
}

// ---------- online worlds ----------
const net = { on: false, role: null, code: null, remotes: {}, es: null, lastClock: 0,
  count() { const n = performance.now(); return 1 + Object.values(this.remotes).filter(r => n - r.recv < 12000).length; },
  sleepers() { const n = performance.now(), rs = Object.values(this.remotes).filter(r => n - r.recv < 12000); return [(player.sleeping ? 1 : 0) + rs.filter(r => r.d.sl).length, rs.length + 1]; } };
let netMute = false, pendEdits = {}, lastCrop = {}, lastDev = {}, netT = 0, posT = 0, clockT = 0, cropsDirty = false, posBusy = false;
function netEdit(k, id) { if (net.on && !netMute) pendEdits[k] = id; }
function netChests(keys) { if (!net.on) return; const p = {}; for (const k of keys) p['chests/' + k] = JSON.stringify(state.chests[k] || null); db('PATCH', 'rooms/' + net.code, p).catch(() => {}); }
const cropVal = c => c ? JSON.stringify({ type: c.type, t: Math.round(c.t * 10) / 10, fert: !!c.fert }) : null;
const cleanCrops = () => { const o = {}; for (const k in state.crops) o[k] = JSON.parse(cropVal(state.crops[k])); return o; };
const meData = () => ({ n: auth.name, x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2), yw: +player.yaw.toFixed(2), p: +player.pitch.toFixed(2), sl: !!player.sleeping, sk: mySkin(), t: Date.now(), ...meExtra() });
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
async function hostOnline() {
  if (!auth) { openAccount(); toast('👤 Log in first to play online'); return; }
  if (MP_GUEST) return;
  setOnlineMsg('Opening your world...');
  try {
    const code = newCode(), chests = {}; for (const k in state.chests) chests[k] = JSON.stringify(state.chests[k]);
    await db('PUT', 'rooms/' + code, { meta: { host: auth.uid, hostName: auth.name, open: true, seed: state.seed, created: Date.now(), genV: state.genV || 1, oldCh: (state.oldCh || []).join(';'), townV: state.townV || 0, townOld: (state.townOld || []).join(';'), siteV: state.siteV || 0, siteOld: (state.siteOld || []).join(';'), caveV: (caveInit(), state.caveV || 0), caveOld: (state.caveOld || []).join(';') }, clock: { time: state.time, gt: state.gameTime, hb: Date.now() },
      edits: state.edits, crops: cleanCrops(), dev: state.dev, chests, shops: shopsNet(), players: { [auth.uid]: meData() } });
    net.on = true; net.role = 'host'; net.code = code; lastCrop = {}; lastDev = {}; for (const k in state.crops) lastCrop[k] = cropVal(state.crops[k]); Object.assign(lastDev, state.dev);
    await openStream(); setOnlineMsg(''); renderOnline(); toast(`🌐 Your world is online! Code: ${code}`);
  } catch (e) { setOnlineMsg('⚠️ ' + e.message); }
}
async function joinOnline(code) {
  if (!auth) { openAccount(); return; }
  code = code.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 5) { setOnlineMsg('Codes are 5 letters/numbers'); return; }
  setOnlineMsg('Joining ' + code + '...');
  try {
    const r = await db('GET', 'rooms/' + code);
    if (!r || !r.meta || !r.meta.open) throw new Error('No open world with that code');
    if (r.meta.host === auth.uid) throw new Error("That's your own world");
    const now = Date.now(), others = Object.entries(r.players || {}).filter(([u, p]) => u !== auth.uid && p && now - p.t < 60000);
    // host always counts as a seat (even if their position ping is late), so 4 total = host + 3 guests
    const seats = new Set(others.map(([u]) => u)); if (r.meta.host) seats.add(r.meta.host);
    if (seats.size + 1 > MAX_PLAYERS) throw new Error(`That world is full (${MAX_PLAYERS}/${MAX_PLAYERS})`);
    const host = (r.players || {})[r.meta.host], chests = {}; for (const k in (r.chests || {})) { try { const v = JSON.parse(r.chests[k]); if (v) chests[k] = v; } catch (e) {} }
    const world = { seed: r.meta.seed, ...(r.meta.genV >= 2 ? { genV: r.meta.genV, oldCh: r.meta.oldCh ? String(r.meta.oldCh).split(';') : [] } : {}), ...(r.meta.townV >= 3 ? { townV: r.meta.townV, townOld: r.meta.townOld ? String(r.meta.townOld).split(';') : [] } : {}), ...(r.meta.siteV >= 4 ? { siteV: r.meta.siteV, siteOld: r.meta.siteOld ? String(r.meta.siteOld).split(';') : [] } : {}), ...(r.meta.caveV ? { caveV: r.meta.caveV, caveOld: r.meta.caveOld ? String(r.meta.caveOld).split(';') : [] } : {}), shops: (() => { const o = {}; for (const k in (r.shops || {})) { try { const v = JSON.parse(r.shops[k]); if (v) o[k] = v; } catch (e) {} } return o; })(), edits: r.edits || {}, crops: r.crops || {}, dev: r.dev || {}, chests, time: r.clock.time, gameTime: r.clock.gt,
      pos: host ? [host.x + 1, host.y + 0.5, host.z + 1] : state.pos, _welcomed: true };
    save();
    { const inv = {}; for (const k of INV_KEYS) inv[k] = state[k]; localStorage.setItem('dc_mp_inv', JSON.stringify(inv)); }
    localStorage.setItem('dc_mp_world', JSON.stringify(world));
    localStorage.setItem('dc_mp', JSON.stringify({ role: 'guest', code, host: r.meta.hostName }));
    saveBlocked = true; location.reload();
  } catch (e) { setOnlineMsg('⚠️ ' + e.message); }
}
async function leaveOnline(msg) {
  if (net.es) { net.es.close(); net.es = null; }
  const was = net.role, code = net.code; net.on = false;
  for (const u in net.remotes) removeRemote(u);
  try {
    if (was === 'host') { await db('PATCH', 'rooms/' + code + '/meta', { open: false }); setTimeout(() => db('DELETE', 'rooms/' + code).catch(() => {}), 4000); }
    else if (code && auth) await db('DELETE', `rooms/${code}/players/${auth.uid}`);
  } catch (e) {}
  net.role = null; net.code = null;
  if (MP_GUEST) {   // carry your inventory back to your own world
    try {
      const inv = JSON.parse(localStorage.getItem('dc_mp_inv')) || {}; for (const k of INV_KEYS) inv[k] = state[k];
      const own = JSON.parse(localStorage.getItem(SAVE_KEY)) || newState(); for (const k of INV_KEYS) if (inv[k] !== undefined) own[k] = inv[k];
      localStorage.setItem(SAVE_KEY, JSON.stringify(own));
    } catch (e) {}
    for (const k of ['dc_mp', 'dc_mp_world', 'dc_mp_inv']) localStorage.removeItem(k);
    if (msg) localStorage.setItem('dc_mp_msg', msg);
    saveBlocked = true; location.reload(); return;
  }
  renderOnline(); if (msg) toast(msg);
}
async function openStream() {
  if (net.es) net.es.close();
  const t = await token(), es = new EventSource(`${FB_DB}/rooms/${net.code}.json?auth=${t}`); net.es = es;
  const handle = (ev, patch) => { try { const m = JSON.parse(ev.data); if (!m) return; if (patch) for (const k in m.data) onNet(join(m.path, k), m.data[k]); else onNet(m.path, m.data); } catch (e) {} };
  es.addEventListener('put', e => handle(e, false)); es.addEventListener('patch', e => handle(e, true));
  es.addEventListener('auth_revoked', () => { token().then(() => net.on && openStream()).catch(() => {}); });
  es.addEventListener('cancel', () => { if (net.on) leaveOnline('🌐 Disconnected from the online world'); });
  es.onerror = () => {};
}
const join = (a, b) => (a === '/' ? '' : a) + '/' + b;
function onNet(path, data) {
  const seg = path.split('/').filter(Boolean);
  if (!seg.length) { if (data == null) { if (net.role === 'guest') leaveOnline('🌐 The host closed their world'); return; } for (const k in data) onNet('/' + k, data[k]); return; }
  const [top, key, ...rest] = seg;
  if (top === 'meta') { if ((key === 'open' && data === false) || (!key && (!data || data.open === false))) { if (net.role === 'guest') leaveOnline('🌐 The host closed their world'); } return; }
  if (top === 'clock') { if (net.role !== 'guest') return; const c = key ? { [key]: data } : data; if (!c) return; net.lastClock = performance.now();
    if (c.time != null) { const jump = c.time - state.time; if (Math.abs(jump) > 2) { state.time = c.time; if (jump > 30 && player.sleeping) wakeUp(true); } }
    if (c.gt != null && Math.abs(c.gt - state.gameTime) > 2) state.gameTime = c.gt; return; }
  if (top === 'players') {
    if (!key) { for (const u in (data || {})) onNet('/players/' + u, data[u]); return; }
    if (auth && key === auth.uid) return;
    if (data == null && !rest.length) { removeRemote(key); return; }
    const r = net.remotes[key] || (net.remotes[key] = { d: {}, recv: 0, av: null, skinKey: '' });
    if (rest.length) r.d[rest[0]] = data; else r.d = data; r.recv = performance.now(); return;
  }
  if (top === 'edits') {
    if (!key) { for (const k in (data || {})) onNet('/edits/' + k, data[k]); return; }
    const [x, y, z] = key.split(',').map(Number), id = data == null ? AIR : data;
    if (get(x, y, z) !== id || state.edits[key] !== id) { netMute = true; setBlock(x, y, z, id, false); netMute = false; netFlushSoon = true; }
    return;
  }
  if (top === 'crops') {
    if (!key) { for (const k in (data || {})) onNet('/crops/' + k, data[k]); return; }
    const v = data ? JSON.stringify({ type: data.type, t: Math.round(data.t * 10) / 10, fert: !!data.fert }) : null; lastCrop[key] = v;
    if (v === cropVal(state.crops[key])) return;
    if (data && CROPS[data.type]) state.crops[key] = { type: data.type, t: data.t, fert: !!data.fert }; else delete state.crops[key];
    cropsDirty = true; return;
  }
  if (top === 'dev') { if (!key) { for (const k in (data || {})) onNet('/dev/' + k, data[k]); return; } lastDev[key] = data; if (data == null) delete state.dev[key]; else state.dev[key] = data; return; }
  if (top === 'shops' || top === 'pay') { netExtra(top, key, rest, data); return; }
  if (top === 'chests') { if (!key) { for (const k in (data || {})) onNet('/chests/' + k, data[k]); return; } if (chestKeys && chestKeys.includes(key)) return; try { const v = JSON.parse(data); if (v) state.chests[key] = v; else delete state.chests[key]; } catch (e) {} }
}
let netFlushSoon = false;
function removeRemote(u) { const r = net.remotes[u]; if (!r) return; if (r.av) scene.remove(r.av.g); if (r.carMesh) scene.remove(r.carMesh); if (r.tag) scene.remove(r.tag); delete net.remotes[u]; }
function updateNet(dt, t) {
  if (netFlushSoon) { netFlushSoon = false; flushDirty(); }
  if (cropsDirty) { cropsDirty = false; buildCrops(); }
  if (!net.on) return;
  netT += dt; posT += dt; clockT += dt;
  if (netT > 0.3) {   // block edits, crops and TV/radio channels
    netT = 0; const p = {};
    for (const k in pendEdits) p['edits/' + k] = pendEdits[k]; pendEdits = {};
    for (const k in state.crops) { const v = cropVal(state.crops[k]); if (lastCrop[k] !== v) { p['crops/' + k] = JSON.parse(v); lastCrop[k] = v; } }
    for (const k in lastCrop) if (lastCrop[k] != null && !state.crops[k]) { p['crops/' + k] = null; lastCrop[k] = null; }
    for (const k in state.dev) if (lastDev[k] !== state.dev[k]) { p['dev/' + k] = state.dev[k]; lastDev[k] = state.dev[k]; }
    for (const k in lastDev) if (lastDev[k] != null && state.dev[k] == null) { p['dev/' + k] = null; lastDev[k] = null; }
    if (Object.keys(p).length) db('PATCH', 'rooms/' + net.code, p).catch(() => {});
  }
  if (posT > 0.2 && !posBusy) { posT = 0; posBusy = true; db('PUT', `rooms/${net.code}/players/${auth.uid}`, meData()).catch(() => {}).finally(() => { posBusy = false; }); }
  if (net.role === 'host') {
    if (clockT > 3) { clockT = 0; db('PUT', `rooms/${net.code}/clock`, { time: state.time, gt: state.gameTime, hb: Date.now() }).catch(() => {}); }
    const [a, n] = net.sleepers();   // everybody in bed: the night passes for the whole world
    if (n > 1 && a === n && canSleep() && player.sleeping && player.sleeping.t > 2.5) { skipToMorning(); wakeUp(true); clockT = 0; db('PUT', `rooms/${net.code}/clock`, { time: state.time, gt: state.gameTime, hb: Date.now() }).catch(() => {}); }
  } else if (net.lastClock && performance.now() - net.lastClock > 45000) { net.lastClock = 0; leaveOnline('🌐 Lost connection to the host'); return; }
  // draw the other players
  const now = performance.now();
  for (const u in net.remotes) {
    const r = net.remotes[u], d = r.d; if (!d || d.x == null) continue;
    if (now - r.recv > 60000) { removeRemote(u); continue; }
    const sk = JSON.stringify(d.sk || {}); if (!r.av || sk !== r.skinKey) { if (r.av) scene.remove(r.av.g); r.av = buildAvatar(d.sk || randomSkin(u)); scene.add(r.av.g); r.skinKey = sk; if (!r.tag) { r.tag = nameTag(d.n || 'Player'); r.av.g.add(r.tag); } else r.av.g.add(r.tag); r.av.g.position.set(d.x, d.y, d.z); }
    const g = r.av.g; g.visible = now - r.recv < 12000;
    const ox = g.position.x, oz = g.position.z, k = Math.min(1, dt * 10);
    g.position.x += (d.x - g.position.x) * k; g.position.y += (d.y - g.position.y) * k; g.position.z += (d.z - g.position.z) * k;
    let dy = (d.yw + Math.PI) - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * k;
    r.av.head.rotation.x = -(d.p || 0) * 0.6;
    animAvatar(r.av, Math.hypot(g.position.x - ox, g.position.z - oz) / Math.max(dt, 0.001), t, d.sl);
    remoteExtra(r, d, dt);
  }
}
function setOnlineMsg(m) { const e = document.getElementById('onMsg'); if (e) e.textContent = m; }

// ---------- panels: account, online, character ----------
const mkPanel = (id) => { const p = document.createElement('div'); p.className = 'panel toppanel'; p.id = id; p.innerHTML = `<div class="box" id="${id}Box"></div>`; document.body.appendChild(p);
  p.addEventListener('pointerdown', e => { if (e.target === p) closePanels(); }); return p; };
const acctP = mkPanel('acct'), onP = mkPanel('online'), charP = mkPanel('char');
function openAccount() { renderAccount(); openPanel('acct'); if (auth) refreshCloudList(); }
let cloudMeta = null;
async function refreshCloudList() { try { cloudMeta = await cloudList(); } catch (e) { cloudMeta = null; cloudStatus = '⚠️ ' + e.message; } renderAccount(); }
function renderAccount() {
  const b = document.getElementById('acctBox'); if (!b) return;
  if (!auth) {
    b.innerHTML = `<button class="btn close" data-a="close">✕</button><h2>👤 DealerCraft Account</h2>
      <p style="opacity:.8;font-size:14px;margin:4px 0 10px">Log in to back up your worlds to the cloud, load them on another phone or the website, and play online with friends.</p>
      <div class="form"><input id="aUser" placeholder="Username" autocomplete="username" maxlength="16"><input id="aPass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password" maxlength="64">
      <div class="frow"><button class="btn gold" data-a="login">Log in</button><button class="btn" data-a="signup">Create account</button></div><div id="aMsg" class="amsg"></div></div>`;
    return;
  }
  const rows = []; for (let s = 1; s <= SLOTS; s++) { const m = cloudMeta && cloudMeta['w' + s]; rows.push(`<div class="row"><span class="nm">🌍 World ${s}<br><span style="font-size:12px;opacity:.7">${m ? `Day ${m.day} · 💰 ${m.coins} · saved ${new Date(m.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : cloudMeta ? 'No cloud save yet' : 'Loading...'}</span></span>${m ? `<button class="btn" data-rs="${s}">⬇️ Restore</button>` : ''}</div>`); }
  b.innerHTML = `<button class="btn close" data-a="close">✕</button><h2>👤 ${esc(auth.name)}</h2>
    <div class="row"><span class="nm">☁️ Auto cloud save<br><span style="font-size:12px;opacity:.7">Your worlds upload every 2 minutes and when you leave the game. ${esc(cloudStatus)}</span></span><button class="btn gold" data-a="upload">☁️ Upload now</button></div>
    <h3>Cloud saves</h3>${rows.join('')}<p style="font-size:12px;opacity:.7">Restoring replaces that world on this device with the cloud copy.</p>
    <div class="frow"><button class="btn" data-a="char">👕 My character</button><button class="btn" data-a="logout" style="background:#7a2222">Log out</button></div>`;
}
acctP.addEventListener('click', async e => {
  e.stopPropagation(); const b = e.target.closest('[data-a],[data-rs]'); if (!b) return; const a = b.dataset.a;
  if (a === 'close') { closePanels(); return; }
  if (a === 'login' || a === 'signup') {
    const u = document.getElementById('aUser').value.trim(), p = document.getElementById('aPass').value, msg = document.getElementById('aMsg');
    msg.textContent = a === 'login' ? 'Logging in...' : 'Creating your account...'; b.disabled = true;
    try { if (a === 'login') await logIn(u, p); else await signUp(u, p); renderAccount(); renderAcctBtn(); toast(`👤 Logged in as ${auth.name}`); await refreshCloudList();
      const hasLocal = [1, 2, 3].some(s => localStorage.getItem(slotKey(s))); if (a === 'login' && cloudMeta && Object.keys(cloudMeta).length && (!hasLocal || freshGame)) toast('☁️ Cloud saves found: tap Restore to load them');
      else if (a === 'signup') cloudUpload(false);
    } catch (err) { msg.textContent = '⚠️ ' + err.message; b.disabled = false; }
    return;
  }
  if (a === 'upload') { b.disabled = true; b.textContent = 'Uploading...'; await cloudUpload(true); return; }
  if (a === 'logout') { logOut(); return; }
  if (a === 'char') { openChar(); return; }
  if (b.dataset.rs) { const s = +b.dataset.rs; confirmBox(`Replace World ${s} on this device with the cloud save?`, 'Restore', async () => { try { await cloudRestore(s); } catch (err) { toast('⚠️ ' + err.message); } }); }
});
acctP.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = acctP.querySelector('[data-a=login]'); if (b) b.click(); } });
function confirmBox(text, yes, fn) {
  const box = document.createElement('div'); box.className = 'wconfirm'; box.style.zIndex = 80;
  box.innerHTML = `<div>${text}</div><button class="btn" data-no>Cancel</button><button class="btn gold" data-yes>${yes}</button>`;
  box.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('[data-yes]')) fn(); if (e.target.closest('[data-yes],[data-no]')) box.remove(); });
  document.body.appendChild(box);
}
function openOnline() { renderOnline(); openPanel('online'); }
function renderOnline() {
  const b = document.getElementById('onlineBox'); if (!b) return;
  let h = `<button class="btn close" data-a="close">✕</button><h2>🌐 Play Online</h2>`;
  if (!auth) h += `<p>Log in to host your world or join a friend's (up to ${MAX_PLAYERS} players).</p><button class="btn gold" data-a="acct">👤 Log in / Sign up</button>`;
  else if (net.on) {
    const now = performance.now(), list = [`${esc(auth.name)} (you)${net.role === 'host' ? ' 👑' : ''}`, ...Object.values(net.remotes).filter(r => now - r.recv < 12000).map(r => esc(r.d.n || 'Player'))];
    h += `<div class="row"><span class="nm">World code<br><span style="font-size:12px;opacity:.7">${net.role === 'host' ? 'Send this to friends so they can join' : 'Hosted by ' + esc((MP && MP.host) || 'a friend')}</span></span><b class="code">${net.code}</b></div>
      <h3>Players ${list.length}/${MAX_PLAYERS}</h3>${list.map(n => `<div class="row"><span class="nm">🧍 ${n}</span></div>`).join('')}
      <p style="font-size:12px;opacity:.75">Everyone has to be in bed at night to skip to morning. ${net.role === 'guest' ? 'Your bag comes back with you when you leave.' : 'Your world saves on your phone like normal.'}</p>
      <button class="btn" data-a="leave" style="background:#7a2222">${net.role === 'host' ? 'Close online world' : 'Leave world'}</button>`;
  } else {
    h += `<div class="row"><span class="nm">🏠 Host this world<br><span style="font-size:12px;opacity:.7">Friends join with a code (World ${SLOT})</span></span><button class="btn gold" data-a="host">Host</button></div>
      <div class="row"><span class="nm">🔑 Join a friend</span><input id="joinCode" placeholder="CODE" maxlength="5" style="width:96px;text-transform:uppercase"><button class="btn" data-a="join">Join</button></div>`;
  }
  b.innerHTML = h + `<div id="onMsg" class="amsg"></div>`;
}
onP.addEventListener('click', e => {
  e.stopPropagation(); const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'close') closePanels(); if (a === 'acct') { closePanels(); openAccount(); }
  if (a === 'host') hostOnline(); if (a === 'join') joinOnline(document.getElementById('joinCode').value);
  if (a === 'leave') leaveOnline(net.role === 'host' ? '🌐 Your world is offline again' : '');
});
setInterval(() => { if (onP.classList.contains('show') && net.on) renderOnline(); renderNetPill(); }, 2000);
// character editor
function openChar() { renderChar(); openPanel('char'); }
function drawSkin(c, s) {   // front view preview
  const x = c.getContext('2d'), u = 12, hex = v => '#' + v.toString(16).padStart(6, '0'), R = (col, a, b, w, h) => { x.fillStyle = hex(col); x.fillRect(a * u, b * u, w * u, h * u); };
  x.clearRect(0, 0, c.width, c.height); const sk = SKCOL(s, 'skin'), hr = SKCOL(s, 'hair'), sh = SKCOL(s, 'shirt'), pa = SKCOL(s, 'pants'), so = SKCOL(s, 'shoes'), st = s.style | 0, ht = s.hat | 0, ac = s.acc | 0;
  if (st === 6) R(hr, 3, 1, 8, 6); if (st === 1) R(hr, 3.5, 4, 7, 5);
  R(sk, 4, 3, 6, 6); if (st !== 3) R(hr, 4, 2.4, 6, 1.6); if (st === 2) R(hr, 6.3, 1.2, 1.4, 1.6); if (st === 4) for (let i = 0; i < 4; i++) R(hr, 4.2 + i * 1.5, 1.4, 1, 1.2); if (st === 5) R(hr, 6, 1.2, 2, 1.3);
  R(0xffffff, 5, 5, 1.2, 1); R(0xffffff, 7.8, 5, 1.2, 1); R(0x2a2a6a, 5.5, 5.1, 0.6, 0.9); R(0x2a2a6a, 8.2, 5.1, 0.6, 0.9); R(0x7a3a2a, 6, 7.4, 2, 0.4);
  if (ht === 1) { R(sh, 4, 1.6, 6, 1.8); R(sh, 4.5, 3.2, 5, 0.5); } if (ht === 2) R(pa, 3.8, 1.4, 6.4, 2.4); if (ht === 3) { R(0x111111, 3, 2.6, 8, 0.6); R(0x111111, 4.5, -0.6, 5, 3.4); R(0xd23a2a, 4.5, 1.8, 5, 0.6); }
  if (ht === 4) { R(0xf2c21a, 4, 1.4, 6, 1.6); for (let i = 0; i < 3; i++) R(0xf2c21a, 4.2 + i * 2.2, 0.4, 1.2, 1.2); } if (ht === 5) { R(0x222222, 3.4, 1.8, 7.2, 0.6); R(0x222222, 3, 4.4, 1.2, 2.4); R(0x222222, 9.8, 4.4, 1.2, 2.4); }
  if (ht === 6) { R(0x8a5a2a, 2, 2.6, 10, 0.6); R(0x8a5a2a, 4.3, 0.4, 5.4, 2.4); }
  if (ac === 1 || ac === 2) { R(ac === 1 ? 0x9ad0ff : 0x050505, 4.7, 4.8, 2, 1.3); R(ac === 1 ? 0x9ad0ff : 0x050505, 7.3, 4.8, 2, 1.3); R(0x111111, 4.5, 4.9, 5, 0.3); }
  if (ac === 4) R(0x222222, 4, 6.8, 6, 2.2); if (ac === 5) R(hr, 4.6, 7.6, 4.8, 1.6);
  R(sh, 4, 9, 6, 9); R(sh, 1.8, 9, 2.2, 8); R(sh, 10, 9, 2.2, 8); R(sk, 1.8, 16.6, 2.2, 2.2); R(sk, 10, 16.6, 2.2, 2.2); if (ac === 3) R(0xf2c21a, 5.5, 10.5, 3, 0.6);
  R(pa, 4, 18, 2.9, 8); R(pa, 7.1, 18, 2.9, 8); R(so, 3.8, 25.4, 3.2, 1.4); R(so, 7, 25.4, 3.2, 1.4);
}
function renderChar() {
  const s = mySkin(), b = document.getElementById('charBox');
  const sw = k => SK[k].map((c, i) => `<button class="sw ${s[k] === i ? 'on' : ''}" data-k="${k}" data-v="${i}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
  const op = k => SK_STYLE[k].map((n, i) => `<button class="chip ${s[k] === i ? 'on' : ''}" data-k="${k}" data-v="${i}">${n}</button>`).join('');
  b.innerHTML = `<button class="btn close" data-a="close">✕</button><h2>👕 My Character</h2><div class="charwrap"><canvas id="skinCv" width="168" height="330"></canvas><div class="charopts">
    <h3>Skin</h3>${sw('skin')}<h3>Hair</h3>${op('style')}<div>${sw('hair')}</div><h3>Shirt</h3>${sw('shirt')}<h3>Pants</h3>${sw('pants')}<h3>Shoes</h3>${sw('shoes')}<h3>Hat</h3>${op('hat')}<h3>Extras</h3>${op('acc')}
    <div class="frow" style="margin-top:10px"><button class="btn" data-a="rand">🎲 Random</button><button class="btn gold" data-a="close">✅ Done</button></div></div></div>
    <p style="font-size:12px;opacity:.7">This is how other players see you online. Tap 👁 in game to see yourself.</p>`;
  drawSkin(b.querySelector('#skinCv'), s);
}
charP.addEventListener('click', e => {
  e.stopPropagation(); const b = e.target.closest('[data-a],[data-k]'); if (!b) return; const s = mySkin();
  if (b.dataset.a === 'close') { closePanels(); if (auth) db('PATCH', `saves/${auth.uid}/profile`, { name: auth.name, skin: s }).catch(() => {}); return; }
  if (b.dataset.a === 'rand') { localStorage.setItem('dc_skin', JSON.stringify(randomSkin(Math.random()))); renderChar(); return; }
  s[b.dataset.k] = +b.dataset.v; localStorage.setItem('dc_skin', JSON.stringify(s)); renderChar();
});
// title-screen + HUD buttons
const titleRow = document.createElement('div'); titleRow.id = 'titleRow';
titleRow.innerHTML = `<button class="btn" id="tAcct"></button><button class="btn" id="tOnline">🌐 Play Online</button><button class="btn" id="tChar">👕 Character</button>`;
document.getElementById('worlds').after(titleRow);
titleRow.addEventListener('click', e => { e.stopPropagation(); const id = e.target.id; if (id === 'tAcct') openAccount(); if (id === 'tOnline') openOnline(); if (id === 'tChar') openChar(); });
function renderAcctBtn() { document.getElementById('tAcct').textContent = auth ? `👤 ${auth.name}` : '👤 Log in / Sign up'; }
renderAcctBtn();
const topb = document.getElementById('topbtns');
const bNet = document.createElement('button'); bNet.className = 'tbtn'; bNet.id = 'bNet'; bNet.textContent = '🌐'; topb.prepend(bNet); bNet.addEventListener('click', () => openOnline());
const bCam = document.createElement('button'); bCam.className = 'tbtn'; bCam.id = 'bCam'; bCam.textContent = '👁'; topb.prepend(bCam); bCam.addEventListener('click', () => { settings.view3 = !settings.view3; saveSettings(); });
const netPill = document.createElement('div'); netPill.id = 'netPill'; document.getElementById('hud').appendChild(netPill);
function renderNetPill() { netPill.style.display = net.on ? 'block' : 'none'; if (net.on) netPill.textContent = `🌐 ${net.code} · ${net.count()}/${MAX_PLAYERS} online`; }
// guests reconnect to their room after the reload
if (MP_GUEST && auth) { net.on = true; net.role = 'guest'; net.code = MP.code; for (const k in state.crops) lastCrop[k] = cropVal(state.crops[k]); Object.assign(lastDev, state.dev); net.lastClock = performance.now(); openStream().catch(() => leaveOnline('🌐 Could not reconnect')); setTimeout(() => toast(`🌐 Joined ${MP.host || 'your friend'}'s world (${MP.code})`), 800); }
else if (MP_GUEST && !auth) leaveOnline('');
{ const m = localStorage.getItem('dc_mp_msg'); if (m) { localStorage.removeItem('dc_mp_msg'); setTimeout(() => toast(m), 900); } }
if (auth) token().catch(() => {});   // stay logged in: refresh the saved session in the background

// ================== v1.10 step 2: SEASONS, WEATHER, LIGHTNING, FIRE ==================
// ---- seasons: each lasts SEASON_DAYS in-game days (a new world starts in autumn)
const SEASON_DAYS = 3;
const SEASONS = [{ n: 'Spring', e: '🌸' }, { n: 'Summer', e: '🌻' }, { n: 'Autumn', e: '🍂' }, { n: 'Winter', e: '❄️' }];
const seasonIdx = () => (Math.floor(state.time / DAY / SEASON_DAYS) + 2) % 4;
let curSeason = seasonIdx();
const SEASON_TINT = [[0.92, 1.12, 0.9], [1, 1, 1], [1.22, 0.98, 0.62], [1.1, 1.0, 0.78]];
const LEAF_TILE = [92, 91, 8, 93];
// per-column look of a chunk for the mesher: snow cover, grass tint, leaf tile
function chunkLook(x0, z0) {
  const n = CH * CH, cold = new Uint8Array(n), tint = new Float32Array(n * 3), leaf = new Uint8Array(n), S = curSeason, st = SEASON_TINT[S];
  for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const x = x0 + lx, z = z0 + lz, i = lx + lz * CH, t = tempAt(x, z), m = moistAt(x, z);
    const hot = t > 0.6, warm = sstep(0.5, 0.66, t), wet = sstep(0.5, 0.7, m), chill = 1 - sstep(0.3, 0.42, t);
    cold[i] = S === 3 && !hot ? 1 : 0;
    // biome colour: dry/hot grass goes straw-yellow, wet forests deeper green, cold areas a little blue
    let r = 1 + warm * 0.22 * (1 - wet * 0.6), g = 1 + warm * 0.08 - wet * 0.05, b = 1 - warm * 0.38 * (1 - wet * 0.5) - wet * 0.12 + chill * 0.05;
    r -= wet * 0.12; r -= chill * 0.06;
    tint[i * 3] = Math.min(1.35, r * st[0]); tint[i * 3 + 1] = g * st[1]; tint[i * 3 + 2] = Math.max(0.5, b * st[2]);
    leaf[i] = S === 3 ? (hot ? 91 : 93) : LEAF_TILE[S];
  }
  return { cold, tint, leaf };
}
// when the season turns, every loaded chunk is remeshed a few per frame
const remeshQ = [];
function checkSeason() {
  const s = seasonIdx(); if (s === curSeason) return;
  curSeason = s; remeshQ.length = 0; for (const k in chunks) remeshQ.push(k);
  if (playing) toast(`${SEASONS[s].e} ${SEASONS[s].n} has arrived`);
}
function remeshSome(n) { while (n-- > 0 && remeshQ.length) { const k = remeshQ.shift(); if (chunks[k]) { const [cx, cz] = k.split(',').map(Number); buildChunk(cx, cz); } } }

// ---- weather: fronts drift across the land, so it can rain in one valley and be clear in the next
const WX = { clear: { n: 'Clear', e: '🌤️' }, rain: { n: 'Rain', e: '🌧️' }, storm: { n: 'Thunderstorm', e: '⛈️' }, snow: { n: 'Snow', e: '🌨️' } };
let wxOverride = null;   // tests / debug: { type, until }
function weatherAt(x, z, tm = state.time) {
  if (wxOverride && state.gameTime < wxOverride.until) return wxOverride.type;
  const s = state.seed, d = tm * 0.45;
  const w = vnoise((x + d) / 300, (z - d * 0.6) / 300, s + 1111) * 0.7 + vnoise(tm / 650, 0.5, s + 1212) * 0.3;
  const t = tempAt(x, z), dry = t > 0.6 && moistAt(x, z) < 0.46;
  const wet = dry ? (w > 0.74 ? 1 : 0) : w > 0.7 ? 2 : w > 0.59 ? 1 : 0;
  if (!wet) return 'clear';
  const S = curSeason, cold = t < 0.35 || (S === 3 && t < 0.6) || ((S === 2 || S === 0) && t < 0.33);
  if (cold) return 'snow';
  return wet === 2 ? 'storm' : 'rain';
}
let wxHere = 'clear', wxT = 0, rainAmt = 0, snowAmt = 0, stormAmt = 0, flashT = 0, boltT = 6;
const precip = w => w === 'rain' || w === 'storm' || w === 'snow';
// highest block that stops rain in a column (cached for a moment)
const rainTopC = new Map(); let rainTopT = 0;
function rainTop(x, z) {
  const k = x + ',' + z; let v = rainTopC.get(k); if (v !== undefined) return v;
  v = 0; for (let y = H - 1; y > 0; y--) { const id = get(x, y, z); if (id !== AIR && id !== FIRE && id !== TORCH) { v = y + 1; break; } }
  rainTopC.set(k, v); return v;
}
// rain streaks and snowflakes around the camera
const RN = 900, SN = 700, RR = 18;
const rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RN * 6), rainV = new Float32Array(RN);
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xa8c0e8, transparent: true, opacity: 0, depthWrite: false });
const rainMesh = new THREE.LineSegments(rainGeo, rainMat); rainMesh.frustumCulled = false; rainMesh.renderOrder = 2; scene.add(rainMesh);
const snowGeo = new THREE.BufferGeometry(), snowPos = new Float32Array(SN * 3), snowPh = new Float32Array(SN);
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0, depthWrite: false });
const snowMesh = new THREE.Points(snowGeo, snowMat); snowMesh.frustumCulled = false; snowMesh.renderOrder = 2; scene.add(snowMesh);
function dropSpawn(arr, i, stride, top) {
  const c = camera.position, a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * RR;
  arr[i * stride] = c.x + Math.cos(a) * r; arr[i * stride + 2] = c.z + Math.sin(a) * r; arr[i * stride + 1] = c.y + (top ? 10 + Math.random() * 4 : -6 + Math.random() * 20);
}
for (let i = 0; i < RN; i++) { rainV[i] = 18 + Math.random() * 8; rainPos[i * 6 + 1] = -999; }
for (let i = 0; i < SN; i++) { snowPh[i] = Math.random() * 6.28; snowPos[i * 3 + 1] = -999; }
function updatePrecip(dt) {
  const c = camera.position, under = headInWater();
  const rOn = rainAmt > 0.02 && !under, sOn = snowAmt > 0.02 && !under;
  rainMesh.visible = rOn; snowMesh.visible = sOn;
  if (rOn) {
    rainMat.opacity = Math.min(0.6, rainAmt * 0.6); const n = Math.floor(RN * Math.min(1, rainAmt * (0.6 + stormAmt * 0.4)));
    for (let i = 0; i < n; i++) {
      const o = i * 6; let x = rainPos[o], y = rainPos[o + 1], z = rainPos[o + 2];
      y -= rainV[i] * dt;
      if (y < c.y - 12 || Math.abs(x - c.x) > RR + 2 || Math.abs(z - c.z) > RR + 2 || y < rainTop(Math.floor(x), Math.floor(z))) { const tmp = [0, 0, 0]; dropSpawn(tmp, 0, 3, rainPos[o + 1] > -900); x = tmp[0]; y = tmp[1]; z = tmp[2]; if (y < rainTop(Math.floor(x), Math.floor(z))) y = -999; }
      rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + 0.03; rainPos[o + 4] = y + 0.55; rainPos[o + 5] = z + 0.02;
    }
    rainGeo.setDrawRange(0, n * 2); rainGeo.attributes.position.needsUpdate = true;
  }
  if (sOn) {
    snowMat.opacity = Math.min(0.95, snowAmt); const n = Math.floor(SN * Math.min(1, snowAmt)), t = performance.now() / 1000;
    for (let i = 0; i < n; i++) {
      const o = i * 3; let x = snowPos[o], y = snowPos[o + 1], z = snowPos[o + 2];
      y -= (1.6 + (i % 5) * 0.2) * dt; x += Math.sin(t * 0.9 + snowPh[i]) * 0.4 * dt; z += Math.cos(t * 0.7 + snowPh[i]) * 0.3 * dt;
      if (y < c.y - 8 || Math.abs(x - c.x) > RR + 2 || Math.abs(z - c.z) > RR + 2 || y < rainTop(Math.floor(x), Math.floor(z))) { const tmp = [0, 0, 0]; dropSpawn(tmp, 0, 3, snowPos[o + 1] > -900); x = tmp[0]; y = tmp[1]; z = tmp[2]; if (y < rainTop(Math.floor(x), Math.floor(z))) y = -999; }
      snowPos[o] = x; snowPos[o + 1] = y; snowPos[o + 2] = z;
    }
    snowGeo.setDrawRange(0, n); snowGeo.attributes.position.needsUpdate = true;
  }
}
// darker, foggier sky under clouds, and the white flash of lightning
const _grey = new THREE.Color();
function applyWeatherSky() {
  if (headInWater()) return;
  const wet = Math.max(rainAmt, snowAmt * 0.8), light = 1 - nightAmt;
  if (wet > 0.01) {
    _grey.setRGB(0.42, 0.45, 0.5).multiplyScalar(0.15 + light * 0.8);
    if (snowAmt > rainAmt) _grey.setRGB(0.7, 0.72, 0.78).multiplyScalar(0.15 + light * 0.8);
    sky.lerp(_grey, wet * (0.6 + stormAmt * 0.25)); scene.fog.color.copy(sky).multiplyScalar(0.9);
    scene.fog.near *= 1 - wet * 0.45; scene.fog.far *= 1 - wet * (0.3 + stormAmt * 0.1);
    sun.intensity *= 1 - wet * 0.65; ambient.intensity *= 1 - wet * 0.22 - stormAmt * 0.1;
  }
  if (flashT > 0) { const f = Math.min(1, flashT / 0.12) * (0.6 + Math.random() * 0.4); ambient.intensity += f * 2.2; sky.lerp(_grey.setRGB(0.92, 0.94, 1), f * 0.8); scene.fog.color.copy(sky); }
}
{ const _us = updateSky; updateSky = function () { _us(); applyWeatherSky(); }; }

// ---- sounds: rain hiss loop and thunder
let rainNode = null;
function rainSound() {
  if (!AC || AC.state !== 'running') return;
  if (!rainNode) try {
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; const g = AC.createGain(); g.gain.value = 0;
    src.connect(lp).connect(hp).connect(g).connect(master); src.start(); rainNode = g;
  } catch (e) { return; }
  const indoors = rainTop(Math.floor(player.pos.x), Math.floor(player.pos.z)) > player.pos.y + 2;
  rainNode.gain.value = (playing ? 1 : 0) * rainAmt * (indoors ? 0.02 : 0.055) * (1 + stormAmt * 0.5);
}
function thunderSnd(vol) {
  noiseF(0.25, 0.5 * vol, 'highpass', 3000, 900, 0.7);
  noiseF(3.2, 0.7 * vol, 'lowpass', 520, 45, 0.8, 0.08);
  noiseF(2.4, 0.4 * vol, 'lowpass', 260, 40, 1.2, 0.6);
  sweep(70, 28, 2.2, 'sine', 0.25 * vol);
}

// ---- lightning: picks the tallest spot of a few, flashes, cracks, and can light fires
const boltMat = new THREE.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 1, depthWrite: false });
const boltLight = new THREE.PointLight(0xccd8ff, 0, 60, 1.2); scene.add(boltLight);
let bolt = null, boltLife = 0, strikes = 0;
const _up = new THREE.Vector3(0, 1, 0);
function strike(x, z, life = 0.35) {
  if (x == null) {   // lightning favours high ground and treetops
    let best = null;
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283, r = 10 + Math.random() * 55, cx = Math.floor(player.pos.x + Math.cos(a) * r), cz = Math.floor(player.pos.z + Math.sin(a) * r);
      if (!data.has(ckey(fdiv(cx, CH), fdiv(cz, CH)))) continue; const t = rainTop(cx, cz); if (!best || t > best[2]) best = [cx, cz, t]; }
    if (!best) return; x = best[0]; z = best[1];
  }
  x = Math.floor(x); z = Math.floor(z); const top = rainTop(x, z), hitId = get(x, top - 1, z); strikes++;
  if (bolt) { scene.remove(bolt); bolt.traverse(o => o.geometry && o.geometry.dispose()); }
  bolt = new THREE.Group(); let px = x + 0.5, pz = z + 0.5, py = top + 46;
  while (py > top) {
    const ny = Math.max(top, py - 3 - Math.random() * 4), nx = x + 0.5 + (ny > top ? (Math.random() - 0.5) * 3 : 0), nz = z + 0.5 + (ny > top ? (Math.random() - 0.5) * 3 : 0);
    const a = new THREE.Vector3(px, py, pz), b = new THREE.Vector3(nx, ny, nz), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 5), boltMat);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(_up, b.clone().sub(a).normalize()); bolt.add(m);
    if (Math.random() < 0.3 && ny > top + 6) {   // a short fork
      const fx = nx + (Math.random() - 0.5) * 6, fy = ny - 3 - Math.random() * 3, fz = nz + (Math.random() - 0.5) * 6, fa = b, fb = new THREE.Vector3(fx, fy, fz), fl = fa.distanceTo(fb);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, fl, 4), boltMat); f.position.copy(fa).add(fb).multiplyScalar(0.5); f.quaternion.setFromUnitVectors(_up, fb.clone().sub(fa).normalize()); bolt.add(f);
    }
    px = nx; py = ny; pz = nz;
  }
  scene.add(bolt); boltLife = life; flashT = Math.min(life, 0.32); boltLight.position.set(x + 0.5, top + 3, z + 0.5); boltLight.intensity = 6;
  const dist = Math.hypot(x + 0.5 - player.pos.x, z + 0.5 - player.pos.z);
  setTimeout(() => thunderSnd(Math.max(0.25, 1 - dist / 120)), Math.min(2500, dist * 25));
  // what it hits
  if (FLAMMABLE.has(hitId)) { fireAt(x, top, z, 10); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (FLAMMABLE.has(get(x + dx, top - 1, z + dz)) && Math.random() < 0.5) fireAt(x + dx, rainTop(x + dx, z + dz), z + dz, 8); }
  else if (solid(hitId) && Math.random() < 0.7) fireAt(x, top, z, 3 + Math.random() * 3);
  if (dist < 3 && Math.abs(player.pos.y - top) < 4 && player.alive) { damage(5, 'lightning'); burnT = Math.max(burnT, 3); }
  { const at = new THREE.Vector3(x + 0.5, top, z + 0.5); for (const m of [...mobs]) if (m.g.position.distanceTo(at) < 3) try { hurtMob(m, 8, at); } catch (e) {} }
  return [x, top, z];
}
function updateBolt(dt) {
  if (flashT > 0) flashT -= dt;
  if (bolt) { boltLife -= dt; boltMat.opacity = boltLife > 0.2 ? 1 : Math.random() < 0.5 ? 0.2 : 0.9; boltLight.intensity = Math.max(0, boltLife * 18); if (boltLife <= 0) { scene.remove(bolt); bolt.traverse(o => o.geometry && o.geometry.dispose()); bolt = null; boltLight.intensity = 0; } }
}

// ---- fire: spreads slowly to wood, planks and leaves, burns them away, goes out in water or rain
const fires = new Map();   // "x,y,z" -> { x, y, z, life, age }   (hook for later: fire trucks can read and putOutFire() these)
const FIRE_MAX = 160;
function fireAt(x, y, z, life) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (y < 1 || y >= H || fires.size >= FIRE_MAX) return false;
  const k = x + ',' + y + ',' + z, id = get(x, y, z);
  if (!(id === AIR || id === SNOW_LAYER || id === FIRE || FLAMMABLE.has(id)) || state.crops[k]) return false;
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (isWater(get(x + dx, y + dy, z + dz))) return false;
  if (id !== FIRE) setBlock(x, y, z, FIRE);
  fires.set(k, { x, y, z, life: life || 6 + Math.random() * 6, age: 0 });
  return true;
}
function putOutFire(k, quiet) {
  const f = fires.get(k); if (!f) return; fires.delete(k);
  if (get(f.x, f.y, f.z) === FIRE) setBlock(f.x, f.y, f.z, AIR, false);
  if (!quiet) smokePuff(f.x + 0.5, f.y + 0.4, f.z + 0.5, 2, 0x8a8a8a);
}
function douseNear(x, y, z, r = 2.6) {
  let n = 0; for (const [k, f] of [...fires]) if (Math.hypot(f.x - x, f.y - y, f.z - z) <= r) { putOutFire(k); n++; }
  if (n) { flushDirty(); hissSnd(); }
  return n;
}
for (const k in state.edits) if (state.edits[k] === FIRE) { const [x, y, z] = k.split(',').map(Number); fires.set(k, { x, y, z, life: 3 + Math.random() * 4, age: 0 }); }
let fireT = 0, burnT = 0, burnHitT = 0;
const NB6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function updateFires(dt) {
  fireT -= dt;
  if (fireT <= 0 && fires.size) {
    fireT = 0.5; let changed = false; const crowd = fires.size > 100 ? 0.4 : 1;
    for (const [k, f] of [...fires]) {
      if (!data.has(ckey(fdiv(f.x, CH), fdiv(f.z, CH)))) continue;
      if (get(f.x, f.y, f.z) !== FIRE) { fires.delete(k); continue; }
      f.age += 0.5;
      let wet = false; for (const [dx, dy, dz] of NB6) if (isWater(get(f.x + dx, f.y + dy, f.z + dz))) wet = true;
      if (wet || (precip(weatherAt(f.x, f.z)) && f.y >= rainTop(f.x, f.z) - 1 && Math.random() < 0.25)) { putOutFire(k); changed = true; continue; }
      let fuel = 0;
      for (const [dx, dy, dz] of NB6) {
        const nx = f.x + dx, ny = f.y + dy, nz = f.z + dz, id = get(nx, ny, nz); if (!FLAMMABLE.has(id)) continue; fuel++;
        const p = (id === LEAVES || id === SPRUCE ? 0.1 : 0.05) * (dy > 0 ? 1.6 : 1) * crowd;
        if (Math.random() < p && fires.size < FIRE_MAX && !state.crops[nx + ',' + ny + ',' + nz]) {   // the block itself catches and will burn away
          setBlock(nx, ny, nz, FIRE, false); fires.set(nx + ',' + ny + ',' + nz, { x: nx, y: ny, z: nz, life: 5 + Math.random() * 6, age: 0 }); changed = true;
          if (Math.random() < 0.3) smokePuff(nx + 0.5, ny + 1, nz + 0.5, 1, 0x555555);
        }
      }
      if (f.age > f.life + (fuel ? 2 : 0)) { putOutFire(k, true); changed = true; }
    }
    if (changed) flushDirty();
  }
  // standing in fire burns you (like fall damage: works on peaceful too), water or rain puts you out
  if (!player.alive || !playing) { burnT = 0; return; }
  const p = player.pos, fx = Math.floor(p.x), fz = Math.floor(p.z);
  if (get(fx, Math.floor(p.y), fz) === FIRE || get(fx, Math.floor(p.y + 1), fz) === FIRE) burnT = Math.max(burnT, 3);
  if (burnT > 0) {
    burnT -= dt * (precip(wxHere) && p.y >= rainTop(fx, fz) - 1 ? 2.5 : 1);
    if (inWater()) burnT = 0;
    burnHitT -= dt; if (burnHitT <= 0 && burnT > 0) { burnHitT = 0.9; damage(1, 'fire'); }
    if (Math.random() < dt * 8) particles(p.x + (Math.random() - 0.5) * 0.6, p.y + 0.3 + Math.random() * 1.4, p.z + (Math.random() - 0.5) * 0.6, 0xff8a20, 1);
  } else burnHitT = 0;
}

// ---- HUD line (stats box) and the per-frame hook
function hudWx() { return `<span style="font-size:12px;opacity:.85">${SEASONS[curSeason].e} ${SEASONS[curSeason].n} · ${WX[wxHere].e} ${WX[wxHere].n}${burnT > 0 ? ' · 🔥' : ''}</span>`; }
function updateWeather(dt) {
  checkSeason(); remeshSome(2);
  rainTopT -= dt; if (rainTopT <= 0) { rainTopT = 2; rainTopC.clear(); }
  wxT -= dt; if (wxT <= 0) { wxT = 1; const w = weatherAt(player.pos.x, player.pos.z); if (w !== wxHere) { wxHere = w; renderStats(); } }
  const k = Math.min(1, dt * 0.5);
  rainAmt += (((wxHere === 'rain' || wxHere === 'storm') ? 1 : 0) - rainAmt) * k;
  snowAmt += ((wxHere === 'snow' ? 1 : 0) - snowAmt) * k;
  stormAmt += ((wxHere === 'storm' ? 1 : 0) - stormAmt) * k;
  if (playing && wxHere === 'storm' && stormAmt > 0.6) { boltT -= dt; if (boltT <= 0) { boltT = 5 + Math.random() * 12; strike(); } }
  updateBolt(dt); updatePrecip(dt); rainSound(); updateFires(dt);
}
window.__dcW = { weatherAt, biomeOf, tempAt, terrainAt, strike, fireAt, putOutFire, douseNear, fires, chunkBiome, isOldCh, heightOld,
  setWeather(type, secs = 600) { wxOverride = { type, until: state.gameTime + secs }; wxT = 0; }, clearWeather() { wxOverride = null; wxT = 0; },
  get season() { return SEASONS[curSeason].n; }, get wx() { return wxHere; }, get amt() { return [rainAmt, snowAmt, stormAmt]; }, set amt(v) { [rainAmt, snowAmt, stormAmt] = v; },
  setView(v) { VIEW = v; }, streamNow() { let n = 0; while (streamChunks(60, 60) > 0 && n++ < 40) {} }, seasonIdx, get curSeason() { return curSeason; }, checkSeason,
  get strikes() { return strikes; }, get gameTime() { return state.gameTime; },
  get burnT() { return burnT; }, get remeshLeft() { return remeshQ.length; } };

// ================== v1.10 step 3: boats, yachts, cargo ships, people at sea ==================
// vessels ride on the water surface. kinds: 'boat' (yours, crafted), 'npcboat' (rowing / fishing locals),
// 'yacht' (board + drive it), 'cargo' (container ship on a route). While you're aboard, player.car = the vessel.
const vessels = [];
// one geometry with vertex colours from a list of [w, h, d, colour, x, y, z]
function mergedBoxes(list) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [w, h, d, hex, x, y, z] of list) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); c.setHex(hex);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
const VDEF = {
  boat: { len: 2.4, wid: 1.4, depth: 1, max: 5.5, turn: 1.7, sink: 0.3, cam: 5 },
  npcboat: { len: 2.4, wid: 1.4, depth: 1, max: 2, turn: 1, sink: 0.3 },
  yacht: { len: 11, wid: 3.8, depth: 2, max: 11, turn: 0.9, sink: 0.55, cam: 13 },
  cargo: { len: 27, wid: 6.6, depth: 3, max: 3.6, turn: 0.35, sink: 0.9 },
};
// a seated rower whose arms swing a pair of paddles
function rowerMesh(shirt, skin = 0xc58c63) {
  const g = new THREE.Group();
  box(0.44, 0.5, 0.28, shirt, 0, 0.25, 0, g); box(0.36, 0.38, 0.36, skin, 0, 0.7, 0, g); box(0.38, 0.1, 0.38, 0x2a1a0a, 0, 0.9, 0, g);
  box(0.4, 0.18, 0.5, 0x2a3a6a, 0, -0.05, 0.2, g);
  const arms = new THREE.Group(); arms.position.set(0, 0.42, 0); g.add(arms);
  box(0.12, 0.12, 0.42, shirt, -0.26, 0, 0.2, arms); box(0.12, 0.12, 0.42, shirt, 0.26, 0, 0.2, arms);
  return { g, arms };
}
function paddleMesh() {
  const p = new THREE.Group(); box(0.06, 0.06, 1.7, 0x8a6236, 0, 0, -0.5, p); box(0.06, 0.32, 0.5, 0x6b4a2a, 0, 0, -1.4, p); return p;
}
function buildVessel(kind) {
  const g = new THREE.Group(), out = { g, oars: [], rower: null, crew: [] };
  if (kind === 'boat' || kind === 'npcboat') {
    const wood = kind === 'boat' ? 0xb08850 : [0x9a6a3a, 0x3a7ab0, 0xd0d0c8, 0x3f8f5a][Math.floor(Math.random() * 4)], dark = 0x6b4a2a;
    g.add(mergedBoxes([[1.3, 0.12, 2.3, dark, 0, 0.06, 0], [0.12, 0.5, 2.4, wood, -0.66, 0.3, 0], [0.12, 0.5, 2.4, wood, 0.66, 0.3, 0], [1.44, 0.5, 0.12, wood, 0, 0.3, 1.2], [1.44, 0.5, 0.12, wood, 0, 0.3, -1.2],
      [1.0, 0.36, 0.3, wood, 0, 0.35, 1.45], [1.2, 0.08, 0.36, dark, 0, 0.36, -0.15], [1.2, 0.08, 0.3, dark, 0, 0.36, 0.85]]));
    for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 0.7, 0.55, -0.1); piv.add(paddleMesh()); piv.rotation.y = s * 1.2; g.add(piv); out.oars.push(piv); }
    if (kind === 'npcboat') { const r = rowerMesh(CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)], [0xf1c27d, 0xc58c63, 0x8d5524][Math.floor(Math.random() * 3)]); r.g.position.set(0, 0.42, -0.15); g.add(r.g); out.rower = r; }
  } else if (kind === 'yacht') {
    const W = 0xf4f4f2, B2 = [0x1c3f7a, 0x111111, 0x7a1c1c][Math.floor(Math.random() * 3)], teak = 0xb07a48, glass = 0x26323e;
    g.add(mergedBoxes([
      [3.8, 1.3, 7.4, W, 0, 0.65, -0.6], [3.2, 1.25, 1.4, W, 0, 0.7, 3.7], [2.4, 1.2, 1.1, W, 0, 0.75, 4.9], [1.4, 1.15, 0.9, W, 0, 0.8, 5.8], [0.6, 1.1, 0.6, W, 0, 0.85, 6.4],
      [3.82, 0.22, 7.42, B2, 0, 0.95, -0.6], [3.22, 0.22, 1.42, B2, 0, 1.0, 3.7], [2.42, 0.22, 1.12, B2, 0, 1.05, 4.9],
      [3.6, 0.08, 7.2, teak, 0, 1.33, -0.6], [3.0, 0.08, 1.3, teak, 0, 1.36, 3.7], [3.6, 0.12, 1.0, teak, 0, 0.3, -4.8],
      [2.8, 1.1, 3.6, W, 0, 1.92, -0.6], [2.82, 0.5, 3.62, glass, 0, 2.05, -0.6], [2.4, 0.1, 2.6, W, 0, 2.52, -0.9], [2.2, 0.6, 0.1, glass, 0, 2.0, 1.25],
      [0.06, 0.5, 6.8, 0xc8c8c8, 1.75, 1.6, -0.4], [0.06, 0.5, 6.8, 0xc8c8c8, -1.75, 1.6, -0.4], [2.0, 0.06, 0.06, 0xc8c8c8, 0, 1.85, 4.3],
      [0.1, 1.4, 0.1, 0xc8c8c8, 0, 3.2, -0.6], [0.5, 0.3, 0.3, 0x333333, 0.5, 1.7, 1.8], [0.6, 0.5, 0.6, W, 0, 1.6, 1.0]]));
    const lamp = box(0.14, 0.14, 0.14, 0xffffff, 0, 3.95, -0.6, g); lamp.material.emissive.setHex(0xffffcc);
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) { const p = personMesh(); p.position.set(i ? -0.9 : 0.9, 1.65, -3.6 + i * 0.6); g.add(p); out.crew.push(p); }
  } else if (kind === 'cargo') {
    const hullC = [0x1d2a44, 0x2a2a2a, 0x7a2020, 0x1f4a2a][Math.floor(Math.random() * 4)], list = [
      [6.6, 3.0, 21, hullC, 0, 1.5, -1], [5.8, 2.9, 2.2, hullC, 0, 1.55, 10.6], [4.4, 2.8, 1.6, hullC, 0, 1.6, 12.4], [2.6, 2.7, 1.2, hullC, 0, 1.65, 13.6],
      [6.62, 0.7, 21.02, 0xa02020, 0, 0.35, -1], [6.4, 0.12, 20.8, 0x6a6a6a, 0, 3.02, -1], [5.6, 0.12, 4, 0x6a6a6a, 0, 3.0, 11.5],
      [6.0, 4.2, 3.2, 0xf0f0ea, 0, 5.1, -9.2], [6.02, 0.5, 3.22, 0x223344, 0, 6.5, -9.2], [6.8, 0.5, 1.2, 0xf0f0ea, 0, 6.9, -8.2], [1.2, 2.2, 1.2, 0xd03020, 0, 8.2, -10], [1.22, 0.4, 1.22, 0x111111, 0, 9.2, -10]];
    const CC = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400, 0x7f8c8d, 0xe8e8e8, 0x1f3a93];
    for (let row = 0; row < 4; row++) for (let a = 0; a < 5; a++) { const hgt = 1 + Math.floor(Math.random() * 3); for (let s = 0; s < hgt; s++) {
      const col = CC[Math.floor(Math.random() * CC.length)]; list.push([1.36, 1.3, 2.9, col, -2.25 + row * 1.5, 3.75 + s * 1.34, -5.6 + a * 3.05]);
      list.push([1.38, 0.08, 2.92, 0x222222, -2.25 + row * 1.5, 3.12 + s * 1.34, -5.6 + a * 3.05]); } }
    g.add(mergedBoxes(list));
    for (const [lx, lz, c] of [[0, -10, 0xffffff], [3.3, 0, 0x20ff40], [-3.3, 0, 0xff2020]]) { const l = box(0.2, 0.2, 0.2, c, lx, lx ? 3.4 : 9.6, lz, g); l.material.emissive.setHex(c); }
  }
  return out;
}
// water surface helpers: wl = y of the top water cell under a point
function waterLevelAt(x, z, yHint = SEA + 6) {
  const fx = Math.floor(x), fz = Math.floor(z);
  for (let y = Math.min(H - 2, Math.floor(yHint) + 2); y > 0; y--) { const id = get(fx, y, fz); if (isWater(id)) return isWater(get(fx, y + 1, fz)) ? -1 : y; if (id !== AIR && !PLANT.has(id)) return -1; }
  return -1;
}
function floatsAt(x, z, wl, depth) {
  const fx = Math.floor(x), fz = Math.floor(z);
  if (!isWater(get(fx, wl, fz)) || solid(get(fx, wl + 1, fz))) return false;
  for (let k = 1; k < depth; k++) if (!isWater(get(fx, wl - k, fz))) return false;
  return true;
}
// hull footprint points (bow, stern, sides) at a position/heading
function hullPts(kind, x, z, head, ahead = 0) {
  const d = VDEF[kind], fx = Math.sin(head), fz = Math.cos(head), L = d.len / 2 + ahead, W = d.wid / 2;
  const pts = [[L, 0], [L - Math.min(1.2, d.len * 0.2), W * 0.7], [L - Math.min(1.2, d.len * 0.2), -W * 0.7], [-d.len / 2, W * 0.8], [-d.len / 2, -W * 0.8], [0, W], [0, -W]];
  return pts.map(([a, s]) => [x + fx * a + fz * s, z + fz * a - fx * s]);
}
const hullFloats = (v, x, z, head, ahead) => hullPts(v.kind, x, z, head, ahead).every(([px, pz]) => floatsAt(px, pz, v.wl, VDEF[v.kind].depth));
let vesselId = 1;
function spawnVessel(kind, x, z, wl, opts = {}) {
  const parts = buildVessel(kind), v = { ...parts, kind, x, z, wl, y: wl + 1 - VDEF[kind].sink, head: opts.head ?? Math.random() * 6.28, speed: 0, ai: kind !== 'boat', vessel: true, id: vesselId++, phase: Math.random() * 6, turnT: 0, fish: kind === 'npcboat' && Math.random() < 0.4, ...opts };
  v.want = v.head; v.g.position.set(v.x, v.y, v.z); v.g.rotation.y = v.head; scene.add(v.g); vessels.push(v); return v;
}
function removeVessel(v) { scene.remove(v.g); vessels.splice(vessels.indexOf(v), 1); }
// ---- placing / boarding / leaving your boat
function placeBoat() {
  const w = raycast(5, true); if (!w || w.kind !== 'water') { toast('🛶 Put the boat on water'); return true; }
  const wl = waterLevelAt(w.x + 0.5, w.z + 0.5, w.y + 1); if (wl < 0) { toast('🛶 Put the boat on water'); return true; }
  const v = spawnVessel('boat', w.x + 0.5, w.z + 0.5, wl, { head: player.yaw + Math.PI });
  if (!hullFloats(v, v.x, v.z, v.head, 0) && !hullPts('boat', v.x, v.z, v.head).some(([px, pz]) => floatsAt(px, pz, wl, 1))) { removeVessel(v); toast('🛶 Not enough water here'); return true; }
  useHeld(1); beep(220, 0.1, 'triangle', 0.06); toast(count('paddle') ? '🛶 Tap the boat to get in' : '🛶 Tap the boat to get in (craft a paddle to row properly)'); return true;
}
function boardVessel(v) {
  if (v.kind === 'cargo') { toast('🚢 Cargo ships don\'t take passengers'); return; }
  if (v.kind === 'npcboat') { toast('🎣 Someone\'s already rowing that one'); return; }
  player.car = v; v.ai = false; v.speed = 0; v.lastHead = v.head; player.yaw = v.head + Math.PI; player.pitch = -0.15;
  if (v.kind === 'boat' && !v.rower) { const r = rowerMesh(mySkinShirt()); r.g.position.set(0, 0.42, -0.15); v.g.add(r.g); v.rower = r; }
  if (v.kind === 'boat') v.rower.g.visible = true;
  toast(v.kind === 'yacht' ? '🛥️ You\'re the captain! Jump to get off' : count('paddle') ? '🛶 Rowing! Jump to get out' : '🛶 No paddle: you can only drift slowly. Jump to get out');
  beep(180, 0.15, 'sine', 0.05);
}
function mySkinShirt() { try { const s = JSON.parse(localStorage.getItem('dc_skin') || 'null'); if (s && s.shirt) return parseInt(String(s.shirt).replace('#', ''), 16); } catch (e) {} return 0x2a8ad2; }
function exitVessel() {
  const v = player.car; if (!v || !v.vessel) return; player.car = null; v.speed = 0;
  if (v.rower && v.kind === 'boat') v.rower.g.visible = false;
  // step onto the nearest dry land, otherwise hop into the water beside it
  let best = null;
  for (let r = 1; r <= 4 && !best; r++) for (let a = 0; a < 16; a++) {
    const x = v.x + Math.cos(a / 16 * 6.283) * (VDEF[v.kind].wid / 2 + r), z = v.z + Math.sin(a / 16 * 6.283) * (VDEF[v.kind].wid / 2 + r);
    for (let y = v.wl + 2; y >= v.wl - 1; y--) { const fx = Math.floor(x), fz = Math.floor(z); if (solid(get(fx, y - 1, fz)) && !solid(get(fx, y, fz)) && !solid(get(fx, y + 1, fz)) && !isWater(get(fx, y, fz))) { best = [fx + 0.5, y, fz + 0.5]; break; } }
    if (best) break;
  }
  if (!best) { const s = VDEF[v.kind].wid / 2 + 0.8; best = [v.x + Math.cos(v.head) * s, v.wl + 0.2, v.z - Math.sin(v.head) * s]; }
  player.pos.set(best[0], best[1], best[2]); player.vel.set(0, 0, 0); player.fallStart = null;
}
// ---- driving (boat: needs a paddle to really row; yacht: engine) with a chase camera
function driveVessel(v, dt) {
  const d = VDEF[v.kind];
  let thr = 0, steer = 0;
  if (keys.KeyW || keys.ArrowUp) thr += 1; if (keys.KeyS || keys.ArrowDown) thr -= 1;
  if (keys.KeyA || keys.ArrowLeft) steer += 1; if (keys.KeyD || keys.ArrowRight) steer -= 1;
  if (joy.id !== null) { thr -= joy.y; steer -= joy.x; }
  thr = Math.max(-1, Math.min(1, thr)); steer = Math.max(-1, Math.min(1, steer));
  const max = v.kind === 'boat' && !count('paddle') ? 1.4 : d.max;
  v.speed += (thr * (thr >= 0 ? max : max * 0.4) - v.speed) * Math.min(1, dt * (thr ? 1.1 : 0.35));   // lets go: drifts on
  v.head += steer * dt * d.turn * (v.kind === 'boat' ? 1 : Math.min(1, Math.abs(v.speed) / 3 + 0.25));
  moveVessel(v, dt);
  if (v.kind === 'boat') rowAnim(v, dt, Math.abs(thr) + Math.abs(steer) * 0.6);
  player.yaw += v.head - v.lastHead; v.lastHead = v.head;
  const seat = v.kind === 'yacht' ? [0, 1.9, 1.0] : [0, 0.5, -0.15], fx = Math.sin(v.head), fz = Math.cos(v.head);
  player.pos.set(v.x + fx * seat[2], v.y + seat[1] - 0.2, v.z + fz * seat[2]);
  const pt = Math.min(0.6, Math.max(-0.9, player.pitch)), cp = Math.cos(pt), fwd = new THREE.Vector3(-Math.sin(player.yaw) * cp, Math.sin(pt), -Math.cos(player.yaw) * cp);
  const focus = new THREE.Vector3(v.x, v.y + (v.kind === 'yacht' ? 2.4 : 1.1), v.z); let dist = d.cam;
  for (let s = 1; s <= d.cam; s += 0.5) { const q = focus.clone().addScaledVector(fwd, -s); q.y += 0.8; if (solid(get(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z)))) { dist = Math.max(1.2, s - 0.6); break; } }
  camera.position.copy(focus).addScaledVector(fwd, -dist); camera.position.y += v.kind === 'yacht' ? 2 : 0.8; camera.lookAt(focus.x + fwd.x * 3, focus.y + 0.3 + fwd.y * 3, focus.z + fwd.z * 3);
  if (keys.Space || wantJump) { wantJump = false; keys.Space = false; exitVessel(); return; }
  if (v.kind === 'yacht') { engineT -= dt; if (engineT <= 0) { engineT = 0.2; beep(45 + Math.abs(v.speed) * 6, 0.19, 'sawtooth', 0.015); } }
  else if (Math.abs(thr) > 0.2 && count('paddle')) { v.splashT = (v.splashT || 0) - dt; if (v.splashT <= 0) { v.splashT = 0.9; noiseBurst(0.12, 0.05, 900); } }
}
// move along the heading; stop at the shore (a little bump back), bob on the waves
function moveVessel(v, dt) {
  const nx = v.x + Math.sin(v.head) * v.speed * dt, nz = v.z + Math.cos(v.head) * v.speed * dt;
  if (Math.abs(v.speed) > 0.01) {
    const sgn = Math.sign(v.speed), dep = VDEF[v.kind].depth, hd = v.head + (sgn < 0 ? Math.PI : 0), nf = (x, z) => hullPts(v.kind, x, z, hd, 0.15).filter(([px, pz]) => floatsAt(px, pz, v.wl, dep)).length;
    const np = nf(nx, nz), ok = np === 7 || (np >= nf(v.x, v.z) && np > 0 && v !== player.car);   // a ship stuck in the shallows may still work its way out
    if (ok) { v.x = nx; v.z = nz; } else { if (Math.abs(v.speed) > 2 && v === player.car) noiseBurst(0.1, 0.08, 250); v.speed = -v.speed * 0.15; v.blocked = (v.blocked || 0) + 1; }
  }
  v.phase += dt;
  const bob = Math.sin(v.phase * 1.6 + v.id) * (v.kind === 'cargo' ? 0.04 : 0.07);
  v.g.position.set(v.x, v.y + bob, v.z); v.g.rotation.set(Math.sin(v.phase * 1.1 + v.id) * (v.kind === 'cargo' ? 0.004 : 0.025), v.head, Math.sin(v.phase * 1.3) * (v.kind === 'cargo' ? 0.006 : 0.035));
}
function rowAnim(v, dt, effort) {
  v.row = (v.row || 0) + dt * (effort > 0.05 ? 5 : 0);
  const a = Math.sin(v.row);
  v.oars.forEach((o, i) => { const s = i ? 1 : -1; o.rotation.set(effort > 0.05 ? 0.25 + Math.cos(v.row) * 0.25 : 0.45, s * (1.3 + a * 0.45), s * -0.25); });
  if (v.rower) { v.rower.arms.rotation.x = -0.2 + a * 0.35; v.rower.g.rotation.x = a * 0.08; }
}
// ---- AI sailing: keep to open water, turn away from coasts, wander slowly
function sailAI(v, dt) {
  const d = VDEF[v.kind];
  if (v.fish) { v.speed *= 0.97; rowAnim(v, dt, 0); if (v.rower) v.rower.arms.rotation.x = -0.6; v.phase += 0; }
  else {
    v.turnT -= dt;
    const look = Math.max(4, d.len * 0.5 + v.speed * 2.2);
    if (v.turnT <= 0) {
      v.turnT = 0.6 + Math.random() * 0.4;
      if (!hullFloats(v, v.x, v.z, v.want, look)) {
        let found = null; for (const off of [0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) { const h = v.want + off * (v.side || 1); if (hullFloats(v, v.x, v.z, h, look) && hullFloats(v, v.x, v.z, h, look * 0.5)) { found = h; break; } }
        if (found != null) v.want = found; else v.want += Math.PI * 0.5;
      } else if (Math.random() < 0.08) v.want += (Math.random() - 0.5) * 0.6;
      if (Math.random() < 0.05) v.side = Math.random() < 0.5 ? 1 : -1;
    }
    let dh = ((v.want - v.head + Math.PI * 3) % (Math.PI * 2)) - Math.PI; v.head += Math.max(-d.turn * dt, Math.min(d.turn * dt, dh));
    const target = Math.abs(dh) > 0.8 ? d.max * 0.4 : d.max;
    v.speed += (target - v.speed) * Math.min(1, dt * 0.5);
    if (v.kind === 'npcboat') rowAnim(v, dt, 1);
  }
  moveVessel(v, dt);
  if (v.blocked > 6) { v.want += Math.PI; v.blocked = 0; }
  if (v.crew.length) v.crew.forEach((p, i) => { p.rotation.y = Math.sin(v.phase * 0.5 + i * 2) * 1.2; });
}
// ---- the spawner: people rowing and fishing, yachts and container ships out on open water near you
let seaT = 0;
function openWater(x, z, r, depth) {
  const wl = waterLevelAt(x, z); if (wl < 0 || wl !== SEA) return -1;
  for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * 0.785) * r, pz = z + Math.sin(a * 0.785) * r; if (!floatsAt(px, pz, wl, depth)) return -1; }
  return floatsAt(x, z, wl, depth) ? wl : -1;
}
function updateSea(dt) {
  const pp = player.pos;
  for (const v of [...vessels]) {
    const dd = Math.hypot(v.x - pp.x, v.z - pp.z);
    if (v.ai && dd > 170) { removeVessel(v); continue; }
    if (v === player.car) { driveVessel(v, dt); continue; }
    if (v.ai) sailAI(v, dt); else { v.speed *= Math.pow(0.4, dt); moveVessel(v, dt); }
  }
  seaT -= dt; if (seaT > 0 || !playing) return; seaT = 2;
  const near = vessels.filter(v => v.ai), n = k => near.filter(v => v.kind === k).length;
  for (let tries = 0; tries < 6; tries++) {
    const a = Math.random() * 6.283, r = 55 + Math.random() * 60, x = pp.x + Math.cos(a) * r, z = pp.z + Math.sin(a) * r;
    if (!data.has(ckey(fdiv(Math.floor(x), CH), fdiv(Math.floor(z), CH)))) continue;
    const roll = Math.random(), kind = roll < 0.22 ? 'cargo' : roll < 0.5 ? 'yacht' : 'npcboat';
    if ((kind === 'cargo' && n('cargo') >= 2) || (kind === 'yacht' && n('yacht') >= 2) || (kind === 'npcboat' && n('npcboat') >= 4)) continue;
    const wl = openWater(x, z, kind === 'cargo' ? 16 : kind === 'yacht' ? 8 : 4, VDEF[kind].depth); if (wl < 0) continue;
    if (vessels.some(o => Math.hypot(o.x - x, o.z - z) < 25)) continue;
    const v = spawnVessel(kind, x, z, wl);
    if (!hullFloats(v, x, z, v.head, 2)) { let ok = false; for (let k = 0; k < 8 && !ok; k++) { v.head = v.want = k * 0.785; ok = hullFloats(v, x, z, v.head, 2); } if (!ok) { removeVessel(v); continue; } }
    break;
  }
}
// your own boats are saved with the world (yachts and ships are not)
function syncBoats() { state.boats = vessels.filter(v => v.kind === 'boat').map(v => ({ x: +v.x.toFixed(2), z: +v.z.toFixed(2), wl: v.wl, head: +v.head.toFixed(3) })); }
for (const b of state.boats || []) spawnVessel('boat', b.x, b.z, b.wl, { head: b.head, ai: false });
// hold to break your own boat: you get it back
let vBreak = { v: null, t: 0 };
function vesselBreak(h, dt) {
  if (!h || h.kind !== 'vessel' || h.c.kind !== 'boat') { vBreak.v = null; return false; }
  if (vBreak.v !== h.c) { vBreak.v = h.c; vBreak.t = 0; }
  vBreak.t += dt; swing(); if (Math.random() < dt * 6) beep(130, 0.04, 'square', 0.03);
  if (vBreak.t > 0.6) { removeVessel(h.c); give('boat', 1); toast('🛶 Picked up your boat'); vBreak.v = null; }
  return true;
}
function vesselHit(ray, o, maxD, hit, tmp) {
  for (const v of vessels) {
    if (v === player.car) continue;
    const d = VDEF[v.kind], sx = Math.abs(Math.sin(v.head)), w = d.wid / 2 + sx * (d.len - d.wid) / 2, l = d.len / 2 - sx * (d.len - d.wid) / 2;
    const b = new THREE.Box3(new THREE.Vector3(v.x - w, v.y - 0.3, v.z - l), new THREE.Vector3(v.x + w, v.y + (v.kind === 'yacht' ? 2.2 : v.kind === 'cargo' ? 4 : 0.8), v.z + l));
    const p = ray.intersectBox(b, tmp); if (p) { const dist = p.distanceTo(o); if (dist < maxD && (!hit || dist < hit.t)) hit = { kind: 'vessel', c: v, t: dist }; }
  }
  return hit;
}
const VLABEL = { boat: '🛶 ✋ Get in · hold to pick up', npcboat: '🎣 A local out on the water', yacht: '🛥️ ✋ Board and drive the yacht', cargo: '🚢 Container ship' };

// ================== v1.10 step 3: emergency services + pedestrian respawn ==================
// Fire trucks drive (on the road grid) to fires in towns, park, and the crew hoses them down (putOutFire/douseNear).
// Ambulances come for knocked-out or badly hurt townsfolk. Neither ever hurts the player: they stop for you.
const services = [], incidents = [];
const townById = id => { for (const t of townsNear(160)) if (t.id === id) return t; return null; };
function buildService(kind) {
  const g = new THREE.Group(), fire = kind === 'fire', red = 0xc81e1e, white = 0xf2f2f2;
  if (fire) g.add(mergedBoxes([[2.2, 1.5, 5.4, red, 0, 1.25, -0.4], [2.2, 1.0, 1.7, red, 0, 1.0, 2.9], [2.0, 0.6, 1.4, 0x9ad0ff, 0, 1.75, 2.85], [2.22, 0.18, 7.2, 0xdddddd, 0, 1.0, 0.3],
    [2.24, 0.14, 5.0, 0xf2d21a, 0, 1.35, -0.4], [0.5, 0.2, 4.6, 0xb8b8b8, -0.4, 2.15, -0.4], [0.5, 0.2, 4.6, 0xb8b8b8, 0.4, 2.15, -0.4], [1.0, 0.08, 0.1, 0xb8b8b8, 0, 2.2, -2.2], [1.0, 0.08, 0.1, 0xb8b8b8, 0, 2.2, 1.0],
    [2.22, 0.12, 7.2, 0x222222, 0, 0.36, 0.3]]));
  else g.add(mergedBoxes([[2.1, 1.9, 3.4, white, 0, 1.45, -0.6], [2.0, 1.2, 1.4, white, 0, 1.05, 1.8], [1.9, 0.5, 1.0, 0x9ad0ff, 0, 1.55, 1.9], [2.12, 0.3, 4.82, 0xd02020, 0, 1.1, 0.1],
    [0.12, 0.6, 0.2, 0xd02020, 1.07, 1.75, -0.6], [0.12, 0.2, 0.6, 0xd02020, 1.07, 1.75, -0.6], [0.12, 0.6, 0.2, 0xd02020, -1.07, 1.75, -0.6], [0.12, 0.2, 0.6, 0xd02020, -1.07, 1.75, -0.6],
    [2.12, 0.12, 4.82, 0x222222, 0, 0.42, 0.1]]));
  const L = fire ? 7.2 : 4.8, wz = fire ? [2.6, -2.6] : [1.6, -1.4];
  for (const wx of [-0.95, 0.95]) for (const z of wz) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), tyreMat); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.4, z); g.add(w); }
  const ly = fire ? 2.1 : 2.45, lz = fire ? 2.4 : 0.4;
  const lights = [box(0.7, 0.18, 0.3, 0xff2020, -0.45, ly, lz, g), box(0.7, 0.18, 0.3, fire ? 0xffffff : 0x2050ff, 0.45, ly, lz, g)];
  for (const hx of [-0.7, 0.7]) { const h = box(0.36, 0.16, 0.04, 0xfff2b0, hx, 0.7, (fire ? 3.75 : 2.52), g); h.material.emissive.setHex(0xffe080); }
  return { g, lights, L };
}
function crewMesh(kind) {
  const g = new THREE.Group(), fire = kind === 'fire';
  const coat = fire ? 0x3a3020 : 0x2a6ad2, helm = fire ? 0xd02020 : 0xffffff;
  const legs = [pivotLimb(g, 0.22, 0.72, 0.22, fire ? 0x3a3020 : 0x1a2a4a, -0.12, 0.72, 0), pivotLimb(g, 0.22, 0.72, 0.22, fire ? 0x3a3020 : 0x1a2a4a, 0.12, 0.72, 0)];
  box(0.52, 0.75, 0.3, coat, 0, 1.1, 0, g); if (fire) box(0.54, 0.08, 0.32, 0xf2e21a, 0, 0.95, 0, g);
  box(0.44, 0.48, 0.44, 0xc58c63, 0, 1.72, 0, g); box(0.5, 0.18, 0.54, helm, 0, 2.0, 0.02, g);
  const arms = [pivotLimb(g, 0.18, 0.7, 0.18, coat, -0.34, 1.45, 0), pivotLimb(g, 0.18, 0.7, 0.18, coat, 0.34, 1.45, 0)];
  if (fire) { const nz = box(0.1, 0.1, 0.6, 0x222222, 0, -0.65, 0.25, arms[1]); }
  scene.add(g); return { g, legs, arms, walk: 0 };
}
// ---- road routes on a town's grid: road centre lines at x0 + 16m + 2 and z0 + 16m + 2
const roadLine = (t, m, ax) => (ax ? t.x0 : t.z0) + m * 16 + 2;
function nearestRoad(t, x, z) {   // nearest point on a road centre line: { x, z, ax: true = on an x-line (runs along z) }
  const mx = Math.max(0, Math.min(t.nb || 3, Math.round((x - t.x0 - 2) / 16))), mz = Math.max(0, Math.min(t.nb || 3, Math.round((z - t.z0 - 2) / 16)));
  const X = roadLine(t, mx, true), Z = roadLine(t, mz, false), cz = Math.max(t.z0 + 2, Math.min(t.z1 - 2, z)), cx = Math.max(t.x0 + 2, Math.min(t.x1 - 2, x));
  return Math.abs(X - x) <= Math.abs(Z - z) ? { x: X, z: cz, ax: true, m: mx } : { x: cx, z: Z, ax: false, m: mz };
}
function roadRoute(t, S, T) {
  if (S.ax === T.ax) {
    if (Math.abs((S.ax ? S.x - T.x : S.z - T.z)) < 0.5) return [[T.x, T.z]];
    if (S.ax) { const k = nearestRoad(t, T.x, T.z), Zk = roadLine(t, Math.max(0, Math.min(t.nb || 3, Math.round((T.z - t.z0 - 2) / 16))), false); return [[S.x, Zk], [T.x, Zk], [T.x, T.z]]; }
    const Xk = roadLine(t, Math.max(0, Math.min(t.nb || 3, Math.round((T.x - t.x0 - 2) / 16))), true); return [[Xk, S.z], [Xk, T.z], [T.x, T.z]];
  }
  return S.ax ? [[S.x, T.z], [T.x, T.z]] : [[T.x, S.z], [T.x, T.z]];
}
function serviceStart(t) {   // somewhere on the road grid out of your sight
  const pp = player.pos, nb = t.nb || 3;
  for (let i = 0; i < 40; i++) {
    const ax = Math.random() < 0.5, m = Math.floor(Math.random() * (nb + 1)), along = (ax ? t.z0 : t.x0) + 2 + Math.random() * ((ax ? t.z1 - t.z0 : t.x1 - t.x0) - 4);
    const x = ax ? roadLine(t, m, true) : along, z = ax ? along : roadLine(t, m, false), d = Math.hypot(x - pp.x, z - pp.z);
    if (d < 34 || d > 85 || !data.has(ckey(fdiv(Math.floor(x), CH), fdiv(Math.floor(z), CH)))) continue;
    const dir = getDir(); if (d < 55 && (dir.x * (x - pp.x) + dir.z * (z - pp.z)) / d > 0.3) continue;   // in front of you and not far: try again
    return { x, z, ax, m };
  }
  return null;
}
function dispatch(kind, t, tx, tz, job) {
  const S = serviceStart(t); if (!S) return null;
  const T = nearestRoad(t, tx, tz), route = roadRoute(t, S, T), parts = buildService(kind);
  const s = { kind, t, ...parts, x: S.x, z: S.z, y: t.base + 1, head: Math.atan2(route[0][0] - S.x, route[0][1] - S.z), speed: 0, route, wp: 0, stage: 'go', S, T, job, crew: [], waitT: 0, stuck: 0, sirenT: 0 };
  s.g.position.set(s.x, s.y, s.z); s.g.rotation.y = s.head; scene.add(s.g); services.push(s);
  return s;
}
function removeService(s) { scene.remove(s.g); for (const c of s.crew) scene.remove(c.g); services.splice(services.indexOf(s), 1); if (s.job && s.job.inc) s.job.inc.taken = false; }
function svcAhead(s) {   // never run anyone over: player, townsfolk, other vehicles in front -> stop
  const fx = Math.sin(s.head), fz = Math.cos(s.head), reach = s.L / 2 + 3;
  const hit = (x, z) => { const dx = x - s.x, dz = z - s.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx); return along > 0 && along < reach && side < 1.5; };
  if (!player.car && hit(player.pos.x, player.pos.z) && Math.abs(player.pos.y - s.y) < 2.5) return 'player';
  if (player.car && hit(player.car.x, player.car.z)) return 'player';
  for (const m of mobs) if (hit(m.g.position.x, m.g.position.z)) return m;
  for (const c of cars) if (hit(c.x, c.z)) return c;
  for (const o of services) if (o !== s && hit(o.x, o.z)) return o;
  return null;
}
function driveRoute(s, dt) {
  const w = s.route[s.wp]; if (!w) return true;
  const dx = w[0] - s.x, dz = w[1] - s.z, d = Math.hypot(dx, dz);
  const last = s.wp === s.route.length - 1;
  if (d < 0.6) { s.wp++; return s.wp >= s.route.length; }
  const want = Math.atan2(dx, dz); let dh = ((want - s.head + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  s.head += Math.max(-3 * dt, Math.min(3 * dt, dh));
  const ahead = svcAhead(s);
  let target = ahead ? 0 : Math.abs(dh) > 0.6 ? 3 : last ? Math.min(9, 1 + d * 0.9) : Math.min(10, 2 + d * 1.2);
  if (ahead) { s.stuck += dt; if (ahead !== 'player' && s.stuck > 4) target = 2; if (s.stuck > 1 && ahead === 'player') { s.honk = (s.honk || 0) - dt; if (s.honk <= 0) { s.honk = 2; beep(300, 0.3, 'square', 0.04); } } } else s.stuck = 0;
  s.speed += (target - s.speed) * Math.min(1, dt * 2.5);
  const step = Math.min(d, s.speed * dt); s.x += Math.sin(s.head) * step; s.z += Math.cos(s.head) * step;
  return false;
}
function sirenFor(s, dt, t) {
  const on = s.stage === 'go' || s.stage === 'work' || s.stage === 'park';
  const f = Math.floor(t * 7) % 2;
  s.lights[0].material.emissive.setHex(on && f ? 0xff0000 : 0x200000); s.lights[1].material.emissive.setHex(on && !f ? (s.kind === 'fire' ? 0xffffff : 0x0040ff) : 0x000000);
  if (s.stage !== 'go') return;
  s.sirenT -= dt; const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
  if (s.sirenT <= 0 && d < 70) { const v = 0.04 * Math.max(0.2, 1 - d / 70); s.sirenT = 1.3;
    if (s.kind === 'fire') { beep(560, 0.6, 'sawtooth', v); setTimeout(() => beep(820, 0.6, 'sawtooth', v), 650); }
    else { beep(960, 0.32, 'square', v * 0.8); setTimeout(() => beep(720, 0.32, 'square', v * 0.8), 330); setTimeout(() => beep(960, 0.32, 'square', v * 0.8), 660); setTimeout(() => beep(720, 0.32, 'square', v * 0.8), 990); } }
}
function walkCrew(c, tx, tz, dt, y) {
  const p = c.g.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d > 0.3) { const st = Math.min(d, 2.4 * dt); p.x += dx / d * st; p.z += dz / d * st; c.g.rotation.y = Math.atan2(dx, dz); c.walk += dt * 9; }
  p.y = y; const a = d > 0.3 ? Math.sin(c.walk) * 0.6 : 0; c.legs[0].rotation.x = a; c.legs[1].rotation.x = -a; c.arms[0].rotation.x = -a * 0.7;
  return d <= 0.3;
}
// hose water from a crew member (or the truck's ladder) to the fire
function spray(from, to) {
  for (let i = 0; i < 3; i++) { const k = Math.random(), x = from.x + (to.x - from.x) * k, z = from.z + (to.z - from.z) * k, y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 1.4;
    particles(x, y, z, new THREE.Color(0.55, 0.75, 1), 1); }
}
const nearestFire = (x, y, z, r) => { let best = null, bd = r; for (const [k, f] of fires) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = [k, f]; } } return best; };
function updateServices(dt, t) {
  if (!playing) return;
  for (const s of [...services]) {
    sirenFor(s, dt, t);
    if (Math.hypot(s.x - player.pos.x, s.z - player.pos.z) > 150) { removeService(s); continue; }
    if (s.stage === 'go') { if (driveRoute(s, dt)) { s.stage = 'park'; s.speed = 0; s.waitT = 0.6; } }
    else if (s.stage === 'park') {
      s.waitT -= dt; if (s.waitT <= 0) { s.stage = 'work'; s.workT = 0;
        const n = s.kind === 'fire' ? 2 : 1; for (let i = 0; i < n; i++) { const c = crewMesh(s.kind); c.g.position.set(s.x + Math.cos(s.head) * 1.4 * (i ? -1 : 1), s.y, s.z - Math.sin(s.head) * 1.4 * (i ? -1 : 1)); s.crew.push(c); } }
    } else if (s.stage === 'work') {
      s.workT += dt;
      if (s.kind === 'fire') {
        const tgt = nearestFire(s.x, s.y, s.z, 26);
        if (!tgt || s.workT > 90) { s.stage = 'pack'; }
        else {
          const [, f] = tgt, fy = f.y + 0.5;
          s.crew.forEach((c, i) => { const a = Math.atan2(c.g.position.x - f.x, c.g.position.z - f.z) + (i ? 0.5 : -0.5), gx = f.x + 0.5 + Math.sin(a) * 3, gz = f.z + 0.5 + Math.cos(a) * 3;
            const gy = Math.max(s.y, groundAt(gx, gz)); const there = walkCrew(c, gx, gz, dt, gy > s.y + 2 ? s.y : gy);
            if (there || Math.hypot(c.g.position.x - f.x, c.g.position.z - f.z) < 7) { c.g.rotation.y = Math.atan2(f.x + 0.5 - c.g.position.x, f.z + 0.5 - c.g.position.z); c.arms[1].rotation.x = -1.3; spray(new THREE.Vector3(c.g.position.x, c.g.position.y + 1.3, c.g.position.z), new THREE.Vector3(f.x + 0.5, fy, f.z + 0.5)); c.hoseT = (c.hoseT || 0) + dt; } });
          if (fy > s.y + 5) spray(new THREE.Vector3(s.x, s.y + 2.4, s.z), new THREE.Vector3(f.x + 0.5, fy, f.z + 0.5));   // the ladder cannon reaches high fires
          s.douseT = (s.douseT || 0) - dt;
          if (s.douseT <= 0 && (s.crew.some(c => c.hoseT > 0.8) || fy > s.y + 5)) { s.douseT = 0.7; douseNear(f.x, f.y, f.z, 2.8); s.doused = (s.doused || 0) + 1; }
        }
      } else {
        const inc = s.job.inc, c = s.crew[0], m = inc.ped && mobs.includes(inc.ped) ? inc.ped : null, tx = m ? m.g.position.x : inc.x, tz = m ? m.g.position.z : inc.z;
        if (m) { m.target = null; m.wait = 2; }
        if (walkCrew(c, tx + 0.6, tz, dt, m ? m.g.position.y : inc.y)) {
          c.legs[0].rotation.x = -1.2; c.legs[1].rotation.x = 0.2; c.g.position.y -= 0.35; inc.care = (inc.care || 0) + dt;
          if (inc.care > 2.5) { if (inc.body) { scene.remove(inc.body); inc.body = null; } if (m) { m.hp = MOBDEF.ped.hp; m.panic = 0; } inc.done = true; s.stage = 'pack'; }
        }
        if (s.workT > 60) { inc.done = true; s.stage = 'pack'; }
      }
    } else if (s.stage === 'pack') {   // crew walks back, then the vehicle drives off and leaves
      let all = true; for (const c of s.crew) if (!walkCrew(c, s.x, s.z, dt, s.y)) all = false;
      if (all) { for (const c of s.crew) scene.remove(c.g); s.crew = []; s.stage = 'leave'; s.route = [...roadRoute(s.t, s.T, s.S).slice(0, -1), [s.S.x, s.S.z]]; s.wp = 0;
        if (s.job && s.job.inc) { const i = incidents.indexOf(s.job.inc); if (i >= 0) incidents.splice(i, 1); } }
    } else if (s.stage === 'leave') { if (driveRoute(s, dt)) { removeService(s); continue; } }
    s.g.position.set(s.x, s.y, s.z); s.g.rotation.y = s.head;
  }
  svcT -= dt; if (svcT > 0) return; svcT = 1.5;
  // fires in a town (or on its edge) get a truck, one per blaze
  const trucks = services.filter(s => s.kind === 'fire');
  if (trucks.length < 2) for (const [k, f] of fires) {
    if (Math.hypot(f.x - player.pos.x, f.z - player.pos.z) > 100) continue;
    const tw = townAt(f.x, f.z); if (!tw || !inTown(tw, f.x, f.z, 6)) continue;
    if (services.some(s => s.kind === 'fire' && Math.hypot(s.T.x - f.x, s.T.z - f.z) < 24)) continue;
    if (dispatch('fire', tw, f.x, f.z, { fire: k })) break;
  }
  // ambulances for the hurt and knocked out
  for (const inc of [...incidents]) {
    inc.age += 1.5;
    if (inc.age > 150 || (inc.ped && !mobs.includes(inc.ped) && !inc.body)) { if (inc.body) scene.remove(inc.body); incidents.splice(incidents.indexOf(inc), 1); continue; }
    if (inc.taken || services.filter(s => s.kind === 'amb').length >= 2) continue;
    const tw = townById(inc.townId); if (!tw) continue;
    if (dispatch('amb', tw, inc.x, inc.z, { inc })) inc.taken = true;
  }
}
let svcT = 0;
// ---- a townsperson went down: leave them lying there for the ambulance, and keep the town's crowd the same size
function pedDown(m, dead) {
  if (!m.townId) return;
  const p = m.g.position;
  if (dead) {
    const body = new THREE.Group(), pm = personMesh(); pm.rotation.x = -Math.PI / 2; pm.position.set(0, 0.15, 0); body.add(pm); body.position.set(p.x, Math.floor(p.y + 0.2), p.z); body.rotation.y = Math.random() * 6.28; scene.add(body);
    incidents.push({ x: p.x, y: Math.floor(p.y + 0.2), z: p.z, townId: m.townId, body, age: 0, dead: true });
    respawnPed(m.townId);
  } else if (!m.injured) { m.injured = true; incidents.push({ x: p.x, y: p.y, z: p.z, townId: m.townId, ped: m, age: 0 }); }
}
let pedRespawns = 0;
function respawnPed(townId) {
  const t = townById(townId); if (!t) return null;
  const pp = player.pos, dir = getDir();
  for (let i = 0; i < 60; i++) {
    const x = t.x0 + Math.floor(Math.random() * (t.x1 - t.x0)), z = t.z0 + Math.floor(Math.random() * (t.z1 - t.z0)), d = Math.hypot(x - pp.x, z - pp.z);
    if (d < 24 || d > 85 || !data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
    if (d < 60 && (dir.x * (x - pp.x) + dir.z * (z - pp.z)) / d > -0.1) continue;   // only behind you, or far off
    const c = townCell(t, x, z); if (t.type === 'city' && c !== 'walk') continue;
    if (solid(get(x, t.base + 1, z)) || solid(get(x, t.base + 2, z))) continue;
    const m = spawnMob('ped', x + 0.5, t.base + 1, z + 0.5); if (!m) return null;
    m.townId = t.id; m.home = new THREE.Vector2(x, z); pedRespawns++; return m;
  }
  return null;
}

// ================== v1.10 step 4: special sites (prisons, Area 51, nuclear plants, airports, UFO crash sites) ==================
// A site fills one town-sized region (5x5 chunks) that has no town. Worlds from before step 4 never get a site in a region
// you built in or explored (state.siteOld), the same way step 2/3 protect old terrain and towns.
let siteOldSet = null;
function siteChOld(cx, cz) { if (!(state.siteV >= 4)) return true; if (!siteOldSet) siteOldSet = new Set(state.siteOld || []); return siteOldSet.size > 0 && siteOldSet.has(cx + ',' + cz); }
function regionSiteOld(rx, rz) { for (let i = 0; i < TREG; i++) for (let j = 0; j < TREG; j++) if (siteChOld(rx * TREG + i, rz * TREG + j)) return true; return false; }
const SITE_SIZE = { prison: [52, 44], area51: [72, 72], plant: [64, 56], airport: [72, 40] };
const SITE_NAME = { prison: '🏢 State Prison', area51: '👽 Area 51', plant: '☢️ Nuclear Power Plant', airport: '✈️ Airport' };
const siteMemo = new Map();
function siteOf(rx, rz) {
  const k = rx + ',' + rz; if (siteMemo.has(k)) return siteMemo.get(k);
  siteMemo.set(k, null); let s = null;
  if (state.siteV >= 4 && !townOf(rx, rz) && !regionOld(rx, rz) && !regionTownOld(rx, rz) && !regionSiteOld(rx, rz)) {
    const rx0 = rx * TREG * CH, rz0 = rz * TREG * CH, cx = rx0 + 40, cz = rz0 + 40;
    if (Math.hypot(cx - VX, cz - VZ) > 160) {
      const h = hash2(rx, rz, state.seed + 5151), bio = biomeOf(cx, cz);
      let city = false; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const t = (a || b) && townOf(rx + a, rz + b); if (t && t.type === 'city') city = true; }
      let type = null;
      if (bio === 'desert' && h < 0.14) type = 'area51';
      else if (city && h < 0.4) type = 'prison';
      else if (city && h < 0.52) type = 'airport';
      else if (h < 0.025) type = 'plant';
      else if (h < 0.035) type = 'airport';
      if (type) {
        const [w, d] = SITE_SIZE[type], x0 = rx0 + ((80 - w) >> 1), z0 = rz0 + ((80 - d) >> 1);
        let hs = 0, n = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { hs += terrainNat(x0 + w * (a + 0.5) / 3, z0 + d * (b + 0.5) / 3).h; n++; }
        s = { type, rx, rz, x0, z0, x1: x0 + w, z1: z0 + d, w, d, base: Math.round(Math.max(SEA + 2, Math.min(30, hs / n))), bio, id: 'S' + k, ramp: Math.min(6, (80 - Math.max(w, d)) >> 1) };
      }
    }
  }
  siteMemo.set(k, s); return s;
}
const siteAt = (x, z) => siteOf(fdiv(fdiv(Math.floor(x), CH), TREG), fdiv(fdiv(Math.floor(z), CH), TREG));
const inSite = (s, x, z, m = 0) => s && x >= s.x0 - m && x < s.x1 + m && z >= s.z0 - m && z < s.z1 + m;
function sitesNear(r) {
  const out = [], rx = fdiv(fdiv(Math.floor(player.pos.x), CH), TREG), rz = fdiv(fdiv(Math.floor(player.pos.z), CH), TREG), R = Math.ceil(r / 80) + 1;
  for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const s = siteOf(rx + a, rz + b); if (s && Math.hypot((s.x0 + s.x1) / 2 - player.pos.x, (s.z0 + s.z1) / 2 - player.pos.z) < r) out.push(s); }
  return out;
}
// test / arrest helper: nearest site of a type, scanning outward region by region
function findSite(type, maxR = 40, fx = player.pos.x, fz = player.pos.z) {
  const rx = fdiv(fdiv(Math.floor(fx), CH), TREG), rz = fdiv(fdiv(Math.floor(fz), CH), TREG);
  for (let r = 0; r <= maxR; r++) { let best = null, bd = 1e9;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const s = siteOf(rx + a, rz + b); if (s && s.type === type) { const d = Math.hypot(s.x0 - fx, s.z0 - fz); if (d < bd) { bd = d; best = s; } } }
    if (best) return best; }
  return null;
}
// ---- layouts (all in world coordinates, so every chunk stamps only its own part)
function prisonCells(s) { const out = []; for (let k = 0; k < 9; k++) { out.push([s.x0 + 8 + 4 * k, s.base + 1, s.z0 + 21]); out.push([s.x0 + 8 + 4 * k, s.base + 1, s.z0 + 30]); } return out; }
const prisonChest = s => [s.x0 + 8, s.base + 1, s.z0 + 10];
const prisonExit = s => [s.x0 + 26, s.base + 1, s.z0 - 3];
const a51Chest = s => [s.x0 + 22, s.base + 1, s.z0 + 23];
const a51Ufo = s => [s.x0 + 17, s.base + 1, s.z0 + 18];
const PARKED = {   // [kind, dx, dz, heading]
  area51: [['plane', 28, 52, Math.PI / 2], ['helicopter', 49, 18, 0]],
  airport: [['plane', 20, 19, Math.PI / 2], ['plane', 44, 20, Math.PI / 2], ['helicopter', 65, 19, 0]],
};
function radSpotsOf(s) {
  if (s.type !== 'plant') return [];
  return [{ x: s.x0 + 42, z: s.z0 + 47, r: 11, k: 1 }, { x: s.x0 + 39.5, z: s.z0 + 27.5, r: 7, k: 0.6 }];
}
function stampSites(cx, cz, hm, L, Lget, townChunk) {
  const x0 = cx * CH, z0 = cz * CH, s = siteOf(fdiv(cx, TREG), fdiv(cz, TREG));
  if (s) { if (s.x0 - s.ramp < x0 + CH && s.x1 + s.ramp > x0 && s.z0 - s.ramp < z0 + CH && s.z1 + s.ramp > z0) stampSite(s, cx, cz, hm, L, Lget); return; }
  if (townChunk || state.siteV < 4 || isOldCh(cx, cz) || townChOld(cx, cz) || siteChOld(cx, cz)) return;
  if (hash2(cx, cz, state.seed + 6161) < 0.005 && Math.hypot(x0 + 8 - VX, z0 + 8 - VZ) > 120) stampCrash(cx, cz, hm, L, Lget);
}
function stampSite(s, cx, cz, hm, L, Lget) {
  const x0 = cx * CH, z0 = cz * CH, B = s.base, top = s.bio === 'desert' ? SAND : s.bio === 'snow' ? SNOW_GRASS : GRASS;
  // flatten the footprint to the site's ground level, ramping back to the land around it
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const x = x0 + lx, z = z0 + lz, ex = Math.max(s.x0 - x, 0, x - (s.x1 - 1)), ez = Math.max(s.z0 - z, 0, z - (s.z1 - 1)), dd = Math.max(ex, ez);
    if (dd > s.ramp) continue;
    const nat = hm[lx + lz * CH], tgt = dd === 0 ? B : Math.round(B + (nat - B) * dd / (s.ramp + 1));
    for (let y = 1; y <= tgt; y++) if (y > nat || y >= tgt - 2) L(lx, y, lz, y === tgt ? top : y > tgt - 3 ? (top === SAND ? SAND : DIRT) : STONE);
    for (let y = tgt + 1; y < H; y++) L(lx, y, lz, y <= SEA && nat <= SEA && dd > 0 ? WATER : AIR);
    hm[lx + lz * CH] = tgt;
  }
  const W = (x, y, z, id) => L(x - x0, y, z - z0, id);
  const F = (ax, ay, az, bx, by, bz, id) => { const xa = Math.max(ax, x0), xb = Math.min(bx, x0 + CH - 1), za = Math.max(az, z0), zb = Math.min(bz, z0 + CH - 1);
    for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) for (let y = ay; y <= by; y++) L(x - x0, y, z - z0, id); };
  const inCh = (x, z) => x >= x0 && x < x0 + CH && z >= z0 && z < z0 + CH;
  const torch = (x, y, z) => { if (!inCh(x, z)) return; W(x, y, z, TORCH); torches.add(x + ',' + y + ',' + z); };
  const ring = (ax, az, bx, bz, y0, y1, id) => { F(ax, y0, az, bx, y1, az, id); F(ax, y0, bz, bx, y1, bz, id); F(ax, y0, az, ax, y1, bz, id); F(bx, y0, az, bx, y1, bz, id); };
  const X = s.x0, Z = s.z0, X1 = s.x1 - 1, Z1 = s.z1 - 1;
  const hangar = (hx, hz, w, d, h) => {   // arched steel hangar, open at the front (-z)
    const c = (w - 1) / 2, r = c + 0.5, A = i => i < 0 || i >= w ? 0 : Math.round(Math.sqrt(Math.max(0, r * r - (i - c) * (i - c))) * h / r);
    F(hx, B, hz, hx + w - 1, B, hz + d - 1, CONCRETE);
    for (let i = 0; i < w; i++) { const ah = A(i), lo = Math.min(A(i - 1), A(i + 1), ah - 1);
      F(hx + i, B + 1 + Math.max(0, lo), hz, hx + i, B + 1 + ah, hz + d - 1, STEEL);
      F(hx + i, B + 1, hz + d - 1, hx + i, B + ah, hz + d - 1, STEEL);                       // back wall
      if (Math.abs(i - c) > c - 2) F(hx + i, B + 1, hz, hx + i, B + ah, hz, STEEL); }          // front pillars
    for (let i = 1; i < w - 1; i++) W(hx + i, B, hz - 1, HAZARD);
    torch(hx + 1, B + 1, hz + d - 2); torch(hx + w - 2, B + 1, hz + d - 2);
  };
  const tower = (tx, tz, h) => { F(tx, B + 1, tz, tx + 4, B + h - 3, tz + 4, CONCRETE); F(tx + 1, B + 1, tz + 1, tx + 3, B + h - 3, tz + 3, AIR);
    F(tx + 2, B + 1, tz, tx + 2, B + 2, tz, AIR);
    F(tx - 1, B + h - 3, tz - 1, tx + 5, B + h - 3, tz + 5, CONCRETE); ring(tx - 1, tz - 1, tx + 5, tz + 5, B + h - 2, B + h - 1, GL_DARK); F(tx - 1, B + h, tz - 1, tx + 5, B + h, tz + 5, STEEL); torch(tx + 2, B + h - 2, tz + 2); };
  if (s.type === 'prison') {
    F(X, B, Z, X1, B, Z1, CONCRETE); F(X + 24, B, Z + 4, X + 44, B, Z + 14, ASPHALT); for (let x = X + 24; x <= X + 44; x++) W(x, B, Z + 9, ROADLINE);
    ring(X, Z, X1, Z1, B + 1, B + 6, CONCRETE); ring(X, Z, X1, Z1, B + 7, B + 7, FENCE);
    F(X + 25, B + 1, Z, X + 27, B + 4, Z, BARS); F(X + 25, B + 5, Z, X + 27, B + 6, Z, STEEL);   // the front gate
    for (const [tx, tz] of [[X, Z], [X1 - 3, Z], [X, Z1 - 3], [X1 - 3, Z1 - 3]]) { F(tx, B + 1, tz, tx + 3, B + 9, tz + 3, CONCRETE); ring(tx, tz, tx + 3, tz + 3, B + 10, B + 10, FENCE); torch(tx + 1, B + 10, tz + 1); }
    // cell block: corridor along x, 9 cells each side with bars and a bed
    const cx0 = X + 6, cx1 = X + 42, cz0 = Z + 18, cz1 = Z + 33;
    F(cx0, B + 1, cz0, cx1, B + 5, cz1, CONCRETE); F(cx0 + 1, B + 1, cz0 + 1, cx1 - 1, B + 4, cz1 - 1, AIR);
    F(cx0, B + 1, Z + 25, cx0, B + 2, Z + 26, AIR); F(cx1, B + 1, Z + 25, cx1, B + 2, Z + 26, AIR);
    for (let k = 0; k <= 9; k++) { const wx = cx0 + 4 * k; F(wx, B + 1, cz0, wx, B + 4, Z + 24, CONCRETE); F(wx, B + 1, Z + 27, wx, B + 4, cz1, CONCRETE); }
    for (let k = 0; k < 9; k++) { const ax = cx0 + 1 + 4 * k; F(ax, B + 1, Z + 24, ax + 2, B + 4, Z + 24, BARS); F(ax, B + 1, Z + 27, ax + 2, B + 4, Z + 27, BARS);
      W(ax + 2, B + 1, Z + 19, BED0 + 0); W(ax + 2, B + 1, Z + 32, BED0 + 2); }
    for (let x = cx0 + 3; x < cx1; x += 8) torch(x, B + 1, Z + 25);
    // office with the evidence locker
    F(X + 6, B + 1, Z + 4, X + 17, B + 4, Z + 12, CONCRETE); F(X + 7, B + 1, Z + 5, X + 16, B + 3, Z + 11, AIR); F(X + 11, B + 1, Z + 12, X + 11, B + 2, Z + 12, AIR);
    for (let x = X + 8; x <= X + 15; x += 3) W(x, B + 2, Z + 4, GLASS);
    const [ex, ey, ez] = prisonChest(s); W(ex, ey, ez, CHEST); W(X + 13, B + 1, Z + 7, TABLE); W(X + 13, B + 2, Z + 7, LAPTOP0 + 2); W(X + 13, B + 1, Z + 8, CHAIR0 + 2); torch(X + 15, B + 1, Z + 10);
  }
  if (s.type === 'area51') {
    F(X, B, Z, X1, B, Z1, SAND); F(X + 4, B, Z + 6, X1 - 4, B, Z + 46, ASPHALT); F(X, B, Z + 50, X1, B, Z + 58, ASPHALT);
    for (let x = X + 2; x < X1; x += 4) { W(x, B, Z + 54, ROADLINE); W(x + 1, B, Z + 54, ROADLINE); }
    ring(X, Z, X1, Z1, B + 1, B + 3, FENCE); F(X + 34, B + 1, Z, X + 37, B + 3, Z, AIR); W(X + 33, B + 1, Z - 1, HAZARD); W(X + 38, B + 1, Z - 1, HAZARD); W(X + 33, B + 2, Z - 1, HAZARD); W(X + 38, B + 2, Z - 1, HAZARD);
    F(X + 39, B + 1, Z + 2, X + 41, B + 3, Z + 4, CONCRETE); F(X + 40, B + 1, Z + 3, X + 40, B + 2, Z + 3, AIR); W(X + 40, B + 2, Z + 2, GLASS); W(X + 40, B + 1, Z + 4, AIR);   // guard booth
    hangar(X + 8, Z + 10, 19, 18, 9); hangar(X + 40, Z + 10, 19, 18, 9); tower(X + 62, Z + 34, 15);
    const [lx, ly, lz] = a51Chest(s); W(lx, ly, lz, CHEST);
    for (const [bx, bz] of [[X + 9, Z + 26], [X + 10, Z + 26], [X + 9, Z + 25], [X + 41, Z + 26], [X + 42, Z + 26], [X + 56, Z + 25]]) { W(bx, B + 1, bz, CRATE); if ((bx + bz) % 2) W(bx, B + 2, bz, CRATE); }
    for (const [lx2, lz2] of [[X + 4, Z + 6], [X1 - 4, Z + 6], [X + 4, Z + 46], [X1 - 4, Z + 46]]) { F(lx2, B + 1, lz2, lx2, B + 4, lz2, STEEL); torch(lx2, B + 5, lz2); }
  }
  if (s.type === 'plant') {
    F(X, B, Z, X1, B, Z1, top); F(X + 28, B, Z + 14, X1 - 2, B, Z1 - 2, CONCRETE); F(X + 2, B, Z + 4, X + 27, B, Z1 - 4, CONCRETE);
    ring(X, Z, X1, Z1, B + 1, B + 3, FENCE); F(X + 30, B + 1, Z, X + 33, B + 3, Z, AIR);
    for (const [tx, tz] of [[X + 14, Z + 15], [X + 14, Z + 40]]) {   // hyperbolic cooling towers
      const Ht = 32;
      for (let y = 0; y <= Ht; y++) { const t = y / Ht, r = 5.4 + 3.6 * Math.pow((t - 0.72) / 0.72, 2), R2 = r + 0.75;
        const xa = Math.max(tx - 10, x0), xb = Math.min(tx + 10, x0 + CH - 1), za = Math.max(tz - 10, z0), zb = Math.min(tz + 10, z0 + CH - 1);
        for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) { const d = Math.hypot(x - tx, z - tz); if (d < R2 && d >= r - 0.45) L(x - x0, B + 1 + y, z - z0, y < 2 && Math.abs(x - tx) < 2 && z < tz ? AIR : (y % 8 === 5 ? WHITEWALL : CONCRETE)); } }
    }
    // reactor: concrete box, hazard band, dome, a glowing core inside
    F(X + 32, B + 1, Z + 20, X + 47, B + 10, Z + 35, CONCRETE); F(X + 33, B + 1, Z + 21, X + 46, B + 9, Z + 34, AIR); ring(X + 32, Z + 20, X + 47, Z + 35, B + 3, B + 3, HAZARD);
    for (let x = X + 34; x <= X + 45; x += 3) W(x, B + 6, Z + 20, GLASS);
    F(X + 39, B + 1, Z + 20, X + 40, B + 2, Z + 20, AIR);
    for (let y = 0; y <= 7; y++) for (let x = X + 32; x <= X + 47; x++) for (let z = Z + 20; z <= Z + 35; z++) { if (!inCh(x, z)) continue; const d = Math.hypot(x - (X + 39.5), y * 1.05, z - (Z + 27.5)); if (d < 7.6 && d >= 6.7) W(x, B + 11 + y, z, y > 5 ? STEEL : CONCRETE); }
    F(X + 38, B + 1, Z + 26, X + 41, B + 4, Z + 29, REACTOR); F(X + 37, B + 1, Z + 25, X + 42, B + 1, Z + 30, HAZARD); F(X + 38, B + 1, Z + 26, X + 41, B + 1, Z + 29, REACTOR);
    torch(X + 34, B + 1, Z + 22); torch(X + 45, B + 1, Z + 33);
    // turbine hall
    F(X + 50, B + 1, Z + 18, X + 61, B + 7, Z + 37, STEEL); F(X + 51, B + 1, Z + 19, X + 60, B + 6, Z + 36, AIR); F(X + 55, B + 1, Z + 18, X + 56, B + 3, Z + 18, AIR); torch(X + 52, B + 1, Z + 20);
    // fenced toxic waste yard with glowing barrels
    F(X + 32, B, Z + 41, X + 52, B, Z + 52, HAZARD); ring(X + 32, Z + 41, X + 52, Z + 52, B + 1, B + 2, FENCE); F(X + 41, B + 1, Z + 41, X + 43, B + 2, Z + 41, AIR);
    for (let x = X + 34; x <= X + 50; x += 2) for (let z = Z + 44; z <= Z + 50; z += 3) { W(x, B + 1, z, WASTE); if (hash3(x, B, z, state.seed) < 0.45) W(x, B + 2, z, WASTE); }
  }
  if (s.type === 'airport') {
    F(X, B, Z, X1, B, Z1, top); F(X, B, Z + 4, X1, B, Z + 13, ASPHALT); for (let x = X + 1; x < X1; x += 5) { W(x, B, Z + 8, ROADLINE); W(x + 1, B, Z + 8, ROADLINE); W(x + 2, B, Z + 8, ROADLINE); }
    for (const x of [X + 1, X1 - 1]) for (let z = Z + 5; z <= Z + 12; z += 2) W(x, B, z, ROADLINE);
    F(X, B, Z + 14, X1, B, Z + 26, ASPHALT); F(X + 61, B, Z + 15, X + 69, B, Z + 23, CONCRETE);
    for (let z = Z + 16; z <= Z + 22; z++) { W(X + 63, B, z, ROADLINE); W(X + 67, B, z, ROADLINE); } for (let x = X + 63; x <= X + 67; x++) W(x, B, Z + 19, ROADLINE);
    F(X + 30, B + 1, Z + 28, X + 52, B + 5, Z + 37, WHITEWALL); F(X + 31, B + 1, Z + 29, X + 51, B + 4, Z + 36, AIR); F(X + 31, B + 1, Z + 28, X + 51, B + 3, Z + 28, SHOPGLASS); F(X + 40, B + 1, Z + 28, X + 42, B + 2, Z + 28, AIR);
    F(X + 30, B + 6, Z + 28, X + 52, B + 6, Z + 37, CONCRETE); for (let x = X + 33; x <= X + 49; x += 4) { W(x, B + 1, Z + 34, CHAIR0 + 2); W(x + 1, B + 1, Z + 34, CHAIR0 + 2); } torch(X + 32, B + 1, Z + 30); torch(X + 50, B + 1, Z + 30);
    tower(X + 56, Z + 30, 14); hangar(X + 6, Z + 25, 15, 14, 8);
  }
}
// UFO crash site: a scorched crater with an alien saucer wreck and a loot chest
function stampCrash(cx, cz, hm, L, Lget) {
  const x0 = cx * CH, z0 = cz * CH, mx = 8, mz = 8, hc0 = hm[mx + mz * CH];
  if (hc0 <= SEA + 1 || hc0 > 40) return;
  for (let lx = 1; lx < CH - 1; lx++) for (let lz = 1; lz < CH - 1; lz++) {
    const d = Math.hypot(lx - mx, lz - mz); if (d > 7) continue; const h = hm[lx + lz * CH];
    if (d < 5.2) { const dep = Math.round(3 * (1 - d / 5.2)); for (let y = h - dep + 1; y < H; y++) L(lx, y, lz, AIR); hm[lx + lz * CH] = h - dep; L(lx, h - dep, lz, SCORCH); }
    else if (hash3(x0 + lx, 0, z0 + lz, state.seed + 61) < 0.7) { for (let y = h + 1; y < Math.min(H, h + 8); y++) if (Lget(lx, y, lz) === LOG || Lget(lx, y, lz) === LEAVES) L(lx, y, lz, AIR); L(lx, h, lz, SCORCH); }
  }
  const hc = hm[mx + mz * CH];
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { const d = Math.hypot(dx, dz); if (d > 4.2) continue; const y = hc + 1 + Math.round(dx * 0.3 + 0.4); L(mx + dx, y, mz + dz, ALIEN_METAL); if (d < 2) L(mx + dx, y + 1, mz + dz, GLASS); }
  L(mx + 5, hc + 1, mz + 1, ALIEN_METAL); L(mx - 4, hc + 1, mz - 3, ALIEN_METAL); L(mx + 2, hc + 1, mz + 5, ALIEN_METAL);
  L(mx - 1, hc + 1, mz + 5, CHEST);
  crashSites.set(ckey(cx, cz), { x: x0 + mx, y: hc + 1, z: z0 + mz, chest: (x0 + mx - 1) + ',' + (hc + 1) + ',' + (z0 + mz + 5) });
}
const crashSites = new Map();

// ================== v1.10 step 4: weapons, explosions, gangs, cops & prison, military, aliens, radiation ==================
// Everything that can hurt you checks canHurtPlayer(), so peaceful stays safe (radiation is the one mild exception, like fall damage).
// ---- item icons, DealerNet prices and category
{ const d0 = drawIcon; drawIcon = function (kind, mat) { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  const P = (px, py, col) => { if (px < 0 || py < 0 || px > 15 || py > 15) return; x.fillStyle = col; x.fillRect(px | 0, py | 0, 1, 1); };
  return drawIconS4(kind, mat, P) ? c : d0(kind, mat); }; }
Object.assign(RAW_VALUE, { pistol: 120, rifle: 320, minigun: 950, pistol_ammo: 2, rifle_ammo: 3, grenade: 25, nuke: 2500, alien_tech: 420, uranium: 60, plane: 900, helicopter: 1200,
  steel: 4, fence: 2, bars: 3, hazard_block: 3, toxic_barrel: 70, crate: 12, scorched: 1, alien_hull: 60 });
WEB_CATS.weapons = '🔫 Weapons & Vehicles';
{ const wc0 = webCat; webCat = function (id) { if (GUNS[id] || /ammo|grenade|nuke|plane|helicopter/.test(id)) return 'weapons'; return wc0(id); }; }
for (const c of ['gun', 'gang', 'soldier', 'alien', 'taser']) CREATURE_HIT.add(c);
const isGlass = id => id === GLASS || id === SHOPGLASS || id === TINT || id === GL_BLUE || id === GL_GREEN || id === GL_GOLD || id === GL_DARK || id === GL_TEAL;

// ---- sounds
function gunSnd(g, vol = 1) { if (vol <= 0.01) return; noiseF(g.spin ? 0.07 : 0.16, g.vol * vol, 'lowpass', g.f * 3, 150, 0.7); sweep(g.spin ? 260 : 170, 45, g.spin ? 0.06 : 0.14, 'square', 0.07 * vol); }
const zapSnd = (vol = 1) => { for (let i = 0; i < 4; i++) setTimeout(() => noiseF(0.05, 0.12 * vol, 'highpass', 3000, 6000, 2), i * 45); beep(90, 0.25, 'sawtooth', 0.05 * vol); };
const raySnd = (vol = 1) => sweep(1800, 300, 0.25, 'sine', 0.08 * vol);
function bigBoomSnd(big) { noiseBurst(big ? 3.5 : 1.4, big ? 0.9 : 0.55, big ? 260 : 420); sweep(big ? 90 : 130, 22, big ? 3 : 1.1, 'sine', big ? 0.5 : 0.32); if (big) setTimeout(() => noiseBurst(4, 0.35, 140), 400); }

// ---- effects: tracers, muzzle flash, flash overlay, camera shake, fireballs, shock rings
const fxs = [];
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, depthWrite: false });
const tracerMats = { zap: new THREE.MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: 0.95, depthWrite: false }), ray: new THREE.MeshBasicMaterial({ color: 0x6aff8a, transparent: true, opacity: 0.95, depthWrite: false }) };
const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
function tracer(a, b, kind) {
  const len = a.distanceTo(b); if (len < 0.2) return;
  const m = new THREE.Mesh(tracerGeo, tracerMats[kind] || tracerMat), th = kind ? 0.06 : 0.035; m.scale.set(th, th, len);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); scene.add(m); fxs.push({ m, life: kind ? 0.14 : 0.06, kind: 'tracer' });
}
const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.3, 'rgba(255,200,60,.9)'); g.addColorStop(1, 'rgba(255,120,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthTest: false, depthWrite: false })); muzzle.renderOrder = 11; muzzle.visible = false; camera.add(muzzle); muzzle.position.set(0.42, -0.3, -1.42);
const muzzleLight = new THREE.PointLight(0xffc060, 0, 9, 1.5); camera.add(muzzleLight); muzzleLight.position.set(0.3, -0.1, -1.2);
let muzzleT = 0;
function flashAt(p, s = 0.6) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false })); sp.position.copy(p); sp.scale.setScalar(s); scene.add(sp); fxs.push({ m: sp, life: 0.06, kind: 'sprite' }); }
const flashEl = document.createElement('div'); flashEl.id = 'flashFx'; document.body.appendChild(flashEl);
const stunEl = document.createElement('div'); stunEl.id = 'stunFx'; document.body.appendChild(stunEl);
const hud4 = document.createElement('div'); hud4.id = 'hud4'; document.body.appendChild(hud4);
let flashA = 0, shakeT = 0, shakeAmp = 0;
function screenFlash(a) { flashA = Math.max(flashA, a); }
function shake(t, amp) { shakeT = Math.max(shakeT, t); shakeAmp = Math.max(shakeAmp, amp); }
const fireballMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
function fireball(x, y, z, r, dur) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), fireballMat(0xff7a18)); m.position.set(x, y, z); m.scale.setScalar(0.3); scene.add(m);
  fxs.push({ m, life: dur, max: dur, r, kind: 'ball' });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), fireballMat(0xffe070)); core.position.set(x, y, z); core.scale.setScalar(0.2); scene.add(core);
  fxs.push({ m: core, life: dur * 0.7, max: dur * 0.7, r: r * 0.6, kind: 'core' });
  for (let i = 0; i < Math.min(14, 5 + r * 2); i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, fog: false, color: 0xffb050 })); sp.position.set(x, y, z); sp.scale.setScalar(r * 0.5); scene.add(sp);
    const v = new THREE.Vector3(Math.random() - .5, Math.random() * 0.8, Math.random() - .5).normalize().multiplyScalar(r * (2 + Math.random() * 2)); fxs.push({ m: sp, life: dur * 1.2, max: dur * 1.2, v, kind: 'flame', s0: r * 0.5 }); }
  const l = new THREE.PointLight(0xffa040, 6, r * 6, 1.2); l.position.set(x, y + 1, z); scene.add(l); fxs.push({ m: l, life: dur * 1.3, max: dur * 1.3, kind: 'light', i0: 6 });
}
function shockRing(x, y, z, r, dur) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.3, z); scene.add(m); fxs.push({ m, life: dur, max: dur, r, kind: 'ring' });
}
function mushroom(x, y, z, r) {
  fxs.push({ kind: 'mush', x, y, z, r, life: 6, max: 6, t: 0 });
  const g = new THREE.Group(), mat = c => new THREE.MeshLambertMaterial({ color: c, emissive: 0xff5010, emissiveIntensity: 1, transparent: true, opacity: 0.92, depthWrite: false });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 1, 14), mat(0x8a7060)); g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), mat(0x9a8070)); g.add(cap);
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 8, 20), mat(0x7a6050)); skirt.rotation.x = Math.PI / 2; g.add(skirt);
  g.position.set(x, y, z); scene.add(g); fxs.push({ kind: 'mushM', m: g, stem, cap, skirt, r, life: 11, max: 11 });
}
function updateFx(dt) {
  dt *= window.__fxSlow ?? 1;   // test knob: slow the effects down for screenshots
  for (const f of [...fxs]) {
    f.life -= dt; const k = f.max ? 1 - Math.max(0, f.life) / f.max : 0;
    if (f.kind === 'ball') { f.m.scale.setScalar(0.3 + f.r * Math.min(1, k * 2.2)); f.m.material.opacity = 0.85 * (1 - k * k); f.m.material.color.setRGB(1 - k * 0.6, 0.42 - k * 0.3, 0.06, THREE.SRGBColorSpace); }
    if (f.kind === 'core') { f.m.scale.setScalar(0.2 + f.r * Math.min(1, k * 3)); f.m.material.opacity = 0.95 * (1 - k); }
    if (f.kind === 'flame') { f.m.position.addScaledVector(f.v, dt); f.v.multiplyScalar(0.94); f.m.scale.setScalar(f.s0 * (1 + k)); f.m.material.opacity = 1 - k; f.m.material.color.setRGB(1, 0.62 - k * 0.45, 0.2 - k * 0.2, THREE.SRGBColorSpace); }
    if (f.kind === 'ring') { f.m.scale.setScalar(1 + f.r * k); f.m.material.opacity = 0.8 * (1 - k); }
    if (f.kind === 'light') f.m.intensity = f.i0 * (1 - k);
    if (f.kind === 'mushM') { const up = Math.min(1, k * 2.2), H2 = f.r * 3.2 * up + 1, w = f.r * (0.35 + up * 0.25), cw = f.r * (0.6 + Math.min(1, k * 1.6) * 1.1);
      f.stem.scale.set(w, H2, w); f.stem.position.y = H2 / 2; f.cap.scale.set(cw, cw * 0.55, cw); f.cap.position.y = H2 + cw * 0.15; f.skirt.scale.set(cw * 0.9, cw * 0.9, cw * 0.5); f.skirt.position.y = H2 - cw * 0.1;
      const fade = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1; for (const o of [f.stem, f.cap, f.skirt]) { o.material.opacity = 0.92 * fade; o.material.emissiveIntensity = Math.max(0, 1 - k * 2.2); } }
    if (f.kind === 'mush') { f.t -= dt; if (f.t <= 0) { f.t = 0.12; const up = Math.min(1, k * 1.6); smokePuff(f.x + (Math.random() - .5) * 2, f.y + up * f.r * 3, f.z + (Math.random() - .5) * 2, 2, 0x8a7a6a);
      if (k > 0.25) smokePuff(f.x + (Math.random() - .5) * f.r * 1.6, f.y + f.r * 3 + Math.random() * 2, f.z + (Math.random() - .5) * f.r * 1.6, 2, 0xb0a090); } }
    if (f.life <= 0) { if (f.m) { scene.remove(f.m); if (f.m.material && f.kind !== 'tracer') f.m.material.dispose(); if (f.kind === 'mushM') f.m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } fxs.splice(fxs.indexOf(f), 1); }
  }
  if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) { muzzle.visible = false; muzzleLight.intensity = 0; } }
  if (flashA > 0) { flashA = Math.max(0, flashA - dt * 0.9); }
  flashEl.style.opacity = flashA.toFixed(3); flashEl.style.display = flashA > 0.005 ? 'block' : 'none';
}

// ---- generic explosion: crater (radius capped for performance), fireball, shockwave, flash, fires, damage
const NO_BLAST = new Set([AIR, BEDROCK, GRAVE, CHEST, FURNACE]);
const SCORCHABLE = id => id === GRASS || id === DIRT || id === SAND || id === SNOW_GRASS || id === DEADGRASS || id === FARM || id === SNOW;
function blast(x, y, z, o = {}) {
  const r = Math.min(o.r || 3, 11), big = !!o.nuke, c = new THREE.Vector3(x, y, z);
  bigBoomSnd(big || r >= 5); fireball(x, y, z, r * (big ? 1.6 : 1.1), big ? 1.6 : 0.6); shockRing(x, Math.floor(y), z, r * (big ? 7 : 3), big ? 2.2 : 0.6);
  screenFlash(big ? 1 : Math.min(0.5, 0.15 + r * 0.05) * Math.max(0, 1 - c.distanceTo(player.pos) / 60)); shake(big ? 2.6 : 0.45, big ? 0.6 : 0.08 + r * 0.02);
  smokePuff(x, y + 0.5, z, big ? 12 : 5, 0x6a6a6a); particles(x, y, z, new THREE.Color(0.3, 0.3, 0.3), big ? 40 : 18);
  if (big) mushroom(x, y, z, r);
  const safe = Math.hypot(x - VX, z - VZ) < SAFE_R + r;
  if (!safe && o.blocks !== false) {
    const bx0 = Math.floor(x), by0 = Math.floor(y), bz0 = Math.floor(z);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      const d2 = dx * dx + dy * dy * (big ? 1.6 : 1) + dz * dz; if (d2 > r * r + Math.random() * 2) continue;
      const bx = bx0 + dx, by = by0 + dy, bz = bz0 + dz; if (by <= 0 || by >= H) continue; const id = get(bx, by, bz);
      if (NO_BLAST.has(id) || isWater(id)) continue;
      const k = bx + ',' + (by + 1) + ',' + bz; if (state.crops[k]) removeCrop(k, false);
      const ek = bx + ',' + by + ',' + bz; if (id === FIRE) fires.delete(ek);
      rawSet(bx, by, bz, AIR); state.edits[ek] = AIR; indexEdit(ek); markDirty(bx, bz); wakeWater(bx, by, bz); torches.delete(ek);
      if (typeof netEdit === 'function') netEdit(ek, AIR);
    }
    // scorch the ground around the crater
    const sr = Math.ceil(r * (big ? 1.9 : 1.3));
    for (let dx = -sr; dx <= sr; dx++) for (let dz = -sr; dz <= sr; dz++) {
      if (dx * dx + dz * dz > sr * sr || Math.random() < 0.3) continue; const bx = bx0 + dx, bz = bz0 + dz;
      for (let yy = Math.min(H - 2, by0 + r + 3); yy > Math.max(1, by0 - r - 3); yy--) { const id = get(bx, yy, bz); if (id === AIR || PLANT.has(id)) { if (PLANT.has(id) && id !== FIRE && Math.random() < 0.7) { rawSet(bx, yy, bz, AIR); const ek = bx + ',' + yy + ',' + bz; state.edits[ek] = AIR; indexEdit(ek); } continue; }
        if (SCORCHABLE(id) || id === LEAVES) { const ek = bx + ',' + yy + ',' + bz, nv = id === LEAVES ? AIR : SCORCH; rawSet(bx, yy, bz, nv); state.edits[ek] = nv; indexEdit(ek); markDirty(bx, bz); }
        break; }
    }
    flushDirty();
    // fires around it
    for (let i = 0; i < (o.fire ?? Math.round(r * 1.5)); i++) { const a = Math.random() * 6.28, rr = Math.random() * r * (big ? 2.2 : 1.4), fx = x + Math.cos(a) * rr, fz = z + Math.sin(a) * rr; let fy = Math.min(H - 2, by0 + r + 2);
      while (fy > 1 && !solid(get(Math.floor(fx), fy - 1, Math.floor(fz)))) fy--; fireAt(fx, fy, fz, 8 + Math.random() * 14); }
    if (fires.size) flushDirty();
  }
  const from = o.byPlayer ? player.pos : c, reach = r * (big ? 3.2 : 2.3);
  if (player.alive) { const d = player.pos.distanceTo(c); if (d < reach) damage(Math.round((1 - d / reach) * (o.dmg || 20) + (big && d < r ? 40 : 0)), 'explosion', c); }
  for (const m of [...mobs]) { const md = m.g.position.distanceTo(c); if (md < reach) hurtMob(m, Math.round((1 - md / reach) * (o.dmg || 20) * 1.2 + 2), from, !o.byPlayer); }
  for (const car of [...cars]) if (car !== player.car && Math.hypot(car.x - x, car.z - z) < r * 1.6) { smokePuff(car.x, car.y + 1, car.z, 6, 0x333333); fireAt(car.x, car.y, car.z, 10); removeCar(car); }
  if (typeof blastAircraft === 'function') blastAircraft(c, r * 1.5);
  if (big) { (state.radZones = state.radZones || []).push({ x, z, r: r * 2.4, k: 1.2, until: state.gameTime + 900 }); if (state.radZones.length > 8) state.radZones.shift(); }
}
// creepers use the shared helper too (same crater rules as before, plus the new effects)
explode = function (x, y, z, power) { blast(x, y, z, { r: power, dmg: 22, fire: 0 }); };

// ---- your guns
let gunCd = 0, spinT = 0, recoil = 0, hbDirty = false, ammoWarnT = 0;
const heldGun = () => { const id = held(); return id && GUNS[id] ? id : null; };
function takeQuiet(id) { for (let i = 35; i >= 0; i--) { const s = state.slots[i]; if (s && s.id === id) { s.n--; if (s.n <= 0) state.slots[i] = null; hbDirty = true; return true; } } return false; }
function muzzleWorld() { return camera.localToWorld(new THREE.Vector3(0.42, -0.3, -1.42)); }
// march a ray through blocks and mobs; returns { t, point, mob, block }
function shotRay(o, dir, range, skip) {
  let bt = range, block = null; const p = new THREE.Vector3();
  for (let t = 0.3; t < range; t += 0.2) { p.copy(o).addScaledVector(dir, t); const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z), id = get(bx, by, bz);
    if (id !== AIR && !isWater(id) && !(PLANT.has(id) && !MODEL.has(id)) && !(isDoor(id) && doorOpen(id))) { bt = t; block = { x: bx, y: by, z: bz, id }; break; } }
  let mob = null, mt = bt;
  for (const m of mobs) { if (m === skip || m.tamed) continue; const d = MOBDEF[m.type], c = m.g.position, t = (c.x - o.x) * dir.x + (c.y + d.h * 0.5 - o.y) * dir.y + (c.z - o.z) * dir.z;
    if (t < 0.2 || t > mt) continue; p.copy(o).addScaledVector(dir, t); const w = d.w + 0.22;
    if (Math.abs(p.x - c.x) < w && Math.abs(p.z - c.z) < w && p.y > c.y - 0.1 && p.y < c.y + d.h + 0.1) { mt = t; mob = m; } }
  const t = mob ? mt : bt; return { t, point: o.clone().addScaledVector(dir, t), mob, block: mob ? null : block };
}
function tryFire() {
  const id = heldGun(); if (!id) return false; const g = GUNS[id];
  if (player.car || !player.alive || uiOpen || jail) return true;
  if (gunCd > 0) return true;
  if (g.spin && spinT < g.spin) return true;
  if (!takeQuiet(g.ammo)) { if (ammoWarnT <= 0) { ammoWarnT = 1.5; beep(1400, 0.03, 'square', 0.04); toast(`🔫 Out of ${ITEMS[g.ammo].name}! Buy it on DealerNet or craft iron + gunpowder`); } gunCd = 0.35; return true; }
  gunCd = g.rate;
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + EYE, player.pos.z), dir = getDir();
  dir.x += (Math.random() - .5) * g.spread * 2; dir.y += (Math.random() - .5) * g.spread * 2; dir.z += (Math.random() - .5) * g.spread * 2; dir.normalize();
  const h = shotRay(eye, dir, g.range);
  if (typeof ufoShot === 'function' && ufoShot(eye, dir, h.t)) {}
  tracer(muzzleWorld(), h.point); muzzle.visible = true; muzzle.scale.setScalar(0.35 + Math.random() * 0.25); muzzle.material.rotation = Math.random() * 6; muzzleLight.intensity = 2.2; muzzleT = 0.05;
  gunSnd(g); recoil = Math.min(0.25, recoil + g.kick * 3); player.pitch = Math.min(1.55, player.pitch + g.kick * 0.35); player.yaw += (Math.random() - .5) * g.kick * 0.3;
  if (h.mob) { hurtMob(h.mob, g.dmg, player.pos); particles(h.point.x, h.point.y, h.point.z, new THREE.Color(1, 0.9, 0.4), 3); }
  else if (h.block) {
    const b = h.block; particles(h.point.x, h.point.y, h.point.z, new THREE.Color(0.55, 0.55, 0.55), 3);
    if (isGlass(b.id) && Math.hypot(b.x - VX, b.z - VZ) > SAFE_R) { setBlock(b.x, b.y, b.z, BROKEN_GLASS); noiseF(0.25, 0.1, 'highpass', 5000, 9000, 1); }
  }
  noiseNear(player.pos, 30);
  return true;
}
// gunfire scares townsfolk and draws cops' attention
function noiseNear(p, r) { for (const m of mobs) if (m.type === 'ped' && m.g.position.distanceTo(p) < r) { m.panic = 6; m.target = null; } }
// grenades
const grenades = [], nukes = [];
const grenGeo = new THREE.BoxGeometry(0.22, 0.28, 0.22), grenMat = new THREE.MeshLambertMaterial({ color: 0x4a6e2a });
function throwGrenade() {
  if (!take('grenade', 1)) return; const dir = getDir(), m = new THREE.Mesh(grenGeo, grenMat);
  m.position.set(player.pos.x + dir.x * 0.6, player.pos.y + EYE - 0.2, player.pos.z + dir.z * 0.6); scene.add(m);
  grenades.push({ m, v: dir.multiplyScalar(11).add(new THREE.Vector3(0, 3, 0)), fuse: 2.6, by: true }); swing(); beep(500, 0.05, 'triangle', 0.05); setTimeout(() => beep(1600, 0.03, 'square', 0.04), 120);
}
function updateGrenades(dt) {
  for (const g of [...grenades]) {
    g.fuse -= dt; g.v.y -= 22 * dt; const p = g.m.position;
    for (const ax of ['x', 'y', 'z']) { const o = p[ax]; p[ax] += g.v[ax] * dt; if (solid(get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) { p[ax] = o; g.v[ax] *= -0.35; g.v.x *= 0.7; g.v.z *= 0.7; if (Math.abs(g.v[ax]) > 1.5) beep(260, 0.03, 'triangle', 0.04); } }
    g.m.rotation.x += dt * 8; g.m.rotation.z += dt * 5;
    if (g.fuse <= 0 || p.y < -5) { scene.remove(g.m); grenades.splice(grenades.indexOf(g), 1); if (p.y > 0) blast(p.x, p.y, p.z, { r: 2.6, dmg: 16, fire: 3, byPlayer: g.by }); }
  }
  for (const n of [...nukes]) {
    n.t -= dt; n.beep -= dt; const f = Math.max(0.12, n.t / 10);
    if (n.beep <= 0) { n.beep = f; beep(n.t < 3 ? 1400 : 980, 0.08, 'square', 0.07); n.light.material.emissive.setHex(0xff0000); setTimeout(() => n.light.material.emissive.setHex(0x300000), 80); }
    if (Math.ceil(n.t) !== n.shown) { n.shown = Math.ceil(n.t); if (n.t > 0 && player.pos.distanceTo(n.g.position) < 120) toast(`☢️ NUKE ARMED · ${n.shown}s · RUN!`); }
    if (n.t <= 0) { scene.remove(n.g); nukes.splice(nukes.indexOf(n), 1); const p = n.g.position; blast(p.x, p.y + 0.5, p.z, { r: 11, dmg: 60, nuke: true, fire: 26, byPlayer: true }); }
  }
}
function nukeMesh() { const g = new THREE.Group(); box(0.8, 0.8, 1.6, 0xe0d040, 0, 0.45, 0, g); box(0.62, 0.62, 0.3, 0xb0a020, 0, 0.45, 0.92, g);
  for (const [w, h] of [[1.2, 0.08], [0.08, 1.2]]) box(w, h, 0.3, 0x6a6a64, 0, 0.45, -0.95, g); box(0.3, 0.3, 0.02, 0x111111, 0, 0.45, 0.81, g);
  const l = box(0.16, 0.12, 0.16, 0x300000, 0, 0.9, 0.3, g); return { g, l }; }
function armNuke(x, y, z) {
  const { g, l } = nukeMesh(); g.position.set(x + 0.5, y, z + 0.5); g.rotation.y = player.yaw; scene.add(g);
  nukes.push({ g, light: l, t: 10, beep: 0, shown: 0 }); useHeld(1); toast('☢️ Nuke armed! 10 seconds - get far away!'); beep(200, 0.4, 'sawtooth', 0.08);
}
// hook into attack / use: guns fire, grenades throw, nukes get placed
{ const atk0 = attackOrSwing; attackOrSwing = function () { if (AC && AC.state === 'suspended') AC.resume(); const id = held();
    if (GUNS[id]) { tryFire(); return; } if (id === 'grenade' && !player.car) { throwGrenade(); return; } return atk0(); }; }
{ const use0 = useAction; useAction = function () {
    if (AC && AC.state === 'suspended') AC.resume(); if (!player.alive || jail && jail.stun) return;
    const id = held();
    if (typeof aircraftUse === 'function' && aircraftUse(id)) return;
    if (id === 'nuke' && !player.car) { const h = raycast(); if (h && h.kind === 'block') { armNuke(h.x, h.y + 1, h.z); return; } }
    if (id === 'grenade' && !player.car) { throwGrenade(); return; }
    return use0(); }; }
// no block mining while a gun is in your hand: holding the button keeps firing instead
{ const um0 = updateMining; updateMining = function (dt) { if (heldGun()) { if (holdBreak && playing && !uiOpen) tryFire(); mine.key = null; crackMesh.visible = false; return; } return um0(dt); }; }

// ---- NPC builders: gangsters, soldiers, aliens (cops get a pistol too)
const GANGS = [{ n: 'Reds', c: 0xd02828, e: '🔴' }, { n: 'Blues', c: 0x2850d8, e: '🔵' }, { n: 'Greens', c: 0x2f9a3a, e: '🟢' }, { n: 'Purples', c: 0x8a38c8, e: '🟣' }, { n: 'Yellows', c: 0xe8c020, e: '🟡' }];
function gunMesh(parent, long) { const g = new THREE.Group(); g.position.set(0, -0.68, 0.06); parent.add(g); box(0.07, 0.1, long ? 0.75 : 0.32, 0x1e1f22, 0, 0, long ? 0.25 : 0.12, g); box(0.06, 0.14, 0.08, 0x2a2420, 0, -0.08, 0.02, g); return g; }
function humanoid(o) {
  const g = new THREE.Group(), legs = [], arms = [];
  box(o.bw || 0.5, 0.75, 0.28, o.shirt, 0, 1.1, 0, g);
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); g.add(head); box(0.46, 0.5, 0.46, o.skin, 0, 0, 0, head);
  for (const ex of [-0.1, 0.1]) box(0.08, 0.07, 0.02, 0x111111, ex, 0.03, 0.24, head);
  for (const lx of [-0.12, 0.12]) legs.push(pivotLimb(g, 0.22, 0.72, 0.22, o.pants, lx, 0.72, 0));
  for (const ax of [-0.34, 0.34]) arms.push(pivotLimb(g, 0.18, 0.7, 0.18, o.sleeve || o.shirt, ax, 1.45, 0));
  return { g, legs, arms, head };
}
function buildNpc(type, v) {
  const skin = [0xf1c27d, 0xc58c63, 0x8d5524, 0xe0ac69, 0x5c3a21][Math.floor(Math.random() * 5)];
  if (type === 'gangster') {
    const gc = GANGS[v % GANGS.length].c, p = humanoid({ shirt: Math.random() < 0.5 ? gc : 0x222222, sleeve: gc, skin, pants: [0x2a3a6a, 0x222222, 0x555555][rint(0, 2)] });
    box(0.5, 0.14, 0.5, gc, 0, 0.22, 0, p.head); box(0.5, 0.05, 0.3, gc, 0, 0.2, 0.3, p.head);   // cap in gang colours
    box(0.48, 0.12, 0.08, gc, 0, -0.16, 0.24, p.head);                                         // bandana
    box(0.3, 0.06, 0.05, 0xf2c21a, 0, 1.3, 0.15, p.g); gunMesh(p.arms[1], false); return p;
  }
  if (type === 'soldier') {
    const p = humanoid({ shirt: 0x4b5a2a, skin, pants: 0x3a4420 });
    for (const [x, y] of [[-0.12, 1.25], [0.14, 1.0], [0, 0.85]]) box(0.12, 0.12, 0.02, 0x2e3a1a, x, y, 0.15, p.g);
    box(0.54, 0.2, 0.54, 0x3e4a22, 0, 0.24, 0, p.head); box(0.6, 0.05, 0.6, 0x3e4a22, 0, 0.14, 0, p.head); box(0.36, 0.08, 0.04, 0x111111, 0, 0.04, 0.25, p.head);
    gunMesh(p.arms[1], true); return p;
  }
  if (type === 'alien') {
    const g = new THREE.Group(), legs = [], arms = [], sk = v % 2 ? 0x9ad8a0 : 0xb8c0c8;
    box(0.36, 0.6, 0.22, sk, 0, 0.95, 0, g);
    const head = new THREE.Group(); head.position.set(0, 1.52, 0); g.add(head); box(0.62, 0.56, 0.56, sk, 0, 0.06, 0, head); box(0.42, 0.18, 0.46, sk, 0, -0.26, 0.02, head);
    for (const ex of [-0.16, 0.16]) { const e = box(0.2, 0.13, 0.03, 0x050505, ex, 0.04, 0.29, head); e.rotation.z = ex > 0 ? -0.35 : 0.35; e.material.emissive.setHex(0x003010); }
    const ant = box(0.03, 0.22, 0.03, sk, 0, 0.42, 0, head); const tip = box(0.08, 0.08, 0.08, 0x6aff8a, 0, 0.55, 0, head); tip.material.emissive.setHex(0x30a040);
    for (const lx of [-0.09, 0.09]) legs.push(pivotLimb(g, 0.12, 0.65, 0.12, sk, lx, 0.65, 0));
    for (const ax of [-0.25, 0.25]) arms.push(pivotLimb(g, 0.09, 0.62, 0.09, sk, ax, 1.22, 0));
    const ray = new THREE.Group(); ray.position.set(0, -0.6, 0.05); arms[1].add(ray); box(0.07, 0.07, 0.24, 0xd8d8e0, 0, 0, 0.1, ray); const rt = box(0.09, 0.09, 0.05, 0x6aff8a, 0, 0, 0.24, ray); rt.material.emissive.setHex(0x30c050);
    g.traverse(o => { if (o.material && o.material.emissive && o.material.emissive.getHex() === 0) o.material.emissive.setHex(0x0c3018); });
    return { g, legs, arms, head };
  }
  return null;
}
{ const bm0 = buildMob; buildMob = function (type, v = 0) { const n = buildNpc(type, v); if (n) return n; const p = bm0(type, v); if (type === 'cop' && p.arms[1]) p.gun = gunMesh(p.arms[1], false); return p; }; }
Object.assign(MOBDEF, {
  gangster: { hp: 16, w: 0.3, h: 1.9, speed: 1.3, hostile: false, human: true, ai: true, npc: true, drops: () => [['pistol_ammo', rint(0, 6)], ['weed', Math.random() < 0.3 ? 1 : 0], ['pistol', Math.random() < 0.06 ? 1 : 0]] },
  soldier: { hp: 30, w: 0.3, h: 1.9, speed: 1.3, hostile: false, human: true, ai: true, npc: true, drops: () => [['rifle_ammo', rint(2, 8)], ['rifle', Math.random() < 0.05 ? 1 : 0]] },
  alien: { hp: 14, w: 0.28, h: 1.6, speed: 1.4, hostile: false, ai: true, npc: true, drops: () => [['alien_tech', Math.random() < 0.5 ? 1 : 0]] },
});
MOBDEF.cop.ai = true; MOBDEF.cop.npc = true;
Object.assign(MOB_NAMES, { gangster: '🧢 Gang member', soldier: '🪖 Soldier', alien: '👽 Alien' });
{ const ml0 = mobLabel; mobLabel = function (m) {
  if (m.type === 'gangster') { const g = GANGS[m.v % GANGS.length]; return `${g.e} ${g.n} gang member${gangHostile(m) ? ' · 😡 after you' : ''}`; }
  if (m.type === 'soldier') return '🪖 Area 51 soldier' + (soldierAlert > 0 ? ' · 🚨 engaging' : '');
  if (m.type === 'alien') return '👽 Alien' + (m.angry > 0 ? ' · 😡' : ' · 👀 curious');
  return ml0(m); }; }
const npcDies = new Set();
{ const hm0 = hurtMob; hurtMob = function (m, dmg, from, noDrop) {
  if (m && from === player.pos && mobs.includes(m)) {
    if (m.type === 'gangster') provokeGang(m);
    if (m.type === 'soldier') { soldierAlert = 40; }
    if (m.type === 'alien') { for (const o of mobs) if (o.type === 'alien' && o.g.position.distanceTo(m.g.position) < 20) o.angry = 30; }
    if (m.type === 'cop') { wantedBump(2); }
  }
  return hm0(m, dmg, from, noDrop); }; }

// ---- wanted level (stars). Each new crime adds a star (at most one every 4s), up to 5.
let wantedLvl = 0, wantedBumpT = 0;
function wantedBump(n = 1) { if (!canHurtPlayer() || jail) return; if (wantedBumpT > 0 && wantedLvl > 0) return; wantedBumpT = 4; wantedLvl = Math.min(5, wantedLvl + n); }
{ const sw0 = setWanted; setWanted = function () { if (!canHurtPlayer() || jail) { wanted = 0; wantedLvl = 0; return; } if (wanted <= 0) wantedLvl = 0; sw0(); wantedBump(1); wanted = Math.max(wanted, 30 + wantedLvl * 15); }; }

// ---- gangs: two gangs share each ghetto, split down the middle. They fight each other, and you if you provoke them or the cops are on you
const gangZones = new Map();   // townId -> { z, a, b, mid, hostile: [t_a, t_b], war, nextWar, spawnT }
function gangZone(gz) {
  let s = gangZones.get(gz.townId); if (s) return s;
  const a = Math.floor(hash2(gz.x0, gz.z0, state.seed + 71) * GANGS.length), b = (a + 1 + Math.floor(hash2(gz.z0, gz.x0, state.seed + 72) * (GANGS.length - 1))) % GANGS.length;
  s = { z: gz, a, b, mid: (gz.x0 + gz.x1) / 2, hostile: { [a]: 0, [b]: 0 }, war: 0, nextWar: 30 + Math.random() * 90 }; gangZones.set(gz.townId, s); return s;
}
const zoneOfM = m => m.zone ? gangZones.get(m.zone) : null;
function gangHostile(m) { const s = zoneOfM(m); return canHurtPlayer() && player.alive && !jail && ((s && s.hostile[m.v % GANGS.length] > 0) || (wanted > 0 && wantedLvl >= 2)); }
function provokeGang(m) { const s = zoneOfM(m); if (!s) return; const gi = m.v % GANGS.length; if (canHurtPlayer() && !(s.hostile[gi] > 0)) toast(`😡 The ${GANGS[gi].n} are after you!`); s.hostile[gi] = 60; }
function startGangWar(s) { s.war = 40; s.nextWar = 90 + Math.random() * 150; const dp = Math.hypot((s.z.x0 + s.z.x1) / 2 - player.pos.x, (s.z.z0 + s.z.z1) / 2 - player.pos.z);
  if (dp < 110) { toast(`🔫 Gang war! The ${GANGS[s.a].n} vs the ${GANGS[s.b].n}`); beep(300, 0.2, 'sawtooth', 0.05); } }
let gangT = 0;
function updateGangs(dt) {
  for (const s of gangZones.values()) { for (const k in s.hostile) s.hostile[k] = Math.max(0, s.hostile[k] - dt); if (s.war > 0) s.war -= dt; }
  gangT -= dt; if (gangT > 0) return; gangT = 1;
  const pp = player.pos;
  for (const gz of ghettoZones) {
    const dz = Math.hypot(Math.max(gz.x0 - pp.x, 0, pp.x - gz.x1), Math.max(gz.z0 - pp.z, 0, pp.z - gz.z1)); if (dz > 70) continue;
    const s = gangZone(gz); s.nextWar -= 1;
    const mem = mobs.filter(m => m.type === 'gangster' && m.zone === gz.townId);
    if (s.nextWar <= 0 && s.war <= 0 && mem.length >= 4) startGangWar(s);
    for (const gi of [s.a, s.b]) {
      if (mem.filter(m => m.v % GANGS.length === gi).length >= (s.war > 0 ? 6 : 4)) continue;
      for (let i = 0; i < 12; i++) {
        const half = gi === s.a ? [gz.x0 + 2, s.mid - 2] : [s.mid + 2, gz.x1 - 2], x = Math.floor(half[0] + Math.random() * (half[1] - half[0])), z = Math.floor(gz.z0 + 2 + Math.random() * (gz.z1 - gz.z0 - 4));
        const d = Math.hypot(x - pp.x, z - pp.z); if (d < 16 || d > 65 || !data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
        const y = gz.base + 1; if (solid(get(x, y, z)) || solid(get(x, y + 1, z)) || !solid(get(x, y - 1, z))) continue;
        const m = spawnMob('gangster', x + 0.5, y, z + 0.5, gi); if (m) { m.zone = gz.townId; m.home = new THREE.Vector2((half[0] + half[1]) / 2, (gz.z0 + gz.z1) / 2); } break;
      }
    }
  }
}

// ---- shared NPC combat AI (called from updateMobs through wildAI for every mob type with d.npc)
let soldierAlert = 0, trespassT = 0;
function npcShoot(m, tp, tmob, kind) {
  const o = m.g.position.clone(); o.y += kind === 'alien' ? 1.25 : 1.45; const to = tp.clone(), d = o.distanceTo(to);
  const fwd = to.clone().sub(o).normalize(); o.addScaledVector(fwd, 0.55);
  const acc = (kind === 'soldier' ? 0.85 : kind === 'cop' ? 0.75 : 0.6) - d / (kind === 'soldier' ? 60 : 40), hit = Math.random() < Math.max(0.12, acc) * (tmob ? 1 : diff().dmg > 1 ? 1 : 0.85);
  if (!hit) { to.x += (Math.random() - .5) * 2.2; to.y += (Math.random() - .2) * 1.4; to.z += (Math.random() - .5) * 2.2; }
  const dir = to.clone().sub(o).normalize(), h = shotRay(o, dir, d + (hit ? 0.6 : 3), m);
  const end = hit && !h.block ? to : h.point;
  tracer(o, end, kind === 'alien' ? 'ray' : null); flashAt(o, kind === 'alien' ? 0.4 : 0.5);
  const vol = Math.max(0, 1 - m.g.position.distanceTo(player.pos) / 70); if (kind === 'alien') raySnd(vol); else gunSnd(GUNS[kind === 'soldier' ? 'rifle' : 'pistol'], vol * 0.8);
  if (!hit || h.block) return;
  const dmg = kind === 'soldier' ? 3 : kind === 'alien' ? 3 : 2;
  if (tmob) { if (mobs.includes(tmob)) hurtMob(tmob, dmg * 2, m.g.position, true); }
  else damage(dmg, kind === 'gangster' ? 'gang' : kind === 'cop' ? 'cop' : kind, m.g.position);
}
function nearestFoe(m, pred, r) { let best = null, bd = r; for (const o of mobs) { if (o === m || !pred(o)) continue; const d = o.g.position.distanceTo(m.g.position); if (d < bd) { bd = d; best = o; } } return best; }
function npcAI(m, d, dt, dist, t) {
  const p = m.g.position, pp = player.pos; m.shootCd = Math.max(0, (m.shootCd || 0) - dt); m.angry = Math.max(0, (m.angry || 0) - dt);
  let tgt = null, tmob = null, want = 8, rate = 1;
  if (m.type === 'cop') {
    if (!(wanted > 0 && canHurtPlayer() && player.alive && !player.car && !jail && dist < 34)) return null;
    tgt = pp; want = wantedLvl >= 2 && !player.stunned ? 7 : 1.2; rate = 1.1;
    // taser first, then the cuffs; pistols from 2 stars
    if (dist < 5.5 && m.shootCd <= 0 && !player.stunned && lineOfSight(p.clone().setY(p.y + 1.4), pp.clone().setY(pp.y + 1.2))) { m.shootCd = 2.5; tase(m); }
    else if (wantedLvl >= 2 && dist >= 5.5 && dist < 20 && m.shootCd <= 0 && lineOfSight(p.clone().setY(p.y + 1.5), pp.clone().setY(pp.y + 1.3))) { m.shootCd = rate * (1.4 - wantedLvl * 0.12); npcShoot(m, pp.clone().setY(pp.y + 1.1), null, 'cop'); m.aim = 0.4; }
    if (dist < 1.9) { m.grab = (m.grab || 0) + dt; if (player.stunned || m.grab > 1.4) { arrest(); return [0, 0, 0]; } } else m.grab = 0;
    if (player.stunned) want = 1.2;
  } else if (m.type === 'gangster') {
    const s = zoneOfM(m), gi = m.v % GANGS.length;
    if (gangHostile(m) && dist < 24) tgt = pp;
    else { const foe = nearestFoe(m, o => o.type === 'gangster' && o.v % GANGS.length !== gi, s && s.war > 0 ? 26 : 9); if (foe) { tmob = foe; tgt = foe.g.position.clone().setY(foe.g.position.y + 1.1); } }
    if (!tgt && s && s.war > 0) { const fx = s.mid + (gi === s.a ? -3 : 3); const dx = fx - p.x, dz = (s.z.z0 + s.z.z1) / 2 - p.z, dd = Math.hypot(dx, dz); if (dd > 3) { m.g.rotation.y = Math.atan2(dx, dz); return [dx / dd, dz / dd, 2.6]; } }
    want = 9; rate = 0.9;
  } else if (m.type === 'soldier') {
    const s = m.site, inside = s && inSite(s, pp.x, pp.z, 1) && !jail;
    if (canHurtPlayer() && player.alive && (soldierAlert > 0 || (inside && trespassT > 4)) && dist < 45) tgt = pp;
    else { const foe = nearestFoe(m, o => o.type === 'alien', 22); if (foe) { tmob = foe; tgt = foe.g.position.clone().setY(foe.g.position.y + 0.9); } }
    want = 13; rate = 0.55;
  } else if (m.type === 'alien') {
    if (m.angry > 0 && canHurtPlayer() && player.alive && dist < 24) tgt = pp;
    else if (m.angry > 0 || m.hurt > 0) { const dx = p.x - pp.x, dz = p.z - pp.z, dd = Math.hypot(dx, dz) || 1; m.g.rotation.y = Math.atan2(dx, dz); return [dx / dd, dz / dd, 3]; }
    else if (dist < 7) { m.g.rotation.y = Math.atan2(pp.x - p.x, pp.z - p.z); return [0, 0, 0]; }   // curious: stops and stares
    want = 10; rate = 1.3;
  }
  if (!tgt) return null;
  const tpos = tmob ? tgt : pp.clone().setY(pp.y + 1.1), dx = tpos.x - p.x, dz = tpos.z - p.z, dd = Math.hypot(dx, dz) || 1;
  m.g.rotation.y = Math.atan2(dx, dz); m.aim = Math.max(m.aim || 0, 0.25);
  if (m.type !== 'cop' && m.shootCd <= 0 && dd < want + 14) {
    m.shootCd = rate * (0.8 + Math.random() * 0.5);
    if (lineOfSight(p.clone().setY(p.y + 1.45), tpos)) npcShoot(m, tpos, tmob, m.type);
  }
  const strafe = Math.sin(t * 1.3 + m.v) * 0.5, go = dd > want + 1 ? 1 : dd < want - 2 ? -0.6 : 0;
  return [(dx / dd) * go - (dz / dd) * strafe * (go ? 0.3 : 1), (dz / dd) * go + (dx / dd) * strafe * (go ? 0.3 : 1), m.type === 'cop' ? 3.4 : d.speed * 2.2];
}
{ const w0 = wildAI; wildAI = function (m, d, dt, dist, t) { return d.npc ? npcAI(m, d, dt, dist, t) : w0(m, d, dt, dist, t); }; }
// arms up while aiming (runs after updateMobs each frame)
function poseNpcs(dt) { for (const m of mobs) { if (!m.aim) continue; m.aim = Math.max(0, m.aim - dt); if (m.arms && m.arms[1]) { m.arms[1].rotation.x = -1.5; if (m.type === 'soldier' && m.arms[0]) m.arms[0].rotation.x = -1.3; } } }

// ---- cops: taser + arrest -> prison
let jail = state.jail || null;
function tase(m) {
  const o = m.g.position.clone().setY(m.g.position.y + 1.3), to = player.pos.clone().setY(player.pos.y + 1.1);
  tracer(o, to, 'zap'); zapSnd(Math.max(0.2, 1 - o.distanceTo(player.pos) / 30)); m.aim = 0.6;
  if (!canHurtPlayer() || Math.random() < 0.15) return;
  player.stunned = 3; damage(1, 'taser', m.g.position); toast('⚡ Tased! You can\'t move...');
}
function confiscate() {
  const out = [], bad = s => s && (GUNS[s.id] || /ammo$|^grenade$|^nuke$/.test(s.id));
  for (let i = 0; i < 36; i++) if (bad(state.slots[i])) { out.push(state.slots[i]); state.slots[i] = null; }
  if (bad(state.off)) { out.push(state.off); state.off = null; }
  renderHotbar(); return out;
}
function arrest() {
  if (jail) return;
  if (player.car) exitCar(); if (player.horse) dismountHorse();
  const items = confiscate(), s = findSite('prison', 30);
  wanted = 0; wantedLvl = 0; player.stunned = 0;
  const fine = Math.min(state.coins, 10 + Math.round(state.coins * 0.1)); state.coins -= fine;
  if (!s) { for (const it of items) give(it.id, it.n); toast(`🚔 Busted! Fined ${fine} coins (no prison nearby)`); return; }
  const cells = prisonCells(s), c = cells[Math.floor(Math.random() * cells.length)];
  jail = state.jail = { rx: s.rx, rz: s.rz, until: state.gameTime + 60, cell: c, items, fine };
  player.pos.set(c[0] + 0.5, c[1], c[2] + 0.5); player.vel.set(0, 0, 0); player.fallStart = null; player.yaw = Math.PI;
  streamChunks(40, 40); jailHold = performance.now() + 700;
  toast(`🚔 Busted! Fined ${fine} coins. 60s in prison... or break the bars and escape`); beep(200, 0.5, 'square', 0.06);
}
let jailHold = 0;
function jailSite() { return jail ? siteOf(jail.rx, jail.rz) : null; }
function updateJail(dt) {
  if (player.stunned > 0) { player.stunned -= dt; player.vel.x = 0; player.vel.z = 0; }
  stunEl.style.display = player.stunned > 0 ? 'block' : 'none';
  if (!jail) return;
  const s = jailSite(), c = jail.cell;
  if (jailHold) { if (!data.has(ckey(fdiv(c[0], CH), fdiv(c[2], CH)))) { streamChunks(6, 6); jailHold = Math.max(jailHold, performance.now() + 200); } if (performance.now() > jailHold) jailHold = 0; player.pos.set(c[0] + 0.5, c[1], c[2] + 0.5); player.vel.set(0, 0, 0); player.fallStart = null; return; }
  if (!player.alive) { toEvidence(s); jail = state.jail = null; return; }
  const left = jail.until - state.gameTime;
  if (left <= 0) {   // time served: your things back and out the front gate
    for (const it of jail.items || []) give(it.id, it.n); const e = prisonExit(s);
    player.pos.set(e[0] + 0.5, e[1], e[2] + 0.5); player.vel.set(0, 0, 0); jail = state.jail = null; toast('🔓 Time served. You\'re free to go - your stuff is back in your bag'); coinSnd(); return;
  }
  if (s && !inSite(s, player.pos.x, player.pos.z, 0)) {   // escaped!
    toEvidence(s); jail = state.jail = null; toast('🏃 Prison break! Your confiscated stuff is in the evidence locker (prison office)'); setWanted(); wantedLvl = Math.max(wantedLvl, 2);
  }
}
function toEvidence(s) {
  if (!s || !jail) return; const [x, y, z] = prisonChest(s), k = x + ',' + y + ',' + z, ch = state.chests[k] || (state.chests[k] = Array(27).fill(null));
  for (const it of jail.items || []) { const i = ch.findIndex(v => !v); if (i >= 0) ch[i] = it; else give(it.id, it.n); }
  jail.items = [];
}

// ---- radiation: Geiger counter clicks; drains health slowly (milder on peaceful, never kills there)
let radNow = 0, geigerT = 0, radHitT = 0;
function radiationAt(x, z) {
  let k = 0;
  for (const s of sitesNear(140)) for (const r of radSpotsOf(s)) { const d = Math.hypot(x - r.x, z - r.z); if (d < r.r) k = Math.max(k, r.k * (1 - d / r.r)); }
  for (const r of state.radZones || []) { if (r.until < state.gameTime) continue; const d = Math.hypot(x - r.x, z - r.z); if (d < r.r) k = Math.max(k, r.k * (1 - d / r.r) * Math.min(1, (r.until - state.gameTime) / 300)); }
  const bx = Math.floor(x), by = Math.floor(player.pos.y), bz = Math.floor(z);   // standing next to a waste barrel or the core
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) { const id = get(bx + dx, by + dy, bz + dz); if (id === WASTE || id === REACTOR) k = Math.max(k, 0.9 - Math.hypot(dx, dz) * 0.18); }
  if (count('uranium') > 0) k = Math.max(k, Math.min(0.5, 0.1 + count('uranium') * 0.03));
  return Math.max(0, Math.min(1.5, k));
}
let radCheckT = 0;
function updateRadiation(dt) {
  if (state.radZones && state.radZones.length && state.radZones[0].until < state.gameTime) state.radZones.shift();
  radCheckT -= dt; if (radCheckT <= 0) { radCheckT = 0.25; radNow = player.alive ? radiationAt(player.pos.x, player.pos.z) : 0; }
  if (radNow <= 0.02) return;
  geigerT -= dt; if (geigerT <= 0) { geigerT = (0.5 + Math.random() * 0.4) / (0.6 + radNow * 9); noiseF(0.012, 0.18, 'highpass', 2500, 4000, 1); }
  radHitT += dt * radNow; const every = canHurtPlayer() ? 2.6 : 5;
  if (radHitT > every) { radHitT = 0; if (canHurtPlayer() || state.hp > 8) damage(1, 'radiation'); }
}

// ---- HUD line: wanted stars, prison timer, radiation, ammo
let hud4T = 0;
function renderHud4() {
  const bits = [], id = heldGun();
  if (wanted > 0 && wantedLvl > 0) bits.push(`<span class="stars">${'★'.repeat(wantedLvl)}<i>${'★'.repeat(5 - wantedLvl)}</i></span>`);
  if (jail) bits.push(`🔒 Prison ${Math.max(0, Math.ceil(jail.until - state.gameTime))}s · break the bars to escape`);
  if (radNow > 0.02) bits.push(`☢️ Radiation ${radNow > 0.8 ? 'HIGH' : radNow > 0.35 ? 'medium' : 'low'}`);
  if (id) bits.push(`🔫 ${ITEMS[id].name} · ${count(GUNS[id].ammo)} ammo`);
  else if (held() === 'grenade') bits.push(`💣 ${count('grenade')} grenades · tap ⛏️ to throw`);
  else if (held() === 'nuke') bits.push('☢️ ✋ on the ground to arm (10s)');
  if (player.stunned > 0) bits.push('⚡ Stunned');
  const html = bits.join(' &nbsp; '); if (hud4.innerHTML !== html) hud4.innerHTML = html; hud4.style.display = html ? 'block' : 'none';
}

// ---- spawns at sites: Area 51 soldiers, prison guards, loot chests, crash-site aliens, cooling tower steam
const siteSpawned = new Map();   // site id -> time spawned
function fillLoot(key, items) {
  state.looted = state.looted || {}; if (state.looted[key] || state.chests[key]) return;
  const ch = Array(27).fill(null); items.forEach(([id, n], i) => { ch[i] = { id, n }; }); state.chests[key] = ch; state.looted[key] = 1;
}
function spawnAtSite(s, type, n, spot) {
  let made = 0;
  for (let i = 0; i < n * 6 && made < n; i++) {
    const [x, z] = spot(); if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
    const y = s.base + 1; if (solid(get(x, y, z)) || solid(get(x, y + 1, z))) continue;
    const m = spawnMob(type, x + 0.5, y, z + 0.5); if (m) { m.site = s; m.home = new THREE.Vector2(x, z); made++; if (type === 'cop') m.guard = true; }
  }
  return made;
}
let siteT = 0, steamT = 0, ufoWarnT = 0;
function updateSites(dt) {
  if (soldierAlert > 0) soldierAlert -= dt;
  const pp = player.pos; let inA51 = null;
  steamT -= dt;
  for (const s of sitesNear(150)) {
    if (s.type === 'area51' && inSite(s, pp.x, pp.z, 1) && !jail) inA51 = s;
    if (s.type === 'plant' && steamT <= 0) for (const [tx, tz] of [[s.x0 + 14, s.z0 + 15], [s.x0 + 14, s.z0 + 40]]) if (Math.hypot(tx - pp.x, tz - pp.z) < 130) smokePuff(tx + (Math.random() - .5) * 6, s.base + 34, tz + (Math.random() - .5) * 6, 2, 0xf4f4f4);
  }
  if (steamT <= 0) steamT = 0.35;
  if (inA51 && canHurtPlayer()) { trespassT += dt; if (trespassT > 0.1 && ufoWarnT <= 0) { ufoWarnT = 6; toast(trespassT > 4 ? '🚨 Intruder! The soldiers are shooting!' : '⚠️ RESTRICTED AREA · Leave now or be shot'); } } else trespassT = Math.max(0, trespassT - dt * 2);
  if (ufoWarnT > 0) ufoWarnT -= dt;
  siteT -= dt; if (siteT > 0) return; siteT = 1.5;
  for (const s of sitesNear(110)) {
    const cxm = (s.x0 + s.x1) / 2, czm = (s.z0 + s.z1) / 2, d = Math.hypot(cxm - pp.x, czm - pp.z);
    if (d > 95) continue;
    if (!data.has(ckey(fdiv(Math.floor(cxm), CH), fdiv(Math.floor(czm), CH)))) continue;
    const R = (a, b) => a + Math.floor(Math.random() * (b - a));
    if (s.type === 'area51') {
      const have = mobs.filter(m => m.type === 'soldier' && m.site === s).length; if (have < 6) spawnAtSite(s, 'soldier', 6 - have, () => [R(s.x0 + 4, s.x1 - 4), R(s.z0 + 30, s.z0 + 48)]);
      const [cx, cy, cz] = a51Chest(s); fillLoot(cx + ',' + cy + ',' + cz, [['alien_tech', 4], ['rifle', 1], ['rifle_ammo', 48], ['grenade', 4]]);
    }
    if (s.type === 'prison') {
      const have = mobs.filter(m => m.type === 'cop' && m.site === s).length; if (have < 3) spawnAtSite(s, 'cop', 3 - have, () => [R(s.x0 + 22, s.x0 + 46), R(s.z0 + 4, s.z0 + 15)]);
    }
    if (!siteSpawned.has(s.id) && typeof parkAircraft === 'function') { siteSpawned.set(s.id, 1); parkAircraft(s); if (s.type === 'area51') { showCapturedUfo(s); armyTrucks(s); } }
  }
  for (const [k, c] of crashSites) {
    const d = Math.hypot(c.x - pp.x, c.z - pp.z); if (d > 90) continue;
    fillLoot(c.chest, [['alien_tech', 3], ['uranium', 2], ['pistol_ammo', 12]]);
    if (!siteSpawned.has('C' + k) && d < 70) { siteSpawned.set('C' + k, 1); for (let i = 0; i < 6; i++) fireAt(c.x + rint(-5, 5), c.y + 2, c.z + rint(-5, 5), 30 + Math.random() * 30);
      for (let i = 0; i < 3; i++) { const m = spawnMob('alien', c.x + rint(-6, 6) + 0.5, c.y + 2, c.z + rint(-6, 6) + 0.5, i); if (m) m.home = new THREE.Vector2(c.x, c.z); } }
  }
  for (const [k] of siteSpawned) { if (k[0] === 'C') { const c = crashSites.get(k.slice(1)); if (!c || Math.hypot(c.x - pp.x, c.z - pp.z) > 160) siteSpawned.delete(k); } }
}

// first-person gun models (built from boxes, drawn on top like the other held items)
let gunGroup = null, gunShown = null;
function heldGunMesh(id) {
  const g = new THREE.Group(); g.userData.gun = true; const mats = {};
  const B = (w, h, d, col, x, y, z, p = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[col] || (mats[col] = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, depthTest: false, depthWrite: false })));
    m.position.set(x, y, z); m.renderOrder = 10; p.add(m); return m; };
  if (id === 'pistol') { B(0.08, 0.09, 0.36, 0x45484e, 0, 0.05, -0.2); B(0.082, 0.02, 0.3, 0x7a7e86, 0, 0.1, -0.18); const gr = B(0.07, 0.2, 0.09, 0x4a3420, 0, -0.06, -0.05); gr.rotation.x = 0.25; B(0.02, 0.05, 0.06, 0x222222, 0, -0.03, -0.14); }
  if (id === 'rifle') { B(0.09, 0.1, 0.46, 0x3a3d42, 0, 0.04, -0.25); B(0.04, 0.04, 0.34, 0x26282c, 0, 0.06, -0.62); B(0.08, 0.12, 0.26, 0x6a4626, 0, 0.0, 0.08); B(0.06, 0.18, 0.07, 0x1e2024, 0, -0.1, -0.28); B(0.06, 0.06, 0.18, 0x111111, 0, 0.13, -0.24); B(0.04, 0.03, 0.02, 0x7ad0ff, 0, 0.13, -0.15); const gr = B(0.06, 0.14, 0.07, 0x2e3034, 0, -0.07, -0.08); gr.rotation.x = 0.3; }
  if (id === 'minigun') { B(0.2, 0.2, 0.3, 0x5a5e66, 0, 0, -0.05); B(0.06, 0.06, 0.2, 0x2a2a2a, 0, 0.16, -0.05); B(0.12, 0.14, 0.16, 0x5a6a30, 0.12, -0.14, 0.02);
    const sp = new THREE.Group(); sp.position.set(0, 0, -0.2); g.add(sp); g.userData.spin = sp;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B(0.035, 0.035, 0.5, i % 2 ? 0x2a2c30 : 0x8a9098, Math.cos(a) * 0.06, Math.sin(a) * 0.06, -0.25, sp); } B(0.16, 0.16, 0.03, 0x3a3d42, 0, 0, -0.45, sp); }
  g.position.set(-0.08, 0.12, -0.05); g.rotation.set(0.02, 0.06, 0); if (id === 'minigun') { g.scale.setScalar(0.75); g.position.set(-0.04, 0.1, -0.08); } return g;
}
// olive-green military trucks parked by the Area 51 gate (drivable like any car)
function armyTrucks(s) {
  for (const [dx, dz] of [[44, 8], [48, 8]]) { const x = s.x0 + dx + 0.5, z = s.z0 + dz + 0.5; if (cars.some(c => Math.hypot(c.x - x, c.z - z) < 3)) continue;
    const c = spawnCar({ base: s.base, x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, nb: 3, id: s.id }, { x, z, head: 0, people: 0 }), col = c.g.children[0].material.color.getHex();
    c.g.traverse(o => { if (o.material && o.material.color && o.material.color.getHex() === col) o.material.color.setHex(0x4b5a2a); }); c.army = true; }
}
// ---- the per-frame hook (called from the main loop)
function updateV110s4(dt, t) {
  updateFx(dt);
  if (!playing) return;
  gunCd = Math.max(0, gunCd - dt); ammoWarnT = Math.max(0, ammoWarnT - dt); wantedBumpT = Math.max(0, wantedBumpT - dt);
  if (wanted <= 0) wantedLvl = 0;
  const gid = heldGun();
  spinT = gid && GUNS[gid].spin && holdBreak && !uiOpen ? spinT + dt : Math.max(0, spinT - dt * 2);
  if (gid && spinT > 0 && holdBreak && Math.random() < dt * 12) beep(120 + spinT * 200, 0.05, 'sawtooth', 0.015);
  if (hbDirty) { hbDirty = false; renderHotbar(); }
  // held gun: a little 3D model, barrel forward, kicked back by each shot (the minigun's barrels spin)
  const hm = hand.children.find(c => !c.userData.gun); if (hm) hm.visible = !gid;
  if (gid !== gunShown) { if (gunGroup) hand.remove(gunGroup); gunGroup = gid ? heldGunMesh(gid) : null; if (gunGroup) hand.add(gunGroup); gunShown = gid; }
  if (gunGroup && gunGroup.parent !== hand) hand.add(gunGroup);
  if (gid) { hand.position.z += recoil * 0.9; hand.rotation.x += recoil * 1.2; if (gunGroup.userData.spin) gunGroup.userData.spin.rotation.z += dt * spinT * 40; }
  recoil = Math.max(0, recoil - dt * 1.4);
  updateGrenades(dt); updateGangs(dt); poseNpcs(dt); updateJail(dt); updateRadiation(dt); updateSites(dt);
  if (typeof updateAir === 'function') updateAir(dt, t);
  if (shakeT > 0) { shakeT -= dt; const a = shakeAmp * Math.min(1, shakeT); camera.position.x += (Math.random() - .5) * a; camera.position.y += (Math.random() - .5) * a; camera.position.z += (Math.random() - .5) * a; if (shakeT <= 0) shakeAmp = 0; }
  hud4T -= dt; if (hud4T <= 0) { hud4T = 0.25; renderHud4(); }
}

// ================== v1.10 step 4: aircraft (plane + helicopter) and UFOs ==================
// Fly: joystick / WASD steers (plane: forward = throttle), ⏫ / Space climbs, ⏬ / Shift descends, 🚪 / X gets out.
// The plane needs speed on the ground to take off; the helicopter goes straight up. While aboard, player.car = the aircraft.
const aircraft = [];
const airKeys = { up: false, down: false };
addEventListener('keydown', e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.code === 'Space') airKeys.up = true; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') airKeys.down = true;
  if (e.code === 'KeyX' && player.car && player.car.air) exitAircraft(); });
addEventListener('keyup', e => { if (e.code === 'Space') airKeys.up = false; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') airKeys.down = false; });
const btnAir = { up: false, down: false };
holdBtn('bUp', () => { btnAir.up = true; }, () => { btnAir.up = false; });
holdBtn('bDown', () => { btnAir.down = true; }, () => { btnAir.down = false; });
holdBtn('bExitAir', () => { if (player.car && player.car.air) exitAircraft(); });
function buildPlane() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  box(1.1, 1.1, 6, 0xf4f4f4, 0, 1.2, 0, body); box(1.12, 0.25, 6.02, 0x2a6ad2, 0, 1.05, 0, body); box(0.9, 0.9, 0.6, 0xd8dade, 0, 1.2, 3.25, body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.3), glassMat); cab.position.set(0, 1.95, 1.2); body.add(cab);
  box(9.5, 0.14, 1.6, 0xe8e8ea, 0, 1.25, 0.4, body); box(0.4, 0.16, 1.62, 0xd02020, 4.6, 1.25, 0.4, body); box(0.4, 0.16, 1.62, 0xd02020, -4.6, 1.25, 0.4, body);
  box(0.12, 1.3, 1.1, 0xd02020, 0, 2.2, -2.6, body); box(3.2, 0.12, 0.9, 0xe8e8ea, 0, 1.45, -2.7, body);
  for (const [x, z] of [[-1, 0.6], [1, 0.6], [0, 2.4]]) { box(0.08, 0.5, 0.08, 0x333333, x, 0.45, z, body); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10), tyreMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.22, z); body.add(w); }
  const prop = new THREE.Group(); prop.position.set(0, 1.2, 3.6); body.add(prop); box(0.14, 2.4, 0.06, 0x2a2a2a, 0, 0, 0, prop); box(0.22, 0.22, 0.2, 0xd02020, 0, 0, 0.02, prop);
  return { g, body, spin: prop, spinAxis: 'z' };
}
function buildHeli() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  box(1.7, 1.5, 3, 0x3f6a2e, 0, 1.35, 0, body); box(1.72, 0.3, 3.02, 0x2a4a1e, 0, 0.75, 0, body);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.9), glassMat); gl.position.set(0, 1.45, 1.7); body.add(gl);
  box(0.32, 0.32, 3.6, 0x3f6a2e, 0, 1.65, -3.2, body); box(0.1, 0.9, 0.6, 0x2a4a1e, 0, 2.05, -4.9, body);
  for (const x of [-0.75, 0.75]) { box(0.1, 0.1, 3.2, 0x222222, x, 0.1, 0, body); box(0.08, 0.6, 0.08, 0x222222, x, 0.4, 0.8, body); box(0.08, 0.6, 0.08, 0x222222, x, 0.4, -0.8, body); }
  box(0.2, 0.5, 0.2, 0x333333, 0, 2.3, 0, body);
  const rotor = new THREE.Group(); rotor.position.set(0, 2.6, 0); body.add(rotor); box(9, 0.06, 0.32, 0x1a1a1a, 0, 0, 0, rotor); box(0.32, 0.06, 9, 0x1a1a1a, 0, 0, 0, rotor);
  const tail = new THREE.Group(); tail.position.set(0.22, 2.05, -4.9); body.add(tail); box(0.04, 1.4, 0.16, 0x1a1a1a, 0, 0, 0, tail);
  return { g, body, spin: rotor, spinAxis: 'y', tail };
}
function spawnAircraft(kind, x, y, z, head, opts = {}) {
  const parts = kind === 'plane' ? buildPlane() : kind === 'ufo' ? buildUfoCraft() : buildHeli();
  const a = { air: true, kind, ...parts, x, y, z, head, pitch: 0, roll: 0, speed: 0, vy: 0, onGround: true, rpm: 0, owned: !!opts.owned, taken: opts.taken || null, id: opts.id || ('A' + Math.random().toString(36).slice(2, 8)) };
  a.g.position.set(x, y, z); a.g.rotation.y = head; scene.add(a.g); aircraft.push(a); return a;
}
function removeAircraft(a) { scene.remove(a.g); aircraft.splice(aircraft.indexOf(a), 1); syncAircraft(); }
function syncAircraft() { state.aircraft = aircraft.filter(a => a.owned).map(a => ({ kind: a.kind, x: +a.x.toFixed(2), y: +a.y.toFixed(2), z: +a.z.toFixed(2), head: +a.head.toFixed(3), id: a.id, taken: a.taken })); }
for (const r of state.aircraft || []) if (r && (r.kind === 'plane' || r.kind === 'helicopter')) spawnAircraft(r.kind, r.x, r.y, r.z, r.head, { owned: true, taken: r.taken, id: r.id });
// parked aircraft at airports and Area 51 (one each per spot, unless you already flew off with it)
function parkAircraft(s) {
  for (const [i, [kind, dx, dz, hd]] of (PARKED[s.type] || []).entries()) {
    const key = s.id + ':' + i; if ((state.takenAir || {})[key]) continue;
    const x = s.x0 + dx + 0.5, z = s.z0 + dz + 0.5; if (aircraft.some(a => Math.hypot(a.x - x, a.z - z) < 5)) continue;
    const a = spawnAircraft(kind, x, s.base + 1, z, hd); a.parkKey = key;
  }
}
const capUfos = new Map();
function showCapturedUfo(s) { if (capUfos.has(s.id)) return; const [x, y, z] = a51Ufo(s), u = buildUfo(); u.g.position.set(x + 0.5, y + 0.9, z + 0.5); u.g.rotation.z = 0.12; u.g.rotation.x = -0.08; scene.add(u.g); capUfos.set(s.id, u); }
// what you're looking at (for boarding)
function aimAircraft(maxD = 7) {
  const o = camera.position, d = getDir(); let best = null, bt = maxD;
  for (const a of aircraft) { if (a === player.car) continue; const c = new THREE.Vector3(a.x, a.y + 1.3, a.z), t = c.clone().sub(o).dot(d); if (t < 0 || t > bt + 3) continue;
    const p = o.clone().addScaledVector(d, t); if (p.distanceTo(c) < (a.kind === 'plane' ? 2.6 : a.kind === 'ufo' ? 4 : 2.2) && t < bt + 2) { bt = t; best = a; } }
  return best;
}
function aircraftUse(id) {
  if (player.car) return false;
  const a = aimAircraft(); if (a) { boardAircraft(a); return true; }
  if (id === 'plane' || id === 'helicopter') {
    const h = raycast(); if (!h || h.kind !== 'block') { toast('✈️ Aim at open ground to park it'); return true; }
    const x = h.x + 0.5, y = h.y + 1, z = h.z + 0.5;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 2; dy++) if (solid(get(Math.floor(x) + dx, y + dy, Math.floor(z) + dz))) { toast('✈️ Not enough room here'); return true; }
    const a = spawnAircraft(id, x, y, z, player.yaw + Math.PI, { owned: true }); useHeld(1); syncAircraft(); toast(id === 'plane' ? '✈️ Your airplane is ready · ✋ to board' : '🚁 Your helicopter is ready · ✋ to board'); return true;
  }
  return false;
}
function boardAircraft(a) {
  player.car = a; a.lastHead = a.head; player.yaw = a.head + Math.PI; player.pitch = -0.12; a.owned = true;
  if (a.parkKey) { (state.takenAir = state.takenAir || {})[a.parkKey] = 1; a.taken = a.parkKey; a.parkKey = null; }
  document.body.classList.add('flying'); syncAircraft();
  if (a.kind === 'ufo') toast(isTouch ? '🛸 ⏫ to lift off, joystick to fly · climb above 128 to reach the Moon · 🚪 to get out' : '🛸 Space = up, Shift = down, WASD = fly, climb above 128 for the Moon, X = get out');
  else toast(isTouch ? (a.kind === 'plane' ? '✈️ Hold forward for throttle, ⏫ to pull up once you\'re fast · 🚪 to get out' : '🚁 ⏫ to lift off, joystick to fly · 🚪 to get out')
    : (a.kind === 'plane' ? '✈️ W = throttle, Space = pull up, Shift = dive, A/D = turn, X = get out' : '🚁 Space = up, Shift = down, WASD = fly, X = get out')); beep(160, 0.3, 'sawtooth', 0.05);
}
function exitAircraft() {
  const a = player.car; if (!a || !a.air) return; player.car = null; document.body.classList.remove('flying');
  const sx = a.x + Math.cos(a.head) * (a.kind === 'plane' ? 2.2 : 1.8), sz = a.z - Math.sin(a.head) * (a.kind === 'plane' ? 2.2 : 1.8);
  let y = Math.floor(a.y); while (y < H - 2 && (solid(get(Math.floor(sx), y, Math.floor(sz))) || solid(get(Math.floor(sx), y + 1, Math.floor(sz))))) y++;
  player.pos.set(sx, a.onGround ? y : a.y, sz); player.vel.set(0, 0, 0); player.fallStart = a.onGround ? null : a.y;
  if (!a.onGround) toast('🪂 You jumped out!'); syncAircraft();
}
{ const ec0 = exitCar; exitCar = function () { const c = player.car; if (c && c.air) { if (!player.alive) exitAircraft(); return; } return ec0(); }; }
function airGround(x, y, z) { for (let yy = Math.min(H - 1, Math.floor(y) + 1); yy >= 0; yy--) if (solid(get(Math.floor(x), yy, Math.floor(z)))) return yy + 1; return -99; }
function crashAircraft(a, why) {
  const was = player.car === a; if (was) { player.car = null; document.body.classList.remove('flying'); player.pos.set(a.x, a.y + 1, a.z); player.vel.set(0, 0, 0); player.fallStart = null; }
  removeAircraft(a); blast(a.x, a.y + 0.8, a.z, { r: 3, dmg: 14, fire: 6 }); if (was) toast('💥 ' + (why || 'You crashed!'));
}
function blastAircraft(c, r) { for (const a of [...aircraft]) if (a !== player.car && Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) < r) { removeAircraft(a); smokePuff(a.x, a.y + 1, a.z, 6, 0x333333); } }
let airSndT = 0, airSync = 0;
function flyAircraft(a, dt) {
  let thr = 0, turn = 0;
  if (keys.KeyW || keys.ArrowUp) thr += 1; if (keys.KeyS || keys.ArrowDown) thr -= 1; if (keys.KeyA || keys.ArrowLeft) turn += 1; if (keys.KeyD || keys.ArrowRight) turn -= 1;
  if (joy.id !== null) { thr -= joy.y; turn -= joy.x; }
  thr = Math.max(-1, Math.min(1, thr)); turn = Math.max(-1, Math.min(1, turn));
  const up = (airKeys.up || btnAir.up || wantJump) ? 1 : 0, down = (airKeys.down || btnAir.down) ? 1 : 0; wantJump = false;
  const gy = airGround(a.x, a.y + 0.5, a.z), loaded = data.has(ckey(fdiv(Math.floor(a.x), CH), fdiv(Math.floor(a.z), CH)));
  if (a.kind === 'plane') {
    a.speed += (thr > 0.1 ? thr * 9 : thr < -0.1 ? thr * 12 : -1.5) * dt; a.speed = Math.max(0, Math.min(44, a.speed));
    if (a.onGround) {
      a.head += turn * dt * 1.1 * Math.min(1, a.speed / 6); a.pitch += (0 - a.pitch) * Math.min(1, dt * 4); a.roll *= 0.9;
      a.vy = 0;
      if (up && a.speed >= 16) { a.onGround = false; a.pitch = 0.2; a.vy = 3; a.y += 0.15; toast('🛫 Takeoff!'); }
      else if (up && a.speed < 16 && Math.random() < dt * 2) toast('✈️ Faster! Hold forward to build speed before pulling up');
    } else {
      const want = (up - down) * 0.45; a.pitch += (want - a.pitch) * Math.min(1, dt * 1.8);
      a.head += turn * dt * 0.75; a.roll += (turn * -0.6 - a.roll) * Math.min(1, dt * 3);
      a.vy = Math.sin(a.pitch) * a.speed; if (a.speed < 14) { a.vy -= (1 - a.speed / 14) * 12; a.pitch -= dt * 0.4; }
      if (!loaded && a.y < 50) a.vy = Math.max(0, a.vy);
    }
    const cp = Math.cos(a.pitch), fx = Math.sin(a.head), fz = Math.cos(a.head), nx = a.x + fx * cp * a.speed * dt, nz = a.z + fz * cp * a.speed * dt;
    const nose = [nx + fx * 3.6, a.y + 1.2, nz + fz * 3.6], wingL = [nx + fz * 4.5, a.y + 1.3, nz - fx * 4.5], wingR = [nx - fz * 4.5, a.y + 1.3, nz + fx * 4.5];
    const hitB = [nose, wingL, wingR].some(([x, y, z]) => solid(get(Math.floor(x), Math.floor(y), Math.floor(z))));
    if (hitB) { if (a.speed > 9 || !a.onGround) { crashAircraft(a, 'You flew into something!'); return; } a.speed = 0; }
    else { a.x = nx; a.z = nz; }
    a.y += a.vy * dt; a.y = Math.min(a.y, 140);
    const g2 = airGround(a.x, a.y + 0.5, a.z);
    if (g2 > -99 && a.y <= g2) { if (!a.onGround && (a.vy < -10 || Math.abs(a.roll) > 0.7)) { crashAircraft(a, 'Crash landing!'); return; } if (!a.onGround) toast('🛬 Landed'); a.y = g2; a.onGround = true; a.vy = 0; a.pitch = 0; }
    else if (a.onGround && g2 > -99 && a.y > g2 + 0.6) a.onGround = false;
    if (a.onGround && g2 > -99) a.y = g2;
    a.rpm = 4 + a.speed * 1.2;
  } else {
    const ufo = a.kind === 'ufo'; a.vy += ((up - down) * (ufo ? 11 : 7) - a.vy) * Math.min(1, dt * 3);
    if (a.onGround && a.vy <= 0) a.vy = 0;
    if (!loaded && a.y < 50) a.vy = Math.max(0, a.vy);
    const target = thr * (ufo ? 26 : 15); a.speed += (target - a.speed) * Math.min(1, dt * 1.4);
    if (a.onGround) a.speed *= 0.8;
    a.head += turn * dt * 1.7; a.pitch += (a.speed / 15 * -0.22 - a.pitch) * Math.min(1, dt * 3); a.roll += (turn * -0.18 - a.roll) * Math.min(1, dt * 3);
    const fx = Math.sin(a.head), fz = Math.cos(a.head), nx = a.x + fx * a.speed * dt, nz = a.z + fz * a.speed * dt;
    const pts = ufo ? [[nx + fx * 3.6, a.y + 1.3, nz + fz * 3.6], [nx + fz * 3.6, a.y + 1.3, nz - fx * 3.6], [nx - fz * 3.6, a.y + 1.3, nz + fx * 3.6], [nx, a.y + 2.2, nz]] : [[nx + fx * 2.2, a.y + 1.4, nz + fz * 2.2], [nx, a.y + 2.6, nz], [nx - fx * 4.6, a.y + 1.8, nz - fz * 4.6]];
    if (pts.some(([x, y, z]) => solid(get(Math.floor(x), Math.floor(y), Math.floor(z))))) { if (Math.abs(a.speed) > 10 && !ufo) { crashAircraft(a, 'The rotor hit something!'); return; } a.speed = -a.speed * 0.3; }
    else { a.x = nx; a.z = nz; }
    a.y += a.vy * dt; a.y = Math.min(a.y, 140);
    const g2 = airGround(a.x, a.y + 0.5, a.z);
    if (g2 > -99 && a.y <= g2) { if (a.vy < -12 && !ufo) { crashAircraft(a, 'Hard landing!'); return; } if (!a.onGround && a.rpm > 5) toast(ufo ? '🛸 Touchdown' : '🚁 Touchdown'); a.y = g2; a.onGround = true; a.vy = Math.max(0, a.vy); }
    else if (g2 === -99 || a.y > g2 + 0.3) a.onGround = false;
    a.rpm += ((a.onGround && !up ? 6 : 30) - a.rpm) * Math.min(1, dt * 1.5);
    if (a.tail) a.tail.rotation.x += dt * a.rpm * 1.4;
  }
  a.g.position.set(a.x, a.y, a.z); a.g.rotation.set(0, a.head, 0); a.body.rotation.set(-a.pitch, 0, a.roll);
  player.yaw += a.head - a.lastHead; a.lastHead = a.head;
  player.pos.set(a.x, a.y + 0.3, a.z); player.vel.set(0, 0, 0); player.fallStart = null;
  // chase camera
  const pt = Math.min(0.7, Math.max(-0.9, player.pitch)), cpp = Math.cos(pt), fwd = new THREE.Vector3(-Math.sin(player.yaw) * cpp, Math.sin(pt), -Math.cos(player.yaw) * cpp);
  const focus = new THREE.Vector3(a.x, a.y + 1.8, a.z), maxD = a.kind === 'plane' ? 11 : 10; let dist = maxD;
  for (let s = 1.5; s <= maxD; s += 0.5) { const q = focus.clone().addScaledVector(fwd, -s); q.y += 1.2; if (solid(get(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z)))) { dist = Math.max(2, s - 0.6); break; } }
  camera.position.copy(focus).addScaledVector(fwd, -dist); camera.position.y += 1.2; camera.lookAt(focus.x + fwd.x * 4, focus.y + 0.4 + fwd.y * 4, focus.z + fwd.z * 4);
  airSndT -= dt; if (airSndT <= 0) { if (a.kind === 'plane') { airSndT = 0.16; beep(60 + a.speed * 4, 0.17, 'sawtooth', 0.02); } else { airSndT = Math.max(0.07, 1.6 / Math.max(4, a.rpm)); noiseF(0.06, 0.12, 'lowpass', 500, 120, 0.8); } }
}
function updateAircraft(dt) {
  if (player.car && player.car.air && !player.alive) exitAircraft();
  document.body.classList.toggle('flying', !!(player.car && player.car.air));
  for (const a of [...aircraft]) {
    if (a === player.car) { flyAircraft(a, dt); }
    else {
      if (!a.onGround && a.kind === 'ufo') {   // a UFO you hop out of just floats down and lands
        a.y -= dt * 5; a.speed *= 0.95; const g2 = airGround(a.x, a.y + 0.5, a.z); if (g2 > -99 && a.y <= g2) { a.y = g2; a.onGround = true; a.vy = 0; } a.g.position.set(a.x, a.y, a.z);
      } else if (!a.onGround) {   // abandoned in the air: it falls and crashes
        a.vy -= 20 * dt; a.y += a.vy * dt; a.x += Math.sin(a.head) * a.speed * dt; a.z += Math.cos(a.head) * a.speed * dt; a.speed *= 0.99;
        const g2 = airGround(a.x, a.y + 0.5, a.z); if (g2 > -99 && a.y <= g2) { crashAircraft(a); continue; } if (a.y < -10) { removeAircraft(a); continue; }
        a.g.position.set(a.x, a.y, a.z);
      }
      a.rpm = Math.max(0, a.rpm - dt * 8);
      if (!a.owned && Math.hypot(a.x - player.pos.x, a.z - player.pos.z) > 220) { removeAircraft(a); continue; }
    }
    if (a.spinAxis === 'z') a.spin.rotation.z += dt * a.rpm * 3; else a.spin.rotation.y += dt * a.rpm * 1.2;
  }
  for (const [id, u] of capUfos) { u.lights.rotation.y += dt * 0.6; if (Math.hypot(u.g.position.x - player.pos.x, u.g.position.z - player.pos.z) > 240) { scene.remove(u.g); capUfos.delete(id); siteSpawned.delete(id); } }
  airSync += dt; if (airSync > 1) { airSync = 0; syncAircraft(); for (const [k] of siteSpawned) { if (k[0] === 'S') { const s = sitesNear(260).find(q => q.id === k); if (!s) siteSpawned.delete(k); } } }
  if (!player.car) { const a = aimAircraft(); if (a) { const el = document.getElementById('target'); el.style.display = 'block'; el.textContent = a.kind === 'plane' ? '✈️ ✋ Fly this airplane' : a.kind === 'ufo' ? '🛸 ✋ Fly this UFO' : '🚁 ✋ Fly this helicopter'; } }
}

// ---- UFOs: they cruise the night sky, hover with a tractor beam and sometimes drop off an alien. Shoot one down for alien tech
const ufos = [];
const beamMat = new THREE.MeshBasicMaterial({ color: 0x7affa0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
function buildUfo() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 4.2, 0.8, 24), new THREE.MeshLambertMaterial({ color: 0xb8bcc8, emissive: 0x3a4250 })); g.add(disc);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 2.2, 0.6, 24), new THREE.MeshLambertMaterial({ color: 0x7a7e8a, emissive: 0x20242c })); under.position.y = -0.7; g.add(under);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8affc0, transparent: true, opacity: 0.6, emissive: 0x206040 })); dome.position.y = 0.4; g.add(dome);
  const lights = new THREE.Group(); g.add(lights);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, l = box(0.32, 0.18, 0.32, i % 2 ? 0xff40a0 : 0x40ffd0, Math.cos(a) * 3.5, -0.42, Math.sin(a) * 3.5, lights); l.material.emissive.setHex(i % 2 ? 0xff2080 : 0x20ffc0); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 4.5, 1, 20, 1, true), beamMat); beam.visible = false; g.add(beam);
  return { g, lights, beam };
}
let ufoT = 8, ufoSndT = 0;
function spawnUfo(x, y, z) { const u = buildUfo(); u.g.position.set(x, y, z); scene.add(u.g); const o = { ...u, mode: 'cruise', t: 0, hp: 12, vx: 0, vz: 0, vy: 0, tx: player.pos.x + (Math.random() - .5) * 40, tz: player.pos.z + (Math.random() - .5) * 40, dropped: false }; ufos.push(o); return o; }
function removeUfo(u) { scene.remove(u.g); ufos.splice(ufos.indexOf(u), 1); }
function ufoShot(o, dir, maxT) {
  for (const u of ufos) { const c = u.g.position, t = c.clone().sub(o).dot(dir); if (t < 0 || t > Math.max(maxT, 150)) continue; const p = o.clone().addScaledVector(dir, t);
    if (p.distanceTo(c) < 4) { u.hp--; flashAt(p, 0.8); beep(1800, 0.04, 'square', 0.04); if (u.hp <= 0 && u.mode !== 'down') { u.mode = 'down'; u.vy = 0; toast('🛸 Direct hit! The UFO is going down!'); } return true; } }
  return false;
}
function updateUfos(dt, t) {
  ufoT -= dt;
  if (ufoT <= 0) { ufoT = 12 + Math.random() * 20;
    if (nightAmt > 0.6 && ufos.length < 2 && Math.random() < 0.6) { const a = Math.random() * 6.28, r = 80 + Math.random() * 20; spawnUfo(player.pos.x + Math.cos(a) * r, 46 + Math.random() * 14, player.pos.z + Math.sin(a) * r); } }
  for (const u of [...ufos]) {
    const p = u.g.position; u.t += dt; u.lights.rotation.y += dt * 2.5; u.g.rotation.y += dt * 0.4;
    if (u.mode === 'down') {
      u.vy -= 14 * dt; p.y += u.vy * dt; u.g.rotation.z += dt * 2; if (Math.random() < dt * 20) smokePuff(p.x, p.y, p.z, 1, 0x333333);
      const gy = groundAt(p.x, p.z); if (p.y <= gy + 0.5) { removeUfo(u); blast(p.x, gy, p.z, { r: 3, dmg: 12, fire: 6, byPlayer: true }); give('alien_tech', 2); toast('🛸 You shot down a UFO! +2 Alien Tech'); coinSnd(); }
      continue;
    }
    if (u.mode === 'cruise') {
      const dx = u.tx - p.x, dz = u.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 3) { u.mode = 'hover'; u.t = 0; u.hov = 8 + Math.random() * 6; }
      else { const s = Math.min(d, 18 * dt); p.x += dx / d * s; p.z += dz / d * s; }
      p.y += Math.sin(t * 1.3 + u.hp) * dt * 0.8;
    } else if (u.mode === 'hover') {
      const gy = groundAt(p.x, p.z); u.beam.visible = true; const len = Math.max(2, p.y - gy - 0.6); u.beam.scale.set(1, len, 1); u.beam.position.y = -0.9 - len / 2; beamMat.opacity = 0.14 + Math.sin(t * 6) * 0.05;
      p.y += ((gy + 22) - p.y) * Math.min(1, dt * 0.6);
      if (!u.dropped && u.t > 4) { u.dropped = true; if (mobs.filter(m => m.type === 'alien').length < 4 && Math.random() < 0.7) { const m = spawnMob('alien', p.x, gy + 0.2, p.z, rint(0, 9)); if (m) { m.home = new THREE.Vector2(p.x, p.z); particles(p.x, gy + 1, p.z, new THREE.Color(0.4, 1, 0.6), 12); } } }
      if (u.t > u.hov) { u.mode = 'leave'; u.beam.visible = false; const a = Math.random() * 6.28; u.vx = Math.cos(a) * 30; u.vz = Math.sin(a) * 30; }
    } else { p.x += u.vx * dt; p.z += u.vz * dt; p.y += dt * 10; }
    const dp = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    if (dp > 170 || (nightAmt < 0.3 && u.mode !== 'hover') || p.y > 130) { removeUfo(u); continue; }
  }
  const near = ufos.reduce((m, u) => Math.min(m, u.g.position.distanceTo(player.pos)), 1e9);
  ufoSndT -= dt; if (near < 80 && ufoSndT <= 0) { ufoSndT = 1.4; const v = 0.05 * (1 - near / 80); sweep(520, 880, 0.6, 'sine', v); setTimeout(() => sweep(880, 520, 0.6, 'sine', v), 600); }
}
function updateAir(dt, t) { updateAircraft(dt); updateUfos(dt, t); }
// ================== v1.11 DRUG UPDATE: highs, drunk, trips + crackheads ==================
// kind: up (crack, cocaine, meth: run faster) or down (everything else: run slower). fx picks the screen effect.
const DRUGS = {
  crack:         { kind: 'up',   speed: 1.65, dur: 45,  fx: 'wired', e: '🪨', n: 'Crack high' },
  cocaine:       { kind: 'up',   speed: 1.45, dur: 75,  fx: 'wired', e: '❄️', n: 'Coked up' },
  meth:          { kind: 'up',   speed: 1.55, dur: 150, fx: 'wired', e: '🧊', n: 'Tweaking' },
  beer:          { kind: 'down', speed: 0.75, dur: 90,  fx: 'drunk', e: '🍺', n: 'Drunk' },
  vodka:         { kind: 'down', speed: 0.7,  dur: 150, fx: 'drunk', e: '🍾', n: 'Drunk', strong: 2 },
  cough_syrup:   { kind: 'down', speed: 0.7,  dur: 120, fx: 'lean',  e: '🧴', n: 'Syrup' },
  purple_sprite: { kind: 'down', speed: 0.6,  dur: 200, fx: 'lean',  e: '🥤', n: 'Leaning' },
  pills:         { kind: 'down', speed: 0.8,  dur: 60,  fx: 'pills', e: '💊', n: 'Pilled' },
  xanax:         { kind: 'down', speed: 0.55, dur: 120, fx: 'xan',   e: '💊', n: 'Xanned out' },
  ecstasy:       { kind: 'down', speed: 0.8,  dur: 150, fx: 'rolling', e: '💊', n: 'Rolling' },
  acid:          { kind: 'down', speed: 0.75, dur: 240, fx: 'trip',  e: '🌈', n: 'Tripping' },
  brown_mushroom:{ kind: 'down', speed: 0.8,  dur: 90,  fx: 'trip',  e: '🍄', n: 'Shrooming' },
  red_mushroom:  { kind: 'down', speed: 0.8,  dur: 120, fx: 'trip',  e: '🍄', n: 'Shrooming' },
  mushroom_stew: { kind: 'down', speed: 0.75, dur: 200, fx: 'trip',  e: '🥣', n: 'Shroom soup trip' },
};
const DRUG_MSG = { crack: '🪨 Your heart is racing. You feel FAST', cocaine: '❄️ Sniff... you feel unstoppable', meth: '🧊 Wide awake and twitchy. Zoom zoom',
  beer: '🍺 *hic*', vodka: '🍾 Whoa... the room is spinning', cough_syrup: '🧴 Everything slows down...', purple_sprite: '🥤 Sippin\' lean. Moving in slow motion',
  pills: '💊 Feeling a little fuzzy', xanax: '💊 So... relaxed... can barely move', ecstasy: '💊 Everything feels amazing', acid: '🌈 The colors are breathing...',
  brown_mushroom: '🍄 The ground is starting to wiggle', red_mushroom: '🍄 The trees are melting', mushroom_stew: '🥣 Uh oh. That soup was strong' };
const highs = {};   // fx -> { t, max, lvl, speed, kind }
function takeDrug(id) {
  const d = DRUGS[id]; if (!d) return;
  const h = highs[d.fx] || (highs[d.fx] = { t: 0, max: 0, lvl: 0, speed: 1, kind: d.kind });
  h.lvl = Math.min(3, h.lvl + (d.strong || 1)); h.t = Math.min(d.dur * 2.5, h.t + d.dur); h.max = Math.max(h.max, h.t); h.kind = d.kind;
  h.speed = d.kind === 'up' ? Math.max(h.speed === 1 ? 0 : h.speed, d.speed) : Math.min(h.speed, d.speed);
  toast(DRUG_MSG[id] || `${d.e} ${d.n}`); if (d.kind === 'up') beep(520, 0.08, 'square', 0.04);
}
function drugSpeed() {
  let up = 0, down = 1;
  for (const k in highs) { const h = highs[k]; if (h.t <= 0) continue; if (h.kind === 'up') up = Math.max(up, h.speed); else down = Math.min(down, h.speed); }
  return up ? up : down;   // crack/cocaine/meth win over everything else
}
let drugHud = null, drugTint = null, drugCssOn = false;
function drugEls() {
  if (drugHud) return;
  drugHud = document.createElement('div');
  drugHud.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;font:bold 13px sans-serif;color:#fff;text-shadow:0 1px 3px #000;display:none;gap:8px;white-space:nowrap';
  document.body.appendChild(drugHud);
  drugTint = document.createElement('div');
  drugTint.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;opacity:0;mix-blend-mode:screen';
  document.body.appendChild(drugTint);
}
let hudTick = 0;
function updateDrugs(dt, t) {
  drugEls();
  if (!player.alive || !playing) for (const k in highs) Object.assign(highs[k], { t: 0, lvl: 0, speed: 1 });   // dying (or leaving the world) sobers you up
  let roll = 0, yaw = 0, pitch = 0, skew = 0, rot = 0, sc = 1, filt = [], tint = null, tintA = 0, any = false;
  for (const k in highs) {
    const h = highs[k]; if (h.t <= 0) continue;
    if (playing) h.t -= dt;
    if (h.t <= 0) { h.t = 0; h.lvl = 0; h.speed = 1; toast(k === 'drunk' ? '🥴 You sobered up' : '😮‍💨 The effects wore off'); continue; }
    any = true;
    const f = Math.min(1, h.t / 12) * (0.6 + h.lvl * 0.4);   // fades out over the last 12 seconds
    if (k === 'drunk') {   // wavy and spinning
      roll += (Math.sin(t * 1.1) * 0.12 + Math.sin(t * 0.43) * 0.1) * f * h.lvl;
      if (h.lvl >= 3) roll += Math.sin(t * 0.25) * 0.5 * f;
      yaw += Math.sin(t * 0.7) * 0.05 * f * h.lvl; pitch += Math.sin(t * 0.9 + 1) * 0.03 * f * h.lvl;
      skew += Math.sin(t * 2.2) * 3 * f; rot += Math.sin(t * 0.8) * 3 * f; sc += Math.sin(t * 1.7) * 0.03 * f;
      filt.push(`blur(${(0.4 + h.lvl * 0.4) * f}px)`);
    } else if (k === 'trip') {   // rainbow, breathing, wavy
      filt.push(`hue-rotate(${(t * 70) % 360}deg)`, `saturate(${1 + 1.2 * f})`);
      skew += Math.sin(t * 1.5) * 4 * f; sc += Math.sin(t * 0.9) * 0.05 * f; roll += Math.sin(t * 0.5) * 0.06 * f;
      tint = `hsl(${(t * 90) % 360},100%,50%)`; tintA = Math.max(tintA, 0.12 * f);
    } else if (k === 'lean') {   // purple and syrupy
      tint = '#7a2cff'; tintA = Math.max(tintA, 0.22 * f); filt.push(`blur(${0.8 * f}px)`);
      roll += Math.sin(t * 0.4) * 0.05 * f; yaw += Math.sin(t * 0.3) * 0.03 * f;
    } else if (k === 'xan') {   // heavy eyes
      filt.push(`blur(${1.6 * f}px)`, `brightness(${1 - 0.25 * f})`); pitch -= (0.06 + Math.sin(t * 0.6) * 0.04) * f;
    } else if (k === 'pills') {
      filt.push(`blur(${0.7 * f}px)`); roll += Math.sin(t * 0.6) * 0.03 * f;
    } else if (k === 'rolling') {   // everything glows
      filt.push(`saturate(${1 + 1.5 * f})`, `brightness(${1 + 0.15 * Math.sin(t * 4) * f})`);
      tint = '#ff4fd8'; tintA = Math.max(tintA, (0.1 + 0.08 * Math.sin(t * 4)) * f);
    } else if (k === 'wired') {   // shaky and sharp
      const j = 0.004 + h.lvl * 0.003; pitch += (Math.random() - 0.5) * j * f; yaw += (Math.random() - 0.5) * j * f;
      filt.push(`contrast(${1 + 0.25 * f})`, `saturate(${1 + 0.5 * f})`);
    }
  }
  if (any) { camera.rotation.z += roll; camera.rotation.y += yaw; camera.rotation.x += pitch; }
  const cv = renderer.domElement;
  if (any) {
    const a = Math.abs(rot) * Math.PI / 180, asp = Math.max(innerWidth / innerHeight, innerHeight / innerWidth);
    const cover = Math.cos(a) + asp * Math.sin(a) + Math.tan(Math.abs(skew) * Math.PI / 180) + 0.02;
    cv.style.transform = `scale(${Math.max(sc, cover).toFixed(3)}) rotate(${rot.toFixed(2)}deg) skewX(${skew.toFixed(2)}deg)`;
    cv.style.filter = filt.join(' '); drugCssOn = true;
    drugTint.style.background = tint || 'transparent'; drugTint.style.opacity = tint ? tintA.toFixed(3) : 0;
  } else if (drugCssOn) { cv.style.transform = ''; cv.style.filter = ''; drugTint.style.opacity = 0; drugCssOn = false; }
  hudTick -= dt; if (hudTick <= 0) { hudTick = 0.5;
    const on = Object.entries(highs).filter(([, h]) => h.t > 0);
    drugHud.style.display = on.length && playing ? 'flex' : 'none';
    drugHud.textContent = on.map(([k, h]) => { const d = Object.values(DRUGS).find(v => v.fx === k); return `${d.e} ${k === 'drunk' ? ['', 'Tipsy', 'Drunk', 'Wasted'][h.lvl] : d.n} ${Math.ceil(h.t)}s`; }).join('   ');
  }
  updateCrackheads(dt, t);
}

// ---- crackheads: skinny, twitchy, hostile. They hang around towns (mostly the ghetto) asking where the drugs are.
Object.assign(MOBDEF, { crackhead: { hp: 10, w: 0.25, h: 1.85, speed: 2.7, hostile: true, dmg: 2, drops: () => [['pills', Math.random() < 0.25 ? 1 : 0], ['crack', Math.random() < 0.08 ? 1 : 0]] } });
MOB_NAMES.crackhead = '💀 Crackhead'; MOBHIT.add('crackhead'); CREATURE_HIT.add('crackhead');
const CRACK_LINES = ["Where's the drugs man?!", "Yo! Where's the drugs man?", "C'mon man... where's the drugs?!", "I know you holdin'! Where's the drugs man?", "Just one hit man! Where's the drugs?!"];
function speechSprite(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.roundRect ? x.roundRect(6, 6, 500, 70, 22) : x.rect(6, 6, 500, 70); x.fill();
  x.beginPath(); x.moveTo(236, 74); x.lineTo(256, 94); x.lineTo(276, 74); x.fill();
  x.fillStyle = '#111'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(text, 256, 52, 480);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); s.scale.set(2.6, 0.49, 1); s.renderOrder = 6; return s;
}
{ const bm1 = buildMob; buildMob = function (type, v = 0) {
  if (type !== 'crackhead') return bm1(type, v);
  const g = new THREE.Group(), legs = [], arms = [];
  const skin = [0xd9b48f, 0xc58c63, 0x8d5524, 0xe8c9a8][v % 4], top = [0xe8e2cf, 0x9a9a8a, 0x6b5a3a][v % 3], pants = [0x3a4a6a, 0x4a4036, 0x2a2a2a][(v >> 2) % 3];
  box(0.34, 0.72, 0.17, top, 0, 1.1, 0, g);                                    // stained tank top, rib-thin
  box(0.12, 0.06, 0.02, 0x7a6a3a, 0.05, 1.2, 0.09, g);                         // stain
  const head = new THREE.Group(); head.position.set(0, 1.66, 0); g.add(head);
  box(0.38, 0.44, 0.38, skin, 0, 0, 0, head);
  box(0.4, 0.08, 0.4, 0x2a1a0a, 0, 0.2, 0, head);                              // patchy hair
  for (const ex of [-0.09, 0.09]) { box(0.1, 0.08, 0.02, 0x3a2030, ex, 0.04, 0.19, head); const e = box(0.04, 0.04, 0.02, 0xffffff, ex, 0.04, 0.2, head); e.material.emissive.setHex(0x440000); }
  box(0.16, 0.04, 0.02, 0x4a1a1a, 0, -0.12, 0.19, head);                       // gaunt mouth
  for (const lx of [-0.08, 0.08]) legs.push(pivotLimb(g, 0.12, 0.74, 0.12, pants, lx, 0.74, 0));
  for (const ax of [-0.23, 0.23]) arms.push(pivotLimb(g, 0.09, 0.68, 0.09, skin, ax, 1.42, 0));
  const say = speechSprite(CRACK_LINES[v % CRACK_LINES.length]); say.position.set(0, 2.35, 0); say.visible = false; g.add(say);
  return { g, legs, arms, head, say };
}; }
{ const ml1 = mobLabel; mobLabel = function (m) { if (m.type === 'crackhead') return m.calm > 0 ? '💀 Crackhead · 😵‍💫 satisfied (for now)' : '💀 Crackhead · ✋ give him drugs to make him leave'; return ml1(m); }; }
{ const im1 = interactMob; interactMob = function (m, id, it) {
  if (m.type === 'crackhead') {
    if (DRUGS[id] && !ITEMS[id].crop) { useHeld(1); m.calm = 90; m.target = null; toast(`💀 "Ayy thank you man! You a real one." (+ he leaves you alone)`); return true; }
    return false;
  }
  return im1(m, id, it); }; }
let crackT = 0, crackSayT = 0;
function updateCrackheads(dt, t) {
  if (!playing) return;
  const pp = player.pos;
  crackSayT -= dt;
  for (const m of mobs) {
    if (m.type !== 'crackhead') continue;
    if (m.calm > 0) m.calm -= dt;
    const dist = m.g.position.distanceTo(pp), angry = !(m.calm > 0) && canHurtPlayer() && player.alive;
    m.arms.forEach((a, i) => { a.rotation.x = angry && dist < 18 ? -1.2 + Math.sin(t * 9 + i * 2) * 0.35 : (i % 2 ? -1 : 1) * Math.sin(m.walk) * 0.6; a.rotation.z = (i ? -1 : 1) * Math.sin(t * 13 + i) * 0.08; });   // reaching, twitching
    if (m.head) m.head.rotation.z = Math.sin(t * 11 + m.v) * 0.06;
    m.sayT = (m.sayT ?? Math.random() * 3) - dt;
    if (m.say) {
      if (m.sayT <= 0) { m.sayT = 4 + Math.random() * 4; m.sayOn = 2.2; }
      m.sayOn = (m.sayOn || 0) - dt; m.say.visible = m.sayOn > 0 && dist < 22 && angry;
    }
    if (angry && dist < 7 && crackSayT <= 0) { crackSayT = 9; toast(`💀 Crackhead: "${CRACK_LINES[Math.floor(Math.random() * CRACK_LINES.length)]}"`); beep(180 + Math.random() * 60, 0.12, 'sawtooth', 0.03); }
  }
  crackT -= dt; if (crackT > 0) return; crackT = 4;
  if (!canHurtPlayer() || diff().max === 0) return;
  const tn = townAt(Math.floor(pp.x), Math.floor(pp.z)), ghetto = inGhetto(pp.x, pp.z), town = ghetto || inTown(tn, pp.x, pp.z, 20);
  if (!town) return;
  const want = (ghetto ? 3 : 1) + (nightAmt > 0.5 ? 1 : 0);
  if (mobs.filter(m => m.type === 'crackhead' && m.g.position.distanceTo(pp) < 70).length >= want) return;
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.28, r = 18 + Math.random() * 16, x = Math.floor(pp.x + Math.cos(a) * r), z = Math.floor(pp.z + Math.sin(a) * r);
    if (Math.hypot(x - VX, z - VZ) < SAFE_R + 4 || !data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
    const y = groundAt(x + 0.5, z + 0.5), below = get(x, y - 1, z);
    if (isWater(below) || below === AIR || solid(get(x, y, z)) || solid(get(x, y + 1, z)) || y >= H - 2) continue;
    spawnMob('crackhead', x + 0.5, y, z + 0.5); break;
  }
}

window.__dcDrug = { DRUGS, highs, drugSpeed, takeDrug, updateCrackheads, get crackT() { return crackT; }, set crackT(v) { crackT = v; } };

// ================== v1.12 HUSTLE UPDATE: street dealing, tolerance & overdose, police raids, turf wars, The Plug, money laundering, Halloween night, fishing ==================
// Items/blocks/recipes are in the v1.12 data block near the top. Everything here grafts onto earlier code by wrapping.
// Save data lives in state.v112 (created lazily, so older saves load fine). Old coins stay clean money.
function V12() {
  const v = state.v112 || (state.v112 = {});
  if (typeof v.dirty !== 'number' || !isFinite(v.dirty)) v.dirty = 0;
  if (!v.turf) v.turf = {}; if (!v.turfKills) v.turfKills = {}; if (!Array.isArray(v.biz)) v.biz = [];
  if (v.lastDay == null) v.lastDay = day(); if (v.washT == null) v.washT = state.gameTime;
  if (v.fiend == null) v.fiend = 0; if (v.rep == null) v.rep = 0;
  return v;
}
V12();
if (settings.halloween == null) settings.halloween = false;
const ILLEGAL = new Set([...Object.keys(DRUGS).filter(k => k !== 'beer' && k !== 'vodka'), 'weed']);
const FISH = new Set(['raw_cod', 'raw_salmon', 'tropical_fish', 'pufferfish', 'moonfish', 'golden_koi', 'cooked_cod', 'cooked_salmon']);
const dirtyCash = () => Math.floor(V12().dirty);
function addDirty(n, why) { n = Math.round(n); if (n <= 0) return; V12().dirty += n; state.earned += n; if (why) toast(why); coinSnd(); renderStats(); }
const nearCops = (r = 20) => mobs.some(m => m.type === 'cop' && m.g.position.distanceTo(player.pos) < r);
const nearPoliceCar = (r = 30) => cars.some(c => c.kind === 'police' && c !== player.car && Math.hypot(c.x - player.pos.x, c.z - player.pos.z) < r);
function heat(chance, msg) {   // a crime someone might notice: maybe a wanted star
  if (!canHurtPlayer() || jail || Math.random() >= chance) return false;
  setWanted();   // each new crime adds a star (s4 wrapper)
  if (msg) setTimeout(() => toast(msg), 900); return true;
}

// ---- prices / DealerNet
Object.assign(RAW_VALUE, { stash_chest: 30, fishing_rod: 14, raw_cod: 4, raw_salmon: 5, tropical_fish: 10, pufferfish: 16, moonfish: 110, golden_koi: 140,
  cooked_cod: 8, cooked_salmon: 10, halloween_candy: 2, plug_package: 1, laundromat: 1000, car_wash: 2600 });
WEB_CATS.biz = '💼 Business';
{ const wc1 = webCat; webCat = function (id) { if (id === 'laundromat' || id === 'car_wash') return 'biz'; if (FISH.has(id)) return 'food'; return wc1(id); }; }
Object.assign(TOWN_TRADES[1].buys, { raw_cod: 4, raw_salmon: 5, cooked_cod: 8, cooked_salmon: 10 });
Object.assign(TOWN_TRADES[0].buys, { tropical_fish: 10 });
Object.assign(TOWN_TRADES[4].sells, { fishing_rod: 14 });
Object.assign(TOWN_TRADES[3].buys, { cocaine: 70, crack: 55, meth: 80, pills: 18 });

// ---- HUD bits, stats line, styles
const v12css = document.createElement('style');
v12css.textContent = `#odFade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity 1.4s;z-index:45;display:flex;align-items:center;justify-content:center;color:#ff8a8a;font-size:22px;text-shadow:0 2px 6px #000}#odFade.on{opacity:1}
#eggFx{position:fixed;inset:0;pointer-events:none;z-index:7;opacity:0;transition:opacity 2.5s;background:radial-gradient(circle at 30% 35%,rgba(255,225,90,.92) 0 7%,rgba(255,255,240,.85) 7% 13%,transparent 14%),radial-gradient(circle at 68% 58%,rgba(255,215,70,.9) 0 6%,rgba(255,255,235,.8) 6% 12%,transparent 13%),radial-gradient(circle at 48% 80%,rgba(255,240,200,.7) 0 5%,transparent 9%)}#eggFx.on{opacity:1;transition:opacity .1s}
.pplug{flex:1;overflow:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;font-size:13px;touch-action:pan-y}.pplug *{touch-action:pan-y}.pplug h4{margin:8px 0 2px;font-size:13px;color:#ffd84a;text-transform:uppercase;letter-spacing:1px}
.pplug .pst{font-size:13px;padding:8px}.pplug .bal{display:flex;gap:10px;justify-content:center;font-size:15px;font-weight:700;background:rgba(0,0,0,.3);border-radius:10px;padding:8px}`;
document.head.appendChild(v12css);
const odFade = document.createElement('div'); odFade.id = 'odFade'; document.body.appendChild(odFade);
const eggFx = document.createElement('div'); eggFx.id = 'eggFx'; document.body.appendChild(eggFx);
{ const rs1 = renderStats; renderStats = function () { rs1(); const v = V12(), el = document.getElementById('stats');
  if (el && (v.dirty >= 1 || v.biz.length)) { el.insertAdjacentHTML('beforeend', `<br>💵 <b style="color:#9aff8a">${dirtyCash()}</b> dirty${v.biz.length ? ' · 🧺 washing' : ''}`); placePhoneBtn(); } }; }

// ======================= 1. STREET DEALING =======================
// Hold a drug and ✋ a townsperson to sell it (dirty cash). Crackheads always buy and pay more the more you serve them.
{ const im2 = interactMob; interactMob = function (m, id, it) {
  if (m.type === 'ped' && id && ILLEGAL.has(id)) { streetSale(m, id, false); return true; }
  if (m.type === 'crackhead' && id && ILLEGAL.has(id)) { streetSale(m, id, true); return true; }
  if (m.type === 'ped' && id && FISH.has(id)) {
    if (m.fishBought) { toast('🧍 "I already got fish, thanks"'); return true; }
    const p = Math.max(2, Math.round(itemValue(id) * (0.9 + Math.random() * 0.4))); useHeld(1); m.fishBought = true; state.coins += p; state.earned += p; coinSnd(); renderStats();
    toast(`🐟 Sold ${ITEMS[id].name} to a townsperson for 💰${p}`); return true;
  }
  if (m.type === 'trick') { trickTreat(m, id); return true; }
  if (m.type === 'spirit') { const n = rint(1, 3); give('candy', n); toast(`👻 The friendly spirit giggles and leaves ${n} 🍬`); removeMob(m, true); booSnd(); return true; }
  return im2(m, id, it); }; }
function streetSale(m, id, fiend) {
  if (!fiend) {
    if (m.dealt) { toast('🧍 "I\'m good, I already got some"'); return; }
    if (m.panic > 0) { toast('🧍 "Get away from me!"'); return; }
    if (Math.random() < 0.3) {   // not everyone buys; some call the cops
      m.dealt = true; toast('🙅 "Nah man, I don\'t do that stuff"');
      if (heat(0.25, '📞 They called the cops on you!')) { m.panic = 6; m.target = null; }
      return;
    }
  }
  const v = V12(), base = itemValue(id);
  const mult = fiend ? Math.min(2.4, 1.5 + v.fiend * 0.05) : 0.9 + Math.random() * 0.45;
  const p = Math.max(3, Math.round(base * mult));
  useHeld(1); swing();
  if (fiend) { v.fiend++; m.calm = 150; m.target = null; addDirty(p, `💀 "You the plug now!" +💵${p} dirty${v.fiend > 1 ? ` · regular ×${v.fiend}` : ''}`); }
  else { m.dealt = true; addDirty(p, `🤝 Sold ${ITEMS[id].name} on the street for 💵${p} dirty`); }
  const ch = 0.07 + (nearCops(20) ? 0.3 : 0) + (nearPoliceCar(30) ? 0.12 : 0) + (nightAmt < 0.3 ? 0.04 : 0);
  heat(ch, nearCops(20) ? '🚨 A cop saw the deal!' : '🚨 Someone saw that deal...');
}
{ const ml2 = mobLabel; mobLabel = function (m) {
  const id = held();
  if (m.type === 'ped' && id && ILLEGAL.has(id)) return `🧍 Townsperson · ✋ sell ${ITEMS[id].name}${m.dealt ? ' (already asked)' : ''}`;
  if (m.type === 'ped' && id && FISH.has(id)) return `🧍 Townsperson · ✋ sell fish${m.fishBought ? ' (bought already)' : ''}`;
  if (m.type === 'crackhead' && id && ILLEGAL.has(id)) return `💀 Crackhead · ✋ sell ${ITEMS[id].name} (pays extra)`;
  if (m.type === 'trick') return `🎃 Trick-or-treater · ✋ give candy${m.trick && m.trick.st === 'knock' ? ` (${Math.ceil(m.trick.t)}s)` : ''}`;
  if (m.type === 'hghost') return '👻 Midnight ghost · 😡';
  if (m.type === 'spirit') return '👻 Friendly spirit · ✋ say hi';
  return ml2(m); }; }

// ======================= 2. TOLERANCE & OVERDOSE =======================
const OD_LOAD = { crack: 3, meth: 3, cocaine: 2.5, xanax: 2.5, purple_sprite: 2, ecstasy: 2, mushroom_stew: 2, cough_syrup: 1.5, vodka: 1.5, acid: 1.5, pills: 1, brown_mushroom: 1, red_mushroom: 1, beer: 0.6 };
const tol = {};   // drug id -> { n, last }
let odLoad = 0, odWarnT = 0, odBusy = false;
{ const td0 = takeDrug; takeDrug = function (id) {
  const d = DRUGS[id]; if (!d) return td0(id);
  const now = state.gameTime, tl = tol[id] || (tol[id] = { n: 0, last: -1e9 });
  tl.n = now - tl.last < 240 ? tl.n + 1 : 1; tl.last = now;
  const mult = Math.max(0.3, 1 / (1 + 0.4 * (tl.n - 1)));
  const h0 = highs[d.fx], before = h0 && h0.t > 0 ? h0.t : 0, sp0 = h0 && h0.t > 0 ? h0.speed : 1;
  td0(id);
  const h = highs[d.fx];
  if (h && mult < 1) {
    h.t = before + (h.t - before) * mult; h.max = Math.max(before, h.t);
    const ns = d.kind === 'up' ? 1 + (d.speed - 1) * mult : 1 - (1 - d.speed) * mult;
    h.speed = d.kind === 'up' ? Math.max(sp0 > 1 ? sp0 : 1, ns) : Math.min(sp0 < 1 ? sp0 : 1, ns);
    setTimeout(() => toast(`🔁 Tolerance: ${ITEMS[id].name} hits ${Math.round((1 - mult) * 100)}% weaker`), 1300);
  }
  // overdose: stacking too much too fast (mixing uppers and downers is worse)
  const mixed = Object.values(highs).some(o => o.t > 0 && o.kind !== d.kind);
  odLoad += (OD_LOAD[id] || 1) + (mixed ? 1 : 0);
  if (odLoad >= 10) overdose(id);
  else if (odLoad >= 6.5 && odWarnT <= 0) { odWarnT = 6; setTimeout(() => { if (!odBusy) toast('💓 Your heart is pounding... slow down or you\'ll OD'); }, 2200); beep(90, 0.3, 'sine', 0.08); }
}; }
{ const dm0 = damage; damage = function (n, cause, from) { if (odBusy) return; return dm0(n, cause, from); }; }   // blacked out = untouchable (never dies from an OD)
function wakeSpot() {
  let best = null, bd = 1e9;
  for (const t of townsNear(240)) { const cx = t.x0 + 2, cz = t.z0 + 2, d = Math.hypot(cx - player.pos.x, cz - player.pos.z); if (d < bd) { bd = d; best = { x: cx + 0.5, y: t.base + 1, z: cz + 0.5, name: t.metro ? 'the city' : t.type === 'city' ? 'the city' : 'town' }; } }
  if (best) return best;
  if (state.spawn) return { x: state.spawn[0] + 0.5, y: state.spawn[1] + 1, z: state.spawn[2] + 1.5, name: 'home' };
  return { x: VX + 0.5, y: G + 1, z: VZ - 4.5, name: 'the village' };
}
function overdose(id) {
  if (odBusy || !player.alive) return;
  odBusy = true; odLoad = 0; holdBreak = false;
  if (uiOpen) closePanels(); if (player.car) exitCar(); if (player.horse) dismountHorse();
  const prevFreeze = window.__freeze; window.__freeze = true;
  odFade.textContent = '💀 You overdosed...'; odFade.classList.add('on'); beep(60, 1.2, 'sine', 0.1); toast(`💀 Too much ${ITEMS[id].name}... everything goes black`);
  setTimeout(() => {
    for (const k in highs) Object.assign(highs[k], { t: 0, lvl: 0, speed: 1 });
    for (const k in tol) delete tol[k];
    const w = wakeSpot(); player.pos.set(w.x, w.y, w.z); player.vel.set(0, 0, 0); player.fallStart = null;
    streamChunks(30, 30);
    const v = V12(), bill = Math.min(state.coins, 15 + Math.round(state.coins * 0.15)), lost = Math.round(v.dirty * 0.25);
    state.coins -= bill; v.dirty -= lost; state.hp = Math.max(state.hp, 6); state.food = Math.max(state.food, 6); renderVitals(); renderStats();
    odFade.textContent = '🏥 ...';
    const finish = () => {   // stay blacked out until the land under you has loaded
      if (!data.has(ckey(fdiv(Math.floor(player.pos.x), CH), fdiv(Math.floor(player.pos.z), CH)))) { streamChunks(8, 8); player.pos.set(w.x, w.y, w.z); setTimeout(finish, 300); return; }
      if (collides(player.pos)) player.pos.y = groundAt(player.pos.x, player.pos.z);
      odFade.classList.remove('on'); window.__freeze = prevFreeze; odBusy = false;
      toast(`🏥 You woke up in ${w.name}. Hospital bill 💰${bill}${lost ? ` · 💵${lost} dirty cash missing` : ''}`);
    };
    setTimeout(finish, 1800);
  }, 2600);
}

// ======================= 3. POLICE RAIDS =======================
// At 3+ stars the cops may raid a chest you placed (near you or your bed) and seize drugs. Hidden stashes are never found.
let raid = null, raidT = 20, raidCd = 0;
function raidTargets() {
  const out = [];
  for (const k in state.chests) {
    if (state.edits[k] !== CHEST || (state.looted && state.looted[k])) continue;
    const ch = state.chests[k]; if (!ch || !ch.some(s => s && ILLEGAL.has(s.id))) continue;
    const [x, y, z] = k.split(',').map(Number), dp = Math.hypot(x - player.pos.x, z - player.pos.z), dh = state.spawn ? Math.hypot(x - state.spawn[0], z - state.spawn[2]) : 1e9;
    if (dp < 60 || dh < 40) out.push({ k, x, y, z, dp, dh });
  }
  return out;
}
function seize(k) {
  const ch = state.chests[k]; let n = 0; if (!ch) return 0;
  for (let i = 0; i < ch.length; i++) if (ch[i] && ILLEGAL.has(ch[i].id)) { n += ch[i].n; ch[i] = null; }
  if (chestKeys && chestKeys.includes(k)) closePanels();
  return n;
}
function startRaid() {
  const ts = raidTargets(); if (!ts.length) return false;
  const t = ts[Math.floor(Math.random() * ts.length)];
  if (t.dp > 60 || !data.has(ckey(fdiv(t.x, CH), fdiv(t.z, CH)))) {   // your place got hit while you were out
    const n = seize(t.k); toast(`🚔 The cops raided your place while you were out! Seized ${n} drugs`); beep(200, 0.5, 'square', 0.06); raidCd = 150; return true;
  }
  const cops = [];
  for (let i = 0; i < 12 && cops.length < 3; i++) {
    const a = Math.random() * 6.28, r = 9 + Math.random() * 6, x = Math.floor(t.x + Math.cos(a) * r), z = Math.floor(t.z + Math.sin(a) * r);
    if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue; const y = groundAt(x + 0.5, z + 0.5);
    if (solid(get(x, y, z)) || solid(get(x, y + 1, z)) || isWater(get(x, y - 1, z))) continue;
    const m = spawnMob('cop', x + 0.5, y, z + 0.5); if (m) { m.raid = t.k; m.home = new THREE.Vector2(t.x + 0.5, t.z + 0.5); cops.push(m); }
  }
  if (!cops.length) return false;
  raid = { k: t.k, x: t.x, y: t.y, z: t.z, cops, t: 45 }; raidCd = 150;
  toast('🚔 POLICE RAID! Cops are heading for your stash chest!'); beep(760, 0.5, 'sawtooth', 0.05); setTimeout(() => beep(980, 0.5, 'sawtooth', 0.05), 550);
  return true;
}
function updateRaids(dt) {
  raidCd = Math.max(0, raidCd - dt);
  if (raid) {
    raid.t -= dt; const alive = raid.cops.filter(m => mobs.includes(m));
    for (const m of alive) { if (!(wanted > 0 && m.g.position.distanceTo(player.pos) < 30)) { m.target = new THREE.Vector2(raid.x + 0.5, raid.z + 0.5); m.wait = 0; } }
    const reached = alive.some(m => Math.hypot(m.g.position.x - raid.x - 0.5, m.g.position.z - raid.z - 0.5) < 2.6);
    if (!alive.length) { toast('🛡️ You stopped the raid! Your stash is safe (for now)'); raid = null; return; }
    if (reached || raid.t <= 0 || get(raid.x, raid.y, raid.z) !== CHEST) {
      const n = get(raid.x, raid.y, raid.z) === CHEST ? seize(raid.k) : 0;
      toast(n ? `🚔 RAID! The cops seized ${n} drugs from your chest` : '🚔 The cops searched your place and found nothing'); beep(200, 0.5, 'square', 0.06);
      for (const m of alive) { m.raid = null; m.home = new THREE.Vector2(m.g.position.x, m.g.position.z); }
      raid = null;
    }
    return;
  }
  raidT -= dt; if (raidT > 0) return; raidT = 20;
  if (wantedLvl >= 3 && wanted > 0 && canHurtPlayer() && !jail && raidCd <= 0 && Math.random() < 0.35) startRaid();
}

// ======================= 4. TURF WARS =======================
// In a ghetto, knock out 5 gang members on one block to claim it. Claimed blocks pay a daily cut; the gang tries to take them back.
const TURF_KILLS = 5, TURF_CUT = 40;
function turfAt(x, z) {
  const gz = ghettoZones.find(g => x >= g.x0 && x < g.x1 && z >= g.z0 && z < g.z1); if (!gz) return null;
  const bx = Math.floor((x - gz.x0) / 16), bz = Math.floor((z - gz.z0) / 16);
  return { gz, key: gz.townId + '|' + bx + ',' + bz, cx: gz.x0 + bx * 16 + 8, cz: gz.z0 + bz * 16 + 8 };
}
function gangOfTurf(tf) { const s = gangZone(tf.gz); return tf.cx < s.mid ? s.a : s.b; }
{ const hm2 = hurtMob; hurtMob = function (m, dmg, from, noDrop) {
  const was = m && mobs.includes(m), type = m && m.type, pos = was ? m.g.position.clone() : null;
  const r = hm2(m, dmg, from, noDrop);
  if (was && !mobs.includes(m) && from === player.pos && m.hp <= 0) { if (type === 'gangster') gangKill(m, pos); }
  return r; }; }
function gangKill(m, pos) {
  const tf = turfAt(pos.x, pos.z); if (!tf) return; const v = V12();
  if (m.retake) return;
  if (v.turf[tf.key]) return;
  v.turfKills[tf.key] = (v.turfKills[tf.key] || 0) + 1;
  const n = v.turfKills[tf.key], gi = gangOfTurf(tf);
  if (n >= TURF_KILLS) {
    v.turf[tf.key] = { x: tf.cx, z: tf.cz, gang: gi, day: day() }; delete v.turfKills[tf.key];
    setTimeout(() => { toast(`🏴 You took this block from the ${GANGS[gi].n}! +💵${TURF_CUT}/day`); beep(523, .1); setTimeout(() => beep(784, .2), 120); }, 700);
  } else setTimeout(() => toast(`🏴 Turf war: ${n}/${TURF_KILLS} ${GANGS[gi].n} down on this block`), 700);
}
let retake = null, retakeT = 45;
function updateTurf(dt) {
  const v = V12(), keys = Object.keys(v.turf);
  if (retake) {
    retake.t -= dt; const alive = retake.mobs.filter(m => mobs.includes(m)), tt = v.turf[retake.key];
    if (!tt) { retake = null; return; }
    const far = Math.hypot(tt.x - player.pos.x, tt.z - player.pos.z) > 85;
    if (!alive.length && !far) { toast(`🛡️ You held your block against the ${GANGS[retake.gang].n}!`); retake = null; return; }
    if (far || retake.t <= 0) { delete v.turf[retake.key]; toast(`🏴 The ${GANGS[retake.gang].n} took their block back!`); for (const m of alive) m.retake = false; retake = null; }
    return;
  }
  if (!keys.length) return;
  retakeT -= dt; if (retakeT > 0) return; retakeT = 60;
  if (!canHurtPlayer() || jail || Math.random() > 0.2) return;
  const near = keys.filter(k => Math.hypot(v.turf[k].x - player.pos.x, v.turf[k].z - player.pos.z) < 70); if (!near.length) return;
  const key = near[Math.floor(Math.random() * near.length)], tt = v.turf[key], tf = turfAt(tt.x, tt.z); if (!tf) return;
  const s = gangZone(tf.gz), gi = tt.gang, ms = [];
  for (let i = 0; i < 20 && ms.length < 3; i++) {
    const x = Math.floor(tt.x + (Math.random() - .5) * 14), z = Math.floor(tt.z + (Math.random() - .5) * 14), y = tf.gz.base + 1;
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < 8 || !data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue;
    if (solid(get(x, y, z)) || solid(get(x, y + 1, z)) || !solid(get(x, y - 1, z))) continue;
    const m = spawnMob('gangster', x + 0.5, y, z + 0.5, gi); if (m) { m.zone = tf.gz.townId; m.retake = true; m.home = new THREE.Vector2(tt.x, tt.z); ms.push(m); }
  }
  if (!ms.length) return;
  s.hostile[gi] = 120; retake = { key, gang: gi, mobs: ms, t: 120 };
  toast(`🔫 The ${GANGS[gi].n} are coming to take back your block!`); beep(300, 0.2, 'sawtooth', 0.05);
}
function turfDaily(days) {
  const v = V12(), n = Object.keys(v.turf).length; if (!n) return;
  const cut = n * TURF_CUT * Math.min(3, days); addDirty(cut, `🏴 Turf cut from ${n} block${n > 1 ? 's' : ''}: +💵${cut} dirty`);
}

// ======================= 5. THE PLUG (phone app): delivery jobs =======================
function roadSpot(t) {
  const nb = t.nb || 3, i = rint(0, nb), x = t.x0 + 1 + 16 * i + rint(0, 2), z = t.z0 + 6 + Math.floor(Math.random() * Math.max(4, t.z1 - t.z0 - 12));
  return { x, y: t.base + 1, z, t: t.id };
}
function plugOffers() {
  const v = V12();
  if (v.offers && v.offers.day === day() && v.offers.list.length) return v.offers.list;
  const ts = townsNear(240).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - player.pos.x, (a.z0 + a.z1) / 2 - player.pos.z) - Math.hypot((b.x0 + b.x1) / 2 - player.pos.x, (b.z0 + b.z1) / 2 - player.pos.z));
  const list = [];
  if (ts.length) for (let i = 0; i < 3; i++) {
    const t = ts[0], t2 = ts.length > 1 && i === 2 ? ts[1] : t;
    let a = roadSpot(t), b = roadSpot(t2);
    for (let k = 0; k < 12 && Math.hypot(a.x - b.x, a.z - b.z) < 40; k++) b = roadSpot(t2);
    const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < 25) continue;
    list.push({ a, b, d: Math.round(d), limit: Math.round(30 + d / 3.2), pay: Math.round(60 + d * 1.3), what: ['a backpack', 'a shoebox', 'a pizza box', 'a duffel bag', 'a gift bag'][rint(0, 4)], far: t2 !== t });
  }
  v.offers = { day: day(), list }; return list;
}
const plugMarks = [];
function clearPlugMarks() { for (const m of plugMarks) scene.remove(m); plugMarks.length = 0; state.waypoints = (state.waypoints || []).filter(w => !w.plug); }
function beamAt(x, y, z, col) {
  const g = new THREE.Group(); g.position.set(x + 0.5, y, z + 0.5);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 40, 0.5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, depthWrite: false, fog: false })); beam.position.y = 20; g.add(beam);
  const crate = box(0.6, 0.6, 0.6, 0x9a6a3a, 0, 1, 0, g); crate.material.emissive.setHex(0x3a2008); g.userData.crate = crate;
  scene.add(g); plugMarks.push(g); return g;
}
function showPlugMarks() {
  const j = V12().job; clearPlugMarks(); if (!j) return;
  const p = j.stage === 'pickup' ? j.a : j.b; beamAt(p.x, p.y, p.z, j.stage === 'pickup' ? 0x3bff7a : 0xff3b3b);
  state.waypoints.push({ x: p.x, z: p.z, c: j.stage === 'pickup' ? '#3bff7a' : '#ff3b3b', plug: true });
}
function acceptJob(i) {
  const v = V12(); if (v.job) { toast('🔌 Finish your current job first'); return; }
  const o = plugOffers()[i]; if (!o) return;
  v.job = { a: o.a, b: o.b, pay: Math.round(o.pay * (1 + Math.min(1, v.rep * 0.1))), limit: o.limit, stage: 'pickup', what: o.what };
  v.offers.list.splice(i, 1); showPlugMarks();
  toast(`🔌 Plug: "Pick up ${o.what} at the 🟢 marker. Don't let the cops see it."`); beep(1320, 0.05, 'sine', 0.05);
}
function failJob(msg) { const v = V12(); if (!v.job) return; take('plug_package', count('plug_package')); v.job = null; v.rep = Math.max(0, v.rep - 1); clearPlugMarks(); toast(msg); beep(150, 0.3, 'sawtooth', 0.05); }
let plugCopT = 0;
function updatePlug(dt) {
  const v = V12(), j = v.job; plugCopT = Math.max(0, plugCopT - dt);
  if (!j) return;
  if (!plugMarks.length) showPlugMarks();
  for (const g of plugMarks) { g.userData.crate.rotation.y += dt * 1.5; g.userData.crate.position.y = 1 + Math.sin(performance.now() / 300) * 0.15; }
  const pp = player.pos;
  if (j.stage === 'pickup') {
    if (Math.hypot(j.a.x + 0.5 - pp.x, j.a.z + 0.5 - pp.z) < 3 && Math.abs(pp.y - j.a.y) < 4) {
      if (give('plug_package', 1) > 0) { toast('🎒 Make room in your bag for the package'); return; }
      j.stage = 'drop'; j.until = state.gameTime + j.limit; showPlugMarks();
      toast(`📦 Got ${j.what}! Deliver it to the 🔴 marker in ${j.limit}s`); beep(880, 0.08, 'triangle', 0.06);
    }
    return;
  }
  const left = j.until - state.gameTime;
  if (left <= 0) { failJob('⌛ Too slow! The Plug took the package back. Job failed'); return; }
  if (!count('plug_package')) { failJob('📦 You lost the package! Job failed'); return; }
  if (canHurtPlayer() && !jail && plugCopT <= 0 && (nearCops(7) || nearPoliceCar(9))) {
    plugCopT = 20; setWanted(); toast('🚔 Stopped by the cops with the package! RUN!');
  }
  if (Math.hypot(j.b.x + 0.5 - pp.x, j.b.z + 0.5 - pp.z) < 3.5 && Math.abs(pp.y - j.b.y) < 4) {
    take('plug_package', 1); const bonus = left > j.limit * 0.5 ? Math.round(j.pay * 0.2) : 0; v.job = null; v.rep++; clearPlugMarks();
    addDirty(j.pay + bonus, `🔌 Delivered! +💵${j.pay + bonus} dirty${bonus ? ' (fast bonus)' : ''} · Plug rep ${v.rep}`);
  }
}
{ const ar0 = arrest; arrest = function () { if (!jail && V12().job && count('plug_package')) failJob('🚔 The cops took the package. Job failed'); return ar0(); }; }

// ======================= 6. MONEY LAUNDERING =======================
// Drug, street, turf and Plug money is dirty. A Laundromat or Car Wash (DealerNet) washes it into clean coins over time.
const BIZ = { laundromat: { n: '🧺 Laundromat', rate: 0.4 }, car_wash: { n: '🚿 Car Wash', rate: 1.0 } };   // dirty coins washed per game second (10% fee)
const washRate = () => V12().biz.reduce((s, b) => s + (BIZ[b] ? BIZ[b].rate : 0), 0);
let washAcc = 0;
function updateLaundry() {
  const v = V12(), dt = Math.max(0, Math.min(DAY * 3, state.gameTime - v.washT)); v.washT = state.gameTime;
  const r = washRate(); if (!r || v.dirty < 1) return;
  const amt = Math.min(v.dirty, r * dt); v.dirty -= amt; washAcc += amt * 0.9;
  if (washAcc >= 1) { const c = Math.floor(washAcc); washAcc -= c; state.coins += c; }
}
// selling drugs to villagers / DealerNet pays dirty; buying from traders can use dirty cash (big dirty spending draws heat)
let preTx = null;
document.addEventListener('click', e => {
  preTx = null; const b = e.target.closest && e.target.closest('[data-a="sell"],[data-ws],[data-a="buy"]'); if (!b) return;
  if (b.dataset.a === 'buy') {
    if (!tradeV || chestKeys || furnaceKey) return; const p = (tradeV.sells[b.dataset.k] || 0) * (+b.dataset.n || 1), v = V12();
    if (state.coins < p && state.coins + v.dirty >= p) { const borrow = p - state.coins; v.dirty -= borrow; state.coins += borrow; preTx = { buy: true, borrow, coins: state.coins }; }
    return;
  }
  preTx = { sell: true, id: b.dataset.k || b.dataset.ws, coins: state.coins, earned: state.earned };
}, true);
document.addEventListener('click', () => {
  const p = preTx; preTx = null; if (!p) return;
  if (p.buy) {
    if (state.coins === p.coins) { state.coins -= p.borrow; V12().dirty += p.borrow; return; }   // nothing was bought: give it back
    if (p.borrow >= 120) heat(Math.min(0.85, p.borrow / 500), `💵 Flashing ${p.borrow} in dirty cash... someone called the cops`);
    else toast(`💵 Paid ${p.borrow} in dirty cash`);
    renderStats(); if (tradeV && document.getElementById('trade').classList.contains('show')) renderTrade(); return;
  }
  const d = state.coins - p.coins;
  if (d > 0 && ILLEGAL.has(p.id)) {
    state.coins -= d; V12().dirty += d; toast(`💵 +${d} dirty cash for the ${ITEMS[p.id] ? ITEMS[p.id].name : 'goods'} (wash it at a 🧺 Laundromat)`); renderStats();
    if (tradeV && document.getElementById('trade').classList.contains('show') && !chestKeys) renderTrade();
    if (document.getElementById('web').classList.contains('show') || (webFromPhone && document.getElementById('pWebBox'))) renderWeb(true);
  }
});
{ const rt1 = renderTrade; renderTrade = function () {   // buttons count dirty cash too (cash deals)
  const c0 = state.coins, dc = dirtyCash(); state.coins = c0 + dc; try { rt1(); } finally { state.coins = c0; }
  if (dc > 0) { const hd = document.querySelector('#tradeBox h2 + div'); if (hd) hd.innerHTML = hd.innerHTML.replace(/You have 💰 \d+/, `You have 💰 ${c0} + 💵 ${dc} dirty`); }
}; }
function openBiz(id) {
  const v = V12(); if (v.biz.length >= 6) { toast('💼 You own enough businesses already (6 max)'); return; }
  useHeld(1); v.biz.push(id); swing(); coinSnd();
  toast(`${BIZ[id].n} is open! It washes 💵${Math.round(BIZ[id].rate * 60)} dirty → 💰 clean every minute (10% cut)`);
}

// ======================= 7. HALLOWEEN NIGHT =======================
// The last night of autumn (or every night with the Settings toggle): trick-or-treaters knock in the evening,
// a ghost horde rises at midnight (friendly spirits on Peaceful instead).
Object.assign(MOBDEF, {
  trick: { hp: 8, w: 0.25, h: 1.3, speed: 1.5, hostile: false, human: true, drops: () => [] },
  hghost: { hp: 14, w: 0.3, h: 1.8, speed: 2.1, hostile: true, burns: true, dmg: 2, drops: () => [['candy', rint(1, 3)], ['halloween_candy', Math.random() < 0.3 ? 1 : 0]] },
  spirit: { hp: 6, w: 0.3, h: 1.8, speed: 1.0, hostile: false, burns: true, drops: () => [['candy', rint(1, 2)]] },
});
Object.assign(MOB_NAMES, { trick: '🎃 Trick-or-treater', hghost: '👻 Midnight ghost', spirit: '👻 Friendly spirit' });
CREATURE_HIT.add('hghost');
const KID_LINES = ['Trick or treat!', 'Trick or treat! 🍬', 'Candy please!', 'Trick or treeeat!'];
{ const bm2 = buildMob; buildMob = function (type, v = 0) {
  if (type === 'trick') {
    const cost = v % 4, p = humanoid({ shirt: [0xff7a1a, 0xf4f4f4, 0x24132e, 0x2a6ad2][cost], skin: [0xf1c27d, 0xc58c63, 0x8d5524][v % 3], pants: 0x222222 });
    if (cost === 0) { box(0.56, 0.52, 0.56, 0xff7a1a, 0, 0.02, 0, p.head); box(0.08, 0.14, 0.08, 0x3f8f3a, 0, 0.34, 0, p.head); for (const ex of [-0.12, 0.12]) { const e = box(0.1, 0.08, 0.02, 0xffd030, ex, 0.06, 0.29, p.head); e.material.emissive.setHex(0xaa6600); } }
    if (cost === 1) { box(0.6, 1.5, 0.42, 0xf4f4f4, 0, 1.25, 0, p.g); box(0.56, 0.56, 0.5, 0xf4f4f4, 0, 0, 0, p.head); for (const ex of [-0.1, 0.1]) box(0.08, 0.1, 0.02, 0x111111, ex, 0.04, 0.26, p.head); }
    if (cost === 2) { box(0.7, 0.05, 0.7, 0x111111, 0, 0.27, 0, p.head); box(0.36, 0.3, 0.36, 0x111111, 0, 0.42, 0, p.head); box(0.18, 0.2, 0.18, 0x111111, 0, 0.62, 0, p.head); }
    if (cost === 3) { box(0.2, 0.14, 0.2, 0xffd84a, 0, 0.32, 0, p.head); box(0.52, 0.3, 0.08, 0xd02020, 0, 1.0, -0.18, p.g); }
    const bag = box(0.2, 0.22, 0.2, 0xff8a1a, 0, -0.72, 0.08, p.arms[0]); bag.material.emissive.setHex(0x401800);
    p.g.scale.setScalar(0.66);
    const say = speechSprite(KID_LINES[v % KID_LINES.length]); say.position.set(0, 2.9, 0); say.scale.set(3.6, 0.68, 1); say.visible = false; p.g.add(say);
    return { ...p, say };
  }
  if (type === 'hghost' || type === 'spirit') {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = 0.3;
    const mat = new THREE.MeshLambertMaterial({ color: type === 'spirit' ? 0xd8f0ff : 0xf4f0ff, emissive: type === 'spirit' ? 0x3a6a9a : 0x5a5a8a, transparent: true, opacity: 0.72, depthWrite: false });
    const add = (w, h, d, x, y, z, m = mat) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); body.add(o); return o; };
    add(0.7, 1.1, 0.5, 0, 0.75, 0); add(0.56, 0.5, 0.5, 0, 1.55, 0);
    for (const [x, y] of [[-0.25, 0.12], [0, 0.08], [0.25, 0.12]]) add(0.2, 0.25, 0.4, x, y, 0);
    const eye = new THREE.MeshBasicMaterial({ color: type === 'spirit' ? 0x2a4a8a : 0x000000 });
    for (const ex of [-0.12, 0.12]) add(0.12, 0.16, 0.02, ex, 1.6, 0.26, eye); add(0.16, 0.12, 0.02, 0, 1.42, 0.26, eye);
    const arms = [pivotLimb(body, 0.16, 0.6, 0.16, 0xf4f0ff, -0.42, 1.2, 0), pivotLimb(body, 0.16, 0.6, 0.16, 0xf4f0ff, 0.42, 1.2, 0)];
    arms.forEach(a => a.traverse(o => { if (o.material) { o.material = mat; } })); arms.forEach(a => { a.rotation.x = -1.3; });
    return { g, legs: [], arms: type === 'hghost' ? [] : [], body, ghostArms: arms };
  }
  return bm2(type, v);
}; }
const halDay = () => Math.floor(state.time / DAY);
const isHalloweenDay = (D = halDay()) => !!settings.halloween || (Math.floor(D / SEASON_DAYS) % 4 === 0 && D % SEASON_DAYS === SEASON_DAYS - 1);
const dayFrac = () => (state.time % DAY) / DAY;
const halloweenNow = () => isHalloweenDay() && dayFrac() >= 0.5;
const CANDY = ['halloween_candy', 'candy'];
function trickTreat(m, id) {
  const k = m.trick; if (!k || k.st === 'leave') { toast('🎃 They already went to the next house'); return; }
  if (!CANDY.includes(id)) { toast('🎃 "We want CANDY!" (hold 🍭 Halloween Candy or 🍬 Ghost Candy)'); return; }
  useHeld(1); swing(); k.st = 'leave'; k.t = 12; if (m.say) m.say.visible = false;
  const r = Math.random();
  if (r < 0.5) { const c = rint(5, 15); state.coins += c; state.earned += c; coinSnd(); toast(`🎃 "Thank you!" They gave you 💰${c} from their piggy bank`); }
  else if (r < 0.75) { give('pumpkin', 1); toast('🎃 "Happy Halloween!" They left you a 🎃 pumpkin'); }
  else if (r < 0.92) { give('jack_o_lantern', 1); toast('🎃 "Thanks mister!" You got a Jack o\'Lantern'); }
  else { give('witch_brew', 1); toast('🧙 A kid in a witch hat gives you a bubbling Witch\'s Brew...'); }
  renderStats();
}
function egged(m) {
  m.trick.st = 'leave'; m.trick.t = 10; if (m.say) m.say.visible = false;
  eggFx.classList.add('on'); setTimeout(() => eggFx.classList.remove('on'), 2200);
  noiseBurst(0.15, 0.12, 900); particles(player.pos.x, player.pos.y + 1.5, player.pos.z, new THREE.Color(1, 0.9, 0.4), 12);
  toast('🥚 SPLAT! No candy = you got egged!');
}
let trickT = 6, halAnnounced = -1;
function updateHalloween(dt, t) {
  const D = halDay(), f = dayFrac(), hal = isHalloweenDay(D), v = V12();
  if (hal && f >= 0.5 && halAnnounced !== D && v.halAnn !== D) { halAnnounced = D; v.halAnn = D; toast('🎃 It\'s Halloween night! Keep candy on you for trick-or-treaters'); }
  // trick-or-treaters: evening, in a town or near your bed
  for (const m of mobs) {
    if (m.type === 'hghost' || m.type === 'spirit') {
      if (m.body) m.body.position.y = 0.3 + Math.sin(t * 2 + m.v) * 0.15;
      if (m.type === 'hghost' && canHurtPlayer() && player.alive && !odBusy) { const d = m.g.position.distanceTo(player.pos); if (d < 1.5 && m.atk <= 0) { damage(MOBDEF.hghost.dmg, 'ghost', m.g.position); m.atk = 1.1; } }
      continue;
    }
    if (m.type !== 'trick' || !m.trick) continue;
    const k = m.trick, p = m.g.position, d = p.distanceTo(player.pos); k.t -= dt;
    if (k.st === 'go') {
      m.target = new THREE.Vector2(player.pos.x, player.pos.z); m.wait = 0;
      if (d < 2.6) { k.st = 'knock'; k.t = 18; beep(140, 0.08, 'square', 0.09); setTimeout(() => beep(140, 0.08, 'square', 0.09), 220); toast('🚪 *knock knock* 🎃 "Trick or treat!"'); }
      else if (k.t <= -60 || d > 70) { removeMob(m, false); }
    } else if (k.st === 'knock') {
      m.target = null; m.wait = 1; m.g.rotation.y = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
      if (m.say) m.say.visible = d < 20;
      if (d > 6) { k.st = 'go'; if (m.say) m.say.visible = false; }
      if (k.t <= 0) egged(m);
    } else if (k.st === 'leave') {
      if (!m.target || Math.random() < 0.01) { const a = Math.atan2(p.x - player.pos.x, p.z - player.pos.z); m.target = new THREE.Vector2(p.x + Math.sin(a) * 30, p.z + Math.cos(a) * 30); m.wait = 0; }
      if (k.t <= 0 && d > 12) removeMob(m, true);
      if (k.t <= -20) removeMob(m, true);
    }
  }
  if (!hal) return;
  trickT -= dt;
  if (f >= 0.55 && f < 0.75 && trickT <= 0 && player.alive && !player.car) {
    trickT = 14;
    const tn = townsNear(4)[0], home = state.spawn && Math.hypot(state.spawn[0] - player.pos.x, state.spawn[2] - player.pos.z) < 30;
    if ((tn || home) && mobs.filter(m => m.type === 'trick').length < 3) for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.28, r = 12 + Math.random() * 12, x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r);
      if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue; if (tn && inTown(tn, x, z) && townCell(tn, x, z) === 'lot') continue;
      const y = groundAt(x + 0.5, z + 0.5); if (solid(get(x, y, z)) || solid(get(x, y + 1, z)) || isWater(get(x, y - 1, z)) || y >= H - 2) continue;
      const m = spawnMob('trick', x + 0.5, y, z + 0.5); if (m) { m.trick = { st: 'go', t: 0 }; } break;
    }
  }
  // the midnight ghost horde
  if (f >= 0.75 && f < 0.95 && v.horde !== D && player.alive) {
    v.horde = D; const peaceful = !canHurtPlayer(), type = peaceful ? 'spirit' : 'hghost'; let n = 0;
    for (let i = 0; i < 40 && n < (peaceful ? 5 : 8); i++) {
      const a = Math.random() * 6.28, r = 12 + Math.random() * 14, x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r);
      if (!peaceful && Math.hypot(x - VX, z - VZ) < SAFE_R) continue;
      if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue; const y = groundAt(x + 0.5, z + 0.5);
      if (solid(get(x, y, z)) || solid(get(x, y + 1, z)) || y >= H - 2) continue;
      if (spawnMob(type, x + 0.5, y, z + 0.5)) n++;
    }
    ghostWail(0.12); setTimeout(() => ghostWail(0.1), 900);
    toast(peaceful ? '👻 Midnight! Friendly spirits drift out to say hi (✋ them for candy)' : '👻 MIDNIGHT! The ghost horde rises! Survive till sunrise');
    if (!peaceful && settings.jumpscares && state.gameTime - lastScare > 60) setTimeout(() => jumpscare(null, 'ghost'), 1500);
  }
}
{ const rs2 = renderSettings; renderSettings = function () { rs2();
  const box = document.getElementById('setBox'), rows = box.querySelectorAll('.row'), last = rows[rows.length - 1];
  const html = `<div class="row"><span class="nm">🎃 Halloween every night<br><span style="font-size:12px;opacity:.7">Trick-or-treaters in the evening and a ghost horde at midnight every night (normally only the last night of autumn)</span></span><button class="btn ${settings.halloween ? 'gold' : ''}" data-s="halloween">${settings.halloween ? 'ON' : 'OFF'}</button></div>`;
  if (last) last.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
}; }

// ======================= 8. FISHING =======================
// Hold a fishing rod and ✋ while facing water (from the shore or a boat). Wait for the bite, then ✋ again to reel it in.
let fishing = null;
function waterAhead(maxD = 11) {
  const o = new THREE.Vector3(player.pos.x, player.pos.y + EYE, player.pos.z), d = getDir(), p = new THREE.Vector3();
  for (let t = 0.6; t < maxD; t += 0.2) {
    p.copy(o).addScaledVector(d, t); const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z), id = get(x, y, z);
    if (isWater(id)) { let yy = y; while (yy < H - 2 && isWater(get(x, yy + 1, z))) yy++; return { x: p.x, y: yy + 0.92, z: p.z }; }
    if (solid(id) && !(player.car && player.car.vessel)) return null;
  }
  return null;
}
function stopFishing(msg) { if (!fishing) return; scene.remove(fishing.bob); scene.remove(fishing.line); fishing = null; if (msg) toast(msg); }
function castRod() {
  let w = waterAhead();
  if (!w && player.car && player.car.vessel) { const c = player.car, x = c.x - Math.sin(player.yaw) * 4, z = c.z - Math.cos(player.yaw) * 4, wl = waterLevelAt(x, z, (c.wl || SEA) + 2); if (wl > 0) w = { x, y: wl + 0.92, z }; }
  if (!w) { toast('🎣 Face the water to cast (from the shore or a boat)'); return; }
  const bob = new THREE.Group(); box(0.18, 0.12, 0.18, 0xf4f4f4, 0, 0, 0, bob); const top = box(0.12, 0.1, 0.12, 0xe02020, 0, 0.1, 0, bob); top.material.emissive.setHex(0x500000);
  bob.position.set(w.x, w.y, w.z); scene.add(bob);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.7 })); scene.add(line);
  const rain = wxHere === 'rain' || wxHere === 'storm';
  fishing = { bob, line, x: w.x, y: w.y, z: w.z, wait: (5 + Math.random() * 9) * (rain ? 0.8 : 1), bite: 0 };
  swing(); noiseF(0.12, 0.05, 'highpass', 2000, 5000, 1); setTimeout(() => noiseBurst(0.1, 0.06, 700), 350);
  toast('🎣 Cast! Wait for a bite...');
}
function rollCatch() {
  const night = nightAmt > 0.5, rain = wxHere === 'rain' || wxHere === 'storm';
  if (night && Math.random() < 0.07) return 'moonfish';
  if (rain && Math.random() < 0.08) return 'golden_koi';
  const r = Math.random();
  if (r < 0.45) return 'raw_cod'; if (r < 0.7) return 'raw_salmon'; if (r < 0.8) return 'tropical_fish'; if (r < 0.87) return 'pufferfish';
  if (r < 0.97) return ['stick', 'bone', 'leather', 'rotten_flesh'][rint(0, 3)];
  return ['gold_jewelry', 'silver_jewelry', 'iron_jewelry'][rint(0, 2)];
}
function reelIn() {
  if (fishing.bite > 0) {
    const id = rollCatch(); stopFishing(); give(id, 1); wearTool(1);
    const rare = id === 'moonfish' || id === 'golden_koi', junk = !FISH.has(id) && !/jewelry/.test(id);
    toast(rare ? `✨ RARE CATCH! ${ITEMS[id].name}!` : /jewelry/.test(id) ? `💍 Sunken treasure: ${ITEMS[id].name}!` : junk ? `🥾 Just junk... ${ITEMS[id].name}` : `🎣 Caught a ${ITEMS[id].name}!`);
    beep(rare ? 1200 : 760, 0.1, 'triangle', 0.07); if (rare) setTimeout(() => beep(1600, 0.15, 'triangle', 0.07), 120);
    particles(player.pos.x, player.pos.y + 1.2, player.pos.z, new THREE.Color(0.4, 0.6, 1), 8);
  } else stopFishing('🎣 Reeled in. Nothing yet');
  swing();
}
function updateFishing(dt, t) {
  if (!fishing) return;
  if (held() !== 'fishing_rod' || !player.alive) { stopFishing(); return; }
  const f = fishing, pp = player.pos;
  if (Math.hypot(f.x - pp.x, f.z - pp.z) > 18) { stopFishing('🎣 Your line snapped (too far away)'); return; }
  const hand0 = camera.localToWorld(new THREE.Vector3(0.35, -0.2, -0.8)), arr = f.line.geometry.attributes.position.array;
  arr[0] = hand0.x; arr[1] = hand0.y; arr[2] = hand0.z; arr[3] = f.bob.position.x; arr[4] = f.bob.position.y + 0.1; arr[5] = f.bob.position.z; f.line.geometry.attributes.position.needsUpdate = true;
  if (f.bite > 0) {
    f.bite -= dt; f.bob.position.y = f.y - 0.22 + Math.sin(t * 30) * 0.05;
    if (f.bite <= 0) { f.wait = 4 + Math.random() * 8; toast('🐟 It got away...'); }
  } else {
    f.wait -= dt; f.bob.position.y = f.y + Math.sin(t * 2.2) * 0.04;
    if (f.wait <= 0) { f.bite = 1.6; noiseBurst(0.18, 0.1, 600); particles(f.x, f.y, f.z, new THREE.Color(0.7, 0.85, 1), 6); toast('🎣 BITE! ✋ to reel it in!'); beep(990, 0.06, 'square', 0.05); }
  }
}
{ const eat0 = eat; eat = function (id) { const had = count(id); eat0(id);
  if (id === 'pufferfish' && count(id) < had) { exhaust(16); setTimeout(() => toast('🐡 Ugh... pufferfish. Your stomach is NOT happy'), 600); } }; }

// ---- one useAction hook for the new interactions (rod, stash, business deeds)
{ const use12 = useAction; useAction = function () {
  if (!player.alive || odBusy) return;
  const id = held();
  if (id === 'fishing_rod' && !uiOpen) {
    const h = player.car ? null : raycast();
    if (!(h && (h.kind === 'villager' || h.kind === 'mob' || h.kind === 'car' || h.kind === 'vessel'))) { if (fishing) reelIn(); else castRod(); return; }
  }
  if ((id === 'laundromat' || id === 'car_wash') && !player.car) { openBiz(id); return; }
  if (!player.car && !player.horse) { const h = raycast(); if (h && h.kind === 'block' && h.id === STASH) { openChest(h.x, h.y, h.z); return; } }
  return use12(); }; }
// breaking a hidden stash spills its contents like a chest
NO_BLAST.add(STASH);
{ const fb0 = finishBreak; finishBreak = function (h) {
  const k = h.x + ',' + h.y + ',' + h.z, items = h.id === STASH && state.chests[k] ? state.chests[k] : null;
  fb0(h);
  if (items && get(h.x, h.y, h.z) !== STASH) { for (const s of items) if (s) give(s.id, s.n); delete state.chests[k]; }
}; }

// ---- phone: 🔌 The Plug app (jobs, money, businesses, turf)
{ const rp0 = renderPhone; renderPhone = function () {
  rp0();
  const el = document.getElementById('pScreen'); if (!el) return;
  if (phoneApp === 'home') { const a = el.querySelector('.papps'); if (a && !a.querySelector('[data-app="plug"]')) a.insertAdjacentHTML('beforeend', '<button class="papp" data-app="plug"><i style="background:linear-gradient(#3a3a3a,#0a0a0a)">🔌</i>The Plug</button>'); return; }
  if (phoneApp !== 'plug') return;
  const v = V12(), j = v.job, offers = j ? [] : plugOffers(), r = washRate(), nTurf = Object.keys(v.turf).length;
  let h = `<div class="pappbar">🔌 The Plug <span style="margin-left:auto;font-size:12px;opacity:.8">rep ${v.rep}</span></div><div class="pplug">
    <div class="bal"><span>💰 ${state.coins} clean</span><span style="color:#9aff8a">💵 ${dirtyCash()} dirty</span></div>`;
  if (j) {
    const p = j.stage === 'pickup' ? j.a : j.b, d = Math.round(Math.hypot(p.x - player.pos.x, p.z - player.pos.z));
    h += `<h4>Current job</h4><div class="pst">${j.stage === 'pickup' ? `🟢 Pick up ${j.what}` : `🔴 Deliver ${j.what}`} · ${d} m away${j.stage === 'drop' ? ` · ⏱ ${Math.max(0, Math.ceil(j.until - state.gameTime))}s` : ''}<br>Pays 💵${j.pay} dirty · follow the beam / GPS pin</div><button class="pst stop" data-plug="cancel">✕ Drop this job</button>`;
  } else {
    h += '<h4>Jobs</h4>';
    h += offers.length ? offers.map((o, i) => `<button class="pst" data-plug="acc${i}">📦 Move ${o.what}${o.far ? ' to the next town' : ' across town'} · ${o.d} m · ⏱ ${o.limit}s<br><b style="color:#9aff8a">💵 ${Math.round(o.pay * (1 + Math.min(1, v.rep * 0.1)))}</b> · tap to accept</button>`).join('')
      : '<div class="pst">📵 No signal from the Plug out here. Get closer to a town.</div>';
    h += '<div class="phint" style="margin-top:0">New jobs every day. Cops who spot you with a package come after you.</div>';
  }
  h += `<h4>Laundering</h4><div class="pst">${v.biz.length ? v.biz.map(b => BIZ[b] ? BIZ[b].n : b).join(' · ') + `<br>Washing 💵${Math.round(r * 60)}/min → 💰 (10% cut)` : 'No businesses yet. Buy a 🧺 Laundromat or 🚿 Car Wash deed on DealerNet (💼 Business), then ✋ it to open.'}</div>
    <div class="phint" style="margin-top:0">Dirty cash still works at traders, but flashing big wads draws the cops.</div>
    <h4>Turf</h4><div class="pst">🏴 ${nTurf ? `${nTurf} block${nTurf > 1 ? 's' : ''} · 💵${nTurf * TURF_CUT}/day` : 'No turf. Knock out 5 gang members on one ghetto block to claim it.'}</div>
    <h4>Street</h4><div class="pst">💊 Hold drugs and ✋ townsfolk to sell. Crackhead regulars: ${v.fiend}</div></div>`;
  el.innerHTML = phoneStatus() + h;
}; }
phoneEl.addEventListener('click', e => {
  const b = e.target.closest('[data-plug]'); if (!b) return; const a = b.dataset.plug;
  if (a === 'cancel') failJob('🔌 You dropped the job. The Plug won\'t forget that');
  else if (a.startsWith('acc')) acceptJob(+a.slice(3));
  renderPhone(); beep(990, 0.03, 'sine', 0.04);
});

// ---- HUD line (joins the wanted / prison line)
{ const rh0 = renderHud4; renderHud4 = function () {
  rh0();
  const bits = [], v = V12(), j = v.job;
  if (j) { const p = j.stage === 'pickup' ? j.a : j.b, d = Math.round(Math.hypot(p.x - player.pos.x, p.z - player.pos.z)); bits.push(j.stage === 'pickup' ? `🔌 Pick up 📦 · ${d} m` : `🔌 Deliver 📦 · ${d} m · ⏱ ${Math.max(0, Math.ceil(j.until - state.gameTime))}s`); }
  if (raid) bits.push(`🚔 RAID · ${raid.cops.filter(m => mobs.includes(m)).length} cops`);
  if (retake) bits.push(`🔫 Defend your block · ${retake.mobs.filter(m => mobs.includes(m)).length} left`);
  if (inGhetto(player.pos.x, player.pos.z)) { const tf = turfAt(player.pos.x, player.pos.z); if (tf) bits.push(v.turf[tf.key] ? '🏴 Your turf' : `🏴 ${GANGS[gangOfTurf(tf)].e} turf · ${v.turfKills[tf.key] || 0}/${TURF_KILLS}`); }
  if (fishing) bits.push(fishing.bite > 0 ? '🎣 BITE! ✋ now!' : '🎣 Fishing...');
  else if (held() === 'fishing_rod') bits.push('🎣 ✋ at water to cast');
  if (halloweenNow()) bits.push(dayFrac() < 0.75 ? '🎃 Halloween night' : '👻 Halloween · midnight');
  if (odLoad >= 6.5) bits.push('💓 Overdose risk');
  if (!bits.length) return;
  const extra = bits.join(' &nbsp; '), html = hud4.innerHTML ? hud4.innerHTML + ' &nbsp; ' + extra : extra;
  if (hud4.innerHTML !== html) hud4.innerHTML = html; hud4.style.display = 'block';
}; }

// ---- the per-frame hook (called from the main loop)
function updateV112(dt, t) {
  if (!playing) return;
  const v = V12();
  odLoad = Math.max(0, odLoad - dt / 15); odWarnT = Math.max(0, odWarnT - dt);
  const d = day(); if (d > v.lastDay) { const n = d - v.lastDay; v.lastDay = d; turfDaily(n); } else if (d < v.lastDay) v.lastDay = d;
  updateLaundry(); updateRaids(dt); updateTurf(dt); updatePlug(dt); updateHalloween(dt, t); updateFishing(dt, t);
  if (wanted <= 0 && raid) { /* raid keeps going even if you lose the cops */ }
}
window.__dc12 = { V12, ILLEGAL, streetSale, overdose, get odLoad() { return odLoad; }, set odLoad(x) { odLoad = x; }, tol, startRaid, raidTargets, get raid() { return raid; }, turfAt, gangKill, turfDaily,
  get retake() { return retake; }, plugOffers, acceptJob, failJob, washRate, openBiz, isHalloweenDay, updateHalloween, castRod, reelIn, rollCatch, get fishing() { return fishing; }, updateV112,
  t: { get state() { return state; }, give, count, take, spawnMob, mobs, villagers, interactMob: (...a) => interactMob(...a), takeDrug: (...a) => takeDrug(...a), useAction: () => useAction(), finishBreak: (h) => finishBreak(h), setBlock, get, renderPhone: () => renderPhone(), openPhone, openTrade, renderHud4: () => renderHud4(), renderSettings: () => renderSettings(), player, settings, ghettoZones, STASH, ITEMS, get wanted() { return wanted; }, set wanted(x) { wanted = x; }, get wantedLvl() { return wantedLvl; }, set wantedLvl(x) { wantedLvl = x; }, updateFishing, closePanels, get trickT() { return trickT; }, set trickT(x) { trickT = x; } } };

// ================== v1.13 KINGPIN UPDATE: heists + pawn shop, car garage, real estate, crew, court & lawyers, drug lab, casino, daily challenges & achievements ==================
// Items/blocks/recipes are in the v1.13 data block near the top. Everything here grafts onto earlier code by wrapping.
// Save data lives in state.v113 (created lazily, so older saves load fine).
// Town "venues" (gas stations, jewelry stores, banks, pawn shops, garages, casinos) are kiosks with a clerk placed on the
// sidewalk in front of a lot. They are meshes, not blocks, so no world chunk changes and old worlds get them too.
function V13() {
  const v = state.v113 || (state.v113 = {});
  if (!v.cd) v.cd = {};                          // heist cooldowns: venue key -> gameTime it can be hit again
  if (v.car === undefined) v.car = null;         // your modded ride { col, nitro, armor, hidden }
  if (!Array.isArray(v.homes)) v.homes = [];     // safehouses { id, kind, x, y, z }
  if (v.spawnHome === undefined) v.spawnHome = null;
  if (!Array.isArray(v.crew)) v.crew = [];       // { id, kind, name, post, stock, cash, sold, unpaid }
  if (v.nextId == null) v.nextId = 1;
  if (!v.stats) v.stats = {};
  if (!v.ach) v.ach = {};
  if (v.lastDay == null) v.lastDay = day();
  if (v.lastRep == null) v.lastRep = V12().rep;
  return v;
}
V13();
const KP_STOLEN = ['stolen_watch', 'stolen_necklace', 'diamond_ring', 'vault_gold'];
const KP_LABDRUGS = ['meth_pure', 'meth_prime', 'cocaine_pure', 'cocaine_prime', 'crack_pure', 'crack_prime'];
const PURITY_MULT = { pure: 1.6, prime: 2.5 };
// lab drugs work like the street versions (a little longer), count as illegal, and sell for more
for (const id of KP_LABDRUGS) {
  const [base, grade] = id.split('_'), d = DRUGS[base];
  DRUGS[id] = { ...d, dur: Math.round(d.dur * (grade === 'prime' ? 1.4 : 1.2)), n: d.n + (grade === 'prime' ? ' (pure)' : '') };
  DRUG_MSG[id] = DRUG_MSG[base]; OD_LOAD[id] = (OD_LOAD[base] || 2) + (grade === 'prime' ? 1 : 0.5); ILLEGAL.add(id);
  const val = Math.round(itemValue(base) * PURITY_MULT[grade]); RAW_VALUE[id] = val; TOWN_TRADES[3].buys[id] = val; VILLAGERS[3].buys[id] = Math.round(val * 0.9);
}
Object.assign(RAW_VALUE, { drug_lab: 90, stolen_watch: 70, stolen_necklace: 95, diamond_ring: 180, vault_gold: 320, scratch_ticket: 5 });
FUEL.scratch_ticket = 0.2;

// ---- money helpers
const cashTotal = () => state.coins + dirtyCash();
function payAny(n, dirtyFirst) {   // pay n from both wallets; false (and nothing taken) if you can't cover it
  n = Math.round(n); const v = V12(); if (n <= 0) return true; if (state.coins + Math.floor(v.dirty) < n) return false;
  if (dirtyFirst) { const d = Math.min(Math.floor(v.dirty), n); v.dirty -= d; state.coins -= n - d; }
  else { const c = Math.min(state.coins, n); state.coins -= c; v.dirty -= n - c; }
  renderStats(); return true;
}
function addClean(n, why) { n = Math.round(n); if (n <= 0) return; state.coins += n; state.earned += n; if (why) toast(why); coinSnd(); renderStats(); }
// queued toasts (achievements / challenges) so they don't stomp on the action toast
const kpQ = []; let kpQT = 0;
function kpToast(msg) { kpQ.push(msg); }

// ======================= 8. DAILY CHALLENGES + ACHIEVEMENTS (events used by every feature, so they come first) =======================
const DAILY = {
  sell: { t: '💊 Sell 10 drugs on the street', n: 10, cash: 150 },
  fish: { t: '🎣 Catch 5 fish', n: 5, cash: 100 },
  koi: { t: '⭐ Catch a Golden Koi', n: 1, cash: 300, item: ['diamond_ring', 1] },
  plug: { t: '🔌 Complete a Plug job', n: 1, cash: 200 },
  casinoWin: { t: '🎰 Win a game at the casino', n: 1, cash: 120 },
  heist: { t: '🔫 Pull off a heist', n: 1, cash: 250, item: ['pistol_ammo', 24] },
  pawn: { t: '🏪 Pawn 3 stolen items', n: 3, cash: 150 },
  cook: { t: '⚗️ Cook a batch in a drug lab', n: 1, cash: 150 },
  gang: { t: '🧢 Knock out 3 gang members', n: 3, cash: 200, item: ['pistol_ammo', 12] },
  dirty: { t: '💵 Earn 500 dirty cash', n: 500, cash: 200 },
  mod: { t: '🔧 Buy a mod at a garage', n: 1, cash: 100 },
  crewSale: { t: '👥 Have your runners sell 5 drugs', n: 5, cash: 150, item: ['scratch_ticket', 3] },
};
function dailyToday() {
  const v = V13(), d = day();
  if (!v.daily || v.daily.day !== d) {
    const keys = Object.keys(DAILY), pick = [];
    for (let i = 0; pick.length < 3 && i < 60; i++) { const k = keys[Math.floor(hash2(d, i, state.seed + 1313) * keys.length)]; if (!pick.includes(k)) pick.push(k); }
    v.daily = { day: d, ids: pick, prog: {}, done: {} };
  }
  return v.daily;
}
function dailyEvent(k, n = 1) {
  const dl = dailyToday(), c = DAILY[k]; if (!c || !dl.ids.includes(k) || dl.done[k]) return;
  dl.prog[k] = Math.min(c.n, (dl.prog[k] || 0) + n);
  if (dl.prog[k] < c.n) return;
  dl.done[k] = true; state.coins += c.cash; state.earned += c.cash; let extra = '';
  if (c.item) { give(c.item[0], c.item[1]); extra = ` + ${c.item[1] > 1 ? c.item[1] + '× ' : ''}${ITEMS[c.item[0]].name}`; }
  const v = V13(); v.stats.dailies = (v.stats.dailies || 0) + 1; coinSnd(); renderStats();
  kpToast(`✅ Daily challenge done: ${c.t}! +💰${c.cash}${extra}`);
}
const ACH = [
  ['corner', '🤝 Corner Boy', 'Sell your first drug on the street', s => s.sell >= 1],
  ['block', '👑 King of the Block', 'Sell 100 drugs on the street', s => s.sell >= 100],
  ['stick', '🔫 Stick \'Em Up', 'Pull off your first heist', s => s.heist >= 1],
  ['bankjob', '🏦 The Bank Job', 'Empty a bank vault', s => s.bank >= 1],
  ['fence', '🏪 The Fence', 'Pawn 10 stolen items', s => s.pawn >= 10],
  ['pimp', '🔧 Pimp My Ride', 'Fit nitro, armor and a hidden compartment on one ride', s => s.fullMod >= 1],
  ['landlord', '🏠 Landlord', 'Own a safehouse', s => s.homes >= 1],
  ['mogul', '🌆 Property Mogul', 'Own 3 safehouses', s => s.homes >= 3],
  ['boss', '👥 Boss Up', 'Hire your first crew member', s => s.hired >= 1],
  ['beatcase', '⚖️ Beat the Case', 'Get a case dismissed by your lawyer', s => s.dismissed >= 1],
  ['bb', '⚗️ Breaking Bad', 'Cook a batch at 90%+ purity', s => s.prime >= 1],
  ['boom', '💥 Bad Batch', 'Blow up a drug lab', s => s.labBoom >= 1],
  ['lucky', '🎰 Lucky', 'Win at the casino', s => s.casinoWin >= 1],
  ['jackpot', '7️⃣ Jackpot!', 'Hit 7️⃣7️⃣7️⃣ on the slots', s => s.jackpot >= 1],
  ['koi', '⭐ Golden Touch', 'Catch a Golden Koi', s => s.koi >= 1],
  ['grind', '📅 Daily Grind', 'Finish 5 daily challenges', s => s.dailies >= 5],
  ['rich', '💰 Big Money', 'Hold 10,000 (💰 + 💵) at once', () => cashTotal() >= 10000],
];
function checkAch() {
  const v = V13();
  for (const [id, n, , f] of ACH) if (!v.ach[id] && f(v.stats)) { v.ach[id] = Math.max(1, Math.round(state.gameTime)); kpToast(`🏆 Achievement unlocked: ${n}`); }
}
function kpStat(k, n = 1) { const v = V13(); v.stats[k] = (v.stats[k] || 0) + n; dailyEvent(k, n); checkAch(); }
// hooks into earlier systems
{ const ss0 = streetSale; streetSale = function (m, id, fiend) { const n0 = count(id); ss0(m, id, fiend); if (count(id) < n0) kpStat('sell'); }; }
{ const rc0 = rollCatch; rollCatch = function () { const id = rc0(); if (FISH.has(id)) kpStat('fish'); if (id === 'golden_koi') kpStat('koi'); return id; }; }
{ const ad0 = addDirty; addDirty = function (n, why) { ad0(n, why); n = Math.round(n); if (n > 0) dailyEvent('dirty', n); }; }
{ const hm3 = hurtMob; hurtMob = function (m, dmg, from, noDrop) {
  const was = m && mobs.includes(m), type = m && m.type, cid = m && m.crewId;
  const r = hm3(m, dmg, from, noDrop);
  if (was && !mobs.includes(m) && m.hp <= 0) { if (type === 'gangster' && from === player.pos) kpStat('gang'); if (cid) crewDown(cid); }
  return r; }; }

// ---- shared panel for the counters / lab / casino / court
const v13css = document.createElement('style');
v13css.textContent = `#kpBox{width:min(560px,94vw)}#kpBox .kbal{display:flex;gap:12px;justify-content:center;font-weight:700;background:rgba(0,0,0,.3);border-radius:10px;padding:7px;margin:6px 0}
#kpBox .krow{display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)}#kpBox .krow .nm{flex:1}#kpBox .ksub{opacity:.75;font-size:13px;margin:4px 0}
#kpBox .kbig{display:block;width:100%;margin:6px 0;text-align:left;padding:10px 12px}#kpBox .ktabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
#kpBox .kres{text-align:center;font-size:20px;min-height:30px;margin:8px 0}#kpBox .reels{font-size:48px;text-align:center;letter-spacing:10px;margin:6px 0}
#kpBox .cards{font-size:22px;margin:4px 0}#kpBox .gauge{position:relative;height:26px;border-radius:8px;background:linear-gradient(90deg,#2a6ad2 0 45%,#2fbf4a 45% 65%,#d2a02a 65% 88%,#d2302a 88%);margin:10px 0}
#kpBox .needle{position:absolute;top:-4px;width:4px;height:34px;background:#fff;box-shadow:0 0 4px #000;border-radius:2px}#kpBox .prog{height:10px;border-radius:5px;background:#333;overflow:hidden}#kpBox .prog i{display:block;height:100%;background:#ffd84a}
#kpBox .sw{display:inline-block;width:30px;height:30px;border-radius:6px;border:2px solid #fff;margin:3px;cursor:pointer}
.pplug .pbar{height:8px;border-radius:4px;background:#333;overflow:hidden;margin-top:4px}.pplug .pbar i{display:block;height:100%;background:#3bff7a}
.pplug .prow{display:flex;gap:6px}.pplug .prow .pst{flex:1}
#bNitro{display:none;right:24px;bottom:240px;font-size:24px}body.kpnitro #bNitro{display:flex}body:not(.touch) #bNitro{display:none!important}`;
document.head.appendChild(v13css);
const kpEl = document.createElement('div'); kpEl.className = 'panel'; kpEl.id = 'kp'; kpEl.innerHTML = '<div class="box" id="kpBox"></div>'; document.body.appendChild(kpEl);
let kpMode = null, kpVenue = null, kpLab = null;
function openKp(mode, vn) { kpMode = mode; kpVenue = vn || null; renderKp(); openPanel('kp'); beep(520, 0.05, 'triangle', 0.05); }
const kpShown = () => kpEl.classList.contains('show');
const balHTML = () => `<div class="kbal"><span>💰 ${state.coins} clean</span><span style="color:#9aff8a">💵 ${dirtyCash()} dirty</span></div>`;

// ======================= VENUES: kiosks with a clerk in towns and cities =======================
const VENUE = {
  gas: { n: '⛽ Gas Station', col: 0xd23a2a, shirt: 0xd23a2a, heist: { t: 8, stars: 1, cd: 600, cash: [40, 110], what: 'register' } },
  jewelry: { n: '💎 Jewelry Store', col: 0x2ab8c8, shirt: 0x1a1a1a, heist: { t: 14, stars: 2, cd: 1200, cash: [60, 140], what: 'display case' } },
  bank: { n: '🏦 Bank', col: 0xc9a227, shirt: 0x24335a, heist: { t: 24, stars: 3, cd: 2400, cash: [450, 900], what: 'vault' } },
  pawn: { n: '🏪 Pawn Shop', col: 0x8a5a2a, shirt: 0x5a3a1a },
  garage: { n: '🔧 Garage & Mods', col: 0x3a3a46, shirt: 0x2a4a8a },
  casino: { n: '🎰 Casino', col: 0x9a1ad0, shirt: 0x111111 },
};
const venueMemo = new Map(), liveVenues = [];
function venuesOf(t) {
  if (venueMemo.has(t.id)) return venueMemo.get(t.id);
  const nb = t.nb || 3, city = t.type === 'city', lots = [];
  for (let i = 0; i < nb; i++) for (let j = 0; j < nb; j++) lots.push([i, j]);
  const r = mulberry(Math.floor(hash2(t.x0, t.z0, state.seed + 1300) * 1e9));
  for (let k = lots.length - 1; k > 0; k--) { const q = Math.floor(r() * (k + 1)); [lots[k], lots[q]] = [lots[q], lots[k]]; }
  const want = t.metro ? ['bank', 'casino', 'pawn', 'jewelry', 'gas', 'garage', 'jewelry', 'gas'] : city ? ['bank', 'casino', 'pawn', 'jewelry', 'gas', 'garage'] : ['gas', 'garage'];
  const isG = l => !!t.ghetto && districtOf(t, l[0], l[1]) === 'ghetto', used = new Set(), out = [];
  for (const kind of want) {
    const free = l => !used.has(l[0] + ',' + l[1]) && !(t.type !== 'city' && l[0] === 1 && l[1] === 1);   // keep the village square
    let lot = kind === 'pawn' && t.ghetto ? lots.find(l => free(l) && isG(l)) : null;
    if (!lot) lot = lots.find(l => free(l) && (kind === 'pawn' || !isG(l)));
    if (!lot) break; used.add(lot[0] + ',' + lot[1]);
    const x = t.x0 + lot[0] * 16 + 6, z = t.z0 + lot[1] * 16 + 4;
    out.push({ kind, x, z, j: lot[1], key: kind + '@' + x + ',' + z, t, mesh: null, y: t.base + 1 });
  }
  venueMemo.set(t.id, out); return out;
}
function venueMesh(vn) {
  const d = VENUE[vn.kind], g = new THREE.Group();
  box(1.6, 1.0, 0.7, d.col, 0, 0.5, 0, g); box(1.7, 0.08, 0.8, 0xe8e8e8, 0, 1.04, 0, g);
  for (const px of [-0.78, 0.78]) box(0.08, 2.2, 0.08, 0x333333, px, 1.1, 0.35, g);
  const awn = box(1.9, 0.12, 1.2, d.col, 0, 2.25, 0.1, g); awn.material.emissive.setHex(0x181818);
  if (vn.kind === 'gas') { box(0.5, 1.4, 0.4, 0xe8e8e8, -1.3, 0.7, 0, g); box(0.42, 0.3, 0.05, 0x111111, -1.3, 1.1, -0.22, g); }
  if (vn.kind === 'jewelry') { const gl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.5), glassMat); gl.position.set(0, 1.22, 0); g.add(gl); box(0.12, 0.12, 0.12, 0xffe14a, -0.3, 1.14, 0, g); box(0.12, 0.12, 0.12, 0x9ff4ff, 0.2, 1.14, 0, g); }
  if (vn.kind === 'bank') { box(1.0, 1.6, 0.25, 0x6a6e76, 0, 0.8, 0.85, g); const w = box(0.4, 0.4, 0.06, 0xc9a227, 0, 0.9, 0.7, g); w.material.emissive.setHex(0x302000); }
  if (vn.kind === 'pawn') for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lam(0xffd23a)); b.position.set(-0.2 + k * 0.2, 2.6 - (k === 1 ? 0.25 : 0), -0.5); g.add(b); }
  if (vn.kind === 'garage') { box(0.5, 0.5, 0.5, 0x222222, 1.3, 0.25, 0, g); box(0.1, 0.6, 0.1, 0xbababa, 1.3, 0.8, 0, g); }
  if (vn.kind === 'casino') for (let k = 0; k < 6; k++) { const b = box(0.16, 0.16, 0.06, [0xff3b3b, 0xffd23b, 0x3bff7a, 0x3ba0ff][k % 4], -0.75 + k * 0.3, 2.42, -0.5, g); b.material.emissive.setHex([0x801010, 0x806010, 0x108030, 0x103080][k % 4]); }
  const clerk = humanoid({ shirt: d.shirt, skin: [0xf1c27d, 0xc58c63, 0x8d5524][Math.floor(hash2(vn.x, vn.z, 5) * 3)], pants: 0x222222 });
  clerk.g.position.set(0, 0, 0.75); clerk.g.rotation.y = Math.PI; clerk.g.scale.setScalar(0.92); g.add(clerk.g);   // behind the counter, facing the street (-z)
  const tag = nameSprite(d.n); tag.position.y = 3.0; g.add(tag);
  g.position.set(vn.x + 0.5, vn.y, vn.z + 0.5); scene.add(g); return g;
}
let venueT = 0;
function updateVenues(dt) {
  venueT -= dt; if (venueT > 0) return; venueT = 1;
  const pp = player.pos;
  for (let i = liveVenues.length - 1; i >= 0; i--) { const vn = liveVenues[i]; if (Math.hypot(vn.x - pp.x, vn.z - pp.z) > 110) { scene.remove(vn.mesh); vn.mesh = null; liveVenues.splice(i, 1); } }
  for (const t of townsNear(80)) for (const vn of venuesOf(t)) {
    if (vn.mesh || Math.hypot(vn.x - pp.x, vn.z - pp.z) > 80 || !data.has(ckey(fdiv(vn.x, CH), fdiv(vn.z, CH)))) continue;
    let y = t.base + 1; while (y < t.base + 6 && (solid(get(vn.x, y, vn.z)) || solid(get(vn.x, y + 1, vn.z)))) y++;
    while (y > 1 && !solid(get(vn.x, y - 1, vn.z))) y--;
    vn.y = y; vn.mesh = venueMesh(vn); liveVenues.push(vn);
  }
}
function venueNear(r = 2.8) {
  let best = null, bd = r;
  for (const vn of liveVenues) { const d = Math.hypot(vn.x + 0.5 - player.pos.x, vn.z + 0.5 - player.pos.z); if (d < bd && Math.abs(player.pos.y - vn.y) < 3) { bd = d; best = vn; } }
  return best;
}
function useVenue(vn) {
  if (vn.kind === 'gas' || vn.kind === 'jewelry' || vn.kind === 'bank') {
    if (isWeapon(held())) { startHeist(vn); return; }
    if (vn.kind === 'gas') { if (payAny(10, false)) { give('scratch_ticket', 1); toast('⛽ "One scratch-off, coming up." -💰10 · 🔫 (hold a weapon to rob the register)'); } else toast('⛽ Scratch-offs are 💰10 · hold a weapon to rob the register'); return; }
    toast(`${VENUE[vn.kind].n} · 🔫 hold a gun or weapon and ✋ to rob the ${VENUE[vn.kind].heist.what}`); return;
  }
  openKp(vn.kind, vn);
}
// label when you're standing at a counter
{ const ut0 = updateTarget; updateTarget = function () {
  ut0(); const el = document.getElementById('target'); if (el.style.display === 'block' || !playing) return;
  let txt = '';
  const vn = venueNear(player.car ? 7 : 2.8);
  if (vn) {
    const n = VENUE[vn.kind].n, cd = V13().cd[vn.key] || 0;
    if (VENUE[vn.kind].heist) txt = `${n} · ${isWeapon(held()) ? (state.gameTime < cd ? '🚫 robbed recently' : `✋ rob the ${VENUE[vn.kind].heist.what}`) : vn.kind === 'gas' ? '✋ buy a scratch-off (💰10)' : '🔫 hold a weapon to rob it'}`;
    else txt = `${n} · ✋ ${vn.kind === 'pawn' ? 'sell stolen goods' : vn.kind === 'garage' ? 'mod your ride' : 'play'}`;
  } else { const hm = homeNear(); if (hm) txt = `${HOMES[hm.kind].n} (your safehouse) · ✋ stash / set spawn`; }
  if (txt) { el.style.display = 'block'; el.textContent = txt; }
}; }

// ======================= 1. HEISTS + PAWN SHOP =======================
let heist = null;
const isWeapon = id => !!(id && ITEMS[id] && (GUNS[id] || (ITEMS[id].tool && (ITEMS[id].tool.kind === 'sword' || ITEMS[id].tool.kind === 'axe'))));
function startHeist(vn) {
  const hd = VENUE[vn.kind].heist, v = V13();
  if (heist) { toast('🔫 You\'re already robbing a place!'); return; }
  const cd = v.cd[vn.key] || 0;
  if (state.gameTime < cd) { toast(`🚫 ${VENUE[vn.kind].n} got robbed recently. Come back in ${Math.ceil((cd - state.gameTime) / 60)} min`); return; }
  if (!isWeapon(held())) { toast(`🔫 Hold a gun or a weapon to rob the ${hd.what}`); return; }
  heist = { vn, t: 0, total: hd.t, alarm: false, alarmAt: vn.kind === 'gas' ? (Math.random() < 0.55 ? 2.5 + Math.random() * 3 : 1e9) : 0.6 };
  swing(); beep(300, 0.15, 'sawtooth', 0.05);
  toast(`🔫 "Everybody down! Empty the ${hd.what}!" · stay close for ${hd.t}s`);
}
function heistAlarm() {
  const vn = heist.vn, hd = VENUE[vn.kind].heist; heist.alarm = true;
  toast(`🚨 ALARM! ${'★'.repeat(hd.stars)} The cops are on the way`); beep(760, 0.5, 'sawtooth', 0.05); setTimeout(() => beep(980, 0.5, 'sawtooth', 0.05), 550);
  if (!canHurtPlayer() || jail) return;
  setWanted(); wantedLvl = Math.max(wantedLvl, hd.stars); wanted = Math.max(wanted, 30 + wantedLvl * 15);
  for (let i = 0, n = 0; i < 16 && n < hd.stars; i++) {
    const a = Math.random() * 6.28, r = 10 + Math.random() * 6, x = Math.floor(vn.x + Math.cos(a) * r), z = Math.floor(vn.z + Math.sin(a) * r);
    if (!data.has(ckey(fdiv(x, CH), fdiv(z, CH)))) continue; const y = groundNear(x + 0.5, vn.y + 2, z + 0.5);
    if (solid(get(x, y, z)) || solid(get(x, y + 1, z)) || isWater(get(x, y - 1, z))) continue;
    const m = spawnMob('cop', x + 0.5, y, z + 0.5); if (m) { m.townId = vn.t.id; m.home = new THREE.Vector2(vn.x, vn.z); n++; }
  }
  const t = vn.t, lx = vn.x + 16, lz = laneCoord(t, 2, vn.j);
  if (data.has(ckey(fdiv(lx, CH), fdiv(lz, CH))) && !cars.some(o => Math.hypot(o.x - lx, o.z - lz) < 5)) spawnCar(t, { kind: 'police', people: 2, dir: 2, strip: vn.j, x: lx, z: lz, ai: true });
}
function heistLoot() {
  const vn = heist.vn, hd = VENUE[vn.kind].heist, v = V13(); heist = null;
  v.cd[vn.key] = state.gameTime + hd.cd;
  const cash = rint(hd.cash[0], hd.cash[1]), got = [];
  const add = (id, n) => { if (n > 0) { give(id, n); got.push(`${n > 1 ? n + '× ' : ''}${ITEMS[id].emoji || ''}`); } };
  if (vn.kind === 'gas') add('scratch_ticket', rint(0, 2));
  if (vn.kind === 'jewelry') { for (let k = rint(2, 4); k > 0; k--) add(['stolen_watch', 'stolen_necklace', 'stolen_necklace', 'diamond_ring'][rint(0, 3)], 1); }
  if (vn.kind === 'bank') { add('vault_gold', rint(1, 2)); if (Math.random() < 0.35) add('diamond_ring', 1); }
  addDirty(cash, `💰 Got away with it! +💵${cash} dirty${got.length ? ' + ' + got.join(' ') : ''}${KP_STOLEN.some(id => count(id)) ? ' · fence the goods at a 🏪 Pawn Shop' : ''}`);
  kpStat('heist'); if (vn.kind === 'bank') kpStat('bank');
}
function updateHeist(dt) {
  if (!heist) return;
  const vn = heist.vn, d = Math.hypot(vn.x + 0.5 - player.pos.x, vn.z + 0.5 - player.pos.z);
  if (!player.alive || jail || court || d > 6.5 || !vn.mesh) {
    V13().cd[vn.key] = state.gameTime + VENUE[vn.kind].heist.cd / 3;
    toast(player.alive && !jail && !court ? '🏃 You left the store. Heist failed!' : '🔫 Heist failed'); if (!heist.alarm && canHurtPlayer() && player.alive && !court) heistAlarm(); heist = null; return;
  }
  heist.t += dt;
  if (!heist.alarm && heist.t >= heist.alarmAt) heistAlarm();
  if (heist.t >= heist.total) heistLoot();
}
// pawn shop: buys stolen goods and jewelry for dirty cash
const PAWN = { stolen_watch: 70, stolen_necklace: 95, diamond_ring: 180, vault_gold: 320, iron_jewelry: 6, silver_jewelry: 18, gold_jewelry: 30, platinum_jewelry: 48, diamond_jewelry: 220, gold_ingot: 15, silver_ingot: 10, platinum_ingot: 25 };
const pawnPrice = id => Math.max(1, Math.round(PAWN[id] * priceMult(id)));
function pawnSell(id, all) {
  const have = count(id); if (!have || !PAWN[id]) return; const n = all ? have : 1, p = pawnPrice(id) * n;
  take(id, n); addDirty(p, `🏪 Pawned ${n}× ${ITEMS[id].name} for 💵${p} dirty`);
  if (KP_STOLEN.includes(id)) kpStat('pawn', n);
}
function pawnHTML() {
  const ids = Object.keys(PAWN).filter(id => count(id) > 0);
  return `<h2>🏪 Pawn Shop</h2><div class="ksub">"No questions asked." Stolen goods and jewelry, paid in 💵 dirty cash. Prices change daily.</div>${balHTML()}` +
    (ids.length ? ids.map(id => `<div class="krow"><span class="ic">${iconHTML(id)}</span><span class="nm">${ITEMS[id].name} <span style="opacity:.6">(have ${count(id)})</span></span><b>💵 ${pawnPrice(id)}</b><button class="btn" data-kp="pawn1:${id}">Sell 1</button><button class="btn gold" data-kp="pawnA:${id}">All</button></div>`).join('')
      : '<div class="ksub" style="padding:14px;text-align:center">Nothing to pawn. Rob a 💎 jewelry store or 🏦 bank, or dig up jewelry.</div>');
}

// ======================= 2. CAR GARAGE: paint, nitro, armor, hidden compartment =======================
const MODS = { nitro: { n: '🔥 Nitro', p: 450, d: 'Boost: N key / 🔥 button while driving' }, armor: { n: '🛡️ Armor plating', p: 700, d: 'Take 60% less damage inside, ram cars out of the way' }, hidden: { n: '🕳️ Hidden compartment', p: 900, d: 'Cops can\'t detect a Plug package while you drive this car' } };
const PAINT = [0xd2302a, 0x2a6ad2, 0xf2f2f2, 0x111214, 0x3fa34d, 0xf2c21a, 0xff5ad0, 0x7a2ad2, 0xff7a1a, 0x30e0e0], PAINT_PRICE = 60;
let kpLastCar = null, nitroT = 0, nitroCharge = 1, rideCd = 0;
{ const ec0 = enterCar; enterCar = function (c) {
  ec0(c); kpLastCar = c;
  if (c.mods && Object.keys(c.mods).some(k => c.mods[k] && k !== 'col')) setTimeout(() => toast(`🔑 Your ride: ${['nitro', 'armor', 'hidden'].filter(k => c.mods[k]).map(k => MODS[k].n).join(' · ')}${c.mods.nitro ? (isTouch ? ' · tap 🔥 to boost' : ' · press N to boost') : ''}`), 1200);
}; }
function garageCar() {
  const c = player.car; if (c && !c.vessel && !c.air && cars.includes(c)) return c;
  const l = kpLastCar; if (l && cars.includes(l) && !l.ai && Math.hypot(l.x - player.pos.x, l.z - player.pos.z) < 12) return l;
  return null;
}
function paintCar(c, col) {
  const old = c.col != null ? c.col : c.g.children[0].material.color.getHex();
  for (const o of c.g.children) if (o.isMesh && o.material !== glassMat && o.material.color && o.material.color.getHex() === old) o.material.color.setHex(col);
  c.col = col;
}
function applyMods(c, mods) { c.mods = { ...mods }; if (mods.col != null) paintCar(c, mods.col); }
function makeMine(c) {   // the car you mod becomes "your ride": its mods are saved and the phone can call it back
  const v = V13();
  if (!c.mine) { for (const o of cars) if (o !== c) o.mine = false; c.mine = true; c.mods = c.mods || {}; }
  v.car = { ...c.mods }; return c.mods;
}
function buyMod(what, arg) {
  const c = garageCar(); if (!c) { toast('🔧 Drive a car up to the garage first'); return false; }
  if (c.kind === 'police') { toast('🚓 "I ain\'t touching a cop car, man."'); return false; }
  const m = c.mods || {};
  if (what === 'paint') {
    const col = PAINT[arg]; if (col == null) return false;
    if (!payAny(PAINT_PRICE, false)) { toast(`💸 A paint job is 💰${PAINT_PRICE}`); return false; }
    paintCar(c, col); makeMine(c).col = col;
  } else {
    const md = MODS[what]; if (!md) return false; if (m[what]) { toast(`${md.n} is already fitted`); return false; }
    if (!payAny(md.p, false)) { toast(`💸 ${md.n} costs 💰${md.p}`); return false; }
    makeMine(c)[what] = true;
  }
  V13().car = { ...c.mods }; coinSnd(); kpStat('mod');
  if (c.mods.nitro && c.mods.armor && c.mods.hidden) { const v = V13(); if (!v.stats.fullMod) kpStat('fullMod'); }
  toast(what === 'paint' ? '🎨 Fresh paint! This is your ride now (📱 🏠 Property app can call it back)' : `🔧 ${MODS[what].n} fitted! ${MODS[what].d}`);
  return true;
}
function garageHTML() {
  const c = garageCar(), m = (c && c.mods) || {};
  let h = `<h2>🔧 Garage & Mods</h2><div class="ksub">Pays with 💰 clean first, then 💵 dirty. The car you mod becomes your ride (call it back from the phone).</div>${balHTML()}`;
  if (!c) return h + '<div class="ksub" style="padding:14px;text-align:center">🚗 Drive a car up to the counter (or park it right next to it) to mod it.</div>';
  if (c.kind === 'police') return h + '<div class="ksub" style="padding:14px;text-align:center">🚓 "I ain\'t touching a cop car, man."</div>';
  h += `<h3>🎨 Paint · 💰${PAINT_PRICE}</h3><div>${PAINT.map((col, i) => `<span class="sw" data-kp="paint:${i}" style="background:#${col.toString(16).padStart(6, '0')}"></span>`).join('')}</div><h3>Upgrades</h3>`;
  h += Object.entries(MODS).map(([k, md]) => `<div class="krow"><span class="nm"><b>${md.n}</b><br><span style="opacity:.7;font-size:12px">${md.d}</span></span>${m[k] ? '<b>✅ fitted</b>' : `<button class="btn gold" data-kp="mod:${k}" ${cashTotal() >= md.p ? '' : 'disabled'}>💰 ${md.p}</button>`}</div>`).join('');
  return h;
}
function spawnMyRide() {
  const v = V13();
  if (!v.car) { toast('🔧 Mod a car at a garage first, then you can call it'); return null; }
  if (player.car) { toast('🚗 You\'re already driving'); return null; }
  const old = cars.find(c => c.mine);
  if (old && Math.hypot(old.x - player.pos.x, old.z - player.pos.z) < 25) { toast('🚗 Your ride is right here'); return old; }
  if (rideCd > 0) { toast(`🔑 Your driver is on the way... (${Math.ceil(rideCd)}s)`); return null; }
  if (old) removeCar(old);
  const t = townsNear(60)[0] || { base: Math.floor(player.pos.y) - 1, x0: 0, z0: 0, x1: 0, z1: 0, nb: 3, id: 'wild' };
  const a = player.yaw, x = player.pos.x - Math.sin(a) * 4, z = player.pos.z - Math.cos(a) * 4;
  const c = spawnCar(t, { kind: 'car', people: 0, x, z, head: a + Math.PI });
  c.y = Math.floor(player.pos.y) + 1; snapCarGround(c); applyMods(c, v.car); c.mine = true; kpLastCar = c; rideCd = 30;
  toast('🔑 Your ride pulled up! ✋ it to get in'); beep(440, 0.1, 'square', 0.05); setTimeout(() => beep(440, 0.1, 'square', 0.05), 160);
  return c;
}
function fireNitro() {
  const c = player.car; if (!c || !c.mods || !c.mods.nitro) return;
  if (nitroT > 0) return; if (nitroCharge < 1) { toast(`🔥 Nitro recharging... ${Math.round(nitroCharge * 100)}%`); return; }
  nitroT = 3.5; nitroCharge = 0; toast('🔥 NITRO!'); noiseBurst(0.6, 0.12, 900); beep(180, 0.5, 'sawtooth', 0.05);
}
addEventListener('keydown', e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; if (e.code === 'KeyN' && playing && !uiOpen) fireNitro(); });
{ const nb = document.createElement('div'); nb.className = 'tb'; nb.id = 'bNitro'; nb.textContent = '🔥'; const ref = document.getElementById('bUp'); (ref ? ref.parentNode : document.body).appendChild(nb); holdBtn('bNitro', () => fireNitro()); nb.addEventListener('click', () => fireNitro()); }
{ const dc0 = driveCar; driveCar = function (c, dt) {
  const m = c.mods || {};
  if (m.armor && Math.abs(c.speed) > 3) {   // armored: shove cars out of the way instead of bouncing off
    const o = blockedAhead(c, 2.6);
    if (o && o !== 'player' && o.kind && cars.includes(o)) {
      const fx = Math.sin(c.head), fz = Math.cos(c.head), side = Math.sign((o.x - c.x) * fz - (o.z - c.z) * fx) || 1;
      o.x += fz * side * 2.6 + fx * 0.8; o.z += -fx * side * 2.6 + fz * 0.8; o.speed = 0; o.g.position.set(o.x, o.y, o.z); noiseBurst(0.2, 0.14, 260); shake(0.2, 0.05);
    }
  }
  dc0(c, dt);
  if (player.car !== c) return;
  if (nitroT > 0 && c.speed >= 0) {
    c.speed = Math.min(26, c.speed + 30 * dt);
    if (Math.random() < dt * 20) particles(c.x - Math.sin(c.head) * 2, c.y + 0.4, c.z - Math.cos(c.head) * 2, new THREE.Color(0.3, 0.6, 1), 2);
  }
}; }
{ const dm1 = damage; damage = function (n, cause, from) {
  if (court) return;
  const c = player.car; if (c && c.mods && c.mods.armor && cause !== 'fall' && cause !== 'starve' && cause !== 'drown' && cause !== 'fire') n = Math.max(1, Math.round(n * 0.4));
  return dm1(n, cause, from);
}; }

// ======================= 3. REAL ESTATE: safehouses =======================
const HOMES = { deed_apartment: { n: '🏢 Apartment', price: 1500, rent: 60 }, deed_house: { n: '🏠 House', price: 4000, rent: 170 }, deed_penthouse: { n: '🌆 Penthouse', price: 12000, rent: 550 } };
for (const k in HOMES) RAW_VALUE[k] = HOMES[k].price / 1.5;   // DealerNet buy price = the deed price
WEB_CATS.property = '🏠 Property';
{ const wc2 = webCat; webCat = function (id) { if (HOMES[id]) return 'property'; if (KP_STOLEN.includes(id)) return 'other'; return wc2(id); }; }
// DealerNet doesn't sell stolen goods, lab-grade drugs or Plug packages (you can still sell them there)
const WEB_HIDE = new Set([...KP_STOLEN, ...KP_LABDRUGS, 'plug_package']);
{ const rw0 = renderWeb; renderWeb = function (keepList) {
  const r = rw0(keepList); if (webTab !== 'buy') return r;
  const bx = (webFromPhone && document.getElementById('pWebBox')) || document.getElementById('webBox');
  if (bx) for (const b of bx.querySelectorAll('[data-wb]')) if (WEB_HIDE.has(b.dataset.wb)) { const row = b.closest('.row'); if (row) row.remove(); }
  return r;
}; }
const homeMeshes = new Map();
function homeMesh(hm) {
  const g = new THREE.Group();
  box(0.12, 1.3, 0.12, 0x5a3a1a, 0, 0.65, 0, g); box(0.5, 0.35, 0.35, 0x2a5a2a, 0, 1.35, 0, g);
  const tag = nameSprite(`${HOMES[hm.kind].n} · Safehouse`); tag.position.y = 2.1; g.add(tag);
  g.position.set(hm.x + 0.5, hm.y, hm.z + 0.5); scene.add(g); return g;
}
function homeNear(r = 2.6) { let best = null, bd = r; for (const hm of V13().homes) { const d = Math.hypot(hm.x + 0.5 - player.pos.x, hm.z + 0.5 - player.pos.z); if (d < bd && Math.abs(hm.y - player.pos.y) < 3) { bd = d; best = hm; } } return best; }
function moveIn(id) {
  const v = V13(), hd = HOMES[id]; if (!hd) return false;
  if (player.car || player.horse) { toast('🏠 Get out first, then ✋ the deed where you want to live'); return false; }
  if (v.homes.length >= 6) { toast('🏠 You own enough safehouses (6 max)'); return false; }
  if (v.homes.some(h => Math.hypot(h.x - player.pos.x, h.z - player.pos.z) < 12)) { toast('🏠 You already have a safehouse right here'); return false; }
  useHeld(1);
  const hm = { id: v.nextId++, kind: id, x: Math.floor(player.pos.x), y: Math.floor(player.pos.y), z: Math.floor(player.pos.z) };
  v.homes.push(hm); if (v.spawnHome == null) v.spawnHome = hm.id; v.stats.homes = v.homes.length; checkAch();
  swing(); coinSnd(); toast(`${hd.n} is yours! 🛏️ respawn point · 📦 raid-proof stash · +💰${hd.rent}/day rent`);
  return hm;
}
const homeById = id => V13().homes.find(h => h.id === id);
const homeSpawn = () => { const v = V13(); return v.spawnHome != null ? homeById(v.spawnHome) : null; };
function openSafe(hm) {
  const k = 'safe:' + hm.id; if (!state.chests[k]) state.chests[k] = Array(27).fill(null);
  if (uiOpen) closePanels();
  chestKeys = [k]; furnaceKey = null; invOpen = false; renderChest(); openPanel('trade'); beep(180, 0.1, 'triangle', 0.06);
}
{ const rc1 = renderChest; renderChest = function () { rc1(); if (chestKeys && String(chestKeys[0]).startsWith('safe:')) { const h2 = document.querySelector('#tradeBox h2'); if (h2) h2.textContent = '🏠 Safehouse Stash (raid-proof)'; } }; }
function homeHTML(hm) {
  const hd = HOMES[hm.kind], v = V13();
  return `<h2>${hd.n} · your safehouse</h2><div class="ksub">Rent pays 💰${hd.rent} clean every day. Cops never raid a safehouse stash.</div>${balHTML()}
    <button class="btn kbig" data-kp="stash:${hm.id}">📦 Open the stash</button>
    <button class="btn kbig ${v.spawnHome === hm.id ? 'gold' : ''}" data-kp="spawn:${hm.id}">${v.spawnHome === hm.id ? '🛏️ You respawn here ✅' : '🛏️ Respawn here'}</button>`;
}
function settleAt(x, y, z) {   // teleport and hold still until the land under you has loaded
  player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.fallStart = null; streamChunks(30, 30);
  const prev = window.__freeze; window.__freeze = true;
  const chk = n => {
    if (!data.has(ckey(fdiv(Math.floor(x), CH), fdiv(Math.floor(z), CH))) && n < 40) { streamChunks(8, 8); player.pos.set(x, y, z); setTimeout(() => chk(n + 1), 250); return; }
    if (collides(player.pos)) player.pos.y = groundAt(x, z); window.__freeze = prev;
  };
  chk(0);
}
{ const rs0 = respawn; respawn = function () {
  rs0(); const hm = homeSpawn();
  if (hm) { settleAt(hm.x + 0.5, hm.y, hm.z + 1.5); toast(`🏠 You woke up at your ${HOMES[hm.kind].n}`); }
}; }
{ const ws0 = wakeSpot; wakeSpot = function () { const hm = homeSpawn(); if (hm && Math.hypot(hm.x - player.pos.x, hm.z - player.pos.z) < 400) return { x: hm.x + 0.5, y: hm.y, z: hm.z + 1.5, name: 'your safehouse' }; return ws0(); }; }
function rentDaily(days) {
  const v = V13(); if (!v.homes.length) return;
  const r = v.homes.reduce((s, h) => s + HOMES[h.kind].rent, 0) * Math.min(3, days);
  addClean(r, `🏠 Rent from ${v.homes.length} propert${v.homes.length > 1 ? 'ies' : 'y'}: +💰${r} clean`);
}
function updateHomes() {
  const v = V13(), pp = player.pos;
  for (const hm of v.homes) { const d = Math.hypot(hm.x - pp.x, hm.z - pp.z), g = homeMeshes.get(hm.id); if (!g && d < 80) homeMeshes.set(hm.id, homeMesh(hm)); else if (g && d > 110) { scene.remove(g); homeMeshes.delete(hm.id); } }
  for (const [id, g] of homeMeshes) if (!homeById(id)) { scene.remove(g); homeMeshes.delete(id); }
}

// ======================= 4. HIRE A CREW: runners + bodyguards =======================
const CREW = { runner: { n: '🧍 Runner', hire: 150, wage: 60, max: 3 }, guard: { n: '💪 Bodyguard', hire: 300, wage: 120, max: 2 } };
const CREW_NAMES = ['Lil Tay', 'Smokey', 'Dice', 'Junior', 'Ace', 'Pookie', 'Bones', 'Rico', 'Slim', 'T-Bone', 'Spider', 'Cash'];
const PAYDAY = 3;   // wages every 3 in-game days
Object.assign(MOBDEF, {
  runner: { hp: 14, w: 0.3, h: 1.9, speed: 1.2, hostile: false, drops: () => [] },
  guard: { hp: 30, w: 0.3, h: 1.9, speed: 1.4, hostile: false, ai: true, npc: true, drops: () => [] },
});
Object.assign(MOB_NAMES, { runner: '🧍 Your runner', guard: '💪 Your bodyguard' });
{ const bm1 = buildMob; buildMob = function (type, v = 0) {
  if (type !== 'runner' && type !== 'guard') return bm1(type, v);
  const skin = [0xf1c27d, 0xc58c63, 0x8d5524, 0x5c3a21][v % 4];
  const p = type === 'runner' ? humanoid({ shirt: [0x2a2a2a, 0x8a1a1a, 0x1a3a8a][v % 3], skin, pants: 0x3a3a5a }) : humanoid({ shirt: 0x111111, sleeve: 0x111111, skin, pants: 0x111111, bw: 0.58 });
  if (type === 'runner') box(0.5, 0.18, 0.5, 0x222222, 0, 0.24, -0.02, p.head);   // hood
  else { box(0.4, 0.08, 0.04, 0x050505, 0, 0.05, 0.25, p.head); box(0.1, 0.3, 0.05, 0xd8d8d8, 0, 1.3, 0.15, p.g); gunMesh(p.arms[1], false); }
  return p;
}; }
const crewById = id => V13().crew.find(c => c.id === id);
const crewMob = id => mobs.find(m => m.crewId === id);
const stockN = r => Object.values(r.stock || {}).reduce((s, n) => s + n, 0);
function hire(kind) {
  const v = V13(), cd = CREW[kind]; if (!cd) return null;
  if (v.crew.filter(c => c.kind === kind).length >= cd.max) { toast(`👥 You can only run ${cd.max} ${kind}s`); return null; }
  if (!payAny(cd.hire, true)) { toast(`💸 Hiring a ${kind} costs 💵/💰${cd.hire} up front`); return null; }
  const used = new Set(v.crew.map(c => c.name)), name = CREW_NAMES.find(n => !used.has(n) && hash2(v.nextId, n.length, 3) < 0.9) || 'Shorty';
  const r = { id: v.nextId++, kind, name, post: null, stock: {}, cash: 0, sold: 0, unpaid: 0 };
  v.crew.push(r); kpStat('hired');
  toast(kind === 'runner' ? `🧍 ${name} is on your crew. Open 👥 Crew on your phone and post them on a corner` : `💪 ${name} has your back now`); coinSnd();
  return r;
}
function postRunner(id) {
  const r = crewById(id); if (!r || r.kind !== 'runner') return false;
  const x = Math.floor(player.pos.x), z = Math.floor(player.pos.z), t = townAt(x, z);
  if (!t || x < t.x0 || x >= t.x1 || z < t.z0 || z >= t.z1) { toast('📍 Runners only work corners in a town or city'); return false; }
  r.post = { x, y: Math.floor(player.pos.y), z }; const m = crewMob(id); if (m) removeMob(m, true);
  toast(`📍 ${r.name} will work this corner. Hold drugs and ✋ ${r.name} to hand them over`); return true;
}
function fireCrew(id, quiet) {
  const v = V13(), r = crewById(id); if (!r) return; v.crew = v.crew.filter(c => c !== r); const m = crewMob(id); if (m) removeMob(m, true);
  if (!quiet) toast(`👋 ${r.name} is off your crew${stockN(r) ? ` (kept ${stockN(r)} drugs)` : ''}`);
}
function crewDown(id) { const r = crewById(id); if (!r) return; fireCrew(id, true); kpToast(`💀 ${r.name} got taken out. They're off your crew`); }
function payCrew(debtOnly) {
  const v = V13(); let paid = 0;
  for (const r of [...v.crew]) {
    const owe = CREW[r.kind].wage * (debtOnly ? r.unpaid : r.unpaid + 1); if (!owe) continue;
    if (payAny(owe, true)) { r.unpaid = 0; paid += owe; continue; }
    if (debtOnly) continue;
    r.unpaid++;
    if (r.unpaid >= 2) {
      fireCrew(r.id, true);
      if (Math.random() < 0.5 && canHurtPlayer() && !jail) { setWanted(); kpToast(`🐀 ${r.name} quit over unpaid wages... and snitched to the cops!`); }
      else kpToast(`😤 ${r.name} quit over unpaid wages`);
    } else kpToast(`💸 Couldn't pay ${r.name} (💵${CREW[r.kind].wage}). Pay up or they walk`);
  }
  if (paid) kpToast(`👥 Paid your crew 💵${paid}`);
  return paid;
}
function interactCrew(m, id) {
  const r = crewById(m.crewId); if (!r) { removeMob(m, true); return; }
  if (r.kind === 'guard') { toast(`💪 ${r.name}: "${['I got your back, boss.', 'Nobody touches you.', 'Say the word.'][rint(0, 2)]}"`); return; }
  if (id && ILLEGAL.has(id)) {
    const s = state.slots[state.sel], n = s.n; r.stock[id] = (r.stock[id] || 0) + n; state.slots[state.sel] = null; renderHotbar(); swing();
    toast(`🧍 ${r.name}: "Bet. ${n}× ${ITEMS[id].name}, I'll move it." (stock ${stockN(r)})`); return;
  }
  if (r.cash >= 1) { const c = Math.floor(r.cash); r.cash -= c; addDirty(c, `🧍 ${r.name} hands you 💵${c} dirty · sold ${r.sold} so far`); return; }
  toast(`🧍 ${r.name}: ${stockN(r) ? `"Still got ${stockN(r)} to move."` : '"I\'m dry, boss. Hold some product and ✋ me."'}`);
}
{ const im3 = interactMob; interactMob = function (m, id, it) { if (m.crewId) { interactCrew(m, id); return true; } return im3(m, id, it); }; }
{ const ml3 = mobLabel; mobLabel = function (m) {
  if (m.crewId) { const r = crewById(m.crewId); if (!r) return '👤'; return r.kind === 'runner' ? `🧍 ${r.name} (runner) · stock ${stockN(r)} · 💵${Math.floor(r.cash)} · ✋ ${held() && ILLEGAL.has(held()) ? 'hand over drugs' : r.cash >= 1 ? 'collect' : 'talk'}` : `💪 ${r.name} (bodyguard)`; }
  return ml3(m); }; }
function guardFoe(o) {
  if (o.crewId || o.tamed || o.petId) return false;
  if (o.type === 'cop') return wanted > 0 && canHurtPlayer();
  if (o.type === 'gangster') return gangHostile(o);
  if (o.type === 'crackhead') return !(o.calm > 0) && canHurtPlayer();
  const d = MOBDEF[o.type]; if (!d) return false;
  if (d.hostile) return o.type !== 'trick' && o.type !== 'spirit';
  return !!(d.predator && o.angry > 0);
}
function guardAI(m, d, dt, dist) {
  const p = m.g.position, pp = player.pos; m.shootCd = Math.max(0, (m.shootCd || 0) - dt);
  const foe = nearestFoe(m, guardFoe, 16);
  if (foe) {
    const tp = foe.g.position.clone().setY(foe.g.position.y + 1.1), dx = tp.x - p.x, dz = tp.z - p.z, dd = Math.hypot(dx, dz) || 1;
    m.g.rotation.y = Math.atan2(dx, dz); m.aim = 0.3;
    if (m.shootCd <= 0 && lineOfSight(p.clone().setY(p.y + 1.45), tp)) { m.shootCd = 0.9 + Math.random() * 0.5; npcShoot(m, tp, foe, 'gangster'); if (foe.type === 'cop') wantedBump(1); }
    const go = dd > 9 ? 1 : 0; return [dx / dd * go, dz / dd * go, 3.2];
  }
  if (dist > 28) { const a = player.yaw, x = pp.x + Math.sin(a) * 2.5, z = pp.z + Math.cos(a) * 2.5; p.set(x, groundNear(x, pp.y + 2, z), z); m.vel.set(0, 0, 0); return [0, 0, 0]; }
  const dx = pp.x - p.x, dz = pp.z - p.z, dd = Math.hypot(dx, dz) || 1;
  if (dd > 3.5) { m.g.rotation.y = Math.atan2(dx, dz); return [dx / dd, dz / dd, dd > 8 ? 5.5 : 3.4]; }
  return [0, 0, 0];
}
{ const w1 = wildAI; wildAI = function (m, d, dt, dist, t) { if (m.type === 'guard') return guardAI(m, d, dt, dist); return w1(m, d, dt, dist, t); }; }
let crewT = 0;
function updateCrew(dt) {
  const v = V13(), pp = player.pos;
  // runners: sell from their stock over time (even while you're away), small chance of getting busted
  for (const r of [...v.crew]) {
    if (r.kind !== 'runner' || !r.post) continue;
    r.t = (r.t ?? 20 + Math.random() * 20) - dt;
    if (r.t <= 0) {
      r.t = 25 + Math.random() * 20;
      const id = Object.keys(r.stock).find(k => r.stock[k] > 0);
      if (id) {
        const p = Math.max(3, Math.round(itemValue(id) * (0.75 + Math.random() * 0.3))); r.stock[id]--; if (!r.stock[id]) delete r.stock[id];
        r.cash += p; r.sold++; kpStat('crewSale');
        if (canHurtPlayer() && Math.random() < 0.03 + (wantedLvl >= 3 ? 0.04 : 0)) { fireCrew(r.id, true); kpToast(`🚔 Your runner ${r.name} got busted on the corner! Lost ${stockN(r)} drugs and 💵${Math.floor(r.cash)}`); continue; }
        if (!stockN(r)) kpToast(`🧍 ${r.name} sold out. 💵${Math.floor(r.cash)} waiting for you on the corner`);
      }
    }
  }
  crewT -= dt; if (crewT > 0) return; crewT = 0.5;
  for (const r of v.crew) {
    let m = crewMob(r.id);
    if (r.kind === 'runner') {
      if (!r.post) { if (m) removeMob(m, false); continue; }
      const d = Math.hypot(r.post.x - pp.x, r.post.z - pp.z);
      if (!m && d < 70 && data.has(ckey(fdiv(r.post.x, CH), fdiv(r.post.z, CH)))) { m = spawnMob('runner', r.post.x + 0.5, groundNear(r.post.x + 0.5, r.post.y + 2, r.post.z + 0.5), r.post.z + 0.5, r.id); if (m) { m.crewId = r.id; m.home = new THREE.Vector2(r.post.x + 0.5, r.post.z + 0.5); } }
      if (m) { m.wait = 5; m.target = null; if (Math.hypot(m.g.position.x - r.post.x - 0.5, m.g.position.z - r.post.z - 0.5) > 4) m.target = new THREE.Vector2(r.post.x + 0.5, r.post.z + 0.5), m.wait = 0; }
    } else {
      const away = player.car || player.horse || jail || court || !player.alive;
      if (away) { if (m) removeMob(m, false); continue; }
      if (!m) { const a = player.yaw, x = pp.x + Math.sin(a) * 2.5, z = pp.z + Math.cos(a) * 2.5; if (data.has(ckey(fdiv(Math.floor(x), CH), fdiv(Math.floor(z), CH)))) { m = spawnMob('guard', x, groundNear(x, pp.y + 2, z), z, r.id); if (m) m.crewId = r.id; } }
    }
  }
}

// ======================= 5. COURT & LAWYERS =======================
let court = null;
const LAWYER = [0, 80, 220, 450, 800, 1300, 1900];
function courtCase() {
  const c = court, sev = Math.min(6, c.lvl + (c.drugs > 0 ? 1 : 0));
  return { sev, sentence: Math.min(210, 30 + 30 * sev), lawyer: LAWYER[sev], bail: 40 + sev * 70, dismiss: sev <= 2 ? 0.8 : sev <= 4 ? 0.5 : 0.3 };
}
{ const ar2 = arrest; arrest = function () {
  if (jail || court) return;
  if (!canHurtPlayer() || odBusy) return ar2();
  if (uiOpen) closePanels();
  if (player.car) exitCar(); if (player.horse) dismountHorse();
  const lvl = Math.max(1, Math.min(5, wantedLvl || 1)), drugs = state.slots.reduce((s, x) => s + (x && ILLEGAL.has(x.id) ? x.n : 0), 0);
  wanted = 0; wantedLvl = 0; player.stunned = 0; player.vel.set(0, 0, 0); heist = null;
  court = { lvl, drugs, prev: window.__freeze, ar: ar2 }; window.__freeze = true;
  openKp('court'); beep(200, 0.5, 'square', 0.06); toast('⚖️ Busted! You\'re going in front of the judge...');
}; }
{ const cp0 = closePanels; closePanels = function () { try { cp0(); } finally { if (court && !court.busy) courtVerdict('sentence'); } }; }   // closing the court screen = take the sentence
const safeClose = () => { try { closePanels(); } catch (e) { uiOpen = false; } };
function courtEnd() { const c = court; court = null; window.__freeze = c.prev; return c; }
function courtVerdict(kind) {
  if (!court || court.busy) return false;
  const cs = courtCase();
  if (kind === 'lawyer') {
    if (!payAny(cs.lawyer, false)) { toast(`💸 The lawyer wants 💰${cs.lawyer} up front`); return false; }
    court.busy = true; safeClose(); const c = courtEnd();
    if (Math.random() < cs.dismiss) {
      if (V12().job && count('plug_package')) failJob('🚔 The cops kept the package. Job failed');
      kpStat('dismissed'); setTimeout(() => toast('⚖️ CASE DISMISSED! Your lawyer tore the cops apart. You walk free'), 300); coinSnd(); return 'dismissed';
    }
    const sec = Math.round(cs.sentence * 0.4); c.ar(); if (jail) jail.until = state.gameTime + sec;
    setTimeout(() => toast(`⚖️ Plea deal: your lawyer got it down to ${sec}s in prison`), 300); return 'reduced';
  }
  if (kind === 'bail') {
    if (!payAny(cs.bail, false)) { toast(`💸 Bail is 💰${cs.bail}`); return false; }
    court.busy = true; safeClose(); courtEnd();
    confiscate(); let n = 0; for (let i = 0; i < 36; i++) { const s = state.slots[i]; if (s && ILLEGAL.has(s.id)) { n += s.n; state.slots[i] = null; } } renderHotbar();
    if (V12().job && count('plug_package')) failJob('🚔 The cops kept the package. Job failed');
    setTimeout(() => toast(`💵 Bail posted (💰${cs.bail}). Guns${n ? ` and ${n} drugs` : ''} stay in evidence. You're free`), 300); return 'bail';
  }
  court.busy = true; safeClose(); const c = courtEnd(); c.ar();
  if (jail) { jail.until = state.gameTime + cs.sentence; setTimeout(() => toast(`🔒 Sentenced to ${cs.sentence}s in prison... or break the bars and escape`), 300); }
  return 'sentence';
}
function courtHTML() {
  const cs = courtCase(), c = court;
  return `<h2>⚖️ Court · The People vs. You</h2><div class="ksub">Charges: ${'★'.repeat(c.lvl)} wanted${c.drugs ? ` · 💊 possession (${c.drugs} drugs on you)` : ''}</div>${balHTML()}
    <button class="btn kbig gold" data-kp="court:lawyer" ${cashTotal() >= cs.lawyer ? '' : 'disabled'}>🧑‍💼 Hire a lawyer · 💰${cs.lawyer}<br><span style="font-size:12px;opacity:.85">${Math.round(cs.dismiss * 100)}% case dismissed, otherwise ${Math.round(cs.sentence * 0.4)}s instead of ${cs.sentence}s. Keep your stuff.</span></button>
    <button class="btn kbig" data-kp="court:bail" ${cashTotal() >= cs.bail ? '' : 'disabled'}>💵 Post bail · 💰${cs.bail}<br><span style="font-size:12px;opacity:.85">Walk out now. Guns and drugs stay in evidence.</span></button>
    <button class="btn kbig" data-kp="court:sentence">🔒 Take the sentence · ${cs.sentence}s in prison<br><span style="font-size:12px;opacity:.85">Your stuff comes back when you're out (or break out).</span></button>`;
}

// ======================= 6. DRUG LAB =======================
const COOK = {
  meth: { n: '🧊 Meth', need: { fertilizer: 1, gunpowder: 1, coal: 1, glass: 1 }, out: 3 },
  cocaine: { n: '❄️ Cocaine', need: { leaves: 4, gunpowder: 1 }, out: 2 },
  crack: { n: '🪨 Crack', need: { cocaine: 1, coal: 1 }, out: 3 },
};
const COOK_T = 12;
let cook = null;
const canCook = id => Object.entries(COOK[id].need).every(([k, n]) => count(k) >= n);
function openLab(x, y, z) { kpLab = { x, y, z }; openKp('lab'); }
function startCook(id) {
  if (cook || !COOK[id] || !kpLab) return false;
  if (!canCook(id)) { toast(`⚗️ Missing ingredients for ${COOK[id].n}`); return false; }
  for (const [k, n] of Object.entries(COOK[id].need)) take(k, n);
  cook = { id, t: 0, heat: 30, vel: 0, zone: 0, over: 0, lab: { ...kpLab } }; renderKp(); beep(300, 0.1, 'sine', 0.05);
  return true;
}
function cookTap(dir) { if (!cook) return; cook.heat = Math.max(0, Math.min(100, cook.heat + dir * 11)); cook.vel *= 0.3; beep(dir > 0 ? 500 : 300, 0.04, 'sine', 0.04); }
function finishCook() {
  const c = cook; cook = null;
  const purity = Math.max(20, Math.min(99, Math.round(30 + 69 * c.zone / COOK_T)));
  const boom = Math.min(0.6, 0.03 + c.over * 0.12);
  if (Math.random() < boom) {
    if (kpShown()) closePanels();
    const { x, y, z } = c.lab, hurt = canHurtPlayer();
    blast(x + 0.5, y + 0.5, z + 0.5, { r: 2, dmg: hurt ? 10 : 0, fire: hurt ? 2 : 0, blocks: hurt });
    kpStat('labBoom'); setTimeout(() => toast(`💥 The lab EXPLODED! ${hurt ? 'The batch is gone (and so is the lab)' : 'The batch is gone (Peaceful: nobody got hurt)'}`), 200);
    return { boom: true, purity };
  }
  const grade = purity >= 90 ? '_prime' : purity >= 70 ? '_pure' : '', out = c.id + grade, n = COOK[c.id].out;
  give(out, n); kpStat('cook'); if (grade === '_prime') kpStat('prime');
  const v = V13(); v.lastPurity = purity;
  toast(`⚗️ Cooked ${n}× ${ITEMS[out].name} · purity ${purity}%${grade ? ` (sells ×${PURITY_MULT[grade.slice(1)]})` : ' (street grade)'}`); coinSnd();
  if (kpShown() && kpMode === 'lab') renderKp();
  return { boom: false, purity, out };
}
function updateCook(dt) {
  if (!cook) return;
  if (!(kpShown() && kpMode === 'lab')) { cook = null; toast('🔥 You walked away from the stove... the batch burned'); return; }
  const c = cook; c.t += dt;
  c.vel += (Math.random() - 0.42) * 70 * dt; c.vel = Math.max(-10, Math.min(18, c.vel)); c.heat = Math.max(0, Math.min(100, c.heat + (c.vel + 4) * dt));
  if (c.heat >= 45 && c.heat <= 65) c.zone += dt;
  if (c.heat > 88) c.over += dt;
  const nd = document.getElementById('labNeedle'), pr = document.getElementById('labProg'), st = document.getElementById('labState');
  if (nd) nd.style.left = `calc(${c.heat}% - 2px)`; if (pr) pr.style.width = Math.min(100, c.t / COOK_T * 100) + '%';
  if (st) st.textContent = `${c.heat > 88 ? '🔥 TOO HOT! It could blow!' : c.heat >= 45 && c.heat <= 65 ? '✅ Perfect temperature' : c.heat < 45 ? '❄️ Too cold' : '🌡️ Getting hot'} · purity so far ${Math.round(30 + 69 * c.zone / COOK_T)}%`;
  if (c.t >= COOK_T) finishCook();
}
function labHTML() {
  if (cook) return `<h2>⚗️ Cooking ${COOK[cook.id].n}</h2><div class="ksub">Keep the needle in the 🟩 green zone. Too hot (🟥) and it might blow up.</div>
    <div class="gauge"><div class="needle" id="labNeedle" style="left:calc(${cook.heat}% - 2px)"></div></div><div class="prog"><i id="labProg" style="width:0"></i></div>
    <div class="kres" id="labState" style="font-size:15px"></div><div style="display:flex;gap:10px"><button class="btn kbig" style="text-align:center" data-kp="cool">❄️ Cool</button><button class="btn kbig gold" style="text-align:center" data-kp="heat">🔥 Heat</button></div>`;
  const v = V13();
  return `<h2>⚗️ Drug Lab</h2><div class="ksub">Pick a recipe, then work the stove for ${COOK_T}s. Purity 70%+ = Pure (×1.6 price), 90%+ = top shelf (×2.5). Small chance it explodes.${v.lastPurity ? ` Last batch: ${v.lastPurity}%` : ''}</div>` +
    Object.entries(COOK).map(([id, r]) => `<div class="krow"><span class="nm"><b>${r.n} ×${r.out}</b><br><span style="font-size:12px;opacity:.75">${Object.entries(r.need).map(([k, n]) => `${n}× ${ITEMS[k].name} (${count(k)})`).join(' · ')}</span></span><button class="btn gold" data-kp="cook:${id}" ${canCook(id) ? '' : 'disabled'}>Cook</button></div>`).join('');
}

// ======================= 7. CASINO: slots, blackjack, roulette =======================
const HOUSE_CUT = 0.1, BETS = [10, 50, 100, 250, 500];
const cas = { game: 'slots', bet: 50, bj: null, last: '', reels: ['🍒', '🔔', '7️⃣'] };
const SLOT_SYM = ['🍒', '🍒', '🍒', '🍋', '🍋', '🍋', '🔔', '🔔', '💵', '💵', '💎', '7️⃣'];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function casBet() { if (!payAny(cas.bet, true)) { cas.last = '💸 Not enough cash for that bet'; return false; } return true; }
function casPay(gross, msg) {   // winnings are paid out CLEAN, minus the house cut
  const net = Math.floor(gross * (1 - HOUSE_CUT));
  if (net > 0) { state.coins += net; if (net > cas.bet) state.earned += net - cas.bet; coinSnd(); }
  if (gross > cas.bet) kpStat('casinoWin');
  cas.last = msg + (net > 0 ? ` · +💰${net} clean` : ''); renderStats(); return net;
}
function playSlots() {
  if (!casBet()) return null;
  const r = [0, 1, 2].map(() => SLOT_SYM[Math.floor(Math.random() * SLOT_SYM.length)]); cas.reels = r;
  const same = r[0] === r[1] && r[1] === r[2], cher = r.filter(s => s === '🍒').length;
  let mult = 0;
  if (same) mult = { '7️⃣': 25, '💎': 12, '💵': 8, '🔔': 6, '🍋': 4, '🍒': 5 }[r[0]];
  else if (cher === 2) mult = 2; else if (cher === 1) mult = 0.5;
  if (same && r[0] === '7️⃣') kpStat('jackpot');
  for (let i = 0; i < 3; i++) setTimeout(() => beep(600 + i * 200, 0.05, 'square', 0.04), i * 90);
  casPay(cas.bet * mult, mult >= 25 ? '7️⃣7️⃣7️⃣ JACKPOT!!!' : mult > 1 ? `🎉 Winner ×${mult}` : mult > 0 ? '🍒 Cherry: half back' : '😬 No luck');
  return mult;
}
const card = () => 1 + Math.floor(Math.random() * 13), cardTxt = c => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c - 1];
function bjVal(h) { let s = 0, a = 0; for (const c of h) { s += c === 1 ? 11 : Math.min(10, c); if (c === 1) a++; } while (s > 21 && a) { s -= 10; a--; } return s; }
function bjDeal() {
  if (cas.bj && !cas.bj.done) return false; if (!casBet()) return false;
  cas.bj = { p: [card(), card()], d: [card(), card()], done: false }; cas.last = '';
  if (bjVal(cas.bj.p) === 21) bjEnd();
  return true;
}
function bjHit() { const b = cas.bj; if (!b || b.done) return; b.p.push(card()); if (bjVal(b.p) > 21) { b.done = true; casPay(0, `💥 Bust (${bjVal(b.p)})`); } else if (bjVal(b.p) === 21) bjEnd(); }
function bjEnd() {
  const b = cas.bj; if (!b || b.done) return; b.done = true;
  while (bjVal(b.d) < 17) b.d.push(card());
  const p = bjVal(b.p), d = bjVal(b.d), natural = p === 21 && b.p.length === 2;
  if (natural && !(d === 21 && b.d.length === 2)) casPay(cas.bet * 2.5, '🂡 BLACKJACK!');
  else if (d > 21 || p > d) casPay(cas.bet * 2, `🎉 You win ${p} vs ${d}`);
  else if (p === d) casPay(cas.bet, `🤝 Push ${p} vs ${d}`);
  else casPay(0, `😬 Dealer wins ${d} vs ${p}`);
}
function playRoulette(pick) {
  if (!casBet()) return null;
  const n = Math.floor(Math.random() * 37), col = n === 0 ? 'green' : RED.has(n) ? 'red' : 'black', e = { red: '🔴', black: '⚫', green: '🟢' }[col];
  const win = pick === col, mult = win ? (col === 'green' ? 18 : 2) : 0;
  casPay(cas.bet * mult, `${e} ${n} ${col.toUpperCase()}${win ? ' · you win!' : ''}`);
  return { n, col, win };
}
function casinoHTML() {
  let h = `<h2>🎰 Casino</h2><div class="ksub">Bets come out of 💵 dirty cash first. Wins pay out 💰 clean, minus a ${HOUSE_CUT * 100}% house cut. (Laundering with extra steps.)</div>${balHTML()}
    <div class="ktabs">${[['slots', '🎰 Slots'], ['bj', '🂡 Blackjack'], ['roul', '🎡 Roulette']].map(([k, n]) => `<button class="btn ${cas.game === k ? 'gold' : ''}" data-kp="game:${k}">${n}</button>`).join('')}</div>
    <div class="ktabs">Bet: ${BETS.map(b => `<button class="btn ${cas.bet === b ? 'gold' : ''}" data-kp="bet:${b}" ${cas.bj && !cas.bj.done && cas.game === 'bj' ? 'disabled' : ''}>${b}</button>`).join('')}</div>`;
  if (cas.game === 'slots') h += `<div class="reels">${cas.reels.join('')}</div><button class="btn kbig gold" style="text-align:center" data-kp="spin">🎰 Spin (${cas.bet})</button><div class="ksub">7️⃣7️⃣7️⃣ ×25 · 💎💎💎 ×12 · 💵💵💵 ×8 · 🔔🔔🔔 ×6 · 🍒🍒🍒 ×5 · 🍋🍋🍋 ×4 · 🍒🍒 ×2</div>`;
  if (cas.game === 'bj') {
    const b = cas.bj;
    if (b) h += `<div class="cards">Dealer: ${b.done ? b.d.map(cardTxt).join(' ') + ` (${bjVal(b.d)})` : cardTxt(b.d[0]) + ' 🂠'}</div><div class="cards">You: ${b.p.map(cardTxt).join(' ')} (${bjVal(b.p)})</div>`;
    h += b && !b.done ? '<div style="display:flex;gap:10px"><button class="btn kbig gold" style="text-align:center" data-kp="hit">➕ Hit</button><button class="btn kbig" style="text-align:center" data-kp="stand">✋ Stand</button></div>'
      : `<button class="btn kbig gold" style="text-align:center" data-kp="deal">🂡 Deal (${cas.bet})</button><div class="ksub">Win ×2 · Blackjack ×2.5 · Push = bet back. Dealer stands on 17.</div>`;
  }
  if (cas.game === 'roul') h += `<div style="display:flex;gap:8px"><button class="btn kbig" style="text-align:center;background:#b02020" data-kp="roul:red">🔴 Red ×2</button><button class="btn kbig" style="text-align:center;background:#222" data-kp="roul:black">⚫ Black ×2</button><button class="btn kbig" style="text-align:center;background:#1a8a3a" data-kp="roul:green">🟢 Zero ×18</button></div>`;
  return h + `<div class="kres">${cas.last}</div>`;
}

// ---- panel rendering + clicks
function renderKp() {
  const b = document.getElementById('kpBox'); let h = '';
  if (kpMode === 'pawn') h = pawnHTML(); else if (kpMode === 'garage') h = garageHTML(); else if (kpMode === 'casino') h = casinoHTML();
  else if (kpMode === 'lab') h = labHTML(); else if (kpMode === 'court' && court) h = courtHTML(); else if (kpMode === 'home') { const hm = homeById(kpVenue); h = hm ? homeHTML(hm) : ''; }
  b.innerHTML = (kpMode === 'court' ? '' : '<button class="btn close" data-kpx="1" style="float:right">✕</button>') + h;
}
kpEl.addEventListener('pointerdown', e => { if (e.target === kpEl && kpMode !== 'court') closePanels(); });
kpEl.addEventListener('click', e => {
  if (e.target.closest('[data-kpx]')) { closePanels(); return; }
  const b = e.target.closest('[data-kp]'); if (!b || b.disabled) return;
  const [a, arg] = b.dataset.kp.split(':');
  if (a === 'pawn1' || a === 'pawnA') pawnSell(arg, a === 'pawnA');
  else if (a === 'paint') buyMod('paint', +arg); else if (a === 'mod') buyMod(arg);
  else if (a === 'stash') { const hm = homeById(+arg); if (hm) { openSafe(hm); return; } }
  else if (a === 'spawn') { const v = V13(); v.spawnHome = v.spawnHome === +arg ? null : +arg; toast(v.spawnHome ? '🛏️ You\'ll respawn at this safehouse' : '🛏️ Respawn point back to your bed / the village'); }
  else if (a === 'court') { courtVerdict(arg); if (court) renderKp(); return; }
  else if (a === 'cook') startCook(arg); else if (a === 'heat') { cookTap(1); return; } else if (a === 'cool') { cookTap(-1); return; }
  else if (a === 'game') { if (!(cas.bj && !cas.bj.done)) cas.game = arg; } else if (a === 'bet') cas.bet = +arg;
  else if (a === 'spin') playSlots(); else if (a === 'deal') bjDeal(); else if (a === 'hit') bjHit(); else if (a === 'stand') bjEnd(); else if (a === 'roul') playRoulette(arg);
  if (kpShown()) renderKp();
});

// ======================= interactions: venues, safehouses, lab, deeds, scratch tickets =======================
{ const use13 = useAction; useAction = function () {
  if (!player.alive || odBusy || court) return;
  const id = held();
  if (!uiOpen) {
    const vn = venueNear(player.car ? 7 : 2.8);
    if (vn && (!player.car || vn.kind === 'garage')) { useVenue(vn); return; }
    if (!player.car && !player.horse) {
      const hm = homeNear(); if (hm) { openKp('home', hm.id); return; }
      if (id && HOMES[id]) { moveIn(id); return; }
      if (id === 'scratch_ticket') { useHeld(1); swing(); const r = Math.random(), w = r < 0.6 ? 0 : r < 0.9 ? rint(5, 20) : r < 0.99 ? rint(30, 80) : 500; if (w) addClean(w, `🎟️ Winner! +💰${w}`); else toast('🎟️ Not a winner. Better luck next time'); return; }
      const h = raycast(); if (h && h.kind === 'block' && h.id === LAB) { openLab(h.x, h.y, h.z); return; }
    }
  }
  return use13(); }; }

// ======================= phone apps: 🏆 Goals, 👥 Crew, 🏠 Property =======================
function goalsApp() {
  const v = V13(), dl = dailyToday(), done = ACH.filter(a => v.ach[a[0]]).length;
  return `<div class="pappbar">🏆 Goals <span style="margin-left:auto;font-size:12px;opacity:.8">Day ${dl.day}</span></div><div class="pplug"><h4>📅 Daily challenges</h4>` +
    dl.ids.map(k => { const c = DAILY[k], p = dl.prog[k] || 0; return `<div class="pst">${dl.done[k] ? '✅' : '⬜'} ${c.t}<br><span style="opacity:.8">${Math.min(p, c.n)}/${c.n} · reward 💰${c.cash}${c.item ? ' + ' + ITEMS[c.item[0]].name : ''}</span><div class="pbar"><i style="width:${Math.round(Math.min(1, p / c.n) * 100)}%"></i></div></div>`; }).join('') +
    `<div class="phint" style="margin-top:0">New challenges every in-game day.</div><h4>🏆 Achievements ${done}/${ACH.length}</h4>` +
    ACH.map(([id, n, d]) => `<div class="pst" style="${v.ach[id] ? '' : 'opacity:.55'}">${v.ach[id] ? '✅' : '🔒'} <b>${n}</b><br><span style="font-size:12px">${d}</span></div>`).join('') + '</div>';
}
function crewApp() {
  const v = V13(), nextPay = PAYDAY - ((day() - 1) % PAYDAY);
  let h = `<div class="pappbar">👥 Crew <span style="margin-left:auto;font-size:12px;opacity:.8">payday in ${nextPay}d</span></div><div class="pplug"><div class="bal"><span>💰 ${state.coins}</span><span style="color:#9aff8a">💵 ${dirtyCash()}</span></div>`;
  h += v.crew.length ? v.crew.map(r => {
    const owe = r.unpaid ? ` · <b style="color:#ff8a8a">owed 💵${r.unpaid * CREW[r.kind].wage}</b>` : '';
    if (r.kind === 'runner') return `<div class="pst">🧍 <b>${r.name}</b> · runner${owe}<br>${r.post ? `📍 ${Math.round(Math.hypot(r.post.x - player.pos.x, r.post.z - player.pos.z))} m away · stock ${stockN(r)} · 💵${Math.floor(r.cash)} to collect · sold ${r.sold}` : '💤 No corner yet'}</div><div class="prow"><button class="pst" data-kp13="post:${r.id}">📍 Post here</button>${r.post ? `<button class="pst" data-kp13="wp:${r.id}">🗺️ GPS</button>` : ''}<button class="pst stop" data-kp13="fire:${r.id}">✕ Fire</button></div>`;
    return `<div class="pst">💪 <b>${r.name}</b> · bodyguard${owe}<br>Follows you and fights anyone who comes at you</div><div class="prow"><button class="pst stop" data-kp13="fire:${r.id}">✕ Fire</button></div>`;
  }).join('') : '<div class="pst">Nobody on your crew yet.</div>';
  if (v.crew.some(r => r.unpaid)) h += '<button class="pst" data-kp13="paydebt">💸 Pay what you owe</button>';
  h += `<h4>Hire</h4>${Object.entries(CREW).map(([k, c]) => `<button class="pst" data-kp13="hire:${k}">${c.n} · 💵${c.hire} to hire · 💵${c.wage} every ${PAYDAY} days<br><span style="opacity:.75">${k === 'runner' ? 'Works a corner you pick and sells the drugs you hand them (✋ them while holding drugs). Can get busted.' : 'Follows you on foot and shoots hostiles, gangs and cops that come for you.'}</span></button>`).join('')}
    <div class="phint" style="margin-top:0">Wages come out of 💵 dirty cash first. Skip payday twice and they quit... some snitch.</div></div>`;
  return h;
}
function propertyApp() {
  const v = V13(), car = v.car;
  let h = '<div class="pappbar">🏠 Property</div><div class="pplug"><h4>Safehouses</h4>';
  h += v.homes.length ? v.homes.map(hm => { const d = Math.round(Math.hypot(hm.x - player.pos.x, hm.z - player.pos.z)); return `<div class="pst">${HOMES[hm.kind].n} · ${d} m · 💰${HOMES[hm.kind].rent}/day${v.spawnHome === hm.id ? ' · 🛏️ spawn' : ''}</div><div class="prow"><button class="pst" data-kp13="hspawn:${hm.id}">🛏️ ${v.spawnHome === hm.id ? 'Unset' : 'Spawn'}</button><button class="pst" data-kp13="hwp:${hm.id}">🗺️ GPS</button>${d < 12 ? `<button class="pst" data-kp13="hstash:${hm.id}">📦 Stash</button>` : ''}</div>`; }).join('')
    : '<div class="pst">No property yet. Buy a deed on DealerNet (🌐 Browser › 🏠 Property), then ✋ it where you want to live.</div>';
  h += `<div class="phint" style="margin-top:0">🏢 Apartment 💰1500 (💰60/day) · 🏠 House 💰4000 (💰170/day) · 🌆 Penthouse 💰12000 (💰550/day). Each one: respawn point + raid-proof stash.</div>`;
  h += `<h4>Your ride</h4><div class="pst">${car ? `🚗 ${['nitro', 'armor', 'hidden'].filter(k => car[k]).map(k => MODS[k].n).join(' · ') || '🎨 custom paint'}` : 'No ride yet. Mod a car at a 🔧 Garage in town.'}</div>${car ? '<button class="pst" data-kp13="ride">🔑 Call your ride</button>' : ''}</div>`;
  return h;
}
{ const rp1 = renderPhone; renderPhone = function () {
  rp1();
  const el = document.getElementById('pScreen'); if (!el) return;
  if (phoneApp === 'home') {
    const a = el.querySelector('.papps');
    if (a && !a.querySelector('[data-app="goals"]')) a.insertAdjacentHTML('beforeend', '<button class="papp" data-app="goals"><i style="background:linear-gradient(#ffd84a,#c99a12)">🏆</i>Goals</button><button class="papp" data-app="crew"><i style="background:linear-gradient(#5a5a6a,#22222a)">👥</i>Crew</button><button class="papp" data-app="property"><i style="background:linear-gradient(#4ad0c0,#1a7a8a)">🏠</i>Property</button>');
    return;
  }
  const app = phoneApp === 'goals' ? goalsApp : phoneApp === 'crew' ? crewApp : phoneApp === 'property' ? propertyApp : null;
  if (app) el.innerHTML = phoneStatus() + app();
}; }
phoneEl.addEventListener('click', e => {
  const b = e.target.closest('[data-kp13]'); if (!b) return; const [a, arg] = b.dataset.kp13.split(':'), v = V13();
  if (a === 'hire') hire(arg); else if (a === 'post') postRunner(+arg); else if (a === 'fire') fireCrew(+arg); else if (a === 'paydebt') { if (!payCrew(true)) toast('💸 Not enough cash to pay them'); }
  else if (a === 'wp') { const r = crewById(+arg); if (r && r.post) { state.waypoints.push({ x: r.post.x, z: r.post.z, c: '#ffd23b' }); toast(`🗺️ ${r.name}'s corner is on your GPS`); } }
  else if (a === 'hwp') { const hm = homeById(+arg); if (hm) { state.waypoints.push({ x: hm.x, z: hm.z, c: '#3bff7a' }); toast('🗺️ Safehouse pinned on your GPS'); } }
  else if (a === 'hspawn') { v.spawnHome = v.spawnHome === +arg ? null : +arg; toast(v.spawnHome ? '🛏️ You\'ll respawn at this safehouse' : '🛏️ Respawn point back to your bed / the village'); }
  else if (a === 'hstash') { const hm = homeById(+arg); if (hm) { openSafe(hm); return; } }
  else if (a === 'ride') { closePanels(); spawnMyRide(); return; }
  renderPhone(); beep(990, 0.03, 'sine', 0.04);
});

// ---- HUD line (joins the wanted / prison / Plug line)
{ const rh1 = renderHud4; renderHud4 = function () {
  rh1(); const bits = [];
  if (heist) { const vn = heist.vn; bits.push(`🔫 Robbing ${VENUE[vn.kind].n} · ${Math.min(100, Math.round(heist.t / heist.total * 100))}%${heist.alarm ? ' · 🚨 ALARM' : ''} · stay close`); }
  if (cook) bits.push(`⚗️ Cooking · ${Math.round(cook.heat)}°`);
  const c = player.car; if (c && c.mods && c.mods.nitro) bits.push(nitroT > 0 ? '🔥 NITRO' : `🔥 ${nitroCharge >= 1 ? 'Nitro ready' : 'Nitro ' + Math.round(nitroCharge * 100) + '%'}`);
  if (c && c.mods && c.mods.hidden && count('plug_package')) bits.push('🕳️ Package hidden');
  if (!bits.length) return;
  const extra = bits.join(' &nbsp; '), html = hud4.innerHTML ? hud4.innerHTML + ' &nbsp; ' + extra : extra;
  if (hud4.innerHTML !== html) hud4.innerHTML = html; hud4.style.display = 'block';
}; }

// ---- the per-frame hook (called from the main loop after updateV112)
let achT = 2;
function updateV113(dt, t) {
  if (!playing) return;
  const v = V13();
  const d = day();
  if (d > v.lastDay) { const n = d - v.lastDay; v.lastDay = d; rentDaily(n); for (let k = d - n + 1; k <= d; k++) if (k % PAYDAY === 0) { payCrew(false); break; } }
  else if (d < v.lastDay) v.lastDay = d;
  const rep = V12().rep; if (rep > v.lastRep) kpStat('plug', rep - v.lastRep); v.lastRep = rep;
  updateVenues(dt); updateHeist(dt); updateHomes(); updateCrew(dt); updateCook(dt);
  rideCd = Math.max(0, rideCd - dt);
  if (nitroT > 0) nitroT -= dt; else nitroCharge = Math.min(1, nitroCharge + dt / 12);
  document.body.classList.toggle('kpnitro', !!(player.car && player.car.mods && player.car.mods.nitro));
  const c = player.car; if (c && c.mods && c.mods.hidden && count('plug_package')) plugCopT = Math.max(plugCopT, 0.5);   // hidden compartment: cops can't see the package
  achT -= dt; if (achT <= 0) { achT = 2; checkAch(); }
  kpQT -= dt; if (kpQ.length && kpQT <= 0 && toastT <= 0.4) { toast(kpQ.shift()); kpQT = 2.6; }
}
window.__dc13 = { V13, VENUE, venuesOf, venueMesh, liveVenues, homeById, venueNear, useVenue, startHeist, heistLoot, updateHeist, get heist() { return heist; }, PAWN, pawnSell, pawnPrice,
  MODS, buyMod, garageCar, paintCar, spawnMyRide, fireNitro, get nitroT() { return nitroT; }, set kpLastCar(c) { kpLastCar = c; },
  HOMES, moveIn, homeNear, openSafe, rentDaily, homeSpawn, CREW, hire, postRunner, fireCrew, payCrew, interactCrew, updateCrew, guardFoe, crewById, crewMob,
  courtCase, courtVerdict, get court() { return court; }, COOK, openLab, startCook, cookTap, finishCook, get cook() { return cook; },
  cas, playSlots, bjDeal, bjHit, bjEnd, playRoulette, DAILY, dailyToday, dailyEvent, ACH, checkAch, kpStat, updateV113, openKp, renderKp, payAny, cashTotal, isWeapon,
  get jail() { return jail; }, arrest: () => arrest(), closePanels: () => closePanels(), get playing() { return playing; }, get kpQ() { return kpQ; } };


// ================== v1.14 STORY UPDATE: story mode, boss fights (cartel compound + alien mothership), legit jobs (taxi, pizza, trucker) ==================
// Items/guns are in the v1.14 data block near the top. Everything here grafts onto earlier code by wrapping, like v1.12/v1.13.
// Save data lives in state.v114 (created lazily, so older saves load fine). Runtime things (bosses, job vehicles) are never saved.
// Peaceful (canHurtPlayer() false): bosses, guards and jobs never hurt you; you can still beat the bosses.
function V14() {
  const v = state.v114 || (state.v114 = {});
  if (!v.st || typeof v.st !== 'object') v.st = {};
  const s = v.st; if (typeof s.i !== 'number' || !isFinite(s.i)) s.i = 0; if (!Array.isArray(s.log)) s.log = []; if (s.hud == null) s.hud = true;
  if (!v.jobs) v.jobs = {}; for (const k of ['taxi', 'pizza', 'trucker', 'earned', 'best']) if (typeof v.jobs[k] !== 'number') v.jobs[k] = 0;
  if (!v.boss) v.boss = {}; for (const k of ['ms', 'jefe']) if (typeof v.boss[k] !== 'number') v.boss[k] = 0;
  if (v.boss.msDay == null) v.boss.msDay = -9; if (v.boss.jefeDay == null) v.boss.jefeDay = -9;
  if (v.cmp === undefined) v.cmp = null;
  return v;
}
V14();
if (!INV_KEYS.includes('v114')) INV_KEYS.push('v114');   // online guests carry their story/job progress home like their bag
['gang', 'soldier', 'alien', 'boss'].forEach(c => CREATURE_HIT.add(c));   // peaceful: no enemy gunfire ever lands (they never aim at you there anyway)
Object.assign(RAW_VALUE, { gold_rifle: 2400, ray_gun: 2800, plasma_cell: 6, mothership_core: 1500, kingpin_crown: 2500, pizza_box: 4 });
const WEB_HIDE14 = new Set(['gold_rifle', 'ray_gun', 'mothership_core', 'kingpin_crown', 'pizza_box']);   // boss drops can't be bought, only sold
{ const rw1 = renderWeb; renderWeb = function (keepList) {
  const r = rw1(keepList); if (webTab !== 'buy') return r;
  const bx = (webFromPhone && document.getElementById('pWebBox')) || document.getElementById('webBox');
  if (bx) for (const b of bx.querySelectorAll('[data-wb]')) if (WEB_HIDE14.has(b.dataset.wb)) { const row = b.closest('.row'); if (row) row.remove(); }
  return r;
}; }
const v14css = document.createElement('style');
v14css.textContent = `#stBanner{position:fixed;left:50%;top:34%;transform:translate(-50%,-50%) scale(.9);z-index:40;pointer-events:none;opacity:0;transition:opacity .4s,transform .4s;text-align:center;
background:linear-gradient(#2a2410ee,#120f06ee);border:2px solid #ffd84a;border-radius:14px;padding:12px 22px;color:#fff;text-shadow:0 2px 4px #000;max-width:86vw}
#stBanner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}#stBanner b{display:block;color:#ffd84a;font-size:13px;letter-spacing:2px;text-transform:uppercase}#stBanner span{display:block;font-size:22px;margin:4px 0}#stBanner i{font-style:normal;color:#9aff8a}
.pplug .pmsg{background:rgba(255,255,255,.1);border-radius:12px 12px 12px 3px;padding:7px 10px;font-size:13px;max-width:92%}.pplug .pmsg em{font-style:normal;opacity:.6;font-size:11px;display:block}
.pplug .pmis{border:1px solid #ffd84a;border-radius:10px;padding:8px 10px;background:rgba(255,216,74,.08)}.pplug .pmis b{color:#ffd84a}`;
document.head.appendChild(v14css);
const stBanner = document.createElement('div'); stBanner.id = 'stBanner'; document.body.appendChild(stBanner);
let stBannerT = 0;
function banner(top, mid, low) { stBanner.innerHTML = `<b>${top}</b><span>${mid}</span>${low ? `<i>${low}</i>` : ''}`; stBanner.classList.add('on'); stBannerT = 4; }
const d2 = (x, z) => Math.hypot(x - player.pos.x, z - player.pos.z);
const loaded = (x, z) => data.has(ckey(fdiv(Math.floor(x), CH), fdiv(Math.floor(z), CH)));
function townsFar(r) {   // like townsNear, but scans as many town regions as the radius needs
  const out = [], seen = new Set(), rx = fdiv(fdiv(Math.floor(player.pos.x), CH), TREG), rz = fdiv(fdiv(Math.floor(player.pos.z), CH), TREG), R = Math.ceil(r / (TREG * CH)) + 1;
  for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
    const t = townOf(rx + a, rz + b); if (!t || seen.has(t.id)) continue; seen.add(t.id);
    if (d2((t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2) < r) out.push(t);
  }
  return out.sort((p, q) => d2((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2) - d2((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2));
}
const marks14 = [];
function clearMarks14() { for (const m of marks14) scene.remove(m); marks14.length = 0; state.waypoints = (state.waypoints || []).filter(w => !w.job); }
function mark14(p, col, emo) {
  const g = new THREE.Group(); g.position.set(p.x + 0.5, p.y, p.z + 0.5);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 40, 0.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false, fog: false })); beam.position.y = 20; g.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 6, 20), new THREE.MeshBasicMaterial({ color: col, fog: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  if (emo) { const tag = nameSprite(emo); tag.position.y = 3; g.add(tag); }
  scene.add(g); marks14.push(g); state.waypoints.push({ x: Math.floor(p.x), z: Math.floor(p.z), c: '#' + col.toString(16).padStart(6, '0'), job: true }); return g;
}

// ======================= 1. LEGIT JOBS: 🚕 taxi, 🍕 pizza delivery, 🚚 trucker =======================
// Clean money (💰). Pay grows with the distance, and a fast run adds a tip / bonus. Start from 📱 💼 Jobs or a 📋 Job Board in town.
const JOBS = {
  taxi: { n: '🚕 Taxi Driver', d: 'Pick up fares (🟢) and drive them to their stop (🔴). Faster rides = bigger tips. Keeps going until you end the shift.' },
  pizza: { n: '🍕 Pizza Delivery', d: 'Hop on the scooter with 3 hot pizzas and get each one to the 🔴 house before the timer runs out.' },
  trucker: { n: '🚚 Trucker', d: 'Haul a trailer of cargo to another town. Long hauls pay big, early arrival pays a bonus.' },
};
const CARGO = ['🥬 fresh produce', '📦 DealerNet parcels', '🪵 lumber', '🛢️ fuel drums', '🍕 frozen pizzas', '🐄 cattle feed', '🧱 bricks', '📺 TVs'];
const jobsDone = () => { const j = V14().jobs; return j.taxi + j.pizza + j.trucker; };
let job = null, jobT = 0;
// vehicles: yellow taxi, pizza scooter, semi truck (meshes only; they drive like any car)
{ const bc0 = buildCar; buildCar = function (kind, nPeople) {
  if (kind === 'taxi') {
    const p = bc0('car', nPeople), body = p.g.children[0].material.color.getHex();
    for (const o of p.g.children) if (o.isMesh && o.material !== glassMat && o.material.color && o.material.color.getHex() === body) o.material.color.setHex(0xf2c21a);
    const sign = box(0.62, 0.22, 0.3, 0xfff2a0, 0, 1.58, -0.15, p.g); sign.material.emissive.setHex(0x806a10);
    for (const sx of [-0.87, 0.87]) for (let k = 0; k < 6; k++) box(0.02, 0.1, 0.24, k % 2 ? 0x111111 : 0xf2f2f2, sx, 0.62, -1.2 + k * 0.48, p.g);
    return p;
  }
  if (kind === 'scooter') {
    const g = new THREE.Group(), col = 0xd2302a;
    box(0.55, 0.32, 1.5, col, 0, 0.55, 0, g); box(0.48, 0.14, 0.7, 0x1a1a1a, 0, 0.78, -0.25, g);
    box(0.14, 0.9, 0.14, 0x9a9a9a, 0, 0.98, 0.62, g); box(0.85, 0.08, 0.08, 0x1a1a1a, 0, 1.42, 0.62, g); box(0.5, 0.4, 0.18, col, 0, 0.75, 0.72, g);
    const pb = box(0.62, 0.42, 0.62, 0xd2302a, 0, 1.06, -0.62, g); pb.material.emissive.setHex(0x200000); box(0.64, 0.06, 0.64, 0xf2f2f2, 0, 1.28, -0.62, g);
    for (const wz of [0.62, -0.62]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12), tyreMat); w.rotation.z = Math.PI / 2; w.position.set(0, 0.3, wz); g.add(w); }
    const h = box(0.24, 0.16, 0.04, 0xfff2b0, 0, 0.98, 0.82, g); h.material.emissive.setHex(0xffe080);
    return { g, lights: [], seats: [null, null] };
  }
  if (kind === 'truck') {
    const g = new THREE.Group(), col = [0x2a6ad2, 0xd2302a, 0x3fa34d, 0xf2f2f2][Math.floor(Math.random() * 4)];
    box(1.95, 1.5, 2.1, col, 0, 1.2, 0.2, g); box(1.97, 0.5, 0.9, col, 0, 0.72, 1.6, g);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.05), glassMat); ws.position.set(0, 1.55, 1.27); g.add(ws);
    box(2.0, 2.5, 6.4, 0xe8e8e8, 0, 1.75, -3.35, g); box(2.02, 0.35, 6.42, col, 0, 1.0, -3.35, g); box(1.2, 0.12, 0.6, 0x333333, 0, 0.42, -0.6, g);
    for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -0.6], [0.95, -0.6], [-1.0, -4.8], [1.0, -4.8], [-1.0, -5.8], [1.0, -5.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), tyreMat); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w);
    }
    for (const hx of [-0.65, 0.65]) { const h = box(0.36, 0.18, 0.04, 0xfff2b0, hx, 0.8, 2.06, g); h.material.emissive.setHex(0xffe080); const t = box(0.3, 0.16, 0.04, 0xd01010, hx * 1.3, 0.75, -6.56, g); t.material.emissive.setHex(0x600000); }
    box(0.12, 1.2, 0.12, 0x9a9a9a, 0.85, 2.3, -0.75, g);
    return { g, lights: [], seats: [null, null] };
  }
  return bc0(kind, nPeople);
}; }
// the truck: slower top speed and a camera pulled back over the trailer
{ const dc2 = driveCar; driveCar = function (c, dt) {
  dc2(c, dt); if (player.car !== c || c.kind !== 'truck') return;
  c.speed = Math.max(-4, Math.min(11, c.speed));
  const f = new THREE.Vector3(c.x, c.y + 1.6, c.z), dv = camera.position.clone().sub(f); dv.y = 0;
  if (dv.lengthSq() < 0.01) dv.set(-Math.sin(c.head), 0, -Math.cos(c.head)); dv.normalize();
  camera.position.set(f.x + dv.x * 12, f.y + 5.5, f.z + dv.z * 12); camera.lookAt(f.x - dv.x * 4, f.y, f.z - dv.z * 4);
}; }
const roadVeh = c => c && cars.includes(c) && !c.vessel && !c.air && c.kind !== 'police';
function jobVehicle(kind, t) {
  const c0 = player.car;
  if (kind === 'taxi' && roadVeh(c0) && c0.kind !== 'scooter' && c0.kind !== 'truck') return c0;
  if (kind === 'pizza' && roadVeh(c0) && c0.kind !== 'truck') return c0;
  if (kind === 'trucker' && c0 && c0.kind === 'truck') return c0;
  if (player.car) exitCar();
  const vk = kind === 'taxi' ? 'taxi' : kind === 'pizza' ? 'scooter' : 'truck';
  const a = player.yaw, back = vk === 'truck' ? 7 : 4, x = player.pos.x - Math.sin(a) * back, z = player.pos.z - Math.cos(a) * back;
  const c = spawnCar(t, { kind: vk, people: 0, x, z, head: a + Math.PI });
  c.y = Math.floor(player.pos.y) + 1; snapCarGround(c); c.jobVeh = true;
  return c;
}
function houseSpot(t, avoid) {
  const nb = t.nb || 3, vs = venuesOf(t);
  for (let k = 0; k < 40; k++) {
    const i = rint(0, nb - 1), j = rint(0, nb - 1); if (t.type !== 'city' && !t.metro && i === 1 && j === 1) continue;
    const x = t.x0 + i * 16 + rint(5, 11), z = t.z0 + j * 16 + 4;
    if (vs.some(v => Math.hypot(v.x - x, v.z - z) < 4)) continue;
    if (avoid && (Math.hypot(avoid.x - x, avoid.z - z) < 25 || (k < 30 && Math.hypot(avoid.x - x, avoid.z - z) > 100))) continue;
    return { x, y: t.base + 1, z, t: t.id };
  }
  return roadSpot(t);
}
function canJob() {
  if (!playing || !player.alive) return false;
  if (jail) { toast('🔒 No jobs from a prison cell'); return false; }
  if (court) return false;
  if (job) { toast(`💼 You're already on a ${JOBS[job.kind].n} shift (end it in 📱 💼 Jobs)`); return false; }
  return true;
}
function startJob(kind) {
  if (!JOBS[kind] || !canJob()) return false;
  const t = townsFar(240)[0]; if (!t) { toast('💼 Jobs are in towns and cities. Get closer to one first'); return false; }
  if (kind === 'pizza' && give('pizza_box', 3) > 0) { take('pizza_box', count('pizza_box')); toast('🍕 Make room in your bag for 3 pizzas'); return false; }
  let dest = null;
  if (kind === 'trucker') {
    const tc = [(t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2], far = townsFar(700).filter(o => o.id !== t.id).map(o => [o, Math.hypot((o.x0 + o.x1) / 2 - tc[0], (o.z0 + o.z1) / 2 - tc[1])]);
    const pick = far.filter(([, d]) => d >= 150), cand = pick.length ? pick : far.filter(([, d]) => d >= 80);
    if (!cand.length) { toast('🚚 No other town close enough to haul to. Try from a different town'); return false; }
    dest = cand[rint(0, cand.length - 1)][0];
  }
  const veh = jobVehicle(kind, t);
  job = { kind, t, veh, stage: 'start', n: 0, made: 0, onTime: 0, outT: 0, dest };
  if (kind === 'taxi') nextFare();
  if (kind === 'pizza') { job.left = 3; nextPizza(); }
  if (kind === 'trucker') {
    const b = roadSpot(dest), d = d2(b.x, b.z);
    Object.assign(job, { stage: 'haul', b, d: Math.round(d), limit: Math.round(40 + d / 6), until: state.gameTime + Math.round(40 + d / 6), pay: Math.min(420, Math.round(50 + d * 0.75)), cargo: CARGO[rint(0, CARGO.length - 1)] });
    clearMarks14(); mark14(b, 0xff3b3b, '🚚 Drop-off');
    toast(`🚚 Haul ${job.cargo} ${job.d} m to the 🔴 drop-off in ${job.limit}s · 💰${job.pay}+ bonus`);
  }
  beep(880, 0.06, 'triangle', 0.05); setTimeout(() => beep(1180, 0.06, 'triangle', 0.05), 120);
  if (veh !== player.car) setTimeout(() => toast(kind === 'pizza' ? '🛵 Your scooter is right behind you. ✋ it to ride' : kind === 'taxi' ? '🚕 Your cab is right behind you. ✋ it to drive' : '🚚 Your truck is right behind you. ✋ the cab to drive'), 2300);
  kpStat('jobStart'); return true;
}
function nextFare() {
  const t = job.t; let a = roadSpot(t);
  for (let k = 0; k < 10 && d2(a.x, a.z) < 18; k++) a = roadSpot(t);
  Object.assign(job, { stage: 'pickup', a, fare: null, pmesh: null }); clearMarks14(); mark14(a, 0x3bff7a, '🙋 Fare');
}
function spawnFare() {
  const a = job.a; if (!loaded(a.x, a.z) || d2(a.x, a.z) > 75) return;
  let y = a.y; while (y < a.y + 4 && solid(get(a.x, y, a.z))) y++;
  const m = spawnMob('ped', a.x + 0.5, y, a.z + 0.5); if (!m) return;
  m.fare = true; m.home = new THREE.Vector2(a.x, a.z); m.wait = 1e9; job.fare = m;
}
function pickUp() {
  const t = job.t, others = townsFar(260).filter(o => o.id !== t.id);
  const to = others.length && Math.random() < 0.35 ? others[0] : t;
  let b = roadSpot(to); for (let k = 0; k < 14 && d2(b.x, b.z) < 40; k++) b = roadSpot(to);
  const d = d2(b.x, b.z);
  if (job.fare && mobs.includes(job.fare)) removeMob(job.fare, false); job.fare = null;
  const c = job.veh; if (c && c.g) { job.pmesh = personMesh(); job.pmesh.position.set(-0.38, 0.95, -0.15); c.g.add(job.pmesh); }
  Object.assign(job, { stage: 'drop', b, d: Math.round(d), limit: Math.round(14 + d / 5.5), until: state.gameTime + Math.round(14 + d / 5.5), pay: Math.round(12 + d * 0.32) });
  clearMarks14(); mark14(b, 0xff3b3b, '🏁 Stop');
  toast(`🙋 "${['Downtown, please', 'Take me home', 'I\'m late, step on it!', 'Follow the GPS, driver', 'Airport... kidding, just here'][rint(0, 4)]}" · ${job.d} m · ${job.limit}s for a tip`); beep(660, 0.05, 'sine', 0.05);
}
function payJob(base, frac, what) {
  const v = V14(), tip = Math.max(0, Math.min(job.kind === 'trucker' ? 500 - base : 1e9, Math.round(base * 0.6 * frac))), total = base + tip;   // round 2: a haul pays 500 max
  addClean(total, `${what} +💰${base}${tip ? ` +💰${tip} ${job.kind === 'trucker' ? 'early bonus' : 'tip'}` : ''}`);
  v.jobs[job.kind]++; v.jobs.earned += total; v.jobs.best = Math.max(v.jobs.best, total); job.made += total; job.n++; if (frac > 0) job.onTime++;
  kpStat('job'); kpStat(job.kind === 'taxi' ? 'fares' : job.kind === 'pizza' ? 'pizzas' : 'hauls');
  coinSnd(); return total;
}
function nextPizza() {
  if (job.left <= 0) { const bonus = job.onTime >= 3 ? 25 : 0; if (bonus) addClean(bonus, '🍕 All 3 on time! Shift bonus +💰25'); endJob(`🍕 Shift done: ${job.n} delivered · 💰${job.made + bonus} earned`); return; }
  const from = job.b || { x: player.pos.x, z: player.pos.z }, b = houseSpot(job.t, from), d = d2(b.x, b.z);
  Object.assign(job, { stage: 'drop', b, d: Math.round(d), limit: Math.round(18 + d / 4.5), until: state.gameTime + Math.round(18 + d / 4.5), pay: Math.round(10 + d * 0.3) });
  clearMarks14(); mark14(b, 0xff3b3b, '🍕 Customer');
  toast(`🍕 Pizza ${4 - job.left}/3 · deliver to the 🔴 house ${job.d} m away in ${job.limit}s`);
}
function endJob(msg) {
  if (!job) return; const j = job; job = null;
  if (j.fare && mobs.includes(j.fare)) removeMob(j.fare, false);
  if (j.pmesh && j.pmesh.parent) j.pmesh.parent.remove(j.pmesh);
  clearMarks14(); if (msg) toast(msg);
}
function atSpot(p, rFoot, rCar) { const r = player.car ? rCar : rFoot; return d2(p.x + 0.5, p.z + 0.5) < r && Math.abs(player.pos.y - p.y) < 5; }
function updateJob(dt) {
  jobT += dt; for (const g of marks14) g.children[1] && (g.children[1].rotation.z += dt * 2);
  if (!job) return;
  if (!player.alive || jail) { endJob('💼 Shift over'); return; }
  const c = job.veh, left = job.until != null ? job.until - state.gameTime : 0;
  if (job.kind !== 'pizza') {
    if (!c || !cars.includes(c)) { endJob(job.kind === 'trucker' ? '🚚 You left the truck behind. Haul failed' : '🚕 You lost your cab. Shift over'); return; }
    if (player.car !== c) { job.outT += dt; if (job.outT > 45) { endJob(job.kind === 'trucker' ? '🚚 You walked off the job. Haul failed' : '🚕 You left the cab too long. Shift over'); return; } } else job.outT = 0;
  }
  if (job.kind === 'taxi') {
    if (job.stage === 'pickup') {
      if (!job.fare || !mobs.includes(job.fare)) { job.fare = null; spawnFare(); }
      else { job.fare.wait = 1e9; job.fare.target = null; }
      if (player.car === c && job.fare && job.fare.g.position.distanceTo(player.pos) < 6 && Math.abs(c.speed) < 4) pickUp();
      return;
    }
    if (job.stage === 'wait') return;
    if (left <= -25) { if (job.pmesh && job.pmesh.parent) job.pmesh.parent.remove(job.pmesh); toast('😤 "Forget it, I\'ll walk!" The fare got out without paying'); beep(160, 0.3, 'sawtooth', 0.05); nextFare(); return; }
    if (player.car === c && atSpot(job.b, 0, 6.5) && Math.abs(c.speed) < 5) {
      if (job.pmesh && job.pmesh.parent) job.pmesh.parent.remove(job.pmesh);
      payJob(job.pay, Math.max(0, left / job.limit), left > 0 ? '🚕 Fare paid!' : '🚕 Fare paid (no tip, too slow)'); setTimeout(() => { if (job && job.kind === 'taxi') nextFare(); }, 1500); job.stage = 'wait';
    }
    return;
  }
  if (job.kind === 'pizza') {
    if (job.stage !== 'drop') return;
    if (left <= 0) { take('pizza_box', 1); job.left--; toast('🥶 Too slow, the pizza went cold. No pay for that one'); beep(160, 0.3, 'sawtooth', 0.05); nextPizza(); return; }
    if (atSpot(job.b, 3.5, 6.5)) {
      if (!count('pizza_box')) { endJob('📦 No pizza left?! Did you eat it? Shift over'); return; }
      take('pizza_box', 1); job.left--; payJob(job.pay, Math.max(0, left / job.limit), `🍕 "${['Thanks!', 'Smells amazing!', 'Keep the change!', 'Finally!'][rint(0, 3)]}"`); nextPizza();
    }
    return;
  }
  if (job.kind === 'trucker') {
    if (player.car === c && atSpot(job.b, 0, 9) && Math.abs(c.speed) < 5) {
      const total = payJob(job.pay, Math.max(0, left / job.limit) * 0.66, `🚚 Delivered ${job.cargo}!`);
      endJob(`🚚 Haul complete · 💰${total}`);
    }
  }
}
{ const ml4 = mobLabel; mobLabel = function (m) { if (m.fare) return '🙋 Your fare · pull up in your cab to pick them up'; return ml4(m); }; }
{ const im4 = interactMob; interactMob = function (m, id, it) { if (m.fare) { toast('🙋 "I\'m waiting for my cab, not you on foot!"'); return true; } return im4(m, id, it); }; }
{ const eat0 = eat; eat = function (id) { if (id === 'pizza_box' && job && job.kind === 'pizza') { toast('🍕 That pizza is for a customer!'); return; } return eat0(id); }; }
function jobsHTML(board) {
  const v = V14(), j = job;
  let h = board ? '<h2>📋 Job Board</h2><div class="ksub">Legit work. Paid in 💰 clean coins. Longer and faster = more money.</div>' : '';
  if (j) {
    const left = j.until != null ? Math.max(0, Math.ceil(j.until - state.gameTime)) : 0;
    const what = j.kind === 'taxi' ? (j.stage === 'pickup' ? '🟢 Pick up the fare' : '🔴 Drive them to their stop') : j.kind === 'pizza' ? `🍕 ${j.left} pizza${j.left === 1 ? '' : 's'} left · 🔴 next house` : `🚚 ${j.cargo} · 🔴 drop-off`;
    h += `<div class="pst pmis"><b>${JOBS[j.kind].n} · on shift</b><br>${what}${j.stage === 'drop' || j.stage === 'haul' ? ` · ${Math.round(d2(j.b.x, j.b.z))} m · ⏱ ${left}s` : ''}<br>Earned this shift 💰${j.made}</div><button class="pst stop" data-kp14="jend">⏹ End shift</button>`;
  } else for (const [k, o] of Object.entries(JOBS)) h += `<button class="pst ${board ? 'btn kbig' : ''}" data-kp14="job:${k}">${o.n}<br><span style="opacity:.75;font-size:12px">${o.d}</span></button>`;
  h += `<div class="phint" style="margin-top:4px">🚕 ${v.jobs.taxi} fares · 🍕 ${v.jobs.pizza} pizzas · 🚚 ${v.jobs.trucker} hauls · 💰${v.jobs.earned} earned · best run 💰${v.jobs.best}</div>`;
  return h;
}

// ======================= 2. BOSS FIGHTS =======================
let cartelAlert = 0;
Object.assign(MOBDEF, {
  cartel: { hp: 22, w: 0.3, h: 1.9, speed: 1.3, hostile: false, ai: true, npc: true, drops: () => [['rifle_ammo', rint(2, 8)], ['pistol_ammo', rint(0, 6)], ['cocaine', Math.random() < 0.25 ? 1 : 0]] },
  jefe: { hp: 260, w: 0.4, h: 2.2, speed: 1.2, hostile: false, ai: true, npc: true, drops: () => [] },
});
Object.assign(MOB_NAMES, { cartel: '🕶️ Cartel guard', jefe: '💀 Don Calavera' });
{ const bm2 = buildMob; buildMob = function (type, v = 0) {
  if (type === 'cartel') {
    const p = humanoid({ shirt: [0x1a1a1a, 0x3a2a1a, 0xf2f2f2][v % 3], sleeve: 0x1a1a1a, skin: [0xc58c63, 0x8d5524, 0xe0ac69][v % 3], pants: 0x2a2a2a });
    box(0.4, 0.07, 0.04, 0x050505, 0, 0.05, 0.25, p.head); box(0.5, 0.1, 0.5, 0x1a1a1a, 0, 0.27, 0, p.head); box(0.3, 0.06, 0.05, 0xf2c21a, 0, 1.3, 0.15, p.g); gunMesh(p.arms[1], true); return p;
  }
  if (type === 'jefe') {
    const p = humanoid({ shirt: 0xf2f2f2, sleeve: 0xf2f2f2, skin: 0xe0ac69, pants: 0xf2f2f2, bw: 0.62 });
    box(0.16, 0.5, 0.04, 0xd01010, 0, 1.18, 0.15, p.g); box(0.62, 0.08, 0.04, 0xf2c21a, 0, 1.42, 0.15, p.g);   // red shirt, gold chain
    box(0.8, 0.06, 0.8, 0x1a1a1a, 0, 0.27, 0, p.head); box(0.5, 0.22, 0.5, 0x1a1a1a, 0, 0.38, 0, p.head);   // black hat
    for (const ex of [-0.1, 0.1]) box(0.12, 0.06, 0.03, 0xffffff, ex, 0.12, 0.24, p.head);                // skull face paint
    box(0.3, 0.05, 0.03, 0xffffff, 0, -0.12, 0.24, p.head); gunMesh(p.arms[1], true).children.forEach(o => o.material && o.material.color.setHex(0xe0b020));
    p.g.scale.setScalar(1.15); return p;
  }
  return bm2(type, v);
}; }
{ const ml5 = mobLabel; mobLabel = function (m) {
  if (m.type === 'cartel') return '🕶️ Cartel guard' + (cartelAlert > 0 && canHurtPlayer() ? ' · 🚨 shooting' : '');
  if (m.type === 'jefe') return `💀 Don Calavera · ${Math.max(0, Math.round(m.hp / m.maxHp * 100))}%`;
  return ml5(m); }; }
function bossShot(m, n, spread) {   // a burst of gunfire at you; only ever called when canHurtPlayer()
  const p = m.g.position, tp = player.pos.clone().setY(player.pos.y + 1.1);
  for (let i = 0; i < n; i++) setTimeout(() => { if (!mobs.includes(m) || !canHurtPlayer() || !player.alive) return; const q = tp.clone(); q.x += (Math.random() - .5) * spread; q.z += (Math.random() - .5) * spread; npcShoot(m, q, null, 'gangster'); }, i * 170);
}
const fakeNades = [];
function lobNade(m) {
  const o = m.g.position.clone().setY(m.g.position.y + 1.8), to = player.pos.clone(), g = new THREE.Mesh(grenGeo, grenMat); g.position.copy(o); scene.add(g);
  fakeNades.push({ g, o, to, t: 0, T: 1.4 }); beep(500, 0.05, 'triangle', 0.05);
}
function updateNades(dt) {
  for (const n of [...fakeNades]) {
    n.t += dt; const k = Math.min(1, n.t / n.T); n.g.position.lerpVectors(n.o, n.to, k); n.g.position.y += Math.sin(k * Math.PI) * 4; n.g.rotation.x += dt * 9;
    if (k >= 1) {
      scene.remove(n.g); fakeNades.splice(fakeNades.indexOf(n), 1); particles(n.to.x, n.to.y + 0.5, n.to.z, new THREE.Color(1, 0.55, 0.15), 18); smokePuff(n.to.x, n.to.y + 0.6, n.to.z, 4, 0x333333);
      noiseBurst(0.5, 0.18, 220); shake(0.35, 0.08);
      const d = player.pos.distanceTo(n.to); if (d < 3.6 && canHurtPlayer()) damage(Math.round((1 - d / 3.6) * 9 * diff().dmg) + 1, 'gang', n.to);
    }
  }
}
function cartelAI(m, d, dt, dist) {
  const p = m.g.position, pp = player.pos; m.shootCd = Math.max(0, (m.shootCd || 0) - dt);
  const c = V14().cmp, inside = c && c.built && pp.x > c.x0 - 1 && pp.x < c.x1 + 1 && pp.z > c.z0 - 1 && pp.z < c.z1 + 1;
  if (canHurtPlayer() && player.alive && !jail && !player.car && (cartelAlert > 0 || inside || dist < 12) && dist < 42) {
    cartelAlert = Math.max(cartelAlert, 8);
    const tp = pp.clone().setY(pp.y + 1.1), dx = tp.x - p.x, dz = tp.z - p.z, dd = Math.hypot(dx, dz) || 1;
    m.g.rotation.y = Math.atan2(dx, dz); m.aim = 0.3;
    const los = m.shootCd <= 0 && lineOfSight(p.clone().setY(p.y + 1.5), tp);
    if (m.type === 'jefe') {
      m.nadeT = (m.nadeT ?? 6) - dt;
      if (los) { m.shootCd = 2.1 / Math.max(0.8, diff().spd); bossShot(m, 3, 1.2); }
      if (m.nadeT <= 0 && dist < 26) { m.nadeT = 8 + Math.random() * 3; lobNade(m); }
    } else if (los && dist < 32) { m.shootCd = 2.7 + Math.random() * 1.3; npcShoot(m, tp, null, 'gangster'); }   // round 2: guards fire a bit slower
    const want = m.type === 'jefe' ? 7 : 10, go = dd > want + 1 ? 1 : dd < want - 2 ? -0.5 : 0, strafe = Math.sin(performance.now() / 700 + m.v) * 0.5;
    if (m.home && Math.hypot(p.x - m.home.x, p.z - m.home.y) > 16) return [(m.home.x - p.x) / 16, (m.home.y - p.z) / 16, 2.5];   // never leaves the compound
    return [(dx / dd) * go - (dz / dd) * strafe * 0.4, (dz / dd) * go + (dx / dd) * strafe * 0.4, m.type === 'jefe' ? 2.4 : 2.9];
  }
  if (m.home) { const hx = m.home.x - p.x, hz = m.home.y - p.z, hd = Math.hypot(hx, hz); if (hd > 2) { m.g.rotation.y = Math.atan2(hx, hz); return [hx / hd, hz / hd, 1.4]; } }
  if (dist < 9) m.g.rotation.y = Math.atan2(pp.x - p.x, pp.z - p.z);
  return [0, 0, 0];
}
{ const w2 = wildAI; wildAI = function (m, d, dt, dist, t) { if (m.type === 'cartel' || m.type === 'jefe') return cartelAI(m, d, dt, dist); return w2(m, d, dt, dist, t); }; }

// ---- cartel compound: chosen far from your builds, outside towns and sites, then built once out of blocks when you get close
let cmpEditCh = null, cmpLive = null;   // cmpLive = { guards: [], jefe, waves } while the fight is loaded
function editChunks() { if (cmpEditCh) return cmpEditCh; cmpEditCh = new Set(); for (const k in state.edits || {}) { const p = k.split(','); cmpEditCh.add(fdiv(+p[0], CH) + ',' + fdiv(+p[2], CH)); } return cmpEditCh; }
function cmpSpotOk(x, z, spread) {
  if (Math.hypot(x - VX, z - VZ) < 90) return false;
  const hs = [], ec = editChunks();
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const px = x + a * 15, pz = z + b * 15;
    if (townAt(Math.floor(px), Math.floor(pz)) || siteAt(px, pz) || ec.has(fdiv(Math.floor(px), CH) + ',' + fdiv(Math.floor(pz), CH))) return false;
    const t = terrainAt(Math.floor(px), Math.floor(pz)); if (t.h <= SEA + 1 || t.wl > t.h || t.h > 40) return false; hs.push(t.h);
  }
  return Math.max(...hs) - Math.min(...hs) <= spread;
}
function cmpEnsure() {
  const v = V14(); if (v.cmp && v.cmp.seed === state.seed) return v.cmp;
  const r = mulberry(Math.floor(state.seed * 7 + day() * 131 + 77));
  for (const spread of [3, 6, 10]) for (let k = 0; k < 70; k++) {
    const a = r() * 6.283, d = 140 + r() * 130, x = Math.floor(player.pos.x + Math.cos(a) * d), z = Math.floor(player.pos.z + Math.sin(a) * d);
    if (!cmpSpotOk(x, z, spread)) continue;
    v.cmp = { x, z, seed: state.seed, built: 0, x0: x - 13, x1: x + 13, z0: z - 13, z1: z + 13 }; return v.cmp;
  }
  return null;
}
const TREEISH = new Set([LOG, LEAVES, SPRUCE, CACTUS, SNOW_LAYER]);
function groundNat(x, z) { x = Math.floor(x); z = Math.floor(z); for (let y = H - 1; y > 0; y--) { const id = get(x, y, z); if (solid(id) && !TREEISH.has(id)) return y + 1; } return G + 1; }   // ground, ignoring trees
function cmpBuild(c) {
  const ok = [[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1], [c.x, c.z]].every(([x, z]) => loaded(x, z)); if (!ok) return false;
  const hs = []; for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) hs.push(groundNat(c.x0 + 2 + a * 5.5, c.z0 + 2 + b * 5.5)); hs.sort((p, q) => p - q);
  const Y = hs[12], S = (x, y, z, id) => { if (get(x, y, z) !== id) setBlock(x, y, z, id, false); };
  for (let x = c.x0; x <= c.x1; x++) for (let z = c.z0; z <= c.z1; z++) {
    const top = groundNat(x, z), any = groundAt(x + 0.5, z + 0.5);
    for (let y = top; y < Y - 1; y++) S(x, y, z, DIRT);
    if (top !== Y || isWater(get(x, Y - 1, z))) S(x, Y - 1, z, GRASS);
    for (let y = Y; y < Math.max(any, Y + 1); y++) if (get(x, y, z) !== AIR) S(x, y, z, AIR);
  }
  // perimeter wall (3 steel + fence on top) with a south gate, corner towers with lamps
  for (let x = c.x0; x <= c.x1; x++) for (const z of [c.z0, c.z1]) { if (z === c.z1 && Math.abs(x - c.x) <= 1) continue; for (let y = 0; y < 3; y++) S(x, Y + y, z, STEEL); S(x, Y + 3, z, FENCE); }
  for (let z = c.z0; z <= c.z1; z++) for (const x of [c.x0, c.x1]) { for (let y = 0; y < 3; y++) S(x, Y + y, z, STEEL); S(x, Y + 3, z, FENCE); }
  for (const [tx, tz] of [[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1]]) { for (let y = 0; y < 6; y++) S(tx, Y + y, tz, STEEL); S(tx, Y + 6, tz, LAMP); }
  // the Don's villa
  const vx0 = c.x - 5, vx1 = c.x + 5, vz0 = c.z0 + 3, vz1 = c.z0 + 11;
  for (let x = vx0; x <= vx1; x++) for (let z = vz0; z <= vz1; z++) {
    const edge = x === vx0 || x === vx1 || z === vz0 || z === vz1;
    S(x, Y - 1, z, PLANKS);
    if (edge) for (let y = 0; y < 4; y++) { const door = z === vz1 && Math.abs(x - c.x) <= 1 && y < 3, win = y === 1 && (x === vx0 || x === vx1) && (z - vz0) % 3 === 1; S(x, Y + y, z, door ? AIR : win ? GLASS : WHITEWALL); }
    S(x, Y + 4, z, ROOF);
  }
  S(c.x - 3, Y, vz0 + 1, CRATE); S(c.x + 3, Y, vz0 + 1, CRATE); S(c.x + 3, Y + 1, vz0 + 1, CRATE); S(c.x - 4, Y + 2, vz0 + 4, LAMP); S(c.x + 4, Y + 2, vz0 + 4, LAMP);
  // courtyard cover
  for (const [x, z, h] of [[c.x - 8, c.z + 4, 2], [c.x + 7, c.z + 3, 1], [c.x - 3, c.z + 8, 1], [c.x + 4, c.z + 9, 2], [c.x - 9, c.z - 5, 1], [c.x + 9, c.z - 6, 2]]) for (let y = 0; y < h; y++) S(x, Y + y, z, CRATE);
  flushDirty(); c.built = 1; c.y = Y; c.boss = [c.x + 0.5, Y, vz0 + 4.5];
  if (typeof netEdit === 'function') {} // edits already went to the room through setBlock
  return true;
}
const jefeHome = () => { const v = V14(), s = curMission(); return (s && s.id === 'kingpin') || (v.boss.jefe > 0 && day() > v.boss.jefeDay); };
function cmpSpawn(c) {
  const live = { guards: [], jefe: null, waves: 0 }, Y = c.y;
  const spots = [[c.x - 7, c.z + 5], [c.x + 7, c.z + 5], [c.x - 9, c.z - 2], [c.x + 9, c.z - 2], [c.x - 3, c.z1 - 2], [c.x + 3, c.z1 - 2]];
  if (settings.difficulty === 'hard' || settings.difficulty === 'insane') spots.push([c.x, c.z + 2], [c.x - 6, c.z0 + 13]);
  for (const [x, z] of spots) { const m = spawnMob('cartel', x + 0.5, Y, z + 0.5, rint(0, 99)); if (m) { m.home = new THREE.Vector2(x, z); m.cmp = true; live.guards.push(m); } }
  if (jefeHome()) {
    const [bx, by, bz] = c.boss, m = spawnMob('jefe', bx, by, bz, 0);
    if (m) { m.maxHp = m.hp = Math.round(MOBDEF.jefe.hp * (settings.difficulty === 'peaceful' ? 1 : diff().hp)); m.home = new THREE.Vector2(bx, bz); m.boss = true; m.cmp = true; live.jefe = m; }
  }
  cmpLive = live; return live;
}
function cmpWave(c, n) {
  for (let i = 0; i < n; i++) { const x = c.x + rint(-2, 2), z = c.z1 + 3 + rint(0, 2), y = groundNear(x + 0.5, c.y + 3, z + 0.5);
    const m = spawnMob('cartel', x + 0.5, y, z + 0.5, rint(0, 99)); if (m) { m.home = new THREE.Vector2(c.x, c.z + 4); m.cmp = true; cmpLive.guards.push(m); } }
  kpToast('📞 Don Calavera: "¡Refuerzos! Get him!" More guards at the gate');
}
let cmpT = 0;
function updateCompound(dt) {
  cartelAlert = Math.max(0, cartelAlert - dt); cmpT -= dt; if (cmpT > 0) return; cmpT = 0.5;
  const v = V14(), c = v.cmp; if (!c || c.seed !== state.seed) return;
  const dc = d2(c.x, c.z);
  if (!c.built) { if (dc < 85 && !MP_GUEST) cmpBuild(c); return; }
  if (cmpLive) {
    const j = cmpLive.jefe;
    if (j && !mobs.includes(j)) { if (j.hp > 0 && dc > 80) cmpLive.jefe = null; }
    if (j && mobs.includes(j)) { const f = j.hp / j.maxHp; if (cmpLive.waves === 0 && f < 0.66) { cmpLive.waves = 1; cmpWave(c, 3); } else if (cmpLive.waves === 1 && f < 0.33) { cmpLive.waves = 2; cmpWave(c, 3); } }
    if (dc > 100) { for (const m of [...cmpLive.guards, cmpLive.jefe]) if (m && mobs.includes(m)) removeMob(m, false); cmpLive = null; }
    return;
  }
  if (dc < 55 && !player.car) {
    const live = cmpSpawn(c);
    if (live.jefe) { banner('Boss fight', '💀 Don Calavera', canHurtPlayer() ? 'Take out the cartel boss in his villa' : '😇 Peaceful: they can\'t hurt you'); bossSnd(); }
  }
}
function bossSnd() { beep(110, 0.6, 'sawtooth', 0.06); setTimeout(() => beep(98, 0.6, 'sawtooth', 0.06), 450); setTimeout(() => beep(82, 0.9, 'sawtooth', 0.07), 900); }
function jefeDown(m) {
  const v = V14(), first = v.boss.jefe === 0; v.boss.jefe++; v.boss.jefeDay = day();
  if (first) { give('gold_rifle', 1); give('kingpin_crown', 1); }
  give('rifle_ammo', 60); give('cocaine_prime', rint(3, 6)); addDirty(first ? 3000 : 1200, null);
  banner('Boss defeated', '💀 Don Calavera is down!', first ? '+ 💵3000 dirty · 👑 Kingpin\'s Crown · Golden AK' : '+ 💵1200 dirty · ammo · product');
  kpStat('jefe'); cartelAlert = 0; coinSnd(); shake(0.4, 0.06);
  for (const g of (cmpLive && cmpLive.guards) || []) if (mobs.includes(g)) { g.calm = 60; }
}

// ---- the alien mothership: hovers over Area 51 or a UFO crash site. Shoot out the 4 glowing weak points, then the core.
let ship = null, shipT = 0;
const WP_N = 4, CORE_HP = 130;   // round 2: core a little weaker (was 160)
function shipMesh() {
  const g = new THREE.Group(), hull = new THREE.MeshLambertMaterial({ color: 0x8a90a0 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(12, 9, 2.2, 28), hull); g.add(disc);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(12.6, 12.6, 0.5, 28), new THREE.MeshLambertMaterial({ color: 0x5a6070 })); g.add(rim);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.6 })); dome.position.y = 1.1; g.add(dome);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(7, 4, 1.4, 20), hull); under.position.y = -1.6; g.add(under);
  const lights = new THREE.Group(); g.add(lights);
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3bd0 : 0x3bffd0, fog: false })); l.position.set(Math.cos(a) * 11.3, -0.6, Math.sin(a) * 11.3); lights.add(l); }
  const wps = [];
  for (let i = 0; i < WP_N; i++) { const a = i / WP_N * 6.283 + 0.4, m = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0x6aff8a, fog: false })); m.position.set(Math.cos(a) * 8.5, -1.5, Math.sin(a) * 8.5); g.add(m); wps.push({ m, hp: 32, alive: true }); }
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 10), new THREE.MeshBasicMaterial({ color: 0x4a1020, fog: false })); core.position.y = -2.6; g.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 6, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x9affc0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  beam.position.y = -15.5; beam.visible = false; g.add(beam);
  return { g, lights, wps, core, beam };
}
function spawnShip(cx, cz, gy) {
  if (ship) return ship; const parts = shipMesh();
  ship = { ...parts, cx, cz, gy, x: cx, y: gy + 26, z: cz, phase: 1, coreHp: CORE_HP, t: 0, laserT: 4, dropT: 10, beamT: 16, beamOn: 0, dying: 0, hitT: 0 };
  ship.g.position.set(ship.x, ship.y + 30, ship.z); scene.add(ship.g); ship.arrive = 1;
  banner('Boss fight', '🛸 The Mothership', canHurtPlayer() ? 'Shoot the 4 glowing weak points, then the core' : '😇 Peaceful: it can\'t hurt you · shoot the weak points'); bossSnd();
  return ship;
}
function removeShip() { if (!ship) return; scene.remove(ship.g); ship = null; }
const shipTargets = () => ship && !ship.dying ? (ship.phase === 1 ? ship.wps.filter(w => w.alive).map(w => ({ w, m: w.m, r: 1.5 })) : [{ core: true, m: ship.core, r: 2.3 }]) : [];
function shipHit(tg, dmg) {
  const wp = new THREE.Vector3(); tg.m.getWorldPosition(wp); flashAt(wp, 1.2); particles(wp.x, wp.y, wp.z, new THREE.Color(0.4, 1, 0.6), 6); beep(1500, 0.04, 'square', 0.04); ship.hitT = 0.12;
  if (tg.w) {
    tg.w.hp -= dmg; if (tg.w.hp > 0) return;
    tg.w.alive = false; tg.m.material.color.setHex(0x222222); smokePuff(wp.x, wp.y, wp.z, 5, 0x333333); noiseBurst(0.4, 0.14, 300);
    const left = ship.wps.filter(w => w.alive).length;
    if (left) toast(`💥 Weak point destroyed! ${left} left`);
    else { ship.phase = 2; ship.core.material.color.setHex(0xff2a4a); toast('⚠️ The shield is down! Shoot the red CORE underneath!'); beep(300, 0.4, 'sawtooth', 0.06); }
    return;
  }
  ship.coreHp -= dmg; if (ship.coreHp <= 0) { ship.dying = 3.2; toast('🛸 The mothership is going down!!'); noiseBurst(1.2, 0.2, 180); shake(0.8, 0.12); }
}
{ const us0 = ufoShot; ufoShot = function (o, dir, maxT) {
  if (ship && !ship.dying) {
    let best = null, bt = Math.max(maxT, 160); const c = new THREE.Vector3();
    for (const tg of shipTargets()) { tg.m.getWorldPosition(c); const t = c.clone().sub(o).dot(dir); if (t < 0 || t > bt) continue; if (o.clone().addScaledVector(dir, t).distanceTo(c) < tg.r) { bt = t; best = tg; } }
    if (best) { const g = GUNS[heldGun()] || GUNS.pistol; shipHit(best, g.dmg); return true; }
  }
  return us0(o, dir, maxT);
}; }
{ const ba0 = blastAircraft; blastAircraft = function (c, r) {
  ba0(c, r); if (!ship || ship.dying) return; const p = new THREE.Vector3();
  for (const tg of shipTargets()) { tg.m.getWorldPosition(p); if (p.distanceTo(c) < r + tg.r) shipHit(tg, 20); }
}; }
let rayFire = false;
{ const tf0 = tryFire; tryFire = function () { rayFire = heldGun() === 'ray_gun'; try { return tf0(); } finally { rayFire = false; } }; }
{ const tr0 = tracer; tracer = function (a, b, kind) { return tr0(a, b, kind || (rayFire ? 'ray' : kind)); }; }
function msSite() {   // the nearest Area 51 or crash site in range: { x, z, y }
  let best = null, bd = 1e9;
  for (const s of sitesNear(200)) if (s.type === 'area51') { const x = (s.x0 + s.x1) / 2, z = (s.z0 + s.z1) / 2, d = d2(x, z); if (d < bd) { bd = d; best = { x, z, y: s.base + 1, n: '👽 Area 51' }; } }
  for (const cs of crashSites.values()) { const d = d2(cs.x, cs.z); if (d < bd) { bd = d; best = { x: cs.x, z: cs.z, y: cs.y, n: '🛸 UFO crash site' }; } }
  return best ? { ...best, d: bd } : null;
}
const msWanted = () => { const v = V14(), s = curMission(); return (s && s.id === 'mothership') || v.msWant || (v.boss.ms > 0 && day() > v.boss.msDay && nightAmt > 0.5); };
function updateShip(dt, t) {
  shipT -= dt;
  if (!ship) { if (shipT <= 0) { shipT = 2; if (msWanted() && playing && player.alive && !jail) { const s = msSite(); if (s && s.d < 75) { const v = V14(), re = !!v.msWant; v.msWant = false; spawnShip(s.x, s.z, s.y).rematch = re; } } } return; }
  const s = ship, pp = player.pos; s.t += dt; s.lights.rotation.y += dt * 1.8; s.hitT = Math.max(0, s.hitT - dt);
  if (s.dying > 0) {
    s.dying -= dt; s.y -= dt * 7; s.g.rotation.z += dt * 0.5; s.g.rotation.x += dt * 0.25; s.beam.visible = false;
    if (Math.random() < dt * 14) { const a = Math.random() * 6.28; smokePuff(s.x + Math.cos(a) * 8, s.y, s.z + Math.sin(a) * 8, 2, 0x333333); particles(s.x + Math.cos(a) * 6, s.y, s.z + Math.sin(a) * 6, new THREE.Color(1, 0.6, 0.2), 8); }
    s.g.position.set(s.x, s.y, s.z);
    if (s.dying <= 0) { flashAt(new THREE.Vector3(s.x, s.y, s.z), 14); noiseBurst(1.5, 0.25, 140); shake(1, 0.15); removeShip(); msDown(); }
    return;
  }
  const dc = d2(s.cx, s.cz); if (dc > 170 || !player.alive || jail) { if (s.rematch) V14().msWant = true; removeShip(); return; }
  if (s.arrive > 0) { s.arrive = Math.max(0, s.arrive - dt * 0.35); }
  const a = s.t * 0.12, R = s.phase === 1 ? 14 : 8, hy = s.gy + (s.phase === 1 ? 26 : 18);
  s.x = s.cx + Math.cos(a) * R; s.z = s.cz + Math.sin(a) * R; s.y += (hy - s.y) * Math.min(1, dt * 0.6);
  s.g.position.set(s.x, s.y + s.arrive * 30, s.z); s.g.rotation.y += dt * 0.25;
  for (const w of s.wps) if (w.alive) w.m.material.color.setHex(Math.floor(t * 4) % 2 ? 0x6aff8a : 0x3acf5a);
  if (s.phase === 2) s.core.material.color.setHex(Math.floor(t * 6) % 2 ? 0xff2a4a : 0xc0102a);
  s.beam.visible = s.beamOn > 0;
  if (!canHurtPlayer() || !player.alive || s.arrive > 0.05) return;   // peaceful: it just hovers there
  const dp = d2(s.x, s.z), eye = pp.clone().setY(pp.y + 1.1), under = new THREE.Vector3(); s.core.getWorldPosition(under);
  if (dp > 75) return;
  s.laserT -= dt;
  if (s.laserT <= 0) {
    s.laserT = (s.phase === 1 ? 2.6 : 2.1) / Math.max(0.8, diff().spd);
    const hit = Math.random() < 0.5, to = eye.clone(); if (!hit) { to.x += (Math.random() - .5) * 4; to.z += (Math.random() - .5) * 4; }
    tracer(under, to, 'ray'); flashAt(under, 1.2); raySnd(Math.max(0.2, 1 - dp / 80));
    if (hit && lineOfSight(under, eye)) damage(3, 'alien', under);
  }
  s.dropT -= dt;
  if (s.dropT <= 0) { s.dropT = 14; if (mobs.filter(m => m.type === 'alien').length < 6) for (let i = 0; i < 2; i++) {
    const aa = Math.random() * 6.28, x = pp.x + Math.cos(aa) * (6 + Math.random() * 4), z = pp.z + Math.sin(aa) * (6 + Math.random() * 4); if (!loaded(x, z)) continue;
    const m = spawnMob('alien', x, groundNear(x, pp.y + 4, z), z, rint(0, 9)); if (m) { m.angry = 40; particles(x, m.g.position.y + 1, z, new THREE.Color(0.5, 1, 0.6), 10); } }
    toast('👽 The mothership beamed down aliens!'); }
  s.beamT -= dt; if (s.beamOn > 0) s.beamOn -= dt;
  if (s.beamT <= 0) { s.beamT = 20; s.beamOn = 3.5; beep(220, 1.2, 'sine', 0.05); }
  if (s.beamOn > 0 && dp < 7) { player.vel.y = Math.max(player.vel.y, 6.5); player.fallStart = null; s.beamDmg = (s.beamDmg || 0) + dt; if (s.beamDmg > 1) { s.beamDmg = 0; damage(1, 'alien'); } }
}
function msDown() {
  const v = V14(), first = v.boss.ms === 0; v.boss.ms++; v.boss.msDay = day();
  if (first) give('ray_gun', 1);
  give('mothership_core', 1); give('plasma_cell', first ? 40 : 24); give('alien_tech', first ? 8 : 4);
  banner('Boss defeated', '🛸 Mothership destroyed!', first ? '+ 🔮 Power Core · Ray Gun · 🔋 plasma cells · alien tech' : '+ 🔮 Power Core · 🔋 cells · alien tech');
  kpStat('mothership'); coinSnd();
}
{ const hm4 = hurtMob; hurtMob = function (m, dmg, from, noDrop) {
  const was = m && mobs.includes(m), type = m && m.type;
  if (was && (type === 'cartel' || type === 'jefe') && from === player.pos) cartelAlert = 30;
  const r = hm4(m, dmg, from, noDrop);
  if (was && m.boss && mobs.includes(m)) { m.vel.x *= 0.15; m.vel.z *= 0.15; m.vel.y = Math.min(m.vel.y, 1); }
  if (was && !mobs.includes(m) && m.hp <= 0) { if (type === 'jefe') jefeDown(m); else if (type === 'cartel' && from === player.pos) addDirty(rint(15, 45), null); }
  return r; }; }

// ======================= 3. STORY MODE: from broke farm kid to kingpin =======================
// 14 missions built on the systems that already exist. Progress = how much you did since the mission started
// (except "own a ..." missions, which check what you own). Uncle Ray texts you each step; Don Calavera is the final boss.
const st13 = () => V13().stats, stN = k => st13()[k] || 0;
function stSnap() { return { earned: state.earned, sell: stN('sell'), heist: stN('heist'), pawn: stN('pawn'), mod: stN('mod'), hired: stN('hired'), cook: stN('cook'), bank: stN('bank'), rep: V12().rep, jobs: jobsDone(), ms: V14().boss.ms, jefe: V14().boss.jefe }; }
const RAY = '👴 Uncle Ray', DON = '💀 Don Calavera';
const STORY = [
  { id: 'dirt', t: '🌱 Dirt Poor', who: RAY, say: 'Your grandpa left you this farm and not one coin. Grow some crops and sell them to the traders. Make 💰100 and call me.', goal: 'Earn 100 coins', need: 100, prog: b => state.earned - b.earned, cash: 50, hint: 'Plant seeds on farmland, harvest, sell to the village traders.' },
  { id: 'corner', t: '🌿 Corner Boy', who: RAY, say: 'Farming won\'t pay the bills, kid. Folks in town pay good for the green stuff. Sell 3 drugs on the street. Watch for cops.', goal: 'Sell 3 drugs on the street', need: 3, prog: b => stN('sell') - b.sell, cash: 150, hint: 'Grow 🌿 weed or craft product, hold it and ✋ a townsperson.' },
  { id: 'dayjob', t: '💼 Day Job', who: RAY, say: 'Cops are asking questions. Get a legit job so it looks like you earn your money honest. Do 2 runs.', goal: 'Finish 2 job runs (taxi fare, pizza or haul)', need: 2, prog: b => jobsDone() - b.jobs, cash: 150, hint: '📱 💼 Jobs or a 📋 Job Board in town.' },
  { id: 'plug', t: '🔌 Meet the Plug', who: RAY, say: 'I put in a word with the Plug. He\'s got a package that needs moving. Don\'t let the cops see it.', goal: 'Finish a Plug delivery job', need: 1, prog: b => V12().rep - b.rep, cash: 200, hint: '📱 🔌 Plug app. Pick up at 🟢, deliver to 🔴.' },
  { id: 'stickup', t: '🔫 Stick-Up Kid', who: RAY, say: 'You want real money? The gas station on the corner keeps cash in the register. Don\'t tell your aunt I said that.', goal: 'Pull off a heist', need: 1, prog: b => stN('heist') - b.heist, cash: 250, hint: 'Hold a weapon and ✋ a ⛽ / 💎 / 🏦 counter. Stay close until it\'s done.' },
  { id: 'fence', t: '🏪 The Fence', who: RAY, say: 'Hot jewelry\'s no good in your pocket. Take it to the pawn shop, they don\'t ask questions.', goal: 'Pawn 2 stolen items', need: 2, prog: b => stN('pawn') - b.pawn, cash: 200, hint: 'Rob a 💎 Jewelry Store, then ✋ a 🏪 Pawn Shop.' },
  { id: 'wheels', t: '🚗 Wheels', who: RAY, say: 'A player needs a ride. Find a car, take it to the garage and make it yours.', goal: 'Buy a mod at a 🔧 Garage', need: 1, prog: b => stN('mod') - b.mod, cash: 300, hint: 'Drive any car up to a 🔧 Garage counter in a city.' },
  { id: 'crew', t: '👥 Boss Up', who: RAY, say: 'You can\'t be on every corner yourself. Hire somebody you trust. Or somebody cheap.', goal: 'Hire a crew member', need: 1, prog: b => stN('hired') - b.hired, cash: 300, hint: '📱 👥 Crew app.' },
  { id: 'wash', t: '🧺 Clean Hands', who: RAY, say: 'All that dirty money is gonna get you caught. Buy a business and wash it clean.', goal: 'Own a Laundromat or Car Wash', need: 1, prog: () => V12().biz.length ? 1 : 0, cash: 400, hint: 'DealerNet (📱 🌐) › 💼 Business.' },
  { id: 'home', t: '🏠 Home Base', who: RAY, say: 'Grandpa\'s farm is the first place they\'d look. Get yourself a safehouse.', goal: 'Own a safehouse', need: 1, prog: () => V13().homes.length ? 1 : 0, cash: 500, hint: 'Buy a deed on DealerNet › 🏠 Property, then ✋ it where you want to live.' },
  { id: 'cook', t: '⚗️ Cook Up', who: RAY, say: 'Street stuff is cut to nothing. Cook your own and the whole county will want it.', goal: 'Cook a batch in a drug lab', need: 1, prog: b => stN('cook') - b.cook, cash: 500, hint: 'Craft a ⚗️ Drug Lab (glass, iron, furnace), place it and ✋ it.' },
  { id: 'bank', t: '🏦 The Big Score', who: RAY, say: 'This is it, kid. The bank vault. In and out. Don\'t get greedy.', goal: 'Empty a bank vault', need: 1, prog: b => stN('bank') - b.bank, cash: 800, hint: 'Hold a weapon and ✋ a 🏦 Bank counter in a city. 24 seconds.' },
  { id: 'mothership', t: '👽 Something in the Sky', who: RAY, say: 'Kid, I\'m not crazy. There\'s a ship over the desert. It took my cows in \'86. Shoot it down and I\'ll tell you who\'s really been running this county.', goal: 'Destroy the alien Mothership', need: 1, prog: b => V14().boss.ms - b.ms, cash: 1500, hint: 'Go to 👽 Area 51 (desert) or a 🛸 UFO crash site with a gun. 📍 pins the nearest one.', pin: 'ms' },
  { id: 'kingpin', t: '💀 Kingpin', who: DON, say: 'So you\'re the farm boy taking my money. Come to my compound, niño. Let\'s see if you\'re a kingpin or just a kid.', goal: 'Take down Don Calavera at his compound', need: 1, prog: b => V14().boss.jefe - b.jefe, cash: 5000, hint: 'His compound is pinned on your GPS (📍). Bring guns, ammo and food.', pin: 'cmp' },
];
const curMission = () => { const s = V14().st; return s.i < STORY.length ? STORY[s.i] : null; };
function stLog(who, text) { const s = V14().st; s.log.push({ who, text, d: day() }); if (s.log.length > 40) s.log.splice(0, s.log.length - 40); }
function stStart() {
  const s = V14().st, m = curMission(); s.base = stSnap(); if (!m) return;
  stLog(m.who, m.say); s.pinned = false;
  if (m.pin === 'cmp') stPin();
}
function stPin() {
  const m = curMission(); if (!m) return false;
  state.waypoints = (state.waypoints || []).filter(w => !w.story);
  if (m.pin === 'cmp') {
    if (MP_GUEST) { toast('🌐 Play in your own world to take on Don Calavera'); return false; }
    const c = cmpEnsure(); if (!c) { toast('📍 No spot for the compound found nearby. Try again somewhere else'); return false; }
    state.waypoints.push({ x: c.x, z: c.z, c: '#ff3b3b', story: true }); toast(`📍 Don Calavera's compound is on your GPS · ${Math.round(d2(c.x, c.z))} m`); return true;
  }
  if (m.pin === 'ms') {
    const s = findSite('area51', 40); let best = s ? { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, n: '👽 Area 51' } : null;
    for (const cs of crashSites.values()) if (!best || d2(cs.x, cs.z) < d2(best.x, best.z)) best = { x: cs.x, z: cs.z, n: '🛸 UFO crash site' };
    if (!best) { toast('📍 No Area 51 found nearby. Look for deserts or scorched UFO crash craters'); return false; }
    state.waypoints.push({ x: Math.floor(best.x), z: Math.floor(best.z), c: '#6aff8a', story: true }); toast(`📍 ${best.n} pinned on your GPS · ${Math.round(d2(best.x, best.z))} m`); return true;
  }
  return false;
}
const stProg = m => { const s = V14().st; return Math.max(0, Math.min(m.need, Math.floor(m.prog(s.base || stSnap())))); };
let stT = 1, stIntro = 8;
function updateStory(dt) {
  if (stBannerT > 0) { stBannerT -= dt; if (stBannerT <= 0) stBanner.classList.remove('on'); }
  const v = V14(), s = v.st;
  if (!s.intro) { stIntro -= dt; if (stIntro <= 0) { s.intro = 1; if (!s.base) stStart(); kpToast('📖 NEW: Story mode! Open 📱 → 📖 Story to see your mission'); } return; }
  if (!s.base) stStart();
  stT -= dt; if (stT > 0) return; stT = 0.5;
  const m = curMission(); if (!m) return;
  if (stProg(m) < m.need) return;
  const k = s.i; s.i++; s.base = null;
  addClean(m.cash, null); if (m.item && m.item[1] > 0) give(m.item[0], m.item[1]);
  stLog('✅', `${m.t} done · +💰${m.cash}`);
  state.waypoints = (state.waypoints || []).filter(w => !w.story);
  if (s.i >= STORY.length) {
    s.done = day(); banner('Story complete', '👑 Kingpin of the County', `+💰${m.cash} · you went from broke farm kid to the top`);
    stLog(RAY, 'You did it, kid. Grandpa would be... well, he\'d be something. The county is yours now.'); kpStat('story');
  } else { banner(`Mission ${k + 1}/${STORY.length} complete`, m.t, `+💰${m.cash} clean`); stStart(); setTimeout(() => toast(`📖 New mission: ${curMission().t} · 📱 📖 Story`), 4300); }
  coinSnd(); beep(660, 0.1, 'triangle', 0.06); setTimeout(() => beep(990, 0.18, 'triangle', 0.06), 160);
}
function storyApp() {
  const v = V14(), s = v.st, m = curMission();
  let h = `<div class="pappbar">📖 Story <span style="margin-left:auto;font-size:12px;opacity:.8">${Math.min(s.i, STORY.length)}/${STORY.length}</span></div><div class="pplug">`;
  if (m) {
    const p = stProg(m);
    h += `<div class="pst pmis"><b>Mission ${s.i + 1} · ${m.t}</b><br>${m.goal} · ${p}/${m.need}<div class="pbar"><i style="width:${Math.round(p / m.need * 100)}%"></i></div><span style="opacity:.75;font-size:12px">💡 ${m.hint}</span><br>Reward 💰${m.cash}</div>`;
    if (m.pin) h += `<button class="pst" data-kp14="pin">📍 ${m.pin === 'cmp' ? 'Pin the compound on GPS' : 'Pin the nearest Area 51 / crash site'}</button>`;
  } else h += `<div class="pst pmis"><b>👑 Kingpin of the County</b><br>Story complete. The county is yours.</div>`;
  h += `<button class="pst" data-kp14="hud">${s.hud ? '👁 Mission on HUD: on' : '🙈 Mission on HUD: off'}</button>`;
  if (v.boss.ms || v.boss.jefe) {
    h += '<h4>🔁 Boss rematches</h4>';
    if (v.boss.ms) h += `<button class="pst" data-kp14="rems">🛸 Mothership · beaten ${v.boss.ms}× · ${v.msWant ? 'waiting at the next Area 51 / crash site' : 'call it back'}</button>`;
    if (v.boss.jefe) h += `<div class="pst">💀 Don Calavera · beaten ${v.boss.jefe}× · ${day() > v.boss.jefeDay ? 'back at his compound' : 'back tomorrow'}</div><button class="pst" data-kp14="pincmp">📍 Pin the compound</button>`;
  }
  h += '<h4>💬 Messages</h4>' + [...s.log].reverse().slice(0, 12).map(l => `<div class="pmsg"><em>${l.who} · day ${l.d}</em>${l.text}</div>`).join('');
  h += '<h4>Missions</h4>' + STORY.map((q, i) => `<div class="pst" style="${i > s.i ? 'opacity:.45' : ''}">${i < s.i ? '✅' : i === s.i ? '▶️' : '🔒'} ${i + 1}. ${i > s.i ? '???' : q.t} <span style="float:right">💰${q.cash}</span></div>`).join('');
  return h + '</div>';
}
function jobsApp() { return `<div class="pappbar">💼 Jobs</div><div class="pplug">${jobsHTML(false)}</div>`; }
{ const rp2 = renderPhone; renderPhone = function () {
  rp2(); const el = document.getElementById('pScreen'); if (!el) return;
  if (phoneApp === 'home') {
    const a = el.querySelector('.papps');
    if (a && !a.querySelector('[data-app="story"]')) a.insertAdjacentHTML('beforeend', '<button class="papp" data-app="story"><i style="background:linear-gradient(#c070ff,#6a1ab0)">📖</i>Story</button><button class="papp" data-app="jobs"><i style="background:linear-gradient(#5ad0ff,#1a6ab0)">💼</i>Jobs</button>');
    return;
  }
  if (phoneApp === 'story') el.innerHTML = phoneStatus() + storyApp();
  else if (phoneApp === 'jobs') el.innerHTML = phoneStatus() + jobsApp();
}; }
function kp14Click(a, arg) {
  const v = V14();
  if (a === 'job') { closePanels(); startJob(arg); return true; }
  if (a === 'jend') endJob(job ? `💼 Shift ended · 💰${job.made} earned` : null);
  else if (a === 'pin') stPin();
  else if (a === 'hud') v.st.hud = !v.st.hud;
  else if (a === 'rems') { v.msWant = true; toast('🛸 Go to an Area 51 or UFO crash site. It\'ll be waiting'); }
  else if (a === 'pincmp') { const c = v.cmp; if (c) { state.waypoints = state.waypoints.filter(w => !w.story); state.waypoints.push({ x: c.x, z: c.z, c: '#ff3b3b', story: true }); toast(`📍 Compound pinned · ${Math.round(d2(c.x, c.z))} m`); } }
  return false;
}
phoneEl.addEventListener('click', e => { const b = e.target.closest('[data-kp14]'); if (!b) return; const [a, arg] = b.dataset.kp14.split(':'); if (kp14Click(a, arg)) return; renderPhone(); beep(990, 0.03, 'sine', 0.04); });
kpEl.addEventListener('click', e => { const b = e.target.closest('[data-kp14]'); if (!b) return; const [a, arg] = b.dataset.kp14.split(':'); if (kp14Click(a, arg)) return; if (kpShown()) renderKp(); });

// ---- 📋 Job Board kiosk in every town and city (a v1.13-style venue: a mesh, so no world blocks change)
VENUE.jobs = { n: '📋 Job Board', col: 0x2a8a4a, shirt: 0x2a8a4a };
{ const vo0 = venuesOf; venuesOf = function (t) {
  const out = vo0(t); if (out._jobs) return out; out._jobs = true;
  const nb = t.nb || 3, used = new Set(out.map(v => Math.round((v.x - 6 - t.x0) / 16) + ',' + Math.round((v.z - 4 - t.z0) / 16)));
  const r = mulberry(Math.floor(hash2(t.x0, t.z0, state.seed + 1414) * 1e9)), lots = [];
  for (let i = 0; i < nb; i++) for (let j = 0; j < nb; j++) if (!used.has(i + ',' + j) && !(t.type !== 'city' && i === 1 && j === 1)) lots.push([i, j]);
  if (!lots.length) return out;
  const lot = lots[Math.floor(r() * lots.length)], x = t.x0 + lot[0] * 16 + 6, z = t.z0 + lot[1] * 16 + 4;
  out.push({ kind: 'jobs', x, z, j: lot[1], key: 'jobs@' + x + ',' + z, t, mesh: null, y: t.base + 1 });
  return out;
}; }
{ const vm0 = venueMesh; venueMesh = function (vn) {
  const g = vm0(vn); if (vn.kind !== 'jobs') return g;
  box(1.4, 0.9, 0.06, 0xb08a5a, 0, 1.75, -0.38, g);
  for (const [x, y, c] of [[-0.4, 1.9, 0xffffff], [0.05, 1.75, 0xfff2a0], [0.42, 1.92, 0xa0d8ff], [-0.25, 1.55, 0xffc0c0]]) box(0.28, 0.32, 0.02, c, x, y, -0.42, g);
  return g;
}; }
{ const uv0 = useVenue; useVenue = function (vn) { if (vn.kind === 'jobs') { openKp('jobs', vn); return; } return uv0(vn); }; }
{ const rk0 = renderKp; renderKp = function () {
  if (kpMode !== 'jobs') return rk0();
  document.getElementById('kpBox').innerHTML = '<button class="btn close" data-kpx="1" style="float:right">✕</button>' + jobsHTML(true);
}; }
{ const ut1 = updateTarget; updateTarget = function () {
  ut1(); if (!playing) return; const el = document.getElementById('target');
  const vn = venueNear(player.car ? 7 : 2.8); if (vn && vn.kind === 'jobs') { el.style.display = 'block'; el.textContent = player.car ? '📋 Job Board · get out to read it' : '📋 Job Board · ✋ find work'; }
}; }

// ---- achievements + a daily challenge for the new stuff
ACH.push(
  ['cabbie', '🚕 Cabbie', 'Drive 10 taxi fares', s => s.fares >= 10],
  ['pizzaguy', '🍕 30 Minutes or Less', 'Deliver 10 pizzas', s => s.pizzas >= 10],
  ['haul', '🚚 Long Haul', 'Finish 5 truck hauls', s => s.hauls >= 5],
  ['ufo', '🛸 Close Encounter', 'Destroy the alien Mothership', s => s.mothership >= 1],
  ['dethroned', '💀 Dethroned', 'Take down Don Calavera', s => s.jefe >= 1],
  ['kingpin', '👑 Kingpin of the County', 'Finish story mode', s => s.story >= 1],
);
DAILY.job = { t: '💼 Finish 3 legit job runs', n: 3, cash: 120 };

// ---- HUD line (joins the wanted / heist / nitro line)
{ const rh2 = renderHud4; renderHud4 = function () {
  rh2(); const bits = [], v = V14();
  if (job) {
    const left = job.until != null ? Math.ceil(job.until - state.gameTime) : 0, far = job.b ? Math.round(d2(job.b.x, job.b.z)) : 0;
    if (job.kind === 'taxi') bits.push(job.stage === 'pickup' ? `🚕 Pick up the 🟢 fare${job.fare ? ` · ${Math.round(job.fare.g.position.distanceTo(player.pos))} m` : ''}` : job.stage === 'drop' ? `🚕 Drop-off 🔴 ${far} m · ${left > 0 ? `⏱ ${left}s tip` : '😤 no tip'} · 💰${job.pay}` : '🚕 Next fare...');
    else if (job.kind === 'pizza') bits.push(`🍕 ${far} m · ⏱ ${Math.max(0, left)}s · ${job.left} left`);
    else bits.push(`🚚 ${job.cargo} · ${far} m · ${left > 0 ? `⏱ ${left}s bonus` : 'late'}`);
  }
  if (ship) bits.push(ship.dying ? '🛸 Going down!' : ship.phase === 1 ? `🛸 Mothership · weak points ${ship.wps.filter(w => w.alive).length}/${WP_N}` : `🛸 CORE ${Math.max(0, Math.round(ship.coreHp / CORE_HP * 100))}%`);
  const jf = cmpLive && cmpLive.jefe; if (jf && mobs.includes(jf)) { const f = Math.max(0, jf.hp / jf.maxHp); bits.push(`💀 Don Calavera <span style="letter-spacing:-1px;color:#ff5a5a">${'▮'.repeat(Math.ceil(f * 10))}<i style="opacity:.3;font-style:normal">${'▮'.repeat(10 - Math.ceil(f * 10))}</i></span>`); }
  const m = curMission(); if (m && v.st.hud && !job && !ship && !(jf && mobs.includes(jf)) && v.st.base) bits.push(`📖 ${m.t} · ${m.goal} ${stProg(m)}/${m.need}`);
  if (!bits.length) return;
  const extra = bits.join(' &nbsp; '), html = hud4.innerHTML ? hud4.innerHTML + ' &nbsp; ' + extra : extra;
  if (hud4.innerHTML !== html) hud4.innerHTML = html; hud4.style.display = 'block';
}; }

// ---- leaving the world: nothing from this section carries into the title screen / another world
function reset14() { endJob(null); removeShip(); if (cmpLive) { for (const m of [...cmpLive.guards, cmpLive.jefe]) if (m && mobs.includes(m)) removeMob(m, false); cmpLive = null; } for (const n of fakeNades) scene.remove(n.g); fakeNades.length = 0; }

// ---- the per-frame hook (runs right after updateV113 from the main loop)
{ const u13 = updateV113; updateV113 = function (dt, t) {
  u13(dt, t);
  if (!playing) { if (job || ship || cmpLive) reset14(); return; }
  updateJob(dt); updateCompound(dt); updateShip(dt, t); updateNades(dt); updateStory(dt);
}; }
window.__dc14 = { V14, STORY, curMission, stSnap, stProg, stStart, stPin, updateStory, JOBS, startJob, endJob, get job() { return job; }, nextFare, pickUp, nextPizza, houseSpot, townsFar,
  spawnShip, removeShip, get ship() { return ship; }, shipHit, shipTargets, msSite, cmpEnsure, cmpBuild, cmpSpawn, get cmpLive() { return cmpLive; }, updateCompound, jefeDown, msDown,
  cartelAI, lobNade, updateJob, updateShip, updateNades, findSite, sitesNear, crashSites, venuesOf: t => venuesOf(t), tryFire: () => tryFire(), renderHud4: () => renderHud4(), updateTarget: () => updateTarget(), openKp: (m, v) => openKp(m, v), renderPhone: () => renderPhone(), setPhoneApp: a => { phoneApp = a; }, get cartelAlert() { return cartelAlert; }, reset14, kp14Click, storyApp, jobsHTML, banner };


// ================== v1.14 round 2: deep caves, the Moon, car mods+, player shops, hidden glitches ==================
// Blocks/items are in the round-2 data block near the top (p_a10). Everything here grafts on by wrapping, like v1.12-v1.14.
// Save data: state.r2 (lazy), state.shops, state.caveV/caveOld. Old saves: chunks you already built in or explored never get caves/ores.
// Peaceful (canHurtPlayer() false): cave monsters never spawn; nothing here can hurt you there.
function R2() {
  const v = state.r2 || (state.r2 = {});
  if (!v.gl || typeof v.gl !== 'object') v.gl = {};        // glitches found: id -> gameTime
  if (!Array.isArray(v.from) && v.from != null) v.from = null;   // where you left Earth for the Moon [x, z]
  if (v.brFrom === undefined) v.brFrom = null;               // where you clipped into the Backrooms [x, y, z]
  return v;
}
R2();
MATCOL.emerald = ['#7affa0', '#1a9a4a']; MATCOL.moon = ['#e8f0ff', '#7a8cff'];
if (!state.shops || typeof state.shops !== 'object') state.shops = {};
if (!INV_KEYS.includes('r2')) INV_KEYS.push('r2');          // online guests carry their glitch finds home
Object.assign(RAW_VALUE, { diamond: 120, emerald: 90, gold_ore: 14, platinum_ore: 24, diamond_ore: 120, emerald_ore: 90, moon_dust: 2, moon_rock: 40, moon_crystal: 160,
  moon_cheese: 25, alien_relic: 300, shop_stall: 30, br_wall: 5, br_carpet: 5, br_light: 8, torn_note: 1 });
Object.assign(VILLAGERS[3].buys, { diamond: 110, emerald: 80, moon_rock: 35, moon_crystal: 140, alien_relic: 260 });
for (const id of ['diamond', 'emerald', 'gold_ore', 'platinum_ore', 'diamond_ore', 'emerald_ore', 'moon_dust', 'moon_rock', 'moon_crystal', 'moon_cheese', 'alien_relic',
  'br_wall', 'br_carpet', 'br_light', 'golden_bug', 'torn_note', ...Object.keys(ITEMS).filter(k => k.startsWith('diamond_'))]) WEB_HIDE14.add(id);
const r2css = document.createElement('style');
r2css.textContent = `#r2fade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:60;transition:opacity .5s}#r2fade.on{opacity:1}
#r2void{position:fixed;inset:0;background:#000;z-index:61;display:none;align-items:center;justify-content:center;flex-direction:column;color:#7aff7a;font:18px monospace;text-align:center;padding:20px}
#r2void.on{display:flex}#r2void b{font-size:clamp(16px,4.4vw,30px);color:#fff;letter-spacing:4px;animation:r2g .18s infinite}#r2void i{font-style:normal;opacity:.75;margin-top:14px}
@keyframes r2g{0%{transform:translate(0,0)}25%{transform:translate(-2px,1px);color:#f0f}50%{transform:translate(2px,-1px);color:#0ff}75%{transform:translate(-1px,-2px)}}
#bHorn{display:none;right:90px;bottom:236px;font-size:24px}body.r2drive.touch #bHorn{display:flex}body.r2drive:not(.touch) #bHorn{display:none}
.r2sw{display:inline-block;width:30px;height:30px;border-radius:50%;margin:3px;border:2px solid #fff;cursor:pointer;vertical-align:middle}.r2sw.on{box-shadow:0 0 0 3px #ffd84a}
.r2pr{display:inline-flex;gap:4px;align-items:center}.r2pr .btn{min-width:30px;padding:4px 8px}`;
document.head.appendChild(r2css);
const r2fade = document.createElement('div'); r2fade.id = 'r2fade'; document.body.appendChild(r2fade);
const r2void = document.createElement('div'); r2void.id = 'r2void'; document.body.appendChild(r2void);
const pl2 = () => player.pos;

// ======================= realms: the Moon (far east) and the Backrooms (far west) =======================
// They are just far-away strips of the same endless world, so saving, streaming, edits and online sync all work unchanged.
const MOON_X0 = 60000, BACK_X1 = -60000, PAD_X = MOON_X0 + 120, PAD_Z = 0, BR_X = BACK_X1 - 100, BR_Y = 20;
const realmAt = x => x >= MOON_X0 ? 'moon' : x < BACK_X1 ? 'back' : null;
const realmCh = cx => realmAt(cx * CH + 8);
const realm = () => realmAt(player.pos.x);
const onMoon = () => realm() === 'moon';
const gravMul = () => onMoon() ? 0.3 : 1;
const realmRegion = rx => { const x0 = rx * TREG * CH; return x0 + TREG * CH > MOON_X0 - 400 || x0 < BACK_X1 + 400; };
{ const to0 = townOf; townOf = function (rx, rz) { if (realmRegion(rx)) return null; return to0(rx, rz); }; }
{ const mo0 = metroOf; metroOf = function (mx, mz) { if (realmRegion(mx * 2) || realmRegion(mx * 2 + 1)) return null; return mo0(mx, mz); }; }
{ const so0 = siteOf; siteOf = function (rx, rz) { if (realmRegion(rx)) return null; return so0(rx, rz); }; }
{ const wa0 = weatherAt; weatherAt = function (x, z, tm) { if (realmAt(x)) return 'clear'; return wa0(x, z, tm); }; }
{ const uw0 = updateWildlife; updateWildlife = function (dt) { if (realm()) return; return uw0(dt); }; }
{ const uc0 = updateCrackheads; updateCrackheads = function (dt, t) { if (realm()) return; return uc0(dt, t); }; }
{ const ug0 = updateGangs; updateGangs = function (dt) { if (realm()) return; return ug0(dt); }; }
{ const ucp = updateCompound; updateCompound = function (dt) { if (realm()) return; return ucp(dt); }; }
// moon terrain: grey dust plains, craters with rims, a landing pad
function moonH(x, z) {
  const s = state.seed;
  let h = 24 + (vnoise(x / 40, z / 40, s + 61) - 0.5) * 10 + (vnoise(x / 11, z / 11, s + 62) - 0.5) * 3;
  const C = 28, ci = Math.floor(x / C), cj = Math.floor(z / C);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const i = ci + a, j = cj + b; if (hash2(i, j, s + 63) > 0.55) continue;
    const mx = (i + hash2(i, j, s + 64)) * C, mz = (j + hash2(i, j, s + 65)) * C, r = 4 + hash2(i, j, s + 66) * 9, d = Math.hypot(x - mx, z - mz);
    if (d < r) h -= (1 - (d / r) ** 2) * r * 0.45; else if (d < r * 1.4) h += (1 - (d - r) / (r * 0.4)) * r * 0.16;
  }
  const dp = Math.hypot(x - PAD_X, z - PAD_Z); if (dp < 16) { const k = Math.max(0, (dp - 7) / 9); h = 24 + (h - 24) * k * k; }
  return Math.max(4, Math.min(50, Math.round(h)));
}
const realmChests = new Map();   // "x,y,z" -> loot kind ('cave' | 'moon' | 'bug'): generated chests, filled the first time you open (or break) them
function reapplyEdits(cx, cz, c) {
  const x0 = cx * CH, z0 = cz * CH, ed = editIdx.get(ckey(cx, cz));
  if (ed) for (const k of ed) { const [x, y, z] = k.split(',').map(Number), lx = x - x0, lz = z - z0; if (lx >= 0 && lz >= 0 && lx < CH && lz < CH && y >= 0 && y < H) c[lidx(lx, y, lz)] = state.edits[k]; }
}
function genMoon(cx, cz) {
  const c = new Uint8Array(CH * CH * H); data.set(ckey(cx, cz), c);
  const x0 = cx * CH, z0 = cz * CH, L = (lx, y, lz, v) => { if (lx >= 0 && lz >= 0 && lx < CH && lz < CH && y >= 0 && y < H) c[lidx(lx, y, lz)] = v; }, hm = new Int16Array(CH * CH);
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const x = x0 + lx, z = z0 + lz, h = moonH(x, z); hm[lx + lz * CH] = h;
    for (let y = 0; y <= h; y++) L(lx, y, lz, y === 0 ? BEDROCK : y >= h - 1 ? MOON_DUST : MOON_ROCK);
    const r = hash2(x, z, state.seed + 77);
    if (Math.hypot(x - PAD_X, z - PAD_Z) > 9) { if (r < 0.0035) L(lx, h + 1, lz, MOON_CRYSTAL); else if (r > 0.992) { L(lx, h + 1, lz, MOON_ROCK); if (r > 0.997) L(lx, h + 2, lz, MOON_ROCK); } }
  }
  // landing pad
  if (Math.abs(x0 + 8 - PAD_X) < 24 && Math.abs(z0 + 8 - PAD_Z) < 24) for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const dx = x0 + lx - PAD_X, dz = z0 + lz - PAD_Z; if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue;
    L(lx, 24, lz, Math.abs(dx) === 5 || Math.abs(dz) === 5 ? HAZARD : STEEL); for (let y = 25; y < 30; y++) L(lx, y, lz, AIR);
  }
  // an old alien outpost now and then: a ring of hull plating with a loot chest inside
  if (hash2(cx, cz, state.seed + 999) < 0.05 && Math.hypot(x0 + 8 - PAD_X, z0 + 8 - PAD_Z) > 30) {
    const hc = hm[8 + 8 * CH];
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { const d = Math.hypot(dx, dz);
      if (d < 4.6) { L(8 + dx, hc, 8 + dz, ALIEN_METAL); for (let y = hc + 1; y < hc + 5; y++) L(8 + dx, y, 8 + dz, AIR); }
      if (d > 3.6 && d < 4.6 && !(dz === 4 && Math.abs(dx) <= 1)) for (let y = hc + 1; y <= hc + 2 + (hash3(dx, 0, dz, cx) < 0.5 ? 1 : 0); y++) L(8 + dx, y, 8 + dz, ALIEN_METAL);
    }
    L(8, hc + 1, 7, CHEST); realmChests.set((x0 + 8) + ',' + (hc + 1) + ',' + (z0 + 7), 'moon');
  }
  reapplyEdits(cx, cz, c); chunkColors(cx, cz);
}
// the Backrooms: endless yellow office maze, buzzing lights, a floor you can fall through in one spot
function brWall(x, z) {
  const S = 6, gx = Math.floor(x / S), gz = Math.floor(z / S), lx = ((x % S) + S) % S, lz = ((z % S) + S) % S;
  if (Math.abs(x - BR_X) < 9 && Math.abs(z) < 9) return false;   // the room you arrive in is open
  if (lx === 0 && lz === 0) return true;                        // pillars
  if (lx === 0 && hash2(gx, gz, state.seed + 5) < 0.42 && !(lz === 2 || lz === 3)) return true;
  if (lz === 0 && hash2(gx, gz, state.seed + 6) < 0.42 && !(lx === 3 || lx === 4)) return true;
  return false;
}
const BR_EXIT = [BR_X - 22, BR_Y + 1, 7], BR_BUG = [BR_X - 41, BR_Y + 1, -19], BR_HOLE = [BR_X - 58, 31];
function genBack(cx, cz) {
  const c = new Uint8Array(CH * CH * H); data.set(ckey(cx, cz), c);
  const x0 = cx * CH, z0 = cz * CH, L = (lx, y, lz, v) => { if (lx >= 0 && lz >= 0 && lx < CH && lz < CH && y >= 0 && y < H) c[lidx(lx, y, lz)] = v; };
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const x = x0 + lx, z = z0 + lz, hole = Math.abs(x - BR_HOLE[0]) <= 1 && Math.abs(z - BR_HOLE[1]) <= 1;
    if (!hole) L(lx, BR_Y, lz, BR_CARPET);
    const w = brWall(x, z); for (let y = BR_Y + 1; y <= BR_Y + 4; y++) L(lx, y, lz, w ? BR_WALL : AIR);
    L(lx, BR_Y + 5, lz, (((x % 4) + 4) % 4 === 1 && ((z % 4) + 4) % 4 === 1) ? BR_LIGHT : BR_CEIL);
  }
  for (const [x, y, z, id] of [[BR_EXIT[0], BR_EXIT[1], BR_EXIT[2], GLITCH], [BR_EXIT[0], BR_EXIT[1] + 1, BR_EXIT[2], GLITCH], [BR_BUG[0], BR_BUG[1], BR_BUG[2], CHEST]]) {
    const lx = x - x0, lz = z - z0; if (lx < 0 || lz < 0 || lx >= CH || lz >= CH) continue;
    for (let yy = BR_Y + 1; yy <= BR_Y + 4; yy++) for (const [ax, az] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) L(lx + ax, yy, lz + az, AIR);
    L(lx, y, lz, id); if (id === CHEST) realmChests.set(x + ',' + y + ',' + z, 'bug');
  }
  reapplyEdits(cx, cz, c); chunkColors(cx, cz);
}
const BR_CEIL = 143;
BT[BR_CEIL] = [139, 139, 139]; HARD[BR_CEIL] = [0.8, null]; BLOCK_DROP[BR_CEIL] = 'br_carpet';
BT[BR_LIGHT] = [139, 138, 139];

// ======================= 1. DEEP CAVES: tunnels, caverns, underground lakes, new ores, treasure chests =======================
// Old saves: every chunk you had built in or explored (plus the older protected lists) keeps its rock solid, like oldCh/townOld/siteOld.
let caveOldSet = null;
function caveInit() {
  if (state.caveV) return;
  if (MP_GUEST) { state.caveV = 1; state.caveOld = ['*']; return; }   // a host without caves: match it
  const ks = new Set([...(state.oldCh || []), ...(state.townOld || []), ...(state.siteOld || []), ...(state.gyOld || [])]);
  for (const k in state.edits || {}) { const p = k.split(','); ks.add(Math.floor(+p[0] / 16) + ',' + Math.floor(+p[2] / 16)); }
  try { const o = JSON.parse(localStorage.getItem('dealercraft_map_' + SLOT)); if (o && o.seed === state.seed && o.c) for (const k in o.c) ks.add(k); } catch (e) {}
  state.caveOld = [...ks]; state.caveV = 1;
}
function caveChOld(cx, cz) { caveInit(); if (!caveOldSet) caveOldSet = new Set(state.caveOld || []); return caveOldSet.has('*') || caveOldSet.has(cx + ',' + cz); }
// 3D value noise on a coarse lattice (smooth, cheap)
function lattice3(cx, cz, seed, sx, sy) {
  const x0 = cx * CH, z0 = cz * CH, ix0 = Math.floor(x0 / sx), iz0 = Math.floor(z0 / sx), nx = Math.floor((x0 + CH) / sx) - ix0 + 2, ny = Math.floor(H / sy) + 2;
  const g = new Float32Array(nx * nx * ny);
  for (let a = 0; a < nx; a++) for (let b = 0; b < nx; b++) for (let c = 0; c < ny; c++) g[(a * nx + b) * ny + c] = hash3(ix0 + a, c, iz0 + b, seed);
  const sm = t => t * t * (3 - 2 * t);
  return (x, y, z) => { const fx = x / sx - ix0, fz = z / sx - iz0, fy = y / sy, a = Math.floor(fx), b = Math.floor(fz), c = Math.floor(fy), u = sm(fx - a), w = sm(fz - b), v = sm(fy - c);
    const G = (i, j, k) => g[((a + i) * nx + (b + j)) * ny + (c + k)];
    const l0 = (G(0, 0, 0) * (1 - u) + G(1, 0, 0) * u) * (1 - w) + (G(0, 1, 0) * (1 - u) + G(1, 1, 0) * u) * w, l1 = (G(0, 0, 1) * (1 - u) + G(1, 0, 1) * u) * (1 - w) + (G(0, 1, 1) * (1 - u) + G(1, 1, 1) * u) * w;
    return l0 * (1 - v) + l1 * v; };
}
const NATURAL = new Set([STONE, DIRT, GRASS, SAND, COAL_ORE, IRON_ORE, SNOW_GRASS, SNOW, DEADGRASS, GRAVE_DIRT]);
let caveStats = { chunks: 0, carved: 0, chests: 0, ores: 0, culled: 0 };
// cave interiors more than a couple of chunks away are skipped by the mesher (you can't see them through the rock anyway); they are
// redrawn in full as you get close. caveMask marks carved cells that sit well under the surface.
const caveMask = new Map(), meshCull = new Map();
let cullPC = null;
function caveCullFor(cx, cz) {
  const key = ckey(cx, cz);
  if (!caveMask.has(key) && !caveMask.has(ckey(cx + 1, cz)) && !caveMask.has(ckey(cx - 1, cz)) && !caveMask.has(ckey(cx, cz + 1)) && !caveMask.has(ckey(cx, cz - 1))) { meshCull.delete(key); return null; }
  const pcx = fdiv(Math.floor(player.pos.x), CH), pcz = fdiv(Math.floor(player.pos.z), CH), far = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) >= (underground() ? 3 : 2);
  meshCull.set(key, far); if (!far) return null; caveStats.culled++;
  return (x, y, z) => { const m = caveMask.get(ckey(fdiv(x, CH), fdiv(z, CH))); return !!(m && y >= 0 && y < H && m[lidx(x - fdiv(x, CH) * CH, y, z - fdiv(z, CH) * CH)]); };
}
const recull = [];
function updateCaveCull() {
  const pcx = fdiv(Math.floor(player.pos.x), CH), pcz = fdiv(Math.floor(player.pos.z), CH), ug = underground(), pk = pcx + ',' + pcz + ',' + ug;
  if (pk !== cullPC) { cullPC = pk; recull.length = 0; const R = ug ? 3 : 2;
    for (const [k, far] of meshCull) { if (!chunks[k]) { meshCull.delete(k); continue; } const [cx, cz] = k.split(',').map(Number), want = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) >= R;
      if (want !== far) recull.push([want ? 1 : 0, Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)), cx, cz]); }
    recull.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const k of caveMask.keys()) if (!data.has(k)) caveMask.delete(k);
  }
  for (let i = 0; i < 2 && recull.length; i++) { const [, , cx, cz] = recull.shift(); if (chunks[ckey(cx, cz)]) buildChunk(cx, cz); }
}
function carveCaves(cx, cz) {
  const c = data.get(ckey(cx, cz)); if (!c) return;
  const x0 = cx * CH, z0 = cz * CH, s = state.seed;
  if (caveChOld(cx, cz) || isOldCh(cx, cz) || Math.hypot(x0 + 8 - VX, z0 + 8 - VZ) < 56) return;
  const sR = siteOf(fdiv(cx, TREG), fdiv(cz, TREG)); if (sR && sR.x0 - 24 < x0 + CH && sR.x1 + 24 > x0 && sR.z0 - 24 < z0 + CH && sR.z1 + 24 > z0) return;
  if (crashSites.has(ckey(cx, cz))) return;
  const town = townAt(x0 + 8, z0 + 8), tChunk = town && inTown(town, x0 + 8, z0 + 8, 10);
  const dens = vnoise((x0 + 8) / 120, (z0 + 8) / 120, s + 31), on = dens > 0.5;
  const A = lattice3(cx, cz, s + 3101, 11, 7), B = lattice3(cx, cz, s + 3102, 11, 7), C = lattice3(cx, cz, s + 3103, 17, 9);
  const entrance = !tChunk && hash2(cx, cz, s + 3104) < 0.1;
  let carved = 0, chestSpot = null, oreN = 0; const mask = new Uint8Array(CH * CH * H);
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
    const x = x0 + lx, z = z0 + lz, t = terrainAt(x, z), h = t.h, wet = t.wl >= h;
    const top = entrance && !wet && h > SEA + 3 ? h + 1 : h - (wet ? 6 : 4);
    for (let y = 2; y < Math.min(top, H - 2); y++) {
      const i = lidx(lx, y, lz), id = c[i];
      if (!NATURAL.has(id)) continue;
      let cave = false;
      if (on) {
        const a = A(x, y, z) - 0.5, b = B(x, y, z) - 0.5, rr = y > h - 6 ? 0.0016 : 0.0032;
        if (a * a + b * b < rr * (0.4 + dens)) cave = true;
        else if (y >= 3 && y <= 24 && C(x, y, z) - Math.abs(y - 11) * 0.012 > 0.715) cave = true;
      }
      if (cave) { c[i] = y <= 4 && C(x, y, z) > 0.7 ? WATER : AIR; carved++; if (c[i] === AIR && y < h - 5) mask[i] = 1; if (!chestSpot && y <= 20 && c[i] === AIR && hash3(x, y, z, s + 3105) < 0.012) chestSpot = [lx, y, lz]; continue; }
      if (id === STONE && y < h - 2) {   // new ores, only in fresh chunks
        const r = hash3(x, y, z, s + 9001);
        if (y <= 12 && r < 0.001) c[i] = DIAMOND_ORE; else if (y <= 22 && r < (h >= 30 ? 0.0028 : 0.0017) && r >= 0.001) c[i] = EMERALD_ORE;
        else if (y <= 16 && r > 0.9955) c[i] = PLAT_ORE; else if (y <= 26 && r > 0.985 && r <= 0.9955) c[i] = GOLD_ORE;
        if (c[i] !== STONE) { caveStats.ores++; oreN++; }
      }
    }
  }
  if (chestSpot && hash2(cx, cz, s + 3106) < 0.45) {
    const [lx, y, lz] = chestSpot; let yy = y; while (yy > 2 && c[lidx(lx, yy - 1, lz)] === AIR) yy--;
    if (solid(c[lidx(lx, yy - 1, lz)]) && c[lidx(lx, yy, lz)] === AIR) { c[lidx(lx, yy, lz)] = CHEST; realmChests.set((x0 + lx) + ',' + yy + ',' + (z0 + lz), 'cave'); caveStats.chests++; }
  }
  if (carved) { caveStats.chunks++; caveStats.carved += carved; caveMask.set(ckey(cx, cz), mask); }
  if (carved || oreN) reapplyEdits(cx, cz, c);
}
{ const gc0 = genChunk; genChunk = function (cx, cz) {
  const r = realmCh(cx);
  if (r === 'moon') return genMoon(cx, cz);
  if (r === 'back') return genBack(cx, cz);
  gc0(cx, cz); carveCaves(cx, cz);
}; }
// loot (same for everyone in an online world: it comes from the chest's position)
function lootFor(key, kind) {
  const r = mulberry(Math.floor(hash3(...key.split(',').map(Number), state.seed + 4242) * 1e9)), L = [], n = (a, b) => a + Math.floor(r() * (b - a + 1));
  if (kind === 'bug') return [['golden_bug', 1], ['torn_note', 1], ['br_light', 2]];
  if (kind === 'moon') { L.push(['alien_relic', n(1, 2)], ['moon_crystal', n(1, 3)], ['moon_cheese', n(1, 4)], ['alien_tech', n(1, 3)]); if (r() < 0.45) L.push(['plasma_cell', n(4, 12)]); if (r() < 0.3) L.push(['uranium', n(1, 2)]); if (r() < 0.2) L.push(['torn_note', 1]); return L; }
  L.push(['gold_ingot', n(1, 4)], ['iron_ingot', n(2, 5)], ['coal', n(3, 9)], ['torch', n(3, 8)]);
  if (r() < 0.35) L.push(['diamond', n(1, 2)]); if (r() < 0.3) L.push(['emerald', n(1, 2)]); if (r() < 0.4) L.push(['platinum_ingot', n(1, 2)]);
  if (r() < 0.2) L.push(['gold_jewelry', 1]); if (r() < 0.05) L.push(['diamond_jewelry', 1]); if (r() < 0.4) L.push(['torn_note', 1]); if (r() < 0.3) L.push(['apple', n(1, 3)]);
  return L;
}
function lootChest(x, y, z) { const k = x + ',' + y + ',' + z, kind = realmChests.get(k); if (kind && get(x, y, z) === CHEST) fillLoot(k, lootFor(k, kind)); }
{ const oc0 = openChest; openChest = function (x, y, z) { lootChest(x, y, z); return oc0(x, y, z); }; }
// caves are dark: deep pockets far from any opening get darker than a roofed room (torches still light them up)
{ const lk0 = lightKit; lightKit = function (x0, z0) {
  if (realmAt(x0 + 8) === 'back') return () => [0.95, 0.1];
  const f = lk0(x0, z0);
  return (x, y, z) => { const r = f(x, y, z); if (r[0] === 0.24 && r[1] === 0 && y < 40 && NATURAL.has(get(x, y + 3, z)) && NATURAL.has(get(x, y + 6, z))) r[0] = 0.11; return r; };
}; }
// cave monsters: night-mob level, any time of day, only in the dark underground (never on peaceful)
let caveSpawnT = 3;
function underground() { const p = pl2(); if (realm() || skyAbove(p.x, p.y, p.z)) return false; return p.y < terrainAt(Math.floor(p.x), Math.floor(p.z)).h - 3; }
function torchNear(x, y, z, r) { for (const k of torches) { const [a, b, c] = k.split(',').map(Number); if (Math.abs(a - x) < r && Math.abs(b - y) < r && Math.abs(c - z) < r) return true; } return false; }
function updateCaveMobs(dt) {
  caveSpawnT -= dt; if (caveSpawnT > 0) return; caveSpawnT = settings.difficulty === 'insane' ? 1.5 : settings.difficulty === 'hard' ? 2.2 : 3;
  if (!canHurtPlayer() || diff().max === 0 || !underground()) return;
  const hostile = mobs.filter(m => MOBDEF[m.type].hostile && m.type !== 'crackhead').length; if (hostile >= diff().max) return;
  const p = pl2();
  for (let k = 0; k < 8; k++) {
    const a = Math.random() * 6.28, r = 10 + Math.random() * 12, x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
    if (!loaded(x, z)) continue;
    for (let y = Math.floor(p.y) + 5; y > Math.max(2, p.y - 8); y--) {
      if (get(x, y, z) === AIR && get(x, y + 1, z) === AIR && solid(get(x, y - 1, z)) && !skyAbove(x, y, z) && !torchNear(x, y, z, 8)) {
        const m = spawnMob(['zombie', 'zombie', 'skeleton', 'creeper'][rint(0, 3)], x + 0.5, y, z + 0.5); if (m) m.cave = true; return;
      }
    }
  }
}

// ======================= 2. UFOs + THE MOON =======================
// A working saucer sits next to every UFO crash site, and the mothership leaves one behind. Fly it above the clouds to reach the Moon.
function buildUfoCraft() { const u = buildUfo(), g = new THREE.Group(); u.g.position.y = 1.25; g.add(u.g); u.lights.visible = true; return { g, body: u.g, spin: u.lights, spinAxis: 'y' }; }
let warpT = 0, warping = 0, padT = 0, ufoCd = 0;
for (const r of state.aircraft || []) if (r && r.kind === 'ufo') spawnAircraft('ufo', r.x, r.y, r.z, r.head, { owned: true, taken: r.taken, id: r.id });   // saved saucers (planes/helis load in p_x_air)
const isUfo = a => a && a.air && a.kind === 'ufo';
function warp(a) {
  const v = R2(), here = realmAt(a.x); warping = 1.2; r2fade.classList.add('on'); beep(140, 1.2, 'sine', 0.06); noiseBurst(1, 0.08, 300);
  setTimeout(() => {
    let nx, nz, msg;
    if (here === 'moon') { const f = v.from || [VX + 20, VZ + 20]; nx = f[0] + (Math.random() - .5) * 20; nz = f[1] + (Math.random() - .5) * 20; msg = '🌍 Welcome back to Earth!'; }
    else { v.from = [Math.round(a.x), Math.round(a.z)]; nx = PAD_X + (Math.random() - .5) * 6; nz = PAD_Z + 14; msg = '🌙 You made it to the Moon! Low gravity: jump high. Climb back above the stars to go home'; }
    a.x = nx; a.z = nz; a.y = 118; a.vy = 0; a.speed = 0; a.onGround = false; a.g.position.set(a.x, a.y, a.z);
    player.pos.set(a.x, a.y + 0.3, a.z); player.fallStart = null;
    for (const m of [...mobs]) if (!m.petId && m !== player.horse) removeMob(m, false);
    syncAircraft(); save();
    setTimeout(() => { r2fade.classList.remove('on'); toast(msg); if (here !== 'moon') { banner('Lunar landing', '🌙 The Moon', 'Grab moon rocks, crystals and alien relics to sell back home'); kpStat('moon'); } }, 700);
  }, 550);
}
function ufoNear(r, rm) { return aircraft.filter(a => a.kind === 'ufo' && realmAt(a.x) === rm && Math.hypot(a.x - pl2().x, a.z - pl2().z) < r); }
function summonUfo() {
  if (player.car) { toast('🛸 Get out first'); return false; }
  if (realm() === 'back') { toast('🛸 ...no signal down here'); return false; }
  const mine = aircraft.find(a => a.kind === 'ufo' && a.owned);
  if (!mine) { toast('🛸 You don\'t have a UFO yet. There\'s a working one at every 🛸 crash site'); return false; }
  if (Math.hypot(mine.x - pl2().x, mine.z - pl2().z) < 30 && realmAt(mine.x) === realm()) { toast('🛸 Your UFO is right here'); return false; }
  if (ufoCd > 0) { toast(`🛸 Your UFO is on its way... (${Math.ceil(ufoCd)}s)`); return false; }
  const a = player.yaw, x = pl2().x - Math.sin(a) * 7, z = pl2().z - Math.cos(a) * 7;
  if (!loaded(x, z)) { toast('🛸 No room to land here'); return false; }
  mine.x = x; mine.z = z; mine.y = groundAt(x, z); mine.onGround = true; mine.vy = 0; mine.speed = 0; mine.g.position.set(mine.x, mine.y, mine.z);
  ufoCd = 45; particles(x, mine.y + 1, z, new THREE.Color(0.5, 1, 0.7), 20); syncAircraft(); toast('🛸 Your UFO is landing next to you'); beep(300, 0.4, 'sine', 0.05); return true;
}
{ const md0 = msDown; msDown = function () {
  md0(); const p = pl2(), x = p.x + 8, z = p.z + 8, y = groundAt(x, z);
  const a = spawnAircraft('ufo', x, y, z, player.yaw, { owned: true }); syncAircraft();
  setTimeout(() => toast('🛸 An escape saucer fell out of the mothership. It still works! ✋ to fly it, climb high to reach the Moon'), 4500);
}; }
function updateUfoWorld(dt) {
  ufoCd = Math.max(0, ufoCd - dt);
  const rm = realm(), p = pl2();
  if (!rm) {   // a parked, working saucer next to each crash site
    for (const [k, c] of crashSites) {
      const key = 'ufo:' + k; if ((state.takenAir || {})[key] || Math.hypot(c.x - p.x, c.z - p.z) > 85) continue;
      const x = c.x + 9.5, z = c.z + 0.5; if (aircraft.some(a => Math.hypot(a.x - x, a.z - z) < 6)) continue;
      if (!loaded(x, z)) continue; const a = spawnAircraft('ufo', x, groundAt(x, z), z, 0.4); a.parkKey = key;
    }
  }
  if (rm === 'moon') {   // never stranded: a spare shuttle saucer waits at the landing pad
    padT -= dt; if (padT <= 0) { padT = 3; if (!aircraft.some(a => a.kind === 'ufo' && realmAt(a.x) === 'moon') && loaded(PAD_X, PAD_Z)) spawnAircraft('ufo', PAD_X + 0.5, 25, PAD_Z + 0.5, 0); }
  }
  const a = player.car;
  if (isUfo(a) && !warping) {
    if (a.y >= 128) { warpT += dt; if (warpT > 1.6) { warpT = 0; warp(a); } } else warpT = 0;
  } else warpT = 0;
  if (warping > 0) warping -= dt;
}
// moon sky: black with stars, the Earth hanging overhead; Backrooms: flat yellow murk
function earthTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(120,180,255,.5)'); g.addColorStop(1, 'rgba(120,180,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.save(); x.beginPath(); x.arc(64, 64, 34, 0, 7); x.clip(); x.fillStyle = '#2a6ad2'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#3fa34d'; for (const [a, b, w, h] of [[40, 44, 26, 18], [70, 60, 22, 26], [48, 76, 14, 10], [80, 38, 12, 8]]) { x.beginPath(); x.ellipse(a, b, w / 2, h / 2, 0.4, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(255,255,255,.8)'; for (const [a, b, w] of [[52, 40, 20], [76, 72, 18], [40, 64, 12], [66, 90, 16]]) { x.fillRect(a - w / 2, b, w, 3); }
  x.fillStyle = 'rgba(0,0,30,.35)'; x.beginPath(); x.arc(84, 64, 34, 0, 7); x.fill(); x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: earthTexture(), fog: false, depthWrite: false, transparent: true })); earth.scale.set(46, 46, 1); earth.renderOrder = -1; earth.visible = false; scene.add(earth);
const _edir = new THREE.Vector3(0.45, 0.55, -0.7).normalize();
{ const us0 = updateSky; updateSky = function () {
  us0(); const rm = realm(); earth.visible = rm === 'moon';
  if (!rm) return;
  nightAmt = 0.2;   // no night monsters, UFO raids or ghosts up here
  if (rm === 'moon') {
    sky.setRGB(0.01, 0.01, 0.025); scene.background = sky; scene.fog.color.setRGB(0.02, 0.02, 0.04); scene.fog.near = 30 * VIEW / 4; scene.fog.far = 80 * VIEW / 4;
    stars.position.copy(camera.position); starMat.opacity = 1; moon.material.opacity = 0; earth.position.copy(camera.position).addScaledVector(_edir, 160);
    ambient.color.setRGB(0.85, 0.88, 1); ambient.intensity = 0.55; sun.intensity = 0.75; sun.position.set(40, 60, 30); moonLight.intensity = 0;
  } else {
    sky.setRGB(0.32, 0.29, 0.14); scene.background = sky; scene.fog.color.setRGB(0.42, 0.38, 0.2); scene.fog.near = 4; scene.fog.far = 34;
    starMat.opacity = 0; moon.material.opacity = 0; ambient.color.setRGB(1, 0.97, 0.8); ambient.intensity = 0.75; sun.intensity = 0.2; moonLight.intensity = 0;
  }
}; }

// ======================= 3. CAR MODS+: engine & handling stages, rims, neon (nitro + paint were v1.13) =======================
const ENG = [0, 300, 650, 1100], HAND = [0, 250, 500, 850], RIMS = [0xd8d8d8, 0xffc830, 0x18181a, 0xd02020, 0x2a6ad2, 0x40ff80], RIM_PRICE = 120;
const NEON = [0xff3ad0, 0x30a0ff, 0x30ff80, 0xff3030, 0xa040ff, 0xff9a20], NEON_PRICE = 200;
function applyLooks(c) {
  const m = c.mods || {};
  if (m.rim != null && RIMS[m.rim] != null) for (const o of c.g.children) if (o.isMesh && (o.material === rimMat || o.userData.rim)) { if (!o.userData.rim) { o.material = new THREE.MeshLambertMaterial({ color: RIMS[m.rim] }); o.userData.rim = true; } else o.material.color.setHex(RIMS[m.rim]); }
  if (m.neon != null && NEON[m.neon] != null) {
    if (!c.neonMesh) { c.neonMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 4), new THREE.MeshBasicMaterial({ color: NEON[m.neon], transparent: true, opacity: 0.55, depthWrite: false })); c.neonMesh.position.y = 0.1; c.g.add(c.neonMesh); }
    c.neonMesh.material.color.setHex(NEON[m.neon]);
  }
}
{ const am0 = applyMods; applyMods = function (c, mods) { am0(c, mods); applyLooks(c); }; }
function buyMod2(what, arg) {
  const c = garageCar(); if (!c) { toast('🔧 Drive a car up to the garage first'); return false; }
  if (c.kind === 'police') { toast('🚓 "I ain\'t touching a cop car, man."'); return false; }
  const m = c.mods || {};
  if (what === 'eng' || what === 'hand') {
    const lv = (m[what] || 0) + 1, P = what === 'eng' ? ENG : HAND; if (lv >= P.length) { toast('🔧 Already maxed out'); return false; }
    if (!payAny(P[lv], false)) { toast(`💸 Stage ${lv} costs 💰${P[lv]}`); return false; }
    makeMine(c)[what] = lv; toast(what === 'eng' ? `⚙️ Engine stage ${lv}! Faster top speed and acceleration` : `🛞 Handling stage ${lv}! Sharper steering`);
  } else if (what === 'rim' || what === 'neon') {
    const i = +arg, list = what === 'rim' ? RIMS : NEON, price = what === 'rim' ? RIM_PRICE : NEON_PRICE; if (list[i] == null) return false;
    if (!payAny(price, false)) { toast(`💸 That's 💰${price}`); return false; }
    makeMine(c)[what] = i; applyLooks(c); toast(what === 'rim' ? '🛞 New rims fitted!' : '💡 Underglow on! Looks sick at night');
  } else return false;
  V13().car = { ...c.mods }; coinSnd(); kpStat('mod'); kpStat('mod2'); return true;
}
{ const gh0 = garageHTML; garageHTML = function () {
  let h = gh0(); const c = garageCar(); if (!c || c.kind === 'police') return h; const m = c.mods || {};
  const stage = (k, P, lab) => { const lv = m[k] || 0; return `<div class="krow"><span class="nm"><b>${lab}</b> · stage ${lv}/3<br><span style="opacity:.7;font-size:12px">${k === 'eng' ? '+12% top speed, +20% acceleration per stage' : '+12% steering per stage'}</span></span>${lv >= 3 ? '<b>✅ maxed</b>' : `<button class="btn gold" data-kp15="${k}" ${cashTotal() >= P[lv + 1] ? '' : 'disabled'}>💰 ${P[lv + 1]}</button>`}</div>`; };
  h += `<h3>⚙️ Performance</h3>${stage('eng', ENG, '⚙️ Engine tune')}${stage('hand', HAND, '🛞 Handling')}`;
  h += `<h3>🛞 Rims · 💰${RIM_PRICE}</h3><div>${RIMS.map((col, i) => `<span class="r2sw${m.rim === i ? ' on' : ''}" data-kp15="rim:${i}" style="background:#${col.toString(16).padStart(6, '0')}"></span>`).join('')}</div>`;
  h += `<h3>💡 Underglow neon · 💰${NEON_PRICE}</h3><div>${NEON.map((col, i) => `<span class="r2sw${m.neon === i ? ' on' : ''}" data-kp15="neon:${i}" style="background:#${col.toString(16).padStart(6, '0')}"></span>`).join('')}</div>`;
  return h;
}; }
// horn: H / 📯 while driving. Honk 5 times fast and... well, find out.
let honks = [];
function honk() {
  const c = player.car; if (!c || c.air || c.vessel || !cars.includes(c)) return;
  beep(392, 0.22, 'square', 0.05); setTimeout(() => beep(330, 0.22, 'square', 0.05), 40);
  const now = performance.now() / 1000; honks = honks.filter(t => now - t < 4); honks.push(now);
  for (const m of mobs) if (m.type === 'ped' && m.g.position.distanceTo(c.g.position) < 9 && !m.glitch) { m.panic = Math.max(m.panic || 0, 1.5); }
  if (honks.length >= 5 && !(c.floatT > 0)) { honks = []; c.floatT = 7; c.floatY = c.y + 3.5; toast('🚗💨 ...the car is floating??'); glitchFound('floatcar'); }
}
addEventListener('keydown', e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; if (e.code === 'KeyH' && playing && !uiOpen) honk(); });
{ const hb = document.createElement('div'); hb.className = 'tb'; hb.id = 'bHorn'; hb.textContent = '📯'; const ref = document.getElementById('bUp'); (ref ? ref.parentNode : document.body).appendChild(hb); hb.addEventListener('click', () => honk()); }
function updateFloatCars(dt) {
  for (const c of cars) if (c.floatT > 0) {
    c.floatT -= dt; c.vy = 0; c.y += (c.floatY - c.y) * Math.min(1, dt * 2); c.g.position.y = c.y; c.g.rotation.z = Math.sin(performance.now() / 300) * 0.06;
    if (c === player.car) { player.pos.y = c.y + 1.2 - EYE; }
    if (c.floatT <= 0) c.g.rotation.z = 0;
  }
  document.body.classList.toggle('r2drive', !!(player.car && !player.car.air && !player.car.vessel && cars.includes(player.car)));
}
// online: other players see your ride (kind, paint, rims, neon) or your aircraft
function meExtra() {
  const c = player.car; if (!c) return {};
  if (c.air) return { car: { k: c.kind, h: +c.head.toFixed(2), y: +c.y.toFixed(2) } };
  if (c.vessel || !cars.includes(c)) return {};
  const m = c.mods || {};
  return { car: { k: c.kind === 'police' ? 'police' : 'car', h: +c.head.toFixed(2), y: +c.y.toFixed(2), c: c.col != null ? c.col : null, r: m.rim ?? null, n: m.neon ?? null } };
}
function remoteExtra(r, d, dt) {
  const cd = d && d.car, key = cd ? JSON.stringify([cd.k, cd.c, cd.r, cd.n]) : '';
  if (r.carKey !== key) {
    if (r.carMesh) { scene.remove(r.carMesh); r.carMesh = null; }
    r.carKey = key;
    if (cd) {
      let g;
      if (cd.k === 'ufo') g = buildUfoCraft().g; else if (cd.k === 'plane') g = buildPlane().g; else if (cd.k === 'helicopter') g = buildHeli().g;
      else { const o = buildCar(cd.k === 'police' ? 'police' : 'car', 0); const fake = { g: o.g, mods: { rim: cd.r, neon: cd.n } }; if (cd.c != null) paintCar(fake, cd.c); applyLooks(fake); g = o.g; }
      r.carMesh = g; scene.add(g); g.position.set(d.x, cd.y, d.z);
    }
  }
  if (r.carMesh && cd) { const g = r.carMesh, k = Math.min(1, dt * 10); g.position.x += (d.x - g.position.x) * k; g.position.y += (cd.y - g.position.y) * k; g.position.z += (d.z - g.position.z) * k;
    let dy = cd.h - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * k; g.visible = performance.now() - r.recv < 12000; if (r.av && cd.k !== 'ufo' && cd.k !== 'plane' && cd.k !== 'helicopter') r.av.g.visible = false; }
}

// ======================= 4. PLAYER SHOPS: a stall you stock and price; players (online) and townsfolk buy from it =======================
const myId = () => auth ? auth.uid : 'local';
const myName = () => auth ? auth.name : 'You';
const shopMine = s => s && (s.o === myId() || (s.o === 'local' && !MP_GUEST));
const ownerHere = s => { if (shopMine(s)) return true; if (!net.on) return false; const r = net.remotes[s.o]; return !!(r && performance.now() - r.recv < 15000); };
const shopVal = id => Math.max(1, Math.round(itemValue(id) || 1));
function netShop(k) { if (!net.on) return; db('PATCH', 'rooms/' + net.code, { ['shops/' + k]: JSON.stringify(state.shops[k] || null) }).catch(() => {}); }
const shopsNet = () => { const o = {}; for (const k in state.shops) o[k] = JSON.stringify(state.shops[k]); return o; };
const paidSeen = new Set();
function netExtra(top, key, rest, data) {
  if (top === 'shops') {
    if (!key) { for (const k in (data || {})) netExtra('shops', k, [], data[k]); return; }
    try { const v = typeof data === 'string' ? JSON.parse(data) : data; if (v) state.shops[key] = v; else delete state.shops[key]; } catch (e) {}
    if (kpShown() && kpMode === 'shop' && kpVenue === key) renderKp(); return;
  }
  if (top === 'pay') {
    if (!key) { for (const u in (data || {})) netExtra('pay', u, [], data[u]); return; }
    if (!auth || key !== auth.uid) return;
    const recs = rest.length ? { [rest[0]]: data } : (data || {});
    for (const rid in recs) { const p = recs[rid]; if (!p || paidSeen.has(rid)) continue; paidSeen.add(rid);
      const s = state.shops[p.k]; if (s) { s.sold = (s.sold || 0) + 1; }
      addClean(p.a, `🛒 ${String(p.b || 'Someone').slice(0, 16)} bought ${ITEMS[p.i] ? ITEMS[p.i].name : 'something'} from your shop · +💰${p.a}`); kpStat('shopSale');
      db('DELETE', `rooms/${net.code}/pay/${auth.uid}/${rid}`).catch(() => {}); }
  }
}
{ const sb0 = setBlock; setBlock = function (x, y, z, id, now) {
  const k = x + ',' + y + ',' + z, old = get(x, y, z); const r = sb0(x, y, z, id, now);
  if (id === SHOP && old !== SHOP && !netMute && !state.shops[k]) { state.shops[k] = { o: myId(), on: myName(), items: [], till: 0, sold: 0 }; netShop(k); setTimeout(() => toast('🏪 Shop stall placed! ✋ it to stock items and set prices'), 50); }
  return r;
}; }
{ const fb0 = finishBreak; finishBreak = function (h) {
  if (h.id === GLITCH) { toast('🐛 *bzzzt* ...it doesn\'t want to break'); return; }
  if (h.id === CHEST) lootChest(h.x, h.y, h.z);
  if (h.id === SHOP) {
    const k = h.x + ',' + h.y + ',' + h.z, s = state.shops[k];
    if (s && !shopMine(s)) { toast(`🏪 That's ${esc(s.on || 'someone')}'s shop. Only the owner can take it down`); return; }
    const r = fb0(h);
    if (s) { for (const it of s.items) if (it.n > 0) give(it.id, it.n); if (s.till > 0) addClean(s.till, `🏪 Emptied the till: +💰${s.till}`); delete state.shops[k]; netShop(k); }
    return r;
  }
  return fb0(h);
}; }
function shopHTML(k) {
  const s = state.shops[k]; if (!s) return '<h2>🏪 Shop</h2><div class="ksub">This stall is closed.</div>';
  const mine = shopMine(s);
  let h = `<h2>🏪 ${esc(mine ? 'Your shop' : (s.on || 'Player') + '\'s shop')}</h2>${balHTML()}`;
  if (mine) {
    h += `<div class="ksub">Stock items from your bag and set a price. Friends in your online world can buy while you're here, and townsfolk drop by now and then and buy cheap stuff (money goes in the till).</div>`;
    h += `<div class="krow"><span class="nm">💰 Till: <b>${Math.floor(s.till || 0)}</b> · sold ${s.sold || 0}</span><button class="btn gold" data-kp15="till:${k}" ${s.till >= 1 ? '' : 'disabled'}>Collect</button></div><h3>On the shelf</h3>`;
    h += s.items.length ? s.items.map((it, i) => `<div class="krow"><span class="ic">${iconHTML(it.id)}</span><span class="nm">${ITEMS[it.id] ? ITEMS[it.id].name : it.id} ×${it.n}<br><span style="opacity:.6;font-size:12px">worth ~${shopVal(it.id)}</span></span><span class="r2pr"><button class="btn" data-kp15="pdn:${k}:${i}">−</button><b>💰${it.p}</b><button class="btn" data-kp15="pup:${k}:${i}">+</button></span><button class="btn" data-kp15="back:${k}:${i}">Take back</button></div>`).join('') : '<div class="ksub" style="text-align:center">Empty shelf. Stock something below.</div>';
    const bag = []; const seen = new Set(); for (const sl of state.slots) if (sl && !seen.has(sl.id) && !ITEMS[sl.id].tool && !ITEMS[sl.id].armor && sl.id !== 'golden_bug' && !GUNS[sl.id]) { seen.add(sl.id); bag.push(sl.id); }
    h += '<h3>Stock from your bag</h3>' + (bag.length ? bag.map(id => `<div class="krow"><span class="ic">${iconHTML(id)}</span><span class="nm">${ITEMS[id].name} <span style="opacity:.6">(have ${count(id)})</span></span><button class="btn" data-kp15="st1:${k}:${id}">+1</button><button class="btn gold" data-kp15="stA:${k}:${id}">All</button></div>`).join('') : '<div class="ksub">Nothing you can sell in your bag (tools, armour and guns stay with you).</div>');
  } else {
    const here = ownerHere(s);
    h += `<div class="ksub">${here ? 'Pay with 💰 clean first, then 💵 dirty. The money goes straight to the owner.' : '😴 The owner isn\'t here right now, so the shop is closed. Come back when they\'re online in this world.'}</div>`;
    h += s.items.filter(it => it.n > 0).map((it, i) => `<div class="krow"><span class="ic">${iconHTML(it.id)}</span><span class="nm">${ITEMS[it.id] ? ITEMS[it.id].name : it.id} ×${it.n}</span><b>💰${it.p}</b><button class="btn gold" data-kp15="buy:${k}:${s.items.indexOf(it)}" ${here && cashTotal() >= it.p ? '' : 'disabled'}>Buy 1</button></div>`).join('') || '<div class="ksub" style="text-align:center">Sold out!</div>';
  }
  return h;
}
function shopAct(a, k, arg) {
  const s = state.shops[k]; if (!s) return;
  if (a === 'buy') {
    const it = s.items[+arg]; if (!it || it.n <= 0 || shopMine(s) || !ownerHere(s)) return;
    if (!payAny(it.p, false)) { toast(`💸 That's 💰${it.p}`); return; }
    it.n--; give(it.id, 1); const paid = it.p, id = it.id; if (it.n <= 0) s.items.splice(+arg, 1); netShop(k);
    if (net.on) db('PATCH', `rooms/${net.code}/pay/${s.o}`, { ['p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)]: { a: paid, i: id, k, b: myName() } }).catch(() => {});
    coinSnd(); toast(`🛒 Bought ${ITEMS[id].name} for 💰${paid}`); return;
  }
  if (!shopMine(s)) return;
  if (a === 'till') { const n = Math.floor(s.till || 0); if (n > 0) { s.till -= n; addClean(n, `🏪 Collected 💰${n} from the till`); } }
  else if (a === 'st1' || a === 'stA') {
    const id = arg, have = count(id); if (!have || !ITEMS[id]) return; const n = a === 'stA' ? have : 1;
    let it = s.items.find(q => q.id === id); if (!it) { if (s.items.length >= 12) { toast('🏪 The shelf is full (12 kinds)'); return; } it = { id, n: 0, p: Math.max(1, Math.round(shopVal(id) * 1.2)) }; s.items.push(it); }
    take(id, n); it.n += n;
  } else if (a === 'back') { const it = s.items[+arg]; if (it) { if (it.n > 0) give(it.id, it.n); s.items.splice(+arg, 1); } }
  else if (a === 'pup' || a === 'pdn') { const it = s.items[+arg]; if (it) it.p = Math.max(1, Math.min(99999, a === 'pup' ? Math.max(it.p + 1, Math.round(it.p * 1.1)) : Math.min(it.p - 1, Math.round(it.p * 0.9)))); }
  netShop(k);
}
// townsfolk shoppers (solo, or for your own stalls online): cheaper than it's worth = sells faster
let shopT = 0;
function updateShops(dt) {
  shopT += dt; if (shopT < 1) return; const step = shopT; shopT = 0;
  if (net.on && net.role === 'host') for (const k in state.shops) { const s = state.shops[k]; if (s.o === 'local' && auth) { s.o = auth.uid; s.on = auth.name; netShop(k); } }
  for (const k in state.shops) {
    const s = state.shops[k]; if (!shopMine(s)) continue;
    const [x, y, z] = k.split(',').map(Number); if (!loaded(x, z)) continue;
    if (get(x, y, z) !== SHOP) { delete state.shops[k]; netShop(k); continue; }   // blown up or replaced
    if (Math.hypot(x - pl2().x, z - pl2().z) > 140 || !s.items.some(it => it.n > 0)) continue;
    s.npcT = (s.npcT ?? 30 + Math.random() * 40) - step; if (s.npcT > 0) continue;
    s.npcT = (realmAt(x) ? 120 : townAt(x, z) && inTown(townAt(x, z), x, z, 6) ? 40 : 75) + Math.random() * 50;
    const it = s.items.filter(q => q.n > 0)[rint(0, s.items.filter(q => q.n > 0).length - 1)], ratio = it.p / shopVal(it.id);
    if (Math.random() > Math.max(0.04, Math.min(0.92, 1.55 - ratio))) continue;
    it.n--; s.till = (s.till || 0) + it.p; s.sold = (s.sold || 0) + 1; const nm = ITEMS[it.id] ? ITEMS[it.id].name : it.id; if (it.n <= 0) s.items.splice(s.items.indexOf(it), 1);
    netShop(k); kpStat('shopSale');
    if (Math.hypot(x - pl2().x, z - pl2().z) < 40) { toast(`🛒 A shopper bought ${nm} from your stall · +💰${it.p} in the till`); coinSnd(); particles(x + 0.5, y + 1.3, z + 0.5, new THREE.Color(1, 0.85, 0.2), 8); }
  }
}
const shopTags = new Map();
function updateShopTags() {
  for (const [k, sp] of shopTags) if (!state.shops[k] || sp.position.distanceTo(pl2()) > 40) { scene.remove(sp); shopTags.delete(k); }
  for (const k in state.shops) { if (shopTags.has(k)) continue; const [x, y, z] = k.split(',').map(Number); if (Math.hypot(x - pl2().x, z - pl2().z) > 36) continue;
    const s = state.shops[k], sp = nameSprite(`🏪 ${shopMine(s) ? 'Your shop' : (s.on || 'Player') + '\'s shop'}`); sp.position.set(x + 0.5, y + 1.9, z + 0.5); scene.add(sp); shopTags.set(k, sp); }
}

// ======================= 5. HIDDEN GLITCHES (Glitch Hunter x/6) =======================
// All harmless: nothing here edits the world, and every glitch puts you somewhere safe afterwards.
const GLITCHES = {
  backrooms: { n: '🟨 No-clip into the Backrooms', h: 'Deep, deep down... push a wall long enough and it gives up.' },
  tpose: { n: '🧍 ped_NULL, the T-posing townie', h: 'Some townsfolk forget their animations. ✋ one.' },
  floatcar: { n: '🚗 Anti-gravity honk', h: 'Cars don\'t like being honked at. A lot.' },
  void: { n: '🕳️ Fell out of the world', h: 'In a place with no exits, look down.' },
  bug: { n: '🐛 Buggy\'s Golden Bug', h: 'Somewhere in the yellow rooms, someone left a present.' },
  cowexe: { n: '🐄 cow.exe has stopped working', h: 'Out in the fields, look up. Way up.' },
};
const GL_IDS = Object.keys(GLITCHES);
const glitchN = () => GL_IDS.filter(k => R2().gl[k]).length;
function glitchFound(id) {
  const v = R2(); if (v.gl[id] || !GLITCHES[id]) return false;
  v.gl[id] = Math.max(1, Math.round(state.gameTime)); const n = glitchN();
  banner('Glitch found', `🐛 Glitch Hunter ${n}/6`, GLITCHES[id].n); kpStat('glitch');
  noiseBurst(0.4, 0.1, 1800); beep(180, 0.08, 'square', 0.05); setTimeout(() => beep(1400, 0.12, 'square', 0.05), 90);
  return true;
}
ACH.push(['glitch1', '🐛 Bug Spotter', 'Find your first hidden glitch', s => s.glitch >= 1], ['glitch6', '🐛 Glitch Hunter', 'Find all 6 hidden glitches', s => s.glitch >= 6],
  ['moon', '🌙 One Small Step', 'Fly a UFO to the Moon', s => s.moon >= 1], ['shopkeep', '🏪 Open for Business', 'Sell 10 things from your own shop', s => s.shopSale >= 10],
  ['tuner', '⚙️ Tuner', 'Buy 5 performance / looks mods', s => s.mod2 >= 5]);
const NOTES = ['"If you\'re deep enough underground and you push a wall for long enough... it lets you in." — B.', '"Honk honk honk honk honk. Trust me." — B.',
  '"The yellow rooms have a hole in the floor. Don\'t look down. Or do." — B.', '"Saw a cow in the sky past the farms. Nobody believes me." — B.',
  '"Some townies glitch out and T-pose. Go say hi." — B.', '"Diamonds sit deep, under y 12. Emeralds love the mountains." — B.', '"Thanks for watching Buggy Games YT. Subscribe or the bugs win." — B.'];
// Backrooms entry: deep in the dark (y < 12, under rock), keep walking into a wall for 4 seconds
let pushT = 0, lastPP = null, voidT = 0, brLeaving = false;
function updateGlitches(dt, t) {
  const p = pl2(), rm = realm();
  // 1. wall push no-clip
  const fwd = (keys.KeyW || keys.ArrowUp) || (joy.id !== null && joy.y < -0.5);
  if (!rm && !player.car && fwd && p.y < 12 && !uiOpen && (pushT > 0 || p.y < terrainAt(Math.floor(p.x), Math.floor(p.z)).h - 3)) {
    const moved = lastPP ? Math.hypot(p.x - lastPP.x, p.z - lastPP.z) : 1;
    const fx = Math.floor(p.x - Math.sin(player.yaw) * 0.6), fz = Math.floor(p.z - Math.cos(player.yaw) * 0.6);
    if (moved < 0.01 && solid(get(fx, Math.floor(p.y + 0.5), fz))) { pushT += dt; if (pushT > 2.5 && Math.random() < dt * 6) shake(0.1, 0.03); if (pushT > 4) { pushT = 0; enterBackrooms(); } } else pushT = Math.max(0, pushT - dt * 2);
  } else pushT = 0;
  lastPP = p.clone();
  // in the Backrooms: the exit and the hole to the void
  if (rm === 'back' && !voidT && !brLeaving && !tpWait) {
    if (Math.hypot(p.x - (BR_EXIT[0] + 0.5), p.z - (BR_EXIT[2] + 0.5)) < 1.25 && p.y < BR_Y + 4) leaveBackrooms('🟩 You glitched back into reality.');
    else if (p.y < BR_Y - 6) startVoid();
  }
  if (voidT > 0) { voidT -= dt; player.pos.set(BR_HOLE[0] + 0.5, BR_Y - 7, BR_HOLE[1] + 0.5); player.vel.set(0, 0, 0); player.fallStart = null; if (voidT <= 0) { r2void.classList.remove('on'); voidT = 0; leaveBackrooms('🌍 ...you woke up back home.'); } }
  if (count('golden_bug') > 0) glitchFound('bug');
  // glitch mobs: T-posing ped in towns, cow.exe floating over the fields
  for (const m of mobs) if (m.glitch) {
    if (m.glitch === 'tpose') { for (const a of m.arms || []) { a.rotation.x = 0; a.rotation.z = (a.position.x < 0 ? -1 : 1) * Math.PI / 2; } for (const l of m.legs || []) l.rotation.x = 0; m.g.rotation.y += dt * 1.5; m.g.visible = Math.random() > 0.04; }
    else if (m.glitch === 'cow') { m.vel.set(0, 0, 0); m.g.position.y = m.fy + Math.sin(t * 1.3) * 0.35; m.g.rotation.z = Math.PI; m.g.rotation.y += dt * 0.4; }
  }
  glT -= dt; if (glT > 0) return; glT = 15;
  if (rm || !player.alive || player.car) return;
  const v = R2(), tn = townsNear(30)[0];
  if (tn && !v.gl.tpose && !mobs.some(m => m.glitch === 'tpose') && Math.random() < 0.12) spawnGlitchMob('tpose');
  if (!tn && !v.gl.cowexe && !mobs.some(m => m.glitch === 'cow') && Math.random() < 0.06 && (chunkBiome.get(ckey(fdiv(Math.floor(p.x), CH), fdiv(Math.floor(p.z), CH))) || 'plains') !== 'desert') spawnGlitchMob('cow');
}
let glT = 20;
function spawnGlitchMob(kind) {
  const p = pl2();
  for (let k = 0; k < 10; k++) {
    const a = Math.random() * 6.28, r = 14 + Math.random() * 10, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (!loaded(x, z)) continue;
    const y = groundAt(x, z); if (isWater(get(Math.floor(x), y - 1, Math.floor(z))) || y > H - 10) continue;
    const m = spawnMob(kind === 'tpose' ? 'ped' : 'cow', Math.floor(x) + 0.5, kind === 'tpose' ? y : y + 6, Math.floor(z) + 0.5); if (!m) return null;
    m.glitch = kind; m.fy = y + 6; m.wait = 1e9;
    const tag = nameSprite(kind === 'tpose' ? 'ped_NULL' : 'cow.exe'); tag.position.y = kind === 'tpose' ? 2.4 : 2; m.g.add(tag); m.glTag = tag;
    return m;
  }
  return null;
}
function unglitch(m) {
  if (!m.glitch) return; const k = m.glitch; m.glitch = null; if (m.glTag) m.g.remove(m.glTag); m.g.rotation.z = 0; m.g.visible = true;
  particles(m.g.position.x, m.g.position.y + 1, m.g.position.z, new THREE.Color(1, 0.2, 1), 16); noiseBurst(0.3, 0.1, 2200);
  glitchFound(k === 'tpose' ? 'tpose' : 'cowexe'); toast(k === 'tpose' ? '🧍 ped_NULL finally loaded its animations' : '🐄 cow.exe restarted... and fell out of the sky');
}
{ const im5 = interactMob; interactMob = function (m, id, it) { if (m && m.glitch) { unglitch(m); return true; } return im5(m, id, it); }; }
{ const hm5 = hurtMob; hurtMob = function (m, dmg, from, noDrop) { if (m && m.glitch) { unglitch(m); return; } return hm5(m, dmg, from, noDrop); }; }
{ const ml5 = mobLabel; mobLabel = function (m) { if (m && m.glitch) return m.glitch === 'tpose' ? '🧍 ped_NULL · ✋ ???' : '🐄 cow.exe · ✋ ???'; return ml5(m); }; }
// teleport and hold still until the land there has loaded, then stand on the first free spot
let tpWait = null;
function tpSafe(x, y, z, cb) { tpWait = { x, y, z, cb, t: 0 }; window.__freeze = 1; player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.fallStart = null; }
function updateTp(dt) {
  if (!tpWait) return; const w = tpWait; w.t += dt; player.pos.set(w.x, w.y, w.z); player.vel.set(0, 0, 0); player.fallStart = null;
  if (!loaded(w.x, w.z) && w.t < 20) return;
  const bx = Math.floor(w.x), bz = Math.floor(w.z); let y = Math.max(1, Math.floor(w.y)); while (y < H - 2 && (solid(get(bx, y, bz)) || solid(get(bx, y + 1, bz)))) y++;
  player.pos.set(w.x, y + 0.01, w.z); tpWait = null; window.__freeze = 0; if (w.cb) w.cb();
}
function enterBackrooms() {
  const v = R2(), p = pl2(); v.brFrom = [Math.round(p.x * 10) / 10, Math.ceil(p.y), Math.round(p.z * 10) / 10];
  // a safe way home: the spot you clipped from, or the nearest open air above it
  r2fade.classList.add('on'); noiseBurst(0.8, 0.12, 2400);
  setTimeout(() => { for (const m of [...mobs]) if (!m.petId && m !== player.horse) removeMob(m, false);
    tpSafe(BR_X + 0.5, BR_Y + 1.01, 0.5, () => { r2fade.classList.remove('on'); toast('🟨 You no-clipped out of reality... find the glitchy EXIT'); glitchFound('backrooms'); }); }, 400);
}
function leaveBackrooms(msg) {
  const v = R2(), f = v.brFrom; r2fade.classList.add('on'); brLeaving = true;
  setTimeout(() => {
    const done = () => { brLeaving = false; setTimeout(() => { r2fade.classList.remove('on'); toast(msg); }, 300); };
    if (f) tpSafe(Math.floor(f[0]) + 0.5, Math.max(2, f[1]), Math.floor(f[2]) + 0.5, done); else tpSafe(VX + 0.5, G + 2, VZ - 4.5, done);
    v.brFrom = null;
  }, 450);
}
function startVoid() {
  voidT = 7; window.__freeze = 1; glitchFound('void');
  r2void.innerHTML = '<b>YOU FELL OUT OF THE WORLD</b><i>there is nothing down here. well... almost nothing.</i><i>🐛 BUGGY WAS HERE 🐛</i><i>thanks for watching Buggy Games YT. glitch hunters never stop.</i>';
  r2void.classList.add('on'); beep(60, 2.5, 'sine', 0.06);
}
// ✋ actions: shop stalls, torn notes, UFO parking, the golden bug
{ const use5 = useAction; useAction = function () {
  if (!player.alive) return;
  if (!uiOpen && !player.car && !player.horse) {
    const id = held();
    const h = raycast();
    if (h && h.kind === 'block' && h.id === SHOP) { const k = h.x + ',' + h.y + ',' + h.z; if (!state.shops[k]) state.shops[k] = { o: myId(), on: myName(), items: [], till: 0, sold: 0 }; openKp('shop', k); return; }
    if (id === 'torn_note') { toast('📜 ' + NOTES[Math.floor(hash2(state.gameTime | 0, count('torn_note'), 7) * NOTES.length) % NOTES.length]); swing(); return; }
    if (id === 'golden_bug') { swing(); toast(['🐛 *bzzzt*', '🐛 The Golden Bug hums: "subscribe"', '🐛 It glitches a little in your hand', '🐛 Buggy\'s Golden Bug sparkles'][rint(0, 3)]); particles(pl2().x, pl2().y + 1.4, pl2().z, new THREE.Color(1, 0.85, 0.1), 10); return; }
  }
  return use5();
}; }
{ const rk5 = renderKp; renderKp = function () {
  if (kpMode !== 'shop') return rk5();
  document.getElementById('kpBox').innerHTML = '<button class="btn close" data-kpx="1" style="float:right">✕</button>' + shopHTML(kpVenue);
}; }
kpEl.addEventListener('click', e => {
  const b = e.target.closest('[data-kp15]'); if (!b || b.disabled) return; const [a, x, y] = b.dataset.kp15.split(':');
  if (a === 'eng' || a === 'hand') buyMod2(a); else if (a === 'rim' || a === 'neon') buyMod2(a, x); else shopAct(a, x, y);
  if (kpShown()) renderKp();
});
{ const ut5 = updateTarget; updateTarget = function () {
  ut5(); if (!playing || player.car) return; const el = document.getElementById('target'), h = raycast();
  if (h && h.kind === 'block' && h.id === SHOP) { const s = state.shops[h.x + ',' + h.y + ',' + h.z]; el.style.display = 'block'; el.textContent = s && !shopMine(s) ? `🏪 ${s.on || 'Player'}'s shop · ✋ browse` : '🏪 Your shop · ✋ stock & prices'; }
  else if (h && h.kind === 'block' && h.id === GLITCH) { el.style.display = 'block'; el.textContent = '▓▒░ E X I T ░▒▓'; }
}; }

// ---- 📱 🛸 Extras app: UFO, Moon, shops, Glitch Hunter
function extrasApp() {
  const v = R2(), mine = aircraft.find(a => a.kind === 'ufo' && a.owned), shops = Object.entries(state.shops).filter(([, s]) => shopMine(s));
  let h = `<div class="pappbar">🛸 Extras</div><div class="pplug">`;
  h += `<h4>🛸 UFO & the Moon</h4><div class="pst">${mine ? `Your UFO is ${realmAt(mine.x) === 'moon' ? 'on the 🌙 Moon' : realmAt(mine.x) ? 'somewhere weird' : 'on 🌍 Earth'} · ${Math.round(Math.hypot(mine.x - pl2().x, mine.z - pl2().z))} m away` : 'No UFO yet. A working saucer sits next to every 🛸 crash site (and the mothership drops one).'}<br><span style="opacity:.75;font-size:12px">Fly it straight up above 128 to leave for the Moon, and do the same on the Moon to come home.</span></div>`;
  if (mine) h += `<button class="pst" data-kp15p="ufo">🛸 Call my UFO here</button>`;
  h += `<h4>⛏️ Deep caves</h4><div class="pst" style="font-size:13px">Caves run under fresh land: bring torches. 💎 Diamonds under y 12, 🟩 emeralds (more in mountains), plus gold & platinum ore you can smelt. Chests hide down there too.</div>`;
  h += `<h4>🏪 My shops</h4>` + (shops.length ? shops.map(([k, s]) => `<div class="pst">🏪 ${k.split(',').filter((_, i) => i !== 1).join(', ')} · ${s.items.reduce((a, b) => a + b.n, 0)} items · till 💰${Math.floor(s.till || 0)} · sold ${s.sold || 0}</div>`).join('') : '<div class="pst">Craft a 🏪 Shop Stall (3 wool over planks-chest-planks) and place it anywhere.</div>');
  h += `<h4>🐛 Glitch Hunter ${glitchN()}/6</h4>` + GL_IDS.map(k => `<div class="pst" style="${v.gl[k] ? '' : 'opacity:.6'}">${v.gl[k] ? '✅ ' + GLITCHES[k].n : '❓ ??? · <span style="font-size:12px">' + GLITCHES[k].h + '</span>'}</div>`).join('');
  return h + '</div>';
}
{ const rp5 = renderPhone; renderPhone = function () {
  rp5(); const el = document.getElementById('pScreen'); if (!el) return;
  if (phoneApp === 'home') { const a = el.querySelector('.papps'); if (a && !a.querySelector('[data-app="extras"]')) a.insertAdjacentHTML('beforeend', '<button class="papp" data-app="extras"><i style="background:linear-gradient(#3a3a6a,#0a0a2a)">🛸</i>Extras</button>'); return; }
  if (phoneApp === 'extras') el.innerHTML = phoneStatus() + extrasApp();
}; }
phoneEl.addEventListener('click', e => { const b = e.target.closest('[data-kp15p]'); if (!b) return; if (b.dataset.kp15p === 'ufo') { summonUfo(); closePanels(); } });

// ---- HUD line
{ const rh5 = renderHud4; renderHud4 = function () {
  rh5(); const bits = [], rm = realm(), a = player.car;
  if (rm === 'moon') bits.push('🌙 The Moon · low gravity');
  if (rm === 'back') bits.push('🟨 ??? · find the EXIT');
  if (isUfo(a)) bits.push(a.y >= 128 ? `🚀 ${rm === 'moon' ? 'Heading home' : 'Leaving Earth'}... ${Math.min(100, Math.round(warpT / 1.6 * 100))}%` : `🛸 Altitude ${Math.round(a.y)} · climb above 128 for ${rm === 'moon' ? '🌍 Earth' : '🌙 the Moon'}`);
  if (pushT > 1.5) bits.push('▓▒░ the wall feels thin ░▒▓');
  if (!bits.length) return;
  const extra = bits.join(' &nbsp; '), html = hud4.innerHTML ? hud4.innerHTML + ' &nbsp; ' + extra : extra;
  if (hud4.innerHTML !== html) hud4.innerHTML = html; hud4.style.display = 'block';
}; }
// ---- leaving the world: nothing carries into the title screen / another world
function reset15() { for (const m of [...mobs]) if (m.glitch) removeMob(m, false); brLeaving = false; if (voidT || tpWait) { voidT = 0; tpWait = null; window.__freeze = 0; r2void.classList.remove('on'); } r2fade.classList.remove('on'); pushT = 0; honks = []; }
// ---- the per-frame hook (runs right after the v1.14 story hook)
{ const u14 = updateV113; updateV113 = function (dt, t) {
  u14(dt, t);
  if (!playing) { reset15(); return; }
  if (realm() && typeof job !== 'undefined' && job) endJob('💼 Shift ended (you left the planet)');
  updateTp(dt); updateCaveCull(); updateCaveMobs(dt); updateUfoWorld(dt); updateFloatCars(dt); updateShops(dt); updateShopTags(); updateGlitches(dt, t);
}; }
window.__dc15 = { R2, realm, realmAt, onMoon, gravMul, moonH, genMoon, genBack, caveInit, caveChOld, carveCaves, get caveStats() { return caveStats; }, realmChests, lootFor, lootChest, underground, updateCaveMobs,
  warp, summonUfo, buildUfoCraft, ufoNear, updateUfoWorld, MOON_X0, BACK_X1, PAD_X, PAD_Z, BR_X, BR_Y, BR_EXIT, BR_BUG, BR_HOLE, earth,
  ENG, HAND, RIMS, NEON, buyMod2, applyLooks, honk, meExtra, remoteExtra, shopHTML, shopAct, updateShops, shopMine, ownerHere, netExtra, shopsNet,
  GLITCHES, glitchFound, glitchN, spawnGlitchMob, unglitch, enterBackrooms, leaveBackrooms, startVoid, get voidT() { return voidT; }, get pushT() { return pushT; }, reset15, extrasApp };

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
// filtered noise with its own filter type and an envelope (used by shovel/cut sounds)
function noiseF(dur, vol, type, f0, f1, q = 1, delay = 0) { if (!AC) return; try { const t = AC.currentTime + delay, b = AC.createBuffer(1, Math.ceil(AC.sampleRate * dur), AC.sampleRate), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.02); } catch (e) {} }
// shovel scrape + crunch for grass and dirt
const shovelSnd = (vol = 1) => { noiseF(0.16, 0.16 * vol, 'bandpass', 900 + Math.random() * 300, 380, 0.9); noiseF(0.09, 0.12 * vol, 'lowpass', 600, 180, 0.7, 0.05); };
const isSoil = id => id === GRASS || id === DIRT || id === FARM || id === DEADGRASS || id === SNOW_GRASS || id === SNOW;
// sword slice: fast high whoosh with a metallic ring
const cutSnd = () => { noiseF(0.17, 0.14, 'highpass', 1800, 6500, 0.8); noiseF(0.1, 0.08, 'bandpass', 4200, 2600, 6, 0.03); sweep(2400, 1700, 0.12, 'triangle', 0.025); };
// cow moo: two detuned saws through a vowel filter, pitch rises then falls
function animalSnd(type, vol, pain = false) {
  if (type === 'cow') return mooSnd(vol, pain);
  if (type === 'chicken') { for (let i = 0; i < (pain ? 2 : 3); i++) setTimeout(() => beep(pain ? 1400 : 900 + Math.random() * 300, 0.05, 'square', vol * 0.5), i * 90); return; }
  if (type === 'pig') { beep(pain ? 320 : 170 + Math.random() * 30, pain ? 0.2 : 0.14, 'sawtooth', vol * 0.6); setTimeout(() => beep(150, 0.1, 'sawtooth', vol * 0.5), 150); return; }
  if (type === 'sheep') { for (let i = 0; i < 5; i++) setTimeout(() => beep((pain ? 520 : 400) + (i % 2) * 30, 0.08, 'sawtooth', vol * 0.45), i * 60); return; }
  wildSnd(type, vol, pain);
}
function mooSnd(vol = 0.09, pain = false) { if (!AC) return; try {
  const t = AC.currentTime, dur = pain ? 0.55 : 1.1, base = pain ? 190 : 105 + Math.random() * 20;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(pain ? 1300 : 900, t + dur * 0.35); f.frequency.linearRampToValueAtTime(400, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(master);
  for (const d of [0, 9]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.detune.value = d;
    o.frequency.setValueAtTime(base * 0.9, t); o.frequency.linearRampToValueAtTime(base * (pain ? 1.5 : 1.15), t + dur * 0.3); o.frequency.linearRampToValueAtTime(base * (pain ? 0.8 : 0.85), t + dur);
    if (pain) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 14; lg.gain.value = base * 0.07; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
    o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
} catch (e) {} }
// ghost: hollow wavering wail with breathy noise
function ghostWail(vol = 0.06) { if (!AC) return; try {
  const t = AC.currentTime, dur = 2.2, g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const rv = AC.createDelay(); rv.delayTime.value = 0.23; const fb = AC.createGain(); fb.gain.value = 0.4; rv.connect(fb).connect(rv); g.connect(master); g.connect(rv); rv.connect(master);
  for (const [f, ty] of [[420, 'sine'], [633, 'triangle']]) { const o = AC.createOscillator(); o.type = ty; o.frequency.setValueAtTime(f * 0.8, t); o.frequency.linearRampToValueAtTime(f * 1.25, t + 0.9); o.frequency.linearRampToValueAtTime(f * 0.6, t + dur);
    const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.04; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); o.connect(g); o.start(t); o.stop(t + dur); }
  const n = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate), c = n.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = n; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2; const ng = AC.createGain(); ng.gain.value = 0.25; s.connect(bp).connect(ng).connect(g); s.start(t);
} catch (e) {} }
// ghost jumpscare: rising shriek + whispery rush instead of the animatronic scream
function ghostShriek() { if (!AC) return; try {
  const t = AC.currentTime, g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.38, t + 0.05); g.gain.setValueAtTime(0.38, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  const rv = AC.createDelay(); rv.delayTime.value = 0.09; const fb = AC.createGain(); fb.gain.value = 0.5; rv.connect(fb).connect(rv); g.connect(master); g.connect(rv); rv.connect(master);
  for (const [f, d] of [[700, 0], [1050, 20], [1480, -15]]) { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.5, t); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.35); o.frequency.linearRampToValueAtTime(f * 1.2, t + 1.5); o.detune.value = d;
    const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 9; lg.gain.value = f * 0.09; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + 1.5); o.connect(g); o.start(t); o.stop(t + 1.5); }
  noiseF(1.4, 0.3, 'bandpass', 600, 3500, 1.5); sweep(90, 40, 1.2, 'sine', 0.3);
} catch (e) {} }
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
  const vf = VIEW / 4; scene.fog.near = under ? 1 : (12 + light * 16) * vf; scene.fog.far = under ? 14 : (46 + light * 20) * vf;
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
  const sp = (player.sprint ? 6.4 : 4.3) * (water ? 0.55 : 1) * drugSpeed();
  const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw);
  let mx = -sn * fwd + cs * str, mz = -cs * fwd - sn * str; const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  const p = player.pos;
  if (player.kb > 0) { player.kb -= dt; player.vel.x *= 0.92; player.vel.z *= 0.92; }
  else { player.vel.x = mx * sp; player.vel.z = mz * sp; }
  if (!data.has(ckey(fdiv(Math.floor(p.x + mx), CH), fdiv(Math.floor(p.z + mz), CH)))) { player.vel.x = 0; player.vel.z = 0; }
  if (water) { player.vel.y -= 9 * dt; player.vel.y = Math.max(player.vel.y, -2.5); if (keys.Space || wantJump) player.vel.y = 3.2; player.fallStart = null; }
  else { player.vel.y -= 26 * dt * gravMul(); if ((keys.Space || wantJump) && player.onGround) { player.vel.y = 8.4; exhaust(player.sprint ? 0.2 : 0.05); } }
  player.vel.y = Math.max(player.vel.y, -40);
  const ox = p.x, oz = p.z;
  for (const ax of ['x', 'z']) {
    const old = p[ax]; p[ax] += player.vel[ax] * dt;
    if (collides(p)) {
      if (player.onGround || water) { const sy = p.y; p.y += 0.52; if (!collides(p)) continue; p.y = sy; }   // walk straight up stairs and half steps
      p[ax] = old;
      if (isTouch && player.onGround && m > 0.3) { p.y += 1.05; if (!collides(p)) player.vel.y = 8.4; p.y -= 1.05; }
    }
  }
  if (player.sprint) exhaust(Math.hypot(p.x - ox, p.z - oz) * 0.1);
  const oy = p.y; p.y += player.vel.y * dt; const wasGround = player.onGround; player.onGround = false;
  if (collides(p)) { if (player.vel.y < 0) { p.y = landTop(p, oy); if (collides(p)) p.y = oy; player.onGround = true; } else p.y = oy; player.vel.y = 0; }
  // fall damage (more than 3 blocks), cancelled by landing in water
  if (!player.onGround && !water) { if (player.fallStart === null || p.y > player.fallStart) player.fallStart = p.y; }
  if (player.onGround && player.fallStart !== null) { const fall = (player.fallStart - p.y) * gravMul(); player.fallStart = null; if (fall > 3.4) damage(Math.floor(fall - 3), 'fall'); }
  if (p.y < -10) { p.set(VX + 0.5, G + 2, VZ - 4.5); player.vel.set(0, 0, 0); player.fallStart = null; }
  camera.position.set(p.x, p.y + EYE, p.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  const fov = player.sprint ? 85 : 75; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
  return m > 0.1;
}
function groundNear(x, y0, z) { for (let y = Math.floor(y0) + 2; y >= 0; y--) if (solid(get(Math.floor(x), y, Math.floor(z)))) return y + 1; return Math.floor(y0); }
function groundAt(x, z) { for (let y = H - 1; y >= 0; y--) if (solid(get(Math.floor(x), y, Math.floor(z)))) return y + 1; return G + 1; }
function updateVillagers(dt) {
  for (const v of villagers) {
    const g = v.g, dp = player.pos.distanceTo(g.position);
    if (dp < 3.5) { g.rotation.y = Math.atan2(player.pos.x - g.position.x, player.pos.z - g.position.z); continue; }
    if (v.wait > 0) { v.wait -= dt; continue; }
    if (!v.target) { const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3.5, hx = v.home ? v.home.x : VX + 0.5, hz = v.home ? v.home.y : VZ + 0.5; v.target = new THREE.Vector2(hx + Math.cos(a) * r, hz + Math.sin(a) * r); }
    const dx = v.target.x - g.position.x, dz = v.target.y - g.position.z, dd = Math.hypot(dx, dz);
    if (dd < 0.1) { v.target = null; v.wait = 2 + Math.random() * 4; continue; }
    const st = Math.min(dd, 1.1 * dt);
    const nx = g.position.x + dx / dd * st, nz = g.position.z + dz / dd * st, ny = v.home ? groundNear(nx, g.position.y, nz) : groundAt(nx, nz);
    if (ny > g.position.y + 1.1 || isWater(get(Math.floor(nx), ny, Math.floor(nz))) || isWater(get(Math.floor(nx), ny - 1, Math.floor(nz)))) { v.target = null; v.wait = 1; continue; }
    g.position.set(nx, ny, nz); g.rotation.y = Math.atan2(dx, dz);
  }
}
function updateSpooks(dt, t) {
  ghostMat.opacity = 0.18 + nightAmt * 0.6; blackMat.opacity = 0.3 + nightAmt * 0.6; ghostEyeMat.opacity = 0.25 + nightAmt * 0.75; ghostTex.offset.y = (t * 0.06) % 1;
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
    gh.wail = (gh.wail ?? 4 + Math.random() * 10) - dt;
    if (gh.wail <= 0) { gh.wail = 9 + Math.random() * 14; if (playing && !uiOpen && pd < 16 && nightAmt > 0.2) ghostWail(0.07 * (1 - pd / 16) * (0.4 + nightAmt)); }
    if (playing && !uiOpen && player.alive && pd < 1.4 && Math.abs(player.pos.y + 1 - g.position.y) < 2 && gh.cd <= 0) {
      const n = rint(1, 3); give('candy', n); gh.cd = 3; placeGhost(gh, true);
      if (settings.jumpscares && nightAmt > 0.6 && Math.random() < 0.3 && state.gameTime - lastScare > 60) jumpscare(() => toast(`👻 ...it dropped ${n} 🍬 Ghost Candy`), 'ghost');
      else { booSnd(); ghostWail(0.08); toast(`👻 BOO! The ghost fled and dropped ${n} 🍬 Ghost Candy`); }
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
  else if (h && h.kind === 'vessel') txt = VLABEL[h.c.kind];
  else if (h && h.kind === 'mob') txt = mobLabel(h.m);
  else if (h && h.kind === 'crop') { const c = state.crops[h.key]; const pct = Math.min(100, Math.round((state.gameTime - c.t) / CROPS[c.type].grow * 100)); txt = `${CROPS[c.type].name}: ${pct >= 100 ? 'RIPE! use a hoe to gather' : pct + '%'}`; }
  else if (h && h.kind === 'block') {
    if (h.id === PUMPKIN) txt = '🎃 Wild Pumpkin'; else if (isDoor(h.id)) txt = '🚪 ✋ open / close'; else if (h.id === CTABLE) txt = '🪵 ✋ Crafting Table'; else if (h.id === CHEST) txt = '📦 ✋ Chest'; else if (h.id === FURNACE) txt = '🔥 ✋ Furnace'; else if (h.id === GRAVE) txt = '🪦 ✋ get your things back';
    else if (isFurn(h.id)) { const b = furnBase(h.id), dv = state.dev[h.x + ',' + h.y + ',' + h.z]; txt = b === BED0 ? '🛏️ ✋ Sleep' : b === LAPTOP0 ? '💻 ✋ Open DealerNet' : b === TV0 ? `📺 ✋ ${dv ? TV_CH[dv - 1] + ' (next channel)' : 'Turn on'}` : `📻 ✋ ${dv ? STATIONS[dv - 1].name + ' (next station)' : 'Turn on'}`; }
    else if (h.id === GRAVE_DIRT) txt = '🪦 Grave dirt · dig with a shovel'; else if (h.id === TOMB) txt = '🪦 Tombstone'; else if (h.id === IRON_ORE) txt = 'Iron Ore (stone pickaxe)'; else if (h.id === COAL_ORE) txt = 'Coal Ore';
  }
  el.style.display = txt ? 'block' : 'none'; el.textContent = txt;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  streamChunks(2, 2);
  let moving = false;
  if (playing && !uiOpen && player.alive && !scaring && !player.car && !player.sleeping && !player.horse && !window.__freeze) moving = updatePlayer(dt);
  else { camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); }
  updateMining(dt);
  if (playing) { state.time += dt; state.gameTime += dt; updateVitals(dt); }
  if (!playing) player.yaw += dt * 0.05; // slow pan on title
  waterT += dt; if (waterT > 0.25) { waterT = 0; waterTick(); flushDirty(); }
  updateVillagers(dt); updateSpooks(dt, now / 1000); if (playing) { updateMobs(dt, now / 1000); updateV109(dt, now / 1000); } updateParticles(dt); updateFurnaces(dt);
  if (playing) { updateCars(dt, now / 1000); updateTowns(dt); updateSea(dt); updateServices(dt, now / 1000); } updateSmoke(dt);
  updateSleep(dt); updateNet(dt, now / 1000); updateTVs(dt); updateRadio(dt); if (!player.car) updateMyAvatar(dt, now / 1000); else if (myAv) { myAv.g.visible = false; hand.visible = true; }
  updateWeather(dt); updateSky(); updateDrugs(dt, now / 1000); updateTarget(); updateHand(dt, moving); updateTorchLights(dt); updateMap(dt); updateOffhand(dt); updateV110s4(dt, now / 1000); updateV112(dt, now / 1000); updateV113(dt, now / 1000);
  cropTick += dt; if (cropTick > 1) { cropTick = 0; if (playing) tickCropsAndPoop(1); let ch = false; for (const k in state.crops) { const c = state.crops[k]; if (cropStage(c) !== c._st || (c.type === 'weed' && Math.round(Math.min(1, (state.gameTime - c.t) / CROPS.weed.grow) * 40) !== c._g)) ch = true; } if (ch) buildCrops(); }
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
window.__dc3 = { vessels, spawnVessel, boardVessel, exitVessel, placeBoat, waterLevelAt, openWater, floatsAt, hullFloats, services, incidents, dispatch, pedDown, respawnPed, get pedRespawns() { return pedRespawns; }, ghettoZones, metroOf, districtOf, townById, townsNear, pedTarget, inGhetto, regionTownOld, updateSea, syncBoats, vesselBreak, tick(dt) { simT += dt; updateServices(dt, simT); } };
let simT = 0;
window.__dc4 = { GUNS, tryFire, throwGrenade, grenades, nukes, armNuke, blast, fxs, shotRay, gangZones, gangZone, startGangWar, updateGangs, GANGS, npcAI, arrest, get jail() { return jail; }, prisonCells, findSite, siteOf, siteAt, sitesNear, inSite, crashSites, radiationAt, get radNow() { return radNow; }, setWantedLvl(n) { wantedLvl = n; }, get wantedLvl() { return wantedLvl; },
  aircraft, spawnAircraft, boardAircraft, exitAircraft, aimAircraft, ufos, spawnUfo, buildUfo, capUfos, airKeys, btnAir, parkAircraft, updateSites, tase, prisonExit, prisonChest, a51Chest, keepOldSites, siteSpawned, get soldierAlert() { return soldierAlert; }, renderHud4, ghettoZones, PARKED, setHold(v) { holdBreak = v; }, aimTest() { const eye = new THREE.Vector3(player.pos.x, player.pos.y + EYE, player.pos.z), h = shotRay(eye, getDir(), 60); return JSON.stringify({ t: h.t, mob: h.mob && h.mob.type, mobY: h.mob && h.mob.g.position.y, block: h.block, eye: eye.y }); }, get spinT() { return spinT; } };
window.__dc = { canHurtPlayer, setWanted, snapCarGround, spawnCar, buildMob, unstickMob, mobCollides, placePhoneBtn, groundAt, get phoneApp() { return phoneApp; }, maybeLeash, townAnimals, damage, respawn, hash2, heightAt, townAt, inTown, get phoneSt() { return phoneSt; }, openPhone, mapMem, mapRegions, get mapBounds() { return mapBounds; }, drawHeldMap, mountHorse, dismountHorse, interactMob, tameAnimal, hurtMob, MOBDEF, ITEMS, RECIPES, SMELT, TIERS, gps, saveExplored, wildAI, updateWildlife, spawnGroup, biomeAt, stampGraveyard, genChunk, finishBreak, breakInfo, landTop, solidBoxes, isStair, count, take, craftResult: () => craftResult(), gridMatch, save, get uiOpen() { return uiOpen; }, set uiOpen(v) { uiOpen = v; }, get playing() { return playing; }, applyTexturePack, state, player, villagers, raycast, data, chunks, ghosts, mobs, spawnMob, give, settings, jumpscare, get, setBlock, collides, VX, VZ, useAction, openChest, openSettings, diff, townOf, cars, enterCar, exitCar, swapOffhand, TREG, CH, get weedMesh() { return weedMesh; }, buildCrops, keys, get wanted() { return wanted; }, net, get auth() { return auth; }, hostOnline, joinOnline, leaveOnline, cloudUpload, openWeb, openChar, openAccount, useFurn, skipToMorning, updateTVs, updateRadio, STATIONS, get radioNear() { return radioNear; }, tvScreens, itemValue, webBuy, webSell, mySkin, get VIEW() { return VIEW; } };
