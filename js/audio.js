/* audio.js — Premium micro-interactions + ambient (WebAudio)
 * No external audio files required. Includes a user toggle.
 */
(function(){
  const KEY = 'wp_audio_enabled';
  let enabled = localStorage.getItem(KEY);
  if (enabled === null) enabled = '1';
  let ctx = null;
  let ambienceNode = null;
  let ambienceGain = null;

  function ensure(){
    if (!enabled || enabled === '0') return null;
    if (!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended'){
      ctx.resume().catch(()=>{});
    }
    return ctx;
  }

  function click(){
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.09);
  }

  function typeTick(){
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = 880 + Math.random()*120;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.02, c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.03);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.035);
  }

  function startAmbience(){
    const c = ensure(); if (!c) return;
    if (ambienceNode) return;

    // soft drone + noise bed
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    ambienceGain = g;
    g.gain.value = 0.015;

    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.value = 55;
    o2.frequency.value = 110;

    // subtle LFO
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    lfoG.gain.value = 10;
    lfo.connect(lfoG);
    lfoG.connect(o1.frequency);
    lfoG.connect(o2.frequency);

    o1.connect(g);
    o2.connect(g);
    g.connect(c.destination);

    o1.start(); o2.start(); lfo.start();
    ambienceNode = {o1,o2,lfo,g};
  }

  function stopAmbience(){
    if (!ambienceNode || !ctx) return;
    try{
      ambienceNode.o1.stop(); ambienceNode.o2.stop(); ambienceNode.lfo.stop();
      ambienceNode.g.disconnect();
    }catch{}
    ambienceNode = null;
  }

  function setEnabled(v){
    enabled = v ? '1' : '0';
    localStorage.setItem(KEY, enabled);
    if (enabled === '0') stopAmbience();
    else startAmbience();
  }

  function isEnabled(){ return enabled !== '0'; }

  
  function alertBeep(level){
    const c = ensure(); if (!c) return;
    const base = level==='critical' ? 980 : (level==='high' ? 820 : 660);
    const reps = level==='critical' ? 3 : (level==='high' ? 2 : 1);
    for (let r=0;r<reps;r++){
      const t0 = c.currentTime + r*0.18;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, t0);
      o.frequency.exponentialRampToValueAtTime(base*0.7, t0+0.08);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.07, t0+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+0.12);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0+0.14);
    }
  }

  // Expose
  window.WP_AUDIO = { click, typeTick, alertBeep, startAmbience, stopAmbience, setEnabled, isEnabled, ensure };
})();
