> **R2 preparation only, read-only (A1a, 02 Nov).** No R2 queue is issued; the user decides the R2 queue after R1 sign-off. Source: docs/release/r1-kiv-r2.md on r1/ha24-release-input @a1f11bb8. Note: REQ-B-074 is fixed in R1 (r1/reqb074-takedown-lows @45a75f68).

# KIV / R2 list classified (preparation only: no queue issued; the user decides the R2 queue after R1 sign-off)

Source: `docs/release/r1-kiv-r2.md` on `r1/ha24-release-input` @ a1f11bb8, 41 rows. Rows are numbered as in that file. Sizes and dependencies are the classifier's estimates from the row text (A1a), not recorded estimates; the owner column says where the record names one and otherwise gives a suggested lane marked [suggested]. Column key:
- **Size**: S = under a day or a single spec or doc; M = a few days, one lane, one unit; L = a multi-unit effort across lanes or teams.
- **Dec** = needs a user or LEAD decision before work (U = user, L = LEAD, n = none).
- **Mig** = needs a migration; **Con** = changes the contract (openapi / schemas).
- **Closed** = the record itself says nothing is left.

## Row table

| # | Item (short) | Size | Owner (record / [suggested]) | Depends on | Dec | Mig | Con | Theme |
|---|---|---|---|---|---|---|---|---|
| 1 | Takedown does not cut sittings already running | M | [A4/A2] (decision: LEAD) | user/LEAD wants a change to PIPE AC-07.9 (one version per sitting) | U/L | no | maybe (new error on in-flight read) | T1 |
| 2 | Delete vs Terbit race, `FOR SHARE` lock | - | A1b (publish-lock-share) | **Closed** since BASE-177 | n | no | no | T1 |
| 3 | Terbit race: archive within seconds of the servability read | S | [A3/A4] | none | L | no | no | T1 |
| 4 | Missing index `exam_attempts(paper_id)` | S | [A4] | large `exam_attempts`; ops window | n | yes | no | T5 |
| 5 | Legacy Simulasi groups not reordered (ETL / old papers) | M | [A1 ETL / A3] | runbook §3.7 SELECT result decides | L | no (data fix) | no | T1 |
| 6 | Q12c: practice reward rate + combo step unverified against `.cloud` | M | [A1/A3] | needs V2 source (`PracticeRecorder`) or live observation | U | no | no | T3 |
| 7 | AC-R1-14.2 live-provider smoke (OCR / extraction) | M | Ops/QA | provider decision (G2, D85 U1, D87 U5), `OCR_ENGINE=tesseract`, lang data, 20 timed scans | U | no | no | T4 |
| 8 | AC-R1-11.4 / R1-12.6 UAT run | S | Ops | UAT after `dskp:load` | n | no | no | T5 |
| 9 | AC-04.3 / 04.5 / 05.3 / 20.3 proofs on unmerged branches | - | A4/A1 | **Closed** at BASE-175 (all merged) | n | no | no | T6 |
| 10 | AC-R1-18.1 partial (Bab activity not a single chain spec) | S | A3 (T51) | T51 now in base; Q17 changed the Bab rule | n | no | no | T6 |
| 11 | AC-02.2 / AC-10.6 FE-only parts | S | team C | none | n | no | no | T6 |
| 12 | 31 FE-only AC entries (3 AC-R1 + 28 PIPE) | M | team C / B4 | B4 E2E re-run | n | no | no | T6 |
| 13 | Images / groups in Databank, Latih Tubi, Bab (AC-R1-13.2, PIPE 11.12, 12.1, 18.3 part) | L | team A (board R2 "practice-family bridge") + C UI | row 18 (pool tag), practice question source contract | L | maybe | **yes** | T2 |
| 14 | AC-R1-06.3 skipped (no whole-marked Bahagian paper) | S | [A3] (decision: LEAD, T46) | a paper with such a Bahagian | n | no | no | T6 |
| 15 | R2 work lines: Tracking A sets, Mock K1/K2, Subjektif SPM / Latihan Berstruktur, Heatmap, practice bridge upgrades | L | team A (BE) + C (UI), B review | user R2 scope (D86, D87, D92); G5 for R1 | U | yes (several) | yes | T8 |
| 16 | KIV with no schedule: Subjektif/OCR editor, games, unused answer modes, teacher/school-admin features, Pengguna, Sekolah, Tanda Karangan, Kawalan Ciri, ALESA AI, `Lampir Kertas 2` | L (each) | [none] | user scope | U | yes | yes | T8 |
| 17 | Dashboard (Bijak) tile and Analitik `Laporan Soalan` tile (R1-F17) | M | [team C + A] | OQ-3 decided: R2 | n | no | maybe (analytics read) | T8 |
| 18 | Drop `spmPool` / pool tag (migration 0109 reserved) | M | [A4/A2] (decision: D92) | row 13 (changed together with practice bridge) | n | **yes** | yes | T2 |
| 19 | Optional migrations 0120 / 0121 / 0122 / 0123 (B16, B10, B12, B20) | S | [A2/A4] | only if tests find a missing column or CHECK | L | **yes** | no | T5 |
| 20 | Servability access ("Dilihat murid di") for teachers and school admins (REQ-B-022(c)) | M | [A4] (decision: D86) | role/scope rules | L | no | **yes** (route access) | T8 |
| 21 | REQ-B-052: practice sessions holding an archived question not covered | S | [A4/A2] | none | L | no | no | T1 |
| 22 | Cover sheet (`examinerGrid`) follows current human-marked flag, not the pinned version | M | [A3] (decision: LEAD) | an alternative pins the flag per sitting: schema change | L | maybe | maybe | T1 |
| 23 | Admin question-list search with 1 to 2 chars / punctuation bypasses the trigram index | S | [A4] | rate limit is the current mitigation | L | maybe (index variant) | no | T5 |
| 24 | CSV `bab` column not added | S | [A2] (decision: LEAD, R1 Bab) | Q17 made Bab optional; DSKP bridge (row 41) | L | no | **yes** (import header, template) | T4 |
| 25 | Dead local FE type for chapter lock (`TopicState` `locked`, `MapIsland.vue` branch) | S | team C | none | n | no | no | T6 |
| 26 | A4 follow-ups: drop `PENDING_BRIDGE_TEXT` in parity spec; three `t45` Minors | S | A4 | T31 and bridge-table-parts (second in base) | n | no | no | T6 |
| 27 | Chain sub-step without a chain spec: Bab refusal | - | A2/A3 | **Superseded by Q17 / REQ-B-071** (Bab optional) | n | no | no | T6 |
| 28 | Padam soalan: FE removes from paper only; T48 `DELETE .../questions` not called; no "Tambah bahagian" / extra question UI | M | team C (REQ-A-029) | V2 comparison by C | L | no | no | T7 |
| 29 | Move a unit or group to another Bahagian: no control | M | team C (REQ-A-029) | V2 check; API `sections[].questionIds` exists | L | no | no | T7 |
| 30 | Salin set: lane row (`LaneSimulasiPage.vue`) offers only "Sunting" | S | team C (REQ-A-029) | UX-23 screens (Pratonton / Salin) | L | no | no | T7 |
| 31 | Separate "Semak" button (review auto-loads today) | S | team C (REQ-A-029) | V2 comparison | L | no | no | T7 |
| 32 | FE mock coverage by smoke: 82 parameterised operations unmocked (Bijak 42, intake 20, Studio 13, other 7) | L | A (harness) + C (mock) | estimate ~178 x 2 probes + 85 GET | n | no | no | T6 |
| 33 | REQ-B-058: new sittings and Kuiz on a taken-down pin | - | A4 | **Closed**; only REQ-B-074 (below) remains | n | no | no | T1 |
| 34 | Q13: authored "daripada" lines on PoC seed and golden stay | S | [A3] (decision: user, Q13) | PoC is withdrawn at runtime (REQ-B-029) | n | no | no | T8 |
| 35 | T38: no per-day or per-paper cap on self-mark syiling / XP | M | R2 / LEAD (Q14, D94) | user rule for the cap; counter or ledger query | U | maybe (counter) | maybe | T3 |
| 36 | T48 `setGroupLabel` unchecked on a group placed on another published paper | S | LEAD | 409 is new scope; `stimuli.service.ts:92,169-170` | L | no | maybe (409) | T1 |
| 37 | PKSK `applyStatus` approves without `GATES.approve` | M | A2 (record) | changes PKSK behaviour | L | no | no | T8 |
| 38 | T48 number clash check compares only the new `numberLabel` | S | LEAD | none | L | no | no | T1 |
| 39 | Split VALIDATE into a separate non-DO migration (online constraint pattern) | S | A4 (tests), LEAD decides | applies to future large-table constraints only | n | pattern | no | T5 |
| 40 | Auto title "(draf)": four accepted limits | S | LEAD | pick an alternative (reader-only strip, strip at any position) | L | no | no | T1 |
| 41 | Bab only via `chapters.dskp_code` (empty in seed, no API write) | M | [A2 + A1 seed] (Q17 / REQ-B-071) | row 24; curriculum owner (M03) for node to chapter link | L | maybe (link or seed fill) | maybe (admin write) | T4 |

Counts: 41 rows. Closed or superseded (nothing to do for R2): 2, 9, 27, 33 (4 rows). Remaining 37.
Size of the remaining 37: S 19, M 14, L 4 (rows 13, 15, 16, 32; row 16 is a list, each item L).
Needs a user decision: 1, 6, 7, 15, 16, 35 (6 rows); LEAD decision: 3, 5, 13, 14 (record only), 19, 20, 21, 22, 23, 24, 28 to 31, 36 to 38, 40, 41.
Migration: 4, 13 (maybe), 15, 16, 18, 19, 22 (maybe), 23 (maybe), 35 (maybe), 39 (pattern), 41 (maybe).
Contract: 1 (maybe), 13, 15, 16, 17 (maybe), 18, 20, 22 (maybe), 24, 35 (maybe), 36 (maybe), 41 (maybe).

## Suggested themes (R2 candidates)

| Theme | Rows | What it is | Owner lane | Size | Needs |
|---|---|---|---|---|---|
| T1 Lifecycle, takedown and publish integrity | 1, 3, 5, 21, 22, 36, 38, 40 (closed: 2, 33) | Take-down of running sittings, Terbit races, legacy Simulasi groups, cover sheet pinning, label and number checks, auto title | A3 + A4 (A2 for questions) | M overall; 1 and 22 the biggest | LEAD decisions per row; user for row 1 (PIPE AC-07.9) |
| T2 Practice family bridge (images and groups in Databank, Latih Tubi, Bab; drop pool tag) | 13, 18, part of 15 | One bridge upgrade with the pool tag drop (0109), because D92 says change the tag and every `spmPool` reader together | A4 (BE) + C (UI) | L | contract change, migration 0109, LEAD; best done as a single unit |
| T3 Rewards and V2 verification | 6, 35 | Verify practice reward rate and combo step against `.cloud`; decide and build the cross-attempt syiling / XP cap | A1 | M | user decision for both (rates, cap rule) |
| T4 Intake, OCR provider and Bab linkage | 7, 24, 41 (27 superseded) | Real OCR and extraction provider smoke; CSV `bab` column; chapter linked to DSKP unit | A2 + A1 (ETL, seed) + DevOps | M | user provider decision (G2); curriculum owner for the Bab link; contract and maybe a migration |
| T5 Ops, migrations and performance | 4, 8, 19, 23, 39 | Missing attempts index, UAT SELECT runs, optional 0120 to 0123, short-search index, online-constraint pattern | A4 + DevOps | S to M | maintenance window; most are ops evidence, not code |
| T6 QA coverage and FE-only proof | 10, 11, 12, 14, 25, 26, 32 (closed: 9, 27) | FE-only ACs for B4, mock smoke coverage (the large item, row 32), dead FE type, leftover spec tidy | C + B4 (A harness) | M overall, row 32 is L | B4 E2E; no decisions |
| T7 Builder UI parity (REQ-A-029) | 28, 29, 30, 31 | Padam / add Bahagian, move between Bahagian, lane Salin, separate Semak button | team C | M | V2 comparison by C first; API already exists for most |
| T8 Scope outside R1 and policy rows | 15, 16, 17, 20, 34, 37 | R2 product lines (Tracking A, Mock K1/K2, Subjektif, Heatmap), unscheduled modules, dashboard tiles, teacher servability access, PKSK approve gate | user-scoped; A and C | L each | **user scope** for 15 to 17; LEAD for 20 and 37 |

## Observations for the R2 queue (no queue issued)

1. Only six rows need the user; the rest need a LEAD call or none. The user-decision rows (1, 6, 7, 15, 16, 35) are the real gate for R2 shape.
2. Rows 13 and 18 should be one unit (D92). Rows 24 and 41 should be one unit (Q17 left Bab optional, so a Bab path is a convenience, not a blocker). Rows 28 to 31 are one team C ticket (REQ-A-029).
3. Rows 8 and 7 are ops evidence and belong to R1 sign-off, not R2 code: they are in the R1 sign-off table already.
4. REQ-B-074 (B3 Lows on REQ-B-058: image access for a taken-down pin, older versions served again) is not a row in the KIV file after row 33 closed it; if it is not fixed in R1 it should be added as a KIV row under T1.
5. Four rows (2, 9, 27, 33) can be struck from the next KIV refresh.
