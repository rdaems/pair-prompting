// The chess table in the page: the board, the moves, and who to sit down with. The
// rules live on the server (chess.py): the board only offers the moves it was sent.
//
// chessPanel(el, { post(body), people(), me(), face(p) }) returns { update(view), turn() };
// view is the room state's `chess` (null before the first game).
const chessSprite = (() => {
  const C = pixelAvatar.C, cache = new Map();
  // 16x16, '#' is the piece; holes inside it come out as ink, like the eye of the knight
  const ART = {
    p: ["", "", "", "", "......####", ".....######", ".....######", "......####", ".....######", "......####", "......####",
      ".....######", "....########", "...##########", "...##########"],
    r: ["", "", "...##..##..##", "...##########", "...##########", "....########", ".....######", ".....######", ".....######",
      ".....######", ".....######", "....########", "...##########", "..############", "..############"],
    n: ["", "", ".......#.#", "......#####", ".....#######", "....###.#####", "...##########", "..####..######", "..###...######",
      "........######", ".......######", "......#######", ".....########", "....#########", "...##########"],
    b: ["", ".......##", "......####", ".....###.##", ".....##.###", ".....######", "......####", ".......##", "......####",
      "......####", ".....######", "......####", "....########", "...##########", "...##########"],
    q: [".......##", "..#....##....#", "..##..####..##", "...##.####.##", "...##########", "....########", ".....######", "......####",
      "......####", ".....######", "......####", "......####", ".....######", "....########", "...##########", "...##########"],
    k: [".......##", ".....######", ".......##", "...####..####", "..############", "..############", "...##########", "....########",
      ".....######", "......####", ".....######", "......####", "......####", "....########", "...##########", "...##########"],
  };
  return (ch) => {
    if (cache.has(ch)) return cache.get(ch);
    const white = ch === ch.toUpperCase(), rows = ART[ch.toLowerCase()];
    const [base, lit, dark] = white ? [C.steel4, C.white, C.steel3] : [C.ink2, C.steel0, C.ink];
    const on = (x, y) => (rows[y] || "")[x] === "#";
    const c = document.createElement("canvas"); c.width = c.height = 18;
    const g = c.getContext("2d");
    for (let y = -1; y <= 16; y++) for (let x = -1; x <= 16; x++) {
      if (on(x, y)) {
        g.fillStyle = !on(x - 1, y) || !on(x, y - 1) ? lit : !on(x + 1, y) || !on(x, y + 1) ? dark : base;
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.fillStyle = white ? C.ink : C.steel1;
      else continue;
      g.fillRect(x + 1, y + 1, 1, 1);
    }
    cache.set(ch, c.toDataURL());
    return cache.get(ch);
  };
})();

function chessPanel(el, room) {
  const START = "RNBQKBNRPPPPPPPP" + ".".repeat(32) + "pppppppprnbqkbnr";
  const sq = (s) => "abcdefgh"[s % 8] + (Math.floor(s / 8) + 1);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let view = null, sel = null, promo = null, err = "", seenPly = -1;

  const mine = () => view && !view.result && [view.white.id, view.black.id].includes(room.me());
  const turn = () => !!(view && view.legal && view.legal.length);
  function status() {
    if (!view) return "The chess table is free.";
    const w = view.white.name, b = view.black.name, me = room.me();
    if (view.result) {
      const win = view.result === "1-0" ? w : b, lose = view.result === "1-0" ? b : w;
      return {
        checkmate: `Checkmate: ${win} wins.`, resignation: `${lose} resigned: ${win} wins.`, left: `${lose} left the table: ${win} wins.`,
        stalemate: "Stalemate: a draw.", repetition: "Draw by repetition.", "fifty moves": "Draw: fifty moves without a capture or a pawn move.",
        material: "Draw: not enough pieces left to mate.", agreement: "Drawn by agreement.", unfinished: "Left unfinished.",
      }[view.why] || "Over.";
    }
    const who = view.toMove === me ? "Your move" : `${(view.toMove === view.white.id ? view.white : view.black).name} to move`;
    let s = who + (view.check ? ", check!" : ".");
    if (view.draw && view.draw !== me) s += ` ${view.draw === view.white.id ? w : b} offers a draw.`;
    else if (view.draw === me) s += " You offered a draw.";
    if (view.free) s += " Nobody has moved for an hour, so the table is free again.";
    return s;
  }
  function draw() {
    const me = room.me(), board = view ? view.board : START;
    const flip = view && view.black.id === me;
    const last = view && view.last ? [view.last.slice(0, 2), view.last.slice(2, 4)] : [];
    const legal = (view && view.legal) || [];
    const targets = sel === null ? [] : legal.filter((m) => m.startsWith(sq(sel))).map((m) => m.slice(2, 4));
    const kingInCheck = view && view.check && !view.result ? board.indexOf(view.toMove === view.white.id ? "K" : "k") : -1;
    let h = `<h2>Chess</h2>`;
    if (view) {
      const pl = (p, colour) => `<span class="ch-pl${view.toMove === p.id && !view.result ? " on" : ""}" style="--c:${p.color}">${room.face(p)}<b>${esc(p.name)}</b> <small>${colour}</small></span>`;
      h += `<div class="ch-who">${pl(view.white, "white")}<span class="vs">vs</span>${pl(view.black, "black")}</div>`;
    }
    h += `<div class="ch"><div class="ch-board${view && !view.result ? "" : " idle"}">`;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const s = flip ? r * 8 + (7 - c) : (7 - r) * 8 + c, p = board[s], n = sq(s);
      const cls = ["sq", (r + c) % 2 ? "d" : "l"];
      if (last.includes(n)) cls.push("last");
      if (s === sel) cls.push("sel");
      if (targets.includes(n)) cls.push(p !== "." ? "hit" : "to");
      if (s === kingInCheck) cls.push("check");
      let inner = p !== "." ? `<img alt="${p}" src="${chessSprite(p)}">` : "";
      if (c === 0) inner += `<i class="rk">${n[1]}</i>`;
      if (r === 7) inner += `<i class="fl">${n[0]}</i>`;
      h += `<button class="${cls.join(" ")}" data-s="${s}" aria-label="${n}">${inner}</button>`;
    }
    h += `</div><div class="ch-side"><p class="ch-status${turn() ? " mine" : ""}">${esc(status())}</p>`;
    if (promo) h += `<div class="ch-promo">promote to ${"qrbn".split("").map((k) => `<button class="btn" data-promo="${k}"><img alt="${k}" src="${chessSprite(view.white.id === me ? k.toUpperCase() : k)}"></button>`).join("")}</div>`;
    if (err) h += `<p class="err">${esc(err)}</p>`;
    if (view && view.sans.length) {
      h += `<ol class="ch-moves">`;
      for (let i = 0; i < view.sans.length; i += 2) h += `<li><span>${i / 2 + 1}.</span> ${esc(view.sans[i])} ${esc(view.sans[i + 1] || "")}</li>`;
      h += `</ol>`;
    }
    if (mine()) {
      const offered = view.draw && view.draw !== me;
      h += `<div class="ch-acts"><button class="btn" data-act="draw">${offered ? "accept draw" : "offer draw"}</button><button class="btn" data-act="resign">resign</button></div>`;
    }
    h += `</div></div>`;
    if (!view || view.free) {
      const others = room.people().filter((p) => p.id !== me).sort((a, b) => b.present - a.present);
      h += `<div class="ch-play"><span>${view ? "Play again, or with someone else:" : "Sit down with someone (colours by lot):"}</span>` +
        (others.length ? others.map((p) => `<button class="who-chip ${p.kind}${p.present ? "" : " away"}" style="--c:${p.color}" data-play="${p.id}">${room.small(p)}${esc(p.name)}</button>`).join("")
          : `<span class="none">nobody else is here yet</span>`) + `</div>`;
    }
    el.innerHTML = h;
    const list = el.querySelector(".ch-moves");
    if (list) list.scrollTop = list.scrollHeight;
  }
  async function send(body) {
    err = "";
    const r = await room.post(body);
    if (!r.ok) { err = (await r.json().catch(() => ({}))).error || "that didn't work"; draw(); }
  }
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.play) return send({ challenge: b.dataset.play });
    if (b.dataset.act === "resign") { if (confirm("Resign this game?")) send({ resign: true }); return; }
    if (b.dataset.act === "draw") return send({ draw: true });
    if (b.dataset.promo) { const m = promo + b.dataset.promo; promo = null; sel = null; draw(); return send({ move: m }); }
    if (b.dataset.s === undefined || !turn()) return;
    const s = +b.dataset.s, legal = view.legal;
    if (sel !== null) {
      const hits = legal.filter((m) => m.startsWith(sq(sel) + sq(s)));
      if (hits.length > 1) { promo = sq(sel) + sq(s); draw(); return; }
      if (hits.length === 1) { const m = hits[0]; sel = null; promo = null; draw(); return send({ move: m }); }
    }
    promo = null;
    sel = sel !== s && legal.some((m) => m.startsWith(sq(s))) ? s : null;
    draw();
  });
  return {
    update(v) {
      const ply = v ? v.id * 1000 + v.sans.length + (v.result ? 500 : 0) : -1;
      if (ply !== seenPly) { sel = null; promo = null; err = ""; seenPly = ply; }
      view = v; draw();
    },
    turn,
  };
}
