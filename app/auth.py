"""Signing in with Google, GitHub, Discord or Apple — optional, next to the links.

An account is a provider's user id plus a name and a face to start from; it owns
nothing but the seats (/h/ tokens) its person holds in rooms, so every link keeps
working whether or not anyone signs in. Only what is needed is kept: provider,
the provider's user id, a display name. No e-mail, no access tokens.

Providers are switched on by data/oauth.json, re-read on every use, e.g.
  {"github":  {"client_id": "…", "client_secret": "…"},
   "google":  {"client_id": "…", "client_secret": "…"},
   "discord": {"client_id": "…", "client_secret": "…"},
   "apple":   {"client_id": "<services id>", "team_id": "…", "key_id": "…", "private_key_file": "AuthKey_….p8"}}
Each one's redirect URI is <origin>/auth/<provider>/callback.

ID tokens are read without checking their signature: they come straight from the
provider's token endpoint over TLS, in exchange for our client secret, which
OpenID Connect Core 3.1.3.7 allows; audience and issuer are still checked.
"""
import base64
import hashlib
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "pair (https://github.com/rdaems/pair-prompting)"   # Discord's edge refuses Python's default
ORDER = ["google", "github", "discord", "apple"]
LABEL = {"google": "Google", "github": "GitHub", "discord": "Discord", "apple": "Apple"}
SESSION_DAYS = 180


def config(data):
    try:
        with open(os.path.join(data, "oauth.json")) as f:
            c = json.load(f)
    except (OSError, ValueError):
        return {}
    return {p: {**c[p], "_data": data} for p in ORDER if isinstance(c.get(p), dict) and c[p].get("client_id")}


def b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def unb64url(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def jwt_claims(token):
    return json.loads(unb64url(token.split(".")[1]))


def http(url, data=None, headers=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={"User-Agent": UA, "Accept": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise LoginError(f"{url.split('/')[2]} said {e.code}: {e.read()[:300].decode('utf-8', 'replace')}")


class LoginError(Exception):
    pass


# ---------- the providers: where to send people, and who came back ----------

def authorize_url(p, c, redirect, state):
    q = {"client_id": c["client_id"], "redirect_uri": redirect, "response_type": "code", "state": state}
    if p == "google":
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({**q, "scope": "openid profile", "prompt": "select_account"})
    if p == "github":
        return "https://github.com/login/oauth/authorize?" + urllib.parse.urlencode({**q, "allow_signup": "true"})
    if p == "discord":
        return "https://discord.com/oauth2/authorize?" + urllib.parse.urlencode({**q, "scope": "identify", "prompt": "none"})
    if p == "apple":
        # asking for the name makes Apple post the answer back (form_post)
        return "https://appleid.apple.com/auth/authorize?" + urllib.parse.urlencode({**q, "scope": "name", "response_mode": "form_post"})


def identify(p, c, code, redirect, form):
    """the code we were handed -> (provider's user id, display name)"""
    creds = {"client_id": c["client_id"], "client_secret": c.get("client_secret", ""), "code": code,
             "redirect_uri": redirect, "grant_type": "authorization_code"}
    if p == "google":
        t = http("https://oauth2.googleapis.com/token", creds)
        claims = jwt_claims(t["id_token"])
        if claims.get("aud") != c["client_id"] or claims.get("iss") not in ("https://accounts.google.com", "accounts.google.com"):
            raise LoginError("Google's token is for someone else")
        return claims["sub"], claims.get("given_name") or claims.get("name") or ""
    if p == "github":
        t = http("https://github.com/login/oauth/access_token", creds)
        if "access_token" not in t:
            raise LoginError(f"GitHub: {t.get('error_description') or t}")
        u = http("https://api.github.com/user", headers={"Authorization": "Bearer " + t["access_token"]})
        return str(u["id"]), u.get("name") or u.get("login") or ""
    if p == "discord":
        t = http("https://discord.com/api/oauth2/token", creds)
        u = http("https://discord.com/api/users/@me", headers={"Authorization": "Bearer " + t["access_token"]})
        return str(u["id"]), u.get("global_name") or u.get("username") or ""
    if p == "apple":
        t = http("https://appleid.apple.com/auth/token", {**creds, "client_secret": apple_secret(c)})
        claims = jwt_claims(t["id_token"])
        if claims.get("aud") != c["client_id"] or claims.get("iss") != "https://appleid.apple.com":
            raise LoginError("Apple's token is for someone else")
        name = ""
        try:   # Apple sends the name once, on the very first sign-in, beside the code
            n = json.loads(form.get("user") or "{}").get("name") or {}
            name = n.get("firstName") or n.get("lastName") or ""
        except ValueError:
            pass
        return claims["sub"], name
    raise LoginError("unknown provider")


# ---------- Apple's client secret: a JWT signed ES256 with the team's key ----------
# Pure Python P-256, since the server takes no dependencies. Signing happens once
# per sign-in, so plain affine arithmetic is fast enough.

P = 2**256 - 2**224 + 2**192 + 2**96 - 1
N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
G = (0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296,
     0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5)


def ec_add(a, b):
    if a is None:
        return b
    if b is None:
        return a
    if a[0] == b[0] and (a[1] + b[1]) % P == 0:
        return None
    if a == b:
        m = (3 * a[0] * a[0] - 3) * pow(2 * a[1], -1, P)
    else:
        m = (b[1] - a[1]) * pow(b[0] - a[0], -1, P)
    x = (m * m - a[0] - b[0]) % P
    return x, (m * (a[0] - x) - a[1]) % P


def ec_mul(k, pt):
    out = None
    while k:
        if k & 1:
            out = ec_add(out, pt)
        pt = ec_add(pt, pt)
        k >>= 1
    return out


def es256(d, msg):
    z = int.from_bytes(hashlib.sha256(msg).digest(), "big")
    while True:
        k = secrets.randbelow(N - 1) + 1
        r = ec_mul(k, G)[0] % N
        s = pow(k, -1, N) * (z + r * d) % N
        if r and s:
            return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def p8_key(pem):
    """the private scalar out of a PKCS#8 P-256 key (Apple's AuthKey_….p8)"""
    der = base64.b64decode("".join(l for l in pem.strip().splitlines() if not l.startswith("-----")))
    i = der.find(b"\x02\x01\x01\x04\x20")   # ECPrivateKey: version 1, then the 32-byte key
    if i < 0:
        raise LoginError("Apple key: not a P-256 PKCS#8 key")
    return int.from_bytes(der[i + 5:i + 37], "big")


def apple_secret(c):
    pem = c.get("private_key") or open(c["private_key_file"] if os.path.isabs(c["private_key_file"])
                                       else os.path.join(c["_data"], c["private_key_file"])).read()
    head = {"alg": "ES256", "kid": c["key_id"]}
    t = int(time.time())
    body = {"iss": c["team_id"], "iat": t, "exp": t + 600, "aud": "https://appleid.apple.com", "sub": c["client_id"]}
    signing = (b64url(json.dumps(head).encode()) + "." + b64url(json.dumps(body).encode())).encode()
    return signing.decode() + "." + b64url(es256(p8_key(pem), signing))


# ---------- accounts and sessions: data/accounts.json ----------

class Accounts:
    def __init__(self, data):
        self.path = os.path.join(data, "accounts.json")
        try:
            with open(self.path) as f:
                s = json.load(f)
        except (OSError, ValueError):
            s = {}
        self.accounts = s.get("accounts", {})     # id -> {id, provider, sub, name, avatar, created}
        self.sessions = s.get("sessions", {})     # sha256(cookie) -> {account, created}
        t = time.time()
        self.sessions = {k: v for k, v in self.sessions.items() if t - v["created"] < SESSION_DAYS * 86400}

    def save(self):
        with open(self.path + ".tmp", "w") as f:
            json.dump({"accounts": self.accounts, "sessions": self.sessions}, f, indent=1)
        os.chmod(self.path + ".tmp", 0o600)
        os.replace(self.path + ".tmp", self.path)

    def find_or_create(self, provider, sub, name):
        a = next((a for a in self.accounts.values() if a["provider"] == provider and a["sub"] == sub), None)
        if not a:
            aid = "u" + secrets.token_hex(6)
            a = self.accounts[aid] = {"id": aid, "provider": provider, "sub": sub, "name": name, "avatar": "", "created": round(time.time())}
        elif name and not a.get("name"):
            a["name"] = name
        self.save()
        return a

    def login(self, aid):
        sid = secrets.token_urlsafe(32)
        self.sessions[hashlib.sha256(sid.encode()).hexdigest()] = {"account": aid, "created": round(time.time())}
        self.save()
        return sid

    def logout(self, sid):
        if self.sessions.pop(hashlib.sha256(sid.encode()).hexdigest(), None):
            self.save()

    def by_session(self, sid):
        s = self.sessions.get(hashlib.sha256(sid.encode()).hexdigest()) if sid else None
        if not s or time.time() - s["created"] > SESSION_DAYS * 86400:
            return None
        return self.accounts.get(s["account"])
