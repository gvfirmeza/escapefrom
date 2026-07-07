export class InputController {
  constructor(domElement) {
    this.domElement = domElement;
    
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      c: false, // crouch
      ctrl: false, // alternative crouch
      f: false // flashlight
    };
    
    this.mouseX = 0;
    this.mouseY = 0;
    
    this.isLocked = false;
    this.onDebugToggle = null;
    this.onDebugJumpscare = null;
    this.onUnlock = null;
    
    // Bind events
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerlockChange = this.onPointerlockChange.bind(this);
    
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerlockChange);
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();
    
    if (key === 'd' && event.ctrlKey && event.shiftKey) {
      if (this.onDebugToggle) this.onDebugToggle();
      return;
    }
    
    if (key === 'j' && event.ctrlKey && event.shiftKey) {
      if (this.onDebugJumpscare) this.onDebugJumpscare();
      return;
    }
    
    if (this.keys.hasOwnProperty(key)) {
      this.keys[key] = true;
    }
    if (key === 'control') {
      this.keys.ctrl = true;
    }
  }

  onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (this.keys.hasOwnProperty(key)) {
      this.keys[key] = false;
    }
    if (key === 'control') {
      this.keys.ctrl = false;
    }
  }

  onMouseMove(event) {
    if (!this.isLocked) return;
    
    if (this.justLocked) {
      this.justLocked = false;
      return;
    }
    
    // Clamp movement to prevent browser cursor-wrap glitches (snapping 180 degrees)
    const maxDelta = 150;
    const mx = Math.max(-maxDelta, Math.min(maxDelta, event.movementX || 0));
    const my = Math.max(-maxDelta, Math.min(maxDelta, event.movementY || 0));
    
    this.mouseX += mx;
    this.mouseY += my;
  }

  onPointerlockChange() {
    this.isLocked = document.pointerLockElement !== null;
    if (!this.isLocked && this.onUnlock) {
      this.onUnlock();
    } else if (this.isLocked) {
      this.mouseX = 0;
      this.mouseY = 0;
      this.justLocked = true;
    }
  }

  lock() {
    document.body.requestPointerLock();
  }

  unlock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  getMovementDelta() {
    const x = this.mouseX;
    const y = this.mouseY;
    
    // Reset after reading to avoid drift
    this.mouseX = 0;
    this.mouseY = 0;
    
    return { x, y };
  }
}
