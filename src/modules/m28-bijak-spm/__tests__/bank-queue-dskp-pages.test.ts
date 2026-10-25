// @vitest-environment jsdom
/**
 * DSKP-T08: the bank page, the review queue and the review workspace with the DSKP filters, tag
 * badges and tag history (UX spec 6 and 7). The pages run on the real mock server; every figure
 * asserted is read from the server data, never typed, so the table, its summary and the server
 * agree (D11, AC-09.2).
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { dskpSource } from '../lib/dskp-source'
import BankPage from '../admin/papers/BankPage.vue'
import DskpFilterFields from '../admin/papers/DskpFilterFields.vue'
import TagHistoryLines from '../admin/papers/TagHistoryLines.vue'
import ReviewItemPage from '../admin/papers/ReviewItemPage.vue'
import ReviewQueuePage from '../admin/papers/ReviewQueuePage.vue'
import { ADMIN_ROUTES } from '../admin/papers/ui'
import { BANK } from '../data/registry'
import { REVIEW_TOPIC } from '../domain/topic'
import { setBijakServerForTests } from '../server/client'
import { BijakServer, MemoryStorage } from '../server/store'

// The bank is a shared in-memory registry; a revision that is approved changes it, so restore it.
const snapshot = {
  questions: new Map(BANK.questions),
  schemes: new Map(BANK.schemes),
  stimuli: new Map(BANK.stimuli),
  groups: new Map(BANK.groups),
}
function restoreBank(): void {
  for (const [k, m] of [
    ['questions', BANK.questions],
    ['schemes', BANK.schemes],
    ['stimuli', BANK.stimuli],
    ['groups', BANK.groups],
  ] as const) {
    m.clear()
    for (const [id, v] of snapshot[k] as Map<string, never>) (m as Map<string, never>).set(id, v)
  }
}

let server: BijakServer
let wrapper: VueWrapper | null = null
let router: Router

async function render(page: unknown, url: string): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/soalan', name: ADMIN_ROUTES.bank, component: page as never },
      { path: '/soalan/:qid/sunting', name: ADMIN_ROUTES.bankEdit, component: stub },
      { path: '/semakan', name: ADMIN_ROUTES.review, component: page as never },
      { path: '/semakan/:key', name: ADMIN_ROUTES.reviewItem, component: page as never },
    ],
  })
  await router.push(url)
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(page as never, {
    attachTo: document.body,
    global: { plugins: [router, pinia] },
  })
  await flushPromises()
  return wrapper
}

const t = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const all = (sel: string) => [...document.body.querySelectorAll<HTMLElement>(sel)]
const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** Rows currently shown by a `DsDataTable` (table body rows). */
const tableRows = () => all('tbody tr')
/** "Menunjukkan 1-20 daripada 54 hasil" gives 54. */
const summaryTotal = (): number => {
  const m = /daripada (\d+) hasil/.exec(
    text(document.body.querySelector('[data-ds="data-table-pager"]')),
  )
  return m ? Number(m[1]) : 0
}

async function openMore(): Promise<void> {
  if (document.body.querySelector('[data-ds="filter-more-panel"]')) return
  document.body.querySelector<HTMLElement>('[data-ds="filter-more"]')!.click()
  await flushPromises()
}
async function setSelect(id: string, value: string): Promise<void> {
  const el = t(id) as HTMLSelectElement
  el.value = value
  el.dispatchEvent(new Event('change'))
  await flushPromises()
}
async function search(): Promise<void> {
  // The popover has to close first, or its outside-click handler swallows the click.
  document.body.querySelector<HTMLElement>('[data-ds="filter-bar"] button[type="submit"]')!.click()
  await flushPromises()
}

beforeEach(() => {
  window.localStorage.clear()
  server = new BijakServer({ storage: new MemoryStorage() })
  setBijakServerForTests(server)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  setBijakServerForTests(null)
  restoreBank()
})

describe('BankPage, DSKP filters (6.1)', () => {
  it('lists the 13 catalogue subjects in the Subjek filter', async () => {
    await render(BankPage, '/soalan')
    const opts = [...(t('bank-subject') as HTMLSelectElement).options]
    expect(opts.map((o) => o.value)).toEqual([
      '',
      ...dskpSource()
        .subjects()
        .map((s) => s.code),
    ])
    expect(opts[0]!.text).toBe('Semua subjek')
    expect(opts).toHaveLength(14)
  })

  it('the search placeholder names the SP code', async () => {
    await render(BankPage, '/soalan')
    expect((t('bank-search') as HTMLInputElement).placeholder).toBe(
      'Cari teks, ID, topik atau kod SP...',
    )
  })

  it('the table and its summary show exactly the rows the server returns', async () => {
    await render(BankPage, '/soalan')
    const expected = await server.listBank()
    expect(summaryTotal()).toBe(expected.length)
    expect(tableRows()).toHaveLength(Math.min(20, expected.length))
  })

  it('Unit waits for a Subjek, SP waits for a Unit, and a new Subjek clears both', async () => {
    await render(BankPage, '/soalan')
    await openMore()
    const unit = () => t('bank-unit') as HTMLSelectElement
    const sp = () => t('bank-sp') as HTMLSelectElement
    expect(unit().disabled).toBe(true)
    expect(text(t('bank-unit-hint'))).toBe('Pilih subjek dahulu.')
    expect(sp().disabled).toBe(true)
    expect(text(t('bank-sp-hint'))).toBe('Pilih unit dahulu.')

    await setSelect('bank-subject', 'MAT')
    await dskpSource().load('MAT')
    await flushPromises()
    expect(unit().disabled).toBe(false)
    // no tingkatan chosen: two option groups
    expect([...unit().querySelectorAll('optgroup')].map((g) => g.label)).toEqual([
      'Tingkatan 4',
      'Tingkatan 5',
    ])

    await setSelect('bank-form', 'T4')
    const view = dskpSource().loaded('MAT')!
    expect(unit().options).toHaveLength(view.units('T4').length + 1)

    await setSelect('bank-unit', 'MAT:T4:u:1.0')
    expect(sp().disabled).toBe(false)
    expect(sp().options.length).toBeGreaterThan(1)
    await setSelect('bank-sp', 'MAT:T4:sp:1.1.6')
    expect(sp().value).toBe('MAT:T4:sp:1.1.6')

    // another Tingkatan that the unit does not belong to clears Unit and SP
    await setSelect('bank-form', 'T5')
    expect(unit().value).toBe('')
    expect(sp().value).toBe('')
    expect(sp().disabled).toBe(true)

    // a new Subjek clears them too, and Tingkatan stays
    await setSelect('bank-unit', 'MAT:T5:u:1.0')
    await setSelect('bank-subject', 'SN')
    expect(unit().value).toBe('')
    expect((t('bank-form') as HTMLSelectElement).value).toBe('T5')
  })

  it('Unit and SP filter the rows, with chips; the count equals the rows', async () => {
    await render(BankPage, '/soalan')
    await setSelect('bank-subject', 'MAT')
    await dskpSource().load('MAT')
    await openMore()
    await setSelect('bank-form', 'T4')
    await setSelect('bank-unit', 'MAT:T4:u:1.0')
    await setSelect('bank-sp', 'MAT:T4:sp:1.1.6')
    await search()

    const expected = await server.listBank({
      subject: 'MAT',
      formOrigin: 'T4',
      unitId: 'MAT:T4:u:1.0',
      spId: 'MAT:T4:sp:1.1.6',
    })
    expect(expected.length).toBeGreaterThan(0)
    expect(summaryTotal()).toBe(expected.length)
    expect(tableRows()).toHaveLength(expected.length)

    const chips = all('[data-testid="active-filter"]').map((c) => text(c))
    const unit = dskpSource()
      .loaded('MAT')!
      .unit('MAT:T4:u:1.0' as never)!
    expect(chips).toEqual([
      'Matematik',
      'Tingkatan 4',
      `Unit ${unit.code} ${unit.title}`,
      'SP 1.1.6',
    ])

    // removing the Unit chip removes the SP chip as well
    all('[data-testid="active-filter"]')[2]!.click()
    await flushPromises()
    expect(all('[data-testid="active-filter"]').map((c) => text(c))).toEqual([
      'Matematik',
      'Tingkatan 4',
    ])
    expect(summaryTotal()).toBe(
      (await server.listBank({ subject: 'MAT', formOrigin: 'T4' })).length,
    )
  })

  it('TP and KBAT filters give the rows the server returns, and the filter count chip', async () => {
    await render(BankPage, '/soalan')
    await openMore()
    await setSelect('bank-tp', '2')
    await setSelect('bank-kbat', 'tidak')
    await search()
    const expected = await server.listBank({ tp: 2, kbat: 'tidak' })
    expect(summaryTotal()).toBe(expected.length)
    expect(all('[data-testid="active-filter"]').map((c) => text(c))).toEqual([
      'TP 2',
      'KBAT: Tidak',
    ])
    // the "Lagi Penapis" button counts the curriculum filters
    const chip = [
      ...document.body
        .querySelector('[data-ds="filter-more"]')!
        .parentElement!.querySelectorAll('span'),
    ].find((el) => /^\d+$/.test(text(el)))
    expect(text(chip ?? null)).toBe('2')
  })

  it('Perlu semakan tag shows the flagged rows only, and the count equals the rows', async () => {
    await render(BankPage, '/soalan')
    await openMore()
    ;(t('bank-tag-review') as HTMLElement).click()
    await flushPromises()
    await search()
    const flagged = await server.listBank({ tagReview: true })
    expect(flagged.length).toBeGreaterThan(0)
    expect(summaryTotal()).toBe(flagged.length)
    expect(tableRows()).toHaveLength(Math.min(20, flagged.length))
    expect(all('[data-testid="active-filter"]').map((c) => text(c))).toEqual(['Perlu semakan tag'])
    // every row shows the warning badge instead of a unit
    for (const row of tableRows()) {
      expect(text(row.querySelector('[data-testid="tag-flag"]'))).toBe(REVIEW_TOPIC)
      expect(row.querySelector('[data-testid="tag-sp"]')).toBeNull()
    }
  })
})

describe('BankPage, rows and empty states (6.2, 6.3)', () => {
  it('a tagged row shows unit title, SP, TP; a T1-T3 row the exempt copy and no SP', async () => {
    await render(BankPage, '/soalan')
    const rows = await server.listBank({ status: 'semua' })
    const tagged = rows.find((r) => r.id === 'mat2-kuadratik-v1')!
    const exempt = rows.find((r) => r.formOrigin === 'T1-T3')!

    const only = async (id: string) => {
      const box = t('bank-search') as HTMLInputElement
      box.value = id
      box.dispatchEvent(new Event('input'))
      await setSelect('bank-status', 'semua')
      await search()
      expect(tableRows()).toHaveLength(1)
      return tableRows()[0]!
    }

    const taggedRow = await only(tagged.id)
    expect(text(taggedRow.querySelector('[data-testid="tag-unit"]'))).toBe(tagged.topic)
    expect(text(taggedRow.querySelector('[data-testid="tag-sp"]'))).toBe('SP 1.1.6')
    expect(text(taggedRow.querySelector('[data-testid="tag-tp"]'))).toBe(`TP ${tagged.tp}`)
    expect(taggedRow.querySelector('[data-testid="tag-kbat"]')).toBeNull()

    const exemptRow = await only(exempt.id)
    expect(text(exemptRow.querySelector('[data-testid="tag-unit"]'))).toBe(
      'Tingkatan 1-3 (di luar DSKP)',
    )
    expect(exemptRow.querySelector('[data-testid="tag-sp"]')).toBeNull()
  })

  it('an empty filter result shows the filtered state with Set Semula, which restores the list', async () => {
    await render(BankPage, '/soalan')
    await openMore()
    await setSelect('bank-tp', '6')
    await search()
    expect(await server.listBank({ tp: 6 })).toHaveLength(0)
    const empty = document.body.querySelector('[data-ds="empty-state"]')!
    expect(text(empty)).toContain('Tiada soalan dijumpai')
    expect(text(empty)).toContain('Cuba ubah atau set semula penapis.')
    const reset = [...empty.querySelectorAll('button')].find((b) => text(b) === 'Set Semula')!
    reset.click()
    await flushPromises()
    expect(summaryTotal()).toBe((await server.listBank()).length)
    expect(all('[data-testid="active-filter"]')).toHaveLength(0)
  })

  it('Perlu semakan tag alone, Terbit and nothing left to tag, says "Semua soalan sudah bertag."', async () => {
    // Every Terbit seed question is flagged or tagged in the real data, so the empty answer is stubbed.
    vi.spyOn(server, 'listBank').mockResolvedValue([])
    await render(BankPage, '/soalan')
    await openMore()
    ;(t('bank-tag-review') as HTMLElement).click()
    await flushPromises()
    await search()
    expect(text(document.body.querySelector('[data-ds="empty-state"]'))).toContain(
      'Semua soalan sudah bertag.',
    )
  })

  it('the same filter on Ditolak, or with another chip, does not claim everything is tagged', async () => {
    await render(BankPage, '/soalan')
    await setSelect('bank-status', 'ditolak')
    await openMore()
    ;(t('bank-tag-review') as HTMLElement).click()
    await flushPromises()
    await search()
    expect(await server.listBank({ status: 'ditolak', tagReview: true })).toHaveLength(0)
    const empty = text(document.body.querySelector('[data-ds="empty-state"]'))
    expect(empty).toContain('Tiada soalan dijumpai')
    expect(empty).not.toContain('Semua soalan sudah bertag.')
    expect(empty).toContain('Cuba ubah atau set semula penapis.')
  })

  it('Tingkatan 1-3 disables Unit and SP in the real bar', async () => {
    await render(BankPage, '/soalan')
    await setSelect('bank-subject', 'MAT')
    await dskpSource().load('MAT')
    await openMore()
    await setSelect('bank-form', 'T4')
    await setSelect('bank-unit', 'MAT:T4:u:1.0')
    expect((t('bank-sp') as HTMLSelectElement).disabled).toBe(false)
    await setSelect('bank-form', 'T1-T3')
    expect((t('bank-unit') as HTMLSelectElement).disabled).toBe(true)
    expect((t('bank-unit') as HTMLSelectElement).value).toBe('')
    expect((t('bank-sp') as HTMLSelectElement).disabled).toBe(true)
    expect((t('bank-sp') as HTMLSelectElement).value).toBe('')
  })

  it('KBAT Ya, one level and a level nobody has give the rows the server returns', async () => {
    const e = await server.getBankEditable('mat2-kuadratik-v1')
    await server.reviseQuestionFull(
      'mat2-kuadratik-v1',
      { ...e.question, tag: { ...e.question.tag, kbat: 'menilai' } },
      undefined,
      '',
    )
    expect((await server.reviewDecision('v:mat2-kuadratik-v1', { action: 'terbit' })).ok).toBe(true)

    await render(BankPage, '/soalan')
    await openMore()
    await setSelect('bank-kbat', 'ya')
    await search()
    const ya = await server.listBank({ kbat: 'ya' })
    expect(ya.map((r) => r.id)).toEqual(['mat2-kuadratik-v1'])
    expect(summaryTotal()).toBe(1)
    expect(tableRows()).toHaveLength(1)
    expect(all('[data-testid="active-filter"]').map((c) => text(c))).toEqual(['KBAT: Ya'])
    expect(text(tableRows()[0]!.querySelector('[data-testid="tag-kbat"]'))).toBe('KBAT: Menilai')

    await openMore()
    await setSelect('bank-kbat', 'menilai')
    await search()
    expect(summaryTotal()).toBe((await server.listBank({ kbat: 'menilai' })).length)
    expect(all('[data-testid="active-filter"]').map((c) => text(c))).toEqual(['KBAT: Menilai'])

    await openMore()
    await setSelect('bank-kbat', 'mencipta')
    await search()
    expect(await server.listBank({ kbat: 'mencipta' })).toHaveLength(0)
    expect(document.body.querySelector('[data-ds="empty-state"]')).not.toBeNull()
  })
})

describe('loading state (D9)', () => {
  it('the tables do not say "Tiada soalan dijumpai" while the first load runs', async () => {
    for (const [page, path] of [
      [BankPage, '/soalan'],
      [ReviewQueuePage, '/semakan'],
    ] as const) {
      const r = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/soalan', name: ADMIN_ROUTES.bank, component: page },
          { path: '/semakan', name: ADMIN_ROUTES.review, component: page },
          { path: '/semakan/:key', name: ADMIN_ROUTES.reviewItem, component: page },
        ],
      })
      await r.push(path)
      const pinia = createPinia()
      setActivePinia(pinia)
      const w = mount(page, { attachTo: document.body, global: { plugins: [r, pinia] } })
      await Promise.resolve()
      expect(document.body.querySelector('[data-ds="empty-state"]')).toBeNull()
      await flushPromises()
      expect(tableRows().length).toBeGreaterThan(0)
      w.unmount()
      document.body.innerHTML = ''
    }
  })
})

describe('BankPage drawer: tag badges, the flag alert and the tag history (7)', () => {
  it('a flagged Terbit question shows the alert and the flag badge; a tagged one shows its tag', async () => {
    const flagged = (await server.listBank({ tagReview: true }))[0]!
    await render(BankPage, `/soalan?buka=${flagged.id}`)
    expect(text(t('bank-tag-alert'))).toContain('Perlu semakan tag')
    expect(text(t('bank-tag-alert'))).toContain('Soalan ini masih melayani murid.')
    expect(text(t('bank-tag'))).toContain(REVIEW_TOPIC)
    wrapper?.unmount()
    document.body.innerHTML = ''

    await render(BankPage, '/soalan?buka=mat2-kuadratik-v1')
    expect(t('bank-tag-alert')).toBeNull()
    expect(text(t('bank-tag'))).toContain('SP 1.1.6')
    expect(text(t('bank-tag'))).toContain('TP 2')
  })

  it('the version history lists the tag changes of a revision under its entry', async () => {
    const e = await server.getBankEditable('mat2-kuadratik-v1')
    const r = await server.reviseQuestionFull(
      'mat2-kuadratik-v1',
      { ...e.question, tag: { ...e.question.tag, tp: 4, kbat: 'menilai' } },
      undefined,
      'Ubah TP',
    )
    expect(r.ok).toBe(true)
    await render(BankPage, '/soalan?buka=mat2-kuadratik-v1')
    const lines = all('[data-testid="history-tag"] li').map((li) => text(li))
    expect(lines).toEqual([
      'Tag: TP: 2 → kepada 4',
      'Tag: Aras KBAT: (bukan KBAT) → kepada Menilai',
    ])
  })
})

describe('ReviewQueuePage (6.1, 6.3)', () => {
  it('lists the 13 catalogue subjects in the Subjek filter', async () => {
    await render(ReviewQueuePage, '/semakan')
    const opts = [...(t('queue-subject') as HTMLSelectElement).options]
    expect(opts.map((o) => o.value)).toEqual([
      '',
      ...dskpSource()
        .subjects()
        .map((s) => s.code),
    ])
  })

  it('the table shows exactly the queue items the server returns, with the unit badge', async () => {
    await render(ReviewQueuePage, '/semakan')
    const q = await server.listReviewQueue()
    expect(tableRows()).toHaveLength(Math.min(20, q.items.length))
    const rows = tableRows()
    q.items.slice(0, rows.length).forEach((item, i) => {
      const badge = rows[i]!.querySelector('[data-testid="tag-flag"], [data-testid="tag-unit"]')
      expect(text(badge)).toBe(item.topic)
    })
  })

  it('a subject without queue items shows the filtered state with Set Semula', async () => {
    await render(ReviewQueuePage, '/semakan')
    await setSelect('queue-subject', 'FIZ')
    await search()
    expect((await server.listReviewQueue({ subject: 'FIZ' })).items).toHaveLength(0)
    const empty = document.body.querySelector('[data-ds="empty-state"]')!
    expect(text(empty)).toContain('Tiada soalan dijumpai')
    expect(text(empty)).toContain('Cuba ubah atau set semula penapis.')
    expect([...empty.querySelectorAll('button')].some((b) => text(b) === 'Set Semula')).toBe(true)
  })

  it('rows show the full tag badges from the queue item (unit, TP, KBAT), as the bank does', async () => {
    await render(ReviewQueuePage, '/semakan')
    const q = await server.listReviewQueue()
    const rows = tableRows()
    expect(q.items.some((i) => i.tp !== null)).toBe(true)
    q.items.slice(0, rows.length).forEach((item, i) => {
      expect(text(rows[i]!.querySelector('[data-testid="tag-tp"]'))).toBe(
        item.tp === null ? '' : `TP ${item.tp}`,
      )
      expect(rows[i]!.querySelector('[data-testid="tag-sp"]') !== null).toBe(
        !item.tagReview && item.formOrigin !== 'T1-T3' && item.spCodes.length > 0,
      )
    })
  })

  it('has the curriculum filters but no "Perlu semakan tag" control', async () => {
    await render(ReviewQueuePage, '/semakan')
    await openMore()
    for (const id of ['form', 'unit', 'sp', 'tp', 'kbat']) expect(t(`queue-${id}`)).not.toBeNull()
    expect(t('queue-tag-review')).toBeNull()
    expect(text(document.body.querySelector('[data-ds="filter-more-panel"]'))).not.toContain(
      'Perlu semakan tag',
    )
  })

  it('Tingkatan and TP go to the server; the rows equal listReviewQueue and the chips show them', async () => {
    await render(ReviewQueuePage, '/semakan')
    await openMore()
    await setSelect('queue-form', 'T1-T3')
    await setSelect('queue-tp', '2')
    await search()
    const expected = await server.listReviewQueue({ formOrigin: 'T1-T3', tp: 2 })
    const unfiltered = await server.listReviewQueue()
    expect(expected.items.length).toBeGreaterThan(0)
    expect(expected.items.length).toBeLessThan(unfiltered.items.length)
    expect(tableRows()).toHaveLength(expected.items.length)
    expect(all('[data-testid="active-filter"]').map((c) => text(c))).toEqual([
      'Tingkatan 1-3 (di luar DSKP)',
      'TP 2',
    ])
    // the status tiles are not filtered by the curriculum filters
    expect(expected.counts).toEqual(unfiltered.counts)
  })

  it('Unit and SP filter the queue; a new Subjek clears them; removing the Unit chip removes the SP', async () => {
    await render(ReviewQueuePage, '/semakan')
    await setSelect('queue-subject', 'MAT')
    await dskpSource().load('MAT')
    await openMore()
    await setSelect('queue-form', 'T4')
    await setSelect('queue-unit', 'MAT:T4:u:1.0')
    await setSelect('queue-sp', 'MAT:T4:sp:1.1.6')
    await search()
    const expected = await server.listReviewQueue({
      subject: 'MAT',
      formOrigin: 'T4',
      unitId: 'MAT:T4:u:1.0',
      spId: 'MAT:T4:sp:1.1.6',
    })
    if (expected.items.length) expect(tableRows()).toHaveLength(expected.items.length)
    else expect(document.body.querySelector('[data-ds="empty-state"]')).not.toBeNull()
    const chips = all('[data-testid="active-filter"]').map((c) => text(c))
    expect(chips).toHaveLength(4)
    expect(chips[3]).toBe('SP 1.1.6')

    all('[data-testid="active-filter"]')[2]!.click()
    await flushPromises()
    expect(all('[data-testid="active-filter"]').map((c) => text(c))).toEqual([
      'Matematik',
      'Tingkatan 4',
    ])

    await openMore()
    await setSelect('queue-unit', 'MAT:T4:u:1.0')
    await setSelect('queue-subject', 'SN')
    expect((t('queue-unit') as HTMLSelectElement).value).toBe('')
    expect((t('queue-sp') as HTMLSelectElement).value).toBe('')
  })
})

describe('ReviewItemPage: tag badges and tag history (7.1, 7.2)', () => {
  it('shows the tag being approved as badges and the revision tag lines in the history', async () => {
    const e = await server.getBankEditable('mat2-kuadratik-v1')
    await server.reviseQuestionFull(
      'mat2-kuadratik-v1',
      { ...e.question, tag: { ...e.question.tag, tp: 5 } },
      undefined,
      'Ubah TP',
    )
    await render(ReviewItemPage, '/semakan/v:mat2-kuadratik-v1')
    expect(text(t('review-tag'))).toContain('SP 1.1.6')
    expect(text(t('review-tag'))).toContain('TP 5')
    expect(text(t('review-tag'))).toContain(
      'Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
    )
    expect(all('[data-testid="history-tag"] li').map((li) => text(li))).toEqual([
      'Tag: TP: 2 → kepada 5',
    ])
  })

  it('a flagged item shows the warning badge', async () => {
    const q = await server.listReviewQueue()
    const flagged = q.items.find((i) => i.topic === REVIEW_TOPIC)!
    await render(ReviewItemPage, `/semakan/${flagged.key}`)
    expect(text(t('review-tag'))).toContain(REVIEW_TOPIC)
    expect(t('review-tag')!.querySelector('[data-testid="tag-sp"]')).toBeNull()
  })
})

describe('DskpFilterFields states (6.3)', () => {
  const mountFields = (props: Record<string, unknown>) =>
    mount(DskpFilterFields, { props: { prefix: 'bank', subject: 'MAT', ...props } })

  it('a catalogue error keeps Unit disabled with the hint and a Cuba Semula that asks to retry', async () => {
    const w = mountFields({ error: true })
    const unit = w.get('[data-testid="bank-unit"]')
    expect((unit.element as HTMLSelectElement).disabled).toBe(true)
    expect(w.get('[data-testid="bank-unit-hint"]').text()).toBe(
      'Senarai unit tidak dapat dimuatkan.',
    )
    // the other filters keep working
    expect((w.get('[data-testid="bank-tp"]').element as HTMLSelectElement).disabled).toBe(false)
    await w.get('[data-testid="bank-unit-retry"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('while the catalogue loads Unit is disabled and busy', () => {
    const w = mountFields({ loading: true })
    const unit = w.get('[data-testid="bank-unit"]')
    expect((unit.element as HTMLSelectElement).disabled).toBe(true)
    expect(unit.attributes('aria-busy')).toBe('true')
  })

  it('Tingkatan 1-3 disables Unit and SP, and the queue form has no Perlu semakan tag box', () => {
    const w = mountFields({ formOrigin: 'T1-T3', unitId: '' })
    expect((w.get('[data-testid="bank-unit"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((w.get('[data-testid="bank-sp"]').element as HTMLSelectElement).disabled).toBe(true)
    expect(w.find('[data-testid="bank-tag-review"]').exists()).toBe(false)
    expect(
      mountFields({ showTagReview: true }).find('[data-testid="bank-tag-review"]').exists(),
    ).toBe(true)
  })
})

describe('TagHistoryLines (7.2)', () => {
  const entry = {
    at: 0,
    by: 'Admin Pusat',
    version: 1,
    action: 'Dihantar untuk semakan',
    tag: [
      { field: 'unit' as const, after: 'MAT:T4:u:1.0' },
      { field: 'tp' as const, before: 2, after: 4 },
    ],
  }

  it('shows nothing while the catalogue is pending, then the lines', async () => {
    const view = await dskpSource().load('MAT')
    const w = mount(TagHistoryLines, { props: { entry, view: undefined, pending: true } })
    expect(w.find('[data-testid="history-tag"]').exists()).toBe(false)
    await w.setProps({ view, pending: false })
    const lines = w.findAll('li').map((li) => text(li.element))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain(`${view.unit('MAT:T4:u:1.0' as never)!.code} - `)
    expect(lines[1]).toBe('Tag: TP: 2 → kepada 4')
  })

  it('when the catalogue failed the lines show the bare code, never "tidak dijumpai"', () => {
    const w = mount(TagHistoryLines, { props: { entry, view: undefined, pending: false } })
    const lines = w.findAll('li').map((li) => text(li.element))
    expect(lines[0]).toBe('Tag: Unit: 1.0')
    expect(lines.join(' ')).not.toContain('tidak dijumpai')
  })
})
