import type { Response } from 'supertest'
import { GamesRoomViewSchema, envelopeOf } from '@pp/contract'
import { expect } from 'vitest'

import type { RoomState } from '../../../src/modules/games/rooms/engine'
import type { PlatformAccuracySource } from '../../../src/modules/games'
import { START } from '../helpers'
import type { Client, GamesTestApp } from '../helpers'
import type { TestDatabase } from '../../support/db'

export const roomEnvelope = envelopeOf(GamesRoomViewSchema)

/** Bots' accuracy double: a fixed probability (changeable between steps). */
export class FixedAccuracy implements PlatformAccuracySource {
  constructor(public p = 0.5) {}
  async accuracy(): Promise<number> {
    return this.p
  }
}

/**
 * Inserts published single-part MCQ with SHORT option texts ("Opsyen B": the Teka Silang Kata answer is the key
 * text and must be 20 characters or fewer). Fictitious text. Key rotates A..D by index.
 */
export async function insertShortMcqs(
  db: TestDatabase,
  opts: { subject: string; level: string; count: number; prefix: string },
): Promise<{ id: string; keyIndex: number; keyText: string }[]> {
  const out: { id: string; keyIndex: number; keyText: string }[] = []
  const now = new Date(START)
  await db.prisma.$transaction(
    async (tx) => {
      const subject = await tx.subject.findUnique({ where: { code: opts.subject } })
      const level = await tx.educationLevel.findUnique({ where: { code: opts.level } })
      const owner = await tx.userRole.findFirst({
        where: { role: 'admin' },
        orderBy: { userId: 'asc' },
      })
      if (!subject || !level || !owner)
        throw new Error(`unknown subject ${opts.subject} / level ${opts.level}`)
      for (let i = 0; i < opts.count; i++) {
        const label = `${opts.prefix}-${opts.subject}-${opts.level}-${String(i + 1).padStart(3, '0')}`
        const text = `Soalan bilik contoh ${label}`
        const keyIndex = i % 4
        const question = await tx.question.create({
          data: {
            sourceType: 'manual',
            createdById: owner.userId,
            latestVersionNo: 1,
            liveVersionNo: 1,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        })
        const version = await tx.questionVersion.create({
          data: {
            questionId: question.id,
            versionNo: 1,
            status: 'approved',
            publishedAt: now,
            type: 'mcq',
            stemMs: text,
            numberLabel: label,
            language: 'ms',
            subjectId: subject.id,
            educationLevelId: level.id,
            formOrigin: 't4',
            difficultyTp: (i % 4) + 1,
            sourceKind: 'publisher',
            rightsStatus: 'own',
            createdAt: now,
            updatedAt: now,
          },
        })
        const part = await tx.questionPart.create({
          data: {
            questionVersionId: version.id,
            parentPartId: null,
            position: 1,
            depth: 1,
            label: '',
            promptMs: text,
            marks: 1,
            mode: 'mcq',
            reveal: 'after_submit',
          },
        })
        const optionTexts = ['A', 'B', 'C', 'D'].map((l) => `Opsyen ${l}`)
        await tx.partOption.createMany({
          data: optionTexts.map((bodyMs, k) => ({
            partId: part.id,
            label: 'ABCD'[k] as string,
            bodyMs,
            position: k + 1,
          })),
        })
        await tx.answerKey.create({
          data: {
            partId: part.id,
            kind: 'option',
            content: { kind: 'option', correct: 'ABCD'[keyIndex] as string },
          },
        })
        out.push({ id: String(question.id), keyIndex, keyText: optionTexts[keyIndex] as string })
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
  return out
}

/** Test oracle: the engine document straight from the database (it holds the keys; the API never shows them). */
export async function stateOf(db: TestDatabase, code: string): Promise<RoomState> {
  const rows = await db.query<{ state: RoomState }>(
    'select state from game_rooms where code = $1',
    [code],
  )
  return (rows[0] as { state: RoomState }).state
}

export const roomOf = async (db: TestDatabase, code: string) =>
  (
    await db.query<Record<string, unknown>>('select * from game_rooms where code = $1', [code])
  )[0] as Record<string, unknown>

export const FORM = {
  subject: 'MATEMATIK',
  grade_level: 'TINGKATAN_4',
  match_mode: 'same_grade',
} as const
export const PB_FORM = { ...FORM, max_players: 4 } as const

export const P = (game: string, code?: string, tail = '') =>
  `/api/games/${game}/rooms${code ? `/${code}` : ''}${tail}`

export async function createRoom(
  c: Client,
  game: string,
  form: object = game === 'papan-bijak' ? PB_FORM : FORM,
): Promise<string> {
  const res = await c.post(P(game), form)
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return (res.body as { data: { code: string } }).data.code
}

export function parseRoom(res: Response) {
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return roomEnvelope.parse(res.body).data
}

/** Polls the host's view until the room has the minimum players (the simulation adds one bot per poll). */
export async function fillAndStart(c: Client, game: string, code: string, polls = 3) {
  for (let i = 0; i < polls; i++) await c.get(P(game, code))
  return c.post(P(game, code, '/start'))
}

/** Answers the pending question correctly (or wrongly) using the oracle. */
export async function answerBody(
  t: GamesTestApp,
  code: string,
  right: boolean,
  extra: object = {},
) {
  const st = await stateOf(t.db, code)
  const q = st.qs[st.pendingQ as string] as { keyIndex: number; keyText: string }
  const optionId = right ? q.keyIndex : (q.keyIndex + 1) % 4
  return { type: 'answer', questionId: st.pendingQ, optionId, ...extra }
}

import type { BotCandidate, BotPickInput, BotPoolPort } from '../../../src/modules/games'

/** Bot pool double: the first listed candidate that fits and is not in the room (deterministic, order = list). */
export class ListBots implements BotPoolPort {
  readonly picks: BotPickInput[] = []
  constructor(readonly list: BotCandidate[]) {}
  async pick(input: BotPickInput): Promise<BotCandidate | null> {
    this.picks.push(input)
    const taken = new Set(input.exclude)
    return this.list.find((b) => !taken.has(b.id) && input.fits(b.grade)) ?? null
  }
}

/** The generated DEMO001 students (`murid.demo001.NN@example.test`), by id. */
export async function demo001Students(
  db: TestDatabase,
): Promise<(BotCandidate & { email: string })[]> {
  const rows = await db.query<{ id: string; name: string; grade: number | null; email: string }>(
    `select id::text, name, grade, email from users where email like 'murid.demo001.%@example.test' order by id`,
  )
  return rows
}

export const userId = async (db: TestDatabase, email: string): Promise<string> =>
  (
    await db.query<{ id: string }>('select id::text from users where lower(email) = lower($1)', [
      email,
    ])
  )[0]?.id as string
