/*
 * infrastructure.js
 *
 * Provides controls for investing in different infrastructure sectors. Each
 * click adjusts the investment by a fixed amount and updates the funds
 * available in the game state. Sectors can later influence missions
 * and game outcomes when expansion packs are added.
 */

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Load state
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

  // Initialize investments
  if (!state.investments) {
    state.investments = {};
  }
  const sectors = [
    'Transporte',
    'Saúde',
    'Educação',
    'Pesquisa Científica',
    'Corrida Espacial',
  ];
  const tbody = document.getElementById('infraBody');
  const increment = 100000;

  sectors.forEach((sector) => {
    if (!state.investments[sector]) state.investments[sector] = 0;
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = sector;
    const investCell = document.createElement('td');
    investCell.id = `${sector}-invest`;
    investCell.textContent = formatCurrency(state.investments[sector]);
    const actionsCell = document.createElement('td');
    const minusBtn = document.createElement('button');
    minusBtn.className = 'btn secondary';
    minusBtn.textContent = '-';
    minusBtn.addEventListener('click', () => changeInvest(sector, -increment));
    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => changeInvest(sector, increment));
    actionsCell.appendChild(minusBtn);
    actionsCell.appendChild(plusBtn);
    row.appendChild(nameCell);
    row.appendChild(investCell);
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function changeInvest(sector, delta) {
    if (delta > 0) {
      if (state.funds < delta) {
        alert('Fundos insuficientes.');
        return;
      }
      state.funds -= delta;
      state.investments[sector] += delta;
    } else {
      // Refund 70%
      const current = state.investments[sector];
      const value = Math.min(Math.abs(delta), current);
      state.investments[sector] -= value;
      state.funds += Math.round(value * 0.7);
    }
    // Update cell
    document.getElementById(`${sector}-invest`).textContent = formatCurrency(
      state.investments[sector]
    );
    localStorage.setItem(slot, JSON.stringify(state));
  }
});