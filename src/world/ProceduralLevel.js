import * as THREE from 'three';
import { Grid, TILE_EMPTY, TILE_WALL, TILE_SPAWN, TILE_EXIT } from './Grid.js';
import { assetManager } from '../core/AssetManager.js';

export class ProceduralLevel {
  constructor(collisionSystem, sceneManager) {
    this.collisionSystem = collisionSystem;
    this.sceneManager = sceneManager;
    this.grid = null;
    this.tileSize = 2;
    this.wallHeight = 3;
    
    this.spawnPosition = new THREE.Vector3();
    this.exitPosition = new THREE.Vector3();
    
    // For rendering
    this.wallMesh = null;
    this.floorMesh = null;
    this.ceilingMesh = null;
    this.ceilingLights = [];
    
    this.keys = [];
    this.vaultDoorMesh = null;
  }

  generate(width, height) {
    this.grid = new Grid(width, height);
    this.collisionSystem.setGrid(this.grid);
    this.collisionSystem.tileSize = this.tileSize;
    
    // Procedural generation (Drunkard's walk / Room carving)
    this.carveMaze();
    
    // Set spawn and exit
    this.placeSpawnAndExit();
    
    // Generate keys
    this.placeKeys();
    
    // Build 3D Meshes
    this.buildMeshes();
  }

  carveMaze() {
    // Backrooms style: Large overlapping rooms instead of tight corridors
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        this.grid.set(x, y, TILE_WALL);
      }
    }

    const numRooms = Math.floor((this.grid.width * this.grid.height) / 30);
    for (let i = 0; i < numRooms; i++) {
      const w = Math.floor(Math.random() * 8) + 4; 
      const h = Math.floor(Math.random() * 8) + 4;
      const rx = Math.floor(Math.random() * (this.grid.width - w - 2)) + 1;
      const ry = Math.floor(Math.random() * (this.grid.height - h - 2)) + 1;
      
      for (let y = ry; y < ry + h; y++) {
        for (let x = rx; x < rx + w; x++) {
          this.grid.set(x, y, TILE_EMPTY);
        }
      }
    }

    // Add creepy random pillars
    for (let y = 2; y < this.grid.height - 2; y++) {
      for (let x = 2; x < this.grid.width - 2; x++) {
        if (this.grid.get(x, y) === TILE_EMPTY && Math.random() < 0.05) {
          // Check if it won't block completely (simplified: just random pillars)
          this.grid.set(x, y, TILE_WALL);
        }
      }
    }
  }

  placeSpawnAndExit() {
    // Find largest connected component to prevent spawning in an isolated tiny room
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
    
    const emptyCoords = largestComponent;
    if (emptyCoords.length === 0) {
      emptyCoords.push({x: 1, y: 1}); // extreme fallback
    }
    
    // Pick random spawn from connected empty tiles
    const spawnIndex = Math.floor(Math.random() * emptyCoords.length);
    const spawnCell = emptyCoords[spawnIndex];
    this.grid.set(spawnCell.x, spawnCell.y, TILE_SPAWN);
    this.spawnPosition.set(spawnCell.x * this.tileSize, 0, spawnCell.y * this.tileSize);
    
    // Pick exit far from spawn and adjacent to a wall
    let exitCell = null;
    let maxDist = 0;
    let wallDir = { dx: 0, dy: -1 };
    
    for (const cell of emptyCoords) {
      const dist = Math.hypot(cell.x - spawnCell.x, cell.y - spawnCell.y);
      // Check if it has a wall neighbor
      const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
      let foundWallDir = null;
      for (const [dx, dy] of dirs) {
        if (this.grid.get(cell.x + dx, cell.y + dy) === TILE_WALL) {
          foundWallDir = {dx, dy};
          break;
        }
      }
      
      if (foundWallDir && dist > maxDist) {
        maxDist = dist;
        exitCell = cell;
        wallDir = foundWallDir;
      }
    }
    
    if (exitCell) {
      this.grid.set(exitCell.x, exitCell.y, TILE_EXIT);
      this.exitPosition.set(exitCell.x * this.tileSize, 0, exitCell.y * this.tileSize);
      
      // Create a better Exit Door Group
      this.vaultDoorMesh = new THREE.Group();
      
      // Frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
      const frameGeo = new THREE.BoxGeometry(this.tileSize * 0.9, this.wallHeight, 0.4);
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.y = this.wallHeight / 2;
      this.vaultDoorMesh.add(frame);
      
      // Door (slightly ajar)
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x221100, roughness: 0.9 });
      const doorGeo = new THREE.BoxGeometry(this.tileSize * 0.8, this.wallHeight - 0.2, 0.1);
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(-0.2, this.wallHeight / 2 - 0.1, 0.2);
      door.rotation.y = Math.PI / 8; // Ajar
      this.vaultDoorMesh.add(door);
      
      // Glowing EXIT Sign
      const signGeo = new THREE.BoxGeometry(0.8, 0.3, 0.1);
      const signMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, this.wallHeight + 0.1, 0.2);
      this.vaultDoorMesh.add(sign);
      
      const signLight = new THREE.PointLight(0x00ff00, 1.0, 4);
      signLight.position.set(0, this.wallHeight + 0.1, 0.5);
      this.vaultDoorMesh.add(signLight);
      
      // Adjust rotation to put back against wall
      // If wall is dx=0, dy=-1 (North), angle should be 0
      // If wall is dx=1, dy=0 (East), angle should be -PI/2
      // If wall is dx=0, dy=1 (South), angle should be PI
      // Math.atan2(dx, -dy) handles this mapping
      const doorAngle = Math.atan2(wallDir.dx, -wallDir.dy);
      this.vaultDoorMesh.rotation.y = doorAngle;
      
      // Position flush against the wall
      this.vaultDoorMesh.position.set(
        this.exitPosition.x + wallDir.dx * (this.tileSize * 0.45),
        0,
        this.exitPosition.z + wallDir.dy * (this.tileSize * 0.45)
      );
      this.sceneManager.add(this.vaultDoorMesh);
    }
  }

  placeKeys() {
    this.keys = [];
    for (let i = 0; i < 5; i++) {
      // Create simple floating key representation
      const keyGroup = new THREE.Group();
      
      // Ring
      const ringGeo = new THREE.TorusGeometry(0.15, 0.05, 8, 16);
      const keyMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xaa8800,
        emissiveIntensity: 0.5,
        metalness: 1.0,
        roughness: 0.2
      });
      const ring = new THREE.Mesh(ringGeo, keyMat);
      ring.position.y = 0.3;
      
      // Shaft
      const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4);
      const shaft = new THREE.Mesh(shaftGeo, keyMat);
      shaft.position.y = -0.05;
      
      // Teeth
      const teethGeo = new THREE.BoxGeometry(0.15, 0.1, 0.04);
      const teeth = new THREE.Mesh(teethGeo, keyMat);
      teeth.position.set(0.08, -0.15, 0);
      
      keyGroup.add(ring);
      keyGroup.add(shaft);
      keyGroup.add(teeth);
      
      // Light
      const keyLight = new THREE.PointLight(0xffd700, 0.5, 3);
      keyGroup.add(keyLight);
      
      let pos;
      let valid = false;
      let attempts = 0;
      while (!valid && attempts < 100) {
        pos = this.getRandomEmptyPositionFarFrom(this.spawnPosition, 15); // Far from spawn
        valid = true;
        for (const existing of this.keys) {
          if (pos.distanceTo(existing.position) < 25) { // Far from other keys
            valid = false;
            break;
          }
        }
        attempts++;
      }
      
      pos.y = 1.0;
      keyGroup.position.copy(pos);
      
      this.sceneManager.add(keyGroup);
      
      this.keys.push({
        mesh: keyGroup,
        position: pos.clone(),
        collected: false
      });
    }
  }

  createWeirdObjects() {
    // Generate some procedural creepy props
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    
    for (let i = 0; i < 15; i++) {
      const pos = this.getRandomEmptyPositionFarFrom(this.spawnPosition, 2);
      
      const type = Math.random();
      const propGroup = new THREE.Group();
      
      if (type < 0.6) {
        // Creepy Chair clipping through floor
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), chairMat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), chairMat);
        back.position.set(0, 0.3, -0.2);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), chairMat);
        leg.position.set(0, -0.25, 0);
        
        propGroup.add(seat);
        propGroup.add(back);
        propGroup.add(leg);
        
        // Random crazy rotation
        propGroup.rotation.set(
          Math.random() * Math.PI, 
          Math.random() * Math.PI, 
          Math.random() * Math.PI
        );
        // Clip halfway into floor
        propGroup.position.set(pos.x, Math.random() * 0.5 - 0.2, pos.z);
      } else {
        // Upside down street sign
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
        const signMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 });
        
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5), poleMat);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), signMat);
        // Octagon shape approx
        sign.position.set(0, -1.0, 0.06);
        
        propGroup.add(pole);
        propGroup.add(sign);
        
        propGroup.rotation.z = Math.PI; // Upside down
        propGroup.rotation.y = Math.random() * Math.PI * 2;
        propGroup.position.set(pos.x, 1.2, pos.z);
      }
      
      this.sceneManager.add(propGroup);
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
    
    const wallMat = assetManager.getMaterial('wall');
    const floorMat = assetManager.getMaterial('floor');
    const ceilMat = assetManager.getMaterial('ceiling');
    
    this.wallMesh = new THREE.InstancedMesh(boxGeo, wallMat, wallCount);
    this.wallMesh.castShadow = true;
    this.wallMesh.receiveShadow = true;
    
    this.floorMesh = new THREE.InstancedMesh(planeGeo, floorMat, emptyCount);
    this.floorMesh.receiveShadow = true;
    
    this.ceilingMesh = new THREE.InstancedMesh(planeGeo, ceilMat, emptyCount);
    this.ceilingMesh.receiveShadow = true;

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
          
          // Place random lights - slightly increased frequency since ambient is brighter but we want more lamps
          if (Math.random() > 0.96 && this.ceilingLights.length < 50) {
            this.createCeilingLight(px, this.wallHeight - 0.1, pz);
          }
          
          emptyIdx++;
        }
      }
    }

    this.sceneManager.add(this.wallMesh);
    this.sceneManager.add(this.floorMesh);
    this.sceneManager.add(this.ceilingMesh);
    
    this.createWeirdObjects();
  }

  createCeilingLight(x, y, z) {
    // Dimmer light, shorter distance
    const light = new THREE.PointLight(0xfffae6, 0.2, 8);
    light.position.set(x, y, z);
    
    // Visual representation
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.1, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xfffae6 })
    );
    mesh.position.set(x, y, z);
    
    this.sceneManager.add(light);
    this.sceneManager.add(mesh);
    this.ceilingLights.push({ light, mesh, baseIntensity: 0.5 });
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
          emptyCoords.push(new THREE.Vector3(px, 0, pz));
        }
      }
    } else {
      for (let y = 0; y < this.grid.height; y++) {
        for (let x = 0; x < this.grid.width; x++) {
          if (!this.grid.isSolid(x, y)) {
            const px = x * this.tileSize;
            const pz = y * this.tileSize;
            const dist = Math.hypot(px - pos.x, pz - pos.z);
            if (dist >= minDistance) {
              emptyCoords.push(new THREE.Vector3(px, 0, pz));
            }
          }
        }
      }
    }
    if (emptyCoords.length === 0) return pos.clone();
    return emptyCoords[Math.floor(Math.random() * emptyCoords.length)];
  }

  isAtExit(position) {
    return position.distanceTo(this.exitPosition) < this.tileSize * 1.5;
  }
}
