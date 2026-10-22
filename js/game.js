/**
 * Mini Militia Web Clone - Master Game Engine
 * Manages game loop, physics updates, combat resolutions, HUD, camera, controls,
 * custom rooms, match timers (10/20/30 min), unlimited boost, and multiplayer sync.
 */

class MiniMilitiaGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.miniCanvas = document.getElementById('minimapCanvas');
    this.miniCtx = this.miniCanvas ? this.miniCanvas.getContext('2d') : null;

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Systems
    this.map = new GameMap();
    this.particles = new ParticleSystem();
    this.soundEngine = window.soundEngine;
    this.multiplayer = new MultiplayerManager(this);

    // Entities
    this.player = null;
    this.bots = [];
    this.botControllers = [];
    this.projectiles = [];
    this.grenades = [];

    // Camera
    this.camera = {
      x: 0,
      y: 0,
      w: this.width,
      h: this.height,
      targetX: 0,
      targetY: 0,
      shake: 0
    };

    // Game stats
    this.kills = 0;
    this.deaths = 0;
    this.streak = 0;
    this.killFeed = [];
    this.maxBots = 4;
    this.gameMode = 'singleplayer'; // 'singleplayer' | 'multiplayer'

    // Controls & Touch
    this.mouse = { x: this.width / 2, y: this.height / 2, worldX: 0, worldY: 0, down: false };
    this.keys = {};
    this.touchControls = {
      active: false,
      leftStick: { active: false, startX: 0, startY: 0, curX: 0, curY: 0, vx: 0, vy: 0 },
      rightStick: { active: false, startX: 0, startY: 0, curX: 0, curY: 0, vx: 0, vy: 0 }
    };

    this.lastTime = performance.now();
    this.isRunning = false;

    window.gameInstance = this;
    this.initEventListeners();
  }

  startSinglePlayer(options = {}) {
    this.gameMode = 'singleplayer';
    this.soundEngine.init();

    const playerName = options.playerName || 'Player';
    const camoColor = options.camoColor || '#3f5938';
    const unlimitedBoost = Boolean(options.unlimitedBoost);

    // Reset stats
    this.kills = 0;
    this.deaths = 0;
    this.streak = 0;
    this.killFeed = [];
    this.projectiles = [];
    this.grenades = [];
    this.particles.reset();

    // Spawn player
    const spawn = this.map.getValidSpawn();
    this.player = new Soldier({
      id: 'local_player',
      name: playerName,
      camoColor: camoColor,
      x: spawn.x,
      y: spawn.y,
      isBot: false,
      unlimitedBoost: unlimitedBoost,
      primaryWeapon: 'M4'
    });

    // Spawn AI bots
    this.spawnBots();

    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    this.addKillFeedEntry('SYSTEM', 'Single Player Practice Match Started', '');
  }

  startMultiplayer(roomSettings, playerProfile) {
    this.gameMode = 'multiplayer';
    this.soundEngine.init();

    this.kills = 0;
    this.deaths = 0;
    this.streak = 0;
    this.killFeed = [];
    this.projectiles = [];
    this.grenades = [];
    this.particles.reset();

    const spawn = this.map.getValidSpawn();
    this.player = new Soldier({
      id: 'local_player',
      name: playerProfile.name || 'Player',
      camoColor: playerProfile.camoColor || '#3f5938',
      x: spawn.x,
      y: spawn.y,
      isBot: false,
      unlimitedBoost: roomSettings.unlimitedBoost,
      primaryWeapon: 'M4'
    });

    // Spawn bots only if host enabled them in room settings
    if (roomSettings.enableBots) {
      this.spawnBots(2); // 2 filler bots in multiplayer
    } else {
      this.bots = [];
      this.botControllers = [];
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    this.addKillFeedEntry('SYSTEM', `Multiplayer Room [${roomSettings.roomCode}] Active!`, '');
  }

  spawnBots(count = this.maxBots) {
    this.bots = [];
    this.botControllers = [];
    const botNames = ['Bot Sarge', 'Bot Psycho', 'Bot Hawk', 'Bot Ghost', 'Bot Reaper'];
    const botWeapons = ['M4', 'SHOTGUN', 'UZI', 'SNIPER', 'ROCKET'];

    for (let i = 0; i < count; i++) {
      const spawn = this.map.getValidSpawn();
      const bot = new Soldier({
        id: `bot_${i}`,
        name: botNames[i % botNames.length],
        x: spawn.x,
        y: spawn.y,
        isBot: true,
        unlimitedBoost: this.player ? this.player.unlimitedBoost : false,
        primaryWeapon: botWeapons[i % botWeapons.length]
      });

      const controller = new BotController(bot);
      this.bots.push(bot);
      this.botControllers.push(controller);
    }
  }

  respawnAll() {
    if (this.player) {
      this.player.respawn(this.map.getValidSpawn());
    }
    for (const b of this.bots) {
      b.respawn(this.map.getValidSpawn());
    }
    for (const r of this.multiplayer.remotePlayers.values()) {
      r.respawn(this.map.getValidSpawn());
    }
    this.kills = 0;
    this.deaths = 0;
    this.streak = 0;
  }

  showGameOverScreen(winner, leaderboard) {
    const modal = document.getElementById('gameOverModal');
    if (!modal) return;

    const winnerNameEl = document.getElementById('goWinnerName');
    const leaderboardListEl = document.getElementById('goLeaderboardList');
    const rematchBtn = document.getElementById('goRematchBtn');

    if (winnerNameEl) {
      winnerNameEl.textContent = winner ? `🏆 MVP: ${winner.name} (${winner.kills} Kills)` : 'Match Complete!';
    }

    if (leaderboardListEl && leaderboard) {
      leaderboardListEl.innerHTML = '';
      leaderboard.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.innerHTML = `
          <span class="rank">#${index + 1}</span>
          <span class="name">${item.name}</span>
          <span class="score">${item.kills} K / ${item.deaths} D</span>
        `;
        leaderboardListEl.appendChild(row);
      });
    }

    if (rematchBtn) {
      // Rematch button visible only to room owner
      if (this.multiplayer.isOwner) {
        rematchBtn.style.display = 'inline-block';
        rematchBtn.onclick = () => {
          this.multiplayer.restartMatch();
        };
      } else {
        rematchBtn.style.display = 'none';
      }
    }

    modal.style.display = 'flex';
  }

  hideGameOverScreen() {
    const modal = document.getElementById('gameOverModal');
    if (modal) modal.style.display = 'none';
  }

  initEventListeners() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.camera.w = this.width;
      this.camera.h = this.height;
    });

    // Keyboard events
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.soundEngine.resume();

      if (e.key === 'r' || e.key === 'R') {
        if (this.player) this.player.reload();
      } else if (e.key === 'q' || e.key === 'Q' || e.key === '1' || e.key === '2') {
        if (this.player) this.player.switchWeapon();
      } else if (e.key === 'g' || e.key === 'G') {
        if (this.player) this.player.throwGrenade(this.particles, this.soundEngine);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Mouse events
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      this.soundEngine.resume();
      if (e.button === 0) {
        this.mouse.down = true;
      } else if (e.button === 2) {
        // Right click throws grenade
        e.preventDefault();
        if (this.player) this.player.throwGrenade(this.particles, this.soundEngine);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.down = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mobile touch controls
    this.initTouchControls();
  }

  initTouchControls() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    this.touchControls.active = true;
    const stickRadius = 60;

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.soundEngine.resume();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX < this.width / 2 && !this.touchControls.leftStick.active) {
          this.touchControls.leftStick.active = true;
          this.touchControls.leftStick.id = t.identifier;
          this.touchControls.leftStick.startX = t.clientX;
          this.touchControls.leftStick.startY = t.clientY;
          this.touchControls.leftStick.curX = t.clientX;
          this.touchControls.leftStick.curY = t.clientY;
        } else if (t.clientX >= this.width / 2 && !this.touchControls.rightStick.active) {
          this.touchControls.rightStick.active = true;
          this.touchControls.rightStick.id = t.identifier;
          this.touchControls.rightStick.startX = t.clientX;
          this.touchControls.rightStick.startY = t.clientY;
          this.touchControls.rightStick.curX = t.clientX;
          this.touchControls.rightStick.curY = t.clientY;
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const ls = this.touchControls.leftStick;
        const rs = this.touchControls.rightStick;

        if (ls.active && t.identifier === ls.id) {
          ls.curX = t.clientX;
          ls.curY = t.clientY;
          const dx = ls.curX - ls.startX;
          const dy = ls.curY - ls.startY;
          const dist = Math.hypot(dx, dy);
          const clamped = Math.min(dist, stickRadius);
          const angle = Math.atan2(dy, dx);
          ls.vx = (Math.cos(angle) * clamped) / stickRadius;
          ls.vy = (Math.sin(angle) * clamped) / stickRadius;
        }

        if (rs.active && t.identifier === rs.id) {
          rs.curX = t.clientX;
          rs.curY = t.clientY;
          const dx = rs.curX - rs.startX;
          const dy = rs.curY - rs.startY;
          const dist = Math.hypot(dx, dy);
          const clamped = Math.min(dist, stickRadius);
          const angle = Math.atan2(dy, dx);
          rs.vx = (Math.cos(angle) * clamped) / stickRadius;
          rs.vy = (Math.sin(angle) * clamped) / stickRadius;
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.touchControls.leftStick.active && t.identifier === this.touchControls.leftStick.id) {
          this.touchControls.leftStick.active = false;
          this.touchControls.leftStick.vx = 0;
          this.touchControls.leftStick.vy = 0;
        }
        if (this.touchControls.rightStick.active && t.identifier === this.touchControls.rightStick.id) {
          this.touchControls.rightStick.active = false;
          this.touchControls.rightStick.vx = 0;
          this.touchControls.rightStick.vy = 0;
        }
      }
    };

    this.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  processPlayerInput() {
    if (!this.player || this.player.dead) return;

    if (this.touchControls.active) {
      const ls = this.touchControls.leftStick;
      const rs = this.touchControls.rightStick;

      this.player.input.left = ls.active && ls.vx < -0.3;
      this.player.input.right = ls.active && ls.vx > 0.3;
      this.player.input.up = ls.active && ls.vy < -0.3;

      if (rs.active && Math.hypot(rs.vx, rs.vy) > 0.25) {
        this.player.aimAngle = Math.atan2(rs.vy, rs.vx);
        this.player.input.shoot = true;
      } else {
        this.player.input.shoot = false;
      }
    } else {
      const k = this.keys;
      this.player.input.left = !!(k['a'] || k['arrowleft']);
      this.player.input.right = !!(k['d'] || k['arrowright']);
      this.player.input.up = !!(k['w'] || k['arrowup'] || k[' ']);
      this.player.input.shoot = this.mouse.down;

      this.mouse.worldX = this.mouse.x + this.camera.x;
      this.mouse.worldY = this.mouse.y + this.camera.y;
      this.player.aimAngle = Math.atan2(this.mouse.worldY - this.player.y, this.mouse.worldX - this.player.x);
    }
  }

  addProjectile(proj) {
    this.projectiles.push(proj);
  }

  addGrenade(grenade) {
    this.grenades.push(grenade);
  }

  addScreenShake(intensity) {
    this.camera.shake = Math.min(22, this.camera.shake + intensity);
  }

  applyRadialDamage(x, y, radius, maxDamage, sourceSoldier) {
    const targets = [this.player, ...this.bots, ...this.multiplayer.remotePlayers.values()];
    for (const target of targets) {
      if (!target || target.dead) continue;
      const dist = Math.hypot(target.x - x, target.y - y);
      if (dist < radius) {
        const falloff = 1 - dist / radius;
        const damage = maxDamage * falloff;
        const angle = Math.atan2(target.y - y, target.x - x);

        target.takeDamage(damage, angle, false);

        // Sync damage with server if we dealt damage to a remote player
        if (sourceSoldier === this.player && this.multiplayer.connected && this.multiplayer.remotePlayers.has(target.id)) {
          this.multiplayer.send('player_hit', {
            targetId: target.id,
            damage: Math.round(damage),
            isHeadshot: false,
            weaponName: 'Explosion'
          });
        }

        if (target.dead && sourceSoldier) {
          this.onKill(sourceSoldier, target, 'Explosion');
        }
      }
    }
  }

  onSoldierKilled(victim) {
    if (victim === this.player) {
      this.deaths++;
      this.streak = 0;
      this.addKillFeedEntry('ENEMY', 'You were killed in combat!', '');
    }
  }

  onKill(killer, victim, weaponName) {
    if (killer === this.player) {
      this.kills++;
      this.streak++;
      this.soundEngine.playKillDing();
      this.particles.addFloatingText(this.player.x, this.player.y - 40, `+1 KILL (${victim.name})`, '#73d13d', true);
    }
    this.addKillFeedEntry(killer.name, victim.name, weaponName);
  }

  addKillFeedEntry(killer, victim, weapon) {
    const text = weapon ? `${killer} ➔ [${weapon}] ➔ ${victim}` : `${killer} ${victim}`;
    this.killFeed.unshift({ text, age: 0, lifetime: 4.5 });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  update(dt) {
    this.processPlayerInput();

    if (this.player) {
      this.player.update(dt, this.map, this.particles, this.soundEngine);
    }

    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const controller = this.botControllers[i];
      controller.update(dt, this);
      bot.update(dt, this.map, this.particles, this.soundEngine);
    }

    // Projectile hit detection across players, bots, and remote players
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this.map, this.particles, this.soundEngine);

      if (p.dead) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const targets = [this.player, ...this.bots, ...this.multiplayer.remotePlayers.values()];
      for (const t of targets) {
        if (!t || t.dead || t === p.owner) continue;

        const headDist = Math.hypot(p.x - t.x, p.y - (t.y - 12));
        const bodyDist = Math.hypot(p.x - t.x, p.y - t.y);

        if (headDist < t.headRadius) {
          const isHeadshot = true;
          t.takeDamage(p.damage * 2.0, Math.atan2(p.vy, p.vx), true);
          p.dead = true;

          // Notify server if local player hit a remote player
          if (p.owner === this.player && this.multiplayer.connected && this.multiplayer.remotePlayers.has(t.id)) {
            this.multiplayer.send('player_hit', {
              targetId: t.id,
              damage: p.damage * 2.0,
              isHeadshot: true,
              weaponName: p.owner.currentWeapon.name
            });
          }

          if (t.dead && p.owner) this.onKill(p.owner, t, p.owner.currentWeapon.name);
          break;
        } else if (bodyDist < t.radius) {
          t.takeDamage(p.damage, Math.atan2(p.vy, p.vx), false);
          p.dead = true;

          if (p.owner === this.player && this.multiplayer.connected && this.multiplayer.remotePlayers.has(t.id)) {
            this.multiplayer.send('player_hit', {
              targetId: t.id,
              damage: p.damage,
              isHeadshot: false,
              weaponName: p.owner.currentWeapon.name
            });
          }

          if (t.dead && p.owner) this.onKill(p.owner, t, p.owner.currentWeapon.name);
          break;
        }
      }

      if (p.dead) {
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.update(dt, this.map, this.particles, this.soundEngine);
      if (g.dead) {
        this.grenades.splice(i, 1);
      }
    }

    this.map.update(dt);
    this.particles.update(dt, this.map);
    this.multiplayer.update(dt);

    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].age += dt;
      if (this.killFeed[i].age >= this.killFeed[i].lifetime) {
        this.killFeed.splice(i, 1);
      }
    }

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    if (!this.player) return;

    const leadDist = 140;
    const leadX = Math.cos(this.player.aimAngle) * leadDist;
    const leadY = Math.sin(this.player.aimAngle) * leadDist * 0.5;

    const targetX = this.player.x + leadX - this.width / 2;
    const targetY = this.player.y + leadY - this.height / 2;

    this.camera.x += (targetX - this.camera.x) * 6.5 * dt;
    this.camera.y += (targetY - this.camera.y) * 6.5 * dt;

    this.camera.x = Math.max(0, Math.min(this.map.width - this.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.map.height - this.height, this.camera.y));

    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - 35 * dt);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    let shakeX = 0;
    let shakeY = 0;
    if (this.camera.shake > 0) {
      shakeX = (Math.random() - 0.5) * this.camera.shake * 2;
      shakeY = (Math.random() - 0.5) * this.camera.shake * 2;
    }
    ctx.translate(-Math.round(this.camera.x + shakeX), -Math.round(this.camera.y + shakeY));

    this.map.draw(ctx, this.camera);

    for (const p of this.projectiles) p.draw(ctx);
    for (const g of this.grenades) g.draw(ctx);

    for (const b of this.bots) b.draw(ctx);
    for (const r of this.multiplayer.remotePlayers.values()) r.draw(ctx);

    if (this.player) {
      this.player.draw(ctx);
    }

    this.particles.draw(ctx);

    ctx.restore();

    this.renderHUD();
    this.renderMinimap();
    this.renderCrosshair();
    this.renderTouchControls();
  }

  renderCrosshair() {
    if (this.touchControls.active) return;
    const ctx = this.ctx;
    const mx = this.mouse.x;
    const my = this.mouse.y;

    ctx.save();
    ctx.strokeStyle = '#52c41a';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.arc(mx, my, 2, 0, Math.PI * 2);
    ctx.fill();

    const gap = 12;
    const len = 7;
    ctx.beginPath();
    ctx.moveTo(mx - gap - len, my); ctx.lineTo(mx - gap, my);
    ctx.moveTo(mx + gap, my); ctx.lineTo(mx + gap + len, my);
    ctx.moveTo(mx, my - gap - len); ctx.lineTo(mx, my - gap);
    ctx.moveTo(mx, my + gap); ctx.lineTo(mx, my + gap + len);
    ctx.stroke();

    ctx.restore();
  }

  renderHUD() {
    const ctx = this.ctx;
    const p = this.player;
    if (!p) return;

    // --- Top Left: Health & Nitro Bars ---
    const hudX = 24;
    const hudY = 24;
    const barW = 200;
    const barH = 14;

    ctx.save();

    ctx.fillStyle = 'rgba(18, 28, 20, 0.75)';
    ctx.strokeStyle = 'rgba(82, 196, 26, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(hudX - 8, hudY - 8, barW + 110, 68, 8);
    ctx.fill();
    ctx.stroke();

    // Health Bar
    ctx.fillStyle = '#3a1818';
    ctx.fillRect(hudX + 50, hudY, barW, barH);
    const hpPct = Math.max(0, p.hp / p.maxHp);
    const hpGrad = ctx.createLinearGradient(hudX + 50, 0, hudX + 50 + barW, 0);
    hpGrad.addColorStop(0, '#f5222d');
    hpGrad.addColorStop(1, '#52c41a');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hudX + 50, hudY, barW * hpPct, barH);
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 1;
    ctx.strokeRect(hudX + 50, hudY, barW, barH);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('HP', hudX + 8, hudY + 11);
    ctx.fillText(`${Math.round(p.hp)}/${p.maxHp}`, hudX + barW + 55, hudY + 11);

    // Nitro / Boost Bar
    const nitroY = hudY + 22;
    ctx.fillStyle = '#0f2730';
    ctx.fillRect(hudX + 50, nitroY, barW, barH);

    const nitroPct = p.unlimitedBoost ? 1.0 : Math.max(0, p.nitro / p.maxNitro);
    const nitroGrad = ctx.createLinearGradient(hudX + 50, 0, hudX + 50 + barW, 0);
    nitroGrad.addColorStop(0, '#13c2c2');
    nitroGrad.addColorStop(1, '#4096ff');
    ctx.fillStyle = nitroGrad;
    ctx.fillRect(hudX + 50, nitroY, barW * nitroPct, barH);
    ctx.strokeStyle = '#141414';
    ctx.strokeRect(hudX + 50, nitroY, barW, barH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText('BOOST', hudX + 8, nitroY + 11);
    ctx.fillText(p.unlimitedBoost ? '∞ INF' : `${Math.round(p.nitro)}%`, hudX + barW + 55, nitroY + 11);

    // --- Bottom Right: Weapon & Ammo Card ---
    const w = p.currentWeapon;
    const cardW = 210;
    const cardH = 80;
    const cardX = this.width - cardW - 24;
    const cardY = this.height - cardH - 24;

    ctx.fillStyle = 'rgba(18, 28, 20, 0.85)';
    ctx.strokeStyle = '#faad14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#faad14';
    ctx.fillText(w.name, cardX + 16, cardY + 26);

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = w.currentMag <= 3 ? '#ff4d4f' : '#ffffff';
    ctx.fillText(`${w.currentMag}`, cardX + 16, cardY + 60);

    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#8c8c8c';
    ctx.fillText(`/${w.reserve}`, cardX + 65, cardY + 60);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#52c41a';
    ctx.fillText(`💣 x${p.grenades} [G]`, cardX + 130, cardY + 45);
    ctx.fillStyle = '#8c8c8c';
    ctx.font = '10px monospace';
    ctx.fillText('[Q] Swap  [R] Reload', cardX + 16, cardY + 74);

    // --- Top Center: Match Header (Timer, Room Code, Unlimited Boost Badge) ---
    ctx.textAlign = 'center';

    // Match Timer in Multiplayer
    if (this.gameMode === 'multiplayer' && this.multiplayer.roomSettings) {
      const remaining = Math.max(0, this.multiplayer.roomSettings.timeRemaining);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      // Timer Banner Box
      ctx.fillStyle = 'rgba(14, 22, 16, 0.85)';
      ctx.strokeStyle = remaining < 60 ? '#ff4d4f' : '#52c41a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 140, 12, 280, 52, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = remaining < 60 ? '#ff4d4f' : '#ffec3d';
      ctx.fillText(`⏱️ ${timeStr}`, this.width / 2, 34);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#52c41a';
      ctx.fillText(`ROOM: [${this.multiplayer.roomSettings.roomCode}]`, this.width / 2, 53);

      // Unlimited Boost Indicator
      if (this.multiplayer.roomSettings.unlimitedBoost) {
        ctx.fillStyle = 'rgba(19, 194, 194, 0.2)';
        ctx.strokeStyle = '#13c2c2';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(this.width / 2 - 80, 68, 160, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#13c2c2';
        ctx.fillText('⚡ UNLIMITED BOOST', this.width / 2, 82);
      }
    } else {
      // Single player score
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`KILLS: ${this.kills}   DEATHS: ${this.deaths}`, this.width / 2, 34);
      if (p.unlimitedBoost) {
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#13c2c2';
        ctx.fillText('⚡ UNLIMITED BOOST: ACTIVE', this.width / 2, 54);
      }
    }

    // --- Top Right: Killfeed ---
    ctx.textAlign = 'right';
    let feedY = 160;
    for (const item of this.killFeed) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.7, 1 - item.age / item.lifetime)})`;
      ctx.fillRect(this.width - 320, feedY - 14, 296, 20);

      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, 1 - item.age / item.lifetime)})`;
      ctx.font = '12px monospace';
      ctx.fillText(item.text, this.width - 30, feedY);
      feedY += 24;
    }

    // Respawn Countdown
    if (p.dead) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4d4f';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('YOU WERE KILLED!', this.width / 2, this.height / 2 - 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`Respawning in ${Math.ceil(p.respawnTimer)}s...`, this.width / 2, this.height / 2 + 25);
    }

    ctx.restore();
  }

  renderMinimap() {
    if (!this.miniCtx) return;
    const mCtx = this.miniCtx;
    const mW = this.miniCanvas.width;
    const mH = this.miniCanvas.height;
    const scaleX = mW / this.map.width;
    const scaleY = mH / this.map.height;

    mCtx.clearRect(0, 0, mW, mH);

    mCtx.fillStyle = '#141c16';
    mCtx.fillRect(0, 0, mW, mH);

    mCtx.fillStyle = '#405c45';
    for (const b of this.map.colliders) {
      mCtx.fillRect(b.x * scaleX, b.y * scaleY, Math.max(1, b.w * scaleX), Math.max(1, b.h * scaleY));
    }

    for (const p of this.map.pickups) {
      if (!p.active) continue;
      mCtx.fillStyle = p.type === 'health' ? '#52c41a' : '#faad14';
      mCtx.fillRect(p.x * scaleX - 1.5, p.y * scaleY - 1.5, 3, 3);
    }

    mCtx.fillStyle = '#f5222d';
    for (const b of this.bots) {
      if (!b.dead) {
        mCtx.beginPath();
        mCtx.arc(b.x * scaleX, b.y * scaleY, 2.5, 0, Math.PI * 2);
        mCtx.fill();
      }
    }

    // Remote Players on Minimap (Orange dots)
    mCtx.fillStyle = '#fa8c16';
    for (const r of this.multiplayer.remotePlayers.values()) {
      if (!r.dead) {
        mCtx.beginPath();
        mCtx.arc(r.x * scaleX, r.y * scaleY, 3, 0, Math.PI * 2);
        mCtx.fill();
      }
    }

    // Local Player (Bright Cyan)
    if (this.player && !this.player.dead) {
      mCtx.fillStyle = '#13c2c2';
      mCtx.beginPath();
      mCtx.arc(this.player.x * scaleX, this.player.y * scaleY, 3.5, 0, Math.PI * 2);
      mCtx.fill();
    }
  }

  renderTouchControls() {
    if (!this.touchControls.active) return;
    const ctx = this.ctx;

    const ls = this.touchControls.leftStick;
    if (ls.active) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ls.startX, ls.startY, 60, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(82, 196, 26, 0.45)';
      ctx.beginPath();
      ctx.arc(ls.curX, ls.curY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const rs = this.touchControls.rightStick;
    if (rs.active) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rs.startX, rs.startY, 60, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(245, 34, 45, 0.45)';
      ctx.beginPath();
      ctx.arc(rs.curX, rs.curY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    const dt = Math.min(0.05, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.MiniMilitiaGame = MiniMilitiaGame;
