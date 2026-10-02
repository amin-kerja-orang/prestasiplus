/**
 * `window.__mock`: the test hooks of the dev and e2e builds (overview §6.13, ADR-0011).
 *
 * This module is loaded only behind the static check `import.meta.env.VITE_TEST_HOOKS === 'true'`
 * (see `./index.ts`), so the demo build drops it. `scripts/check-demo-bundle.mjs` proves it: it
 * fails when {@link TEST_HOOKS_SENTINEL} appears in a build output.
 *
 * - Built-in hooks map onto the mock runtime (F-06): `reset`, clock, latency, faults, request log,
 *   seed base, fixture config and outbox.
 * - Module hooks come from `plugins[].hooks` (core first, then registry order). Hook names are
 *   global: a module hook that reuses a built-in name or another plugin's hook name throws at boot.
 * - `setUser` (F-11 core) and `expireSession` (M01) are **delegated** built-ins: a plugin provides
 *   them. Until one does, calling them throws a clear error.
 * - Clock: in the e2e build (`passthrough` policy, offset 0) `setNow` / `advanceTime` drive the
 *   Playwright clock through the bridge the fixture exposes (`PLAYWRIGHT_CLOCK_BINDING`); elsewhere
 *   they move the shared clock's offset (`mockClockControls`).
 */

import { toEpochMs } from '@/lib/time'

import { mockClockControls, mockClockPolicyForMode } from '../determinism/clock'
import type { MockRuntime } from '../index'
import type { MockHook, MockPlugin, MockPluginId } from '../server/plugin'
import {
  PLAYWRIGHT_CLOCK_BINDING,
  type MockClockMode,
  type MockOutboxRecord,
  type MockRequestRecord,
  type MockTestHooks,
  type MockTestHooksBase,
  type PlaywrightClockBridge,
} from './contract'

/**
 * Dedicated build marker (overview §6.13, ADR-0011 amendment 1). It exists **only** to be found by
 * `scripts/check-demo-bundle.mjs` (keep the two in step; a unit test checks it). It is published
 * as `window.__mock.sentinel`, so every build that contains the hooks also contains this string.
 */
export const TEST_HOOKS_SENTINEL = 'pp-test-hooks-sentinel-5c1f0e7a'

/** Built-in hook names, reserved against module hooks. */
export const BUILTIN_HOOK_NAMES: readonly string[] = Object.freeze([
  'ready',
  'sentinel',
  'clockMode',
  'reset',
  'setNow',
  'advanceTime',
  'now',
  'setLatency',
  'clearLatency',
  'failNext',
  'networkErrorNext',
  'setRandomSeed',
  'lastRequest',
  'requests',
  'config',
  'outbox',
  'names',
])

/** Built-in names a plugin is expected to provide (overview §6.13: F-11 `setUser`, M01 `expireSession`). */
export const DELEGATED_HOOK_NAMES: Readonly<Record<string, string>> = Object.freeze({
  setUser: 'the mock core (F-11, src/mock/core-data)',
  expireSession: 'the M01 mock plugin (M01-T1)',
})

/** Outbox message type of password-reset e-mails (`outbox.lastResetFor`). */
export const PASSWORD_RESET_OUTBOX_TYPE = 'password-reset'

const HOOK_NAME_RE = /^[A-Za-z_$][\w$]*$/

export interface ModuleHookEntry {
  name: string
  owner: MockPluginId
  hook: MockHook
}

/**
 * Collects `plugins[].hooks` in plugin order and checks the names: a valid identifier, not a
 * built-in, and not already registered by another plugin. Throws on the first collision.
 */
export function collectModuleHooks(plugins: readonly MockPlugin<object>[]): ModuleHookEntry[] {
  const owners = new Map<string, MockPluginId>()
  const entries: ModuleHookEntry[] = []
  for (const plugin of plugins) {
    for (const [name, hook] of Object.entries(plugin.hooks)) {
      if (!HOOK_NAME_RE.test(name)) {
        throw new Error(`mock hooks: ${plugin.id} registers an invalid hook name '${name}'`)
      }
      if (typeof hook !== 'function') {
        throw new Error(`mock hooks: ${plugin.id} hook '${name}' is not a function`)
      }
      if (BUILTIN_HOOK_NAMES.includes(name)) {
        throw new Error(
          `mock hooks: ${plugin.id} registers '${name}', which is a built-in hook of window.__mock`,
        )
      }
      const prev = owners.get(name)
      if (prev !== undefined) {
        throw new Error(`mock hooks: hook '${name}' is registered by both ${prev} and ${plugin.id}`)
      }
      owners.set(name, plugin.id)
      entries.push({ name, owner: plugin.id, hook })
    }
  }
  return entries
}

/** Where the hooks are installed and the clock bridge is looked up (`window` in the browser). */
export type HookTarget = { [key: string]: unknown }

export interface TestHooksOptions {
  /** `import.meta.env.MODE` by default; `'e2e'` selects the Playwright clock. */
  mode?: string
  /** Default `globalThis` (the window). */
  target?: HookTarget
}

function toRecord(entry: MockRequestRecord | undefined): MockRequestRecord | null {
  return entry ? { ...entry } : null
}

function toOutboxRecord(message: MockOutboxRecord | undefined): MockOutboxRecord | null {
  return message ? { ...message } : null
}

function defaultTarget(): HookTarget {
  return globalThis
}

/**
 * Builds the `window.__mock` object for `runtime` (without installing it). Module hook collisions
 * throw here.
 */
export function createTestHooks(
  runtime: MockRuntime,
  options: TestHooksOptions = {},
): MockTestHooks {
  const target = options.target ?? defaultTarget()
  const policy = mockClockPolicyForMode(options.mode ?? import.meta.env.MODE)
  const clockMode: MockClockMode = policy === 'passthrough' ? 'playwright' : 'offset'
  const offsetClock = mockClockControls(runtime.clock)
  const moduleHooks = collectModuleHooks(runtime.plugins)

  const bridge = (): PlaywrightClockBridge => {
    const fn = target[PLAYWRIGHT_CLOCK_BINDING]
    if (typeof fn !== 'function') {
      throw new Error(
        `__mock.setNow/advanceTime: the e2e build moves time with the Playwright clock. ` +
          `Expose it first: context.exposeFunction('${PLAYWRIGHT_CLOCK_BINDING}', …) ` +
          `(or call context.clock directly).`,
      )
    }
    return fn as PlaywrightClockBridge
  }

  const settle = () => runtime.db.settled().catch(() => undefined)

  const base: Omit<MockTestHooksBase, 'setUser' | 'expireSession'> = {
    ready: true,
    sentinel: TEST_HOOKS_SENTINEL,
    clockMode,
    async reset(overrides) {
      await runtime.reset(overrides ?? {})
    },
    async setNow(time) {
      const at = toEpochMs(time)
      if (!Number.isFinite(at)) throw new RangeError(`setNow: invalid time ${String(time)}`)
      if (clockMode === 'playwright') {
        // mock now = Date.now() + offset, so the browser time is the target minus the offset.
        await bridge()('setNow', at - runtime.clock.getOffset())
        return
      }
      offsetClock.setNow(at)
    },
    async advanceTime(ms) {
      if (!Number.isFinite(ms)) throw new RangeError(`advanceTime: invalid ms ${String(ms)}`)
      if (clockMode === 'playwright') {
        await bridge()('advanceTime', ms)
        return
      }
      offsetClock.advanceTime(ms)
    },
    now: () => runtime.clock.now(),
    setLatency(ms, pathPattern) {
      runtime.latency.set(ms, pathPattern)
    },
    clearLatency(pathPattern) {
      runtime.latency.clear(pathPattern)
    },
    failNext(pathPattern, spec) {
      runtime.faults.failNext(pathPattern, spec)
    },
    networkErrorNext(pathPattern) {
      runtime.faults.networkErrorNext(pathPattern)
    },
    setRandomSeed(seedBase) {
      if (!Number.isInteger(seedBase)) {
        throw new RangeError(`setRandomSeed: invalid seed ${String(seedBase)}`)
      }
      runtime.setRandomSeed(seedBase)
    },
    lastRequest: (pathPattern) => toRecord(runtime.log.last(pathPattern)),
    requests: (pathPattern) => runtime.log.entries(pathPattern).map((e) => ({ ...e })),
    config(...args: [key: string, value?: unknown]) {
      const [key, value] = args
      if (args.length < 2) return runtime.config.get(key)
      runtime.config.set(key, value)
      return value
    },
    outbox: {
      lastResetFor(email) {
        const token = runtime.outbox.last(PASSWORD_RESET_OUTBOX_TYPE, email)?.data?.token
        return typeof token === 'string' ? token : null
      },
      last: (type, to) => toOutboxRecord(runtime.outbox.last(type, to)),
      all: () => runtime.outbox.all().map((m) => ({ ...m })),
    },
    names: () => Object.keys(hooks).sort(),
  }

  const hooks: Record<string, unknown> = { ...base }
  for (const [name, owner] of Object.entries(DELEGATED_HOOK_NAMES)) {
    hooks[name] = () =>
      Promise.reject(new Error(`__mock.${name} is not available yet: it is provided by ${owner}.`))
  }
  for (const { name, hook } of moduleHooks) {
    // Always async for the page, and write-through: resolve after the hook's commits are stored,
    // so a `page.reload()` right after a hook sees its data.
    hooks[name] = async (...args: unknown[]) => {
      const result = await (hook as (...a: unknown[]) => unknown)(...args)
      await settle()
      return result
    }
  }
  return Object.freeze(hooks) as MockTestHooks
}

/**
 * Installs `window.__mock` (and an empty `window.__charts` registry if F-17's `ChartCanvas` has not
 * created it yet). Returns the hooks.
 */
export function installTestHooks(
  runtime: MockRuntime,
  options: TestHooksOptions = {},
): MockTestHooks {
  const target = options.target ?? defaultTarget()
  const hooks = createTestHooks(runtime, { ...options, target })
  target.__charts ??= {}
  target.__mock = hooks
  return hooks
}
