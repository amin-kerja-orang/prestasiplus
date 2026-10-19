/**
 * M04 master notes (SRS §7 #26–#27, BR-M04-23, FR-M04-102…105). Admin-only, although S12 is rendered
 * in the user shell (SEC-M04-09: the role is enforced here whatever the layout).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 26 | `GET /api/master-notes` | `tab=flagged|approved|all` (default flagged), `page`; 15 per page, id desc; `meta.summary` |
 * | 27 | `POST /api/master-notes/:id/:action` | `approve` / `regen` / `unflag`; 200 `{ok:true}`; the page judges by the status only |
 *
 * INFERRED: an unknown `tab` shows the default (flagged) tab and reports it in `meta.activeTab`; an
 * unknown id or action is a 404. The note's subject and question text are read from the question row
 * when the note does not carry its own snapshot.
 */

import {
  int,
  notFound,
  pageParams,
  paged,
  queryString,
  raw,
  route,
  str,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { MasterNoteRow } from '../../api/master-notes'
import {
  MASTER_NOTES_PAGE_SIZE,
  masterNotesRepo,
  type MasterNote,
  type MasterNoteAction,
  type MasterNoteTab,
} from '../repository/master-notes'
import { questionsRepo } from '../repository/questions'
import { adminOnly } from './workflow-common'

const TABS: readonly MasterNoteTab[] = ['flagged', 'approved', 'all']
const ACTIONS: readonly MasterNoteAction[] = ['approve', 'regen', 'unflag']

function toRow(n: MasterNote): MasterNoteRow {
  const q =
    n.subjectName === null || n.questionText === null ? questionsRepo.get(n.questionId) : null
  const subjectName =
    n.subjectName ??
    (q?.subjectId !== null && q?.subjectId !== undefined
      ? curriculum.subject(q.subjectId)?.name
      : undefined) ??
    '—'
  return {
    id: n.id,
    questionId: n.questionId,
    subjectName,
    chapter: n.chapter,
    model: n.model,
    tokens: n.tokens,
    confidence: n.confidence,
    questionText: n.questionText ?? q?.questionText ?? '',
    noteText: n.noteText,
    trapText: n.trapText,
    flagged: n.flagged,
    teacherApproved: n.teacherApproved,
    createdAt: n.createdAt,
  }
}

export const masterNoteRoutes: RouteDef[] = [
  route('GET', '/api/master-notes', [adminOnly], (req) => {
    const asked = queryString(req.query, 'tab')
    const tab: MasterNoteTab = TABS.includes(asked as MasterNoteTab)
      ? (asked as MasterNoteTab)
      : 'flagged'
    const page = pageParams(req.query, { pageSize: MASTER_NOTES_PAGE_SIZE })
    const result = masterNotesRepo.list(tab, page.page)
    return paged({ rows: result.rows.map(toRow), total: result.total }, page, {
      activeTab: tab,
      summary: masterNotesRepo.summary(),
    })
  }),
  route(
    'POST',
    '/api/master-notes/:id/:action',
    [adminOnly],
    (req) => {
      const action = req.params.action as string
      if (!ACTIONS.includes(action as MasterNoteAction)) return notFound()
      const row = masterNotesRepo.act(req.params.id as number, action as MasterNoteAction)
      return row ? raw(200, { ok: true }) : notFound()
    },
    { params: { id: int(), action: str() } },
  ),
]
