/*
 * war.js — Central de Guerra (Simulação)
 *
 * Nesta versão, a guerra acontece em fases mensais (turnos). Você declara
 * guerra, define o nível de esforço (commitment) para Exército, Marinha e
 * Aeronáutica, e o conflito evolui automaticamente a cada "Próximo Turno" no Lobby.
 *
 * Compatível com GitHub Pages e saves antigos (migração automática em core.js).
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const urlSlot = params.get('slot');
  if (urlSlot && WP.SLOT_KEYS.includes(urlSlot) && WP.loadState(urlSlot)) {
    WP.setActiveSlot(urlSlot);
  }

  const slot = WP.getActiveSlot();
  if (!slot || !WP.loadState(slot)) {
    location.href = 'index.html';
    return;
  }

  let state = WP.loadState(slot);

  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => {
    const s = WP.getActiveSlot();
    location.href = s ? `index.html?resume=1&slot=${encodeURIComponent(s)}` : 'index.html';
  });

  // UI refs
  const fundsEl = document.getElementById('fundsDisplay');
  const upkeepEl = document.getElementById('milUpkeep');
  const targetSelect = document.getElementById('targetNation');
  const startWarBtn = document.getElementById('startWarBtn');
  const warsList = document.getElementById('warsList');

  // Load nations from content
  let nations = [];
  try {
    const content = await WP.loadContent();
    nations = content.nations || [];
  } catch {
    nations = ['Brasil', 'Estados Unidos', 'Rússia', 'China', 'Europa', 'Japão'];
  }

  function rebuildTargets() {
    targetSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione um país…';
    targetSelect.appendChild(placeholder);

    const taken = new Set((state.world?.wars || []).map(w => w.target));
    nations
      .filter((n) => n && n !== state.player.nation && !taken.has(n))
      .forEach((nation) => {
        const opt = document.createElement('option');
        opt.value = nation;
        opt.textContent = nation;
        targetSelect.appendChild(opt);
      });
  }

  const costMap = { army: 2500, navy: 12000, airforce: 16000 };

  function refreshTop() {
    document.getElementById('armyCount').textContent = state.military.army;
    document.getElementById('navyCount').textContent = state.military.navy;
    document.getElementById('airforceCount').textContent = state.military.airforce;
    if (fundsEl) fundsEl.textContent = WP.formatMoney(state.economy.funds);
    if (upkeepEl) {
      const u = WP.calcUpkeep(state);
      upkeepEl.textContent = WP.formatMoney(u.militaryUpkeep) + '/mês';
    }
  }

  function changeTroops(branch, delta) {
    const unitCost = costMap[branch];
    if (delta > 0) {
      const price = unitCost * delta;
      if (state.economy.funds < price) {
        alert('Fundos insuficientes para recrutar.');
        return;
      }
      state.military[branch] += delta;
      state.economy.funds -= price;
    } else {
      const abs = Math.abs(delta);
      const actual = Math.min(abs, state.military[branch]);
      state.military[branch] -= actual;
      // Refund 70% (custos logísticos e perdas)
      state.economy.funds += Math.round(unitCost * actual * 0.7);
    }
    WP.saveState(slot, state);
    refresh();
  }

  ['army', 'navy', 'airforce'].forEach((branch) => {
    const el = document.querySelector(`.branch[data-branch="${branch}"]`);
    if (!el) return;
    const btns = el.querySelectorAll('.controls button');
    const minusBtn = btns[0];
    const plusBtn = btns[1];
    minusBtn.addEventListener('click', () => changeTroops(branch, -10));
    plusBtn.addEventListener('click', () => changeTroops(branch, +10));
  });

  function renderWars() {
    const wars = state.world.wars || [];
    warsList.innerHTML = '';
    if (!wars.length) {
      warsList.innerHTML = '<p class="muted">Nenhum conflito ativo.</p>';
      return;
    }

    wars.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'war-card';

      // progress -100..100 => bar 0..100 with center 50
      const pct = Math.round(((w.progress || 0) + 100) / 2); // 0..100
      const report = w.lastReport || 'Aguardando relatório do próximo turno.';

      card.innerHTML = `
        <div class="row">
          <div class="title">${w.target}</div>
          <div style="opacity:.9; font-size:12px;">Progresso: <b>${w.progress}</b></div>
        </div>
        <div class="war-bar"><div style="width:${pct}%;"></div></div>
        <div class="war-meta">${report}</div>
        <div class="commitment">
          <div>
            <label>Exército <span><b id="v_army_${w.id}">${Math.round((w.commitment?.army||0.55)*100)}%</b></span></label>
            <input type="range" min="10" max="100" value="${Math.round((w.commitment?.army||0.55)*100)}" data-war="${w.id}" data-branch="army" />
          </div>
          <div>
            <label>Marinha <span><b id="v_navy_${w.id}">${Math.round((w.commitment?.navy||0.45)*100)}%</b></span></label>
            <input type="range" min="10" max="100" value="${Math.round((w.commitment?.navy||0.45)*100)}" data-war="${w.id}" data-branch="navy" />
          </div>
          <div>
            <label>Aeronáutica <span><b id="v_airforce_${w.id}">${Math.round((w.commitment?.airforce||0.5)*100)}%</b></span></label>
            <input type="range" min="10" max="100" value="${Math.round((w.commitment?.airforce||0.5)*100)}" data-war="${w.id}" data-branch="airforce" />
          </div>
        </div>
      `;
      warsList.appendChild(card);
    });

    warsList.querySelectorAll('input[type="range"]').forEach((r) => {
      r.addEventListener('input', () => {
        const warId = r.getAttribute('data-war');
        const branch = r.getAttribute('data-branch');
        const val = Number(r.value || 50);
        const label = document.getElementById(`v_${branch}_${warId}`);
        if (label) label.textContent = val + '%';
      });
      r.addEventListener('change', () => {
        const warId = r.getAttribute('data-war');
        const branch = r.getAttribute('data-branch');
        const val = Number(r.value || 50) / 100;
        state = WP.loadState(slot) || state;
        WP.setWarCommitment(state, warId, { [branch]: val });
        WP.saveState(slot, state);
        refreshTop();
      });
    });
  }

  function refresh() {
    state = WP.loadState(slot) || state;
    refreshTop();
    rebuildTargets();
    renderWars();
  }

  startWarBtn.addEventListener('click', () => {
    const target = targetSelect.value;
    if (!target) return alert('Selecione um alvo.');
    state = WP.loadState(slot) || state;
    const r = WP.startWar(state, target);
    if (!r.ok) {
      alert('Não foi possível iniciar guerra.');
      return;
    }
    WP.saveState(slot, state);
    alert(`Guerra iniciada contra ${target}.\n\nAvance turnos no Lobby para evoluir o conflito.`);
    refresh();
  });

  refresh();
});
