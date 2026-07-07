import * as THREE from 'three';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    
    // Classic Backrooms fog but darker
    this.scene.background = new THREE.Color('#0a0a00'); // Darker yellow/green
    this.scene.fog = new THREE.FogExp2('#0a0a00', 0.05);
    
    this.setupLighting();
  }

  setupLighting() {
    // Ambient light - increased slightly as requested
    this.ambientLight = new THREE.AmbientLight('#fffad6', 0.04);
    this.scene.add(this.ambientLight);
  }

  setDebugMode(enabled) {
    if (enabled) {
      this.ambientLight.intensity = 2.0; // Bright light
      this.scene.fog.density = 0; // Disable fog
    } else {
      this.ambientLight.intensity = 0.04;
      this.scene.fog.density = 0.05;
    }
  }

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }

  clear() {
    // Clear everything except lights
    const toRemove = [];
    this.scene.children.forEach(child => {
      if (!(child instanceof THREE.Light)) {
        toRemove.push(child);
      }
    });
    
    toRemove.forEach(child => this.scene.remove(child));
  }
}
