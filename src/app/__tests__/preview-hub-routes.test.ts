import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import type { ModuleManifest } from '../modules'
import { createAppRouter } from '../router'
import { TEST_REGISTRY } from './router-fixtures'

const names = (path: string, registry: readonly ModuleManifest[]) =>
  createAppRouter({ history: createMemoryHistory(), registry })
    .resolve(path)
    .matched.map((r) => r.name)

describe('preview hub routes (D20)', () => {
  it('serve /admin and /dashboard when no module registers them', () => {
    expect(names('/admin', [])).toEqual(['dev.preview-hub-admin'])
    expect(names('/dashboard', [])).toEqual(['dev.preview-hub-user'])
  })

  it('give way to a module route with the same path, without throwing', () => {
    const real = {
      id: 'M99',
      slug: 'm99-real',
      routes: [
        { path: '/admin', name: 'real.admin', component: { render: () => null } },
        { path: '/dashboard', name: 'real.dashboard', component: { render: () => null } },
      ],
    } as unknown as ModuleManifest
    expect(names('/admin', [real])).toEqual(['real.admin'])
    expect(names('/dashboard', [real])).toEqual(['real.dashboard'])
  })

  it('give way to the synthetic registry that already owns both paths', () => {
    expect(names('/admin', TEST_REGISTRY)).not.toContain('dev.preview-hub-admin')
    expect(names('/dashboard', TEST_REGISTRY)).not.toContain('dev.preview-hub-user')
  })
})
