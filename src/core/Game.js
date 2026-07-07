import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { SceneManager } from './SceneManager.js';
import { assetManager } from './AssetManager.js';
import { stateManager, GameState } from './StateManager.js';
import { UIManager } from '../ui/UIManager.js';
import { ProceduralLevel } from '../world/ProceduralLevel.js';
import { Player } from '../player/Player.js';
import { Entity } from '../ai/Entity.js';
import { CollisionSystem } from '../world/CollisionSystem.js';
import { AudioManager } from '../audio/AudioManager.js';

export class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.renderer = new Renderer(this.container);
    this.sceneManager = new SceneManager();
    this.uiManager = new UIManager();
    
    this.clock = new THREE.Clock();
    this.animationFrameId = null;
    
    // Core gameplay components
    this.level = null;
    this.collisionSystem = null;
    this.player = null;
    this.entity = null;
    this.isDebugMode = false;
    this.isJumpscareActive = false;

    // Bind loop
    this.update = this.update.bind(this);
    
    // Listen to state changes
    stateManager.addListener(this.onStateChange.bind(this));
  }

  async init() {
    assetManager.init();
    await assetManager.loadModels();
    
    // Create player
    this.player = new Player(this.container);
    this.sceneManager.add(this.player.camera);
    // SpotLight is attached to camera inside Player
    
    // Debug Mode Toggle
    this.player.input.onDebugToggle = () => {
      this.isDebugMode = !this.isDebugMode;
      this.player.movement.setDebugMode(this.isDebugMode);
      this.sceneManager.setDebugMode(this.isDebugMode);
    };
    
    // Debug Jumpscare Toggle
    this.player.input.onDebugJumpscare = () => {
      if (!this.isJumpscareActive && stateManager.getState() === GameState.PLAYING) {
        this.triggerJumpscare();
      }
    };
    
    // Auto-pause when losing focus
    this.player.input.onUnlock = () => {
      if (stateManager.getState() === GameState.PLAYING) {
        stateManager.setState(GameState.PAUSED);
      }
    };
    
    // Audio
    this.audioManager = new AudioManager(this.player.camera);
    
    // Start loop
    this.update();
  }

  onStateChange(newState, oldState) {
    if (newState === GameState.TUTORIAL && oldState === GameState.MAIN_MENU) {
      this.startNewGame();
    }
    
    if (newState === GameState.PLAYING && (oldState === GameState.VICTORY || oldState === GameState.DEFEAT)) {
      this.startNewGame();
      if (this.audioManager) this.audioManager.init();
    } else if (newState === GameState.PLAYING && oldState === GameState.TUTORIAL) {
      if (this.audioManager) this.audioManager.init();
    }
    
    if (newState === GameState.PLAYING) {
      this.player.lockPointer();
    } else {
      this.player.unlockPointer();
    }
    
    // Suspend audio when paused
    if (newState === GameState.PAUSED && this.audioManager && this.audioManager.audioContext) {
      this.audioManager.audioContext.suspend();
    } else if (oldState === GameState.PAUSED && newState === GameState.PLAYING && this.audioManager && this.audioManager.audioContext) {
      this.audioManager.audioContext.resume();
    }
  }

  startNewGame() {
    // Clear old scene
    this.sceneManager.clear();
    this.sceneManager.setupLighting();
    this.isJumpscareActive = false;
    this.keysCollected = 0;
    this.totalKeys = 5;
    this.uiManager.updateKeys(this.keysCollected, this.totalKeys);
    
    // Generate new level
    this.collisionSystem = new CollisionSystem();
    this.level = new ProceduralLevel(this.collisionSystem, this.sceneManager);
    this.level.generate(55, 55); // Increased map size
    // Setup player
    const spawnPos = this.level.getSpawnPosition();
    this.player.reset(spawnPos);
    this.sceneManager.add(this.player.camera);
    
    // Setup entity
    this.entity = new Entity(this.level, this.collisionSystem);
    const entitySpawn = this.level.getRandomEmptyPositionFarFrom(spawnPos, 15);
    this.entity.spawn(entitySpawn);
    this.sceneManager.add(this.entity.mesh);
  }

  update() {
    this.animationFrameId = requestAnimationFrame(this.update);
    const delta = Math.min(this.clock.getDelta(), 0.1); // Cap delta to prevent huge jumps
    
    const currentState = stateManager.getState();
    
    if (currentState === GameState.PLAYING) {
      this.player.update(delta, this.collisionSystem);
      
      if (this.audioManager) {
        const isPlayerMoving = this.player.movement.velocity.lengthSq() > 0.1;
        const isPlayerRunning = this.player.movement.velocity.lengthSq() > 25;
        this.audioManager.updatePlayerAudio(delta, isPlayerMoving, isPlayerRunning);
      }
      
      if (this.entity) {
        this.entity.update(delta, this.player.camera.position);
        
        if (this.audioManager) {
          const dist = this.player.camera.position.distanceTo(this.entity.mesh.position);
          
          // STATE.IDLE = 0, STATE.CHASE = 3
          const isMoving = this.entity.state !== 0;
          const isChasing = this.entity.state === 3;
          this.audioManager.updateEnemyAudio(delta, isMoving, isChasing, dist);
          
          // Music logic
          if (!this.isJumpscareActive) {
            this.audioManager.updateMusic(dist);
          }
        }
        
        // Check defeat condition (jumpscare logic) using 2D distance on XZ plane
        const dx = this.player.camera.position.x - this.entity.mesh.position.x;
        const dz = this.player.camera.position.z - this.entity.mesh.position.z;
        const distSq = dx*dx + dz*dz;
        
        // distSq < 3.0 means distance < ~1.73 units on the horizontal plane
        if (distSq < 3.0 && !this.isDebugMode && !this.isJumpscareActive) {
          this.triggerJumpscare();
        }
      }
      
      // Check keys collection
      if (this.level && this.level.keys) {
        for (let i = 0; i < this.level.keys.length; i++) {
          const keyObj = this.level.keys[i];
          if (!keyObj.collected) {
            keyObj.mesh.rotation.y += delta; // Rotate key
            keyObj.mesh.position.y = 1.0 + Math.sin(Date.now() * 0.003) * 0.2; // Float
            
            const distToKey = this.player.camera.position.distanceTo(keyObj.position);
            if (distToKey < 2.0) {
              keyObj.collected = true;
              
              // Move far away to prevent shader recompile stutters
              keyObj.mesh.position.y = -1000; 
              
              // Set light intensity to 0
              keyObj.mesh.children.forEach(c => {
                if (c.isPointLight) c.intensity = 0;
              });
              
              this.keysCollected++;
              this.uiManager.updateKeys(this.keysCollected, this.totalKeys);
              if (this.audioManager) {
                this.audioManager.playKeyPickup();
              }
            }
          }
        }
      }
      
      // Check win condition (Vault Door)
      if (this.level && this.level.isAtExit(this.player.camera.position)) {
        if (this.keysCollected >= this.totalKeys) {
          stateManager.setState(GameState.VICTORY);
        } else {
          // Throttle notification
          if (!this.lastDoorNotify || (Date.now() - this.lastDoorNotify > 3000)) {
            this.lastDoorNotify = Date.now();
            this.uiManager.showMissingKeysNotification(this.totalKeys - this.keysCollected);
          }
        }
      }
    }
    
    // Always render unless paused? We can render anyway so the background stays visible
    this.renderer.render(this.sceneManager.scene, this.player.camera);
  }

  triggerJumpscare() {
    this.isJumpscareActive = true;
    stateManager.setState(GameState.JUMPSCARE);
    
    if (this.audioManager) {
      this.audioManager.stopMusic();
      this.audioManager.playScream();
    }

    setTimeout(() => {
      if (stateManager.getState() === GameState.JUMPSCARE) {
        stateManager.setState(GameState.DEFEAT);
      }
    }, 1200);
  }
}
