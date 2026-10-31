/**
 * In-browser mock of `KontrakApi` (BJS-F1..F4), seeded from the Bijak blueprint registry. It follows
 * the contract shapes of `packages/contract/src/bijak/{builder,standards}`: version rows, the
 * "server decides the source" rule (AC-39.4), 409 on a locked head, 422 lists, and the verification
 * check of AC-39.1 / AC-39.7. The pool preview is a deterministic synthetic (the real one is the
 * generator's solver); it is only there so the screens have honest numbers to show.
 * Loaded by a dynamic import behind the env check (see ./client), so the http build never has it.
 */
import type {
  BijakBlueprintAdminCreate,
  BijakBlueprintAdminVersionInput,
  BijakBlueprintProblem,
  BijakBlueprintVersionItem,
  BijakBlueprintView,
  BijakEvidenceInput,
  BijakEvidenceItem,
  BijakEvidenceLine,
  BijakPoolPreview,
  BijakDskpUnit,
  BijakUnitRefView,
  BijakVerificationCheck,
  BijakVerificationRecord,
  BijakVerificationState,
  BijakVerificationSummary,
} from '@pp/contract'

import { BLUEPRINTS, SUBJECTS, subjectName } from '../../../data/registry'
import { formFromView, structuralKey } from '../domain/form'
import { REASON_BANK_QUERY } from '../domain/pool'
import { validateForm } from '../domain/validate'
import { KontrakError, type KontrakApi } from './api'

type Input = BijakBlueprintAdminVersionInput
type SectionInput = Input['sections'][number]

/* ------------------------------------------------------------------------------- seed units */

const U = (
  subject: string,
  level: 'T4' | 'T5',
  n: number,
  title: string,
): BijakUnitRefView => ({
  kind: 'unit',
  nodeId: `u-${subject.toLowerCase()}-${level.toLowerCase()}-${n}`,
  code: `${n}.0`,
  level,
  title,
})

const UNITS: Record<string, BijakUnitRefView[]> = {
  MAT: [
    U('MAT', 'T4', 1, 'Fungsi dan Persamaan Kuadratik'),
    U('MAT', 'T4', 2, 'Asas Nombor'),
    U('MAT', 'T4', 3, 'Penaakulan Logik'),
    U('MAT', 'T4', 4, 'Operasi Set'),
    U('MAT', 'T4', 7, 'Graf Gerakan'),
    U('MAT', 'T4', 9, 'Kebarangkalian Peristiwa Bergabung'),
    U('MAT', 'T5', 1, 'Ubahan'),
    U('MAT', 'T5', 2, 'Matriks'),
    U('MAT', 'T5', 5, 'Kekongruenan, Pembesaran dan Gabungan Transformasi'),
    U('MAT', 'T5', 8, 'Pemodelan Matematik'),
  ],
  SN: [
    U('SN', 'T4', 1, 'Pengenalan kepada Sains'),
    U('SN', 'T4', 2, 'Struktur Sel dan Organisasi Sel'),
    U('SN', 'T4', 5, 'Tindak Balas Redoks'),
    U('SN', 'T5', 1, 'Daya dan Gerakan'),
    U('SN', 'T5', 3, 'Elektrik'),
  ],
  SEJ: [
    U('SEJ', 'T4', 1, 'Tajuk 1'),
    U('SEJ', 'T4', 2, 'Tajuk 2'),
    U('SEJ', 'T5', 1, 'Tajuk 1'),
    U('SEJ', 'T5', 2, 'Tajuk 2'),
  ],
}

/** One microtask, like the latency of a real call (keeps every method truly async). */
const tick = (): Promise<void> => Promise.resolve()

/* ------------------------------------------------------------------------------- state */

interface Ver {
  view: BijakBlueprintView
  createdAt: string
  hash: string
  evidenceIds: string[]
  verification: BijakVerificationRecord | null
}
interface Rec {
  versions: Ver[]
  retired: boolean
}

const now = (): string => new Date().toISOString()
const hash = (s: string): number => {
  let h = 7
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function unitView(subject: string, ref: { kind: 'unit'; nodeId: string } | { kind: 't1_t3' }): BijakUnitRefView {
  if (ref.kind === 't1_t3') return { kind: 't1_t3' }
  return (UNITS[subject] ?? []).find((u) => u.kind === 'unit' && u.nodeId === ref.nodeId) ?? { kind: 'unit', nodeId: ref.nodeId }
}

function instructionOf(s: SectionInput): string {
  if (s.instruction) return s.instruction
  return s.rule.type === 'all' ? 'Jawab semua soalan.' : `Jawab ${s.rule.n} daripada ${s.questionCount} soalan.`
}

function sectionView(subject: string, s: SectionInput, position: number, seededUnreviewed: boolean): BijakBlueprintView['sections'][number] {
  return {
    position,
    label: s.label,
    markBudget: s.markBudget,
    questionCount: s.questionCount,
    compulsory: s.compulsory ?? false,
    instruction: instructionOf(s),
    rule: s.rule,
    pool: s.pool ?? null,
    profile: s.profile
      ? {
          kind: s.profile.kind,
          groups: s.profile.groups.map((g) => ({
            ...g,
            ...(g.units ? { units: g.units.map((u) => unitView(subject, u)) } : {}),
          })),
        }
      : null,
    quota: s.quota
      ? {
          basis: s.quota.basis,
          lines: s.quota.lines.map((l) => ({
            ...(l.tag ? { tag: l.tag } : {}),
            unit: unitView(subject, l.unit),
            value: l.value,
            reviewed: !seededUnreviewed,
          })),
          ...(s.quota.levelShare ? { levelShare: s.quota.levelShare } : {}),
        }
      : null,
    kbatMarks: s.kbatMarks ?? null,
    kbatReviewed: !seededUnreviewed,
    allowedModes: s.allowedModes ?? [],
  }
}

function viewOf(
  subject: string,
  kertas: number,
  version: number,
  source: BijakBlueprintView['source'],
  input: Input,
  verification: BijakVerificationSummary | null,
  evidenceCount: number,
  seededUnreviewed = false,
): BijakBlueprintView {
  const sections = input.sections.map((s, i) => sectionView(subject, s, i + 1, seededUnreviewed))
  return {
    subject,
    subjectName: subjectName(subject),
    kertas,
    source,
    code: input.code,
    durationMin: input.durationMin,
    instructions: input.instructions ?? [],
    totalMarks: sections.reduce((n, s) => n + s.markBudget, 0),
    sections,
    version,
    servesStudents: source === 'Disahkan',
    reference: [],
    dependentPaperCount: 0,
    verification,
    evidenceCount,
    notes: input.notes ?? null,
    subPartRamp: input.subPartRamp ?? false,
    kbatMarks: input.kbatMarks ?? null,
    levelShare: input.levelShare ?? null,
    warnings: [],
    needsReview: false,
    reviewPapers: [],
  }
}

/* ------------------------------------------------------------------------------- server */

export interface MockKontrakOptions {
  /** Creates the draft paper behind "Jana draf kertas" (default: the Bijak admin mock). */
  createPaper?: (subject: string, kertas: number) => Promise<string>
}

export class MockKontrakServer implements KontrakApi {
  private readonly recs = new Map<string, Rec>()
  private readonly evidenceStore = new Map<string, BijakEvidenceItem>()
  private seq = 0

  constructor(private readonly options: MockKontrakOptions = {}) {
    this.seed()
  }

  private key = (subject: string, kertas: number): string => `${subject}/${kertas}`

  private seed(): void {
    for (const bp of BLUEPRINTS) {
      const input: Input = {
        code: bp.code,
        durationMin: bp.durationMin,
        instructions: bp.instructions,
        sections: bp.sections.map((s) => ({
          label: s.label,
          markBudget: s.markBudget ?? s.take,
          questionCount: s.take,
          compulsory: !!s.compulsory,
          ...(s.instruction ? { instruction: s.instruction } : {}),
          rule: s.rule,
          pool: s.pool,
        })),
      }
      // Matematik Kertas 2: values seeded from the study, not yet reviewed (AC-39.9 "Belum disemak").
      if (bp.subject === 'MAT' && bp.kertas === 2) {
        const [a, b] = [input.sections[0]!, input.sections[1]!]
        const u4 = UNITS.MAT![0] as { kind: 'unit'; nodeId: string }
        const u5 = UNITS.MAT![6] as { kind: 'unit'; nodeId: string }
        a.profile = { kind: 'bahagian', groups: [{ from: 1, to: 3, tpMin: 1, tpMax: 3 }] }
        a.quota = {
          basis: 'questions',
          lines: [
            { tag: 'observed', unit: { kind: 'unit', nodeId: u4.nodeId }, value: 2 },
            { tag: 'inferred', unit: { kind: 'unit', nodeId: u5.nodeId }, value: 1 },
          ],
        }
        a.kbatMarks = 2
        b.kbatMarks = 3
      }
      const id = this.key(bp.subject, bp.kertas)
      const study: BijakEvidenceItem[] =
        bp.subject === 'MAT' && bp.kertas === 2
          ? [
              {
                id: `ev-seed-${(this.seq += 1)}`,
                kind: 'trial_paper',
                body: 'sbp',
                year: 2025,
                paperCode: bp.code,
                setLabel: null,
                sourceRef: null,
                values: { durationMin: bp.durationMin },
                origin: 'study',
                note: 'Dari kajian, belum disahkan oleh manusia',
                createdAt: now(),
              },
            ]
          : []
      for (const e of study) this.evidenceStore.set(e.id, e)
      const view = viewOf(bp.subject, bp.kertas, 1, bp.source, input, null, study.length, bp.subject === 'MAT' && bp.kertas === 2)
      this.recs.set(id, {
        retired: false,
        versions: [{ view, createdAt: now(), hash: structuralKey(input), evidenceIds: study.map((e) => e.id), verification: null }],
      })
    }
  }

  private rec(subject: string, kertas: number): Rec {
    const r = this.recs.get(this.key(subject, kertas))
    if (!r || r.retired) throw new KontrakError('not_found', 'Kontrak tidak ditemui')
    return r
  }
  private head(subject: string, kertas: number): Ver {
    const r = this.rec(subject, kertas)
    return r.versions[r.versions.length - 1]!
  }
  private servingVersion(r: Rec): number | null {
    for (let i = r.versions.length - 1; i >= 0; i -= 1) {
      if (r.versions[i]!.view.source === 'Disahkan') return r.versions[i]!.view.version
    }
    return null
  }
  private viewOfHead(r: Rec): BijakBlueprintView {
    const h = r.versions[r.versions.length - 1]!
    const serving = this.servingVersion(r)
    return {
      ...h.view,
      servesStudents: serving === h.view.version,
      ...(serving !== null ? { servingVersion: serving } : {}),
      evidenceCount: h.evidenceIds.length,
    }
  }

  async list(): Promise<BijakBlueprintView[]> {
    await tick()
    return [...this.recs.values()].filter((r) => !r.retired).map((r) => this.viewOfHead(r))
  }
  async get(subject: string, kertas: number): Promise<BijakBlueprintView> {
    await tick()
    return this.viewOfHead(this.rec(subject, kertas))
  }

  private checkInput(input: Input): void {
    const problems: BijakBlueprintProblem[] = []
    const sum = input.sections.reduce((n, s) => n + s.markBudget, 0)
    if (input.totalMarks !== undefined && input.totalMarks !== sum)
      problems.push({ code: 'TOTAL_MISMATCH', expected: input.totalMarks, actual: sum })
    input.sections.forEach((s, i) => {
      if (s.rule.type === 'choose' && s.questionCount < s.rule.n)
        problems.push({ code: 'CHOOSE_N_RANGE', sectionPosition: i + 1, expected: s.rule.n, actual: s.questionCount })
    })
    if (problems.length) throw new KontrakError('invalid', 'Kontrak tidak boleh disimpan. Betulkan masalah yang disenaraikan.', { problems })
  }

  async create(body: BijakBlueprintAdminCreate): Promise<BijakBlueprintView> {
    await tick()
    const k = this.key(body.subject, body.kertas)
    const old = this.recs.get(k)
    if (old && !old.retired) throw new KontrakError('conflict', 'Kontrak untuk subjek dan kertas ini sudah wujud.')
    this.checkInput(body)
    const { subject, kertas, ...input } = body
    const view = viewOf(subject, kertas, 1, input.source ?? 'Draf', input, null, 0)
    this.recs.set(k, {
      retired: false,
      versions: [{ view, createdAt: now(), hash: structuralKey(input), evidenceIds: [], verification: null }],
    })
    return view
  }

  async saveVersion(subject: string, kertas: number, body: Input): Promise<BijakBlueprintView> {
    await tick()
    const r = this.rec(subject, kertas)
    this.checkInput(body)
    const prev = r.versions[r.versions.length - 1]!
    const h = structuralKey(body)
    let source: BijakBlueprintView['source']
    if (body.source) source = body.source
    else source = prev.view.source === 'Disahkan' && prev.hash === h ? 'Disahkan' : 'Spec'
    const keep = source === 'Disahkan' && prev.view.source === 'Disahkan' && prev.hash === h
    const view = viewOf(subject, kertas, prev.view.version + 1, source, body, keep ? prev.view.verification : null, prev.evidenceIds.length)
    r.versions.push({
      view,
      createdAt: now(),
      hash: h,
      evidenceIds: [...prev.evidenceIds],
      verification: keep ? prev.verification : null,
    })
    return this.viewOfHead(r)
  }

  async retire(subject: string, kertas: number): Promise<void> {
    await tick()
    this.rec(subject, kertas).retired = true
  }

  async versions(subject: string, kertas: number): Promise<BijakBlueprintVersionItem[]> {
    await tick()
    const r = this.rec(subject, kertas)
    const serving = this.servingVersion(r)
    return [...r.versions]
      .reverse()
      .map((v, i) => ({
        version: v.view.version,
        status: i === 0 ? (v.view.source === 'Draf' ? ('draft' as const) : ('active' as const)) : ('retired' as const),
        source: v.view.source,
        servesStudents: serving === v.view.version,
        createdAt: v.createdAt,
        structureHash: String(v.hash.length) + ':' + hash(v.hash),
        ...(v.view.verification ? { verification: v.view.verification } : {}),
      }))
  }

  /** `POST .../sections/{position}/review` (AC-39.9): stamps one section of the head reviewed in place (no new version). */
  async reviewSection(subject: string, kertas: number, position: number): Promise<BijakBlueprintView> {
    await tick()
    const r = this.rec(subject, kertas)
    const h = r.versions[r.versions.length - 1]!
    const index = h.view.sections.findIndex((s) => s.position === position)
    if (index < 0) throw new KontrakError('not_found', 'Kontrak tidak ditemui')
    this.lockedCheck(h)
    h.view = {
      ...h.view,
      sections: h.view.sections.map((s, i) =>
        i === index
          ? {
              ...s,
              ...(s.quota ? { quota: { ...s.quota, lines: s.quota.lines.map((l) => ({ ...l, reviewed: true })) } } : {}),
              kbatReviewed: true,
            }
          : s,
      ),
    }
    return this.viewOfHead(r)
  }

  async evidence(subject: string, kertas: number): Promise<BijakEvidenceItem[]> {
    await tick()
    return this.head(subject, kertas).evidenceIds.map((id) => this.evidenceStore.get(id)!).filter(Boolean)
  }

  private lockedCheck(h: Ver): void {
    if (h.view.source === 'Disahkan')
      throw new KontrakError('conflict', 'Kontrak Disahkan tidak boleh diubah di tempat. Cipta versi baharu dahulu.')
  }

  async addEvidence(subject: string, kertas: number, body: BijakEvidenceInput): Promise<BijakEvidenceItem> {
    await tick()
    const h = this.head(subject, kertas)
    this.lockedCheck(h)
    const item: BijakEvidenceItem = {
      id: `ev-${(this.seq += 1)}`,
      kind: body.kind,
      body: body.body,
      year: body.year,
      paperCode: body.paperCode,
      setLabel: body.setLabel ?? null,
      sourceRef: body.sourceRef ?? null,
      values: body.values,
      origin: 'admin',
      note: body.note ?? null,
      createdAt: now(),
    }
    this.evidenceStore.set(item.id, item)
    h.evidenceIds.push(item.id)
    return item
  }

  async removeEvidence(subject: string, kertas: number, evidenceId: string): Promise<void> {
    await tick()
    const h = this.head(subject, kertas)
    this.lockedCheck(h)
    if (!h.evidenceIds.includes(evidenceId)) throw new KontrakError('not_found', 'Bukti tidak ditemui')
    h.evidenceIds = h.evidenceIds.filter((id) => id !== evidenceId)
  }

  /** The gate of AC-39.1 and AC-39.7 against the head. */
  private computeCheck(h: Ver): BijakVerificationCheck {
    const form = formFromView(h.view)
    const blueprintProblems: BijakBlueprintProblem[] = validateForm(form)
      .filter((i) => i.level === 'error' && i.code !== 'REQUIRED')
      .map((i) => ({
        code: (['TOTAL_MISMATCH', 'CHOOSE_N_RANGE', 'SLOT_OVERLAP', 'SLOT_GAP', 'PROFILE_SHAPE', 'TP_COUNTS', 'MARKS_BAND', 'QUOTA_SUM', 'QUOTA_UNIT', 'LEVEL_SHARE', 'KBAT_RANGE', 'KBAT_TOTAL'].includes(i.code)
          ? i.code
          : 'PROFILE_SHAPE') as BijakBlueprintProblem['code'],
        ...(i.section !== null ? { sectionPosition: i.section + 1 } : {}),
      }))
    const completeness: BijakVerificationCheck['completeness'] = []
    h.view.sections.forEach((s) => {
      if (!s.profile) completeness.push({ code: 'NO_PROFILE', sectionPosition: s.position })
      if (!s.quota) completeness.push({ code: 'NO_QUOTA', sectionPosition: s.position })
      if (s.kbatMarks === null) completeness.push({ code: 'NO_KBAT', sectionPosition: s.position })
      for (const l of s.quota?.lines ?? [])
        if (!l.reviewed) completeness.push({ code: 'UNREVIEWED', sectionPosition: s.position, unit: l.unit })
      if (s.kbatMarks !== null && !s.kbatReviewed) completeness.push({ code: 'UNREVIEWED', sectionPosition: s.position })
    })
    const items = h.evidenceIds.map((id) => this.evidenceStore.get(id)!).filter(Boolean)
    const counted = items.filter((e) => e.origin === 'admin')
    const bodies = new Set(counted.map((e) => (e.kind === 'lpm_format' ? `lpm:${e.id}` : e.body)))
    const lpm = counted.some((e) => e.kind === 'lpm_format')
    if (bodies.size < 2 && !lpm) completeness.push({ code: 'NO_EVIDENCE_BODIES' })

    const lines: BijakEvidenceLine[] = []
    const compare = (
      field: BijakEvidenceLine['field'],
      expected: unknown,
      pick: (e: BijakEvidenceItem) => unknown,
      sectionPosition?: number,
    ): void => {
      const statements = counted
        .map((e) => ({ e, v: pick(e) }))
        .filter((x) => x.v !== undefined)
        .map((x) => ({ evidenceId: x.e.id, body: x.e.body, kind: x.e.kind, value: x.v }))
      const same = (v: unknown): boolean => JSON.stringify(v) === JSON.stringify(expected)
      const supporting = new Set(statements.filter((s) => same(s.value)).map((s) => s.body)).size
      let status: BijakEvidenceLine['status'] = 'ok'
      if (statements.length === 0) status = 'not_covered'
      else if (statements.some((s) => !same(s.value))) status = 'differs'
      else if (supporting < 2) status = 'tidak_disahkan'
      lines.push({ field, ...(sectionPosition ? { sectionPosition } : {}), expected, statements, supportingBodies: supporting, status })
    }
    compare('durationMin', h.view.durationMin, (e) => e.values.durationMin)
    compare('totalMarks', h.view.totalMarks, (e) => e.values.totalMarks)
    for (const s of h.view.sections) {
      const at = (e: BijakEvidenceItem) => e.values.sections?.find((x) => x.position === s.position)
      compare('markBudget', s.markBudget, (e) => at(e)?.markBudget, s.position)
      compare('rule', s.rule, (e) => at(e)?.rule, s.position)
      compare('questionCount', s.questionCount, (e) => at(e)?.questionCount, s.position)
    }
    const passes = blueprintProblems.length === 0 && completeness.length === 0 && lines.every((l) => l.status === 'ok')
    return { passes, blueprintProblems, completeness, lines }
  }

  async verification(subject: string, kertas: number): Promise<BijakVerificationState> {
    await tick()
    const h = this.head(subject, kertas)
    return { record: h.view.source === 'Disahkan' ? h.verification : null, check: this.computeCheck(h) }
  }

  async verify(subject: string, kertas: number, note: string): Promise<BijakBlueprintView> {
    await tick()
    const r = this.rec(subject, kertas)
    const h = r.versions[r.versions.length - 1]!
    if (h.view.source === 'Disahkan') throw new KontrakError('conflict', 'Kontrak ini sudah Disahkan.')
    const check = this.computeCheck(h)
    if (!check.passes) throw new KontrakError('verification', 'Kontrak belum boleh disahkan. Semak senarai kegagalan.', { check })
    const items = h.evidenceIds.map((id) => this.evidenceStore.get(id)!).filter(Boolean)
    const summary: BijakVerificationSummary = {
      verifiedAt: now(),
      verifierName: 'Pentadbir Pusat (contoh)',
      verifierRole: 'admin',
      evidenceLabel: items.map((e) => `${e.body.toUpperCase()} ${e.year}`).join(', '),
      bodies: [...new Set(items.map((e) => e.body))],
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    h.view = { ...h.view, source: 'Disahkan', verification: summary }
    h.verification = { ...summary, evidence: items, lines: check.lines }
    return this.viewOfHead(r)
  }

  async pool(subject: string, kertas: number): Promise<BijakPoolPreview> {
    await tick()
    const h = this.head(subject, kertas)
    const v = h.view
    const q = { subject, kertas: String(kertas), status: 'approved' }
    const sections: BijakPoolPreview['sections'] = v.sections.map((s) => {
      const base = `${subject}${kertas}${s.label}`
      const sh = (needed: number, available: number) => ({ needed, available, short: Math.max(0, needed - available) })
      return {
        position: s.position,
        label: s.label,
        slots: s.questionCount,
        effectiveMarks: s.markBudget,
        offeredMarks: s.rule.type === 'all' ? s.markBudget : Math.round((s.markBudget / s.rule.n) * s.questionCount),
        eligible: s.questionCount * 3 + (hash(base) % 5),
        modeExcluded: hash(base + 'm') % 3,
        counts: sh(s.questionCount, s.questionCount * 3 + (hash(base) % 5)),
        marks: { needed: s.markBudget, reachable: true },
        quota: (s.quota?.lines ?? []).map((l) => {
          const k = l.unit.kind === 'unit' ? l.unit.nodeId : 't1_t3'
          return { ...sh(l.value, Math.max(0, l.value + (hash(base + k) % 8) - 3)), unit: l.unit, basis: s.quota!.basis }
        }),
        tp: (s.profile?.groups ?? []).map((g) => {
          const size = g.to - g.from + 1
          return { ...sh(size, size + (hash(base + g.from) % 5) - 1), slot: { from: g.from, to: g.to }, tpMin: g.tpMin, tpMax: g.tpMax }
        }),
        kbat: s.kbatMarks === null ? null : sh(s.kbatMarks, Math.max(0, s.kbatMarks + (hash(base + 'k') % 6) - 2)),
        bankQuery: { ...q, section: s.label },
      }
    })
    const firstShort = sections.find((s) => s.counts.short || s.quota.some((x) => x.short) || s.tp.some((x) => x.short) || s.kbat?.short)
    const shortQuota = firstShort?.quota.find((x) => x.short)
    const byReason = [
      { reason: 'no_unit' as const, count: 3 },
      { reason: 'no_tp' as const, count: 2 },
      { reason: 'no_marks' as const, count: 0 },
      { reason: 'no_key' as const, count: 0 },
      { reason: 'tag_review' as const, count: 1 },
    ].map((r) => ({ ...r, bankQuery: { ...q, ...REASON_BANK_QUERY[r.reason] } }))
    return {
      blueprint: { version: v.version, source: v.source },
      verdict: firstShort ? 'tidak_boleh' : 'boleh',
      firstFailure: firstShort
        ? {
            section: firstShort.label,
            need: (shortQuota?.needed ?? firstShort.counts.needed) || 1,
            have: shortQuota?.available ?? firstShort.counts.available,
            kind: shortQuota ? 'unit' : 'count',
            ...(shortQuota ? { unit: shortQuota.unit, basis: shortQuota.basis } : {}),
          }
        : null,
      publishedTotal: 40,
      eligibleTotal: 35,
      excluded: { total: 5, byReason },
      warnings: v.warnings,
      sections,
    }
  }

  async generateDraft(subject: string, kertas: number): Promise<{ paperId: string }> {
    const pool = await this.pool(subject, kertas)
    if (pool.verdict !== 'boleh' && pool.firstFailure)
      throw new KontrakError('shortage', 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.', { shortages: [pool.firstFailure] })
    const make =
      this.options.createPaper ??
      (async (s: string, k: number) => {
        const { bijakAdminServer } = await import('../../../server/client')
        return (bijakAdminServer() as unknown as { createPaper(i: { subject: string; kertas: 1 | 2 }): Promise<string> }).createPaper({
          subject: s,
          kertas: k as 1 | 2,
        })
      })
    return { paperId: await make(subject, kertas) }
  }

  async listUnits(subject: string): Promise<BijakDskpUnit[]> {
    await tick()
    return (UNITS[subject] ?? []).flatMap((u) =>
      u.kind === 'unit' && u.code && u.level
        ? [{ nodeId: u.nodeId, code: u.code, level: u.level, title: u.title ?? '', elective: false }]
        : [],
    )
  }

  async subjectOptions(): Promise<{ code: string; name: string }[]> {
    await tick()
    return SUBJECTS.map((s) => ({ code: s.code, name: s.name }))
  }
}

export function createMockKontrakServer(options: MockKontrakOptions = {}): MockKontrakServer {
  return new MockKontrakServer(options)
}
