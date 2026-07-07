import * as THREE from 'three';

export class Flashlight {
  constructor(camera) {
    this.camera = camera;
    this.isOn = true;
    this.fKeyPressed = false;
    
    // Create spotlight
    this.light = new THREE.SpotLight(0xfff5e6, 4.0); // warm white
    this.light.angle = Math.PI / 4.5; // Slightly wider
    this.light.penumbra = 0.5;
    this.light.decay = 1.2; // Less decay
    this.light.distance = 70; // Farther distance
    
    // Shadows
    this.light.castShadow = true;
    this.light.shadow.mapSize.width = 1024;
    this.light.shadow.mapSize.height = 1024;
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.camera.far = 70;
    
    // Target for the spotlight to point at
    this.target = new THREE.Object3D();
    this.target.position.set(0, 0, -1);
    this.light.target = this.target;
    
    // Attach to camera
    this.camera.add(this.light);
    this.camera.add(this.target);
    
    // Position the light slightly below and to the right of the camera center
    this.light.position.set(0.2, -0.2, 0);
    
    // Add a dim fill light to illuminate the immediate area (simulating bounced light)
    this.fillLight = new THREE.PointLight(0xfff5e6, 0.8, 12);
    this.fillLight.decay = 1.5;
    this.camera.add(this.fillLight);
    
    // Sway
    this.swayTime = 0;
    this.onToggle = null;
  }

  update(delta, input) {
    // Toggle logic
    if (input.keys.f && !this.fKeyPressed) {
      this.isOn = !this.isOn;
      this.light.intensity = this.isOn ? 4.0 : 0;
      this.fillLight.intensity = this.isOn ? 0.8 : 0;
      this.fKeyPressed = true;
      if (this.onToggle) this.onToggle();
    } else if (!input.keys.f) {
      this.fKeyPressed = false;
    }
    
    // Subtle sway when walking
    if (this.isOn) {
      this.swayTime += delta * 2;
      
      // Target sways slightly
      this.target.position.x = Math.sin(this.swayTime) * 0.05;
      this.target.position.y = Math.cos(this.swayTime * 1.5) * 0.05;
      
      // Very slight flicker randomly
      if (Math.random() > 0.98) {
        this.light.intensity = 3.6 + Math.random() * 0.8;
        this.fillLight.intensity = 0.6 + Math.random() * 0.4;
      } else {
        // smooth return to normal
        this.light.intensity += (4.0 - this.light.intensity) * 10 * delta;
        this.fillLight.intensity += (0.8 - this.fillLight.intensity) * 10 * delta;
      }
    }
  }
}
