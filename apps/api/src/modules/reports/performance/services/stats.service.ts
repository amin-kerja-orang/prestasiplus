import { Injectable } from '@nestjs/common'

import {
  accuracyOf,
  difficultyIndex,
  difficultyLevel,
  discriminationStatus,
  gradeOfPercent,
  mean,
  pct,
  round,
  type DifficultyLevel,
  type Grade,
} from '../domain/rules'

/** Pure helpers shared with BE-20/21/22 (wraps `domain/rules`; no state, no ports). */
@Injectable()
export class StatsService {
  grade(percent: number): Grade {
    return gradeOfPercent(percent)
  }

  /** Marks-weighted accuracy, capped at 100, 1 decimal. */
  accuracy(score: number, max: number): number {
    return accuracyOf(score, max)
  }

  percent(part: number, whole: number): number {
    return pct(part, whole)
  }

  round(value: number, digits: number): number {
    return round(value, digits)
  }

  mean(values: readonly number[]): number {
    return mean(values)
  }

  difficulty(correct: number, attempts: number): { index: number; level: DifficultyLevel } {
    const index = difficultyIndex(correct, attempts)
    return { index, level: difficultyLevel(index) }
  }

  discrimination(d: number): ReturnType<typeof discriminationStatus> {
    return discriminationStatus(d)
  }

  /** 1-based ranks, descending by value; equal values share a rank (competition ranking: 1, 2, 2, 4). */
  rankWithTies(values: readonly number[]): number[] {
    const sorted = [...values].sort((a, b) => b - a)
    const first = new Map<number, number>()
    sorted.forEach((v, i) => {
      if (!first.has(v)) first.set(v, i + 1)
    })
    return values.map((v) => first.get(v) as number)
  }
}
