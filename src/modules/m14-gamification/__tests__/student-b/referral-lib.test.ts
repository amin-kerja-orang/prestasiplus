import { describe, expect, it } from 'vitest'

import { REFERRAL_COPY, referralRewardSentence } from '../../lib/student/referral-lib'

describe('REFERRAL_COPY (10-murid FR-MUR-36-1..5, 48 FR-GM-24.*)', () => {
  it('matches the doc copy exactly', () => {
    expect(REFERRAL_COPY.subtitle).toBe(
      'Jemput kawan sertai PrestasiPlus dan dapatkan syiling bonus',
    )
    expect(REFERRAL_COPY.codeLabel).toBe('Kod rujukan anda')
    expect(REFERRAL_COPY.linkLabel).toBe('Pautan jemputan')
    expect(REFERRAL_COPY.copyLink).toBe('Salin')
    expect(REFERRAL_COPY.copiedLink).toBe('Disalin')
    expect(REFERRAL_COPY.referrals).toBe('Kawan disertakan')
    expect(REFERRAL_COPY.earned).toBe('Syiling bonus')
    expect(REFERRAL_COPY.joinedTitle).toBe('Kawan yang telah sertai')
    expect(REFERRAL_COPY.joinedEmpty).toBe(
      'Belum ada kawan mendaftar melalui pautan anda. Kongsi pautan di atas untuk mula.',
    )
    expect(REFERRAL_COPY.capReached).toBe('Had rujukan dicapai.')
  })

  it('builds the reward sentence from the amount', () => {
    expect(referralRewardSentence(100)).toBe(
      'Setiap kawan yang mendaftar melalui pautan ini memberi anda 100 syiling.',
    )
    expect(referralRewardSentence(80)).toContain('anda 80 syiling.')
  })

  it('has no hard-coded 50 / 25 reward and no dropped D1 sentence', () => {
    const all = JSON.stringify(REFERRAL_COPY)
    expect(all).not.toMatch(/\b(50|25)\b/)
    expect(all).not.toContain('kod pendaftaran sekolah')
  })
})
