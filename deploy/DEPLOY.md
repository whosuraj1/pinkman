# Deploying Pinkman without touching any Oracle networking

This guide deploys the backend on your existing Oracle Ubuntu (Arm) instance
**without modifying any network configuration** — no VCN, subnet, security list,
ingress rule, or firewall change. Nothing about your current "LNT" setup is affected.

**How that's possible:**
- The backend binds to `127.0.0.1` only → it is invisible to the network, so no
  port needs opening and no security list / ingress rule changes.
- A **Cloudflare Tunnel** exposes it publicly over HTTPS by making an *outbound*
  connection from your server to Cloudflare. No inbound ports.
- Everything lives in `/home/ubuntu/pinkman` with its own venv and its own
  systemd services (unique names) → fully isolated and removable.

---

## 0. Preflight (no changes made — just checks)

SSH in as usual, then:

```bash
# Confirm Python is present
python3 --version

# Confirm the port we'll use (8000) is FREE so we don't collide with existing apps.
# If this prints a line, 8000 is taken — pick another (e.g. 8010) and use it everywhere below.
sudo ss -ltnp | grep ':8000' || echo "port 8000 is free"

# Confirm outbound internet works (needed for Gemini + the tunnel). No inbound needed.
curl -s -o /dev/null -w "%{http_code}\n" https://www.cloudflare.com
```

---

## 1. Put the code on the server & set up the backend

Copy the project to `/home/ubuntu/pinkman` (via `git clone`, `scp`, or upload).

```bash
cd /home/ubuntu/pinkman/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> If `pip install` fails on Ubuntu 20.04's Python 3.8, install a newer Python
> (this only adds a language runtime, it does not touch networking):
> `sudo apt update && sudo apt install -y python3.11 python3.11-venv`
> then recreate the venv with `python3.11 -m venv .venv`.

Create the backend `.env`:

```bash
cp .env.example .env
nano .env
```

Set at minimum:
- `SECRET_KEY` → a long random string (generate: `openssl rand -hex 32`)
- `CORS_ORIGINS` → your frontend URL, e.g. `https://your-site.netlify.app`
  (add your tunnel hostname too once you have it, comma-separated)

Quick manual test (Ctrl+C to stop):

```bash
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
# in another shell:  curl http://127.0.0.1:8000/health   → {"status":"healthy"}
```

---

## 2. Run the backend as an isolated service

```bash
sudo cp /home/ubuntu/pinkman/deploy/pinkman-backend.service /etc/systemd/system/
# (edit the file first if you changed the port or the path)
sudo systemctl daemon-reload
sudo systemctl enable --now pinkman-backend
sudo systemctl status pinkman-backend --no-pager
```

It now runs on `127.0.0.1:8000`, survives reboots, and restarts on failure.
Still completely off the network.

---

## 3. Expose it with Cloudflare Tunnel (no ports opened)

Install cloudflared (Arm64 build for your instance):

```bash
curl -L -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i /tmp/cloudflared.deb
cloudflared --version
```

### Option A — Quick test tunnel (zero account, instant, temporary URL)

Best for verifying the whole chain works right now:

```bash
cloudflared tunnel --url http://localhost:8000
```

It prints a public `https://<random>.trycloudflare.com` URL. Put that in your
frontend's `VITE_API_URL` and confirm the app talks to the backend. The URL is
temporary and changes each run — use Option B for production.

### Option B — Named tunnel (stable custom HTTPS URL, survives reboots)

Requires a free Cloudflare account with a domain added to Cloudflare (you can use
a subdomain like `api.yourdomain.com`).

```bash
cloudflared tunnel login                 # opens a browser link; authorize your domain
cloudflared tunnel create pinkman    # note the Tunnel ID it prints
cloudflared tunnel route dns pinkman api.yourdomain.com
```

Create `~/.cloudflared/config.yml` from `deploy/cloudflared-config.example.yml`
(fill in the Tunnel ID and hostname), then install it as its own service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

Your backend is now at `https://api.yourdomain.com` — HTTPS included, no Oracle
networking changed.

> Dashboard alternative: in the Cloudflare Zero Trust dashboard you can create a
> tunnel, copy its token, run `sudo cloudflared service install <TOKEN>`, then add
> a Public Hostname pointing to `http://localhost:8000`. Same result, managed from
> the browser.

---

## 4. Point the frontend at the backend

In Netlify (or Cloudflare Pages), set the environment variable:

```
VITE_API_URL = https://api.yourdomain.com   (or the trycloudflare URL for testing)
```

Redeploy the frontend. Make sure the backend `.env` `CORS_ORIGINS` includes that
frontend origin, then restart the backend:

```bash
sudo systemctl restart pinkman-backend
```

Done. Reports (the generated Amazon XLSX files) persist on the VM disk under
`backend/generated_reports/`, and the SQLite DB lives at `backend/pinkman.db`.

---

## Full rollback (removes everything, touches nothing else)

```bash
sudo systemctl disable --now pinkman-backend cloudflared
sudo rm -f /etc/systemd/system/pinkman-backend.service
sudo systemctl daemon-reload
sudo dpkg -r cloudflared          # optional: remove the binary
rm -rf /home/ubuntu/pinkman   # optional: remove the app
```

No VCN, subnet, security list, ingress rule, or firewall entry was ever created
or modified, so there is nothing to undo on the networking side.
