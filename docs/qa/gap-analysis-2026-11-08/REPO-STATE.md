# Keadaan Repo V3 "R1" — 2026-11-08

> Analisis baca-sahaja. Cabang `feature/v3-bijak-r1`, HEAD `b50fa8d41` (2026-11-07 11:37Z), folder `D:\Dev Projects\prestasiplus-v3`. Data GitHub dibaca dengan `gh` (baca sahaja) pada 2026-11-08 ~11:00 MYT. Gaya dan rujukan asas: `docs/qa/gap-analysis-2026-11-04/GAP-ANALYSIS-FULL.md`. Skrip dan data mentah ada di folder scratchpad `repo-state` (bukan dalam repo).

## 1. Ringkasan eksekutif

- **R1 tidak menutup jurang; ia menumpuk kerja yang belum disepadukan.** 393 PR digabung ke base sejak 2 Nov (35 pada 4 Nov, 199 pada 5 Nov, 140 pada 6 Nov, 18 pada 7 Nov), tetapi hanya **10 daripada 118 kad** memenuhi takrif "Siap (kod)" (semua bahagian digabung dan semua AC yang dirujuk kad ada bukti CI). 93 kad "Separa", 11 "Tersekat dalam PR", 4 "Belum mula".
- **Papan GitHub tidak lagi mencerminkan realiti.** 126 isu berlabel `r1` (118 kad + 8 susulan); hanya **1 ditutup** (#474, S10-T06) dan hanya 1 berlabel `status:done` — bukan 19/163 seperti dilaporkan lead (tidak dapat dihasilkan semula; lihat bahagian 7). Namun **103 kad sudah ada PR kod digabung**, dan 51 daripadanya masih berlabel `ready`/`in-progress`.
- **88 PR terbuka ke base** (45 draf, median umur 2.8 hari, maks 8.1 hari, 300,750 baris +/- dijumlahkan). **60 bercanggah** dengan base (disahkan dengan ujian gabung tempatan `git merge-tree`: 88/88 sepadan dengan status GitHub), 21 bersih tetapi CI `unstable`, 7 bersih. Cadangan: **Ambil 28, Ambil + selesai konflik 35, Buat semula 25, Tutup 0** (tiada PR yang fail-failnya sudah sama dengan base).
- **Punca konflik terbesar ialah fail daftar-kongsi, bukan kod:** `docs/plan/seed-profile.md` (20 PR), `packages/contract/openapi.json` (18), `docs/plan/r1-canonical-map.json` (15), `docs/plan/r1-ac-ledger.md` (11). Modul `gamification` dan `battle` pula bercanggah dalam 6-7 PR sekali gus.
- **Bukti AC:** buku besar ada 200 baris, semuanya `CI Pass` (197 AC unik), **0 baris UAT**, 0 Fail. Daripada **1,228 AC** yang ditakrif dalam PRD (kaedah kiraan saya, lihat bahagian 4) itu **16.0%**. Penyebut 270 yang disebut lead tidak dapat dihasilkan semula.
- **Pelayan UAT** masih di `e34e0a52d` (3 Nov): ketinggalan **502 komit, 48 migrasi (51 -> 99), 2,668 fail**; tiada AC UAT boleh dibuktikan.
- **Pengesahan tempatan HEAD:** contract:check, contract-tests, be:lint, be:lint:migration, be:typecheck, be:build semuanya exit 0; vite build demo 0; typecheck 0. be:test: **belum selesai semasa laporan ditulis** (log `be_test.log` tiada baris ringkasan `Test Files`/`Tests`; ukuran tangkapan 11:19 MYT: 10 fail ujian dengan kegagalan, 106 ujian gagal setakat ini; lihat bahagian 6). Ujian unit FE: 13,458 lulus / 5 gagal — 3 daripada 5 ialah artifak CRLF Windows (`core.autocrlf=true`), bukan kecacatan kod; lint FE gagal (kehabisan heap JS + "ratchet FAILED").
- **Punca ringkas (bahagian 6):** kadar gabung melebihi kadar semakan (0 kelulusan rasmi, 3 akaun penggabung, base tanpa perlindungan cabang); masa-ambil PR median 2.6 jam (4 Nov) -> 31.1 jam (7 Nov) kerana baris gilir konflik dalam 4 fail kongsi; label status tidak dikemas kini; UAT tidak pernah dideploy semula.

## 2. Kaedah dan had (baca dahulu)

- **Kad:** 118 kad diekstrak daripada `docs/plan/r1-development-plan.md` (bahagian 4). Sprint ialah sprint dalam jadual sprint pelan; jika kad tiada dalam jadual, milestone isu digunakan (format `pelan/isu`).
- **PR -> kad:** padanan `S<n>-T<nn>[a|b]` dalam tajuk PR atau nama cabang (julat seperti `S3-T01-T02` dikembangkan). 25 PR digabung dan 4 PR terbuka tidak ada ID kad (contoh #886, #814 CI workflow; #795 docs; #405 sweep QA). PR "ledger"/"docs" dikira berasingan (`+N doc`) dan tidak dikira sebagai kerja kod.
- **Kelas kad (heuristik, boleh disemak semula):** *Siap (kod)* = ada >=1 PR kod digabung, tiada PR kod terbuka (termasuk bertindan), ada baris CI buku besar, dan setiap AC yang disebut dalam teks kad (selepas mengembangkan `AC-xxx-*`) ada baris CI Pass. *Separa* = ada PR kod digabung tetapi ada PR terbuka atau AC dirujuk belum lengkap. *Tersekat dalam PR* = tiada PR kod digabung, ada PR terbuka. *Belum mula* = tiada PR kod langsung. **Had:** teks kad hanya menyebut sebahagian AC; "Siap" mungkin terlalu longgar untuk kad yang hampir tiada AC dirujuk (contoh S4-T07, S5-T14, S6-T08 menunjukkan 0/0) dan "Separa" mungkin terlalu ketat untuk kad dengan AC dibuktikan melalui ujian bukan-buku besar. Ia bukan pengganti semakan AC-demi-AC.
- **"Siap" bukan bermaksud diterima:** tiada kad ada bukti UAT, jadi tiada kad memenuhi DoD penuh (`[CI+UAT]`).
- **Ujian gabung:** `git merge-tree --write-tree HEAD <PR-head>` terhadap base `b50fa8d41` (tidak mengubah folder kerja). "Fail daftar-kongsi" = 4 fail di atas yang boleh dijana semula/digabung manual.
- **Cadangan PR (peraturan mekanikal):** Tutup jika >=80% fail PR sudah serupa dengan base; Ambil jika tiada konflik; Ambil + selesai konflik jika konflik hanya pada fail daftar-kongsi/ledger, atau <=5 fail kod dan <=3,000 baris; selainnya Buat semula. Semakan manusia masih perlu, terutama untuk PR "bersih (CI unstable)".


## 3. Jadual kad (118 kad)

Pecahan kelas: **Siap (kod) 10 · Separa 93 (30 ada PR terbuka; 63 tiada PR terbuka tetapi AC belum lengkap, daripadanya 39 tiada baris buku besar langsung dan 24 ada sebahagian) · Tersekat dalam PR 11 · Belum mula 4**.

Mengikut keutamaan: P0 (69 kad): Siap 3, Separa 60, Tersekat 3, Belum mula 3. Sprint 0-3 mengikut pelan (70 kad, sepatutnya sudah selesai pada sprint ke-4): Siap 5, Separa 60, Tersekat 2, Belum mula 3.

- Siap (kod): S2-T09 (P2), S4-T02 (P0), S4-T07 (P0), S5-T07, S5-T08 (P0), S5-T13, S5-T14 (P2), S6-T08, S6-T10, S7-T08 (P2). Hanya 3 daripada 10 ialah P0 (S4-T02, S4-T07, S5-T08); kad rangka P0 teras (S1, S3-T02/T04, S5-T15) masih "Separa".
- Tersekat dalam PR: S0-T07 (P0), S0-T10, S0-T11, S2-T05, S2-T10 (P0), S6-T12 (P0), S6-T15, S6-T19, S7-T03, S7-T10, S7-T11.
- Belum mula: S9-T01, S9-T02, S9-T05 (kad berulang tanpa PR) dan S10-T06 (isu ditutup `done`, tiada PR padanan; lihat bahagian 8).

Lajur: **Sprint plan/isu** = sprint menurut jadual pelan / milestone isu. **PR kod digabung** = bilangan PR bukan-doc/ledger dan 3 terakhir. **PR terbuka** = ke `feature/v3-bijak-r1`. **PR bertindan** = ke cabang `r1/*` lain. **AC dirujuk kad: CI/jumlah** = AC dalam teks kad yang ada baris CI Pass / jumlah AC dirujuk (heuristik, bahagian 2).

| Kad | Tajuk | Pri | Sprint plan/isu | Isu (status) | PR kod digabung | PR terbuka (base R1) | PR bertindan | AC dirujuk kad: CI/jumlah | Baris CI buku besar | Kelas |
|---|---|---|---|---|---|---|---|---|---|---|
| S0-T01 | Governance setup | P0 | 0/0 | #407 in-review | 4 (#1050 #547 #525) | - | - | 0/0 | 0 | Separa |
| S0-T02 | Stack boots with no manual step | P0 | -/0 | #408 in-review | 2 (#625 #529) | #789 | - | 0/0 | 0 | Separa |
| S0-T03 | Jobs worker and OCR configured | P0 | -/0 | #409 in-review | 1 (#575) | - | - | 0/0 | 0 | Separa |
| S0-T04 | Repo checks in CI: placeholder strings and R1 traceability | P0 | 4/0 | #410 in-progress | 6 (#582 #574 #524) | - | - | 0/1 | 0 | Separa |
| S0-T05 | Retire prototype scope | P0 | 1/1 | #411 in-review | 4 (#619 #597 #542) | - +1 doc | - | 0/3 | 0 | Separa |
| S0-T06 | Nav integrity and sidebar walk | P0 | -/1 | #412 in-review | 3 (#706 #674 #548) | - | - | 0/8 | 0 | Separa |
| S0-T07 | Target admin menu | P0 | 2/2 | #413 ready | 0 | #904 #779 | - | 0/0 | 0 | Tersekat dalam PR |
| S0-T08 | Rate limits and 429 UX | P1 | -/0 | #414 in-review | 2 (#618 #556) | - | - | 0/0 | 0 | Separa |
| S0-T09 | Mock-path audit | P1 | 2/2 | #415 in-review | 1 (#552) | - | - | 0/0 | 0 | Separa |
| S0-T10 | Kawalan Ciri (minimum) | P1 | 4/4 | #416 ready | 0 | #907 | - | 0/1 | 0 | Tersekat dalam PR |
| S0-T11 | Kawalan Ciri full and go-live switch-over | P1 | -/8 | #417 ready | 0 | #914 | - | 0/0 | 0 | Tersekat dalam PR |
| S0-T12 | Error handling: envelope, transport, global states and the E | P1 | 1/- | #557 in-progress | 6 (#614 #585 #584) +1 doc | #713 #686 #678 | - | 0/1 | 3 | Separa |
| S1-T01 | Stimulus group invariants end to end | P0 | 0/0 | #418 in-review | 11 (#538 #537 #536) +1 doc | - +1 doc | - | 2/7 | 11 | Separa |
| S1-T02 | Itemised completeness and DSKP-aware validation | P0 | -/1 | #419 in-review | 2 (#662 #622) +1 doc | #783 +1 doc | - | 2/7 | 2 | Separa |
| S1-T03 | Extraction keeps groups and paper structure | P0 | 2/2 | #420 in-progress | 2 (#825 #824) | - | - | 0/14 | 0 | Separa |
| S1-T04 | Intake timeout, error state, manual Terima | P0 | -/2 | #421 in-progress | 4 (#826 #807 #801) | - | - | 0/1 | 0 | Separa |
| S1-T05 | CSV with DSKP and group fields | P0 | -/2 | #422 in-progress | 4 (#726 #719 #704) +1 doc | - +1 doc | #973 | 0/3 | 1 | Separa |
| S1-T06 | Group-safe assembly | P0 | 3/3 | #423 in-review | 6 (#616 #612 #596) +1 doc | - +1 doc | - | 1/5 | 2 | Separa |
| S1-T07 | Servability indicator and stimulus flags | P0 | -/2 | #424 in-progress | 5 (#802 #673 #626) | - +1 doc | - | 0/4 | 0 | Separa |
| S1-T08 | Kiriman Guru backend | P0 | 4/2 | #425 in-progress | 3 (#701 #587 #535) | - +1 doc | - | 0/14 | 0 | Separa |
| S1-T09a | Answer-mode kinds and the marking-scheme editor (backend) | P0 | -/- | #558 in-progress | 2 (#692 #679) | #698 | #885 #820 #730 #710 | 0/2 | 0 | Separa |
| S1-T09b | Bilingual questions, drawing and table_fill | P0 | -/- | #559 in-progress | 1 (#925) | - | - | 0/1 | 0 | Separa |
| S1-T10 | Accepted batch becomes a draft paper (Semak & Terbit) | P0 | -/3 | #427 in-progress | 1 (#833) | #859 | - | 0/5 | 0 | Separa |
| S2-T01 | Studio list, wizard, group-first entry | P0 | 2/2 | #428 in-progress | 1 (#788) | #685 | - | 0/14 | 0 | Separa |
| S2-T02 | Import & Semakan (3 tabs) and Semak Ekstrak | P0 | -/2 | #429 in-progress | 3 (#1072 #932 #723) | - | - | 0/12 | 0 | Separa |
| S2-T03 | One bank, one queue, aliases | P0 | 0/0 | #430 in-review | 2 (#629 #540) +1 doc | #929 | - | 0/0 | 1 | Separa |
| S2-T04 | Regroup work-list | P0 | 3/3 | #431 in-progress | 1 (#703) | - | - | 0/1 | 0 | Separa |
| S2-T05 | Manual entry, CSV import UI, Quick Edit | P1 | 4/2 | #432 in-progress | 0 | #793 | - | 0/0 | 0 | Tersekat dalam PR |
| S2-T06 | Senarai Soalan tabs and Soalan Berstruktur | P1 | -/4 | #433 in-progress | 1 (#607) | - | #636 #630 | 0/0 | 0 | Separa |
| S2-T07 | Responsive pass: admin question screens | P0 | -/2 | #434 in-review | 1 (#572) +1 doc | - | - | 0/2 | 0 | Separa |
| S2-T08 | Bulk "Tetapkan Bab" UI | P1 | -/3 | #435 in-progress | 1 (#830) | - | - | 0/5 | 0 | Separa |
| S2-T09 | Sumber Kertas | P2 | -/3 | #436 ready | 1 (#883) +1 doc | - | - | 1/1 | 1 | Siap (kod) |
| S2-T10 | Leaf forms for every answer mode and the marking-scheme edit | P0 | -/- | #561 in-progress | 0 | #855 | - | 0/21 | 0 | Tersekat dalam PR |
| S3-T01 | Kontrak: "Disahkan" selectable and honest | P0 | 1/1 | #437 in-review | 3 (#681 #654 #653) | - +1 doc | - | 0/5 | 0 | Separa |
| S3-T02 | One Set Builder | P0 | 3/2 | #438 in-review | 3 (#776 #775 #774) | - +1 doc | - | 0/13 | 0 | Separa |
| S3-T03 | SPM hub with 6 lanes | P0 | -/1 | #439 in-review | 5 (#606 #555 #550) | - | - | 0/0 | 0 | Separa |
| S3-T04 | Pupil sitting and result (Bijak SPM) | P0 | -/3 | #440 in-progress | 5 (#895 #894 #893) | #959 #951 #944 #899 #896 | #897 | 0/34 | 0 | Separa |
| S3-T05 | Tracking A | P0 | 3/3 | #441 in-progress | 1 (#716) | #717 | #718 | 0/3 | 0 | Separa |
| S3-T06 | Kertas Subjektif and self-mark | P0 | 4/4 | #442 ready | 11 (#827 #821 #813) +1 doc | - | - | 2/4 | 5 | Separa |
| S3-T07 | Pupil SPM hub, Databank | P1 | -/4 | #443 in-progress | 8 (#849 #842 #841) +1 doc | - | - | 0/3 | 2 | Separa |
| S3-T08 | Terbit pipeline (dry-run tooling for UAT) | P0 | -/3 | #444 in-review | 1 (#812) | - | - | 0/0 | 0 | Separa |
| S4-T01 | CI test seed profile (not acceptance data) | P0 | 0/0 | #445 in-review | 1 (#589) | #680 | - | 0/0 | 0 | Separa |
| S4-T02 | DSKP loader verified; T1–T5 content | P0 | -/0 | #446 in-review | 2 (#532 #531) +2 doc | - | - | 1/1 | 2 | Siap (kod) |
| S4-T03 | Bab/Topik/SP mapping tool and bulk API | P0 | 1/1 | #447 in-review | 5 (#642 #640 #639) +1 doc | #680 | - | 3/4 | 3 | Separa |
| S4-T04 | Regroup data operations and duplicate-stem cleanup | P0 | -/1 | #448 in-progress | 4 (#930 #850 #715) | #880 | - | 0/0 | 0 | Separa |
| S4-T05 | Darjah deactivation (Tingkatan 1–5 only) | P0 | -/0 | #449 in-review | 3 (#578 #527 #526) | - | - | 0/1 | 0 | Separa |
| S4-T06 | T1–T5 learning served (BE) | P0 | 2/2 | #450 in-progress | 7 (#763 #727 #699) +2 doc | - | - | 1/2 | 1 | Separa |
| S4-T07 | Kurikulum admin UI | P0 | 5/2 | #451 in-review | 2 (#659 #658) | - | - | 0/0 | 1 | Siap (kod) |
| S4-T08 | UAT data-operations pack | P0 | 3/3 | #452 in-progress | 4 (#956 #850 #747) | - | - | 0/0 | 0 | Separa |
| S4-T09 | DSKP structure for T1-T3 and for every SPM subject offered | P1 | 4/6 | #453 in-progress | 1 (#878) | #680 | - | 0/4 | 0 | Separa |
| S5-T01 | T1–T3 pupils get practice (FE) | P0 | 2/2 | #454 ready | 1 (#785) +1 doc | - | - | 0/3 | 0 | Separa |
| S5-T02 | Soalan by Chapter | P0 | 3/3 | #455 ready | 1 (#800) +1 doc | - | - | 1/4 | 2 | Separa |
| S5-T03 | Latih Tubi | P0 | -/3 | #456 ready | 1 (#853) | - | - | 0/15 | 0 | Separa |
| S5-T04 | Dashboard murid | P1 | -/2 | #457 in-progress | 8 (#731 #568 #566) +3 doc | - | - | 2/3 | 8 | Separa |
| S5-T05 | Profil, Tetapan, Panduan for all roles | P1 | 4/1 | #458 in-progress | 5 (#601 #598 #571) +1 doc | - | - | 1/5 | 1 | Separa |
| S5-T06 | Laporan Soalan (pupil) | P0 | -/1 | #459 in-review | 3 (#693 #595 #593) +1 doc | - | - | 4/7 | 4 | Separa |
| S5-T07 | Remedial auto-generated | P1 | -/3 | #460 in-progress | 2 (#887 #844) | - | - | 3/3 | 6 | Siap (kod) |
| S5-T08 | Video and Kelas Saya (pupil) and Video admin list | P0 | 0/0 | #461 in-review | 7 (#676 #565 #530) +2 doc | - | - | 1/1 | 10 | Siap (kod) |
| S5-T09 | Perutusan, Artikel, Banner, Nota | P2 | -/4 | #462 in-review | 2 (#871 #867) | - | - | 0/1 | 0 | Separa |
| S5-T10 | Shell and Log Keluar (all roles) | P0 | -/6 | #463 in-review | 2 (#872 #697) +1 doc | - | - | 0/12 | 0 | Separa |
| S5-T11 | Soalan Berstruktur and Set Soalan Guru (pupil) | P1 | -/4 | #464 in-progress | 6 (#840 #839 #834) +1 doc | - | - | 0/3 | 2 | Separa |
| S5-T12 | Artikel, Topik, Peta Belajar, Audio KBAT (pupil) | P1 | 5/5 | #465 in-progress | 2 (#804 #797) +1 doc | - | - | 0/1 | 6 | Separa |
| S5-T13 | PKSK (pupil) answering flow | P1 | -/7 | #466 in-progress | 3 (#1020 #847 #832) +2 doc | - | - | 4/4 | 5 | Siap (kod) |
| S5-T14 | Admin Sekolah Profil, Tetapan, Panduan | P2 | -/8 | #467 ready | 1 (#922) +1 doc | - | - | 0/0 | 6 | Siap (kod) |
| S5-T15 | Single answer store: mode column and write path | P0 | 1/2 | #468 in-review | 6 (#649 #546 #545) +1 doc | - | - | 0/2 | 2 | Separa |
| S10-T01 | Prestasi 360 (pupil own data) | P0 | 1/1 | #469 in-progress | 6 (#881 #865 #544) +1 doc | - | - | 1/11 | 1 | Separa |
| S10-T02 | Headcount (backend rules for all roles, teacher screens) | P0 | -/1 | #470 in-review | 2 (#1066 #787) | - | - | 0/17 | 0 | Separa |
| S10-T03 | Analisa Item (pupil, guru, school admin) | P0 | -/1 | #471 in-review | 2 (#1006 #750) | - | #906 | 0/7 | 0 | Separa |
| S10-T04 | Analitik Adaptif (guru, school admin) and SP data | P0 | 2/1 | #472 in-review | 5 (#920 #892 #725) +1 doc | - | - | 5/14 | 8 | Separa |
| S10-T05 | Heatmap Topik Lemah | P1 | 3/3 | #473 ready | 2 (#828 #810) | - | #851 | 0/1 | 0 | Separa |
| S10-T06 | Remaining m08 modules real-API only | P1 | 4/4 | #474 done | 0 | - | - | 0/0 | 1 | Belum mula |
| S10-T07 | Prestasi (guru, school admin) | P1 | -/4 | #475 in-review | 4 (#877 #857 #843) | - | - | 0/3 | 0 | Separa |
| S10-T08 | Timeline Saya (pupil) | P2 | -/8 | #476 in-review | 1 (#868) | - | - | 0/1 | 0 | Separa |
| S10-T09 | Headcount: pupil and school-admin read views | P0 | -/- | #560 in-review | 1 (#806) | - | - | 0/16 | 0 | Separa |
| S6-T01 | Laporan Mingguan Guru | P0 | 1/1 | #477 in-review | 3 (#664 #634 #633) +1 doc | - | - | 10/11 | 10 | Separa |
| S6-T02 | Kirkpatrick: school admin 7 screens, guru shell | P0 | -/1 | #478 in-review | 2 (#672 #648) +1 doc | - | - | 9/19 | 9 | Separa |
| S6-T03 | Cross-screen numbers (XS-1..8) | P0 | 2/1 | #479 in-review | 7 (#1006 #754 #645) +1 doc | #1061 | - | 4/7 | 4 | Separa |
| S6-T04 | Amaran Awal no-data | P0/P1 | -/1 | #480 in-review | 3 (#1028 #690 #650) +1 doc | - | - | 6/7 | 6 | Separa |
| S6-T05 | UAT school-admin account and preconditions | P0 | 0/0 | #481 in-review | 1 (#632) | - | - | 0/1 | 1 | Separa |
| S6-T06 | Sumbang Soalan: paper submit (guru) | P1 | 4/2 | #482 in-progress | 7 (#739 #705 #684) +1 doc | - | - | 12/15 | 12 | Separa |
| S6-T07 | Command Center, Dashboards and Misi Harian (guru, AS) | P1 | 3/3 | #483 in-review | 5 (#647 #643 #641) | #687 #670 #669 #666 #665 | - | 0/4 | 0 | Separa |
| S6-T08 | Monitoring (guru, AS, admin) | P1 | -/3 | #484 in-review | 4 (#811 #733 #724) +1 doc | - | - | 0/0 | 10 | Siap (kod) |
| S6-T09 | School-admin reports and lists (46–53) | P1 | 2/4 | #485 in-review | 2 (#695 #671) | #735 #696 | - | 0/1 | 0 | Separa |
| S6-T10 | Guru lists and reports | P1 | -/4 | #486 in-review | 4 (#753 #746 #745) +1 doc | - | - | 3/3 | 11 | Siap (kod) |
| S6-T11 | Admin Pusat users, schools, classes, central dashboards | P1 | -/4 | #487 in-review | 2 (#712 #711) | #752 #751 | #949 | 0/0 | 0 | Separa |
| S6-T12 | Admin Pusat Pengguna and Sekolah (U-01..U-04) | P0 | 2/2 | #488 in-review | 0 | #663 #656 | - | 0/4 | 0 | Tersekat dalam PR |
| S6-T14 | Teacher Set Soalan and Kelas Saya (guru) | P1 | 4/4 | #489 in-review | 3 (#768 #767 #759) | #836 #835 #809 | - | 0/2 | 0 | Separa |
| S6-T15 | Jemput Ibu Bapa and Pautan Ibu Bapa admin | P2 | -/8 | #490 in-review | 0 | #748 | - | 0/1 | 0 | Tersekat dalam PR |
| S6-T13 | Central reports and Admin Sekolah Dashboard | P2 | -/8 | #491 in-progress | 4 (#988 #822 #798) | - | - | 0/2 | 0 | Separa |
| S6-T16 | Soalan & Rujukan (guru: personal MCQ with a reference link) | P1 | 5/5 | #492 in-progress | 6 (#780 #772 #764) +1 doc | - | - | 9/10 | 9 | Separa |
| S6-T17 | Soalan Berstruktur (guru: list, detail, submit) | P1 | -/5 | #493 in-progress | 10 (#756 #755 #744) +1 doc | - | - | 7/9 | 7 | Separa |
| S6-T18 | Soalan Gambar Rajah (guru access to the diagram audit) | P1 | -/5 | #494 in-progress | 5 (#667 #661 #657) +1 doc | - | - | 5/6 | 5 | Separa |
| S6-T19 | Databank Soalan (guru) | P1 | -/5 | #495 in-review | 0 | #762 #761 | - | 0/7 | 0 | Tersekat dalam PR |
| S6-T20 | Kertas Peperiksaan (guru) | P1 | 4/5 | #496 in-progress | 1 (#638) | - | - | 0/6 | 0 | Separa |
| S7-T01 | Permainan (pupil) on real API | P1 | 4/4 | #497 ready | 5 (#702 #675 #588) | #1016 #1015 #1014 #1011 #1010 #991 +6 | - | 0/4 | 0 | Separa |
| S7-T02 | Sekolah Bersaing (school admin) | P0 | 1/1 | #498 in-review | 5 (#551 #541 #539) +1 doc | #936 | - | 4/6 | 4 | Separa |
| S7-T03 | Tetapan Permainan (admin) | P1 | -/4 | #499 in-progress | 0 | #736 | - | 0/0 | 0 | Tersekat dalam PR |
| S7-T04 | Syiling, Tukar Token, Cabaran Harian, Pencapaian + admin Gam | P1 | 5/5 | #500 ready | 10 (#728 #722 #721) +1 doc | #1025 #1022 #1004 #998 #969 #964 +1 | - | 0/0 | 0 | Separa |
| S7-T05 | Coin rate and reward backend (Kawalan Reward settings, Kedai | P1 | 2/5 | #501 in-review | 12 (#602 #581 #554) | #982 | - | 0/3 | 0 | Separa |
| S7-T06 | Papan Pendahulu, Kedudukan, Tournament + admin views | P1 | -/5 | #504 ready | 1 (#946) | #794 | #1021 | 0/22 | 0 | Separa |
| S7-T07 | Cabutan Bertuah, Kotak Misteri, Rujuk Kawan | P2 | -/7 | #505 ready | 2 (#1033 #963) | #972 #958 #953 #903 #864 | #1053 | 0/0 | 0 | Separa |
| S7-T08 | Marketplace (pupil + admin) | P2 | -/7 | #506 in-review | 2 (#912 #911) +1 doc | - | - | 1/1 | 7 | Siap (kod) |
| S7-T09 | Tetapan (support contact) and admin Tiket Bantuan | P1 | -/4 | #507 in-progress | 6 (#609 #608 #603) | #660 | - | 0/0 | 0 | Separa |
| S7-T10 | Tiket Bantuan (pupil, guru, school admin) | P2 | -/8 | #508 in-progress | 0 | #682 | - | 0/2 | 0 | Tersekat dalam PR |
| S7-T11 | Kedai Hadiah, Kedai Hadiah Digital, Tebusan and Kawalan Rewa | P1 | -/- | #562 ready | 0 | #984 #758 | - | 0/0 | 0 | Tersekat dalam PR |
| S8-T01 | Move shared display components behind one barrel | P0 | 0/0 | #509 in-review | 2 (#563 #528) | - | - | 0/0 | 0 | Separa |
| S8-T02 | Stimulus panel: once, sticky, zoomable | P0 | 1/1 | #510 in-review | 5 (#594 #592 #579) +1 doc | - | - | 0/1 | 2 | Separa |
| S8-T03 | Answer widgets and maths input | P0 | 3/2 | #511 ready | 2 (#709 #694) +1 doc | #919 #913 #700 | - | 0/0 | 1 | Separa |
| S8-T04 | Navigator, timer, Hantar on phone | P0 | -/3 | #512 in-review | 2 (#613 #573) +1 doc | - | - | 0/1 | 2 | Separa |
| S8-T05 | Paper view (cover, review, result, preview) | P1 | 4/3 | #513 in-review | 2 (#631 #599) | - | - | 0/0 | 0 | Separa |
| S8-T06 | DS primitives: table→cards, forms, two-pane→tabs | P0 | -/0 | #514 in-review | 5 (#577 #534 #533) | - | - | 0/0 | 0 | Separa |
| S8-T07 | Accessibility and copy audit of the question-paper and shell | P1 | -/4 | #515 ready | 3 (#901 #709 #706) | - | - | 0/0 | 0 | Separa |
| S9-T01 | Per-sprint UAT acceptance walk | P0 | -/1 | #516 ready | 0 | - | - | 0/0 | 0 | Belum mula |
| S9-T02 | V2 side-by-side check, evidence kept private | P0 | -/1 | #517 ready | 0 | - | - | 0/0 | 0 | Belum mula |
| S9-T03 | Cross-module (XL) integration pass | P0 | 6/6 | #518 in-review | 1 (#766) | - | - | 0/0 | 0 | Separa |
| S9-T04 | Release checklist | P0 | 6/6 | #519 ready | 1 (#784) | - | - | 0/0 | 0 | Separa |
| S9-T05 | Sprint review demo with the user | P0 | -/1 | #520 ready | 0 | - | - | 0/0 | 0 | Belum mula |
| S9-T06 | End-to-end data chains AC-CHAIN-1..10 | P0 | 1/3 | #521 ready | 1 (#770) | - | - | 0/2 | 0 | Separa |

## 4. PR terbuka

### 4.1 Ke `feature/v3-bijak-r1` (88)

Cadangan: **Ambil 28 · Ambil + selesai konflik 35 · Buat semula 25 · Tutup 0**. Draf: 45. Saiz: <200 baris 17, 200-999 22, 1,000-4,999 30, >=5,000 19. "Umur" dari tarikh dicipta hingga 2026-11-08 11:00Z. "Konflik" = hasil `git merge-tree` terhadap `b50fa8d41`.

| PR | Kad | Judul (ringkas) | Draf | +/- | Fail | Umur (hari) | Mergeable | Konflik (fail kod / fail daftar-kongsi) | Cadangan | Sebab |
|---|---|---|---|---|---|---|---|---|---|---|
| #405 | (tiada) | test(qa): B4 sweep on BASE-3 (H-B1 unit sweep + B-01/02/04/05 re-test) | tidak | +59/-0 | 14 | 8.1 | bersih | - | **Ambil** | bersih |
| #656 | S6-T12 | S6-T12 Admin Pusat Pengguna and Sekolah (U-01..U-04) | ya | +881/-111 | 45 | 3.3 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #660 | S7-T09 | S7-T09 Tetapan and admin Tiket Bantuan (part support hours) | tidak | +142/-46 | 25 | 3.3 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #663 | S6-T12 | S6-T12 Admin Pusat Pengguna and Sekolah (U-01..U-04) part account (cro | ya | +123/-101 | 26 | 3.3 | konflik | 4 kod (account/profile.service.ts, account/profile.spec.ts, account/registration-referral.spec.ts, ...) / 0 kongsi | **Ambil + selesai konflik** | 4 fail kod bercanggah, saiz kecil |
| #665 | S6-T07 | S6-T07 Command Center, Dashboards and Misi Harian part page | ya | +1790/-99 | 14 | 3.3 | konflik | 1 kod (api/guru.ts) / 0 kongsi | **Ambil + selesai konflik** | 1 fail kod bercanggah, saiz kecil |
| #666 | S6-T07 | S6-T07 Command Center, Dashboards and Misi Harian part scope (S0) | ya | +15/-5 | 4 | 3.3 | konflik | 2 kod (__tests__/prototype-scope.test.ts, nav/user-nav.ts) / 0 kongsi | **Ambil + selesai konflik** | 2 fail kod bercanggah, saiz kecil |
| #669 | S6-T07 | S6-T07 Command Center, Dashboards and Misi Harian part reward | ya | +1814/-25 | 18 | 3.3 | konflik | 5 kod (missions/missions.controller.ts, missions/missions.service.ts, missions/practice-assignments.adapter.ts, ...) / 1 kongsi | **Ambil + selesai konflik** | 5 fail kod bercanggah, saiz kecil |
| #670 | S6-T07 | S6-T07 Command Center, Dashboards and Misi Harian part reward payment  | ya | +1923/-28 | 24 | 3.3 | konflik | 6 kod (missions/missions.constants.ts, missions/missions.controller.ts, missions/missions.service.ts, ...) / 1 kongsi | **Buat semula** | 6 fail kod bercanggah, 1951 baris, ketinggalan 280 komit |
| #678 | S0-T12 | S0-T12 global error UI: offline banner, 401 return with kembali, submi | tidak | +1293/-32 | 20 | 3.3 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #680 | S4-T09, S4-T01, S4-T03 | S4-T09 T1-T3 Bab-level DSKP structure from the V3 chapter data (part A | tidak | +11814/-62 | 39 | 3.3 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #682 | S7-T10 | S7-T10 Tiket Bantuan (part rulings: chips, contact, no notice, no Urus | tidak | +301/-347 | 26 | 3.3 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #685 | S2-T01 | S2-T01 Studio list, wizard, group-first entry (parts 1 to 3) | tidak | +2168/-709 | 44 | 3.3 | bersih | - | **Ambil** | bersih |
| #686 | S0-T12 | S0-T12 login 429 countdown with the submit disabled (AC-ERR-3, part D3 | ya | +1403/-38 | 22 | 3.3 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #687 | S6-T07 | S6-T07 Command Center, Dashboards and Misi Harian part global list | ya | +2174/-28 | 30 | 3.3 | konflik | 8 kod (missions/missions.constants.ts, missions/missions.controller.ts, missions/missions.service.ts, ...) / 1 kongsi | **Buat semula** | 8 fail kod bercanggah, 2202 baris, ketinggalan 280 komit |
| #696 | S6-T09 | S6-T09 School-admin reports and lists (part B reports) | ya | +3504/-794 | 92 | 3.3 | konflik | 31 kod (board/board.service.ts, shared/math.ts, school-admin/dashboard.mapper.ts, ...) / 0 kongsi | **Buat semula** | 31 fail kod bercanggah, 4298 baris, ketinggalan 316 komit |
| #698 | S1-T09a | S1-T09a Answer-mode kinds and the marking-scheme editor (backend) (par | ya | +664/-13 | 12 | 3.3 | konflik | 1 kod (questions/tree.ts) / 0 kongsi | **Ambil + selesai konflik** | 1 fail kod bercanggah, saiz kecil |
| #700 | S8-T03 | S8-T03 part 2: mcq_multi, true_false, ClozeGaps, TableFillGrid | ya | +9409/-384 | 54 | 3.2 | konflik | 11 kod (builder/question-bank.source.ts, overview/overview.repository.ts, questions/bijak-pool.ts, ...) / 1 kongsi | **Buat semula** | 11 fail kod bercanggah, 9793 baris, ketinggalan 323 komit |
| #713 | S0-T12 | S0-T12 profile and settings saves use the submit lock; profile keeps a | ya | +1551/-60 | 24 | 3.2 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #717 | S3-T05 | S3-T05 Tracking A (part 2: backend) | tidak | +1153/-92 | 34 | 3.2 | konflik | 1 kod (uat-ops/uat-scripts.spec.ts) / 0 kongsi | **Ambil + selesai konflik** | 1 fail kod bercanggah, saiz kecil |
| #735 | S6-T09 | S6-T09 School-admin reports and lists (part C Import Pelajar) | ya | +4057/-394 | 84 | 3.2 | konflik | 21 kod (board/board.service.ts, shared/math.ts, school-admin/dashboard.mapper.ts, ...) / 0 kongsi | **Buat semula** | 21 fail kod bercanggah, 4451 baris, ketinggalan 316 komit |
| #736 | S7-T03 | S7-T03 Tetapan Permainan settings, spin segments and game list | ya | +3375/-138 | 31 | 3.2 | konflik | 2 kod (__tests__/games.test.ts, games/common.ts) / 0 kongsi | **Buat semula** | 2 fail kod bercanggah, 3513 baris, ketinggalan 221 komit |
| #737 | S7-T04 | S7-T04 Syiling and Cabaran Harian (parts 9 and 10, Tukar Token) | ya | +825/-173 | 21 | 3.2 | konflik | 2 kod (gamification/gamification.controller.ts, handlers/student.ts) / 0 kongsi | **Ambil + selesai konflik** | 2 fail kod bercanggah, saiz kecil |
| #748 | S6-T15 | S6-T15 Jemput Ibu Bapa and Pautan Ibu Bapa admin | ya | +1839/-198 | 56 | 3.1 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #751 | S6-T11 | S6-T11 Admin Pusat users, schools, classes, central dashboards | tidak | +4382/-90 | 45 | 3.1 | konflik | 1 kod (reports/classes.service.ts) / 1 kongsi | **Buat semula** | 1 fail kod bercanggah, 4472 baris, ketinggalan 35 komit |
| #752 | S6-T11 | S6-T11 Admin Pusat users, schools, classes, central dashboards part me | tidak | +4461/-136 | 52 | 3.1 | konflik | 1 kod (reports/classes.service.ts) / 1 kongsi | **Buat semula** | 1 fail kod bercanggah, 4597 baris, ketinggalan 35 komit |
| #758 | S7-T11 | S7-T11 Admin Hadiah and Tebusan screens (part 1) | ya | +3674/-298 | 36 | 3.1 | konflik | 5 kod (shop/hadiah.input.ts, shop/shop.service.ts, shop/admin.spec.ts, ...) / 0 kongsi | **Buat semula** | 5 fail kod bercanggah, 3972 baris, ketinggalan 182 komit |
| #761 | S6-T19 | S6-T19 Databank Soalan (guru) | tidak | +2258/-4 | 20 | 3.1 | konflik | 1 kod (__tests__/classes.test.ts) / 1 kongsi | **Ambil + selesai konflik** | 1 fail kod bercanggah, saiz kecil |
| #762 | S6-T19 | S6-T19 Databank Soalan (guru) part nav (cross-sector S0) | ya | +3229/-60 | 57 | 3.1 | konflik | 23 kod (classes/classes.module.ts, builder/question-bank.source.ts, overview/overview.repository.ts, ...) / 2 kongsi | **Buat semula** | 23 fail kod bercanggah, 3289 baris, ketinggalan 316 komit |
| #779 | S0-T07 | S0-T07 Target admin menu (PRD 30 §3): one Soalan group, Command Center | tidak | +2512/-5130 | 26 | 3.1 | konflik | 9 kod (bijak/admin-publish-http.spec.ts, bijak/admin-publish.spec.ts, __tests__/admin-nav.test.ts, ...) / 1 kongsi | **Buat semula** | 9 fail kod bercanggah, 7642 baris, ketinggalan 157 komit |
| #783 | S1-T02 | S1-T02 fix: TP has no difficulty fallback; DSKP gate counts SP nodes o | tidak | +96/-19 | 10 | 3.1 | konflik | 1 kod (questions/questions.service.ts) / 0 kongsi | **Ambil + selesai konflik** | 1 fail kod bercanggah, saiz kecil |
| #789 | S0-T02 | S0-T02 demo seed dates follow the run date; CI seeds keep SEED_NOW (M7 | tidak | +254/-29 | 14 | 3.0 | konflik | 1 kod (adr/0006-determinism-seeds-clock-ids.md) / 0 kongsi | **Ambil + selesai konflik** | 1 fail kod bercanggah, saiz kecil |
| #793 | S2-T05 | S2-T05 Manual entry, CSV import UI, Quick Edit (part 1: CSV screen, Qu | ya | +984/-111 | 19 | 3.0 | bersih | - | **Ambil** | bersih |
| #794 | S7-T06 | S7-T06 League and tournament schema 0225 (part 1) | tidak | +467/-6 | 6 | 3.0 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #795 | (tiada) | docs: DOC DEFECT rulings round 10:00 | tidak | +51/-46 | 8 | 3.0 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #809 | S6-T14 | S6-T14 Set Soalan Guru part scope | ya | +50/-7 | 7 | 3.0 | konflik | 2 kod (__tests__/prototype-scope.test.ts, nav/user-nav.ts) / 0 kongsi | **Ambil + selesai konflik** | 2 fail kod bercanggah, saiz kecil |
| #814 | (tiada) | CI: dedupe workflow runs (push only on long-lived branches, cancel sup | tidak | +3/-1 | 2 | 3.0 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #835 | S6-T14 | S6-T14 Set Soalan Guru part page | ya | +7848/-1254 | 42 | 2.9 | konflik | 5 kod (__tests__/classes.test.ts, __tests__/missions.test.ts, missions/paths.ts, ...) / 1 kongsi | **Buat semula** | 5 fail kod bercanggah, 9102 baris, ketinggalan 300 komit |
| #836 | S6-T14 | S6-T14 Set Soalan Guru part kelaslist | ya | +8018/-2173 | 50 | 2.9 | konflik | 5 kod (__tests__/classes.test.ts, __tests__/missions.test.ts, missions/paths.ts, ...) / 1 kongsi | **Buat semula** | 5 fail kod bercanggah, 10191 baris, ketinggalan 300 komit |
| #855 | S2-T10 | S2-T10 Leaf forms and marking-scheme editor UI (part A: toolbar, per-m | ya | +3023/-755 | 53 | 2.9 | konflik | 7 kod (questions/questions.service.ts, m04-question-bank/qa-g5-forms-import-quality.spec.ts, m04-question-bank/t4-question-form.spec.ts, ...) / 0 kongsi | **Buat semula** | 7 fail kod bercanggah, 3778 baris, ketinggalan 291 komit |
| #859 | S1-T10 | S1-T10 Accepted batch becomes a draft paper (part builder import, S3) | ya | +5422/-1163 | 111 | 2.9 | konflik | 33 kod (uat-ops/paper-group-integrity.sql, kuiz/kuiz.service.ts, papers/attempt-source.ts, ...) / 2 kongsi | **Buat semula** | 33 fail kod bercanggah, 6585 baris, ketinggalan 307 komit |
| #864 | S7-T07 | S7-T07 Draw statuses, admin list, Buka and Tutup (part P1) | tidak | +807/-76 | 17 | 2.9 | konflik | 1 kod (gamification/admin.service.ts) / 0 kongsi | **Ambil + selesai konflik** | 1 fail kod bercanggah, saiz kecil |
| #880 | S4-T04 | S4-T04 trim-duplicate-stem uses uat-ops/lib.ts (follow-up to #715) | tidak | +743/-4 | 5 | 2.9 | konflik | 2 kod (uat-ops/trim-duplicate-stem.ts, uat-ops/trim-duplicate-stem.spec.ts) / 0 kongsi | **Ambil + selesai konflik** | 2 fail kod bercanggah, saiz kecil |
| #886 | (tiada) | CI: run gate workflows on merge_group (merge queue support) | tidak | +79/-2 | 8 | 2.8 | bersih | - | **Ambil** | bersih |
| #896 | S3-T04 | S3-T04 sitting copy, offline banner and session dialog (part 4 of 7) | tidak | +428/-13 | 7 | 2.8 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #899 | S3-T04 | S3-T04 accepted parts self-markable, self-mark closes late sync (part  | tidak | +144/-2 | 6 | 2.8 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #903 | S7-T07 | S7-T07 Cabut pemenang and Tandakan Dihantar (part P2) | ya | +1983/-274 | 27 | 2.8 | konflik | 3 kod (gamification/admin.service.ts, gamification/gamification.module.ts, shop/shop.module.ts) / 1 kongsi | **Ambil + selesai konflik** | 3 fail kod bercanggah, saiz kecil |
| #904 | S0-T07 | S0-T07 admin menu: dedup in the generator and per-sector row fragments | ya | +3973/-5311 | 38 | 2.8 | konflik | 9 kod (bijak/admin-publish-http.spec.ts, bijak/admin-publish.spec.ts, __tests__/admin-nav.test.ts, ...) / 1 kongsi | **Buat semula** | 9 fail kod bercanggah, 9284 baris, ketinggalan 157 komit |
| #907 | S0-T10 | S0-T10 Kawalan Ciri (minimum): feature_flags, admin toggles API and pa | ya | +4829/-5144 | 64 | 2.8 | konflik | 10 kod (bijak/admin-publish-http.spec.ts, bijak/admin-publish.spec.ts, src/openapi.ts, ...) / 3 kongsi | **Buat semula** | 10 fail kod bercanggah, 9973 baris, ketinggalan 157 komit |
| #908 | S0-T05 | docs(plan): AC ledger [CI] row for S0-T05 AC-SH-6 | tidak | +1/-0 | 1 | 2.8 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | ledger: simpan kedua-dua baris |
| #910 | S1-T07 | S1-T07 part 3: stimulus_missing rule per 45 §6.6.1, DM-04 flag term in | ya | +339/-41 | 17 | 2.8 | konflik | 1 kod (questions/served-rule.ts) / 1 kongsi | **Ambil + selesai konflik** | ledger: simpan kedua-dua baris |
| #913 | S8-T03 | S8-T03 parts 4-5: DrawingPad, LanguageToggle, template block, matching | ya | +1893/-31 | 25 | 2.8 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #914 | S0-T11 | S0-T11 Kawalan Ciri full and go-live switch-over | tidak | +5434/-5138 | 64 | 2.8 | konflik | 10 kod (bijak/admin-publish-http.spec.ts, bijak/admin-publish.spec.ts, src/openapi.ts, ...) / 3 kongsi | **Buat semula** | 10 fail kod bercanggah, 10572 baris, ketinggalan 190 komit |
| #915 | S1-T06 | S1-T06 Close-out: CI proofs, group media rule, ledger rows | tidak | +244/-5 | 6 | 2.8 | konflik | 1 kod (questions/questions.repository.ts) / 1 kongsi | **Ambil + selesai konflik** | ledger: simpan kedua-dua baris |
| #917 | S1-T02 | S1-T02 Close-out: gate rows 25/26, CI proofs, ledger rows | tidak | +394/-16 | 16 | 2.8 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | ledger: simpan kedua-dua baris |
| #919 | S8-T03 | S8-T03 (S3 cross-sector): mock drawing leaf, AttemptPage matching bank | ya | +2105/-33 | 32 | 2.8 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #929 | S2-T03 | S2-T03 One bank, one queue, aliases (part /admin/spm/soalan redirect) | ya | +17/-39 | 4 | 2.7 | bersih | - | **Ambil** | bersih |
| #936 | S7-T02 | S7-T02 Drop the Sekolah Bersaing weekly dev seed | tidak | +27/-51 | 5 | 2.7 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #937 | S7-T01 | S7-T01 Permainan on real API (part GAME-00 rules: robots, answer port, | tidak | +2311/-948 | 80 | 2.7 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #942 | S1-T05 | S1-T05 Close-out: CI proof and ledger rows for parts 1-2 | tidak | +26/-1 | 2 | 2.7 | konflik | 1 kod (questions-workflow/imports.spec.ts) / 1 kongsi | **Ambil + selesai konflik** | ledger: simpan kedua-dua baris |
| #944 | S3-T04 | S3-T04 Bijak and Kuiz answer rows, 2 h Kuiz sweep (part 9) | tidak | +775/-46 | 13 | 2.7 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #950 | S1-T08 | S1-T08 Close-out: Kiriman tile counts, daily page quota code, ledger r | tidak | +173/-27 | 11 | 2.7 | konflik | 2 kod (files/intake-upload.service.ts, intake/files-paths.ts) / 2 kongsi | **Ambil + selesai konflik** | ledger: simpan kedua-dua baris |
| #951 | S3-T04 | S3-T04 Mod Latihan pays unrevealed parts at the coinsPerCorrect rate ( | tidak | +531/-65 | 23 | 2.7 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #953 | S7-T07 | S7-T07 Edit a draft draw, cancel with refund (part P3) | ya | +2712/-273 | 31 | 2.7 | konflik | 3 kod (gamification/admin.service.ts, gamification/gamification.module.ts, shop/shop.module.ts) / 1 kongsi | **Ambil + selesai konflik** | 3 fail kod bercanggah, saiz kecil |
| #954 | S7-T01 | S7-T01 Permainan on real API (part GAME-01 A: Battle contract and matc | tidak | +3389/-1044 | 85 | 2.7 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #958 | S7-T07 | S7-T07 Pupil Cabutan page: ticket dialog, fairness and results (part P | ya | +2585/-341 | 44 | 2.7 | konflik | 3 kod (gamification/admin.service.ts, gamification/gamification.module.ts, shop/shop.module.ts) / 1 kongsi | **Ambil + selesai konflik** | 3 fail kod bercanggah, saiz kecil |
| #959 | S3-T04 | S3-T04 Bijak e2e closes the open stimulus sheet before Seterusnya (bas | tidak | +30/-10 | 3 | 2.6 | bersih | - | **Ambil** | bersih |
| #960 | S7-T01 | S7-T01 Permainan on real API (part GAME-01 B: shared Battle rounds, re | tidak | +4422/-1251 | 89 | 2.6 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #961 | S1-T01 | S1-T01 Close-out: stimulus label and image alt rules, CI proofs, ledge | tidak | +352/-72 | 15 | 2.6 | konflik | 1 kod (questions/stimuli.ts) / 1 kongsi | **Ambil + selesai konflik** | ledger: simpan kedua-dua baris |
| #964 | S7-T04 | S7-T04 Syiling and Cabaran Harian (part 4, badge #26 Juara Battle, 023 | tidak | +137/-13 | 9 | 2.6 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #969 | S7-T04 | S7-T04 Syiling and Cabaran Harian (part 6, four more V2 Cabaran Harian | tidak | +126/-56 | 15 | 2.6 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #972 | S7-T07 | S7-T07 Mystery box tables and admin API (part P7, 0222) | tidak | +1307/-14 | 18 | 2.6 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #977 | S7-T01 | S7-T01 Permainan on real API (part GAME-01 C: Battle screens) | tidak | +6173/-1532 | 108 | 2.6 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #982 | S7-T05 | S7-T05 Coin rate and reward backend (part hadiah P07 limits, breaking) | ya | +360/-182 | 15 | 2.6 | konflik | 4 kod (shop/hadiah.input.ts, shop/shop.service.ts, shop/admin.spec.ts, ...) / 0 kongsi | **Ambil + selesai konflik** | 4 fail kod bercanggah, saiz kecil |
| #983 | S7-T01 | S7-T01 Permainan on real API (part GAME-R R1: room join and lifecycle) | tidak | +7081/-1601 | 121 | 2.6 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #984 | S7-T11 | S7-T11 Admin Hadiah list and Tebusan queue (part 1A) | ya | +2136/-67 | 18 | 2.6 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #985 | S7-T01 | S7-T01 Permainan on real API (part GAME-R R2: multi-human room engine) | tidak | +8284/-1787 | 125 | 2.5 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #991 | S7-T01 | S7-T01 Permainan on real API (part GAME-R R3: room seat presence, 0236 | ya | +11165/-3249 | 187 | 2.5 | konflik | 33 kod (arena/arena.service.ts, battle/battle-core.module.ts, battle/battle.deps.ts, ...) / 3 kongsi | **Buat semula** | 33 fail kod bercanggah, 14414 baris, ketinggalan 135 komit |
| #998 | S7-T04 | S7-T04 Syiling and Cabaran Harian (part 14, combo evaluator and Kombo  | tidak | +623/-54 | 33 | 2.4 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #1004 | S7-T04 | S7-T04 Syiling and Cabaran Harian (part 15, migrated challenges: metri | ya | +854/-61 | 38 | 2.4 | konflik | 5 kod (gamification/gamification.service.ts, gamification/challenge-type-combo-migration.spec.ts, gamification/student.spec.ts, ...) / 1 kongsi | **Ambil + selesai konflik** | 5 fail kod bercanggah, saiz kecil |
| #1010 | S7-T01 | S7-T01 Permainan on real API (part GAME-02 A: Papan Bijak API gaps) | ya | +11436/-3252 | 188 | 2.4 | konflik | 33 kod (arena/arena.service.ts, battle/battle-core.module.ts, battle/battle.deps.ts, ...) / 3 kongsi | **Buat semula** | 33 fail kod bercanggah, 14688 baris, ketinggalan 135 komit |
| #1011 | S7-T01 | S7-T01 Permainan on real API (part GAME-02 B: Papan Bijak screens) | ya | +11552/-3269 | 189 | 2.4 | konflik | 33 kod (arena/arena.service.ts, battle/battle-core.module.ts, battle/battle.deps.ts, ...) / 3 kongsi | **Buat semula** | 33 fail kod bercanggah, 14821 baris, ketinggalan 135 komit |
| #1014 | S7-T01 | S7-T01 GAME-05 A: Perlumbaan Matematik default-win points | ya | +11484/-3253 | 188 | 2.3 | konflik | 33 kod (arena/arena.service.ts, battle/battle-core.module.ts, battle/battle.deps.ts, ...) / 3 kongsi | **Buat semula** | 33 fail kod bercanggah, 14737 baris, ketinggalan 135 komit |
| #1015 | S7-T01 | S7-T01 GAME-05 B: Perlumbaan Matematik per-player pool reshuffle | ya | +11544/-3253 | 188 | 2.3 | konflik | 33 kod (arena/arena.service.ts, battle/battle-core.module.ts, battle/battle.deps.ts, ...) / 3 kongsi | **Buat semula** | 33 fail kod bercanggah, 14797 baris, ketinggalan 135 komit |
| #1016 | S7-T01 | S7-T01 GAME-02 C: Papan Bijak mock parity | ya | +12550/-3323 | 192 | 2.3 | konflik | 33 kod (arena/arena.service.ts, battle/battle-core.module.ts, battle/battle.deps.ts, ...) / 3 kongsi | **Buat semula** | 33 fail kod bercanggah, 15873 baris, ketinggalan 135 komit |
| #1022 | S7-T04 | S7-T04 Syiling and Cabaran Harian (part 16, achievements backend: trig | ya | +665/-51 | 24 | 2.3 | konflik | 0 kod / 1 kongsi | **Ambil + selesai konflik** | konflik hanya pada fail daftar-kongsi (jana semula) |
| #1025 | S7-T04 | S7-T04 Syiling and Cabaran Harian (part 16b, badges on the first login | ya | +1873/-217 | 52 | 2.3 | konflik | 8 kod (gamification/challenge-claims.service.ts, gamification/gamification.constants.ts, gamification/gamification.repository.ts, ...) / 3 kongsi | **Buat semula** | 8 fail kod bercanggah, 2090 baris, ketinggalan 95 komit |
| #1061 | S6-T03 | S6-T03 Cross-screen numbers (part chain-5: AC-CHAIN-5 Headcount spec) | ya | +987/-0 | 1 | 1.7 | bersih (CI unstable) | - | **Ambil** | bersih; semak CI (unstable) dahulu |
| #1071 | S3-T01, S3-T02 | docs(ledger): CI rows for S3-T01 and S3-T02 | tidak | +7/-0 | 1 | 1.6 | bersih | - | **Ambil** | ledger sahaja, bersih |

### 4.2 Bukan ke `feature/v3-bijak-r1` (67 PR)

**Bertindan pada cabang `r1/*` (14 PR).** Tidak boleh digabung ke base R1 sebelum PR bapa; urutan gabung mesti dari bawah ke atas. Cabang "tiada PR terbuka" bermaksud PR bapa sudah digabung/ditutup atau cabang ditinggalkan dan PR anak perlu di-rebase ke base (atau dibuat semula).

| PR | Base | Bergantung pada | Judul | +/- | Mergeable |
|---|---|---|---|---|---|
| #630 | r1/team-cc/S2-T06-question-tabs | cabang tiada PR terbuka (kemungkinan sudah digabung/ditinggalkan) | S2-T06 Kualiti and Import subtitles; mock import and quality specs | +111/-83 | clean |
| #636 | r1/team-cc/S2-T06-question-tabs | cabang tiada PR terbuka (kemungkinan sudah digabung/ditinggalkan) | S2-T06 Audit Rajah subtitle; t7 and cross-cutting mock specs | +236/-232 | unstable |
| #710 | r1/team-aa/S1-T09a-engine | PR #698 (base R1) | S1-T09a part 4: scheme validate route (API-Q-30) and schemeRules pass- | +1650/-2 | unstable |
| #718 | r1/team-cc/S3-T05-tracking-backend | PR #717 (base R1) | S3-T05 Tracking A (part 3: frontend) | +1313/-159 | dirty |
| #730 | r1/team-aa/S1-T09a-validate | PR #710 (base R1) | S1-T09a part 5: scheme v2 write path and grading for the answer-mode k | +16065/-8513 | unstable |
| #820 | r1/team-aa/S1-T09a-grading | PR #730 (base R1) | S1-T09a part 6a: served rule for mcq_multi (AC-PA-35) and the question | +276/-13 | clean |
| #851 | r1/team-dd/S10-T05-contract-and-service | cabang tiada PR terbuka (kemungkinan sudah digabung/ditinggalkan) | S10-T05 Heatmap (part 3: SP fallback) | +660/-17 | unstable |
| #885 | r1/team-aa/S1-T09a-served | PR #820 (base R1) | S1-T09a part 6b: Pilih N (a group is one choice unit) in exam-core and | +536/-53 | clean |
| #897 | r1/team-cc/S3-T04-copy | PR #896 (base R1) | S3-T04 autosave on blur, question change and every 15 s (part 5 of 7) | +526/-16 | unstable |
| #906 | r1/team-bb/S10-T03-analisa-item | cabang tiada PR terbuka (kemungkinan sudah digabung/ditinggalkan) | S10-T03 fix: base merge, sidebar-walk conflict (for #750) | +13476/-3406 | dirty |
| #949 | r1/team-dd/S6-T16-private-exclusion | cabang tiada PR terbuka (kemungkinan sudah digabung/ditinggalkan) | S6-T11 follow-up: [CI] spec that the Admin Pusat dashboard totals leav | +17/-0 | clean |
| #973 | r1/team-aa/S1-T09a-served | PR #820 (base R1) | S1-T05 part 5a: CSV import of true_false and mcq_multi rows | +201/-13 | dirty |
| #1021 | r1/team-cc/S7-T06-league-tournament | PR #794 (base R1) | S7-T06 League standings job, API-GAME-13 and derived status (part 3) | +1810/-40 | unstable |
| #1053 | r1/team-cc/S7-T07-mystery-box-tables | PR #972 (base R1) | S7-T07 Pupil Mystery Box on the box tables: syiling cost, weighted pri | +2172/-1010 | unstable |

Rantai ketara: **S1-T09a** (#710 -> #730 -> #820 -> #885/#973; bapa teratas #698 ialah PR S1-T09a bahagian 1 ke base), **S3-T05** (#717 -> #718), **S3-T04** (#896 -> #897), **S7-T07** (#972 -> #1053) dan **S7-T06** (#794 -> #1021). Cadangan: gabung bapa dahulu (selepas diselesaikan), kemudian rebase anak; rantai S1-T09a ialah calon "Buat semula" sebagai satu PR kerana 5 tingkat dan #730 +16,065/-8,513 baris.

**Bukan R1 (53 PR):** 39 ke `be/integration-frontend`, 13 ke `feature/v2-backend`, 1 ke `fe/AZ-21a-login-mobile`. Tarikh dicipta 2026-10-21 hingga 2026-10-30 (kecuali #212 pada 2026-10-22); ini aliran V2/tong sampah lama. Ia tidak bergantung pada R1 dan tidak boleh dimasukkan ke V3; cadangan: **Tutup** (semak dengan pemiliknya). Ini bukan "~20 PR bertindan pada cabang R1 lain" seperti jangkaan: sebenarnya hanya 14 bertindan pada cabang R1.

## 5. Jumlah AC (buku besar `docs/plan/r1-ac-ledger.md`)

Buku besar: 200 baris, semuanya `env=CI`, `result=Pass`; **0 baris UAT**; 0 Fail. 197 AC unik (3 AC ada dua baris). Hanya 43 daripada 118 kad ada sekurang-kurangnya satu baris CI.

"AC dirancang" = ID AC unik yang ditakrif dalam dokumen PRD `docs/prd/r1/` (baris `- AC-xxx Given ...`, baris jadual `| AC-xxx | Given ...` atau `**AC-xxx**`). Kiraan ini mungkin sedikit mengatasi kerana sebahagian ID ialah AC sub-modul; ia bukan "270" lead yang tidak dapat saya hasilkan semula (tiada angka 270 dalam repo; kemungkinan subset Delivery A atau sprint tertentu). Sila sahkan takrifan penyebut dengan lead.

| Dokumen PRD | AC dirancang | AC bukti CI | AC bukti UAT | CI % |
|---|--:|--:|--:|--:|
| 10-murid | 314 | 51 | 0 | 16.2% |
| 20-guru-admin-sekolah | 381 | 103 | 0 | 27.0% |
| 30-admin-pusat | 257 | 22 | 0 | 8.6% |
| 40-cross-cutting | 31 | 5 | 0 | 16.1% |
| 45-question-authoring-flow | 51 | 8 | 0 | 15.7% |
| 46-pupil-activity-flow | 44 | 7 | 0 | 15.9% |
| 47-v3-duplicates-register | 1 | 0 | 0 | 0% |
| 48-game-and-gamification-spec | 149 | 0 | 0 | 0% |
| Tidak dipetakan (`FR-X2-0`, satu baris buku besar ialah FR bukan AC) | - | 1 | 0 | - |
| **Jumlah** | **1,228** | **197** | **0** | **16.0%** |

Catatan: 10/20/30/40 sahaja = 983 AC dirancang, 181 CI (18.4%). Dokumen 48 (permainan/gamifikasi, 149 AC) tiada satu pun bukti CI walaupun beberapa PR gamifikasi sudah digabung. 11 `AC-CHAIN-n` tidak ada baris buku besar (S9-T06 belum dijalankan).


## 6. Keputusan ujian tempatan pada HEAD `b50fa8d41` (dijalankan lead 2026-11-08; dimasukkan seperti diberi)

| Semakan | Hasil |
|---|---|
| `contract:check`, `contract-tests` | exit 0 |
| `be:lint`, `be:lint:migration`, `be:typecheck`, `be:build` | exit 0 |
| `be:test` | **Belum selesai** semasa laporan ditulis; log tiada baris ringkasan akhir, jadi bilangan lulus/gagal keseluruhan **tidak diketahui**. Tangkapan separa (11:19 MYT): 10 fail dengan kegagalan, 106 ujian gagal. Fail gagal (ujian/gagal): `test/migration/dump/sql.spec.ts` 105/51, `test/migration/dump/cli.spec.ts` 69/39, `test/questions-workflow/imports.spec.ts` 73/3 (dua tamat masa 30 s: "more than 100 distinct URLs", dan satu pembersihan imej URL), `test/migration/core/roster-report.db.spec.ts` 12/3, `test/migration/verify/archive-minimise.db.spec.ts` 7/4, `test/migration/verify/export-question-reports.db.spec.ts` 11/2, `test/content/videos.spec.ts` 51/1 (halaman 24 kad, tamat masa 30 s), `test/migration/questions/questions.db.spec.ts` 14/1, `test/migration/activity/files.db.spec.ts` 17/1, `test/migration/verify/verify.deleted.db.spec.ts` 8/1. 90 daripada 106 ialah spesifikasi `migration/dump` yang gagal dalam ~1-50 ms setiap satu (semuanya berkaitan fail pilihan mysqldump/mod fail 600/`chmodSync`): **kemungkinan** artifak Windows (mod fail POSIX) dan bukan regresi R1, tetapi punca tepat tidak dapat disahkan kerana log hanya memaparkan nama ujian, bukan mesej ralat. Baki ialah tamat masa 30 s semasa mesin berbeban (migration db spec dan imports/videos) atau kegagalan db yang perlu dijalankan semula berasingan. |
| FE `vite build` (demo) | exit 0 |
| FE `typecheck` | exit 0 |
| FE `check:http-build` | OK selepas pembetulan spawn Windows (`scripts/check-http-build.mjs`, perubahan belum dikomit) |
| FE unit | 13,458 lulus / 5 gagal |
| FE lint | JS heap kehabisan memori + "ratchet FAILED" |

**5 kegagalan unit FE, dijalankan semula berasingan** (`npx vitest run --project unit <fail>`):

| Ujian | Hasil berasingan | Penilaian |
|---|---|---|
| `src/components/question-display/__tests__/attempt-frame.test.ts` AC-X6-1 | gagal (`expected '' to contain '[data-short-hide]'`) | **Artifak CRLF Windows.** Regex ujian bergantung pada `\n`; `src/ds/states.css` di folder kerja berakhir CRLF (`core.autocrlf=true`, indeks `i/lf w/crlf`). Dengan CR dibuang, blok `@media (max-height: 420px)` mengandungi `[data-short-hide]`. Lulus pada CI Linux. |
| `src/ds/__tests__/s8-t06-primitives.test.ts` FR-X6-5 | gagal | **Artifak CRLF** sama (ujian mencari rentetan dengan `\n` dalam `states.css`; rentetan itu wujud selepas normalisasi LF). |
| `src/shells/pembelajaran/__tests__/pembelajaran-nav.test.ts` AC-MUR-A5-4 | gagal (`expected [] to have a length of 2`) | **Artifak CRLF** (regex `label: 'Log Keluar',\n...` pada `PembelajaranLayout.vue`; dengan LF, 2 baris sepadan dan kedua-duanya memakai `LOGOUT_ROW_MIN_HEIGHT_CLASS`). |
| `src/modules/m08-student-performance/__tests__/mock/anchors.test.ts` "S3 Tingkatan 5" x2 | **masih tamat masa 30 s** (2 gagal, 45 lulus, fail 88.8 s) walaupun dijalankan seorang diri | **Tidak terbukti beban sahaja:** dijalankan semasa `be:test` masih berjalan pada mesin yang sama, jadi tidak muktamad. Ujian menjana set data S3 (3,911 murid, 29,971 sesi) dalam 30 s; jika perlu >30 s pada mesin kosong, naikkan timeout atau kecilkan fixture. Ada kemungkinan kegagalan sebenar prestasi. |

Kesimpulan: 3 daripada 5 ialah artifak persekitaran Windows (boleh disahkan dengan `git config core.autocrlf false` + checkout semula, tidak dilakukan di sini); 2 timeout m08 belum terbukti sama ada beban atau lambat sebenar.

## 7. Punca R1 terhenti (dengan angka)

Disahkan dengan `gh` (baca sahaja) pada 2026-11-08:

| Penunjuk | Nilai | Sumber |
|---|---|---|
| PR digabung ke base | 393 (2 Nov: 1, 4 Nov: 35, 5 Nov: 199, 6 Nov: 140, 7 Nov: 18) | `pulls?state=closed&base=feature/v3-bijak-r1` |
| Masa-ambil PR (dicipta -> digabung), median | 4 Nov **2.6 j**, 5 Nov 6.1 j, 6 Nov 17.6 j, 7 Nov **31.1 j** | sama |
| Kelulusan rasmi GitHub (`APPROVED`) | **0** daripada 393; hanya 50 PR ada ulasan `COMMENTED` | `pulls/N/reviews` |
| Penggabung | 303 + 88 + 2 (tiga akaun; dua akaun melakukan 391 daripada 393) | `pulls/N` `merged_by` |
| Perlindungan cabang base | tiada (API pulangkan "Branch not protected") | `branches/.../protection` |
| PR terbuka ke base | 88 (45 draf); 60 bercanggah, 21 bersih tapi CI unstable, 7 bersih | `pulls/N` `mergeable_state` |
| PR terbuka bertindan pada cabang lain | 14 pada cabang `r1/*`, 52 pada v2 (`be/integration-frontend` 39, `feature/v2-backend` 13), 1 pada `fe/AZ-21a-login-mobile` | `pulls` |
| Isu `r1` | 126 (118 kad + 8 susulan); 125 terbuka; 1 ditutup; 1 `status:done` | `issues` |
| Label status kad | in-review 55, in-progress 40, ready 22, done 1 | label |
| Kad dengan PR kod digabung tetapi label masih `ready`/`in-progress` | 51 (15 masih `ready`) | silang data |
| UAT | `e34e0a52d` (3 Nov 10:15 MYT); 502 komit, 48 migrasi baharu (51 -> 99), 2,668 fail (+279,306 / -70,119 baris) di belakang HEAD | `git` |

Tafsiran:
1. **Gabung tanpa semakan menghasilkan arus masuk laju tetapi hutang integrasi.** 393 gabungan dalam ~3.5 hari, tanpa satu kelulusan, melalui dua akaun, di atas base tanpa perlindungan. Kualiti diserahkan kepada CI sahaja, dan 21 PR terbuka sedang `unstable`.
2. **Baris gilir konflik melambatkan semua orang.** Setiap PR yang menyentuh `seed-profile.md`, `openapi.json`, `r1-canonical-map.json` atau `r1-ac-ledger.md` (fail yang setiap kad ubah) bercanggah selepas PR lain digabung: 20, 18, 15 dan 11 PR terbuka sedang bercanggah pada fail-fail ini. Itu menjelaskan masa-ambil median melonjak daripada 2.6 j kepada 31.1 j apabila bilangan PR serentak membesar. Modul `gamification`/`battle` pula bercanggah dalam 6-7 PR kerana enam PR S7-T01 (#991, #1010, #1011, #1014, #1015, #1016) menyentuh fail `battle/*` yang sama dan bercanggah dengan perubahan yang sudah digabung.
3. **PR terlalu besar dan terlalu banyak bahagian.** 19 PR terbuka >=5,000 baris, 30 PR 1,000-4,999 baris; kad dipecah kepada banyak "part" bertindan (contoh S1-T09a part 4/5/6a/6b dalam 4 PR bertindan: #710, #730, #820, #885) yang tidak boleh digabung tanpa bapa.
4. **Papan status tidak dikemas kini**, jadi lead tidak nampak apa yang sudah siap: kad `ready` sedangkan kodnya digabung. Hanya 1 isu ditutup.
5. **Pengesahan tidak pernah sampai ke UAT:** 0 baris UAT, server UAT 502 komit di belakang, jadi syarat `[CI+UAT]` untuk "done" mustahil dipenuhi walaupun semua kod digabung.
6. **Pecahan penumpuan:** 53 PR terbuka milik aliran V2 (`be/integration-frontend`/`feature/v2-backend`/`fe/*`) berada dalam repo yang sama dan menambah bunyi dalam senarai PR terbuka (155 jumlah, 88 untuk R1).

Cadangan susunan pemulihan (untuk keputusan PO, bukan dilaksanakan di sini): (a) bekukan gabungan baharu seketika; (b) jana semula 4 fail daftar-kongsi sekali sahaja di base dan automasikan (merge driver / jana dalam CI) supaya ia berhenti menjadi punca konflik; (c) gabung 28 PR "Ambil" dan 35 "Ambil + selesai konflik" berperingkat mengikut kebergantungan; (d) putuskan "Buat semula" untuk 25 PR; (e) kemas kini label status daripada data PR; (f) deploy base ke UAT dan jalankan baris UAT bagi 10 kad Siap dahulu.

## 8. Tidak dapat disahkan / syak

- **"19 daripada 163 isu `r1` ditutup"**: dalam GitHub kini 126 isu `r1`, 1 ditutup (#474). Mungkin angka lead dikira pada masa lain atau termasuk isu bukan-`r1`. Tidak dapat dihasilkan semula.
- **"CI ACs 197/270"**: pembilang 197 betul (197 AC unik dalam buku besar); penyebut 270 tidak dijumpai dalam repo; kiraan PRD saya ialah 1,228 (983 untuk dokumen 10/20/30/40).
- **60 vs 59 PR bercanggah**: kini 60 (disahkan GitHub dan tempatan).
- **S10-T06** berlabel `done`/ditutup tetapi tiada PR berpadan dikesan melalui ID kad dalam tajuk/cabang; saya kelaskan "Belum mula" menurut PR. Perlu semakan manual.
- **S9-T01/T02/T05** ialah kad berulang Delivery Lead tanpa PR; "Belum mula" di sini bermaksud tiada artifak PR.
- **Kelas "Siap/Separa"** bergantung pada AC yang disebut dalam teks kad (heuristik), bukan pemetaan AC->kad rasmi. Gunakan sebagai penunjuk, bukan keputusan akhir.
- **Status CI sebenar 28 PR `unstable`/`clean`** tidak diperiksa baris demi baris (hanya status mergeable GitHub); PR "Ambil" perlu CI hijau sebelum digabung.
- **"Superseded":** diuji melalui kesamaan blob fail dengan base sahaja (tiada PR >=80%); PR yang kerjanya digantikan oleh PR lain dengan fail berbeza tidak dikesan. Calon untuk semakan manual ialah PR berlebihan untuk kad yang sudah "Siap (kod)" (lihat jadual kad).
- **be:test** belum selesai semasa laporan ditulis (lihat bahagian 6).
