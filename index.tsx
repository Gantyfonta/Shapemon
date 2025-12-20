
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import Peer, { DataConnection } from 'peerjs';

// ==========================================
// 1. TYPES & ENUMS
// ==========================================

export enum ShapeType {
  SHARP = 'SHARP',   // Beats Round, Weak to Stable
  ROUND = 'ROUND',   // Beats Stable, Weak to Sharp
  STABLE = 'STABLE', // Beats Sharp, Weak to Round
  VOID = 'VOID',     // Neutral
  FLUX = 'FLUX',     // Beats Round/Void, Weak to Glitch
  GLITCH = 'GLITCH', // Beats Stable/Flux, Weak to Sharp
}

export enum MoveCategory {
  PHYSICAL = 'PHYSICAL',
  SPECIAL = 'SPECIAL',
  STATUS = 'STATUS'
}

export type StatusCondition = 'NONE' | 'FRAGMENTED' | 'LAGGING' | 'GLITCHED';

export interface Move {
  id: string;
  name: string;
  type: ShapeType;
  category: MoveCategory;
  power: number;
  accuracy: number;
  pp: number;
  priority?: number; 
  description: string;
  effect?: 'HEAL' | 'BUFF_ATK' | 'BUFF_DEF' | 'BUFF_SPD';
}

export interface ShapeInstance {
  id: string; 
  speciesId: string;
  name: string;
  type: ShapeType;
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    spd: number;
  };
  moves: Move[];
  spriteColor: string;
  ability: string; 
  statusCondition: StatusCondition;
}

export type TurnPhase = 'LOBBY' | 'SELECT' | 'WAITING' | 'ANIMATING' | 'SWITCH' | 'GAME_OVER';
export type GameMode = 'SINGLE' | 'MULTI_HOST' | 'MULTI_GUEST';

export interface PlayerAction {
  type: 'MOVE' | 'SWITCH';
  index: number;
}

export interface TurnEvent {
  type: 'LOG' | 'DAMAGE' | 'HEAL' | 'FAINT' | 'ATTACK_ANIM' | 'SWITCH_ANIM' | 'STATUS_APPLY';
  message?: string;
  target?: 'player' | 'enemy';
  attacker?: 'player' | 'enemy'; 
  amount?: number;
  newActiveIndex?: number; 
}

export interface MultiplayerMessage {
  type: 'HANDSHAKE' | 'ACTION' | 'TURN_RESULT';
  payload: any;
}

// ==========================================
// 2. SHAPE REGISTRY (The "Folder" equivalent)
// ==========================================
// Add new shapes here! Each shape has a front and back render function.

export interface ShapeDefinition {
  speciesId: string;
  name: string;
  type: ShapeType;
  baseStats: { hp: number; atk: number; def: number; spd: number; };
  color: string;
  moveKeys: string[];
  defaultAbility: string;
  // Fix: Use React.ReactNode instead of JSX.Element to avoid namespace issues in environments where JSX is not globally defined.
  render: (view: 'front' | 'back') => React.ReactNode;
}

export const SHAPES_REGISTRY: Record<string, ShapeDefinition> = {
  TRIANGLE: {
    speciesId: 'triangle',
    name: 'Pyramidon',
    type: ShapeType.SHARP,
    baseStats: { hp: 100, atk: 120, def: 60, spd: 110 },
    color: 'text-red-400',
    moveKeys: ['PIERCE', 'TRIANGLE_BEAM', 'FORTIFY'],
    defaultAbility: 'ROUGH_SKIN',
    render: (view) => (
      <polygon 
        points={view === 'front' ? "60,10 110,110 10,110" : "60,30 100,120 20,120"} 
        className="fill-current" stroke="white" strokeWidth="4" 
      />
    )
  },
  SQUARE: {
    speciesId: 'square',
    name: 'Cubix',
    type: ShapeType.STABLE,
    baseStats: { hp: 120, atk: 100, def: 120, spd: 50 },
    color: 'text-green-400',
    moveKeys: ['BOX_BASH', 'FORTIFY', 'RECOVER'],
    defaultAbility: 'STURDY',
    render: (view) => (
      <rect 
        x={view === 'front' ? "20" : "15"} 
        y={view === 'front' ? "20" : "30"} 
        width={view === 'front' ? "80" : "90"} 
        height={view === 'front' ? "80" : "70"} 
        className="fill-current" stroke="white" strokeWidth="4" 
      />
    )
  },
  CIRCLE: {
    speciesId: 'circle',
    name: 'Orbulon',
    type: ShapeType.ROUND,
    baseStats: { hp: 140, atk: 70, def: 80, spd: 80 },
    color: 'text-blue-400',
    moveKeys: ['BUBBLE_BLAST', 'RECOVER', 'ROLLOUT'],
    defaultAbility: 'REGENERATOR',
    render: (view) => (
      <circle 
        cx="60" cy={view === 'front' ? "60" : "70"} 
        r={view === 'front' ? "50" : "55"} 
        className="fill-current" stroke="white" strokeWidth="4" 
      />
    )
  }
};

// ==========================================
// 3. CONSTANTS & DATA
// ==========================================

export const TYPE_CHART: Record<ShapeType, Record<ShapeType, number>> = {
  [ShapeType.SHARP]:   { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 2, [ShapeType.STABLE]: 0.5, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 1, [ShapeType.GLITCH]: 2 },
  [ShapeType.ROUND]:   { [ShapeType.SHARP]: 0.5, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 0.5, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 1 },
  [ShapeType.STABLE]:  { [ShapeType.SHARP]: 2, [ShapeType.ROUND]: 0.5, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 1, [ShapeType.GLITCH]: 0.5 },
  [ShapeType.VOID]:    { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 1 },
  [ShapeType.FLUX]:    { [ShapeType.SHARP]: 1, [ShapeType.ROUND]: 2, [ShapeType.STABLE]: 1, [ShapeType.VOID]: 2, [ShapeType.FLUX]: 0.5, [ShapeType.GLITCH]: 0.5 },
  [ShapeType.GLITCH]:  { [ShapeType.SHARP]: 0.5, [ShapeType.ROUND]: 1, [ShapeType.STABLE]: 2, [ShapeType.VOID]: 1, [ShapeType.FLUX]: 2, [ShapeType.GLITCH]: 1 },
};

export const MOVES_POOL: Record<string, Omit<Move, 'id'>> = {
  PIERCE: { name: 'Pierce', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 50, accuracy: 100, pp: 30, description: 'Quick jab.', priority: 1 },
  TRIANGLE_BEAM: { name: 'Tri-Beam', type: ShapeType.SHARP, category: MoveCategory.SPECIAL, power: 90, accuracy: 90, pp: 10, description: 'Laser strike.' },
  RECOVER: { name: 'Recover', type: ShapeType.ROUND, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 5, description: 'Heals 50% HP.', effect: 'HEAL' },
  BOX_BASH: { name: 'Box Bash', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 80, accuracy: 100, pp: 15, description: 'Heavy slam.' },
  FORTIFY: { name: 'Fortify', type: ShapeType.STABLE, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 20, description: 'Raises Defense.', effect: 'BUFF_DEF' },
  BUBBLE_BLAST: { name: 'Bubble Blast', type: ShapeType.ROUND, category: MoveCategory.SPECIAL, power: 65, accuracy: 100, pp: 20, description: 'Water blast.' },
  ROLLOUT: { name: 'Rollout', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 40, accuracy: 90, pp: 20, description: 'Rolling strike.' },
};

// ==========================================
// 4. ENGINE UTILS
// ==========================================

export const createInstance = (speciesKey: keyof typeof SHAPES_REGISTRY, level: number = 50, prefix: string = 'p'): ShapeInstance => {
  const def = SHAPES_REGISTRY[speciesKey];
  const calcStat = (base: number) => Math.floor((base * 2 * level) / 100) + 5;
  const calcHp = (base: number) => Math.floor((base * 2 * level) / 100) + level + 10;
  
  return {
    id: `${prefix}-${Math.random().toString(36).substr(2, 5)}`,
    speciesId: def.speciesId,
    name: def.name,
    type: def.type,
    stats: {
      hp: calcHp(def.baseStats.hp),
      maxHp: calcHp(def.baseStats.hp),
      atk: calcStat(def.baseStats.atk),
      def: calcStat(def.baseStats.def),
      spd: calcStat(def.baseStats.spd),
    },
    moves: def.moveKeys.map(k => ({ ...MOVES_POOL[k], id: k })),
    spriteColor: def.color,
    ability: def.defaultAbility,
    statusCondition: 'NONE',
  };
};

const getDamage = (attacker: ShapeInstance, defender: ShapeInstance, move: Move) => {
  if (move.category === MoveCategory.STATUS) return { damage: 0, typeMult: 0 };
  const atk = attacker.stats.atk;
  const def = move.category === MoveCategory.PHYSICAL ? defender.stats.def : defender.stats.spd;
  const typeMult = TYPE_CHART[move.type][defender.type];
  const baseDmg = (((2 * 50 / 5 + 2) * move.power * (atk / def)) / 50) + 2;
  const stab = attacker.type === move.type ? 1.5 : 1.0;
  const random = (Math.floor(Math.random() * 16) + 85) / 100;
  return { damage: Math.floor(baseDmg * stab * typeMult * random), typeMult };
};

export const resolveTurn = (pAct: PlayerAction, eAct: PlayerAction, pTeam: ShapeInstance[], eTeam: ShapeInstance[], pIdx: number, eIdx: number): TurnEvent[] => {
  const events: TurnEvent[] = [];
  const pS = pTeam[pIdx];
  const eS = eTeam[eIdx];

  const getPrio = (a: PlayerAction, s: ShapeInstance) => a.type === 'SWITCH' ? 10 : (s.moves[a.index].priority || 0);

  let first = 'player';
  if (getPrio(pAct, pS) < getPrio(eAct, eS)) first = 'enemy';
  else if (getPrio(pAct, pS) === getPrio(eAct, eS) && eS.stats.spd > pS.stats.spd) first = 'enemy';

  const processAction = (isP: boolean) => {
    const act = isP ? pAct : eAct;
    const att = isP ? pTeam[pIdx] : eTeam[eIdx];
    const def = isP ? eTeam[eIdx] : pTeam[pIdx];

    if (att.stats.hp <= 0) return;

    if (act.type === 'SWITCH') {
      events.push({ type: 'LOG', message: `${isP ? 'Player' : 'Opponent'} switched to ${isP ? pTeam[act.index].name : eTeam[act.index].name}!` });
      events.push({ type: 'SWITCH_ANIM', target: isP ? 'player' : 'enemy', newActiveIndex: act.index });
    } else {
      const move = att.moves[act.index];
      events.push({ type: 'LOG', message: `${att.name} used ${move.name}!` });
      events.push({ type: 'ATTACK_ANIM', attacker: isP ? 'player' : 'enemy' });

      if (move.category === MoveCategory.STATUS) {
        if (move.effect === 'HEAL') {
          const val = Math.floor(att.stats.maxHp * 0.5);
          att.stats.hp = Math.min(att.stats.maxHp, att.stats.hp + val);
          events.push({ type: 'HEAL', attacker: isP ? 'player' : 'enemy', amount: val });
        }
      } else {
        const { damage, typeMult } = getDamage(att, def, move);
        def.stats.hp = Math.max(0, def.stats.hp - damage);
        events.push({ type: 'DAMAGE', target: isP ? 'enemy' : 'player', amount: damage });
        if (typeMult > 1) events.push({ type: 'LOG', message: "It's super effective!" });
        if (def.stats.hp <= 0) {
          events.push({ type: 'FAINT', target: isP ? 'enemy' : 'player' });
          events.push({ type: 'LOG', message: `${def.name} fainted!` });
        }
      }
    }
  };

  if (first === 'player') { processAction(true); processAction(false); }
  else { processAction(false); processAction(true); }

  return events;
};

// ==========================================
// 5. COMPONENTS
// ==========================================

const HealthBar = ({ current, max, label, isAlly }: any) => {
  const perc = Math.max(0, (current / max) * 100);
  const color = perc < 20 ? 'bg-red-500' : perc < 50 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className={`w-56 bg-gray-800 border-2 border-gray-600 p-2 rounded shadow-lg ${isAlly ? 'ml-auto' : ''}`}>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-bold text-white uppercase">{label}</span>
        <span className="text-gray-400">{current}/{max}</span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${perc}%` }} />
      </div>
    </div>
  );
};

const ShapeVisual = ({ shape, view, animation }: { shape: ShapeInstance, view: 'front' | 'back', animation?: string }) => {
  const def = SHAPES_REGISTRY[Object.keys(SHAPES_REGISTRY).find(k => SHAPES_REGISTRY[k].speciesId === shape.speciesId) || 'TRIANGLE'];
  return (
    <div className={`relative w-40 h-40 flex items-center justify-center ${animation} transition-all duration-300`}>
      <svg viewBox="0 0 120 130" className={`w-full h-full drop-shadow-2xl ${shape.spriteColor}`}>
        <ellipse cx="60" cy="115" rx="40" ry="10" className="fill-black opacity-20" />
        {def.render(view)}
      </svg>
    </div>
  );
};

// ==========================================
// 6. MAIN APP
// ==========================================

export default function App() {
  const [phase, setPhase] = useState<TurnPhase>('LOBBY');
  const [gameMode, setGameMode] = useState<GameMode>('SINGLE');
  const [roomId, setRoomId] = useState('');
  const [inputRoom, setInputRoom] = useState('');
  const [playerTeam, setPlayerTeam] = useState<ShapeInstance[]>([]);
  const [enemyTeam, setEnemyTeam] = useState<ShapeInstance[]>([]);
  const [pIdx, setPIdx] = useState(0);
  const [eIdx, setEIdx] = useState(0);
  const [logs, setLogs] = useState<string[]>(['Welcome!']);
  const [animating, setAnimating] = useState({ target: '', type: '' });
  const [pAction, setPAction] = useState<PlayerAction | null>(null);
  const [eAction, setEAction] = useState<PlayerAction | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const addLog = (m: string) => setLogs(prev => [...prev.slice(-10), m]);

  const initMultiplayer = (host: boolean) => {
    const id = host ? Math.random().toString(36).substr(2, 4).toUpperCase() : undefined;
    const p = new Peer(id);
    peerRef.current = p;
    p.on('open', (id) => { setRoomId(id); setGameMode(host ? 'MULTI_HOST' : 'MULTI_GUEST'); });
    p.on('connection', (c) => { 
      connRef.current = c; 
      c.on('open', () => {
        const team = [createInstance('TRIANGLE', 50, 'p'), createInstance('SQUARE', 50, 'p'), createInstance('CIRCLE', 50, 'p')];
        setPlayerTeam(team);
        c.send({ type: 'HANDSHAKE', payload: { team } });
      });
      c.on('data', (data: any) => handleMultiData(data as MultiplayerMessage));
    });
  };

  const connectToHost = () => {
    const p = new Peer();
    peerRef.current = p;
    p.on('open', () => {
      const c = p.connect(inputRoom.toUpperCase());
      connRef.current = c;
      c.on('open', () => {
        const team = [createInstance('CIRCLE', 50, 'p'), createInstance('TRIANGLE', 50, 'p'), createInstance('SQUARE', 50, 'p')];
        setPlayerTeam(team);
        c.send({ type: 'HANDSHAKE', payload: { team } });
      });
      c.on('data', (data: any) => handleMultiData(data as MultiplayerMessage));
    });
  };

  const handleMultiData = (msg: MultiplayerMessage) => {
    if (msg.type === 'HANDSHAKE') {
      setEnemyTeam(msg.payload.team);
      setPhase('SELECT');
      addLog("Battle Started!");
    } else if (msg.type === 'ACTION') {
      setEAction(msg.payload);
    } else if (msg.type === 'TURN_RESULT') {
      playEvents(msg.payload);
    }
  };

  const startSingle = () => {
    setPlayerTeam([createInstance('TRIANGLE'), createInstance('SQUARE'), createInstance('CIRCLE')]);
    setEnemyTeam([createInstance('TRIANGLE', 50, 'e'), createInstance('SQUARE', 50, 'e'), createInstance('CIRCLE', 50, 'e')]);
    setPhase('SELECT');
    setGameMode('SINGLE');
  };

  const handleAction = (act: PlayerAction) => {
    if (phase !== 'SELECT') return;
    setPAction(act);
    setPhase('WAITING');
    if (gameMode === 'SINGLE') {
      const eAct: PlayerAction = { type: 'MOVE', index: Math.floor(Math.random() * 3) };
      const evs = resolveTurn(act, eAct, [...playerTeam], [...enemyTeam], pIdx, eIdx);
      playEvents(evs);
    } else {
      connRef.current?.send({ type: 'ACTION', payload: act });
    }
  };

  useEffect(() => {
    if (gameMode === 'MULTI_HOST' && pAction && eAction) {
      const evs = resolveTurn(pAction, eAction, [...playerTeam], [...enemyTeam], pIdx, eIdx);
      connRef.current?.send({ type: 'TURN_RESULT', payload: evs });
      playEvents(evs);
      setPAction(null); setEAction(null);
    }
  }, [pAction, eAction, gameMode]);

  const playEvents = async (evs: TurnEvent[]) => {
    setPhase('ANIMATING');
    for (const e of evs) {
      await new Promise(r => setTimeout(r, 600));
      if (e.type === 'LOG') addLog(e.message!);
      else if (e.type === 'ATTACK_ANIM') {
        setAnimating({ target: e.attacker!, type: e.attacker === 'player' ? 'animate-attack-right' : 'animate-attack-left' });
        setTimeout(() => setAnimating({ target: '', type: '' }), 400);
      } else if (e.type === 'DAMAGE') {
        setAnimating({ target: e.target!, type: 'animate-shake' });
        setTimeout(() => setAnimating({ target: '', type: '' }), 400);
        setPlayerTeam([...playerTeam]); setEnemyTeam([...enemyTeam]);
      } else if (e.type === 'SWITCH_ANIM') {
        if (e.target === 'player') setPIdx(e.newActiveIndex!); else setEIdx(e.newActiveIndex!);
      } else if (e.type === 'FAINT') {
        setAnimating({ target: e.target!, type: 'animate-faint' });
        await new Promise(r => setTimeout(r, 800));
        setPlayerTeam([...playerTeam]); setEnemyTeam([...enemyTeam]);
        if (!playerTeam.some(s => s.stats.hp > 0)) { setPhase('GAME_OVER'); return; }
        if (!enemyTeam.some(s => s.stats.hp > 0)) { setPhase('GAME_OVER'); return; }
        if (e.target === 'player') { setPhase('SWITCH'); return; }
        if (e.target === 'enemy') { setEIdx(enemyTeam.findIndex(s => s.stats.hp > 0)); }
      }
    }
    setPhase('SELECT');
    setPAction(null); setEAction(null);
  };

  if (phase === 'LOBBY') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-mono">
        <h1 className="text-6xl mb-12 text-blue-400 font-bold tracking-tighter shadow-blue-500 shadow-2xl">SHAPE.NET</h1>
        <div className="flex flex-col gap-4 w-64">
          <button onClick={startSingle} className="p-4 bg-blue-600 hover:bg-blue-500 rounded font-bold transition-all">SINGLE PLAYER</button>
          <button onClick={() => initMultiplayer(true)} className="p-4 bg-purple-600 hover:bg-purple-500 rounded font-bold">HOST ARENA</button>
          <div className="flex bg-slate-800 p-1 rounded border border-slate-700">
            <input value={inputRoom} onChange={e => setInputRoom(e.target.value)} placeholder="ROOM ID" className="bg-transparent w-full px-2 outline-none uppercase" />
            <button onClick={connectToHost} className="bg-green-600 px-4 py-2 rounded font-bold">JOIN</button>
          </div>
        </div>
        {roomId && <div className="mt-8 p-4 border border-blue-500 bg-blue-500/10 rounded animate-pulse">ROOM CODE: <span className="font-bold text-2xl">{roomId}</span></div>}
      </div>
    );
  }

  const activePlayer = playerTeam[pIdx];
  const activeEnemy = enemyTeam[eIdx];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-2 font-mono">
      <div className="relative w-full max-w-4xl aspect-video bg-slate-900 border-4 border-slate-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        {activeEnemy && (
          <div className="absolute top-10 right-10 flex flex-col items-end">
            <HealthBar current={activeEnemy.stats.hp} max={activeEnemy.stats.maxHp} label={activeEnemy.name} />
            <div className="mt-4 transform scale-110">
              <ShapeVisual shape={activeEnemy} view="front" animation={animating.target === 'enemy' ? animating.type : ''} />
            </div>
          </div>
        )}

        {activePlayer && (
          <div className="absolute bottom-10 left-10 flex flex-col items-start">
            <div className="mb-4 transform scale-150 rotate-x-12">
              <ShapeVisual shape={activePlayer} view="back" animation={animating.target === 'player' ? animating.type : ''} />
            </div>
            <HealthBar current={activePlayer.stats.hp} max={activePlayer.stats.maxHp} label={activePlayer.name} isAlly />
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl grid grid-cols-2 gap-2 mt-4">
        <div className="bg-slate-900 p-4 border border-slate-800 rounded h-40 overflow-hidden relative">
          {phase === 'SELECT' && activePlayer && activePlayer.moves.map((m, i) => (
            <button key={i} onClick={() => handleAction({ type: 'MOVE', index: i })} className="w-1/2 p-2 hover:bg-slate-800 text-left border border-slate-800 group relative">
              <div className="text-[10px] text-blue-400">{m.type}</div>
              <div className="font-bold">{m.name}</div>
              <div className="hidden group-hover:block absolute bottom-full left-0 bg-black p-2 text-[10px] w-48 z-50 border border-blue-500">{m.description}</div>
            </button>
          ))}
          {phase === 'WAITING' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center animate-pulse">WAITING...</div>}
          {phase === 'SWITCH' && playerTeam.map((s, i) => (
             <button key={i} disabled={s.stats.hp <= 0} onClick={() => { setPIdx(i); setPhase('SELECT'); }} className={`w-1/2 p-2 border ${s.stats.hp <= 0 ? 'opacity-30' : 'hover:bg-slate-800'}`}>
               {s.name} ({s.stats.hp} HP)
             </button>
          ))}
        </div>
        <div className="bg-black p-4 border border-slate-800 rounded h-40 text-xs overflow-y-auto text-green-500">
          {logs.map((l, i) => <div key={i} className="mb-1 opacity-80">{">"} {l}</div>)}
        </div>
      </div>
      {phase === 'GAME_OVER' && <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50"><h1 className="text-6xl mb-8">BATTLE ENDED</h1><button onClick={() => window.location.reload()} className="p-4 bg-blue-600 rounded">REBOOT</button></div>}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
