# Runsheet go-live R1 (susunan B), 3 Nov 2026 MYT

## Open K items (English note for the owner and Team B)

**Status: not started.** Q29: deploy as soon as the final CI is green, 3 Nov MYT. The owner has not yet set T0 (the moment `.cloud` freezes). `<R1_SHA>` is not final: it waits for the REQ-B-109 fix and a green full CI.

Decided: K1 restore `pre_etl`; K6 accept `https://www` failing and fix after live; K9 unencrypted disk accepted with mitigations (Q23 item 1, REQ-B-113); `REGISTRATION_OPEN` stays `true`; OCR mock accepted for AC-R1-14.2 (Q23); `--as-of` 2026-11-03; `VITE_PROTOTYPE_SCOPE=on` for live.

Open:
- **K7a (owner):** T0, and `T_PUPIL`, the time by which pupils must be served again. The real limit is the earlier of T0 + 5:30 and `T_PUPIL`. Due before section 0.
- **K7b (owner):** text and channel of the notice to schools. Not in the repo.
- **K10 (owner):** notice to the 49 active parent, sponsor and PPD accounts. With `VITE_PROTOTYPE_SCOPE=on` they are refused at login. Text and channel are not in the repo.
- **K2 (`.cloud` owner):** `articles.body` column and grant. Without it, 0 articles migrate.
- **K3 (owner):** read-only access to `.cloud` storage for `--files-dir`. Without it, banner images are not migrated.
- **K5 (owner):** freeze proof. The repo has no command: a read-only SELECT from DevOps, or written acceptance of partial proof.
- **K9b (owner):** delete dates for what stays after the load: `staging_cloud`, PITR base backups and archived WAL, restore points and local dumps (REQ-B-113 accepts that only the raw dump file is deleted at once; dates still to set; default purge 2026-11-06 needs re-checking). `archive_cloud` is kept 12 months.
- **Still pending from Q23:** limits 4.1 to 4.4, Q15/Q16 review, copy row 42, M02 rotation after deploy.
- **Re-confirm:** the rollback deadline of switch + 4 hours was set on 22 Oct for the old plan.

---

**Status: belum bermula.** Q29: sebaik CI akhir hijau, 3 Nov. Pemilik menetapkan masa tepat (T0). Pemilik .cloud dan operator dump hadir bersama. `<R1_SHA>` belum muktamad.

**Susunan B (pilihan pengguna):** ETL dari imej migrate `cb7332d0b` pada DB UAT di 0091 → semak semula → deploy R1 `<R1_SHA>` → `--seed-reference` → `PP_DOMAIN` dan DNS ke 187.52.120.11.

**Peraturan.** Hanya manusia menjalankan setiap arahan pada pelayan. **Tiada AI pada PC dump.** Tiada rahsia, tiada baris data, hanya kiraan dalam laporan. Setiap langkah: baca output, kemudian teruskan. Output tidak seperti tertulis = HENTI. Fakta pelayan dalam fail ini dibaca pada 2 Nov malam, baca sahaja; 0.6 dan 0.11 membacanya semula.

**Peraturan bila semua hadir (menggantikan peraturan operator tunggal pelan 4.6).** Pelan menetapkan operator tunggal, tiada pengecualian, tiada siapa dikejutkan. Itu tidak terpakai **selagi** pemilik, pemilik .cloud, operator dump dan DNS boleh dihubungi (bergantung pada orang, bukan waktu siang). Jika pemilik tidak boleh dihubungi, tiada pengecualian: HENTI. Pengecualian boleh dibuat **bertulis oleh pemilik sahaja** (pelan 5). Yang kekal: PC dump tanpa AI, tiada kerja `migrate:*` serentak, setiap HENTI ikut Blok HENTI, dan waktu lewat di bawah.

**Tanda.**
- **BELUM DISAHKAN** = arahan ini tidak dapat disahkan pada kod atau dokumen di SHA, atau bukan dari repo. Semak dulu sebelum jalan. Jangan anggap betul.
- Tanpa tanda = dibaca daripada kod atau dokumen di SHA. Hanya yang tersenarai di "Fakta rehearsal" pernah dijalankan, dan itu pada Docker tempatan.

**SHA.**
- ETL: `cb7332d0b3b532a2ac93784e837f92afb874b73a` (tag imej `cb7332d0b3b5`).
- R1: **`<R1_SHA>` = tip dalam `docs/team/MERGE-LOG.md` (cawangan `team/r1-board`) dengan CI akhir hijau.** `<R1_TAG>` = 12 aksara pertama `<R1_SHA>`. Team B memberikan kedua-duanya. Jangan guna SHA lain.

**Masa, relatif kepada T0 (saat `.cloud` beku, 1.2). Pemilik menetapkan T0.** Inferens daripada anggaran, belum diukur pada data sebenar.

| Titik | Masa | Tindakan |
|---|---|---|
| Mula bahagian 0 | T0 − 1:00 | Bina imej, baca kandungan |
| Gerbang 0.11 | T0 − 0:15 | Tidak lulus = tiada beku |
| Dump dan pindah selesai | T0 + 0:55 | |
| ETL selesai (3.x) | T0 + 1:45 | |
| **Go/no-go 5.0** | kira-kira T0 + 2:00 | Pemilik |
| **Lewat mula 5.7** | **T0 + 3:15** | Selepas ini no-go, S3 |
| DNS (6.5) | kira-kira T0 + 4:00 | |
| **Had abort** | **yang lebih awal antara T0 + 5:30 dan `T_PUPIL`** | Belum 5.7 = S3; sudah 5.7 = pemilik pilih |

**Murid terjejas dari T0.** `.cloud` baca-sahaja dari T0 dan alamat baharu hanya selepas DNS, jadi murid tidak boleh menulis sepanjang tempoh itu. Waktu sokongan yang direkod ialah 07:00 hingga 18:00 (hypercare), dan pelan 6.2 mengingatkan pertukaran pada pagi sekolah bertembung dengan trafik tertinggi. Q29: sebaik CI akhir hijau (dijangka kira-kira 03:00 MYT), orang sedia dari kira-kira 02:30. Pemilik tetapkan `T_PUPIL`, masa murid mesti dilayan semula, sebelum bahagian 0. **Had sebenar = yang lebih awal antara T0 + 5:30 dan `T_PUPIL`.** Contoh, inferens: T0 03:00 memberi 08:30, jadi `T_PUPIL` 07:00 menjadi had, dan anggaran siap T0 + 4:20 = 07:20 sudah melepasinya. **Syarat beku: T0 + 4:20 tidak melebihi `T_PUPIL`.** Jika tidak, pemilik tukar `T_PUPIL` atau tangguh.

---

## Fakta rehearsal (Docker tempatan, fixture, tiada data sebenar, 2 Nov, atas `43fef0510`)

Laporan: `r1-migration-rehearsal/REPORT-6-etl-then-r1.md`. **Susunan B lulus.** `<R1_SHA>` kemudian berbeza; rehearsal tidak meliputinya.

| Perkara | Keputusan |
|---|---|
| ETL `cb7332d0b` pada 0091, kemudian `deploy.sh` ke R1 | Lulus: 40 migrasi, 11 folder 0092..0110, `staging_cloud` kekal |
| Soalan | `published` jadi `approved`; `questionCount` dan Latih Tubi nampak soalan |
| Log masuk `legacy_source` | Hash `$2y$` sumber 200; kata laluan salah 401; akaun berbendera `mustChangePassword` true |
| `--seed-reference` | `tiers` 4; `spm_subject_configs` sama dengan bilangan kod wujud |
| Load kedua | Baris `users` ditulis semula penuh hanya bila `legacy_hash` sumber berubah; kata laluan sasaran hilang dan bendera dikira semula. **Selepas pengguna sebenar menukar kata laluan, load semula tidak selamat** |

**Arahan yang berjalan** (bentuk `docker run` dengan env sama seperti `slot.sh etl`): `deploy.sh` di `cb7332d0b`; `staging:load`; `db-roles.sh apply`; `migrate:all --apply --as-of=...`; `migrate:questions --apply`; `deploy.sh` di R1; `deploy.sh --seed-reference`; `psql -XtA < docs/ops/sql/smoke-readonly.sql`.

**TIDAK dilatih:** **`slot.sh etl` dan `slot.sh copy`**, `--files-dir`, `--content-owner` (tidak dalam senarai arahan yang berjalan), data sebenar, masa sebenar, VPS sebenar, hantar penuh soalan, imej `cb7332d0b` atas skema R1. `staging:load` sebagai `pp_owner` gagal 42501 bila `pp_stager` memiliki skema; di pelayan guna `slot.sh`.

**Masa pada data sebenar:** migrate kira-kira 2 min 42 s pada 409k versi, dengan 0106 47 hingga 96 s (Docker tempatan). Masa fixture lain tidak bermakna.

---

## Keputusan manusia

| # | Keputusan | Status | Siapa | Sebelum |
|---|---|---|---|---|
| K1 | Restore `pre_etl` atau load di atas | **DIPUTUSKAN: restore `pre_etl`** | Pengguna | selesai |
| K6 | `https://www.prestasiplus.cloud` gagal | **DIPUTUSKAN: terima, baiki selepas live** | Pengguna | selesai |
| K8 | `REGISTRATION_OPEN` | **DIPUTUSKAN: kekal `true`** ("Kekal buka"). #352 masih OPEN dan tiada dalam R1; dokumen hypercare mahu ia merge dahulu, jadi pengguna perlu tahu | Pengguna | selesai |
| K9 | Volum tidak disulitkan (`/dev/sda1` ext4, tiada crypt, cakera sama dengan `pgdata`) | **DIPUTUSKAN: terima + mitigasi (Q23 item 1, REQ-B-113).** Langkah di bawah | Pengguna | selesai |
| Skop | `VITE_PROTOTYPE_SCOPE` | **DIPUTUSKAN: `on` untuk live** (5.1b) | Pemilik | selesai |
| OCR | AC-R1-14.2 dengan OCR mock | **DIPUTUSKAN: diterima (Q23).** Uji OCR kemudian | Pengguna | selesai |
| K4 | `PITR off` | Tertutup: PITR on pada 2 Nov. Jika berubah di 0.6: HENTI dan tanya pemilik | - | 0.6 |
| **K7a** | T0 dan `T_PUPIL` | **TERBUKA**, wajib | Pemilik | **bahagian 0** |
| **K7b** | Teks dan saluran notis kepada sekolah (P10); tiada dalam repo | **TERBUKA**, wajib | Pemilik | 1.1 |
| **K10** | Notis kepada 49 akaun aktif ibu bapa, penaja dan PPD: dengan `VITE_PROTOTYPE_SCOPE=on` mereka ditolak semasa log masuk. Teks dan saluran tiada dalam repo | **TERBUKA**, wajib | Pemilik | 6.5 |
| **K2** | `articles.body`: lajur wujud dan geran dibuat. Tanpanya: 0 artikel | **TERBUKA**, wajib | Pemilik .cloud | 0.8 |
| **K3** | Fail banner (`--files-dir`): akses baca-sahaja storan `.cloud`? Jika tiada: tanpa flag, imej banner tidak dipindah, tulis sebagai pengecualian | **TERBUKA** | Pemilik | 0.11 |
| **K5** | Bukti beku: tiada arahan dalam repo. SELECT dari DevOps, atau terima bertulis kiraan `dump:check` = manifest sebagai bukti separa | **TERBUKA** | Pemilik | 0.11 |
| **K9b** | Tarikh padam salinan yang tinggal (7.7) | **TERBUKA** | Pemilik | 7.7 |

### K9: mitigasi disk, langkah konkrit

Risiko kekal: `shred` pada ext4 tidak menjamin pemadaman fizikal, dan DB sasaran sendiri pada cakera yang sama.

| Mitigasi | Langkah | Semakan |
|---|---|---|
| Akses terhad | 0.10b | Hanya akaun yang disahkan; `stage` mode 700 |
| Dump mentah dipadam sejurus selepas load | 3.3 | `wipe-dump`, sebelum `copy` |
| Kluster sementara dimusnahkan | 3.4 | `pgdata` tiada |
| `files` dan `<dir>` dipadam | 3.7b | `<dir>` tiada |
| Salinan yang tinggal direkod, dipadam ikut tarikh | 0.10b, 3.13, 7.7 | Carian kosong, `raw-check` |

**Maksud yang diterima (REQ-B-113, "Ya, terima").** Hanya **fail dump mentah** dipadam sejurus selepas load. Data mentah lain kekal tidak disulitkan pada cakera pelayan sehingga dibersihkan pada tarikh yang ditetapkan: `staging_cloud`, base backup PITR dan WAL arkib, restore point, dump tempatan (tarikh belum ditetapkan, K9b; purge lalai 2026-11-06 perlu disemak semula). `archive_cloud` kekal 12 bulan. **"Root sahaja"** bermaksud root dan akaun setara root: `ppdeploy` melalui kumpulan docker, dan kunci SSH pada root, disenaraikan mengikut peranan. Penyulitan PC dump kekal wajib. `slot.sh` berjalan sebagai `ppdeploy` dan container migrate sebagai uid 1000.

### K1: alasan dan kos

Sebab restore: #391 merekod "the clean point the cutover restores before the final migration is `pre_etl`"; muatan pertama pada DB bersih ialah laluan yang dilatih; load di atas mengekalkan baris ujian v2-born (`kit/upsert.ts`) dan baris yang dipadam di sumber (runbook 15), menulis semula `password_hash` pada `users` yang berubah (`identity-steps.ts:23`, disahkan rehearsal), dan delta memerlukan `--as-of` lama yang tidak direkod (`orchestrate.ts:29-32`).

Kos: semua tulisan DB selepas 27 Oct hilang, termasuk rotasi kata laluan (buat semula di 5.11). Fail volum `apifiles` tidak dipulihkan dan jadi yatim. Fakta 2 Nov: `pre_etl` ada 5 pengguna, 4 tier, 40 migrasi hingga 0091; UAT 5 bukan legacy.

---

## 0. Prasyarat sebelum beku

Shell untuk `S`, `R`, `$PC` dari 0.2 ke atas (bahagian 0 hingga 4), sebagai `ppdeploy`, selepas 0.1:
```
cd "$HOME/pp-etl-cb7332d0"
export PP_IMAGE_TAG=cb7332d0b3b5
export PP_BACKUP_KEEP_AUX=20
S=deploy/vps/migration/slot.sh; R=deploy/vps/migration/restore-point.sh
PC="docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env"
PSQL_RO='PGPASSWORD="$POSTGRES_PASSWORD" PGOPTIONS="-c default_transaction_read_only=on" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"'
psql_ro() { $PC exec -T db sh -c "$PSQL_RO" sh "$@"; }
PSQL=psql_ro
```
Sebab worktree: `/opt/pretasiplus` (6d81162c) tidak berubah. `compose.yaml` ada `name: pretasiplus`, jadi `pp_compose` dari worktree nampak projek yang sama. `deploy/` sama pada 6d81162c dan cb7332d0b (`git diff` kosong). `git rev-parse HEAD` dalam worktree memberi `PP_GIT_SHA` yang betul.

**Pengekalan sandaran.** `--tag pre-deploy` menyimpan hanya `PP_BACKUP_KEEP_AUX` terbaharu, lalai 5 (`backup.sh`:42, :150), jadi `D0` atau `D` boleh terhapus. `PP_BACKUP_KEEP_AUX=20` dalam kedua-dua blok shell; `pp_cfg` membaca env dahulu (`lib.sh`:67-73) dan `backup.sh` mewarisinya dari `deploy.sh`.

**Peraturan imej (M2).** Imej migrate di hos hanya `:6d81162c87f0`, tiada `:prod`. Baris `export` mesti ada dalam **setiap shell baharu**. Semak dengan `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI. (`config --images` ialah flag Compose, bukan dari repo.)

**0.1 Worktree tanpa ganggu checkout**
- Siapa: operator di UAT (`ppdeploy`)
- Arahan (**BELUM DISAHKAN:** laluan `$HOME` dan akses keluar ke GitHub; `git worktree` tidak ada dalam dokumen):
```
git -C /opt/pretasiplus fetch origin
git -C /opt/pretasiplus worktree add --detach "$HOME/pp-etl-cb7332d0" cb7332d0b3b532a2ac93784e837f92afb874b73a
git -C "$HOME/pp-etl-cb7332d0" rev-parse HEAD
git -C /opt/pretasiplus rev-parse --short HEAD
```
- Jangkaan: baris ketiga = `cb7332d0b3b5...`; baris keempat masih `6d81162c`. Jika worktree sudah wujud dari persediaan 2 Nov: langkau `worktree add`, semak HEAD sahaja.
- Henti jika: fetch gagal; HEAD `/opt/pretasiplus` berubah
- Bila henti: jangan bina; laporkan. Tiada apa berubah.
- Minit: 2

**0.2 Bina imej migrate sahaja**
- Siapa: operator di UAT
- Arahan: (shell di atas, dari worktree) `$PC build migrate` kemudian `docker image ls | grep cb7332d0b3b5`
- Jangkaan: imej `pretasiplus-api-migrate:cb7332d0b3b5` wujud; container berjalan tidak dicipta semula (`build` tidak menyentuh container)
- Henti jika: bina gagal, atau RAM atau cakera tidak cukup (perlukan kira-kira 2 GB RAM bebas)
- Bila henti: gagal rangkaian `npm ci`: ulang sekali. Selain itu laporkan.
- Minit: 11 (rehearsal R1, bukan imej ini)

**0.3 Pengesahan env, nilai sahaja dikira, tidak dicetak**
- Siapa: operator di UAT
- Arahan:
```
grep -c '^PP_MIGRATE_ROSTER_DEFAULT_HASHES=' /etc/pretasiplus/etl.env
sudo grep -c '^IC_HASH_KEY=' /etc/pretasiplus/api.env
```
 Jangan ubah `IC_HASH_KEY` (runbook: kunci stabil seumur sistem). Semak nilai hash roster dalam petikan tunggal (#391, belum merge): **BELUM DISAHKAN** `grep -c "^PP_MIGRATE_ROSTER_DEFAULT_HASHES='" /etc/pretasiplus/etl.env`
- Jangkaan: `1`, `1`, `1`
- Henti jika: mana-mana bukan 1. Tanpa petikan, Compose memotong hash dan F10 gagal.
- Bila henti: pemegang rahsia betulkan fail; jangan paste nilai dalam chat.
- Minit: 2

**0.4 Hentikan timer**
- Siapa: operator di UAT
- Arahan: `sudo systemctl stop pp-backup.timer pp-cert-renew.timer`
- Jangkaan: tiada ralat. `pp-restore-drill.timer` **tiada di hos ini**, jangan sentuh. `pp-health-probe` kekal berjalan; kegagalan semasa api berhenti dijangka (tiada webhook). **Hidupkan semula di 7.6.**
- Henti jika: ralat `sudo`
- Bila henti: laporkan
- Minit: 1

**0.5 Sandaran keadaan UAT sekarang, `D0` (jalan balik ke keadaan sebelum 3.2)**
- Siapa: operator di UAT
- Arahan: `deploy/vps/backup/backup.sh --tag pre-deploy --no-files` kemudian `D0="$(ls -t /var/backups/pretasiplus/pp-backup-*.dump | head -1)"; echo "$D0"; $PC exec -T db pg_restore --list < "$D0" > /dev/null; echo $?`
- Jangkaan: `dump ok: pp-backup-<UTC>-pre-deploy.dump ...`; akhir `0`
- Henti jika: selain `0`. Baris terakhir `backup start` lama = disekat kunci DDL.
- Bila henti: semak `pg_stat_activity`; jangan teruskan tanpa sandaran.
- Minit: 5 hingga 15

**0.6 Bukti infrastruktur**
- Siapa: operator di UAT
- Arahan: `$S gonogo` ; `$R list` ; `$R verify pre_etl --expect-migrations repo` ; `$R verify pre_delta --expect-migrations repo` ; `grep -c '^PP_OFFSITE_KIND=none' /etc/pretasiplus/prod.env`
- Jangkaan (sama seperti bacaan 2 Nov): `gonogo: complete (every check above ran)`; tiada `NO-GO`, `MISSING`; PITR on; `stage: archive_cloud:38 staging_cloud:89` (salinan lama, DDL lama, dibuang oleh 3.2); `api ... -> 200`; `RESTORE POINT OK: pre_etl ... sha256 matches`, migrasi sama. Dalam `list`, `pre_etl` `raw_data` = `no`. `PP_OFFSITE_KIND`: `1`.
- Henti jika: mana-mana `NO-GO`/`MISSING`; `PITR off`; `disk` ≤ 30 %; `pre_etl` raw_data = yes; migrasi tidak sama 40; `PP_OFFSITE_KIND` bukan `none` (K9 dan 7.7 berubah: salinan off-site wujud)
- Bila henti: tiada apa berubah, jangan beku. `verify` gagal: K1 tidak boleh dilaksanakan, kembali kepada pengguna.
- Minit: 3

**0.6b Baca kandungan `pre_etl` (kiraan sahaja, tiada baris)**
- Siapa: operator di UAT
- Arahan (**BELUM DISAHKAN**: dibina daripada corak `restore-point.sh:119`, `pg_restore --data-only -t`; tiada dalam repo sebagai arahan):
```
F="$(ls -t /var/backups/pretasiplus/restore-points/pre_etl-*.dump | head -1)"
for t in users user_roles tiers school_packages questions papers blueprints curriculum_nodes; do
  printf '%s ' "$t"; $PC exec -T db pg_restore --data-only -t "$t" -f - < "$F" | awk '/^COPY /{f=1;next} /^\\\.$/{f=0} f' | wc -l
done
```
- Jangkaan: `users 5`, `tiers 4`, `user_roles` ≥ 1, `school_packages` > 0 (ETL membacanya pada 3.7, sebelum seed; `class-steps.ts`:251); `questions`, `papers`, `blueprints`, `curriculum_nodes` tercatat (seharusnya 0). Admin aktif dibaca selepas restore di 3.4.
- Henti jika: `users` bukan 5, `tiers` bukan 4, `school_packages` 0, `questions` > 0
- Bila henti: tiada apa berubah. Laporkan kepada pengguna sebelum K1 diteruskan.
- Minit: 2

**0.7 Rekod apa yang akan hilang oleh restore (K1 sudah diputuskan), baca sahaja**
- Siapa: operator di UAT
- Arahan:
```
$PSQL -c "SELECT (SELECT count(*) FROM users WHERE legacy_source IS NULL) AS users_v2,
 (SELECT count(*) FROM users WHERE legacy_source IS NULL AND created_at >= '2026-10-27') AS users_v2_baru,
 (SELECT count(*) FROM practice_sessions WHERE legacy_source IS NULL) AS sesi_v2,
 (SELECT count(*) FROM questions WHERE legacy_source IS NULL) AS soalan_v2,
 (SELECT count(*) FROM papers) AS papers, (SELECT count(*) FROM blueprints) AS blueprints,
 (SELECT count(*) FROM curriculum_nodes) AS dskp;"
$PSQL -c "SELECT count(*) FILTER (WHERE r.role='admin') AS admin_v2 FROM users u JOIN user_roles r ON r.user_id=u.id WHERE u.legacy_source IS NULL AND u.is_active AND NOT u.is_suspended;"
```
 (Baca-sahaja, nama jadual disemak pada skema R1. **BELUM DISAHKAN** pada skema 0091; satu nama yang tiada akan ralat tanpa kerosakan.)
- Jangkaan: kiraan direkod; `users_v2` = 5 (fakta)
- Henti jika: `users_v2_baru` > 0, atau `papers`/`blueprints`/`dskp`/`soalan_v2` > 0: ini kerja selepas 27 Oct yang akan hilang
- Bila henti: beri nombor kepada pengguna dan minta pengesahan semula K1. Tiada apa berubah.
- Minit: 3

**0.8 Geran D1 `articles.body`** (serentak dengan 0.9)
- Siapa: pemilik .cloud; operator dump jana skrip
- Arahan, di `.cloud`, metadata sahaja: `SELECT column_name FROM information_schema.columns WHERE table_schema = '<db>' AND table_name = 'articles' ORDER BY ordinal_position;`. Di PC dump (checkout `cb7332d0b`): `npm run -s dump:grants -w @pp/api -- --database <db> --account "'pp_dump_ro'@'<host>'"`. Pemilik .cloud menjalankan baris `articles`. Jangan langkau.
- Jangkaan: `body` tersenarai; GRANT lulus; `pp_dump_ro` wujud (**tidak direkod** sama ada akaun masih ada atau sudah di-drop; jika tiada, pemilik .cloud cipta semula mengikut prosedur dump)
- Henti jika: `body` tiada, GRANT gagal pada lajur, akaun tiada dan tidak boleh dicipta
- Bila henti: jangan beku. Spec dan DB tidak sepadan = perlu pembangun.
- Minit: 10

**0.9 PC dump dan nilai** (serentak dengan 0.8)
- Siapa: operator dump
- Arahan: **BELUM DISAHKAN** (`npm ci`, laluan klon): checkout `cb7332d0b3b532a2ac93784e837f92afb874b73a` di PC dump, `npm ci`. `CLOUD_MYSQL_DEFAULTS_FILE` menunjuk fail pilihan mode 600 di luar repo; `ANON_HMAC_KEY_FILE` tidak ditetapkan.
- Peraturan PC dump (pelan 4.6, kekal): cakera disulitkan, **tiada ejen AI atau sesi awan**, tiada perkongsian skrin, tiada folder cloud-sync.
- Nilai:
  - **`--as-of=2026-11-03`** dalam 3.6, 3.7, 3.10, 3.11. Jika eksport beralih ke tarikh MYT lain, tukar semuanya dan laporkan. (Pelan 4: `--as-of` ialah tarikh MYT eksport.)
  - `--content-owner` = id admin aktif, baca **selepas restore** di 3.4.
  - `--files-dir` ikut K3.
- Henti jika: mana-mana syarat PC tidak dipenuhi
- Bila henti: guna PC lain atau tangguh
- Minit: 10

**0.10 Kluster sementara**
- Siapa: operator di UAT
- Arahan: `$S throwaway-up`
- Jangkaan: `THROWAWAY UP: container ..., database <db>_staging, ... archive_mode=off`
- Henti jika: `already running`, `pgdata exists`, tidak sedia dalam 2 min
- Bila henti: `$S throwaway-down`, ulang sekali
- Minit: 2

**0.10b K9: akses dan salinan sedia ada**
- Siapa: operator di UAT; pemilik sahkan senarai akaun
- Arahan (**BELUM DISAHKAN**, arahan Linux am, bukan dari repo, kecuali `$R raw-check`):
```
sudo stat -c '%U:%G %a %n' /srv/pretasiplus/stage /srv/pretasiplus/migration-out
getent group docker sudo ppdeploy
who
sudo wc -l /root/.ssh/authorized_keys
sudo find /srv /var/backups /home /tmp -xdev \( -name 'pp-cutover-dump-*' -o -name '*.gpg' \) -printf '%p\n' 2>/dev/null
sudo find /srv/pretasiplus/stage -mindepth 1 -maxdepth 1 -printf '%f\n'
$R raw-check
```
- Jangkaan: `ppdeploy:ppdeploy 700` untuk `stage`; `1000:1000 700` untuk `migration-out` (`production-migration-slot.md` bahagian 1); ahli kumpulan dan kunci SSH root hanya yang pemilik sahkan, disenaraikan mengikut peranan (REQ-B-113); tiada `.gpg` atau dump lama; `stage` hanya `pgdata`. `raw-check` direkod untuk K9b.
- Henti jika: akaun lain; mode lain; dump lama wujud
- Bila henti: tiada apa berubah. Pemilik putuskan. **Jangan padam fail yang tidak dikenali tanpa keputusan pemilik.**
- Minit: 5

**0.11 GERBANG sebelum beku, pada T0 − 0:15 (semua mesti ya, kalau tidak jangan ke 1.1)**
- Siapa: operator di UAT; pengguna sahkan
- Semak:
  1. Sijil (**BELUM DISAHKAN**, openssl am, baca sahaja): `sudo openssl x509 -in /srv/pretasiplus/letsencrypt/live/prestasiplus.cloud/fullchain.pem -noout -subject -enddate -ext subjectAltName`. Jangkaan: `prestasiplus.cloud`, `www`; luput 28 Jan 2027 (> 60 hari, `production-vps.md`:701).
  2. `sudo grep -c '^COOKIE_DOMAIN=' /etc/pretasiplus/api.env` → `0`.
  3. Pemegang DNS **hadir dan sudah log masuk** panel; A apex boleh ditukar.
  4. Arahan beku **dan** nyahbeku `.cloud` ada secara bertulis daripada pemilik .cloud.
  5. Jawapan bertulis: K2, K3, K5, K7b, **K10**. K7a sudah dijawab sebelum bahagian 0.
  6. Masa: T0 + 4:20 tidak melebihi `T_PUPIL`.
  7. Team B mengesahkan `<R1_SHA>` dengan CI akhir hijau. Tanpanya jangan beku: selepas 3.2 API turun sehingga deploy R1. Bandingkan dengan pokok yang dilatih (**BELUM DISAHKAN**, git am, baca sahaja):
     `git diff --stat 43fef0510 <R1_SHA> -- deploy/vps compose.yaml apps/api/prisma/migrations docs/ops/sql src/app/prototype-scope.ts` → **kosong**.
     `git diff --name-only 43fef0510 <R1_SHA> -- apps/api/prisma/seed` → kosong, atau hanya fail profil e2e dari `r1/a4-e2e-chapter-seed`. Selain itu: HENTI, Team B nilai semula.
  8. Pemilik .cloud dan operator dump hadir; akaun `pp_dump_ro` boleh dibuka. **Pemilik boleh dihubungi hingga T0 + 5:30 dan sepanjang tempoh rollback (switch + 4 jam).**
- Henti jika: mana-mana tidak
- Bila henti: tiada apa berubah. `sudo systemctl start pp-backup.timer pp-cert-renew.timer`, `$S throwaway-down`. Tangguh.
- Minit: 5

---

## 1. Beku `.cloud`

**1.1 Notis** (K7b). Siapa: operator dump. Teks diluluskan pengguna. **BELUM DISAHKAN:** saluran dan teks tiada dalam repo. Minit: 5.

**1.2 Beku**
- Siapa: pemilik .cloud (hadir)
- Arahan: **BELUM DISAHKAN.** Arahan mod baca-sahaja atau penyelenggaraan `.cloud` tiada dalam repo ("Perlu pengesahan", pelan :203, :309). Pemilik .cloud berikan arahan beku **dan** nyahbeku dahulu. Jangan reka.
- Jangkaan: baris pengesahan, `T-freeze` (= T0 sebenar) dalam ISO 8601 +08:00. Kira semula jadual masa dari nilai ini. Bukti tiada tulisan: pemilik .cloud
- Henti jika: tidak disahkan dalam 20 min
- Bila henti: nyahbeku, `$S throwaway-down`, buka semula timer (7.6). UAT tidak berubah.
- Minit: 15

---

## 2. Dump dan pindah

Di PC dump, bash dari akar repo. (Windows: bentuk PowerShell di `cloud-dump-procedure.md` bahagian 8.) `<stamp>` = satu nilai.

**2.1 `dump:check`**
- Siapa: operator dump
- Arahan: buka kunci `pp_dump_ro` oleh pemilik .cloud (hadir; tiada arahan dalam repo, **BELUM DISAHKAN**), kemudian `npm run dump:check -w @pp/api -- --out .migration-out/check-<stamp>`
- Jangkaan: `rules OK`; baris `articles` wujud; `body` **tidak** di bawah "Spec columns missing or not granted"
- Henti jika: akaun terkunci (exit 1 atau 3), `articles` tiada, `body` tiada
- Bila henti: **Blok HENTI** (bawah), nyahbeku
- Minit: 3

**2.2 `dump:cloud`**
- Siapa: operator dump
- Arahan:
```
work="$PWD/apps/api/.migration-out/run-<stamp>-final"; mkdir -m 700 "$work"
npm run dump:cloud -w @pp/api -- --out "$work/raw" --datetime-offset +00:00
```
 Nota `T-dump`. Pemilik .cloud kunci semula `pp_dump_ro`; operator sahkan sambungan ditolak, atau tulis "lock unconfirmed".
- Jangkaan: exit 0; manifest ada dan `raw: true`; tiada `.partial`; kiraan = laporan `dump:check`
- Henti jika: exit 6 atau 130; kiraan berbeza
- Bila henti: jangan ulang tanpa keputusan pemilik. Blok HENTI, nyahbeku. Exit 6 kerana integer besar perlu pembangun.
- Minit: 10 hingga 25 (726 s rehearsal termasuk anonimkan)

**2.3 Fail banner** (K3)
- Siapa: operator dump
- Arahan:
```
mkdir -m 700 "$work/files"
ssh <storage host> 'cd <storage root> && find <banner dir> -type f -print0 | sort -z | xargs -0 sha256sum' > "$work/files/SHA256SUMS"
```
 **BELUM DISAHKAN:** salin fail banner ke `$work/files` pada laluan relatif manifest (saya tidak mengesahkan satu arahan salin dalam dokumen); akses, hos dan laluan storan belum diputuskan ("Perlu pengesahan", prosedur 8.1). Tiada symlink.
- Jangkaan: `SHA256SUMS` di akar `files`; laluan sama teks `image_path`
- Henti jika: akses tiada
- Bila henti: K3, tanpa `--files-dir`, dan `tar` dengan `raw` sahaja
- Minit: 10

**2.4 Sulit dan pindah**
- Siapa: operator dump; operator di UAT menerima
- Arahan (PC dump; `<dir>` = `/srv/pretasiplus/stage/in-<stamp>`, luar repo; volum **tidak disulitkan**, K9):
```
name="pp-cutover-dump-<stamp>.tar.gz.gpg"; out="$work/$name"
( set -o pipefail; tar -C "$work" -czf - raw files | gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"
( set -o pipefail; gpg --decrypt "$out" | tar -tzf - | wc -l ); echo "exit $?"
sha256sum "$out"
scp "$out" <user>@<UAT>:<dir>/
```
 Di UAT:
```
name="pp-cutover-dump-<stamp>.tar.gz.gpg"
sha256sum <dir>/$name
mkdir -m 700 <dir>/x
( set -o pipefail; gpg --decrypt <dir>/$name | tar -xzf - -C <dir>/x )
du -sh <dir>/x <dir>/$name; df -BG /srv/pretasiplus/stage
```
 Frasa laluan diberi secara lisan sahaja, tiada dalam chat atau fail. Selepas sha256 sama, di PC dump: `npm run dump:wipe -w @pp/api -- --dir "$work"`, tutup terowong.
- Jangkaan: exit 0; kiraan `tar -t` = fail + direktori; dua sha256 sama; `<dir>/x/raw/manifest.json` wujud; "local copies deleted"; **ruang bebas stage ≥ 5 x saiz dump** (pelan 3.1, kini dump sebenar diketahui)
- Henti jika: sha256 berbeza dua kali; ruang kurang daripada 5 x
- Bila henti: sekali pindah semula; kali kedua Blok HENTI
- Minit: 15

**Blok HENTI (selepas 2.x atau 3.x, ikut urutan; pelan 4.6).** 1 `npm run dump:wipe -w @pp/api -- --dir "$work"` di PC. 2 padam `.gpg`. 3 di UAT `$S wipe-dump <dir>/x/raw <dir>/$name --missing-ok`, `$S throwaway-down`, kemudian padam `files` dan `<dir>` seperti 3.7b. 4 kunci `pp_dump_ro` atau tulis "lock unconfirmed". 5 tutup terowong. 6 tutup terminal dan musnahkan frasa laluan.

---

## 3. Load dan ETL (dari worktree, shell bahagian 0)

**3.1** `D0` dari 0.5 kekal sebagai jalan balik. Dalam shell baharu, ulang blok shell bahagian 0, termasuk `export PP_IMAGE_TAG=cb7332d0b3b5`, dan semak `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI.

**3.2 Restore `pre_etl` (K1). Langkah sehala: tulisan selepas 27 Oct hilang dari DB kecuali melalui `D0`**
- Siapa: operator di UAT
- Arahan: `$R restore pre_etl` (taip nama DB bila diminta)
- Jangkaan: `RESTORED: pre_etl (...) in <N> s. api and frontend stay stopped...` . **API turun dari sini hingga 5.7 selesai;** `/api` 502 dijangka, DNS belum berubah.
- Henti jika: bukan exit 0
- Bila henti: lihat jadual 8, baris S3. `.cloud` masih beku; UAT turun.
- Minit: 2 hingga 5

**3.3 Staging load dan bukti beku**
- Siapa: operator di UAT
- Arahan: `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI. `$S load --from <dir>/x/raw` kemudian bukti beku: **BELUM DISAHKAN**, "Perlu pengesahan", `slot.sh` tiada subcommand (K5).
 **K9, sejurus selepas `LOAD DONE`, sebelum `copy`:** `$S wipe-dump <dir>/x/raw <dir>/$name` kemudian `sudo find <dir> -maxdepth 2 -printf '%P\n'` (`find` **BELUM DISAHKAN**). Susunan ini lebih awal daripada pelan (B5); `copy` membaca kluster sementara, bukan dump.
- Jangkaan: `LOAD DONE: archive_cloud:38 staging_cloud:89 in <db>_staging, duration_s=...`; `max(updated_at) <= T-freeze`; `DUMP COPIES DELETED`; hanya `x` dan `x/files` tinggal. Amaran `the input carries no column` = dump tanpa lajur: HENTI jika `articles.body`.
- Henti jika: manifes ditolak; kiraan lain; nilai selepas `T-freeze`
- Bila henti: Blok HENTI; jadual 8 S3
- Minit: 5

**3.4 Copy, musnah, baca content owner. Langkah sehala: salinan lama digugurkan, dump sudah dipadam; cuba semula perlu eksport baharu**
- Siapa: operator di UAT
- Arahan:
```
$S copy
$S throwaway-down
sudo test ! -e /srv/pretasiplus/stage/pgdata && echo pgdata-gone
$PSQL -c "SELECT u.id FROM users u WHERE u.legacy_source IS NULL AND u.is_active AND NOT u.is_suspended AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin') ORDER BY u.id;"
$PSQL -c "SELECT (SELECT count(*) FROM tiers) AS tiers, (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations;"
```
 `<dir>/x/files` **dikekalkan** sehingga 3.7b (pelan 3.1). `pgdata` dibuang dengan `rm -rf`, bukan `shred` (`slot.sh`; K9).
- Jangkaan: `STAGE COPY PASSED: archive_cloud:38 staging_cloud:89`; `THROWAWAY DESTROYED`; `pgdata-gone`; sekurang-kurangnya satu id admin (rekod `<owner>`, id pengganti sahaja); **`tiers` 4, `users` 5, `migrations` 40**.
- Henti jika: kiraan bukan 89/38 (exit 4); tiada admin aktif; **`tiers` ≠ 4: henti keras, jangan ke 3.6**; `migrations` ≠ 40
- Bila henti: Blok HENTI. Tiada admin: `admin:bootstrap` dalam `production-vps.md` bab "Admin Pusat bootstrap/reset command", tanya pengguna dahulu. Tiers ≠ 4: laporkan, tiada teruskan tanpa OK pengguna. ETL menyerap tier mengikut label (`catalogue-steps.ts:125`), jadi seed mesti mendahului 3.6. Pembetulan yang tersedia (`/opt/pretasiplus`, shell S3): `deploy/vps/deploy.sh --seed-reference`; **BELUM DISAHKAN** untuk keadaan ini.
- Minit: 5

**3.5 Profil** Siapa: operator di UAT. Arahan: `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI. `$S etl staging:profile`. Jangkaan: `ETL STEP staging:profile exit=0`. Henti jika exit bukan 0. Bila henti: Blok HENTI, jadual 8. Minit: 3.

**3.6 Dry-run `migrate:all`**
- Siapa: operator di UAT
- Arahan (tanpa `--files-dir` jika K3 = tiada): `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI. `$S etl migrate:all --dry-run --as-of=2026-11-03 --files-dir=<dir>/x/files --content-owner=<owner>`
- Jangkaan: `ETL STEP migrate:all exit=0`; jadual entiti teras; reject mengikut sebab. Pada muatan pertama aktiviti "skipped" = dijangka.
- Henti jika: exit 2 `Preflight failed: staging_cloud.articles lacks column(s) body`; `uid 1000 cannot read`; exit bukan 0; 4 = kunci dipegang
- Bila henti: `setfacl` yang dicetak oleh slot.sh jika isu baca; selain itu Blok HENTI, jadual 8. Jangan guna `migrate:core` atau `migrate:activity` berasingan (`slot.sh` menolak).
- Minit: 5

**3.7 Apply `migrate:all`**
- Siapa: operator di UAT
- Arahan: `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI. `$S etl migrate:all --apply --as-of=2026-11-03 --files-dir=<dir>/x/files --content-owner=<owner>`
- Jangkaan: `ETL STEP migrate:all exit=0`; id run; verify di hujung
- Henti jika: exit bukan 0
- Bila henti: jangan cuba semula atas keadaan separuh. Jadual 8 S3.
- Minit: 5 hingga 20 (29 s pada dump dianonimkan; saiz sebenar UAT belum diukur untuk kod ini)

**3.7b K9: padam `files` dan `<dir>` sejurus selepas 3.7 lulus** (`migrate:questions` tidak membaca `--files-dir`)
- Siapa: operator di UAT
- `slot.sh wipe-dump` menolak `files` kerana tiada `manifest.json`. Arahan (**BELUM DISAHKAN**: dibina daripada corak `cmd_wipe_dump`, `slot.sh`; `<dir>` ialah laluan penuh, semak dahulu):
```
sudo find <dir>/x/files -type f -exec shred -u -n 1 -z {} +
sudo rm -rf -- <dir>/x/files
rmdir <dir>/x <dir>
test ! -e <dir> && echo dir-gone
```
- Jangkaan: `dir-gone`; catat dalam senarai custody. Jika K3 = tiada: tiada `files`, `rmdir` sahaja.
- Henti jika: `rmdir` kata tidak kosong. Bila henti: senaraikan nama fail sahaja, laporkan.
- Minit: 2

**3.8 `migrate:verify` dan smoke `Z0`**
- Siapa: operator di UAT
- Arahan:
```
$S etl migrate:verify
$PSQL < docs/ops/sql/smoke-readonly.sql
```
 (**Versi fail penting.** Fail `cb7332d0b` ada X4 dan X5 (102 baris pada rehearsal); fail `43fef0510` tiada (91 baris). Di sini guna **fail worktree** pada stage `cb7332d0b`. Fail tiada meta-command psql; `$PSQL <` boleh.)
- Jangkaan: exit 0 dan baris `verify pass`; **`Z0` = 0**, tiada `ok` = `FAIL`; `X3`, `X5` = `ok`; `X2` = 0; F10 `ok`. **Baca lajur `ok`, bukan exit code psql.**
- Henti jika: mana-mana di atas gagal; sebab reject baharu yang pengguna belum terima
- Bila henti: jadual 8 S3
- Minit: 5

**3.9 Bukti imej** Siapa: operator di UAT. Arahan: `$PSQL -c "SELECT DISTINCT git_sha FROM etl_runs;"` (**BELUM DISAHKAN**: lajur disebut dalam komen `slot.sh`, bentuk SELECT bukan dari repo). Jangkaan: `cb7332d0...` sahaja. Henti jika sha lain: laporkan. Minit: 1.

**3.10 `migrate:questions` sekarang, sebelum R1: dry-run**
- Siapa: operator di UAT
- Sebab: 0100 mesti menukar `published` → `approved` selepas soalan masuk; imej `cb7332d0` menulis `published` dan akan ditolak CHECK jika 0100 sudah jalan (inferens; tidak dilatih). Rehearsal: `published` → `approved` lulus.
- Arahan: `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI. `$S etl migrate:questions --as-of=2026-11-03`
- Jangkaan: `migrate:questions dry-run: run <id> <status>`; baris recon; `note <name>: <n>`; `eligible` > 0; `warning:` tiada bab = dijangka (D89), laporkan sahaja
- Henti jika: exit 1, 2, 3, 4; reject > 0.5 % dari sumber; sebab baharu; kod `excluded.type.*` yang kelihatan MCQ
- Bila henti: tiada tulisan. Pelan: boleh buka tanpa bank soalan hanya dengan keputusan pengguna; ini R1 Bijak, jadi kemungkinan besar perlu tangguh (inferens). Jadual 8.
- Minit: 5

**3.11 Apply `migrate:questions`**
- Siapa: operator di UAT
- Arahan: `$PC config --images | grep migrate` mesti tunjuk `:cb7332d0b3b5`, jika tidak HENTI. `$S etl migrate:questions --apply --as-of=2026-11-03` kemudian `$S etl migrate:verify` kemudian `$S etl migrate:questions --as-of=2026-11-03` (ulang dry-run)
- Jangkaan: `run <id> succeeded`; `loaded = eligible − rejected`; `verify pass`, baris soalan `ok`; dry-run kedua dalam fail `report:` `inserted` 0, `updated` 0. Rekod kiraan `held_*` untuk pengguna. Jumlah dibandingkan 406,396 UAT lama (CLOUD-HANDOFF).
- Henti jika: exit bukan 0; recon bukan `ok`; beza besar tanpa sebab
- Bila henti: jadual 8 S3
- Minit: 5 hingga 10

**3.13 `gonogo` dan semakan K9 selepas load**
- Arahan: `$S gonogo` ; `sudo find /srv /var/backups /home /tmp -xdev \( -name 'pp-cutover-dump-*' -o -name '*.gpg' \) -printf '%p\n' 2>/dev/null` (**BELUM DISAHKAN**, Linux am)
- Jangkaan: `throwaway: none running`; `stage: archive_cloud:38 staging_cloud:89`; akhir `complete`; carian kosong. **Perbezaan yang diketahui:** `api` bukan 200 sebab api dihentikan restore. 
- Henti jika: baris lain `NO-GO`. Minit: 2.

---

## 4. Ulang semakan pre-live (DB 0091, data baharu)

**4.0 Nama tahap (rehearsal: ini menentukan apa murid nampak)**
- Siapa: operator di UAT
- Arahan: `$PSQL -c "SELECT code, stage, is_active FROM education_levels ORDER BY code;"`
- Jangkaan: `T4`, `T5` wujud dan aktif. ETL mengambil T4/T5 daripada nama sahaja (`Tingkatan N` atau `Form N`, `transform/reference.ts`:36); nama lain jadi `LVL<id>`.
- Henti jika: tiada `T4`/`T5`, atau `LVL*` pada tahap menengah. Rehearsal: `questionCount` 0 sementara semua lain hijau; `/api/ready` 200 tidak membuktikan apa-apa di sini.
- Bila henti: jangan deploy. Lapor kepada pemilik. S3.
- Minit: 1

**4.1 Kiraan** (checklist seksyen 1; runbook 0 item 6, 8, 9). Siapa: operator di UAT. Arahan:
```
$PSQL -c "select count(*) from users where email ilike '%@demo.test';"
$PSQL -c "select count(*) from users where email ~ '^[0-9]{6}@prestasiplus\.my$' and ic_hash is not null;"
$PSQL -c "select count(*) from tiers;"
```
Jangkaan: **0**; **rekod**; **4**.
Henti jika: demo > 0 (**tiada live**); enam digit > 0 (**pengguna putuskan sebelum live**, jangan ubah akaun secara manual; REQ-B-103 ialah sebelum load); tiers ≠ 4.
Bila henti: henti dan lapor kepada pengguna; ke go/no-go 5.0 dengan keputusan. Minit: 5.

**4.2 Sesi menyekat** Siapa: operator di UAT. `$PSQL -c "SELECT pid, usename, state, xact_start, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle' AND pid <> pg_backend_pid() ORDER BY xact_start;"` Jangkaan: tiada sesi menyekat. Minit: 1.

**4.3 `pg_trgm`, hak** (checklist :45-47). `$PSQL -c "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';"` → 1 baris. `$PSQL -c "SELECT has_database_privilege('pp_owner', current_database(), 'CREATE');"` → `t`. Henti jika: selain itu. Selepas restore ini mesti disemak semula. Minit: 2.

**4.4 Stimulus 3.7 dan 3.7d** Jalankan selepas deploy (5.9), kerana SELECT merujuk skema R1 (inferens; `papers` kosong selepas restore dijangka).

---

## 5. Deploy R1 (`r1-operator-checklist.md`, `r1-runbook.md`)

**5.0 GO/NO-GO pemilik (kira-kira T0 + 2:00)**
- Siapa: pemilik, atas bacaan operator di UAT
- Syarat: 3.8 `verify pass` dan `Z0` = 0; 3.11 `verify pass`; 4.0 dan 4.1 sudah dibaca; `<R1_SHA>` CI akhir hijau; 5.7 boleh bermula sebelum T0 + 3:15; T0 + 4:20 tidak melebihi `T_PUPIL`.
- No-go atau selepas had: jadual 8, S3.
- **Selepas 5.7 tiada lagi jalan pulang yang murah.**

**Dari sini kembali ke `/opt/pretasiplus`.** Selepas 5.1, untuk **setiap shell baharu** (r1-release-notes "Shell setup"):
```
cd /opt/pretasiplus
export PP_IMAGE_TAG=$(git rev-parse --short=12 HEAD)
export PP_BACKUP_KEEP_AUX=20
PC="docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env"
R=deploy/vps/migration/restore-point.sh
PSQL_RO='PGPASSWORD="$POSTGRES_PASSWORD" PGOPTIONS="-c default_transaction_read_only=on" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"'
psql_ro() { $PC exec -T db sh -c "$PSQL_RO" sh "$@"; }
PSQL=psql_ro
```
Jangkaan `$PC config --images`: `:<R1_TAG>`.

**5.1 Checkout R1**
- Siapa: operator di UAT
- Arahan: **BELUM DISAHKAN** (arahan git am; dokumen hanya menyatakan "release checkout"): `git -C /opt/pretasiplus fetch origin && git -C /opt/pretasiplus checkout --detach <R1_SHA>`. Semak: `git rev-parse HEAD` = `<R1_SHA>`; `git merge-base --is-ancestor 2fabf472 HEAD && echo has-BASE-213` (checklist :40).
- Jangkaan: `has-BASE-213`; `git status --porcelain --untracked-files=no` kosong (`deploy.sh` menolak jika kotor)
- Henti jika: fail tempatan diubah. Bila henti: laporkan, jangan `--allow-dirty`.
- Minit: 2

**5.1b `VITE_PROTOTYPE_SCOPE=on` (keputusan pemilik), sebelum bina imej R1**
- Siapa: operator di UAT
- Arahan: `sudoedit /etc/pretasiplus/prod.env`, tukar `VITE_PROTOTYPE_SCOPE=off` kepada `VITE_PROTOTYPE_SCOPE=on`. Semak: `grep -c '^VITE_PROTOTYPE_SCOPE=on$' /etc/pretasiplus/prod.env` dan `$PC config | grep VITE_PROTOTYPE_SCOPE` (**BELUM DISAHKAN**, bentuk grep dan `config` bukan dari repo).
- Sebab: build arg (`compose.yaml`:21, `docker/frontend/Dockerfile`:21), dibakar ke dalam bundle semasa bina. Tukar selepas bina tiada kesan. Fail di luar checkout, jadi pokok tidak jadi kotor.
- Jangkaan: `1`; `config` menunjukkan `on`.
- Henti jika: selain itu. Bila henti: betulkan sebelum 5.2.
- **Nota:** job CI e2e @api membina dengan `on` (`.github/workflows/frontend.yml`:216), jadi nilai ini sama dengan CI; UAT `off` yang berbeza. Mesej penolakan menyebut "prototaip" dan akan dilihat pengguna sebenar.
- Minit: 1

**5.2 Bina imej R1 (checklist A7)**: `export PP_IMAGE_TAG=$(git rev-parse --short=12 HEAD); $PC build api migrate frontend`. Jangkaan: tag `<R1_TAG>`. Henti jika gagal bukan rangkaian. Minit: 11.

**5.3 REQ-B-080 (A2)**: `sudo grep -c '^THROTTLE_GLOBAL_PER_MINUTE=3000' /etc/pretasiplus/api.env` → `1` (**BELUM DISAHKAN** bentuk grep; nilai disahkan oleh REQ-B-103). Minit: 1.

**5.4 Sandaran B0 (checklist B0, runbook 2.2)**
- Arahan: `deploy/vps/backup/backup.sh --tag pre-deploy --no-files`, kemudian `D=<fail absolut>; $PC exec -T db pg_restore --list < "$D" > /dev/null; echo $?`
- Jangkaan: `0`. Rekod nama dan sha256. **Ini jalan balik sebelum 0100, memegang `archive_cloud` belum diminimumkan, tanpa `staging_cloud`.**
- Henti jika: selain `0`. Bila henti: jangan deploy. Minit: 5 hingga 15.

**5.5 `lock_timeout` (runbook 2.4)**: `sudoedit /etc/pretasiplus/migrate.env`, tambah `options=-c%20lock_timeout%3D5s` pada `DATABASE_URL`. **Keluarkan semula di 5.10, atau pada laluan henti 5.7.** Minit: 2.

**5.6 Tingkap dan pra-kiraan**: `$PSQL` kiraan runbook 3.1, simpan. `deploy/vps/deploy.sh --dry-run`. Jangkaan: `preflight passed`; `PP_DOMAIN` masih `uat.prestasiplus.cloud` (ditukar hanya di bahagian 6). Henti jika: dry-run gagal. Minit: 5.

**5.7 Deploy (checklist B1)**
- Siapa: operator di UAT, pengguna beri arahan
- Arahan: `deploy/vps/deploy.sh` kemudian taip domain (`uat.prestasiplus.cloud`)
- Jangkaan: `deploy complete`; 0092 → 0110 berjalan; langkah 8 lulus; `deploy.sh` tidak berhenti antara migrasi. Rehearsal pada 409k baris di Docker Desktop, bukan kotak ini: 0106 47 hingga 96 s, 0100 kira-kira 30 s, `deploy.sh` kira-kira 4 min, migrate 2 min 42 s; rancang tingkap 60 min (checklist seksyen 2)
- Henti jika: mana-mana langkah gagal; P3009
- Bila henti: **checklist seksyen 3, 4 (W1 jika 0105), 5; runbook 2.4, 8.** Jangan `resolve` selepas restore dump (P3011). Jika tidak meneruskan deploy, **keluarkan `options=...` dari `migrate.env`** (5.10) sebelum tamat. Ulang `deploy.sh` dengan `--skip-backup` hanya jika tiada tulisan sejak dump terakhir (`deploy.sh`:309).
- Minit: 5 hingga 10

**5.8 Selepas migrate (checklist B2, B3, B4)**
- Arahan:
```
$PSQL -c "SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"
```
 `$PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "VACUUM (ANALYZE) question_versions"'` (`r1-release-notes.md`:343; tulisan, bukan `$PSQL`; jangkaan `VACUUM`). Ia meliputi ANALYZE runbook 2.4 item 4. `GET /api/ready`, `/api/health` melalui domain UAT.
- `$PC exec -T api sh -c 'echo "$THROTTLE_GLOBAL_PER_MINUTE $TRUST_PROXY_HOPS"'` → `3000 1`
- **Seed rujukan segera, sebelum domain dibuka (checklist :54, runbook 0 item 6; rehearsal):** `deploy/vps/deploy.sh --seed-reference`, kemudian `$PSQL -c "select count(*) from spm_subject_configs;"` dan `$PSQL -c "select count(*) from tiers;"`. Ia mesti mengikuti ETL kerana `subjects` datang dari ETL. Jangkaan: `demo modules skipped`; bilangan baris = berapa daripada 19 kod wujud dalam `subjects` (nombor sebenar dari kod sebenar, bukan fixture); `tiers` 4. Rehearsal: selagi `tiers` 0, `GET /api/dashboard` setiap murid 500 (`M14: no tier is defined`) sementara `/api/ready` 200.
- Henti jika: detection ada baris; ready bukan 200; seed mengisi modul demo. Bila henti: checklist 3 atau 4.
- Minit: 10

**5.9 Selepas deploy (checklist seksyen 6)**
- `$PSQL` runbook 3.3 (kiraan status: `published` tiada lagi, `approved` ≈ jumlah aktif), 3.5d, 3.5e, 3.7, 3.7d.
- **Runbook 3.6 dengan semakan nama tahap:** ketiga-tiga SELECT, `login_count`, `servable`, dan kiraan mengikut subjek. Bandingkan `servable` dengan jumlah 3.11. `login_count` mesti > 0 dan sama dengan jumlah kiraan subjek (kecuali beza D91). Juga `curl -sS https://uat.prestasiplus.cloud/api/public/stats`: `questionCount` sama (bentuk dari rehearsal).
- **Ulang 4.1** selepas seed.
- Jangkaan: 3.7 0 baris; detection 0.
- Henti jika: `approved` sekitar 0, atau semua dalam `review` (**tanda urutan tidak betul**); `login_count` 0 (**nama tahap**, 4.0). Henti, jangan buka.
- Minit: 10

**5.9b Skop `on` berkuat kuasa (bundle yang dihidangkan)**
- Siapa: operator di UAT; pemegang akaun ujian
- Arahan: `$PSQL -c "SELECT r.role, count(*) FROM users u JOIN user_roles r ON r.user_id=u.id WHERE u.legacy_source IS NULL GROUP BY 1 ORDER BY 1;"`. Kemudian di pelayar, log masuk dengan akaun **ibu bapa v2-born** (jika ada), bukan akaun dipindah.
- Jangkaan: amaran **`Peranan ini tidak termasuk dalam prototaip.`**, kekal di `/login`, medan kata laluan kosong, sesi tamat (`LoginPage.test.ts`:284-296). Akaun murid masuk seperti biasa.
- Jika tiada akaun ibu bapa v2-born: **BELUM DISAHKAN**, tiada bukti lain dalam repo. Mencari teks mesej dalam bundle tidak membuktikan nilai suis. Laporkan kepada pemilik; jangan guna akaun dipindah.
- Henti jika: ibu bapa berjaya masuk ke dashboard. Bila henti: semak 5.1b, bina semula dengan `deploy/vps/deploy.sh`.
- **Nota:** penolakan berlaku di frontend selepas log masuk berjaya (ia memanggil `/api/auth/logout`); API sendiri tidak menolak peranan ini.
- Minit: 3

**5.10 Keluarkan `lock_timeout`** `sudoedit /etc/pretasiplus/migrate.env`, keluarkan `options=...`. Minit: 1.

**5.11 DSKP, Kontrak, M02 (checklist B5, B7; runbook 4, 5)**
- DSKP (checklist 6): semak `education_levels` ada T4, T5 dan `subjects` sekurang-kurangnya 11 kod asas (release notes 3.1). Kemudian `$PC run --rm --no-deps migrate npm run dskp:load -w @pp/api -- --dry-run --create-missing-subjects`; sama tanpa `--dry-run`; dry-run lagi: setiap lajur insert 0.
- Kontrak: Admin Pusat cipta dan tekan Sahkan mengikut runbook 5.2 (D95; tiada seed).
- **M02: pemilik putar kata laluan lalai selepas load** (rotasi 2 Nov hilang oleh restore; Q23: masih tertunggak; 6.8 pada sign-off ditick semula hanya selepas pengesahan).
- Henti jika: loader gagal. Bila henti: laporkan; Jana Kertas tanpa blueprint Disahkan tidak boleh berjalan.
- Minit: 30 hingga 60

---

## 6. `PP_DOMAIN`, nginx, sijil, DNS, `www`, kuki

**Nota rekod.** Tukar `PP_DOMAIN` pada hos hidup **tidak direkod** dalam dokumen. Langkah ini dibina daripada kod `deploy.sh`.

**6.1 Sijil.** Telah disemak di 0.11. **BELUM DISAHKAN** (fail certbot, bukan repo): `sudo grep -E 'authenticator|webroot_path' /srv/pretasiplus/letsencrypt/renewal/prestasiplus.cloud.conf`. Tujuan: pembaharuan guna webroot (`renew.sh`). Tidak menghalang go-live. Minit: 1.

**6.2 prod.env.** Siapa: operator di UAT. `sudoedit /etc/pretasiplus/prod.env`, tukar kepada `PP_DOMAIN=prestasiplus.cloud`. Fail di luar checkout, jadi pokok tidak jadi kotor. Simpan nilai lama. Minit: 1.

**6.3 Gunakan dengan `deploy.sh` (cadangan, bukan cipta semula manual)**
- Sebab: preflight menolak sijil tiada, self-signed atau tamat (`deploy.sh`:176-187); langkah 6 dan 7 mencipta semula api dan edge; langkah 8 memeriksa `/api/health`, `/api/ready`, `/`, `/api/metrics` 404 dan redirect melalui `--resolve` sebelum DNS; dengan tag sama `previous.tag` tidak disentuh (`deploy.sh`:354), jadi `6d81162c87f0` kekal sasaran rollback. Kos: satu lagi sandaran, bina cached, migrate tiada kerja.
- Siapa: operator di UAT
- Arahan: `deploy/vps/deploy.sh --dry-run` kemudian `deploy/vps/deploy.sh`, taip `prestasiplus.cloud`
- Jangkaan: amaran `the new tag equals the current one`; `deploy complete: <R1_TAG>`; `uat.` HTTPS kini ditolak dan port 80 301 ke domain baharu
- Henti jika: mana-mana langkah gagal
- Bila henti: S6. Sandaran manual jika `deploy.sh` tidak boleh: `export PP_IMAGE_TAG=$(cat /var/lib/pretasiplus-deploy/current.tag)`; `$PC config --images | grep -E 'pretasiplus-api:'` mesti `:<R1_TAG>`, jika tidak HENTI; `$PC up -d --no-deps --force-recreate --wait api`; `$PC up -d --wait --no-deps --force-recreate edge`
- Minit: 5 hingga 10

**6.4 Semak tempatan sebelum DNS** (bentuk `_pp_curl_edge`, `lib.sh`; `PP_HTTP_BIND=0.0.0.0` maka 127.0.0.1):
```
curl -sS -m 15 --resolve prestasiplus.cloud:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://prestasiplus.cloud/api/ready
curl -sS -m 15 --resolve prestasiplus.cloud:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://prestasiplus.cloud/
```
Jangkaan: `200`, `200`, sijil sah (tiada `-k`). Henti jika selain itu: S6. Minit: 1.

**6.5 DNS**
- Siapa: DNS (pemegang zon; NS semasa `dns-parking.com`, siapa pemegang: tidak direkod)
- Arahan: **BELUM DISAHKAN**, tindakan panel: A apex `prestasiplus.cloud` → `187.52.120.11`. `www` CNAME dibiarkan. Tiada AAAA (edge IPv4 sahaja; `production-vps.md`:306). Pada 2 Nov TTL A dibaca 300 s dan tiada AAAA (`dig` dari resolver tempatan); baca semula. `uat` kekal. K6 diputuskan. Pemegang DNS telah disahkan di 0.11. Rekod masa pertukaran (switch time).
- Jangkaan: `dig +short prestasiplus.cloud` → `187.52.120.11` (**BELUM DISAHKAN** kerana cache; TTL 300 s)
- Henti jika: panel gagal
- Bila henti: S6
- Minit: 5 + 5 penyebaran

**6.6 `www`.** Fakta: templat ada `server_name ${PP_DOMAIN}` sahaja; `server_name` lalai 443 `ssl_reject_handshake on` (`pp.conf.template`:40-43, :49). Sijil meliputi `www` tetapi nginx tidak menjawabnya. Maka `http://www...` → 301 ke apex, **`https://www...` gagal handshake**. **K6: diterima; ubah templat selepas live.** Catat sebagai isu pasca-live.

**6.7 Tiada tindakan, semak sahaja.** `COOKIE_DOMAIN` tidak ditetapkan (kiraan 0) = kuki hos sahaja; semua log masuk semula (pelan 4.4). HSTS: env tiada, jadi compose default `max-age=300` (`compose.prod.yaml`:200); jangan tambah `includeSubDomains`. `PUBLIC_ORIGINS` kosong: hanya origin API dibenarkan untuk imej artikel/banner; imej artikel luar dibuang sanitiser pada masa ETL (inferens; jumlah tidak diukur). Frontend `VITE_API_BASE_URL: ''` = same-origin, tiada bina semula. Tiada CORS dijumpai dalam `apps/api/src`.

**6.8 `.cloud` lama (187.77.149.107).** Kekal baca-sahaja, tidak dimatikan (pelan :571). Halaman penunjuk (`deploy/cutover/pointer-page/`) **tidak terpakai** untuk DNS: alamat lama berpindah, dan templat tertulis "Mulai 30 Oktober 2026". Akses ke `.cloud` selepas DNS (nama lain, IP): tidak direkod. `admin.prestasiplus.cloud`: `dig` 2 Nov tiada jawapan A; statusnya tidak direkod.

---

## 7. Smoke

**7.1** Semak dari luar (**BELUM DISAHKAN**, arahan am selain checklist :51):
```
PP_DOMAIN=prestasiplus.cloud
dig +short "$PP_DOMAIN"
H="$(curl -sSI -m 15 "https://$PP_DOMAIN/")" && grep -q '^HTTP/' <<<"$H" && ! grep -iE '^(via|cf-ray|x-cache|x-served-by|x-amz-cf-id):' <<<"$H" && echo NO-CDN-HEADERS
curl -s -o /dev/null -w '%{http_code}\n' "https://$PP_DOMAIN/api/ready"
curl -s -o /dev/null -w '%{http_code}\n' "https://$PP_DOMAIN/api/health"
```
Jangkaan: `187.52.120.11`; `NO-CDN-HEADERS`; `200`, `200`. Henti jika mana-mana gagal: 8 S6.

**7.2** Log masuk akaun **v2-born sahaja** (pelan 4.5): **murid, guru, pentadbir sekolah, admin**, iaitu `PROTOTYPE_ROLES` (`prototype-scope.ts`:44). Ibu bapa, penaja dan PPD (juga JPN, ibid. :42) **ditolak semasa log masuk mengikut reka bentuk**, bukan kerosakan; mereka bukan akaun ujian. Kewujudan akaun pentadbir sekolah v2-born: lihat kiraan 5.9b. Akaun dipindah tidak diuji oleh pasukan (minor sebenar). Satu Jana Kertas, satu Latih Tubi SPM, satu kuiz Soalan by Chapter (REQ-B-109; rehearsal: 404 sebelum pembetulan) (runbook 1 langkah 7, 3.6, 5.5; release notes 6.1). Jangkaan: dashboard; tiada 5xx. **Kad subjek di bawah sasaran dikunci (`Locked: 1/40`) dan `Mula Kuiz` menolak di bawah 5 soalan: direka, bukan kerosakan.** Henti jika gagal: R4 (8 S6/S7).

**7.3** `$PSQL < /opt/pretasiplus/docs/ops/sql/smoke-readonly.sql` (fail R1 pada skema R1, 0 FAIL pada rehearsal). Fail `cb7332d0b` atas skema R1 **tidak pernah dijalankan: jangan guna.** **BELUM DISAHKAN pada data sebenar:** rehearsal 0 reject. Fail R1 tiada X4 dan X5, jadi reject yang dijangka akan muncul sebagai `FAIL` X3 (#398): bandingkan entiti dengan X4 di 3.8. F6 atau F9 boleh `FAIL` jika akaun berbendera diubah di sasaran, termasuk rotasi M02 (rehearsal); terangkan dan rekod. `FAIL` lain: HENTI.

**7.4** `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' https://$PP_DOMAIN/api/auth/register` (`production-vps.md`:685; pelan C3). Jangkaan `422` (K8: kekal buka; pelan C3: 422, bukan 403). Selain itu: HENTI, laporkan. Tulisan melalui pendaftaran wujud hanya di v2 (S7).

**7.5** Sijil selepas DNS: `docker compose --profile tls run --rm certbot renew --dry-run` (`renew.sh`:15; gunakan `-f` dan `--env-file` `$PC`). Jangkaan: lulus untuk `prestasiplus.cloud` dan `www`. Gagal = tidak menghalang go-live, sijil hingga 28 Jan 2027, tetapi direkod.

**7.5b K9: semakan akhir salinan**
- Arahan: `$R raw-check` ; carian `.gpg` seperti 3.13 (**BELUM DISAHKAN**, Linux am)
- Jangkaan: tiada `.gpg`; `raw-check` menyenaraikan salinan untuk K9b
- Henti jika: `.gpg` atau `pp-cutover-dump-*` wujud. Bila henti: padam mengikut 3.3, lapor. Minit: 2.

**7.6 Hanya selepas 7.1 hingga 7.5b lulus: hidupkan timer**
- Siapa: operator di UAT
- Arahan: `sudo systemctl start pp-backup.timer pp-cert-renew.timer`. Tiada `pp-restore-drill.timer` di hos ini (fakta 2 Nov).
- Jangkaan: kedua-duanya `Persistent=true`, jadi larian yang terlepas semasa berhenti **berjalan segera**. Jika 02:15 terlepas (tingkap malam, Q29): **`pp-backup` berjalan segera dan memegang kunci kongsi**, jadi tiada `deploy.sh`, `rollback.sh` atau `backup.sh` lain sehingga siap; sebab itu smoke dahulu. `pp-cert-renew` (03:40, 15:40) juga mungkin, tiada kerja kerana sijil > 30 hari. Sandaran seterusnya memegang `archive_cloud` belum diminimumkan (K9b); tiada off-site (`PP_OFFSITE_KIND=none`).
- Henti jika: unit gagal. Bila henti: laporkan; tidak menghalang go-live.
- Rekod masa switch. Pemantauan: `PP_ALERT_WEBHOOK_URL` tiada (REQ-B-103), jadi manual, 4 jam pertama.
- Minit: 2

**7.7 K9b: padam salinan yang tinggal, ikut tarikh pemilik**
- Siapa: operator di UAT, pemilik beri tarikh. Selepas tempoh rollback (switch + 4 jam): load semula tidak selamat lagi (rehearsal), jadi `staging_cloud` tiada guna lagi.
- Tertib (pelan 7): eksport Q9, `migrate:archive-minimise`, kemudian drop:
```
$PC exec -T db sh -c 'exec psql -X -At -v ON_ERROR_STOP=1 -U pp_stager -d "$POSTGRES_DB" -c "drop schema staging_cloud cascade"'
$R take post_drop
$R purge-raw --after post_drop
$R raw-check
```
 (Bentuk `drop` daripada `target_psql`, `slot.sh`, **BELUM DISAHKAN** sebagai arahan terus. `purge-raw` memadam hanya restore point `raw_data=yes` yang lebih lama.)
- **Padam dump `D0`, `D` dan dump harian yang memegang `archive_cloud` belum diminimumkan, serta WAL dan base backup: BELUM DISAHKAN**, tiada arahan dalam repo. `PP_OFFSITE_KIND=none`: hanya senarai custody tempatan (`restore-points/custody.tsv`, `/var/backups/pretasiplus`), tiada S3.
- `archive_cloud` kekal 12 bulan selepas diminimumkan (pelan 7, Q12). Diterima (REQ-B-113).
- `PP_RAW_PURGE_BY` lalai 2026-11-06; tarikh had bergerak mengikut muatan baharu (pelan 7), pemilik sahkan.
- Buang worktree dan imej `cb7332d0b3b5` selepas sign-off: **BELUM DISAHKAN**, tiada arahan dalam repo.

---

## 8. Rollback mengikut peringkat

| Peringkat | Keadaan | Tindakan |
|---|---|---|
| **S0** bahagian 0 | Tiada apa berubah | Stop. `sudo systemctl start pp-backup.timer pp-cert-renew.timer`. `$S throwaway-down` |
| **S1** beku | `.cloud` beku | Nyahbeku (arahan bertulis 0.11; dari pemilik .cloud, **BELUM DISAHKAN**). UAT tidak berubah |
| **S2** dump | Salinan mentah | Blok HENTI; nyahbeku. UAT tidak berubah |
| **S3** selepas 3.2, sebelum 5.7 | UAT dipulihkan/dimuat, **api dan frontend berhenti** | Blok HENTI. Nyahbeku `.cloud` dahulu. (a) `D0`: `production-vps.md` bab 8 langkah 1 hingga 3, hingga `DB ROLES CHECK PASSED`; atau (b) `$R restore pre_etl` kemudian `deploy/vps/db-roles.sh check`. **DB dan peranan dahulu, kemudian hidupkan:** `git -C /opt/pretasiplus checkout --detach 6d81162c87f0a17761df99ba48e2d4f541bcebf7` (jika 5.1 sudah jalan); `cd /opt/pretasiplus; export PP_IMAGE_TAG="$(cat /var/lib/pretasiplus-deploy/current.tag)"` (`6d81162c87f0` selagi `deploy.sh` belum siap; semak); `$PC up -d --wait --no-deps api frontend`; `$PC up -d --wait --no-deps --force-recreate edge`. **Jangan guna `rollback.sh`:** ia mati `already the release that is running` (`rollback.sh`: tag = current, tiada `previous.tag`). **Edge mesti dimulakan dari `/opt`:** bind mount relatif (`compose.prod.yaml`:202-204). **Skop:** imej lama sudah dibina, `up` tidak membina, jadi nilainya kekal `off` walau apa isi `prod.env`. Jika 5.1b sudah jalan, pulihkan `VITE_PROTOTYPE_SCOPE=off` dalam `prod.env` juga: hanya untuk mengelak bina semula kemudian mengambil `on`. Cuba semula memerlukan beku baru dan eksport baru (pelan 6.3 item 4) |
| **S4** `deploy.sh` gagal sebelum langkah 5 | **API sudah turun sejak 3.2 hingga 5.7 selesai**, jadi tiada keluaran lama hidup; `deploy.sh` boleh mencetak "old release still running", abaikan untuk kes ini | Baca mesej, betulkan, ulang `deploy.sh`, dalam had T0 + 5:30. Abort: S3. `.cloud` tetap beku sehingga keputusan. Keluarkan `options=...` dari `migrate.env` (5.10) |
| **S5** semasa/selepas migrate, sebelum DNS | Skema ke hadapan | Checklist 3 dan 4 (W1). **Selepas 0100 commit hanya dump `D` (5.4):** `production-vps.md` bab 8, tiada `migrate resolve` (P3011), kemudian **jangan hidupkan seperti S3: `current.tag` kini `<R1_TAG>`, ia menjalankan R1 atas skema lama.** Guna `deploy/vps/rollback.sh --dry-run --checkout 6d81162c87f0` dan kemudian tanpa `--dry-run`, taip domain (`rollback.sh`:45-63; `--checkout` perlukan baris `history.log` untuk tag itu, ada di pelayan). Sandaran: `git -C /opt/pretasiplus checkout --detach 6d81162c87f0a17761df99ba48e2d4f541bcebf7; cd /opt/pretasiplus; export PP_IMAGE_TAG=6d81162c87f0`, kemudian `$PC up` seperti S3, **tidak pernah `current.tag`**. Skop: imej lama kekal `off`, pulihkan `prod.env`. Dump `D` memegang data dimuatkan, tanpa `staging_cloud`, jadi deploy boleh diulang tanpa dump baru. `.cloud` nyahbeku hanya bila abort |
| **S6** selepas `PP_DOMAIN`, sebelum DNS atau DNS baru | `.cloud` beku, pengguna tidak terjejas | DNS: A kembali ke `187.77.149.107` (TTL 300 s). `sudoedit` `PP_DOMAIN=uat.prestasiplus.cloud`, `deploy/vps/deploy.sh` taip domain itu, atau sandaran manual 6.3 dengan semakan `$PC config --images | grep -E 'pretasiplus-api:'` = `:<R1_TAG>`. Nyahbeku bila keputusan dibuat |
| **S7** selepas DNS, pengguna menulis, dalam 4 jam | Tulisan v2 sebenar | **Keputusan pengguna.** Hentikan tulisan: `$PC stop api`. Semak kiraan tidak berubah 1 min. `$R take post_switch` (shell bahagian 5). DNS kembali. Nyahbeku `.cloud`. Simpan data untuk analisis (pelan 6.3). Tulisan v2 hilang; tiada migrasi songsang. Kata laluan baharu tidak sah di `.cloud` |

**Titik tiada kembali.**
- **Langkah sehala lebih awal:** 3.2 (DB UAT diganti; hanya `D0` membawa balik) dan 3.4 (salinan lama digugurkan, dump dipadam; cuba semula perlu eksport baru).
- **Titik tiada kembali sebenar: saat 0100 commit di dalam 5.7.** `deploy.sh` tidak berhenti antara migrasi, jadi anggap mula 5.7 = melepasinya. Selepas itu hanya dump `D`, tiada undur di tempat.
- **Selepas DNS, pengguna menulis:** data wujud hanya di v2. Had rekod: switch + 4 jam (pelan 6.2, keputusan 22 Oct untuk tetapan lama). Kemudian betulkan ke hadapan. Pengguna sahkan semula angka ini.
- **Had abort:** belum 5.7 = abort S3. Sudah 5.7 = pemilik pilih antara teruskan dan S5. Had sebenar: yang lebih awal antara T0 + 5:30 dan `T_PUPIL`.
- **Selepas DNS jangan load semula:** rehearsal menunjukkan kata laluan pengguna sebenar akan hilang pada baris yang berubah.
