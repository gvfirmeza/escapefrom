export const TILE_EMPTY = 0;
export const TILE_WALL = 1;
export const TILE_SPAWN = 2;
export const TILE_EXIT = 3;

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    // Initialize with walls everywhere
    this.data = new Uint8Array(width * height).fill(TILE_WALL);
  }

  getIndex(x, y) {
    return y * this.width + x;
  }

  get(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TILE_WALL;
    return this.data[this.getIndex(x, y)];
  }

  set(x, y, value) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.data[this.getIndex(x, y)] = value;
  }

  isSolid(x, y) {
    return this.get(x, y) === TILE_WALL;
  }
}
