/*
 * main.js — World Protocol
 *
 * Screen router + UI glue for the landing flow:
 * Splash -> Menu -> (New Game / Continue) -> Intro -> Lobby
 *
 * Uses WP core (js/core.js) for state management.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const screens = {
    splash: document.getElementById('splash'),
    menu: document.getElementById('menu'),
    newGame: document.getElementById('new-game'),
    loadGame: document.getElementById('load-game'),
    message: document.getElementById('message'),
    lobby: document.getElementById('lobby'),
  };

  let content = { nations: [], missions: [] };
  try {
    content = await WP.loadContent();
  } catch {
    // ignore
  }

  // Populate nation select dynamically (base + DLC)
  const nationSelect = document.getElementById('nation');
  if (nationSelect && content.nations?.length) {
    nationSelect.innerHTML = '';
    content.nations.forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      nationSelect.appendChild(opt);
    });
  }

  function show(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function getUrlParam(key) {
    try {
      return new URLSearchParams(location.search).get(key);
    } catch {
      return null;
    }
  }

  // Splash -> Menu
  // Accept slot from URL (when returning from a module)
  const slotFromUrl = getUrlParam('slot');
  if (slotFromUrl && WP.SLOT_KEYS.includes(slotFromUrl) && WP.loadState(slotFromUrl)) {
    WP.setActiveSlot(slotFromUrl);
  }

  // If we are resuming from a module (index.html?resume=1), jump straight to lobby.
  const resume = getUrlParam('resume') === '1';

  setTimeout(() => {
    if (resume && WP.getActiveSlot() && WP.loadState(WP.getActiveSlot())) {
      startLobby();
    } else {
      show('menu');
    }
  }, 1500);

  // Buttons
  const newGameBtn = document.getElementById('newGameBtn');
  const continueBtn = document.getElementById('continueBtn');
  const backToMenuFromNew = document.getElementById('backToMenuFromNew');
  const backToMenuFromLoad = document.getElementById('backToMenuFromLoad');

  newGameBtn.addEventListener('click', () => {
    populateNewSlots();
    show('newGame');
  });
  continueBtn.addEventListener('click', () => {
    populateSaves();
    show('loadGame');
  });
  backToMenuFromNew.addEventListener('click', () => show('menu'));
  backToMenuFromLoad.addEventListener('click', () => show('menu'));

  // New game
  const newGameForm = document.getElementById('newGameForm');
  let selectedNewSlot = null;

  function populateNewSlots() {
    const container = document.getElementById('newSaveSlots');
    if (!container) return;
    container.innerHTML = '';

    // Default to first free slot, otherwise Slot 1
    const free = WP.findFreeSlot();
    selectedNewSlot = free || WP.SLOT_KEYS[0];

    WP.SLOT_KEYS.forEach((key, idx) => {
      const state = WP.loadState(key);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'save-slot-btn';

      const label = state
        ? `${idx + 1}. ${state.player?.name} • ${state.player?.nation} • ${WP.monthName(state.calendar?.month ?? 1)}/${state.calendar?.year ?? 2030}`
        : `${idx + 1}. (vazio)`;

      btn.textContent = label;
      if (key === selectedNewSlot) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        selectedNewSlot = key;
        [...container.querySelectorAll('.save-slot-btn')].forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });

      container.appendChild(btn);
    });
  }

  newGameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('playerName').value.trim();
    const nation = document.getElementById('nation').value;
    if (!name) return;

    const slot = selectedNewSlot || WP.findFreeSlot() || WP.SLOT_KEYS[0];
    const state = WP.createNewState({ name, nation, content });
    WP.saveState(slot, state);
    WP.setActiveSlot(slot);
    showIntro(state);
  });

  // Continue
  function populateSaves() {
    const container = document.getElementById('saveSlots');
    container.innerHTML = '';
    WP.SLOT_KEYS.forEach((key, idx) => {
      const btn = document.createElement('button');
      btn.className = 'save-slot-btn';
      const state = WP.loadState(key);
      if (!state) {
        btn.textContent = `${idx + 1}. (vazio)`;
        btn.disabled = true;
      } else {
        const yr = state.calendar?.year ?? 2030;
        const mo = WP.monthName(state.calendar?.month ?? 1);
        btn.textContent = `${idx + 1}. ${state.player?.name} • ${state.player?.nation} • ${mo}/${yr} • ${WP.formatMoney(state.economy?.funds ?? 0)}`;
        btn.addEventListener('click', () => {
          WP.setActiveSlot(key);
          startLobby();
        });
      }
      container.appendChild(btn);
    });
  }

  // Intro (typewriter)
  function showIntro(state) {
    show('message');
    const messageEl = document.getElementById('message-content');
    const cont = document.getElementById('continueToLobby');
    const skip = document.getElementById('skipIntro');
    cont.classList.add('hidden');
    messageEl.textContent = '';

    const txt =
      `Sr(a) ${state.player.name},\n\n` +
      `Relatório crítico: o Centro Governamental foi invadido. Integrantes do alto escalão foram assassinados, incluindo Presidente, Vice-Presidente, ministros e deputados.\n\n` +
      `Em regime de emergência e conforme o Protocolo de Continuidade de Estado, o(a) senhor(a) — Comandante Supremo das Forças Armadas — deve assumir o comando provisório da nação (${state.player.nation}).\n\n` +
      `Objetivos imediatos:\n` +
      `1) Neutralizar a insurgência interna\n` +
      `2) Restabelecer ordem e estabilidade\n` +
      `3) Proteger fronteiras e assegurar soberania\n\n` +
      `Boa sorte, Comandante. O mundo está observando.`;

    let i = 0;
    let stopped = false;
    const speed = 18;
    const cursor = document.createElement('span');
    cursor.textContent = '▍';
    cursor.style.opacity = '0.85';
    cursor.style.marginLeft = '2px';
    messageEl.appendChild(cursor);

    function finish() {
      if (stopped) return;
      stopped = true;
      messageEl.textContent = txt;
      cont.classList.remove('hidden');
    }

    (function type() {
      if (stopped) return;
      // insert before cursor
      cursor.before(document.createTextNode(txt.charAt(i++)));
      if (i < txt.length) {
        setTimeout(type, speed);
      } else {
        // remove cursor
        cursor.remove();
        cont.classList.remove('hidden');
      }
    })();

    if (skip) {
      skip.onclick = () => {
        cursor.remove();
        finish();
      };
    }

    cont.onclick = () => startLobby();
  }

  // Lobby
  const missionsBackdrop = document.getElementById('missionsModal');
  const missionsList = document.getElementById('missionsList');
  const closeMissions = document.getElementById('closeMissions');
  const hudCommander = document.getElementById('hudCommander');
  const hudDate = document.getElementById('hudDate');
  const hudFunds = document.getElementById('hudFunds');
  const hudIncome = document.getElementById('hudIncome');
  const hudMissions = document.getElementById('hudMissions');
  const hudNextTurn = document.getElementById('hudNextTurn');
  const hudSave = document.getElementById('hudSave');

  function getStateOrRedirect() {
    const slot = WP.getActiveSlot();
    if (!slot) return null;
    const st = WP.loadState(slot);
    if (!st) return null;
    return { slot, st };
  }

  function updateHud(st) {
    hudCommander.textContent = `${st.player.name} • ${st.player.nation}`;
    hudDate.textContent = `Ano ${st.calendar.year} • ${WP.monthName(st.calendar.month)}`;
    hudFunds.textContent = WP.formatMoney(st.economy.funds);
    const income = WP.calcIncome(st);
    const upkeep = WP.calcUpkeep(st);
    const net = income - upkeep.total;
    hudIncome.textContent = `${net >= 0 ? '+' : ''}${Math.round(net / 1000)}K/mês`;
  }

  function renderMissions(st, slot) {
    missionsList.innerHTML = '';
    const list = st.missions || [];
    if (!list.length) {
      missionsList.innerHTML = '<div style="opacity:.85">Sem missões disponíveis.</div>';
      return;
    }
    list.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'mission';
      const status = m.completed ? (m.claimed ? 'Concluída • Recompensa recebida' : 'Concluída • Recompensa disponível') : 'Em andamento';
      el.innerHTML = `
        <div class="mt">${m.title}</div>
        <div class="md">${m.description || ''}</div>
        <div class="mr">
          <div style="opacity:.85">${status}</div>
          <div style="display:flex; gap:10px; align-items:center;">
            <div style="font-weight:700">${WP.formatMoney(m.reward || 0)}</div>
            <button class="btn" ${(!m.completed || m.claimed) ? 'disabled' : ''} data-claim="${m.id}">Resgatar</button>
          </div>
        </div>
      `;
      missionsList.appendChild(el);
    });

    missionsList.querySelectorAll('button[data-claim]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-claim');
        const fresh = WP.loadState(slot);
        const r = WP.claimMissionReward(fresh, id);
        if (r.ok) {
          WP.saveState(slot, fresh);
          updateHud(fresh);
          renderMissions(fresh, slot);
        }
      });
    });
  }

  function startLobby() {
    const pack = getStateOrRedirect();
    if (!pack) {
      show('menu');
      return;
    }
    const { slot, st } = pack;
    show('lobby');
    updateHud(st);

    // Ensure we are at base URL (prevents odd "returns" after module navigation)
    if (location.search) {
      history.replaceState({}, '', 'index.html');
    }

    // Missions
    hudMissions.onclick = () => {
      const fresh = WP.loadState(slot);
      renderMissions(fresh, slot);
      missionsBackdrop.classList.add('show');
    };
    closeMissions.onclick = () => missionsBackdrop.classList.remove('show');
    missionsBackdrop.addEventListener('click', (ev) => {
      if (ev.target === missionsBackdrop) missionsBackdrop.classList.remove('show');
    });

    // Next Turn
    hudNextTurn.onclick = () => {
      const fresh = WP.loadState(slot);
      WP.nextTurn(fresh);
      WP.saveState(slot, fresh);
      updateHud(fresh);

      if (fresh.flags.gameOver) {
        alert('GAME OVER: Falência total.');
      }
      if (fresh.flags.victory) {
        alert('VITÓRIA: Domínio global alcançado!');
      }
    };

    // Save
    hudSave.onclick = () => {
      const fresh = WP.loadState(slot);
      WP.saveState(slot, fresh);
      // lightweight feedback
      showToast('Jogo salvo.');
    };
  }

  // Lobby navigation cards (pass slot in URL for reliability on GitHub Pages)
  function goModule(page) {
    const slot = WP.getActiveSlot();
    if (!slot) return show('menu');
    location.href = `${page}?slot=${encodeURIComponent(slot)}`;
  }
  document.getElementById('relationsBtn').addEventListener('click', () => goModule('relations.html'));
  document.getElementById('warBtn').addEventListener('click', () => goModule('war.html'));
  document.getElementById('commerceBtn').addEventListener('click', () => goModule('commerce.html'));
  document.getElementById('infraBtn').addEventListener('click', () => goModule('infrastructure.html'));

  // Toast helper (uses existing CSS .toast)
  function showToast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 250);
    }, 1500);
  }

  // If there is an active slot, allow "Continue" to jump to lobby quickly on refresh (optional)
  const active = WP.getActiveSlot();
  if (active && WP.loadState(active)) {
    // do nothing by default; user chooses continue.
  }
});
