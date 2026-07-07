import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    this.container = container;
    
    this.instance = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.instance.setSize(window.innerWidth, window.innerHeight);
    
    // Shadows
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Tone mapping for better lighting
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.0;
    
    this.container.appendChild(this.instance.domElement);
    
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    this.instance.setSize(window.innerWidth, window.innerHeight);
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  render(scene, camera) {
    this.instance.render(scene, camera);
  }
}
