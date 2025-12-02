
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShapeInstance, 
  BattleState, 
  TurnPhase, 
  ShapeType, 
  Move, 
  MoveCategory,
  GameMode,
  PlayerAction,
  TurnEvent,
  MultiplayerMessage
} from './types.ts';
import { 
  INITIAL_PLAYER_TEAM, 
  INITIAL_ENEMY_TEAM, 
  TYPE_CHART,
  createInstance,
  SPECIES,
  ITEMS,
  TeamMemberConfig
} from './constants.ts';
import { getAIMove } from './services/geminiService.ts';
import { peerService, generateRoomId } from './services/peerService.ts';
import { resolveTurn } from './utils/battleLogic.ts';
import { HealthBar } from './components/HealthBar.tsx';
import { ShapeVisual } from './components/ShapeVisual.tsx';
import { Teambuilder } from './components/Teambuilder.tsx';

export default function App() {
  // --- Game Mode State ---
  const [gameMode, setGameMode] = useState<GameMode>('SINGLE');
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [lobbyStatus, setLobbyStatus] = useState('');

  // --- Battle State ---
  const [playerTeam, setPlayerTeam] = useState<ShapeInstance[]>(INITIAL_PLAYER_TEAM);
  const [enemyTeam, setEnemyTeam] = useState<ShapeInstance[]>(INITIAL_ENEMY_TEAM);
  
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [activeEnemyIdx, setActiveEnemyIdx] = useState(0);
  
  const [phase, setPhase] = useState<TurnPhase>('LOBBY');
  const [logs, setLogs] = useState<string[]>(['Welcome to Shape Showdown!']);
  const [animatingShape, setAnimatingShape] = useState<'player' | 'enemy' | null>(null);
  const [animatingAction, setAnimatingAction] = useState<string>('');
  
  // Multiplayer Sync State
  const [pendingPlayerAction, setPendingPlayerAction] = useState<PlayerAction | null>(null);
  const [pendingEnemyAction, setPendingEnemyAction] = useState<PlayerAction | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // --- Teambuilder State ---
  const [savedTeamConfig, setSavedTeamConfig] = useState<TeamMemberConfig[] | null>(null);
  const [showTeambuilder, setShowTeambuilder] = useState(false);

  // Load team on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('shape_showdown_team');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Basic validation to ensure data integrity
        if (Array.isArray(parsed) && parsed.length === 3 && parsed[0].species && SPECIES[parsed[0].species as keyof typeof SPECIES]) {
          setSavedTeamConfig(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved team", e);
    }
  }, []);

  // Scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- Helper: Build Team from Config ---
  const buildTeamFromConfig = (config: TeamMemberConfig[] | null, idPrefix: string): ShapeInstance[] => {
    if (!config) {
      // Return defaults if no config
      return idPrefix === 'p1' ? INITIAL_PLAYER_TEAM : INITIAL_ENEMY_TEAM;
    }
    return config.map(member => 
      createInstance(member.species, 50, idPrefix, member.moves, member.item)
    );
  };

  // --- Multiplayer Logic ---
  useEffect(() => {
    peerService.onData((msg: MultiplayerMessage) => {
      console.log('Received:', msg);
      
      switch (msg.type) {
        case 'HANDSHAKE':
          // Opponent sent their team
          const theirTeam = msg.payload.team.map((s: any) => ({
             ...s,
             moves: s.moves.map((m: any) => ({ ...m })) // Deep copy moves
          }));
          setEnemyTeam(theirTeam);
          setLobbyStatus('Opponent connected! Starting battle...');
          
          // If we are guest, we also need to send our team now if we haven't (Host sends first usually)
          // But simpliest is: Both send HANDSHAKE upon connection.
          setTimeout(() => {
            setPhase('SELECT');
            addLog("Battle Started!");
          }, 1000);
          break;

        case 'ACTION':
          setPendingEnemyAction(msg.payload);
          if (gameMode === 'MULTI_HOST') {
            checkTurnExecution(undefined, msg.payload);
          }
          setLobbyStatus('Opponent has made a move!');
          break;

        case 'TURN_RESULT':
          // Guest receives full turn simulation
          if (gameMode === 'MULTI_GUEST') {
            playTurnEvents(msg.payload);
          }
          break;
          
        case 'RESTART':
          window.location.reload();
          break;
      }
    });

    peerService.onConnect(() => {
      setIsConnected(true);
      setLobbyStatus('Connected! Exchanging team data...');
      
      // Send our team data
      const myCurrentTeam = buildTeamFromConfig(savedTeamConfig, 'p1'); 
      // We need to use the actual state if we want to support editing before battle, 
      // but for now let's rebuild fresh from config or defaults
      setPlayerTeam(myCurrentTeam);

      peerService.send({
        type: 'HANDSHAKE',
        payload: { team: myCurrentTeam }
      });
    });
  }, [gameMode, savedTeamConfig]);

  const hostGame = async () => {
    try {
      const id = await peerService.init();
      setRoomId(id);
      setGameMode('MULTI_HOST');
      setPhase('LOBBY');
      setLobbyStatus('Waiting for opponent...');
    } catch (e) {
      alert('Error starting host: ' + e);
    }
  };

  const joinGame = async () => {
    if (!inputRoomId) return;
    try {
      await peerService.init();
      await peerService.connect(inputRoomId);
      setGameMode('MULTI_GUEST');
      setPhase('LOBBY');
      setLobbyStatus('Connecting...');
    } catch (e) {
      alert('Error joining: ' + e);
    }
  };

  const startSinglePlayer = () => {
    setGameMode('SINGLE');
    setPlayerTeam(buildTeamFromConfig(savedTeamConfig, 'p1'));
    // Generate random enemy team or standard
    setEnemyTeam(INITIAL_ENEMY_TEAM); 
    setPhase('SELECT');
    setLogs(['Battle Start!']);
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  // --- Battle Logic ---

  const executeTurn = (pAction: PlayerAction, eAction: PlayerAction) => {
    const events = resolveTurn(pAction, eAction, playerTeam[activePlayerIdx], enemyTeam[activeEnemyIdx], playerTeam, enemyTeam);
    playTurnEvents(events);
  };

  const handlePlayerAction = async (action: PlayerAction) => {
    if (phase !== 'SELECT') return;

    setPendingPlayerAction(action);
    setPhase('WAITING');

    if (gameMode === 'SINGLE') {
      // AI Logic
      const playerShape = playerTeam[activePlayerIdx];
      const enemyShape = enemyTeam[activeEnemyIdx];
      
      // Simple weather check (not fully implemented yet)
      const weather = 'CLEAR'; 
      
      const aiDecision = await getAIMove(enemyShape, playerShape, weather);
      addLog(`Enemy: "${aiDecision.taunt}"`);
      
      const enemyAction: PlayerAction = { type: 'MOVE', index: aiDecision.moveIndex };
      
      // Resolve immediately
      executeTurn(action, enemyAction);
    } else {
      // Multiplayer
      peerService.send({ type: 'ACTION', payload: action });
      setLobbyStatus('Waiting for opponent...');
      
      if (gameMode === 'MULTI_HOST') {
        checkTurnExecution(action, undefined);
      }
    }
  };

  const checkTurnExecution = (pAction?: PlayerAction, eAction?: PlayerAction) => {
    const p = pAction || pendingPlayerAction;
    const e = eAction || pendingEnemyAction;

    if (p && e) {
      // Both ready
      const events = resolveTurn(p, e, playerTeam[activePlayerIdx], enemyTeam[activeEnemyIdx], playerTeam, enemyTeam);
      
      // Send results to guest
      peerService.send({ type: 'TURN_RESULT', payload: events });
      
      // Play locally
      playTurnEvents(events);

      // Reset
      setPendingPlayerAction(null);
      setPendingEnemyAction(null);
    }
  };

  const playTurnEvents = async (events: TurnEvent[]) => {
    setPhase('ANIMATING');

    for (const event of events) {
      // Small delay between events
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
          setAnimatingShape(event.target === 'player' ? 'player' : 'enemy');
          setAnimatingAction('animate-shake');
          setTimeout(() => {
             setAnimatingShape(null);
             setAnimatingAction('');
          }, 500);
          // Update HP visually is handled by React state since we mutated the objects in resolveTurn
          // In a real Redux app we would dispatch updates. Here, we force update via state copy.
          setPlayerTeam([...playerTeam]);
          setEnemyTeam([...enemyTeam]);
          break;
        case 'HEAL':
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
          
          // Trigger force switch if needed
          if (event.target === 'player') {
             // Check if any left
             if (playerTeam.some(s => s.stats.hp > 0)) {
               setPhase('SWITCH'); 
               return; // Stop processing other events until switch
             } else {
               setPhase('GAME_OVER');
               addLog('You ran out of shapes! Game Over.');
               return;
             }
          } else {
             if (enemyTeam.some(s => s.stats.hp > 0)) {
               // In Single Player, AI switches automatically. 
               // In Multi, we wait? For simplicity, we auto-switch to first available for now or implement logic.
               // Let's simple auto-switch for now to keep flow
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

    // End of events
    if (phase !== 'GAME_OVER' && phase !== 'SWITCH') {
       setPhase('SELECT');
    }
  };

  const handleForcedSwitch = (index: number) => {
    if (playerTeam[index].stats.hp <= 0) return;
    
    // Send switch action if multiplayer
    const action: PlayerAction = { type: 'SWITCH', index };
    
    // Logic specific to forced switch phase (skip turn resolution, just do it)
    setActivePlayerIdx(index);
    setPhase('SELECT');
    addLog(`Go! ${playerTeam[index].name}!`);
    
    if (gameMode !== 'SINGLE') {
       // In a real robust engine, forced switches are handled carefully. 
       // For this jam version, we just local update.
    }
  };

  // --- Renders ---

  if (showTeambuilder) {
    return (
      <Teambuilder 
        initialTeam={savedTeamConfig || undefined}
        onBack={() => setShowTeambuilder(false)}
        onSave={(newTeam) => {
           setSavedTeamConfig(newTeam);
           localStorage.setItem('shape_showdown_team', JSON.stringify(newTeam));
        }}
      />
    );
  }

  // Lobby Render
  if (phase === 'LOBBY') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <h1 className="text-4xl md:text-6xl mb-8 pixel-font text-yellow-400 text-center leading-relaxed">
          SHAPE SHOWDOWN
        </h1>
        
        {roomId ? (
          <div className="bg-gray-800 p-8 rounded-lg border-2 border-blue-500 text-center animate-pulse">
            <p className="mb-4 text-gray-400">Room Code:</p>
            <p className="text-5xl font-mono font-bold tracking-widest text-white mb-6">{roomId}</p>
            <p className="text-sm text-blue-300">{lobbyStatus}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 w-full max-w-md">
             <button 
              onClick={startSinglePlayer}
              className="py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-bold text-xl shadow-lg transform transition active:scale-95"
            >
              SINGLE PLAYER
            </button>
            
            <div className="flex gap-2">
              <button 
                onClick={hostGame}
                className="flex-1 py-4 bg-purple-700 hover:bg-purple-600 rounded-lg font-bold shadow-lg"
              >
                CREATE ROOM
              </button>
            </div>

            <div className="flex gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
              <input 
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                className="flex-1 bg-transparent text-center font-mono text-xl outline-none uppercase placeholder-gray-600"
                maxLength={4}
              />
              <button 
                onClick={joinGame}
                className="px-6 bg-green-600 hover:bg-green-500 rounded font-bold"
              >
                JOIN
              </button>
            </div>

            <button 
              onClick={() => setShowTeambuilder(true)}
              className="mt-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded hover:border-gray-500 transition"
            >
              TEAMBUILDER
            </button>
          </div>
        )}
      </div>
    );
  }

  const activePlayer = playerTeam[activePlayerIdx];
  const activeEnemy = enemyTeam[activeEnemyIdx];

  // Battle Render
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-2 md:p-4">
      
      {/* Top Bar */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-4 bg-gray-800 p-2 rounded shadow">
         <div className="text-yellow-400 pixel-font text-xs md:text-sm">Room: {gameMode === 'SINGLE' ? 'CPU' : (roomId || inputRoomId)}</div>
         <div className="text-gray-400 text-xs">Turn {phase}</div>
      </div>

      {/* Battle Arena */}
      <div className="relative w-full max-w-4xl h-[400px] md:h-[500px] bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-4 border-gray-700">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10" 
             style={{ 
               backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', 
               backgroundSize: '40px 40px' 
             }} 
        />

        {/* Enemy Area (Top Right) */}
        <div className="absolute top-8 right-8 md:top-12 md:right-20 flex flex-col items-end z-10">
          <HealthBar current={activeEnemy.stats.hp} max={activeEnemy.stats.maxHp} label={activeEnemy.name} />
          <div className="mt-4 transform scale-75 md:scale-100">
             <ShapeVisual 
               shape={activeEnemy} 
               animation={animatingShape === 'enemy' ? animatingAction : undefined} 
             />
          </div>
          <div className="flex mt-2 gap-1">
             {enemyTeam.map((s, i) => (
               <div key={i} className={`w-3 h-3 rounded-full ${s.stats.hp > 0 ? 'bg-green-500' : 'bg-gray-600'}`} />
             ))}
          </div>
        </div>

        {/* Player Area (Bottom Left) */}
        <div className="absolute bottom-8 left-8 md:bottom-12 md:left-20 flex flex-col items-start z-10">
           <div className="transform scale-75 md:scale-100 mb-4">
             <ShapeVisual 
               shape={activePlayer} 
               isAlly 
               animation={animatingShape === 'player' ? animatingAction : undefined}
             />
           </div>
           <HealthBar current={activePlayer.stats.hp} max={activePlayer.stats.maxHp} label={activePlayer.name} isAlly />
           <div className="flex mt-2 gap-1">
             {playerTeam.map((s, i) => (
               <div key={i} className={`w-3 h-3 rounded-full ${s.stats.hp > 0 ? 'bg-green-500' : 'bg-gray-600'}`} />
             ))}
          </div>
        </div>
      </div>

      {/* Controls & Logs */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 h-64">
        
        {/* Action Panel */}
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
                  className={`p-2 rounded text-left border ${
                    member.stats.hp <= 0 ? 'opacity-50 bg-gray-900 border-gray-800' : 
                    idx === activePlayerIdx ? 'border-yellow-500 bg-yellow-900/20' :
                    'bg-gray-700 hover:bg-gray-600 border-gray-500'
                  }`}
                >
                  <div className="font-bold text-sm">{member.name}</div>
                  <div className="text-xs">HP: {member.stats.hp}/{member.stats.maxHp}</div>
                </button>
              ))}
            </div>
          )}

          {(phase === 'SELECT' || phase === 'GAME_OVER') && (
            <div className="grid grid-cols-2 gap-2 h-full">
               {activePlayer.moves.map((move, idx) => (
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
                   {/* Tooltip */}
                   <div className="absolute bottom-full left-0 w-full bg-black text-white text-xs p-2 rounded hidden group-hover:block z-20 mb-2">
                     {move.description} {move.priority ? `(Prio ${move.priority})` : ''}
                   </div>
                 </button>
               ))}
               
               {/* Switch Button (Overlay or separate tab, simplifying for UI) */}
               {/* For simplicity in this jam version, switch logic is usually a separate menu. 
                   We will add a small switch button in the corner or just assume current moves only for now 
                   unless we add a "Switch" tab. Let's keep it simple: Moves only unless fainted. 
                */}
            </div>
          )}
        </div>

        {/* Log Panel */}
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
              <h2 className="text-3xl text-white font-bold mb-4">{
                 playerTeam.some(s => s.stats.hp > 0) ? 'VICTORY!' : 'DEFEAT'
              }</h2>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded"
              >
                PLAY AGAIN
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
