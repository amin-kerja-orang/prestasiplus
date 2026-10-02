# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: m17-admin-dashboard\smoke-command-center-drill.spec.ts >> S7 student >> E2E-M17-60 subject row, eight weekly bars, mood panel
- Location: e2e\m17-admin-dashboard\smoke-command-center-drill.spec.ts:240:3

# Error details

```
TimeoutError: page.waitForFunction: Timeout 15000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "PrestasiPlus Command Center" [level=1] [ref=e5]
    - link "← Kembali ke Kelas" [ref=e6] [cursor=pointer]:
      - /url: /admin/command-center/classroom/370
  - generic [ref=e7]:
    - navigation [ref=e8]:
      - link "Command Center" [ref=e9] [cursor=pointer]:
        - /url: /admin/command-center
      - generic [aria-hidden] [ref=e10]: ▸
      - link "SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI" [ref=e11] [cursor=pointer]:
        - /url: /admin/command-center/school/8080
      - generic [aria-hidden] [ref=e12]: ▸
      - link "Cikgu Demo 1919" [ref=e13] [cursor=pointer]:
        - /url: /admin/command-center/school/8080/teacher/1919
      - generic [aria-hidden] [ref=e14]: ▸
      - link "5 PERNIAGAAN" [ref=e15] [cursor=pointer]:
        - /url: /admin/command-center/classroom/370
      - generic [aria-hidden] [ref=e16]: ▸
      - generic [ref=e17]: Murid Demo 2022
    - generic [ref=e18]:
      - generic "Klik untuk lihat semua sesi" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: Jumlah Jawapan 🔍
        - generic [ref=e21]: 2,378
      - generic [ref=e22]:
        - generic [ref=e23]: Ketepatan
        - generic [ref=e24]: 93.5%
      - generic [ref=e25]:
        - generic [ref=e26]: Hari Aktif
        - generic [ref=e27]: "34"
      - generic [ref=e28]:
        - generic [ref=e29]: Streak
        - generic [ref=e30]: "1"
      - generic [ref=e31]:
        - generic [ref=e32]: Konsistensi
        - generic [ref=e33]: 21%
    - generic [ref=e34]:
      - generic [ref=e35]:
        - heading "Pecahan Subjek" [level=2] [ref=e36]:
          - generic [aria-hidden] [ref=e37]: 📊
        - list [ref=e39]:
          - listitem [ref=e40]:
            - generic "Klik untuk lihat sesi" [ref=e41] [cursor=pointer]:
              - generic [ref=e42]: Matematik Tambahan 🔍
              - generic [ref=e44]: 90.7%
              - generic [ref=e45]: 243/268
          - listitem [ref=e46]:
            - generic "Klik untuk lihat sesi" [ref=e47] [cursor=pointer]:
              - generic [ref=e48]: Pendidikan Seni Visual 🔍
              - generic [ref=e50]: 92.1%
              - generic [ref=e51]: 197/214
          - listitem [ref=e52]:
            - generic "Klik untuk lihat sesi" [ref=e53] [cursor=pointer]:
              - generic [ref=e54]: Pendidikan Syariah Islamiah 🔍
              - generic [ref=e56]: 95.5%
              - generic [ref=e57]: 170/178
          - listitem [ref=e58]:
            - generic "Klik untuk lihat sesi" [ref=e59] [cursor=pointer]:
              - generic [ref=e60]: Perniagaan 🔍
              - generic [ref=e62]: 94.8%
              - generic [ref=e63]: 164/173
          - listitem [ref=e64]:
            - generic "Klik untuk lihat sesi" [ref=e65] [cursor=pointer]:
              - generic [ref=e66]: Biologi 🔍
              - generic [ref=e68]: 95.5%
              - generic [ref=e69]: 148/155
          - listitem [ref=e70]:
            - generic "Klik untuk lihat sesi" [ref=e71] [cursor=pointer]:
              - generic [ref=e72]: Sains 🔍
              - generic [ref=e74]: 89.8%
              - generic [ref=e75]: 123/137
          - listitem [ref=e76]:
            - generic "Klik untuk lihat sesi" [ref=e77] [cursor=pointer]:
              - generic [ref=e78]: Bahasa Inggeris 🔍
              - generic [ref=e80]: 94.9%
              - generic [ref=e81]: 129/136
          - listitem [ref=e82]:
            - generic "Klik untuk lihat sesi" [ref=e83] [cursor=pointer]:
              - generic [ref=e84]: Prinsip Perakaunan 🔍
              - generic [ref=e86]: 94.0%
              - generic [ref=e87]: 126/134
          - listitem [ref=e88]:
            - generic "Klik untuk lihat sesi" [ref=e89] [cursor=pointer]:
              - generic [ref=e90]: Ekonomi 🔍
              - generic [ref=e92]: 94.9%
              - generic [ref=e93]: 111/117
          - listitem [ref=e94]:
            - generic "Klik untuk lihat sesi" [ref=e95] [cursor=pointer]:
              - generic [ref=e96]: Pendidikan Islam 🔍
              - generic [ref=e98]: 93.9%
              - generic [ref=e99]: 108/115
          - listitem [ref=e100]:
            - generic "Klik untuk lihat sesi" [ref=e101] [cursor=pointer]:
              - generic [ref=e102]: Bahasa Melayu 🔍
              - generic [ref=e104]: 92.1%
              - generic [ref=e105]: 105/114
          - listitem [ref=e106]:
            - generic "Klik untuk lihat sesi" [ref=e107] [cursor=pointer]:
              - generic [ref=e108]: Fizik 🔍
              - generic [ref=e110]: 93.0%
              - generic [ref=e111]: 106/114
          - listitem [ref=e112]:
            - generic "Klik untuk lihat sesi" [ref=e113] [cursor=pointer]:
              - generic [ref=e114]: Matematik 🔍
              - generic [ref=e116]: 93.9%
              - generic [ref=e117]: 107/114
          - listitem [ref=e118]:
            - generic "Klik untuk lihat sesi" [ref=e119] [cursor=pointer]:
              - generic [ref=e120]: Tasawwur Islam 🔍
              - generic [ref=e122]: 96.9%
              - generic [ref=e123]: 93/96
          - listitem [ref=e124]:
            - generic "Klik untuk lihat sesi" [ref=e125] [cursor=pointer]:
              - generic [ref=e126]: Pendidikan Moral 🔍
              - generic [ref=e128]: 96.8%
              - generic [ref=e129]: 92/95
          - listitem [ref=e130]:
            - generic "Klik untuk lihat sesi" [ref=e131] [cursor=pointer]:
              - generic [ref=e132]: Kimia 🔍
              - generic [ref=e134]: 94.9%
              - generic [ref=e135]: 74/78
          - listitem [ref=e136]:
            - generic "Klik untuk lihat sesi" [ref=e137] [cursor=pointer]:
              - generic [ref=e138]: Sejarah 🔍
              - generic [ref=e140]: 93.6%
              - generic [ref=e141]: 73/78
          - listitem [ref=e142]:
            - generic "Klik untuk lihat sesi" [ref=e143] [cursor=pointer]:
              - generic [ref=e144]: Geografi 🔍
              - generic [ref=e146]: 94.6%
              - generic [ref=e147]: 53/56
          - listitem [ref=e148]:
            - generic "Klik untuk lihat sesi" [ref=e149] [cursor=pointer]:
              - generic [ref=e150]: Latihan Bebas 🔍
              - generic [ref=e152]: 16.7%
              - generic [ref=e153]: 1/6
      - generic [ref=e154]:
        - heading "Aktiviti Mingguan (8 Minggu)" [level=2] [ref=e155]:
          - generic [aria-hidden] [ref=e156]: 📈
        - list [ref=e158]:
          - listitem [ref=e159]:
            - generic [ref=e160]:
              - generic [ref=e161]: "0"
              - generic [ref=e164]:
                - generic [ref=e165]: "03"
                - generic [ref=e166]: /08
          - listitem [ref=e167]:
            - generic [ref=e168]:
              - generic [ref=e169]: "0"
              - generic [ref=e172]:
                - generic [ref=e173]: "10"
                - generic [ref=e174]: /08
          - listitem [ref=e175]:
            - generic [ref=e176]:
              - generic [ref=e177]: "0"
              - generic [ref=e180]:
                - generic [ref=e181]: "17"
                - generic [ref=e182]: /08
          - listitem [ref=e183]:
            - generic [ref=e184]:
              - generic [ref=e185]: "0"
              - generic [ref=e188]:
                - generic [ref=e189]: "24"
                - generic [ref=e190]: /08
          - listitem [ref=e191]:
            - generic [ref=e192]:
              - generic [ref=e193]: "0"
              - generic [ref=e196]:
                - generic [ref=e197]: "31"
                - generic [ref=e198]: /08
          - listitem [ref=e199]:
            - generic [ref=e200]:
              - generic [ref=e201]: "0"
              - generic [ref=e204]:
                - generic [ref=e205]: "07"
                - generic [ref=e206]: /09
          - listitem [ref=e207]:
            - generic [ref=e208] [cursor=pointer]:
              - generic [ref=e209]: "1166"
              - generic [ref=e212]:
                - generic [ref=e213]: "14"
                - generic [ref=e214]: /09
          - listitem [ref=e215]:
            - generic [ref=e216] [cursor=pointer]:
              - generic [ref=e217]: "452"
              - generic [ref=e220]:
                - generic [ref=e221]: "21"
                - generic [ref=e222]: /09
      - generic [ref=e223]:
        - heading "Trend Mood (30 Hari)" [level=2] [ref=e224]:
          - generic [aria-hidden] [ref=e225]: 💚
        - paragraph [ref=e227]: Tiada data mood
      - generic [ref=e228]:
        - heading "HeadCount" [level=2] [ref=e229]:
          - generic [aria-hidden] [ref=e230]: 📋
        - table [ref=e233]:
          - rowgroup [ref=e234]:
            - row [ref=e235]:
              - columnheader "Subjek" [ref=e236]
              - columnheader "TOV" [ref=e237]
              - columnheader "ETR" [ref=e238]
              - columnheader "RS" [ref=e239]
              - columnheader "Gred" [ref=e240]
              - columnheader "Tarikh" [ref=e241]
          - rowgroup [ref=e242]:
            - row [ref=e243] [cursor=pointer]:
              - cell "Perniagaan" [ref=e244]: Perniagaan 🔍
              - cell "40.00" [ref=e245]
              - cell "-" [ref=e246]
              - cell "-" [ref=e247]
              - cell "-" [ref=e248]
              - cell "16/06/2026" [ref=e249]
            - row [ref=e250] [cursor=pointer]:
              - cell "Sains" [ref=e251]: Sains 🔍
              - cell "-" [ref=e252]
              - cell "-" [ref=e253]
              - cell "-" [ref=e254]
              - cell "-" [ref=e255]
              - cell "16/06/2026" [ref=e256]
            - row [ref=e257] [cursor=pointer]:
              - cell "Matematik" [ref=e258]: Matematik 🔍
              - cell "-" [ref=e259]
              - cell "-" [ref=e260]
              - cell "-" [ref=e261]
              - cell "-" [ref=e262]
              - cell "16/06/2026" [ref=e263]
    - generic [ref=e264]:
      - heading "ALESA AI Insight" [level=2] [ref=e265]:
        - generic [aria-hidden] [ref=e266]: 🤖
      - generic [ref=e268]:
        - generic [ref=e269]: Analisis ALESA
        - paragraph [ref=e270]: Ketepatan cemerlang (93.5%). Konsistensi rendah (21%) - perlu usaha lebih.
        - paragraph [ref=e271]: "Sumber: Rule-based Analysis"
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