import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { GURU_STRUCTURED_ROUTES } from '@/modules/m04-question-bank'

import routes from '../routes/soalan'

/**
 * S6-T17 (R1-GUR-44b): the REAL M10 soalan route records (not a hand-built router). The detail route takes a numeric
 * id (an approved question) or a `g{n}` id (an own submission, API-GUR-26) and hands the page the right prop.
 */
const router = createRouter({ history: createMemoryHistory(), routes })

function detailProps(path: string): Record<string, unknown> | null {
  const resolved = router.resolve(path)
  const hit = resolved.matched.find((r) => r.name === GURU_STRUCTURED_ROUTES.detail)
  if (!hit) return null
  const props = hit.props.default
  if (typeof props !== 'function') return props as Record<string, unknown>
  return props(resolved as unknown as RouteLocationNormalized) as Record<string, unknown>
}

describe('guru structured detail route', () => {
  it('resolves a numeric id to the detail page with a number prop', () => {
    expect(detailProps('/guru/soalan-berstruktur/34')).toEqual({ id: 34, portal: 'guru' })
  })

  it('resolves a g-id to the detail page with the id kept as a string', () => {
    expect(detailProps('/guru/soalan-berstruktur/g12')).toEqual({ id: 'g12', portal: 'guru' })
  })

  it('does not resolve a non-id segment to the detail page', () => {
    expect(detailProps('/guru/soalan-berstruktur/abc')).toBeNull()
  })
})
