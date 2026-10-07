// Super Atlas's palette (Super Knee-Placement's), and its dithered panel fills as
// CSS variables: an SVG that is solid on top and Bayer-dithers into the second
// colour downwards, one dot = 2 CSS px. Loaded in <head> by every page.
(() => {
  const P = {
    ink: "#140f1e", ink2: "#2a2140", steel0: "#3b3a55", steel1: "#5d6280", steel2: "#8b93ad", steel3: "#c2c9d9",
    steel4: "#f4f6fb", bone1: "#a08670", bone2: "#d9c49a", bone3: "#fff4d6", scrub0: "#10363f", scrub1: "#1b6660",
    scrub2: "#2fa087", scrub3: "#7fdcb0", blue0: "#1a2448", blue1: "#2c4580", blue2: "#4a76b8", gold0: "#b86a1e",
    gold1: "#f2a531", gold2: "#ffe27a", night: "#0b0812",
  };
  const pat = (id, f, cells) =>
    `<pattern id='${id}' width='4' height='4' patternUnits='userSpaceOnUse'>${cells.map(([x, y]) => `<rect x='${x}' y='${y}' width='2' height='2' fill='${f}'/>`).join("")}</pattern>`;
  function dither(f0, f1, from = 40) {
    const band = (100 - from) / 3;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg'><defs>` +
      pat("a", f1, [[0, 0]]) + pat("b", f1, [[0, 0], [2, 2]]) + pat("c", f1, [[0, 0], [2, 2], [2, 0]]) +
      `</defs><rect width='100%' height='100%' fill='${f0}'/>` +
      ["a", "b", "c"].map((p, i) => `<rect y='${from + i * band}%' width='100%' height='${band + 0.5}%' fill='url(#${p})'/>`).join("") +
      `</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  const stars = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>` +
    [[14, 22, P.steel1], [92, 8, P.steel2], [170, 40, P.steel0], [210, 120, P.steel1], [56, 150, P.steel0], [130, 196, P.steel2], [20, 218, P.steel1], [150, 98, P.steel0]]
      .map(([x, y, c]) => `<rect x='${x}' y='${y}' width='2' height='2' fill='${c}'/>`).join("") + `</svg>`)}")`;
  const s = document.documentElement.style;
  s.setProperty("--f-window", dither(P.blue1, P.blue0));
  s.setProperty("--f-button", dither(P.steel4, P.steel3, 30));
  s.setProperty("--f-hot", dither(P.gold2, P.gold1, 30));
  s.setProperty("--f-green", dither(P.scrub2, P.scrub1, 30));
  s.setProperty("--stars", stars);
})();

// Avatars: a 20x20 portrait per participant, seeded, drawn after Super Atlas's
// portraits: shaded shapes lit from the upper left, an ink outline. Humans get
// a face put together from many parts (skin, hair, beards, glasses, clothes;
// deliberately no hats or head coverings, nothing cultural or religious); agents a robot. Their own colour is the clothes or the robot's
// lights. Returns a data URL (cached).
window.pixelAvatar = (() => {
  const N = 20, cache = new Map();
  const C = {
    ink: "#140f1e", ink2: "#2a2140", steel0: "#3b3a55", steel1: "#5d6280", steel2: "#8b93ad", steel3: "#c2c9d9", steel4: "#f4f6fb", white: "#ffffff",
    gold0: "#b86a1e", gold1: "#f2a531", gold2: "#ffe27a", red0: "#8e1f2a", red1: "#e8402a", tissue2: "#f06b72", tissue3: "#ffb0a8",
    blue0: "#1a2448", blue1: "#2c4580", blue2: "#4a76b8", blue3: "#8fc0e8", scrub1: "#1b6660", scrub2: "#2fa087", scrub3: "#7fdcb0",
    purple0: "#5a3f94", purple1: "#9a74d6", green0: "#2d8a3a", green1: "#5fcf4a",
  };
  const SKIN = [["#ffe0bd", "#f7c59a", "#de8a6a"], ["#f7c59a", "#de8a6a", "#a8554f"], ["#de9d74", "#c27a54", "#8a4a35"],
    ["#b8784e", "#93573a", "#6b3043"], ["#8a5a3c", "#6b4430", "#4a2e2a"], ["#5e3c2c", "#4a2e22", "#2e1c16"]];
  const HAIR = [["#2a2140", "#140f1e"], ["#4a2e2a", "#2e1c16"], ["#7a4a35", "#4a2e2a"], ["#b07a4a", "#7a4a35"], ["#f2a531", "#b86a1e"],
    ["#a0402a", "#6b2418"], ["#c2c9d9", "#8b93ad"], ["#f4f6fb", "#c2c9d9"], ["#9a74d6", "#5a3f94"], ["#f06b72", "#c23a55"]];
  const CLOTH = [["#4a76b8", "#2c4580"], ["#e8402a", "#8e1f2a"], ["#2fa087", "#1b6660"], ["#f2a531", "#b86a1e"], ["#9a74d6", "#5a3f94"]];
  function rng(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const chance = (r, p) => r() < p;
  const shadeHex = (hex, k) => "#" + [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, "0")).join("");

  function canvas() {
    const px = new Map();
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < N && y >= 0 && y < N && c) px.set(y * N + x, c); };
    const get = (x, y) => px.get(y * N + x);
    const del = (x, y) => px.delete(y * N + x);
    // an ellipse lit from the upper left: ramp = [light, mid, dark]
    const ell = (cx, cy, rx, ry, ramp, clip) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, q = dx * dx + dy * dy;
        if (q > 1 || (clip && !clip(x, y))) continue;
        const l = -0.55 * dx - 0.65 * dy + (q > 0.72 ? -0.35 : 0);
        set(x, y, typeof ramp === "string" ? ramp : l > 0.25 ? ramp[0] : l > -0.45 || ramp.length < 3 ? ramp[1] || ramp[0] : ramp[2]);
      }
    };
    const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
    return { px, set, get, del, ell, rect };
  }

  function human(cv, r, col) {
    const { set, get, ell, rect } = cv;
    const skin = pick(r, SKIN), [hair, hairD] = pick(r, HAIR.slice(0, chance(r, 0.15) ? 10 : 8));
    const style = pick(r, ["short", "short", "long", "long", "bun", "ponytail", "afro", "curly", "spiky", "bald", "prof", "mohawk", "side"]);
    const grey = style === "prof" ? pick(r, [[C.steel4, C.steel3], [C.steel3, C.steel2]]) : null;
    const outfit = pick(r, ["tee", "tee", "coat", "suit", "hoodie", "sweater"]);
    const [c0, c1] = [col, shadeHex(col, 0.62)];
    // behind the head: big hair
    if (style === "afro") ell(10, 7.5, 7.6, 6.8, [hair, hair, hairD]);
    if (style === "long") { ell(10, 8, 6.6, 5.5, [hair, hair, hairD]); rect(3, 9, 3, 7, hairD); rect(14, 9, 3, 7, hairD); }
    // shoulders and clothes
    if (outfit === "coat") {
      ell(10, 21, 9.5, 5.5, [C.white, C.steel4, C.steel3]);
      rect(9, 16, 2, 4, c0); set(9, 16, c1); set(10, 19, c1);
      set(7, 16, C.steel2); set(8, 17, C.steel2); set(12, 16, C.steel2); set(11, 17, C.steel2);
    } else if (outfit === "suit") {
      ell(10, 21, 9.5, 5.5, [C.steel1, C.steel0, C.ink2]);
      rect(8, 16, 4, 4, C.white); rect(9, 16, 2, 4, c0); set(10, 17, c1);
    } else if (outfit === "hoodie") {
      ell(10, 21, 9.5, 5.5, [c0, c0, c1]); ell(10, 16.5, 5, 2, c1); set(8, 18, C.steel4); set(12, 18, C.steel4);
    } else if (outfit === "sweater") {
      ell(10, 21, 9.5, 5.5, [c0, c0, c1]); rect(7, 16, 6, 1, C.white); set(6, 17, C.white); set(13, 17, C.white);
    } else ell(10, 21, 9.5, 5.5, [c0, c0, c1]);
    // neck, ears, head
    rect(8, 13, 4, 3, skin[2]);
    ell(4.6, 10, 1.4, 1.8, [skin[1], skin[1], skin[2]]); ell(15.4, 10, 1.4, 1.8, [skin[1], skin[1], skin[2]]);
    ell(10, 9.6, 5.4, 6.1, skin);
    // hair on top
    const cap = (yTop, clipY) => ell(10, yTop, 5.9, 4.4, [hair, hair, hairD], (x, y) => y <= clipY);
    if (style === "short" || style === "long" || style === "side" || style === "spiky" || style === "ponytail" || style === "bun") {
      cap(6, 6); set(4.6, 7, hair); set(15.4, 7, hair); set(4.6, 8, hairD); set(15.4, 8, hairD);
      if (style === "side") { for (let x = 5; x < 11; x++) set(x, 7, hair); set(5, 8, hair); }
      if (style === "spiky") for (let x = 5; x <= 15; x += 2) { set(x, 1, hair); set(x, 2, hair); }
      if (style === "bun") ell(10, 1.6, 2.4, 1.8, [hair, hair, hairD]);
      if (style === "ponytail") { ell(16.6, 9, 1.6, 4, [hair, hair, hairD]); }
    }
    if (style === "afro") cap(6, 5);
    if (style === "curly") for (const [x, y] of [[6, 4], [8.5, 2.8], [11.5, 2.8], [14, 4], [5, 6.5], [15, 6.5], [10, 3.5]]) ell(x, y, 2, 1.9, [hair, hair, hairD]);
    if (style === "mohawk") { rect(9, 1, 3, 5, hair); rect(9, 5, 3, 1, hairD); }
    if (style === "prof") { ell(4.6, 9, 1.8, 2.8, grey); ell(15.4, 9, 1.8, 2.8, grey); set(9, 4, skin[0]); set(10, 4, skin[0]); }
    if (style === "bald" && chance(r, 0.5)) { set(8, 5, skin[0]); set(9, 5, skin[0]); }
    // face: brows, eyes, nose, mouth
    const browC = grey ? grey[0] : style === "bald" ? skin[2] : hairD;
    const ey = 10;
    if (chance(r, 0.6)) { set(7, ey - 3, browC); set(8, ey - 3, browC); set(12, ey - 3, browC); set(13, ey - 3, browC); }
    // eyes: a 2x2 pupil with a catchlight, readable on every skin
    for (const ex of [7, 12]) { set(ex, ey, C.ink); set(ex + 1, ey, C.ink); set(ex, ey - 1, C.steel4); set(ex + 1, ey - 1, C.ink); }
    set(10, ey + 2, skin[2]);
    const mouthY = 14;
    const mouth = pick(r, ["smile", "smile", "flat", "open", "grin"]);
    if (mouth === "smile") { set(9, mouthY, C.red0); set(10, mouthY, C.red0); set(11, mouthY, C.red0); set(8, mouthY - 1, C.red0); set(12, mouthY - 1, C.red0); }
    if (mouth === "flat") { set(9, mouthY, skin[2]); set(10, mouthY, skin[2]); set(11, mouthY, skin[2]); }
    if (mouth === "open") { set(10, mouthY, C.red0); set(10, mouthY - 1, C.red0); }
    if (mouth === "grin") { for (let x = 8; x <= 12; x++) set(x, mouthY, C.white); set(8, mouthY - 1, C.red0); set(12, mouthY - 1, C.red0); }
    if (chance(r, 0.25)) { set(6, 12, C.tissue2); set(14, 12, C.tissue2); }
    if (chance(r, 0.15)) { set(7, 12, skin[2]); set(13, 11, skin[2]); set(12, 12, skin[2]); }
    // facial hair
    const beard = grey ? pick(r, ["stache", "beard", "none"]) : chance(r, 0.35) ? pick(r, ["beard", "stache", "goatee", "stubble"]) : "none";
    const bc = grey ? grey : [hair, hairD];
    if (beard === "beard") { ell(10, 13.4, 5, 3.2, [bc[0], bc[0], bc[1]], (x, y) => y >= 12); set(9, mouthY, C.red0); set(10, mouthY, C.red0); set(11, mouthY, C.red0); }
    if (beard === "stache" || beard === "beard") { for (let x = 8; x <= 12; x++) set(x, 13, bc[0]); set(7, 14, bc[1]); set(13, 14, bc[1]); }
    if (beard === "goatee") { set(10, 15, bc[0]); set(9, 15, bc[0]); set(11, 15, bc[0]); set(10, 16, bc[1]); }
    if (beard === "stubble") for (let x = 6; x <= 14; x += 2) set(x, 14 + (x % 4 ? 0 : 1), skin[2]);
    // glasses
    const specs = grey ? pick(r, ["round", "none"]) : chance(r, 0.18) ? pick(r, ["round", "square", "shades"]) : "none";
    if (specs === "round" || specs === "square") {
      for (const ex of [7, 12]) {
        for (let y = ey - 2; y <= ey + 1; y++) for (let x = ex - 1; x <= ex + 2; x++) {
          const edge = y === ey - 2 || y === ey + 1 || x === ex - 1 || x === ex + 2;
          const corner = (y === ey - 2 || y === ey + 1) && (x === ex - 1 || x === ex + 2);
          if (edge && !(specs === "round" && corner)) set(x, y, C.ink);
        }
      }
      set(10, ey - 1, C.ink);
    }
    if (specs === "shades") { rect(6, ey - 1, 9, 2, C.ink); set(7, ey - 1, C.steel1); set(12, ey - 1, C.steel1); set(10, ey, skin[1]); }
    if (style !== "long" && chance(r, 0.2)) { set(4.6, 12, C.gold2); set(15.4, 12, C.gold2); }
  }

  function robot(cv, r, col) {
    const { set, ell, rect } = cv;
    const light = col, lightD = shadeHex(col, 0.62), o = 2;   // drawn on the old 16 grid, moved into the 20
    const g = (x, y, c) => set(x + o, y + 4, c);
    for (let y = 13; y < 16; y++) for (let x = 3; x < 13; x++) g(x, y, x === 3 || y === 13 ? C.steel3 : x > 10 ? C.steel1 : C.steel2);
    g(7, 14, light); g(8, 14, light);
    for (let x = 6; x < 10; x++) g(x, 12, C.steel1);
    const top = pick(r, [3, 4]);
    for (let y = top; y < 12; y++) for (let x = 3; x < 13; x++) g(x, y, y === top || x === 3 ? C.steel4 : y === 11 || x === 12 ? C.steel1 : C.steel3);
    const ant = pick(r, ["one", "two", "dish"]);
    if (ant === "one") { g(8, top - 1, C.steel2); g(8, top - 2, C.steel2); g(8, top - 3, light); }
    if (ant === "two") { g(5, top - 1, C.steel2); g(10, top - 1, C.steel2); g(5, top - 2, light); g(10, top - 2, light); }
    if (ant === "dish") { g(7, top - 1, C.steel2); g(8, top - 1, C.steel2); g(6, top - 2, C.steel3); g(9, top - 2, C.steel3); g(7, top - 2, light); g(8, top - 2, light); }
    for (let y = 6; y < 9; y++) { g(2, y, C.steel1); g(13, y, C.steel1); }
    for (let y = top + 2; y < top + 6; y++) for (let x = 5; x < 11; x++) g(x, y, C.blue0);
    const eyes = pick(r, ["dots", "visor", "cyclops", "happy"]), ey = top + 3;
    if (eyes === "dots") { g(6, ey, light); g(9, ey, light); g(6, ey + 1, lightD); g(9, ey + 1, lightD); }
    if (eyes === "visor") for (let x = 5; x < 11; x++) g(x, ey, x % 2 ? light : lightD);
    if (eyes === "cyclops") { g(7, ey, light); g(8, ey, light); g(7, ey + 1, light); g(8, ey + 1, lightD); }
    if (eyes === "happy") { g(6, ey + 1, light); g(5, ey, light); g(7, ey, light); g(9, ey + 1, light); g(8, ey, light); g(10, ey, light); }
    if (r() < 0.5) for (let x = 6; x < 10; x++) g(x, 10, x % 2 ? C.steel1 : C.ink2);
    else for (let x = 6; x < 10; x++) g(x, 10, C.steel1);
  }

  return (seed, kind, color) => {
    const key = seed + kind + color;
    if (cache.has(key)) return cache.get(key);
    const cv = canvas(), r = rng(String(seed));
    (kind === "agent" ? robot : human)(cv, r, color || "#8b93ad");
    const el = document.createElement("canvas"); el.width = el.height = N;
    const ctx = el.getContext("2d");
    ctx.fillStyle = C.ink;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (cv.px.has(y * N + x)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && x + dx < N && cv.px.has((y + dy) * N + x + dx))) ctx.fillRect(x, y, 1, 1);
    }
    for (const [i, c] of cv.px) { ctx.fillStyle = c; ctx.fillRect(i % N, Math.floor(i / N), 1, 1); }
    const url = el.toDataURL();
    cache.set(key, url);
    return url;
  };
})();
