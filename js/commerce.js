/*
 * commerce.js
 *
 * Handles the commerce module, allowing the player to buy and sell
 * resources. Each transaction updates the player's funds and inventory.
 */

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Load current game state
  let state = null;
  let slot = null;
  for (let i = 1; i <= 3; i++) {
    const key = `save-slot-${i}`;
    const data = localStorage.getItem(key);
    if (data) {
      state = JSON.parse(data);
      slot = key;
      break;
    }
  }
  if (!state) {
    window.location.href = 'index.html';
    return;
  }

  // Initialize inventory if needed
  if (!state.inventory) {
    state.inventory = {};
  }

  // Items available for trade with base prices
  const items = [
    { name: 'Comida', base: 50 },
    { name: 'Petróleo', base: 100 },
    { name: 'Armas', base: 500 },
  ];

  const tbody = document.getElementById('commerceBody');

  // Populate table rows
  items.forEach((item) => {
    const price = Math.round(item.base * (0.8 + Math.random() * 0.4));
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = item.name;
    const priceCell = document.createElement('td');
    priceCell.textContent = `R$ ${price}`;
    const qtyCell = document.createElement('td');
    qtyCell.id = `${item.name}-qty`;
    qtyCell.textContent = state.inventory[item.name] || 0;
    const actionsCell = document.createElement('td');
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn';
    buyBtn.textContent = 'Comprar';
    buyBtn.addEventListener('click', () => buy(item.name, price));
    const sellBtn = document.createElement('button');
    sellBtn.className = 'btn secondary';
    sellBtn.textContent = 'Vender';
    sellBtn.addEventListener('click', () => sell(item.name, price));
    actionsCell.appendChild(buyBtn);
    actionsCell.appendChild(sellBtn);
    row.appendChild(nameCell);
    row.appendChild(priceCell);
    row.appendChild(qtyCell);
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });

  function buy(name, price) {
    if (state.funds < price) {
      alert('Fundos insuficientes.');
      return;
    }
    state.funds -= price;
    state.inventory[name] = (state.inventory[name] || 0) + 1;
    updateAndSave();
  }

  function sell(name, price) {
    const qty = state.inventory[name] || 0;
    if (qty <= 0) {
      alert('Você não possui este item.');
      return;
    }
    state.inventory[name] = qty - 1;
    // Sale price is 70% of purchase price
    state.funds += Math.round(price * 0.7);
    updateAndSave();
  }

  function updateAndSave() {
    // Update quantities
    items.forEach((item) => {
      const qty = state.inventory[item.name] || 0;
      const cell = document.getElementById(`${item.name}-qty`);
      if (cell) cell.textContent = qty;
    });
    // Save state
    localStorage.setItem(slot, JSON.stringify(state));
  }
});