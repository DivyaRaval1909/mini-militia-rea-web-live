# Mini Militia (Doodle Army 2) Web Clone

A faithful, browser-based reconstruction of the iconic mobile game **Mini Militia (Doodle Army 2)**, featuring 2D low-gravity physics, jetpack flight, procedural doodle soldier character rigging, an arsenal of weapons (M4, Uzi, Shotgun, Sniper with Laser Sight, RPG, Frag Grenades), smart tactical AI bots, Web Audio procedural sound effects, and a built-in zero-dependency WebSocket multiplayer server.

---

## 1. Architectural Reverse-Engineering Analysis

| Component | Original Mobile Game (DA2) | Web Reconstruction Implementation |
|---|---|---|
| **Game Engine** | Cocos2d-x (C++ compiled to `libcocos2dcpp.so`) | HTML5 Canvas 2D + deterministic 60Hz physics loop |
| **Physics Engine** | Box2D rigid bodies | Low-gravity continuous impulse physics with raycast hit detection and restitution bouncing |
| **Jetpack / Nitro** | Dual thrusters on boots, depletes nitro meter, recharges on ground or cooldown | Vector jetpack impulse ($950\text{ px/s}^2$) with boots particle emitter and automatic recharge |
| **Weapon System** | Semi-auto, auto, burst, pump-shotgun spread, sniper laser sight, ballistic rocket | Fully implemented in `weapons.js` with accurate bullet speeds, recoil, and spread cones |
| **Audio Engine** | FMOD / OpenAL sound clips | 100% procedural Web Audio API synthesizer (`audio.js`) — no external sound files required! |
| **Controls** | Dual virtual joysticks | Desktop (WASD + Mouse aim & shoot) + Mobile touch dual virtual joysticks |
| **Multiplayer** | Photon / UDP sync | Built-in WebSocket server (`server.js`) with room state broadcasting |

---

## 2. Using REA (Reverse Engineer Anything) for APK Inspection

If you have a local copy of a Mini Militia APK (`com.appsomniacs.da2.apk`) or an attached Android phone via ADB:

### Inspecting an Installed App via ADB:
```bash
# 1. Pull the APK directly from your connected device:
npx -y rea-agents@6.7.0 pull-adb-package com.appsomniacs.da2

# 2. Decode the Android Manifest and resources:
npx -y rea-agents@6.7.0 decode-android-resources com.appsomniacs.da2.apk

# 3. Search and explore classes or native shared libraries:
npx -y rea-agents@6.7.0 search-android-classes com.appsomniacs.da2.apk
```

### Inspecting Native Game Libraries:
Mini Militia executes core game physics and networking inside `lib/armeabi-v7a/libcocos2dcpp.so`.
```bash
# Inspect the native library symbols and structure:
npx -y rea-agents@6.7.0 analyze /path/to/extracted/libcocos2dcpp.so
```

---

## 3. How to Play (Instant Web Game & Custom Rooms)

### Option A: Local / Direct Multiplayer Server
Run the built-in dedicated server:
```bash
node server.js
```
Then visit:
- **Game URL**: [http://localhost:8080](http://localhost:8080)
- **Local Network**: Share your local IP (e.g. `http://192.168.1.X:8080`) with friends on the same Wi-Fi so they can join from their phones or laptops!

### Custom Room Features:
1. **Player Nickname & Camo Skin**: Choose from 6 tactical military camo skins and custom soldier callsigns.
2. **Room Owner Settings**:
   - Set match duration: **10 Minutes**, **20 Minutes**, or **30 Minutes** (plus 5-minute quick action).
   - Toggle **⚡ Unlimited Boost / Infinite Jetpack Nitro**.
   - Toggle tactical AI bots filling empty slots.
3. **One-Click Share Link**: Click **"📋 COPY ROOM LINK"** in the top bar to copy a direct invite link with the room code auto-filled.
4. **Live Leaderboard & Match Summary**: When the timer reaches 0, the game displays the match MVP, final scoreboard, and rematch option for the host!

---

## 4. Deploying to AWS (Play Live Worldwide)
Refer to the complete, step-by-step [AWS Deployment Guide](AWS_DEPLOYMENT_GUIDE.md) to launch the server on AWS EC2 or Lightsail with PM2, Nginx, and free SSL!

---

## 4. Tactical Controls

| Control | Action |
|---|---|
| **W** / **Space** / **Up** | Activate Jetpack Thrusters (Flight Boost) |
| **A** / **D** / **Left** / **Right** | Move Soldier Left / Right |
| **Mouse Cursor** | 360° Aiming Reticle |
| **Left Click** | Fire Active Weapon |
| **Right Click** or **[G]** | Throw Frag Grenade |
| **[R]** | Reload Magazine |
| **[Q]** or **[1 / 2]** | Swap Primary / Secondary Weapons |
| **Walk over Crates** | Collect Weapon Caches / Health Kits |
| **Touchscreen** | Dual Virtual Joysticks (Left = Fly/Move, Right = Aim/Shoot) |
