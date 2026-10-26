# L45 — Jemput Ibu Bapa — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — roles-matrix row L45 "Jemput Ibu Bapa" (feature slug `L45-jemput-ibu-bapa`) |
| Version | 0.3 |
| Date | 2026-10-02 |
| Status | **Draft for G1** |
| Author | product-analyst (agent) |
| Source discovery | [L45-jemput-ibu-bapa.md](../../discovery/L45-jemput-ibu-bapa.md) (PARTIAL; §8 update), screenshots `docs/discovery/img/L45/` (`jemput-ibu-bapa-403-desktop.png`, `jemput-ibu-bapa-403-mobile.png`, `terima-invalid-token-desktop.png`) |
| Secondary reference (NOT live truth) | `D:\Dev Projects\prestasiplus-reference`: `backend/resources/views/pelajar/jemput-ibu-bapa.blade.php`, `backend/resources/views/ibu-bapa/terima.blade.php`, `StudentExtrasController`, `routes/web.php` |
| Companion SRS | [srs/L45-jemput-ibu-bapa.md](../srs/L45-jemput-ibu-bapa.md) |
| Owners (D23b) | M02: student screen, invite tokens, parent↔student link (reuses DATA-M02-02). M01: acceptance page `/ibu-bapa/terima/{token}` and the parent login/register hand-off |

**Change log**

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-02 | First draft under user decision D23: observed items replicated exactly; items that need a murid account are PROPOSED from the reference rebuild and marked "Perlu pengesahan". |
| 0.2 | 2026-10-02 | **Audit round 1 fixes** (`docs/qa/audit/L45-audit.md`). AUD-L45-01: live shows "Link Tidak Sah" for a non-hex token (`zzzz`), so FN-L45-2.1.2 is withdrawn (ID kept), AC-L45-08.4 becomes OBSERVED and REF-S2-019 is superseded by live. AUD-L45-04: AC-08.1 and FN-2.1.1 are OBSERVED for admin, INFERRED for guest and parent. AUD-L45-07: §7 types clarified (DV-L45-01, -04, -05 deviate from the PROPOSED reference, not from live). Totals: 25 active Functions (17 + 8), 12 stories, 52 ACs. Coverage unchanged at 63/63 (REF-S2-019 maps to FN-2.1.1). |
| 0.3 | 2026-10-02 | **As-built (doc-only, L45-T2 code review).** New DV-L45-06 in §7 (S1 hero gradient and WhatsApp button darkened for contrast; D9 unreadable text). No Function, story or AC added or removed (25 / 12 / 52, coverage 63/63). |

**Conventions**
- Quoted copy is Bahasa Melayu, exact.
- **OBSERVED**: seen on live (admin session, GET only). **PROPOSED (reference rebuild) — Perlu pengesahan**: from the reference rebuild, never seen on live (D23a). **INFERRED**: assumption (Laravel default or app convention). **UNVERIFIED COPY**: message text not captured, placeholder used. **DV-L45-nn**: deviation (§7).
- Privacy: no real person's name appears. Demo accounts and fictitious schools only.
- Replicate, don't redesign (CLAUDE.md §6): no feature is added beyond what live or the reference shows.

---

## 1. Overview

A **Pelajar** (student) shares a personal invite link with their parents. A parent who opens the link and is logged in with an **Ibu Bapa** account is linked to that student, and the student then sees the parent in a "connected parents" list. The student can generate a new link at any time, which cancels the old one.

**Why (business goal):** let parents follow their child's progress without an admin having to link accounts by hand (today linking is admin-only, M02).

**Routes covered**

| # | Route | Screen / behaviour | Status on live |
|---|---|---|---|
| S1 | `/jemput-ibu-bapa` | Student invite screen | Route exists, guarded: guest → `/login`; admin → 403 (OBSERVED). Page content not observed |
| — | `POST /jemput-ibu-bapa/generate` | "Jana Link Baru" action | Exists (405 on GET, OBSERVED) |
| S2 | `/ibu-bapa/terima/{token}` | Invite acceptance landing | Exists, public; unknown token → "Link Tidak Sah" (OBSERVED). Valid-token page not observed |
| — | Shell nav item "Jemput Ibu Bapa" | Student menu entry | Already built; label and href supported, icon and colour unverified |

## 2. Actors

| Role | Involvement | Verified |
|---|---|---|
| Pelajar (student) | Owns the invite link; opens S1; shares, regenerates; sees linked parents | Route guard observed (admin 403); page content PROPOSED |
| Ibu Bapa (parent) | Opens S2 with the link; when logged in, is linked to the student | PROPOSED (reference); the invalid page is OBSERVED |
| Guest | Opens S2 from a message; is guided to log in or register as Ibu Bapa | PROPOSED |
| Admin, Guru, Penaja, Admin Sekolah, Pegawai PPD, Pegawai JPN | Not allowed on S1 (403 page). May open S2 but are never linked | Admin observed on S1 (403) and S2 (invalid); others INFERRED |
| M02 admin | Sees and edits the same links in the M02 user screens (unchanged) | M02 |

## 3. Functional breakdown (Epic → Feature → Function)

Source tags: O = OBSERVED, P = PROPOSED (reference) — Perlu pengesahan, I = INFERRED.

### EP-L45-1 — Student invite screen

**FT-L45-1.1 — Access**

| FN | Function | Roles | Source |
|---|---|---|---|
| FN-L45-1.1.1 | A guest opening `/jemput-ibu-bapa` is redirected to `/login` (no message) | Guest | O |
| FN-L45-1.1.2 | A logged-in non-student sees the global 403 page "Akses Ditolak" in place (exact copy in SRS FR-L45-02) | Admin (O), others | O / I |
| FN-L45-1.1.3 | Tab title "Jemput Ibu Bapa - PRESTASIPLUS" | Pelajar | P |

**FT-L45-1.2 — Header and hero**

| FN | Function | Source |
|---|---|---|
| FN-L45-1.2.1 | Shell header "Jemput Ibu Bapa" / "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda" | P |
| FN-L45-1.2.2 | Hero card: icon tile, "Jemput Ibu Bapa 👨‍👩‍👧", "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda" | P |

**FT-L45-1.3 — Invite link**

| FN | Function | Source |
|---|---|---|
| FN-L45-1.3.1 | Card "Link Jemputan" with the intro "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej." | P |
| FN-L45-1.3.2 | Read-only field holding the invite URL | P |
| FN-L45-1.3.3 | "Salin" copies the URL and shows "Disalin!" for 2 seconds | P |
| FN-L45-1.3.4 | "Hantar via WhatsApp" link with the prepared message (no external screen in the prototype, D14) | P |
| FN-L45-1.3.5 | "Jana Link Baru" replaces the token (the live `POST /jemput-ibu-bapa/generate` exists) | O (route) / P (behaviour) |
| FN-L45-1.3.6 | Success flash "Link jemputan baru telah dijana!" | P |
| FN-L45-1.3.7 | Token lifecycle: one current token per student, created at first view, replaced only by regeneration | P |

**FT-L45-1.4 — Connected parents**

| FN | Function | Source |
|---|---|---|
| FN-L45-1.4.1 | Card heading "Ibu Bapa Dihubungkan" | P |
| FN-L45-1.4.2 | One row per linked parent: icon tile, name, email (no relationship chip, DV-L45-02); same links an M02 admin sees | P |
| FN-L45-1.4.3 | Empty state "Belum ada ibu bapa dihubungkan" / "Hantar link jemputan di atas" | P |
| FN-L45-1.4.4 | Loading and load-error states | I |

**FT-L45-1.5 — Menu entry**

| FN | Function | Source |
|---|---|---|
| FN-L45-1.5.1 | Student-only menu item "Jemput Ibu Bapa" → `/jemput-ibu-bapa` in the user shell (already built) | O (label, href) / I (icon, colour) |

### EP-L45-2 — Invite acceptance

**FT-L45-2.1 — Acceptance page states**

| FN | Function | Source |
|---|---|---|
| FN-L45-2.1.1 | Unknown, replaced or inactive-student token → standalone "Link Tidak Sah" page (exact copy in SRS FR-L45-19) | O (admin) / I (guest, parent) |
| FN-L45-2.1.2 | **Withdrawn (v0.2, AUD-L45-01).** Live shows "Link Tidak Sah" for any token, non-hex included; covered by FN-L45-2.1.1 | — |
| FN-L45-2.1.3 | Valid token → identity card: initials tile, eyebrow, H1 with the student's name, school line | P |
| FN-L45-2.1.4 | Guest state: log-in CTA "Log Masuk Sebagai Ibu Bapa" and register note | P (note: DV-L45-01) |
| FN-L45-2.1.5 | Logged-in non-parent state: switch-account message and "Log Keluar & Log Masuk Sebagai Ibu Bapa" | P |
| FN-L45-2.1.6 | Logged-in parent: linked state with success box and "Lihat Profil Kemajuan" | P |

**FT-L45-2.2 — Linking and hand-off**

| FN | Function | Source |
|---|---|---|
| FN-L45-2.2.1 | Idempotent link creation for a logged-in parent (one row per parent+student pair) | P |
| FN-L45-2.2.2 | Login/register hand-off: parent logs in or registers, lands on the normal landing page, then reopens the link | P (consistent with OBSERVED M01 BR-08) |
| FN-L45-2.2.3 | Page chrome: back link "PRESTASIPLUS", tab title, caption "Pautan jemputan ini dikongsi oleh {nama pelajar} melalui PRESTASIPLUS." | P |

Totals: 2 epics, 7 features, 25 active functions (17 + 8; FN-2.1.2 withdrawn).

## 4. User stories

| ID | Feature | Priority | Story | Functions |
|---|---|---|---|---|
| US-L45-01 | FT-1.2, 1.3 | Must | As a Pelajar, I want to open a page that shows my personal invite link, so that I can invite my parents. | 1.1.3, 1.2.1, 1.2.2, 1.3.1, 1.3.2, 1.3.7 |
| US-L45-02 | FT-1.3 | Must | As a Pelajar, I want to copy the link with one tap, so that I can paste it in any app. | 1.3.3 |
| US-L45-03 | FT-1.3 | Should | As a Pelajar, I want a ready WhatsApp message with the link, so that I can send it quickly. | 1.3.4 |
| US-L45-04 | FT-1.3 | Must | As a Pelajar, I want to generate a new link, so that an old or leaked link stops working. | 1.3.5, 1.3.6, 1.3.7 |
| US-L45-05 | FT-1.4 | Must | As a Pelajar, I want to see which parents are connected to me, so that I know the invite worked. | 1.4.1, 1.4.2, 1.4.3, 1.4.4 |
| US-L45-06 | FT-1.1 | Must | As the platform owner, I want only students to open this page, so that invite links belong to students. | 1.1.1, 1.1.2 |
| US-L45-07 | FT-1.5 | Must | As a Pelajar, I want a menu item for this page, so that I can find it. | 1.5.1 |
| US-L45-08 | FT-2.1 | Must | As a parent who opens an old or wrong link, I want a clear "link not valid" page, so that I know to ask my child for a new one. | 2.1.1 |
| US-L45-09 | FT-2.1, 2.2 | Must | As a parent without a session, I want to see who invited me and how to log in or register, so that I can finish connecting. | 2.1.3, 2.1.4, 2.2.2, 2.2.3 |
| US-L45-10 | FT-2.1, 2.2 | Must | As a logged-in parent, I want opening the link to connect me to my child, so that I can follow their progress. | 2.1.3, 2.1.6, 2.2.1, 2.2.2 |
| US-L45-11 | FT-2.1 | Should | As someone logged in with a non-parent account who opens the link, I want to be told to switch account, so that I do not link the wrong account. | 2.1.5 |
| US-L45-12 | cross-cutting | Must | As a user on a phone, tablet or desktop, I want both screens to fit and work with touch, so that I can use them on any device. | all screen FNs |

### Acceptance criteria

**US-L45-01 — See the invite link**
- **AC-L45-01.1** (PROPOSED) Given I am logged in as a Pelajar, when I open `/jemput-ibu-bapa`, then I see the header "Jemput Ibu Bapa" / "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda", the hero "Jemput Ibu Bapa 👨‍👩‍👧", the card "Link Jemputan" with "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej.", a read-only field and the buttons "Salin", "Hantar via WhatsApp" and "Jana Link Baru".
- **AC-L45-01.2** (PROPOSED) Given the page is open, when I read the field, then it holds `{app origin}/ibu-bapa/terima/` followed by 64 hexadecimal characters.
- **AC-L45-01.3** (PROPOSED) Given I opened the page once, when I reload it or log out and in again, then the link is the same, until I generate a new one.
- **AC-L45-01.4** (PROPOSED) Given two different students, when each opens the page, then their links differ.

**US-L45-02 — Copy**
- **AC-L45-02.1** (PROPOSED) Given the page, when I press "Salin", then the full URL is on the clipboard and the button reads "Disalin!" with a check icon and an emerald background.
- **AC-L45-02.2** (PROPOSED) Given the button reads "Disalin!", when 2 seconds pass, then it reads "Salin" again with the indigo background.
- **AC-L45-02.3** (INFERRED) Given the clipboard is unavailable or refused, when I press "Salin", then the field text stays selected, the label stays "Salin" and no error appears.

**US-L45-03 — WhatsApp**
- **AC-L45-03.1** (PROPOSED) Given the page, when I inspect "Hantar via WhatsApp", then it links to `https://wa.me/?text=` followed by the URL-encoded text "Salam ibu/bapa! Klik link ini untuk pantau perkembangan saya di PRESTASIPLUS: " and the invite URL.
- **AC-L45-03.2** (PROPOSED) Given the prototype build, when I press "Hantar via WhatsApp", then no external page or new tab opens (D14) and no message appears.
- **AC-L45-03.3** (PROPOSED) Given I generated a new link, when I inspect the WhatsApp link, then it contains the new URL.

**US-L45-04 — Generate a new link**
- **AC-L45-04.1** (PROPOSED) Given the page, when I press "Jana Link Baru", then the field shows a different link, I stay on `/jemput-ibu-bapa`, and a success message "Link jemputan baru telah dijana!" appears.
- **AC-L45-04.2** (PROPOSED; copy of the invalid page OBSERVED) Given I generated a new link, when anyone opens the old link, then they see the "Link Tidak Sah" page; the new link shows the valid invite.
- **AC-L45-04.3** (PROPOSED) Given parents are already connected, when I generate a new link, then the connected parents list does not change.
- **AC-L45-04.4** (INFERRED) Given the request is running, when I look at "Jana Link Baru", then it is disabled until the request ends.
- **AC-L45-04.5** (INFERRED; UNVERIFIED COPY) Given the request fails, when it ends, then the old link stays and a red alert "Ralat berlaku. Sila cuba lagi." appears.

**US-L45-05 — Connected parents**
- **AC-L45-05.1** (PROPOSED) Given I have connected parents, when I open the page, then the card "Ibu Bapa Dihubungkan" lists one row per parent with an icon tile, the parent's name and email (for the demo student `pelajar@demo.test`: "Ibu Bapa Demo" and `ibubapa@demo.test`).
- **AC-L45-05.2** (PROPOSED) Given I have no connected parent (demo student `pelajar2@demo.test`), when I open the page, then the card shows "👨‍👩‍👧", "Belum ada ibu bapa dihubungkan" and "Hantar link jemputan di atas".
- **AC-L45-05.3** (PROPOSED) Given several parents, when the list shows, then they are ordered by name A to Z, and long names or emails are cut with an ellipsis without widening the page.
- **AC-L45-05.4** (PROPOSED) Given a parent accepted my link, or an admin added or removed a link in M02, when I reload the page, then the list shows the change.
- **AC-L45-05.5** (PROPOSED) Given the list, when I look at a row, then there is no relationship tag and no remove button (DV-L45-02, BR-L45-09).
- **AC-L45-05.6** (INFERRED) Given the data is loading or fails to load, when I look at the page, then I see the M01 spinner, or the M01 load-error alert with "Cuba lagi".

**US-L45-06 — Access**
- **AC-L45-06.1** (OBSERVED) Given I am a guest, when I open `/jemput-ibu-bapa`, then I am sent to `/login` with no message.
- **AC-L45-06.2** (OBSERVED for admin) Given I am logged in as admin, when I open `/jemput-ibu-bapa`, then I see the standalone 403 page: "403", "🚫", "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", the links "Halaman Utama" → `/` and "Log Masuk" → `/login`, and the footer "PRESTASIPLUS"; the tab title is "403 - Akses Ditolak | PRESTASIPLUS" and the address stays `/jemput-ibu-bapa`.
- **AC-L45-06.3** (INFERRED) Given I am logged in as Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD or Pegawai JPN, when I open `/jemput-ibu-bapa`, then I see the same 403 page.
- **AC-L45-06.4** (INFERRED) Given I am not a Pelajar, when a request to generate a link is made with my session, then it is refused (403), and with no session it is refused (401).

**US-L45-07 — Menu**
- **AC-L45-07.1** (OBSERVED label and href; INFERRED icon) Given I am a Pelajar, when I open the sidebar (≥1024px) or the drawer (<1024px), then I see "Jemput Ibu Bapa" and it opens `/jemput-ibu-bapa`; other roles do not see it.
- **AC-L45-07.2** (PROPOSED) Given I am on `/jemput-ibu-bapa`, when I look at the menu, then the item is shown as the current page, as the other shell items are.

**US-L45-08 — Invalid link**
- **AC-L45-08.1** (OBSERVED for admin; guest and parent INFERRED, same page expected) Given any visitor, when they open `/ibu-bapa/terima/0000`, then they see the standalone page: icon `link-slash`, H1 "Link Tidak Sah", "Link jemputan ini tidak sah atau telah tamat tempoh.", a yellow info box "Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu.", the button "Log Masuk" and the button "Laman Utama", and the footer "PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia".
- **AC-L45-08.2** (PROPOSED) Given a link was replaced by "Jana Link Baru", when someone opens it, then they see the same page.
- **AC-L45-08.3** (PROPOSED) Given the student was deactivated by an admin (M02), when someone opens the student's link, then they see the same page.
- **AC-L45-08.4** (OBSERVED for admin) Given any other invalid token, including one with non-hex characters (for example `zzzz`) or 64 zeros, when someone opens it, then they see the same "Link Tidak Sah" page as for `0000`; there is no separate 404 page.
- **AC-L45-08.5** (OBSERVED) Given the invalid page, when I press "Log Masuk", then I go to `/login`; "Laman Utama" and the footer link go to `/`.
- **AC-L45-08.6** (OBSERVED) Given the invalid page, when it opens, then the tab title is "Link Tidak Sah — PRESTASIPLUS" (with an em dash).

**US-L45-09 — Guest opens a valid link**
- **AC-L45-09.1** (PROPOSED) Given a valid link and no session, when I open it, then I see a round initials tile, "Jemputan Ibu Bapa", "Anda dijemput untuk memantau kemajuan {nama pelajar}" and, if the student has a school, the school name.
- **AC-L45-09.2** (PROPOSED) Given the guest state, when I read the card, then I see "Untuk memantau kemajuan pembelajaran anak anda di PRESTASIPLUS, sila log masuk menggunakan akaun Ibu Bapa anda. Selepas log masuk, buka semula pautan jemputan ini untuk mengesahkan hubungan." and a button "Log Masuk Sebagai Ibu Bapa" that opens `/login`.
- **AC-L45-09.3** (PROPOSED, DV-L45-01) Given the guest state, when I read the note, then it says "Belum mempunyai akaun Ibu Bapa? Daftar akaun Ibu Bapa terlebih dahulu, kemudian buka semula pautan jemputan ini." and "Daftar akaun Ibu Bapa" opens `/register`.
- **AC-L45-09.4** (PROPOSED) Given I am a guest, when I open the link, then no connection is created and the student's list does not change.
- **AC-L45-09.5** (PROPOSED; M01 BR-08 OBSERVED) Given I log in as a parent from this page, when login succeeds, then I land on the normal landing page, not on the invite; when I open the link again, then I see the linked state (US-L45-10).
- **AC-L45-09.6** (PROPOSED) Given a valid link, when the page shows, then below the card it reads "Pautan jemputan ini dikongsi oleh {nama pelajar} melalui PRESTASIPLUS."
- **AC-L45-09.7** (PROPOSED) Given a valid link, when it opens, then the tab title is "Jemputan Ibu Bapa — PRESTASIPLUS".

**US-L45-10 — Parent connects**
- **AC-L45-10.1** (PROPOSED) Given I am logged in as Ibu Bapa, when I open a valid link, then I see "Berjaya Berhubung", "Anda kini berhubung dengan {nama pelajar}", a green box "Akaun anda ({nama saya}) telah dihubungkan dengan pelajar ini. Anda kini boleh memantau kemajuan mereka." and the button "Lihat Profil Kemajuan" that opens the student's public profile `/pelajar/{id}`.
- **AC-L45-10.2** (PROPOSED) Given I was connected, when the student opens `/jemput-ibu-bapa`, then I am in their list; and when an admin opens my record in M02, then the student appears as a linked child.
- **AC-L45-10.3** (PROPOSED) Given I am already connected, when I reload or open the link again, then I still see the linked state and no second connection exists.
- **AC-L45-10.4** (PROPOSED) Given I am connected to one student, when I open another student's link, then I am connected to both.
- **AC-L45-10.5** (INFERRED; UNVERIFIED COPY) Given connecting fails, when the request ends, then no connection is made and a red alert "Ralat berlaku. Sila cuba lagi." appears.

**US-L45-11 — Non-parent logged in**
- **AC-L45-11.1** (PROPOSED) Given I am logged in with a non-parent account (including the student who owns the link), when I open a valid link, then I see "Anda kini log masuk sebagai akaun yang bukan Ibu Bapa. Untuk berhubung dengan pelajar ini, sila log keluar dan log masuk semula menggunakan akaun Ibu Bapa anda." and the button "Log Keluar & Log Masuk Sebagai Ibu Bapa"; no connection is made.
- **AC-L45-11.2** (PROPOSED) Given that button, when I press it, then my session ends with no confirmation and I land on `/login`.

**US-L45-12 — Responsive**
- **AC-L45-12.1** At 320, 375, 768 and 1280 px, `/jemput-ibu-bapa` and `/ibu-bapa/terima/{token}` (every state) have no horizontal page scroll.
- **AC-L45-12.2** Every button and link on both screens has a tap target of at least 44px.
- **AC-L45-12.3** A long invite URL scrolls inside its field and never widens the page; long names and emails are cut with an ellipsis.
- **AC-L45-12.4** No content text renders below 12px.
- **AC-L45-12.5** Below 640px "Hantar via WhatsApp" and "Jana Link Baru" stack, each full width; from 640px they sit side by side (SRS §10).

Totals: 12 stories, 52 acceptance criteria.

## 5. UI expectations

Layout and look follow the screenshots for observed pages and the reference structure for proposed ones; the designer decides the detail (G2).

| Screen | Key content and states | Screenshot |
|---|---|---|
| S1 `/jemput-ibu-bapa` | User shell. Hero (rose→pink); card "Link Jemputan"; card "Ibu Bapa Dihubungkan". States: loading, error, no parents, with parents, copied, regenerating, regenerated, regenerate error | none (PROPOSED) |
| 403 (S1, non-student) | Existing global standalone page | `jemput-ibu-bapa-403-desktop.png`, `jemput-ibu-bapa-403-mobile.png` |
| S2 invalid | Standalone: light-pink page, white card with a slate-gradient header, yellow info box, pink-red "Log Masuk" button, outlined "Laman Utama" button, footer line | `terima-invalid-token-desktop.png` (1280 only; 375 behaviour in SRS §10) |
| S2 valid (guest / non-parent / linked) | Standalone: light blue→indigo page, white card with a purple-gradient header (initials tile, eyebrow, H1, school), body per state, caption below | none (PROPOSED) |

## 6. Coverage matrix (completeness proof)

Elements come from the discovery doc (observed, 19) and the reference rebuild (44). Nothing is unmapped.

| Set | Elements | Mapped to a Function | Of which superseded or dropped (reason) | Unmapped |
|---|---|---|---|---|
| OBSERVED (403 page, invalid page, route behaviours) | 19 | 19 | 0 | 0 |
| Reference S1 (blade + controller) + menu | 23 | 22 | 1 dropped (relationship chip, DV-L45-02) | 0 |
| Reference S2 (blade + controller) | 21 | 21 | 5 superseded by OBSERVED live copy (REF-S2-002…006, covered by FN-2.1.1) | 0 |
| **Total** | **63** | **62 + 1 dropped with reason** | | **0** |

### 6.1 OBSERVED elements

| Element | Content | Covered by |
|---|---|---|
| OBS-403-001 | "403" | FN-L45-1.1.2 |
| OBS-403-002 | "🚫" | FN-L45-1.1.2 |
| OBS-403-003 | H1 "Akses Ditolak" | FN-L45-1.1.2 |
| OBS-403-004 | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir." | FN-L45-1.1.2 |
| OBS-403-005 | Link "Halaman Utama" → `/` | FN-L45-1.1.2 |
| OBS-403-006 | Link "Log Masuk" → `/login` | FN-L45-1.1.2 |
| OBS-403-007 | Footer "PRESTASIPLUS" | FN-L45-1.1.2 |
| OBS-INV-001 | Icon `fa-link-slash text-slate-300` | FN-L45-2.1.1 |
| OBS-INV-002 | Title "Link Tidak Sah" | FN-L45-2.1.1 |
| OBS-INV-003 | Subtitle "Link jemputan ini tidak sah atau telah tamat tempoh." | FN-L45-2.1.1 |
| OBS-INV-004 | Info icon `fa-info-circle` | FN-L45-2.1.1 |
| OBS-INV-005 | "Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu." | FN-L45-2.1.1 |
| OBS-INV-006 | Button "Log Masuk" (`fa-sign-in-alt`) → `/login` | FN-L45-2.1.1 |
| OBS-INV-007 | Button "Laman Utama" (`fa-home`) → `/` | FN-L45-2.1.1 |
| OBS-INV-008 | Footer icon `fa-graduation-cap` | FN-L45-2.1.1 |
| OBS-INV-009 | Footer text link "PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia" → `/` | FN-L45-2.1.1 |
| OBS-BEH-001 | Guest on `/jemput-ibu-bapa` → `/login` | FN-L45-1.1.1 |
| OBS-BEH-002 | `POST /jemput-ibu-bapa/generate` exists (405 on GET) | FN-L45-1.3.5 |
| OBS-BEH-003 | `/ibu-bapa/terima/{token}` exists, public, renders for admin (404 status with the custom page) | FN-L45-2.1.1 |

### 6.2 Reference elements

| Element | Reference content | Disposition | Covered by |
|---|---|---|---|
| REF-S1-001 | Status flash "Link jemputan baru telah dijana!" | Adopted (PROPOSED) | FN-L45-1.3.6 |
| REF-S1-002 | Layout title and heading "Jemput Ibu Bapa" / subheading | Adopted | FN-L45-1.2.1, 1.1.3 |
| REF-S1-003 | Hero icon tile (`fa-user-friends`) | Adopted (icon tile) | FN-L45-1.2.2 |
| REF-S1-004 | Hero H1 "Jemput Ibu Bapa 👨‍👩‍👧" | Adopted | FN-L45-1.2.2 |
| REF-S1-005 | Hero text "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda" | Adopted | FN-L45-1.2.2 |
| REF-S1-006 | Card H2 "Link Jemputan" (link icon) | Adopted | FN-L45-1.3.1 |
| REF-S1-007 | Intro "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej." | Adopted | FN-L45-1.3.1 |
| REF-S1-008 | Read-only input (`#inviteLink`) | Adopted | FN-L45-1.3.2 |
| REF-S1-009 | Button "Salin" | Adopted (clipboard failure handling added, DV-L45-04) | FN-L45-1.3.3 |
| REF-S1-010 | Copied state "Disalin!" for 2 s | Adopted | FN-L45-1.3.3 |
| REF-S1-011 | "Hantar via WhatsApp" with the `wa.me` text | Adopted (no navigation in the prototype, DV-L45-03) | FN-L45-1.3.4 |
| REF-S1-012 | "Jana Link Baru" form POST | Adopted | FN-L45-1.3.5 |
| REF-S1-013 | Card H2 "Ibu Bapa Dihubungkan" | Adopted | FN-L45-1.4.1 |
| REF-S1-014 | Row avatar tile (user icon) | Adopted | FN-L45-1.4.2 |
| REF-S1-015 | Row parent name | Adopted | FN-L45-1.4.2 |
| REF-S1-016 | Row parent email | Adopted | FN-L45-1.4.2 |
| REF-S1-017 | Relationship chip | **Dropped** (DV-L45-02) | — |
| REF-S1-018 | Empty emoji "👨‍👩‍👧" | Adopted | FN-L45-1.4.3 |
| REF-S1-019 | "Belum ada ibu bapa dihubungkan" | Adopted | FN-L45-1.4.3 |
| REF-S1-020 | "Hantar link jemputan di atas" | Adopted | FN-L45-1.4.3 |
| REF-S1-021 | Token generated lazily at first view (`inviteToken()`) | Adopted | FN-L45-1.3.7 |
| REF-S1-022 | "Jana Link Baru" rotates the token; old link stops working | Adopted | FN-L45-1.3.7 |
| REF-NAV-001 | Menu item "Jemput Ibu Bapa" (`fa-user-friends`, `text-rose-500`) | Item adopted; the built icon and colour stay (unverified either way) | FN-L45-1.5.1 |
| REF-S2-001 | Back link "PRESTASIPLUS" → `/` | Adopted | FN-L45-2.2.3 |
| REF-S2-002 | Invalid: icon `fa-link-slash` | Superseded by OBS-INV-001 | FN-L45-2.1.1 |
| REF-S2-003 | Invalid H1 "Pautan jemputan tidak sah atau telah tamat" | Superseded by OBS-INV-002/003 | FN-L45-2.1.1 |
| REF-S2-004 | Invalid text "Pautan jemputan ini tidak lagi berfungsi…" | Superseded by OBS-INV-005 | FN-L45-2.1.1 |
| REF-S2-005 | Invalid text "Sila minta anak anda menghantar pautan jemputan terkini…" | Superseded by OBS-INV-005 | FN-L45-2.1.1 |
| REF-S2-006 | Invalid button "Log Masuk" only | Superseded by OBS-INV-006/007 | FN-L45-2.1.1 |
| REF-S2-007 | Initials tile | Adopted (CSS text, no image) | FN-L45-2.1.3 |
| REF-S2-008 | Linked eyebrow "Berjaya Berhubung" + H1 "Anda kini berhubung dengan {nama}" | Adopted | FN-L45-2.1.6 |
| REF-S2-009 | Invited eyebrow "Jemputan Ibu Bapa" + H1 "Anda dijemput untuk memantau kemajuan {nama}" | Adopted | FN-L45-2.1.3 |
| REF-S2-010 | School line | Adopted | FN-L45-2.1.3 |
| REF-S2-011 | Success box "Akaun anda ({nama}) telah dihubungkan dengan pelajar ini. Anda kini boleh memantau kemajuan mereka." | Adopted | FN-L45-2.1.6 |
| REF-S2-012 | Button "Lihat Profil Kemajuan" → `/pelajar/{id}` | Adopted | FN-L45-2.1.6 |
| REF-S2-013 | Non-parent text "Anda kini log masuk sebagai akaun yang bukan Ibu Bapa…" | Adopted | FN-L45-2.1.5 |
| REF-S2-014 | Button "Log Keluar & Log Masuk Sebagai Ibu Bapa" (POST /logout) | Adopted (M01 logout) | FN-L45-2.1.5 |
| REF-S2-015 | Guest text "Untuk memantau kemajuan pembelajaran anak anda…" | Adopted | FN-L45-2.1.4 |
| REF-S2-016 | Button "Log Masuk Sebagai Ibu Bapa" → `/login` | Adopted | FN-L45-2.1.4 |
| REF-S2-017 | Amber note "…Akaun Ibu Bapa disediakan oleh pihak sekolah…" | Adopted with changed text (DV-L45-01) | FN-L45-2.1.4 |
| REF-S2-018 | Caption "Pautan jemputan ini dikongsi oleh {nama} melalui PRESTASIPLUS." | Adopted | FN-L45-2.2.3 |
| REF-S2-019 | Token check (hex only; active student) | Active-student check adopted; the hex-only route rule is superseded by live (non-hex also shows "Link Tidak Sah") | FN-L45-2.1.1 |
| REF-S2-020 | `firstOrCreate` link (idempotent) | Adopted | FN-L45-2.2.1 |
| REF-S2-021 | Tab title "Jemputan Ibu Bapa — PRESTASIPLUS" | Adopted | FN-L45-2.2.3 |

## 7. Fidelity deviations

Only intended differences from live or the reference (user rule D9). All are applied directly, not asked per item.

| ID | Type | Source behaviour | Rebuild behaviour | Reason | Status |
|---|---|---|---|---|---|
| DV-L45-01 | Contradictory rule (reference note vs the live register form; deviates from the PROPOSED reference, not from live, whose guest page is unobserved) | Reference guest note: "Belum mempunyai akaun Ibu Bapa? Akaun Ibu Bapa disediakan oleh pihak sekolah. Sila hubungi pihak sekolah anak anda untuk mendapatkan akaun." The live register offers "Ibu Bapa" ("Pantau anak saya", M01). | The note reads "Belum mempunyai akaun Ibu Bapa? Daftar akaun Ibu Bapa terlebih dahulu, kemudian buka semula pautan jemputan ini." with "Daftar akaun Ibu Bapa" → `/register`. | The reference note contradicts the live register form. | Applied (D9); copy PROPOSED — Perlu pengesahan |
| DV-L45-02 | Unusable / out of scope | Reference shows a relationship chip, filled from `parent_student.relationship`, whose only written value is the code `ibu_bapa` (it would show as a raw code). | No chip; `ParentStudentLink` gets no new field. | A raw code is unreadable; adding a field to the shared M02 link store is new scope (D12). | Applied (D9) |
| DV-L45-03 | External hand-off | The WhatsApp link opens `wa.me` in a new tab. | The `href` is kept; the click does not navigate in the prototype build. | D14: no external platform screens. | Applied (user decision D14) |
| DV-L45-04 | Unusable control (reference behaviour; live unobserved) | Reference "Salin" shows "Disalin!" even if the clipboard write fails. | The label changes only after a successful write; on failure the text stays selected. | A false success message (broken). | Applied (D9/D23); INFERRED. Deviates from the PROPOSED reference, not from live (live behaviour unobserved) |
| DV-L45-05 | Technical, no visible change (reference behaviour; live unobserved) | Reference acceptance links inside the page GET. | The prototype loads a preview (GET) and links with a separate POST. | A GET must not change data (SRS SEC-L45-04). | Applied (D23); invisible to users. Deviates from the PROPOSED reference, not from live (live behaviour unobserved) |
| DV-L45-06 | Unreadable text (low contrast; reference behaviour; live unobserved) | Reference S1 hero gradient rose-500 to pink-500 with white text, and the "Hantar via WhatsApp" button emerald-500 with white text. | Hero gradient rose-600 to pink-600; WhatsApp button emerald-600. Layout and copy unchanged. | White text on the 500 shades has low contrast (unreadable text, D9). | Applied (D9/D23, Delivery Lead). Deviates from the PROPOSED reference, not from live (live unobserved) |
| DV-L45-07 | v2 contract scope (http mode only; minimal disclosure D57f) | The invitation page names the pupil in full (`{nama pelajar}`, AC-09.1, AC-09.6, AC-10.1, FN-2.1.3, FN-2.2.3) with two initials in the avatar. | Over http the public preview `GET /api/parent-invites/:token` returns the pupil's **first name** and school only, so the heading, caption and avatar show the first name and one initial (SW4-05). Mock mode keeps the full name and two initials. The success heading after acceptance is unchanged (the accept answer carries the full name). | The v2 contract discloses only the first name to an unauthenticated viewer (D57f); the valid-token page is not observed on live. | Applied (D57f, fix SW4-05, 2026-10-23) |
| DV-L45-09 | Accessibility exception (WCAG 2.5.8 inline; D9/D10) | Every L45 button and link tap target is at least 44px (SRS FR-L45-32, §10, E2E-L45-24). The live size of the "Daftar akaun Ibu Bapa" link is unrecorded (Perlu pengesahan). | The S2 guest-note link "Daftar akaun Ibu Bapa" (`invite-register-link`, `ParentInviteAcceptPage.vue:207`) is an inline text link inside the sentence "Belum mempunyai akaun Ibu Bapa? … terlebih dahulu, kemudian buka semula pautan jemputan ini." and keeps its text height (about 20px at 375px). It is the only exception: every other L45 button and link stays at least 44px, and the E2E-L45-24 sweep excludes only this link (#384, `l45-terima-jemputan.spec.ts`). | WCAG 2.5.8 (Target Size, Minimum) exempts targets inside a sentence; the link works on touch, so it is not unusable (D9); accessibility replicates live with no enhancements (D10). Every padding or block fix either missed 44px or reflowed the working sentence (M01 R11, LEAD decision "Not a bug", #385 closing comment 6416065901). | Approved (LEAD decision, M01 R11) |

Note (AUD-L45-07): DV-L45-01, -04, -05 and -06 deviate from the PROPOSED reference, not from observed live behaviour, and are applied under D23 (the new copy of DV-L45-01 stays "Perlu pengesahan"). DV-L45-02 and -03 rest on D12 and D14.

Explicitly **not** deviations: the OBSERVED copy of the invalid page (replicated, even though it differs from the reference), the em dash in the S2 tab titles, the mixed "link"/"pautan" wording (OQ-05), the global 403 copy (already identical to the observed copy).

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Admin linking of parents and children ("Pautkan Anak") | M02, unchanged |
| Parent dashboard and parent views (`/ibu-bapa/dashboard`, `/dashboard` for Ibu Bapa) | Not specified; the only link target is `/pelajar/{id}` (M08) |
| Student approving, removing or being notified of a parent link | Not in the reference or live; new scope (OQ-09) |
| Real WhatsApp or email delivery, QR codes, share sheet | D14, D22 |
| Login and register screens | M01, unchanged |
| The menu item icon and colour verification | Needs a murid account |
| Real backend (hashing, rate limits, CSRF) | Backend phase; SRS §14 |

## 9. Open questions

None blocks the next phase. See SRS §15 (OQ-01 … OQ-10). Summary:
1. Page content never seen live (D16): PROPOSED, verify later.
2. No time expiry assumed.
3. "Pelajar account 2" read as `pelajar2@demo.test` (id 3) for the empty state, so no seed changes.
4. Register hand-off note replaces the "school provides accounts" note (DV-L45-01).
5. "link" vs "pautan" wording kept as sourced.
6. No automatic resume of the link after login.
7. No feedback on the WhatsApp press in the prototype.
8. Parent progress views are out of scope.
9. Student consent, removal and notification are backend-phase decisions.
10. Menu icon and colour, and S1 for non-admin roles, are INFERRED.
