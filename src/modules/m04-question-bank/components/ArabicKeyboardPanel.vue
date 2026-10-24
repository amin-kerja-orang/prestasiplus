<script setup lang="ts">
/**
 * The Arabic / Jawi key panel of S2 (FR-M04-30..32; FN-M04-1.3.2..1.3.6). Presentational: the owner
 * inserts the text. Keys use `mousedown.prevent` so the textarea keeps focus. Below 640px it is a bottom
 * sheet over a backdrop that closes on tap; from 640px a 580px panel placed by `placePanel()` below the
 * textarea (or above it when there is no room), clamped inside the viewport. Esc closes it.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import {
  BOTTOM_KEYS,
  HARAKAT,
  KEYBOARD_CAPTIONS,
  keyboardRows,
  placePanel,
  type KeyboardMode,
  type PanelPlacement,
} from '../lib/arabic-keyboard'

const props = defineProps<{
  /** The textarea the panel is placed against. */
  anchor: HTMLElement | null
}>()

const emit = defineEmits<{
  insert: [text: string]
  backspace: []
  close: []
}>()

const mode = defineModel<KeyboardMode>('mode', { required: true })

const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
const placement = ref<PanelPlacement>({ above: false, left: 8, width: 580 })
const rect = ref({ top: 0, bottom: 0 })

function measure(): void {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  const box = props.anchor?.getBoundingClientRect()
  if (box) {
    rect.value = { top: box.top, bottom: box.bottom }
    placement.value = placePanel(box, viewport.value)
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
  window.removeEventListener('keydown', onKeydown)
})

const sheet = computed(() => viewport.value.width < 640)

const panelStyle = computed(() => {
  if (sheet.value) return {}
  const p = placement.value
  return {
    left: `${String(p.left)}px`,
    width: `${String(p.width)}px`,
    ...(p.above
      ? { bottom: `${String(viewport.value.height - rect.value.top + 8)}px` }
      : { top: `${String(rect.value.bottom + 8)}px` }),
  }
})

const KEY =
  'inline-flex min-h-11 min-w-10 items-center justify-center rounded-chip bg-elevated px-2 font-jawi text-heading text-highlighted transition select-none hover:bg-accented active:bg-accented'
const MODE_BASE =
  'relative min-h-11 rounded-chip px-3 font-jawi text-base font-bold transition select-none sm:min-h-9'
</script>

<template>
  <Teleport to="body">
    <div
      v-if="sheet"
      class="fixed inset-0 z-40 bg-overlay"
      data-testid="vkb-backdrop"
      @click="emit('close')"
    ></div>
    <div
      class="fixed z-50 max-h-[85vh] overflow-y-auto bg-default shadow-modal"
      :class="sheet ? 'inset-x-0 bottom-0 rounded-t-sheet' : 'rounded-card'"
      :style="panelStyle"
      data-testid="vkb-panel"
    >
      <div
        class="flex items-center justify-between gap-2 bg-elevated px-3 py-2"
      >
        <button
          type="button"
          class="inline-flex size-11 items-center justify-center rounded-chip text-muted transition hover:bg-accented"
          data-testid="vkb-close"
          @mousedown.prevent
          @click="emit('close')"
        >
          <UIcon name="i-ph-x" class="size-4" aria-hidden="true" />
        </button>
        <span class="min-w-0 truncate text-caption text-muted" data-testid="vkb-caption">
          {{ KEYBOARD_CAPTIONS[mode] }}
        </span>
        <div class="flex gap-1.5">
          <button
            type="button"
            :class="[
              MODE_BASE,
              mode === 'jawi' ? 'bg-primary text-primary-on' : 'bg-default text-default',
            ]"
            data-testid="vkb-mode-jawi"
            @mousedown.prevent
            @click="mode = 'jawi'"
          >
            جاوي
          </button>
          <button
            type="button"
            :class="[
              MODE_BASE,
              mode === 'arab' ? 'bg-primary text-primary-on' : 'bg-default text-default',
            ]"
            data-testid="vkb-mode-arab"
            @mousedown.prevent
            @click="mode = 'arab'"
          >
            عربي
          </button>
        </div>
      </div>

      <div class="space-y-1.5 p-2 sm:p-3">
        <div
          v-for="(row, r) in keyboardRows(mode)"
          :key="r"
          class="flex flex-wrap justify-center gap-1.5"
          dir="rtl"
        >
          <button
            v-for="(key, k) in row"
            :key="k"
            type="button"
            :class="KEY"
            data-testid="vkb-key"
            @mousedown.prevent
            @click="emit('insert', key)"
          >
            {{ key }}
          </button>
        </div>

        <div class="flex flex-wrap justify-center gap-1.5 pt-2" dir="rtl">
          <button
            v-for="h in HARAKAT"
            :key="h.title"
            type="button"
            :title="h.title"
            :class="[KEY, 'bg-warning-soft']"
            data-testid="vkb-harakat"
            @mousedown.prevent
            @click="emit('insert', h.mark)"
          >
            ◌{{ h.mark }}
          </button>
        </div>

        <div class="flex flex-wrap justify-center gap-1.5">
          <button
            v-for="b in BOTTOM_KEYS"
            :key="b.label"
            type="button"
            :class="[
              KEY,
              b.label === 'SPACE' ? 'min-w-28 flex-1 !font-sans !text-caption font-semibold' : '',
            ]"
            data-testid="vkb-key"
            @mousedown.prevent
            @click="emit('insert', b.text)"
          >
            {{ b.label }}
          </button>
          <button
            type="button"
            :class="[KEY, 'bg-error-soft text-error']"
            data-testid="vkb-backspace"
            @mousedown.prevent
            @click="emit('backspace')"
          >
            <UIcon name="i-ph-backspace" class="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            :class="[KEY, 'text-muted']"
            data-testid="vkb-newline"
            @mousedown.prevent
            @click="emit('insert', '\n')"
          >
            <UIcon name="i-ph-arrow-elbow-down-left" class="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
