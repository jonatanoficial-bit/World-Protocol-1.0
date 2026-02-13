/* map.js — Global Map + Influence
 * This module visualizes regional influence and allows the player to
 * run influence campaigns. Works with URL slot (?slot=1..3).
 */
document.addEventListener('DOMContentLoaded', () => {
  try{ window.WP_AUDIO && WP_AUDIO.startAmbience(); }catch{}

  const qs = new URLSearchParams(location.search);
  const slot = Number(qs.get('slot') || localStorage.getItem('wp_active_slot') || 1);
  localStorage.setItem('wp_active_slot', String(slot));

  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => {
    try{ WP_AUDIO && WP_AUDIO.click(); }catch{}
    location.href = `index.html?resume=1&slot=${encodeURIComponent(slot)}`;
  });

  const elFunds = document.getElementById('fundsBadge');
  const elDom = document.getElementById('dominanceBadge');
  const elDomBar = document.getElementById('dominanceBar');

  const elRegionName = document.getElementById('regionName');
  const elRegionInfluence = document.getElementById('regionInfluence');
  const elRegionWars = document.getElementById('regionWars');
  const elRegionBar = document.getElementById('regionBar');
  const elRegionList = document.getElementById('regionList');

  const btnInvest = document.getElementById('btnInvest');
  const btnIntel = document.getElementById('btnIntel');

  const regions = [
    { key: 'americas', label: 'Américas', svg: 'r-americas', weight: 1.1 },
    { key: 'europe', label: 'Europa', svg: 'r-europe', weight: 1.0 },
    { key: 'africa', label: 'África', svg: 'r-africa', weight: 0.9 },
    { key: 'asia', label: 'Ásia', svg: 'r-asia', weight: 1.2 },
    { key: 'oceania', label: 'Oceania', svg: 'r-oceania', weight: 0.6 },
  ];

  let selected = 'americas';

  function money(n){
    return `$ ${Math.max(0, Math.round(n)).toLocaleString('pt-BR')}`;
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function getState(){
    const s = WP.loadState(slot);
    return s;
  }
  function saveState(s){
    WP.saveState(slot, s);
  }

  function warsInRegion(state, regionKey){
    const w = state.world;
    const map = (WP.getNationRegionMap && WP.getNationRegionMap()) || {};
    return (w.wars || []).filter(x => (map[x.target] || 'americas') === regionKey).length;
  }

  function calcDominance(state){
    const inf = state.world.influence || {};
    let sum = 0, wsum = 0;
    for (const r of regions){
      const v = Number(inf[r.key] ?? 0);
      sum += v * r.weight;
      wsum += r.weight;
    }
    return clamp(Math.round(sum / wsum), 0, 100);
  }

  function colorFor(v){
    // returns rgba string with intensity based on influence
    const t = clamp(v/100, 0, 1);
    const a = 0.18 + t * 0.55;
    return `rgba(79,154,255,${a.toFixed(3)})`;
  }

  function refresh(){
    const state = getState();
    const dom = calcDominance(state);
    state.world.dominance = dom; // keep in sync
    saveState(state);

    elFunds.textContent = money(state.economy.funds);
    elDom.textContent = `${dom}%`;
    elDomBar.style.width = `${dom}%`;

    // update map fills
    const inf = state.world.influence || {};
    for (const r of regions){
      const v = Number(inf[r.key] ?? 0);
      const node = document.getElementById(r.svg);
      if (node){
        node.setAttribute('fill', colorFor(v));
        node.setAttribute('stroke', 'rgba(255,255,255,0.18)');
        node.setAttribute('stroke-width', '1.2');
        node.setAttribute('filter', 'url(#glow)');
      }
    }

    // region list
    elRegionList.innerHTML = '';
    for (const r of regions){
      const v = Number(inf[r.key] ?? 0);
      const wars = warsInRegion(state, r.key);
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.gap = '10px';
      row.style.alignItems = 'center';
      row.innerHTML = `<div style="opacity:.95">${r.label}</div><div class="badge">${v}%${wars?` • ${wars} guerra(s)`:''}</div>`;
      row.addEventListener('click', () => select(r.key));
      elRegionList.appendChild(row);
    }

    // selected panel
    const r = regions.find(x => x.key === selected) || regions[0];
    const v = Number(inf[r.key] ?? 0);
    const wars = warsInRegion(state, r.key);
    elRegionName.textContent = r.label;
    elRegionInfluence.textContent = `${v}% influência`;
    elRegionWars.textContent = wars ? `${wars} guerra(s) ativa(s)` : 'Sem guerras ativas';
    elRegionBar.style.width = `${v}%`;
  }

  function select(key){
    selected = key;
    refresh();
  }

  function toast(msg){
    if (WP.toast) WP.toast(msg);
    else alert(msg);
  }

  btnInvest.addEventListener('click', () => {
    const state = getState();
    const cost = 250000;
    if (state.economy.funds < cost){
      toast('Fundos insuficientes para campanha.');
      return;
    }
    state.economy.funds -= cost;
    const mult = 1 + (state.modifiers?.influenceGainMult || 0);
    const gain = Math.round((2 + Math.floor(Math.random() * 4)) * mult); // 2..5 * mult
    state.world.influence[selected] = clamp((state.world.influence[selected] ?? 0) + gain, 0, 100);
    state.log.push({ t: Date.now(), type: 'map', text: `Campanha de influência em ${selected}. +${gain}% (custo ${money(cost)}).` });
    saveState(state);
    toast(`Influência aumentada em +${gain}%.`);
    refresh();
  });

  btnIntel.addEventListener('click', () => {
    const state = getState();
    const cost = 420000;
    if (state.economy.funds < cost){
      toast('Fundos insuficientes para operação.');
      return;
    }
    state.economy.funds -= cost;
    const mult = 1 + (state.modifiers?.influenceGainMult || 0);
    const gain = Math.round((3 + Math.floor(Math.random() * 6)) * mult); // 3..8 * mult
    const risk = Math.random();
    state.world.influence[selected] = clamp((state.world.influence[selected] ?? 0) + gain, 0, 100);
    const rr = (state.modifiers?.intelRiskReduction || 0);
    const threshold = Math.max(0.10, 0.35 - rr);
    if (risk < threshold){
      state.world.pressure = clamp(state.world.pressure + 6, 0, 100);
      state.log.push({ t: Date.now(), type: 'intel', text: `Operação de inteligência exposta. Pressão internacional aumentou.` });
      toast(`+${gain}% influência, mas a operação foi exposta (+pressão).`);
    } else {
      toast(`+${gain}% influência com sucesso.`);
    }
    state.log.push({ t: Date.now(), type: 'intel', text: `Operação de inteligência em ${selected}. +${gain}% (custo ${money(cost)}).` });
    saveState(state);
    refresh();
  });

  // attach click handlers to svg regions
  for (const r of regions){
    const node = document.getElementById(r.svg);
    if (node){
      node.addEventListener('click', () => select(r.key));
    }
  }

  // init
  const state = getState();
  state.world.influence = state.world.influence || { americas: 5, europe: 3, africa: 2, asia: 3, oceania: 1 };
  saveState(state);
  select('americas');
});