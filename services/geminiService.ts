
import { GoogleGenAI, Type } from "@google/genai";
import { ShapeInstance, Move } from '../types.ts';
import { TYPE_CHART } from '../constants.ts';

export interface AIMoveDecision {
  moveIndex: number;
  taunt: string;
}

// Simple fallback heuristic if API key is missing or fails
const getHeuristicMove = (aiShape: ShapeInstance, playerShape: ShapeInstance): AIMoveDecision => {
  // Find move with best damage
  let bestMoveIndex = 0;
  let maxDamage = -1;

  aiShape.moves.forEach((move, index) => {
    let damage = move.power;
    if (move.category === 'STATUS') damage = 0;
    
    // Simple STAB (Same Type Attack Bonus)
    if (move.type === aiShape.type) damage *= 1.5;
    
    // Type Advantage
    const multiplier = TYPE_CHART[move.type][playerShape.type];
    damage *= multiplier;

    // Prioritize healing if low HP
    if (move.effect === 'HEAL' && aiShape.stats.hp < aiShape.stats.maxHp * 0.4) {
      damage = 999; 
    }

    if (damage > maxDamage) {
      maxDamage = damage;
      bestMoveIndex = index;
    }
  });

  const taunts = [
    "Calculated.",
    "Optimal strategy engaged.",
    "Your angles are weak.",
    "Geometry is on my side.",
    "Prepare to be deleted."
  ];

  return {
    moveIndex: bestMoveIndex,
    taunt: taunts[Math.floor(Math.random() * taunts.length)]
  };
};

export const getAIMove = async (
  aiShape: ShapeInstance,
  playerShape: ShapeInstance,
  weather: string
): Promise<AIMoveDecision> => {
  if (!process.env.API_KEY) {
    console.warn("No API_KEY found. Using heuristic AI.");
    return getHeuristicMove(aiShape, playerShape);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a competitive Shape Showdown battle AI.
    
    Current State:
    - Weather: ${weather}
    - YOU (${aiShape.name}): Type=${aiShape.type}, HP=${aiShape.stats.hp}/${aiShape.stats.maxHp}, Atk=${aiShape.stats.atk}, Spd=${aiShape.stats.spd}.
    - OPPONENT (${playerShape.name}): Type=${playerShape.type}, HP=${playerShape.stats.hp}/${playerShape.stats.maxHp}.
    
    Your Moves:
    ${aiShape.moves.map((m, i) => `${i}: ${m.name} (Type: ${m.type}, Power: ${m.power}, Cat: ${m.category})`).join('\n')}
    
    Task:
    Pick the index (0-3) of the best move to win. Consider type matchups (SHARP > ROUND > STABLE > SHARP).
    Also provide a short, 1-sentence witty battle taunt related to geometry or coding.
    
    Response JSON Schema:
    { "moveIndex": number, "taunt": string }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            moveIndex: { type: Type.INTEGER },
            taunt: { type: Type.STRING },
          },
          required: ["moveIndex", "taunt"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AIMoveDecision;

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return getHeuristicMove(aiShape, playerShape);
  }
};
