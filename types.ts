export enum ShapeType {
  SHARP = 'SHARP',   // Beats Round, Weak to Stable
  ROUND = 'ROUND',   // Beats Stable, Weak to Sharp
  STABLE = 'STABLE', // Beats Sharp, Weak to Round
  VOID = 'VOID',     // Neutral
  FLUX = 'FLUX',     // Beats Round/Void, Weak to Glitch
  GLITCH = 'GLITCH', // Beats Stable/Flux, Weak to Sharp
  ASTRAL = 'ASTRAL',
  QUANTUM = 'QUANTUM'
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
  targetStatus?: StatusCondition;
  statusChance?: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  effectType: 'STAT_BOOST' | 'HEAL_TURN' | 'RESIST' | 'RECOIL_BOOST' | 'HEAL_LOW';
  stat?: 'atk' | 'def' | 'spd' | 'hp';
  value?: number; // Multiplier or flat amount
  consumed?: boolean; // If true, item is removed after use
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
  spriteColor: string;
  ability: string; 
  statusCondition: StatusCondition;
  statusTurnCount: number;
  heldItem?: Item;
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
  type: 'LOG' | 'DAMAGE' | 'HEAL' | 'FAINT' | 'ATTACK_ANIM' | 'SWITCH_ANIM' | 'STATUS_APPLY' | 'STATUS_DAMAGE' | 'WIN' | 'LOSE' | 'ITEM_USE';
  message?: string;
  target?: 'player' | 'enemy';
  attacker?: 'player' | 'enemy'; 
  amount?: number;
  effect?: string; 
  newActiveIndex?: number; 
}

export interface MultiplayerMessage {
  type: 'HANDSHAKE' | 'ACTION' | 'TURN_RESULT' | 'SYNC_STATE' | 'RESTART';
  payload: any;
}