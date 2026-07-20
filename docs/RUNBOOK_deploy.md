# Pinkman — Phase 5 Runbook: GitHub as source of truth + one-command deploy

Goal: make GitHub the single source of truth, so future updates are one command and
Netlify auto-builds the frontend. Do the stages in order. Text in `code` is what you
type; everything on the SERVER is in your SSH/PuTTY terminal unless it says WinSCP or
browser.

Current facts:
- Server: user `ubuntu`, IP `130.210.41.43`, repo at `~/pinkman`
- GitHub repo: `https://github.com/whosuraj1/pinkman` (Public)
- Netlify already auto-deploys the frontend from this repo on every push.

---

## Stage 1 — Transfer the newest code to the server (WinSCP)

1. Download the newest `pinkman.zip` (from chat).
2. Install WinSCP from https://winscp.net and open it.
3. Login dialog: File protocol `SFTP`, Host `130.210.41.43`, Port `22`,
   User `ubuntu`, Password blank. Click **Advanced → SSH → Authentication**, pick your
   `.ppk` key file, **OK**, then **Login**. Accept the host key if asked.
4. Left = your PC, Right = server. On the right, make sure you're in `/home/ubuntu`.
5. Drag `pinkman.zip` from the left onto the right panel. It uploads to `~`.

Checkpoint: `pinkman.zip` now sits in `/home/ubuntu` on the server.

---

## Stage 2 — Overlay the new code onto the repo (SSH terminal)

This unzips the new code and copies it over the repo WITHOUT touching your `.env`,
database, or virtualenv (those aren't in the zip, and `.gitignore` protects them).

```bash
cd ~
sudo apt install -y unzip        # if unzip isn't already present
rm -rf /tmp/pknew && mkdir /tmp/pknew
unzip -o pinkman.zip -d /tmp/pknew
# copy new files over the existing repo (preserves .env, .venv, pinkman.db)
cp -r /tmp/pknew/pinkman/. ~/pinkman/
chmod +x ~/pinkman/deploy.sh
echo "overlay done"
```

Quick sanity check that the new feature files arrived:

```bash
ls ~/pinkman/frontend/src/pages/Finish.jsx ~/pinkman/deploy.sh ~/pinkman/docs/SOP.md
```
All three should list without "No such file".

---

## Stage 3 — Restart backend & confirm it still works (SSH)

The backend auto-migrates the database (adds the new batch columns) on start.

```bash
sudo systemctl restart pinkman-backend
sleep 2
sudo systemctl is-active pinkman-backend
curl -s http://127.0.0.1:8000/health; echo
```
Want: `active` and `{"status":"healthy"}`.

---

## Stage 4 — GitHub token (so the server can push)

1. Browser → https://github.com/settings/tokens → **Fine-grained tokens** →
   **Generate new token**.
   - Name: `pinkman-server`
   - Expiration: your choice (e.g. 1 year)
   - **Repository access:** Only select repositories → `whosuraj1/pinkman`
   - **Permissions → Repository → Contents:** Read and write
   - Generate, then **copy the token** (starts with `github_pat_...`). You see it once.

2. On the SERVER, set your git identity and save the token so pushes don't prompt:

```bash
cd ~/pinkman
git config user.name "whosuraj1"
git config user.email "you@example.com"      # any email is fine
git config credential.helper store
```

(You'll paste the token on the first push in Stage 5. When the terminal asks for a
**password**, paste the token — the paste is invisible, that's normal, just paste and
press Enter. Username is your GitHub username `whosuraj1`.)

---

## Stage 5 — Push: GitHub becomes the source of truth (SSH)

```bash
cd ~/pinkman
git add -A
git commit -m "3.8 fix + 3-step Finish workflow + docs + deploy tooling"
git push
```
On the first push it asks for **Username** (`whosuraj1`) and **Password** (paste your
`github_pat_...` token). After this it's saved and won't ask again.

Checkpoint: refresh the GitHub repo in your browser — you should now see the `docs/`
folder, `deploy.sh`, `frontend/src/pages/Finish.jsx`, etc. GitHub now matches the
server.

This push also triggers Netlify to auto-build the new frontend (with the Finish
page). Watch Netlify → Deploys; wait for "Published" (~1-2 min).

---

## Stage 6 — Verify the Finish feature is live

1. Netlify shows a new **Published** deploy.
2. Open the app, hard refresh (Ctrl+Shift+R), log in as admin.
3. You should see a new **Finish** item in the sidebar. Assign a batch to an
   employee, process it, then confirm Done only unlocks after uploading the completed
   file.

---

## From now on — the daily loop

When we change code, you'll (a) get the new files onto the server (WinSCP drag, or
paste), then run ONE command from the repo root:

```bash
cd ~/pinkman
./deploy.sh "short description of the change"
```
That commits, pushes (Netlify auto-builds the frontend), reinstalls backend deps if
needed, and restarts the backend. Done.

---

## Rollback / safety
- Your secrets (`backend/.env`) are never committed (`.gitignore`).
- If a push ever complains about auth, re-check the token in Stage 4.
- To undo a bad change: `git log` to find the previous commit, then
  `git revert <commit>` and `./deploy.sh "revert"`.
