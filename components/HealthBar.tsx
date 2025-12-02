import React from 'react';

interface HealthBarProps {
  current: number;
  max: number;
  label: string;
  isAlly?: boolean;
}

export const HealthBar: React.FC<HealthBarProps> = ({ current, max, label, isAlly }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  
  // Tailwind color classes based on HP percentage
  let barColor = 'bg-green-500';
  if (percentage < 50) barColor = 'bg-yellow-400';
  if (percentage < 20) barColor = 'bg-red-500';

  return (
    <div className={`w-64 bg-gray-800 border-2 border-gray-600 p-2 rounded-lg shadow-lg ${isAlly ? 'ml-auto' : ''}`}>
      <div className="flex justify-between items-end mb-1">
        <span className="font-bold text-white uppercase tracking-wider text-sm shadow-black drop-shadow-md">{label}</span>
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