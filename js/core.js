/*
 * core.js — World Protocol (Vanilla)
 *
 * Single-source-of-truth for game state:
 * - Save slots (3)
 * - Active slot pointer
 * - Content loading (base + enabled DLC manifests)
 * - Turn loop (monthly)
 * - Missions + rewards
 *
 * This file is intentionally framework-free and compatible with GitHub Pages.
 */

(function () {
  const SLOT_KEYS = ['save-slot-1', 'save-slot-2', 'save-slot-3'];
  const ACTIVE_SLOT_KEY = 'wp_active_slot';
  const ENABLED_DLC_KEY = 'wp_enabled_dlcs';

  const MONTHS_PT = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function formatMoney(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  function getActiveSlot() {
    const k = localStorage.getItem(ACTIVE_SLOT_KEY);
    return SLOT_KEYS.includes(k) ? k : null;
  }

  function setActiveSlot(slotKey) {
    if (SLOT_KEYS.includes(slotKey)) localStorage.setItem(ACTIVE_SLOT_KEY, slotKey);
  }

  function loadState(slotKey) {
    const raw = localStorage.getItem(slotKey);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function saveState(slotKey, state) {
    localStorage.setItem(slotKey, JSON.stringify(state));
  }

  function findFreeSlot() {
    for (const k of SLOT_KEYS) if (!localStorage.getItem(k)) return k;
    return SLOT_KEYS[0];
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load ' + path);
    return await res.json();
  }

  async function loadContent() {
    const content = { nations: [], missions: [] };

    // Base content (always)
    try {
      const base = await fetchJSON('dlc/base/manifest.json');
      if (Array.isArray(base.nations)) content.nations.push(...base.nations);
      if (Array.isArray(base.missions)) content.missions.push(...base.missions);
    } catch (e) {
      console.warn('Base manifest missing or blocked:', e);
    }

    // Enabled DLCs (optional)
    try {
      const enabled = JSON.parse(localStorage.getItem(ENABLED_DLC_KEY) || '[]');
      for (const dlcPath of enabled) {
        try {
          const man = await fetchJSON(dlcPath);
          if (Array.isArray(man.nations)) content.nations.push(...man.nations);
          if (Array.isArray(man.missions)) content.missions.push(...man.missions);
        } catch (e) {
          console.warn('Failed to load DLC:', dlcPath, e);
        }
      }
    } catch {}

    // de-dup nations
    content.nations = [...new Set(content.nations)].filter(Boolean);
    return content;
  }

  function createNewState({ name, nation, content }) {
    const now = Date.now();
    const missions = (content.missions || []).map((m, idx) => ({
      id: m.id || `m${idx + 1}`,
      title: m.title || 'Missão',
      description: m.description || '',
      reward: Number(m.reward || 0),
      completed: false,
      claimed: false,
    }));

    return {
      meta: { version: '1.1.0', createdAt: now, updatedAt: now },
      player: { name, nation },
      calendar: { year: 2030, month: 1 },
      economy: {
        funds: 12_500_000,
        baseIncome: 500_000,
        debt: 0,
      },
      military: { army: 500, navy: 80, airforce: 60 },
      infrastructure: {
        transport: 0,
        health: 0,
        education: 0,
        science: 0,
        space: 0,
      },
      world: {
        stability: 62,
        dominance: 2,
        atWarWith: [],
        diplomacy: {},
      },
      missions,
      log: [
        { t: now, type: 'start', text: 'Protocolo ativado. Você assumiu o comando temporário do país.' }
      ],
      flags: { gameOver: false, victory: false },
    };
  }

  function monthName(m) { return MONTHS_PT[clamp(m - 1, 0, 11)] || '—'; }

  function calcUpkeep(state) {
    const mil = state.military;
    const inf = state.infrastructure;
    const militaryUpkeep = mil.army * 120 + mil.navy * 600 + mil.airforce * 750;
    const infraUpkeep =
      inf.transport + inf.health + inf.education + inf.science + inf.space;
    return { militaryUpkeep, infraUpkeep, total: militaryUpkeep + infraUpkeep };
  }

  function calcIncome(state) {
    const base = state.economy.baseIncome;
    const inf = state.infrastructure;
    // Infra boosts (very light in prototype)
    const boost =
      Math.round((inf.transport * 0.03 + inf.education * 0.02 + inf.science * 0.04) / 10_000);
    // stability affects income
    const stab = state.world.stability;
    const stabMul = 0.75 + stab / 200; // 0.75..1.25
    return Math.round((base + boost) * stabMul);
  }

  function randomEvent(state) {
    const r = Math.random();
    const now = Date.now();
    if (r < 0.20) {
      // Disaster
      const loss = rand(200_000, 900_000);
      state.economy.funds -= loss;
      state.world.stability = clamp(state.world.stability - rand(1, 4), 0, 100);
      state.log.push({ t: now, type: 'event', text: `Desastre natural causa prejuízo de ${formatMoney(loss)}.` });
    } else if (r < 0.38) {
      // Smuggling ring busted
      const gain = rand(150_000, 650_000);
      state.economy.funds += gain;
      state.world.stability = clamp(state.world.stability + rand(1, 3), 0, 100);
      state.log.push({ t: now, type: 'event', text: `Operação interna apreende contrabando. +${formatMoney(gain)}.` });
    } else if (r < 0.48) {
      // Diplomatic fallout
      state.world.stability = clamp(state.world.stability - rand(1, 3), 0, 100);
      state.log.push({ t: now, type: 'event', text: 'Tensão diplomática aumenta a instabilidade.' });
    }
  }

  function progressMissions(state) {
    // Very simple: auto-complete one mission if stability high and no game over.
    if (!state.missions?.length) return;
    const pending = state.missions.filter(m => !m.completed);
    if (!pending.length) return;
    if (state.world.stability >= 70 && Math.random() < 0.25) {
      const m = pending[rand(0, pending.length - 1)];
      m.completed = true;
      state.log.push({ t: Date.now(), type: 'mission', text: `Missão concluída: ${m.title}.` });
    }
  }

  function claimMissionReward(state, missionId) {
    const m = state.missions.find(x => x.id === missionId);
    if (!m || !m.completed || m.claimed) return { ok: false };
    m.claimed = true;
    state.economy.funds += m.reward;
    state.log.push({ t: Date.now(), type: 'reward', text: `Recompensa recebida: +${formatMoney(m.reward)} (${m.title}).` });
    return { ok: true };
  }

  function checkEndings(state) {
    if (state.economy.funds <= 0) {
      state.flags.gameOver = true;
      state.log.push({ t: Date.now(), type: 'gameover', text: 'Falência total. O governo entrou em colapso.' });
    }
    if (state.world.dominance >= 100) {
      state.flags.victory = true;
      state.log.push({ t: Date.now(), type: 'victory', text: 'Domínio global alcançado. O mundo foi unificado sob o Protocolo.' });
    }
  }

  function nextTurn(state) {
    if (state.flags.gameOver || state.flags.victory) return;

    const inc = calcIncome(state);
    const upkeep = calcUpkeep(state);
    state.economy.funds += inc;
    state.economy.funds -= upkeep.total;

    // Stability drifts
    state.world.stability = clamp(state.world.stability + rand(-2, 2), 0, 100);

    randomEvent(state);
    progressMissions(state);

    // Advance month
    state.calendar.month += 1;
    if (state.calendar.month > 12) {
      state.calendar.month = 1;
      state.calendar.year += 1;
    }

    // Small dominance growth if stable and military strong
    const power = state.military.army + state.military.navy * 4 + state.military.airforce * 5;
    if (state.world.stability >= 65 && power >= 1200) state.world.dominance = clamp(state.world.dominance + rand(0, 2), 0, 100);

    state.meta.updatedAt = Date.now();
    checkEndings(state);
  }

  window.WP = {
    SLOT_KEYS,
    formatMoney,
    monthName,
    clamp,
    getActiveSlot,
    setActiveSlot,
    loadState,
    saveState,
    findFreeSlot,
    loadContent,
    createNewState,
    calcIncome,
    calcUpkeep,
    nextTurn,
    claimMissionReward,
  };
})();
