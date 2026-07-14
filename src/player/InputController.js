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
      f: false, // flashlight
      e: false // interact
    };
    
    this.mouseX = 0;
    this.mouseY = 0;
    
    this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.joystickVector = { x: 0, y: 0 };
    this.touchStartCamera = { x: 0, y: 0 };
    this.activeCameraTouchId = null;
    this.activeJoystickTouchId = null;
    
    this.toggleRunEnabled = false;
    window.addEventListener('settings_changed', (e) => {
      if (e.detail && e.detail.toggleRun !== undefined) {
        this.toggleRunEnabled = e.detail.toggleRun;
        // reset shift state when toggling settings
        this.keys.shift = false;
        const btn = document.getElementById('btn-mobile-run');
        if (btn) btn.classList.remove('active');
      }
    });
    
    // Bind events
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerlockChange = this.onPointerlockChange.bind(this);
    this.setupMobileControls = this.setupMobileControls.bind(this);
    
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerlockChange);
    if (this.isMobile) {
      this.setupMobileControls();
    }
  }

  setupMobileControls() {
    // Joystick
    const joystickZone = document.getElementById('joystick-zone');
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');
    
    if (joystickZone) {
      const handleJoystickStart = (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.activeJoystickTouchId = touch.identifier;
        this.updateJoystick(touch, joystickBase, joystickStick);
      };
      
      const handleJoystickMove = (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.activeJoystickTouchId) {
            this.updateJoystick(e.changedTouches[i], joystickBase, joystickStick);
          }
        }
      };
      
      const handleJoystickEnd = (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.activeJoystickTouchId) {
            this.activeJoystickTouchId = null;
            this.joystickVector.x = 0;
            this.joystickVector.y = 0;
            if (joystickStick) joystickStick.style.transform = `translate(-50%, -50%)`;
          }
        }
      };
      
      joystickZone.addEventListener('touchstart', handleJoystickStart, { passive: false });
      joystickZone.addEventListener('touchmove', handleJoystickMove, { passive: false });
      joystickZone.addEventListener('touchend', handleJoystickEnd);
      joystickZone.addEventListener('touchcancel', handleJoystickEnd);
    }
    
    // Camera
    const cameraZone = document.getElementById('camera-zone');
    if (cameraZone) {
      cameraZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.activeCameraTouchId === null) {
          const touch = e.changedTouches[0];
          this.activeCameraTouchId = touch.identifier;
          this.touchStartCamera.x = touch.clientX;
          this.touchStartCamera.y = touch.clientY;
        }
      }, { passive: false });
      
      cameraZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.activeCameraTouchId) {
            const touch = e.changedTouches[i];
            const dx = touch.clientX - this.touchStartCamera.x;
            const dy = touch.clientY - this.touchStartCamera.y;
            
            // Apply mouse sensitivity scale to touch
            this.mouseX += dx;
            this.mouseY += dy;
            
            this.touchStartCamera.x = touch.clientX;
            this.touchStartCamera.y = touch.clientY;
          }
        }
      }, { passive: false });
      
      const handleCameraEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.activeCameraTouchId) {
            this.activeCameraTouchId = null;
          }
        }
      };
      
      cameraZone.addEventListener('touchend', handleCameraEnd);
      cameraZone.addEventListener('touchcancel', handleCameraEnd);
    }
    
    // Buttons
    this.bindMobileButton('btn-mobile-interact', 'e');
    this.bindMobileButton('btn-mobile-run', 'shift');
    this.bindMobileButton('btn-mobile-crouch', 'c');
    this.bindMobileButton('btn-mobile-flashlight', 'f');
    
    // Pause button
    const btnPause = document.getElementById('btn-mobile-pause');
    if (btnPause) {
      btnPause.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onUnlock) this.onUnlock();
      });
    }
  }
  
  bindMobileButton(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    
    const startEvent = (e) => {
      e.preventDefault();
      if (key === 'shift' && this.toggleRunEnabled) {
        this.keys[key] = !this.keys[key];
        if (this.keys[key]) {
          btn.classList.add('active');
          btn.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.5)"; // visual active state
        } else {
          btn.classList.remove('active');
          btn.style.boxShadow = "";
        }
      } else {
        this.keys[key] = true;
      }
    };
    
    const endEvent = (e) => {
      e.preventDefault();
      if (key === 'shift' && this.toggleRunEnabled) {
        // Do nothing on release if it's toggle
        return;
      }
      this.keys[key] = false;
    };
    
    btn.addEventListener('touchstart', startEvent, { passive: false });
    btn.addEventListener('touchend', endEvent);
    btn.addEventListener('touchcancel', endEvent);
  }

  updateJoystick(touch, base, stick) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    
    const maxRadius = rect.width / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    // Normalized vector -1 to 1
    this.joystickVector.x = dx / maxRadius;
    this.joystickVector.y = dy / maxRadius; // y is down in screen coords, up in game
    
    if (stick) {
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
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
    
    if (key === 'k' && event.ctrlKey && event.shiftKey) {
      if (this.onSkipLevel) this.onSkipLevel();
      return;
    }
    
    if (this.keys.hasOwnProperty(key)) {
      if (key === 'shift' && this.toggleRunEnabled) {
        // Toggle on keydown, prevent holding
        if (!event.repeat) {
          this.keys[key] = !this.keys[key];
        }
      } else {
        this.keys[key] = true;
      }
    }
    if (key === 'control') {
      this.keys.ctrl = true;
    }
  }

  onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (this.keys.hasOwnProperty(key)) {
      if (key === 'shift' && this.toggleRunEnabled) {
        // Do nothing on key up if toggle is enabled
      } else {
        this.keys[key] = false;
      }
    }
    if (key === 'control') {
      this.keys.ctrl = false;
    }
  }

  onMouseMove(event) {
    if (!this.isLocked && !this.isMobile) return;
    
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
    if (!this.isMobile) {
      document.body.requestPointerLock();
    } else {
      this.isLocked = true;
    }
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
