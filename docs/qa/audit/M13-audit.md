# M13 — Cikgu Alesa (AI Teacher Assistant) — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M13-cikgu-alesa.md` v1.0, `docs/requirements/srs/M13-cikgu-alesa.md` v1.0 |
| Evidence | discovery `M13-cikgu-alesa.md` (§1–§9, D-M13-1…11, AI-1…10), `inventory/M13/*.json` (+ `_summary.md`, `_crawl.json`), `img/M13/`; live re-walk on 2026-09-26 (browser lane 3, admin account, read-only). No chat message was sent. The mic, "Jana RPH", "Hantar ke Cikgu Alesa", "Jalankan Auto-Tag" and "Lulus pukal" were never clicked, and the CSV link was never opened. GETs were throttled to 350 ms or more. Page scripts were read with `document.scripts`. Every screenshot was masked with `tools/sanitize.js` and a structural "Powered by" mask. |
| Cross-module docs | M10 v1.2 (`/api/guru/classes` #12, classes 2001/2002, DV-M10-01, DV-M10-26), M08 v1.4 (§6.10 designed students 3001–3008 and their answers), M05 v1.5 (hooks, clock), M01 (canonical accounts), M03, `docs/design/shells.md` (DV-SH-03, DV-SH-04), `docs/architecture/overview.md` (C8 envelope) |
| Auditor | independent audit agent (not an author) |
| Screenshots | `docs/qa/audit/img/M13/` (all masked): `aud-chat-1280.png`, `aud-chat-375.png` (page overflow 408 px, "Hantar" cut off), `aud-cikgu-rph-375.png`, `aud-cikgu-essay-375.png`, `aud-cikgu-pbd-375.png` (tables clipped inside `overflow-hidden` cards) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 3 |
| Minor | 10 |
| Info | 3 |

What is good:
- **Coverage is complete.**
  - The 137/137 content elements and the 27 M13-relevant shell elements are all mapped.
  - The 18 exclusions are exactly the M16 tournament-banner triplets "LIVE:" / "MAIN" / "DAFTAR" (EL-M13-S1…S6-001–003).
  - I re-ran `tools/inventory.js` on S1, S5 and S6 and got the same element lists: S1 16, S5 24 by default (+4 typed states = 28), S6 16 (+6 pager elements = 22).
  - All 25 sampled mappings are correct.
- **Traceability is clean when checked by script.**
  - Counts: 103 FN, 77 AC, 70 FR and 51 E2E.
  - There is no FN without an FR, no AC without an FR, no AC without an E2E and no FR without an E2E.
  - Exactly 17 E2E are marked provisional, and the set matches the provisional ACs one-to-one.
  - Every E2E runs at 375, 768 and 1280.
- **The live copy and attributes are exact.** 52 claims match the live page and its source (list below). These include:
  - the chat contract and every chat, voice, RPH and essay string;
  - the 6 rubrics and their marks, the 50-character rule on trimmed text and the word counter;
  - the S3 fields, constraints, defaults and info box;
  - the S6 forms, the export target, the 404 and 405 pages, the tab titles and the stale "Dashboard" header.
- **Every AI output is labelled PROPOSED/provisional.** No canned text is presented as OBSERVED.
- **The seeds are sound.**
  - The admin mirror is empty, as on live.
  - The teacher PBD scores recompute exactly from the M08 v1.4 answer table.
  - No real name appears, and the ids 13101–13599 do not collide with any other module.

Why it fails (3 Major):
1. **Voice input is not simulated (AUD-M13-01).** The docs keep the real browser `SpeechRecognition`. This contradicts the settled Delivery Lead decision OQ-M13-08 (simulated, canned transcript, D4), and OQ-M13-08 is still written as open.
2. **The essay hand-off URL does not match live (AUD-M13-02).** Live builds the URL with `URLSearchParams`, so spaces become `+` and all six parameters are always present. The docs specify `encodeURIComponent` and assert `%20` in AC-07.1.
3. **RPH list order contradicts itself (AUD-M13-03).** AC-12.3 and AC-14.1 (E2E-36 and E2E-38) say a newly generated RPH is listed first. But BR-M13-13 sorts by lesson date, newest first, and seed 13101 is dated 28/09/2026, so the new RPH (25/09 or 26/09) is second.

---

## Findings

| ID | Severity | Doc & section | Issue | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M13-01 | **Major** | URS FN-M13-2.4.4, 2.4.5, US-09 / AC-09.1–09.4, §8 row "real speech recognition quality", §9 OQ-M13-08; SRS FR-M13-31/32, BR-M13-20, NFR-M13-01, §6.9 `cikguSpeech`, §12 E2E-28–30 | The docs specify dictation through the browser's real `SpeechRecognition`/`webkitSpeechRecognition`. NFR-M13-01 says "Browser speech APIs are used as live", and OQ-M13-08 is still an open option. The Delivery Lead has **settled** OQ-M13-08: voice input is **simulated** in the prototype with a canned transcript, with no Web Speech API and no cloud recogniser (D4). The mic UI and tooltip are still replicated. As written, the prototype would send microphone audio to the browser vendor's cloud service. The E2E stubs only hide this. The "not supported" branch (FR-31) also needs a defined role once the recogniser is simulated. | Live source (`VoiceMode.init`): `const SR = window.SpeechRecognition \|\| window.webkitSpeechRecognition; … new SR(); lang='ms-MY'; interimResults=true; continuous=false` (read-only, not clicked). | Specify one simulated recogniser. <br>• A mic click shows "🔴" on `#fee2e2` and "Mendengar...", then emits a PROPOSED canned interim/final transcript into the input, then ends, and auto-submits when the input is longer than 5 characters, as live. <br>• A second click stops it. <br>• An error path is triggered only by a test hook. <br>• The mic is always "supported" in the prototype. The "Browser tidak sokong voice — guna Chrome/Edge" state stays specified (SOURCE-DERIVED) but is reachable only through a hook. <br>• No `SpeechRecognition` is instantiated. <br>• Record the decision in URS §9 as closed ("OQ-M13-08 decided: simulated, D4") and in NFR-M13-01. Add the canned transcript to OQ-M13-09 / SRS §8.2 as PROPOSED COPY. <br>• Adjust FR-31/32, BR-20, §6.9 and E2E-28–30. |
| AUD-M13-02 | **Major** | URS FN-M13-4.2.11, AC-M13-07.1; SRS FR-M13-54, E2E-23 | FR-54 says each value is `encodeURIComponent`-encoded, and AC-07.1 asserts `…&student=Murid%20Demo%2003&title=Semangat%20Patriotisme`. Live instead builds the URL with `new URLSearchParams({action, rubric, subject, level, student, title}).toString()`. That encoding (`application/x-www-form-urlencoded`) differs in two ways: <br>• spaces become `+`, and `!'()~` are percent-encoded; <br>• **all six keys are always present, even when empty** (`&subject=&level=…`). <br>The AC's exact-URL assertion would fail against the live behaviour, and the builder would replicate the wrong address. | S5 source: `const params = new URLSearchParams({ action: 'mark_essay', rubric: rubric, subject: subject, level: level, student: student, title: title }); sessionStorage.setItem('cikgu_pending_essay', text); window.location.href = 'https://prestasiplus.my/cikgu?' + params.toString();` | FR-54: "navigate to `/cikgu?` + `URLSearchParams({action:'mark_essay', rubric, subject, level, student, title})` (form encoding; every key present, empty values kept)". <br>AC-07.1: `/cikgu?action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme`. <br>AC-07.2: also assert the empty keys. <br>S1 must decode `+` as a space (it does if it reads with `URLSearchParams.get`); state this in FR-21. |
| AUD-M13-03 | **Major** | URS AC-M13-12.3 ("`/cikgu/rph` lists it first"), AC-M13-14.1 ("lists "26/09/2026 · Matematik / T4 · Bab 3 · Dijana" first"); SRS BR-M13-13, §6.8.3, E2E-36, E2E-38 | BR-M13-13 orders RPHs by `lessonDate` desc, then id desc. Seed 13101 has lesson date 2026-09-28. <br>• The form-generated RPH of AC-12.3 has Tarikh 25/09/2026, so it sorts after 13101 (and before 13102 only through the id tie-break). <br>• The chat RPH of AC-14.1 is dated 26/09/2026, so it is also second. <br>Both ACs and their E2E assert "first", which contradicts the doc's own rule and seed. The provisional E2E would fail. | — (internal contradiction; S2 is empty for the admin on live) | Pick one rule and make everything agree. Either: <br>• keep BR-13 and change AC-12.3 / AC-14.1 / E2E-36 / E2E-38 to "second row, after 13101 (28/09/2026)"; or <br>• change BR-13 to creation order (newest first), which would make them first, and re-check AC-10.3 (13101 was created after 13102 in the seed, so the order 13101 → 13102 still holds). <br>Record the choice in OQ-M13-06. |
| AUD-M13-04 | Minor | URS FN-M13-1.1.1, 1.1.3, AC-M13-01.1, 01.2; SRS FR-M13-01 | The menu labels are written as "**Cikgu Alesa Chat AI**" + badge "AI" and "**Cikgu Alesa AI**" + badge "AI". In the DOM, the label spans are "Cikgu Alesa Chat" and "Cikgu Alesa", and "AI" is a separate badge (`text-[8px]` gradient pill). A builder following the doc would render "Cikgu Alesa Chat AI [AI]". There are also icon differences: <br>• the drawer "Cikgu Alesa" icon is `fa-robot text-purple-500`, while the sidebar icon has no colour class; <br>• the sidebar "PBD Auto-Tag" loses `text-blue-500` when active. <br>(The inventory text concatenates label and badge, which is the source of the error.) | `a[href$="/cikgu"]` innerHTML: `<span class="text-sm font-semibold">Cikgu Alesa Chat</span> <span class="ml-auto text-[8px] … rounded-full font-bold">AI</span>`; `<span class="font-semibold">Cikgu Alesa</span> <span …>AI</span>`; drawer `<i class="fas fa-robot … text-purple-500">`. | State the labels as "Cikgu Alesa Chat" and "Cikgu Alesa", each followed by the badge "AI" (8 px pill, gradient purple-500 → pink-500, replicated per D10). Add the drawer icon colour. |
| AUD-M13-05 | Minor | URS FN-M13-5.2.2; SRS FR-M13-61 | The docs say `#select-all` works through `onchange`. On live it is an **`onclick`** attribute: `document.querySelectorAll('.row-check').forEach(c => c.checked = this.checked)`. The query is document-wide, not scoped to the form. The visible effect is the same for a click or Space, but a programmatic `change` event (E2E) would not tick the rows on live. | S6 DOM: `INPUT:onclick="document.querySelectorAll('.row-check').forEach(c => c.checked = this.checked)"`. | Write "on click". The E2E should toggle with a real click. |
| AUD-M13-06 | Minor | URS FN-M13-2.4.5, AC-M13-09.3; SRS FR-M13-32 | The docs flatten the live source sequence in two ways: <br>• In Chrome, `onerror` is always followed by `onend`. `onerror` sets "Maaf, tak dengar.", then `onend` clears the status and, if the input already holds more than 5 characters (interim text), **auto-submits**. So "Maaf, tak dengar." is only transient, and an error can still send the interim text. <br>• The auto-submit is `form.dispatchEvent(new Event('submit'))`. It bypasses the disabled "Hantar" state and native validation, so it can fire a second turn while one is in flight. FR-18's "while disabled, Enter SHALL not submit" does not cover it. <br>These rules matter for the simulated recogniser (AUD-M13-01). | Voice source: `onerror = () => { mic.textContent='🎤'; …; status.textContent='Maaf, tak dengar.'; this.recognition=null; }`; `onend = () => { …; status.textContent=''; …; if (input.value.trim().length > 5) form.dispatchEvent(new Event('submit', {cancelable:true, bubbles:true})); }`. | Specify the simulated error sequence exactly: error → the status shows "Maaf, tak dengar." → end → the status is cleared, plus the auto-submit rule. <br>State that the auto-submit goes through the submit handler even while a send is pending (replicated live behaviour; list it under SEC-M13-02), or record a D9 decision. Update AC-09.3. |
| AUD-M13-07 | Minor | URS DV-M13-02, FN-M13-2.4.3, AC-08.2; SRS FR-M13-30, NFR-M13-01 | DV-02 itself is acceptable under D9. The switch "Cikgu jawab dengan suara (auto)" is a persisted control that does nothing, and the fix wires the page's own `VoiceMode.speak()` without new copy. Two points are still open: <br>• **Scope.** The live observer (never active) would only speak nodes marked as assistant replies with text longer than 10 characters. The DV speaks "each bot message", which includes the error and fallback messages. `speak()` also cancels a still-speaking utterance, and that behaviour is not specified. <br>• **The "local browser feature, not an AI service; D4 unaffected" claim is stated as fact.** Chrome's `speechSynthesis` may use network voices (`localService: false`), so reply text can leave the device. That is the same concern that settled OQ-M13-08 for input. | `speak(text) { if (!this.enabled \|\| !window.speechSynthesis) return; if (this.speaking) speechSynthesis.cancel(); … u.lang='ms-MY'; u.rate=0.95; u.pitch=1.0; … }`; observer on `#cikgu-messages` / `.chat-messages, #chat-messages` with `classList.contains('assistant') … text.length > 10`. | State which bot messages are spoken (recommended: `append('bot', …)` for successful replies only, with length > 10 as the live heuristic) and the cancel-previous rule. <br>Replace the "local feature" claim with a rule: use only a `localService` voice for `ms-MY`, or speak nothing when none exists. Alternatively, simulate TTS consistently with OQ-M13-08. Let the Delivery Lead confirm. |
| AUD-M13-08 | Minor | URS FN-M13-2.1.5, §3 "Source"; SRS FR-M13-15, E2E-12 | "The box scrolls to the newest message" is labelled **INFERRED**. It is SOURCE-DERIVED: `append()` ends with `history.scrollTop = history.scrollHeight;`. The rule was observable in the source and was mislabelled (an M11 audit lesson). | S1 source: `history.appendChild(wrap); history.scrollTop = history.scrollHeight;` | Relabel as SOURCE-DERIVED. Specify it as "set `scrollTop` to `scrollHeight` (instant, not smooth)". |
| AUD-M13-09 | Minor | URS AC-M13-18.2, AC-M13-02.4; SRS FR-M13-65, E2E-45, E2E-08 | These non-provisional ACs and E2E assert behaviour that was never observed: <br>• AC-18.2 / E2E-45: "Jalankan Auto-Tag" with the placeholder → "the page reloads with the same empty queue and no message". The server's response to `classroom_id=''` is unknown (discovery §5.7 "unknown"; FR-65 itself says "(provisional)"). <br>• AC-02.4 / E2E-08: the admin opening teacher record 13101/13201 → 404 relies on the INFERRED ownership rule. Live only shows ids 1/2 → 404, whose cause is unknown (Q-M13-2). | Discovery §5.7, §1 (ids 1/2 → 404 cause unknown). | Tag AC-18.2 (the step after the click) and AC-02.4 as provisional, or split the observed parts (no confirm dialog; empty queue before the click) from the unobserved result. Update the provisional count (17 → 19). |
| AUD-M13-10 | Minor | SRS §6.9 (AC-M13-18.4 via "the existing M05 hook `addSessions`"), E2E-47, XR-M13-03 | M05 defines `mock.addSessions(userId, n)` as a **pager** hook that adds n sessions. It gives no control over subject, question or correctness. So it cannot add "one correct Kimia answer for student 3008", and the AC-18.4 expectation of 2/9 = 22.2% depends on it. | M05 SRS §NFR-M05-02 / hooks list: `mock.addSessions(userId, n)` (pager test). | Add a request to M05 (e.g. XR-M13-03b): a test hook `mock.addAnswer({userId, questionId, isCorrect, answeredAt})` written through the M05 contract, using a Kimia anchor (e.g. 700001). Cite it in §6.9 and E2E-47. |
| AUD-M13-11 | Minor | URS §0 "Related" and SRS §0 "Related" / §6.1 / BR-M13-18 | The docs cite **M10 v1.1**. The current M10 is **v1.2**; no field change affects M13, but the reference is stale. XR-M13-02 asks M10 to "expose `subjectName` and `educationLevel`". M10 #12 already returns `Classroom + {subjectName, levelLabel, studentCount}`, and `educationLevel` is a Classroom field (`tahun-n`/`tingkatan-n`), so no request is needed. It should only be confirmed. | M10 SRS v1.2 line "12 \| GET \| `/api/guru/classes` … `{data:[Classroom + {subjectName, levelLabel, studentCount}], meta}`"; DATA `educationLevel` enum. | Update the references to M10 v1.2. Reword XR-M13-02 as "confirm (no change)". |
| AUD-M13-12 | Minor | SRS §7 decision on #1, XR-M13-05, SQ-M13-01 | The envelope and snake_case exception for `POST /api/cikgu/send` is justified partly by "a future backend is expected to keep the live contract", which is speculation. Architecture C8 has the shared ApiClient unwrap `{data, meta}` and map `{error:{code,message}}`. With #1 exempt, the ApiClient would pass `data.error` as an object (rendered as "[object Object]") unless #1 bypasses the client. The docs do not say how #1 is called (raw fetch or ApiClient bypass) or how the global 401 policy applies. | `docs/architecture/overview.md` C8 and the ApiClient "envelope unwrap, ApiError, 401 policy". | Keep SQ-M13-01 open for the XL/architecture review, but specify the mechanism: #1 is called through a raw-body ApiClient option (no unwrap, no error mapping), and a 401 follows the global 401 policy. Drop the speculative justification and keep "the replicated client handler reads the live shape". |
| AUD-M13-13 | Minor | URS FN-M13-1.1.3 ("Order and positions per the shell's single menu definition (DV-SH-04)") vs AC-M13-01.2 | Two statements conflict: <br>• FN-1.1.3 says M13 entries follow the single menu definition (DV-SH-04: sidebar and drawer render from **one** list). <br>• AC-01.2 asserts the live drawer, which has its own labels ("RPH" vs "RPH (Rancangan Harian)") and its own order (the "Cikgu Alesa Tools" items **before** the "🤖 Cikgu Alesa AI" items, the reverse of the sidebar). <br>Both cannot hold. M10 kept the live drawer as captured, so M13 matches that precedent, but the doc must say which rule applies. | Live DOM order at 375: drawer-nav-items "Cikgu Alesa AI", "RPH", "PBD Auto-Tag", "Mark Karangan", then "Cikgu Alesa Chat AI", "RPH (Cikgu Alesa)", "Semak Karangan (Cikgu Alesa)", "PBD (Cikgu Alesa)"; sidebar at 1280 has the reverse group order. | Either state that the drawer replicates the live capture (shells.md §6 rule 4, "until the module reaches design") and remove the DV-SH-04 wording from FN-1.1.3, or declare the entries once for the single list and change AC-01.2 to match the sidebar. Raise it for the shell/M23 owner. |
| AUD-M13-14 | Info | URS DV-M13-12 | The fictitious "Powered by" names were checked in the page, without writing any real name: none of their tokens ("Nur", "Amin", "Siti") matches a token of the three real names, and the structure "Guru maya · Powered by … · … · … + 50K+ soalan DSKP" is identical. OK. | In-page comparison (boolean result only). | — |
| AUD-M13-15 | Info | URS DV-M13-01 | The source intent supports "pre-fill, don't send". The S5 intro reads: "Klik **Hantar ke Cikgu Alesa** akan buka chat dengan prompt siap-siap untuk submit." The amber box reads: "butiran karangan akan auto-isi dalam mesej". S1's only pre-fill script (`applyPrefill`) reads `ask`, focuses and scrolls, and never submits. <br>Note for the builder: the hand-off message is set programmatically, so the input's `maxlength=4000` does not truncate or invalidate it (`tooLong` only applies to user edits). SRS DATA-M13-02 already notes this. | S5 intro text and S1 `applyPrefill()` (live). | — |
| AUD-M13-16 | Info | Rejected DV-06, DV-09, DV-11 | All three rejections are sound: <br>• **DV-06:** the word counter and the character rule are each labelled with their own unit, and the dead `required minlength=50` never shows anything. <br>• **DV-09:** the English pager is kept consistently in M02, M09 and M10. <br>• **DV-11:** no confirm dialog is a working live behaviour; a confirm would be new copy. <br>The other deviations check out: <br>• **DV-03, DV-04:** measured on live (408 px; tables end at 430 / 447 / 408 px inside `overflow-hidden` cards at 375). <br>• **DV-05:** the live tooltip "Tekan dan tahan untuk cakap" is confirmed, and the source toggles on click, so the tooltip is a wrong label and the minimal deletion is fine. <br>• **DV-08:** follows DV-SH-03 and the DV-M10-01 pattern (page h1, subtitle "Selamat datang kembali" kept; M13 is registered through XR-M13-04). <br>• **DV-10:** matches DV-M10-26. | Live measurements and source above. | — |

---

## Coverage spot-check (25 elements, all correct)

EL-M13-S1-001 (M16 exclusion), S1-004 "CA", S1-005, S1-006 (sub-line, masked), S1-009 "🎙️ Voice Mode:", S1-011 checkbox, S1-013 hidden thread id, S1-014 "🎤", S1-015 input, S1-016 "Hantar"; S2-006 "Jana RPH Baharu" → `/cikgu/rph/baharu` `fa-robot`, S2-010 "Showing 0 of results" (pager); S3-012/013 level select, S3-019 date, S3-021 number, S3-027 textarea, S3-035 note; S4-006 `fa-plus` link; S5-010/011 rubric select, S5-021 textarea, S5-023 `type=button`; S6-008 `classroom_id`, S6-010 export link, S6-015 "Lulus pukal (TP cadangan)"; S8-002 405 heading; SHU-020 (see AUD-M13-04 for the label). The 18 exclusions are the M16 tournament-banner triplets on S1–S6, and there are no others.

## Claims verified against live (52)

| # | Claim (doc) | Result |
|---|---|---|
| 1 | S1 tab "Cikgu Alesa"; header "Dashboard" / "Selamat datang kembali" (D-M13-8) | ✅ |
| 2 | Input `#cikgu-input` `required` | ✅ |
| 3 | `maxlength=4000`, no `name` | ✅ |
| 4 | Placeholder "Taip atau tekan 🎤 untuk cakap…" | ✅ |
| 5 | Mic `type=button`, live title "Tekan dan tahan untuk cakap" | ✅ |
| 6 | "Hantar"; empty meta line; voice switch unchecked by default | ✅ |
| 7 | `?ask=` fills the input and focuses it; never sends (`applyPrefill`) | ✅ |
| 8 | S1 reads only `ask`; `action=mark_essay` and `cikgu_pending_essay` ignored (D-M13-1) | ✅ |
| 9 | Request body `{message, thread_id: hidden \|\| null}`, headers JSON + `X-CSRF-TOKEN` | ✅ |
| 10 | Busy meta "Cikgu Alesa sedang berfikir…", Hantar disabled, input cleared | ✅ |
| 11 | Success meta `Tier: … · Turns remaining: … · Tool hops: … · Tokens: in=… out=…` | ✅ |
| 12 | "(tiada respon)" fallback | ✅ |
| 13 | Non-2xx: `data.error \|\| 'Cikgu Alesa tak boleh respon. Cuba lagi.'`; meta "Quota habis untuk hari ni." if `quota_exhausted` else '' | ✅ |
| 14 | `res.json()` before the `ok` check → a non-JSON body lands in catch → "Ralat sambungan. Cuba lagi sebentar." | ✅ |
| 15 | finally: enable Hantar and focus the input | ✅ |
| 16 | Text-node rendering with `<br>` per `\n` | ✅ |
| 17 | Auto-scroll on append | ✅ (but SOURCE-DERIVED, AUD-M13-08) |
| 18 | `VoiceMode.speak` ms-MY / 0.95 / 1.0 exposed as `window.cikguAlesaSpeak`; nothing calls it (observer on a missing container) | ✅ |
| 19 | Unsupported: disabled, title "Browser tidak sokong voice — guna Chrome/Edge", opacity 0.4 | ✅ |
| 20 | Recognition `ms-MY`, interim, not continuous; "🔴" `#fee2e2`, "Mendengar...", "Maaf, tak dengar."; auto-submit when longer than 5 characters; second click stops | ✅ (sequence nuance AUD-M13-06) |
| 21 | S1 at 375: `scrollWidth` 408, "Hantar" right edge 408, input 221 px; at 1280 input 686 px; history 360 px | ✅ |
| 22 | S2 tab "RPH — Cikgu Alesa"; h1 / sub exact | ✅ |
| 23 | "Jana RPH Baharu" → `/cikgu/rph/baharu`, `fa-robot` | ✅ |
| 24 | S2 headers (upper case by CSS, "Tindakan" right) and empty row `colspan=5` with the example in `<em>` | ✅ |
| 25 | S2 table right edge 430 inside an `overflow-hidden` card ending at 350 (375) | ✅ |
| 26 | `?page=2` on S2/S4/S6: "Showing 0 of 0 results" + "1" | ✅ |
| 27 | S3 tab "Jana RPH Baharu"; form POST `/cikgu/rph`; no `novalidate` | ✅ |
| 28 | S3 fields, names, placeholders, required ×3 | ✅ |
| 29 | Tajuk `maxlength` 200; Keperluan `maxlength` 500, rows 2 | ✅ |
| 30 | Tempoh number 15–240, default 60; Tarikh = today | ✅ |
| 31 | Levels "— Pilih —", D1–D6 "Darjah n", T1–T5 "Tingkatan n" | ✅ |
| 32 | Datalist 31 subjects A→Z, "Bahasa Arab" … "Tasawwur Islam" | ✅ |
| 33 | Info box heading and 4 bullets; note "⏱️ Proses ambil masa 10-30 saat. Sila tunggu."; no-class sentence | ✅ |
| 34 | Submit handler: disabled + `opacity-60` + "Cikgu Alesa sedang jana RPH…"; `applyClassroomDefaults` copies `data-subject/level/class` | ✅ |
| 35 | S4 tab "Marking Karangan"; h1 / sub; "Mark Karangan Baharu" `fa-plus`; headers ("Markah" centred); empty row; table right 447 at 375 | ✅ |
| 36 | S5 tab "Mark Karangan Baharu"; 6 rubric values and labels, first selected; "(default)" label on `general` | ✅ |
| 37 | S5 no `name` on any control; placeholders; textarea rows 14, `required`, `minlength=50` | ✅ |
| 38 | 50-character check on trimmed text + exact alert text | ✅ |
| 39 | Counter `(trim().match(/\S+/g) \|\| []).length + ' perkataan'` | ✅ |
| 40 | Hand-off stores `cikgu_pending_essay` and navigates to `/cikgu?action=mark_essay…` | ✅ (encoding ❌ AUD-M13-02) |
| 41 | S5 intro ("… prompt siap-siap untuk submit."), "← Senarai" / "Batal" → `/cikgu/essay` | ✅ |
| 42 | S6 tab "PBD Auto-Tag Queue"; h1 / sub exact | ✅ |
| 43 | Rollup form POST `/cikgu/pbd/rollup`, `classroom_id` not required, only "Pilih kelas untuk rollup" | ✅ |
| 44 | "Eksport CSV (Approved)" → `/cikgu/pbd/export.csv`, `fa-download`, emerald-500 | ✅ |
| 45 | `#bulk-form` POST `/cikgu/pbd/bulk-approve`, no nested form; 6 headers with alignments; empty row `colspan=6`; table 408 at 375 | ✅ |
| 46 | "Pilih semua" ticks `.row-check` | ✅ (`onclick`, not `onchange`: AUD-M13-05) |
| 47 | 404 page (status 404, tab and copy) for `/cikgu/rph/1`, `/cikgu/essay/99999999`, `/cikgu/pbd/export`, `/cikgu/quota`, `/cikgu-alesa` | ✅ |
| 48 | 405 framework page (tab "An Error Occurred: Method Not Allowed", 3 texts) for GET `/cikgu/send`, `/cikgu/pbd/rollup`, `/cikgu/pbd/bulk-approve` | ✅ |
| 49 | Sidebar entries, icons and colours; on `/cikgu/pbd` "PBD (Cikgu Alesa)", "Cikgu Alesa AI", "PBD Auto-Tag" active | ✅ (labels: AUD-M13-04) |
| 50 | Drawer items and order at 375; bottom nav Home/SPM/Game/Topik/Chat/Lagi, "Chat" dispatches `toggle-chatbot` | ✅ |
| 51 | Seed arithmetic: M08 v1.4 Kimia 8/9, 5/10, 3/8 ×4, 3/9, 1/8 and Sejarah 4/5, 3/5, 2/5 → 88.9/50.0/37.5/33.3/12.5, 80/60/40 → TP5/3/2/2/1, 5/4/3 by BR-14; 3008 after +1 correct = 2/9 22.2% TP2; members of 2001/2002 = 3001–3008 (M08 §6.10), only 3001–3003 have Sejarah answers (AC-18.5 holds) | ✅ |
| 52 | Chat counters: "Terangkan pecahan setara" 24 characters → in = 126; 2 seeded turns on 25/09 → 27, then 26; 26/09 → 29; RPH minutes 6/15/15/15/9; marks 14/20, 35/50; ids 13101–13599 unused elsewhere | ✅ |

## Checks with no finding

- **AI simulation.** Every canned output (replies, marks at 70%, RPH content, PBD SP labels and TP bands, CSV layout, tiers 100/30/10, token formula, "Dijana", "Lihat", V1/V2) is PROPOSED and provisional, and listed in OQ-M13-09. No canned text is marked OBSERVED. The #1 request and response shapes match the live script exactly.
- **Seeds.** The admin mirror is 0/0/0/0 with no class, as on live. The teacher seeds use M10 classes 2001/2002 (teacher 5, `tingkatan-5`) and the M08 users 3001–3008 "Murid Demo 01…08" correctly. The essays use neutral dummy texts. No real name appears.
- **Invented behaviour.** V1/V2, "Lihat", RPH via chat, the class select label and the quota tiers are the only additions. Each is provisional and backed by live copy (Tindakan column, S2 example prompt, `applyClassroomDefaults`, `turns_remaining`). No enhancement beyond live was found apart from the approved DVs. There is no per-row PBD action, no confirm dialog and no new copy outside §8.2.
- **Responsive.** DV-03/04 fix only the measured breakages. The S2/S4 header row and the S6 toolbar stacking are replicated as live.

---

# Round 2 (targeted re-audit of URS/SRS v1.1, 2026-09-26)

Scope: the fixes for AUD-M13-01…13 and a regression check. Evidence came from browser lane 3, read-only: the admin account, page scripts read with `document.scripts`, and `URLSearchParams` evaluated in the page without clicking anything. No message was sent, no forbidden control was clicked and no screenshot was needed. The scripts are in `<scratchpad>/m13-audit/` (`trace2.js`).

## Verdict: **PASS**

| Severity | Count (round 2) |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 2 |

## Round-1 findings: status

| ID | Status | Verification |
|---|---|---|
| AUD-M13-01 (Major) | **Closed** | URS FN-2.4.4/2.4.5, AC-09.1–09.4 and OQ-M13-08 (now "CLOSED … simulated") agree with SRS FR-31/32, BR-20, NFR-M13-01 (no `SpeechRecognition`, `webkitSpeechRecognition`, `getUserMedia` or `speechSynthesis` call), §6.9 (hooks `cikguVoice`, `cikguVoiceError`, `cikguSpoken`; "no hook stubs browser speech APIs") and E2E-27–30. The canned transcripts and timings are PROPOSED and listed in OQ-M13-09 / SRS §8.2. The mic UI still replicates live: "🎤", white background, border `rgb(139,92,246)`, text `rgb(109,40,217)`, 18px, 54×48; the status span is 12px `#6d28d9` and empty. The unsupported state is reachable only through a hook. A grep of both docs finds no leftover real-API wording. |
| AUD-M13-02 (Major) | **Closed** | FN-4.2.11, FR-54 and FR-21 now use `URLSearchParams`, and the live S5 script confirms `new URLSearchParams({…})`. Evaluated in the page, it produces exactly the AC-07.1 URL (`…&student=Murid+Demo+03&title=Semangat+Patriotisme`) and the AC-07.2 URL (`…&rubric=spm_bm_karangan&subject=&level=&student=&title=`). No `encodeURIComponent` or `%20` is left in the hand-off parts (the `?ask=%20` in AC-06.1 is a correct input URL). |
| AUD-M13-03 (Major) | **Closed** | BR-M13-13 is kept and now states the seed positions. AC-12.3 (and E2E-36) expects the new RPH **second**: after 13101 (28/09), and before 13102 through the id tie-break (9,000,001 > 13102). AC-14.1 (and E2E-38) expects it second, between 28/09 and 25/09. OQ-M13-06 records the choice. |
| AUD-M13-04 | **Closed** | FN-1.1.1, FN-1.1.3 and FR-01 match the live DOM: labels "Cikgu Alesa Chat" / "Cikgu Alesa", a separate 8px gradient "AI" badge, the drawer icon `text-purple-500`, and "PBD Auto-Tag" losing `text-blue-500` when active. |
| AUD-M13-05 | **Closed** | FN-5.2.2 and FR-61 now say `onclick` with a document-wide query, matching live (`onclick="document.querySelectorAll('.row-check').forEach(…)"`). E2E-48 uses a real click. |
| AUD-M13-06 | **Closed** | The sequence error → "Maaf, tak dengar." → end (status cleared, auto-submit when the trimmed input is longer than 5 characters) and the `dispatchEvent('submit')` bypass are specified (FN-2.4.5, FR-32, AC-09.3, SEC-M13-02). They match the live source (`form.dispatchEvent(new Event('submit'…`, `trim().length > 5`). |
| AUD-M13-07 | **Closed** | Speech output is simulated. Only successful replies longer than 10 characters are "spoken" (live heuristic `text.length > 10` confirmed), and a new reply cancels the running one (live `speechSynthesis.cancel()` confirmed). The status copy and duration are PROPOSED and listed in OQ-M13-09 / §8.2. The unverified "local browser feature" claim is gone. |
| AUD-M13-08 | **Closed** | FN-2.1.5 and FR-15 are SOURCE-DERIVED with "`scrollTop = scrollHeight` (instant)", matching the live `history.scrollTop = history.scrollHeight`. |
| AUD-M13-09 | **Closed** | AC-02.4 is provisional and E2E-08 is provisional. AC-18.2 is split: the observed "no confirm" check stays in E2E-45, and the unobserved server result moves to the new E2E-52 (provisional). |
| AUD-M13-10 | **Closed** (request pending) | XR-M13-03b asks M05 for `mock.addAnswer({userId, questionId, isCorrect, answeredAt?})` through the answer-log contract (3008 / 700001 / correct → 2/9 = 22.2%). §6.9 now states that `addSessions` cannot be used. The Delivery Lead routes the request. |
| AUD-M13-11 | **Closed** | The docs reference M10 v1.2 (no "v1.1" left). XR-M13-02 is now "confirm only", matching the M10 #12 response shape. |
| AUD-M13-12 | **Closed** (request pending) | SRS §7, XR-M13-05 and SQ-M13-01 specify a raw-body ApiClient method (no unwrap, no `ApiError` mapping, global 401 policy kept). The speculative "future backend" justification is removed. |
| AUD-M13-13 | **Closed** | FN-1.1.3 and FR-01 say the drawer replicates the live capture (shells.md §6 rule 4, M10 precedent), and unification is raised with the shell owner (XR-M13-04). The live DOM order (drawer items "Cikgu Alesa", "RPH", "PBD Auto-Tag", "Mark Karangan" before the "🤖 Cikgu Alesa AI" items) matches AC-01.2. |

## Regression checks

- **Coverage:** 137 content rows in the §6.1 matrix, all unique, 137 = inventory total. 119 are mapped to existing FNs (0 unknown FN references). The 18 exclusions are exactly S1–S6-001/002/003 (M16 tournament banner). The SHU mappings are unchanged.
- **Traceability (script):** 103 FN, 77 AC, 70 FR, **52 E2E**. There is no FN without an FR, no AC without an FR or an E2E, and no FR without an E2E. **19 E2E are provisional** (05, 08, 10, 13, 14, 19, 21, 25, 32, 36, 37, 38, 39, 41, 46, 47, 48, 50, 52), as stated in SRS §12. All 27 provisional ACs are covered **only** by provisional E2E (0 appear in a non-provisional E2E), and every provisional E2E carries at least one provisional AC. All E2E still run at 375, 768 and 1280.
- **Real names:** a grep of all of `docs/` finds 0 files with any of the three real "Powered by" names. After the round-1 privacy fix, the M10 URS placeholder now reads "Cikgu Nur Demo".
- **10 edited passages spot-checked, all consistent across URS and SRS:** FN-1.1.1 / FR-01; FN-1.1.3; FN-2.1.5 / FR-15; FN-2.4.3 / FR-30 / AC-08.2 / E2E-27; FN-2.4.5 / FR-32 / BR-20 / AC-09.2–09.3; FN-4.2.11 / FR-54 / FR-21 / AC-07.1–07.2; FN-5.2.2 / FR-61; AC-12.3 / AC-14.1 / BR-13; §6.9 hooks / XR-03b / E2E-47; SRS §7 / XR-05 / SQ-01.

## Info

| ID | Note |
|---|---|
| AUD-M13-R2-01 | **SQ-M13-01 (raw-body `api.raw`) does not block G1.** G1 needs testable requirements and answered blocking questions. The client behaviour, the live JSON contract and the error handling of #1 are fully specified, and only the transport method belongs to the architecture. The same holds for XR-M13-03b (`mock.addAnswer`), which affects only the provisional E2E-47. Both should be tracked as **build prerequisites**: they are items for the XL gate and the M13 build brief, and must close before M13 enters G3. |
| AUD-M13-R2-02 | DV-M13-02 now adds one visible PROPOSED string that live never shows: "🔊 Cikgu sedang bercakap…" in the existing status span. This follows from the Delivery Lead's decision (simulated output, D4) and is listed in OQ-M13-09 for the user at G1. Nothing else new is visible. |
