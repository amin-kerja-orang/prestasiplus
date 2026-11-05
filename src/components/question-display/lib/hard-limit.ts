import { nextTick, type Ref } from 'vue'

import { capWords, countWords } from '../words'

/**
 * Hard word limit of an essay box (FR-PA-35): typing past the maximum is ignored (the previous text
 * stays), a paste is cut at the maximum. While an IME composes, the text and the DOM are left alone;
 * the rule applies on `compositionend` (cut at the maximum).
 */
export function useHardLimit(o: {
  max: () => number | undefined
  prev: () => string
  root: Ref<HTMLElement | null>
  commit: (text: string) => void
}): {
  onText: (v: string) => void
  onPaste: () => void
  onCompositionStart: () => void
  onCompositionEnd: (e: Event) => void
} {
  let pasting = false
  let composing = false

  function restore(text: string): void {
    void nextTick(() => {
      const el = o.root.value?.querySelector('textarea')
      if (el && el.value !== text) el.value = text
    })
  }

  function onText(v: string): void {
    const max = o.max()
    const paste = pasting
    pasting = false
    if (max === undefined || composing || countWords(v) <= max) return o.commit(v)
    const kept = paste ? capWords(v, max) : o.prev()
    o.commit(kept)
    restore(kept)
  }

  function onCompositionEnd(e: Event): void {
    composing = false
    const max = o.max()
    const v = (e.target as HTMLTextAreaElement).value
    if (max === undefined || countWords(v) <= max) return
    const kept = capWords(v, max)
    o.commit(kept)
    restore(kept)
  }

  return {
    onText,
    onPaste: () => (pasting = true),
    onCompositionStart: () => (composing = true),
    onCompositionEnd,
  }
}
