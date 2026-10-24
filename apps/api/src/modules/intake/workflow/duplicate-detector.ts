import { Inject, Injectable, Logger } from '@nestjs/common'
import type { IntakeDuplicateKind, QuestionPart } from '@pp/contract'

import { idToString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import { QuestionsRepository } from '../../questions'
import { compare, signatureOf, type Signature } from './duplicates'
import { IntakeWorkflowConfig } from './workflow.config'

/** A bank question reduced to what the duplicate rule compares. */
export interface BankEntry {
  id: string
  sig: Signature
}

export interface Finding {
  kind: IntakeDuplicateKind
  similarity: number
  /** Exactly one of the two. */
  matchedQuestionId?: string
  matchedItemId?: string
}

/** At most this many bank findings are kept per item (best first). */
const MAX_BANK_FINDINGS = 5

/** All the text of a bank part tree (prompts and option texts). */
export function textOfBankParts(parts: readonly QuestionPart[]): string {
  const out: string[] = []
  const walk = (list: readonly QuestionPart[]): void => {
    for (const p of list) {
      out.push(p.prompt.ms)
      if ('children' in p) walk(p.children as QuestionPart[])
      else if (p.mode === 'mcq') for (const o of p.options) out.push(o.body.ms)
    }
  }
  walk(parts)
  return out.join(' \n ')
}

const RANK: Record<IntakeDuplicateKind, number> = { exact: 3, near: 2, variant: 1 }

/**
 * The duplicate check of the intake (card AC5): exact and variant duplicates against the question bank and across the
 * batch. The bank is read through the questions owner (`QuestionsRepository`, never its tables); archived questions are
 * not compared. The scan reads at most `INTAKE_DUPLICATE_SCAN_LIMIT` (exactly) of the newest questions of the batch subject, by keyset paging.
 */
@Injectable()
export class DuplicateDetector {
  private readonly log = new Logger(DuplicateDetector.name)

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(IntakeWorkflowConfig) private readonly config: IntakeWorkflowConfig,
  ) {}

  /** The comparable questions of a subject (empty when the subject is unknown to the curriculum). */
  async bank(subjectCode: string): Promise<BankEntry[]> {
    const subject = await this.curriculum.subjectByCode(subjectCode)
    if (!subject) return []
    const out: BankEntry[] = []
    const limit = this.config.duplicateScanLimit
    const pageSize = 200
    let scanned = 0
    let lastId: string | undefined
    // Keyset paging (newest first): never scans more than `limit` rows and is stable under concurrent inserts.
    while (scanned < limit) {
      const want = Math.min(pageSize, limit - scanned)
      // Keyset page without the totals and status counts `listIds` computes (two full-subject scans per page).
      const ids = await this.questions.listIdsKeyset({ subjectId: idToString(subject.id) }, lastId, want)
      if (ids.length === 0) break
      scanned += ids.length
      lastId = ids[ids.length - 1] as string
      for (const rec of await this.questions.getMany(ids, 'latest')) {
        if (rec.version.status === 'archived') continue
        // A single-leaf question repeats its stem as the leaf prompt; counting it twice would turn an exact copy into "near".
        const partsText = textOfBankParts(rec.version.parts)
        const stem = rec.version.stemMs ?? ''
        const text = stem !== '' && !partsText.includes(stem) ? `${stem} \n ${partsText}` : partsText
        out.push({ id: rec.id, sig: signatureOf(text) })
      }
      if (ids.length < want) break
      if (scanned >= limit) {
        // The contract has no field to tell the reviewer the bank was cut short.
        this.log.debug(`duplicate scan stopped at the ${limit} newest bank questions of subject ${subjectCode}; older ones are not compared`)
      }
    }
    return out
  }

  /** Bank findings for one signature, best first, at most `MAX_BANK_FINDINGS`. */
  againstBank(sig: Signature, bank: readonly BankEntry[]): Finding[] {
    const found: Finding[] = []
    for (const b of bank) {
      const c = compare(sig, b.sig)
      if (c) found.push({ kind: c.kind, similarity: c.similarity, matchedQuestionId: b.id })
    }
    return found
      .sort((a, b) => RANK[b.kind] - RANK[a.kind] || b.similarity - a.similarity || Number(a.matchedQuestionId) - Number(b.matchedQuestionId))
      .slice(0, MAX_BANK_FINDINGS)
  }

  /** Findings of an item against the items before it in the same batch (the later item carries the flag). */
  againstBatch(sig: Signature, earlier: ReadonlyArray<{ id: string; sig: Signature }>): Finding[] {
    const found: Finding[] = []
    for (const e of earlier) {
      const c = compare(sig, e.sig)
      if (c) found.push({ kind: c.kind, similarity: c.similarity, matchedItemId: e.id })
    }
    return found.sort((a, b) => RANK[b.kind] - RANK[a.kind] || b.similarity - a.similarity).slice(0, MAX_BANK_FINDINGS)
  }
}
