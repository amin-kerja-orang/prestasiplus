// @vitest-environment jsdom
// H-C6 (SPP 10.3, AC-39.8): a skema prints no answering rule and no duration, so the evidence drawer
// does not offer them and does not send them; a trial paper still sends both.
import type { BijakEvidenceInput } from '@pp/contract'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EvidenceDrawer from '../admin/kontrak/components/EvidenceDrawer.vue'

// SidePanel is a slideover; render its slots inline so the form is reachable.
const stubs = { SidePanel: { template: '<div><slot /><slot name="footer" /></div>' } }

async function open(kind: 'trial_paper' | 'skema') {
  const w = mount(EvidenceDrawer, { props: { editing: null, saving: false, error: '', open: false }, global: { stubs } })
  await w.setProps({ open: true })
  await flushPromises()
  // pick the kind through the form model: the radio group is a Nuxt UI component, so set it on the instance
  ;(w.vm as unknown as { $: { setupState: { form: { kind: string; rows: unknown[] } } } }).$.setupState.form.kind = kind
  await flushPromises()
  return w
}

function fill(w: Awaited<ReturnType<typeof open>>): void {
  const st = (w.vm as unknown as { $: { setupState: { form: Record<string, unknown> & { rows: Record<string, unknown>[] } } } }).$.setupState
  st.form.body = 'SBP'
  st.form.year = 2025
  st.form.paperCode = '1449/2'
  st.form.durationMin = 150
  st.form.totalMarks = 100
  st.form.rows = [{ label: 'Bahagian A', markBudget: 40, ruleType: 'choose', n: 2, questionCount: 3 }]
}

// Note: editing an existing skema item that carries a rule or duration drops them on save (they are
// not offered for a skema and are not sent), which is intended: a skema prints neither (SPP 10.3).
describe('EvidenceDrawer: skema omits rule and duration', () => {
  it('skema: no rule or duration field, and neither is sent', async () => {
    const w = await open('skema')
    fill(w)
    await flushPromises()
    expect(w.find('[data-testid="skema-no-rule"]').exists()).toBe(true)
    expect(w.find('#ev-duration').exists()).toBe(false)
    await w.get('form').trigger('submit')
    const body = w.emitted('save')![0]![0] as BijakEvidenceInput
    expect(body.values.durationMin).toBeUndefined()
    expect(body.values.sections![0]).toEqual({ position: 1, label: 'Bahagian A', markBudget: 40, questionCount: 3 })
    expect(body.values.totalMarks).toBe(100)
  })
  it('trial paper: rule and duration are sent', async () => {
    const w = await open('trial_paper')
    fill(w)
    await flushPromises()
    expect(w.find('[data-testid="skema-no-rule"]').exists()).toBe(false)
    await w.get('form').trigger('submit')
    const body = w.emitted('save')![0]![0] as BijakEvidenceInput
    expect(body.values.durationMin).toBe(150)
    expect(body.values.sections![0]!.rule).toEqual({ type: 'choose', n: 2 })
  })
})
