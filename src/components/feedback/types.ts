/** Variants of the live alert box (design-system §5 "Alert box", §7.8). */
export type AlertVariant = 'error' | 'success'

/**
 * One Laravel-style session flash (overview §9 `FlashOutlet` + `useFlash()`).
 * `message` holds one line or one line per field error.
 */
export interface FlashMessage {
  type: AlertVariant
  message: string | readonly string[]
}

/** Toast enter/leave transitions observed on live (M02 S2 "Disalin!", M10 S28 report toast). */
export type ToastTransition = 'fade' | 'slide'
