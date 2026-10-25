/**
 * State and handlers of the Tag DSKP block (UX spec 3, DSKP-T07). `QuestionEditor` renders; this holds
 * the logic: which phase the catalogue is in, the option lists, the AI state of each field, the
 * clearing notices and the edits. Every edit goes through the pure helpers of `domain/tag-edit.ts`
 * and is only normalised against a catalogue that is loaded for the question's subject (an unloaded
 * subject makes every SP look like it is outside its unit, DSKP-T03 review F4).
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { KBAT_LEVELS } from '../../../domain/types'
import type { DskpSpId, DskpUnitId, FormOrigin, KbatLevel, TpLevel } from '../../../domain/types'
import { normaliseTag, setFormOrigin, setUnit, toggleSp, willClearOnFormOrigin } from '../../../domain/tag-edit'
import { tagIssues } from '../../../domain/tag-rule'
import type { CurriculumTag } from '../../../domain/types'
import { catalogueVersion, tagLookup } from '../../../lib/dskp-source'
import type { DskpSubjectInfo, DskpSubjectState } from '../../../lib/dskp-source'
import { changedFromSuggestion, tagFieldPath } from '../domain/suggestion'
import type { TagField } from '../domain/suggestion'
import {
  aiFieldState,
  describeTp,
  inPrintOrder,
  missingUnitId,
  skRows,
  suggestionLabel,
  unitOptionGroups,
} from '../domain/tag-view'
import type { AiFieldState } from '../domain/tag-view'
import { fieldsToConfirm } from '../domain/validation'
import type { IntakeQuestion } from '../types'

const FIELDS: readonly TagField[] = ['unit', 'sp', 'tp', 'kbat']

export type TagPhase = 'loading' | 'error' | 'ready' | 'none'
export type TagNotice = 'form' | 'unit' | null

export interface TagEditor {
  phase: ComputedRef<TagPhase>
  /** T4 or T5: unit, SP and SK are asked for. */
  inDskp: ComputedRef<boolean>
  /** T1-T3: unit, SP and SK are shown disabled and empty. */
  outside: ComputedRef<boolean>
  info: ComputedRef<DskpSubjectInfo | undefined>
  groups: ComputedRef<ReturnType<typeof unitOptionGroups>>
  missingUnit: ComputedRef<string | null>
  sk: ComputedRef<ReturnType<typeof skRows>>
  tpDescription: ComputedRef<ReturnType<typeof describeTp>>
  ai: ComputedRef<Record<TagField, AiFieldState>>
  /** Label of the AI-suggested value a person changed away from, per field. */
  changedFrom: ComputedRef<Partial<Record<TagField, string>>>
  notice: Ref<TagNotice>
  errors: ComputedRef<{ form?: string; unit?: string; sp?: string; tp?: string }>
  setForm: (origin: string) => void
  setUnit: (id: string) => void
  toggleSp: (id: string, on: boolean) => void
  setTp: (v: string | number | undefined) => void
  setKbat: (v: string) => void
  confirm: (field: string, on: boolean) => void
}

export function useTagEditor(opts: {
  question: () => IntakeQuestion
  dskp: DskpSubjectState
  commit: (q: IntakeQuestion) => void
  showErrors: () => boolean
}): TagEditor {
  const { dskp } = opts
  const q = computed(() => opts.question())
  const notice = ref<TagNotice>(null)

  const phase = computed<TagPhase>(() =>
    dskp.loading.value ? 'loading' : dskp.error.value ? 'error' : dskp.view.value ? 'ready' : 'none',
  )
  const inDskp = computed(() => q.value.tag.formOrigin === 'T4' || q.value.tag.formOrigin === 'T5')
  const outside = computed(() => q.value.tag.formOrigin === 'T1-T3')
  const info = computed(() => dskp.view.value?.info)

  const groups = computed(() => {
    const view = dskp.view.value
    const t = q.value.tag.formOrigin
    return view && (t === 'T4' || t === 'T5') ? unitOptionGroups(view, t) : []
  })
  const missingUnit = computed(() => missingUnitId(dskp.view.value, q.value.tag))
  const sk = computed(() => {
    const view = dskp.view.value
    return view && !outside.value ? skRows(view, q.value.tag.spIds) : []
  })
  const tpDescription = computed(() =>
    describeTp(dskp.view.value, info.value, q.value.tag, phase.value === 'error'),
  )

  const toConfirm = computed(() => fieldsToConfirm(q.value))
  const ai = computed(() => {
    const out = {} as Record<TagField, AiFieldState>
    for (const f of FIELDS) {
      out[f] =
        outside.value && (f === 'unit' || f === 'sp')
          ? { badge: null, confirm: false, confirmed: false, changedFrom: undefined, noMatch: false }
          : aiFieldState(q.value, f, toConfirm.value.includes(tagFieldPath(f)))
    }
    return out
  })
  const changedFrom = computed(() => {
    const out: Partial<Record<TagField, string>> = {}
    for (const f of FIELDS)
      if (ai.value[f].changedFrom !== undefined)
        out[f] = suggestionLabel(dskp.view.value, f, ai.value[f].changedFrom)
    return out
  })

  /** The gate messages of the rule per control, once the page shows its issues list. */
  const errors = computed(() => {
    if (!opts.showErrors() || phase.value === 'loading' || phase.value === 'error') return {}
    const out: { form?: string; unit?: string; sp?: string; tp?: string } = {}
    for (const i of tagIssues(q.value.tag, tagLookup())) {
      const key = i.field === 'subject' || i.field === 'formOrigin' ? 'form' : i.field
      if ((key === 'form' || key === 'unit' || key === 'sp' || key === 'tp') && out[key] === undefined)
        out[key] = i.message
    }
    return out
  })

  /** Write the tag (and the confirmations it makes stale) back to the question. */
  function apply(tag: CurriculumTag): void {
    const cur = q.value
    const safe = dskp.view.value !== undefined || (tag.unitId === null && tag.spIds.length === 0)
    const next = safe ? normaliseTag(tag, tagLookup(), catalogueVersion()) : tag
    // A tick belongs to the AI value: once the person changes the value it is dropped (design 3.6).
    const confirmed = cur.tagSuggestion
      ? cur.confirmed.filter((path) => {
          const f = FIELDS.find((x) => tagFieldPath(x) === path)
          return !f || !changedFromSuggestion(next, cur.tagSuggestion, f)
        })
      : cur.confirmed
    opts.commit({ ...cur, tag: next, confirmed })
  }

  function setForm(origin: string): void {
    const value = origin === '' ? null : (origin as FormOrigin)
    const tag = q.value.tag
    notice.value = willClearOnFormOrigin(tag, value) ? 'form' : null
    apply(setFormOrigin(tag, value))
  }
  function changeUnit(id: string): void {
    const tag = q.value.tag
    const view = dskp.view.value
    if (!view) return
    const next = setUnit(tag, id === '' ? null : (id as DskpUnitId), tagLookup())
    notice.value = next.spIds.length < tag.spIds.length ? 'unit' : null
    apply(next)
  }
  function changeSp(id: string, on: boolean): void {
    const view = dskp.view.value
    if (!view) return
    notice.value = null
    const next = toggleSp(q.value.tag, id as DskpSpId, on)
    apply({ ...next, spIds: inPrintOrder(view, next.unitId, next.spIds) })
  }
  function setTp(v: string | number | undefined): void {
    notice.value = null
    const n = v === undefined || v === '' ? null : Number(v)
    apply({ ...q.value.tag, tp: n as TpLevel | null })
  }
  function setKbat(v: string): void {
    notice.value = null
    apply({
      ...q.value.tag,
      kbat: (KBAT_LEVELS as readonly string[]).includes(v) ? (v as KbatLevel) : null,
    })
  }
  function confirm(field: string, on: boolean): void {
    notice.value = null
    const set = new Set(q.value.confirmed)
    if (on) set.add(field)
    else set.delete(field)
    opts.commit({ ...q.value, confirmed: [...set] })
  }

  return {
    phase,
    inDskp,
    outside,
    info,
    groups,
    missingUnit,
    sk,
    tpDescription,
    ai,
    changedFrom,
    notice,
    errors,
    setForm,
    setUnit: changeUnit,
    toggleSp: changeSp,
    setTp,
    setKbat,
    confirm,
  }
}
