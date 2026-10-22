/**
 * Mini Militia Web Clone - Real-Time Multiplayer Networking Client
 * Handles custom room creation, room join, host settings, live match synchronization, and AWS deployment compatibility.
 */

class MultiplayerManager {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.connected = false;
    this.currentRoom = null;
    this.isOwner = false;
    this.playerId = null;
    this.remotePlayers = new Map(); // id -> Soldier instance

    // Automatic server discovery: Works seamlessly on Localhost, LAN, and AWS EC2 / Lightsail / Domain!
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8080';
    this.serverUrl = `${protocol}//${host}`;

    this.sendInterval = 1 / 30; // 30Hz network sync rate
    this.sendTimer = 0;
    this.roomSettings = {
      roomCode: '',
      durationMinutes: 10,
      unlimitedBoost: false,
      enableBots: true,
      timeRemaining: 600,
      matchEnded: false
    };

    this.onRoomErrorCallback = null;
    this.onRoomSuccessCallback = null;
  }

  connect(callback) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (callback) callback(true);
      return;
    }

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[Multiplayer] Connected to game server:', this.serverUrl);
        this.connected = true;
        if (callback) callback(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          this.handleMessage(packet);
        } catch (e) {
          console.error('[Multiplayer] Malformed message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[Multiplayer] Disconnected from game server.');
        this.connected = false;
        if (callback) callback(false);
      };

      this.ws.onerror = (err) => {
        console.warn('[Multiplayer] Connection failed:', err);
        this.connected = false;
        if (callback) callback(false);
      };
    } catch (e) {
      console.warn('[Multiplayer] Error creating WebSocket:', e);
      if (callback) callback(false);
    }
  }

  send(type, payload) {
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  createRoom(settings, onResult) {
    this.connect((success) => {
      if (!success) {
        if (onResult) onResult(false, 'Unable to connect to game server. Is server running?');
        return;
      }

      this.onRoomSuccessCallback = onResult;
      this.send('create_room', {
        roomCode: settings.roomCode,
        durationMinutes: settings.durationMinutes,
        unlimitedBoost: settings.unlimitedBoost,
        enableBots: settings.enableBots,
        playerName: settings.playerName,
        camoColor: settings.camoColor
      });
    });
  }

  joinRoom(settings, onResult) {
    this.connect((success) => {
      if (!success) {
        if (onResult) onResult(false, 'Unable to connect to game server. Is server running?');
        return;
      }

      this.onRoomSuccessCallback = onResult;
      this.send('join_room', {
        roomCode: settings.roomCode,
        playerName: settings.playerName,
        camoColor: settings.camoColor
      });
    });
  }

  restartMatch() {
    this.send('restart_match', {});
  }

  handleMessage(packet) {
    const { type, payload } = packet;

    switch (type) {
      case 'room_created_success':
      case 'room_joined_success':
        this.handleRoomJoined(payload);
        break;

      case 'room_error':
        if (this.onRoomSuccessCallback) {
          this.onRoomSuccessCallback(false, payload.message);
          this.onRoomSuccessCallback = null;
        }
        alert(payload.message || 'Room error');
        break;

      case 'player_joined':
        this.handleRemotePlayerJoined(payload);
        break;

      case 'player_left':
        this.handleRemotePlayerLeft(payload);
        break;

      case 'promoted_to_host':
        this.isOwner = true;
        this.game.addKillFeedEntry('SYSTEM', 'You are now the Room Host!', '');
        break;

      case 'player_update':
        this.handleRemotePlayerUpdate(payload);
        break;

      case 'remote_shoot':
        this.handleRemoteShoot(payload);
        break;

      case 'remote_grenade':
        this.handleRemoteGrenade(payload);
        break;

      case 'remote_damage':
        this.handleRemoteDamage(payload);
        break;

      case 'remote_kill':
        this.handleRemoteKill(payload);
        break;

      case 'pickup_sync':
        this.handlePickupSync(payload);
        break;

      case 'match_timer_sync':
        this.roomSettings.timeRemaining = payload.timeRemaining;
        break;

      case 'match_game_over':
        this.handleGameOver(payload);
        break;

      case 'match_restarted':
        this.handleMatchRestarted(payload);
        break;

      case 'chat_message':
        this.game.addKillFeedEntry(payload.sender, payload.text, '');
        break;
    }
  }

  handleRoomJoined(payload) {
    this.currentRoom = payload.roomCode;
    this.isOwner = payload.isOwner;
    this.roomSettings = {
      roomCode: payload.roomCode,
      durationMinutes: payload.durationMinutes,
      unlimitedBoost: payload.unlimitedBoost,
      enableBots: payload.enableBots,
      timeRemaining: payload.timeRemaining,
      matchEnded: Boolean(payload.matchEnded)
    };

    // Apply unlimited boost setting to local player
    if (this.game.player) {
      this.game.player.unlimitedBoost = this.roomSettings.unlimitedBoost;
      if (this.roomSettings.unlimitedBoost) {
        this.game.player.nitro = this.game.player.maxNitro;
      }
    }

    // Populate remote players
    this.remotePlayers.clear();
    for (const p of payload.players) {
      if (this.game.player && p.id !== this.game.player.id) {
        this.createRemotePlayer(p);
      }
    }

    if (this.onRoomSuccessCallback) {
      this.onRoomSuccessCallback(true, this.roomSettings);
      this.onRoomSuccessCallback = null;
    }

    this.game.addKillFeedEntry('SYSTEM', `Entered Room [${payload.roomCode}]`, '');
  }

  createRemotePlayer(data) {
    const remote = new Soldier({
      id: data.id,
      name: data.name,
      x: data.x,
      y: data.y,
      camoColor: data.camoColor,
      unlimitedBoost: this.roomSettings.unlimitedBoost,
      isBot: false
    });
    remote.targetX = data.x;
    remote.targetY = data.y;
    this.remotePlayers.set(data.id, remote);
    return remote;
  }

  handleRemotePlayerJoined(data) {
    this.createRemotePlayer(data);
    this.game.addKillFeedEntry(data.name, 'joined the room!', '');
  }

  handleRemotePlayerLeft(data) {
    this.remotePlayers.delete(data.id);
    this.game.addKillFeedEntry(data.name || 'Player', 'left the room.', '');
  }

  handleRemotePlayerUpdate(data) {
    let remote = this.remotePlayers.get(data.id);
    if (!remote) {
      remote = this.createRemotePlayer(data);
    }

    // Set interpolation targets
    remote.targetX = data.x;
    remote.targetY = data.y;
    remote.vx = data.vx;
    remote.vy = data.vy;
    remote.aimAngle = data.aimAngle;
    remote.hp = data.hp;
    remote.nitro = data.nitro;
    remote.isBoosting = data.isBoosting;
    remote.dead = data.dead;

    if (data.weaponId && remote.currentWeapon.id !== data.weaponId && WEAPONS[data.weaponId]) {
      remote.equipWeapon(WEAPONS[data.weaponId]);
    }
  }

  handleRemoteShoot(data) {
    const remote = this.remotePlayers.get(data.playerId);
    if (!remote) return;

    remote.aimAngle = data.aimAngle;
    const w = WEAPONS[data.weaponId] || remote.currentWeapon;

    // Trigger visual muzzle flash & sound
    this.game.particles.addMuzzleFlash(data.x, data.y, data.aimAngle);
    if (window.soundEngine && window.soundEngine[w.sound]) {
      window.soundEngine[w.sound]();
    }

    // Spawn visual projectiles
    for (let i = 0; i < (data.pellets || 1); i++) {
      const spreadAngle = data.aimAngle + (Math.random() - 0.5) * (data.spread || 0.04);
      const vx = Math.cos(spreadAngle) * w.speed;
      const vy = Math.sin(spreadAngle) * w.speed;

      const proj = new Projectile({
        x: data.x,
        y: data.y,
        vx: vx,
        vy: vy,
        damage: w.damage,
        owner: remote,
        isRocket: !!w.isRocket,
        splashRadius: w.splashRadius,
        color: w.color,
        tracerColor: w.tracerColor
      });

      this.game.addProjectile(proj);
    }
  }

  handleRemoteGrenade(data) {
    const remote = this.remotePlayers.get(data.playerId);
    const grenade = new Grenade({
      x: data.x,
      y: data.y,
      vx: data.vx,
      vy: data.vy,
      owner: remote || null
    });
    this.game.addGrenade(grenade);
  }

  handleRemoteDamage(data) {
    const target = data.targetId === this.game.player.id ? this.game.player : this.remotePlayers.get(data.targetId);
    if (target) {
      target.hp = data.hp;
      if (data.isHeadshot) {
        this.game.particles.addFloatingText(target.x, target.y - 20, `HEADSHOT! -${Math.round(data.damage)}`, '#ffec3d', true);
      } else {
        this.game.particles.addFloatingText(target.x, target.y - 20, `-${Math.round(data.damage)}`, '#ff4d4f');
      }
      this.game.particles.addBlood(target.x, target.y, 6, 0, -1);
    }
  }

  handleRemoteKill(data) {
    this.game.addKillFeedEntry(data.killerName, data.victimName, data.weapon);
    if (data.killerId === this.game.player.id) {
      this.game.kills++;
      this.game.streak++;
      window.soundEngine.playKillDing();
    }
  }

  handlePickupSync(data) {
    const pickup = this.game.map.pickups.find(p => p.id === data.pickupId);
    if (pickup) {
      pickup.active = false;
      pickup.respawnTimer = 20;
    }
  }

  handleGameOver(data) {
    this.roomSettings.matchEnded = true;
    this.game.showGameOverScreen(data.winner, data.leaderboard);
  }

  handleMatchRestarted(data) {
    this.roomSettings.matchEnded = false;
    this.roomSettings.timeRemaining = data.timeRemaining;
    this.game.hideGameOverScreen();
    this.game.respawnAll();
    this.game.addKillFeedEntry('SYSTEM', 'Round Restarted! FIGHT!', '');
  }

  update(dt) {
    if (!this.connected || !this.currentRoom) return;

    // Interpolate remote players
    for (const remote of this.remotePlayers.values()) {
      if (remote.targetX !== undefined) {
        remote.x += (remote.targetX - remote.x) * 14 * dt;
        remote.y += (remote.targetY - remote.y) * 14 * dt;
      }
      remote.updateBoots(dt);
    }

    // Send local player state to server at 30Hz
    this.sendTimer += dt;
    if (this.sendTimer >= this.sendInterval) {
      this.sendTimer = 0;
      const p = this.game.player;
      if (!p) return;

      this.send('player_input', {
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.vx * 10) / 10,
        vy: Math.round(p.vy * 10) / 10,
        aimAngle: Math.round(p.aimAngle * 100) / 100,
        hp: Math.round(p.hp),
        nitro: Math.round(p.nitro),
        isBoosting: p.isBoosting,
        dead: p.dead,
        weaponId: p.currentWeapon.id
      });
    }
  }
}

window.MultiplayerManager = MultiplayerManager;
