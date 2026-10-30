# Porpor TOPUP — Security

## Included
1. HTTPS headers (HSTS, CSP, X-Frame-Options)
2. Server-side payment validation (catalog price + provider checkPayment only)
3. CSRF (cookie + X-CSRF-Token) on admin + checkout
4. Rate limiting (API, login lockout, checkout, pay status)
5. Automatic backups every 6h + manual download
6. Audit log (`data/security.log`)
7. IP tracking on orders

## Not included
- Admin 2FA (removed by request)

## Env
```
ADMIN_PASSWORD=strong-password-12chars
ADMIN_PATH=porpor-panel-06
```

Use Cloudflare Proxy + WAF in front of the domain.
