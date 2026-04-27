# Insighta Labs, Demographic Query API

HNG 14 Backend **Stage 2**. A demographic query layer over a `profiles` table: advanced filtering, sorting, pagination, and a rule-based natural-language search endpoint. Designed for marketing, product, and growth teams that need to slice a pre-seeded dataset fast.

---

## Contents

1. [Stack](#stack)
2. [Database Schema](#database-schema)
3. [Setup](#setup)
4. [Seeding](#seeding)
5. [Endpoints](#endpoints)
6. [Natural Language Parsing](#natural-language-parsing)
7. [Error Responses](#error-responses)
8. [Performance Notes](#performance-notes)

---

## Stack

- NestJS 11 + TypeScript
- Supabase (PostgreSQL)
- `class-validator` + `class-transformer` for query-string validation & coercion
- `uuidv7` for time-sortable IDs
- PNPM

---

## Database Schema

The `profiles` table must match this shape exactly:

| Field               | Type             | Notes                                     |
| ------------------- | ---------------- | ----------------------------------------- |
| id                  | UUID v7          | Primary key                               |
| name                | VARCHAR + UNIQUE | Lowercased                                |
| gender              | VARCHAR          | `male` or `female`                        |
| gender_probability  | FLOAT            | 0–1 confidence                            |
| age                 | INT              | Exact age                                 |
| age_group           | VARCHAR          | `child` / `teenager` / `adult` / `senior` |
| country_id          | VARCHAR(2)       | ISO 3166-1 alpha-2                        |
| country_name        | VARCHAR          | Full country name                         |
| country_probability | FLOAT            | 0–1 confidence                            |
| created_at          | TIMESTAMP        | UTC ISO 8601                              |

## Setup

```bash
pnpm install
cp .env.example .env  # fill in Supabase credentials
pnpm run start:dev
```

Required env:

```env
PORT=8000
SUPABASE_URL=<your-supabase-url>
SUPABASE_KEY=<your-supabase-service-role-key>
```

Server runs on `http://localhost:8000` with `Access-Control-Allow-Origin: *`.

---

## Seeding

The project is bootstrapped from a JSON file of 2026 profiles provided with the Stage 2 brief. The seeder is **idempotent by design** — run it as many times as you want and the row count stays at 2026.

### Running the seed

```bash
pnpm run seed                          # defaults to data/profiles.json
pnpm run seed path/to/profiles.json    # custom path
```

Under the hood that expands to:

```
TS_NODE_PROJECT=tsconfig.seed.json node --env-file=.env -r ts-node/register scripts/seed.ts <path>
```

### How idempotency is guaranteed

The seed script (`scripts/seed.ts`) enforces "no duplicate records" at **three layers**, so re-running is always safe regardless of DB constraint state:

1. **Input normalization.** Every row is lowercased-name, uppercased-country-id, coerced-to-number, and missing `country_name`s are filled in from `Intl.DisplayNames` using the ISO code.
2. **Intra-file dedup.** A `Map<name, record>` collapses duplicate names inside the seed file itself (last occurrence wins) before anything hits the network.
3. **DB pre-check.** Before inserting a batch, the script queries `.select('name').in('name', batchNames)` and filters out any name already in the table. This works even if the `UNIQUE(name)` constraint is missing.
4. **Upsert fallback.** The insert is wrapped in `.upsert(..., { onConflict: 'name', ignoreDuplicates: true })` as a final safety net, so a row added between the pre-check and the write (or by a concurrent API call) still gets ignored.

All writes go out in 500-row batches.

### Expected output

First run:

```
Loaded 2026 raw records → 2026 valid → 2026 unique (dropped 0 in-file duplicates)
Database already has 0 matching names. Inserting 2026 new rows.
Batch 1: inserted 500 / attempted 500
...
Seed complete. Inserted 2026 new rows. Duplicates skipped.
```

Second run (and every one after):

```
Loaded 2026 raw records → 2026 valid → 2026 unique (dropped 0 in-file duplicates)
Database already has 2026 matching names. Inserting 0 new rows.
Nothing to insert. Seed is up to date.
```

---

## Endpoints

### `GET /api/profiles`

List profiles with combinable filters, sort, and pagination.

| Param                     | Type   | Notes                                         |
| ------------------------- | ------ | --------------------------------------------- |
| `gender`                  | string | `male` \| `female`                            |
| `age_group`               | string | `child` \| `teenager` \| `adult` \| `senior`  |
| `country_id`              | string | ISO 3166-1 alpha-2 (`NG`, `BJ`, …)            |
| `min_age`                 | int    | ≥ 0                                           |
| `max_age`                 | int    | ≥ 0                                           |
| `min_gender_probability`  | float  | 0–1                                           |
| `min_country_probability` | float  | 0–1                                           |
| `sort_by`                 | string | `age` \| `created_at` \| `gender_probability` |
| `order`                   | string | `asc` \| `desc` (default `desc`)              |
| `page`                    | int    | default `1`, clamped to ≥ 1                   |
| `limit`                   | int    | default `10`, clamped to `[1, 50]`            |

All filters combine with `AND`. Out-of-range `page`/`limit` values are clamped, not rejected.

**Example**

```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

**Response (200)**

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [
    {
      "id": "b3f9c1e2-7d4a-4c91-9c2a-1f0a8e5b6d12",
      "name": "emmanuel",
      "gender": "male",
      "gender_probability": 0.99,
      "age": 34,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.85,
      "created_at": "2026-04-01T12:00:00Z"
    }
  ]
}
```

### `GET /api/profiles/search`

Natural-language query, converted to the same filters as `/api/profiles`. Accepts the same `page` / `limit` parameters. The response shape is identical to `/api/profiles`.

```
GET /api/profiles/search?q=young males from nigeria&page=1&limit=10
```

If the parser finds no recognised filters at all:

```json
{ "status": "error", "message": "Unable to interpret query" }
```

See [Natural Language Parsing](#natural-language-parsing) for everything the parser understands.

---

## Natural Language Parsing

Implementation: [`src/profiles/nlQuery.ts`](src/profiles/nlQuery.ts).

The parser is **100% rule-based** — no LLM, no embeddings, no external calls. It ingests a raw English phrase, runs a sequence of regex passes over it, and builds a structured filter object that's fed into the same query layer as `/api/profiles`.

### Pipeline

1. **Normalize.** Lowercase, trim, collapse whitespace, pad with spaces so `\b` word boundaries fire at both ends.
2. **Both-gender short-circuit.** If the query contains `male and female`, `men and women`, `both genders` (and reversed / plural variants), _no_ gender filter is emitted and the phrase is stripped from the working string so the gender regex in step 3 can't re-trigger. This is what makes `"male and female teenagers above 17"` produce `{ age_group: teenager, min_age: 17 }` with no gender filter.
3. **Gender.** First hit wins:
   - `male | males | man | men | boy | boys | gentlemen` → `male`
   - `female | females | woman | women | girl | girls | ladies` → `female`
4. **Age group keywords** (mutually exclusive, first match wins):
   - `child | children | kid | kids` → `child`
   - `teen | teens | teenager | teenagers` → `teenager`
   - `adult | adults` → `adult`
   - `senior | seniors | elderly | old people` → `senior`
5. **`young` bracket.** Sets `min_age = 16`, `max_age = 24`. **Never** stored as an age_group — it's a parse-time-only synonym for "16–24".
6. **Age ranges and comparators** (combinable; comparators widen/narrow the window set by prior passes):
   - `between N and M`, `aged N to M`, `aged N-M` → `min_age = min(N,M)`, `max_age = max(N,M)`
   - `above N` / `over N` / `older than N` / `greater than N` / `more than N` → `min_age = max(existing, N)`
   - `below N` / `under N` / `younger than N` / `less than N` → `max_age = min(existing, N)`
7. **Country.** Scans for any ISO 3166-1 region name (built from `Intl.DisplayNames('en')`) plus a curated alias table (`uk`, `usa`, `america`, `drc`, `uae`, `czechia`, `ivory coast`, `south/north korea`, `russia`, `vietnam`, …). Matching is **longest-name-first**, so `"united states"` wins over `"united"` and `"south korea"` wins over `"korea"`.
8. **Interpretation check.** If the parsed filter object is empty, the parser returns `null` and the controller responds with `400 { "status": "error", "message": "Unable to interpret query" }`.

### Worked examples

| Query                                    | Parsed filters                                          |
| ---------------------------------------- | ------------------------------------------------------- |
| `young males`                            | `gender=male, min_age=16, max_age=24`                   |
| `females above 30`                       | `gender=female, min_age=30`                             |
| `people from angola`                     | `country_id=AO`                                         |
| `adult males from kenya`                 | `gender=male, age_group=adult, country_id=KE`           |
| `male and female teenagers above 17`     | `age_group=teenager, min_age=17` _(gender suppressed)_  |
| `children from nigeria between 5 and 10` | `age_group=child, country_id=NG, min_age=5, max_age=10` |
| `seniors from the united states`         | `age_group=senior, country_id=US`                       |
| `banana`                                 | `null` → `400 Unable to interpret query`                |

### Supported keyword reference

- **Male**: `male`, `males`, `man`, `men`, `boy`, `boys`, `gentlemen`
- **Female**: `female`, `females`, `woman`, `women`, `girl`, `girls`, `ladies`
- **Both genders (filter suppressed)**: `male and female`, `female and male`, `men and women`, `women and men`, `both genders`
- **Age groups**: `child`, `children`, `kid(s)`, `teen(s)`, `teenager(s)`, `adult(s)`, `senior(s)`, `elderly`, `old people`
- **Bracket**: `young` → ages 16–24
- **Age comparators**: `above`, `over`, `older than`, `greater than`, `more than`, `below`, `under`, `younger than`, `less than`
- **Age range**: `between N and M`, `aged N to M`, `aged N-M`
- **Country**: all ISO 3166-1 English region names + aliases (`uk`, `usa`, `america`, `drc`, `uae`, `czechia`, `ivory coast`, `south korea`, `north korea`, `russia`, `vietnam`, `britain`, `england`)

### Limitations (what the parser does NOT handle)

These are intentional — the scope is "enough for the brief's example queries and adjacent phrasing", not a general NLU engine.

- **No typo tolerance.** `nigera`, `teeangers`, `fmale` fail silently (won't match their intended rules).
- **No stemming or inflection beyond hand-listed plurals.** `seniority`, `teenage`, `childhood` aren't recognised.
- **English only, ASCII keywords.** No non-English country names or gender terms.
- **No negation.** `not male`, `except seniors`, `excluding nigeria`, `no teenagers` are all silently ignored — the parser still matches their positive forms inside the phrase.
- **No disjunction across filter types.** `males or females` triggers whichever gender appears first; `from nigeria or kenya` sets `country_id=NG` only. The SQL layer is strictly `AND`.
- **One country per query.** The first longest-name match wins. A query mentioning two countries will only filter on one.
- **Contradictory ranges aren't normalized.** `young but above 30` gives `min_age=30, max_age=24` (guaranteed zero results). The parser preserves intent verbatim and doesn't try to "fix" the user.
- **No probability parsing.** `strong match`, `confidence above 0.8`, `highly likely` are ignored — use `min_gender_probability` / `min_country_probability` on the `/api/profiles` endpoint directly.
- **No temporal parsing.** `added last week`, `created in April`, `recent profiles` are ignored — use `sort_by=created_at` directly.
- **No ordering intent.** `the oldest males` → `gender=male` and that's it; there is no `sort_by` inference from phrasing. Use `sort_by=age&order=desc` directly.
- **No demonyms.** `nigerians`, `kenyans`, `americans` are not resolved to country codes. Use `from <country>` / `in <country>` / just the country name.
- **No quoted strings or multi-clause composition.** `"adults from kenya" and "teenagers from nigeria"` collapses to the first age_group and first country found.
- **No stopword handling beyond word boundaries.** Polite filler (`please`, `show me`, `I want`) is harmless but also not specifically recognised — if a query is _only_ filler, it returns `Unable to interpret query`.

---

## Error Responses

All errors use this shape:

```json
{ "status": "error", "message": "<reason>" }
```

| Status | When                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------- |
| `400`  | Missing/empty required parameter; NL query cannot be interpreted                                   |
| `422`  | Invalid parameter type (`min_age=abc`, `sort_by=height`) — message is `"Invalid query parameters"` |
| `500`  | Internal server error                                                                              |
| `502`  | Upstream/database failure                                                                          |

---

## Performance Notes

- `count: 'exact'` piggybacks the total onto the same `SELECT` — no second round-trip per listing request.
- Every filter column and every sort column has a dedicated index (see [Database Schema](#database-schema)). No full-table scans for any supported query.
- Pagination uses PostgREST's `.range(from, to)` (Postgres `LIMIT` / `OFFSET`).
- The seeder batches every write in groups of 500 rows and pre-checks existing names in batches of 500 to keep each HTTP request well below Supabase's payload limits.
