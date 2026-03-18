# OR Timer

A mobile-first surgical session tracker built with **Next.js 14**, **Vercel Postgres**, and **Tailwind CSS**.

Track surgery duration, turnover times, and daily OR statistics — with offline support and a full analytics dashboard.

---

## Features

- ⏱ **Live Timer** — Surgery and turnover timers with automatic phase switching
- 📋 **Case Notes** — Optional per-case notes
- 📶 **Offline Support** — localStorage buffer syncs to DB when back online
- 📅 **History** — Expandable session history with per-case breakdown
- 📊 **Analytics** — Surgery/turnover trends, cases per day, anesthetist comparison
- ⬇️ **CSV Export** — Download any session or all sessions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Vercel Postgres (Neon) |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS |
| Charts | Recharts |

---

## Setup & Deployment

### 1. Clone the repo

```bash
git clone https://github.com/your-username/surgery-timer.git
cd surgery-timer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Vercel Postgres

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create or open your project → **Storage** tab → **Connect Database**
3. Create a new **Postgres (Neon)** database
4. Copy the `.env.local` credentials from the **Quickstart** tab
5. Create `.env.local` in the project root and paste the credentials

```bash
cp .env.local.example .env.local
# Edit .env.local with your values
```

### 4. Run the database migration

```bash
npm run db:migrate
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

```bash
npx vercel --prod
```

Or push to GitHub and link the repo in the Vercel dashboard. The Postgres environment variables are automatically injected when the database is connected to the project.

---

## Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Vercel Postgres pooling URL |
| `POSTGRES_URL_NON_POOLING` | Direct connection URL (for migrations) |
| `POSTGRES_USER` | DB user |
| `POSTGRES_PASSWORD` | DB password |
| `POSTGRES_HOST` | DB host |
| `POSTGRES_DATABASE` | Database name |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main timer page
│   ├── history/page.tsx      # Session history
│   ├── analytics/page.tsx    # Analytics dashboard
│   ├── api/
│   │   ├── sessions/         # Create & list sessions
│   │   ├── cases/            # Upsert & query cases
│   │   ├── export/           # CSV export
│   │   └── analytics/        # Aggregated stats
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── BottomNav.tsx         # Tab navigation
│   ├── NewDayModal.tsx       # Anesthetist capture modal
│   └── StatsPanel.tsx        # Daily statistics grid
└── lib/
    ├── db/
    │   ├── schema.ts         # Drizzle schema
    │   ├── index.ts          # DB connection
    │   └── migrate.ts        # Migration script
    ├── offlineQueue.ts       # localStorage buffer + state
    └── utils.ts              # Duration formatters
```
