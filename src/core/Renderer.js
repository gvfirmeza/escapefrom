import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    this.container = container;
    
    this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    this.instance = new THREE.WebGLRenderer({
      antialias: !this.isMobile,
      powerPreference: 'high-performance'
    });
    
    // Cap pixel ratio at 1.0 for mobile to save immense performance overhead
    const pixelRatio = this.isMobile ? 1.0 : Math.min(window.devicePixelRatio, 2);
    this.instance.setPixelRatio(pixelRatio);
    this.instance.setSize(window.innerWidth, window.innerHeight);
    
    // Shadows
    if (!this.isMobile) {
      this.instance.shadowMap.enabled = true;
      this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
      this.instance.shadowMap.enabled = false;
    }
    
    // Tone mapping for better lighting
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.0;
    
    this.container.appendChild(this.instance.domElement);
    
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    this.instance.setSize(window.innerWidth, window.innerHeight);
    const pixelRatio = this.isMobile ? 1.0 : Math.min(window.devicePixelRatio, 2);
    this.instance.setPixelRatio(pixelRatio);
  }

  render(scene, camera) {
    this.instance.render(scene, camera);
  }
}
