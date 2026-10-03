/**
 * The `gameResults` repository (owner M16; SRS M16 v1.6 DATA-M16-08/09/10, BR-M16-25…31, §7 #32-#41, §7.2):
 * the single-player sessions and their submits, personal bests, Roda Nasib spins, Jutawan Ilmu (M04
 * `questions.jutawan.*`), the weekly competition (M05 `practice.weekRank`) and the reads of the contract
 * (`countFor` for M11). Coins go through M14 `onGameResult` once per result (BR-M16-28).
 */

import { formatDateKey, toIsoMyt, weekRange } from '@/lib/time'
import type { Prng, PrngRegistry } from '@/mock/determinism'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'

import {
  JUTAWAN_LIFELINES,
  JUTAWAN_QUESTIONS,
  JUTAWAN_TILE_FALLBACK,
  JUTAWAN_TILES,
  jutawanCoins,
  jutawanDifficulty,
  MEMORY_PAIRS,
  SEED_PERSONAL_BESTS,
  SEED_SPIN_STATS,
  soloInfo,
  SOLO_OVERSAMPLE,
  SPIN_REFUSED,
  SPIN_SEGMENTS,
  SUSUN_MAX_ANSWER,
  WEEKLY_PRIZES,
  type SoloInfo,
} from '../data/games'
import {
  gameSessionsTable,
  jutawanStatsTable,
  personalBestsTable,
  spinsTable,
  spinStatsTable,
} from '../tables/tables'
import type { GameSessionRow } from '../types'
import { M16Error, m16Now, userName } from './common'
import { canEarn, drawFreeId, hex13, keyOf, reportGame, todayMyt } from './games-common'
import { roomsRepo } from './rooms'

export const gameResultQueries = defineNamedQueries(gameSessionsTable, {
  'Q-GAME-SUBMITTED': {
    where: { submittedAtMs: { gte: 0 } },
    expected: 47,
    source: 'M16 §6.10 (M17 "Permainan", 47 seeded results)',
  },
})

const LABELS = ['A', 'B', 'C', 'D'] as const
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const nonNeg = (v: unknown): v is number => isInt(v) && v >= 0

const invalid = (field?: string): M16Error =>
  new M16Error('VALIDATION_ERROR', 'Keputusan tidak sah.', field)

/** Σ of a per-answer gain over `c` correct answers (the largest score `c` answers can reach). */
const sumTo = (c: number, gain: (k: number) => number): number => {
  let s = 0
  for (let k = 1; k <= c; k++) s += gain(k)
  return s
}
const maxBetulSalah = (c: number): number => sumTo(c, (k) => 10 + Math.min(k, 10) * 2)
const maxCabaranKilat = (c: number): number => sumTo(c, (k) => 10 * Math.min(k, 10))
const maxTembak = (c: number): number => sumTo(c, (k) => 10 * (1 + Math.floor((k - 1) / 5)))

export type SoloPayload = {
  sessionId: string
  personalBest: number
  canEarnSyiling: boolean
} & Record<string, unknown>

export interface JutawanQuestionView {
  id: number
  text: string
  options: { id: number; label: string; text: string }[]
}

export interface SubmitResult {
  is_new_record?: boolean
  syiling_awarded?: number
  results?: { syiling_earned: number; accuracy: number }
}

export const gameResultsRepo = defineRepository({
  owner: 'M16',
  name: 'gameResults',
  store: gameSessionsTable,
  stores: {
    bests: personalBestsTable,
    jutawan: jutawanStatsTable,
    spins: spinsTable,
    spinStats: spinStatsTable,
  },
  queries: gameResultQueries,
  methods: ({ store, stores, transaction }) => {
    const { bests, jutawan, spins, spinStats } = stores

    /** The Roda Nasib segment the `spinNext` hook forces on the next spin. */
    let spinNext: number | null = null

    const bestOf = (userId: number, game: string): number =>
      bests.query({ where: { userId, game } }).rows[0]?.bestScore ?? 0

    const levelOfGrade = (grade: number): number | null =>
      curriculum.levelForGrade(grade)?.id ?? null

    // --- single-player payloads (BR-M16-25) --------------------------------------------------------------

    /** `n` eligible MCQ rows with a key and four options, at the education levels given. */
    const pickRows = (
      n: number,
      levelIds: readonly number[],
      rng: Prng,
      fits: (id: number) => boolean,
    ): number[] => {
      const rows = questions.sampleKeyless(
        {
          questionType: 'mcq',
          eligible: true,
          ...(levelIds.length === 0 ? {} : { educationLevelIds: levelIds }),
        },
        n * SOLO_OVERSAMPLE,
        rng,
      )
      return rows
        .map((r) => r.id)
        .filter(fits)
        .slice(0, n)
    }

    const fourOptions = (id: number): boolean => {
      const q = questions.get(id)
      return (
        keyOf(id) !== null &&
        q?.options !== null &&
        q?.options !== undefined &&
        q.options.length === 4 &&
        q.options.every((o) => o.trim() !== '')
      )
    }

    const optionsOf = (id: number): string[] => questions.get(id)?.options ?? []

    const scramble = (
      answer: string,
      rng: Prng,
    ): { type: 'letters' | 'words'; tiles: string[] } => {
      const words = answer.trim().split(/\s+/)
      const type = words.length === 1 ? 'letters' : 'words'
      const original = type === 'letters' ? [...(words[0] ?? '')] : words
      const tiles = [...original]
      for (let i = 0; i < 5 && tiles.length > 1; i++) {
        rng.shuffle(tiles)
        if (tiles.join('|') !== original.join('|')) break
      }
      return { type, tiles }
    }

    const buildItems = (
      info: SoloInfo,
      levelIds: readonly number[],
      rng: Prng,
    ): { key: string; items: unknown[]; ids: number[]; maxScore: number } => {
      const diff = (id: number): number => questions.get(id)?.difficultyLevel ?? 1
      switch (info.game) {
        case 'betul-salah': {
          const ids = pickRows(
            info.items,
            levelIds,
            rng,
            (id) => keyOf(id) !== null && optionsOf(id).length >= 2,
          )
          const items = ids.map((id) => {
            const k = keyOf(id) as { index: number; text: string }
            const wrong = optionsOf(id).filter((t, i) => i !== k.index && t.trim() !== '')
            const isTrue = rng.chance(0.5) || wrong.length === 0
            const shown = isTrue ? k.text : rng.pick(wrong)
            return {
              id,
              statement: `${questions.get(id)?.questionText ?? ''} → ${shown}`,
              is_true: isTrue,
              difficulty: diff(id),
            }
          })
          return { key: 'statements', items, ids, maxScore: 0 }
        }
        case 'cabaran-kilat':
        case 'tembak-jawapan': {
          const ids = pickRows(info.items, levelIds, rng, fourOptions)
          const items = ids.map((id) => {
            const q = questions.get(id)
            const k = keyOf(id) as { index: number }
            const options = optionsOf(id).map((text, i) =>
              info.game === 'cabaran-kilat'
                ? { id: i, text, correct: i === k.index }
                : { text, correct: i === k.index },
            )
            return info.game === 'cabaran-kilat'
              ? { id, question_text: q?.questionText ?? '', difficulty: diff(id), options }
              : { id, question: q?.questionText ?? '', difficulty: diff(id), options }
          })
          return { key: 'questions', items, ids, maxScore: 0 }
        }
        case 'susun-jawapan': {
          const short = (id: number): boolean => {
            const k = keyOf(id)
            return k !== null && k.text.trim() !== '' && k.text.trim().length <= SUSUN_MAX_ANSWER
          }
          const ids = pickRows(info.items, levelIds, rng, short)
          let maxScore = 0
          const items = ids.map((id) => {
            const answer = (keyOf(id) as { text: string }).text.trim()
            const { type, tiles } = scramble(answer, rng)
            const points = type === 'letters' ? Math.max(5, tiles.length * 2) : tiles.length * 3
            maxScore += points
            return {
              id,
              question: questions.get(id)?.questionText ?? '',
              answer,
              scrambled: tiles,
              type,
              difficulty: diff(id),
              points,
            }
          })
          return { key: 'puzzles', items, ids, maxScore }
        }
        case 'kad-memori': {
          const ids = pickRows(MEMORY_PAIRS, levelIds, rng, (id) => {
            const k = keyOf(id)
            return k !== null && k.text.trim() !== ''
          })
          const cards: unknown[] = []
          ids.forEach((id, pair) => {
            cards.push(
              {
                id: pair * 2 + 1,
                pair_id: pair,
                type: 'question',
                content: questions.get(id)?.questionText ?? '',
                difficulty: diff(id),
              },
              {
                id: pair * 2 + 2,
                pair_id: pair,
                type: 'answer',
                content: (keyOf(id) as { text: string }).text,
                difficulty: diff(id),
              },
            )
          })
          rng.shuffle(cards)
          return { key: 'cards', items: cards, ids, maxScore: 0 }
        }
      }
    }

    /** The sum of the questions' scores etc. for the Jutawan view of one row. */
    const jutawanView = (id: number): JutawanQuestionView => {
      const q = questions.jutawanGet(id)
      return {
        id,
        text: q?.questionText ?? '',
        options: (q?.options ?? [])
          .slice(0, 4)
          .map((text, i) => ({ id: i, label: LABELS[i] ?? '', text })),
      }
    }

    const ownSession = (userId: number, id: unknown): GameSessionRow | undefined => {
      if (typeof id !== 'string') return undefined
      const s = store.get(id)
      return s && s.userId === userId ? s : undefined
    }

    const newSessionId = (prefix: string, prng: PrngRegistry): string =>
      drawFreeId(
        prng,
        'm16:solo-id',
        store.size,
        (rng) => prefix + hex13(rng),
        (id) => store.has(id),
      )

    const bumpJutawan = (userId: number, level: number): void => {
      const row = jutawan.query({ where: { userId } }).rows[0]
      if (row)
        jutawan.update(row.id, { bestLevel: Math.max(row.bestLevel, level), games: row.games + 1 })
      else jutawan.insert({ userId, bestLevel: level, games: 1 })
    }

    const jutawanFinish = (s: GameSessionRow, userId: number, level: number): number => {
      const subject = curriculum.subjects().find((x) => x.id === (s.jutawan?.subjectId ?? 0))?.name
      const coins = jutawanCoins(level)
      const credited = reportGame(userId, {
        game: 'jutawan',
        event: 'finish',
        coins,
        correct: level,
        total: JUTAWAN_QUESTIONS,
        detail: { level, subject: subject ?? 'Bahasa Melayu' },
      })
      store.update(s.id, {
        submittedAtMs: m16Now(),
        score: level,
        coinsComputed: coins,
        coinsCredited: credited,
        jutawan: { ...(s.jutawan as NonNullable<GameSessionRow['jutawan']>), over: true, level },
      })
      bumpJutawan(userId, level)
      return credited
    }

    return {
      /** Seed phase: the 47 submitted results, the personal bests and the spin stats. */
      seed(rows: readonly GameSessionRow[]): void {
        transaction(() => {
          for (const r of rows) store.insert({ ...r })
          for (const b of SEED_PERSONAL_BESTS) bests.insert({ ...b })
          spinStats.insert({ ...SEED_SPIN_STATS })
        })
      },

      /**
       * XR-M16-05 (M11 port): submitted results of each user in `[from, to)` — single-player sessions,
       * Jutawan games and finished rooms. Only ids in `userIds` appear.
       */
      countFor(
        userIds: readonly number[],
        range: { from: number; to: number },
      ): Map<number, { count: number }> {
        const wanted = new Set(userIds)
        const out = new Map<number, { count: number }>()
        const add = (userId: number, n: number): void => {
          if (n === 0) return
          const e = out.get(userId) ?? { count: 0 }
          e.count += n
          out.set(userId, e)
        }
        for (const r of store.query({}).rows) {
          if (
            r.submittedAtMs === null ||
            r.submittedAtMs < range.from ||
            r.submittedAtMs >= range.to
          )
            continue
          if (wanted.has(r.userId)) add(r.userId, 1)
        }
        for (const id of wanted) add(id, roomsRepo.finishedRoomsOf(id, range.from, range.to))
        return out
      },

      personalBest(userId: number, game: string): number {
        return bestOf(userId, game)
      },

      /** #32: a new session and its payload (keys included as live, SEC-M16-01). */
      solo(viewerId: number, game: string, darjahRaw: unknown, prng: PrngRegistry): SoloPayload {
        const info = soloInfo(game)
        if (!info) throw new M16Error('NOT_FOUND', 'Permainan tidak dijumpai.')
        let darjah: number | null = null
        let levelIds: number[]
        if (info.game === 'kad-memori') {
          levelIds = [1, 2, 3, 4].map(levelOfGrade).filter((x): x is number => x !== null)
        } else {
          const given = darjahRaw === undefined || darjahRaw === '' ? null : Number(darjahRaw)
          if (given !== null && (!Number.isInteger(given) || given < 1 || given > 11)) {
            throw new M16Error('VALIDATION_ERROR', 'Tahap tidak sah.', 'darjah')
          }
          const grade = users.get(viewerId)?.grade
          darjah =
            given ??
            (grade !== null && grade !== undefined && grade >= 1 && grade <= 11 ? grade : 4)
          levelIds = [levelOfGrade(darjah)].filter((x): x is number => x !== null)
        }
        return transaction(() => {
          const sessionId = newSessionId(info.prefix, prng)
          const built = buildItems(info, levelIds, prng.fresh(`m16:solo:${sessionId}`))
          store.insert({
            id: sessionId,
            userId: viewerId,
            game: info.game,
            darjah,
            createdAtMs: m16Now(),
            submittedAtMs: null,
            score: 0,
            coinsComputed: 0,
            coinsCredited: 0,
            isNewRecord: false,
            itemIds: built.ids,
            itemCount: info.game === 'kad-memori' ? MEMORY_PAIRS : built.ids.length,
            maxScore: built.maxScore,
          })
          return {
            sessionId,
            personalBest: bestOf(viewerId, info.game),
            canEarnSyiling: canEarn(viewerId),
            [built.key]: built.items,
          }
        })
      },

      /** #33 (BR-M16-27): checks the session and the values, stores the result, reports to M14. */
      submit(viewerId: number, game: string, body: unknown): SubmitResult {
        const info = soloInfo(game)
        if (!info) throw new M16Error('NOT_FOUND', 'Permainan tidak dijumpai.')
        const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
        return transaction(() => {
          const s = ownSession(viewerId, b.session_id)
          if (!s || s.game !== info.game) throw invalid('session_id')
          if (s.submittedAtMs !== null) throw new M16Error('CONFLICT', 'Keputusan sudah dihantar.')
          const items = s.itemCount ?? 0

          if (info.game === 'kad-memori') {
            if (b.matches !== MEMORY_PAIRS || b.total_pairs !== MEMORY_PAIRS)
              throw invalid('matches')
            if (!isInt(b.moves) || b.moves < MEMORY_PAIRS) throw invalid('moves')
            if (!nonNeg(b.time_seconds)) throw invalid('time_seconds')
            const credited = reportGame(viewerId, {
              game: info.token,
              event: 'finish',
              coins: MEMORY_PAIRS,
              correct: MEMORY_PAIRS,
              total: MEMORY_PAIRS,
              detail: { moves: b.moves },
            })
            store.update(s.id, {
              submittedAtMs: m16Now(),
              coinsComputed: MEMORY_PAIRS,
              coinsCredited: credited,
            })
            return {
              results: {
                syiling_earned: credited,
                accuracy: Math.round((MEMORY_PAIRS / b.moves) * 100),
              },
            }
          }

          const { score, syiling_earned: coins } = b
          if (!nonNeg(score) || !nonNeg(coins)) throw invalid('score')
          let correct = 0
          let total = 0
          let detail: Record<string, unknown> = {}
          if (info.game === 'susun-jawapan') {
            if (!nonNeg(b.solved_count) || !nonNeg(b.total_puzzles)) throw invalid('solved_count')
            if (b.solved_count > b.total_puzzles || b.total_puzzles > items)
              throw invalid('total_puzzles')
            if (score > (s.maxScore ?? 0) || coins > (s.maxScore ?? 0)) throw invalid('score')
            correct = b.solved_count
            total = b.total_puzzles
            detail = { solved: b.solved_count }
          } else {
            if (!nonNeg(b.correct_count) || !nonNeg(b.total_answered))
              throw invalid('correct_count')
            if (b.correct_count > b.total_answered || b.total_answered > items)
              throw invalid('total_answered')
            correct = b.correct_count
            total = b.total_answered
            if (info.game === 'betul-salah') {
              if (!nonNeg(b.streak) || b.streak > correct) throw invalid('streak')
              if (score > maxBetulSalah(correct) || coins > 5 * correct) throw invalid('score')
              detail = { maxStreak: b.streak }
            } else if (info.game === 'cabaran-kilat') {
              if (!nonNeg(b.max_combo) || b.max_combo > correct) throw invalid('max_combo')
              if (score > maxCabaranKilat(correct) || coins > 10 * correct) throw invalid('score')
              detail = { maxCombo: b.max_combo }
            } else {
              if (
                !isInt(b.max_level) ||
                b.max_level < 1 ||
                b.max_level > 1 + Math.floor(correct / 5)
              ) {
                throw invalid('max_level')
              }
              if (score > maxTembak(correct) || coins > Math.floor(maxTembak(correct) / 10))
                throw invalid('score')
              detail = { level: b.max_level }
            }
          }
          const best = bestOf(viewerId, info.game)
          const isNewRecord = score > best
          if (isNewRecord) {
            const row = bests.query({ where: { userId: viewerId, game: info.game } }).rows[0]
            if (row) bests.update(row.id, { bestScore: score })
            else bests.insert({ userId: viewerId, game: info.game, bestScore: score })
          }
          const credited = reportGame(viewerId, {
            game: info.token,
            event: 'finish',
            coins,
            correct,
            total,
            detail,
          })
          store.update(s.id, {
            submittedAtMs: m16Now(),
            score,
            coinsComputed: coins,
            coinsCredited: credited,
            isNewRecord,
          })
          return { is_new_record: isNewRecord, syiling_awarded: credited }
        })
      },

      // --- Roda Nasib (#34–#35, BR-M16-29) --------------------------------------------------------------------

      spinPage(viewerId: number) {
        const st = spinStats.query({ where: { userId: viewerId } }).rows[0]
        return {
          segments: SPIN_SEGMENTS.map((s) => ({ ...s })),
          spins: st?.spins ?? 0,
          won: st?.won ?? 0,
          alreadySpun: st?.lastSpinDate === todayMyt(),
          canEarnSyiling: canEarn(viewerId),
        }
      },

      spin(viewerId: number, prng: PrngRegistry) {
        return transaction(() => {
          const date = todayMyt()
          const st = spinStats.query({ where: { userId: viewerId } }).rows[0]
          if (st?.lastSpinDate === date) throw new M16Error('CONFLICT', SPIN_REFUSED)
          let index = spinNext
          spinNext = null
          if (index === null) {
            let r = prng.fresh(`m16:spin:${String(viewerId)}:${date}`).next() * 100
            index = SPIN_SEGMENTS.findIndex((s) => (r -= s.weight) < 0)
            if (index < 0) index = SPIN_SEGMENTS.length - 1
          }
          const seg = SPIN_SEGMENTS[index] as (typeof SPIN_SEGMENTS)[number]
          const credited = reportGame(viewerId, {
            game: 'roda_nasib',
            event: 'spin',
            coins: seg.type === 'syiling' ? seg.value : 0,
            detail: { segment: seg.label },
          })
          spins.insert({
            userId: viewerId,
            date,
            segmentIndex: index,
            type: seg.type,
            value: seg.value,
            credited,
            createdAtMs: m16Now(),
          })
          if (st) {
            spinStats.update(st.id, {
              spins: st.spins + 1,
              won: st.won + credited,
              lastSpinDate: date,
            })
          } else spinStats.insert({ userId: viewerId, spins: 1, won: credited, lastSpinDate: date })
          return {
            segment_index: index,
            label: seg.label,
            icon: seg.icon,
            type: seg.type,
            value: seg.value,
            coinsCredited: credited,
          }
        })
      },

      /** Hook `spinNext(segmentIndex)`: the next spin lands on this 0-based segment. */
      setSpinNext(index: number | null): void {
        spinNext = index
      },

      // --- Jutawan Ilmu (#36–#39, BR-M16-30; the game itself is PROVISIONAL) ------------------------------

      jutawanPage(viewerId: number, darjahRaw: unknown) {
        const stats = jutawan.query({ where: { userId: viewerId } }).rows[0]
        const base = { bestLevel: stats?.bestLevel ?? 0, games: stats?.games ?? 0 }
        if (darjahRaw === undefined || darjahRaw === '') return base
        const d = Number(darjahRaw)
        if (!Number.isInteger(d) || d < 1 || d > 11) {
          throw new M16Error('VALIDATION_ERROR', 'Tahap tidak sah.', 'darjah')
        }
        const level = levelOfGrade(d) as number
        const names = new Map(curriculum.subjects().map((s) => [s.id, s.name]))
        const subjects = []
        for (let id = 1; id <= 31; id++) {
          const count = questions.jutawanCount(id, level)
          if (count <= 0) continue
          const tile = JUTAWAN_TILES[id] ?? JUTAWAN_TILE_FALLBACK
          subjects.push({
            id,
            name: names.get(id) ?? '',
            emoji: tile.emoji,
            colour: tile.colour,
            count,
          })
        }
        return {
          ...base,
          heading: d <= 6 ? `DARJAH ${String(d)}` : `TINGKATAN ${String(d - 6)}`,
          subjects,
        }
      },

      jutawanStart(viewerId: number, body: unknown, prng: PrngRegistry) {
        const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
        const darjah = b.darjah
        const subjectId = b.subject
        if (!isInt(darjah) || darjah < 1 || darjah > 11) {
          throw new M16Error('VALIDATION_ERROR', 'Tahap tidak sah.', 'darjah')
        }
        const level = levelOfGrade(darjah) as number
        if (!isInt(subjectId) || questions.jutawanCount(subjectId, level) <= 0) {
          throw new M16Error('VALIDATION_ERROR', 'Subjek tidak sah.', 'subject')
        }
        return transaction(() => {
          const sessionId = newSessionId('jut_', prng)
          const rng = prng.fresh(`m16:jutawan:${sessionId}`)
          const ids: number[] = []
          for (const d of [1, 2, 3, 4]) {
            const want = Array.from({ length: JUTAWAN_QUESTIONS }, (_, i) => i + 1).filter(
              (n) => jutawanDifficulty(n) === d,
            ).length
            const rows = questions.jutawanSample({ subjectId, level, difficulty: d }, want, rng)
            for (const r of rows) if (!ids.includes(r.id)) ids.push(r.id)
          }
          if (ids.length < JUTAWAN_QUESTIONS) {
            for (const r of questions.jutawanSample(
              { subjectId, level },
              JUTAWAN_QUESTIONS * 2,
              rng,
            )) {
              if (ids.length < JUTAWAN_QUESTIONS && !ids.includes(r.id)) ids.push(r.id)
            }
          }
          if (ids.length < JUTAWAN_QUESTIONS)
            throw new M16Error('VALIDATION_ERROR', 'Soalan tidak mencukupi.', 'subject')
          store.insert({
            id: sessionId,
            userId: viewerId,
            game: 'jutawan',
            darjah,
            createdAtMs: m16Now(),
            submittedAtMs: null,
            score: 0,
            coinsComputed: 0,
            coinsCredited: 0,
            isNewRecord: false,
            itemIds: ids,
            itemCount: JUTAWAN_QUESTIONS,
            jutawan: {
              subjectId,
              level: 0,
              answered: 0,
              lifelines: JUTAWAN_LIFELINES,
              removed: [],
              over: false,
            },
          })
          return {
            sessionId,
            index: 1,
            question: jutawanView(ids[0] as number),
            lifelines: JUTAWAN_LIFELINES,
          }
        })
      },

      jutawanAnswer(viewerId: number, sessionId: string, body: unknown) {
        const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
        return transaction(() => {
          const s = ownSession(viewerId, sessionId)
          if (!s || s.game !== 'jutawan' || !s.jutawan)
            throw new M16Error('NOT_FOUND', 'Sesi tidak dijumpai.')
          if (s.jutawan.over) throw new M16Error('CONFLICT', 'Permainan sudah tamat.')
          const current = (s.itemIds ?? [])[s.jutawan.answered] as number
          if (b.questionId !== current)
            throw new M16Error('VALIDATION_ERROR', 'Soalan tidak sepadan.', 'questionId')
          if (!isInt(b.optionId) || b.optionId < 0 || b.optionId > 3) {
            throw new M16Error('VALIDATION_ERROR', 'Pilihan tidak sah.', 'optionId')
          }
          const graded = questions.jutawanGradeAnswer(current, b.optionId)
          if (!graded) throw new M16Error('NOT_FOUND', 'Soalan tidak dijumpai.')
          if (!graded.isCorrect) {
            const level = s.jutawan.answered
            const credited = jutawanFinish(s, viewerId, level)
            return { correct: false, level, result: { level, credited } }
          }
          const level = s.jutawan.answered + 1
          if (level >= JUTAWAN_QUESTIONS) {
            const credited = jutawanFinish(
              { ...s, jutawan: { ...s.jutawan, answered: level } },
              viewerId,
              level,
            )
            return { correct: true, level, result: { level, credited } }
          }
          store.update(s.id, { jutawan: { ...s.jutawan, answered: level, level, removed: [] } })
          return { correct: true, level, next: jutawanView((s.itemIds ?? [])[level] as number) }
        })
      },

      jutawanLifeline(viewerId: number, sessionId: string, body: unknown, prng: PrngRegistry) {
        const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
        if (b.type !== '50:50') throw new M16Error('VALIDATION_ERROR', 'Bantuan tidak sah.', 'type')
        return transaction(() => {
          const s = ownSession(viewerId, sessionId)
          if (!s || s.game !== 'jutawan' || !s.jutawan)
            throw new M16Error('NOT_FOUND', 'Sesi tidak dijumpai.')
          if (s.jutawan.over) throw new M16Error('CONFLICT', 'Permainan sudah tamat.')
          if (s.jutawan.lifelines <= 0 || s.jutawan.removed.length > 0) {
            throw new M16Error('CONFLICT', 'Tiada bantuan tersedia.')
          }
          const current = (s.itemIds ?? [])[s.jutawan.answered] as number
          const q = questions.jutawanGet(current)
          const wrong = [0, 1, 2, 3].filter(
            (i) => i !== q?.correctAnswer && (q?.options[i] ?? '') !== '',
          )
          const rng = prng.fresh(`m16:jutawan:${sessionId}:ll:${String(s.jutawan.answered)}`)
          const removed = rng
            .shuffle([...wrong])
            .slice(0, 2)
            .sort((x, y) => x - y)
          const lifelines = s.jutawan.lifelines - 1
          store.update(s.id, { jutawan: { ...s.jutawan, lifelines, removed } })
          return { removedOptionIds: removed, lifelines }
        })
      },

      // --- Pertandingan Mingguan (#40, BR-M16-31) ---------------------------------------------------------------

      weekly(viewerId: number) {
        const range = weekRange(m16Now())
        const all = practice.weekRank({ limit: 100_000 })
        const mine = all.find((r) => r.userId === viewerId)
        return {
          weekStart: formatDateKey(range.start),
          weekEnd: formatDateKey(range.end - 1),
          endsAt: toIsoMyt(range.end - 1000),
          prizes: [...WEEKLY_PRIZES],
          me: mine ? { rank: mine.rank, betul: mine.betul } : null,
          rows: all.slice(0, 20).map((r) => ({
            rank: r.rank,
            userId: r.userId,
            name: userName(r.userId),
            sesi: r.sesi,
            betul: r.betul,
            tepat: r.tepat,
          })),
        }
      },
    }
  },
})
