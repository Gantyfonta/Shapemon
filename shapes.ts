import React from 'react';
import { ShapeType } from './types.ts';

/**
 * ShapeDefinition interface defines the structure of a shape species.
 */
export interface ShapeDefinition {
  speciesId: string;
  name: string;
  type: ShapeType;
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
  };
  color: string;
  moveKeys: string[];
  defaultAbility: string;
  // Using React.ReactNode instead of JSX.Element to avoid namespace issues in .ts files
  render: (view: 'front' | 'back') => React.ReactNode;
}

/**
 * Registry of available shapes in the game.
 * Uses React.createElement to avoid JSX syntax errors in a non-JSX TypeScript file.
 */
export const SHAPES_REGISTRY: Record<string, ShapeDefinition> = {
  TRIANGLE: {
    speciesId: 'triangle',
    name: 'Pyramidon',
    type: ShapeType.SHARP,
    baseStats: { hp: 100, atk: 120, def: 60, spd: 110 },
    color: 'text-red-400',
    moveKeys: ['PIERCE', 'TRIANGLE_BEAM', 'FORTIFY', 'SKY_DIVE'],
    defaultAbility: 'ROUGH_SKIN',
    render: (view: 'front' | 'back') => React.createElement('polygon', {
      points: view === 'front' ? "60,10 110,110 10,110" : "60,30 100,120 20,120",
      className: "fill-current",
      stroke: "white",
      strokeWidth: "4"
    })
  },
  SQUARE: {
    speciesId: 'square',
    name: 'Cubix',
    type: ShapeType.STABLE,
    baseStats: { hp: 120, atk: 100, def: 120, spd: 50 },
    color: 'text-green-400',
    moveKeys: ['BOX_BASH', 'GRID_LOCK', 'FORTIFY', 'RECOVER'],
    defaultAbility: 'STURDY',
    render: (view: 'front' | 'back') => React.createElement('rect', {
      x: view === 'front' ? "20" : "15",
      y: view === 'front' ? "20" : "30",
      width: view === 'front' ? "80" : "90",
      height: view === 'front' ? "80" : "70",
      className: "fill-current",
      stroke: "white",
      strokeWidth: "4"
    })
  },
  CIRCLE: {
    speciesId: 'circle',
    name: 'Orbulon',
    type: ShapeType.ROUND,
    baseStats: { hp: 140, atk: 70, def: 80, spd: 80 },
    color: 'text-blue-400',
    moveKeys: ['BUBBLE_BLAST', 'RECOVER', 'ROLLOUT', 'BOUNCE'],
    defaultAbility: 'REGENERATOR',
    render: (view: 'front' | 'back') => React.createElement('circle', {
      cx: "60",
      cy: view === 'front' ? "60" : "70",
      r: view === 'front' ? "50" : "55",
      className: "fill-current",
      stroke: "white",
      strokeWidth: "4"
    })
  },
  KITE: {
    speciesId: 'kite',
    name: 'Zephyr',
    type: ShapeType.SHARP,
    baseStats: { hp: 60, atk: 110, def: 50, spd: 150 },
    color: 'text-sky-300',
    moveKeys: ['AERO_SLASH', 'QUICK_STRIKE', 'SKY_DIVE', 'WIND_TUNNEL'],
    defaultAbility: 'AERODYNAMICS',
    render: (view: 'front' | 'back') => React.createElement('polygon', {
      points: view === 'front' ? "60,10 110,50 60,115 10,50" : "60,20 100,60 60,125 20,60",
      className: "fill-current",
      stroke: "white",
      strokeWidth: "4"
    })
  }
};