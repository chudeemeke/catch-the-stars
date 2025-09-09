// game.js — v1.1.1 robust gameplay (levels + rewards + polish)
(() => {
  const { canvas, ctx, size, rand, choice, clamp, tween, Easings, burst, drawParallax, sprOrbs, Scenes, HUD, Save, beepGood, beepBad, fanfare } = window.Engine;

  // Global switches (persisted)
  window.SFX_ON = Save.get("SFX_ON", true);
  window.MUSIC_ON = Save.get("MUSIC_ON", false);

  // Modes and state
  const Modes = Save.get("MODES", { numbers:true, letters:true, colors:true, addsub:true, shapes:false });
  const State = Save.get("STATE", {
    score:0, streak:0, level:1, lives:3,
    roundTime:30, targetsPerRound:3, difficulty:"normal",
    bestStars:0
  });
  let roundTimer=0, roundActive=false, prompt=null, correctTag=null, orbs=[];

  const COLORS = ["red","teal","lime","purple"];
  const COLOR_IDX = { red:0, teal:1, lime:2, purple:3 };

  // Prompt generator
  function genPrompt(){
    const enabled=[];
    if(Modes.numbers) enabled.push("numbers");
    if(Modes.letters) enabled.push("letters");
    if(Modes.colors) enabled.push("colors");
    if(Modes.addsub)  enabled.push("addsub");
    if(Modes.shapes)  enabled.push("shapes");
    const type = choice(enabled.length?enabled:["numbers"]);
    let text, tag, style={};
    switch(type){
      case "numbers": {
        const n = Math.floor(rand(0,21));
        text=`Find the number: ${n}`; tag=`num:${n}`; break;
      }
      case "letters": {
        const ch = String.fromCharCode(Math.floor(rand(65,91)));
        text=`Find the letter: ${ch}`; tag=`let:${ch}`; break;
      }
      case "colors": {
        const c = choice(COLORS);
        text=`Find the color: ${c}`; tag=`col:${c}`; style.color=c; break;
      }
      case "addsub": {
        const a=Math.floor(rand(0,11)), b=Math.floor(rand(0,11));
        const sign = Math.random()<0.5?"+":"-"; const res = sign==="+"?a+b:a-b;
        if(res<0 || res>10) return genPrompt();
        text=`Solve: ${a} ${sign} ${b}`; tag=`num:${res}`; break;
      }
      case "shapes": {
        const s = choice(["●","▲","■"]);
        text=`Find the shape: ${s}`; tag=`shp:${s}`; style.shape=s; break;
      }
    }
    return {type,text,tag,style};
  }

  class Orb {
    constructor(x,y,opts){
      const [W,H] = size;
      this.x = x ?? rand(60, W-60);
      this.y = y ?? rand(120, H-120);
      this.r = rand(34, 52);
      const base = {easy:1.1, normal:1.6, hard:2.2}[State.difficulty] + (State.level-1)*0.15;
      this.vx = rand(-base, base);
      this.vy = rand(-base, base);
      this.life = rand(10,14);
      this.label = opts?.label ?? "";
      this.tag = opts?.tag ?? "";
      this.correct = !!opts?.correct;
      this.style = opts?.style || {};
      this.spriteIndex = this.style.color ? COLOR_IDX[this.style.color]||0 : 0;
      this.bump = 1; this.alpha=1; this.wobble = rand(0, Math.PI*2);
    }
    step(dt){
      const [W,H] = size;
      this.x += this.vx*60*dt; this.y += this.vy*60*dt;
      if(this.x < this.r || this.x > W-this.r) this.vx*=-1;
      if(this.y < this.r || this.y > H-this.r) this.vy*=-1;
      this.life -= dt;
      this.wobble += dt*3;
    }
    draw(ctx){
      const r = this.r * (1 + Math.sin(this.wobble)*0.03);
      const sx = this.spriteIndex*256;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.scale(this.bump, this.bump);
      ctx.drawImage(sprOrbs, sx, 0, 256, 256, -r, -r, r*2, r*2);

      if(this.correct){
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.arc(0, 0, r+6*Math.sin(performance.now()/333 + this.x*0.01), 0, Math.PI*2);
        ctx.stroke();
      }

      const text = this.style.shape || this.label;
      if(text){
        ctx.strokeStyle="rgba(0,0,0,.35)"; ctx.lineWidth=3;
        ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.font = `${Math.floor(r*0.9)}px/1.1 ui-rounded, system-ui, sans-serif`;
        ctx.strokeText(text,0,0); ctx.fillText(text,0,0);
      }
      ctx.restore();
    }
    pop(){
      burst(this.x, this.y, 42);
      this.bump = 0.8;
      tween(this, { bump:1.0 }, 160, Easings.backOut);
    }
  }

  // Level lifecycle
  function spawnLevel(){
    orbs.length = 0;
    prompt = genPrompt(); correctTag = prompt.tag;
    HUD.setPrompt(prompt.text);
    roundActive = true;
    roundTimer = State.roundTime;
    const slots = Math.max(6, 4 + State.level);
    const indices = Array.from({length:slots}, (_,i)=>i);
    const correctSlots = [];
    while(correctSlots.length < State.targetsPerRound && indices.length){
      const pick = indices.splice(Math.floor(Math.random()*indices.length),1)[0];
      correctSlots.push(pick);
    }
    for(let i=0;i<slots;i++){
      let label="", tag=""; let style = { ...prompt.style };
      switch(prompt.type){
        case "numbers": {
          const val = correctSlots.includes(i) ? parseInt(prompt.tag.split(":")[1]) : Math.floor(rand(0,21));
          label = String(val); tag = `num:${val}`; break;
        }
        case "letters": {
          const alph="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const val = correctSlots.includes(i) ? prompt.tag.split(":")[1] : alph[Math.floor(rand(0,26))];
          label = val; tag = `let:${val}`; break;
        }
        case "colors": {
          const val = correctSlots.includes(i) ? prompt.tag.split(":")[1] : choice(COLORS);
          tag = `col:${val}`; style = { color: val }; break;
        }
        case "addsub": {
          const val = correctSlots.includes(i) ? parseInt(prompt.tag.split(":")[1]) : Math.floor(rand(0,11));
          label = String(val); tag = `num:${val}`; break;
        }
        case "shapes": {
          const shapes=["●","▲","■"];
          const val = correctSlots.includes(i) ? prompt.tag.split(":")[1] : choice(shapes);
          tag = `shp:${val}`; style = { shape: val }; break;
        }
      }
      const orb = new Orb(undefined, undefined, { label, tag, correct: (tag===prompt.tag), style });
      orbs.push(orb);
    }
  }

  // Metrics for rating
  let taps=0, corr=0, wrong=0;
  function resetMetrics(){ taps=0; corr=0; wrong=0; }

  function endLevel(win){
    roundActive = false; orbs.length = 0;
    let stars=0, acc=0, timePct=0;
    if(win){
      acc = corr / Math.max(1,taps);
      timePct = clamp(roundTimer / State.roundTime, 0, 1);
      stars = 1; if(acc>=0.75) stars=2; if(acc>=0.9 && timePct>=0.3) stars=3;
      State.bestStars = Math.max(State.bestStars, stars);
      State.score += 10 + 4*stars + 2*State.streak;
      State.streak++;
      fanfare();
    } else {
      State.lives--; State.streak=0; beepBad();
    }
    HUD.setScore(State.score); HUD.setStreak(State.streak); HUD.setLevel(State.level); HUD.setLives(State.lives);
    Save.set("STATE", State);

    // Show simple end overlay using pause overlay title
    const ov = document.getElementById("pauseOverlay");
    const title = document.getElementById("pauseTitle");
    ov.classList.add("show");
    if(!win && State.lives<=0){ title.textContent = "Game Over 💥"; }
    else if(win){ title.textContent = `Level ${State.level} Complete!  ${"★".repeat(stars)}${"☆".repeat(3-stars)}`; }
    else { title.textContent = "Missed it — try again!"; }
    State.level += win ? 1 : 0;
  }

  // Input
  function onTap(x,y){
    if(!roundActive) return;
    let hitCorrect=0, hitWrong=0;
    for(let i=orbs.length-1;i>=0;i--){
      const s = orbs[i];
      const d = Math.hypot(s.x-x, s.y-y);
      if(d < s.r){
        taps++;
        if(s.correct){
          corr++; hitCorrect++;
          s.pop(); orbs.splice(i,1);
          State.score += 3; beepGood();
        } else {
          wrong++; hitWrong++;
          State.score = Math.max(0, State.score-1); beepBad();
        }
      }
    }
    HUD.setScore(State.score);
    const anyCorrectLeft = orbs.some(o=>o.correct);
    if(hitCorrect>0 && !anyCorrectLeft) endLevel(true);
    if(hitWrong>0 && hitCorrect===0){
      State.lives = Math.max(0, State.lives-1);
      HUD.setLives(State.lives);
      if(State.lives<=0) endLevel(false);
    }
  }

  // Scenes
  class PlayScene {
    enter(){ resetMetrics(); spawnLevel(); }
    update(dt){
      if(!roundActive) return;
      for(const s of orbs) s.step(dt);
      orbs = orbs.filter(s=>s.life>0);
      roundTimer -= dt;
      if(roundTimer <= 0) endLevel(false);
    }
    draw(ts){
      drawParallax(ts);
      for(const s of orbs) s.draw(ctx);
      // timer ring
      const [W,H] = size;
      const pct = clamp(roundTimer/State.roundTime,0,1);
      const cx=W-42, cy=42, r=26;
      ctx.beginPath(); ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=6; ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.strokeStyle="rgba(255,255,255,.9)"; ctx.lineWidth=6; ctx.arc(cx,cy,r,-Math.PI/2, -Math.PI/2 + Math.PI*2*pct); ctx.stroke();
    }
    pointer(x,y){ onTap(x,y); }
    touch(ts){ for(const t of ts){ onTap(t.clientX, t.clientY); } }
  }
  const play = new PlayScene();

  // Overlay buttons
  const btnPause = document.getElementById("btnPause");
  const btnResume = document.getElementById("btnResume");
  const btnRestart = document.getElementById("btnRestart");
  const btnSettings = document.getElementById("btnSettings");
  const btnApply = document.getElementById("btnApply");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const settingsOverlay = document.getElementById("settingsOverlay");

  function showPause(title="Paused"){ document.getElementById("pauseTitle").textContent=title; pauseOverlay.classList.add("show"); }
  function hidePause(){ pauseOverlay.classList.remove("show"); }

  btnPause.addEventListener("click", ()=> showPause("Paused"));
  btnResume.addEventListener("click", ()=> { hidePause(); });
  btnRestart.addEventListener("click", ()=>{
    State.score=0; State.streak=0; State.level=1; State.lives=3;
    Save.set("STATE", State);
    hidePause(); Scenes.set(play); // fresh level
  });
  btnSettings.addEventListener("click", ()=>{
    document.getElementById("modeNumbers").checked = !!Modes.numbers;
    document.getElementById("modeLetters").checked = !!Modes.letters;
    document.getElementById("modeColors").checked  = !!Modes.colors;
    document.getElementById("modeAddSub").checked  = !!Modes.addsub;
    document.getElementById("modeShapes").checked  = !!Modes.shapes;
    document.getElementById("soundOn").checked = window.SFX_ON;
    document.getElementById("musicOn").checked = window.MUSIC_ON;
    document.getElementById("targetsPerRound").value = String(State.targetsPerRound);
    document.getElementById("roundSeconds").value = String(State.roundTime);
    document.getElementById("difficulty").value = State.difficulty;
    settingsOverlay.classList.add("show");
  });
  btnApply.addEventListener("click", ()=>{
    Modes.numbers = document.getElementById("modeNumbers").checked;
    Modes.letters = document.getElementById("modeLetters").checked;
    Modes.colors  = document.getElementById("modeColors").checked;
    Modes.addsub  = document.getElementById("modeAddSub").checked;
    Modes.shapes  = document.getElementById("modeShapes").checked;
    window.SFX_ON = document.getElementById("soundOn").checked;
    window.MUSIC_ON = document.getElementById("musicOn").checked;
    State.targetsPerRound = parseInt(document.getElementById("targetsPerRound").value,10);
    State.roundTime = parseInt(document.getElementById("roundSeconds").value,10);
    State.difficulty = document.getElementById("difficulty").value;
    Save.set("MODES", Modes);
    Save.set("SFX_ON", window.SFX_ON);
    Save.set("MUSIC_ON", window.MUSIC_ON);
    Save.set("STATE", State);
    settingsOverlay.classList.remove("show");
  });

  // Main loop
  let last=0;
  function loop(ts){
    if(!last) last=ts;
    const dt = clamp((ts-last)/1000, 0, 0.05);
    last=ts;
    Scenes.update(dt);
    Scenes.draw(ts/1000);
    requestAnimationFrame(loop);
  }

  // Boot
  HUD.setScore(State.score); HUD.setStreak(State.streak);
  HUD.setLevel(State.level); HUD.setLives(State.lives);
  Scenes.set(play);
  requestAnimationFrame(loop);
})();