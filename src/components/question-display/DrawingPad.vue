<script setup lang="ts">
/**
 * `drawing` answer pad (S8-T03, FR-PA-08): the template (image or generated graph paper) under a
 * transparent pointer-drawn layer. Tools Pen / Garis / Pemadam, Buat Asal, Kosongkan. Strokes are a
 * vector history; "Simpan lukisan" exports one merged PNG `lukisan.png` (<= 5 MB) and emits `save`;
 * the parent stores it through the photo path. `change` tells the parent whether the pad is empty.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { DsStack, DsText } from '@/ds'
import {
  PAD_AUTOSAVE_MS,
  PAD_HEIGHT,
  PAD_WIDTH,
  addStroke,
  clearStrokes,
  drawStroke,
  exportPng,
  gridGeometry,
  isGridTemplate,
  lineStroke,
  pngToFile,
  redraw,
  toLogical,
  undoStroke,
  type PadTemplate,
  type PadTool,
  type Point,
  type Stroke,
} from './lib/drawing'

const props = withDefaults(
  defineProps<{
    template?: PadTemplate
    disabled?: boolean
    width?: number
    height?: number
    /** Receives the pending drawing when the pad unmounts (an emit is lost after unmount). */
    onFlush?: (file: File) => void
  }>(),
  {
    template: undefined,
    disabled: false,
    width: PAD_WIDTH,
    height: PAD_HEIGHT,
    onFlush: undefined,
  },
)
const emit = defineEmits<{ save: [File]; change: [{ empty: boolean }] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const strokes = ref<Stroke[]>([])
const tool = ref<PadTool>('pen')
const error = ref('')
const saving = ref(false)
let current: Stroke | null = null
let activeId: number | null = null
let timer: ReturnType<typeof setTimeout> | null = null

const empty = computed(() => strokes.value.length === 0)
const grid = computed(() => (isGridTemplate(props.template) ? props.template.grid : null))
const geo = computed(() =>
  grid.value ? gridGeometry(grid.value, props.width, props.height) : null,
)
const imageUrl = computed(() =>
  props.template && !isGridTemplate(props.template) ? props.template.imageUrl : '',
)

const tools: { id: PadTool; label: string; icon: string }[] = [
  { id: 'pen', label: 'Pen', icon: 'i-ph-pencil-simple' },
  { id: 'line', label: 'Garis', icon: 'i-ph-line-segment' },
  { id: 'eraser', label: 'Pemadam', icon: 'i-ph-eraser' },
]

function ctx2d(): CanvasRenderingContext2D | null {
  return canvas.value?.getContext('2d') ?? null
}
function repaint(extra?: Stroke): void {
  const c = ctx2d()
  if (!c) return
  redraw(c, strokes.value, props.width, props.height)
  if (extra) drawStroke(c, extra)
}
function point(ev: PointerEvent): Point {
  const el = canvas.value!
  return toLogical(ev.clientX, ev.clientY, el.getBoundingClientRect(), props.width, props.height)
}

function onDown(ev: PointerEvent): void {
  if (props.disabled || current || ev.button !== 0) return
  const p = point(ev)
  current = { tool: tool.value, points: [p] }
  activeId = ev.pointerId
  canvas.value?.setPointerCapture?.(ev.pointerId)
  repaint(current)
}
function onMove(ev: PointerEvent): void {
  if (!current || ev.pointerId !== activeId) return
  const p = point(ev)
  current =
    current.tool === 'line'
      ? lineStroke(current.points[0]!, p)
      : { ...current, points: [...current.points, p] }
  repaint(current)
}
function onUp(ev: PointerEvent): void {
  if (!current || ev.pointerId !== activeId) return
  const p = point(ev)
  const done = current.tool === 'line' ? lineStroke(current.points[0]!, p) : current
  current = null
  activeId = null
  setStrokes(addStroke(strokes.value, done))
}
function onCancel(): void {
  current = null
  activeId = null
  repaint()
}

function setStrokes(next: Stroke[]): void {
  strokes.value = next
  error.value = ''
  repaint()
  emit('change', { empty: next.length === 0 })
  if (timer) clearTimeout(timer)
  timer = null
  if (next.length) timer = setTimeout(() => void save(), PAD_AUTOSAVE_MS)
}
const undo = (): void => setStrokes(undoStroke(strokes.value))
const clear = (): void => setStrokes(clearStrokes())

/** Immediate save (button) and the debounced auto-save share this; `onDone` overrides the emit (unmount). */
async function save(onDone?: (f: File) => void): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  const el = canvas.value
  if (!el || empty.value || props.disabled) return
  saving.value = true
  error.value = ''
  try {
    const res = pngToFile(await exportPng(el, props.template, props.width, props.height))
    if (!res.ok) error.value = res.message
    else if (onDone) onDone(res.file)
    else emit('save', res.file)
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (timer && props.onFlush) void save(props.onFlush)
  else if (timer) clearTimeout(timer)
})

onMounted(() => repaint())
watch(
  () => [props.width, props.height],
  () => repaint(),
)
</script>

<template>
  <DsStack gap="sm" data-testid="drawing-pad">
    <div role="group" aria-label="Papan Lukisan" class="flex flex-wrap items-center gap-2">
      <DsText variant="label" as="span" class="me-2">Papan Lukisan</DsText>
      <UButton
        v-for="t in tools"
        :key="t.id"
        type="button"
        color="neutral"
        :variant="tool === t.id ? 'solid' : 'soft'"
        :icon="t.icon"
        :aria-pressed="tool === t.id"
        :disabled="disabled"
        class="min-h-11"
        :data-testid="`pad-tool-${t.id}`"
        @click="tool = t.id"
        >{{ t.label }}</UButton
      >
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-arrow-counter-clockwise"
        :disabled="disabled || empty"
        class="min-h-11"
        data-testid="pad-undo"
        @click="undo"
        >Buat Asal</UButton
      >
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-trash"
        :disabled="disabled || empty"
        class="min-h-11"
        data-testid="pad-clear"
        @click="clear"
        >Kosongkan</UButton
      >
    </div>

    <div
      class="relative w-full overflow-hidden rounded-xl bg-default ring-1 ring-default ring-inset"
      :style="{ aspectRatio: `${width} / ${height}` }"
    >
      <svg
        v-if="grid && geo"
        :viewBox="`0 0 ${width} ${height}`"
        class="absolute inset-0 size-full"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-testid="pad-template-grid"
      >
        <line
          v-for="(l, i) in [...geo.vertical, ...geo.horizontal]"
          :key="i"
          :x1="l.x1"
          :y1="l.y1"
          :x2="l.x2"
          :y2="l.y2"
          :stroke="l.axis ? '#374151' : '#cbd5e1'"
          :stroke-width="l.axis ? 2 : 1"
          class="pad-grid-line"
        />
      </svg>
      <img
        v-else-if="imageUrl"
        :src="imageUrl"
        alt="Templat lukisan"
        class="absolute inset-0 size-full object-fill"
        data-testid="pad-template-image"
      />
      <canvas
        ref="canvas"
        :width="width"
        :height="height"
        class="absolute inset-0 size-full"
        style="touch-action: none"
        :class="disabled ? 'cursor-not-allowed' : 'cursor-crosshair'"
        role="img"
        aria-label="Papan Lukisan"
        data-testid="pad-canvas"
        @pointerdown.prevent="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
      />
    </div>

    <DsText v-if="grid" variant="caption" tone="muted" data-testid="pad-scale">{{
      grid.scale
    }}</DsText>

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        type="button"
        color="primary"
        icon="i-ph-floppy-disk"
        :disabled="disabled || empty || saving"
        class="min-h-11"
        data-testid="pad-save"
        @click="save()"
        >Simpan lukisan</UButton
      >
    </div>
    <p v-if="error" class="text-caption text-error" role="alert" data-testid="pad-error">
      {{ error }}
    </p>
  </DsStack>
</template>
