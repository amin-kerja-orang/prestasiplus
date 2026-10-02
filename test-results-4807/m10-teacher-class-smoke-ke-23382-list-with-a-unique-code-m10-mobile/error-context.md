# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: m10-teacher-class\smoke-kelas.spec.ts >> M10 S5 Cipta Kelas >> SRS §12 #24 guru creates "5 Bestari" Kimia Ting. 5 at a secondary school: back on the list with a unique code @m10
- Location: e2e\m10-teacher-class\smoke-kelas.spec.ts:242:3

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
          - link "2" [ref=e12] [cursor=pointer]:
            - /url: /notifikasi
          - generic [ref=e17]:
            - button "Menu" [ref=e18]
            - link [ref=e20] [cursor=pointer]:
              - /url: /dashboard
              - img "PRESTASIPLUS" [ref=e21]
    - main [ref=e22]:
      - generic [ref=e23]:
        - link "Kembali" [ref=e24] [cursor=pointer]:
          - /url: /guru/kelas
        - generic [ref=e27]:
          - generic [ref=e28]:
            - heading "Pilih Sekolah" [level=2] [ref=e29]
            - textbox "Taip nama sekolah untuk cari..." [ref=e35]
          - generic [ref=e36]:
            - heading "Maklumat Kelas" [level=2] [ref=e37]
            - generic [ref=e40]:
              - generic [ref=e41]:
                - generic [ref=e42]: Nama Kumpulan *
                - textbox "Nama Kumpulan *" [ref=e43]:
                  - /placeholder: "cth: 5 Bestari"
                - paragraph [ref=e44]: Nama kumpulan latih tubi anda.
              - generic [ref=e45]:
                - generic [ref=e46]: Subjek *
                - combobox "Subjek *" [ref=e47]:
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
              - group "Tahap Pendidikan *" [ref=e48]:
                - generic [ref=e50]:
                  - generic [ref=e51] [cursor=pointer]: Tahun 1
                  - generic [ref=e53] [cursor=pointer]: Tahun 2
                  - generic [ref=e55] [cursor=pointer]: Tahun 3
                  - generic [ref=e57] [cursor=pointer]: Tahun 4
                  - generic [ref=e59] [cursor=pointer]: Tahun 5
                  - generic [ref=e61] [cursor=pointer]: Tahun 6
                  - generic [ref=e63] [cursor=pointer]: Ting. 1
                  - generic [ref=e65] [cursor=pointer]: Ting. 2
                  - generic [ref=e67] [cursor=pointer]: Ting. 3
                  - generic [ref=e69] [cursor=pointer]: Ting. 4
                  - generic [ref=e71] [cursor=pointer]: Ting. 5
              - generic [ref=e73]:
                - generic [ref=e74]: Penerangan (pilihan)
                - textbox "Penerangan (pilihan)" [ref=e75]:
                  - /placeholder: Penerangan ringkas tentang kelas ini...
          - button "Cipta Kelas" [ref=e76]
  - generic [ref=e79]:
    - generic [ref=e80]:
      - generic [ref=e81]:
        - generic [ref=e82]:
          - img "PRESTASIPLUS" [ref=e83]
          - paragraph [ref=e84]: Platform Latih Tubi Nasional
        - button [ref=e85]
      - generic [ref=e89]:
        - img "Avatar" [ref=e90]
        - generic [ref=e91]:
          - paragraph [ref=e92]: Guru Demo
          - paragraph [ref=e93]: teacher
    - navigation [ref=e94]:
      - link "Command Center LIVE" [ref=e95] [cursor=pointer]:
        - /url: /guru/command-center
        - generic [ref=e101]: Command Center
        - generic [ref=e102]: LIVE
      - generic [ref=e103]: HARIAN
      - link "Dashboard Guru" [ref=e107] [cursor=pointer]:
        - /url: /guru
      - link "Headcount" [ref=e112] [cursor=pointer]:
        - /url: /headcount
      - link "Misi Harian" [ref=e117] [cursor=pointer]:
        - /url: /guru/misi-harian
      - link "Soalan by Chapter" [ref=e124] [cursor=pointer]:
        - /url: /practice/chapter
      - link "Verify Soalan Struktur" [ref=e130] [cursor=pointer]:
        - /url: /guru/verify-soalan-struktur
      - link "Verify Soalan MCQ" [ref=e134] [cursor=pointer]:
        - /url: /guru/verify-soalan-mcq
      - link "Kelas Saya" [ref=e139] [cursor=pointer]:
        - /url: /guru/kelas
      - link "Pelajar Saya" [ref=e144] [cursor=pointer]:
        - /url: /guru/pelajar
      - link "Kehadiran Digital" [ref=e149] [cursor=pointer]:
        - /url: /guru/kehadiran-digital
      - generic [ref=e155]: PENGAJARAN
      - link "Jadual Belajar" [ref=e159] [cursor=pointer]:
        - /url: /guru/jadual-belajar
      - link "Broadcast" [ref=e163] [cursor=pointer]:
        - /url: /guru/broadcast
      - link "Kelas Live" [ref=e168] [cursor=pointer]:
        - /url: /guru/live-kelas
      - generic [ref=e177]: PENILAIAN
      - link "Prestasi" [ref=e181] [cursor=pointer]:
        - /url: /prestasi/kelas
      - link "Laporan" [ref=e185] [cursor=pointer]:
        - /url: /guru/laporan
      - link "Amaran Awal" [ref=e190] [cursor=pointer]:
        - /url: /amaran
      - generic [ref=e194]: ANALITIK
      - link "Monitoring" [ref=e198] [cursor=pointer]:
        - /url: /guru/monitoring
      - button "Kirkpatrick" [ref=e206]
      - link "Analitik Adaptif" [ref=e215] [cursor=pointer]:
        - /url: /analitik/pelajar
      - link "Analisa Item" [ref=e225] [cursor=pointer]:
        - /url: /analisa-item
      - link "Perbandingan Kelas" [ref=e230] [cursor=pointer]:
        - /url: /guru/perbandingan-kelas
      - link "Laporan Mingguan" [ref=e236] [cursor=pointer]:
        - /url: /guru/laporan-mingguan-kelas
      - generic [ref=e241]:
        - generic [ref=e242]: Pusat AI
        - generic [ref=e244]: NEW
      - generic [ref=e245]: 🤖 Cikgu Alesa AI
      - link "Cikgu Alesa Chat AI" [ref=e246] [cursor=pointer]:
        - /url: /cikgu
        - generic [ref=e250]: Cikgu Alesa Chat
        - generic [ref=e251]: AI
      - generic [ref=e252]: ✨ Visi & Pertandingan
      - link "Sekolah Bersaing NEW" [ref=e253] [cursor=pointer]:
        - /url: /sekolah-bersaing
        - generic [ref=e260]: Sekolah Bersaing
        - generic [ref=e261]: NEW
      - link "Tetapan Peribadi" [ref=e262] [cursor=pointer]:
        - /url: /tetapan
      - generic [ref=e267]: 🤖 AI Pintar (Pelajar)
      - link "Wellbeing Alerts" [ref=e268] [cursor=pointer]:
        - /url: /wellbeing/alerts
      - link "Kamus AI" [ref=e272] [cursor=pointer]:
        - /url: /pusat-ai/kamus
      - link "Pendamping Motivasi" [ref=e276] [cursor=pointer]:
        - /url: /pusat-ai/pendamping
      - link "Doa & Motivasi" [ref=e280] [cursor=pointer]:
        - /url: /pusat-ai/doa
      - generic [ref=e284]: 🎯 AI Pintar (Guru)
      - link "Aktiviti Advisor" [ref=e285] [cursor=pointer]:
        - /url: /pusat-ai/aktiviti
      - link "Whiteboard → Quiz" [ref=e289] [cursor=pointer]:
        - /url: /pusat-ai/whiteboard
      - link "RPH (Cikgu Alesa)" [ref=e294] [cursor=pointer]:
        - /url: /cikgu/rph
      - link "Semak Karangan (Cikgu Alesa)" [ref=e299] [cursor=pointer]:
        - /url: /cikgu/essay
      - link "PBD (Cikgu Alesa)" [ref=e303] [cursor=pointer]:
        - /url: /cikgu/pbd
      - generic [ref=e308]: BANK SOALAN
      - link "Sumbang Soalan" [ref=e312] [cursor=pointer]:
        - /url: /guru/soalan
      - link "Soalan & Rujukan" [ref=e316] [cursor=pointer]:
        - /url: /guru/soalan-guru
      - link "Soalan Berstruktur" [ref=e320] [cursor=pointer]:
        - /url: /guru/soalan-berstruktur
      - link "Databank Soalan" [ref=e325] [cursor=pointer]:
        - /url: /guru/databank
      - link "Set Soalan" [ref=e331] [cursor=pointer]:
        - /url: /guru/set-soalan
      - link "Audio KBAT" [ref=e336] [cursor=pointer]:
        - /url: /audio-kbat
      - link "Kertas Peperiksaan" [ref=e340] [cursor=pointer]:
        - /url: /guru/kertas-peperiksaan
      - link "Penjana Peperiksaan" [ref=e345] [cursor=pointer]:
        - /url: /guru/penjana-peperiksaan
      - generic [ref=e350]: AKTIVITI
      - link "Liga Pertandingan" [ref=e354] [cursor=pointer]:
        - /url: /liga
      - link "Tournament" [ref=e362] [cursor=pointer]:
        - /url: /tournament
      - link "Kombo" [ref=e366] [cursor=pointer]:
        - /url: /kombo
      - link "Syiling & Ganjaran" [ref=e370] [cursor=pointer]:
        - /url: /guru/gamifikasi
      - generic [ref=e377]: LAIN-LAIN
      - link "Perutusan" [ref=e381] [cursor=pointer]:
        - /url: /perutusan
      - link "Video" [ref=e386] [cursor=pointer]:
        - /url: /video
      - link "Sumbang Artikel" [ref=e391] [cursor=pointer]:
        - /url: /guru/artikel
      - link "Analisis Item" [ref=e396] [cursor=pointer]:
        - /url: /guru/analisis-item
      - generic [ref=e401]: Bantuan
      - link "Tiket Bantuan" [ref=e405] [cursor=pointer]:
        - /url: /pusat-tuisyen/tiket
      - link "Profil Saya" [ref=e415] [cursor=pointer]:
        - /url: /profile
      - link "Tetapan" [ref=e421] [cursor=pointer]:
        - /url: /tetapan
      - link "Panduan" [ref=e426] [cursor=pointer]:
        - /url: /pusat-tuisyen/panduan
      - link "Log Keluar" [ref=e430] [cursor=pointer]:
        - /url: /logout
    - paragraph [ref=e436]: © 2026 PRESTASIPLUS 🇲🇾
  - navigation [ref=e437]:
    - generic [ref=e438]:
      - link "Home" [ref=e439] [cursor=pointer]:
        - /url: /dashboard
      - link "SPM" [ref=e444] [cursor=pointer]:
        - /url: /spm
      - link "Game" [ref=e449] [cursor=pointer]:
        - /url: /permainan
      - link "Topik" [ref=e453] [cursor=pointer]:
        - /url: /topics
      - button "Chat" [ref=e457]
      - button "Lagi" [ref=e462]
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