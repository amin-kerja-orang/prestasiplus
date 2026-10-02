# M06 — SPM — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M06 SPM |
| Version | 1.4 |
| Date | 2026-09-25 |
| Status | Approved (G1) — v1.4 XL round-2 alignment (D11, D12). Fidelity deviations decided under user rules D9/D10. Live-session states L-1…L-13 pending user approval (§9 OQ-M06-01). |
| Author | product-analyst (agent) |
| Source discovery | [M06-spm.md](../../discovery/M06-spm.md) (§9 L-1…L-13, defects D-1…D-15, Appendix A configs, Appendix B exact strings), inventory [`inventory/M06/`](../../discovery/inventory/M06/) (`S1…S13-*.json`, `SHU-user-shell.json`, `SHA-admin-shell.json`, `_crawl.json`, `_summary.md`, raw states `inventory/_raw/M06/`), screenshots `docs/discovery/img/M06/` (34, masked), global shell [00-global-ui.md](../../discovery/00-global-ui.md) |
| Companion SRS | [srs/M06-spm.md](../srs/M06-spm.md) |
| Related | M01 (404 page, DV-02; canonical seed accounts), M03 (subjects, integer ids, codes, levels 10 = Tingkatan 4, 11 = Tingkatan 5), **M04 v1.2** (owner of the question store incl. the SPM pool BR-M04-32, `getEligible`, the structured store and its anchors §6.11, `ReportQuestionModal` props FR-M04-118), **M05 v1.2** (owner of the practice session store DATA-M05-01/02, BR-31 completion contract, `<PracticeQuiz>` / `<StructuredAnswer>` §7.1, the `/latihan-berstruktur` SPM variants S10-SPM), M24 (Duta card), M25 (`/pusat-nota-ringkas`), M07/M19 (premium gating), M16 (tournament banner), shell rule `docs/design/shells.md` DV-SH-03 |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.4 | 2026-09-25 | **Revision history — v1.4.** XL round 2 (`docs/qa/audit/cross-module-logic-M01-M07.md`): XL-35 — S10 reads M05 #23 (`GET /api/practice/sessions?modes=past_year,latih_tubi,ramalan&type=`); M06 #11 removed as an own endpoint. XL-34 — hub 20,529 / 14,673 declared documented display constants under DV-M06-01 (D11 exception); S1 shows no contradicting computed figure (chips ≤ total, E2E-M06-03). XL-29 — the SPM pool and the Tracking A sets use the M04 `spmPool` facet. XL-25 — stale "M05 A1" and "M05 SPM fixtures" notes removed. Trace re-run 0 errors. |
| 1.3 | 2026-09-25 | **Revision history — v1.3, cross-module logic review** (`docs/qa/audit/cross-module-logic-M01-M07.md`; decisions D11, D12). XL-01: SPM questions come from the M04 question store (`questionStore.spmPool`, BR-M04-32); `question_id` sessions resolve through `getEligible` (FN-3.3.4, AC-10.4 now uses active question 570024; inactive 136891 and a foreign subject return to S4); M04 creates/deactivations move the S2–S4 counts (AC-02.2). XL-02: S2–S4 counts are named queries on the M04 dataset; the hub constants stay live (approved minimal DV-M06-01, recorded). XL-03/04: sessions are M05 PracticeSessions (field map), created/checked/completed through M05 #4–#6 with BR-31; subjective sets are StructuredAttempts `scope = spm`; mock exams stay M06 MockExam records outside the session store (decision in FN-6.2.5). XL-10: `<PracticeQuiz>` / `<StructuredAnswer>` mounted per M05 §7.1. XL-11: structured sets from the M04 `structuredStore` (student-visible total 4,059; only §6.11 anchors cited). XL-12: KBAT 1–6. XL-20: DV-SH-03 — fixed titles have no subtitle (FN-1.2.4, AC-03.3). XL-22: DV-M06-17 text < 12px. XL-24: M05 structured paths. XL-25: stale cross-references refreshed. Seeds A2–A5 / P1–P4 unchanged. |
| 1.2 | 2026-09-25 | **Revision history — v1.2, audit round 2 + M05 alignment.** AUD-M06-17: the hub is reverted to its live values (Jumlah Soalan 20,529; Databank / Latih Tubi chips 14,673); DV-M06-01 now changes the S4 page only, with alternatives and the choice recorded in §7 (CLAUDE.md §6 minimal-fix rule); OQ-M06-08 closed (FN-1.1.2/1.1.3/1.1.4/1.1.9, AC-01.2, AC-01.3, AC-02.1, AC-02.2). AUD-M06-18: AC-09.2 PERNIAGA "934 soalan tersedia" (PROPOSED). AUD-M06-19: the S4 seed split is labelled PROPOSED in AC-08.2…08.5 and AC-10.1; "as live" now refers only to the key mapping and number formats. M05 AUD-M05-02 alignment: the admin's 4 SPM sessions follow the M05 seed (ids A2–A5; the 14/40 session is Sejarah); the student's SPM sessions are P1–P4 (AC-18.5); `/latihan-berstruktur` SPM variants stay owned by M05. Coverage 1,315/1,315, 0 unmapped; trace 0 errors. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M06-audit.md`, round 1 FAIL 0/7/9). AUD-01: DV-M06-02 withdrawn — S4 difficulty keys 2–5 on the site-wide 1–5 scale replicated (FN-3.2.5/3.2.7, AC-08.3–08.5, AC-09.3, AC-10.1). AUD-02: Tracking A seed uses the real S6 values (EKON 7–8 = 19/18, SCI 32–34 = 2/1/1, CHEM 9 = 2); Σ ready = 1,769 contradicts the live hub 1,797 → hub computed from the sets (DV-M06-04 now approved, value PROPOSED). AUD-03: DV-M06-01 reduced to the minimal fix — S2/S3 counts and the BA lock kept as live; S4 uses the same pool; Databank/Latih Tubi hub chips = Σ S2 (PROPOSED); "Jumlah Soalan" kept live. AUD-04: DV-M06-07 narrowed to header titles; S11–S13 keep the role-based shell (as M01 DV-13). AUD-05: S13 Subjek `required`, `maxlength=8`, result hidden on submit, h2 + `<pre>` (new AC-22.5; discovery §2.13 corrected). AUD-06: new FN-3.3.4 / AC-10.4 for the M04 `question_id` + `count=1` link. AUD-07: mock exam page (Q4) UNVERIFIED/neutral pending L-8 (FN-6.2.2–6.2.5, AC-20.x provisional). Minor: AUD-08 (DV-06 evidence: A/A+/B/B+ unstyled), AUD-09 (history filter classes OBSERVED; unknown type → no active filter, new AC-18.6), AUD-10 (review header upper case), AUD-11 (DV-03 + S4 tile), AUD-12 (SHU/SHA-001–003 = logo/brand), AUD-14 (SEC wording, SRS), AUD-15 (PROPOSED COPY list §9), AUD-16 (DV-08 evidence, pending-chip size). Coverage re-generated: 1,315/1,315, 0 unmapped; 118 functions; trace 0 errors. |
| 1.0 | 2026-09-25 | First issue under D7 (fidelity), D8 (proven completeness), D9 (deviation rule) and D10 (accessibility and scope follow D9 strictly). §3 breakdown and §6 coverage matrix generated by script from the inventory JSON: 1,315/1,315 content elements covered (1,285 mapped, 30 excluded with reason), 0 unmapped. Deviations DV-M06-01…16 decided under D9 (10 approved fixes, 6 replicate-live). |

**Conventions** (same as M01–M04)
- Quoted UI copy is the exact live text. The DOM text is quoted; where CSS upper-cases it the fact is stated ("upper case by CSS"), e.g. "Admin Readiness" displays as "ADMIN READINESS". Mixed English/slang copy ("yg", "dlm", "next round", "Paper", "Sambung →", "Showing … results") is live copy and is kept.
- **OBSERVED** = seen on the live site (walk-through, inventory state, screenshot or page script). **SOURCE-DERIVED** = taken from page markup or script captured read-only (M06 walkthrough script, M06 result CSS, the M04 discovery of the report modal on `/spm/latih-tubi/{code}/quiz`, the M05 revision-quiz template), but the state itself was never rendered. **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **UNVERIFIED** = live behaviour or copy that exists but could not be observed (pending an L-state); nothing is asserted about it beyond the evidence. **PROPOSED COPY** / **PROPOSED** = new text or a new value written for the rebuild (no live original, or a live value replaced under D9); listed in §9 for the Delivery Lead to report at G1.
- **L-n** = a live-session state of discovery §9 (not observed: practice sessions are not yet approved by the user). All of them are listed in §9 OQ-M06-01 as pending.
- **DV-M06-nn** = fidelity deviation (§7). Anything not listed there must match live.
- **SEC-M06-nn** = risk of the live behaviour, replicated with dummy data (SRS §11).
- Personal data: discovery masked every person (`<person>`, `<in>`, `<school>`); only structure and UI copy are quoted. Question texts are data samples.
- Inventory notes: discovery §2.5 says the readiness panel has "16" tiles; the inventory and Appendix A.3 hold **15** (BM, BI, MATH, SCI, SEJ, PI, PM, ADDMATH, PHY, CHEM, BIO, GEO, BA, EKON, PSI). Discovery §2.9 says the empty S9 list shows "no message"; the inventory state `kbat-6` holds the empty state "Tiada soalan berstruktur buat masa ini" / "Soalan akan ditambah oleh guru dan admin" (EL-M06-S9-094/095). Discovery §7 D-11 names only S4 for the "Dashboard" header; the inventory shows it on S4, S6, S7 and S9 (EL-M06-SHU-375). The inventory is authoritative; this URS follows it. These points, the S13 form markup, D-1, D-2, D-7, D-10, D-11 and D-12 are now marked "(corrected after audit)" in the discovery narrative.

---

## 1. Overview

M06 is the student-facing SPM preparation area ("Mod SPM"). Parts:
1. **Hub** `/spm` "Persediaan SPM": headline counts, four module cards, the user's SPM quiz stats, link to the SPM quiz history.
2. **Databank Soalan** `/spm/tahun-lepas`: 18 subject cards; set sizes 5 / 10 / 20 start a random quiz directly. No year selector.
3. **Latih Tubi SPM** `/spm/latih-tubi` → `/spm/latih-tubi/{CODE}` "Tetapan Kuiz": 19 subjects (7 Teras, 12 Elektif); Tingkatan, difficulty and question count (fixed to the subject's target when it has one) → quiz.
4. **Tracking A** `/spm/ramalan`: objective lane (fixed 2026 sets per subject, classed Set Bersih / Ready Bank Besar / Belum Cukup), admin readiness panel, BM/BI bahasa lane (structured sets), set list `/spm/ramalan/{CODE}` → set quiz.
5. **Subjektif** `/spm/subjektif`: stats, Semua/Teras/Elektif tabs, 15 subjects → SPM variant of the M05 structured list → M05 answer page.
6. **SPM Mock Exam** `/spm-mock`: subject (10) + Paper 1/2 → generated mock → result page with SPM grade, weak topics and per-question review.
7. **SPM Walkthrough** `/pusat-ai/spm`: AI walkthrough of a typed or photographed question (simulated with canned responses, D4).
8. **SPM quiz history** `/spm/history` with type filters.

The quiz pages themselves (Databank, Latih Tubi, Tracking A set), the structured answer page and the mock exam page were not opened (discovery §9). The quiz pages mount the M05 `<PracticeQuiz>` and the structured answer page the M05 `<StructuredAnswer>` (M05 §7.1); questions come from the M04 question store (SPM pool, M04 BR-M04-32) and sessions live in the M05 session store (D12). M06 specifies their parameters, titles and records, not a new UI.

**Routes covered** (`docs/TRACKER.md` §4 M06, plus crawl finds):

| # | Route | Tab title (exact live) | Header title (as specified) | Layout |
|---|---|---|---|---|
| S1 | `/spm` | "Mod SPM - PRESTASIPLUS" | "Mod SPM" | user portal |
| S2 | `/spm/tahun-lepas` | "Databank Soalan SPM - PRESTASIPLUS" | "Databank Soalan SPM" | user portal |
| S3 | `/spm/latih-tubi` | "Latih Tubi SPM - PRESTASIPLUS" | "Latih Tubi SPM" | user portal |
| S4 | `/spm/latih-tubi/{CODE}` | "Latih Tubi SPM — {Subjek}" | "Latih Tubi SPM — {Subjek}" (DV-M06-07; live "Dashboard") | user portal |
| S5 | `/spm/ramalan` | "Tracking A SPM - PRESTASIPLUS" | "Tracking A SPM" | user portal |
| S6 | `/spm/ramalan/{CODE}` | "Tracking A SPM — {Subjek}" | "Tracking A SPM — {Subjek}" (DV-M06-07) | user portal |
| S7 | `/latihan-berstruktur?subject_id={1\|2}&scope=spm&track=bahasa` | "Soalan Berstruktur - PRESTASIPLUS" | "Tracking A Bahasa" (DV-M06-07) | user portal |
| S8 | `/spm/subjektif` | "Latihan Subjektif SPM - PRESTASIPLUS" | "Subjektif SPM" | user portal |
| S9 | `/latihan-berstruktur?subject_id={id}&scope=spm` | "Soalan Berstruktur - PRESTASIPLUS" | "Subjektif SPM" (DV-M06-07) | user portal |
| S10 | `/spm/history` | "Sejarah Kuiz SPM - PRESTASIPLUS" | "Sejarah Kuiz SPM" | user portal |
| S11 | `/spm-mock` | "SPM Mock Exam" | admin: "SPM Mock Exam", no subtitle (DV-M06-07; live "Dashboard" / "Selamat datang, Admin"); other roles: "SPM Mock Exam" / "Selamat datang kembali" (INFERRED) | role-based as live: admin shell for admin; user portal for other roles (INFERRED, as M01 OQ-6) |
| S12 | `/spm-mock/{id}/result` | "Result Mock SPM — {Subjek}" | "Result Mock SPM — {Subjek}" (as S11) | role-based (as S11) |
| S13 | `/pusat-ai/spm` | "SPM Walkthrough — Cikgu Alesa" | "SPM Walkthrough — Cikgu Alesa" (as S11) | role-based (as S11) |
| Q1 | `/spm/tahun-lepas/{CODE}/quiz?count={5,10,20}` | (not captured) | L-1/L-2 | M05 quiz component |
| Q2 | `/spm/latih-tubi/{CODE}/quiz?count=&level=&difficulty=` and `?question_id={id}&count=1` (M04 "Buka Soalan Sama") | (not captured) | L-3/L-4 | M05 quiz component |
| Q3 | `/spm/ramalan/{CODE}?year=2026&set={n}` | (not captured) | L-5 | M05 quiz component |
| Q4 | `/spm-mock/{id}` | (not captured) | L-8 (UNVERIFIED) | in-exam page, role-based shell |
| — | `/latihan-berstruktur/{id}/jawab?scope=spm[&track=bahasa]` | owned by M05 | L-6/L-7 | M05 |

Probed on live: `/spm/latih-tubi/XYZ`, `/spm/ramalan/XYZ`, `/spm-mock/99999/result` → HTTP 404 global page; `/spm/ramalan/BM|BI` → redirect to S7; `/spm/tahun-lepas?subject=MATH` → same as S2.

## 2. Actors

| Role | Involvement in M06 | Verified |
|---|---|---|
| Pelajar (student, Tingkatan 4–5 target user) | Every M06 screen and session; own history, stats, mocks, subjective attempts. | INFERRED (the hub lead "untuk pelajar Tingkatan 4 & 5"; only the admin account was available — L-13) |
| Admin | Same screens (the admin account rendered all of them), plus the S5 "Admin Readiness" panel; reaches M06 from the admin sidebar group "SPM" and the "Pusat AI"/"Killer Features" items. | OBSERVED (admin account) |
| Guru, Ibu Bapa, other roles | Whether they can open M06 is unknown; the user-portal sidebar shows "SPM" to the admin. The prototype lets any logged-in user open M06 and hides the readiness panel from non-admins (INFERRED; OQ-M06-03). | INFERRED |
| Guest | Redirected to `/login` (M01 pattern). | INFERRED |

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated by script from the element inventory (`docs/discovery/inventory/M06/`). "EL" lists inventory element IDs (prefix `EL-M06-`). Functions with EL "—" are behaviours (sessions, server rules, access) with no element of their own.

### EP-M06-1 — SPM hub, navigation and shared parts

**FT-M06-1.1 — Hub "Mod SPM"** (S1 `/spm`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-1.1.1 | Pill `fa-graduation-cap` "MOD SPM" (amber), h1 "Persediaan SPM" (gradient text; live responsive classes `text-2xl sm:text-4xl md:text-2xl sm:text-5xl` replicated), lead "Latihan lengkap untuk pelajar Tingkatan 4 & 5. Soalan tahun lepas, latih tubi, Tracking A, dan latihan bahasa berformat sebenar." | S1-004–006 | Pelajar, Admin | OBSERVED |
| FN-M06-1.1.2 | Stat row, 4 cards (2 columns, 4 from `md`): "{n}" "Jumlah Soalan" (amber), "{n}" "Subjek SPM" (blue), "{n}" "Tahun Tersedia" (green), "{n}" "Soalan Tracking A" (purple); `ms-MY` thousands separators; values per BR-M06-01: 20,529 / 25 / 0 as live; "Soalan Tracking A" computed from the sets (1,769, PROPOSED; DV-M06-04) | S1-007–018 | Pelajar, Admin | OBSERVED + DV-M06-04 |
| FN-M06-1.1.3 | Module card (whole card is a link) `fa-database` "Databank Soalan" / "Bank soalan SPM mengikut subjek, dipaparkan secara rawak." / chip `fa-file-alt` "{n} soalan" (live 14,673, kept as live — DV-M06-01 does not touch the hub) / "Mula" `fa-arrow-right` → `/spm/tahun-lepas` | S1-019–022 | Pelajar, Admin | OBSERVED |
| FN-M06-1.1.4 | Module card `fa-brain` "Latih Tubi SPM" / "Latihan ikut topik dan bab untuk Tingkatan 4 & 5." / chip `fa-dumbbell` "{n} soalan" (live 14,673, kept as live) / "Mula" → `/spm/latih-tubi` | S1-023–026 | Pelajar, Admin | OBSERVED |
| FN-M06-1.1.5 | Module card "Tracking A" / "Set objektif penuh dan lane bahasa khas untuk latihan intensif menjelang SPM." / chip "{n} soalan" (= "Soalan Tracking A", DV-M06-04) / "Mula" → `/spm/ramalan`; tile and chip icons visible (live `fa-crystal-ball`, `fa-stars` render blank; DV-M06-03) | S1-027–029 | Pelajar, Admin | OBSERVED + DV-M06-03/04 |
| FN-M06-1.1.6 | Module card `fa-pen-fancy` "Subjektif" / "Latihan soalan esei & jawapan panjang, disemak oleh guru." / chip "{n} set subjektif" / "Mula" → `/spm/subjektif`. Cards 1 column, 2 from `md`, 4 from `lg` | S1-030–032 | Pelajar, Admin | OBSERVED |
| FN-M06-1.1.7 | Card "Prestasi SPM Anda": "{sessions}" "Sesi Kuiz", "{avg}%" "Purata Ketepatan" (1 decimal), "{coins}" "Syiling Diperoleh", "{answered}" "Soalan Dijawab" (BR-M06-20) | S1-033–042 | Pelajar, Admin | OBSERVED |
| FN-M06-1.1.8 | Button-link `fa-history` "Sejarah Kuiz SPM" → `/spm/history` | S1-043 | Pelajar, Admin | OBSERVED |
| FN-M06-1.1.9 | Count definitions (D11): every S2/S3/S4 count is a named query on the M04 question store — `questionStore.spmPool({subjectId, educationLevelIds, difficultyLevel?})` count (M04 BR-M04-32: approved, active, non-PKSK T4/T5 MCQ) — so M04 creates, approvals and deactivations move them at once; Tracking A counts are computed from the set records over that pool; Subjektif counts are `structuredStore` counts. The hub values "Jumlah Soalan" 20,529 and the Databank / Latih Tubi chips 14,673 are documented display constants (D11 exception, DV-M06-01): no definition over the dataset reproduces them and S1 shows no contradicting computed figure | — | Pelajar, Admin | OBSERVED + DV-M06-01/04 + D11 |

**FT-M06-1.2 — M06 entries in the shells and page headers** (SHU / SHA)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-1.2.1 | User-portal sidebar section heading "SPM" and item `fa-graduation-cap` "SPM" with amber pill "SPM" → `/spm` (desktop sidebar ≥1024px and mobile drawer); active on every M06 user-portal screen | SHU-008–010, 171–174 | Pelajar, Admin | OBSERVED |
| FN-M06-1.2.2 | Mobile bottom nav item `fa-graduation-cap` "SPM" → `/spm` (below 1024px) | SHU-338 | Pelajar, Admin | OBSERVED |
| FN-M06-1.2.3 | User-portal sidebar item `fa-file-pen` "SPM Mock Exam" → `/spm-mock` in section "💎 Killer Features" (desktop sidebar only, as live) | SHU-053 | Pelajar, Admin | OBSERVED |
| FN-M06-1.2.4 | Header title per screen (shell rule DV-SH-03: title from the route). Live titles kept with their live subtitle "Selamat datang kembali": S1 "Mod SPM", S2 "Databank Soalan SPM", S3 "Latih Tubi SPM", S5 "Tracking A SPM", S8 "Subjektif SPM", S10 "Sejarah Kuiz SPM". Fixed (DV-M06-07): S4 "Latih Tubi SPM — {Subjek}", S6 "Tracking A SPM — {Subjek}", S7 "Tracking A Bahasa", S9 "Subjektif SPM", S11 "SPM Mock Exam", S12 "Result Mock SPM — {Subjek}", S13 "SPM Walkthrough — Cikgu Alesa", each with no subtitle, instead of "Dashboard" / "Selamat datang kembali|Admin". S11–S13 keep the role-based shell (admin → admin shell; other roles → user portal, INFERRED) | SHU-136–137, 373–378; SHA-118–119 | Pelajar, Admin | OBSERVED + DV-M06-07 (DV-SH-03) |
| FN-M06-1.2.5 | Admin sidebar group toggle `fa-graduation-cap` "SPM" (collapsed by default) with "Databank Soalan" `fa-database` → `/spm/tahun-lepas`, "Latih Tubi" `fa-bolt` → `/spm/latih-tubi`, "Tracking A" `fa-crosshairs` → `/spm/ramalan`, "Subjektif" `fa-pen-fancy` → `/spm/subjektif` (admin panel pages) | SHA-045–049 | Admin | OBSERVED |
| FN-M06-1.2.6 | Admin mobile "Lagi" sheet section "SPM" with the same four links | SHA-141, 146–150 | Admin | OBSERVED |
| FN-M06-1.2.7 | Admin sidebar items "SPM Walkthrough" `fa-pen-to-square` → `/pusat-ai/spm` (group "🤖 Pusat AI") and "SPM Mock Exam" `fa-file-pen` → `/spm-mock` (group "💎 Killer Features") | SHA-098, 109 | Admin | OBSERVED |

**FT-M06-1.3 — Access, unknown codes and gating** (all M06 routes)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-1.3.1 | Every M06 route requires a session; a guest is sent to `/login` (M01 pattern) | — | Guest | INFERRED (M01/M02 pattern) |
| FN-M06-1.3.2 | Unknown subject code (S4 `/spm/latih-tubi/XYZ`, S6 `/spm/ramalan/XYZ`) or unknown mock id (S12) → HTTP 404 global page (M01 FN-M01-2.4.x): "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice` (M01 DV-02), "PRESTASIPLUS"; tab "404 - Halaman Tidak Dijumpai | PRESTASIPLUS" | S4-061–067; S6-117–123; S12-055–061 | All | OBSERVED + M01 DV-02 |
| FN-M06-1.3.3 | No premium gate, PRO badge or package upsell on any M06 screen (as observed); SPM package / PKSK gating, if any, belongs to M19/M07 (OQ-M06-02) | — | Pelajar, Admin | OBSERVED (admin) / L-13 pending |

**FT-M06-1.4 — Duta / Maestro recommendation card (M24 component)** (S11, S12, S13)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-1.4.1 | One `.duta-card` link → `/bilik-duta/{slug}` (M24): avatar initials, name, tagline, star icon, pills "🥇 Duta Bintang", "📚 {subjek}", "📍 {negeri}", "⭐ {rating}"; one `bintang`-tier ambassador picked at random per page load; on S12 a subject match is preferred (BR-M06-27) | S11-005–010; S12-007–012, 062–064; S13-016–021 | Pelajar, Admin | OBSERVED (random pick replicated) |

### EP-M06-2 — Databank Soalan (random question bank)

**FT-M06-2.1 — Databank subject list** (S2 `/spm/tahun-lepas`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-2.1.1 | Back link `fa-arrow-left` "Kembali ke Mod SPM" → `/spm`, h1 `fa-database` "Databank Soalan SPM", sub "Pilih subjek dan mula jawab dari bank soalan" | S2-004–006 | Pelajar, Admin | OBSERVED |
| FN-M06-2.1.2 | 18 subject cards (white, not links; 1 column, 2 from `md`, 3 from `lg`) in the fixed live order BM, BI, MATH, SCI, SEJ, BIO, EKON, PHY, GEO, CHEM, ADDMATH, PI, PM, PSV, PSI, PERNIAGA, AKAUN, TI: colour icon tile (DV-M06-03), h3 name, English name, "{n} soalan dalam databank" | S2-007–010, 016–019, 025–028, 034–037, 043–046, 052–055, 061–064, 070–073, 079–082, 088–091, 097–100, 106–109, 115–118, 124–127, 133–136, 142–145, 151–154, 160–163 | Pelajar, Admin | OBSERVED + DV-M06-03 |
| FN-M06-2.1.3 | Row "Pilih set:" + three links "5", "10", "20" → `/spm/tahun-lepas/{CODE}/quiz?count={5|10|20}` (start a databank quiz directly; no year selector) | S2-011–014, 020–023, 029–032, 038–041, 047–050, 056–059, 065–068, 074–077, 083–086, 092–095, 101–104, 110–113, 119–122, 128–131, 137–140, 146–149, 155–158, 164–167 | Pelajar, Admin | OBSERVED |
| FN-M06-2.1.4 | Plain amber text "Mula" at the right of the row (not a link, as live; DV-M06-13 replicate) | S2-015, 024, 033, 042, 051, 060, 069, 078, 087, 096, 105, 114, 123, 132, 141, 150, 159, 168 | Pelajar, Admin | OBSERVED |
| FN-M06-2.1.5 | Query `?subject=` is ignored (same page) | — | Pelajar, Admin | OBSERVED |

**FT-M06-2.2 — Databank quiz session (live-session states L-1, L-2)** (`/spm/tahun-lepas/{CODE}/quiz?count=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-2.2.1 | Opening a start link mounts the M05 `<PracticeQuiz>` (M05 §7.1) with `start = {mode:"past_year", subjectCode, count}`; M05 §7 #4 creates the session in the M05 store with `count` random questions from `questionStore.spmPool` of the subject (M04 BR-M04-32); "Lapor Soalan" opens the M04 `ReportQuestionModal` with `source:"spm"` | — | Pelajar, Admin | SOURCE-DERIVED (route, history type) / INFERRED (page) |
| FN-M06-2.2.2 | Quiz page states, layout and copy are those of `<PracticeQuiz>` (M05 §7.1, S7 source template); M06 passes `headerTitle` = subject name and the M05 Q1 label set (PROPOSED COPY, M05 §8.3); page copy specific to SPM on live is UNVERIFIED | — | Pelajar, Admin | INFERRED (L-1) |
| FN-M06-2.2.3 | Finishing completes the session through M05 §7 #6 with the BR-31 write contract (session totals, QuizAnswer rows, revision queue, SubjectMastery counters, trial counter, M14 wallet); the session then appears on S10 and in the S1/S10 stats (coins = correct answers, OBSERVED) and on M05 `/practice/history` with the badge "Latihan" (M05) | — | Pelajar, Admin | OBSERVED (history arithmetic) / M05 BR-31 |

### EP-M06-3 — Latih Tubi SPM

**FT-M06-3.1 — Latih Tubi subject list** (S3 `/spm/latih-tubi`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-3.1.1 | Back link "Kembali ke Mod SPM" → `/spm`, h1 `fa-brain` "Latih Tubi SPM", sub "Pilih subjek untuk mula berlatih (Tingkatan 4 & 5)" | S3-004–006 | Pelajar, Admin | OBSERVED |
| FN-M06-3.1.2 | Section headings `fa-crown` "Subjek Teras ({n})" and `fa-puzzle-piece` "Subjek Elektif ({n})"; Teras order BM, BI, MATH, SCI, SEJ, PI, PM; Elektif GEO, BIO, CHEM, PHY, PERNIAGA, AKAUN, EKON, ADDMATH, PSV, BA, TI, PSI; cards 1 → 2 → 3 columns | S3-007, 043 | Pelajar, Admin | OBSERVED |
| FN-M06-3.1.3 | Subject card link → `/spm/latih-tubi/{CODE}`: icon tile (visible glyph, DV-M06-03), name, English name, chip `fa-brain` "{n} soalan" (indigo; n = the subject's databank count, identical to S2 for all 18 databank subjects; BA 0), `fa-chevron-right` | S3-008–011, 013–016, 018–021, 023–026, 028–031, 033–036, 038–041, 044–046, 048–050, 052–054, 056–058, 060–068, 070–072, 074–076, 080–085 | Pelajar, Admin | OBSERVED + DV-M06-03 |
| FN-M06-3.1.4 | Target chip `fa-bullseye` (emerald) "Target Custom: {n}" / "Target SPM: {n}" / "Target Latihan: {n}" when the subject has a target; none otherwise | S3-012, 017, 022, 027, 032, 037, 042, 047, 051, 055, 059, 069, 073, 079, 086 | Pelajar, Admin | OBSERVED |
| FN-M06-3.1.5 | Locked card when the subject count < its target (live: Bahasa Arab "0 soalan", "Locked: 0/40"): amber border/background, amber chip `fa-lock` "Locked: {have}/{target}", `fa-lock` instead of the chevron, `href="javascript:void(0)"` + `pointer-events-none` (not clickable); S4 stays reachable by URL and shows the same count (DV-M06-01) | S3-077–078 | Pelajar, Admin | OBSERVED + DV-M06-01 |

**FT-M06-3.2 — Tetapan Kuiz (quiz settings)** (S4 `/spm/latih-tubi/{CODE}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-3.2.1 | Back link `fa-arrow-left` "Kembali" → `/spm/latih-tubi` | S4-004 | Pelajar, Admin | OBSERVED |
| FN-M06-3.2.2 | Icon tile (visible glyph, DV-M06-03) + h1 subject name; sub "{total} soalan tersedia" (total = the same pool as the S3/S2 count, DV-M06-01; e.g. Matematik 1,681, Bahasa Arab 0) and, when a target exists, " · " + "Target {SPM|Custom|Latihan} set: {n} soalan"; tab title "Latih Tubi SPM — {Subjek}" | S4-005–007, 024–025, 032–033, 046–047, 052–053 | Pelajar, Admin | OBSERVED + DV-M06-01/03 |
| FN-M06-3.2.3 | Card `fa-cog` "Tetapan Kuiz" (client state: selectedLevel null, selectedDifficulty null, questionCount = default) | S4-008–009 | Pelajar, Admin | OBSERVED |
| FN-M06-3.2.4 | "Tingkatan": buttons "Tingkatan 4" / "{n} soalan" and "Tingkatan 5" / "{n} soalan" (thousands separators; counts of the same pool as the S4 total, DV-M06-01); click selects (10 / 11), click again clears; selected `border-blue-500 bg-blue-50 shadow-md` | S4-010–012, 026–027, 034 | Pelajar, Admin | OBSERVED + DV-M06-01 |
| FN-M06-3.2.5 | "Tahap Kesukaran": buttons "Asas", "Pertengahan", "Sukar", "Sangat Sukar" bound to difficulty keys 2, 3, 4, 5 of the site-wide 1–5 scale (M04 Mudah, Sederhana, Sukar, Sangat Sukar), each "{n} soalan" (unformatted numbers, as live; "Sangat Sukar" shows 0 because no question has difficulty 5); key 1 (Sangat Mudah) is reachable only by leaving the difficulty empty (deliberate limit, D10); toggle; selected green / yellow / orange / red; helper "Biarkan kosong untuk campuran semua tahap"; 4 in a row from 640px, 2 per row below (DV-M06-08) | S4-013–018, 028, 035, 048 | Pelajar, Admin | OBSERVED (DV-M06-02 withdrawn) + DV-M06-08 |
| FN-M06-3.2.6 | "Bilangan Soalan" for a subject with a target: one option "{n} (Target SPM|Custom|Latihan)" (emerald when not selected, blue when selected; selected by default) and helper "Set penuh target {spm|custom|latihan} untuk {Subjek} disasar pada {n} soalan." | S4-019–022, 029–030, 049–050, 054–055 | Pelajar, Admin | OBSERVED |
| FN-M06-3.2.7 | Button-link `fa-play-circle` "Mula Kuiz" with href `/spm/latih-tubi/{CODE}/quiz?count={n}[&level={10|11}][&difficulty={2..5}]` recomputed on every change | S4-023, 031, 044–045, 051, 056, 058, 060 | Pelajar, Admin | OBSERVED |
| FN-M06-3.2.8 | "Bilangan Soalan" for a subject without a target (PERNIAGA, AKAUN, PSV, TI): options "5", "10", "20", "30", "40", "50", "60", default 10; helper "Pilih bilangan soalan ikut keperluan latihan anda." | S4-036–043 | Pelajar, Admin | OBSERVED |
| FN-M06-3.2.9 | With a Tingkatan selected the difficulty counts switch to that level's counts (`difficultyByLevel`); cleared → subject totals | S4-057, 059 | Pelajar, Admin | OBSERVED |

**FT-M06-3.3 — Latih Tubi quiz session (L-3, L-4)** (`/spm/latih-tubi/{CODE}/quiz?count=&level=&difficulty=`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-3.3.1 | "Mula Kuiz" opens `<PracticeQuiz>` with `start = {mode:"latih_tubi", subjectCode, count, levelId?, difficulty?}`; M05 §7 #4 builds the session from `questionStore.spmPool` filtered by level and difficulty; "Lapor Soalan" `fa-flag` calls `openReport(currentQuestion.id)` → M04 modal `source:"spm"` | — | Pelajar, Admin | SOURCE-DERIVED (M04 discovery S14 host page) / INFERRED |
| FN-M06-3.3.2 | Fewer matching questions than `count`: the session uses all that match; zero matches (e.g. `difficulty=5`) → no quiz, message in PROPOSED COPY with a link back to S4 (the live behaviour is UNVERIFIED, OQ-M06-04) | — | Pelajar, Admin | INFERRED (L-3) |
| FN-M06-3.3.3 | Finishing completes the session through M05 §7 #6 (BR-31) and writes a `latih_tubi` row (S10 badge "Latih Tubi"); result per `<PracticeQuiz>` | — | Pelajar, Admin | OBSERVED (rows) / INFERRED (L-4) |
| FN-M06-3.3.4 | Single-question variant (M04 "Buka Soalan Sama", M04 BR-M04-17): `/spm/latih-tubi/{CODE}/quiz?question_id={id}&count=1` opens `<PracticeQuiz>` with `start = {mode:"latih_tubi", subjectCode, count:1, targetQuestionId:id}`; the question is resolved with `questionStore.getEligible(id)` (null for inactive, unknown or non-SPM rows) and must belong to the subject; otherwise no session starts and the page returns to S4. The target-count rule does not apply | — | Pelajar, Admin | OBSERVED (URL, M04) / INFERRED (L-3) |

### EP-M06-4 — Tracking A

**FT-M06-4.1 — Tracking A hub** (S5 `/spm/ramalan`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-4.1.1 | Back link "Kembali ke Mod SPM" → `/spm`, h1 `fa-hat-wizard` "Tracking A SPM" + purple pill "TRACKING A", sub "Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!" | S5-004–007 | Pelajar, Admin | OBSERVED |
| FN-M06-4.1.2 | Lane card: label "Tracking A Objektif" (displayed upper case by CSS), h3 "Subjek objektif penuh", "Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set.", badge "{n} subjek", chips `fa-layer-group` "{n} set", `fa-file-circle-check` "{n} soalan" (BR-M06-10) | S5-008–013 | Pelajar, Admin | OBSERVED |
| FN-M06-4.1.3 | Lane card: label "Tracking A Bahasa" (upper case by CSS), h3 "BM dan BI format sebenar", "Lane khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ.", badge "2 subjek", chips "{n} set", `fa-language` "Paper-based tracking" | S5-014–019 | Pelajar, Admin | OBSERVED |
| FN-M06-4.1.4 | Card "Admin Readiness" (upper case by CSS): h2 "Status set Tracking A SPM semasa", "Laporan ini bezakan set bersih, set bank besar, dan set yang masih lock supaya bacaan readiness lebih jujur.", chips "Set Bersih: {n} set", "Bank Besar: {n} set", "Locked: {n} set" (sums of the tiles). Shown to admins only | S5-020–026 | Admin | OBSERVED / INFERRED (admin-only) |
| FN-M06-4.1.5 | One readiness tile per subject with a target, in the live order BM, BI, MATH, SCI, SEJ, PI, PM, ADDMATH, PHY, CHEM, BIO, GEO, BA, EKON, PSI: h3 name, "{CODE} · Target set: {n} soalan", badge "{bersih}/{total} set bersih" | S5-027–029, 040–042, 051–053, 069–071, 087–089, 100–102, 111–113, 122–124, 133–135, 149–151, 167–169, 182–184, 201–203, 212–214, 230–232 | Admin | OBSERVED |
| FN-M06-4.1.6 | Four mini stats "Set Bersih", "Bank Besar", "Locked", "Readiness" ({p}% = round((bersih + bank besar) / total × 100), 0% when no sets) | S5-030–037, 043–050, 054–061, 072–079, 090–097, 103–110, 114–121, 125–132, 136–143, 152–159, 170–177, 185–192, 204–211, 215–222, 233–240 | Admin | OBSERVED (arithmetic) |
| FN-M06-4.1.7 | "Set Masih Lock" (upper case by CSS) with up to 6 chips "2026 Set {n} · {ready}/{target}" of the locked sets in set order; section absent when Locked = 0 | S5-038–039, 062–068, 080–086, 098–099, 144–148, 160–166, 178–181, 194–200, 223–229, 241–246 | Admin | OBSERVED |
| FN-M06-4.1.8 | Note (only when the tile has a bank-besar set): "Set bank besar boleh dibuka, tetapi bank sumber melebihi target set. Rujuk page subjek untuk beza set bersih vs bank besar." | S5-193 | Admin | OBSERVED |
| FN-M06-4.1.9 | Section label "Tracking A Bahasa" (upper case by CSS), h2 "BM dan BI ikut format kertas sebenar", "Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set berstruktur dan komponen sebenar peperiksaan.", pill "Paper-based tracking"; cards Bahasa Melayu / Malay Language and Bahasa Inggeris / English Language with "{n} set", "Berstruktur / respons sebenar", "Buka Tracking A Bahasa" → `/latihan-berstruktur?subject_id={1|2}&scope=spm&track=bahasa` | S5-247–256 | Pelajar, Admin | OBSERVED |
| FN-M06-4.1.10 | Open objective subject cards (subjects with ≥1 startable set) → `/spm/ramalan/{CODE}`: name, English name, `fa-file-alt` "{n} soalan kuiz siap guna", then when applicable `fa-layer-group` "{n} bank besar", `fa-circle-check` "{n} set bersih" and `fa-bullseye` "Target {SPM|Latihan}: {n}" (target subjects only), `fa-database` "Bank source: {n}" (bank-besar only), "{n} set", footer "Pilih Set" `fa-chevron-right` | S5-257–269 | Pelajar, Admin | OBSERVED |

**FT-M06-4.2 — Tracking A set list** (S6 `/spm/ramalan/{CODE}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-4.2.1 | Back link "Kembali" → `/spm/ramalan`, icon tile + h1 subject, sub "Tracking A SPM" [+ " · " + "Target {SPM|Latihan} set: {n} soalan"]; tab "Tracking A SPM — {Subjek}" | S6-004–007, 035, 051–052, 101–102, 108 | Pelajar, Admin | OBSERVED |
| FN-M06-4.2.2 | Summary chips (purple panel): `fa-circle-check` "{n} set bersih", `fa-layer-group` "{n} set bank besar", `fa-file-circle-check` "{n} soalan kuiz siap guna", `fa-lock` "{n} set belum cukup" (only when > 0), `fa-bullseye` "Target {SPM|Latihan}: {n} / set" (target only) | S6-008–012, 036–037, 053, 103–104, 109–110 | Pelajar, Admin | OBSERVED |
| FN-M06-4.2.3 | h2 `fa-calendar` "Tracking A 2026"; set cards 1 column, 2 from `md`; startable sets first, then locked, each by set number (PSI Set 4 before Set 3) | S6-013 | Pelajar, Admin | OBSERVED / INFERRED (sort) |
| FN-M06-4.2.4 | Startable set card (link → `/spm/ramalan/{CODE}?year=2026&set={n}`, play tile): "Set {n}", badge "Set Bersih" (emerald) or "Ready Bank Besar" (blue), "{n} soalan kuiz siap guna", "Format set: {ready} / {target}" (target only), bank-besar text "Bank source: {n}. Sistem tetap ambil {target} soalan ikut prioriti semasa.", `fa-tag` "DSKP: {a}/{b} ({p}%)" | S6-014–016, 054–100, 111 | Pelajar, Admin | OBSERVED |
| FN-M06-4.2.5 | Locked set card (amber, `javascript:void(0)`, `pointer-events-none`, lock tile): "Set {n}", badge "Belum Cukup", "{n} soalan kuiz siap guna", "Format set: {n} / {target}", "Belum cukup soalan untuk format KPM.", DSKP line | S6-017–034, 038–050, 112–116 | Pelajar, Admin | OBSERVED |
| FN-M06-4.2.6 | Empty (no sets): chips "0 set bersih", "0 set bank besar", "0 soalan kuiz siap guna" (+ target chip), then "Belum Ada Set Tracking A" / "Set Tracking A untuk subjek ini akan ditambah tidak lama lagi." | S6-105–107 | Pelajar, Admin | OBSERVED |
| FN-M06-4.2.7 | `/spm/ramalan/BM` and `/spm/ramalan/BI` redirect to `/latihan-berstruktur?subject_id={1|2}&scope=spm&track=bahasa` | — | Pelajar, Admin | OBSERVED |

**FT-M06-4.3 — Tracking A set quiz (L-5)** (`/spm/ramalan/{CODE}?year=2026&set={n}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-4.3.1 | Opening a startable set opens `<PracticeQuiz>` with `start = {mode:"ramalan", subjectCode, year:2026, setNo}`; the session holds the set's eligible questions (bank-besar: the first `target` by priority; no target: all ready questions); the set records reference M04 question ids of the SPM pool | — | Pelajar, Admin | SOURCE-DERIVED (route, card copy) / INFERRED (L-5) |
| FN-M06-4.3.2 | A locked (Belum Cukup) set or unknown set number cannot be started: the start URL returns to S6 (no session) | — | Pelajar, Admin | INFERRED (SEC-M06-03) |
| FN-M06-4.3.3 | Finishing completes the session through M05 §7 #6 (BR-31) and writes a `ramalan` row (S10 badge "Tracking A") | — | Pelajar, Admin | OBSERVED (filter value) / INFERRED (L-5, L-12) |

**FT-M06-4.4 — Tracking A Bahasa list (SPM variant of the M05 structured list)** (S7 `/latihan-berstruktur?subject_id={1|2}&scope=spm&track=bahasa`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-4.4.1 | Back link "Kembali ke Tracking A SPM" → `/spm/ramalan`, pill `fa-language` "TRACKING A BAHASA", h1 "Tracking A Bahasa", sub "Set bahasa dibuka ikut format kertas sebenar. BM dan BI tidak dipaksa menjadi 40 MCQ, dan dipaparkan mengikut susunan BM kemudian BI." | S7-004–007 | Pelajar, Admin | OBSERVED |
| FN-M06-4.4.2 | Info card "Subjek bahasa tidak dipaksa menjadi 40 MCQ. Laluan ini menggunakan paper-based tracking dengan pendekatan berstruktur / respons sebenar." + chips `fa-book-open` "BM dahulu, BI kemudian", `fa-file-lines` "Format kertas sebenar", "Paper-based tracking", `fa-pen-fancy` "Berstruktur / respons sebenar", `fa-layer-group` "{n} set ditemui" (n = result total) | S7-008–014, 077, 099 | Pelajar, Admin | OBSERVED |
| FN-M06-4.4.3 | GET filter form (hidden `scope=spm`, `track=bahasa`): "Subjek" `subject_id` (Semua Subjek, Bahasa Melayu, Bahasa Inggeris), "Aras KBAT" `kbat_level` (Semua, 1. Mengingat … 6. Mencipta), `fa-search` "Cari" | S7-015–023 | Pelajar, Admin | OBSERVED |
| FN-M06-4.4.4 | Set cards (M05 shared card template; 1 → 2 (`sm`) → 3 (`xl`) columns, 20 per page): chips subject, KBAT band ("LOTS 1/2", "MOTS 3", "HOTS 4+"), "{n}m", "Tingkatan {n}", optional "Trial"; stem (3-line clamp); optional topic `fa-book-open`; `fa-layer-group` "{n} bahagian · {m} markah"; `fa-user-pen` "{author} · {school}"; `fa-list-ol` "{n} soalan · Tingkatan {n}"; "Semua Subjek" lists BM sets before BI sets (DV-M06-10) | S7-024–033, 035–044, 046–055, 078–098, 100–117 | Pelajar, Admin | OBSERVED + DV-M06-10 |
| FN-M06-4.4.5 | "Mula" `fa-arrow-right` → `/latihan-berstruktur/{id}/jawab?scope=spm&track=bahasa` | S7-034, 045, 056 | Pelajar, Admin | OBSERVED |
| FN-M06-4.4.6 | Laravel pager (English): ≥640px "Showing {from} to {to} of {total} results" + page links with "..." window and chevrons; <640px "« Previous" / "Next »"; links keep `subject_id`, `scope`, `track`, `kbat_level` | S7-057–076, 118–119 | Pelajar, Admin | OBSERVED |
| FN-M06-4.4.7 | Answer page `/latihan-berstruktur/{id}/jawab?scope=spm&track=bahasa` = the M05 `<StructuredAnswer>` (M05 §7.1) with `scope:"spm"`, `track:"bahasa"`; its back link returns to S7; the set comes from the M04 `structuredStore` (M05 §7 #16) | — | Pelajar, Admin | INFERRED (L-6) |

### EP-M06-5 — Subjektif SPM

**FT-M06-5.1 — Subjektif hub** (S8 `/spm/subjektif`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-5.1.1 | Back link "Kembali ke Mod SPM" → `/spm`, h1 "Latihan Subjektif SPM" with a teal pen icon (`subjektif-desktop.png`), sub "Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank subjektif Tingkatan 4 dan 5." | S8-004–006 | Pelajar, Admin | OBSERVED |
| FN-M06-5.1.2 | Info box `fa-info-circle` bold "Bagaimana ia berfungsi?" + "Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan model jawapan. Bank ini ditarik daripada soalan berstruktur Tingkatan 4 dan 5 yang telah diterbitkan." | S8-007–008 | Pelajar, Admin | OBSERVED |
| FN-M06-5.1.3 | 4 stat cards (labels upper case by CSS): "Set Dijawab" {n} "Percubaan subjektif SPM yang telah dihantar"; "Subjek Dicuba" {n} "Bilangan subjek subjektif SPM yang pernah dicuba"; "Skor Terbaik" "Belum Ada" or "{p}%" "Skor tertinggi merentas semua set subjektif SPM"; "Set Terbaik Disimpan" {n} "Bilangan set yang mempunyai percubaan terbaik tersimpan" | S8-009–024 | Pelajar, Admin | OBSERVED / INFERRED (non-empty values) |
| FN-M06-5.1.4 | Tabs "Semua" {15}, "Teras" {5}, "Elektif" {10} (count pills); default Semua; active Semua `bg-slate-900` white text readable (DV-M06-09), active Teras `bg-teal-600`, active Elektif `bg-amber-500`; tabs wrap | S8-025–030 | Pelajar, Admin | OBSERVED + DV-M06-09 |
| FN-M06-5.1.5 | "Semua" grid: 15 subject cards (1 → 2 → 3 columns) → `/latihan-berstruktur?subject_id={id}&scope=spm`: icon tile, name + badge "Teras" (teal) or "Elektif" (amber), English name, chip `fa-pen` "{n} set subjektif", chevron; order Teras A–Z then Elektif A–Z | S8-031–090 | Pelajar, Admin | OBSERVED |
| FN-M06-5.1.6 | "Teras" and "Elektif" grids show only that group's cards (`x-show`), same card | S8-091–150 | Pelajar, Admin | OBSERVED |

**FT-M06-5.2 — Subjektif SPM list and answer (SPM variant of the M05 structured list)** (S9 `/latihan-berstruktur?subject_id={id}&scope=spm`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-5.2.1 | Back link "Kembali ke Subjektif SPM" → `/spm/subjektif`, h1 "Subjektif SPM", sub "Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa" | S9-004–006 | Pelajar, Admin | OBSERVED |
| FN-M06-5.2.2 | GET filter (hidden `scope=spm`): "Subjek" (Semua Subjek + the 15 subjects in S8 option order: Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Biologi, Ekonomi, Fizik, Geografi, Kimia, Matematik Tambahan, Perniagaan, Prinsip Perakaunan, Sains Komputer, Tasawwur Islam), "Aras KBAT" (Semua, 1–6), "Cari" | S9-007–014 | Pelajar, Admin | OBSERVED |
| FN-M06-5.2.3 | Set cards as FN-M06-4.4.4 (incl. optional topic line `fa-book-open`) | S9-015–024, 026–035, 037–046, 068–093, 096–106, 109–125 | Pelajar, Admin | OBSERVED |
| FN-M06-5.2.4 | "Mula" → `/latihan-berstruktur/{id}/jawab?scope=spm` | S9-025, 036, 047 | Pelajar, Admin | OBSERVED |
| FN-M06-5.2.5 | Pager as FN-M06-4.4.6 (links keep `subject_id`, `scope`, `kbat_level`) | S9-048–067, 107–108 | Pelajar, Admin | OBSERVED |
| FN-M06-5.2.6 | Empty: "Tiada soalan berstruktur buat masa ini" / "Soalan akan ditambah oleh guru dan admin" (no pager) | S9-094–095 | Pelajar, Admin | OBSERVED |
| FN-M06-5.2.7 | Answer page `/latihan-berstruktur/{id}/jawab?scope=spm` = M05 `<StructuredAnswer>` with `scope:"spm"`; submitting posts M05 §7 #17 and stores a StructuredAttempt (M05 DATA-M05-06) with `scope = "spm"` (and `track` when opened from S7) | — | Pelajar, Admin | INFERRED (L-7) |
| FN-M06-5.2.8 | S8 stats derive from the user's StructuredAttempts with `scope = "spm"` (M05 DATA-M05-06): sets answered = submitted attempts, subjects tried = distinct subjects, best score = highest attempt % ("Belum Ada" when none), best sets saved = sets with a best attempt | — | Pelajar, Admin | INFERRED (L-7) |

### EP-M06-6 — SPM Mock Exam

**FT-M06-6.1 — Mock form and previous mocks** (S11 `/spm-mock`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-6.1.1 | Hero (brown/orange gradient): h1 "📝 SPM Mock Exam", "Mock SPM penuh dengan timer + auto-grade + weakness analysis. Boleh attempt setiap bulan." | S11-001–002 | Pelajar, Admin | OBSERVED |
| FN-M06-6.1.2 | Duta block title "⭐ Maestro SPM Untuk Anda" (upper case by CSS) and "Cikgu pakar yg dah bantu pelajar score A+ — tonton video mereka sebelum mula mock." + one Duta card (FN-M06-1.4.1) | S11-003–004 | Pelajar, Admin | OBSERVED |
| FN-M06-6.1.3 | Warning box: "⚠️ " + bold "Persediaan sebelum mula:" + " Pastikan masa anda cukup. Setelah klik "Mula", timer akan jalan dan tak boleh stop. Kalau pause, score akan jejas." | S11-011–012 | Pelajar, Admin | OBSERVED |
| FN-M06-6.1.4 | Form `POST /spm-mock/jana`: "Subjek" `subject` required ("Pilih subjek", Bahasa Melayu, English, Matematik, Matematik Tambahan, Fizik, Kimia, Biologi, Sains, Sejarah, Pendidikan Islam; values = labels), "Paper" `paper_number` required ("Paper 1 (Objektif)" = 1 default, "Paper 2 (Esei/Struktur)" = 2) (labels upper case by CSS); submit "🎯 Jana Mock SPM"; fields stack below 640px (DV-M06-08) | S11-013–019 | Pelajar, Admin | OBSERVED + DV-M06-08 |
| FN-M06-6.1.5 | Heading "📚 Mock Sebelum Ini"; list of the user's mocks, newest first | S11-020 | Pelajar, Admin | OBSERVED |
| FN-M06-6.1.6 | In-progress row: "{Subjek} · Paper {n}", "{relative time} · " + red "Belum submit", chip "Belum" (`grade-pending`, slate, at its intended small size `.85rem` — live `.sm-card .grade {font-size:1.5rem}` overrides it; DV-M06-08), link "Sambung →" → `/spm-mock/{id}` | S11-021–026 | Pelajar, Admin | OBSERVED + DV-M06-08 |
| FN-M06-6.1.7 | Submitted row: "{Subjek} · Paper {n}", "{relative time} · Score: {a}/{b} ({p}%)" (2 decimals), grade chip (A+/A emerald, B+/B blue, C amber, D/E/G red; DV-M06-06), link "Lihat →" → `/spm-mock/{id}/result`; below 640px chip and link sit on their own line (DV-M06-08) | S11-027–031 | Pelajar, Admin | OBSERVED + DV-M06-06/08 |

**FT-M06-6.2 — Mock generation and in-exam page (L-8, L-10)** (`POST /spm-mock/jana`, `/spm-mock/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-6.2.1 | Submit with no subject → native required-field bubble; nothing sent | — | Pelajar, Admin | OBSERVED (required attribute) |
| FN-M06-6.2.2 | "🎯 Jana Mock SPM" posts subject + paper, creates a mock and opens `/spm-mock/{id}`; the mock then shows on S11 as "Belum submit" + "Sambung →" until submitted | — | Pelajar, Admin | OBSERVED (form, S11 row) / INFERRED (L-8) |
| FN-M06-6.2.3 | In-exam page `/spm-mock/{id}` — UNVERIFIED, pending L-8: layout, item count per paper, answer inputs and button copy were not observed. Prototype neutral placeholder only: title "{Subjek} · Paper {n}", the mock's items with an answer input each, one submit button (PROPOSED COPY), to be replaced after L-8 | — | Pelajar, Admin | UNVERIFIED (L-8) |
| FN-M06-6.2.4 | Timer — UNVERIFIED, pending L-8: live copy says only "Mock SPM penuh dengan timer" and "timer akan jalan dan tak boleh stop. Kalau pause, score akan jejas."; direction (count-up or countdown), duration, auto-submit at time-out and any pause penalty are not specified. Evidence limit: the 2-month-old unsubmitted mock 317 shows only that nothing server-side closes a mock. The prototype placeholder shows a timer element derived from `createdAt` and is provisional | — | Pelajar, Admin | UNVERIFIED (L-8) |
| FN-M06-6.2.5 | Submitting grades the mock and opens S12 (the result page is OBSERVED). Mock answers are stored in the M06 MockExam record only: mocks are not practice sessions (M05 DATA-M05-01), are not listed on `/spm/history` or `/practice/history` (OBSERVED: live history shows only the 4 quiz sessions while mock 16 exists), and do not write QuizAnswer rows, the revision queue, mastery counters or the wallet (M05 BR-31 does not cover them). How Paper 2 is marked is UNVERIFIED (simulated, D4); no monthly-limit refusal is specified (OQ-M06-05) | — | Pelajar, Admin | OBSERVED (history absence) / INFERRED (L-8, L-10) |

**FT-M06-6.3 — Mock result** (S12 `/spm-mock/{id}/result`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-6.3.1 | Hero `.mr-hero`: h1 "{Subjek} · Paper {n}", big grade, "{p}%" (2 decimals), "{score} / {max} markah"; red (`bad`), yellow (`mid`) or green by grade band (BR-M06-24); tab "Result Mock SPM — {Subjek}" | S12-001–004 | Pelajar, Admin | OBSERVED (red) / INFERRED (bands) |
| FN-M06-6.3.2 | Duta block "🎓 Cikgu Pakar {Subjek}" (upper case by CSS) / "Lemah dlm topik tertentu? Cikgu pakar ni boleh bantu anda naik ke A+ next round." + one Duta card (subject-matched when possible) | S12-005–006 | Pelajar, Admin | OBSERVED |
| FN-M06-6.3.3 | Card "📉 Topik Lemah — Fokus Belajar Ke Sini": rows "{topik}" / "{n} soalan tersilap" (red left border) sorted by count desc; tip "💡 Cikgu Alesa cadang anda fokus belajar topik atas dulu. Boleh start dengan " + link "jana nota ringkas" → `/pusat-nota-ringkas` (M25) + " untuk topik tersebut."; counts sum to the wrong items (DV-M06-05) | S12-013–026 | Pelajar, Admin | OBSERVED + DV-M06-05 |
| FN-M06-6.3.4 | Card "📋 Review Setiap Soalan": per item (`.wrong` red / `.correct` green) header "✗|✓ Soalan {n} · {m}/{max} markah" (upper case by CSS: displays "✗ SOALAN 1 · 0/1 MARKAH"), question text, "**Anda:** {answer|(tiada jawapan)}", "**Jawapan:** {model}", italic feedback (e.g. "Jawapan betul: A", repeated as live); items = all items of the mock; score = sum of item marks (DV-M06-05) | S12-027–052 | Pelajar, Admin | OBSERVED + DV-M06-05 |
| FN-M06-6.3.5 | Actions "📝 Mock Lain" → `/spm-mock`, "📚 Belajar Topik Lemah" → `/pusat-nota-ringkas` | S12-053–054 | Pelajar, Admin | OBSERVED |
| FN-M06-6.3.6 | Other grades and a correct review item (green, "✓") render per the same template; Paper 2 items show the typed answer and the model answer with marker feedback | — | Pelajar, Admin | SOURCE-DERIVED (CSS classes) / INFERRED (L-9) |

### EP-M06-7 — SPM Walkthrough (AI, simulated)

**FT-M06-7.1 — Walkthrough form and result** (S13 `/pusat-ai/spm`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-7.1.1 | h1 "📝 SPM Walkthrough", "Snap soalan SPM, AI walk-through step-by-step dengan mark scheme + sebutan buku teks. Faham bukan hafal."; single column max 880px | S13-001–002 | Pelajar, Admin | OBSERVED |
| FN-M06-7.1.2 | Form `#spmForm` (no `novalidate`): "Subjek" `subject` natively `required` ("Pilih" = empty, Bahasa Melayu, English, Matematik, Matematik Tambahan, Fizik, Kimia, Biologi, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Geografi, Ekonomi, Perdagangan, Prinsip Akaun), "Tahun (opsyen)" `year` (`maxlength="8"`, placeholder "Cth: 2023"), "Soalan (taip atau snap)" `question_text` (placeholder "Salin soalan SPM di sini, atau upload gambar di bawah...", not required); labels upper case by CSS; "Subjek" and "Tahun (opsyen)" side by side from 640px and stacked below (DV-M06-08). An empty Subjek is stopped by the native bubble before the script runs (no busy state, request or alert) | S13-003–009 | Pelajar, Admin | OBSERVED (markup, inventory `required`/`maxlength`) + DV-M06-08 |
| FN-M06-7.1.3 | Upload label "📷 Klik atau drag gambar soalan SPM (auto-extract via AI Vision)" (upper case by CSS, dashed box) over a hidden file input `image` (`accept="image/*"`); choosing a file changes the label to "📎 {filename}" | S13-010–011 | Pelajar, Admin | OBSERVED / SOURCE-DERIVED (label change) |
| FN-M06-7.1.4 | Submit `#solveBtn` "Bagi Walkthrough": `preventDefault`, button disabled + "AI sedang fikir... (mungkin 15-30s)", the previous result card hidden (`#result` display none), then `POST /pusat-ai/spm/solve` (FormData, `X-CSRF-TOKEN`, `Accept: application/json`); finally restored to "Bagi Walkthrough" | S13-012 | Pelajar, Admin | SOURCE-DERIVED (L-11) |
| FN-M06-7.1.5 | Success (`d.ok`): `#walkBody` (a `<pre>`, whitespace and line breaks kept) = `d.walkthrough || ""` as text, card `#result` with h2 "✨ Walkthrough Cikgu Alesa" shown, smooth scroll to it; canned response (D4) | S13-013 | Pelajar, Admin | SOURCE-DERIVED (L-11) + D4 |
| FN-M06-7.1.6 | Failure: `alert(error || "Ralat")`; network error `alert("Ralat: " + message)` | — | Pelajar, Admin | SOURCE-DERIVED (L-11) |
| FN-M06-7.1.7 | Duta block "🎓 Cikgu Maestro SPM" (upper case by CSS) / "Setelah baca walkthrough, tonton video penjelasan dari Duta SPM." + one Duta card | S13-014–015 | Pelajar, Admin | OBSERVED |

### EP-M06-8 — SPM quiz history

**FT-M06-8.1 — Sejarah Kuiz SPM** (S10 `/spm/history`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M06-8.1.1 | Back link "Kembali ke Mod SPM" → `/spm`, h1 "Sejarah Kuiz SPM" with a history icon (`history-desktop.png`) | S10-004–005 | Pelajar, Admin | OBSERVED |
| FN-M06-8.1.2 | 4 stat cards: "{n}" "Sesi Kuiz", "{p}%" "Purata Ketepatan" (green), "{n}" "Jumlah Syiling" (amber), "{n}" "Soalan Dijawab" (blue); all-type values, not affected by the filter (as live) | S10-006–017 | Pelajar, Admin | OBSERVED |
| FN-M06-8.1.3 | Filter links "Semua" → `/spm/history`, `fa-scroll` "Tahun Lepas" → `?type=past_year`, `fa-brain` "Latih Tubi" → `?type=latih_tubi`, `fa-hat-wizard` "Tracking A" → `?type=ramalan`; active: Semua `bg-indigo-500`, Tahun Lepas `bg-amber-500`, Latih Tubi `bg-blue-500`, Tracking A `bg-purple-500` (each `text-white shadow-md`); inactive white with slate border and `hover:border-{indigo|amber|blue|purple}-400`; an unknown `type` lists all rows with no filter active (not even "Semua") | S10-018–021 | Pelajar, Admin | OBSERVED |
| FN-M06-8.1.4 | Rows (not links), newest first: score tile "{p}%" (rounded; `bg-red-100 text-red-600` below 50%), type badge ("Tahun Lepas" amber, "Latih Tubi" blue, "Tracking A" purple), "{c}/{n} betul", "{dd Mon yyyy, hh:mm AM} · {m}m {s}s", right "+{coins} 🪙" | S10-022–045 | Pelajar, Admin | OBSERVED / INFERRED (Tracking A badge) |
| FN-M06-8.1.5 | Empty: "Belum Ada Sejarah" / "Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini." + button `fa-play-circle` "Mula Kuiz SPM" → `/spm` | S10-046–049 | Pelajar, Admin | OBSERVED |
| FN-M06-8.1.6 | Score-tile colours for ≥50% (yellow 50–79, green ≥80) and Tracking A rows | — | Pelajar, Admin | INFERRED (L-12) |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.10), which keeps the live values of discovery Appendix A except where a DV changes them. "The admin" = `admin@demo.test` (mirrors the live admin's SPM history and mocks); "the student" = `pelajar@demo.test`; "the new student" = `pelajar2@demo.test` (no SPM activity).

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M06-01 | FT-M06-1.1 | Must | As a student, I want an SPM hub with headline counts, the four SPM modules and my SPM stats, so that I can choose how to prepare. | FN-M06-1.1.1–1.1.8 |
| US-M06-02 | FT-M06-1.1 | Must | As a student, I want every SPM count to agree across screens, so that I can trust the numbers. | FN-M06-1.1.9 |
| US-M06-03 | FT-M06-1.2 | Must | As a student or admin, I want to reach M06 from the menus and see the right page title, so that I know where I am. | FN-M06-1.2.1–1.2.7 |
| US-M06-04 | FT-M06-1.3 | Must | As the owner, I want M06 closed to guests and unknown codes to show the 404 page, so that the area behaves predictably. | FN-M06-1.3.1–1.3.3 |
| US-M06-05 | FT-M06-2.1 | Must | As a student, I want to pick a subject and a set size of 5, 10 or 20 from the SPM databank, so that I can start a random quiz at once. | FN-M06-2.1.1–2.1.5 |
| US-M06-06 | FT-M06-2.2 | Must | As a student, I want the databank quiz to run and be recorded, so that it counts in my SPM history. | FN-M06-2.2.1–2.2.3 |
| US-M06-07 | FT-M06-3.1 | Must | As a student, I want to see Latih Tubi subjects grouped Teras/Elektif with counts, targets and locks, so that I pick a subject I can practise. | FN-M06-3.1.1–3.1.5 |
| US-M06-08 | FT-M06-3.2 | Must | As a student, I want to filter a Latih Tubi quiz by Tingkatan and difficulty and see how many questions each choice has, so that I practise the right level. | FN-M06-3.2.1–3.2.5, 3.2.9 |
| US-M06-09 | FT-M06-3.2 | Must | As a student, I want the question count fixed to the SPM target or chosen from 5–60, then start the quiz, so that the drill has the right length. | FN-M06-3.2.6–3.2.8 |
| US-M06-10 | FT-M06-3.3 | Must | As a student, I want the Latih Tubi quiz to use my settings (or open the single question an admin links to) and be recorded, so that I can track it. | FN-M06-3.3.1–3.3.4 |
| US-M06-11 | FT-M06-4.1 | Must | As a student, I want the Tracking A hub to show the objective and bahasa lanes and the subjects I can open, so that I can pick a Tracking A set. | FN-M06-4.1.1–4.1.3, 4.1.10 |
| US-M06-12 | FT-M06-4.1 | Should | As an admin, I want a readiness panel per subject, so that I know which Tracking A sets are clean, big-bank or still locked. | FN-M06-4.1.4–4.1.8 |
| US-M06-13 | FT-M06-4.1 / 4.4 | Must | As a student, I want the BM/BI Tracking A lane to open structured sets in the real paper format, so that I practise language papers properly. | FN-M06-4.1.9, 4.4.1–4.4.7, 4.2.7 |
| US-M06-14 | FT-M06-4.2 | Must | As a student, I want to see a subject's Tracking A sets with their status, so that I start a ready set and know which are not ready. | FN-M06-4.2.1–4.2.6 |
| US-M06-15 | FT-M06-4.3 | Must | As a student, I want to take a ready Tracking A set and have it recorded, so that I can see my Tracking A history. | FN-M06-4.3.1–4.3.3 |
| US-M06-16 | FT-M06-5.1 | Must | As a student, I want the Subjektif hub with my subjective stats and subject tabs, so that I choose a subject for structured and essay sets. | FN-M06-5.1.1–5.1.6 |
| US-M06-17 | FT-M06-5.2 | Must | As a student, I want to filter a subject's SPM structured sets and open one to answer, so that I practise Paper 2 questions. | FN-M06-5.2.1–5.2.8 |
| US-M06-18 | FT-M06-8.1 | Must | As a student, I want my SPM quiz history with stats and type filters, so that I see my progress. | FN-M06-8.1.1–8.1.6 |
| US-M06-19 | FT-M06-6.1 | Must | As a student, I want to generate a mock for a subject and paper and see my previous mocks, so that I can sit or resume a mock. | FN-M06-6.1.1–6.1.7, 6.2.1 |
| US-M06-20 | FT-M06-6.2 | Must | As a student, I want to sit the generated mock and have it graded when I submit, so that it feels like the real exam. (In-exam page UNVERIFIED, pending L-8.) | FN-M06-6.2.2–6.2.5 |
| US-M06-21 | FT-M06-6.3 | Must | As a student, I want a mock result with my grade, weak topics and a review of each question, so that I know what to study. | FN-M06-6.3.1–6.3.6 |
| US-M06-22 | FT-M06-7.1 | Should | As a student, I want to type or photograph an SPM question and get a step-by-step walkthrough, so that I understand the answer. | FN-M06-7.1.1–7.1.7 |
| US-M06-23 | FT-M06-1.4 | Could | As a student, I want a recommended SPM ambassador on the mock and walkthrough pages, so that I can watch an expert's video. | FN-M06-1.4.1 |
| US-M06-24 | cross-cutting | Must | As a student on a phone, tablet or desktop, I want every M06 screen to fit my screen, so that I can prepare anywhere. | All screen FNs; DV-M06-08, DV-M06-09 |

### Acceptance criteria

**US-M06-01 — Hub**
- **AC-M06-01.1** Given I open `/spm`, when it loads, then I see the pill "MOD SPM" (`fa-graduation-cap`), h1 "Persediaan SPM", the lead "Latihan lengkap untuk pelajar Tingkatan 4 & 5. Soalan tahun lepas, latih tubi, Tracking A, dan latihan bahasa berformat sebenar.", tab title "Mod SPM - PRESTASIPLUS" and header "Mod SPM" / "Selamat datang kembali".
- **AC-M06-01.2** Given the stat row, when it loads, then it shows "20,529" "Jumlah Soalan", "25" "Subjek SPM", "0" "Tahun Tersedia" (as live) and "1,769" "Soalan Tracking A" (computed from the sets, PROPOSED; live 1,797 — DV-M06-04) in 2 columns below `md` and 4 from `md`.
- **AC-M06-01.3** Given the module cards, when they load, then they read (in order) "Databank Soalan" / "Bank soalan SPM mengikut subjek, dipaparkan secara rawak." / "14,673 soalan"; "Latih Tubi SPM" / "Latihan ikut topik dan bab untuk Tingkatan 4 & 5." / "14,673 soalan" (both as live); "Tracking A" / "Set objektif penuh dan lane bahasa khas untuk latihan intensif menjelang SPM." / "1,769 soalan" (DV-M06-04); "Subjektif" / "Latihan soalan esei & jawapan panjang, disemak oleh guru." / "4,059 set subjektif"; each ends with "Mula" and an arrow, the whole card links to `/spm/tahun-lepas`, `/spm/latih-tubi`, `/spm/ramalan`, `/spm/subjektif`; every tile and chip icon shows a visible glyph (DV-M06-03).
- **AC-M06-01.4** Given the admin opens `/spm`, when "Prestasi SPM Anda" renders, then it shows "4" "Sesi Kuiz", "21.8%" "Purata Ketepatan", "26" "Syiling Diperoleh", "84" "Soalan Dijawab"; for the new student it shows "0", "0.0%", "0", "0".
- **AC-M06-01.5** Given the hub, when I press `fa-history` "Sejarah Kuiz SPM", then `/spm/history` opens.

**US-M06-02 — Consistent counts**
- **AC-M06-02.1** Given the seed, when I compare screens, then each S3 card count equals the S2 "{n} soalan dalam databank" of that subject (as live, 18/18; Bahasa Arab 0) and the S4 "{n} soalan tersedia" (DV-M06-01; e.g. Matematik 1,681 on S2, S3 and S4); S4 "Tingkatan 4" + "Tingkatan 5" = that total; the hub "Soalan Tracking A" equals Σ ready questions of all 2026 sets (1,769); "4,059 set subjektif" equals Σ S8; the hub "Jumlah Soalan" (20,529) and the Databank / Latih Tubi chips (14,673) are the live values and "Jumlah Soalan" ≥ each chip.
- **AC-M06-02.2** Given an admin creates an approved Matematik Tingkatan 5 MCQ on M04 S2 (it enters the SPM pool, M04 BR-M04-32), when I reload S2, S3 and S4, then the Matematik counts on S2/S3, the S4 total and "Tingkatan 5" all increase by 1; given an admin deactivates Sains T5 question 564159 (M04), the Sains counts decrease by 1; the hub values (live constants) do not change.

**US-M06-03 — Menus and titles**
- **AC-M06-03.1** Given a user-portal M06 screen at ≥1024px, when it loads, then the sidebar shows section "SPM" and item "SPM" with the amber "SPM" pill (active), and "SPM Mock Exam" (`fa-file-pen`) under "💎 Killer Features" → `/spm-mock`.
- **AC-M06-03.2** Given a width below 1024px, when the page loads, then the bottom nav shows "SPM" (`fa-graduation-cap`) → `/spm`, and the drawer lists "SPM".
- **AC-M06-03.3** Given each M06 screen, when it loads, then the header follows DV-SH-03: S1, S2, S3, S5, S8 and S10 keep their live title with "Selamat datang kembali"; S4 "Latih Tubi SPM — Matematik" (MATH), S6 "Tracking A SPM — Geografi" (GEO), S7 "Tracking A Bahasa" and S9 "Subjektif SPM" show the title with no subtitle; the admin sees S11, S12 (mock 16) and S13 in the admin shell with "SPM Mock Exam", "Result Mock SPM — Bahasa Melayu" and "SPM Walkthrough — Cikgu Alesa" and no subtitle; the student sees them in the user portal with the same titles and no subtitle (INFERRED); no M06 screen shows "Dashboard" (DV-M06-07).
- **AC-M06-03.4** Given the admin on an admin-panel page at ≥1024px, when the group "SPM" is expanded, then it lists "Databank Soalan", "Latih Tubi", "Tracking A", "Subjektif" linking to S2, S3, S5, S8; "SPM Walkthrough" (Pusat AI) and "SPM Mock Exam" (Killer Features) link to S13 and S11; below 1024px the "Lagi" sheet has section "SPM" with the same four links.

**US-M06-04 — Access and errors**
- **AC-M06-04.1** Given I am not logged in, when I open any M06 route, then I am sent to `/login`.
- **AC-M06-04.2** Given I open `/spm/latih-tubi/XYZ`, `/spm/ramalan/XYZ` or `/spm-mock/99999/result`, when it loads, then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/` and "Mula Latihan" → `/practice` (M01 DV-02), tab "404 - Halaman Tidak Dijumpai | PRESTASIPLUS".
- **AC-M06-04.3** Given any M06 screen, when it loads for the student, then no premium lock, "PRO" badge or package prompt appears.

**US-M06-05 — Databank list**
- **AC-M06-05.1** Given I open `/spm/tahun-lepas`, when it loads, then I see "Kembali ke Mod SPM" (→ `/spm`), h1 "Databank Soalan SPM", sub "Pilih subjek dan mula jawab dari bank soalan", and 18 cards in the order Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Biologi, Ekonomi, Fizik, Geografi, Kimia, Matematik Tambahan, Pendidikan Islam, Pendidikan Moral, Pendidikan Seni Visual, Pendidikan Syariah Islamiah, Perniagaan, Prinsip Perakaunan, Tasawwur Islam.
- **AC-M06-05.2** Given a card, when it renders, then it shows the icon tile, name, English name (e.g. "Malay Language"), "{n} soalan dalam databank" (Bahasa Melayu "514"), "Pilih set:", links "5", "10", "20" → `/spm/tahun-lepas/BM/quiz?count=5|10|20`, and a plain amber "Mula" that is not a link; there is no year selector.
- **AC-M06-05.3** Given `/spm/tahun-lepas?subject=MATH`, when it loads, then the page is identical to `/spm/tahun-lepas`.

**US-M06-06 — Databank quiz (L-1, L-2; pending user approval)**
- **AC-M06-06.1** Given I press "10" on Bahasa Melayu, when the quiz opens, then `<PracticeQuiz>` starts a `past_year` session through M05 §7 #4 with 10 questions from the Bahasa Melayu SPM pool (M04 question ids), and "Lapor Soalan" opens the M04 report modal whose request carries `source: "spm"` and the session id; the reported question is a real M04 row, so it appears in the M04 admin queue with its question block.
- **AC-M06-06.2** Given I answer all questions and finish, when the session completes through M05 §7 #6 (BR-31), then `/spm/history` shows a new first row with badge "Tahun Lepas", "{c}/10 betul", the date/time, duration and "+{c} 🪙"; S1 and S10 stats include it; my wrong answers are in the M05 revision queue and the session is on M05 `/practice/history` with the badge "Latihan".

**US-M06-07 — Latih Tubi list**
- **AC-M06-07.1** Given I open `/spm/latih-tubi`, when it loads, then I see "Kembali ke Mod SPM", h1 "Latih Tubi SPM", sub "Pilih subjek untuk mula berlatih (Tingkatan 4 & 5)", heading "Subjek Teras (7)" with BM, BI, MATH, SCI, SEJ, PI, PM and "Subjek Elektif (12)" with GEO, BIO, CHEM, PHY, PERNIAGA, AKAUN, EKON, ADDMATH, PSV, BA, TI, PSI.
- **AC-M06-07.2** Given a card, when it renders, then it links to `/spm/latih-tubi/{CODE}` and shows name, English name, "{n} soalan" equal to that subject's S2 databank count (Matematik "1,681 soalan", Bahasa Arab "0 soalan"), a chevron, and the target chip where set: BM "Target Custom: 34", BI "Target Custom: 36", MATH/SCI/SEJ/GEO/BIO/CHEM/PHY "Target SPM: 40", PI/PM/EKON/BA/PSI "Target Latihan: 40", ADDMATH "Target Latihan: 20"; PERNIAGA, AKAUN, PSV, TI have none.
- **AC-M06-07.3** Given the seed (as live), when S3 loads, then the Bahasa Arab card is amber with "0 soalan", "Target Latihan: 40", chip `fa-lock` "Locked: 0/40", a lock icon instead of the chevron, and clicking it does nothing; `/spm/latih-tubi/BA` still opens by URL and shows "0 soalan tersedia" with all Tingkatan and difficulty counts 0 (DV-M06-01), so it is not presented as a 1,200-question subject.

**US-M06-08 — Tingkatan and difficulty**
- **AC-M06-08.1** Given I open `/spm/latih-tubi/MATH`, when it loads, then I see "Kembali" (→ `/spm/latih-tubi`), the icon tile with a visible glyph, h1 "Matematik", "1,681 soalan tersedia" · "Target SPM set: 40 soalan" (DV-M06-01; live 2,581), card "Tetapan Kuiz", tab title "Latih Tubi SPM — Matematik".
- **AC-M06-08.2** Given "Tingkatan", when it loads, then it shows "Tingkatan 4" "976 soalan" and "Tingkatan 5" "705 soalan" (seed split of the S3/S2 pool, PROPOSED — DV-M06-01), none selected; clicking "Tingkatan 5" selects it (blue border, blue-50 background, shadow); clicking it again clears it.
- **AC-M06-08.3** Given "Tahap Kesukaran" with no Tingkatan, when it loads, then it shows "Asas" "514 soalan", "Pertengahan" "577 soalan", "Sukar" "85 soalan", "Sangat Sukar" "0 soalan" (seed split of the S3/S2 pool, PROPOSED — DV-M06-01); the buttons map to difficulty keys 2–5 as on live, so the 505 difficulty-1 questions of the seed split are only in the mixed quiz; the helper reads "Biarkan kosong untuk campuran semua tahap"; clicking a button selects it (green/yellow/orange/red), clicking again clears it.
- **AC-M06-08.4** Given I select "Tingkatan 4", when the counts update, then they read 309 / 410 / 58 / 0; with "Tingkatan 5" 205 / 167 / 27 / 0; clearing the Tingkatan restores 514 / 577 / 85 / 0 (seed split of the S3/S2 pool, PROPOSED — DV-M06-01).
- **AC-M06-08.5** Given Sains (`/spm/latih-tubi/SCI`), when it loads, then difficulty counts are unformatted and Tingkatan counts use separators, as live (seed values "1299 soalan" on "Asas" and "1,172" / "904" on Tingkatan — seed split of the S3/S2 pool, PROPOSED — DV-M06-01); on every subject "Sangat Sukar" shows "0 soalan" (no difficulty-5 question exists, as live).

**US-M06-09 — Count and start**
- **AC-M06-09.1** Given MATH, when "Bilangan Soalan" loads, then one option "40 (Target SPM)" is selected and the helper reads "Set penuh target spm untuk Matematik disasar pada 40 soalan."; BM shows "34 (Target Custom)" and "Set penuh target custom untuk Bahasa Melayu disasar pada 34 soalan."; ADDMATH "20 (Target Latihan)" and "Set penuh target latihan untuk Matematik Tambahan disasar pada 20 soalan.".
- **AC-M06-09.2** Given PERNIAGA, when it loads, then "934 soalan tersedia" (the S3/S2 pool, PROPOSED — DV-M06-01; live 2,732) has no target line, the options are "5", "10", "20", "30", "40", "50", "60" with "10" selected, and the helper reads "Pilih bilangan soalan ikut keperluan latihan anda."; clicking "30" selects it.
- **AC-M06-09.3** Given the settings, when I read the "Mula Kuiz" (`fa-play-circle`) link, then it is `/spm/latih-tubi/MATH/quiz?count=40` with nothing selected, `…?count=40&level=10` with Tingkatan 4, `…?count=40&level=11&difficulty=4` with Tingkatan 5 + "Sukar" (as live), and `/spm/latih-tubi/PERNIAGA/quiz?count=30` after choosing 30.

**US-M06-10 — Latih Tubi quiz (L-3, L-4; pending)**
- **AC-M06-10.1** Given `/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4`, when the quiz opens, then a `latih_tubi` session with the matching Matematik Tingkatan 5 questions of difficulty 4 starts in the M05 quiz component, with "Lapor Soalan" (27 questions in the seed (seed split of the S3/S2 pool, PROPOSED — DV-M06-01), per FN-3.3.2).
- **AC-M06-10.2** Given a filter with fewer matching questions than `count`, when the quiz opens, then it has all matching questions; with none (e.g. `difficulty=5`), no session starts and the SRS §8 message (PROPOSED COPY) shows with a way back to S4.
- **AC-M06-10.3** Given I finish, when the session completes through M05 §7 #6 (BR-31) and I open `/spm/history?type=latih_tubi`, then the new row shows badge "Latih Tubi", "{c}/{n} betul" and "+{c} 🪙".
- **AC-M06-10.4** Given the M04 link `/spm/latih-tubi/MATH/quiz?question_id=570024&count=1` (an approved, active Matematik T4 question, M04 §6.11), when it opens, then `<PracticeQuiz>` starts a `latih_tubi` session with `targetQuestionId` 570024 and exactly that question (no 422 although MATH has target 40); given `question_id=136891` (inactive, `getEligible` → null) or `564159` (a Sains question), no session starts and I am back on `/spm/latih-tubi/MATH` (INFERRED, L-3).

**US-M06-11 — Tracking A hub**
- **AC-M06-11.1** Given I open `/spm/ramalan`, when it loads, then I see "Kembali ke Mod SPM", h1 "Tracking A SPM" with pill "TRACKING A", sub "Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!".
- **AC-M06-11.2** Given the lane cards, when they load, then the objective lane shows "TRACKING A OBJEKTIF" (upper case by CSS), "Subjek objektif penuh", "Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set.", "3 subjek", "18 set", "747 soalan"; the bahasa lane shows "TRACKING A BAHASA", "BM dan BI format sebenar", "Lane khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ.", "2 subjek", "1,332 set", "Paper-based tracking".
- **AC-M06-11.3** Given the open subject cards, when they load, then there are three → `/spm/ramalan/GEO|AKAUN|PSI`: Geografi "40 soalan kuiz siap guna", "1 bank besar", "Target SPM: 40", "Bank source: 67", "1 set"; Prinsip Perakaunan "640 soalan kuiz siap guna", "16 set" (no target or set-bersih chip); Pendidikan Syariah Islamiah "40 soalan kuiz siap guna", "1 set bersih", "Target Latihan: 40", "1 set"; each with "Pilih Set".

**US-M06-12 — Admin readiness**
- **AC-M06-12.1** Given the admin opens `/spm/ramalan`, when it loads, then the card "ADMIN READINESS" shows "Status set Tracking A SPM semasa", "Laporan ini bezakan set bersih, set bank besar, dan set yang masih lock supaya bacaan readiness lebih jujur." and chips "Set Bersih: 1 set", "Bank Besar: 1 set", "Locked: 58 set".
- **AC-M06-12.2** Given the tiles, when they load, then there are 15 in the order BM, BI, MATH, SCI, SEJ, PI, PM, ADDMATH, PHY, CHEM, BIO, GEO, BA, EKON, PSI; e.g. Geografi "GEO · Target set: 40 soalan", "0/10 set bersih", Set Bersih 0, Bank Besar 1, Locked 9, Readiness "10%"; Pendidikan Syariah Islamiah "1/6 set bersih", 1/0/5, "17%"; Bahasa Inggeris "0/0 set bersih", 0/0/0, "0%".
- **AC-M06-12.3** Given a tile with locked sets, when it renders, then "SET MASIH LOCK" lists up to 6 chips in set order (Matematik "2026 Set 43 · 34/40" … "2026 Set 48 · 30/40"); tiles with no locked set have no such section; only Geografi shows "Set bank besar boleh dibuka, tetapi bank sumber melebihi target set. Rujuk page subjek untuk beza set bersih vs bank besar.".
- **AC-M06-12.4** Given the student opens `/spm/ramalan`, when it loads, then the readiness card is not rendered (INFERRED; OQ-M06-03).

**US-M06-13 — Bahasa lane**
- **AC-M06-13.1** Given the S5 bahasa section, when it loads, then it shows "TRACKING A BAHASA", "BM dan BI ikut format kertas sebenar", "Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set berstruktur dan komponen sebenar peperiksaan.", "Paper-based tracking", and cards Bahasa Melayu "559 set" and Bahasa Inggeris "773 set" with "Berstruktur / respons sebenar" and "Buka Tracking A Bahasa" → `/latihan-berstruktur?subject_id=1|2&scope=spm&track=bahasa`.
- **AC-M06-13.2** Given I open `/spm/ramalan/BM` or `/spm/ramalan/BI`, when it resolves, then I land on `/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa` (or `subject_id=2`).
- **AC-M06-13.3** Given S7 for BM, when it loads, then I see "Kembali ke Tracking A SPM" (→ `/spm/ramalan`), pill "TRACKING A BAHASA", h1 "Tracking A Bahasa", sub "Set bahasa dibuka ikut format kertas sebenar. BM dan BI tidak dipaksa menjadi 40 MCQ, dan dipaparkan mengikut susunan BM kemudian BI.", the info text and chips "BM dahulu, BI kemudian", "Format kertas sebenar", "Paper-based tracking", "Berstruktur / respons sebenar", "559 set ditemui".
- **AC-M06-13.4** Given the filter, when it loads, then "Subjek" has "Semua Subjek", "Bahasa Melayu" (selected), "Bahasa Inggeris" and "Aras KBAT" has "Semua", "1. Mengingat" … "6. Mencipta"; submitting "Cari" with `kbat_level=6` reloads with "3 set ditemui"; hidden `scope=spm` and `track=bahasa` are kept.
- **AC-M06-13.5** Given a set card, when it renders, then it shows the subject chip, KBAT band (e.g. "LOTS 2"), minutes ("7m"), "Tingkatan 5", "Trial" when flagged, the stem (3-line clamp), "5 bahagian · 7 markah", author · school, "5 soalan · Tingkatan 5" and "Mula" → `/latihan-berstruktur/3700/jawab?scope=spm&track=bahasa`.
- **AC-M06-13.6** Given "Semua Subjek", when the list loads, then it shows "1,332 set ditemui" and BM sets come before BI sets (DV-M06-10).
- **AC-M06-13.7** Given more than 20 sets, when I view the pager at ≥640px, then "Showing 1 to 20 of 559 results", pages 1–10, "...", 27, 28 and chevrons; below 640px "« Previous" (plain on page 1) / "Next »"; links keep `subject_id`, `scope`, `track`, `kbat_level`.
- **AC-M06-13.8** Given I press "Mula", when the M05 `<StructuredAnswer>` opens with `scope=spm&track=bahasa`, then its back link returns to S7 and a submitted answer is stored as a StructuredAttempt with `scope = "spm"`, `track = "bahasa"` (L-6, pending).

**US-M06-14 — Set list**
- **AC-M06-14.1** Given `/spm/ramalan/GEO`, when it loads, then I see "Kembali" (→ `/spm/ramalan`), h1 "Geografi", "Tracking A SPM · Target SPM set: 40 soalan", chips "0 set bersih", "1 set bank besar", "309 soalan kuiz siap guna", "9 set belum cukup", "Target SPM: 40 / set", and heading "Tracking A 2026".
- **AC-M06-14.2** Given the GEO sets, when they render, then Set 1 is a link → `/spm/ramalan/GEO?year=2026&set=1` with badge "Ready Bank Besar", "40 soalan kuiz siap guna", "Format set: 40 / 40", "Bank source: 67. Sistem tetap ambil 40 soalan ikut prioriti semasa.", "DSKP: 67/67 (100%)"; Sets 2–10 are amber, not clickable, badge "Belum Cukup", e.g. "31 soalan kuiz siap guna", "Format set: 31 / 40", "Belum cukup soalan untuk format KPM.", "DSKP: 31/31 (100%)".
- **AC-M06-14.3** Given `/spm/ramalan/AKAUN`, when it loads, then the sub is "Tracking A SPM" only, chips "16 set bersih", "0 set bank besar", "640 soalan kuiz siap guna" (no belum-cukup or target chip) and 16 "Set Bersih" cards "40 soalan kuiz siap guna", "DSKP: 40/40 (100%)" with no "Format set" line.
- **AC-M06-14.4** Given `/spm/ramalan/PSI`, when it loads, then Set 4 ("Set Bersih", "Format set: 40 / 40") is listed first, followed by locked Sets 3, 5, 6, 7, 8.
- **AC-M06-14.5** Given `/spm/ramalan/BA`, when it loads, then chips "0 set bersih", "0 set bank besar", "0 soalan kuiz siap guna", "Target Latihan: 40 / set" and the empty block "Belum Ada Set Tracking A" / "Set Tracking A untuk subjek ini akan ditambah tidak lama lagi." show.
- **AC-M06-14.6** Given `/spm/ramalan/MATH` (not linked from S5), when it loads, then 11 locked sets 43–53 show and "11 set belum cukup".

**US-M06-15 — Tracking A set quiz (L-5; pending)**
- **AC-M06-15.1** Given I open AKAUN Set 3, when the quiz starts, then `<PracticeQuiz>` starts a `ramalan` session (year 2026, set 3) with the 40 questions of that set (M04 SPM-pool ids); for GEO Set 1 (bank besar) 40 of its 67 bank questions are used.
- **AC-M06-15.2** Given I open `/spm/ramalan/GEO?year=2026&set=2` (Belum Cukup) by URL, when it resolves, then no session starts and I am on `/spm/ramalan/GEO`.
- **AC-M06-15.3** Given I finish a set, when the session completes through M05 §7 #6 (BR-31) and I open `/spm/history?type=ramalan`, then a row with badge "Tracking A" shows.

**US-M06-16 — Subjektif hub**
- **AC-M06-16.1** Given I open `/spm/subjektif`, when it loads, then I see "Kembali ke Mod SPM", h1 "Latihan Subjektif SPM", the sub, and the info box "Bagaimana ia berfungsi? Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan model jawapan. Bank ini ditarik daripada soalan berstruktur Tingkatan 4 dan 5 yang telah diterbitkan.".
- **AC-M06-16.2** Given the new student, when the stats load, then "SET DIJAWAB" 0, "SUBJEK DICUBA" 0, "SKOR TERBAIK" "Belum Ada", "SET TERBAIK DISIMPAN" 0 with their captions (labels upper case by CSS); for the student with seeded attempts the values follow BR-M06-18.
- **AC-M06-16.3** Given the tabs, when the page loads, then "Semua 15" is active with a dark background and readable white text (DV-M06-09) and 15 cards show; "Teras 5" (teal when active) shows BI, BM, MATH, SCI, SEJ; "Elektif 10" (amber when active) shows the 10 elective cards.
- **AC-M06-16.4** Given a card, when it renders, then it shows the icon, name, badge "Teras"/"Elektif", English name, "{n} set subjektif" (Bahasa Inggeris 773) and links to `/latihan-berstruktur?subject_id={id}&scope=spm` (Bahasa Inggeris id 2, Sains Komputer 17).

**US-M06-17 — Subjektif list**
- **AC-M06-17.1** Given `/latihan-berstruktur?subject_id=3&scope=spm`, when it loads, then I see "Kembali ke Subjektif SPM" (→ `/spm/subjektif`), h1 "Subjektif SPM", sub "Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa", the filter with the 15 subjects in S8 option order and KBAT 1–6.
- **AC-M06-17.2** Given the list, when it renders, then cards follow AC-M06-13.5 with "Mula" → `/latihan-berstruktur/{id}/jawab?scope=spm`, and the pager reads "Showing 1 to 20 of 298 results" with pages 1–10 … 14 15.
- **AC-M06-17.3** Given `kbat_level=6` on Matematik, when the list reloads, then "Tiada soalan berstruktur buat masa ini" / "Soalan akan ditambah oleh guru dan admin" show and no pager.
- **AC-M06-17.4** Given I submit a set on the M05 `<StructuredAnswer>` with `scope=spm` (L-7, pending), when I return to `/spm/subjektif`, then "SET DIJAWAB" and "SUBJEK DICUBA" increase and "SKOR TERBAIK" shows my best % (from StructuredAttempts with `scope = "spm"`).

**US-M06-18 — History**
- **AC-M06-18.1** Given the admin opens `/spm/history`, when it loads, then I see "Kembali ke Mod SPM", h1 "Sejarah Kuiz SPM", stats "4" "Sesi Kuiz", "21.8%" "Purata Ketepatan", "26" "Jumlah Syiling", "84" "Soalan Dijawab", and filters "Semua" (active), "Tahun Lepas", "Latih Tubi", "Tracking A".
- **AC-M06-18.2** Given the rows, when they render, then they are newest first: "0%" "Tahun Lepas" "0/5 betul" "19 May 2026, 03:49 AM · 0m 14s" "+0 🪙"; "20%" "1/5 betul" "19 May 2026, 03:26 AM · 0m 36s" "+1 🪙"; "32%" "Latih Tubi" "11/34 betul" "11 May 2026, 02:27 PM · 1m 45s" "+11 🪙"; "35%" "14/40 betul" "11 May 2026, 02:22 PM · 2m 11s" "+14 🪙"; score tiles red.
- **AC-M06-18.3** Given I click "Tahun Lepas", when `?type=past_year` loads, then only the two Tahun Lepas rows show, the filter is `bg-amber-500 text-white shadow-md`, and the four stats are unchanged.
- **AC-M06-18.4** Given `?type=ramalan` for the admin, when it loads, then "Belum Ada Sejarah" / "Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini." and `fa-play-circle` "Mula Kuiz SPM" → `/spm` show.
- **AC-M06-18.5** Given the student's history (P1 Tahun Lepas 40%, P2 Latih Tubi 76%, P3 Tahun Lepas 60%, P4 Tracking A 85%), when it renders, then the P4 row has a "Tracking A" badge and the score tiles are red (<50), yellow (50–79) and green (≥80) (INFERRED, L-12).
- **AC-M06-18.6** Given `?type=latih_tubi` or `?type=ramalan`, when it loads, then the active filter is `bg-blue-500` ("Latih Tubi") or `bg-purple-500` ("Tracking A") with white text; given `?type=zzz`, all rows are listed and no filter (not even "Semua") is active.

**US-M06-19 — Mock form and list**
- **AC-M06-19.1** Given I open `/spm-mock`, when it loads, then I see the hero "📝 SPM Mock Exam" / "Mock SPM penuh dengan timer + auto-grade + weakness analysis. Boleh attempt setiap bulan.", the block "MAESTRO SPM UNTUK ANDA" (upper case by CSS) / "Cikgu pakar yg dah bantu pelajar score A+ — tonton video mereka sebelum mula mock." with one Duta card, and the warning "⚠️ **Persediaan sebelum mula:** Pastikan masa anda cukup. Setelah klik "Mula", timer akan jalan dan tak boleh stop. Kalau pause, score akan jejas.".
- **AC-M06-19.2** Given the form, when it loads, then "SUBJEK" has "Pilih subjek", Bahasa Melayu, English, Matematik, Matematik Tambahan, Fizik, Kimia, Biologi, Sains, Sejarah, Pendidikan Islam; "PAPER" has "Paper 1 (Objektif)" (selected) and "Paper 2 (Esei/Struktur)"; the button reads "🎯 Jana Mock SPM".
- **AC-M06-19.3** Given no subject, when I press "🎯 Jana Mock SPM", then the browser's required-field bubble stops the submit and no mock is created.
- **AC-M06-19.4** Given the admin's "📚 Mock Sebelum Ini", when it renders, then row 1 reads "Sejarah · Paper 1", "{n} bulan yang lepas · " + red "Belum submit", chip "Belum", link "Sambung →" → `/spm-mock/317`; row 2 "Bahasa Melayu · Paper 1", "{n} bulan yang lepas · Score: 0/30 (0.00%)", chip "G" (red), "Lihat →" → `/spm-mock/16/result`.
- **AC-M06-19.5** Given the student's mocks with grades A+, A, B+, B, C, D, E, G, when the list renders, then A+ and A chips are emerald, B+ and B blue, C amber, D, E and G red (DV-M06-06).

**US-M06-20 — Mock exam (L-8, L-10; pending)**
- **AC-M06-20.1** Given I choose "Matematik" and "Paper 1 (Objektif)", when I press "🎯 Jana Mock SPM", then a mock is created, `/spm-mock/{id}` opens with the title "Matematik · Paper 1", and the mock appears on S11 as "Belum submit" with "Sambung →". The in-exam layout, item count, timer and button are the provisional placeholder of FN-6.2.3/6.2.4 (UNVERIFIED, L-8).
- **AC-M06-20.2** (provisional, pending L-8) Given I leave the exam and return via "Sambung →", when the page loads, then the same mock opens again with its items; the timer placeholder is shown; no timer direction, time limit or auto-submit is asserted.
- **AC-M06-20.3** Given I submit, when grading finishes, then `/spm-mock/{id}/result` opens and the S11 row shows "Score: {a}/{b} ({p}%)", the grade chip and "Lihat →".
- **AC-M06-20.4** (provisional, pending L-8) Given Paper 2, when the mock opens, then each item has an answer input, and after submit each item gets marks and feedback from the simulated marker (D4; feedback PROPOSED COPY).

**US-M06-21 — Mock result**
- **AC-M06-21.1** Given `/spm-mock/16/result` as the admin, when it loads, then the red hero shows "Bahasa Melayu · Paper 1", "G", "0.00%", "0 / 30 markah"; tab title "Result Mock SPM — Bahasa Melayu".
- **AC-M06-21.2** Given the Duta block, when it renders, then it reads "🎓 CIKGU PAKAR BAHASA MELAYU" (upper case by CSS) / "Lemah dlm topik tertentu? Cikgu pakar ni boleh bantu anda naik ke A+ next round." with the Bahasa Melayu maestro card.
- **AC-M06-21.3** Given "📉 Topik Lemah — Fokus Belajar Ke Sini", when it renders, then rows are sorted by count ("Sastra" first), each "{n} soalan tersilap", the counts sum to the 30 wrong items, and the tip reads "💡 Cikgu Alesa cadang anda fokus belajar topik atas dulu. Boleh start dengan jana nota ringkas untuk topik tersebut." with "jana nota ringkas" → `/pusat-nota-ringkas` (DV-M06-05).
- **AC-M06-21.4** Given "📋 Review Setiap Soalan", when it renders, then it lists all 30 items; item 1 shows the header "✗ Soalan 1 · 0/1 markah" (upper case by CSS, displayed "✗ SOALAN 1 · 0/1 MARKAH"), "Apakah maksud perkataan 'inovatif' dalam konteks sains dan teknologi?", "Anda: (tiada jawapan)", "Jawapan: A", italic "Jawapan betul: A".
- **AC-M06-21.5** Given the actions, when I press "📝 Mock Lain" or "📚 Belajar Topik Lemah", then `/spm-mock` or `/pusat-nota-ringkas` opens.
- **AC-M06-21.6** Given the student's A+ mock, when its result loads, then the hero is green with "A+"; a C mock shows the yellow hero; correct items show "✓" on a green item (INFERRED, L-9).

**US-M06-22 — Walkthrough (L-11 SOURCE-DERIVED; pending)**
- **AC-M06-22.1** Given I open `/pusat-ai/spm`, when it loads, then I see "📝 SPM Walkthrough", "Snap soalan SPM, AI walk-through step-by-step dengan mark scheme + sebutan buku teks. Faham bukan hafal.", "Subjek" (required; 16 options starting "Pilih"), "Tahun (opsyen)" ("Cth: 2023", max 8 characters), "Soalan (taip atau snap)" (labels upper case by CSS; placeholder "Salin soalan SPM di sini, atau upload gambar di bawah..."), the upload label "📷 Klik atau drag gambar soalan SPM (auto-extract via AI Vision)", button "Bagi Walkthrough", and the block "CIKGU MAESTRO SPM" / "Setelah baca walkthrough, tonton video penjelasan dari Duta SPM." with a Duta card; the result card is hidden.
- **AC-M06-22.2** Given I choose an image file, when it is picked, then the label reads "📎 {filename}".
- **AC-M06-22.3** Given subject "Matematik" and a question, when I press "Bagi Walkthrough", then the button is disabled and reads "AI sedang fikir... (mungkin 15-30s)" and any previous result card is hidden; when the canned answer arrives the card with h2 "✨ Walkthrough Cikgu Alesa" shows the text in a `<pre>` (line breaks kept), the page scrolls to it and the button is "Bagi Walkthrough" again.
- **AC-M06-22.4** Given the mock returns `{ok:false, error}`, when it arrives, then `alert(error)` shows ("Ralat" when no error text); given a network failure, `alert("Ralat: " + message)`; the button is restored in both cases.
- **AC-M06-22.5** Given "Subjek" is "Pilih", when I press "Bagi Walkthrough", then the browser's required-field bubble stops the submit: no busy state, no request, no alert; typing more than 8 characters in "Tahun (opsyen)" is not possible.

**US-M06-23 — Duta card**
- **AC-M06-23.1** Given S11, S12 or S13, when it loads, then exactly one Duta card shows: initials, name, tagline, "🥇 Duta Bintang", "📚 {subjek}", "📍 {negeri}", "⭐ {rating}", linking to `/bilik-duta/{slug}`.
- **AC-M06-23.2** Given repeated loads with different random seeds (test hook), when S11 reloads, then the card may change between the bintang-tier ambassadors; on S12 for a Bahasa Melayu mock the Bahasa Melayu ambassador is shown when one exists.

**US-M06-24 — Responsive**
- **AC-M06-24.1** Given each M06 screen at 375, 768 and 1280px, when it loads, then there is no horizontal page scroll and the layout follows SRS §10.
- **AC-M06-24.2** Given S11 at 375px, when it loads, then "SUBJEK" and "PAPER" stack full width so "Paper 1 (Objektif)" is fully readable, and in "Mock Sebelum Ini" the "Belum" chip has its small size (0.85rem) and neither it nor the grade chip runs into "Sambung →"/"Lihat →" (DV-M06-08); S13 at 375px stacks "SUBJEK" and "TAHUN (OPSYEN)" so the placeholder "Cth: 2023" is fully visible and the label is on one line.
- **AC-M06-24.3** Given S4 at 375px, when it loads, then the four difficulty buttons are in 2 columns and "Pertengahan" stays inside its button (DV-M06-08).
- **AC-M06-24.4** Given S7/S9 below 640px, when the pager renders, then only "« Previous" / "Next »" show; from 640px the numbered pager shows.
- **AC-M06-24.5** Given any M06 screen at any width, when content text renders (chips, badges, meta lines, captions, pager text), then no text is smaller than 12px (DV-M06-17).

## 5. UI expectations

Behaviour and look match the live site (design tokens `00-global-ui.md` §6); the visual reference is `docs/discovery/img/M06/`.

| Screen | Key content and states | Screenshots |
|---|---|---|
| S1 hub | Pill, h1, 4 stats, 4 module cards, "Prestasi SPM Anda", history link. | `spm-hub-desktop/tablet/mobile.png` |
| S2 databank | 18 cards with 5/10/20 chips and amber "Mula" text. | `databank-desktop/mobile.png` |
| S3 latih tubi | Teras/Elektif sections, target chips, locked card (BA, as live). | `latih-tubi-desktop/mobile.png` (blank icons = DV-M06-03) |
| S4 settings | Level, difficulty (keys 2–5, as live), count (target / free), start button; header icon tile (DV-M06-03); counts from the S3 pool (DV-M06-01). | `latih-tubi-subject-math/t5-sukar/free-count/mobile.png` |
| S5 Tracking A | Lanes, admin readiness tiles, bahasa section, open cards. | `tracking-a-desktop/mobile.png` |
| S6 set list | Chips, set cards (bersih, bank besar, belum cukup), empty. | `tracking-a-subject-geo/akaun/empty-ba/mobile.png` |
| S7 / S9 structured lists | Header, info chips (S7), filter, cards, pager, empty (S9). | `tracking-bahasa-*.png`, `subjektif-list-*.png` |
| S8 subjektif | Info box, 4 stats, tabs (DV-M06-09), 15 cards. | `subjektif-desktop/tab-core/mobile.png` |
| S10 history | Stats, filters, rows, empty. | `history-desktop/empty/mobile.png` |
| S11 mock | Hero, Duta block, warning, form, previous mocks (DV-M06-07/08). | `mock-desktop/mobile.png` |
| S12 result | Hero by grade, Duta block, weak topics, review, actions. | `mock-result-desktop/mobile.png` |
| S13 walkthrough | Form, busy button, result card, Duta block. | `walkthrough-desktop/mobile.png` |
| Quiz pages, mock exam page | M05 quiz component; in-exam page (INFERRED). | — (L-states) |

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M06/` (generated 2026-09-25). Generated by script (`gen.js` + `fns.js` in the author's scratchpad; reproducible from the Function catalogue and the inventory JSON). Every M06 content element (S1–S13) is listed with the Function that covers it or with a concrete exclusion reason; each element maps to exactly one Function. Shell elements are chrome owned by the global shell / M23 and the module each link targets; only M06-relevant ones are mapped individually, the rest are listed by ID range with their owner. "Content" quotes the DOM text as captured (`<person>`, `<in>`, `<school>` = discovery privacy mask).

**Summary**

| Set | Elements | Mapped to an M06 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M06 content (S1–S13) | 1315 | 1285 | 30 (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" — hidden user-layout widget, EL-M06-S1…S10-001–003) | 0 |
| User-portal shell SHU | 378 | 17 | 361 (global shell / M23 and linked modules) | 0 |
| Admin shell SHA | 196 | 15 | 181 (global shell / M23 and linked modules) | 0 |

**1315/1315 M06 content elements covered (1285 mapped, 30 excluded with reason), 0 unmapped.** Including the shells: 1889/1889 elements accounted for (1317 mapped, 572 excluded with reason). 92 of the 118 Functions in §3 appear in this matrix; the other 26 are behaviour-only Functions (sessions, server rules, access) with no element by nature.

### 6.1 M06 content elements

#### S1 — `/spm` (43 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S1-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S1-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S1-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S1-004 | badge | visible-default | "MOD SPM", fa-graduation-cap | FN-M06-1.1.1 |
| EL-M06-S1-005 | heading | visible-default | "Persediaan SPM" | FN-M06-1.1.1 |
| EL-M06-S1-006 | text | visible-default | "Latihan lengkap untuk pelajar Tingkatan 4 & 5. Soalan tahun lepas, lat…" | FN-M06-1.1.1 |
| EL-M06-S1-007 | card | visible-default | "Jumlah Soalan" | FN-M06-1.1.2 |
| EL-M06-S1-008 | text | visible-default | "20,529" | FN-M06-1.1.2 |
| EL-M06-S1-009 | text | visible-default | "Jumlah Soalan" | FN-M06-1.1.2 |
| EL-M06-S1-010 | card | visible-default | "Subjek SPM" | FN-M06-1.1.2 |
| EL-M06-S1-011 | text | visible-default | "25" | FN-M06-1.1.2 |
| EL-M06-S1-012 | text | visible-default | "Subjek SPM" | FN-M06-1.1.2 |
| EL-M06-S1-013 | card | visible-default | "Tahun Tersedia" | FN-M06-1.1.2 |
| EL-M06-S1-014 | text | visible-default | "0" | FN-M06-1.1.2 |
| EL-M06-S1-015 | text | visible-default | "Tahun Tersedia" | FN-M06-1.1.2 |
| EL-M06-S1-016 | card | visible-default | "Soalan Tracking A" | FN-M06-1.1.2 |
| EL-M06-S1-017 | text | visible-default | "1,797" | FN-M06-1.1.2 |
| EL-M06-S1-018 | text | visible-default | "Soalan Tracking A" | FN-M06-1.1.2 |
| EL-M06-S1-019 | link | visible-default | "Databank Soalan Bank soalan SPM mengikut subjek, dipaparkan secara raw…", → /spm/tahun-lepas, fa-database | FN-M06-1.1.3 |
| EL-M06-S1-020 | card | visible-default | "Databank Soalan" | FN-M06-1.1.3 |
| EL-M06-S1-021 | heading | visible-default | "Databank Soalan" | FN-M06-1.1.3 |
| EL-M06-S1-022 | alert | visible-default | "14,673 soalan", fa-file-alt | FN-M06-1.1.3 |
| EL-M06-S1-023 | link | visible-default | "Latih Tubi SPM Latihan ikut topik dan bab untuk Tingkatan 4 & 5. 14,67…", → /spm/latih-tubi, fa-brain | FN-M06-1.1.4 |
| EL-M06-S1-024 | card | visible-default | "Latih Tubi SPM" | FN-M06-1.1.4 |
| EL-M06-S1-025 | heading | visible-default | "Latih Tubi SPM" | FN-M06-1.1.4 |
| EL-M06-S1-026 | alert | visible-default | "14,673 soalan", fa-dumbbell | FN-M06-1.1.4 |
| EL-M06-S1-027 | link | visible-default | "Tracking A Set objektif penuh dan lane bahasa khas untuk latihan inten…", → /spm/ramalan, fa-crystal-ball | FN-M06-1.1.5 |
| EL-M06-S1-028 | card | visible-default | "Tracking A" | FN-M06-1.1.5 |
| EL-M06-S1-029 | heading | visible-default | "Tracking A" | FN-M06-1.1.5 |
| EL-M06-S1-030 | link | visible-default | "Subjektif Latihan soalan esei & jawapan panjang, disemak oleh guru. 4,…", → /spm/subjektif, fa-pen-fancy | FN-M06-1.1.6 |
| EL-M06-S1-031 | card | visible-default | "Subjektif" | FN-M06-1.1.6 |
| EL-M06-S1-032 | heading | visible-default | "Subjektif" | FN-M06-1.1.6 |
| EL-M06-S1-033 | card | visible-default | "Prestasi SPM Anda" | FN-M06-1.1.7 |
| EL-M06-S1-034 | heading | visible-default | "Prestasi SPM Anda" | FN-M06-1.1.7 |
| EL-M06-S1-035 | text | visible-default | "4" | FN-M06-1.1.7 |
| EL-M06-S1-036 | text | visible-default | "Sesi Kuiz" | FN-M06-1.1.7 |
| EL-M06-S1-037 | text | visible-default | "21.8%" | FN-M06-1.1.7 |
| EL-M06-S1-038 | text | visible-default | "Purata Ketepatan" | FN-M06-1.1.7 |
| EL-M06-S1-039 | text | visible-default | "26" | FN-M06-1.1.7 |
| EL-M06-S1-040 | text | visible-default | "Syiling Diperoleh" | FN-M06-1.1.7 |
| EL-M06-S1-041 | text | visible-default | "84" | FN-M06-1.1.7 |
| EL-M06-S1-042 | text | visible-default | "Soalan Dijawab" | FN-M06-1.1.7 |
| EL-M06-S1-043 | link | visible-default | "Sejarah Kuiz SPM", → /spm/history, fa-history | FN-M06-1.1.8 |

#### S2 — `/spm/tahun-lepas` (168 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S2-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S2-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S2-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S2-004 | link | visible-default | "Kembali ke Mod SPM", → /spm, fa-arrow-left | FN-M06-2.1.1 |
| EL-M06-S2-005 | heading | visible-default | "Databank Soalan SPM" | FN-M06-2.1.1 |
| EL-M06-S2-006 | text | visible-default | "Pilih subjek dan mula jawab dari bank soalan" | FN-M06-2.1.1 |
| EL-M06-S2-007 | card | visible-default | "Bahasa Melayu" | FN-M06-2.1.2 |
| EL-M06-S2-008 | heading | visible-default | "Bahasa Melayu" | FN-M06-2.1.2 |
| EL-M06-S2-009 | text | visible-default | "Malay Language" | FN-M06-2.1.2 |
| EL-M06-S2-010 | text | visible-default | "514 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-011 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-012 | link | visible-default | "5", → /spm/tahun-lepas/BM/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-013 | link | visible-default | "10", → /spm/tahun-lepas/BM/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-014 | link | visible-default | "20", → /spm/tahun-lepas/BM/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-015 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-016 | card | visible-default | "Bahasa Inggeris" | FN-M06-2.1.2 |
| EL-M06-S2-017 | heading | visible-default | "Bahasa Inggeris" | FN-M06-2.1.2 |
| EL-M06-S2-018 | text | visible-default | "English Language" | FN-M06-2.1.2 |
| EL-M06-S2-019 | text | visible-default | "1,114 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-020 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-021 | link | visible-default | "5", → /spm/tahun-lepas/BI/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-022 | link | visible-default | "10", → /spm/tahun-lepas/BI/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-023 | link | visible-default | "20", → /spm/tahun-lepas/BI/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-024 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-025 | card | visible-default | "Matematik" | FN-M06-2.1.2 |
| EL-M06-S2-026 | heading | visible-default | "Matematik" | FN-M06-2.1.2 |
| EL-M06-S2-027 | text | visible-default | "Mathematics" | FN-M06-2.1.2 |
| EL-M06-S2-028 | text | visible-default | "1,681 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-029 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-030 | link | visible-default | "5", → /spm/tahun-lepas/MATH/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-031 | link | visible-default | "10", → /spm/tahun-lepas/MATH/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-032 | link | visible-default | "20", → /spm/tahun-lepas/MATH/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-033 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-034 | card | visible-default | "Sains" | FN-M06-2.1.2 |
| EL-M06-S2-035 | heading | visible-default | "Sains" | FN-M06-2.1.2 |
| EL-M06-S2-036 | text | visible-default | "Science" | FN-M06-2.1.2 |
| EL-M06-S2-037 | text | visible-default | "2,076 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-038 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-039 | link | visible-default | "5", → /spm/tahun-lepas/SCI/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-040 | link | visible-default | "10", → /spm/tahun-lepas/SCI/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-041 | link | visible-default | "20", → /spm/tahun-lepas/SCI/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-042 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-043 | card | visible-default | "Sejarah" | FN-M06-2.1.2 |
| EL-M06-S2-044 | heading | visible-default | "Sejarah" | FN-M06-2.1.2 |
| EL-M06-S2-045 | text | visible-default | "History" | FN-M06-2.1.2 |
| EL-M06-S2-046 | text | visible-default | "1,539 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-047 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-048 | link | visible-default | "5", → /spm/tahun-lepas/SEJ/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-049 | link | visible-default | "10", → /spm/tahun-lepas/SEJ/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-050 | link | visible-default | "20", → /spm/tahun-lepas/SEJ/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-051 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-052 | card | visible-default | "Biologi" | FN-M06-2.1.2 |
| EL-M06-S2-053 | heading | visible-default | "Biologi" | FN-M06-2.1.2 |
| EL-M06-S2-054 | text | visible-default | "Biology" | FN-M06-2.1.2 |
| EL-M06-S2-055 | text | visible-default | "1,999 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-056 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-057 | link | visible-default | "5", → /spm/tahun-lepas/BIO/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-058 | link | visible-default | "10", → /spm/tahun-lepas/BIO/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-059 | link | visible-default | "20", → /spm/tahun-lepas/BIO/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-060 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-061 | card | visible-default | "Ekonomi" | FN-M06-2.1.2 |
| EL-M06-S2-062 | heading | visible-default | "Ekonomi" | FN-M06-2.1.2 |
| EL-M06-S2-063 | text | visible-default | "Economics" | FN-M06-2.1.2 |
| EL-M06-S2-064 | text | visible-default | "1,986 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-065 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-066 | link | visible-default | "5", → /spm/tahun-lepas/EKON/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-067 | link | visible-default | "10", → /spm/tahun-lepas/EKON/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-068 | link | visible-default | "20", → /spm/tahun-lepas/EKON/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-069 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-070 | card | visible-default | "Fizik" | FN-M06-2.1.2 |
| EL-M06-S2-071 | heading | visible-default | "Fizik" | FN-M06-2.1.2 |
| EL-M06-S2-072 | text | visible-default | "Physics" | FN-M06-2.1.2 |
| EL-M06-S2-073 | text | visible-default | "1,261 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-074 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-075 | link | visible-default | "5", → /spm/tahun-lepas/PHY/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-076 | link | visible-default | "10", → /spm/tahun-lepas/PHY/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-077 | link | visible-default | "20", → /spm/tahun-lepas/PHY/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-078 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-079 | card | visible-default | "Geografi" | FN-M06-2.1.2 |
| EL-M06-S2-080 | heading | visible-default | "Geografi" | FN-M06-2.1.2 |
| EL-M06-S2-081 | text | visible-default | "Geography" | FN-M06-2.1.2 |
| EL-M06-S2-082 | text | visible-default | "1,228 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-083 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-084 | link | visible-default | "5", → /spm/tahun-lepas/GEO/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-085 | link | visible-default | "10", → /spm/tahun-lepas/GEO/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-086 | link | visible-default | "20", → /spm/tahun-lepas/GEO/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-087 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-088 | card | visible-default | "Kimia" | FN-M06-2.1.2 |
| EL-M06-S2-089 | heading | visible-default | "Kimia" | FN-M06-2.1.2 |
| EL-M06-S2-090 | text | visible-default | "Chemistry" | FN-M06-2.1.2 |
| EL-M06-S2-091 | text | visible-default | "1,009 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-092 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-093 | link | visible-default | "5", → /spm/tahun-lepas/CHEM/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-094 | link | visible-default | "10", → /spm/tahun-lepas/CHEM/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-095 | link | visible-default | "20", → /spm/tahun-lepas/CHEM/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-096 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-097 | card | visible-default | "Matematik Tambahan" | FN-M06-2.1.2 |
| EL-M06-S2-098 | heading | visible-default | "Matematik Tambahan" | FN-M06-2.1.2 |
| EL-M06-S2-099 | text | visible-default | "Additional Mathematics" | FN-M06-2.1.2 |
| EL-M06-S2-100 | text | visible-default | "501 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-101 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-102 | link | visible-default | "5", → /spm/tahun-lepas/ADDMATH/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-103 | link | visible-default | "10", → /spm/tahun-lepas/ADDMATH/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-104 | link | visible-default | "20", → /spm/tahun-lepas/ADDMATH/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-105 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-106 | card | visible-default | "Pendidikan Islam" | FN-M06-2.1.2 |
| EL-M06-S2-107 | heading | visible-default | "Pendidikan Islam" | FN-M06-2.1.2 |
| EL-M06-S2-108 | text | visible-default | "Islamic Education" | FN-M06-2.1.2 |
| EL-M06-S2-109 | text | visible-default | "483 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-110 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-111 | link | visible-default | "5", → /spm/tahun-lepas/PI/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-112 | link | visible-default | "10", → /spm/tahun-lepas/PI/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-113 | link | visible-default | "20", → /spm/tahun-lepas/PI/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-114 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-115 | card | visible-default | "Pendidikan Moral" | FN-M06-2.1.2 |
| EL-M06-S2-116 | heading | visible-default | "Pendidikan Moral" | FN-M06-2.1.2 |
| EL-M06-S2-117 | text | visible-default | "Moral Education" | FN-M06-2.1.2 |
| EL-M06-S2-118 | text | visible-default | "1,353 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-119 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-120 | link | visible-default | "5", → /spm/tahun-lepas/PM/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-121 | link | visible-default | "10", → /spm/tahun-lepas/PM/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-122 | link | visible-default | "20", → /spm/tahun-lepas/PM/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-123 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-124 | card | visible-default | "Pendidikan Seni Visual" | FN-M06-2.1.2 |
| EL-M06-S2-125 | heading | visible-default | "Pendidikan Seni Visual" | FN-M06-2.1.2 |
| EL-M06-S2-126 | text | visible-default | "Visual Arts Education" | FN-M06-2.1.2 |
| EL-M06-S2-127 | text | visible-default | "545 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-128 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-129 | link | visible-default | "5", → /spm/tahun-lepas/PSV/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-130 | link | visible-default | "10", → /spm/tahun-lepas/PSV/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-131 | link | visible-default | "20", → /spm/tahun-lepas/PSV/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-132 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-133 | card | visible-default | "Pendidikan Syariah Islamiah" | FN-M06-2.1.2 |
| EL-M06-S2-134 | heading | visible-default | "Pendidikan Syariah Islamiah" | FN-M06-2.1.2 |
| EL-M06-S2-135 | text | visible-default | "Islamic Syariah Education" | FN-M06-2.1.2 |
| EL-M06-S2-136 | text | visible-default | "510 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-137 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-138 | link | visible-default | "5", → /spm/tahun-lepas/PSI/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-139 | link | visible-default | "10", → /spm/tahun-lepas/PSI/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-140 | link | visible-default | "20", → /spm/tahun-lepas/PSI/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-141 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-142 | card | visible-default | "Perniagaan" | FN-M06-2.1.2 |
| EL-M06-S2-143 | heading | visible-default | "Perniagaan" | FN-M06-2.1.2 |
| EL-M06-S2-144 | text | visible-default | "Business Studies" | FN-M06-2.1.2 |
| EL-M06-S2-145 | text | visible-default | "934 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-146 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-147 | link | visible-default | "5", → /spm/tahun-lepas/PERNIAGA/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-148 | link | visible-default | "10", → /spm/tahun-lepas/PERNIAGA/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-149 | link | visible-default | "20", → /spm/tahun-lepas/PERNIAGA/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-150 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-151 | card | visible-default | "Prinsip Perakaunan" | FN-M06-2.1.2 |
| EL-M06-S2-152 | heading | visible-default | "Prinsip Perakaunan" | FN-M06-2.1.2 |
| EL-M06-S2-153 | text | visible-default | "Principles of Accounting" | FN-M06-2.1.2 |
| EL-M06-S2-154 | text | visible-default | "1,770 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-155 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-156 | link | visible-default | "5", → /spm/tahun-lepas/AKAUN/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-157 | link | visible-default | "10", → /spm/tahun-lepas/AKAUN/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-158 | link | visible-default | "20", → /spm/tahun-lepas/AKAUN/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-159 | text | visible-default | "Mula" | FN-M06-2.1.4 |
| EL-M06-S2-160 | card | visible-default | "Tasawwur Islam" | FN-M06-2.1.2 |
| EL-M06-S2-161 | heading | visible-default | "Tasawwur Islam" | FN-M06-2.1.2 |
| EL-M06-S2-162 | text | visible-default | "Islamic Worldview" | FN-M06-2.1.2 |
| EL-M06-S2-163 | text | visible-default | "530 soalan dalam databank" | FN-M06-2.1.2 |
| EL-M06-S2-164 | text | visible-default | "Pilih set:" | FN-M06-2.1.3 |
| EL-M06-S2-165 | link | visible-default | "5", → /spm/tahun-lepas/TI/quiz?count=5 | FN-M06-2.1.3 |
| EL-M06-S2-166 | link | visible-default | "10", → /spm/tahun-lepas/TI/quiz?count=10 | FN-M06-2.1.3 |
| EL-M06-S2-167 | link | visible-default | "20", → /spm/tahun-lepas/TI/quiz?count=20 | FN-M06-2.1.3 |
| EL-M06-S2-168 | text | visible-default | "Mula" | FN-M06-2.1.4 |

#### S3 — `/spm/latih-tubi` (86 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S3-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S3-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S3-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S3-004 | link | visible-default | "Kembali ke Mod SPM", → /spm, fa-arrow-left | FN-M06-3.1.1 |
| EL-M06-S3-005 | heading | visible-default | "Latih Tubi SPM" | FN-M06-3.1.1 |
| EL-M06-S3-006 | text | visible-default | "Pilih subjek untuk mula berlatih (Tingkatan 4 & 5)" | FN-M06-3.1.1 |
| EL-M06-S3-007 | heading | visible-default | "Subjek Teras (7)" | FN-M06-3.1.2 |
| EL-M06-S3-008 | link | visible-default | "Bahasa Melayu Malay Language 514 soalan Target Custom: 34", → /spm/latih-tubi/BM, fa-book-open | FN-M06-3.1.3 |
| EL-M06-S3-009 | card | visible-default | "Bahasa Melayu" | FN-M06-3.1.3 |
| EL-M06-S3-010 | heading | visible-default | "Bahasa Melayu" | FN-M06-3.1.3 |
| EL-M06-S3-011 | alert | visible-default | "514 soalan", fa-brain | FN-M06-3.1.3 |
| EL-M06-S3-012 | alert | visible-default | "Target Custom: 34", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-013 | link | visible-default | "Bahasa Inggeris English Language 1,114 soalan Target Custom: 36", → /spm/latih-tubi/BI, fa-globe | FN-M06-3.1.3 |
| EL-M06-S3-014 | card | visible-default | "Bahasa Inggeris" | FN-M06-3.1.3 |
| EL-M06-S3-015 | heading | visible-default | "Bahasa Inggeris" | FN-M06-3.1.3 |
| EL-M06-S3-016 | alert | visible-default | "1,114 soalan", fa-brain | FN-M06-3.1.3 |
| EL-M06-S3-017 | alert | visible-default | "Target Custom: 36", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-018 | link | visible-default | "Matematik Mathematics 1,681 soalan Target SPM: 40", → /spm/latih-tubi/MATH, fa-calculator | FN-M06-3.1.3 |
| EL-M06-S3-019 | card | visible-default | "Matematik" | FN-M06-3.1.3 |
| EL-M06-S3-020 | heading | visible-default | "Matematik" | FN-M06-3.1.3 |
| EL-M06-S3-021 | alert | visible-default | "1,681 soalan", fa-brain | FN-M06-3.1.3 |
| EL-M06-S3-022 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-023 | link | visible-default | "Sains Science 2,076 soalan Target SPM: 40", → /spm/latih-tubi/SCI, fa-beaker | FN-M06-3.1.3 |
| EL-M06-S3-024 | card | visible-default | "Sains" | FN-M06-3.1.3 |
| EL-M06-S3-025 | heading | visible-default | "Sains" | FN-M06-3.1.3 |
| EL-M06-S3-026 | alert | visible-default | "2,076 soalan", fa-brain | FN-M06-3.1.3 |
| EL-M06-S3-027 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-028 | link | visible-default | "Sejarah History 1,539 soalan Target SPM: 40", → /spm/latih-tubi/SEJ, fa-clock | FN-M06-3.1.3 |
| EL-M06-S3-029 | card | visible-default | "Sejarah" | FN-M06-3.1.3 |
| EL-M06-S3-030 | heading | visible-default | "Sejarah" | FN-M06-3.1.3 |
| EL-M06-S3-031 | alert | visible-default | "1,539 soalan", fa-brain | FN-M06-3.1.3 |
| EL-M06-S3-032 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-033 | link | visible-default | "Pendidikan Islam Islamic Education 483 soalan Target Latihan: 40", → /spm/latih-tubi/PI, fa-moon | FN-M06-3.1.3 |
| EL-M06-S3-034 | card | visible-default | "Pendidikan Islam" | FN-M06-3.1.3 |
| EL-M06-S3-035 | heading | visible-default | "Pendidikan Islam" | FN-M06-3.1.3 |
| EL-M06-S3-036 | alert | visible-default | "483 soalan", fa-brain | FN-M06-3.1.3 |
| EL-M06-S3-037 | alert | visible-default | "Target Latihan: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-038 | link | visible-default | "Pendidikan Moral Moral Education 1,353 soalan Target Latihan: 40", → /spm/latih-tubi/PM, fa-heart | FN-M06-3.1.3 |
| EL-M06-S3-039 | card | visible-default | "Pendidikan Moral" | FN-M06-3.1.3 |
| EL-M06-S3-040 | heading | visible-default | "Pendidikan Moral" | FN-M06-3.1.3 |
| EL-M06-S3-041 | alert | visible-default | "1,353 soalan", fa-brain | FN-M06-3.1.3 |
| EL-M06-S3-042 | alert | visible-default | "Target Latihan: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-043 | heading | visible-default | "Subjek Elektif (12)" | FN-M06-3.1.2 |
| EL-M06-S3-044 | link | visible-default | "Geografi Geography 1,228 soalan Target SPM: 40", → /spm/latih-tubi/GEO, fa-map | FN-M06-3.1.3 |
| EL-M06-S3-045 | card | visible-default | "Geografi" | FN-M06-3.1.3 |
| EL-M06-S3-046 | heading | visible-default | "Geografi" | FN-M06-3.1.3 |
| EL-M06-S3-047 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-048 | link | visible-default | "Biologi Biology 1,999 soalan Target SPM: 40", → /spm/latih-tubi/BIO, fa-leaf | FN-M06-3.1.3 |
| EL-M06-S3-049 | card | visible-default | "Biologi" | FN-M06-3.1.3 |
| EL-M06-S3-050 | heading | visible-default | "Biologi" | FN-M06-3.1.3 |
| EL-M06-S3-051 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-052 | link | visible-default | "Kimia Chemistry 1,009 soalan Target SPM: 40", → /spm/latih-tubi/CHEM, fa-flask-round | FN-M06-3.1.3 |
| EL-M06-S3-053 | card | visible-default | "Kimia" | FN-M06-3.1.3 |
| EL-M06-S3-054 | heading | visible-default | "Kimia" | FN-M06-3.1.3 |
| EL-M06-S3-055 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-056 | link | visible-default | "Fizik Physics 1,261 soalan Target SPM: 40", → /spm/latih-tubi/PHY, fa-zap | FN-M06-3.1.3 |
| EL-M06-S3-057 | card | visible-default | "Fizik" | FN-M06-3.1.3 |
| EL-M06-S3-058 | heading | visible-default | "Fizik" | FN-M06-3.1.3 |
| EL-M06-S3-059 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-060 | link | visible-default | "Perniagaan Business Studies 934 soalan", → /spm/latih-tubi/PERNIAGA, fa-briefcase | FN-M06-3.1.3 |
| EL-M06-S3-061 | card | visible-default | "Perniagaan" | FN-M06-3.1.3 |
| EL-M06-S3-062 | heading | visible-default | "Perniagaan" | FN-M06-3.1.3 |
| EL-M06-S3-063 | link | visible-default | "Prinsip Perakaunan Principles of Accounting 1,770 soalan", → /spm/latih-tubi/AKAUN, fa-receipt | FN-M06-3.1.3 |
| EL-M06-S3-064 | card | visible-default | "Prinsip Perakaunan" | FN-M06-3.1.3 |
| EL-M06-S3-065 | heading | visible-default | "Prinsip Perakaunan" | FN-M06-3.1.3 |
| EL-M06-S3-066 | link | visible-default | "Ekonomi Economics 1,986 soalan Target Latihan: 40", → /spm/latih-tubi/EKON, fa-trending-up | FN-M06-3.1.3 |
| EL-M06-S3-067 | card | visible-default | "Ekonomi" | FN-M06-3.1.3 |
| EL-M06-S3-068 | heading | visible-default | "Ekonomi" | FN-M06-3.1.3 |
| EL-M06-S3-069 | alert | visible-default | "Target Latihan: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-070 | link | visible-default | "Matematik Tambahan Additional Mathematics 501 soalan Target Latihan: 2…", → /spm/latih-tubi/ADDMATH, fa-variable | FN-M06-3.1.3 |
| EL-M06-S3-071 | card | visible-default | "Matematik Tambahan" | FN-M06-3.1.3 |
| EL-M06-S3-072 | heading | visible-default | "Matematik Tambahan" | FN-M06-3.1.3 |
| EL-M06-S3-073 | alert | visible-default | "Target Latihan: 20", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-074 | link | visible-default | "Pendidikan Seni Visual Visual Arts Education 545 soalan", → /spm/latih-tubi/PSV, fa-palette | FN-M06-3.1.3 |
| EL-M06-S3-075 | card | visible-default | "Pendidikan Seni Visual" | FN-M06-3.1.3 |
| EL-M06-S3-076 | heading | visible-default | "Pendidikan Seni Visual" | FN-M06-3.1.3 |
| EL-M06-S3-077 | link | visible-default | "Bahasa Arab Arabic Language 0 soalan Target Latihan: 40 Locked: 0/40", → javascript:void(0), fa-languages | FN-M06-3.1.5 |
| EL-M06-S3-078 | heading | visible-default | "Bahasa Arab" | FN-M06-3.1.5 |
| EL-M06-S3-079 | alert | visible-default | "Target Latihan: 40", fa-bullseye | FN-M06-3.1.4 |
| EL-M06-S3-080 | link | visible-default | "Tasawwur Islam Islamic Worldview 530 soalan", → /spm/latih-tubi/TI, fa-fas fa-mosque | FN-M06-3.1.3 |
| EL-M06-S3-081 | card | visible-default | "Tasawwur Islam" | FN-M06-3.1.3 |
| EL-M06-S3-082 | heading | visible-default | "Tasawwur Islam" | FN-M06-3.1.3 |
| EL-M06-S3-083 | link | visible-default | "Pendidikan Syariah Islamiah Islamic Syariah Education 510 soalan Targe…", → /spm/latih-tubi/PSI, fa-fas fa-scale-balanced | FN-M06-3.1.3 |
| EL-M06-S3-084 | card | visible-default | "Pendidikan Syariah Islamiah" | FN-M06-3.1.3 |
| EL-M06-S3-085 | heading | visible-default | "Pendidikan Syariah Islamiah" | FN-M06-3.1.3 |
| EL-M06-S3-086 | alert | visible-default | "Target Latihan: 40", fa-bullseye | FN-M06-3.1.4 |

#### S4 — `/spm/latih-tubi/{CODE}` (67 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S4-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S4-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S4-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S4-004 | link | visible-default | "Kembali", → /spm/latih-tubi, fa-arrow-left | FN-M06-3.2.1 |
| EL-M06-S4-005 | heading | visible-default | "Matematik" | FN-M06-3.2.2 |
| EL-M06-S4-006 | text | visible-default | "2,581 soalan tersedia Target SPM set: 40 soalan" | FN-M06-3.2.2 |
| EL-M06-S4-007 | text | visible-default | "·" | FN-M06-3.2.2 |
| EL-M06-S4-008 | card | visible-default | "Tetapan Kuiz" | FN-M06-3.2.3 |
| EL-M06-S4-009 | heading | visible-default | "Tetapan Kuiz" | FN-M06-3.2.3 |
| EL-M06-S4-010 | label | visible-default | "Tingkatan" | FN-M06-3.2.4 |
| EL-M06-S4-011 | button | visible-default | "Tingkatan 4 1,500 soalan" | FN-M06-3.2.4 |
| EL-M06-S4-012 | button | visible-default | "Tingkatan 5 1,081 soalan" | FN-M06-3.2.4 |
| EL-M06-S4-013 | label | visible-default | "Tahap Kesukaran" | FN-M06-3.2.5 |
| EL-M06-S4-014 | button | visible-default | "Asas 790 soalan" | FN-M06-3.2.5 |
| EL-M06-S4-015 | button | visible-default | "Pertengahan 886 soalan" | FN-M06-3.2.5 |
| EL-M06-S4-016 | button | visible-default | "Sukar 130 soalan" | FN-M06-3.2.5 |
| EL-M06-S4-017 | button | visible-default | "Sangat Sukar 0 soalan" | FN-M06-3.2.5 |
| EL-M06-S4-018 | text | visible-default | "Biarkan kosong untuk campuran semua tahap" | FN-M06-3.2.5 |
| EL-M06-S4-019 | label | visible-default | "Bilangan Soalan" | FN-M06-3.2.6 |
| EL-M06-S4-020 | button | hidden-only | button | FN-M06-3.2.6 |
| EL-M06-S4-021 | button | visible-default | "40 (Target SPM)" | FN-M06-3.2.6 |
| EL-M06-S4-022 | text | visible-default | "Set penuh target spm untuk Matematik disasar pada 40 soalan." | FN-M06-3.2.6 |
| EL-M06-S4-023 | link | visible-default | "Mula Kuiz", → /spm/latih-tubi/MATH/quiz?count=40, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-024 | heading | conditional | "Bahasa Melayu" | FN-M06-3.2.2 |
| EL-M06-S4-025 | text | conditional | "644 soalan tersedia Target Custom set: 34 soalan" | FN-M06-3.2.2 |
| EL-M06-S4-026 | button | conditional | "Tingkatan 4 257 soalan" | FN-M06-3.2.4 |
| EL-M06-S4-027 | button | conditional | "Tingkatan 5 387 soalan" | FN-M06-3.2.4 |
| EL-M06-S4-028 | button | conditional | "Sukar 80 soalan" | FN-M06-3.2.5 |
| EL-M06-S4-029 | button | conditional | "34 (Target Custom)" | FN-M06-3.2.6 |
| EL-M06-S4-030 | text | conditional | "Set penuh target custom untuk Bahasa Melayu disasar pada 34 soalan." | FN-M06-3.2.6 |
| EL-M06-S4-031 | link | conditional | "Mula Kuiz", → /spm/latih-tubi/BM/quiz?count=34, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-032 | heading | conditional | "Perniagaan" | FN-M06-3.2.2 |
| EL-M06-S4-033 | text | conditional | "2,732 soalan tersedia" | FN-M06-3.2.2 |
| EL-M06-S4-034 | button | conditional | "Tingkatan 5 2,005 soalan" | FN-M06-3.2.4 |
| EL-M06-S4-035 | button | conditional | "Sukar 84 soalan" | FN-M06-3.2.5 |
| EL-M06-S4-036 | button | conditional | "5" | FN-M06-3.2.8 |
| EL-M06-S4-037 | button | conditional | "10" | FN-M06-3.2.8 |
| EL-M06-S4-038 | button | conditional | "20" | FN-M06-3.2.8 |
| EL-M06-S4-039 | button | conditional | "30" | FN-M06-3.2.8 |
| EL-M06-S4-040 | button | conditional | "40" | FN-M06-3.2.8 |
| EL-M06-S4-041 | button | conditional | "50" | FN-M06-3.2.8 |
| EL-M06-S4-042 | button | conditional | "60" | FN-M06-3.2.8 |
| EL-M06-S4-043 | text | conditional | "Pilih bilangan soalan ikut keperluan latihan anda." | FN-M06-3.2.8 |
| EL-M06-S4-044 | link | conditional | "Mula Kuiz", → /spm/latih-tubi/PERNIAGA/quiz?count=30, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-045 | link | conditional | "Mula Kuiz", → /spm/latih-tubi/PERNIAGA/quiz?count=10, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-046 | heading | conditional | "Bahasa Arab" | FN-M06-3.2.2 |
| EL-M06-S4-047 | text | conditional | "1,200 soalan tersedia Target Latihan set: 40 soalan" | FN-M06-3.2.2 |
| EL-M06-S4-048 | button | conditional | "Sukar 0 soalan" | FN-M06-3.2.5 |
| EL-M06-S4-049 | button | conditional | "40 (Target Latihan)" | FN-M06-3.2.6 |
| EL-M06-S4-050 | text | conditional | "Set penuh target latihan untuk Bahasa Arab disasar pada 40 soalan." | FN-M06-3.2.6 |
| EL-M06-S4-051 | link | conditional | "Mula Kuiz", → /spm/latih-tubi/BA/quiz?count=40, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-052 | heading | conditional | "Matematik Tambahan" | FN-M06-3.2.2 |
| EL-M06-S4-053 | text | conditional | "2,101 soalan tersedia Target Latihan set: 20 soalan" | FN-M06-3.2.2 |
| EL-M06-S4-054 | button | conditional | "20 (Target Latihan)" | FN-M06-3.2.6 |
| EL-M06-S4-055 | text | conditional | "Set penuh target latihan untuk Matematik Tambahan disasar pada 20 soal…" | FN-M06-3.2.6 |
| EL-M06-S4-056 | link | conditional | "Mula Kuiz", → /spm/latih-tubi/ADDMATH/quiz?count=20, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-057 | button | conditional | "Sukar 89 soalan" | FN-M06-3.2.9 |
| EL-M06-S4-058 | link | conditional | "Mula Kuiz", → /spm/latih-tubi/MATH/quiz?count=40&level=10, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-059 | button | conditional | "Sukar 41 soalan" | FN-M06-3.2.9 |
| EL-M06-S4-060 | link | conditional | "Mula Kuiz", → /spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4, fa-play-circle | FN-M06-3.2.7 |
| EL-M06-S4-061 | text | conditional | "404" | FN-M06-1.3.2 |
| EL-M06-S4-062 | text | conditional | "🔍" | FN-M06-1.3.2 |
| EL-M06-S4-063 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M06-1.3.2 |
| EL-M06-S4-064 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungk…" | FN-M06-1.3.2 |
| EL-M06-S4-065 | link | conditional | "Halaman Utama", → / | FN-M06-1.3.2 |
| EL-M06-S4-066 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M06-1.3.2 |
| EL-M06-S4-067 | text | conditional | "PRESTASIPLUS" | FN-M06-1.3.2 |

#### S5 — `/spm/ramalan` (269 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S5-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S5-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S5-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S5-004 | link | visible-default | "Kembali ke Mod SPM", → /spm, fa-arrow-left | FN-M06-4.1.1 |
| EL-M06-S5-005 | heading | visible-default | "Tracking A SPM" | FN-M06-4.1.1 |
| EL-M06-S5-006 | badge | visible-default | "TRACKING A" | FN-M06-4.1.1 |
| EL-M06-S5-007 | text | visible-default | "Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!" | FN-M06-4.1.1 |
| EL-M06-S5-008 | text | visible-default | "Tracking A Objektif" | FN-M06-4.1.2 |
| EL-M06-S5-009 | heading | visible-default | "Subjek objektif penuh" | FN-M06-4.1.2 |
| EL-M06-S5-010 | text | visible-default | "Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set." | FN-M06-4.1.2 |
| EL-M06-S5-011 | badge | visible-default | "3 subjek" | FN-M06-4.1.2 |
| EL-M06-S5-012 | badge | visible-default | "18 set", fa-layer-group | FN-M06-4.1.2 |
| EL-M06-S5-013 | badge | visible-default | "747 soalan", fa-file-circle-check | FN-M06-4.1.2 |
| EL-M06-S5-014 | text | visible-default | "Tracking A Bahasa" | FN-M06-4.1.3 |
| EL-M06-S5-015 | heading | visible-default | "BM dan BI format sebenar" | FN-M06-4.1.3 |
| EL-M06-S5-016 | text | visible-default | "Lane khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ." | FN-M06-4.1.3 |
| EL-M06-S5-017 | badge | visible-default | "2 subjek" | FN-M06-4.1.3 |
| EL-M06-S5-018 | badge | visible-default | "1,332 set", fa-layer-group | FN-M06-4.1.3 |
| EL-M06-S5-019 | badge | visible-default | "Paper-based tracking", fa-language | FN-M06-4.1.3 |
| EL-M06-S5-020 | card | visible-default | "Admin Readiness" | FN-M06-4.1.4 |
| EL-M06-S5-021 | text | visible-default | "Admin Readiness" | FN-M06-4.1.4 |
| EL-M06-S5-022 | heading | visible-default | "Status set Tracking A SPM semasa" | FN-M06-4.1.4 |
| EL-M06-S5-023 | text | visible-default | "Laporan ini bezakan set bersih, set bank besar, dan set yang masih loc…" | FN-M06-4.1.4 |
| EL-M06-S5-024 | badge | visible-default | "Set Bersih: 1 set" | FN-M06-4.1.4 |
| EL-M06-S5-025 | badge | visible-default | "Bank Besar: 1 set" | FN-M06-4.1.4 |
| EL-M06-S5-026 | badge | visible-default | "Locked: 58 set" | FN-M06-4.1.4 |
| EL-M06-S5-027 | heading | visible-default | "Bahasa Melayu" | FN-M06-4.1.5 |
| EL-M06-S5-028 | text | visible-default | "BM · Target set: 34 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-029 | badge | visible-default | "0/1 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-030 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-031 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-032 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-033 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-034 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-035 | text | visible-default | "1" | FN-M06-4.1.6 |
| EL-M06-S5-036 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-037 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-038 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-039 | badge | visible-default | "2026 Set 1 · 9/34" | FN-M06-4.1.7 |
| EL-M06-S5-040 | heading | visible-default | "Bahasa Inggeris" | FN-M06-4.1.5 |
| EL-M06-S5-041 | text | visible-default | "BI · Target set: 36 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-042 | badge | visible-default | "0/0 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-043 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-044 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-045 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-046 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-047 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-048 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-049 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-050 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-051 | heading | visible-default | "Matematik" | FN-M06-4.1.5 |
| EL-M06-S5-052 | text | visible-default | "MATH · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-053 | badge | visible-default | "0/11 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-054 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-055 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-056 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-057 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-058 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-059 | text | visible-default | "11" | FN-M06-4.1.6 |
| EL-M06-S5-060 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-061 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-062 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-063 | badge | visible-default | "2026 Set 43 · 34/40" | FN-M06-4.1.7 |
| EL-M06-S5-064 | badge | visible-default | "2026 Set 44 · 31/40" | FN-M06-4.1.7 |
| EL-M06-S5-065 | badge | visible-default | "2026 Set 45 · 34/40" | FN-M06-4.1.7 |
| EL-M06-S5-066 | badge | visible-default | "2026 Set 46 · 32/40" | FN-M06-4.1.7 |
| EL-M06-S5-067 | badge | visible-default | "2026 Set 47 · 35/40" | FN-M06-4.1.7 |
| EL-M06-S5-068 | badge | visible-default | "2026 Set 48 · 30/40" | FN-M06-4.1.7 |
| EL-M06-S5-069 | heading | visible-default | "Sains" | FN-M06-4.1.5 |
| EL-M06-S5-070 | text | visible-default | "SCI · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-071 | badge | visible-default | "0/9 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-072 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-073 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-074 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-075 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-076 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-077 | text | visible-default | "9" | FN-M06-4.1.6 |
| EL-M06-S5-078 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-079 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-080 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-081 | badge | visible-default | "2026 Set 25 · 22/40" | FN-M06-4.1.7 |
| EL-M06-S5-082 | badge | visible-default | "2026 Set 26 · 3/40" | FN-M06-4.1.7 |
| EL-M06-S5-083 | badge | visible-default | "2026 Set 27 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-084 | badge | visible-default | "2026 Set 28 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-085 | badge | visible-default | "2026 Set 30 · 3/40" | FN-M06-4.1.7 |
| EL-M06-S5-086 | badge | visible-default | "2026 Set 31 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-087 | heading | visible-default | "Sejarah" | FN-M06-4.1.5 |
| EL-M06-S5-088 | text | visible-default | "SEJ · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-089 | badge | visible-default | "0/1 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-090 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-091 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-092 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-093 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-094 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-095 | text | visible-default | "1" | FN-M06-4.1.6 |
| EL-M06-S5-096 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-097 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-098 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-099 | badge | visible-default | "2026 Set 37 · 31/40" | FN-M06-4.1.7 |
| EL-M06-S5-100 | heading | visible-default | "Pendidikan Islam" | FN-M06-4.1.5 |
| EL-M06-S5-101 | text | visible-default | "PI · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-102 | badge | visible-default | "0/0 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-103 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-104 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-105 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-106 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-107 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-108 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-109 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-110 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-111 | heading | visible-default | "Pendidikan Moral" | FN-M06-4.1.5 |
| EL-M06-S5-112 | text | visible-default | "PM · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-113 | badge | visible-default | "0/0 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-114 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-115 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-116 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-117 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-118 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-119 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-120 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-121 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-122 | heading | visible-default | "Matematik Tambahan" | FN-M06-4.1.5 |
| EL-M06-S5-123 | text | visible-default | "ADDMATH · Target set: 20 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-124 | badge | visible-default | "0/0 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-125 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-126 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-127 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-128 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-129 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-130 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-131 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-132 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-133 | heading | visible-default | "Fizik" | FN-M06-4.1.5 |
| EL-M06-S5-134 | text | visible-default | "PHY · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-135 | badge | visible-default | "0/4 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-136 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-137 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-138 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-139 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-140 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-141 | text | visible-default | "4" | FN-M06-4.1.6 |
| EL-M06-S5-142 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-143 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-144 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-145 | badge | visible-default | "2026 Set 1 · 4/40" | FN-M06-4.1.7 |
| EL-M06-S5-146 | badge | visible-default | "2026 Set 4 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-147 | badge | visible-default | "2026 Set 7 · 2/40" | FN-M06-4.1.7 |
| EL-M06-S5-148 | badge | visible-default | "2026 Set 9 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-149 | heading | visible-default | "Kimia" | FN-M06-4.1.5 |
| EL-M06-S5-150 | text | visible-default | "CHEM · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-151 | badge | visible-default | "0/7 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-152 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-153 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-154 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-155 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-156 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-157 | text | visible-default | "7" | FN-M06-4.1.6 |
| EL-M06-S5-158 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-159 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-160 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-161 | badge | visible-default | "2026 Set 1 · 4/40" | FN-M06-4.1.7 |
| EL-M06-S5-162 | badge | visible-default | "2026 Set 2 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-163 | badge | visible-default | "2026 Set 3 · 3/40" | FN-M06-4.1.7 |
| EL-M06-S5-164 | badge | visible-default | "2026 Set 5 · 5/40" | FN-M06-4.1.7 |
| EL-M06-S5-165 | badge | visible-default | "2026 Set 6 · 3/40" | FN-M06-4.1.7 |
| EL-M06-S5-166 | badge | visible-default | "2026 Set 8 · 4/40" | FN-M06-4.1.7 |
| EL-M06-S5-167 | heading | visible-default | "Biologi" | FN-M06-4.1.5 |
| EL-M06-S5-168 | text | visible-default | "BIO · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-169 | badge | visible-default | "0/3 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-170 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-171 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-172 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-173 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-174 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-175 | text | visible-default | "3" | FN-M06-4.1.6 |
| EL-M06-S5-176 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-177 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-178 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-179 | badge | visible-default | "2026 Set 2 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-180 | badge | visible-default | "2026 Set 5 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-181 | badge | visible-default | "2026 Set 10 · 1/40" | FN-M06-4.1.7 |
| EL-M06-S5-182 | heading | visible-default | "Geografi" | FN-M06-4.1.5 |
| EL-M06-S5-183 | text | visible-default | "GEO · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-184 | badge | visible-default | "0/10 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-185 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-186 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-187 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-188 | text | visible-default | "1" | FN-M06-4.1.6 |
| EL-M06-S5-189 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-190 | text | visible-default | "9" | FN-M06-4.1.6 |
| EL-M06-S5-191 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-192 | text | visible-default | "10%" | FN-M06-4.1.6 |
| EL-M06-S5-193 | text | visible-default | "Set bank besar boleh dibuka, tetapi bank sumber melebihi target set. R…" | FN-M06-4.1.8 |
| EL-M06-S5-194 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-195 | badge | visible-default | "2026 Set 2 · 31/40" | FN-M06-4.1.7 |
| EL-M06-S5-196 | badge | visible-default | "2026 Set 3 · 34/40" | FN-M06-4.1.7 |
| EL-M06-S5-197 | badge | visible-default | "2026 Set 4 · 30/40" | FN-M06-4.1.7 |
| EL-M06-S5-198 | badge | visible-default | "2026 Set 5 · 30/40" | FN-M06-4.1.7 |
| EL-M06-S5-199 | badge | visible-default | "2026 Set 6 · 31/40" | FN-M06-4.1.7 |
| EL-M06-S5-200 | badge | visible-default | "2026 Set 7 · 30/40" | FN-M06-4.1.7 |
| EL-M06-S5-201 | heading | visible-default | "Bahasa Arab" | FN-M06-4.1.5 |
| EL-M06-S5-202 | text | visible-default | "BA · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-203 | badge | visible-default | "0/0 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-204 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-205 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-206 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-207 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-208 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-209 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-210 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-211 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-212 | heading | visible-default | "Ekonomi" | FN-M06-4.1.5 |
| EL-M06-S5-213 | text | visible-default | "EKON · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-214 | badge | visible-default | "0/8 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-215 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-216 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-217 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-218 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-219 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-220 | text | visible-default | "8" | FN-M06-4.1.6 |
| EL-M06-S5-221 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-222 | text | visible-default | "0%" | FN-M06-4.1.6 |
| EL-M06-S5-223 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-224 | badge | visible-default | "2026 Set 1 · 23/40" | FN-M06-4.1.7 |
| EL-M06-S5-225 | badge | visible-default | "2026 Set 2 · 17/40" | FN-M06-4.1.7 |
| EL-M06-S5-226 | badge | visible-default | "2026 Set 3 · 12/40" | FN-M06-4.1.7 |
| EL-M06-S5-227 | badge | visible-default | "2026 Set 4 · 14/40" | FN-M06-4.1.7 |
| EL-M06-S5-228 | badge | visible-default | "2026 Set 5 · 19/40" | FN-M06-4.1.7 |
| EL-M06-S5-229 | badge | visible-default | "2026 Set 6 · 23/40" | FN-M06-4.1.7 |
| EL-M06-S5-230 | heading | visible-default | "Pendidikan Syariah Islamiah" | FN-M06-4.1.5 |
| EL-M06-S5-231 | text | visible-default | "PSI · Target set: 40 soalan" | FN-M06-4.1.5 |
| EL-M06-S5-232 | badge | visible-default | "1/6 set bersih" | FN-M06-4.1.5 |
| EL-M06-S5-233 | text | visible-default | "Set Bersih" | FN-M06-4.1.6 |
| EL-M06-S5-234 | text | visible-default | "1" | FN-M06-4.1.6 |
| EL-M06-S5-235 | text | visible-default | "Bank Besar" | FN-M06-4.1.6 |
| EL-M06-S5-236 | text | visible-default | "0" | FN-M06-4.1.6 |
| EL-M06-S5-237 | text | visible-default | "Locked" | FN-M06-4.1.6 |
| EL-M06-S5-238 | text | visible-default | "5" | FN-M06-4.1.6 |
| EL-M06-S5-239 | text | visible-default | "Readiness" | FN-M06-4.1.6 |
| EL-M06-S5-240 | text | visible-default | "17%" | FN-M06-4.1.6 |
| EL-M06-S5-241 | text | visible-default | "Set Masih Lock" | FN-M06-4.1.7 |
| EL-M06-S5-242 | badge | visible-default | "2026 Set 3 · 31/40" | FN-M06-4.1.7 |
| EL-M06-S5-243 | badge | visible-default | "2026 Set 5 · 33/40" | FN-M06-4.1.7 |
| EL-M06-S5-244 | badge | visible-default | "2026 Set 6 · 33/40" | FN-M06-4.1.7 |
| EL-M06-S5-245 | badge | visible-default | "2026 Set 7 · 38/40" | FN-M06-4.1.7 |
| EL-M06-S5-246 | badge | visible-default | "2026 Set 8 · 30/40" | FN-M06-4.1.7 |
| EL-M06-S5-247 | text | visible-default | "Tracking A Bahasa" | FN-M06-4.1.9 |
| EL-M06-S5-248 | heading | visible-default | "BM dan BI ikut format kertas sebenar" | FN-M06-4.1.9 |
| EL-M06-S5-249 | text | visible-default | "Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set bers…" | FN-M06-4.1.9 |
| EL-M06-S5-250 | text | visible-default | "Paper-based tracking" | FN-M06-4.1.9 |
| EL-M06-S5-251 | link | visible-default | "Bahasa Melayu Malay Language 559 set Berstruktur / respons sebenar Buk…", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa, fa-book-open | FN-M06-4.1.9 |
| EL-M06-S5-252 | card | visible-default | "Bahasa Melayu" | FN-M06-4.1.9 |
| EL-M06-S5-253 | heading | visible-default | "Bahasa Melayu" | FN-M06-4.1.9 |
| EL-M06-S5-254 | link | visible-default | "Bahasa Inggeris English Language 773 set Berstruktur / respons sebenar…", → /latihan-berstruktur?subject_id=2&scope=spm&track=bahasa, fa-globe | FN-M06-4.1.9 |
| EL-M06-S5-255 | card | visible-default | "Bahasa Inggeris" | FN-M06-4.1.9 |
| EL-M06-S5-256 | heading | visible-default | "Bahasa Inggeris" | FN-M06-4.1.9 |
| EL-M06-S5-257 | link | visible-default | "Geografi Geography 40 soalan kuiz siap guna 1 bank besar Target SPM: 4…", → /spm/ramalan/GEO, fa-map | FN-M06-4.1.10 |
| EL-M06-S5-258 | card | visible-default | "Geografi" | FN-M06-4.1.10 |
| EL-M06-S5-259 | heading | visible-default | "Geografi" | FN-M06-4.1.10 |
| EL-M06-S5-260 | alert | visible-default | "1 bank besar", fa-layer-group | FN-M06-4.1.10 |
| EL-M06-S5-261 | alert | visible-default | "Target SPM: 40", fa-bullseye | FN-M06-4.1.10 |
| EL-M06-S5-262 | link | visible-default | "Prinsip Perakaunan Principles of Accounting 640 soalan kuiz siap guna …", → /spm/ramalan/AKAUN, fa-receipt | FN-M06-4.1.10 |
| EL-M06-S5-263 | card | visible-default | "Prinsip Perakaunan" | FN-M06-4.1.10 |
| EL-M06-S5-264 | heading | visible-default | "Prinsip Perakaunan" | FN-M06-4.1.10 |
| EL-M06-S5-265 | link | visible-default | "Pendidikan Syariah Islamiah Islamic Syariah Education 40 soalan kuiz s…", → /spm/ramalan/PSI, fa-fas fa-scale-balanced | FN-M06-4.1.10 |
| EL-M06-S5-266 | card | visible-default | "Pendidikan Syariah Islamiah" | FN-M06-4.1.10 |
| EL-M06-S5-267 | heading | visible-default | "Pendidikan Syariah Islamiah" | FN-M06-4.1.10 |
| EL-M06-S5-268 | alert | visible-default | "1 set bersih", fa-circle-check | FN-M06-4.1.10 |
| EL-M06-S5-269 | alert | visible-default | "Target Latihan: 40", fa-bullseye | FN-M06-4.1.10 |

#### S6 — `/spm/ramalan/{CODE}` (123 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S6-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S6-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S6-004 | link | visible-default | "Kembali", → /spm/ramalan, fa-arrow-left | FN-M06-4.2.1 |
| EL-M06-S6-005 | heading | visible-default | "Geografi" | FN-M06-4.2.1 |
| EL-M06-S6-006 | text | visible-default | "Tracking A SPM Target SPM set: 40 soalan" | FN-M06-4.2.1 |
| EL-M06-S6-007 | text | visible-default | "·" | FN-M06-4.2.1 |
| EL-M06-S6-008 | badge | visible-default | "0 set bersih", fa-circle-check | FN-M06-4.2.2 |
| EL-M06-S6-009 | badge | visible-default | "1 set bank besar", fa-layer-group | FN-M06-4.2.2 |
| EL-M06-S6-010 | badge | visible-default | "309 soalan kuiz siap guna", fa-file-circle-check | FN-M06-4.2.2 |
| EL-M06-S6-011 | badge | visible-default | "9 set belum cukup", fa-lock | FN-M06-4.2.2 |
| EL-M06-S6-012 | badge | visible-default | "Target SPM: 40 / set", fa-bullseye | FN-M06-4.2.2 |
| EL-M06-S6-013 | heading | visible-default | "Tracking A 2026" | FN-M06-4.2.3 |
| EL-M06-S6-014 | link | visible-default | "Set 1 Ready Bank Besar 40 soalan kuiz siap guna Format set: 40 / 40 Ba…", → /spm/ramalan/GEO?year=2026&set=1, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-015 | card | visible-default | "Set 1" | FN-M06-4.2.4 |
| EL-M06-S6-016 | alert | visible-default | "Ready Bank Besar" | FN-M06-4.2.4 |
| EL-M06-S6-017 | link | visible-default | "Set 2 Belum Cukup 31 soalan kuiz siap guna Format set: 31 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-018 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-019 | link | visible-default | "Set 3 Belum Cukup 34 soalan kuiz siap guna Format set: 34 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-020 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-021 | link | visible-default | "Set 4 Belum Cukup 30 soalan kuiz siap guna Format set: 30 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-022 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-023 | link | visible-default | "Set 5 Belum Cukup 30 soalan kuiz siap guna Format set: 30 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-024 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-025 | link | visible-default | "Set 6 Belum Cukup 31 soalan kuiz siap guna Format set: 31 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-026 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-027 | link | visible-default | "Set 7 Belum Cukup 30 soalan kuiz siap guna Format set: 30 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-028 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-029 | link | visible-default | "Set 8 Belum Cukup 32 soalan kuiz siap guna Format set: 32 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-030 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-031 | link | visible-default | "Set 9 Belum Cukup 20 soalan kuiz siap guna Format set: 20 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-032 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-033 | link | visible-default | "Set 10 Belum Cukup 31 soalan kuiz siap guna Format set: 31 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-034 | alert | visible-default | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-035 | heading | conditional | "Matematik" | FN-M06-4.2.1 |
| EL-M06-S6-036 | badge | conditional | "0 set bank besar", fa-layer-group | FN-M06-4.2.2 |
| EL-M06-S6-037 | badge | conditional | "11 set belum cukup", fa-lock | FN-M06-4.2.2 |
| EL-M06-S6-038 | link | conditional | "Set 43 Belum Cukup 34 soalan kuiz siap guna Format set: 34 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-039 | link | conditional | "Set 44 Belum Cukup 31 soalan kuiz siap guna Format set: 31 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-040 | link | conditional | "Set 45 Belum Cukup 34 soalan kuiz siap guna Format set: 34 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-041 | link | conditional | "Set 46 Belum Cukup 32 soalan kuiz siap guna Format set: 32 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-042 | link | conditional | "Set 47 Belum Cukup 35 soalan kuiz siap guna Format set: 35 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-043 | link | conditional | "Set 48 Belum Cukup 30 soalan kuiz siap guna Format set: 30 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-044 | link | conditional | "Set 49 Belum Cukup 35 soalan kuiz siap guna Format set: 35 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-045 | link | conditional | "Set 50 Belum Cukup 34 soalan kuiz siap guna Format set: 34 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-046 | link | conditional | "Set 51 Belum Cukup 31 soalan kuiz siap guna Format set: 31 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-047 | link | conditional | "Set 52 Belum Cukup 33 soalan kuiz siap guna Format set: 33 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-048 | alert | conditional | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-049 | link | conditional | "Set 53 Belum Cukup 33 soalan kuiz siap guna Format set: 33 / 40 Belum …", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-050 | alert | conditional | "Belum Cukup" | FN-M06-4.2.5 |
| EL-M06-S6-051 | heading | conditional | "Prinsip Perakaunan" | FN-M06-4.2.1 |
| EL-M06-S6-052 | text | conditional | "Tracking A SPM" | FN-M06-4.2.1 |
| EL-M06-S6-053 | badge | conditional | "16 set bersih", fa-circle-check | FN-M06-4.2.2 |
| EL-M06-S6-054 | link | conditional | "Set 1 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=1, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-055 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-056 | link | conditional | "Set 2 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=2, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-057 | card | conditional | "Set 2" | FN-M06-4.2.4 |
| EL-M06-S6-058 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-059 | link | conditional | "Set 3 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=3, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-060 | card | conditional | "Set 3" | FN-M06-4.2.4 |
| EL-M06-S6-061 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-062 | link | conditional | "Set 4 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=4, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-063 | card | conditional | "Set 4" | FN-M06-4.2.4 |
| EL-M06-S6-064 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-065 | link | conditional | "Set 5 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=5, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-066 | card | conditional | "Set 5" | FN-M06-4.2.4 |
| EL-M06-S6-067 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-068 | link | conditional | "Set 6 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=6, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-069 | card | conditional | "Set 6" | FN-M06-4.2.4 |
| EL-M06-S6-070 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-071 | link | conditional | "Set 7 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=7, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-072 | card | conditional | "Set 7" | FN-M06-4.2.4 |
| EL-M06-S6-073 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-074 | link | conditional | "Set 8 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=8, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-075 | card | conditional | "Set 8" | FN-M06-4.2.4 |
| EL-M06-S6-076 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-077 | link | conditional | "Set 9 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=9, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-078 | card | conditional | "Set 9" | FN-M06-4.2.4 |
| EL-M06-S6-079 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-080 | link | conditional | "Set 10 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=10, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-081 | card | conditional | "Set 10" | FN-M06-4.2.4 |
| EL-M06-S6-082 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-083 | link | conditional | "Set 11 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=11, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-084 | card | conditional | "Set 11" | FN-M06-4.2.4 |
| EL-M06-S6-085 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-086 | link | conditional | "Set 12 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=12, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-087 | card | conditional | "Set 12" | FN-M06-4.2.4 |
| EL-M06-S6-088 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-089 | link | conditional | "Set 13 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=13, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-090 | card | conditional | "Set 13" | FN-M06-4.2.4 |
| EL-M06-S6-091 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-092 | link | conditional | "Set 14 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=14, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-093 | card | conditional | "Set 14" | FN-M06-4.2.4 |
| EL-M06-S6-094 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-095 | link | conditional | "Set 15 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=15, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-096 | card | conditional | "Set 15" | FN-M06-4.2.4 |
| EL-M06-S6-097 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-098 | link | conditional | "Set 16 Set Bersih 40 soalan kuiz siap guna DSKP: 40/40 (100%)", → /spm/ramalan/AKAUN?year=2026&set=16, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-099 | card | conditional | "Set 16" | FN-M06-4.2.4 |
| EL-M06-S6-100 | alert | conditional | "Set Bersih" | FN-M06-4.2.4 |
| EL-M06-S6-101 | heading | conditional | "Bahasa Arab" | FN-M06-4.2.1 |
| EL-M06-S6-102 | text | conditional | "Tracking A SPM Target Latihan set: 40 soalan" | FN-M06-4.2.1 |
| EL-M06-S6-103 | badge | conditional | "0 soalan kuiz siap guna", fa-file-circle-check | FN-M06-4.2.2 |
| EL-M06-S6-104 | badge | conditional | "Target Latihan: 40 / set", fa-bullseye | FN-M06-4.2.2 |
| EL-M06-S6-105 | card | conditional | "Belum Ada Set Tracking A" | FN-M06-4.2.6 |
| EL-M06-S6-106 | heading | conditional | "Belum Ada Set Tracking A" | FN-M06-4.2.6 |
| EL-M06-S6-107 | text | conditional | "Set Tracking A untuk subjek ini akan ditambah tidak lama lagi." | FN-M06-4.2.6 |
| EL-M06-S6-108 | heading | conditional | "Pendidikan Syariah Islamiah" | FN-M06-4.2.1 |
| EL-M06-S6-109 | badge | conditional | "1 set bersih", fa-circle-check | FN-M06-4.2.2 |
| EL-M06-S6-110 | badge | conditional | "5 set belum cukup", fa-lock | FN-M06-4.2.2 |
| EL-M06-S6-111 | link | conditional | "Set 4 Set Bersih 40 soalan kuiz siap guna Format set: 40 / 40 DSKP: 40…", → /spm/ramalan/PSI?year=2026&set=4, fa-tag | FN-M06-4.2.4 |
| EL-M06-S6-112 | link | conditional | "Set 3 Belum Cukup 31 soalan kuiz siap guna Format set: 31 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-113 | link | conditional | "Set 5 Belum Cukup 33 soalan kuiz siap guna Format set: 33 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-114 | link | conditional | "Set 6 Belum Cukup 33 soalan kuiz siap guna Format set: 33 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-115 | link | conditional | "Set 7 Belum Cukup 38 soalan kuiz siap guna Format set: 38 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-116 | link | conditional | "Set 8 Belum Cukup 30 soalan kuiz siap guna Format set: 30 / 40 Belum c…", → javascript:void(0), fa-tag | FN-M06-4.2.5 |
| EL-M06-S6-117 | text | conditional | "404" | FN-M06-1.3.2 |
| EL-M06-S6-118 | text | conditional | "🔍" | FN-M06-1.3.2 |
| EL-M06-S6-119 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M06-1.3.2 |
| EL-M06-S6-120 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungk…" | FN-M06-1.3.2 |
| EL-M06-S6-121 | link | conditional | "Halaman Utama", → / | FN-M06-1.3.2 |
| EL-M06-S6-122 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M06-1.3.2 |
| EL-M06-S6-123 | text | conditional | "PRESTASIPLUS" | FN-M06-1.3.2 |

#### S7 — `/latihan-berstruktur?subject_id={1|2}&scope=spm&track=bahasa` (119 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S7-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S7-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S7-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S7-004 | link | visible-default | "Kembali ke Tracking A SPM", → /spm/ramalan, fa-arrow-left | FN-M06-4.4.1 |
| EL-M06-S7-005 | badge | visible-default | "Tracking A Bahasa", fa-language | FN-M06-4.4.1 |
| EL-M06-S7-006 | heading | visible-default | "Tracking A Bahasa" | FN-M06-4.4.1 |
| EL-M06-S7-007 | text | visible-default | "Set bahasa dibuka ikut format kertas sebenar. BM dan BI tidak dipaksa …" | FN-M06-4.4.1 |
| EL-M06-S7-008 | card | visible-default | "BM dahulu, BI kemudian" | FN-M06-4.4.2 |
| EL-M06-S7-009 | text | visible-default | "Subjek bahasa tidak dipaksa menjadi 40 MCQ. Laluan ini menggunakan pap…" | FN-M06-4.4.2 |
| EL-M06-S7-010 | badge | visible-default | "BM dahulu, BI kemudian", fa-book-open | FN-M06-4.4.2 |
| EL-M06-S7-011 | badge | visible-default | "Format kertas sebenar", fa-file-lines | FN-M06-4.4.2 |
| EL-M06-S7-012 | badge | visible-default | "Paper-based tracking", fa-language | FN-M06-4.4.2 |
| EL-M06-S7-013 | badge | visible-default | "Berstruktur / respons sebenar", fa-pen-fancy | FN-M06-4.4.2 |
| EL-M06-S7-014 | badge | visible-default | "559 set ditemui", fa-layer-group | FN-M06-4.4.2 |
| EL-M06-S7-015 | card | visible-default | "Subjek" | FN-M06-4.4.3 |
| EL-M06-S7-016 | form | visible-default | form | FN-M06-4.4.3 |
| EL-M06-S7-017 | hidden-field | hidden-only | name=scope | FN-M06-4.4.3 |
| EL-M06-S7-018 | hidden-field | hidden-only | name=track | FN-M06-4.4.3 |
| EL-M06-S7-019 | label | visible-default | "Subjek" | FN-M06-4.4.3 |
| EL-M06-S7-020 | select | visible-default | name=subject_id | FN-M06-4.4.3 |
| EL-M06-S7-021 | label | visible-default | "Aras KBAT" | FN-M06-4.4.3 |
| EL-M06-S7-022 | select | visible-default | name=kbat_level | FN-M06-4.4.3 |
| EL-M06-S7-023 | button | visible-default | "Cari", fa-search | FN-M06-4.4.3 |
| EL-M06-S7-024 | card | visible-default | "Bahasa Melayu" | FN-M06-4.4.4 |
| EL-M06-S7-025 | badge | visible-default | "Bahasa Melayu" | FN-M06-4.4.4 |
| EL-M06-S7-026 | text | visible-default | "LOTS 2" | FN-M06-4.4.4 |
| EL-M06-S7-027 | badge | visible-default | "7m" | FN-M06-4.4.4 |
| EL-M06-S7-028 | badge | visible-default | "Tingkatan 5" | FN-M06-4.4.4 |
| EL-M06-S7-029 | badge | visible-default | "Trial" | FN-M06-4.4.4 |
| EL-M06-S7-030 | text | visible-default | "Petikan 2: Dialog Kerabu Rumpai Laut." | FN-M06-4.4.4 |
| EL-M06-S7-031 | text | visible-default | "5 bahagian · 7 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-032 | text | visible-default | "<person> · <school>", fa-user-pen | FN-M06-4.4.4 |
| EL-M06-S7-033 | text | visible-default | "5 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-034 | link | visible-default | "Mula", → /latihan-berstruktur/3700/jawab?scope=spm&track=bahasa, fa-arrow-right | FN-M06-4.4.5 |
| EL-M06-S7-035 | card | visible-default | "Bahasa Melayu" | FN-M06-4.4.4 |
| EL-M06-S7-036 | badge | visible-default | "Bahasa Melayu" | FN-M06-4.4.4 |
| EL-M06-S7-037 | text | visible-default | "LOTS 2" | FN-M06-4.4.4 |
| EL-M06-S7-038 | badge | visible-default | "7m" | FN-M06-4.4.4 |
| EL-M06-S7-039 | badge | visible-default | "Tingkatan 5" | FN-M06-4.4.4 |
| EL-M06-S7-040 | badge | visible-default | "Trial" | FN-M06-4.4.4 |
| EL-M06-S7-041 | text | visible-default | "Petikan 3: Berita Pakaian Terpakai Jadi Pilihan." | FN-M06-4.4.4 |
| EL-M06-S7-042 | text | visible-default | "5 bahagian · 7 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-043 | text | visible-default | "<person> · <school>", fa-user-pen | FN-M06-4.4.4 |
| EL-M06-S7-044 | text | visible-default | "5 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-045 | link | visible-default | "Mula", → /latihan-berstruktur/3701/jawab?scope=spm&track=bahasa, fa-arrow-right | FN-M06-4.4.5 |
| EL-M06-S7-046 | card | visible-default | "Bahasa Melayu" | FN-M06-4.4.4 |
| EL-M06-S7-047 | badge | visible-default | "Bahasa Melayu" | FN-M06-4.4.4 |
| EL-M06-S7-048 | text | visible-default | "LOTS 2" | FN-M06-4.4.4 |
| EL-M06-S7-049 | badge | visible-default | "8m" | FN-M06-4.4.4 |
| EL-M06-S7-050 | badge | visible-default | "Tingkatan 5" | FN-M06-4.4.4 |
| EL-M06-S7-051 | badge | visible-default | "Trial" | FN-M06-4.4.4 |
| EL-M06-S7-052 | text | visible-default | "Petikan 4: Cerpen Gerai Karipap Parkir." | FN-M06-4.4.4 |
| EL-M06-S7-053 | text | visible-default | "5 bahagian · 8 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-054 | text | visible-default | "<person> · <school>", fa-user-pen | FN-M06-4.4.4 |
| EL-M06-S7-055 | text | visible-default | "5 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-056 | link | visible-default | "Mula", → /latihan-berstruktur/3702/jawab?scope=spm&track=bahasa, fa-arrow-right | FN-M06-4.4.5 |
| EL-M06-S7-057 | text | conditional | "« Previous" | FN-M06-4.4.6 |
| EL-M06-S7-058 | pagination | conditional | "Next »", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=2 | FN-M06-4.4.6 |
| EL-M06-S7-059 | text | visible-default | "Showing to of results" | FN-M06-4.4.6 |
| EL-M06-S7-060 | text | visible-default | "1" | FN-M06-4.4.6 |
| EL-M06-S7-061 | text | visible-default | "20" | FN-M06-4.4.6 |
| EL-M06-S7-062 | text | visible-default | "559" | FN-M06-4.4.6 |
| EL-M06-S7-063 | text | visible-default | "1" | FN-M06-4.4.6 |
| EL-M06-S7-064 | pagination | visible-default | "2", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=2 | FN-M06-4.4.6 |
| EL-M06-S7-065 | pagination | visible-default | "3", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=3 | FN-M06-4.4.6 |
| EL-M06-S7-066 | pagination | visible-default | "4", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=4 | FN-M06-4.4.6 |
| EL-M06-S7-067 | pagination | visible-default | "5", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=5 | FN-M06-4.4.6 |
| EL-M06-S7-068 | pagination | visible-default | "6", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=6 | FN-M06-4.4.6 |
| EL-M06-S7-069 | pagination | visible-default | "7", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=7 | FN-M06-4.4.6 |
| EL-M06-S7-070 | pagination | visible-default | "8", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=8 | FN-M06-4.4.6 |
| EL-M06-S7-071 | pagination | visible-default | "9", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=9 | FN-M06-4.4.6 |
| EL-M06-S7-072 | pagination | visible-default | "10", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=10 | FN-M06-4.4.6 |
| EL-M06-S7-073 | text | visible-default | "..." | FN-M06-4.4.6 |
| EL-M06-S7-074 | pagination | visible-default | "27", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=27 | FN-M06-4.4.6 |
| EL-M06-S7-075 | pagination | visible-default | "28", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=28 | FN-M06-4.4.6 |
| EL-M06-S7-076 | pagination | visible-default | → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=2, svg | FN-M06-4.4.6 |
| EL-M06-S7-077 | badge | conditional | "1,332 set ditemui", fa-layer-group | FN-M06-4.4.2 |
| EL-M06-S7-078 | card | conditional | "Bahasa Inggeris" | FN-M06-4.4.4 |
| EL-M06-S7-079 | badge | conditional | "Bahasa Inggeris" | FN-M06-4.4.4 |
| EL-M06-S7-080 | text | conditional | "MOTS 3" | FN-M06-4.4.4 |
| EL-M06-S7-081 | badge | conditional | "10m" | FN-M06-4.4.4 |
| EL-M06-S7-082 | text | conditional | "Part 2 essay on teenagers and communication." | FN-M06-4.4.4 |
| EL-M06-S7-083 | text | conditional | "4 bahagian · 10 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-084 | text | conditional | "4 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-085 | card | conditional | "Bahasa Inggeris" | FN-M06-4.4.4 |
| EL-M06-S7-086 | badge | conditional | "Bahasa Inggeris" | FN-M06-4.4.4 |
| EL-M06-S7-087 | text | conditional | "MOTS 3" | FN-M06-4.4.4 |
| EL-M06-S7-088 | badge | conditional | "10m" | FN-M06-4.4.4 |
| EL-M06-S7-089 | text | conditional | "Part 3 article: Crime in the modern age." | FN-M06-4.4.4 |
| EL-M06-S7-090 | text | conditional | "4 bahagian · 10 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-091 | text | conditional | "4 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-092 | card | conditional | "Bahasa Inggeris" | FN-M06-4.4.4 |
| EL-M06-S7-093 | badge | conditional | "Bahasa Inggeris" | FN-M06-4.4.4 |
| EL-M06-S7-094 | text | conditional | "MOTS 3" | FN-M06-4.4.4 |
| EL-M06-S7-095 | badge | conditional | "10m" | FN-M06-4.4.4 |
| EL-M06-S7-096 | text | conditional | "Part 3 report: Canteen Day to raise funds for a local charity." | FN-M06-4.4.4 |
| EL-M06-S7-097 | text | conditional | "4 bahagian · 10 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-098 | text | conditional | "4 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-099 | badge | conditional | "3 set ditemui", fa-layer-group | FN-M06-4.4.2 |
| EL-M06-S7-100 | text | conditional | "HOTS 6" | FN-M06-4.4.4 |
| EL-M06-S7-101 | text | conditional | "Tulis permulaan sebuah cereka bertemakan "Pengorbanan Seorang Sahabat"…" | FN-M06-4.4.4 |
| EL-M06-S7-102 | text | conditional | "HOTS 6" | FN-M06-4.4.4 |
| EL-M06-S7-103 | text | conditional | "Berdasarkan dua genre berbeza dalam antologi Komsas yang anda pelajari…" | FN-M06-4.4.4 |
| EL-M06-S7-104 | text | conditional | "HOTS 6" | FN-M06-4.4.4 |
| EL-M06-S7-105 | text | conditional | "Berdasarkan sebuah novel yang anda pelajari, jawab soalan KBAT berikut…" | FN-M06-4.4.4 |
| EL-M06-S7-106 | badge | conditional | "30m" | FN-M06-4.4.4 |
| EL-M06-S7-107 | text | conditional | "Keselamatan Kemalangan jalan raya merupakan isu yang sering diperkatak…" | FN-M06-4.4.4 |
| EL-M06-S7-108 | text | conditional | "1 bahagian · 30 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-109 | text | conditional | "1 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-110 | badge | conditional | "30m" | FN-M06-4.4.4 |
| EL-M06-S7-111 | text | conditional | "Jati Diri, Patriotisme dan Kewarganegaraan Semangat patriotisme dalam …" | FN-M06-4.4.4 |
| EL-M06-S7-112 | text | conditional | "1 bahagian · 30 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-113 | text | conditional | "1 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-114 | badge | conditional | "30m" | FN-M06-4.4.4 |
| EL-M06-S7-115 | text | conditional | "Perpaduan Perpaduan kaum di Malaysia adalah aspek penting dalam mengek…" | FN-M06-4.4.4 |
| EL-M06-S7-116 | text | conditional | "1 bahagian · 30 markah", fa-layer-group | FN-M06-4.4.4 |
| EL-M06-S7-117 | text | conditional | "1 soalan · Tingkatan 5", fa-list-ol | FN-M06-4.4.4 |
| EL-M06-S7-118 | pagination | hidden-only | "« Previous", → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=1 | FN-M06-4.4.6 |
| EL-M06-S7-119 | pagination | conditional | → /latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=3, svg | FN-M06-4.4.6 |

#### S8 — `/spm/subjektif` (150 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S8-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S8-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S8-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S8-004 | link | visible-default | "Kembali ke Mod SPM", → /spm, fa-arrow-left | FN-M06-5.1.1 |
| EL-M06-S8-005 | heading | visible-default | "Latihan Subjektif SPM" | FN-M06-5.1.1 |
| EL-M06-S8-006 | text | visible-default | "Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank …" | FN-M06-5.1.1 |
| EL-M06-S8-007 | text | visible-default | "Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan mod…" | FN-M06-5.1.2 |
| EL-M06-S8-008 | text | visible-default | "Bagaimana ia berfungsi?" | FN-M06-5.1.2 |
| EL-M06-S8-009 | card | visible-default | "Set Dijawab" | FN-M06-5.1.3 |
| EL-M06-S8-010 | text | visible-default | "Set Dijawab" | FN-M06-5.1.3 |
| EL-M06-S8-011 | text | visible-default | "0" | FN-M06-5.1.3 |
| EL-M06-S8-012 | text | visible-default | "Percubaan subjektif SPM yang telah dihantar" | FN-M06-5.1.3 |
| EL-M06-S8-013 | card | visible-default | "Subjek Dicuba" | FN-M06-5.1.3 |
| EL-M06-S8-014 | text | visible-default | "Subjek Dicuba" | FN-M06-5.1.3 |
| EL-M06-S8-015 | text | visible-default | "0" | FN-M06-5.1.3 |
| EL-M06-S8-016 | text | visible-default | "Bilangan subjek subjektif SPM yang pernah dicuba" | FN-M06-5.1.3 |
| EL-M06-S8-017 | card | visible-default | "Skor Terbaik" | FN-M06-5.1.3 |
| EL-M06-S8-018 | text | visible-default | "Skor Terbaik" | FN-M06-5.1.3 |
| EL-M06-S8-019 | text | visible-default | "Belum Ada" | FN-M06-5.1.3 |
| EL-M06-S8-020 | text | visible-default | "Skor tertinggi merentas semua set subjektif SPM" | FN-M06-5.1.3 |
| EL-M06-S8-021 | card | visible-default | "Set Terbaik Disimpan" | FN-M06-5.1.3 |
| EL-M06-S8-022 | text | visible-default | "Set Terbaik Disimpan" | FN-M06-5.1.3 |
| EL-M06-S8-023 | text | visible-default | "0" | FN-M06-5.1.3 |
| EL-M06-S8-024 | text | visible-default | "Bilangan set yang mempunyai percubaan terbaik tersimpan" | FN-M06-5.1.3 |
| EL-M06-S8-025 | tab | visible-default | "Semua 15" | FN-M06-5.1.4 |
| EL-M06-S8-026 | badge | visible-default | "15" | FN-M06-5.1.4 |
| EL-M06-S8-027 | tab | visible-default | "Teras 5" | FN-M06-5.1.4 |
| EL-M06-S8-028 | badge | visible-default | "5" | FN-M06-5.1.4 |
| EL-M06-S8-029 | tab | visible-default | "Elektif 10" | FN-M06-5.1.4 |
| EL-M06-S8-030 | badge | visible-default | "10" | FN-M06-5.1.4 |
| EL-M06-S8-031 | link | visible-default | "Bahasa Inggeris Teras English Language 773 set subjektif", → /latihan-berstruktur?subject_id=2&scope=spm, fa-globe | FN-M06-5.1.5 |
| EL-M06-S8-032 | card | visible-default | "Bahasa Inggeris" | FN-M06-5.1.5 |
| EL-M06-S8-033 | heading | visible-default | "Bahasa Inggeris" | FN-M06-5.1.5 |
| EL-M06-S8-034 | badge | visible-default | "Teras" | FN-M06-5.1.5 |
| EL-M06-S8-035 | link | visible-default | "Bahasa Melayu Teras Malay Language 559 set subjektif", → /latihan-berstruktur?subject_id=1&scope=spm, fa-book-open | FN-M06-5.1.5 |
| EL-M06-S8-036 | card | visible-default | "Bahasa Melayu" | FN-M06-5.1.5 |
| EL-M06-S8-037 | heading | visible-default | "Bahasa Melayu" | FN-M06-5.1.5 |
| EL-M06-S8-038 | badge | visible-default | "Teras" | FN-M06-5.1.5 |
| EL-M06-S8-039 | link | visible-default | "Matematik Teras Mathematics 298 set subjektif", → /latihan-berstruktur?subject_id=3&scope=spm, fa-calculator | FN-M06-5.1.5 |
| EL-M06-S8-040 | card | visible-default | "Matematik" | FN-M06-5.1.5 |
| EL-M06-S8-041 | heading | visible-default | "Matematik" | FN-M06-5.1.5 |
| EL-M06-S8-042 | badge | visible-default | "Teras" | FN-M06-5.1.5 |
| EL-M06-S8-043 | link | visible-default | "Sains Teras Science 204 set subjektif", → /latihan-berstruktur?subject_id=4&scope=spm, fa-beaker | FN-M06-5.1.5 |
| EL-M06-S8-044 | card | visible-default | "Sains" | FN-M06-5.1.5 |
| EL-M06-S8-045 | heading | visible-default | "Sains" | FN-M06-5.1.5 |
| EL-M06-S8-046 | badge | visible-default | "Teras" | FN-M06-5.1.5 |
| EL-M06-S8-047 | link | visible-default | "Sejarah Teras History 328 set subjektif", → /latihan-berstruktur?subject_id=5&scope=spm, fa-clock | FN-M06-5.1.5 |
| EL-M06-S8-048 | card | visible-default | "Sejarah" | FN-M06-5.1.5 |
| EL-M06-S8-049 | heading | visible-default | "Sejarah" | FN-M06-5.1.5 |
| EL-M06-S8-050 | badge | visible-default | "Teras" | FN-M06-5.1.5 |
| EL-M06-S8-051 | link | visible-default | "Biologi Elektif Biology 217 set subjektif", → /latihan-berstruktur?subject_id=11&scope=spm, fa-leaf | FN-M06-5.1.5 |
| EL-M06-S8-052 | card | visible-default | "Biologi" | FN-M06-5.1.5 |
| EL-M06-S8-053 | heading | visible-default | "Biologi" | FN-M06-5.1.5 |
| EL-M06-S8-054 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-055 | link | visible-default | "Ekonomi Elektif Economics 42 set subjektif", → /latihan-berstruktur?subject_id=22&scope=spm, fa-trending-up | FN-M06-5.1.5 |
| EL-M06-S8-056 | card | visible-default | "Ekonomi" | FN-M06-5.1.5 |
| EL-M06-S8-057 | heading | visible-default | "Ekonomi" | FN-M06-5.1.5 |
| EL-M06-S8-058 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-059 | link | visible-default | "Fizik Elektif Physics 246 set subjektif", → /latihan-berstruktur?subject_id=9&scope=spm, fa-zap | FN-M06-5.1.5 |
| EL-M06-S8-060 | card | visible-default | "Fizik" | FN-M06-5.1.5 |
| EL-M06-S8-061 | heading | visible-default | "Fizik" | FN-M06-5.1.5 |
| EL-M06-S8-062 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-063 | link | visible-default | "Geografi Elektif Geography 21 set subjektif", → /latihan-berstruktur?subject_id=12&scope=spm, fa-map | FN-M06-5.1.5 |
| EL-M06-S8-064 | card | visible-default | "Geografi" | FN-M06-5.1.5 |
| EL-M06-S8-065 | heading | visible-default | "Geografi" | FN-M06-5.1.5 |
| EL-M06-S8-066 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-067 | link | visible-default | "Kimia Elektif Chemistry 232 set subjektif", → /latihan-berstruktur?subject_id=10&scope=spm, fa-flask-round | FN-M06-5.1.5 |
| EL-M06-S8-068 | card | visible-default | "Kimia" | FN-M06-5.1.5 |
| EL-M06-S8-069 | heading | visible-default | "Kimia" | FN-M06-5.1.5 |
| EL-M06-S8-070 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-071 | link | visible-default | "Matematik Tambahan Elektif Additional Mathematics 256 set subjektif", → /latihan-berstruktur?subject_id=8&scope=spm, fa-variable | FN-M06-5.1.5 |
| EL-M06-S8-072 | card | visible-default | "Matematik Tambahan" | FN-M06-5.1.5 |
| EL-M06-S8-073 | heading | visible-default | "Matematik Tambahan" | FN-M06-5.1.5 |
| EL-M06-S8-074 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-075 | link | visible-default | "Perniagaan Elektif Business Studies 763 set subjektif", → /latihan-berstruktur?subject_id=23&scope=spm, fa-briefcase | FN-M06-5.1.5 |
| EL-M06-S8-076 | card | visible-default | "Perniagaan" | FN-M06-5.1.5 |
| EL-M06-S8-077 | heading | visible-default | "Perniagaan" | FN-M06-5.1.5 |
| EL-M06-S8-078 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-079 | link | visible-default | "Prinsip Perakaunan Elektif Principles of Accounting 76 set subjektif", → /latihan-berstruktur?subject_id=21&scope=spm, fa-receipt | FN-M06-5.1.5 |
| EL-M06-S8-080 | card | visible-default | "Prinsip Perakaunan" | FN-M06-5.1.5 |
| EL-M06-S8-081 | heading | visible-default | "Prinsip Perakaunan" | FN-M06-5.1.5 |
| EL-M06-S8-082 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-083 | link | visible-default | "Sains Komputer Elektif Computer Science 22 set subjektif", → /latihan-berstruktur?subject_id=17&scope=spm, fa-monitor | FN-M06-5.1.5 |
| EL-M06-S8-084 | card | visible-default | "Sains Komputer" | FN-M06-5.1.5 |
| EL-M06-S8-085 | heading | visible-default | "Sains Komputer" | FN-M06-5.1.5 |
| EL-M06-S8-086 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-087 | link | visible-default | "Tasawwur Islam Elektif Islamic Worldview 22 set subjektif", → /latihan-berstruktur?subject_id=25&scope=spm, fa-fas fa-mosque | FN-M06-5.1.5 |
| EL-M06-S8-088 | card | visible-default | "Tasawwur Islam" | FN-M06-5.1.5 |
| EL-M06-S8-089 | heading | visible-default | "Tasawwur Islam" | FN-M06-5.1.5 |
| EL-M06-S8-090 | alert | visible-default | "Elektif" | FN-M06-5.1.5 |
| EL-M06-S8-091 | link | conditional | "Bahasa Inggeris Teras English Language 773 set subjektif", → /latihan-berstruktur?subject_id=2&scope=spm, fa-globe | FN-M06-5.1.6 |
| EL-M06-S8-092 | card | conditional | "Bahasa Inggeris" | FN-M06-5.1.6 |
| EL-M06-S8-093 | heading | conditional | "Bahasa Inggeris" | FN-M06-5.1.6 |
| EL-M06-S8-094 | badge | conditional | "Teras" | FN-M06-5.1.6 |
| EL-M06-S8-095 | link | conditional | "Bahasa Melayu Teras Malay Language 559 set subjektif", → /latihan-berstruktur?subject_id=1&scope=spm, fa-book-open | FN-M06-5.1.6 |
| EL-M06-S8-096 | card | conditional | "Bahasa Melayu" | FN-M06-5.1.6 |
| EL-M06-S8-097 | heading | conditional | "Bahasa Melayu" | FN-M06-5.1.6 |
| EL-M06-S8-098 | badge | conditional | "Teras" | FN-M06-5.1.6 |
| EL-M06-S8-099 | link | conditional | "Matematik Teras Mathematics 298 set subjektif", → /latihan-berstruktur?subject_id=3&scope=spm, fa-calculator | FN-M06-5.1.6 |
| EL-M06-S8-100 | card | conditional | "Matematik" | FN-M06-5.1.6 |
| EL-M06-S8-101 | heading | conditional | "Matematik" | FN-M06-5.1.6 |
| EL-M06-S8-102 | badge | conditional | "Teras" | FN-M06-5.1.6 |
| EL-M06-S8-103 | link | conditional | "Sains Teras Science 204 set subjektif", → /latihan-berstruktur?subject_id=4&scope=spm, fa-beaker | FN-M06-5.1.6 |
| EL-M06-S8-104 | card | conditional | "Sains" | FN-M06-5.1.6 |
| EL-M06-S8-105 | heading | conditional | "Sains" | FN-M06-5.1.6 |
| EL-M06-S8-106 | badge | conditional | "Teras" | FN-M06-5.1.6 |
| EL-M06-S8-107 | link | conditional | "Sejarah Teras History 328 set subjektif", → /latihan-berstruktur?subject_id=5&scope=spm, fa-clock | FN-M06-5.1.6 |
| EL-M06-S8-108 | card | conditional | "Sejarah" | FN-M06-5.1.6 |
| EL-M06-S8-109 | heading | conditional | "Sejarah" | FN-M06-5.1.6 |
| EL-M06-S8-110 | badge | conditional | "Teras" | FN-M06-5.1.6 |
| EL-M06-S8-111 | link | conditional | "Biologi Elektif Biology 217 set subjektif", → /latihan-berstruktur?subject_id=11&scope=spm, fa-leaf | FN-M06-5.1.6 |
| EL-M06-S8-112 | card | conditional | "Biologi" | FN-M06-5.1.6 |
| EL-M06-S8-113 | heading | conditional | "Biologi" | FN-M06-5.1.6 |
| EL-M06-S8-114 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-115 | link | conditional | "Ekonomi Elektif Economics 42 set subjektif", → /latihan-berstruktur?subject_id=22&scope=spm, fa-trending-up | FN-M06-5.1.6 |
| EL-M06-S8-116 | card | conditional | "Ekonomi" | FN-M06-5.1.6 |
| EL-M06-S8-117 | heading | conditional | "Ekonomi" | FN-M06-5.1.6 |
| EL-M06-S8-118 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-119 | link | conditional | "Fizik Elektif Physics 246 set subjektif", → /latihan-berstruktur?subject_id=9&scope=spm, fa-zap | FN-M06-5.1.6 |
| EL-M06-S8-120 | card | conditional | "Fizik" | FN-M06-5.1.6 |
| EL-M06-S8-121 | heading | conditional | "Fizik" | FN-M06-5.1.6 |
| EL-M06-S8-122 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-123 | link | conditional | "Geografi Elektif Geography 21 set subjektif", → /latihan-berstruktur?subject_id=12&scope=spm, fa-map | FN-M06-5.1.6 |
| EL-M06-S8-124 | card | conditional | "Geografi" | FN-M06-5.1.6 |
| EL-M06-S8-125 | heading | conditional | "Geografi" | FN-M06-5.1.6 |
| EL-M06-S8-126 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-127 | link | conditional | "Kimia Elektif Chemistry 232 set subjektif", → /latihan-berstruktur?subject_id=10&scope=spm, fa-flask-round | FN-M06-5.1.6 |
| EL-M06-S8-128 | card | conditional | "Kimia" | FN-M06-5.1.6 |
| EL-M06-S8-129 | heading | conditional | "Kimia" | FN-M06-5.1.6 |
| EL-M06-S8-130 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-131 | link | conditional | "Matematik Tambahan Elektif Additional Mathematics 256 set subjektif", → /latihan-berstruktur?subject_id=8&scope=spm, fa-variable | FN-M06-5.1.6 |
| EL-M06-S8-132 | card | conditional | "Matematik Tambahan" | FN-M06-5.1.6 |
| EL-M06-S8-133 | heading | conditional | "Matematik Tambahan" | FN-M06-5.1.6 |
| EL-M06-S8-134 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-135 | link | conditional | "Perniagaan Elektif Business Studies 763 set subjektif", → /latihan-berstruktur?subject_id=23&scope=spm, fa-briefcase | FN-M06-5.1.6 |
| EL-M06-S8-136 | card | conditional | "Perniagaan" | FN-M06-5.1.6 |
| EL-M06-S8-137 | heading | conditional | "Perniagaan" | FN-M06-5.1.6 |
| EL-M06-S8-138 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-139 | link | conditional | "Prinsip Perakaunan Elektif Principles of Accounting 76 set subjektif", → /latihan-berstruktur?subject_id=21&scope=spm, fa-receipt | FN-M06-5.1.6 |
| EL-M06-S8-140 | card | conditional | "Prinsip Perakaunan" | FN-M06-5.1.6 |
| EL-M06-S8-141 | heading | conditional | "Prinsip Perakaunan" | FN-M06-5.1.6 |
| EL-M06-S8-142 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-143 | link | conditional | "Sains Komputer Elektif Computer Science 22 set subjektif", → /latihan-berstruktur?subject_id=17&scope=spm, fa-monitor | FN-M06-5.1.6 |
| EL-M06-S8-144 | card | conditional | "Sains Komputer" | FN-M06-5.1.6 |
| EL-M06-S8-145 | heading | conditional | "Sains Komputer" | FN-M06-5.1.6 |
| EL-M06-S8-146 | alert | conditional | "Elektif" | FN-M06-5.1.6 |
| EL-M06-S8-147 | link | conditional | "Tasawwur Islam Elektif Islamic Worldview 22 set subjektif", → /latihan-berstruktur?subject_id=25&scope=spm, fa-fas fa-mosque | FN-M06-5.1.6 |
| EL-M06-S8-148 | card | conditional | "Tasawwur Islam" | FN-M06-5.1.6 |
| EL-M06-S8-149 | heading | conditional | "Tasawwur Islam" | FN-M06-5.1.6 |
| EL-M06-S8-150 | alert | conditional | "Elektif" | FN-M06-5.1.6 |

#### S9 — `/latihan-berstruktur?subject_id={id}&scope=spm` (125 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S9-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S9-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S9-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S9-004 | link | visible-default | "Kembali ke Subjektif SPM", → /spm/subjektif, fa-arrow-left | FN-M06-5.2.1 |
| EL-M06-S9-005 | heading | visible-default | "Subjektif SPM" | FN-M06-5.2.1 |
| EL-M06-S9-006 | text | visible-default | "Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa" | FN-M06-5.2.1 |
| EL-M06-S9-007 | card | visible-default | "Subjek" | FN-M06-5.2.2 |
| EL-M06-S9-008 | form | visible-default | form | FN-M06-5.2.2 |
| EL-M06-S9-009 | hidden-field | hidden-only | name=scope | FN-M06-5.2.2 |
| EL-M06-S9-010 | label | visible-default | "Subjek" | FN-M06-5.2.2 |
| EL-M06-S9-011 | select | visible-default | name=subject_id | FN-M06-5.2.2 |
| EL-M06-S9-012 | label | visible-default | "Aras KBAT" | FN-M06-5.2.2 |
| EL-M06-S9-013 | select | visible-default | name=kbat_level | FN-M06-5.2.2 |
| EL-M06-S9-014 | button | visible-default | "Cari", fa-search | FN-M06-5.2.2 |
| EL-M06-S9-015 | card | visible-default | "Matematik" | FN-M06-5.2.3 |
| EL-M06-S9-016 | badge | visible-default | "Matematik" | FN-M06-5.2.3 |
| EL-M06-S9-017 | text | visible-default | "LOTS 1" | FN-M06-5.2.3 |
| EL-M06-S9-018 | badge | visible-default | "4m" | FN-M06-5.2.3 |
| EL-M06-S9-019 | badge | visible-default | "Tingkatan 4" | FN-M06-5.2.3 |
| EL-M06-S9-020 | badge | visible-default | "Trial" | FN-M06-5.2.3 |
| EL-M06-S9-021 | text | visible-default | "Rajah 2 menunjukkan gambar rajah Venn bagi set semesta, ξ, set P, set …" | FN-M06-5.2.3 |
| EL-M06-S9-022 | text | visible-default | "2 bahagian · 4 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-023 | text | visible-default | "<person> · <school>", fa-user-pen | FN-M06-5.2.3 |
| EL-M06-S9-024 | text | visible-default | "2 soalan · Tingkatan 4", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-025 | link | visible-default | "Mula", → /latihan-berstruktur/2510/jawab?scope=spm, fa-arrow-right | FN-M06-5.2.4 |
| EL-M06-S9-026 | card | visible-default | "Matematik" | FN-M06-5.2.3 |
| EL-M06-S9-027 | badge | visible-default | "Matematik" | FN-M06-5.2.3 |
| EL-M06-S9-028 | text | visible-default | "LOTS 1" | FN-M06-5.2.3 |
| EL-M06-S9-029 | badge | visible-default | "6m" | FN-M06-5.2.3 |
| EL-M06-S9-030 | badge | visible-default | "Tingkatan 4" | FN-M06-5.2.3 |
| EL-M06-S9-031 | badge | visible-default | "Trial" | FN-M06-5.2.3 |
| EL-M06-S9-032 | text | visible-default | "Rajah 5 menunjukkan graf laju-masa bagi gerakan kereta Danial untuk te…" | FN-M06-5.2.3 |
| EL-M06-S9-033 | text | visible-default | "3 bahagian · 6 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-034 | text | visible-default | "<person> · <school>", fa-user-pen | FN-M06-5.2.3 |
| EL-M06-S9-035 | text | visible-default | "3 soalan · Tingkatan 4", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-036 | link | visible-default | "Mula", → /latihan-berstruktur/2511/jawab?scope=spm, fa-arrow-right | FN-M06-5.2.4 |
| EL-M06-S9-037 | card | visible-default | "Matematik" | FN-M06-5.2.3 |
| EL-M06-S9-038 | badge | visible-default | "Matematik" | FN-M06-5.2.3 |
| EL-M06-S9-039 | text | visible-default | "LOTS 1" | FN-M06-5.2.3 |
| EL-M06-S9-040 | badge | visible-default | "4m" | FN-M06-5.2.3 |
| EL-M06-S9-041 | badge | visible-default | "Tingkatan 4" | FN-M06-5.2.3 |
| EL-M06-S9-042 | badge | visible-default | "Trial" | FN-M06-5.2.3 |
| EL-M06-S9-043 | text | visible-default | "Rajah 5 menunjukkan graf jarak-masa pergerakan sebuah lori dalam tempo…" | FN-M06-5.2.3 |
| EL-M06-S9-044 | text | visible-default | "3 bahagian · 4 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-045 | text | visible-default | "<person> · <school>", fa-user-pen | FN-M06-5.2.3 |
| EL-M06-S9-046 | text | visible-default | "3 soalan · Tingkatan 4", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-047 | link | visible-default | "Mula", → /latihan-berstruktur/2505/jawab?scope=spm, fa-arrow-right | FN-M06-5.2.4 |
| EL-M06-S9-048 | text | conditional | "« Previous" | FN-M06-5.2.5 |
| EL-M06-S9-049 | pagination | conditional | "Next »", → /latihan-berstruktur?subject_id=3&scope=spm&page=2 | FN-M06-5.2.5 |
| EL-M06-S9-050 | text | visible-default | "Showing to of results" | FN-M06-5.2.5 |
| EL-M06-S9-051 | text | visible-default | "1" | FN-M06-5.2.5 |
| EL-M06-S9-052 | text | visible-default | "20" | FN-M06-5.2.5 |
| EL-M06-S9-053 | text | visible-default | "298" | FN-M06-5.2.5 |
| EL-M06-S9-054 | text | visible-default | "1" | FN-M06-5.2.5 |
| EL-M06-S9-055 | pagination | visible-default | "2", → /latihan-berstruktur?subject_id=3&scope=spm&page=2 | FN-M06-5.2.5 |
| EL-M06-S9-056 | pagination | visible-default | "3", → /latihan-berstruktur?subject_id=3&scope=spm&page=3 | FN-M06-5.2.5 |
| EL-M06-S9-057 | pagination | visible-default | "4", → /latihan-berstruktur?subject_id=3&scope=spm&page=4 | FN-M06-5.2.5 |
| EL-M06-S9-058 | pagination | visible-default | "5", → /latihan-berstruktur?subject_id=3&scope=spm&page=5 | FN-M06-5.2.5 |
| EL-M06-S9-059 | pagination | visible-default | "6", → /latihan-berstruktur?subject_id=3&scope=spm&page=6 | FN-M06-5.2.5 |
| EL-M06-S9-060 | pagination | visible-default | "7", → /latihan-berstruktur?subject_id=3&scope=spm&page=7 | FN-M06-5.2.5 |
| EL-M06-S9-061 | pagination | visible-default | "8", → /latihan-berstruktur?subject_id=3&scope=spm&page=8 | FN-M06-5.2.5 |
| EL-M06-S9-062 | pagination | visible-default | "9", → /latihan-berstruktur?subject_id=3&scope=spm&page=9 | FN-M06-5.2.5 |
| EL-M06-S9-063 | pagination | visible-default | "10", → /latihan-berstruktur?subject_id=3&scope=spm&page=10 | FN-M06-5.2.5 |
| EL-M06-S9-064 | text | visible-default | "..." | FN-M06-5.2.5 |
| EL-M06-S9-065 | pagination | visible-default | "14", → /latihan-berstruktur?subject_id=3&scope=spm&page=14 | FN-M06-5.2.5 |
| EL-M06-S9-066 | pagination | visible-default | "15", → /latihan-berstruktur?subject_id=3&scope=spm&page=15 | FN-M06-5.2.5 |
| EL-M06-S9-067 | pagination | visible-default | → /latihan-berstruktur?subject_id=3&scope=spm&page=2, svg | FN-M06-5.2.5 |
| EL-M06-S9-068 | card | conditional | "Perniagaan" | FN-M06-5.2.3 |
| EL-M06-S9-069 | badge | conditional | "Perniagaan" | FN-M06-5.2.3 |
| EL-M06-S9-070 | text | conditional | "MOTS 3" | FN-M06-5.2.3 |
| EL-M06-S9-071 | badge | conditional | "8m" | FN-M06-5.2.3 |
| EL-M06-S9-072 | badge | conditional | "Tingkatan 5" | FN-M06-5.2.3 |
| EL-M06-S9-073 | text | conditional | "Soalan Oleh: Cikgu Rossa Kertas 2 Bab 7 Tingkatan 5 (2019) Item 1 Tera…" | FN-M06-5.2.3 |
| EL-M06-S9-074 | text | conditional | "Merancang Pengendalian Perniagaan", fa-book-open | FN-M06-5.2.3 |
| EL-M06-S9-075 | text | conditional | "1 bahagian · 8 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-076 | text | conditional | "1 soalan · Tingkatan 5", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-077 | card | conditional | "Perniagaan" | FN-M06-5.2.3 |
| EL-M06-S9-078 | badge | conditional | "Perniagaan" | FN-M06-5.2.3 |
| EL-M06-S9-079 | text | conditional | "MOTS 3" | FN-M06-5.2.3 |
| EL-M06-S9-080 | badge | conditional | "7m" | FN-M06-5.2.3 |
| EL-M06-S9-081 | badge | conditional | "Tingkatan 5" | FN-M06-5.2.3 |
| EL-M06-S9-082 | text | conditional | "Soalan Oleh: Cikgu Rossa Kertas 2 Bab 7 Tingkatan 5 (2019) Item 2 b) A…" | FN-M06-5.2.3 |
| EL-M06-S9-083 | text | conditional | "Merancang Pengendalian Perniagaan", fa-book-open | FN-M06-5.2.3 |
| EL-M06-S9-084 | text | conditional | "1 bahagian · 7 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-085 | text | conditional | "1 soalan · Tingkatan 5", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-086 | card | conditional | "Perniagaan" | FN-M06-5.2.3 |
| EL-M06-S9-087 | badge | conditional | "Perniagaan" | FN-M06-5.2.3 |
| EL-M06-S9-088 | text | conditional | "MOTS 3" | FN-M06-5.2.3 |
| EL-M06-S9-089 | badge | conditional | "Tingkatan 5" | FN-M06-5.2.3 |
| EL-M06-S9-090 | text | conditional | "Soalan Oleh: Cikgu Rossa Kertas 2 Bab 7 Tingkatan 5 (2019) Item 3 (c) …" | FN-M06-5.2.3 |
| EL-M06-S9-091 | text | conditional | "Merancang Pengendalian Perniagaan", fa-book-open | FN-M06-5.2.3 |
| EL-M06-S9-092 | text | conditional | "1 bahagian · 6 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-093 | text | conditional | "1 soalan · Tingkatan 5", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-094 | empty-state | conditional | "Tiada soalan berstruktur buat masa ini" | FN-M06-5.2.6 |
| EL-M06-S9-095 | text | conditional | "Soalan akan ditambah oleh guru dan admin" | FN-M06-5.2.6 |
| EL-M06-S9-096 | text | conditional | "Dari rumah Ahmad (R), masjid (M) berada pada bearing 300° dan jarak 50…" | FN-M06-5.2.3 |
| EL-M06-S9-097 | text | conditional | "3 bahagian · 8 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-098 | text | conditional | "3 soalan · Tingkatan 5", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-099 | text | conditional | "HOTS 5" | FN-M06-5.2.3 |
| EL-M06-S9-100 | badge | conditional | "9m" | FN-M06-5.2.3 |
| EL-M06-S9-101 | text | conditional | "Sebuah helikopter berlepas dari pangkalan A dan terbang pada bearing 0…" | FN-M06-5.2.3 |
| EL-M06-S9-102 | text | conditional | "3 bahagian · 9 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-103 | text | conditional | "3 soalan · Tingkatan 5", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-104 | text | conditional | "Tiga buah bandar P, Q dan R terletak pada satah mengufuk. Bearing Q da…" | FN-M06-5.2.3 |
| EL-M06-S9-105 | text | conditional | "3 bahagian · 7 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-106 | text | conditional | "3 soalan · Tingkatan 5", fa-list-ol | FN-M06-5.2.3 |
| EL-M06-S9-107 | pagination | hidden-only | "« Previous", → /latihan-berstruktur?subject_id=3&scope=spm&page=1 | FN-M06-5.2.5 |
| EL-M06-S9-108 | pagination | conditional | → /latihan-berstruktur?subject_id=3&scope=spm&page=3, svg | FN-M06-5.2.5 |
| EL-M06-S9-109 | card | conditional | "Sains Komputer" | FN-M06-5.2.3 |
| EL-M06-S9-110 | badge | conditional | "Sains Komputer" | FN-M06-5.2.3 |
| EL-M06-S9-111 | badge | conditional | "20m" | FN-M06-5.2.3 |
| EL-M06-S9-112 | text | conditional | "Soalan 4 berkaitan Projek Laluan Rel Pantai Timur (ECRL), eksternaliti…" | FN-M06-5.2.3 |
| EL-M06-S9-113 | text | conditional | "3 bahagian · 20 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-114 | card | conditional | "Sains Komputer" | FN-M06-5.2.3 |
| EL-M06-S9-115 | badge | conditional | "Sains Komputer" | FN-M06-5.2.3 |
| EL-M06-S9-116 | text | conditional | "HOTS 5" | FN-M06-5.2.3 |
| EL-M06-S9-117 | badge | conditional | "20m" | FN-M06-5.2.3 |
| EL-M06-S9-118 | text | conditional | "Soalan 5 berkaitan penyasaran subsidi diesel dan program BUDI MADANI k…" | FN-M06-5.2.3 |
| EL-M06-S9-119 | text | conditional | "3 bahagian · 20 markah", fa-layer-group | FN-M06-5.2.3 |
| EL-M06-S9-120 | card | conditional | "Sains Komputer" | FN-M06-5.2.3 |
| EL-M06-S9-121 | badge | conditional | "Sains Komputer" | FN-M06-5.2.3 |
| EL-M06-S9-122 | text | conditional | "HOTS 5" | FN-M06-5.2.3 |
| EL-M06-S9-123 | badge | conditional | "20m" | FN-M06-5.2.3 |
| EL-M06-S9-124 | text | conditional | "Soalan 6 berkaitan perubahan Nisbah Rizab Berkanun (SRR) oleh Bank Neg…" | FN-M06-5.2.3 |
| EL-M06-S9-125 | text | conditional | "3 bahagian · 20 markah", fa-layer-group | FN-M06-5.2.3 |

#### S10 — `/spm/history` (49 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S10-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner |
| EL-M06-S10-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner |
| EL-M06-S10-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner |
| EL-M06-S10-004 | link | visible-default | "Kembali ke Mod SPM", → /spm, fa-arrow-left | FN-M06-8.1.1 |
| EL-M06-S10-005 | heading | visible-default | "Sejarah Kuiz SPM" | FN-M06-8.1.1 |
| EL-M06-S10-006 | card | visible-default | "Sesi Kuiz" | FN-M06-8.1.2 |
| EL-M06-S10-007 | text | visible-default | "4" | FN-M06-8.1.2 |
| EL-M06-S10-008 | text | visible-default | "Sesi Kuiz" | FN-M06-8.1.2 |
| EL-M06-S10-009 | card | visible-default | "Purata Ketepatan" | FN-M06-8.1.2 |
| EL-M06-S10-010 | text | visible-default | "21.8%" | FN-M06-8.1.2 |
| EL-M06-S10-011 | text | visible-default | "Purata Ketepatan" | FN-M06-8.1.2 |
| EL-M06-S10-012 | card | visible-default | "Jumlah Syiling" | FN-M06-8.1.2 |
| EL-M06-S10-013 | text | visible-default | "26" | FN-M06-8.1.2 |
| EL-M06-S10-014 | text | visible-default | "Jumlah Syiling" | FN-M06-8.1.2 |
| EL-M06-S10-015 | card | visible-default | "Soalan Dijawab" | FN-M06-8.1.2 |
| EL-M06-S10-016 | text | visible-default | "84" | FN-M06-8.1.2 |
| EL-M06-S10-017 | text | visible-default | "Soalan Dijawab" | FN-M06-8.1.2 |
| EL-M06-S10-018 | link | visible-default | "Semua", → /spm/history | FN-M06-8.1.3 |
| EL-M06-S10-019 | filter | visible-default | "Tahun Lepas", → /spm/history?type=past_year, fa-scroll | FN-M06-8.1.3 |
| EL-M06-S10-020 | filter | visible-default | "Latih Tubi", → /spm/history?type=latih_tubi, fa-brain | FN-M06-8.1.3 |
| EL-M06-S10-021 | filter | visible-default | "Tracking A", → /spm/history?type=ramalan, fa-hat-wizard | FN-M06-8.1.3 |
| EL-M06-S10-022 | card | visible-default | "0%" | FN-M06-8.1.4 |
| EL-M06-S10-023 | text | visible-default | "0%" | FN-M06-8.1.4 |
| EL-M06-S10-024 | badge | visible-default | "Tahun Lepas" | FN-M06-8.1.4 |
| EL-M06-S10-025 | text | visible-default | "0/5 betul" | FN-M06-8.1.4 |
| EL-M06-S10-026 | text | visible-default | "19 May 2026, 03:49 AM · 0m 14s" | FN-M06-8.1.4 |
| EL-M06-S10-027 | text | visible-default | "+0 🪙" | FN-M06-8.1.4 |
| EL-M06-S10-028 | card | visible-default | "20%" | FN-M06-8.1.4 |
| EL-M06-S10-029 | text | visible-default | "20%" | FN-M06-8.1.4 |
| EL-M06-S10-030 | badge | visible-default | "Tahun Lepas" | FN-M06-8.1.4 |
| EL-M06-S10-031 | text | visible-default | "1/5 betul" | FN-M06-8.1.4 |
| EL-M06-S10-032 | text | visible-default | "19 May 2026, 03:26 AM · 0m 36s" | FN-M06-8.1.4 |
| EL-M06-S10-033 | text | visible-default | "+1 🪙" | FN-M06-8.1.4 |
| EL-M06-S10-034 | card | visible-default | "32%" | FN-M06-8.1.4 |
| EL-M06-S10-035 | text | visible-default | "32%" | FN-M06-8.1.4 |
| EL-M06-S10-036 | badge | visible-default | "Latih Tubi" | FN-M06-8.1.4 |
| EL-M06-S10-037 | text | visible-default | "11/34 betul" | FN-M06-8.1.4 |
| EL-M06-S10-038 | text | visible-default | "11 May 2026, 02:27 PM · 1m 45s" | FN-M06-8.1.4 |
| EL-M06-S10-039 | text | visible-default | "+11 🪙" | FN-M06-8.1.4 |
| EL-M06-S10-040 | card | visible-default | "35%" | FN-M06-8.1.4 |
| EL-M06-S10-041 | text | visible-default | "35%" | FN-M06-8.1.4 |
| EL-M06-S10-042 | badge | visible-default | "Latih Tubi" | FN-M06-8.1.4 |
| EL-M06-S10-043 | text | visible-default | "14/40 betul" | FN-M06-8.1.4 |
| EL-M06-S10-044 | text | visible-default | "11 May 2026, 02:22 PM · 2m 11s" | FN-M06-8.1.4 |
| EL-M06-S10-045 | text | visible-default | "+14 🪙" | FN-M06-8.1.4 |
| EL-M06-S10-046 | card | conditional | "Belum Ada Sejarah" | FN-M06-8.1.5 |
| EL-M06-S10-047 | heading | conditional | "Belum Ada Sejarah" | FN-M06-8.1.5 |
| EL-M06-S10-048 | text | conditional | "Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini." | FN-M06-8.1.5 |
| EL-M06-S10-049 | link | conditional | "Mula Kuiz SPM", → /spm, fa-play-circle | FN-M06-8.1.5 |

#### S11 — `/spm-mock` (31 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S11-001 | heading | visible-default | "📝 SPM Mock Exam" | FN-M06-6.1.1 |
| EL-M06-S11-002 | text | visible-default | "Mock SPM penuh dengan timer + auto-grade + weakness analysis. Boleh at…" | FN-M06-6.1.1 |
| EL-M06-S11-003 | text | visible-default | "⭐ Maestro SPM Untuk Anda" | FN-M06-6.1.2 |
| EL-M06-S11-004 | text | visible-default | "Cikgu pakar yg dah bantu pelajar score A+ — tonton video mereka sebelu…" | FN-M06-6.1.2 |
| EL-M06-S11-005 | link | visible-default | "<in> <person> Maestro Matematik · 22 tahun ajar pelajar B40 capai cita…", → /bilik-duta/{slug} | FN-M06-1.4.1 |
| EL-M06-S11-006 | heading | visible-default | "<person>" | FN-M06-1.4.1 |
| EL-M06-S11-007 | badge | visible-default | "🥇 Duta Bintang" | FN-M06-1.4.1 |
| EL-M06-S11-008 | badge | visible-default | "📚 Matematik" | FN-M06-1.4.1 |
| EL-M06-S11-009 | badge | visible-default | "📍 Johor" | FN-M06-1.4.1 |
| EL-M06-S11-010 | badge | visible-default | "⭐ 4.92" | FN-M06-1.4.1 |
| EL-M06-S11-011 | text | visible-default | "⚠️ Pastikan masa anda cukup. Setelah klik "Mula", timer akan jalan dan…" | FN-M06-6.1.3 |
| EL-M06-S11-012 | text | visible-default | "Persediaan sebelum mula:" | FN-M06-6.1.3 |
| EL-M06-S11-013 | form | visible-default | form | FN-M06-6.1.4 |
| EL-M06-S11-014 | hidden-field | hidden-only | name=_token | FN-M06-6.1.4 |
| EL-M06-S11-015 | label | visible-default | "Subjek" | FN-M06-6.1.4 |
| EL-M06-S11-016 | select | visible-default | name=subject | FN-M06-6.1.4 |
| EL-M06-S11-017 | label | visible-default | "Paper" | FN-M06-6.1.4 |
| EL-M06-S11-018 | select | visible-default | name=paper_number | FN-M06-6.1.4 |
| EL-M06-S11-019 | button | visible-default | "🎯 Jana Mock SPM" | FN-M06-6.1.4 |
| EL-M06-S11-020 | heading | visible-default | "📚 Mock Sebelum Ini" | FN-M06-6.1.5 |
| EL-M06-S11-021 | card | visible-default | "Sejarah · Paper 1" | FN-M06-6.1.6 |
| EL-M06-S11-022 | heading | visible-default | "Sejarah · Paper 1" | FN-M06-6.1.6 |
| EL-M06-S11-023 | text | visible-default | "2 bulan yang lepas ·" | FN-M06-6.1.6 |
| EL-M06-S11-024 | text | visible-default | "Belum submit" | FN-M06-6.1.6 |
| EL-M06-S11-025 | text | visible-default | "Belum" | FN-M06-6.1.6 |
| EL-M06-S11-026 | link | visible-default | "Sambung →", → /spm-mock/317 | FN-M06-6.1.6 |
| EL-M06-S11-027 | card | visible-default | "Bahasa Melayu · Paper 1" | FN-M06-6.1.7 |
| EL-M06-S11-028 | heading | visible-default | "Bahasa Melayu · Paper 1" | FN-M06-6.1.7 |
| EL-M06-S11-029 | text | visible-default | "4 bulan yang lepas · Score: 0/30 (0.00%)" | FN-M06-6.1.7 |
| EL-M06-S11-030 | text | visible-default | "G" | FN-M06-6.1.7 |
| EL-M06-S11-031 | link | visible-default | "Lihat →", → /spm-mock/16/result | FN-M06-6.1.7 |

#### S12 — `/spm-mock/{id}/result` (64 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S12-001 | heading | visible-default | "Bahasa Melayu · Paper 1" | FN-M06-6.3.1 |
| EL-M06-S12-002 | text | visible-default | "G" | FN-M06-6.3.1 |
| EL-M06-S12-003 | text | visible-default | "0.00%" | FN-M06-6.3.1 |
| EL-M06-S12-004 | text | visible-default | "0 / 30 markah" | FN-M06-6.3.1 |
| EL-M06-S12-005 | text | visible-default | "🎓 Cikgu Pakar Bahasa Melayu" | FN-M06-6.3.2 |
| EL-M06-S12-006 | text | visible-default | "Lemah dlm topik tertentu? Cikgu pakar ni boleh bantu anda naik ke A+ n…" | FN-M06-6.3.2 |
| EL-M06-S12-007 | link | visible-default | "<in> <person> Pakar Bahasa Melayu SPM · Sasterawan Negeri Johor 2020. …", → /bilik-duta/{slug} | FN-M06-1.4.1 |
| EL-M06-S12-008 | heading | visible-default | "<person>" | FN-M06-1.4.1 |
| EL-M06-S12-009 | badge | visible-default | "🥇 Duta Bintang" | FN-M06-1.4.1 |
| EL-M06-S12-010 | badge | visible-default | "📚 Bahasa Melayu" | FN-M06-1.4.1 |
| EL-M06-S12-011 | badge | visible-default | "📍 Johor" | FN-M06-1.4.1 |
| EL-M06-S12-012 | badge | visible-default | "⭐ 4.88" | FN-M06-1.4.1 |
| EL-M06-S12-013 | card | visible-default | "📉 Topik Lemah — Fokus Belajar Ke Sini" | FN-M06-6.3.3 |
| EL-M06-S12-014 | heading | visible-default | "📉 Topik Lemah — Fokus Belajar Ke Sini" | FN-M06-6.3.3 |
| EL-M06-S12-015 | text | visible-default | "Sastra" | FN-M06-6.3.3 |
| EL-M06-S12-016 | text | visible-default | "9 soalan tersilap" | FN-M06-6.3.3 |
| EL-M06-S12-017 | text | visible-default | "Penulisan" | FN-M06-6.3.3 |
| EL-M06-S12-018 | text | visible-default | "8 soalan tersilap" | FN-M06-6.3.3 |
| EL-M06-S12-019 | text | visible-default | "Sosiobudaya" | FN-M06-6.3.3 |
| EL-M06-S12-020 | text | visible-default | "4 soalan tersilap" | FN-M06-6.3.3 |
| EL-M06-S12-021 | text | visible-default | "Kosa Kata" | FN-M06-6.3.3 |
| EL-M06-S12-022 | text | visible-default | "2 soalan tersilap" | FN-M06-6.3.3 |
| EL-M06-S12-023 | text | visible-default | "Tatabahasa" | FN-M06-6.3.3 |
| EL-M06-S12-024 | text | visible-default | "2 soalan tersilap" | FN-M06-6.3.3 |
| EL-M06-S12-025 | text | visible-default | "💡 Cikgu Alesa cadang anda fokus belajar topik atas dulu. Boleh start …" | FN-M06-6.3.3 |
| EL-M06-S12-026 | link | visible-default | "jana nota ringkas", → /pusat-nota-ringkas | FN-M06-6.3.3 |
| EL-M06-S12-027 | card | visible-default | "📋 Review Setiap Soalan" | FN-M06-6.3.4 |
| EL-M06-S12-028 | heading | visible-default | "📋 Review Setiap Soalan" | FN-M06-6.3.4 |
| EL-M06-S12-029 | text | visible-default | "Soalan 1 · 0/1 markah" | FN-M06-6.3.4 |
| EL-M06-S12-030 | text | visible-default | "✗" | FN-M06-6.3.4 |
| EL-M06-S12-031 | text | visible-default | "Apakah maksud perkataan 'inovatif' dalam konteks sains dan teknologi?" | FN-M06-6.3.4 |
| EL-M06-S12-032 | text | visible-default | "(tiada jawapan)" | FN-M06-6.3.4 |
| EL-M06-S12-033 | text | visible-default | "Anda:" | FN-M06-6.3.4 |
| EL-M06-S12-034 | text | visible-default | "A" | FN-M06-6.3.4 |
| EL-M06-S12-035 | text | visible-default | "Jawapan:" | FN-M06-6.3.4 |
| EL-M06-S12-036 | text | visible-default | "Jawapan betul: A" | FN-M06-6.3.4 |
| EL-M06-S12-037 | text | visible-default | "Soalan 2 · 0/1 markah" | FN-M06-6.3.4 |
| EL-M06-S12-038 | text | visible-default | "✗" | FN-M06-6.3.4 |
| EL-M06-S12-039 | text | visible-default | "Apakah tema utama dalam puisi 'Bumi Bertuah' karya A. Samad Said?" | FN-M06-6.3.4 |
| EL-M06-S12-040 | text | visible-default | "(tiada jawapan)" | FN-M06-6.3.4 |
| EL-M06-S12-041 | text | visible-default | "Anda:" | FN-M06-6.3.4 |
| EL-M06-S12-042 | text | visible-default | "B" | FN-M06-6.3.4 |
| EL-M06-S12-043 | text | visible-default | "Jawapan:" | FN-M06-6.3.4 |
| EL-M06-S12-044 | text | visible-default | "Jawapan betul: B" | FN-M06-6.3.4 |
| EL-M06-S12-045 | text | visible-default | "Soalan 3 · 0/1 markah" | FN-M06-6.3.4 |
| EL-M06-S12-046 | text | visible-default | "✗" | FN-M06-6.3.4 |
| EL-M06-S12-047 | text | visible-default | "Siapakah penulis novel 'Salina'?" | FN-M06-6.3.4 |
| EL-M06-S12-048 | text | visible-default | "(tiada jawapan)" | FN-M06-6.3.4 |
| EL-M06-S12-049 | text | visible-default | "Anda:" | FN-M06-6.3.4 |
| EL-M06-S12-050 | text | visible-default | "A" | FN-M06-6.3.4 |
| EL-M06-S12-051 | text | visible-default | "Jawapan:" | FN-M06-6.3.4 |
| EL-M06-S12-052 | text | visible-default | "Jawapan betul: A" | FN-M06-6.3.4 |
| EL-M06-S12-053 | link | visible-default | "📝 Mock Lain", → /spm-mock | FN-M06-6.3.5 |
| EL-M06-S12-054 | link | visible-default | "📚 Belajar Topik Lemah", → /pusat-nota-ringkas | FN-M06-6.3.5 |
| EL-M06-S12-055 | text | conditional | "404" | FN-M06-1.3.2 |
| EL-M06-S12-056 | text | conditional | "🔍" | FN-M06-1.3.2 |
| EL-M06-S12-057 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M06-1.3.2 |
| EL-M06-S12-058 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungk…" | FN-M06-1.3.2 |
| EL-M06-S12-059 | link | conditional | "Halaman Utama", → / | FN-M06-1.3.2 |
| EL-M06-S12-060 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M06-1.3.2 |
| EL-M06-S12-061 | text | conditional | "PRESTASIPLUS" | FN-M06-1.3.2 |
| EL-M06-S12-062 | link | conditional | "<in> <person> Maestro Matematik · 22 tahun ajar pelajar B40 capai cita…", → /bilik-duta/{slug} | FN-M06-1.4.1 |
| EL-M06-S12-063 | badge | conditional | "📚 Matematik" | FN-M06-1.4.1 |
| EL-M06-S12-064 | badge | conditional | "⭐ 4.92" | FN-M06-1.4.1 |

#### S13 — `/pusat-ai/spm` (21 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-S13-001 | heading | visible-default | "📝 SPM Walkthrough" | FN-M06-7.1.1 |
| EL-M06-S13-002 | text | visible-default | "Snap soalan SPM, AI walk-through step-by-step dengan mark scheme + seb…" | FN-M06-7.1.1 |
| EL-M06-S13-003 | form | visible-default | form | FN-M06-7.1.2 |
| EL-M06-S13-004 | label | visible-default | "Subjek" | FN-M06-7.1.2 |
| EL-M06-S13-005 | select | visible-default | name=subject | FN-M06-7.1.2 |
| EL-M06-S13-006 | label | visible-default | "Tahun (opsyen)" | FN-M06-7.1.2 |
| EL-M06-S13-007 | input | visible-default | name=year | FN-M06-7.1.2 |
| EL-M06-S13-008 | label | visible-default | "Soalan (taip atau snap)" | FN-M06-7.1.2 |
| EL-M06-S13-009 | textarea | visible-default | name=question_text | FN-M06-7.1.2 |
| EL-M06-S13-010 | label | visible-default | "📷 Klik atau drag gambar soalan SPM (auto-extract via AI Vision)" | FN-M06-7.1.3 |
| EL-M06-S13-011 | input | hidden-only | name=image | FN-M06-7.1.3 |
| EL-M06-S13-012 | button | visible-default | "Bagi Walkthrough" | FN-M06-7.1.4 |
| EL-M06-S13-013 | heading | hidden-only | "✨ Walkthrough Cikgu Alesa" | FN-M06-7.1.5 |
| EL-M06-S13-014 | text | visible-default | "🎓 Cikgu Maestro SPM" | FN-M06-7.1.7 |
| EL-M06-S13-015 | text | visible-default | "Setelah baca walkthrough, tonton video penjelasan dari Duta SPM." | FN-M06-7.1.7 |
| EL-M06-S13-016 | link | visible-default | "<in> <person> Maestro Matematik · 22 tahun ajar pelajar B40 capai cita…", → /bilik-duta/{slug} | FN-M06-1.4.1 |
| EL-M06-S13-017 | heading | visible-default | "<person>" | FN-M06-1.4.1 |
| EL-M06-S13-018 | badge | visible-default | "🥇 Duta Bintang" | FN-M06-1.4.1 |
| EL-M06-S13-019 | badge | visible-default | "📚 Matematik" | FN-M06-1.4.1 |
| EL-M06-S13-020 | badge | visible-default | "📍 Johor" | FN-M06-1.4.1 |
| EL-M06-S13-021 | badge | visible-default | "⭐ 4.92" | FN-M06-1.4.1 |

### 6.2 Shell elements (M06-relevant only)

#### SHU — user-portal shell (chrome of S1–S10) — 378 elements, 17 M06-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-SHU-008 | text | visible-default | "SPM" | FN-M06-1.2.1 |
| EL-M06-SHU-009 | link | visible-default | "SPM SPM", → /spm, fa-graduation-cap | FN-M06-1.2.1 |
| EL-M06-SHU-010 | badge | visible-default | "SPM" | FN-M06-1.2.1 |
| EL-M06-SHU-053 | link | visible-default | "SPM Mock Exam", → /spm-mock, fa-file-pen | FN-M06-1.2.3 |
| EL-M06-SHU-136 | heading | visible-default | "Mod SPM" | FN-M06-1.2.4 |
| EL-M06-SHU-137 | text | visible-default | "Selamat datang kembali" | FN-M06-1.2.4 |
| EL-M06-SHU-171 | modal | hidden-only | "SPM" | FN-M06-1.2.1 |
| EL-M06-SHU-172 | text | hidden-only | "SPM" | FN-M06-1.2.1 |
| EL-M06-SHU-173 | link | hidden-only | "SPM SPM", → /spm, fa-graduation-cap | FN-M06-1.2.1 |
| EL-M06-SHU-174 | badge | hidden-only | "SPM" | FN-M06-1.2.1 |
| EL-M06-SHU-338 | link | conditional | "SPM", → /spm, fa-graduation-cap | FN-M06-1.2.2 |
| EL-M06-SHU-373 | heading | conditional | "Databank Soalan SPM" | FN-M06-1.2.4 |
| EL-M06-SHU-374 | heading | conditional | "Latih Tubi SPM" | FN-M06-1.2.4 |
| EL-M06-SHU-375 | heading | conditional | "Dashboard" | FN-M06-1.2.4 |
| EL-M06-SHU-376 | heading | conditional | "Tracking A SPM" | FN-M06-1.2.4 |
| EL-M06-SHU-377 | heading | conditional | "Subjektif SPM" | FN-M06-1.2.4 |
| EL-M06-SHU-378 | heading | conditional | "Sejarah Kuiz SPM" | FN-M06-1.2.4 |

Excluded SHU elements (prefix EL-M06-SHU-): 361 elements — IDs 001–007, 011–052, 054–135, 138–170, 175–337, 339–372: **global shell (docs/discovery/00-global-ui.md) / M23 and the module each link targets (per URL in `_crawl.json`)**. IDs 001–003 are the shell logo/brand (→ /dashboard, logo image, "Platform Latih Tubi Nasional"): global shell, not the M16 banner.

#### SHA — admin panel shell (chrome of S11–S13 (live layout)) — 196 elements, 15 M06-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M06-SHA-045 | toggle | visible-default | "SPM", fa-graduation-cap | FN-M06-1.2.5 |
| EL-M06-SHA-046 | link | hidden-only | "Databank Soalan", → /spm/tahun-lepas, fa-database | FN-M06-1.2.5 |
| EL-M06-SHA-047 | link | hidden-only | "Latih Tubi", → /spm/latih-tubi, fa-bolt | FN-M06-1.2.5 |
| EL-M06-SHA-048 | link | hidden-only | "Tracking A", → /spm/ramalan, fa-crosshairs | FN-M06-1.2.5 |
| EL-M06-SHA-049 | link | hidden-only | "Subjektif", → /spm/subjektif, fa-pen-fancy | FN-M06-1.2.5 |
| EL-M06-SHA-098 | link | visible-default | "SPM Walkthrough", → /pusat-ai/spm, fa-pen-to-square | FN-M06-1.2.7 |
| EL-M06-SHA-109 | link | visible-default | "SPM Mock Exam", → /spm-mock, fa-file-pen | FN-M06-1.2.7 |
| EL-M06-SHA-118 | heading | visible-default | "Dashboard" | FN-M06-1.2.4 |
| EL-M06-SHA-119 | text | visible-default | "Selamat datang, Admin" | FN-M06-1.2.4 |
| EL-M06-SHA-141 | card | hidden-only | "SPM" | FN-M06-1.2.6 |
| EL-M06-SHA-146 | text | hidden-only | "SPM" | FN-M06-1.2.6 |
| EL-M06-SHA-147 | link | hidden-only | "Databank Soalan", → /spm/tahun-lepas, fa-database | FN-M06-1.2.6 |
| EL-M06-SHA-148 | link | hidden-only | "Latih Tubi", → /spm/latih-tubi, fa-bolt | FN-M06-1.2.6 |
| EL-M06-SHA-149 | link | hidden-only | "Tracking A", → /spm/ramalan, fa-crosshairs | FN-M06-1.2.6 |
| EL-M06-SHA-150 | link | hidden-only | "Subjektif", → /spm/subjektif, fa-pen-fancy | FN-M06-1.2.6 |

Excluded SHA elements (prefix EL-M06-SHA-): 181 elements — IDs 001–044, 050–097, 099–108, 110–117, 120–140, 142–145, 151–196: **global shell (docs/discovery/00-global-ui.md) / M23 and the module each link targets (per URL in `_crawl.json`)**. IDs 001–003 are the shell logo/brand (→ /admin, logo image, "Panel Pentadbir"): global shell, not the M16 banner.

**Coverage result: 1315/1315 covered, 0 unmapped.**


---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limitation is not broken; adding options to a working feature is new scope. Rows "Rejected — replicate live" were candidates that turned out to work.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) | Status |
|---|---|---|---|---|---|
| DV-M06-01 | D-1 (corrected after audit) | Contradictory counts | S2 and S3 use the same count per subject: every S3 card equals the S2 databank count (18/18, e.g. MATH 1,681, BM 514, PERNIAGA 934), and Bahasa Arab, which is not in the databank, shows "0 soalan · Locked: 0/40" on S3. The S4 page shows a different, larger pool for the same subject ("2,581 soalan tersedia" for MATH, "2,732" for PERNIAGA; Bahasa Arab "1,200 soalan tersedia" with a working "Mula Kuiz"), so an S3-locked subject is presented as startable with 1,200 questions. The hub ("Jumlah Soalan" 20,529; chips "Databank Soalan" and "Latih Tubi SPM" 14,673) has no contradiction on its own screen; it differs from Σ S2 (21,033) only across pages (discovery A.1, A.2; audit AUD-M06-03, AUD-M06-17). | **S4 only** (Delivery Lead decisions on AUD-M06-03 and AUD-M06-17; CLAUDE.md §6 minimal-fix rule): the S4 header total, "Tingkatan 4/5" and difficulty counts come from the same pool as S3/S2, so Matematik shows 1,681, PERNIAGA 934 and Bahasa Arab 0 (all counts 0) on S4. Because live never showed how that pool splits by level and difficulty, the seed splits each count in the proportions of the live S4 breakdown (SRS §6.10; PROPOSED values). S2, S3, the S3 lock and **every hub value stay exactly as live** (20,529 / 14,673 / 14,673); these hub figures are **documented display constants** (D11 exception clause, XL-34): no named query on the dataset reproduces them, they sit outside the dataset fit, and they never appear next to a contradicting computed figure — on S1 both chips (14,673) are ≤ "Jumlah Soalan" (20,529) and no computed pool total is shown. Alternatives considered: (a) rewrite S3 to the S4 totals — rejected, changes 18 live numbers and removes the live lock; (b) relabel S4 only — rejected, leaves a locked subject startable with 1,200 questions; (c) v1.1: also set the hub chips to Σ S2 = 21,033 — rejected in round 2, because it put a 21,033 chip next to the live 20,529 total on the same screen (a new visible contradiction, AUD-M06-17); (d) also set "Jumlah Soalan" = 21,033 (auditor's suggestion) — rejected, the hub has no visible contradiction on live, so its values are not changed. | Approved (user rule D9; Delivery Lead decisions on AUD-M06-03 and AUD-M06-17) |
| DV-M06-02 | D-2 (corrected after audit) | Candidate: difficulty mapping | S4 buttons "Asas", "Pertengahan", "Sukar", "Sangat Sukar" read and send keys 2, 3, 4, 5 while `difficultyStats` holds keys 1–4 (discovery §2.4). | **Withdrawn — replicated.** The whole site uses a 1–5 difficulty scale (M04 FR-M04-18: 1 Sangat Mudah, 2 Mudah, 3 Sederhana, 4 Sukar, 5 Sangat Sukar); keys 2–5 line up with it and no question has difficulty 5, so "Sangat Sukar 0 soalan" is true. Key 1 (Sangat Mudah) is reachable only by leaving the difficulty empty: a deliberate, consistent limit (D10). Buttons read `difficultyStats[2..5]` and send `difficulty=2..5` as live (AUD-M06-01). | Rejected — replicate live (rule D9, D10; Delivery Lead decision on AUD-M06-01) |
| DV-M06-03 | D-3 | Visual bug (blank icons) | Icons given as Lucide-style or Font Awesome Pro names render blank: `fa-crystal-ball`, `fa-stars` (S1 Tracking A tile/chip), `fa-beaker` (Sains), `fa-flask-round` (Kimia), `fa-trending-up` (Ekonomi), `fa-variable` (Matematik Tambahan), `fa-languages` (Bahasa Arab), `fa-monitor` (Sains Komputer) on S2/S3/S8, and on the S4 header icon tile of those subjects (e.g. `/spm/latih-tubi/SCI`; audit AUD-M06-11). S5/S6 have none. | Same fix pattern as M03 DV-M03-01: the stored icon value is resolved by format to a Lucide icon, so every tile and chip on S1, S2, S3, S4 and S8 shows a glyph; the S1 Tracking A tile and chip use the Lucide equivalents chosen at design time for "crystal ball" and "stars". Tile colours unchanged. | Approved (user rule D9) |
| DV-M06-04 | D-7 (corrected after audit) | Contradictory total | Hub "Soalan Tracking A" and the Tracking A chip read 1,797. The S6 pages of every subject (read in the audit, AUD-M06-02) list sets whose ready questions add up to **1,769** (EKON 145 incl. Sets 7–8 = 19 / 18, SCI 35 incl. Sets 32–34 = 2 / 1 / 1, CHEM 22 incl. Set 9 = 2, GEO 309, AKAUN 640, PSI 205, MATH 362, SEJ 31, PHY 8, BIO 3, BM 9); counting GEO's bank of 67 instead gives 1,796, which still does not match. The readiness chips (1 / 1 / 58) and the objective lane (3 subjek, 18 set, 747 = 67 + 640 + 40) do agree with the sets. | "Soalan Tracking A" (stat and chip) is computed from the sets: Σ ready questions of all 2026 objective sets = **1,769** (PROPOSED value; OQ-M06-08). The readiness panel (subjects with a target only, so AKAUN has no tile) and the lane counts are replicated unchanged. The seed holds the real S6 values of every subject (SRS §6.10); no value is chosen to reach a total. | Approved (user rule D9; Delivery Lead decision on AUD-M06-02) |
| DV-M06-05 | D-9 | Contradictory values | Mock 16 result: "0 / 30 markah" but only 27 review items, and the weak-topic counts add up to 25 (discovery §2.12). Each review item shows "Jawapan: A" and italic "Jawapan betul: A". | The result is computed from the mock's items: max = sum of item max marks, score = sum of item marks, the review lists every item, weak-topic counts are the wrong items grouped by topic (they add up to the wrong items). The italic feedback line is the item's stored feedback and is **replicated** (redundant but not wrong). | Approved (user rule D9) (counts); feedback line replicated |
| DV-M06-06 | D-10 (corrected after audit) | Visual bug (missing state) | The rules `.grade-A, .grade-A\\+` and `.grade-B, .grade-B\\+` are invalid as a whole, so the browser drops them: **A, A+, B and B+** chips are all unstyled (transparent background, slate text); only `.grade-C`, `.grade-D, .grade-E, .grade-G` and `.grade-pending` apply (OBSERVED: computed styles, audit AUD-M06-08). | A and A+ chips emerald, B and B+ chips blue, as the CSS intends. | Approved (user rule D9) |
| DV-M06-07 | D-11 (corrected after audit) | Wrong titles | S4, S6, S7 and S9 (user portal) show the fallback header "Dashboard" / "Selamat datang kembali" (EL-M06-SHU-375). S11–S13 render in the admin shell for the admin — the shell follows the role, as on `/tetapan` (M01 FN-M01-2.3.8) — with the stale header "Dashboard" / "Selamat datang, Admin" (EL-M06-SHA-118/119). | **Titles only**, implemented by the shell rule DV-SH-03 (`docs/design/shells.md`: title from the route, no subtitle; XL-20): S4 "Latih Tubi SPM — {Subjek}", S6 "Tracking A SPM — {Subjek}", S7 "Tracking A Bahasa", S9 "Subjektif SPM", S11 "SPM Mock Exam", S12 "Result Mock SPM — {Subjek}", S13 "SPM Walkthrough — Cikgu Alesa", each with no subtitle (as M01 DV-13). Screens whose live title is correct (S1, S2, S3, S5, S8, S10) keep it with its live subtitle. The layout stays role-based as live. | Approved (user rule D9) |
| DV-M06-08 | D-12 (corrected after audit) | Responsive breakage | At 375px (audit screenshots `docs/qa/audit/img/M06/s11-mock-row-375.png`, `s13-form-375.png`): S11 `.sm-form .grid` (`2fr 1fr`, no breakpoint) makes the Paper select 82px wide ("Pape…"); in "Mock Sebelum Ini" `.sm-card .grade {font-size:1.5rem}` outranks `.grade-pending {font-size:.85rem}`, so "Belum" renders at 1.5rem, overflows its chip and runs into "Sambung →" (the chip and link boxes themselves do not intersect). S4: difficulty grid `grid-cols-4` at 375, "Pertengahan" overflows its button (scrollWidth 87 > 67). S13: the same `2fr 1fr` grid makes the year field 82px, its placeholder shows "Cth: 20" and the label "TAHUN (OPSYEN)" wraps to two lines. | Below 640px: S11 "Subjek" and "Paper" stack full width; the pending chip keeps its intended 0.85rem size, and in a mock row the chip and the link sit on their own line under the title. S4 difficulty buttons 2 per row below 640px, 4 from 640px. S13 "Subjek" and "Tahun (opsyen)" stack below 640px. | Approved (user rule D9) |
| DV-M06-09 | D-15 | Unreadable text | S8 active "Semua" tab: white text on a near-white pill (`bg-slate-900` not applied) (`subjektif-desktop.png`). | Active "Semua" = dark slate background with white text; Teras (teal-600) and Elektif (amber-500) active styles unchanged. | Approved (user rule D9) |
| DV-M06-10 | new (inventory state `all-subjects`) | Contradictory rule | S7 says "dipaparkan mengikut susunan BM kemudian BI" and chip "BM dahulu, BI kemudian", but with "Semua Subjek" the first cards are Bahasa Inggeris (ids 3704–3706; raw capture `S7-tracking-bahasa__all-subjects__1280.json`). | With "Semua Subjek" on the bahasa track, Bahasa Melayu sets are listed before Bahasa Inggeris sets (then by the M05 list order within a subject). | Approved (user rule D9) |
| DV-M06-11 | D-8 | Dead link | The 404 page's "Mula Latihan" → `/latih-tubi` (itself 404). | Already fixed globally by M01 DV-02 ("Mula Latihan" → `/practice`); M06 adds nothing. | Approved (M01 DV-02) |
| DV-M06-12 | D-4 | Candidate: naming | Route `/spm/tahun-lepas` and history label "Tahun Lepas" (`past_year`) for a random databank with no years; hub "0" "Tahun Tersedia"; lead mentions "Soalan tahun lepas". | **Replicated.** "0 Tahun Tersedia" is a true count (no past-year questions have a year); the route and labels are names only; nothing is broken. | Rejected — replicate live (rule D9) |
| DV-M06-13 | D-5 | Candidate: affordance | S2 amber "Mula" is plain text next to the working 5/10/20 links. | **Replicated** (plain text; the set links are the working controls). | Rejected — replicate live (rule D9, D10) |
| DV-M06-14 | D-6 | Candidate: formatting | Difficulty counts unformatted ("2143"), Tingkatan counts with separators ("1,933"). | **Replicated** (readable, consistent per control). | Rejected — replicate live (rule D9) |
| DV-M06-15 | D-13, D-14 | Candidate: copy | Mixed language / slang ("yg", "dlm", "next round", "Paper", "Sambung →"); "Syiling Diperoleh" (S1) vs "Jumlah Syiling" (S10) for the same value. | **Replicated** as live copy. | Rejected — replicate live (rule D9) |
| DV-M06-16 | §2.12 | Candidate: randomness | The Duta card changes between loads (random pick; the BM maestro on one load, the Matematik maestro on another). | **Replicated**: random pick per load among bintang-tier ambassadors, subject match preferred on S12; the mock exposes a seed hook for tests. | Rejected — replicate live (rule D9) |
| DV-M06-17 | XL-22 | Unreadable text | Small chip, badge and caption text on M06 screens (S3/S4 count and target chips, S5 readiness mini labels and lock chips, S6 DSKP lines, S7/S9 card chips, S10 row meta, S11 "Belum submit" line) looks tiny in the discovery screenshots; exact sizes were not captured. | Wherever M06 content text renders below 12px on live, it is rendered at 12px; nothing else changes (same rule as M02 DV-01, M03 DV-06, M04 DV-M04-17, M05 DV-11; master NFR-02). Sizes to be confirmed at re-audit. | Approved (user rule D9) |

**Explicitly not deviations** (replicated as live): S1 h1 conflicting size classes (small on desktop, readable); S2 `?subject=` ignored; S3 = S2 counts and the Bahasa Arab lock (DV-M06-01); the S4 difficulty keys 2–5 and the unreachable difficulty 1 filter (DV-M06-02); S10 stats not affected by the filter; English Laravel pager text; the fixed Latih Tubi count when a target exists (a deliberate limit, D10); no year selector on the databank; the readiness panel scope (target subjects only); Belum Cukup sets shown only as locked cards; native `alert()` on the walkthrough; only "Subjek" required on the walkthrough form; the mock form's value = label subject strings ("English", not "Bahasa Inggeris"); walkthrough subject list (16 options incl. "Perdagangan", "Prinsip Akaun") differing from the mock list (10) and from M03 names; the S8 card order (A–Z within Teras/Elektif) and S9 select order; the role-based shell on S11–S13.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| The quiz page UI, answer checking, results and rewards animation (`JBCoinFly`) used by Q1–Q3; the practice session store, answer log, revision queue and mastery counters | M05 (`<PracticeQuiz>`, DATA-M05-01/02, BR-31; D12). M06 passes the start parameters, title and labels. |
| `/latihan-berstruktur` list template, filters and pager logic (incl. the SPM variants S10-SPM that M06 documents as S7/S9), the answer page `<StructuredAnswer>` and StructuredAttempt | M05 (owner). M06 specifies the SPM variant copy, back links, `scope`/`track` and the DV-M06-10 order. |
| "Lapor Soalan" modal and report entity | M04 (FN-M04-3.1.x; source `spm`). |
| Question store (incl. the SPM pool), structured store, subjects, levels | M04 (D12; `questionStore`, `structuredStore`) / M03. M06 supplies the observed per-subject SPM pool sizes as allocation inputs (SRS §6.10). |
| Duta profiles `/bilik-duta/{slug}`, tiers, ratings | M24 (M06 shows the card only). |
| `/pusat-nota-ringkas` (notes centre) | M25. |
| Premium gating (SPM package, PKSK) | M19 / M07 (none observed on M06). |
| Tournament banner, chatbot, PWA/FCM, header coins/points/streak pills, server-status widget | M16 / M22 / M14 / M23 / global shell. |
| Real AI (walkthrough text, image extraction, Paper 2 marking) | Backend phase (D4: canned responses). |

---

## 9. Open questions

Only questions that cannot be answered by following the live site.

1. **OQ-M06-01 Live-session states L-1…L-13 (pending user approval).** Practice sessions were not approved for discovery. The quiz pages (L-1…L-5), structured answer pages (L-6, L-7), mock exam and results (L-8…L-10), walkthrough result/errors (L-11), history colour bands and Tracking A rows (L-12) and student views (L-13) are specified from captured source (SOURCE-DERIVED) or INFERRED in §3 / SRS §8.3. Copy of those states is UNVERIFIED COPY. A live run with a test student account would confirm them.
   Cross-module note (v1.3): the quiz pages are the M05 `<PracticeQuiz>` and the answer pages the M05 `<StructuredAnswer>`; confirming L-1…L-7 therefore also confirms M05 LS-1/LS-7.
2. **OQ-M06-02 Premium gating (L-13).** No gate was seen for the admin; whether students without an SPM package (M02 "Assign Pakej SPM", M19) or PKSK (M07) are blocked is unknown. The prototype has no gate.
3. **OQ-M06-03 Role visibility (INFERRED).** "Admin Readiness" is assumed admin-only (its title); whether teachers/parents can open M06 is unknown.
4. **OQ-M06-04 Latih Tubi zero/short result (L-3).** Behaviour when fewer questions match than `count`, and the copy when none match (SRS §8 uses PROPOSED COPY). Also how the live single-question link (`question_id` + `count=1`, M04) renders.
5. **OQ-M06-05 Mock exam page (L-8, L-10) — UNVERIFIED, all points open.** (a) layout of `/spm-mock/{id}`; (b) timer direction (count-up or countdown) and duration per subject/paper; (c) whether the mock submits automatically at time-out; (d) what "Kalau pause, score akan jejas" does; (e) number and type of items per paper (live mock 16: 30 marks, 27 review items); (f) the submit button copy; (g) source of items (bank vs AI) and Paper 2 marking; (h) whether "Boleh attempt setiap bulan" limits attempts (no refusal is specified); (i) grade band thresholds (SRS BR-M06-24, INFERRED). The prototype uses a neutral provisional placeholder (FN-6.2.3/6.2.4). L-8 should be first when the user approves live sessions.
6. **OQ-M06-06 Subjective marking.** Hub says "disemak oleh guru"; S8 says "semak markah dan model jawapan". The M05 answer page decides; the prototype follows M05.
7. **OQ-M06-07 Walkthrough validation.** An empty "Subjek" is stopped natively (OBSERVED). The server's reply when a subject is chosen but neither question text nor image is given is unknown (SRS §8: PROPOSED COPY).
8. **OQ-M06-08 Count values — closed (v1.2).** The hub keeps its live values (20,529 / 25 / 0; chips 14,673 / 14,673 / 4,059); no hub value is PROPOSED except "Soalan Tracking A" 1,769 (DV-M06-04). PROPOSED values remaining for G1: the S4 totals from the S3/S2 pool and their seed split by level and difficulty (DV-M06-01), and the Tracking A total 1,769.
9. **OQ-M06-09 PROPOSED COPY (new BM text, no live original) — report at G1.** SRS §5/§8/§6.12: S11 server error "Sila pilih subjek."; S13 "Gambar tidak sah." and the subject-but-no-content error "Sila masukkan soalan atau muat naik gambar soalan."; Q2 no-question message "Tiada soalan untuk tetapan ini. Sila ubah tetapan kuiz." + "Kembali"; Q4 placeholder submit "Hantar"; the Paper 2 marker feedback "Jawapan anda merangkumi {m} daripada {max} markah. Rujuk skema."; the three canned walkthrough texts (simulated AI output, D4).
