<script setup lang="ts">
/**
 * The Roda Nasib wheel (URS FN-M16-7.1.2): a 380 x 380 `<canvas>` (full width, at most 380 px) with an
 * A1 rim and an elevated inner ring, the 8 segments of discovery A.5 (colour, icon and label from the
 * server, the text running along the radius, the icon next to it), a pointer at 12 o'clock and a round
 * hub that does not turn. As live, segment 0 starts at 3 o'clock and runs clockwise, so the landing
 * rotation is the SRS `360 - (index * 45 + 22.5)` minus 90 degrees (`wheelLandingDeg`), which brings
 * the centre of segment `index` under the pointer.
 *
 * The turn is a requestAnimationFrame tween drawn into the canvas (no inline style needed): an
 * ease-out over `WHEEL_SPIN_MS`. With `prefers-reduced-motion` the wheel jumps straight to the landing
 * angle (the result then shows at the same moment the page reveals it). Shapes and text only (D22).
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useMedia } from '@/ds/useMedia'

import type { SpinPage } from '../../api'
import { WHEEL_SPIN_MS } from '../solo/solo-lib'

const props = defineProps<{ segments: SpinPage['segments']; rotation: number }>()

const SIZE = 380
const canvas = ref<HTMLCanvasElement | null>(null)
const reduced = useMedia('(prefers-reduced-motion: reduce)', false)
const shown = ref(props.rotation)
let frame = 0

/** A theme colour from the CSS custom properties, so the rim follows light and dark mode. */
function themeColour(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v === '' ? fallback : v
}

function draw(angleDeg: number): void {
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
  ctx.save()
  ctx.translate(c, c)
  ctx.rotate((angleDeg * Math.PI) / 180)
  ctx.translate(-c, -c)
  // rim and inner ring
  ctx.beginPath()
  ctx.arc(c, c, c - 2, 0, Math.PI * 2)
  ctx.fillStyle = themeColour('--ds-c1', 'currentColor')
  ctx.fill()
  ctx.beginPath()
  ctx.arc(c, c, c - 14, 0, Math.PI * 2)
  ctx.fillStyle = themeColour('--ui-bg-elevated', 'currentColor')
  ctx.fill()
  const radius = c - 18
  props.segments.forEach((seg, i) => {
    const start = i * arc
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.arc(c, c, radius, start, start + arc)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = themeColour('--ui-bg', 'transparent')
    ctx.stroke()
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(start + arc / 2)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'white'
    ctx.font = 'bold 13px Inter, sans-serif'
    const labelEdge = radius - 14
    ctx.fillText(seg.label, labelEdge, 0)
    const width = ctx.measureText(seg.label).width
    ctx.font = '16px sans-serif'
    ctx.fillText(seg.icon, labelEdge - width - 6, 0)
    ctx.restore()
  })
  ctx.restore()
}

function stop(): void {
  if (frame !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
  frame = 0
}

function turnTo(target: number): void {
  stop()
  const from = shown.value
  if (reduced.value || typeof requestAnimationFrame !== 'function' || from === target) {
    shown.value = target
    draw(target)
    return
  }
  const t0 = performance.now()
  const step = (now: number): void => {
    const t = Math.min(1, (now - t0) / WHEEL_SPIN_MS)
    const eased = 1 - Math.pow(1 - t, 4)
    shown.value = from + (target - from) * eased
    draw(shown.value)
    frame = t < 1 ? requestAnimationFrame(step) : 0
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => draw(shown.value))
onBeforeUnmount(stop)
watch(() => props.segments, () => draw(shown.value), { deep: true })
watch(
  () => props.rotation,
  (to) => turnTo(to),
)
</script>

<template>
  <div class="relative mx-auto w-full max-w-sm" data-testid="wheel">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center text-primary-t"
      data-testid="wheel-pointer"
    >
      <UIcon name="i-ph-caret-down-fill" class="size-10" aria-hidden="true" />
    </div>
    <div class="overflow-hidden rounded-full shadow-card" data-testid="wheel-disc" :data-rotation="rotation">
      <canvas
        ref="canvas"
        :width="SIZE"
        :height="SIZE"
        class="block h-auto w-full rounded-full"
        role="img"
        aria-label="Roda Nasib"
        data-testid="wheel-canvas"
      />
    </div>
    <div
      class="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <UIcon name="i-ph-target-duotone" class="size-8 text-primary-t" aria-hidden="true" />
    </div>
  </div>
</template>
