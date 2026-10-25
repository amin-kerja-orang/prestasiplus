<script setup lang="ts">
/**
 * One maths entry line. The student types friendly notation (`1/2`, `x^2`, `√3`, `2×3`) with the
 * keyboard or the on-screen maths keypad, which also inserts friendly tokens; LaTeX source is never
 * shown. The stored value is LaTeX (converted on every change) and a KaTeX preview right under the
 * box shows how the line was understood (stacked fractions, powers, roots).
 *
 * The keypad never covers the line being edited: from `md` it is a normal block right under the
 * line and its preview (the page scrolls past it, nothing can sit under the footer); below `md` it
 * is a bottom sheet over the attempt footer, and the field is scrolled into the free area above
 * it. Only one keypad is open. The sheet has its own display row (the preview) and a "Tutup" key,
 * and it closes on a tap or focus outside the field and the keypad, so the footer (Seterusnya /
 * Hantar) is never out of reach.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import { useClickOutside } from '@/composables/useClickOutside'
import { DsCluster, DsStack, DsSurface, DsText } from '@/ds'

import { latexToFriendly, plainToLatex, previewLatex } from '../domain/math-expr'
import { openKeypad } from '../lib/keypad-owner'
import { applyKey, type KeyPress } from '../lib/math-keys'
import MathKeyboard from './MathKeyboard.vue'
import RichText from './RichText.vue'

const props = withDefaults(
  defineProps<{
    /** Stored value (LaTeX). */
    modelValue: string
    label: string
    placeholder?: string
    disabled?: boolean
    /** Hide the visible label (the aria-label stays). */
    hideLabel?: boolean
    /** Allow removing this line (step lines). */
    removable?: boolean
    /** Soft keyboard hint while the on-screen keypad is closed (it is `none` while it is open). */
    inputmode?: 'text' | 'decimal'
  }>(),
  {
    placeholder: 'cth. 2x + 6',
    disabled: false,
    hideLabel: false,
    removable: false,
    inputmode: 'text',
  },
)
const emit = defineEmits<{ 'update:modelValue': [string]; remove: [] }>()

const id = useId()
const MD_REM = 48
const MEDIA_FEATURE = 'min-width'
const WIDE_QUERY = `(${MEDIA_FEATURE}: ${MD_REM}rem)`
const wrapComp = ref<{ $el: HTMLElement } | null>(null)
const wrap = computed<HTMLElement | null>(() => wrapComp.value?.$el ?? null)
const toggleBtn = ref<{ $el: HTMLElement } | null>(null)
const dock = ref<HTMLElement | null>(null)
const spacer = ref<HTMLElement | null>(null)
/** From `md` (768 px) the keypad is an in-flow block under the line; below it is a bottom sheet over the footer. */
const wide = ref(true)
let wideQuery: MediaQueryList | null = null
const onWide = (e: MediaQueryListEvent): void => {
  wide.value = e.matches
}
onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  wideQuery = window.matchMedia(WIDE_QUERY)
  wide.value = wideQuery.matches
  wideQuery.addEventListener('change', onWide)
})
const keypad = computed(() => openKeypad.value === id)
/** What the student sees and edits (friendly notation); the LaTeX is derived from it. */
const text = ref(latexToFriendly(props.modelValue))

// A value that did not come from this box (reload, restore) replaces the text.
watch(
  () => props.modelValue,
  (m) => {
    if (m !== plainToLatex(text.value)) text.value = latexToFriendly(m)
  },
)

function input(): HTMLInputElement | null {
  return wrap.value?.querySelector('input') ?? null
}

/** The preview shows once there is something to show (an empty `()/()` template is not content). */
const hasContent = computed(() => text.value.replace(/[()/\s^√]/g, '').length > 0)
const preview = computed(() => previewLatex(text.value))

function setText(v: string): void {
  text.value = v
  emit('update:modelValue', plainToLatex(v))
}

function onInput(v: string | number | undefined): void {
  setText(String(v ?? ''))
}

async function onKey(k: KeyPress): Promise<void> {
  const el = input()
  if (!el) return
  const v = text.value
  const a = el.selectionStart ?? v.length
  const b = el.selectionEnd ?? a
  const r = applyKey(v, a, b, k)
  if (r.text !== v) setText(r.text)
  await nextTick()
  const again = input()
  again?.focus({ preventScroll: true })
  again?.setSelectionRange(r.caret, r.caret)
}

/** The nearest ancestor that scrolls vertically (the attempt's scroll area). */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll') return p
  }
  return null
}

/** Height of whatever sticks to the top of the scrolling area at `x` (e.g. the stimulus chip). */
function pinnedTop(sc: HTMLElement, x: number): number {
  const area = sc.getBoundingClientRect()
  for (
    let el = document.elementFromPoint(x, area.top + 1);
    el && el !== sc;
    el = el.parentElement
  ) {
    if (getComputedStyle(el).position === 'sticky')
      return el.getBoundingClientRect().bottom - area.top
  }
  return 0
}

/**
 * Scrolls so the input line, and its preview when there is room, sit in the free area above the
 * docked keypad and below anything pinned to the top (the keypad covers the bottom of the
 * scrolling area, so the line would otherwise be hidden under it). The line has priority over its
 * preview.
 */
async function revealField(): Promise<void> {
  await nextTick()
  const box = wrap.value
  const field = input()
  const sc = scrollParent(box)
  const sheet = dock.value
  if (!box || !field || !sc || !sheet) return
  const area = sc.getBoundingClientRect()
  const rect = sheet.getBoundingClientRect()
  const f = field.getBoundingClientRect()
  const top = area.top + pinnedTop(sc, f.left + f.width / 2) + 4
  const boxTop = box.getBoundingClientRect().top
  if (wide.value) {
    // In-flow keypad: the whole field (label first) under the strip, then as much of the keypad as
    // fits, but never at the cost of the line itself.
    let move = boxTop < top ? boxTop - top : 0
    const cut = rect.bottom - move - area.bottom
    if (cut > 0) move += Math.min(cut, Math.max(0, f.top - move - top))
    if (move !== 0) sc.scrollTop += move
    return
  }
  const free = rect.top - 8
  const last = field.getBoundingClientRect()
  let delta: number
  if (boxTop >= top && last.bottom <= free)
    delta = 0 // already in the free area
  else if (last.bottom - (boxTop - top) <= free)
    delta = boxTop - top // whole field, label first
  else delta = f.top - top // too little room: the line first, its label under the strip
  if (delta !== 0) sc.scrollTop += delta
}

function toggleKeypad(): void {
  if (keypad.value) {
    openKeypad.value = null
    return
  }
  openKeypad.value = id
  void nextTick(() => input()?.focus({ preventScroll: true }))
  void revealField()
}

function closeKeypad(focus?: 'input' | 'toggle'): void {
  openKeypad.value = null
  const el =
    focus === 'toggle' ? (toggleBtn.value?.$el ?? null) : focus === 'input' ? input() : null
  el?.focus({ preventScroll: true })
}

/** Esc closes the open keypad from the input line too (the keypad's own Esc handles its keys). */
function onEsc(e: KeyboardEvent): void {
  if (!keypad.value) return
  e.stopPropagation()
  closeKeypad('input')
}

// A tap or focus outside the field and its keypad closes it (keys are inside, so they never do).
function closeIfOutside(): void {
  if (openKeypad.value === id) openKeypad.value = null
}
useClickOutside(() => wrap.value, closeIfOutside, { enabled: keypad })
function onFocusIn(e: FocusEvent): void {
  if (keypad.value && e.target instanceof Node && !wrap.value?.contains(e.target)) closeIfOutside()
}
onMounted(() => document.addEventListener('focusin', onFocusIn))

/** The spacer under the field follows the real height of the sheet. */
let resize: ResizeObserver | null = null
function followDock(): void {
  resize?.disconnect()
  resize = null
  const sheet = dock.value
  if (!sheet || typeof ResizeObserver === 'undefined') return
  resize = new ResizeObserver(() => {
    if (spacer.value) spacer.value.style.height = `${sheet.offsetHeight}px`
  })
  resize.observe(sheet)
  if (spacer.value) spacer.value.style.height = `${sheet.offsetHeight}px`
}
watch(dock, () => followDock(), { flush: 'post' })

// The preview appears under the line once the first characters are typed.
watch(hasContent, (shown) => {
  if (shown && keypad.value) void revealField()
})

onBeforeUnmount(() => {
  if (openKeypad.value === id) openKeypad.value = null
  resize?.disconnect()
  wideQuery?.removeEventListener('change', onWide)
  document.removeEventListener('focusin', onFocusIn)
})
</script>

<template>
  <DsStack ref="wrapComp" gap="xs" data-testid="math-field" @keydown.esc="onEsc">
    <DsText v-if="!hideLabel" as="label" variant="label" tone="toned" :for="id">{{ label }}</DsText>
    <DsCluster gap="xs" :wrap="false">
      <UInput
        :id="id"
        :model-value="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="hideLabel ? label : undefined"
        :inputmode="keypad ? 'none' : inputmode"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        size="lg"
        class="min-w-0 grow"
        data-testid="math-input"
        @update:model-value="onInput"
        @keydown.enter.prevent
      />
      <UButton
        ref="toggleBtn"
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-keyboard"
        class="size-11 shrink-0 justify-center"
        :aria-label="keypad ? 'Tutup papan kekunci matematik' : 'Buka papan kekunci matematik'"
        :aria-pressed="keypad"
        :disabled="disabled"
        data-testid="math-keypad-toggle"
        @click="toggleKeypad"
      />
      <UButton
        v-if="removable"
        type="button"
        color="neutral"
        variant="ghost"
        icon="i-ph-x"
        class="size-11 shrink-0 justify-center"
        :aria-label="`Buang ${label}`"
        :disabled="disabled"
        @click="emit('remove')"
      />
    </DsCluster>
    <DsSurface
      v-if="hasContent && (wide || !keypad)"
      level="soft"
      padding="sm"
      radius="chip"
      data-testid="math-preview"
    >
      <DsText as="span" variant="body" sr-only>Pratonton: </DsText>
      <RichText :text="preview" math-only />
    </DsSurface>
    <template v-if="keypad">
      <!-- Below md the keypad is a fixed bottom sheet; this spacer keeps the page scrollable past it. -->
      <div
        v-if="!wide"
        ref="spacer"
        class="h-96"
        aria-hidden="true"
        data-testid="math-keyboard-spacer"
      />
      <div
        ref="dock"
        class="fixed inset-x-0 bottom-0 z-30 max-h-dvh overflow-y-auto md:static"
        data-testid="math-keyboard-dock"
      >
        <DsSurface
          level="accented"
          padding="none"
          :radius="wide ? 'card' : 'none'"
          shadow="none"
          class="mx-auto w-full max-w-md"
        >
          <div class="p-1.5">
            <DsStack gap="2xs">
              <!-- Sheet display: the preview of the line next to the close key (the footer is under the sheet).
                   It stays on top when a short (landscape) screen scrolls the sheet. -->
              <div v-if="!wide" class="sticky top-0 z-10 bg-accented">
                <DsCluster gap="xs" :wrap="false">
                  <DsSurface
                    level="raised"
                    padding="sm"
                    radius="chip"
                    :clip="false"
                    class="min-h-11 grow overflow-x-auto"
                    data-testid="math-display"
                  >
                    <template v-if="hasContent">
                      <DsText as="span" variant="body" sr-only>Pratonton: </DsText>
                      <RichText :text="preview" math-only data-testid="math-preview" />
                    </template>
                  </DsSurface>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="subtle"
                    icon="i-ph-caret-down"
                    class="min-h-11 shrink-0 learner:min-h-11"
                    aria-label="Tutup papan kekunci"
                    data-testid="math-keyboard-close"
                    @mousedown.prevent
                    @click="closeKeypad('toggle')"
                    >Tutup</UButton
                  >
                </DsCluster>
              </div>
              <MathKeyboard
                label="Papan kekunci matematik"
                @press="onKey"
                @close="closeKeypad('input')"
              />
            </DsStack>
          </div>
        </DsSurface>
      </div>
    </template>
  </DsStack>
</template>
