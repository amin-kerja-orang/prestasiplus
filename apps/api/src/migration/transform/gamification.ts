/**
 * Gamification transforms of `migrate:activity` (BE-29 Part B): tiers, achievements, platform challenges,
 * settings, challenge completions, unlocks, referrals and SPM targets (v2-data-migration.md 4.9, plan 14.7).
 * Pure functions; the loaders resolve parent ids and read the staged rows.
 *
 * Rules: an enum value outside its table is `UNKNOWN_ENUM`; a column the v2 model requires and the staged
 * data cannot give is `INVALID_VALUE` naming the column; nothing is defaulted or invented, with one exception: a
 * challenge `difficulty` word outside easy/medium/hard keeps `medium` and is counted (FIT-FIX OQ5). Free text is never
 * put in a reject.
 */
import { enumMapper, invalid, orphan } from './activity-common'
import { enumKey, flag, ok, squash, stamps, text, type Outcome, type Staged } from './activity-common'
import { MAX_AMOUNT_PER_CALL } from '../../modules/wallet/wallet.constants'

// ---------------------------------------------------------------- tiers

/** The key a staged tier is matched on: its label, lower case, spaces folded (Perlu pengesahan: real `.cloud` tier names). */
export function tierMatchKey(labelMs: string | null | undefined): string | null {
  const t = squash(labelMs)
  return t === null ? null : t.toLowerCase()
}

// A source tier with no seeded v2 match is rejected UNSUPPORTED (column label_ms) by the loader: the name, icon,
// colour, threshold and rate columns of a v2 tier have no source (LEAD decision, Perlu pengesahan).

// ---------------------------------------------------------------- challenges

/**
 * v2 `challenge_type` codes. The identity codes plus the five Malay `.cloud` codes (FIT-FIX OQ5, LEAD 25 Oct 13:15 MYT, #109 6393823280),
 * each mapped by what the v2 evaluator measures (`DEFAULT_METRIC_BY_TYPE`, BR-M14-12) and by the "Jenis" select of URS FN-M14-9.3.4:
 * `bilangan_kuiz` "Bilangan Kuiz" -> quiz_count (sessions), `ketepatan` "Ketepatan (%)" -> accuracy (best accuracy),
 * `topik_berbeza` "Topik Berbeza" -> topic_variety (distinct chapters), `kombo` "Kombo" -> streak (day streak),
 * `masa` "Masa (min)" -> time_spent (minutes). Any other word stays UNKNOWN_ENUM (OD-25: never from a hunch).
 */
export const CHALLENGE_TYPE_MAP: Readonly<Record<string, string>> = {
  quiz_count: 'quiz_count',
  accuracy: 'accuracy',
  topic_variety: 'topic_variety',
  streak: 'streak',
  time_spent: 'time_spent',
  bilangan_kuiz: 'quiz_count',
  ketepatan: 'accuracy',
  topik_berbeza: 'topic_variety',
  kombo: 'streak',
  masa: 'time_spent',
}
const challengeType = enumMapper('challenge_type', CHALLENGE_TYPE_MAP)

/** A platform challenge has no author and no class; the others are teacher challenges (no v2 target, GAP-11). */
export function isPlatformChallenge(row: Staged): boolean {
  return text(row.created_by) === null && text(row.classroom_id) === null
}

/**
 * The target of a challenge from `challenges.target_value` (a numeric column on .cloud, staged as text, e.g. `5` or
 * `5.00`). Only a whole number from 1 to 1,000,000 is accepted (the v2 column is an integer with `>= 1`); anything
 * else, including a fraction, is null.
 */
export function challengeTarget(raw: string | null | undefined): number | null {
  const t = text(raw)
  if (t === null || !/^\d{1,7}(\.0+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : null
}

/** Upper bound of a challenge reward: the v2 admin bound (`MAX_AMOUNT_PER_CALL`, BE-23), so a paid reward never trips the wallet limit. */
export const CHALLENGE_REWARD_MAX = MAX_AMOUNT_PER_CALL
const INT4_MAX = 2_147_483_647
const INT4_MIN = -2_147_483_648

/** v2 `challenges.difficulty` codes. Only the identity map is known (OD-25: never from a hunch); a Malay code is not mapped. */
const CHALLENGE_DIFFICULTIES: ReadonlySet<string> = new Set(['easy', 'medium', 'hard'])

/** A whole number given as text (a bigint column staged as text): blank is null, anything that is not a plain integer in `[min, max]` is 'invalid'. */
function wholeNumber(raw: string | null | undefined, min: number, max: number): number | null | 'invalid' {
  const t = text(raw)
  if (t === null) return null
  if (!/^-?\d{1,12}$/.test(t)) return 'invalid'
  const n = Number(t)
  return n >= min && n <= max ? n : 'invalid'
}

/**
 * The difficulty from `challenges.difficulty`: `easy`, `medium` or `hard` (any case, spaces trimmed) map to themselves.
 * Blank is `medium` and not unmapped; any other word keeps `medium` and is `unmapped` so the loader counts it (the word is never recorded).
 */
export function challengeDifficulty(raw: string | null | undefined): { value: string; unmapped: boolean } {
  const key = enumKey(raw)
  if (key === null) return { value: 'medium', unmapped: false }
  return CHALLENGE_DIFFICULTIES.has(key) ? { value: key, unmapped: false } : { value: 'medium', unmapped: true }
}

export interface ChallengeValues {
  title: string
  challenge_type: string
  metric: null
  target_value: number
  reward_syiling: number
  reward_xp: number
  difficulty: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Platform rows only (the caller has filtered teacher rows). `metric` stays null (OD-25). The rewards, difficulty, flag and order come
 * from the staged columns (FIT-FIX OQ5); a missing value takes the v2 default (0 / 0 / medium / 0 / active), an invalid one rejects the row.
 */
export function transformChallenge(row: Staged): Outcome<ChallengeValues> {
  const title = squash(row.title)
  if (title === null || Array.from(title).length > 200) return invalid('title')
  const type = challengeType(row.challenge_type)
  if (!type.ok) return type
  if (type.value === null) return invalid('challenge_type')
  const target = challengeTarget(row.target_value)
  if (target === null) return invalid('target_value')
  const syiling = wholeNumber(row.reward_syiling, 0, CHALLENGE_REWARD_MAX)
  if (syiling === 'invalid') return invalid('reward_syiling')
  const xp = wholeNumber(row.reward_xp, 0, CHALLENGE_REWARD_MAX)
  if (xp === 'invalid') return invalid('reward_xp')
  const order = wholeNumber(row.sort_order, INT4_MIN, INT4_MAX)
  if (order === 'invalid') return invalid('sort_order')
  const active = flag(row.is_active, true)
  if (active === 'invalid') return invalid('is_active')
  return ok({
    title,
    challenge_type: type.value,
    metric: null,
    target_value: target,
    reward_syiling: syiling ?? 0,
    reward_xp: xp ?? 0,
    difficulty: challengeDifficulty(row.difficulty).value,
    sort_order: order ?? 0,
    is_active: active,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- achievements

export interface AchievementValues {
  name: string
  legacy_criteria_text: string | null
  created_at: string
  updated_at: string
}

/** The structured criterion columns stay null (no auto-unlock, GAP-20); the source text is kept as `legacy_criteria_text`. */
export function transformAchievement(row: Staged): Outcome<AchievementValues> {
  const name = squash(row.name)
  if (name === null) return invalid('name')
  return ok({ name, legacy_criteria_text: text(row.criteria), ...stamps(row) })
}

// ---------------------------------------------------------------- reward settings (pivot)

/** The four `reward_settings` columns and the v2 `gamification_settings.key` they become (keys are the same text). */
export const SETTING_KEYS = ['reward_budget_sen_month', 'flat_quiz_reward', 'current_session_year', 'games_award_syiling'] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

/** Labels of the four keys: the same text the v2 seed uses (the staged row has no label). */
export const SETTING_LABELS: Readonly<Record<SettingKey, string>> = {
  reward_budget_sen_month: 'Sub-had nilai-kos tebus per pelajar per bulan (sen) — RM3',
  flat_quiz_reward: 'Syiling flat per soalan akademik betul (tiada beza difficulty)',
  current_session_year: 'Tahun sesi persekolahan semasa (kitar bajet)',
  games_award_syiling: 'Mini-games beri syiling? (0 = XP sahaja, tutup exploit)',
}

export interface SettingEntry {
  /** 0-based position of the key inside the source row (part of the resume key). */
  index: number
  key: SettingKey
  raw: string
}

/** The non-empty setting columns of one `reward_settings` row, in key order. */
export function settingEntries(row: Staged): SettingEntry[] {
  const out: SettingEntry[] = []
  SETTING_KEYS.forEach((key, index) => {
    const raw = text(row[key])
    if (raw !== null) out.push({ index, key, raw })
  })
  return out
}

export interface SettingValues {
  key: SettingKey
  value: string
  label: string
  created_at: string
  updated_at: string
}

/** `numeric(12,2)`: digits with at most two decimals, at most ten before the point; negative or text is INVALID_VALUE. */
export function transformSetting(row: Staged, entry: SettingEntry): Outcome<SettingValues> {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(entry.raw)) return invalid(entry.key)
  return ok({ key: entry.key, value: entry.raw, label: SETTING_LABELS[entry.key], ...stamps(row) })
}

// ---------------------------------------------------------------- challenge completions

/** One staged `challenge_user` row with the keys the pair reader derives (see `readCompletionRows`). */
export interface CompletionRow {
  challenge_id: string | null
  user_id: string | null
  /** Malaysia day: `claimed_on`, else the KL date of `completed_at`; null when neither exists. */
  dkey: string | null
  /** The instant stored as `completed_at` (the source instant, else the start of the claimed Malaysia day). */
  cat: string | null
  /** 1-based ordinal of the day inside the (challenge, user) pair; 0 when there is no day. */
  rk: number
  /** 1-based ordinal of the row inside the (challenge, user, day) group; more than 1 is a repeat. */
  rn: number
}

/** `challenge_id:user_id:day-ordinal`: the day ordinal keeps rows of different days apart (the pivot has one row per day). */
export const completionLegacyId = (r: Pick<CompletionRow, 'challenge_id' | 'user_id' | 'rk'>): string =>
  `${r.challenge_id ?? 'x'}:${r.user_id ?? 'x'}:${r.rk}`

export interface CompletionValues {
  user_id: string
  challenge_id: string
  completion_date: string
  completed_at: string
  is_test: boolean
  created_at: string
  updated_at: string
}

export type CompletionOutcome = Outcome<CompletionValues> | { ok: true; excluded: true }

/** No day (neither `claimed_on` nor `completed_at`) is excluded; a repeat of (user, challenge, day) is DUPLICATE_KEY. */
export function transformCompletion(
  row: CompletionRow,
  parents: { userId: string | undefined; challengeId: string | undefined },
): CompletionOutcome {
  if (row.dkey === null || row.cat === null) return { ok: true, excluded: true }
  if (row.rn > 1) return { ok: false, reject: { reason: 'DUPLICATE_KEY', column: 'claimed_on' } }
  if (parents.userId === undefined) return orphan('user_id')
  if (parents.challengeId === undefined) return orphan('challenge_id')
  return ok({
    user_id: parents.userId,
    challenge_id: parents.challengeId,
    completion_date: row.dkey,
    completed_at: row.cat,
    is_test: false,
    created_at: row.cat,
    updated_at: row.cat,
  })
}

// ---------------------------------------------------------------- achievement unlocks

export interface UnlockRow {
  achievement_id: string | null
  user_id: string | null
  unlocked_at: string | null
  /** 1-based ordinal inside the (achievement, user) pair, earliest unlock first; more than 1 is a repeat. */
  rn: number
}

export interface UnlockValues {
  user_id: string
  achievement_id: string
  unlocked_at: string
  is_test: boolean
  created_at: string
  updated_at: string
}

export function transformUnlock(
  row: UnlockRow,
  parents: { userId: string | undefined; achievementId: string | undefined },
): Outcome<UnlockValues> {
  if (row.rn > 1) return { ok: false, reject: { reason: 'DUPLICATE_KEY', column: 'user_id' } }
  if (parents.userId === undefined) return orphan('user_id')
  if (parents.achievementId === undefined) return orphan('achievement_id')
  if (row.unlocked_at === null) return invalid('unlocked_at')
  return ok({
    user_id: parents.userId,
    achievement_id: parents.achievementId,
    unlocked_at: row.unlocked_at,
    is_test: false,
    created_at: row.unlocked_at,
    updated_at: row.unlocked_at,
  })
}

// ---------------------------------------------------------------- referrals

export interface ReferralCodeValues {
  user_id: string
  code: string
  created_at: string
  updated_at: string
}

/** `referral_codes.code` is 1 to 50 characters (check) and unique; a clash is rejected by the loader (DUPLICATE_KEY). */
export function transformReferralCode(row: Staged, userId: string | undefined): Outcome<ReferralCodeValues> {
  if (userId === undefined) return orphan('user_id')
  const code = text(row.referral_code)
  if (code === null || Array.from(code).length > 50) return invalid('referral_code')
  return ok({ user_id: userId, code, ...stamps(row) })
}

export interface ReferralValues {
  referrer_id: string
  referee_id: string
  code_used: string
  rewarded: boolean
  created_at: string
  updated_at: string
}

/**
 * Pass 2: the referee is the user whose `referred_by` is set. A self-referral (check `referrer <> referee`) is
 * INVALID_VALUE; a referrer that was not loaded, or has no code to record as `code_used`, is ORPHAN_PARENT.
 */
export function transformReferral(
  row: Staged,
  parents: { refereeId: string | undefined; referrerId: string | undefined; referrerCode: string | null },
): Outcome<ReferralValues> {
  if (parents.refereeId === undefined) return orphan('user_id')
  const referredBy = text(row.referred_by)
  if (referredBy === null) return invalid('referred_by')
  if (referredBy === text(row.id)) return invalid('referred_by')
  if (parents.referrerId === undefined) return orphan('referred_by')
  if (parents.referrerCode === null) return orphan('referral_code')
  return ok({
    referrer_id: parents.referrerId,
    referee_id: parents.refereeId,
    code_used: parents.referrerCode,
    rewarded: false,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- SPM targets

/** The nine target grades (`G` is a result grade only; a check excludes it). */
export const SPM_GRADES: readonly string[] = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E']

export interface SpmEntry {
  /** 0-based position inside the user's targets (part of the resume key). */
  index: number
  /** The source subject id (digits), or null when the entry has no usable one. */
  subjectRef: string | null
  grade: string | null
  /** The entry (or the whole text) has a shape this transform does not know. */
  badShape: boolean
  /** A later entry for a subject already seen for this user. */
  repeat: boolean
}

const MAX_ENTRIES = 100

/**
 * Parses `users.spm_targets` (text, probably JSON; Perlu pengesahan). Known shapes: an object `{ "<subject id>": "<grade>" }`
 * or an array of `{ subject_id, grade | target_grade | target }`. An empty text, `{}` or `[]` gives no entries; any other shape
 * gives one `badShape` entry (rejected as INVALID_VALUE, never defaulted).
 */
export function parseSpmTargets(raw: string | null | undefined): SpmEntry[] {
  const t = text(raw)
  if (t === null) return []
  const bad = (index = 0): SpmEntry => ({ index, subjectRef: null, grade: null, badShape: true, repeat: false })
  if (t.length > 20_000) return [bad()]
  let parsed: unknown
  try {
    parsed = JSON.parse(t)
  } catch {
    return [bad()]
  }
  const pairs: { ref: unknown; grade: unknown }[] = []
  if (Array.isArray(parsed)) {
    for (const el of parsed) {
      if (el === null || typeof el !== 'object' || Array.isArray(el)) {
        pairs.push({ ref: undefined, grade: undefined })
        continue
      }
      const o = el as Record<string, unknown>
      pairs.push({ ref: o.subject_id, grade: o.grade ?? o.target_grade ?? o.target })
    }
  } else if (parsed !== null && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) pairs.push({ ref: k, grade: v })
  } else {
    return [bad()]
  }
  if (pairs.length > MAX_ENTRIES) return [bad()]
  const seen = new Set<string>()
  return pairs.map((p, index) => {
    const ref = typeof p.ref === 'number' ? String(p.ref) : typeof p.ref === 'string' ? p.ref.trim() : null
    const subjectRef = ref !== null && /^\d{1,9}$/.test(ref) ? ref : null
    const grade = typeof p.grade === 'string' ? p.grade.trim().toUpperCase() : null
    const repeat = subjectRef !== null && seen.has(subjectRef)
    if (subjectRef !== null) seen.add(subjectRef)
    return { index, subjectRef, grade, badShape: subjectRef === null, repeat }
  })
}

export interface SpmTargetValues {
  user_id: string
  subject_id: string
  target_grade: string
  is_test: boolean
  created_at: string
  updated_at: string
}

export function transformSpmTarget(
  entry: SpmEntry,
  parents: { userId: string | undefined; subjectId: string | undefined },
  stamp: { created_at: string; updated_at: string },
): Outcome<SpmTargetValues> {
  if (parents.userId === undefined) return orphan('user_id')
  if (entry.badShape) return invalid('spm_targets')
  if (entry.repeat) return { ok: false, reject: { reason: 'DUPLICATE_KEY', column: 'subject_id' } }
  if (entry.grade === null || !SPM_GRADES.includes(entry.grade)) return invalid('target_grade')
  if (parents.subjectId === undefined) return orphan('subject_id')
  return ok({ user_id: parents.userId, subject_id: parents.subjectId, target_grade: entry.grade, is_test: false, ...stamp })
}
