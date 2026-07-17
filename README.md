# Pinkman — Prototype

A two-part tool for AI-assisted Amazon listing generation from product images.

- **Frontend** (`frontend/`) — React + Vite. Deploys to **Netlify**.
- **Backend** (`backend/`) — Python + FastAPI. Deploys to your **Oracle server**.

> This is a **prototype scaffold**. The AI (Gemini) logic and the Google Drive
> API logic are **stubbed** with clearly-marked placeholders so you can drop in
> your own scripts later without changing the rest of the app.

---

## What's implemented

- Login with **Admin** and **Employee** roles (JWT).
- **Admin dashboard**: all users, per-employee progress, charts (bar + pie),
  work completed, all batches. Admin-only.
- **User dashboard**: only the logged-in user's own batches + status.
- **Create users** (admin only) and **assign batches** (with a Google Drive ZIP link).
- **Process Images** workflow: *Select Folder* (opens the OS folder picker) →
  *Start Process* → **live progress** (processed / remaining / current image).
- Backend processes images **one by one**; on finish it generates an **Amazon
  category template (.xlsx)** with default values pre-filled.
- **Done** button unlocks *only* after processing completes; clicking it marks
  the batch **completed** — instantly reflected on both dashboards.
- **Reports** section in the sidebar (admin + user) to download generated templates.
- **Tools · Drive Upload** section: check storage → delete old images if needed →
  upload → download an **XLSX of image links**.
- **Logout** in the sidebar. **Fira Code** font throughout.

## Where your code plugs in later

| Your script | File to edit |
|---|---|
| Gemini prompt/analysis → title, description, bullets, keywords | `backend/services/ai_stub.py` (`analyze_image`) |
| Real Amazon category template columns/defaults | `backend/services/amazon_template.py` |
| Google Drive upload / storage / cleanup | `backend/services/drive_stub.py` |

Keep the **return shapes** the same and nothing else needs to change.

---

## Run locally

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # edit if you like
uvicorn main:app --reload   # http://localhost:8000
```
On first run it creates two demo accounts:
- **admin / admin123**
- **employee1 / employee123**

### Frontend
```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_URL if backend isn't on localhost:8000
npm run dev                 # http://localhost:5173
```

---

## Deploy

### Backend → Oracle server
1. Copy the `backend/` folder to the server.
2. `pip install -r requirements.txt`
3. Create `.env`:
   - `SECRET_KEY` → a long random string
   - `CORS_ORIGINS` → your Netlify URL, e.g. `https://your-site.netlify.app`
4. Run behind a process manager / reverse proxy, e.g.:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
   (Put Nginx + HTTPS in front for production. Open the port in your Oracle
   security list / firewall.)

### Frontend → Netlify
1. Push this repo to GitHub and connect it to Netlify, **or** deploy the
   `frontend/` folder directly.
2. Netlify build settings (already in `frontend/netlify.toml`):
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add a Netlify **environment variable**:
   - `VITE_API_URL = https://your-oracle-server-address` (your backend URL)

---

## Notes / production hardening (later)

- Job progress state is in-memory (fine for one process). For multiple workers,
  move it to Redis or the DB.
- SQLite is used for simplicity; switch `DATABASE_URL` to Postgres for production.
- Uploaded image *files* aren't sent to the backend yet — the prototype drives
  progress and template generation from filenames. When wiring real Gemini,
  switch `POST /processing/start` to accept the actual files (multipart) and
  pass their paths into the job.
