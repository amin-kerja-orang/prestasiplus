// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { AdminParentLink } from '../../api/parent-invite'
import type { AdminUserDetail, StudentSearchItem } from '../../api/users'
import AdminParentsTab from '../../components/AdminParentsTab.vue'

const links = vi.hoisted(() => ({ listAdminParentLinks: vi.fn(), deleteAdminParentLink: vi.fn() }))
const users = vi.hoisted(() => ({
  searchStudents: vi.fn(),
  updateAdminUser: vi.fn(),
  rolesAfterEdit: vi.fn(),
}))
vi.mock('../../api/parent-invite', () => links)
vi.mock('../../api/users', () => users)

const PARENT = {
  id: 6,
  name: 'Ibu Bapa Demo',
  email: 'ibubapa@demo.test',
  phone: null,
  role: 'parent',
  isActive: true,
} as unknown as AdminUserDetail

function link(linkId: number, studentId: number, name: string): AdminParentLink {
  return {
    linkId,
    parent: { id: 6, name: 'Ibu Bapa Demo', emailMasked: 'i***@demo.test' },
    student: { id: studentId, name, schoolName: 'SMK CONTOH' },
    relationship: null,
    linkedAt: '2026-10-02T09:00:00+08:00',
  }
}
const RESULT: StudentSearchItem = {
  id: 9,
  name: 'Pelajar Baharu',
  classLevel: 'T4',
  schoolName: null,
}

let wrapper: VueWrapper | null = null
const t = (id: string) => wrapper!.get(`[data-testid=${id}]`)
const press = async (id: string): Promise<void> => {
  ;(document.querySelector(`[data-testid="${id}"]`) as HTMLElement).click()
  await flushPromises()
}

async function render(rows: AdminParentLink[]): Promise<void> {
  links.listAdminParentLinks.mockResolvedValue({ data: rows, meta: {} })
  wrapper = mount(AdminParentsTab, { props: { user: PARENT }, attachTo: document.body })
  await flushPromises()
}

async function search(value: string): Promise<void> {
  await t('parents-search').setValue(value)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  for (const fn of [...Object.values(links), ...Object.values(users)]) fn.mockReset()
  users.rolesAfterEdit.mockReturnValue(['parent'])
  users.searchStudents.mockResolvedValue([RESULT])
  users.updateAdminUser.mockResolvedValue({ data: PARENT, status: 'ok' })
  links.deleteAdminParentLink.mockResolvedValue(undefined)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('AdminParentsTab list', () => {
  it('lists the children of the parent from admin/parent-links', async () => {
    await render([link(1, 2, 'Pelajar Demo'), link(2, 4, 'Pelajar Maju')])
    expect(links.listAdminParentLinks).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 6 }),
    )
    expect(t('parents-tab').text()).toContain('Anak yang Dipautkan')
    const rows = wrapper!.findAll('[data-testid=parents-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Pelajar Demo')
    expect(rows[0]!.text()).toContain('SMK CONTOH')
    expect(rows[0]!.text()).toContain('Buang pautan')
    expect(t('parents-search').attributes('placeholder')).toBe('Cari nama atau emel pelajar...')
  })

  it('shows the empty line', async () => {
    await render([])
    expect(t('parents-none').text()).toBe('Tiada pelajar dipautkan lagi')
  })

  it('shows the load error', async () => {
    links.listAdminParentLinks.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    wrapper = mount(AdminParentsTab, { props: { user: PARENT }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-testid=parents-load-error]').exists()).toBe(true)
  })
})

describe('AdminParentsTab remove', () => {
  it('asks "Buang pautan ini?", then deletes the link and reloads', async () => {
    await render([link(11, 2, 'Pelajar Demo')])
    await t('parents-remove').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Buang pautan ini?')
    expect(document.body.textContent).toContain('Ibu bapa tidak lagi dapat melihat anak ini.')
    expect(document.querySelector('[data-testid="parents-remove-cancel"]')?.textContent).toContain(
      'Batal',
    )
    expect(document.querySelector('[data-testid="parents-remove-confirm"]')?.textContent).toContain(
      'Ya, Buang',
    )
    links.listAdminParentLinks.mockResolvedValue({ data: [], meta: {} })
    await press('parents-remove-confirm')
    expect(links.deleteAdminParentLink).toHaveBeenCalledWith(11)
    expect(links.listAdminParentLinks).toHaveBeenCalledTimes(2)
    expect(wrapper!.find('[data-testid=parents-none]').exists()).toBe(true)
  })

  it('"Batal" deletes nothing', async () => {
    await render([link(11, 2, 'Pelajar Demo')])
    await t('parents-remove').trigger('click')
    await flushPromises()
    await press('parents-remove-cancel')
    expect(links.deleteAdminParentLink).not.toHaveBeenCalled()
  })

  it('shows the error when the delete fails', async () => {
    links.deleteAdminParentLink.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    await render([link(11, 2, 'Pelajar Demo')])
    await t('parents-remove').trigger('click')
    await flushPromises()
    await press('parents-remove-confirm')
    expect(t('parents-alert').text()).toContain('Ralat berlaku')
  })
})

describe('AdminParentsTab add', () => {
  it('saves CURRENT ids + the new id through the user update (never drops a link)', async () => {
    await render([link(1, 2, 'Pelajar Demo'), link(2, 4, 'Pelajar Maju')])
    await search('baha')
    await wrapper!.get('[data-testid=parents-result] button').trigger('click')
    await flushPromises()
    expect(users.updateAdminUser).toHaveBeenCalledWith(6, {
      name: 'Ibu Bapa Demo',
      email: 'ibubapa@demo.test',
      phone: null,
      role: 'parent',
      isActive: true,
      linkedStudentIds: [2, 4, 9],
    })
    expect(links.listAdminParentLinks).toHaveBeenCalledTimes(2)
  })

  it('does not offer a child who is already linked', async () => {
    users.searchStudents.mockResolvedValue([{ ...RESULT, id: 2 }, RESULT])
    await render([link(1, 2, 'Pelajar Demo')])
    await search('demo')
    expect(wrapper!.findAll('[data-testid=parents-result]')).toHaveLength(1)
    expect(t('parents-result').text()).toContain('Pelajar Baharu')
  })

  it('shows "Tiada pelajar dijumpai" for an empty search', async () => {
    users.searchStudents.mockResolvedValue([])
    await render([])
    await search('zzzz')
    expect(t('parents-search-empty').text()).toBe('Tiada pelajar dijumpai')
  })

  it('stops adding at 10 children and says so', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => link(i + 1, i + 20, `Pelajar ${i + 1}`))
    await render(rows)
    expect(t('parents-max').text()).toBe('Paling banyak 10 anak boleh dipautkan.')
    expect(t('parents-search').attributes('disabled')).toBeDefined()
    expect(users.updateAdminUser).not.toHaveBeenCalled()
  })

  it('9 children can still add one', async () => {
    const rows = Array.from({ length: 9 }, (_, i) => link(i + 1, i + 20, `Pelajar ${i + 1}`))
    await render(rows)
    expect(wrapper!.find('[data-testid=parents-max]').exists()).toBe(false)
    expect(t('parents-search').attributes('disabled')).toBeUndefined()
  })
})
