import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    this.container = container;
    
    this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    this.instance = new THREE.WebGLRenderer({
      antialias: !this.isMobile,
      powerPreference: 'high-performance'
    });
    
    // Default ratio (will be overridden by settings event if fired)
    const defaultPixelRatio = this.isMobile ? 0.5 : Math.min(window.devicePixelRatio, 2);
    this.currentQualityScale = defaultPixelRatio;
    this.instance.setPixelRatio(this.currentQualityScale);
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
    
    window.addEventListener('settings_changed', (e) => {
      const q = e.detail.quality;
      const baseRatio = Math.min(window.devicePixelRatio, 2);
      if (q === 'low') {
        this.currentQualityScale = this.isMobile ? 0.5 : baseRatio * 0.5;
      } else if (q === 'medium') {
        this.currentQualityScale = this.isMobile ? 0.75 : baseRatio * 0.75;
      } else {
        this.currentQualityScale = this.isMobile ? 1.0 : baseRatio;
      }
      this.instance.setPixelRatio(this.currentQualityScale);
      
      // Update shadows dynamically? 
      // For now, let's keep shadows tied to isMobile, but we could tie it to quality.
    });
  }

  onResize() {
    this.instance.setSize(window.innerWidth, window.innerHeight);
  }

  render(scene, camera) {
    this.instance.render(scene, camera);
  }
}
