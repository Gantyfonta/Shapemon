
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import Peer, { DataConnection } from 'peerjs';

// Firebase disabled due to environment issues
// import { initializeApp } from 'firebase/app';
// import { getAuth, ... } from 'firebase/auth';
// ...

// ==========================================
// 0. FIREBASE CONFIGURATION
// ==========================================
// const firebaseConfig = { ... };

// Initialize Firebase (safely)
let auth: any = null;
let db: any = null;
let googleProvider: any = null;
let analytics: any = null;

/*
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics failed to load", e);
  }
} catch (e) {
  console.warn("Firebase not initialized. Check configuration.", e);
}
*/

// Mock User type for compatibility
type User = any;

// ==========================================
// 1. TYPES
// ==========================================

export enum ShapeType {
  SHARP = 'SHARP',
  ROUND = 'ROUND',
  STABLE = 'STABLE',
  VOID = 'VOID',
  FLUX = 'FLUX',
  GLITCH = 'GLITCH',
  ASTRAL = 'ASTRAL',   // New: Space/Magic
  QUANTUM = 'QUANTUM'  // New: Physics/Probability
}

export enum MoveCategory {
  PHYSICAL = 'PHYSICAL',
  SPECIAL = 'SPECIAL',
  STATUS = 'STATUS'
}

export type StatusCondition = 'NONE' | 'FRAGMENTED' | 'LAGGING' | 'GLITCHED' | 'LOCKED';

export interface Move {
  id: string;
  name: string;
  type: ShapeType;
  category: MoveCategory;
  power: number;
  accuracy: number;
  pp: number;
  maxPp: number;
  priority?: number; 
  drain?: boolean;   
  description: string;
  effect?: 'HEAL' | 'BUFF_ATK' | 'BUFF_DEF' | 'BUFF_SPD';
  targetStatus?: StatusCondition; // Status to apply to enemy
  statusChance?: number; // 0-100% chance to apply status
}

export interface Item {
  id: string;
  name: string;
  description: string;
  effectType: 'STAT_BOOST' | 'HEAL_TURN' | 'RESIST' | 'RECOIL_BOOST' | 'HEAL_LOW' | 'CRIT_BOOST' | 'CURE_STATUS';
  stat?: 'atk' | 'def' | 'spd' | 'hp';
  value?: number; 
  consumed?: boolean; 
}

export interface Ability {
  id: string;
  name: string;
  description: string;
}

export interface ShapeStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface ShapeInstance {
  id: string; 
  speciesId: string;
  name: string;
  type: ShapeType;
  stats: ShapeStats;
  moves: Move[];
  status: 'ALIVE' | 'FAINTED';
  spriteColor: string;
  heldItem?: Item;
  ability: string; 
  statusCondition: StatusCondition;
  statusTurnCount: number; // Used for Locked (Sleep) duration
}

export interface BattleState {
  turn: number;
  log: string[];
  weather: 'CLEAR' | 'STATIC_STORM' | 'DATA_RAIN';
}

export type TurnPhase = 'SELECT' | 'WAITING' | 'ANIMATING' | 'GAME_OVER' | 'SWITCH' | 'LOBBY' | 'TEAMBUILDER';

export type GameMode = 'SINGLE' | 'MULTI_HOST' | 'MULTI_GUEST';

export interface PlayerAction {
  type: 'MOVE' | 'SWITCH';
  index: number;
}

export interface TurnEvent {
  type: 'LOG' | 'DAMAGE' | 'HEAL' | 'FAINT' | 'ATTACK_ANIM' | 'SWITCH_ANIM' | 'WIN' | 'LOSE' | 'ITEM_USE' | 'ABILITY' | 'STATUS_APPLY' | 'STATUS_DAMAGE';
  message?: string;
  target?: 'player' | 'enemy';
  attacker?: 'player' | 'enemy'; 
  amount?: number;
  effect?: string; 
  newActiveIndex?: number; 
}

export interface MultiplayerMessage {
  type: 'HANDSHAKE' | 'ACTION' | 'TURN_RESULT' | 'RESTART';
  payload: any;
}

// ==========================================
// 2. CONSTANTS
// ==========================================

export const TYPE_CHART: Record<ShapeType, Record<ShapeType, number>> = {
  [ShapeType.SHARP]:   { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 2, [ShapeType.STABLE]: 0.5, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 1, [ShapeType.GLITCH]: 2, [ShapeType.ASTRAL]: 0.5, [ShapeType.QUANTUM]: 1 },
  [ShapeType.ROUND]:   { [ShapeType.SHARP]: 0.5, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 0.5, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 1, [ShapeType.ASTRAL]: 1, [ShapeType.QUANTUM]: 2 },
  [ShapeType.STABLE]:  { [ShapeType.SHARP]: 2, [ShapeType.ROUND]: 0.5, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 1, [ShapeType.GLITCH]: 0.5, [ShapeType.ASTRAL]: 1, [ShapeType.QUANTUM]: 0.5 },
  [ShapeType.VOID]:    { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 1, [ShapeType.ASTRAL]: 0.5, [ShapeType.QUANTUM]: 2 },
  [ShapeType.FLUX]:    { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 2, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 2, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 0.5, [ShapeType.ASTRAL]: 2, [ShapeType.QUANTUM]: 1 },
  [ShapeType.GLITCH]:  { [ShapeType.SHARP]: 0.5, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 2, [ShapeType.GLITCH]: 1, [ShapeType.ASTRAL]: 2, [ShapeType.QUANTUM]: 0.5 },
  [ShapeType.ASTRAL]:  { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 2, [ShapeType.FLUX]: 2, [ShapeType.GLITCH]: 0.5, [ShapeType.ASTRAL]: 0.5, [ShapeType.QUANTUM]: 1 },
  [ShapeType.QUANTUM]: { [ShapeType.SHARP]: 2, [ShapeType.ROUND]: 0.5, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 0.5, [ShapeType.FLUX]: 1, [ShapeType.GLITCH]: 1, [ShapeType.ASTRAL]: 1, [ShapeType.QUANTUM]: 0.5 },
};

export const ABILITIES: Record<string, Ability> = {
  NONE: { id: 'NONE', name: 'None', description: 'No special ability.' },
  LEVITATE: { id: 'LEVITATE', name: 'Levitate', description: 'Immune to STABLE type moves.' },
  ROUGH_SKIN: { id: 'ROUGH_SKIN', name: 'Rough Skin', description: 'Damages attackers on contact.' },
  DOWNLOAD: { id: 'DOWNLOAD', name: 'Download', description: 'Boosts Attack on entry.' },
  REGENERATOR: { id: 'REGENERATOR', name: 'Regenerator', description: 'Restores HP a little every turn.' },
  STURDY: { id: 'STURDY', name: 'Sturdy', description: 'Cannot be KOed in one hit from full HP.' },
  PRISM_ARMOR: { id: 'PRISM_ARMOR', name: 'Prism Armor', description: 'Reduces super-effective damage.' },
  SPEED_BOOST: { id: 'SPEED_BOOST', name: 'Speed Boost', description: 'Speed increases every turn.' },
  PIXELATE: { id: 'PIXELATE', name: 'Pixelate', description: 'Normal moves become Glitch type.' },
  SYNC_GUARD: { id: 'SYNC_GUARD', name: 'Sync Guard', description: 'Prevents Status Conditions.' },
  AERODYNAMICS: { id: 'AERODYNAMICS', name: 'Aerodynamics', description: 'Boosts Speed when hit by Flux moves.' },
  POINTY_END: { id: 'POINTY_END', name: 'Pointy End', description: 'Physical moves do 20% more damage.' },
};

export const ITEMS: Record<string, Item> = {
  NONE: { id: 'NONE', name: 'No Item', description: 'No item held.', effectType: 'STAT_BOOST', value: 0 },
  ATTACK_PRISM: { id: 'ATTACK_PRISM', name: 'Attack Prism', description: 'Boosts physical attacks by 20%.', effectType: 'STAT_BOOST', stat: 'atk', value: 1.2 },
  MIND_GEM: { id: 'MIND_GEM', name: 'Mind Gem', description: 'Boosts special attacks by 20%.', effectType: 'STAT_BOOST', stat: 'atk', value: 1.2 }, 
  CUBE_LEFTOVERS: { id: 'CUBE_LEFTOVERS', name: 'Cube Scraps', description: 'Restores 6% HP each turn.', effectType: 'HEAL_TURN', value: 0.06 },
  SPEED_BOOTS: { id: 'SPEED_BOOTS', name: 'Speed Vector', description: 'Increases Speed by 50%.', effectType: 'STAT_BOOST', stat: 'spd', value: 1.5 },
  POWER_CORE: { id: 'POWER_CORE', name: 'Power Core', description: 'Boosts damage by 30% but takes recoil.', effectType: 'RECOIL_BOOST', value: 1.3 },
  BERRY_BIT: { id: 'BERRY_BIT', name: 'Bit Berry', description: 'Heals 50% HP when below 50%. One use.', effectType: 'HEAL_LOW', value: 0.5, consumed: true },
  FOCUS_BAND: { id: 'FOCUS_BAND', name: 'Focus Band', description: '10% chance to survive a fatal hit.', effectType: 'RESIST', value: 0.1 },
  LASER_SCOPE: { id: 'LASER_SCOPE', name: 'Laser Scope', description: 'Increases critical hit ratio.', effectType: 'CRIT_BOOST', value: 1 },
  PRISM_GUARD: { id: 'PRISM_GUARD', name: 'Prism Guard', description: 'Boosts Defense by 20%.', effectType: 'STAT_BOOST', stat: 'def', value: 1.2 },
  OVERCLOCK_CHIP: { id: 'OVERCLOCK_CHIP', name: 'Overclock Chip', description: 'Boosts Speed by 20% but lowers Def.', effectType: 'STAT_BOOST', stat: 'spd', value: 1.2 },
  DEBUGGER: { id: 'DEBUGGER', name: 'Debugger', description: 'Cures Status Condition immediately. One use.', effectType: 'CURE_STATUS', consumed: true },
};

export const MOVES_POOL: Record<string, Omit<Move, 'id' | 'maxPp'>> = {
  // Sharp Moves
  PIERCE: { name: 'Pierce', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 50, accuracy: 100, pp: 30, description: 'A quick jab.', priority: 1 },
  TRIANGLE_BEAM: { name: 'Tri-Beam', type: ShapeType.SHARP, category: MoveCategory.SPECIAL, power: 90, accuracy: 90, pp: 10, description: 'Fires a triangular laser.' },
  SPIKE_TRAP: { name: 'Spike Trap', type: ShapeType.SHARP, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 15, description: 'Lays a trap.', effect: 'BUFF_ATK' },
  SKY_DIVE: { name: 'Sky Dive', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 100, accuracy: 85, pp: 5, description: 'High power, low accuracy.' },
  CROSS_CUT: { name: 'Cross Cut', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 70, accuracy: 100, pp: 20, description: 'High critical hit ratio.' },
  STAR_FALL: { name: 'Star Fall', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 120, accuracy: 80, pp: 5, description: 'A massive star crashes down.' },
  AERO_SLASH: { name: 'Aero Slash', type: ShapeType.SHARP, category: MoveCategory.SPECIAL, power: 75, accuracy: 95, pp: 15, description: 'Slashes with air pressure.' },

  // Round Moves
  ROLLOUT: { name: 'Rollout', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 40, accuracy: 90, pp: 20, description: 'Rolls into the enemy.' },
  BUBBLE_BLAST: { name: 'Bubble Blast', type: ShapeType.ROUND, category: MoveCategory.SPECIAL, power: 65, accuracy: 100, pp: 20, description: 'Blasts bubbles. May Lag.', targetStatus: 'LAGGING', statusChance: 30 },
  RECOVER: { name: 'Recover', type: ShapeType.ROUND, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 5, description: 'Heals 50% HP.', effect: 'HEAL' },
  BOUNCE: { name: 'Bounce', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 85, accuracy: 85, pp: 10, description: 'Bounces on the foe.' },
  GRAVITY_WELL: { name: 'Gravity Well', type: ShapeType.ROUND, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 10, description: 'Increases Defense.', effect: 'BUFF_DEF' },
  DRILL_RUN: { name: 'Drill Run', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 80, accuracy: 95, pp: 10, description: 'Rotates at high speed.' },

  // Stable Moves
  BOX_BASH: { name: 'Box Bash', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 80, accuracy: 100, pp: 15, description: 'Slams a heavy side.' },
  GRID_LOCK: { name: 'Grid Lock', type: ShapeType.STABLE, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 20, description: 'Traps the enemy. Causes Lag.', targetStatus: 'LAGGING', statusChance: 100 },
  FORTIFY: { name: 'Fortify', type: ShapeType.STABLE, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 20, description: 'Raises Defense.', effect: 'BUFF_DEF' },
  BLOCKADE: { name: 'Blockade', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 90, accuracy: 100, pp: 10, description: 'A massive wall attack.' },
  HEX_SHIELD: { name: 'Hex Shield', type: ShapeType.STABLE, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 10, description: 'Protects from attacks.', priority: 3 },
  EARTH_SHAKE: { name: 'Earth Shake', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 100, accuracy: 100, pp: 10, description: 'Shakes the ground.' },

  // Void Moves
  NULL_RAY: { name: 'Null Ray', type: ShapeType.VOID, category: MoveCategory.SPECIAL, power: 70, accuracy: 100, pp: 15, description: 'A ray of nothingness.' },
  ECHO_WAVE: { name: 'Echo Wave', type: ShapeType.VOID, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 20, description: 'Never misses.', priority: 0 },
  DARK_MATTER: { name: 'Dark Matter', type: ShapeType.VOID, category: MoveCategory.SPECIAL, power: 95, accuracy: 90, pp: 10, description: 'Unstable matter attack. May Fragment.', targetStatus: 'FRAGMENTED', statusChance: 20 },
  BLACK_HOLE: { name: 'Black Hole', type: ShapeType.VOID, category: MoveCategory.SPECIAL, power: 140, accuracy: 90, pp: 5, description: 'Massive damage, user recharges.' },
  
  // Flux Moves
  FLOW_CANNON: { name: 'Flow Cannon', type: ShapeType.FLUX, category: MoveCategory.SPECIAL, power: 110, accuracy: 80, pp: 5, description: 'Massive energy beam.' },
  QUICK_STRIKE: { name: 'Quick Strike', type: ShapeType.FLUX, category: MoveCategory.PHYSICAL, power: 40, accuracy: 100, pp: 30, description: 'Strikes first.', priority: 2 },
  SIPHON: { name: 'Siphon', type: ShapeType.FLUX, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 10, description: 'Drains HP.', drain: true },
  SPIRAL_KICK: { name: 'Spiral Kick', type: ShapeType.FLUX, category: MoveCategory.PHYSICAL, power: 85, accuracy: 95, pp: 15, description: 'Spinning attack.' },
  WAVEFORM: { name: 'Waveform', type: ShapeType.FLUX, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 15, description: 'Boosts Speed.', effect: 'BUFF_SPD' },
  WIND_TUNNEL: { name: 'Wind Tunnel', type: ShapeType.FLUX, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 15, description: 'Creates a tailwind (Speed+).', effect: 'BUFF_SPD' },
  SKEW_STRIKE: { name: 'Skew Strike', type: ShapeType.FLUX, category: MoveCategory.PHYSICAL, power: 70, accuracy: 100, pp: 20, description: 'Hits from an odd angle.' },

  // Glitch Moves
  DATA_STORM: { name: 'Data Storm', type: ShapeType.GLITCH, category: MoveCategory.SPECIAL, power: 80, accuracy: 95, pp: 15, description: 'Corrupts the area.' },
  BUG_BITE: { name: 'Bug Bite', type: ShapeType.GLITCH, category: MoveCategory.PHYSICAL, power: 60, accuracy: 100, pp: 20, description: 'Gnaws at code.' },
  LAG_SPIKE: { name: 'Lag Spike', type: ShapeType.GLITCH, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 10, description: 'Lags the opponent.', targetStatus: 'LAGGING', statusChance: 100 }, 
  PIXEL_BURST: { name: 'Pixel Burst', type: ShapeType.GLITCH, category: MoveCategory.SPECIAL, power: 120, accuracy: 70, pp: 5, description: 'High damage, chaotic.' },
  BINARY_BASH: { name: 'Binary Bash', type: ShapeType.GLITCH, category: MoveCategory.PHYSICAL, power: 90, accuracy: 95, pp: 15, description: '010101 Attack.' },
  CORRUPTION: { name: 'Corruption', type: ShapeType.GLITCH, category: MoveCategory.STATUS, power: 0, accuracy: 90, pp: 10, description: 'Glitches (Poisons) the foe.', targetStatus: 'GLITCHED', statusChance: 100 },

  // Astral Moves
  SOLAR_FLARE: { name: 'Solar Flare', type: ShapeType.ASTRAL, category: MoveCategory.SPECIAL, power: 95, accuracy: 100, pp: 10, description: 'Fragments (Burns) foe.', targetStatus: 'FRAGMENTED', statusChance: 30 },
  COSMIC_RAY: { name: 'Cosmic Ray', type: ShapeType.ASTRAL, category: MoveCategory.SPECIAL, power: 80, accuracy: 100, pp: 15, description: 'Mystic power.' },
  STARDUST: { name: 'Stardust', type: ShapeType.ASTRAL, category: MoveCategory.STATUS, power: 0, accuracy: 75, pp: 15, description: 'Locks (Sleeps) the foe.', targetStatus: 'LOCKED', statusChance: 100 },
  
  // Quantum Moves
  ENTANGLEMENT: { name: 'Entanglement', type: ShapeType.QUANTUM, category: MoveCategory.SPECIAL, power: 70, accuracy: 100, pp: 20, description: 'Binds targets.' },
  SUPERPOSITION: { name: 'Superposition', type: ShapeType.QUANTUM, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 10, description: 'Boosts Evasion (Speed).', effect: 'BUFF_SPD' },
  UNCERTAINTY: { name: 'Uncertainty', type: ShapeType.QUANTUM, category: MoveCategory.PHYSICAL, power: 60, accuracy: 100, pp: 20, description: 'Variable logic. May Lock.', targetStatus: 'LOCKED', statusChance: 10 },
  EVENT_HORIZON: { name: 'Event Horizon', type: ShapeType.QUANTUM, category: MoveCategory.SPECIAL, power: 130, accuracy: 90, pp: 5, description: 'Deals massive damage.' },
};

export const createMove = (key: string): Move => ({
  ...MOVES_POOL[key],
  id: key,
  maxPp: MOVES_POOL[key].pp,
  priority: MOVES_POOL[key].priority || 0
});

export const SPECIES = {
  TRIANGLE: {
    speciesId: 'triangle',
    name: 'Pyramidon',
    type: ShapeType.SHARP,
    baseStats: { hp: 100, atk: 120, def: 60, spd: 110 },
    color: 'text-red-400',
    moveKeys: ['PIERCE', 'TRIANGLE_BEAM', 'FORTIFY', 'SKY_DIVE', 'CROSS_CUT'],
    defaultAbility: 'ROUGH_SKIN'
  },
  CIRCLE: {
    speciesId: 'circle',
    name: 'Orbulon',
    type: ShapeType.ROUND,
    baseStats: { hp: 140, atk: 70, def: 80, spd: 80 },
    color: 'text-blue-400',
    moveKeys: ['BUBBLE_BLAST', 'RECOVER', 'ROLLOUT', 'BOUNCE'],
    defaultAbility: 'REGENERATOR'
  },
  SQUARE: {
    speciesId: 'square',
    name: 'Cubix',
    type: ShapeType.STABLE,
    baseStats: { hp: 120, atk: 100, def: 120, spd: 50 },
    color: 'text-green-400',
    moveKeys: ['BOX_BASH', 'GRID_LOCK', 'FORTIFY', 'BLOCKADE', 'HEX_SHIELD'],
    defaultAbility: 'STURDY'
  },
  PENTAGON: {
    speciesId: 'pentagon',
    name: 'Pentar',
    type: ShapeType.VOID,
    baseStats: { hp: 110, atk: 90, def: 90, spd: 90 },
    color: 'text-purple-400',
    moveKeys: ['NULL_RAY', 'TRIANGLE_BEAM', 'BOX_BASH', 'ECHO_WAVE'],
    defaultAbility: 'PRISM_ARMOR'
  },
  HEXAGON: {
    speciesId: 'hexagon',
    name: 'Hexaclad',
    type: ShapeType.STABLE,
    baseStats: { hp: 150, atk: 80, def: 150, spd: 30 },
    color: 'text-yellow-600',
    moveKeys: ['BLOCKADE', 'HEX_SHIELD', 'ROLLOUT', 'RECOVER', 'BOX_BASH'],
    defaultAbility: 'ROUGH_SKIN'
  },
  SPIRAL: {
    speciesId: 'spiral',
    name: 'Vortex',
    type: ShapeType.FLUX,
    baseStats: { hp: 70, atk: 110, def: 60, spd: 140 },
    color: 'text-cyan-400',
    moveKeys: ['SPIRAL_KICK', 'QUICK_STRIKE', 'FLOW_CANNON', 'SIPHON'],
    defaultAbility: 'SPEED_BOOST'
  },
  CROSS: {
    speciesId: 'cross',
    name: 'Crux',
    type: ShapeType.SHARP,
    baseStats: { hp: 90, atk: 130, def: 90, spd: 80 },
    color: 'text-red-600',
    moveKeys: ['CROSS_CUT', 'SPIKE_TRAP', 'PIERCE', 'FORTIFY'],
    defaultAbility: 'DOWNLOAD'
  },
  FRACTAL: {
    speciesId: 'fractal',
    name: 'Mandelbrot',
    type: ShapeType.GLITCH,
    baseStats: { hp: 80, atk: 130, def: 70, spd: 100 },
    color: 'text-pink-500',
    moveKeys: ['DATA_STORM', 'PIXEL_BURST', 'BUG_BITE', 'LAG_SPIKE', 'NULL_RAY'],
    defaultAbility: 'PIXELATE'
  },
  RHOMBUS: {
    speciesId: 'rhombus',
    name: 'Rhombo',
    type: ShapeType.FLUX,
    baseStats: { hp: 100, atk: 100, def: 80, spd: 110 },
    color: 'text-teal-400',
    moveKeys: ['QUICK_STRIKE', 'TRIANGLE_BEAM', 'SIPHON', 'SPIRAL_KICK'],
    defaultAbility: 'SPEED_BOOST'
  },
  STAR: {
    speciesId: 'star',
    name: 'Nova',
    type: ShapeType.SHARP,
    baseStats: { hp: 70, atk: 135, def: 60, spd: 125 },
    color: 'text-yellow-400',
    moveKeys: ['STAR_FALL', 'PIERCE', 'QUICK_STRIKE', 'SKY_DIVE'],
    defaultAbility: 'DOWNLOAD'
  },
  TRAPEZOID: {
    speciesId: 'trapezoid',
    name: 'Trapezon',
    type: ShapeType.STABLE,
    baseStats: { hp: 130, atk: 110, def: 130, spd: 40 },
    color: 'text-orange-500',
    moveKeys: ['EARTH_SHAKE', 'BOX_BASH', 'BLOCKADE', 'FORTIFY'],
    defaultAbility: 'STURDY'
  },
  OVAL: {
    speciesId: 'oval',
    name: 'Ellipsos',
    type: ShapeType.ROUND,
    baseStats: { hp: 160, atk: 80, def: 80, spd: 60 },
    color: 'text-indigo-400',
    moveKeys: ['GRAVITY_WELL', 'BUBBLE_BLAST', 'RECOVER', 'ECHO_WAVE'],
    defaultAbility: 'REGENERATOR'
  },
  CRESCENT: {
    speciesId: 'crescent',
    name: 'Lunaris',
    type: ShapeType.SHARP,
    baseStats: { hp: 90, atk: 90, def: 90, spd: 100 },
    color: 'text-gray-200',
    moveKeys: ['CROSS_CUT', 'NULL_RAY', 'DARK_MATTER', 'SKY_DIVE'],
    defaultAbility: 'LEVITATE'
  },
  DODECAHEDRON: {
    speciesId: 'dodecahedron',
    name: 'Dodeca',
    type: ShapeType.VOID,
    baseStats: { hp: 100, atk: 120, def: 100, spd: 80 },
    color: 'text-fuchsia-500',
    moveKeys: ['BLACK_HOLE', 'DARK_MATTER', 'ECHO_WAVE', 'FORTIFY'],
    defaultAbility: 'PRISM_ARMOR'
  },
  // --- New Shapes ---
  ICOSAHEDRON: {
    speciesId: 'icosahedron',
    name: 'Icosas',
    type: ShapeType.ASTRAL,
    baseStats: { hp: 80, atk: 140, def: 80, spd: 110 },
    color: 'text-indigo-300',
    moveKeys: ['SOLAR_FLARE', 'COSMIC_RAY', 'STARDUST', 'NULL_RAY'],
    defaultAbility: 'LEVITATE'
  },
  TESSERACT: {
    speciesId: 'tesseract',
    name: 'Hypercube',
    type: ShapeType.QUANTUM,
    baseStats: { hp: 110, atk: 100, def: 110, spd: 90 },
    color: 'text-cyan-600',
    moveKeys: ['ENTANGLEMENT', 'UNCERTAINTY', 'EVENT_HORIZON', 'GRID_LOCK'],
    defaultAbility: 'PRISM_ARMOR'
  },
  // --- Newest Shapes ---
  KITE: {
    speciesId: 'kite',
    name: 'Zephyr',
    type: ShapeType.SHARP,
    baseStats: { hp: 60, atk: 110, def: 50, spd: 150 },
    color: 'text-sky-300',
    moveKeys: ['AERO_SLASH', 'QUICK_STRIKE', 'SKY_DIVE', 'WIND_TUNNEL'],
    defaultAbility: 'AERODYNAMICS'
  },
  PARALLELOGRAM: {
    speciesId: 'parallelogram',
    name: 'Skew',
    type: ShapeType.FLUX,
    baseStats: { hp: 90, atk: 120, def: 70, spd: 120 },
    color: 'text-lime-400',
    moveKeys: ['SKEW_STRIKE', 'SPIRAL_KICK', 'QUICK_STRIKE', 'PIERCE'],
    defaultAbility: 'SPEED_BOOST'
  },
  CONE: {
    speciesId: 'cone',
    name: 'Drillbit',
    type: ShapeType.ROUND,
    baseStats: { hp: 110, atk: 130, def: 90, spd: 60 },
    color: 'text-orange-600',
    moveKeys: ['DRILL_RUN', 'PIERCE', 'ROLLOUT', 'FORTIFY'],
    defaultAbility: 'POINTY_END'
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
  
  const calcStat = (base: number) => Math.floor((base * 2 * level) / 100) + 5;
  const calcHp = (base: number) => Math.floor((base * 2 * level) / 100) + level + 10;

  const moveKeys = customMoveKeys || species.moveKeys.slice(0, 4);
  const moves = moveKeys.map(k => createMove(k));
  
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
    heldItem: { ...heldItem },
    ability: species.defaultAbility || 'NONE',
    statusCondition: 'NONE',
    statusTurnCount: 0
  };
};

export const INITIAL_PLAYER_TEAM = [
  createInstance('TRIANGLE', 50, 'p1'),
  createInstance('SQUARE', 50, 'p1'),
  createInstance('CIRCLE', 50, 'p1'),
];

export const INITIAL_ENEMY_TEAM = [
  createInstance('TESSERACT', 50, 'p2'),
  createInstance('ICOSAHEDRON', 50, 'p2'),
  createInstance('SQUARE', 50, 'p2'),
];

// ==========================================
// 3. SERVICES
// ==========================================

export const generateRoomId = () => Math.random().toString(36).substring(2, 6).toUpperCase();

class PeerService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onDataCallback: ((data: MultiplayerMessage) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;

  init(id?: string): Promise<string> {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
      this.conn = null;
    }

    return new Promise((resolve, reject) => {
      this.peer = new Peer(id || generateRoomId(), {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('disconnected', () => {
        this.peer?.reconnect();
      });

      this.peer.on('close', () => {
        this.conn = null;
      });

      this.peer.on('error', (err) => {
        console.error('Peer error', err);
        if (err.type === 'unavailable-id' || err.type === 'invalid-id' || err.type === 'ssl-unavailable') {
           reject(err);
        }
      });
    });
  }

  connect(peerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject(new Error("Peer not initialized"));
      const conn = this.peer.connect(peerId);
      conn.on('open', () => {
        this.handleConnection(conn);
        resolve();
      });
      conn.on('error', (err) => {
        reject(err);
      });
      setTimeout(() => {
        if (!conn.open) console.warn("Connection attempt timed out");
      }, 5000);
    });
  }

  private handleConnection(conn: DataConnection) {
    this.conn = conn;
    const setup = () => {
      if (this.onConnectCallback) this.onConnectCallback();
    };
    if (conn.open) {
      setup();
    } else {
      conn.on('open', () => {
         setup();
      });
    }
    conn.on('data', (data) => {
      if (this.onDataCallback) this.onDataCallback(data as MultiplayerMessage);
    });
    conn.on('close', () => {
      this.conn = null;
    });
  }

  send(data: MultiplayerMessage) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  onData(cb: (data: MultiplayerMessage) => void) {
    this.onDataCallback = cb;
  }

  onConnect(cb: () => void) {
    this.onConnectCallback = cb;
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.conn = null;
  }
}

export const peerService = new PeerService();

export interface CPUMoveDecision {
  moveIndex: number;
  taunt: string;
}

const getCPUMove = (cpuShape: ShapeInstance, playerShape: ShapeInstance): CPUMoveDecision => {
  let bestMoveIndex = 0;
  let maxDamage = -1;

  cpuShape.moves.forEach((move, index) => {
    let damage = move.power;
    if (move.category === 'STATUS') damage = 0;
    
    // AI considers type effectiveness
    const multiplier = TYPE_CHART[move.type][playerShape.type];
    damage *= multiplier;

    if (move.effect === 'HEAL' && cpuShape.stats.hp < cpuShape.stats.maxHp * 0.4) {
      damage = 999; 
    }

    if (damage > maxDamage) {
      maxDamage = damage;
      bestMoveIndex = index;
    }
  });

  const taunts = [
    "Calculated.",
    "Optimal strategy engaged.",
    "Your angles are weak.",
    "Geometry is on my side.",
    "Prepare to be deleted."
  ];

  return {
    moveIndex: bestMoveIndex,
    taunt: taunts[Math.floor(Math.random() * taunts.length)]
  };
};

// ==========================================
// 4. UTILS (Battle Logic)
// ==========================================

const getDamageResult = (attacker: ShapeInstance, defender: ShapeInstance, move: Move) => {
  if (move.category === 'STATUS') return { damage: 0, typeMult: 0 };

  let atkStat = attacker.stats.atk;
  const defStat = move.category === 'PHYSICAL' ? defender.stats.def : defender.stats.spd;
  
  // Status Effects
  if (attacker.statusCondition === 'FRAGMENTED' && move.category === 'PHYSICAL') {
    atkStat = Math.floor(atkStat * 0.5);
  }

  // Item Effects
  if (attacker.heldItem) {
    if (attacker.heldItem.id === 'ATTACK_PRISM' && move.category === 'PHYSICAL') atkStat *= 1.2;
    if (attacker.heldItem.id === 'MIND_GEM' && move.category === 'SPECIAL') atkStat *= 1.2;
    if (attacker.heldItem.id === 'POWER_CORE') atkStat *= 1.3;
  }

  // Ability Effects (Attacker)
  if (attacker.ability === 'DOWNLOAD') atkStat *= 1.1; 
  if (attacker.ability === 'POINTY_END' && move.category === 'PHYSICAL') atkStat *= 1.2;

  // Defense Boosts
  let effectiveDef = defStat;
  if (defender.heldItem?.id === 'PRISM_GUARD') effectiveDef *= 1.2;
  if (defender.heldItem?.id === 'OVERCLOCK_CHIP') effectiveDef *= 0.8;

  let typeMult = TYPE_CHART[move.type][defender.type];
  
  // Ability Immunities/Resists
  if (defender.ability === 'LEVITATE' && move.type === ShapeType.STABLE) {
    typeMult = 0;
  }
  if (defender.ability === 'PRISM_ARMOR' && typeMult > 1) {
    typeMult *= 0.75; 
  }

  if (attacker.ability === 'PIXELATE' && move.type === ShapeType.VOID) {
     atkStat *= 1.2;
  }

  const baseDmg = (((2 * 50 / 5 + 2) * move.power * (atkStat / effectiveDef)) / 50) + 2;
  const stab = attacker.type === move.type ? 1.5 : 1.0;
  const random = (Math.floor(Math.random() * 16) + 85) / 100;
  
  let damage = Math.floor(baseDmg * stab * typeMult * random);
  
  return { damage, typeMult };
};

export const resolveTurn = (
  playerAction: PlayerAction,
  enemyAction: PlayerAction,
  playerShape: ShapeInstance,
  enemyShape: ShapeInstance,
  playerTeam: ShapeInstance[],
  enemyTeam: ShapeInstance[]
): TurnEvent[] => {
  const events: TurnEvent[] = [];
  
  let activePlayerShape = playerShape;
  let activeEnemyShape = enemyShape;

  if (playerAction.type === 'SWITCH') {
    events.push({ type: 'LOG', message: `Player withdrew ${playerShape.name}!` });
    events.push({ type: 'SWITCH_ANIM', target: 'player', newActiveIndex: playerAction.index });
    activePlayerShape = playerTeam[playerAction.index];
    events.push({ type: 'LOG', message: `Go! ${activePlayerShape.name}!` });
    if (activePlayerShape.ability === 'DOWNLOAD') {
      events.push({ type: 'LOG', message: `${activePlayerShape.name}'s Download boosted its power!` });
    }
  }

  if (enemyAction.type === 'SWITCH') {
    events.push({ type: 'LOG', message: `Opponent withdrew ${enemyShape.name}!` });
    events.push({ type: 'SWITCH_ANIM', target: 'enemy', newActiveIndex: enemyAction.index });
    activeEnemyShape = enemyTeam[enemyAction.index];
    events.push({ type: 'LOG', message: `Opponent sent out ${activeEnemyShape.name}!` });
    if (activeEnemyShape.ability === 'DOWNLOAD') {
       events.push({ type: 'LOG', message: `${activeEnemyShape.name}'s Download boosted its power!` });
    }
  }

  const playerAttacking = playerAction.type === 'MOVE';
  const enemyAttacking = enemyAction.type === 'MOVE';

  const getSpeed = (s: ShapeInstance) => {
    let spd = s.stats.spd;
    if (s.heldItem?.id === 'SPEED_BOOTS') spd *= 1.5;
    if (s.heldItem?.id === 'OVERCLOCK_CHIP') spd *= 1.2;
    if (s.ability === 'SPEED_BOOST') spd *= 1.2;
    if (s.statusCondition === 'LAGGING') spd *= 0.5;
    return spd;
  };

  const getPriority = (action: PlayerAction, shape: ShapeInstance) => {
    if (action.type !== 'MOVE') return 6; 
    return shape.moves[action.index].priority || 0;
  };

  const pPriority = getPriority(playerAction, activePlayerShape);
  const ePriority = getPriority(enemyAction, activeEnemyShape);

  let first = 'player';
  if (pPriority > ePriority) {
    first = 'player';
  } else if (ePriority > pPriority) {
    first = 'enemy';
  } else {
    if (getSpeed(activeEnemyShape) > getSpeed(activePlayerShape)) {
      first = 'enemy';
    } else if (getSpeed(activeEnemyShape) === getSpeed(activePlayerShape)) {
      if (Math.random() > 0.5) first = 'enemy';
    }
  }

  const processAttack = (attackerIsPlayer: boolean) => {
    const attacker = attackerIsPlayer ? activePlayerShape : activeEnemyShape;
    const defender = attackerIsPlayer ? activeEnemyShape : activePlayerShape;
    const action = attackerIsPlayer ? playerAction : enemyAction;
    
    if (attacker.stats.hp <= 0) return;

    // --- Pre-Move Status Checks ---
    if (attacker.statusCondition === 'LOCKED') {
       attacker.statusTurnCount--;
       if (attacker.statusTurnCount <= 0) {
          attacker.statusCondition = 'NONE';
          events.push({ type: 'LOG', message: `${attacker.name} rebooted (Woke up)!` });
       } else {
          events.push({ type: 'LOG', message: `${attacker.name} is Locked (Sleep)!` });
          return;
       }
    }

    if (attacker.statusCondition === 'LAGGING') {
       if (Math.random() < 0.25) {
          events.push({ type: 'LOG', message: `${attacker.name} lagged out (Paralyzed)!` });
          return;
       }
    }

    if (action.type === 'MOVE') {
      const move = attacker.moves[action.index];
      events.push({ type: 'LOG', message: `${attacker.name} used ${move.name}!` });
      events.push({ type: 'ATTACK_ANIM', attacker: attackerIsPlayer ? 'player' : 'enemy' });

      // Apply Move Status Effect (if any)
      const tryApplyStatus = (chance: number, status: StatusCondition) => {
        if (defender.statusCondition === 'NONE' && defender.ability !== 'SYNC_GUARD' && Math.random() * 100 < chance) {
           defender.statusCondition = status;
           if (status === 'LOCKED') defender.statusTurnCount = Math.floor(Math.random() * 3) + 1;
           events.push({ type: 'STATUS_APPLY', target: attackerIsPlayer ? 'enemy' : 'player', effect: status });
           events.push({ type: 'LOG', message: `${defender.name} is now ${status}!` });
        }
      };

      if (move.category === 'STATUS') {
         if (move.effect === 'HEAL') {
           const healAmount = Math.floor(attacker.stats.maxHp * 0.5);
           const actualHeal = Math.min(attacker.stats.maxHp - attacker.stats.hp, healAmount);
           events.push({ type: 'HEAL', attacker: attackerIsPlayer ? 'player' : 'enemy', amount: actualHeal });
           events.push({ type: 'LOG', message: `${attacker.name} regained health!` });
           attacker.stats.hp += actualHeal;
         } else if (move.effect === 'BUFF_DEF') {
           events.push({ type: 'LOG', message: `${attacker.name}'s Defense rose!` });
           attacker.stats.def = Math.floor(attacker.stats.def * 1.5);
         } else if (move.effect === 'BUFF_ATK') {
           events.push({ type: 'LOG', message: `${attacker.name}'s Attack rose!` });
           attacker.stats.atk = Math.floor(attacker.stats.atk * 1.5);
         } else if (move.effect === 'BUFF_SPD') {
            events.push({ type: 'LOG', message: `${attacker.name}'s Speed rose!` });
            attacker.stats.spd = Math.floor(attacker.stats.spd * 1.5);
         }

         if (move.targetStatus && move.statusChance) {
            tryApplyStatus(move.statusChance, move.targetStatus);
         }

      } else {
        const { damage, typeMult } = getDamageResult(attacker, defender, move);
        
        if (typeMult === 0) {
           events.push({ type: 'LOG', message: `It had no effect on ${defender.name}!` });
        } else {
           events.push({ type: 'DAMAGE', target: attackerIsPlayer ? 'enemy' : 'player', amount: damage });
           defender.stats.hp = Math.max(0, defender.stats.hp - damage);

           if (typeMult > 1) events.push({ type: 'LOG', message: "It's super effective!" });
           if (typeMult < 1) events.push({ type: 'LOG', message: "It's not very effective..." });

           // Ability: Rough Skin
           if (defender.ability === 'ROUGH_SKIN' && move.category === 'PHYSICAL') {
              const recoil = Math.floor(attacker.stats.maxHp / 8);
              events.push({ type: 'DAMAGE', target: attackerIsPlayer ? 'player' : 'enemy', amount: recoil });
              events.push({ type: 'LOG', message: `${attacker.name} was hurt by Rough Skin!` });
              attacker.stats.hp = Math.max(0, attacker.stats.hp - recoil);
           }
           
           // Ability: Aerodynamics
           if (defender.ability === 'AERODYNAMICS' && move.type === ShapeType.FLUX) {
              events.push({ type: 'LOG', message: `${defender.name}'s speed rose from the wind!` });
              defender.stats.spd = Math.floor(defender.stats.spd * 1.5);
           }

           if (move.targetStatus && move.statusChance) {
              tryApplyStatus(move.statusChance, move.targetStatus);
           }
        }
        
        if (move.drain) {
           const drainAmount = Math.floor(damage / 2);
           if (drainAmount > 0) {
              events.push({ type: 'HEAL', attacker: attackerIsPlayer ? 'player' : 'enemy', amount: drainAmount });
              events.push({ type: 'LOG', message: `${attacker.name} drained energy!` });
              attacker.stats.hp = Math.min(attacker.stats.maxHp, attacker.stats.hp + drainAmount);
           }
        }

        if (attacker.heldItem?.id === 'POWER_CORE') {
           const recoil = Math.floor(damage * 0.1);
           if (recoil > 0) {
              events.push({ type: 'DAMAGE', target: attackerIsPlayer ? 'player' : 'enemy', amount: recoil });
              events.push({ type: 'LOG', message: `${attacker.name} took recoil damage!` });
              attacker.stats.hp = Math.max(0, attacker.stats.hp - recoil);
           }
        }

        if (defender.stats.hp <= 0) {
           if (defender.ability === 'STURDY' && defender.stats.hp + damage === defender.stats.maxHp) {
              defender.stats.hp = 1;
              events.push({ type: 'LOG', message: `${defender.name} endured the hit (Sturdy)!` });
           } else if (defender.heldItem?.id === 'FOCUS_BAND' && Math.random() < 0.10) {
             defender.stats.hp = 1;
             events.push({ type: 'LOG', message: `${defender.name} hung on using its Focus Band!` });
          } else {
             events.push({ type: 'FAINT', target: attackerIsPlayer ? 'enemy' : 'player' });
             events.push({ type: 'LOG', message: `${defender.name} fainted!` });
          }
        }
      }
    }
  };

  if (first === 'player') {
    if (playerAttacking) processAttack(true);
    if (enemyAttacking) processAttack(false);
  } else {
    if (enemyAttacking) processAttack(false);
    if (playerAttacking) processAttack(true);
  }

  [true, false].forEach(isPlayer => {
    const shape = isPlayer ? activePlayerShape : activeEnemyShape;
    const targetName = isPlayer ? 'player' : 'enemy';

    if (shape.stats.hp > 0) {
      // Regenerator
      if (shape.ability === 'REGENERATOR') {
         const healAmt = Math.floor(shape.stats.maxHp / 16);
         if (shape.stats.hp < shape.stats.maxHp) {
            events.push({ type: 'HEAL', attacker: targetName as any, amount: healAmt });
            events.push({ type: 'LOG', message: `${shape.name}'s Regenerator restored HP!` });
            shape.stats.hp = Math.min(shape.stats.maxHp, shape.stats.hp + healAmt);
         }
      }

      // Leftovers
      if (shape.heldItem?.id === 'CUBE_LEFTOVERS') {
         const healAmt = Math.floor(shape.stats.maxHp / 16);
         if (shape.stats.hp < shape.stats.maxHp) {
            events.push({ type: 'HEAL', attacker: targetName as any, amount: healAmt });
            events.push({ type: 'LOG', message: `${shape.name}'s leftovers restored HP!` });
            shape.stats.hp = Math.min(shape.stats.maxHp, shape.stats.hp + healAmt);
         }
      }

      // Berry Check
      if (shape.heldItem?.id === 'BERRY_BIT' && !shape.heldItem.consumed) {
         if (shape.stats.hp < shape.stats.maxHp / 2) {
            const healAmt = Math.floor(shape.stats.maxHp / 2);
            events.push({ type: 'ITEM_USE', target: targetName as any, effect: 'berry' });
            events.push({ type: 'HEAL', attacker: targetName as any, amount: healAmt });
            events.push({ type: 'LOG', message: `${shape.name} ate its Bit Berry!` });
            shape.stats.hp = Math.min(shape.stats.maxHp, shape.stats.hp + healAmt);
            shape.heldItem.consumed = true;
         }
      }

      // --- End Turn Status Damage ---
      if (shape.statusCondition === 'FRAGMENTED') {
         const dmg = Math.floor(shape.stats.maxHp / 16);
         events.push({ type: 'STATUS_DAMAGE', target: targetName as any, amount: dmg });
         events.push({ type: 'LOG', message: `${shape.name} is hurt by Fragmentation!` });
         shape.stats.hp = Math.max(0, shape.stats.hp - dmg);
      }
      if (shape.statusCondition === 'GLITCHED') {
         const dmg = Math.floor(shape.stats.maxHp / 8);
         events.push({ type: 'STATUS_DAMAGE', target: targetName as any, amount: dmg });
         events.push({ type: 'LOG', message: `${shape.name} is hurt by the Glitch!` });
         shape.stats.hp = Math.max(0, shape.stats.hp - dmg);
      }

      if (shape.stats.hp <= 0 && shape.status !== 'FAINTED') {
         events.push({ type: 'FAINT', target: targetName as any });
         events.push({ type: 'LOG', message: `${shape.name} fainted!` });
      }
    }
  });

  return events;
};

// ==========================================
// 5. COMPONENTS
// ==========================================

interface HealthBarProps {
  current: number;
  max: number;
  label: string;
  isAlly?: boolean;
  status?: StatusCondition;
}

const HealthBar: React.FC<HealthBarProps> = ({ current, max, label, isAlly, status }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  let barColor = 'bg-green-500';
  if (percentage < 50) barColor = 'bg-yellow-400';
  if (percentage < 20) barColor = 'bg-red-500';

  const getStatusBadge = () => {
     switch(status) {
        case 'FRAGMENTED': return <span className="bg-orange-500 text-white text-[10px] px-1 rounded ml-2">FRAG</span>;
        case 'LAGGING': return <span className="bg-yellow-500 text-black text-[10px] px-1 rounded ml-2">LAG</span>;
        case 'GLITCHED': return <span className="bg-purple-500 text-white text-[10px] px-1 rounded ml-2">GLITCH</span>;
        case 'LOCKED': return <span className="bg-gray-400 text-black text-[10px] px-1 rounded ml-2">LOCK</span>;
        default: return null;
     }
  };

  return (
    <div className={`w-64 bg-gray-800 border-2 border-gray-600 p-2 rounded-lg shadow-lg ${isAlly ? 'ml-auto' : ''}`}>
      <div className="flex justify-between items-end mb-1">
        <div className="flex items-center">
           <span className="font-bold text-white uppercase tracking-wider text-sm shadow-black drop-shadow-md">{label}</span>
           {getStatusBadge()}
        </div>
        <span className="text-xs text-gray-300 pixel-font">{current}/{max}</span>
      </div>
      <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
        <div 
          className={`h-full ${barColor} transition-all duration-500 ease-out`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface ShapeVisualProps {
  shape: ShapeInstance;
  isAlly?: boolean;
  animation?: string;
}

const ShapeVisual: React.FC<ShapeVisualProps> = ({ shape, isAlly, animation }) => {
  const colorClass = shape.spriteColor || 'text-gray-400';
  const getPath = () => {
    switch (shape.speciesId) {
      case 'triangle':
        return <polygon points="60,10 110,110 10,110" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'circle':
        return <circle cx="60" cy="60" r="50" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'square':
        return <rect x="20" y="20" width="80" height="80" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'pentagon':
        return <polygon points="60,10 110,48 91,108 29,108 10,48" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'hexagon':
        return <polygon points="30,10 90,10 115,53 90,96 30,96 5,53" className="fill-current" stroke="white" strokeWidth="4" transform="translate(0, 10)" />;
      case 'spiral':
        return (
          <g transform="translate(60,60)">
             <path d="M0,0 m-40,0 a40,40 0 1,0 80,0 a40,40 0 1,0 -80,0 M0,0 m-25,0 a25,25 0 1,1 50,0 a25,25 0 1,1 -50,0 M0,0 m-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0" 
             className="fill-none stroke-current" strokeWidth="8" />
             <circle r="50" className="stroke-white fill-none" strokeWidth="4"/>
          </g>
        );
      case 'cross':
        return <path d="M40,10 h40 v30 h30 v40 h-30 v30 h-40 v-30 h-30 v-40 h30 z" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'rhombus':
        return <polygon points="60,10 100,60 60,110 20,60" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'fractal':
         return (
           <g>
             <rect x="30" y="30" width="60" height="60" className="fill-current" stroke="white" strokeWidth="2" />
             <rect x="10" y="10" width="20" height="20" className="fill-current" stroke="white" strokeWidth="2" />
             <rect x="90" y="10" width="20" height="20" className="fill-current" stroke="white" strokeWidth="2" />
             <rect x="10" y="90" width="20" height="20" className="fill-current" stroke="white" strokeWidth="2" />
             <rect x="90" y="90" width="20" height="20" className="fill-current" stroke="white" strokeWidth="2" />
           </g>
         );
      case 'star':
        return <polygon points="60,5 75,45 115,45 85,70 95,110 60,85 25,110 35,70 5,45 45,45" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'trapezoid':
        return <polygon points="40,20 80,20 100,100 20,100" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'oval':
        return <ellipse cx="60" cy="60" rx="55" ry="35" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'crescent':
        return <path d="M70,10 A 50,50 0 1 1 70,110 A 35,35 0 1 0 70,10 Z" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'dodecahedron':
        return (
          <g>
             <polygon points="60,10 105,35 105,85 60,110 15,85 15,35" className="fill-current" stroke="white" strokeWidth="4" />
             <polygon points="60,35 85,50 85,75 60,90 35,75 35,50" className="stroke-white fill-none" strokeWidth="2" />
             <line x1="60" y1="10" x2="60" y2="35" stroke="white" strokeWidth="2" />
             <line x1="105" y1="35" x2="85" y2="50" stroke="white" strokeWidth="2" />
             <line x1="105" y1="85" x2="85" y2="75" stroke="white" strokeWidth="2" />
             <line x1="60" y1="110" x2="60" y2="90" stroke="white" strokeWidth="2" />
             <line x1="15" y1="85" x2="35" y2="75" stroke="white" strokeWidth="2" />
             <line x1="15" y1="35" x2="35" y2="50" stroke="white" strokeWidth="2" />
          </g>
        );
      case 'icosahedron':
        return (
          <g>
             <polygon points="60,5 110,35 110,85 60,115 10,85 10,35" className="fill-current" stroke="white" strokeWidth="4" />
             <path d="M10,35 L60,60 L110,35" stroke="white" strokeWidth="3" fill="none" />
             <path d="M10,85 L60,60 L110,85" stroke="white" strokeWidth="3" fill="none" />
             <path d="M60,115 L60,60 L60,5" stroke="white" strokeWidth="3" fill="none" />
          </g>
        );
      case 'tesseract':
        return (
          <g>
             <rect x="15" y="15" width="90" height="90" className="stroke-white fill-none" strokeWidth="4" />
             <rect x="40" y="40" width="40" height="40" className="fill-current stroke-white" strokeWidth="3" />
             <line x1="15" y1="15" x2="40" y2="40" stroke="white" strokeWidth="2"/>
             <line x1="105" y1="15" x2="80" y2="40" stroke="white" strokeWidth="2"/>
             <line x1="15" y1="105" x2="40" y2="80" stroke="white" strokeWidth="2"/>
             <line x1="105" y1="105" x2="80" y2="80" stroke="white" strokeWidth="2"/>
          </g>
        );
      case 'kite':
        return <polygon points="60,10 110,50 60,115 10,50" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'parallelogram':
        return <polygon points="40,20 100,20 80,100 20,100" className="fill-current" stroke="white" strokeWidth="4" />;
      case 'cone':
        return (
           <g>
             <polygon points="60,10 100,90 20,90" className="fill-current" stroke="white" strokeWidth="4" />
             <path d="M20,90 Q60,110 100,90" className="fill-current" stroke="white" strokeWidth="4" />
           </g>
        );
      default:
        return <rect x="20" y="20" width="80" height="80" className="fill-current" />;
    }
  };

  const shadow = (
    <ellipse cx="60" cy="115" rx="40" ry="10" className="fill-black opacity-30" />
  );

  return (
    <div className={`relative w-48 h-48 flex flex-col items-center justify-center ${animation}`}>
      <svg viewBox="0 0 120 130" className={`w-full h-full drop-shadow-2xl ${colorClass} ${shape.status === 'FAINTED' ? 'opacity-0 transition-opacity duration-1000' : ''}`}>
        {shadow}
        {getPath()}
      </svg>
      <div className={`absolute bottom-0 w-32 h-8 bg-gray-700/50 rounded-[100%] border border-gray-600 blur-sm transform translate-y-2 -z-10`} />
    </div>
  );
};

interface TeambuilderProps {
  onBack: () => void;
  initialTeam?: TeamMemberConfig[];
  onSave: (team: TeamMemberConfig[]) => void;
  user: User | null;
}

const DEFAULT_BUILDER_TEAM: TeamMemberConfig[] = [
  { species: 'TRIANGLE', moves: ['PIERCE', 'TRIANGLE_BEAM', 'FORTIFY', 'NULL_RAY'], item: 'NONE' },
  { species: 'SQUARE', moves: ['BOX_BASH', 'GRID_LOCK', 'FORTIFY', 'RECOVER'], item: 'NONE' },
  { species: 'CIRCLE', moves: ['BUBBLE_BLAST', 'RECOVER', 'ROLLOUT', 'NULL_RAY'], item: 'NONE' },
];

const Teambuilder: React.FC<TeambuilderProps> = ({ onBack, onSave, initialTeam, user }) => {
  const [team, setTeam] = useState<TeamMemberConfig[]>(initialTeam || DEFAULT_BUILDER_TEAM);
  const [selectedSlot, setSelectedSlot] = useState(0);

  const currentMember = team[selectedSlot];
  const speciesData = SPECIES[currentMember.species];
  const previewInstance = createInstance(currentMember.species);

  const updateMember = (updates: Partial<TeamMemberConfig>) => {
    const newTeam = [...team];
    newTeam[selectedSlot] = { ...newTeam[selectedSlot], ...updates };
    if (updates.species) {
      const newSpecies = SPECIES[updates.species];
      newTeam[selectedSlot].moves = newSpecies.moveKeys.slice(0, 4);
    }
    setTeam(newTeam);
  };

  const updateMove = (moveIndex: number, moveKey: string) => {
    const newMoves = [...currentMember.moves];
    newMoves[moveIndex] = moveKey;
    updateMember({ moves: newMoves });
  };

  const handleSave = () => {
    onSave(team);
    onBack();
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4 font-mono">
      <div className="w-full max-w-5xl bg-gray-800 border-2 border-blue-500 rounded-lg p-6 shadow-2xl flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/4 flex flex-col gap-4">
          <h2 className="text-xl text-blue-400 pixel-font mb-2">My Team</h2>
          <div className="text-xs text-gray-500 mb-2">
            {user ? `Saving to Cloud as ${user.displayName}` : 'Saving to Local Storage'}
          </div>
          {team.map((member, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSlot(idx)}
              className={`p-3 rounded border-2 text-left flex items-center gap-3 transition-all ${
                selectedSlot === idx 
                  ? 'border-blue-400 bg-blue-900/40 text-white' 
                  : 'border-gray-600 bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <div className="w-8 h-8 flex items-center justify-center font-bold text-xs bg-black rounded-full border border-gray-500">
                {idx + 1}
              </div>
              <div>
                <div className="font-bold text-sm">{SPECIES[member.species].name}</div>
                <div className="text-[10px] opacity-70">{member.item !== 'NONE' ? ITEMS[member.item].name : 'No Item'}</div>
              </div>
            </button>
          ))}
          <div className="mt-auto pt-4 flex flex-col gap-2">
            <button onClick={handleSave} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all">SAVE & EXIT</button>
            <button onClick={onBack} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">CANCEL</button>
          </div>
        </div>
        <div className="w-full md:w-3/4 bg-black/30 rounded border border-gray-700 p-6 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
               <div className="flex flex-col items-center">
                 <ShapeVisual shape={previewInstance} isAlly />
                 <div className="mt-4 px-3 py-1 bg-gray-900 rounded border border-gray-600 text-xs text-gray-400">Level 50</div>
                 <div className="mt-2 text-xs text-yellow-500 font-bold uppercase tracking-widest">
                    Ability: {ABILITIES[previewInstance.ability]?.name || 'None'}
                 </div>
               </div>
               <div className="flex-grow w-full space-y-4">
                  <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">Shape Chassis</label>
                    <select value={currentMember.species} onChange={(e) => updateMember({ species: e.target.value as any })} className="w-full p-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500 outline-none">
                      {Object.keys(SPECIES).map(key => <option key={key} value={key}>{SPECIES[key as keyof typeof SPECIES].name} ({SPECIES[key as keyof typeof SPECIES].type})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">Held Module (Item)</label>
                    <select value={currentMember.item} onChange={(e) => updateMember({ item: e.target.value })} className="w-full p-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500 outline-none">
                      {Object.values(ITEMS).map(item => <option key={item.id} value={item.id}>{item.name} - {item.description}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                     {Object.entries(speciesData.baseStats).map(([stat, val]) => (
                        <div key={stat} className="bg-gray-800 p-2 rounded border border-gray-700">
                           <div className="text-[10px] uppercase text-gray-500">{stat}</div>
                           <div className="text-white font-bold">{val}</div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
            <hr className="border-gray-700" />
            <div>
               <h3 className="text-blue-400 pixel-font text-sm mb-4">Moveset Configuration</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[0, 1, 2, 3].map(moveIdx => (
                    <div key={moveIdx}>
                       <label className="text-[10px] text-gray-500 uppercase ml-1">Move {moveIdx + 1}</label>
                       <select value={currentMember.moves[moveIdx]} onChange={(e) => updateMove(moveIdx, e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500 outline-none text-sm">
                         {speciesData.moveKeys.map(moveKey => {
                           const move = MOVES_POOL[moveKey];
                           return <option key={moveKey} value={moveKey}>{move.name} ({move.type}/{move.category})</option>;
                         })}
                       </select>
                    </div>
                 ))}
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const TypeChartOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const types = Object.values(ShapeType);
  
  const getTypeColor = (t: ShapeType) => {
    switch(t) {
      case ShapeType.SHARP: return 'text-red-400';
      case ShapeType.ROUND: return 'text-blue-400';
      case ShapeType.STABLE: return 'text-green-400';
      case ShapeType.VOID: return 'text-purple-400';
      case ShapeType.FLUX: return 'text-cyan-400';
      case ShapeType.GLITCH: return 'text-pink-500';
      case ShapeType.ASTRAL: return 'text-indigo-300';
      case ShapeType.QUANTUM: return 'text-cyan-600';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 border-2 border-yellow-500 rounded-lg p-6 max-w-full max-h-full overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white pixel-font">Type Effectiveness</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕ (ESC/SPACE)</button>
        </div>
        <div className="text-xs text-gray-400 mb-4 text-center">Row attacks Column</div>
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs md:text-sm">
            <thead>
              <tr>
                <th className="p-2 border border-gray-700 bg-gray-900">ATK \ DEF</th>
                {types.map(t => (
                  <th key={t} className={`p-2 border border-gray-700 bg-gray-900 ${getTypeColor(t)}`}>{t.substring(0,3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map(attacker => (
                <tr key={attacker}>
                  <th className={`p-2 border border-gray-700 bg-gray-900 ${getTypeColor(attacker)} text-left`}>{attacker}</th>
                  {types.map(defender => {
                    const val = TYPE_CHART[attacker][defender];
                    let cellClass = "text-gray-600";
                    let text = "-";
                    if (val === 2) { cellClass = "text-green-400 font-bold bg-green-900/20"; text = "2x"; }
                    if (val === 0.5) { cellClass = "text-red-400 bg-red-900/20"; text = "½"; }
                    if (val === 0) { cellClass = "text-gray-500 bg-gray-900"; text = "0"; }
                    return (
                      <td key={defender} className={`p-2 border border-gray-700 text-center ${cellClass}`}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. APP
// ==========================================

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('SINGLE');
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [lobbyStatus, setLobbyStatus] = useState('');

  const [playerTeam, setPlayerTeam] = useState<ShapeInstance[]>(INITIAL_PLAYER_TEAM);
  const [enemyTeam, setEnemyTeam] = useState<ShapeInstance[]>(INITIAL_ENEMY_TEAM);
  
  // Strict sync for multiplayer start
  const [hasReceivedEnemyTeam, setHasReceivedEnemyTeam] = useState(false);

  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [activeEnemyIdx, setActiveEnemyIdx] = useState(0);
  
  const [phase, setPhase] = useState<TurnPhase>('LOBBY');
  const [logs, setLogs] = useState<string[]>(['Welcome to Shape Showdown!']);
  const [animatingShape, setAnimatingShape] = useState<'player' | 'enemy' | null>(null);
  const [animatingAction, setAnimatingAction] = useState<string>('');
  
  const [pendingPlayerAction, setPendingPlayerAction] = useState<PlayerAction | null>(null);
  const [pendingEnemyAction, setPendingEnemyAction] = useState<PlayerAction | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const [savedTeamConfig, setSavedTeamConfig] = useState<TeamMemberConfig[] | null>(null);
  const [showTeambuilder, setShowTeambuilder] = useState(false);
  const [showTypeChart, setShowTypeChart] = useState(false);

  const [user, setUser] = useState<User | null>(null);

  // Define activeEnemy to be used in JSX below
  const activeEnemy = enemyTeam[activeEnemyIdx];

  useEffect(() => {
    // Auth disabled
    loadLocalTeam();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Prevent scrolling with spacebar
        e.preventDefault();
        setShowTypeChart(prev => !prev);
      }
      if (e.code === 'Escape' && showTypeChart) {
        setShowTypeChart(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTypeChart]);

  const loadLocalTeam = () => {
    try {
      const saved = localStorage.getItem('shape_showdown_team');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].species && SPECIES[parsed[0].species as keyof typeof SPECIES]) {
          setSavedTeamConfig(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved team", e);
    }
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleLogin = async () => {
    alert("Authentication is currently disabled.");
  };

  const handleLogout = async () => {
     window.location.reload();
  };

  const buildTeamFromConfig = (config: TeamMemberConfig[] | null, idPrefix: string): ShapeInstance[] => {
    if (!config || config.length === 0) return idPrefix === 'p1' ? INITIAL_PLAYER_TEAM : INITIAL_ENEMY_TEAM;
    const team = config.map(member => createInstance(member.species, 50, idPrefix, member.moves, member.item));
    if (team.length === 0) return idPrefix === 'p1' ? INITIAL_PLAYER_TEAM : INITIAL_ENEMY_TEAM;
    return team;
  };

  const handleTeamSave = async (newTeam: TeamMemberConfig[]) => {
     setSavedTeamConfig(newTeam);
     localStorage.setItem('shape_showdown_team', JSON.stringify(newTeam));
  };

  useEffect(() => {
    peerService.onData((msg: MultiplayerMessage) => {
      console.log('Received:', msg);
      switch (msg.type) {
        case 'HANDSHAKE':
          if (msg.payload && msg.payload.team && Array.isArray(msg.payload.team)) {
            // DEEP COPY to ensure new references
            const theirTeam = msg.payload.team.map((s: any) => ({ 
                ...s, 
                stats: { ...s.stats },
                moves: s.moves.map((m: any) => ({ ...m })),
                heldItem: s.heldItem ? { ...s.heldItem } : undefined
            }));
            
            setEnemyTeam(theirTeam);
            setHasReceivedEnemyTeam(true);
            setLobbyStatus('Opponent data synced! Ready.');
            
            addLog("Opponent found! Battle starting...");
          }
          break;
        case 'ACTION':
          setPendingEnemyAction(msg.payload);
          if (gameMode === 'MULTI_HOST') checkTurnExecution(undefined, msg.payload);
          setLobbyStatus('Opponent has made a move!');
          break;
        case 'TURN_RESULT':
          if (gameMode === 'MULTI_GUEST') playTurnEvents(msg.payload);
          break;
        case 'RESTART':
          window.location.reload();
          break;
      }
    });

    peerService.onConnect(() => {
      setIsConnected(true);
      setLobbyStatus('Connected! Exchanging team data...');
      
      const myCurrentTeam = buildTeamFromConfig(savedTeamConfig, 'p1'); 
      setPlayerTeam(myCurrentTeam);
      
      // SEND HANDSHAKE
      peerService.send({ type: 'HANDSHAKE', payload: { team: myCurrentTeam } });
    });
  }, [gameMode, savedTeamConfig]);

  // Effect to start battle once handshake is complete
  useEffect(() => {
     if (gameMode !== 'SINGLE' && isConnected && hasReceivedEnemyTeam) {
        setTimeout(() => {
           setPhase('SELECT');
        }, 1000);
     }
  }, [gameMode, isConnected, hasReceivedEnemyTeam]);

  const hostGame = async () => {
    try {
      const id = await peerService.init();
      setRoomId(id);
      setGameMode('MULTI_HOST');
      setPhase('LOBBY');
      setLobbyStatus('Waiting for opponent to join...');
      setHasReceivedEnemyTeam(false);
    } catch (e) {
      alert('Error starting host: ' + e);
    }
  };

  const joinGame = async () => {
    if (!inputRoomId) return;
    try {
      await peerService.init();
      setLobbyStatus('Connecting to room...');
      setGameMode('MULTI_GUEST');
      setPhase('LOBBY');
      setHasReceivedEnemyTeam(false);
      await peerService.connect(inputRoomId);
    } catch (e) {
      alert('Error joining: ' + e);
      setPhase('LOBBY');
      setGameMode('SINGLE');
    }
  };

  const startSinglePlayer = () => {
    setGameMode('SINGLE');
    setPlayerTeam(buildTeamFromConfig(savedTeamConfig, 'p1'));
    setEnemyTeam(INITIAL_ENEMY_TEAM); 
    setPhase('SELECT');
    setLogs(['Battle Start!']);
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const executeTurn = (pAction: PlayerAction, eAction: PlayerAction) => {
    const events = resolveTurn(pAction, eAction, playerTeam[activePlayerIdx], enemyTeam[activeEnemyIdx], playerTeam, enemyTeam);
    playTurnEvents(events);
  };

  const handlePlayerAction = async (action: PlayerAction) => {
    if (phase !== 'SELECT') return;

    setPendingPlayerAction(action);
    setPhase('WAITING');

    if (gameMode === 'SINGLE') {
      await new Promise(r => setTimeout(r, 600));
      const playerShape = playerTeam[activePlayerIdx];
      const enemyShape = enemyTeam[activeEnemyIdx];
      const cpuDecision = getCPUMove(enemyShape, playerShape);
      addLog(`Enemy: "${cpuDecision.taunt}"`);
      const enemyAction: PlayerAction = { type: 'MOVE', index: cpuDecision.moveIndex };
      executeTurn(action, enemyAction);
    } else {
      peerService.send({ type: 'ACTION', payload: action });
      setLobbyStatus('Waiting for opponent...');
      if (gameMode === 'MULTI_HOST') checkTurnExecution(action, undefined);
    }
  };

  const checkTurnExecution = (pAction?: PlayerAction, eAction?: PlayerAction) => {
    const p = pAction || pendingPlayerAction;
    const e = eAction || pendingEnemyAction;

    if (p && e) {
      const events = resolveTurn(p, e, playerTeam[activePlayerIdx], enemyTeam[activeEnemyIdx], playerTeam, enemyTeam);
      peerService.send({ type: 'TURN_RESULT', payload: events });
      playTurnEvents(events);
      setPendingPlayerAction(null);
      setPendingEnemyAction(null);
    }
  };

  const playTurnEvents = async (events: TurnEvent[]) => {
    setPhase('ANIMATING');

    for (const event of events) {
      await new Promise(r => setTimeout(r, 600));

      switch (event.type) {
        case 'LOG':
          addLog(event.message || '');
          break;
        case 'ATTACK_ANIM':
          setAnimatingShape(event.attacker === 'player' ? 'player' : 'enemy');
          setAnimatingAction(event.attacker === 'player' ? 'animate-attack-right' : 'animate-attack-left');
          setTimeout(() => {
            setAnimatingShape(null);
            setAnimatingAction('');
          }, 300);
          break;
        case 'DAMAGE':
        case 'STATUS_DAMAGE':
          setAnimatingShape(event.target === 'player' ? 'player' : 'enemy');
          setAnimatingAction('animate-shake');
          setTimeout(() => {
             setAnimatingShape(null);
             setAnimatingAction('');
          }, 500);
          setPlayerTeam([...playerTeam]);
          setEnemyTeam([...enemyTeam]);
          break;
        case 'HEAL':
        case 'STATUS_APPLY':
          setPlayerTeam([...playerTeam]);
          setEnemyTeam([...enemyTeam]);
          break;
        case 'SWITCH_ANIM':
          if (event.target === 'player') setActivePlayerIdx(event.newActiveIndex || 0);
          else setActiveEnemyIdx(event.newActiveIndex || 0);
          break;
        case 'FAINT':
          setAnimatingShape(event.target === 'player' ? 'player' : 'enemy');
          setAnimatingAction('animate-faint');
          await new Promise(r => setTimeout(r, 1000));
          
          setPlayerTeam([...playerTeam]);
          setEnemyTeam([...enemyTeam]);
          setAnimatingShape(null);
          setAnimatingAction('');
          
          if (event.target === 'player') {
             if (playerTeam.some(s => s.stats.hp > 0)) {
               setPhase('SWITCH'); 
               return; 
             } else {
               setPhase('GAME_OVER');
               addLog('You ran out of shapes! Game Over.');
               return;
             }
          } else {
             if (enemyTeam.some(s => s.stats.hp > 0)) {
               const nextIdx = enemyTeam.findIndex(s => s.stats.hp > 0);
               if (nextIdx !== -1) {
                  setActiveEnemyIdx(nextIdx);
                  addLog(`Opponent sent out ${enemyTeam[nextIdx].name}!`);
               }
             } else {
               setPhase('GAME_OVER');
               addLog('Opponent ran out of shapes! You Win!');
               return;
             }
          }
          break;
      }
    }

    if (phase !== 'GAME_OVER' && phase !== 'SWITCH') {
       setPhase('SELECT');
    }
  };

  const handleForcedSwitch = (index: number) => {
    if (playerTeam[index].stats.hp <= 0) return;
    const action: PlayerAction = { type: 'SWITCH', index };
    setActivePlayerIdx(index);
    setPhase('SELECT');
    addLog(`Go! ${playerTeam[index].name}!`);
  };

  if (showTeambuilder) {
    return (
      <Teambuilder 
        initialTeam={savedTeamConfig || undefined}
        onBack={() => setShowTeambuilder(false)}
        onSave={handleTeamSave}
        user={user}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center font-sans">
      {showTypeChart && <TypeChartOverlay onClose={() => setShowTypeChart(false)} />}
      
      {phase === 'LOBBY' ? (
        <div className="flex flex-col items-center justify-center w-full min-h-screen p-4 text-white">
          <h1 className="text-4xl md:text-6xl mb-8 pixel-font text-yellow-400 text-center leading-relaxed">
            SHAPE SHOWDOWN
          </h1>
          
          {roomId ? (
            <div className="bg-gray-800 p-8 rounded-lg border-2 border-blue-500 text-center animate-pulse">
              <p className="mb-4 text-gray-400">Room Code:</p>
              <p className="text-5xl font-mono font-bold tracking-widest text-white mb-6 select-all cursor-pointer" onClick={() => navigator.clipboard.writeText(roomId)} title="Click to copy">{roomId}</p>
              <p className="text-sm text-blue-300">{lobbyStatus}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full max-w-md relative">
              <div className="absolute -top-16 right-0 w-full flex justify-end">
                  {user ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Hi, {user.displayName}</span>
                        <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-2 py-1 rounded">Logout</button>
                    </div>
                  ) : (
                    <button onClick={handleLogin} className="text-xs bg-white text-black px-3 py-1 rounded font-bold hover:bg-gray-200">Sign In (Google)</button>
                  )}
              </div>

              <button onClick={startSinglePlayer} className="py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-bold text-xl shadow-lg transform transition active:scale-95">
                SINGLE PLAYER
              </button>
              <div className="flex gap-2">
                <button onClick={hostGame} className="flex-1 py-4 bg-purple-700 hover:bg-purple-600 rounded-lg font-bold shadow-lg">CREATE ROOM</button>
              </div>
              <div className="flex gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
                <input value={inputRoomId} onChange={(e) => setInputRoomId(e.target.value.toUpperCase())} placeholder="ROOM CODE" className="flex-1 bg-transparent text-center font-mono text-xl outline-none uppercase placeholder-gray-600" maxLength={4} />
                <button onClick={joinGame} className="px-6 bg-green-600 hover:bg-green-500 rounded font-bold">JOIN</button>
              </div>
              <button onClick={() => setShowTeambuilder(true)} className="mt-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded hover:border-gray-500 transition">
                TEAMBUILDER {user ? '(CLOUD SYNC ON)' : ''}
              </button>
              <div className="text-center text-xs text-gray-500 mt-2">Press SPACE for Type Chart</div>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center p-2 md:p-4 w-full">
          <div className="w-full max-w-4xl flex justify-between items-center mb-4 bg-gray-800 p-2 rounded shadow">
            <div className="text-yellow-400 pixel-font text-xs md:text-sm">Room: {gameMode === 'SINGLE' ? 'CPU' : (roomId || inputRoomId)}</div>
            <div className="flex gap-4 items-center">
              <span className="text-gray-400 text-xs cursor-pointer hover:text-white" onClick={() => setShowTypeChart(true)}>[SPACE] Type Chart</span>
              <div className="text-gray-400 text-xs">Turn {phase}</div>
            </div>
          </div>
          
          <div className="relative w-full max-w-4xl h-[400px] md:h-[500px] bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-4 border-gray-700">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            
            {/* Enemy */}
            {activeEnemy && (
              <div className="absolute top-8 right-8 md:top-12 md:right-20 flex flex-col items-end z-10">
                <HealthBar current={activeEnemy.stats.hp} max={activeEnemy.stats.maxHp} label={activeEnemy.name} status={activeEnemy.statusCondition} />
                <div className="mt-4 transform scale-75 md:scale-100">
                  <ShapeVisual shape={activeEnemy} animation={animatingShape === 'enemy' ? animatingAction : undefined} />
                </div>
                <div className="flex mt-2 gap-1">
                  {enemyTeam.map((s, i) => (<div key={i} className={`w-3 h-3 rounded-full ${s.stats.hp > 0 ? 'bg-green-500' : 'bg-gray-600'}`} />))}
                </div>
              </div>
            )}

            {/* Player */}
            {activePlayerIdx !== null && playerTeam[activePlayerIdx] && (
              <div className="absolute bottom-8 left-8 md:bottom-12 md:left-20 flex flex-col items-start z-10">
                <div className="transform scale-75 md:scale-100 mb-4">
                  <ShapeVisual shape={playerTeam[activePlayerIdx]} isAlly animation={animatingShape === 'player' ? animatingAction : undefined} />
                </div>
                <HealthBar current={playerTeam[activePlayerIdx].stats.hp} max={playerTeam[activePlayerIdx].stats.maxHp} label={playerTeam[activePlayerIdx].name} isAlly status={playerTeam[activePlayerIdx].statusCondition} />
                <div className="flex mt-2 gap-1">
                  {playerTeam.map((s, i) => (<div key={i} className={`w-3 h-3 rounded-full ${s.stats.hp > 0 ? 'bg-green-500' : 'bg-gray-600'}`} />))}
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 h-64">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 relative overflow-hidden">
              {phase === 'WAITING' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                  <span className="text-white pixel-font animate-pulse">Waiting for opponent...</span>
                </div>
              )}
              {phase === 'SWITCH' && (
                <div className="grid grid-cols-2 gap-2 h-full">
                  {playerTeam.map((member, idx) => (
                    <button
                      key={member.id}
                      disabled={member.stats.hp <= 0 || idx === activePlayerIdx}
                      onClick={() => handleForcedSwitch(idx)}
                      className={`p-2 rounded text-left border ${member.stats.hp <= 0 ? 'opacity-50 bg-gray-900 border-gray-800' : idx === activePlayerIdx ? 'border-yellow-500 bg-yellow-900/20' : 'bg-gray-700 hover:bg-gray-600 border-gray-500'}`}
                    >
                      <div className="font-bold text-sm">{member.name}</div>
                      <div className="text-xs">HP: {member.stats.hp}/{member.stats.maxHp}</div>
                    </button>
                  ))}
                </div>
              )}
              {(phase === 'SELECT' || phase === 'GAME_OVER') && playerTeam[activePlayerIdx] && (
                <div className="grid grid-cols-2 gap-2 h-full">
                  {playerTeam[activePlayerIdx].moves.map((move, idx) => (
                    <button
                      key={idx}
                      disabled={phase === 'GAME_OVER'}
                      onClick={() => handlePlayerAction({ type: 'MOVE', index: idx })}
                      className="relative group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-blue-400 rounded-lg p-2 transition-all active:scale-95 flex flex-col justify-center"
                    >
                      <div className="font-bold text-white text-sm md:text-base flex justify-between">
                        <span>{move.name}</span>
                        <span className="text-[10px] bg-gray-900 px-1 rounded text-gray-400">{move.type.substring(0,3)}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex justify-between w-full">
                          <span>{move.category}</span>
                          <span>Pow: {move.power > 0 ? move.power : '-'}</span>
                      </div>
                      <div className="absolute bottom-full left-0 w-full bg-black text-white text-xs p-2 rounded hidden group-hover:block z-20 mb-2">
                        {move.description} {move.priority ? `(Prio ${move.priority})` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-black/90 rounded-lg p-4 border border-green-900 font-mono text-sm overflow-y-auto shadow-inner h-full">
              {logs.map((log, i) => (
                <div key={i} className="mb-1 text-green-400 border-b border-green-900/30 pb-1 last:border-0">
                  <span className="mr-2 opacity-50">{'>'}</span>{log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
          {phase === 'GAME_OVER' && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-gray-800 p-8 rounded border-4 border-yellow-500 text-center">
                  <h2 className="text-3xl text-white font-bold mb-4">{playerTeam.some(s => s.stats.hp > 0) ? 'VICTORY!' : 'DEFEAT'}</h2>
                  <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded">PLAY AGAIN</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
