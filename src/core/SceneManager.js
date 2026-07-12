import * as THREE from 'three';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    
    // Default Backrooms fog
    this.scene.background = new THREE.Color('#0a0a00');
    this.scene.fog = new THREE.FogExp2('#0a0a00', 0.05);
    
    this.setupLighting();
  }

  setupPoolRoomsEnvironment() {
    this.scene.background = new THREE.Color('#3a5a5a');
    this.scene.fog = new THREE.FogExp2('#3a5a5a', 0.035);
    
    this.ambientLight = new THREE.AmbientLight('#88bbbb', 0.3);
    this.scene.add(this.ambientLight);
  }

  setupLighting() {
    this.scene.background = new THREE.Color('#0a0a00');
    this.scene.fog = new THREE.FogExp2('#0a0a00', 0.05);
    
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
    // Clear EVERYTHING to prevent memory/performance leaks with lights across restarts
    const toRemove = [...this.scene.children];
    toRemove.forEach(child => {
      this.scene.remove(child);
      if (child.dispose) child.dispose();
    });
  }
}
