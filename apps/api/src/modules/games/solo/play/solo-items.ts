import { Inject, Injectable } from '@nestjs/common'
import type { GamesSoloGame } from '@pp/contract'

import type { Prng } from '../../../../db/prng'
import { GameQuestions, type ServedQuestion } from '../../core/game-questions.service'
import { MEMORY_PAIRS, SOLO_INFO, SUSUN_MAX_ANSWER, susunPoints } from './solo.rules'

/** One `game_session_items` row to insert (server-only facts included; never sent to the client). */
export interface ItemRow {
  position: number
  questionId: string
  keyIndex: number | null
  statementTrue: boolean | null
  difficulty: number
  points: number | null
  cardId: string | null
  face: 'question' | 'answer' | null
  pairKey: number | null
}

export interface BuiltSolo {
  rows: ItemRow[]
  maxScore: number
  /** The keyless part of the payload: `{ statements }`, `{ questions }`, `{ puzzles }` or `{ cards, count, layout }`. */
  items: Record<string, unknown>
}

const CARD_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Fisher-Yates over a copy, drawing from `rng`. */
export function shuffled<T>(list: readonly T[], rng: Prng): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}

const difficultyOf = (s: ServedQuestion): number => Math.max(1, s.difficultyTp ?? 1)
const fourOptions = (s: ServedQuestion): boolean => s.question.options.length === 4
const shortAnswer = (s: ServedQuestion): boolean => s.keyText.trim() !== '' && s.keyText.trim().length <= SUSUN_MAX_ANSWER

/** Splits an answer into tiles: one word = its letters, several words = the words; shuffled until it differs (at most 5 tries). */
function scramble(answer: string, rng: Prng): { type: 'letters' | 'words'; tiles: string[] } {
  const words = answer.trim().split(/\s+/)
  const type = words.length === 1 ? 'letters' : 'words'
  const original = type === 'letters' ? [...(words[0] ?? '')] : words
  let tiles = [...original]
  for (let i = 0; i < 5 && tiles.length > 1; i++) {
    tiles = shuffled(original, rng)
    if (tiles.join('|') !== original.join('|')) break
  }
  return { type, tiles }
}

/**
 * Builds the items of one solo session from published MCQ (through `GameQuestions`, never the question tables):
 * the rows with the server-only facts and the keyless payload part (D58a).
 */
@Injectable()
export class SoloItemBuilder {
  constructor(@Inject(GameQuestions) private readonly questions: GameQuestions) {}

  /** `levelIds` is one education level for the four question games and levels D1..D4 for Kad Memori. */
  async build(game: GamesSoloGame, levelIds: readonly string[], rng: Prng, cardRng: Prng = rng): Promise<BuiltSolo> {
    const info = SOLO_INFO[game]
    if (game === 'kad-memori') return this.memory(levelIds, rng, cardRng)
    const first = levelIds[0]
    const drawn = first === undefined ? [] : await this.questions.sample({ educationLevelId: first }, info.items * info.oversample, rng)
    switch (game) {
      case 'betul-salah':
        return this.betulSalah(drawn.slice(0, info.items), rng)
      case 'cabaran-kilat':
        return this.fourOption(drawn.filter(fourOptions).slice(0, info.items), true)
      case 'tembak-jawapan':
        return this.fourOption(drawn.filter(fourOptions).slice(0, info.items), false)
      case 'susun-jawapan':
        return this.susun(drawn.filter(shortAnswer).slice(0, info.items), rng)
    }
  }

  private betulSalah(list: ServedQuestion[], rng: Prng): BuiltSolo {
    const rows: ItemRow[] = []
    const statements = list.map((s, i) => {
      const wrong = s.question.options.filter((o) => o.id !== s.keyIndex && o.text.trim() !== '')
      const isTrue = rng.next() < 0.5 || wrong.length === 0
      const shown = isTrue ? s.keyText : (rng.pick(wrong).text)
      rows.push(row(i + 1, s, { statementTrue: isTrue }))
      return { id: s.question.id, statement: `${s.question.text} → ${shown}`, difficulty: difficultyOf(s) }
    })
    return { rows, maxScore: 0, items: { statements } }
  }

  private fourOption(list: ServedQuestion[], withIds: boolean): BuiltSolo {
    const rows: ItemRow[] = []
    const questions = list.map((s, i) => {
      rows.push(row(i + 1, s, {}))
      const options = s.question.options.map((o) => (withIds ? { id: o.id, text: o.text } : { text: o.text }))
      return withIds
        ? { id: s.question.id, question_text: s.question.text, difficulty: difficultyOf(s), options }
        : { id: s.question.id, question: s.question.text, difficulty: difficultyOf(s), options }
    })
    return { rows, maxScore: 0, items: { questions } }
  }

  private susun(list: ServedQuestion[], rng: Prng): BuiltSolo {
    const rows: ItemRow[] = []
    let maxScore = 0
    const puzzles = list.map((s, i) => {
      const { type, tiles } = scramble(s.keyText.trim(), rng)
      const points = susunPoints(type, tiles.length)
      maxScore += points
      rows.push(row(i + 1, s, { points }))
      return { id: s.question.id, question: s.question.text, scrambled: tiles, type, difficulty: difficultyOf(s), points }
    })
    return { rows, maxScore, items: { puzzles } }
  }

  /** Kad Memori: 6 questions drawn over the levels, 12 cards with opaque ids and a shuffled board; no face in the payload. */
  private async memory(levelIds: readonly string[], rng: Prng, cardRng: Prng): Promise<BuiltSolo> {
    const pool: ServedQuestion[] = []
    for (const level of levelIds) {
      for (const s of await this.questions.sample({ educationLevelId: level }, MEMORY_PAIRS, rng)) {
        if (!pool.some((p) => p.question.id === s.question.id)) pool.push(s)
      }
    }
    const chosen = shuffled(pool, rng).slice(0, MEMORY_PAIRS)
    const cards: ItemRow[] = []
    chosen.forEach((s, pair) => {
      cards.push(row(0, s, { face: 'question', pairKey: pair, keyIndex: null }), row(0, s, { face: 'answer', pairKey: pair, keyIndex: null }))
    })
    const used = new Set<string>()
    const board = shuffled(cards, rng).map((c, i) => {
      let id = ''
      do {
        id = Array.from({ length: 8 }, () => CARD_ALPHABET[cardRng.int(0, CARD_ALPHABET.length - 1)] as string).join('')
      } while (used.has(id))
      used.add(id)
      return { ...c, position: i + 1, cardId: id }
    })
    return {
      rows: board,
      maxScore: 0,
      items: { cards: board.map((c) => ({ id: c.cardId as string })), count: 12, layout: { columns: 4, rows: 3 } },
    }
  }
}

function row(position: number, s: ServedQuestion, extra: Partial<ItemRow>): ItemRow {
  return {
    position,
    questionId: s.question.id,
    keyIndex: s.keyIndex,
    statementTrue: null,
    difficulty: difficultyOf(s),
    points: null,
    cardId: null,
    face: null,
    pairKey: null,
    ...extra,
  }
}
