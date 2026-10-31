# v2 Admin-to-Student Content Pipeline (slug: `admin-student-pipeline`)

Status: G1 approved as D82; RE-SCOPED 2026-10-30 by D86 (release slicing below; nothing deleted, every story and AC is tagged R1, R2 or KIV). Owner: product-analyst. Track: Full.
Naming (user, 2026-10-30): V1 = prestasiplus.my, V2 = prestasiplus.cloud + admin, V3 = the new system (this repo's "v2"). In this document ".cloud" means V2.
Folds in the paused G1 `question-images-display` (US-11).

Inputs: `docs/discovery/cloud-student-mechanism.md` (cited as DISC §n); `docs/TRACKER.md` D28-D32, D41, D46, D53h, D72, D75-D80; `docs/requirements/v2-bijak-spm.md` (AC-07.4, NFR-03, US-34..40); `docs/requirements/v2-question-bank.md` (addendum 2026-10-29: JSON save, image file ids, kertas field, student image read: already done); evidence `analysis/activities-gap.md`, `formats-authoring-gap.md`, `process-root-causes.md` (session scratchpad); QLOAD rows in `docs/architecture/v2-backend-deviations.md` (805-810). Re-scope inputs: `docs/discovery/v2-parity/student.md`, `docs/discovery/v2-parity/admin.md`, `docs/requirements/v3-bijak-spm-scope.md` (defines R1).

---

## 0. Release slicing (D86)

**Scope (D86):** secondary students only (Tingkatan 1-5; Darjah out). Bijak SPM first; everything else KIV. Admin work is only what feeds the Murid 1.0 modules. **Principle (LEAD):** replicate what V2 production actually uses (approved modes: mcq 532, extended_essay 229, short_text 49, essay_choice 31, numeric 7; stimuli: passage, image, diagram, table, map, infographic, graph; usage: Databank 426 sessions, Simulasi 283 attempts, Aku Salah 94, Mock 26, Tracking A 18). Modes and stimulus kinds with 0 production rows are KIV, not gaps.

| Tag | Meaning |
|---|---|
| **R1** | Release slice 1 = Bijak SPM: paper hub, cover, attempt, 5 modes, 7 stimulus kinds, timer/autosave/Hantar, Semakan with self-mark, keyword suggestion, results/Cuba Lagi, Simulasi Kuiz, records on submit; Databank Soalan SPM fed by admin questions; admin: DSKP loader, Studio, PDF intake, Kontrak, Set Builder / Jana Kertas / review / Terbit, servability, Laporan Soalan, V2 Panel parity. Detail and new ACs: `v3-bijak-spm-scope.md` (R1-01..R1-21, 176 AC entries of which 81 new). |
| **R2** | Next: Tracking A, Mock K1/K2, Subjektif SPM, Latih Tubi / Soalan by Chapter / Soalan Aku Salah / Remedial bridge upgrades, Heatmap, other Murid 1.0 modules. |
| **KIV** | Kertas Subjektif (flag OFF in V2), games changes, Kawalan Ciri (unless R1 needs a flag), unused answer modes and stimulus kinds, teacher and Admin Sekolah features, everything else. |

Rules: a tag on a story is its highest slice; the AC table below is authoritative per AC. An AC tagged R1 applies, in R1, only to R1 activities (A02, A09, A10, A11 and the admin side); its other activities follow in R2. New R1 ACs are written in `v3-bijak-spm-scope.md`, not here.

**Activities (section 3)**

| Tag | Activities |
|---|---|
| R1 | A02 Databank Soalan SPM, A09 Simulasi / Bijak SPM, A10 Simulasi - Kuiz, A11 paper quiz view |
| R2 | A01 Latih Tubi SPM, A03 Tracking A, A04 Mock K1, A05 Mock K2, A06 Subjektif SPM, A07 Latihan Berstruktur, A12 Soalan by Chapter, A13 Soalan Aku Salah, A14 Remedial (Aku Salah is not in the Murid 1.0 column; kept R2 for its 94 V2 sessions) |
| KIV | A08 Kertas Subjektif, A15 Pembetulan, A16 Penguasaan, A17 Misi Harian, A18 Set Soalan Guru, A19 PKSK, A20 Audio KBAT, A21 Battle, A22 Zona Permainan, A23 v2 solo games |

**Stories**

| Story | Tag | Note |
|---|---|---|
| US-01 | R1 | |
| US-02 | R1 | AC-02.8 KIV; AC-02.6 R1 for PDF upload and item review only |
| US-03 | R1 | AC-03.3 R2 |
| US-04 | R1 | R1 for Simulasi, Kuiz, Databank families; others R2 |
| US-05 | R1 | AC-05.7 R2 |
| US-06 | R1 | Admin Sekolah clause of AC-06.4 KIV |
| US-07 | R1 | |
| US-08 | R1 | AC-08.2 R2 |
| US-09 | R2 | Tracking A |
| US-10 | R1 | AC-10.11 KIV |
| US-11 | R1 | AC-11.12 R2 |
| US-12 | R2 | AC-12.1 R1 for A02 only |
| US-13 | KIV | |
| US-14 | R1 | Only AC-14.1, 14.2, 14.7; the rest KIV |
| US-15 | KIV | AC-15.3 R2 |
| US-16 | R1 | |
| US-17 | R1 | Tracking A editor screens R2, Kertas Subjektif list KIV |
| US-18 | R1 | AC-18.5 R2 (Tracking A) / KIV (Kertas Subjektif); R1 subsets noted in AC table |
| US-19 | R1 | AC-19.1 KIV, AC-19.3 R2 |
| US-20 | R1 | |

**ACs (all 155; R1 = 104, R2 = 18, KIV = 33)**

| Tag | AC ids |
|---|---|
| R1 (104) | 01.1-01.5; 02.1-02.7, 02.9; 03.1, 03.2, 03.4-03.9; 04.1-04.6; 05.1-05.6; 06.1-06.6; 07.1-07.10; 08.1, 08.3, 08.4; 10.1-10.10; 11.1-11.11; 12.1 (A02 only); 14.1, 14.2, 14.7; 16.1-16.6; 17.1-17.5; 18.1 (A02 and A10 only), 18.2, 18.3 (Simulasi part; A01 part R2), 18.4, 18.6, 18.7; 19.2, 19.4; 20.1-20.8 |
| R2 (18) | 03.3; 05.7; 08.2; 09.1-09.7; 11.12; 12.2, 12.4, 12.5, 12.6; 15.3; 18.5; 19.3 |
| KIV (33) | 02.8; 10.11; 12.3; 13.1-13.4; 14.3-14.6, 14.8; 14.9-14.25; 15.1, 15.2, 15.4; 19.1 |

Check: 104 + 18 + 33 = 155. Decisions DEC-1..DEC-5 and the traceability table stay valid; DEC-3 (Latih Tubi and Permainan visible at go-live) now applies from R2 for Latih Tubi and KIV for Permainan changes.

---

## 1. Summary and goal

**Problem.** In v2 the student portal behaves as if independent of the admin. Of 30 question-bearing student activities: 10 connected, 10 partial, 5 disconnected, 5 missing. Causes: Bijak "Percubaan" papers come from a flag-gated code fixture; the admin create path never marks a question for the SPM pool, so Latih Tubi SPM, Databank and Mock K1 never see it; Tracking A has no admin writer; practice and Bijak bridges silently drop image, stimulus, structured and table questions; five old activities are not built; levels D1-D6 are inactive so published questions vanish from the admin list; the lifecycle is long and the intake label "Terbit" does not publish.

**Goal (binding).** DSKP -> tagged question (admin) -> approved -> [Disahkan blueprint -> paper built or generated -> published] -> student activity. Every student activity reads ONLY admin-owned content: no code fixtures, no module-own question tables, no silent drops. For any question or paper the admin sees where students can see it.

**Decisions applied (not asked).**
- D79: Portal Pentadbiran absorbs admin.prestasiplus.cloud and .cloud `/admin`; follows the .cloud mechanism; UX (screens, steps, labels, order, number of actions) replicates .cloud; only the theme differs. New gates fit inside the .cloud flow and add no screens. Baseline = production .cloud, read-only.
- **DEC-1 (user, D80, confirms former AS-1):** the question gate is **Approved**, as in .cloud (DISC §0.1). The separate publish hop for questions (v2 D54a "published") is dropped. Papers still need `Terbit` (published). Admin path for a question = `Cipta baharu` -> `Simpan draf` -> `Hantar untuk semakan` -> `Terbitkan` (= Approved; 4 clicks, DISC §3.1).
- D53h/D76: questions tag curriculum nodes only; TP and cognitive level per leaf part; KBAT = Mengaplikasi/Menganalisis/Menilai/Mencipta. D75/D76/D78: blueprints per subject x kertas with exact unit quotas, TP profile, KBAT quota, "Disahkan" by Admin Pusat (2+ bodies); Jana Kertas fills exactly or refuses; "Pratonton kolam" shows the shortfall.
- **DEC-2 (user, D80):** untagged legacy MCQs stay servable in Latih Tubi, Bab and games; admin sees "Belum ditanda DSKP"; they are excluded from blueprint papers and Jana Kertas until tagged. The DSKP gate applies to new approvals only.
- **DEC-3 (user, D80):** Latih Tubi and Permainan are visible at go-live. Kertas Subjektif sits behind one flag, OFF, until its content exists.
- **DEC-4 (user, D80):** NO copy of .cloud questions or image files in this feature. Image-bearing .cloud items stay inactive under the existing QLOAD rule (production: 7,199 legacy questions with an image path, 1,343 stimuli with images; .cloud keeps images as files on disk, DB holds paths only). New images arrive through the v2 upload (already built).
- **DEC-5 (principle, D9):** v2 uses the approved whitelist everywhere. .cloud's pickers using "status != 'menunggu'" (Soalan by Chapter counts, 7 games excluding Battle, teacher Set picker; DISC §0.4) are inconsistent and count as broken.
- Already done (not re-specified): JSON save in the admin form, image upload as file ids, kertas field, student read of published question images (`docs/qa/question-bank-images-kertas.md`).

## 2. Users / personas

| Persona | Role in this feature |
|---|---|
| Admin Pusat | Creates, imports, tags, approves questions; maintains blueprints (Kontrak Simulasi) and verifies "Disahkan"; builds/generates/publishes papers; edits Tracking A sets; manages Kertas Subjektif papers. In .cloud only role `admin` writes; `admin_sekolah` and `pegawai_ppd` browse (DISC §0.5). |
| Admin Sekolah | Read-only on national content ("Diuruskan oleh Admin Pusat" padlock); in Mod Pelajar sees Disahkan only (D78 O-6). |
| Guru | Contributes questions (arrive as `menunggu`/review); builds Set Soalan Guru; reads student remedial progress. |
| Murid | Uses the activities in section 3; mobile first (375px); Bahasa Melayu. |
| QA | Needs a verifiable "admin enters -> student sees" path. |

## 3. Single content source per student activity (US-01)

Terms. **QB** = approved question in the one v2 question bank. **Q-gate** = QB state Approved, plus (new approvals) complete DSKP tag (US-03), plus the activity's shape rule (US-05). **P-gate** = paper state `Terbit` (published). Labels and rules below are from DISC §0.3, §2, §4.

| ID | Activity (BM label) | Reads (admin-owned) | Gate that makes it visible | Selection / display (.cloud) | v2 today |
|---|---|---|---|---|---|
| A01 | Latih Tubi SPM (`/latih-tubi`; v2 also `/practice`, `/spm/latih-tubi`) | QB MCQ by subject, optional Tahap Pendidikan, Tahap Kesukaran 1-5, chapter/topic | Q-gate; no pool flag; route flag `latih-tubi` ON (DEC-3) | Setup "Tahap Pendidikan" (incl. "Semua Tahap"), "Tahap Kesukaran", "Bilangan Soalan" 5/10/15/20 (1-50 with chapter/topic); random; one question per screen, "✓ Semak" -> immediate result, text + optional "Rajah soalan" | Partial / disconnected |
| A02 | Databank Soalan SPM (`/spm/tahun-lepas`) | QB MCQ by subject | Q-gate | Counts 5/10/20 (default 10); same quiz plus "Penjelasan:" after Semak when present; result with "Ganjaran Anda" | Disconnected |
| A03 | Tracking A SPM (`/spm/ramalan`) | Tracking A set (year + set number, member QB in order) edited by admin | Set filled to `target_count` of Approved questions (else `locked`) | Hub "Tracking A SPM", readiness ("Set Bersih", "Bank Besar", "Set Masih Lock"), "Pilih Set"; run = MCQ quiz with "Penjelasan:"; BM/BI go to Latihan Berstruktur Bahasa lane | Disconnected (seed only) |
| A04 | SPM Mock Exam Kertas 1 (`/spm-mock`) | QB MCQ by subject | Q-gate | Counts 5/10/20/40 (default 20); random; history "Mock Sebelum Ini"; letter grade | Disconnected |
| A05 | SPM Mock Exam Kertas 2 | QB structured by subject | Q-gate + marking scheme or rubric present | Counts 3/5/10 (default 3); breakdown on result | Connected |
| A06 | Subjektif SPM (`/spm/subjektif`) | QB structured; counts per subject | Q-gate + scheme/rubric present | Stats Teras/Elektif/Set; answering = Latihan Berstruktur | Partial |
| A07 | Latihan Berstruktur / Soalan Berstruktur | QB structured | Q-gate + at least one sub-question with a scheme or rubric point | Filters "Semua Subjek", "Aras KBAT"; "Mula"/"Cuba Lagi"; "Hantar & Semak"; notice for items awaiting scheme | Connected |
| A08 | Kertas Subjektif (K2/K3/K4, `/kertas-subjektif`) | Editable paper document (+ optional skema document), created by upload -> OCR -> sunting (D81, section 10.1) | `Terbit` on a non-empty document with no unreviewed flagged section; route flag `kertas-subjektif` (OFF, DEC-3) | Grouped by subject; viewer "{subject} — Kertas {k}" as reflowing text with figures, "Tunjuk Skema Pemarkahan"; self-check, no marking | Missing |
| A09 | Simulasi Peperiksaan / Bijak SPM (`/simulasi`) | Published paper (native or composite) | P-gate only. Native publish also Approves its own questions; composite publish freezes a snapshot of each member | Section 5 below (display engine) | Partial (fixture, bridge refusals) |
| A10 | Simulasi - Kuiz (`/simulasi/kuiz`) | QB MCQ parts with a correct option, on a published paper or paperless | Q-gate + one correct option | Counts 5/10/20/40 (default 20); "Simulasi — Kuiz"; "✓ Semak"; "Kuiz Selesai!" | Missing |
| A11 | Paper quiz view (`/simulasi/{paper}/kuiz`) | Published paper | P-gate | Paged by Bahagian; MCQ with "✓ Semak"; non-MCQ parts show a textarea that is not graded or saved; "Skor: x / y" | Missing |
| A12 | Soalan by Chapter (`/latih-tubi/bab`) | QB with chapter (DSKP node) | Q-gate (DEC-5: counts use Approved only) | Subject list with chapter and question counts; "Mula" hands to A01; locked chip "Tiada soalan" at 0 | Partial |
| A13 | Soalan Aku Salah (`/practice/revision`) | Pupil's latest wrong attempts, re-read from QB | Q-gate at replay time | Grouped by subject; same quiz as A01 | Partial |
| A14 | Ujian Remedial Saya (`/remedial/saya`) | Pupil's own attempt history (no question content of its own) | Flag `remedial` ON | Weak subjects (accuracy under 60), Sebelum/Selepas; onward practice = A01 | Partial |
| A15 | Pembetulan (`/pembetulan`) | Pupil's own wrong answers by month (`?bulan=YYYY-MM`) | none own | Wrong answers by subject; links to A01 | Missing |
| A16 | Penguasaan | No question content found in .cloud | [conditional: DISC gives no behaviour; AC-14.6] | unverified | Missing |
| A17 | Misi Harian (`/misi-harian`) | Challenge progress (no question content of its own); teacher creates missions | Flag `misi-harian` (state unverified, DISC §5.2) | Onward practice = A01 | Partial |
| A18 | Set Soalan Guru (`/set-soalan-saya`) | Teacher set (QB ids, `sort_order`) | Set `diterbitkan` + teacher owns a class of the pupil + items Approved at serve | Fixed order, options shuffled; same MCQ quiz | Partial |
| A19 | PKSK PRO (`/pksk`) | PKSK questions created in the admin question flow with PKSK tag | Approved + pupil has an active access grant | Counts per Bahagian/domain; list of first 50 only with grant; answering flow unverified | Partial |
| A20 | Audio KBAT | Admin-authored audio sets | as .cloud: unverified | unverified | Disconnected (own table) |
| A21 | Battle - Lawan Rakan | QB MCQ by subject | Q-gate (.cloud: diluluskan; not in `permainan` group) | Counts 5/10/15/20; duration 12 s per question | Connected / SPM mode not |
| A22 | Zona Permainan: Papan Bijak, Perang Fakta, Benteng Ilmu, Perlumbaan Matematik, Kuiz Relay, Teka Silang Kata, Betul atau Salah | QB MCQ with options, by subject (fallback by grade level) | Q-gate (DEC-5); flag `permainan` ON (DEC-3) | Random draw, options shuffled A-D; Betul atau Salah derives a statement from an MCQ; Teka Silang Kata builds a crossword | Connected / partial |
| A23 | v2 solo games (Cabaran Kilat, Tembak/Susun Jawapan, Kad Memori, Jutawan) | QB MCQ | Q-gate; flag `permainan` | Not in the .cloud inventory: follows A22 supply rules | Connected |

No question content (must never gain their own store): Peta Belajar (chapter islands unlocked when a chapter has Approved questions), Liga/Tournament, Cabutan Bertuah, Target SPM.

## 4. User stories and acceptance criteria

Priority: M Must, S Should, C Could, W Won't now.

### US-01 (M) [R1] Single content source per activity
As an Admin Pusat, I want every student activity to read only admin-owned content, so that what I approve can reach students and nothing hidden overrides it.
- AC-01.1 Given any activity in section 3, when content is requested, then it comes only from the stated admin-owned content; no code fixture, seed-only table or module-own question table is read.
- AC-01.2 Given a production-equivalent environment with zero published papers, when a student opens Simulasi, then the empty state is shown ("Tiada kertas tersedia buat masa ini" / "Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi."), not sample papers.
- AC-01.3 Given demo/PoC content flags exist, when they are switched on or off, then the set of student-visible questions and papers in every activity is unchanged.
- AC-01.4 Given an admin approves a question that qualifies, when a student opens an applicable activity, then the question can appear with no developer, seed or database step.
- AC-01.5 Given section 3, then every row has a passing end-to-end test per US-18.

### US-02 (M) [R1; AC-02.8 KIV] .cloud lifecycle, labels and click counts
As an Admin Pusat, I want entering and approving content to take the same steps and labels as .cloud, so that I do not relearn or take extra hops.
- AC-02.1 Given DEC-1, when an admin approves a question (`Terbitkan`), then it is student-visible wherever its tags and shape qualify; no further publish action exists for questions.
- AC-02.2 Given a new question, then the admin path is `Cipta baharu` (title "Studio — Cipta soalan"), wizard tabs `Kertas`, `Rangsangan`, `Sub-bahagian`, `Tag`, `Simpan draf` (flash "Soalan draf disimpan. Terbitkan melalui semakan apabila sedia."), `Hantar untuk semakan` (flash "Soalan dihantar untuk semakan."), `Terbitkan` with no confirm (flash "Soalan diterbitkan — kini boleh dijawab oleh pelajar."): 4 clicks, same as .cloud (DISC §3.1).
- AC-02.3 Given the question status bar, then it shows badge and text exactly: Draft "Belum dipapar kepada pelajar."; Approved "Soalan ini boleh dijawab oleh pelajar."; allowed moves draft->reviewed|archived, reviewed->approved|draft|archived, approved->archived, archived->draft; an illegal move shows "Peralihan '{from}' -> '{to}' tidak dibenarkan."
- AC-02.4 Given an Approved question is edited, when the admin chooses `Edit sebagai draf`, then a new draft is created, the original keeps serving until the draft is approved, and the flash reads "Draf baharu #{id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan."; direct edit shows "Soalan ini telah diterbitkan. Gunakan "Edit sebagai draf" untuk menyuntingnya."
- AC-02.5 Given intake (DOCX/PDF) items, then the intake action names state the real result: DOCX imports land as DRAFT with the .cloud notice "Kertas diimport sebagai DRAF — tiada apa-apa diterbitkan kepada pelajar sehingga anda menerbitkannya."; the item-review button `Terima (A)` creates a draft question and is not labelled "Terbit"; paper review `Terbitkan` is the only publish.
- AC-02.6 Given import channels, then v2 offers: DOCX set ZIP (`Import DOCX (ZIP)`, modal "Import set DOCX", `Muat naik & proses`, then `Semak & terbitkan kertas →`, `Terbitkan`, confirm: 4 clicks + 1 confirm), BI Kertas 1 (`Import BI Kertas 1`, `Muat naik & ekstrak`), item review (`Kelompok Item`, `Terima semua yang belum disemak`, `Terima (A)`, `Tolak (R)`, `Simpan Sunting (E)`), `Kiriman Guru`; channels that are CLI-only in .cloud stay operator-only unless Q-01 says otherwise. PDF upload in v2 (existing intake) feeds the same review.
- AC-02.7 Given the question list (`Studio`), then it shows tiles Draft/Reviewed/Approved/Archived with counts, the .cloud filters (`Semua subjek`, `Semua status`, `Semua tahun`, `Semua negeri`, `Semua kertas`, `Semua jenis`), `Tapis`, columns `No.`, `Soalan`, `Kertas`, `Sumber`, `Status`, and lists ALL levels and statuses including questions of levels D1-D6 that students cannot see.
- AC-02.8 Given teacher-submitted questions, then they arrive as `menunggu`/review and appear under `Kiriman Guru`; only the admin approves (same `Luluskan`/`Terbitkan` control). A teacher's own "Soalan Guru (rujukan)" insert is the one case .cloud writes straight as approved (DISC §0.1); v2 replicates that and marks the source so the admin sees it.
- AC-02.9 Given `Arkib` (Studio) or `Sembunyikan` (Panel dialog "Arkibkan soalan ini?", `Batal`/`Sembunyikan`), then the question leaves all student activities and the flash reads "Soalan diarkibkan — tidak lagi dipapar kepada pelajar."

### US-03 (M) [R1; AC-03.3 R2] DSKP tagging as an approval gate inside the existing form
As an Admin Pusat, I want approval to require a complete DSKP tag entered in the existing form, so that selection, quotas and blueprints are driven by the DSKP.
- AC-03.1 Given the create/edit wizard, then DSKP tagging (curriculum node, and per leaf part TP and cognitive level) is entered inside the existing step "Langkah 4 Tag & pengelasan" and the part editor (`Sub-bahagian`); no new screen or navigation step is added.
- AC-03.2 Given a question lacking a curriculum node, or a leaf part lacking TP or cognitive level (or, for SPM-bound questions, kertas), when the admin presses `Terbitkan`, then approval is refused with the .cloud-style list "Soalan belum boleh diterbitkan — sila betulkan isu di bawah." naming every missing item (e.g. "Bahagian (b) belum ada aras pemikiran.").
- AC-03.3 Given the legacy-style list actions that exist in .cloud (`Luluskan Hasil Tapisan` requiring at least one filter, confirm "Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar."; `Arkib Semua`), when used, then questions failing the DSKP gate are not approved and the result message states how many were approved and lists those that failed with reasons. Bulk approve/archive exists in .cloud only on that legacy list, not in Studio or Panel; v2 does not add bulk actions elsewhere.
- AC-03.4 Given a free-text tag instead of a curriculum node, then it is not accepted (D53h).
- AC-03.5 Given a part with cognitive level Mengaplikasi, Menganalisis, Menilai or Mencipta, then it counts as KBAT in all blueprint and pool calculations; no TP threshold (D76).
- AC-03.6 Given a question's TP, then it equals the highest TP of its leaf parts.
- AC-03.7 Given the existing "Kesukaran" field (Mudah/Sederhana/Sukar), then it remains as in .cloud and is not confused with TP.
- AC-03.8 Given legacy MCQs without a DSKP node (DEC-2), then they remain servable in the activities .cloud serves them in (A01, A02, A04, A12, A13, A21, A22, A23), show the state "Belum ditanda DSKP" in the admin (the .cloud list already has a DSKP filter "Ada DSKP Tag" / "Belum Ditag"), are excluded from blueprint-governed papers and Jana Kertas, and become eligible once an admin edit completes the tag.
- AC-03.9 Given editing a legacy untagged question, then the DSKP gate applies at its next approval (new approval), not before.

### US-04 (M) [R1] Visible state: where can students see this?
As an Admin Pusat, I want for any question or paper to see where students can and cannot see it and why.
- AC-04.1 Given the question edit status bar and list `Status`/`Perhatian` columns, then they also show, per activity family (Latih Tubi/Bab/Aku Salah, Databank/Mock, Tracking A, Struktur/Subjektif, Simulasi/Kuiz, Permainan/Battle, PKSK), "Boleh dilihat" or "Tidak boleh dilihat" with a reason. Placement follows the existing .cloud surfaces (Studio status bar, lane page `Perhatian` column with labels such as "tiada kunci jawapan", "tiada skema — tidak disajikan", "tidak boleh ditanda"); no new screen.
- AC-04.2 Given a question not visible somewhere, then the reason is a plain BM sentence naming cause and fix (e.g. belum diluluskan; DSKP belum lengkap; ada imej dan permainan ini tidak memaparkan imej; imej belum dimuat naik; tahap tidak aktif untuk murid; kertas belum diterbitkan; tiada dalam mana-mana kertas diterbitkan).
- AC-04.3 Given any paper (draft, published, withdrawn), then the paper review shows whether students can open it and where (Simulasi, Kuiz, Tracking A), and for a draft what blocks it (existing blockers banner "{n} masalah menghalang penerbitan.").
- AC-04.4 Given a question on a published paper, then its detail lists that paper; archiving it states the effect on students before it happens (a published composite keeps its frozen snapshot, DISC §0.4).
- AC-04.5 Given the state changes (approve, tag edit, paper publish or withdraw), then the indicators are correct on the next view without a manual job.
- AC-04.6 Given a question held inactive (image-bearing legacy item under QLOAD), then the reason reads that the image is not loaded and the fix is to upload it in the edit form.

### US-05 (M) [R1; AC-05.7 R2] No silent drops
As an Admin Pusat, I want to be told when a question cannot be served somewhere.
- AC-05.1 Given an approved question that qualifies by tags, when its shape (stem image, option images, stimulus, shared group, table, structured, multi-part, any production answer mode) is one the activity displays and marks, then it is served.
- AC-05.2 Given a shape an activity cannot serve, then the question is excluded deliberately, the admin sees it (US-04), and the student never receives a partly shown or unanswerable question.
- AC-05.3 Given `Terbitkan` on a question unservable in some activity, then the admin sees a notice listing those activities and reasons; approval proceeds unless it is unservable everywhere (then refused, like the .cloud PublishValidator, e.g. "Bahagian (a) tiada skema jawapan.").
- AC-05.4 Given paper preview / review, when a question cannot be displayed or marked, then its row is marked (as .cloud `Tidak disajikan` chips) with the reason, and publish is blocked until resolved.
- AC-05.5 Given an Approved question whose image file is missing, then it is excluded and visible to the admin per AC-04.6; never shown with an empty frame.
- AC-05.6 Given the lane list `Perhatian` counts (.cloud "tidak boleh ditanda", "tiada skema — tidak disajikan", "tiada kunci jawapan"), then they are computed from the same rules students use, so admin and student views agree.
- AC-05.7 Given A12 and A22 counts (chapter counts, game pool), then they count only questions those activities can actually serve (DEC-5).

### US-06 (M) [R1] Blueprint and Disahkan gate
As an Admin Pusat, I want each subject x kertas to have a blueprint I verify.
- AC-06.1 Given the Panel, then blueprints live at `Kontrak Simulasi` (`/spm/kontrak`; `Senarai Kontrak`, `Baharu`, fields `Subjek`, `Kertas`, `Cipta`; duplicate error "Kontrak untuk subjek/kertas ini sudah wujud.") reached from Set Builder/paper review `Sunting kontrak`; no new screen.
- AC-06.2 Given the contract editor, then fields keep .cloud order (`Kod Kertas`, `Tempoh (minit)`, `Jumlah Markah`, `Sumber`, `Boleh tanda auto`, `Nota`, `Bahagian` table with `Label`, `Peraturan Pilihan`, `Markah`, `Arahan`, `Mod Jawapan Dijangka`), with the D75/D76 fields (exact unit quotas, TP profile per slot group, KBAT quota in marks, T4:T5 share) added inside the same editor.
- AC-06.3 Given `Sumber`, then values are `Draf`, `Spec`, `Disahkan`; `Disahkan` is set only by Admin Pusat after the evidence record (trial papers and skema from at least two bodies) and the system's check of section marks, rules, counts, totals and duration (D76).
- AC-06.4 Given a Spec blueprint, then it is not used for papers real students see; Admin Pusat in Mod Pelajar may test Spec; Admin Sekolah in Mod Pelajar sees Disahkan only.
- AC-06.5 Given a null blueprint value, then it never fails conformance (as .cloud). Given a contract shared by several papers, then the editor shows "Kontrak dikongsi." with its warning.
- AC-06.6 Given a curated or official Kertas Pilihan that misses quota/profile/KBAT, then it is never blocked; the blueprint is flagged "Blueprint perlu semakan" (D78 O-2). Structural gaps (sections, totals, rules) block per `v2-bijak-spm.md` AC-26.2.

### US-07 (M) [R1] Paper assembly (Set Builder, Jana Kertas) and publish
As an Admin Pusat, I want to build or generate a paper and publish it so students see it as a Simulasi paper.
- AC-07.1 Given Set Builder (`/admin/studio/sets`), then manual build follows .cloud: `Mula kosong` creates a composite with Bahagian A/B/C (flash "Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula."), bank browser with `Tambah`/drag, per Bahagian rule `Jawab Semua` / `Pilih N`, `Buang`, total "Jumlah markah keseluruhan: {n} markah", `Terbitkan`.
- AC-07.2 Given Jana Kertas (.cloud "Jana set": `Tajuk set`, `Subjek`, `Bilangan soalan`, `Tahun`, `Negeri`, aside "Kolam soalan": "{n} soalan tersedia", "Anda meminta {k} daripadanya."), when the pool meets every exact unit quota, TP profile and KBAT quota, then `Jana set` produces a paper satisfying them with flash "{n} soalan dijana secara rawak. Semak sebelum menerbitkan."; otherwise the button is disabled and "Pratonton kolam" names each unit/slot short and by how many; untagged legacy MCQs are not in the pool (DEC-2).
- AC-07.3 Given the minimum clicks, then a generated set publishes in 2 clicks (`Jana set`, `Terbitkan`) as in .cloud.
- AC-07.4 Given publish, then these checks run and every violation is listed: at least one question ("Kertas ini tiada soalan — tidak boleh diterbitkan."), full question validation, `choose_n` count not larger than available, no zero-mark section with questions, same-subject rule for composites, document Bahagian has a published, non-empty document, total at least 1, and the blueprint gate.
- AC-07.5 Given a native paper fails only the blueprint gate, then the admin may tick "Terbitkan walaupun tidak memenuhi kontrak blueprint" and publish; the override is recorded in the audit log (as .cloud); it never overrides structural failures.
- AC-07.6 Given publish of a native paper, then `Terbitkan` shows the confirm "Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi.", sets the paper published and its own questions Approved, and flashes "Kertas '{title}' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi."; given a composite (Set Builder), publish has no confirm, pins a frozen snapshot per member and shows "Set ini telah diterbitkan."
- AC-07.7 Given `Tarik balik ke draf` (confirm "Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya."), then the paper and its own questions return to draft and past attempts remain.
- AC-07.8 Given a published native paper, then it cannot be edited ("Kertas ini sudah diterbitkan — tekan “Salin set” di atas untuk menyunting salinan draf."); `Salin set` creates an editable draft.
- AC-07.9 Given a question later changed or archived, then a published composite keeps serving its pinned snapshot, a changed member added after publish is flagged "Set ini diterbitkan, tetapi {n} soalan yang ditambah selepas itu belum dibekukan. Terbitkan semula untuk membekukannya."
- AC-07.10 Given a student-generated paper entry already in v2 scope (`v2-bijak-spm.md`; not a .cloud behaviour, whose papers are fixed compositions), then it draws only from Approved, DSKP-tagged QB under a Disahkan blueprint with exact-or-refuse; if the pool is short the student sees a plain BM message and the admin sees the shortfall. Listed as a deviation from .cloud.

### US-08 (M) [R1; AC-08.2 R2] SPM activities draw by DSKP and kertas tags, no pool flag
As an Admin Pusat, I want SPM activities to draw from approved questions by their tags so no hidden pool flag exists.
- AC-08.1 Given an Approved MCQ with subject and level, when a student starts A01 or A02 for that subject, then it is eligible without any further admin action or flag.
- AC-08.2 Given Mock K1/K2, Databank and Battle mod SPM, then they draw from Approved QB by subject/kertas tags as .cloud does (random, counts per section 3); where a Disahkan blueprint exists for the subject x kertas, tagged content follows it.
- AC-08.3 Given the admin form, then there is no "SPM pool" toggle and no activity requires a flag that only a migration or seed can write.
- AC-08.4 Given an SPM activity with zero eligible questions, then the student sees .cloud's empty text (e.g. A03 "Tiada set objektif Tracking A yang bersedia lagi. Set sedang dibina — semua set semasa masih dalam proses pengisian. Semak semula tidak lama lagi!"; A01 "Tiada soalan untuk pilihan ini.") and the admin sees the shortfall by subject/kertas.

### US-09 (M) [R2] Tracking A is admin-authored
As an Admin Pusat, I want to create and edit Tracking A sets so students see current sets without seeding.
- AC-09.1 Given Panel `Kandungan SPM` > card `Tracking A` ("Set objektif penuh dan lane bahasa.") > row `Sunting`, then the screen "Set Tracking A" offers "Soalan dalam set" with drag handle "Susun semula soalan", `tukar`, `buang`, `Isi set`, chip `Baharu`, inline "Sunting Soalan", and `Simpan`; nothing is committed until `Simpan`.
- AC-09.2 Given `Isi set`, then the shortfall is filled from the free pool; failure shows "Tiada soalan lain yang boleh disajikan untuk mengisi set ini."; given `tukar` failure, "Tiada soalan lain yang boleh disajikan untuk ditukar."
- AC-09.3 Given `Simpan`, then it rejects an empty set ("Pilih sekurang-kurangnya satu soalan sebelum menyimpan."), a question already used in a sibling set of the same subject and year, or an invalid question; success "Set dikemas kini."
- AC-09.4 Given a set's `target_count` (default 40) and members, then status is `locked` below target, `bersih` at target, `bank_besar` above; a locked set is not shown to students (404 on direct URL).
- AC-09.5 Given 5 clicks (`Kandungan SPM`, `Tracking A`, `Sunting`, `Isi set`, `Simpan`), then a short set becomes playable, matching .cloud.
- AC-09.6 Given no sets (DEC-4: none are copied), then students see the empty text in AC-08.4; no seed data.
- AC-09.7 School admins see the notice that national content is managed by Admin Pusat.

### US-10 (M) [R1; AC-10.11 KIV] Student display of every production answer mode
As a Murid, I want every question type used in production to be answerable.

Production approved parts: mcq 532, extended_essay 229, short_text 49, essay_choice 31, numeric 7. The other eight modes have 0 approved parts and are W. Widget text from DISC §1.4.
- AC-10.1 mcq: Given an MCQ (radio group, aria "Pilihan jawapan"), then each option is a lettered chip with HTML body and optional image, the selected one is highlighted, options keep stored order in papers and are shuffled and re-lettered in Latih Tubi family quizzes; the answer is exact-match, all-or-nothing.
- AC-10.2 short_text: Given a short-text part, then a single-line input (placeholder "Tulis jawapan…", aria "Jawapan") accepts text; marking compares case- and whitespace-insensitively to the accepted values.
- AC-10.3 numeric: Given a numeric part, then a decimal-keyboard input (placeholder "cth. 3.14…", aria "Jawapan berangka") with unit suffix when defined; marking compares within the tolerance, else as text.
- AC-10.4 extended_essay: Given an essay part, then a textarea (placeholder "Tulis jawapan anda di sini…", aria "Jawapan esei") shows a live counter "{n} patah perkataan"; with a word limit the counter turns "over" when exceeded.
- AC-10.5 essay_choice: Given a part with topics, then the pupil picks one topic by radio and writes in a textarea (placeholder "Tulis karangan anda di sini…", aria "Karangan") with counter "{n} patah perkataan · sasaran {min}–{max}"; the chosen topic is stored.
- AC-10.6 Choose-n Bahagian: Given a section with "Pilih N", then the header shows "{n} / {N} soalan dipilih", each question has a checkbox "Pilih soalan ini untuk dijawab", unpicked ones dim once the cap is reached, the rule line reads "Jawab {N} soalan sahaja." (or "Jawab semua soalan." for answer-all), and scoring counts the best N.
- AC-10.7 Given a multi-part question (a)(b)(c), then each leaf part has its own widget, shows "[N markah]", and none is dropped; only leaf parts take input.
- AC-10.8 Marking: Given a submitted paper, then objective parts (single key, accepted values) are marked on the server; subjective parts with a point scheme get a keyword suggestion that the pupil then adjusts in Semakan with "Markah kendiri:" (clamped 0..marks, no lock); correct answers are never in the page before reveal.
- AC-10.9 Reveal: Given Semakan, then each leaf part shows "Skema Pemarkahan · {n} markah" with "Jawapan: **{letter}** ...", "✓ Betul ({awarded}/{marks})" or "✗ Salah ({awarded}/{marks})", "Jawapan diterima: {values}", or the point list with "Cadangan automatik (kata kunci)"; in Latih Tubi family a check shows result after "✓ Semak" ("🎉 Betul!" / "😟 Salah") and Databank/Tracking A show "Penjelasan:" when present.
- AC-10.10 Given a mode with no widget in an activity, then US-05 applies; the unknown-mode fallback "Jenis jawapan ini akan tersedia tidak lama lagi." is never shown for an approved question.
- AC-10.11 [conditional] Essay review queue (`/spm/tanda-karangan`) and AI grading are out of scope until verified (DISC §5.8).

### US-11 (M) [R1; AC-11.12 R2] Student display of stimuli, groups and images (folds `question-images-display`)
As a Murid, I want to see the figure, passage or table a question refers to, including shared ones.

Production stimuli on approved questions: passage 797, image 667, diagram 410, table 45, map 9, infographic 2, graph 1. Rendering per DISC §1.5.
- AC-11.1 passage: shown as a passage block with optional bold title, body text and source line, above the stem.
- AC-11.2 image and infographic: a figure with the picture (reserved width/height, lazy-loaded, alt = caption), optional title, body below, caption.
- AC-11.3 diagram, map, graph: a figure with inline drawing or picture, caption fallback "Rajah" (diagram, map) or "Graf" (graph).
- AC-11.4 table: a real table with header and row headers and caption; if only an image exists, an image figure with fallback caption "Jadual"; on 375px the table scrolls inside its own container, not the page.
- AC-11.5 stem image: a question with an image in the stem shows it in every applicable activity (Latih Tubi family as "Rajah soalan"; papers/Kuiz above the stem).
- AC-11.6 option images: each option shows its image and stays selectable by tap at 375px.
- AC-11.7 shared group: Given several questions sharing one stimulus (e.g. "Rajah 1"), then it renders once per group; when one stimulus is common to every question of a Bahagian (at least 2 questions) it is shown in a persistent pane with the hint "📌 Petikan kekal dipapar semasa menjawab"; questions stay in group order and together in assembly (D41).
- AC-11.8 mobile persistence: at 375px a shared stimulus stays reachable while answering without covering the answer control: .cloud collapses to a short sticky header (max 42vh) at widths up to 820px; the existing v2 Bijak chip "Lihat {label}" opening a sheet may remain as the presentation where already built. No separate zoom control is required (none in .cloud).
- AC-11.9 Given a stimulus or option file that fails to load, then the question shows "Rajah tidak dapat dimuatkan." with "Cuba lagi" and "Lapor"; "Seterusnya"/"Semak" stay available only where the question does not need the stimulus (reuse `v2-bijak-spm.md` AC-07.4).
- AC-11.10 No layout shift (reuse NFR-03): images reserve dimensions and lazy-load.
- AC-11.11 Only students who may see a question can load its images (already built; holds on all new surfaces).
- AC-11.12 Given Latih Tubi family activities, then stimuli, groups and image options display as in papers; .cloud legacy practice shows text plus one optional image only, so this is an extension needed because v2 has a single bank (listed in section 8).

### US-12 (M) [R2; AC-12.1 R1 for A02; AC-12.3 KIV] Practice family serves every approved shape
As a Murid, I want Latih Tubi, Bab, Aku Salah, Databank, Mock and Set Soalan Guru to give me any approved question that fits, not only plain text MCQs.
- AC-12.1 Given an Approved MCQ with image, stimulus, group or option images, then A01, A02, A04, A12, A13, A18 serve it per US-10/US-11.
- AC-12.2 Given level filters, then levels offered are those active for students with approved content, including "♾️ Semua Tahap"; no T4/T5-only limit.
- AC-12.3 Given a teacher set referencing questions, then each item Approved at serve time is served; an item that became unservable is shown to the teacher with the reason, not silently skipped.
- AC-12.4 Given Soalan Aku Salah, then wrong answers from any served shape can be replayed.
- AC-12.5 Given Soalan by Chapter, then the subject list shows chapter and question counts (Approved only), `Mula` hands to A01 for the subject, and a chapter with 0 serveable shows the locked chip "Tiada soalan".
- AC-12.6 Given Peta Belajar, Pembetulan and A14 links into A01, then they work with the `latih-tubi` flag ON; with the flag OFF they show "Ciri ini tidak tersedia buat masa ini." (as .cloud).

### US-13 (S) [KIV] Games read the admin bank
As an Admin Pusat, I want games to take questions only from the approved bank.
- AC-13.1 Given the 7 Zona Permainan games, Battle and v2 solo games, then supply comes only from Approved QB (DEC-5), subject-scoped with grade-level scoping applied only if it yields rows; no hard-coded sets.
- AC-13.2 Given a game needs MCQ with options (A-D display), then questions outside that shape are excluded and the admin sees "Tidak sesuai untuk permainan: {reason}" (US-04).
- AC-13.3 Given Battle, then it uses Approved MCQ with counts 5/10/15/20 and duration = count x 12 s.
- AC-13.4 Given the `permainan` flag, then games are visible at go-live (DEC-3).

### US-14 (M/S) [R1: AC-14.1, 14.2, 14.7; all other ACs KIV] Missing activities are built on admin content
As a Murid, I want the activities that .cloud has and v2 lacks.
- AC-14.1 (M) Simulasi - Kuiz (A10): Given Approved MCQ parts with a correct option on a published paper or paperless, then a quiz shows "Simulasi — Kuiz", "Soalan {i} daripada {n}", timer "Masa", progress bar, `✓ Semak` (server-checked), "🎉 Betul!"/"😟 Salah", "Soalan Seterusnya →"/"Tamat →", finish "Kuiz Selesai!" with Markah, Ketepatan, Masa, buttons "↻ Cuba Lagi" and "Kertas penuh"; empty "Belum ada soalan objektif". Counts 5/10/20/40 (default 20). [conditional] The subject/count entry control is unverified (DISC §5.5); implement the picker only as .cloud proves it.
- AC-14.2 (M) Paper quiz view (A11): Given a published paper, then it pages by Bahagian with shared stimulus pinned once, MCQ `✓ Semak`, footer "← Sebelum", "Skor: x / y", "Seterusnya →", empty "Kertas ini tiada soalan"; non-MCQ parts follow .cloud's ungraded textarea (flagged as a D9 candidate in section 8).
- AC-14.3 (S) Kertas Subjektif (A08): Given a published paper document (D81; AC-14.9..14.25), then students (flag ON) see the index "Kertas Subjektif" grouped by subject, a viewer headed "{subject} — Kertas {k}" showing the reflowing document with inline figures (AC-14.21), `Tunjuk Skema Pemarkahan`/`Sembunyi`, fallback "Skema pemarkahan tidak tersedia untuk kertas ini."; index empty text "Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi."; flag OFF at go-live (DEC-3).
- AC-14.4 (S) Kertas Subjektif admin: Given Panel `Kertas Subjektif` > `Senarai Kertas` (and `/admin/kertas-subjektif`), then tiles, filters, columns, `Baharu` form, `Sunting`, `Sembunyikan`/`Terbit`, `Padam` (dialog "Padam kertas ini?") follow DISC §3.6; publish of an empty document is refused (AC-14.19; .cloud's "0 pages" gate becomes "no content"). How content gets in: section 10.1 (AC-14.9..14.25).
- AC-14.5 (S) Pembetulan (A15): Given a pupil with wrong answers, then a monthly list by subject (`?bulan=YYYY-MM`) with links to A01 appears; no question content of its own.
- AC-14.6 (C, conditional) Penguasaan (A16): DISC gives no behaviour; do not build until a discovery addendum describes it (listed in section 9).
- AC-14.7 Given navigation, then an entry appears only for activities that exist and are enabled; none points to a missing screen.
- AC-14.8 Given a document Bahagian (attached Kertas 2 document) in a Simulasi paper, then the student sees the document content (AC-14.25) and a single self-mark "Markah dinilai sendiri (Bahagian B):" `/ {mark_budget}`, with the note "Markah maksimum Bahagian ini belum ditetapkan — hubungi pentadbir." when unset.

### US-15 (S) [KIV; AC-15.3 R2] Other authoring channels feed the same bank
- AC-15.1 Given PKSK questions, then they are created in the same admin question flow with a PKSK tag; student list shows counts always and the question list only with an active grant (.cloud). Answering flow: [conditional, unverified in .cloud].
- AC-15.2 Given Audio KBAT, then admin authoring and student reading follow .cloud [conditional: .cloud audio labels not in DISC]; no second question store.
- AC-15.3 Given CSV import, then each row result is reported; imported questions land as draft/`menunggu` and are never student-visible before approval.
- AC-15.4 Given a teacher uploads a file (`Kiriman Guru`), then the admin can download and import by hand as in .cloud (no automated parser required).

### US-16 (M) [R1] Existing migration context; no new content or image copy (rewritten per DEC-4)
As a Product owner, I want this feature to depend on no new content copy, so that v2 is a working pipeline rather than a data project.
- AC-16.1 Given this feature, then no .cloud question, paper, set, Tracking A or Kertas Subjektif content and no image file is copied or loaded by any new requirement here.
- AC-16.2 Given the existing migration (QLOAD, 2026-10-24: approved MCQs loaded as active single-part MCQs without DSKP node; image questions held inactive; images not copied), then it is unchanged and is context only.
- AC-16.3 Given image-bearing loaded items, then they stay inactive, the admin sees the reason (AC-04.6), and an admin can activate one by uploading the image through the existing v2 upload in the edit form (no bulk image import).
- AC-16.4 Given loaded untagged MCQs, then DEC-2 applies (AC-03.8).
- AC-16.5 Given a fresh environment with no loaded papers, sets or documents, then the pipeline works from empty: an admin can create, approve, build, publish, and a student sees (US-18).
- AC-16.6 Given levels D1-D6 inactive for students, then loaded or new questions of those levels remain visible and manageable by the admin (AC-02.7).

### US-17 (M) [R1] Responsive
- AC-17.1 Given 375, 768 and 1280px, then every screen touched (student display of all modes/stimuli/groups, Simulasi paper, quizzes, admin tag fields, status panel, Set Builder, Tracking A editor, Kontrak editor, Kertas Subjektif list) has no horizontal page scroll and no unreachable control.
- AC-17.2 Given 375px, then tables and large images scroll or scale inside their container; a sticky stimulus header or chip never covers the answer controls.
- AC-17.3 Given touch, then options, answer and navigation controls are at least 44px tall.
- AC-17.4 Given the question map rail, then on up to 900px it sits above the paper, on desktop it is a sticky right column (as .cloud).
- AC-17.5 E2E for each story runs at all three widths.

### US-18 (M) [R1; AC-18.5 R2/KIV] Provable end-to-end pipeline
As QA, I want one automated journey per content class so the disconnect cannot recur.
- AC-18.1 Given a clean database with no demo flags, when a test creates a question via the admin flow with a DSKP tag, runs the 4 clicks of AC-02.2, then opens each applicable activity of section 3 (A01, A02, A04, A10, A12, A21, A22, A23), then the question is seen and answerable.
- AC-18.2 Given a test builds a paper in Set Builder (or `Jana set`) under a Disahkan blueprint and presses `Terbitkan`, then a student account sees it in `/simulasi` and can complete, submit and open Semakan.
- AC-18.3 Given a question with a stem image, image options and a shared stimulus group, then it is seen and answerable in A01 and in Simulasi.
- AC-18.4 Given a question with a shape an activity cannot serve, then the test confirms exclusion and the admin reason.
- AC-18.5 Given Tracking A: admin fills a set and `Simpan`, the student sees and plays it; Kertas Subjektif: admin creates a paper, uploads a PDF (a digital test PDF and a scanned test PDF), edits the result, presses `Terbit`, and (flag ON in test) the student reads it, reveals the skema, at 375/768/1280; an empty document cannot be published.
- AC-18.6 Given an untagged legacy MCQ, then it is served in A01 and absent from Jana Kertas pool.
- AC-18.7 These journeys run at 375/768/1280 and are part of G5; an XL review of this feature runs before build.

### US-19 (M) [R1: AC-19.2, 19.4; AC-19.3 R2; AC-19.1 KIV] Fix .cloud inconsistencies (D9, logged as deviations)
As an Admin Pusat and Murid, I want known .cloud defects not to be replicated.
- AC-19.1 Given Kawalan Ciri (`/admin/feature-toggles`, flash "Ciri "{label}" telah DIAKTIFKAN." / "...DINYAHAKTIFKAN."), then toggles exist for `latih-tubi` and `kertas-subjektif` as well as `permainan` (in .cloud the first two are missing from the config and return 404).
- AC-19.2 Given `/simulasi`, then the subheading does not claim "tanda automatik setiap halaman" (per-page marking does not exist); it describes the real behaviour (answer, Hantar, then Semakan). Exact wording by the designer, logged in the deviation table.
- AC-19.3 Given every picker (Bab counts, games, teacher set picker), then only Approved questions are offered (DEC-5).
- AC-19.4 Given canonical vs legacy banks in .cloud, then v2 shows one bank; no student sees duplicate cards for the same subject (e.g. legacy plus canonical Tracking A).

### US-20 (M) [R1] Student Simulasi display engine (A09; replicates DISC §1)
As a Murid, I want to sit a published paper in the real-paper format.
- AC-20.1 Given `/simulasi`, then the heading is "Simulasi Peperiksaan"; per subject a card "{subject}", "{N} set · {code}", subject groups sorted by paper count descending; paper tile "Set {n}" or title, badge "Tracking A" for composites, chips "Kertas {k}", "{marks} markah", "{duration} min", link "Mula"; a paper is a fixed composition with no random draw at student time; draft papers are not openable (404).
- AC-20.2 Given re-entry to an unsubmitted sitting after more than 60 seconds, then the choice screen "Percubaan belum dihantar" offers "Sambung — teruskan jawapan & masa sedia ada" and "Mula Semula — kosongkan jawapan & masa" (confirm "Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?").
- AC-20.3 Given the paper, then there is no separate start screen: the cover shows "SULIT", paper code, subject, "{code} · Kertas {k}", "{duration} minit", numbered instructions, and the examiner grid "Untuk Kegunaan Pemeriksa" only when the paper has any non-auto-marked part; the stored title/year is not shown.
- AC-20.4 Given the control bar, then a timed paper counts down (warn at 5 minutes, banner "Amaran: masa berbaki kurang 5 minit.", auto-submit at 0), an untimed paper shows elapsed time; save state `menyimpan…` / `disimpan` / `gagal simpan` / `luar talian`; `Hantar` confirm "Hantar jawapan anda sekarang?"; a late submit is never rejected.
- AC-20.5 Given paging, then the paper is paginated into sheets ("Halaman {x} daripada {y}", "← Sebelum", "Seterusnya →", last "Hantar Jawapan", "KERTAS PEPERIKSAAN TAMAT"); hidden questions keep their answers; autosave debounces 1 s and persists on tab hide.
- AC-20.6 Given the question map rail, then dots per Bahagian with legend "Dijawab", "Ditanda", "Belum"; flag button title "Tanda soalan".
- AC-20.7 Given Semakan (`Dihantar`, `{score} / {max}`, "Cuba Lagi"), then "Lihat semakan lepas" links to the last review and re-opening a submitted paper starts a blank attempt.
- AC-20.8 Given a fixed objective paper, then a pupil sitting it on 375px can reach every question via the map rail, answer, flag and submit without horizontal page scroll.

## 6. Traceability

| # | Root cause / decision | Stories | ACs | Activities |
|---|---|---|---|---|
| T1 | Bijak "Percubaan" papers from flag-gated code fixture | US-01, US-07, US-18 | 01.2, 01.3, 07.6, 18.2 | A09 |
| T2 | Admin create path hard-codes spmPool=false | US-08, US-03 | 08.1-08.3, 03.8 | A01, A02, A04, A21 |
| T3 | Tracking A has no admin writer | US-09 | 09.1-09.7 | A03 |
| T4 | Practice bridge drops image/stimulus/structured/table | US-05, US-11, US-12 | 05.1-05.2, 11.5, 11.12, 12.1 | A01, A02, A04, A12, A13, A18 |
| T5 | Bijak bridge drops image stimulus, table, multi-part | US-05, US-10, US-11 | 05.4, 10.x, 11.x | A09-A11 |
| T6 | Five activities missing | US-14 | 14.1-14.8 | A08, A10, A11, A15, A16 |
| T19 | Kertas Subjektif has no in-product content route (CLI-only, images) and D81 method | US-14 | 14.3, 14.9-14.25, 18.5 | A08 |
| T7 | D1-D6 inactive; published questions vanish from admin list | US-02, US-04, US-16 | 02.7, 04.2, 16.6 | all |
| T8 | Long lifecycle; misleading "Terbit" in intake | US-02 (DEC-1) | 02.1-02.5 | all |
| T9 | Separate PKSK and Audio intake | US-15 | 15.1, 15.2 | A19, A20 |
| T10 | Games limited to plain MCQ, silent | US-13, US-05 | 13.x, 05.x | A21-A23 |
| T11 | Bank empty / images not loaded (QLOAD) | US-16 (DEC-4) | 16.1-16.5 | all |
| T12 | No admin-to-pupil test; no XL for v2 | US-18 | 18.x | all |
| T13 | Folded `question-images-display` | US-11 | 11.1-11.12 | all |
| T14 | D75-D78 blueprint, quotas, Disahkan | US-06, US-07 | 06.x, 07.2-07.5 | A09 |
| T15 | D79(d) admin UX = .cloud | US-02, US-03, US-04, US-09 | 02.2, 03.1, 04.1, 09.1 | admin |
| T16 | D80 DEC-2 untagged legacy servable | US-03, US-07, US-18 | 03.8, 07.2, 18.6 | A01, A12, A22 |
| T17 | .cloud live inconsistencies (D9) | US-19 | 19.1-19.4 | A12, A22, A09 |
| T18 | Simulasi display engine replicated from .cloud (D79) | US-20 | 20.1-20.8 | A09 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | A 40-question paper opens <= 2 s p90 on mid-range phone on 4G (NFR-03); autosave round trip < 500 ms p90; a practice question with image appears <= 1.5 s p90; status of 50 questions in a list computed <= 1.5 s p90; random draws from the large legacy bank do not delay session start beyond 2 s p90. |
| Security | Students never get answer keys before reveal; images of non-visible questions not loadable; only role admin writes (staff roles browse); override ticks audited. |
| Accessibility | Replicates .cloud (D10), no enhancements: aria labels as quoted; alt text = caption. |
| Localisation | All labels in Bahasa Melayu, verbatim from .cloud; reasons and errors in plain BM. |
| Responsive | US-17. |
| Observability | Exclusion counts per activity and reason (AC-05.6). |
| Privacy | No real names in docs, seeds or fixtures. |

## 8. Scope, assumptions, fidelity deviations

**In scope:** single source per activity; DSKP gate in the .cloud-style form; blueprint, Disahkan, Set Builder, Jana Kertas, publish checks; student display of production modes/stimuli/groups/images; visibility state and no-silent-drops; Tracking A and Kertas Subjektif admin; Simulasi Kuiz, paper quiz, Pembetulan; practice family and games reading the one bank; D9 fixes; responsive; journey tests.

**Out of scope / follow-ups:** any .cloud content or image copy (DEC-4); games realtime, matchmaking, bots; AI extraction quality; ALESA AI (hidden, D73); essay review queue and AI grading until verified; eight unused answer modes and 12 stimulus kinds with 0 production rows; Penguasaan until described; new activities not in .cloud; extra admin screens; theme; finance and system-admin clusters.

**Assumptions:**
- AS-1 Go-live starts with no loaded papers, Tracking A sets or Kertas Subjektif documents (DEC-4); Simulasi lists show the empty state until the admin publishes. Legacy MCQs (QLOAD) are the only pre-existing content.
- AS-2 Where .cloud is "unverified" (DISC §5), the AC is conditional and nothing is built from guesswork.
- AS-3 v2 marking location (browser vs server) is a design matter; the outcome and messages replicate .cloud.
- AS-4 Existing built work (JSON save, image ids, kertas field, student image read) is reused.

**Fidelity deviations (for the architect/designer deviation table):**

| # | Deviation | Reason |
|---|---|---|
| FD-1 | DSKP tag and per-part TP/cognitive level required to approve | D53h, D75-D79 (new gate inside the existing form) |
| FD-2 | Approved whitelist everywhere (Bab counts, 7 games, teacher picker) | D9: .cloud `!= 'menunggu'` admits draf, ditolak, diarkib |
| FD-3 | `/simulasi` subheading corrected | D9: stale "tanda automatik setiap halaman" |
| FD-4 | Kawalan Ciri gains `latih-tubi`, `kertas-subjektif` | D9: .cloud toggles return 404 |
| FD-5 | "Boleh dilihat / Tidak boleh dilihat" indicators on existing surfaces | Requirement 6 of this feature; no new screen |
| FD-6 | Stimulus/group/image options displayed in the practice family | v2 has one bank (US-11.12) |
| FD-7 | One bank, no duplicate legacy/canonical cards | D11/D12 |
| FD-8 | Student-generated paper entry retained (not in .cloud) | v2-bijak-spm scope, D78 |
| FD-9 | Paper quiz view ungraded textarea for non-MCQ parts: replicate; D9 candidate for the designer | Input that is not saved looks broken |
| FD-10 | Kertas Subjektif is an editable document created by upload -> OCR -> sunting -> terbit (D81), not CLI-imported page images; publish gate "no content" instead of "0 pages" | .cloud is CLI-only and image-only (unreadable on a phone) |
| FD-11 | "Soalan by Chapter" subject tile counts chaptered + ungrouped + approved questions only (the sum of the per-chapter counts), not the whole subject | D9, D91, D80 (approved = servable): V2 section 2.3 of `docs/discovery/cloud-student-mechanism.md` counts `chapter_id NOT NULL AND status != 'menunggu'`, which includes drafts and other non-approved questions (a broken leak, `docs/handoff/CLOUD-HANDOFF.md` section 3), and the live tile also showed the whole-subject count (56) against the 2 chaptered questions (R1E2E-09) |

## 9. Placeholder register: status

All 26 placeholders are resolved from DISC. "Filled" = written into an AC; "Conditional" = DISC says unverified, so the AC is conditional.

| ID | Topic | Result | Where |
|---|---|---|---|
| P-01 | Roles | Filled: only `admin` writes; staff browse (DISC §0.5) | Section 2 |
| P-02 | Latih Tubi / Databank / Chapter / Aku Salah selection | Filled | Section 3 A01, A02, A12, A13; AC-12.x |
| P-03 | Tracking A admin and student | Filled | US-09, A03 |
| P-04 | Mock K1/K2 | Filled | A04, A05 |
| P-05 | Subjektif / Berstruktur | Filled | A06, A07 |
| P-06 | Kertas Subjektif | Filled; content entry decided D81 (section 10.1) | US-14 (AC-14.3, 14.4) |
| P-07 | Simulasi/Bijak | Filled | Section 5, A09 |
| P-08 | Simulasi Kuiz, paper quiz | Filled; Kuiz entry picker Conditional | AC-14.1, 14.2 |
| P-09 | Remedial / Misi / Set Soalan Guru | Filled (remedial and Misi have no own question content) | A14, A17, A18 |
| P-10 | Pembetulan / Penguasaan | Pembetulan filled; Penguasaan Conditional | AC-14.5, 14.6 |
| P-11 | PKSK | Filled; answering flow Conditional | AC-15.1 |
| P-12 | Audio KBAT | Conditional (not in DISC) | AC-15.2 |
| P-13 | Games/Battle constraints | Filled | A21-A23, US-13 |
| P-14 | Intake "accept"/"Terbit" | Filled | AC-02.5, 02.6 |
| P-15 | Admin task flows | Filled | AC-02.2, 02.6, 03.3, 07.1, 09.1 |
| P-16 | Edit of approved question | Filled | AC-02.4 |
| P-17 | Teacher own-bank auto-approval | Filled (only "Soalan Guru (rujukan)") | AC-02.8 |
| P-18 | Placement of status info | Filled (status bar, `Perhatian` column) | AC-04.1 |
| P-19 | Blueprint location | Filled (`/spm/kontrak`) | AC-06.1 |
| P-20 | Set Builder flow | Filled | AC-07.1, 07.3 |
| P-21 | Change of question in published paper | Filled (pinned snapshots; native publish approves) | AC-07.6, 07.9 |
| P-22 | short_text / numeric marking | Filled | AC-10.2, 10.3 |
| P-23 | Essay marking | Filled (keyword suggestion + self-mark); AI queue Conditional | AC-10.8, 10.11 |
| P-24 | essay_choice display | Filled | AC-10.5 |
| P-25 | Reveal rule | Filled | AC-10.9 |
| P-26 | Image enlarge / stem / shared stimulus | Filled (no zoom in .cloud; stimuli above stem; sticky pane) | US-11 |

Summary: 24 filled, 2 partly conditional (P-10 Penguasaan, P-12 Audio KBAT), plus sub-items left conditional: Kuiz entry picker, PKSK answering flow, Misi Harian flag state, AI essay grading.

## 10. Open questions (blocking only)

None. Q-01 (Kertas Subjektif content method) was decided by the user (TRACKER D81): upload -> OCR -> sunting -> terbit. Decisions still pending are G2 items (OCR engine and cost, routing through the AI quota), not G1 blockers.

### 10.1 Kertas Subjektif content method (DECIDED, D81): upload -> OCR -> sunting -> terbit

Replaces .cloud's CLI-only page-image import and the page-image model. Everything sits on the existing Kertas Subjektif list/detail screens (DISC §3.6: `Senarai Kertas`, `Baharu`, detail, `Sunting`, `Terbit`/`Sembunyikan`); no new screen (D79d). Considered and rejected: A (per-page image upload), B (PDF split into page images), C (bulk ZIP of page images); all keep the paper as images, which is not readable on a phone.

**What v2 already has that can be reused (behaviour only; from reading code, not run)**

| Existing capability | Evidence |
|---|---|
| Admin PDF upload with type check, page count read, over-limit refusal with a BM message | `apps/api/src/modules/intake/files/intake-upload.service.ts:148-159` |
| Per-page processing: text layer first, OCR fallback for scanned pages, page image stored | `apps/api/src/modules/intake/files/intake-processing.service.ts:72` |
| Page list, page image and thumbnail reads | `apps/api/src/modules/intake/files/intake-files.controller.ts:138-150` |
| Figure crops stored as web images (purpose `intake_figure`) | `apps/api/src/modules/files/files.service.ts:34-36` |
| Per-file size limit by configuration (`INTAKE_MAX_FILE_MB`), files per batch, daily page quota | `intake-upload.interceptor.ts:11-12`, `intake-files.config.ts:12-24` |
| Front-end crop/page preview pattern (batch-scoped) | `src/modules/m28-bijak-spm/admin/intake/lib/page-images.ts:9-13` |

Notes: the intake pages belong to an intake batch and feed AI question extraction; Kertas Subjektif reuses the page reading, OCR and figure cropping behaviour, not question extraction. Whether the upload consumes the AI-extraction quota is a G2 routing decision (AC-14.23).

**Admin flow (BM labels; click counts exclude editing)**
1. `Senarai Kertas` > `Baharu`: fields `Subjek`, `Kertas` (2/3/4), `Tajuk`, `Negeri`, `Tahun`, `Tempoh (minit)`, `Jumlah Markah`; `Cipta` (draft).
2. Detail screen: upload the paper PDF; optionally the skema PDF. State "Memproses…" on the same screen.
3. The result opens as an editable document (tab for the paper; its own tab for the skema). Admin edits, then `Terbit`.
About 5 clicks for a clean digital PDF (`Baharu`, `Cipta`, upload paper, [upload skema], `Terbit`).

**Acceptance criteria (belong to US-14, priority Should; ids continue AC-14.9..)**
- AC-14.9 Metadata: Given `Baharu`, then `Subjek`, `Kertas`, `Tajuk`, `Negeri`, `Tahun`, `Tempoh (minit)` and `Jumlah Markah` are entered once, saved on `Cipta`, editable on `Sunting`, and drive the student grouping and the admin filters (as .cloud `paper_documents` fields).
- AC-14.10 Upload: Given a draft paper, then the admin can upload one paper PDF and optionally one skema PDF; a file that is not a PDF, is too large, or has too many pages is refused with a plain BM reason and nothing changes.
- AC-14.11 Processing: Given an upload, then "Memproses…" is shown on the same screen (and as a status in the list), `Terbit` is disabled meanwhile, and the admin can see progress or failure without leaving.
- AC-14.12 Text and OCR: Given a digital PDF, then its text layer is used first; given a scanned PDF (or scanned pages), then the pages go through OCR for Bahasa Melayu and English text.
- AC-14.13 Editable document: Given processing finishes, then the paper opens as an editable document containing headings, paragraphs, tables, cropped figures placed inline, maths, and question numbering such as 1(a)(i) preserved, with marks shown as in the source (e.g. "[3 markah]").
- AC-14.14 Figures: Given figures in the source, then each is cropped and placed inline (reusing the existing crop behaviour); the admin can move, remove, re-crop, and add a caption.
- AC-14.15 Editing: Given the document, then the admin edits it like a normal document: change text, change a paragraph to a heading and back, edit table cells and add/remove rows and columns, move or delete a block, undo/redo; changes are saved with `Simpan` or autosave, and unsaved work is warned about before leaving.
- AC-14.16 Skema tab: Given a skema PDF, then it is processed the same way into its own document, edited in its own tab; without a skema the student sees the existing fallback text and the admin list shows the badge "tiada skema".
- AC-14.17 Review flags: Given low OCR confidence or a failed region, then that section is flagged for admin review; the admin must review each flagged section (accept or edit) before `Terbit`; nothing is published automatically.
- AC-14.18 Whole-file failure: Given a PDF that cannot be read or yields no content, then the paper stays a draft, a plain BM reason is shown (what failed and what to try, e.g. a clearer scan), and the admin can upload again.
- AC-14.19 Terbit gate: Given an empty paper document (no text or figure after processing and editing), or processing still running, or an unreviewed flagged section, then `Terbit` is disabled with a BM reason (for empty: a message in the style of .cloud's “{title}” tiada halaman — tidak boleh diterbitkan., worded "tiada kandungan" because there are no pages; exact text by the designer); a forced publish is refused with the same reason. Skema is optional.
- AC-14.20 Replace: Given a paper already holding content, when the admin uploads a new PDF, then a confirm states that edits to the current document will be replaced; a published paper stays viewable to students until the new document is published.
- AC-14.21 Student view: Given a published paper, then students (flag ON) see the document as reflowing, readable text with headings, tables and figures; at 375/768/1280px there is no horizontal page scroll, tables scroll inside their own container, figures scale to the width with alt text from the caption, and maths displays legibly.
- AC-14.22 Skema reveal: Given a skema, then `Tunjuk Skema Pemarkahan` / `Sembunyi` reveals it below or beside the paper; this is self-check only, nothing is marked or stored (as .cloud).
- AC-14.23 Engine and quota (G2): Given the OCR/engine choice, then it is a G2 decision with cost, for user approval (e.g. local OCR versus a cloud OCR or AI provider). Requirement only: it must work on scanned SPM trial papers in Bahasa Melayu with accuracy acceptable for editing (admin corrects only isolated errors, not whole pages), and the upload consumes the AI-extraction quota only if the architect routes OCR through it.
- AC-14.24 Security: Given draft or unpublished documents and their figures, then only the admin role can upload, edit or view them; students cannot load them.
- AC-14.25 Attach to Simulasi: Given a published Kertas Subjektif document attached as a document Bahagian (AC-14.8), then the student sees the document content in the paper and records the single self-mark.

**Follow-up (Should, NOT in this scope):** convert a section of the document into structured bank questions with DSKP tags (via the intake review). Needs its own G1.

Note on Penguasaan (not asked): the discovery doc describes no behaviour, so AC-14.6 is Could and conditional; it becomes a question only if the user wants it built.

## 11. G1 exit checklist
- [x] Placeholders P-01..P-26 resolved from `docs/discovery/cloud-student-mechanism.md` (section 9).
- [x] D80 answers applied: former Q-01..Q-03 removed and recorded as DEC-2, DEC-3, DEC-4; AS-1 promoted to DEC-1.
- [x] Q-01 answered by the user (D81: upload -> OCR -> sunting -> terbit); no open questions remain.
- [ ] G2 decisions for user approval: OCR engine and cost, quota routing (AC-14.23).
- [ ] DEC-1 recorded in TRACKER (drops the publish hop of D54a for questions).
- [ ] Fidelity deviations FD-1..FD-11 carried into the architect's deviation table.
- Then G2: solution-architect and ui-ux-designer in parallel.

## 12. Counts (final)
Release slicing (D86, section 0): R1 104 ACs, R2 18, KIV 33; R1 adds 81 new ACs in `v3-bijak-spm-scope.md`. 20 stories (US-01..US-20), 155 acceptance criteria (138 before D81 plus 17 new: AC-14.9..AC-14.25). Must: US-01..12, 16..20 (US-14 mixed M/S/C; the Kertas Subjektif ACs are Should); Should: US-13, US-15; blocking open questions: 0.
