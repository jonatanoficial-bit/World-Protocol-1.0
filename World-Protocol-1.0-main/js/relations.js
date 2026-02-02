/*
 * relations.js — Centro de Relações
 *
 * Minimal diplomacy loop:
 * - List nations
 * - Propose alliance / peace
 * - Tracks relationship score per nation
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const urlSlot = params.get('slot');
  if (urlSlot && WP.SLOT_KEYS.includes(urlSlot) && WP.loadState(urlSlot)) {
    WP.setActiveSlot(urlSlot);
  }

  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => {
    const slot = WP.getActiveSlot();
    location.href = slot ? `index.html?resume=1&slot=${encodeURIComponent(slot)}` : 'index.html';
  });

  const slot = WP.getActiveSlot();
  if (!slot) return (location.href = 'index.html');
  let state = WP.loadState(slot);
  if (!state) return (location.href = 'index.html');

  let nations = [];
  try {
    const content = await WP.loadContent();
    nations = content.nations || [];
  } catch {
    nations = ['Brasil', 'Estados Unidos', 'Rússia', 'China', 'Europa', 'Japão'];
  }

  // Init diplomacy map
  state.world.diplomacy = state.world.diplomacy || {};
  nations.forEach((n) => {
    if (n === state.player.nation) return;
    if (typeof state.world.diplomacy[n] !== 'number') state.world.diplomacy[n] = 50; // 0..100
  });
  WP.saveState(slot, state);

  const listEl = document.getElementById('nationList');
  const detailsEl = document.getElementById('details');

  function relLabel(v) {
    if (v >= 75) return 'Aliado';
    if (v >= 55) return 'Neutro';
    if (v >= 35) return 'Tenso';
    return 'Hostil';
  }

  function renderList() {
    listEl.innerHTML = '';
    nations
      .filter((n) => n !== state.player.nation)
      .forEach((n) => {
        const v = state.world.diplomacy[n] ?? 50;
        const item = document.createElement('button');
        item.className = 'btn secondary';
        item.style.textAlign = 'left';
        item.style.width = '100%';
        item.innerHTML = `${n} <span style="opacity:.75">• ${relLabel(v)} (${v})</span>`;
        item.addEventListener('click', () => renderDetails(n));
        listEl.appendChild(item);
      });
  }

  function renderDetails(nation) {
    const v = state.world.diplomacy[nation] ?? 50;
    const atWar = state.world.atWarWith.includes(nation);
    detailsEl.innerHTML = `
      <h3 style="margin:0 0 8px">${nation}</h3>
      <div style="opacity:.85; margin-bottom:10px">Status: <b>${relLabel(v)}</b> • Relação: <b>${v}</b> • Guerra: <b>${atWar ? 'Sim' : 'Não'}</b></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button id="ally" class="btn">Propor Aliança</button>
        <button id="peace" class="btn secondary">Negociar Paz</button>
        <button id="sanction" class="btn secondary">Sanções</button>
      </div>
      <div style="opacity:.78; margin-top:12px; font-size:13px">
        Dica: relações altas aumentam estabilidade e renda. Relações baixas elevam risco de eventos e guerra.
      </div>
    `;

    detailsEl.querySelector('#ally').onclick = () => {
      state.world.diplomacy[nation] = WP.clamp(v + 8, 0, 100);
      state.world.stability = WP.clamp(state.world.stability + 1, 0, 100);
      state.log.push({ t: Date.now(), type: 'diplo', text: `Proposta de aliança enviada para ${nation}.` });
      WP.saveState(slot, state);
      renderList();
      renderDetails(nation);
    };
    detailsEl.querySelector('#peace').onclick = () => {
      if (atWar) {
        state.world.atWarWith = state.world.atWarWith.filter((x) => x !== nation);
        state.world.stability = WP.clamp(state.world.stability + 2, 0, 100);
      }
      state.world.diplomacy[nation] = WP.clamp(v + 4, 0, 100);
      state.log.push({ t: Date.now(), type: 'diplo', text: `Negociação de paz iniciada com ${nation}.` });
      WP.saveState(slot, state);
      renderList();
      renderDetails(nation);
    };
    detailsEl.querySelector('#sanction').onclick = () => {
      state.world.diplomacy[nation] = WP.clamp(v - 6, 0, 100);
      // sanctions: short-term money, long-term stability hit
      const gain = 250_000;
      state.economy.funds += gain;
      state.world.stability = WP.clamp(state.world.stability - 1, 0, 100);
      state.log.push({ t: Date.now(), type: 'diplo', text: `Sanções aplicadas a ${nation}. +${WP.formatMoney(gain)}.` });
      WP.saveState(slot, state);
      renderList();
      renderDetails(nation);
    };
  }

  renderList();
  // default details
  const first = nations.find((n) => n !== state.player.nation);
  if (first) renderDetails(first);
});
