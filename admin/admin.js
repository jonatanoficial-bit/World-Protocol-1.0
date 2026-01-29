/*
 * admin.js
 *
 * Provides a simple local administration panel for managing downloadable
 * content (DLC) within Estratégia 2030. The current implementation is
 * purely client-side and uses localStorage for persistence. In a future
 * iteration, this could be replaced with backend integration for user
 * authentication and content management.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('loginSection');
  const panelSection = document.getElementById('panelSection');
  const loginForm = document.getElementById('loginForm');
  const addDlcForm = document.getElementById('addDlcForm');
  const dlcListEl = document.getElementById('dlcList');

  // Initialize admin credentials if none exist
  if (!localStorage.getItem('adminUser')) {
    localStorage.setItem('adminUser', 'admin');
    localStorage.setItem('adminPass', 'admin');
  }

  // Event: login
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    if (
      user === localStorage.getItem('adminUser') &&
      pass === localStorage.getItem('adminPass')
    ) {
      loginSection.classList.add('hidden');
      panelSection.classList.remove('hidden');
      loadDlcList();
    } else {
      alert('Credenciais inválidas');
    }
  });

  // Load DLC list from storage
  function loadDlcList() {
    dlcListEl.innerHTML = '';
    const list = JSON.parse(localStorage.getItem('dlcList') || '[]');
    if (list.length === 0) {
      dlcListEl.textContent = 'Nenhuma DLC instalada.';
    } else {
      list.forEach((dlc, index) => {
        const div = document.createElement('div');
        div.className = 'nation-item';
        div.textContent = `${dlc.name} v${dlc.version}`;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn secondary';
        removeBtn.textContent = 'Remover';
        removeBtn.style.marginLeft = '1rem';
        removeBtn.addEventListener('click', () => removeDlc(index));
        div.appendChild(removeBtn);
        dlcListEl.appendChild(div);
      });
    }
  }

  // Add new DLC
  addDlcForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('dlcName').value.trim();
    const version = document.getElementById('dlcVersion').value.trim();
    if (!name || !version) return;
    const list = JSON.parse(localStorage.getItem('dlcList') || '[]');
    list.push({ name, version });
    localStorage.setItem('dlcList', JSON.stringify(list));
    loadDlcList();
    addDlcForm.reset();
  });

  // Remove DLC at given index
  function removeDlc(index) {
    const list = JSON.parse(localStorage.getItem('dlcList') || '[]');
    list.splice(index, 1);
    localStorage.setItem('dlcList', JSON.stringify(list));
    loadDlcList();
  }
});