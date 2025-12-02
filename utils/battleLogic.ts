
import { ShapeInstance, Move, TurnEvent, PlayerAction, ShapeType } from '../types.ts';
import { TYPE_CHART } from '../constants.ts';

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
    if (attacker.heldItem.id === 'POWER_CORE') {
      atkStat *= 1.3; // High risk high reward
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
    events.push({ type: 'LOG', message: `Player withdrew ${playerShape.name}!` });
    events.push({ type: 'SWITCH_ANIM', target: 'player', newActiveIndex: playerAction.index });
    activePlayerShape = playerTeam[playerAction.index];
    events.push({ type: 'LOG', message: `Go! ${activePlayerShape.name}!` });
  }

  // Enemy Switch
  if (enemyAction.type === 'SWITCH') {
    events.push({ type: 'LOG', message: `Opponent withdrew ${enemyShape.name}!` });
    events.push({ type: 'SWITCH_ANIM', target: 'enemy', newActiveIndex: enemyAction.index });
    activeEnemyShape = enemyTeam[enemyAction.index];
    events.push({ type: 'LOG', message: `Opponent sent out ${activeEnemyShape.name}!` });
  }

  // 2. Determine Turn Order
  const playerAttacking = playerAction.type === 'MOVE';
  const enemyAttacking = enemyAction.type === 'MOVE';

  const getSpeed = (s: ShapeInstance) => {
    let spd = s.stats.spd;
    if (s.heldItem?.id === 'SPEED_BOOTS') spd *= 1.5;
    return spd;
  };

  const getPriority = (action: PlayerAction, shape: ShapeInstance) => {
    if (action.type !== 'MOVE') return 6; // Switch has highest priority
    return shape.moves[action.index].priority || 0;
  };

  const pPriority = getPriority(playerAction, activePlayerShape);
  const ePriority = getPriority(enemyAction, activeEnemyShape);

  let first = 'player';
  
  if (pPriority > ePriority) {
    first = 'player';
  } else if (ePriority > pPriority) {
    first = 'enemy';
  } else {
    // Speed tie breaker
    if (getSpeed(activeEnemyShape) > getSpeed(activePlayerShape)) {
      first = 'enemy';
    } else if (getSpeed(activeEnemyShape) === getSpeed(activePlayerShape)) {
      if (Math.random() > 0.5) first = 'enemy';
    }
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
           events.push({ type: 'HEAL', attacker: attackerIsPlayer ? 'player' : 'enemy', amount: actualHeal });
           events.push({ type: 'LOG', message: `${attacker.name} regained health!` });
           attacker.stats.hp += actualHeal;
         } else if (move.effect === 'BUFF_DEF') {
           events.push({ type: 'LOG', message: `${attacker.name}'s Defense rose!` });
           attacker.stats.def = Math.floor(attacker.stats.def * 1.5);
         } else if (move.effect === 'BUFF_ATK') {
           events.push({ type: 'LOG', message: `${attacker.name}'s Attack rose!` });
           attacker.stats.atk = Math.floor(attacker.stats.atk * 1.5);
         }
      } else {
        const { damage, typeMult } = getDamageResult(attacker, defender, move);
        
        events.push({ type: 'DAMAGE', target: attackerIsPlayer ? 'enemy' : 'player', amount: damage });
        defender.stats.hp = Math.max(0, defender.stats.hp - damage);

        if (typeMult > 1) events.push({ type: 'LOG', message: "It's super effective!" });
        if (typeMult < 1) events.push({ type: 'LOG', message: "It's not very effective..." });
        
        // --- Drain Effect ---
        if (move.drain) {
           const drainAmount = Math.floor(damage / 2);
           if (drainAmount > 0) {
              events.push({ type: 'HEAL', attacker: attackerIsPlayer ? 'player' : 'enemy', amount: drainAmount });
              events.push({ type: 'LOG', message: `${attacker.name} drained energy!` });
              attacker.stats.hp = Math.min(attacker.stats.maxHp, attacker.stats.hp + drainAmount);
           }
        }

        // --- Recoil Item ---
        if (attacker.heldItem?.id === 'POWER_CORE') {
           const recoil = Math.floor(damage * 0.1);
           if (recoil > 0) {
              events.push({ type: 'DAMAGE', target: attackerIsPlayer ? 'player' : 'enemy', amount: recoil });
              events.push({ type: 'LOG', message: `${attacker.name} took recoil damage!` });
              attacker.stats.hp = Math.max(0, attacker.stats.hp - recoil);
           }
        }

        if (defender.stats.hp <= 0) {
          // --- Focus Band Check ---
          if (defender.heldItem?.id === 'FOCUS_BAND' && Math.random() < 0.10) {
             defender.stats.hp = 1;
             events.push({ type: 'LOG', message: `${defender.name} hung on using its Focus Band!` });
          } else {
             events.push({ type: 'FAINT', target: attackerIsPlayer ? 'enemy' : 'player' });
             events.push({ type: 'LOG', message: `${defender.name} fainted!` });
          }
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
  [true, false].forEach(isPlayer => {
    const shape = isPlayer ? activePlayerShape : activeEnemyShape;
    const targetName = isPlayer ? 'player' : 'enemy';

    if (shape.status !== 'FAINTED' && shape.stats.hp > 0) {
      // Leftovers
      if (shape.heldItem?.id === 'CUBE_LEFTOVERS') {
         const healAmt = Math.floor(shape.stats.maxHp / 16);
         if (shape.stats.hp < shape.stats.maxHp) {
            events.push({ type: 'HEAL', attacker: targetName as any, amount: healAmt });
            events.push({ type: 'LOG', message: `${shape.name}'s leftovers restored HP!` });
            shape.stats.hp = Math.min(shape.stats.maxHp, shape.stats.hp + healAmt);
         }
      }

      // Berry Check
      if (shape.heldItem?.id === 'BERRY_BIT' && !shape.heldItem.consumed) {
         if (shape.stats.hp < shape.stats.maxHp / 2) {
            const healAmt = Math.floor(shape.stats.maxHp / 2);
            events.push({ type: 'ITEM_USE', target: targetName as any, effect: 'berry' });
            events.push({ type: 'HEAL', attacker: targetName as any, amount: healAmt });
            events.push({ type: 'LOG', message: `${shape.name} ate its Bit Berry!` });
            shape.stats.hp = Math.min(shape.stats.maxHp, shape.stats.hp + healAmt);
            shape.heldItem.consumed = true;
         }
      }
    }
  });

  return events;
};
