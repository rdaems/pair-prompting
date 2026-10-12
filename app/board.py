"""The board: a 256x256 pixel screen per room that agents draw on, to show where
the conversation stands (decisions, options, a plan). Colours are 16-bit
(RGB565): any #rrggbb is accepted and rounded to the nearest 16-bit colour, and
the PNG shows exactly the rounded colours.

Agents draw with a small line-per-command language (GRAMMAR below); a whole
POST is parsed first and applied only if every line is valid. The board is its
raster plus the log of commands since the last clear, kept in board.jsonl in the
room's folder and replayed on start; a clear compacts the file.
"""
import json
import os
import re
import struct
import zlib

from atlas_glyphs import EXTRA, GLYPHS

GLYPHS = {**GLYPHS, **EXTRA}

W = H = 256
MAX_OPS = 3000            # commands since the last clear
MAX_LINES = 500           # commands per POST

GRAMMAR = """\
  clear [#color]                 fill the whole board (default #000000)
  rect X Y W H #color            filled rectangle
  box X Y W H #color             1-pixel outline
  line X1 Y1 X2 Y2 #color        straight line
  dot X Y #color                 one pixel
  text X Y #color words…         pixel font, 4x7 glyphs, about 50 characters across
                                 (letters, digits, punctuation, € and common accents)
  big X Y #color words…          the same at twice the size
X and Y run from 0,0 (top left) to 255,255; anything outside is clipped.
Colours are #rgb or #rrggbb, rounded to 16-bit colour (RGB565)."""

HEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def rgb565(c):
    """'#rrggbb' -> the (r, g, b) a 16-bit screen actually shows"""
    m = HEX.match(c)
    if not m:
        raise ValueError(f"not a colour: {c!r} (use #rgb or #rrggbb)")
    h = m.group(1)
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    r5, g6, b5 = round(r * 31 / 255), round(g * 63 / 255), round(b * 31 / 255)
    return (r5 * 255 // 31, g6 * 255 // 63, b5 * 255 // 31)


def parse(line):
    """one command line -> (name, ints, colour, text); raises ValueError with the reason"""
    first = line.split(None, 1)[0].lower()
    parts = re.split(r"\s+", line.strip(), maxsplit=4) if first in ("text", "big") else line.split()
    name = parts[0].lower()
    need = {"clear": 0, "rect": 4, "box": 4, "line": 4, "dot": 2, "text": 2, "big": 2}
    if name not in need:
        raise ValueError(f"unknown command {parts[0]!r}")
    n = need[name]
    if name == "clear":
        if len(parts) > 2:
            raise ValueError("clear takes at most a colour")
        return name, [], rgb565(parts[1]) if len(parts) == 2 else (0, 0, 0), ""
    if len(parts) < n + 2:
        raise ValueError(f"{name} needs {n} numbers and a colour")
    try:
        nums = [int(float(x)) for x in parts[1:n + 1]]
    except ValueError:
        raise ValueError(f"{name}: coordinates must be numbers") from None
    colour = rgb565(parts[n + 1])
    text = ""
    if name in ("text", "big"):
        text = parts[n + 2] if len(parts) > n + 2 else ""
        if not text:
            raise ValueError(f"{name} needs some words after the colour")
    elif len(parts) > n + 2:
        raise ValueError(f"{name} takes {n} numbers and a colour, nothing more")
    return name, nums, colour, text


class Board:
    def __init__(self, folder):
        self.path = os.path.join(folder, "board.jsonl")
        self.px = bytearray(W * H * 3)
        self.log = []                 # {"line", "by", "t", "v"} since the last clear
        self.v = 0
        self._png = (None, b"")
        try:
            with open(self.path) as f:
                for raw in f:
                    if raw.strip():
                        e = json.loads(raw)
                        self._apply(parse(e["line"]))
                        self.log = [] if parse(e["line"])[0] == "clear" else self.log
                        self.log.append(e)
                        self.v = e["v"]
        except (OSError, ValueError):
            pass

    # --- drawing

    def _put(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            i = (y * W + x) * 3
            self.px[i:i + 3] = bytes(c)

    def _rect(self, x, y, w, h, c):
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        row = bytes(c) * max(0, x1 - x0)
        for yy in range(y0, y1):
            i = (yy * W + x0) * 3
            self.px[i:i + len(row)] = row

    def _text(self, x, y, c, s, k):
        for ch in s:
            g = GLYPHS.get(ch) or GLYPHS.get(ch.upper())
            if g is None:
                x += 4 * k
                continue
            rows = g.split("|")
            for j, row in enumerate(rows):
                for i, dot in enumerate(row):
                    if dot == "#":
                        self._rect(x + i * k, y + j * k, k, k, c)
            x += (len(rows[0]) + 1) * k

    def _apply(self, op):
        name, n, c, text = op
        if name == "clear":
            self.px[:] = bytes(c) * (W * H)
        elif name == "rect":
            self._rect(n[0], n[1], n[2], n[3], c)
        elif name == "box":
            x, y, w, h = n
            self._rect(x, y, w, 1, c); self._rect(x, y + h - 1, w, 1, c)
            self._rect(x, y, 1, h, c); self._rect(x + w - 1, y, 1, h, c)
        elif name == "dot":
            self._put(n[0], n[1], c)
        elif name == "line":
            x0, y0, x1, y1 = n
            dx, dy = abs(x1 - x0), -abs(y1 - y0)
            sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
            err = dx + dy
            for _ in range(2048):
                self._put(x0, y0, c)
                if x0 == x1 and y0 == y1:
                    break
                e2 = 2 * err
                if e2 >= dy:
                    err += dy; x0 += sx
                if e2 <= dx:
                    err += dx; y0 += sy
        elif name in ("text", "big"):
            self._text(n[0], n[1], c, text, 2 if name == "big" else 1)

    def draw(self, body, by, t):
        """apply a POST of commands, all or nothing; returns how many were applied"""
        lines = [l.rstrip() for l in body.replace("\r", "").split("\n")]
        lines = [l for l in lines if l.strip() and not l.lstrip().startswith("#")]
        if not lines:
            raise ValueError("no commands (one per line, see the grammar)")
        if len(lines) > MAX_LINES:
            raise ValueError(f"at most {MAX_LINES} commands per request")
        ops = []
        for k, l in enumerate(lines, 1):
            try:
                ops.append(parse(l))
            except ValueError as e:
                raise ValueError(f"line {k}: {e}\n  {l}") from None
        after = len(self.log)
        for op in ops:
            after = 1 if op[0] == "clear" else after + 1
        if after > MAX_OPS:
            raise ValueError(f"the board holds at most {MAX_OPS} commands since its last clear: start with a clear and redraw")
        entries = []
        for l, op in zip(lines, ops):
            self._apply(op)
            self.v += 1
            e = {"line": l.strip(), "by": by, "t": round(t), "v": self.v}
            if op[0] == "clear":
                self.log, entries = [], []
            self.log.append(e)
            entries.append(e)
        compact = any(e["line"].split(" ")[0].lower() == "clear" for e in entries)
        with open(self.path, "w" if compact else "a") as f:
            for e in (self.log if compact else entries):
                f.write(json.dumps(e) + "\n")
        return len(ops)

    # --- reading

    def png(self):
        if self._png[0] != self.v:
            raw = b"".join(b"\x00" + bytes(self.px[y * W * 3:(y + 1) * W * 3]) for y in range(H))
            chunk = lambda kind, data: struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
            self._png = (self.v, b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
                         + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
        return self._png[1]

    def last(self):
        return self.log[-1] if self.log else None
