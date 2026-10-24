<script setup lang="ts">
/**
 * One maths entry line. The student types friendly notation (`1/2`, `x^2`, `√3`, `2×3`) with the
 * keyboard or the on-screen maths keypad, which also inserts friendly tokens; LaTeX source is never
 * shown. The stored value is LaTeX (converted on every change) and a KaTeX preview right under the
 * box shows how the line was understood (stacked fractions, powers, roots).
 *
 * The keypad stays out of the way of the line: it is docked at the bottom edge of the scrolling
 * area (a bottom sheet over the attempt footer below `md`, sticky above the footer from `md`), the
 * field is scrolled into the free area above it, and only one keypad is open. Below `md` the sheet
 * has its own display row (the preview) and a "Tutup" key, and it closes on a tap or focus outside
 * the field and the keypad, so the footer (Seterusnya / Hantar) is never out of reach.
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
  }>(),
  { placeholder: 'cth. 2x + 6', disabled: false, hideLabel: false, removable: false },
)
const emit = defineEmits<{ 'update:modelValue': [string]; remove: [] }>()

const id = useId()
const MD_PX = 768
const MEDIA_FEATURE = 'min-width'
const WIDE_QUERY = `(${MEDIA_FEATURE}: ${MD_PX}px)`
const previewComp = ref<{ $el: HTMLElement } | null>(null)
const wrapComp = ref<{ $el: HTMLElement } | null>(null)
const wrap = computed<HTMLElement | null>(() => wrapComp.value?.$el ?? null)
const dock = ref<HTMLElement | null>(null)
const spacer = ref<HTMLElement | null>(null)
/** From `md` (768 px) the keypad is inline and sticky; below it is a bottom sheet over the footer. */
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
  const fixed = getComputedStyle(sheet).position === 'fixed'
  const free = (fixed ? rect.top : area.bottom - rect.height) - 8
  const f = field.getBoundingClientRect()
  const top = area.top + pinnedTop(sc, f.left + f.width / 2) + 4
  const last = (!wide.value && field) || previewComp.value?.$el || field
  const delta =
    f.top < top
      ? f.top - top
      : Math.max(0, Math.min(last.getBoundingClientRect().bottom - free, f.top - top))
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

function closeKeypad(refocus = false): void {
  openKeypad.value = null
  if (refocus) input()?.focus({ preventScroll: true })
}

/** Esc closes the open keypad from the input line too (the keypad's own Esc handles its keys). */
function onEsc(e: KeyboardEvent): void {
  if (!keypad.value) return
  e.stopPropagation()
  closeKeypad(true)
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
        :inputmode="keypad ? 'none' : 'text'"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        size="xl"
        class="min-w-0 grow"
        data-testid="math-input"
        @update:model-value="onInput"
        @keydown.enter.prevent
      />
      <UButton
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
      ref="previewComp"
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
        class="fixed inset-x-0 bottom-0 z-30 md:sticky"
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
              <!-- Sheet display: the preview of the line next to the close key (the footer is under the sheet). -->
              <DsCluster v-if="!wide" gap="xs" :wrap="false">
                <DsSurface
                  level="raised"
                  padding="none"
                  radius="chip"
                  :clip="false"
                  class="grow overflow-x-auto"
                  data-testid="math-display"
                >
                  <div
                    class="flex min-h-11 items-center px-3"
                    :data-testid="hasContent ? 'math-preview' : undefined"
                  >
                    <template v-if="hasContent">
                      <DsText as="span" variant="body" sr-only>Pratonton: </DsText>
                      <RichText :text="preview" math-only />
                    </template>
                  </div>
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
                  @click="closeKeypad()"
                  >Tutup</UButton
                >
              </DsCluster>
              <MathKeyboard
                label="Papan kekunci matematik"
                @press="onKey"
                @close="closeKeypad(true)"
              />
            </DsStack>
          </div>
        </DsSurface>
      </div>
    </template>
  </DsStack>
</template>
