# ADR-0010: Lucide icons with one FA→Lucide map and a data-driven resolver

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
Live uses Font Awesome 6.5.1 and emoji. The rebuild uses Lucide (fixed stack). Module SRSs provide FA→Lucide tables (00-global-ui §6, M01/M02/M03/M05 NFR-06). M03 BR-05 (DV-M03-01) requires resolving admin-entered icon values that may be an FA class, a Lucide name or an emoji, and never injecting them as HTML or classes (SEC-M03-03). Lucide has about 1,600 icons, and importing all of them eagerly would bloat the bundle.

## Decision
- Package **`@lucide/vue`** (ADR-0001). Page code uses named icon components directly.
- **One mapping table**, `src/components/icon/fa-to-lucide.ts`, keyed by the FA name without prefix. It starts from the global and module tables, and each module build appends its rows.
- **`AppIcon`** (for data-driven icons) resolves in the BR-05 order:
  1. empty → nothing;
  2. non-ASCII → emoji text;
  3. `^(fa[srlbd]?\s+)?fa-([a-z0-9-]+)$` → map, else try the same name in Lucide;
  4. bare Lucide name (kebab-case or PascalCase) → that icon;
  5. unknown → nothing.
- It renders components only. Values are never used as HTML or classes.
- **Bundle:** mapped icons are imported statically. Arbitrary Lucide names resolve through a lazily loaded full icon index chunk, fetched on the first miss only.

## Alternatives considered
- **Keep Font Awesome:** violates the fixed stack decision.
- **Always import the full Lucide set:** simplest, but it costs hundreds of KB on every page.
- **Only the mapped icons, with no fallback:** fails BR-05 step 4 (any Lucide name).

## Consequences
- Fidelity of icon meaning. Visual glyphs differ from FA by design (the user's stack choice).
- The mapping table is the single place reviewers check. A missing mapping shows as "no glyph", and a unit test lists the unmapped FA names found in seed data.

## Amendment 1 (2026-09-26, after F-14)

Recorded after F-14 built `AppIcon` and `fa-to-lucide.ts`. Delivery Lead decision.

1. **FA6 long prefixes.** Step 3 also accepts the FA6 prefixes `fa-solid` and `fa-regular`, because live Font Awesome 6.5.1 renders them. The pattern becomes `^(?:(?:fa[srlbd]?|fa-solid|fa-regular)\s+)?fa-([a-z0-9-]+)$`. The prefix never changes the result: the lookup key is the name after `fa-`. M03 BR-05 has the same wording.
2. **Mapping authority.** `docs/design/design-system.md` §6 (v1.2) is the single source for FA → Lucide rows. `fa-to-lucide.ts` mirrors it row for row. Module SRS icon lists must agree with it, and where they differ §6 wins. The earlier sentence "starts from the global and module tables, and each module build appends its rows" now means that module rows are added to design-system §6 first, and the code table follows.
3. **Canonical names only.** Lucide names are the canonical exports of `@lucide/vue` 1.48. Deprecated aliases such as `Loader2`, `Home`, `Trash2` and `Filter` are not used in the table or in page code.
4. **Explicit rows over fallback.** Every FA name used in a module SRS or in seed data has an explicit row, including names the same-name fallback would already resolve (`fa-gift`, `fa-signal`, `fa-variable`, `fa-flask-round`, `fa-beaker`). The fallback stays as a safety net. The unit test in Consequences should fail on any SRS or seed FA name that has no row.

## Amendment 2 (2026-09-26, build-plan v1.4, overview v1.3)

Delivery Lead decision. It resolves a conflict between build-plan §S.3 rule 3 (modules write rows to their own map file), Amendment 1 item 2 (design-system §6 is the single source), and the F-14 test that forces the global table to equal design-system §6.1–6.8 exactly.

1. **Module rows have their own source.** design-system §6 gains a subsection "§6.13 Module rows", with one table per module. The ui-ux-designer owns it.
2. **Module map files mirror it.** `src/components/icon/maps/<module>.ts` must equal that module's §6.13 table exactly, and must not redefine a row of the global table.
3. **New icons go through the designer.** A module task that needs a new icon asks the ui-ux-designer to add the row to §6.13 first, then writes its own map file.
4. **The global table stays closed.** Nobody edits `src/components/icon/fa-to-lucide.ts` except through F-14 (or an F-14 follow-up). It keeps mirroring §6.1–6.8 only.
