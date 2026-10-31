import { Inject, Injectable } from '@nestjs/common'
import {
  SERVABILITY_ACTIVITY_LABELS,
  servabilityReasonMs,
  type ServabilityActivity,
  type ServabilityActivityResult,
  type ServabilityReason,
  type ServabilityReasonCode,
  type ServabilityReport,
} from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { ServabilityService } from './servability.service'

/** The two activities a PAPER decides: the paper itself (Simulasi / Bijak SPM) and its per-paper quiz (Simulasi Kuiz). */
export const PAPER_ACTIVITIES = ['simulasi_paper', 'simulasi_kuiz'] as const satisfies readonly ServabilityActivity[]

/** A placed question the Bijak bridge cannot serve: the paper cannot be opened until it is fixed. */
export interface PaperAttention {
  questionId: string
  reasons: ServabilityReason[]
}

/**
 * R1-T45 / AC-04.3 (v2-admin-student-pipeline US-04): the paper-level line of "Dilihat murid di". For any paper (draft, ready, published,
 * withdrawn) it says whether pupils can open it and where, and for a paper that is not yet open what stands in the way.
 *
 * Tracking A is not a line: in R1 Tracking A is served from its own sets (`spm_tracking_sets`), not from papers, and the servability
 * contract has six activities (D92: "total" is the number of rows, never a literal).
 */
export interface PaperServabilityReport {
  paperId: string
  status: string
  kind: string
  /** Pupils can open the paper in Simulasi (published and every placed question servable). */
  open: boolean
  questionCount: number
  /** `simulasi_paper` then `simulasi_kuiz`, in the shape of the per-question report. */
  activities: ServabilityActivityResult[]
  /** Placed questions that stop the paper (empty when none). */
  attention: PaperAttention[]
  servedCount: number
  total: number
}

const reason = (code: ServabilityReasonCode, activity: ServabilityActivity, detail?: string): ServabilityReason => ({
  code,
  message: servabilityReasonMs(code, activity),
  ...(detail === undefined ? {} : { detail }),
})

@Injectable()
export class PaperServabilityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ServabilityService) private readonly servability: ServabilityService,
  ) {}

  /** Null when the id is not a paper. Read on demand: no cache, so the next view after a publish or withdraw is already right. */
  async report(paperId: string): Promise<PaperServabilityReport | null> {
    if (!isIdString(paperId)) return null
    const paper = await this.prisma.client.paper.findUnique({
      where: { id: idFromString(paperId) },
      select: { id: true, status: true, kind: true, sections: { select: { placements: { select: { questionId: true } } } } },
    })
    if (!paper) return null
    const ids = [...new Set(paper.sections.flatMap((s) => s.placements.map((p) => idToString(p.questionId))))]
    const reports: ReadonlyMap<string, ServabilityReport> = ids.length === 0 ? new Map() : await this.servability.reports(ids)

    // A placed question the bridge cannot serve. `not_on_published_paper` is about the paper, which is what this report decides.
    const attention: PaperAttention[] = ids.flatMap((id): PaperAttention[] => {
      const r = reports.get(id)
      if (!r) return [{ questionId: id, reasons: [reason('not_approved', 'simulasi_paper')] }]
      const own = r.activities.find((a) => a.activity === 'simulasi_paper')?.reasons.filter((x) => x.code !== 'not_on_published_paper') ?? []
      return own.length > 0 ? [{ questionId: id, reasons: own }] : []
    })

    const published = paper.status === 'published'
    const paperLine = (activity: ServabilityActivity, extra: ServabilityReason[]): ServabilityActivityResult => {
      const reasons = published ? extra : [reason('paper_not_published', activity)]
      return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served: reasons.length === 0, reasons }
    }
    const simulasi = paperLine('simulasi_paper', attention.length > 0 ? [reason('bridge_refused', 'simulasi_paper', `${String(attention.length)} soalan`)] : [])
    // The per-paper quiz (kuiz `visiblePaper`) needs only a published paper.
    const kuiz = paperLine('simulasi_kuiz', ids.length === 0 ? [reason('shape_unsupported', 'simulasi_kuiz', 'no questions')] : [])
    const activities = [simulasi, kuiz]
    return {
      paperId: idToString(paper.id),
      status: paper.status,
      kind: paper.kind,
      open: simulasi.served,
      questionCount: ids.length,
      activities,
      attention,
      servedCount: activities.filter((a) => a.served).length,
      total: activities.length,
    }
  }
}
