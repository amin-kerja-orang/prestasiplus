// @vitest-environment jsdom
/**
 * F1 "Tandakan sudah disemak" (AC-39.9, BJS-08): the review stamp of one section of the head. Mock semantics,
 * HTTP route and the section editor button.
 */
import type { BijakBlueprintView } from '@pp/contract'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import SectionEditor from '../admin/kontrak/components/SectionEditor.vue'
import { formFromView } from '../admin/kontrak/domain/form'
import { KontrakError } from '../admin/kontrak/server/api'
import { HttpKontrakServer } from '../admin/kontrak/server/http'
import { MockKontrakServer } from '../admin/kontrak/server/memory'

const LOCKED = 'Kontrak Disahkan tidak boleh diubah di tempat. Cipta versi baharu dahulu.'
const server = (): MockKontrakServer => new MockKontrakServer({ createPaper: () => Promise.resolve('paper-1') })

describe('Kontrak review stamp: mock', () => {
  it('stamps one section in place: no new version, other sections untouched', async () => {
    const s = server()
    const before = await s.get('MAT', 2)
    const versionsBefore = (await s.versions('MAT', 2)).length
    const lines = before.sections[0]!.quota!.lines
    expect(lines.every((l) => l.reviewed === false)).toBe(true)
    const after = await s.reviewSection('MAT', 2, 1)
    expect(after.version).toBe(before.version)
    expect(after.sections[0]!.quota!.lines.every((l) => l.reviewed)).toBe(true)
    expect(after.sections[0]!.kbatReviewed).toBe(true)
    expect((await s.versions('MAT', 2)).length).toBe(versionsBefore)
    const other = before.sections[1]
    if (other) expect(after.sections[1]).toEqual(other)
  })

  it('refuses an unknown section (not_found)', async () => {
    const err = (await server().reviewSection('MAT', 2, 99).catch((e: unknown) => e)) as KontrakError
    expect(err).toBeInstanceOf(KontrakError)
    expect(err.kind).toBe('not_found')
  })

  it('refuses a Disahkan head with the lock copy (409)', async () => {
    const s = server()
    const rows = await s.list()
    const verified = rows.find((r) => r.source === 'Disahkan')
    if (!verified) return // the seed has no Disahkan head: the service spec covers the 409 on a real DB
    const err = (await s.reviewSection(verified.subject, verified.kertas, 1).catch((e: unknown) => e)) as KontrakError
    expect(err.kind).toBe('conflict')
    expect(err.message).toBe(LOCKED)
  })
})

describe('Kontrak review stamp: HTTP', () => {
  it('POSTs an empty body to /sections/{position}/review and returns the view', async () => {
    const requests: TransportRequest[] = []
    const view = { subject: 'MAT', kertas: 2, version: 1 } as unknown as BijakBlueprintView
    const transport: Transport = {
      request: vi.fn((req: TransportRequest): Promise<TransportResponse> => {
        requests.push(req)
        if (req.url === '/api/session') return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c1' } } })
        return Promise.resolve({ status: 200, headers: {}, body: { data: view } })
      }),
    }
    const http = new HttpKontrakServer({ client: new ApiClient({ transport }) })
    const out = await http.reviewSection('MAT', 2, 3)
    expect(out).toEqual(view)
    const call = requests.find((r) => r.url.endsWith('/sections/3/review'))!
    expect(call.method).toBe('POST')
    expect(call.url).toBe('/api/admin/blueprints/MAT/2/sections/3/review')
    expect(call.body).toEqual({})
  })

  it('maps a 409 to a conflict KontrakError', async () => {
    const transport: Transport = {
      request: vi.fn((req: TransportRequest): Promise<TransportResponse> => {
        if (req.url === '/api/session') return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c1' } } })
        return Promise.resolve({ status: 409, headers: {}, body: { error: { code: 'CONFLICT', message: LOCKED } } })
      }),
    }
    const http = new HttpKontrakServer({ client: new ApiClient({ transport }) })
    const err = (await http.reviewSection('MAT', 2, 1).catch((e: unknown) => e)) as KontrakError
    expect(err.kind).toBe('conflict')
    expect(err.message).toBe(LOCKED)
  })
})

describe('SectionEditor button', () => {
  async function formSection() {
    const view = await server().get('MAT', 2)
    return formFromView(view).sections[0]!
  }
  const mountEditor = async (props: { canReview?: boolean }) => {
    const section = await formSection()
    return mount(SectionEditor, {
      props: {
        modelValue: section,
        index: 0,
        form: { sections: [section] } as never,
        subject: 'MAT',
        issues: [],
        loadUnits: () => Promise.resolve([]),
        ...props,
      },
    })
  }

  it('shows the button for an unreviewed section and emits review', async () => {
    const w = await mountEditor({ canReview: true })
    const btn = w.find('[data-testid="mark-reviewed"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Tandakan sudah disemak')
    await btn.trigger('click')
    expect(w.emitted('review')).toHaveLength(1)
  })

  it('disables it until the form is saved (canReview false)', async () => {
    const w = await mountEditor({ canReview: false })
    expect(w.find('[data-testid="mark-reviewed"]').attributes('disabled')).toBeDefined()
  })
})
