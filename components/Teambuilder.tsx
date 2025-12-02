
import React, { useState, useEffect } from 'react';
import { SPECIES, ITEMS, MOVES_POOL, TeamMemberConfig } from '../constants';
import { ShapeVisual } from './ShapeVisual';
import { createInstance } from '../constants';

interface TeambuilderProps {
  onBack: () => void;
  initialTeam?: TeamMemberConfig[];
  onSave: (team: TeamMemberConfig[]) => void;
}

// Default team if none saved
const DEFAULT_BUILDER_TEAM: TeamMemberConfig[] = [
  { species: 'TRIANGLE', moves: ['PIERCE', 'TRIANGLE_BEAM', 'FORTIFY', 'NULL_RAY'], item: 'NONE' },
  { species: 'SQUARE', moves: ['BOX_BASH', 'GRID_LOCK', 'FORTIFY', 'RECOVER'], item: 'NONE' },
  { species: 'CIRCLE', moves: ['BUBBLE_BLAST', 'RECOVER', 'ROLLOUT', 'NULL_RAY'], item: 'NONE' },
];

export const Teambuilder: React.FC<TeambuilderProps> = ({ onBack, onSave, initialTeam }) => {
  const [team, setTeam] = useState<TeamMemberConfig[]>(initialTeam || DEFAULT_BUILDER_TEAM);
  const [selectedSlot, setSelectedSlot] = useState(0);

  // Auto-save logic can be here, or explicit save button
  
  const currentMember = team[selectedSlot];
  const speciesData = SPECIES[currentMember.species];

  // Dummy instance for visualization
  const previewInstance = createInstance(currentMember.species);

  const updateMember = (updates: Partial<TeamMemberConfig>) => {
    const newTeam = [...team];
    newTeam[selectedSlot] = { ...newTeam[selectedSlot], ...updates };
    
    // If species changed, reset moves to valid defaults
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
        
        {/* Left Sidebar: Team Slots */}
        <div className="w-full md:w-1/4 flex flex-col gap-4">
          <h2 className="text-xl text-blue-400 pixel-font mb-2">My Team</h2>
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
            <button 
              onClick={handleSave}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all"
            >
              SAVE & EXIT
            </button>
            <button 
              onClick={onBack}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
            >
              CANCEL
            </button>
          </div>
        </div>

        {/* Right Area: Editor */}
        <div className="w-full md:w-3/4 bg-black/30 rounded border border-gray-700 p-6 flex flex-col gap-6">
            
            {/* Top Row: Visual + Main Stats */}
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
               {/* Visual */}
               <div className="flex flex-col items-center">
                 <ShapeVisual shape={previewInstance} isAlly />
                 <div className="mt-4 px-3 py-1 bg-gray-900 rounded border border-gray-600 text-xs text-gray-400">
                   Level 50
                 </div>
               </div>

               {/* Configuration Forms */}
               <div className="flex-grow w-full space-y-4">
                  
                  {/* Species Select */}
                  <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">Shape Chassis</label>
                    <select 
                      value={currentMember.species}
                      onChange={(e) => updateMember({ species: e.target.value as any })}
                      className="w-full p-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500 outline-none"
                    >
                      {Object.keys(SPECIES).map(key => (
                         <option key={key} value={key}>
                           {SPECIES[key as keyof typeof SPECIES].name} ({SPECIES[key as keyof typeof SPECIES].type})
                         </option>
                      ))}
                    </select>
                  </div>

                  {/* Item Select */}
                  <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">Held Module (Item)</label>
                    <select 
                      value={currentMember.item}
                      onChange={(e) => updateMember({ item: e.target.value })}
                      className="w-full p-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500 outline-none"
                    >
                      {Object.values(ITEMS).map(item => (
                         <option key={item.id} value={item.id}>
                           {item.name} - {item.description}
                         </option>
                      ))}
                    </select>
                  </div>

                  {/* Base Stats Preview */}
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

            {/* Moveset */}
            <div>
               <h3 className="text-blue-400 pixel-font text-sm mb-4">Moveset Configuration</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[0, 1, 2, 3].map(moveIdx => (
                    <div key={moveIdx}>
                       <label className="text-[10px] text-gray-500 uppercase ml-1">Move {moveIdx + 1}</label>
                       <select 
                         value={currentMember.moves[moveIdx]}
                         onChange={(e) => updateMove(moveIdx, e.target.value)}
                         className="w-full p-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500 outline-none text-sm"
                       >
                         {/* Available moves for this species */}
                         {speciesData.moveKeys.map(moveKey => {
                           const move = MOVES_POOL[moveKey];
                           return (
                             <option key={moveKey} value={moveKey}>
                               {move.name} ({move.type}/{move.category})
                             </option>
                           );
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
