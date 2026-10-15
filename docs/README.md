# docs/ index

Start with [TRACKER.md](TRACKER.md) (progress and decisions) and the repo-level [AGENTS.md](../AGENTS.md).

| Path | Purpose |
|---|---|
| `TRACKER.md` | Single source of truth: decisions (D1–D32), module board, next actions, change log |
| `SCOPE-STATUS.md` | Prototype scope: what is built, what is hidden/out of scope (BM) |
| `ROLES-MATRIX-LINES.md` | The 59 role-matrix rows (L01–L59) with progress |
| `AKAUN-DEMO.md` | Demo account notes (demo password only) |
| `requirements/` | URS/SRS masters, per-module `urs/` and `srs/`, role access matrix, v2 requirement docs |
| `architecture/` | System overview, build plan, v2 data migration |
| `adr/` | Architecture decision records 0001–0014 (stack, mock layer, determinism, datasets, store ownership, ...) |
| `design/` | Design system and shell specs (prototype-era today; v2 specs planned) |
| `discovery/` | Live-site discovery notes per module, element inventories (`inventory/`), crawl tools (`tools/`), screenshots |
| `qa/` | QA reports and acceptance results per module/row |

## v2 docs (new system, decisions D28–D32)

| Doc | Status |
|---|---|
| [requirements/v2-portals.md](requirements/v2-portals.md) | Written: two portals, one Portal Pentadbiran, role/menu model |
| [requirements/v2-cloud-gap.md](requirements/v2-cloud-gap.md) | Written: gap analysis of prestasiplus.cloud vs the prototype |
| [architecture/v2-data-migration.md](architecture/v2-data-migration.md) | Written (draft): .cloud database to v2 backend migration |
| [design/v2-design-system.md](design/v2-design-system.md) | Approved v2.0 (D33–D38): two personalities (staff calm B+, learner Elektrik), tokens, Phosphor icons, Fluent 3D, virtual friend, guard rules |
| [design/v2-learner-prototype.html](design/v2-learner-prototype.html) | Approved interactive learner prototype (Home, quiz, win, friend picker) |
| [design/v2-theme-preview.html](design/v2-theme-preview.html) | Staff look reference (variant B+) |
| [design/v2-visual-choices.html](design/v2-visual-choices.html) | Record of the visual choices (icon set, 3D, friend style) |
| [design/v2-shells.md](design/v2-shells.md) | Approved v2.0: shells for both portals at 375/768/1280 |
| [architecture/v2-frontend.md](architecture/v2-frontend.md) | Written: frontend architecture, ADR 0015–0018, task list V2-T01–T60 |

Reading order for newcomers: TRACKER decisions D28–D38, then `requirements/v2-portals.md`,
`requirements/v2-cloud-gap.md`, `architecture/overview.md`, `architecture/v2-data-migration.md`.
