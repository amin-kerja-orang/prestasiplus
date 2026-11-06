/**
 * S16 `/gamification/referral` copy (10-murid FR-MUR-36-1..5, 48-game-and-gamification-spec
 * FR-GM-24.*). The reward amounts are never literals: the page prints `rewardReferrer` from the API.
 * Deviation D1: the doc sentence "Kawan anda masih perlu kod pendaftaran sekolah mereka sendiri." is
 * dropped (it contradicts D115, the register form has no school-code field).
 */

/** AC-GM-24.5: "Setiap kawan yang mendaftar melalui pautan ini memberi anda {n} syiling." */
export function referralRewardSentence(rewardReferrer: number): string {
  return `Setiap kawan yang mendaftar melalui pautan ini memberi anda ${rewardReferrer} syiling.`
}

export const REFERRAL_COPY = {
  title: '🤝 Rujuk Kawan, Dapat Syiling!',
  subtitle: 'Jemput kawan sertai PrestasiPlus dan dapatkan syiling bonus',
  forYou: 'Syiling untuk ANDA',
  forFriend: 'Syiling untuk KAWAN',
  codeLabel: 'Kod rujukan anda',
  // [PROPOSED] the code button keeps the V3 labels (the doc has one Salin/Disalin for the link only).
  copyCode: 'Salin Kod',
  copiedCode: '✓ Disalin!',
  linkLabel: 'Pautan jemputan',
  copyLink: 'Salin',
  copiedLink: 'Disalin',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  referrals: 'Kawan disertakan',
  earned: 'Syiling bonus',
  capReached: 'Had rujukan dicapai.',
  joinedTitle: 'Kawan yang telah sertai',
  joinedEmpty: 'Belum ada kawan mendaftar melalui pautan anda. Kongsi pautan di atas untuk mula.',
  loadError: 'Maaf, berlaku ralat. Sila cuba semula.',
  retry: 'Cuba Semula',
} as const
