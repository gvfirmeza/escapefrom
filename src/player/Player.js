import * as THREE from 'three';
import { InputController } from './InputController.js';
import { MovementController } from './MovementController.js';
import { Flashlight } from './Flashlight.js';

export class Player {
  constructor(domElement) {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    
    this.input = new InputController(domElement);
    this.movement = new MovementController(this.camera);
    this.flashlight = new Flashlight(this.camera);
    
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  reset(position) {
    this.movement.reset(position);
  }

  lockPointer() {
    this.input.lock();
  }

  unlockPointer() {
    this.input.unlock();
  }

  update(delta, collisionSystem) {
    this.movement.update(delta, this.input, collisionSystem);
    this.flashlight.update(delta, this.input);
  }
}
