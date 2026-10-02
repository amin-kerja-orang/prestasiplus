/**
 * SRS M16 v1.6 §7 #1 (the banner list, a **bare array** as live), #42 (list), #43 (form options, admin), #44
 * (create, admin) and #45 (detail, provisional). BR-M16-01: S24 and #43/#44 are admin only (403 for
 * others); drafts are visible to admins only.
 */

import {
  created,
  notFound,
  ok,
  raw,
  requireAuth,
  requireRole,
  route,
  str,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { SPM_COUNTS } from '../data/constants'
import { parseTournamentBody, tournamentsRepo } from '../repository'
import { refusal, viewerOf } from './common'

export const tournamentRoutes: RouteDef[] = [
  // #1: any non-2xx or network error is an empty list on the client (BR-M16-38, §6.13).
  route('GET', '/api/tournament/active', [requireAuth()], () => raw(200, tournamentsRepo.active())),

  // #42
  route('GET', '/api/tournaments', [requireAuth()], () => ok(tournamentsRepo.list())),

  // #43
  route('GET', '/api/tournaments/form-options', [requireRole('admin')], () =>
    ok({
      educationLevels: [
        { id: 'tingkatan4', name: 'Tingkatan 4' },
        { id: 'tingkatan5', name: 'Tingkatan 5' },
        { id: 'spm', name: 'SPM (Tingkatan 4 & 5)' },
      ],
      subjects: curriculum
        .subjects({ active: true })
        .filter((s) => s.id >= 1 && s.id <= 31)
        .map((s) => ({ id: s.id, name: s.name, code: s.code }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ms')),
      examPapers: [],
      spmCounts: SPM_COUNTS,
    }),
  ),

  // #44
  route('POST', '/api/tournaments', [requireRole('admin')], (req) => {
    try {
      const input = parseTournamentBody(req.body)
      const t = tournamentsRepo.create(input, viewerOf(req).id)
      return created({ uuid: t.id, status: t.status })
    } catch (e) {
      return refusal(e)
    }
  }),

  // #45 (PROVISIONAL): drafts only for admins, an unknown uuid is 404.
  route(
    'GET',
    '/api/tournaments/:uuid',
    [requireAuth()],
    (req) => {
      const t = tournamentsRepo.get(req.params.uuid as string, req.session?.role === 'admin')
      if (!t) return notFound('Tournament tidak dijumpai.')
      return ok({
        uuid: t.id,
        title: t.title,
        description: t.description,
        status: t.shown,
        educationLevelId: t.educationLevelId,
        format: t.format,
        groupsCount: t.groupsCount,
        questionMode: t.questionMode,
        subjectId: t.subjectId,
        examPaperId: t.examPaperId,
        mixedSubjectIds: t.mixedSubjectIds,
        totalQuestions: t.totalQuestions,
        timeWindowMinutes: t.timeWindowMinutes,
        topNScoring: t.topNScoring,
        minParticipants: t.minParticipants,
        registrationOpensAt: t.registrationOpensAt,
        registrationClosesAt: t.registrationClosesAt,
        liveMatch: t.liveMatch,
        createdAt: t.createdAt,
      })
    },
    { params: { uuid: str() } },
  ),
]
