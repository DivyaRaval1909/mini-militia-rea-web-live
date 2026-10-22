/**
 * Mini Militia Web Clone - Weapons & Ballistics System
 */

const WEAPONS = {
  PISTOL: {
    id: 'PISTOL',
    name: 'Desert Eagle',
    type: 'pistol',
    magSize: 7,
    maxReserve: 35,
    fireDelay: 220, // ms between shots
    reloadTime: 1200, // ms
    damage: 26,
    speed: 1300,
    spread: 0.035,
    recoil: 3,
    color: '#f5c542',
    tracerColor: '#ffe58f',
    pellets: 1,
    length: 22,
    hasLaser: false,
    sound: 'playPistol'
  },
  UZI: {
    id: 'UZI',
    name: 'Micro Uzi',
    type: 'smg',
    magSize: 32,
    maxReserve: 128,
    fireDelay: 85,
    reloadTime: 1400,
    damage: 13,
    speed: 1150,
    spread: 0.085,
    recoil: 2.2,
    color: '#555555',
    tracerColor: '#fff566',
    pellets: 1,
    length: 20,
    hasLaser: false,
    sound: 'playUzi'
  },
  M4: {
    id: 'M4',
    name: 'M4 Carbine',
    type: 'rifle',
    magSize: 30,
    maxReserve: 120,
    fireDelay: 120,
    reloadTime: 1600,
    damage: 21,
    speed: 1400,
    spread: 0.04,
    recoil: 3.5,
    color: '#38423b',
    tracerColor: '#ffe7ba',
    pellets: 1,
    length: 30,
    hasLaser: false,
    sound: 'playM4'
  },
  SHOTGUN: {
    id: 'SHOTGUN',
    name: 'Pump Shotgun',
    type: 'shotgun',
    magSize: 6,
    maxReserve: 24,
    fireDelay: 680,
    reloadTime: 2000,
    damage: 14, // per pellet
    speed: 1050,
    spread: 0.16,
    recoil: 8,
    color: '#8c4b26',
    tracerColor: '#ffbb96',
    pellets: 7,
    length: 32,
    hasLaser: false,
    sound: 'playShotgun'
  },
  SNIPER: {
    id: 'SNIPER',
    name: 'Sniper Rifle',
    type: 'sniper',
    magSize: 5,
    maxReserve: 15,
    fireDelay: 1100,
    reloadTime: 2200,
    damage: 95,
    speed: 2400,
    spread: 0.005,
    recoil: 10,
    color: '#2b3a42',
    tracerColor: '#69c0ff',
    pellets: 1,
    length: 42,
    hasLaser: true,
    sound: 'playSniper'
  },
  ROCKET: {
    id: 'ROCKET',
    name: 'RPG-7',
    type: 'heavy',
    magSize: 1,
    maxReserve: 4,
    fireDelay: 1200,
    reloadTime: 2400,
    damage: 130, // center splash
    speed: 550,
    spread: 0.02,
    recoil: 9,
    color: '#3d4d38',
    tracerColor: '#ff7a45',
    pellets: 1,
    isRocket: true,
    splashRadius: 110,
    length: 36,
    hasLaser: false,
    sound: 'playRocketLaunch'
  }
};

class Projectile {
  constructor(options) {
    this.x = options.x;
    this.y = options.y;
    this.prevX = options.x;
    this.prevY = options.y;
    this.vx = options.vx;
    this.vy = options.vy;
    this.damage = options.damage;
    this.owner = options.owner;
    this.isRocket = !!options.isRocket;
    this.splashRadius = options.splashRadius || 0;
    this.color = options.color || '#fff';
    this.tracerColor = options.tracerColor || '#ffec3d';
    this.lifetime = options.lifetime || (this.isRocket ? 3.5 : 1.2);
    this.age = 0;
    this.dead = false;
    this.smokeTimer = 0;
  }

  update(dt, map, particles, soundEngine) {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.lifetime) {
      if (this.isRocket) {
        this.explode(map, particles, soundEngine);
      }
      this.dead = true;
      return;
    }

    this.prevX = this.x;
    this.prevY = this.y;

    if (this.isRocket) {
      // Rocket accelerates forward and has a little smoke
      const speed = Math.hypot(this.vx, this.vy);
      if (speed < 900) {
        this.vx *= 1 + 1.2 * dt;
        this.vy *= 1 + 1.2 * dt;
      }
      this.smokeTimer += dt;
      if (this.smokeTimer > 0.025) {
        this.smokeTimer = 0;
        particles.addSmoke(this.x - (this.vx / speed) * 12, this.y - (this.vy / speed) * 12, 5, '#cccccc');
        particles.addJetFire(this.x - (this.vx / speed) * 8, this.y - (this.vy / speed) * 8, -this.vx * 0.1, -this.vy * 0.1);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Check collision with map geometry
    const hit = map.raycast(this.prevX, this.prevY, this.x, this.y);
    if (hit) {
      this.x = hit.x;
      this.y = hit.y;
      if (this.isRocket) {
        this.explode(map, particles, soundEngine);
      } else {
        // Bullet hit wall spark
        particles.addSparks(this.x, this.y, 6, hit.normalX, hit.normalY);
      }
      this.dead = true;
    }
  }

  explode(map, particles, soundEngine) {
    soundEngine.playExplosion(1.1);
    particles.addExplosion(this.x, this.y, 45, 120);
    if (window.gameInstance) {
      window.gameInstance.applyRadialDamage(this.x, this.y, this.splashRadius || 110, this.damage, this.owner);
      window.gameInstance.addScreenShake(8);
    }
  }

  draw(ctx) {
    if (this.dead) return;

    if (this.isRocket) {
      const angle = Math.atan2(this.vy, this.vx);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      // Rocket body
      ctx.fillStyle = '#445544';
      ctx.fillRect(-12, -3, 18, 6);
      // Warhead
      ctx.fillStyle = '#aa3322';
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.lineTo(12, 0);
      ctx.lineTo(6, 3);
      ctx.fill();
      // Fins
      ctx.fillStyle = '#222222';
      ctx.fillRect(-12, -6, 4, 3);
      ctx.fillRect(-12, 3, 4, 3);

      ctx.restore();
    } else {
      // High-speed glowing bullet tracer
      ctx.save();
      ctx.strokeStyle = this.tracerColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();

      // Bright white core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(this.prevX + (this.x - this.prevX) * 0.4, this.prevY + (this.y - this.prevY) * 0.4);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

class Grenade {
  constructor(options) {
    this.x = options.x;
    this.y = options.y;
    this.vx = options.vx;
    this.vy = options.vy;
    this.owner = options.owner;
    this.fuse = 2.4; // 2.4s fuse
    this.radius = 6;
    this.restitution = 0.55;
    this.friction = 0.94;
    this.rotation = 0;
    this.vRot = (Math.random() - 0.5) * 14;
    this.dead = false;
    this.flashTimer = 0;
    this.isFlashing = false;
  }

  update(dt, map, particles, soundEngine) {
    if (this.dead) return;
    this.fuse -= dt;
    this.rotation += this.vRot * dt;

    // Flash blink accelerates as fuse runs out
    this.flashTimer += dt;
    const blinkInterval = Math.max(0.08, this.fuse * 0.15);
    if (this.flashTimer >= blinkInterval) {
      this.flashTimer = 0;
      this.isFlashing = !this.isFlashing;
    }

    if (this.fuse <= 0) {
      this.explode(particles, soundEngine);
      this.dead = true;
      return;
    }

    // Apply gravity
    this.vy += 650 * dt;

    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // Collision with map
    const hit = map.circleCollide(nextX, nextY, this.radius);
    if (hit) {
      // Bounce along hit normal
      const dot = this.vx * hit.normalX + this.vy * hit.normalY;
      this.vx = (this.vx - 2 * dot * hit.normalX) * this.restitution;
      this.vy = (this.vy - 2 * dot * hit.normalY) * this.restitution;
      this.vx *= this.friction;

      // Position pushout
      this.x = hit.x;
      this.y = hit.y;

      if (Math.hypot(this.vx, this.vy) > 35) {
        soundEngine.playGrenadeBounce();
      }
    } else {
      this.x = nextX;
      this.y = nextY;
    }
  }

  explode(particles, soundEngine) {
    soundEngine.playExplosion(1.2);
    particles.addExplosion(this.x, this.y, 50, 140);
    if (window.gameInstance) {
      window.gameInstance.applyRadialDamage(this.x, this.y, 130, 125, this.owner);
      window.gameInstance.addScreenShake(10);
    }
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Grenade body (olive green with grooves)
    ctx.fillStyle = this.isFlashing ? '#ff4d4f' : '#3d5236';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d2a1a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Spoon / top pin
    ctx.fillStyle = '#8c8c8c';
    ctx.fillRect(-2, -this.radius - 3, 4, 3);

    // Flashing LED pin
    if (this.isFlashing) {
      ctx.fillStyle = '#ff7875';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

window.WEAPONS = WEAPONS;
window.Projectile = Projectile;
window.Grenade = Grenade;
