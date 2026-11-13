# Porpor Topup — Security

## App (this repo)
- Per-IP rate limits on `/api/*`, checkout, verify, login, chat
- Burst shield (short window)
- CSRF on state-changing admin routes
- Security headers (CSP, HSTS in production)
- Payment status only from ABA PayWay server check (no client "I paid")
- Admin login lockout after failed attempts
- Audit log in `DATA_DIR/security.log`

## Required at the edge (you configure)
1. **Cloudflare** Proxied (orange cloud) for `porportopup.com`
2. Bot Fight Mode ON
3. Rate limiting rules on `/api/*`
4. Security Level High; Under Attack Mode only during attacks
5. On Render set `TRUST_PROXY=2` if Cloudflare sits in front of Render
6. Strong `ADMIN_PASSWORD` + private `ADMIN_PATH`

App limits alone cannot stop large network DDoS — Cloudflare must proxy traffic.
