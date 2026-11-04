# Field and behaviour register: SRS 30 Admin Pusat (R1)

Read-only audit of `docs/prd/r1/30-admin-pusat.md` against V2 captures (`.evidence/v2-screens/admin|panel`), V3 code (`packages/contract/src/**`), `50-data-model-erd.md`, `60-api-contract.md`, DSKP refs. Language: English with exact BM labels. No personal data.
Layout is meant to be merged into the PRD as-is: Part 0 key, Part 1 shared option sets (OPT-*, defined once), Part 2 global behaviour rules (GB-*), Part 3 one "Field & behaviour spec" block per screen ID, Part 4 summary and counts.

## 0. Key
- SRS status: COMPLETE (SRS names type, options, rules and messages) / PARTIAL (some of them) / MISSING (field not in SRS) / MISSING-NO-SOURCE (no evidence anywhere; spec is [PROPOSED] by PRD principles).
- `[P]` inside a cell = proposed text, buildable as written. A cell without `[P]` is quoted from the SRS/code/capture.
- Evidence tags: SRS (30-admin, section/FR), V2 (capture file), CODE (path), DM (50), API (60 id), DSKP.
- "Stored" = value written to the API/database. Labels are exact BM.
- Messages without `[P]` are existing strings in code or the SRS.

## 1. Shared option sets (define once; screens reference the ID)

**OPT-SUBJEK** (31 active subjects; V2 order = `subjects.sort_order`; select default `— Pilih Subjek —` in forms, `Semua Subjek`/`Semua subjek` in filters; stored = `subjects.id`, code in brackets where known). Source V2 `admin_questions_import.txt`, SRS C-02, API-ADM list. Only subjects with `is_active=true` are offered (AC-ADM-C02.1).
1 Bahasa Melayu (BM) · 2 Bahasa Inggeris (BI) · 3 Matematik (MATH) · 4 Sains (SCI) · 5 Sejarah (SEJ) · 6 Pendidikan Islam (PI) · 7 Pendidikan Moral (PM) · 8 Matematik Tambahan (ADDMATH) · 9 Fizik (PHY) · 10 Kimia (CHEM) · 11 Biologi (BIO) · 12 Geografi (GEO) · 13 Pendidikan Seni Visual (PSV) · 14 Pendidikan Muzik (MUZ) · 15 Pendidikan Jasmani & Kesihatan (PJK) · 16 Reka Bentuk & Teknologi (RBT) · 17 Sains Komputer (SK) · 18 Bahasa Arab (BA) · 19 Bahasa Cina (BC) · 20 Bahasa Tamil · 21 Prinsip Perakaunan · 22 Ekonomi · 23 Perniagaan · 24 Pendidikan Al-Quran & As-Sunnah · 25 Tasawwur Islam · 26 Jawi · 27 Pendidikan Syariah Islamiah · 28 Sains Rumah Tangga · 29 Pembuatan Pakaian Wanita · 30 Pertanian · 31 Sains Sukan (codes of 20-31 read from `subjects.code`; not in any capture).
Studio filter (Q-03) shows the first 12 in this order then the rest, which is the same list.

**OPT-TINGKATAN** (D96): `Tingkatan 1`..`Tingkatan 5`; stored `education_levels.code` `T1`..`T5` [P: code format by analogy with `D1`, SRS C-03 "Kod"]; no default; Darjah never listed. Short form `Ting. 1`..`Ting. 5` only on the user-create radio cards. Message when empty: `Sila pilih tahap pendidikan.` (CODE `QUESTION_MESSAGES.level`).

**[SUPERSEDED by 1A.2] OPT-STATUS-SOALAN** (wire `draft|review|approved|archived`, CODE parts.ts:12). BM label set [P, one vocabulary for all admin screens, SRS §0 F-19]: `draft` = `Draf`, `review` = `Menunggu Semakan`, `approved` = `Diluluskan`, `archived` = `Diarkibkan`. Filter query values = the wire values (`review`, not `reviewed`). The English words Draft/Reviewed/Approved/Archived (V2 tiles) are NOT shown; the contract comment (Draf, Semakan, Diterbitkan, Diarkib) is superseded. "Ditolak" is not a status (draft + rejection reason). Error `Status tidak sah.`

**OPT-TP**: values 1..6, label `TP 1`..`TP 6`, with the descriptor text of the unit (or SK) under the select (`curriculum_tp_descriptors`). Default none. DSKP T4/T5 only.

**OPT-ARAS** (cognitive level; stored lower-case, CODE parts.ts:156): `mengingat`=`Mengingat`, `memahami`=`Memahami`, `mengaplikasi`=`Mengaplikasi`, `menganalisis`=`Menganalisis`, `menilai`=`Menilai`, `mencipta`=`Mencipta`; default none. KBAT is derived: the last four = KBAT. LOTS/MOTS/HOTS words of V2 are not used.

**OPT-KBAT-OVERRIDE** (per leaf, optional; stored `kbat`): `— Ikut aras pemikiran —` (null, default), `Mengaplikasi`, `Menganalisis`, `Menilai`, `Mencipta` (values `mengaplikasi|menganalisis|menilai|mencipta`), `Bukan KBAT` (`bukan`). Read-only badge next to it: `KBAT` or `Bukan KBAT`.

**OPT-KESUKARAN-5** (`difficultyLevel`, typed, required; stored 1..5): `1 Sangat Mudah`, `2 Mudah`, `3 Sederhana`, `4 Sukar`, `5 Sangat Sukar` (CODE practice-config.ts:12; DM 50 line 1307). Select, first option `— Pilih —`. Error `Sila pilih tahap kesukaran.`
**OPT-KESUKARAN-3** (display only, never typed): 1-2 `Mudah`, 3 `Sederhana`, 4-5 `Sukar` (`difficultyLabelOf`). Filters that use three labels send ranges `1-2`, `3`, `4-5`.
[DECIDED in 1A.1] typed and stored separately from TP, default `min(5,TP)`, admin may change; DM 50 lines 1242 and 1307 are corrected.

**OPT-KERTAS** [DECIDED 1A.4: 1 to 4 everywhere]: `Kertas 1`, `Kertas 2`, `Kertas 3`, `Kertas 4` (stored `'1'|'2'|'3'|'4'`; contract enum widened from `'1'|'2'|'3'`, CODE schema.ts:127). Error `Kertas tidak sah.`
**OPT-BAHAGIAN**: never free text; labels come from the paper/contract section: `Bahagian A`, `Bahagian B`, `Bahagian C`, and for Bahasa Inggeris `Part 1`..`Part 5`, `Objektif` (Matematik K1). Option label in selects: `{nama kertas} · {label bahagian}`. Stored `paper_sections.id`.
**OPT-PERATURAN** (stored `all|choose_n|none`): `Tiada`, `Jawab Semua`, `Pilih N` (shows number input `N`, integer 1 to section question count). Kontrak shows all three; Set Builder/Semak Kertas show `Jawab Semua`/`Pilih N` only.

**[DECIDED in 1A.8: QUESTION_JENIS 5 values; the mapping below is the retired INTAKE_PAPER_TYPES migration; "Decision needed" is closed] OPT-JENIS-KERTAS** (exam type; stored on `source_papers.exam_type`): `sebenar`=`Sebenar`, `percubaan`=`Percubaan`, `modul`=`Modul`, `topikal`=`Topikal`, `latihan`=`Latihan` (CODE `QUESTION_JENIS`). Filter order (V2): `Percubaan`, `Sebenar`, `Modul`, then `Topikal`, `Latihan`. Upload form (Q-08) uses CODE `INTAKE_PAPER_TYPES`: `Percubaan SPM`, `Soalan Umum`, `Peperiksaan Sebenar`, `Buku Latihan`, `Lain-lain`, mapped [P] to exam type: Percubaan SPM→percubaan, Soalan Umum→topikal, Peperiksaan Sebenar→sebenar, Buku Latihan→latihan, Lain-lain→modul. Decision needed: two sets exist today.

**OPT-NEGERI-KERTAS** (exam board/state, 22; V2 order): Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, WP Kuala Lumpur, WP Labuan, WP Putrajaya, MRSM, SBP, SABK, SMKA, SPM(U), PPD. Stored = label text slug [P: `johor`, `wp-kuala-lumpur`, ...]. Upload form offers all 22; list filters offer only values present in data (Set Builder shows 19).
**OPT-NEGERI-SEKOLAH** (16): Johor, Kedah, Kelantan, Kuala Lumpur, Labuan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Putrajaya, Sabah, Sarawak, Selangor, Terengganu.
**OPT-TAHUN**: filters list years present in data, descending (observed 2025, 2024, 2023, 2022, 2021). Upload/create fields: select of 2015 to current year, descending, default empty [P]. Error `Tahun diperlukan.` [P]
**OPT-SALINAN-HAK-CIPTA** (CODE `INTAKE_COPYRIGHT_OPTIONS`, stored value → label): `sendiri` → `Milik sendiri / sekolah`; `rasmi` → `Kertas rasmi KPM / LPM`; `pihak-ketiga` → `Pihak ketiga / komersial`. Required, no default. Error `Status hak cipta diperlukan.`
**[SUPERSEDED by 1A.7] OPT-JENIS-RANGSANGAN** (CODE `QUESTION_STIMULUS_KINDS`, order as code, default `passage`; BM labels [P]): `passage`=`Petikan`, `image`=`Imej`, `diagram`=`Rajah`, `table`=`Jadual`, `map`=`Peta`, `infographic`=`Infografik`, `graph`=`Graf`. The V2 15 kinds and the SRS words `carta`/`other` are not offered. Image kinds = image, diagram, map, infographic, graph (file is the content). Error `Sila pilih jenis rangsangan.`
**[SUPERSEDED by 1A.6 (11 values incl. true_false, mcq_multi, fill_blank)] OPT-JENIS-SOALAN** (8, SRS FR-QE3.2; order as listed; stored value [P], mapped to CODE leaf modes): `mcq`=`Aneka Pilihan`; `match`=`Padanan / Lengkapkan Petikan` (leaf `match_letter`); `short`=`Jawapan Pendek` (leaf `short_text` or `numeric`); `structured`=`Berstruktur` (2-10 leaves, any mode, depth ≤3); `working`=`Pengiraan dengan Langkah Kerja`; `essay`=`Karangan / Respons Terbuka` (leaf `essay`, optional `essay_choice`); `drawing`=`Lukisan / Graf`; `table_fill`=`Isi Jadual`. `drawing` and `table_fill` are P2: not shown in the select until built (FR-ADM-H0.2 no placeholder). Contract `QUESTION_TYPES` (mcq,true_false,short_answer,fill_blank,essay) is the legacy flat list and must be mapped, not shown.
**OPT-MOD-JAWAPAN** (leaf mode, label): `mcq` Aneka Pilihan, `match_letter` Padanan Huruf, `short_text` Jawapan Pendek, `numeric` Jawapan Nombor, `working` Kerja Langkah, `essay` Karangan, `drawing` Lukisan, `table_fill` Isi Jadual, `essay_choice` Esei Pilihan; `pksk_choice` never offered in Studio (PKSK domain only). Kontrak "Mod Jawapan Dijangka" multi-select uses these 9.
**OPT-KOD-MARKAH** [DECIDED 1A.8 from exam-schema D4]: `K` Kaedah, `N` Ketepatan, `P` Penaakulan / persembahan, `B` Bebas, `M` Mata sains, `F` Fakta, `C` Kandungan / contoh. (The earlier guessed meanings are withdrawn.)
**[mapping table in 1A.5 is authoritative] OPT-SERVABILITY** (7 activities, order; stored value → label): `databank` Databank · `latih_tubi_spm` Latih Tubi · `bab` Soalan by Chapter · `simulasi_paper` Simulasi · `simulasi_kuiz` Kuiz · `jana_kertas` Jana Kertas · `permainan` Permainan. CODE has 6 values with other labels (`Databank Soalan`, `Latih Tubi SPM`, `Latihan Bab`, `Simulasi (kertas)`, `Simulasi Kuiz`) and no `permainan`; code must add `permainan` and use these labels. State text: `Boleh dilihat` / `Tidak boleh dilihat`. Summary: `Dilihat murid di {n} daripada 7`.
**OPT-DSKP-TAG** (filter): `Semua` (empty), `Ada DSKP Tag` (`tagged`), `Belum Ditag` (`untagged`).
**OPT-COMPLIANCE** (filter, Senarai Soalan): `Semua`, `Verified` (`verified`), `AI Verified` (`aiVerified=true`), `Pending Mapping` (`pending_mapping`), `Tiada Source PDF` (`sourceFile IS NULL`). **OPT-SOURCE-TYPE**: `Semua`, `Textbook` (`textbook`), `DSKP` (`dskp`), `Trial` (`trial`), `Skema` (`marking_scheme`); `ai_generated` not offered (AI hidden, memory alesa-ai).

**OPT-PERANAN** (stored `role`): `student` Pelajar · `teacher` Guru · `parent` Ibu Bapa · `sponsor` Penaja · `school_admin` Admin Sekolah · `ppd_officer` Pegawai PPD · `admin` Admin. List filter order (V2): Semua Peranan, Pelajar, Guru, Admin Sekolah, Pegawai PPD, Admin (+ Ibu Bapa, Penaja [P, V1 cards]). Create form order (V1): Pelajar, Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD, Admin. `Pegawai JPN` (V1) is not in the contract and is not offered. Rule from CODE `ASSIGNABLE_ROLES`: Admin Pusat may assign all 7; Admin Sekolah only student, teacher. A student never combines with another role; `admin` is single-role; roles unique.
**OPT-BULK-ROLE** (Import Pengguna; CODE `BULK_IMPORT_ROLES`): `teacher` Guru, `parent` Ibu Bapa, `school_admin` Admin Sekolah, `ppd_officer` Pegawai PPD; Admin Sekolah may import teachers only (typed 403). School required for teacher and school_admin.
**OPT-STATUS-AKAUN**: filter `Semua`, `Aktif`, `Tidak Aktif`; edit form radio `Aktif (boleh log masuk)` / `Digantung`.
**OPT-JENIS-SEKOLAH** (CODE `SCHOOL_TYPES`, stored = label): `SK`, `SMK`, `SJK(C)`, `SJK(T)`, `MRSM`, `SBP`. Filter `Semua Jenis`.
**OPT-LANGGANAN**: status `active` Aktif, `grace` Tempoh Ihsan, `expired` Tamat, `cancelled` Dibatalkan; Pakej `Pemantauan`, `Penuh`; Tingkatan only `Tingkatan 4`, `Tingkatan 5`; create cards `Pakej SPM Tingkatan 4`, `Pakej SPM Tingkatan 5`.

**OPT-BATCH-STATUS** (intake batch, CODE `INTAKE_BATCH_STATUSES`; BM [P]): `submitted` Dihantar, `processing` Sedang diproses, `ready_for_review` Selesai, `failed` Gagal, `cancelled` Dibatalkan. **OPT-KIRIMAN-STATUS** (Kiriman Guru filter, V2): `Semua Status`, `Pending`, `Processing`, `Selesai`, `Ditolak` mapped to submitted, processing, ready_for_review, rejected [P: `rejected` = rejected by admin with reason; not in contract].
**OPT-LAPORAN-SOALAN**: filter chips `Menunggu ({n})`, `Selesai ({n})`, `Semua ({n})`; row status select `Menunggu`, `Disemak`, `Diperbaiki`, `Ditolak`, `Dikeluarkan` (Dikeluarkan is set by Arkib, not selectable). "Selesai" chip = Disemak + Diperbaiki + Ditolak + Dikeluarkan.
**OPT-KONTRAK-SUMBER**: `draf` Draf, `spec` Spec, `disahkan` Disahkan (Disahkan only via the Pengesahan tab).
**OPT-ARTIKEL-KATEGORI** (CODE → label): `TIPS_BELAJAR` Tips Belajar, `BERITA` Berita, `MOTIVASI` Motivasi, `PANDUAN_IBU_BAPA` Panduan Ibu Bapa, `PANDUAN_GURU` Panduan Guru, `KEJAYAAN` Kejayaan, `UMUM` Umum. Status `Diterbitkan`/`Draf`. Tahap: `Semua`, Tingkatan 1-5.
**OPT-BANNER**: Jenis (CODE) `HERO` Hero, `PROMO` Promosi, `ANNOUNCEMENT` Pengumuman, `EVENT` Acara [labels P]; [DECIDED 1A.8] V2 data FEATURE and PROMOTIONAL stay valid as stored legacy codes (`Ciri Utama (lama)`, `Promosi (lama)`), saved unchanged, not offered for new banners; no data mapping. Jenis Pautan: `NONE` Tiada, `SUBJECT` Subjek, `QUIZ` Kuiz, `ARTICLE` Artikel, `EXTERNAL` Pautan Luar. Sasaran: `ALL` Semua, `STUDENT` Pelajar, `TEACHER` Guru, `ADMIN` Admin.
**OPT-NOTA-JENIS**: filter order `Ringkasan` (RINGKASAN), `Lengkap` (LENGKAP), `Formula` (FORMULA), `Tips & Tricks` (TIPS_TRICKS); form uses the same four (CODE `NOTE_FORM_TYPES`); stored-only types MIND_MAP, FLASHCARD, CHEAT_SHEET show as `Peta Minda`, `Kad Imbas`, `Lembaran Rujukan` [P] in lists, not in the form.
**OPT-VIDEO-KATEGORI** (CODE): `motivasi` Motivasi, `tutorial` Tutorial, `tips-spm` Tips SPM, `ceramah` Ceramah, `lain-lain` Lain-lain [labels P].
**OPT-AUDIO-STATUS**: `draft` Draft, `pending_review` Pending Review, `approved` Approved, `archived` Archived (V2 words kept); create form offers `draft`, `pending_review`, `approved`.
**OPT-TIKET-STATUS** (CODE): `dibuka`, `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup`; chips show the lower-case stored word + count (`dibuka (3)`); status select labels `Dibuka`, `Dalam Proses`, `Menunggu Balas`, `Selesai`, `Ditutup`; default on a new ticket `dibuka`.
**OPT-GAM-JENIS-TRANSAKSI** (CODE ledger kinds): `earn` `💰 Dapat`, `spend` `🛍️ Belanja`, `convert` `🔄 Tukar`, `bonus` `🎁 Bonus`, `refund` `↩️ Refund`; filter first option `Semua Jenis`. `Sumber` keys map to BM [P]: `latihan` Latih Tubi, `cabaran-harian` Cabaran Harian, `kuiz` Kuiz, `admin` Pelarasan Admin, `tebus` Tebusan Hadiah; any unmapped key shows `Lain-lain`.
**OPT-GAM-TIER**: `Gangsa` 🥉, `Perak` 🥈, `Emas` 🥇, `Platinum` 💎; filter `Semua Tier`. Tier colours as swatches (#b45309, #94a3b8, #f59e0b, #06b6d4).
**OPT-CABARAN**: Jenis (stored → label): `quiz_count` Bilangan Kuiz, `accuracy` Ketepatan (%), `topic_variety` Topik Berbeza, `streak` Kombo, `time_spent` Masa (min). Kesukaran: `Mudah`, `Sederhana`, `Sukar` (V1 "Susah" replaced). [DECIDED 1A.8: six types; `combo` added (Kombo) and `streak` = Hari Berturut-turut; the SRS "streak→Kombo" mapping above is withdrawn.]
**OPT-HADIAH-KATEGORI** (stored → label, order): `flagship` 🏆 Mahkota, `ewallet` 💳 E-Wallet, `telco` 📱 Telco, `gaming` 🎮 Gaming, `streaming` 🎬 Streaming, `food_beverage` 🍔 F&B, `ecommerce` 🛒 E-Commerce, `education` 📚 Pembelajaran, `entertainment` 🎭 Hiburan; filter pill `Semua`. Delivery: `manual` `Manual (admin paste)`, `instant` `Instant` (`api` not offered). Tebusan: `pending_admin` `⏳ Pending Admin`, `pending_parent_consent` `⏳ Pending Ibu Bapa`, `delivered` `🎁 Delivered`, `cancelled` `❌ Cancelled`, `Semua`; default pill `⏳ Pending Admin`. Pupil words: Menunggu, Dihantar, Dibatalkan [P].
**OPT-MARKET**: Kategori `Peralatan Sekolah`, `Buku & Rujukan`, `Uniform & Pakaian`, `Stationery`, `Digital & E-Book`, `Lain-lain`; Keadaan `🆕 Baru`/`♻️ Terpakai`; Stok `available` `✅ Ada` / `out_of_stock` `❌ Habis`; Penghantaran `Ambil Sendiri`, `Pos / Kurier`, `COD`, `Percuma`; Status produk `🟢 Aktif`, `⏸️ Draf`, `🔴 Ditolak`; status penjual `Pending`, `Aktif`, `Digantung`, `Diharamkan`.
**OPT-MONITORING-TEMPOH**: `Semua Masa`, `7 Hari`, `30 Hari`, `3 Bulan`; Negeri = `Semua Negeri` + OPT-NEGERI-SEKOLAH (16).
**OPT-SYILING-REWARD-TYPE** (Kos Sebenar Hadiah `Kategori`): VOUCHER, PHYSICAL, EXPERIENCE, DIGITAL, SUBSCRIPTION shown as `Baucar`, `Fizikal`, `Pengalaman`, `Digital`, `Langganan` [P labels].
**OPT-AKTIF**: switch `Aktif` / `Tidak Aktif` (lists) and checkbox `Aktif` (forms); default checked on create.

## 1A. DECIDED OVERRIDES (authoritative; they supersede any older OPT-*, row or message in Parts 1 to 3 that conflicts)

Every item is tagged [DECIDED-BY-PRINCIPLE] with its source. Principles used: P1 replicate V2 where it works and map V2 data to working V3 values (CLAUDE.md §6, D9); P2 DSKP order and exam-schema (`docs/requirements/v2-exam-schema.md`); P3 single owner / one vocabulary (D11, D12); P4 no placeholder (FR-ADM-H0.2); P5 SRS D-A5/D-A6/D108.

**1A.1 Difficulty (stored fields) [DECIDED-BY-PRINCIPLE: SRS D-A6 + QE3.7; P3]**
- Two separate stored fields: `difficulty_tp` (TP 1 to 6, per leaf, DSKP performance level) and `difficulty_level` (Kesukaran, 1 to 5, per question). DM addition: `question_versions.difficulty_level smallint NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5)`; contract `difficultyLevel` maps to this column, not to `difficulty_tp`.
- Default: when the admin sets or changes the question TP, the form pre-fills Kesukaran with `min(5, TP)` only while Kesukaran has not been touched by the admin (flag `difficultyTouched`). The admin may change it at any time; changing TP afterwards never overwrites a touched value. CSV/intake rows without `difficulty`: server fills `min(5, tp)` and marks it `difficultyDefaulted=true` (shown as hint `Dikira daripada TP. Sahkan.`); a teacher's 1-5 stars are stored as given.
- The reverse mapping `tpsOfDifficulty` (be09-practice-mapping.ts:28) must NOT write TP from Kesukaran. Latih Tubi reads `difficulty_level` for its 1-5 filter; DSKP reads `difficulty_tp`.
- Fix note for `50-data-model-erd.md`: line 1242 ("derived `min(5,TP)` at save ..., never typed") and line 1307 ("the contract field `difficultyLevel` is stored in `difficulty_tp`") contradict D-A6 and each other; both are replaced by the rule above. Display labels: OPT-KESUKARAN-5 (5 labels) in forms; OPT-KESUKARAN-3 (1-2 Mudah, 3 Sederhana, 4-5 Sukar) in list badges and filters.

**1A.2 Question status: one vocabulary [DECIDED-BY-PRINCIPLE: P1 V2 labels + P3; SRS §0 F-19; OQ-M1 closed]**
| Label (shown everywhere in admin) | Stored (`question_versions.status`) | Extra condition | Filter query | Contract text it replaces |
|---|---|---|---|---|
| `Draf` | `draft` | `rejection_reason IS NULL` | `status=draft` | `Draf` / V2 `Draft` |
| `Menunggu Semakan` | `review` | none | `status=review` | `Semakan`, `Menunggu`, `Reviewed`, `Menunggu Review` |
| `Diluluskan` | `approved` | none | `status=approved` | `Diterbitkan`, `Approved` |
| `Ditolak` | `draft` | `rejection_reason IS NOT NULL` | `status=draft&rejected=true` | V2 `Ditolak` |
| `Diarkibkan` | `archived` | none | `status=archived` | `Diarkib`, `Archived` |
DM addition: `question_versions.rejection_reason text NULL` (5 to 500 chars), cleared when the version is sent to review again. API addition: query flag `rejected=true|false` on `GET /api/questions` and the filter bulk body. Dashboard tiles (M-01) and Studio tiles use these five labels; the four tiles `Draf`, `Menunggu Semakan`, `Diluluskan`, `Diarkibkan` count the stored values (Ditolak is a sub-count of Draf, shown as chip `Ditolak ({n})`).

**1A.3 MCQ rules [DECIDED-BY-PRINCIPLE: SPM Kertas 1 = A-D; P5]**
- Option rows: minimum 2, maximum 8, default 4 (A-D) on a new MCQ; labels A to H in order; `+ Pilihan` adds the next letter; `Buang pilihan` removes the last and renumbers. Messages: `Soalan aneka pilihan mesti ada 2 hingga 8 pilihan.` (count), `Sila isi semua pilihan jawapan.` (empty option), `Sila pilih jawapan betul.` (none correct). Replaces "3 to 8" in AC-ADM-QE3.2 and rows 04-37; Quick Edit (Q-24) and CSV keep A-D as the common case and allow up to H.
- Explicit types (see 1A.7): `mcq` = exactly one correct; `mcq_multi` = 1 to (options-1) correct, message `Pilih sekurang-kurangnya satu jawapan betul dan sekurang-kurangnya satu jawapan salah.`; `true_false` = two fixed options `Betul` and `Salah`, exactly one correct, option text not editable.

**1A.4 Kertas naming [DECIDED-BY-PRINCIPLE: P1, D9 contradictory labels]**
- Question field `Kertas` = the paper code number: `Kertas 1` to `Kertas 4` (stored `'1'|'2'|'3'|'4'`). DM/contract: widen enum `QuestionKertasSchema`, `QuestionRow.kertas`, list filters and Kontrak to `1..4`. Row 04-16 uses this.
- The paper picker of Langkah 1 is renamed `Set kertas (pilihan)` (V2 label `Kertas (pilihan)` was ambiguous): "put this question into an exam paper or set". Row 04-17 uses this. Option text: `{tahun} {negeri} - {subjek} Kertas {n}`; first option `— Soalan bank (tiada set kertas) —`. The `Kertas` field is auto-filled from the chosen set and then read-only.

**1A.5 Servability activities [DECIDED-BY-PRINCIPLE: 60 API-Q-11 + SRS Q06.1]**
| Stored value | Label (SRS) | Current code label (`SERVABILITY_ACTIVITY_LABELS`) | Change |
|---|---|---|---|
| `databank` | Databank | Databank Soalan | relabel |
| `latih_tubi_spm` | Latih Tubi | Latih Tubi SPM | relabel |
| `bab` | Soalan by Chapter | Latihan Bab | relabel |
| `simulasi_paper` | Simulasi | Simulasi (kertas) | relabel |
| `simulasi_kuiz` | Kuiz | Simulasi Kuiz | relabel |
| `jana_kertas` | Jana Kertas | Jana Kertas | none |
| `permainan` | Permainan | (missing) | ADD to `SERVABILITY_ACTIVITIES` and the labels map; rule: not servable when the question has an image or stimulus (D85 U6); reason `Soalan bergambar tidak digunakan dalam permainan.` |
Summary text `Dilihat murid di {n} daripada 7`.

**1A.6 Question types: SRS label to contract value [DECIDED-BY-PRINCIPLE: P2, P5]**
| SRS BM label | Stored `questionType` | Exists in `QUESTION_TYPES` today? | Leaf mode(s) | Action |
|---|---|---|---|---|
| Aneka Pilihan | `mcq` | yes | `mcq` | none |
| Aneka Pilihan (Pelbagai Jawapan) | `mcq_multi` | no | `mcq` with `multi=true` | ADD value; DM check |
| Betul / Salah | `true_false` | yes (no SRS label) | `mcq` with 2 fixed options | BM label added |
| Padanan / Lengkapkan Petikan | `match` | no | `match_letter` | ADD value |
| Jawapan Pendek | `short_answer` | yes | `short_text`, `numeric` | none |
| Isi Tempat Kosong | `fill_blank` | yes (no SRS label; V2 `cloze`) | `short_text` | BM label added |
| Berstruktur | `structured` | no (exists in intake) | any, depth ≤3 | ADD value |
| Pengiraan dengan Langkah Kerja | `working` | no | `working` | ADD value |
| Karangan / Respons Terbuka | `essay` | yes | `essay`, `essay_choice` | none |
| Lukisan / Graf | `drawing` | no | `drawing` | ADD value; hidden until built (P2) |
| Isi Jadual | `table_fill` | no | `table_fill` | ADD value; hidden until built (P2) |
`pksk_choice` leaf stays PKSK-only and is never offered in the Studio. Order in the select = order of this table. V2 14 modes map on migration: mcq→mcq, short_text→short_answer, numeric→short_answer (leaf numeric), numbered_list→structured, extended_essay→essay, essay_choice→essay (leaf essay_choice), working_shown→working, graph_plot→drawing, draw_on_diagram→drawing, table_fill→table_fill, sequence_order→match, code→short_answer, gapped_text_match→match, cloze→fill_blank.

**1A.7 Stimulus kinds: SRS word to contract value [DECIDED-BY-PRINCIPLE: P1, P5]**
| SRS word | Stored `kind` | BM label in the select |
|---|---|---|
| petikan | `passage` | Petikan |
| rajah | `diagram` | Rajah |
| jadual | `table` | Jadual |
| graf | `graph` | Graf |
| peta | `map` | Peta |
| carta | `infographic` | Carta / Infografik |
| other | `image` | Imej / Gambar |
V2 data kinds map on migration: Passage→passage, Box→passage, Table→table, Diagram→diagram, Graph→graph, Image→image, Infographic→infographic, Cartoon→image, Map→map, Math→passage (math typeset inside), Code/Pseudocode/Sql→passage (monospace block, button `</>`), Audio/Video→not migrated (reported in the migration list; Audio KBAT is a separate module). Order in select: Petikan, Rajah, Jadual, Graf, Peta, Carta / Infografik, Imej / Gambar. Replaces OPT-JENIS-RANGSANGAN.

**1A.8 Other decisions**
- Jenis kertas [DECIDED-BY-PRINCIPLE: P1 V2 meaning, working code values]: stored set = `QUESTION_JENIS` (`sebenar`, `percubaan`, `modul`, `topikal`, `latihan`); labels `Sebenar`, `Percubaan`, `Modul` (V2 observed on Sumber Kertas), `Topikal`, `Latihan`; filter order `Percubaan`, `Sebenar`, `Modul`, `Topikal`, `Latihan`. The upload form (Q-08) uses this same set; `INTAKE_PAPER_TYPES` strings are retired and mapped: Percubaan SPM→percubaan, Soalan Umum→topikal, Peperiksaan Sebenar→sebenar, Buku Latihan→latihan, Lain-lain→modul.
- Scheme point codes [DECIDED-BY-PRINCIPLE: P2, `v2-exam-schema.md` lines 240-250; B is Low confidence]: `K` Kaedah (method); `N` Ketepatan (accuracy, answer); `P` Penaakulan / persembahan; `B` Bebas (independent mark); `M` Mata sains (penerangan atau pengiraan); `F` Fakta; `C` Kandungan / contoh. The select shows `K - Kaedah`, `N - Ketepatan`, `P - Penaakulan / persembahan`, `B - Bebas`, `M - Mata sains`, `F - Fakta`, `C - Kandungan / contoh`; subject hint: K, N for Matematik/Matematik Tambahan; P Matematik Tambahan; M Fizik; F Sejarah; C BI penulisan and Sejarah contoh.
- Banner types [DECIDED-BY-PRINCIPLE: P1 map V2 data to code values]: form values `HERO` Hero, `PROMO` Promosi, `ANNOUNCEMENT` Pengumuman, `EVENT` Acara (code `BANNER_TYPES`). Stored legacy codes `FEATURE` (label `Ciri Utama (lama)`) and `PROMOTIONAL` (`Promosi (lama)`) stay valid and are saved unchanged (code already allows it); they are not offered for new banners. No data change.
- Kombo vs streak [DECIDED-BY-PRINCIPLE: P1, V2 `admin_gamification_challenges.txt`]: V2 has `Kombo 10` (description `Capai kombo 10 jawapan betul`, type `kombo` = correct answers in a row) and `Kombo 2 Hari` (`Kekalkan kombo latihan selama 2 hari berturut-turut`, type `streak` = consecutive days). Challenge types become six: `quiz_count` Bilangan Kuiz, `accuracy` Ketepatan (%), `topic_variety` Topik Berbeza, `combo` Kombo (jawapan betul berturut-turut) [ADD to `GAMIFICATION_CHALLENGE_TYPES`, evaluator required], `streak` Hari Berturut-turut, `time_spent` Masa (min). V2 raw keys map: kuiz/bilangan_kuiz→quiz_count, ketepatan→accuracy, topik_berbeza→topic_variety, kombo→combo, masa→time_spent. Difficulty values `easy|medium|hard` → `Mudah`, `Sederhana`, `Sukar`.
- Exports [DECIDED-BY-PRINCIPLE: SRS §6 "Export CSV deferred; others P2"]: the Dashboard CSV downloads (M-01) and `Eksport PDF` (M-03) are P2, not R1; `Eksport CSV` on Pengguna is observed in V2 and stays (user list only); Transaksi CSV stays [PROPOSED] P2.

**1A.9 CSV import: one header set for every question type [DECIDED-BY-PRINCIPLE: P2, P5, owner decision of coordinator]**
Limits: file `.csv` or `.txt`, UTF-8 (BOM allowed), comma separator, `"` quoting, max 5 MB (ERR-REQ-03 with {n}=5), max 2,000 data rows excluding the header (module error `Fail melebihi 2,000 baris. Pecahkan fail kepada beberapa bahagian.`, whole file refused, 422), header row required (missing required column: `Fail CSV mesti mempunyai kolum {senarai}.`). Defaults from the screen (Subjek Lalai, Tingkatan lalai, Kesukaran lalai) fill empty cells of `subject_code`, `tingkatan`, `difficulty`.
Row model: **one row = one leaf part**. Rows with the same `question_key` form one question (consecutive rows). Rows with the same `group_key` (non-empty) form one stimulus group (the questions must be consecutive). Question-level cells are read from the first row of the question; later rows may leave them empty.
| Column | Required for | Value / limit | Exact BM error (`Baris {n}: ` prefix; CSV report `mesej` column) |
|---|---|---|---|
| `question_key` | all | text ≤40, unique per question | `Kunci soalan diperlukan.`; `Baris soalan tidak berturutan.` |
| `type` | all | `mcq`, `mcq_multi`, `true_false`, `match`, `short_answer`, `fill_blank`, `structured`, `working`, `essay` (+ `drawing`, `table_fill` when built) | `Jenis soalan tidak sah.` |
| `part_label` | `structured`, `working`, `essay` with several parts; else empty | `(a)`, `(b)`, `(i)` ≤8 chars; depth ≤3 by dots `a.i` | `Label bahagian diperlukan.` |
| `subject_code` | all unless default | OPT-SUBJEK code | `Kod subjek tidak dikenali.` |
| `tingkatan` | all unless default | `1` to `5` or `T1` to `T5` | `Tingkatan tidak sah.` |
| `kertas` | SPM-bound (Subjek in SPM catalogue, Tingkatan 4 or 5) | `1` to `4` | `Sila pilih kertas untuk soalan SPM.` |
| `bahagian` | when `kertas` set and contract has sections | section label e.g. `A` | `Bahagian tidak dikenali.` |
| `number_label` | optional | `^[0-9]{1,3}[A-Za-z]?$` | `Nombor soalan tidak sah.` |
| `unit_code` | SPM-bound | printed unit code (`4.0`) | `Sila pilih unit DSKP.` / `Kod unit tiada dalam senarai kurikulum.` |
| `sp_codes` | SPM-bound | 1 to 3 codes separated by `;` | `Sila pilih sekurang-kurangnya satu SP DSKP.`; `Pilih paling banyak 3 SP.`; `SP "{kod}" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.` |
| `tp` | every leaf, SPM-bound | integer 1 to 6 | `Bahagian ({label}) belum ada TP.`; `TP mesti antara 1 dan 6.` |
| `aras` | every leaf, SPM-bound | `mengingat`, `memahami`, `mengaplikasi`, `menganalisis`, `menilai`, `mencipta` | `Bahagian ({label}) belum ada aras pemikiran.`; `Aras pemikiran tidak sah.` |
| `kbat` | optional | `mengaplikasi`, `menganalisis`, `menilai`, `mencipta`, `bukan`; empty = derived | `Nilai KBAT tidak sah.` |
| `bab_kod` | to publish when chapters exist | chapter number within Subjek+Tingkatan | `Sila pilih Bab.`; `Bab tidak sepadan dengan subjek dan tahap.` |
| `topik_kod` | optional | topic number within the Bab | `Topik tidak sah.` |
| `difficulty` | all (default from screen, else `min(5,tp)`) | integer 1 to 5 | `Sila pilih tahap kesukaran.` |
| `group_key` | optional | text ≤40 | `Baris kumpulan mesti berturutan.` |
| `stimulus_kind` | first row of a group or own stimulus | `passage`, `diagram`, `table`, `graph`, `map`, `infographic`, `image` | `Sila pilih jenis rangsangan.` |
| `stimulus_text` | `passage`, `table` (table as CSV-in-cell JSON [P] `[["kepala1","kepala2"],["a","b"]]`) | ≤20,000 chars | `Petikan mesti mempunyai teks.`; `Jadual mesti mempunyai kepala dan sekurang-kurangnya satu baris, atau imej.` |
| `stimulus_image_url` | image kinds | https URL ≤500, JPG/PNG/WebP ≤2 MB fetched at import | `Imej rangsangan tidak dapat dimuat turun.`; `Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.` |
| `stimulus_alt` | image kinds | ≤1000 | `Sila isi teks alternatif imej.` |
| `stimulus_caption`, `stimulus_source` | optional | ≤300 each | `Kapsyen tidak boleh melebihi 300 aksara.` |
| `prompt_ms` | all | ≥10 chars (MCQ stem), ≤2000 | `Teks soalan mesti sekurang-kurangnya 10 aksara.` |
| `prompt_en` | optional | ≤2000 | n/a |
| `option_a` to `option_h` | `mcq`, `mcq_multi` (A, B required; C to H optional but contiguous), `match` (bank, up to 8) | ≤500 each; `true_false` leaves them empty | `Sila isi semua pilihan jawapan.`; `Soalan aneka pilihan mesti ada 2 hingga 8 pilihan.` |
| `correct` | `mcq` one letter; `mcq_multi` letters separated by `;`; `true_false` `betul` or `salah`; `match` pairs `1=C;2=A` | letters must exist | `Sila pilih jawapan betul.`; `Pilih sekurang-kurangnya satu jawapan betul dan sekurang-kurangnya satu jawapan salah.` |
| `accepted_answers` | `short_answer`, `fill_blank`, `working` | up to 10 values separated by `|`, each ≤200 | `Sila masukkan jawapan betul.` |
| `numeric_value`, `numeric_unit`, `tolerance_kind`, `tolerance_value` | numeric leaf | number; unit ≤20; `abs` or `rel`; ≥0 | `Toleransi tidak boleh negatif.` |
| `word_min`, `word_max` | `essay` optional | integers 0 to 5000, min ≤ max | `Julat perkataan tidak sah.` |
| `marks` | every leaf | integer 1 to 100 | `Nilai mata mesti sekurang-kurangnya 1.`; `Markah bahagian tidak boleh melebihi 100.` |
| `scheme` | non-MCQ leaves | points separated by `|`, each `KOD:markah:teks`, e.g. `K:1:Tulis persamaan|N:1:x=3`; code one of K N P B M F C; sum = `marks` | `Jumlah markah skema ({a}) mesti sama dengan markah bahagian ({b}).`; `Kod markah tidak sah.` |
| `bahasa` | optional, default `bm` | `bm`, `en` | `Bahasa tidak sah.` |
| `jenis_tulisan` | optional, default `rumi` | `rumi`, `arab`, `jawi`, `mixed` | `Jenis tulisan tidak sah.` |
Outcome (partial success, GB-06 / ERR-REQ-01 pattern): a question is imported only if all its rows are valid; invalid questions are skipped whole and every row error is reported. Result panel: `Import selesai: {n} soalan diimport, {m} gagal.` and, when m>0, button `Muat turun laporan ralat (CSV)` giving a UTF-8 CSV with columns `baris`, `question_key`, `medan`, `kod_ralat`, `mesej` (one line per error). Imported questions are drafts; one that is DSKP-complete can be published without the wizard (QE6.3). Re-uploading the same file creates the questions again and shows `{n} soalan sama dengan soalan sedia ada.` as a warning only. Template: button `Muat Turun Templat CSV` (header row plus one example row per type). This table replaces the earlier 17-row CSV table of Q-11.

**1A.10 Global error behaviour = the ERR catalogue (`scratchpad/fields/error-handling.md` §9) [DECIDED-BY-PRINCIPLE: P3]** GB-01 below is replaced by these references; per-screen rows that quote a generic pattern defer to the ERR text.
| Cause | ERR-ID | Surface | Input kept |
|---|---|---|---|
| 400 malformed | ERR-REQ-02 | toast | yes |
| 401 | ERR-AUTH-01 (return URL, draft kept in `pp.draft.*`, restore notice `Terdapat kerja yang belum disimpan daripada sesi sebelum ini.`) | redirect + banner | yes |
| 403 | ERR-ACC-01 (page for route, toast for action) | page / toast | yes |
| 404 | ERR-ACC-02 (route), ERR-ACC-04 (action on vanished row) | page / toast | yes |
| 409 | ERR-CON-01 generic, ERR-CON-02 `edit-as-draft` exists, ERR-CON-02b `STALE_VERSION`, ERR-CON-03 bulk count changed, ERR-CON-04 lifecycle (use the V2 text `Peralihan '{dari}' -> '{ke}' tidak dibenarkan.` as its specific message), ERR-CON-05 group/pending item | dialog / toast | yes |
| 413 / 415 | ERR-REQ-03 / ERR-REQ-04 (client pre-check ERR-REQ-05..07) | inline at file | other fields yes |
| 422 | ERR-REQ-01 plus field patterns ERR-REQ-10 required, -11 select, -12 too long, -13 too short, -14 format, -15 range, -16 duplicate; gate lists ERR-QST-01..04 | inline | yes |
| 429 | ERR-RATE-01; quotas ERR-QUOTA-01..07 (import seats = QUOTA-01; intake limits = QUOTA-03..05) | banner + countdown | yes |
| 500/502/503/504 | ERR-SYS-01 / -02 / -03 / -04; failed list load ERR-SYS-01b (admin lists keep V2 text `Gagal memuat senarai.` + `Cuba lagi`) | toast / panel / page | yes |
| network / timeout | ERR-NET-01 / ERR-NET-02 (30 s JSON, 60 s no upload progress, 120 s export and import), recovery ERR-NET-03 | banner + toast | yes |
| boot / chunk | ERR-SYS-05 / ERR-SYS-06 | page / dialog | draft saved first |
| autosave / action save | ERR-SAVE-01 / ERR-SAVE-02 | status chip / toast | yes |
| import and OCR job failures | ERR-INT-01..12 (encrypted, corrupt, too many pages, too complex, OCR timeout / failed / unavailable, render failed, cancelled, batch failed, retry exhausted, guru upload 503 removed) | batch status `Gagal` + reason | files kept |
Retry rule: GET/HEAD auto-retry 2 times (1 s, 3 s); writes never auto-retry except Bijak engines; manual `Cuba Semula` on every failed load; a failed save re-enables the button and keeps the form (ERR-SAVE-02).

**1A.11 Responsive field rules from §4.R [DECIDED-BY-PRINCIPLE: P1 + FR-X6]** Apply to every field in Part 3: 375 px one column, label above, control height ≥44 px, no horizontal page scroll; `select` with >12 options and every searchable select open a full-height bottom sheet with a search box; multi-select (SP, Negeri chips, Mod Jawapan) show chosen items as wrapping chips; date inputs use the native picker; file drop zones show a `Pilih Fail` button (no drag needed); tables become cards (stem 3 lines + `Lihat penuh`); the sticky action bar never covers the active field; drag is replaced by `Naik` / `Turun`; numeric inputs use `inputmode="numeric"`. Wizard at 375: one step per screen, `Langkah n/4`, `Seterusnya` / `Kembali`, count `{n} belum lengkap` opens the completeness panel as a bottom sheet.

**1A.12 Calculations (FR-X4, 40-cross-cutting) used by admin screens** Ketepatan / Ketepatan Purata = pooled correct ÷ answered × 100 over `practice_answers`, whole number rounded half up, `—` with 0 answers, never above 100 (XS-5); Soalan Dijawab = count of answer rows (XS-4); Soalan Diuji = distinct `question_id` (XS-7); Skor Purata = mean of per-session accuracies, whole number, never labelled Ketepatan; Syiling per correct = `flatCoins` setting (default 1), XP 10 per correct; Kesukaran labels as 1A.1. AC-X4-2 example: 1/1, 1/2, 4/7 → 100, 50, 57; class 6/10 = 60. Percentages are never stored rounded.

**1A.13 Reading notes from the remaining SRS sections**
- §4.V.3: the V2 test papers ("Alip Elyzian Test", "For Elyzian Dev", "Test Soalan") must not appear in `Set kertas (pilihan)`; rule: papers flagged `is_test` or created by QA are excluded.
- §5 U-OP tasks supply defaults this register depends on: `latih-tubi` and `permainan` flags ON (U-OP-11); digital rewards activated by the admin (U-OP-13); support contact set (U-OP-16); Darjah deactivated (U-OP-03).
- §6: `Export CSV` for Pengguna/Soalan/Sekolah is deferred except as 1A.8 states; `Notifikasi (Push)` is out, so every "notification" in this register is in-app only (`GET /api/me/notifications`).
- §8.2 closed by this register: OQ-M1 (Dashboard uses 1A.2 labels), OQ-H1 (1A.8 challenge types, only measurable types offered), OQ-QE2 stays as D108(2). §8.3 E-14 (Rujuk Kawan, Beri Syiling, Hantar kod, Cabutan, Kotak Misteri, Tournament, seller flow, parent-links) remains open: those specs are [P] only. §8.4: the new [P] strings in Part 3 and 1A must be appended to the D94 approval table.
- X9 chains confirm: 10 XP per correct answer; the Bab item is required only when the Subjek+Tingkatan has chapters; Tahap kesukaran 3 in AC-CHAIN-1 is typed.

## 2. Global behaviour rules (GB-*) [GB-01 SUPERSEDED by 1A.10 (ERR-*); GB-02..06 stay, GB-06 import outcome refined by 1A.9]

SRS covers only: NFR-4 429 "retry message, never an empty Ralat screen" (40), the 404 rule for a flag OFF (D108(6)), Set Builder error strings (Q-14), McqGate/gate messages, and bulk-count messages. Everything else below is [P] and applies to every admin screen unless a screen block overrides it. Status: MISSING in SRS unless stated.

**GB-01 [SUPERSEDED by 1A.10: use ERR-* ids; the table below is kept only as a draft of those texts] Error handling per cause** (input is kept in every case; the Simpan/Hantar button re-enables; a request in flight disables its button and shows `Menyimpan…`):
| Cause | UI | Exact BM |
|---|---|---|
| 400 | inline banner above the form | `Permintaan tidak sah. Semak data dan cuba lagi.` |
| 401 | redirect to `/log-masuk?kembali={laluan}`; unsaved wizard text kept in draft recovery | `Sesi anda telah tamat. Sila log masuk semula.` (shown on login page) |
| 403 | toast for an action; standard 403 page for a route | `Anda tidak dibenarkan melakukan tindakan ini.` |
| 404 | route: standard 404 page (D108(6)); action on a vanished row: toast and list reload | `Rekod tidak dijumpai. Senarai dimuat semula.` |
| 409 | dialog with the server message and `Muat Semula`; typed 409 texts of the contract are shown as-is (e.g. `LAST_ADMIN_MESSAGE`) | `Rekod ini telah diubah oleh pengguna lain. Muat semula dan cuba lagi.` |
| 422 | inline under each field from `details[].path`; focus first invalid field; banner on top | `Sila betulkan {n} medan di bawah.` |
| 429 | toast with countdown from `Retry-After`; button `Cuba Lagi` | `Terlalu banyak permintaan. Cuba lagi dalam {s} saat.` |
| 5xx | toast + `Cuba Lagi` | `Ralat pelayan. Sila cuba lagi. Jika berterusan, hubungi sokongan.` |
| network failure | toast + `Cuba Lagi`; wizard autosaves to draft recovery | `Tiada sambungan. Semak internet anda dan cuba lagi.` |
| timeout (30 s; uploads 120 s; extraction polling 5 s) | same as 5xx | `Permintaan mengambil masa terlalu lama. Sila cuba lagi.` |
**GB-02 Loading**: first load = skeleton rows, text `Memuatkan…`; refetch keeps old rows dimmed. **Empty list**: `Tiada data untuk dipaparkan.` unless the screen block gives its own copy. **Partial** (a widget fails, page loads): the widget shows `Tidak dapat dimuatkan.` with `Cuba lagi`; other widgets stay.
**GB-03 Pagination/sort/search defaults**: page size 25 (Studio, Senarai Soalan, lanes, Pengguna, Gamifikasi Pelajar 25, Tiket 25, Sumber Kertas 25), 20 (Artikel, Nota, Kelompok Item), 30 (Sekolah), 50 (Transaksi, Hadiah); contract bounds page ≥1 (`Halaman tidak sah.`), size 1 to 100 (`Saiz halaman mesti antara 1 dan 100.`); search text max 100 chars (`Carian tidak boleh melebihi 100 aksara.`), trimmed, case-insensitive contains; default sort = newest first (`id` desc) except Tracking A/Set (by title), Subjek/Tahap (by `Susunan`), Tier (by `Urutan`), Kontrak (Subjek then Kertas); filters persist in the URL query and survive paging (V1 defect D-5); `Set Semula` clears all.
**GB-04 Confirm dialog template** (irreversible or bulk actions): title `{Tindakan}?`, body states the object and count and "Tindakan ini tidak boleh dibatalkan." when irreversible, buttons `Batal` (secondary, default focus) and `Ya, {Tindakan}` (danger). Escape/outside click = `Batal`.
**GB-05 Flash**: success = toast 5 s, text from the screen block; every write by Admin Pusat writes an audit row (actor, time, before/after summary, FR-ADM-H0.3).
**GB-06 Import outcome** (CSV/paste/PDF): the file is validated first (size, type, header). Row errors never abort the file unless stated: valid rows import, invalid rows are listed with `Baris {n}: {medan} - {sebab}`; result panel `Import selesai: {n} soalan diimport, {m} gagal.` (Q-11) or `{n} dicipta, {s} dilangkau, {m} ditolak` (users); `Muat turun ralat (CSV)` downloads the rejected rows with a `sebab` column; re-upload of the same file is safe (existing records skipped, never overwritten, V2 notice). Whole-file refusals: wrong type `Format fail tidak sah. Gunakan .csv atau .txt.`; too big `Fail melebihi had {x} MB.`; empty `Fail kosong.`; header missing `Fail CSV mesti mempunyai kolum {senarai}.`; over row limit `Fail melebihi {n} baris.` (users 1000 rows, 1,048,576 characters, CODE).

## 3. Field & behaviour spec per screen

Column key: `#` | Label | Type | Req / default | Options or data source | Validation and exact BM messages | Dependencies | SRS | Evidence. Cells with `[P]` are the proposed spec for the gap.

### 3.1 Question-entry standard: QE-01..QE-08 and the wizard (Q-04); shared by Q-05, Q-08, Q-09, Q-10, Q-12, Q-18, Q-24

#### Q-04 `Cipta baharu` / `Sunting soalan` (wizard; DSKP-first order, API-Q-03, API-Q-06, API-Q-09 `GET /api/questions/studio/dskp`, DM `question_versions`, `question_parts`)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 04-01 | `Subjek` | select | required; `— Pilih Subjek —` | OPT-SUBJEK, active only | `Sila pilih subjek.` | parent of 02-04 | PARTIAL (list of 31 only in filters) | SRS QE3.1; CODE |
| 04-02 | `Tingkatan` | select | required; `— Pilih Tingkatan —` | OPT-TINGKATAN | `Sila pilih tahap pendidikan.` | changing it clears Tajuk DSKP, SP, Bab, Topik | PARTIAL (stored code, clearing missing) | SRS QE3.5, D96 |
| 04-03 | `Tajuk DSKP` | searchable select | required; null only for `form_origin` t1_t3 | `curriculum_nodes` kind unit of Subjek+Tingkatan, sorted by printed code (natural order `1.0`,`2.0`,`10.0`); option text `{kod} {tajuk}`; stored `unit_node_id`; empty list: text `DSKP belum dimuatkan untuk subjek ini.` + link `Kurikulum > DSKP` | `Sila pilih unit DSKP.` (existing copy; keep) | clears SP when changed | PARTIAL (option format, empty copy [P]) | SRS 4.G.1, C-04.AC2; CODE dskp-gate.ts |
| 04-04 | `SP` | multi-select (min 1, max 3) | required for SPM-bound T4/T5 | SP nodes of the chosen unit; option `{kod} {teks SP}`; a chosen SP shows its text | `Sila pilih sekurang-kurangnya satu SP DSKP.`; 4th pick: `Pilih paling banyak 3 SP.` [P]; typed code not in list on blur: `SP "{kod}" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.`; API `SP DSKP tidak sah.`; no free text | needs 04-03 | PARTIAL (max-3 message missing) | SRS QE4.2/4.3 |
| 04-05 | `SK` | read-only text | derived, never typed | `{kod} {teks SK}` of the chosen SP(s), comma separated if several | none | from 04-04 | PARTIAL | SRS 4.G.1 |
| 04-06 | `TP` (soalan) | select | derived = highest leaf TP; editable as default for leaves | OPT-TP | `Bahagian ({label}) belum ada TP.` if a leaf is empty | feeds 04-07 | PARTIAL | SRS 4.G.2 |
| 04-07 | `TP` (per bahagian) | select | required per leaf, SPM-bound T4/T5; default = question TP | OPT-TP | `Bahagian ({label}) belum ada TP.` | leaf | COMPLETE message / PARTIAL control | CODE dskp-gate.ts:18-24 |
| 04-08 | `Aras pemikiran` (default soalan) | select | optional default; `— Pilih —` | OPT-ARAS | none | inherited by leaves | PARTIAL | SRS QE3.4 |
| 04-09 | `Aras pemikiran` (per bahagian) | select | required per leaf for SPM-bound T4/T5 approval | OPT-ARAS | `Bahagian ({label}) belum ada aras pemikiran.` | leaf | PARTIAL (labels) | SRS D108(2) |
| 04-10 | `KBAT` | read-only badge + override select | optional; `— Ikut aras pemikiran —` | OPT-KBAT-OVERRIDE | none | from 04-09 | PARTIAL (control not specified) | CODE parts.ts:150-165 |
| 04-11 | `Bab` | select | required to publish when the Subjek+Tingkatan has chapters; `— Pilih Bab —` | `chapters` of Subjek+Tingkatan ordered by chapter number; option `Bab {no}: {nama}`; stored `question_versions.chapter_id`; if none exist the field is hidden and not required | `Sila pilih Bab.`; `Bab tidak sah.`; `Bab tidak sepadan dengan subjek dan tahap.` | clears when 04-01/04-02 change | PARTIAL | SRS QE4.5, Q04.2; CODE |
| 04-12 | `Topik` | select | optional | topics of the chosen Bab, `— Pilih Topik —` | `Topik tidak sah.` | clears when Bab changes | PARTIAL | SRS 4.G.1 |
| 04-13 | `Tahap kesukaran` | select | required; pre-filled `min(5, TP)` until touched (1A.1) | OPT-KESUKARAN-5 | `Sila pilih tahap kesukaran.` | default follows 04-06; stored in `difficulty_level` | PARTIAL (control, labels) | SRS QE3.7 |
| 04-14 | `Rujukan buku teks` (Bab, Tingkatan, Muka surat) | 3 inputs | optional (Sejarah mainly) | text ≤20 / OPT-TINGKATAN / integer 1 to 999 [P] | `Muka surat mesti nombor antara 1 dan 999.` [P] | none | PARTIAL | SRS 4.G.1 |
| 04-15 | `Asal tingkatan` (`form_origin`) | select | shown only when no unit exists for the content | `— Tiada —`, `Tingkatan 1-3` (`t1_t3`), `Tingkatan 4` (`t4`), `Tingkatan 5` (`t5`) [labels P] | none | with 04-03 null | PARTIAL | CODE parts.ts:165 |
| 04-16 | `Kertas` (nombor kertas; 1A.4) | select | required if SPM-bound (SPM catalogue subject and T4/T5); flat MCQ defaults to `Kertas 1`; auto-filled and read-only when 04-17 is chosen | OPT-KERTAS (1 to 4) | `Sila pilih kertas untuk soalan SPM.` | filtered by contract of Subjek | PARTIAL | SRS 4.G.1 |
| 04-17 | `Set kertas (pilihan)` (renamed from V2 `Kertas (pilihan)`, 1A.4) | select | optional; `— Soalan bank (tiada set kertas) —` | papers of the Subjek+Tingkatan, label `{tahun} {negeri} - {subjek} Kertas {n}`, newest first; test papers excluded [P] | none | filters Bahagian | PARTIAL | V2 create.txt; SRS Q-04 |
| 04-18 | `Bahagian` | select | required if a paper is chosen; else from the contract of Subjek+Kertas | OPT-BAHAGIAN; shows rule `Jawab semua`/`Jawab satu` and mark budget read-only | `Sila pilih bahagian.` [P] | needs 04-16/04-17 | PARTIAL | SRS 4.G.5 step 3, G5.3 |
| 04-19 | `Nombor soalan` | text | optional; auto-suggest next number | max 10 chars, pattern `^[0-9]{1,3}[A-Za-z]?$` [P] | `Nombor soalan tidak sah.` [P]; `Nombor soalan {x} sudah digunakan dalam kertas ini.` | unique within a paper | PARTIAL | SRS 4.G.5; CODE numberLabel |
| 04-20 | Start choice | radio | default `Soalan tunggal` | `Soalan tunggal`, `Kumpulan rangsangan` | none | group opens Q-05 | PARTIAL ([PROPOSED] labels in SRS) | SRS QE2.1 |
| 04-21 | `Jenis rangsangan` | select | required when a stimulus is added; default `Petikan` | OPT-JENIS-RANGSANGAN | `Sila pilih jenis rangsangan.` | decides 04-23/04-24 | PARTIAL (V2 15 kinds vs 7) | CODE |
| 04-22 | `Kapsyen (pilihan)` | text | optional | max 300 chars | `Kapsyen tidak boleh melebihi 300 aksara.` [P] | none | PARTIAL | CODE STIMULUS_LIMITS |
| 04-23 | Editor rangsangan | rich text (B, I, `• Senarai`, `1. Senarai`, `</>`, `Jadual`, `+Baris`, `+Lajur`, `×Jadual`, `√x`, `√x blok`, `Imej`, undo, redo) | required for `Petikan`; table kind needs header + ≥1 row or image | body max 20,000 chars; table max 12 columns, 60 rows, cell 500 chars | `Petikan mesti mempunyai teks.`; `Jadual mesti mempunyai kepala dan sekurang-kurangnya satu baris, atau imej.`; `Rangsangan ini sedang digunakan oleh kumpulan atau soalan. Keluarkan daripada penggunaan dahulu.` (delete) | by kind | PARTIAL (limits missing) | CODE stimuli.ts |
| 04-24 | `Imej` (muat naik) | file | required for image kinds | JPG, PNG, WebP; max 2 MB; one file | `Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.`; `Sila muat naik imej untuk rangsangan ini.`; `Imej tidak sah. Muat naik semula.` | image kinds only | PARTIAL | CODE |
| 04-25 | `Teks alternatif imej` | text | required for image kinds [P] | max 1000 chars | `Sila isi teks alternatif imej.` [P] | with 04-24 | MISSING | CODE `alt:1000` |
| 04-26 | `Sumber rangsangan` | text | optional | max 300 chars | `Sumber tidak boleh melebihi 300 aksara.` [P] | none | MISSING | CODE `source:300` |
| 04-27 | `Skop rangsangan` | hidden | default `section` (`section` or `paper`) | `section`, `paper` | none | BI banks use `paper` | MISSING | CODE stimuli.ts:152 |
| 04-28 | `Pilih kumpulan` | searchable select | optional | stimulus groups of the same Subjek, label `{kapsyen} · {n} soalan`, only groups with no served question | `Soalan ini bukan ahli kumpulan ini.`; `Soalan ini sudah berada dalam kumpulan rangsangan lain.`; `Soalan dalam satu kumpulan mesti sama subjek.`; `Soalan dalam satu kumpulan mesti sama kertas.` | with 04-20 | PARTIAL | CODE STIMULUS_MESSAGES |
| 04-29 | `Matematik dalam baris (LaTeX)` dialog | text + `Sisip` / `Batal` | optional | max 500 chars | `Formula matematik tidak sah.` [P] | editor | PARTIAL | V2 |
| 04-30 | `Jenis soalan` | select | required; `— Pilih Jenis —` | table 1A.6 (9 values in R1; `drawing` and `table_fill` hidden until built) | `Jenis soalan tidak sah.` | builds the part template | PARTIAL (stored values, 5 vs 8) | SRS QE3.2; CODE |
| 04-31 | `Label` (bahagian) | text | required per part; auto `(a)`, `(b)`, `(i)` | max 8 chars | `Label bahagian diperlukan.` [P] | depth ≤3, no marks on parents | PARTIAL | V2; SRS QE3.3 |
| 04-32 | Teks soalan / `Soalan` (BM) | rich text | required | BM `ms`; MCQ stem min 10 chars | `Teks soalan mesti sekurang-kurangnya 10 aksara.` | leaf | PARTIAL | CODE |
| 04-33 | Teks soalan (EN) | rich text | optional | `en` | none | none | PARTIAL | CODE parts.ts:17 |
| 04-34 | `Jenis jawapan` (leaf) | select | required per leaf | OPT-MOD-JAWAPAN limited by 04-30 (mcq→mcq; match→match_letter; short→short_text,numeric; working→working; essay→essay,essay_choice) | `Jenis jawapan tidak sah.` [P] | by 04-30 | PARTIAL | CODE |
| 04-35 | `Markah` | number | required per leaf | integer 1 to 100 | `Nilai mata mesti sekurang-kurangnya 1.`; `Markah bahagian tidak boleh melebihi 100.` [P]; parents no marks; `Jumlah markah {n}` shown | sum of parts | PARTIAL (max) | CODE PartMarks 100 |
| 04-36 | `Arahan sub-bahagian` | textarea | optional | max 500 chars | `Arahan tidak boleh melebihi 500 aksara.` [P] | none | PARTIAL | V2 |
| 04-37 | `Pilihan A`..`Pilihan H` (MCQ; 1A.3) | text rows + optional image each | 2 to 8 rows, labels A to H in order; default 4 rows A-D; `true_false` fixed to `Betul` / `Salah` | body max 500 chars, image per 04-24 rules; `+ Pilihan` / `Buang pilihan` | `Sila isi semua pilihan jawapan.`; `Soalan aneka pilihan mesti ada 2 hingga 8 pilihan.` [DECIDED 1A.3]; `Label pilihan mesti A hingga H.` | MCQ | PARTIAL | AC-QE3.2; CODE |
| 04-38 | Jawapan betul (radio per pilihan) | radio | exactly one | one of the rows | `Sila pilih jawapan betul.`; `{n} jawapan betul dipilih. Soalan objektif hanya boleh ada satu.` | MCQ | COMPLETE | SRS Q-24 |
| 04-39 | `+ Jawapan diterima` | repeating text | at least 1 for `short_text` | up to 10, each max 200 chars | `Sila masukkan jawapan betul.` | short/working | PARTIAL | V2; CODE accept[] |
| 04-40 | Jawapan angka: `Nilai`, `Unit`, `Toleransi` | number, text ≤20, select | required for `numeric` | tolerance kind `Mutlak` (`abs`) or `Relatif` (`rel`), value ≥0; default `Mutlak` 0 | `Sila masukkan jawapan betul.`; `Toleransi tidak boleh negatif.` [P] | numeric | PARTIAL | CODE parts.ts:74 |
| 04-41 | Skema: titik markah (`Kod`, `Label`, `Markah`, `Teks`) | repeating row | required for every non-MCQ leaf | `Kod` OPT-KOD-MARKAH; label ≤200; marks integer ≥0; sum must equal leaf marks | `Jumlah markah skema ({a}) mesti sama dengan markah bahagian ({b}).` [P]; badge `⚠ tiada skema` | per leaf | PARTIAL (D4 only by name) | CODE parts.ts:51; V2 |
| 04-42 | Penalti (`ejaan`, `unit`, `AB`, `TP`, `salin`) | repeating row | optional | codes `spelling`,`unit`,`sf`,`dp`,`copy` with amount and optional cap | `Jumlah penalti melebihi markah bahagian.` [P] | numeric/short | MISSING | CODE parts.ts:101 |
| 04-43 | `Julat perkataan` (`min`, `max`) | 2 numbers | optional for essay | 0 to 5000, min ≤ max | `Julat perkataan tidak sah.` [P] | essay | MISSING | CODE IntakeWordRange |
| 04-44 | Topik esei (essay_choice) | repeating text | 2 to 6 | each max 200 chars | `Esei pilihan mesti mempunyai 2 hingga 6 topik.` [P] | essay_choice | MISSING | CODE `essayTopics` |
| 04-45 | Bank pilihan padanan (A-H) | repeating text | 2 to 8 labels for `match` | each max 200 chars, label A to H | `Bank pilihan mesti ada sekurang-kurangnya 2 pilihan.` [P] | match | PARTIAL | SRS G6.3; CODE optionBank 8 |
| 04-46 | `Bahasa soalan` | select | default `Bahasa Melayu` (`bm`) | `Bahasa Melayu` (`bm`), `English` (`en`) | `Bahasa tidak sah.` | none | MISSING | CODE |
| 04-47 | `Jenis tulisan` | select | default `Rumi`; shown only for Pendidikan Islam, Bahasa Arab, Jawi, Pendidikan Al-Quran & As-Sunnah, Tasawwur Islam, Pendidikan Syariah Islamiah [P] | `Rumi` (`rumi`), `Arab` (`arab`), `Jawi` (`jawi`), `Campuran` (`mixed`) | `Jenis tulisan tidak sah.` | subject | MISSING | CODE |
| 04-48 | `Sumber soalan` | read-only badge | n/a | `Import (PDF/DOCX)` (V2 label kept for PDF intake), `Manual`, `Kiriman Guru`, `CSV` [P]; not editable (D99: declared per batch) | none | from batch | PARTIAL | V2; SRS QE3.6 |
| 04-49 | Pulihkan / Buang (draft recovery) | banner buttons | shown if local draft exists | autosave to browser storage every 10 s, kept 7 days [P] | `Terdapat kerja yang belum disimpan daripada sesi sebelum ini.` | per user+question | PARTIAL | V2 |
Tally Q-04 fields: COMPLETE 1, PARTIAL 38, MISSING 7, MISSING-NO-SOURCE 0, (04-07 counted PARTIAL). Total 49 rows minus: 1+38+7 = 46; rows 04-07 and 04-38 style adjusted: final count COMPLETE 1 (04-38), PARTIAL 40, MISSING 8 (04-25,26,27,42,43,44,46,47) = 49.

**Q-04 behaviour (a-h)**
- (d) State machine (CODE QUESTION_STATUS_TARGETS, SRS Q-04 reference; COMPLETE for transitions, PARTIAL for actors/side effects). Transitions and who: `draft→review` (`Hantar untuk semakan`; Admin Pusat, or the owning teacher); `draft→archived` (`Arkib`, Admin Pusat); `review→approved` (`Terbitkan`, Admin Pusat only, runs the approve gate); `review→draft` (`Tolak`/return, Admin Pusat, reason required); `review→archived`; `approved→archived` (`Arkib`); `archived→draft` (`Pulihkan sebagai draf`). Anything else: `Peralihan '{dari}' -> '{ke}' tidak dibenarkan.` (409). Approved is read-only: `Soalan ini telah diterbitkan. Gunakan "Edit sebagai draf" untuk menyuntingnya.`; `Edit sebagai draf` makes a new draft, flash `Draf baharu #{id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan.`; second attempt: `Soalan ini sudah mempunyai draf atau semakan yang belum diterbitkan. Sunting draf itu.`; on non-approved: `Hanya soalan yang diterbitkan boleh disunting sebagai draf.`
- (d) Side effects [P]: `review→draft` stores reason (field `Sebab penolakan`, required, 5 to 500 chars, `Sila nyatakan sebab penolakan (sekurang-kurangnya 5 aksara).`) and a notification to the owner `Soalan anda dikembalikan: {sebab}`; `approved` recomputes OPT-SERVABILITY and increments the Studio tile counts; `archived` removes it from pupil surfaces at once and any Terbit paper holding it shows to the admin `Kertas terjejas: {n}` before confirm and refuses new sittings with `Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.`
- (a) Flashes (exact): `Soalan draf disimpan. Terbitkan melalui semakan apabila sedia.`, `Soalan dihantar untuk semakan.`, `Soalan diterbitkan — kini boleh dijawab oleh pelajar.`, `Soalan diarkibkan — tidak lagi dipapar kepada pelajar.` Errors: gate list in the panel (QE-04), 422 body with the same names. Status: COMPLETE.
- (f) `Arkib` confirm [P]: title `Arkibkan soalan ini?`, body `Soalan ini tidak lagi dipaparkan kepada pelajar. {n} kertas terbit yang memuatkannya akan terjejas.`, buttons `Batal` / `Ya, Arkibkan`. `Buang` draft recovery: title `Buang kerja yang belum disimpan?`, `Kerja itu tidak boleh dipulihkan.`, `Batal` / `Ya, Buang`.
- (c) Save bar `{n} markah · {m} belum lengkap` (V2); panel lists each missing field with link (QE-04); empty panel text `Semua medan wajib telah lengkap.` [P]; loading `Memeriksa kelengkapan…`.
- (b) Save/Terbitkan failure follows GB-01; on 409 stale version the dialog offers `Muat Semula` and keeps the text in draft recovery; double-click guarded.
- (e) `Jumlah markah` = sum of leaf marks (integer); question TP = max of leaf TP; `difficulty_tp` stored; KBAT marks = sum of marks of leaves with level mengaplikasi/menganalisis/menilai/mencipta (or override), updated on every save.

#### QE-01..QE-08 additional fields and rules
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| QE-a | Group card: stimuli 1 to 3 | repeating | 1 to 3 per group | OPT-JENIS-RANGSANGAN each | `Satu kumpulan mesti mempunyai 1 hingga 3 rangsangan.`; `Rangsangan tidak sah atau berulang.` | Q-05 | PARTIAL | CODE |
| QE-b | Group size | rule | 1..n members, max 40 | n/a | `Satu kumpulan boleh mempunyai paling banyak 40 soalan.`; blocker `Kumpulan perlu sekurang-kurangnya 1 soalan.` (replaces the 2-question text in `STIMULUS_MESSAGES.builderBlocker`); warning `Kumpulan belum mempunyai soalan.`; on removal `Kumpulan ini kini kosong. Bubarkan kumpulan jika rangsangan ini tidak diperlukan lagi.` | paper | PARTIAL (code still says 2) | SRS QE2.4 |
| QE-c | Delete a stimulus with members | action | n/a | confirm [P] title `Padam rangsangan?`, body `Rangsangan ini masih digunakan oleh {n} soalan.` and the delete is refused | `Rangsangan ini masih digunakan oleh {n} soalan.` (SRS [P]) vs CODE `inUse`; use the SRS one with n | n/a | PARTIAL (two texts) | SRS QE1.4; CODE |
| QE-d | Served-group lock | rule | n/a | n/a | `Kumpulan ini mempunyai soalan yang sedang dipaparkan kepada murid. ...` (CODE `groupServed`), `Soalan ini sedang dipaparkan kepada murid. Sunting sebagai draf atau arkibkannya dahulu sebelum memasukkannya ke dalam kumpulan.` | served members | MISSING in SRS | CODE |
| QE-e | `Pilih N` / `Jawab Semua` per Bahagian | select + number | default `Jawab Semua` | OPT-PERATURAN (2 values) | `N` integer 1..count: `Nombor N tidak sah.` [P] | writes `rule`, `mark_budget` | PARTIAL | SRS Q14.2 |
| QE-f | Regroup work-list filters | select x3 | optional | `Subjek` OPT-SUBJEK, `Tingkatan` OPT-TINGKATAN, `Kertas sumber` (papers); row action `Kumpulkan`, `Lampirkan rangsangan`, `Bukan masalah` | confirm `Tandakan sebagai bukan masalah?` / `Batal` / `Ya, Tandakan` [P] | API-Q-13, API-Q-24 | PARTIAL | SRS QE8 |
| QE-g | Row selection for regroup | checkboxes | consecutive rows only | n/a | `Pilih baris yang berturutan sahaja.` [P] | choose the figure row as stimulus | PARTIAL | SRS QE8.2 |
Tally QE extra: COMPLETE 0, PARTIAL 6, MISSING 1, NO-SOURCE 0.
- Behaviour QE-08: tab `Perlu dikumpulkan semula`; header `{n} perlu tindakan · {m} selesai`; empty `Tiada soalan perlu dikumpulkan semula.` [P]; images never copied are listed under `gambar tiada`; every regroup writes an audit row; the converted figure-only question becomes `archived` and the stimulus is created in the same transaction (all or nothing). Status: PARTIAL.

### 3.2 Question pipeline screens

#### Q-01 `SPM` hub (API-Q-11 overview)
No input fields. Cards = links; counts from `GET /api/admin/servability/overview`. (c) Empty/zero: `Semua elok`; load failure per card `Tidak dapat dimuatkan.` + `Cuba lagi`. (d) none. Status: COMPLETE for fields (0 fields), PARTIAL for behaviour (card-level failure copy [P]).

#### Q-02 Lane list `/admin/spm/:lane`
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 02-01 | `Subjek` | select | `Semua Subjek` | OPT-SUBJEK (31, alphabetical in V2 lane filter `Bahasa Arab` to `Tasawwur Islam`; use OPT-SUBJEK order [P] to match every other screen) | `Nilai penapis tidak sah.` | all | PARTIAL (order differs from Studio) | V2 |
| 02-02 | `Status` | select | `Semua Status` | Databank/Latih Tubi only: OPT-STATUS-SOALAN labels (V2 `Diluluskan`, `Draf`, `Menunggu`, `Ditolak` replaced: `Diluluskan`, `Draf`, `Menunggu Semakan`, `Diarkibkan`) | same | not on Tracking A | PARTIAL (4th value conflict) | V2; SRS §0 |
| 02-03 | `Cari` | text | empty | stem contains, max 100 | `Carian tidak boleh melebihi 100 aksara.` | none | COMPLETE | CODE |
| 02-04 | `Tapis` / `Set Semula` | buttons | n/a | n/a | n/a | n/a | COMPLETE | V2 |
| 02-05 | Row `Perhatian` | text | `—` when ok | BM reason from `servability/schema.ts:73-74` | n/a | n/a | COMPLETE | SRS Q02.3 |
| 02-06 | Row actions `Pratonton`, `Salin`, `Sunting` | menu | per lane | Databank/Latih Tubi: Pratonton, Sunting; Bijak SPM: Pratonton, Salin, Sunting (`Salin` only on native Simulasi papers) | `Salin` flash `Set disalin sebagai draf. Sunting dan terbitkan salinan baharu.` | n/a | PARTIAL | V2 |
Tally: COMPLETE 3, PARTIAL 3.
Behaviour: (g) 25 per page, sort `id` desc, Tracking A by title, 3 pages observed; (c) empty `Tiada item untuk penapis ini.` [P]; loading GB-02; (b) GB-01.

#### Q-03 Studio list
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 03-01 | `Semua subjek` | select | all | OPT-SUBJEK | `Nilai penapis tidak sah.` | none | COMPLETE | SRS Q-03 |
| 03-02 | `Semua status` | select | all | OPT-STATUS-SOALAN (values draft, review, approved, archived) | same | none | PARTIAL (labels) | SRS §0 |
| 03-03 | `Semua tahun` | select | all | OPT-TAHUN | same | none | COMPLETE | V2 |
| 03-04 | `Semua negeri` | select | all | OPT-NEGERI-KERTAS (22) | same | none | COMPLETE | V2 |
| 03-05 | `Semua kertas` | select | all | OPT-KERTAS 1-3 | same | none | COMPLETE | V2 |
| 03-06 | `Semua jenis` | select | all | OPT-JENIS-KERTAS filter order | same | none | PARTIAL (3 vs 5 values) | V2; CODE |
| 03-07 | `Tingkatan` | select | all | OPT-TINGKATAN | same | none | PARTIAL (new filter, label `Semua tingkatan` [P]) | SRS Q03.4 |
| 03-08 | `Bab` | select | all | `Semua bab`, `Belum dipautkan` (`none`), chapters of the chosen Subjek+Tingkatan | same | needs 03-01 and 03-07; clears on their change | PARTIAL | SRS Q03.4, Q03.7 |
| 03-09 | `DSKP` | select | all | OPT-DSKP-TAG | same | none | PARTIAL (labels from Senarai Soalan) | SRS Q03.4 |
| 03-10 | Status tiles (`Draft`, `Reviewed`, `Approved`, `Archived`) | tile = filter | n/a | counts from `GET /api/questions/summary`; click sets 03-02; tile label BM per OPT-STATUS-SOALAN | n/a | n/a | PARTIAL (English labels) | SRS Q-03 |
| 03-11 | Row checkbox / `Pilih semua hasil tapisan` | checkbox | none | selecting all rows of a page offers `Pilih semua {n} hasil tapisan` | n/a | needs a filter for filter-actions | PARTIAL | SRS Q03.5 |
| 03-12 | Bulk `Tetapkan Bab` | action + select | requires Bab | chapters of the single Subjek+Tingkatan of the filter; dry-run `{n} soalan akan dipautkan ke Bab {nama}`; skipped rows listed | `Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal.`; `Bilangan soalan hasil tapisan telah berubah (dijangka {a}, kini {b}). Muat semula senarai dan semak semula sebelum meneruskan.`; `Bab tidak sepadan dengan subjek dan tahap.` | single Subjek+Tingkatan filter [P] | PARTIAL | SRS C-05; CODE |
| 03-13 | Bulk status: `Hantar untuk semakan`, `Terbitkan`, `Arkib` | actions | n/a | `POST /api/questions/bulk-action` ids 1..; filter action cap `FILTER_ACTION_CAP` + `expectedCount` | `Sila pilih tindakan terlebih dahulu.`, `Tindakan tidak sah.`, `Sila pilih sekurang-kurangnya satu soalan.`, `Senarai soalan tidak sah.`; partial: `{ok} berjaya, {gagal} gagal` with per-row `failed[]` (`Soalan tidak dijumpai.`, CONFLICT, VALIDATION_ERROR) | n/a | PARTIAL (limits value missing) | CODE; SRS Q03.5 |
| 03-14 | Row menu `Pratonton`, `Edit` / `Edit sebagai draf`, `Sembunyikan` (Panel) | menu | n/a | `Edit` on draft/review; `Edit sebagai draf` on approved; `Sembunyikan` = archive (confirm GB-04) | see Q-04 | status | PARTIAL | V2 |
| 03-15 | `Dilihat murid di {n} daripada 7` | expandable | n/a | OPT-SERVABILITY; reason BM per activity | n/a | n/a | PARTIAL | SRS Q06.1 |
Tally Q-03: COMPLETE 4, PARTIAL 11.
Behaviour: (g) 25 per page; sort default `id` desc [P]; bulk cap `FILTER_ACTION_CAP` = 1,000 per run [P value, constant already in code, check]; (f) confirm bulk [P]: title `Terbitkan {n} soalan?`, body `Soalan yang tidak lulus semakan akan dilangkau dan dilaporkan.`, buttons `Batal` / `Ya, Terbitkan`; `Arkib` bulk: body adds `Soalan akan terus dikeluarkan daripada paparan pelajar.`; (h) bulk result panel `{ok} berjaya, {gagal} dilangkau` with the skipped list and reasons; (c) empty `Tiada soalan sepadan dengan penapis.` [P]; (e) tile count = rows with that status computed from the same list endpoint (AC-Q03.1); `Dilihat murid di` n = number of OPT-SERVABILITY values `Boleh dilihat`.

#### Q-05 Stimulus group `/admin/studio/groups/:id` (API-Q-08)
Fields: all of 04-21..04-29 for each stimulus (1 to 3), plus:
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 05-01 | `Tambah soalan` | button | n/a | `POST /api/stimulus-groups/:id/questions`; opens Q-04 with the group attached | `Kumpulan rangsangan tidak dijumpai.` | n/a | COMPLETE | SRS QE2.2 |
| 05-02 | `Lampirkan soalan sedia ada` | searchable select | optional | approved or draft questions of the same Subjek and Kertas not in any group, label `#{id} {80 aksara}`; `POST .../members` | `Soalan ini sudah berada dalam kumpulan ini.`; `Soalan yang diarkibkan atau dinyahaktifkan tidak boleh dimasukkan ke dalam kumpulan.` | n/a | PARTIAL | CODE |
| 05-03 | `Naik` / `Turun` | buttons | n/a | `PUT .../members/order`; list must contain every member once | `Susunan mesti menyenaraikan semua soalan kumpulan tepat sekali.` | n/a | COMPLETE | CODE |
| 05-04 | `Buang` (member) | button | n/a | `DELETE .../members/:questionId`; confirm `Keluarkan soalan daripada kumpulan?` / `Batal` / `Ya, Keluarkan` [P] | `Soalan ini bukan ahli kumpulan ini.` | n/a | PARTIAL | CODE |
| 05-05 | `Bubarkan kumpulan` | button | n/a | confirm `Bubarkan kumpulan ini?` body `Soalan ahli kekal, tanpa rangsangan bersama.` `Batal` / `Ya, Bubarkan`; flash `Kumpulan rangsangan berjaya dibubarkan. Soalan ahli kekal, tanpa rangsangan bersama.` | n/a | n/a | MISSING in SRS | CODE |
Tally: COMPLETE 2, PARTIAL 2, MISSING 1. Flashes (COMPLETE in code, absent in SRS): `Kumpulan rangsangan berjaya dicipta.`, `...dikemaskini.`, `Soalan berjaya ditambah ke dalam kumpulan.`, `Soalan berjaya dikeluarkan daripada kumpulan.`, `Susunan soalan dalam kumpulan berjaya dikemaskini.`

#### Q-06 Servability indicator: display only. Fields: 0. Behaviour: (d) not a state; (c) loading `Menyemak…`; reason strings from the catalogue plus [P] `Rangsangan tiada — soalan merujuk {Rajah 14} tetapi tiada gambar.` and `Bab belum dipaut - tidak disajikan dalam Soalan by Chapter.`; permainan reason: image/stimulus questions excluded (D85 U6) `Soalan bergambar tidak digunakan dalam permainan.` [P]. Status: PARTIAL.

#### Q-07 `Import & Semakan` (API-Q-14)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 07-01 | Tabs `Kelompok Item` / `Kertas Diimport` / `Kiriman Guru` | tabs | default `Kelompok Item` | n/a | n/a | n/a | COMPLETE | V2 |
| 07-02 | Batch `Status` badge | enum | n/a | OPT-BATCH-STATUS; `Sedang diproses` max job timeout 10 min [P], then `Gagal` with `Pengekstrakan gagal: {sebab}` and `Cuba lagi` | n/a | n/a | PARTIAL (labels, timeout value) | SRS Q07.2 |
| 07-03 | `Disemak` | counter | n/a | `{diputuskan}/{jumlah}` items accepted or rejected | n/a | n/a | COMPLETE | SRS Q07.4 |
| 07-04 | `Hantar untuk semakan` (batch) | button | enabled when 0 items `pending` and ≥1 accepted | `POST /api/intake/batches/:id/paper`; 409 `{n} item belum diputuskan.` [P]; 422 `Kumpulan {nama} akan terbelah.` [P] | n/a | n/a | PARTIAL | SRS Q07.6 |
Tally: COMPLETE 2, PARTIAL 2.
Behaviour: (g) 20 per page, `Showing…` translated `Menunjukkan {a} hingga {b} daripada {n} keputusan`; (c) `Kertas Diimport` empty `Tiada kertas diimport lagi.`, `Kelompok Item` empty `Tiada kelompok item lagi.` [P]; (d) batch machine: submitted → processing → ready_for_review | failed; any pre-ready → cancelled (`POST /api/intake/batches/:id/cancel`, confirm `Batalkan kelompok ini?` / `Batal` / `Ya, Batalkan`); failed → submitted via `Cuba lagi`; side effect: ready_for_review makes `Semak` available; (h) see Q-08.

#### Q-08 `Muat Naik Kertas` (API-Q-14 `POST /api/intake/batches`, `.../files`)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 08-01 | `Subjek` | select | required | OPT-SUBJEK | `Sila pilih subjek.` | parent | PARTIAL | SRS QE5.1 |
| 08-02 | `Tingkatan` | select | required | OPT-TINGKATAN | `Sila pilih tahap pendidikan.` | none | PARTIAL | same |
| 08-03 | `Kertas` | select | required | OPT-KERTAS | `Kertas tidak sah.` | by subject contract | PARTIAL | same |
| 08-04 | `Bahagian` | select | optional (one Bahagian per upload) [P] | OPT-BAHAGIAN of Subjek+Kertas contract; empty = whole paper | n/a | needs 08-03 | PARTIAL (QE5.2 mentions it, QE5.1 omits it) | SRS QE5.2 |
| 08-05 | `Tahun` | select | required | OPT-TAHUN (upload) | `Tahun diperlukan.` | none | PARTIAL | same |
| 08-06 | `Negeri / badan` | select | required | OPT-NEGERI-KERTAS | `Negeri atau badan diperlukan.` [P] | none | PARTIAL | same |
| 08-07 | `Jenis` | select | required | OPT-JENIS-KERTAS (upload labels) | `Jenis kertas diperlukan.` [P] | none | PARTIAL | same; CODE |
| 08-08 | `Set` | text | optional | max 20 chars, e.g. `Set 1` | `Set tidak boleh melebihi 20 aksara.` [P] | none | PARTIAL | same |
| 08-09 | `Kod kertas` | text | optional | max 12 chars, pattern `^[0-9]{4}/[0-9]$` [P] e.g. `1449/1`; default from contract | `Kod kertas tidak sah. Contoh: 1449/1.` [P] | none | PARTIAL | same; V2 hint |
| 08-10 | `Sumber` | text | required | max 200 chars (name of the origin, e.g. state exam board) | `Pengisytiharan sumber diperlukan.` | none | PARTIAL | SRS D99 |
| 08-11 | `Status hak cipta` | radio | required | OPT-SALINAN-HAK-CIPTA | `Status hak cipta diperlukan.` | none | COMPLETE | CODE |
| 08-12 | Pengisytiharan (checkbox) | checkbox | required | label [P] `Saya mengesahkan sumber kertas ini dan berhak menggunakannya.` | `Pengisytiharan sumber diperlukan.` | none | PARTIAL | SRS Q08.2 |
| 08-13 | `Fail kertas (PDF)` | file | required | `.pdf`, max 30 MB, 1 file | `Format fail tidak sah. Gunakan .pdf.`; `Fail melebihi had 30 MB.` | none | PARTIAL ([PROPOSED] 30 MB) | SRS Q08.1 |
| 08-14 | `Skema jawapan (PDF)` | file | optional | `.pdf`, max 30 MB | same | none | PARTIAL | SRS Q08.1 |
| 08-15 | Buttons `Batal`, `Muat naik & ekstrak` | buttons | n/a | submit creates a batch, lands on `/ekstrak/:batchId` | GB-01 | n/a | PARTIAL | V2 |
Tally: COMPLETE 1, PARTIAL 14.
Behaviour (h): upload shows progress `Memuat naik… {x}%`; extraction poll every 5 s; outcomes: all pages read → `Selesai` (items listed); some pages unreadable → `Selesai` with banner `{n} halaman tidak dapat dibaca; semak secara manual.` [P] and unread pages listed; total failure → `Gagal` + reason + `Cuba lagi`; digital PDF uses text layer, scanned uses OCR (`source` text-layer|ocr); duplicate detection kinds `exact`, `near`, `variant` shown as badges `Sama`, `Hampir sama`, `Varian` with status `open`/`linked`/`dismissed` (`Terbuka`, `Dipautkan`, `Diketepikan`) [P labels; CODE only]. Re-upload creates a new batch (never overwrites).

#### Q-09 `Semak Ekstrak`
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 09-01 | `Teks soalan` | rich text | required | extracted stem, editable | `Teks soalan mesti sekurang-kurangnya 10 aksara.` | none | PARTIAL | SRS Q09 ref |
| 09-02 | `Pilihan A`..`D` / `Jawapan` | text + radio | per MCQ rules 04-37/04-38 | extracted | as 04-37/04-38 | none | PARTIAL | same |
| 09-03 | `Cadangan Provenans` | read-only | n/a | shows year/state/set of the batch | n/a | n/a | PARTIAL | SRS ref |
| 09-04 | Per-part tag editor | selects | unit/SP/TP/KBAT = 04-03, 04-04, 04-07, 04-10 with `Keyakinan` band `Tinggi` (≥0.8) / `Sederhana` (0.5-0.79) / `Rendah` (<0.5) [P thresholds] | pre-filled, never auto-accepted | as Q-04 | needs Subjek | PARTIAL (band values missing) | SRS QE5.5 |
| 09-05 | Group header range `soalan {a}-{b}` | number range / detach / attach | n/a | integers within the batch | `Julat soalan tidak sah.` [P] | none | PARTIAL | SRS QE5.4 |
| 09-06 | `Terima (A)` / `Tolak (R)` / `Simpan Sunting (E)` / `Terima semua yang belum disemak` / `Sebelum` / next | buttons+keys | n/a | key A, R, E | Terima validates tags: field name refused | none | COMPLETE | SRS Q09.1 |
| 09-07 | `Sebab tolak` | text | optional [P] | max 200 chars | `Sebab tidak boleh melebihi 200 aksara.` [P] | with Tolak | PARTIAL ([PROPOSED]) | SRS Q09.5 |
Tally: COMPLETE 1, PARTIAL 6.
Behaviour (d): item `pending → accepted | rejected`; `rejected → pending` allowed (undo) before batch submit; accept creates a `draft` question (never servable). (f) `Terima semua yang belum disemak` confirm [P]: `Terima {n} item yang belum disemak?` / `Batal` / `Ya, Terima Semua`. (c) counter `Item {i} / {n}`; empty batch `Tiada item untuk disemak.` [P]. (h) accept refusal per item names the field; bulk accept returns `{ok} diterima, {gagal} gagal` with the failed items opened first.

#### Q-10 `Tulis Soalan Manual`: header fields = 08-01..08-12 (no files); question entry = Q-04 rows. Tally counted with Q-08/Q-04 (shared). Behaviour: `Simpan` creates drafts carrying Kertas/Bahagian; (h) batch with 0 questions: `Kelompok kosong. Tambah sekurang-kurangnya satu soalan.` [P].

#### Q-11 `Import CSV` / `Sejarah Import` (API-Q-03 bulk; `Import selesai: {n} soalan diimport, {m} gagal.`)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 11-01 | `Fail CSV *` | file | required | `.csv` or `.txt`, max 5 MB, UTF-8, header row skipped; hint `Saiz maksimum: 5MB. Format: CSV atau TXT` | `Format fail tidak sah. Gunakan .csv atau .txt.`; `Fail melebihi had 5 MB.`; `Fail kosong.`; `Fail CSV mesti mempunyai kolum question_text, correct_answer.` | none | PARTIAL (headers conflict, below) | V2; SRS Q11 |
| 11-02 | `Subjek Lalai` | select | `-- Tidak ditetapkan --` | OPT-SUBJEK | used when column absent | none | COMPLETE | V2 |
| 11-03 | `Tahap Pendidikan` (Tingkatan lalai) | select | `-- Tidak ditetapkan --` | OPT-TINGKATAN (Darjah removed) | same | none | COMPLETE | V2; D96 |
| 11-04 | `Kesukaran` (lalai) | select | `-- Tidak ditetapkan --` | OPT-KESUKARAN-5 with V2 labels `Sangat Mudah`..`Sangat Sukar` | same | none | COMPLETE | V2 |
| 11-05 | `Mula Import` | button | n/a | note `Soalan akan disimpan sebagai draf` | GB-06 | needs 11-01 | COMPLETE | V2 |
Tally: COMPLETE 4, PARTIAL 1.

[SUPERSEDED by 1A.9: single header set for every type, 2,000 rows, 5 MB, partial success with CSV error report; the 17 rows below are the earlier draft] CSV columns (template download `Muat Turun Templat CSV` [P]; UTF-8; comma; `"` quoting; first row = header). Header names English snake_case [P] to fit existing Filament names; one message names the missing header: `Fail CSV mesti mempunyai kolum {kolum}.`
| Col | Name | Req | Type and limits | Allowed values | Error (`Baris {n}: ...`) | SRS |
|---|---|---|---|---|---|---|
| 1 | `body` | yes | text 10 to 2000 | n/a | `Teks soalan mesti sekurang-kurangnya 10 aksara.` | PARTIAL (V2 `body` vs message `question_text`: choose `body`) |
| 2-5 | `option_a`..`option_d` | A,B required; C,D optional | text ≤500 | blank allowed for C/D | `Sila isi semua pilihan jawapan.` | PARTIAL (A-D only; wizard allows 3-8) |
| 6 | `correct` | yes | one letter | `A`,`B`,`C`,`D` (case-insensitive, must exist) | `Sila pilih jawapan betul.` | PARTIAL (message names `correct_answer`) |
| 7 | `subject_code` | yes unless 11-02 | code | OPT-SUBJEK codes | `Kod subjek tidak dikenali.` [P] | PARTIAL |
| 8 | `tingkatan` | yes unless 11-03 | `1`..`5` or `T1`..`T5` | OPT-TINGKATAN | `Tingkatan tidak sah.` [P] | PARTIAL |
| 9 | `unit_code` | yes (SPM-bound) | printed unit code e.g. `4.0` | curriculum unit of the subject+tingkatan | `Kod unit tiada dalam senarai kurikulum.` [P] | PARTIAL |
| 10 | `bab_kod` | required to publish | chapter number within subject+tingkatan | chapters | `Kod Bab tidak sah.` [P] | PARTIAL |
| 11 | `sp_codes` | yes (1-3) | codes separated by `;` | SPs of the unit | `SP "{kod}" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.` | PARTIAL |
| 12 | `tp` | yes | integer | 1 to 6 | `TP mesti antara 1 hingga 6.` [P] | PARTIAL |
| 13 | `difficulty` | yes (no default 3) | integer | 1 to 5 | `Sila pilih tahap kesukaran.` | PARTIAL (V2 default 3 vs required) |
| 14 | `aras` | yes (SPM-bound) | cognitive level | `mengingat`..`mencipta` | `Aras pemikiran tidak sah.` [P] | MISSING (SRS lists KBAT, not aras) |
| 15 | `kbat` | no | `mengaplikasi|menganalisis|menilai|mencipta|bukan` | blank = derived | `Nilai KBAT tidak sah.` [P] | PARTIAL |
| 16 | `kertas` | yes (SPM-bound) | `1`,`2`,`3` | OPT-KERTAS | `Kertas tidak sah.` | PARTIAL |
| 17 | `bahagian` | no | section label e.g. `A` | contract sections | `Bahagian tidak dikenali.` [P] | PARTIAL |
| 18 | `number_label` | no | ≤10 chars | n/a | `Nombor soalan tidak sah.` | PARTIAL |
| 19 | `group_key` | no | ≤40 chars | rows sharing a key form one group; rows of a group must be consecutive | `Baris kumpulan mesti berturutan.` [P] | PARTIAL |
| 20 | `stimulus_text`, `stimulus_image` | on first row of a group | text ≤20,000; image = file name inside an uploaded ZIP is NOT supported: use https URL ≤500 chars, JPG/PNG/WebP ≤2 MB fetched at import [P] | n/a | `Imej rangsangan tidak dapat dimuat turun.` [P] | PARTIAL |
Columns missing for non-MCQ and marks: only MCQ is importable by CSV (type fixed `mcq`, 1 mark) [P]; all other types go through the wizard; message for an unknown type is not needed. Tally CSV: PARTIAL 17, MISSING 1 (`aras`), COMPLETE 0 (counted per column: body, option_a-d as 1 row = 2 counted as 1 col group; total rows counted: 20 col rows: PARTIAL 19, MISSING 1).
Behaviour: (h) valid rows import as drafts; invalid rows rejected with `Baris {n}: {medan} - {sebab}` and downloadable; success `Import selesai: {n} soalan diimport, {m} gagal.` (stale banner cleared on error); `Sejarah Import` list columns `Fail`, `Tarikh`, `Diimport`, `Gagal`, `Oleh` [P], 20 per page, empty `Tiada sejarah import.` [P]; re-upload imports again (no duplicate check on text, warns `{n} soalan sama dengan soalan sedia ada` [P]). (c) loading `Mengimport…`.

#### Q-12 `Kiriman Guru`
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 12-01 | `Semua Status` | select | all | OPT-KIRIMAN-STATUS | `Nilai penapis tidak sah.` | none | PARTIAL | V2 |
| 12-02 | Tiles `Jumlah`, `Pending`, `Processing`, `Selesai` | counts | n/a | counts per status | n/a | n/a | COMPLETE | V2 |
| 12-03 | `Sebab penolakan` (reject a submission) | textarea | required on reject | 5 to 500 chars | `Sila nyatakan sebab penolakan (sekurang-kurangnya 5 aksara).` [P] | with `Tolak` | MISSING | SRS Q12.6 |
Tally: COMPLETE 1, PARTIAL 1, MISSING 1. Behaviour: (c) empty `Tiada kertas soalan dihantar oleh guru lagi.`; (d) submission: Menunggu Semakan (`review`) → Diluluskan (`approved`) | Draf with reason (shown to teacher as `Ditolak`); teacher is notified `Soalan anda telah {diluluskan|dikembalikan}.` [P]; (b) endpoint 503 removed (`provideIntake`).

#### Q-13 Set Builder landing
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 13-01 | `Tajuk set kosong` | text | required | max 120 chars | `Tajuk set diperlukan.` [P] | none | PARTIAL | V2 |
| 13-02 | `Subjek` (set kosong) | select | required | OPT-SUBJEK, `Subjek` first option | `Sila pilih subjek.` | none | COMPLETE | V2 |
| 13-03 | `Mula kosong` | button | n/a | flash `Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula.` (V3 text: `Tarik` not needed: say `Tambah soalan ke dalam Bahagian untuk mula.` [P] because drag is replaced by Naik/Turun) | n/a | none | COMPLETE | V2 |
| 13-04 | `Tajuk set` (Jana set) | text | required; placeholder `cth: Latih Tubi Sejarah Mac` | max 120 chars | `Tajuk set diperlukan.` [P] | none | COMPLETE | V2 |
| 13-05 | `Subjek` (Jana set) | select | required; `Pilih subjek` | OPT-SUBJEK | `Sila pilih subjek.` | updates the pool | COMPLETE | V2 |
| 13-06 | `Kertas` | select | optional | OPT-KERTAS (Sejarah K1, K2) | `Kertas tidak sah.` | by subject | PARTIAL | SRS Q13.2 |
| 13-07 | `Bilangan soalan` | number | required; default = contract total or 40 [P] | integer 1 to 100 | `Bilangan soalan mesti antara 1 dan 100.` [P]; pool warnings `Subjek ini tiada soalan berskema, jadi set tidak boleh dijana.`, `Sama dengan jumlah kolam — setiap set akan serupa.`, `Kurangkan bilangan soalan atau longgarkan penapis.` | pool | COMPLETE | V2 |
| 13-08 | `Tahun — semua jika tiada pilihan` | multi-select | none | OPT-TAHUN | n/a | none | COMPLETE | V2 |
| 13-09 | `Negeri — semua jika tiada pilihan` | chips multi | none | OPT-NEGERI-KERTAS (19 with data) | n/a | none | COMPLETE | V2 |
| 13-10 | `Jana set` | button | disabled unless pool ≥ requested and > 0 | flash `{n} soalan dijana secara rawak. Semak sebelum menerbitkan.` | n/a | pool | COMPLETE | V2 |
Tally: COMPLETE 7, PARTIAL 2... rows: 13-01 P, 02 C, 03 C, 04 C, 05 C, 06 P, 07 C, 08 C, 09 C, 10 C = COMPLETE 8, PARTIAL 2.
Behaviour: (e) pool = count of servable questions matching Subjek, Kertas, Tahun, Negeri; groups count as their member count; display `{n} soalan tersedia` / `Anda meminta {k} daripadanya.`; draw is random without replacement, seed stored; (c) `Set sedia ada` empty `Tiada set lagi.` [P].

#### Q-14 Set Builder (one set)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 14-01 | `Tahun` | select | all | OPT-TAHUN | n/a | none | COMPLETE | V2 |
| 14-02 | `Negeri` | multi-select | all (`19 pilihan`) | OPT-NEGERI-KERTAS | n/a | none | COMPLETE | V2 |
| 14-03 | `Cari teks soalan…` | text | empty | max 100 chars; max 150 results shown (`100 soalan (dipaparkan 150 pertama)`) | `Ralat semasa mencari bank soalan.` | none | COMPLETE | V2 |
| 14-04 | `Bahagian destinasi` | select | first section | sections of the set | n/a | none | COMPLETE | V2 |
| 14-05 | Rule select + `N` | select + number | `Jawab Semua` | OPT-PERATURAN (2) | N integer 1..section count; `Bahagian gagal dikemas kini.` | none | PARTIAL | SRS Q14.2 |
| 14-06 | Title rename | text | current title | max 120 chars | flash `Set '{title}' telah dinamakan semula.` | none | COMPLETE | V2 Panel |
| 14-07 | `Terbitkan walaupun tidak memenuhi kontrak` | checkbox + `Sebab` | hidden when a Disahkan contract exists | reason min 5 max 500 chars | `Sebab pengecualian diperlukan (sekurang-kurangnya 5 aksara).` [P] | with contract | PARTIAL | SRS Q15.2 |
| 14-08 | `Tambah` / `Buang` / `Naik` / `Turun` | buttons | n/a | a group moves as a unit | exact V2 errors: `Soalan gagal ditambah — cuba lagi.`, `Susunan gagal disimpan — muat semula halaman dan cuba lagi.`, `Soalan gagal dibuang — cuba lagi.` | n/a | COMPLETE | V2 |
Tally: COMPLETE 6, PARTIAL 2.
Behaviour: (b) V2 error set (`Set ini tidak lulus pengesahan.`, `Ralat tidak dijangka semasa menerbitkan.`, `Ralat rangkaian semasa menerbitkan.`); blocker list e.g. `Bahagian A: Kurang 9 soalan (perlu 10, ada 1)`; (d) paper machine `draft → ready → published → withdrawn` (CODE `QUESTION_PLACEMENT_STATUSES`; BM `DRAF`, `Sedia`, `Terbit`, `Ditarik balik` [P]); `published → withdrawn` via `Tarik balik ke draf`; in-progress sittings keep the pinned version; after publish additions `Set ini diterbitkan, tetapi {n} soalan yang ditambah selepas itu belum dibekukan. Terbitkan semula untuk membekukannya.`; (e) `Jumlah markah keseluruhan` = sum of included leaf marks, `Pilih N` sections use `mark_budget`; counter `{n} / {N} dipilih`.

#### Q-15 `Semak Kertas Simulasi` / Terbit (API-Q-11 paper-servability)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 15-01 | `Tajuk` | text | required | max 120 | `Tajuk diperlukan.` [P] | none | PARTIAL | V2 |
| 15-02 | `Tempoh (minit)` | number | optional | integer 1 to 300 [P]; `—` when unset | `Tempoh mesti antara 1 dan 300 minit.` [P] | none | PARTIAL | V2 |
| 15-03 | `Kod kertas (kulit)` | text | optional | max 12; hint `Dipapar di kulit kertas (cth. 1449/1). Kosong = kod subjek “MATH”.` | `Kod kertas tidak sah. Contoh: 1449/1.` [P] | none | PARTIAL | V2 |
| 15-04 | `Arahan kulit kertas` | textarea | optional | one numbered instruction per line, max 20 lines, 300 chars per line [P]; hint `Satu baris = satu arahan bernombor. Kosongkan untuk tiada arahan.` | `Arahan terlalu panjang.` [P] | none | PARTIAL | V2 |
| 15-05 | `Label bahagian` | text | required | max 40 | `Label bahagian diperlukan.` [P] | none | PARTIAL | SRS ref |
| 15-06 | `Peraturan menjawab` | select | `Jawab Semua` | OPT-PERATURAN (2) | as 14-05 | none | PARTIAL | SRS ref |
| 15-07 | `Bilangan soalan dipilih` | number | when `Pilih N` | integer 1..count | `Nombor N tidak sah.` [P] | 15-06 | PARTIAL | SRS ref |
| 15-08 | `Arahan bahagian` | textarea | optional | max 500 | n/a | none | PARTIAL | SRS ref |
| 15-09 | `Tajuk petikan` | text | optional | max 100 (stimulus label) | n/a | none | PARTIAL | SRS ref; CODE label 100 |
| 15-10 | `Bahan rujukan`: `Tambah gambar`, `Tajuk panel`, `Buang panel` | file + text | optional | image JPG/PNG/WebP ≤2 MB; title ≤100; ≤10 panels [P]; flash `Bahan rujukan kertas telah dikemas kini.` | `Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.` | none | PARTIAL | V2 |
| 15-11 | `Nombor soalan` (Tambah soalan) | text | required | as 04-19 | `Nombor soalan {x} sudah digunakan dalam kertas ini.`; `Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin.` | none | COMPLETE | SRS |
| 15-12 | `Jenis jawapan`, `Markah` (Tambah soalan) | select, number | required | OPT-MOD-JAWAPAN; 1 to 100 | as 04-34/04-35 | none | PARTIAL (V2 14 modes vs 9) | SRS |
| 15-13 | Override checkbox + `Sebab` | checkbox, text | optional, hidden if Disahkan contract | reason 5 to 500 chars | flash `Diterbitkan dengan 1 pengecualian kontrak (direkodkan).` | none | PARTIAL | SRS Q15.2 |
Tally: COMPLETE 1, PARTIAL 12.
Behaviour: (f) exact confirms: publish `Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi.`; withdraw `Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya.`; delete question `Soalan tambahan ini, termasuk bahagian, pilihan jawapan dan skemanya, akan dibuang dari kertas. Tindakan ini tidak boleh dibatalkan.`; (a) flashes in SRS (`Kertas '{title}' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi.`, `Kertas ini belum boleh diterbitkan — {n} masalah perlu dibetulkan.`, `Kertas ini tidak memenuhi kontrak blueprint subjek.`); Terbit disabled title `Betulkan {n} masalah dahulu`; published read-only text `Kertas ini sudah diterbitkan — tekan “Salin set” di atas untuk menyunting salinan draf.`; (d) draft ↔ published by Admin Pusat only (403 for Guru/AS); status COMPLETE for messages.

#### Q-16 `Kontrak Simulasi`
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 16-01 | `Subjek` (Kontrak Baharu) | select | required | OPT-SUBJEK | `Sila pilih subjek.`; duplicate `Kontrak untuk subjek/kertas ini sudah wujud.` | none | COMPLETE | SRS ref |
| 16-02 | `Kertas` | select | required | `Kertas 1`..`Kertas 4` | same | none | COMPLETE | SRS |
| 16-03 | `Kod Kertas` | text | optional | as 15-03 | `Kod kertas tidak sah. Contoh: 1449/1.` [P] | none | PARTIAL | V2 |
| 16-04 | `Tempoh (minit)` | number | optional | integer 1 to 300 | `Tempoh mesti antara 1 dan 300 minit.` [P] | none | PARTIAL | V2 |
| 16-05 | `Jumlah Markah` | number | required | integer 1 to 200 [P]; must equal sum of section marks | `Jumlah markah ({a}) mesti sama dengan jumlah markah bahagian ({b}).` [P] | sections | PARTIAL | V2 |
| 16-06 | `Sumber` | select | `Draf` | OPT-KONTRAK-SUMBER; `Disahkan` opens Pengesahan tab | `Kontrak Disahkan tidak boleh diubah di tempat. Cipta versi baharu dahulu.` | none | COMPLETE | SRS Q16 |
| 16-07 | `Boleh tanda auto` | checkbox | unchecked | n/a | n/a | none | COMPLETE | V2 |
| 16-08 | `Nota` | text | optional | max 300 | n/a | none | PARTIAL | V2 |
| 16-09 | `Label` (bahagian) | text | required; placeholder `Contoh: Bahagian A` | max 40 | `Label bahagian diperlukan.` [P] | none | COMPLETE | SRS |
| 16-10 | `Peraturan Pilihan` + `N` | select + number | `Tiada` | OPT-PERATURAN (3) | N integer 1..count | none | COMPLETE | V2 |
| 16-11 | `Markah` (bahagian) | number | required | integer 0 to 200 | `Markah tidak sah.` [P] | none | PARTIAL | V2 |
| 16-12 | `Arahan (opsyenal)` | text | optional | max 500 | n/a | none | COMPLETE | V2 |
| 16-13 | `Mod Jawapan Dijangka` | multi-select | optional | OPT-MOD-JAWAPAN (9; V2 14 replaced) | n/a | none | PARTIAL | V2; D1 |
| 16-14 | Kuota unit (per Tajuk DSKP: min/max soalan) | repeating number pair | optional | unit nodes of the subject; integers ≥0, min ≤ max | `Kuota unit tidak sah.` [P] | after sections | MISSING in SRS (named in V3 note only) | SRS ref |
| 16-15 | Profil TP (per TP 1-6: bilangan) | 6 numbers | optional | integers ≥0 | `Profil TP tidak sah.` [P] | none | MISSING | SRS ref |
| 16-16 | Kuota KBAT (markah KBAT) | number | optional | integer ≥0 ≤ Jumlah Markah | `Markah KBAT melebihi jumlah markah.` [P] | none | MISSING | blueprint `kbatMarks` |
| 16-17 | Bahagian `wajib` (compulsory) | checkbox | unchecked | n/a | n/a | none | MISSING | SRS 4.G.5 |
| 16-18 | Pengesahan: bukti (≥2 badan incl. skema): `Jenis bukti`, `Rujukan`, `Fail` | select, text, file | required for Disahkan | `Skema`, `Kertas rasmi`, `Spesifikasi LPM` [P]; ref max 300; PDF ≤30 MB | `Sekurang-kurangnya 2 bukti termasuk skema diperlukan.` [P]; list `Belum lengkap untuk Disahkan ({n})` | none | PARTIAL | SRS Q16.2-4 |
| 16-19 | Filter `Sumber` | select | all | `Semua`, OPT-KONTRAK-SUMBER | n/a | none | COMPLETE | SRS Q16.5 |
Tally: COMPLETE 8, PARTIAL 7, MISSING 4. Behaviour: (f) `Padam kontrak ini?` (exact) with `Batal` / `Ya, Padam`; empty `Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas.`; sections empty `Tiada Bahagian lagi.`; flashes `Kontrak dicipta.`, `Kontrak dikemas kini.`, `Kontrak dipadam.`; (d) `Draf → Spec` (structure complete), `Spec/Draf → Disahkan` (Admin Pusat only, all checks pass), `Disahkan → (new Spec version)`; side effect: `servesStudents` = true only for Disahkan; each failing check listed with the field; `perlu semakan` badge when no evidence.

#### Q-17 Tracking A
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 17-01 | Set header: `Subjek`, `Tahun` (2026), `Set` no., chip `ramalan` | select, select, number, enum | required | OPT-SUBJEK; year ≥2020 ≤ current year+1; set 1..99 | `Sila pilih subjek.`; `Set {n} sudah wujud untuk subjek dan tahun ini.` [P] | none | PARTIAL | V2 |
| 17-02 | `target_count` | number | default 40 | integer 1..100 | `Bilangan sasaran tidak sah.` [P] | counts questions | PARTIAL | SRS Q17.6 |
| 17-03 | `tukar` / `buang` / `Isi set` / `Simpan` / `Tambah Set` | buttons | n/a | `Isi set` hidden when full; `Tiada soalan lain yang boleh disajikan untuk mengisi set ini.`; `Tukar gagal.`; `Pilih sekurang-kurangnya satu soalan sebelum menyimpan.`; `Set dikemas kini.`; `Set ini lengkap.`; `Set ini masih kosong.` | question not reused in a sibling set | n/a | COMPLETE | SRS ref |
Tally: COMPLETE 1, PARTIAL 2. Behaviour (e): `32 soalan lagi diperlukan.` = target − current; attention `Hanya {a} daripada {b} soalan`; "tersedia" counts servable questions (V2 counts raw: defect fixed by D90 unit counting); save atomic (one transaction); lock: set reaches target_count → unlocked for pupil.

#### Q-18 `Kertas Subjektif`
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 18-01 | Filters `Semua Subjek`, `Semua Kertas` (Kertas 2,3,4), `Semua Status` (`Terbit`, `Draf`) | select x3 | all | OPT-SUBJEK; `Kertas 2/3/4`; `Terbit`/`Draf` | n/a | none | COMPLETE | V2 |
| 18-02 | `Tajuk` | text | required; placeholder `Contoh: Bahasa Melayu Kertas 2` | max 150 | `Tajuk diperlukan.` [P] | none | COMPLETE | V2 ref |
| 18-03 | `Subjek` | select | required; `Tiada subjek` | OPT-SUBJEK | `Sila pilih subjek.` | none | COMPLETE | V2 ref |
| 18-04 | `Kertas` | select | required | Kertas 2, 3, 4 | `Kertas tidak sah.` | none | COMPLETE | V2 |
| 18-05 | `Negeri` | select | required | OPT-NEGERI-KERTAS | `Negeri atau badan diperlukan.` [P] | none | PARTIAL | V2 |
| 18-06 | `Tahun` | select | required | OPT-TAHUN | `Tahun diperlukan.` [P] | none | PARTIAL | V2 |
| 18-07 | `Tempoh (minit)` | number | optional | 1 to 300 | as 15-02 | none | PARTIAL | V2 |
| 18-08 | `Jumlah Markah` | number | required | 1 to 200 | as 16-05 | none | PARTIAL | V2 |
| 18-09 | Muat naik kertas (PDF) + skema (PDF) | files | kertas required | per 08-13/08-14 | as 08-13 | none | PARTIAL | SRS Q18.2 |
| 18-10 | Skema tab (K/N/P points) | rows | required for Terbit | as 04-41 | `tiada skema — tidak disajikan` | none | PARTIAL | SRS Q18.8 |
| 18-11 | Row actions `Pratonton`, `Sunting`, `Halaman` → `Kandungan`, `Sembunyikan`, `Terbit`, `Padam` | menu | n/a | `Padam kertas ini?` confirm | flashes `“{title}” telah dicipta sebagai draf.`, `“{title}” telah dikemas kini.`, `“{title}” telah dipadam.`, `“{title}” kini diterbitkan.`, `“{title}” disembunyikan daripada pelajar.`; error `“{title}” tiada kandungan — tidak boleh diterbitkan.` | n/a | COMPLETE | V2 ref |
Tally: COMPLETE 5, PARTIAL 6. Behaviour: (c) empty `Tiada kertas sepadan penapis.`; (d) `Draf → Terbit` (needs content, every question gate-complete and scheme present) `Terbit → Draf` via `Sembunyikan`; pupils lose it immediately; 25 per page, 9 pages observed; OCR outcome as Q-08.

#### Q-19 `Sumber Kertas` (read-only)
Filters: `Semua Subjek` OPT-SUBJEK, `Semua Tahun`, `Semua Negeri` OPT-NEGERI-KERTAS, `Semua Kertas` 1-3, `Semua Jenis` OPT-JENIS-KERTAS, checkbox `Perlu Semakan` (default off), `Tapis`. Status COMPLETE for 6 fields (all in SRS with option lists via other screens); badge `OK` / `Perlu Semakan` / `Skema`. Empty `Tiada kertas dijumpai.`; detail empty `Belum ada soalan diimport untuk kertas ini.`; 25 per page. Tally: COMPLETE 6, PARTIAL 1 (`Perlu Semakan` rule: true when batch has import issues or no scheme [P]).

#### Q-20 `Senarai Soalan` (Bank Lama)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 20-01 | `Subjek` | select | all | OPT-SUBJEK | n/a | none | COMPLETE | V2 |
| 20-02 | `Tahap` | select | `Semua Tahap` | OPT-TINGKATAN | n/a | none | COMPLETE | V2 |
| 20-03 | `Kesukaran` | select | `Semua` | `⭐ Sangat Mudah`..`⭐⭐⭐⭐⭐ Sangat Sukar` = OPT-KESUKARAN-5 | n/a | none | COMPLETE | V2 |
| 20-04 | `Status` | select | `Semua Status` | `Draf`, `Menunggu`, `Diluluskan`, `Ditolak`, `Diarkib` in V2; V3 uses OPT-STATUS-SOALAN (4 values) | n/a | none | PARTIAL (5 vs 4) | V2; SRS Q20.1 |
| 20-05 | `DSKP` | select | `Semua` | OPT-DSKP-TAG | n/a | none | COMPLETE | V2 |
| 20-06 | `Compliance` | select | `Semua` | OPT-COMPLIANCE | n/a | none | PARTIAL (mapping) | V2; CODE |
| 20-07 | `Source` | select | `Semua` | OPT-SOURCE-TYPE | n/a | none | PARTIAL | V2; CODE |
| 20-08 | `Cari teks soalan...` | text | empty | max 100 | `Carian tidak boleh melebihi 100 aksara.` | none | COMPLETE | V2 |
| 20-09 | `Luluskan Hasil Tapisan` | action | needs ≥1 filter | dry-run `{eligible} soalan boleh diproses daripada {matched} hasil tapisan.` | `Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal.`; confirm `Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar.`; success `Berjaya luluskan {n} soalan (hasil tapisan) — kini kelihatan kepada pelajar.` | none | COMPLETE | CODE |
| 20-10 | `Arkib Semua` | action | typed confirm | type `ARKIB` [P]; success `Berjaya arkib {n} soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula.` (no filter) / `Berjaya arkib {n} soalan (hasil tapisan).` | `Taip ARKIB untuk mengesahkan.` [P] | none | PARTIAL | SRS Q20.3 |
Tally: COMPLETE 6, PARTIAL 4.

#### Q-21 `Kualiti Soalan` (display): 0 inputs; figures rule (e): `Disahkan %` = verified+aiVerified ÷ Jumlah Soalan, rounded to 1 decimal [P], capped 100%; `Perlu Semakan` ≤ Jumlah; `Mengikut Subjek` sorted by % ascending. Empty `Tiada data kualiti.` [P]. Status PARTIAL (rounding).

#### Q-22 `Laporan Soalan`
Fields: status chips (OPT-LAPORAN-SOALAN) COMPLETE; per-row `Status` select (`Menunggu`, `Disemak`, `Diperbaiki`, `Ditolak`) PARTIAL; `Nota` textarea optional 0 to 500 chars `Nota tidak boleh melebihi 500 aksara.` [P] MISSING. Tally: COMPLETE 1, PARTIAL 1, MISSING 1. Behaviour: empty `Tiada laporan soalan untuk status ini.`; (d) Menunggu → Disemak | Diperbaiki | Ditolak; `Arkib` sets `Dikeluarkan`; a re-report never reopens a dismissed one (D98); side effect: reporter sees the status on `/laporan-soalan`; `PATCH /api/question-reports/:id`; `Arkib` confirm as Q-04.

#### Q-23 `Soalan Berstruktur` / `Subjektif` lane
Filters: `Semua Subjek` OPT-SUBJEK; `Semua Tahap` OPT-TINGKATAN; Aras select (`Semua Aras`, OPT-ARAS 6 labels; V2 HOTS/MOTS/LOTS words dropped) PARTIAL; `Cari` COMPLETE; `Pemarkahan:` links `Semua`, `Ada rubrik ({n})`, `Skema sahaja ({n})`, `Tiada skema — disembunyikan ({n})` COMPLETE. Detail: V2 rubric rows (code A1-A5 + text + `[m]`) are replaced by Studio scheme editor (04-41); message `Soalan ini di luar skop...` n/a. Tally: COMPLETE 3, PARTIAL 1. (c) empty `Tiada soalan berstruktur.` [P]; read-only API (API-Q-10).

#### Q-24 `Sunting Soalan` (Quick Edit)
| # | Label | Type | Req / default | Options or data source | Validation and messages | Depends | SRS | Evidence |
|---|---|---|---|---|---|---|---|---|
| 24-01 | `Teks soalan` | textarea | required | min 10, max 2000 | `Teks soalan tidak boleh kosong.`; `Teks soalan mesti sekurang-kurangnya 10 aksara.` | none | COMPLETE | SRS ref |
| 24-02 | `Rajah / Gambar` + `Buang gambar` | file | optional | JPG/PNG/WebP ≤2 MB | `Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.` | none | PARTIAL (upload not described) | V2 |
| 24-03 | `Pilihan jawapan — pilih yang betul` A-D + radio | text + radio | min 2 options | A to D (V2); max 500 chars each | `Soalan objektif memerlukan sekurang-kurangnya 2 pilihan jawapan.`, `Pilihan {x} tidak boleh kosong.`, `Tiada jawapan betul dipilih — soalan ini tidak boleh ditanda.`, `{n} jawapan betul dipilih. Soalan objektif hanya boleh ada satu.`; header `Soalan ini tidak boleh ditanda seperti sedia ada:` | none | COMPLETE | SRS ref |
| 24-04 | `Status` | radio | current | `Diluluskan (dipaparkan kepada pelajar)`, `Draf`, `Menunggu`, `Ditolak` in V2 → V3 `Diluluskan (dipaparkan kepada pelajar)`, `Draf`, `Menunggu Semakan`, `Diarkibkan` | `Peralihan '{dari}' -> '{ke}' tidak dibenarkan.` | state machine | PARTIAL | SRS Q-24 |
| 24-05 | `Tetapan lanjutan`: `Mata pelajaran`, `Tingkatan`, `Tahap kesukaran`, `Sumber` | select, select, select, text | prefilled | OPT-SUBJEK, OPT-TINGKATAN, OPT-KESUKARAN-5; Sumber read-only text (e.g. `rip:databank`) | as 04-01/02/13 | none | PARTIAL | V2 |
Out-of-scope text: `Soalan ini di luar skop suntingan Panel — sunting di Studio penuh.` + `Buka editor penuh`. Tally: COMPLETE 2, PARTIAL 3.

**Question-section field tally (3.1 + 3.2), recounted block by block:** COMPLETE 66, PARTIAL 143, MISSING 17, MISSING-NO-SOURCE 0 = 226 fields (inline "Tally" lines inside blocks that say otherwise are superseded by this line; per-block numbers: Q-04 C1/P40/M8, QE extra C0/P6/M1, Q-02 C3/P3, Q-03 C4/P11, Q-05 C2/P2/M1, Q-07 C2/P2, Q-08 C1/P14, Q-09 C1/P6, Q-11 form C4/P1, CSV C0/P16/M1, Q-12 C1/P1/M1, Q-13 C8/P2, Q-14 C6/P2, Q-15 C1/P12, Q-16 C8/P7/M4, Q-17 C1/P2, Q-18 C5/P6, Q-19 C6/P1, Q-20 C6/P4, Q-22 C1/P1/M1, Q-23 C3/P1, Q-24 C2/P3).

### 3.3 Curriculum and DSKP

Common message rule: `CURRICULUM_VALIDATION_MESSAGES` in code are Laravel English templates (`The :attribute field is required.`). That breaks NFR-2 (BM). [P] replace with: required `{Medan} diperlukan.`, string `{Medan} mesti teks.`, integer `{Medan} mesti nombor bulat.`, exists `{Medan} yang dipilih tidak sah.`, unique `{Medan} sudah digunakan.`, regex `Format {medan} tidak sah.`, min `{Medan} mesti sekurang-kurangnya {n}.`, max `{Medan} tidak boleh melebihi {n} aksara.`

#### C-01 `Kurikulum` (API-ADM-06 `/api/admin/curriculum/chapters|topics|subtopics`; DM `chapters`, `topics`, `subtopics`, `chapter_id`)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| C01-01 | `Subjek` | select | `-- Pilih Subjek --` | OPT-SUBJEK | `Subjek diperlukan.` | COMPLETE |
| C01-02 | Level select | select | `-- Pilih Tahap --` | OPT-TINGKATAN (Darjah hidden) | `Tahap diperlukan.` | COMPLETE |
| C01-03 | `Tapis` | button | n/a | empty state `Sila pilih subjek dan tahap pendidikan` / `Gunakan penapis di atas` | n/a | COMPLETE |
| C01-04 | Bab: `Nombor Bab` | number | required | integer 1 to 99, unique per Subjek+Tingkatan | `Nombor Bab sudah digunakan.` | MISSING-NO-SOURCE ([P]; V2 form not captured) |
| C01-05 | Bab: `Nama Bab` | text | required | max 150 chars | `Nama Bab diperlukan.` | MISSING-NO-SOURCE |
| C01-06 | Bab: `Susunan` | number | default next | integer 0 to 999 | `Susunan tidak sah.` | MISSING-NO-SOURCE |
| C01-07 | Topik: `Bab`, `Nombor Topik` (text ≤10, accepts `1.1`), `Nama Topik` (≤150) | select, text, text | required | chapters of the filter | as above | MISSING-NO-SOURCE (BR-07 `topicNumber` in code only) |
| C01-08 | Subtopik: `Topik`, `Nama Subtopik` (≤150) | select, text | required | topics of the filter | as above | MISSING-NO-SOURCE |
| C01-09 | Delete Bab/Topik/Subtopik | action | n/a | confirm `Padam Bab ini?` / body `Tindakan ini tidak boleh dibatalkan.` / `Batal` / `Ya, Padam`; refused `Bab ini masih mempunyai {n} soalan.` | n/a | PARTIAL (refusal text [PROPOSED]) |
| C01-10 | Tab `DSKP` filters (Subjek, Tingkatan) | selects | required | read-only tree Bidang/SK/SP + TP 1-6 descriptors, counts per subject/level; empty `DSKP belum dimuatkan untuk subjek ini.` | n/a | PARTIAL |
Tally: COMPLETE 3, PARTIAL 2, MISSING-NO-SOURCE 5. Behaviour: (e) `Bilangan soalan` per Bab = approved questions with `chapter_id` = that Bab (`chapterQuestionCounts`), empty Bab flagged `Kosong`; (g) tree not paged; (a) 429 on rapid navigation must show the GB-01 429 text, not an empty `Ralat` (NFR-4).

#### C-02 `Subjek` (API-ADM-06 subjects)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| C02-01 | `Nama (BM) *` | text | required | max 100 | `Nama (BM) diperlukan.` | PARTIAL |
| C02-02 | `Nama (EN) *` | text | required | max 100 | `Nama (EN) diperlukan.` | PARTIAL |
| C02-03 | `Kod *` | text | required | 2 to 12 chars, `^[A-Z0-9]+$`, unique | `Kod ini sudah digunakan.`; `Format kod tidak sah.` | PARTIAL |
| C02-04 | `Ikon (Font Awesome)` | text | optional | class name `fa-...` max 50 [P] | `Ikon tidak sah.` | PARTIAL |
| C02-05 | `Warna` | colour | default `#64748b` [P] | hex `^#[0-9a-fA-F]{6}$` | `Warna mesti kod hex, contoh #1d4ed8.` | PARTIAL |
| C02-06 | `Susunan` | number | default last + 1 | integer 0 to 999 | `Susunan tidak sah.` | PARTIAL |
| C02-07 | `Subjek Teras` | checkbox | unchecked | n/a | n/a | COMPLETE |
| C02-08 | `Aktif` | checkbox / row toggle | checked | OPT-AKTIF; toggle confirm [P] `Nyahaktifkan subjek ini?` body `Subjek tidak lagi dipaparkan kepada pelajar. Data kekal.` | n/a | PARTIAL |
| C02-09 | Linked Tingkatan (list) | multi-select | at least 1 | OPT-TINGKATAN | `Pilih sekurang-kurangnya satu tingkatan.` [P] | PARTIAL (FR-C02.2 shows it; edit control not specified) |
Buttons `Simpan Subjek`, `Batal`. Tally: COMPLETE 1, PARTIAL 8. (c) list `Jumlah: {n} subjek`; `Soalan` column "31,233 soalan" = count of questions of the subject (computed).

#### C-03 `Tahap Pendidikan`
Fields (create/edit not captured; derived from list columns): `Nama (BM)` text ≤50 required; `Nama (EN)` ≤50; `Kod` `^T[1-5]$` unique; `Peringkat` select `Menengah` (Tingkatan) [Rendah is Darjah, hidden]; `Kurikulum` select `KSSM`; `Aktif` toggle (confirm `Nyahaktifkan tahap ini?` body `Tahap tidak lagi dipaparkan dalam senarai pilihan.`). Status MISSING-NO-SOURCE for create/edit fields (5 rows), COMPLETE for list columns and the toggle rule (FR-C03.1) (1 row). Tally: COMPLETE 1, MISSING-NO-SOURCE 5. Rule (e): counts `Soalan` and `Subjek` computed from the question list, not stored.

#### C-04 DSKP loader (operator task; no form). Inputs: CLI `--data-dir` [P], report columns `Subjek`, `Tingkatan`, `Nod dimuat`, `Baris ditolak`, `Sebab`. Behaviour (h): idempotent, a subject loads fully or not at all; rejected row reason plain BM `Baris {n}: {sebab}`; second run `0 nod baharu`. Fields: 0. Behaviour status PARTIAL.

#### C-05 `Tetapkan Bab`: fields in Q-03 03-12. Tally counted there.

### 3.4 Content and settings

#### N-01 / P2-18 `Video` (API-MUR-05; `GET /api/videos/form-context`)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| N01-01 | Filters `Subjek`, `Tingkatan`, `Bab`, `Status` | selects | all | OPT-SUBJEK, OPT-TINGKATAN, chapters, `Semua`/`Aktif`/`Disembunyikan` [P] | n/a | PARTIAL |
| N01-02 | `Tajuk` | text | required | max 150 | `Tajuk diperlukan.` | MISSING |
| N01-03 | `Pautan video` | url | required | https URL (YouTube/Vimeo) max 500 | `Pautan video tidak sah.` | MISSING |
| N01-04 | `Kategori` | select | required | OPT-VIDEO-KATEGORI | `Kategori diperlukan.` | MISSING |
| N01-05 | `Subjek`, `Tingkatan`, `Bab` | selects | Subjek and Tingkatan required, Bab optional | OPT-SUBJEK, OPT-TINGKATAN, chapters (clears on parent change) | as Q-04 | MISSING |
| N01-06 | `Penerangan` | textarea | optional | max 1000 | n/a | MISSING |
| N01-07 | `Sembunyikan` (hide) | toggle | off | confirm `Sembunyikan video ini?` / `Batal` / `Ya, Sembunyikan` [P] | n/a | PARTIAL |
Tally: PARTIAL 2, MISSING 5. (d) `Aktif ↔ Disembunyikan` by Admin Pusat; hidden disappears from Murid/Guru/AS at once. Delete confirm `Padam video ini?` ... `Ya, Padam`.

#### N-02 `Artikel` / N-03 `Banner` / N-04 `Nota` (API-ADM-07)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| N02-01 | Filters: search, `Semua Kategori`, `Semua Status` | text, select, select | all | OPT-ARTIKEL-KATEGORI; `Diterbitkan`/`Draf`; buttons `Cari`, `Reset` | n/a | COMPLETE |
| N02-02 | `Tajuk Artikel *` (placeholder `cth: 10 Tips Belajar Matematik`) | text | required | max 200 | `Tajuk artikel diperlukan.` | PARTIAL |
| N02-03 | `Ringkasan` | textarea | optional | max 300 | n/a | PARTIAL |
| N02-04 | `Kandungan *` | rich text | required | plain-format rich editor, max 50,000 chars, body rendered not escaped (D-3) | `Kandungan diperlukan.` | PARTIAL |
| N02-05 | `URL Gambar Utama` | url or upload | optional | https URL ≤500 or JPG/PNG/WebP ≤2 MB | `Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.` | PARTIAL |
| N02-06 | `Kategori *` | select | required | OPT-ARTIKEL-KATEGORI | `Kategori diperlukan.` | COMPLETE |
| N02-07 | `Tahap Pendidikan` | select | `Semua` | `Semua`, OPT-TINGKATAN | n/a | COMPLETE |
| N02-08 | `Terbitkan Sekarang` / `Artikel Featured` | checkbox x2 | off | n/a | n/a | PARTIAL |
| N02-09 | Delete confirm | dialog | n/a | exact `Adakah anda pasti mahu padam artikel ini?` / `Batal` / `Ya, Padam` | n/a | COMPLETE |
| N03-01 | `Tajuk Banner *` | text | required | max 120 | `Tajuk banner diperlukan.` | PARTIAL |
| N03-02 | `Penerangan` | textarea | optional | max 300 | n/a | PARTIAL |
| N03-03 | `URL Gambar` | url/upload | required for HERO [P] | as N02-05 | `Gambar diperlukan untuk banner Hero.` | PARTIAL |
| N03-04 | `Jenis Banner *` | select | required | OPT-BANNER Jenis | preloaded on edit (D-6) | PARTIAL |
| N03-05 | `Jenis Pautan` + target | select + picker | `Tiada` | OPT-BANNER; `Subjek` picker = OPT-SUBJEK, `Kuiz`/`Artikel` picker = search (D-8), `Pautan Luar` = https URL ≤500 | `Sasaran pautan diperlukan.` | PARTIAL |
| N03-06 | `Sasaran Penonton *` | select | `Semua` | OPT-BANNER Sasaran | n/a | PARTIAL |
| N03-07 | `Susunan Paparan` | number | 0 | integer 0 to 999 | n/a | PARTIAL |
| N03-08 | `Tarikh Mula` / `Tarikh Tamat` | date | optional | `dd/mm/yyyy`, end ≥ start | `Tarikh tamat mesti selepas tarikh mula.` | PARTIAL |
| N03-09 | `Banner Aktif` | checkbox | checked | OPT-AKTIF | n/a | PARTIAL |
| N04-01 | Filters `Semua Subjek` (V2 shows only 5; use OPT-SUBJEK), `Semua Jenis` | selects | all | OPT-SUBJEK, OPT-NOTA-JENIS | n/a | PARTIAL |
| N04-02 | Note form: `Tajuk` (≤150), `Subjek`, `Tingkatan` (Tingkatan 1-5), `Jenis` (4), `Kandungan` (rich, ≤50,000), `Status` (`Diterbitkan`/`Draf`) | mixed | all required except none | as listed | `{Medan} diperlukan.`; create must not return 500 (D-1) | MISSING |
| N04-03 | Delete confirm | dialog | n/a | exact `Adakah anda pasti mahu padam nota ini?` | n/a | COMPLETE |
Tally: COMPLETE 5, PARTIAL 15, MISSING 1. (g) Artikel 20 per page, pagination text `Menunjukkan {a} hingga {b} daripada {n} keputusan`; empty `Tiada artikel dijumpai.`; Banner list `Jumlah: {n} banner · {m} aktif`; Nota `Jumlah: {n} nota`; (e) Banner shows only when active and today between Mula and Tamat inclusive (server date, Asia/Kuala_Lumpur).

#### N-05 `Tetapan Permainan` (API-ADM-08)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| N05-01 | `Bilangan Petak Soalan` | number | default 35 (observed) | integer 0 to 38 (48 available − 10 special); 0 = no questions | `Maksimum 38 petak soalan.`; `Bilangan petak tidak sah.` [P] | PARTIAL |
| N05-02 | Breakdown `Pecahan Papan (50 petak)` | derived | n/a | questions = N; special = 10 (3 tangga + 3 ular + 2 bonus + 2 perangkap); biasa = 48 − N − 10 (min 0); mula+tamat = 2; chips `{N} soalan`, `10 khas`, `{b} biasa` | recomputed live as N changes | COMPLETE |
| N05-03 | Save button | button | n/a | label `Simpan Tetapan` [P]; flash `Tetapan permainan disimpan.` [P] | GB-01 | PARTIAL |
| N05-04 | Per-game `Aktif` switch (Papan Bijak, Kad Memori, Battle Arena) | toggle | on | OPT-AKTIF; flash `Permainan "{nama}" telah DIAKTIFKAN.` / `...DINYAHAKTIFKAN.` [P modelled on Kawalan Ciri] | n/a | PARTIAL |
Tally: COMPLETE 1, PARTIAL 3. (c) empty `Tiada permainan didaftarkan lagi.`; tiles count rooms (`Jumlah Bilik`, `Sedang Aktif` = status playing/waiting, `Selesai` = finished, `Pemain Unik` = distinct players).

#### N-06 / P2-19 `Kawalan Ciri` (API-ADM-09 `PUT /api/admin/feature-toggles/:key`)
Fields: one switch per row, `Aktif` / `Off`, default ON, acts at once, no save button. Rows (key [P] → label): Pelajar: `permainan` Zona Permainan (observed Off on V2 but default ON in V3), `misi-harian` Misi Harian, `kombo` Kombo, `leaderboard` Leaderboard, `remedial` Remedial, `cita-cita` Cita-Cita, `universiti` Universiti, `biasiswa` Biasiswa, `target-spm` Target SPM, `analisa-item` Analisa Item, `prestasi` Prestasi, `psikometrik` Psikometrik, `profil-cerah` Profil Cerah, `kemajuan-saya` Kemajuan Saya, `sejarah-latihan` Sejarah Latihan, `video-pembelajaran` Video Pembelajaran, `perutusan` Perutusan, `panduan-pengguna` Panduan Pengguna, `tiket-bantuan` Tiket Bantuan, plus `latih-tubi` Latih Tubi (V3 addition). Guru: `guru.headcount` Headcount, `guru.misi-harian` Misi Harian, `guru.kelas` Kelas, `guru.prestasi` Prestasi, `guru.monitoring` Monitoring, `guru.analisis-item` Analisis Item, `guru.gamifikasi` Gamifikasi, `guru.broadcast` Broadcast, `guru.databank` Databank, `guru.sumbang-soalan` Sumbang Soalan. 31 rows. Status: PARTIAL each row (labels and defaults in SRS, keys not) → count 1 row-set for tally as 31 PARTIAL fields.
Behaviour: flash exact `Ciri "{label}" telah DIAKTIFKAN.` / `Ciri "{label}" telah DINYAHAKTIFKAN.`; empty `Tiada ciri didaftarkan.`; (d) ON ↔ OFF by Admin Pusat, audited (actor, flag, old, new); OFF = menu entry removed and URL 404 (FeatureGuard, API-AUTH-16); no row = ON; confirm dialog [P] only when turning OFF a pupil-facing flag: title `Matikan "{label}"?`, body `Modul ini akan hilang daripada menu dan pautannya akan memaparkan halaman 404.`, `Batal` / `Ya, Matikan`; (b) failed write reverts the switch and shows GB-01 text.

#### N-07 `Tetapan` (support contact; API-ADM-10)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| N07-01 | `E-mel sokongan` | email | optional | max 120 | `E-mel tidak sah.` | PARTIAL (rule "e-mail format, max 120 [P]") |
| N07-02 | `Telefon / WhatsApp sokongan` | text | optional | digits with optional leading `+`, 9 to 13 digits, `^\+?[0-9]{9,13}$` | `No. telefon tidak sah.` | PARTIAL |
| N07-03 | `Waktu perkhidmatan` | text | optional | max 120, e.g. `Isnin - Jumaat, 9 pagi - 5 petang` | `Waktu perkhidmatan tidak boleh melebihi 120 aksara.` | PARTIAL |
| N07-04 | `Simpan Tetapan` | button | n/a | flash `Tetapan disimpan.` [P] | no value saved → `GET /api/config/support` returns `{}` and Panduan hides the contact block | PARTIAL |
Tally: PARTIAL 4. Section heading `Hubungi Sokongan` [P]. The other V2 sections (Logo, Had, Harga, Payment, Target SPM) are not built.

### 3.5 Users, schools, classes

#### U-01 `Pengguna` list (API-ADM-01)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| U01-01 | `Peranan` | select | `Semua Peranan` | OPT-PERANAN list order | n/a | COMPLETE |
| U01-02 | `Sekolah` | async searchable select | `Semua Sekolah` | `GET /api/admin/schools/options`; pages of 20; `Muat {n} lagi`, `Memuat...`, `Tiada sekolah ditemui` + `Cuba kod sekolah atau nama daerah.`, error `Gagal memuat senarai.` + `Cuba lagi`, footer `Menunjuk {n} daripada {m} · ↑ ↓ pilih · Enter sahkan` | search min 2 chars | COMPLETE |
| U01-03 | `Status` | select | `Semua` | OPT-STATUS-AKAUN | n/a | COMPLETE |
| U01-04 | Search | text | empty | placeholder `Nama atau emel...`, max 100 | `Carian tidak boleh melebihi 100 aksara.` | PARTIAL |
| U01-05 | Row checkbox / select-all | checkbox | actor excluded | n/a | n/a | COMPLETE |
| U01-06 | Row actions: `Sunting`, toggle, delete (no `Login As`) | menu | n/a | toggle confirm `Pasti untuk menukar status pengguna ini?`; delete modal title `Padam Pengguna?` body `Anda pasti mahu memadam pengguna ini?` buttons `Batal` / `Ya, Padam`; bulk title `Padam Pengguna Terpilih?` body `Tindakan ini tidak boleh dibatalkan.` button `Ya, Padam Semua`; bar `{n} dipilih` | last active admin: 409 `LAST_ADMIN_MESSAGE` (text pinned in contract) | COMPLETE |
| U01-07 | `Eksport CSV` | button | n/a | CSV of the filtered list, UTF-8, columns same as table, IC masked | n/a | PARTIAL |
Tally: COMPLETE 5, PARTIAL 2. (g) 25 per page, sort newest first; empty `Tiada pengguna dijumpai` / `Cuba ubah kriteria carian anda`; approval banner `{n} akaun menunggu kelulusan — belum boleh log masuk.` + `Semak & luluskan` (approval list: select rows, `Luluskan`; bulk reject [P] `Tolak`); role cards count users per role (`Pelajar`, `Guru`, `Admin Sekolah`, `Pegawai PPD`, `Admin`).

#### U-02 `Tambah Pengguna` / U-03 `Edit Pengguna` (API-ADM-01)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| U02-01 | `Peranan *` | select | `-- Pilih Peranan --`; locks other fields until chosen | OPT-PERANAN create order; Admin Pusat only for admin | `Peranan diperlukan.`; `student` never combined, `admin` single (`Peranan tidak boleh digabungkan.` [P]) | PARTIAL |
| U02-02 | `Nama penuh *` | text | required | max 120; hint `Nama pengguna dijana automatik daripada nama ini dan dipaparkan selepas cipta.` (pupil) | `Nama penuh diperlukan.` | PARTIAL |
| U02-03 | `Nama pengguna *` (edit; pupil) | text | required | `^[a-z0-9._-]{3,40}$`, unique per school; hint `Unik dalam sekolah ini. Huruf kecil, nombor, titik, sengkang dan garis bawah sahaja.` | `Nama pengguna sudah digunakan dalam sekolah ini.`; `Format nama pengguna tidak sah.` | PARTIAL |
| U02-04 | `Emel *` / `E-mel (pilihan)` for pupils | email | required except pupil | max 255 | `E-mel tidak sah.`; `E-mel ini sudah digunakan.` | COMPLETE (V2 hint) / PARTIAL |
| U02-05 | `No. Telefon (Pilihan)` | text | optional | placeholder `Cth: 0191234567`, `^0[0-9]{9,10}$` | `No. telefon tidak sah.` | PARTIAL |
| U02-06 | `Tahap Pendidikan` (pupil) | radio cards | required for pupil | `Ting. 1`..`Ting. 5` (OPT-TINGKATAN) | `Sila pilih tahap pendidikan.` | COMPLETE |
| U02-07 | `No. Kad Pengenalan (Pilihan)` | text | optional | `^[0-9]{12}$`, hint `12 digit MyKad. Dilindungi PDPA.`; displayed masked `xxxxxx-xx-xxNN` | `No. kad pengenalan mesti 12 digit.` | PARTIAL |
| U02-08 | `Sekolah *` | async select | required for student, teacher, school_admin | as U01-02 | `Sekolah diperlukan.` | COMPLETE |
| U02-09 | `Kelas` | select | optional | classes of the chosen school (`GET /api/admin/classes?schoolId`), clears when school changes | n/a | PARTIAL |
| U02-10 | `Pautkan Anak (Pelajar)` (parent) | async multi-select | optional | search pupils by name, `Cari nama atau emel pelajar...`; chips with `Buang pautan`; empty `Tiada pelajar dijumpai`, `Tiada pelajar dipautkan lagi` | max 10 children [P] | PARTIAL |
| U02-11 | `Kata Laluan` | password | pupil: blank = default; others required | min 8; hint `Biarkan kosong untuk guna kata laluan lalai •••••••• (minimum 8 aksara).` | `Kata laluan mesti sekurang-kurangnya 8 aksara.` | COMPLETE |
| U02-12 | `Sahkan Kata Laluan *` | password | required when password typed | equal | `Kata laluan tidak sepadan.` | PARTIAL |
| U02-13 | `Aktifkan Akaun` | checkbox | checked | hint `Pengguna yang tidak aktif tidak boleh log masuk` | n/a | COMPLETE |
| U02-14 | Admin Sekolah generator: `Cari Sekolah *`, `Janakan Akaun Admin Sekolah`, `Nama Pentadbir`, `ID Login (Emel)`, `Kata Laluan` (generated, shown once, copy toast `Disalin!`), `Telefon (Pilihan)` | search + button + read/edit | school with KPM code required | warning `Sekolah ini tiada kod KPM. Sila isi maklumat secara manual di bawah.`; `Daftar Pengguna` disabled until generated | n/a | COMPLETE |
| U02-15 | PPD: `PPD *` (and `Negeri (JPN) *` for JPN, not offered) | select | required | `GET /api/jpn/:id/ppd` (API-ADM-04) | `PPD diperlukan.` | PARTIAL |
| U03-01 | Edit: `Status` | radio | current | `Aktif (boleh log masuk)`, `Digantung` | n/a | COMPLETE |
| U03-02 | `Kata laluan baharu` (reset card) | password | blank = reset to default | min 8; hint `Biarkan kosong untuk tetapkan semula kepada ••••••••. Kata laluan baharu dipaparkan sekali selepas simpan.`; button `Tetapkan Semula`; generated password shown once, no-store | `Kata laluan mesti sekurang-kurangnya 8 aksara.` | COMPLETE |
| U03-03 | `Pakej Langganan` | read-only | n/a | current package, expiry | n/a | PARTIAL |
| U03-04 | Peranan change hint | text | n/a | `Menukar peranan mengubah apa yang pengguna ini boleh lihat dan buat. Medan di atas akan berubah mengikut peranan baharu selepas simpan.` | n/a | COMPLETE |
Buttons `Cipta Pelajar` / `Daftar Pengguna` / `Simpan` / `Kemaskini`, `Batal`, `Kembali`. Tally: COMPLETE 8, PARTIAL 11 (rows 02-01,02,03,05,07,09,10,12,15, U03-03 = 10 PARTIAL + 02-04 PARTIAL = 11). Behaviour: (a) 422 field messages; duplicate email inline; (d) account Aktif ↔ Digantung: Digantung blocks login at once; imported pupils `Menunggu kelulusan` → Aktif (approve) | Ditolak [P]; (f) password shown once: banner `Salin kata laluan ini sekarang. Ia tidak akan dipaparkan lagi.` [P].

#### U-04 `Sekolah` (API-ADM-03)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| U04-01 | Filters: `Semua Negeri`, `Semua Status` (`Aktif sahaja`, `Tidak Aktif sahaja`), `Semua Jenis`, search | selects, text | all | OPT-NEGERI-SEKOLAH (16, label `16 negeri`), OPT-JENIS-SEKOLAH, placeholder `Cari nama atau kod sekolah...` | n/a | COMPLETE |
| U04-02 | `Nama sekolah *` | text | required; placeholder `cth: SK TAMAN KLUANG BARU` | max 150, upper-case stored as typed | `Nama sekolah diperlukan.` | PARTIAL |
| U04-03 | `Kod sekolah` | text | optional (V2) | unique when filled, `^[A-Z0-9]{4,12}$`; hint `Unik jika diisi (cth. kod KPM).` | `Kod sekolah ini sudah digunakan.` | PARTIAL |
| U04-04 | `Jenis *` | select | required | OPT-JENIS-SEKOLAH; SK and SJK hidden by default in lists (D72, OQ-U1) | `Jenis diperlukan.` | PARTIAL |
| U04-05 | `Negeri *` | select | required | OPT-NEGERI-SEKOLAH | `Negeri diperlukan.` | COMPLETE |
| U04-06 | `Daerah` | text | optional | max 80 | n/a | PARTIAL |
| U04-07 | `Aktif` | checkbox | checked | OPT-AKTIF | n/a | COMPLETE |
Tally: COMPLETE 3, PARTIAL 4. (g) 30 per page; empty `Tiada sekolah dijumpai`; `Kod Daftar` column read-only (generated registration code).

#### U-05 `Import Pelajar` (API-ADM-01 / AS-06) and U-06 `Import Pengguna` (`POST /api/admin/users/bulk-import`)
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| U05-01 | `Sekolah` | async select | required | as U01-02; after choice quota panel `Memeriksa kuota...`, `Kuota Pelajar`, `Baki kuota: {n} pelajar` | `Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.` | PARTIAL |
| U05-02 | `Tingkatan / Darjah` → `Tingkatan` | select | `— Pilihan —`; used when a row has no class | OPT-TINGKATAN (Darjah removed); hint `Digunakan jika baris tidak menyatakan kelas.` | `Sila pilih tahap pendidikan.` | COMPLETE |
| U05-03 | `Senarai Pelajar` (file) | file | required | `.csv`/`.txt`, max 2 MB, columns `nama,email,kelas` (kelas optional); drop zone `Klik untuk pilih fail atau seret & lepas di sini`; `Tukar` | GB-06 file errors; max 1000 rows | PARTIAL |
| U05-04 | Preview | read-only | n/a | `Pratonton · semua {n} baris`; `Ini contoh sahaja. {n} baris lagi tidak dipaparkan — kesemua {n} pelajar akan diimport.` (first 10 rows) | n/a | COMPLETE |
| U05-05 | Row rules | rule | n/a | name Title Case; email unique else skipped; default password; account `Menunggu kelulusan`; whole file refused if rows > remaining seats: `Kuota penuh! Sila tingkatkan kuota dahulu.` | per-row reasons `E-mel tidak sah.`, `E-mel sudah wujud (dilangkau).` | PARTIAL |
| U05-06 | `Muat Turun CSV Pelajar`, `Tutorial` | links | n/a | template header `nama,email,kelas` | n/a | COMPLETE |
| U06-01 | `Peranan` | select | required | OPT-BULK-ROLE (AS: Guru only) | `Peranan tidak dibenarkan.` (typed 403 `IMPORT_ROLE_FORBIDDEN_MESSAGE`) | PARTIAL |
| U06-02 | `Sekolah` | async select | required for Guru and Admin Sekolah | as U01-02 | `Sekolah diperlukan.` | COMPLETE |
| U06-03 | `Fail Pengguna (CSV)` | file | required | `.csv`/`.txt`, max 2 MB, columns `nama,email`; paste mode (`pasteContent`) max 1,048,576 chars and 1000 rows | `Fail terlalu besar.` / GB-06 | PARTIAL |
| U06-04 | `Import` / `Muat Turun CSV Pengguna` / `Tutorial` | buttons | n/a | result `{n} dicipta, {s} dilangkau, {m} ditolak` + per-row list | n/a | COMPLETE |
Tally: COMPLETE 5, PARTIAL 5.

#### U-07 `Pelajar Komplimen`, U-08 `Kelas Sekolah`, U-09 `Langganan Sekolah`
| # | Label | Type | Req / default | Options or source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| U07-01 | Search `Cari` | text | empty | name/IC, max 100 | n/a | COMPLETE |
| U07-02 | Create: `Guru`, `Kelas guru`, `Tarikh tamat pakej`, `Senarai pelajar` (`NAMA PENUH, NOMBOR KP` one per line) | select, select, date, textarea | all required | teachers of a school (async), classes of the teacher; date today+1 to +5 years [P]; lines ≤500 | `Format baris {n} tidak sah. Gunakan: NAMA PENUH, NOMBOR KP.` [P]; IC `^[0-9]{12}$` | PARTIAL |
| U07-03 | Bulk `Matikan syiling`, `Hidupkan syiling`, `Nyahaktif akaun`, `Aktifkan akaun`, `Batal pilihan` | actions | needs ≥1 selected | confirm `{n} dipilih. Teruskan?` ... `Batal` / `Ya, Teruskan` | n/a | PARTIAL |
| U08-01 | Filters `Sekolah`, `Guru`, `Tingkatan`, `Cari` | selects, text | all | OPT-TINGKATAN, async school, teachers of school | n/a | PARTIAL |
| U08-02 | Detail: move/remove pupil, change class teacher | select/actions | n/a | `Pindah ke kelas`, `Keluarkan` confirm `Keluarkan pelajar daripada kelas ini?` (enrolment `removed`), `Tukar guru kelas` | n/a | PARTIAL |
| U09-01 | Filters: `Cari sekolah...`, `Status`, `Semua Tingkatan` | text, select, select | all | OPT-LANGGANAN (4 statuses; Tingkatan 4, 5) | n/a | COMPLETE |
| U09-02 | Create: `Sekolah`, `Tingkatan`/Pakej card, `Pakej` (`Pemantauan`/`Penuh`), `Kuota` (`student_quota`), `Mula`, `Tamat` | async select, radio cards, radio, number, date, date | all required | quota integer 1 to 5000 [P]; end > start | `Kuota mesti antara 1 dan 5000.` [P]; `Tarikh tamat mesti selepas tarikh mula.` | PARTIAL |
| U09-03 | Status transitions | rule | n/a | `active → grace` (past end, grace days [P] 14) `→ expired`; `cancelled` by Admin Pusat (confirm `Batalkan langganan ini?`); renewal invoice page `/:id/renewal-invoice` | n/a | PARTIAL |
Tally: COMPLETE 2, PARTIAL 6.

### 3.6 Monitoring and reports

| # | Screen | Field | Options or source | Rule / message | SRS |
|---|---|---|---|---|---|
| M01-01 | M-01 Dashboard | CSV downloads `Pengguna`, `Soalan`, `Sekolah` (`Pembayaran` omitted) | buttons; file names `pengguna.csv`, `soalan.csv`, `sekolah.csv` [P] | tile counts from the Studio list endpoint; empty `Tiada soalan.` | PARTIAL |
| M02-01 | M-02 Command Center | none (refresh 10 s) | `Data dikemaskini setiap 10 saat` | live feed shows full name (admin only) | COMPLETE |
| M03-01 | M-03 Monitoring | `Tempoh` | OPT-MONITORING-TEMPOH default `Semua Masa` | window = last 7/30/90 days; buttons `Tapis`, `Reset` | COMPLETE |
| M03-02 | M-03 | `Negeri` | `Semua Negeri` + 16 | n/a | COMPLETE |
| M03-03 | M-03 | Export CSV / PDF | buttons `Eksport CSV`, `Eksport PDF` [P labels] | follow filters | PARTIAL |
| M04-01 | M-04 Kirkpatrick | `Sekolah` (async), `Negeri` | `Semua Sekolah`, `Semua Negeri`, `Tapis` | Admin Pusat default = all schools | COMPLETE |
| M04-02 | M-04 `/maklum-balas` form | NPS (0 to 10 radio row), satisfaction (1 to 5 stars), comment (optional, max 500) | inferred only (E-19) | one per user per calendar month; `Terima Kasih!`, `Anda sudah mengisi maklum balas untuk bulan ini. Sila kembali bulan depan.`, `Kembali ke Dashboard`; errors `Sila pilih skor NPS.` [P], `Sila pilih tahap kepuasan.` [P] | PARTIAL |
| M05-M08 | Analitik, Laporan, Laporan Eksekutif, central views | no inputs; Laporan Eksekutif year fixed 2026 → current year; M-07 school picker `Sekolah` async (required, `Pilih sekolah` [P]) | n/a | n/a | COMPLETE (0 inputs) |
Tally: COMPLETE 4, PARTIAL 3, plus M-07 picker PARTIAL 1 → COMPLETE 4, PARTIAL 4.
Calculations (e), all PARTIAL (formula in SRS by reference to 40 FR-X4; this block repeats the ones named on screen): `% Penglibatan` = pupils with ≥1 answer in the window ÷ registered pupils × 100, whole-number percent, round half up; level `Cemerlang` ≥60%, `Sederhana` ≥20%, `Rendah` <20%, `Tiada` =0%; `% Penglibatan Guru` = teachers who logged in ÷ registered teachers (`{n} / {m} guru`); `Tracking Mingguan` = answers per ISO week for the last 12 weeks (M1 oldest); `Ketepatan Purata` = correct answers ÷ all answers, pooled across `practice_answers`, whole-number percent; `Laporan` trend = daily counts for 14 days, `Jumlah Aktiviti` and `Skor Purata` over 30 days; `Murid Pernah Akses` = `{n} / {m}` + percent; all computed on load (Command Center every 10 s), never stored (D11/D12).

### 3.7 Gamification, rewards, marketplace and other matrix screens (admin settings only; game mechanics are out of scope)

#### P2-01/05 Overview and Transaksi
| # | Label | Type | Options or source | Rule / message | SRS |
|---|---|---|---|---|---|
| P01-01 | Overview: none | n/a | `Jenis` and `Sumber` as BM labels, relative time in BM (`2 hari lepas`, `1 minggu lepas`) | `Taburan Tier` % = tier pupils ÷ total pupils with a tier, whole number; `{n} pelajar belum ditetapkan tier.`; Top 10 ties get separate ranks ordered by `id` | PARTIAL |
| P05-01 | `Semua Jenis` | select | OPT-GAM-JENIS-TRANSAKSI | n/a | COMPLETE |
| P05-02 | `Dari` / `Hingga` | date | `dd/mm/yyyy`, to ≥ from, default none | `Tarikh akhir mesti selepas tarikh mula.` [P]; buttons `Tapis`, `Reset` | PARTIAL |
| P05-03 | CSV export | button | `Eksport CSV` [P] | filtered rows | PARTIAL |
Rule (e): `Baki Selepas` of row n = balance before + `Jumlah`; 50 per page; empty `Tiada transaksi.` [P]. Tally P2-01/05: COMPLETE 1, PARTIAL 3.

#### P2-02 `Tier Config` (API-ADM-14)
| # | Label | Type | Req / default | Source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| P02-01 | `Label BM` | text | required | max 30 | `Label BM diperlukan.` | PARTIAL |
| P02-02 | `Nama Tier (eng)` (new only) | text | required, e.g. `diamond` | `^[a-z]{3,20}$`, unique | `Nama tier sudah digunakan.` | PARTIAL |
| P02-03 | `Icon` | text | emoji, 1 to 2 chars | n/a | `Icon diperlukan.` | PARTIAL |
| P02-04 | `Warna` | colour | hex | `^#[0-9a-fA-F]{6}$` | `Warna mesti kod hex.` | PARTIAL |
| P02-05 | `Min Syiling` | number | required | integer ≥0, first tier 0, strictly increasing by `Urutan` | `Min Syiling mesti lebih besar daripada tier sebelumnya.` | COMPLETE |
| P02-06 | `Kadar` / `Kadar Penukaran` | number | required | integer 1 to 1000 [P] (syiling per token: 50, 40, 30, 20) | `Kadar mesti antara 1 dan 1000.` | PARTIAL |
| P02-07 | `Urutan` | number | required | integer 1..99 unique | `Urutan sudah digunakan.` | PARTIAL |
| P02-08 | `Perks` | text | optional | max 100, e.g. `Bonus 2x XP` | n/a | PARTIAL |
| P02-09 | Latih Tubi `L1`..`L5` | number x5 | defaults 1,2,3,4,5 | integer 0 to 1000 | `Ganjaran tidak boleh negatif.` [P] | PARTIAL |
| P02-10 | `PKSK — Syiling / Betul` | number | default 5 | integer 0 to 1000 | same | PARTIAL |
| P02-11 | `Papan Bijak` `Jawab Betul`, `Menang` | number x2 | defaults 5, 25 | integer 0 to 1000 | same | PARTIAL |
| P02-12 | `Simpan`, `Nyahaktif` / `Aktifkan`, `Tambah Tier` | buttons | n/a | `Nyahaktifkan tier ini?` body `Pelajar dalam tier ini kekal; tier tidak lagi diberi kepada pelajar baharu.` [P] | n/a | PARTIAL |
Tally: COMPLETE 1, PARTIAL 11. (e) A change applies from the next answer / next conversion; history not recalculated.

#### P2-03 `Cabaran` and P2-04 `Pelajar` / `Beri Syiling`
| # | Label | Type | Req / default | Source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| P03-01 | `Tajuk` | text | required | max 80 | `Tajuk diperlukan.` | PARTIAL |
| P03-02 | `Keterangan` | textarea | required | max 200 | `Keterangan diperlukan.` | PARTIAL |
| P03-03 | `Icon` | text | emoji | 1 to 2 chars | n/a | PARTIAL |
| P03-04 | `Jenis` | select | required | OPT-CABARAN | `Jenis diperlukan.` | PARTIAL |
| P03-05 | `Sasaran` | number | required | integer 1 to 1000; for `Ketepatan (%)` 1 to 100 | `Sasaran tidak sah.` | PARTIAL |
| P03-06 | `Ganjaran Syiling`, `Ganjaran XP` | number x2 | defaults 10, 10 | integer 0 to 10000 | `Ganjaran tidak sah.` | PARTIAL |
| P03-07 | `Kesukaran` | select | `Mudah` | Mudah, Sederhana, Sukar | n/a | PARTIAL |
| P03-08 | `Urutan` | number | next | integer 1..99 | n/a | PARTIAL |
| P03-09 | `Simpan`, `Nyahaktif`, `Padam` | buttons | n/a | confirm exact `Padam cabaran ini?`, `Batal` / `Ya, Padam` | n/a | COMPLETE |
| P04-01 | `Tier` | select | `Semua Tier` | OPT-GAM-TIER | n/a | COMPLETE |
| P04-02 | `Cari (nama / emel)` | text | placeholder `Cari pelajar...` | max 100 (V3 matches name and school only) | n/a | PARTIAL |
| P04-03 | `Beri Syiling`: amount | number | required | non-zero integer −10,000 to 10,000 | `Jumlah mesti nombor bukan sifar antara −10,000 dan 10,000.` [P] | PARTIAL |
| P04-04 | `Sebab` | text | required for award and deduction | 5 to 200 chars | `Sebab diperlukan (sekurang-kurangnya 5 aksara).` [P]; result row type `Bonus` (positive) / `Refund` (negative) | PARTIAL |
Tally: COMPLETE 2, PARTIAL 11. (d) Cabaran Aktif ↔ Tidak Aktif; a type without a working evaluator is not selectable (`accuracy`, `time_spent`, `streak` need evaluators, FR-P2-03.3).

#### P2-06 `Tetapan Gamifikasi`: rows (contract `kind: number|toggle`, `admin.ts:301`): fields are the keys returned by `GET /api/admin/gamification/settings`. [P] list: `Ganjaran Rujuk Kawan (pengundang)` number 0 to 10000 default 30 (SRS AC example); `Ganjaran Rujuk Kawan (diundang)` number 0 to 10000 default 30; `Had rujukan sebulan` number 0 to 100 default 10; `Rujuk Kawan aktif` toggle on. Message `Nilai tidak boleh negatif.`; button `Simpan`. Status MISSING-NO-SOURCE ×4.

#### P2-07/08 `Hadiah` (API-ADM-15)
| # | Label | Type | Req / default | Source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| P07-01 | Category pills | filter | `Semua` | OPT-HADIAH-KATEGORI | empty `Tiada hadiah dalam kategori ini.` | COMPLETE |
| P07-02 | `Kategori *` | select | required | OPT-HADIAH-KATEGORI | `Kategori diperlukan.` | PARTIAL |
| P07-03 | `Vendor *` | text | required; placeholder `cth: Roblox, Touch n Go, Hotlink` | max 60 | `Vendor diperlukan.` | COMPLETE (empty-check AC) |
| P07-04 | `Tajuk *` | text | required; `cth: TnG eWallet RM50` | max 100 | `Tajuk diperlukan.` | COMPLETE |
| P07-05 | `Penerangan` | textarea | optional | max 500 | n/a | PARTIAL |
| P07-06 | `Nilai (RM) *` | number | required | decimal 0.01 to 10000, 2 dp | `Nilai (RM) diperlukan.` | COMPLETE |
| P07-07 | `Kos Token *` | number | required; hint `100 syiling = 1 token = RM1` | integer 1 to 100000 | `Kos Token diperlukan.` | COMPLETE |
| P07-08 | `Emoji Icon` | text | optional | 1 to 2 chars | n/a | PARTIAL |
| P07-09 | `Stok (kosong = tanpa had)` | number | blank = ∞ | integer ≥0 | `Stok tidak sah.` | PARTIAL |
| P07-10 | `Maks/bulan/pelajar` | number | blank = no cap | integer 1 to 100 | n/a | PARTIAL |
| P07-11 | `Sah Hari (default 365)` | number | 365 | integer 1 to 3650 | n/a | PARTIAL |
| P07-12 | `Delivery` | select | `Manual (admin paste)` | `Manual (admin paste)`, `Instant` | n/a | COMPLETE |
| P07-13 | `Vendor SKU (optional)`, `Display Order`, `Image URL (optional)`, `Terma Khas` | text, number, url, textarea | optional | ≤50, integer 0..9999, https ≤500, ≤1000 | n/a | PARTIAL |
| P07-14 | `Aktif`, `Perlu kelulusan ibu bapa` | checkbox x2 | off by default (catalogue must be activated, U-OP-09) | n/a | n/a | PARTIAL |
| P07-15 | Bulk toolbar `Aktifkan`, `Nyahaktifkan`, `Set Stok`, `Had/Bulan`, `Pelaras Token`, `Padam`, `Batal` | actions | `{n} hadiah dipilih` | `Pelaras Token` = ± percent −90 to +500, cost = round-half-up(cost × (1 + p/100)), min 1; `Set Stok` integer ≥0 or blank | `Padam` only when no redemption; else `Hadiah ini mempunyai tebusan. Nyahaktifkan sahaja.` [P] | PARTIAL |
| P08-01 | Status pills | filter | default `⏳ Pending Admin` | OPT-HADIAH-KATEGORI (tebusan set) | empty `Tiada tebusan dalam status ini.` | COMPLETE |
| P08-02 | `Hantar kod` | text + button | required | code 1 to 200 chars, only when `pending_admin` | `Kod baucar diperlukan.` [P]; success `Kod dihantar kepada pelajar.` [P] | PARTIAL |
| P08-03 | `Batal` (cancel) | action | confirm `Batalkan tebusan ini?` body `Token pelajar akan dipulangkan.` `Batal` / `Ya, Batalkan` [P] | refund once | PARTIAL |
Tally: COMPLETE 7, PARTIAL 10. (d) `pending_parent_consent → pending_admin` (parent approves) `→ delivered` (admin `Hantar kod`; pupil notified) or `→ cancelled` (tokens refunded once); `Hantar kod` not offered while pending parent consent. Page size 50; out-of-range page redirects to the last page.

#### P2-09/10/11 `Kawalan Reward`, `Cabutan Bertuah`, `Kotak Misteri` (API-ADM-16)
| # | Label | Type | Req / default | Source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| P09-01 | `Bajet tebus / sesi` | money | RM3.00 observed | stored in sen (integer), shown `RM{x.xx}`; 0 to RM10,000 | `Bajet tidak sah.` | PARTIAL |
| P09-02 | `Syiling flat / soalan betul` (`flatCoins`) | number | 1 | integer 0 to 100 | `Nilai mesti antara 0 dan 100.` | COMPLETE |
| P09-03 | `Tahun sesi semasa` | number | 2026 | integer 2020 to 2100 | `Tahun tidak sah.` | PARTIAL |
| P09-04 | `Mini-games beri syiling?` | checkbox | off (`Tidak (XP sahaja)`) | n/a | n/a | COMPLETE |
| P09-05 | `Simpan Tetapan` | button | n/a | flash `Tetapan kewangan disimpan.` [P]; a change affects later answers only | n/a | PARTIAL |
| P09-06 | `Kos Sebenar` per reward | money | digital = RM0 | sen integer ≥0, `Simpan` per row | `Kos tidak sah.` | PARTIAL |
| P10-01 | `Tajuk` | text | required | max 120 | `Tajuk diperlukan.` | MISSING-NO-SOURCE |
| P10-02 | `Penerangan` | textarea | optional | max 500 | n/a | MISSING-NO-SOURCE |
| P10-03 | `Harga tiket (syiling)` | number | 50 | integer 1 to 10000 | `Harga tiket tidak sah.` | PARTIAL |
| P10-04 | `Max tiket / pelajar` | number | 10 | integer 1 to 1000 | 11th ticket refused: `Had tiket dicapai.` [P] | PARTIAL |
| P10-05 | Prize + close date | text, datetime | prize required, close optional | prize ≤120; close in the future | `Tarikh tutup mesti pada masa hadapan.` | MISSING-NO-SOURCE |
| P10-06 | `Tutup`, `Cabut pemenang` | actions | draft → open → closed | `Cabut pemenang` once per prize, random from ticket pool; confirm `Cabut pemenang sekarang?` body `Tindakan ini tidak boleh dibatalkan.` | second press: no second winner | PARTIAL |
| P11-01 | Kotak: `Nama`, `Kos (syiling)`, prize pool rows (`Hadiah`, `Berat (%)`, `Stok`) | text, number, rows | all required | name ≤60, cost 1..10000, weights sum exactly 100 | `Jumlah berat mesti 100%.` | MISSING-NO-SOURCE |
Tally: COMPLETE 2, PARTIAL 6, MISSING-NO-SOURCE 4. (d) draw status `draft → open → closed` (contract). (e) liability = Σ real cost (sen) of `delivered` redemptions in `Tahun sesi semasa`; redemption refused if liability + cost > bajet (`Bajet tebusan sesi ini telah habis.` [P]).

#### P2-12/13 `Marketplace` (API-ADM-19)
| # | Label | Type | Req / default | Source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| P12-01 | Filters: search `Cari produk...`, `Semua Kategori`, `Semua Status` | text, selects | all | OPT-MARKET | n/a | COMPLETE |
| P12-02 | `Penjual` | select | `PRESTASIPLUS Official (Admin)` | sellers | `Penjual diperlukan.` | PARTIAL |
| P12-03 | `Nama Produk *` | text | required | max 120 | `Nama produk diperlukan.` | PARTIAL |
| P12-04 | `Kategori *` | select | required | OPT-MARKET | `Kategori diperlukan.` | COMPLETE |
| P12-05 | `Harga (RM) *` / `Harga Asal (RM)` | number x2 | required / optional | decimal 0.01 to 100000; original ≥ price | `Harga asal mesti lebih besar daripada harga.` [P] | PARTIAL |
| P12-06 | `Penerangan` | textarea | optional | max 2000 | n/a | PARTIAL |
| P12-07 | `Keadaan *`, `Status Stok *`, `Kaedah Penghantaran *` | radio/select | required | OPT-MARKET | n/a | COMPLETE |
| P12-08 | `Kos Penghantaran (RM)`, `Lokasi` | number, text | optional | 0 to 1000, ≤100 | n/a | PARTIAL |
| P12-09 | Images (up to 5) | file | optional | JPG, PNG, WEBP, max 2MB each; delete image is its own form | `Maksimum 5 gambar.` [P]; type/size message of 04-24 | COMPLETE |
| P12-10 | `Status Produk *` (edit) | radio | `🟢 Aktif` | OPT-MARKET | n/a | COMPLETE |
| P12-11 | Delete | action | n/a | confirm exact `Padam produk ini?`; blocked with orders | `Produk ini mempunyai pesanan. Nyahaktifkan sahaja.` [P] | PARTIAL |
| P13-01 | Seller filter `Semua Status` | select | all | Pending, Aktif, Digantung, Diharamkan | n/a | COMPLETE |
| P13-02 | Seller actions `Lihat Detail`, `Luluskan`, `Sahkan`, `Gantung`, `Haramkan` | actions | n/a | `Haramkan` confirm exact `Haramkan penjual ini?`; others `{Tindakan} penjual ini?` / `Batal` / `Ya, {Tindakan}` [P] | n/a | PARTIAL |
Tally: COMPLETE 5, PARTIAL 9. (d) seller `Pending → Aktif` (Luluskan) `→ Digantung → Aktif`; `→ Diharamkan` terminal; products leave the pupil list at once on Digantung/Diharamkan; `Sahkan` sets the verified tick. Stat cards are global (not the filtered query).

#### P2-14 Tournament, P2-15 Ranking, P2-16 Pautan Ibu Bapa, P2-17 Audio KBAT, P2-20 Tiket
| # | Label | Type | Req / default | Source | Validation and messages | SRS |
|---|---|---|---|---|---|---|
| P14-01 | `Nama tournament` | text | required | max 100 | `Nama diperlukan.` | MISSING-NO-SOURCE |
| P14-02 | `Jenis` | select | `Kejohanan` | `friendly` Persahabatan, `tournament` Kejohanan, `league` Liga (CODE `GAMES_LEAGUE_TYPES`) | n/a | MISSING-NO-SOURCE |
| P14-03 | Question source: `Subjek`, `Tingkatan`, `Bilangan soalan` | selects, number | required | OPT-SUBJEK, OPT-TINGKATAN, 5 to 50 | `Sila pilih subjek.` | MISSING-NO-SOURCE |
| P14-04 | Registration `Pendaftaran bermula` / `ditutup`, `Mula` / `Tamat` | datetime x4 | required; open < close < start < end | n/a | `Tarikh pendaftaran tidak sah.` [P] | MISSING-NO-SOURCE |
| P14-05 | Buttons `Cipta & Buka Pendaftaran`, `Simpan Draf`, `Tutup Pendaftaran` | buttons | n/a | status `upcoming`, `ongoing`, `ended` (CODE) labels `Akan Datang`, `Sedang Berlangsung`, `Tamat` — note: "Akan Datang" is allowed for a status word only; if the placeholder rule forbids it use `Belum Bermula` [P] | n/a | PARTIAL |
| P15-01 | Ranking: `Tempoh`, `Skop` | selects | default current period, all | `Bulan ini`, `Semua masa`; `Semua sekolah` | [PROPOSED] in SRS | PARTIAL |
| P16-01 | Parent link: pupil search + `Buang pautan` | async select, action | n/a | confirm `Buang pautan ini?` body `Ibu bapa tidak lagi dapat melihat anak ini.` `Batal` / `Ya, Buang` [P] | `Tiada pelajar dijumpai` | PARTIAL |
| P17-01 | Audio filters `Semua Tahap`, `Semua Subjek`, `Semua Status`, search | selects, text | all | OPT-TINGKATAN, OPT-SUBJEK, OPT-AUDIO-STATUS | n/a | COMPLETE |
| P17-02 | Set: `Tajuk Set`, `Tahap`, `Subjek`, `Status`, `Sumber / Penyumbang`, `Arahan Umum` | mixed | Tajuk/Tahap/Subjek/Status required | title ≤150, source ≤150, instructions ≤1000 | `Tajuk diperlukan.` | PARTIAL |
| P17-03 | 4 sections: `Tajuk Audio`, `Fail Audio`, `Transkrip Audio Untuk Audit` | text, file, textarea | audio required for Approved | mp3/m4a/wav, max 20 MB [P]; ranges fixed Q1-8, 9-16, 17-24, 25-30 | `Fail audio diperlukan untuk set yang diluluskan.` [P] | PARTIAL |
| P17-04 | 30 questions: `Teks Soalan`, `Pilihan A`-`D`, `Jawapan`, `Markah`, `KBAT Level`, `DSKP SP ID` (→ SP picker), `Skema / Penjelasan` | per Q-04 rules | all required except scheme | exactly 4 options A-D here; KBAT OPT-KBAT-OVERRIDE; SP picker per 04-04 | as Q-04 | PARTIAL |
| P17-05 | `Template XLSX`, `Template Word`, `Cipta Set`, `Simpan Set Audio KBAT` | buttons | n/a | n/a | n/a | PARTIAL |
| P20-01 | Ticket chips `Semua ({n})` + one per OPT-TIKET-STATUS | filter | `Semua` | lower-case words + counts | empty `Belum ada tiket sokongan.`; `Tiada tiket berstatus “{status}”.` | COMPLETE |
| P20-02 | Role filter | select | `Semua Peranan` | Pelajar, Guru, Admin Sekolah | n/a | PARTIAL |
| P20-03 | `Balas` (admin reply) | textarea | required to save reply | 1 to 2000 chars; single reply, later save replaces | `Sila tulis balasan.` [P] | PARTIAL |
| P20-04 | Status select | select | current | OPT-TIKET-STATUS | n/a | PARTIAL |
Tally: COMPLETE 2, PARTIAL 10, MISSING-NO-SOURCE 4. (d) ticket: user creates `dibuka`; admin sets any of the 5 independently of the reply; reply sets `Dibalas` = `Ya` and notifies `Tiket anda telah dibalas.`; the owner cannot reply; `ditutup` and `selesai` hide the reply box; Admin Pusat only (Guru/AS: 403).

**Tally 3.3 to 3.7 (counted from the blocks above):** C-01 C3/P2/N5; C-02 C1/P8; C-03 C1/N5; Video P2/M5; Artikel-Banner-Nota C5/P15/M1; N-05 C1/P3; Kawalan Ciri P31; N-07 P4; U-01 C5/P2; U-02/03 C8/P11; U-04 C3/P4; U-05/06 C5/P5; U-07..09 C2/P6; M block C4/P4; P2-01/05 C1/P3; P2-02 C1/P11; P2-03/04 C2/P11; P2-06 N4; P2-07/08 C7/P10; P2-09..11 C2/P6/N4; P2-12/13 C5/P9; P2-14..20 C2/P10/N4.
COMPLETE: 3+1+1+0+5+1+0+0+5+8+3+5+2+4+1+1+2+0+7+2+5+2 = 58. PARTIAL: 2+8+0+2+15+3+31+4+2+11+4+5+6+4+3+11+11+0+10+6+9+10 = 157. MISSING: 5 (Video) + 1 (Nota) = 6. MISSING-NO-SOURCE: 5+5+4+4+4 = 22.

## 4. Behaviour register (scope a to h) per area: SRS status and where the proposed rule sits

| Item | a Messages | b HTTP/network handling | c Empty/loading | d State machines | e Calculations | f Confirm dialogs | g Paging/sort/bulk | h Import/OCR |
|---|---|---|---|---|---|---|---|---|
| Question entry Q-03..Q-05, Q-24 | PARTIAL (gate + flash copy in SRS; field-level copy [P] here) | MISSING (GB-01) | PARTIAL | COMPLETE for question; PARTIAL for group/paper | PARTIAL (marks sum, TP max) | MISSING (all [P]) | PARTIAL (25 per page; bulk cap value) | n/a |
| Import/Upload Q-07..Q-12 | PARTIAL | MISSING | PARTIAL | PARTIAL (batch machine in code only) | n/a | MISSING | PARTIAL | PARTIAL (timeout, partial pages, row errors [P]) |
| Set/Paper/Kontrak Q-13..Q-18 | COMPLETE for V2 strings; PARTIAL for validation | MISSING | PARTIAL | PARTIAL | PARTIAL (pool count) | COMPLETE for 3 V2 dialogs; MISSING rest | PARTIAL | PARTIAL (Kertas Subjektif OCR) |
| Curriculum C-01..C-05 | MISSING (English templates in code) | MISSING | PARTIAL | n/a | PARTIAL | MISSING | MISSING | PARTIAL |
| Content N-01..N-07 | PARTIAL | MISSING | PARTIAL | PARTIAL | PARTIAL (banner window) | PARTIAL (2 V1 texts) | PARTIAL | n/a |
| Users U-01..U-09 | PARTIAL (V1/V2 texts) | MISSING | PARTIAL | PARTIAL | PARTIAL (quota) | COMPLETE for V1 dialogs | PARTIAL | PARTIAL (U-05, U-06 row outcome [P]) |
| Monitoring M-01..M-08 | PARTIAL | MISSING | PARTIAL | n/a | PARTIAL (formula by reference to 40 FR-X4) | n/a | MISSING | n/a |
| Gamification/Hadiah/Marketplace/Tiket P2 | PARTIAL | MISSING | PARTIAL | PARTIAL (statuses in code; transitions [P]) | PARTIAL (Pelaras Token, liability) | PARTIAL (V1 confirms) | PARTIAL | n/a |
[SUPERSEDED: this table and its earlier count are replaced by the reconciled grid 5.1a (3 COMPLETE / 39 PARTIAL / 14 MISSING / 8 N/A = 64).]

### 4A. Resolved gaps and what remains
Gaps 1 to 10 of 5.2 are closed by 1A: 1 → 1A.6; 2 → 1A.7; 3 → 1A.1; 4 → 1A.5; 5 → 1A.2; 6 and 7 → rows 04-03..04-12, 04-37 and 1A.3; 8 → 1A.4; 9 → 1A.8 plus rows 08-01..08-15 (Jenis kertas) and OPT-TAHUN/OPT-NEGERI; 10 → 1A.9. Gaps 11 to 13 → 1A.10 (ERR-*). Gap 15 (scheme codes) → 1A.8. Gaps 18 to 19 remain proposals (roles, flag keys). Still without any observed source (22 fields): Bab/Topik/Subtopik create forms, Tahap Pendidikan create/edit, Rujuk Kawan settings, Cabutan and Kotak Misteri prize fields, Tournament form.

### 4B. Decisions left for the user (all have a recommendation)
1. Approve all [P] and [DECIDED] copy in this file at once (D94 table 8.4 gets the new strings): the register cannot be proven from V2 for the 22 no-source fields.
2. Kotak Misteri, Tournament and Rujuk Kawan field lists (E-14): recommend approving the [P] lists in 3.7 or removing those three screens from the menu until V2/V1 forms are captured (rule FR-ADM-H0.2 forbids half-built screens).
3. `Lain-lain` paper type maps to `modul` (1A.8): recommend accept; the alternative is a sixth stored value `lain_lain`.

## 5. Summary

### 5.1 Counts (fields)
| Status | Question section (3.1-3.2) | Rest (3.3-3.7) | Total |
|---|---|---|---|
| COMPLETE | 66 | 58 | 124 |
| PARTIAL | 144 | 157 | 301 |
| MISSING | 33 | 6 | 39 |
| MISSING-NO-SOURCE | 0 | 22 | 22 |
| Total fields | 243 | 243 | 486 |
FINAL COUNTS (supersede all earlier tallies in this file). The question-section change from 226 to 243 comes from replacing the 17-row CSV draft by the 34-row single header set of 1A.9 (17 PARTIAL, 17 MISSING because the SRS names none of: question_key, type, part_label, aras, topik_kod, stimulus_kind, stimulus_alt, prompt_en, accepted_answers, numeric_*, tolerance_*, word range, marks, scheme, bahasa, jenis_tulisan). Statuses describe the SRS text, not this register: after 1A every PARTIAL/MISSING row has a buildable [P] or [DECIDED] spec except the 22 MISSING-NO-SOURCE rows, whose specs are [P] by principle without any observed source (Bab/Topik/Subtopik forms, Tahap Pendidikan form, Rujuk Kawan settings, Cabutan and Kotak Misteri prize fields, Tournament).
Behaviour items (scope a to h): 8 areas × 8 columns = 64 cells; 8 not applicable; 56 applicable: COMPLETE 3, PARTIAL 39, MISSING 14 (cell grid in 5.1a); MISSING-NO-SOURCE 0. After 1A.10 the "b" (HTTP/network) column is specified for all 8 areas by ERR-* references.

**5.1a Reconciled behaviour grid (SRS status; N = not applicable).** Rows = areas, columns a messages / b HTTP+network / c empty+loading / d state machines / e calculations / f confirm dialogs / g paging+sort+bulk / h import+OCR.
| Area | a | b | c | d | e | f | g | h | C / P / M / N |
|---|---|---|---|---|---|---|---|---|---|
| Question entry (Q-03..05, Q-24) | P | M | P | C | P | M | P | N | 1 / 4 / 2 / 1 |
| Import and upload (Q-07..12) | P | M | P | P | N | M | P | P | 0 / 5 / 2 / 1 |
| Set, paper, Kontrak (Q-13..18) | C | M | P | P | P | P | P | P | 1 / 6 / 1 / 0 |
| Curriculum (C-01..05) | M | M | P | N | P | M | M | P | 0 / 3 / 4 / 1 |
| Content and settings (N-01..07) | P | M | P | P | P | P | P | N | 0 / 6 / 1 / 1 |
| Users (U-01..09) | P | M | P | P | P | C | P | P | 1 / 6 / 1 / 0 |
| Monitoring (M-01..08) | P | M | P | N | P | N | M | N | 0 / 3 / 2 / 3 |
| Gamification, rewards, marketplace, tiket (P2) | P | M | P | P | P | P | P | N | 0 / 6 / 1 / 1 |
| **Total** | | | | | | | | | **3 / 39 / 14 / 8** |
Check: 3+39+14+8 = 64. Counts are by row; Kawalan Ciri's 31 rows are counted individually. Option sets: 51 OPT-* defined in Part 1; 14 had no complete list in the SRS (Subjek 31 order, Tingkatan code, Jenis rangsangan, Jenis soalan stored values, Aras, KBAT override, Kod markah, Servability, Peranan, Banner, Video kategori, Kontrak mod, Jenis kertas, Kesukaran labels).

### 5.2 Top 20 gaps that would make a developer guess
1. Question types: SRS lists 8 BM labels but no stored values; contract `QUESTION_TYPES` has 5 other values (mcq, true_false, short_answer, fill_blank, essay) and leaf modes are 10. Mapping in OPT-JENIS-SOALAN is [P].
2. Stimulus kinds: SRS says "7 kinds" (rajah, petikan, jadual, graf, peta, carta, other); contract has 7 different (passage, image, diagram, table, map, infographic, graph); BM labels exist nowhere. Resolved in OPT-JENIS-RANGSANGAN.
3. Difficulty: SRS typed 1-5 (D-A6) versus DM 50 line 1242 "derived min(5,TP), never typed"; label sets (5-label vs 3-label) and the control type are unspecified.
4. Servability: SRS says 7 activities (adds `permainan`); code has 6 with different labels (`Latihan Bab` vs "Soalan by Chapter").
5. Question status vocabulary: four sets in play (Draft/Reviewed/Approved/Archived tiles; Draf/Menunggu Semakan/Diluluskan/Diarkibkan; contract comment Draf/Semakan/Diterbitkan/Diarkib; V2 Senarai Soalan 5 values incl. Ditolak).
6. Tajuk DSKP / SP / TP / aras controls: no option label format, no max-3 message, no behaviour when the unit list is empty or the parent changes.
7. MCQ options: SRS AC says 3 to 8 options, Quick Edit and CSV and the user's list say A-D, McqGate says minimum 2; the maximum number of rows is not stated for the wizard.
8. Kertas: two different things share the name (question `kertas` 1-3 vs picking a paper to place into); Kertas 4 exists in Kontrak/Subjektif but the contract enum stops at 3.
9. Muat Naik Kertas: QE5.1 omits Bahagian though QE5.2 uses it; `Jenis` has three incompatible sets (V2 Percubaan/Sebenar/Modul, `QUESTION_JENIS` 5, `INTAKE_PAPER_TYPES` 5); Set and Kod kertas have no format; Tahun/Negeri option lists not given.
10. CSV: header names conflict (V2 `body, option_a-d, correct` vs message `question_text, correct_answer`); `aras` column missing though aras is a publish gate; only MCQ possible; no row limit, no encoding error text, no partial-success report format.
11. Error handling (400/401/403/404/409/422/429/5xx, network, timeout): only the 429 principle exists; no copy, no rule that input is kept. GB-01 fills it.
12. Confirm dialogs: only V1/V2 strings for users, cabaran, produk, penjual, artikel, nota, kontrak, set and paper; none for Arkib, bulk status, group dissolve, batch cancel, `Arkib Semua` typed text.
13. Extraction outcomes: no job timeout value, no partial-page result, no per-page OCR failure copy, no duplicate-item handling (`exact/near/variant` exist only in code), no rule for re-upload.
14. Curriculum admin forms (Bab, Topik, Subtopik, Tahap Pendidikan create/edit) were never captured; validation messages in code are English Laravel templates that break NFR-2.
15. Kontrak: unit quotas, TP profile, KBAT quota, compulsory flag, evidence fields have no field list or limits; BM meaning of scheme codes K N P B M F C missing.
16. Sumber/Negeri/Tahun option lists: 22 vs 19 vs 16 negeri lists; Tahun range unspecified; stored value formats unspecified.
17. Gamification settings (Rujuk Kawan), Kotak Misteri, Tournament, Cabutan prize fields: no V2 capture and no contract fields read; specs are pure [P].
18. Roles: V2 filter lists 5 roles, create form 7 (V1) incl. `Pegawai JPN` not in the contract; `Penaja` and `Ibu Bapa` missing from the V2 role cards; ASSIGNABLE_ROLES rule not in SRS.
19. Kawalan Ciri: V2 shows `Zona Permainan` Off and the SRS says default ON; flag keys are not given; duplicate labels (Misi Harian, Prestasi) in two groups need distinct keys.
20. Calculations: rounding rules appear only by reference to 40 FR-X4 (not read here); Pelaras Token, tier percentages, liability, bonus board counts, sen vs RM storage are not specified.

### 5.3 Shared option sets used on several screens (defined once in Part 1)
OPT-SUBJEK (Q-02, Q-03, Q-04, Q-08, Q-10, Q-11, Q-13, Q-16, Q-17, Q-18, Q-19, Q-20, Q-23, C-01, C-02, N-01, N-04, U-07, P2-14, P2-17) · OPT-TINGKATAN (same screens plus U-02, U-03, U-05, U-08, U-09, N-02, N-04, P2-17) · OPT-STATUS-SOALAN (Q-02, Q-03, Q-04, Q-20, Q-24, Q-12, M-01) · OPT-KERTAS (Q-03, Q-04, Q-08, Q-11, Q-13, Q-16, Q-18, Q-19) · OPT-BAHAGIAN and OPT-PERATURAN (Q-04, Q-08, Q-14, Q-15, Q-16) · OPT-JENIS-KERTAS, OPT-NEGERI-KERTAS, OPT-TAHUN (Q-03, Q-08, Q-13, Q-14, Q-18, Q-19) · OPT-KESUKARAN-5/-3 (Q-03, Q-04, Q-11, Q-20, Q-24, P2-17) · OPT-TP, OPT-ARAS, OPT-KBAT-OVERRIDE (Q-04, Q-09, Q-11, Q-16, Q-23, P2-17) · OPT-JENIS-RANGSANGAN (Q-04, Q-05) · OPT-MOD-JAWAPAN (Q-04, Q-15, Q-16) · OPT-SERVABILITY (Q-03, Q-04, Q-05, Q-06, Q-14, Q-15) · OPT-DSKP-TAG (Q-03, Q-20) · OPT-PERANAN, OPT-BULK-ROLE, OPT-STATUS-AKAUN (U-01, U-02, U-03, U-06, P2-20) · OPT-NEGERI-SEKOLAH (U-04, M-03, M-04) · OPT-JENIS-SEKOLAH (U-04, U-02) · OPT-ARTIKEL-KATEGORI (N-02, P2-18) · OPT-GAM-TIER (P2-01, P2-02, P2-04) · OPT-AKTIF (C-02, C-03, N-03, N-05, N-06, U-04, P2-02, P2-03, P2-07).
Also defined once in GB: error-handling matrix (GB-01), loading/empty (GB-02), paging/sort/search (GB-03), confirm dialog template (GB-04), flash/audit (GB-05), import outcome (GB-06).

### 5.4 Method limits (honest)
- Not read: SRS 4.V register (73 rows), 4.R responsive section, 5, 6, 8; `40-cross-cutting` FR-X4 formulas; `60` payloads and `50` column names beyond the cited lines. Endpoint and DM names are cited only where the SRS or the grep of `60` gave them; screens without an API ID need the `60` row mapped by the developer.
- The V2 Panel captures (`.evidence/v2-screens/panel`) were not opened; Panel-only text comes from the SRS quotes.
- Prisma enums were not found by grep under `apps/api/prisma`; enums come from `packages/contract`.
- Every `[P]` spec is derived from the PRD principles and existing code constants, not from a source that proves it; none was verified in a browser.

