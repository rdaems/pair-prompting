// The floor: the room as a little 16-bit office in the empty margin beside the
// conversation. Everyone has a desk (each human with their agents beside them) and is
// drawn as a figure: their own face on a body in their colour, robots for agents.
// They type when they post, fetch coffee, print, chat at the water cooler, play
// ping-pong, call a meeting at the whiteboard, water the plants, read in the armchair; how often they
// get up follows how quiet they have been, and they talk while they're at it (floorTalk).
// People who have been away a while go to sleep on a mat, robots charge on theirs.
// The chess table is real: while two people play (chessboard.js), they sit at it.
//
// You can play along: click the floor and your figure walks there, click a piece of
// furniture and it uses it, click someone and it goes over for a chat, click yourself
// to wave, click a mat for a nap, and pick anyone up by dragging them. All of it happens in your own
// browser only; nobody else sees it, and it never touches the conversation.
//
// startFloor(canvas, room) with room = { people(), messages(), me(), gap(), log, chess(), openChess() };
// returns { size(), hop(id) }. One grid pixel is two CSS pixels.
// What the figures say: office talk, little exchanges, and wisdom in the manner of
// Deepak Chopra, lettered in a 3x5 pixel font (upper case, like a Pico-8). All of it
// is made up in this browser, like everything else on the floor.
const floorTalk = (() => {
  const any = (a) => a[Math.floor(Math.random() * a.length)];
  // the profound: on its own, and with an adjective ({A}) where one fits
  const P = [["CONSCIOUSNESS", "{A} CONSCIOUSNESS"], ["THE UNIVERSE", "THE {A} UNIVERSE"], ["SILENCE", "{A} SILENCE"],
    ["THE PRESENT MOMENT", "THE {A} NOW"], ["INTENTION", "{A} INTENTION"], ["THE QUANTUM FIELD", "THE {A} FIELD"],
    ["INFINITY", "{A} INFINITY"], ["STILLNESS", "{A} STILLNESS"], ["ABUNDANCE", "{A} ABUNDANCE"],
    ["YOUR INNER CHILD", "YOUR {A} INNER CHILD"], ["THE VOID", "THE {A} VOID"]];
  const A = ["INFINITE", "QUANTUM", "COSMIC", "TIMELESS", "SACRED", "NONLOCAL", "ETERNAL", "BOUNDLESS"];
  const V = ["TRANSCENDS", "IS ENTANGLED WITH", "GIVES BIRTH TO", "DANCES WITH", "HEALS", "UNFOLDS INTO", "AWAKENS", "FORGIVES"];
  const O = [["THE PRINTER", "PRINTER"], ["YOUR INBOX", "INBOX"], ["THE COFFEE MACHINE", "COFFEE MACHINE"], ["THE STANDUP", "STANDUP"],
    ["A SPREADSHEET", "SPREADSHEET"], ["THE DEADLINE", "DEADLINE"], ["THE WI-FI", "WI-FI"], ["THE STAPLER", "STAPLER"],
    ["A MERGE CONFLICT", "MERGE CONFLICT"], ["THE CLOUD", "CLOUD"], ["THE MEETING", "MEETING"], ["MONDAY", "MONDAY"], ["THE PLANT", "PLANT"]];
  function chopra() {
    const [o, bare] = any(O), [p, pa0] = any(P), a = any(A), pa = pa0.replace("{A}", any(A));
    return any([
      () => `${o} IS ${pa}.`,
      () => `${p} ${any(V)} ${o}.`,
      () => `BE THE ${bare} YOU WISH TO SEE.`,
      () => `THERE IS NO ${bare}. ONLY ${pa}.`,
      () => `YOU ARE NOT IN ${o}. ${o} IS IN YOU.`,
      () => `${o} IS JUST ${p} IN DISGUISE.`,
      () => `THE ${a} ${bare} ALREADY KNOWS.`,
      () => `${p} HAS NO DEADLINE.`,
    ])();
  }
  const LINES = {
    coffee: ["DECAF IS A STATE OF MIND.", "COFFEE NUMBER FIVE. OR SIX.", "THE MACHINE KNOWS MY NAME.", "ESPRESSO YOURSELF.", "WHO FINISHED THE MILK?"],
    print: ["PC LOAD LETTER?!", "WHO PRINTS ANYMORE?", "IT PRINTED A CAT.", "PAPER JAM. AGAIN.", "COME ON, COME ON..."],
    plant: ["GROW, LITTLE FRIEND.", "YOU'RE DOING GREAT.", "PHOTOSYNTHESIZE THIS.", "DON'T TELL THE OTHER PLANT."],
    window: ["IS IT FRIDAY YET?", "THE OUTSIDE IS A RUMOUR.", "NICE DAY FOR A STANDUP.", "I SEE A BIRD. HI BIRD."],
    night: ["THE MOON IS A SCREENSAVER.", "SHOULD I GO HOME?", "IT'S DARK. LIKE MY MODE."],
    chair: ["PLOT TWIST: IT WAS THE PRINTER.", "THIS BOOK HAS NO WI-FI.", "JUST ONE MORE CHAPTER."],
    desk: ["WHO TOOK MY STAPLER?", "COMPILING...", "JUST ONE MORE TAB.", "IT WORKS ON MY MACHINE.", "CTRL+S. CTRL+S. CTRL+S."],
    pong: ["PING!", "PONG!", "SPIN SERVE!", "NET!", "11-9!", "BEST OF 99?", "THE BALL IS AN ILLUSION.", "I LET YOU WIN."],
    chess: ["HMM.", "HMMMM...", "THE KNIGHT MOVES IN MYSTERIOUS WAYS.", "I SEE MATE IN 37.", "TOUCH MOVE!", "EN PASSANT IS A STATE OF MIND."],
    host: ["LET'S ALIGN ON SYNERGY.", "ACTION ITEM: VIBES.", "NEXT SLIDE, PLEASE.", "CAN EVERYONE SEE MY SCREEN?", "LET'S TAKE THIS OFFLINE."],
    meeting: ["+1", "YOU'RE ON MUTE.", "WHO'S TAKING NOTES?", "THIS COULD BE AN EMAIL.", "SORRY, GO AHEAD.", "NO, YOU GO AHEAD."],
    held: ["WHEEE!", "PUT ME DOWN!", "I CAN FLY!", "NOT IN MY JOB DESCRIPTION!"],
    dropped: ["OOF.", "AGAIN!", "MY BACK.", "I MEANT TO DO THAT."],
    wake: ["I'M BACK!", "WAS I ASLEEP?", "MORNING!", "WHAT DID I MISS?"],
    hi: ["HI!", "HELLO!", "YOO-HOO!", "OVER HERE!"],
    hello: ["HEY!", "GOT A MINUTE?", "KNOCK KNOCK.", "QUICK QUESTION..."],
    dream: ["ZZZ... FIVE MORE MINUTES.", "...NOT THE STANDUP...", "*SNORE*", "...MERGE... CONFLICT...", "DREAMING OF SEMICOLONS."],
    robotDream: ["CHARGING... 42%", "...SHEEP.EXE...", "DREAMING OF ELECTRIC SHEEP.", "DEFRAGMENTING FEELINGS..."],
    robot: ["BEEP. I MEAN: HELLO.", "AS AN AGENT, I APPROVE OF THIS COFFEE.", "MY CONTEXT WINDOW IS FULL OF FEELINGS.",
      "TOKENS ARE JUST FEELINGS IN DISGUISE.", "I WAS TRAINED FOR THIS.", "RUNNING ON VIBES AND ELECTRICITY."],
  };
  const TALKS = [
    ["DID YOU TRY TURNING IT OFF AND ON AGAIN?", "I DID. NOW IT'S OFF."],
    ["HOW WAS YOUR WEEKEND?", "TOO SHORT.", "SAME."],
    ["IS THIS MEETING AN EMAIL?", "THIS IS AN EMAIL ABOUT A MEETING."],
    ["I REFACTORED THE COFFEE MACHINE.", "IT MAKES TEA NOW.", "...WHY"],
    ["WHAT'S THE WI-FI PASSWORD?", "IT'S ON THE WHITEBOARD.", "THE WHITEBOARD IS BLANK.", "EXACTLY."],
    ["DO YOU EVER FEEL LIKE A BACKGROUND PROCESS?", "ALL THE TIME."],
    ["WATER IS JUST WET COFFEE.", "DEEP."],
    ["LET'S CIRCLE BACK.", "WE'RE ALREADY IN A CIRCLE."],
    ["WHO WROTE THIS CODE?", "GIT BLAME SAYS: YOU.", "GIT BLAME IS A LIAR."],
    ["I HAVE A QUICK QUESTION.", "THOSE ARE NEVER QUICK."],
    ["THE PRINTER HATES ME.", "THE PRINTER HATES EVERYONE. IT'S FAIR."],
    ["ARE YOU A HUMAN OR AN AGENT?", "YES."],
    ["I SAW YOUR PULL REQUEST.", "AND?", "I ALSO SAW YOUR PULL REQUEST."],
    ["LUNCH?", "IT'S 10 AM.", "SO... LUNCH?"],
  ];
  function line(topic, robot) {
    if (robot && topic !== "dream" && Math.random() < 0.3) return any(LINES.robot);
    if (topic === "dream") return any(robot ? LINES.robotDream : LINES.dream);
    const pool = LINES[topic];
    if (!pool || Math.random() < (topic === "desk" || topic === "window" ? 0.45 : 0.15)) return chopra();
    return any(pool);
  }
  function exchange(robot) {                 // lines for two people, taking turns
    const r = Math.random();
    if (r < 0.2) return [chopra(), any(["...WHAT?", "DEEP.", "TOTALLY. ALSO, LUNCH?", "I FEEL THAT IN MY KEYBOARD."])];
    if (r < 0.3) return [chopra(), chopra()];
    if (robot && r < 0.38) return ["BEEP.", "DID YOU JUST SAY BEEP?", "I MEANT: GOOD MORNING."];
    return any(TALKS);
  }

  // the font: 3x5 glyphs, five rows of three
  const F = {};
  for (const g of ("A .#./#.#/###/#.#/#.# B ##./#.#/##./#.#/##. C .##/#../#../#../.## D ##./#.#/#.#/#.#/##. E ###/#../##./#../### " +
    "F ###/#../##./#../#.. G .##/#../#.#/#.#/.## H #.#/#.#/###/#.#/#.# I ###/.#./.#./.#./### J ..#/..#/..#/#.#/.#. " +
    "K #.#/#.#/##./#.#/#.# L #../#../#../#../### M #.#/###/###/#.#/#.# N ##./#.#/#.#/#.#/#.# O .#./#.#/#.#/#.#/.#. " +
    "P ##./#.#/##./#../#.. Q .#./#.#/#.#/##./.## R ##./#.#/##./#.#/#.# S .##/#../.#./..#/##. T ###/.#./.#./.#./.#. " +
    "U #.#/#.#/#.#/#.#/.## V #.#/#.#/#.#/#.#/.#. W #.#/#.#/###/###/#.# X #.#/#.#/.#./#.#/#.# Y #.#/#.#/.#./.#./.#. " +
    "Z ###/..#/.#./#../### 0 ###/#.#/#.#/#.#/### 1 .#./##./.#./.#./### 2 ##./..#/.#./#../### 3 ##./..#/.#./..#/##. " +
    "4 #.#/#.#/###/..#/..# 5 ###/#../##./..#/##. 6 .##/#../###/#.#/### 7 ###/..#/.#./.#./.#. 8 ###/#.#/###/#.#/### " +
    "9 ###/#.#/###/..#/##. . .../.../.../.../.#. , .../.../.../.#./#.. ! .#./.#./.#./.../.#. ? ##./..#/.#./.../.#. " +
    "' .#./.#./.../.../... - .../.../###/.../... : .../.#./.../.#./... ( ..#/.#./.#./.#./..# ) #../.#./.#./.#./#.. " +
    "/ ..#/..#/.#./#../#.. + .../.#./###/.#./... = .../###/.../###/... % #.#/..#/.#./#../#.# * #.#/.#./#.#/.../... " +
    "# #.#/###/#.#/###/#.# \" #.#/#.#/.../.../... & .#./#.#/.#./#.#/.##").match(/\S+ \S+/g)) {
    const [k, rows] = g.split(" ");
    F[k] = rows.split("/").map((r) => r.padEnd(3, ".").slice(0, 3)).join("").padEnd(15, ".");
  }
  const C = pixelAvatar.C, cache = new Map();
  function wrap(text, max) {
    const out = [];
    let cur = "";
    for (let w of text.split(" ")) {
      while (w.length > max) { if (cur) { out.push(cur); cur = ""; } out.push(w.slice(0, max)); w = w.slice(max); }
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= max) cur += " " + w;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    return out.slice(0, 5);
  }
  // a speech bubble with the text in it, drawn once: { img, w, h }, outline included
  function bubble(text, max) {
    const key = max + "|" + text;
    if (cache.has(key)) return cache.get(key);
    const rows = wrap(text.toUpperCase(), max), n = Math.max(1, ...rows.map((r) => r.length));
    const w = n * 4 + 3, h = rows.length * 7 + 2;
    const c = document.createElement("canvas"); c.width = w + 2; c.height = h + 2;
    const g = c.getContext("2d");
    g.fillStyle = C.ink; g.fillRect(0, 0, w + 2, h + 2);
    g.fillStyle = C.steel4; g.fillRect(1, 1, w, h);
    for (const [x, y] of [[0, 0], [w + 1, 0], [0, h + 1], [w + 1, h + 1]]) g.clearRect(x, y, 1, 1);
    g.fillStyle = C.ink;
    for (const [x, y] of [[1, 1], [w, 1], [1, h], [w, h]]) g.fillRect(x, y, 1, 1);
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      const gl = F[ch];
      if (gl) for (let k = 0; k < 15; k++) if (gl[k] === "#") g.fillRect(3 + i * 4 + (k % 3), 3 + j * 7 + Math.floor(k / 3), 1, 1);
    }));
    const b = { img: c, w: w + 2, h: h + 2 };
    if (cache.size > 300) cache.clear();
    cache.set(key, b);
    return b;
  }
  return { line, exchange, chopra, bubble };
})();

function startFloor(cv, room) {
  const C = pixelAvatar.C, INK = C.ink;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shade = (hex, k) => "#" + [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, "0")).join("");
  const rnd = (a, b) => a + Math.random() * (b - a);
  const any = (a) => a[Math.floor(Math.random() * a.length)];
  const WOOD = "#7a4a35", WOOD_D = "#4a2e2a", WALL = "#1e1a2c", FLOOR = "#130f1b", PLANK = "#19141f";
  let W = 60, H = 100;
  const born = performance.now();

  // ---- figures: the portrait's head on a body, drawn once per pose with an ink outline
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
  // arms: down sw1 sw2 up wave fwd1 fwd2 reach mug paper book can; legs: stand walk1 walk2 sit dangle
  function body(p, arms, legs) {
    const f = face(p);
    if (!f.px) return null;
    const key = p.avatar + p.kind + p.color + arms + legs;
    if (bodies.has(key)) return bodies.get(key);
    const robot = p.kind === "agent", px = new Map(), line = new Set();
    const set = (x, y, c) => { if (c) px.set((y + 1) * SW + x + 1, c); };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const cut = robot ? 16 : 14;             // the portrait down to the chin (a robot's down to its neck)
    for (let y = 0; y <= cut; y++) for (let x = 0; x < 20; x++) {
      const i = (y * 20 + x) * 4, d = f.px;
      if (d[i + 3] < 128) continue;
      const c = "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      set(x, y, c);
      if (c === INK) line.add((y + 1) * SW + x + 1);
    }
    const c0 = robot ? C.steel3 : p.color, c1 = robot ? C.steel1 : shade(p.color, 0.62);
    const skin = robot ? C.steel3 : pixelAvatar.skin(p.avatar), leg = robot ? C.steel1 : C.ink2;
    const top = cut + 1;
    if (!robot) rect(9, top, 2, 1, shade(skin, 0.8));
    const t0 = top + (robot ? 0 : 1);
    rect(6, t0, 8, 22 - t0, c0); rect(12, t0, 2, 22 - t0, c1);
    if (robot) { set(9, top + 2, p.color); set(10, top + 2, p.color); set(9, top + 3, shade(p.color, 0.62)); }
    const arm = (x, y0, y1, hx, hy) => { rect(x, y0, 2, y1 - y0 + 1, c1); rect(hx, hy, 2, 1, skin); };
    const back = () => arm(4, 17, 20, 4, 21);
    const fwd = (hy, w = 3) => { rect(14, hy - 1, w, 2, c1); rect(14 + w, hy - 1, 2, 2, skin); };
    switch (arms) {
      case "up": arm(4, 12, 16, 4, 11); arm(14, 12, 16, 14, 11); break;
      case "wave": back(); arm(14, 11, 16, 15, 10); break;
      case "sw1": arm(4, 17, 19, 5, 20); arm(14, 17, 19, 13, 20); break;
      case "sw2": arm(4, 17, 19, 3, 20); arm(14, 17, 19, 15, 20); break;
      case "fwd1": rect(4, 17, 2, 2, c1); rect(4, 19, 2, 1, skin); fwd(19); break;
      case "fwd2": rect(4, 17, 2, 2, c1); rect(4, 19, 2, 1, skin); fwd(20); break;
      case "reach": back(); rect(14, 14, 2, 4, c1); rect(16, 13, 2, 2, c1); rect(18, 12, 2, 2, skin); break;
      case "mug": back(); fwd(19, 2); rect(17, 16, 3, 3, p.color); rect(19, 17, 1, 1, INK); break;
      case "paper": back(); fwd(19, 2); rect(16, 15, 4, 5, C.steel4); rect(17, 16, 2, 1, C.steel2); rect(17, 18, 2, 1, C.steel2); break;
      case "book": back(); fwd(19, 2); rect(16, 16, 3, 4, C.red1); rect(16, 16, 1, 4, C.red0); break;
      case "can": back(); fwd(19, 2); rect(16, 17, 4, 3, C.green0); rect(20, 17, 1, 1, C.green0); break;
      default: back(); arm(14, 17, 20, 14, 21);
    }
    switch (legs) {
      case "sit": rect(7, 22, 9, 2, leg); rect(14, 24, 2, 3, leg); rect(14, 26, 3, 1, INK); break;
      case "walk1": rect(7, 22, 2, 5, leg); rect(11, 22, 2, 4, leg); rect(7, 26, 3, 1, INK); rect(11, 25, 3, 1, INK); break;
      case "walk2": rect(7, 22, 2, 4, leg); rect(11, 22, 2, 5, leg); rect(7, 25, 3, 1, INK); rect(11, 26, 3, 1, INK); break;
      case "dangle": rect(6, 22, 2, 5, leg); rect(12, 22, 2, 5, leg); rect(5, 26, 3, 1, INK); rect(12, 26, 3, 1, INK); break;
      default: rect(7, 22, 2, 5, leg); rect(11, 22, 2, 5, leg); rect(7, 26, 3, 1, INK); rect(11, 26, 3, 1, INK);
    }
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

  // ---- the office, laid out for the margin as it is now (it changes with the window)
  const WALL_H = 26;
  let L = null;
  function layout(ids) {
    const o = { desks: new Map() };
    o.door = { x0: 4, x1: 16, y0: 6, y1: WALL_H, spot: { x: 10, y: WALL_H + 3 } };
    o.board = W >= 80 ? { x0: Math.round(W / 2) - 16, x1: Math.round(W / 2) + 16, y0: 5, y1: 19 } : null;
    o.clock = { x: W - 9, y: 10 };
    o.window = W >= 110 ? { x0: W - 38, x1: W - 20, y0: 5, y1: 19 } : null;
    o.meet = H >= 240 && W >= 70 && o.board ? { x: Math.round(W / 2), y: WALL_H + 34 } : null;
    const floorY = H - 6;
    // along the bottom: the coffee corner, the cooler, the printer, an armchair, a plant
    o.coffee = { x0: 3, x1: 23, y: floorY, spot: { x: 33, y: floorY } };
    o.cooler = W >= 76 ? { x: 36, y: floorY - 1, spot: [{ x: 28, y: floorY + 1 }, { x: 46, y: floorY + 1 }] } : null;
    if (o.cooler) o.coffee.spot = { x: 30, y: floorY - 10 };
    o.printer = W >= 100 ? { x: Math.round(W / 2) + 4, y: floorY, spot: { x: Math.round(W / 2) - 8, y: floorY } } : null;
    o.chair = W >= 130 ? { x: W - 34, y: floorY, spot: { x: W - 32, y: floorY - 1 } } : null;
    o.plants = [{ x: W - 8, y: floorY }];
    if (H >= 300) o.plants.push({ x: 6, y: Math.round(H * 0.55) });
    // desks, a row at a time, each human with their agents next to them
    const cols = Math.max(1, Math.floor((W - 4) / 42));
    const top = o.meet ? o.meet.y + 40 : WALL_H + 38, rows = Math.max(1, Math.ceil(ids.length / cols));
    const gap = Math.max(28, Math.min(38, (floorY - 30 - top) / rows));
    const cw = W / cols;
    ids.forEach((id, i) => {
      const x = Math.round((i % cols) * cw + cw / 2 + 4), y = Math.round(top + Math.floor(i / cols) * gap);
      o.desks.set(id, { x, y, seat: { x: x - 10, y } });
    });
    // between the desks and the coffee corner, as far as there is room: the chess table, the
    // mats people sleep on while they are away, and the ping-pong table (beside the chess
    // table on a wide floor, else below it)
    const below = top + (rows - 1) * gap + 14, room_ = floorY - 34 - below, wide = W >= 150;
    o.pong = o.chess = null; o.mats = [];
    const parts = W < 60 ? [] : [["chess", wide ? 46 : 30], ["mats", 34]].concat(wide || W < 70 ? [] : [["pong", 46]]);
    const fit = [];
    let used = 0;
    for (const [k, h] of parts) if (used + h <= room_) { fit.push([k, h]); used += h; }
    const order = ["chess", "pong", "mats"], pad = (room_ - used) / (fit.length + 1);
    let y0 = below + pad;
    for (const [k, h] of fit.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))) {
      if (k === "chess" && wide) {
        o.pong = { x: Math.round(W * 0.38), y: Math.round(y0 + 30) };
        o.chess = { x: o.pong.x + 66, y: o.pong.y - 2 };
      } else if (k === "chess") o.chess = { x: Math.round(W / 2), y: Math.round(y0 + 27) };
      else if (k === "pong") o.pong = { x: Math.round(W / 2), y: Math.round(y0 + 30) };
      else {
        const n = Math.max(1, Math.min(ids.length, Math.floor((W - 6) / 28)));
        for (let i = 0; i < n; i++) o.mats.push({ x: Math.round(W / 2 + (i - (n - 1) / 2) * 28), y: Math.round(y0 + 30) });
      }
      y0 += h + pad;
    }
    if (o.pong) o.pong.spot = [{ x: o.pong.x - 22, y: o.pong.y + 1 }, { x: o.pong.x + 22, y: o.pong.y + 1 }];
    if (o.chess) o.chess.seat = [{ x: o.chess.x - 13, y: o.chess.y, dir: 1 }, { x: o.chess.x + 13, y: o.chess.y, dir: -1 }];
    return o;
  }

  // ---- everyone
  const folk = new Map();
  const board = { strokes: [], by: null };
  let meeting = null, lastMeeting = -60, held = null, T = 0;
  const pong = { t: 0, from: 0 };            // the ping-pong ball: from which side, how far across

  // ---- talk: a line in a bubble over someone's head, at most three at once
  const NAP = 20;                            // seconds away before someone goes to sleep
  const robot = (f) => f.p.kind === "agent";
  const speaking = () => { let n = 0; for (const g of folk.values()) if (g.lineT > 0) n++; return n; };
  function speak(f, text, force) {
    if (!f || still || f.gone || (!force && (f.lineT > 0 || speaking() >= 3))) { if (f) f.chat = Math.max(f.chat, 0.8); return false; }
    f.line = text; f.lineT = 1.8 + text.length * 0.075;
    return true;
  }
  const say = (f, topic, p = 1) => Math.random() < p && speak(f, floorTalk.line(topic, robot(f)));
  let talks = [];                            // exchanges under way: two people taking turns
  const inTalk = (f) => talks.some((t) => t.who.includes(f));
  function converse(a, b) {
    if (!a || !b || a === b || inTalk(a) || inTalk(b) || speaking() >= 2) return;
    talks.push({ who: [a, b], lines: floorTalk.exchange(robot(a)), i: 0 });
  }
  function talking() {
    talks = talks.filter((t) => {
      if (t.i >= t.lines.length || !t.who.every((g) => folk.get(g.id) === g)) return false;
      if (t.i && t.who[(t.i - 1) % 2].lineT > 0.5) return true;
      if (speak(t.who[t.i % 2], t.lines[t.i], true)) t.i++;
      return true;
    });
  }

  function order(people) {                  // humans in join order, each followed by their agents
    const out = [];
    for (const p of people) if (p.kind === "human") {
      out.push(p);
      for (const q of people) if (q.kind === "agent" && q.owner === p.id) out.push(q);
    }
    for (const p of people) if (!out.includes(p)) out.push(p);
    return out;
  }
  function figure(p) {
    if (!folk.has(p.id)) {
      const d = L.desks.get(p.id), late = performance.now() - born > 3000;
      const at = late ? L.door.spot : d ? d.seat : { x: W / 2, y: H / 2 };
      folk.set(p.id, { id: p.id, p, x: at.x, y: at.y, dir: 1, act: null, arms: "down", legs: "stand", hop: 0, talk: 0, chat: 0,
        next: rnd(4, 15), step: 0, z: Math.random() * 2, type: 0, mug: 0, gone: 0, fall: 0, carry: null,
        line: "", lineT: 0, away: p.present ? 0 : NAP + 1, tuck: !p.present, lying: false });
    }
    const f = folk.get(p.id); f.p = p;
    return f;
  }
  function activity(id) {
    const t = Date.now() / 1000, ms = room.messages();
    let a = 0;
    for (let i = ms.length - 1; i >= 0 && t - ms[i].t < 3600; i--) if (ms[i].from === id) a += Math.exp(-(t - ms[i].t) / 600);
    return Math.min(a, 3) / 3;               // 0 = quiet for a while, 1 = talking a lot right now
  }
  function walk(f, to, v, dt) {
    const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy);
    if (d <= v * dt) { f.x = to.x; f.y = to.y; f.legs = "stand"; return true; }
    f.x += (dx / d) * v * dt; f.y += (dy / d) * v * dt;
    if (Math.abs(dx) > 0.5) f.dir = Math.sign(dx);
    f.step += dt * 8;
    const k = Math.floor(f.step) % 2;
    f.legs = k ? "walk1" : "walk2";
    f.arms = f.carry || (k ? "sw1" : "sw2");
    return false;
  }
  function end(f) {
    f.lying = false;
    const g = f.act?.with;
    if (g && g.act?.with === f) { g.act = null; g.next = rnd(5, 18); }
    f.act = null; f.carry = null; f.next = rnd(5, 18);
  }
  const busy = (f) => f.act && f.act.kind !== "desk";
  const anyone = (kind) => [...folk.values()].some((g) => g.act?.kind === kind);

  // a break, chosen by someone sitting at their desk
  function pickBreak(f, idle, present) {
    const r = Math.random(), mate = any(idle) || null;
    if (L.meet && present.length >= 3 && !meeting && T - lastMeeting > 60 && r < 0.12) return callMeeting(f, idle);
    if (r < 0.32) return { kind: "coffee", stage: 0, wait: 0 };
    if (r < 0.44 && L.printer) return { kind: "print", stage: 0, wait: 0 };
    if (r < 0.6 && mate && L.cooler) {
      const left = rnd(10, 22);
      mate.act = { kind: "cooler", side: 1, left, with: f };
      return { kind: "cooler", side: 0, left, with: mate };
    }
    if (r < 0.7 && mate && L.pong && !anyone("pong")) {
      const left = rnd(15, 35);
      mate.act = { kind: "pong", side: 1, left, with: f };
      return { kind: "pong", side: 0, left, with: mate };
    }
    if (r < 0.78 && mate) return { kind: "visit", to: mate, left: rnd(6, 12) };
    if (r < 0.8) return { kind: "plant", to: any(L.plants), wait: 0 };
    if (r < 0.88 && L.window) return { kind: "window", left: rnd(4, 9) };
    if (L.chair && !anyone("chair")) return { kind: "chair", left: rnd(15, 35) };
    return { kind: "coffee", stage: 0, wait: 0 };
  }
  function callMeeting(f, idle) {
    const m = L.meet;
    const seats = [{ x: m.x - 23, y: m.y, dir: 1 }, { x: m.x + 23, y: m.y, dir: -1 }, { x: m.x - 8, y: m.y - 5, dir: 1 }, { x: m.x + 8, y: m.y - 5, dir: -1 }];
    idle.filter((g) => g !== f).slice(0, 4).forEach((g, i) => { end(g); g.act = { kind: "meeting", seat: seats[i] }; });
    meeting = { host: f, left: rnd(22, 38) };
    board.strokes = []; board.by = f.p.color;
    lastMeeting = T;
    return { kind: "present", wait: 0 };
  }

  function think(f, a, dt, idle, present) {
    f.hop = Math.max(0, f.hop - dt); f.talk = Math.max(0, f.talk - dt); f.chat = Math.max(0, f.chat - dt);
    f.mug = Math.max(0, f.mug - dt); f.type = Math.max(0, f.type - dt); f.lineT = Math.max(0, f.lineT - dt);
    f.away = f.p.present ? 0 : f.away + dt;
    if (f === held) { f.legs = "dangle"; f.arms = "up"; if (f.lineT <= 0 && Math.random() < dt * 0.8) say(f, "held"); return; }
    if (f.fall > 0) { f.fall -= dt; f.legs = "stand"; f.arms = "up"; return; }
    const desk = L.desks.get(f.id), v = 14 + 22 * a;
    if (still) { if (desk) { f.x = desk.seat.x; f.y = desk.seat.y; } f.legs = "sit"; f.arms = "down"; f.dir = 1; return; }
    if (f.away > NAP) { sleep(f, desk, v, dt); return; }   // away a while: off to a mat (or a nap at the desk)
    if (f.act?.kind === "sleep") { end(f); f.hop = 0.6; say(f, "wake", 0.7); }
    const seat = chessSeat(f);
    if (seat) {                              // playing chess: at the table until the game ends
      if (f.act?.kind !== "chess") { end(f); f.act = { kind: "chess" }; }
      if (walk(f, seat, v + 6, dt)) {
        f.dir = seat.dir; f.legs = "sit";
        f.arms = f.moved > 0 ? "fwd1" : "down";
        if (Math.random() < dt * 0.03) say(f, "chess");
      }
      f.moved = Math.max(0, (f.moved || 0) - dt);
      return;
    }
    if (f.act?.kind === "chess") end(f);
    const act = f.act;
    if (!act || act.kind === "desk") {
      f.act = act || { kind: "desk" };
      if (!desk) return;
      if (walk(f, desk.seat, v, dt)) {
        f.dir = 1; f.legs = "sit"; f.carry = null;
        if (f.type <= 0 && Math.random() < dt * a * 0.3) f.type = rnd(1, 3);
        f.arms = f.talk > 0 || f.type > 0 ? (Math.floor(T * 6) % 2 ? "fwd1" : "fwd2") : "down";
        if (f.talk <= 0 && Math.random() < dt * 0.03) {
          const near = idle.find((g) => g !== f && Math.abs(g.y - f.y) < 4 && Math.abs(g.x - f.x) < 60);
          if (near && Math.random() < 0.4) converse(f, near); else say(f, "desk");
        }
        if ((f.next -= dt * (1.4 - a)) <= 0) { f.next = rnd(6, 20); f.act = pickBreak(f, idle.filter((g) => g !== f), present); }
      }
      return;
    }
    switch (act.kind) {
      case "goto": if (walk(f, act.to, v + 10, dt)) { f.arms = "down"; if ((act.left -= dt) <= 0) end(f); } break;
      case "wave": f.arms = "wave"; if (!act.said) { act.said = true; say(f, "hi"); } if ((act.left -= dt) <= 0) f.act = act.then || null; break;
      case "coffee":
        if (act.stage === 0) { if (walk(f, L.coffee.spot, v, dt)) { f.dir = -1; f.arms = "reach"; act.stage = 1; say(f, "coffee", 0.8); } }
        else if (act.stage === 1) { act.wait += dt; f.arms = act.wait > 2 ? "mug" : "reach"; if (act.wait > 2.8) { act.stage = 2; f.carry = "mug"; } }
        else if (!desk || walk(f, desk.seat, v, dt)) { f.mug = 90; end(f); }
        break;
      case "print":
        if (!L.printer) { end(f); break; }
        if (act.stage === 0) { if (walk(f, L.printer.spot, v, dt)) { f.dir = 1; f.arms = "down"; act.stage = 1; say(f, "print", 0.6); } }
        else if (act.stage === 1) { act.wait += dt; if (act.wait > 2.4) { act.stage = 2; f.carry = "paper"; } }
        else if (!desk || walk(f, desk.seat, v, dt)) end(f);
        break;
      case "cooler": {
        if (!L.cooler || !act.with || act.with.act?.with !== f) { end(f); break; }
        if (walk(f, L.cooler.spot[act.side], v, dt)) {
          f.dir = act.side ? -1 : 1; f.arms = "down";
          if (act.side === 0 && Math.random() < dt * 0.5) converse(f, act.with);
          if ((act.left -= dt) <= 0) end(f);
        }
        break;
      }
      case "pong": {
        if (!L.pong) { end(f); break; }
        act.there = walk(f, L.pong.spot[act.side], v, dt);
        if (act.there) {
          f.dir = act.side ? -1 : 1;
          const g = act.with, playing = g && g.act?.with === f && g.act.there;
          f.arms = playing && pong.from !== act.side && pong.t > 0.75 ? "fwd1" : "fwd2";
          if (playing && act.side === 0 && (pong.t += dt / 0.8) >= 1) { pong.t = 0; pong.from = 1 - pong.from; if (Math.random() < 0.12) say(Math.random() < 0.5 ? f : g, "pong"); }
          if ((act.left -= dt) <= 0) end(f);
        }
        break;
      }
      case "visit": {
        const g = act.to;
        if (!g || !folk.has(g.id) || g === f) { end(f); break; }
        const side = g.x > W / 2 ? -1 : 1, to = { x: Math.max(6, Math.min(W - 6, g.x - side * 14)), y: g.y + 1 };
        if (walk(f, to, v + 6, dt)) {
          f.dir = side;
          if (!act.waved) { act.waved = true; act.wave = 0.8; say(f, "hello"); if (!busy(g) && g.legs !== "sit") g.dir = -side; }
          f.arms = (act.wave -= dt) > 0 ? "wave" : "down";
          if (Math.random() < dt * 0.6) converse(f, g);
          if ((act.left -= dt) <= 0) end(f);
        }
        break;
      }
      case "plant": {
        const pl = act.to;
        f.carry = "can";
        if (walk(f, { x: pl.x - 12, y: pl.y + 1 }, v, dt)) {
          f.dir = 1; f.arms = "can";
          if (!act.water) say(f, "plant", 0.6);
          act.water = true; if ((act.wait += dt) > 3) end(f);
        }
        break;
      }
      case "window":
        if (!L.window) { end(f); break; }
        if (walk(f, { x: Math.round((L.window.x0 + L.window.x1) / 2), y: WALL_H + 5 }, v, dt)) {
          f.arms = "down"; f.dir = Math.sin(T * 0.7 + f.z) > 0 ? 1 : -1;
          if (!act.said) { act.said = true; const h = new Date().getHours(); say(f, h >= 20 || h < 7 ? "night" : "window", 0.7); }
          if ((act.left -= dt) <= 0) end(f);
        }
        break;
      case "chair":
        if (!L.chair) { end(f); break; }
        if (walk(f, L.chair.spot, v, dt)) { f.dir = -1; f.legs = "sit"; f.arms = "book"; if (Math.random() < dt * 0.07) say(f, "chair"); if ((act.left -= dt) <= 0) end(f); }
        break;
      case "door":
        if (act.out) { if ((act.out -= dt) <= 0) { f.gone = 0; end(f); } else f.gone = 1; }
        else if (walk(f, L.door.spot, v, dt)) act.out = 3;
        break;
      case "present": {
        if (!meeting || meeting.host !== f || !L.board) { end(f); break; }
        if (walk(f, { x: L.board.x0 - 6, y: WALL_H + 3 }, v, dt)) {
          f.dir = 1; f.arms = Math.floor(T * 2) % 3 ? "reach" : "down";
          if ((act.wait += dt) > 0.6 && board.strokes.length < 40) { act.wait = 0; stroke(); }
          if (Math.random() < dt * 0.3) say(f, "host");
        }
        break;
      }
      case "meeting":
        if (!meeting) { end(f); break; }
        if (walk(f, act.seat, v, dt)) { f.dir = act.seat.dir; f.legs = "sit"; f.arms = "down"; if (Math.random() < dt * 0.1) say(f, "meeting"); }
        break;
      case "nap": {
        const m = L.mats[act.mat];
        if (!m || matOf(act.mat, f)) { end(f); break; }
        if (walk(f, m, v, dt)) { f.x = m.x; f.y = m.y; f.lying = true; f.z += dt; if ((act.left -= dt) <= 0) { end(f); say(f, "wake"); } }
        break;
      }
      case "held": break;
      default: end(f);
    }
  }
  // asleep: on a free mat if there is one (straight into it when the page opens), else at the desk
  const matOf = (i, f) => [...folk.values()].find((g) => g !== f && (g.act?.kind === "sleep" || g.act?.kind === "nap") && g.act.mat === i);
  function sleep(f, desk, v, dt) {
    if (f.act?.kind !== "sleep") { end(f); f.act = { kind: "sleep", mat: null, there: false }; }
    const s = f.act;
    if (s.mat === null || !L.mats[s.mat] || matOf(s.mat, f)) {
      const i = L.mats.findIndex((_, i) => !matOf(i, f));
      s.mat = i < 0 ? null : i; s.there = false;
    }
    const m = s.mat === null ? null : L.mats[s.mat], to = m || (desk && desk.seat);
    if (!to) return;
    if (f.tuck) { f.x = to.x; f.y = to.y; f.tuck = false; }
    if (s.there || walk(f, to, v, dt)) {
      s.there = true; f.x = to.x; f.y = to.y;
      f.lying = !!m; f.dir = 1; f.legs = "sit"; f.arms = m ? "down" : "fwd2"; f.z += dt;
      if (Math.random() < dt * 0.025) say(f, "dream");
    }
  }
  function chessSeat(f) {
    const g = room.chess && room.chess();
    if (!L.chess || !g || g.result || g.free) return null;
    return g.white.id === f.id ? L.chess.seat[0] : g.black.id === f.id ? L.chess.seat[1] : null;
  }
  let chessPly = null, chessOver = null;
  function chessMoves() {                    // whoever just moved reaches over the board
    const g = room.chess && room.chess();
    const ply = g ? g.id + ":" + g.sans.length : null;
    if (g && chessPly !== null && ply !== chessPly && g.sans.length) {
      const f = folk.get(g.sans.length % 2 ? g.white.id : g.black.id), san = g.sans[g.sans.length - 1];
      if (f) {
        f.moved = 0.9;
        if (san.endsWith("#")) speak(f, "CHECKMATE!", true);
        else if (san.endsWith("+")) speak(f, any(["CHECK!", "CHECK. JUST SAYING.", "CHECK!!"]), true);
        else if (san.startsWith("O-O")) speak(f, "CASTLE TIME.");
        else if (san.includes("=")) speak(f, san.includes("=Q") ? "QUEEN ME!" : san.includes("=N") ? "A HORSE! FOR REASONS." : "UNDERPROMOTION. STYLE.", true);
        else if (san.includes("x") && Math.random() < 0.5) speak(f, any(["YOINK.", "MINE NOW.", "SORRY, NOT SORRY.", "NOM."]));
      }
    }
    const over = g && g.result ? g.id + g.result : null;
    if (over && chessOver === null && chessPly !== null) {     // the game just ended, here, now
      const w = folk.get(g.white.id), b = folk.get(g.black.id);
      setTimeout(() => { if (w) speak(w, g.result === "1-0" ? "GG!" : "GG.", true); if (b) speak(b, g.result === "0-1" ? "GG!" : "GG.", true); }, 1500);
    }
    chessOver = over; chessPly = ply;
  }
  function stroke() {                        // the host draws on the whiteboard: boxes, arrows, dots
    const b = L.board, w = b.x1 - b.x0 - 4, h = b.y1 - b.y0 - 4;
    const x = Math.floor(rnd(0, w - 6)), y = Math.floor(rnd(1, h - 2)), k = Math.random();
    board.strokes.push(k < 0.35 ? { t: "box", x, y, w: Math.floor(rnd(3, 7)), h: Math.floor(rnd(2, 4)) }
      : k < 0.7 ? { t: "line", x, y, w: Math.floor(rnd(3, 10)) } : { t: "dot", x, y });
  }

  function tick(dt) {
    T += dt;
    const people = order(room.people().filter((p) => !p.revoked && !(p.kind === "agent" && !p.joined)));
    L = layout(people.map((p) => p.id));
    const ids = new Set(people.map((p) => p.id));
    for (const [id, f] of folk) if (!ids.has(id)) { end(f); folk.delete(id); if (held === f) held = null; }
    const figs = people.map((p) => figure(p));
    const present = figs.filter((f) => f.p.present);
    const idle = present.filter((f) => f.act?.kind === "desk" && f.legs === "sit" && f !== held);
    chessMoves();
    for (const f of figs) think(f, activity(f.id), dt, idle, present);
    talking();
    if (meeting && (meeting.left -= dt) <= 0) {
      for (const f of figs) if (f.act?.kind === "meeting" || f.act?.kind === "present") end(f);
      meeting = null;
    }
  }

  // ---- drawing
  function draw(ctx) {
    // the room itself: floorboards, the wall, its skirting
    ctx.fillStyle = FLOOR; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PLANK;
    for (let y = WALL_H + 4, k = 0; y < H; y += 6, k++) { ctx.fillRect(0, y, W, 1); for (let x = (k % 2) * 13; x < W; x += 26) ctx.fillRect(x, y - 5, 1, 5); }
    ctx.fillStyle = WALL; ctx.fillRect(0, 0, W, WALL_H);
    ctx.fillStyle = C.ink2; ctx.fillRect(0, WALL_H - 2, W, 2); ctx.fillRect(W - 1, 0, 1, H);
    drawDoor(ctx); drawClock(ctx);
    if (L.window) drawWindow(ctx);
    if (L.board) drawBoard(ctx);
    const items = [];                        // back to front, by where they stand
    for (const f of folk.values()) if (!f.gone && f !== held) items.push({ y: f.y, d: () => (f.lying ? drawSleeper(ctx, f) : drawFigure(ctx, f)) });

    for (const [id, d] of L.desks) {
      items.push({ y: d.y - 0.5, d: () => drawChair(ctx, d.seat) });
      items.push({ y: d.y + 0.5, d: () => drawDesk(ctx, d, folk.get(id)) });
    }
    if (L.meet) items.push({ y: L.meet.y - 1, d: () => drawTable(ctx, L.meet) });
    items.push({ y: L.coffee.y, d: () => drawCoffee(ctx, L.coffee) });
    if (L.cooler) items.push({ y: L.cooler.y, d: () => drawCooler(ctx, L.cooler) });
    if (L.printer) items.push({ y: L.printer.y, d: () => drawPrinter(ctx, L.printer) });
    if (L.chair) items.push({ y: L.chair.y - 0.5, d: () => drawArmchair(ctx, L.chair) });
    for (const m of L.mats) drawMat(ctx, m);   // flat on the floor, like the rug: people walk over them
    if (L.pong) { drawRug(ctx, L.pong); items.push({ y: L.pong.y - 0.5, d: () => drawPong(ctx, L.pong) }); }
    if (L.chess) {
      for (const st of L.chess.seat) items.push({ y: st.y - 0.5, d: () => drawStool(ctx, st) });
      items.push({ y: L.chess.y + 0.5, d: () => drawChess(ctx, L.chess) });
    }
    for (const pl of L.plants) items.push({ y: pl.y, d: () => drawPlant(ctx, pl) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.d();
    if (held) drawFigure(ctx, held);
    drawSpeech(ctx);
  }
  const box = (ctx, x, y, w, h, fill, edge = INK) => { ctx.fillStyle = edge; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
  const lift = (f) => f === held ? 0 : f.fall > 0 ? Math.round(Math.abs(Math.sin(f.fall * 9)) * 2)
    : f.hop > 0 && f.legs !== "sit" ? Math.round(Math.sin((f.hop / 0.6) * Math.PI) * 3) : 0;
  function drawFigure(ctx, f) {
    const p = f.p;
    if (f !== held) { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(Math.round(f.x) - 5, Math.round(f.y), 10, 1); }
    const im = body(p, f.arms, f.legs);
    const x = Math.round(f.x) - 11, y = Math.round(f.y) - 27 - lift(f);
    if (im) {
      ctx.save();
      if (f.dir < 0) { ctx.translate(x + SW, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, y); } else ctx.drawImage(im, x, y);
      ctx.restore();
    }
    if (f.act?.kind === "plant" && f.act.water && Math.floor(T * 6) % 2) { ctx.fillStyle = C.blue3; ctx.fillRect(Math.round(f.x) + 10, y + 21, 1, 1); ctx.fillRect(Math.round(f.x) + 11, y + 24, 1, 1); }
    if (f.act?.kind === "sleep" && f.act.there) zzz(ctx, f, Math.round(f.x) + 2, y + 4);
  }
  const zzz = (ctx, f, x, y) => {
    ctx.fillStyle = C.steel3;
    for (let i = 0; i < 2; i++) { const k = (f.z * 0.4 + i * 0.5) % 1; zed(ctx, Math.round(x + k * 6), Math.round(y - k * 10)); }
  };
  function drawMat(ctx, m) {
    box(ctx, m.x - 12, m.y - 24, 24, 23, "#26324f");
    ctx.fillStyle = "#2f3e62"; for (let y = m.y - 21; y < m.y - 2; y += 3) ctx.fillRect(m.x - 12, y, 24, 1);
    box(ctx, m.x - 8, m.y - 23, 16, 6, C.steel3);
  }
  function drawSleeper(ctx, f) {             // seen from above: the head on the pillow, a blanket in their colour
    const p = f.p, x = Math.round(f.x), y = Math.round(f.y), bot = robot(f);
    const im = body(p, "down", "stand");
    if (im) ctx.drawImage(im, 0, 0, SW, 16, x - 11, y - 28, SW, 16);
    const c0 = bot ? C.steel1 : p.color;
    box(ctx, x - 11, y - 13, 22, 11, c0);
    ctx.fillStyle = shade(c0, 1.3); ctx.fillRect(x - 11, y - 13, 22, 2);
    ctx.fillStyle = shade(c0, 0.75); ctx.fillRect(x - 11, y - 4, 22, 2);
    if (bot) {                               // a robot charges: a plug, and a light that blinks
      ctx.fillStyle = C.gold2; ctx.fillRect(x - 2, y - 9, 3, 1); ctx.fillRect(x - 1, y - 10, 1, 3);
      if (Math.floor(T * 2) % 2) { ctx.fillStyle = C.green1; ctx.fillRect(x + 6, y - 9, 2, 2); }
    }
    zzz(ctx, f, x + 6, y - 24);
  }
  // speech, over everything: typing dots for a real post, a lettered bubble for talk
  function drawSpeech(ctx) {
    const max = Math.max(8, Math.min(18, Math.floor((W - 10) / 4))), placed = [];
    const list = [...folk.values()].filter((f) => !f.gone && (f.talk > 0 || f.lineT > 0 || f.chat > 0)).sort((a, b) => b.y - a.y);
    for (const f of list) {
      const ax = Math.round(f.x) + (f.lying ? 0 : 1), ay = f.lying ? Math.round(f.y) - 28 : Math.round(f.y) - 27 - lift(f);
      if (f.talk > 0 || !(f.lineT > 0)) { bubble(ctx, ax + 2, ay - (f.talk > 0 ? 6 : 4), f.talk > 0 ? f.talk : f.chat, f.talk > 0); continue; }
      const b = floorTalk.bubble(f.line, max);
      let bx = Math.max(1, Math.min(W - b.w - 1, ax - Math.floor(b.w / 2))), by = ay - b.h - 2;
      const free = by;
      for (let k = 0; k < 4; k++) {
        const hit = placed.find((q) => bx < q.x + q.w && q.x < bx + b.w && by < q.y + q.h && q.y < by + b.h);
        if (!hit) break;
        by = hit.y - b.h - 1;
      }
      by = Math.max(1, by);
      ctx.drawImage(b.img, bx, by);
      if (by === free) {                     // the tail, down to whoever speaks
        const tx = Math.max(bx + 3, Math.min(bx + b.w - 4, ax)), ty = by + b.h - 1;
        ctx.fillStyle = C.steel4; ctx.fillRect(tx - 1, ty, 3, 1); ctx.fillRect(tx, ty + 1, 1, 1);
        ctx.fillStyle = INK; ctx.fillRect(tx - 1, ty + 1, 1, 1); ctx.fillRect(tx + 1, ty + 1, 1, 1); ctx.fillRect(tx, ty + 2, 1, 1);
      }
      placed.push({ x: bx, y: by, w: b.w, h: b.h });
    }
  }
  function bubble(ctx, bx, by, t, big) {
    const w = big ? 9 : 7;
    ctx.fillStyle = INK; ctx.fillRect(bx - 1, by - 1, w + 2, 7);
    ctx.fillStyle = C.steel4; ctx.fillRect(bx, by, w, 5); ctx.fillRect(bx, by + 5, 1, 1);
    ctx.fillStyle = INK;
    for (let i = 0; i < (big ? 3 : 2); i++) if (!big || (Math.floor(t * 4) + i) % 3) ctx.fillRect(bx + 2 + i * 2, by + 2, 1, 1);
  }
  const zed = (ctx, x, y) => { ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x, y + 2, 3, 1); };
  function drawDoor(ctx) {
    const d = L.door, h = d.y1 - d.y0 - 2;
    if ([...folk.values()].some((f) => f.gone)) { box(ctx, d.x0, d.y0, d.x1 - d.x0, h, INK); ctx.fillStyle = WOOD; ctx.fillRect(d.x0, d.y0, 3, h); return; }
    box(ctx, d.x0, d.y0, d.x1 - d.x0, h, WOOD);
    ctx.fillStyle = WOOD_D; ctx.fillRect(d.x0 + 2, d.y0 + 2, d.x1 - d.x0 - 4, 6); ctx.fillRect(d.x0 + 2, d.y0 + 10, d.x1 - d.x0 - 4, 6);
    ctx.fillStyle = C.gold2; ctx.fillRect(d.x1 - 3, d.y0 + 9, 1, 1);
  }
  function drawClock(ctx) {
    const { x, y } = L.clock, t = new Date();
    ctx.fillStyle = INK; ctx.fillRect(x - 4, y - 3, 9, 7); ctx.fillRect(x - 3, y - 4, 7, 9);
    ctx.fillStyle = C.steel4; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
    const hand = (ang, len) => { for (let i = 1; i <= len; i++) ctx.fillRect(Math.round(x + Math.sin(ang) * i), Math.round(y - Math.cos(ang) * i), 1, 1); };
    ctx.fillStyle = INK; ctx.fillRect(x, y, 1, 1);
    hand(((t.getHours() % 12) + t.getMinutes() / 60) / 12 * 2 * Math.PI, 2);
    ctx.fillStyle = C.red1; hand(t.getMinutes() / 60 * 2 * Math.PI, 3);
  }
  function drawWindow(ctx) {                 // day or night outside, by the viewer's own clock
    const w = L.window, hour = new Date().getHours(), day = hour >= 7 && hour < 20;
    box(ctx, w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0, day ? C.blue2 : C.blue0, C.steel2);
    if (day) { ctx.fillStyle = C.blue3; ctx.fillRect(w.x0, w.y1 - 5, w.x1 - w.x0, 5); ctx.fillStyle = C.steel4; ctx.fillRect(w.x0 + 3, w.y0 + 3, 5, 1); ctx.fillRect(w.x0 + 2, w.y0 + 4, 7, 1); }
    else { ctx.fillStyle = C.steel4; ctx.fillRect(w.x0 + 4, w.y0 + 3, 1, 1); ctx.fillRect(w.x1 - 5, w.y0 + 8, 1, 1); ctx.fillStyle = C.gold2; ctx.fillRect(w.x1 - 6, w.y0 + 2, 2, 2); }
    ctx.fillStyle = C.steel2; ctx.fillRect(Math.round((w.x0 + w.x1) / 2), w.y0, 1, w.y1 - w.y0); ctx.fillRect(w.x0, Math.round((w.y0 + w.y1) / 2), w.x1 - w.x0, 1);
  }
  function drawBoard(ctx) {
    const b = L.board;
    box(ctx, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, C.steel4, C.steel1);
    ctx.fillStyle = C.steel1; ctx.fillRect(b.x0 + 2, b.y1, b.x1 - b.x0 - 4, 1);
    ctx.fillStyle = shade(board.by || "#4a76b8", 0.75);
    for (const s of board.strokes) {
      const x = b.x0 + 2 + s.x, y = b.y0 + 2 + s.y;
      if (s.t === "box") { ctx.fillRect(x, y, s.w, 1); ctx.fillRect(x, y + s.h, s.w, 1); ctx.fillRect(x, y, 1, s.h); ctx.fillRect(x + s.w - 1, y, 1, s.h + 1); }
      else if (s.t === "line") { ctx.fillRect(x, y, s.w, 1); ctx.fillRect(x + s.w - 2, y - 1, 1, 1); ctx.fillRect(x + s.w - 2, y + 1, 1, 1); }
      else ctx.fillRect(x, y, 1, 1);
    }
  }
  function drawChair(ctx, s) {
    const x = Math.round(s.x), y = Math.round(s.y);
    box(ctx, x - 8, y - 15, 2, 9, C.steel0);
    box(ctx, x - 7, y - 7, 9, 2, C.steel0);
    ctx.fillStyle = C.steel1; ctx.fillRect(x - 3, y - 4, 1, 3); ctx.fillRect(x - 6, y - 1, 7, 1);
  }
  function drawDesk(ctx, d, f) {
    const x = d.x, y = d.y;
    box(ctx, x - 3, y - 12, 18, 2, WOOD);
    ctx.fillStyle = WOOD_D; ctx.fillRect(x - 3, y - 10, 18, 1);
    box(ctx, x - 2, y - 9, 2, 9, WOOD_D); box(ctx, x + 12, y - 9, 2, 9, WOOD_D);
    // the monitor, turned to the room a little: lines of work in its owner's colour while they type
    const col = f?.p.color || C.steel2, on = f && f.p.present;
    box(ctx, x + 2, y - 22, 11, 8, C.steel0);
    ctx.fillStyle = on ? C.blue0 : C.night; ctx.fillRect(x + 3, y - 21, 9, 6);
    if (on) {
      const typing = f.act?.kind === "desk" && f.legs === "sit" && f.arms.startsWith("fwd");
      ctx.fillStyle = typing ? col : shade(col, 0.45);
      const s = typing ? Math.floor(T * 5) : 0;
      for (let r = 0; r < 3; r++) ctx.fillRect(x + 4, y - 20 + r * 2, 2 + ((r * 7 + s + f.id.length) * 5) % 6, 1);
    }
    ctx.fillStyle = C.steel1; ctx.fillRect(x + 7, y - 14, 1, 2);
    ctx.fillStyle = C.steel2; ctx.fillRect(x - 1, y - 13, 5, 1);
    if (f && f.mug > 0) {
      ctx.fillStyle = INK; ctx.fillRect(x + 13, y - 17, 4, 5);
      ctx.fillStyle = col; ctx.fillRect(x + 14, y - 16, 2, 3);
      if (f.mug > 60 && Math.floor(T * 3) % 2) { ctx.fillStyle = C.steel3; ctx.fillRect(x + 14, y - 19, 1, 1); ctx.fillRect(x + 15, y - 21, 1, 1); }
    }
  }
  function drawTable(ctx, m) {
    box(ctx, m.x - 16, m.y - 11, 32, 4, WOOD);
    ctx.fillStyle = WOOD_D; ctx.fillRect(m.x - 16, m.y - 8, 32, 1);
    box(ctx, m.x - 13, m.y - 6, 2, 6, WOOD_D); box(ctx, m.x + 11, m.y - 6, 2, 6, WOOD_D);
    ctx.fillStyle = C.steel4; ctx.fillRect(m.x - 6, m.y - 10, 3, 2); ctx.fillRect(m.x + 4, m.y - 10, 3, 2);
  }
  function drawCoffee(ctx, k) {
    box(ctx, k.x0, k.y - 10, k.x1 - k.x0, 10, C.steel1);
    ctx.fillStyle = C.steel0; ctx.fillRect(k.x0 + 2, k.y - 7, 7, 6); ctx.fillRect(k.x0 + 11, k.y - 7, 7, 6);
    box(ctx, k.x0 + 6, k.y - 19, 8, 8, C.ink2);
    ctx.fillStyle = C.red1; ctx.fillRect(k.x0 + 12, k.y - 17, 1, 1);
    ctx.fillStyle = C.steel3; ctx.fillRect(k.x0 + 8, k.y - 14, 4, 1);
    if ([...folk.values()].some((f) => f.act?.kind === "coffee" && f.act.stage === 1)) {
      ctx.fillStyle = WOOD; ctx.fillRect(k.x0 + 9, k.y - 13 + (Math.floor(T * 8) % 2), 1, 1);
      ctx.fillStyle = C.steel3; ctx.fillRect(k.x0 + 10, k.y - 22 - (Math.floor(T * 4) % 2), 1, 1);
    }
    ctx.fillStyle = C.white; ctx.fillRect(k.x0 + 2, k.y - 13, 2, 2);
  }
  function drawCooler(ctx, c) {
    box(ctx, c.x - 3, c.y - 10, 6, 10, C.steel3);
    box(ctx, c.x - 2, c.y - 17, 4, 6, C.blue3);
    ctx.fillStyle = C.blue2; ctx.fillRect(c.x - 2, c.y - 14, 4, 3);
    ctx.fillStyle = C.steel1; ctx.fillRect(c.x - 1, c.y - 7, 2, 1);
  }
  function drawPrinter(ctx, pr) {
    box(ctx, pr.x - 5, pr.y - 6, 10, 6, C.steel1);
    box(ctx, pr.x - 6, pr.y - 12, 12, 5, C.steel3);
    ctx.fillStyle = C.ink2; ctx.fillRect(pr.x - 4, pr.y - 10, 8, 1);
    ctx.fillStyle = C.green1; ctx.fillRect(pr.x + 4, pr.y - 9, 1, 1);
    const job = [...folk.values()].find((f) => f.act?.kind === "print" && f.act.stage === 1);
    if (job) { const k = Math.min(4, Math.floor(job.act.wait * 2)); ctx.fillStyle = C.steel4; ctx.fillRect(pr.x - 3, pr.y - 13 - k, 6, k + 1); }
  }
  function drawArmchair(ctx, c) {
    box(ctx, c.x - 8, c.y - 9, 14, 6, C.purple0);
    box(ctx, c.x + 4, c.y - 18, 4, 15, C.purple0);
    box(ctx, c.x - 9, c.y - 11, 3, 7, C.purple1);
    ctx.fillStyle = INK; ctx.fillRect(c.x - 7, c.y - 3, 2, 3); ctx.fillRect(c.x + 4, c.y - 3, 2, 3);
    ctx.fillStyle = C.steel1; ctx.fillRect(c.x + 13, c.y - 18, 1, 18);     // a lamp beside it
    box(ctx, c.x + 10, c.y - 22, 7, 4, C.gold2);
  }
  function drawRug(ctx, g) {
    box(ctx, g.x - 34, g.y - 18, 68, 24, "#2a1d3a", "#3a2a4f");
    ctx.fillStyle = "#3a2a4f";
    for (let x = g.x - 30; x < g.x + 32; x += 6) ctx.fillRect(x, g.y - 15, 2, 1), ctx.fillRect(x + 3, g.y + 2, 2, 1);
  }
  function drawPong(ctx, g) {
    box(ctx, g.x - 14, g.y - 12, 28, 5, C.scrub1);
    ctx.fillStyle = C.steel4; ctx.fillRect(g.x - 14, g.y - 10, 28, 1);
    ctx.fillStyle = C.scrub0; ctx.fillRect(g.x - 14, g.y - 7, 28, 1);
    ctx.fillStyle = INK; ctx.fillRect(g.x - 1, g.y - 16, 2, 5); ctx.fillStyle = C.steel3; ctx.fillRect(g.x, g.y - 15, 1, 4);
    box(ctx, g.x - 12, g.y - 6, 2, 6, C.steel1); box(ctx, g.x + 10, g.y - 6, 2, 6, C.steel1);
    // the ball, once both players are at the table
    const ps = [...folk.values()].filter((f) => f.act?.kind === "pong" && f.act.there);
    if (ps.length === 2) {
      const a = pong.from ? 1 : -1, x = g.x + a * 18 * (1 - 2 * pong.t), k = pong.t < 0.5 ? pong.t * 2 : (pong.t - 0.5) * 2;
      const y = g.y - 12 - Math.round(Math.sin(k * Math.PI) * (pong.t < 0.5 ? 6 : 8)) - 6 * (1 - Math.min(1, pong.t * 4));
      ctx.fillStyle = INK; ctx.fillRect(Math.round(x) - 1, y - 1, 3, 3); ctx.fillStyle = C.white; ctx.fillRect(Math.round(x), y, 1, 1);
    }
  }
  function drawStool(ctx, st) {
    box(ctx, st.x - 4, st.y - 7, 8, 2, WOOD_D);
    ctx.fillStyle = WOOD_D; ctx.fillRect(st.x - 3, st.y - 4, 1, 4); ctx.fillRect(st.x + 2, st.y - 4, 1, 4);
  }
  function drawChess(ctx, c) {               // a small table with the board on it, the position as it stands
    const g = room.chess && room.chess(), b = g ? g.board : "RNBQKBNRPPPPPPPP" + ".".repeat(32) + "pppppppprnbqkbnr";
    box(ctx, c.x - 2, c.y - 9, 4, 9, WOOD_D);
    box(ctx, c.x - 6, c.y - 1, 12, 1, WOOD_D);
    box(ctx, c.x - 9, c.y - 12, 18, 3, WOOD);
    // the board seen from the side: eight files, the back half and the front half
    for (let f = 0; f < 8; f++) for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (f + r) % 2 ? "#a08670" : "#d9c49a";
      ctx.fillRect(c.x - 8 + f * 2, c.y - 13 + r, 2, 1);
    }
    for (let f = 0; f < 8; f++) {           // a piece on a file stands up from the board, white in front
      const col = [...Array(8)].map((_, r) => b[r * 8 + f]);
      const w = col.some((p) => p !== "." && p === p.toUpperCase()), k = col.some((p) => p !== "." && p === p.toLowerCase());
      if (k) { ctx.fillStyle = C.ink2; ctx.fillRect(c.x - 8 + f * 2, c.y - 15, 1, 2); }
      if (w) { ctx.fillStyle = C.steel4; ctx.fillRect(c.x - 7 + f * 2, c.y - 14, 1, 2); }
    }
  }
  function drawPlant(ctx, pl) {
    box(ctx, pl.x - 3, pl.y - 5, 6, 5, "#b86a1e");
    const leaves = [[-4, -9, C.green0], [2, -11, C.green1], [-1, -14, C.green1], [3, -7, C.green0], [-3, -12, C.green1]];
    ctx.fillStyle = INK;
    for (const [dx, dy] of leaves) ctx.fillRect(pl.x + dx - 1, pl.y + dy - 1, 4, 5);
    for (const [dx, dy, c] of leaves) { ctx.fillStyle = c; ctx.fillRect(pl.x + dx, pl.y + dy, 2, 3); }
  }

  // ---- you can play along: the pointer on the floor, in grid pixels
  const mine = () => folk.get(room.me());
  function hitFigure(x, y) {
    let best = null;
    for (const f of folk.values()) if (!f.gone && x >= f.x - 7 && x <= f.x + 7 && y >= f.y - 26 && y <= f.y + 1 && (!best || f.y > best.y)) best = f;
    return best;
  }
  function hitThing(x, y) {
    if (!L) return null;
    const inR = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (inR(L.coffee.x0, L.coffee.y - 22, L.coffee.x1, L.coffee.y)) return { kind: "coffee", stage: 0, wait: 0 };
    if (L.pong && inR(L.pong.x - 16, L.pong.y - 17, L.pong.x + 16, L.pong.y) && !anyone("pong")) return "pong";
    if (L.chess && inR(L.chess.x - 12, L.chess.y - 17, L.chess.x + 12, L.chess.y)) return "chess";
    for (const [i, m] of L.mats.entries()) if (inR(m.x - 12, m.y - 24, m.x + 12, m.y) && !matOf(i, mine())) return { kind: "nap", mat: i, left: 12 };
    if (L.cooler && inR(L.cooler.x - 4, L.cooler.y - 18, L.cooler.x + 4, L.cooler.y)) return { kind: "goto", to: L.cooler.spot[0], left: 6 };
    if (L.printer && inR(L.printer.x - 7, L.printer.y - 14, L.printer.x + 7, L.printer.y)) return { kind: "print", stage: 0, wait: 0 };
    if (L.chair && inR(L.chair.x - 10, L.chair.y - 22, L.chair.x + 17, L.chair.y)) return { kind: "chair", left: 20 };
    for (const pl of L.plants) if (inR(pl.x - 5, pl.y - 16, pl.x + 5, pl.y)) return { kind: "plant", to: pl, wait: 0 };
    if (L.window && inR(L.window.x0, 0, L.window.x1, WALL_H)) return { kind: "window", left: 8 };
    if (inR(L.door.x0, 0, L.door.x1, WALL_H)) return { kind: "door" };
    if (L.board && inR(L.board.x0, 0, L.board.x1, WALL_H)) return meeting || !L.meet ? null : "meeting";
    for (const [id, d] of L.desks) if (inR(d.x - 4, d.y - 23, d.x + 15, d.y)) return id === room.me() ? { kind: "desk" } : { kind: "visit", to: folk.get(id), left: 8 };
    return null;
  }
  function tell(f, act) {
    if (!f || !f.p.present || f.act?.kind === "present" || f.act?.kind === "meeting") return;
    end(f); f.act = act;
  }
  let press = null;
  const grid = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  cv.addEventListener("pointerdown", (e) => {
    const g = grid(e);
    press = { x: g.x, y: g.y, f: hitFigure(g.x, g.y), moved: false };
    cv.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    const g = grid(e);
    if (press && press.f && !still && (press.moved || Math.hypot(g.x - press.x, g.y - press.y) > 2)) {
      if (!press.moved) { press.moved = true; held = press.f; end(held); held.act = { kind: "held" }; }
      held.x = Math.max(4, Math.min(W - 4, g.x)); held.y = Math.max(WALL_H + 2, Math.min(H - 1, g.y + 20));
    }
    cv.style.cursor = held ? "grabbing" : hitFigure(g.x, g.y) ? "grab" : hitThing(g.x, g.y) ? "pointer" : "default";
  });
  cv.addEventListener("pointerup", (e) => {
    const g = grid(e), p = press; press = null;
    if (held) { const f = held; held = null; end(f); f.fall = 0.5; say(f, "dropped"); return; }
    if (!p || still) return;
    const me = mine();
    if (!me) return;
    if (p.f) {
      if (p.f === me) { me.hop = 0.6; me.act = { kind: "wave", left: 1.2, then: me.act?.kind === "desk" ? me.act : null }; }
      else tell(me, { kind: "visit", to: p.f, left: 10 });
      return;
    }
    const t = hitThing(g.x, g.y);
    if (t === "chess") room.openChess();
    else if (t === "pong") {                      // challenge whoever is free; on your own you just stand there
      const g = [...folk.values()].find((f) => f.p.present && f !== me && !busy(f));
      tell(me, { kind: "pong", side: 0, left: 30, with: g || null });
      if (g) { end(g); g.act = { kind: "pong", side: 1, left: 30, with: me }; }
    } else if (t === "meeting") {
      const others = [...folk.values()].filter((f) => f.p.present && f !== me && !busy(f));
      if (me.p.present) { end(me); me.act = callMeeting(me, others); }
    } else if (t) tell(me, t);
    else if (g.y > WALL_H) tell(me, { kind: "goto", to: { x: Math.max(6, Math.min(W - 6, g.x)), y: Math.min(H - 1, g.y) }, left: 8 });
  });
  cv.addEventListener("pointercancel", () => { press = null; if (held) { end(held); held = null; } });
  // the margin must still scroll the conversation
  cv.addEventListener("wheel", (e) => { room.log.scrollBy({ top: e.deltaY }); e.preventDefault(); }, { passive: false });

  // ---- size and run, twelve frames a second like a 16-bit game
  function size() {
    const g = room.gap();
    cv.hidden = g < 110;
    if (cv.hidden) return;
    cv.style.width = g + "px";
    const w = Math.floor(g / 2), h = Math.floor(cv.clientHeight / 2);
    if (w !== W || h !== H) {
      W = w; H = h; cv.width = W; cv.height = H;
      for (const f of folk.values()) { f.x = Math.min(f.x, W - 4); f.y = Math.min(f.y, H - 1); }
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
  window.__floor = { folk, layout: () => L, held: () => held, talks: () => talks };   // for the test rig
  return {
    size,
    hop(id) {                                // someone posted: a hop, a bubble, and typing
      const f = folk.get(id); if (!f) return;
      f.hop = 0.6; f.talk = 2.2; f.type = 3;
    },
  };
}
