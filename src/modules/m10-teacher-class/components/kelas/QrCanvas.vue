<script setup lang="ts">
/** The 192x192 join-code QR (FR-M10-30): dark `#1e293b`, light `#ffffff`, level M. */
import { onMounted, ref, watch } from 'vue'

import { encodeQr } from './qr-code'

const props = defineProps<{ text: string }>()
const SIZE = 192
const QUIET = 4
const canvas = ref<HTMLCanvasElement | null>(null)

function draw(): void {
  const el = canvas.value
  if (!el) return
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = el.getContext('2d')
  } catch {
    ctx = null
  }
  if (!ctx) return
  const matrix = encodeQr(props.text)
  const cells = matrix.length + QUIET * 2
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#1e293b'
  const step = SIZE / cells
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) {
        ctx.fillRect(
          Math.floor((x + QUIET) * step),
          Math.floor((y + QUIET) * step),
          Math.ceil(step),
          Math.ceil(step),
        )
      }
    }),
  )
}

onMounted(draw)
watch(() => props.text, draw)
</script>

<template>
  <canvas
    ref="canvas"
    :width="SIZE"
    :height="SIZE"
    class="h-48 w-48 rounded-lg"
    data-testid="qr-canvas"
  />
</template>
