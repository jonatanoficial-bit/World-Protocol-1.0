/*
 * commerce.js — Centro de Comércio
 *
 * Lightweight buy/sell system with dynamic prices per session.
 * Inventory is stored in game state.
 */

document.addEventListener('DOMContentLoaded', () => {
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

  state.inventory = state.inventory || { food: 0, oil: 0, metals: 0, weapons: 0 };

  const products = [
    { key: 'food', name: 'Alimentos', base: 90 },
    { key: 'oil', name: 'Petróleo', base: 320 },
    { key: 'metals', name: 'Metais', base: 210 },
    { key: 'weapons', name: 'Equipamentos', base: 520 },
  ];

  // Session prices (stored in localStorage per month for consistency)
  const priceKey = `wp_prices_${state.calendar.year}_${state.calendar.month}`;
  let prices = null;
  try { prices = JSON.parse(localStorage.getItem(priceKey) || 'null'); } catch {}
  if (!prices) {
    prices = {};
    products.forEach(p => {
      const swing = 0.75 + Math.random() * 0.8; // 0.75..1.55
      prices[p.key] = Math.round(p.base * swing);
    });
    localStorage.setItem(priceKey, JSON.stringify(prices));
  }

  const tableBody = document.getElementById('productsBody');
  const fundsEl = document.getElementById('fundsDisplay');

  function render() {
    if (fundsEl) fundsEl.textContent = WP.formatMoney(state.economy.funds);
    tableBody.innerHTML = '';

    products.forEach((p) => {
      const tr = document.createElement('tr');
      const price = prices[p.key];
      const qty = state.inventory[p.key] || 0;
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${WP.formatMoney(price)}</td>
        <td>${qty}</td>
        <td>
          <button class="btn" data-buy="${p.key}">Comprar</button>
          <button class="btn secondary" data-sell="${p.key}">Vender</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    tableBody.querySelectorAll('button[data-buy]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.getAttribute('data-buy');
        const price = prices[key];
        const amount = 10;
        const cost = price * amount;
        if (state.economy.funds < cost) return alert('Fundos insuficientes.');
        state.economy.funds -= cost;
        state.inventory[key] = (state.inventory[key] || 0) + amount;
        state.log.push({ t: Date.now(), type: 'trade', text: `Comprou ${amount}x ${key}. (-${WP.formatMoney(cost)})` });
        WP.saveState(slot, state);
        render();
      });
    });

    tableBody.querySelectorAll('button[data-sell]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.getAttribute('data-sell');
        const price = prices[key];
        const amount = 10;
        const have = state.inventory[key] || 0;
        if (have < amount) return alert('Você não tem estoque suficiente.');
        // Sell at 85% market price (fees)
        const gain = Math.round(price * amount * 0.85);
        state.inventory[key] = have - amount;
        state.economy.funds += gain;
        state.log.push({ t: Date.now(), type: 'trade', text: `Vendeu ${amount}x ${key}. (+${WP.formatMoney(gain)})` });
        WP.saveState(slot, state);
        render();
      });
    });
  }

  render();
});
