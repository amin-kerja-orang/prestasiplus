// Static-hosting "artifact" build (claude.ai Artifact): demo data, hash routing, relative paths,
// few files, skeleton-less index.html and a `_files.json` publish list.
// Usage: npm run build:artifact   -> dist-artifact/
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const OUT = 'dist-artifact'
const MAX_FILES = 240

rmSync(OUT, { recursive: true, force: true })
const vite = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--mode', 'demo', '--outDir', OUT, '--emptyOutDir'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_ARTIFACT: '1',
      VITE_HASH_HISTORY: 'true',
      // Shell values must not override .env.demo.
      VITE_TEST_HOOKS: 'false',
      VITE_API_MODE: 'mock',
      // The prototype scope (D43) is always on in the artifact, whatever the shell env says.
      VITE_PROTOTYPE_SCOPE: 'on',
    },
  },
)
if (vite.status !== 0) process.exit(vite.status ?? 1)

const guard = spawnSync(process.execPath, ['scripts/check-demo-bundle.mjs', OUT], {
  stdio: 'inherit',
})
if (guard.status !== 0) process.exit(guard.status ?? 1)

/** @param {string} dir @returns {string[]} */
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

// index.html -> skeleton-less fragment (the host adds <html>/<head>/<body>).
const html = readFileSync(join(OUT, 'index.html'), 'utf8')
/** @param {RegExp} re */
const tags = (re) => [...html.matchAll(re)].map((m) => m[0])
const title = tags(/<title>.*?<\/title>/gs)[0] ?? '<title>PRESTASIPLUS</title>'
const links = tags(/<link\b[^>]*rel="stylesheet"[^>]*>/g)
const preloads = tags(/<link\b[^>]*rel="modulepreload"[^>]*>/g)
const scripts = tags(/<script\b[^>]*type="module"[^>]*><\/script>/g)
if (scripts.length === 0) throw new Error('build-artifact: no module script found in index.html')
// Inline splash (style + markup inside #app); Vue's mount replaces it. Order matters: the splash
// style and #app come BEFORE the render-blocking stylesheet and module script, so it paints first.
const splashStyle = tags(/<style\b[^>]*id="pp-splash-css"[^>]*>.*?<\/style>/gs)[0]
const appDiv = tags(/<div id="app">.*?<\/div>\s*<\/div>/gs)[0]
if (!splashStyle || !appDiv) throw new Error('build-artifact: splash markup missing in index.html')
const fragment =
  [
    title,
    '<meta name="claude:viewport-fit-sides" content="cover">',
    splashStyle,
    appDiv,
    ...links,
    ...preloads,
    ...scripts,
  ]
    .join('\n')
    .replace(/(src|href)="\/(?!\/)/g, '$1="./') + '\n'
if (/<(!doctype|html|head|body)\b/i.test(fragment))
  throw new Error('build-artifact: skeleton tag left')
writeFileSync(join(OUT, 'index.html'), fragment)

const all = walk(OUT)
  .map((f) => relative(OUT, f).split(sep).join('/'))
  .filter((f) => f !== '_files.json')
const list = all.filter((f) => f !== 'index.html').sort()
writeFileSync(join(OUT, '_files.json'), JSON.stringify(list, null, 2) + '\n')

const sizes = all.map((f) => statSync(join(OUT, f)).size)
const total = sizes.reduce((a, b) => a + b, 0)
const biggest = Math.max(...sizes)
console.log(
  `build-artifact: ${String(all.length)} files incl. index.html, ${(total / 1048576).toFixed(2)} MB, largest ${(biggest / 1048576).toFixed(2)} MB`,
)
if (all.length > MAX_FILES || biggest > 16 * 1048576 || total > 64 * 1048576) {
  console.error('build-artifact: FAIL: exceeds publish limits')
  process.exit(1)
}
