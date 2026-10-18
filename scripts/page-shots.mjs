// Page-level before/after screenshot harness (hardening spec 5.4, task T-V). Not committed output.
//
//   npm run page-shots -- --out .page-shots/before [--base http://localhost:5191] [--roles pelajar,guru]
//                         [--widths 375,768,1280] [--themes light,dark] [--limit 5] [--concurrency 4]
//   npm run page-shots -- --compare .page-shots/before .page-shots/after [--out .page-shots/compare]
//
// Capture: logs in as each demo role through the real login form, reads the sidebar menu routes from
// the DOM at 1280px, then visits every route at each width in light and dark and saves PNGs plus
// manifest.json. It only reads from the given base URL (it never starts or stops the preview).
// Compare: per-shot differing-pixel ratio, compare.json and an HTML contact sheet (before | after | diff).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { chromium } from '@playwright/test'
import { PNG } from 'playwright-core/lib/utilsBundle'

const ROLES = {
  pelajar: 'pelajar@demo.test',
  guru: 'guru@demo.test',
  adminsekolah: 'adminsekolah@demo.test',
  admin: 'admin@demo.test',
}
const PASSWORD = 'Demo1234'
const DEFAULT_OUT = '.page-shots/run'

function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (!t.startsWith('--')) {
      a._.push(t)
      continue
    }
    const key = t.slice(2)
    const next = argv[i + 1]
    if (key === 'compare') {
      a.compare = [argv[i + 1], argv[i + 2]]
      i += 2
    } else if (next === undefined || next.startsWith('--')) a[key] = true
    else {
      a[key] = next
      i++
    }
  }
  return a
}

const slugOf = (route) =>
  route === '/' ? 'root' : route.replace(/^\//, '').replace(/[^\w-]+/g, '_')
const list = (v, d) =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : d

async function login(page, base, email) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', PASSWORD)
  await page.click('[data-testid=login-submit]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
}

/** Sidebar routes: the nav with the most internal links at desktop width (collapsed groups included). */
async function discoverRoutes(page) {
  return page.$$eval('nav', (navs) => {
    const best = navs
      .filter((n) => n.getClientRects().length > 0)
      .map((n) => ({
        n,
        hrefs: [...n.querySelectorAll('a[href]')]
          .map((a) => a.getAttribute('href'))
          .filter((h) => h && h.startsWith('/') && !h.startsWith('//')),
      }))
      .sort((x, y) => y.hrefs.length - x.hrefs.length)[0]
    return best ? [...new Set(best.hrefs.map((h) => h.split('#')[0]))] : []
  })
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  // Mock handlers answer with latency: wait for skeletons / busy regions to clear (best effort).
  await page
    .waitForFunction(
      () =>
        !document.querySelector(
          '[aria-busy="true"], [data-skeleton], .animate-pulse, [class*="skeleton"], [data-testid*="skeleton"]',
        ),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {})
  await page.waitForTimeout(500)
}

async function captureRole(browser, role, opts, manifest, log) {
  const { base, out, widths, themes, limit } = opts
  let routes = null
  for (const theme of themes) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
      reducedMotion: 'reduce',
      locale: 'ms-MY',
    })
    await ctx.addInitScript((t) => {
      localStorage.setItem('pp.theme', t)
      localStorage.setItem('pp.friend', 'aiman') // skip the first-visit friend picker
    }, theme)
    const page = await ctx.newPage()
    try {
      await login(page, base, ROLES[role])
      if (!routes) {
        await page.waitForTimeout(1_000)
        routes = (await discoverRoutes(page)).slice(0, limit ?? Infinity)
        log(`${role}: ${routes.length} sidebar routes`)
      }
      for (const width of widths) {
        await page.setViewportSize({ width, height: width === 1280 ? 900 : 800 })
        for (const route of routes) {
          const file = `${role}/${theme}/${width}/${slugOf(route)}.png`
          const entry = { role, theme, width, route, file, ok: false }
          try {
            await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' })
            await settle(page)
            const finalPath = new URL(page.url()).pathname
            entry.finalPath = finalPath
            await mkdir(dirname(join(out, file)), { recursive: true })
            await page.screenshot({
              path: join(out, file),
              fullPage: true,
              animations: 'disabled',
              caret: 'hide',
            })
            entry.ok = true
          } catch (e) {
            entry.error = String(e.message ?? e).split('\n')[0]
          }
          manifest.shots.push(entry)
        }
      }
    } catch (e) {
      manifest.errors.push({ role, theme, error: String(e.message ?? e).split('\n')[0] })
      log(`${role}/${theme}: ${String(e.message ?? e).split('\n')[0]}`)
    } finally {
      await ctx.close()
    }
  }
  manifest.routes[role] = routes ?? []
}

async function capture(args) {
  const base = String(args.base ?? 'http://localhost:5191').replace(/\/$/, '')
  const out = resolve(String(args.out ?? DEFAULT_OUT))
  const roles = list(args.roles, Object.keys(ROLES)).filter((r) => {
    if (!ROLES[r]) console.warn(`Unknown role "${r}" skipped`)
    return ROLES[r]
  })
  const opts = {
    base,
    out,
    widths: list(args.widths, ['375', '768', '1280']).map(Number),
    themes: list(args.themes, ['light', 'dark']),
    limit: args.limit ? Number(args.limit) : undefined,
  }
  const concurrency = Number(args.concurrency ?? 4)
  await mkdir(out, { recursive: true })
  const manifest = {
    base,
    createdAt: new Date().toISOString(),
    widths: opts.widths,
    themes: opts.themes,
    routes: {},
    shots: [],
    errors: [],
  }
  const log = (m) => console.log(m)
  const browser = await chromium.launch()
  try {
    const queue = [...roles]
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        for (let role = queue.shift(); role; role = queue.shift())
          await captureRole(browser, role, opts, manifest, log)
      }),
    )
  } finally {
    await browser.close()
  }
  manifest.shots.sort((a, b) => (a.file < b.file ? -1 : 1))
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
  const ok = manifest.shots.filter((s) => s.ok).length
  console.log(`Saved ${ok}/${manifest.shots.length} shots to ${out}`)
  if (manifest.errors.length)
    console.log(`${manifest.errors.length} context error(s); see manifest.json`)
  return manifest
}

/** Fraction of pixels whose colour differs by more than a small threshold; writes a diff PNG. */
function diffPng(a, b, threshold = 24) {
  const w = Math.max(a.width, b.width)
  const h = Math.max(a.height, b.height)
  const diff = new PNG({ width: w, height: h })
  let changed = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      const inA = x < a.width && y < a.height
      const inB = x < b.width && y < b.height
      let isDiff = false
      if (inA && inB) {
        const ia = (y * a.width + x) * 4
        const ib = (y * b.width + x) * 4
        const d = Math.max(
          Math.abs(a.data[ia] - b.data[ib]),
          Math.abs(a.data[ia + 1] - b.data[ib + 1]),
          Math.abs(a.data[ia + 2] - b.data[ib + 2]),
        )
        isDiff = d > threshold
        if (!isDiff) {
          const g = Math.round(a.data[ia] * 0.3 + a.data[ia + 1] * 0.59 + a.data[ia + 2] * 0.11)
          diff.data[o] = diff.data[o + 1] = diff.data[o + 2] = 255 - Math.round((255 - g) * 0.25)
          diff.data[o + 3] = 255
          continue
        }
      } else isDiff = true
      changed++
      diff.data[o] = 255
      diff.data[o + 1] = 0
      diff.data[o + 2] = 80
      diff.data[o + 3] = 255
    }
  }
  return {
    ratio: changed / (w * h),
    diff,
    sizeChanged: a.width !== b.width || a.height !== b.height,
  }
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

async function compare(args) {
  const [beforeDir, afterDir] = args.compare.map((d) => resolve(d))
  const out = resolve(String(args.out ?? '.page-shots/compare'))
  const load = async (d) => JSON.parse(await readFile(join(d, 'manifest.json'), 'utf8'))
  const [mb, ma] = await Promise.all([load(beforeDir), load(afterDir)])
  const key = (s) => s.file
  const mapAfter = new Map(ma.shots.filter((s) => s.ok).map((s) => [key(s), s]))
  await mkdir(join(out, 'diff'), { recursive: true })
  const rows = []
  for (const s of mb.shots.filter((x) => x.ok)) {
    const other = mapAfter.get(key(s))
    if (!other) {
      rows.push({ ...s, status: 'missing-after' })
      continue
    }
    const pa = PNG.sync.read(await readFile(join(beforeDir, s.file)))
    const pb = PNG.sync.read(await readFile(join(afterDir, s.file)))
    const { ratio, diff, sizeChanged } = diffPng(pa, pb)
    const diffFile = `diff/${s.file.replaceAll('/', '__')}`
    if (ratio > 0) await writeFile(join(out, diffFile), PNG.sync.write(diff))
    rows.push({
      ...s,
      status: ratio === 0 ? 'same' : 'changed',
      ratio,
      sizeChanged,
      diffFile: ratio > 0 ? diffFile : null,
    })
  }
  for (const s of ma.shots.filter((x) => x.ok))
    if (!mb.shots.some((b) => b.ok && key(b) === key(s)))
      rows.push({ ...s, status: 'missing-before' })
  rows.sort((x, y) => (y.ratio ?? 2) - (x.ratio ?? 2))
  await writeFile(
    join(out, 'compare.json'),
    JSON.stringify({ before: beforeDir, after: afterDir, rows }, null, 2),
  )
  const rel = (dir, f) => relative(out, join(dir, f)).replaceAll('\\', '/')
  const cards = rows
    .filter((r) => r.status !== 'same')
    .map(
      (
        r,
      ) => `<section><h3>${esc(r.role)} / ${esc(r.theme)} / ${r.width} / ${esc(r.route)} <b>${r.ratio === undefined ? esc(r.status) : (r.ratio * 100).toFixed(2) + ' %'}</b>${r.sizeChanged ? ' (page height changed)' : ''}</h3>
<div class="row">${r.status === 'missing-after' || r.status === 'changed' ? `<figure><figcaption>before</figcaption><img loading="lazy" src="${rel(beforeDir, r.file)}"></figure>` : ''}${r.status !== 'missing-after' ? `<figure><figcaption>after</figcaption><img loading="lazy" src="${rel(afterDir, r.file)}"></figure>` : ''}${r.diffFile ? `<figure><figcaption>diff</figcaption><img loading="lazy" src="${r.diffFile}"></figure>` : ''}</div></section>`,
    )
    .join('\n')
  const changed = rows.filter((r) => r.status === 'changed').length
  const html = `<!doctype html><meta charset="utf-8"><title>page-shots compare</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f6}h3{margin:16px 0 4px;font-size:13px}.row{display:flex;gap:8px;align-items:flex-start;overflow-x:auto}figure{margin:0;flex:0 0 auto;max-width:420px}figcaption{font-size:11px;color:#555}img{max-width:420px;max-height:600px;object-fit:cover;object-position:top;border:1px solid #ccc;background:#fff}</style>
<h1>page-shots compare</h1><p>${rows.length} shots, ${changed} changed, ${rows.filter((r) => r.status === 'same').length} identical, ${rows.filter((r) => r.status.startsWith('missing')).length} missing. Sorted by differing-pixel ratio.</p>
${cards}`
  await writeFile(join(out, 'index.html'), html)
  console.log(
    `Compared ${rows.length} shots: ${changed} changed, ${rows.filter((r) => r.status === 'same').length} identical, ${rows.filter((r) => r.status.startsWith('missing')).length} missing`,
  )
  for (const r of rows.filter((x) => x.status === 'changed').slice(0, 10))
    console.log(`  ${(r.ratio * 100).toFixed(2).padStart(6)} %  ${r.file}`)
  console.log(`Contact sheet: ${join(out, 'index.html')}`)
}

const args = parseArgs(process.argv.slice(2))
if (args.compare) await compare(args)
else {
  if (!existsSync('.page-shots') && !args.out) console.log('Tip: pass --out .page-shots/<name>')
  await capture(args)
}
