// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SekolahBersaingPage from '../../pages/SekolahBersaingPage.vue'
import routes from '../../routes/sekolah-bersaing'

const api = vi.hoisted(() => ({ fetchSekolahBersaing: vi.fn() }))
vi.mock('../../api', () => api)

type Row = { rank: number; school: string; state: string; accuracy: number; pupils: number }

function row(rank: number, over: Partial<Row> = {}): Row {
  return { rank, school: `Sekolah ${String(rank)}`, state: 'Kelantan', accuracy: 75, pupils: 10, ...over }
}

const SUB = 'Kedudukan sekolah teratas berdasarkan purata ketepatan latihan pelajar.'

let wrapper: VueWrapper | undefined

async function open() {
  wrapper = mount(SekolahBersaingPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

/** `DsDataTable` reads the breakpoint on mount: below 768 px it renders the cards. */
function setPhone(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

const texts = (w: VueWrapper, testid: string) =>
  w.findAll(`[data-testid="${testid}"]`).map((e) => e.text())
const pills = (w: VueWrapper) => w.findAll('[data-testid="sb-accuracy"]')

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchSekolahBersaing.mockResolvedValue([row(1), row(2), row(3), row(4)])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('route (OQ-API-09, FR-X2-4)', () => {
  it('is for the school admin and the admin, 403 for anyone else, in the user shell', () => {
    const r = routes.find((x) => x.path === '/sekolah-bersaing')
    expect(r?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin', 'admin'],
      onForbidden: '403',
      title: 'Sekolah Bersaing — PRESTASIPLUS',
      header: { title: 'Sekolah Bersaing', subtitle: 'Selamat datang kembali' },
    })
  })
})

describe('SekolahBersaingPage (R1-AS-45)', () => {
  it('shows the hero, the label, the caption and the five headers', async () => {
    const w = await open()
    expect(w.get('h1').text()).toBe('Sekolah Bersaing')
    expect(w.text()).toContain(SUB)
    expect(w.get('[data-testid="sb-label"]').text()).toBe('Papan Pemimpin')
    expect(w.get('caption').text()).toBe('Papan Pemimpin')
    expect(w.findAll('thead th').map((d) => d.text())).toEqual([
      '#',
      'Sekolah',
      'Negeri',
      'Ketepatan',
      'Pelajar',
    ])
  })

  it('asks the API once, with no week', async () => {
    await open()
    expect(api.fetchSekolahBersaing).toHaveBeenCalledTimes(1)
    expect(api.fetchSekolahBersaing).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
  })

  it('shows medals for ranks 1 to 3, then the plain number', async () => {
    const w = await open()
    expect(texts(w, 'sb-rank')).toEqual(['🥇', '🥈', '🥉', '4'])
  })

  it('AC-AS-45-1: A rank 1 with a success 80% pill and 5, B rank 2 with a warning 60% pill and 3', async () => {
    api.fetchSekolahBersaing.mockResolvedValue([
      row(1, { school: 'Sekolah A', state: 'Johor', accuracy: 80, pupils: 5 }),
      row(2, { school: 'Sekolah B', state: 'Sabah', accuracy: 60, pupils: 3 }),
    ])
    const w = await open()
    const cells = w.findAll('tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
    expect(cells).toEqual([
      ['🥇', 'Sekolah A', 'Johor', '80%', '5'],
      ['🥈', 'Sekolah B', 'Sabah', '60%', '3'],
    ])
    expect(pills(w)[0]?.classes().join(' ')).toContain('text-success')
    expect(pills(w)[1]?.classes().join(' ')).toContain('text-warning')
  })

  it('AC-AS-45-6: the colour follows the rounded value', async () => {
    api.fetchSekolahBersaing.mockResolvedValue([
      row(1, { accuracy: 70 }),
      row(2, { accuracy: 69.6 }),
      row(3, { accuracy: 69.4 }),
      row(4, { accuracy: 49.5 }),
      row(5, { accuracy: 49 }),
    ])
    const w = await open()
    expect(texts(w, 'sb-accuracy')).toEqual(['70%', '70%', '69%', '50%', '49%'])
    const colour = (i: number) => pills(w)[i]?.classes().join(' ')
    expect(colour(0)).toContain('text-success')
    expect(colour(1)).toContain('text-success')
    expect(colour(2)).toContain('text-warning')
    expect(colour(3)).toContain('text-warning')
    expect(colour(4)).toContain('text-error')
  })

  it('shows the pupils as a count with thousands separators', async () => {
    api.fetchSekolahBersaing.mockResolvedValue([row(1, { pupils: 1234 })])
    const w = await open()
    expect(texts(w, 'sb-pupils')).toEqual(['1,234'])
  })

  it('AC-AS-45-2: an empty board shows both exact lines and no table', async () => {
    api.fetchSekolahBersaing.mockResolvedValue([])
    const w = await open()
    expect(w.get('h1').text()).toBe('Sekolah Bersaing')
    const empty = w.get('[data-testid="sb-empty"]')
    expect(empty.text()).toContain('Belum ada data')
    expect(empty.text()).toContain('Tiada rekod latihan sekolah lagi.')
    expect(w.find('[data-testid="sb-table"]').exists()).toBe(false)
  })

  it('shows the skeleton while loading', async () => {
    api.fetchSekolahBersaing.mockReturnValue(new Promise(() => undefined))
    const w = await open()
    expect(w.find('[data-testid="sb-loading"]').exists()).toBe(true)
    expect(w.find('[data-testid="sb-table"]').exists()).toBe(false)
  })

  it('shows the load error with a working retry', async () => {
    api.fetchSekolahBersaing.mockRejectedValueOnce(new Error('boom'))
    const w = await open()
    expect(w.find('[data-testid="m16-load-error"]').exists()).toBe(true)
    await w.get('[data-testid="m16-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="sb-row"]')).toHaveLength(4)
  })

  it('has no week line, footer tip or old column', async () => {
    const w = await open()
    for (const gone of ['sb-week', 'sb-week-date', 'sb-count', 'sb-tip']) {
      expect(w.find(`[data-testid="${gone}"]`).exists(), gone).toBe(false)
    }
    for (const gone of ['Minggu', '% Aktif', 'Streak Avg', 'Nota/Pelajar', 'Sekolah anonim']) {
      expect(w.text(), gone).not.toContain(gone)
    }
  })
})

describe('cards below 768 px (FR-AS-45-5)', () => {
  it('each card shows every field, with the same pill', async () => {
    setPhone()
    api.fetchSekolahBersaing.mockResolvedValue([
      row(1, { school: 'Sekolah A', state: 'Johor', accuracy: 80, pupils: 5 }),
      row(4, { school: 'Sekolah B', state: 'Sabah', accuracy: 60, pupils: 3 }),
    ])
    const w = await open()
    expect(w.find('table').exists()).toBe(false)
    expect(w.findAll('[data-testid="sb-row"]')).toHaveLength(2)
    expect(texts(w, 'sb-rank')).toEqual(['🥇', '4'])
    expect(texts(w, 'sb-school')).toEqual(['Sekolah A', 'Sekolah B'])
    expect(texts(w, 'sb-state')).toEqual(['Johor', 'Sabah'])
    expect(texts(w, 'sb-accuracy')).toEqual(['80%', '60%'])
    expect(texts(w, 'sb-pupils')).toEqual(['5', '3'])
    expect(pills(w)[0]?.classes().join(' ')).toContain('text-success')
    expect(pills(w)[1]?.classes().join(' ')).toContain('text-warning')
    expect(w.findAll('dt').map((d) => d.text())).toEqual([
      'Negeri',
      'Ketepatan',
      'Pelajar',
      'Negeri',
      'Ketepatan',
      'Pelajar',
    ])
  })

  it('no card text uses the 13 px caption role', async () => {
    setPhone()
    const w = await open()
    const table = w.get('[data-testid="sb-table"]')
    expect(table.findAll('.text-caption')).toHaveLength(0)
    expect(table.findAll('dt').every((d) => d.classes().includes('text-body'))).toBe(true)
  })
})
