/**
 * Where the pupil is in a sitting (FR-X6-10, FR-MUR-QP-12): the question index and the scroll
 * position of the question area. The live state is held by the page, which does not remount when
 * the layout switches between `phone` and `lg`; this helper adds the reload copy in
 * `sessionStorage` (`pp.qd.pos.{attemptId}`, D115 default). Storage may be blocked or full, so
 * every access is wrapped and a failure just means "no saved position".
 */
export interface AttemptPosition {
  questionIndex: number
  scrollTop: number
}

export const positionKey = (attemptId: string): string => `pp.qd.pos.${attemptId}`

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

const whole = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null

export function readPosition(attemptId: string): AttemptPosition | null {
  try {
    const raw = store()?.getItem(positionKey(attemptId))
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<AttemptPosition>
    const questionIndex = whole(v.questionIndex)
    const scrollTop = whole(v.scrollTop)
    return questionIndex === null || scrollTop === null ? null : { questionIndex, scrollTop }
  } catch {
    return null
  }
}

export function writePosition(attemptId: string, pos: AttemptPosition): void {
  try {
    store()?.setItem(positionKey(attemptId), JSON.stringify(pos))
  } catch {
    /* blocked or full: the position is only a convenience */
  }
}

export function clearPosition(attemptId: string): void {
  try {
    store()?.removeItem(positionKey(attemptId))
  } catch {
    /* ignore */
  }
}
