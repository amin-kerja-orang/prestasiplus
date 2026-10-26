# User notice for 28 Oct 2026 (BM short and full)

Status: Draft — NOTICE-P10, LEAD card 25 Oct; send on 28 Oct. Wording updated for LEAD decisions D20 and D34 (26 Oct 09:34 MYT, #113 comment 6406301354). Not yet reviewed by the LEAD. Facts checked against tip `4078bf53`.

## Open items before sending

Open:

| # | Item | Owner |
|---|---|---|
| Q27 | The help channel and the send time are not decided. Both messages carry the visible placeholder `[SALURAN BANTUAN - Q27, belum diputuskan]`. Replace it before sending. The short version must stay within 459 septets after the replacement. | LEAD |
| N6 | The opening time on 30 Oct is not fixed in the docs, so the notice says only "30 Okt". | LEAD |
| N7 | Moot under AM-18 A: there is no reset e-mail at go-live, so the notice uses the "Reset melalui No IC" path and no longer depends on production mail. Revisit only if the LEAD reverses AM-18 A. | ops |
| N8 | "Keputusan latihan dan sejarah aktiviti ... dipindahkan" is true in general, but the LEAD decisions of 25 Oct 13:15 MYT (#113 comment 6393823432) exclude two kinds of records. Exam attempts still `in_progress` are not migrated. Classes whose teacher no longer exists in the source are dropped with their enrolments; the pupils themselves still migrate. The text stays general; the LEAD decides whether to mention these. | LEAD |
| N10 (Perlu pengesahan LEAD, narrowed) | The switch type is still unconfirmed (Q21): the cutover plan says the dump operator makes `.cloud` "read-only or maintenance mode" (section 'What never happens' and row P8; pre-night Script gaps). Maintenance mode might block viewing. The notice therefore no longer promises that users can still view data: it says the old system "mungkin hanya boleh dibaca atau tidak boleh diakses buat sementara" and that new practice or changes cannot be made, which is true in both modes (AM1-3 N2). Resolved when the LEAD / dump operator confirms the mode; then the sentence may be made specific. | LEAD, dump operator |
| N11 (send condition) | **Send this notice only if FE #226 and #357 are in the release sha.** Without them, a flagged user gets 403 `PASSWORD_CHANGE_REQUIRED` and the error banner, not the "Tukar Kata Laluan" screen the notice promises (P11-DRESS-2/3, #113 6402323393, 6402500822). | LEAD / FE |
| N5 | Two ops docs still carry the pre-R39 wording: the cutover plan, row P10 (roster and legacy-password accounts "must set a new password") and the pre-night sheet, G6 checklist row ("Support told to expect a password-reset spike"). Under D34 the migration still flags roster, shared-default and argon2id accounts, and users with no usable password (for example Google-only) must also reset, so a support spike is still possible. Align those two docs with this notice. | LEAD / ops |

Closed:

| # | Item | Resolution |
|---|---|---|
| N9 | Google-only instruction vs AM-18 A (the e-mail link would send nothing). | Resolved by D20 (26 Oct 09:34 MYT): Google-only users are told to choose "Lupa kata laluan?" then "Reset melalui No IC" (an IC on record is needed), otherwise to ask their teacher or school admin. |
| N4 / R39-C4 | Whether the migration stops flagging roster, shared-default and argon2id accounts (FIT-FIX). | Resolved by D34 = R39-C4 option 2: the code stays as it is (`decidePassword()` still flags them). FE #226 + #357 add a `/password/change` screen at first login, and the notice now says users "mungkin diminta" to change the password. |

## Facts this notice relies on

| Fact | Source |
|---|---|
| The old system is read-only from 01:00 MYT on 29 Oct until the new system opens on 30 Oct. | The cutover plan, row P10; the pre-night sheet, Step 4; the LEAD card of 25 Oct 12:38 MYT. The docs say "about 01:00", with final times in a reminder, so the notice says "kira-kira 01:00" and mentions the reminder (AM1-3 N1). No sheet yet schedules or owns that reminder (LEAD / ops). |
| Migrated users sign in with their existing username (or e-mail) and the same password, but **may** be asked to set a new one at first login. | D34 = R39-C4 option 2 and D20 (#113 comment 6406301354); R39, #113 comment 6371548446 item 1; `docs/architecture/v2-backend-deviations.md:740` (R39 row) |
| Which accounts are flagged `must_reset_password`: roster accounts (a username and no e-mail), the shared default hash, any `$argon2id$` hash, and anything that is not valid bcrypt (stored as null). A valid bcrypt hash with no other reason is not flagged. | `apps/api/src/migration/transform/secrets.ts`, `decidePassword()` (flags `mustResetPassword` whenever any reason is recorded) |
| A flagged user is sent to the screen "Tukar Kata Laluan" at first login (`/password/change`), with the message "Sila tukar kata laluan anda sebelum meneruskan." | FE PR #226 (page "Tukar Kata Laluan") and PR #357; message in `apps/api/src/common/errors/api-error.ts` (`PASSWORD_CHANGE_REQUIRED`) on `origin/be/integration-frontend` |
| Login accepts an e-mail or a username. | `apps/api/src/modules/auth/auth.service.ts:67` (login by e-mail or username; #225) |
| A Google-only account on `.cloud` has no password, so it cannot sign in until it resets. | `apps/api/src/migration/transform/secrets.ts:46-48` (empty or unusable is stored as null and flagged) |
| Google-only users use "Lupa kata laluan?" on the login page of the new system, then "Reset melalui No IC". They need an IC on record; otherwise they ask their teacher or school admin. There is no reset e-mail at go-live. | LEAD decision D20 (#113 comment 6406301354); `docs/ops/production-vps.md`, section 21 "Account recovery and support contact at go-live (AM-18)", decision AM-18 A (the page shows its own BM text, links to "Reset Melalui No IC" and tells users to ask their teacher or school admin; nothing sends mail) |
| Exact link labels on the v2 login page: "Lupa kata laluan?" and "Reset melalui No IC". | `src/modules/m01-authentication/pages/LoginPage.vue:130` ("Lupa kata laluan?") and `:138` ("Reset melalui No IC") on `origin/be/integration-frontend` |
| "Reset melalui No IC" needs an IC on record: it is refused unless the account is usable, `user.icHash !== null`, the IC normalises and the hash matches. | `apps/api/src/modules/account/password-reset.service.ts:178-192` (condition at `:189`); `resetByIc` then issues the token (`:194-197`) |
| Everyone signs in again, because sessions and tokens are not migrated. | `docs/architecture/v2-data-migration.md` section 2 (Not migrated) |
| Practice sessions, answers and activity history are migrated. | `docs/architecture/v2-data-migration.md` section 6.1 |
| v2 has no Google sign-in; `google_id` is not staged. | `apps/api/src/migration/load/index.ts:64`; `docs/requirements/v2-backend-urs.md` BE-MIG-10 |
| The docs' P10 text calls the old system `.cloud`, so the notice uses ".cloud". | the cutover plan, row P10 |

## Short version (WhatsApp/SMS)

447 GSM-7 septets with the placeholder (445 characters; `[` and `]` count double): 3 SMS segments (153 per segment, limit 459). Keep the real help channel short so it stays within 459.

```text
PrestasiPlus: .cloud jadi baca-sahaja kira-kira 01:00 pagi 29 Okt (masa muktamad menyusul) sehingga sistem baharu dibuka 30 Okt. Log masuk semula dengan e-mel/nama pengguna dan kata laluan yang sama; anda mungkin diminta menukar kata laluan. Dulu guna Google? Pilih "Lupa kata laluan?" > "Reset melalui No IC" (perlu No IC dalam rekod) atau tanya guru/pentadbir sekolah. Bantuan: [SALURAN BANTUAN - Q27, belum diputuskan]. - Pasukan PrestasiPlus
```

## Full version (e-mail / announcement)

Subject: Makluman: Sistem baharu PrestasiPlus dibuka 30 Oktober 2026

```text
Tuan/Puan,

Salam sejahtera. Terima kasih kerana menggunakan PrestasiPlus.

Kami ingin memaklumkan bahawa PrestasiPlus akan berpindah ke sistem baharu. Sila ambil perhatian tarikh berikut:

- 29 Oktober 2026, kira-kira 01:00 pagi (MYT): sistem lama (.cloud) hanya boleh dibaca (read-only). Masa muktamad akan dimaklumkan dalam peringatan sebelum itu. Dalam tempoh ini, sistem lama mungkin hanya boleh dibaca atau tidak boleh diakses buat sementara, dan latihan atau perubahan baharu tidak dapat dibuat.
- 30 Oktober 2026: sistem baharu dibuka.

Apa yang perlu dilakukan

1. Pengguna yang mempunyai kata laluan (guru, murid, ibu bapa dan pentadbir sekolah)
   - Gunakan e-mel atau nama pengguna dan kata laluan yang sama seperti sebelum ini.
   - Tuan/Puan mungkin diminta menukar kata laluan semasa log masuk kali pertama. Jika skrin "Sila tukar kata laluan anda sebelum meneruskan." dipaparkan, ikut langkah di skrin tersebut.

2. Pengguna yang log masuk dengan Google di sistem lama (akaun tanpa kata laluan)
   - Pada halaman log masuk sistem baharu, pilih "Lupa kata laluan?", kemudian pilih "Reset melalui No IC".
   - Reset melalui No IC meminta e-mel dan No IC anda, dan No IC itu mesti direkodkan dalam sistem. Jika tidak berjaya, sila minta bantuan guru atau pentadbir sekolah anda.
   - Selepas kata laluan ditetapkan, log masuk seperti biasa.

Data anda

Keputusan latihan dan sejarah aktiviti anda daripada sistem lama dipindahkan ke sistem baharu.

Bantuan

Jika Tuan/Puan menghadapi sebarang masalah, sila hubungi: [SALURAN BANTUAN - Q27, belum diputuskan]

Sekian, terima kasih.

Pasukan PrestasiPlus
```

## Do not say

- No absolute "Kata laluan anda TIDAK berubah" or "Anda TIDAK perlu menukar kata laluan" (D20, D34). "Set a new password" / "tukar kata laluan" is allowed only as "mungkin diminta" (users may be asked at first login).
- Do not tell Google-only users that a reset e-mail or link will be sent (AM-18 A: no reset e-mail at go-live). Use "Lupa kata laluan?" then "Reset melalui No IC", otherwise ask the teacher or school admin.
- No exact opening time on 30 Oct (the docs do not fix one).
- No real names, phone numbers, e-mails, addresses or URLs. Only `<domain>` is allowed as a placeholder.
- No mention of any Google sign-in on the new system (v2 has none).
- No promise about help channel, hours or response time until Q27 is decided.
- Do not list what is not migrated (for example revision queues) unless the LEAD approves.
