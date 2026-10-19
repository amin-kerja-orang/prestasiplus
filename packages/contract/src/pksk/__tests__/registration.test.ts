import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'

// BE-42: the student and admin halves are part of the global OpenAPI document.
describe('BE-42 registration in buildOpenApiDocument()', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }

  const ops: Array<[string, string]> = [
    ['/pksk/me/access', 'get'],
    ['/pksk-domains', 'get'],
    ['/pksk/levels/{level}/dashboard', 'get'],
    ['/pksk/levels/{level}/domains', 'get'],
    ['/pksk/levels/{level}/domains/{code}', 'get'],
    ['/pksk/levels/{level}/exam-attempts', 'get'],
    ['/pksk/levels/{level}/exam-attempts', 'post'],
    ['/pksk/levels/{level}/domains/{code}/practice-sessions', 'post'],
    ['/pksk/levels/{level}/exam', 'get'],
    ['/admin/pksk-questions', 'get'],
    ['/admin/pksk-questions', 'post'],
    ['/admin/pksk-questions/stats', 'get'],
    ['/admin/pksk-questions/bulk', 'post'],
    ['/admin/pksk-questions/{id}', 'get'],
    ['/admin/pksk-questions/{id}', 'put'],
    ['/admin/pksk-questions/{id}', 'delete'],
    ['/admin/pksk-access', 'get'],
    ['/admin/pksk-access', 'post'],
    ['/admin/pksk-access/stats', 'get'],
    ['/admin/pksk-access/{id}/revoke', 'post'],
    ['/pksk-packages', 'get'],
  ]

  it.each(ops)('has %s %s', (path, method) => {
    expect(doc.paths[path]?.[method]).toBeDefined()
  })

  it('has the shared, student and admin components', () => {
    for (const name of ['PkskLevel', 'PkskDomain', 'PkskDashboard', 'PkskExam', 'PkskAdminQuestionDetail', 'PkskAdminAccessItem', 'PkskPackage']) {
      expect(doc.components.schemas[name]).toBeDefined()
    }
  })
})
