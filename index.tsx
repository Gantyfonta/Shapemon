import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import Peer, { DataConnection } from 'peerjs';
import { SHAPES_REGISTRY, ShapeDefinition } from './shapes.ts';
import { 
  ShapeType, 
  MoveCategory, 
  StatusCondition, 
  Move, 
  ShapeInstance, 
  TurnPhase, 
  GameMode, 
  PlayerAction, 
  TurnEvent, 
  MultiplayerMessage 
} from './types.ts';

// ==========================================
// 2. CONSTANTS & DATA
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

export const MOVES_POOL: Record<string, Omit<Move, 'id' | 'maxPp'>> = {
  PIERCE: { name: 'Pierce', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 50, accuracy: 100, pp: 30, description: 'Quick jab.', priority: 1 },
  TRIANGLE_BEAM: { name: 'Tri-Beam', type: ShapeType.SHARP, category: MoveCategory.SPECIAL, power: 90, accuracy: 90, pp: 10, description: 'Triangular laser.' },
  RECOVER: { name: 'Recover', type: ShapeType.ROUND, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 5, description: 'Heals 50% HP.', effect: 'HEAL' },
  BOX_BASH: { name: 'Box Bash', type: ShapeType.STABLE, category: MoveCategory.PHYSICAL, power: 80, accuracy: 100, pp: 15, description: 'Heavy slam.' },
  GRID_LOCK: { name: 'Grid Lock', type: ShapeType.STABLE, category: MoveCategory.SPECIAL, power: 60, accuracy: 100, pp: 20, description: 'Causes Lag.', targetStatus: 'LAGGING', statusChance: 100 },
  FORTIFY: { name: 'Fortify', type: ShapeType.STABLE, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 20, description: 'Raises Defense.', effect: 'BUFF_DEF' },
  BUBBLE_BLAST: { name: 'Bubble Blast', type: ShapeType.ROUND, category: MoveCategory.SPECIAL, power: 65, accuracy: 100, pp: 20, description: 'May Lag.', targetStatus: 'LAGGING', statusChance: 30 },
  QUICK_STRIKE: { name: 'Quick Strike', type: ShapeType.FLUX, category: MoveCategory.PHYSICAL, power: 40, accuracy: 100, pp: 30, description: 'Priority attack.', priority: 2 },
  AERO_SLASH: { name: 'Aero Slash', type: ShapeType.SHARP, category: MoveCategory.SPECIAL, power: 75, accuracy: 95, pp: 15, description: 'Air pressure slash.' },
  WIND_TUNNEL: { name: 'Wind Tunnel', type: ShapeType.FLUX, category: MoveCategory.STATUS, power: 0, accuracy: 100, pp: 15, description: 'Speed up.', effect: 'BUFF_SPD' },
  SKY_DIVE: { name: 'Sky Dive', type: ShapeType.SHARP, category: MoveCategory.PHYSICAL, power: 100, accuracy: 85, pp: 5, description: 'High power crash.' },
  ROLLOUT: { name: 'Rollout', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 40, accuracy: 90, pp: 20, description: 'Rolling strike.' },
  BOUNCE: { name: 'Bounce', type: ShapeType.ROUND, category: MoveCategory.PHYSICAL, power: 85, accuracy: 85, pp: 10, description: 'High bounce.' },
};

// ==========================================
// 3. UTILS (Logic)
// ==========================================

export const createInstance = (speciesKey: keyof typeof SHAPES_REGISTRY, level: number = 50, prefix: string = 'p1'): ShapeInstance => {
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
    moves: def.moveKeys.map(k => ({ ...MOVES_POOL[k], id: k, maxPp: MOVES_POOL[k].pp, priority: MOVES_POOL[k].priority || 0 })),
    spriteColor: def.color,
    ability: def.defaultAbility,
    statusCondition: 'NONE',
    statusTurnCount: 0
  };
};

const getDamageResult = (attacker: ShapeInstance, defender: ShapeInstance, move: Move) => {
  if (move.category === MoveCategory.STATUS) return { damage: 0, typeMult: 0 };
  let atk = attacker.stats.atk;
  let def = move.category === MoveCategory.PHYSICAL ? defender.stats.def : defender.stats.spd;
  let typeMult = TYPE_CHART[move.type][defender.type];
  const baseDmg = (((2 * 50 / 5 + 2) * move.power * (atk / def)) / 50) + 2;
  const stab = attacker.type === move.type ? 1.5 : 1.0;
  const random = (Math.floor(Math.random() * 16) + 85) / 100;
  return { damage: Math.floor(baseDmg * stab * typeMult * random), typeMult };
};

export const resolveTurn = (pAct: PlayerAction, eAct: PlayerAction, pTeam: ShapeInstance[], eTeam: ShapeInstance[], pIdx: number, eIdx: number): TurnEvent[] => {
  const events: TurnEvent[] = [];
  const pS = pTeam[pIdx];
  const eS = eTeam[eIdx];

  const getSpd = (s: ShapeInstance) => s.stats.spd * (s.statusCondition === 'LAGGING' ? 0.5 : 1);
  const getPrio = (a: PlayerAction, s: ShapeInstance) => a.type === 'SWITCH' ? 10 : (s.moves[a.index].priority || 0);

  let first = 'player';
  if (getPrio(pAct, pS) < getPrio(eAct, eS)) first = 'enemy';
  else if (getPrio(pAct, pS) === getPrio(eAct, eS) && getSpd(eS) > getSpd(pS)) first = 'enemy';

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
        } else if (move.targetStatus && Math.random() * 100 < (move.statusChance || 100)) {
          def.statusCondition = move.targetStatus;
          events.push({ type: 'STATUS_APPLY', target: isP ? 'enemy' : 'player', effect: move.targetStatus });
        }
      } else {
        const { damage, typeMult } = getDamageResult(att, def, move);
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
// 4. COMPONENTS
// ==========================================

const HealthBar = ({ current, max, label, isAlly, status }: any) => {
  const perc = Math.max(0, (current / max) * 100);
  const color = perc < 20 ? 'bg-red-500' : perc < 50 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className={`w-56 bg-gray-800 border-2 border-gray-600 p-2 rounded shadow-lg ${isAlly ? 'ml-auto' : ''}`}>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-bold text-white uppercase">{label}</span>
        <span className="text-gray-400">{status !== 'NONE' && `[${status}]`} {current}/{max}</span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${perc}%` }} />
      </div>
    </div>
  );
};

const ShapeVisualLocal = ({ shape, view, animation }: { shape: ShapeInstance, view: 'front' | 'back', animation?: string }) => {
  const def = SHAPES_REGISTRY[Object.keys(SHAPES_REGISTRY).find(k => SHAPES_REGISTRY[k].speciesId === shape.speciesId) || 'TRIANGLE'];
  return (
    <div className={`relative w-40 h-40 flex items-center justify-center ${animation} transition-all duration-300`}>
      <svg viewBox="0 0 120 130" className={`w-full h-full drop-shadow-2xl ${shape.spriteColor}`}>
        <ellipse cx="60" cy="115" rx="40" ry="10" className="fill-black opacity-20" />
        {def.render(view)}
      </svg>
      {view === 'back' && <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" style={{ clipPath: 'polygon(0 100%, 100% 100%, 80% 0, 20% 0)' }} />}
    </div>
  );
};

// ==========================================
// 5. APP ENGINE
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

  const initMultiplayer = async (host: boolean) => {
    const id = host ? Math.random().toString(36).substr(2, 4).toUpperCase() : '';
    const p = new Peer(id);
    peerRef.current = p;
    p.on('open', (id) => { setRoomId(id); setGameMode(host ? 'MULTI_HOST' : 'MULTI_GUEST'); setPhase('LOBBY'); });
    p.on('connection', (c) => { connRef.current = c; setupConn(c); });
  };

  const connectToHost = () => {
    const p = new Peer();
    peerRef.current = p;
    p.on('open', () => {
      const c = p.connect(inputRoom);
      connRef.current = c;
      setupConn(c);
      setGameMode('MULTI_GUEST');
    });
  };

  const setupConn = (c: DataConnection) => {
    c.on('open', () => {
      const team = [createInstance('TRIANGLE', 50, 'p1'), createInstance('SQUARE', 50, 'p1'), createInstance('CIRCLE', 50, 'p1')];
      setPlayerTeam(team);
      c.send({ type: 'HANDSHAKE', payload: { team } });
    });
    c.on('data', (data: any) => handleMultiData(data as MultiplayerMessage));
  };

  const handleMultiData = (msg: MultiplayerMessage) => {
    if (msg.type === 'HANDSHAKE') {
      setEnemyTeam(msg.payload.team);
      setPhase('SELECT');
      addLog("Opponent joined!");
    } else if (msg.type === 'ACTION') {
      setEAction(msg.payload);
    } else if (msg.type === 'TURN_RESULT') {
      playEvents(msg.payload);
    }
  };

  const startSingle = () => {
    setPlayerTeam([createInstance('TRIANGLE'), createInstance('SQUARE'), createInstance('CIRCLE')]);
    setEnemyTeam([createInstance('KITE', 50, 'e1'), createInstance('CIRCLE', 50, 'e1'), createInstance('SQUARE', 50, 'e1')]);
    setPhase('SELECT');
    setGameMode('SINGLE');
  };

  const handleAction = (act: PlayerAction) => {
    if (phase !== 'SELECT') return;
    setPAction(act);
    setPhase('WAITING');
    if (gameMode === 'SINGLE') {
      const eAct: PlayerAction = { type: 'MOVE', index: Math.floor(Math.random() * 4) };
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
      await new Promise(r => setTimeout(r, 800));
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
        await new Promise(r => setTimeout(r, 1000));
        setPlayerTeam([...playerTeam]); setEnemyTeam([...enemyTeam]);
        if (e.target === 'player' && !playerTeam.some(s => s.stats.hp > 0)) { setPhase('GAME_OVER'); return; }
        if (e.target === 'enemy' && !enemyTeam.some(s => s.stats.hp > 0)) { setPhase('GAME_OVER'); return; }
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
        <h1 className="text-5xl mb-12 text-blue-400 font-bold tracking-tighter shadow-blue-500 shadow-2xl">SHAPE.NET</h1>
        <div className="flex flex-col gap-4 w-64">
          <button onClick={startSingle} className="p-4 bg-blue-600 hover:bg-blue-500 rounded border-b-4 border-blue-900 transition-all">LOCAL SIM</button>
          <button onClick={() => initMultiplayer(true)} className="p-4 bg-purple-600 hover:bg-purple-500 rounded border-b-4 border-purple-900">HOST ARENA</button>
          <div className="flex bg-slate-800 p-1 rounded border border-slate-700">
            <input value={inputRoom} onChange={e => setInputRoom(e.target.value.toUpperCase())} placeholder="ID" className="bg-transparent w-full px-2 outline-none uppercase" />
            <button onClick={connectToHost} className="bg-green-600 px-4 py-2 rounded">JOIN</button>
          </div>
        </div>
        {roomId && <div className="mt-8 p-4 border border-blue-500 bg-blue-500/10 rounded animate-pulse">ROOM CODE: <span className="font-bold text-2xl">{roomId}</span></div>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-2 font-mono">
      <div className="relative w-full max-w-4xl aspect-video bg-slate-900 border-4 border-slate-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        {enemyTeam[eIdx] && (
          <div className="absolute top-10 right-10 flex flex-col items-end">
            <HealthBar current={enemyTeam[eIdx].stats.hp} max={enemyTeam[eIdx].stats.maxHp} label={enemyTeam[eIdx].name} status={enemyTeam[eIdx].statusCondition} />
            <div className="mt-4 transform scale-110">
              <ShapeVisualLocal shape={enemyTeam[eIdx]} view="front" animation={animating.target === 'enemy' ? animating.type : ''} />
            </div>
          </div>
        )}

        {playerTeam[pIdx] && (
          <div className="absolute bottom-10 left-10 flex flex-col items-start">
            <div className="mb-4 transform scale-150 rotate-x-12">
              <ShapeVisualLocal shape={playerTeam[pIdx]} view="back" animation={animating.target === 'player' ? animating.type : ''} />
            </div>
            <HealthBar current={playerTeam[pIdx].stats.hp} max={playerTeam[pIdx].stats.maxHp} label={playerTeam[pIdx].name} isAlly status={playerTeam[pIdx].statusCondition} />
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl grid grid-cols-2 gap-2 mt-4">
        <div className="bg-slate-900 p-4 border border-slate-800 rounded h-40 overflow-hidden relative">
          {phase === 'SELECT' && playerTeam[pIdx].moves.map((m, i) => (
            <button key={i} onClick={() => handleAction({ type: 'MOVE', index: i })} className="w-1/2 p-2 hover:bg-slate-800 text-left border border-slate-800 group relative">
              <div className="text-xs text-blue-400">{m.type}</div>
              <div className="font-bold">{m.name}</div>
              <div className="hidden group-hover:block absolute bottom-full left-0 bg-black p-2 text-[10px] w-48 z-50 border border-blue-500">{m.description}</div>
            </button>
          ))}
          {phase === 'WAITING' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center animate-pulse">WAITING FOR DATA...</div>}
          {phase === 'SWITCH' && playerTeam.map((s, i) => (
             <button key={i} disabled={s.stats.hp <= 0} onClick={() => { setPIdx(i); setPhase('SELECT'); }} className={`w-1/2 p-2 border ${s.stats.hp <= 0 ? 'opacity-30' : 'hover:bg-slate-800'}`}>
               {s.name} ({s.stats.hp} HP)
             </button>
          ))}
        </div>
        <div className="bg-black p-4 border border-slate-800 rounded h-40 text-xs overflow-y-auto font-mono text-green-500">
          {logs.map((l, i) => <div key={i} className="mb-1 opacity-80">{">"} {l}</div>)}
        </div>
      </div>
      {phase === 'GAME_OVER' && <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50"><h1 className="text-6xl mb-8">BATTLE ENDED</h1><button onClick={() => window.location.reload()} className="p-4 bg-blue-600 rounded">REBOOT</button></div>}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);