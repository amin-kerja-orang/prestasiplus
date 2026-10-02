import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M04 public entry (F-01 stub, ADR-0009). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M04',
  slug: 'm04-question-bank',
  routes,
}

// M04-T6a (XL-09): the S14 report modal for the M05 / M06 practice hosts.
export { default as ReportQuestionModal } from './components/report/ReportQuestionModal.vue'
export type { ReportTint, ReportVariant } from './lib/report-reasons'
export type { ReportSource } from './api/reports'

// D12 (M10 S22/S24 "Sumbang Soalan"): the S2 Arabic / Jawi virtual keyboard panel and its data and
// caret helpers. Props: `anchor` (the textarea the panel is placed against), `v-model:mode`
// (`KeyboardMode`). Emits: `insert(text)`, `backspace()`, `close()`; the host applies the edit with
// `insertAtCaret` / `backspaceAtCaret`.
export { default as ArabicKeyboardPanel } from './components/ArabicKeyboardPanel.vue'
export {
  ARAB_ROWS,
  BOTTOM_KEYS,
  HARAKAT,
  JAWI_ROWS,
  KEYBOARD_CAPTIONS,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  backspaceAtCaret,
  insertAtCaret,
  keyboardRows,
  placePanel,
} from './lib/arabic-keyboard'
export type { CaretEdit, KeyboardMode, PanelPlacement } from './lib/arabic-keyboard'
