/**
 * Mini Militia Web Clone - Procedural Web Audio Synthesizer
 * Generates all iconic sound effects natively without requiring external audio assets.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.jetpackGain = null;
    this.jetpackFilter = null;
    this.jetpackSource = null;
    this.isJetpackPlaying = false;
    this.muted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.initJetpackSound();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio not supported or blocked", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  // Create noise buffer helper
  createNoiseBuffer(duration = 0.5) {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Jetpack continuous thruster sound
  initJetpackSound() {
    if (!this.ctx) return;
    const noiseBuffer = this.createNoiseBuffer(2.0);
    this.jetpackSource = this.ctx.createBufferSource();
    this.jetpackSource.buffer = noiseBuffer;
    this.jetpackSource.loop = true;

    this.jetpackFilter = this.ctx.createBiquadFilter();
    this.jetpackFilter.type = 'lowpass';
    this.jetpackFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.jetpackFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.jetpackGain = this.ctx.createGain();
    this.jetpackGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.jetpackSource.connect(this.jetpackFilter);
    this.jetpackFilter.connect(this.jetpackGain);
    this.jetpackGain.connect(this.masterGain);

    this.jetpackSource.start(0);
  }

  setJetpackActive(active) {
    if (!this.initialized || !this.jetpackGain || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;
    if (active) {
      this.jetpackGain.gain.setTargetAtTime(0.25, t, 0.04);
      this.jetpackFilter.frequency.setTargetAtTime(550, t, 0.05);
    } else {
      this.jetpackGain.gain.setTargetAtTime(0.0001, t, 0.08);
      this.jetpackFilter.frequency.setTargetAtTime(250, t, 0.08);
    }
  }

  // Semi-auto Pistol
  playPistol() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Transient click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.09);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);

    // Crack noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.12);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.2, t);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.5, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);
  }

  // Rapid SMG / Uzi
  playUzi() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, t);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.35, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);
  }

  // M4 Assault Rifle
  playM4() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Body thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);

    // Muzzle snap
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.14);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, t);
    filter.Q.setValueAtTime(1.8, t);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.65, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);
  }

  // Heavy Shotgun blast
  playShotgun() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Heavy bass impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.28);
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.3);

    // Roaring pellet dispersion noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.28);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.8, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.26);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);

    // Pump action sound after delay
    setTimeout(() => {
      this.playMechanicalClick(0.35, 1200);
      setTimeout(() => this.playMechanicalClick(0.4, 900), 120);
    }, 280);
  }

  // High caliber Sniper crack
  playSniper() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Supersonic crack
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.35);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.9, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);

    // Deep sub-bass echo
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.4);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  // Rocket Launcher whoosh
  playRocketLaunch() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.linearRampToValueAtTime(320, t + 0.22);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.32);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, t);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.5, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);
  }

  // Huge blast explosion (grenade / rocket impact)
  playExplosion(power = 1.0) {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Sub-bass crater drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130 * power, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.55);
    gain.gain.setValueAtTime(0.95, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.65);

    // Rumble and shrapnel noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.7);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 * power, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.9 * power, t);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);
  }

  // Grenade bounce
  playGrenadeBounce() {
    this.playMechanicalClick(0.3, 1400);
  }

  // Mechanical weapon click
  playMechanicalClick(vol = 0.3, freq = 1000) {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.04);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Reload sound
  playReload() {
    this.playMechanicalClick(0.5, 600);
    setTimeout(() => this.playMechanicalClick(0.6, 950), 320);
    setTimeout(() => this.playMechanicalClick(0.5, 1300), 540);
  }

  // Bullet hit flesh / armor
  playHit(isHeadshot = false) {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isHeadshot ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isHeadshot ? 1600 : 380, t);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 600 : 120, t + 0.08);
    gain.gain.setValueAtTime(isHeadshot ? 0.75 : 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Soldier hurt grunt
  playHurt() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.15);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Item pickup
  playPickup() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(660, t + 0.07);
    osc.frequency.setValueAtTime(880, t + 0.14);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  // Kill confirmation chime
  playKillDing() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, t); // High A6
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.36);
  }
}

window.soundEngine = new SoundEngine();
