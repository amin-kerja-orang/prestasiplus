# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: m10-teacher-class\smoke-pelajar.spec.ts >> M10 S6 Pelajar Saya >> SRS §12 #26 guru school tab: 2 classes, school students, add pelajar (id 2) to 2002 → counter 9 @m10
- Location: e2e\m10-teacher-class\smoke-pelajar.spec.ts:130:3

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
          - heading "Pelajar" [level=1] [ref=e9]
          - paragraph [ref=e10]: Urus pelajar dalam kelas anda
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
        - generic [ref=e24]:
          - generic [ref=e32]:
            - paragraph [ref=e33]: "8"
            - paragraph [ref=e34]: Pelajar dalam kelas saya
          - link "Cipta" [ref=e35] [cursor=pointer]:
            - /url: /guru/pelajar/cipta
        - generic [ref=e39]:
          - button "Pelajar Sekolah" [ref=e40]
          - button "Pelajar Saya 8" [ref=e45]:
            - text: Pelajar Saya
            - generic [ref=e50]: "8"
        - list [ref=e51]:
          - listitem [ref=e52]:
            - generic [ref=e53]:
              - paragraph [ref=e54]: Murid Demo 01
              - paragraph [ref=e55]: Tingkatan 5
              - list [ref=e56]:
                - listitem [ref=e57]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e58]
                - listitem [ref=e62]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e63]
          - listitem [ref=e67]:
            - generic [ref=e68]:
              - paragraph [ref=e69]: Murid Demo 02
              - paragraph [ref=e70]: Tingkatan 5
              - list [ref=e71]:
                - listitem [ref=e72]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e73]
                - listitem [ref=e77]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e78]
          - listitem [ref=e82]:
            - generic [ref=e83]:
              - paragraph [ref=e84]: Murid Demo 03
              - paragraph [ref=e85]: Tingkatan 5
              - list [ref=e86]:
                - listitem [ref=e87]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e88]
                - listitem [ref=e92]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e93]
          - listitem [ref=e97]:
            - generic [ref=e98]:
              - paragraph [ref=e99]: Murid Demo 04
              - paragraph [ref=e100]: Tingkatan 5
              - list [ref=e101]:
                - listitem [ref=e102]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e103]
                - listitem [ref=e107]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e108]
          - listitem [ref=e112]:
            - generic [ref=e113]:
              - paragraph [ref=e114]: Murid Demo 05
              - paragraph [ref=e115]: Tingkatan 5
              - list [ref=e116]:
                - listitem [ref=e117]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e118]
                - listitem [ref=e122]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e123]
          - listitem [ref=e127]:
            - generic [ref=e128]:
              - paragraph [ref=e129]: Murid Demo 06
              - paragraph [ref=e130]: Tingkatan 5
              - list [ref=e131]:
                - listitem [ref=e132]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e133]
                - listitem [ref=e137]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e138]
          - listitem [ref=e142]:
            - generic [ref=e143]:
              - paragraph [ref=e144]: Murid Demo 07
              - paragraph [ref=e145]: Tingkatan 5
              - list [ref=e146]:
                - listitem [ref=e147]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e148]
                - listitem [ref=e152]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e153]
          - listitem [ref=e157]:
            - generic [ref=e158]:
              - paragraph [ref=e159]: Murid Demo 08
              - paragraph [ref=e160]: Tingkatan 5
              - list [ref=e161]:
                - listitem [ref=e162]:
                  - text: 5 MARIKH - Kimia
                  - button [ref=e163]
                - listitem [ref=e167]:
                  - text: 5 MARIKH - Sejarah
                  - button [ref=e168]
  - generic [ref=e172]:
    - generic [ref=e173]:
      - generic [ref=e174]:
        - generic [ref=e175]:
          - img "PRESTASIPLUS" [ref=e176]
          - paragraph [ref=e177]: Platform Latih Tubi Nasional
        - button [ref=e178]
      - generic [ref=e182]:
        - img "Avatar" [ref=e183]
        - generic [ref=e184]:
          - paragraph [ref=e185]: Guru Demo
          - paragraph [ref=e186]: teacher
    - navigation [ref=e187]:
      - link "Command Center LIVE" [ref=e188] [cursor=pointer]:
        - /url: /guru/command-center
        - generic [ref=e194]: Command Center
        - generic [ref=e195]: LIVE
      - generic [ref=e196]: HARIAN
      - link "Dashboard Guru" [ref=e200] [cursor=pointer]:
        - /url: /guru
      - link "Headcount" [ref=e205] [cursor=pointer]:
        - /url: /headcount
      - link "Misi Harian" [ref=e210] [cursor=pointer]:
        - /url: /guru/misi-harian
      - link "Soalan by Chapter" [ref=e217] [cursor=pointer]:
        - /url: /practice/chapter
      - link "Verify Soalan Struktur" [ref=e223] [cursor=pointer]:
        - /url: /guru/verify-soalan-struktur
      - link "Verify Soalan MCQ" [ref=e227] [cursor=pointer]:
        - /url: /guru/verify-soalan-mcq
      - link "Kelas Saya" [ref=e232] [cursor=pointer]:
        - /url: /guru/kelas
      - link "Pelajar Saya" [ref=e237] [cursor=pointer]:
        - /url: /guru/pelajar
      - link "Kehadiran Digital" [ref=e242] [cursor=pointer]:
        - /url: /guru/kehadiran-digital
      - generic [ref=e248]: PENGAJARAN
      - link "Jadual Belajar" [ref=e252] [cursor=pointer]:
        - /url: /guru/jadual-belajar
      - link "Broadcast" [ref=e256] [cursor=pointer]:
        - /url: /guru/broadcast
      - link "Kelas Live" [ref=e261] [cursor=pointer]:
        - /url: /guru/live-kelas
      - generic [ref=e270]: PENILAIAN
      - link "Prestasi" [ref=e274] [cursor=pointer]:
        - /url: /prestasi/kelas
      - link "Laporan" [ref=e278] [cursor=pointer]:
        - /url: /guru/laporan
      - link "Amaran Awal" [ref=e283] [cursor=pointer]:
        - /url: /amaran
      - generic [ref=e287]: ANALITIK
      - link "Monitoring" [ref=e291] [cursor=pointer]:
        - /url: /guru/monitoring
      - button "Kirkpatrick" [ref=e299]
      - link "Analitik Adaptif" [ref=e308] [cursor=pointer]:
        - /url: /analitik/pelajar
      - link "Analisa Item" [ref=e318] [cursor=pointer]:
        - /url: /analisa-item
      - link "Perbandingan Kelas" [ref=e323] [cursor=pointer]:
        - /url: /guru/perbandingan-kelas
      - link "Laporan Mingguan" [ref=e329] [cursor=pointer]:
        - /url: /guru/laporan-mingguan-kelas
      - generic [ref=e334]:
        - generic [ref=e335]: Pusat AI
        - generic [ref=e337]: NEW
      - generic [ref=e338]: 🤖 Cikgu Alesa AI
      - link "Cikgu Alesa Chat AI" [ref=e339] [cursor=pointer]:
        - /url: /cikgu
        - generic [ref=e343]: Cikgu Alesa Chat
        - generic [ref=e344]: AI
      - generic [ref=e345]: ✨ Visi & Pertandingan
      - link "Sekolah Bersaing NEW" [ref=e346] [cursor=pointer]:
        - /url: /sekolah-bersaing
        - generic [ref=e353]: Sekolah Bersaing
        - generic [ref=e354]: NEW
      - link "Tetapan Peribadi" [ref=e355] [cursor=pointer]:
        - /url: /tetapan
      - generic [ref=e360]: 🤖 AI Pintar (Pelajar)
      - link "Wellbeing Alerts" [ref=e361] [cursor=pointer]:
        - /url: /wellbeing/alerts
      - link "Kamus AI" [ref=e365] [cursor=pointer]:
        - /url: /pusat-ai/kamus
      - link "Pendamping Motivasi" [ref=e369] [cursor=pointer]:
        - /url: /pusat-ai/pendamping
      - link "Doa & Motivasi" [ref=e373] [cursor=pointer]:
        - /url: /pusat-ai/doa
      - generic [ref=e377]: 🎯 AI Pintar (Guru)
      - link "Aktiviti Advisor" [ref=e378] [cursor=pointer]:
        - /url: /pusat-ai/aktiviti
      - link "Whiteboard → Quiz" [ref=e382] [cursor=pointer]:
        - /url: /pusat-ai/whiteboard
      - link "RPH (Cikgu Alesa)" [ref=e387] [cursor=pointer]:
        - /url: /cikgu/rph
      - link "Semak Karangan (Cikgu Alesa)" [ref=e392] [cursor=pointer]:
        - /url: /cikgu/essay
      - link "PBD (Cikgu Alesa)" [ref=e396] [cursor=pointer]:
        - /url: /cikgu/pbd
      - generic [ref=e401]: BANK SOALAN
      - link "Sumbang Soalan" [ref=e405] [cursor=pointer]:
        - /url: /guru/soalan
      - link "Soalan & Rujukan" [ref=e409] [cursor=pointer]:
        - /url: /guru/soalan-guru
      - link "Soalan Berstruktur" [ref=e413] [cursor=pointer]:
        - /url: /guru/soalan-berstruktur
      - link "Databank Soalan" [ref=e418] [cursor=pointer]:
        - /url: /guru/databank
      - link "Set Soalan" [ref=e424] [cursor=pointer]:
        - /url: /guru/set-soalan
      - link "Audio KBAT" [ref=e429] [cursor=pointer]:
        - /url: /audio-kbat
      - link "Kertas Peperiksaan" [ref=e433] [cursor=pointer]:
        - /url: /guru/kertas-peperiksaan
      - link "Penjana Peperiksaan" [ref=e438] [cursor=pointer]:
        - /url: /guru/penjana-peperiksaan
      - generic [ref=e443]: AKTIVITI
      - link "Liga Pertandingan" [ref=e447] [cursor=pointer]:
        - /url: /liga
      - link "Tournament" [ref=e455] [cursor=pointer]:
        - /url: /tournament
      - link "Kombo" [ref=e459] [cursor=pointer]:
        - /url: /kombo
      - link "Syiling & Ganjaran" [ref=e463] [cursor=pointer]:
        - /url: /guru/gamifikasi
      - generic [ref=e470]: LAIN-LAIN
      - link "Perutusan" [ref=e474] [cursor=pointer]:
        - /url: /perutusan
      - link "Video" [ref=e479] [cursor=pointer]:
        - /url: /video
      - link "Sumbang Artikel" [ref=e484] [cursor=pointer]:
        - /url: /guru/artikel
      - link "Analisis Item" [ref=e489] [cursor=pointer]:
        - /url: /guru/analisis-item
      - generic [ref=e494]: Bantuan
      - link "Tiket Bantuan" [ref=e498] [cursor=pointer]:
        - /url: /pusat-tuisyen/tiket
      - link "Profil Saya" [ref=e508] [cursor=pointer]:
        - /url: /profile
      - link "Tetapan" [ref=e514] [cursor=pointer]:
        - /url: /tetapan
      - link "Panduan" [ref=e519] [cursor=pointer]:
        - /url: /pusat-tuisyen/panduan
      - link "Log Keluar" [ref=e523] [cursor=pointer]:
        - /url: /logout
    - paragraph [ref=e529]: © 2026 PRESTASIPLUS 🇲🇾
  - navigation [ref=e530]:
    - generic [ref=e531]:
      - link "Home" [ref=e532] [cursor=pointer]:
        - /url: /dashboard
      - link "SPM" [ref=e537] [cursor=pointer]:
        - /url: /spm
      - link "Game" [ref=e542] [cursor=pointer]:
        - /url: /permainan
      - link "Topik" [ref=e546] [cursor=pointer]:
        - /url: /topics
      - button "Chat" [ref=e550]
      - button "Lagi" [ref=e555]
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