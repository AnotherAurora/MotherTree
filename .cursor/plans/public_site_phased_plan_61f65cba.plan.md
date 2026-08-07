---
name: Public Site Phased Plan
overview: "Public Mother Tree (root version): homepage hub + Search + Calculator + Manual + About are public; other routes stay private admin. Phase 0–2 done; Calculator before Search → Vercel release."
todos:
  - id: phase-0-scope
    content: Phase 0 — Scope locked (Search naming, calculator catalog, table allowlist, localStorage)
    status: completed
  - id: phase-1-shell
    content: Phase 1 — Public `/` + `/search` + `/calculator`; move admin home to `/admin`; Mother Tree / root version chrome
    status: completed
  - id: phase-1-1-theme
    content: Phase 1.1 — Public desert dusk theme + simple hub (no Path Carver in public copy)
    status: completed
  - id: phase-1-2-hub
    content: Phase 1.2 — Four-row homepage hub; `/manual` + `/about` placeholders; nav + ember hover
    status: completed
  - id: phase-2-readonly
    content: Phase 2 — SELECT-only RLS on final allowlist; hide timestamps; 500-row / 60-rpm caps; smoke tests
    status: completed
  - id: phase-3-calculator
    content: Phase 3 — Calculator tools from catalog + localStorage persistence for inputs
    status: pending
  - id: phase-4-search
    content: Phase 4 — Guided read-only Search UI on allowlisted tables
    status: pending
  - id: phase-5-release
    content: Phase 5 — Gate admin, Vercel deploy, attribution, env/RLS review
    status: pending
  - id: phase-6-expand
    content: Phase 6 — More calculator sub-tools, Search v2, caching/WAF as needed
    status: pending
isProject: false
---

# Public Site — Phased Plan

## Strategic locks

| Decision             | Locked choice                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Repo                 | Same MotherTree Next.js app ([README.md](README.md)) — not a separate site                                              |
| Public vs private    | **Homepage tree is public** (`/`, `/search`, `/calculator`, `/manual`, `/about`…); **everything else is private admin** |
| Admin home           | **`/admin`** — private dashboard (table hub); replaces today’s `/` admin welcome                                        |
| Public brand         | Top-left **Mother Tree** with subtitle **root version**                                                                 |
| Public chrome        | No “Admin Dashboard” label; **no** admin side nav to private pages                                                      |
| Calculator vs search | **Calculator before search** (easier; reuses pure libs)                                                                 |
| Public writes        | Never — SELECT-only / server-mediated reads                                                                             |
| Public product names | **Search** and **Calculator** (not “Explore” as a product name)                                                         |
| Math source of truth | [`src/lib/path-carver/*`](src/lib/path-carver/) — calculator imports only; no duplicated formulas                       |
| Calculator inputs    | Persist user-entered numbers in **localStorage** (client-only; not the DB)                                              |
| Hosting              | Vercel hobby when releasing (Phase 5)                                                                                   |
| Attribution          | Public chrome includes SKeyDB notice per [DATA-NOTICE.md](DATA-NOTICE.md)                                               |

Recommendation / Path Carver full flow / simulator remain **admin-only** and out of public scope. Public pages are **read-only** and must not expose recommendation features.

---

## Dependency order

```mermaid
flowchart TD
  P0[Phase0_Scope]
  P1[Phase1_Shell]
  P1_1[Phase1_1_Theme]
  P1_2[Phase1_2_Hub]
  P2[Phase2_ReadOnlyAccess]
  P3[Phase3_Calculator]
  P4[Phase4_Search]
  P5[Phase5_PublicRelease]
  P6[Phase6_Expand]
  P0 --> P1 --> P1_1 --> P1_2
  P1 --> P2
  P2 --> P3
  P2 --> P4
  P3 --> P5
  P4 --> P5
  P5 --> P6
```

Phase 3 and 4 both need Phase 2. Prefer finishing **calculator (3)** before deep search work; search can start after Phase 2 if you want parallel work later. Phase 1.1 / 1.2 (theme + hub) do not block Phase 2+.

---

## Phase 0 — Scope (locked)

_Product boundaries. Detail below is decided; UX specifics for Search remain for Phase 4._

### Public pages

- **Homepage** (`/`) — public hub with four rows: Search, Calculator, Manual, About Me
- **Search** (`/search`) — one page
- **Calculator** (`/calculator`) — hub that may expand into **sub-pages** per calculator tool
- **Manual** (`/manual`) — docs placeholder (Phase 1.2)
- **About Me** (`/about`) — about placeholder (Phase 1.2)

### Non-goals (confirmed)

- No CRUD / no public DB writes
- No full Path Carver multi-step flow
- No recommendation engine / simulator features on public pages
- No service-role key in the browser

### Calculator catalog (factors)

Each factor is a calculator tool (likely its own sub-route under `/calculator/...`). Source of truth remains Path Carver libs; map and extract in Phase 3.

| Factor                              | Notes / starting lib                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Base Keyflare                       | Path Carver keyflare-related logic (e.g. harmony / Support.Keyflare paths)                                          |
| Death Resist                        | [`death-resist-trigger.ts`](src/lib/path-carver/death-resist-trigger.ts)                                            |
| Base Aliemus                        | Path Carver base-stat / aliemus paths                                                                               |
| Team max HP                         | [`team-max-hp.ts`](src/lib/path-carver/team-max-hp.ts)                                                              |
| Base Tentacle Damage                | [`base-tentacle-damage.ts`](src/lib/path-carver/base-tentacle-damage.ts) — **benthos aequor** and **aequor** realms |
| Realm Mastery + Realm Manifestation | Realm mastery total + realm manifestation apply (see `sumTeamRealmMastery` / realm rows in Path Carver apply path)  |

**Persistence:** Store the numbers users enter in calculators in **localStorage** so inputs survive refresh (client-side only; never written to Supabase).

### Public read allowlist (tables)

Public SELECT (via Phase 2 RLS / allowlisted server reads) is limited to:

- `realm`
- `realm_tag_manifestation`
- `covenant`
- `covenant_tag_manifestation`
- `awakener`
- `awakener_tag_manifestation`
- `awakener_local_manifestation_interaction`
- `posse`
- `posse_tag_manifestation`
- `wheel`
- `wheel_tag_manifestation`
- `tag`

No other tables are public-readable unless this plan is amended. Soft-deleted rows (`deleted_at` where present) stay hidden from public reads by default. Column-level trimming is locked in Phase 2 (hide `created_at`, `updated_at`, `deleted_at`). Allowlist confirmed final in Phase 2.

### Success criteria (baseline)

- Calculator: each catalog factor runnable on its own; inputs restore from localStorage; results match Path Carver for the same inputs
- Search: query/browse allowlisted tables only; read-only; no recommend UI
- Public: no path to mutate DB or open admin tools

**Exit:** Scope locked (this section); proceed to Phase 1.

---

## Phase 1 — App shell (public vs admin) — decisions locked

_Homepage tree = public. All other existing tool/table routes = private admin._

### Routing

| Area        | Routes                                                               | Access                                                       |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Public hub  | `/`                                                                  | Public — four-row hub (Search, Calculator, Manual, About Me) |
| Search      | `/search`                                                            | Public                                                       |
| Calculator  | `/calculator` (hub) + `/calculator/...` sub-pages as tools are added | Public                                                       |
| Manual      | `/manual`                                                            | Public                                                       |
| About Me    | `/about`                                                             | Public                                                       |
| Admin home  | `/admin`                                                             | **Private** — admin dashboard (table hub / welcome)          |
| Admin tools | `/tables/*`, `/path-carver`, `/simulator`                            | **Private admin only**                                       |

Public allowlist for access control (Phase 5): `/`, `/search`, `/calculator` and `/calculator/*`, `/manual`, `/about` only. All other routes (including `/admin`) stay private.

### Public chrome (not admin)

- Top-left site name: **Mother Tree**
- Subtitle under the name: **root version**
- Do **not** show “Admin Dashboard”
- Do **not** include the admin [sidebar](src/components/admin/sidebar.tsx) or links to private pages
- Public layout only: brand + navigation among public pages (Home / Search / Calculator / Manual / About Me)

### Private admin home (`/admin`)

- Move the current admin welcome + table grid from [`src/app/page.tsx`](src/app/page.tsx) to **`/admin`** (e.g. `src/app/admin/page.tsx`)
- Keep “Admin Dashboard” branding and the existing sidebar on `/admin` and all other admin routes
- Sidebar brand link currently points at `/` ([`sidebar.tsx`](src/components/admin/sidebar.tsx)); retarget it to **`/admin`**
- Do not expose `/admin` on public chrome or the public homepage

### Admin chrome (elsewhere)

- `/tables/*`, `/path-carver`, `/simulator` keep the sidebar unchanged (aside from brand → `/admin`)
- No requirement to link public Search/Calculator from the admin sidebar (public entry remains `/`)

### Phase 1 deliverables (placeholders)

- Placeholder **public homepage hub** at `/` with links + brief descriptions covering Search and Calculator
- Placeholder **Calculator hub** at `/calculator`
- Placeholder **Search** at `/search`
- Wire public layout so those routes use Mother Tree / root version chrome without the admin side nav
- **Relocate admin home** to `/admin` (current dashboard content); update sidebar home link to `/admin`

**Exit:** Public placeholders at `/`, `/search`, `/calculator`; admin home at `/admin` with sidebar; no admin chrome on public pages.

---

## Phase 1.1 — Public desert dusk theme (done)

_Visual polish on the public shell. Inspired by Ch7 Mother Tree desert mood; no game art assets shipped._

### What was done

- **Inspired theme only** — CSS gradients and grain overlay on `.public-theme`; no Ch7 reference PNGs and no tree silhouette asset in the repo
- **Atmosphere:** Desert dusk / sand haze page ground (public layout only; admin unchanged); haze drift + brand ember pulse motions
- **Brand mark:** Public product name locked as **Mother Tree** (two words, with space); crimson-ember gradient/glow on the header wordmark only. Admin/repo identifier remains **MotherTree**
- **Display font:** Cormorant Garamond for brand / public headings; body stays Geist
- **Homepage:** Simple hub — Search and Calculator as two linked titles with short descriptions; no oversized brand, no hero CTAs, no full-viewport stage. Visible brand stays in the header (visually hidden `h1` for a11y)
- **Public copy:** Do not mention Path Carver on public pages; describe tools in plain product terms
- **Surfaces touched:** [`src/app/(public)/layout.tsx`](<src/app/(public)/layout.tsx>), [`site-header.tsx`](src/components/public/site-header.tsx), [`site-footer.tsx`](src/components/public/site-footer.tsx), [`mother-tree-mark.tsx`](src/components/public/mother-tree-mark.tsx), [`/`](<src/app/(public)/page.tsx>), [`/search`](<src/app/(public)/search/page.tsx>), [`/calculator`](<src/app/(public)/calculator/page.tsx>), plus [`globals.css`](src/app/globals.css) `.public-theme` tokens

**Exit:** Public pages share the desert dusk theme; homepage is a two-link hub; brand reads as Mother Tree with crimson glow in chrome only.

---

## Phase 1.2 — Four-row homepage hub + Manual / About (done)

_Replace the two-link hub with locked product copy; add Manual and About placeholders._

### What was done

- **Homepage hub:** Four horizontal rows in order — Search, Calculator, Manual, About Me. Title on the left; bullet descriptions on the right (stack on small screens). Copy locked verbatim; no extra hub marketing text
- **Search Learn more:** Trailing `[Learn more about search features, methodology, and recording assumptions]` links to `/manual`
- **Ember hover:** Hub titles use `.mt-hub-title` — crimson-ember gradient/glow on hover / focus-visible (same tokens as `.mt-brand-mark`); bullets stay muted
- **Routes:** Placeholder pages at [`/manual`](<src/app/(public)/manual/page.tsx>) and [`/about`](<src/app/(public)/about/page.tsx>)
- **Nav:** Public header includes Home, Search, Calculator, Manual, About Me
- **Surfaces touched:** [`src/app/(public)/page.tsx`](<src/app/(public)/page.tsx>), [`site-header.tsx`](src/components/public/site-header.tsx), [`globals.css`](src/app/globals.css), new manual/about pages

**Exit:** Four-row hub live; `/manual` and `/about` placeholders; nav updated; ember hover on hub titles.

---

## Phase 2 — Read-only data access (done)

_Public read path via anon key + SELECT-only RLS. Decisions below are locked before implementation._

### Allowlist (final)

Phase 0 table allowlist is **confirmed final** — no additions without amending this plan:

- `realm`, `realm_tag_manifestation`
- `covenant`, `covenant_tag_manifestation`
- `awakener`, `awakener_tag_manifestation`, `awakener_local_manifestation_interaction`
- `posse`, `posse_tag_manifestation`
- `wheel`, `wheel_tag_manifestation`
- `tag`

Do not grant SELECT on non-allowlisted tables (including desires, paths, demands, etc.).

### Column-level trimming (locked)

Public responses must **omit** audit/soft-delete timestamps (even though soft-deleted rows are already filtered out):

- Hide: `created_at`, `updated_at`, `deleted_at`
- Apply in the server read layer (explicit column selects / projection), not by exposing full rows then stripping in the UI

### Caps (locked)

Sized to current data (~1.1k allowlisted rows; largest table ~336) and Free-tier reality (**unlimited API requests**; real pressure is egress / shared CPU, not a request meter):

| Cap                 | Value                            | Notes                                                                                                          |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Per-query row limit | **500**                          | Covers a full read of the largest allowlisted table with headroom; do not set below ~400 or option lists break |
| Rate limit          | **~60 requests / minute / IP**   | Simple in-memory for Phase 2; blocks scrapers better than a tighter row cap                                    |
| SQL surface         | No arbitrary SQL from the client | Guided / allowlisted server entrypoints only                                                                   |

### What was done

- **RLS migration** ([`20260807120000_public_readonly_select_rls.sql`](supabase/migrations/20260807120000_public_readonly_select_rls.sql)): `GRANT SELECT` + `anon_select_alive` (`deleted_at IS NULL`) on the 12 allowlisted tables; applied to the linked remote project
- **Anon client** ([`src/lib/supabase/anon.ts`](src/lib/supabase/anon.ts)); admin [`createAdminClient`](src/lib/supabase/admin.ts) / service role unchanged
- **Server read layer**: allowlist + projections ([`src/lib/public-read/`](src/lib/public-read/)), `listPublicTable` Server Action ([`src/lib/actions/public-read.ts`](src/lib/actions/public-read.ts)) with 500-row cap and ~60 req/min/IP
- **Env**: document `NEXT_PUBLIC_SUPABASE_ANON_KEY` in [`.env.example`](.env.example)
- **Smoke**: [`scripts/smoke-public-read.ts`](scripts/smoke-public-read.ts) — allowlisted SELECTs succeed without timestamps; desire SELECT / writes fail for anon; caps verified

**Exit:** Safe read path exists; admin writes unchanged; caps + trimming enforced.

---

## Phase 3 — Calculator (before search)

_Extract Path Carver functions into standalone tools per Phase 0 catalog._

- Implement tools for: Base Keyflare, Death Resist, Base Aliemus, Team max HP, Base Tentacle Damage (benthos aequor + aequor), Realm Mastery + Realm Manifestation
- Structure as calculator hub + sub-pages when tools multiply
- UI per tool: inputs → shared Path Carver function → result (no desire load/save)
- Persist inputs in **localStorage**; restore on load
- Defaults: align with Path Carver assumptions (account/awakener level 60, etc.) unless a tool exposes overrides
- Parity: same inputs match Path Carver debug/output for that function
- Ship first tool E2E under admin preview, then remaining catalog items
- No DB writes; option lists from Phase 2 allowlisted tables only when needed

**Exit:** Catalog tools work in preview (or clearly sequenced sub-deliverables); math not forked; localStorage inputs persist.

---

## Phase 4 — Search

_Query UI on Phase 2 read layer (product name: Search)._

- Guided Search UX (filters / entity pickers / results) — **no public free-form SQL**
- Wire only to Phase 0 allowlisted tables; loading / empty / error states
- Reuse admin labeling patterns from schema config where useful ([`schema-config`](src/lib/schema-config.ts), FK comboboxes) without exposing CRUD
- Iterate under admin preview
- No recommendation UI or links into simulator/Path Carver flows

**Exit:** Useful read-only Search in preview against allowlisted tables.

---

## Phase 5 — Public release gate

- Protect admin/write routes (auth or deploy protection) so `/admin`, `/tables`, `/path-carver`, `/simulator`, etc. are not reachable by the public
- Public `/`, `/search`, `/calculator/*`, `/manual`, `/about` live with Mother Tree / root version chrome only
- Env review: publishable/anon for public path; service role server-only
- Deploy to Vercel; set env vars; confirm soft-delete/RLS behavior in production
- Attribution footer (SKeyDB / CC BY-NC-SA) on public pages
- Basic abuse/error visibility

**Exit:** Public Calculator + Search (+ Manual / About) via homepage hub; no public DB writes; admin tools (including `/admin`) gated.

---

## Phase 6 — Expand (backlog)

- Additional calculator sub-tools beyond the Phase 0 catalog
- Search v2 (shareable URLs, richer joins, indexes/caching)
- Edge/WAF (Cloudflare) only if traffic/abuse needs it
- User-facing docs / feedback

---

## Remaining detail slots (without reordering phases)

| Slot                                              | Status                                              | Where it lands          |
| ------------------------------------------------- | --------------------------------------------------- | ----------------------- |
| Calculator factor list                            | Locked in Phase 0                                   | Phase 3 implementation  |
| Public table allowlist                            | Locked in Phase 0; **confirmed final** in Phase 2   | Phase 2 + 4             |
| localStorage for calculator inputs                | Locked                                              | Phase 3                 |
| Public routes + Mother Tree / root version chrome | Locked in Phase 1                                   | Phase 1 implementation  |
| Private admin home `/admin`                       | Locked in Phase 1                                   | Phase 1 (move from `/`) |
| Public desert dusk theme                          | Done in Phase 1.1                                   | Public layout + hub     |
| Public brand spelling                             | Locked: Mother Tree (space)                         | Phase 1.1               |
| Homepage hub                                      | Done in Phase 1.2 — four rows + locked copy         | Phase 1.2               |
| Public `/manual` + `/about`                       | Placeholders done in Phase 1.2                      | Phase 1.2; body later   |
| No Path Carver naming on public pages             | Locked in Phase 1.1                                 | Public copy             |
| Search UX specifics                               | Open                                                | Phase 4                 |
| Column-level public trimming                      | Done: hide `created_at`, `updated_at`, `deleted_at` | Phase 2                 |
| Public read caps                                  | Done: 500 rows/query; ~60 req/min/IP                | Phase 2                 |
| Admin auth mechanism                              | Open                                                | Phase 5                 |
| Manual / About body content                       | Open                                                | Later expand            |

---

## Out of scope (unless you later amend this plan)

- Recommendation engine / simulator public access
- Full Path Carver multi-step flow for the public
- Separate Cloudflare-first deploy (Vercel first)
- Monetization (conflicts with SKeyDB NC license unless separately cleared)
