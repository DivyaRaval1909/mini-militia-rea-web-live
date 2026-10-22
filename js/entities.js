/**
 * Mini Militia Web Clone - Player & Bot Soldier Entities
 * Rigged with procedural Doodle Army aesthetics, floating jet boots, and low-gravity flight physics.
 */

class Soldier {
  constructor(options = {}) {
    this.id = options.id || Math.random().toString(36).substr(2, 9);
    this.name = options.name || 'Sgt. Doodle';
    this.isBot = !!options.isBot;
    this.x = options.x || 300;
    this.y = options.y || 300;
    this.vx = 0;
    this.vy = 0;
    this.radius = 16; // Collision circle
    this.headRadius = 11;
    this.facing = 1; // 1 = right, -1 = left
    this.aimAngle = 0;

    // Tactical stats
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.maxNitro = 100;
    this.nitro = this.maxNitro;
    this.unlimitedBoost = Boolean(options.unlimitedBoost);
    this.nitroRechargeCooldown = 0;
    this.isBoosting = false;
    this.isGrounded = false;
    this.dead = false;
    this.respawnTimer = 0;

    // Appearance / Team Colors
    this.camoColor = options.camoColor || (this.isBot ? '#7d3838' : '#3f5938'); // Rebel red for bots, olive green for player
    this.skinColor = options.skinColor || '#f5d5b8';
    this.vestColor = options.vestColor || (this.isBot ? '#4d2424' : '#283824');
    this.bandanaColor = options.bandanaColor || (this.isBot ? '#c0392b' : '#27ae60');

    // Weapons inventory
    this.weapons = [
      { ...WEAPONS[options.primaryWeapon || 'M4'], currentMag: WEAPONS[options.primaryWeapon || 'M4'].magSize, reserve: WEAPONS[options.primaryWeapon || 'M4'].maxReserve },
      { ...WEAPONS['PISTOL'], currentMag: WEAPONS['PISTOL'].magSize, reserve: WEAPONS['PISTOL'].maxReserve }
    ];
    this.activeWeaponIndex = 0;
    this.grenades = 3;
    this.lastShotTime = 0;
    this.reloading = false;
    this.reloadProgress = 0;

    // Movement / Input state
    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      shoot: false,
      grenade: false
    };

    // Animation & boots tracking
    this.walkCycle = 0;
    this.recoilOffset = 0;
    this.jetFxTimer = 0;
    this.leftBoot = { x: -8, y: 22, vx: 0, vy: 0, angle: 0 };
    this.rightBoot = { x: 8, y: 22, vx: 0, vy: 0, angle: 0 };
  }

  get currentWeapon() {
    return this.weapons[this.activeWeaponIndex];
  }

  equipWeapon(weaponDef) {
    // Replace active weapon
    this.weapons[this.activeWeaponIndex] = {
      ...weaponDef,
      currentMag: weaponDef.magSize,
      reserve: weaponDef.maxReserve
    };
    this.reloading = false;
    this.reloadProgress = 0;
  }

  switchWeapon() {
    if (this.reloading) return;
    this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.weapons.length;
    window.soundEngine.playMechanicalClick(0.4, 900);
  }

  reload() {
    const w = this.currentWeapon;
    if (this.reloading || w.currentMag >= w.magSize || w.reserve <= 0) return;
    this.reloading = true;
    this.reloadProgress = 0;
    window.soundEngine.playReload();
  }

  takeDamage(amount, sourceAngle = 0, isHeadshot = false) {
    if (this.dead) return;
    this.hp -= amount;
    window.soundEngine.playHit(isHeadshot);
    if (!this.isBot) {
      window.soundEngine.playHurt();
    }

    // Impact knockback
    this.vx += Math.cos(sourceAngle) * amount * 3.5;
    this.vy += Math.sin(sourceAngle) * amount * 3.5;

    // Floating text feedback
    if (window.gameInstance && window.gameInstance.particles) {
      const text = isHeadshot ? `HEADSHOT! -${Math.round(amount)}` : `-${Math.round(amount)}`;
      window.gameInstance.particles.addFloatingText(this.x, this.y - 15, text, isHeadshot ? '#ffec3d' : '#ff4d4f', isHeadshot);
      window.gameInstance.particles.addBlood(this.x, this.y, 7, Math.cos(sourceAngle), Math.sin(sourceAngle));
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.respawnTimer = 3.5;

    if (window.gameInstance) {
      window.gameInstance.particles.addBlood(this.x, this.y, 25, 0, -1);
      window.gameInstance.particles.addExplosion(this.x, this.y, 10, 30);
      window.gameInstance.onSoldierKilled(this);
    }
  }

  respawn(spawnPos) {
    this.x = spawnPos.x;
    this.y = spawnPos.y;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.nitro = this.maxNitro;
    this.dead = false;
    this.reloading = false;
    this.grenades = 3;

    // Replenish ammo
    for (const w of this.weapons) {
      w.currentMag = w.magSize;
      w.reserve = w.maxReserve;
    }
  }

  update(dt, map, particles, soundEngine) {
    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn(map.getValidSpawn());
      }
      return;
    }

    // Facing direction follows aim
    this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;

    // Handle reloading timer
    if (this.reloading) {
      const w = this.currentWeapon;
      this.reloadProgress += (dt * 1000) / w.reloadTime;
      if (this.reloadProgress >= 1.0) {
        const needed = w.magSize - w.currentMag;
        const available = Math.min(needed, w.reserve);
        w.currentMag += available;
        w.reserve -= available;
        this.reloading = false;
        this.reloadProgress = 0;
      }
    }

    // Auto-reload on empty clip
    if (this.currentWeapon.currentMag <= 0 && !this.reloading && this.currentWeapon.reserve > 0) {
      this.reload();
    }

    // Recoil recovery
    this.recoilOffset *= Math.pow(0.01, dt);

    // --- PHYSICS & JETPACK THRUST ---
    const gravity = 550; // Low-gravity floatiness
    this.vy += gravity * dt;

    // Horizontal control
    let moveDir = 0;
    if (this.input.left) moveDir -= 1;
    if (this.input.right) moveDir += 1;

    const moveSpeed = this.isGrounded ? 210 : 170;
    const accel = this.isGrounded ? 1800 : 900;
    const targetVx = moveDir * moveSpeed;
    this.vx += (targetVx - this.vx) * Math.min(1, accel * dt / 200);

    // Jetpack Upward / Directional Thrust
    this.isBoosting = false;
    if (this.input.up && (this.nitro > 0 || this.unlimitedBoost)) {
      this.isBoosting = true;
      const thrustPower = 950;
      this.vy -= thrustPower * dt;

      // Cap vertical flight speed
      if (this.vy < -380) this.vy = -380;

      // Drain nitro (if not unlimited boost)
      if (!this.unlimitedBoost) {
        this.nitro = Math.max(0, this.nitro - 28 * dt);
      } else {
        this.nitro = this.maxNitro;
      }
      this.nitroRechargeCooldown = 0.45;

      // Emit Jetpack Fire & Smoke from boots
      this.jetFxTimer += dt;
      if (this.jetFxTimer >= 0.02) {
        this.jetFxTimer = 0;
        const lx = this.x + this.leftBoot.x;
        const ly = this.y + this.leftBoot.y + 6;
        const rx = this.x + this.rightBoot.x;
        const ry = this.y + this.rightBoot.y + 6;
        particles.addJetFire(lx, ly, this.vx * 0.2, this.vy * 0.2);
        particles.addJetFire(rx, ry, this.vx * 0.2, this.vy * 0.2);
        if (Math.random() > 0.4) {
          particles.addSmoke(lx, ly, 4, '#aaaaaa');
          particles.addSmoke(rx, ry, 4, '#aaaaaa');
        }
      }

      if (!this.isBot) {
        soundEngine.setJetpackActive(true);
      }
    } else {
      if (!this.isBot && soundEngine) {
        soundEngine.setJetpackActive(false);
      }
    }

    // Nitro auto-recharge
    if (!this.isBoosting) {
      this.nitroRechargeCooldown -= dt;
      if (this.nitroRechargeCooldown <= 0) {
        const rechargeRate = this.isGrounded ? 42 : 25;
        this.nitro = Math.min(this.maxNitro, this.nitro + rechargeRate * dt);
      }
    }

    // --- MAP COLLISION RESOLUTION ---
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // Check collision with map geometry
    this.isGrounded = false;
    const hit = map.circleCollide(nextX, nextY, this.radius);
    if (hit) {
      this.x = hit.x;
      this.y = hit.y;

      // Cancel velocity into wall
      const dot = this.vx * hit.normalX + this.vy * hit.normalY;
      if (dot < 0) {
        this.vx -= dot * hit.normalX;
        this.vy -= dot * hit.normalY;
      }

      // Grounded if normal points up
      if (hit.normalY < -0.7) {
        this.isGrounded = true;
        this.vy = 0;
      }
    } else {
      this.x = nextX;
      this.y = nextY;
    }

    // Update walk cycle & boot animation
    if (this.isGrounded && Math.abs(this.vx) > 10) {
      this.walkCycle += dt * 14 * Math.sign(this.vx);
    } else {
      this.walkCycle = 0;
    }

    this.updateBoots(dt);

    // --- WEAPON SHOOTING ---
    if (this.input.shoot) {
      this.tryShoot(dt, particles, soundEngine);
    }

    // Check Pickups collection
    this.checkPickups(map, soundEngine);
  }

  updateBoots(dt) {
    // Floating boots physics
    const targetLeftX = -8 * this.facing + Math.sin(this.walkCycle) * 6;
    const targetRightX = 8 * this.facing - Math.sin(this.walkCycle) * 6;
    const targetY = 16 + (this.isBoosting ? 3 : 0) + (this.isGrounded ? Math.abs(Math.cos(this.walkCycle)) * 4 : Math.sin(Date.now() * 0.005) * 2);

    this.leftBoot.x += (targetLeftX - this.leftBoot.x) * 12 * dt;
    this.leftBoot.y += (targetY - this.leftBoot.y) * 12 * dt;
    this.rightBoot.x += (targetRightX - this.rightBoot.x) * 12 * dt;
    this.rightBoot.y += (targetY - this.rightBoot.y) * 12 * dt;

    // Boot tilt angle
    const targetAngle = (this.vx / 300) * 0.5 + (this.isBoosting ? (Math.random() - 0.5) * 0.2 : 0);
    this.leftBoot.angle += (targetAngle - this.leftBoot.angle) * 10 * dt;
    this.rightBoot.angle += (targetAngle - this.rightBoot.angle) * 10 * dt;
  }

  tryShoot(dt, particles, soundEngine) {
    if (this.reloading) return;
    const now = performance.now();
    const w = this.currentWeapon;

    if (now - this.lastShotTime < w.fireDelay) return;
    if (w.currentMag <= 0) {
      this.reload();
      return;
    }

    this.lastShotTime = now;
    w.currentMag -= 1;
    this.recoilOffset = w.recoil;

    // Calculate barrel muzzle position
    const shoulderX = this.x + 4 * this.facing;
    const shoulderY = this.y - 1;
    const muzzleDist = w.length + 8;
    const muzzleX = shoulderX + Math.cos(this.aimAngle) * muzzleDist;
    const muzzleY = shoulderY + Math.sin(this.aimAngle) * muzzleDist;

    // Muzzle flash particle & shell casing
    particles.addMuzzleFlash(muzzleX, muzzleY, this.aimAngle);
    particles.addCasing(shoulderX, shoulderY, this.facing);

    // Play weapon sound
    if (soundEngine[w.sound]) {
      soundEngine[w.sound]();
    }

    // Fire pellets / projectiles
    for (let i = 0; i < w.pellets; i++) {
      const spreadAngle = this.aimAngle + (Math.random() - 0.5) * w.spread;
      const vx = Math.cos(spreadAngle) * w.speed + this.vx * 0.2;
      const vy = Math.sin(spreadAngle) * w.speed + this.vy * 0.2;

      const proj = new Projectile({
        x: muzzleX,
        y: muzzleY,
        vx: vx,
        vy: vy,
        damage: w.damage,
        owner: this,
        isRocket: !!w.isRocket,
        splashRadius: w.splashRadius,
        color: w.color,
        tracerColor: w.tracerColor
      });

      if (window.gameInstance) {
        window.gameInstance.addProjectile(proj);
      }
    }

    // Apply weapon recoil to player physics
    this.vx -= Math.cos(this.aimAngle) * w.recoil * 18;
    this.vy -= Math.sin(this.aimAngle) * w.recoil * 18;

    // Broadcast shoot to multiplayer room if local player
    if (!this.isBot && window.gameInstance && window.gameInstance.multiplayer && window.gameInstance.multiplayer.connected) {
      window.gameInstance.multiplayer.send('player_shoot', {
        x: Math.round(muzzleX),
        y: Math.round(muzzleY),
        aimAngle: Math.round(this.aimAngle * 100) / 100,
        weaponId: w.id,
        pellets: w.pellets,
        spread: w.spread
      });
    }
  }

  throwGrenade(particles, soundEngine) {
    if (this.dead || this.grenades <= 0) return;
    this.grenades -= 1;

    const shoulderX = this.x + 4 * this.facing;
    const shoulderY = this.y - 4;
    const throwSpeed = 480;
    const vx = Math.cos(this.aimAngle) * throwSpeed + this.vx * 0.5;
    const vy = Math.sin(this.aimAngle) * throwSpeed + this.vy * 0.5 - 60; // slight arc

    const grenade = new Grenade({
      x: shoulderX,
      y: shoulderY,
      vx: vx,
      vy: vy,
      owner: this
    });

    if (window.gameInstance) {
      window.gameInstance.addGrenade(grenade);
      // Broadcast grenade to multiplayer room
      if (!this.isBot && window.gameInstance.multiplayer && window.gameInstance.multiplayer.connected) {
        window.gameInstance.multiplayer.send('player_grenade', {
          x: Math.round(shoulderX),
          y: Math.round(shoulderY),
          vx: Math.round(vx),
          vy: Math.round(vy)
        });
      }
    }
  }

  checkPickups(map, soundEngine) {
    for (const p of map.pickups) {
      if (!p.active) continue;
      const dist = Math.hypot(this.x - p.x, this.y - p.y);
      if (dist < 28) {
        if (p.type === 'health' && this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + p.heal);
          p.active = false;
          p.respawnTimer = 18; // Respawns in 18s
          soundEngine.playPickup();
          if (window.gameInstance) {
            window.gameInstance.particles.addFloatingText(this.x, this.y - 20, `+${p.heal} HP`, '#52c41a', true);
            if (!this.isBot && window.gameInstance.multiplayer && window.gameInstance.multiplayer.connected) {
              window.gameInstance.multiplayer.send('pickup_taken', { pickupId: p.id });
            }
          }
        } else if (p.type === 'weapon') {
          // If player currently doesn't have this weapon, pick it up or replenish ammo
          const current = this.currentWeapon;
          if (current.id === p.weaponId) {
            current.reserve = Math.min(current.maxReserve, current.reserve + current.magSize * 2);
            p.active = false;
            p.respawnTimer = 22;
            soundEngine.playPickup();
            if (window.gameInstance) {
              window.gameInstance.particles.addFloatingText(this.x, this.y - 20, `+AMMO`, '#faad14');
              if (!this.isBot && window.gameInstance.multiplayer && window.gameInstance.multiplayer.connected) {
                window.gameInstance.multiplayer.send('pickup_taken', { pickupId: p.id });
              }
            }
          } else {
            // Swap weapon
            this.equipWeapon(WEAPONS[p.weaponId]);
            p.active = false;
            p.respawnTimer = 22;
            soundEngine.playPickup();
            if (window.gameInstance) {
              window.gameInstance.particles.addFloatingText(this.x, this.y - 20, `EQUIPPED ${p.weaponId}`, '#faad14', true);
              if (!this.isBot && window.gameInstance.multiplayer && window.gameInstance.multiplayer.connected) {
                window.gameInstance.multiplayer.send('pickup_taken', { pickupId: p.id });
              }
            }
          }
        }
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Draw floating boots
    this.drawBoot(ctx, this.leftBoot);
    this.drawBoot(ctx, this.rightBoot);

    // 2. Draw Jetpack on back
    ctx.save();
    ctx.fillStyle = '#434343';
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1.2;
    const jetpackX = -this.facing * 9;
    ctx.fillRect(jetpackX - 4, -4, 8, 14);
    ctx.strokeRect(jetpackX - 4, -4, 8, 14);
    // Thruster nozzles
    ctx.fillStyle = '#8c8c8c';
    ctx.fillRect(jetpackX - 3, 10, 6, 3);
    ctx.restore();

    // 3. Draw Soldier Torso with Camo Vest
    ctx.save();
    ctx.fillStyle = this.vestColor;
    ctx.strokeStyle = '#1d271e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-8, -4, 16, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Camo vest strap
    ctx.fillStyle = this.camoColor;
    ctx.fillRect(-6, 2, 12, 5);
    ctx.restore();

    // 4. Draw Rotating Arm with Equipped Weapon
    ctx.save();
    const shoulderX = 4 * this.facing;
    const shoulderY = -1;
    ctx.translate(shoulderX, shoulderY);

    // Aim rotation
    const renderAimAngle = this.facing === 1 ? this.aimAngle : Math.PI - this.aimAngle;
    ctx.scale(this.facing, 1);
    ctx.rotate(renderAimAngle);

    // Recoil kickback translation
    ctx.translate(-this.recoilOffset, 0);

    // Draw Weapon
    this.drawWeapon(ctx, this.currentWeapon);

    // Draw Soldier Hand gripping weapon
    ctx.fillStyle = this.skinColor;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(8, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // 5. Draw Soldier Head & Helmet / Headband
    ctx.save();
    const headY = -12;
    // Head circle
    ctx.fillStyle = this.skinColor;
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, headY, this.headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Military Helmet / Bandana
    ctx.fillStyle = this.bandanaColor;
    ctx.beginPath();
    ctx.arc(0, headY, this.headRadius + 0.5, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#18381e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bandana knot tails hanging off back
    ctx.fillStyle = this.bandanaColor;
    ctx.beginPath();
    const knotX = -this.facing * 10;
    ctx.moveTo(knotX, headY - 1);
    ctx.lineTo(knotX - this.facing * 7, headY + 5);
    ctx.lineTo(knotX - this.facing * 4, headY + 8);
    ctx.fill();

    // Sunglasses / Tactical Goggles
    ctx.fillStyle = '#141414';
    const eyeX = this.facing * 3;
    ctx.fillRect(eyeX - 3, headY - 2, 7, 4);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(eyeX - 3, headY - 2, 7, 4);
    // Lens reflection glare
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(eyeX - 1, headY - 1, 2, 2);

    ctx.restore();

    // 6. Draw Overhead Health & Name Tag
    this.drawOverheadHUD(ctx);

    ctx.restore();

    // 7. Draw Laser Sight if Sniper is equipped
    if (this.currentWeapon.hasLaser) {
      this.drawLaserSight(ctx);
    }
  }

  drawBoot(ctx, boot) {
    ctx.save();
    ctx.translate(boot.x, boot.y);
    ctx.rotate(boot.angle);

    // Boot sole
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(-6 * this.facing, 2, 12, 3);

    // Boot leather body
    ctx.fillStyle = this.vestColor;
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 1.2;
    ctx.fillRect(-5, -6, 10, 8);
    ctx.strokeRect(-5, -6, 10, 8);

    // Thruster mini-nozzle on heel
    ctx.fillStyle = '#ff7875';
    ctx.fillRect(-4 * this.facing, 4, 3, 2);

    ctx.restore();
  }

  drawWeapon(ctx, w) {
    ctx.save();
    ctx.fillStyle = w.color;
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1.2;

    if (w.id === 'PISTOL') {
      ctx.fillRect(4, -3, 14, 5); // Slide
      ctx.strokeRect(4, -3, 14, 5);
      ctx.fillRect(5, 2, 4, 6); // Handle
    } else if (w.id === 'UZI') {
      ctx.fillRect(2, -4, 16, 7);
      ctx.strokeRect(2, -4, 16, 7);
      ctx.fillRect(6, 3, 4, 8); // Extended mag
      ctx.fillStyle = '#222';
      ctx.fillRect(18, -2, 5, 3); // Barrel
    } else if (w.id === 'M4') {
      ctx.fillRect(2, -3, 24, 6);
      ctx.strokeRect(2, -3, 24, 6);
      ctx.fillRect(26, -2, 6, 4); // Barrel
      ctx.fillRect(12, 3, 5, 8); // Curved mag
      ctx.fillStyle = '#595959';
      ctx.fillRect(-2, -2, 5, 5); // Stock
    } else if (w.id === 'SHOTGUN') {
      ctx.fillRect(2, -3, 26, 6);
      ctx.strokeRect(2, -3, 26, 6);
      ctx.fillStyle = '#8c4b26';
      ctx.fillRect(-4, -2, 7, 5); // Wooden stock
      ctx.fillStyle = '#333';
      ctx.fillRect(12, 3, 8, 4); // Pump grip
    } else if (w.id === 'SNIPER') {
      ctx.fillRect(2, -3, 34, 5);
      ctx.strokeRect(2, -3, 34, 5);
      ctx.fillRect(36, -2, 8, 3); // Long barrel
      ctx.fillRect(-6, -2, 8, 5); // Stock
      // Scope
      ctx.fillStyle = '#141414';
      ctx.fillRect(10, -7, 14, 4);
      ctx.strokeRect(10, -7, 14, 4);
    } else if (w.id === 'ROCKET') {
      ctx.fillRect(-6, -5, 34, 9);
      ctx.strokeRect(-6, -5, 34, 9);
      // Rocket launcher cone exhaust
      ctx.fillStyle = '#262626';
      ctx.beginPath();
      ctx.moveTo(-6, -7);
      ctx.lineTo(-12, -9);
      ctx.lineTo(-12, 9);
      ctx.lineTo(-6, 7);
      ctx.fill();
    }

    ctx.restore();
  }

  drawOverheadHUD(ctx) {
    const barWidth = 32;
    const barHeight = 4;
    const barY = -28;

    // Soldier name tag
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = this.isBot ? '#ff7875' : '#95de64';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 0, barY - 4);

    // Health bar background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    // Health bar fill
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = hpRatio > 0.4 ? '#52c41a' : '#f5222d';
    ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);

    // Reload indicator circle above soldier
    if (this.reloading) {
      ctx.strokeStyle = '#faad14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, barY - 14, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.reloadProgress);
      ctx.stroke();
    }
  }

  drawLaserSight(ctx) {
    if (this.dead) return;
    const shoulderX = this.x + 4 * this.facing;
    const shoulderY = this.y - 1;
    const maxLaserDist = 1200;
    const endX = shoulderX + Math.cos(this.aimAngle) * maxLaserDist;
    const endY = shoulderY + Math.sin(this.aimAngle) * maxLaserDist;

    let laserEnd = { x: endX, y: endY };
    if (window.gameInstance && window.gameInstance.map) {
      const hit = window.gameInstance.map.raycast(shoulderX, shoulderY, endX, endY);
      if (hit) {
        laserEnd = { x: hit.x, y: hit.y };
      }
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 77, 79, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(laserEnd.x, laserEnd.y);
    ctx.stroke();

    // Laser dot at impact point
    ctx.fillStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.arc(laserEnd.x, laserEnd.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

window.Soldier = Soldier;
