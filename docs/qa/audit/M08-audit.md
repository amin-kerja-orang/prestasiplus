# M08 — Student Performance & Analytics — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6, step 4) |
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 3 (`playwright3`). This agent did not write the URS or the SRS. |
| Documents audited | `docs/requirements/urs/M08-student-performance.md` v1.0 and `docs/requirements/srs/M08-student-performance.md` v1.0 |
| Evidence | <ul><li>Live https://prestasiplus.my: admin session on lane 3, read-only, plus one cookie-less context for the guest checks.</li><li>`docs/discovery/M08-student-performance.md`, together with `inventory/M08/*`, `_raw/M08/*` and `_crawl.json`.</li><li>Page markup and inline scripts, read in place with same-origin GETs.</li><li>Cross-checks against M01 (`/profile/edit`) and the M05/M07 precedents.</li><li>Masked screenshots in `docs/qa/audit/img/M08/`.</li></ul> |
| Safety | <ul><li>**Read-only.** No form was submitted: Auto-Setup, "Cipta Headcount" and "Terbitkan" were never pressed. The S12 modal was opened and ticked only by the discovery job `S12…auto-setup-reopen`, which closes it with "Batal".</li><li>No `/practice/{CODE}/quiz` ("Latihan Fokus" / "Fokus") URL was opened.</li><li>GETs were throttled to ≥ 400 ms.</li><li>**Screenshots** were masked with `M08MASK` + `sanitize.js` (leak check 0), and names and schools were blanked in addition.</li><li>**Personal data in files:** no person name, school name or person-record id was written to any file. The student used for the S15/S6 checks is referred to only as "an S3 T4 at-risk student".</li><li>**Tools:** shared tools were not modified. The re-run inventory output was compared and then deleted. The scratch scripts are in `<scratchpad>/m08-audit/`.</li></ul> |

## Verdict: **FAIL**

There are **0 Critical, 5 Major and 11 Minor** findings.

**What holds up:**
- **Completeness proof.** Every one of the 1,148 content ELs appears in URS §6 exactly once. The 57 exclusions are the M16 tournament banner. Shell 001–003 are the logo/brand.
- **Re-inventory.** Nine sampled states re-inventory identically; the only difference is one leaderboard coin value that has changed since discovery.
- **Formulas.** The GPS (2569 ÷ 744 = 3.45), grade bands, chart config, item-analysis formulas, legend bands, the 4-student rule, adaptive bands 75/50 and the cap of 25 all match live.
- **Behaviour.** Ranking pills that keep filters, the leaderboard default "Minggu Ini", the 50-row cap, and every 403/404 outcome match live.

**Where it fails:**
1. **Populated headcount states were observable but were not captured.** Discovery treated the populated headcount views as unobservable (L-4) because the admin owns no config. But the S3 "Murid Berisiko" links open real students whose S6 and S15 pages have full headcount data. Those pages show:
   - status pills "On Track" / "Below Target" / "Below";
   - "Menurun";
   - "Keyakinan: Rendah";
   - an RS badge, an RS chip and an "RS (SPM Sebenar)" table row with "Direkod: {date}";
   - a whole "Ketepatan Ramalan ETR vs RS" box;
   - status icons and row tints;
   - green Gred AR pills.

   The documents instead call much of this PROPOSED COPY, INFERRED or absent.
2. **Two deviations rest on false defect claims.** DV-M08-09 says the RS point "can never render", but it renders on live. DV-M08-21 says the Gred AR pill is "always red", but it is green when AR ≥ target.
3. **DV-M08-03 hides a menu item for every role, and the SRS asserts 403 for pelajar and guru.** Both are unobserved, and the SRS itself says the page is "probably permitted on live".
4. **DV-M08-15 adds 750 options to a select.** Live limits it to own classes, the same pattern that is replicated on S5 and S14. Adding options is D10 new scope.
5. **The seed replaces the 13 observable S3 T4 class rows with filler.**

## Summary counts

| Measure | Result |
|---|---|
| Content elements in URS §6 (checked by script) | 1,148 / 1,148 inventory IDs, with 0 missing, 0 extra and 0 duplicates. 1,091 are mapped and 57 are excluded. |
| The 57 exclusions | EL-M08-S{1,2,4–17,19,20}-001–003 and S3-008–010, all "LIVE:" / "MAIN" / "DAFTAR" (hidden `tournamentBanner()`), so **M16 is correct**. S18 and S21 are standalone, so they have no banner. |
| Shell 001–003 | → `/dashboard`, the logo image and "Platform Latih Tubi Nasional". They are excluded as "global shell (logo/brand)", which is correct. |
| Matrix ↔ §3 FN | 129 FN are defined and 110 are cited in the matrix. The rest are behaviour-only. There are 0 unknown FN references. |
| Coverage spot-check | 32 rows (every 38th row), **32 correct** (list below) |
| Live re-inventory (`run-state.js` + `inventory.js` + `sanitize.js`, `tools/jobs/M08.js`) | <ul><li>9 states: S2 default@1280, S4 default@375, S7 tab-sej@1280, S8 class-4@1280, S11 sort-changed@1280, S12 auto-setup-reopen@1280, S14 default@375, S17 default@1280, S20 month@1280.</li><li>**The totals are identical** (379, 382, 476, 415, 435, 413, 404, 395, 430) and so are the element keys. The only difference is on S20: the month podium shows "5,199" in discovery and "5,183" now, which is data drift.</li><li>PII leak check: 0 in all 9 states.</li><li>The action logs reproduce D-15 (`rows=596 visible=596`) and the Auto-Setup reset (`checked=0`).</li></ul> |
| Traceability (checked by script) | <ul><li>129 FN → 124 FR: every FN is cited.</li><li>128 AC: each has ≥ 1 FR and ≥ 1 E2E.</li><li>Each of the 124 FR has ≥ 1 E2E.</li><li>61 E2E, all on 375/768/1280. 0 dangling references.</li><li>The automatic parse fails on FR-19, FR-22 and FR-23 because of unescaped pipes (AUD-M08-15). Checked by hand, they trace correctly.</li><li>9 E2E are marked provisional. At least 8 more assert INFERRED/PROPOSED behaviour without the mark (AUD-M08-11).</li></ul> |
| Claims verified against live | **64**: 50 correct, 14 incorrect or incomplete (list below) |
| Deviations DV-M08-01…27 | 22 fixes, of which 13 are valid as written. **03 and 15:** not D9 fixes. **09 and 21:** false premise. **02 and 04:** valid for the admin, unverified for the teacher. **13 and 22:** evidence or minimality issues. The 5 replicated items are correct (DV-26's correction is verified). |
| Findings | **Critical 0 · Major 5 · Minor 11** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M08-01 | **Major** | URS FN-M08-5.4.1–5.4.5, 2.6.3, 2.5.6, OQ-M08-03, §5 S15; SRS FR-36, FR-39, FR-93–96, BR-M08-23/24, §8.1/8.2 (PROPOSED COPY), §6.10 designed headcounts; discovery §2.15/§9 L-4 (report to the discovery owner) | **Populated headcount states are observable but were not captured, and the documents label live copy as PROPOSED or INFERRED.** Discovery captured one student without targets and declared the rest L-4. But the S3 T4 "Murid Berisiko" links point to students whose `/prestasi/{id}` (via DV-08's corrected target) and `/headcount/student/{id}` pages carry full data. On S15 the following are missing or mis-specified:<br>(a) status pill "On Track" `bg-green-100 text-green-700` / "Below Target" `bg-red-100 text-red-700` / "Belum Ada Data". The docs call "On Track"/"Below Target" PROPOSED COPY.<br>(b) An `rs-badge` (`fa-star` "RS: 60.0% (B)") beside the pill.<br>(c) A third summary chip "RS: x% (G)" (`bg-indigo-50 border-indigo-200`).<br>(d) The Unjuran chip is also a **green** variant (`bg-green-50 border-green-200 text-green-700`), not only red-50.<br>(e) The trend chip "**Menurun**" is live copy. It is labelled "PROPOSED COPY" in FR-94 and BR-24.<br>(f) "Keyakinan: **Rendah**" (slate-400) exists. The docs list only Tinggi/Sederhana.<br>(g) The table has a 5th row "RS (SPM Sebenar)" (`fa-star`, `bg-indigo-50 border-l-4 border-l-indigo-400`, Gred pill `bg-indigo-200 text-indigo-800`, last cell "Direkod: 13 Apr 2026" or empty).<br>(h) The Status column shows an icon: `fa-check-circle text-green-500` when on target, `fa-arrow-down text-red-500` when below, and "—" (slate-300) otherwise. Rows are tinted `bg-green-50` or `bg-red-100 border-l-4 border-l-red-400`. The docs specify text "On Track"/"Below" (PROPOSED).<br>(i) A box "Ketepatan Ramalan ETR vs RS" (`bg-green-50 border-green-200`, `fa-check-circle`) with "ETR (Ramalan): x% (G)", "RS (Sebenar): x% (G)", "Selisih: +0.4 markah", "Ramalan Tepat" and "Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah." None of it is in the docs.<br>On S6, the headcount card pills are "On Track" (green) / "**Below**" (red) / "—". On S5, the Headcount badge shows "On Track" (`badge-on`) / "Below" (`badge-below`), while FR-36 calls it PROPOSED. | <ul><li>S3 T4 → at-risk student → "Lihat Penuh": 5 sections, 5 RS rows, 5 "Ketepatan Ramalan" boxes, statuses On Track ×2 / Below Target ×2 / Belum Ada Data ×1, trends Stabil / Meningkat / Menurun.</li><li>S5 class 516: 6 `badge-on` "On Track" and 9 `badge-below` "Below".</li><li>Screenshot `img/M08/s15-populated-rs-status-masked.png`.</li></ul> | <ul><li>Re-run discovery for S15, S6 and S5 on a populated student and class, reached from the S3 T4 at-risk list (read-only). Add the states to the inventory and the matrix.</li><li>Re-specify FN-5.4.x, FN-2.6.3, FN-2.5.6 and FR-36/39/93–96 from the observed markup, and relabel the copy OBSERVED.</li><li>Add the RS badge, chip, row and prediction box, and the "Rendah" confidence. The success/warning variants of the box copy that were not observed stay UNVERIFIED.</li><li>Remove "Menurun", "On Track"/"Below Target" and the S5 badges from PROPOSED COPY.</li><li>Narrow L-4 to what is really unobservable: the S12 list, the S13 with data, and the create/auto-setup results.</li></ul> |
| AUD-M08-02 | **Major** | URS §7 DV-M08-09 and DV-M08-21, FN-5.4.3–5.4.5, AC-27.2–27.4; SRS FR-95, FR-96, BR-23, E2E-43/44 | **Two deviations "fix" behaviour that works on live.**<br>(1) **DV-09** says the RS label "is never" in the labels, so the point "can never be drawn". On live, when `hasRS`, the server renders `labels = ["TOV","OTR1","OTR2","OTR3","ETR","RS"]` in both the dataset block and the chart config. `labels.indexOf('RS')` = 5 and the star is drawn. The specified behaviour happens to equal live, but it is recorded as a D9 fix of a non-existent defect.<br>(2) **DV-21** says the Gred AR pill is "always `bg-red-100`, even for A/A+". Live colours it **`bg-green-100 text-green-700` when AR ≥ target** and red when AR is below target **or when no target exists**. The discovery student simply had no targets. The rebuild's "slate when no target" therefore changes live, and the D9 basis for it (a contradiction) is not shown. | The chart script of `chart_0`… on the at-risk student's S15. Table: OTR3 60.0 / AR 60.0 → green pill; OTR3 70.0 / AR 65.0 → red; no target / AR 61.0 → red. | <ul><li>Mark DV-09 as "Rejected — replicate live (RS renders)" and move the RS behaviour to the observed FN.</li><li>Rewrite DV-21 with the real live rule (green ≥ target, red otherwise). Either replicate red-without-target, or justify a minimal change with live evidence of a contradiction and list the alternatives.</li><li>Update AC-27.3/27.4 and E2E-43/44.</li></ul> |
| AUD-M08-03 | **Major** | URS §7 DV-M08-03, FN-1.1.1/1.1.2, FN-8.1.1, AC-01.1, AC-33.1, AC-33.2; SRS FR-01, FR-02, FR-119, FR-120, BR-29, §9 row S21, E2E-01, E2E-57 | **DV-03 hides "Laporan Mingguan" for every role and asserts 403 for roles that were never observed.** Only the admin was observed (403). The documents themselves say the page is INFERRED student/parent-permitted, and SRS §9 says "probably permitted on live". Hiding the item for students and parents removes a live entry point to a presumably working feature. E2E-57 asserts 403 "as pelajar and guru" without a provisional mark. This is the M07 AUD-01 pattern: an unobserved but likely working page is replaced by a "not available" outcome under a D9 label. D9 lets the Delivery Lead fix only broken behaviour. For the admin, a menu item that returns the standard 403 page is at most a role-gating quirk (SEC-M08-12), and the documents replicate the equivalent `/analisa-item` gating for other roles. | <ul><li>`/laporan-mingguan` and `?week=1` → 403 "403 - Akses Ditolak \| PRESTASIPLUS" for the admin (re-checked).</li><li>Sidebar at 1280 shows "Laporan Mingguan" (screenshots).</li><li>Guest → 302 `/login`.</li></ul> | <ul><li>Withdraw DV-03 as a D9 fix: keep the item as live, and keep the admin 403 (observed).</li><li>For pelajar, ibu bapa and guru, mark `/laporan-mingguan` **UNVERIFIED / BLOCKED (OQ-M08-01)**. Do not assert 403 for them. Remove or mark provisional the pelajar/guru part of E2E-57 and AC-33.1, and AC-33.2.</li><li>If the Delivery Lead still wants the item hidden until discovery, that is a non-D9 choice that the **user** must approve (D7). Report it at G1.</li><li>Prioritise the student/teacher test account (OQ-M08-01).</li></ul> |
| AUD-M08-04 | **Major** | URS §7 DV-M08-15, FN-3.2.1, AC-19.1/19.2; SRS FR-54, BR-M08-26, SEC-M08-05, E2E-26 | **DV-15 adds options to a working control (D10 new scope) and treats S8 differently from S5 and S14.** On live, the S8 "Kelas" select lists the viewer's own classes. The admin owns none, so it is empty, the same "own classes" rule by which S5 "Tukar Kelas..." shows only its placeholder and S14 "Pilih Kelas" has none. The documents **replicate** S5 and S14 but "fix" S8 by listing **every class the viewer may open (750 for the admin)**. D10: "completing a working filter with extra options is new scope, not a fix." S8 is linked from no menu or page (crawl: reached by URL only), so the admin's empty select is not a dead end in any live flow. At most the zero-option select renders blank. | `/analitik/kelas`: `<select name="classroom_id" onchange="this.form.submit()"> </select>` (0 options). With `?classroom_id=4` it is still 0 options, while subject and risk are populated. `_crawl.json`: `/analitik/kelas` foundOn only S8 (visited). | Replicate live (own classes; the admin sees an empty select), consistent with S5 and S14. If the blank control is judged a visual defect, the minimal fix is a placeholder option only (for example the existing "— Pilih kelas —"), with no added class list. Update AC-19.1/19.2 and E2E-26. |
| AUD-M08-05 | **Major** | SRS §6.3 (`ClassCompareRow` "T4: 13 rows … row values filler"), §6.10 S1–S3 row; URS AC-10.1; SRS E2E-11; discovery §2.3 and §8.2 (report to the discovery owner) | **The T4 class table is observable (13 rows, no personal data except the Guru column), but the seed replaces it with filler.** This is the M07 AUD-03 error: the seed claims "admin mirror (every value observed)" but invents rows that live shows. Live rows (Kelas · Subjek · Murid · Sesi · Ketepatan · On Track · Below · target):<ul><li>"4 Bestari" Tiada Subjek 5·0·0%·0·0 →419</li><li>"4 Simulasi" Tiada Subjek 15·0·0%·13·2 →516</li><li>"4 Bestari - BM" BM 58·0·0% →4</li><li>"4 Cemerlang - BM" 53·7·51.3% →5</li><li>"4 Dedikasi - BM" 54·4·81.7% →6</li><li>"MUMTAZ - Biologi" 0 →90</li><li>"5 BEST" Fizik 0 →25</li><li>"4 IBNU SINA" Matematik 0 →115</li><li>"4 Bestari - SEJ" 58 →8</li><li>"4 Cemerlang - SEJ" 53·7·51.3% →9</li><li>"4 Dedikasi - SEJ" 54·4·81.7% →10</li><li>"T4 4 Bestari" Kelas Sekolah 5 →sc-419</li><li>"T4 4 Khawarizmi" Kelas Sekolah 1 →sc-806</li></ul>Discovery also missed a **same-screen live contradiction** that this table reveals: the table sums to On Track 13 / Below 2 / Sesi 22, while the S3 T4 cards read On Track 34 / Below Target 41 / Jumlah Sesi 10. The deviation table must record a D9 decision on it. | `/prestasi/tingkatan/t4` table (read in full). Screenshot `img/M08/s3-t4-class-table-masked.png` (Guru masked). | <ul><li>Seed the 13 T4 rows exactly as observed, with fictitious teacher names and the live class ids and sc-ids.</li><li>Keep filler only for the 645 T5 rows (clearly labelled, never asserted).</li><li>Extend E2E-11 to assert the observed names and values.</li><li>Record the table-vs-cards contradiction as a new DV (replicate, or a minimal fix with the alternatives listed).</li></ul> |
| AUD-M08-06 | Minor | URS DV-M08-02, DV-M08-04, FN-1.2.5, FN-3.2.4, AC-03.1/03.2, AC-19.4; SRS FR-09, FR-57, E2E-04, E2E-27 | **The teacher and student parts of DV-02 and DV-04 are unverified but written as fact.**<ul><li>DV-02 redirects **teachers** to S10, and FR-09/E2E-04 assert the student's `/dashboard` redirect. Neither is observed; only the admin's 302 to `/dashboard` is.</li><li>DV-04 retargets the S8 links to S6 for **every** role. For a teacher, the live `/analitik/kelas/pelajar/{id}` page may work (L-3), so the rebuild would replace a possibly working page with a different one.</li></ul>The admin parts are valid dead-link fixes. | Admin `/analisa-item` → `/dashboard` (200). Guest → 302 `/login`. | <ul><li>Scope both DVs to the observed admin behaviour.</li><li>Label the teacher and student outcomes INFERRED, mark the E2E-04 teacher/student steps provisional, and list DV-04's teacher case under OQ (L-3).</li></ul> |
| AUD-M08-07 | Minor | SRS FR-63, BR-M08-26, §6.10 designed classes 2001–2003, §7 #10 "(id desc)"; URS FN-4.2.2, AC-21.1; E2E-30, E2E-35 | **The S10 order rule is wrong, and the seed ids conflict with AC-21.1.**<ul><li>Live is **not** id-descending. The first rows are 1156, 1155, 1154 …, but there are 342 ascending steps (for example 809 < 810 < 811 …, ending … 10, 11, 4, 5, 6). That is consistent with newest-created first, ties by id ascending (INFERRED). The "Tukar Kelas" chips use the same order.</li><li>With FR-63 "id descending", the designed classes 2001–2003 (> 1156) would head the admin's S10 list, the S11 chips and (per DV-15) the S8 select. AC-21.1 expects "5 CYBER" (1156) first.</li></ul> | `/analisa-item/kelas` hrefs: 750 cards, 342 inversions. Chips on `/analisa-item/kelas/228` are in the identical order. | <ul><li>State the order as `createdAt` descending, ties by id ascending (INFERRED).</li><li>Give the designed classes a `createdAt` (or ids) that do not place them above the live-first rows in the admin's default view, or state where they appear and assert it.</li></ul> |
| AUD-M08-08 | Minor | URS FN-2.6.3, AC-14.2; SRS FR-39, E2E-18 | **The S6 headcount chip row omits checkpoints that have no AR.** Live shows "TOV: 67% · OTR3: 56% · ETR: 56%" when only OTR3 has an actual; FR-39 and AC-14.2 specify "OTR{i}: —" chips (for example "OTR3: —"). The live pill values are "On Track" / "Below" / "—" (see AUD-01). | At-risk student S6: 5 cards, each "TOV · OTR3 · ETR" only. | Specify that the chip row lists TOV, then only the OTRs with an AR, then ETR ("—" when empty, as observed). Fix AC-14.2 and E2E-18. |
| AUD-M08-09 | Minor | URS FN-7.1.5, DV-M08-22, AC-31.3/31.4; SRS FR-108, FR-112, E2E-53 | **Ranking footer and subtitle.**<ul><li>(a) The footer "Menunjukkan {n} dari {n} pelajar" appears **only on the nasional scope** (explicit or default). It is absent on `negeri=Selangor` (rows shown) and on `scope=xyz`. The inventory agrees: S19-046 visibleIn nasional/subject only. FR-112 shows it always.</li><li>(b) DV-22's evidence says the title changes "only when `negeri` is set". Live changes it only on the **negeri** scope: `?scope=daerah&negeri=Selangor` still reads "Nasional". FR-108's "x = negeri when set" would show "Selangor" on Daerah, which is an unrecorded change.</li></ul> | GETs on `/ranking` with 11 query variants. | <ul><li>(a) Make the footer conditional (nasional only; OBSERVED).</li><li>(b) Correct the DV-22 evidence and decide the daerah+negeri title explicitly (the minimal choice is "Daerah").</li></ul> |
| AUD-M08-10 | Minor | URS FN-1.2.1, FN-6.3.1, AC-02.1, §2 Guest/Public rows, FN-4.3.6, OQ-M08-08, L-9 refs, FN-2.5.6; SRS FR-05, FR-68, FR-36, FR-104, §9 | **Mislabels (observable behaviour marked INFERRED or unobserved).**<ul><li>(a) The guest redirects are OBSERVED: `/prestasi`, `/ranking`, `/leaderboard`, `/timeline`, `/headcount`, `/analitik/pelajar`, `/laporan-mingguan` and `/analisa-item/kelas` → **302 `/login`**. `/pelajar/1` → **200 without a session**.</li><li>(b) The S11 Tahap pills are observable in class 228: "Sederhana" `fa-meh` #FEF3C7/#92400E, "Mudah" `fa-smile` #DCFCE7/#166534. The docs call them INFERRED ("amber", "green") and list them under L-9/OQ-08.</li><li>(c) S5: inactive members come last in "Perlu Perhatian" (class 228: 11 with accuracy, then 46 "Belum mula berlatih"), and ranking rows without activity show Ketepatan "—" and Terakhir Aktif "—" (class 4). FR-36 labels "—" INFERRED and does not mention the accuracy dash.</li></ul> | Cookie-less `request.get(maxRedirects:0)`. The class 228 row markup. The class 4 and 228 lists. | Relabel as OBSERVED with the exact classes and colours. Remove the Tahap icons from OQ-08/L-9. Add the accuracy "—" to FR-36. |
| AUD-M08-11 | Minor | SRS §12 provisional list, E2E-04, 20, 25, 28, 39, 40, 43, 56, 57 | **The provisional marking is incomplete.** Only 9 scenarios are marked. The following assert INFERRED, PROPOSED or unobserved behaviour without the mark:<ul><li>E2E-04: teacher and pelajar redirects.</li><li>E2E-20: Cadangan triggers (INFERRED &lt; 70).</li><li>E2E-25: "no message box" for ≥ 50 (PROPOSED).</li><li>E2E-28: Kritikal/Tinggi colours (L-10).</li><li>E2E-39/40: level filter labels (PROPOSED).</li><li>E2E-43: projection, trend and confidence rules (BR-24 INFERRED).</li><li>E2E-56: the viewer-only merge rule.</li><li>E2E-57: pelajar and guru 403 (AUD-03).</li></ul> | Script over SRS §12 against the URS AC labels. | Mark these steps provisional (or split them). Report the true provisional count to the Delivery Lead. |
| AUD-M08-12 | Minor | URS FN-2.1.6, 2.3.4, 2.5.6, 3.2.4, 4.3.6/4.3.10; SRS FR-18, 26, 36, 57, 68, 72 | **CSS upper case is not stated.** The table headers on S1 (both tables), S3, S5, S8 and S11 (both tabs) are `text-transform: uppercase` (rendered "KELAS", "SUBJEK" …). S20's headers are not. Only the S11 summary labels are marked. | `getComputedStyle(th).textTransform` on each screen. Screenshot `s3-t4-class-table-masked.png`. | Add "headers upper case by CSS" to those FN/FR (and "not upper case" for S20). |
| AUD-M08-13 | Minor | URS FN-6.2.3, AC-29.3; SRS FR-101, E2E-48 | **A field reset is not specified.** Live `renderPreviews()` rebuilds `#captionFields` from scratch whenever a file is added or removed, so every typed caption is cleared. The docs say only that removing a file "removes its caption", which implies the other captions are kept. | S17 inline script (`captions.innerHTML = '<p …>Keterangan Gambar (opsional)</p>'` then re-append empty inputs). | State the reset (SOURCE-DERIVED) and replicate it (working behaviour). Adjust E2E-48. |
| AUD-M08-14 | Minor | URS DV-M08-13, AC-18.1/18.2; SRS FR-49, E2E-23 | **DV-13 is broader than the defect.** Only the SEJ ring is self-contradictory ("8 / 2 SP", dasharray "1256 -942"). The BM ring on live is "3 / 3 SP" with a full arc ("314 0"). The fix changes both to legend totals ("3 / 26 SP" gives an 11.5% arc). It also puts "/ 26 SP" beside a map titled "Standard Pembelajaran" that shows 3 SP tiles on the same pane, a new unit tension. Alternatives such as clamping the ratio, or counting the numerator from the same set as the denominator, are not recorded. | `/analitik/pelajar` panes: "3 / 3 SP" `314 0`; "8 / 2 SP" `1256 -942`. | List the alternatives and why they were rejected. Consider restricting the change to rings where numerator > denominator. Record the SP-count wording decision as PROPOSED for G1. |
| AUD-M08-15 | Minor | URS FN-M08-2.1.7, 2.2.1, 2.3.1 (and others with `t4\|t5` in code spans); SRS FR-19, FR-22, FR-23 | **Unescaped `\|` inside code spans breaks the Markdown tables.** In GFM, a pipe inside a code span still splits the cell. The FN/AC columns of these rows shift, which is what broke the script trace. | Parsing SRS §3: the FN/AC cells of FR-19/22/23 are mis-read. | Escape the pipes (`t4\|t5`) in every table row. |
| AUD-M08-16 | Minor | SRS BR-M08-28, §6.10 S20, URS AC-32.5, E2E-56 | **The leaderboard merge rule creates a cross-viewer inconsistency.** Pelajar (70 week coins) is "#47" with 47 rows in their own view, but is absent from the admin's and every other viewer's week list (46 rows), because only the *viewer's* figures are merged. | Live week list for the admin (now 47 rows through data drift; discovery 46). | State explicitly that the merge is viewer-only (a prototype limitation, INFERRED), mark E2E-56 provisional, or seed the designed learners consistently without changing the admin's observed 46-row default. |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9/D10 and minimal? | Note |
|---|---|---|---|
| 01 | Yes. The S1, S6, S12–S15 and S19 header reads "Dashboard" / "Selamat datang kembali" (screenshots). | Yes | Titles come from the page's own tab or h1. |
| 02 | Yes for the admin (`/analisa-item` → `/dashboard`, no flash). | Admin: yes. Teacher: unverified | AUD-06 |
| 03 | Admin 403 yes. The other roles are not observed. | **No** | AUD-03 |
| 04 | Admin 403 (discovery). | Admin: yes. Teacher: unverified | AUD-06 |
| 05 | Yes: S1 "11 kelas 148 murid 10 sesi 63.9%" / "560 · 3467 · 25716 · 79.8%" vs S2/S3 13/149 and 645/3911/29,971/79.7%. | Acceptable. T4 + T5 < the school totals, and the 92 classes without a level explain an overall 79.8% above both levels. | Note the T4 table contradiction (AUD-05). |
| 06 | Yes: `/prestasi/kelas/sc-1` → 404, and the T4 rows link to sc-419 and sc-806. | Yes | — |
| 07 | Yes: S5 class 228 first row 125%; S20 all-time "101% ketepatan". | Minimal. It hides the value but creates no visible contradiction (no total is derived from the capped values on the same screen). | — |
| 08 | Yes: `/prestasi?{id}` → `/prestasi/sekolah`. `/prestasi/{id}` = 200 and the same person (name equality checked in the page, 3 of 3). | Yes. This is the intended target. | — |
| 09 | **No.** The RS point renders on live. | **Not a defect** | AUD-02 |
| 10 | Yes: 375 px scrollWidth S7 418 and S20 385. S6 overflow depends on the chip count (a sampled student fits at 360). | Yes | — |
| 11 | SOURCE-DERIVED (server-rendered "0"). | Yes | — |
| 12 | Yes. The pill reads "Sederhana" `text-blue-400`, while the tooltip rule gives ≤ 4 "Baik". The chart shows subject 2026 points 2.5–3.2 as "(Baik)". | Yes. Only the label changes. | — |
| 13 | Yes for SEJ (8/2) only. | Over-broad | AUD-14 |
| 14 | Yes. 6 of 34 links have label ≠ count (50→25, 44→25, 56→25, 39→25, 30→25, 320→25). | Yes | — |
| 15 | The select is empty for the admin, by the own-class rule. | **No (D10)** | AUD-04 |
| 16 | Yes: "A--A+", "C-A-", "D-A-", "G-C". | Acceptable (one consistent format on S7 and S8). | — |
| 17 | Yes. After "Paling Mudah Dahulu" and "fact", all 596 rows are still visible in the same order. | Yes. The options exist, only the binding is missing. | — |
| 18 | Yes: S7 22 elements below 12 px, S12 4 at 375 (10 px), S18 "🥉 Bronze" 11 px, "Kombo" and "🎯 Tepat" 10 px. | Yes (precedent) | — |
| 19 | Yes: `onclick="navigator.clipboard.writeText('https://prestasiplus.my/pelajar/3') … setTimeout(…, 2000)"`, and `/pelajar/3` → 404. | Yes | The 2,000 ms is verified. |
| 20 | Replicated: admin "0 Sesi Kuiz", "Sudah 127 hari tiada latihan". | Correct | — |
| 21 | **The "always red" premise is false.** | Pill part: not shown to be D9 | AUD-02 |
| 22 | Negeri, daerah and sekolah scopes show "Nasional" (yes). | Acceptable, but the evidence is inaccurate for daerah+negeri. | AUD-09 |
| 23 | Replicated: the Negeri select on negeri and daerah has 2 options. | Correct | — |
| 24 | Yes: GET `/timeline/1` → 405 "An Error Occurred: Method Not Allowed", and nothing links there. | Acceptable (English framework error page, unlinked). | — |
| 25 | Replicated: 256 / 103 / 342,703 / 26. | Correct | — |
| 26 | **The correction is verified.** The order is ascending Betul in three data states: all (960 < 2,223 < 5,293 < 17,612), Matematik (6 < 128 < 530 < 889) and BM (26 < 427 < 608 < 1,505). | Correct (unsure → follow live) | Live now has 4 ranked students (drift). |
| 27 | Replicated: the chart has the subject 2026 values, and the table reads "2026 Semasa Tiada data". | Correct | — |

## Darjah 4 vs Darjah 6 (admin grade)

**Both values are real on live. They are two different fields, so M01 and M08 are each right for their own screen.**

- **Darjah 4** comes from the account grade:
  - `/profile/edit` shows the radio group `grade` 1…6 with **value 4 checked** ("Darjah 4"), which is the M01 profile form (M01 AUD-M01-07, correct).
  - The same grade drives S7: the map captions read "KSSR Bahasa Melayu Darjah 4" / "KSSR Sejarah Darjah 4", and the "Latihan Fokus" links carry `level=4`.
- **Darjah 6** appears only on the public profile `/pelajar/1` (S18): the chip `fa-layer-group` "Darjah 6".

M08's choice is correct: keep `profileLevelId 6` for S18 and M01 grade 4 elsewhere (OQ-M08-05). M01 needs no change. OQ-M08-05 can be reworded from "M01 to confirm" to "observed: two sources; replicated".

## Coverage spot-check (32 rows, all correct)

S1-005 "🏫"→2.1.1 · S1-043 "125"→2.1.4 · S1-081 "Sederhana" (trend Tahap)→2.1.5 · S3-001 "404"→1.2.3 · S3-039 "Lihat →" /prestasi/kelas/4→2.3.4 · S3-077 "4 sesi · 50 soalan"→2.3.5 · S3-115 at-risk link→2.3.6 · S5-018 "0"→2.5.3 · S5-056 "Halaman Utama"→1.2.3 · S6-016 "74.0%"→2.6.2 · S6-054 "1"→2.6.5 · S6-092 "Fokus 25"→2.6.7 · S6-130 "Halaman Tidak Dijumpai"→1.2.3 · S7-034 "Bahasa Melayu · 1 soalan dijawab"→3.1.3 · S7-072 "Belum Cuba"→3.1.8 · S8-004 form→3.2.1 · S8-042 "Rendah"→3.2.4 · S10-011 "sains rumah tangga"→4.2.2 · S11-036 difficulty row→4.3.6 · S11-074 "Data Tidak Mencukupi"→4.3.11 · S12-030 "T1"→5.1.4 · S13-026 "On Track:"→5.2.4 · S14-032 "Cipta Headcount"→5.3.5 · S15-038 "Meningkat"→5.4.3 · S16-011 `/pelajar/3`→6.1.3 · S18-014 "Ahli sejak 25 Oktober 2025"→6.3.3 · S18-052 "Ingin menyokong pelajar ini?"→6.3.7 · S19-025 "Tahap"→7.1.5 · S19-063 "Daerah" pill→7.1.2 · S20-037 "787"→7.2.4 · S21-004 403 text→8.1.1 · SHU-390 "<school> — Tingkatan 4"→1.1.3.

## Claims verified against live (64)

✓ = correct; ✗ = incorrect or incomplete (the finding is named).

1. ✓ `/prestasi` → `/prestasi/sekolah`, tab "Dashboard Sekolah — Prestasi"; the header reads "Dashboard" (DV-01).
2. ✓ S1 h1 and "Ringkasan prestasi keseluruhan · 750 kelas · 4533 murid".
3. ✓ GPS card: "3.45", "GPS", pill "Sederhana" `text-blue-400 border-blue-500/40`, "Berdasarkan 744 entri headcount", footnote.
4. ✓ GPS = 2569 ÷ 744 = 3.45 from the live distribution A+ 125 · A 146 · A- 96 · B+ 47 · B 107 · C+ 24 · C 23 · D 76 · E 28 · G 72.
5. ✓ Distribution percentages 16.8 / 19.6 / 12.9 / 6.3 / 14.4 / 3.2 / 3.1 / 10.2 / 3.8 / 9.7, and "Jumlah: 744 rekod".
6. ✓ Chart script: labels 2022–2026, overall [5.2, 4.8, 4.5, 4.3, null], 6 subject series with the exact values and colours, and the point colour rule ≤2/≤4/≤6.
7. ✓ Tooltip "Tahun {x}", "{ds}: {v.toFixed(2)} (Cemerlang|Baik|Sederhana|Perlu Perhatian)" / "Tiada data"; y reversed 0–9 with the "A+ (0)"… ticks; `gpsBands`; 800 ms easeInOutQuart; legend top/start circles.
8. ✓ Trend table: 2022–2025 rows exact, "▼ 0.4/0.3/0.2", and "2026 Semasa Tiada data — — — —".
9. ✓ The subject GPS table has 18 rows, exactly as discovery A.2.
10. ✓ Pencapaian width = round((9.5 − GPS) ÷ 9.5 × 100) on all 16 rows (97, 90, 85, 80, 79, 74, 73, 71, 70, 66, 64, 62, 61, 58, 52, 25); no bar on the "—" rows.
11. ✓ Gred = grade at round(GPS) (2.50 → B+, 3.56 → B, 4.54 → C+, 4.00 → B).
12. ✓ S1 level cards "11 kelas 148 murid 10 sesi 63.9%" / "560 · 3467 · 25716 · 79.8%" (DV-05 evidence).
13. ✓ The teacher box has 310 cards, `space-y-3 max-h-96 overflow-y-auto`.
14. ✓ The quick links lead to `/prestasi/tingkatan`, `/prestasi/kelas`, `/headcount` and `/analisa-item/sekolah`.
15. ✓ S2 "13 kelas | 149 murid", "645 kelas | 3911 murid".
16. ✓ S3 t4/t5 titles and subtitles ("· 13 kelas · 5 subjek", "· 645 kelas · 26 subjek"); t1 and t3 → 404.
17. ✓ S3 T5 has 645 rows on one page; the T4 table has 13 rows.
18. ✗ The T4 row values are observable, but the seed uses filler. The table does not agree with the cards (AUD-05).
19. ✓ T4 Murid Terbaik "3 sesi · 30 soalan", "4 sesi · 60 soalan"; T5 has 10 rows as listed.
20. ✓ Murid Berisiko has 15 rows on T4 and T5, all linking `/prestasi?{id}`.
21. ✓ DV-08: `/prestasi/{id}` is 200 and the same student.
22. ✓ S5 class 228: 93 · 77.6% · 1618 · 34882 · 10.4m · 2; "Tukar Kelas..." shows only the placeholder; 57 attention rows; 93 ranking rows; first row 125%.
23. ✓ S5 class 4: 58 · 0% · 0 · 0 · 0m · 0; 58 "Tak Aktif"; no trend script.
24. ✗ S5 "inactive last" and the "—" cells are OBSERVED, not INFERRED (AUD-10c).
25. ✗ The S5 Headcount badge "On Track"/"Below" is observable (class 516), not PROPOSED (AUD-01).
26. ✓ S6 `/prestasi/1`: "0%" "1 Hari Kombo"; 0 / 0.0% / 0 / 0m; Aktiviti 1 / 5 / 342,703 / 13; "Sudah 127 hari tiada latihan…" + "Mulakan perjalanan…"; "Tiada topik lemah! Teruskan usaha."
27. ✓ Heatmap first cell `@click` toggle and `@mouseenter`/`@mouseleave` "28/06 (Ahad) — Tiada aktiviti".
28. ✗ The S6 chip row omits OTRs without an AR (AUD-08).
29. ✓ S7 `x-data` `activeSubject: 1`, `weakTopicCounts {"5":13,"1":17}`; tabs "Bahasa Melayu 41%", "Sejarah 35%".
30. ✓ The top-4 links read `level=4&dskp_sp_id=221/206/222/214&count=16/16/7/12`.
31. ✓ The cap of 25: 6 labels differ from their link `count` (DV-14 evidence).
32. ✓ Rings "3 / 3 SP" (`314 0`) and "8 / 2 SP" (`1256 -942`); legends 3·6·17·0 and 8·2·13·0; KPIs 40.5% / 79 / "G-C" and 35.0% / 40 / "G-D"; message box; maps "KSSR … Darjah 4".
33. ✗ DV-13 also changes the BM ring (AUD-14).
34. ✓ S8 empty: select with 0 options, `onchange="this.form.submit()"`, "Tiada data analitik untuk kelas dan subjek ini."
35. ✓ S8 `?classroom_id=4`: 10 subjects with BM selected; cards 6 · 0.0% · 0 · 4; ranges E-B, D-A-, A--A+, C+-A, G-B, C-A-; risks S, R, R, R, S, R; links to `/analitik/kelas/pelajar/{id}`.
36. ✓ S9 `?tingkatan=T4`: "0 Pelajar 0 Jawapan", the chips, "Tiada Data Pelajar" plus the text.
37. ✓ S10 has 750 cards; the first three are 1156 "5 CYBER" JOV330, 1155 "sains rumah tangga" 0VV295, 1154 "Chaos Academy" PVZ601.
38. ✗ S10 order: not id-descending (AUD-07).
39. ✓ S11 class 228: 596 rows; cards "381 Mudah 64%", "78 Sederhana 13%", "137 Sukar 23%" (labels `uppercase`); 750 "Tukar Kelas" chips.
40. ✓ Tahap bands on 596 rows: Sukar 0.75–1.00, Sederhana 0.33–0.67, Mudah 0.00–0.25 (cut-offs 0.30/0.70 INFERRED and consistent); default order index descending.
41. ✓ Ketepatan colours #DC2626 (0–33.3), #D97706 (40–66.7), #16A34A (75–100).
42. ✓ Discrimination status bands on 596 rows: Sangat Baik 0.40–1, Baik 0.30–0.375, Sederhana 0.20–0.286, Lemah −1…0.167; index colours green ≥ 0.30, amber 0.20–0.29, red < 0.20.
43. ✓ The search and sort controls sit under `x-show="activeTab === 'difficulty'"` (hidden on the discrimination tab).
44. ✓ D-15 reproduced: the sort and search have no effect.
45. ✗ The Sederhana and Mudah pill icons and colours are observable (AUD-10b).
46. ✓ S12 modal: `@keydown.escape.window` closes it (Esc is OBSERVED in the source), the backdrop `@click` closes it, `@click.stop` sits on the card, `:disabled="selectedLevels.length === 0"`, "Auto-Setup" resets `selectedLevels = []`, and the transitions are 200/150 ms.
47. ✓ S13 empty: "Semua", "Konfigurasi", "0", "Belum ada headcount.".
48. ✓ S14: POST `/headcount`, no `novalidate`; `required` on classroom (1 option), subject (32), level (3) and year (min 2020, max 2100, value 2026); "3 OTR" and "Auto" checked.
49. ✗ The S15 populated states (RS row, prediction box, statuses, icons, Menurun, Rendah) are missing (AUD-01).
50. ✗ DV-09: the RS point renders (AUD-02).
51. ✗ DV-21: the Gred AR pill is green when AR ≥ target (AUD-02).
52. ✓ S16: copy `onclick` writes `/pelajar/3`, `fa-check` for 2,000 ms; the link has `target="_blank"`.
53. ✓ S17: `enctype multipart/form-data`; title required, maxlength 150; category required; `event_date`; story maxlength 2000; `photos[]` accepts jpeg/png/webp, `multiple`, and is **not** required.
54. ✓ S17 script: 5-file cap, `alert(f.name + ' terlalu besar (maks 2MB)')`, previews, captions maxlength 200.
55. ✗ The captions are cleared on every add or remove (AUD-13).
56. ✓ S18 `/pelajar/1`: "334 hari bersama", "Ahli sejak 25 Oktober 2025", "🪙 Syiling 103", "397 syiling lagi ke Silver", "Teruskan usaha Admin!", chip "Darjah 6"; public 200 for a guest.
57. ✓ S19 pills keep the filters (`?subject_id=3&scope=negeri`, `?negeri=Selangor&scope=daerah`, `?tingkatan=T4&scope=…`); unknown scope → no pill active; the Negeri select (2 options) appears on negeri and daerah only; negeri/daerah/sekolah/T4/T5 → empty state.
58. ✗ The S19 footer appears on nasional only, and the daerah+negeri title stays "Nasional" (AUD-09).
59. ✓ S20: no, `week` or unknown `period` → "Minggu Ini" active; 50-row cap on month and all; "{rows} peserta bersaing"; the subtitle is unchanged on every period; all-time "#1050 · 26 · 4 · 22%"; "101% ketepatan".
60. ✓ S21 `/laporan-mingguan` and `?week=1` → 403 with the exact tab title.
61. ✓ 404: `/prestasi/99999999`, `/headcount/student/99999999`, `/pelajar/3`, `/pelajar/99999999`, `/analitik`, `/analitik/guru`, `/analisa-item/pelajar`, `/headcount/1`, `/prestasi/kelas/sc-1`. 403: `/analisa-item/kelas/99999999`.
62. ✗ The guest redirects are OBSERVED, not INFERRED (AUD-10a).
63. ✗ The table headers are upper case by CSS, which is not stated (AUD-12).
64. ✓ Darjah: `/profile/edit` grade 4 checked; `/pelajar/1` "Darjah 6".

## Seed check

- **Admin mirror.** These match live: the S1 snapshot values, the S2/S3 cards, the S5 classes 4 and 228, S6 `/prestasi/1`, the S7 records and counts, the S8 class 4 profiles, the S10 first rows, the S11 class 228 summary, S18 and the S20 own figures. **Exception: the S3 T4 table rows (AUD-05).**
- **Filler.** The filler lists are labelled (`observed:false`, SQ-M08-02) and keep the observed counts (310, 645, 57, 93, 750, 596, 1,049). The E2E never assert filler content. No default admin list shows more rows than live. The designed classes change the position of the first S10 rows (AUD-07), not the count.
- **Designed data.** The ids are consistent with M01 accounts (integer ids proposed in OQ-11), M03 subjects and levels, M04 fixture ids, and the M05 sessions A2–A5 and P1–P4. The anchor arithmetic for class 2001 was re-computed and is correct: accuracy 8/9, 5/10, 3/8, 3/9, 1/8; difficulty indices; D with g = 2.
- **Data drift since discovery.** This is informational; the seeds correctly mirror the discovery snapshot:
  - `/ranking` now lists 4 students: a new L7 960 85.64% row, and Matematik adds L0 6 30.00%;
  - the week leaderboard has 47 rows;
  - the month podium #1 shows 5,183.

## Re-audit scope

AUD-M08-01 needs a short, read-only discovery top-up on lane 1 or 3. Fixing it will move text between PROPOSED and OBSERVED in the URS §3, §6 and §9 and the SRS §3, §4 and §8. After the writer's fixes, a targeted re-audit of AUD-01…05 and a spot-check of the minors is enough.

---

# Round 2 (targeted re-audit of URS/SRS v1.1 + v1.2)

| Field | Value |
|---|---|
| Date | 2026-09-25 |
| Auditor | The same independent agent, browser lane 3 (`playwright3`), read-only. |
| Documents | <ul><li>URS v1.2 (2,515 lines) and SRS v1.2 (680 lines).</li><li>Discovery top-up §2.22, with S22/S23 and 1,553 elements.</li><li>TRACKER D11/D12 and the canonical ids table.</li></ul> |
| Safety | <ul><li>**Read-only:** only same-origin GETs (≥ 400 ms apart) of `/headcount/213`, `/headcount/213/summary`, `/prestasi/kelas/516` and `/prestasi/tingkatan/t4`.</li><li>**Not done:** no form was submitted, no modal was confirmed, no export or quiz URL was opened.</li><li>**Personal data:** no pupil name, school or id was written to any file. The pupil marks below are quoted without names. One screenshot, `img/M08/r2-s22-otr3-split.png`, which contains no pupil data.</li><li>**Scratch files:** in `<scratchpad>/m08-audit/`.</li></ul> |

## Round 2 verdict: **FAIL**

There are **0 Critical, 2 new Major and 3 new Minor** findings. All 16 round-1 findings are **closed**.

The two new Majors are both seed or rule errors in the new headcount data.

**R2-01.** The S22 "Above / On Track" bounds contradict live counts. The class-516 Sejarah seed (config 213) invents 10 of the 15 pupil mark pairs, even though live shows all 15. Those invented values are tuned to hit the observed averages and the wrongly-bounded split.

**R2-02.** Designed config 504 is a Tingkatan 4 config, so it adds a student × config pair to the T4 aggregate. That changes the observed S3 T4 "Below Target: 41" to 42, and it pushes a new row into the observed 15-row "Murid Berisiko" list.

## Re-checks

| Check | Result |
|---|---|
| Coverage (checked by script) | 1,553 / 1,553 inventory IDs appear in URS §6, with 0 missing, 0 extra and 0 duplicates. There are 63 exclusions: the 57 from round 1 plus S22/S23-001–003. All 63 are the M16 tournament banner. |
| Traceability (checked by script) | <ul><li>146 FN → 140 FR: every FN is cited.</li><li>151 AC: each has ≥ 1 FR and ≥ 1 E2E.</li><li>Each of the 140 FR has ≥ 1 E2E.</li><li>69 E2E; 0 dangling references.</li><li>The escaped pipes now parse (AUD-15 is closed).</li><li>22 E2E are marked provisional.</li></ul> |
| Canonical ids | <ul><li>Users 1–11 follow the TRACKER table (admin 1, pelajar 2, pelajar2 3, pelajarmaju 4, guru 5, adminsekolah 8).</li><li>The M08 anchors 3001–3008 and 3201–3215 are listed in the TRACKER.</li><li>The old draft ids 1001–1007 are gone (grep finds 0).</li></ul> |
| Real names | Grep of URS, SRS and discovery for `bin`/`binti` and for real school-name patterns: 0 hits. The seed names are fictitious ("Murid Demo 0n", "Murid Simulasi 01…15", "Cikgu Demo A…", "Nur Aina Demo"). |
| Counts | <ul><li>Availability counts use M04 Q-ELIGIBLE (§4.1).</li><li>The platform figures are D11 allocations. **GPS:** the per-subject point sums re-add to 2,569 over 744 entries, and every subject GPS re-computes to its A.2 value.</li><li>The 5-year history is a documented display constant (DV-27).</li></ul> |
| Live re-verification | <ul><li>S23 `/headcount/213`: "On Track: 6 (40%)", "Below: 9 (60%)", "Belum Diisi: 0", "Jumlah: 15"; the "Purata Kelas" row is 62.1 B · 67.1 B+ · 72.1 A- · 77.1 A- · 71.9 A- · 71.9 A-; tab "Headcount Sejarah - PRESTASIPLUS"; header "Dashboard" (DV-01 applies).</li><li>S22: 15 · 62.1 · 71.9 · 3; OTR1/OTR2 "N/A: 15"; OTR3 "Above: 5 · On Track: 2 · Below: 8 · N/A: 0"; the legend; tab "Ringkasan Kelas - PRESTASIPLUS".</li><li>S5 516: the block reads "7 On Track / Above", "8 Below Target", "0 Tiada Data", "Purata TOV: 62.1%", "Purata ETR: 71.9%", "Lihat Penuh →" `/headcount/213/summary`. The bar is 46.67 / 53.33 / 0%. The badges are `badge-on` ×6 and `badge-below` ×9, and `badge-na` also styles the 15 "Tak Aktif" badges.</li><li>S3 T4 cards: "34 On Track", "Below Target: 41".</li><li>**All of this matches FN-2.5.7, FN-5.5.x, FN-5.6.x and FR-36, as written.**</li></ul> |

## Round-1 findings: status

| ID | Status | Evidence in v1.1/v1.2 |
|---|---|---|
| AUD-M08-01 | **Closed** | <ul><li>**S15:** FN-5.4.3–5.4.6 and FR-94/96/127 cover the statuses and colours, the RS badge, chip and row with "Direkod: {d MMM yyyy}", "Menurun" and "Rendah", and the three prediction-box variants with their exact notes.</li><li>**S6:** FN-2.6.3 and FR-39 cover the pills "On Track" / "Below" / "—" and the chip row.</li><li>**S5:** FN-2.5.6/2.5.7 and FR-36 cover the badges and the block.</li><li>**S22/S23:** new FT-5.5/5.6.</li><li>The copy and classes match the live markup read in rounds 1 and 2. PROPOSED COPY no longer includes live strings.</li></ul> |
| AUD-M08-02 | **Closed** | DV-09 is withdrawn (FN-5.4.4 OBSERVED). DV-21 is narrowed to the no-target pill: green and red are kept, and only slate replaces live red (a DL decision, alternatives listed). |
| AUD-M08-03 | **Closed** | DV-03 is withdrawn. AC-01.1 lists "Laporan Mingguan". FR-119 is for the admin only. E2E-57 asserts the admin only; the other roles are BLOCKED (OQ-01). |
| AUD-M08-04 | **Closed** | DV-15 is withdrawn. BR-26: own classes only, so the admin's list is empty, as live. E2E-26 is updated. |
| AUD-M08-05 | **Closed (rows)** | <ul><li>The 13 T4 rows are seeded and asserted exactly (SRS §6.10, AC-10.1/10.2), matching the round-1 live read.</li><li>The table-vs-cards contradiction is recorded as DV-28, with the definitions documented (BR-07/08/09) and "Jumlah Sesi" set to 11 (DL decision).</li></ul> See **R2-02** for a new seed side-effect on the T4 cards. |
| AUD-M08-06 | **Closed** | DV-02 and DV-04 are scoped to the admin. The teacher and student outcomes are INFERRED, and E2E-04 is marked provisional. |
| AUD-M08-07 | **Closed** | BR-30 is the order rule (`createdAt` descending, batches by id ascending). The designed classes are dated 2026-01-06. E2E-30 asserts that 1156, 1155 and 1154 come first. |
| AUD-M08-08 | **Closed** | FR-39 shows OTR chips only where there is an AR. AC-14.2 is updated. |
| AUD-M08-09 | **Closed** | FR-112 shows the footer on the nasional scope only, which matches live. FR-108 and DV-22 now have correct evidence, with daerah+negeri → "Daerah". |
| AUD-M08-10 | **Closed** | FR-05 guest 302 and public `/pelajar` are OBSERVED. The FR-68 Tahap pills are OBSERVED with exact colours. FR-36 marks "—" as OBSERVED. |
| AUD-M08-11 | **Closed**, with a residual | 22 E2E are provisional (whole or in part). See R2-04 for one remaining unmarked INFERRED order. |
| AUD-M08-12 | **Closed** | "Upper case by CSS" is now on FR-18, 26, 36, 57, 65, 68 and 72. S20 is marked "not upper case" (AC-32.1). |
| AUD-M08-13 | **Closed** | DV-30 keeps the captions (DL decision), in FR-101 and E2E-69. |
| AUD-M08-14 | **Closed** | DV-13 is narrowed to numerator > denominator, with the alternatives recorded. See R2-03 for a stale example. |
| AUD-M08-15 | **Closed** | The script trace now parses every row. |
| AUD-M08-16 | **Closed** | BR-28 makes the leaderboard one shared list. Week = 5 observed + 33 generated + 8 designed = **46**, the same for every viewer. Pelajar is #39 (70 coins, below the lowest generated 300). The admin keeps "#-"; the all-time "#1050" re-computes (1,042 + 5 + 2 above). |

## Round 2 findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M08-R2-01 | **Major** | SRS BR-M08-08 rule (2), §6.10 "Class 516 … Config 213" row; URS FN-5.5.3, FN-2.5.7 wording; SRS E2E-M08-63, E2E-M08-64; discovery §2.22.5 "Rule (INFERRED exact bounds)" (report to the discovery owner) | **The S22 split rule contradicts live, and the config-213 seed is tuned instead of mirrored.**<br>(a) **Bounds.** BR-08 (2) defines Above = AR > OTR + 2 and On Track = OTR − 2 ≤ AR ≤ OTR + 2. The live S23 table has these 15 OTR3/AR3 differences: +5, 0, +6, −2, **+2**, +8, −14, +3, −18, −4, −15, −13, −4, −26, −6. Live S22 shows **Above 5 · On Track 2 · Below 8**, so the +2 pupil is counted as **Above**. Under BR-08 the same data gives Above 4 · On Track 3. The live split fits Above = AR > OTR (or ≥ OTR + 2) and On Track = OTR − 2 ≤ AR ≤ OTR. The DV-29 total (On Track + Above = AR ≥ OTR − 2 → 7 / 8) is **not** affected.<br>(b) **Seed.** The S23 table showing all 15 TOV/AR3 pairs was observed. The seed mirrors only 5 of them (67/56, 68/65, 46/57, 59/61, 64/64). It invents the other 10 (62/58, 59/57, 60/62, 60/76, 62/76, 63/85, 64/87, 65/89, 66/91, 67/95), chosen so that the averages (TOV 62.1, AR 71.9) and the wrong-rule split 5/2/8 come out. This is the "seeds tuned to totals" error (CLAUDE.md §6).<br>With the live pairs the observed marks are TOV 73, 76, 69, 68, 63, 54, 74, 55, 68, 54, 64, 59, 46, 67, 42 and AR3 93, 91, 90, 81, 80, 77, 75, 73, 65, 65, 64, 61, 57, 56, 51 (row order = `?sort=ranking`). | <ul><li>`/headcount/213` rows (numeric cells read; names not recorded).</li><li>`/headcount/213/summary` OTR3 counts.</li><li>AR cell classes: `bg-green-100` on the 6 rows with AR ≥ OTR.</li><li>Screenshot `img/M08/r2-s22-otr3-split.png`.</li></ul> | <ul><li>Seed config 213 with the 15 observed TOV/AR3 pairs, keeping OTR = TOV + 5/10/15 and ETR = AR3 as live, with fictitious names 3201–3215 mapped in live rank order. Keep the 3201–3203 S15 anchors, which are among them.</li><li>Correct BR-08 (2) to the bounds the data supports: Above when AR > OTR (INFERRED between > OTR and ≥ OTR + 2), On Track when OTR − 2 ≤ AR ≤ OTR, Below when AR < OTR − 2. Correct the FN-5.5.3 and discovery wording.</li><li>Re-derive E2E-63 (5/2/8) and E2E-64 (which rows are green under DV-29), and the configs 209–212 constraints that depend on 213.</li></ul> |
| AUD-M08-R2-02 | **Major** | SRS §6.10 designed config 504 (`2001 · Sejarah · 10 · 2026 · 2 · auto`, 3001 targets 55/60, actuals 40/45); BR-M08-07; URS AC-10.4, AC-09.2/09.3 | **Designed data changes observed admin figures on S3 T4.** BR-07 counts On Track / Below as "student × headcount-config pairs of configs of level L". Config 504 has `educationLevelId` 10 (T4), so 3001/504 is a 76th T4 pair, and it is Below (AR 45 < 60). Its effects:<ul><li>The S3 T4 card "Below Target" becomes **42** (live 41). The legend becomes "Below Target: 42", and the bar widths change.</li><li>It is a Below pair with a target and an AR (gap −15), so it enters the T4 "Murid Berisiko" top 15 (live gaps −26 … −13, −10). The observed "-10" last row asserted by AC-10.4 drops out.</li></ul>The T4 cell has no generated slack to absorb it: §6.3 says the T4 pairs are exactly the 75 of class 516. Configs 503/505 (BM) now sit on class 2002, which v1.2 renamed "5 MARIKH - Sejarah". That is not a live rule violation (S14 allows any subject), but it is stale from the rename. | S3 T4 live: "34 On Track", "Below Target: 41" (re-checked). The T4 at-risk gaps, from round 1. | Make config 504 a T5 config (`educationLevelId` 11, where generated pairs absorb it) or drop it, and re-derive the S13 "Tingkatan 4" filter anchor (1 · 8 · 0 · 1). Alternatively, state in BR-07 that the admin's level aggregate excludes designed teacher data. Either way, the S3 T4 cards and at-risk list must re-compute to the observed values. Re-check the configs on class 2002 against its v1.2 subject. |
| AUD-M08-R2-03 | Minor | URS §7 DV-M08-13 ("otherwise live ('3 / 3 SP', '1 / 8 SP')") | Stale example. v1.2 removed the progressing student's S7 data (no-data state), so no "1 / 8 SP" ring exists in live or seed data. | URS AC-18.5 (no-data state). | Remove "1 / 8 SP". |
| AUD-M08-R2-04 | Minor | SRS E2E-M08-18; URS AC-14.2 | E2E-18 asserts the S6 card order "504, 501, 502, 503, 505". That order comes from the INFERRED "newest update first" rule (FR-39 INFERRED), but the step is not marked provisional (the AUD-11 residual). | FR-39 "(INFERRED)". | Mark the order step provisional (or split it). |
| AUD-M08-R2-05 | Minor | SRS §6.10 designed classes table ("2002 … Sejarah 5 / 11"); URS/SRS change log v1.2 | The TRACKER M08 line says "class 2002 = Sejarah T4". The SRS makes 2002 a **T5** class (level 11) that answers the **T4** Sejarah anchors 700201–700215. That is deliberate (a T4 class would add a 14th S3 T4 row) and is allowed by live (class 228 is tingkatan-5 with "English Form 4" items), but no document states it. | — | Add one sentence: class 2002 is T5 using T4 Sejarah items, and why. Have the Delivery Lead correct the TRACKER wording. |

## Spot-check of 12 edited passages

All correct as written, except where a finding is named:

1. FR-05: the guest 302 on eight routes and the public `/pelajar` are OBSERVED ✓.
2. FR-36: the badge classes and colours match the S5 516 page CSS classes ✓.
3. FR-39: chips only with an AR, and the pill copy ✓.
4. FR-49 / DV-13: narrowed rule ✓ (R2-03).
5. FR-63 / BR-30: S10 order ✓.
6. FR-68: Tahap pills OBSERVED with exact colours ✓.
7. FR-96: table states and the DV-21 slate pill ✓.
8. FR-101 / DV-30: caption persistence ✓.
9. FR-108 / FR-112: ranking title and nasional-only footer ✓.
10. AC-10.1–10.5: the 13 rows exact, and the DV-28 definitions ✓ (R2-02 affects 10.4 through the seed).
11. AC-32.1 / 32.5 / BR-28: one shared 46-row list ✓.
12. DV-29 wording: "On Track = AR ≥ OTR − 2 … S5 badges 7 / 8, S23 chips '7 (47%)' / '8 (53%)'". The totals and wording are correct and create no new same-screen contradiction: on S5 the block and badges now agree, and on S23 the chips and AR cells agree. The cross-screen difference to S15/S6 is documented. **Only the Above/On Track bound in BR-08 is wrong** (R2-01).

## Round 2 re-audit scope

Fix R2-01 and R2-02 (seed and rule edits), then run a targeted re-check of S22/S23/S3 T4 anchors and E2E-63/64. R2-03…05 are one-line edits.

---

# Round 3 (targeted check of URS/SRS v1.3; no browser)

| Field | Value |
|---|---|
| Date | 2026-09-25 |
| Method | <ul><li>A document read of SRS v1.3 (§6.10, BR-M08-07/08, E2E-18/39/40/63/64) and URS §7 DV-13.</li><li>Scripts `<scratchpad>/m08-audit/r3.js` and `cov.js`, checked against the round-1 and round-2 live observations: the S23 `/headcount/213` rows, S22 5/2/8, S3 T4 34/41 and the 15 at-risk texts in discovery Appendix B.</li><li>No live access.</li></ul> |

## Round 3 verdict: **PASS**

The findings are 0 Critical, 0 Major and 1 new Minor. All round-2 findings (R2-01 to R2-05) are **closed**.

## Round-2 findings: status

| ID | Status | Evidence |
|---|---|---|
| AUD-M08-R2-01 | **Closed** | <ul><li>**Seed:** the config-213 seed matches the 15 live TOV/AR3 pairs exactly, in `?sort=ranking` order (script: `pairs equal true`).</li><li>**Computed with OTR3 = TOV + 15:** S22 Above 5 · On Track 2 · Below 8 under the new BR-08 (2) edges (Above = AR > OTR; On Track = OTR − 2 ≤ AR ≤ OTR; Below = AR < OTR − 2). The live rule on S23 gives 6 / 9. DV-29 gives 7 / 8.</li><li>**Averages:** TOV 62.1, OTR1 67.1, OTR2 72.1, OTR3 77.1, AR 71.9. These equal the live "Purata Kelas" and are computed, not tuned.</li><li>**Labelling:** the edge that is still uncertain (> OTR vs ≥ OTR + 2) is labelled INFERRED.</li><li>**E2E-63/64:** the Above member is 3208 (+2); 3205 (0) and 3207 (−2) are On Track; the DV-29 green set is 3204–3209 and 3211 (7), red 8. All correct.</li></ul> |
| AUD-M08-R2-02 | **Closed** | <ul><li>**Config 504** is now level 11, inside the T5 allocation.</li><li>**Config 506** (class 2002, Sejarah, level 10) has no entries, and BR-07 now counts pairs as headcount entries. So no designed pair reaches the T4 aggregate, which stays at 34 / 41.</li><li>**Murid Berisiko:** the 15 T4 at-risk rows (5 from 213 and 10 from 209–212), sorted by gap, then config id, then user id, reproduce the observed list exactly, from "56/82 −26" to "83/93 −10", including the tie order (script: `at-risk order equal true`).</li><li>**Pair counts:** 209–212 give 28 / 32 on 60 pairs, plus 213 at 6 / 9, which makes 34 / 41.</li><li>**S13, re-derived:** 6 configs × 8 members = 48. On 3 (501: 3001 and 3003; 505: 3001) and off 3 (501: 3002 and 3004; 504: 3001). No data 42, and 3 ÷ 6 = 50%. The T4 filter shows only config 506: 1 · 8 · 0 · 0 with no on-track block.</li><li>**Check against observed figures:** config 506 adds no class, pair, entry or graded entry. S3 T4 (13 classes, 149, 34/41, at-risk), S1 (744 entries, level cards), S2 and every observed admin figure are unchanged. S13 is observed only as the admin's empty state, which is unchanged. **No new contradiction.**</li></ul> |
| AUD-M08-R2-03 | **Closed** | "1 / 8 SP" no longer appears in the URS (grep finds 0). |
| AUD-M08-R2-04 | **Closed** | The E2E-18 order step is marked provisional (INFERRED newest-update rule). |
| AUD-M08-R2-05 | **Closed** | SRS §6.10 states that class 2002 is a T5 class using the Sejarah T4 anchors, and why (it avoids a 14th T4 row; live class 228 mixes levels the same way). |

## Regression checks

- **Coverage** (`cov.js`): 1,553 / 1,553, with 0 missing, 0 extra and 0 duplicates. There are 63 exclusions, all the M16 banner.
- **Traceability:** 146 FN → 140 FR (all cited). All 151 AC have an FR and an E2E. All 140 FR have an E2E. 69 E2E, 0 dangling references.

## New finding

| ID | Severity | Doc + section | What's wrong | Evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M08-R3-01 | Minor | SRS §6.10 class 516 (configs 209–213 at-risk rows) | The seeded T4 "Murid Berisiko" list uses **9** distinct pupils (3201, 3202, 3203, 3207, 3210, 3212, 3213, 3214, 3215). Discovery §2.22 observed **11** distinct at-risk students behind the 15 rows, so the rebuild repeats names more often than live. The texts, gaps and order are exact, and the names are fictitious, so this is a structural detail only. | Discovery §2.22 "the 11 distinct at-risk students"; `r3.js`: `distinct pupils 9`. | Spread the 10 non-Sejarah rows over pupils so that 11 are distinct, keeping 3201's observed S6 values and the rule-(3) row 13 / 2. Alternatively, record this in §6.10 as an accepted simplification. |
