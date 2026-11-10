/**
 * Reward-catalogue transforms of `migrate:activity` (T-B8, KP-6): the V2 `gifts` and `gift_redemptions` become the M15 token
 * catalogue (`rewards`) and its redemptions (`reward_redemptions`), using V2's OWN values (`price_token` is `token_cost`,
 * OWN-9). Pure functions; the loaders resolve the parents.
 *
 * Nothing is invented beyond what the V3 model forces: `vendor` is NOT NULL and V2 has no vendor column, so it is read from the
 * V2 gift name (`giftVendor`, a fixed brand list; any other name keeps its first word); the V2 sentinel stock 999999 (a digital
 * gift with no limit) is NULL (unlimited) in V3.
 */
import { enumMapper, invalid, nonNegativeInt, orphan } from './activity-common'
import { ok, squash, stamps, text, type Outcome, type Staged } from './activity-common'

/** V2 `gifts.category` -> V3 `ck_rewards_category`. */
export const GIFT_CATEGORY_MAP: Readonly<Record<string, string>> = {
  gaming: 'gaming',
  telco: 'telco',
  streaming: 'streaming',
  fnb: 'food_beverage',
  ecommerce: 'ecommerce',
  ewallet: 'ewallet',
  learning: 'education',
}
const giftCategory = enumMapper('category', GIFT_CATEGORY_MAP)

/** V2 `gifts.status` -> V3 `is_active`. */
export const GIFT_STATUS_MAP: Readonly<Record<string, 'active' | 'inactive'>> = { aktif: 'active', tidak_aktif: 'inactive', nonaktif: 'inactive' }
const giftStatus = enumMapper('status', GIFT_STATUS_MAP)

/** The V2 stock value that means "no limit" (the digital gaming gifts). */
export const UNLIMITED_STOCK = 999_999

/** Brand prefixes of the V2 gift names, longest first; the vendor is the brand as V2 spells it. */
const VENDORS: readonly [RegExp, string][] = [
  [/^mobile legends\b/i, 'Mobile Legends'],
  [/^genshin impact\b/i, 'Genshin Impact'],
  [/^free fire\b/i, 'Free Fire'],
  [/^pubg mobile\b/i, 'PUBG Mobile'],
  [/^celcomdigi\b/i, 'CelcomDigi'],
  [/^celcom\b/i, 'Celcom'],
  [/^u mobile\b/i, 'U Mobile'],
  [/^yes 4g\b/i, 'Yes'],
  [/^zus coffee\b/i, 'ZUS Coffee'],
  [/^youtube\b/i, 'YouTube'],
  [/^disney\+/i, 'Disney+'],
  [/^tng\b/i, 'Touch n Go'],
  [/^mae \//i, 'Maybank'],
  [/^mcd\b/i, 'McDonald\'s'],
  [/^popular\b/i, 'Popular'],
  [/^mph\b/i, 'MPH'],
]

/** The vendor of a gift from its name (see the file header). */
export function giftVendor(name: string): string {
  for (const [re, vendor] of VENDORS) if (re.test(name)) return vendor
  return name.split(/\s+/)[0] ?? name
}

export interface GiftValues {
  category: string
  vendor: string
  title: string
  description: null
  denomination_rm: string
  token_cost: number
  cost_value_sen: number
  stock_quantity: number | null
  display_order: number
  delivery_method: 'manual'
  is_active: boolean
  created_at: string
  updated_at: string
}

const MONEY = /^\d{1,8}(\.\d{1,2})?$/

/** `displayOrder` is the V2 id order (the position in the V2 catalogue). A price or stock that is not a whole non-negative number is INVALID_VALUE. */
export function transformGift(row: Staged, displayOrder: number): Outcome<GiftValues> {
  const title = squash(row.name)
  if (title === null || Array.from(title).length > 255) return invalid('name')
  const category = giftCategory(row.category)
  if (!category.ok) return category
  if (category.value === null) return invalid('category')
  const status = giftStatus(row.status)
  if (!status.ok) return status
  if (status.value === null) return invalid('status')
  const price = nonNegativeInt(row.price_token)
  if (price === null || price === 'invalid') return invalid('price_token')
  const rm = text(row.price_rm)
  if (rm === null || !MONEY.test(rm)) return invalid('price_rm')
  const cost = nonNegativeInt(row.cost_value_sen)
  if (cost === null || cost === 'invalid') return invalid('cost_value_sen')
  const stock = nonNegativeInt(row.stock)
  if (stock === 'invalid') return invalid('stock')
  return ok({
    category: category.value,
    vendor: giftVendor(title),
    title,
    description: null,
    denomination_rm: rm,
    token_cost: price,
    cost_value_sen: cost,
    stock_quantity: stock === null || stock >= UNLIMITED_STOCK ? null : stock,
    display_order: displayOrder,
    delivery_method: 'manual',
    is_active: status.value === 'active',
    ...stamps(row),
  })
}

/** V2 redemption status -> V3 `ck_reward_redemptions_status`. V2 fulfils by hand: `pending` is waiting for the admin. */
export const REDEMPTION_STATUS_MAP: Readonly<Record<string, string>> = {
  pending: 'pending_admin',
  delivered: 'delivered',
  cancelled: 'cancelled',
}
const redemptionStatus = enumMapper('status', REDEMPTION_STATUS_MAP)

export interface RedemptionGift {
  id: string
  title: string
  vendor: string
  denomination_rm: string
  cost_value_sen: number
}

export interface RedemptionValues {
  user_id: string
  reward_id: string
  reward_title: string
  reward_vendor: string
  reward_icon: null
  denomination_rm: string
  token_cost: number
  token_cost_snapshot: number
  cost_value_sen_snapshot: number
  status: string
  stock_reserved: boolean
  delivered_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

/** The snapshot columns copy the reward as it is now (V2 keeps no copy); `token_spent` is the price paid. A pending redemption holds one unit of stock (V2 had already taken it). */
export function transformRedemption(
  row: Staged,
  parents: { userId: string | undefined; gift: RedemptionGift | undefined },
): Outcome<RedemptionValues> {
  if (parents.userId === undefined) return orphan('user_id')
  if (parents.gift === undefined) return orphan('gift_id')
  const status = redemptionStatus(row.status)
  if (!status.ok) return status
  if (status.value === null) return invalid('status')
  const spent = nonNegativeInt(row.token_spent)
  if (spent === null || spent === 'invalid') return invalid('token_spent')
  const s = stamps(row)
  return ok({
    user_id: parents.userId,
    reward_id: parents.gift.id,
    reward_title: parents.gift.title,
    reward_vendor: parents.gift.vendor,
    reward_icon: null,
    denomination_rm: parents.gift.denomination_rm,
    token_cost: spent,
    token_cost_snapshot: spent,
    cost_value_sen_snapshot: parents.gift.cost_value_sen,
    status: status.value,
    stock_reserved: status.value === 'pending_admin',
    delivered_at: status.value === 'delivered' ? s.updated_at : null,
    cancelled_at: status.value === 'cancelled' ? s.updated_at : null,
    ...s,
  })
}

// ---------------------------------------------------------------- headcounts (T-B7)

export interface HeadcountConfigValues {
  teacher_id: string
  classroom_id: string
  subject_id: string
  education_level_id: string
  academic_year: number
  active_otrs: 3
  mode: 'auto'
  legacy_tov: string | null
  legacy_rs: string | null
  default_tov: string | null
  default_etr: string | null
  created_at: string
  updated_at: string
}

const PERCENT = /^\d{1,3}(\.\d{1,2})?$/

function percent(raw: string | null | undefined, column: string): Outcome<string | null> {
  const t = text(raw)
  if (t === null) return ok(null)
  if (!PERCENT.test(t) || Number(t) > 100) return invalid(column)
  return ok(t)
}

/**
 * T-B7: a V2 `headcounts` row is one class-subject-year with its TOV (target of the class) and RS. It becomes one `headcount_configs` row:
 * the two values are kept as `legacy_tov` / `legacy_rs` and ALSO as the class defaults (`default_tov`, `default_etr` = "RS (Sasaran)"), which
 * is what makes the migrated table work on the teacher's screen (a pupil entry with no own value reads the class default). V2 has no
 * pupil entries and no checkpoint count: the config takes the V3 defaults, `auto` mode and 3 checkpoints (nothing else is invented).
 */
export function transformHeadcount(
  row: Staged,
  parents: { teacherId: string | undefined; classroomId: string | undefined; subjectId: string | undefined; levelId: string | undefined },
): Outcome<HeadcountConfigValues> {
  if (parents.teacherId === undefined) return orphan('teacher_id')
  if (parents.classroomId === undefined) return orphan('classroom_id')
  if (parents.subjectId === undefined) return orphan('subject_id')
  const year = nonNegativeInt(row.session_year)
  if (year === null || year === 'invalid' || year < 2020 || year > 2100) return invalid('session_year')
  if (parents.levelId === undefined) return invalid('education_level_id')
  const tov = percent(row.tov, 'tov')
  if (!tov.ok) return tov
  const rs = percent(row.rs, 'rs')
  if (!rs.ok) return rs
  return ok({
    teacher_id: parents.teacherId,
    classroom_id: parents.classroomId,
    subject_id: parents.subjectId,
    education_level_id: parents.levelId,
    academic_year: year,
    active_otrs: 3,
    mode: 'auto',
    legacy_tov: tov.value,
    legacy_rs: rs.value,
    default_tov: tov.value,
    default_etr: rs.value,
    ...stamps(row),
  })
}
