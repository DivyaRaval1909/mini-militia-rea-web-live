/**
 * Mini Militia Web Clone - Particle & Visual Effects Engine
 */

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.casings = [];
  }

  reset() {
    this.particles = [];
    this.floatingTexts = [];
    this.casings = [];
  }

  // Jetpack thruster flame
  addJetFire(x, y, vx, vy) {
    const angleOffset = (Math.random() - 0.5) * 0.4;
    const speed = 70 + Math.random() * 80;
    const colors = ['#ff7a45', '#ffa940', '#ffec3d', '#ffffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    this.particles.push({
      type: 'circle',
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: vx + Math.cos(angleOffset) * speed * 0.4,
      vy: vy + Math.sin(angleOffset) * speed * 0.4 + 90,
      radius: 3.5 + Math.random() * 3,
      alpha: 0.9,
      decay: 3.5 + Math.random() * 2,
      color: color
    });
  }

  // Jetpack / Rocket / Explosion Smoke
  addSmoke(x, y, size = 6, color = '#dddddd') {
    this.particles.push({
      type: 'circle',
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 30,
      vy: -20 - Math.random() * 35,
      radius: size,
      growth: 12 + Math.random() * 10,
      alpha: 0.55,
      decay: 0.9 + Math.random() * 0.6,
      color: color
    });
  }

  // Wall impact spark
  addSparks(x, y, count = 5, nx = 0, ny = -1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.6;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        type: 'spark',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 4 + Math.random() * 5,
        alpha: 1.0,
        decay: 3.0 + Math.random() * 2,
        color: Math.random() > 0.4 ? '#fffb8f' : '#ffa940'
      });
    }
  }

  // Blood hit splat
  addBlood(x, y, count = 6, dirX = 0, dirY = 0) {
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 1.5;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        type: 'circle',
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        gravity: 400,
        radius: 2.2 + Math.random() * 2,
        alpha: 0.85,
        decay: 1.6 + Math.random() * 1.2,
        color: Math.random() > 0.3 ? '#cf1322' : '#a8071a'
      });
    }
  }

  // Weapon muzzle flash
  addMuzzleFlash(x, y, angle) {
    this.particles.push({
      type: 'flash',
      x: x,
      y: y,
      angle: angle,
      radius: 12 + Math.random() * 6,
      alpha: 1.0,
      decay: 22,
      color: '#fffb8f'
    });
  }

  // Ejected brass bullet casing
  addCasing(x, y, dir = 1) {
    this.casings.push({
      x: x,
      y: y,
      vx: -dir * (40 + Math.random() * 60),
      vy: -110 - Math.random() * 60,
      vRot: (Math.random() - 0.5) * 20,
      rotation: Math.random() * Math.PI,
      width: 4,
      height: 2,
      restitution: 0.45,
      friction: 0.88,
      age: 0,
      lifetime: 4.0
    });
  }

  // Big grenade / rocket explosion
  addExplosion(x, y, debrisCount = 35, shockRadius = 120) {
    // Shockwave ring
    this.particles.push({
      type: 'shockwave',
      x: x,
      y: y,
      radius: 8,
      maxRadius: shockRadius,
      alpha: 0.9,
      decay: 3.5,
      color: '#ffa940'
    });

    // Fireball core
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      const colors = ['#fff566', '#ff7a45', '#ff4d4f', '#d4380d'];
      this.particles.push({
        type: 'circle',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 12 + Math.random() * 16,
        growth: 8,
        alpha: 0.95,
        decay: 2.2 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    // Heavy flying debris
    for (let i = 0; i < debrisCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 260;
      this.particles.push({
        type: 'debris',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        gravity: 600,
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        decay: 1.2 + Math.random() * 1.2,
        color: Math.random() > 0.5 ? '#434343' : '#8c8c8c'
      });
    }

    // Rising smoke cloud
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        this.addSmoke(
          x + (Math.random() - 0.5) * 35,
          y + (Math.random() - 0.5) * 35,
          16 + Math.random() * 12,
          '#666666'
        );
      }, i * 35);
    }
  }

  // Floating combat text (damage, headshot, kill)
  addFloatingText(x, y, text, color = '#ff4d4f', isBold = false) {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y - 10,
      vy: -45,
      text: text,
      color: color,
      alpha: 1.0,
      age: 0,
      lifetime: 1.1,
      isBold: isBold
    });
  }

  update(dt, map) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.alpha -= p.decay * dt;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.growth) p.radius += p.growth * dt;
      if (p.gravity) p.vy += p.gravity * dt;

      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;

      if (p.type === 'shockwave') {
        p.radius += (p.maxRadius - p.radius) * 14 * dt;
      }
    }

    // Update casings
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.age += dt;
      if (c.age >= c.lifetime) {
        this.casings.splice(i, 1);
        continue;
      }

      c.vy += 650 * dt;
      c.rotation += c.vRot * dt;

      const nextX = c.x + c.vx * dt;
      const nextY = c.y + c.vy * dt;

      const hit = map.circleCollide(nextX, nextY, 2);
      if (hit) {
        c.vy = -c.vy * c.restitution;
        c.vx = c.vx * c.friction;
        c.vRot *= 0.7;
        c.y = hit.y;
        if (Math.abs(c.vy) < 20) c.vy = 0;
      } else {
        c.x = nextX;
        c.y = nextY;
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      if (ft.age >= ft.lifetime) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, 1 - ft.age / ft.lifetime);
    }
  }

  draw(ctx) {
    // Draw bullet casings
    ctx.fillStyle = '#faad14';
    ctx.strokeStyle = '#ad6800';
    ctx.lineWidth = 0.8;
    for (const c of this.casings) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
      ctx.strokeRect(-c.width / 2, -c.height / 2, c.width, c.height);
      ctx.restore();
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      if (p.type === 'circle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else if (p.type === 'flash') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(8, 0, p.radius, p.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'debris') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else if (p.type === 'shockwave') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = ft.isBold ? 'bold 15px monospace' : 'bold 12px monospace';
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

window.ParticleSystem = ParticleSystem;
