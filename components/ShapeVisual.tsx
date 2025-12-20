
import React from 'react';
import { ShapeInstance } from '../types.ts';

interface ShapeVisualProps {
  shape: ShapeInstance;
  isAlly?: boolean;
  animation?: string;
}

export const ShapeVisual: React.FC<ShapeVisualProps> = ({ shape, isAlly, animation }) => {
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
      default:
        return <rect x="20" y="20" width="80" height="80" className="fill-current" />;
    }
  };

  const shadow = (
    <ellipse cx="60" cy="115" rx="40" ry="10" className="fill-black opacity-30" />
  );

  return (
    <div className={`relative w-48 h-48 flex flex-col items-center justify-center ${animation}`}>
      <svg 
        viewBox="0 0 120 130" 
        // Fix: Use stats.hp <= 0 to determine fainted status since status property does not exist on ShapeInstance
        className={`w-full h-full drop-shadow-2xl ${colorClass} ${shape.stats.hp <= 0 ? 'opacity-0 transition-opacity duration-1000' : ''}`}
      >
        {shadow}
        {getPath()}
      </svg>
      {/* Platform visual */}
      <div className={`absolute bottom-0 w-32 h-8 bg-gray-700/50 rounded-[100%] border border-gray-600 blur-sm transform translate-y-2 -z-10`} />
    </div>
  );
};
