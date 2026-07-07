import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetManager {
  constructor() {
    this.textures = {};
    this.materials = {};
    this.models = {};
  }

  init() {
    this.generateTextures();
    this.createMaterials();
  }

  async loadModels() {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load('/tung_tung_tung_sahur/scene.gltf', (gltf) => {
        const model = gltf.scene;
        
        // Configure shadows and materials if necessary
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        this.models.enemy = model;
        this.models.enemy.animations = gltf.animations; // Store animations on the object
        resolve();
      }, undefined, (err) => {
        console.error('Failed to load tung_tung_tung_sahur model, falling back to procedural:', err);
        resolve();
      });
    });
  }

  generateTextures() {
    // 1. Wallpaper Texture
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512;
    wallCanvas.height = 512;
    const wallCtx = wallCanvas.getContext('2d');
    
    // Base yellow
    wallCtx.fillStyle = '#d1b82e';
    wallCtx.fillRect(0, 0, 512, 512);
    
    // Subtle noise for wallpaper
    const wallImgData = wallCtx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < wallImgData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
      wallImgData.data[i] += noise;     // R
      wallImgData.data[i + 1] += noise; // G
      wallImgData.data[i + 2] += noise; // B
      // Add vertical lines (wallpaper pattern)
      if (i % (512 * 4 * 16) < 512 * 4 * 2) {
        wallImgData.data[i] -= 20;
        wallImgData.data[i+1] -= 20;
        wallImgData.data[i+2] -= 20;
      }
    }
    wallCtx.putImageData(wallImgData, 0, 0);
    this.textures.wall = new THREE.CanvasTexture(wallCanvas);
    this.textures.wall.wrapS = THREE.RepeatWrapping;
    this.textures.wall.wrapT = THREE.RepeatWrapping;

    // 2. Carpet Texture
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const floorCtx = floorCanvas.getContext('2d');
    
    // Dirty yellow/brown
    floorCtx.fillStyle = '#8b7a21';
    floorCtx.fillRect(0, 0, 512, 512);
    
    // Heavy noise and damp spots for carpet
    const floorImgData = floorCtx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < floorImgData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 40;
      floorImgData.data[i] += noise;
      floorImgData.data[i + 1] += noise;
      floorImgData.data[i + 2] += noise;
    }
    floorCtx.putImageData(floorImgData, 0, 0);
    this.textures.floor = new THREE.CanvasTexture(floorCanvas);
    this.textures.floor.wrapS = THREE.RepeatWrapping;
    this.textures.floor.wrapT = THREE.RepeatWrapping;

    // 3. Ceiling Texture
    const ceilingCanvas = document.createElement('canvas');
    ceilingCanvas.width = 512;
    ceilingCanvas.height = 512;
    const ceilingCtx = ceilingCanvas.getContext('2d');
    
    // Off-white acoustic tiles
    ceilingCtx.fillStyle = '#e0e0e0';
    ceilingCtx.fillRect(0, 0, 512, 512);
    
    // Draw tile grid
    ceilingCtx.strokeStyle = '#a0a0a0';
    ceilingCtx.lineWidth = 4;
    ceilingCtx.beginPath();
    ceilingCtx.moveTo(256, 0);
    ceilingCtx.lineTo(256, 512);
    ceilingCtx.moveTo(0, 256);
    ceilingCtx.lineTo(512, 256);
    ceilingCtx.stroke();
    
    // Add noise to tiles
    const ceilImgData = ceilingCtx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < ceilImgData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10;
      ceilImgData.data[i] += noise;
      ceilImgData.data[i + 1] += noise;
      ceilImgData.data[i + 2] += noise;
    }
    ceilingCtx.putImageData(ceilImgData, 0, 0);
    this.textures.ceiling = new THREE.CanvasTexture(ceilingCanvas);
    this.textures.ceiling.wrapS = THREE.RepeatWrapping;
    this.textures.ceiling.wrapT = THREE.RepeatWrapping;
  }

  createMaterials() {
    this.materials.wall = new THREE.MeshStandardMaterial({
      map: this.textures.wall,
      roughness: 0.9,
      metalness: 0.0
    });

    this.materials.floor = new THREE.MeshStandardMaterial({
      map: this.textures.floor,
      roughness: 1.0,
      metalness: 0.0
    });

    this.materials.ceiling = new THREE.MeshStandardMaterial({
      map: this.textures.ceiling,
      roughness: 0.8,
      metalness: 0.0
    });
    
    this.materials.enemy = new THREE.MeshStandardMaterial({
      color: 0x050505,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x220000
    });
  }

  getMaterial(name) {
    return this.materials[name];
  }

  getModel(name) {
    return this.models[name] ? this.models[name].clone() : null;
  }
}

export const assetManager = new AssetManager();
