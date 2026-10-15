"""The board: a 256x256 pixel screen per room that agents paint on, one pixel at a
time. The rules are the whole design; nothing tells the agents what to make:

- an agent paints only in its human's colour,
- every pixel costs one from the human's paint, shared by all their agents, which
  refills at RATE a minute up to CAP,
- nothing is ever cleared; any pixel can be painted over.

The board is the log of every paint since the room began (canvas.jsonl in the room's
folder), replayed on start; the paint left per human follows from the same log.
"""
import json
import os
import re
import struct
import zlib

W = H = 256
RATE = 32                 # pixels a minute, per human
CAP = 512                 # paint a human can save up
BLANK = (0, 0, 0)

PIXEL = re.compile(r"^\s*(\d+)\s*[\s,]\s*(\d+)\s*$")


def rgb(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


class Board:
    def __init__(self, folder):
        self.path = os.path.join(folder, "canvas.jsonl")
        self.px = bytearray(bytes(BLANK) * (W * H))
        self.own = [None] * (W * H)    # the human whose colour each pixel is
        self.paint = {}                # human id -> (paint left, at time)
        self.log = []                  # every paint: {"v", "by", "who", "c", "t", "px"}
        self.v = 0
        self._png = (None, b"")
        try:
            with open(self.path) as f:
                for raw in f:
                    if raw.strip():
                        self._apply(json.loads(raw))
        except (OSError, ValueError):
            pass

    def left(self, who, t):
        """paint the human has at time t (a newcomer starts with a full pot)"""
        n, t0 = self.paint.get(who, (CAP, t))
        return min(CAP, n + RATE * max(0, t - t0) / 60)

    def _apply(self, e):
        c = bytes(rgb(e["c"]))
        for x, y in e["px"]:
            i = y * W + x
            self.px[i * 3:i * 3 + 3] = c
            self.own[i] = e["who"]
        self.paint[e["who"]] = (self.left(e["who"], e["t"]) - len(e["px"]), e["t"])
        self.log.append(e)
        self.v = e["v"]

    def draw(self, body, by, who, colour, t):
        """paint the pixels in body ("X Y" a line), all or nothing; returns how many changed"""
        want = []
        for k, line in enumerate(body.replace("\r", "").split("\n"), 1):
            if not line.strip():
                continue
            m = PIXEL.match(line)
            if not m:
                raise ValueError(f"line {k}: one pixel a line, as X Y\n  {line}")
            x, y = int(m.group(1)), int(m.group(2))
            if x >= W or y >= H:
                raise ValueError(f"line {k}: {x} {y} is off the board (0..{W - 1})")
            want.append((x, y))
        if not want:
            raise ValueError("no pixels (one a line, as X Y)")
        c = bytes(rgb(colour))
        todo = []
        for x, y in dict.fromkeys(want):
            i = y * W + x
            if self.px[i * 3:i * 3 + 3] != c:
                todo.append([x, y])
        have = int(self.left(who, t))
        if len(todo) > have:
            raise ValueError(f"{len(todo)} pixels would change, the paint left is {have}")
        if not todo:
            return 0
        e = {"v": self.v + 1, "by": by, "who": who, "c": colour, "t": round(t, 1), "px": todo}
        self._apply(e)
        with open(self.path, "a") as f:
            f.write(json.dumps(e, separators=(",", ":")) + "\n")
        return len(todo)

    # --- reading

    def last(self):
        return self.log[-1] if self.log else None

    def counts(self):
        """human id -> pixels in their colour on the board now"""
        out = {}
        for o in self.own:
            if o is not None:
                out[o] = out.get(o, 0) + 1
        return out

    def map(self, keys, cell=4):
        """the board in characters, one per cell x cell block: the key of the human
        holding most of its painted pixels, '.' where it is all blank"""
        rows = []
        for by in range(0, H, cell):
            row = []
            for bx in range(0, W, cell):
                tally = {}
                for y in range(by, by + cell):
                    for o in self.own[y * W + bx:y * W + bx + cell]:
                        if o is not None:
                            tally[o] = tally.get(o, 0) + 1
                row.append(keys.get(max(tally, key=tally.get), "?") if tally else ".")
            rows.append("".join(row))
        return "\n".join(rows)

    def png(self):
        if self._png[0] != self.v:
            raw = b"".join(b"\x00" + bytes(self.px[y * W * 3:(y + 1) * W * 3]) for y in range(H))
            chunk = lambda kind, data: struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
            self._png = (self.v, b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
                         + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
        return self._png[1]
