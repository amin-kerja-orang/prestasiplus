# Deploy R1 ke UAT sahaja (Q36)

Operator manusia, di `uat.prestasiplus.cloud` (187.52.120.11), sebagai `ppdeploy`. AI tidak menjalankan arahan ini.

**Tidak disentuh:** `prestasiplus.cloud`, DNS, server `.cloud` lama, ETL, `PP_DOMAIN`. Data UAT sedia ada kekal dan menerima migrasi 0092 ke atas. Pengguna prestasiplus.cloud tidak terjejas.

**SHA:** tip `feature/v3-bijak-r1` pada baris "CI hijau" di papan (`docs/team/MERGE-LOG.md`, cawangan `team/r1-board`). Jangan deploy tanpa baris itu. Tag dikira daripada `HEAD`.

**Baca helaian ini hanya dari `origin/feature/v3-bijak-r1`.** Deploy SHA pada baris CI hijau.

**Status:** urutan ini dilatih pada VM Linux dengan data sintetik (2-3 Nov). Belum pernah dijalankan pada server ini, jadi masa sebenar belum diukur. Rancang 60 minit; UAT turun semasa langkah U7. Output tidak seperti tertulis = HENTI dan laporkan.

**Titik tiada kembali:** U7 (migrasi `0100` tidak boleh diundur di tempat). Selepas itu, jalan balik hanya dump `D`.

## U1. Checkout, DAHULU
`git -C /opt/pretasiplus fetch origin && git -C /opt/pretasiplus checkout --detach <SHA>`, kemudian `git merge-base --is-ancestor 2fabf472 HEAD && echo has-BASE-213` dan `git status --porcelain --untracked-files=no`.
Jangkaan: `has-BASE-213`; status kosong. Tulis tag lama: `cat /var/lib/pretasiplus-deploy/current.tag` (dibaca 3 Nov: `6d81162c87f0`).

## U2. Shell, HANYA selepas U1 (dan setiap shell baharu)
```
cd /opt/pretasiplus
export PP_IMAGE_TAG=$(git rev-parse --short=12 HEAD)
export PP_BACKUP_KEEP_AUX=20
PC="docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env"
PSQL_RO='PGPASSWORD="$POSTGRES_PASSWORD" PGOPTIONS="-c default_transaction_read_only=on" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"'
psql_ro() { $PC exec -T db sh -c "$PSQL_RO" sh "$@"; }
PSQL=psql_ro
```

## U3. Skop ON, sebelum bina (REQ-B-117)
`sudoedit /etc/pretasiplus/prod.env`: `VITE_PROTOTYPE_SCOPE=off` jadi `on`. Semak: `grep -c '^VITE_PROTOTYPE_SCOPE=on$' /etc/pretasiplus/prod.env` memberi `1`. Ia dibakar ke dalam bundle semasa bina, jadi menukarnya selepas bina tiada kesan. **Kesan: ibu bapa, penaja dan PPD ditolak semasa log masuk.** `PP_DOMAIN` kekal `uat.prestasiplus.cloud`.

## U4. Bina imej (UAT masih hidup)
Semak dahulu: `$PC config --images | grep pretasiplus-api:` mesti menunjukkan 12 aksara pertama `<SHA>`, bukan `6d81162c87f0`. Jika ia menunjukkan `6d81162c87f0`: **HENTI**, membina akan menimpa imej rollback. Kemudian `$PC build api migrate frontend`. Henti jika gagal bukan kerana rangkaian.

## U5. Semakan awal
`sudo grep -c '^THROTTLE_GLOBAL_PER_MINUTE=3000' /etc/pretasiplus/api.env` memberi `1`.
`$PSQL -c "SELECT pid, usename, state, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle' AND pid <> pg_backend_pid();"`: tiada sesi menyekat.
`$PSQL -c "SELECT name, default_version FROM pg_available_extensions WHERE name='pg_trgm';"`: 1 baris. `$PSQL -c "SELECT has_database_privilege('pp_owner', current_database(), 'CREATE');"`: `t`. `0106` memerlukannya dan berjalan selepas `0100`.
`$PSQL -c "SELECT id, code, name FROM education_levels ORDER BY id;"`: tahap yang dipakai murid bernama `Tingkatan N` atau `Form N`.
`deploy/vps/deploy.sh --dry-run`: `preflight passed`.

## U6. Backup, kemudian lock_timeout
`deploy/vps/backup/backup.sh --tag pre-deploy --no-files`, kemudian `D="$(ls -t /var/backups/pretasiplus/pp-backup-*-pre-deploy.dump | head -1)"; echo "$D"; $PC exec -T db pg_restore --list < "$D" > /dev/null; echo $?`.
Jangkaan: `0`. **Tulis laluan penuh `D`.** Selain `0`: jangan deploy.
`sudoedit /etc/pretasiplus/migrate.env`: tambah `options=-c%20lock_timeout%3D5s` pada `DATABASE_URL`. Keluarkan di U9, juga jika berhenti di U7.

## U7. Deploy
`deploy/vps/deploy.sh`, kemudian taip `uat.prestasiplus.cloud` pada `Type the domain to confirm:`.
Jangkaan: migrasi 0092 hingga 0110, `deploy complete`. Latihan pada 409k baris: `0100` kira-kira 30 s, `0106` 47 hingga 96 s. `deploy.sh` tidak berhenti antara migrasi.
Henti jika gagal atau P3009: **jangan `migrate resolve`**. Baca `r1-operator-checklist.md` seksyen 3 dan 4, atau "Jalan balik" di bawah.

## U8. Selepas deploy (satu baris pada satu masa)
`--seed-reference` meminta domain ditaip: taip `uat.prestasiplus.cloud`; jika ditampal bersama baris lain, ia berhenti dengan `not confirmed`. Ia menulis semula nama dan harga pakej sekolah serta kategori marketplace mengikut kunci, jadi suntingan admin pada baris itu di UAT hilang.
```
$PSQL -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"
$PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "VACUUM (ANALYZE) question_versions"'
curl -s -o /dev/null -w '%{http_code}\n' https://uat.prestasiplus.cloud/api/ready
curl -s -o /dev/null -w '%{http_code}\n' https://uat.prestasiplus.cloud/api/health
$PC exec -T api sh -c 'echo "$THROTTLE_GLOBAL_PER_MINUTE $TRUST_PROXY_HOPS"'
deploy/vps/deploy.sh --seed-reference
$PSQL -c "select count(*) from tiers;"
$PSQL -c "select count(*) from spm_subject_configs;"
$PSQL -c "select count(*) from users where email ilike '%@demo.test';"
```
Jangkaan: tiada baris gagal; `VACUUM`; `200`; `200`; `3000 1`; `demo modules skipped`; tiers `4`; `spm_subject_configs` mengikut kod yang wujud dalam `subjects`; demo `0`.
Kemudian runbook 3.3 (status soalan: tiada `published`, `approved` hampir jumlah aktif) dan 3.6 (`login_count` lebih 0). Henti jika `approved` hampir 0, atau `login_count` 0: nama tahap mesti `Tingkatan N` atau `Form N`.

## U9. Keluarkan lock_timeout
`sudoedit /etc/pretasiplus/migrate.env`: keluarkan `options=...`.

## U10. Smoke di uat.prestasiplus.cloud
Murid, guru, admin sekolah, admin: log masuk masuk ke papan pemuka. Murid: Latih Tubi dan kuiz bab sampai keputusan. Admin: Kontrak, Pratonton Kolam, Jana Kertas melalui Mod Pelajar. Guru: `/guru/monitoring`, angka murid sama dengan senarai (angka ini turun berbanding sebelum ini, itu dijangka; #349). Akaun ibu bapa buatan UAT, jika ada: ditolak dengan `Peranan ini tidak termasuk dalam prototaip.`, dan murid tetap masuk.

## U11. Kandungan, jika pemilik mahu Jana Kertas di UAT
DSKP dan Kontrak mengikut `r1-go-live-runsheet.md` 5.11, runbook 4 dan 5.2. Jana Kertas memerlukan blueprint Disahkan. Tiada seed untuk ini.

## Jalan balik
**Sebelum U7:** tiada apa berubah pada DB. Pulangkan `prod.env` jika mahu, dan keluarkan `options=`.

**Selepas migrasi bermula:** semak dahulu `r1-operator-checklist.md` seksyen 3 dan 4. Jika pemilik memilih balik ke keluaran lama, pulihkan dump `D`:

Jangan baca `production-vps.md` bab 8 dari checkout lama di hos: arahan `$PC cp` di sana meninggalkan DB kosong.

**Pagar 1.** Isi `D` dengan laluan bertulis dari U6. Kosong = pagar gagal dan tiada `DUMP-OK`.
```
cd /opt/pretasiplus
PC="docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env"
export PP_BACKUP_KEEP_AUX=20
D=''
$PC stop api frontend
deploy/vps/backup/backup.sh --tag drill --no-offsite --no-files
[ -s "$D" ] && (cd "$(dirname "$D")" && sha256sum -c "$(basename "$D").sha256") && $PC exec -T db pg_restore --list < "$D" > /dev/null && echo DUMP-OK
```
- Jangkaan: `...: OK`; `DUMP-OK`.
- Henti jika: tiada `DUMP-OK`: **jangan drop**. Pilih dump lain yang tertulis, atau HENTI dan tanya pemilik. API kekal turun.

**Pagar 2. Satu baris pada satu masa, hanya selepas `DUMP-OK`.**
```
$PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -c "drop database \"$POSTGRES_DB\" with (force)" -c "create database \"$POSTGRES_DB\""' </dev/null
$PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "$D"; echo $?
deploy/vps/db-roles.sh apply
deploy/vps/db-roles.sh check
```
- Jangkaan: `DROP DATABASE`, `CREATE DATABASE`; `0`; `DB ROLES CHECK PASSED`. Kemudian (shell U1) `$PSQL -c "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations;"`: kedua-dua > 0. `check` membuktikan peranan, bukan restore: bukti ialah status keluar dan kiraan.
- Henti jika: `pg_restore` bukan `0`: API kekal turun, ulang dari `drop` dengan dump yang disahkan.
- Kemudian: `deploy/vps/rollback.sh --dry-run --checkout 6d81162c87f0`, dan sama tanpa `--dry-run`, menaip `uat.prestasiplus.cloud`. Jangan hidupkan API sebelum `check` lulus.
Jangkaan selepas rollback: `/api/ready` 200, `current.tag` `6d81162c87f0`. Skop yang dibakar kekal `off` dalam imej lama; pulangkan `prod.env` supaya bina semula tidak berubah.

**Selepas S5, untuk deploy semula:** `git -C /opt/pretasiplus checkout --detach <SHA>`, `export PP_IMAGE_TAG` baharu, dan `VITE_PROTOTYPE_SCOPE=on` semula, kemudian U4 hingga U9.

**Jika `rollback.sh` berkata `already the release that is running`** (migrasi gagal sebelum `deploy complete`), selepas DB dipulihkan:
```
git -C /opt/pretasiplus checkout --detach 6d81162c87f0a17761df99ba48e2d4f541bcebf7
cd /opt/pretasiplus; export PP_IMAGE_TAG=6d81162c87f0
$PC up -d --wait --no-deps api frontend
$PC up -d --wait --no-deps --force-recreate edge
```
Kemudian `/api/ready` mesti 200.

**Selepas `deploy complete`:** abaikan cadangan `rollback.sh <R1_TAG>` yang dicetak; sasaran kekal `6d81162c87f0`.
