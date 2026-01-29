/*
 * relations.js
 *
 * Handles the diplomacy module. Lists available nations and allows the
 * player to interact with them by proposing alliances or peace. The
 * current game state is loaded from localStorage so the module can
 * modify and save changes.
 */

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Attempt to load the most recently used save
  let state = null;
  for (let i = 1; i <= 3; i++) {
    const data = localStorage.getItem(`save-slot-${i}`);
    if (data) {
      state = JSON.parse(data);
      break;
    }
  }
  if (!state) {
    // No save found, redirect to menu
    window.location.href = 'index.html';
    return;
  }

  // Default list of nations; in a real DLC system this could be loaded
  // dynamically from JSON manifests.
  const nations = [
    'Brasil',
    'Estados Unidos',
    'Rússia',
    'China',
    'Europa',
    'Japão',
  ];

  const listEl = document.getElementById('nationsList');
  const detailsEl = document.getElementById('nationDetails');
  const nameEl = document.getElementById('selectedNationName');
  const statusEl = document.getElementById('selectedNationStatus');
  const allianceBtn = document.getElementById('allianceBtn');
  const peaceBtn = document.getElementById('peaceBtn');

  // Create list items
  nations.forEach((nation) => {
    const item = document.createElement('div');
    item.className = 'nation-item';
    item.textContent = nation;
    item.addEventListener('click', () => {
      selectNation(nation);
    });
    listEl.appendChild(item);
  });

  function selectNation(nation) {
    nameEl.textContent = nation;
    statusEl.textContent = 'Status: Neutro';
    detailsEl.classList.remove('hidden');
  }

  allianceBtn.addEventListener('click', () => {
    alert('Aliança proposta! As relações diplomáticas melhoram.');
  });
  peaceBtn.addEventListener('click', () => {
    alert('Proposta de paz enviada.');
  });
});