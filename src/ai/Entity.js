import * as THREE from 'three';
import { Pathfinding } from './Pathfinding.js';
import { assetManager } from '../core/AssetManager.js';

const STATE = {
  IDLE: 0,
  PATROL: 1,
  INVESTIGATE: 2,
  CHASE: 3
};

export class Entity {
  constructor(level, collisionSystem) {
    this.level = level;
    this.collisionSystem = collisionSystem;
    this.pathfinding = new Pathfinding(level.grid);
    
    const loadedModel = assetManager.getModel('enemy');
    this.isProcedural = !loadedModel;
    
    if (loadedModel) {
      this.mesh = loadedModel;
      // Adjust scale to 0.2
      this.mesh.scale.set(0.2, 0.2, 0.2); 
      this.mesh.position.y = 0;
      
      if (this.mesh.animations && this.mesh.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.mesh);
        // Play the first animation (usually the dance or run)
        const action = this.mixer.clipAction(this.mesh.animations[0]);
        action.play();
      }
    } else {
      // Custom procedural geometry (Slenderman style)
      this.mesh = new THREE.Group();
      
      const mat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 1.0,
        metalness: 0.0,
      });
      
      // Torso
      this.torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 1.2, 8), mat);
      this.torso.position.y = 1.6;
      this.torso.castShadow = true;
      
      // Head
      this.head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat);
      this.head.position.y = 0.7;
      this.torso.add(this.head);
      
      // Limbs
      const limbGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
      limbGeo.translate(0, -0.5, 0); // Shift pivot to top
      
      this.leftArm = new THREE.Mesh(limbGeo, mat);
      this.leftArm.position.set(-0.25, 0.5, 0);
      this.torso.add(this.leftArm);
      
      this.rightArm = new THREE.Mesh(limbGeo, mat);
      this.rightArm.position.set(0.25, 0.5, 0);
      this.torso.add(this.rightArm);
      
      this.leftLeg = new THREE.Mesh(limbGeo, mat);
      this.leftLeg.position.set(-0.1, -0.6, 0);
      this.torso.add(this.leftLeg);
      
      this.rightLeg = new THREE.Mesh(limbGeo, mat);
      this.rightLeg.position.set(0.1, -0.6, 0);
      this.torso.add(this.rightLeg);
      
      this.mesh.add(this.torso);
    }
    
    this.walkCycle = 0;
    
    // State
    this.state = STATE.IDLE;
    this.stateTimer = 0;
    
    // Movement
    this.speed = 2.0; // Base speed
    this.chaseSpeed = 5.5; // Faster than walk, slower than run
    this.path = null;
    this.pathIndex = 0;
    
    this.lastKnownPlayerPos = new THREE.Vector3();
    
    // Perception constants
    this.sightRange = 15;
    this.hearingRange = 15; // Distance to hear player running/walking
    
    // Difficulty
    this.difficultyMultiplier = 1.0;
  }

  updateDifficulty(multiplier) {
    this.difficultyMultiplier = multiplier;
    this.sightRange = 15 * multiplier;
    this.hearingRange = 15 * multiplier;
    
    if (this.state === STATE.CHASE) {
      this.speed = this.chaseSpeed * this.difficultyMultiplier;
    } else if (this.state === STATE.PATROL) {
      this.speed = 2.0 * this.difficultyMultiplier;
    } else if (this.state === STATE.INVESTIGATE) {
      this.speed = 4.0 * this.difficultyMultiplier;
    }
  }

  spawn(position) {
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.0; // Floor level
    this.setState(STATE.PATROL);
  }

  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
    
    if (this.state === STATE.PATROL) {
      this.speed = 2.0 * this.difficultyMultiplier;
      this.generatePatrolPath();
    } else if (this.state === STATE.CHASE) {
      this.speed = this.chaseSpeed * this.difficultyMultiplier;
    } else if (this.state === STATE.INVESTIGATE) {
      this.speed = 4.0 * this.difficultyMultiplier;
    }
  }

  generatePatrolPath() {
    // Pick random empty spot relatively close to last known player pos
    // If no last known pos, pick random
    let center = (this.lastKnownPlayerPos.lengthSq() > 0) ? this.lastKnownPlayerPos : this.mesh.position;
    
    const target = this.level.getRandomEmptyPositionFarFrom(center, 5);
    // Let's bias it closer to the player by trying a few times and picking the closest one to center
    let bestTarget = target;
    let minDist = target.distanceTo(center);
    for (let i=0; i<3; i++) {
      let t = this.level.getRandomEmptyPositionFarFrom(center, 5);
      let d = t.distanceTo(center);
      if (d < minDist) {
        minDist = d;
        bestTarget = t;
      }
    }

    this.path = this.pathfinding.findPath(
      this.mesh.position.x, this.mesh.position.z,
      bestTarget.x, bestTarget.z,
      this.level.tileSize
    );
    this.pathIndex = 0;
    
    if (!this.path || this.path.length === 0) {
      this.setState(STATE.IDLE);
      this.stateTimer = 2; // Wait 2 seconds before trying again
    }
  }

  update(delta, playerPos) {
    this.stateTimer += delta;
    
    const currentSpeed = (this.state === STATE.IDLE) ? 0 : this.speed;
    
    if (this.isProcedural) {
      // Animate Limbs
      this.walkCycle += delta * currentSpeed * 2.5;
      
      const armSwing = Math.sin(this.walkCycle) * 0.5;
      const legSwing = Math.sin(this.walkCycle) * 0.6;
      
      this.leftArm.rotation.x = -armSwing;
      this.rightArm.rotation.x = armSwing;
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      
      // Slight torso bob
      this.torso.position.y = 1.6 + Math.abs(Math.sin(this.walkCycle)) * 0.05;
    } else {
      // Animate GLTF
      if (this.mixer) {
        // Only play animation if moving
        if (currentSpeed > 0) {
          this.mixer.update(delta * (currentSpeed / 2)); 
        }
      } else {
        // Fallback: The model has no built-in animations, so we fake it by bobbing and waddling
        if (currentSpeed > 0) {
          this.walkCycle += delta * currentSpeed * 2.5;
          this.mesh.position.y = Math.abs(Math.sin(this.walkCycle)) * 0.2; // Bob up and down
          this.mesh.rotation.z = Math.sin(this.walkCycle * 0.5) * 0.1; // Waddle
        } else {
          // Reset when idle
          this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0, delta * 5);
          this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, delta * 5);
        }
      }
    }
    
    // Perception check
    const distToPlayer = this.mesh.position.distanceTo(playerPos);
    let canSeePlayer = false;
    
    if (distToPlayer < this.sightRange) {
      canSeePlayer = this.hasLineOfSight(this.mesh.position, playerPos);
    }
    
    let canHearPlayer = false;
    // Simple hearing: if close enough, it hears you (we assume player is always moving for simplicity)
    if (!canSeePlayer && distToPlayer < this.hearingRange) {
      canHearPlayer = true;
    }

    // State Machine Logic
    switch (this.state) {
      case STATE.IDLE:
        if (canSeePlayer || canHearPlayer) {
          this.lastKnownPlayerPos.copy(playerPos);
          this.setState(canSeePlayer ? STATE.CHASE : STATE.INVESTIGATE);
        } else if (this.stateTimer > 2) {
          this.setState(STATE.PATROL);
        }
        break;

      case STATE.PATROL:
        if (canSeePlayer || canHearPlayer) {
          this.lastKnownPlayerPos.copy(playerPos);
          this.setState(canSeePlayer ? STATE.CHASE : STATE.INVESTIGATE);
        } else {
          // Sixth Sense mechanic: if he wanders aimlessly for 15 seconds, he drifts towards the player's general area
          this.sixthSenseTimer = (this.sixthSenseTimer || 0) + delta;
          if (this.sixthSenseTimer > 15.0) {
            this.sixthSenseTimer = 0;
            // Get a random point near the player instead of EXACTLY the player to feel more natural
            const randomOffset = new THREE.Vector3(
              (Math.random() - 0.5) * 10,
              0,
              (Math.random() - 0.5) * 10
            );
            this.lastKnownPlayerPos.copy(playerPos).add(randomOffset);
            this.setState(STATE.INVESTIGATE);
          } else {
            this.followPath(delta);
            if (!this.path || this.pathIndex >= this.path.length) {
              this.setState(STATE.IDLE);
            }
          }
        }
        break;

      case STATE.INVESTIGATE:
        if (canSeePlayer) {
          this.lastKnownPlayerPos.copy(playerPos);
          this.setState(STATE.CHASE);
        } else if (canHearPlayer && this.stateTimer > 1.0) {
          // Update investigation target
          this.stateTimer = 0;
          this.lastKnownPlayerPos.copy(playerPos);
          this.path = this.pathfinding.findPath(
            this.mesh.position.x, this.mesh.position.z,
            this.lastKnownPlayerPos.x, this.lastKnownPlayerPos.z,
            this.level.tileSize
          );
          this.pathIndex = 0;
        } else {
          this.followPath(delta);
          if (!this.path || this.pathIndex >= this.path.length) {
            // Reached last known pos, wait a bit
            this.setState(STATE.IDLE);
            this.stateTimer = -3; // Wait 3 seconds longer
          }
        }
        break;

      case STATE.CHASE:
        if (canSeePlayer) {
          this.lastKnownPlayerPos.copy(playerPos);
          // Recalculate path frequently
          if (this.stateTimer > 0.5) {
            this.stateTimer = 0;
            this.path = this.pathfinding.findPath(
              this.mesh.position.x, this.mesh.position.z,
              playerPos.x, playerPos.z,
              this.level.tileSize
            );
            this.pathIndex = 0;
          }
          this.followPath(delta);
        } else {
          // Lost sight, go investigate last known position
          this.setState(STATE.INVESTIGATE);
          this.path = this.pathfinding.findPath(
            this.mesh.position.x, this.mesh.position.z,
            this.lastKnownPlayerPos.x, this.lastKnownPlayerPos.z,
            this.level.tileSize
          );
          this.pathIndex = 0;
        }
        break;
    }
  }

  hasLineOfSight(pos1, pos2) {
    const dist = pos1.distanceTo(pos2);
    if (dist < 0.1) return true;
    
    const steps = Math.ceil(dist / (this.collisionSystem.tileSize / 2.5));
    const stepVec = new THREE.Vector3().subVectors(pos2, pos1).divideScalar(steps);
    const checkPos = pos1.clone();
    
    for (let i = 0; i < steps; i++) {
      checkPos.add(stepVec);
      // Use 0.3 radius to prevent clipping corners too tightly
      if (this.collisionSystem.checkCollision(checkPos.x, checkPos.z, 0.3)) {
        return false;
      }
    }
    return true;
  }

  followPath(delta) {
    if (!this.path || this.pathIndex >= this.path.length) return;

    let targetNode = this.path[this.pathIndex];
    let targetPos = new THREE.Vector3(targetNode.x, this.mesh.position.y, targetNode.z);
    
    // String Pulling: Look ahead to furthest visible node in path and skip intermediates
    let furthestVisibleIndex = this.pathIndex;
    for (let i = this.path.length - 1; i > this.pathIndex; i--) {
      const checkNode = this.path[i];
      const checkPos = new THREE.Vector3(checkNode.x, this.mesh.position.y, checkNode.z);
      if (this.hasLineOfSight(this.mesh.position, checkPos)) {
        furthestVisibleIndex = i;
        break;
      }
    }
    
    if (furthestVisibleIndex > this.pathIndex) {
      this.pathIndex = furthestVisibleIndex;
      targetNode = this.path[this.pathIndex];
      targetPos.set(targetNode.x, this.mesh.position.y, targetNode.z);
    }
    
    let dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
    let dist = dir.length();
    
    // Progress to next node if very close
    if (dist < 0.3) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) return;
      targetNode = this.path[this.pathIndex];
      targetPos.set(targetNode.x, this.mesh.position.y, targetNode.z);
      dir.subVectors(targetPos, this.mesh.position);
      dist = dir.length();
    }
    
    dir.normalize();
    this.mesh.position.addScaledVector(dir, this.speed * delta);
    
    // Smooth rotation interpolation
    const targetAngle = Math.atan2(dir.x, dir.z);
    
    let diff = targetAngle - this.mesh.rotation.y;
    // Normalize angle to find shortest path
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    this.mesh.rotation.y += diff * 5 * delta;
  }
}
