# User notice for 28 Oct 2026 (BM short and full)

Status: Draft — NOTICE-P10, LEAD card 25 Oct; send on 28 Oct. Not yet reviewed by the LEAD. Facts checked against tip `4078bf53`.

## Open items before sending

| # | Item | Owner |
|---|---|---|
| Q27 | The help channel and the send time are not decided. Both messages carry the visible placeholder `[SALURAN BANTUAN - Q27, belum diputuskan]`. Replace it before sending. | LEAD |
| N4 | **This notice is true only once the FIT-FIX PR (Amin1) is merged.** R39 says the migration must stop flagging roster accounts and the shared default hash (#113 comment 6371548446, item 1). At tip `4078bf53`, `apps/api/src/migration/transform/secrets.ts` lines 27-29 still flag them `must_reset_password`. If FIT-FIX is not merged before the 28 Oct run, those users would be asked for a password change, and the sentence "Kata laluan anda TIDAK berubah" would be wrong for them. | Amin1 (FIT-FIX), LEAD |
| N5 | Two ops docs still carry the pre-R39 wording. `docs/ops/v2-cutover-plan.md:87` (P10: roster and legacy-password accounts "must set a new password") and `docs/ops/pre-night-28oct.md:285` ("Support told to expect a password-reset spike"). Only accounts with no usable password (for example Google-only) still need a reset. | LEAD / ops |
| N6 | The opening time on 30 Oct is not fixed in the docs, so the notice says only "30 Okt". | LEAD |
| N7 | "Lupa kata laluan?" sends a reset link by e-mail, so it needs production mail to be working on 30 Oct. | ops |
| N8 | "Keputusan latihan dan sejarah aktiviti ... dipindahkan" is true in general, but the LEAD decisions of 25 Oct 13:15 MYT (#113 comment 6393823432) exclude two kinds of records. Exam attempts still `in_progress` are not migrated. Classes whose teacher no longer exists in the source are dropped with their enrolments; the pupils themselves still migrate. The text stays general; the LEAD decides whether to mention these. | LEAD |

## Facts this notice relies on

| Fact | Source |
|---|---|
| The old system is read-only from 01:00 MYT on 29 Oct until the new system opens on 30 Oct. | `docs/ops/v2-cutover-plan.md:87` (P10); `docs/ops/pre-night-28oct.md:120`; the LEAD card of 25 Oct 12:38 MYT. The docs say "about 01:00", and the notice follows the card. |
| No forced password change. Migrated users sign in with their existing username (or e-mail) and the same password. | R39, #113 comment 6371548446 item 1; `docs/architecture/v2-backend-deviations.md:740` (R39 row) |
| Login accepts an e-mail or a username. | `apps/api/src/modules/auth/auth.service.ts:67` (login by e-mail or username; #225) |
| Only an account with no usable password keeps the reset flag (it cannot sign in otherwise). A Google-only account on `.cloud` has no password, so it is one of these. | R39 item 1; `apps/api/src/migration/transform/secrets.ts:27` (empty or unusable is stored as null and flagged) |
| Users with no password (Google sign-in on `.cloud`) use "Lupa kata laluan?" on the new system. | LEAD addition, #113 comment 6393823432 (13:15 MYT) |
| "Lupa kata laluan?" works for such an account. A reset link is sent to any active, non-suspended account with an e-mail, whether or not it has a password, and the reset stores the new password and clears the flag. | `apps/api/src/modules/account/password-reset.service.ts:73-85` and `:136` |
| The exact link label on the v2 login page is "Lupa kata laluan?". A second link, "Reset melalui No IC", serves accounts without an e-mail. | `src/modules/m01-authentication/pages/LoginPage.vue:118-127` |
| Everyone signs in again, because sessions and tokens are not migrated. | `docs/architecture/v2-data-migration.md` section 2 (Not migrated) |
| Practice sessions, answers and activity history are migrated. | `docs/architecture/v2-data-migration.md` section 6.1 |
| v2 has no Google sign-in; `google_id` is not staged. | `apps/api/src/migration/load/index.ts:64`; `docs/requirements/v2-backend-urs.md` BE-MIG-10 |
| The docs' P10 text calls the old system `.cloud`, so the notice uses ".cloud". | `docs/ops/v2-cutover-plan.md:87` |

## Short version (WhatsApp/SMS)

About 380 characters with the placeholder: 3 SMS segments (GSM-7, 153 per segment). Keep the real help channel short so it stays within 459.

```text
PrestasiPlus: .cloud jadi baca-sahaja mulai 01:00 pagi 29 Okt sehingga sistem baharu dibuka 30 Okt. Kata laluan anda TIDAK berubah: log masuk semula dengan e-mel/nama pengguna dan kata laluan yang sama. Akaun tanpa kata laluan (dulu log masuk dengan Google): guna "Lupa kata laluan?" di halaman log masuk. Bantuan: [SALURAN BANTUAN - Q27, belum diputuskan]. - Pasukan PrestasiPlus
```

## Full version (e-mail / announcement)

Subject: Makluman: Sistem baharu PrestasiPlus dibuka 30 Oktober 2026

```text
Tuan/Puan,

Salam sejahtera. Terima kasih kerana menggunakan PrestasiPlus.

Kami ingin memaklumkan bahawa PrestasiPlus akan berpindah ke sistem baharu. Sila ambil perhatian tarikh berikut:

- 29 Oktober 2026, mulai 01:00 pagi (MYT): sistem lama (.cloud) hanya boleh dibaca (read-only). Anda masih boleh melihat data, tetapi tidak dapat membuat latihan atau perubahan baharu.
- 30 Oktober 2026: sistem baharu dibuka.

Apa yang perlu dilakukan

1. Pengguna yang mempunyai kata laluan (guru, murid, ibu bapa dan pentadbir sekolah)
   - Anda TIDAK perlu menukar kata laluan.
   - Gunakan e-mel atau nama pengguna dan kata laluan yang sama seperti sebelum ini.
   - Anda hanya perlu log masuk semula di sistem baharu.

2. Pengguna yang log masuk dengan Google di sistem lama (akaun tanpa kata laluan)
   - Pada halaman log masuk sistem baharu, pilih pautan "Lupa kata laluan?".
   - Ikut langkah yang diberikan untuk mencipta kata laluan anda.
   - Selepas itu, log masuk seperti biasa.

Data anda

Keputusan latihan dan sejarah aktiviti anda daripada sistem lama dipindahkan ke sistem baharu.

Bantuan

Jika Tuan/Puan menghadapi sebarang masalah, sila hubungi: [SALURAN BANTUAN - Q27, belum diputuskan]

Sekian, terima kasih.

Pasukan PrestasiPlus
```

## Do not say

- No "set a new password", "tukar kata laluan baharu" or "tetapkan kata laluan baharu" for users who have a password (R39). The old P10 and A5.4 wording is wrong.
- No exact opening time on 30 Oct (the docs do not fix one).
- No real names, phone numbers, e-mails, addresses or URLs. Only `<domain>` is allowed as a placeholder.
- No mention of any Google sign-in on the new system (v2 has none).
- No promise about help channel, hours or response time until Q27 is decided.
- Do not list what is not migrated (for example revision queues) unless the LEAD approves.
