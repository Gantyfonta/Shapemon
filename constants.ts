
import { ShapeType, MoveCategory, Move, ShapeInstance, Item } from './types';

// --- Type Effectiveness ---
export const TYPE_CHART: Record<ShapeType, Record<ShapeType, number>> = {
  [ShapeType.SHARP]: { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 2, [ShapeType.STABLE]: 0.5, [ShapeType.VOID]: 1 },
  [ShapeType.ROUND]: { [ShapeType.SHARP]: 0.5, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 1 },
  [ShapeType.STABLE]: { [ShapeType.SHARP]: 2, [ShapeType.ROUND]: 0.5, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1 },
  [ShapeType.VOID]: { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1 },
};

// --- Items ---
export const ITEMS: Record<string, Item> = {
  NONE: { id: 'NONE', name: 'No Item', description: 'No item held.', effectType: 'STAT_BOOST', value: 0 },
  ATTACK_PRISM: { id: 'ATTACK_PRISM', name: 'Attack Prism', description: 'Boosts physical attacks by 20%.', effectType: 'STAT_BOOST', stat: 'atk', value: 1.2 },
  MIND_GEM: { id: 'MIND_GEM', name: 'Mind Gem', description: 'Boosts special attacks by 20%.', effectType: 'STAT_BOOST', stat: 'atk', value: 1.2 }, // We treat "Special Atk" same as Atk in calc for simplicity or check cat
  CUBE_LEFTOVERS: { id: 'CUBE_LEFTOVERS', name: 'Cube Scraps', description: 'Restores HP each turn.', effectType: 'HEAL_TURN', value: 0.06 }, // 6%
  SPEED_BOOTS: { id: 'SPEED_BOOTS', name: 'Speed Vector', description: 'Increases Speed.', effectType: 'STAT_BOOST', stat: 'spd', value: 1.5 },
};

// --- Moves Pool ---
export const MOVES_POOL: Record<string, Omit<Move, 'id' | 'maxPp'>> = {
  // Sharp Moves
  PIERCE: { name: 'Pierce', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 50, accuracy: 100, pp: 30, description: 'A quick jab with a sharp point.' },
  TRIANGLE_BEAM: { name: 'Tri-Beam', type: ShapeType.SHARP, category: MoveCategory.SPECIAL, power: 90, accuracy: 90, pp: 10, description: 'Fires a triangular laser.' },
  SPIKE_TRAP: { name: 'Spike Trap', type: ShapeType.SHARP, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 15, description: 'Lays a trap (Deals dmg).', effect: 'BUFF_ATK' },
  
  // Round Moves
  ROLLOUT: { name: 'Rollout', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 40, accuracy: 90, pp: 20, description: 'Rolls into the enemy. Gets stronger.' },
  BUBBLE_BLAST: { name: 'Bubble Blast', type: ShapeType.ROUND, category: MoveCategory.SPECIAL, power: 65, accuracy: 100, pp: 20, description: 'Blasts bubbles at the foe.' },
  RECOVER: { name: 'Recover', type: ShapeType.ROUND, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 5, description: 'Heals 50% HP.', effect: 'HEAL' },

  // Stable Moves
  BOX_BASH: { name: 'Box Bash', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 80, accuracy: 100, pp: 15, description: 'Slams a heavy side into the foe.' },
  GRID_LOCK: { name: 'Grid Lock', type: ShapeType.STABLE, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 20, description: 'Traps the enemy in a grid.' },
  FORTIFY: { name: 'Fortify', type: ShapeType.STABLE, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 20, description: 'Raises Defense.', effect: 'BUFF_DEF' },

  // Void Moves
  NULL_RAY: { name: 'Null Ray', type: ShapeType.VOID, category: MoveCategory.SPECIAL, power: 70, accuracy: 100, pp: 15, description: 'A ray of pure nothingness.' },
};

export const createMove = (key: string): Move => ({
  ...MOVES_POOL[key],
  id: key,
  maxPp: MOVES_POOL[key].pp
});

// --- Species Base Data ---
export const SPECIES = {
  TRIANGLE: {
    speciesId: 'triangle',
    name: 'Pyramidon',
    type: ShapeType.SHARP,
    baseStats: { hp: 100, atk: 120, def: 60, spd: 110 },
    color: 'text-red-400',
    moveKeys: ['PIERCE', 'TRIANGLE_BEAM', 'FORTIFY', 'NULL_RAY', 'SPIKE_TRAP']
  },
  CIRCLE: {
    speciesId: 'circle',
    name: 'Orbulon',
    type: ShapeType.ROUND,
    baseStats: { hp: 140, atk: 70, def: 80, spd: 80 },
    color: 'text-blue-400',
    moveKeys: ['BUBBLE_BLAST', 'RECOVER', 'ROLLOUT', 'NULL_RAY', 'FORTIFY']
  },
  SQUARE: {
    speciesId: 'square',
    name: 'Cubix',
    type: ShapeType.STABLE,
    baseStats: { hp: 120, atk: 100, def: 120, spd: 50 },
    color: 'text-green-400',
    moveKeys: ['BOX_BASH', 'GRID_LOCK', 'FORTIFY', 'RECOVER', 'ROLLOUT']
  },
  PENTAGON: {
    speciesId: 'pentagon',
    name: 'Pentar',
    type: ShapeType.VOID,
    baseStats: { hp: 110, atk: 90, def: 90, spd: 90 },
    color: 'text-purple-400',
    moveKeys: ['NULL_RAY', 'TRIANGLE_BEAM', 'BOX_BASH', 'RECOVER', 'PIERCE']
  },
  STAR: {
    speciesId: 'star',
    name: 'Stardust',
    type: ShapeType.SHARP,
    baseStats: { hp: 90, atk: 130, def: 70, spd: 120 },
    color: 'text-yellow-400',
    moveKeys: ['TRIANGLE_BEAM', 'PIERCE', 'BUBBLE_BLAST', 'NULL_RAY', 'SPIKE_TRAP']
  }
};

export interface TeamMemberConfig {
  species: keyof typeof SPECIES;
  moves: string[]; // keys
  item: string; // key
}

export const createInstance = (
  speciesKey: keyof typeof SPECIES, 
  level: number = 50, 
  idPrefix: string = 'p1',
  moveOverride?: string[],
  itemKey?: string
): ShapeInstance => {
  const s = SPECIES[speciesKey];
  // Simple stat formula: (Base * 2 * Level / 100) + Level + 10
  const calcStat = (base: number) => Math.floor((base * 2 * level) / 100) + level + 10;
  const hp = Math.floor((s.baseStats.hp * 2 * level) / 100) + level + 10;

  // Use override moves or default to first 4
  const selectedMoveKeys = moveOverride ? moveOverride : s.moveKeys.slice(0, 4);

  return {
    id: `${idPrefix}_${s.speciesId}_${Math.random().toString(36).substr(2, 5)}`,
    speciesId: s.speciesId,
    name: s.name,
    type: s.type,
    spriteColor: s.color,
    status: 'ALIVE',
    heldItem: itemKey ? ITEMS[itemKey] : undefined,
    stats: {
      maxHp: hp,
      hp: hp,
      atk: calcStat(s.baseStats.atk),
      def: calcStat(s.baseStats.def),
      spd: calcStat(s.baseStats.spd),
    },
    moves: selectedMoveKeys.map(createMove)
  };
};

export const INITIAL_PLAYER_TEAM = [
  createInstance('TRIANGLE', 50, 'p1'),
  createInstance('SQUARE', 50, 'p1'),
  createInstance('CIRCLE', 50, 'p1'),
];

export const INITIAL_ENEMY_TEAM = [
  createInstance('STAR', 50, 'p2'),
  createInstance('PENTAGON', 50, 'p2'),
  createInstance('SQUARE', 50, 'p2'),
];
