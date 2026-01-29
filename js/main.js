/*
 * main.js
 *
 * Core logic for Estratégia 2030. This file manages screen transitions,
 * saves/loads game state from localStorage and handles the initial
 * storytelling sequence. Additional modules (relations, war, commerce,
 * infrastructure and admin) live in their own scripts. The game state
 * lives in a simple object that can be persisted and extended later.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Keep track of current save slot and state
  let currentSlot = null;
  let gameState = null;

  // Screen elements
  const screens = {
    splash: document.getElementById('splash'),
    menu: document.getElementById('menu'),
    newGame: document.getElementById('new-game'),
    loadGame: document.getElementById('load-game'),
    message: document.getElementById('message'),
    lobby: document.getElementById('lobby'),
  };

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // After a brief splash, show the main menu
  setTimeout(() => {
    showScreen('menu');
  }, 2000);

  // Menu buttons
  const newGameBtn = document.getElementById('newGameBtn');
  const continueBtn = document.getElementById('continueBtn');
  const backToMenuFromNew = document.getElementById('backToMenuFromNew');
  const backToMenuFromLoad = document.getElementById('backToMenuFromLoad');

  newGameBtn.addEventListener('click', () => {
    showScreen('newGame');
  });

  continueBtn.addEventListener('click', () => {
    populateSaves();
    showScreen('loadGame');
  });

  backToMenuFromNew.addEventListener('click', () => {
    showScreen('menu');
  });

  backToMenuFromLoad.addEventListener('click', () => {
    showScreen('menu');
  });

  // New game form
  const newGameForm = document.getElementById('newGameForm');
  newGameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('playerName').value.trim();
    const nation = document.getElementById('nation').value;
    if (!name) return;
    // Create initial state
    gameState = {
      name,
      nation,
      funds: 1000000,
      month: 1,
      year: 2030,
      army: 0,
      navy: 0,
      airforce: 0,
      missions: [],
    };
    // Determine available slot (3 slots)
    currentSlot = findFreeSlot();
    saveGame(currentSlot, gameState);
    // Begin the story introduction
    showIntroMessage();
  });

  // Populate save slots for continue
  function populateSaves() {
    const container = document.getElementById('saveSlots');
    container.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      const key = `save-slot-${i}`;
      const data = localStorage.getItem(key);
      const btn = document.createElement('button');
      btn.className = 'save-slot-btn';
      if (data) {
        const obj = JSON.parse(data);
        btn.textContent = `${i}. ${obj.name} - ${obj.nation} - Saldo: ${formatCurrency(
          obj.funds
        )}`;
        btn.addEventListener('click', () => {
          currentSlot = key;
          gameState = obj;
          startLobby();
        });
      } else {
        btn.textContent = `${i}. (vazio)`;
        btn.disabled = true;
      }
      container.appendChild(btn);
    }
  }

  // Find first free slot or overwrite the oldest
  function findFreeSlot() {
    for (let i = 1; i <= 3; i++) {
      const key = `save-slot-${i}`;
      if (!localStorage.getItem(key)) return key;
    }
    return 'save-slot-1';
  }

  // Save current game state
  function saveGame(slot, state) {
    localStorage.setItem(slot, JSON.stringify(state));
  }

  // Format numbers as currency
  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  // Typed message effect for intro
  function showIntroMessage() {
    showScreen('message');
    const messageEl = document.getElementById('message-content');
    const continueBtn = document.getElementById('continueToLobby');
    continueBtn.classList.add('hidden');
    messageEl.textContent = '';
    const text =
      `Sr(a) ${gameState.name}, fui informado pelas autoridades locais que o centro governamental do nosso país foi invadido e membros do alto escalão foram mortos, incluindo presidente, vice-presidente e alguns ministros. Sendo assim, você como comandante das forças armadas, a fim de restabelecer a paz e a ordem, precisa assumir o comando de nossa nação. Boa sorte.`;
    let index = 0;
    function type() {
      if (index < text.length) {
        messageEl.textContent += text.charAt(index);
        index++;
        setTimeout(type, 30);
      } else {
        continueBtn.classList.remove('hidden');
      }
    }
    type();
    continueBtn.addEventListener('click', startLobby);
  }

  // Start lobby screen
  function startLobby() {
    // Persist latest state
    saveGame(currentSlot, gameState);
    // Display state in lobby
    document.getElementById('playerNameDisplay').textContent = gameState.name;
    document.getElementById('playerNationDisplay').textContent = `(${gameState.nation})`;
    document.getElementById('fundsDisplay').textContent = formatCurrency(gameState.funds);
    showScreen('lobby');
  }

  // Lobby buttons navigate to modules
  document.getElementById('relationsBtn').addEventListener('click', () => {
    window.location.href = 'relations.html';
  });
  document.getElementById('warBtn').addEventListener('click', () => {
    window.location.href = 'war.html';
  });
  document.getElementById('commerceBtn').addEventListener('click', () => {
    window.location.href = 'commerce.html';
  });
  document.getElementById('infraBtn').addEventListener('click', () => {
    window.location.href = 'infrastructure.html';
  });
});