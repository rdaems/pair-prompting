// The floor: everyone in the room as a little 16-bit figure (their own face on a body
// in their colour) living in the empty margin beside the conversation. They wander,
// play chess at the table, stack a tower at the building site until it topples, throw
// a ball to each other, fly a kite, sit and read. How lively someone is follows how
// much they have said lately; whoever posts hops with a speech bubble; people who are
// away doze off, faded. Decoration only: it takes no space and catches no clicks.
//
// startFloor(canvas, room) with room = { people(), messages(), gap() }; returns { hop(id) }.
// One grid pixel is two CSS pixels.
function startFloor(cv, room) {
  const C = pixelAvatar.C, INK = C.ink;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shade = (hex, k) => "#" + [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, "0")).join("");
  const rnd = (a, b) => a + Math.random() * (b - a);
  const any = (a) => a[Math.floor(Math.random() * a.length)];
  let W = 60, H = 100;

  // ---- figures: the portrait's head on a body, pre-drawn per pose with an ink outline
  const SW = 22, SH = 29;                    // sprite size; the feet stand on row 27
  const faces = new Map(), bodies = new Map();
  function face(p) {
    const key = p.avatar + p.kind + p.color;
    if (!faces.has(key)) {
      const im = new Image(), f = { px: null };
      im.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = 20;
        const x = c.getContext("2d"); x.drawImage(im, 0, 0);
        f.px = x.getImageData(0, 0, 20, 20).data;
      };
      im.src = pixelAvatar(p.avatar, p.kind === "agent" ? "agent" : "human", p.color);
      faces.set(key, f);
    }
    return faces.get(key);
  }
  function body(p, pose) {
    const f = face(p);
    if (!f.px) return null;
    const key = p.avatar + p.kind + p.color + pose;
    if (bodies.has(key)) return bodies.get(key);
    const robot = p.kind === "agent", px = new Map(), line = new Set();
    const set = (x, y, c) => { if (c) px.set((y + 1) * SW + x + 1, c); };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    // the head: the portrait down to its chin (a robot's down to its neck)
    const cut = robot ? 16 : 14;
    for (let y = 0; y <= cut; y++) for (let x = 0; x < 20; x++) {
      const i = (y * 20 + x) * 4, d = f.px;
      if (d[i + 3] < 128) continue;
      const c = "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      set(x, y, c);
      if (c === INK) line.add((y + 1) * SW + x + 1);
    }
    const c0 = robot ? C.steel3 : p.color, c1 = robot ? C.steel1 : shade(p.color, 0.62);
    const skin = robot ? C.steel3 : pixelAvatar.skin(p.avatar), leg = robot ? C.steel1 : C.ink2;
    const top = cut + 1;                     // first row of the body
    if (!robot) rect(9, top, 2, 1, shade(skin, 0.8));
    // torso
    const tH = 21 - top + 1;
    rect(6, top + (robot ? 0 : 1), 8, tH - (robot ? 0 : 1), c0); rect(12, top + (robot ? 0 : 1), 2, tH - (robot ? 0 : 1), c1);
    if (robot) { set(9, top + 2, p.color); set(10, top + 2, p.color); set(9, top + 3, shade(p.color, 0.62)); }
    // arms: sleeves in the colour, hands in skin
    const arm = (x, y0, y1, hand) => { for (let y = y0; y <= y1; y++) rect(x, y, 2, 1, c1); rect(hand[0], hand[1], 2, 1, skin); };
    if (pose === "up") { arm(4, 12, 16, [4, 11]); arm(14, 12, 16, [14, 11]); }
    else if (pose === "reach") { arm(4, 17, 20, [4, 21]); rect(14, 17, 4, 2, c1); rect(18, 17, 2, 2, skin); }
    else if (pose === "carry" || pose === "book") { rect(14, 18, 3, 2, c1); rect(17, 18, 2, 2, skin); rect(4, 17, 2, 2, c1); rect(4, 19, 2, 1, skin); }
    else if (pose === "walk1") { arm(4, 17, 19, [5, 20]); arm(14, 17, 19, [13, 20]); }
    else if (pose === "walk2") { arm(4, 17, 19, [3, 20]); arm(14, 17, 19, [15, 20]); }
    else { arm(4, 17, 20, [4, 21]); arm(14, 17, 20, [14, 21]); }
    if (pose === "book") { rect(16, 16, 3, 4, C.red1); rect(16, 16, 1, 4, C.red0); }
    // legs
    if (pose === "sit" || pose === "book") { rect(7, 22, 9, 2, leg); rect(14, 24, 2, 3, leg); rect(14, 26, 3, 1, INK); }
    else if (pose === "walk1") { rect(7, 22, 2, 5, leg); rect(11, 22, 2, 4, leg); rect(7, 26, 3, 1, INK); rect(11, 25, 3, 1, INK); }
    else if (pose === "walk2") { rect(7, 22, 2, 4, leg); rect(11, 22, 2, 5, leg); rect(7, 25, 3, 1, INK); rect(11, 26, 3, 1, INK); }
    else { rect(7, 22, 2, 5, leg); rect(11, 22, 2, 5, leg); rect(7, 26, 3, 1, INK); rect(11, 26, 3, 1, INK); }
    // outline everything that is not already outline
    const c = document.createElement("canvas"); c.width = SW; c.height = SH;
    const x = c.getContext("2d");
    x.fillStyle = INK;
    for (let y = 0; y < SH; y++) for (let i = 0; i < SW; i++) {
      if (px.has(y * SW + i)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const k = (y + dy) * SW + i + dx;
        return i + dx >= 0 && i + dx < SW && px.has(k) && !line.has(k);
      })) x.fillRect(i, y, 1, 1);
    }
    for (const [k, col] of px) { x.fillStyle = col; x.fillRect(k % SW, Math.floor(k / SW), 1, 1); }
    bodies.set(key, c);
    return c;
  }

  // ---- places, laid out in the margin as it is now (it changes with the window)
  const place = {
    chess: () => ({ x: Math.round(W / 2), y: Math.round(H * 0.24) }),
    build: () => ({ x: Math.round(W / 2 + Math.min(14, W / 6)), y: Math.round(H * 0.55) }),
    pile: () => ({ x: Math.round(W / 2 - Math.min(18, W / 4)), y: Math.round(H * 0.55) + 2 }),
    ball: () => ({ x: Math.round(W / 2), y: Math.round(H * 0.84) }),
  };
  const spot = () => ({ fx: rnd(0.15, 0.85), fy: rnd(0.12, 0.95) });
  const at = (s) => ({ x: s.fx * W, y: s.fy * H });

  // ---- what is going on
  const folk = new Map();                    // id -> figure
  const chess = { a: null, b: null, sq: null, turn: 0, moves: 0, wait: 0, over: 0, hand: 0 };
  const tower = { bricks: [], fall: 0, cheer: 0 };
  const ball = { a: null, b: null, from: 0, t: 0, hold: 0 };

  function figure(p) {
    if (!folk.has(p.id)) {
      const s = spot();
      folk.set(p.id, { id: p.id, x: s.fx * W, y: s.fy * H, dir: Math.random() < 0.5 ? 1 : -1, to: null, act: null, step: 0, hop: 0, talk: 0, pose: "stand", busy: 0, z: 0 });
    }
    return folk.get(p.id);
  }
  function activity(id) {
    const t = Date.now() / 1000, ms = room.messages();
    let a = 0;
    for (let i = ms.length - 1; i >= 0 && t - ms[i].t < 3600; i--) if (ms[i].from === id) a += Math.exp(-(t - ms[i].t) / 600);
    return Math.min(a, 3) / 3;               // 0 = quiet for a while, 1 = talking a lot right now
  }
  const free = (f) => !f.act;
  function done(f) {
    if (chess.a === f || chess.b === f) { const o = chess.a === f ? chess.b : chess.a; chess.a = chess.b = null; if (o) o.act = null; }
    if (ball.a === f || ball.b === f) { const o = ball.a === f ? ball.b : ball.a; ball.a = ball.b = null; if (o) o.act = null; }
    f.act = null; f.pose = "stand"; f.to = null;
  }

  // something new to do for an idle figure, given who else is idle
  function choose(f, idle, a) {
    const partner = idle.find((g) => g !== f);
    const r = Math.random();
    if (partner && !chess.a && r < 0.22) {
      chess.a = f; chess.b = partner; setup();
      f.act = { kind: "chess", side: 0 }; partner.act = { kind: "chess", side: 1 };
    } else if (partner && !ball.a && r < 0.4) {
      ball.a = f; ball.b = partner; ball.from = 0; ball.t = -1; ball.hold = 1;
      f.act = { kind: "ball", side: 0 }; partner.act = { kind: "ball", side: 1 };
    } else if (r < 0.62 && !tower.fall) {
      f.act = { kind: "build", n: Math.floor(rnd(3, 7)), have: false, wait: 0 };
    } else if (r < 0.72) {
      f.act = { kind: "kite", s: { fx: rnd(0.2, 0.6), fy: rnd(0.6, 0.95) }, left: rnd(25, 50), k: Math.random() * 6 };
    } else if (r < 0.84 + 0.1 * (1 - a)) {
      f.act = { kind: "read", s: spot(), left: rnd(20, 60) };
    } else {
      f.act = { kind: "wander", s: spot(), left: rnd(2, 6) };
    }
  }

  // walk towards (x, y); true once there
  function walk(f, x, y, v, dt) {
    const dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy);
    if (d <= v * dt) { f.x = x; f.y = y; return true; }
    f.x += (dx / d) * v * dt; f.y += (dy / d) * v * dt;
    if (Math.abs(dx) > 0.5) f.dir = Math.sign(dx);
    f.step += dt * 8; f.pose = Math.floor(f.step) % 2 ? "walk1" : "walk2";
    return false;
  }

  // chess: a 16x16 board, two ranks of pieces each side, crude but earnest play
  function setup() {
    chess.sq = new Array(64).fill(-1);
    for (let r = 0; r < 8; r++) for (const c of [0, 1]) { chess.sq[r * 8 + c] = 0; chess.sq[r * 8 + 7 - c] = 1; }
    chess.turn = 0; chess.moves = 0; chess.wait = 2; chess.over = 0;
  }
  function move() {
    const me = chess.turn, d = me ? -1 : 1, opts = [];
    for (let i = 0; i < 64; i++) {
      if (chess.sq[i] !== me) continue;
      const r = Math.floor(i / 8), c = i % 8;
      for (const [dc, dr] of [[d, 0], [d, -1], [d, 1], [2 * d, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const t = chess.sq[nr * 8 + nc];
        if (t === me) continue;
        opts.push({ i, j: nr * 8 + nc, take: t === 1 - me });
      }
    }
    const takes = opts.filter((o) => o.take);
    const m = takes.length && Math.random() < 0.6 ? any(takes) : opts.length ? any(opts) : null;
    if (m) { chess.sq[m.j] = me; chess.sq[m.i] = -1; }
    chess.moves++; chess.turn = 1 - me;
    const left = [0, 1].map((s) => chess.sq.filter((q) => q === s).length);
    if (chess.moves > 50 || Math.min(...left) < 5) { chess.over = 2.5; chess.win = left[0] >= left[1] ? 0 : 1; }
  }

  function think(f, p, a, dt, idle) {
    f.hop = Math.max(0, f.hop - dt); f.talk = Math.max(0, f.talk - dt);
    if (still) { f.pose = "stand"; return; }
    if (!p.present) {                         // away: sit down somewhere and doze
      if (f.act && f.act.kind !== "doze") done(f);
      if (!f.act) f.act = { kind: "doze", s: spot() };
      const s = at(f.act.s);
      if (walk(f, s.x, s.y, 10, dt)) { f.pose = "sit"; f.z += dt; }
      return;
    }
    if (f.act && f.act.kind === "doze") done(f);
    const v = 12 + 26 * a;
    if (!f.act) {
      f.pose = "stand"; f.busy -= dt;
      if (f.busy <= 0) { f.busy = rnd(1, 4) * (1.5 - a); choose(f, idle, a); }
      return;
    }
    const act = f.act;
    if (act.kind === "wander") {
      const s = at(act.s);
      if (walk(f, s.x, s.y, v, dt)) { f.pose = "stand"; if ((act.left -= dt) <= 0) done(f); }
    } else if (act.kind === "read") {
      const s = at(act.s);
      if (walk(f, s.x, s.y, v, dt)) { f.pose = "book"; if ((act.left -= dt) <= 0) done(f); }
    } else if (act.kind === "kite") {
      const s = at(act.s);
      act.k += dt;
      if (walk(f, s.x, s.y, v, dt)) { f.pose = Math.sin(act.k * 1.3) > 0.6 ? "up" : "stand"; f.dir = 1; act.up = Math.min(1, (act.up || 0) + dt / 4); if ((act.left -= dt) <= 0) done(f); }
    } else if (act.kind === "chess") {
      const c = place.chess(), x = c.x + (act.side ? 15 : -15);
      if (walk(f, x, c.y + 3, v, dt)) {
        f.dir = act.side ? -1 : 1;
        f.pose = chess.over ? (chess.win === act.side ? "up" : "stand") : chess.hand > 0 && chess.turn !== act.side ? "reach" : "sit";
        act.seated = true;
      }
    } else if (act.kind === "ball") {
      const b = place.ball(), x = b.x + (act.side ? 20 : -20);
      if (walk(f, x, b.y, v, dt)) {
        act.there = true; f.dir = act.side ? -1 : 1;
        const holding = ball.t < 0 && ball.from === act.side;
        f.pose = holding && ball.hold < 0.3 ? "up" : ball.t >= 0 && ball.t > 0.8 && ball.from !== act.side ? "up" : "stand";
        if ((act.left = (act.left ?? rnd(20, 45)) - dt) <= 0) done(f);
      }
    } else if (act.kind === "build") {
      const pile = place.pile(), site = place.build();
      if (!act.have) {
        if (walk(f, pile.x + 6, pile.y, v, dt)) { f.pose = "reach"; f.dir = -1; if ((act.wait += dt) > 0.5) { act.have = true; act.wait = 0; } }
      } else if (walk(f, site.x - 10, site.y, v, dt)) {
        f.dir = 1; f.pose = "reach";
        if (tower.cheer > 0) f.pose = "up";
        else if (tower.fall) f.pose = "carry";          // hold on to it until the rubble is gone
        else if ((act.wait += dt) > 0.4) {
          tower.bricks.push(p.color);
          act.have = false; act.wait = 0;
          if (tower.bricks.length >= 2 * Math.min(14, Math.floor(H * 0.55 / 2 / 3))) { tower.cheer = 2.2; tower.fall = 3.6; }
          if (--act.n <= 0) done(f);
        }
      }
    }
  }

  function tick(dt) {
    const people = room.people().filter((p) => !(p.kind === "agent" && !p.joined));
    const ids = new Set(people.map((p) => p.id));
    for (const [id, f] of folk) if (!ids.has(id)) { done(f); folk.delete(id); }
    const figs = people.map((p) => [p, figure(p)]);
    for (const [, f] of figs) if (f.act && (f.act.kind === "chess" ? !chess.a : f.act.kind === "ball" ? !ball.a : false)) f.act = null;
    const idle = figs.filter(([p, f]) => p.present && free(f)).map(([, f]) => f);
    for (const [p, f] of figs) think(f, p, activity(p.id), dt, idle);
    // the games run once their players are in place
    if (chess.a && chess.a.act?.seated && chess.b.act?.seated) {
      chess.hand = Math.max(0, chess.hand - dt);
      if (chess.over) { if ((chess.over -= dt) <= 0) { const a = chess.a, b = chess.b; done(a); done(b); } }
      else if ((chess.wait -= dt) <= 0) { move(); chess.hand = 0.5; chess.wait = rnd(0.9, 3); }
    }
    if (ball.a && ball.a.act?.there && ball.b.act?.there) {
      if (ball.t < 0) { if ((ball.hold -= dt) <= 0) ball.t = 0; }
      else if ((ball.t += dt / 1.1) >= 1) { ball.from = 1 - ball.from; ball.t = -1; ball.hold = rnd(0.4, 1.2); }
    }
    if (tower.fall) {
      tower.cheer = Math.max(0, tower.cheer - dt);
      if (tower.cheer <= 0 && !tower.drop) tower.drop = tower.bricks.map(() => ({ vx: rnd(-14, 14), vy: rnd(-16, -4), x: 0, y: 0, r: 0 }));
      if (tower.drop) for (const d of tower.drop) { d.vy += 60 * dt; d.x += d.vx * dt; d.y = Math.min(d.y + d.vy * dt, rnd(0, 6)); }
      if ((tower.fall -= dt) <= 0) { tower.fall = 0; tower.bricks = []; tower.drop = null; }
    }
  }

  // ---- drawing
  function draw(ctx) {
    ctx.clearRect(0, 0, W, H);
    const items = [];                        // drawn back to front, by where they stand
    const people = room.people().filter((p) => !(p.kind === "agent" && !p.joined));
    for (const p of people) { const f = folk.get(p.id); if (f) items.push({ y: f.y, d: () => drawFigure(ctx, p, f) }); }
    const c = place.chess();
    items.push({ y: c.y + 2, d: () => drawChess(ctx, c) });
    const s = place.build(), pl = place.pile();
    items.push({ y: s.y, d: () => drawTower(ctx, s) });
    items.push({ y: pl.y, d: () => drawPile(ctx, pl) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.d();
    // things in the air go over everything
    if (ball.a && ball.a.act?.there && ball.b.act?.there) {
      const A = ball.from ? ball.b : ball.a, B = ball.from ? ball.a : ball.b;
      const t = Math.max(0, ball.t);
      const x = A.x + (B.x - A.x) * t, y = A.y - 26 + (B.y - A.y) * t - Math.sin(t * Math.PI) * 18 * (ball.t < 0 ? 0 : 1);
      ctx.fillStyle = INK; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 2); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 4);
      ctx.fillStyle = C.red1; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); ctx.fillStyle = C.white; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1);
    }
    for (const p of people) {
      const f = folk.get(p.id);
      if (f && f.act?.kind === "kite" && f.act.up) drawKite(ctx, p, f);
    }
  }
  function drawFigure(ctx, p, f) {
    ctx.globalAlpha = p.present ? 1 : 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(Math.round(f.x) - 5, Math.round(f.y), 10, 1); ctx.fillRect(Math.round(f.x) - 3, Math.round(f.y) + 1, 6, 1);
    const lift = f.hop > 0 && f.pose !== "sit" && f.pose !== "book" ? Math.round(Math.sin((f.hop / 0.6) * Math.PI) * 3) : 0;
    const im = body(p, f.pose);
    const x = Math.round(f.x) - 11, y = Math.round(f.y) - 27 - lift;
    if (im) {
      ctx.save();
      if (f.dir < 0) { ctx.translate(x + SW, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, y); } else ctx.drawImage(im, x, y);
      ctx.restore();
    }
    if (f.act?.kind === "build" && f.act.have && f.pose !== "reach") {          // the brick being carried
      const bx = Math.round(f.x) + (f.dir > 0 ? 5 : -9), by = y + 16;
      ctx.fillStyle = INK; ctx.fillRect(bx - 1, by - 1, 6, 4); ctx.fillStyle = p.color; ctx.fillRect(bx, by, 4, 2);
    }
    if (!p.present && f.pose === "sit") {    // z z z
      ctx.fillStyle = C.steel3;
      for (let i = 0; i < 2; i++) { const k = (f.z * 0.5 + i * 0.5) % 1; zed(ctx, Math.round(f.x + 4 + k * 6), Math.round(y + 2 - k * 10)); }
    }
    if (f.talk > 0) {                         // a speech bubble: someone just said something
      const bx = Math.round(f.x) + 3, by = y - 5;
      ctx.fillStyle = C.steel4; ctx.fillRect(bx, by, 9, 5); ctx.fillRect(bx, by + 5, 1, 1);
      ctx.fillStyle = INK; for (let i = 0; i < 3; i++) if ((Math.floor(f.talk * 4) + i) % 3) ctx.fillRect(bx + 2 + i * 2, by + 2, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  const zed = (ctx, x, y) => { ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x, y + 2, 3, 1); };
  function drawChess(ctx, c) {
    // a table seen from the front and above: the board squashed to 2x1 squares, pieces standing on it
    const x0 = c.x - 9, y0 = c.y - 13;
    ctx.fillStyle = INK; ctx.fillRect(x0 - 1, y0 - 1, 20, 13);
    ctx.fillStyle = "#7a4a35"; ctx.fillRect(x0, y0, 18, 10); ctx.fillStyle = "#4a2e2a"; ctx.fillRect(x0, y0 + 10, 18, 2);
    ctx.fillStyle = INK; ctx.fillRect(x0 + 1, y0 + 12, 4, 6); ctx.fillRect(x0 + 13, y0 + 12, 4, 6);
    ctx.fillStyle = "#4a2e2a"; ctx.fillRect(x0 + 2, y0 + 12, 2, 5); ctx.fillRect(x0 + 14, y0 + 12, 2, 5);
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
      ctx.fillStyle = (r + q) % 2 ? C.steel1 : C.steel3; ctx.fillRect(x0 + 1 + q * 2, y0 + 1 + r, 2, 1);
    }
    if (!chess.sq || !chess.a || !chess.b) return;
    const col = [chess.a, chess.b].map((f) => room.people().find((p) => folk.get(p.id) === f)?.color || C.white);
    for (let i = 0; i < 64; i++) if (chess.sq[i] >= 0) {
      const q = i % 8, r = Math.floor(i / 8);
      ctx.fillStyle = shade(col[chess.sq[i]], 0.55); ctx.fillRect(x0 + 1 + q * 2, y0 + r, 2, 1);
      ctx.fillStyle = col[chess.sq[i]]; ctx.fillRect(x0 + 1 + q * 2, y0 - 1 + r, 2, 1);
    }
  }
  function drawTower(ctx, s) {
    ctx.fillStyle = C.steel0; ctx.fillRect(s.x - 7, s.y, 14, 1);
    tower.bricks.forEach((c, k) => {
      const layer = Math.floor(k / 2), off = layer % 2 ? 2 : 0;
      let x = s.x - 6 + off + (k % 2) * 5 - (layer % 2 ? 2 : 0), y = s.y - 3 - layer * 3;
      if (tower.drop) { const d = tower.drop[k]; x += Math.round(d.x); y = Math.min(s.y - 3, y + Math.round(d.y * (1 + layer / 4))); }
      ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, 6, 4); ctx.fillStyle = c; ctx.fillRect(x, y, 4, 2); ctx.fillStyle = shade(c, 0.62); ctx.fillRect(x, y + 1, 4, 1);
    });
    if (tower.cheer > 0) { ctx.fillStyle = C.gold2; for (let i = 0; i < 5; i++) ctx.fillRect(s.x - 8 + Math.round(Math.random() * 16), s.y - 6 - tower.bricks.length * 1.5 - Math.round(Math.random() * 8), 1, 1); }
  }
  function drawPile(ctx, s) {
    for (const [dx, dy, c] of [[-5, 0, C.steel2], [0, 0, C.bone2], [5, 0, C.steel2], [-2, -3, C.bone2], [3, -3, C.steel2], [0, -6, C.bone2]]) {
      ctx.fillStyle = INK; ctx.fillRect(s.x + dx - 3, s.y + dy - 3, 6, 4); ctx.fillStyle = c; ctx.fillRect(s.x + dx - 2, s.y + dy - 2, 4, 2);
    }
  }
  function drawKite(ctx, p, f) {
    const k = f.act.k, up = f.act.up;
    const hx = Math.round(f.x) + 6, hy = Math.round(f.y) - 18;
    const kx = Math.round(Math.min(W - 6, hx + up * (16 + Math.sin(k * 0.7) * 6))), ky = Math.round(Math.max(6, hy - up * (40 + Math.sin(k * 1.1) * 8)));
    ctx.fillStyle = C.steel2;
    for (let i = 1; i < 14; i++) { const t = i / 14; ctx.fillRect(Math.round(hx + (kx - hx) * t), Math.round(hy + (ky - hy) * t + Math.sin(t * Math.PI) * 4), 1, 1); }
    ctx.fillStyle = INK;
    for (let j = -4; j <= 4; j++) { const w = 4 - Math.abs(j); ctx.fillRect(kx - w - 1, ky + j, 2 * w + 3, 1); }
    for (let j = -3; j <= 3; j++) { const w = 3 - Math.abs(j); ctx.fillStyle = j < 0 ? p.color : shade(p.color, 0.62); ctx.fillRect(kx - w, ky + j, 2 * w + 1, 1); }
    ctx.fillStyle = p.color;
    for (let i = 0; i < 4; i++) ctx.fillRect(kx + Math.round(Math.sin(k * 3 + i) * 1.5), ky + 5 + i * 2, 1, 1);
  }

  // ---- size and run, twelve frames a second like a 16-bit game
  function size() {
    const g = room.gap();
    cv.hidden = g < 110;
    if (cv.hidden) return;
    cv.style.width = g + "px";
    const w = Math.floor(g / 2), h = Math.floor(cv.clientHeight / 2);
    if (w !== W || h !== H) {
      for (const f of folk.values()) { f.x = Math.min(f.x, w - 4); f.y = Math.min(Math.max(f.y, 30), h - 2); }
      W = w; H = h; cv.width = W; cv.height = H;
    }
  }
  let last = 0, acc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden || cv.hidden) { last = ts; return; }
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts; acc += dt;
    if (acc < 1 / 12) return;
    const step = Math.min(acc, 0.25); acc = 0;
    tick(step);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
  }
  addEventListener("resize", size);
  size();
  requestAnimationFrame(frame);
  return {
    size,
    hop(id) { const f = folk.get(id); if (f) { f.hop = 0.6; f.talk = 2.2; } },
  };
}
