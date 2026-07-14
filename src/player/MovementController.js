import * as THREE from 'three';

export class MovementController {
  constructor(camera) {
    this.camera = camera;
    
    // Physics constants
    this.walkSpeed = 4.0;
    this.runSpeed = 8.0;
    this.crouchSpeed = 2.0;
    
    this.standHeight = 1.7;
    this.crouchHeight = 1.0;
    this.currentHeight = this.standHeight;
    
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    
    // Mouse sensitivity
    this.sensitivity = 0.002;
    
    // Camera bobbing
    this.bobPhase = 0;
    
    // Debug
    this.isDebugMode = false;
    
    // Settings listener
    window.addEventListener('settings_changed', (e) => {
      this.sensitivity = (e.detail.sensitivity || 10) * 0.0002;
    });
  }

  setDebugMode(enabled) {
    this.isDebugMode = enabled;
  }

  reset(position) {
    this.camera.position.copy(position);
    this.camera.position.y = this.standHeight;
    this.euler.set(0, 0, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
    this.velocity.set(0, 0, 0);
  }

  update(delta, input, collisionSystem) {
    // 1. Mouse Look
    const mouseDelta = input.getMovementDelta();
    this.euler.y -= mouseDelta.x * this.sensitivity;
    this.euler.x -= mouseDelta.y * this.sensitivity;
    
    // Clamp pitch
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);

    // 2. Crouching logic
    const isCrouching = input.keys.c || input.keys.ctrl;
    const targetHeight = isCrouching ? this.crouchHeight : this.standHeight;
    
    // Smooth transition
    this.currentHeight += (targetHeight - this.currentHeight) * 10 * delta;

    // 3. Movement & 4. Collision Detection
    let speed = this.walkSpeed;
    if (this.isDebugMode) {
      speed = this.runSpeed * 2.5; // Fast fly speed
    } else if (isCrouching) {
      speed = this.crouchSpeed;
    } else if (input.keys.shift) {
      speed = this.runSpeed;
    }

    let z = Number(input.keys.s) - Number(input.keys.w);
    let x = Number(input.keys.d) - Number(input.keys.a);
    
    // Add joystick input if available
    if (input.joystickVector && (input.joystickVector.x !== 0 || input.joystickVector.y !== 0)) {
      x += input.joystickVector.x;
      z += input.joystickVector.y;
    }
    
    this.direction.set(x, 0, z);
    if (this.direction.lengthSq() > 1) {
      this.direction.normalize();
    }
    if (this.isDebugMode) {
      // In debug mode, apply full 3D rotation to direction for flying
      this.direction.applyEuler(this.euler);
      
      // Also allow vertical movement with Space/Ctrl if desired, but look-direction is enough
      
      if (this.direction.lengthSq() > 0.01) {
        this.camera.position.addScaledVector(this.direction, speed * delta);
      }
      return; // Skip standard gravity/collision/bobbing entirely
    }

    // Apply rotation to direction (Y-axis only for normal walking)
    this.direction.applyEuler(new THREE.Euler(0, this.euler.y, 0));
    
    // Calculate velocity
    if (this.direction.lengthSq() > 0.01) {
      this.velocity.x = this.direction.x * speed;
      this.velocity.z = this.direction.z * speed;
    } else {
      // Damping
      this.velocity.x -= this.velocity.x * 10 * delta;
      this.velocity.z -= this.velocity.z * 10 * delta;
    }

    // 4. Collision Detection (simplified AABB slide)
    const proposedX = this.camera.position.x + this.velocity.x * delta;
    const proposedZ = this.camera.position.z + this.velocity.z * delta;
    
    // Check X
    if (!collisionSystem.checkCollision(proposedX, this.camera.position.z, 0.4)) {
      this.camera.position.x = proposedX;
    } else {
      this.velocity.x = 0;
    }
    
    // Check Z
    if (!collisionSystem.checkCollision(this.camera.position.x, proposedZ, 0.4)) {
      this.camera.position.z = proposedZ;
    } else {
      this.velocity.z = 0;
    }

    // 5. Camera Bobbing
    const flatVelocity = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    if (flatVelocity > 0.1) {
      const bobFreq = speed === this.runSpeed ? 15 : 10;
      const bobAmp = speed === this.runSpeed ? 0.05 : 0.03;
      this.bobPhase += bobFreq * delta;
      const bobOffset = Math.sin(this.bobPhase) * bobAmp;
      this.camera.position.y = this.currentHeight + bobOffset;
    } else {
      this.bobPhase = 0;
      this.camera.position.y += (this.currentHeight - this.camera.position.y) * 10 * delta;
    }
  }
}
