#!/usr/bin/env bash
# Pinkman one-command deploy (run from ~/pinkman):  ./deploy.sh "what changed"
set -e
cd "$(dirname "$0")"
MSG="${1:-update}"
echo "==> committing + pushing to GitHub"
git add -A
git commit -m "$MSG" || echo "(nothing new to commit)"
git push
echo "==> updating backend deps (if any changed)"
./backend/.venv/bin/pip install -q -r backend/requirements.txt || true
echo "==> restarting backend service"
sudo systemctl restart pinkman-backend
sleep 2
sudo systemctl is-active pinkman-backend
curl -s http://127.0.0.1:8000/health; echo
echo "==> done. Netlify auto-builds the frontend from the push (~1-2 min)."
