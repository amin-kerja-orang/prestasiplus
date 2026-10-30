# ADR-0035: Feature flags table with admin toggle (`permainan`, `latih-tubi`, `kertas-subjektif`)

Status: Proposed
Date: 2026-10-30

## Context
No v2 table exists for feature flags (`migration/load/index.ts`: "no v2 table yet"). D80 DEC-3 and AC-19.1: Latih Tubi and Permainan ON at go-live, Kertas Subjektif OFF; .cloud's toggles for the first and last return 404 (D9 fix).

## Decision
1. Table `feature_flags(key text primary key, label_ms text, enabled boolean, updated_by bigint, updated_at timestamptz)` (migration 0105) with the three rows inserted by the migration (`permainan` true, `latih-tubi` true, `kertas-subjektif` false). This is configuration, not content, so it is the one allowed migration-time insert.
2. `FeatureFlagsModule` (global): `isEnabled(key)` with a 5 second in-process cache; a write clears the local cache. Multi-instance staleness is bounded by the TTL.
3. Server guard `@RequiresFlag(key)` on student controllers: `permainan` on the games solo/room/leagues controllers (not Battle, as in .cloud), `latih-tubi` on practice session start, chapter reads, `/api/spm/latih-tubi`, `kertas-subjektif` on the student Kertas Subjektif reads. Off answers `403 FEATURE_DISABLED` "Ciri ini tidak tersedia buat masa ini." (replaces .cloud's 404, deviation).
4. `GET /api/feature-flags` returns `{ key: boolean }` to any signed-in user (the FE hides nav and shows the message); `PUT /api/admin/feature-flags/:key` Admin Pusat only, audit logged, flash text built by the FE.
5. Admin visibility indicators use the flag: a question's `permainan` row says "Permainan dimatikan" when off; Kertas Subjektif Butiran line likewise.

## Consequences
- The flag must never change which content is eligible (AC-01.3); it only gates the entrance.
- Adding a flag is one row and one decorator.
