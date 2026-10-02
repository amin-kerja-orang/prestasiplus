<script setup lang="ts">
/**
 * The Arabic / Jawi key panel of S2 (FR-M04-30..32; FN-M04-1.3.2..1.3.6). Presentational: the owner
 * inserts the text. Keys use `mousedown.prevent` so the textarea keeps focus. Below 640px it is a bottom
 * sheet over a backdrop that closes on tap; from 640px a 580px panel placed by `placePanel()` below the
 * textarea (or above it when there is no room), clamped inside the viewport. Esc closes it.
 */
import { CornerDownLeft, Delete, X } from '@lucide/vue'
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
  'inline-flex min-h-11 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 font-arabic text-xl text-slate-800 shadow-sm transition select-none hover:bg-slate-50 active:bg-slate-100'
const MODE_BASE =
  'relative min-h-11 rounded-lg border px-3 font-arabic text-base font-bold transition select-none after:absolute after:inset-x-0 after:-inset-y-1 sm:min-h-9'
</script>

<template>
  <Teleport to="body">
    <div
      v-if="sheet"
      class="fixed inset-0 z-40 bg-slate-900/40"
      data-testid="vkb-backdrop"
      @click="emit('close')"
    ></div>
    <div
      class="fixed z-50 max-h-[85vh] overflow-y-auto border border-slate-200 bg-white shadow-2xl"
      :class="sheet ? 'inset-x-0 bottom-0 rounded-t-2xl' : 'rounded-xl'"
      :style="panelStyle"
      data-testid="vkb-panel"
    >
      <div
        class="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"
      >
        <button
          type="button"
          class="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition after:absolute after:-inset-1.5 hover:bg-slate-200"
          data-testid="vkb-close"
          @mousedown.prevent
          @click="emit('close')"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
        <span class="min-w-0 truncate text-xs font-medium text-slate-500" data-testid="vkb-caption">
          {{ KEYBOARD_CAPTIONS[mode] }}
        </span>
        <div class="flex gap-1.5">
          <button
            type="button"
            :class="[
              MODE_BASE,
              mode === 'jawi'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-700',
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
              mode === 'arab'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-700',
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

        <div class="flex flex-wrap justify-center gap-1.5 border-t border-slate-100 pt-2" dir="rtl">
          <button
            v-for="h in HARAKAT"
            :key="h.title"
            type="button"
            :title="h.title"
            :class="[KEY, 'border-amber-300 bg-amber-50']"
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
              b.label === 'SPACE' ? 'min-w-28 flex-1 !font-sans !text-xs font-semibold' : '',
            ]"
            data-testid="vkb-key"
            @mousedown.prevent
            @click="emit('insert', b.text)"
          >
            {{ b.label }}
          </button>
          <button
            type="button"
            :class="[KEY, 'border-red-200 bg-red-50 text-red-600']"
            data-testid="vkb-backspace"
            @mousedown.prevent
            @click="emit('backspace')"
          >
            <Delete class="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            :class="[KEY, 'bg-slate-100 text-slate-600']"
            data-testid="vkb-newline"
            @mousedown.prevent
            @click="emit('insert', '\n')"
          >
            <CornerDownLeft class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
