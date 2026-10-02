# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: m10-teacher-class\smoke-pelajar.spec.ts >> M10 S6 Pelajar Saya >> SRS §9 a guest is sent to /login; a pelajar leaves /guru/pelajar for its landing page @m10
- Location: e2e\m10-teacher-class\smoke-pelajar.spec.ts:171:3

# Error details

```
TimeoutError: page.waitForFunction: Timeout 15000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [aria-hidden]: 📚
  - generic [aria-hidden]: ✏️
  - generic [aria-hidden]: ⭐
  - generic [aria-hidden]: 🎨
  - generic [aria-hidden]: 🚀
  - generic [aria-hidden]: 💡
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - img "PRESTASIPLUS" [ref=e8]
        - paragraph [ref=e9]: Platform Latih Tubi Nasional 🇲🇾
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Alamat Email
          - generic [ref=e16]:
            - textbox "Alamat Email" [ref=e17]:
              - /placeholder: nama@email.com
            - generic [aria-hidden]: "@"
        - generic [ref=e18]:
          - generic [ref=e19]: Kata Laluan
          - generic [ref=e23]:
            - textbox "Kata Laluan" [ref=e24]:
              - /placeholder: ••••••••
            - button [ref=e25]
        - generic [ref=e29]:
          - generic [ref=e30] [cursor=pointer]:
            - checkbox "Ingat saya" [ref=e31]
            - text: Ingat saya
          - generic [ref=e32]:
            - link "Lupa kata laluan?" [ref=e33] [cursor=pointer]:
              - /url: /password/reset
            - link "Reset melalui No IC" [ref=e34] [cursor=pointer]:
              - /url: /password/reset-ic
        - button "Log Masuk" [ref=e39]
        - paragraph [ref=e43]:
          - link [ref=e44] [cursor=pointer]:
            - /url: /register
            - text: Belum ada akaun?
            - strong [ref=e45]: Daftar Sekarang 🚀
        - paragraph [ref=e46]:
          - link "Kembali ke Laman Utama" [ref=e47] [cursor=pointer]:
            - /url: /
    - paragraph [ref=e50]: ❓ 128,989+ Soalan • 📚 31 Subjek • 🎓 11 Tahap
    - paragraph [ref=e51]: © 2026 PRESTASIPLUS. Platform Pendidikan Malaysia.
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