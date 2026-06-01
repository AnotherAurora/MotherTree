# MotherTree Admin Dashboard

A clean, modern admin dashboard for managing MotherTree game data stored in Supabase PostgreSQL.

## Stack

- **Next.js 16** (App Router, Server Actions)
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (`@supabase/supabase-js`) with service-role server access

## Features

- Sidebar navigation for all 8 database tables
- List, Create, Update, and Soft-Delete (where `deleted_at` exists)
- Searchable foreign-key dropdowns with human-readable labels
- Strict enum dropdowns matching exact database casing
- Auto-suggest next ID (tables use manual integer IDs)
- Environment-variable based Supabase configuration

## Tables

| Table | Soft Delete |
|-------|-------------|
| Tags | Yes |
| Awakeners | No (hard delete) |
| Desires | Yes |
| Manifestations | Yes |
| Tag Interactions | Yes |
| Interaction Overrides | Yes |
| Desire Demands | Yes |
| Paths | No (hard delete) |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/AnotherAurora/MotherTree.git
cd MotherTree
npm install
```

### 2. Configure Supabase environment

Copy the example env file:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://brsxrctacuhllumnfwgx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Where to find keys**

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/brsxrctacuhllumnfwgx/settings/api)
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon/public key** (or publishable key) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

> **Important:** The service role key bypasses Row Level Security and must **only** be used server-side. Never expose it in client code or commit it to git.

RLS is enabled on all tables with no public policies, so the service role key is required for admin CRUD operations.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Link to GitHub remote (optional)

```bash
git remote add origin https://github.com/AnotherAurora/MotherTree.git
git push -u origin main
```

## Regenerating TypeScript types

When your schema changes, regenerate types from Supabase:

```bash
npx supabase gen types typescript --project-id brsxrctacuhllumnfwgx > src/lib/database.types.ts
```

Or use the Supabase MCP `generate_typescript_types` tool in Cursor.

## Recommended data entry order

1. **Tags** — foundation for interactions
2. **Awakeners** — character stats
3. **Desires** — team goals
4. **Manifestations** — awakener + tag pairings
5. **Tag Interactions** — default synergy rules
6. **Interaction Overrides** — per-manifestation tweaks
7. **Desire Demands** — tag priority curves
8. **Paths** — awakener ↔ desire links

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
