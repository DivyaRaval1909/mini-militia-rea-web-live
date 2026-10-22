/**
 * Mini Militia Web Clone - Map, Environment & Collision Geometry
 */

class GameMap {
  constructor() {
    this.width = 2400;
    this.height = 1400;
    this.colliders = [];
    this.spawns = [];
    this.pickups = [];
    this.pickupRespawns = [];
    this.initMap();
  }

  initMap() {
    // Boundary borders (floor, ceiling, walls)
    this.addBox(0, 0, this.width, 40, 'boundary'); // Ceiling
    this.addBox(0, this.height - 50, this.width, 50, 'ground'); // Bottom deep floor
    this.addBox(0, 0, 40, this.height, 'boundary'); // Left wall
    this.addBox(this.width - 40, 0, 40, this.height, 'boundary'); // Right wall

    // --- Outpost Arena Architecture ---

    // 1. Central Bunker & High Command Post
    this.addBox(1000, 720, 400, 35, 'metal'); // Central bunker floor
    this.addBox(1000, 520, 30, 200, 'metal'); // Left bunker support wall
    this.addBox(1370, 520, 30, 200, 'metal'); // Right bunker support wall
    this.addBox(1060, 520, 280, 25, 'metal'); // Central roof sniper perch

    // 2. High Floating Islands (Sky perches)
    this.addBox(240, 350, 340, 45, 'rock');
    this.addBox(700, 260, 300, 40, 'rock');
    this.addBox(1400, 260, 300, 40, 'rock');
    this.addBox(1820, 350, 340, 45, 'rock');

    // 3. Mid-tier Tactical Platforms
    this.addBox(160, 680, 280, 40, 'rock');
    this.addBox(560, 800, 320, 40, 'rock');
    this.addBox(1520, 800, 320, 40, 'rock');
    this.addBox(1960, 680, 280, 40, 'rock');

    // 4. Underground Tunnel & Catacomb Chokepoint (lower cavern)
    this.addBox(420, 1080, 600, 45, 'rock'); // Left cavern ceiling
    this.addBox(1380, 1080, 600, 45, 'rock'); // Right cavern ceiling
    this.addBox(1000, 1140, 400, 40, 'metal'); // Sunken bridge across acid/chasm

    // 5. Vertical cover pillars & barriers
    this.addBox(740, 640, 35, 160, 'rock');
    this.addBox(1620, 640, 35, 160, 'rock');

    // Player and Bot Spawn Points
    this.spawns = [
      { x: 300, y: 300 },
      { x: 800, y: 210 },
      { x: 1550, y: 210 },
      { x: 1980, y: 300 },
      { x: 260, y: 630 },
      { x: 1200, y: 470 }, // Bunker roof
      { x: 1200, y: 670 }, // Bunker inside
      { x: 700, y: 750 },
      { x: 1700, y: 750 },
      { x: 600, y: 1030 }, // Underground left
      { x: 1800, y: 1030 }, // Underground right
      { x: 1200, y: 1090 } // Underground center
    ];

    // Weapon and Health Pickups
    this.pickupDefinitions = [
      // Sniper perches
      { x: 850, y: 220, type: 'weapon', weaponId: 'SNIPER' },
      { x: 1550, y: 220, type: 'weapon', weaponId: 'SNIPER' },
      // Bunker heavy arms
      { x: 1200, y: 480, type: 'weapon', weaponId: 'ROCKET' },
      { x: 1200, y: 685, type: 'weapon', weaponId: 'SHOTGUN' },
      // Side battlements
      { x: 380, y: 310, type: 'weapon', weaponId: 'M4' },
      { x: 2020, y: 310, type: 'weapon', weaponId: 'M4' },
      { x: 280, y: 640, type: 'weapon', weaponId: 'UZI' },
      { x: 2120, y: 640, type: 'weapon', weaponId: 'UZI' },
      // Health packs
      { x: 720, y: 760, type: 'health', heal: 60 },
      { x: 1680, y: 760, type: 'health', heal: 60 },
      { x: 1200, y: 1100, type: 'health', heal: 100 },
      { x: 1200, y: 90, type: 'health', heal: 50 }
    ];

    this.spawnAllPickups();
  }

  addBox(x, y, w, h, material = 'rock') {
    this.colliders.push({
      x: x,
      y: y,
      w: w,
      h: h,
      material: material
    });
  }

  spawnAllPickups() {
    this.pickups = [];
    for (const def of this.pickupDefinitions) {
      this.pickups.push({
        ...def,
        id: Math.random().toString(36).substr(2, 9),
        active: true,
        respawnTimer: 0,
        bobOffset: Math.random() * Math.PI * 2
      });
    }
  }

  update(dt) {
    // Update pickup respawns and bobbing
    for (const p of this.pickups) {
      p.bobOffset += dt * 3;
      if (!p.active) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.active = true;
        }
      }
    }
  }

  getValidSpawn() {
    const idx = Math.floor(Math.random() * this.spawns.length);
    return { ...this.spawns[idx] };
  }

  // Raycast against all rectangular colliders
  raycast(x1, y1, x2, y2) {
    let closestHit = null;
    let minDistance = Infinity;

    for (const box of this.colliders) {
      // Ray-box intersection (slab method)
      const hit = this.intersectRayBox(x1, y1, x2, y2, box);
      if (hit && hit.dist < minDistance) {
        minDistance = hit.dist;
        closestHit = hit;
      }
    }

    return closestHit;
  }

  intersectRayBox(x1, y1, x2, y2, box) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let tmin = 0;
    let tmax = 1;
    let normalX = 0;
    let normalY = 0;

    // X axis
    if (Math.abs(dx) > 1e-6) {
      let t1 = (box.x - x1) / dx;
      let t2 = (box.x + box.w - x1) / dx;
      let nx = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        nx = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        normalX = nx;
        normalY = 0;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    } else {
      if (x1 < box.x || x1 > box.x + box.w) return null;
    }

    // Y axis
    if (Math.abs(dy) > 1e-6) {
      let t1 = (box.y - y1) / dy;
      let t2 = (box.y + box.h - y1) / dy;
      let ny = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        ny = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        normalX = 0;
        normalY = ny;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    } else {
      if (y1 < box.y || y1 > box.y + box.h) return null;
    }

    if (tmin >= 0 && tmin <= 1) {
      return {
        x: x1 + dx * tmin,
        y: y1 + dy * tmin,
        normalX: normalX,
        normalY: normalY,
        dist: tmin
      };
    }
    return null;
  }

  // Circle collision test and push-out resolution against all colliders
  circleCollide(cx, cy, radius) {
    let bestResult = null;
    let maxOverlap = 0;

    for (const box of this.colliders) {
      // Nearest point on box to circle center
      const nearestX = Math.max(box.x, Math.min(cx, box.x + box.w));
      const nearestY = Math.max(box.y, Math.min(cy, box.y + box.h));

      const distX = cx - nearestX;
      const distY = cy - nearestY;
      const distSq = distX * distX + distY * distY;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        let normalX = 0;
        let normalY = -1;
        let overlap = radius;

        if (dist > 1e-5) {
          normalX = distX / dist;
          normalY = distY / dist;
          overlap = radius - dist;
        } else {
          // Circle center inside box: find closest edge
          const left = cx - box.x;
          const right = box.x + box.w - cx;
          const top = cy - box.y;
          const bottom = box.y + box.h - cy;
          const minEdge = Math.min(left, right, top, bottom);
          if (minEdge === left) { normalX = -1; normalY = 0; overlap = left + radius; }
          else if (minEdge === right) { normalX = 1; normalY = 0; overlap = right + radius; }
          else if (minEdge === top) { normalX = 0; normalY = -1; overlap = top + radius; }
          else { normalX = 0; normalY = 1; overlap = bottom + radius; }
        }

        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestResult = {
            x: cx + normalX * overlap,
            y: cy + normalY * overlap,
            normalX: normalX,
            normalY: normalY,
            overlap: overlap,
            box: box
          };
        }
      }
    }

    return bestResult;
  }

  draw(ctx, camera) {
    // 1. Draw atmospheric background grid / cave backdrop
    ctx.save();
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#16221c');
    bgGrad.addColorStop(0.4, '#1c2822');
    bgGrad.addColorStop(1, '#0e1410');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle background tactical grid
    ctx.strokeStyle = 'rgba(75, 115, 85, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 100;
    for (let x = 0; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // 2. Draw all solid colliders / platforms
    for (const b of this.colliders) {
      // Visibility cull with camera
      if (
        b.x + b.w < camera.x ||
        b.x > camera.x + camera.w ||
        b.y + b.h < camera.y ||
        b.y > camera.y + camera.h
      ) {
        continue;
      }

      if (b.material === 'rock') {
        // Rock body
        ctx.fillStyle = '#2f3d32';
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // Rocky border bevel
        ctx.strokeStyle = '#1b241c';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        // Lush green grass cap on top edge
        ctx.fillStyle = '#527943';
        ctx.fillRect(b.x, b.y, b.w, 6);

        // Grass blades
        ctx.fillStyle = '#6b9c56';
        for (let gx = b.x + 4; gx < b.x + b.w - 4; gx += 10) {
          ctx.beginPath();
          ctx.moveTo(gx, b.y);
          ctx.lineTo(gx + 3, b.y - 4);
          ctx.lineTo(gx + 6, b.y);
          ctx.fill();
        }

        // Inner rock crag details
        ctx.fillStyle = '#253027';
        for (let rx = b.x + 20; rx < b.x + b.w - 20; rx += 45) {
          ctx.fillRect(rx, b.y + 14, 18, 6);
        }
      } else if (b.material === 'metal') {
        // Industrial bunker metal
        ctx.fillStyle = '#40494d';
        ctx.fillRect(b.x, b.y, b.w, b.h);

        ctx.strokeStyle = '#23292c';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        // Metal hazard yellow/black stripes on bunker roof edge
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.w, 6);
        ctx.clip();
        ctx.fillStyle = '#fadb14';
        ctx.fillRect(b.x, b.y, b.w, 6);
        ctx.fillStyle = '#141414';
        for (let sx = b.x; sx < b.x + b.w; sx += 14) {
          ctx.beginPath();
          ctx.moveTo(sx, b.y);
          ctx.lineTo(sx + 7, b.y);
          ctx.lineTo(sx, b.y + 6);
          ctx.fill();
        }
        ctx.restore();

        // Rivets
        ctx.fillStyle = '#9aa5ab';
        for (let riv = b.x + 12; riv < b.x + b.w - 10; riv += 30) {
          ctx.beginPath();
          ctx.arc(riv, b.y + b.h / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Outer boundary
        ctx.fillStyle = '#151c17';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#2b3a30';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    }

    // 3. Draw Pickups (Guns and Health Packs)
    for (const p of this.pickups) {
      if (!p.active) continue;

      const bobY = p.y + Math.sin(p.bobOffset) * 4;

      if (p.type === 'health') {
        // Glowing health kit box
        ctx.save();
        ctx.translate(p.x, bobY);

        // Shadow under pickup
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 14, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // White box
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(-12, -10, 24, 20);
        ctx.strokeStyle = '#d9d9d9';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-12, -10, 24, 20);

        // Red cross
        ctx.fillStyle = '#ff4d4f';
        ctx.fillRect(-8, -3, 16, 6);
        ctx.fillRect(-3, -8, 6, 16);

        // Glow ring
        ctx.strokeStyle = 'rgba(255, 77, 79, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else if (p.type === 'weapon') {
        // Weapon crate
        ctx.save();
        ctx.translate(p.x, bobY);

        // Crate shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 16, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Metallic ammo crate
        ctx.fillStyle = '#3f4f3c';
        ctx.fillRect(-18, -12, 36, 24);
        ctx.strokeStyle = '#ffc069';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(-18, -12, 36, 24);

        // Weapon label text
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ffec3d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.weaponId, 0, 0);

        // Golden pickup glow
        ctx.strokeStyle = 'rgba(255, 214, 102, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-21, -15, 42, 30);

        ctx.restore();
      }
    }

    ctx.restore();
  }
}

window.GameMap = GameMap;
