/**
 * T-B6 / T-B7 / T-B8 pure transforms (no database): the reward catalogue, its redemptions, the headcount configs and the
 * real V2 article, note and banner shapes. Synthetic values only.
 */
import { describe, expect, it } from 'vitest'

import { articleGradeOfLevel, noteGradeOfLevel, transformArticle, transformBanner, transformNote } from '../../../src/migration/transform/content'
import { giftVendor, transformGift, transformHeadcount, transformRedemption } from '../../../src/migration/transform/rewards'

const stamp = { created_at: '2026-06-20 02:10:01+00', updated_at: '2026-06-20 02:10:01+00' }
const gift = (over: Record<string, string | null> = {}) => ({
  id: '1', name: 'Roblox Gift Card RM10', category: 'gaming', price_rm: '10.00', price_token: '10', cost_value_sen: '1000', stock: '999999',
  redemptions: '0', status: 'aktif', ...stamp, ...over,
})

describe('gifts -> rewards (KP-6: V2 own values)', () => {
  it('keeps the V2 token price, real cost and name; the unlimited stock sentinel is NULL', () => {
    const o = transformGift(gift(), 1)
    expect(o.ok && o.value).toMatchObject({
      category: 'gaming', vendor: 'Roblox', title: 'Roblox Gift Card RM10', denomination_rm: '10.00', token_cost: 10, cost_value_sen: 1000,
      stock_quantity: null, display_order: 1, delivery_method: 'manual', is_active: true,
    })
  })

  it('maps the V2 categories to the V3 list and keeps a limited stock', () => {
    expect(transformGift(gift({ category: 'fnb', stock: '96' }), 2)).toMatchObject({ ok: true, value: { category: 'food_beverage', stock_quantity: 96 } })
    expect(transformGift(gift({ category: 'learning' }), 3)).toMatchObject({ ok: true, value: { category: 'education' } })
    expect(transformGift(gift({ category: 'ewallet', name: 'TnG eWallet RM5' }), 4)).toMatchObject({ ok: true, value: { vendor: 'Touch n Go' } })
  })

  it('rejects an unknown category, a bad price and an unknown status without defaulting', () => {
    expect(transformGift(gift({ category: 'sukan' }), 1)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'category' } })
    expect(transformGift(gift({ price_token: null }), 1)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'price_token' } })
    expect(transformGift(gift({ price_rm: '10.999' }), 1)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'price_rm' } })
    expect(transformGift(gift({ status: 'rosak' }), 1)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'status' } })
    expect(transformGift(gift({ status: 'tidak_aktif' }), 1)).toMatchObject({ ok: true, value: { is_active: false } })
  })

  it('reads the vendor from the brand list, else the first word', () => {
    expect(giftVendor('Mobile Legends 86 Diamonds')).toBe('Mobile Legends')
    expect(giftVendor('CelcomDigi Topup RM10')).toBe('CelcomDigi')
    expect(giftVendor('Celcom Xpax Topup RM10')).toBe('Celcom')
    expect(giftVendor('Hotlink Topup RM5')).toBe('Hotlink')
  })
})

describe('gift_redemptions -> reward_redemptions', () => {
  const g = { id: '9', title: 'TnG eWallet RM5', vendor: 'Touch n Go', denomination_rm: '5.00', cost_value_sen: 500 }
  const row = { id: '1', gift_id: '39', user_id: '7', token_spent: '5', status: 'pending', ...stamp }

  it('a pending redemption waits for the admin, holds one unit of stock and snapshots the reward', () => {
    const o = transformRedemption(row, { userId: '70', gift: g })
    expect(o.ok && o.value).toMatchObject({
      user_id: '70', reward_id: '9', reward_title: 'TnG eWallet RM5', reward_vendor: 'Touch n Go', token_cost: 5, token_cost_snapshot: 5,
      cost_value_sen_snapshot: 500, status: 'pending_admin', stock_reserved: true, delivered_at: null, cancelled_at: null,
    })
  })

  it('rejects an orphan user or gift and an unknown status', () => {
    expect(transformRedemption(row, { userId: undefined, gift: g })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'user_id' } })
    expect(transformRedemption(row, { userId: '70', gift: undefined })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'gift_id' } })
    expect(transformRedemption({ ...row, status: 'x' }, { userId: '70', gift: g })).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'status' } })
  })
})

describe('headcounts -> headcount_configs', () => {
  const row = { id: '1', teacher_id: '3', classroom_id: '4', subject_id: '5', session_year: '2026', tov: '45.00', rs: '60.00', ...stamp }
  const parents = { teacherId: '30', classroomId: '40', subjectId: '50', levelId: '110' }

  it('keeps TOV and RS as legacy values and as the class defaults', () => {
    const o = transformHeadcount(row, parents)
    expect(o.ok && o.value).toMatchObject({
      teacher_id: '30', classroom_id: '40', subject_id: '50', education_level_id: '110', academic_year: 2026, active_otrs: 3, mode: 'auto',
      legacy_tov: '45.00', legacy_rs: '60.00', default_tov: '45.00', default_etr: '60.00',
    })
  })

  it('rejects an orphan parent, a value over 100 and a year outside the V3 check', () => {
    expect(transformHeadcount(row, { ...parents, classroomId: undefined })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'classroom_id' } })
    expect(transformHeadcount({ ...row, tov: '101' }, parents)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'tov' } })
    expect(transformHeadcount({ ...row, session_year: '1999' }, parents)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'session_year' } })
  })
})

describe('real V2 articles, notes and banners (T-B6)', () => {
  const article = { id: '1', title: 'Tajuk', slug: 'tajuk-1', category: 'Tips Belajar', body: null, views: '3', is_published: '1', ...stamp }

  it('an article without text and without an author loads as an empty page of the content owner', () => {
    const o = transformArticle(article, { authorId: '9', gradeLevel: articleGradeOfLevel('Darjah 4') })
    expect(o.ok && o.value).toMatchObject({ content: '', author_id: '9', grade_level: 'DARJAH_4', category: 'TIPS_BELAJAR', excerpt: null })
    expect(articleGradeOfLevel(null)).toBe('SEMUA')
    expect(articleGradeOfLevel('Tingkatan 5')).toBe('SEMUA')
  })

  it('a note takes its subject and grade from the loader and an empty body', () => {
    const n = { id: '1', title: 'Nota', note_type: 'formula', body: null, views: '0', is_published: '1', ...stamp }
    const o = transformNote(n, { ownerId: '9', subject: 'matematik', grade: noteGradeOfLevel('Darjah 2') })
    expect(o.ok && o.value).toMatchObject({ subject: 'matematik', grade: 'DARJAH_2', content: '', note_type: 'FORMULA' })
    expect(transformNote(n, { ownerId: '9', subject: null, grade: 'DARJAH_2' })).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'subject' } })
    expect(noteGradeOfLevel('Tingkatan 4')).toBe('TINGKATAN_4')
  })

  it('the banner target is the audience, not a link', () => {
    const b = { id: '1', title: 'Sepanduk', type: 'FEATURE', target: 'STUDENT', image_path: null, sort_order: '1', is_active: '1', ...stamp }
    const o = transformBanner(b, { start: null, end: null })
    expect(o.droppedTarget).toBe(false)
    expect(o.out.ok && o.out.value).toMatchObject({ target_audience: 'STUDENT', link_type: 'NONE', external_url: null })
    expect(transformBanner({ ...b, target: 'ALL' }, { start: null, end: null }).out).toMatchObject({ ok: true, value: { target_audience: 'ALL' } })
  })
})
