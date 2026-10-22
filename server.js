/**
 * Mini Militia Web Clone - Dedicated Real-Time Multiplayer Server
 * Built with native Node.js HTTP & RFC-6455 WebSocket framing.
 * Supports Custom Rooms, Owner Host Settings, 10/20/30 Min Timers, Unlimited Boost, and Live Match Sync.
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Static file MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Static File HTTP Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      // Enable CORS & WebSocket upgrade headers
      res.writeHead(200, {
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

// Rooms State Storage
// roomId -> { id, name, ownerId, durationMinutes, unlimitedBoost, enableBots, startTime, timeRemaining, matchEnded, clients, scores }
const rooms = new Map();
// clientId -> clientObj
const clients = new Map();

// RFC 6455 WebSocket Upgrade Handler
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + GUID)
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n'
  ];

  socket.write(headers.join('\r\n'));

  const client = {
    id: Math.random().toString(36).substring(2, 10),
    socket: socket,
    room: null,
    playerData: {
      name: 'Soldier',
      camoColor: '#3f5938',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      hp: 100,
      nitro: 100,
      isBoosting: false,
      dead: false,
      weaponId: 'M4'
    }
  };

  clients.set(client.id, client);

  socket.on('data', (buffer) => {
    handleSocketData(client, buffer);
  });

  socket.on('close', () => {
    disconnectClient(client);
  });

  socket.on('error', (err) => {
    disconnectClient(client);
  });
});

function handleSocketData(client, buffer) {
  if (buffer.length < 2) return;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;

  if (opcode === 0x8) {
    disconnectClient(client);
    return;
  }

  if (opcode !== 0x1) {
    return; // Text frames only
  }

  const isMasked = Boolean(secondByte & 0x80);
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(2);
    offset += 2;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset += 8;
  }

  let maskingKey = null;
  if (isMasked) {
    maskingKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  const payload = buffer.subarray(offset, offset + payloadLength);
  if (isMasked && maskingKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskingKey[i % 4];
    }
  }

  try {
    const message = JSON.parse(payload.toString('utf8'));
    processClientMessage(client, message);
  } catch (e) {
    // Ignore malformed packets
  }
}

function sendFrame(client, data) {
  if (!client.socket || client.socket.destroyed) return;
  const jsonStr = JSON.stringify(data);
  const payload = Buffer.from(jsonStr, 'utf8');
  const length = payload.length;

  let header;
  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  try {
    client.socket.write(Buffer.concat([header, payload]));
  } catch (err) {
    // Socket write error
  }
}

function broadcastToRoom(roomId, data, senderClient = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const c of room.clients) {
    if (senderClient && c === senderClient) continue;
    sendFrame(c, data);
  }
}

function processClientMessage(client, msg) {
  const { type, payload } = msg;

  switch (type) {
    case 'create_room':
      handleCreateRoom(client, payload);
      break;

    case 'join_room':
      handleJoinRoom(client, payload);
      break;

    case 'player_input':
      handlePlayerInput(client, payload);
      break;

    case 'player_shoot':
      handlePlayerShoot(client, payload);
      break;

    case 'player_grenade':
      handlePlayerGrenade(client, payload);
      break;

    case 'player_hit':
      handlePlayerHit(client, payload);
      break;

    case 'pickup_taken':
      handlePickupTaken(client, payload);
      break;

    case 'chat_message':
      handleChatMessage(client, payload);
      break;

    case 'restart_match':
      handleRestartMatch(client);
      break;
  }
}

function handleCreateRoom(client, payload) {
  leaveCurrentRoom(client);

  const rawRoomCode = (payload.roomCode || Math.random().toString(36).substring(2, 7)).toUpperCase().trim();
  const roomCode = rawRoomCode.replace(/[^A-Z0-9_-]/g, '').substring(0, 12) || 'ALPHA';
  const duration = Math.min(60, Math.max(1, parseInt(payload.durationMinutes, 10) || 10));
  const unlimitedBoost = Boolean(payload.unlimitedBoost);
  const enableBots = payload.enableBots !== undefined ? Boolean(payload.enableBots) : true;
  const playerName = (payload.playerName || `Host_${client.id.slice(0, 4)}`).trim().substring(0, 16);
  const camoColor = payload.camoColor || '#3f5938';

  client.playerData = {
    id: client.id,
    name: playerName,
    camoColor: camoColor,
    x: 400,
    y: 350,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    hp: 100,
    nitro: 100,
    isBoosting: false,
    dead: false,
    weaponId: 'M4'
  };

  const room = {
    id: roomCode,
    name: roomCode,
    ownerId: client.id,
    durationMinutes: duration,
    unlimitedBoost: unlimitedBoost,
    enableBots: enableBots,
    startTime: Date.now(),
    timeRemaining: duration * 60,
    matchEnded: false,
    clients: new Set([client]),
    scores: new Map([
      [client.id, { id: client.id, name: playerName, kills: 0, deaths: 0 }]
    ])
  };

  rooms.set(roomCode, room);
  client.room = roomCode;

  console.log(`[Room Created] Code: ${roomCode} | Host: ${playerName} | Duration: ${duration}m | UnlimitedBoost: ${unlimitedBoost} | Bots: ${enableBots}`);

  sendFrame(client, {
    type: 'room_created_success',
    payload: {
      roomCode: roomCode,
      isOwner: true,
      durationMinutes: duration,
      unlimitedBoost: unlimitedBoost,
      enableBots: enableBots,
      timeRemaining: room.timeRemaining,
      players: [client.playerData]
    }
  });
}

function handleJoinRoom(client, payload) {
  leaveCurrentRoom(client);

  const roomCode = (payload.roomCode || '').toUpperCase().trim();
  const room = rooms.get(roomCode);

  if (!room) {
    sendFrame(client, {
      type: 'room_error',
      payload: { message: `Room "${roomCode}" not found. Check code or create a new room!` }
    });
    return;
  }

  if (room.clients.size >= 12) {
    sendFrame(client, {
      type: 'room_error',
      payload: { message: `Room "${roomCode}" is currently full (max 12 players).` }
    });
    return;
  }

  const playerName = (payload.playerName || `Soldier_${client.id.slice(0, 4)}`).trim().substring(0, 16);
  const camoColor = payload.camoColor || '#7d3838';

  client.playerData = {
    id: client.id,
    name: playerName,
    camoColor: camoColor,
    x: 500 + (room.clients.size * 100) % 1200,
    y: 350,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    hp: 100,
    nitro: 100,
    isBoosting: false,
    dead: false,
    weaponId: 'M4'
  };

  room.clients.add(client);
  client.room = roomCode;

  if (!room.scores.has(client.id)) {
    room.scores.set(client.id, { id: client.id, name: playerName, kills: 0, deaths: 0 });
  }

  console.log(`[Player Joined] Room: ${roomCode} | Player: ${playerName} (${client.id})`);

  // Inform existing players in room
  broadcastToRoom(roomCode, {
    type: 'player_joined',
    payload: client.playerData
  }, client);

  // Send full room state to newly joined client
  const allPlayers = Array.from(room.clients).map(c => c.playerData);
  const leaderboard = Array.from(room.scores.values());

  sendFrame(client, {
    type: 'room_joined_success',
    payload: {
      roomCode: roomCode,
      isOwner: room.ownerId === client.id,
      durationMinutes: room.durationMinutes,
      unlimitedBoost: room.unlimitedBoost,
      enableBots: room.enableBots,
      timeRemaining: room.timeRemaining,
      matchEnded: room.matchEnded,
      players: allPlayers,
      leaderboard: leaderboard
    }
  });
}

function handlePlayerInput(client, payload) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (!room || room.matchEnded) return;

  Object.assign(client.playerData, payload);

  // Broadcast position & physics to other players in room
  broadcastToRoom(client.room, {
    type: 'player_update',
    payload: client.playerData
  }, client);
}

function handlePlayerShoot(client, payload) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (!room || room.matchEnded) return;

  broadcastToRoom(client.room, {
    type: 'remote_shoot',
    payload: {
      playerId: client.id,
      x: payload.x,
      y: payload.y,
      aimAngle: payload.aimAngle,
      weaponId: payload.weaponId,
      pellets: payload.pellets,
      spread: payload.spread
    }
  }, client);
}

function handlePlayerGrenade(client, payload) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (!room || room.matchEnded) return;

  broadcastToRoom(client.room, {
    type: 'remote_grenade',
    payload: {
      playerId: client.id,
      x: payload.x,
      y: payload.y,
      vx: payload.vx,
      vy: payload.vy
    }
  }, client);
}

function handlePlayerHit(client, payload) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (!room || room.matchEnded) return;

  const targetId = payload.targetId;
  const damage = payload.damage;
  const isHeadshot = Boolean(payload.isHeadshot);
  const weaponName = payload.weaponName || 'Combat';

  const targetClient = Array.from(room.clients).find(c => c.id === targetId);
  if (targetClient && !targetClient.playerData.dead) {
    targetClient.playerData.hp = Math.max(0, targetClient.playerData.hp - damage);

    broadcastToRoom(client.room, {
      type: 'remote_damage',
      payload: {
        targetId: targetId,
        attackerId: client.id,
        hp: targetClient.playerData.hp,
        damage: damage,
        isHeadshot: isHeadshot
      }
    });

    // Check for kill
    if (targetClient.playerData.hp <= 0 && !targetClient.playerData.dead) {
      targetClient.playerData.dead = true;

      // Update scores
      const killerScore = room.scores.get(client.id);
      if (killerScore) killerScore.kills++;

      const victimScore = room.scores.get(targetId);
      if (victimScore) victimScore.deaths++;

      broadcastToRoom(client.room, {
        type: 'remote_kill',
        payload: {
          killerId: client.id,
          killerName: client.playerData.name,
          victimId: targetId,
          victimName: targetClient.playerData.name,
          weapon: weaponName,
          leaderboard: Array.from(room.scores.values())
        }
      });
    }
  }
}

function handlePickupTaken(client, payload) {
  if (!client.room) return;
  broadcastToRoom(client.room, {
    type: 'pickup_sync',
    payload: {
      pickupId: payload.pickupId,
      pickerId: client.id
    }
  }, client);
}

function handleChatMessage(client, payload) {
  if (!client.room) return;
  const text = (payload.text || '').substring(0, 60);
  if (!text) return;

  broadcastToRoom(client.room, {
    type: 'chat_message',
    payload: {
      sender: client.playerData.name,
      text: text
    }
  });
}

function handleRestartMatch(client) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (!room || room.ownerId !== client.id) return; // Only room owner can restart match

  room.matchEnded = false;
  room.startTime = Date.now();
  room.timeRemaining = room.durationMinutes * 60;

  // Reset player stats
  for (const score of room.scores.values()) {
    score.kills = 0;
    score.deaths = 0;
  }

  for (const c of room.clients) {
    c.playerData.hp = 100;
    c.playerData.dead = false;
  }

  console.log(`[Match Restarted] Room: ${room.id} by Host ${client.id}`);

  broadcastToRoom(room.id, {
    type: 'match_restarted',
    payload: {
      timeRemaining: room.timeRemaining,
      leaderboard: Array.from(room.scores.values())
    }
  });
}

function leaveCurrentRoom(client) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (room) {
    room.clients.delete(client);
    room.scores.delete(client.id);

    broadcastToRoom(room.id, {
      type: 'player_left',
      payload: { id: client.id, name: client.playerData.name }
    });

    console.log(`[Player Left] Room: ${room.id} | Player: ${client.playerData.name}`);

    // If host leaves, assign next client or delete room
    if (room.ownerId === client.id) {
      if (room.clients.size > 0) {
        const nextHost = room.clients.values().next().value;
        room.ownerId = nextHost.id;
        sendFrame(nextHost, {
          type: 'promoted_to_host',
          payload: { isOwner: true }
        });
        console.log(`[Host Transferred] Room: ${room.id} -> New Host: ${nextHost.playerData.name}`);
      } else {
        rooms.delete(room.id);
        console.log(`[Room Deleted] Room: ${room.id} is empty`);
      }
    }
  }
  client.room = null;
}

function disconnectClient(client) {
  leaveCurrentRoom(client);
  clients.delete(client.id);
}

// Room Match Timer Loop (1Hz tick)
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.matchEnded || room.clients.size === 0) continue;

    room.timeRemaining--;

    // Broadcast time sync every 5 seconds, or every second when < 10s left
    if (room.timeRemaining % 5 === 0 || room.timeRemaining <= 10) {
      broadcastToRoom(room.id, {
        type: 'match_timer_sync',
        payload: {
          timeRemaining: Math.max(0, room.timeRemaining)
        }
      });
    }

    // Match concluded!
    if (room.timeRemaining <= 0) {
      room.matchEnded = true;
      room.timeRemaining = 0;

      // Determine match MVP
      const sortedLeaderboard = Array.from(room.scores.values()).sort((a, b) => b.kills - a.kills);
      const winner = sortedLeaderboard[0] || null;

      console.log(`[Match Ended] Room: ${room.id} | Winner: ${winner ? winner.name : 'None'}`);

      broadcastToRoom(room.id, {
        type: 'match_game_over',
        payload: {
          winner: winner,
          leaderboard: sortedLeaderboard
        }
      });
    }
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`  MINI MILITIA DEDICATED MULTIPLAYER SERVER (v2.0)              `);
  console.log(`  Local / Network Access: http://localhost:${PORT}             `);
  console.log(`  WebSocket Protocol:     ws://localhost:${PORT}                `);
  console.log(`  Ready for AWS / EC2 / Lightsail Deployment on 0.0.0.0:${PORT}  `);
  console.log(`================================================================`);
});
