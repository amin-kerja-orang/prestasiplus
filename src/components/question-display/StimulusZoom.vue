<script setup lang="ts">
/**
 * Full-screen picture viewer (FR-X6-7): pinch zoom, pan, double-tap toggles fit / 2x. Back (browser or device)
 * closes it: a history entry is pushed while it is open and popped on close. Pointer events and a CSS
 * transform only. The alt text is the dialog title and description (announced).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { qdCopy } from './copy'

const props = defineProps<{ src: string; alt: string }>()
const open = defineModel<boolean>('open', { default: false })

const MAX = 5
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const style = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
  touchAction: 'none',
}))

const pointers = new Map<number, { x: number; y: number }>()
let pinchStart = 0
let pinchScale = 1
let lastTap = { t: 0, x: 0, y: 0 }

const dist = (): number => {
  const [a, b] = [...pointers.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}
function reset(): void {
  scale.value = 1
  tx.value = 0
  ty.value = 0
  pointers.clear()
  lastTap = { t: 0, x: 0, y: 0 }
}
function onDown(e: PointerEvent): void {
  pointers.set(e.pointerId ?? 0, { x: e.clientX ?? 0, y: e.clientY ?? 0 })
  if (pointers.size === 2) {
    pinchStart = dist()
    pinchScale = scale.value
  }
}
function onMove(e: PointerEvent): void {
  const id = e.pointerId ?? 0
  const p = pointers.get(id)
  if (!p) return
  const x = e.clientX ?? 0
  const y = e.clientY ?? 0
  if (pointers.size === 2) {
    pointers.set(id, { x, y })
    if (pinchStart > 0) scale.value = Math.min(MAX, Math.max(1, (pinchScale * dist()) / pinchStart))
    if (scale.value === 1) {
      tx.value = 0
      ty.value = 0
    }
    return
  }
  if (scale.value > 1) {
    tx.value += x - p.x
    ty.value += y - p.y
  }
  pointers.set(id, { x, y })
}
function onUp(e: PointerEvent): void {
  const wasSingle = pointers.size === 1
  pointers.delete(e.pointerId ?? 0)
  if (!wasSingle) return
  const now = e.timeStamp || Date.now()
  const x = e.clientX ?? 0
  const y = e.clientY ?? 0
  if (lastTap.t > 0 && now - lastTap.t < 300 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) {
    scale.value = scale.value > 1 ? 1 : 2
    tx.value = 0
    ty.value = 0
    lastTap = { t: 0, x: 0, y: 0 }
  } else {
    lastTap = { t: now, x, y }
  }
}

let pushed = false
function onPop(): void {
  pushed = false
  open.value = false
}
watch(open, (v) => {
  if (v) {
    reset()
    window.history.pushState({ ...(window.history.state as object | null), qdZoom: true }, '')
    pushed = true
    window.addEventListener('popstate', onPop)
  } else {
    window.removeEventListener('popstate', onPop)
    if (pushed) {
      pushed = false
      window.history.back()
    }
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPop)
  if (pushed) {
    pushed = false
    window.history.back()
  }
})
</script>

<template>
  <UModal v-model:open="open" fullscreen :close="false" :title="props.alt" :description="props.alt">
    <template #body>
      <div class="flex h-full flex-col gap-3" data-testid="stimulus-zoom">
        <div class="flex justify-end">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            class="min-h-11 min-w-11 justify-center"
            data-testid="stimulus-zoom-close"
            @click="open = false"
            >{{ qdCopy.close }}</UButton
          >
        </div>
        <div
          class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-muted"
          data-testid="stimulus-zoom-area"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        >
          <img
            :src="props.src"
            :alt="props.alt"
            draggable="false"
            class="max-h-full max-w-full select-none object-contain"
            :style="style"
            :data-scale="scale"
            data-testid="stimulus-zoom-img"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
