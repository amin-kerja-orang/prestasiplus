/**
 * Read port of the DSKP SP map behind Analitik Adaptif of the pupil (S10-T04 part 3, R1-MUR-5, DK rule 4.10).
 *
 * The SP map is the DSKP tree of the pupil's level (`curriculum_nodes` kind `sp`, grouped by Tajuk DSKP / SK) and
 * the SP tags of questions (`question_version_sp_nodes`, latest approved version). A question tagged only to a Bab
 * has NO row here: it is not in the map (AC-MUR-DK-3). The real adapter is a cross-sector follow-up owned by S4
 * (curriculum nodes) or S1 (question tags) and is NOT written in S10; until it is bound through
 * `PerformancePorts.provideSpMap` the default answers "no SP map", so the pupil sees no tabs and no error.
 */

/** One SP node of the tree. */
export interface SpNodeRef {
  /** `curriculum_nodes.id` of the SP. */
  spNodeId: string
  /** Printed code, e.g. "1.1.1". */
  code: string
  /** Printed wording of the SP. */
  title: string
  /** Heading of the group the SP sits under (Tajuk DSKP or SK); null when the SP has none. */
  strand: string | null
  /** Position inside the subject (DSKP order). */
  sortOrder: number
}

/** The SP map of one subject at one level. */
export interface SpSubjectTree {
  subjectId: string
  subjectCode: string
  subjectName: string
  nodes: SpNodeRef[]
}

/** One question-to-SP tag. A question may carry several. */
export interface SpTagRow {
  questionId: string
  spNodeId: string
}

export interface SpMapPort {
  /**
   * Every subject that has SP nodes at the level, in the curriculum order, nodes in DSKP order. `levelId` null (the
   * pupil has no level) or a level without nodes (T1-T3, D101) yields no subject.
   */
  spTree(query: { levelId: string | null }): Promise<SpSubjectTree[]>
  /** SP tags of the given questions; a question without an SP tag (a Bab-only question) has no row. One read. */
  spOf(questionIds: readonly string[]): Promise<SpTagRow[]>
}

export const SP_MAP_PORT = Symbol('SP_MAP_PORT')

/** Default until the S4/S1 adapter is registered: no SP map. */
export class EmptySpMap implements SpMapPort {
  async spTree(): Promise<SpSubjectTree[]> {
    return []
  }
  async spOf(): Promise<SpTagRow[]> {
    return []
  }
}
