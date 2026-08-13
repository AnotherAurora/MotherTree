# Mother Tree

**root version** — a public Morimens reference: Search, Calculators, and a Manual.

Game data is sourced from [SKeyDB](https://github.com/dansa/SKeyDB). See [DATA-NOTICE.md](DATA-NOTICE.md) for attribution and licensing (CC BY-NC-SA 4.0).

## Public

| Path | What it is |
|------|------------|
| `/` | Hub |
| `/search` | Catalog search (Awakeners, Wheels, Posses, Covenants, tags) |
| `/calculators` | Mechanic calculators (Keyflare, Death Resist, Aliemus, Team max HP, Tentacle Damage, Covenant, and more) |
| `/manual` | How the tools work and cataloging assumptions |
| `/about` | Project background |

Public pages are read-only. Calculator inputs stay in the browser (`localStorage`); they are not written to the database.

## This repository

One Next.js app. Public pages and a private admin (table editor, Path Carver, simulator) share the same codebase. Admin routes are not part of the public site.

## Local development

```bash
git clone https://github.com/AnotherAurora/MotherTree.git
cd MotherTree
npm install
cp .env.example .env.local
```

Fill `.env.local` from [`.env.example`](.env.example). The anon/publishable key is for public SELECT. The service role / secret key is server-only — never put it in `NEXT_PUBLIC_*` or commit it.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- **Next.js** (App Router, Server Actions)
- **React** + **TypeScript**
- **Tailwind CSS**
- **Supabase** (PostgreSQL)

## Credits

> Contains SKeyDB community data/content for Morimens, created by dansa and SKeyDB contributors: https://github.com/dansa/SKeyDB

SKeyDB data is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [DATA-NOTICE.md](DATA-NOTICE.md) and SKeyDB's [DATA-LICENSE.md](https://github.com/dansa/SKeyDB/blob/main/DATA-LICENSE.md).

This project does not imply endorsement by SKeyDB, dansa, Qookka Games, or Morimens.
