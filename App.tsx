
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
} from './types';
import { 
  INITIAL_PLAYER_TEAM, 
  INITIAL_ENEMY_TEAM, 
  TYPE_CHART,
  createInstance,
  TeamMemberConfig
} from './constants';
import { getAIMove } from './services/geminiService';
import { peerService, generateRoomId } from './services/peerService';
import { resolveTurn } from './utils/battleLogic';
import { HealthBar } from './components/HealthBar';
import { ShapeVisual } from './components/ShapeVisual';
import { Teambuilder } from './components/Teambuilder';

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
  
  const [phase, setPhase] = useState<TurnPhase>('LOBBY'); // Start in Lobby
  const [logs, setLogs] = useState<string[]>(['Welcome to Shape Showdown!']);
  const [animatingShape, setAnimatingShape] = useState<'player' | 'enemy' | null>(null);
  const [animatingAction, setAnimatingAction] = useState<string>('');
  
  // Multiplayer Sync State
  const [pendingPlayerAction, setPendingPlayerAction] = useState<PlayerAction | null>(null);
  const [pendingEnemyAction, setPendingEnemyAction] = useState<PlayerAction | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // --- Teambuilder State ---
  const [savedTeamConfig, setSavedTeamConfig] = useState<TeamMemberConfig[] | null>(null);

  // Load team on mount
  useEffect(() => {
    const saved = localStorage.getItem('shape_showdown_team');
    if (saved) {
      try {
        setSavedTeamConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved team", e);
      }
    }
  }, []);

  const handleSaveTeam = (team: TeamMemberConfig[]) => {
    setSavedTeamConfig(team);
    localStorage.setItem('shape_showdown_team', JSON.stringify(team));
  };

  // Helper to build team instances from config
  const buildTeamInstances = (prefix: string): ShapeInstance[] => {
    if (savedTeamConfig) {
      return savedTeamConfig.map(config => 
        createInstance(config.species, 50, prefix, config.moves, config.item)
      );
    }
    // Fallback to default if no custom team
    return INITIAL_PLAYER_TEAM.map(s => ({...s, id: prefix + s.id.substring(2)})); 
  };
  
  // Derived state
  const activePlayer = playerTeam[activePlayerIdx];
  const activeEnemy = enemyTeam[activeEnemyIdx];

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- Logic Helpers ---

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  // --- Initialization & Lobby ---

  const startSinglePlayer = () => {
    setGameMode('SINGLE');
    setPlayerTeam(buildTeamInstances('p1'));
    // AI uses default enemy team for now
    setEnemyTeam(INITIAL_ENEMY_TEAM.map(s => ({...s, status: 'ALIVE', stats: {...s.stats, hp: s.stats.maxHp}})));
    setPhase('SELECT');
    setLogs(['Battle started vs AI!', 'What will you do?']);
  };

  const createRoom = async () => {
    setLobbyStatus('Creating room...');
    try {
      const id = await peerService.init();
      setRoomId(id);
      setGameMode('MULTI_HOST');
      setLobbyStatus('Waiting for opponent to join...');
      setupMultiplayerHandlers();
    } catch (e) {
      setLobbyStatus('Error creating room.');
    }
  };

  const joinRoom = async () => {
    if (!inputRoomId) return;
    setLobbyStatus(`Connecting to ${inputRoomId}...`);
    try {
      await peerService.init(); // Init with random ID
      await peerService.connect(inputRoomId);
      setGameMode('MULTI_GUEST');
      setRoomId(inputRoomId);
      setLobbyStatus('Connected! Sending handshake...');
      setupMultiplayerHandlers();
    } catch (e) {
      setLobbyStatus('Could not connect. Check ID.');
    }
  };

  const setupMultiplayerHandlers = () => {
    peerService.onConnect(() => {
      setIsConnected(true);
      // Handshake: Send my custom team
      const myTeam = buildTeamInstances('p1');
      setPlayerTeam(myTeam);
      
      peerService.send({
        type: 'HANDSHAKE',
        payload: { team: myTeam }
      });
    });

    peerService.onData((data: MultiplayerMessage) => {
      handleNetworkMessage(data);
    });
  };

  const handleNetworkMessage = (msg: MultiplayerMessage) => {
    switch (msg.type) {
      case 'HANDSHAKE':
        const oppTeam = msg.payload.team.map((s: ShapeInstance) => ({ ...s, id: s.id.replace('p1', 'p2') }));
        setEnemyTeam(oppTeam);
        setPhase('SELECT');
        setLogs(['Multiplayer Connection Established!', 'Battle Start!']);
        break;
      
      case 'ACTION':
        setPendingEnemyAction(msg.payload);
        break;

      case 'TURN_RESULT':
        playTurnSequence(msg.payload.events);
        break;
    }
  };

  // --- Battle Logic Overrides ---

  const handlePlayerAction = async (action: PlayerAction) => {
    if (phase !== 'SELECT') return;

    if (gameMode === 'SINGLE') {
      setPhase('ANIMATING');
      
      const aiDecision = await getAIMove(activeEnemy, activePlayer, 'CLEAR');
      const enemyAction: PlayerAction = { type: 'MOVE', index: aiDecision.moveIndex };
      addLog(`Opponent: "${aiDecision.taunt}"`);
      
      const events = resolveTurn(action, enemyAction, activePlayer, activeEnemy, playerTeam, enemyTeam);
      await playTurnSequence(events);
      
    } else {
      setPendingPlayerAction(action);
      setPhase('WAITING');
      addLog("Waiting for opponent...");
      
      peerService.send({
        type: 'ACTION',
        payload: action
      });
    }
  };

  // Multiplayer: Host Turn Resolution
  useEffect(() => {
    if (gameMode === 'MULTI_HOST' && pendingPlayerAction && pendingEnemyAction) {
      const events = resolveTurn(
        pendingPlayerAction, 
        pendingEnemyAction, 
        playerTeam[activePlayerIdx], 
        enemyTeam[activeEnemyIdx],
        playerTeam,
        enemyTeam
      );

      peerService.send({
        type: 'TURN_RESULT',
        payload: { events }
      });

      playTurnSequence(events);

      setPendingPlayerAction(null);
      setPendingEnemyAction(null);
    }
  }, [pendingPlayerAction, pendingEnemyAction, gameMode, activePlayerIdx, activeEnemyIdx, playerTeam, enemyTeam]);


  // --- Turn Playback (Visuals & State Updates) ---

  const playTurnSequence = async (events: TurnEvent[]) => {
    setPhase('ANIMATING');

    for (const event of events) {
      switch (event.type) {
        case 'LOG':
          addLog(event.message || '');
          await new Promise(r => setTimeout(r, 400));
          break;
        
        case 'ATTACK_ANIM':
          setAnimatingShape(event.attacker!);
          setAnimatingAction(event.attacker === 'player' ? 'animate-attack-right' : 'animate-attack-left');
          await new Promise(r => setTimeout(r, 400));
          setAnimatingShape(null);
          setAnimatingAction('');
          break;

        case 'DAMAGE':
          const targetIsPlayer = event.target === 'player';
          setAnimatingShape(targetIsPlayer ? 'player' : 'enemy');
          setAnimatingAction('animate-shake');
          
          if (targetIsPlayer) {
            setPlayerTeam(prev => applyDamage(prev, event.amount || 0, true));
          } else {
            setEnemyTeam(prev => applyDamage(prev, event.amount || 0, false));
          }
          await new Promise(r => setTimeout(r, 600));
          setAnimatingShape(null);
          setAnimatingAction('');
          break;

        case 'HEAL':
           if (event.attacker === 'player') {
             setPlayerTeam(prev => applyHeal(prev, event.amount || 0, true));
           } else {
             setEnemyTeam(prev => applyHeal(prev, event.amount || 0, false));
           }
           await new Promise(r => setTimeout(r, 500));
           break;

        case 'SWITCH_ANIM':
           if (event.target === 'player') {
             setActivePlayerIdx(event.newActiveIndex!);
           } else {
             setActiveEnemyIdx(event.newActiveIndex!);
           }
           await new Promise(r => setTimeout(r, 1000));
           break;
          
        case 'FAINT':
           await new Promise(r => setTimeout(r, 1000));
           break;
      }
    }

    setPhase('SELECT');
  };

  const applyDamage = (team: ShapeInstance[], dmg: number, isPlayer: boolean) => {
    return team.map((member, i) => {
       if (i === (isPlayer ? playerIdxRef.current : enemyIdxRef.current)) {
         const newHp = Math.max(0, member.stats.hp - dmg);
         return { ...member, stats: { ...member.stats, hp: newHp }, status: newHp === 0 ? 'FAINTED' : member.status };
       }
       return member;
    });
  };

  const applyHeal = (team: ShapeInstance[], amount: number, isPlayer: boolean) => {
    return team.map((member, i) => {
       if (i === (isPlayer ? playerIdxRef.current : enemyIdxRef.current)) {
         const newHp = Math.min(member.stats.maxHp, member.stats.hp + amount);
         return { ...member, stats: { ...member.stats, hp: newHp } };
       }
       return member;
    });
  };

  const playerIdxRef = useRef(0);
  const enemyIdxRef = useRef(0);

  useEffect(() => { playerIdxRef.current = activePlayerIdx; }, [activePlayerIdx]);
  useEffect(() => { enemyIdxRef.current = activeEnemyIdx; }, [activeEnemyIdx]);


  // --- Post-Turn Checks (Faints) ---
  
  useEffect(() => {
    if (phase === 'SELECT' || phase === 'WAITING') {
      const playerAlive = playerTeam.some(s => s.status === 'ALIVE');
      const enemyAlive = enemyTeam.some(s => s.status === 'ALIVE');

      if (!playerAlive) {
        setPhase('GAME_OVER');
        addLog("You have no shapes left! Defeat!");
      } else if (!enemyAlive) {
        setPhase('GAME_OVER');
        addLog("Opponent has no shapes left! Victory!");
      } else {
        if (activePlayer.stats.hp <= 0) {
           addLog(`${activePlayer.name} is down! Choose a replacement.`);
           setPhase('SWITCH');
        }
        if (activeEnemy.stats.hp <= 0) {
           addLog(`${activeEnemy.name} fainted!`);
           if (gameMode === 'SINGLE') {
             const nextIdx = enemyTeam.findIndex(s => s.status === 'ALIVE');
             if (nextIdx !== -1) {
               setTimeout(() => {
                 setActiveEnemyIdx(nextIdx);
                 addLog(`Opponent sent out ${enemyTeam[nextIdx].name}!`);
               }, 1500);
             }
           } else {
             addLog("Waiting for opponent to switch...");
             setPhase('WAITING'); 
           }
        }
      }
    }
  }, [playerTeam, enemyTeam, phase, activePlayer, activeEnemy, gameMode]);


  // --- Rendering ---
  
  if (phase === 'TEAMBUILDER') {
    return (
      <Teambuilder 
        onBack={() => setPhase('LOBBY')} 
        onSave={handleSaveTeam} 
        initialTeam={savedTeamConfig || undefined}
      />
    );
  }

  if (phase === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-mono">
        <div className="max-w-2xl w-full bg-gray-800 border-2 border-green-500 rounded-lg p-8 shadow-[0_0_20px_rgba(0,255,0,0.2)]">
          <h1 className="text-4xl text-green-500 text-center mb-8 pixel-font animate-pulse">SHAPE SHOWDOWN</h1>
          
          <div className="space-y-6">
            
            {/* Teambuilder Button */}
            <button 
              onClick={() => setPhase('TEAMBUILDER')}
              className="w-full bg-blue-900 hover:bg-blue-800 text-blue-200 py-3 px-4 rounded transition-colors text-center border border-blue-600 font-bold"
            >
               CONFIGURE TEAM {savedTeamConfig ? '(Custom Loaded)' : '(Default)'}
            </button>

            <div className="bg-black p-4 rounded border border-gray-700">
              <h2 className="text-xl text-white mb-2">Single Player</h2>
              <button 
                onClick={startSinglePlayer}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded transition-colors text-left flex justify-between items-center"
              >
                <span>VS AI Opponent</span>
                <span className="text-xs bg-blue-600 px-2 py-1 rounded">OFFLINE</span>
              </button>
            </div>

            <div className="bg-black p-4 rounded border border-gray-700">
              <h2 className="text-xl text-white mb-4">Multiplayer Room</h2>
              
              {!isConnected ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={createRoom}
                    className="bg-green-700 hover:bg-green-600 text-white py-4 rounded font-bold border-b-4 border-green-900 active:border-b-0 active:translate-y-1"
                  >
                    CREATE ROOM
                  </button>
                  
                  <div className="flex flex-col space-y-2">
                    <input 
                      type="text" 
                      placeholder="ENTER ROOM ID" 
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                      className="bg-gray-800 border border-gray-600 text-white p-2 rounded text-center tracking-widest uppercase"
                      maxLength={4}
                    />
                    <button 
                      onClick={joinRoom}
                      disabled={inputRoomId.length !== 4}
                      className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white py-2 rounded font-bold"
                    >
                      JOIN ROOM
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-green-400 py-4">
                   {lobbyStatus}
                </div>
              )}
              
              {roomId && !isConnected && (
                <div className="mt-4 text-center">
                  <p className="text-gray-400 text-sm">Room Created. Share this code:</p>
                  <div className="text-5xl text-white font-bold my-2 tracking-widest select-all cursor-pointer bg-gray-900 p-4 rounded border border-dashed border-gray-600">
                    {roomId}
                  </div>
                  <p className="text-yellow-500 text-xs animate-pulse">{lobbyStatus}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700 flex flex-col h-[800px] md:h-[600px]">
        
        {/* Battle Arena */}
        <div className="flex-grow relative bg-gray-900 overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
          {/* Background Decor */}
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-purple-900 to-blue-900 pointer-events-none"></div>
          
          {/* Room Code Badge */}
          {gameMode !== 'SINGLE' && (
            <div className="absolute top-2 left-2 z-20 bg-black/50 text-xs text-gray-400 px-2 py-1 rounded border border-gray-700">
              ROOM: <span className="text-white font-bold">{roomId}</span>
            </div>
          )}

          {/* Opponent Zone */}
          <div className="absolute top-8 right-8 flex flex-col items-end z-10">
            <HealthBar 
              current={activeEnemy.stats.hp} 
              max={activeEnemy.stats.maxHp} 
              label={activeEnemy.name} 
            />
            <div className="mt-8 mr-12 relative">
               <ShapeVisual 
                  shape={activeEnemy} 
                  animation={animatingShape === 'enemy' ? animatingAction : ''}
                />
            </div>
          </div>

          {/* Player Zone */}
          <div className="absolute bottom-8 left-8 flex flex-col items-start z-10">
            <div className="mb-8 ml-12 relative">
               <ShapeVisual 
                 shape={activePlayer} 
                 isAlly 
                 animation={animatingShape === 'player' ? animatingAction : ''}
               />
            </div>
            <HealthBar 
              current={activePlayer.stats.hp} 
              max={activePlayer.stats.maxHp} 
              label={activePlayer.name} 
              isAlly
            />
             {activePlayer.heldItem && (
               <div className="ml-2 text-[10px] text-gray-400 bg-black/50 px-2 rounded">
                 Held: {activePlayer.heldItem.name}
               </div>
             )}
          </div>
          
          {/* Game Over Overlay */}
          {phase === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="text-center">
                 <h1 className="text-5xl font-bold text-white pixel-font mb-4">GAME OVER</h1>
                 <button 
                   onClick={() => window.location.reload()}
                   className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded"
                 >
                   Back to Lobby
                 </button>
              </div>
            </div>
          )}
        </div>

        {/* UI Panel */}
        <div className="h-1/3 bg-gray-800 border-t-4 border-gray-700 flex flex-col md:flex-row">
          
          {/* Left: Logs */}
          <div className="w-full md:w-1/2 p-4 bg-gray-900 border-r border-gray-700 overflow-y-auto font-mono text-sm text-gray-300 h-32 md:h-auto">
            {logs.map((log, i) => (
              <div key={i} className="mb-1 border-l-2 border-blue-500 pl-2">{log}</div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Right: Controls */}
          <div className="w-full md:w-1/2 p-4 grid grid-cols-2 gap-2 relative">
            
            {/* Switching UI */}
            {phase === 'SWITCH' && (
              <div className="absolute inset-0 bg-gray-800 z-20 p-4 grid grid-cols-3 gap-2">
                 {playerTeam.map((member, idx) => (
                   <button
                     key={idx}
                     disabled={member.status === 'FAINTED' || idx === activePlayerIdx}
                     onClick={() => {
                        handlePlayerAction({ type: 'SWITCH', index: idx });
                     }}
                     className={`p-2 rounded border-2 flex flex-col items-center justify-center ${
                       member.status === 'FAINTED' 
                         ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed' 
                         : idx === activePlayerIdx 
                           ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                           : 'border-gray-500 hover:border-white hover:bg-gray-700 text-white'
                     }`}
                   >
                     <span className="font-bold text-xs">{member.name}</span>
                     <div className={`w-3 h-3 rounded-full mt-1 ${
                       member.status === 'FAINTED' ? 'bg-red-900' : 'bg-green-500'
                     }`}></div>
                   </button>
                 ))}
                 <button 
                   onClick={() => setPhase('SELECT')}
                   disabled={activePlayer.status === 'FAINTED'}
                   className="col-span-3 text-xs text-gray-400 hover:text-white mt-2"
                 >
                   Cancel
                 </button>
              </div>
            )}

            {/* Main Battle Controls */}
            {(phase === 'SELECT' || phase === 'WAITING' || phase === 'ANIMATING') ? (
              <>
                 <div className="col-span-2 flex justify-between items-center mb-1 px-1">
                    <span className="text-xs font-bold text-gray-500 uppercase">Moves</span>
                    <button 
                      onClick={() => setPhase('SWITCH')}
                      disabled={phase !== 'SELECT'}
                      className="text-xs bg-purple-900 hover:bg-purple-700 text-purple-200 px-2 py-1 rounded disabled:opacity-50"
                    >
                      Switch Shape
                    </button>
                 </div>
                 {activePlayer.moves.map((move, idx) => (
                   <button
                     key={move.id}
                     disabled={phase !== 'SELECT'}
                     onClick={() => handlePlayerAction({ type: 'MOVE', index: idx })}
                     className="relative group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-blue-400 rounded-lg p-2 text-left transition-all disabled:opacity-50 disabled:cursor-wait"
                   >
                     <div className="flex justify-between items-center">
                       <span className="font-bold text-white text-sm">{move.name}</span>
                       <span className={`text-[10px] px-1 rounded ${
                         move.type === ShapeType.SHARP ? 'bg-red-900 text-red-200' :
                         move.type === ShapeType.ROUND ? 'bg-blue-900 text-blue-200' :
                         move.type === ShapeType.STABLE ? 'bg-green-900 text-green-200' :
                         'bg-gray-900 text-gray-200'
                       }`}>
                         {move.type}
                       </span>
                     </div>
                     <div className="text-[10px] text-gray-400 mt-1">
                       Power: {move.power > 0 ? move.power : '-'} | PP: {move.pp}/{move.maxPp}
                     </div>
                     
                     <div className="absolute bottom-full left-0 mb-2 w-full bg-black text-white text-xs p-2 rounded hidden group-hover:block z-50">
                       {move.description}
                     </div>
                   </button>
                 ))}
              </>
            ) : null}
            
            {(phase === 'WAITING' || phase === 'ANIMATING') && (
               <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-30 pointer-events-none">
                 <span className="text-white font-bold animate-pulse">
                   {phase === 'WAITING' ? 'Waiting for opponent...' : 'Processing...'}
                 </span>
               </div>
            )}

          </div>
        </div>
      </div>
      
      <div className="fixed bottom-2 right-2 text-xs text-gray-500 opacity-50">
         Type Adv: SHARP &gt; ROUND &gt; STABLE &gt; SHARP
      </div>
    </div>
  );
}
