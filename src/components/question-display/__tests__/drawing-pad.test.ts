// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DrawingPad from '../DrawingPad.vue'
import {
  addStroke,
  clearStrokes,
  gridGeometry,
  lineStroke,
  pngToFile,
  toLogical,
  undoStroke,
} from '../lib/drawing'
import { MSG_PAD_EXPORT } from '../lib/drawing'
import { MAX_PHOTO_BYTES, MSG_PHOTO_TYPE } from '../lib/photo-store'

const GRID = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, step: 1, scale: '1 petak = 1 unit' }

function fakeCtx(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {}
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k as string] : () => undefined),
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D
}

let blobSize = 10
beforeEach(() => {
  blobSize = 10
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx())
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
    cb(new Blob([new Uint8Array(blobSize)], { type: 'image/png' }))
  })
})
afterEach(() => vi.restoreAllMocks())

function ptr(type: string, x: number, y: number): PointerEvent {
  const e = new Event(type, { bubbles: true, cancelable: true }) as unknown as Record<
    string,
    unknown
  >
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, button: 0 })
  return e as unknown as PointerEvent
}
async function stroke(
  w: ReturnType<typeof mount>,
  pts: [number, number][] = [
    [10, 10],
    [50, 50],
  ],
) {
  const c = w.get('[data-testid="pad-canvas"]').element
  c.dispatchEvent(ptr('pointerdown', ...pts[0]!))
  for (const p of pts.slice(1)) c.dispatchEvent(ptr('pointermove', ...p))
  c.dispatchEvent(ptr('pointerup', ...pts[pts.length - 1]!))
  await w.vm.$nextTick()
}
const btn = (w: ReturnType<typeof mount>, id: string) => w.get(`[data-testid="${id}"]`)

describe('lib/drawing', () => {
  it('grid geometry has a line every step, axes at zero', () => {
    const g = gridGeometry(GRID, 800, 600)
    expect(g.vertical).toHaveLength(11)
    expect(g.horizontal).toHaveLength(11)
    expect(g.vertical.filter((l) => l.axis)).toHaveLength(1)
    expect(g.vertical[5]!.x1).toBe(400)
    expect(gridGeometry({ ...GRID, step: 5 }, 800, 600).vertical).toHaveLength(3)
  })
  it('history helpers are exact', () => {
    const s = lineStroke({ x: 0, y: 0 }, { x: 1, y: 1 })
    const h = addStroke(addStroke([], s), s)
    expect(h).toHaveLength(2)
    expect(undoStroke(h)).toHaveLength(1)
    expect(clearStrokes()).toEqual([])
    expect(undoStroke([])).toEqual([])
  })
  it('maps and clamps pointer coordinates', () => {
    const rect = { left: 10, top: 10, width: 400, height: 300 }
    expect(toLogical(210, 160, rect, 800, 600)).toEqual({ x: 400, y: 300 })
    expect(toLogical(0, 999, rect, 800, 600)).toEqual({ x: 0, y: 600 })
  })
  it('pngToFile enforces 5 MB', () => {
    const ok = pngToFile(new Blob(['x'], { type: 'image/png' }))
    expect(ok.ok && ok.file.name).toBe('lukisan.png')
    expect(pngToFile(null)).toEqual({ ok: false, message: MSG_PAD_EXPORT })
    const big = { size: MAX_PHOTO_BYTES + 1 } as Blob
    expect(pngToFile(big)).toEqual({ ok: false, message: MSG_PHOTO_TYPE })
  })
})

describe('DrawingPad', () => {
  it('ignores a right-click', () => {
    const w = mount(DrawingPad)
    const c = w.get('[data-testid="pad-canvas"]').element
    const down = ptr('pointerdown', 5, 5) as unknown as { button: number }
    down.button = 2
    c.dispatchEvent(down as unknown as Event)
    c.dispatchEvent(ptr('pointerup', 9, 9))
    expect(w.emitted('change')).toBeUndefined()
  })

  it('auto-saves 800 ms after the last stroke change; clear cancels it', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(DrawingPad)
      await stroke(w)
      await vi.advanceTimersByTimeAsync(700)
      expect(w.emitted('save')).toBeUndefined()
      await vi.advanceTimersByTimeAsync(150)
      expect(w.emitted('save')).toHaveLength(1)
      await stroke(w)
      await btn(w, 'pad-clear').trigger('click')
      await vi.advanceTimersByTimeAsync(1000)
      expect(w.emitted('save')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes a pending drawing to onFlush on unmount', async () => {
    const onFlush = vi.fn()
    const w = mount(DrawingPad, { props: { onFlush } })
    await stroke(w)
    w.unmount()
    await vi.waitFor(() => expect(onFlush).toHaveBeenCalledTimes(1))
    expect((onFlush.mock.calls[0]![0] as File).name).toBe('lukisan.png')
  })

  it('shows labels and switches tools with aria-pressed', async () => {
    const w = mount(DrawingPad)
    expect(w.text()).toContain('Papan Lukisan')
    for (const [id, t] of [
      ['pad-tool-pen', 'Pen'],
      ['pad-tool-line', 'Garis'],
      ['pad-tool-eraser', 'Pemadam'],
    ]) {
      expect(btn(w, id!).text()).toBe(t)
    }
    expect(btn(w, 'pad-undo').text()).toBe('Buat Asal')
    expect(btn(w, 'pad-clear').text()).toBe('Kosongkan')
    expect(btn(w, 'pad-save').text()).toBe('Simpan lukisan')
    expect(btn(w, 'pad-tool-pen').attributes('aria-pressed')).toBe('true')
    await btn(w, 'pad-tool-line').trigger('click')
    expect(btn(w, 'pad-tool-line').attributes('aria-pressed')).toBe('true')
    expect(btn(w, 'pad-tool-pen').attributes('aria-pressed')).toBe('false')
    expect(w.get('[data-testid="pad-canvas"]').attributes('style')).toContain('touch-action: none')
  })

  it('every control has min-h-11', () => {
    const w = mount(DrawingPad)
    const ids = [
      'pad-tool-pen',
      'pad-tool-line',
      'pad-tool-eraser',
      'pad-undo',
      'pad-clear',
      'pad-save',
    ]
    for (const id of ids) expect(btn(w, id).classes()).toContain('min-h-11')
  })

  it('a stroke enables Simpan and emits change; Buat Asal and Kosongkan work', async () => {
    const w = mount(DrawingPad)
    expect(btn(w, 'pad-save').attributes('disabled')).toBeDefined()
    await stroke(w)
    expect(btn(w, 'pad-save').attributes('disabled')).toBeUndefined()
    expect(w.emitted('change')!.at(-1)).toEqual([{ empty: false }])
    await btn(w, 'pad-tool-line').trigger('click')
    await stroke(w, [
      [0, 0],
      [100, 100],
    ])
    await btn(w, 'pad-undo').trigger('click')
    expect(btn(w, 'pad-save').attributes('disabled')).toBeUndefined()
    await btn(w, 'pad-undo').trigger('click')
    expect(btn(w, 'pad-save').attributes('disabled')).toBeDefined()
    await stroke(w)
    await stroke(w)
    await btn(w, 'pad-clear').trigger('click')
    expect(btn(w, 'pad-save').attributes('disabled')).toBeDefined()
    expect(w.emitted('change')!.at(-1)).toEqual([{ empty: true }])
  })

  it('save emits lukisan.png', async () => {
    const w = mount(DrawingPad, { props: { template: { grid: GRID } } })
    await stroke(w)
    await btn(w, 'pad-save').trigger('click')
    await vi.waitFor(() => expect(w.emitted('save')).toHaveLength(1))
    const f = w.emitted('save')![0]![0] as File
    expect(f).toBeInstanceOf(File)
    expect(f.name).toBe('lukisan.png')
    expect(f.type).toBe('image/png')
    expect(w.find('[data-testid="pad-error"]').exists()).toBe(false)
  })

  it('over 5 MB shows the error and emits nothing', async () => {
    blobSize = MAX_PHOTO_BYTES + 1
    const w = mount(DrawingPad)
    await stroke(w)
    await btn(w, 'pad-save').trigger('click')
    await vi.waitFor(() => expect(w.find('[data-testid="pad-error"]').exists()).toBe(true))
    expect(btn(w, 'pad-error').text()).toBe('Gambar mesti JPG atau PNG, maksimum 5 MB.')
    expect(w.emitted('save')).toBeUndefined()
  })

  it('disabled blocks drawing and disables controls', async () => {
    const w = mount(DrawingPad, { props: { disabled: true } })
    await stroke(w)
    expect(w.emitted('change')).toBeUndefined()
    for (const id of [
      'pad-tool-pen',
      'pad-tool-line',
      'pad-tool-eraser',
      'pad-undo',
      'pad-clear',
      'pad-save',
    ]) {
      expect(btn(w, id).attributes('disabled')).toBeDefined()
    }
  })

  it('renders the grid template with its scale caption', () => {
    const w = mount(DrawingPad, { props: { template: { grid: GRID } } })
    expect(w.findAll('[data-testid="pad-template-grid"] line')).toHaveLength(22)
    expect(w.text()).toContain('1 petak = 1 unit')
    expect(w.find('[data-testid="pad-template-image"]').exists()).toBe(false)
  })

  it('renders the image template', () => {
    const w = mount(DrawingPad, { props: { template: { imageUrl: '/t.png' } } })
    expect(w.get('[data-testid="pad-template-image"]').attributes('src')).toBe('/t.png')
    expect(w.find('[data-testid="pad-template-grid"]').exists()).toBe(false)
  })
})
