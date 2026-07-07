import { stateManager, GameState } from '../core/StateManager.js';

export class UIManager {
  constructor() {
    this.screens = {
      [GameState.MAIN_MENU]: document.getElementById('main-menu'),
      [GameState.TUTORIAL]: document.getElementById('tutorial-screen'),
      [GameState.LOADING]: document.getElementById('loading-screen'),
      [GameState.PLAYING]: document.getElementById('hud'),
      [GameState.PAUSED]: document.getElementById('pause-screen'),
      [GameState.VICTORY]: document.getElementById('victory-screen'),
      [GameState.DEFEAT]: document.getElementById('defeat-screen'),
      [GameState.JUMPSCARE]: document.getElementById('jumpscare-screen')
    };
    
    this.keyCounter = document.getElementById('key-counter');
    this.toast = document.getElementById('notification-toast');
    this.toastTimeout = null;

    // Bind buttons
    document.getElementById('btn-start').addEventListener('click', () => {
      stateManager.setState(GameState.TUTORIAL);
    });
    
    document.getElementById('btn-start-tutorial').addEventListener('click', () => {
      stateManager.setState(GameState.PLAYING);
    });

    document.getElementById('btn-restart-win').addEventListener('click', () => {
      stateManager.setState(GameState.PLAYING);
    });

    document.getElementById('btn-restart-lose').addEventListener('click', () => {
      stateManager.setState(GameState.PLAYING);
    });

    document.getElementById('pause-screen').addEventListener('click', (e) => {
      // Don't unpause if clicking a button
      if (e.target.tagName !== 'BUTTON') {
        stateManager.setState(GameState.PLAYING);
      }
    });

    // Return to menu buttons
    document.querySelectorAll('.btn-menu').forEach(btn => {
      btn.addEventListener('click', () => {
        stateManager.setState(GameState.MAIN_MENU);
      });
    });

    // Listen to state changes
    stateManager.addListener(this.onStateChange.bind(this));
    
    // Initial sync
    this.updateScreens(stateManager.getState());
    
    // Localization
    this.translations = {
      en: {
        warning: "Warning: Contains flashing lights and loud noises.",
        start: "START EXPLORATION",
        move: "Move",
        look: "Look",
        run: "Run",
        crouch: "Crouch",
        flashlight: "Flashlight",
        objective: "OBJECTIVE",
        tutorial: "Collect 5 keys and find the exit.<br>Beware.",
        understood: "UNDERSTOOD",
        escaped: "YOU ESCAPED",
        found_exit: "You have found the exit.",
        restart: "RESTART",
        caught: "YOU WERE CAUGHT",
        it_found_you: "It found you.",
        paused: "PAUSED",
        resume: "Click to resume.",
        keys: "Keys: {0} / {1}",
        missing_keys: "You need {0} more keys!",
        loading: "LOADING...",
        return_menu: "RETURN TO MENU",
        find_exit_obj: "FIND THE EXIT"
      },
      pt: {
        warning: "Aviso: Contém luzes piscantes e sons altos.",
        start: "INICIAR EXPLORAÇÃO",
        move: "Mover",
        look: "Olhar",
        run: "Correr",
        crouch: "Agachar",
        flashlight: "Lanterna",
        objective: "OBJETIVO",
        tutorial: "Colete 5 chaves e ache a saída.<br>Cuidado.",
        understood: "ENTENDI",
        escaped: "VOCÊ ESCAPOU",
        found_exit: "Você achou a saída.",
        restart: "REINICIAR",
        caught: "VOCÊ FOI PEGO",
        it_found_you: "Ele te achou.",
        paused: "PAUSADO",
        resume: "Clique para voltar.",
        keys: "Chaves: {0} / {1}",
        missing_keys: "Faltam {0} chaves para abrir a porta!",
        loading: "CARREGANDO...",
        return_menu: "VOLTAR AO MENU",
        find_exit_obj: "ENCONTRE A SAÍDA"
      },
      es: {
        warning: "Aviso: Contiene luces intermitentes y sonidos fuertes.",
        start: "INICIAR EXPLORACIÓN",
        move: "Mover",
        look: "Mirar",
        run: "Correr",
        crouch: "Agacharse",
        flashlight: "Linterna",
        objective: "OBJETIVO",
        tutorial: "Recoge 5 llaves y encuentra la salida.<br>Cuidado.",
        understood: "ENTENDIDO",
        escaped: "ESCAPASTE",
        found_exit: "Has encontrado la salida.",
        restart: "REINICIAR",
        caught: "FUISTE ATRAPADO",
        it_found_you: "Te encontró.",
        paused: "PAUSADO",
        resume: "Haz clic para volver.",
        keys: "Llaves: {0} / {1}",
        missing_keys: "¡Faltan {0} llaves!",
        loading: "CARGANDO...",
        return_menu: "VOLVER AL MENÚ",
        find_exit_obj: "ENCUENTRA LA SALIDA"
      },
      fr: {
        warning: "Avertissement: Contient des lumières clignotantes et des sons forts.",
        start: "COMMENCER L'EXPLORATION",
        move: "Bouger",
        look: "Regarder",
        run: "Courir",
        crouch: "S'accroupir",
        flashlight: "Lampe de poche",
        objective: "OBJECTIF",
        tutorial: "Trouvez 5 clés et la sortie.<br>Attention.",
        understood: "COMPRIS",
        escaped: "VOUS VOUS ÊTES ÉCHAPPÉ",
        found_exit: "Vous avez trouvé la sortie.",
        restart: "RECOMMENCER",
        caught: "VOUS AVEZ ÉTÉ ATTRAPÉ",
        it_found_you: "Il vous a trouvé.",
        paused: "EN PAUSE",
        resume: "Cliquez pour reprendre.",
        keys: "Clés: {0} / {1}",
        missing_keys: "Il vous manque {0} clés!",
        loading: "CHARGEMENT...",
        return_menu: "RETOUR AU MENU",
        find_exit_obj: "TROUVEZ LA SORTIE"
      }
    };
    
    this.currentLang = 'en';
    const langCurrent = document.getElementById('lang-current');
    const langOptions = document.getElementById('lang-options');
    
    if (langCurrent && langOptions) {
      // Setup initial text
      const initialOpt = langOptions.querySelector(`[data-value="${this.currentLang}"]`);
      if (initialOpt) langCurrent.textContent = initialOpt.textContent;
      
      langCurrent.addEventListener('click', (e) => {
        e.stopPropagation();
        langOptions.classList.toggle('select-hide');
      });
      
      langOptions.querySelectorAll('div').forEach(opt => {
        opt.addEventListener('click', (e) => {
          const val = opt.getAttribute('data-value');
          langCurrent.textContent = opt.textContent;
          this.setLanguage(val);
          langOptions.classList.add('select-hide');
        });
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        langOptions.classList.add('select-hide');
      });
    }
    
    this.setLanguage(this.currentLang);
  }

  setLanguage(langCode) {
    if (!this.translations[langCode]) return;
    this.currentLang = langCode;
    const dict = this.translations[langCode];
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.innerHTML = dict[key];
      }
    });
    
    // Update active HUD keys counter if needed
    if (this.lastKeysTotal) {
      this.updateKeys(this.lastKeysCurrent, this.lastKeysTotal);
    }
  }

  onStateChange(newState, oldState) {
    this.updateScreens(newState);
  }

  updateScreens(activeState) {
    for (const [state, element] of Object.entries(this.screens)) {
      if (element) {
        if (state === activeState) {
          element.classList.add('active');
        } else {
          element.classList.remove('active');
        }
      }
    }
  }
  
  updateKeys(current, total) {
    this.lastKeysCurrent = current;
    this.lastKeysTotal = total;
    if (this.keyCounter) {
      const t = this.translations[this.currentLang].keys;
      this.keyCounter.textContent = t.replace('{0}', current).replace('{1}', total);
    }
  }
  
  showMissingKeysNotification(count) {
    if (!this.toast) return;
    const t = this.translations[this.currentLang].missing_keys;
    this.showNotification(t.replace('{0}', count));
  }

  showNotification(message) {
    if (!this.toast) return;
    
    this.toast.textContent = message;
    this.toast.classList.remove('hidden');
    
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add('hidden');
    }, 2500);
  }
}
