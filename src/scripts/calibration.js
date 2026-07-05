// RLFY-01 weapons calibration routine. Runs in a full-window overlay drawn
// with the site's own tokens; Esc or the corner EXIT button leaves, and the
// page underneath is never touched. Loaded on demand.

let active = false;

export function start() {
  if (active) return;
  active = true;

  const css = getComputedStyle(document.documentElement);
  const token = (n, fb) => css.getPropertyValue(n).trim() || fb;
  const BG = token("--bg", "#080b0f");
  const TEXT = token("--text", "#e2e8f0");
  const MUTED = token("--text-muted", "#8e9aaa");
  const DISABLED = token("--text-disabled", "#636c79");
  const ACCENT = token("--accent", "#8b7cff");
  const WARN = token("--warn", "#d9a13b");
  const OK = token("--ok-text", "#22a06b");
  const ERR = token("--error-text", "#e5484d");
  const MONO = token("--font-mono", "ui-monospace, monospace");

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Ordnance trainer");
  overlay.tabIndex = -1;
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:120;background:" + BG + ";outline:0;" +
    "touch-action:none;user-select:none;-webkit-user-select:none;" +
    "-webkit-tap-highlight-color:transparent";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  overlay.appendChild(canvas);

  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.setAttribute("aria-label", "Exit game");
  exitBtn.textContent = "EXIT ×";
  exitBtn.style.cssText =
    "position:absolute;top:16px;right:16px;padding:10px 14px;cursor:pointer;" +
    "background:transparent;border:1px solid " + DISABLED + ";border-radius:2px;" +
    "color:" + MUTED + ";font:500 12px/1 " + MONO + ";letter-spacing:.08em";
  exitBtn.onmouseenter = () => (exitBtn.style.color = TEXT);
  exitBtn.onmouseleave = () => (exitBtn.style.color = MUTED);
  overlay.appendChild(exitBtn);

  // touch pads: they hold down the same input flags the keyboard sets, so
  // handling, fire rate, and difficulty are identical to playing with keys
  let touch = matchMedia("(pointer: coarse)").matches;
  let overAt = 0;
  const pads = document.createElement("div");
  pads.setAttribute("aria-hidden", "true");
  pads.style.cssText =
    "position:absolute;left:0;right:0;bottom:0;display:none;" +
    "justify-content:space-between;align-items:flex-end;" +
    "padding:0 16px calc(16px + env(safe-area-inset-bottom,0px));pointer-events:none";
  const cluster = () => {
    const c = document.createElement("div");
    c.style.cssText = "display:flex;gap:12px;pointer-events:none";
    return c;
  };
  const mkPad = (label, keys, w) => {
    const b = document.createElement("div");
    b.textContent = label;
    b.style.cssText =
      "pointer-events:auto;display:flex;align-items:center;justify-content:center;" +
      "width:" + w + "px;height:64px;border:1px solid " + DISABLED + ";" +
      "border-radius:2px;color:" + MUTED + ";font:500 14px/1 " + MONO + ";" +
      "letter-spacing:.08em;touch-action:none;background:rgba(255,255,255,.03)";
    const release = () => {
      keys.forEach((k) => held.delete(k));
      b.style.borderColor = DISABLED;
      b.style.color = MUTED;
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      keys.forEach((k) => held.add(k));
      b.style.borderColor = ACCENT;
      b.style.color = TEXT;
      try {
        b.setPointerCapture(e.pointerId);
      } catch {}
    });
    b.addEventListener("pointerup", release);
    b.addEventListener("pointercancel", release);
    return b;
  };
  const rot = cluster();
  rot.append(mkPad("<", ["ArrowLeft"], 72), mkPad(">", ["ArrowRight"], 72));
  const act = cluster();
  act.append(mkPad("THR", ["ArrowUp"], 72), mkPad("FIRE", [" "], 88));
  pads.append(rot, act);
  overlay.appendChild(pads);
  const syncPads = () => {
    pads.style.display = touch && state === "play" ? "flex" : "none";
  };
  overlay.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && !touch) {
      touch = true;
      syncPads();
    }
    // tap the field to engage/retry (retry debounced so a shot fired at the
    // moment of death can't instantly restart the run)
    if (
      e.target === canvas &&
      (state === "ready" || (state === "over" && performance.now() - overAt > 600))
    ) {
      engage();
    }
  });

  const prevFocus = document.activeElement;
  const prevOverflow = document.documentElement.style.overflow;
  document.body.appendChild(overlay);
  document.documentElement.style.overflow = "hidden";
  overlay.focus();

  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  // the sim runs in a virtual space normalised against a desktop-sized field
  // and is scale-rendered to fit, so small screens get the same rock density
  // and dodge distances instead of a crammed, harder game
  let SCALE = 1;
  let VW = 0;
  let VH = 0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = overlay.clientWidth;
    H = overlay.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SCALE = Math.min(1, Math.max(0.55, Math.sqrt((W * H) / (1280 * 800))));
    VW = W / SCALE;
    VH = H / SCALE;
  };
  resize();

  // --- state -----------------------------------------------------------
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const wrap = (v, max, m) => (v < -m ? max + m : v > max + m ? -m : v);
  const pad = (n) => String(n).padStart(6, "0");
  const TIER_R = [46, 26, 14];
  const TIER_SPEED = [60, 100, 150];
  const TIER_SCORE = [20, 50, 100]; // classic scoring — smaller is worth more

  let state; // ready | play | over
  let score = 0;
  let hi = 0;
  try {
    hi = Number(localStorage.getItem("trn_hi")) || 0;
  } catch {}
  let lives = 3;
  let wave = 0;
  let combo = 0;
  let nextLife = 10000;
  let newHi = false;
  let rocks = [];
  let bullets = [];
  let ebullets = [];
  let sparks = [];
  let drone = null;
  let droneTimer = 0;
  let cooldown = 0;
  let thrusting = false;
  let shake = 0;
  let msg = null; // { text, color, t } — one transient center announcement
  const ship = { x: 0, y: 0, a: -TAU / 4, vx: 0, vy: 0, dead: false, respawn: 0, inv: 0 };

  const mult = () => 1 + Math.min(4, (combo / 3) | 0);
  const flash = (text, color) => (msg = { text, color, t: 1.6 });

  const setState = (s) => {
    state = s;
    overlay.dataset.state = s; // observable hook for tests, invisible to users
    if (s === "over") overAt = performance.now();
    syncPads();
  };

  function makeRock(tier, x, y) {
    const a = rand(0, TAU);
    // the field gets quicker as waves climb, capped so it stays playable
    const pace = 1 + Math.min(0.6, Math.max(0, wave - 1) * 0.07);
    const speed = TIER_SPEED[tier] * rand(0.7, 1.4) * pace;
    const n = 10 + ((Math.random() * 4) | 0);
    const verts = [];
    for (let i = 0; i < n; i++) verts.push(rand(0.72, 1.12));
    return {
      tier,
      x,
      y,
      r: TIER_R[tier],
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: rand(0, TAU),
      spin: rand(-0.8, 0.8),
      verts,
    };
  }

  function spawnWave() {
    wave++;
    flash("WAVE " + String(wave).padStart(2, "0"), MUTED);
    const count = Math.min(5 + wave, 12);
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, VW);
        y = rand(0, VH);
      } while (Math.hypot(x - ship.x, y - ship.y) < 220);
      rocks.push(makeRock(0, x, y));
    }
  }

  function spawnDrone() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    drone = {
      x: dir === 1 ? -30 : VW + 30,
      y: rand(VH * 0.15, VH * 0.85),
      dir,
      speed: 110 + wave * 8,
      phase: rand(0, TAU),
      fireT: 1.2,
    };
    flash("HOSTILE CONTACT", ERR);
  }

  function resetShip() {
    ship.x = VW / 2;
    ship.y = VH / 2;
    ship.vx = ship.vy = 0;
    ship.a = -TAU / 4;
    ship.dead = false;
    ship.inv = 2.2;
  }

  function engage() {
    score = 0;
    lives = 3;
    wave = 0;
    combo = 0;
    nextLife = 10000;
    newHi = false;
    rocks = [];
    bullets = [];
    ebullets = [];
    sparks = [];
    drone = null;
    droneTimer = rand(6, 10);
    msg = null;
    resetShip();
    spawnWave();
    setState("play");
  }

  function burst(x, y, n, speed, life, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.3, speed);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: life * rand(0.6, 1), color });
    }
  }

  function addScore(base) {
    score += base * mult();
    combo++;
    if (score >= nextLife) {
      nextLife += 10000;
      if (lives < 6) {
        lives++;
        flash("EXTRA UNIT", OK);
      }
    }
  }

  function killShip() {
    burst(ship.x, ship.y, 16, 180, 0.9, TEXT);
    shake = 0.4;
    combo = 0;
    lives--;
    if (lives <= 0) {
      if (score > hi) {
        hi = score;
        newHi = true;
        try {
          localStorage.setItem("trn_hi", String(hi));
        } catch {}
      }
      drone = null;
      ebullets = [];
      setState("over");
    } else {
      ship.dead = true;
      ship.respawn = 1.2;
    }
  }

  // attract-mode debris behind the title and game-over screens
  setState("ready");
  for (let i = 0; i < 6; i++) {
    rocks.push(makeRock((Math.random() * 3) | 0, rand(0, VW), rand(0, VH)));
  }

  // --- input -----------------------------------------------------------
  const held = new Set();
  const has = (...keys) => keys.some((k) => held.has(k));
  const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "];

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      exit();
      return;
    }
    if (GAME_KEYS.includes(e.key)) e.preventDefault();
    held.add(e.key);
    // Enter on the EXIT button stays a click; anywhere else it (re)engages
    if (e.key === "Enter" && e.target !== exitBtn && state !== "play") engage();
  }
  function onKeyUp(e) {
    held.delete(e.key);
  }

  function exit() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", onKeyDown, true);
    removeEventListener("keyup", onKeyUp, true);
    removeEventListener("resize", resize);
    overlay.remove();
    document.documentElement.style.overflow = prevOverflow;
    if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus();
  }

  addEventListener("keydown", onKeyDown, true);
  addEventListener("keyup", onKeyUp, true);
  addEventListener("resize", resize);
  exitBtn.addEventListener("click", exit);

  // --- update ----------------------------------------------------------
  function update(dt) {
    if (msg && (msg.t -= dt) <= 0) msg = null;
    if (shake > 0) shake -= dt;
    cooldown -= dt;

    sparks = sparks.filter((p) => (p.t -= dt) > 0);
    for (const p of sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const r of rocks) {
      r.x = wrap(r.x + r.vx * dt, VW, r.r);
      r.y = wrap(r.y + r.vy * dt, VH, r.r);
      r.rot += r.spin * dt;
    }
    // a shot that dies empty resets the chain
    bullets = bullets.filter((b) => {
      if ((b.t -= dt) > 0) return true;
      if (!b.hit && state === "play") combo = 0;
      return false;
    });
    for (const b of bullets) {
      b.x = wrap(b.x + b.vx * dt, VW, 2);
      b.y = wrap(b.y + b.vy * dt, VH, 2);
    }
    ebullets = ebullets.filter((b) => (b.t -= dt) > 0);
    for (const b of ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    if (state !== "play") return;

    if (!ship.dead) {
      const turn =
        (has("ArrowRight", "d", "D") ? 1 : 0) - (has("ArrowLeft", "a", "A") ? 1 : 0);
      ship.a += turn * 4.2 * dt;
      thrusting = has("ArrowUp", "w", "W");
      if (thrusting) {
        ship.vx += Math.cos(ship.a) * 260 * dt;
        ship.vy += Math.sin(ship.a) * 260 * dt;
      }
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > 420) {
        ship.vx *= 420 / sp;
        ship.vy *= 420 / sp;
      }
      const drag = Math.pow(0.4, dt);
      ship.vx *= drag;
      ship.vy *= drag;
      ship.x = wrap(ship.x + ship.vx * dt, VW, 14);
      ship.y = wrap(ship.y + ship.vy * dt, VH, 14);
      if (ship.inv > 0) ship.inv -= dt;

      if (has(" ") && cooldown <= 0 && bullets.length < 5) {
        cooldown = 0.18;
        bullets.push({
          x: ship.x + Math.cos(ship.a) * 14,
          y: ship.y + Math.sin(ship.a) * 14,
          vx: ship.vx + Math.cos(ship.a) * 520,
          vy: ship.vy + Math.sin(ship.a) * 520,
          t: 1.0,
          hit: false,
        });
      }
    } else {
      thrusting = false;
      ship.respawn -= dt;
      if (ship.respawn <= 0) resetShip();
    }

    // hostile drone: sweeps across, weaves, returns fire
    if (drone) {
      drone.phase += dt * 2;
      drone.x += drone.dir * drone.speed * dt;
      drone.y += Math.sin(drone.phase) * 60 * dt;
      drone.fireT -= dt;
      if (drone.fireT <= 0 && !ship.dead) {
        drone.fireT = Math.max(0.9, 1.6 - wave * 0.05);
        const a = Math.atan2(ship.y - drone.y, ship.x - drone.x) + rand(-0.3, 0.3);
        const s = 240 + wave * 10;
        ebullets.push({
          x: drone.x,
          y: drone.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          t: 2.4,
        });
      }
      if (drone.x < -40 || drone.x > VW + 40) {
        drone = null;
        droneTimer = rand(10, 16);
      }
    } else {
      droneTimer -= dt;
      if (droneTimer <= 0) spawnDrone();
    }

    for (const b of bullets) {
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
          b.t = 0;
          b.hit = true;
          rocks.splice(i, 1);
          addScore(TIER_SCORE[r.tier]);
          burst(r.x, r.y, 8, 120, 0.5, MUTED);
          if (r.tier < 2) {
            rocks.push(makeRock(r.tier + 1, r.x, r.y), makeRock(r.tier + 1, r.x, r.y));
          }
          break;
        }
      }
      if (drone && b.t > 0 && Math.hypot(b.x - drone.x, b.y - drone.y) < 16) {
        b.t = 0;
        b.hit = true;
        addScore(200);
        burst(drone.x, drone.y, 14, 160, 0.7, ERR);
        shake = Math.max(shake, 0.15);
        drone = null;
        droneTimer = rand(12, 18);
      }
    }
    bullets = bullets.filter((b) => b.t > 0);

    if (!ship.dead && ship.inv <= 0) {
      for (const r of rocks) {
        if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 10) {
          killShip();
          break;
        }
      }
      if (state === "play" && !ship.dead && drone &&
          Math.hypot(ship.x - drone.x, ship.y - drone.y) < 24) {
        killShip();
      }
      if (state === "play" && !ship.dead) {
        for (const b of ebullets) {
          if (Math.hypot(ship.x - b.x, ship.y - b.y) < 11) {
            b.t = 0;
            killShip();
            break;
          }
        }
      }
    }

    if (state === "play" && !rocks.length) spawnWave();
  }

  // --- render ----------------------------------------------------------
  function drawShip(x, y, a, scale, ghost) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(scale, scale);
    ctx.globalAlpha = ghost ? 0.35 : 1;
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = TEXT;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.stroke();
    if (thrusting && scale === 1 && Math.random() > 0.3) {
      ctx.strokeStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.lineTo(-16, 0);
      ctx.lineTo(-8, -4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDrone(d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.strokeStyle = ERR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(6, -6);
    ctx.lineTo(14, 0);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.save();
    if (shake > 0) {
      const m = shake * 18;
      ctx.translate(rand(-m, m), rand(-m, m));
    }
    ctx.fillStyle = BG;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.scale(SCALE, SCALE); // world is simulated in virtual coords

    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 1.5;
    for (const r of rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.beginPath();
      const n = r.verts.length;
      for (let i = 0; i < n; i++) {
        const rad = r.r * r.verts[i];
        const a = (i / n) * TAU;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (drone) drawDrone(drone);

    ctx.fillStyle = TEXT;
    for (const b of bullets) ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    ctx.fillStyle = ERR;
    for (const b of ebullets) ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    for (const p of sparks) {
      ctx.globalAlpha = Math.min(1, p.t * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    if (state === "play" && !ship.dead) {
      const ghost = ship.inv > 0 && Math.floor(performance.now() / 120) % 2 === 0;
      drawShip(ship.x, ship.y, ship.a, 1, ghost);
    }
    ctx.restore();

    // HUD — drawn after restore so it never shakes
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "500 13px " + MONO;
    ctx.fillStyle = MUTED;
    ctx.fillText("SCORE", 20, 20);
    ctx.fillText("HI", 20, 40);
    ctx.fillStyle = TEXT;
    ctx.fillText(pad(score), 76, 20);
    if (state === "play" && mult() > 1) {
      ctx.fillStyle = ACCENT;
      ctx.fillText("×" + mult(), 140, 20);
    }
    ctx.fillStyle = MUTED;
    ctx.fillText(pad(Math.max(hi, score)), 76, 40);
    if (state === "play") {
      for (let i = 0; i < lives; i++) drawShip(28 + i * 22, 76, -TAU / 4, 0.65, false);
    }

    ctx.textAlign = "center";
    if (state === "play" && msg) {
      ctx.globalAlpha = Math.min(1, msg.t);
      ctx.fillStyle = msg.color;
      ctx.fillText(msg.text, W / 2, H * 0.3);
      ctx.globalAlpha = 1;
    }
    if (state === "ready") {
      const y = H * 0.3;
      ctx.fillStyle = TEXT;
      ctx.font = "700 26px " + MONO;
      ctx.fillText("ORDNANCE TRAINER", W / 2, y);
      ctx.font = "500 13px " + MONO;
      ctx.fillStyle = WARN;
      ctx.fillText("WEAPONS SYS ............. [FREE]", W / 2, y + 44);
      ctx.fillStyle = MUTED;
      ctx.fillText(
        touch
          ? "< > ROTATE — THR THRUST — FIRE"
          : "LEFT / RIGHT ROTATE — UP THRUST — SPACE FIRE",
        W / 2,
        y + 84,
      );
      ctx.fillText("CHAIN HITS TO MULTIPLY — HOSTILES RETURN FIRE", W / 2, y + 108);
      ctx.fillStyle = TEXT;
      ctx.fillText(touch ? "TAP TO ENGAGE" : "PRESS ENTER TO ENGAGE", W / 2, y + 144);
      ctx.fillStyle = DISABLED;
      ctx.fillText(touch ? "EXIT WITH ×" : "ESC TO EXIT", W / 2, y + 172);
    }
    if (state === "over") {
      const y = H * 0.36;
      ctx.fillStyle = TEXT;
      ctx.font = "700 26px " + MONO;
      ctx.fillText("SIGNAL LOST", W / 2, y);
      ctx.font = "500 13px " + MONO;
      ctx.fillStyle = MUTED;
      ctx.fillText("FINAL SCORE " + pad(score), W / 2, y + 44);
      if (newHi) {
        ctx.fillStyle = WARN;
        ctx.fillText("NEW HIGH SCORE", W / 2, y + 68);
      }
      ctx.fillStyle = TEXT;
      ctx.fillText(
        touch ? "TAP TO RETRY — EXIT WITH ×" : "ENTER TO RETRY — ESC TO EXIT",
        W / 2,
        y + 104,
      );
    }
  }

  let last = performance.now();
  let raf = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}
