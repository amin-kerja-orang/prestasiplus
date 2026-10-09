<script setup lang="ts">
/**
 * The Roda Nasib wheel (URS FN-M16-7.1.2): a 380 × 380 `<canvas>` (320 px at 375) with the 8 segments
 * of discovery A.5 (colour, icon and label from the server) and the pointer "🎯" at 12 o'clock.
 * Segment 0 starts at 12 o'clock and runs clockwise, so a rotation of `360 − (index × 45 + 22.5)` degrees
 * brings segment `index` under the pointer. Shapes and text only: no image (D22).
 */
import { onMounted, ref, watch } from 'vue'

import type { SpinPage } from '../../api'
import { WHEEL_SPIN_MS } from '../solo/solo-lib'

const props = defineProps<{ segments: SpinPage['segments']; rotation: number }>()

const SIZE = 380
const canvas = ref<HTMLCanvasElement | null>(null)

function draw(): void {
  const el = canvas.value
  if (!el || props.segments.length === 0) return
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = el.getContext('2d')
  } catch {
    ctx = null
  }
  if (!ctx) return
  const c = SIZE / 2
  const radius = c - 6
  const arc = (Math.PI * 2) / props.segments.length
  ctx.clearRect(0, 0, SIZE, SIZE)
  props.segments.forEach((seg, i) => {
    const start = -Math.PI / 2 + i * arc
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.arc(c, c, radius, start, start + arc)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(start + arc / 2)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.font = '22px sans-serif'
    ctx.fillText(seg.icon, radius - 12, 0)
    ctx.font = 'bold 14px Inter, sans-serif'
    ctx.fillText(seg.label, radius - 46, 0)
    ctx.restore()
  })
  ctx.beginPath()
  ctx.arc(c, c, 22, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
}

onMounted(draw)
watch(() => props.segments, draw, { deep: true })
</script>

<template>
  <div class="relative mx-auto w-[320px] max-w-full sm:w-[380px]" data-testid="wheel">
    <div
      class="absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-3xl leading-none"
      data-testid="wheel-pointer"
    >
      🎯
    </div>
    <div
      class="rounded-full shadow-xl"
      :style="{
        transform: `rotate(${String(rotation)}deg)`,
        transition: `transform ${String(WHEEL_SPIN_MS)}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`,
      }"
      data-testid="wheel-disc"
      :data-rotation="rotation"
    >
      <canvas
        ref="canvas"
        :width="SIZE"
        :height="SIZE"
        class="block h-auto w-full rounded-full"
        data-testid="wheel-canvas"
      />
    </div>
  </div>
</template>
