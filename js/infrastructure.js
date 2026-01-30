/*
 * infrastructure.js — Infraestrutura
 *
 * Mobile-first UI for managing monthly investments. Investments are treated
 * as recurring monthly commitments (they increase monthly upkeep). Some
 * sectors also lightly improve income via WP.calcIncome.
 */

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => (location.href = 'index.html'));

  const slot = WP.getActiveSlot();
  if (!slot) return (location.href = 'index.html');
  let state = WP.loadState(slot);
  if (!state) return (location.href = 'index.html');

  const fundsEl = document.getElementById('fundsDisplay');
  const netEl = document.getElementById('netPreview');
  const bodyEl = document.getElementById('infraBody');

  const sectors = [
    { key: 'transport', label: 'Transporte', hint: 'Logística, estradas, portos' },
    { key: 'health', label: 'Saúde', hint: 'Hospitais, resposta a crises' },
    { key: 'education', label: 'Educação', hint: 'Capacitação, estabilidade' },
    { key: 'science', label: 'Pesquisa', hint: 'Tecnologia e inovação' },
    { key: 'space', label: 'Corrida Espacial', hint: 'Satélites e vantagem estratégica' },
  ];

  const STEP = 100_000;

  function render() {
    if (fundsEl) fundsEl.textContent = WP.formatMoney(state.economy.funds);

    const income = WP.calcIncome(state);
    const upkeep = WP.calcUpkeep(state);
    const net = income - upkeep.total;
    if (netEl) netEl.textContent = `${net >= 0 ? '+' : ''}${WP.formatMoney(net)}/mês`;

    bodyEl.innerHTML = '';
    sectors.forEach((s) => {
      const v = state.infrastructure?.[s.key] || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight:700">${s.label}</div>
          <div style="opacity:.78; font-size:12px">${s.hint}</div>
        </td>
        <td><b>${WP.formatMoney(v)}</b><div style="opacity:.78; font-size:12px">/mês</div></td>
        <td>
          <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap">
            <button class="btn secondary" data-minus="${s.key}">-100K</button>
            <button class="btn" data-plus="${s.key}">+100K</button>
          </div>
        </td>
      `;
      bodyEl.appendChild(tr);
    });

    bodyEl.querySelectorAll('button[data-minus]').forEach((b) => {
      b.addEventListener('click', () => change(b.getAttribute('data-minus'), -STEP));
    });
    bodyEl.querySelectorAll('button[data-plus]').forEach((b) => {
      b.addEventListener('click', () => change(b.getAttribute('data-plus'), +STEP));
    });
  }

  function change(key, delta) {
    const cur = state.infrastructure?.[key] || 0;
    const next = Math.max(0, cur + delta);
    state.infrastructure = state.infrastructure || {};
    state.infrastructure[key] = next;
    state.log?.push({
      t: Date.now(),
      type: 'infra',
      text: `Investimento em ${key}: ${WP.formatMoney(next)}/mês.`,
    });
    WP.saveState(slot, state);
    render();
  }

  render();
});
