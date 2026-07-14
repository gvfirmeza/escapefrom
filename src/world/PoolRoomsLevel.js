import * as THREE from 'three';
import { Grid, TILE_EMPTY, TILE_WALL, TILE_SPAWN, TILE_EXIT } from './Grid.js';
import { assetManager } from '../core/AssetManager.js';

export class PoolRoomsLevel {
  constructor(collisionSystem, sceneManager) {
    this.collisionSystem = collisionSystem;
    this.sceneManager = sceneManager;
    this.grid = null;
    this.tileSize = 4; // Larger tiles for open pool areas
    this.wallHeight = 6; // Taller ceilings
    
    this.spawnPosition = new THREE.Vector3();
    this.exitPosition = new THREE.Vector3();
    
    this.wallMesh = null;
    this.floorMesh = null;
    this.ceilingMesh = null;
    this.waterMesh = null;
    this.ceilingLights = [];
    
    this.keys = []; // Actually valves, keeping variable name for Game.js compatibility
    this.vaultDoorMesh = null;
    this.isDraining = false;
    this.waterLevel = 1.2; // Initial water height
  }

  generate(width, height) {
    this.grid = new Grid(width, height);
    this.collisionSystem.setGrid(this.grid);
    this.collisionSystem.tileSize = this.tileSize;
    
    this.carvePools();
    this.placeSpawnAndExit();
    this.placeValves();
    this.buildMeshes();
  }

  carvePools() {
    // Fill with walls
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        this.grid.set(x, y, TILE_WALL);
      }
    }

    // Carve huge open rooms
    const numRooms = Math.floor((this.grid.width * this.grid.height) / 40);
    for (let i = 0; i < numRooms; i++) {
      const w = Math.floor(Math.random() * 6) + 3; 
      const h = Math.floor(Math.random() * 6) + 3;
      const rx = Math.floor(Math.random() * (this.grid.width - w - 2)) + 1;
      const ry = Math.floor(Math.random() * (this.grid.height - h - 2)) + 1;
      
      for (let y = ry; y < ry + h; y++) {
        for (let x = rx; x < rx + w; x++) {
          this.grid.set(x, y, TILE_EMPTY);
        }
      }
    }

    // Add some pillars for that liminal aesthetic
    for (let y = 2; y < this.grid.height - 2; y += 2) {
      for (let x = 2; x < this.grid.width - 2; x += 2) {
        if (this.grid.get(x, y) === TILE_EMPTY && Math.random() < 0.2) {
          this.grid.set(x, y, TILE_WALL);
        }
      }
    }
  }

  placeSpawnAndExit() {
    let largestComponent = [];
    const globalVisited = new Set();
    
    for (let y = 1; y < this.grid.height - 1; y++) {
      for (let x = 1; x < this.grid.width - 1; x++) {
        if (this.grid.get(x, y) === TILE_EMPTY && !globalVisited.has(`${x},${y}`)) {
          const currentComponent = [];
          const stack = [{x, y}];
          globalVisited.add(`${x},${y}`);
          
          while (stack.length > 0) {
            const cur = stack.pop();
            currentComponent.push(cur);
            
            const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
            for (const [dx, dy] of dirs) {
              const nx = cur.x + dx;
              const ny = cur.y + dy;
              if (nx > 0 && nx < this.grid.width - 1 && ny > 0 && ny < this.grid.height - 1) {
                if (this.grid.get(nx, ny) === TILE_EMPTY && !globalVisited.has(`${nx},${ny}`)) {
                  globalVisited.add(`${nx},${ny}`);
                  stack.push({x: nx, y: ny});
                }
              }
            }
          }
          if (currentComponent.length > largestComponent.length) {
            largestComponent = currentComponent;
          }
        }
      }
    }
    
    this.validCoords = largestComponent;
    if (this.validCoords.length === 0) {
      this.validCoords.push({x: 1, y: 1}); // fallback
    }
    
    const spawnCell = this.validCoords[Math.floor(Math.random() * this.validCoords.length)];
    this.grid.set(spawnCell.x, spawnCell.y, TILE_SPAWN);
    this.spawnPosition.set(spawnCell.x * this.tileSize, 1.5, spawnCell.y * this.tileSize);
    
    // Exit is hidden at the bottom of the pool
    let exitCell = this.validCoords[Math.floor(Math.random() * this.validCoords.length)];
    let maxDist = 0;
    
    for (const cell of this.validCoords) {
      const dist = Math.hypot(cell.x - spawnCell.x, cell.y - spawnCell.y);
      if (dist > maxDist) {
        maxDist = dist;
        exitCell = cell;
      }
    }
    
    this.grid.set(exitCell.x, exitCell.y, TILE_EXIT);
    this.exitPosition.set(exitCell.x * this.tileSize, 0, exitCell.y * this.tileSize);
    
    this.vaultDoorMesh = new THREE.Group();
    
    // Submerged exit hatch
    const hatchMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8, metalness: 0.8 });
    const hatchGeo = new THREE.BoxGeometry(this.tileSize * 0.8, 0.2, this.tileSize * 0.8);
    const hatch = new THREE.Mesh(hatchGeo, hatchMat);
    hatch.position.y = 0.1;
    this.vaultDoorMesh.add(hatch);
    
    const signGeo = new THREE.BoxGeometry(1.0, 0.4, 0.1);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 0.3, 0);
    sign.rotation.x = -Math.PI / 2;
    this.vaultDoorMesh.add(sign);
    
    this.vaultDoorMesh.position.copy(this.exitPosition);
    this.sceneManager.add(this.vaultDoorMesh);
  }

  placeValves() {
    this.keys = [];
    const wallTiles = [];
    
    // Only use validCoords to ensure they are accessible
    for (const cell of this.validCoords) {
      const x = cell.x;
      const y = cell.y;
      
      const dirs = [{dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}];
      for (const d of dirs) {
        if (this.grid.get(x + d.dx, y + d.dy) === TILE_WALL) {
          wallTiles.push({ x, y, dx: d.dx, dy: d.dy });
        }
      }
    }
    
    // Place 5 valves, ensuring they are spread out
    for (let i = 0; i < 5; i++) {
      if (wallTiles.length === 0) break;
      
      let bestIdx = 0;
      let maxMinDist = -1;
      
      // Try a few random samples to find one far from existing valves
      const samples = Math.min(10, wallTiles.length);
      for (let s = 0; s < samples; s++) {
        const idx = Math.floor(Math.random() * wallTiles.length);
        const wt = wallTiles[idx];
        const px = wt.x * this.tileSize + wt.dx * (this.tileSize / 2 - 0.4);
        const pz = wt.y * this.tileSize + wt.dy * (this.tileSize / 2 - 0.4);
        
        let minDist = 999999;
        for (const k of this.keys) {
          const dist = Math.hypot(k.position.x - px, k.position.z - pz);
          if (dist < minDist) minDist = dist;
        }
        
        if (minDist > maxMinDist) {
          maxMinDist = minDist;
          bestIdx = idx;
        }
      }
      
      const wt = wallTiles.splice(bestIdx, 1)[0];
      
      const valveGroup = new THREE.Group();
      
      // Valve Wheel (Red)
      const wheelGeo = new THREE.TorusGeometry(0.3, 0.05, 8, 16);
      const valveMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5, metalness: 0.5 });
      const wheel = new THREE.Mesh(wheelGeo, valveMat);
      
      // Pipe
      const pipeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.4);
      const pipe = new THREE.Mesh(pipeGeo, new THREE.MeshStandardMaterial({color: 0x555555}));
      pipe.rotation.x = Math.PI / 2;
      pipe.position.z = -0.2;
      
      valveGroup.add(wheel);
      valveGroup.add(pipe);
      
      // Add a small light so it's visible in the dark pool rooms
      const light = new THREE.PointLight(0xff0000, 0.5, 4);
      valveGroup.add(light);
      
      const angle = Math.atan2(-wt.dx, -wt.dy);
      valveGroup.rotation.y = angle;
      
      const px = wt.x * this.tileSize + wt.dx * (this.tileSize / 2 - 0.4);
      const pz = wt.y * this.tileSize + wt.dy * (this.tileSize / 2 - 0.4);
      
      valveGroup.position.set(px, 2.5, pz);
      
      this.sceneManager.add(valveGroup);
      this.keys.push({
        mesh: valveGroup,
        position: valveGroup.position.clone(),
        collected: false
      });
    }
  }

  buildMeshes() {
    let wallCount = 0;
    let emptyCount = 0;
    
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (this.grid.isSolid(x, y)) {
          wallCount++;
        } else {
          emptyCount++;
        }
      }
    }

    const boxGeo = new THREE.BoxGeometry(this.tileSize, this.wallHeight, this.tileSize);
    const planeGeo = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
    
    const tileMat = assetManager.getMaterial('poolTile');
    const waterMat = assetManager.getMaterial('water');
    
    this.wallMesh = new THREE.InstancedMesh(boxGeo, tileMat, wallCount);
    this.floorMesh = new THREE.InstancedMesh(planeGeo, tileMat, emptyCount);
    this.ceilingMesh = new THREE.InstancedMesh(planeGeo, tileMat, emptyCount);

    let wallIdx = 0;
    let emptyIdx = 0;
    const dummy = new THREE.Object3D();

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const px = x * this.tileSize;
        const pz = y * this.tileSize;
        
        if (this.grid.isSolid(x, y)) {
          dummy.position.set(px, this.wallHeight / 2, pz);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          this.wallMesh.setMatrixAt(wallIdx++, dummy.matrix);
        } else {
          // Floor
          dummy.position.set(px, 0, pz);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          this.floorMesh.setMatrixAt(emptyIdx, dummy.matrix);
          
          // Ceiling
          dummy.position.set(px, this.wallHeight, pz);
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          this.ceilingMesh.setMatrixAt(emptyIdx, dummy.matrix);
          
          emptyIdx++;
        }
      }
    }

    this.sceneManager.add(this.wallMesh);
    this.sceneManager.add(this.floorMesh);
    this.sceneManager.add(this.ceilingMesh);
    
    // Create Water Plane covering the whole map
    const waterGeo = new THREE.PlaneGeometry(this.grid.width * this.tileSize, this.grid.height * this.tileSize);
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(
      (this.grid.width * this.tileSize) / 2,
      this.waterLevel,
      (this.grid.height * this.tileSize) / 2
    );
    this.sceneManager.add(this.waterMesh);
  }
  
  drain() {
    this.isDraining = true;
  }
  
  update(delta) {
    if (this.isDraining && this.waterMesh && this.waterMesh.position.y > -0.5) {
      this.waterMesh.position.y -= delta * 0.2;
    }
  }

  getSpawnPosition() {
    return this.spawnPosition.clone();
  }
  
  getRandomEmptyPositionFarFrom(pos, minDistance) {
    const emptyCoords = [];
    if (this.validCoords && this.validCoords.length > 0) {
      for (const cell of this.validCoords) {
        const px = cell.x * this.tileSize;
        const pz = cell.y * this.tileSize;
        const dist = Math.hypot(px - pos.x, pz - pos.z);
        if (dist >= minDistance) {
          emptyCoords.push(new THREE.Vector3(px, 1.5, pz));
        }
      }
    } else {
      // fallback
      for (let y = 0; y < this.grid.height; y++) {
        for (let x = 0; x < this.grid.width; x++) {
          if (!this.grid.isSolid(x, y)) {
            const px = x * this.tileSize;
            const pz = y * this.tileSize;
            const dist = Math.hypot(px - pos.x, pz - pos.z);
            if (dist >= minDistance) {
              emptyCoords.push(new THREE.Vector3(px, 1.5, pz));
            }
          }
        }
      }
    }
    
    if (emptyCoords.length === 0) return pos.clone();
    return emptyCoords[Math.floor(Math.random() * emptyCoords.length)];
  }

  isAtExit(position) {
    // Cannot exit unless water is drained
    if (this.waterMesh && this.waterMesh.position.y > 0.1) return false;
    return position.distanceTo(this.exitPosition) < this.tileSize;
  }
}
