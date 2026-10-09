<script setup lang="ts">
/**
 * The Roda Nasib wheel (URS FN-M16-7.1.2; live roda-nasib-desktop): a 380 × 380 `<canvas>` (320 px at 375)
 * with a thick violet rim and a white inner ring, the 8 segments of discovery A.5 (colour, icon and label
 * from the server, the text running along the radius, the icon next to it), a violet triangle pointer at
 * 12 o'clock and a round "🎯" hub that does not turn. Segment 0 starts at 12 o'clock and runs clockwise, so a
 * rotation of `360 − (index × 45 + 22.5)` degrees brings segment `index` under the pointer. Shapes and text
 * only: no image (D22). The rotating square is clipped to its circle (DV-M16-42).
 */
import { onMounted, ref, watch } from 'vue'

import type { SpinPage } from '../../api'
import { WHEEL_SPIN_MS } from '../solo/solo-lib'

const props = defineProps<{ segments: SpinPage['segments']; rotation: number }>()

const SIZE = 380
const RIM = '#7c3aed'
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
  const arc = (Math.PI * 2) / props.segments.length
  ctx.clearRect(0, 0, SIZE, SIZE)
  // rim and inner white ring
  ctx.beginPath()
  ctx.arc(c, c, c - 2, 0, Math.PI * 2)
  ctx.fillStyle = RIM
  ctx.fill()
  ctx.beginPath()
  ctx.arc(c, c, c - 14, 0, Math.PI * 2)
  ctx.fillStyle = '#e5e7eb'
  ctx.fill()
  const radius = c - 18
  props.segments.forEach((seg, i) => {
    const start = -Math.PI / 2 + i * arc
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.arc(c, c, radius, start, start + arc)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.stroke()
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(start + arc / 2)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px Inter, sans-serif'
    const labelEdge = radius - 14
    ctx.fillText(seg.label, labelEdge, 0)
    const width = ctx.measureText(seg.label).width
    ctx.font = '16px sans-serif'
    ctx.fillText(seg.icon, labelEdge - width - 6, 0)
    ctx.restore()
  })
}

onMounted(draw)
watch(() => props.segments, draw, { deep: true })
</script>

<template>
  <div class="relative mx-auto w-[320px] max-w-full sm:w-[380px]" data-testid="wheel">
    <div
      class="absolute top-0 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[24px] border-x-transparent border-t-violet-600 drop-shadow-md"
      data-testid="wheel-pointer"
    />
    <!-- The clip keeps the rotating square's box from widening the page while the wheel turns. -->
    <div class="overflow-hidden rounded-full shadow-[0_0_30px_rgba(124,58,237,0.35)]">
      <div
        class="rounded-full"
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
    <div
      class="absolute top-1/2 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-800 text-xl shadow-lg ring-4 ring-white/70"
    >
      🎯
    </div>
  </div>
</template>
