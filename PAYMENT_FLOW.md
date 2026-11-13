# Porpor — ABA PayWay / KHQR flow

```
Customer picks pack → POST /api/checkout
        │
        ▼
 createQr()  →  khmer-system.com/aba-api/generate-qr
        │         (ABA_API_KEY + ABA_MERCHANT_ID)
        ▼
  QR image + payment_id + OPEN ABA deeplink
        │
        ├─ Scan KHQR (any bank app)
        └─ Or tap "OPEN ABA Mobile" → /open-aba?d=…
        │
        ▼
 Poll GET /api/checkout/:id/status (every ~2.5s)
        │
        ▼
 checkPayment(payment_id) → PAID?
        │
        ├─ No  → keep pending
        └─ Yes → status=paid → fulfillTopup (Khmer TopUp) → delivered
```

## Env (Render)

| Variable | Required | Note |
|----------|----------|------|
| `ABA_API_KEY` | yes | Profile / API key from Khmer System or ABA |
| `ABA_MERCHANT_ID` | yes | Merchant id |
| `KHMER_SYSTEM_URL` | no | Default `https://khmer-system.com` |
| `PUBLIC_BASE_URL` | recommended | e.g. `https://porpor-topup.onrender.com` (for OPEN ABA link) |
| `QR_EXPIRE_SEC` | no | Default `3600` (1 hour UI countdown) |
| `KHMER_TOPUP_API_KEY` | for auto topup | After payment |

## Test

1. Admin → Integrations / `GET /api/admin/payment-test` (diagnose QR)
2. Place a $0.10+ order on the site
3. Scan QR or OPEN ABA Mobile
4. Order should move pending → paid → delivered
