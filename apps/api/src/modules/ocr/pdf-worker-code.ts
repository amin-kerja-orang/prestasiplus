/**
 * Source of the worker thread that runs pdfjs-dist. It is a plain CommonJS string started with
 * `new Worker(code, { eval: true })`, so it needs no separate entry file and behaves the same under
 * vitest and in the Vite bundle. pdfjs and the canvas are loaded with dynamic `import()` from absolute
 * file URLs that the parent resolves and passes through `workerData`.
 *
 * Keep this string self-contained and free of backticks and `${`.
 *
 * Security (AC-7): no `url` is ever passed, scripting is not enabled, `isEvalSupported` is false,
 * workers never fetch (`useWorkerFetch: false`) and fonts/cmaps/wasm/icc come from local folders.
 * Link annotations and actions are never followed: pdfjs only parses them.
 */
export const PDF_WORKER_CODE = String.raw`
'use strict'
const { workerData, parentPort } = require('node:worker_threads')

function lines(items) {
  const rows = []
  for (const it of items) {
    if (!it || !it.str) continue
    const y = Math.round(it.transform[5])
    let row = null
    for (const r of rows) if (Math.abs(r.y - y) <= 2) { row = r; break }
    if (!row) { row = { y, parts: [] }; rows.push(row) }
    row.parts.push(it)
  }
  rows.sort((a, b) => b.y - a.y)
  return rows
}

async function open(d, pdfjs) {
  const task = pdfjs.getDocument({
    data: d.bytes,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    enableXfa: false,
    stopAtErrors: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    verbosity: 0,
    useWorkerFetch: false,
    maxImageSize: d.maxImagePixels,
    standardFontDataUrl: d.standardFontDataUrl,
    cMapUrl: d.cMapUrl,
    cMapPacked: true,
    wasmUrl: d.wasmUrl,
    iccUrl: d.iccUrl,
  })
  return await task.promise
}

async function run(d) {
  const pdfjs = await import(d.pdfjsUrl)
  const pdf = await open(d, pdfjs)
  try {
    if (d.op === 'inspect') {
      return { pageCount: pdf.numPages }
    }
    if (d.pageNo < 1 || d.pageNo > pdf.numPages) throw Object.assign(new Error('page out of range'), { name: 'PageRangeError' })
    const page = await pdf.getPage(d.pageNo)
    const base = page.getViewport({ scale: 1 })
    if (d.op === 'text') {
      const content = await page.getTextContent()
      const rows = lines(content.items)
      const blocks = []
      const texts = []
      for (const r of rows) {
        const text = r.parts
          .slice()
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map((p) => p.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (!text) continue
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
        for (const p of r.parts) {
          const x = p.transform[4], y = p.transform[5]
          const w = p.width || 0, h = p.height || Math.abs(p.transform[3]) || 0
          const a = base.convertToViewportPoint(x, y)
          const b = base.convertToViewportPoint(x + w, y + h)
          x1 = Math.min(x1, a[0], b[0]); x2 = Math.max(x2, a[0], b[0])
          y1 = Math.min(y1, a[1], b[1]); y2 = Math.max(y2, a[1], b[1])
        }
        const clamp = (v) => Math.min(1, Math.max(0, v))
        const fx1 = clamp(x1 / base.width), fx2 = clamp(x2 / base.width)
        const fy1 = clamp(y1 / base.height), fy2 = clamp(y2 / base.height)
        blocks.push({ text, bbox: { x: fx1, y: fy1, w: fx2 - fx1, h: fy2 - fy1 }, confidence: null })
        texts.push(text)
      }
      const text = texts.join('\n')
      return { pageNo: d.pageNo, text, blocks, charCount: text.length, width: base.width, height: base.height }
    }
    // render
    let canvasLib
    try { canvasLib = require(d.canvasPath) } catch { return { unavailable: true } }
    let scale = d.dpi / 72
    const px = base.width * scale * base.height * scale
    if (px > d.maxPixels) scale = scale * Math.sqrt(d.maxPixels / px)
    const viewport = page.getViewport({ scale })
    const w = Math.max(1, Math.floor(viewport.width))
    const h = Math.max(1, Math.floor(viewport.height))
    const { canvas, context } = pdf.canvasFactory.create(w, h)
    await page.render({ canvasContext: context, canvas, viewport, background: 'rgb(255,255,255)' }).promise
    const buf = await canvas.encode('png')
    const out = new Uint8Array(buf.length)
    out.set(buf)
    return { png: out, width: w, height: h }
  } finally {
    try { await pdf.destroy() } catch {}
  }
}

run(workerData).then(
  (result) => {
    const transfer = result && result.png ? [result.png.buffer] : []
    parentPort.postMessage({ ok: true, result }, transfer)
  },
  (err) => {
    parentPort.postMessage({ ok: false, error: { name: String(err && err.name), message: String(err && err.message).slice(0, 200) } })
  },
)
`
