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

  /** Puts the box back to `text` and keeps the caret where the ignored edit started. */
  function restore(text: string, typed: string): void {
    const el0 = o.root.value?.querySelector('textarea')
    const caret = el0
      ? Math.max(0, (el0.selectionStart ?? typed.length) - (typed.length - text.length))
      : text.length
    void nextTick(() => {
      const el = o.root.value?.querySelector('textarea')
      if (!el) return
      if (el.value !== text) el.value = text
      const at = Math.min(caret, text.length)
      el.setSelectionRange?.(at, at)
    })
  }

  function onText(v: string): void {
    const max = o.max()
    const paste = pasting
    pasting = false
    // An edit that does not add words is always kept, so stored text already over the cap can still be shortened.
    if (
      max === undefined ||
      composing ||
      countWords(v) <= max ||
      (!paste && countWords(v) <= countWords(o.prev()))
    ) {
      return o.commit(v)
    }
    const kept = paste ? capWords(v, max) : o.prev()
    o.commit(kept)
    restore(kept, v)
  }

  function onCompositionEnd(e: Event): void {
    composing = false
    const max = o.max()
    const v = (e.target as HTMLTextAreaElement).value
    if (max === undefined || countWords(v) <= max) return
    const kept = capWords(v, max)
    o.commit(kept)
    restore(kept, v)
  }

  return {
    onText,
    onPaste: () => (pasting = true),
    onCompositionStart: () => (composing = true),
    onCompositionEnd,
  }
}
