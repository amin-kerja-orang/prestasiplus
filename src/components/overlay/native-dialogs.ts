/**
 * Native `window.confirm` / `window.alert`, exactly as live (design-system §7.7, §8; overview §9).
 * Live uses them for destructive or state-changing actions and blocking notices; D10 forbids
 * replacing them with a styled dialog. The wrappers exist so unit tests can stub one function
 * and E2E tests can answer with `page.on('dialog')`. Pass the exact BM copy from the module SRS.
 */

/** `window.confirm(message)`: true = accept (submit), false = dismiss (send nothing). */
export function confirmNative(message: string): boolean {
  return window.confirm(message)
}

/** `window.alert(message)`: blocking notice, e.g. "Sila pilih tindakan terlebih dahulu". */
export function alertNative(message: string): void {
  window.alert(message)
}
