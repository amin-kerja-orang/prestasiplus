import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'

const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { responses: Record<string, unknown> }>>; components: { schemas: Record<string, unknown> } }

describe('Studio extras OpenAPI registration (REQ-C-006)', () => {
  it('registers the DSKP picker and the figure link', () => {
    expect(doc.paths['/questions/studio/dskp']?.get).toBeDefined()
    const link = doc.paths['/intake/stimuli/{id}/link-references']?.post
    expect(link).toBeDefined()
    expect(Object.keys(link!.responses)).toEqual(expect.arrayContaining(['200', '401', '403', '404']))
  })

  it('registers StudioFigureLinks', () => {
    expect(doc.components.schemas).toHaveProperty('StudioFigureLinks')
  })
})
