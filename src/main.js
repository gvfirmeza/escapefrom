import { Game } from './core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  if (window.bridge) {
    bridge.initialize()
      .then(() => {
        console.log("Playgama Bridge initialized successfully.");
        bridge.storage.get()
          .then(data => {
            const game = new Game();
            if (data && data.level) {
              game.currentLevelIndex = data.level;
            }
            game.init();
            bridge.platform.sendMessage('game_ready');
          })
          .catch(e => {
            console.error("Storage get failed", e);
            const game = new Game();
            game.init();
            bridge.platform.sendMessage('game_ready');
          });
      })
      .catch(error => {
        console.error("Bridge initialization failed:", error);
        // Fallback to start game anyway
        const game = new Game();
        game.init();
      });
  } else {
    // No bridge found, start normally
    const game = new Game();
    game.init();
  }
});
