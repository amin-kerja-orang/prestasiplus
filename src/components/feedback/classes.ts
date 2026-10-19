import type { AlertVariant, ToastTransition } from './types'

/**
 * Alert box classes (design-system §5 / §7.8, M01 SRS FR-M01-09, M01 discovery S1).
 * Observed on live (S1 login error): `bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl`.
 * INFERRED: the success box mirrors the error box in green (M01 SRS §8, M02 SRS §8); the
 * layout (`flex items-start gap-3 p-4`), the text size and the icon size were not captured.
 */
export const ALERT_BOX_CLASSES: Record<AlertVariant, string> = {
  error:
    'flex items-start gap-3 p-4 text-sm bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl',
  success:
    'flex items-start gap-3 p-4 text-sm bg-green-50 border-2 border-green-200 text-green-700 rounded-2xl',
}

/** INFERRED: icon size and alignment next to the first line. */
export const ALERT_ICON_CLASS = 'mt-0.5 h-5 w-5 shrink-0'

/**
 * INFERRED toast box: live captured the element, its text and its transitions, but not its
 * classes or position (M02 S2 EL-M02-S2-104, M10 S28 EL-M10-S28-131). Callers pass `toastClass`
 * when a screen documents its own. `w-max` stops the `left-1/2` box shrinking to half the
 * viewport (it wrapped at 188px at 375); `max-w` keeps it inside a 320px viewport.
 */
export const TOAST_DEFAULT_CLASS =
  'fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg'

interface TransitionClasses {
  enterActiveClass: string
  enterFromClass: string
  enterToClass: string
  leaveActiveClass: string
  leaveFromClass: string
  leaveToClass: string
}

/**
 * Live Alpine transitions.
 * - `fade`: M02 `x-transition.opacity` (Alpine defaults: 150ms in, 75ms out).
 * - `slide`: M10 S28, copied from the live `x-transition:*` attributes.
 */
export const TOAST_TRANSITIONS: Record<ToastTransition, TransitionClasses> = {
  fade: {
    enterActiveClass: 'transition-opacity duration-150',
    enterFromClass: 'opacity-0',
    enterToClass: 'opacity-100',
    leaveActiveClass: 'transition-opacity duration-75',
    leaveFromClass: 'opacity-100',
    leaveToClass: 'opacity-0',
  },
  slide: {
    enterActiveClass: 'transition ease-out duration-300',
    enterFromClass: 'translate-y-4 opacity-0',
    enterToClass: 'translate-y-0 opacity-100',
    leaveActiveClass: 'transition ease-in duration-200',
    leaveFromClass: 'translate-y-0 opacity-100',
    leaveToClass: 'translate-y-4 opacity-0',
  },
}
