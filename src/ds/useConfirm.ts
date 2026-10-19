/**
 * `useConfirm()` replaces `confirmNative`: returns a promise that resolves true (confirmed) or
 * false (cancelled / dismissed). One `DsConfirmHost` must be mounted inside the shell (it renders
 * the `DsDialog`); without a host the call falls back to `window.confirm` so nothing hangs.
 */
import { reactive } from 'vue'

import { dsCopy } from './copy'
import { warnDeprecated } from './deprecate'

export interface ConfirmOptions {
  /** Same BM text the native `confirm()` showed. */
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive actions use the `error` colour (`danger` is a deprecated alias). */
  tone?: 'primary' | 'error' | 'danger'
  /**
   * The confirmed action. While it runs the dialog shows the loading state; the promise resolves
   * `true` when it settles and the dialog closes.
   */
  run?: () => Promise<unknown>
}

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  tone: 'primary' | 'error'
  loading: boolean
  run: (() => Promise<unknown>) | null
  resolve: ((value: boolean) => void) | null
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  title: dsCopy.confirmTitle,
  message: '',
  confirmLabel: dsCopy.confirmYes,
  cancelLabel: dsCopy.cancel,
  tone: 'primary',
  loading: false,
  run: null,
  resolve: null,
})

/** Counts mounted hosts so the composable knows whether it can render a dialog. */
export const confirmHost = { count: 0 }

export function settleConfirm(value: boolean): void {
  const done = confirmState.resolve
  confirmState.resolve = null
  confirmState.run = null
  confirmState.loading = false
  confirmState.open = false
  done?.(value)
}

/** Confirm button: runs the pending action (if any) in the loading state, then settles `true`. */
export async function acceptConfirm(): Promise<void> {
  const run = confirmState.run
  if (!run) {
    settleConfirm(true)
    return
  }
  confirmState.loading = true
  try {
    await run()
  } finally {
    settleConfirm(true)
  }
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return (options) => {
    if (confirmHost.count === 0) {
      return Promise.resolve(typeof window !== 'undefined' && window.confirm(options.message))
    }
    settleConfirm(false)
    if (options.tone === 'danger') warnDeprecated('useConfirm', 'tone: danger', 'tone: error')
    return new Promise<boolean>((resolve) => {
      Object.assign(confirmState, {
        title: options.title ?? dsCopy.confirmTitle,
        message: options.message,
        confirmLabel: options.confirmLabel ?? dsCopy.confirmYes,
        cancelLabel: options.cancelLabel ?? dsCopy.cancel,
        tone: options.tone === 'danger' || options.tone === 'error' ? 'error' : 'primary',
        loading: false,
        run: options.run ?? null,
        resolve,
        open: true,
      })
    })
  }
}
