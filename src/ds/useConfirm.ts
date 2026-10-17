/**
 * `useConfirm()` replaces `confirmNative`: returns a promise that resolves true (confirmed) or
 * false (cancelled / dismissed). One `DsConfirmHost` must be mounted inside the shell (it renders
 * the `DsDialog`); without a host the call falls back to `window.confirm` so nothing hangs.
 */
import { reactive } from 'vue'

export interface ConfirmOptions {
  /** Same BM text the native `confirm()` showed. */
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive actions use the error colour. */
  tone?: 'primary' | 'danger'
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'title'>> {
  open: boolean
  title: string
  resolve: ((value: boolean) => void) | null
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  title: 'Pengesahan',
  message: '',
  confirmLabel: 'Ya',
  cancelLabel: 'Batal',
  tone: 'primary',
  resolve: null,
})

/** Counts mounted hosts so the composable knows whether it can render a dialog. */
export const confirmHost = { count: 0 }

export function settleConfirm(value: boolean): void {
  const done = confirmState.resolve
  confirmState.resolve = null
  confirmState.open = false
  done?.(value)
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return (options) => {
    if (confirmHost.count === 0) {
      return Promise.resolve(typeof window !== 'undefined' && window.confirm(options.message))
    }
    settleConfirm(false)
    return new Promise<boolean>((resolve) => {
      Object.assign(confirmState, {
        title: options.title ?? 'Pengesahan',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Ya',
        cancelLabel: options.cancelLabel ?? 'Batal',
        tone: options.tone ?? 'primary',
        resolve,
        open: true,
      })
    })
  }
}
