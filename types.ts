
export enum ShapeType {
  SHARP = 'SHARP',   // Beats Round
  ROUND = 'ROUND',   // Beats Stable
  STABLE = 'STABLE', // Beats Sharp
  VOID = 'VOID'      // Neutral
}

export enum MoveCategory {
  PHYSICAL = 'PHYSICAL',
  SPECIAL = 'SPECIAL',
  STATUS = 'STATUS'
}

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
  description: string;
  effect?: 'HEAL' | 'BUFF_ATK' | 'BUFF_DEF';
}

export interface Item {
  id: string;
  name: string;
  description: string;
  effectType: 'STAT_BOOST' | 'HEAL_TURN' | 'RESIST';
  stat?: 'atk' | 'def' | 'spd' | 'hp';
  value?: number; // Multiplier or flat amount
}

export interface ShapeStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface ShapeInstance {
  id: string; // Unique ID for the battle instance
  speciesId: string;
  name: string;
  type: ShapeType;
  stats: ShapeStats;
  moves: Move[];
  status: 'ALIVE' | 'FAINTED';
  spriteColor: string;
  heldItem?: Item;
}

export interface BattleState {
  turn: number;
  log: string[];
  weather: 'CLEAR' | 'STATIC_STORM' | 'DATA_RAIN';
}

export type TurnPhase = 'SELECT' | 'WAITING' | 'ANIMATING' | 'GAME_OVER' | 'SWITCH' | 'LOBBY' | 'TEAMBUILDER';

// --- Multiplayer Types ---

export type GameMode = 'SINGLE' | 'MULTI_HOST' | 'MULTI_GUEST';

export interface PlayerAction {
  type: 'MOVE' | 'SWITCH';
  index: number;
}

export interface TurnEvent {
  type: 'LOG' | 'DAMAGE' | 'HEAL' | 'FAINT' | 'ATTACK_ANIM' | 'SWITCH_ANIM' | 'WIN' | 'LOSE';
  message?: string;
  target?: 'player' | 'enemy';
  attacker?: 'player' | 'enemy'; // For attack animations
  amount?: number;
  effect?: string; // For sound effects or specific particles
  newActiveIndex?: number; // For switches
}

export interface MultiplayerMessage {
  type: 'HANDSHAKE' | 'ACTION' | 'TURN_RESULT' | 'RESTART';
  payload: any;
}
