/*
 * war.js — Central de Guerra
 *
 * - Uses active save slot (WP.getActiveSlot)
 * - Lets the player recruit/demobilize troops
 * - Allows declaring war against a target
 *
 * Combat is a simplified turn-based resolution hook for future expansions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const urlSlot = params.get('slot');
  if (urlSlot && WP.SLOT_KEYS.includes(urlSlot) && WP.loadState(urlSlot)) {
    WP.setActiveSlot(urlSlot);
  }

  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const slot = WP.getActiveSlot();
      location.href = slot ? `index.html?resume=1&slot=${encodeURIComponent(slot)}` : 'index.html';
    });
  }
  const targetSelect = document.getElementById('targetNation');
  const startWarBtn = document.getElementById('startWarBtn');

  const slot = WP.getActiveSlot();
  if (!slot) {
    location.href = 'index.html';
    return;
  }
  let state = WP.loadState(slot);
  if (!state) {
    location.href = 'index.html';
    return;
  }

  // Load nations from content (base + enabled DLC)
  let nations = [];
  try {
    const content = await WP.loadContent();
    nations = content.nations || [];
  } catch {
    nations = ['Brasil', 'Estados Unidos', 'Rússia', 'China', 'Europa', 'Japão'];
  }

  nations
    .filter((n) => n && n !== state.player.nation)
    .forEach((nation) => {
      const opt = document.createElement('option');
      opt.value = nation;
      opt.textContent = nation;
      targetSelect.appendChild(opt);
    });

  const costMap = {
    army: 2500,
    navy: 12000,
    airforce: 16000,
  };

  function refresh() {
    document.getElementById('armyCount').textContent = state.military.army;
    document.getElementById('navyCount').textContent = state.military.navy;
    document.getElementById('airforceCount').textContent = state.military.airforce;
    const fundsEl = document.getElementById('fundsDisplay');
    if (fundsEl) fundsEl.textContent = WP.formatMoney(state.economy.funds);
    const upEl = document.getElementById('milUpkeep');
    if (upEl) {
      const u = WP.calcUpkeep(state);
      upEl.textContent = WP.formatMoney(u.militaryUpkeep) + '/mês';
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
    const [minusBtn, _countSpan, plusBtn] = el.querySelectorAll('.controls > *');
    minusBtn.addEventListener('click', () => changeTroops(branch, -10));
    plusBtn.addEventListener('click', () => changeTroops(branch, 10));
  });

  startWarBtn.addEventListener('click', () => {
    const target = targetSelect.value;
    if (!target) return alert('Selecione um alvo.');

    if (!state.world.atWarWith.includes(target)) {
      state.world.atWarWith.push(target);
      state.world.stability = WP.clamp(state.world.stability - 2, 0, 100);
      state.log.push({ t: Date.now(), type: 'war', text: `Guerra declarada contra ${target}.` });
      WP.saveState(slot, state);
    }

    alert(`Guerra declarada contra ${target}.\n\nDica: avance turnos no Lobby para ver efeitos e eventos.`);
  });

  backBtn.addEventListener('click', () => (location.href = 'index.html'));
  refresh();
});
