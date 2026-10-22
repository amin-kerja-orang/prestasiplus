# Skrip UAT Demo 23 Oktober 2026

Slug: `uat-demo-23oct`. Tugasan: AZ-10b (separuh AZ, aliran S4 QA). Skrip ini ditulis dalam Bahasa Melayu; laluan (route), id dan nama kod kekal seperti dalam kod.

## 1. Maklumat am

| Perkara | Butiran |
|---|---|
| Tujuan | Panduan langkah demi langkah untuk menguji dan menunjukkan demo PrestasiPlus v2 pada 23 Okt 2026, ikut lima peranan: murid, guru, admin sekolah, ibu bapa dan Admin Pusat. Setiap langkah ada keputusan dijangka supaya penguji boleh mencatat Lulus, Gagal atau Disekat. |
| Tarikh demo | 23 Okt 2026 |
| Tarikh skrip | 21 Okt 2026 |
| URL demo | `<URL demo daripada LEAD>` |
| Mod bina SPA | `VITE_API_MODE=http` (SPA bercakap dengan API sebenar melalui `/api`; bukan data tiruan dalam pelayar). Sumber: `docs/ops/demo-cloudflare-supabase.md` jadual pembolehubah Pages. |
| Sumber SPA | Cabang `be/integration-frontend` @ `d909e1e0` (frontend demo). Skrin, label dan laluan dalam skrip ini dibaca terhadap `d909e1e0`. |
| Sumber API dan seed | `feature/v2-backend` @ `23c98226` (seed profil `poc`; `apps/api/prisma/seed/**`). |
| Nota penyegerakan | Cabang `be/integration-frontend` akan dikemas kini oleh penyegerakan Pembangun 5. Selepas itu, semak semula bahagian "Jurang diketahui" (terutama J-02 dan J-03) dan label skrin sebelum 23 Okt. Pada `feature/v2-backend` `src/` ialah frontend yang berbeza daripada `d909e1e0` (247 fail berbeza dalam `src` dan `e2e`), jadi jangan guna tip itu untuk menyemak skrin demo. |
| Akaun | Semua akaun ialah akaun demo rekaan (`@demo.test`). Kata laluan demo (daripada LEAD). Jangan tulis kata laluan dalam borang ini, tangkapan skrin atau tiket. |

### 1.1 Prasyarat

1. Pelayan demo hidup: `GET <URL demo daripada LEAD>/api/health` memulangkan `status: ok` dan `db: up`. API di Render yang tidur boleh ambil sehingga kira-kira 60 saat untuk bangun pada panggilan pertama (`scripts/demo-smoke.sh`).
2. Smoke test (`scripts/demo-smoke.sh`) sudah lulus pada URL yang sama. Jangan jalankan smoke test, `scripts/demo-walkthrough.sh` atau e2e semasa UAT: ia berkongsi had kadar (log masuk 5 seminit setiap alamat, API 300 permintaan seminit; `scripts/demo-walkthrough.sh` baris 1-15).
3. Pangkalan data demo diseed dengan profil `poc` dan baru disegar semula (`docs/ops/demo-reseed.md`). Nilai nombor dalam skrip ini diambil daripada seed PoC tempatan; pada pangkalan data demo ia boleh berbeza sedikit, jadi tanda "(sahkan semasa demo)" bermaksud bandingkan dengan skrin sebenar, bukan anggap ia tetap.
4. Pelayar: Chrome atau Edge terkini, tetingkap peribadi (incognito) baharu untuk setiap peranan supaya sesi tidak bercampur. Telefon sebenar atau mod peranti pelayar untuk semakan 375px.
5. Satu akaun satu tetingkap. Log masuk dihadkan 5 seminit setiap alamat: jika dapat mesej had kadar, tunggu satu minit.
6. Langkah yang menulis data (hantar kertas, cipta kelas, terbitkan kertas) meninggalkan rekod pada pangkalan data demo. Jalankan sekali sahaja setiap kali pangkalan data disegar semula.

### 1.2 Cara mencatat keputusan

Lajur **Status** dibiarkan kosong dalam dokumen ini dan diisi oleh penguji pada salinan kerja:

| Status | Maksud |
|---|---|
| Lulus | Keputusan dijangka muncul seperti ditulis. |
| Gagal | Keputusan berbeza daripada dijangka. Catat ID langkah, tangkapan skrin dan teks sebenar. |
| Disekat | Langkah tidak boleh dijalankan kerana langkah terdahulu gagal atau kerana jurang diketahui (⚠). Nyatakan sebabnya. |

Peraturan: jangan tandakan Lulus pada langkah yang tidak dijalankan. Langkah bertanda ⚠ yang berfungsi seperti dalam lajur "Keputusan dijangka" dicatat Lulus; jika ia mengikut gelagat jurang (contoh paparan "belum tersedia"), catat Disekat dan rujuk ID jurang (contoh J-02). Teks "(sahkan semasa demo)" bermaksud kod tidak membenarkan kami mengesahkan keputusan di atas kertas: catat apa yang dilihat dalam Catatan.

### 1.3 Pelaporan kecacatan

Laporkan setiap Gagal kepada LEAD separuh AZ pada utas **#113**. Format: ID langkah, peranan dan akaun, URL (tanpa token), saiz skrin, langkah ringkas, dijangka lawan sebenar, tangkapan skrin. Jangan lampirkan kata laluan, kuki atau token jemputan.

## 2. Persona

Semua nama dan e-mel diambil daripada seed (`apps/api/prisma/seed/core/identity.ts`, `core/population.ts`) dan peranan serta label skop disahkan dengan log masuk ke API tempatan. Sekolah: `SMK Demo Satu` (kod `DEMO001`, Selangor, Petaling).

| Peranan (nama seed) | Nama paparan | E-mel | Sekolah / kelas | Apa yang ditunjukkan |
|---|---|---|---|---|
| Murid (`student`) | Murid Demo | `pelajar@demo.test` | SMK Demo Satu, Tingkatan 4, kelas `4 Amanah` | Murid utama dengan data: Bijak SPM (3 percubaan terhantar dalam seed tempatan), latih tubi, syiling, Kelas Saya (`Kelas Demo Tingkatan 4` dan `Kelas Demo Matematik T4`). |
| Murid maju (`student`) | Murid Demo Maju | `pelajarmaju@demo.test` | SMK Demo Satu, Tingkatan 5, `5 Amanah` | Murid dengan kemajuan lebih tinggi (sesi latih tubi BM dan Sejarah dalam seed). |
| Murid kosong (`student`) | Murid Demo Kosong | `pelajar2@demo.test` | SMK Demo Satu, Tingkatan 4, `4 Bestari` | Keadaan kosong (tiada sejarah latihan). Ahli `Kelas Demo Tingkatan 4`. |
| Guru (`teacher`) | Guru Demo | `guru@demo.test` | SMK Demo Satu | Dua kelas: `Kelas Demo Tingkatan 4` (kod `DEMO4S`, 7 murid) dan `Kelas Demo Matematik T4` (kod `DEMO4M`, 6 murid); headcount; Command Center guru. |
| Admin Sekolah (`school_admin`) | Admin Sekolah Demo | `adminsekolah@demo.test` | SMK Demo Satu | Dashboard sekolah, senarai pelajar dan guru, kelas sekolah, laporan. |
| Admin Pusat (`admin`) | Admin Pusat Demo | `admin@demo.test` | Tiada sekolah; skop "Seluruh Negara" | Portal Pentadbiran: Command Center, pengguna, sekolah, bank soalan, Pembina Kertas, muat naik kertas. |
| Ibu Bapa (`parent`) | Ibu Bapa Demo | `ibubapa@demo.test` | Tiada sekolah | Peranan di luar skop prototaip (lihat J-05). Digunakan untuk memeriksa gelagat sempadan dan menerima jemputan. |
| Guru + admin sekolah (pilihan) | Guru Admin Demo | `guruadmin@demo.test` | SMK Demo Satu | Akaun dua peranan; tukar peranan diliputi `scripts/demo-walkthrough.sh` pada aras API sahaja. Tiada langkah UI dalam skrip ini (J-16). |
| Murid tidak aktif | Murid Tidak Aktif Demo | `tidakaktif@demo.test` | SMK Demo Satu | Ujian negatif log masuk. |
| Murid digantung | Murid Digantung Demo | `digantung@demo.test` | SMK Demo Satu | Ujian negatif log masuk. |

Nota: murid tambahan `murid4` hingga `murid8@demo.test` (`Murid Demo Empat` hingga `Murid Demo Lapan`) ialah ahli kelas demo dan muncul dalam senarai guru dan sekolah, tetapi tidak digunakan untuk log masuk dalam skrip ini.

## 3. Cara membaca skrip

Penanda **⚠ J-nn** dalam lajur "Jurang" merujuk kepada jadual "Jurang diketahui" di bahagian 11. Baca jadual itu sebelum demo.

## 4. Murid (`pelajar@demo.test`)

Dalam mod http, murid mendarat di Bijak SPM (`/spm/bijak`) selepas log masuk, bukan di `/dashboard` (`src/app/prototype-scope.ts` `studentHomePath` dan `effectiveLandingPath` pada `d909e1e0`).

| ID | Langkah | Keputusan dijangka | Status | Jurang |
|---|---|---|---|---|
| UAT-MUR-01 | Buka `/login` dalam tetingkap peribadi baharu. | Tajuk halaman "Log Masuk - PRESTASIPLUS". Panel sambutan "Selamat Kembali! 👋". Medan "Alamat Email" (pemegang tempat `nama@email.com`), "Kata Laluan", kotak "Ingat saya", pautan "Lupa kata laluan?" dan "Reset melalui No IC", butang "Log Masuk", teks "Belum ada akaun? Daftar Sekarang 🚀", butang "Kembali ke Laman Utama". Tiada skrol mendatar. | | |
| UAT-MUR-02 | Log masuk dengan kata laluan salah (e-mel `pelajar@demo.test`, kata laluan rawak). | Amaran merah memaparkan teks pelayan: "E-mel/Nama pengguna atau kata laluan tidak sah." (kod `INVALID_CREDENTIALS`, disahkan pada API tempatan). Kekal di `/login`. Butang bertukar "Sedang Memasuki..." semasa menunggu. | | |
| UAT-MUR-03 | Log masuk dengan `tidakaktif@demo.test` (kata laluan demo daripada LEAD). Ulang dengan `digantung@demo.test`. | Amaran merah: "Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir." (kod `ACCOUNT_INACTIVE`, disahkan pada API tempatan untuk kedua-dua akaun). | | |
| UAT-MUR-04 | Log masuk dengan `pelajar@demo.test` dan kata laluan demo (daripada LEAD). | Dibawa ke `/spm/bijak`. Pengepala "Bijak SPM" dengan sarikata "Kertas SPM penuh, bermasa, dengan skema". Bar sisi atau menu murid dipaparkan. | | ⚠ J-06 |
| UAT-MUR-05 | Pada `/spm/bijak`, lihat tab dan senarai kertas. | Dua tab: "Kertas Pilihan" dan "Jana Kertas". Penapis "Subjek" (Semua subjek) dan "Kertas" (Semua kertas, Kertas 1, Kertas 2). Butang "Sejarah Bijak SPM". Seed tempatan mempunyai 5 kertas: "Percubaan SPM Matematik Kertas 1 Set A" (75 minit, 10 markah, selesai), "Percubaan SPM Matematik Kertas 2 Set A" (150 minit, 21 markah), "Percubaan SPM Sains Kertas 2 (Contoh Pendek)" (60 minit, 13 markah), "Percubaan SPM Sejarah Kertas 2 (Contoh Pendek)" (90 minit, 19 markah), "Latihan Demo Matematik Bank Soalan (Contoh)" (20 minit, 6 markah, selesai). Lencana status: "Belum cuba", "Sedang dijawab" atau skor `n / m`; butang "Mula", "Sambung" atau "Cuba lagi". (sahkan semasa demo untuk senarai kertas dan skor pada pangkalan data demo) | | |
| UAT-MUR-06 | Klik "Mula" pada "Percubaan SPM Matematik Kertas 2 Set A" (belum dicuba). | Halaman kulit `/spm/bijak/kertas/<id>`: tajuk kertas, sarikata `Matematik · Kertas 2 · 150 minit · 21 markah · <n> soalan`, bahagian "Arahan", bahagian "Pilih mod" dengan "Mod Peperiksaan" ("Bermasa, tiada markah segera. Skema pemarkahan dipaparkan selepas Hantar.") dan "Mod Latihan" ("Satu soalan pada satu masa dengan Semak dan maklum balas segera."). Butang utama "Mula". | | |
| UAT-MUR-07 | Pilih Mod Peperiksaan dan klik "Mula". Jawab soalan pertama dan kedua (klik satu pilihan). | Dibawa ke `/spm/bijak/percubaan/<attemptId>`. Jam menurun. Pilihan yang diklik ditandakan (`aria-pressed`). Penunjuk simpan memaparkan "Disimpan" selepas setiap jawapan. Pada telefon, butang peta dalam bentuk "Peta N/M". | | |
| UAT-MUR-08 | Muat semula halaman (F5) pada skrin percubaan. | Percubaan yang sama disambung: jawapan dan kedudukan kekal, jam tidak ditetapkan semula (data dari pelayan; `e2e/bijak/student-http.spec.ts` langkah 4). | | |
| UAT-MUR-09 | Pergi ke soalan terakhir, klik "Hantar". | Dialog "Hantar jawapan anda sekarang?" dengan teks "Selepas dihantar, anda tidak boleh mengubah jawapan." dan ringkasan "Belum dijawab: N soalan" serta "Ditanda: N soalan". Butang "Kembali" dan "Hantar". | | |
| UAT-MUR-10 | Klik "Hantar" dalam dialog. | Skrin keputusan `/spm/bijak/percubaan/<id>/keputusan`: tajuk "Sempurna, <nama>!" (skor 90% ke atas), "Hebat, <nama>!" atau "Teruskan, <nama>!", sarikata "Awak dapat X/Y markah." (ditambah "(sementara)" jika belum dimarkah penuh). Bahagian "Markah mengikut bahagian", "Topik untuk disemak" dan "Semakan soalan". Butang "Kongsi", "Kembali ke Home", "Cuba lagi", "Sejarah Bijak SPM". Soalan subjektif boleh memaparkan "N bahagian belum dimarkah — perlu semakan". | | |
| UAT-MUR-11 | Klik "Sejarah Bijak SPM". | `/spm/bijak/sejarah` dengan ringkasan (3 kotak) dan senarai percubaan. Percubaan baharu ialah yang pertama dengan skor yang sama seperti UAT-MUR-10. Seed tempatan ada 3 percubaan terhantar (8/10, 3/6, 10/10) sebelum percubaan baharu. Butang "Semakan" (dan "Sambung" untuk percubaan belum siap). Jika kosong: "Belum ada percubaan". | | |
| UAT-MUR-12 | Pada bar sisi pilih "SPM". | `/spm`: tajuk "Persediaan SPM", sarikata "Latihan lengkap untuk pelajar Tingkatan 4 & 5. ...", kad "Bijak SPM" dan panel "Prestasi SPM Anda". Pautan kad Bijak SPM menuju hab Bijak. Sub-skrin lain (Databank Soalan SPM, Latih Tubi SPM, Tracking A, Subjektif): (sahkan semasa demo). | | ⚠ J-04 |
| UAT-MUR-13 | Pada bar sisi pilih "Latih Tubi" (`/practice`). | Tajuk "Latih Tubi 🎯", sarikata "Pilih subjek dan mula berlatih!". Kad "Soalan by Chapter" (lencana "Mode Baru"), kad subjek dengan lencana "Teras" dan butang "Mula Latihan". API tempatan menyenaraikan 31 subjek; subjek berisi soalan termasuk BM (57), BI, MATH, SCI, SEJ, PI, PM, ADDMATH, PHY, PSV (sahkan semasa demo untuk bilangan). | | |
| UAT-MUR-14 | Pilih satu subjek (contoh Matematik), tetapkan tahap pendidikan, kesukaran dan bilangan soalan, klik "Mula Kuiz". | Halaman konfigurasi memaparkan "Tahap Pendidikan:", "Kesukaran:", "Bilangan Soalan:", "Soalan Tersedia:" dan butang "Mula Kuiz". Jika tidak cukup soalan: "Soalan Tidak Mencukupi". Kuiz bermula di `/practice/<kod>/quiz`; jawab sekurang-kurangnya satu soalan dan hantar. Kemajuan: `/practice/progress` ("Kemajuan Saya") dan `/practice/history` ("Sejarah Latihan") menunjukkan sesi baharu. (sahkan semasa demo untuk teks kuiz dan skrin akhir) | | |
| UAT-MUR-15 | Pada bar sisi pilih "Soalan by Chapter" (`/practice/chapter`). | Tajuk "Soalan by Chapter", sarikata "Latihan tersusun ikut bab buku teks dan DSKP". Dalam seed tempatan `GET /api/practice/chapter-subjects` memulangkan senarai kosong untuk `pelajar@demo.test`, jadi senarai subjek mungkin kosong. Catat apa yang dilihat. | | ⚠ J-12 |
| UAT-MUR-16 | Pilih "Permainan" (`/permainan`). | Tajuk "Zona Permainan" (hero "🎮 Zona Permainan") dengan teks "Main sambil belajar! Kumpul Syiling, naik ranking, dan jadi champion sekolah. Pilih permainan kegemaran kamu." Kad permainan: Papan Bijak (butang "Main Sekarang"), Battle Arena ("Battle!"), Perang Fakta, Benteng Ilmu ("Duel!"), Perlumbaan Matematik ("Lumba!"), Kuiz Relay, Teka Silang Kata, Betul atau Salah ("Mula"), Roda Nasib ("Spin Sekarang!"), Pertandingan Mingguan, Uji Minda, Cabaran Kilat, Jutawan Ilmu, Susun Jawapan ("Susun!"), Tembak Jawapan ("Tembak!"), Sambung Kata, Kad Memori ("Main!"). Jalur bilik terbuka: "Tiada bilik terbuka buat masa ini." (seed tempatan tiada bilik terbuka). | | |
| UAT-MUR-17 | Buka lima permainan solo satu persatu: `/permainan/betul-salah`, `/permainan/cabaran-kilat`, `/permainan/tembak-jawapan`, `/permainan/susun-jawapan`, `/permainan/kad-memori`. | **Sebelum PR #105 digabung (build `d909e1e0`)**: setiap halaman memaparkan keadaan kosong "Fungsi ini belum tersedia dalam demo" (`data-testid=solo-unavailable`). Catat Disekat dengan rujukan J-02. **Selepas PR #105**: permainan boleh dimainkan; Kad Memori memerlukan soalan tahap D1 hingga D4 (J-01); jika 0 kad, catat Disekat dengan rujukan J-01. | | ⚠ J-01, ⚠ J-02 |
| UAT-MUR-18 | Buka `/permainan/roda-nasib`, `/permainan/jutawan`, `/permainan/pertandingan`, `/permainan/uji-minda`. | Setiap satu memaparkan skrin permainan (bukan "belum tersedia") dengan tajuk yang sepadan ("Roda Nasib", "Jutawan Ilmu", "Pertandingan Mingguan", "Uji Minda"). API untuk kesemuanya wujud (`/api/games/roda-nasib`, `/jutawan`, `/pertandingan`, `/uji-minda`). (sahkan semasa demo untuk gelagat penuh) | | |
| UAT-MUR-19 | Buka `/permainan/sambung-kata`. | Halaman "500 - Ralat Pelayan | PRESTASIPLUS". Ini meniru laman live dan bukan pepijat (`src/modules/m16-battle-games/routes/permainan-extra.ts`). Catat Lulus jika halaman ralat ini dipaparkan. | | ⚠ J-11 |
| UAT-MUR-20 | Papan Bijak (`/papan-bijak`) dan Battle Arena (`/battle`): klik "Main Sekarang" dan "Battle!". | Lobi dibuka. Pemadanan pantas dengan bot disokong API (`/api/papan-bijak/quick-match`, `/api/battle/quick-match`; diliputi `scripts/demo-walkthrough.sh` pada aras API sahaja). Gelagat skrin UI: (sahkan semasa demo). | | ⚠ J-13 |
| UAT-MUR-21 | Pilih "Syiling & Token" (`/gamification`). | Papan "Gamifikasi Dashboard" dengan baki syiling. Seed tempatan: 370 syiling, XP 916, tahap 1, baki token 0 (sahkan semasa demo). Sub-halaman: "Sejarah Transaksi" (`/gamification/history`), "Tukar Syiling → Token" (`/gamification/convert`), "Cabaran Harian", "Papan Pendahulu", "Pencapaian Anda", "Kedai Hadiah", "Kotak Misteri". | | ⚠ J-12 (Papan Pendahulu kosong dalam seed) |
| UAT-MUR-22 | Pilih "Kelas Saya" (`/kelas-saya`). | Sarikata "Sertai kelas guru anda 🏫". Senarai kelas: "Kelas Demo Tingkatan 4" (Bahasa Melayu, guru "Guru Demo") dan "Kelas Demo Matematik T4" (Matematik, guru "Guru Demo") mengikut seed tempatan. Borang "Masukkan Kod Kelas" (pemegang tempat `cth: MAT5B2`) dengan butang "Sertai". Murid yang belum sertai: "Belum Sertai Mana-Mana Kelas" dan "Minta kod kelas daripada guru anda dan masukkan di atas". | | |
| UAT-MUR-23 | Pilih "Prestasi" (`/prestasi`). | Dialih ke `/prestasi/sekolah`: tajuk "Dashboard Sekolah". Murid boleh buka `/prestasi/<id murid sendiri>` ("Prestasi 360"); dalam mod http bahagian "Keputusan Bijak SPM" (`data-testid=bijak-summary`) memaparkan angka atau keadaan "Tiada data". (sahkan semasa demo untuk laluan dari menu murid) | | |
| UAT-MUR-24 | Pilih "Jemput Ibu Bapa" (`/jemput-ibu-bapa`). | Tajuk "Jemput Ibu Bapa 👨‍👩‍👧", teks "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda". Kad "Link Jemputan" dengan butang "Salin" (bertukar "Disalin!"), "Hantar via WhatsApp" dan "Jana Link Baru". Kad ibu bapa dihubungkan: "Belum ada ibu bapa dihubungkan" (seed `GET /api/me/parent-links` kosong). Lihat bahagian 9 (C-04) untuk aliran silang. | | ⚠ J-05 |
| UAT-MUR-25 | Cuba laluan di luar skop, contoh `/bilik-duta`. | Murid dibawa pulang ke laman utamanya (`/spm/bijak`) atau memaparkan halaman "Belum tersedia dalam prototaip" dengan mesej "Skrin ini belum termasuk dalam skop prototaip ini. Sila gunakan menu untuk melihat skrin yang tersedia." (`src/app/router/guards.ts`, `prototype-scope.ts`). (sahkan semasa demo untuk yang mana satu) | | |
| UAT-MUR-26 | Buka `/dashboard` terus. | Laluan boleh dicapai melalui URL. Komen kod menyatakan `GET /api/dashboard` belum dibina dalam mod http, tetapi API tempatan memulangkan 200 dengan data (disahkan). Catat apa yang dipaparkan (Dashboard dengan data, atau ralat). | | ⚠ J-06 |
| UAT-MUR-27 | Menu akaun: buka "Profil Saya" (`/profile`) dan "Tetapan Peribadi" (`/tetapan`). | "Profil Saya" dengan sarikata "Statistik & Pencapaian Anda"; "Tetapan Peribadi". Nama "Murid Demo". | | |
| UAT-MUR-28 | Klik "Log Keluar" (menu akaun pada desktop; pada telefon buka menu laci, kemudian blok akaun). | Sesi tamat dan dibawa ke `/login`. Tekan butang Kembali pelayar: tidak boleh masuk ke `/spm/bijak` tanpa log masuk (dihalakan semula ke `/login`). | | |

## 5. Guru (`guru@demo.test`)

Pelayan mengembalikan `/dashboard` sebagai laman utama guru, tetapi SPA menghalakan guru ke `/guru` (Dashboard Guru) dalam skop prototaip (`src/app/router/guards.ts`).

| ID | Langkah | Keputusan dijangka | Status | Jurang |
|---|---|---|---|---|
| UAT-GUR-01 | Log masuk dengan `guru@demo.test` pada `/login`. | Dibawa ke `/guru`: tajuk "Dashboard Guru" dengan sarikata ucapan "Selamat datang 👩‍🏫 ...". Menu guru: Command Center, Dashboard Guru, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Kelas Saya, Soalan by Chapter, Monitoring, Kirkpatrick, Pelajar Saya, Laporan, Laporan Mingguan, Sumbang Soalan. | | |
| UAT-GUR-02 | Pada `/guru` semak kandungan dashboard. | Panduan "Mula Di Sini — 3 Langkah Mudah" (Buka Kelas, Lihat Pelajar, Pantau Prestasi; boleh disorok), "Checklist Guru" (Kelas dah ada, Pelajar dalam kelas, Misi harian pertama), kad angka "Kelas Aktif", "Pelajar", "Soalan", "Tugasan" dan bahagian "Tindakan Hari Ini". Seed tempatan: 2 kelas aktif, `hasClass` benar, `hasStudents` benar, `hasMission` palsu (sahkan semasa demo). | | |
| UAT-GUR-03 | Pilih "Kelas Saya" (`/guru/kelas`). | Tajuk "Kelas Saya", sarikata "Urus kelas dan tugasan anda 🏫". Dua kelas: "Kelas Demo Tingkatan 4" (kod `DEMO4S`, 7 murid) dan "Kelas Demo Matematik T4" (kod `DEMO4M`, 6 murid). Jika kosong: "Belum Ada Kelas". | | |
| UAT-GUR-04 | Klik butang cipta kelas (`/guru/kelas/cipta`), isi nama kelas, subjek dan tahap, simpan. | Halaman "Cipta Kelas Baru" ("Isi butiran kelas anda"). Kelas baharu muncul dalam senarai dengan kod kelas yang dijana. (sahkan semasa demo untuk medan dan mesej kejayaan) Rekod ini digunakan dalam bahagian 9 (C-01). | | |
| UAT-GUR-05 | Pilih "Pelajar Saya" (`/guru/pelajar`). | Tajuk "Pelajar", sarikata "Urus pelajar dalam kelas anda". Senarai murid dengan nama seperti "Murid Demo", "Murid Demo Kosong", "Murid Demo Empat" dan seterusnya, serta kelas masing-masing. Jika kosong: "Belum ada pelajar dalam kelas anda". Ada carian dan butang "Cipta Pelajar". | | |
| UAT-GUR-06 | Pilih "Prestasi" (`/prestasi`), pilih "Prestasi Kelas" (`/prestasi/kelas`) kemudian kelas "Kelas Demo Tingkatan 4". | Halaman "Dashboard Kelas" (`data-testid=prestasi-kelas-detail-page`). Dalam mod http terdapat bahagian bertajuk "Keputusan Bijak SPM" dengan kad angka, atau "Tiada data" jika belum ada hasil (`e2e/bijak/us33-http.spec.ts`). Selepas murid menghantar kertas dalam UAT-MUR-10, hasil muncul di sini jika murid ialah ahli kelas itu (sahkan semasa demo). | | |
| UAT-GUR-07 | Pilih "Headcount" (`/headcount`). | Senarai konfigurasi headcount. Seed PoC mempunyai konfigurasi untuk `DEMO4M` (Matematik, mod auto, 3 OTR) dan satu untuk BM (`Kelas Demo Tingkatan 4`); API tempatan memulangkan sekurang-kurangnya satu konfigurasi bagi guru. Buka satu untuk lihat jadual (`/headcount/<id>`). (sahkan semasa demo untuk skrin dan nilai TOV/OTR/ETR) | | |
| UAT-GUR-08 | Pilih "Analitik Adaptif" (`/analitik`) dan "Analisa Item" (`/analisa-item`). | Skrin analitik kelas ("Analitik Kelas") dan analisa item ("Analisa Item" / "Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas"). Data daripada `/api/analytics/classes` dan `/api/item-analysis/classes` (kedua-duanya 200 pada API tempatan). (sahkan semasa demo untuk nilai) | | |
| UAT-GUR-09 | Pilih "Command Center" (`/guru/command-center`). | Papan "Command Center — Guru" dengan jumlah murid (seed tempatan: 7, aktif 0 sebelum sebarang aktiviti), dibuka tanpa ralat. Tempoh muat boleh beberapa saat. (sahkan semasa demo) | | |
| UAT-GUR-10 | Pilih "Monitoring" (`/guru/monitoring`), "Kirkpatrick" (`/guru/kirkpatrick`), "Laporan" (`/guru/laporan`). | Skrin dibuka tanpa ralat; "Laporan" bertajuk "Laporan Statistik" ("Pantau penglibatan dan prestasi pelajar"). Data daripada `/api/monitoring/overview`, `/api/kirkpatrick/overview`, `/api/teacher/report` (200 pada API tempatan). (sahkan semasa demo untuk nilai) | | |
| UAT-GUR-11 | Pilih "Sumbang Soalan" (`/guru/soalan`). | Tajuk "Sumbang Soalan" dengan sarikata "Sumbangan anda kepada bank soalan kebangsaan PrestasiPlus". Senarai soalan sumbangan guru (API tempatan memulangkan beberapa soalan, contoh "Planet paling hampir dengan Matahari."). Butang tambah membuka "Tambah Soalan Baru" (`/guru/soalan/cipta`). (sahkan semasa demo untuk simpan soalan) | | |
| UAT-GUR-12 | Pilih "Laporan Mingguan". | Halaman "Belum tersedia dalam prototaip" (skrin tidak dibina; `GET /api/weekly-report` menjawab 403 untuk guru pada API tempatan). Catat Disekat, rujuk J-08. | | ⚠ J-08 |
| UAT-GUR-13 | Menu akaun: "Profil Saya", "Tetapan Peribadi", "Panduan" (`/panduan`), "Tiket Bantuan" (`/pusat-tuisyen/tiket`). | Setiap halaman dibuka. "Tiket Bantuan" bertajuk "Tiket Bantuan" dengan sarikata "Senarai aduan dan permintaan anda". | | |
| UAT-GUR-14 | "Log Keluar". | Dibawa ke `/login`. | | |

## 6. Admin sekolah (`adminsekolah@demo.test`)

Pelayan mengembalikan `/admin` sebagai laman utama, tetapi `/admin` hanya untuk Admin Pusat; SPA menghalakan admin sekolah ke `/admin-sekolah` (`src/app/router/guards.ts`).

| ID | Langkah | Keputusan dijangka | Status | Jurang |
|---|---|---|---|---|
| UAT-ASK-01 | Log masuk dengan `adminsekolah@demo.test`. | Dibawa ke `/admin-sekolah`: "Dashboard Sekolah". Spanduk sekolah "SMK Demo Satu" (kod `DEMO001`; Petaling, Selangor). Kad ringkasan "Jumlah Pelajar", "Jumlah Guru", "Kelas Aktif", "Langganan". Menu: Command Center, Dashboard, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Monitoring, Kirkpatrick, Sekolah Bersaing, Statistik Penggunaan, DSKP Heatmap, Laporan Aktiviti, Amaran Awal, Laporan Bulanan, Senarai Pelajar, Senarai Guru, Kelas Sekolah. | | |
| UAT-ASK-02 | Pada dashboard cari panel prestasi. | Dalam mod http panel diberi label "Keputusan Bijak SPM" (`data-testid=sd-performance-source`); jika tiada data, keadaan "Tiada data". Jika ada: kadar ketepatan dan "n sesi · m soalan". | | |
| UAT-ASK-03 | Pilih "Senarai Pelajar" (`/admin-sekolah/pelajar`). | "Senarai Pelajar" untuk SMK Demo Satu (seed tempatan: 15 murid dalam statistik penggunaan). Carian "Cari" (pemegang tempat "Nama atau emel..."), penapis "Status" (Semua, Aktif, Tidak Aktif), butang "Eksport CSV". Lajur status "Aktif" atau "Tidak". Nama termasuk "Murid Demo Lapan" dan sebagainya. | | |
| UAT-ASK-04 | Klik tambah pelajar (`/admin-sekolah/pelajar/baru`) dan cipta satu pelajar ujian. | Halaman "Tambah Pelajar" ("Cipta satu akaun pelajar"). Dalam mod http kata laluan minimum "Minimum 8 aksara". Pelajar baharu muncul dalam senarai. (sahkan semasa demo untuk mesej kejayaan) Guna nama rekaan seperti "Murid Ujian UAT", bukan nama sebenar. | | |
| UAT-ASK-05 | Pilih "Senarai Guru" (`/admin-sekolah/guru`). | "Senarai Guru" dengan guru sekolah (contoh "Guru Demo" dan guru contoh dijana seperti "Guru Contoh Coklat"). Pautan "Guru Menunggu Pengesahan" (`/admin-sekolah/guru/menunggu`): senarai kosong dalam seed tempatan. Butang cipta guru (`/admin-sekolah/guru/baru`, "Cipta Pengguna"). | | |
| UAT-ASK-06 | Pilih "Kelas Sekolah" (`/admin-sekolah/kelas`). | "Kelas Sekolah" menyenaraikan kelas guru dan kelas contoh (contoh "Kelas Contoh Tingkatan 1" dan "Kelas Demo Tingkatan 4"). | | |
| UAT-ASK-07 | Pilih "Laporan Aktiviti", "Laporan Bulanan", "Statistik Penggunaan", "DSKP Heatmap". | Setiap halaman dibuka tanpa ralat; "Laporan Bulanan" menunjuk bulan semasa ("Oktober 2026" dalam seed tempatan). API (`/api/admin-sekolah/laporan-aktiviti`, `/laporan-bulanan`, `/usage`, `/dskp-heatmap`) memulangkan 200. (sahkan semasa demo untuk nilai) | | |
| UAT-ASK-08 | Pilih "Amaran Awal" (`/amaran/sekolah`). | Skrin "Amaran Awal — Sekolah" dengan ringkasan sekolah (seed tempatan: 16 pelajar). (sahkan semasa demo) | | |
| UAT-ASK-09 | Pilih "Prestasi", "Analitik Adaptif", "Analisa Item", "Sekolah Bersaing", "Command Center", "Monitoring", "Kirkpatrick". | Setiap skrin dibuka dengan data sekolah. "Sekolah Bersaing" kosong dalam seed tempatan (tiada baris minggu ini). (sahkan semasa demo) | | ⚠ J-12 |
| UAT-ASK-10 | Cuba buka `/admin/users` (Admin Pusat sahaja). | Admin sekolah tidak boleh masuk: dihalakan ke `/admin-sekolah` (tiada gelung) atau halaman 403. (sahkan semasa demo untuk yang mana satu) | | |
| UAT-ASK-11 | "Log Keluar". | Dibawa ke `/login`. | | |

## 7. Ibu bapa (`ibubapa@demo.test`)

Peranan ibu bapa **tidak termasuk dalam skop prototaip** (`src/app/prototype-scope.ts` `PROTOTYPE_ROLES` = `student`, `teacher`, `school_admin`, `admin`; `docs/AKAUN-DEMO.md` bahagian "Akaun di luar skop"). Tiada skrin pemantauan ibu bapa dalam menu. Langkah di bawah menguji gelagat sempadan dan aliran jemputan; sebarang paparan lain ialah luar jangkaan.

| ID | Langkah | Keputusan dijangka | Status | Jurang |
|---|---|---|---|---|
| UAT-IBU-01 | Log masuk dengan `ibubapa@demo.test` (kata laluan demo daripada LEAD). | API menerima log masuk (peranan `parent`, laman utama `/dashboard`, disahkan pada API tempatan). Dalam SPA mod tiruan mesej ialah "Peranan ini tidak termasuk dalam prototaip." (`prototype-scope.ts:51`); dalam mod http SPA tidak menolak log masuk di sisi klien, jadi ibu bapa dijangka dihalakan ke halaman "Belum tersedia dalam prototaip" (daripada kod `guards.ts`). (sahkan semasa demo untuk yang mana satu dipaparkan) | | ⚠ J-05 |
| UAT-IBU-02 | Selepas log masuk, buka `/dashboard` dan `/spm/bijak`. | Halaman "Belum tersedia dalam prototaip": "Skrin ini belum termasuk dalam skop prototaip ini. Sila gunakan menu untuk melihat skrin yang tersedia." Tiada menu pemantauan anak. (sahkan semasa demo) | | ⚠ J-05 |
| UAT-IBU-03 | Dalam tetingkap murid: `/jemput-ibu-bapa`, salin "Link Jemputan". Dalam tetingkap ibu bapa (sudah log masuk), buka link itu (`/ibu-bapa/terima/<token>`). | Halaman "Jemputan Ibu Bapa — PRESTASIPLUS" dengan kad jemputan sah. Pengguna ibu bapa disambungkan (keadaan "Berjaya Berhubung") dengan butang "Lihat Profil Kemajuan". Pelawat belum log masuk melihat butang log masuk dan "Daftar akaun Ibu Bapa"; pengguna peranan lain melihat "Log Keluar & Log Masuk Sebagai Ibu Bapa". Token tidak sah: "Link Tidak Sah". (sahkan semasa demo untuk teks tepat; jangan lampirkan URL penuh dalam laporan) | | |
| UAT-IBU-04 | Klik "Lihat Profil Kemajuan". | Pautan menuju `/pelajar/<id murid>`; laluan ini tidak dalam skop ibu bapa, jadi halaman "Belum tersedia dalam prototaip" dijangka. Catat Disekat dan rujuk J-05: ibu bapa **tidak boleh** melihat keputusan anak dalam demo ini. | | ⚠ J-05 |
| UAT-IBU-05 | "Log Keluar" (`/logout`). | Dibawa ke `/login`. | | |

## 8. Admin Pusat (`admin@demo.test`)

Selepas log masuk, `/admin` dialihkan ke `/admin/command-center` (`src/app/router/core-routes.ts:73`). Portal Pentadbiran hanya memaparkan item yang dibina (`src/shells/pentadbiran/menu.ts`, komen kepala fail); item yang belum dibina tidak dipaparkan dan laluan `/admin/p/<id>` ialah ruang letak.

| ID | Langkah | Keputusan dijangka | Status | Jurang |
|---|---|---|---|---|
| UAT-ADM-01 | Log masuk dengan `admin@demo.test`. | Dibawa ke `/admin/command-center` (Pemantauan > Langsung). Bar atas Portal Pentadbiran dengan cip skop "Admin Pusat · Seluruh Negara" (label skop pelayan: "Seluruh Negara"), butang tema dan menu akaun. | | ⚠ J-10 (tiada dashboard `/admin`) |
| UAT-ADM-02 | Lihat menu sisi. | Kumpulan dan item yang dibina: **Pemantauan** (Langsung, Aktiviti Harian, Monitoring, Ringkasan, T1: Reaksi, T2: Pembelajaran, T3: Tingkah Laku, T4: Hasil, Rantaian Impak, Intervensi); **Bank Soalan** (Bank Soalan, Import & Semakan, Kualiti Soalan, Laporan Soalan, Soalan PKSK, Audio KBAT); **Kertas & SPM** (Muat Naik Kertas, Tulis Soalan Manual, Senarai Ekstrak, Baris Gilir Semakan, Bank Soalan SPM, Pembina Kertas); **Kurikulum & Kandungan** (Kurikulum, Subjek, Tahap Pendidikan, Banner, Artikel, Nota); **Pengguna & Sekolah** (Pengguna, Sekolah, Import Pelajar, Pelajar Komplimen); **Penglibatan** (Tiket Bantuan); **Kewangan** (Langganan Sekolah, Akses PKSK); **Sistem** (Upload Screenshot). Pada telefon menu dibuka melalui butang menu (`pentadbiran-menu-button`). | | |
| UAT-ADM-03 | Pada Command Center, lihat papan. | Papan dengan angka platform dan senarai sekolah. Data daripada `/api/admin/command-center/live-data` (200). Seed tempatan: 4 sekolah dan 12 murid dalam `kpi` Monitoring. (sahkan semasa demo untuk nilai dan masa muat) Klik "Aktiviti Harian": `/admin/command-center/daily-activity` dengan label tempoh "Hari Ini (<tarikh>)". | | |
| UAT-ADM-04 | Pilih "Monitoring" (`/guru/monitoring`) dan "Ringkasan" Kirkpatrick (`/admin/kirkpatrick`), kemudian T1 hingga T4. | Setiap skrin dibuka tanpa ralat dengan data platform (`/api/monitoring/overview`, `/api/kirkpatrick/overview` 200). (sahkan semasa demo) | | |
| UAT-ADM-05 | Pilih "Pengguna" (`/admin/users`). | "Pengurusan Pengguna" ("Urus akaun pengguna PRESTASIPLUS") dengan senarai merentas sekolah, termasuk akaun demo (contoh "Murid Demo Lapan"). Butang tambah membuka "Tambah Pengguna Baru" (`/admin/users/create`). Edit: "Edit Pengguna". | | |
| UAT-ADM-06 | Pilih "Sekolah" (`/admin/schools`). | "Sekolah" ("Urus senarai sekolah"): SMK Demo Satu (`DEMO001`), SK Demo Dua (`DEMO002`), SK Demo Tiga (`DEMO003`), SJK(C) Demo Empat (`DEMO004`) mengikut seed. Tambah: "Tambah Sekolah" ("Daftarkan sekolah baru"). | | |
| UAT-ADM-07 | Pilih "Bank Soalan" (`/admin/questions`). | Senarai soalan dengan ringkasan jumlah (seed tempatan: 503 soalan; sahkan semasa demo untuk nombor). "Kualiti Soalan" (`/admin/questions/quality`) dan "Laporan Soalan" (`/admin/question-reports`) dibuka; laporan kosong dalam seed. | | |
| UAT-ADM-08 | Pilih "Pembina Kertas" (`/admin/spm/kertas`). | "Pembina Kertas" ("Bina dan terbitkan kertas SPM") dengan jadual kertas (seed tempatan 5 kertas), butang "Kertas Baharu", status "Sepadan" atau "Belum sepadan". Dalam mod http halaman ini menggunakan klien admin (`server/http-admin.ts`). | | |
| UAT-ADM-09 | Klik "Kertas Baharu" (`/admin/spm/kertas/baharu`): pilih Subjek "Matematik" dan Kertas "1", beri tajuk rekaan (contoh "UAT Demo 23 Okt"), klik "Cipta Kertas". | Dibawa ke penyunting kertas. Penunjuk bajet memaparkan "Belum sepadan dengan blueprint". Tambah soalan ke Bahagian 0 sehingga penunjuk bertukar "Sepadan dengan blueprint" (blueprint "Objektif": ambil 10, 10 markah; kolam `MAT1-A` 45 soalan PoC; `e2e/bijak/admin-publish-http.spec.ts` komen kepala fail). | | |
| UAT-ADM-10 | Klik "Terbitkan". | Kertas diterbitkan. Tanpa soalan PoC (`BIJAK_POC_QUESTIONS`) penerbitan ditolak dengan mesej "<Bahagian>: Kurang N soalan (perlu X, ada Y)". Untuk kemas, kertas boleh ditarik balik ("Tarik balik") dan draf dipadam ("Padam kertas"). Lihat bahagian 9 (C-03) untuk murid melihat kertas. | | |
| UAT-ADM-11 | Pilih "Muat Naik Kertas" (`/admin/spm/soalan/muat-naik`) dan "Senarai Ekstrak" (`/admin/spm/soalan/ekstrak`). | "Muat Naik Kertas" ("Ekstrak soalan daripada PDF") dan "Senarai Ekstrak" ("Kertas SPM yang dimuat naik"). Dalam mod http senarai dan butiran memanggil `/api/intake/batches` (BE-37; senarai kosong dalam seed tempatan). Muat naik PDF: (sahkan semasa demo; jangan muat naik dokumen sebenar atau data peribadi). | | ⚠ J-03 |
| UAT-ADM-12 | Pilih "Baris Gilir Semakan" (`/admin/spm/semakan`), "Bank Soalan SPM" (`/admin/spm/soalan`) dan "Tulis Soalan Manual" (`/admin/spm/soalan/manual`). | Dalam mod http ketiga-tiganya tidak mempunyai laluan Bijak pada API; halaman dijangka memaparkan ralat muat atau mesej "Fungsi ini belum tersedia." Catat Disekat dan rujuk J-03. Jangan tunjukkan skrin ini semasa demo. | | ⚠ J-03 |
| UAT-ADM-13 | Pilih "Langganan Sekolah" (`/admin/school-subscriptions`), "Pelajar Komplimen" (`/admin/comp-students`), "Akses PKSK" (`/admin/pksk/access`). | "Langganan Sekolah" dan "Pelajar Komplimen" dibuka; kedua-duanya kosong dalam seed tempatan. "Akses PKSK" menyenaraikan akses (contoh "Murid Demo Maju", "Murid Demo") dengan pakej "PKSK Kombo (T1 + T4)". (sahkan semasa demo) | | ⚠ J-12 |
| UAT-ADM-14 | Pilih "Tiket Bantuan" (`/admin/tiket`). | "Tiket Sokongan" ("Permohonan bantuan daripada pengguna") dengan sekurang-kurangnya satu tiket contoh daripada "Murid Demo" (seed tempatan). | | |
| UAT-ADM-15 | Menu akaun: "Masuk Mod Pelajar". | Admin masuk Mod Pelajar sebagai murid ujian, dengan jalan keluar "Keluar Mod Pelajar" (`src/shells/shared/mod-pelajar.ts`; smoke test meliputi API). Mod Pelajar hanya untuk murid ujian. Kertas Bijak boleh dilihat dalam mod ini. Keluar kembali ke portal admin. (sahkan semasa demo untuk teks butang) | | |
| UAT-ADM-16 | "Log Keluar" (sidebar atau bar atas, `title="Log Keluar"`). | Dibawa ke `/login`. | | |

## 9. Aliran silang peranan

Hanya aliran yang disokong oleh kod. Gunakan tetingkap peribadi berasingan untuk setiap peranan.

| ID | Aliran | Langkah | Keputusan dijangka | Status | Jurang |
|---|---|---|---|---|---|
| C-01 | Guru cipta kelas, murid sertai, guru nampak murid | (1) Guru: UAT-GUR-04 cipta kelas baharu dan catat kod kelas. (2) Murid `pelajar2@demo.test`: `/kelas-saya`, isi "Masukkan Kod Kelas" dengan kod itu, klik "Sertai". (3) Guru: `/guru/pelajar`. | Murid melihat kelas dalam senarai "Kelas Saya"; guru melihat "Murid Demo Kosong" dalam kelas baharu (kiraan murid bertambah). Mesej gagal: "Gagal menyertai kelas. Sila cuba lagi." (sahkan semasa demo untuk mesej kejayaan) | | |
| C-02 | Murid hantar Bijak SPM, guru dan admin sekolah nampak keputusan | (1) Murid `pelajar@demo.test`: UAT-MUR-06 hingga UAT-MUR-10. (2) Guru: `/prestasi/kelas/<id Kelas Demo Tingkatan 4>`. (3) Admin sekolah: `/admin-sekolah`. | Bahagian "Keputusan Bijak SPM" pada halaman kelas guru dan panel prestasi dashboard sekolah memaparkan angka (bukan "Tiada data") selepas hantar (US-33; `e2e/bijak/us33-http.spec.ts`). Mungkin ada kelewatan agregat: (sahkan semasa demo). | | |
| C-03 | Admin Pusat terbit kertas, murid nampak kertas | (1) Admin Pusat: UAT-ADM-09 dan UAT-ADM-10. (2) Murid: muat semula `/spm/bijak`. | Tajuk kertas baharu muncul dalam "Kertas Pilihan" (`e2e/bijak/admin-publish-http.spec.ts` fungsi `studentSees`). Selepas demo, tarik balik dan padam kertas ujian. | | |
| C-04 | Murid jemput ibu bapa, ibu bapa terima jemputan | UAT-MUR-24 dan UAT-IBU-03. | Jemputan diterima dan kad ibu bapa dihubungkan pada `/jemput-ibu-bapa` murid (selepas muat semula, bukan lagi "Belum ada ibu bapa dihubungkan"). Ibu bapa tidak dapat melihat keputusan anak (UAT-IBU-04, J-05). | | ⚠ J-05 |
| C-05 | Ibu bapa nampak keputusan anak | Tidak disokong dalam demo. | Tidak dijalankan: tiada skrin ibu bapa dalam skop prototaip (J-05). Catat Disekat. | | ⚠ J-05 |

## 10. Semakan responsif

Untuk setiap peranan, buka dashboard pada tiga lebar: **375x812**, **768x1024** dan **1280x800**. Kriteria lulus: tiada skrol mendatar pada halaman, tiada teks terpotong atau bertindih, navigasi boleh dicapai (butang menu pada telefon dan tablet; bar sisi pada desktop), butang "Log Keluar" boleh dicapai dalam dua ketukan.

Cara semak skrol mendatar dalam pelayar: dalam konsol pelayar jalankan `document.documentElement.scrollWidth - document.documentElement.clientWidth`; nilai mesti 0 atau kurang. Tunggu kira-kira 3 saat selepas kandungan siap dimuat sebelum mengukur (halaman menyusun semula selepas data tiba).

| ID | Peranan | Dashboard (URL) | 375 | 768 | 1280 | Catatan |
|---|---|---|---|---|---|---|
| UAT-RES-01 | Murid | `/spm/bijak` (laman utama mod http); juga `/dashboard` | | | | |
| UAT-RES-02 | Murid | `/permainan` dan skrin percubaan `/spm/bijak/percubaan/<id>` (butang "Peta N/M" pada telefon) | | | | |
| UAT-RES-03 | Guru | `/guru` | | | | |
| UAT-RES-04 | Admin sekolah | `/admin-sekolah` | | | | |
| UAT-RES-05 | Ibu bapa | Tiada dashboard dalam skop (J-05); semak halaman "Belum tersedia dalam prototaip" dan `/ibu-bapa/terima/<token>` pada tiga lebar | | | | ⚠ J-05 |
| UAT-RES-06 | Admin Pusat | `/admin/command-center` (menu melalui `pentadbiran-menu-button` pada telefon dan tablet) | | | | |
| UAT-RES-07 | Awam | `/login` pada tiga lebar (nota LEAD: `/login` pada telefon dengan data API sebenar belum disahkan semula; `docs/plan/AGENT-SYNC.md` notis HANDOFF) | | | | |

Rujukan: sapuan responsif terdahulu dalam `docs/qa/v2-responsive-sweep.md` dan `docs/qa/v2-final-sweep.md` dibuat pada build mod tiruan; ia tidak menggantikan semakan ini pada build http.

## 11. Jurang diketahui

Pemilik ialah aliran separuh AZ atau PR yang menanganinya. ID tugasan AZ-xx ialah item dalam baris gilir separuh AZ, isu #113. Status dinilai pada 21 Okt 2026.

| ID | Perkara | Kesan pada demo | Pemilik | Status | Bukti |
|---|---|---|---|---|---|
| J-01 | Kad Memori dan soalan tahap D1 hingga D4 mungkin 0 item: kolam soalan PoC hanya tahap T4 dan T5; Kad Memori mengambil soalan tahap D1 hingga D4 | Kad Memori 0 kad. Disahkan pada API tempatan: `GET /api/games/solo/kad-memori` oleh `pelajar@demo.test` memulangkan `cards: []`. Permainan soalan lain (Betul atau Salah 40 kenyataan; Susun Jawapan, Tembak Jawapan, Cabaran Kilat ada data) tidak terjejas pada aras API. | AZ-02 (separuh AZ, data soalan), belum mendarat | Terbuka | `apps/api/prisma/seed/questions/pool-content.ts:12` (`PoolLevel = 'T4' \| 'T5'`) dan `:25` (`POOL_LEVELS`); `apps/api/src/modules/games/solo/play/solo-items.ts:73` ("levels D1..D4 for Kad Memori") dan `:128`. |
| J-02 | Lima permainan solo (Betul atau Salah, Cabaran Kilat, Tembak Jawapan, Susun Jawapan, Kad Memori) dalam mod http | Pada `be/integration-frontend` @ `d909e1e0` setiap halaman solo memaparkan "Fungsi ini belum tersedia dalam demo" (penghalang sementara). Pada `feature/v2-backend` @ `23c98226` penghalang itu tidak ada (tiada `SoloUnavailable` dalam `src/`). Penyelesaian penuh ialah PR #105; keputusan D62: tiada notis sementara, tunggu penyelesaian penuh. | PR #105 (separuh AZ, PC-7 Games) | Terbuka | `src/modules/m16-battle-games/components/solo/SoloUnavailable.vue` dan `pages/Solo*Page.vue` (`const unavailable = isHttpMode()`, contoh `SoloKadMemoriPage.vue:23`) pada `d909e1e0`; `docs/TRACKER.md` D58 dan D62; `docs/plan/AGENT-SYNC.md` notis 21:20; `docs/ops/demo-cloudflare-supabase.md` bahagian 7.1 "Not covered". |
| J-03 | Semakan intake SPM dalam mod http (m28) | Muat Naik Kertas dan Senarai Ekstrak memanggil `/api/intake/*` (BE-37). Tulis Soalan Manual, Baris Gilir Semakan, penyunting soalan dan Bank Soalan SPM tidak mempunyai laluan dan dijangka memaparkan ralat muat atau "Fungsi ini belum tersedia." Jangan tunjukkan. | AZ-20b (dalam kerja, #113) | Dalam kerja | `src/modules/m28-bijak-spm/server/http-admin.ts:91` dan `:351-363` pada `d909e1e0`. |
| J-04 | Hab SPM m06 (`/spm`) dalam mod http | Hab dan sub-skrinnya (Databank Soalan SPM, Latih Tubi SPM, Tracking A, Subjektif) memanggil `/api/spm/*`; API tempatan memulangkan 200 untuk `/api/spm/overview` dan `/api/spm/databank`, tetapi kami tidak dapat mengesahkan padanan bentuk data dengan skrin tanpa menjalankan SPA. Catat apa yang dilihat. | AZ-20a (#113) | Dalam kerja (tidak dapat disahkan daripada repo) | `src/modules/m06-spm/api/spm.ts`; API tempatan `GET /api/spm/overview`: 200. |
| J-05 | Ibu bapa di luar skop prototaip | Tiada skrin ibu bapa; tiada paparan keputusan anak. Log masuk ibu bapa dalam mod http: API menerima; SPA dijangka tunjuk "Belum tersedia dalam prototaip" (sahkan semasa demo). Jemputan boleh dicipta murid dan diterima, tetapi "Lihat Profil Kemajuan" menuju `/pelajar/<id>` di luar skop. | Keputusan skop LEAD; fail kongsi `prototype-scope.ts` milik separuh AZ (peraturan 6, `docs/plan/AGENT-SYNC.md`) | Dengan reka bentuk (D43, D48) | `src/app/prototype-scope.ts:43` (`PROTOTYPE_ROLES`), `:51` (mesej); `docs/AKAUN-DEMO.md` "Akaun di luar skop"; `src/modules/m01-authentication/pages/ParentInviteAcceptPage.vue:150` (`/pelajar/${linked.student.id}`). |
| J-06 | `/dashboard` murid dalam mod http | Murid mendarat di `/spm/bijak`, bukan `/dashboard`. Komen kod: `GET /api/dashboard` belum dibina (komen mungkin lapuk: API tempatan memulangkan 200 dengan data). Skrin `/dashboard` boleh dibuka melalui URL. | Separuh AZ (fail kongsi frontend) | Dengan reka bentuk; komen perlu disemak | `src/app/prototype-scope.ts:277-288` pada `d909e1e0`; API tempatan `GET /api/dashboard`: 200. |
| J-07 | Butang "Chat" murid (nav bawah) tidak berfungsi; loceng notifikasi (`/notifikasi`) disembunyikan | Tiada kesan pada aliran demo; jangan klik semasa demo. | Separuh AZ | Dengan reka bentuk (D43) | `src/app/prototype-scope.ts:23-29`. |
| J-08 | Guru "Laporan Mingguan" | Halaman "Belum tersedia dalam prototaip". `/laporan-mingguan` ialah 403 untuk semua peranan; `GET /api/weekly-report` 403 untuk guru pada API tempatan. | Dengan reka bentuk (OQ-M08-01) | Dengan reka bentuk | `src/modules/m11-teacher-analytics/routes/laporan-mingguan.ts:7-10`. |
| J-09 | Headcount murid ialah 403 | Menu murid "Headcount" memaparkan 403; seperti laman live, bukan pepijat. | Dengan reka bentuk | Dengan reka bentuk | `docs/AKAUN-DEMO.md` baris 78; `GET /api/headcounts` 403 untuk murid pada API tempatan. |
| J-10 | Portal Pentadbiran: hanya item dibina dipaparkan; tiada dashboard `/admin` | `/admin` dialihkan ke Command Center. Papan Pemuka, Laporan Eksekutif dan item lain tidak dipaparkan. | Separuh AZ | Dengan reka bentuk (D48) | `src/shells/pentadbiran/menu.ts` (komen kepala fail); `src/app/router/core-routes.ts:70-73`. |
| J-11 | Sambung Kata memaparkan "500 - Ralat Pelayan" | Meniru laman live (terdokumen), bukan pepijat. Jangan tunjukkan sebagai permainan. | Separuh AZ (PC-7) | Dengan reka bentuk | `src/modules/m16-battle-games/routes/permainan-extra.ts:44-52`. |
| J-12 | Keadaan kosong dalam seed PoC | Kedudukan (`/api/rankings`), Papan Pendahulu (`/api/leaderboard`), Sekolah Bersaing, Langganan Sekolah, Pelajar Komplimen, Senarai Ekstrak, laporan soalan, misi harian, ujian pemulihan, "Soalan by Chapter" dan "Soalan Aku Salah" (`/api/practice/chapter-subjects`, `/api/practice/revision`) memulangkan senarai kosong untuk `pelajar@demo.test` atau admin pada API tempatan. Paparkan sebagai keadaan kosong, bukan ralat. | Separuh AZ (seed demo) | Terbuka; putuskan sebelum demo sama ada perlu data | Probe API tempatan 21 Okt 2026 (GET sahaja). |
| J-13 | Papan Bijak dan Battle Arena (berbilang pemain) pada UI | `scripts/demo-walkthrough.sh` hanya menguji API, tidak memuatkan SPA. Pemadanan pantas dengan bot disokong API tetapi gelagat UI tidak disahkan. | Separuh AZ (PC-7) | Belum disahkan | `scripts/demo-walkthrough.sh` komen kepala fail; `docs/ops/demo-cloudflare-supabase.md` bahagian 7.1 "Not covered". |
| J-14 | Had kadar log masuk 5 seminit setiap alamat | Log masuk beberapa akaun berturutan dari satu rangkaian boleh dapat HTTP 429; tunggu satu minit. | Operasi | Dengan reka bentuk | `scripts/demo-walkthrough.sh` komen kepala fail; `docs/plan/http-switch-checklist.md` baris Auth. |
| J-15 | Runbook demo menyatakan halaman admin Bijak "tiada klien http" | Kenyataan itu lapuk untuk `d909e1e0`: Pembina Kertas mempunyai klien admin http (B3, `003cff0b`). Hanya semakan, intake manual dan bank yang tiada (J-03). | LEAD / dokumen | Dokumen perlu dikemas kini | `docs/ops/demo-cloudflare-supabase.md` baris 306-308 dan 604-609 berbanding `src/modules/m28-bijak-spm/server/http-admin.ts:1-12` pada `d909e1e0`. |
| J-16 | Tukar peranan akaun `guruadmin@demo.test` pada UI | Tiada langkah UI dalam skrip ini; hanya aras API (walkthrough). | Separuh AZ | Belum disahkan | `scripts/demo-walkthrough.sh` komen kepala fail. |

## 12. Penutup dan tandatangan

### 12.1 Syarat keluar (demo boleh diteruskan)

Demo 23 Okt boleh diteruskan apabila semua syarat berikut dipenuhi:

1. Semua langkah dalam bahagian 4 hingga 8 yang **tidak** bertanda ⚠ mempunyai status Lulus. Tiada Gagal terbuka.
2. Setiap langkah bertanda ⚠ sama ada Lulus atau Disekat dengan rujukan jurang yang diterima oleh LEAD (bahagian 11). Jurang J-01 dan J-02 diputuskan LEAD sebelum demo: sama ada PR #105 digabung dan dibina semula, atau permainan solo tidak ditunjukkan.
3. Aliran silang C-01 hingga C-03 Lulus (C-04 Lulus separa dibenarkan; C-05 Disekat dengan reka bentuk).
4. Semakan responsif (bahagian 10) Lulus pada 375, 768 dan 1280 bagi Murid, Guru, Admin Sekolah dan Admin Pusat; tiada skrol mendatar.
5. Smoke test (`scripts/demo-smoke.sh`) lulus pada URL demo yang sama sebelum UAT; tiada ralat konsol yang menyekat pada laluan utama setiap peranan.
6. Data ujian yang dicipta semasa UAT (kertas "UAT Demo 23 Okt", kelas ujian, pelajar ujian) dibersihkan atau pangkalan data disegar semula mengikut `docs/ops/demo-reseed.md` sebelum demo.
7. Tiada kata laluan, kuki atau token jemputan dalam tangkapan skrin atau laporan.

### 12.2 Ringkasan keputusan (diisi penguji)

| Peranan | Bilangan langkah | Lulus | Gagal | Disekat | Catatan |
|---|---|---|---|---|---|
| Murid | 28 | | | | |
| Guru | 14 | | | | |
| Admin sekolah | 11 | | | | |
| Ibu bapa | 5 | | | | |
| Admin Pusat | 16 | | | | |
| Aliran silang | 5 | | | | |
| Responsif | 7 | | | | |

### 12.3 Tandatangan

| Peranan | Nama | Tarikh | Keputusan (Boleh teruskan / Tidak boleh) | Tandatangan |
|---|---|---|---|---|
| Penguji UAT | | | | |
| QA | | | | |
| LEAD separuh AZ | | | | |
