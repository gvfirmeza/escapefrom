import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { SceneManager } from './SceneManager.js';
import { assetManager } from './AssetManager.js';
import { stateManager, GameState } from './StateManager.js';
import { UIManager } from '../ui/UIManager.js';
import { ProceduralLevel } from '../world/ProceduralLevel.js';
import { PoolRoomsLevel } from '../world/PoolRoomsLevel.js';
import { Player } from '../player/Player.js';
import { Entity } from '../ai/Entity.js';
import { SharkEntity } from '../ai/SharkEntity.js';
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
    this.currentLevelIndex = 1;
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
    
    // Debug Skip Level
    this.player.input.onSkipLevel = () => {
      if (stateManager.getState() === GameState.PLAYING) {
        if (this.currentLevelIndex === 1) {
          this.currentLevelIndex = 2;
          this.uiManager.updateTutorial(true);
          stateManager.setState(GameState.TUTORIAL);
        } else {
          stateManager.setState(GameState.VICTORY);
        }
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
    
    // Playgama Bridge Ad Listeners
    if (window.bridge && window.bridge.advertisement) {
      window.bridge.advertisement.on('interstitial_state_changed', state => {
        if (state === 'opened') {
          if (this.audioManager && this.audioManager.audioContext) {
            this.audioManager.audioContext.suspend();
          }
        } else if (state === 'closed' || state === 'failed') {
          if (this.audioManager && this.audioManager.audioContext && stateManager.getState() !== GameState.PAUSED) {
            this.audioManager.audioContext.resume();
          }
        }
      });
      
      window.bridge.advertisement.on('rewarded_state_changed', state => {
        if (state === 'opened') {
          if (this.audioManager && this.audioManager.audioContext) {
            this.audioManager.audioContext.suspend();
          }
        } else if (state === 'rewarded') {
          this.revivePlayer();
          stateManager.setState(GameState.PLAYING);
        } else if (state === 'closed' || state === 'failed') {
          if (this.audioManager && this.audioManager.audioContext && stateManager.getState() !== GameState.PAUSED) {
            this.audioManager.audioContext.resume();
          }
        }
      });
    }
    
    // Revive Listener fallback (if any other part of UI dispatches it)
    window.addEventListener('revive_player', () => {
      this.revivePlayer();
      stateManager.setState(GameState.PLAYING);
    });
    
    // Start loop
    this.update();
  }

  onStateChange(newState, oldState) {
    if (newState === GameState.TUTORIAL) {
      this.uiManager.updateTutorial(this.currentLevelIndex === 2);
    }

    if (newState === GameState.PLAYING && (oldState === GameState.VICTORY || oldState === GameState.DEFEAT || oldState === GameState.TUTORIAL)) {
      stateManager.setState(GameState.LOADING);
    }
    
    // Trigger ad on natural breakpoints
    if (newState === GameState.VICTORY || newState === GameState.DEFEAT) {
      if (window.bridge && bridge.advertisement) {
        bridge.advertisement.showInterstitial();
      }
    }
    
    if (newState === GameState.LOADING) {
      this.startNewGame();
    }
    
    if (newState === GameState.PLAYING && oldState === GameState.LOADING) {
      if (this.audioManager) this.audioManager.init();
    }
    
    if (newState === GameState.MAIN_MENU) {
      if (this.audioManager && this.audioManager.audioContext) {
        this.audioManager.audioContext.suspend();
        this.audioManager.stopMusic();
      }
    }
    
    if (newState === GameState.PLAYING) {
      this.player.lockPointer();
      // Ensure audio context is running when entering PLAYING state
      if (this.audioManager && this.audioManager.audioContext && this.audioManager.audioContext.state === 'suspended') {
        this.audioManager.audioContext.resume();
      }
    } else {
      this.player.unlockPointer();
    }
    
    // Suspend audio when paused
    if (newState === GameState.PAUSED && this.audioManager && this.audioManager.audioContext) {
      this.audioManager.audioContext.suspend();
    }
  }

  startNewGame(preserveInventory = false) {
    // Clear old scene
    this.sceneManager.clear();
    
    const isLevel2 = this.currentLevelIndex === 2;
    if (isLevel2) {
      this.sceneManager.setupPoolRoomsEnvironment();
    } else {
      this.sceneManager.setupLighting();
    }
    
    this.isJumpscareActive = false;
    
    if (!preserveInventory) {
      this.keysCollected = 0;
    }
    this.totalKeys = 5;
    
    this.uiManager.updateKeys(this.keysCollected, this.totalKeys, isLevel2);
    document.getElementById('find-exit-text').style.display = 'none';
    
    // Defer generation to let the LOADING screen paint on the DOM
    setTimeout(() => {
      this.collisionSystem = new CollisionSystem();
      
      if (isLevel2) {
        this.level = new PoolRoomsLevel(this.collisionSystem, this.sceneManager);
        this.level.generate(30, 30);
      } else {
        this.level = new ProceduralLevel(this.collisionSystem, this.sceneManager);
        this.level.generate(55, 55);
      }
      
      // Setup player
      const spawnPos = this.level.getSpawnPosition();
      this.player.reset(spawnPos);
      this.sceneManager.add(this.player.camera);
      
      // Setup entity
      const entitySpawn = this.level.getRandomEmptyPositionFarFrom(spawnPos, 15);
      if (isLevel2) {
        this.entity = new SharkEntity(this.level, this.collisionSystem);
      } else {
        this.entity = new Entity(this.level, this.collisionSystem);
      }
      this.entity.spawn(entitySpawn);
      this.sceneManager.add(this.entity.mesh);
      
      // Transition to playing
      stateManager.setState(GameState.PLAYING);
    }, 50);
  }

  revivePlayer() {
    this.isJumpscareActive = false;
    
    const img1 = document.getElementById('jumpscare-img-1');
    const img2 = document.getElementById('jumpscare-img-2');
    if (img1) img1.style.display = 'none';
    if (img2) img2.style.display = 'none';

    if (this.entity && this.level) {
      const spawnPos = this.player.camera.position;
      const entitySpawn = this.level.getRandomEmptyPositionFarFrom(spawnPos, 20);
      this.entity.spawn(entitySpawn);
    }
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
      
      if (this.level && this.level.update) {
        this.level.update(delta);
      }
      
      if (this.entity) {
        const playerDir = new THREE.Vector3();
        this.player.camera.getWorldDirection(playerDir);
        this.entity.update(delta, this.player.camera.position, playerDir);
        
        if (this.audioManager) {
          const dist = this.player.camera.position.distanceTo(this.entity.mesh.position);
          
          // STATE.IDLE = 0, STATE.CHASE = 3
          const isMoving = this.entity.state !== 0;
          const isChasing = this.entity.state === 3 || this.entity.state === 1;
          this.audioManager.updateEnemyAudio(delta, isMoving, isChasing, dist, this.currentLevelIndex);
          
          // Music logic
          if (!this.isJumpscareActive) {
            this.audioManager.updateMusic(dist, this.currentLevelIndex);
          }
        }
        
        const dx = this.player.camera.position.x - this.entity.mesh.position.x;
        const dz = this.player.camera.position.z - this.entity.mesh.position.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        
        let triggerDist = this.currentLevelIndex === 2 ? 2.5 : 1.5;
        if (dist2D < triggerDist && !this.isDebugMode && !this.isJumpscareActive) {
          this.triggerJumpscare();
        }
      }
      
      // Check keys collection
      let canInteract = false;
      if (this.level && this.level.keys) {
        for (let i = 0; i < this.level.keys.length; i++) {
          const keyObj = this.level.keys[i];
          if (!keyObj.collected) {
            
            const distToKey = this.player.camera.position.distanceTo(keyObj.position);
            
            if (this.currentLevelIndex === 1) {
              // Level 1 logic (keys float, spin, auto-collect)
              keyObj.mesh.rotation.y += delta;
              keyObj.mesh.position.y = 1.0 + Math.sin(Date.now() * 0.003) * 0.2;
              
              if (distToKey < 2.0) {
                this.collectKey(keyObj);
              }
            } else if (this.currentLevelIndex === 2) {
              // Level 2 logic (valves attached to walls, require E)
              if (keyObj.isAnimating) {
                keyObj.animationTime += delta;
                keyObj.mesh.children[0].rotation.z += delta * 5.0; // Spin wheel
                if (keyObj.animationTime > 1.0) {
                  this.collectKey(keyObj);
                }
              } else if (distToKey < 2.5) {
                const playerDir = new THREE.Vector3();
                this.player.camera.getWorldDirection(playerDir);
                const dirToKey = new THREE.Vector3().subVectors(keyObj.position, this.player.camera.position).normalize();
                
                if (playerDir.dot(dirToKey) > 0.5) {
                  canInteract = true;
                  if (this.player.input.keys.e) {
                    keyObj.isAnimating = true;
                    keyObj.animationTime = 0;
                    this.player.input.keys.e = false; // Prevent holding
                    
                    if (this.audioManager) {
                      this.audioManager.playValveTurn();
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      const promptEl = document.getElementById('interact-prompt');
      if (promptEl) {
        if (canInteract) {
          promptEl.style.display = 'block';
        } else {
          promptEl.style.display = 'none';
        }
      }
      
      // Check win condition (Vault Door)
      if (this.level && this.level.isAtExit(this.player.camera.position)) {
        if (this.keysCollected >= this.totalKeys) {
          if (this.currentLevelIndex === 1) {
            this.currentLevelIndex = 2;
            if (window.bridge) bridge.storage.set('level', 2);
            stateManager.setState(GameState.LOADING);
          } else {
            stateManager.setState(GameState.VICTORY);
          }
        } else {
          // Throttle notification
          if (!this.lastDoorNotify || (Date.now() - this.lastDoorNotify > 3000)) {
            this.lastDoorNotify = Date.now();
            this.uiManager.showMissingKeysNotification(this.totalKeys - this.keysCollected, this.currentLevelIndex === 2);
          }
        }
      }
    }
    
    // Always render unless paused? We can render anyway so the background stays visible
    this.renderer.render(this.sceneManager.scene, this.player.camera);
  }

  collectKey(keyObj) {
    keyObj.collected = true;
    
    if (this.currentLevelIndex === 1) {
      // Move far away to prevent shader recompile stutters
      keyObj.mesh.position.y = -1000; 
    }
    
    // Set light intensity to 0
    keyObj.mesh.children.forEach(c => {
      if (c.isPointLight) c.intensity = 0;
    });
    
    this.keysCollected++;
    this.uiManager.updateKeys(this.keysCollected, this.totalKeys, this.currentLevelIndex === 2);
    
    if (this.entity) {
      // Scale difficulty: up to ~1.75x speed/sight/hearing at 5 keys
      const mult = 1.0 + (this.keysCollected * 0.15);
      this.entity.updateDifficulty(mult);
    }
    
    if (this.keysCollected >= this.totalKeys) {
      document.getElementById('find-exit-text').style.display = 'block';
      if (this.currentLevelIndex === 2 && this.level.drain) {
        this.level.drain();
      }
    }
    
    if (this.audioManager && this.currentLevelIndex === 1) {
      this.audioManager.playKeyPickup();
    }
  }

  triggerJumpscare() {
    this.isJumpscareActive = true;
    
    const jumpscareEnabled = document.getElementById('toggle-jumpscare') ? document.getElementById('toggle-jumpscare').checked : true;
    const jumpscareScreen = document.getElementById('jumpscare-screen');
    const img1 = document.getElementById('jumpscare-img-1');
    const img2 = document.getElementById('jumpscare-img-2');
    
    if (this.currentLevelIndex === 2) {
      if (img1) img1.style.display = 'none';
      if (img2) img2.style.display = 'block';
    } else {
      if (img1) img1.style.display = 'block';
      if (img2) img2.style.display = 'none';
    }
    
    if (jumpscareEnabled) {
      if (jumpscareScreen) jumpscareScreen.classList.remove('safe');
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
    } else {
      // Safe jumpscare
      if (jumpscareScreen) jumpscareScreen.classList.add('safe');
      stateManager.setState(GameState.JUMPSCARE);
      
      if (this.audioManager) {
        this.audioManager.stopMusic();
      }
      
      // Wait a bit longer for the safe fade
      setTimeout(() => {
        if (stateManager.getState() === GameState.JUMPSCARE) {
          stateManager.setState(GameState.DEFEAT);
        }
      }, 3000);
    }
  }
}
