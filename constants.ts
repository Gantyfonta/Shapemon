
import { ShapeType, MoveCategory, Move, ShapeInstance, Item } from './types.ts';

// --- Type Effectiveness ---
export const TYPE_CHART: Record<ShapeType, Record<ShapeType, number>> = {
  [ShapeType.SHARP]:  { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 2, [ShapeType.STABLE]: 0.5, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 1, [ShapeType.GLITCH]: 2 },
  [ShapeType.ROUND]:  { [ShapeType.SHARP]: 0.5, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 0.5, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 1 },
  [ShapeType.STABLE]: { [ShapeType.SHARP]: 2, [ShapeType.ROUND]: 0.5, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 1, [ShapeType.GLITCH]: 0.5 },
  [ShapeType.VOID]:   { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 1 },
  [ShapeType.FLUX]:   { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 2, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 2, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 0.5 },
  [ShapeType.GLITCH]: { [ShapeType.SHARP]: 0.5, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 2, [ShapeType.GLITCH]: 1 },
};

// --- Items ---
export const ITEMS: Record<string, Item> = {
  NONE: { id: 'NONE', name: 'No Item', description: 'No item held.', effectType: 'STAT_BOOST', value: 0 },
  ATTACK_PRISM: { id: 'ATTACK_PRISM', name: 'Attack Prism', description: 'Boosts physical attacks by 20%.', effectType: 'STAT_BOOST', stat: 'atk', value: 1.2 },
  MIND_GEM: { id: 'MIND_GEM', name: 'Mind Gem', description: 'Boosts special attacks by 20%.', effectType: 'STAT_BOOST', stat: 'atk', value: 1.2 }, 
  CUBE_LEFTOVERS: { id: 'CUBE_LEFTOVERS', name: 'Cube Scraps', description: 'Restores 6% HP each turn.', effectType: 'HEAL_TURN', value: 0.06 },
  SPEED_BOOTS: { id: 'SPEED_BOOTS', name: 'Speed Vector', description: 'Increases Speed by 50%.', effectType: 'STAT_BOOST', stat: 'spd', value: 1.5 },
  POWER_CORE: { id: 'POWER_CORE', name: 'Power Core', description: 'Boosts damage by 30% but takes recoil.', effectType: 'RECOIL_BOOST', value: 1.3 },
  BERRY_BIT: { id: 'BERRY_BIT', name: 'Bit Berry', description: 'Heals 50% HP when below 50%. One use.', effectType: 'HEAL_LOW', value: 0.5, consumed: true },
  FOCUS_BAND: { id: 'FOCUS_BAND', name: 'Focus Band', description: '10% chance to survive a fatal hit.', effectType: 'RESIST', value: 0.1 },
};

// --- Moves Pool ---
export const MOVES_POOL: Record<string, Omit<Move, 'id' | 'maxPp'>> = {
  // Sharp Moves
  PIERCE: { name: 'Pierce', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 50, accuracy: 100, pp: 30, description: 'A quick jab.', priority: 1 },
  TRIANGLE_BEAM: { name: 'Tri-Beam', type: ShapeType.SHARP, category: MoveCategory.SPECIAL, power: 90, accuracy: 90, pp: 10, description: 'Fires a triangular laser.' },
  SPIKE_TRAP: { name: 'Spike Trap', type: ShapeType.SHARP, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 15, description: 'Lays a trap.', effect: 'BUFF_ATK' },
  SKY_DIVE: { name: 'Sky Dive', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 100, accuracy: 85, pp: 5, description: 'High power, low accuracy.' },
  CROSS_CUT: { name: 'Cross Cut', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 70, accuracy: 100, pp: 20, description: 'High critical hit ratio.' },

  // Round Moves
  ROLLOUT: { name: 'Rollout', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 40, accuracy: 90, pp: 20, description: 'Rolls into the enemy.' },
  BUBBLE_BLAST: { name: 'Bubble Blast', type: ShapeType.ROUND, category: MoveCategory.SPECIAL, power: 65, accuracy: 100, pp: 20, description: 'Blasts bubbles.' },
  RECOVER: { name: 'Recover', type: ShapeType.ROUND, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 5, description: 'Heals 50% HP.', effect: 'HEAL' },
  BOUNCE: { name: 'Bounce', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 85, accuracy: 85, pp: 10, description: 'Bounces on the foe.' },

  // Stable Moves
  BOX_BASH: { name: 'Box Bash', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 80, accuracy: 100, pp: 15, description: 'Slams a heavy side.' },
  GRID_LOCK: { name: 'Grid Lock', type: ShapeType.STABLE, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 20, description: 'Traps the enemy.' },
  FORTIFY: { name: 'Fortify', type: ShapeType.STABLE, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 20, description: 'Raises Defense.', effect: 'BUFF_DEF' },
  BLOCKADE: { name: 'Blockade', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 90, accuracy: 100, pp: 10, description: 'A massive wall attack.' },
  HEX_SHIELD: { name: 'Hex Shield', type: ShapeType.STABLE, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 10, description: 'Protects from attacks.', priority: 3 },

  // Void Moves
  NULL_RAY: { name: 'Null Ray', type: ShapeType.VOID, category: MoveCategory.SPECIAL, power: 70, accuracy: 100, pp: 15, description: 'A ray of nothingness.' },
  ECHO_WAVE: { name: 'Echo Wave', type: ShapeType.VOID, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 20, description: 'Never misses.', priority: 0 },
  
  // Flux Moves
  FLOW_CANNON: { name: 'Flow Cannon', type: ShapeType.FLUX, category: MoveCategory.SPECIAL, power: 110, accuracy: 80, pp: 5, description: 'Massive energy beam.' },
  QUICK_STRIKE: { name: 'Quick Strike', type: ShapeType.FLUX, category: MoveCategory.PHYSICAL, power: 40, accuracy: 100, pp: 30, description: 'Strikes first.', priority: 2 },
  SIPHON: { name: 'Siphon', type: ShapeType.FLUX, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 10, description: 'Drains HP.', drain: true },
  SPIRAL_KICK: { name: 'Spiral Kick', type: ShapeType.FLUX, category: MoveCategory.PHYSICAL, power: 85, accuracy: 95, pp: 15, description: 'Spinning attack.' },

  // Glitch Moves
  DATA_STORM: { name: 'Data Storm', type: ShapeType.GLITCH, category: MoveCategory.SPECIAL, power: 80, accuracy: 95, pp: 15, description: 'Corrupts the area.' },
  BUG_BITE: { name: 'Bug Bite', type: ShapeType.GLITCH, category: MoveCategory.PHYSICAL, power: 60, accuracy: 100, pp: 20, description: 'Gnaws at code.' },
  LAG_SPIKE: { name: 'Lag Spike', type: ShapeType.GLITCH, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 10, description: 'Lowers enemy speed (Simulated).', effect: 'BUFF_DEF' }, 
  PIXEL_BURST: { name: 'Pixel Burst', type: ShapeType.GLITCH, category: MoveCategory.SPECIAL, power: 120, accuracy: 70, pp: 5, description: 'High damage, chaotic.' },
};

export const createMove = (key: string): Move => ({
  ...MOVES_POOL[key],
  id: key,
  maxPp: MOVES_POOL[key].pp,
  priority: MOVES_POOL[key].priority || 0
});

// --- Species Base Data ---
export const SPECIES = {
  TRIANGLE: {
    speciesId: 'triangle',
    name: 'Pyramidon',
    type: ShapeType.SHARP,
    baseStats: { hp: 100, atk: 120, def: 60, spd: 110 },
    color: 'text-red-400',
    moveKeys: ['PIERCE', 'TRIANGLE_BEAM', 'FORTIFY', 'SKY_DIVE', 'CROSS_CUT']
  },
  CIRCLE: {
    speciesId: 'circle',
    name: 'Orbulon',
    type: ShapeType.ROUND,
    baseStats: { hp: 140, atk: 70, def: 80, spd: 80 },
    color: 'text-blue-400',
    moveKeys: ['BUBBLE_BLAST', 'RECOVER', 'ROLLOUT', 'BOUNCE']
  },
  SQUARE: {
    speciesId: 'square',
    name: 'Cubix',
    type: ShapeType.STABLE,
    baseStats: { hp: 120, atk: 100, def: 120, spd: 50 },
    color: 'text-green-400',
    moveKeys: ['BOX_BASH', 'GRID_LOCK', 'FORTIFY', 'BLOCKADE', 'HEX_SHIELD']
  },
  PENTAGON: {
    speciesId: 'pentagon',
    name: 'Pentar',
    type: ShapeType.VOID,
    baseStats: { hp: 110, atk: 90, def: 90, spd: 90 },
    color: 'text-purple-400',
    moveKeys: ['NULL_RAY', 'TRIANGLE_BEAM', 'BOX_BASH', 'ECHO_WAVE']
  },
  HEXAGON: {
    speciesId: 'hexagon',
    name: 'Hexaclad',
    type: ShapeType.STABLE,
    baseStats: { hp: 150, atk: 80, def: 150, spd: 30 },
    color: 'text-yellow-600',
    moveKeys: ['BLOCKADE', 'HEX_SHIELD', 'ROLLOUT', 'RECOVER', 'BOX_BASH']
  },
  SPIRAL: {
    speciesId: 'spiral',
    name: 'Vortex',
    type: ShapeType.FLUX,
    baseStats: { hp: 70, atk: 110, def: 60, spd: 140 },
    color: 'text-cyan-400',
    moveKeys: ['SPIRAL_KICK', 'QUICK_STRIKE', 'FLOW_CANNON', 'SIPHON']
  },
  CROSS: {
    speciesId: 'cross',
    name: 'Crux',
    type: ShapeType.SHARP,
    baseStats: { hp: 90, atk: 130, def: 90, spd: 80 },
    color: 'text-red-600',
    moveKeys: ['CROSS_CUT', 'SPIKE_TRAP', 'PIERCE', 'FORTIFY']
  },
  FRACTAL: {
    speciesId: 'fractal',
    name: 'Mandelbrot',
    type: ShapeType.GLITCH,
    baseStats: { hp: 80, atk: 130, def: 70, spd: 100 },
    color: 'text-pink-500',
    moveKeys: ['DATA_STORM', 'PIXEL_BURST', 'BUG_BITE', 'LAG_SPIKE', 'NULL_RAY']
  },
  RHOMBUS: {
    speciesId: 'rhombus',
    name: 'Rhombo',
    type: ShapeType.FLUX,
    baseStats: { hp: 100, atk: 100, def: 80, spd: 110 },
    color: 'text-teal-400',
    moveKeys: ['QUICK_STRIKE', 'TRIANGLE_BEAM', 'SIPHON', 'SPIRAL_KICK']
  }
};

export interface TeamMemberConfig {
  species: keyof typeof SPECIES;
  moves: string[];
  item: string;
}

// --- Team Generation ---

export const createInstance = (
  speciesKey: keyof typeof SPECIES, 
  level: number = 50,
  idPrefix: string = 'p1',
  customMoveKeys?: string[],
  itemKey?: string
): ShapeInstance => {
  const species = SPECIES[speciesKey];
  
  // Stats formula: (Base * 2 * Level / 100) + 5
  const calcStat = (base: number) => Math.floor((base * 2 * level) / 100) + 5;
  const calcHp = (base: number) => Math.floor((base * 2 * level) / 100) + level + 10;

  const moveKeys = customMoveKeys || species.moveKeys.slice(0, 4);
  const moves = moveKeys.map(k => createMove(k));
  
  // Assign ID based on moves to make it somewhat unique for rendering
  const uniqueId = idPrefix + '-' + species.speciesId + '-' + Math.random().toString(36).substr(2, 5);

  const heldItem = itemKey && ITEMS[itemKey] ? ITEMS[itemKey] : ITEMS['NONE'];

  return {
    id: uniqueId,
    speciesId: species.speciesId,
    name: species.name,
    type: species.type,
    stats: {
      hp: calcHp(species.baseStats.hp),
      maxHp: calcHp(species.baseStats.hp),
      atk: calcStat(species.baseStats.atk),
      def: calcStat(species.baseStats.def),
      spd: calcStat(species.baseStats.spd),
    },
    moves,
    status: 'ALIVE',
    spriteColor: species.color,
    heldItem: { ...heldItem } // Clone item to allow consumption
  };
};

export const INITIAL_PLAYER_TEAM = [
  createInstance('TRIANGLE', 50, 'p1'),
  createInstance('SQUARE', 50, 'p1'),
  createInstance('CIRCLE', 50, 'p1'),
];

export const INITIAL_ENEMY_TEAM = [
  createInstance('PENTAGON', 50, 'p2'),
  createInstance('TRIANGLE', 50, 'p2'),
  createInstance('SQUARE', 50, 'p2'),
];