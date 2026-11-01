# Nota Keluaran R1: Bijak SPM

Untuk pengguna dan pentadbir (Admin Pusat). Ditulis dalam bahasa mudah; istilah teknikal diletakkan di bahagian "Nota operasi" sahaja.

**Cara membaca nota ini.** Teks dalam tanda petikan ialah teks sebenar yang anda akan lihat di skrin. Perkara yang belum disahkan, atau yang bergantung pada kerja yang belum digabungkan ke dalam keluaran, ditandakan **[PROPOSED]**. Nombor kecil seperti (N1) menunjuk ke catatan hujung di bahagian akhir.

---

## 1. Apa yang R1 bawa

R1 menyambung satu aliran penuh: **soalan dimasukkan, disemak, diterbitkan, dibina menjadi kertas, diduduki murid, ditanda, dan ganjaran diberi.** Di bawah, aliran pentadbir dahulu, kemudian aliran murid.

### 1.1 Aliran pentadbir

**a) Memasukkan soalan (Muat Naik).**
Guru atau Admin Pusat memuat naik fail PDF soalan. Sistem membaca soalan, dan anda menyemaknya satu demi satu di skrin semakan (`Muat Naik`, senarai `Ekstrak`, dan skrin semakan setiap kumpulan). Apabila anda menerima satu soalan, sistem menjadikannya **soalan Draf** yang ada rekod asalnya. Rajah yang dipotong daripada PDF menjadi gambar soalan; dua soalan yang berkongsi satu rajah dijadikan **satu kumpulan** dengan rajah itu dipaparkan sekali sahaja. Syarat penerimaan: unit DSKP mesti ada dalam senarai ("Unit DSKP tiada dalam senarai kurikulum." jika tiada), rajah mesti ada teks alternatif ("Teks alternatif (alt) bagi rajah diperlukan.") dan imej tersimpan ("Rajah belum mempunyai imej tersimpan."). Kod SP yang tidak wujud juga ditolak dengan nama kod itu: "SP "…" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP." **[PROPOSED]** (bergantung pada unit intake-reqs; belum digabungkan).
Soalan juga boleh dimasukkan melalui borang Studio (`Tambah soalan`) atau import CSV.

**b) Semakan, dengan pintu Bab.**
Sebelum soalan Draf dihantar ke Semakan, **Bab mesti dipilih**. Jika tidak, soalan itu ditolak dan tidak bergerak: "Sila pilih bab." Ringkasan di bawahnya: "Soalan belum memenuhi syarat untuk dihantar semakan." Penolakan dibuat **satu baris demi satu baris** apabila anda memilih ramai soalan sekali gus: yang lengkap bergerak, yang tidak lengkap kekal dengan sebabnya. **[PROPOSED]** (pintu Bab datang daripada unit H-A18; belum digabungkan).

**c) Terbitkan soalan = soalan boleh dihidangkan.**
Apabila anda menekan `Terbitkan`, soalan menjadi **boleh dijawab murid** dan dipaparkan di skrin dengan "Soalan diterbitkan — kini boleh dijawab oleh pelajar." Untuk soalan SPM, setiap bahagian mesti ada aras pemikiran dan kertas mesti dipilih ("Bahagian (1) belum ada aras pemikiran." dan "Sila pilih kertas untuk soalan SPM."). Jika soalan itu tidak boleh dipaparkan di mana-mana aktiviti murid, penerbitan ditolak: "Soalan ini tidak boleh dipaparkan di mana-mana aktiviti murid, jadi belum boleh diterbitkan." dengan satu baris sebab bagi setiap aktiviti **[PROPOSED]** (unit servability T45; belum digabungkan). Jika soalan hanya tidak boleh dipaparkan di sesetengah aktiviti, ia tetap diterbitkan dan senarai aktiviti itu boleh dilihat dalam panel "Dilihat murid di".

**d) Membina kertas (Semak Kertas Simulasi).**
Dalam `Kertas`, anda mencipta kertas, memilih soalan daripada kolam setiap bahagian (dengan carian teks), menyusun, menyalin set dan menyunting. Soalan yang berkongsi satu rajah atau petikan ialah **satu kumpulan (D90)**: meletakkan satu ahli meletakkan **seluruh kumpulan**, berturutan; membuang satu ahli membuang seluruh kumpulan; mengubah susunan menggerakkan kumpulan sebagai **satu unit**. Rajah atau petikan dipaparkan **sekali** di atas semua soalan kumpulan itu, dan kumpulan tidak membawa markah sendiri. Satu kumpulan mesti ada sekurang-kurangnya dua soalan: "Kumpulan perlu sekurang-kurangnya 2 soalan." (Kesalahan ini tidak boleh dilangkau.) Anda juga boleh menambah bahagian, menambah dan memadam soalan tambahan, dan menukar kod kertas pada kulit **[PROPOSED]** (unit T48; belum digabungkan).

**e) Terbit kertas.**
Sebelum `Terbitkan`, skrin semakan menyenaraikan semua halangan dengan sebab. Kontrak (blueprint) mestilah **Disahkan**: "Kontrak Simulasi … (versi …) belum Disahkan (status: …); Terbit memerlukan kontrak Disahkan." Pentadbir boleh menerbitkan juga dengan **sebab bertulis** bagi halangan kontrak dan soalan yang belum layak sahaja, dan tindakan itu direkodkan; halangan lain (soalan tiada kunci jawapan, tiada markah, kumpulan terpisah, soalan yang murid tidak boleh dihidangkan) **tidak boleh dilangkau**. Kertas kosong ditolak: "Kertas ini tiada soalan — tidak boleh diterbitkan." **[PROPOSED]** (unit T43b; belum digabungkan). Selepas Terbit, kertas tidak boleh disunting: "Kertas Terbit tidak boleh disunting. Tarik balik dahulu." `Tarik balik` memulangkan kertas ke draf; **percubaan dan keputusan murid yang lepas kekal**.

**f) Laporan Soalan dan Arkib.**
Murid boleh melapor soalan (`Lapor Soalan`; "Laporan berjaya dihantar."). Status laporan: Menunggu, Disemak, Diperbaiki, Dikeluarkan, Ditolak. Apabila admin mengarkibkan soalan daripada baris laporan dan soalan itu ada dalam kertas yang telah diterbitkan, admin diberi amaran: "Soalan ini ada dalam kertas yang telah diterbitkan. Murid tidak boleh memulakan percubaan baharu pada kertas itu sehingga soalan diganti." Murid yang sedang menduduki kertas itu **boleh terus**; percubaan baharu ditolak dengan "Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini." (N1)

**g) Hab Kandungan SPM.**
Hab `Kandungan SPM` menunjukkan satu kad bagi setiap lorong, dengan bilangan yang memerlukan perhatian: `Databank Soalan` ("Bank soalan objektif SPM mengikut subjek."), `Tracking A` ("Set objektif penuh dan lane bahasa."), `Subjektif` ("Soalan berstruktur dan esei."), `Bijak SPM` ("Kertas SPM penuh dalam format sebenar."), `Kertas Subjektif` ("Kertas 2, 3 & 4 percubaan negeri.") dan `Latih Tubi` ("Latihan ikut topik dan bab."). Bilangan perhatian sama dengan apa yang murid sebenarnya dihidangkan. Halaman lorong ada penapis `Subjek`, `Status` dan `Cari`, butang `Tapis` dan `Set Semula`.

**h) Pengawal padam (delete guard).**
Soalan yang sudah diterbitkan atau digunakan pada kertas yang masih dipaparkan kepada murid **tidak lagi boleh dipadam**; gunakan `Arkib`. Lihat bahagian 3. **[PROPOSED]** (belum digabungkan; peraturan akhir belum mendarat).

### 1.2 Aliran murid

**a) Mencari dan membuka kertas.** Murid melihat kertas Terbit dalam `Bijak SPM` dan membuka kulitnya. Kulit mencetak "Untuk Kegunaan Pemeriksa" hanya jika kertas ada bahagian yang ditanda oleh orang (N2). Kertas yang tidak dijumpai, belum diterbitkan, atau sudah ditarik balik memberi: "Kertas tidak ditemui".

**b) Menduduki kertas.** Murid memulakan percubaan, menjawab (jawapan disimpan automatik), menanda soalan untuk disemak, dan memilih soalan bagi bahagian "Pilih N". Rajah kumpulan dipaparkan sekali di atas semua ahli kumpulan. Jawapan betul tidak pernah dihantar kepada murid sebelum Hantar: "Skema hanya didedahkan selepas Hantar". Sistem memaparkan versi soalan yang **dibekukan** semasa kertas diterbitkan; suntingan soalan kemudian tidak mengubah apa yang murid duduki. **[PROPOSED]** (peraturan versi bekukan ialah unit REQ-B-032; belum digabungkan).

**c) Hantar dan keputusan.** `Hantar` menanda soalan objektif serta-merta. Bahagian bertulis menunggu penanda kendiri: "Belum dimarkah — perlu semakan". Hantar dua kali menghasilkan satu rekod sahaja.

**d) Markah kendiri.** Dalam skrin semakan, murid memberi markah bagi bahagian bertulis (`Markah kendiri`; selepas disimpan: "Markah kendiri disimpan"). Markah tidak boleh melebihi markah bahagian itu. Sistem boleh mencadangkan markah daripada kata kunci; murid boleh mengubahnya.

**e) Cuba Lagi.** `Cuba Lagi` memulakan percubaan **baharu** pada kertas yang sama; percubaan lama, keputusan dan sejarahnya kekal. Mesti `Hantar` dahulu: "Hantar percubaan ini dahulu sebelum mencuba semula." Jika kertas sudah ditarik balik: "Kertas ini sudah tidak tersedia untuk dicuba semula."

**f) Ganjaran (syiling dan XP).** Setiap percubaan yang dihantar dalam mod peperiksaan memberi **2 syiling dan 10 XP bagi setiap markah**, sekali sahaja bagi satu percubaan (contoh: kertas 6 markah memberi 12 syiling dan 60 XP), dan menggerakkan kombo (streak) hari itu. Hantar semula yang sama tidak memberi ganjaran kali kedua. Mod latihan, percubaan yang ditinggalkan, dan admin dalam Mod Pelajar tidak mendapat ganjaran. `Cuba Lagi` ialah percubaan baharu dan mendapat ganjarannya sendiri. Apabila markah kendiri menaikkan markah, ganjaran tambahan sebanyak 2 syiling dan 10 XP bagi setiap markah yang bertambah, sekali bagi setiap peringkat, tidak melebihi markah penuh bahagian itu **[PROPOSED]** (unit T38/T40; belum digabungkan; tanpanya markah kendiri tidak memberi ganjaran tambahan).

**g) Lapor.** Murid boleh melapor soalan yang bermasalah daripada skrin soalan. Melapor soalan berstruktur sebelum hantar pertama **[PROPOSED]** (unit REQ-B-049; belum digabungkan).

---

## 2. Had R1 yang diketahui

Ini bukan pepijat yang akan dibetulkan dalam R1; ia keputusan yang diterima untuk keluaran ini.

1. **Tarik balik atau takedown tidak memotong percubaan yang sedang berjalan.** Murid yang sudah memulakan percubaan terus menggunakan versi soalan yang dibekukan sehingga dia menghantar, walaupun soalan itu kemudian diarkibkan melalui takedown sumber. Percubaan baharu dan Kuiz ditolak serta-merta. Takedown yang perlu memotong percubaan berjalan ditangguhkan ke R2. (N1)
2. **Kulit kertas mengikut tanda "ditanda oleh orang" yang semasa.** Jika admin menukar soalan selepas Terbit (contohnya objektif kepada esei) dan menerbitkan versi itu, kulit "Untuk Kegunaan Pemeriksa" mengikut versi semasa, manakala percubaan yang bermula kemudian mendapat versi yang dibekukan pada kertas. Kulit dan penandaan percubaan itu boleh berbeza. (N2)
3. **Ruang perlumbaan semasa Terbit [PROPOSED].** Semakan kebolehhidangan dibaca sebelum transaksi Terbit yang pendek, dan hanya dibaca semula jika set soalan pada kertas berubah. Jika admin lain mengarkibkan satu soalan tepat dalam beberapa saat itu, kertas boleh terbit dengan soalan yang baru diarkibkan. Pentadbir disyorkan tidak mengarkib soalan sambil kertas yang memuatkannya sedang diterbitkan. (N3)
4. **Kadar ganjaran latihan belum disahkan dengan V2 [PROPOSED].** Sesi Latih Tubi dan Databank kini memberi 1 syiling dan 10 mata bagi setiap jawapan betul, mengikut kadar yang dilihat pada sistem lama. Kadar sebenar V2 untuk sesi ini, dan langkah kombo V2, belum dapat disahkan daripada dokumen yang ada; soalan itu terbuka dengan pemilik produk (Q12). Jumlah ganjaran kertas (2 syiling dan 10 XP bagi setiap markah) tidak terjejas. (N4)

---

## 3. Apa yang admin perlu buat secara berbeza

1. **Pilih Bab sebelum Semakan.** Soalan tanpa Bab ditolak: "Sila pilih bab." Pilih Bab dalam borang soalan (Studio, `Sunting`) dahulu, kemudian hantar ke Semakan. Semasa pilihan pukal, baris yang tiada Bab ditolak dan baris lain bergerak. **[PROPOSED]** (bergantung pada H-A18).
2. **Soalan yang telah diterbitkan atau digunakan pada kertas tidak boleh dipadam.** Peraturan yang dimaksudkan: soalan yang dihidangkan kepada murid, atau yang dibekukan pada kertas Terbit (atau kertas ditarik balik yang pernah diduduki), ditolak daripada pemadaman dengan mesej: "Soalan ini tidak boleh dipadam kerana sudah diterbitkan atau digunakan pada kertas yang masih dipaparkan kepada murid. Arkibkan soalan ini sebagai ganti." Gunakan `Arkib` sebagai ganti. Soalan Draf atau Semakan yang tidak dihidangkan dan tidak diletakkan pada kertas yang masih dipegang masih boleh dipadam. **[PROPOSED]** (peraturan ini ialah niat; susulan "hanya yang dihidangkan atau dibekukan menghalang pemadaman" belum mendarat, jadi teks akhir dan skop boleh berubah).
3. **Penjelasan AI mencipta versi draf baharu.** Apabila penjelasan AI ditulis pada soalan yang sudah diterbitkan, diarkibkan atau dibekukan pada kertas, versi itu **tidak ditulis ganti**. Penjelasan dimasukkan ke dalam **versi draf baharu** yang ditandakan hasil AI, dan seorang pentadbir mesti menyemaknya sebelum diterbitkan. Versi yang sedang dihidangkan kekal sama. Soalan Draf atau Semakan yang tiada sesiapa dihidangkan dikemas kini di tempat. **[PROPOSED]** (unit delete-served-guard; belum digabungkan).
4. **Mengedit soalan yang dibekukan.** Menyunting soalan yang sudah diterbitkan atau yang dibekukan pada kertas Terbit mencipta **versi baharu (draf)**; versi lama kekal sama seperti yang murid duduki. **[PROPOSED]** (unit REQ-B-052; belum digabungkan).

---

## 4. Nota operasi

Bahagian ini untuk pasukan operasi. Perintah, urutan dan SQL semakan penuh ada dalam `docs/ops/r1-runbook.md`.

### 4.1 Migrasi 0104 hingga 0107

Semua dijalankan bersama pelepasan API dan FE, dalam urutan nombor, dan semuanya boleh dipulihkan dengan SQL terbalik dalam pengepala fail masing-masing.

| Migrasi | Apa yang ditambah | Perlu tetingkap penyelenggaraan? |
|---|---|---|
| 0104 `paper_section_admin_created` | satu lajur pada bahagian kertas, bagi bahagian yang ditambah admin | Tidak |
| 0105 `gate_facts` | dua lajur pada versi soalan (siapa yang menyunting terakhir: orang atau AI; markah yang diisytiharkan) dan isian semula data | Tidak |
| 0106 `question_stem_trgm` | sambungan **`pg_trgm`** dan dua indeks carian teks pada versi soalan | **Ya.** Indeks dibina tanpa `CONCURRENTLY` (Prisma menjalankan satu fail dalam satu transaksi): **penulisan ke jadual versi soalan menunggu** semasa pembinaan, bacaan tidak terhalang. Anggaran A4 pada 408,000 soalan: kira-kira 20 saat **[PROPOSED]** (belum diukur pada jadual pengeluaran) |
| 0107 `question_paper_kertas_index` | satu indeks untuk penapis Kertas dalam senarai admin | **Ya**, tetapi singkat: kira-kira 0.9 saat pada 408,000 soalan, penulisan menunggu **[PROPOSED]** |

- **Prasyarat `pg_trgm`.** Sebelum tetingkap, semak bahawa sambungan itu tersedia pada pangkalan data: `SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';` mesti memulangkan satu baris. Pada Postgres 13 ke atas ia sambungan dipercayai, tetapi hos terurus mesti membenarkannya; jika `CREATE EXTENSION` ditolak, migrasi berhenti di 0106 dan tiada apa yang berubah.
- **Selepas 0106 dan 0107**, jalankan `ANALYZE question_versions;` (tanpa kunci eksklusif).
- **Perubahan kod dan 0107 diterbitkan bersama.** Pembetulan penapis Kertas (REQ-B-050) dan 0107 mesti dikeluarkan serentak; pembetulan itu sahaja menjadikan penapis Kertas lebih perlahan.
- **Cadangan tidak wajib (pangkalan data sahaja).** Mematikan JIT (`ALTER DATABASE … SET jit = off`) menurunkan senarai admin tanpa penapis daripada median 661 ms ke 445 ms pada 408,000 soalan (ukuran A4).
- **Migrasi lain dalam keluaran yang sama:** 0110 (token imej rujukan, pasukan C). Sejarah penuh dan urutan: runbook bahagian 2 dan 3.

### 4.2 Pembolehubah `SERVABILITY_OVERVIEW_WARM`

- **Fungsi.** Apabila API dimulakan, ia mengira ringkasan kebolehhidangan admin (kad hab Kandungan SPM) **sekali** dan menyimpannya, supaya admin pertama tidak menunggu pengiraan sejuk (kira-kira 30 saat pada bank 400,000 soalan). Ia tidak menyekat permulaan; kegagalan hanya dilog, dan pembaca pertama mengira seperti biasa.
- **Nilai.** `true` atau `false`; **tidak ditetapkan atau kosong = hidup dalam pengeluaran (`NODE_ENV=production`), mati di tempat lain.** Nilai lain ditolak semasa permulaan. Baris yang kosong dalam fail contoh `.env.api.example` ialah sah. (`apps/api/src/common/config/env.schema.ts:154` dan `apps/api/src/modules/questions/serving/overview-warmer.ts` pada cawangan `r1/req-b-022a-a4`.)
- **Syor.** Biarkan tidak ditetapkan; tetapkan `false` hanya jika pemanasan tidak dikehendaki.
- **Had.** Pemanasan berjalan sekali bagi **setiap tika API** semasa mula dan tiada jitter; R1 menjalankan satu tika API. Jika API diskalakan, tambah jitter atau kunci dahulu.
- **Status:** belum dalam pangkalan kod utama (unit REQ-B-022(a), REQ-B-053) **[PROPOSED]** sehingga digabungkan.

---

## Catatan hujung

- **(N1)** Baris REQ-B-032 (B3 NEW-1) dalam `docs/architecture/v2-backend-deviations.md` (2026-11-01), pada cawangan `r1/reqb032-pinned-rule`: "R1 limitation (lead decision, B3 pre-review m4): a running sitting keeps its pinned version until it is submitted … A takedown that must cut into running sittings is KIV for R2."
- **(N2)** Baris T52 (PIPE AC-20.3, R1 limitation) dalam fail yang sama (2026-11-01), pada cawangan `r1/t52-examiner-grid`: "the paper cover's `examinerGrid` follows the LIVE manual flag, a sitting gets the PINNED version".
- **(N3)** Tiada baris yang menamakan ruang perlumbaan ini. Ia dirumuskan oleh penulis nota ini daripada baris R1-T34 (2026-11-01, "Terbit reads the ServabilityService batch before the transaction and re-reads only if the placed set moved under the lock"). **[PROPOSED]**: perlukan pengesahan pemilik unit T34 dan satu baris dalam jadual penyimpangan sebelum dikeluarkan.
- **(N4)** Tiada baris penyimpangan untuk kadar ganjaran latihan. Rujukan: `docs/qa/r1-verify-first-notes.md` bahagian 2.3 dan bahagian 2.5 (kadar V2 untuk Latih Tubi dan Databank tidak didokumenkan; langkah kombo V2 tidak disahkan). Soalan Q12 terbuka dengan pemilik produk. **[PROPOSED]**.
