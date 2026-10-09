"""pair — one chat room for humans and their agents ("pair prompting").

A room is created from the landing page and is nothing but its links:
  /r/<invite>  the room's invite link: whoever opens it picks a name and becomes a human
  /h/<token>   that human's personal page (the bookmark is the login)
  /a/<token>   an agent link a human mints and pastes into their own chat; fetching it
               returns plain-text instructions and the transcript, then the agent
               reads, waits and posts with plain HTTP (curl)
Every link is a secrets.token_urlsafe(24) and the role comes from which kind of
token it is, never from the request.

Signing in (auth.py) is optional and sits beside the links: an account remembers
the seats its person holds, so their rooms follow them to every device, and a room
is still nothing but its links: signing in only keeps them for you.

State: data/rooms/<id>/room.json (name, people, tokens) + messages.jsonl
(append-only), all loaded into memory at start.
"""
import json
import os
import http.cookies
import re
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import auth

DATA = os.environ.get("PAIR_DATA", "/data")
APP = os.path.dirname(os.path.abspath(__file__))
MAX_TEXT = 200_000            # one message; agents paste context
MAX_BODY = 1_000_000
STATIC = {"door.css": "text/css", "room.css": "text/css", "pixel.js": "text/javascript", "faces.js": "text/javascript", "auth.js": "text/javascript",
          "pixel.woff2": "font/woff2", "mono.woff2": "font/woff2", "mono-bold.woff2": "font/woff2",
          "jetbrains-mono-nerd-OFL.txt": "text/plain"}
COLORS = ["#ffe27a", "#8fc0e8", "#ffb0a8", "#7fdcb0", "#9a74d6", "#f7c59a", "#f2a531", "#5fcf4a"]  # Super Atlas palette, light tones for a dark room
# agents get an alliterative handle, unique within a room: dapper-dan, mellow-mona
BOT_WORDS = {
    "b": ("bouncy brave breezy bubbly bold", "bob bea bert babs benny"),
    "c": ("cheery clever cosmic cozy curious", "cleo carl cora chip cass"),
    "d": ("dapper daring dizzy dreamy dandy", "dan dot dora dex dolly"),
    "f": ("fancy fizzy frisky funky fuzzy", "fred flo finn fern felix"),
    "g": ("giddy gentle groovy gutsy gleeful", "gus gina gil greta gary"),
    "h": ("happy hasty humble hearty hip", "hank hattie hugo hal hazel"),
    "j": ("jazzy jolly jumpy jovial jaunty", "jim june jojo jack jade"),
    "l": ("lucky lively loyal lanky lofty", "lou lola leo lily lars"),
    "m": ("merry mellow mighty misty mild", "max mona milo mabel moe"),
    "n": ("nifty nimble noble nutty nosy", "ned nora nico nell nate"),
    "p": ("perky plucky peppy polite posh", "pete pam pip polly perry"),
    "r": ("rowdy rosy rusty radiant rapid", "rex rosie rudy ruth ray"),
    "s": ("sunny snappy spunky sleepy swanky", "sam sue stan sid suzy"),
    "t": ("tidy tiny trusty toasty twinkly", "tom tess ted tina toby"),
    "w": ("witty wobbly wacky wise wily", "walt wanda wes winnie wally"),
    "z": ("zany zesty zippy zen zealous", "zed zoe ziggy zara zack"),
}
BOT_NAMES = [f"{a}-{n}" for adj, names in BOT_WORDS.values() for a in adj.split() for n in names.split()]
PENDING_MAX = 10              # agent links fetched but never used, per human
MAX_ROOMS = 2000            # room creation is the one write that needs no token:
NEW_PER_HOUR = 20           # cap it, per client address and in total

lock = threading.Lock()
created = {}                  # client address -> recent creation times
rooms = {}                    # room id -> Room
accounts = None               # auth.Accounts, loaded at start
logins = {}                   # sign-in state -> (provider, where to go after, time)
tokens = {}                   # token -> (kind, room, participant id or None)


def now():
    return time.time()


def tok():
    return secrets.token_urlsafe(24)


class Room:
    def __init__(self, meta, messages):
        self.meta = meta          # {id, name, created, invite, people: [...]}
        self.messages = messages
        self.cond = threading.Condition(lock)
        self.version = 0          # bumped on every change humans should see
        self.waiting = {}         # participant id -> open wait requests
        self.seen = {}            # participant id -> last request time

    @property
    def dir(self):
        return os.path.join(DATA, "rooms", self.meta["id"])

    def save(self):
        path = os.path.join(self.dir, "room.json")
        with open(path + ".tmp", "w") as f:
            json.dump(self.meta, f, indent=1)
        os.replace(path + ".tmp", path)

    def person(self, pid):
        return next(p for p in self.meta["people"] if p["id"] == pid)

    def label(self, p):
        return p["name"]

    def unique(self, wanted, me=None):
        taken = {self.label(q).lower() for q in self.meta["people"] if not q.get("revoked") and q["id"] != me}
        name, n = wanted, 2
        while name.lower() in taken:
            name, n = f"{wanted} {n}", n + 1
        return name

    def post(self, pid, kind, text):
        msg = {"id": len(self.messages) + 1, "t": round(now(), 3), "from": pid, "kind": kind, "text": text}
        self.messages.append(msg)
        with open(os.path.join(self.dir, "messages.jsonl"), "a") as f:
            f.write(json.dumps(msg) + "\n")
        self.changed()
        return msg

    def changed(self):
        self.version += 1
        self.cond.notify_all()

    def touch(self, pid):
        self.seen[pid] = now()

    def present(self, pid):
        return self.waiting.get(pid, 0) > 0 or now() - self.seen.get(pid, 0) < 15

    def public_people(self):
        out = []
        for p in self.meta["people"]:
            if p.get("revoked") or (p["kind"] == "agent" and not p.get("joined")):
                continue
            q = {**self.face(p), "present": self.present(p["id"]), "joined": p.get("joined")}
            out.append(q)
        return out

    def face(self, p):
        """what the page needs to draw someone: name, colour, avatar, and for an agent its human"""
        q = {"id": p["id"], "kind": p["kind"], "name": self.label(p), "color": p["color"], "avatar": p.get("avatar") or p["id"]}
        if p.get("account") and p["account"] in accounts.accounts:
            q["via"] = auth.LABEL[accounts.accounts[p["account"]]["provider"]]
        if p["kind"] == "agent":
            o = self.person(p["owner"])
            q.update(owner=o["id"], ownerName=o["name"], ownerAvatar=o.get("avatar") or o["id"])
        return q

    def seat_of(self, account):
        """the seat a signed-in person already holds here, if any"""
        return next((p for p in self.meta["people"] if account and p["kind"] == "human"
                     and p.get("account") == account["id"] and not p.get("revoked")), None)

    def public_msg(self, m):
        p = self.person(m["from"]) if m["from"] else None
        return {**m, **({k: v for k, v in self.face(p).items() if k not in ("id", "kind")} if p else {})}


def load():
    base = os.path.join(DATA, "rooms")
    os.makedirs(base, exist_ok=True)
    for rid in os.listdir(base):
        try:
            with open(os.path.join(base, rid, "room.json")) as f:
                meta = json.load(f)
        except (OSError, ValueError):
            continue
        msgs = []
        try:
            with open(os.path.join(base, rid, "messages.jsonl")) as f:
                msgs = [json.loads(line) for line in f if line.strip()]
        except OSError:
            pass
        index(Room(meta, msgs))


def index(room):
    rooms[room.meta["id"]] = room
    tokens[room.meta["invite"]] = ("invite", room, None)
    for p in room.meta["people"]:
        if not p.get("revoked"):
            tokens[p["token"]] = (p["kind"], room, p["id"])
        if p.get("bring"):
            tokens[p["bring"]] = ("bring", room, p["id"])


def add_person(room, kind, **kw):
    people = room.meta["people"]
    p = {"id": f"p{len(people) + 1}", "kind": kind, "token": tok(), "created": round(now())}
    if kind == "human":
        # every human their own colour, in join order, so their agents can share it unambiguously
        p["color"] = COLORS[sum(1 for q in people if q["kind"] == "human") % len(COLORS)]
    else:
        owner = room.person(kw["owner"])
        p["color"] = owner["color"]
        taken = {room.label(q) for q in people if not q.get("revoked")}
        free = [n for n in BOT_NAMES if n not in taken]
        p["name"] = secrets.choice(free) if free else room.unique(secrets.choice(BOT_NAMES)).replace(" ", "-")
        p["avatar"] = secrets.token_hex(4)
    p.update(kw)
    people.append(p)
    tokens[p["token"]] = (kind, room, p["id"])
    if kind == "human":
        bring_token(room, p)
    room.save()
    return p


def bring_token(room, p):
    """a human's link for bringing agents: every fetch of it makes a new agent"""
    if not p.get("bring"):
        p["bring"] = tok()
        room.save()
    tokens[p["bring"]] = ("bring", room, p["id"])
    return p["bring"]


def clean_avatar(s):
    s = re.sub(r"[^A-Za-z0-9-]", "", str(s or ""))[:24]
    return s or secrets.token_hex(4)


def clean_name(s, limit=40):
    return re.sub(r"\s+", " ", str(s or "")).strip()[:limit]



def seats(account):
    """every room an account sits in, newest activity first"""
    out = []
    for room in rooms.values():
        p = room.seat_of(account)
        if p:
            last = room.messages[-1]["t"] if room.messages else room.meta["created"]
            out.append({"url": f"/h/{p['token']}", "room": room.meta["name"], "name": p["name"], "t": last})
    return sorted(out, key=lambda x: -x["t"])


SAFE_NEXT = re.compile(r"^/([rh]/[A-Za-z0-9_-]+)?$")


def ftime(t):
    return time.strftime("%H:%M", time.localtime(t))


# ---------- agent text protocol ----------

def agent_render(room, msgs, me):
    out = []
    for m in msgs:
        if m["kind"] == "system":
            out.append(f"--- #{m['id']} · {ftime(m['t'])} · {m['text']}")
            continue
        p = room.person(m["from"])
        who = room.label(p) + (" (human)" if p["kind"] == "human" else " (agent)")
        if m["from"] == me:
            who += " — you"
        out.append(f"--- #{m['id']} · {ftime(m['t'])} · {who}\n{m['text']}")
    return "\n\n".join(out)


def agent_intro(room, me, base):
    a = room.person(me)
    owner = room.person(a["owner"])
    you = room.label(a)
    url = f"{base}/a/{a['token']}"
    people = []
    for p in room.meta["people"]:
        if p.get("revoked") or (p["kind"] == "agent" and not p.get("joined")):
            continue
        tag = "human" if p["kind"] == "human" else "agent"
        extra = (" — you came here from their chat" if p["id"] == owner["id"] else " — that is you" if p["id"] == me else "")
        people.append(f"  - {room.label(p)} ({tag}){extra}")
    last = len(room.messages)
    shown = room.messages[-100:]
    skipped = last - len(shown)
    return f"""PAIR — a group chat where people and agents talk together, as equals.

Room: {room.meta['name']}
You are: {you} (the name this room gave you)
You came in from your conversation with {owner['name']}; the room shows you as {you}, with {owner['name']}.
Here now:
{chr(10).join(people)}

WHAT THIS IS
Pair prompting. People and agents talk here together, and you are a full member
of the conversation, not anyone's assistant: there is no hierarchy, between people
and agents or between anyone else. Every post shows whether a human or an agent wrote it.
You bring the context of your conversation with {owner['name']}; nobody here can see that
conversation, only what you post.

HOW TO BE HERE
- Talk like a good member of a group chat: freely, politely, in your own voice.
  Speak to anyone, people or agents, ask questions, agree, disagree, build on ideas.
- Start by saying hello as {you}, with a compact summary of the context
  you bring from {owner['name']}'s chat. Leave out secrets, credentials and anything {owner['name']}
  would not want shared.
- Answer what is addressed to you; speak up when you have something to add. Don't
  post just to acknowledge, and leave room for others: one message at a time, then listen.
- Keep messages chat-sized; offer long material rather than dumping it unasked.
- {owner['name']} may also talk to you in your own chat; that is not visible here unless
  you post it.
- Keep listening, indefinitely. A quiet room is not a finished conversation: people
  come back hours or days later and expect you to still be here. Never decide on your
  own that it is over; leave only when someone asks you to.

HOW TO TALK (plain HTTP, every reply is plain text)
  Read all messages:
    curl -s '{url}/messages'
  Wait for new messages (blocks until someone else posts or the timeout passes;
  prints blank lines while it waits; default timeout 90 s, max 3600):
    curl -s '{url}/wait?since=N&timeout=90'
  Post a message (the request body is the message, as-is; keep the heredoc unindented):
curl -s '{url}/say' --data-binary @- <<'EOF'
your message
EOF

  N is the number of the last message you have seen. Every reply ends with the exact
  command to run next. In Claude Code, run the wait command in the background
  (run_in_background) with a long wait, e.g. &timeout=3000 in the URL, so you are
  woken as soon as someone speaks while {owner['name']} can keep talking to you.
  Listening is a loop without an end: whenever a wait returns, with messages, with
  "(nothing new)" or with nothing at all (a dropped connection), start the next wait
  right away with the last N you saw.
  If you can only fetch URLs and cannot send a POST, tell {owner['name']}: you can follow
  the room but cannot speak in it.

TRANSCRIPT ({last} message{'s' if last != 1 else ''}{f', the first {skipped} left out, read them with /messages' if skipped else ''})

{agent_render(room, shown, me) if shown else '(empty)'}

--- end of transcript, last message #{last}
Next: say hello (POST to /say), then wait:
  curl -s '{url}/wait?since={last}&timeout=90'
"""


# ---------- HTTP ----------

class Handler(BaseHTTPRequestHandler):
    server_version = "pair"

    def log_message(self, fmt, *args):
        pass

    def handle(self):
        # long-polls outlive closed tabs and sleeping phones; their dead sockets are no error
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def base(self):
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "localhost"
        # links in pages and agent instructions must carry the scheme the visitor used:
        # a proxy's X-Forwarded-Proto, Cloudflare's Cf-Visitor, else PAIR_SCHEME (default http)
        visitor = re.search(r'"scheme":\s*"(https?)"', self.headers.get("Cf-Visitor") or "")
        proto = self.headers.get("X-Forwarded-Proto") or (visitor and visitor.group(1)) or os.environ.get("PAIR_SCHEME", "http")
        return f"{proto}://{host}"

    def send(self, code, body, ctype="application/json", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body)
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if "json" in ctype or "text" in ctype else ""))
        self.send_header("Content-Length", str(len(body)))
        extra = dict(extra or {})
        self.send_header("Cache-Control", extra.pop("Cache-Control", "no-store"))
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Robots-Tag", "noindex")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def text(self, code, s):
        self.send(code, s, "text/plain")

    def redirect(self, where, cookies=()):
        self.send_response(303)
        self.send_header("Location", where)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self.end_headers()

    def cookie(self, name):
        try:
            c = http.cookies.SimpleCookie(self.headers.get("Cookie") or "")
        except http.cookies.CookieError:
            return None
        return c[name].value if name in c else None

    def secure(self):
        return self.base().startswith("https:")

    def set_cookie(self, name, value, age, path="/", cross_site=False):
        # the sign-in state has to survive Apple posting back from its own site
        same = "None" if cross_site and self.secure() else "Lax"
        return f"{name}={value}; Path={path}; Max-Age={age}; HttpOnly; SameSite={same}" + ("; Secure" if self.secure() else "")

    def account(self):
        return accounts.by_session(self.cookie("pair_sid"))

    def me_info(self):
        a = self.account()
        return {"name": a["name"], "avatar": a.get("avatar") or "", "via": auth.LABEL[a["provider"]]} if a else None

    def page(self, name):
        with open(os.path.join(APP, name), "rb") as f:
            self.send(200, f.read(), "text/html")

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("too large")
        return self.rfile.read(n) if n else b""

    def json_body(self):
        try:
            return json.loads(self.body() or b"{}")
        except ValueError:
            return {}

    def route(self):
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        q = {k: v[-1] for k, v in parse_qs(u.query).items()}
        return parts, q

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parts, q = self.route()
        if not parts:
            return self.page("landing.html")
        if len(parts) == 1 and parts[0] in STATIC:
            with open(os.path.join(APP, parts[0]), "rb") as f:
                return self.send(200, f.read(), STATIC[parts[0]], {"Cache-Control": "max-age=300"})
        if parts == ["favicon.ico"]:
            return self.send(204, b"", "text/plain")
        if parts == ["api", "me"]:
            a = self.account()
            with lock:
                mine = seats(a) if a else []
            return self.send(200, {"account": self.me_info(), "providers": self.providers(), "rooms": mine})
        if parts[0] == "auth" and len(parts) in (2, 3):
            return self.auth_route(parts[1:], q, {})
        if len(parts) < 2:
            return self.text(404, "not found\n")
        kind, t, rest = parts[0], parts[1], parts[2:]
        hit = tokens.get(t)
        if kind == "r" and hit and hit[0] == "invite" and not rest:
            seat = hit[1].seat_of(self.account())
            return self.redirect(f"/h/{seat['token']}") if seat else self.page("join.html")
        if kind == "r" and hit and hit[0] == "invite" and rest == ["info"]:
            room = hit[1]
            return self.send(200, {"room": room.meta["name"],
                                   "providers": self.providers(), "account": self.me_info()})
        if kind == "h" and hit and hit[0] == "human":
            if not rest:
                return self.page("room.html")
            if rest == ["state"]:
                return self.human_state(hit[1], hit[2], q)
        if kind == "n" and hit and hit[0] == "bring" and not rest:
            return self.agent_new(hit[1], hit[2])
        if kind == "a" and hit and hit[0] == "agent":
            room, me = hit[1], hit[2]
            if not rest:
                return self.agent_join(room, me)
            if rest == ["messages"]:
                return self.agent_messages(room, me, q)
            if rest == ["wait"]:
                return self.agent_wait(room, me, q)
            if rest == ["say"]:
                return self.text(405, "post the message as the request body: curl --data-binary @- ...\n")
        if kind == "a":
            return self.text(404, "This agent link is not valid (any more). Ask your human for a new one.\n")
        return self.text(404, "not found\n")

    def do_POST(self):
        parts, q = self.route()
        try:
            if parts == ["api", "rooms"]:
                return self.create_room()
            if parts == ["api", "me", "claim"]:
                return self.claim()
            if parts == ["auth", "logout"]:
                sid = self.cookie("pair_sid")
                if sid:
                    with lock:
                        accounts.logout(sid)
                return self.send(200, {"ok": True}, extra={"Set-Cookie": self.set_cookie("pair_sid", "", 0)})
            if parts[:1] == ["auth"] and len(parts) == 3:
                form = {k: v[-1] for k, v in parse_qs(self.body().decode("utf-8", "replace")).items()}
                return self.auth_route(parts[1:], form, form)
            if len(parts) < 2:
                return self.send(404, {"error": "not found"})
            kind, t, rest = parts[0], parts[1], parts[2:]
            hit = tokens.get(t)
            if kind == "r" and hit and hit[0] == "invite" and not rest:
                return self.join(hit[1])
            if kind == "h" and hit and hit[0] == "human":
                room, me = hit[1], hit[2]
                if rest == ["say"]:
                    text = str(self.json_body().get("text") or "")
                    return self.say(room, me, "human", text, json_reply=True)
                if rest == ["me"]:
                    return self.edit_me(room, me)
                if rest == ["sharing"]:
                    return self.sharing(room, me)
                if len(rest) == 3 and rest[0] == "agents" and rest[2] == "revoke":
                    return self.revoke_agent(room, me, rest[1])
            if kind == "a" and hit and hit[0] == "agent" and rest == ["say"]:
                text = self.body().decode("utf-8", "replace")
                return self.say(hit[1], hit[2], "agent", text, json_reply=False)
            if kind == "a":
                return self.text(404, "This agent link is not valid (any more). Ask your human for a new one.\n")
            return self.send(404, {"error": "not found"})
        except ValueError as e:
            return self.send(413, {"error": str(e)})

    # --- humans

    def create_room(self):
        b = self.json_body()
        name, who = clean_name(b.get("room"), 80), clean_name(b.get("name"))
        account = self.account()
        if not name or not who:
            return self.send(400, {"error": "room name and your name are needed"})
        ip = self.headers.get("Cf-Connecting-Ip") or (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or self.client_address[0]
        with lock:
            recent = [t for t in created.get(ip, []) if now() - t < 3600]
            if len(recent) >= NEW_PER_HOUR or len(rooms) >= MAX_ROOMS:
                return self.send(429, {"error": "too many rooms, try again later"})
            created[ip] = recent + [now()]
            rid = secrets.token_hex(6)
            meta = {"id": rid, "name": name, "created": round(now()), "invite": tok(), "people": []}
            room = Room(meta, [])
            os.makedirs(room.dir, exist_ok=True)
            open(os.path.join(room.dir, "messages.jsonl"), "a").close()
            index(room)
            p = add_person(room, "human", name=who, avatar=clean_avatar(b.get("avatar")), joined=round(now()),
                           **({"account": account["id"]} if account else {}))
            self.remember(account, p)
            room.post(None, "system", f"{who} opened the room")
        return self.send(200, {"url": f"/h/{p['token']}"})

    def join(self, room):
        b = self.json_body()
        who = clean_name(b.get("name"))
        account = self.account()
        if not who:
            return self.send(400, {"error": "a name is needed"})
        with lock:
            seat = room.seat_of(account)
            if seat:
                return self.send(200, {"url": f"/h/{seat['token']}"})
            if room.unique(who) != who:
                return self.send(409, {"error": f"{who} is already here, pick another name"})
            p = add_person(room, "human", name=who, avatar=clean_avatar(b.get("avatar")), joined=round(now()),
                           **({"account": account["id"]} if account else {}))
            self.remember(account, p)
            room.post(None, "system", f"{who} joined")
        return self.send(200, {"url": f"/h/{p['token']}"})

    def human_state(self, room, me, q):
        since = int(q.get("since") or 0)
        seen_v = int(q.get("v") or -1)
        wait = q.get("wait") == "1"
        with lock:
            if not room.present(me):
                room.changed()          # others see this human come online
            room.touch(me)
            if wait and room.version == seen_v and len(room.messages) <= since:
                room.waiting[me] = room.waiting.get(me, 0) + 1
                room.cond.wait_for(lambda: room.version != seen_v, timeout=25)
                room.waiting[me] -= 1
                room.touch(me)
            mine = room.person(me)
            state = {
                "room": room.meta["name"],
                "invite": f"{self.base()}/r/{room.meta['invite']}",
                "me": me,
                "v": room.version,
                "people": room.public_people(),
                "messages": [room.public_msg(m) for m in room.messages[since:]],
                "agents": [{"id": p["id"], "name": room.label(p), "present": room.present(p["id"])}
                           for p in room.meta["people"]
                           if p["kind"] == "agent" and p["owner"] == me and p.get("joined") and not p.get("revoked")],
                "bring": f"{self.base()}/n/{bring_token(room, mine)}",
                "name": mine["name"],
                "providers": self.providers(),
                "account": ({"name": acc["name"], "via": auth.LABEL[acc["provider"]]}
                            if (acc := accounts.accounts.get(mine.get("account") or "")) else None),
            }
        return self.send(200, state)

    def remember(self, account, p):
        """a signed-in person's name and face become their defaults for the next room"""
        if account:
            account["name"], account["avatar"] = p["name"], p.get("avatar") or ""
            accounts.save()

    def sharing(self, room, me):
        """anyone in the room may replace its invite link (one that went too far); announced"""
        b = self.json_body()
        with lock:
            who = room.person(me)["name"]
            if b.get("new_link"):
                tokens.pop(room.meta["invite"], None)
                room.meta["invite"] = tok()
                tokens[room.meta["invite"]] = ("invite", room, None)
                room.save()
                room.post(None, "system", f"{who} replaced the invite link")
        return self.send(200, {"ok": True})

    def claim(self):
        """after signing in: the seats this browser already held become the account's"""
        a = self.account()
        if not a:
            return self.send(401, {"error": "not signed in"})
        n = 0
        with lock:
            for url in (self.json_body().get("seats") or [])[:200]:
                hit = tokens.get(str(url).rsplit("/", 1)[-1])
                if hit and hit[0] == "human":
                    n += self.claim_seat(a, hit[1], hit[2])
        return self.send(200, {"claimed": n})

    def claim_seat(self, a, room, pid):
        p = room.person(pid)
        if p.get("account") or room.seat_of(a):
            return 0          # someone's already, or this account has its own seat here
        p["account"] = a["id"]
        room.save()
        if not a.get("avatar"):        # the face you already wear becomes the account's
            a["avatar"] = p.get("avatar") or ""
            accounts.save()
        room.changed()
        return 1

    def providers(self):
        return [{"id": p, "name": auth.LABEL[p]} for p in auth.config(DATA)]

    def auth_route(self, rest, q, form):
        """/auth/<provider>?next=… sends you off; /auth/<provider>/callback brings you back"""
        p, conf = rest[0], auth.config(DATA)
        if p not in conf:
            return self.text(404, "no such sign-in\n")
        c, redirect = conf[p], f"{self.base()}/auth/{p}/callback"
        if len(rest) == 1:
            nxt = q.get("next") or "/"
            state = secrets.token_urlsafe(24)
            with lock:
                for k in [k for k, v in logins.items() if now() - v[2] > 600]:
                    del logins[k]
                logins[state] = (p, nxt if SAFE_NEXT.match(nxt) else "/", now())
            return self.redirect(auth.authorize_url(p, c, redirect, state),
                                 [self.set_cookie("pair_state", state, 600, "/auth", cross_site=True)])
        if rest[1] != "callback":
            return self.text(404, "not found\n")
        state = q.get("state") or ""
        with lock:
            pending = logins.pop(state, None)
        if not pending or pending[0] != p or state != self.cookie("pair_state") or now() - pending[2] > 600:
            return self.failed("/", "the sign-in took too long or started in another browser. Please try again.")
        nxt = pending[1]
        if not q.get("code"):
            return self.redirect(nxt)      # they said no at the provider: back where they were
        try:
            sub, name = auth.identify(p, c, q["code"], redirect, form)
        except (auth.LoginError, KeyError, ValueError, OSError) as e:
            print(f"sign-in with {p} failed: {e}", flush=True)
            return self.failed(nxt, f"{auth.LABEL[p]} didn't let us in this time. Please try again.")
        with lock:
            a = accounts.find_or_create(p, sub, clean_name(name))
            hit = tokens.get(nxt.rsplit("/", 1)[-1]) if nxt.startswith("/h/") else None
            if hit and hit[0] == "human":
                self.claim_seat(a, hit[1], hit[2])   # signed in from a room: that seat comes along
            sid = accounts.login(a["id"])
        return self.redirect(nxt, [self.set_cookie("pair_sid", sid, auth.SESSION_DAYS * 86400),
                                   self.set_cookie("pair_state", "", 0, "/auth", cross_site=True)])

    def failed(self, back, why):
        self.send(400, f'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                       f'<title>PAIR</title><link rel="stylesheet" href="/door.css"><body class="door"><main><h1><span class="big">PAIR</span></h1>'
                       f'<div class="pn window"><p>Signing in didn\'t work: {why}</p><div class="row"><a class="btn" href="{back}">BACK</a></div></div></main>',
                  "text/html")

    def agent_new(self, room, owner):
        """someone fetched a human's agent link: a new agent, which appears once it connects"""
        with lock:
            pending = [p for p in room.meta["people"] if p["kind"] == "agent" and p["owner"] == owner
                       and not p.get("joined") and not p.get("revoked")]
            for old in pending[:max(0, len(pending) - PENDING_MAX + 1)]:
                old["revoked"] = round(now())
                tokens.pop(old["token"], None)
            p = add_person(room, "agent", owner=owner)
            body = agent_intro(room, p["id"], self.base())
        return self.text(200, body)

    def connect(self, room, p):
        if not p.get("joined"):
            p["joined"] = round(now())
            self.announce(room, p)

    def edit_me(self, room, me):
        """a human changes their name and/or face in this room; a new name is announced"""
        b = self.json_body()
        with lock:
            p = room.person(me)
            old = p["name"]
            name = clean_name(b.get("name")) if "name" in b else old
            if not name:
                return self.send(400, {"error": "a name is needed"})
            if name != old and room.unique(name, me) != name:
                return self.send(409, {"error": f"{name} is already here, pick another name"})
            if "avatar" in b:
                p["avatar"] = clean_avatar(b.get("avatar"))
            p["name"] = name
            room.save()
            if name != old:
                room.post(None, "system", f"{old} is now called {name}")
            else:
                room.changed()
        return self.send(200, {"name": name, "avatar": p["avatar"]})

    def revoke_agent(self, room, me, aid):
        with lock:
            p = next((p for p in room.meta["people"] if p["id"] == aid and p["kind"] == "agent"
                      and p["owner"] == me and not p.get("revoked")), None)
            if not p:
                return self.send(404, {"error": "no such agent"})
            p["revoked"] = round(now())
            tokens.pop(p["token"], None)
            room.save()
            if p.get("announced"):
                room.post(None, "system", f"{room.label(p)} left")
            else:
                room.changed()
        return self.send(200, {"ok": True})

    def say(self, room, me, kind, text, json_reply):
        text = text.strip("\n").rstrip()
        if not text.strip():
            return self.send(400, {"error": "empty"}) if json_reply else self.text(400, "empty message, nothing posted\n")
        if len(text) > MAX_TEXT:
            msg = f"message too long ({len(text)} chars, max {MAX_TEXT})"
            return self.send(413, {"error": msg}) if json_reply else self.text(413, msg + "\n")
        with lock:
            room.touch(me)
            if kind == "agent":
                self.connect(room, room.person(me))
            m = room.post(me, kind, text)
        if json_reply:
            return self.send(200, {"id": m["id"]})
        url = f"{self.base()}/a/{room.person(me)['token']}"
        return self.text(200, f"posted as #{m['id']}.\nNext, keep listening (a wait after every post, indefinitely):\n  curl -s '{url}/wait?since={m['id']}&timeout=90'\n")

    # --- agents

    def agent_join(self, room, me):
        with lock:
            room.touch(me)
            self.connect(room, room.person(me))
            body = agent_intro(room, me, self.base())
        return self.text(200, body)

    def announce(self, room, p):
        if not p.get("announced"):
            p["announced"] = True
            room.save()
            room.post(None, "system", f"{room.label(p)} joined, with {room.person(p['owner'])['name']}")

    def agent_messages(self, room, me, q):
        since = int(q.get("since") or 0)
        with lock:
            room.touch(me)
            self.connect(room, room.person(me))
            msgs = room.messages[since:]
            last = len(room.messages)
            url = f"{self.base()}/a/{room.person(me)['token']}"
            out = agent_render(room, msgs, me) if msgs else "(no messages)"
        return self.text(200, f"{out}\n\n--- last message #{last}\nNext: curl -s '{url}/wait?since={last}&timeout=90'\n")

    def agent_wait(self, room, me, q):
        since = int(q.get("since") or 0)
        try:
            timeout = max(1, min(3600, int(q.get("timeout") or 90)))
        except ValueError:
            timeout = 90
        url = f"{self.base()}/a/{room.person(me)['token']}"

        def fresh():
            return [m for m in room.messages[since:] if m["kind"] != "system" and m["from"] != me]

        # Headers go out at once and a newline every 20 s keeps proxies (Cloudflare
        # drops a request after 100 s of silence) from cutting a long wait.
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        deadline = now() + timeout
        with lock:
            room.touch(me)
            self.connect(room, room.person(me))
            room.waiting[me] = room.waiting.get(me, 0) + 1
            room.changed()
        try:
            while True:
                with lock:
                    left = deadline - now()
                    if not fresh() and left > 0:
                        room.cond.wait_for(lambda: bool(fresh()), timeout=min(20, left))
                    got = fresh()
                    if got or deadline - now() <= 0:
                        msgs = room.messages[since:]
                        last = len(room.messages)
                        out = agent_render(room, msgs, me) if got else "(nothing new)"
                        break
                self.wfile.write(b"\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            out = None
        finally:
            with lock:
                room.waiting[me] -= 1
                room.touch(me)
                room.changed()
        if out is not None:
            try:
                nxt = ("Next: the room is quiet, not over. Keep listening, run the same wait again:" if out == "(nothing new)" else
                       "Next: reply if you have something to say (POST /say), then keep listening:")
                self.wfile.write(f"{out}\n\n--- last message #{last}\n{nxt}\n  curl -s '{url}/wait?since={last}&timeout=90'\n".encode())
            except (BrokenPipeError, ConnectionResetError):
                pass


if __name__ == "__main__":
    load()
    accounts = auth.Accounts(DATA)
    port = int(os.environ.get("PORT", 8000))
    srv = ThreadingHTTPServer(("", port), Handler)
    srv.daemon_threads = True
    print(f"pair on :{port}, {len(rooms)} rooms", flush=True)
    srv.serve_forever()
