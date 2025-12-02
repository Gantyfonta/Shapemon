
import { ShapeInstance, Move, TurnEvent, PlayerAction, ShapeType } from '../types';
import { TYPE_CHART } from '../constants';

// Helper: Calculate Damage
const getDamageResult = (attacker: ShapeInstance, defender: ShapeInstance, move: Move) => {
  if (move.category === 'STATUS') return { damage: 0, typeMult: 0 };

  // Simplified Atk/Def logic
  let atkStat = attacker.stats.atk;
  const defStat = move.category === 'PHYSICAL' ? defender.stats.def : defender.stats.spd;
  
  // --- Item Effects (Attacker) ---
  if (attacker.heldItem) {
    if (attacker.heldItem.id === 'ATTACK_PRISM' && move.category === 'PHYSICAL') {
      atkStat *= 1.2;
    }
    if (attacker.heldItem.id === 'MIND_GEM' && move.category === 'SPECIAL') {
      atkStat *= 1.2;
    }
  }

  const typeMult = TYPE_CHART[move.type][defender.type];
  
  // Base Damage
  const baseDmg = (((2 * 50 / 5 + 2) * move.power * (atkStat / defStat)) / 50) + 2;
  
  // STAB
  const stab = attacker.type === move.type ? 1.5 : 1.0;
  
  // Random (85-100%)
  const random = (Math.floor(Math.random() * 16) + 85) / 100;
  
  let damage = Math.floor(baseDmg * stab * typeMult * random);
  
  return { damage, typeMult };
};

// Main Resolver: Takes two actions and current state, returns a sequence of events
export const resolveTurn = (
  playerAction: PlayerAction,
  enemyAction: PlayerAction,
  playerShape: ShapeInstance,
  enemyShape: ShapeInstance,
  playerTeam: ShapeInstance[],
  enemyTeam: ShapeInstance[]
): TurnEvent[] => {
  const events: TurnEvent[] = [];
  
  // 1. Handle Switches First
  let activePlayerShape = playerShape;
  let activeEnemyShape = enemyShape;

  // Player Switch
  if (playerAction.type === 'SWITCH') {
    events.push({ 
      type: 'LOG', 
      message: `Player withdrew ${playerShape.name}!` 
    });
    events.push({ 
      type: 'SWITCH_ANIM', 
      target: 'player', 
      newActiveIndex: playerAction.index 
    });
    activePlayerShape = playerTeam[playerAction.index];
    events.push({ 
      type: 'LOG', 
      message: `Go! ${activePlayerShape.name}!` 
    });
  }

  // Enemy Switch
  if (enemyAction.type === 'SWITCH') {
    events.push({ 
      type: 'LOG', 
      message: `Opponent withdrew ${enemyShape.name}!` 
    });
    events.push({ 
      type: 'SWITCH_ANIM', 
      target: 'enemy', 
      newActiveIndex: enemyAction.index 
    });
    activeEnemyShape = enemyTeam[enemyAction.index];
    events.push({ 
      type: 'LOG', 
      message: `Opponent sent out ${activeEnemyShape.name}!` 
    });
  }

  // 2. Determine Turn Order
  const playerAttacking = playerAction.type === 'MOVE';
  const enemyAttacking = enemyAction.type === 'MOVE';

  // Calculate speed (including items)
  const getSpeed = (s: ShapeInstance) => {
    let spd = s.stats.spd;
    if (s.heldItem?.id === 'SPEED_BOOTS') spd *= 1.5;
    return spd;
  };

  let first = 'player';
  if (getSpeed(activeEnemyShape) > getSpeed(activePlayerShape)) {
    first = 'enemy';
  } else if (getSpeed(activeEnemyShape) === getSpeed(activePlayerShape)) {
    if (Math.random() > 0.5) first = 'enemy';
  }

  // Helper to process one attack
  const processAttack = (attackerIsPlayer: boolean) => {
    const attacker = attackerIsPlayer ? activePlayerShape : activeEnemyShape;
    const defender = attackerIsPlayer ? activeEnemyShape : activePlayerShape;
    const action = attackerIsPlayer ? playerAction : enemyAction;
    
    // Check if attacker fainted from previous move in this turn
    if (attacker.stats.hp <= 0) return;

    if (action.type === 'MOVE') {
      const move = attacker.moves[action.index];
      events.push({ type: 'LOG', message: `${attacker.name} used ${move.name}!` });
      events.push({ type: 'ATTACK_ANIM', attacker: attackerIsPlayer ? 'player' : 'enemy' });

      if (move.category === 'STATUS') {
         if (move.effect === 'HEAL') {
           const healAmount = Math.floor(attacker.stats.maxHp * 0.5);
           const actualHeal = Math.min(attacker.stats.maxHp - attacker.stats.hp, healAmount);
           
           events.push({ 
             type: 'HEAL', 
             attacker: attackerIsPlayer ? 'player' : 'enemy', 
             amount: actualHeal 
           });
           events.push({ type: 'LOG', message: `${attacker.name} regained health!` });
           attacker.stats.hp += actualHeal;
         } else {
           events.push({ type: 'LOG', message: `${attacker.name}'s stats changed! (Effect pending)` });
         }
      } else {
        const { damage, typeMult } = getDamageResult(attacker, defender, move);
        
        events.push({ 
          type: 'DAMAGE', 
          target: attackerIsPlayer ? 'enemy' : 'player', 
          amount: damage 
        });

        defender.stats.hp = Math.max(0, defender.stats.hp - damage);

        if (typeMult > 1) events.push({ type: 'LOG', message: "It's super effective!" });
        if (typeMult < 1) events.push({ type: 'LOG', message: "It's not very effective..." });
        
        if (defender.stats.hp <= 0) {
          events.push({ type: 'FAINT', target: attackerIsPlayer ? 'enemy' : 'player' });
          events.push({ type: 'LOG', message: `${defender.name} fainted!` });
        }
      }
    }
  };

  if (first === 'player') {
    if (playerAttacking) processAttack(true);
    if (enemyAttacking) processAttack(false);
  } else {
    if (enemyAttacking) processAttack(false);
    if (playerAttacking) processAttack(true);
  }

  // 3. End of Turn Effects (Items, Weather)
  // Only apply if shape is still alive
  [true, false].forEach(isPlayer => {
    const shape = isPlayer ? activePlayerShape : activeEnemyShape;
    if (shape.status !== 'FAINTED' && shape.stats.hp > 0) {
      // Leftovers
      if (shape.heldItem?.id === 'CUBE_LEFTOVERS') {
         const healAmt = Math.floor(shape.stats.maxHp / 16);
         if (shape.stats.hp < shape.stats.maxHp) {
            events.push({ 
              type: 'HEAL', 
              attacker: isPlayer ? 'player' : 'enemy', 
              amount: healAmt 
            });
            events.push({ type: 'LOG', message: `${shape.name}'s leftovers restored HP!` });
            shape.stats.hp = Math.min(shape.stats.maxHp, shape.stats.hp + healAmt);
         }
      }
    }
  });

  return events;
};
