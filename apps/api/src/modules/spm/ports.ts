/**
 * Ports of the SPM module (BE-41, owner M06). Same pattern as `PracticePorts` / `CurriculumPorts`: the structured
 * attempts live in `structured_attempts` of BE-13 (student structured practice), which is not merged. This card
 * does not stack on it: the Subjektif overview (M06-07) asks a small port with a safe default (no attempts), and
 * BE-13 binds the real adapter from its own `onModuleInit`. Registering one twice is a wiring error and throws.
 * Tests plug a fake in before `app.init()`.
 */
import { Injectable } from '@nestjs/common'

/** The caller's structured attempts with scope `spm`, summarised (M06-07 `stats`). */
export interface SpmStructuredStats {
  /** Count of the caller's attempts. */
  setsAnswered: number
  /** Distinct subjects among them. */
  subjectsTried: number
  /** Best attempt percentage, rounded; null with no attempt. */
  bestScore: number | null
  /** Distinct structured questions attempted. */
  bestSetsSaved: number
}

export interface SpmStructuredAttemptSource {
  /**
   * Stats over the CALLER's structured attempts with scope `spm` only (another user's attempts never count).
   * `subjectIds` are the Subjektif subjects (decimal ids); rows written under Mod Pelajar count only with `includeTest`.
   */
  statsFor(userId: string, subjectIds: readonly string[], options: { includeTest: boolean }): Promise<SpmStructuredStats>
}

/** Until BE-13 merges: no attempts. */
export class NoStructuredAttempts implements SpmStructuredAttemptSource {
  async statsFor(): Promise<SpmStructuredStats> {
    return { setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0 }
  }
}

@Injectable()
export class SpmPorts {
  private attemptSource: SpmStructuredAttemptSource = new NoStructuredAttempts()
  private readonly set = new Set<string>()

  get structuredAttempts(): SpmStructuredAttemptSource {
    return this.attemptSource
  }

  /** BE-13. */
  provideStructuredAttempts(source: SpmStructuredAttemptSource): void {
    if (this.set.has('structured attempts')) throw new Error('SpmPorts: the structured attempts source is already set')
    this.set.add('structured attempts')
    this.attemptSource = source
  }
}
