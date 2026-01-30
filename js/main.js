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

  // Splash -> Menu
  setTimeout(() => show('menu'), 1500);

  // Buttons
  const newGameBtn = document.getElementById('newGameBtn');
  const continueBtn = document.getElementById('continueBtn');
  const backToMenuFromNew = document.getElementById('backToMenuFromNew');
  const backToMenuFromLoad = document.getElementById('backToMenuFromLoad');

  newGameBtn.addEventListener('click', () => show('newGame'));
  continueBtn.addEventListener('click', () => {
    populateSaves();
    show('loadGame');
  });
  backToMenuFromNew.addEventListener('click', () => show('menu'));
  backToMenuFromLoad.addEventListener('click', () => show('menu'));

  // New game
  const newGameForm = document.getElementById('newGameForm');
  newGameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('playerName').value.trim();
    const nation = document.getElementById('nation').value;
    if (!name) return;

    const slot = WP.findFreeSlot();
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
    cont.classList.add('hidden');
    messageEl.textContent = '';

    const txt =
      `Sr(a) ${state.player.name}, fui informado pelas autoridades locais que o centro governamental do nosso país foi invadido e membros do alto escalão foram mortos, incluindo presidente, vice-presidente e ministros. ` +
      `Sendo assim, o(a) senhor(a), como comandante das forças armadas, a fim de restabelecer a paz e a ordem, precisa assumir temporariamente o comando de nossa nação. ` +
      `Boa sorte.\n\n— Presidente do Senado`;

    let i = 0;
    const speed = 22;
    (function type() {
      messageEl.textContent += txt.charAt(i++);
      if (i < txt.length) {
        setTimeout(type, speed);
      } else {
        cont.classList.remove('hidden');
      }
    })();

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

  // Lobby navigation cards
  document.getElementById('relationsBtn').addEventListener('click', () => (location.href = 'relations.html'));
  document.getElementById('warBtn').addEventListener('click', () => (location.href = 'war.html'));
  document.getElementById('commerceBtn').addEventListener('click', () => (location.href = 'commerce.html'));
  document.getElementById('infraBtn').addEventListener('click', () => (location.href = 'infrastructure.html'));

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
