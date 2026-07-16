import { Game } from './core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  if (window.bridge) {
    bridge.initialize()
      .then(() => {
        console.log("Playgama Bridge initialized successfully.");
        bridge.storage.get('level')
          .then(data => {
            const game = new Game();
            // in v2, getting 'level' returns the value directly
            if (data !== undefined && data !== null) {
              game.currentLevelIndex = parseInt(data);
            }
            game.init().then(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    bridge.platform.sendMessage('game_ready');
                  }, 2000);
                });
              });
            });
          })
          .catch(e => {
            console.error("Storage get failed", e);
            const game = new Game();
            game.init().then(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    bridge.platform.sendMessage('game_ready');
                  }, 2000);
                });
              });
            });
          });
      })
      .catch(error => {
        console.error("Bridge initialization failed:", error);
        // Fallback to start game anyway
        const game = new Game();
        game.init().then(() => {
          // Normal start
        });
      });
  } else {
    // No bridge found, start normally
    const game = new Game();
    game.init().then(() => {
      // Normal start
    });
  }
});
