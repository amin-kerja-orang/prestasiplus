/**
 * Pure helpers of the `DrawingPad` (S8-T03): graph-paper geometry, vector stroke history,
 * canvas drawing and the single merged PNG export. No Vue, so it is testable in jsdom.
 */
import { MAX_PHOTO_BYTES, MSG_PHOTO_TYPE } from './photo-store'

export type PadTool = 'pen' | 'line' | 'eraser'
export interface Point {
  x: number
  y: number
}
export interface Stroke {
  tool: PadTool
  points: Point[]
}
export interface GridSpec {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  step: number
  scale: string
}
export type PadTemplate = { imageUrl: string } | { grid: GridSpec }

export const PAD_WIDTH = 800
export const PAD_HEIGHT = 600
export const PEN_COLOUR = '#1f2937'
export const PEN_WIDTH = 3
export const ERASER_WIDTH = 18
export const MAX_GRID_LINES = 200
export const PNG_FILE_NAME = 'lukisan.png'

export interface GridLine {
  x1: number
  y1: number
  x2: number
  y2: number
  axis: boolean
}
export interface GridGeometry {
  vertical: GridLine[]
  horizontal: GridLine[]
}

function ticks(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max > min)) return []
  const n = Math.min(Math.floor((max - min) / step + 1e-9), MAX_GRID_LINES)
  const out: number[] = []
  for (let k = 0; k <= n; k++) out.push(min + k * step)
  return out
}

/** Grid lines (vertical and horizontal) every `step` from min..max, in logical pixels. Axes are x=0 / y=0. */
export function gridGeometry(g: GridSpec, width: number, height: number): GridGeometry {
  const sx = width / (g.xMax - g.xMin)
  const sy = height / (g.yMax - g.yMin)
  const px = (x: number): number => (x - g.xMin) * sx
  const py = (y: number): number => height - (y - g.yMin) * sy
  const vertical = ticks(g.xMin, g.xMax, g.step).map((x) => ({
    x1: px(x),
    y1: 0,
    x2: px(x),
    y2: height,
    axis: Math.abs(x) < 1e-9,
  }))
  const horizontal = ticks(g.yMin, g.yMax, g.step).map((y) => ({
    x1: 0,
    y1: py(y),
    x2: width,
    y2: py(y),
    axis: Math.abs(y) < 1e-9,
  }))
  return { vertical, horizontal }
}

export function isGridTemplate(t: PadTemplate | undefined): t is { grid: GridSpec } {
  return !!t && 'grid' in t
}

/** Vector history: every function returns a new array so undo/clear are exact. */
export const addStroke = (h: readonly Stroke[], s: Stroke): Stroke[] => [...h, s]
export const undoStroke = (h: readonly Stroke[]): Stroke[] => h.slice(0, -1)
export const clearStrokes = (): Stroke[] => []

/** Map a pointer position (client px) to logical canvas coordinates, clamped to the canvas. */
export function toLogical(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
): Point {
  const w = rect.width || width
  const h = rect.height || height
  const x = ((clientX - rect.left) / w) * width
  const y = ((clientY - rect.top) / h) * height
  return { x: Math.min(width, Math.max(0, x)), y: Math.min(height, Math.max(0, y)) }
}

/** A line stroke only keeps its first and last point. */
export function lineStroke(a: Point, b: Point): Stroke {
  return { tool: 'line', points: [a, b] }
}

type Ctx = CanvasRenderingContext2D

export function drawStroke(ctx: Ctx, s: Stroke): void {
  if (!s.points.length) return
  ctx.save()
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = PEN_COLOUR
  ctx.fillStyle = PEN_COLOUR
  ctx.lineWidth = s.tool === 'eraser' ? ERASER_WIDTH : PEN_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  const [first, ...rest] = s.points
  ctx.moveTo(first!.x, first!.y)
  if (!rest.length) ctx.lineTo(first!.x + 0.01, first!.y)
  for (const p of rest) ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ctx.restore()
}

/** Clear and redraw the whole layer from the history. */
export function redraw(ctx: Ctx, strokes: readonly Stroke[], width: number, height: number): void {
  ctx.clearRect(0, 0, width, height)
  for (const s of strokes) drawStroke(ctx, s)
}

export function drawGrid(ctx: Ctx, g: GridSpec, width: number, height: number): void {
  const geo = gridGeometry(g, width, height)
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  for (const l of [...geo.vertical, ...geo.horizontal]) {
    ctx.strokeStyle = l.axis ? '#374151' : '#cbd5e1'
    ctx.lineWidth = l.axis ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(l.x1, l.y1)
    ctx.lineTo(l.x2, l.y2)
    ctx.stroke()
  }
  ctx.restore()
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

/** Merge the template and the strokes layer into one PNG blob (null when the browser cannot). */
export async function exportPng(
  layer: HTMLCanvasElement,
  template: PadTemplate | undefined,
  width: number,
  height: number,
): Promise<Blob | null> {
  const out = document.createElement('canvas')
  out.width = layer.width || width
  out.height = layer.height || height
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  if (template) {
    if (isGridTemplate(template)) {
      ctx.save()
      ctx.scale(out.width / width, out.height / height)
      drawGrid(ctx, template.grid, width, height)
      ctx.restore()
    } else {
      try {
        ctx.drawImage(await loadImage(template.imageUrl), 0, 0, out.width, out.height)
      } catch {
        return null
      }
    }
  }
  ctx.drawImage(layer, 0, 0, out.width, out.height)
  return toBlob(out)
}

export type PngCheck = { ok: true; file: File } | { ok: false; message: string }

/** Wrap the blob as `lukisan.png`, or fail with the photo message when empty or over 5 MB. */
export function pngToFile(blob: Blob | null): PngCheck {
  if (!blob || blob.size > MAX_PHOTO_BYTES) return { ok: false, message: MSG_PHOTO_TYPE }
  return { ok: true, file: new File([blob], PNG_FILE_NAME, { type: 'image/png' }) }
}
