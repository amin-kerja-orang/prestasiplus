import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import {
  audit,
  collectRoutes,
  findRoots,
  MOCK_MODULE_RE,
  mockSourcesOf,
} from '../check-http-build.mjs'

const map = (...sources) => JSON.stringify({ version: 3, sources })

describe('MOCK_MODULE_RE', () => {
  it.each([
    'src/mock/server/respond.ts',
    'src/modules/m10-teacher-class/mock/data/designed.ts',
    'src\\mock\\server\\respond.ts',
    'src\\modules\\m10-teacher-class\\mock\\index.ts',
    'home/u/repo/src/mock/index.ts',
  ])('matches %s', (p) => expect(MOCK_MODULE_RE.test(p)).toBe(true))

  it.each([
    'src/mock/server/__tests__/registry-boot.test.ts',
    'src/modules/m10-teacher-class/mock/__tests__/a.test.ts',
    'src\\mock\\__tests__\\a.test.ts',
    'src/modules/m06-spm/pages/mock-exam/Page.vue',
    'src/lib/mock-lib/index.ts',
    'src/modules/m04-question-bank/lib/mock-extractor.ts',
    'src/modules/m04-question-bank/mock-data/x.ts',
    'node_modules/pkg/src/mock/x.js',
    'src/pages/Home.vue',
  ])('does not match %s', (p) => expect(MOCK_MODULE_RE.test(p)).toBe(false))
})

describe('mockSourcesOf', () => {
  it('normalises ../ paths against the chunk location', () => {
    const m = map('../../src/mock/a.ts', '../../src/pages/P.vue', '../../src/mock/__tests__/t.ts')
    expect(mockSourcesOf(m, 'assets/x.js')).toEqual(['src/mock/a.ts'])
  })
})

const manifest = {
  'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_shared.js'] },
  '_shared.js': { file: 'assets/shared.js' },
  '_mockdata.js': { file: 'assets/mockdata.js' },
  'src/pages/A.vue': { file: 'assets/A.js', isDynamicEntry: true, imports: ['_shared.js'] },
  'src/pages/B.vue': { file: 'assets/B.js', isDynamicEntry: true, imports: ['_shared.js', '_mockdata.js'] },
}
const routes = [
  { path: '/a', component: 'src/pages/A.vue' },
  { path: '/b', component: 'src/pages/B.vue' },
]
const clean = {
  'assets/index.js': map('../../src/main.ts'),
  'assets/shared.js': map('../../src/lib/x.ts'),
  'assets/mockdata.js': map('../../src/lib/y.ts'),
  'assets/A.js': map('../../src/pages/A.vue'),
  'assets/B.js': map('../../src/pages/B.vue'),
}

describe('findRoots', () => {
  it('takes the entry and every dynamic entry, labelled with a route where known', () => {
    expect(findRoots(manifest, [{ path: '/a', component: 'src/pages/A.vue' }])).toEqual([
      { key: 'index.html', label: '(entry)', routed: false },
      { key: 'src/pages/A.vue', label: '/a', routed: true },
      { key: 'src/pages/B.vue', label: 'src/pages/B.vue', routed: false },
    ])
  })

  it('skips mock modules as roots', () => {
    const m = { ...manifest, 'src/mock/index.ts': { file: 'assets/mock.js', isDynamicEntry: true } }
    expect(findRoots(m, []).map((r) => r.key)).not.toContain('src/mock/index.ts')
  })
})

describe('audit', () => {
  it('is empty for a clean manifest', () => {
    expect(audit(manifest, clean, routes)).toEqual([])
  })

  it('reports a route whose closure has a mock source (1 line)', () => {
    const maps = { ...clean, 'assets/mockdata.js': map('../../src/modules/m10-teacher-class/mock/data/d.ts') }
    expect(audit(manifest, maps, routes)).toEqual([
      '/b -> assets/mockdata.js -> src/modules/m10-teacher-class/mock/data/d.ts',
    ])
  })

  it('reports an entry-chunk mock source once, for the entry', () => {
    const maps = { ...clean, 'assets/index.js': map('../../src/mock/index.ts') }
    expect(audit(manifest, maps, routes)).toEqual(['(entry) -> assets/index.js -> src/mock/index.ts'])
  })

  it('reports a static mock import from a lazily loaded chunk', () => {
    const m = {
      ...manifest,
      'src/pages/A.vue': { ...manifest['src/pages/A.vue'], dynamicImports: ['src/pages/Lazy.vue'] },
      'src/pages/Lazy.vue': { file: 'assets/Lazy.js', isDynamicEntry: true, imports: ['_mock.js'] },
      '_mock.js': { file: 'assets/mock.js' },
    }
    const maps = { ...clean, 'assets/Lazy.js': map('../../src/pages/Lazy.vue'), 'assets/mock.js': map('../../src/mock/x.ts') }
    expect(audit(m, maps, routes)).toEqual(['src/pages/Lazy.vue -> assets/mock.js -> src/mock/x.ts'])
  })

  it('audits a dynamic entry that has no route', () => {
    const m = { ...manifest, 'src/pages/Orphan.vue': { file: 'assets/Orphan.js', isDynamicEntry: true, imports: ['_mockdata.js'] } }
    const maps = { ...clean, 'assets/mockdata.js': map('../../src/mock/y.ts'), 'assets/Orphan.js': map('../../src/pages/Orphan.vue') }
    // _mockdata.js is also reached by B (route label first in manifest order); drop B's edge to isolate the orphan.
    m['src/pages/B.vue'] = { ...m['src/pages/B.vue'], imports: ['_shared.js'] }
    expect(audit(m, maps, routes)).toEqual(['src/pages/Orphan.vue -> assets/mockdata.js -> src/mock/y.ts'])
  })
})

describe('dynamic mock imports', () => {
  // The entry chunk holds src/app/bootstrap.ts and dynamically imports the mock core, which statically needs a mock leaf.
  const dyn = {
    ...manifest,
    'index.html': { ...manifest['index.html'], dynamicImports: ['src/mock/index.ts'] },
    'src/mock/index.ts': { file: 'assets/mock-core.js', imports: ['_mockleaf.js'] },
    '_mockleaf.js': { file: 'assets/mock-leaf.js' },
    '_other.js': { file: 'assets/other.js' },
  }
  const dynMaps = {
    ...clean,
    'assets/index.js': map('../../src/main.ts', '../../src/app/bootstrap.ts'),
    'assets/mock-core.js': map('../../src/mock/index.ts'),
    'assets/mock-leaf.js': map('../../src/modules/m10-teacher-class/mock/data/d.ts'),
    'assets/other.js': map('../../src/lib/o.ts'),
  }

  it('allows the bootstrap -> @/mock edge and its descendants', () => {
    expect(audit(dyn, dynMaps, routes)).toEqual([])
  })

  it('reports a new dynamic mock import from a non-mock chunk', () => {
    const m = { ...dyn, 'src/pages/A.vue': { ...dyn['src/pages/A.vue'], dynamicImports: ['_mockleaf.js'] } }
    expect(audit(m, dynMaps, routes)).toEqual([
      '/a -> assets/A.js =dyn=> assets/mock-leaf.js (src/modules/m10-teacher-class/mock/data/d.ts)',
    ])
  })

  it('reports the mock chunk when it is also reachable through another importer', () => {
    const m = { ...dyn, '_other.js': { file: 'assets/other.js', dynamicImports: ['src/mock/index.ts'] } }
    m['src/pages/B.vue'] = { ...m['src/pages/B.vue'], imports: ['_shared.js', '_other.js'] }
    expect(audit(m, dynMaps, routes)).toEqual([
      '/b -> assets/other.js =dyn=> assets/mock-core.js (src/mock/index.ts)',
    ])
  })

  it('does not allow the edge from a chunk that is not bootstrap', () => {
    const maps = { ...dynMaps, 'assets/index.js': map('../../src/main.ts') }
    expect(audit(dyn, maps, routes)).toEqual([
      '(entry) -> assets/index.js =dyn=> assets/mock-core.js (src/mock/index.ts)',
    ])
  })
})

describe('cli', () => {
  it('exits 2 when --dist has no value', () => {
    const script = fileURLToPath(new URL('../check-http-build.mjs', import.meta.url))
    const r = spawnSync(process.execPath, [script, '--dist'], { encoding: 'utf8' })
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('--dist needs a directory')
  })
})

describe('collectRoutes', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-http-build-test-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('reads core routes, module routes, fragments and warns on unresolved components', () => {
    const w = (f, text) => {
      mkdirSync(dirname(join(root, f)), { recursive: true })
      writeFileSync(join(root, f), text)
    }
    w('src/app/modules.ts', "import { manifest as m01 } from '@/modules/m01-a'\n")
    w('src/app/router/core-routes.ts', "export const x = [{ path: '/dev', component: () => import('@/dev/G.vue') }]\n")
    w('src/dev/G.vue', '<template/>')
    w(
      'src/modules/m01-a/routes.ts',
      "import frag from './routes/frag'\n// { path: '/commented', component: () => import('./pages/No.vue') }\n" +
        "export default [{ path: '/a', component: () => import('./pages/A.vue'),\n children: [{ path: 'kid', component: () => import('./pages/Kid.vue') }] },\n" +
        "{ path: '/gone', component: () => import('./pages/Missing.vue') }, ...frag]\n",
    )
    w('src/modules/m01-a/routes/frag.ts', "export default [{ path: '/f', component: () => import('../pages/F.vue') }]\n")
    for (const p of ['A', 'Kid', 'F']) w(`src/modules/m01-a/pages/${p}.vue`, '<template/>')

    const { routes, warnings } = collectRoutes(root)
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r.component]))
    expect(byPath).toEqual({
      '/dev': 'src/dev/G.vue',
      '/a': 'src/modules/m01-a/pages/A.vue',
      kid: 'src/modules/m01-a/pages/Kid.vue',
      '/gone': null,
      '/f': 'src/modules/m01-a/pages/F.vue',
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Missing.vue')
  })
})
