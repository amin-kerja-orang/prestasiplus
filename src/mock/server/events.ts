/**
 * Server events (`ctx.emit`, overview §6.4). Handlers announce things that are not HTTP responses,
 * e.g. "a notification was pushed". Test hooks and the runtime subscribe with `on(...)`.
 * Listener errors are reported to the console and never break the handler.
 */

export type MockEmit = (event: string, payload?: unknown) => void
export type MockEventListener = (payload: unknown, event: string) => void

export interface MockEvents {
  emit: MockEmit
  /** Subscribe to `event`, or to every event with `'*'`. Returns an unsubscribe function. */
  on(event: string, listener: MockEventListener): () => void
  clear(): void
}

export function createMockEvents(): MockEvents {
  const listeners = new Map<string, Set<MockEventListener>>()

  function call(set: Set<MockEventListener> | undefined, payload: unknown, event: string) {
    for (const listener of set ?? []) {
      try {
        listener(payload, event)
      } catch (err) {
        console.error(`mock: listener for '${event}' failed`, err)
      }
    }
  }

  return {
    emit(event, payload) {
      call(listeners.get(event), payload, event)
      call(listeners.get('*'), payload, event)
    },
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) listeners.set(event, (set = new Set()))
      set.add(listener)
      return () => set.delete(listener)
    },
    clear: () => listeners.clear(),
  }
}
