/* research.js — Tech Tree + Research progression (turn-based)
 * Uses WP core state + tech catalog from /content/tech/base-tech.json (and DLC tech).
 */
document.addEventListener('DOMContentLoaded', async () => {
  const qs = new URLSearchParams(location.search);
  const slot = qs.get('slot') || localStorage.getItem('wp_active_slot') || WP.SLOT_KEYS[0];
  localStorage.setItem('wp_active_slot', String(slot));

  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => {
    location.href = `index.html?resume=1&slot=${encodeURIComponent(slot)}`;
  });

  const elFunds = document.getElementById('fundsBadge');
  const elActiveTitle = document.getElementById('activeTitle');
  const elActiveMeta = document.getElementById('activeMeta');
  const elActiveBar = document.getElementById('activeBar');
  const elActiveProgress = document.getElementById('activeProgress');
  const elGrid = document.getElementById('techGrid');
  const elCompleted = document.getElementById('completedBadge');

  function money(n){ return `$ ${Math.max(0, Math.round(n)).toLocaleString('pt-BR')}`; }
  function pct(n){ return `${Math.round(n)}%`; }

  let content = WP.getContent ? WP.getContent() : { tech: [] };
  if (!content?.tech?.length) {
    try {
      const loaded = await WP.loadContent();
      if (loaded) { content = loaded; try{ WP.setContent(content); }catch{} }
    } catch {}
  }

  const techList = Array.isArray(content.tech) ? content.tech : [];
  const techMap = Object.fromEntries(techList.map(t => [t.id, t]));

  function getState(){ return WP.loadState(slot); }
  function saveState(s){ WP.saveState(slot, s); }

  function canStart(state, tech){
    const done = state.research.completed || [];
    if (done.includes(tech.id)) return false;
    const req = tech.requires || [];
    return req.every(id => done.includes(id));
  }

  function render(){
    const state = getState();
    elFunds.textContent = money(state.economy.funds);

    const activeId = state.research.activeId;
    if (!activeId){
      elActiveTitle.textContent = 'Nenhum projeto ativo';
      elActiveMeta.textContent = 'Selecione uma tecnologia para iniciar pesquisa.';
      elActiveBar.style.width = '0%';
      elActiveProgress.textContent = '—';
    } else {
      const t = techMap[activeId];
      elActiveTitle.textContent = t ? t.name : activeId;
      elActiveMeta.textContent = t ? `${t.category} • ${t.turns} turnos • ${money(t.costPerTurn)}/turno` : '—';
      elActiveBar.style.width = pct(state.research.progress || 0);
      elActiveProgress.textContent = `Progresso: ${pct(state.research.progress || 0)}`;
    }

    elCompleted.textContent = `${(state.research.completed||[]).length} concluída(s)`;

    elGrid.innerHTML = '';
    for (const t of techList){
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.padding = '14px';
      card.style.borderRadius = '16px';
      card.style.position = 'relative';

      const done = (state.research.completed||[]).includes(t.id);
      const locked = !canStart(state, t);
      const isActive = state.research.activeId === t.id;

      const badge = done ? 'CONCLUÍDA' : (isActive ? 'ATIVA' : (locked ? 'BLOQUEADA' : 'DISPONÍVEL'));
      const badgeStyle = done ? 'rgba(70,255,170,0.14)' : (isActive ? 'rgba(79,154,255,0.14)' : (locked ? 'rgba(255,255,255,0.08)' : 'rgba(255,220,120,0.12)'));

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="font-family:Orbitron,sans-serif;letter-spacing:1px;font-size:13px;opacity:.85;">${t.category} • Tier ${t.tier||1}</div>
          <div class="badge" style="background:${badgeStyle};">${badge}</div>
        </div>
        <div style="font-size:16px;font-weight:900;margin-top:10px;">${t.name}</div>
        <div style="opacity:.85;margin-top:6px;line-height:1.35;font-size:13px;">${t.desc}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          <span class="badge">${t.turns} turnos</span>
          <span class="badge">${money(t.costPerTurn)}/turno</span>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn ${locked||done||isActive?'secondary':''}" data-action="start" ${locked||done||isActive?'disabled':''}>Iniciar</button>
          <button class="btn secondary" data-action="details">Detalhes</button>
        </div>
      `;

      card.querySelector('[data-action="start"]').addEventListener('click', () => {
        const s = getState();
        s.research.activeId = t.id;
        s.research.progress = 0;
        saveState(s);
        if (WP.toast) WP.toast(`Pesquisa iniciada: ${t.name}`);
        render();
      });

      card.querySelector('[data-action="details"]').addEventListener('click', () => {
        const effects = t.effects || {};
        const lines = [];
        for (const [k,v] of Object.entries(effects)){
          lines.push(`${k}: ${v}`);
        }
        alert(`${t.name}\n\n${t.desc}\n\nEfeitos:\n${lines.join('\n') || '—'}\n\nRequisitos: ${(t.requires||[]).join(', ') || '—'}`);
      });

      elGrid.appendChild(card);
    }
  }

  render();
});
