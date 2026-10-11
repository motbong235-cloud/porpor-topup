# Porpor TOPUP — Security (7 controls)

## 1. HTTPS + WAF
- Render HTTPS + HSTS headers in app
- Cloudflare Proxy + WAF recommended in front of domain

## 2. Server-side payment validation
- Price always from server catalog (never client total)
- Paid status only after Khmer System `checkPayment`
- Amount mismatch blocks auto-fulfill

## 3. Prepared statements + CSRF
- **No SQL DB** (JSON file store) → no SQL injection surface; inputs sanitized
- **CSRF**: cookie `porpor_csrf` + header `X-CSRF-Token` on admin + checkout POST

## 4. Admin 2FA (TOTP)
- Enable via `POST /api/admin/2fa/enable` with secret + authenticator code
- Login requires password + 6-digit code when enabled
- Use Google Authenticator / Authy

## 5. Automatic backups
- Every 6 hours → `data/backups/db-*.json` (keeps 14)
- Manual: Admin Orders → Backup, or `POST /api/admin/backups/run`

## 6. Rate limiting
- Global API, login lockout, checkout, payment status limits per IP

## 7. Logging & monitoring
- `data/security.log` (login, pay, backup, 2FA)
- Admin: `GET /api/admin/audit-log`
- Watch Render logs + Cloudflare analytics

## Env
```
ADMIN_PASSWORD=strong-password-here
ADMIN_PATH=porpor-panel-06
```
