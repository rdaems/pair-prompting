// The face picker on both doors: one portrait between two arrows. The faces
// form an endless deterministic row — a random starting point per visit, face i
// is the seed "<start>-<i>" — so ← and → walk it both ways and a face you liked
// is always one step back. Name and face are remembered by the browser. The shirt is neutral here; the room gives every
// person their own colour when they join.
function facePicker(box, prev, next) {
  // start where this browser left off last time, if it has picked a face before
  let start = Math.random().toString(36).slice(2, 8), i = 0;
  try {
    const last = (localStorage.getItem("pairFace") || "").match(/^([a-z0-9]+)-(-?\d+)$/);
    if (last) { start = last[1]; i = +last[2]; }
  } catch (e) {}
  const seed = () => `${start}-${i}`;
  const show = () => { box.innerHTML = `<img alt="your face" src="${pixelAvatar(seed(), "human", "#8b93ad")}">`; };
  prev.onclick = () => { i--; show(); };
  next.onclick = () => { i++; show(); };
  show();
  return () => { try { localStorage.setItem("pairFace", seed()); } catch (e) {} return seed(); };
}
