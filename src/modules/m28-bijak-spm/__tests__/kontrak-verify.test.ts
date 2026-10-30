// @vitest-environment jsdom
import type { BijakBlueprintView, BijakVerificationCheck } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VerifyPanel from '../admin/kontrak/components/VerifyPanel.vue'
import { formFromView, toInput, type ContractForm } from '../admin/kontrak/domain/form'
import { KontrakError } from '../admin/kontrak/server/api'
import { MockKontrakServer } from '../admin/kontrak/server/mock'

let wrapper: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function readyServer(): Promise<{ api: MockKontrakServer; view: BijakBlueprintView; form: ContractForm }> {
  const api = new MockKontrakServer({ createPaper: async () => 'p' })
  const f = formFromView(await api.get('SN', 2))
  const unit = (await api.listUnits('SN'))[0]!
  for (const s of f.sections) {
    s.profileKind = 'bahagian'
    s.groups = [{ from: 1, to: s.questionCount, tpMin: 1, tpMax: 3, tpCounts: {}, marks: null }]
    s.quotaLines = [{ unit, value: s.questionCount, reviewed: true }]
    s.kbatMarks = 0
  }
  const view = await api.saveVersion('SN', 2, toInput(f))
  const ev = (body: string) => ({
    kind: 'trial_paper' as const,
    body,
    year: 2025,
    paperCode: '4541/2',
    values: {
      durationMin: 60,
      totalMarks: 13,
      sections: [
        { position: 1, markBudget: 9, rule: { type: 'all' as const }, questionCount: 3 },
        { position: 2, markBudget: 4, rule: { type: 'choose' as const, n: 1 }, questionCount: 2 },
      ],
    },
  })
  await api.addEvidence('SN', 2, ev('sbp'))
  await api.addEvidence('SN', 2, ev('selangor_mpsm'))
  return { api, view, form: formFromView(view) }
}

async function mountPanel(
  api: MockKontrakServer,
  view: BijakBlueprintView,
  form: ContractForm,
  dirty = false,
): Promise<VueWrapper> {
  const versions = await api.versions(view.subject, view.kertas)
  wrapper = mount(VerifyPanel, {
    props: { api, subject: view.subject, kertas: view.kertas, subjectName: view.subjectName, view, versions, form, dirty, reloadKey: 0 },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('VerifyPanel: Sahkan is never silently disabled (D-10)', () => {
  it('shows the failing gates, aria-disabled Sahkan and the reason beside it', async () => {
    const api = new MockKontrakServer()
    const view = await api.get('MAT', 2)
    const w = await mountPanel(api, view, formFromView(view))
    const failing = w.findAll('[data-testid^=gate-][data-ok=false]')
    expect(failing.length).toBeGreaterThan(0)
    const btn = w.get('[data-testid=sahkan]')
    expect(btn.attributes('aria-disabled')).toBe('true')
    expect(btn.attributes('aria-describedby')).toBe('sahkan-reason')
    expect(w.get('[data-testid=sahkan-reason]').text()).toBe(`Selesaikan ${failing.length} syarat di atas dahulu.`)
    const verify = vi.spyOn(api, 'verify')
    await btn.trigger('click')
    expect(verify).not.toHaveBeenCalled()
    expect(document.body.querySelector('[data-testid=sahkan-confirm]')).toBeNull()
  })

  it('asks for the note, then for unsaved changes to be saved, before anything else', async () => {
    const { api, view, form } = await readyServer()
    const w = await mountPanel(api, view, form)
    expect(w.findAll('[data-testid^=gate-][data-ok=false]')).toHaveLength(0)
    expect(w.get('[data-testid=sahkan-reason]').text()).toBe('Isi nota pengesahan dahulu.')
    await w.setProps({ dirty: true })
    expect(w.get('[data-testid=sahkan-reason]').text()).toBe('Simpan perubahan dahulu.')
  })

  it('verifies through the confirm dialog and reports the Disahkan view', async () => {
    const { api, view, form } = await readyServer()
    const w = await mountPanel(api, view, form)
    await w.get('[data-testid=verify-note]').setValue('Disemak dengan dua badan')
    expect(w.find('[data-testid=sahkan-reason]').exists()).toBe(false)
    await w.get('[data-testid=sahkan]').trigger('click')
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLButtonElement>('[data-testid=sahkan-confirm]')
    expect(confirmBtn).not.toBeNull()
    const verify = vi.spyOn(api, 'verify')
    confirmBtn!.click()
    await flushPromises()
    expect(verify).toHaveBeenCalledWith('SN', 2, 'Disemak dengan dua badan')
    const emitted = w.emitted('verified')
    expect(emitted).toHaveLength(1)
    expect((emitted![0]![0] as BijakBlueprintView).source).toBe('Disahkan')
  })

  it('lists every failure the server returns when the re-check refuses (422 details.check)', async () => {
    const { api, view, form } = await readyServer()
    const w = await mountPanel(api, view, form)
    const check: BijakVerificationCheck = {
      passes: false,
      blueprintProblems: [],
      completeness: [{ code: 'NO_KBAT', sectionPosition: 1 }, { code: 'NO_PROFILE', sectionPosition: 2 }],
      lines: [],
    }
    vi.spyOn(api, 'verify').mockRejectedValue(new KontrakError('verification', 'x', { check }))
    await w.get('[data-testid=verify-note]').setValue('Nota')
    await w.get('[data-testid=sahkan]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid=sahkan-confirm]')!.click()
    await flushPromises()
    const box = w.get('[data-testid=verify-failure]')
    expect(box.text()).toContain('Kontrak belum boleh disahkan.')
    expect(box.text()).toContain('Bahagian A: kuota KBAT belum diisi.')
    expect(box.text()).toContain('Bahagian B: profil kesukaran belum ditetapkan.')
    expect(w.emitted('verified')).toBeUndefined()
  })

  it('locks the evidence once the contract is Disahkan', async () => {
    const { api, view, form } = await readyServer()
    const verified = await api.verify('SN', 2, 'ok')
    const w = await mountPanel(api, verified, formFromView(verified))
    expect(w.find('[data-testid=evidence-add]').exists()).toBe(false)
    expect(w.get('[data-testid=evidence-locked]').text()).toContain('Rekod pengesahan tidak boleh diubah.')
    expect(view.source).not.toBe('Disahkan')
    expect(form.sections).toHaveLength(2)
  })
})
