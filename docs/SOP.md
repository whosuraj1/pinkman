# Pinkman — Standard Operating Procedure (SOP)

This document defines **how we work** on Pinkman. It doesn't change often. For the
running log of what we've done, see `PROGRESS.md`. For why key choices were made,
see `DECISIONS.md`.

---

## 1. Guiding principles

1. **One step at a time.** We complete and verify a step before starting the next.
   No skipping ahead.
2. **Everything is written down.** Every change is recorded in `PROGRESS.md` with
   *what*, *why*, and *how*. Every significant choice goes in `DECISIONS.md`.
3. **Foundation first, features later.** We get a stable frontend + backend running,
   then add features (Gemini, Google Drive, etc.) one by one.
4. **Don't touch existing server infrastructure.** No changes to the Oracle VCN,
   subnets, security lists, ingress rules, or firewall. (See DECISIONS.md #2.)
5. **Isolated & reversible.** Everything Pinkman installs is self-contained
   (own folder, own virtualenv, own uniquely-named services) and can be fully removed.
6. **GitHub is the source of truth.** Code lives in GitHub. The server and Netlify
   both get their code from there.

## 2. Project architecture (the big picture)

```
   Developer / Admin
         |
         v
   GitHub repo (whosuraj1/pinkman)  <-- source of truth
      |                     |
      | (auto-deploy)       | (git pull)
      v                     v
   Netlify                Oracle server (Ubuntu ARM, ap-mumbai-1)
   = FRONTEND             = BACKEND (FastAPI on 127.0.0.1:8000)
   (React app)                 |
                               | exposed via
                               v
                         Cloudflare Tunnel (outbound only, HTTPS)
                               |
   Browser  <------------------+  talks to frontend (Netlify) and backend (tunnel URL)
```

- **Frontend**: React + Vite, in `frontend/`. Hosted on Netlify.
- **Backend**: Python + FastAPI, in `backend/`. Runs on the Oracle server, bound to
  localhost only, exposed through a Cloudflare Tunnel so no network config changes.
- **Database**: SQLite file on the server (`backend/pinkman.db`) for now.
- **Deploy configs**: in `deploy/`. **Docs**: in `docs/`.

## 3. The delivery phases (high-level plan)

- **Phase 0 — Prototype scaffold** ✅ (frontend + backend code, stubs for AI/Drive)
- **Phase 1 — Code on GitHub** ✅
- **Phase 2 — Backend running on the server** ← (in progress)
- **Phase 3 — Expose backend via Cloudflare Tunnel**
- **Phase 4 — Frontend live on Netlify + connected to backend**
- **Phase 5 — Auto-update workflow (edit → push → live)**
- **Phase 6+ — Features, one at a time** (real login hardening, Gemini pipeline,
  Google Drive tool, image resize + bounded concurrency, etc.)

## 4. Routine for every change (once Phase 5 is set up)

1. Make the change in code.
2. Test locally / on the server.
3. Record it in `PROGRESS.md` (what / why / how / date).
4. Commit with a clear message and push to GitHub.
5. Frontend changes → Netlify auto-builds. Backend changes → `git pull` + restart
   the service on the server.
6. Verify it's live.

## 5. Standing conventions

- **Secrets** (passwords, keys) live only in `backend/.env` on the server. This file
  is **never** committed to GitHub (it's in `.gitignore`).
- **Ports**: backend uses `127.0.0.1:8000`. If that ever conflicts, change it in one
  place (the systemd service) and note it in PROGRESS.md.
- **Python**: the server runs Python 3.8, so backend code must stay 3.8-compatible
  (use `typing.List/Dict/Optional`, not `list[...]` / `X | None`). See DECISIONS.md #4.
- **Naming**: the product is "Pinkman" everywhere (UI, package names, services, DB).

## 6. How to fully undo everything (safety net)

On the server:
```
sudo systemctl disable --now pinkman-backend cloudflared
sudo rm -f /etc/systemd/system/pinkman-backend.service
sudo systemctl daemon-reload
rm -rf ~/pinkman
```
No networking was ever changed, so there is nothing to undo there.
