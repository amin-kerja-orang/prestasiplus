# R1: Pilihan untuk risiko "volum data pelayan tidak disulitkan"

Untuk: pemilik projek. Disediakan: 2026-11-02. Status: **DIPUTUSKAN oleh pemilik pada 3 Nov 2026: pilihan (a), terima dengan mitigasi (Q23 butir 1; REQ-B-108, REQ-B-113).** Pek ini asalnya pilihan sahaja (2 Nov); bahagian lain dikekalkan sebagai sejarah.
Konteks (2 Nov): go-live R1 ditangguhkan (REQ-B-108); go-live kini malam 2–3 Nov sebaik CI akhir hijau dan semua peranan hadir (Q29, REQ-B-120; menggantikan Q23 butir 2). Satu risiko terbuka ialah volum data pelayan produksi **tidak disulitkan (unencrypted) semasa disimpan**.

Asal risiko: `docs/ops/production-vps.md` bahagian 2 ("Disk encryption", tanda `LEAD:`) dan jadual pemboleh ubah `PP_BACKUP_DIR` ("encrypted volume"); `docs/ops/db-backup.md` bahagian "Where backups go" ("Without full-disk encryption do not store backups"). Di papan pasukan: **REQ-B-108** (`docs/team/requests/from-B.md:111` pada `team/r1-board@8614e499`): "Encrypted volume, plan requires it and the host has none: 'Tangguh'"; penghalang (1): "a decision by whoever can accept or fix the unencrypted volume for raw data including minors". Pek ini menjawab REQ-A-063.

## 1. Apa risikonya (bahasa mudah)

Penyulitan cakera ialah kunci pada peti simpanan. Tanpa kunci itu, sesiapa yang **memegang cakera atau salinannya** boleh membaca isinya tanpa kata laluan aplikasi.

**Siapa boleh baca, dalam keadaan apa:**
- Cakera atau "snapshot" dicuri atau bocor di pihak penyedia pelayan (VPS).
- Cakera lama dilupuskan atau digunakan semula oleh penyedia tanpa dipadam dengan betul.
- Kakitangan penyedia dengan akses ke storan.

**Yang TIDAK dilindungi walaupun cakera disulitkan:**
- Pelayan yang sedang hidup dan dibolosi penggodam (cakera sudah "terbuka" ketika itu).
- Kata laluan aplikasi atau pangkalan data yang bocor.
- Pentadbir yang tersalah beri akses, atau fail yang dihantar keluar tanpa disulitkan.

**Data pada volum:** data peribadi murid dan guru (nama, e-mel, kelas), cincang IC (IC hash), pangkalan data PostgreSQL (volum `pgdata`), fail muat naik (volum `apifiles`), dan salinan sandaran jika disimpan setempat di `PP_BACKUP_DIR` (termasuk arkib WAL). Ia termasuk data peribadi kanak-kanak; dokumen ini tidak membuat penilaian undang-undang PDPA. Rujukan: `deploy/vps/compose.prod.yaml`, `compose.yaml` (`pgdata:/var/lib/postgresql/data`), `docs/ops/production-vps.md` bahagian 9.

## 2. Pilihan (a): terima untuk R1 dengan langkah pengurangan risiko

**Masa:** hampir 0 kelewatan go-live.

**Langkah yang tersedia, sahkan di host (dengan rujukan):**
- Salinan luar-tapak disulitkan GPG sebelum keluar pelayan; muat naik tanpa sulit dihalang melainkan `PP_OFFSITE_ALLOW_PLAINTEXT=true` (`deploy/vps/backup/offsite.sh`, `docs/ops/db-backup.md`).
- TLS pada pintu masuk (nginx + Let's Encrypt), `docs/ops/production-vps.md`.
- Peranan DB hak minimum `pp_app` (`deploy/vps/db-roles.sh`), DB tiada port hos.
- Sandaran bertempoh simpanan terhad, dan latihan pemulihan bulanan (`db-backup.md`).

**Maksud mitigasi yang diterima pemilik (Q23 butir 1; REQ-B-113, jawapan pemilik "Ya, terima"):**
1. Fail dump mentah dipadam sebaik sahaja dimuat. **Hanya fail dump itu.**
2. Data mentah selebihnya **kekal tidak disulitkan pada cakera pelayan**: `staging_cloud`, sandaran asas PITR dan WAL terarkib, titik pulih (restore point), dan dump setempat tidak disulitkan (`backup.sh` menyimpannya), sehingga dibersihkan pada tarikh yang ditetapkan. **Tarikh pembersihan belum ditetapkan**; lalai pembersihan mentah 2026-11-06 perlu disemak semula.
3. `archive_cloud` disimpan 12 bulan.
4. "Akses root" bermaksud root **dan** akaun setara root: `ppdeploy` melalui kumpulan docker, dan kunci SSH pada root. Senarai mengikut PERANAN (tanpa nama) disimpan oleh operator.
5. Penyulitan PC dump sendiri kekal diwajibkan.

**Langkah tambahan untuk operator (kerja kecil):**
1. Padam fail dump mentah sebaik muat berjaya; sahkan ia tiada lagi. Dump setempat tidak disulitkan dalam `PP_BACKUP_DIR` dicatat sebagai data mentah yang masih ada sehingga dibersihkan; hanya salinan luar-tapak yang disulitkan menjadi salinan jangka panjang.
2. Padam pangkalan data sementara (scratch) selepas setiap latihan pemulihan; sahkan skrip tidak meninggalkannya.
3. Tetapkan dan catat tarikh pembersihan `staging_cloud`, PITR/WAL dan titik pulih; semak semula lalai 2026-11-06.
4. *(Cadangan operator, bukan sebahagian daripada kata-kata penerimaan pemilik.)* Gunakan snapshot penyedia yang pendek umur sahaja; semak dengan penyedia sama ada storan disulitkan di sebelah mereka.
5. Senaraikan akaun setara root mengikut peranan (`ppdeploy`/docker, kunci SSH root) dan kurangkan yang tidak perlu.
6. Rekod keputusan pemilik bertarikh (di bawah) dan **tarikh semak semula** (cadangan: 30 hari selepas go-live).

**Baki risiko:** cakera/snapshot yang bocor atau dilupuskan di penyedia masih boleh dibaca, termasuk data mentah yang belum dibersihkan. Akaun setara root masih boleh membacanya. Dokumen ini **tidak** menyatakan pematuhan PDPA; ia merekod penerimaan baki risiko oleh pemilik dan mitigasinya (sahkan dengan pemilik/pegawai perlindungan data jika perlu pernyataan pematuhan).

## 3. Pilihan (b): sulitkan dahulu

Semua kerja dibuat oleh **operator manusia**; saya tidak menyentuh pelayan. Anggaran masa ialah **anggaran** sahaja; ukur saiz sebenar dengan `du -sh` pada direktori data (pgdata, apifiles, sandaran) sebelum menetapkan tetingkap.

### (b1) LUKS pada volum baharu + salin data (tetingkap penyelenggaraan)
- **Langkah ringkas:** sandaran penuh B0, cipta/lampir volum baharu, sulitkan dengan LUKS, format, hentikan perkhidmatan, salin data, tukar laluan di compose/fstab/crypttab, mula semula, sahkan. Lihat lampiran.
- **Masa (anggaran):** 2 hingga 4 jam kerja; henti perkhidmatan kira-kira 15 hingga 60 minit untuk salinan terakhir. Skala dengan saiz data: pangkalan data latihan ~409k `question_versions` hanya beberapa GB, jadi salinan mengambil minit, bukan jam. Sahkan dengan `du -sh`.
- **Kunci:** pemegang frasa laluan mesti dinamakan (pemilik, dengan salinan di pengurus kata laluan, bukan dalam repo atau pelayan). Buka kunci semasa boot: **manual** (selamat; setiap reboot perlu manusia) atau **fail kunci/TPM** (reboot automatik, tetapi kunci berada dekat pelayan, perlindungan lebih lemah terhadap pencuri cakera+pelayan).
- **Rollback:** kekalkan volum lama tidak diubah sehingga semua semakan lulus; jika gagal, tukar laluan semula dan mula.
- **Risiko:** kunci hilang = data hilang selamanya; kesilapan fstab/crypttab = pelayan tidak boot (perlu konsol penyelamat); overhead IO kecil; salah salin kebenaran fail (uid 70 untuk postgres).
- **Kesan pada go-live:** lewat beberapa jam (separuh hari termasuk ujian).

### (b2) Pilihan volum disulitkan oleh penyedia (jika ada)
- **Semak dengan penyedia** sama ada volum blok boleh disulitkan semasa dicipta (dan siapa pegang kunci). Jika ada: cipta volum baharu disulitkan, salin data (langkah sama seperti b1, tanpa LUKS).
- **Masa:** 1 hingga 3 jam. **Risiko:** kunci dipegang penyedia, jadi perlindungan terhadap kakitangan penyedia lebih lemah; bergantung pada ciri penyedia.
- **Siapa:** operator. **Kesan go-live:** lewat beberapa jam; boleh ditentukan hanya selepas penyedia menjawab.

### (b3) Bina semula pelayan penuh dengan root disulitkan
- **Masa:** 1 hingga 2 hari (pasang OS, hardening, deploy, pulihkan data, uji). **Risiko:** tertinggi (banyak perubahan serentak), boot manual perlu konsol.
- **Siapa:** operator. **Kesan go-live:** lewat satu hingga dua hari. Perlindungan paling lengkap (OS, log, swap juga disulitkan).

## 4. Pilihan untuk pemilik (tandakan satu; tiada keputusan dibuat untuk anda)

| Tanda | Pilihan | Kelewatan go-live | Baki risiko |
|---|---|---|---|
| [x] **DIPILIH 3 Nov 2026** (Q23 butir 1, `docs/team/QUESTIONS.md`; REQ-B-108, REQ-B-113) | (a) Terima untuk R1 + langkah pengurangan, semak semula pada tarikh: ________ (belum ditetapkan) | ~0 | Cakera/snapshot bocor di penyedia boleh dibaca |
| [ ] | (b1) LUKS pada volum baharu dahulu | beberapa jam | Kunci perlu dijaga; pelayan hidup masih terdedah |
| [ ] | (b2) Volum disulitkan penyedia (selepas disahkan ada) | beberapa jam | Kunci di tangan penyedia |
| [ ] | (b3) Bina semula dengan root disulitkan | 1 hingga 2 hari | Terendah, usaha tertinggi |

Keputusan pemilik: (a) Terima + mitigasi (tarikh 3 Nov 2026; sumber: Q23 butir 1 "Terima + mitigasi" dan REQ-B-113 "Ya, terima", disampaikan oleh Mandor dan ketua pasukan B). Pilihan (b1), (b2), (b3) tidak dipilih dan dikekalkan sebagai sejarah.

## Lampiran operator (English)

Placeholders only: `<VOL_DEV>` new block device, `<MAP>` mapper name, `<MNT>` new mount point, `<OLD_DATA>` current data root. Never write the passphrase to the repo, shell history or a file on the server.

**Pre-checks**
1. Take backup B0: `deploy/vps/backup/backup.sh` (DB dump) plus uploads archive; verify `sha256sum -c` and `pg_restore --list` exit 0; copy B0 off-site (GPG-encrypted).
2. Measure: `du -sh <OLD_DATA> /var/backups/pretasiplus`; new volume >= 1.5x that. Note the Docker data root and where `pgdata`/`apifiles` live (`docker volume inspect`).
3. Console/rescue access confirmed (fstab/crypttab mistake = no boot). Passphrase holder named; offline copy ready.
4. Announce the maintenance window; owner confirms (no action on production without explicit confirmation).

**Steps**
1. Attach the volume. `cryptsetup luksFormat <VOL_DEV>` (enter passphrase), `cryptsetup open <VOL_DEV> <MAP>`.
2. `mkfs.ext4 /dev/mapper/<MAP>`; `mkdir -p <MNT>`; `mount /dev/mapper/<MAP> <MNT>`.
3. Stop services: compose `down` for api, db, edge (keep the maintenance page if configured). Confirm no container uses the volumes.
4. Copy with services stopped: `rsync -aHAX --numeric-ids <OLD_DATA>/ <MNT>/` (keep owners: postgres uid 70, mode 700 on db and WAL dirs). Run a second `rsync` pass and compare `du -sh`.
5. Point the stack at the new path: if Docker data root is moved, set `data-root` in the Docker daemon config; if bind paths are used, update `PP_BACKUP_DIR`, `PP_WAL_ARCHIVE_DIR` in `/etc/pretasiplus/prod.env`. Add `<MAP> <VOL_DEV> none luks` to `/etc/crypttab` and the mount to `/etc/fstab` with `nofail` while testing. Run `systemctl daemon-reload`.
6. Start: compose `up -d` (or `deploy/vps/deploy.sh` per `docs/ops/r1-runbook.md`). Do not delete `<OLD_DATA>`.
7. Verify: `curl -fsS https://<DOMAIN>/api/ready`; login test; row counts (users, migrations) match pre-copy; run `restore-drill.sh` or the restore check on B0 and drop its scratch DB; `lsblk -f` shows `crypto_LUKS`.
8. Reboot test in the window (manual unlock if no keyfile); confirm services return.
9. Keep the old volume 7 days, then wipe/detach and record it. Back up the LUKS header: `cryptsetup luksHeaderBackup <VOL_DEV> --header-backup-file <FILE>` and store it off-server with the passphrase copy.

**Rollback:** `down`, restore previous paths/fstab/crypttab entries, `up -d`, run the ready check; old data is untouched.
