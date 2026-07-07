export class Pathfinding {
  constructor(grid) {
    this.grid = grid;
  }

  // Find path from start to end (world coordinates -> grid coords -> A* -> world coords)
  findPath(startX, startZ, endX, endZ, tileSize) {
    const startGridX = Math.round(startX / tileSize);
    const startGridZ = Math.round(startZ / tileSize);
    const endGridX = Math.round(endX / tileSize);
    const endGridZ = Math.round(endZ / tileSize);

    if (this.grid.isSolid(endGridX, endGridZ)) {
      return null; // Invalid destination
    }

    // Simple BFS for guaranteed path finding on this small grid (30x30)
    // A* is better but BFS is perfectly fine and simple for < 1000 nodes
    const queue = [{x: startGridX, z: startGridZ, path: []}];
    const visited = new Set();
    visited.add(`${startGridX},${startGridZ}`);

    const directions = [
      {dx: 0, dz: 1},
      {dx: 1, dz: 0},
      {dx: 0, dz: -1},
      {dx: -1, dz: 0}
    ];

    let iterations = 0;
    while (queue.length > 0 && iterations < 1000) {
      iterations++;
      const current = queue.shift();

      if (current.x === endGridX && current.z === endGridZ) {
        // Convert path back to world coordinates
        return current.path.map(p => ({
          x: p.x * tileSize,
          z: p.z * tileSize
        }));
      }

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const nz = current.z + dir.dz;
        const key = `${nx},${nz}`;

        if (!visited.has(key) && !this.grid.isSolid(nx, nz)) {
          visited.add(key);
          queue.push({
            x: nx,
            z: nz,
            path: [...current.path, {x: nx, z: nz}]
          });
        }
      }
    }

    return null; // No path found
  }
}
