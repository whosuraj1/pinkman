# Pinkman — Decisions Log

Important choices and the reasoning behind them, so we never re-litigate settled
questions. Newest at the bottom.

---

### #1 — Split architecture: frontend on Netlify, backend on Oracle
**Why:** The frontend is a static React build (cheap/free to host on a CDN like
Netlify). The backend must run long processes and call external APIs (Gemini,
Drive), so it needs a real always-on server, which the Oracle instance provides.

### #2 — Expose the backend with Cloudflare Tunnel (not by opening a port)
**Why:** Hard requirement from the owner: do **not** modify any Oracle networking
(VCN, subnets, security lists, ingress rules, firewall). A Cloudflare Tunnel makes
an *outbound* connection from the server to Cloudflare, so the backend is reachable
over HTTPS with zero inbound ports and zero network-config changes. It also gives a
free HTTPS certificate, which the Netlify (HTTPS) frontend needs to call the backend
without mixed-content errors.
**Trade-off for now:** Using the free temporary `trycloudflare.com` URL, which
changes on restart. A cheap domain later makes it permanent (~5 min switch).

### #3 — Keep the instance at its current shape (3 OCPU / 18 GB) but watch billing
**Why:** More than enough for the workload (3 employees × up to 100 images, since
Gemini does the heavy compute remotely). BUT Oracle's Always Free allowance was cut
to 2 OCPU / 12 GB on 2026-06-15, and this instance (launched 2026-07-07) is above
that. Action: confirm account type and set a ~$1 budget alert. Can resize down to
2/12 if we want guaranteed $0; that's still enough.

### #4 — Backend code must stay Python 3.8-compatible
**Why:** The Oracle server is Ubuntu 20.04 (ARM), whose system Python is 3.8. Newer
Python (3.11) isn't available via deadsnakes on ARM, and building from source adds
complexity. So instead of upgrading Python, we keep the code 3.8-friendly: use
`typing.List/Dict/Optional/Union` instead of `list[...]`, `dict[...]`, `X | None`.
(This was applied as a patch on 2026-07-17 after the first run failed.)

### #5 — Record-keeping via docs/ (SOP, PROGRESS, DECISIONS)
**Why:** Owner wants the project organized from the start with a clear paper trail
of what/why/how, so nothing gets missed as features are added over time.
