export class CollisionSystem {
  constructor() {
    this.grid = null;
    this.tileSize = 2; // meters
  }

  setGrid(grid) {
    this.grid = grid;
  }

  // Returns true if there is a collision
  checkCollision(x, z, radius) {
    if (!this.grid) return false;

    // Convert world coordinates to grid coordinates
    // Assuming world (0,0) is grid (0,0) and each tile is tileSize x tileSize
    // Since we center the tile at x,z = gridX*size, gridZ*size:
    // So gridX = Math.round(x / tileSize)
    
    // We check the corners of the bounding box
    const minX = x - radius;
    const maxX = x + radius;
    const minZ = z - radius;
    const maxZ = z + radius;

    const startGridX = Math.round(minX / this.tileSize);
    const endGridX = Math.round(maxX / this.tileSize);
    const startGridZ = Math.round(minZ / this.tileSize);
    const endGridZ = Math.round(maxZ / this.tileSize);

    for (let gz = startGridZ; gz <= endGridZ; gz++) {
      for (let gx = startGridX; gx <= endGridX; gx++) {
        if (this.grid.isSolid(gx, gz)) {
          // Calculate the bounding box of the solid tile
          const tileMinX = gx * this.tileSize - this.tileSize / 2;
          const tileMaxX = gx * this.tileSize + this.tileSize / 2;
          const tileMinZ = gz * this.tileSize - this.tileSize / 2;
          const tileMaxZ = gz * this.tileSize + this.tileSize / 2;

          // AABB Intersection check
          if (
            minX < tileMaxX &&
            maxX > tileMinX &&
            minZ < tileMaxZ &&
            maxZ > tileMinZ
          ) {
            return true; // Collision detected
          }
        }
      }
    }

    return false;
  }
}
