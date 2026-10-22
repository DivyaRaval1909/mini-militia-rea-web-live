/**
 * Mini Militia Web Clone - AI Bot Controller System
 * Implements tactical behavior, jetpack navigation, lead-aim prediction, and combat state machines.
 */

class BotController {
  constructor(soldier) {
    this.soldier = soldier;
    this.target = null;
    this.state = 'patrol'; // 'patrol', 'combat', 'flee', 'seek_health'
    this.stateTimer = 0;
    this.decisionInterval = 0.15; // 150ms per tactical decision tick
    this.decisionTimer = Math.random() * 0.15;

    // Movement intent
    this.patrolDir = Math.random() > 0.5 ? 1 : -1;
    this.patrolTimer = 2.0 + Math.random() * 3.0;
    this.jumpBurstTimer = 0;
    this.grenadeCooldown = 5.0 + Math.random() * 5.0;

    // Aiming smoothing
    this.aimTargetAngle = 0;
    this.aimSpeed = 5.5 + Math.random() * 3.0; // rad/s
    this.reactionDelay = 0.15;
  }

  update(dt, game) {
    const s = this.soldier;
    if (s.dead) return;

    this.decisionTimer -= dt;
    this.grenadeCooldown -= dt;
    this.jumpBurstTimer -= dt;

    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.decisionInterval;
      this.makeDecision(game);
    }

    // Smooth aim angle transition
    let diff = this.aimTargetAngle - s.aimAngle;
    // Normalize diff to -PI .. PI
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    s.aimAngle += diff * Math.min(1, this.aimSpeed * dt);

    // Apply movement behavior based on state
    this.executeMovement(dt, game);
  }

  makeDecision(game) {
    const s = this.soldier;
    const player = game.player;

    // 1. Check if wounded and nearby health pack exists
    if (s.hp < 40) {
      const nearestHealth = this.findNearestPickup(game.map, 'health');
      if (nearestHealth && Math.hypot(nearestHealth.x - s.x, nearestHealth.y - s.y) < 600) {
        this.target = nearestHealth;
        this.state = 'seek_health';
        return;
      }
    }

    // 2. Target Player
    if (player && !player.dead) {
      const dist = Math.hypot(player.x - s.x, player.y - s.y);
      const hasLOS = this.hasLineOfSight(s.x, s.y, player.x, player.y, game.map);

      if (dist < 1000 && (hasLOS || dist < 450)) {
        this.target = player;
        this.state = 'combat';
        return;
      }
    }

    // 3. Fallback to Patrol / Roam
    this.state = 'patrol';
    this.target = null;
  }

  executeMovement(dt, game) {
    const s = this.soldier;
    s.input.left = false;
    s.input.right = false;
    s.input.up = false;
    s.input.shoot = false;

    if (this.state === 'combat' && this.target) {
      const target = this.target;
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const dist = Math.hypot(dx, dy);

      // Lead aim prediction (calculate target velocity)
      const leadTime = dist / (s.currentWeapon.speed || 1200);
      const targetAimX = target.x + (target.vx || 0) * leadTime * 0.7;
      const targetAimY = target.y + (target.vy || 0) * leadTime * 0.7 - 5; // Aim at chest/head

      this.aimTargetAngle = Math.atan2(targetAimY - s.y, targetAimX - s.x);

      // Weapon-specific spacing tactics
      let preferredDistance = 250;
      if (s.currentWeapon.type === 'shotgun') preferredDistance = 120; // Aggressive rush
      else if (s.currentWeapon.type === 'sniper') preferredDistance = 550; // Keep distance
      else if (s.currentWeapon.type === 'heavy') preferredDistance = 350;

      // Horizontal maneuvering
      if (dist > preferredDistance + 50) {
        // Move towards target
        if (dx > 30) s.input.right = true;
        else if (dx < -30) s.input.left = true;
      } else if (dist < preferredDistance - 50) {
        // Back off / kite
        if (dx > 0) s.input.left = true;
        else s.input.right = true;
      } else {
        // Strafe
        if (Math.sin(Date.now() * 0.003) > 0) s.input.right = true;
        else s.input.left = true;
      }

      // Vertical jetpack flight to match or get high-ground advantage
      const desiredY = target.y - 60; // Try to get slightly above target
      if (s.y > desiredY && s.nitro > 20) {
        s.input.up = true;
      }

      // Shoot decision
      const angleDiff = Math.abs(this.aimTargetAngle - s.aimAngle);
      const hasLOS = this.hasLineOfSight(s.x, s.y, target.x, target.y, game.map);

      if (hasLOS && angleDiff < 0.22 && dist < 850) {
        s.input.shoot = true;
      }

      // Tactical grenade throw (if player is hiding or at medium distance)
      if (this.grenadeCooldown <= 0 && s.grenades > 0 && dist > 180 && dist < 450) {
        this.grenadeCooldown = 8.0 + Math.random() * 6.0;
        s.throwGrenade(game.particles, window.soundEngine);
      }

    } else if (this.state === 'seek_health' && this.target) {
      const dx = this.target.x - s.x;
      const dy = this.target.y - s.y;

      if (dx > 20) s.input.right = true;
      else if (dx < -20) s.input.left = true;

      if (dy < -30 && s.nitro > 15) {
        s.input.up = true;
      }

      this.aimTargetAngle = Math.atan2(dy, dx);

    } else {
      // --- Patrol State ---
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) {
        this.patrolTimer = 2.5 + Math.random() * 4.0;
        this.patrolDir = -this.patrolDir;
      }

      if (this.patrolDir > 0) s.input.right = true;
      else s.input.left = true;

      // Occasional jetpack jump to navigate platforms
      if (this.jumpBurstTimer <= 0 && Math.random() < 0.08 && s.nitro > 40) {
        this.jumpBurstTimer = 1.8 + Math.random() * 2.0;
      }
      if (this.jumpBurstTimer > 0.8 && s.nitro > 20) {
        s.input.up = true;
      }

      // Aim in movement direction
      this.aimTargetAngle = this.patrolDir > 0 ? 0 : Math.PI;
    }
  }

  hasLineOfSight(x1, y1, x2, y2, map) {
    const hit = map.raycast(x1, y1, x2, y2);
    return hit === null;
  }

  findNearestPickup(map, type) {
    let nearest = null;
    let minDist = Infinity;
    for (const p of map.pickups) {
      if (p.active && p.type === type) {
        const d = Math.hypot(p.x - this.soldier.x, p.y - this.soldier.y);
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      }
    }
    return nearest;
  }
}

window.BotController = BotController;
