# Porpor TOPUP (React + Admin + Render)

ហាងបញ្ចូលហ្គេមពណ៌ខៀវ — **Vite + React + Express** + **private admin**.

## Local development

```bash
npm install

# Terminal 1 — API + admin backend
npm run dev:server

# Terminal 2 — React (proxies /api → :3000)
npm run dev
```

- Store: http://localhost:5173  
- Admin: http://localhost:5173/admin  
- Default password: `porpor-admin-2026` (override with `ADMIN_PASSWORD`)

## Production

```bash
npm install
npm run build
ADMIN_PASSWORD='your-strong-password' npm start
```

## Deploy on Render

1. Push this folder to GitHub
2. Render Dashboard → **New** → **Blueprint** (or Web Service)
3. Connect the repo
4. Render reads `render.yaml`:
   - Build: `npm install && npm run build`
   - Start: `npm start`
5. Set env **ADMIN_PASSWORD** (strong password) in Render dashboard
6. After deploy open: `https://YOUR-SERVICE.onrender.com/admin`

### Important (Render free tier)

- Disk is **ephemeral** — orders/settings in `data/db.json` reset on redeploy/sleep.
- For permanent storage, attach a persistent disk or connect Postgres later.

## Admin features

| Page | What |
|------|------|
| `/admin` | Dashboard stats |
| `/admin/orders` | Search, status, delete |
| `/admin/settings` | Site name, Telegram, announcements, coupons, closed games, maintenance |

## Coupons (default)

- `PORPOR10` — 10%
- `BLUE` — $0.50 (min $2)

## Structure

```
server/          Express API + session admin auth
src/pages/admin  Admin UI
src/pages        Storefront
render.yaml      Render blueprint
```


## Auto payment + auto top-up

### Flow
1. Customer pays **KHQR** via **Khmer System** (`ABA_API_KEY` + `ABA_MERCHANT_ID`)
2. Server polls payment → on paid → places order on **Khmer TopUp** (`KHMER_TOPUP_API_KEY`)
3. Polls until `completed` / `refunded`

### Environment

| Variable | Purpose |
|----------|---------|
| `ABA_API_KEY` | Khmer System payment |
| `ABA_MERCHANT_ID` | Khmer System merchant |
| `KHMER_TOPUP_API_KEY` | Auto delivery reseller key |
| `ADMIN_PASSWORD` | Admin panel |

Without ABA keys, checkout runs in **demo mode** (confirm simulates payment).

### Package mapping

In Admin → Settings, set `packageMap`:

```json
{ "ml-86": 268, "ff-100": 301 }
```

Local pack `id` → Khmer TopUp `package_id` from `GET /api/admin/kt-games`.

Docs: [Khmer TopUp API](https://khmer-topup.com/api-docs)
