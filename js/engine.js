// engine.js — v1.1.1 (scene/tween/particles/save/audio)
// Designed to be dependency-free and offline-friendly.
(() => {
  const $ = (sel) => document.querySelector(sel);

  // Canvas
  const canvas = $("#game");
  const ctx = canvas.getContext("2d", { alpha: true });
  let W = innerWidth, H = innerHeight;
  function resize(){ W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; }
  resize(); addEventListener("resize", resize, {passive:true});

  // Utils
  const rand = (a,b)=>Math.random()*(b-a)+a;
  const choice = a => a[Math.floor(Math.random()*a.length)];
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const now = ()=>performance.now();

  // Save (localStorage with guard)
  const Save = {
    get(key, fallback=null){
      try { const v = localStorage.getItem(key); return v?JSON.parse(v):fallback; } catch { return fallback; }
    },
    set(key, value){
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  };

  // Tween
  const Tweens = new Set();
  function tween(target, props, ms, ease=(t)=>t, onDone){
    const start = now();
    const from = {};
    for(const k in props){ from[k] = target[k]; }
    const tw = { target, props, from, start, ms, ease, onDone };
    Tweens.add(tw);
    return tw;
  }
  function stepTweens(dt){
    const t = now();
    for(const tw of Array.from(Tweens)){
      const k = clamp((t - tw.start) / tw.ms, 0, 1);
      const e = tw.ease(k);
      for(const p in tw.props){
        const a = tw.from[p], b = tw.props[p];
        tw.target[p] = a + (b - a) * e;
      }
      if(k >= 1){ Tweens.delete(tw); if(tw.onDone) tw.onDone(); }
    }
  }
  const Easings = {
    linear: t=>t,
    quadOut: t=>1-(1-t)*(1-t),
    quadIn: t=>t*t,
    backOut: t=>{ const c1=1.70158; const c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); },
    expoOut: t=> t===1 ? 1 : 1 - Math.pow(2, -10*t),
  };

  // Particles (pooled)
  class Particle {
    constructor(){ this.x=0; this.y=0; this.vx=0; this.vy=0; this.r=2; this.life=0; this.a=1; this.h=0; }
    spawn(x,y){
      this.x=x; this.y=y; this.vx=rand(-2,2); this.vy=rand(-3,-0.2);
      this.r=rand(1.2,3.2); this.life=rand(0.6,1.2); this.a=1; this.h=rand(0,360);
    }
    step(dt){
      this.x += this.vx*60*dt;
      this.y += this.vy*60*dt;
      this.vy += 0.03;
      this.life -= dt;
      this.a = clamp(this.life*1.2, 0, 1);
    }
    draw(ctx){
      if(this.life<=0) return;
      ctx.save();
      ctx.globalAlpha = this.a;
      ctx.fillStyle = `hsl(${this.h} 80% 60%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
  const PCOUNT = 300;
  const Particles = Array.from({length:PCOUNT}, ()=>new Particle());
  let pHead = 0;
  function burst(x,y,n=40){ for(let i=0;i<n;i++){ Particles[pHead++ % PCOUNT].spawn(x,y); } }
  function drawParticles(ctx, dt){ for(const p of Particles){ if(p.life>0){ p.step(dt); p.draw(ctx); } } }

  // Audio (synth only; no external files)
  let audioCtx = null;
  function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
  function sfx(freq=880, type="sine", time=0.25, vol=0.001){
    if(!window.SFX_ON) return;
    ensureAudio();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=vol;
    o.connect(g); g.connect(audioCtx.destination);
    const t=audioCtx.currentTime;
    g.gain.exponentialRampToValueAtTime(vol*90, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+time);
    o.start(); o.stop(t+time+0.02);
  }
  const beepGood=()=>sfx(880,"sine",0.20,0.0008);
  const beepBad=()=>sfx(180,"triangle",0.25,0.0009);
  const fanfare=()=>sfx(1320,"square",0.32,0.0009);

  // Parallax background
  const bgSky = new Image(); bgSky.src = "assets/bg-sky.png";
  const bgClouds = new Image(); bgClouds.src = "assets/bg-clouds.png";
  const bgNebula = new Image(); bgNebula.src = "assets/bg-nebula.png";
  function drawParallax(ts){
    ctx.drawImage(bgSky, 0, 0, W, H);
    ctx.globalAlpha = 0.45;
    const cx = -((ts*0.08)%W);
    ctx.drawImage(bgClouds, cx, 0, W, H);
    ctx.drawImage(bgClouds, cx+W, 0, W, H);
    ctx.globalAlpha = 0.38;
    const nx = (Math.sin(ts*0.12)*0.5+0.5)*-100;
    ctx.drawImage(bgNebula, nx, 0, W+200, H);
    ctx.globalAlpha = 1;
  }

  // Sprites
  const sprOrbs = new Image(); sprOrbs.src = "assets/sprites-orbs.png";

  // Scene system
  class Scene {
    enter(){}
    exit(){}
    update(dt){}
    draw(ts){}
    pointer(x,y){}
    touch(touches) { for(const t of touches){ this.pointer(t.clientX, t.clientY); } }
  }
  class SceneManager {
    constructor(){ this.current=null; }
    set(scene){ if(this.current) this.current.exit(); this.current=scene; if(scene && scene.enter) scene.enter(); }
    update(dt){ if(this.current && this.current.update) this.current.update(dt); stepTweens(dt); }
    draw(ts){ if(this.current && this.current.draw) this.current.draw(ts); drawParticles(ctx, ts); }
    pointer(x,y){ if(this.current && this.current.pointer) this.current.pointer(x,y); }
    touch(e){ if(this.current && this.current.touch) this.current.touch(e.changedTouches); }
  }
  const Scenes = new SceneManager();

  // HUD
  const HUD = {
    scoreEl: $("#scoreChip"), streakEl: $("#streakChip"), levelEl: $("#levelChip"),
    livesEl: $("#livesChip"), promptEl: $("#prompt"),
    setScore(v){ this.scoreEl.textContent=`Score: ${v}`; },
    setStreak(v){ this.streakEl.textContent=`Streak: ${v}`; },
    setLevel(v){ this.levelEl.textContent=`Level: ${v}`; },
    setLives(n){ this.livesEl.textContent="❤️".repeat(n); },
    setPrompt(t){ this.promptEl.textContent=t; }
  };

  // Input wiring
  canvas.addEventListener("pointerdown", e=>Scenes.pointer(e.clientX, e.clientY), {passive:true});
  canvas.addEventListener("touchstart", e=>Scenes.touch(e), {passive:true});

  // Export
  window.Engine = { canvas, ctx, get size(){return [W,H]}, resize, rand, choice, clamp, tween, Easings, burst, drawParallax, sprOrbs, Scenes, HUD, Save, beepGood, beepBad, fanfare };
})();