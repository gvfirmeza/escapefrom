export const GameState = {
  MAIN_MENU: 'MAIN_MENU',
  TUTORIAL: 'TUTORIAL',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
  JUMPSCARE: 'JUMPSCARE'
};

export class StateManager {
  constructor() {
    this.currentState = GameState.MAIN_MENU;
    this.listeners = [];
  }

  setState(newState) {
    if (this.currentState === newState) return;
    
    const oldState = this.currentState;
    this.currentState = newState;
    
    this.notifyListeners(newState, oldState);
  }

  getState() {
    return this.currentState;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  notifyListeners(newState, oldState) {
    for (const listener of this.listeners) {
      listener(newState, oldState);
    }
  }
}

export const stateManager = new StateManager();
