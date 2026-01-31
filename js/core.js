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

  // In-memory event pool (loaded at app start). Kept out of the save state so
  // DLCs can extend events without migrating player saves.
  let EVENT_POOL = [];
  function setEventPool(list) {
    EVENT_POOL = Array.isArray(list) ? list : [];
  }
  function getEventPool() {
    return EVENT_POOL;
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
    try {
      const st = JSON.parse(raw);
      return normalizeState(st);
    } catch {
      return null;
    }
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
    const content = { nations: [], missions: [], events: [] };

    // Base content (always)
    try {
      const base = await fetchJSON('dlc/base/manifest.json');
      if (Array.isArray(base.nations)) content.nations.push(...base.nations);
      if (Array.isArray(base.missions)) content.missions.push(...base.missions);
      // Base events (optional)
      if (Array.isArray(base.events)) {
        content.events.push(...base.events);
      }
    } catch (e) {
      console.warn('Base manifest missing or blocked:', e);
    }

    // Built-in event packs (always try). These live in /events so they work on GitHub Pages.
    // If a file is missing, we just skip.
    const builtinEventFiles = [
      'events/political.json',
      'events/military.json',
      'events/economic.json',
      'events/international.json',
      'events/internal.json',
    ];
    for (const p of builtinEventFiles) {
      try {
        const pack = await fetchJSON(p);
        if (Array.isArray(pack)) content.events.push(...pack);
      } catch {
        // ignore
      }
    }

    // Enabled DLCs (optional)
    try {
      const enabled = JSON.parse(localStorage.getItem(ENABLED_DLC_KEY) || '[]');
      for (const dlcPath of enabled) {
        try {
          const man = await fetchJSON(dlcPath);
          if (Array.isArray(man.nations)) content.nations.push(...man.nations);
          if (Array.isArray(man.missions)) content.missions.push(...man.missions);
          if (Array.isArray(man.events)) content.events.push(...man.events);
        } catch (e) {
          console.warn('Failed to load DLC:', dlcPath, e);
        }
      }
    } catch {}

    // de-dup nations
    content.nations = [...new Set(content.nations)].filter(Boolean);

    // Normalize events (de-dup by id)
    const seen = new Set();
    content.events = (content.events || []).filter((ev) => {
      const id = ev?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

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
      turn: 0,
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
        popularity: 55,
        pressure: 28,
        morale: 58,
        tech: 10,
        threat: 18,
        dominance: 2,
        influence: { americas: 5, europe: 3, africa: 2, asia: 3, oceania: 1 },
        // Ongoing wars are stored here (simulation). Older saves may still have `atWarWith`.
        wars: [],
        atWarWith: [],
        diplomacy: {},
      },
      missions,
      pendingEvent: null,
      eventHistory: {},
      log: [
        { t: now, type: 'start', text: 'Protocolo ativado. Você assumiu o comando temporário do país.' }
      ],
      flags: { gameOver: false, victory: false },
    };
  }

  function monthName(m) { return MONTHS_PT[clamp(m - 1, 0, 11)] || '—'; }

  // --- State normalization (forward compatible saves) ---
  function normalizeState(state) {
    if (!state || typeof state !== 'object') return state;
    state.meta = state.meta || { version: '1.1.0', createdAt: Date.now(), updatedAt: Date.now() };
    state.player = state.player || { name: 'Comandante', nation: '—' };
    state.calendar = state.calendar || { year: 2030, month: 1 };
    state.turn = state.turn || 0;
    state.economy = state.economy || { funds: 0, baseIncome: 0, debt: 0 };
    state.military = state.military || { army: 0, navy: 0, airforce: 0 };
    state.infrastructure = state.infrastructure || { transport: 0, health: 0, education: 0, science: 0, space: 0 };
    state.world = state.world || {};
    const w = state.world;
    w.stability = clamp(w.stability ?? 50, 0, 100);
    w.popularity = clamp(w.popularity ?? 50, 0, 100);
    w.pressure = clamp(w.pressure ?? 30, 0, 100);
    w.morale = clamp(w.morale ?? 50, 0, 100);
    w.tech = clamp(w.tech ?? 10, 0, 100);
    w.threat = clamp(w.threat ?? 20, 0, 100);
    w.dominance = clamp(w.dominance ?? 0, 0, 100);
    w.influence = w.influence || { americas: 5, europe: 3, africa: 2, asia: 3, oceania: 1 };
    w.influence.americas = clamp(w.influence.americas ?? 0, 0, 100);
    w.influence.europe = clamp(w.influence.europe ?? 0, 0, 100);
    w.influence.africa = clamp(w.influence.africa ?? 0, 0, 100);
    w.influence.asia = clamp(w.influence.asia ?? 0, 0, 100);
    w.influence.oceania = clamp(w.influence.oceania ?? 0, 0, 100);
    w.diplomacy = w.diplomacy || {};
    w.wars = Array.isArray(w.wars) ? w.wars : [];
    w.atWarWith = Array.isArray(w.atWarWith) ? w.atWarWith : [];

    // Migrate legacy `atWarWith` into `wars` if wars is empty.
    if (w.wars.length === 0 && w.atWarWith.length) {
      w.atWarWith.forEach((target) => {
        if (!target) return;
        w.wars.push(createWarObject(state, target));
      });
    }

    // keep legacy list in sync (for UI/backward compatibility)
    w.atWarWith = [...new Set(w.wars.map(x => x.target))];

    state.missions = Array.isArray(state.missions) ? state.missions : [];
    state.pendingEvent = state.pendingEvent || null;
    state.eventHistory = state.eventHistory || {};
    state.log = Array.isArray(state.log) ? state.log : [];
    state.flags = state.flags || { gameOver: false, victory: false };
    return state;
  }

  // --- War Simulation ---
  function warId() {
    return 'war_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  function estimateEnemyPower(target) {
    // Light deterministic-ish seed based on string length and char codes
    const s = String(target || 'X');
    let score = 0;
    for (let i = 0; i < s.length; i++) score += s.charCodeAt(i);
    const base = 900 + (score % 900); // 900..1799
    return base;
  }

  function ourPower(state, commitment) {
    const mil = state.military;
    const w = state.world;
    const c = commitment || { army: 0.5, navy: 0.5, airforce: 0.5 };
    const p =
      (mil.army * 1.0 * c.army) +
      (mil.navy * 6.0 * c.navy) +
      (mil.airforce * 8.0 * c.airforce);
    const moraleMul = 0.70 + (w.morale / 200); // 0.70..1.20
    const techMul = 0.80 + (w.tech / 200);     // 0.80..1.30
    const pressureMul = 1.05 - (w.pressure / 220); // 0.60..1.05
    return Math.round(p * moraleMul * techMul * pressureMul);
  }

  function createWarObject(state, target) {
    return {
      id: warId(),
      target,
      startTurn: state.turn || 0,
      progress: 0, // -100..100
      intensity: 0.55, // 0.30..0.95
      enemyPower: estimateEnemyPower(target),
      commitment: { army: 0.55, navy: 0.45, airforce: 0.50 },
      lastReport: '',
    };
  }

  function startWar(state, target) {
    normalizeState(state);
    const w = state.world;
    if (!target) return { ok: false, reason: 'invalid_target' };
    if (w.wars.some(x => x.target === target)) return { ok: false, reason: 'already' };

    const war = createWarObject(state, target);
    w.wars.push(war);
    w.atWarWith = [...new Set(w.wars.map(x => x.target))];
    w.stability = clamp(w.stability - 3, 0, 100);
    w.pressure = clamp(w.pressure + 4, 0, 100);
    state.log.push({ t: Date.now(), type: 'war', text: `Guerra declarada contra ${target}.` });
    return { ok: true, war };
  }

  function setWarCommitment(state, warIdValue, partial) {
    normalizeState(state);
    const war = state.world.wars.find(x => x.id === warIdValue);
    if (!war) return { ok: false };
    war.commitment = {
      army: clamp(partial.army ?? war.commitment.army, 0.1, 1.0),
      navy: clamp(partial.navy ?? war.commitment.navy, 0.1, 1.0),
      airforce: clamp(partial.airforce ?? war.commitment.airforce, 0.1, 1.0),
    };
    return { ok: true };
  }

  function resolveWars(state) {
    normalizeState(state);
    const w = state.world;
    if (!w.wars.length) return;

    const reports = [];
    const toRemove = [];

    for (const war of w.wars) {
      // enemy adapts slowly
      war.enemyPower = Math.round(war.enemyPower * (0.985 + Math.random() * 0.03));
      war.intensity = clamp(war.intensity + (Math.random() - 0.5) * 0.06, 0.30, 0.95);

      const pOur = ourPower(state, war.commitment);
      const pEnemy = Math.round(war.enemyPower * (0.85 + (w.threat / 160))); // threat makes enemies bolder

      const swingBase = (pOur - pEnemy) / 120; // roughly -15..15
      const swing = Math.round(swingBase + rand(-2, 2));
      const delta = Math.round(swing * (0.55 + war.intensity));
      war.progress = clamp(war.progress + delta, -100, 100);

      // Losses / costs scale with intensity
      const lossFactor = 0.0025 + (war.intensity * 0.004);
      const armyLoss = Math.min(state.military.army, Math.max(0, Math.round(state.military.army * war.commitment.army * lossFactor)));
      const navyLoss = Math.min(state.military.navy, Math.max(0, Math.round(state.military.navy * war.commitment.navy * lossFactor * 0.35)));
      const airLoss = Math.min(state.military.airforce, Math.max(0, Math.round(state.military.airforce * war.commitment.airforce * lossFactor * 0.28)));
      state.military.army -= armyLoss;
      state.military.navy -= navyLoss;
      state.military.airforce -= airLoss;

      // War drains funds additionally (operations)
      const opsCost = Math.round((pOur * 1.1) * (0.55 + war.intensity));
      state.economy.funds -= opsCost;

      // World impact
      w.morale = clamp(w.morale - Math.round(armyLoss / 40) + rand(-1, 1), 0, 100);
      w.stability = clamp(w.stability - Math.round(opsCost / 350000) + rand(-1, 1), 0, 100);
      w.pressure = clamp(w.pressure + Math.round(war.intensity * 2) + rand(-1, 1), 0, 100);

      let report = `Conflito contra ${war.target}: `;
      if (delta >= 3) report += 'avanço significativo.';
      else if (delta > 0) report += 'avanço leve.';
      else if (delta === 0) report += 'frente estabilizada.';
      else if (delta > -3) report += 'recuo leve.';
      else report += 'recuo significativo.';

      war.lastReport = report;
      reports.push(report);

      // End conditions
      if (war.progress >= 100) {
        // Victory
        const gain = rand(6, 12);
        const region = guessNationRegion(war.target);
        w.influence = w.influence || { americas: 5, europe: 3, africa: 2, asia: 3, oceania: 1 };
        w.influence[region] = clamp((w.influence[region] ?? 0) + gain, 0, 100);
        w.dominance = recomputeDominance(state);
        w.pressure = clamp(w.pressure - rand(2, 6), 0, 100);
        w.morale = clamp(w.morale + rand(4, 10), 0, 100);
        state.log.push({ t: Date.now(), type: 'war_end', text: `Vitória contra ${war.target}. +${gain}% de Domínio.` });
        toRemove.push(war.id);
      }
      if (war.progress <= -100) {
        // Defeat
        const loss = rand(6, 12);
        const region = guessNationRegion(war.target);
        w.influence = w.influence || { americas: 5, europe: 3, africa: 2, asia: 3, oceania: 1 };
        w.influence[region] = clamp((w.influence[region] ?? 0) - loss, 0, 100);
        w.dominance = recomputeDominance(state);
        w.stability = clamp(w.stability - rand(8, 16), 0, 100);
        w.popularity = clamp(w.popularity - rand(6, 14), 0, 100);
        state.log.push({ t: Date.now(), type: 'war_end', text: `Derrota contra ${war.target}. -${loss}% de Domínio.` });
        toRemove.push(war.id);
      }
    }

    if (reports.length) {
      state.log.push({ t: Date.now(), type: 'war_report', text: reports.join(' ') });
    }

    if (toRemove.length) {
      w.wars = w.wars.filter(x => !toRemove.includes(x.id));
      w.atWarWith = [...new Set(w.wars.map(x => x.target))];
    }
  }

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

  // --- Event Engine ---
  // Conditions are intentionally simple and safe for vanilla.
  function matchesConditions(state, cond = {}) {
    const w = state.world;
    const e = state.economy;
    const m = state.military;
    const t = state.turn || 0;

    if (cond.turnBelow != null && !(t < cond.turnBelow)) return false;
    if (cond.turnAbove != null && !(t > cond.turnAbove)) return false;

    if (cond.stabilityBelow != null && !(w.stability < cond.stabilityBelow)) return false;
    if (cond.stabilityAbove != null && !(w.stability > cond.stabilityAbove)) return false;
    if (cond.popularityBelow != null && !(w.popularity < cond.popularityBelow)) return false;
    if (cond.popularityAbove != null && !(w.popularity > cond.popularityAbove)) return false;
    if (cond.pressureAbove != null && !(w.pressure > cond.pressureAbove)) return false;
    if (cond.moraleBelow != null && !(w.morale < cond.moraleBelow)) return false;
    if (cond.fundsBelow != null && !(e.funds < cond.fundsBelow)) return false;
    if (cond.fundsAbove != null && !(e.funds > cond.fundsAbove)) return false;
    if (cond.techAbove != null && !(w.tech > cond.techAbove)) return false;
    if (cond.dominanceBelow != null && !(w.dominance < cond.dominanceBelow)) return false;
    if (cond.threatAbove != null && !(w.threat > cond.threatAbove)) return false;
    if (cond.armyBelow != null && !(m.army < cond.armyBelow)) return false;
    if (cond.atWar === true && !(w.atWarWith?.length)) return false;
    if (cond.atWar === false && (w.atWarWith?.length)) return false;
    return true;
  }

  function applyEffects(state, effects = {}) {
    const w = state.world;
    const e = state.economy;
    const mil = state.military;

    // Economy
    if (effects.funds != null) e.funds += Number(effects.funds);
    if (effects.baseIncome != null) e.baseIncome += Number(effects.baseIncome);
    if (effects.debt != null) e.debt += Number(effects.debt);

    // World
    if (effects.stability != null) w.stability = clamp(w.stability + Number(effects.stability), 0, 100);
    if (effects.popularity != null) w.popularity = clamp(w.popularity + Number(effects.popularity), 0, 100);
    if (effects.pressure != null) w.pressure = clamp(w.pressure + Number(effects.pressure), 0, 100);
    if (effects.morale != null) w.morale = clamp(w.morale + Number(effects.morale), 0, 100);
    if (effects.tech != null) w.tech = clamp(w.tech + Number(effects.tech), 0, 100);
    if (effects.threat != null) w.threat = clamp(w.threat + Number(effects.threat), 0, 100);
    if (effects.dominance != null) w.dominance = clamp(w.dominance + Number(effects.dominance), 0, 100);

    // Military
    if (effects.army != null) mil.army = Math.max(0, mil.army + Number(effects.army));
    if (effects.navy != null) mil.navy = Math.max(0, mil.navy + Number(effects.navy));
    if (effects.airforce != null) mil.airforce = Math.max(0, mil.airforce + Number(effects.airforce));
  }

  function pickEvent(state) {
    const pool = EVENT_POOL || [];
    if (!pool.length) return null;

    const nowTurn = state.turn || 0;
    const history = state.eventHistory || {};

    const candidates = pool
      .filter((ev) => ev && ev.id && Array.isArray(ev.choices) && ev.choices.length)
      .filter((ev) => matchesConditions(state, ev.conditions || {}))
      .filter((ev) => {
        const last = history[ev.id];
        const cooldown = Number(ev.cooldown || 6);
        if (last == null) return true;
        return nowTurn - last >= cooldown;
      });

    if (!candidates.length) return null;
    // Weighted random
    const total = candidates.reduce((s, ev) => s + (Number(ev.weight || 1)), 0);
    let roll = Math.random() * total;
    for (const ev of candidates) {
      roll -= Number(ev.weight || 1);
      if (roll <= 0) return ev;
    }
    return candidates[candidates.length - 1];
  }

  function queueEvent(state) {
    if (state.pendingEvent) return null;
    // Trigger probability (prevents event spam)
    const chance = 0.55; // 55% per month
    if (Math.random() > chance) return null;
    const ev = pickEvent(state);
    if (!ev) return null;

    state.pendingEvent = {
      id: ev.id,
      type: ev.type || 'event',
      title: ev.title || 'COMUNICAÇÃO OFICIAL',
      speaker: ev.speaker || 'Centro de Operações • Governo Provisório',
      text: ev.text || '',
      choices: ev.choices.map((c) => ({
        label: c.label,
        hint: c.hint || '',
        effects: c.effects || {},
      })),
    };
    state.eventHistory = state.eventHistory || {};
    state.eventHistory[ev.id] = state.turn || 0;
    return state.pendingEvent;
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

  function resolvePendingEvent(state, choiceIndex) {
    if (!state.pendingEvent) return { ok: false };
    const idx = Number(choiceIndex);
    const choice = state.pendingEvent.choices?.[idx];
    if (!choice) return { ok: false };

    applyEffects(state, choice.effects || {});
    state.log.push({
      t: Date.now(),
      type: 'decision',
      text: `Decisão aplicada: ${choice.label} (${state.pendingEvent.id}).`,
    });
    state.pendingEvent = null;
    checkEndings(state);
    return { ok: true };
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
    normalizeState(state);
    if (state.flags.gameOver || state.flags.victory) return;

    // If there is a pending event, force player to resolve it first.
    if (state.pendingEvent) return;

    const inc = calcIncome(state);
    const upkeep = calcUpkeep(state);
    state.economy.funds += inc;
    state.economy.funds -= upkeep.total;

    // Stability drifts
    state.world.stability = clamp(state.world.stability + rand(-2, 2), 0, 100);

    // Small ambient drift
    state.world.popularity = clamp(state.world.popularity + rand(-2, 2), 0, 100);
    state.world.pressure = clamp(state.world.pressure + rand(-2, 2), 0, 100);
    state.world.morale = clamp(state.world.morale + rand(-2, 2), 0, 100);

    // Narrative event (decision-based)
    // Resolve ongoing wars (simulation) before rolling new narrative.
    resolveWars(state);
    queueEvent(state);
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
    state.turn = (state.turn || 0) + 1;
    checkEndings(state);
  }

  
  // ===== Global Influence (Regions) =====
  const NATION_REGION = {
    'Brasil': 'americas',
    'Estados Unidos': 'americas',
    'México': 'americas',
    'Canadá': 'americas',
    'Argentina': 'americas',
    'Rússia': 'europe',
    'Ucrânia': 'europe',
    'Europa': 'europe',
    'Reino Unido': 'europe',
    'França': 'europe',
    'Alemanha': 'europe',
    'China': 'asia',
    'Japão': 'asia',
    'Índia': 'asia',
    'Coreia do Sul': 'asia',
    'Oriente Médio': 'asia',
    'África': 'africa',
    'Nigéria': 'africa',
    'África do Sul': 'africa',
    'Austrália': 'oceania',
    'Oceania': 'oceania',
  };

  function guessNationRegion(nation) {
    if (!nation) return 'americas';
    if (NATION_REGION[nation]) return NATION_REGION[nation];
    const t = String(nation).toLowerCase();
    if (/(china|jap|india|core|asia|oriente)/.test(t)) return 'asia';
    if (/(europa|fran|alem|russ|uk|reino|ucr)/.test(t)) return 'europe';
    if (/(afri|niger|sul)/.test(t)) return 'africa';
    if (/(austr|ocea)/.test(t)) return 'oceania';
    return 'americas';
  }

  function recomputeDominance(state) {
    const inf = state.world.influence || {};
    const weights = { americas: 1.1, europe: 1.0, africa: 0.9, asia: 1.2, oceania: 0.6 };
    let sum = 0;
    let wsum = 0;
    for (const k of Object.keys(weights)) {
      sum += (Number(inf[k] ?? 0) * weights[k]);
      wsum += weights[k];
    }
    return clamp(Math.round(sum / wsum), 0, 100);
  }

  function getNationRegionMap() { return { ...NATION_REGION }; }

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
    setEventPool,
    getEventPool,
    createNewState,
    calcIncome,
    calcUpkeep,
    nextTurn,
    startWar,
    setWarCommitment,
    resolvePendingEvent,
    claimMissionReward,
    getNationRegionMap,
  };
})();
