/** Modal layouts (build-plan F-15, overview §9, design-system §7.7, NFR-RESP-07). */
export type ModalVariant = 'margin' | 'sheet'

/** Why a modal closed: backdrop click, Esc, or the slot's `close()` ("Batal" / `X`). */
export type ModalCloseReason = 'backdrop' | 'esc' | 'button'

export interface ModalClasses {
  container: string
  backdrop: string
  panel: string
}

/**
 * - `margin`: the live Alpine report modal (M05 revision page, M04 S14), copied verbatim.
 *   Below `md` the `p-4` container gives a full-width panel with small margins; from `md`
 *   `max-w-lg` makes it a centred bounded dialog. The panel scrolls within 90vh.
 * - `sheet`: the live bottom-anchored modal (`#ios-install-modal`, user shell): container
 *   `fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4`, panel
 *   `bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden`. The `bg-black/50` tint is
 *   moved to its own backdrop element (same look) so backdrop clicks work the same in both
 *   variants (the sheet preset does not close on it; see MODAL_BEHAVIOUR). INFERRED: `md:items-center` (live shows it on iOS only, so the wide layout was never
 *   observed; build-plan F-15 says "centred from md").
 */
export const MODAL_CLASSES: Record<ModalVariant, ModalClasses> = {
  margin: {
    container: 'fixed inset-0 z-50 flex items-center justify-center p-4',
    backdrop: 'absolute inset-0 bg-black/40',
    panel:
      'relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto',
  },
  sheet: {
    container: 'fixed inset-0 z-[100] flex items-end justify-center p-4 md:items-center',
    backdrop: 'absolute inset-0 bg-black/50',
    panel: 'relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden',
  },
}

/** `fade`: the report modal's live `x-transition`. `none`: shown/hidden at once (`style.display`). */
export type ModalTransition = 'fade' | 'none'

export interface ModalBehaviour {
  closeOnBackdrop: boolean
  closeOnEsc: boolean
  transition: ModalTransition
}

/**
 * Per-variant behaviour defaults; each prop overrides its own entry.
 * - `margin`: live report modal — backdrop `@click`, `@keydown.escape.window`, Alpine fade/scale.
 * - `sheet`: live `#ios-install-modal` — toggled with `style.display` by its own buttons only,
 *   so no backdrop close, no Esc close and no transition.
 */
export const MODAL_BEHAVIOUR: Record<ModalVariant, ModalBehaviour> = {
  margin: { closeOnBackdrop: true, closeOnEsc: true, transition: 'fade' },
  sheet: { closeOnBackdrop: false, closeOnEsc: false, transition: 'none' },
}

/** Live `x-transition` classes of the report modal (container fade, panel scale). */
export const MODAL_TRANSITION = {
  enterActiveClass: 'transition ease-out duration-200',
  enterFromClass: 'opacity-0',
  enterToClass: 'opacity-100',
  leaveActiveClass: 'transition ease-in duration-150',
  leaveFromClass: 'opacity-100',
  leaveToClass: 'opacity-0',
} as const

export const MODAL_PANEL_TRANSITION = {
  enterActiveClass: 'transition ease-out duration-200',
  enterFromClass: 'opacity-0 scale-95',
  enterToClass: 'opacity-100 scale-100',
} as const
