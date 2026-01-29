/*
 * war.js
 *
 * Handles the war module. Allows players to choose a target nation and
 * manage troop allocations across Army, Navy and Air Force. Each
 * recruitment or demobilisation updates the funds available in the
 * global state. Starting a war currently just shows a message, but the
 * infrastructure is ready for further combat simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const targetSelect = document.getElementById('targetNation');
  const startWarBtn = document.getElementById('startWarBtn');

  // Load the current game state
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

  // Populate target nation list (excluding player's nation)
  const nations = [
    'Brasil',
    'Estados Unidos',
    'Rússia',
    'China',
    'Europa',
    'Japão',
  ].filter((n) => n !== state.nation);
  nations.forEach((nation) => {
    const option = document.createElement('option');
    option.value = nation;
    option.textContent = nation;
    targetSelect.appendChild(option);
  });

  // Update displayed troop counts
  function updateCounts() {
    document.getElementById('armyCount').textContent = state.army;
    document.getElementById('navyCount').textContent = state.navy;
    document.getElementById('airforceCount').textContent = state.airforce;
  }

  updateCounts();

  // Event for plus/minus buttons
  const branches = ['army', 'navy', 'airforce'];
  branches.forEach((branch) => {
    const branchEl = document.querySelector(`.branch[data-branch="${branch}"]`);
    const [minusBtn, countSpan, plusBtn] = branchEl.querySelectorAll('.controls > *');
    minusBtn.addEventListener('click', () => changeTroops(branch, -10));
    plusBtn.addEventListener('click', () => changeTroops(branch, 10));
  });

  // Cost per troop type
  const costMap = {
    army: 1000,
    navy: 5000,
    airforce: 7000,
  };

  function changeTroops(branch, delta) {
    const cost = costMap[branch] * delta;
    // For demobilisation, refund 80% to simulate losses
    if (delta < 0) {
      const actualDelta = Math.min(Math.abs(delta), state[branch]);
      state[branch] -= actualDelta;
      const refund = costMap[branch] * actualDelta * 0.8;
      state.funds += refund;
    } else {
      const required = cost;
      if (state.funds >= required) {
        state[branch] += delta;
        state.funds -= required;
      } else {
        alert('Fundos insuficientes para recrutar.');
      }
    }
    // Save and update UI
    localStorage.setItem(slot, JSON.stringify(state));
    updateCounts();
  }

  startWarBtn.addEventListener('click', () => {
    const target = targetSelect.value;
    if (!target) {
      alert('Selecione um alvo.');
      return;
    }
    alert(`Guerra declarada contra ${target}! Boa sorte, ${state.name}.`);
    // In a future expansion we could simulate battle outcomes here
  });

  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
});