// @vitest-environment jsdom
/**
 * M22 S1 and S2 component tests against a mocked client (SRS M22 v1.1 FR-M22-05…23, 28…37, 44…47; AC-M22-01…09,
 * 12): exact BM copy, tabs, empty and error states, the create flow, plain-text rendering, admin queue and detail.
 */
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { QueueList, Ticket, TicketList } from '../../api/types'
import AdminTicketsPage from '../../pages/AdminTicketsPage.vue'
import TicketsPage from '../../pages/TicketsPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({
  fetchTickets: vi.fn(),
  createTicket: vi.fn(),
  fetchQueue: vi.fn(),
  fetchTicketDetail: vi.fn(),
  setTicketStatus: vi.fn(),
  replyToTicket: vi.fn(),
}))
vi.mock('../../api/tickets', () => api)

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  subject: 'Tidak dapat log masuk ke akaun',
  body: 'Saya cuba log masuk.',
  status: 'dibuka',
  statusLabel: 'Dibuka',
  adminReply: null,
  createdAt: '2026-09-24T10:12:00+08:00',
  ...over,
})
const list = (data: Ticket[], total = data.length): TicketList => ({ data, meta: { total } })

async function open(path: string, comp: object): Promise<{ w: VueWrapper; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(comp, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

const tid = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
/** The create dialog is teleported to `body`. */
const dlg = (id: string) => {
  const el = document.body.querySelector(`[data-testid="${id}"]`)
  return new DOMWrapper(el)
}
const dlgOpen = () => document.body.querySelector('[data-testid="tk-form"]') !== null

beforeEach(() => {
  document.body.innerHTML = ''
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  for (const f of Object.values(api)) f.mockReset()
})

describe('routes (FR-M22-01, 28, 36, 27)', () => {
  it('S1 user shell for every role; S2 admin shell, admin only; no other ticket route', () => {
    const s1 = routes.find((r) => r.path === '/pusat-tuisyen/tiket')
    expect(s1?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      title: 'Tiket Bantuan - PRESTASIPLUS',
      header: { title: 'Tiket Bantuan', subtitle: 'Senarai aduan dan permintaan anda' },
    })
    expect(s1?.meta?.roles).toBeUndefined()
    const s2 = routes.find((r) => r.path === '/admin/tiket')
    expect(s2?.meta).toMatchObject({
      layout: 'admin',
      roles: ['admin'],
      title: 'Tiket Sokongan - PRESTASIPLUS',
    })
    expect(routes.map((r) => r.path).sort()).toEqual(['/admin/tiket', '/pusat-tuisyen/tiket'])
  })
})

describe('S1 list (AC-M22-01, 02, 03, 05)', () => {
  it('renders count, tabs, cards with em dash title, badge, relative time, no link', async () => {
    api.fetchTickets.mockResolvedValue(
      list([
        ticket({
          id: 6,
          status: 'selesai',
          statusLabel: 'Selesai',
          adminReply: 'Baris 1\nBaris 2',
        }),
        ticket(),
      ]),
    )
    const { w } = await open('/pusat-tuisyen/tiket', TicketsPage)
    expect(tid(w, 'tk-total').text()).toBe('Jumlah tiket: 2')
    const tabs = w.findAll('[data-testid="tk-tabs"] a')
    expect(tabs.map((a) => a.text())).toEqual([
      'Semua',
      'Dibuka',
      'Dalam Proses',
      'Menunggu Balas',
      'Selesai',
      'Ditutup',
    ])
    expect(tabs.map((a) => a.attributes('href'))).toEqual([
      '/pusat-tuisyen/tiket',
      '/pusat-tuisyen/tiket?status=dibuka',
      '/pusat-tuisyen/tiket?status=dalam_proses',
      '/pusat-tuisyen/tiket?status=menunggu_balas',
      '/pusat-tuisyen/tiket?status=selesai',
      '/pusat-tuisyen/tiket?status=ditutup',
    ])
    expect(tabs[0]?.attributes('data-active')).toBe('true')
    const cards = w.findAll('[data-testid="tk-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[1]?.find('h3').text()).toBe('#1 — Tidak dapat log masuk ke akaun')
    expect(cards[1]?.find('[data-testid="tk-time"]').text()).toBe('1 hari yang lepas')
    // Status = tone + icon + word: Dibuka is info, Selesai is success.
    expect(cards[1]?.find('[data-testid="tk-badge"]').text()).toBe('Dibuka')
    expect(cards[1]?.find('[data-testid="tk-badge"]').classes().join(' ')).toContain('info')
    expect(cards[0]?.find('[data-testid="tk-badge"]').text()).toBe('Selesai')
    expect(cards[0]?.find('[data-testid="tk-badge"]').classes().join(' ')).toContain('success')
    expect(cards[1]?.find('a').exists()).toBe(false)
    expect(cards[1]?.find('[data-testid="tk-reply"]').exists()).toBe(false)
    const reply = cards[0]?.find('[data-testid="tk-reply"]')
    expect(reply?.text()).toContain('Balasan Sokongan')
    expect(reply?.find('p.whitespace-pre-line').text()).toBe('Baris 1\nBaris 2')
    expect(tid(w, 'tk-body').classes()).toContain('line-clamp-2')
  })

  it('passes a known status, treats an unknown one as no filter', async () => {
    api.fetchTickets.mockResolvedValue(list([], 3))
    const a = await open('/pusat-tuisyen/tiket?status=selesai', TicketsPage)
    expect(api.fetchTickets.mock.calls[0]?.[0].status).toBe('selesai')
    expect(a.w.findAll('[data-testid="tk-tabs"] a')[4]?.attributes('data-active')).toBe('true')
    expect(tid(a.w, 'tk-total').text()).toBe('Jumlah tiket: 3')
    api.fetchTickets.mockClear()
    const b = await open('/pusat-tuisyen/tiket?status=xyz', TicketsPage)
    expect(api.fetchTickets.mock.calls[0]?.[0].status).toBeNull()
    expect(b.w.findAll('[data-testid="tk-tabs"] a')[0]?.attributes('data-active')).toBe('true')
  })

  it('shows the empty card; "Buat Tiket Pertama" opens the form dialog', async () => {
    api.fetchTickets.mockResolvedValue(list([]))
    const { w } = await open('/pusat-tuisyen/tiket', TicketsPage)
    expect(tid(w, 'tk-empty').text()).toContain('Tiada tiket lagi.')
    expect(dlgOpen()).toBe(false)
    await tid(w, 'tk-first').trigger('click')
    await flushPromises()
    expect(dlgOpen()).toBe(true)
  })

  it('shows the error with a retry that reloads', async () => {
    api.fetchTickets.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }),
    )
    api.fetchTickets.mockResolvedValue(list([ticket()]))
    const { w } = await open('/pusat-tuisyen/tiket', TicketsPage)
    expect(tid(w, 'tk-error').text()).toContain('Ralat pelayan.')
    await tid(w, 'tk-retry').trigger('click')
    await flushPromises()
    expect(tid(w, 'tk-card').exists()).toBe(true)
  })

  it('renders user text as plain text (FR-M22-47)', async () => {
    api.fetchTickets.mockResolvedValue(list([ticket({ subject: '<b>x</b> & "y"' })]))
    const { w } = await open('/pusat-tuisyen/tiket', TicketsPage)
    expect(w.find('[data-testid="tk-card"] h3').text()).toContain('<b>x</b> & "y"')
    expect(w.find('[data-testid="tk-card"] h3 b').exists()).toBe(false)
  })
})

describe('S1 create form (AC-M22-04)', () => {
  it('has the exact anatomy and toggles with the button', async () => {
    api.fetchTickets.mockResolvedValue(list([]))
    const { w } = await open('/pusat-tuisyen/tiket', TicketsPage)
    expect(dlgOpen()).toBe(false)
    await tid(w, 'tk-new').trigger('click')
    await flushPromises()
    expect(dlgOpen()).toBe(true)
    const form = dlg('tk-form')
    expect(form.findAll('label').map((l) => l.text())).toEqual(['Subjek', 'Butiran'])
    expect(document.body.textContent).toContain('Tiket Baru')
    const subject = form.get('input')
    expect(subject.attributes('placeholder')).toBe('Ringkasan masalah atau permintaan anda')
    expect(subject.attributes('required')).toBeDefined()
    expect(subject.attributes('maxlength')).toBe('255')
    const body = form.get('textarea')
    expect(body.attributes('rows')).toBe('5')
    expect(body.attributes('maxlength')).toBe('5000')
    expect(body.attributes('placeholder')).toBe('Terangkan masalah anda dengan terperinci...')
    expect(dlg('tk-submit').text()).toBe('Hantar Tiket')
    expect(dlg('tk-cancel').text()).toBe('Batal')
    await dlg('tk-cancel').trigger('click')
    await flushPromises()
    expect(dlgOpen()).toBe(false)
  })

  it('on success: closes the form, leaves the status filter, shows the banner once', async () => {
    api.fetchTickets.mockResolvedValue(list([]))
    api.createTicket.mockResolvedValue(ticket({ id: 3 }))
    const { w, router } = await open('/pusat-tuisyen/tiket?status=selesai', TicketsPage)
    await tid(w, 'tk-new').trigger('click')
    await flushPromises()
    await dlg('tk-subject').setValue('Ujian tiket')
    await dlg('tk-body-input').setValue('Butiran')
    await dlg('tk-form').trigger('submit')
    await flushPromises()
    expect(api.createTicket).toHaveBeenCalledWith({ subject: 'Ujian tiket', body: 'Butiran' })
    expect(router.currentRoute.value.fullPath).toBe('/pusat-tuisyen/tiket')
    expect(tid(w, 'tk-flash').text()).toContain(
      'Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.',
    )
    expect(dlgOpen()).toBe(false)
    await router.push('/pusat-tuisyen/tiket?status=dibuka')
    await flushPromises()
    expect(tid(w, 'tk-flash').exists()).toBe(false)
  })

  it('on 422: stays open, keeps the values, shows the first message only', async () => {
    api.fetchTickets.mockResolvedValue(list([]))
    api.createTicket.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Subjek diperlukan.',
        fields: { subject: 'Subjek diperlukan.', body: 'Butiran diperlukan.' },
      }),
    )
    const { w } = await open('/pusat-tuisyen/tiket', TicketsPage)
    await tid(w, 'tk-new').trigger('click')
    await flushPromises()
    await dlg('tk-body-input').setValue('Isi')
    await dlg('tk-form').trigger('submit')
    await flushPromises()
    expect(dlgOpen()).toBe(true)
    expect(dlg('tk-form-error').text()).toBe('Subjek diperlukan.')
    expect((dlg('tk-body-input').element as HTMLTextAreaElement).value).toBe('Isi')
    expect(tid(w, 'tk-flash').exists()).toBe(false)
  })
})

const queue = (over: Partial<QueueList> = {}): QueueList => ({
  data: [
    {
      id: 2,
      createdAt: '2026-09-25T09:30:00+08:00',
      userName: 'Pelajar Maju Demo',
      subject: 'Soalan kuiz tidak dipaparkan',
      status: 'dibuka',
      replied: false,
      roleLabel: 'Murid',
      school: 'SMK Demo',
    },
    {
      id: 6,
      createdAt: '2026-09-24T10:12:00+08:00',
      userName: null,
      subject: 'Kata laluan',
      status: 'selesai',
      replied: true,
      roleLabel: null,
      school: null,
    },
  ],
  meta: {
    total: 3,
    counts: [
      { status: 'dibuka', count: 2 },
      { status: 'dalam_proses', count: 0 },
      { status: 'menunggu_balas', count: 0 },
      { status: 'selesai', count: 1 },
      { status: 'ditutup', count: 0 },
    ],
    page: 1,
    perPage: 25,
    matched: 2,
  },
  ...over,
})

describe('S2 admin queue (AC-M22-07, 08, 09)', () => {
  it('heading, all five chips with counts and labels, columns, cells', async () => {
    api.fetchQueue.mockResolvedValue(queue())
    const { w } = await open('/admin/tiket', AdminTicketsPage)
    expect(w.get('h1').text()).toBe('Tiket Sokongan')
    expect(w.text()).toContain('Permohonan bantuan daripada pengguna.')
    const chips = w.findAll('[data-testid="tq-chips"] a')
    expect(chips.map((c) => c.text())).toEqual([
      'Semua (3)',
      'Dibuka (2)',
      'Dalam Proses (0)',
      'Menunggu Balas (0)',
      'Selesai (1)',
      'Ditutup (0)',
    ])
    expect(chips.map((c) => c.attributes('href'))).toEqual([
      '/admin/tiket',
      '/admin/tiket?status=dibuka',
      '/admin/tiket?status=dalam_proses',
      '/admin/tiket?status=menunggu_balas',
      '/admin/tiket?status=selesai',
      '/admin/tiket?status=ditutup',
    ])
    expect(chips[0]?.attributes('data-active')).toBe('true')
    expect(chips[1]?.attributes('data-active')).toBe('false')
    expect(w.findAll('th').map((t) => t.text())).toEqual([
      'Tarikh',
      'Pengguna',
      'Peranan',
      'Sekolah',
      'Subjek',
      'Status',
      'Dibalas',
    ])
    const cells = w
      .findAll('tbody tr')[0]
      ?.findAll('td')
      .map((c) => c.text())
    expect(cells).toEqual([
      '2026-09-25 09:30:00',
      'Pelajar Maju Demo',
      'Murid',
      'SMK Demo',
      'Soalan kuiz tidak dipaparkan',
      'Dibuka',
      '—',
    ])
    const second = w
      .findAll('tbody tr')[1]
      ?.findAll('td')
      .map((c) => c.text())
    expect(second?.[1]).toBe('—')
    expect(second?.[2]).toBe('—')
    expect(second?.[3]).toBe('—')
    expect(second?.[6]).toBe('Ya')
    expect(w.find('tbody a, tbody button, tbody input').exists()).toBe(false)
  })

  it('asks for the page in the URL, and the pager keeps the status filter', async () => {
    api.fetchQueue.mockResolvedValue(
      queue({ meta: { ...queue().meta, page: 2, matched: 60 } }),
    )
    const { w, router } = await open('/admin/tiket?status=dibuka&page=2', AdminTicketsPage)
    expect(api.fetchQueue.mock.calls[0]?.[0]).toMatchObject({ status: 'dibuka', page: 2 })
    const table = w.findComponent({ name: 'DsDataTable' })
    expect(table.props()).toMatchObject({ total: 60, page: 2, pageSize: 25 })
    table.vm.$emit('update:page', 3)
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/tiket?status=dibuka&page=3')
  })

  it('the role filter asks for the role, lists 30 P20-02, and chips keep it', async () => {
    api.fetchQueue.mockResolvedValue(queue())
    const { w, router } = await open('/admin/tiket?role=teacher&page=3', AdminTicketsPage)
    expect(api.fetchQueue.mock.calls[0]?.[0]).toMatchObject({ role: 'teacher', page: 3 })
    const select = tid(w, 'tq-role')
    expect(Array.from((select.element as HTMLSelectElement).options).map((o) => o.text)).toEqual([
      'Semua Peranan',
      'Pelajar',
      'Guru',
      'Admin Sekolah',
    ])
    expect(w.findAll('[data-testid="tq-chips"] a')[1]?.attributes('href')).toBe(
      '/admin/tiket?status=dibuka&role=teacher',
    )
    await select.setValue('student')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/tiket?role=student')
    await select.setValue('')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/tiket')
  })

  describe('detail (FR-ADM-P2-20.2)', () => {
    const detail = {
      id: 7,
      subject: 'Soalan kuiz tidak dipaparkan',
      body: 'Skrin kosong.',
      status: 'dibuka',
      roleLabel: null,
      school: null,
      createdAt: '2026-09-25T09:30:00+08:00',
      adminReply: null,
      repliedAt: null,
    }
    const body = (id: string) => document.body.querySelector(`[data-testid="${id}"]`)
    const openRow = async (w: VueWrapper) => {
      await w.findAll('tbody tr')[0]?.trigger('click')
      await flushPromises()
    }
    const pick = async (value: string) => {
      const select = new DOMWrapper(body('tq-detail-status') as HTMLSelectElement)
      await select.setValue(value)
      await flushPromises()
    }

    it('a row opens the subject, the body and the status select', async () => {
      api.fetchQueue.mockResolvedValue(queue())
      api.fetchTicketDetail.mockResolvedValue(detail)
      const { w } = await open('/admin/tiket', AdminTicketsPage)
      await openRow(w)
      expect(api.fetchTicketDetail.mock.calls[0]?.[0]).toBe(queue().data[0]?.id)
      expect(body('def-subject')?.textContent).toContain(detail.subject)
      expect(body('def-subject')?.textContent).toContain('Subjek')
      expect(body('def-body')?.textContent).toContain('Butiran')
      expect(body('def-body')?.querySelector('textarea')?.value).toBe(detail.body)
      expect(body('def-reply')).toBeNull()
      expect(body('def-role')?.textContent).toContain('Peranan')
      expect(body('def-school')?.textContent).toContain('Sekolah')
      expect((body('tq-detail-status') as HTMLSelectElement).value).toBe('dibuka')
      expect(Array.from((body('tq-detail-status') as HTMLSelectElement).options).map((o) => o.text)).toEqual([
        'Dibuka',
        'Dalam Proses',
        'Menunggu Balas',
        'Selesai',
        'Ditutup',
      ])
    })

    it('choosing a status saves it, shows the flash and reloads the list', async () => {
      api.fetchQueue.mockResolvedValue(queue())
      api.fetchTicketDetail.mockResolvedValue(detail)
      api.setTicketStatus.mockResolvedValue({ ...detail, status: 'selesai' })
      const { w } = await open('/admin/tiket', AdminTicketsPage)
      await openRow(w)
      await pick('selesai')
      expect(api.setTicketStatus).toHaveBeenCalledWith(detail.id, 'selesai')
      expect(body('tq-detail-flash')?.textContent).toContain('Status dikemas kini.')
      expect(api.fetchQueue).toHaveBeenCalledTimes(2)
    })

    it('a refused save shows the message and keeps the status', async () => {
      api.fetchQueue.mockResolvedValue(queue())
      api.fetchTicketDetail.mockResolvedValue(detail)
      api.setTicketStatus.mockRejectedValue(
        new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai. Ia mungkin telah dipadam.' }),
      )
      const { w } = await open('/admin/tiket', AdminTicketsPage)
      await openRow(w)
      await pick('selesai')
      expect(document.body.textContent).toContain('Rekod tidak dijumpai. Ia mungkin telah dipadam.')
      expect(body('tq-detail-flash')).toBeNull()
      expect(api.fetchQueue).toHaveBeenCalledTimes(1)
    })

    const replyBox = () => body('tq-reply-text') as HTMLTextAreaElement | null

    it('the reply box holds the saved reply; a save sends the text, shows the flash and keeps the status', async () => {
      api.fetchQueue.mockResolvedValue(queue())
      api.fetchTicketDetail.mockResolvedValue({ ...detail, adminReply: 'Lama.' })
      api.replyToTicket.mockResolvedValue({ ...detail, adminReply: 'Baharu.', repliedAt: detail.createdAt })
      const { w } = await open('/admin/tiket', AdminTicketsPage)
      await openRow(w)
      expect(replyBox()?.value).toBe('Lama.')
      await new DOMWrapper(replyBox()).setValue('Baharu.')
      await new DOMWrapper(body('tq-reply-form') as HTMLFormElement).trigger('submit')
      await flushPromises()
      expect(api.replyToTicket).toHaveBeenCalledWith(detail.id, 'Baharu.')
      expect(api.setTicketStatus).not.toHaveBeenCalled()
      expect(body('tq-reply-flash')?.textContent).toContain('Balasan disimpan.')
      expect(replyBox()?.value).toBe('Baharu.')
      expect(api.fetchQueue).toHaveBeenCalledTimes(2)
    })

    it('a refused reply shows the field message and no flash', async () => {
      api.fetchQueue.mockResolvedValue(queue())
      api.fetchTicketDetail.mockResolvedValue(detail)
      api.replyToTicket.mockRejectedValue(
        new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Sila tulis balasan.', fields: { text: 'Sila tulis balasan.' } }),
      )
      const { w } = await open('/admin/tiket', AdminTicketsPage)
      await openRow(w)
      await new DOMWrapper(body('tq-reply-form') as HTMLFormElement).trigger('submit')
      await flushPromises()
      expect(document.body.textContent).toContain('Sila tulis balasan.')
      expect(body('tq-reply-flash')).toBeNull()
    })

    it.each(['selesai', 'ditutup'])('%s hides the reply box and shows a saved reply as text', async (status) => {
      api.fetchQueue.mockResolvedValue(queue())
      api.fetchTicketDetail.mockResolvedValue({ ...detail, status, adminReply: 'Lama.' })
      const { w } = await open('/admin/tiket', AdminTicketsPage)
      await openRow(w)
      expect(body('tq-reply-form')).toBeNull()
      expect(body('def-reply')?.querySelector('textarea')?.value).toBe('Lama.')
    })

    it('a failed load shows its message', async () => {
      api.fetchQueue.mockResolvedValue(queue())
      api.fetchTicketDetail.mockRejectedValue(
        new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai. Ia mungkin telah dipadam.' }),
      )
      const { w } = await open('/admin/tiket', AdminTicketsPage)
      await openRow(w)
      expect(document.body.textContent).toContain('Rekod tidak dijumpai.')
    })
  })

  it('empty states for no tickets and for a filter', async () => {
    api.fetchQueue.mockResolvedValue(
      queue({ data: [], meta: { ...queue().meta, total: 0, matched: 0 } }),
    )
    const a = await open('/admin/tiket', AdminTicketsPage)
    expect(tid(a.w, 'tq-empty').text()).toBe('Belum ada tiket sokongan.')
    expect(a.w.find('table').exists()).toBe(false)
    const b = await open('/admin/tiket?status=xyz', AdminTicketsPage)
    expect(tid(b.w, 'tq-empty').text()).toBe('Tiada tiket berstatus “xyz”.')
    expect(api.fetchQueue.mock.calls.at(-1)?.[0].status).toBe('xyz')
    const c = await open('/admin/tiket?status=dalam_proses', AdminTicketsPage)
    expect(tid(c.w, 'tq-empty').text()).toBe('Tiada tiket berstatus “Dalam Proses”.')
  })

  it('shows the error with retry', async () => {
    api.fetchQueue.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }),
    )
    const { w } = await open('/admin/tiket', AdminTicketsPage)
    expect(tid(w, 'tq-error').text()).toContain('Ralat pelayan.')
    expect(w.findAll('button').some((b) => b.text() === 'Cuba Semula')).toBe(true)
  })
})
