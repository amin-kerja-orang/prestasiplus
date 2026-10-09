/**
 * The `battles` repository (owner M16; SRS M16 v1.6 §6.2, §7 #2-#17, #21, §7.2): battle start,
 * simulated matchmaking (BR-M16-04/05), invitations (BR-M16-06), forfeit, the provisional arena
 * (BR-M16-07/08) and the reads other modules use (`countFor` for M11, `m17Counts` / `windowCounts` for
 * M17). Every behaviour of another player is a SIMULATION (D4).
 */

import { DAY_MS } from '@/lib/time'
import type { PrngRegistry } from '@/mock/determinism'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { pkskDomains } from '@/modules/m07-pksk/mock'
import { gamification } from '@/modules/m14-gamification/mock'

import {
  INCOMING_ON_POLL,
  INVITATION_EXPIRES_MS,
  MATCH_ON_POLL,
  QUEUE_ABANDONED_MS,
  QUEUE_EXPIRES_MS,
} from '../data/constants'
import {
  battleAnswersTable,
  battleInvitationsTable,
  battleQueuesTable,
  battlesTable,
  gameSessionsTable,
} from '../tables/tables'
import type {
  BattleQueueRow,
  BattleRow,
  Challenger,
  PkskLevel,
  QuestionType,
  SimSpec,
  Winner,
} from '../types'
import {
  arenaQuestion,
  botAnswers,
  drawQuestionIds,
  gradeArena,
  levelIdOf,
  pickBot,
  type BattleParams,
} from './battle-pool'
import {
  ARENA_QUESTIONS,
  arenaPoints,
  currentSchoolOf,
  gradeLabel,
  M16Error,
  m16Now,
  nowIso,
  QUESTION_SECONDS,
  schoolName,
  userName,
  winnerOf,
} from './common'

export const battleQueries = defineNamedQueries(battlesTable, {
  'Q-M16-BATTLES': { expected: 168, source: 'M16 §6.10 (M17 S1 total)' },
  'Q-M16-BATTLES-ACTIVE': { where: { status: 'active' }, expected: 0, source: 'M16 §6.10' },
  'Q-M16-BATTLES-FINISHED': { where: { status: 'finished' }, expected: 66, source: 'M16 §6.10' },
  'Q-BAT-STATUS': {
    where: (status: BattleRow['status']) => ({ status }),
    expected: [
      { args: ['forfeited'], value: 5 },
      { args: ['abandoned'], value: 97 },
    ],
    source: 'M16 BR-M16-10 (66 finished + 5 forfeited + 97 abandoned)',
  },
})

/** The next queue's simulation (the `battleSim` hook); consumed by `start`. */
let pendingSim: SimSpec | null = null

export function setPendingSim(spec: SimSpec | null): void {
  pendingSim = spec
}

export type PollMatchResult =
  | { status: 'waiting' | 'expired' | 'not_found' }
  | { status: 'incoming_challenge'; challenger: Omit<Challenger, 'userId'> }
  | { status: 'matched'; battle_uuid: string }
  | { status: 'error'; httpStatus: number }

export type PollChallengerResult = {
  status: 'waiting' | 'matched' | 'rejected' | 'expired' | 'not_found'
  battle_uuid?: string
}

export interface ArenaView {
  uuid: string
  status: BattleRow['status']
  you: 'A' | 'B'
  players: { A: { name: string; school: string }; B: { name: string; school: string } }
  scores: { A: number; B: number }
  index: number
  total: number
  question: ReturnType<typeof arenaQuestion>
  secondsLeft: number
  result?: { winner: Winner; scoreA: number; scoreB: number }
}

export interface ArenaAnswerResult {
  correct: boolean
  correctOptionId: number
  points: number
  you: { score: number }
  opponent: { answered: true; correct: boolean; score: number }
  next?: ReturnType<typeof arenaQuestion>
  result?: { winner: Winner; scoreA: number; scoreB: number }
}

export interface BattleListRow {
  uuid: string
  playerA: { id: number; name: string; homeHere: boolean }
  scoreA: number
  scoreB: number
  playerB: { id: number; name: string }
  winner: Winner
  createdAt: string
}

const toListRow = (b: BattleRow, homeSchool: number | null): BattleListRow => ({
  uuid: b.id,
  playerA: {
    id: b.playerA,
    name: userName(b.playerA),
    homeHere: homeSchool !== null && currentSchoolOf(b.playerA) === homeSchool,
  },
  scoreA: b.scoreA,
  scoreB: b.scoreB,
  playerB: { id: b.playerB, name: userName(b.playerB) },
  winner: b.winner,
  createdAt: b.createdAt,
})

const COUNTED: readonly BattleRow['status'][] = ['finished', 'forfeited']

export const battlesRepo = defineRepository({
  owner: 'M16',
  name: 'battles',
  store: battlesTable,
  stores: {
    queues: battleQueuesTable,
    invitations: battleInvitationsTable,
    answers: battleAnswersTable,
  },
  queries: battleQueries,
  methods: ({ store, stores, transaction }) => {
    const { queues, invitations, answers } = stores

    const mustUser = (id: number): UserRow => {
      const u = users.get(id)
      if (!u) throw new M16Error('NOT_FOUND', 'Pengguna tidak dijumpai.')
      return u
    }

    /** Creates an `active` battle and draws its 10 questions (null pool = refused, BR-M16-03). */
    const createBattle = (
      mode: BattleRow['mode'],
      params: Omit<BattleParams, 'openToAll'>,
      playerA: UserRow,
      playerB: UserRow,
      prng: PrngRegistry,
    ): BattleRow => {
      const levelId = levelIdOf(playerA)
      const row = store.insert({
        mode,
        questionType: params.questionType,
        subjectId: params.subjectId,
        pkskDomainId: params.pkskDomainId,
        pkskTargetLevel: params.pkskTargetLevel,
        levelId,
        playerA: playerA.id,
        playerB: playerB.id,
        schoolAId: playerA.schoolId,
        schoolBId: playerB.schoolId,
        scoreA: 0,
        scoreB: 0,
        correctA: 0,
        correctB: 0,
        answered: 0,
        winner: null,
        status: 'active',
        createdAt: nowIso(),
        createdAtMs: m16Now(),
        finishedAt: null,
        questionIds: [],
        seeded: false,
      })
      const ids = drawQuestionIds(params, levelId, prng.fresh(`m16:battle:${row.id}:pool`))
      if (!ids) throw new M16Error('VALIDATION_ERROR', 'Soalan tidak mencukupi.')
      return store.update(row.id, { questionIds: ids })
    }

    const paramsOf = (q: BattleQueueRow): Omit<BattleParams, 'openToAll'> => ({
      questionType: q.questionType,
      subjectId: q.subjectId,
      pkskDomainId: q.pkskDomainId,
      pkskTargetLevel: q.pkskTargetLevel,
    })

    const challengerOf = (u: UserRow): Challenger => ({
      userId: u.id,
      name: u.name,
      grade_label: gradeLabel(u.grade),
      school: schoolName(u.schoolId),
    })

    const publicChallenger = (c: Challenger): Omit<Challenger, 'userId'> => ({
      name: c.name,
      grade_label: c.grade_label,
      school: c.school,
    })

    const ownQueue = (viewerId: number, queueId: number): BattleQueueRow | undefined => {
      const q = queues.get(queueId)
      return q && q.ownerId === viewerId ? q : undefined
    }

    /** Reports a finished battle to M14 once per real player (BR-M16-28; xp 0, coins 0). */
    const report = (b: BattleRow, viewerId: number): void => {
      const side = b.playerA === viewerId ? 'A' : 'B'
      const won = b.winner === side
      gamification.onGameResult(viewerId, {
        game: 'battle',
        event:
          b.status === 'forfeited' ? (won ? 'forfeit_win' : 'forfeit') : won ? 'win' : 'finish',
        coins: 0,
        xp: 0,
        correct: side === 'A' ? b.correctA : b.correctB,
        total: b.answered,
      })
    }

    const finish = (b: BattleRow, viewerId: number): BattleRow => {
      const done = store.update(b.id, {
        status: 'finished',
        winner: winnerOf(b.scoreA, b.scoreB),
        finishedAt: nowIso(),
      })
      report(done, viewerId)
      return done
    }

    const matchWithBot = (q: BattleQueueRow, prng: PrngRegistry): BattleQueueRow => {
      const owner = mustUser(q.ownerId)
      const bot = pickBot(owner, q.mode, q.openToAll, prng.fresh(`m16:battle:${String(q.id)}`))
      const battle = createBattle(q.mode, paramsOf(q), owner, bot, prng)
      return queues.update(q.id, { status: 'matched', battleUuid: battle.id, challenger: null })
    }

    const expireIfDue = (q: BattleQueueRow, now: number): BattleQueueRow | null => {
      if (q.status !== 'waiting' && q.status !== 'incoming_challenge') return null
      if (now - q.lastPolledAtMs > QUEUE_ABANDONED_MS)
        return queues.update(q.id, { status: 'abandoned' })
      if (now - q.createdAtMs >= QUEUE_EXPIRES_MS) return queues.update(q.id, { status: 'expired' })
      return null
    }

    return {
      /** Seed phase: battle rows with fixed uuids. */
      seed(rows: readonly BattleRow[]): void {
        transaction(() => {
          for (const r of rows) store.insert({ ...r })
        })
      },

      get(id: string): BattleRow | undefined {
        return store.get(id)
      },

      all(): BattleRow[] {
        return store.query({}).rows
      },

      /** #2 / #3: creates a waiting queue (BR-M16-03) and returns its id. */
      start(
        userId: number,
        mode: 'quick_match' | 'school_battle',
        params: BattleParams,
        prng: PrngRegistry,
      ): number {
        return transaction(() => {
          const owner = mustUser(userId)
          const ids = drawQuestionIds(params, levelIdOf(owner), prng.fresh('m16:pool-check'))
          if (!ids) throw new M16Error('VALIDATION_ERROR', 'Soalan tidak mencukupi.')
          const sim: SimSpec = pendingSim ?? { mode: 'match' }
          pendingSim = null
          const now = m16Now()
          return queues.insert({
            ownerId: userId,
            mode,
            questionType: params.questionType,
            subjectId: params.subjectId,
            pkskDomainId: params.pkskDomainId,
            pkskTargetLevel: params.pkskTargetLevel,
            openToAll: params.openToAll,
            status: 'waiting',
            challenger: null,
            battleUuid: null,
            polls: 0,
            waitPolls: 0,
            lastPolledAtMs: now,
            createdAtMs: now,
            sim,
            joiner: null,
          }).id
        })
      },

      /** #4: one poll of a queue (BR-M16-04/05). Unknown or foreign ids are `not_found`. */
      pollMatch(userId: number, queueId: number, prng: PrngRegistry): PollMatchResult {
        return transaction(() => {
          let q = ownQueue(userId, queueId)
          if (!q) return { status: 'not_found' }
          if (q.status === 'matched')
            return { status: 'matched', battle_uuid: q.battleUuid as string }
          if (q.status === 'expired' || q.status === 'abandoned') return { status: 'expired' }
          const now = m16Now()
          if (q.sim.mode === 'not_found') return { status: 'not_found' }
          if (q.sim.mode === 'error') return { status: 'error', httpStatus: q.sim.status ?? 500 }
          if (q.sim.mode === 'expired') {
            queues.update(q.id, { status: 'expired' })
            return { status: 'expired' }
          }
          const due = expireIfDue(q, now)
          if (due) return { status: 'expired' }
          q = queues.update(q.id, {
            polls: q.polls + 1,
            waitPolls: q.waitPolls + 1,
            lastPolledAtMs: now,
          })
          if (q.status === 'incoming_challenge' && q.challenger) {
            return { status: 'incoming_challenge', challenger: publicChallenger(q.challenger) }
          }
          if (q.joiner?.outcome === 'pending') {
            const j = mustUser(q.joiner.userId)
            q = queues.update(q.id, { status: 'incoming_challenge', challenger: challengerOf(j) })
            return {
              status: 'incoming_challenge',
              challenger: publicChallenger(q.challenger as Challenger),
            }
          }
          if (q.sim.mode === 'never') return { status: 'waiting' }
          if (q.sim.mode === 'incoming' && q.waitPolls >= (q.sim.afterPolls ?? INCOMING_ON_POLL)) {
            const bot = pickBot(
              mustUser(q.ownerId),
              q.mode,
              q.openToAll,
              prng.fresh(`m16:challenger:${String(q.id)}`),
            )
            q = queues.update(q.id, { status: 'incoming_challenge', challenger: challengerOf(bot) })
            return {
              status: 'incoming_challenge',
              challenger: publicChallenger(q.challenger as Challenger),
            }
          }
          if (q.sim.mode === 'match' && q.waitPolls >= (q.sim.afterPolls ?? MATCH_ON_POLL)) {
            q = matchWithBot(q, prng)
            return { status: 'matched', battle_uuid: q.battleUuid as string }
          }
          return { status: 'waiting' }
        })
      },

      /** #5: the owner accepts the incoming challenger. */
      acceptChallenger(userId: number, queueId: number, prng: PrngRegistry): string {
        return transaction(() => {
          const q = ownQueue(userId, queueId)
          if (!q || q.status !== 'incoming_challenge' || !q.challenger) {
            throw new M16Error('NOT_FOUND', 'Giliran tidak dijumpai.')
          }
          const owner = mustUser(q.ownerId)
          const opponent = mustUser(q.challenger.userId)
          const battle = createBattle(q.mode, paramsOf(q), owner, opponent, prng)
          queues.update(q.id, {
            status: 'matched',
            battleUuid: battle.id,
            joiner: q.joiner ? { ...q.joiner, outcome: 'matched' } : null,
          })
          return battle.id
        })
      },

      /** #6: the owner rejects; the queue returns to `waiting` (next bot on the 3rd poll after). */
      rejectChallenger(userId: number, queueId: number): void {
        transaction(() => {
          const q = ownQueue(userId, queueId)
          if (!q) throw new M16Error('NOT_FOUND', 'Giliran tidak dijumpai.')
          if (q.status !== 'incoming_challenge') return
          queues.update(q.id, {
            status: 'waiting',
            challenger: null,
            waitPolls: 0,
            sim: { mode: 'match' },
            joiner: q.joiner ? { ...q.joiner, outcome: 'rejected' } : null,
          })
        })
      },

      /** #7 (BR-M16-11): students by name, not the viewer, A to Z, at most 10. */
      searchOpponent(
        viewerId: number,
        q: string,
      ): { id: number; name: string; school: string; avatar: string | null }[] {
        const term = q.trim()
        if (term.length < 2) return []
        const needle = term.toLowerCase()
        // All students (an e-mail-only hit must not take a slot), name match, A to Z, then 10.
        return users
          .search(term, { role: 'student', limit: Number.MAX_SAFE_INTEGER })
          .filter((u) => u.id !== viewerId && u.name.toLowerCase().includes(needle))
          .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
          .slice(0, 10)
          .map((u) => ({
            id: u.id,
            name: u.name,
            school: schoolName(u.schoolId),
            avatar: u.avatarUrl,
          }))
      },

      /** #8 (BR-M16-06): a pending invitation to an existing student other than the sender. */
      invite(
        senderId: number,
        receiverId: unknown,
        params: BattleParams,
        prng: PrngRegistry,
      ): string {
        return transaction(() => {
          const receiver = typeof receiverId === 'number' ? users.get(receiverId) : undefined
          if (!receiver || receiver.role !== 'student' || receiver.id === senderId) {
            throw new M16Error('VALIDATION_ERROR', 'Penerima tidak sah.', 'receiver_id')
          }
          const sender = mustUser(senderId)
          if (!drawQuestionIds(params, levelIdOf(sender), prng.fresh('m16:pool-check'))) {
            throw new M16Error('VALIDATION_ERROR', 'Soalan tidak mencukupi.')
          }
          return invitations.insert({
            senderId,
            receiverId: receiver.id,
            questionType: params.questionType,
            subjectId: params.subjectId,
            pkskDomainId: params.pkskDomainId,
            pkskTargetLevel: params.pkskTargetLevel,
            status: 'pending',
            createdAtMs: m16Now(),
          }).id
        })
      },

      /** #9: the viewer's pending invitations, newest first; older than 24 h are `expired`. */
      invitations(
        viewerId: number,
      ): { uuid: string; sender_name: string; sender_school: string }[] {
        const now = m16Now()
        return invitations
          .query({ where: { receiverId: viewerId }, sort: [{ field: 'createdAtMs', dir: 'desc' }] })
          .rows.filter(
            (i) => i.status === 'pending' && now - i.createdAtMs <= INVITATION_EXPIRES_MS,
          )
          .map((i) => ({
            uuid: i.id,
            sender_name: userName(i.senderId),
            sender_school: schoolName(currentSchoolOf(i.senderId)),
          }))
      },

      /** #10: the receiver accepts; the sender is player A. */
      acceptInvitation(viewerId: number, uuid: string, prng: PrngRegistry): string {
        return transaction(() => {
          const inv = invitations.get(uuid)
          if (
            !inv ||
            inv.receiverId !== viewerId ||
            inv.status !== 'pending' ||
            m16Now() - inv.createdAtMs > INVITATION_EXPIRES_MS
          ) {
            throw new M16Error('NOT_FOUND', 'Cabaran tidak dijumpai.')
          }
          const battle = createBattle(
            'challenge',
            {
              questionType: inv.questionType,
              subjectId: inv.subjectId,
              pkskDomainId: inv.pkskDomainId,
              pkskTargetLevel: inv.pkskTargetLevel,
            },
            mustUser(inv.senderId),
            mustUser(viewerId),
            prng,
          )
          invitations.update(uuid, { status: 'accepted' })
          return battle.id
        })
      },

      /** #11. */
      declineInvitation(viewerId: number, uuid: string): void {
        transaction(() => {
          const inv = invitations.get(uuid)
          if (!inv || inv.receiverId !== viewerId || inv.status !== 'pending') {
            throw new M16Error('NOT_FOUND', 'Cabaran tidak dijumpai.')
          }
          invitations.update(uuid, { status: 'declined' })
        })
      },

      /** #12: a join request on someone's queue (DV-M16-06; no UI caller on live). */
      joinQueue(viewerId: number, queueId: number): void {
        transaction(() => {
          const q = queues.get(queueId)
          if (
            !q ||
            q.ownerId === viewerId ||
            (q.status !== 'waiting' && q.status !== 'incoming_challenge') ||
            (q.joiner && q.joiner.outcome === 'pending')
          ) {
            throw new M16Error('NOT_FOUND', 'Ralat menghantar permohonan.')
          }
          queues.update(q.id, { joiner: { userId: viewerId, outcome: 'pending' } })
        })
      },

      /** #13: the joiner's poll of the owner's decision. */
      pollChallenger(viewerId: number, queueId: number, prng: PrngRegistry): PollChallengerResult {
        return transaction(() => {
          const q = queues.get(queueId)
          if (!q || !q.joiner || q.joiner.userId !== viewerId) return { status: 'not_found' }
          if (q.joiner.outcome === 'rejected') return { status: 'rejected' }
          if (q.joiner.outcome === 'expired') return { status: 'expired' }
          if (q.joiner.outcome === 'matched') {
            let battleUuid = q.battleUuid
            if (!battleUuid) {
              const battle = createBattle(
                q.mode,
                paramsOf(q),
                mustUser(q.ownerId),
                mustUser(viewerId),
                prng,
              )
              battleUuid = battle.id
              queues.update(q.id, { status: 'matched', battleUuid })
            }
            return { status: 'matched', battle_uuid: battleUuid }
          }
          if (q.status === 'matched' || q.status === 'expired' || q.status === 'abandoned') {
            return { status: 'expired' }
          }
          return { status: 'waiting' }
        })
      },

      /** #14 (BR-M16-09): a player of an unfinished battle forfeits; the opponent wins. */
      forfeit(viewerId: number, uuid: string): void {
        transaction(() => {
          const b = store.get(uuid)
          if (!b || (b.playerA !== viewerId && b.playerB !== viewerId)) {
            throw new M16Error('NOT_FOUND', 'Battle tidak dijumpai.')
          }
          if (b.status !== 'active') throw new M16Error('CONFLICT', 'Battle sudah tamat.')
          const winner: Winner = b.playerA === viewerId ? 'B' : 'A'
          const done = store.update(uuid, { status: 'forfeited', winner, finishedAt: nowIso() })
          report(done, viewerId)
        })
      },

      /** #15: the S1 lobby data (BR-M16-02/03). */
      lobby(viewerId: number) {
        const viewer = mustUser(viewerId)
        const grade = viewer.grade
        const unlocked = grade !== null && grade >= 10
        return {
          grade,
          gradeLabel: gradeLabel(grade),
          spmUnlocked: unlocked,
          subjects: curriculum
            .subjects({ active: true })
            .filter((s) => s.id >= 1 && s.id <= 31)
            .sort((a, b) => a.id - b.id)
            .map((s) => ({
              id: s.id,
              name: s.name,
              icon: s.icon,
              colour: s.color,
              core: s.id <= 7,
            })),
          pkskDomains: pkskDomains
            .list()
            .filter((d) => d.isActive)
            .map((d) => ({ id: d.id, name: d.name, icon: d.icon, colour: d.color })),
          ...(unlocked
            ? {
                spmSubjects: curriculum
                  .subjects({ active: true })
                  .filter(
                    (s) =>
                      s.id >= 1 && s.id <= 31 && questions.spmPool({ subjectId: s.id }).total > 0,
                  )
                  .sort((a, b) => a.id - b.id)
                  .map((s) => ({ id: s.id, name: s.name })),
              }
            : {}),
        }
      },

      /** #16: the arena of a battle the viewer plays; foreign or unknown battles are 404. */
      arena(viewerId: number, uuid: string): ArenaView {
        const b = store.get(uuid)
        if (!b || (b.playerA !== viewerId && b.playerB !== viewerId)) {
          throw new M16Error('NOT_FOUND', 'Battle tidak dijumpai.')
        }
        const you = b.playerA === viewerId ? 'A' : 'B'
        const done = answers.count({ battleUuid: uuid, playerId: viewerId })
        const active = b.status === 'active'
        const view: ArenaView = {
          uuid,
          status: b.status,
          you,
          players: {
            A: { name: userName(b.playerA), school: schoolName(b.schoolAId) },
            B: { name: userName(b.playerB), school: schoolName(b.schoolBId) },
          },
          scores: { A: b.scoreA, B: b.scoreB },
          index: Math.min(done + 1, ARENA_QUESTIONS),
          total: ARENA_QUESTIONS,
          question: active ? arenaQuestion(b.questionIds[done] as number) : null,
          secondsLeft: active ? QUESTION_SECONDS : 0,
        }
        if (!active) view.result = { winner: b.winner, scoreA: b.scoreA, scoreB: b.scoreB }
        return view
      },

      /** #17 (BR-M16-07/08): one answer; the bot answers from its stream; question 10 ends the battle. */
      answer(
        viewerId: number,
        uuid: string,
        input: { questionId: unknown; optionId: unknown; seconds: unknown },
        prng: PrngRegistry,
      ): ArenaAnswerResult {
        return transaction(() => {
          const b = store.get(uuid)
          if (!b || (b.playerA !== viewerId && b.playerB !== viewerId)) {
            throw new M16Error('NOT_FOUND', 'Battle tidak dijumpai.')
          }
          if (b.status !== 'active') throw new M16Error('CONFLICT', 'Battle sudah tamat.')
          const done = answers.count({ battleUuid: uuid, playerId: viewerId })
          const questionId = b.questionIds[done]
          if (input.questionId !== questionId) {
            throw new M16Error('VALIDATION_ERROR', 'Soalan tidak sah.', 'questionId')
          }
          const optionId = input.optionId === null ? null : input.optionId
          if (
            optionId !== null &&
            !(
              typeof optionId === 'number' &&
              Number.isInteger(optionId) &&
              optionId >= 0 &&
              optionId <= 3
            )
          ) {
            throw new M16Error('VALIDATION_ERROR', 'Jawapan tidak sah.', 'optionId')
          }
          const seconds = input.seconds
          if (
            typeof seconds !== 'number' ||
            !Number.isFinite(seconds) ||
            seconds < 0 ||
            seconds > QUESTION_SECONDS
          ) {
            throw new M16Error('VALIDATION_ERROR', 'Masa tidak sah.', 'seconds')
          }
          const graded = gradeArena(questionId as number, optionId)
          if (!graded) throw new M16Error('NOT_FOUND', 'Soalan tidak dijumpai.')
          const whole = Math.floor(seconds)
          // BR-M16-07: s runs 0-15 inclusive, so a correct answer at 15 s still scores 500.
          const correct = graded.correct
          const points = correct ? arenaPoints(whole) : 0
          const index = done + 1
          const you = b.playerA === viewerId ? 'A' : 'B'
          const bot = botAnswers(prng, uuid)[done] as {
            seconds: number
            correct: boolean
            points: number
          }
          const botSide = you === 'A' ? 'B' : 'A'
          const botId = botSide === 'A' ? b.playerA : b.playerB
          answers.insert({
            battleUuid: uuid,
            playerId: viewerId,
            index,
            questionId: questionId as number,
            optionId,
            correct,
            seconds: whole,
            points,
          })
          answers.insert({
            battleUuid: uuid,
            playerId: botId,
            index,
            questionId: questionId as number,
            optionId: bot.correct ? graded.correctOptionId : null,
            correct: bot.correct,
            seconds: bot.seconds,
            points: bot.points,
          })
          const mine = {
            score: (you === 'A' ? b.scoreA : b.scoreB) + points,
            correct: (you === 'A' ? b.correctA : b.correctB) + (correct ? 1 : 0),
          }
          const theirs = {
            score: (botSide === 'A' ? b.scoreA : b.scoreB) + bot.points,
            correct: (botSide === 'A' ? b.correctA : b.correctB) + (bot.correct ? 1 : 0),
          }
          const patch: Partial<BattleRow> = {
            scoreA: you === 'A' ? mine.score : theirs.score,
            scoreB: you === 'B' ? mine.score : theirs.score,
            correctA: you === 'A' ? mine.correct : theirs.correct,
            correctB: you === 'B' ? mine.correct : theirs.correct,
            answered: index,
          }
          let current = store.update(uuid, patch)
          const out: ArenaAnswerResult = {
            correct,
            correctOptionId: graded.correctOptionId,
            points,
            you: { score: mine.score },
            opponent: { answered: true, correct: bot.correct, score: theirs.score },
          }
          if (index >= ARENA_QUESTIONS) {
            current = finish(current, viewerId)
            out.result = { winner: current.winner, scoreA: current.scoreA, scoreB: current.scoreB }
          } else {
            out.next = arenaQuestion(current.questionIds[index] as number)
          }
          return out
        })
      },

      /** Test hook: sets the scores of a battle (the winner follows BR-M16-07 if it is finished). */
      setScores(uuid: string, scores: { a: number; b: number }): BattleRow {
        return transaction(() => {
          const b = store.get(uuid)
          if (!b) throw new M16Error('NOT_FOUND', 'Battle tidak dijumpai.')
          return store.update(uuid, {
            scoreA: scores.a,
            scoreB: scores.b,
            ...(b.status === 'finished' ? { winner: winnerOf(scores.a, scores.b) } : {}),
          })
        })
      },

      /** Test hook: a pending invitation from `senderId` to `receiverId` (E2E-M16-31). */
      insertInvitation(senderId: number, receiverId: number, params: BattleParams): string {
        return transaction(
          () =>
            invitations.insert({
              senderId,
              receiverId,
              questionType: params.questionType,
              subjectId: params.subjectId,
              pkskDomainId: params.pkskDomainId,
              pkskTargetLevel: params.pkskTargetLevel,
              status: 'pending',
              createdAtMs: m16Now(),
            }).id,
        )
      },

      /**
       * Test hook (DV-M16-06): a waiting queue of `targetUserId` with a pending join request of
       * `viewerId`, whose decision is `outcome`. Returns the queue id.
       */
      insertWaitingQueue(
        targetUserId: number,
        viewerId: number,
        outcome: 'matched' | 'rejected' | 'expired',
      ): number {
        return transaction(() => {
          const now = m16Now()
          return queues.insert({
            ownerId: targetUserId,
            mode: 'quick_match',
            questionType: 'biasa',
            subjectId: 3,
            pkskDomainId: null,
            pkskTargetLevel: null,
            openToAll: true,
            status: 'waiting',
            challenger: null,
            battleUuid: null,
            polls: 0,
            waitPolls: 0,
            lastPolledAtMs: now,
            createdAtMs: now,
            sim: { mode: 'never' },
            joiner: { userId: viewerId, outcome },
          }).id
        })
      },

      /** #21 / S5 (Q-BAT-USER): the viewer's finished and forfeited battles, newest first. */
      historyFor(userId: number): BattleListRow[] {
        return store
          .query({ sort: [{ field: 'createdAtMs', dir: 'desc' }, 'id'] })
          .rows.filter(
            (b) => COUNTED.includes(b.status) && (b.playerA === userId || b.playerB === userId),
          )
          .map((b) => toListRow(b, null))
      },

      /** Q-BAT-USER(user). */
      countOf(userId: number): number {
        return store.count(
          undefined,
          (b) => COUNTED.includes(b.status) && (b.playerA === userId || b.playerB === userId),
        )
      },

      /** Q-BAT-RECENT(school) (BR-M16-14): at most `limit` finished battles of the school. */
      recentForSchool(schoolId: number, limit = 10): BattleListRow[] {
        return store
          .query({ sort: [{ field: 'createdAtMs', dir: 'desc' }, 'id'] })
          .rows.filter(
            (b) =>
              b.status === 'finished' && (b.schoolAId === schoolId || b.schoolBId === schoolId),
          )
          .slice(0, limit)
          .map((b) => toListRow(b, schoolId))
      },

      // --- §7.2 contract ---------------------------------------------------------------------------

      /**
       * XR-M16-05 (M11 port): finished and forfeited battles of each user in `[from, to)` (both
       * sides), with the user's own correct and answered counts. Only ids in `userIds` appear.
       */
      countFor(
        userIds: readonly number[],
        range: { from: number; to: number },
      ): Map<number, { count: number; correct: number; answered: number }> {
        const wanted = new Set(userIds)
        const out = new Map<number, { count: number; correct: number; answered: number }>()
        const add = (id: number, correct: number, answered: number) => {
          if (!wanted.has(id)) return
          const e = out.get(id) ?? { count: 0, correct: 0, answered: 0 }
          e.count += 1
          e.correct += correct
          e.answered += answered
          out.set(id, e)
        }
        for (const b of store.query({}).rows) {
          if (
            !COUNTED.includes(b.status) ||
            b.createdAtMs < range.from ||
            b.createdAtMs >= range.to
          )
            continue
          add(b.playerA, b.correctA, b.answered)
          add(b.playerB, b.correctB, b.answered)
        }
        return out
      },

      /** M17 Q-M16-BATTLES: all battles / `active` / `finished` (`forfeited` and `abandoned` apart). */
      m17Counts(): { total: number; active: number; finished: number } {
        return {
          total: battleQueries['Q-M16-BATTLES'].count(),
          active: battleQueries['Q-M16-BATTLES-ACTIVE'].count(),
          finished: battleQueries['Q-M16-BATTLES-FINISHED'].count(),
        }
      },

      /**
       * M17 Q-M16-BATTLES-WIN (XR-M17-15): battles of students created in the last `days` days (any
       * status, up to now) and submitted game results of students in the same window.
       */
      windowCounts(days: number): { battles: number; games: number } {
        const now = m16Now()
        const from = now - days * DAY_MS
        const isStudent = (id: number): boolean => users.get(id)?.role === 'student'
        return {
          battles: store.count(
            undefined,
            (b) => b.createdAtMs >= from && b.createdAtMs <= now && isStudent(b.playerA),
          ),
          games: gameSessionsTable.count(
            undefined,
            (g) =>
              g.submittedAtMs !== null &&
              g.submittedAtMs >= from &&
              g.submittedAtMs <= now &&
              isStudent(g.userId),
          ),
        }
      },
    }
  },
})

export type BattlesRepository = typeof battlesRepo
export type { PkskLevel, QuestionType }
