/**
 * Test-hook boot for the dev and e2e builds (overview §6.13, ADR-0011). Private to the mock core
 * (ESLint `MOCK_TESTING_PRIVATE`): load it only behind the static env check, so the demo build
 * drops it:
 *
 * ```ts
 * if (import.meta.env.VITE_TEST_HOOKS === 'true') {
 *   const { bootWithTestHooks } = await import('./testing')
 *   return (await bootWithTestHooks(bootMock, options)).runtime
 * }
 * return bootMock(options)
 * ```
 *
 * Order (all before the transport answers its first request):
 * 1. read and validate `window.__MOCK_INIT__` (`now`, `latency`, `seed`, `overrides` go to boot);
 * 2. boot the mock;
 * 3. install `window.__mock` (module hook name collisions throw here);
 * 4. apply `__MOCK_INIT__.session` through the `setUser` hook (F-11 writes `pp.auth`).
 */

import type { BootMockOptions, MockRuntime } from '../index'
import type { MockTestHooks } from './contract'
import { installTestHooks, type HookTarget } from './hooks'
import { applyInitSession, readMockInit } from './init'

export * from './contract'
export {
  BUILTIN_HOOK_NAMES,
  collectModuleHooks,
  createTestHooks,
  DELEGATED_HOOK_NAMES,
  installTestHooks,
  PASSWORD_RESET_OUTBOX_TYPE,
  TEST_HOOKS_SENTINEL,
  type HookTarget,
  type ModuleHookEntry,
  type TestHooksOptions,
} from './hooks'
export { applyInitSession, MOCK_INIT_GLOBAL, parseMockInit, readMockInit } from './init'

export interface BootWithTestHooksOptions extends BootMockOptions {
  /** Where `__MOCK_INIT__` is read and `__mock` installed. Default `globalThis` (the window). */
  target?: HookTarget
}

export interface BootedWithTestHooks {
  runtime: MockRuntime
  hooks: MockTestHooks
}

/**
 * Boots the mock with `window.__MOCK_INIT__` applied and installs `window.__mock`. `boot` is
 * `bootMock` from `src/mock/index.ts`, passed in so this module never imports the mock entry at
 * runtime (no import cycle). An explicit `options.init` wins over the global.
 */
export async function bootWithTestHooks(
  boot: (options: BootMockOptions) => Promise<MockRuntime>,
  options: BootWithTestHooksOptions = {},
): Promise<BootedWithTestHooks> {
  const { target, ...bootOptions } = options
  const fromGlobal = readMockInit(target)
  const init = bootOptions.init ?? fromGlobal.init
  const runtime = await boot({ ...bootOptions, init })
  const hooks = installTestHooks(runtime, {
    ...(bootOptions.mode === undefined ? {} : { mode: bootOptions.mode }),
    ...(target === undefined ? {} : { target }),
  })
  await applyInitSession(hooks, fromGlobal.session)
  return { runtime, hooks }
}
