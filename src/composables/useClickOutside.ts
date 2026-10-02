/**
 * `useClickOutside(targets, handler)` (overview §9): Alpine `@click.outside`.
 *
 * As Alpine v3: one `click` listener on `document` (bubble phase); it ignores clicks inside any
 * target and clicks on nodes that were removed from the document during the click (e.g. a list
 * item re-rendered by its own click handler). Alpine also skips hidden elements; here the caller
 * passes `enabled` (e.g. the open state) instead. The listener is removed when the owning scope is
 * disposed, or by calling the returned function.
 */

import { getCurrentScope, onScopeDispose, toValue, type MaybeRefOrGetter } from 'vue'

type Target = MaybeRefOrGetter<Element | null | undefined>

export interface ClickOutsideOptions {
  /** Only react while this is true (default: always). */
  enabled?: MaybeRefOrGetter<boolean>
}

export function useClickOutside(
  targets: Target | readonly Target[],
  handler: (event: MouseEvent) => void,
  options: ClickOutsideOptions = {},
): () => void {
  if (typeof document === 'undefined') return () => undefined
  const list: readonly Target[] = Array.isArray(targets) ? targets : [targets as Target]

  const listener = (event: MouseEvent) => {
    if (options.enabled !== undefined && !toValue(options.enabled)) return
    const node = event.target
    if (!(node instanceof Node) || !node.isConnected) return
    for (const target of list) {
      const el = toValue(target)
      if (el && (el === node || el.contains(node))) return
    }
    handler(event)
  }

  document.addEventListener('click', listener)
  const stop = () => document.removeEventListener('click', listener)
  if (getCurrentScope()) onScopeDispose(stop)
  return stop
}
