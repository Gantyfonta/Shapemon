import React from 'react';
import { ShapeInstance } from '../types';

interface ShapeVisualProps {
  shape: ShapeInstance;
  isAlly?: boolean;
  animation?: string;
}

export const ShapeVisual: React.FC<ShapeVisualProps> = ({ shape, isAlly, animation }) => {
  const size = 120;
  
  // Dynamic color handling
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
      case 'star':
        return <polygon points="60,10 75,45 115,45 85,70 95,110 60,85 25,110 35,70 5,45 45,45" className="fill-current" stroke="white" strokeWidth="4" />;
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
        className={`w-full h-full drop-shadow-2xl ${colorClass} ${shape.status === 'FAINTED' ? 'opacity-0 transition-opacity duration-1000' : ''}`}
      >
        {shadow}
        {getPath()}
      </svg>
      {/* Platform visual */}
      <div className={`absolute bottom-0 w-32 h-8 bg-gray-700/50 rounded-[100%] border border-gray-600 blur-sm transform translate-y-2 -z-10`} />
    </div>
  );
};