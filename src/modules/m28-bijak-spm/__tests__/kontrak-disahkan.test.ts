// @vitest-environment jsdom
// S3-T01 "Kontrak: Disahkan selectable and honest": the status control, the count of what is missing, the Baharu list and refusals,
// the section rules with Markah setiap soalan and the paper's Bilangan soalan, and what the mocks answer.
import { BIJAK_BUILDER_MESSAGES as MSG, type BijakBlueprintView } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import { BuilderError } from '../admin/builder/server/api'
import { MockBuilderServer } from '../admin/builder/server/memory'
import {
  answerLine,
  emptyForm,
  formFromView,
  parseMarksList,
  structuralKey,
  toInput,
  type ContractForm,
  type FormSection,
} from '../admin/kontrak/domain/form'
import { errorsOf, issueFromProblem, issuesFromFields, validateForm } from '../admin/kontrak/domain/validate'
import { failingGates } from '../admin/kontrak/domain/verify'
import KontrakEditorPage from '../admin/kontrak/pages/KontrakEditorPage.vue'
import KontrakListPage from '../admin/kontrak/pages/KontrakListPage.vue'
import { KontrakError } from '../admin/kontrak/server/api'
import { setKontrakServerForTests } from '../admin/kontrak/server/client'
import { kontrakErrorFrom } from '../admin/kontrak/server/http'
import { MockKontrakServer } from '../admin/kontrak/server/memory'
import adminKontrakRoutes from '../routes/admin-kontrak'
import { BLUEPRINTS } from '../data/registry'
import { servesPupils } from '../server/store'

function section(over: Partial<FormSection> = {}): FormSection {
  return { ...emptyForm().sections[0]!, label: 'Bahagian A', questionCount: 5, markBudget: 18, ...over }
}
function form(sections: FormSection[], over: Partial<ContractForm> = {}): ContractForm {
  const totalMarks = sections.reduce((n, s) => n + (s.markBudget ?? 0), 0)
  return { ...emptyForm(), code: '1449/2', durationMin: 150, totalMarks, sections, ...over }
}
const messages = (f: ContractForm): string[] => errorsOf(validateForm(f)).map((i) => i.message)

describe('Markah setiap soalan and Bilangan soalan dalam kertas: the form', () => {
  it('reads a comma list, and one number as that mark for each of the M questions (16-18)', () => {
    expect(parseMarksList('', 5)).toBeNull()
    expect(parseMarksList('3,3,3,', 3)).toEqual([3, 3, 3])
    expect(parseMarksList(' 3, 3,3 ,5,4 ', 5)).toEqual([3, 3, 3, 5, 4])
    expect(parseMarksList('20', 3)).toEqual([20, 20, 20])
    expect(parseMarksList('20', null)).toEqual([20])
    expect(parseMarksList('3,x', 2)).toBe('invalid')
    expect(parseMarksList('3,', 2)).toEqual([3, 3])
    expect(parseMarksList('0', 2)).toBe('invalid')
    expect(parseMarksList('1001', 2)).toBe('invalid')
    expect(parseMarksList(Array.from({ length: 501 }, () => '1').join(','), 501)).toBe('invalid')
  })

  it('round-trips both fields, so a save never drops them and never makes a Spec version by itself', async () => {
    const api = new MockKontrakServer()
    const seeded = await api.get('MAT', 1)
    const section0 = { ...seeded.sections[0]!, questionCount: 5, markBudget: 18, marksPerQuestion: [3, 3, 3, 5, 4] }
    const view: BijakBlueprintView = { ...seeded, totalMarks: 18, questionCount: 40, sections: [section0] }
    const f = formFromView(view)
    expect(f.questionCount).toBe(40)
    expect(f.sections[0]!.marksPerQuestion).toBe('3,3,3,5,4')
    const body = toInput(f)
    expect(body.questionCount).toBe(40)
    expect(body.sections[0]!.marksPerQuestion).toEqual([3, 3, 3, 5, 4])
    expect(structuralKey(toInput(formFromView(view)))).toBe(structuralKey(body))
  })

  it('leaves both out when not set, so the structural key of an older contract is what it was', () => {
    const body = toInput(form([section()]))
    expect(body).not.toHaveProperty('questionCount')
    expect(body.sections[0]).not.toHaveProperty('marksPerQuestion')
  })

  it('counts both as structural', () => {
    const f = form([section()])
    const base = structuralKey(toInput(f))
    expect(structuralKey(toInput({ ...f, questionCount: 40 }))).not.toBe(base)
    expect(structuralKey(toInput(form([section({ marksPerQuestion: '3,3,3,5,4' })])))).not.toBe(base)
  })

  it('derives the line "Jawab {n} daripada {m}" (FR-ADM-Q16.8, FR-QA-25)', () => {
    expect(answerLine(section({ ruleType: 'choose', chooseN: 3, questionCount: 5 }))).toBe('Jawab 3 daripada 5')
    expect(answerLine(section({ ruleType: 'all', questionCount: 40 }))).toBe('Jawab 40 daripada 40')
    expect(answerLine(section({ ruleType: 'choose', chooseN: null, questionCount: null }))).toBe('Jawab ? daripada ?')
  })
})

describe('Section rules (FR-QA-41, 16-10, 16-18)', () => {
  it('refuses Wajib dijawab with Pilih N, on the checkbox', () => {
    const issues = validateForm(form([section({ compulsory: true, ruleType: 'choose', chooseN: 1, questionCount: 3, markBudget: 20 })]))
    const e = errorsOf(issues).find((i) => i.code === 'COMPULSORY_CHOOSE')!
    expect(e.message).toBe('Bahagian wajib dijawab tidak boleh digabungkan dengan Pilih N.')
    expect(e.message).toBe(MSG.compulsoryChoose)
    expect(e.target).toBe('kontrak-s0-compulsory')
  })

  it('says "Nombor N tidak sah." for a missing, zero or too large N, on the N field', () => {
    for (const chooseN of [null, 0, 6]) {
      const e = errorsOf(validateForm(form([section({ ruleType: 'choose', chooseN })]))).find((i) => i.code === 'CHOOSE_N_RANGE')!
      expect(e.message).toBe('Nombor N tidak sah.')
      expect(e.target).toBe('kontrak-s0-n')
    }
  })

  it('accepts a list of M marks adding up to the section marks, and a Pilih N list adding up to the marks offered (DM-57)', () => {
    expect(messages(form([section({ marksPerQuestion: '3,3,3,5,4' })]))).not.toContain(MSG.marksPerQuestionMismatch)
    expect(messages(form([section({ ruleType: 'choose', chooseN: 1, questionCount: 3, markBudget: 20, marksPerQuestion: '20,20,20' })]))).not.toContain(MSG.marksPerQuestionMismatch)
    expect(messages(form([section({ ruleType: 'choose', chooseN: 1, questionCount: 3, markBudget: 20, marksPerQuestion: '20' })]))).not.toContain(MSG.marksPerQuestionMismatch)
  })

  it('refuses a list of the wrong length, the wrong sum or that cannot be read', () => {
    for (const marksPerQuestion of ['3,3,3,5', '3,3,3,5,5', '3,x,3,5,4']) {
      const e = errorsOf(validateForm(form([section({ marksPerQuestion })]))).find((i) => i.code === 'MARKS_PER_QUESTION')!
      expect(e.message).toBe('Markah setiap soalan mesti sama dengan markah bahagian.')
      expect(e.target).toBe('kontrak-s0-marks-list')
    }
  })

  it('maps the server codes onto the same message and field', () => {
    const sections = [section()]
    const a = issueFromProblem({ code: 'COMPULSORY_CHOOSE', sectionPosition: 1 }, sections)
    const b = issueFromProblem({ code: 'MARKS_PER_QUESTION', sectionPosition: 1, expected: 18, actual: 17 }, sections)
    const c = issueFromProblem({ code: 'CHOOSE_N_RANGE', sectionPosition: 1, expected: 5, actual: 6 }, sections)
    expect([a.message, a.part, a.target]).toEqual([MSG.compulsoryChoose, 'struktur', 'kontrak-s0-compulsory'])
    expect([b.message, b.part, b.target]).toEqual([MSG.marksPerQuestionMismatch, 'struktur', 'kontrak-s0-marks-list'])
    expect([c.message, c.part, c.target]).toEqual([MSG.chooseNRange, 'struktur', 'kontrak-s0-n'])
  })

  it('checks Bilangan soalan dalam kertas from 1 to 200 and leaves it apart from the section counts (16-19)', () => {
    expect(messages(form([section()], { questionCount: 201 }))).toContain('Bilangan soalan tidak sah.')
    expect(messages(form([section()], { questionCount: 0 }))).toContain('Bilangan soalan tidak sah.')
    expect(messages(form([section()], { questionCount: 40 }))).not.toContain('Bilangan soalan tidak sah.')
    expect(messages(form([section()]))).not.toContain('Bilangan soalan tidak sah.')
  })
})

describe('PRD30 16-01 to 16-12 copy', () => {
  it('uses the PRD messages for the checks the form makes', () => {
    const all = messages(form([section({ label: ' ', markBudget: null, instruction: 'x'.repeat(501) })], { code: ' ', durationMin: 0, totalMarks: 9 }))
    expect(all).toEqual(
      expect.arrayContaining([
        'Kod kertas tidak sah. Contoh: 1449/1.',
        'Tempoh mesti antara 1 dan 300 minit.',
        'Label bahagian diperlukan.',
        'Markah tidak sah.',
        'Arahan tidak boleh melebihi 500 aksara.',
      ]),
    )
    expect(messages(form([section()], { totalMarks: 100 }))).toContain('Jumlah markah (100) mesti sama dengan jumlah markah bahagian (18).')
  })

  it('enforces the limit the message states (PRD 30 row 16-04): 300 minutes pass, 301 do not', () => {
    expect(messages(form([section()], { durationMin: 300 }))).not.toContain('Tempoh mesti antara 1 dan 300 minit.')
    expect(messages(form([section()], { durationMin: 301 }))).toContain('Tempoh mesti antara 1 dan 300 minit.')
    expect(messages(form([section()], { durationMin: 600 }))).toContain('Tempoh mesti antara 1 dan 300 minit.')
  })
})

describe('422 fields reach the screen', () => {
  const refusal = (fields: Record<string, string>, message = 'first'): ApiError =>
    new ApiError({ status: 422, code: 'VALIDATION_ERROR', message, fields })

  it('reads the fields of a VALIDATION_ERROR into the error', () => {
    const e = kontrakErrorFrom(refusal({ subject: MSG.dskpNotLoaded })) as KontrakError
    expect(e).toBeInstanceOf(KontrakError)
    expect(e.kind).toBe('invalid')
    expect(e.fields).toEqual({ subject: MSG.dskpNotLoaded })
  })

  it('keeps a VALIDATION_ERROR without fields as a plain message', () => {
    const e = kontrakErrorFrom(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Tidak sah' })) as KontrakError
    expect(e.kind).toBe('other')
    expect(e.message).toBe('Tidak sah')
  })

  it('places each key on its field, N counted from 0', () => {
    const issues = issuesFromFields({ subject: 'a', 'sections.1.compulsory': 'b', 'sections.0.rule.n': 'c', 'sections.2.marksPerQuestion.3': 'd', other: 'e' })
    expect(issues.map((i) => [i.section, i.target, i.message])).toEqual([
      [null, 'kontrak-umum-subject', 'a'],
      [1, 'kontrak-s1-compulsory', 'b'],
      [0, 'kontrak-s0-n', 'c'],
      [2, 'kontrak-s2-marks-list', 'd'],
      [null, 'kontrak-umum-jumlah', 'e'],
    ])
    expect(issues.every((i) => i.level === 'error')).toBe(true)
  })
})

describe('one Kontrak status in both mocks (D12)', () => {
  const servingPairs = (rows: { subject: string; kertas: number }[]): string[] => rows.map((r) => `${r.subject}/${r.kertas}`).sort()

  it('the admin mock reads MAT/1 and SN/1 as Disahkan, serving, with a verification record', async () => {
    const api = new MockKontrakServer()
    for (const [subject, kertas] of [['MAT', 1], ['SN', 1]] as const) {
      const v = await api.get(subject, kertas)
      expect(v).toMatchObject({ source: 'Disahkan', servesStudents: true, version: 1 })
      expect(v.verification).toMatchObject({ verifierRole: 'admin', bodies: [] })
      expect((await api.verification(subject, kertas)).record).not.toBeNull()
    }
    expect((await api.get('MAT', 2)).source).toBe('Spec')
  })

  it('the pupil serving set equals the registry serving Disahkan rows', async () => {
    const admin = await new MockKontrakServer().list()
    const registry = servingPairs(admin.filter((v) => v.source === 'Disahkan' && v.servesStudents))
    expect(registry).toEqual(['MAT/1', 'SN/1'])
    // The pupil mock serves a contract only when `servesPupils` holds on its registry row (pupil Jana was removed by #849).
    const pupil = BLUEPRINTS.filter(servesPupils).map((b) => ({ subject: b.subject, kertas: b.kertas }))
    expect(servingPairs(pupil)).toEqual(registry)
  })
})

describe('Mocks answer as the API', () => {
  const body = {
    code: 'X/1',
    durationMin: 60,
    instructions: [],
    sections: [{ label: 'A', markBudget: 3, questionCount: 3, rule: { type: 'all' as const } }],
  }

  it('refuses a contract for a subject with no DSKP unit, on fields.subject (AC-ADM-Q16.4)', async () => {
    const e = await new MockKontrakServer().create({ subject: 'KIM', kertas: 1, ...body }).catch((x: unknown) => x as KontrakError)
    expect(e).toMatchObject({ kind: 'invalid', message: MSG.dskpNotLoaded, fields: { subject: MSG.dskpNotLoaded } })
  })

  it('does not bound Tempoh in the mock (the API accepts up to 600; the form refuses above 300) and answers a duplicate with the one contract message', async () => {
    const api = new MockKontrakServer()
    await expect(api.create({ subject: 'MAT', kertas: 4, ...body, durationMin: 301 })).resolves.toMatchObject({ kertas: 4, durationMin: 301 })
    await expect(api.create({ subject: 'MAT', kertas: 3, ...body, durationMin: 600 })).resolves.toMatchObject({ kertas: 3, durationMin: 600 })
    expect(messages(form([section()], { durationMin: 301 }))).toContain('Tempoh mesti antara 1 dan 300 minit.')
    const dup = await api.create({ subject: 'MAT', kertas: 1, ...body }).catch((x: unknown) => x as KontrakError)
    expect(dup).toMatchObject({ kind: 'conflict', message: MSG.blueprintExists })
  })

  it('seeded Disahkan MAT/1 and SN/1 show no failing gate next to Disahkan; a Spec head still fails its gates', async () => {
    const api = new MockKontrakServer()
    for (const [subject, kertas] of [['MAT', 1], ['SN', 1]] as const) {
      const view = await api.get(subject, kertas)
      const { record, check } = await api.verification(subject, kertas)
      expect(view.source).toBe('Disahkan')
      expect(record).not.toBeNull()
      expect(check).toMatchObject({ passes: true, blueprintProblems: [], completeness: [] })
      expect(failingGates(check, formFromView(view))).toEqual([])
      // Editing the structure creates a Spec version, which is checked for real again.
      const body = toInput(formFromView(view))
      const next = await api.saveVersion(subject, kertas, { ...body, durationMin: body.durationMin + 5 })
      expect(next.source).toBe('Spec')
      expect((await api.verification(subject, kertas)).check.passes).toBe(false)
    }
    expect((await api.verification('MAT', 2)).check.passes).toBe(false)
  })

  it('offers only subjects with units in Baharu', async () => {
    const codes = (await new MockKontrakServer().subjectOptions()).map((s) => s.code)
    expect(codes.length).toBeGreaterThan(0)
    expect(codes).not.toContain('KIM')
  })

  it('refuses Wajib dijawab with Pilih N and an N above M with field keys', async () => {
    const api = new MockKontrakServer()
    const sections = [
      { label: 'A', markBudget: 3, questionCount: 3, compulsory: true, rule: { type: 'choose' as const, n: 1 } },
      { label: 'B', markBudget: 3, questionCount: 1, rule: { type: 'choose' as const, n: 2 } },
    ]
    const e = await api.saveVersion('MAT', 1, { ...body, sections }).catch((x: unknown) => x as KontrakError)
    expect(e).toMatchObject({ kind: 'invalid', fields: { 'sections.0.compulsory': MSG.compulsoryChoose, 'sections.1.rule.n': MSG.chooseNRange } })
  })

  it('refuses a marks list that does not add up, and keeps a good one with the paper question count', async () => {
    const api = new MockKontrakServer()
    const one = (marksPerQuestion: number[]) => ({ ...body, questionCount: 40, sections: [{ label: 'A', markBudget: 18, questionCount: 5, rule: { type: 'all' as const }, marksPerQuestion }] })
    const bad = await api.saveVersion('MAT', 1, one([3, 3, 3, 5, 5])).catch((x: unknown) => x as KontrakError)
    expect((bad as KontrakError).problems[0]).toMatchObject({ code: 'MARKS_PER_QUESTION', expected: 18, actual: 19 })
    const saved = await api.saveVersion('MAT', 1, one([3, 3, 3, 5, 4]))
    expect(saved.questionCount).toBe(40)
    expect(saved.sections[0]!.marksPerQuestion).toEqual([3, 3, 3, 5, 4])
  })

  it('never serves a Spec row to a pupil (API-BIJAK-02, D76)', () => {
    expect(BLUEPRINTS.some((b) => !servesPupils(b))).toBe(true)
    expect(BLUEPRINTS.filter(servesPupils).every((b) => b.source === 'Disahkan')).toBe(true)
  })

  it('asks for the override reason in the contract words (decision 31)', async () => {
    const e = await new MockBuilderServer(() => ['x']).publish('p1', { override: true, reason: 'abc' }).catch((x: unknown) => x as BuilderError)
    expect(e).toBeInstanceOf(BuilderError)
    expect((e as BuilderError).message).toBe(MSG.overrideReasonRequired)
  })
})

describe('Kontrak screens', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    setKontrakServerForTests(null)
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  const server = (): MockKontrakServer => {
    const s = new MockKontrakServer({ createPaper: () => Promise.resolve('paper-1') })
    setKontrakServerForTests(s)
    return s
  }
  async function open(component: Component, path: string): Promise<Router> {
    const r = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }, ...adminKontrakRoutes] })
    await r.push(path)
    await r.isReady()
    wrapper = mount(component, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    return r
  }
  const sourceSelect = () => wrapper!.get<HTMLSelectElement>('[data-testid="kontrak-source"]')
  const disahkanOption = () => sourceSelect().find<HTMLOptionElement>('option[value="Disahkan"]').element

  describe('the Sumber control (FR-ADM-Q16.2, decisions 1 to 3)', () => {
    it('offers Disahkan, which opens the Pengesahan tab, reads the verification and writes nothing', async () => {
      const api = server()
      const r = await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/2')
      expect(disahkanOption().disabled).toBe(false)
      const verification = vi.spyOn(api, 'verification')
      const verify = vi.spyOn(api, 'verify')
      const save = vi.spyOn(api, 'saveVersion')

      await sourceSelect().setValue('Disahkan')
      await flushPromises()

      expect(r.currentRoute.value.query.paparan).toBe('pengesahan')
      expect(wrapper!.find('[data-testid="verify-panel"]').exists()).toBe(true)
      expect(verification).toHaveBeenCalledWith('MAT', 2)
      expect(verify).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
      expect((await api.get('MAT', 2)).source).toBe('Spec')

      await r.replace({ query: { paparan: 'umum' } })
      await flushPromises()
      expect(sourceSelect().element.value).toBe('Spec')
    })

    it('puts the control back to the form value when the Pengesahan tab does not open', async () => {
      server()
      const r = await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/2')
      r.beforeEach((to) => (to.query.paparan === 'pengesahan' ? false : true))
      await sourceSelect().setValue('Disahkan')
      await flushPromises()
      expect(r.currentRoute.value.query.paparan).toBeUndefined()
      expect(sourceSelect().element.value).toBe('Spec')
    })

    it('still writes Draf and Spec', async () => {
      server()
      await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/2')
      await sourceSelect().setValue('Draf')
      await flushPromises()
      expect(sourceSelect().element.value).toBe('Draf')
    })

    it('disables Disahkan on unsaved edits, with the reason', async () => {
      server()
      const r = await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/2')
      expect(wrapper!.text()).not.toContain('Simpan perubahan dahulu.')
      await wrapper!.get('#kontrak-umum-code').setValue('EDITED/2')
      await flushPromises()
      expect(disahkanOption().disabled).toBe(true)
      expect(wrapper!.text()).toContain('Simpan perubahan dahulu.')
      expect(r.currentRoute.value.query.paparan).toBeUndefined()
    })

    it('disables Disahkan on a new contract, with the reason', async () => {
      server()
      await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/4?baharu=1')
      expect(disahkanOption().disabled).toBe(true)
      expect(wrapper!.text()).toContain('Simpan perubahan dahulu.')
    })
  })

  describe('Belum lengkap untuk Disahkan (FR-ADM-Q16.4, 16-20)', () => {
    it('counts the Syarat Disahkan rows, evidence included, in the panel and on the Pengesahan tab', async () => {
      const api = server()
      const r = await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/2')
      const { check } = await api.verification('MAT', 2)
      const n = failingGates(check, formFromView(await api.get('MAT', 2))).length
      const fromFormOnly = validateForm(formFromView(await api.get('MAT', 2))).filter((i) => i.level === 'incomplete').length
      expect(check.completeness.some((c) => c.code === 'NO_EVIDENCE_BODIES')).toBe(true)
      expect(n).toBeGreaterThan(0)
      expect(n).not.toBe(fromFormOnly)
      expect(wrapper!.get('[data-testid="contract-check"]').text()).toContain(`Belum lengkap untuk Disahkan (${n})`)

      await r.replace({ query: { paparan: 'pengesahan' } })
      await flushPromises()
      expect(wrapper!.get('[data-testid="gates-failing"]').text()).toBe(`Belum lengkap untuk Disahkan (${n})`)
      expect(wrapper!.get('[data-testid="problem-chip"]').text()).toBe(`${n} masalah`)
    })

    it('a row with no field of its own opens the Pengesahan tab', async () => {
      server()
      const r = await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/2')
      const link = wrapper!.get('[data-testid="check-incomplete"]').findAll('button').find((b) => b.text().includes('Rekod pengesahan'))!
      await link.trigger('click')
      await flushPromises()
      expect(r.currentRoute.value.query.paparan).toBe('pengesahan')
    })

    it('shows the count as unknown, not the form count, when the check cannot be read', async () => {
      const api = server()
      vi.spyOn(api, 'verification').mockRejectedValue(new Error('offline'))
      await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/2')
      const panel = wrapper!.get('[data-testid="contract-check"]')
      expect(panel.text()).toContain('Belum lengkap untuk Disahkan (tidak diketahui)')
      expect(panel.get('[data-testid="check-unknown"]').text()).toContain('tidak dapat dimuatkan')
      expect(panel.find('[data-testid="check-incomplete"]').exists()).toBe(false)
      expect(panel.text()).not.toMatch(/Belum lengkap untuk Disahkan \(\d+\)/)
      expect(wrapper!.get('[data-testid="problem-chip"]').text()).not.toMatch(/^\d+ masalah$/)
    })

    it('falls back to the form when there is no check to read yet: a new contract', async () => {
      const api = server()
      const verification = vi.spyOn(api, 'verification')
      await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/4?baharu=1')
      expect(verification).not.toHaveBeenCalled()
      const n = validateForm(emptyForm()).filter((i) => i.level === 'incomplete').length
      expect(wrapper!.get('[data-testid="contract-check"]').text()).toContain(`Belum lengkap untuk Disahkan (${n})`)
    })
  })

  describe('the section editor (FR-ADM-Q16.8)', () => {
    it('edits Wajib dijawab, Markah setiap soalan and shows the derived line and total', async () => {
      server()
      await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/1?paparan=bahagian-1')
      await wrapper!.get('#kontrak-s0-m').setValue('5')
      await wrapper!.get('#kontrak-s0-budget').setValue('18')
      expect(wrapper!.get('[data-testid="answer-line"]').text()).toBe('Jawab 5 daripada 5')

      await wrapper!.get('#kontrak-s0-marks-list').setValue('3,3,3,5,4')
      await flushPromises()
      expect(wrapper!.text()).toContain('Jumlah markah 18 / 18 markah')
      expect(wrapper!.text()).not.toContain(MSG.marksPerQuestionMismatch)

      await wrapper!.get('#kontrak-s0-marks-list').setValue('3,3,3,5,5')
      await flushPromises()
      expect(wrapper!.text()).toContain(MSG.marksPerQuestionMismatch)
    })

    it('shows the exclusion on the checkbox when Wajib dijawab meets Pilih N', async () => {
      server()
      await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/1?paparan=bahagian-1')
      await wrapper!.get('#kontrak-s0-compulsory').trigger('click')
      await flushPromises()
      expect(wrapper!.text()).not.toContain(MSG.compulsoryChoose)
      await wrapper!.get('[data-testid="rule-kind"]').findAll('[role="radio"]')[1]!.trigger('click')
      await flushPromises()
      expect(wrapper!.text()).toContain(MSG.compulsoryChoose)
    })
  })

  describe('the Umum tab', () => {
    it('edits Bilangan soalan dalam kertas and lists the derived line per section', async () => {
      server()
      await open(KontrakEditorPage, '/admin/spm/kontrak/MAT/1')
      expect(wrapper!.get('[data-testid="section-row-0"]').text()).toContain('Jawab 10 daripada 10')
      await wrapper!.get('#kontrak-umum-question-count').setValue('201')
      await flushPromises()
      expect(wrapper!.text()).toContain('Bilangan soalan tidak sah.')
    })

    it('a refused create shows the server message in the save summary', async () => {
      const api = server()
      vi.spyOn(api, 'create').mockRejectedValue(new KontrakError('invalid', MSG.dskpNotLoaded, { fields: { subject: MSG.dskpNotLoaded } }))
      await open(KontrakEditorPage, '/admin/spm/kontrak/KIM/1?baharu=1')
      await wrapper!.get('#kontrak-umum-code').setValue('4541/1')
      await wrapper!.get('#kontrak-umum-duration').setValue('60')
      await wrapper!.get('#kontrak-umum-jumlah').setValue('10')
      const r = wrapper!.vm.$router
      await r.replace({ query: { baharu: '1', paparan: 'bahagian-1' } })
      await flushPromises()
      await wrapper!.get('#kontrak-s0-m').setValue('10')
      await wrapper!.get('#kontrak-s0-budget').setValue('10')
      await wrapper!.get('form').trigger('submit')
      await flushPromises()
      expect(wrapper!.get('[data-testid="save-summary"]').text()).toContain(MSG.dskpNotLoaded)
    })
  })

  describe('the list and Baharu (FR-ADM-Q16.5, FR-ADM-Q16.7, 16-01, 16-02)', () => {
    const optionValues = (testid: string): string[] =>
      Array.from(document.querySelectorAll<HTMLOptionElement>(`[data-testid="${testid}"] option`)).map((o) => o.value)
    const openAdd = async (): Promise<void> => {
      await wrapper!.get('[data-testid="kontrak-add"]').trigger('click')
      await flushPromises()
    }
    const continueButton = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('[data-testid="add-continue"]')!

    it('offers Kertas 1 to 4 in the filter and in Baharu', async () => {
      server()
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }))
      await open(KontrakListPage, '/admin/spm/kontrak')
      expect(optionValues('kontrak-kertas')).toEqual(expect.arrayContaining(['1', '2', '3', '4']))
      await openAdd()
      expect(optionValues('add-kertas')).toEqual(expect.arrayContaining(['1', '2', '3', '4']))
    })

    it('marks a contract with no evidence "perlu semakan", apart from the needsReview flag', async () => {
      const api = server()
      const list = await api.list()
      const withEvidence = list.filter((v) => v.evidenceCount > 0)
      const without = list.filter((v) => v.evidenceCount === 0)
      expect(withEvidence.length).toBeGreaterThan(0)
      expect(without.length).toBeGreaterThan(0)
      expect(without.every((v) => !v.needsReview)).toBe(true)
      await open(KontrakListPage, '/admin/spm/kontrak')
      const badges = wrapper!.findAll('[data-testid="no-evidence"]')
      expect(badges.length).toBeGreaterThanOrEqual(without.length)
      expect(badges[0]!.text()).toBe('perlu semakan')
    })

    it('lists what the server returns and uses the PRD text for a missing subject and a duplicate', async () => {
      server()
      await open(KontrakListPage, '/admin/spm/kontrak')
      await openAdd()
      continueButton().click()
      await flushPromises()
      expect(document.body.textContent).toContain('Sila pilih subjek.')
      expect(optionValues('add-subject').filter(Boolean)).toEqual(['MAT', 'SN', 'SEJ'])
    })

    it('answers a duplicate subject and kertas with the one contract message', async () => {
      server()
      await open(KontrakListPage, '/admin/spm/kontrak')
      await openAdd()
      for (const [id, value] of [['add-subject', 'MAT'], ['add-kertas', '1']] as const) {
        const el = document.querySelector<HTMLSelectElement>(`[data-testid="${id}"]`)!
        el.value = value
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      await flushPromises()
      expect(document.querySelector('[data-testid="add-exists"]')?.textContent).toContain(MSG.blueprintExists)
    })

    it('says so when no subject has its DSKP loaded, and does not let the admin continue', async () => {
      const api = server()
      api.subjectOptions = () => Promise.resolve([])
      await open(KontrakListPage, '/admin/spm/kontrak')
      await openAdd()
      expect(document.querySelector('[data-testid="add-subjects-empty"]')?.textContent).toContain('Tiada subjek')
      expect(continueButton().disabled).toBe(true)
    })

    it('tells a failed list apart from an empty one, and retries', async () => {
      const api = server()
      const real = api.subjectOptions.bind(api)
      api.subjectOptions = vi.fn().mockRejectedValueOnce(new Error('x')).mockImplementation(real)
      await open(KontrakListPage, '/admin/spm/kontrak')
      await openAdd()
      expect(document.body.textContent).toContain('Tidak dapat memuatkan senarai subjek. Sila cuba semula.')
      expect(document.querySelector('[data-testid="add-subjects-empty"]')).toBeNull()
      expect(continueButton().disabled).toBe(true)
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Cuba Semula'))!.click()
      await flushPromises()
      expect(document.body.textContent).not.toContain('Tidak dapat memuatkan senarai subjek.')
      expect(continueButton().disabled).toBe(false)
    })
  })
})
