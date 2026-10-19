// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { MasterNoteRow } from '../../api/master-notes'
import MasterNotesPage from '../../pages/MasterNotesPage.vue'

const api = vi.hoisted(() => ({ fetchMasterNotes: vi.fn(), actOnMasterNote: vi.fn() }))
vi.mock('../../api/master-notes', () => api)

function note(id: number, extra: Partial<MasterNoteRow> = {}): MasterNoteRow {
  return {
    id,
    questionId: 129732,
    subjectName: 'Bahasa Inggeris',
    chapter: null,
    model: 'gpt-4o-mini',
    tokens: 1313,
    confidence: 85,
    questionText: 'S'.repeat(250),
    noteText: 'Mungkin anda keliru sebab contoh.',
    trapText: 'Salah faham tentang fokus.',
    flagged: false,
    teacherApproved: false,
    createdAt: '2026-05-01T09:00:00+08:00',
    ...extra,
  }
}

function result(rows: MasterNoteRow[], total = rows.length, tab = 'all') {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 15,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 15)),
      activeTab: tab,
      summary: { flagged: 0, teacherApproved: 0, total: 525 },
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/master-notes?tab=all'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/master-notes', component: MasterNotesPage }],
  })
  await router.push(url)
  wrapper = mount(MasterNotesPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchMasterNotes.mockReset()
  api.actOnMasterNote.mockReset()
  api.fetchMasterNotes.mockResolvedValue(result([note(1), note(2, { chapter: 'Bab 3' })], 525))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('MasterNotesPage (M04 S12)', () => {
  it('renders the summary line (the shell prints the title)', async () => {
    const w = await render()
    expect(w.get('[data-testid=notes-summary]').text()).toBe(
      'Self-healing nota AI: 0 flagged · 0 teacher-approved · 525 total. Review yang flagged untuk improve quality.',
    )
  })

  it('renders the three tabs with the active one as the dark pill', async () => {
    const w = await render()
    const tabs = w.findAll('[data-testid=notes-tabs] a')
    expect(tabs.map((t) => t.text())).toEqual(['Flagged Review', 'Teacher Approved', 'Semua'])
    expect(tabs.map((t) => t.attributes('href'))).toEqual([
      '/admin/master-notes?tab=flagged',
      '/admin/master-notes?tab=approved',
      '/admin/master-notes?tab=all',
    ])
    expect(tabs.map((t) => t.attributes('data-active'))).toEqual(['false', 'false', 'true'])
  })

  it('defaults to the flagged tab and follows the tab the API applied', async () => {
    api.fetchMasterNotes.mockResolvedValue(result([], 0, 'flagged'))
    const w = await render('/admin/master-notes?tab=zzz')
    expect(api.fetchMasterNotes).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'zzz' }))
    expect(w.get('[data-testid=notes-tab-flagged]').attributes('data-active')).toBe('true')
  })

  it('shows the empty message for a tab without notes', async () => {
    api.fetchMasterNotes.mockResolvedValue(result([], 0, 'flagged'))
    const w = await render('/admin/master-notes')
    expect(w.get('[data-testid=notes-empty]').text()).toBe('Tiada nota dalam tab ini.')
  })

  it('renders the meta line, the question cut at 200, the note, the trap and three buttons', async () => {
    const w = await render()
    const rows = w.findAll('[data-testid=note-row]')
    expect(rows).toHaveLength(2)
    const first = rows[0]?.text() ?? ''
    expect(first).toContain('question_id: 129732')
    expect(first).toContain('subject: Bahasa Inggeris')
    expect(first).toContain('chapter: —')
    expect(first).toContain('model: gpt-4o-mini')
    expect(first).toContain('tokens: 1313')
    expect(rows[0]?.get('[data-testid=note-conf]').text()).toBe('conf 85')
    expect(rows[1]?.text()).toContain('chapter: Bab 3')
    const question = rows[0]?.get('[data-testid=note-question]').text() ?? ''
    expect(question).toBe(`Soalan: ${'S'.repeat(200)}...`)
    expect(rows[0]?.get('[data-testid=note-text]').text()).toBe('Mungkin anda keliru sebab contoh.')
    expect(rows[0]?.get('[data-testid=note-trap]').text()).toBe('Trap: Salah faham tentang fokus.')
    expect(rows[0]?.findAll('button').map((b) => b.text())).toEqual([
      'Approve',
      'Regenerate',
      'Clear Flag',
    ])
  })

  it('a click disables the button and shows "...", then "Done" and dims the row on success', async () => {
    let release: (v: { ok: true }) => void = () => undefined
    api.actOnMasterNote.mockReturnValue(new Promise((resolve) => (release = resolve)))
    const confirm = vi.spyOn(window, 'confirm')
    const w = await render()
    const row = w.findAll('[data-testid=note-row]')[0]
    const approve = row?.get('[data-testid=note-approve]')
    await approve?.trigger('click')
    expect(confirm).not.toHaveBeenCalled()
    expect(api.actOnMasterNote).toHaveBeenCalledWith(1, 'approve')
    expect(approve?.text()).toBe('...')
    expect(approve?.attributes('disabled')).toBeDefined()
    release({ ok: true })
    await flushPromises()
    expect(approve?.text()).toBe('Done')
    expect(approve?.attributes('disabled')).toBeDefined()
    expect(row?.attributes('data-dimmed')).toBe('true')
    expect(row?.get('[data-testid=note-regen]').attributes('disabled')).toBeUndefined()
  })

  it('a failure restores the label and re-enables the button, without dimming', async () => {
    api.actOnMasterNote.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    const row = w.findAll('[data-testid=note-row]')[0]
    const regen = row?.get('[data-testid=note-regen]')
    await regen?.trigger('click')
    await flushPromises()
    expect(api.actOnMasterNote).toHaveBeenCalledWith(1, 'regen')
    expect(regen?.text()).toBe('Regenerate')
    expect(regen?.attributes('disabled')).toBeUndefined()
    expect(row?.attributes('data-dimmed')).toBe('false')
  })

  it('the pager keeps the tab in its links', async () => {
    const w = await render()
    const next = w
      .get('[data-testid=notes-pager]')
      .findAll('button')
      .find((b) => b.text() === '2')
    await next?.trigger('click')
    await flushPromises()
    expect(Object.keys(router.currentRoute.value.query)).toEqual(['tab', 'page'])
    expect(router.currentRoute.value.query).toEqual({ page: '2', tab: 'all' })
    expect(api.fetchMasterNotes).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: 'all', page: 2 }),
    )
  })

  it('shows the red box with "Cuba Semula" when the notes cannot load', async () => {
    api.fetchMasterNotes.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(w.get('[data-testid=notes-error]').text()).toContain('Cuba Semula')
    await w.get('[data-testid=notes-retry]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid=note-row]')).toHaveLength(2)
  })
})
