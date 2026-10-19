# M13 — Cikgu Alesa (AI Teacher Assistant) — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M13 Cikgu Alesa (AI Teacher Assistant) |
| Version | 1.1 |
| Date | 2026-09-26 |
| Status | **Approved (G1) — v1.1**, 2026-09-26 (M13 audit round 2 PASS, `docs/qa/audit/M13-audit.md`). All AI output is simulated with canned responses (D4), and so are voice input and voice output; every output-dependent state (discovery AI-1…AI-10) is provisional. |
| Author | product-analyst (agent) for §1–§5, §8–§10, §12–§13; solution-architect (agent) for §6 data entities, seeds and dataset spec, §7 mock API, §11 |
| Source URS | [urs/M13-cikgu-alesa.md](../urs/M13-cikgu-alesa.md) v1.0 (FN-M13-n.n.n, 21 stories, AC-M13-nn.m) |
| Source discovery | [M13-cikgu-alesa.md](../../discovery/M13-cikgu-alesa.md), inventory `docs/discovery/inventory/M13/`, screenshots `docs/discovery/img/M13/` |
| Related | [M01](M01-authentication.md) (User, guest redirect, 404 page, canonical accounts 1–11), [M03](M03-curriculum.md) (subjects 1–31, `GET /api/subjects`), [M05](M05-practice.md) (QuizAnswer store — score source; mock clock), [M08](M08-student-performance.md) v1.4 (students 3001–3008 and their designed Kimia/Sejarah answers), [M10](M10-teacher-class.md) v1.2 (classes 2001/2002 of teacher 5, `GET /api/guru/classes` #12, DV-M10-01, DV-M10-26), M25 (DV-M13-07), [design/shells.md](../../design/shells.md) (DV-SH-03, DV-SH-04), [architecture/overview.md](../../architecture/overview.md) (mock transport, test hooks) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.1 | 2026-09-26 | **Revision history — v1.1, audit round 1** (FAIL 0/3/10; Delivery Lead decisions). AUD-01: simulated recogniser and simulated speaker (FR-30–33, BR-20, NFR-01, §6.9, E2E-27–30; no Web Speech API, D4). AUD-02: hand-off URL via `URLSearchParams` (FR-54, FR-21, E2E-23). AUD-03: BR-13 kept; the new RPH is second (E2E-36, E2E-38). AUD-04 menu labels + badge (FR-01); AUD-05 `onclick` (FR-61, E2E-48); AUD-06 voice error/end sequence and auto-submit bypass (FR-32, SEC-02); AUD-07 spoken scope (FR-30); AUD-08 scroll SOURCE-DERIVED (FR-15, E2E-12); AUD-09 E2E-08 provisional, E2E-45 split into 45 (observed) + 52 (provisional); AUD-10 M05 hook request XR-M13-03b (E2E-47); AUD-11 M10 v1.2, XR-02 confirm only; AUD-12 raw-body transport for #1 (§7, XR-05, SQ-01); AUD-13 drawer replicates the live capture (FR-01). Counts: 70 FRs, 52 E2E (19 provisional). |
| 1.0 | 2026-09-25 | First issue. 70 FRs, 23 BRs, 5 owned entities + 1 constants set, 10 mock endpoints (+ 2 referenced), 51 E2E (17 provisional), 9 SEC items. Traceability checked by script (§3.1). |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M13-01 (essay hand-off read by S1), 02 (voice auto-speak wired), 03 (S1 row at 375), 04 (tables scroll in their cards), 05 (mic title), 08 (header titles), 10 (405 → 404); DV-M13-07 (dead link) is applied by M25. Privacy: DV-M13-12 (fictitious "Powered by" names). Rejected — replicate live: DV-M13-06, 09, 11.

---

## 1. Scope

The M13 prototype implements, against the mock service layer, the screens of URS §1: the chat S1, the RPH list and form S2/S3, the essay list and form S4/S5, the PBD queue S6, the 404 outcome S7/S8 and the two PROPOSED record views V1/V2. The AI is a **simulated service** (D4): fixed canned texts and deterministic rules, shaped exactly like the live contracts read from the page scripts (discovery §6.1). M13 owns its chat threads, RPHs, essay markings and PBD tags (D12); it reads users (M01/M02), classes and enrolments (M10), subjects (M03) and answers (M05) through their owners' contracts.

**Out of scope:** URS §8 — M06/M25/M26 AI pages, the shell chatbot, real AI and DSKP content, manual RPH editing, per-row PBD actions, the real KPM idMe format, the backend.

---

## 2. Screens & routes

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/cikgu` (`?ask=`, `?action=mark_essay&rubric=&subject=&level=&student=&title=`) | Chat | Guru, Admin; Pelajar (INFERRED) | SHU · "Cikgu Alesa" / "Cikgu Alesa" | #1 |
| S2 | `/cikgu/rph` (`?page=`) | RPH list | Guru, Admin | SHU · "Rancangan Pengajaran Harian (RPH)" / "RPH — Cikgu Alesa" | #2 |
| S3 | `/cikgu/rph/baharu` | RPH form | Guru, Admin | SHU · "Jana RPH dengan Cikgu Alesa" / "Jana RPH Baharu" | #3, #11, #12 |
| V1 | `/cikgu/rph/{id}` | RPH view (PROPOSED) | Guru, Admin (own) | SHU · "Rancangan Pengajaran Harian (RPH)" / "RPH — Cikgu Alesa" | #4 |
| S4 | `/cikgu/essay` (`?page=`) | Essay list | Guru, Admin | SHU · "Marking Karangan AI" / "Marking Karangan" | #5 |
| S5 | `/cikgu/essay/baharu` | Essay form | Guru, Admin | SHU · "Mark Karangan Baharu" / "Mark Karangan Baharu" | — (client only) |
| V2 | `/cikgu/essay/{id}` | Essay view (PROPOSED) | Guru, Admin (own) | SHU · "Marking Karangan AI" / "Marking Karangan" | #6 |
| S6 | `/cikgu/pbd` (`?page=`) | PBD queue | Guru, Admin | SHU · "PBD Auto-Tag — Antrian Semakan" / "PBD Auto-Tag Queue" | #7–#10, #11 |
| S7 | every other `/cikgu/*` path, foreign/unknown ids, `/cikgu-alesa` | 404 | All | standalone · "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" | — |
| S8 | GET `/cikgu/send`, `/cikgu/pbd/rollup`, `/cikgu/pbd/bulk-approve` | 404 (DV-M13-10) | All | as S7 | — |

`{id}` is an integer. Non-numeric, unknown or foreign ids → S7. Query names keep the live names (`ask`, `action`, `rubric`, `subject`, `level`, `student`, `title`, `page`). Header subtitles are "Selamat datang kembali" on S1–S6, V1, V2 (DV-M13-08).

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M13-01 | The user-portal menu SHALL hold the M13 entries of URS FN-M13-1.1.1–1.1.3: labels "Cikgu Alesa Chat" and "Cikgu Alesa" each followed by the separate 8px gradient badge "AI" (the label never includes "AI"), the other labels, icons, colours (drawer `fa-robot text-purple-500`; sidebar "PBD Auto-Tag" icon without `text-blue-500` while active) and targets. The sidebar follows the live sidebar order; the drawer replicates the live capture (its own order and shorter labels, shells.md §6 rule 4) until the shell owner unifies the lists (DV-SH-04, XR-M13-04). Neighbouring items of M25, M26 and M15 are owned elsewhere. | 1.1.1, 1.1.2, 1.1.3 | 01.1, 01.2 |
| FR-M13-02 | On every `/cikgu/*` route the matching entry and the "Cikgu Alesa" (+ "AI") entry of "Cikgu Alesa Tools" (prefix `/cikgu`) SHALL be active; on `/cikgu` both chat entries SHALL be active (as live). | 1.1.4 | 01.3 |
| FR-M13-03 | The shell header SHALL show the titles of URS FN-M13-1.1.5 with the subtitle "Selamat datang kembali" (DV-M13-08, DV-SH-03). | 1.1.5 | 01.4 |
| FR-M13-04 | Each screen SHALL set the tab title of URS FN-M13-1.1.6. | 1.1.6 | 01.4 |
| FR-M13-05 | S1–S6, V1, V2 SHALL render in the user-portal shell for every role, with its drawer and bottom nav below 1024px; the bottom-nav "Chat" SHALL open the shell chatbot, not S1. | 1.1.7 | 01.5 |
| FR-M13-06 | Every M13 route SHALL require a session (M01 guard; guest → `/login`). | 1.2.1 | 02.1 |
| FR-M13-07 | Route guard (BR-M13-02): S1 for every logged-in role; S2–S6, V1, V2 for `teacher` and `admin`; other roles are redirected to their M01 landing page, and endpoints #2–#10 answer 403 `FORBIDDEN` (INFERRED, provisional). | 1.2.2 | 02.6 |
| FR-M13-08 | The M01 404 page (exact copy of URS FN-M13-1.2.3, "Mula Latihan" → `/practice`) SHALL render for every M13 path not in §2, for the probed paths of URS §1, and for V1/V2 ids that are non-numeric, unknown or owned by another user. | 1.2.3 | 02.2, 02.4 |
| FR-M13-09 | GET `/cikgu/send`, `/cikgu/pbd/rollup`, `/cikgu/pbd/bulk-approve` SHALL render the 404 page of FR-08, not the framework 405 page (DV-M13-10). | 1.2.4 | 02.3 |
| FR-M13-10 | Trailing slashes SHALL be dropped (`/cikgu/` → S1, `/cikgu/rph/` → S2); `?classroom_id=` SHALL be ignored on S3 and S6; `?page=` beyond the last page SHALL render the empty table with the pager (FR-37). | 1.2.5 | 02.5, 10.2 |
| FR-M13-11 | M13 SHALL define no `/cikgu-alesa` route (it stays 404); the M25 link fix is requested of M25 (XR-M13-01). | 1.2.6 | 02.2 |
| FR-M13-12 | S1 SHALL render the inline-styled card `.cikgu-alesa-shell` (max width 880px, margin 24px auto, padding 16px), the avatar "CA" and h1 "Cikgu Alesa" with the styles of URS FN-M13-2.1.1/2.1.2. | 2.1.1, 2.1.2 | 03.1 |
| FR-M13-13 | The sub-line SHALL read "Guru maya · Powered by Cikgu Nur Demo · Cikgu Amin Demo · Cikgu Siti Demo + 50K+ soalan DSKP" (13px, `#6b7280`; DV-M13-12). No real name SHALL appear in code, fixtures or screenshots. | 2.1.3 | 03.1 |
| FR-M13-14 | `section#cikgu-history` SHALL have the styles of URS FN-M13-2.1.4 and start with the single greeting message "Cikgu Alesa:" + "Hai! Saya Cikgu Alesa. Apa nak belajar hari ni? Cuba tanya pasal subjek tertentu, atau minta latihan soalan." | 2.1.4 | 03.1 |
| FR-M13-15 | Messages SHALL be appended as `div.cikgu-msg.cikgu-msg-{bot\|user}` with `<strong>` "Cikgu Alesa: " / "Anda: " and a `span.cikgu-msg-body` built from text nodes and one `<br>` per `\n`; no HTML or Markdown is interpreted (no `v-html`); after each append the history box SHALL set `scrollTop = scrollHeight` (instant; SOURCE-DERIVED). | 2.1.5 | 03.2 |
| FR-M13-16 | The form `#cikgu-form` SHALL contain the hidden `#cikgu-thread-id`, the mic, the input `#cikgu-input` (placeholder "Taip atau tekan 🎤 untuk cakap…", `required`, `maxlength="4000"`, no `name`) and the submit `#cikgu-send` "Hantar"; Enter submits. | 2.2.1, 2.2.2, 2.2.3 | 03.1, 04.1 |
| FR-M13-17 | An empty input SHALL be stopped by native validation (browser bubble); a whitespace-only value SHALL return silently without a request or an appended message. | 2.2.4 | 04.4 |
| FR-M13-18 | A send SHALL: trim; append "Anda: {text}"; clear the input; disable "Hantar"; set `#cikgu-meta` to "Cikgu Alesa sedang berfikir…"; call #1 with `{message, thread_id}` (`thread_id` = hidden value or `null`). While disabled, Enter SHALL not submit. | 2.2.5 | 04.1, 04.3 |
| FR-M13-19 | On 2xx the client SHALL store `thread_id`, append "Cikgu Alesa: {reply}" (or "(tiada respon)" when `reply` is empty or missing) and set the meta to "Tier: {tier} · Turns remaining: {turns_remaining} · Tool hops: {tool_hops} · Tokens: in={tokens.in} out={tokens.out}". | 2.2.6 | 04.2, 04.6 |
| FR-M13-20 | On a non-2xx JSON body the client SHALL append `error` or "Cikgu Alesa tak boleh respon. Cuba lagi." and set the meta to "Quota habis untuk hari ni." when `quota_exhausted` is true, else empty; on a network failure or a non-JSON body it SHALL append "Ralat sambungan. Cuba lagi sebentar."; in every case it SHALL then enable "Hantar" and focus the input. No retry, no timeout. | 2.2.7, 2.2.8, 2.2.9 | 05.1, 05.2, 05.3, 05.4 |
| FR-M13-21 | On load with `action=mark_essay` and no `ask`, S1 SHALL read the query with `URLSearchParams.get` (`+` → space; empty keys → empty values) and `sessionStorage.cikgu_pending_essay`; when the essay is present, it SHALL put into the input the hand-off message of BR-M13-08, focus it, scroll it into view (smooth, centred) and remove the key; it SHALL NOT send. Without a stored essay the input stays empty (DV-M13-01). | 2.2.12 | 07.1, 07.2, 07.3 |
| FR-M13-22 | On load with `ask`, S1 SHALL copy its decoded value into the input, focus it and scroll it into view (smooth, centred) and SHALL NOT send. | 2.2.11 | 06.1 |
| FR-M13-23 | The thread SHALL live only in the hidden field: a reload shows only the greeting and the next send carries `thread_id: null`; no history, streaming, retry, timeout, quota display before the first reply, upload, export or print exists. | 2.2.10 | 04.5 |
| FR-M13-24 | The mock chat (#1) SHALL choose the reply by BR-M13-04 from the canned texts of §8.2 (PROPOSED, provisional). | 2.3.1 | 04.2, 04.3 |
| FR-M13-25 | The mock SHALL create a thread when `thread_id` is null or not the caller's (BR-M13-03), append both messages to it, and return `tool_hops` (BR-M13-07) and `tokens` (BR-M13-05). | 2.3.2 | 04.2, 04.3 |
| FR-M13-26 | The mock SHALL apply the daily quota of BR-M13-06: `tier` and `turns_remaining` in every 2xx; HTTP 429 `{quota_exhausted: true}` (no `error`) when the limit is reached; reset at 00:00 Asia/Kuala_Lumpur. | 2.3.3 | 05.3, 05.5 |
| FR-M13-27 | For a hand-off message the mock SHALL run the `mark_essay` tool: reply with the marking text of §8.2 (marks BR-M13-09), `tool_hops` 1, and save an EssayMarking (DATA-M13-04) owned by the caller with the parsed fields, the essay text and the reply as comment. | 2.3.4, 4.3.1 | 07.4 |
| FR-M13-28 | For a message containing "RPH" the mock SHALL parse it by BR-M13-10: with a subject and a level it SHALL save an Rph (DATA-M13-03, content BR-M13-11, `source: 'chat'`) and reply with the confirmation of §8.2 (`tool_hops` 1); otherwise it SHALL reply with the follow-up question of §8.2 (`tool_hops` 0) and save nothing. | 2.3.5 | 14.1, 14.2 |
| FR-M13-29 | The voice toolbar SHALL render "🎙️ Voice Mode:", the checkbox `#cikgu-voice-mode` with "Cikgu jawab dengan suara (auto)" and the empty status span; the checkbox SHALL load checked when `localStorage.cikgu_voice_mode === '1'` and write '1'/'0' on change. | 2.4.1, 2.4.2 | 08.1 |
| FR-M13-30 | While the checkbox is checked, each successful reply (2xx `reply`) longer than 10 characters SHALL be passed to the **simulated speaker** exposed as `window.cikguAlesaSpeak`: no audio and no `speechSynthesis` call; `#cikgu-voice-status` shows "🔊 Cikgu sedang bercakap…" (PROPOSED COPY) for 60 ms × characters clamped to 1,500–8,000 ms, then clears; a new reply cancels the running one and restarts the status. The greeting, "(tiada respon)", error/quota/network texts and user messages are not spoken; nothing happens when unchecked (DV-M13-02, BR-20). | 2.4.3 | 08.2 |
| FR-M13-31 | The prototype SHALL always treat voice as supported (simulated recogniser, D4). The live unsupported state — mic disabled, title "Browser tidak sokong voice — guna Chrome/Edge", opacity 0.4 — SHALL be rendered when the test hook `cikguVoice({supported: false})` is set (SOURCE-DERIVED). | 2.4.4 | 09.1 |
| FR-M13-32 | A mic click SHALL start the **simulated recogniser** of BR-20 (no `SpeechRecognition`/`webkitSpeechRecognition` object, no microphone access, no network): mic "🔴" on `#fee2e2`, status "Mendengar..."; interim transcript into the input at 600 ms, final transcript at 1,200 ms, then **end**. End: mic "🎤" on white, status cleared, and when `input.value.trim()` is longer than 5 characters the form's submit handler is fired by `dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}))`, which bypasses the disabled "Hantar" and native validation (a second turn can start while one is in flight — replicated, SEC-M13-02). A click while listening stops the session and runs end. Error (hook `cikguVoiceError()` only): mic "🎤", status "Maaf, tak dengar.", then end (status cleared; auto-submit if the input already holds more than 5 characters). | 2.4.5 | 09.2, 09.3 |
| FR-M13-33 | The mic title SHALL be "Tekan untuk cakap" whenever the mic is enabled (DV-M13-05). | 2.4.6 | 09.4 |
| FR-M13-34 | S2 SHALL render h1 "📋 Rancangan Pengajaran Harian (RPH)", the sub "RPH yang dijana oleh Cikgu Alesa atau cikgu sendiri." and "Jana RPH Baharu" (`fa-robot`, gradient) → `/cikgu/rph/baharu` in a non-stacking header row. | 3.1.1, 3.1.2 | 10.1 |
| FR-M13-35 | S2 SHALL render the table headers Tarikh · Subjek / Level · Tajuk · Status · Tindakan (upper case by CSS, last right-aligned) inside a card whose table scrolls horizontally inside the card (DV-M13-04), and, with no row, the empty row of URS FN-M13-3.1.4 (example prompt in `<em>`). | 3.1.3, 3.1.4 | 10.1, 21.3 |
| FR-M13-36 | S2 rows (PROPOSED, provisional) SHALL show the viewer's RPHs ordered by BR-M13-13 with "dd/mm/yyyy", "{subjectName} / {level}", tajuk, "Dijana" and "Lihat" → V1. | 3.1.5 | 10.3 |
| FR-M13-37 | S2, S4 and S6 SHALL use the Laravel-style pager of URS FN-M13-3.1.6 (20 per page, PROPOSED; hidden when one page suffices; English copy as live, DV-M13-09 rejected; desktop variant from 640px, mobile variant below). | 3.1.6, 4.1.6, 5.2.6 | 10.2, 16.1 |
| FR-M13-38 | S3 SHALL render "← Senarai RPH" → `/cikgu/rph`, the icon, h1 "Jana RPH dengan Cikgu Alesa" and, when the viewer owns no class (#11 empty), "Sistem belum jumpa kelas yang dikaitkan dengan akaun Cikgu. Sila isi manual." | 3.2.1, 3.2.2 | 11.1 |
| FR-M13-39 | When the viewer owns classes, S3 SHALL hide the no-class sentence and show the class select of URS FN-M13-3.2.3 (PROPOSED labels) whose options carry `data-subject`, `data-level`, `data-class` (BR-M13-18); a choice SHALL copy them into Subjek, Tingkatan / Tahun and Kelas (provisional). | 3.2.3 | 13.1 |
| FR-M13-40 | S3 SHALL render the form `#rph-create-form` with `_token` and the nine fields of URS FN-M13-3.2.5–3.2.13 with their exact labels, placeholders, attributes, options (datalist = the 31 subject names of #12, A→Z) and defaults (Tarikh = today, Tempoh = 60). | 3.2.4, 3.2.5, 3.2.6, 3.2.7, 3.2.8, 3.2.9, 3.2.10, 3.2.11, 3.2.12, 3.2.13 | 11.1, 11.2, 11.3, 11.4 |
| FR-M13-41 | S3 SHALL render the info box "📌 Apa yang Cikgu Alesa akan jana:" with its four bullets and the note "⏱️ Proses ambil masa 10-30 saat. Sila tunggu." | 3.2.14 | 11.5 |
| FR-M13-42 | "Batal" SHALL be a link to `/cikgu/rph` that discards the input without a confirm or draft. | 3.2.16 | 11.6 |
| FR-M13-43 | S3 SHALL lay out one column below `md` and the 2/3/2-column rows of URS FN-M13-3.2.18 from `md`; all fields reset on reload. | 3.2.18 | 11.6, 11.7 |
| FR-M13-44 | S3 SHALL rely on native validation only (no `novalidate`, no custom messages): required Subjek, Tingkatan / Tahun, Tajuk; Tempoh 15–240; Tajuk ≤ 200 and Keperluan ≤ 500 by `maxlength`. | 3.2.17 | 12.1 |
| FR-M13-45 | On a valid submit S3 SHALL disable `#submit-btn`, add `opacity-60` and set `#submit-label` to "Cikgu Alesa sedang jana RPH…" until #3 answers. | 3.2.15 | 12.2 |
| FR-M13-46 | #3 SHALL save an Rph owned by the viewer (`source: 'form'`, status `generated`) with the canned content of BR-M13-11 (PROPOSED, provisional). | 3.3.1 | 12.3, 12.4 |
| FR-M13-47 | After #3 succeeds the browser SHALL go to V1 `/cikgu/rph/{id}`; V1 SHALL render "← Senarai RPH", h1 "📋 Rancangan Pengajaran Harian (RPH)", the labelled values "Tarikh", "Subjek / Level", "Tajuk", "Status" and the content with line breaks kept, as text (PROPOSED, provisional). | 3.3.2 | 12.3, 15.1 |
| FR-M13-48 | V1/V2 and #4/#6 SHALL return the record only to its owner; any other case is 404 (FR-08). No edit, print or PDF route exists. | 3.3.3 | 02.4, 15.3 |
| FR-M13-49 | S4 SHALL render h1 "📝 Marking Karangan AI", the sub-line, "Mark Karangan Baharu" (`fa-plus`) → `/cikgu/essay/baharu`, the table headers Pelajar · Subjek / Rubric · Tajuk · Markah (centred) · Tindakan (right; upper case by CSS; scroll inside the card, DV-M13-04) and, with no row, "Belum ada karangan dimark. Klik "Mark Karangan Baharu" untuk mula." | 4.1.1, 4.1.2, 4.1.3, 4.1.4 | 16.1 |
| FR-M13-50 | S4 rows (PROPOSED, provisional) SHALL show the viewer's markings newest first: student name, "{subject} / {rubric label without "(n markah)"}", title, "{marks}/{max}", "Lihat" → V2; an empty text shows "-". | 4.1.5 | 16.2 |
| FR-M13-51 | S5 SHALL render "← Senarai" → `/cikgu/essay`, h1 "📝 Mark Karangan Baharu", the intro, and the form `#essay-form` (no action, no method, no `name` on any control) with Rubric (6 options, first selected), Subjek, Level, Nama Pelajar, Tajuk Karangan as URS FN-M13-4.2.4–4.2.8. | 4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5, 4.2.6, 4.2.7, 4.2.8 | 17.1, 17.5 |
| FR-M13-52 | The textarea `#essay_text` (rows 14, `font-mono text-sm`, placeholder, `required minlength=50`) SHALL update `#word-counter` "{n} perkataan" on every input with n = number of `\S+` runs. | 4.2.9 | 17.2 |
| FR-M13-53 | S5 SHALL render the amber box text of URS FN-M13-4.2.10 exactly. | 4.2.10 | 17.1 |
| FR-M13-54 | "Hantar ke Cikgu Alesa" (`type=button`) SHALL trim all fields; when the essay has fewer than 50 characters it SHALL call `alert('Karangan terlalu pendek (minimum 50 aksara).')` and stay; otherwise it SHALL store the essay in `sessionStorage.cikgu_pending_essay` and navigate to `/cikgu?` + `new URLSearchParams({action: 'mark_essay', rubric, subject, level, student, title}).toString()` — form encoding (spaces → `+`), all six keys always present, empty values kept (as live). | 4.2.11 | 17.3, 07.1 |
| FR-M13-55 | "Batal" SHALL link to `/cikgu/essay` without a confirm; Enter in a field SHALL do nothing; a reload SHALL reset the rubric to the first option and the counter to "0 perkataan"; the layout SHALL be one column below `md`, 3 + 2 columns from `md`. | 4.2.12, 4.2.13 | 17.4 |
| FR-M13-56 | V2 SHALL render "← Senarai", h1 "📝 Marking Karangan AI", the labelled values "Pelajar", "Subjek / Rubric", "Tajuk", "Markah" and the comment as text (PROPOSED, provisional). | 4.3.2 | 15.2 |
| FR-M13-57 | S6 SHALL render h1 "📊 PBD Auto-Tag — Antrian Semakan" and the sub-line of URS FN-M13-5.1.1. | 5.1.1 | 18.1 |
| FR-M13-58 | S6 SHALL render the rollup form (`_token`, select `classroom_id` "Pilih kelas untuk rollup" + own classes from #11, not `required`; submit "Jalankan Auto-Tag", no confirm) calling #8. | 5.1.2 | 18.1, 18.3 |
| FR-M13-59 | S6 SHALL render "Eksport CSV (Approved)" (`fa-download`, emerald-500) as a link to `/cikgu/pbd/export.csv`, served by #10 as a file download. | 5.1.3 | 18.1, 20.1 |
| FR-M13-60 | `#bulk-form` (`_token`) SHALL wrap the table card; row checkboxes SHALL be its own inputs (`name="ids[]"`); no `<form>` SHALL be nested in it. | 5.2.1 | 19.4 |
| FR-M13-61 | `#select-all` "Pilih semua" SHALL, through an `onclick` attribute, set every `.row-check` in the document (query not scoped to the form) to its own checked state; a programmatic `change` event does nothing (as live); its state is not persisted. | 5.2.2 | 19.1 |
| FR-M13-62 | "Lulus pukal (TP cadangan)" SHALL submit the ticked ids to #9 without a confirm, also when none is ticked (DV-M13-11 rejected). | 5.2.3 | 19.2, 19.3 |
| FR-M13-63 | S6 SHALL render the headers *(checkbox)* · Pelajar · SP · Skor · TP Cadangan · Tindakan (upper case by CSS; Skor and TP centred; Tindakan right; scroll inside the card, DV-M13-04) and, with no row, "Tiada antrian semakan. Klik "Jalankan Auto-Tag" untuk scan aktiviti pelajar." | 5.2.4 | 18.1 |
| FR-M13-64 | S6 rows (PROPOSED, provisional) SHALL show the viewer's pending tags ordered by BR-M13-13: checkbox, student name, SP, "{skor}%" (1 decimal), "TP{n}", Tindakan "-". | 5.2.5 | 18.3 |
| FR-M13-65 | #8 SHALL run the rollup rule BR-M13-15 for an own class; with `classroomId` null or not own it SHALL change nothing; the page SHALL then reload the queue with the select back on its placeholder and no message (provisional). | 5.3.1 | 18.2, 18.4, 18.5 |
| FR-M13-66 | #9 SHALL approve the caller's pending tags among the ids (BR-M13-16) and ignore the others; the page SHALL reload the queue with "Pilih semua" unticked and no message. | 5.3.2 | 19.2, 19.3 |
| FR-M13-67 | #10 SHALL return the CSV of BR-M13-17 (header line only when the caller has no approved tag) (PROPOSED layout, provisional). | 5.3.3 | 20.1, 20.2 |
| FR-M13-68 | Every M13 screen SHALL meet NFR-RESP at 375 / 768 / 1280 with the per-screen behaviour of §10: no page-level horizontal scroll (DV-M13-03 on S1, DV-M13-04 on S2/S4/S6); everything else as live. | 6.1.1 | 21.1, 21.2, 21.3, 21.4 |
| FR-M13-69 | Accessibility SHALL replicate live (D10): native validation bubbles, the S5 `alert`, the mic `title`, the live `focus()` calls; no added ARIA, dialogs or focus traps. | 6.1.2 | 04.4, 17.3, 21.1 |
| FR-M13-70 | PBD scores SHALL be computed from the M05 answer log through its owner's contract at rollup time, for the M10 enrolments of the class (D11/D12); M13 stores the snapshot on the tag and no parallel answer or class data. | 5.3.1 | 18.3, 18.4 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M13-01 | 01–05 | 01, 02, 03, 04 |
| US-M13-02 | 06–11, 48 | 05, 06, 07, 08, 09, 10 |
| US-M13-03 | 12–16 | 11, 12 |
| US-M13-04 | 16–19, 23–25, 69 | 11, 13, 14, 15, 16, 17 |
| US-M13-05 | 20, 26 | 18, 19, 20, 21 |
| US-M13-06 | 22 | 22 |
| US-M13-07 | 21, 27, 54 | 23, 24, 25 |
| US-M13-08 | 29, 30 | 26, 27 |
| US-M13-09 | 31–33 | 28, 29, 30 |
| US-M13-10 | 10, 34–37 | 31, 32 |
| US-M13-11 | 38, 40–43 | 33, 34 |
| US-M13-12 | 44–47 | 35, 36 |
| US-M13-13 | 39 | 37 |
| US-M13-14 | 28 | 38 |
| US-M13-15 | 47, 48, 56 | 39 |
| US-M13-16 | 37, 49, 50 | 40, 41 |
| US-M13-17 | 51–55, 69 | 42, 43, 44 |
| US-M13-18 | 57–59, 63–65, 70 | 45, 46, 47, 52 |
| US-M13-19 | 60–64, 66 | 46, 48, 49 |
| US-M13-20 | 59, 67 | 50 |
| US-M13-21 | 35, 68, 69 | 51 |

Checked by script (`trace.js` in the author's scratchpad `m13-writer/`): every FN of URS §3 is cited by at least one FR; every FR cites existing FNs and ACs and appears in at least one E2E; every AC appears in at least one E2E.

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M13-01 | **Ownership.** Every Rph, EssayMarking, PbdTag and ChatThread has `userId` = its creator. Lists, views, exports and approvals see only the caller's records. The admin has none seeded (as live: every list empty). | OBSERVED (admin empty; ids 1/2 → 404) / INFERRED |
| BR-M13-02 | **Roles.** S1 and #1: any logged-in user. S2–S6, V1, V2 and #2–#10: roles `teacher` and `admin`; others → M01 landing page / 403. | OBSERVED (admin) / INFERRED |
| BR-M13-03 | **Thread.** `thread_id` null, unknown or of another user → a new thread `thr-{id}`; otherwise the turn continues that thread. A turn stores the user message and the bot reply. | SOURCE-DERIVED (fields) / PROPOSED |
| BR-M13-04 | **Canned reply routing** (first match, case-insensitive, on the trimmed message): (1) starts with "Tolong mark karangan ini menggunakan rubric " → `mark_essay` (FR-27); (2) contains "RPH" → RPH tool (FR-28); (3) contains "latihan" or "soalan" → practice reply; (4) otherwise → general reply. Texts in §8.2. A test hook may override the next reply (§6.9). | PROPOSED |
| BR-M13-05 | **Tokens.** `tokens.in` = 120 + ⌈chars(message) ÷ 4⌉; `tokens.out` = ⌈chars(reply) ÷ 4⌉ (Unicode code points). | PROPOSED |
| BR-M13-06 | **Quota.** Tier and daily limit by role (DATA-M13-06): `admin` 100, `teacher` → tier `guru` 30, any other role → `pelajar` 10. Used = the caller's user messages with `createdAt` on today's date (Asia/Kuala_Lumpur). If used ≥ limit before the turn → 429 `{quota_exhausted: true}`, nothing stored. Otherwise the turn is stored and `turns_remaining` = limit − (used + 1). | SOURCE-DERIVED (fields, state) / PROPOSED (values) / INFERRED (daily reset) |
| BR-M13-07 | **Tool hops** = 1 when the turn ran `mark_essay`, saved an RPH or returned practice questions; 0 otherwise (incl. the RPH follow-up question). | PROPOSED |
| BR-M13-08 | **Hand-off message** (DV-M13-01; PROPOSED COPY): "Tolong mark karangan ini menggunakan rubric {label}." + " Subjek: {subject}." + " Level: {level}." + " Pelajar: {student}." + " Tajuk: {title}." + " Karangan: {essay}", where each of the four middle parts is omitted when its value is empty after trimming, {label} is the full option label of `rubric` (unknown or missing key → the first rubric), and every run of line breaks in {essay} becomes one space. The mock parses the same markers (". Subjek: ", ". Level: ", ". Pelajar: ", ". Tajuk: ", ". Karangan: ") to fill the EssayMarking. | DV-M13-01 / PROPOSED |
| BR-M13-09 | **Canned marks** = round(0.7 × max): 35/50, 35/50, 21/30, 21/30, 14/20, 70/100 for the six rubrics. | PROPOSED |
| BR-M13-10 | **RPH request parsing** (chat): subject = the longest of the 31 subject names found in the message (case-insensitive); level = the first token `T1`–`T5` / `D1`–`D6` or "Tingkatan n" / "Darjah n" (→ code); tajuk = the text after the level token with a trailing "esok" or "hari ini" removed and trimmed (empty → "{subject} {level label}"); lesson date = tomorrow when the message contains "esok", else today; duration 60; other fields empty. No subject or no level → follow-up reply, nothing saved. Example: "Tolong jana RPH untuk Matematik T4 Bab 3 esok" → Matematik, T4, "Bab 3", 26/09/2026. | INFERRED (tool) / PROPOSED (rule) |
| BR-M13-11 | **Canned RPH content** (plain text, sections in the order of the S3 info box): header lines (subject · level label, class, date, time slot, duration, tajuk, tema when given); "Standard Kandungan: rujuk DSKP {subject} {level label} — {tajuk}"; "Standard Pembelajaran: rujuk DSKP {subject} {level label} — {tajuk}"; "Objektif Pembelajaran" with 3 numbered objectives (§8.2); "Aktiviti PdPc" — "Set Induksi ({a} minit)", "Aktiviti 1 ({b} minit)", "Aktiviti 2 ({c} minit)", "Aktiviti 3 ({d} minit)", "Penutup ({e} minit)" with a = round(0.10 × Tempoh), e = round(0.15 × Tempoh), b = c = ⌊(Tempoh − a − e) ÷ 3⌋, d = the remainder (60 → 6/15/15/15/9); "BBM", "EMK", "PBD Assessment plan" lines; "Keperluan Khas: {text}" last when given. No real DSKP code is cited (DSKP owned by M10). | OBSERVED (sections) / PROPOSED (text) |
| BR-M13-12 | **Server-side RPH checks** (mirror the native rules; UI cannot bypass): subject 1–100 chars after trim; level ∈ {D1…D6, T1…T5}; tajuk 1–200; duration integer 15–240; lesson date a valid date (empty → today, INFERRED); keperluan ≤ 500; class, time slot, tema ≤ 100 (PROPOSED). Failure → 422 `VALIDATION_ERROR` (copy UNVERIFIED; shown with the M01 global error convention). | OBSERVED (client) / PROPOSED (server) |
| BR-M13-13 | **Order and paging** (Q-M13-6, PROPOSED; confirmed v1.1): RPH by `lessonDate` desc, then id desc — a new RPH appears where its lesson date places it (with the seed: after 13101 dated 28/09/2026; before 13102 when dated 25/09 or later); essays by `createdAt` desc; PBD pending tags by `createdAt` of their rollup desc, then student name A→Z (Malay collation, case-insensitive); 20 per page. Seeds are not tuned to change these positions. | PROPOSED |
| BR-M13-14 | **TP bands** (PROPOSED): Skor < 20 → TP1; 20 ≤ s < 40 → TP2; 40 ≤ s < 60 → TP3; 60 ≤ s < 75 → TP4; 75 ≤ s < 90 → TP5; ≥ 90 → TP6. Skor = correct ÷ answered × 100, one decimal. | PROPOSED |
| BR-M13-15 | **Rollup** (PROPOSED): for an own class C with subject S, each student with an active M10 enrolment in C and ≥ 1 M05 answer with `subjectId` S gets one tag per (student, C, SP): SP = the subject's label in DATA-M13-06 (Kimia "5.1.1", Sejarah "1.1.1", other subjects "1.1.1"; illustrative, not DSKP); Skor/TP from all that student's answers in S (BR-14). An existing `pending` tag for the key is updated (skor, tp, `createdAt` = now); an `approved` tag is left unchanged and no new pending tag is created; otherwise a new pending tag is created (runtime id ≥ 9,000,001). Response `{created, updated, skipped}`. | INFERRED (scan of activity) / PROPOSED |
| BR-M13-16 | **Bulk approve**: for each id that is a pending tag of the caller → `status = approved`, `approvedAt = now`; other ids are ignored; an empty list changes nothing. Response `{approved: n}`. | INFERRED |
| BR-M13-17 | **Export CSV** (PROPOSED layout): UTF-8, comma-separated, header `pelajar,kelas,sp,skor,tp,tarikh_lulus`, one line per approved tag of the caller ordered by `approvedAt` then student name; `skor` one decimal; `tarikh_lulus` `yyyy-mm-dd` (Asia/Kuala_Lumpur); values quoted when they contain a comma or quote; file name `pbd-approved.csv`. | PROPOSED |
| BR-M13-18 | **Class options** (#11, M10): label = class name; `data-subject` = subject name; `data-level` = "T{n}" for `tingkatan-n`, "D{n}" for `tahun-n`; `data-class` = class name. Class 2001 → "Kimia", "T5", "5 MARIKH - Kimia"; 2002 → "Sejarah", "T5", "5 MARIKH - Sejarah". | SOURCE-DERIVED (attributes) / INFERRED (values) |
| BR-M13-19 | **Formats**: dates `dd/mm/yyyy` (Asia/Kuala_Lumpur); marks "{m}/{max}"; skor "{x.x}%"; list cell "{subject} / {level code}". | PROPOSED |
| BR-M13-20 | **Voice (simulated, D4; Delivery Lead decision closing OQ-M13-08)**: storage key `cikgu_voice_mode` ('1' / '0'). *Input*: a simulated recogniser (no Web Speech API, no microphone, no network) — start → "🔴"/`#fee2e2`/"Mendengar..."; +600 ms interim "Terangkan pecahan" (replaces the input value); +1,200 ms final "Terangkan pecahan setara dengan contoh"; end → "🎤", status '', auto-submit via `dispatchEvent('submit')` when `trim().length > 5`; second click → stop → end; error (hook only) → "Maaf, tak dengar." → end. The live settings (`lang` `ms-MY`, interim, not continuous) are recorded as SOURCE-DERIVED but not used. *Output*: simulated speaker (FR-30); live TTS settings `ms-MY`, 0.95, 1.0 recorded, no audio. Transcripts, timings and the speaking status are PROPOSED. | SOURCE-DERIVED |
| BR-M13-21 | **Essay rule**: minimum 50 characters after `trim()`; the counter counts `\S+` runs; the other S5 fields are optional free text. | OBSERVED |
| BR-M13-22 | **AI latency** (PROPOSED): #1 and #3 answer after 1,500 ms by default (live RPH 10–30 s) so the busy states are visible; settable with `setLatency(ms, pattern)`. Other M13 endpoints use the global mock latency. | PROPOSED |
| BR-M13-23 | **Canned output is deterministic**: the same request against the same seed returns the same texts, marks, TPs and counters on every run and viewport. | D11 / NFR |

---

## 5. Validation rules

| Screen | Field | Rule (client) | Message |
|---|---|---|---|
| S1 | `#cikgu-input` | `required`; `maxlength=4000` (typing stops at 4,000); whitespace-only → silent return | browser-native bubble (Chrome "Please fill out this field.") |
| S3 | Subjek | `required` | native |
| S3 | Tingkatan / Tahun | `required` (value '' invalid) | native ("Please select an item in the list.") |
| S3 | Tajuk Pengajaran | `required`, `maxlength=200` | native |
| S3 | Tempoh (minit) | number, `min=15`, `max=240` | native range messages |
| S3 | Keperluan Khas | `maxlength=500` | typing stops |
| S3 | Kelas, Tarikh, Masa Slot, Tema | none | — |
| S5 | Teks Karangan | ≥ 50 characters after trim, checked by script; `required minlength=50` present but never evaluated (button `type=button`) | `alert('Karangan terlalu pendek (minimum 50 aksara).')` |
| S5 | other fields | none | — |
| S6 | class select, row ticks | none (DV-M13-11 rejected) | — |

Server-side rules (mock): #1 blank message → 422 `{}` (the client then shows its fallback text); #3 per BR-M13-12; #8 class not own or null → no change; #9 foreign ids ignored.

---

## 6. Data entities & fields

*(solution-architect)* M13 stores are small in-memory collections seeded from fixtures and reset per E2E test (`mock.reset()`). JSON fields are camelCase except in endpoint #1, whose request and response keep the **live snake_case contract** exactly (`thread_id`, `turns_remaining`, `tool_hops`, `tokens.in`, `tokens.out`) because the chat handler is replicated from the live script (decision recorded in §7). Ids are integers (thread ids strings `thr-{n}`, as the live contract carries a string). "Now" is the M05 mock clock (default `2026-09-25T15:40:00+08:00`).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M13 reads |
|---|---|---|
| User | M01 DATA-M01-01 / M02 | `id`, `name`, `role` |
| Classroom, Enrolment | M10 DATA-M10-01 / 02 (via #11) | class `id`, `name`, `teacherId`, `subjectId`, `educationLevel`; enrolment `studentId`, `status` |
| Subject | M03 (via #12) | `id`, `name` (31 active subjects) |
| QuizAnswer | M05 DATA-M05-02 (repository read) | `userId`, `subjectId`, `isCorrect`, `answeredAt` |

### 6.2 DATA-M13-01 — ChatThread (owned by M13)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string `thr-{n}` | yes | returned as `thread_id` |
| userId | int → User | yes | owner |
| createdAt, updatedAt | datetime | yes | |

### 6.3 DATA-M13-02 — ChatMessage (owned by M13)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | |
| threadId | string → ChatThread | yes | |
| role | `user` \| `bot` | yes | UI "Anda" / "Cikgu Alesa" |
| text | string | yes | user text ≤ 4,000 via the UI (server cap UNVERIFIED; the hand-off may be longer) |
| tool | `mark_essay` \| `rph` \| `practice` \| null | no | bot messages only |
| toolHops, tokensIn, tokensOut | int | bot only | BR-05, BR-07 |
| createdAt | datetime | yes | quota count (BR-06) |

### 6.4 DATA-M13-03 — Rph (owned by M13)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | |
| userId | int → User | yes | owner |
| subjectName | string ≤ 100 | yes | free text (live `subject_name`) |
| level | `D1`…`D6` \| `T1`…`T5` | yes | live `level` |
| tajuk | string ≤ 200 | yes | |
| className | string \| null | no | live `class_name` |
| lessonDate | date | yes | default today |
| durationMinutes | int 15–240 | yes | default 60 |
| timeSlot, tema | string \| null | no | |
| pengajaranKeperluan | string ≤ 500 \| null | no | |
| status | `generated` | yes | label "Dijana" (PROPOSED; live values unknown) |
| source | `form` \| `chat` | yes | "dijana oleh Cikgu Alesa" (manual "cikgu sendiri" not built) |
| content | text | yes | BR-M13-11 |
| threadId | string \| null | no | when `source = chat` |
| createdAt | datetime | yes | |

### 6.5 DATA-M13-04 — EssayMarking (owned by M13)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | |
| userId | int → User | yes | owner |
| rubricKey | enum of 6 (DATA-M13-06) | yes | |
| subjectName, level, studentName, essayTitle | string \| null | no | free text (student name is not a user link) |
| essayText | text | yes | ≥ 50 characters |
| marks | int | yes | BR-09 |
| maxMarks | int | yes | from the rubric |
| comment | text | yes | the bot reply |
| threadId | string | yes | |
| createdAt | datetime | yes | |

### 6.6 DATA-M13-05 — PbdTag (owned by M13)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | `.row-check` value |
| userId | int → User | yes | teacher (owner) |
| classroomId | int → Classroom (M10) | yes | |
| studentId | int → User | yes | |
| sp | string | yes | BR-15 (illustrative label) |
| skor | decimal(4,1) | yes | snapshot at rollup |
| tp | int 1–6 | yes | BR-14 |
| status | `pending` \| `approved` | yes | queue = pending |
| createdAt | datetime | yes | rollup time |
| approvedAt | datetime \| null | no | |

### 6.7 DATA-M13-06 — CikguSettings (constants, owned by M13)

`{ tiers: {admin: {tier: 'admin', dailyTurns: 100}, teacher: {tier: 'guru', dailyTurns: 30}, other: {tier: 'pelajar', dailyTurns: 10}}, rubrics: [{key:'spm_bm_karangan', label:'SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)', max:50}, {key:'spm_bi_continuous_writing', label:'SPM English — Continuous Writing (Section B) (50 markah)', max:50}, {key:'pt3_bm_karangan', label:'PT3 Bahasa Melayu — Karangan (30 markah)', max:30}, {key:'pt3_bi_essay', label:'PT3 English — Essay (30 markah)', max:30}, {key:'sejarah_essay', label:'Sejarah — Karangan Esei (20 markah)', max:20}, {key:'general', label:'Rubric Am (default) (100 markah)', max:100}], levels: [['D1','Darjah 1'] … ['D6','Darjah 6'], ['T1','Tingkatan 1'] … ['T5','Tingkatan 5']], tpBands: BR-14, spLabels: {Kimia:'5.1.1', Sejarah:'1.1.1', default:'1.1.1'}, poweredBy: ['Cikgu Nur Demo','Cikgu Amin Demo','Cikgu Siti Demo'], pageSize: 20, aiLatencyMs: 1500 }`. Rubrics, levels and the sub-line structure are OBSERVED; everything else PROPOSED.

### 6.8 Seed and dataset spec

#### 6.8.1 Dataset spec (format of M02 §6.15 / M10 §6.2.1)

M13 collections are **small seeded sets**, not D11 virtual datasets: no live total was observable (every list is empty for the admin; platform-wide counts are not shown anywhere), so nothing is generated and every count is computed from the stored rows.

| Store (owner M13) | Seeded N | Seed id range (reserved) | Runtime ids | Owners in seed | Evidence |
|---|---|---|---|---|---|
| Rph | 2 | 13101–13199 | from 9,000,001 | teacher 5 only | admin list empty (OBSERVED); rows designed |
| EssayMarking | 2 | 13201–13299 | from 9,000,001 | teacher 5 only | idem |
| PbdTag | 11 (9 pending, 2 approved) | 13301–13399 | from 9,000,001 | teacher 5 only | idem; scores computed from M05/M08 answers |
| ChatThread | 2 | `thr-13401`–`thr-13499` | `thr-9000001` upward | teacher 5 only | no thread visible on live (reload = new chat) |
| ChatMessage | 10 | 13501–13599 | from 9,000,001 | — | drives the teacher's quota count |

The ranges 13101–13599 are used by no other module (checked against M01–M11 SRS/URS); runtime ids follow the TRACKER floor 9,000,001. M13 creates no user, class, enrolment, subject or answer: students 3001–3008 are M08 designed users registered in M02, classes 2001/2002 are M10 anchors, answers are M05 rows written by M08's designed sessions.

#### 6.8.2 Admin mirror (every value observed)

`admin@demo.test` (id 1): 0 RPH, 0 essay markings, 0 PBD tags, 0 threads; owns no class (#11 → `[]`), so S3 shows the no-class sentence and S6's select only its placeholder; chat tier `admin` with 100 turns (PROPOSED, used only after a send).

#### 6.8.3 Teacher view (designed; `guru@demo.test` id 5, SMK DEMO 900001; provisional)

| Id | Record |
|---|---|
| 13101 | Rph: Kimia, T5, "Elektrolisis Larutan Akueus", class "5 MARIKH - Kimia", 2026-09-28, 60 min, "8.00-9.00 pagi", no tema, no keperluan, `generated`, `form`, created 2026-09-24T21:10+08:00, content by BR-11 |
| 13102 | Rph: Sejarah, T5, "Ulang Kaji Bab 1", no class, 2026-09-25, 60 min, `generated`, `chat` (thread `thr-13401`), created 2026-09-24T20:30+08:00 |
| 13201 | EssayMarking: `spm_bm_karangan`, "Bahasa Melayu", "T5", "Murid Demo 01", "Kepentingan Membaca", dummy text (312 characters, neutral), 35/50, comment = marking text of §8.2, `thr-13401`, created 2026-09-23T21:00+08:00 |
| 13202 | EssayMarking: `sejarah_essay`, "Sejarah", "T5", "Murid Demo 02", "Semangat Patriotisme", dummy text (268 characters), 14/20, `thr-13401`, created 2026-09-24T21:00+08:00 |
| 13301–13308 | PbdTag class 2001 (Kimia, SP "5.1.1"), students 3001–3008, pending, created 2026-09-24T21:30+08:00; skor/TP from the M08 designed Kimia answers: 3001 88.9 TP5 (8/9), 3002 50.0 TP3 (5/10), 3003–3006 37.5 TP2 (3/8), 3007 33.3 TP2 (3/9), 3008 12.5 TP1 (1/8) |
| 13309, 13310 | PbdTag class 2002 (Sejarah, SP "1.1.1"), 3001 80.0 TP5 (4/5), 3002 60.0 TP4 (3/5), **approved** 2026-09-24T21:40+08:00, created 21:35 |
| 13311 | PbdTag class 2002, 3003 40.0 TP3 (2/5), pending, created 2026-09-24T21:35+08:00 |
| `thr-13401` | thread 2026-09-23T21:00 → 2026-09-24T21:00: messages 13501 (user hand-off, Murid Demo 01) / 13502 (bot marking, tool `mark_essay`), 13503 (user "Tolong jana RPH untuk Sejarah T5 Ulang Kaji Bab 1 esok", 2026-09-24T20:30) / 13504 (bot confirmation, tool `rph`), 13509 (user hand-off, Murid Demo 02, 2026-09-24T21:00) / 13510 (bot marking) |
| `thr-13402` | thread 2026-09-25T09:10: 13505 (user "Terangkan konsep mol dalam Kimia") / 13506 (bot general), 13507 (user "Minta latihan soalan konsep mol", 09:12) / 13508 (bot practice) → **2 turns used today** |

Resulting anchors (asserted by provisional E2E): S2 2 rows (13101 then 13102; a new RPH dated 25/09 or 26/09 lands between them, BR-13); S4 2 rows (13202 then 13201); S6 queue 9 rows (13311 first, then 13301–13308 by name); export 2 lines (13309, 13310); first chat send today "Turns remaining: 27"; rollup of 2001 after one more correct Kimia answer by 3008 → 2/9 = 22.2% TP2. Teachers other than 5 and the admin have no M13 records.

### 6.9 Test hooks (dev/test builds only)

Global hooks of architecture §6.13 (`reset`, `setNow`, `setLatency`, `failNext` — incl. `{status: 500, body: {error: 'Ralat ujian.'}}`, `{status: 500, body: {}}`, `'network'`, and a non-JSON body —, `setUser`, `lastRequest`). Module hooks (M13 plugin): `cikguNextReply(text)` (override the next canned reply, e.g. `''` or `'Baris 1\n<b>x</b>'`), `cikguSetTurnsUsed(userId, n)` (today's count), `cikguVoice({supported?: boolean, transcript?: {interim, final}, delays?: {interim, final}})` (configure the simulated recogniser; `supported: false` renders the live unsupported state), `cikguVoiceError()` (fire the error step of the current session), `cikguSpoken()` (list the texts passed to the simulated speaker, for assertions). No hook stubs browser speech APIs because none is used. AC-M13-18.4 needs the **requested M05 hook** `addAnswer({userId, questionId, isCorrect, answeredAt?})` (XR-M13-03b); M05's existing `addSessions(userId, n)` is a pager hook and cannot set subject or correctness.

### 6.10 Cross-module requests (to the owners; D12)

| # | Owner | Request |
|---|---|---|
| XR-M13-01 | M25 | `/pusat-nota-ringkas` "Buka Cikgu Alesa" → `/cikgu` (DV-M13-07). |
| XR-M13-02 | M10 | **Confirm only (no change requested):** M10 v1.2 #12 `GET /api/guru/classes` already returns `Classroom + {subjectName, levelLabel, studentCount}` with `educationLevel`; M13 uses these for BR-M13-18. Confirm the labels "5 MARIKH - Kimia" / "5 MARIKH - Sejarah". |
| XR-M13-03 | M05 | A repository read "answers of user U in subject S" (correct / answered) for the rollup; M13 writes nothing to the answer log. |
| XR-M13-03b | M05 | **Test hook** `mock.addAnswer({userId, questionId, isCorrect, answeredAt?})` (dev/test builds only) that writes one QuizAnswer through the M05 answer-log contract (`subjectId` taken from the M04 question; `answeredAt` defaults to the mock clock; a runtime answer id ≥ 9,000,001; counters and mastery updated as for any answer). M13 uses it once: student 3008, question 700001 (Kimia anchor), `isCorrect: true` → 3008's Kimia accuracy 2/9 = 22.2% (AC-M13-18.4, E2E-M13-47). |
| XR-M13-04 | Global shell / M23 | Add the M13 entries, badges and active rule (URS FN-M13-1.1.1–1.1.4) and the header titles of FN-1.1.5 (DV-SH-03). The live drawer lists the M13 items in another order and with shorter labels than the sidebar; M13 replicates the capture until the shell owner applies DV-SH-04's single list and fixes the canonical positions. |
| XR-M13-05 | Architecture | **Request:** a documented raw-body method on the shared ApiClient (e.g. `api.raw(method, path, body)`) that sends through MockTransport with auth, latency and fault injection, returns `{status, body}` without the `{data}` unwrap and without mapping errors to `ApiError`, and still applies the global 401 policy (session expiry → `/login`). Endpoint #1 is called only through it. |

---

## 7. Mock API endpoints

*(solution-architect)* Base `/api`. **S** = any logged-in user; **T** = role `teacher` or `admin` (others 403 `FORBIDDEN`); guests 401. Envelope and error format of SRS.md §7 except #1. **Decision (#1, pending architecture confirmation SQ-M13-01):** the chat endpoint returns the live JSON body exactly — `{thread_id, reply, tier, turns_remaining, tool_hops, tokens:{in, out}}` on 2xx and `{error?, quota_exhausted?}` otherwise — with no envelope and snake_case keys, because the replicated client handler (FR-18–FR-20) reads the live shape (`data.error` as a string, `data.quota_exhausted`, `res.json()` before the status check). The page therefore calls #1 through the **raw-body transport** requested in XR-M13-05, not through the enveloped ApiClient path (which would unwrap `data` and turn `error` into an object). A 401 on #1 follows the global 401 policy (redirect to `/login`); every other non-2xx body is handed to the handler unchanged; a transport failure or a non-JSON body is the handler's network branch. The CSRF header of live (`X-CSRF-TOKEN`) is replaced by the mock session token (SEC-M13-06).

| # | Method | Path | Auth | Mut. | Request | Response | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/cikgu/send` | S | yes | `{message: string, thread_id: string \| null}` | 200 `{thread_id, reply, tier, turns_remaining, tool_hops, tokens:{in, out}}` (BR-03…07) | 422 `{}` (blank message); 429 `{quota_exhausted: true}`; 401 `{}`; injected faults | POST `/cikgu/send` (JSON) |
| 2 | GET | `/api/cikgu/rph` | T | no | `page` | 200 `{data: [{id, lessonDate, subjectName, level, tajuk, status}], meta}` (own, BR-13) | 401, 403 | GET `/cikgu/rph?page=` |
| 3 | POST | `/api/cikgu/rph` | T | yes | `{subjectName, level, tajuk, className?, lessonDate, durationMinutes, timeSlot?, tema?, pengajaranKeperluan?}` | 201 `{data: Rph}` | 422 `VALIDATION_ERROR` (BR-12), 401, 403 | POST `/cikgu/rph` (form, `_token`) |
| 4 | GET | `/api/cikgu/rph/:id` | T | no | — | 200 `{data: Rph}` | 404 (foreign/unknown), 401, 403 | unknown (Q-M13-2) |
| 5 | GET | `/api/cikgu/essays` | T | no | `page` | 200 `{data: [{id, studentName, subjectName, rubricKey, essayTitle, marks, maxMarks, createdAt}], meta}` | 401, 403 | GET `/cikgu/essay?page=` |
| 6 | GET | `/api/cikgu/essays/:id` | T | no | — | 200 `{data: EssayMarking}` | 404, 401, 403 | unknown (Q-M13-2) |
| 7 | GET | `/api/cikgu/pbd` | T | no | `page` | 200 `{data: [{id, studentId, studentName, classroomId, sp, skor, tp}], meta}` (pending, own) | 401, 403 | GET `/cikgu/pbd?page=` |
| 8 | POST | `/api/cikgu/pbd/rollup` | T | yes | `{classroomId: int \| null}` | 200 `{data: {created, updated, skipped}}` (BR-15; all 0 when null/not own) | 401, 403 | POST `/cikgu/pbd/rollup` (form) |
| 9 | POST | `/api/cikgu/pbd/bulk-approve` | T | yes | `{ids: int[]}` | 200 `{data: {approved}}` (BR-16) | 401, 403 | POST `/cikgu/pbd/bulk-approve` (form) |
| 10 | GET | `/api/cikgu/pbd/export.csv` | T | no | — | 200 `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="pbd-approved.csv"` (BR-17) | 401, 403 | GET `/cikgu/pbd/export.csv` (not opened) |
| 11 | GET | `/api/guru/classes` | M10 #12 (referenced) | no | — | own classes (admin `[]`) | 401 | server-rendered options |
| 12 | GET | `/api/subjects` | M03 #28 (referenced) | no | — | 31 active subjects | 401 | `datalist#subject-list` |

The page route `/cikgu/pbd/export.csv` triggers a download of #10 (no page render).

---

## 8. States & messages

### 8.1 Observed copy (exact)

| Screen | State | Copy |
|---|---|---|
| S1 | page | "CA", "Cikgu Alesa", "Guru maya · Powered by … + 50K+ soalan DSKP" (names per DV-M13-12), "Cikgu Alesa:", greeting, "🎙️ Voice Mode:", "Cikgu jawab dengan suara (auto)", "🎤", placeholder "Taip atau tekan 🎤 untuk cakap…", "Hantar" |
| S1 | chat script | "Anda", "Cikgu Alesa", "Cikgu Alesa sedang berfikir…", "(tiada respon)", "Tier: … · Turns remaining: … · Tool hops: … · Tokens: in=… out=…", "Cikgu Alesa tak boleh respon. Cuba lagi.", "Quota habis untuk hari ni.", "Ralat sambungan. Cuba lagi sebentar." |
| S1 | voice script | "Mendengar...", "Maaf, tak dengar.", "Browser tidak sokong voice — guna Chrome/Edge", "🔴" (all reproduced by the simulated recogniser) |
| S2 | | "📋 Rancangan Pengajaran Harian (RPH)", "RPH yang dijana oleh Cikgu Alesa atau cikgu sendiri.", "Jana RPH Baharu", headers, empty row with the example prompt, pager "Showing 0 of 0 results", "« Previous", "Next »" |
| S3 | | "← Senarai RPH", "Jana RPH dengan Cikgu Alesa", "Sistem belum jumpa kelas yang dikaitkan dengan akaun Cikgu. Sila isi manual.", labels, placeholders, level options, info box, "Batal", "⏱️ Proses ambil masa 10-30 saat. Sila tunggu.", busy "Cikgu Alesa sedang jana RPH…" |
| S4 | | "📝 Marking Karangan AI", "Karangan yang dimark oleh Cikgu Alesa berdasarkan rubric SPM/PT3.", "Mark Karangan Baharu", headers, empty row |
| S5 | | "← Senarai", "📝 Mark Karangan Baharu", intro, labels, 6 rubric labels, placeholders, "{n} perkataan", amber box, "Hantar ke Cikgu Alesa", "Batal", alert "Karangan terlalu pendek (minimum 50 aksara)." |
| S6 | | "📊 PBD Auto-Tag — Antrian Semakan", sub-line, "Pilih kelas untuk rollup", "Jalankan Auto-Tag", "Eksport CSV (Approved)", "Pilih semua", "Lulus pukal (TP cadangan)", headers, empty row |
| S7/S8 | | M01 404 page (URS FN-M13-1.2.3) |

### 8.2 PROPOSED COPY and PROPOSED layouts (report at G1; URS OQ-M13-09)

| Where | Text / layout | Basis |
|---|---|---|
| S1 sub-line names | "Cikgu Nur Demo · Cikgu Amin Demo · Cikgu Siti Demo" | privacy rule (DV-M13-12) |
| S1 hand-off message | BR-M13-08 template | DV-M13-01 |
| Mic title | "Tekan untuk cakap" | DV-M13-05 |
| Simulated transcript | interim "Terangkan pecahan", final "Terangkan pecahan setara dengan contoh" (600 / 1,200 ms) | OQ-M13-08 decision (simulated recogniser) |
| Simulated speaker | status "🔊 Cikgu sedang bercakap…", 60 ms per character, 1.5–8 s, no audio | DV-M13-02, D4 |
| General reply | "Soalan yang baik! Ini penerangan ringkas:\n1. Mulakan dengan konsep asas dan satu contoh mudah.\n2. Kaitkan konsep itu dengan pengalaman harian murid.\n3. Akhiri dengan 2–3 soalan semakan kefahaman.\nNak saya sediakan latihan soalan untuk topik ini?" | greeting ("Cuba tanya pasal subjek tertentu") |
| Practice reply | "Ini 3 soalan latihan ringkas:\n1. Nyatakan maksud konsep utama topik ini.\n2. Berikan satu contoh konsep ini dalam kehidupan harian.\n3. Terangkan perbezaan antara dua konsep yang berkaitan.\nCuba jawab dahulu, kemudian hantar jawapan untuk saya semak." | greeting ("minta latihan soalan") |
| RPH confirmation | "Siap! RPH \"{tajuk}\" ({subject}, {level label}) untuk {dd/mm/yyyy} telah dijana dan disimpan dalam senarai RPH." | S2 copy |
| RPH follow-up | "Boleh nyatakan subjek, tingkatan/tahun dan tajuk? Contoh: \"Tolong jana RPH untuk Matematik T4 Bab 3 esok\"." | S2 example prompt |
| Marking reply / comment | "Markah: {m}/{max}\nRubric: {label}\nKomen membina:\n1. Isi: idea utama jelas; tambah satu contoh untuk setiap isi.\n2. Bahasa: ayat gramatis; kurangkan pengulangan perkataan.\n3. Cadangan: kukuhkan penutup dengan rumusan yang merujuk tajuk." | S5 amber box ("markah + komen membina") |
| RPH content | BR-M13-11; objectives "1. Menyatakan konsep utama {tajuk} dengan betul.", "2. Menerangkan {tajuk} dengan contoh yang sesuai.", "3. Menyelesaikan sekurang-kurangnya 3 daripada 4 soalan berkaitan {tajuk}."; "BBM: buku teks, lembaran kerja, slaid ringkas"; "EMK: kreativiti dan inovasi"; "PBD Assessment plan: pemerhatian semasa Aktiviti 2 dan lembaran kerja (TP1–TP6)" | S3 info box |
| Status label / row link | "Dijana" / "Lihat" | page copy "dijana oleh Cikgu Alesa" |
| V1 / V2 | reuse list h1 and column labels as field labels, content block `whitespace-pre-line` | observed labels |
| S3 class select | label "Kelas Saya", first option "— Pilih —" | observed labels (M10 menu, S3 level select) |
| S6 row | SP labels, "{x.x}%", "TP{n}", Tindakan "-" | Q-M13-4 |
| Export | BR-M13-17 | Q-M13-4 |
| Tiers | `admin`, `guru`, `pelajar`; 100 / 30 / 10 | Q-M13-5 |

### 8.3 Loading and errors

- S1: the live busy meta and disabled "Hantar" (FR-18); error texts of FR-20.
- S3: the live busy label (FR-45); a 422 or 5xx from #3 re-enables the button and shows the M01 global error convention (no M13 copy exists).
- Lists, views, S6 operations: shared shell loading state; failures use the M01 global error convention; no flash message after rollup or bulk approval (UNVERIFIED on live).

---

## 9. Permissions matrix

| Role | S1 chat (#1) | S2/S3/V1 RPH (#2–#4) | S4/S5/V2 essay (#5, #6) | S6 PBD (#7–#10) | Records visible | Notes |
|---|---|---|---|---|---|---|
| Admin | use; tier `admin` 100/day (PROPOSED) | use | use | use (no class → rollup does nothing) | own only (none seeded) | OBSERVED screens; quota PROPOSED |
| Guru | use; tier `guru` 30/day | use | use | use for own classes | own only | INFERRED (provisional) |
| Pelajar, Ibu Bapa, Penaja, Admin Sekolah, PPD, JPN | use; tier `pelajar` 10/day | → M01 landing / 403 | → M01 landing / 403 | → M01 landing / 403 | own chat only | INFERRED / UNVERIFIED (provisional) |
| Guest | → `/login` | → `/login` | → `/login` | → `/login` | — | INFERRED |

---

## 10. Responsive behaviour

Shell switch at 1024px (sidebar → drawer + bottom nav) per design/shells.md; at 768 the layouts are the mobile ones. Tables use NFR-RESP-05 (b): horizontal scroll inside their card; no sticky column. Control sizes replicate live (D10).

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | card full width minus padding; history 360–520px; one form row — mic 54×48, input shrinks (`min-width:0`), "Hantar" 92×48 fully visible (DV-M13-03); voice toolbar wraps | input ~521px; no change | input ~686px; card max 880px centred |
| S2 / S4 | header row not stacked (h1 3 lines, button label wraps); table scrolls inside its card (DV-M13-04); pager mobile variant | table fits; pager desktop variant from 640px | as 768 |
| S3 | one column; inputs full width; submit wraps (175×92), "Batal" 78×92 | 2/3/2-column rows | idem |
| S5 | one column; textarea ~298px; submit wraps (183×64) | 3 + 2 columns | idem |
| S6 | toolbar three stacked rows without vertical gap (as live); "Lulus pukal (TP cadangan)" wraps (197×52); table scrolls inside its card | toolbar one row; table fits | idem |
| V1 / V2 | labelled values stacked; content wraps | idem | idem |
| S7 / S8 | centred 404 card | idem | idem |

---

## 11. Non-functional requirements

| ID | Requirement | Global |
|---|---|---|
| NFR-M13-01 | Simulated AI and simulated voice only (D4): no AI request leaves the app; no `SpeechRecognition`, `webkitSpeechRecognition`, `getUserMedia` or `speechSynthesis` call is made (OQ-M13-08 closed); canned outputs are deterministic (BR-23). | D4, D11 |
| NFR-M13-02 | Privacy: fictitious names only; the real "Powered by" names never appear in code, fixtures, logs or screenshots; essays and student names in seeds are neutral dummy texts (SEC-M13-03). | NFR-05 |
| NFR-M13-03 | Output safety: every AI text (reply, RPH content, comment) is rendered as text with line breaks (no `v-html`, no Markdown). | NFR-04 |
| NFR-M13-04 | Accessibility replicates live (D10; FR-69). | NFR-02 |
| NFR-M13-05 | Latency: AI endpoints 1,500 ms by default (BR-22) so the busy states are observable; E2E set 0–800 ms as needed. | NFR-01 |
| NFR-M13-06 | Locale: dates `dd/mm/yyyy`, Asia/Kuala_Lumpur; the quota day boundary uses the same zone. | NFR-08 |
| NFR-M13-07 | Storage: `localStorage.cikgu_voice_mode` and `sessionStorage.cikgu_pending_essay` keep their live names; the latter is removed after S1 reads it. | — |

### 11.1 Security notes (backend phase)

| ID | Live risk (replicated with dummy data) | Backend requirement |
|---|---|---|
| SEC-M13-01 | **Prompt injection.** The chat message, the pasted essay, the RPH free-text fields (subject, tajuk, tema, keperluan) and the hand-off query values go straight into the AI prompt, and the model can call tools that write records (`mark_essay`, RPH). A crafted essay could steer marks or trigger other tools. | Separate system instructions from user content; treat pasted text as data; allow-list tools per screen (the essay flow may call only `mark_essay`); validate tool arguments server-side; cap output; log tool calls. |
| SEC-M13-02 | **Cost and quota abuse.** Limits are shown only after a reply; the input `maxlength` is client-side; the mic auto-submits any dictation longer than 5 characters through `dispatchEvent('submit')`, which bypasses the disabled "Hantar" and native validation, so a second turn can start while one is in flight (replicated); an error during dictation can still send the interim text; RPH generation (10–30 s) and rollup show no quota and no rate limit; the hand-off message is unbounded. | Enforce per-user daily quotas for every AI endpoint (chat, RPH, rollup), a server-side message and essay length cap, per-minute rate limits, idempotency on double submits, and cost monitoring per tier. |
| SEC-M13-03 | **Minors' essays and names sent to an AI provider.** Student essays and free-text student names are processed by a third-party model; the name travels in the URL (`?student=`, browser history, logs, referrer) and the essay sits in `sessionStorage`. | PDPA basis and notice; data-processing agreement with the provider; no training on submissions; pseudonymise student names before the AI call; move the hand-off out of the URL (POST or server draft); retention limits. |
| SEC-M13-04 | **CSV export of minors' assessment data** via a plain GET link (`/cikgu/pbd/export.csv`) with no confirmation. | Authorise and scope to the teacher's own classes; `Cache-Control: no-store`; audit log; neutralise spreadsheet formula injection (values starting with `=`, `+`, `-`, `@`). |
| SEC-M13-05 | **Bulk approval and rollup without confirmation**, accepting an empty class or an empty selection (DV-M13-11 replicated). | Validate that every id and class belongs to the teacher (IDOR), reject empty requests with a clear error, audit approvals, allow reversal. |
| SEC-M13-06 | **CSRF token in JSON calls.** The chat sends JSON with `X-CSRF-TOKEN` read from `meta[name=csrf-token]`; the forms send `_token`. | Verify the token on JSON endpoints too (not only form posts); require `Content-Type: application/json`; SameSite cookies; never accept the token from a query string. |
| SEC-M13-07 | **IDOR on records.** Detail routes are unknown; ids are sequential integers. | Scope every read/write to the owner and answer 404 (not 403) for foreign ids, as live does for ids 1/2. |
| SEC-M13-08 | **Client-supplied `thread_id`.** The client sends back any thread id it holds. | Verify thread ownership server-side; start a new thread otherwise. |
| SEC-M13-09 | **AI output rendering.** Replies are inserted as text today; any future Markdown/HTML rendering would open XSS. | Keep text rendering or sanitise with an allow-list renderer. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024, desktop 1280×800 (master SRS §10) unless a step is width-specific, in which case the step states the width and the scenario still runs on all three. Voice is the simulated recogniser/speaker (no browser speech API; `speechSynthesis` and `SpeechRecognition` are spied only to prove they are never called) and runs on the Playwright page clock; AI latency is set to 300 ms unless a step needs the busy state. **Provisional** = asserts INFERRED/PROPOSED/UNVERIFIED behaviour (canned content, teacher data, quotas, roles, export layout); tagged `@provisional` until OQ-M13-01 is answered.

| ID | Scenario | FR | AC | Provisional |
|---|---|---|---|---|
| E2E-M13-01 | Admin: sidebar (1280) groups and entries with icons, badges and targets; drawer (375, 768) entries and targets. | 01 | 01.1, 01.2 | |
| E2E-M13-02 | Active entries on `/cikgu/pbd` and on `/cikgu` (sidebar at 1280, drawer at 375). | 02 | 01.3 | |
| E2E-M13-03 | S1–S6 header titles with "Selamat datang kembali" and tab titles. | 03, 04 | 01.4 | |
| E2E-M13-04 | Bottom nav below 1024px (375, 768): Home, SPM, Game, Topik, Chat, Lagi; "Chat" opens the shell chatbot and the URL stays; at 1280 the bottom nav is hidden. | 05 | 01.5 | |
| E2E-M13-05 | Guest: `/cikgu`, `/cikgu/rph`, `/cikgu/essay/baharu`, `/cikgu/pbd` → `/login`. | 06 | 02.1 | yes |
| E2E-M13-06 | Admin: every 404 path of AC-02.2 incl. `/cikgu-alesa` shows the exact 404 page, "Mula Latihan" → `/practice`, tab title. | 08, 11 | 02.2 | |
| E2E-M13-07 | Admin: GET `/cikgu/send`, `/cikgu/pbd/rollup`, `/cikgu/pbd/bulk-approve` → 404 page, no "Oops! An Error Occurred". | 09 | 02.3 | |
| E2E-M13-08 | Admin: `/cikgu/rph/13101`, `/cikgu/essay/13201` → 404; #4/#6 return 404 for the admin. | 08, 48 | 02.4 | yes |
| E2E-M13-09 | `/cikgu/` → S1, `/cikgu/rph/` → S2; `?classroom_id=1` on S3 and S6 renders as without. | 10 | 02.5 | |
| E2E-M13-10 | `pelajar@demo.test`: `/cikgu` renders S1; `/cikgu/rph`, `/cikgu/essay`, `/cikgu/pbd` → M01 landing page; #2 → 403. | 07 | 02.6 | yes |
| E2E-M13-11 | Admin S1 default: avatar, h1, fictitious sub-line (and no other name), greeting, toolbar, mic, input placeholder/`required`/`maxlength`, "Hantar", empty meta, no tier text. | 12, 13, 14, 16 | 03.1 | |
| E2E-M13-12 | `cikguNextReply('Baris 1\n<b>x</b>')`: the appended body has a `<br>` and the literal text `<b>x</b>`; the history box `scrollTop` equals `scrollHeight − clientHeight` right after the append (instant). | 15 | 03.2 | |
| E2E-M13-13 | Teacher sends "Terangkan pecahan setara" (latency 800 ms): user message, cleared input, disabled "Hantar", busy meta; then the general reply, enabled "Hantar" with focus, hidden thread id set, meta "Tier: guru · Turns remaining: 27 · Tool hops: 0 · Tokens: in=126 out=…". | 16, 18, 19, 24, 25 | 04.1, 04.2 | yes |
| E2E-M13-14 | Second turn "Minta latihan soalan pecahan": request body carries the thread id (`lastRequest`), practice reply with 3 numbered lines, "Tool hops: 1", "Turns remaining: 26". | 18, 24, 25 | 04.3 | yes |
| E2E-M13-15 | Empty input + "Hantar" → invalid (`:invalid`, no request); "   " → no message, no request. | 17, 69 | 04.4 | |
| E2E-M13-16 | After a reply, reload: greeting only, empty input, next request `thread_id: null`. | 23 | 04.5 | |
| E2E-M13-17 | `cikguNextReply('')` → "Cikgu Alesa: (tiada respon)". | 19 | 04.6 | |
| E2E-M13-18 | `failNext` 500 `{"error":"Ralat ujian."}` → "Cikgu Alesa: Ralat ujian.", empty meta; 500 `{}` → fallback text. | 20 | 05.1, 05.2 | |
| E2E-M13-19 | `cikguSetTurnsUsed(5, 30)` → fallback text and meta "Quota habis untuk hari ni."; nothing stored. | 20, 26 | 05.3 | yes |
| E2E-M13-20 | `failNext('network')` → "Cikgu Alesa: Ralat sambungan. Cuba lagi sebentar.", "Hantar" enabled, input focused; a non-JSON 200 body → the same text. | 20 | 05.4 | |
| E2E-M13-21 | `setNow('2026-09-26T08:00:00+08:00')`, send → "Turns remaining: 29". | 26 | 05.5 | yes |
| E2E-M13-22 | `/cikgu?ask=Terangkan%20pecahan%20setara`: input value, focus, no request to #1. | 22 | 06.1 | |
| E2E-M13-23 | S5 hand-off with all fields (Sejarah rubric, Murid Demo 03) → exact URL `/cikgu?action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme`, pre-filled message with spaces, focus, no request, storage key removed; hand-off with the essay only → URL ends `&subject=&level=&student=&title=`, message without optional parts, default rubric label. | 21, 54 | 07.1, 07.2 | |
| E2E-M13-24 | `/cikgu?action=mark_essay&rubric=general` without storage → empty input. | 21 | 07.3 | |
| E2E-M13-25 | Send the AC-07.1 message → reply "Markah: 14/20", rubric line, 3 comments, "Tool hops: 1"; `/cikgu/essay` first row Murid Demo 03 … 14/20. | 27, 50 | 07.4 | yes |
| E2E-M13-26 | Voice switch unchecked by default; tick → reload → checked, storage '1'; untick → '0'. | 29 | 08.1 | |
| E2E-M13-27 | Switch on: a 2xx reply longer than 10 characters → status "🔊 Cikgu sedang bercakap…", cleared after the simulated duration (page clock); `cikguSpoken()` holds that reply once; a second reply within the duration restarts it; `cikguNextReply('Ok')` (2 characters), "(tiada respon)", error and network messages and the greeting → nothing spoken; switch off → nothing; `speechSynthesis.speak` spy never called. | 30 | 08.2 | |
| E2E-M13-28 | Without hooks the mic is enabled; `cikguVoice({supported:false})` → mic disabled, title "Browser tidak sokong voice — guna Chrome/Edge", opacity 0.4. | 31 | 09.1 | |
| E2E-M13-29 | Simulated recogniser (page clock): click → "🔴", `#fee2e2`, "Mendengar..."; +600 ms input "Terangkan pecahan"; +1,200 ms "Terangkan pecahan setara dengan contoh", end → "🎤", empty status, one request to #1; second click after the interim → sent with "Terangkan pecahan"; `cikguVoiceError()` with an empty input → "Maaf, tak dengar." then empty status, no request; error after the interim → interim text sent; dictation ending while a turn is in flight (latency 2 s) → a second request although "Hantar" is disabled; no `SpeechRecognition` constructor called (spy). | 32 | 09.2, 09.3 | |
| E2E-M13-30 | Mic enabled → title "Tekan untuk cakap". | 33 | 09.4 | |
| E2E-M13-31 | Admin S2: h1, sub, button target, headers upper case by CSS, empty row with `<em>` example, no pager; `?page=2` desktop (≥640) and mobile (<640) pager variants and targets. | 34, 35, 37, 10 | 10.1, 10.2 | |
| E2E-M13-32 | Teacher S2: rows 13101 then 13102 with the values of AC-10.3 and "Lihat" targets. | 36 | 10.3 | yes |
| E2E-M13-33 | Admin S3: back link, h1, no-class sentence, nine fields (labels, placeholders, attributes, level options/values, datalist of 31 in order, free text accepted), Tarikh 2026-09-25, Tempoh 60, maxlength truncation, info box and note. | 38, 40, 41 | 11.1, 11.2, 11.3, 11.4, 11.5 | |
| E2E-M13-34 | S3 "Batal" → `/cikgu/rph` without confirm, fields reset on return; column layout per width (1 at 375; rows at 768/1280). | 42, 43 | 11.6, 11.7 | |
| E2E-M13-35 | S3 empty submit → three `:invalid` fields, no request; Tempoh 10 → invalid, no request. | 44 | 12.1 | |
| E2E-M13-36 | Teacher generates "Matematik / Tingkatan 4 / Pecahan Setara" (latency 800 ms): busy label + disabled + `opacity-60`; then V1 with id ≥ 9,000,001, values, content sections and minutes 6/15/15/15/9; S2 lists 13101, the new RPH, 13102 in that order; with "Keperluan Khas" the content ends with it. | 45, 46, 47 | 12.2, 12.3, 12.4 | yes |
| E2E-M13-37 | Teacher S3: no no-class sentence; "Kelas Saya" options; choosing 2001 fills Kimia / Tingkatan 5 / "5 MARIKH - Kimia". | 39 | 13.1 | yes |
| E2E-M13-38 | Teacher chat "Tolong jana RPH untuk Matematik T4 Bab 3 esok" → confirmation, "Tool hops: 1", S2 rows 13101 (28/09), the new 26/09/2026 Matematik / T4 Bab 3, 13102 (25/09); "Tolong jana RPH" → follow-up, "Tool hops: 0", no new row. | 28 | 14.1, 14.2 | yes |
| E2E-M13-39 | Teacher V1 13101 and V2 13201 content; `/cikgu/rph/13101/print`, `/cikgu/rph/abc`, `/cikgu/essay/99999999` → 404. | 47, 48, 56 | 15.1, 15.2, 15.3 | yes |
| E2E-M13-40 | Admin S4: h1, sub, button, headers upper case by CSS, empty row; `?page=2` pager. | 49, 37 | 16.1 | |
| E2E-M13-41 | Teacher S4: two rows 13202 then 13201 with values, "Markah" centred, "Lihat" targets. | 50 | 16.2 | yes |
| E2E-M13-42 | S5 default: all labels, placeholders, 6 rubric options in order with the first selected and "Rubric Am (default) (100 markah)" last, no `name` attributes, amber box, buttons and targets. | 51, 53 | 17.1, 17.5 | |
| E2E-M13-43 | Counter "5 perkataan" / "2 perkataan"; 49 characters → alert text, stays; 50 characters → hand-off URL. | 52, 54, 69 | 17.2, 17.3 | |
| E2E-M13-44 | Enter in "Subjek" → no navigation; "Batal" → `/cikgu/essay` without confirm; reload resets rubric and counter. | 55 | 17.4 | |
| E2E-M13-45 | Admin S6: h1, sub, select with placeholder only, buttons, export href, headers upper case by CSS, empty row. | 57, 58, 59, 63 | 18.1 | |
| E2E-M13-46 | Teacher S6: select options; 9 pending rows in order with SP, skor and TP of AC-18.3; Tindakan "-". | 58, 64, 70 | 18.3 | yes |
| E2E-M13-47 | Teacher rollup 2001 after the M05 hook `addAnswer({userId: 3008, questionId: 700001, isCorrect: true})` (XR-M13-03b) → Murid Demo 08 "22.2%" "TP2", still 9 rows, no dialog/message; rollup 2002 → no pending row for Murid Demo 01/02, one for 03. | 65, 70 | 18.4, 18.5 | yes |
| E2E-M13-48 | Teacher: a real click on "Pilih semua" ticks all 9 rows, a second click clears them; tick Murid Demo 01 and 02 (Kimia) → "Lulus pukal (TP cadangan)" → no dialog, 7 rows, "Pilih semua" unticked; nothing ticked → unchanged. | 61, 62, 66 | 19.1, 19.2, 19.3 | yes |
| E2E-M13-49 | S6 DOM: `#bulk-form` has no descendant `form`; every `.row-check` has `form === #bulk-form` (teacher and admin). | 60 | 19.4 | |
| E2E-M13-50 | Teacher export: download named `pbd-approved.csv`, header and two lines (13309, 13310); admin export: header only. | 59, 67 | 20.1, 20.2 | yes |
| E2E-M13-51 | Responsive sweep: every screen (S1–S8, V1, V2) at 375/768/1280 has `scrollWidth` ≤ viewport; S1 "Hantar" right edge inside the card at 375; S2/S4/S6 table containers scroll (`scrollWidth` > `clientWidth` at 375) and "TINDAKAN" becomes visible after scrolling; S6 toolbar rows at 375 vs one row at 768; no added ARIA roles on M13 controls. | 68, 69 | 21.1, 21.2, 21.3, 21.4 | |
| E2E-M13-52 | Admin S6: "Jalankan Auto-Tag" with the placeholder → no dialog (dialog listener never fires); after the call the queue is still empty and no message shows. | 58, 65 | 18.2 | yes |

Provisional: E2E-M13-05, 08, 10, 13, 14, 19, 21, 25, 32, 36, 37, 38, 39, 41, 46, 47, 48, 50, 52 (19 of 52)

---

## 13. Open questions

URS §9 OQ-M13-01…10 apply unchanged. Additional SRS points:

1. **SQ-M13-01 Raw-body transport for #1 (XR-M13-05) — request to the architecture.** The shared ApiClient unwraps `{data, meta}` and maps `{error:{code,message}}` (architecture C8). #1 keeps the live body (no envelope, snake_case, `error` as a string), so the chat page calls it through a documented raw-body ApiClient method (no unwrap, no error mapping, global 401 policy kept). Open until the architecture adds the method and the next XL review confirms the exception.
2. **SQ-M13-02 Owner acceptance of §6.10.** M25 (link), M10 (class fields), M05 (answer read), shell/M23 (menu, titles) — until accepted, S3 auto-fill, the S6 rollup and the M13 menu entries depend on those contracts (XL gate).
3. **SQ-M13-03 SP labels.** SP "5.1.1" / "1.1.1" are illustrative; the DSKP store is owned by M10 (only Bahasa Melayu seeded). If M10 later seeds Kimia/Sejarah DSKP, the rollup should cite a real SP from it.
