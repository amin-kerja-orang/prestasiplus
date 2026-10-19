import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'

// BE-22: both halves are part of the global OpenAPI document.
describe('BE-22 registration in buildOpenApiDocument()', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }

  const paths = [
    '/admin/command-center/live-data',
    '/command-center/daily-activity',
    '/command-center/daily-activity/school/{id}',
    '/command-center/school/{id}',
    '/command-center/school/{sid}/teacher/{uid}',
    '/command-center/classroom/{id}',
    '/command-center/headcount/{configId}',
    '/command-center/student/{id}',
    '/command-center/student/{id}/subject',
    '/command-center/student/{id}/week',
    '/command-center/session/{sessionId}',
    '/admin/server-status',
    '/guru/command-center/live-data',
    '/guru/command-center/drill',
    '/guru/command-center/evaluate',
    '/guru/command-center/predictive',
    '/guru/command-center/achievements',
    '/guru/command-center/badge-holders',
  ]

  it.each(paths)('has GET %s', (path) => {
    expect(doc.paths[path]?.get).toBeDefined()
  })

  it('has the admin and teacher components', () => {
    for (const name of ['CommandCenterLiveData', 'CommandCenterDailyActivity', 'ServerStatus', 'CommandCenterGuruLiveData', 'CommandCenterGuruBadgeHolders']) {
      expect(doc.components.schemas[name]).toBeDefined()
    }
  })
})
