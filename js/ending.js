document.addEventListener('DOMContentLoaded', () => {
  try{ window.WP_AUDIO && WP_AUDIO.startAmbience(); }catch{}
  const qs = new URLSearchParams(location.search);
  const slot = qs.get('slot') || localStorage.getItem('wp_active_slot') || WP.SLOT_KEYS[0];
  localStorage.setItem('wp_active_slot', String(slot));

  const state = WP.loadState(slot);
  const ending = state?.ending || { type:'', reason:'', at: Date.now() };

  const elTitle = document.getElementById('endingTitle');
  const elSub = document.getElementById('endingSub');
  const elBuild = document.getElementById('endingBuild');

  const titleMap = {
    victory: 'Hegemonia Global',
    collapse: 'Colapso Econômico',
    coup: 'Golpe Interno',
    defeat: 'Derrota Militar'
  };

  const subMap = {
    victory: 'Você consolidou domínio e reescreveu as regras do mundo.',
    collapse: 'O tesouro entrou em colapso e o governo não sustentou o Estado.',
    coup: 'A crise interna derrubou sua administração em meio ao caos.',
    defeat: 'O país foi incapaz de resistir ao ataque final.'
  };

  elTitle.textContent = titleMap[ending.type] || 'Fim de Campanha';
  elSub.textContent = subMap[ending.type] || (ending.reason || 'A campanha terminou.');
  try{
    const txt = `Build ${WP_BUILD.version} • ${WP_BUILD.date}`;
    elBuild.textContent = txt;
  }catch{ elBuild.textContent = '—'; }

  function money(n){ return `$ ${Math.round(n).toLocaleString('pt-BR')}`; }

  document.getElementById('statNation').textContent = state?.player?.nation || '—';
  document.getElementById('statYear').textContent = state?.world?.year || '—';
  document.getElementById('statDom').textContent = `${Math.round(state?.world?.dominance ?? 0)}%`;
  document.getElementById('statFunds').textContent = money(state?.economy?.funds ?? 0);
  document.getElementById('statStab').textContent = `${Math.round(state?.world?.stability ?? 0)}%`;
  document.getElementById('statPress').textContent = `${Math.round(state?.world?.pressure ?? 0)}%`;

  const wars = (state?.world?.wars || []).length;
  const tech = (state?.research?.completed || []).length;
  const missions = (state?.missionsCompleted || []).length;
  const summary = [
    `Guerras registradas: ${wars}.`,
    `Tecnologias concluídas: ${tech}.`,
    `Missões concluídas: ${missions}.`,
    ending.reason ? `Motivo: ${ending.reason}` : ''
  ].filter(Boolean).join(' ');
  document.getElementById('endingSummary').textContent = summary || '—';

  document.getElementById('btnBackLobby').addEventListener('click', () => {
    try{ WP_AUDIO && WP_AUDIO.click(); }catch{}
    location.href = `index.html?resume=1&slot=${encodeURIComponent(slot)}`;
  });
  document.getElementById('btnNew').addEventListener('click', () => {
    try{ WP_AUDIO && WP_AUDIO.click(); }catch{}
    // wipe slot and go to menu
    localStorage.removeItem(slot);
    localStorage.removeItem('wp_active_slot');
    location.href = 'index.html';
  });
});
