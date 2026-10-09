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

### Persistent storage (important)

`render.yaml` now mounts a **persistent disk** at `/var/data` (`DATA_DIR=/var/data`). It keeps:

- the games/packages you selected in Admin → Services
- uploaded game/package images (`/var/data/uploads`)
- orders and settings (`db.json`, with an automatic `db.json.bak`)

Without a persistent disk (e.g. Render free tier) the disk is **ephemeral** and everything resets on every redeploy/sleep — that is why selected services used to "disappear". Persistent disks require a paid plan (Starter or above).

## Admin features

| Page | What |
|------|------|
| `/admin` | Dashboard stats |
| `/admin/orders` | Search, status, delete |
| `/admin/services` | Choose Khmer TopUp games/packages to sell + markup, **upload game images and per-package images** (autosaves) |
| `/admin/settings` | Site name, Telegram, announcements, coupons, maintenance |

## Coupons (default)

- `PORPOR10` — 10%
- `BLUE` — $0.50 (min $2)

(Edit in Admin → Settings.)

## Structure

```
server/          Express API + session admin auth
src/pages/admin  Admin UI
src/pages        Storefront
render.yaml      Render blueprint
```


## Auto payment + auto top-up

### Flow
1. Admin → **Services**: pick which **Khmer TopUp** games/packages to sell (live from `GET /games`) and set a markup %
2. Customer picks a package, verifies their ID, pays **KHQR** via **Khmer System** (`ABA_API_KEY` + `ABA_MERCHANT_ID`)
3. Server confirms the payment → places the order(s) on **Khmer TopUp** (`KHMER_TOPUP_API_KEY`)
4. Polls until `completed` / `refunded`

Prices are always calculated on the server (supplier cost + markup − coupon); the browser total is never trusted.

### Environment

| Variable | Purpose |
|----------|---------|
| `ABA_API_KEY` | Khmer System payment |
| `ABA_MERCHANT_ID` | Khmer System merchant |
| `KHMER_TOPUP_API_KEY` | Game catalog + auto delivery |
| `ADMIN_PASSWORD` | Admin panel |

All three keys are required — there is no demo mode. Without them the store shows no games / checkout returns `not_configured`.

### Choosing services

Admin → Services: tick a game to sell it, expand it to choose individual packages, optionally set a per-game markup or mark it Featured.
If a game list looks empty or wrong, use **Raw API sample** on that page to see what Khmer TopUp returns.

Docs: [Khmer TopUp API](https://khmer-topup.com/api-docs)


## Images (Admin → Services)

- **Game image** — click the square on a game card and pick a file. It is cropped to a square and resized automatically.
- **Package image** — expand "Packages", click the square next to a package.
- **Default package image** — one image used by every package of that game that has no image of its own.
- Priority for a package: its own image → the game's default package image → the Khmer TopUp image → none.
- Click the red ✕ on an image to go back to the default. Accepted: PNG, JPG, WEBP, GIF (SVG is rejected on purpose).
- Every change in Services is saved automatically after ~1 second (status shown at the top right).
