# Deploying to GitHub + Vercel

The app now runs on **PostgreSQL** instead of the local SQLite file. Vercel's
filesystem is read-only and wiped between requests, so a file-based database
would silently lose every booking you entered.

Everything else — booking parsing, PO generation, the PDF fonts — works
unchanged on Vercel.

---

## 1. Create the database (5 minutes)

Any Postgres works. Easiest is Vercel's own:

1. In Vercel, go to **Storage → Create Database → Postgres**.
2. Name it `sourceone` and pick the region closest to you.
3. Open the **.env.local** tab and copy the `DATABASE_URL` value.

Free alternatives that work identically: [Neon](https://neon.tech),
[Supabase](https://supabase.com). Copy their connection string — it must start
with `postgresql://` and end with `?sslmode=require`.

---

## 2. Point your local app at it and create the tables

In the `sourceone-erp` folder:

```bash
copy .env.example .env
```

Open `.env` and set:

- `DATABASE_URL` — the string from step 1
- `SESSION_SECRET` — generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then create the tables and demo data:

```bash
npm install
npm run db:setup
npm run dev
```

`db:setup` runs `prisma db push` (creates all 25 tables) followed by the seed.
Log in at http://localhost:3000 with `admin@sourceone.com` / `admin123` to
confirm it works before deploying.

> **Change that password** before the app is public — Info → Users, or add a
> new admin and disable the demo one.

---

## 3. Push to GitHub

```bash
cd sourceone-erp
git init
git add .
git commit -m "SourceOne ERP"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sourceone-erp.git
git push -u origin main
```

Before pushing, confirm no secrets are staged:

```bash
git status --short | findstr /C:".env"
```

That must print **nothing**. `.env` is gitignored; `.env.example` (safe, no real
values) is the one that gets committed.

---

## 4. Deploy on Vercel

1. **Add New → Project**, import the GitHub repo.
2. Framework preset is detected as **Next.js** — leave the build settings alone,
   `vercel.json` already sets the build command.
3. Expand **Environment Variables** and add:

| Name | Value |
|---|---|
| `DATABASE_URL` | the Postgres string from step 1 |
| `SESSION_SECRET` | the random string you generated |
| `GEMINI_API_KEY` | optional — packing slips |
| `GEMINI_MODEL` | optional — `gemini-2.0-flash` |
| `GEMINI_FALLBACK_MODELS` | optional — `gemini-2.0-flash-lite,gemini-2.5-flash,gemini-1.5-flash` |

If you created the database through Vercel Storage, `DATABASE_URL` is injected
for you — don't add it twice.

4. **Deploy.**

The tables already exist from step 2, so the first deploy comes up working. You
only need to re-run `npm run db:push` when the schema changes.

---

## What gets committed

Everything in the folder **except** what `.gitignore` excludes. Specifically:

**Committed** — `app/`, `components/`, `lib/`, `prisma/schema.prisma`,
`prisma/seed.js`, `public/fonts/`, `tools/`, `samples/`, `package.json`,
`package-lock.json`, `next.config.js`, `vercel.json`, `tailwind.config.js`,
`postcss.config.js`, `jsconfig.json`, `.gitignore`, `.env.example`,
`README.md`, `DEPLOYMENT.md`.

**Never committed** — `.env` (your real keys), `node_modules/`, `.next/`,
`.vercel/`, and any `prisma/*.db` file.

---

## Notes for production

**Uploads aren't stored.** Documents are read in memory, parsed, then discarded —
only the filename and extracted values are saved. Nothing needs a file store, but
it also means you can't re-open an uploaded PDF later. Add Vercel Blob or S3 if
you want the originals kept.

**Function timeout** is set to 60s in `vercel.json`, which covers PDF parsing plus
an AI call. Hobby-plan projects cap at 60s; Pro allows more if you ever need it.

**Connection pooling.** The pool is capped at 1 connection per serverless function
so a burst of traffic can't exhaust the database's connection limit. If you move to
a bigger Postgres plan, raise `DB_POOL_MAX`.

**Rotate the keys** currently sitting in your local `.env` — they were shared in
chat during development, so treat them as compromised.

---

## Updating after the first deploy

```bash
git add .
git commit -m "describe the change"
git push
```

Vercel rebuilds automatically. If you changed `prisma/schema.prisma`, also run
`npm run db:push` once against the production database.
