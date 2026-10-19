# BE-46 Marketplace: buyer slice (M20)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (proposed: BE-24 content and BE-25 subscriptions are the same kind of small catalogue/read cards, and no file overlaps; folders: sessions.md section 5, to be extended with the rows in "Files touched") |
| Priority | P2 |
| Wave | 3 |
| Depends on | BE-03, BE-05 |
| Parallel with | BE-16, BE-18, BE-19, BE-23, BE-47, BE-48 |
| Owner module | M20 Marketplace (new module `marketplace`; owns the four tables below) |

## Goal

(D53: every module reachable in the prototype is in B1; matrix row 32 "Marketplace", Murid.) Build the 5 buyer routes of the mock: category list, product search, product page (counts a view), WhatsApp hand-off (counts a click, returns a `wa.me` URL) and public shop page. There is no cart, order or payment (D14): the buyer is handed to WhatsApp and the server never sends a message. The seller and admin routes of the SRS (#1 to #12, #18 and up) have no mock route and are out of this card; the tables keep the seller fields the buyer slice reads.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M20-marketplace.md` (section 7 routes #13 to #17, BR-M20-05, BR-M20-08, BR-M20-12, BR-M20-16 to BR-M20-21, FR-M20-11, FR-M20-52 to FR-M20-61, V-M20-03, section 6 data, section 6.11 seeds), `docs/requirements/urs/M20-marketplace.md`
- Mock: `src/modules/m20-marketplace/mock/handlers/buyer.ts` (the 5 routes), `mock/repository/{marketplace,format,types,tables}.ts`, `mock/data/seed-data.ts`, `mock/seeds/seed.ts`, `mock/whatsapp-log.ts`; client `src/modules/m20-marketplace/api/{marketplace,types}.ts`; mock test `src/modules/m20-marketplace/__tests__/mock/buyer.test.ts` and fixtures `__tests__/fixtures.ts`
- `docs/requirements/role-access-matrix.md` (Murid row 32 "Marketplace")
- Requirements: BE-FR-43; BE-NFR-05, BE-NFR-06
- API catalogue part B4 (economy, content, games): [economy-content-games.md, section "M20 Marketplace" (M20-13 to M20-17)](../../architecture/v2-api-catalogue/economy-content-games.md#m20-marketplace-m20-marketplace---5-routes) (its "out of B1" status note is superseded by D53); OQ-API-B4-28 (view counters)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) section 3.13 row `marketplace.*` (candidate `marketplace_*`; they become B1 tables through this card) and global rules G-01 to G-18
- Migration: [v2-data-migration.md](../../architecture/v2-data-migration.md) section 3 rows `marketplace_sellers`, `marketplace_products`, `marketplace_orders` and section 4.11; plan [v2-backend-plan.md](../../architecture/v2-backend-plan.md) sections 5, 6, 14.7 (the row "Out of B1 ... marketplace" is replaced by this card's rows)
- BE-05 `UsersRepository` (seller owner FK)

## Outputs

- Contract: `packages/contract/src/marketplace/**` (new): `MarketplaceCategory`, `ProductCard`, `ProductDetail`, `SellerCard`, `ProductReview`, `ShopView`, `WhatsappHandoff`, the search query schema, enums; registered in `src/openapi.ts`
- `apps/api/prisma/schema/marketplace.prisma` + migration: `marketplace_categories`, `marketplace_sellers`, `marketplace_products`, `marketplace_product_images`, `marketplace_reviews`
- `apps/api/src/modules/marketplace/**`: the 5 controllers, `MarketplaceRepository` (the only doorway to the five tables), pure format helpers (discount, shipping line, rating stars, WhatsApp message)
- Seed `apps/api/prisma/seed/marketplace.ts` (the 6 constant categories, 1 seller, the 10 observed products and their images, from `mock/data/seed-data.ts`; contact data fictitious; one line in the registry)
- Tests under `apps/api/test/marketplace/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/marketplace/**`.
- Prisma file(s): `apps/api/prisma/schema/marketplace.prisma` (new, this card alone) and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/marketplace/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/marketplace.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/marketplace/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/marketplace/`.
- Other files: `.env.api.example` (PC-1 block): `MARKETPLACE_PLATFORM_WHATSAPP` (name only).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (`MarketplaceProduct`, `MarketplaceSeller`, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: `marketplace.prisma` belongs to this card alone; it reads `users` only through BE-05's repository (FK to `users.id` is allowed). It does not touch `content.prisma` (BE-24) or `files` (BE-04).

## Endpoints (5 mock routes, paths from the mock)

All routes: any signed-in role (no session: 401 `UNAUTHORIZED` "Unauthenticated."). The POST needs the CSRF header (missing: 403 `CSRF_INVALID`). Ids are decimal strings on the wire (UD-1); prices are decimal strings with 2 decimals (`"89.90"`); instants carry `+08:00`.

| Method and path | Notes |
|---|---|
| `GET /api/marketplace/categories` | 200 `{data: MarketplaceCategory[]}` `{id, slug, name, icon}`, id ascending, no `meta` |
| `GET /api/marketplace/products` | query `q`, `category` (slug), `condition`, `sort`, `page`; 200 `{data: ProductCard[], meta: ListMeta}`, 20 per page |
| `GET /api/marketplace/products/:slug` | 200 `{data: ProductDetail}`; **adds 1 to `views` on every call** |
| `POST /api/marketplace/products/:slug/whatsapp` | no body; 200 `{data: {url}}`; adds 1 to the seller's `whatsapp_clicks` |
| `GET /api/marketplace/sellers/:id` | 200 `{data: {shop, products}}`; active sellers only |

Rules (BR-M20-05, 08, 12, 16 to 21; FR-M20-11):

- **Visibility (BR-M20-08):** a product is visible when `status = 'active'` and (`seller_id` is null or the seller's `status = 'active'`). Stock does not matter. Hidden or unknown slug: 404 `NOT_FOUND` "Not Found." from the product page and from the WhatsApp route, and nothing changes. A shop is visible when the seller is `active`; otherwise (or unknown id, or non-numeric id) 404.
- **Search (`GET /products`):** only visible products. `q`: trimmed, cut to 100 characters, case-insensitive substring of the name (blank = no filter). `category`: a category slug; an unknown slug gives an empty result. `condition`: `new` or `used`, exact; any other non-blank value matches nothing; blank = any. Filters combine with AND. `sort`: `latest` (default and for any unknown value) = `created_at` desc, ties `id` ascending, **but `id` descending when a (valid) `category` is set** (DV-M20-07); `price_low` / `price_high` by price ascending / descending, ties `id` ascending; `popular` = `views` descending, ties `id` ascending.
- **ProductCard:** `{id, slug, name, price, originalPrice | null, discountPct | null, condition, thumbnailUrl | null, seller: {shopName, verified} | null, shippingLine}`. `discountPct = round((original - price) / original x 100)` half up, `null` without an original price or when it is not positive. `thumbnailUrl` = the image at the lowest position, or null. `seller` is null for a platform product (`seller_id` null); `verified` = `verified_at` is not null.
- **shippingLine (exact copy):** `postage` with a fee `Pos / Kurier (RM8.00)` (fee with two decimals), `postage` without a fee `Pos / Kurier`, `free` `Penghantaran Percuma 🎉`, `cod` `Cash on Delivery (COD)`, `pickup` `Ambil Sendiri (Pickup)`.
- **ProductDetail:** `{id, slug, name, categoryId, category: MarketplaceCategory, price, originalPrice, discountPct, description | null, condition, stockStatus, shippingMethod, shippingFee | null, shippingLine, location, views, createdAt, images: [{id, position, url}] by position, seller: SellerCard | null, reviews, reviewCount, related}`. `location` is `""` when none. `views` is the value after this call's +1 (increment and read in one atomic `UPDATE ... RETURNING`, so concurrent calls never lose a count; no de-duplication). `reviews` newest first. `related` = visible products of the same category, not the product itself, `id` ascending, at most 4, as `ProductCard`.
- **SellerCard:** `{id, shopName, initial, verified, ratingStars, activeProductCount}`. `initial` = first character of the shop name, upper case (`?` if empty). `ratingStars` = five characters, `round(average rating)` times `★` then `☆` for the rest; with no reviews `☆☆☆☆☆`. The average is over the reviews of **all** the seller's products (any status). `activeProductCount` = the seller's visible products.
- **WhatsApp hand-off:** for a visible product. Seller product: `whatsapp_clicks + 1` (atomic) and the seller's number; platform product: nothing counted and the platform number from `MARKETPLACE_PLATFORM_WHATSAPP` (dev default `60000000000`, fictitious). URL = `https://wa.me/{number}?text=` + `encodeURIComponent('Salam, saya berminat dengan produk "{name}" di PRESTASIPLUS Marketplace.')`. The server never calls WhatsApp or sends anything.
- **Shop (`GET /sellers/:id`):** `shop: {id, shopName, initial, description | null, verified, ratingStars, reviewCount, productCount, createdAt}` (`reviewCount` = reviews over all the seller's products, `productCount` = visible products) and `products` = visible `ProductCard`s newest first (`created_at` desc, ties `id` ascending), not paginated.

## DB tables touched

New (owner this card): `marketplace_categories`, `marketplace_sellers`, `marketplace_products`, `marketplace_product_images`, `marketplace_reviews`. Reads `users` only for the FK.

| Table | Columns (types per G-01 to G-10) | Keys and indexes |
|---|---|---|
| `marketplace_categories` | `slug` unique, `name`, `icon` (text, verbatim from the mock e.g. `fa-pencil-ruler`) | static reference data, seeded |
| `marketplace_sellers` | `user_id` FK users unique, `shop_name`, `description` null, `phone`, `whatsapp`, `status` check `pending`/`active`/`suspended`/`banned`, `verified_at` null, `whatsapp_clicks` int default 0, `created_at` | index `(status)`; legacy columns |
| `marketplace_products` | `seller_id` FK null (platform product), `name`, `slug` unique, `category_id` FK, `price` numeric(10,2), `original_price` numeric(10,2) null, `description` null, `condition` check `new`/`used`, `stock_status` check `available`/`out_of_stock`, `status` check `active`/`draft`/`rejected`, `shipping_method` check `pickup`/`postage`/`cod`/`free`, `shipping_fee` numeric(10,2) null, `location` text not null default `''`, `views` int default 0, `created_at`, `updated_at` | indexes `(status, category_id)`, `(seller_id)`, `(created_at desc, id)`; legacy columns |
| `marketplace_product_images` | `product_id` FK cascade, `position` smallint (1 = "Utama"), `url` text | `unique (product_id, position)` |
| `marketplace_reviews` | `product_id` FK cascade, `user_id` FK, `rating` smallint check 1..5, `text`, `created_at` | index `(product_id, created_at desc)`; read only in B1 (no submission route; empty in the seed) |

The mock's `documents` (seller documents) table is not created: no buyer route reads it and the seller portal has no mock route. Prices are RM `numeric(10,2)` (G-06). `marketplace_categories`, `marketplace_product_images` and `marketplace_reviews` are born in v2 (no `.cloud` source); `marketplace_orders` has no v2 table (D14).

## Acceptance criteria

1. Each route returns the mock's shape for the seeded data and parses with its contract schema. Proof: port the cases of `buyer.test.ts` (status, body fields, `meta`, the observed related and tie orders).
2. Visibility: a product with `status` `draft`/`rejected`, or whose seller is `pending`/`suspended`/`banned`, is absent from the search, from related lists and from the shop, and answers 404 on the product page and the WhatsApp route with no counter change; `out_of_stock` products stay visible.
3. Search: `q` (trimmed, 100-character cut, case-insensitive), `category`, `condition` (including `condition=foo` giving an empty list), the four sorts and their tie rules (including `id` descending for `latest` when a category is set) match the mock on the seed and on a generated 45-product set; the page size is 20 and `meta` is correct.
4. Pricing and labels: `discountPct` is half-up and null without an original price; `shippingLine` equals the five exact strings; prices are two-decimal strings; `ratingStars` is `☆☆☆☆☆` with no reviews and correct for a fixture with reviews on a seller's hidden product (it still counts).
5. `GET /products/:slug` increments `views` by exactly 1 per call and returns the new value; 20 parallel calls raise it by exactly 20; a 404 call changes nothing; `images` are by position; `related` has at most 4 and never the product.
6. `POST /products/:slug/whatsapp` returns the exact `wa.me` URL for a seller product (seller number) and for a platform product (configured number), adds 1 to the seller's `whatsapp_clicks` only for a seller product, 20 parallel calls add exactly 20, and sends nothing outbound (no HTTP client is invoked).
7. `GET /sellers/:id`: 404 for unknown, non-numeric and non-active seller; `productCount`, `reviewCount`, `ratingStars` and the product order match the mock.
8. Roles: no session 401 on all five routes; any signed-in role (student, teacher, admin) gets 200; missing CSRF on the POST gives 403 `CSRF_INVALID`.
9. Supporting indexes exist; `EXPLAIN` of the search query for a generated 10k-product set is recorded in the PR.

## Test commands

```
npm run be:test -- apps/api/test/marketplace
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/marketplace/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. No security review is required; list any security-relevant decision in the PR anyway (no outbound call, counters atomic).
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows (`marketplace_sellers`, `marketplace_products`) has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack (slug, condition, shipping, images, category: .cloud has none) is nullable or has a documented default in the ETL; seeds never set `legacy_*` and are idempotent (upsert by `slug` / category `slug` / seller `shop_name`).
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR: `marketplace_sellers` and `marketplace_products` ("Reshape" per data-migration section 3) with the ETL card "none in B1 (staged and profiled only)" until the lead decides (Open questions 1); `marketplace_orders` "drop, no v2 table (D14)"; categories, images and reviews "no source".

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Are .cloud `marketplace_sellers` / `marketplace_products` loaded into v2 (they lack slug, condition, shipping, images and categories)? Working assumption: not loaded in B1; the tables carry the legacy columns so a later ETL needs no schema change; the prototype's 10 observed products come from the seed.
2. Product image files: the mock stores `/images/marketplace/products/{productId}/img_{position}.jpg`, static files copied once into the frontend `public/` folder. Working assumption: `url` keeps that relative path and the files stay frontend assets (the API does not serve them); the lead decides if they should move to BE-04 `files`.
3. The platform WhatsApp number `60000000000` is fictitious. Working assumption: it is the dev default of `MARKETPLACE_PLATFORM_WHATSAPP`; the lead supplies the real number as configuration for production.
4. Counters and test mode (G-07): `views` and `whatsapp_clicks` are plain counters written by GET/POST. Working assumption: increment for every signed-in caller as the mock does (including an admin in Mod Pelajar); OQ-API-B4-28 notes that bots and prefetch inflate GET counters, accepted for now.
5. `reviews` ties: the mock sorts by `created_at` descending and does not define ties (empty in the seed). Working assumption: ties by `id` descending.
6. The seeded seller is owned by canonical account 1 in the mock (the admin account). Working assumption: the seed resolves the seeded Admin Pusat user from BE-07 by its natural key; the lead confirms who should own the demo shop.
7. The matrix lists Marketplace for Murid only, while the mock allows any signed-in role. Working assumption: replicate the mock (any session).
8. Seed names: shop and product names are observed public listings in `seed-data.ts`; the seller contact data is fictitious. Do not add any real person name to the seed.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-46 (marketplace). Work in this repo clone on branch be/BE-46-marketplace, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-46-marketplace.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/marketplace/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handler, repository, typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Copy the BM strings exactly (shippingLine, the WhatsApp message). Never commit secrets, real personal names or real phone numbers. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-46. Port the five buyer-slice tables and the 5 routes, with atomic view and click counters, the visibility rule, the search filters and sort ties, and the exact wa.me URL. Seed the 6 categories, the observed seller and the 10 observed products from the mock seed data with fictitious contact details.
```
