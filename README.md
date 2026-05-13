# CzechDataSync — No-code API konektor pro česká B2B e-commerce

Propojte **RAYNET CRM**, **Pohoda**, **Shoptet** a **Packeta** bez kódu za 5 minut.

## Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: Next.js API Routes, Node.js
- **Database**: Vercel Postgres (PostgreSQL + Prisma ORM)
- **Auth**: Clerk (email + Google OAuth)
- **API Key Storage**: Vercel KV (Redis) + AES-256-GCM encryption
- **AI**: OpenAI GPT-4o-mini (field mapping + invoice OCR)
- **Payments**: Stripe (CZK subscriptions)
- **Cron**: Vercel Cron Jobs
- **Hosting**: Vercel (region: fra1 — EU/GDPR compliant)

## Quick Deploy

### 1. Clone & install

```bash
git clone https://github.com/your-org/czechdatasync
cd czechdatasync
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Vyplňte všechny hodnoty v `.env.local` (viz sekce níže).

### 3. Database setup

```bash
npx prisma db push
npx prisma generate
```

### 4. Development

```bash
npm run dev
```

Otevřete http://localhost:3000

### 5. Deploy na Vercel

```bash
npm i -g vercel
vercel --prod
```

## Required Environment Variables

| Variable | Where to get |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | clerk.com → Dashboard → API Keys |
| `CLERK_SECRET_KEY` | clerk.com → Dashboard → API Keys |
| `DATABASE_URL` | Vercel Postgres → Settings → Connection String |
| `KV_REST_API_URL` | Vercel KV → Settings |
| `KV_REST_API_TOKEN` | Vercel KV → Settings |
| `ENCRYPTION_KEY` | Generate: `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | stripe.com → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks |
| `STRIPE_PRO_PRICE_ID` | Stripe Dashboard → Products |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` |

## Stripe Setup

1. Vytvořte produkt "CzechDataSync Pro" za 990 CZK/měsíc
2. Vytvořte produkt "CzechDataSync Business" za 2490 CZK/měsíc
3. Zkopírujte Price IDs do env vars
4. Přidejte webhook endpoint: `https://your-domain.cz/api/webhooks/stripe`
5. Povolte events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## Clerk Setup

1. Vytvořte aplikaci na clerk.com
2. Povolte Google OAuth provider
3. Přidejte webhook: `https://your-domain.cz/api/webhooks/clerk`
4. Povolte events: `user.created`, `user.deleted`

## Vercel Cron

Nastavení v `vercel.json` — cron runs:
- `/api/cron/run-syncs` — každých 5 minut (spouští naplánované syncy)
- `/api/cron/daily-digest` — každý den v 7:00

Přidejte `CRON_SECRET` do Vercel env vars.

## Architecture

```
User (Browser)
  ↓
Next.js App Router (Vercel — fra1)
  ├── Landing Page (/)
  ├── Dashboard (/app/*)
  │   ├── Connections — API keys stored encrypted in Vercel KV
  │   ├── Sync Creator — wizard with AI field mapping
  │   └── Billing — Stripe checkout/portal
  └── API Routes
      ├── /api/connections — CRUD + test
      ├── /api/syncs — CRUD + manual run
      ├── /api/cron/run-syncs — Vercel Cron trigger
      ├── /api/ai/* — GPT-4o-mini field mapping + OCR
      ├── /api/billing/* — Stripe checkout + portal
      └── /api/webhooks/* — Stripe + Clerk webhooks

Integrations:
  RAYNET CRM ← REST API (Bearer token)
  Shoptet    ← REST API (Access token)
  Pohoda     ← XML API over HTTP (Basic auth)
  Packeta    ← SOAP XML API
```

## Czech-specific Features

- **IČO** (identifikační číslo osoby) — 8-digit company ID with checksum validation
- **DIČ** (daňové identifikační číslo) — VAT number format: `CZ` + 8-10 digits
- **Variabilní symbol** — Czech payment reference, up to 10 digits
- **DPH rates** — 0%, 10%, 12%, 21% (Czech VAT rates)
- Full `cs-CZ` locale formatting (dates, currency, numbers)

## Pricing

| Plan | Price | Syncs/month |
|---|---|---|
| Free | 0 CZK | 100 |
| Pro | 990 CZK | Unlimited |
| Business | 2,490 CZK | Unlimited + Custom |

## Security

- API keys encrypted with AES-256-GCM before storage in Vercel KV
- All data stored in EU (Frankfurt) — GDPR compliant
- HTTPS/TLS 1.3 enforced
- Clerk handles authentication (SOC2 certified)
- Stripe handles payment data (PCI DSS Level 1)

## License

Proprietary — CzechDataSync s.r.o.
