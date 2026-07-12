import * as THREE from 'three';
import { assetManager } from '../core/AssetManager.js';

export class SharkEntity {
  constructor(level, collisionSystem) {
    this.level = level;
    this.collisionSystem = collisionSystem;
    
    const loadedModel = assetManager.getModel('enemy2');
    
    if (loadedModel) {
      this.mesh = loadedModel;
      this.mesh.scale.set(0.25, 0.25, 0.25); // Adjust scale based on trial
      this.mesh.position.y = 0; // touch the ground
      
      if (this.mesh.animations && this.mesh.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.mesh);
        this.action = this.mixer.clipAction(this.mesh.animations[0]);
        this.action.play();
        this.action.paused = false; // Will pause when frozen
      }
    } else {
      this.mesh = new THREE.Group();
      this.buildProceduralMesh();
    }
    
    // States: 0 = Frozen (looked at), 1 = Chasing
    this.state = 1;
    this.speed = 3.5; // Reduced speed
    this.difficultyMultiplier = 1.0;
  }

  buildProceduralMesh() {
    // Simple bean / blocão placeholder
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
    const bodyGeo = new THREE.CapsuleGeometry(0.6, 1.2, 4, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.2;
    
    // "Eyes" to show where it's looking
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeGeo = new THREE.BoxGeometry(0.2, 0.1, 0.1);
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.2, 1.5, 0.55);
    
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.2, 1.5, 0.55);
    
    this.mesh.add(body);
    this.mesh.add(leftEye);
    this.mesh.add(rightEye);
  }

  spawn(position) {
    this.mesh.position.copy(position);
    this.mesh.position.y = 0;
  }

  updateDifficulty(multiplier) {
    this.difficultyMultiplier = multiplier;
  }

  hasLineOfSight(playerPos) {
    if (!this.level || !this.level.grid) return true;
    
    const startX = this.mesh.position.x;
    const startZ = this.mesh.position.z;
    const endX = playerPos.x;
    const endZ = playerPos.z;
    
    const dx = endX - startX;
    const dz = endZ - startZ;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    const steps = Math.ceil(dist / 0.5);
    const stepX = dx / steps;
    const stepZ = dz / steps;
    
    let cx = startX;
    let cz = startZ;
    const tileSize = this.collisionSystem.tileSize;
    
    for (let i = 0; i < steps; i++) {
      cx += stepX;
      cz += stepZ;
      const gx = Math.round(cx / tileSize);
      const gz = Math.round(cz / tileSize);
      if (this.level.grid.isSolid(gx, gz)) {
        return false;
      }
    }
    return true;
  }

  update(delta, playerPos, playerDir) {
    // Weeping Angel logic: check if player is looking at the shark
    const dirToShark = new THREE.Vector3().subVectors(this.mesh.position, playerPos).normalize();
    const dot = playerDir.dot(dirToShark);
    
    let isBeingLookedAt = dot > 0.5;
    
    // Check line of sight (no walls in between)
    if (isBeingLookedAt) {
      isBeingLookedAt = this.hasLineOfSight(playerPos);
    }
    
    if (isBeingLookedAt) {
      this.state = 0; // Frozen
      if (this.action) this.action.paused = true;
    } else {
      this.state = 1; // Chasing
      if (this.action) this.action.paused = false;
    }
    
    if (this.mixer && this.state === 1) {
      this.mixer.update(delta * this.difficultyMultiplier);
    }
    
    if (this.state === 1) {
      // Chase player
      const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
      dir.y = 0; // Keep horizontal
      
      if (dir.lengthSq() > 0.1) {
        dir.normalize();
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        
        const moveSpeed = this.speed * this.difficultyMultiplier * delta;
        const proposedPos = this.mesh.position.clone().add(dir.multiplyScalar(moveSpeed));
        proposedPos.y = 0; // Force it to the ground
        
        const radius = 0.7; // Increased radius to prevent wall clipping
        // Correct collision calls using (x, z, radius)
        if (!this.collisionSystem.checkCollision(proposedPos.x, proposedPos.z, radius)) {
          this.mesh.position.copy(proposedPos);
        } else {
          // Slide along walls
          const pX = this.mesh.position.clone(); pX.x = proposedPos.x; pX.y = 0;
          const pZ = this.mesh.position.clone(); pZ.z = proposedPos.z; pZ.y = 0;
          if (!this.collisionSystem.checkCollision(pX.x, pX.z, radius)) this.mesh.position.copy(pX);
          else if (!this.collisionSystem.checkCollision(pZ.x, pZ.z, radius)) this.mesh.position.copy(pZ);
        }
      }
    }
  }
}
