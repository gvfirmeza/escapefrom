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
    
    document.getElementById('btn-revive').addEventListener('click', () => {
      if (window.bridge && bridge.advertisement) {
        bridge.advertisement.showRewarded({
          onRewarded: () => {
            // Revive state change handled by Game.js via a custom event or callback
            window.dispatchEvent(new CustomEvent('revive_player'));
            stateManager.setState(GameState.PLAYING);
          },
          onClosed: () => {},
          onFailed: () => {}
        });
      }
    });

    document.getElementById('pause-screen').addEventListener('click', (e) => {
      // Don't unpause if clicking a button
      if (e.target.tagName !== 'BUTTON') {
        stateManager.setState(GameState.PLAYING);
      }
    });

    // Return to menu buttons
    document.querySelectorAll('.btn-menu:not(#btn-settings-main):not(#btn-settings-pause):not(#btn-close-settings)').forEach(btn => {
      btn.addEventListener('click', () => {
        stateManager.setState(GameState.MAIN_MENU);
      });
    });

    this.settingsScreen = document.getElementById('settings-screen');
    this.sensitivitySlider = document.getElementById('sensitivity-slider');
    this.sensitivityValue = document.getElementById('sensitivity-value');
    this.gammaSlider = document.getElementById('gamma-slider');
    this.gammaValue = document.getElementById('gamma-value');
    this.vcrToggle = document.getElementById('toggle-vcr');
    this.qualityBtns = document.querySelectorAll('.btn-quality');
    
    // Load settings
    this.settings = {
      sensitivity: parseInt(localStorage.getItem('br_sensitivity')) || 10,
      gamma: parseFloat(localStorage.getItem('br_gamma')) || 1.0,
      vcr: localStorage.getItem('br_vcr') !== 'false',
      quality: localStorage.getItem('br_quality') || ( ('ontouchstart' in window) ? 'low' : 'high' )
    };
    
    // Apply loaded settings to UI
    this.sensitivitySlider.value = this.settings.sensitivity;
    this.sensitivityValue.textContent = this.settings.sensitivity;
    this.gammaSlider.value = this.settings.gamma;
    this.gammaValue.textContent = this.settings.gamma;
    this.vcrToggle.checked = this.settings.vcr;
    this.qualityBtns.forEach(b => {
      if (b.dataset.quality === this.settings.quality) b.classList.add('active');
      else b.classList.remove('active');
    });

    // Dispatch initial event after a short delay to allow components to listen
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('settings_changed', { detail: this.settings }));
    }, 100);

    const openSettings = (e) => {
      e.stopPropagation();
      this.settingsScreen.classList.add('active');
    };
    
    document.getElementById('btn-settings-main').addEventListener('click', openSettings);
    document.getElementById('btn-settings-pause').addEventListener('click', openSettings);
    
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.settingsScreen.classList.remove('active');
    });

    this.sensitivitySlider.addEventListener('input', (e) => {
      this.settings.sensitivity = parseInt(e.target.value);
      this.sensitivityValue.textContent = this.settings.sensitivity;
      localStorage.setItem('br_sensitivity', this.settings.sensitivity);
      window.dispatchEvent(new CustomEvent('settings_changed', { detail: this.settings }));
    });

    this.gammaSlider.addEventListener('input', (e) => {
      this.settings.gamma = parseFloat(e.target.value);
      this.gammaValue.textContent = this.settings.gamma.toFixed(1);
      localStorage.setItem('br_gamma', this.settings.gamma);
      window.dispatchEvent(new CustomEvent('settings_changed', { detail: this.settings }));
    });

    this.vcrToggle.addEventListener('change', (e) => {
      this.settings.vcr = e.target.checked;
      document.body.classList.toggle('disable-vcr', !this.settings.vcr);
      localStorage.setItem('br_vcr', this.settings.vcr);
      window.dispatchEvent(new CustomEvent('settings_changed', { detail: this.settings }));
    });
    
    // Initial VCR class
    document.body.classList.toggle('disable-vcr', !this.settings.vcr);

    this.qualityBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.qualityBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.settings.quality = e.target.dataset.quality;
        localStorage.setItem('br_quality', this.settings.quality);
        window.dispatchEvent(new CustomEvent('settings_changed', { detail: this.settings }));
      });
    });

    // Listen to state changes
    stateManager.addListener(this.onStateChange.bind(this));
    
    // Toggle flashing lights
    const flashToggle = document.getElementById('toggle-flashing');
    if (flashToggle) {
      flashToggle.addEventListener('change', (e) => {
        if (!e.target.checked) {
          document.body.classList.add('safe-mode');
        } else {
          document.body.classList.remove('safe-mode');
        }
      });
    }
    
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
        tutorial_l2: "Turn 5 valves to drain the pool.<br>Don't look away.",
        understood: "UNDERSTOOD",
        interact: "Interact",
        interact_prompt: "[E] INTERACT",
        escaped: "YOU ESCAPED",
        found_exit: "You have found the exit.",
        restart: "RESTART",
        caught: "YOU WERE CAUGHT",
        it_found_you: "It found you.",
        paused: "PAUSED",
        resume: "Click to resume.",
        keys: "Keys: {0} / {1}",
        missing_keys: "You need {0} more keys!",
        valves: "Valves: {0} / {1}",
        missing_valves: "You need {0} more valves!",
        loading: "LOADING...",
        return_menu: "RETURN TO MENU",
        find_exit_obj: "FIND THE EXIT",
        enable_jumpscares: "Enable Jumpscares",
        enable_flashing: "Enable Flashing Lights",
        rotate_screen: "PLEASE ROTATE YOUR DEVICE",
        revive: "WATCH AD TO REVIVE",
        camera_sensitivity: "Camera Sensitivity",
        gamma_brightness: "Brightness (Gamma)",
        enable_vcr: "Enable VCR Effect",
        graphics_quality: "Graphics Quality",
        close: "CLOSE"
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
        tutorial_l2: "Gire 5 válvulas para esvaziar a piscina.<br>Não olhe para trás.",
        understood: "ENTENDI",
        interact: "Interagir",
        interact_prompt: "[E] INTERAGIR",
        escaped: "VOCÊ ESCAPOU",
        found_exit: "Você achou a saída.",
        restart: "REINICIAR",
        caught: "VOCÊ FOI PEGO",
        it_found_you: "Ele te achou.",
        paused: "PAUSADO",
        resume: "Clique para voltar.",
        keys: "Chaves: {0} / {1}",
        missing_keys: "Faltam {0} chaves para abrir a porta!",
        valves: "Válvulas: {0} / {1}",
        missing_valves: "Faltam {0} válvulas para esvaziar a piscina!",
        loading: "CARREGANDO...",
        return_menu: "VOLTAR AO MENU",
        find_exit_obj: "ENCONTRE A SAÍDA",
        enable_jumpscares: "Ativar Jumpscares",
        enable_flashing: "Ativar Luzes Piscantes",
        rotate_screen: "POR FAVOR, GIRE A TELA",
        revive: "ASSISTIR ANÚNCIO PARA REVIVER",
        camera_sensitivity: "Sensibilidade da Câmera",
        gamma_brightness: "Brilho (Gamma)",
        enable_vcr: "Efeito VCR/VHS",
        graphics_quality: "Qualidade Gráfica",
        close: "FECHAR"
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
        tutorial_l2: "Gira 5 válvulas para vaciar la piscina.<br>No apartes la mirada.",
        understood: "ENTENDIDO",
        interact: "Interactuar",
        interact_prompt: "[E] INTERACTUAR",
        escaped: "ESCAPASTE",
        found_exit: "Has encontrado la salida.",
        restart: "REINICIAR",
        caught: "FUISTE ATRAPADO",
        it_found_you: "Te encontró.",
        paused: "PAUSADO",
        resume: "Haz clic para volver.",
        keys: "Llaves: {0} / {1}",
        missing_keys: "¡Faltan {0} llaves!",
        valves: "Válvulas: {0} / {1}",
        missing_valves: "¡Faltan {0} válvulas!",
        loading: "CARGANDO...",
        return_menu: "VOLVER AL MENÚ",
        find_exit_obj: "ENCUENTRA LA SALIDA",
        enable_jumpscares: "Activar Jumpscares",
        enable_flashing: "Activar Luces Parpadeantes",
        rotate_screen: "POR FAVOR, GIRE LA PANTALLA",
        revive: "VER ANUNCIO PARA REVIVIR",
        camera_sensitivity: "Sensibilidad de la Cámara",
        gamma_brightness: "Brillo (Gamma)",
        enable_vcr: "Efecto VCR/VHS",
        graphics_quality: "Calidad Gráfica",
        close: "CERRAR"
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
        tutorial_l2: "Tournez 5 vannes pour vider la piscine.<br>Ne détournez pas le regard.",
        understood: "COMPRIS",
        interact: "Interagir",
        interact_prompt: "[E] INTERAGIR",
        escaped: "VOUS VOUS ÊTES ÉCHAPPÉ",
        found_exit: "Vous avez trouvé la sortie.",
        restart: "RECOMMENCER",
        caught: "VOUS AVEZ ÉTÉ ATTRAPÉ",
        it_found_you: "Il vous a trouvé.",
        paused: "EN PAUSE",
        resume: "Cliquez pour reprendre.",
        keys: "Clés: {0} / {1}",
        missing_keys: "Il vous manque {0} clés!",
        valves: "Vannes: {0} / {1}",
        missing_valves: "Il vous manque {0} vannes!",
        loading: "CHARGEMENT...",
        return_menu: "RETOUR AU MENU",
        find_exit_obj: "TROUVEZ LA SORTIE",
        enable_jumpscares: "Activer Jumpscares",
        enable_flashing: "Activer Lumières Clignotantes",
        rotate_screen: "VEUILLEZ TOURNER L'ÉCRAN",
        revive: "REGARDER LA PUB POUR REVIVRE",
        camera_sensitivity: "Sensibilité de la Caméra",
        gamma_brightness: "Luminosité (Gamma)",
        enable_vcr: "Effet VCR/VHS",
        graphics_quality: "Qualité Graphique",
        close: "FERMER"
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
    
    // Auto-sync language with Playgama SDK if available
    if (window.bridge && window.bridge.platform && window.bridge.platform.language) {
      const bridgeLang = window.bridge.platform.language.toLowerCase().substring(0, 2);
      if (this.translations[bridgeLang]) {
        this.currentLang = bridgeLang;
      }
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
      this.updateKeys(this.lastKeysCurrent, this.lastKeysTotal, this.lastIsLevel2);
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
    
    // Manage Revive Button visibility
    if (activeState === GameState.DEFEAT) {
      const btnRevive = document.getElementById('btn-revive');
      if (btnRevive && window.bridge && window.bridge.advertisement && window.bridge.advertisement.isRewardedSupported) {
        btnRevive.style.display = 'inline-flex';
      }
    }
    
    // Manage Banners
    if (window.bridge && window.bridge.advertisement) {
      if (activeState === GameState.MAIN_MENU || activeState === GameState.PAUSED) {
        bridge.advertisement.showBanner('bottom');
      } else {
        bridge.advertisement.hideBanner();
      }
    }
    
    // Manage mobile controls
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const mobileControls = document.getElementById('mobile-controls');
    if (mobileControls && isMobile) {
      if (activeState === GameState.PLAYING) {
        mobileControls.style.display = 'block';
      } else {
        mobileControls.style.display = 'none';
      }
    }
  }
  
  updateTutorial(isLevel2) {
    const tutorialEl = document.querySelector('#tutorial-screen .tutorial-text');
    if (tutorialEl) {
      const keyStr = isLevel2 ? 'tutorial_l2' : 'tutorial';
      tutorialEl.innerHTML = this.translations[this.currentLang][keyStr];
    }
  }
  
  updateKeys(current, total, isLevel2 = false) {
    this.lastKeysCurrent = current;
    this.lastKeysTotal = total;
    this.lastIsLevel2 = isLevel2;
    if (this.keyCounter) {
      const keyStr = isLevel2 ? 'valves' : 'keys';
      const t = this.translations[this.currentLang][keyStr];
      this.keyCounter.textContent = t.replace('{0}', current).replace('{1}', total);
    }
  }
  
  showMissingKeysNotification(count, isLevel2 = false) {
    if (!this.toast) return;
    const keyStr = isLevel2 ? 'missing_valves' : 'missing_keys';
    const t = this.translations[this.currentLang][keyStr];
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
