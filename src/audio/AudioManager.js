import * as THREE from 'three';

export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    
    // We'll use Web Audio API oscillators to generate sounds procedurally 
    // to avoid needing external audio files for the MVP.
    this.audioContext = this.listener.context;
    
    this.ambientNodes = [];
    this.enemyStepPhase = 0;
    this.playerStepPhase = 0;
    this.isInitialized = false;
  }

  init() {
    // Precompute noise buffer for footsteps
    this.noiseBuffer = this.createNoiseBuffer();
    
    this.loadMusic();
    this.loadKeySound();
    
    this.isInitialized = true;
  }
  
  async loadKeySound() {
    try {
      const response = await fetch('/key.mp3');
      const arrayBuffer = await response.arrayBuffer();
      this.keyBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn("Could not load key.mp3", e);
    }
  }
  
  async loadMusic() {
    try {
      if (this.musicSource) return; // Already loaded
      
      const response = await fetch('/music.mp3');
      const arrayBuffer = await response.arrayBuffer();
      this.musicBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.musicSource = this.audioContext.createBufferSource();
      this.musicSource.buffer = this.musicBuffer;
      this.musicSource.loop = true;
      
      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = 0; // Start silent
      
      this.musicDistortion = this.audioContext.createWaveShaper();
      this.musicDistortion.curve = this.makeDistortionCurve(0);
      
      this.musicSource.connect(this.musicDistortion);
      this.musicDistortion.connect(this.musicGain);
      this.musicGain.connect(this.audioContext.destination);
      
      this.musicSource.start();
    } catch (e) {
      console.warn("Could not load music.mp3", e);
    }
  }

  makeDistortionCurve(amount) {
    if (amount === 0) return null; // No distortion
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  createNoiseBuffer() {
    const bufferSize = this.audioContext.sampleRate * 1; // 1 second
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
    
    this.isInitialized = true;
  }

  createDrone() {
    // Low frequency sine wave with slow LFO for tension
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 50; // Hz
    
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // 1 cycle every 10 seconds
    
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfoGain.gain.value = 0.5;
    
    gain.gain.value = 0.2;
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start();
    lfo.start();
    
    this.ambientNodes.push({ osc, lfo, gain });
  }

  createHum() {
    // Fluorescent hum (120Hz harmonic with noise)
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = 120; 
    
    // Lowpass filter to muffle it
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    gain.gain.value = 0.05;
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start();
    
    this.ambientNodes.push({ osc, gain });
  }

  playFootstep(isEnemy, isRunning, volScale = 1.0, levelIndex = 1) {
    if (!this.isInitialized || !this.noiseBuffer) return;
    
    if (isEnemy && levelIndex === 2) {
      this.playHeavyFootstep(volScale);
      return;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.noiseBuffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    
    if (isEnemy) {
      if (levelIndex === 2) {
        filter.frequency.value = 800; // increased significantly to ensure visibility on all speakers
      } else {
        filter.frequency.value = 150;
      }
    } else {
      filter.frequency.value = 300;
    }
    
    const gain = this.audioContext.createGain();
    const baseVol = isEnemy ? (isRunning ? 1.0 : 0.5) : (isRunning ? 0.3 : 0.15);
    const vol = Math.max(0.01, baseVol * volScale);
    
    // Sharp attack and quick decay for a "step" sound
    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.audioContext.currentTime + 0.01);
    
    if (isEnemy && levelIndex === 2) {
      // longer decay for pool rooms echo
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      source.stop(this.audioContext.currentTime + 0.6);
    } else {
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      source.stop(this.audioContext.currentTime + 0.2);
    }
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);
    
    source.start();
  }

  playHeavyFootstep(volScale) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sine'; // Deep thump
    
    // Pitch envelope (kick drum effect)
    osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.audioContext.currentTime + 0.3);
    
    // Volume envelope
    const vol = Math.max(0.01, 1.5 * volScale);
    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.6);
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.7);
  }

  playClick() {
    if (!this.isInitialized) return;
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.05);
  }

  updateEnemyAudio(delta, isMoving, isChasing, distToEnemy, levelIndex = 1) {
    if (!this.isInitialized) return;
    
    const maxDist = levelIndex === 2 ? 60 : 35;
    
    if (distToEnemy > maxDist) return; // Silent if far away
    
    if (isMoving) {
      const speedMultiplier = isChasing ? 2.5 : 1.2;
      const prevPhase = this.enemyStepPhase;
      this.enemyStepPhase += delta * speedMultiplier * 4;
      
      // Volume scales down as distance approaches maxDist
      let volScale = Math.max(0, 1.0 - (distToEnemy / maxDist));
      
      if (levelIndex === 2) {
         volScale *= 2.0; // Boost volume so it's very clear in phase 2
      }
      
      // Trigger step every time phase crosses an integer
      if (Math.floor(this.enemyStepPhase) > Math.floor(prevPhase)) {
        this.playFootstep(true, isChasing, volScale, levelIndex);
      }
    }
  }
  
  updatePlayerAudio(delta, isMoving, isRunning) {
    if (!this.isInitialized) return;
    
    if (isMoving) {
      // Align frequency roughly with camera bobbing
      const stepFreq = isRunning ? 4.5 : 3.0;
      const prevPhase = this.playerStepPhase;
      this.playerStepPhase += delta * stepFreq;
      
      if (Math.floor(this.playerStepPhase) > Math.floor(prevPhase)) {
        // Player steps are very subtle: pass 0.1 as volScale
        this.playFootstep(false, isRunning, 0.1);
      }
    }
  }

  playKeyPickup() {
    if (!this.isInitialized) return;
    
    if (this.keyBuffer) {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.keyBuffer;
      
      const gain = this.audioContext.createGain();
      gain.gain.value = 1.0;
      
      source.connect(gain);
      gain.connect(this.audioContext.destination);
      source.start();
    } else {
      // Fallback if file not found
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, this.audioContext.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.5);
    }
  }

  playValveTurn() {
    if (!this.isInitialized) return;
    
    // Create a metallic grinding/rusty noise
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.audioContext.currentTime + 1.0);
    
    // Add distortion for rustiness
    const dist = this.audioContext.createWaveShaper();
    dist.curve = this.makeDistortionCurve(400); // Heavy distortion
    
    // Filter out high frequencies
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.0);
    
    osc.connect(dist);
    dist.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 1.0);
  }

  updateMusic(distToEnemy, levelIndex = 1) {
    if (!this.musicGain || !this.musicSource || !this.musicDistortion) return;
    
    if (levelIndex === 2) {
      // Silence music for phase 2
      this.musicGain.gain.setTargetAtTime(0.001, this.audioContext.currentTime, 0.5);
      this.musicDistortion.curve = null;
      return;
    }
    
    // Start playing when closer than 25 units (music range is larger than footstep range)
    const maxDist = 25;
    
    if (distToEnemy > maxDist) {
      // Fade out and slow down if far
      this.musicGain.gain.setTargetAtTime(0.001, this.audioContext.currentTime, 0.5);
      this.musicSource.playbackRate.setTargetAtTime(1.0, this.audioContext.currentTime, 0.5);
      this.musicDistortion.curve = null;
    } else {
      // Scale intensity from 0 (at 15 units) to 1 (at 0 units)
      const intensity = 1.0 - (distToEnemy / maxDist);
      
      // Target volume: exponential curve up to 1.5
      const targetVol = Math.pow(intensity, 2) * 1.5; 
      // Target rate: linear curve up to 1.6x speed
      const targetRate = 1.0 + (intensity * 0.6);
      // Distortion amount: up to 100
      const targetDistortion = intensity * 100;
      
      this.musicGain.gain.setTargetAtTime(targetVol, this.audioContext.currentTime, 0.2);
      this.musicSource.playbackRate.setTargetAtTime(targetRate, this.audioContext.currentTime, 0.2);
      
      // Update distortion curve
      if (targetDistortion > 5) {
        this.musicDistortion.curve = this.makeDistortionCurve(targetDistortion);
      } else {
        this.musicDistortion.curve = null;
      }
    }
  }

  stopMusic() {
    if (this.musicGain) {
      // Instantly mute music on jumpscare
      this.musicGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
  }

  playScream() {
    if (!this.isInitialized) return;
    
    // High pitch noisy scream
    const osc = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 1.0);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(900, this.audioContext.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 1.0);
    
    gain.gain.setValueAtTime(1.0, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.0);
    
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start();
    osc2.start();
    osc.stop(this.audioContext.currentTime + 1.0);
    osc2.stop(this.audioContext.currentTime + 1.0);
  }

  stopAll() {
    for (const node of this.ambientNodes) {
      if (node.osc) node.osc.stop();
      if (node.lfo) node.lfo.stop();
      if (node.gain) node.gain.disconnect();
    }
    this.ambientNodes = [];
    
    this.isInitialized = false;
  }
}
