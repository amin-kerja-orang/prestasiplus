# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: m10-teacher-class\smoke-kelas.spec.ts >> M10 S5 Cipta Kelas >> SRS §12 #22 school search: 1 character no request, "de" results, "zzz" empty, tiles follow the school type @m10
- Location: e2e\m10-teacher-class\smoke-kelas.spec.ts:184:3

# Error details

```
TimeoutError: page.waitForFunction: Timeout 15000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - banner [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e8]:
          - heading "Cipta Kelas Baru" [level=1] [ref=e9]
          - paragraph [ref=e10]: Isi butiran kelas anda
        - generic [ref=e11]:
          - link "99+" [ref=e12] [cursor=pointer]:
            - /url: /notifikasi
          - generic [ref=e17]:
            - button "Menu" [ref=e18]
            - link [ref=e20] [cursor=pointer]:
              - /url: /dashboard
              - img "PRESTASIPLUS" [ref=e21]
    - generic [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e30]: "256"
        - generic [ref=e31]: koin
      - generic [ref=e32]:
        - generic [ref=e35]: "8"
        - generic [ref=e36]: mata
      - generic [ref=e37]:
        - generic [ref=e40]: "1"
        - generic [ref=e41]: 🔥
    - main [ref=e42]:
      - generic [ref=e43]:
        - link "Kembali" [ref=e44] [cursor=pointer]:
          - /url: /guru/kelas
        - generic [ref=e47]:
          - generic [ref=e48]:
            - heading "Pilih Sekolah" [level=2] [ref=e49]
            - textbox "Taip nama sekolah untuk cari..." [ref=e55]
          - generic [ref=e56]:
            - heading "Maklumat Kelas" [level=2] [ref=e57]
            - generic [ref=e60]:
              - generic [ref=e61]:
                - generic [ref=e62]: Nama Kumpulan *
                - textbox "Nama Kumpulan *" [ref=e63]:
                  - /placeholder: "cth: 5 Bestari"
                - paragraph [ref=e64]: Nama kumpulan latih tubi anda.
              - generic [ref=e65]:
                - generic [ref=e66]: Subjek *
                - combobox "Subjek *" [ref=e67]:
                  - option "-- Pilih Subjek --" [selected]
                  - option "Bahasa Melayu"
                  - option "Bahasa Inggeris"
                  - option "Matematik"
                  - option "Sains"
                  - option "Sejarah"
                  - option "Pendidikan Islam"
                  - option "Pendidikan Moral"
                  - option "Matematik Tambahan"
                  - option "Fizik"
                  - option "Kimia"
                  - option "Biologi"
                  - option "Geografi"
                  - option "Pendidikan Seni Visual"
                  - option "Pendidikan Muzik"
                  - option "Pendidikan Jasmani & Kesihatan"
                  - option "Reka Bentuk & Teknologi"
                  - option "Sains Komputer"
                  - option "Bahasa Arab"
                  - option "Bahasa Cina"
                  - option "Bahasa Tamil"
                  - option "Prinsip Perakaunan"
                  - option "Ekonomi"
                  - option "Perniagaan"
                  - option "Pendidikan Al-Quran & As-Sunnah"
                  - option "Tasawwur Islam"
                  - option "Jawi"
                  - option "Pendidikan Syariah Islamiah"
                  - option "Sains Rumah Tangga"
                  - option "Pembuatan Pakaian Wanita"
                  - option "Pertanian"
                  - option "Sains Sukan"
              - group "Tahap Pendidikan *" [ref=e68]:
                - generic [ref=e70]:
                  - generic [ref=e71] [cursor=pointer]: Tahun 1
                  - generic [ref=e73] [cursor=pointer]: Tahun 2
                  - generic [ref=e75] [cursor=pointer]: Tahun 3
                  - generic [ref=e77] [cursor=pointer]: Tahun 4
                  - generic [ref=e79] [cursor=pointer]: Tahun 5
                  - generic [ref=e81] [cursor=pointer]: Tahun 6
                  - generic [ref=e83] [cursor=pointer]: Ting. 1
                  - generic [ref=e85] [cursor=pointer]: Ting. 2
                  - generic [ref=e87] [cursor=pointer]: Ting. 3
                  - generic [ref=e89] [cursor=pointer]: Ting. 4
                  - generic [ref=e91] [cursor=pointer]: Ting. 5
              - generic [ref=e93]:
                - generic [ref=e94]: Penerangan (pilihan)
                - textbox "Penerangan (pilihan)" [ref=e95]:
                  - /placeholder: Penerangan ringkas tentang kelas ini...
          - button "Cipta Kelas" [ref=e96]
  - generic [ref=e99]:
    - generic [ref=e100]:
      - generic [ref=e101]:
        - generic [ref=e102]:
          - img "PRESTASIPLUS" [ref=e103]
          - paragraph [ref=e104]: Platform Latih Tubi Nasional
        - button [ref=e105]
      - generic [ref=e109]:
        - img "Avatar" [ref=e110]
        - generic [ref=e111]:
          - paragraph [ref=e112]: Admin Demo
          - paragraph [ref=e113]: admin
    - navigation [ref=e114]:
      - link "Dashboard" [ref=e115] [cursor=pointer]:
        - /url: /dashboard
      - link "Target SPM" [ref=e120] [cursor=pointer]:
        - /url: /target-spm
      - link "Misi Harian" [ref=e126] [cursor=pointer]:
        - /url: /misi-harian
      - link "Remedial" [ref=e133] [cursor=pointer]:
        - /url: /remedial/saya
      - generic [ref=e137]: SPM
      - link "SPM SPM" [ref=e141] [cursor=pointer]:
        - /url: /spm
        - generic [ref=e145]: SPM
        - generic [ref=e146]: SPM
      - link "Headcount" [ref=e147] [cursor=pointer]:
        - /url: /headcount
      - link "Prestasi" [ref=e152] [cursor=pointer]:
        - /url: /prestasi
      - link "Analitik Adaptif" [ref=e156] [cursor=pointer]:
        - /url: /analitik/pelajar
      - link "Analisa Item" [ref=e166] [cursor=pointer]:
        - /url: /analisa-item
      - link "Amaran Awal" [ref=e171] [cursor=pointer]:
        - /url: /amaran
      - link "Kombo" [ref=e175] [cursor=pointer]:
        - /url: /kombo
      - link "Laporan Mingguan" [ref=e179] [cursor=pointer]:
        - /url: /laporan-mingguan
      - generic [ref=e185]:
        - generic [ref=e186]: Pusat AI
        - generic [ref=e188]: NEW
      - generic [ref=e189]: 🤖 Cikgu Alesa AI
      - link "Cikgu Alesa Chat AI" [ref=e190] [cursor=pointer]:
        - /url: /cikgu
        - generic [ref=e194]: Cikgu Alesa Chat
        - generic [ref=e195]: AI
      - generic [ref=e196]: ✨ Visi & Pertandingan
      - link "Sekolah Bersaing NEW" [ref=e197] [cursor=pointer]:
        - /url: /sekolah-bersaing
        - generic [ref=e204]: Sekolah Bersaing
        - generic [ref=e205]: NEW
      - link "Tetapan Peribadi" [ref=e206] [cursor=pointer]:
        - /url: /tetapan
      - generic [ref=e211]: 🏆 Bilik Duta · 🔒 PREVIEW
      - link "Bilik Duta DEV" [ref=e212] [cursor=pointer]:
        - /url: /bilik-duta
        - generic [ref=e215]: Bilik Duta
        - generic [ref=e216]: DEV
      - generic [ref=e217]: 🤖 AI Pintar (Pelajar)
      - link "Wellbeing Alerts" [ref=e218] [cursor=pointer]:
        - /url: /wellbeing/alerts
      - link "Kamus AI" [ref=e222] [cursor=pointer]:
        - /url: /pusat-ai/kamus
      - link "Pendamping Motivasi" [ref=e226] [cursor=pointer]:
        - /url: /pusat-ai/pendamping
      - link "Doa & Motivasi" [ref=e230] [cursor=pointer]:
        - /url: /pusat-ai/doa
      - generic [ref=e234]: 🎯 AI Pintar (Guru)
      - link "Aktiviti Advisor" [ref=e235] [cursor=pointer]:
        - /url: /pusat-ai/aktiviti
      - link "Whiteboard → Quiz" [ref=e239] [cursor=pointer]:
        - /url: /pusat-ai/whiteboard
      - link "RPH (Cikgu Alesa)" [ref=e244] [cursor=pointer]:
        - /url: /cikgu/rph
      - link "Semak Karangan (Cikgu Alesa)" [ref=e249] [cursor=pointer]:
        - /url: /cikgu/essay
      - link "PBD (Cikgu Alesa)" [ref=e253] [cursor=pointer]:
        - /url: /cikgu/pbd
      - generic [ref=e258]: 🛡️ Kawalan Kualiti
      - link "Semakan Nota Master" [ref=e259] [cursor=pointer]:
        - /url: /admin/master-notes
      - link "Audit Log" [ref=e263] [cursor=pointer]:
        - /url: /admin/audit-log
      - generic [ref=e269]: 🏆 Bilik Duta
      - link "Bilik Duta" [ref=e273] [cursor=pointer]:
        - /url: /bilik-duta
      - link "Akademi Duta" [ref=e277] [cursor=pointer]:
        - /url: /akademi-duta
      - link "Kem & Bootcamp" [ref=e282] [cursor=pointer]:
        - /url: /bilik-duta/kem
      - generic [ref=e288]: ✨ Visi & Pertandingan
      - link "Profil Cerah" [ref=e292] [cursor=pointer]:
        - /url: /profil-cerah
      - link "Sekolah Bersaing" [ref=e297] [cursor=pointer]:
        - /url: /sekolah-bersaing
      - link "Cita-Cita Hijrah" [ref=e305] [cursor=pointer]:
        - /url: /cita-cita
      - generic [ref=e309]: 💎 Killer Features
      - link "Cikgu Suara" [ref=e313] [cursor=pointer]:
        - /url: /cikgu-suara
      - link "SPM Mock Exam" [ref=e318] [cursor=pointer]:
        - /url: /spm-mock
      - link "Wellbeing Alerts" [ref=e324] [cursor=pointer]:
        - /url: /wellbeing/alerts
      - link "Pembetulan" [ref=e328] [cursor=pointer]:
        - /url: /pembetulan
      - link "Mohon Keluarga Angkat" [ref=e335] [cursor=pointer]:
        - /url: /mohon-keluarga-angkat
      - link "Penguasaan" [ref=e339] [cursor=pointer]:
        - /url: /penguasaan
      - link "Laporan Soalan" [ref=e345] [cursor=pointer]:
        - /url: /laporan-soalan
      - link "Liga Pertandingan" [ref=e349] [cursor=pointer]:
        - /url: /liga
      - link "Perutusan" [ref=e357] [cursor=pointer]:
        - /url: /perutusan
      - generic [ref=e362]: Pembelajaran
      - link "Latih Tubi" [ref=e366] [cursor=pointer]:
        - /url: /practice
      - link "Soalan by Chapter" [ref=e376] [cursor=pointer]:
        - /url: /practice/chapter
      - link "Soalan Berstruktur" [ref=e382] [cursor=pointer]:
        - /url: /latihan-berstruktur
      - link "Kedudukan" [ref=e387] [cursor=pointer]:
        - /url: /ranking
      - link "PKSK PRO" [ref=e395] [cursor=pointer]:
        - /url: /pksk
        - generic [ref=e398]: PKSK
        - generic [ref=e399]: PRO
      - link "Artikel" [ref=e400] [cursor=pointer]:
        - /url: /artikel
      - link "Video" [ref=e405] [cursor=pointer]:
        - /url: /video
      - link "Permainan 🎮" [ref=e410] [cursor=pointer]:
        - /url: /permainan
        - generic [ref=e413]: Permainan
        - generic [ref=e414]: 🎮
      - link "Cabutan Bertuah 🎟️" [ref=e415] [cursor=pointer]:
        - /url: /cabutan
        - generic [ref=e418]: Cabutan Bertuah
        - generic [ref=e419]: 🎟️
      - link "Tournament" [ref=e420] [cursor=pointer]:
        - /url: /tournament
      - link "Topik" [ref=e428] [cursor=pointer]:
        - /url: /topics
      - link "Peta Belajar" [ref=e432] [cursor=pointer]:
        - /url: /peta-belajar
      - link "Kelas Saya" [ref=e436] [cursor=pointer]:
        - /url: /kelas-saya
      - link "Set Soalan Guru" [ref=e440] [cursor=pointer]:
        - /url: /set-soalan-saya
      - link "Audio KBAT" [ref=e445] [cursor=pointer]:
        - /url: /audio-kbat
      - link "Syiling & Token 🏆" [ref=e449] [cursor=pointer]:
        - /url: /gamification
        - generic [ref=e455]: Syiling & Token
        - generic [ref=e456]: 🏆
      - link "Tukar Token" [ref=e457] [cursor=pointer]:
        - /url: /gamification/convert
      - link "Cabaran Harian" [ref=e462] [cursor=pointer]:
        - /url: /gamification/challenges
      - link "Kedai Hadiah" [ref=e468] [cursor=pointer]:
        - /url: /gamification/rewards
      - link "Kelulusan Hadiah" [ref=e474] [cursor=pointer]:
        - /url: /cikgu/kelulusan-hadiah
      - link "Marketplace" [ref=e478] [cursor=pointer]:
        - /url: /marketplace
      - link "Papan Pendahulu" [ref=e483] [cursor=pointer]:
        - /url: /gamification/leaderboard
      - link "Pencapaian" [ref=e491] [cursor=pointer]:
        - /url: /gamification/achievements
      - link "Kotak Misteri" [ref=e499] [cursor=pointer]:
        - /url: /gamification/mystery-box
      - link "Rujuk Kawan" [ref=e505] [cursor=pointer]:
        - /url: /gamification/referral
      - link "Cikgu Alesa AI" [ref=e510] [cursor=pointer]:
        - /url: /cikgu
        - generic [ref=e514]: Cikgu Alesa
        - generic [ref=e515]: AI
      - generic [ref=e516]: Cikgu Alesa Tools
      - link "RPH (Rancangan Harian)" [ref=e520] [cursor=pointer]:
        - /url: /cikgu/rph
      - link "PBD Auto-Tag" [ref=e525] [cursor=pointer]:
        - /url: /cikgu/pbd
      - link "Mark Karangan" [ref=e531] [cursor=pointer]:
        - /url: /cikgu/essay
      - link "Admin Tebusan" [ref=e535] [cursor=pointer]:
        - /url: /admin/hadiah/tebusan
      - link "Timeline Saya" [ref=e540] [cursor=pointer]:
        - /url: /timeline
      - generic [ref=e545]: Portal Guru
      - link "Dashboard Guru" [ref=e549] [cursor=pointer]:
        - /url: /guru
      - link "Kelas Guru" [ref=e554] [cursor=pointer]:
        - /url: /guru/kelas
      - link "Sumbang Soalan" [ref=e559] [cursor=pointer]:
        - /url: /guru/soalan
      - link "Databank Soalan" [ref=e563] [cursor=pointer]:
        - /url: /guru/databank
      - link "Command Center LIVE" [ref=e569] [cursor=pointer]:
        - /url: /guru/command-center
        - generic [ref=e575]: Command Center
        - generic [ref=e576]: LIVE
      - generic [ref=e577]: HARIAN
      - link "Dashboard Guru" [ref=e581] [cursor=pointer]:
        - /url: /guru
      - link "Misi Harian" [ref=e586] [cursor=pointer]:
        - /url: /guru/misi-harian
      - link "Soalan by Chapter" [ref=e593] [cursor=pointer]:
        - /url: /practice/chapter
      - link "Kelas Saya" [ref=e599] [cursor=pointer]:
        - /url: /guru/kelas
      - link "Pelajar Saya" [ref=e604] [cursor=pointer]:
        - /url: /guru/pelajar
      - link "Kehadiran Digital" [ref=e609] [cursor=pointer]:
        - /url: /guru/kehadiran-digital
      - generic [ref=e615]: PENGAJARAN
      - link "Jadual Belajar" [ref=e619] [cursor=pointer]:
        - /url: /guru/jadual-belajar
      - link "Broadcast" [ref=e623] [cursor=pointer]:
        - /url: /guru/broadcast
      - link "Kelas Live" [ref=e628] [cursor=pointer]:
        - /url: /guru/live-kelas
      - generic [ref=e637]: PENILAIAN
      - link "Headcount" [ref=e641] [cursor=pointer]:
        - /url: /headcount
      - link "Prestasi" [ref=e646] [cursor=pointer]:
        - /url: /prestasi/kelas
      - link "Laporan" [ref=e650] [cursor=pointer]:
        - /url: /guru/laporan
      - link "Amaran Awal" [ref=e655] [cursor=pointer]:
        - /url: /amaran
      - generic [ref=e659]: ANALITIK
      - link "Monitoring" [ref=e663] [cursor=pointer]:
        - /url: /guru/monitoring
      - button "Kirkpatrick" [ref=e671]
      - link "Analisis Item" [ref=e680] [cursor=pointer]:
        - /url: /guru/analisis-item
      - link "Perbandingan Kelas" [ref=e685] [cursor=pointer]:
        - /url: /guru/perbandingan-kelas
      - link "Laporan Mingguan" [ref=e691] [cursor=pointer]:
        - /url: /guru/laporan-mingguan-kelas
      - generic [ref=e695]: BANK SOALAN
      - link "Sumbang Soalan" [ref=e699] [cursor=pointer]:
        - /url: /guru/soalan
      - link "Soalan & Rujukan" [ref=e703] [cursor=pointer]:
        - /url: /guru/soalan-guru
      - link "Soalan Berstruktur" [ref=e707] [cursor=pointer]:
        - /url: /guru/soalan-berstruktur
      - link "Databank Soalan" [ref=e712] [cursor=pointer]:
        - /url: /guru/databank
      - link "Set Soalan" [ref=e718] [cursor=pointer]:
        - /url: /guru/set-soalan
      - generic [ref=e723]: LAIN-LAIN
      - link "Syiling & Ganjaran" [ref=e727] [cursor=pointer]:
        - /url: /guru/gamifikasi
      - link "Sumbang Artikel" [ref=e734] [cursor=pointer]:
        - /url: /guru/artikel
      - link "Video" [ref=e739] [cursor=pointer]:
        - /url: /video
      - link "Kelas Saya BARU" [ref=e744] [cursor=pointer]:
        - /url: /kelas-saya
        - generic [ref=e747]: Kelas Saya
        - generic [ref=e748]: BARU
      - link "Set Soalan Guru" [ref=e749] [cursor=pointer]:
        - /url: /set-soalan-saya
      - generic [ref=e754]: PPD / JPN
      - link "Command Center LIVE" [ref=e758] [cursor=pointer]:
        - /url: /ppd/command-center
        - generic [ref=e764]: Command Center
        - generic [ref=e765]: LIVE
      - link "Dashboard PPD" [ref=e766] [cursor=pointer]:
        - /url: /ppd/dashboard
      - link "Statistik PPD" [ref=e770] [cursor=pointer]:
        - /url: /ppd/statistik-penggunaan
      - link "Ranking Kebangsaan" [ref=e775] [cursor=pointer]:
        - /url: /ppd/ranking-kebangsaan
      - link "Benchmark Sekolah" [ref=e783] [cursor=pointer]:
        - /url: /ppd/benchmark-sekolah
      - link "Peta Haba" [ref=e788] [cursor=pointer]:
        - /url: /ppd/peta-haba
      - link "Export Laporan" [ref=e794] [cursor=pointer]:
        - /url: /ppd/export-laporan
      - link "Leaderboard Sekolah" [ref=e801] [cursor=pointer]:
        - /url: /ppd/leaderboard-sekolah
      - link "Dashboard JPN" [ref=e809] [cursor=pointer]:
        - /url: /jpn/dashboard
      - link "Statistik Penggunaan" [ref=e813] [cursor=pointer]:
        - /url: /jpn/statistik-penggunaan
      - link "Ranking Kebangsaan JPN" [ref=e818] [cursor=pointer]:
        - /url: /jpn/ranking-kebangsaan
      - generic [ref=e826]: Admin
      - link "Ke Admin Panel" [ref=e830] [cursor=pointer]:
        - /url: /admin
      - link "Soalan by Chapter" [ref=e834] [cursor=pointer]:
        - /url: /practice/chapter
      - link "Billing Dashboard" [ref=e840] [cursor=pointer]:
        - /url: /admin/billing
      - link "Urus Produk" [ref=e845] [cursor=pointer]:
        - /url: /admin/marketplace/products
      - link "Urus Penjual" [ref=e851] [cursor=pointer]:
        - /url: /admin/marketplace/sellers
      - link "Urus Hadiah" [ref=e856] [cursor=pointer]:
        - /url: /admin/hadiah
      - link "Gamifikasi Guru" [ref=e862] [cursor=pointer]:
        - /url: /admin/gamifikasi/guru
      - link "Pakej 💎" [ref=e867] [cursor=pointer]:
        - /url: /pricing
        - generic [ref=e870]: Pakej
        - generic [ref=e871]: 💎
      - link "Invois Saya" [ref=e872] [cursor=pointer]:
        - /url: /billing/invoices
      - generic [ref=e877]: Bantuan
      - link "Tiket Bantuan" [ref=e881] [cursor=pointer]:
        - /url: /pusat-tuisyen/tiket
      - link "Urus Tiket 2" [ref=e890] [cursor=pointer]:
        - /url: /admin/tiket
        - generic [ref=e894]: Urus Tiket
        - generic [ref=e895]: "2"
      - link "Profil Saya" [ref=e897] [cursor=pointer]:
        - /url: /profile
      - link "Tetapan" [ref=e903] [cursor=pointer]:
        - /url: /tetapan
      - link "Panduan" [ref=e908] [cursor=pointer]:
        - /url: /pusat-tuisyen/panduan
      - link "Log Keluar" [ref=e912] [cursor=pointer]:
        - /url: /logout
    - paragraph [ref=e918]: © 2026 PRESTASIPLUS 🇲🇾
  - navigation [ref=e919]:
    - generic [ref=e920]:
      - link "Home" [ref=e921] [cursor=pointer]:
        - /url: /dashboard
      - link "SPM" [ref=e926] [cursor=pointer]:
        - /url: /spm
      - link "Game" [ref=e931] [cursor=pointer]:
        - /url: /permainan
      - link "Topik" [ref=e935] [cursor=pointer]:
        - /url: /topics
      - button "Chat" [ref=e939]
      - button "Lagi" [ref=e944]
```

# Test source

```ts
  1   | /**
  2   |  * Typed wrapper around `window.__mock` (overview §6.13). Every call first waits for
  3   |  * `__mock.ready`, then runs in the page with `page.evaluate`, so arguments and results must be
  4   |  * JSON-able (path patterns are strings).
  5   |  *
  6   |  * Module hooks (registered by module plugins, e.g. `pushNotification`, `setProgress`) are called
  7   |  * with `mock.hook(name, ...args)`.
  8   |  */
  9   | 
  10  | import type { Page } from '@playwright/test'
  11  | 
  12  | import type {
  13  |   MockFaultSpec,
  14  |   MockOutboxRecord,
  15  |   MockRequestRecord,
  16  |   MockTimeInput,
  17  | } from '../../src/mock/testing/contract.ts'
  18  | 
  19  | export interface MockHandle {
  20  |   /** Waits until the app booted the mock and installed `window.__mock`. */
  21  |   ready(): Promise<void>
  22  |   /** Calls a module hook (or any hook by name). Resolves after the hook's writes are stored. */
  23  |   hook<T = unknown>(name: string, ...args: unknown[]): Promise<T>
  24  |   /** Names of every hook on `window.__mock`, sorted. */
  25  |   names(): Promise<string[]>
  26  |   reset(overrides?: Record<string, unknown>): Promise<void>
  27  |   /** Moves the Playwright clock (e2e build) so that mock time equals `time`. */
  28  |   setNow(time: MockTimeInput): Promise<void>
  29  |   /** Runs the Playwright clock forward by `ms`, firing due timers. */
  30  |   advanceTime(ms: number): Promise<void>
  31  |   now(): Promise<number>
  32  |   setLatency(ms: number, pathPattern?: string): Promise<void>
  33  |   clearLatency(pathPattern?: string): Promise<void>
  34  |   failNext(pathPattern: string, spec: MockFaultSpec): Promise<void>
  35  |   networkErrorNext(pathPattern: string): Promise<void>
  36  |   setRandomSeed(seedBase: number): Promise<void>
  37  |   lastRequest(pathPattern?: string): Promise<MockRequestRecord | null>
  38  |   requests(pathPattern?: string): Promise<MockRequestRecord[]>
  39  |   config(key: string, ...value: [unknown?]): Promise<unknown>
  40  |   readonly outbox: {
  41  |     lastResetFor(email: string): Promise<string | null>
  42  |     last(type: string, to?: string): Promise<MockOutboxRecord | null>
  43  |     all(): Promise<MockOutboxRecord[]>
  44  |   }
  45  |   /** Fast login for a canonical account (core hook, writes `pp.auth`). Reload to apply it. */
  46  |   setUser(...args: (string | number | boolean)[]): Promise<unknown>
  47  |   /** M01 hook; throws until M01-T1 registers it. */
  48  |   expireSession(): Promise<unknown>
  49  | }
  50  | 
  51  | /** Boot budget of {@link waitForApp}: mock boot alone takes ~1.5 s, up to ~6 s under full load. */
  52  | export const APP_BOOT_TIMEOUT_MS = 15_000
  53  | 
  54  | export async function waitForMock(page: Page, timeout = APP_BOOT_TIMEOUT_MS): Promise<void> {
> 55  |   await page.waitForFunction(() => window.__mock?.ready === true, null, { timeout })
      |              ^ TimeoutError: page.waitForFunction: Timeout 15000ms exceeded.
  56  | }
  57  | 
  58  | /**
  59  |  * Waits until the app has booted: `__mock.ready`, the Vue app mounted on `#app`, and the router's
  60  |  * initial navigation (with its guard redirects) finished.
  61  |  */
  62  | export async function waitForApp(page: Page, timeout = APP_BOOT_TIMEOUT_MS): Promise<void> {
  63  |   await waitForMock(page, timeout)
  64  |   await page.waitForFunction(
  65  |     () => {
  66  |       const el = document.querySelector('#app') as (Element & { __vue_app__?: unknown }) | null
  67  |       return Boolean(el?.__vue_app__)
  68  |     },
  69  |     null,
  70  |     { timeout },
  71  |   )
  72  |   await page.evaluate(async () => {
  73  |     type RouterLike = { isReady(): Promise<void> }
  74  |     const el = document.querySelector('#app') as Element & {
  75  |       __vue_app__: { config: { globalProperties: { $router: RouterLike } } }
  76  |     }
  77  |     await el.__vue_app__.config.globalProperties.$router.isReady()
  78  |   })
  79  | }
  80  | 
  81  | /**
  82  |  * `page.goto(path)` for the app: loads the page, then waits for the boot ({@link waitForApp}) with
  83  |  * its own {@link APP_BOOT_TIMEOUT_MS} budget, so the first assertion keeps the 5 s default. Use it
  84  |  * for every app navigation by URL (including the first one).
  85  |  */
  86  | export async function gotoApp(
  87  |   page: Page,
  88  |   path: string,
  89  |   options: Parameters<Page['goto']>[1] = {},
  90  | ): Promise<void> {
  91  |   await page.goto(path, options)
  92  |   await waitForApp(page)
  93  | }
  94  | 
  95  | /** `page.reload()` for the app, with the same boot wait as {@link gotoApp}. */
  96  | export async function reloadApp(page: Page): Promise<void> {
  97  |   await page.reload()
  98  |   await waitForApp(page)
  99  | }
  100 | 
  101 | export function createMockHandle(page: Page): MockHandle {
  102 |   const call = async <T>(name: string, args: unknown[]): Promise<T> => {
  103 |     await waitForMock(page)
  104 |     return page.evaluate(
  105 |       async ([hookName, hookArgs]) => {
  106 |         const hooks = window.__mock as unknown as Record<string, unknown>
  107 |         const fn = hooks[hookName]
  108 |         if (typeof fn !== 'function') throw new Error(`window.__mock.${hookName} is not a hook`)
  109 |         return (await (fn as (...a: unknown[]) => unknown)(...hookArgs)) as T
  110 |       },
  111 |       [name, args] as const,
  112 |     ) as Promise<T>
  113 |   }
  114 | 
  115 |   const outbox = async <T>(name: 'lastResetFor' | 'last' | 'all', args: unknown[]): Promise<T> => {
  116 |     await waitForMock(page)
  117 |     return page.evaluate(
  118 |       ([method, methodArgs]) => {
  119 |         const box = window.__mock!.outbox as unknown as Record<string, (...a: unknown[]) => unknown>
  120 |         return box[method]!(...methodArgs) as T
  121 |       },
  122 |       [name, args] as const,
  123 |     ) as Promise<T>
  124 |   }
  125 | 
  126 |   return {
  127 |     ready: () => waitForMock(page),
  128 |     hook: <T>(name: string, ...args: unknown[]) => call<T>(name, args),
  129 |     names: () => call('names', []),
  130 |     reset: (overrides) => call('reset', overrides === undefined ? [] : [overrides]),
  131 |     setNow: (time) => call('setNow', [time]),
  132 |     advanceTime: (ms) => call('advanceTime', [ms]),
  133 |     now: () => call('now', []),
  134 |     setLatency: (ms, pathPattern) =>
  135 |       call('setLatency', pathPattern === undefined ? [ms] : [ms, pathPattern]),
  136 |     clearLatency: (pathPattern) =>
  137 |       call('clearLatency', pathPattern === undefined ? [] : [pathPattern]),
  138 |     failNext: (pathPattern, spec) => call('failNext', [pathPattern, spec]),
  139 |     networkErrorNext: (pathPattern) => call('networkErrorNext', [pathPattern]),
  140 |     setRandomSeed: (seedBase) => call('setRandomSeed', [seedBase]),
  141 |     lastRequest: (pathPattern) =>
  142 |       call('lastRequest', pathPattern === undefined ? [] : [pathPattern]),
  143 |     requests: (pathPattern) => call('requests', pathPattern === undefined ? [] : [pathPattern]),
  144 |     config: (key, ...value) => call('config', [key, ...value]),
  145 |     outbox: {
  146 |       lastResetFor: (email) => outbox('lastResetFor', [email]),
  147 |       last: (type, to) => outbox('last', to === undefined ? [type] : [type, to]),
  148 |       all: () => outbox('all', []),
  149 |     },
  150 |     setUser: (...args) => call('setUser', args),
  151 |     expireSession: () => call('expireSession', []),
  152 |   }
  153 | }
  154 | 
```