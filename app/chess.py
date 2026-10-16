"""The rules of chess for the room's chess table: legal moves (castling, en passant,
promotion), check, mate and the draws, moves read and written in SAN (Nf3, exd5,
O-O, e8=Q) or as coordinates (g1f3). No engine: nobody here plays the server.

Squares are 0..63, a1 = 0, h1 = 7, a8 = 56; white pieces are upper case.
A move is (from, to, promotion), promotion '' or one of 'qrbn'.
"""
import re

FILES = "abcdefgh"
START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def square(s):
    return FILES[s % 8] + str(s // 8 + 1)


def parse_square(name):
    return FILES.index(name[0]) + 8 * (int(name[1]) - 1)


def uci(m):
    return square(m[0]) + square(m[1]) + m[2]


def _step(s, df, dr):
    f, r = s % 8 + df, s // 8 + dr
    return f + 8 * r if 0 <= f < 8 and 0 <= r < 8 else None


def _jumps(s, ds):
    return [t for t in (_step(s, *d) for d in ds) if t is not None]


def _rays(s, ds):
    out = []
    for d in ds:
        ray, t = [], _step(s, *d)
        while t is not None:
            ray.append(t)
            t = _step(t, *d)
        out.append(ray)
    return out


KNIGHT = [_jumps(s, [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)]) for s in range(64)]
KING = [_jumps(s, [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]) for s in range(64)]
DIAG = [_rays(s, [(1, 1), (1, -1), (-1, 1), (-1, -1)]) for s in range(64)]
LINE = [_rays(s, [(1, 0), (-1, 0), (0, 1), (0, -1)]) for s in range(64)]
# castling: (right, king from, king to, squares that must be empty, squares not under attack, rook from)
CASTLES = [("K", 4, 6, (5, 6), (4, 5, 6), 7), ("Q", 4, 2, (3, 2, 1), (4, 3, 2), 0),
           ("k", 60, 62, (61, 62), (60, 61, 62), 63), ("q", 60, 58, (59, 58, 57), (60, 59, 58), 56)]
# a move from or onto one of these squares ends those rights
RIGHTS = {4: "KQ", 60: "kq", 0: "Q", 7: "K", 56: "q", 63: "k"}


class Position:
    __slots__ = ("board", "white", "castle", "ep", "half", "full")

    @classmethod
    def fen(cls, text=START):
        place, turn, castle, ep, half, full = (text.split() + ["-", "-", "0", "1"])[:6]
        p = cls()
        p.board = [""] * 64
        for r, row in enumerate(place.split("/")):
            f = 0
            for ch in row:
                if ch.isdigit():
                    f += int(ch)
                else:
                    p.board[(7 - r) * 8 + f] = ch
                    f += 1
        p.white = turn == "w"
        p.castle = "" if castle == "-" else castle
        p.ep = None if ep == "-" else parse_square(ep)
        p.half, p.full = int(half), int(full)
        return p

    def to_fen(self):
        rows = []
        for r in range(7, -1, -1):
            row, gap = "", 0
            for f in range(8):
                ch = self.board[r * 8 + f]
                if ch:
                    row += (str(gap) if gap else "") + ch
                    gap = 0
                else:
                    gap += 1
            rows.append(row + (str(gap) if gap else ""))
        ep = square(self.ep) if self.ep is not None else "-"
        return f"{'/'.join(rows)} {'w' if self.white else 'b'} {self.castle or '-'} {ep} {self.half} {self.full}"

    def copy(self):
        p = Position()
        p.board, p.white, p.castle, p.ep, p.half, p.full = self.board[:], self.white, self.castle, self.ep, self.half, self.full
        return p

    def attacked(self, s, by_white):
        b = self.board
        P, N, B, R, Q, K = "PNBRQK" if by_white else "pnbrqk"
        for df in (-1, 1):                 # a pawn attacks one rank further on, diagonally
            t = _step(s, df, -1 if by_white else 1)
            if t is not None and b[t] == P:
                return True
        if any(b[t] == N for t in KNIGHT[s]) or any(b[t] == K for t in KING[s]):
            return True
        for rays, a in ((DIAG[s], B), (LINE[s], R)):
            for ray in rays:
                for t in ray:
                    if b[t]:
                        if b[t] == a or b[t] == Q:
                            return True
                        break
        return False

    def king(self, white):
        return self.board.index("K" if white else "k")

    def in_check(self):
        return self.attacked(self.king(self.white), not self.white)

    def pseudo(self):
        b, w, out = self.board, self.white, []
        mine = str.isupper if w else str.islower
        for s in range(64):
            p = b[s]
            if not p or not mine(p):
                continue
            k = p.upper()
            if k == "P":
                d, last = (8, 7) if w else (-8, 0)
                moves = []
                if not b[s + d]:
                    moves.append(s + d)
                    if s // 8 == (1 if w else 6) and not b[s + 2 * d]:
                        out.append((s, s + 2 * d, ""))
                for df in (-1, 1):
                    t = _step(s, df, 1 if w else -1)
                    if t is not None and ((b[t] and not mine(b[t])) or t == self.ep):
                        moves.append(t)
                for t in moves:
                    out.extend((s, t, pr) for pr in ("qrbn" if t // 8 == last else [""]))
            elif k in "NK":
                out.extend((s, t, "") for t in (KNIGHT if k == "N" else KING)[s] if not b[t] or not mine(b[t]))
            else:
                rays = DIAG[s] if k == "B" else LINE[s] if k == "R" else DIAG[s] + LINE[s]
                for ray in rays:
                    for t in ray:
                        if not b[t]:
                            out.append((s, t, ""))
                        else:
                            if not mine(b[t]):
                                out.append((s, t, ""))
                            break
        rook = "R" if w else "r"
        for right, ks, kt, empty, safe, rs in CASTLES:
            if right in self.castle and right.isupper() == w and b[rs] == rook and not any(b[x] for x in empty) \
                    and not any(self.attacked(x, not w) for x in safe):
                out.append((ks, kt, ""))
        return out

    def play(self, m):
        s, t, pr = m
        n = self.copy()
        b = n.board
        p, captured = b[s], b[t]
        k = p.upper()
        b[t], b[s] = p, ""
        if k == "P" and t == self.ep:      # en passant: the pawn taken stands beside, not on the square
            b[t - 8 if self.white else t + 8] = ""
            captured = "p"
        if pr:
            b[t] = pr.upper() if self.white else pr
        if k == "K" and abs(t - s) == 2:   # castling: the rook jumps over
            rf, rt = (t + 1, t - 1) if t > s else (t - 2, t + 1)
            b[rt], b[rf] = b[rf], ""
        n.ep = (s + t) // 2 if k == "P" and abs(t - s) == 16 else None
        for x in (s, t):
            if x in RIGHTS:
                n.castle = "".join(c for c in n.castle if c not in RIGHTS[x])
        n.half = 0 if k == "P" or captured else self.half + 1
        n.full = self.full + (0 if self.white else 1)
        n.white = not self.white
        return n

    def legal(self):
        out = []
        for m in self.pseudo():
            n = self.play(m)
            if not n.attacked(n.king(self.white), not self.white):
                out.append(m)
        return out

    def san(self, m, legal):
        s, t, pr = m
        b = self.board
        p = b[s].upper()
        if p == "K" and abs(t - s) == 2:
            out = "O-O" if t > s else "O-O-O"
        elif p == "P":
            cap = bool(b[t]) or t == self.ep
            out = (FILES[s % 8] + "x" if cap else "") + square(t) + ("=" + pr.upper() if pr else "")
        else:
            rivals = [o[0] for o in legal if o[1] == t and o[0] != s and b[o[0]] == b[s]]
            dis = ""
            if rivals:
                if all(o % 8 != s % 8 for o in rivals):
                    dis = FILES[s % 8]
                elif all(o // 8 != s // 8 for o in rivals):
                    dis = str(s // 8 + 1)
                else:
                    dis = square(s)
            out = p + dis + ("x" if b[t] else "") + square(t)
        n = self.play(m)
        if n.in_check():
            out += "+" if n.legal() else "#"
        return out

    def key(self, legal):
        """what makes two positions the same for repetition: the en-passant square only
        counts when a pawn can actually take there"""
        ep = self.ep is not None and any(m[1] == self.ep and self.board[m[0]].upper() == "P" for m in legal)
        return " ".join(self.to_fen().split()[:3]) + (" " + square(self.ep) if ep else "")

    def insufficient(self):
        rest = [(s, p) for s, p in enumerate(self.board) if p and p.upper() != "K"]
        if not rest or (len(rest) == 1 and rest[0][1].upper() in "NB"):
            return True
        # only bishops left, all on squares of one colour
        return all(p.upper() == "B" for _, p in rest) and len({(s % 8 + s // 8) % 2 for s, _ in rest}) == 1


def _norm(san):
    return san.replace("=", "").replace("x", "").replace("+", "").replace("#", "")


class Game:
    """a game replayed from its moves (coordinates), with everything a view needs"""

    def __init__(self, moves=()):
        self.pos = Position.fen()
        self.legal = self.pos.legal()
        self.moves, self.sans = [], []
        self.seen = {self.pos.key(self.legal): 1}
        for u in moves:
            self.push(self.find(u))

    def find(self, text):
        """a legal move from what someone typed (SAN or coordinates), or None"""
        t = re.sub(r"[+#!?\s]+$", "", str(text).strip()).replace("e.p.", "").strip()
        t = t.replace("0-0-0", "O-O-O").replace("0-0", "O-O")
        c = re.fullmatch(r"[NBRQK]?([a-h][1-8])[-x:]?([a-h][1-8])=?([qrbnQRBN]?)", t)
        if c:
            s, d, pr = parse_square(c.group(1)), parse_square(c.group(2)), c.group(3).lower()
            hits = [m for m in self.legal if m[0] == s and m[1] == d and m[2] in ((pr,) if pr else ("", "q"))]
            return hits[0] if hits else None
        sans = {_norm(self.pos.san(m, self.legal)): m for m in self.legal}
        if _norm(t) in sans:
            return sans[_norm(t)]
        loose = [m for k, m in sans.items() if k.lower() == _norm(t).lower()]
        return loose[0] if len(loose) == 1 else None

    def push(self, m):
        self.sans.append(self.pos.san(m, self.legal))
        self.moves.append(uci(m))
        self.pos = self.pos.play(m)
        self.legal = self.pos.legal()
        k = self.pos.key(self.legal)
        self.seen[k] = self.seen.get(k, 0) + 1
        self.repeated = self.seen[k]

    def over(self):
        """(result, why) once the rules end the game, else None"""
        if not self.legal:
            if self.pos.in_check():
                return ("0-1" if self.pos.white else "1-0"), "checkmate"
            return "1/2-1/2", "stalemate"
        if self.moves and self.repeated >= 3:
            return "1/2-1/2", "repetition"
        if self.pos.half >= 100:
            return "1/2-1/2", "fifty moves"
        if self.pos.insufficient():
            return "1/2-1/2", "material"
        return None

    def ascii(self):
        rows = ["    a b c d e f g h"]
        for r in range(7, -1, -1):
            rows.append(f" {r + 1}  " + " ".join(self.pos.board[r * 8 + f] or "." for f in range(8)) + f"  {r + 1}")
        return "\n".join(rows + ["    a b c d e f g h"])

    def notation(self):
        return " ".join((f"{i // 2 + 1}. " if i % 2 == 0 else "") + s for i, s in enumerate(self.sans))
