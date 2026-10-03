// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureCardToPng } from '../../lib/student/studentb-capture'
import { downloadCard, setCardDownloader } from '../../lib/student/studentb-share'

const mocks = vi.hoisted(() => ({
  html2canvas: vi.fn(),
  saveBlob: vi.fn(),
}))
vi.mock('html2canvas', () => ({ default: mocks.html2canvas }))
vi.mock('@/lib/save-blob', () => ({ saveBlob: mocks.saveBlob }))

const blob = new Blob(['png'], { type: 'image/png' })
const canvasOf = (b: Blob | null) => ({
  toBlob: (cb: (x: Blob | null) => void) => {
    cb(b)
  },
})

beforeEach(() => {
  mocks.html2canvas.mockReset()
  mocks.saveBlob.mockReset()
  setCardDownloader(null)
})

describe('captureCardToPng (D25)', () => {
  it('captures the card with html2canvas at scale 2 and saves the PNG under the file name', async () => {
    mocks.html2canvas.mockResolvedValue(canvasOf(blob))
    const el = document.createElement('div')
    await captureCardToPng(el, 'prestasiplus-profil.png')
    expect(mocks.html2canvas).toHaveBeenCalledTimes(1)
    expect(mocks.html2canvas.mock.calls[0]?.[0]).toBe(el)
    expect(mocks.html2canvas.mock.calls[0]?.[1]).toMatchObject({ scale: 2 })
    expect(mocks.saveBlob).toHaveBeenCalledWith(blob, 'prestasiplus-profil.png')
  })

  it('does nothing without a target', async () => {
    await captureCardToPng(null, 'a.png')
    expect(mocks.html2canvas).not.toHaveBeenCalled()
  })

  it('rejects when the canvas yields no blob, and saves nothing', async () => {
    mocks.html2canvas.mockResolvedValue(canvasOf(null))
    await expect(captureCardToPng(document.createElement('div'), 'a.png')).rejects.toThrow()
    expect(mocks.saveBlob).not.toHaveBeenCalled()
  })

  it('is the default downloader of downloadCard', async () => {
    mocks.html2canvas.mockResolvedValue(canvasOf(blob))
    await downloadCard(document.createElement('div'), 'pencapaian-langkah-pertama.png')
    expect(mocks.saveBlob).toHaveBeenCalledWith(blob, 'pencapaian-langkah-pertama.png')
  })

  it('flattens modern colour functions to rgb before capture', async () => {
    mocks.html2canvas.mockImplementation(
      (_el: HTMLElement, opts: { onclone: (d: Document, c: HTMLElement) => void }) => {
        const cloned = document.createElement('div')
        document.body.append(cloned)
        opts.onclone(document, cloned)
        cloned.remove()
        return Promise.resolve(canvasOf(blob))
      },
    )
    await expect(captureCardToPng(document.createElement('div'), 'a.png')).resolves.toBeUndefined()
  })
})

describe('colour conversion (flattenColorValue)', () => {
  /** A fake 2d context: `accepts` decides which assigned colours the setter takes. */
  function fakeContext(accepts: (c: string) => boolean, pixel: number[]) {
    let style = '#000000'
    return {
      get fillStyle() {
        return style
      },
      set fillStyle(v: string) {
        if (accepts(v)) style = v
      },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: () => ({ data: pixel }),
    }
  }

  async function load(ctx: object) {
    vi.resetModules()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    return import('../../lib/student/studentb-capture')
  }

  it('rewrites a parseable colour function to rgb / rgba', async () => {
    const m = await load(fakeContext(() => true, [10, 20, 30, 255]))
    expect(m.flattenColorValue('oklch(0.5 0.2 280)')).toBe('rgb(10, 20, 30)')
    const half = await load(fakeContext(() => true, [10, 20, 30, 128]))
    expect(half.flattenColorValue('color(srgb 1 1 1 / 0.5)')).toBe('rgba(10, 20, 30, 0.502)')
  })

  it('leaves an unparseable colour unchanged instead of turning it black', async () => {
    const m = await load(fakeContext((c) => !c.startsWith('color('), [0, 0, 0, 255]))
    expect(m.flattenColorValue('color(bogus 1 2 3)')).toBe('color(bogus 1 2 3)')
    expect(m.flattenColorValue('0 1px 2px color(bogus 1 2 3)')).toBe('0 1px 2px color(bogus 1 2 3)')
  })

  it('leaves the value unchanged when no 2d context exists', async () => {
    vi.resetModules()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const m = await import('../../lib/student/studentb-capture')
    expect(m.flattenColorValue('oklch(0.5 0.2 280)')).toBe('oklch(0.5 0.2 280)')
  })

  it('strips the interpolation token from gradients', async () => {
    const m = await load(fakeContext(() => true, [1, 2, 3, 255]))
    expect(m.flattenGradient('linear-gradient(to right in oklab, oklch(0.5 0.2 280), red)')).toBe(
      'linear-gradient(to right, rgb(1, 2, 3), red)',
    )
  })
})
