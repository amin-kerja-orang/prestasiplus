import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import {
  audit,
  collectRoutes,
  dynamicMockImports,
  MOCK_MODULE_RE,
  mockSourcesOf,
  routeChunkClosure,
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
  'src/pages/A.vue': { file: 'assets/A.js', imports: ['_shared.js'] },
  'src/pages/B.vue': { file: 'assets/B.js', imports: ['_shared.js', '_mockdata.js'] },
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

describe('routeChunkClosure', () => {
  it('includes static imports and the entry closure', () => {
    expect([...routeChunkClosure(manifest, 'src/pages/B.vue')].sort()).toEqual(
      ['_mockdata.js', '_shared.js', 'index.html', 'src/pages/B.vue'].sort(),
    )
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

  it('lists dynamic imports of mock chunks separately', () => {
    const m = { ...manifest, 'index.html': { ...manifest['index.html'], dynamicImports: ['_mockdata.js'] } }
    const maps = { ...clean, 'assets/mockdata.js': map('../../src/mock/a.ts') }
    expect(dynamicMockImports(m, maps)).toEqual([
      'assets/index.js => dynamic import => assets/mockdata.js (src/mock/a.ts)',
    ])
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
