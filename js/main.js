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

  // Build info (helps validate cache / deployments)
  const build = (window.WP_BUILD && (WP_BUILD.version || WP_BUILD.date)) ? `Build ${WP_BUILD.version} • ${WP_BUILD.date}` : '';
  const buildTag = document.getElementById('buildTag');
  const buildTagLobby = document.getElementById('buildTagLobby');
  if (buildTag) buildTag.textContent = build || '';
  if (buildTagLobby) buildTagLobby.textContent = build || '';

  // Fail-safe: show JS errors as toast to diagnose in mobile quickly
  window.addEventListener('error', (e) => {
    try { WP.toast?.(`Erro: ${e.message}`); } catch {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    try { WP.toast?.(`Erro: ${e.reason?.message || e.reason}`); } catch {}
  });



  let content = { nations: [], missions: [], events: [] };

  // Load content asynchronously so the UI never "trava" caso algum fetch falhe.
  // (Isso evita ficar preso no index e garante que os botões sempre funcionem.)
  (async () => {
    try {
      const loaded = await WP.loadContent();
      if (loaded) content = loaded;
    } catch {
      // ignore
    }

    // Feed event engine after content arrives
    try { WP.setEventPool(content.events || []); } catch {}

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
  })();

  // Populate nation select with a safe fallback immediately (so New Game works offline).
  const nationSelectFallback = document.getElementById('nation');
  if (nationSelectFallback && nationSelectFallback.children.length === 0) {
    ['Brasil','Estados Unidos','Europa','Rússia','China','Japão'].forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      nationSelectFallback.appendChild(opt);
    });
  }


  // Splash -> Menu
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
    Object.values(screens).forEach((el) => { if (el) el.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
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

  if (newGameBtn) newGameBtn.addEventListener('click', () => {
    populateNewSlots();
    show('newGame');
  });
  if (continueBtn) continueBtn.addEventListener('click', () => {
    populateSaves();
    show('loadGame');
  });
  if (backToMenuFromNew) backToMenuFromNew.addEventListener('click', () => show('menu'));
  if (backToMenuFromLoad) backToMenuFromLoad.addEventListener('click', () => show('menu'));

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

  if (newGameForm) newGameForm.addEventListener('submit', (e) => {
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

  // Event modal
  const eventBackdrop = document.getElementById('eventModal');
  const eventTitle = document.getElementById('eventTitle');
  const eventSpeaker = document.getElementById('eventSpeaker');
  const eventText = document.getElementById('eventText');
  const eventChoices = document.getElementById('eventChoices');
  const closeEvent = document.getElementById('closeEvent');
  const skipEvent = document.getElementById('skipEvent');
  const hudCommander = document.getElementById('hudCommander');
  const hudDate = document.getElementById('hudDate');
  const hudFunds = document.getElementById('hudFunds');
  const hudIncome = document.getElementById('hudIncome');
  const hudMap = document.getElementById('hudMap');
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

    // If the player left the game with an unresolved decision, bring it back.
    if (st.pendingEvent) {
      // Use a microtask to ensure the modal elements are laid out.
      setTimeout(() => showEventModal(st, slot), 50);
    }

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
      // If an event is pending, show it (player must decide)
      if (fresh.pendingEvent) {
        showEventModal(fresh, slot);
        return;
      }

      WP.nextTurn(fresh);
      WP.saveState(slot, fresh);
      updateHud(fresh);

      // If nextTurn queued a decision event, present it immediately.
      if (fresh.pendingEvent) {
        showEventModal(fresh, slot);
      }

      if (fresh.flags.gameOver) {
        alert('GAME OVER: Falência total.');
      }
      if (fresh.flags.victory) {
        alert('VITÓRIA: Domínio global alcançado!');
      }
    };

      // Map
  if (hudMap) {
    hudMap.onclick = () => {
      const slot = WP.getActiveSlot() || 1;
      window.location.href = `map.html?slot=${slot}`;
    };
  }

// Save
    hudSave.onclick = () => {
      const fresh = WP.loadState(slot);
      WP.saveState(slot, fresh);
      // lightweight feedback
      showToast('Jogo salvo.');
    };
  }

  // --- Event Modal (typewriter + decisions) ---
  let twTimer = null;
  function typewriter(el, text, speed = 16) {
    if (twTimer) clearInterval(twTimer);
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    cursor.textContent = '▌';
    el.appendChild(document.createTextNode(''));
    el.appendChild(cursor);
    let i = 0;
    twTimer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(twTimer);
        twTimer = null;
        cursor.remove();
        return;
      }
      // Insert before cursor
      const ch = text[i++];
      cursor.before(document.createTextNode(ch));
    }, speed);
  }

  function showEventModal(state, slot) {
    const ev = state.pendingEvent;
    if (!ev) return;

    eventTitle.textContent = (ev.title || 'COMUNICAÇÃO OFICIAL').toUpperCase();
    eventSpeaker.textContent = ev.speaker || 'Centro de Operações • Governo Provisório';

    // Build choices (disabled until typing finishes unless skip)
    eventChoices.innerHTML = '';
    const buttons = [];
    (ev.choices || []).forEach((c, idx) => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.disabled = true;
      b.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
          <div style="font-weight:800; letter-spacing:.4px;">${c.label}</div>
          ${c.hint ? `<div style="opacity:.85; font-size:12px;">${c.hint}</div>` : ''}
        </div>
      `;
      b.addEventListener('click', () => {
        const fresh = WP.loadState(slot);
        const r = WP.resolvePendingEvent(fresh, idx);
        if (r.ok) {
          WP.saveState(slot, fresh);
          updateHud(fresh);
          hideEventModal();
          showToast('Decisão registrada.');
        }
      });
      eventChoices.appendChild(b);
      buttons.push(b);
    });

    function enableChoices() {
      buttons.forEach((b) => (b.disabled = false));
    }

    // Typewriter
    typewriter(eventText, ev.text || '—');
    // Enable choices after estimated duration
    const est = Math.min(2600, Math.max(900, (ev.text || '').length * 16));
    setTimeout(enableChoices, est);

    // Controls
    skipEvent.onclick = () => {
      if (twTimer) {
        clearInterval(twTimer);
        twTimer = null;
      }
      eventText.textContent = ev.text || '—';
      enableChoices();
    };
    closeEvent.onclick = () => hideEventModal();
    eventBackdrop.addEventListener('click', (e) => {
      if (e.target === eventBackdrop) hideEventModal();
    });

    eventBackdrop.classList.add('show');
  }

  function hideEventModal() {
    if (twTimer) {
      clearInterval(twTimer);
      twTimer = null;
    }
    eventBackdrop.classList.remove('show');
  }

  // Lobby navigation cards (pass slot in URL for reliability on GitHub Pages)
  function goModule(page) {
    let slot = WP.getActiveSlot();
    if (!slot || !WP.loadState(slot)) {
      // fallback: first available save slot
      for (const k of WP.SLOT_KEYS) {
        if (WP.loadState(k)) { slot = k; break; }
      }
      if (slot) WP.setActiveSlot(slot);
    }
    if (!slot) { show('menu'); return; }
    location.href = `${page}?slot=${encodeURIComponent(slot)}`;
  }
  
  // Robust click handling (prevents "cards não clicam" issues)
  const lobbyButtons = document.querySelector('.lobby-buttons');
  const lobbyHandle = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.id;
    if (id === 'relationsBtn') return goModule('relations.html');
    if (id === 'warBtn') return goModule('war.html');
    if (id === 'commerceBtn') return goModule('commerce.html');
    if (id === 'infraBtn') return goModule('infrastructure.html');
    if (id === 'mapBtn') return goModule('map.html');
  };
  if (lobbyButtons) {
    lobbyButtons.addEventListener('click', lobbyHandle);
    lobbyButtons.addEventListener('pointerup', lobbyHandle);
    lobbyButtons.addEventListener('touchstart', lobbyHandle, { passive: true });
  }

document.getElementById('relationsBtn').addEventListener('click', () => goModule('relations.html'));
  document.getElementById('warBtn').addEventListener('click', () => goModule('war.html'));
  document.getElementById('commerceBtn').addEventListener('click', () => goModule('commerce.html'));
  document.getElementById('infraBtn').addEventListener('click', () => goModule('infrastructure.html'));
  const mapBtn = document.getElementById('mapBtn');
  if (mapBtn) mapBtn.addEventListener('click', () => goModule('map.html'));

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