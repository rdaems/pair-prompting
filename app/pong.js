// Ping-pong, for real: a live game for two people at their screens, or practice against
// the ball machine. The server keeps the score and relays what happens between the two
// pages (serves, hits, misses, paddles); each page judges its own paddle, so nobody plays
// against the lag. Whoever hits the ball works out where it goes and sends the numbers,
// so both pages draw the same ball (nothing is recomputed on the other side).
//
// pongTable(el, room) with room = { api(path), post(body), people(), me(), small(p) }
// returns { update(view), open(), invited() }; view is the room state's `pong`.
const pongIcon = (() => {
  let url = null;
  return () => {
    if (url) return url;
    const C = pixelAvatar.C, c = document.createElement("canvas"); c.width = c.height = 18;
    const g = c.getContext("2d");
    const blade = [[5, 2, 6], [3, 3, 10], [2, 4, 12], [2, 5, 12], [2, 6, 12], [2, 7, 12], [2, 8, 12], [3, 9, 10], [5, 10, 6]];
    g.fillStyle = C.ink;
    for (const [x, y, w] of blade) g.fillRect(x - 1, y - 1, w + 2, 3);
    g.fillRect(9, 10, 4, 7);
    for (const [x, y, w] of blade) { g.fillStyle = C.red1; g.fillRect(x, y, w, 1); }
    g.fillStyle = "#ff7a5c"; g.fillRect(4, 4, 3, 1); g.fillRect(3, 5, 2, 1);
    g.fillStyle = "#b07a4a"; g.fillRect(10, 11, 2, 5);
    url = c.toDataURL();
    return url;
  };
})();

function pongTable(el, room) {
  const C = pixelAvatar.C;
  const FW = 200, FH = 120, FACE = 10, HALF = 12, R = 2, TO = 11, M = 8;  // field units: paddle faces at x 10 and 190
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  el.innerHTML = `<div class="pg-card"><div class="pg-head"><span class="pg-pl" data-side="0"></span><b class="pg-score"></b>` +
    `<span class="pg-pl r" data-side="1"></span><button class="x pg-close" title="close" aria-label="close"><i class="ico">&#xF0156;</i></button></div>` +
    `<canvas width="${FW + 2 * M}" height="${FH + 2 * M}"></canvas><div class="pg-msg"></div>` +
    `<div class="pg-hint">move with the mouse, a finger, or ↑ ↓ · to 11, two clear</div></div>`;
  const cv = el.querySelector("canvas"), ctx = cv.getContext("2d"), msg = el.querySelector(".pg-msg");
  const head = el.querySelectorAll(".pg-pl"), scoreEl = el.querySelector(".pg-score");

  let view = null, mode = null;              // mode: null = choosing, "live", "machine"
  let es = null, off = null, gameId = null, side = 0, players = [null, null];
  let ball = null, judged = false, missAt = 0, score = [0, 0], serveBy = null, serveAt = 0, over = null, dismissed = 0;
  let myY = FH / 2, oppY = FH / 2, oppTo = FH / 2, keys = {}, padAt = 0, sentY = -1, mach = null, auto = null, hits = 0;
  const local = () => performance.now() / 1000;
  const now = () => local() + (mode === "live" ? off || 0 : 0);        // the server's clock while live
  const me = () => room.me();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fold = (y) => {                      // the ball bounces off the long sides
    const lo = R, span = FH - 2 * R;
    let u = (y - lo) % (2 * span);
    if (u < 0) u += 2 * span;
    return lo + (u <= span ? u : 2 * span - u);
  };
  const faceX = (s) => (s === 0 ? FACE : FW - FACE);
  const contact = (b, s) => b.t0 + (faceX(s) - b.x0) / b.vx;   // when the ball reaches side s's paddle
  const yAt = (b, t) => fold(b.y0 + b.vy * (t - b.t0));
  const send = (ev) => room.post({ ev }).catch(() => {});
  const isOpen = () => !el.hidden;

  // ---- the game itself, the same for both modes
  function serve(s, y) {
    const a = (Math.random() - 0.5) * 0.6, S = 115, dir = s === 0 ? 1 : -1;
    ball = { t0: now(), x0: faceX(s), y0: y, vx: dir * S * Math.cos(a), vy: S * Math.sin(a) };
    judged = false; serveBy = null;
    if (mode === "live") send({ k: "serve", t: ball.t0, x: ball.x0, y: ball.y0, vx: ball.vx, vy: ball.vy, pad: y, r: score[0] + score[1] });
  }
  function hit(s, yb, tc, pad) {             // side s's paddle meets the ball at yb: harder, and angled by where it hit
    const S = Math.min(300, Math.hypot(ball.vx, ball.vy) * 1.06), o = clamp((yb - pad) / (HALF + R), -1, 1), a = o * 0.9;
    ball = { t0: tc, x0: faceX(s), y0: yb, vx: (s === 0 ? 1 : -1) * S * Math.cos(a), vy: S * Math.sin(a) };
    judged = false; hits++;
    if (mode === "live") send({ k: "hit", t: tc, x: ball.x0, y: yb, vx: ball.vx, vy: ball.vy, pad, r: score[0] + score[1] });
  }
  const serverOf = (sc) => { const n = sc[0] + sc[1]; return Math.min(...sc) >= TO - 1 ? n % 2 : Math.floor(n / 2) % 2; };
  function point(winner) {                   // the ball machine's game keeps its own score
    score[winner]++;
    ball = null;
    if (Math.max(...score) >= TO && Math.abs(score[0] - score[1]) >= 2) { over = { why: "points", winner }; draw(); return; }
    serveBy = serverOf(score); serveAt = local() + 1;
    draw();
  }
  function step(dt) {
    if (keys.up) myY -= 170 * dt;
    if (keys.down) myY += 170 * dt;
    if (auto !== null && ball && (ball.vx < 0 ? 0 : 1) === side) myY = yAt(ball, contact(ball, side)) + auto;   // the test rig plays
    myY = clamp(myY, HALF, FH - HALF);
    const t = now();
    if (mode === "live") {
      oppY += (oppTo - oppY) * Math.min(1, dt * 14);
      if (local() - padAt > 0.07 && Math.abs(myY - sentY) > 0.5 && !over) { padAt = local(); sentY = myY; send({ k: "pad", y: myY }); }
    } else if (mode === "machine" && !over) machine(dt, t);
    if (over || !mode) return;
    if (!ball && serveBy !== null && local() >= serveAt) {
      if (serveBy === side) serve(side, myY);
      else if (mode === "machine") serve(1 - side, mach.y);
    }
    if (ball && !judged) {
      const s = ball.vx < 0 ? 0 : 1;          // the side the ball is heading for
      const mine = s === side, theirs = mode === "machine" && s !== side;
      if (mine || theirs) {
        const tc = contact(ball, s);
        if (t >= tc) {
          const yb = yAt(ball, tc), pad = mine ? myY : mach.y;
          if (Math.abs(yb - pad) <= HALF + R) hit(s, yb, tc, pad);
          else { judged = true; missAt = local() + 0.3; ball.missed = s; }
        }
      }
    }
    if (judged && missAt && local() >= missAt) {
      missAt = 0;
      const s = ball ? ball.missed : side;
      if (mode === "live") send({ k: "miss", r: score[0] + score[1] });
      else point(1 - s);
    }
  }
  function machine(dt, t) {                  // the ball machine follows the ball, a little late and a little off
    let target = FH / 2 + (myY - FH / 2) * 0.25;
    if (ball && ball.vx > 0 && !judged) {
      if (mach.ball !== ball) { mach.ball = ball; mach.err = (Math.random() - 0.5) * (14 + Math.hypot(ball.vx, ball.vy) / 9); }
      target = yAt(ball, contact(ball, 1)) + mach.err;
    }
    mach.y = clamp(mach.y + clamp(target - mach.y, -115 * dt, 115 * dt), HALF, FH - HALF);
  }

  // ---- live: the stream from the server
  function connect() {
    if (es) return;
    es = new EventSource(room.api("pong/stream"));
    es.onmessage = (e) => { try { on(JSON.parse(e.data)); } catch (x) {} };
  }
  function disconnect() { if (es) { es.close(); es = null; } }
  function on(ev) {
    if (ev.ts !== undefined) off = off === null ? ev.ts - local() : Math.max(off, ev.ts - local());
    if (ev.game !== undefined && gameId !== null && ev.game !== gameId) return;
    switch (ev.k) {
      case "start":
        mode = "live"; score = ev.score.slice(); ball = null; over = null;
        serveBy = ev.serve === players[0].id ? 0 : 1; serveAt = local() + 1.2;
        break;
      case "pad": if (ev.from !== me()) oppTo = ev.y; break;
      case "serve": case "hit":
        if (now() - ev.ts > 1.5) break;      // an old one, replayed after a reload: that ball is long gone
        if (ev.from !== me()) { ball = { t0: ev.t, x0: ev.x, y0: ev.y, vx: ev.vx, vy: ev.vy }; judged = false; oppY = oppTo = ev.pad; }
        break;
      case "score":
        score = ev.score.slice(); ball = null; judged = false; missAt = 0;
        serveBy = ev.serve === players[0].id ? 0 : 1; serveAt = local() + 1;
        break;
      case "over":
        score = ev.score.slice(); ball = null;
        over = { why: ev.why, winner: ev.winner === null ? null : ev.winner === players[0].id ? 0 : 1 };
        disconnect();
        break;
    }
    draw();
  }

  // ---- what the card says: who plays, the score, and the choices around a game
  function draw() {
    const pl = (p, s) => p ? `${p.img}<b style="color:${p.color}">${esc(p.name)}</b>${!over && mode && serveBy === s && !ball ? " <small>serves</small>" : ""}` : "";
    head[0].innerHTML = pl(players[0], 0); head[1].innerHTML = pl(players[1], 1);
    scoreEl.textContent = mode ? `${score[0]} – ${score[1]}` : "";
    cv.hidden = !mode;
    el.querySelector(".pg-hint").hidden = !mode || !!over;
    const v = view, mine = v && [v.left.id, v.right.id].includes(me());
    let h = "";
    if (over) {
      const name = (s) => (players[s].id === me() ? "You" : players[s].name);
      h = over.why === "points" ? `<p>${name(over.winner)} ${players[over.winner].id === me() ? "win" : "wins"}, ${Math.max(...score)}–${Math.min(...score)}.</p>`
        : over.why === "left" ? `<p>${esc(players[1 - over.winner].name)} left the table.</p>`
        : over.why === "declined" ? `<p>${esc(players[1 - side].name)} can't play right now.</p>` : `<p>The invitation was taken back.</p>`;
      h += `<div class="pg-acts"><button class="btn save" data-again>play again</button><button class="btn" data-choose>someone else</button></div>`;
    } else if (mode) {
      h = "";
    } else if (v && v.state === "invited" && v.right.id === me()) {
      h = `<p><b style="color:${v.left.color}">${esc(v.left.name)}</b> invites you to a game of ping-pong.</p>` +
        `<div class="pg-acts"><button class="btn save" data-yes>play</button><button class="btn" data-no>not now</button></div>`;
    } else if (v && v.state === "invited" && v.left.id === me()) {
      h = `<p>Waiting for <b style="color:${v.right.color}">${esc(v.right.name)}</b> to say yes…</p><div class="pg-acts"><button class="btn" data-cancel>never mind</button></div>`;
    } else {
      const busy = v && v.state === "playing" && !mine;
      const here = room.people().filter((p) => p.id !== me() && p.kind === "human" && p.present);
      h = `<h2>Ping-pong</h2>` + (busy ? `<p>${esc(v.left.name)} and ${esc(v.right.name)} are playing right now.</p>` :
        `<p>Ping-pong is live, so it needs someone at a screen right now.</p>` +
        (here.length ? `<div class="pg-who">${here.map((p) => `<button class="who-chip" style="--c:${p.color}" data-invite="${p.id}">${room.small(p)}${esc(p.name)}</button>`).join("")}</div>`
          : `<p class="pg-none">Nobody else is at a screen in this room just now.</p>`)) +
        `<div class="pg-acts"><button class="btn" data-machine>practise against the ball machine</button></div>`;
    }
    msg.innerHTML = h;
  }
  function paint() {
    const t = now();
    ctx.fillStyle = "#130f1b"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#19141f"; for (let y = 3; y < cv.height; y += 6) ctx.fillRect(0, y, cv.width, 1);
    // the table from above: green top, white edges and centre line, the net across
    ctx.fillStyle = C.ink; ctx.fillRect(M - 2, M - 2, FW + 4, FH + 4);
    ctx.fillStyle = C.scrub1; ctx.fillRect(M, M, FW, FH);
    ctx.fillStyle = C.steel4;
    ctx.fillRect(M, M, FW, 1); ctx.fillRect(M, M + FH - 1, FW, 1); ctx.fillRect(M, M, 1, FH); ctx.fillRect(M + FW - 1, M, 1, FH);
    ctx.fillStyle = "rgba(244,246,251,.5)"; ctx.fillRect(M, M + FH / 2, FW, 1);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(M + FW / 2 + 1, M - 3, 2, FH + 6);
    ctx.fillStyle = C.steel3; ctx.fillRect(M + FW / 2 - 1, M - 4, 2, FH + 8);
    ctx.fillStyle = C.ink2; ctx.fillRect(M + FW / 2 - 1, M - 5, 2, 2); ctx.fillRect(M + FW / 2 - 1, M + FH + 3, 2, 2);
    // the paddles, in their players' colours
    const ys = [0, 0];
    ys[side] = myY; ys[1 - side] = mode === "machine" ? mach.y : oppY;
    for (const s of [0, 1]) {
      const col = mode === "machine" && s !== side ? C.steel2 : players[s] ? players[s].color : C.steel2;
      const x = M + (s === 0 ? FACE - 4 : FW - FACE + 1), y = Math.round(M + ys[s] - HALF);
      ctx.fillStyle = C.ink; ctx.fillRect(x - 1, y - 1, 5, HALF * 2 + 2);
      ctx.fillStyle = col; ctx.fillRect(x, y, 3, HALF * 2);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y, 1, HALF * 2);
    }
    // the ball; on the other page's side it waits at their paddle until their hit comes in
    if (ball) {
      let tt = t;
      const s = ball.vx < 0 ? 0 : 1;
      if (mode === "live" && s !== side) { const tc = contact(ball, s); if (t > tc && t < tc + 0.35) tt = tc; }
      const x = ball.x0 + ball.vx * (tt - ball.t0), y = yAt(ball, tt);
      if (x > -6 && x < FW + 6) {
        const bx = Math.round(M + x), by = Math.round(M + y);
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(bx - 1, by + 2, 4, 2);
        ctx.fillStyle = C.ink; ctx.fillRect(bx - 2, by - 2, 5, 5);
        ctx.fillStyle = C.white; ctx.fillRect(bx - 1, by - 1, 3, 3);
      }
    } else if (!over && serveBy !== null && mode) {
      const s = serveBy, y = Math.round(M + (s === side ? myY : mode === "machine" ? mach.y : oppY));
      if (Math.floor(local() * 4) % 2) { ctx.fillStyle = C.white; ctx.fillRect(M + (s === 0 ? FACE + 3 : FW - FACE - 5), y - 1, 2, 2); }
    }
  }
  let last = 0;
  function frame(ts) {
    if (!isOpen()) { last = 0; return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0); last = ts;
    if (mode) { step(dt); paint(); }
  }

  // ---- starting, joining, leaving
  function liveFrom(v) {
    gameId = v.id; side = v.left.id === me() ? 0 : 1;
    players = [{ ...v.left, img: room.small(v.left) }, { ...v.right, img: room.small(v.right) }];
  }
  function machineGame() {
    disconnect();
    mode = "machine"; side = 0; gameId = null; over = null; score = [0, 0]; ball = null; judged = false; missAt = 0;
    const p = room.people().find((q) => q.id === me()) || { name: "You", color: C.gold2 };
    players = [{ ...p, img: room.small(p) }, { name: "ball machine", color: C.steel2, img: `<img alt="" src="${pongIcon()}">` }];
    mach = { y: FH / 2, ball: null, err: 0 };
    serveBy = 0; serveAt = local() + 1;
    draw(); show();
  }
  function show() {
    const was = el.hidden;
    el.hidden = false;
    if (was) { last = 0; requestAnimationFrame(frame); }
  }
  function close() {
    if (mode === "live" && !over) {
      if (!confirm("Leave this game?")) return;
      room.post({ leave: true });
    } else if (!mode && !over && view && view.state === "invited" && [view.left.id, view.right.id].includes(me())) {
      room.post(view.right.id === me() ? { answer: false } : { leave: true });
      dismissed = view.id;
    }
    mode = null; over = null; ball = null;
    disconnect();
    el.hidden = true;
  }
  el.addEventListener("click", async (e) => {
    if (e.target === el) return close();       // a click beside the card
    const b = e.target.closest("button");
    if (!b) return;
    if (b.classList.contains("pg-close")) return close();
    if (b.dataset.machine !== undefined) return machineGame();
    if (b.dataset.invite) { connect(); await room.post({ invite: b.dataset.invite }); return; }
    if (b.dataset.cancel !== undefined) { await room.post({ leave: true }); disconnect(); return; }
    if (b.dataset.yes !== undefined) { liveFrom(view); connect(); await room.post({ answer: true }); return; }
    if (b.dataset.no !== undefined) { dismissed = view.id; await room.post({ answer: false }); el.hidden = true; return; }
    if (b.dataset.choose !== undefined) { mode = null; over = null; draw(); return; }
    if (b.dataset.again !== undefined) {
      if (gameId === null) return machineGame();
      const other = players[1 - side].id;
      mode = null; over = null; connect(); await room.post({ invite: other }); return;
    }
  });
  const toField = (e) => { const r = cv.getBoundingClientRect(); return (e.clientY - r.top) * cv.height / r.height - M; };
  cv.addEventListener("pointermove", (e) => { myY = clamp(toField(e), HALF, FH - HALF); });
  cv.addEventListener("pointerdown", (e) => { myY = clamp(toField(e), HALF, FH - HALF); cv.setPointerCapture(e.pointerId); e.preventDefault(); });
  addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape" && (!mode || over || mode === "machine")) return close();
    const k = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" }[e.key];
    if (k && mode) { keys[k] = true; e.preventDefault(); }
  });
  addEventListener("keyup", (e) => { const k = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" }[e.key]; if (k) keys[k] = false; });

  window.__pong = { get: () => ({ mode, score, side, over, serveBy, ball: !!ball, hits, open: isOpen() }), auto: (o) => { auto = o; } };
  return {
    update(v) {
      view = v;
      if (v && (v.state === "invited" || v.state === "playing") && [v.left.id, v.right.id].includes(me())) {
        if (v.state === "playing" && mode !== "live" && gameId !== v.id) { liveFrom(v); mode = "live"; over = null; score = v.score.slice(); connect(); show(); }
        if (v.state === "invited" && v.left.id === me()) { liveFrom(v); connect(); }
        if (v.state === "invited" && v.right.id === me() && dismissed !== v.id && mode !== "machine") {
          if (over && gameId !== v.id) { mode = null; over = null; }   // a new invitation after a game
          show();
        }
      }
      if (isOpen()) draw();
    },
    open() { draw(); show(); },
    invited: () => !!(view && view.state === "invited" && view.right.id === me() && dismissed !== view.id),
  };
}
