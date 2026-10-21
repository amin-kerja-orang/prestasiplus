import { AsyncLocalStorage } from 'node:async_hooks'

import type { AiCallerContext } from './ai.types'

const storage = new AsyncLocalStorage<AiCallerContext>()

/**
 * The intake worker (BE-38) reaches the AI through the `AI_EXTRACTOR` port, whose `extractPaper(req, signal)` has no room
 * for the caller identity. A caller that knows it (the job handler) runs the call inside `runWithAiContext`, and the
 * port adapter reads it here. The context is for the cost log and the rate limits and is never sent to a provider.
 */
export function runWithAiContext<T>(context: AiCallerContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function currentAiContext(): AiCallerContext {
  return storage.getStore() ?? {}
}
