# Pinkman — Progress Log

The running record of everything we do: **what**, **why**, **how**, and **status**.
Newest entries at the bottom. Dates are UTC-ish (server/working dates).

Legend: ✅ done · 🔄 in progress · ⏳ next · ❗blocked

---

## Phase 0 — Prototype scaffold ✅

- **What:** Built the initial full-stack prototype (frontend + backend) with the AI
  (Gemini) and Google Drive logic left as clearly-marked stubs.
- **Why:** Establish a working foundation to iterate on; features come later.
- **How:** 
  - Backend: FastAPI + SQLite (SQLModel), JWT auth with admin/user roles, endpoints
    for users, batches, image-processing jobs (with live progress), reports, and a
    Drive tool. Amazon template generated as `.xlsx`.
  - Frontend: React + Vite, Fira Code font, login + role-based dashboards, sidebar
    (Dashboard / Users & Batches / Process Images / Tools / Reports / Logout),
    folder picker, live progress UI, recharts charts.
  - Verified backend end-to-end and frontend production build locally.
- **Status:** ✅

## Phase 1 — Code on GitHub ✅

- **What:** Renamed the product to **Pinkman** everywhere; created GitHub repo and
  uploaded the code.
- **Why:** GitHub is our source of truth; the server and Netlify both pull from it.
- **How:** Global rename ImageLister→Pinkman / imagelister→pinkman across UI, package
  names, backend API title, DB filename, systemd service, paths, docs. Created repo
  `whosuraj1/pinkman` (currently Public) and uploaded `backend/`, `deploy/`,
  `frontend/`, `README.md` via the GitHub web uploader.
- **Note:** Web drag-drop skipped hidden dotfiles (`.env.example`, `.gitignore`), so
  they are not in the repo. Not a blocker (we create `.env` directly on the server).
- **Status:** ✅

## Phase 2 — Backend running on the server ✅

- **What:** Get the FastAPI backend running on the Oracle instance.
- **Why:** It's the core of the app; everything else connects to it.
- **How (so far):**
  - `git clone` of the repo into `~/pinkman` on the server. ✅
  - Confirmed port 8000 is free. ✅
  - Installed `python3.8-venv`, created `.venv`, `pip install -r requirements.txt`
    (all packages installed cleanly on Python 3.8/ARM). ✅
  - Created `backend/.env` directly on the server (dotfiles weren't in the repo),
    with a generated `SECRET_KEY`. ✅
  - **Fix:** First run failed because some code used Python 3.9+ type-hint syntax
    (`list[str]`, `int | None`) that Python 3.8 rejects. Applied a patch converting
    those to `typing.List/Dict/Optional`. Verified the patched backend boots and
    returns healthy. (See DECISIONS.md #4.) ✅
  - Attempted install of Python 3.11 via deadsnakes first — **failed** (no ARM
    build). Abandoned; stayed on system Python 3.8 instead. (dead-end noted so we
    don't retry it.)
  - Verified health check on the server: `{"status":"healthy"}`. ✅
  - Installed the `pinkman-backend` systemd service (localhost:8000, runs as
    `ubuntu`, `enabled` for auto-start on boot, `Restart=on-failure`). Confirmed
    `Active: active (running)`, ~60 MB RAM, responding healthy. ✅
- **Status:** ✅ Backend runs permanently on the server, isolated and reboot-safe.

## Phase 3 — Expose backend via Cloudflare Tunnel ✅
- **What:** Gave the backend a public HTTPS address without touching Oracle networking.
- **Why:** The Netlify frontend (public internet) must reach the backend, which is
  bound to localhost. A Cloudflare Tunnel does this via an outbound connection —
  no inbound ports, no VCN/security-list changes. (DECISIONS.md #2)
- **How:** Installed `cloudflared` 2026.7.2 (ARM64 .deb). Started a free "quick"
  tunnel: `cloudflared tunnel --url http://localhost:8000`. Cloudflare issued the
  temporary URL below. Verified the full public chain:
  `curl https://<url>/health` → `{"status":"healthy"}`. ✅
- **Current public URL (TEMPORARY):**
  `https://stick-thoughts-foundations-baking.trycloudflare.com`
  ⚠️ This changes whenever the tunnel restarts. It also currently runs only inside
  the SSH session (not yet a permanent service). To be made permanent later
  (own service + real domain). (DECISIONS.md #2 trade-off)
- **Status:** ✅ (temporary URL; permanence deferred)

## Phase 4 — Frontend live on Netlify + connected to backend ✅
- **What:** Deployed the React frontend to Netlify and connected it to the backend;
  achieved a working end-to-end login.
- **Why:** Make the app usable in a browser; prove the whole chain works.
- **How:**
  - Connected GitHub repo `whosuraj1/pinkman` to Netlify. Build settings: base
    `frontend`, build `npm run build`, publish `frontend/dist`, functions dir empty.
    SPA routing comes from `frontend/netlify.toml`. Site published at
    `https://gilded-peony-a129b3.netlify.app`. ✅
  - Set backend `CORS_ORIGINS` to the Netlify URL; restarted service. Verified the
    CORS preflight returns the correct `access-control-allow-origin`. ✅
  - Set Netlify env var `VITE_API_URL` to the live tunnel URL. ✅
  - Logged in as admin → reached the Admin Dashboard. Full chain confirmed:
    browser → Netlify → Cloudflare tunnel → backend. ✅
- **Hard-won lessons (IMPORTANT — see open items):**
  1. `VITE_API_URL` is read at BUILD time. Changing the env var does nothing until a
     **fresh Netlify deploy** runs. Always: edit var → Trigger deploy → Deploy site →
     hard-refresh (Ctrl+Shift+R).
  2. The **temporary trycloudflare URL changes every time the tunnel restarts** and
     dies when the SSH session closes. We chased a moving URL ~6 times. The frontend
     shows a generic "Incorrect username or password" for ANY failed request
     (including network failures), which masked the real cause.
- **Status:** ✅ (working, but on a fragile temporary tunnel URL — must be made
  permanent; tracked below)

## Phase 5 — Auto-update workflow ⏳
- Set up git auth on the server; establish edit → push → (Netlify auto-build /
  server git pull + restart) routine. Also push the Phase-2 3.8 fix up to GitHub so
  server and repo match.

## Feature: 3-step Finish workflow (moved "Done" to final step) ✅ (2026-07-18)
- **What:** Reworked the completion flow from 2 steps to 3. "Done" is now the true
  final action, gated on the user uploading their completed template.
- **Why:** Real workflow is: (1) Process Images → download template, (2) Drive Upload
  tool → get image-links file, (3) manually paste URLs into the template, (4) upload
  the completed file on the Finish page, then Done. Owner wanted Done to be the last
  step, not something clicked during processing.
- **How:**
  - Backend: added `has_template`, `completed_file_path`, `completed_filename` to
    Batch (with lightweight auto-migration in `database.py` so existing DBs get the
    new columns without data loss). Job sets `has_template=True` when it generates the
    template. New endpoints: `POST /batches/{id}/upload-completed` (multipart),
    `GET /batches/{id}/completed-file` (admin or owner). `POST /batches/{id}/done`
    now REQUIRES a completed file to be uploaded first.
  - Frontend: removed the Done button from **Process Images** (now shows a "Next
    steps" guide; dropdown already hides completed batches). New **Finish** page in
    the sidebar: lists only batches with a generated template; upload completed file
    → Done unlocks; shows a "Completed batches" list with re-download (admin + user).
  - Verified end-to-end (Done blocked until upload; upload→Done→completed; admin
    re-download works). Frontend builds clean.
- **Status:** ✅ built & tested locally. NOT yet deployed (needs GitHub push + server
  pull + Netlify rebuild — pending the Phase 5 auto-update setup).

## Phase 6+ — Features (one at a time) ⏳
- Harden login / change default demo passwords, Gemini pipeline, Google Drive tool,
  image resize + bounded concurrency, etc. Owner will supply feature requests and
  scripts.

---

### Live URLs (current)
- Frontend (Netlify): `https://gilded-peony-a129b3.netlify.app`
- Backend (STOPGAP tunnel service): URL changes only when the tunnel service
  restarts (reboot/crash/manual). Currently
  `https://pitch-opens-massage-increasingly.trycloudflare.com`
  Service: `pinkman-tunnel` (systemd), logs at `/var/log/pinkman-tunnel.log`.

### Phase 4.5 — Stopgap: tunnel as a permanent service 🔄
- **What:** Made the free quick-tunnel a systemd service (`pinkman-tunnel`) that
  auto-starts on boot and restarts on failure. Owner declined paying for a domain,
  so the permanent named-tunnel fix is deferred.
- **Why:** Stop the tunnel from dying when the SSH session closes, so the app stays
  usable between sessions. URL still changes on service restart (free-tunnel limit).
- **How:** `/etc/systemd/system/pinkman-tunnel.service`, `--protocol http2`,
  `Restart=always`, logs to `/var/log/pinkman-tunnel.log`. Enabled + started; active.
- **Next:** Build a one-command re-sync helper (reads new URL → updates backend CORS
  → updates Netlify `VITE_API_URL` via Netlify API → triggers redeploy). Needs a
  Netlify personal access token + site ID.
- **Status:** ✅ Tunnel service live; login confirmed working through the service
  URL (`pitch-opens-massage-increasingly.trycloudflare.com`) on 2026-07-18.
  Survives SSH disconnect + reboot. URL still changes on service restart → re-sync
  helper next.
- **2026-07-18 incident (RESOLVED):** Login failed in browser with **401**. Diagnosed
  methodically: server-side login (localhost) worked, AND login *through the tunnel*
  via curl worked — so backend, DB, credentials, tunnel, and URL were all fine. The
  browser was sending a **wrong password (Brave autofill/saved-password)**. Fixed by
  typing credentials fresh / using a private window. LESSON: the generic "Incorrect
  username or password" message plus browser autofill can masquerade as an infra
  problem. Check the actual request payload before assuming the tunnel/URL broke.
  Also confirmed: the tunnel URL had NOT changed across the reboot — it held
  `pitch-opens-massage-increasingly`.

### Open items / reminders
- [ ] **TOP PRIORITY: make the tunnel permanent (fixed URL + auto-start service).**
      Needs a domain on Cloudflare. Ends the URL-churn problem for good. Until then,
      login breaks whenever the SSH session/tunnel restarts.
- [ ] Confirm Oracle account type + set ~$1 budget alert (billing safety). (DEC #3)
- [ ] Change default demo credentials (admin/admin123, employee1/employee123) before real use.
- [ ] Re-add `.gitignore` / `.env.example` to the repo (skipped by web upload).
- [ ] Push the Python-3.8 compatibility fix + docs/ to GitHub during Phase 5.
