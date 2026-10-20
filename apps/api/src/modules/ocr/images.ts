import { Injectable } from '@nestjs/common'

import { OcrError } from './ocr.error'

type CanvasLib = typeof import('@napi-rs/canvas')

let lib: Promise<CanvasLib | null> | undefined

/** Loads @napi-rs/canvas once; `null` when the native module is unavailable on this host. */
export function loadCanvas(): Promise<CanvasLib | null> {
  lib ??= import('@napi-rs/canvas').then(
    (m) => m,
    () => null,
  )
  return lib
}

export interface EncodedImage {
  data: Buffer
  contentType: 'image/webp' | 'image/png'
  format: 'webp' | 'png'
  /** Pixels of the encoded image. */
  width: number
  height: number
}

export interface EncodeOptions {
  format: 'webp' | 'png'
  /** Images wider than this are scaled down (aspect ratio kept); never scaled up. */
  maxWidth?: number
  /** 1..100, webp only. */
  quality?: number
}

async function need(): Promise<CanvasLib> {
  const c = await loadCanvas()
  if (!c) throw new OcrError('RENDER_FAILED', 'canvas unavailable')
  return c
}

/** Re-encodes a PNG as webp (falls back to png when webp fails) with an optional maximum width. */
export async function encodeImage(png: Buffer, opts: EncodeOptions): Promise<EncodedImage> {
  const c = await need()
  try {
    const img = await c.loadImage(png)
    const scale = opts.maxWidth && img.width > opts.maxWidth ? opts.maxWidth / img.width : 1
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))
    const canvas = c.createCanvas(width, height)
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    if (opts.format === 'webp') {
      try {
        const data = await canvas.encode('webp', opts.quality ?? 80)
        return { data, contentType: 'image/webp', format: 'webp', width, height }
      } catch {
        // fall through to png
      }
    }
    return { data: await canvas.encode('png'), contentType: 'image/png', format: 'png', width, height }
  } catch (e) {
    if (e instanceof OcrError) throw e
    throw new OcrError('RENDER_FAILED')
  }
}

export interface FractionBox {
  x: number
  y: number
  w: number
  h: number
}

/** Crops a region given as page fractions (0..1, y from the top) and returns it as PNG. */
export async function cropImage(png: Buffer, bbox: FractionBox): Promise<Buffer> {
  const c = await need()
  try {
    const img = await c.loadImage(png)
    const clamp = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))
    const x = Math.floor(clamp(bbox.x) * img.width)
    const y = Math.floor(clamp(bbox.y) * img.height)
    const w = Math.max(1, Math.min(img.width - x, Math.round(clamp(bbox.w) * img.width)))
    const h = Math.max(1, Math.min(img.height - y, Math.round(clamp(bbox.h) * img.height)))
    const canvas = c.createCanvas(w, h)
    canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h)
    return await canvas.encode('png')
  } catch (e) {
    if (e instanceof OcrError) throw e
    throw new OcrError('RENDER_FAILED')
  }
}

/** Injectable wrapper of the image helpers. */
@Injectable()
export class OcrImageService {
  encode(png: Buffer, opts: EncodeOptions): Promise<EncodedImage> {
    return encodeImage(png, opts)
  }

  crop(png: Buffer, bbox: FractionBox): Promise<Buffer> {
    return cropImage(png, bbox)
  }
}
