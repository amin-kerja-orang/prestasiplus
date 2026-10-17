/** Shared prop types of the composites. Copy (BM) is always passed in by the caller. */

/** Meaning colour of a chip, tile or card (design system 3.3). */
export type DsAccent = 'action' | 'win' | 'heat' | 'friend' | 'trial'

/** Mood of the virtual friend (design system 10.3). */
export type FriendMood = 'neutral' | 'happy' | 'encouraging' | 'celebrating'

/** State of a quiz option (design system 6, "Quiz option"). */
export type QuizOptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'
