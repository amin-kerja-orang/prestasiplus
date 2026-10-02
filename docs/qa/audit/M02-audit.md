# M02 — Users & Schools Management — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6 step 4) |
| Date | 2026-09-25 |
| Privacy edit | 2026-09-30: the sample name in the quoted copy below uses the generic replacement (URS DV-M02-17) |
| Auditor | independent audit agent, browser lane 3 (`playwright3`), did not author the URS/SRS |
| Documents audited | `docs/requirements/urs/M02-users-schools.md` v1.0 · `docs/requirements/srs/M02-users-schools.md` v1.0 |
| Evidence | Live https://prestasiplus.my (own admin login on lane 3, read-only); `docs/discovery/M02-users-schools.md`; `docs/discovery/inventory/M02/*`; page scripts and DOM read in place; masked audit screenshots in `docs/qa/audit/img/M02/` |
| Safety | Read-only. Nothing was saved, submitted, toggled, deleted, imported, impersonated, printed or downloaded. No file was chosen. Native confirm texts were read from the DOM. Detail/edit pages opened: users 2 (the same student and parent records as discovery) + 1 school-admin package page; comp-students 1; schools 1 (edit) + 1 list row by search; subscriptions 2 (+ their invoice). Only client-side reveals were used (role select, typing in a search box, radio cards). No personal data is recorded in this report; every screenshot was masked with `tools/sanitize.js` and passed its leak check (0 leaks) before capture. Shared tools were not modified. |

## Verdict: **FAIL**

There are **0 Critical, 11 Major and 10 Minor** findings. The completeness proof itself is sound: the inventory re-runs identically, the coverage matrix and all traceability links are complete. The failures are in content. Some behaviour is specified that live does not have, some live states and elements are missing, one live visual bug that D9 names explicitly was replicated instead of fixed, and one live defect is neither listed as a deviation nor described. All the fixes are document edits. A targeted re-audit of the affected items is enough afterwards.

## Summary counts

| Measure | Result |
|---|---|
| Content elements in the URS §6 matrix (script) | **1,056 / 1,056** inventory IDs (S1–S16) present, 0 missing, 0 extra IDs. SHA: 43 mapped + 204 excluded by ID range, with reasons. |
| Matrix ↔ §3 FN "EL" columns (script) | 1,056 rows checked, **0 inconsistencies** in either direction |
| Mapping semantics spot-checked by hand | 30 rows, **30 correct** (list below) |
| Live re-inventory (`inventory.js` + `run-state.js` + `sanitize.js`, 12 saved states over S1, S2, S4, S5, S7, S9, S10@375, S12, S13, S14, S16) | Totals identical to the saved raw captures in all 12 states (e.g. S1 297/297, S14 273/273). Content element keys identical (0 added, 0 removed). PII leak check 0 in every state. The temporary batch file was deleted. |
| Traceability (script) | 153 FN → all have ≥1 FR · 169 AC → all have ≥1 E2E · 103 FR → all have ≥1 E2E · 62 E2E, each stated to run at 375/768/1280 · 0 dangling AC/FR references · IDs follow URS.md §9 |
| Claims verified against live | **62**: 44 correct, 18 incorrect (list below) |
| Deviations DV-M02-01…09 | 9/9 live defects reproduced. All within D9; DV-09 is latent (Minor note). One live D9 visual bug was replicated instead of fixed (AUD-M02-02), and one live defect is missing from §7 (AUD-M02-10). |
| SRS Q2 (S3 layout at 1280) | **Resolved:** a single column. The form card spans the full content width, and "Nota Keselamatan" is a full-width card **below** it. There is no 2/3 + 1/3 split (AUD-M02-11). |
| URS OQ-14 (masked samples) | **Resolved:** S4 "Contoh: Muhammad Fulan bin Fulan, ahmad@email.com, 0123456789, pass123" and S5 "Contoh: Muhammad Fulan bin Fulan, m-XXXXXXXX@moe-dl.edu.my, katalaluan123, 031215101234" match the SRS. The S7 sample IC is **090101101234**, not 031215101234 (AUD-M02-15). |
| Findings | **Critical 0 · Major 11 · Minor 10** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M02-01 | **Major** | URS FN-1.1.12, 1.1.13, 1.1.15, AC-05.2, AC-06.1, AC-04.1; SRS FR-11, FR-13, FR-14, FR-15, BR-04, §7 #6/#7/#8 (403 self), §5/§8 "Anda tidak boleh memadam akaun anda sendiri.", E2E-10 ("deleting own row → refusal message"), E2E-11 | The docs say **every** row has a checkbox, "Login As" and the bin button, and that the header box only skips the admin's own row. They then invent a server refusal and a message for deleting or deactivating yourself. On live, the logged-in admin's **own row renders no checkbox, no "Login As" and no delete button**. Only the "Aktif?" toggle is present. | `/admin/users?role=admin`: row 1 has checkbox, Login As, Padam and toggle. The own row has `cb:false, la:false, del:false, toggle:true`. The `bulkSelect()` script comment reads "Collect all selectable IDs (exclude own account)". | Specify that the own row has no checkbox, no Login As and no Padam (the toggle remains). Remove the invented self-delete refusal and its placeholder message from FR-14, BR-04, §5, §7 and §8, and rewrite E2E-10/11 to assert that the controls are absent. Self-deactivation through the toggle stays as live (the M01 result is INFERRED). |
| AUD-M02-02 | **Major** | SRS FR-02 ("active class slot, which has no visible style (as live)"); URS AC-02.4; §7 (missing DV) | The active role card **does** get `ring-2 ring-indigo-500` on live, but the `.card` box-shadow overrides it, so the active state is never visible. D9 lists "visual bugs (e.g. active state not shown)" as broken, so this must be fixed. It must not be replicated. | `?role=student`: card class `card hover:shadow-lg transition-all ring-2 ring-indigo-500`. Computed `box-shadow` is identical to the inactive cards (`rgba(99,102,241,0.08) 0 2px 8px …`). The ring applies to each role (teacher, parent, …). `jpn_officer` has no card, so none is ringed. Screenshot `img/M02/s1-active-card-ring-1280.png`: no visible ring. | Add a DV (visual state): the card of the active `role` filter shows the indigo ring. Update FR-02, AC-02.4 and E2E-05. |
| AUD-M02-03 | **Major** | URS FN-1.2.2, AC-08.3; SRS FR-21, E2E-13 | The docs say that changing the role "resets every section (typed values, grade, IC, school selections…)" and that only the active section's inputs are submitted. Live `onRoleChange()` resets only the school-admin generator, JPN/PPD, linked children and the parent search text. Name, email, phone, passwords, grade, IC and the standard school pick are **kept**. The `grade` radios have a static `name`, so a grade chosen under Pelajar is **still submitted** for Guru, Ibu Bapa and even Admin Sekolah. This is invented behaviour, and not a listed DV. | `createUserForm()` source: `onRoleChange(){ resetSchoolAdmin(); selectedJpnId=''; selectedPpdId=''; ppdList=[]; officerJpnName=''; officerPpdCode=''; linkedStudents=[]; parentStudentSearch=''; }`. Test: Pelajar, type a name, IC "111", Ting. 4 → Guru → Pelajar: all three values kept. `FormData` keys with role=school_admin: `…, is_active, grade`. | Either specify the live behaviour (standard values persist across roles; grade stays submitted), or add a DV (contradictory: a hidden grade is posted for non-students) that states exactly what is reset. Then align AC-08.3, FR-21 and E2E-13. |
| AUD-M02-04 | **Major** | URS FN-2.1.4, AC-18.4; SRS FR-53, E2E-28 | The docs say "Kata Laluan Default" is "an **empty** text field whose placeholder is the fixed default password". On live, the field is **pre-filled**: the `value` attribute equals the placeholder. The inventory missed this because `sanitize.js` blanks input values. | `/admin/users/bulk-import`: `input#default_password` has a `value` attribute, `value.length>0`, `value === placeholder`, not required. The value itself is not recorded here (SEC-M02-03). | Specify: pre-filled with the configured bulk default (value and placeholder). Update AC-18.4, FR-53, BR-14 ("or the configured bulk default when the field is empty" still holds when the admin clears it) and E2E-28. |
| AUD-M02-05 | **Major** | SRS §8 "All pickers — Searching / request error: (nothing shown, as live)", FR-41 ("no loading indicator"), FR-26/27/42/52/84; URS FN-1.2.7, 1.2.10, 1.3.7, 1.3.8, 2.1.3, 5.2.2 | Most pickers **do** show a loading state, and the student pickers show an "already linked" state. Both are missing: (a) spinners: S2 school-admin search (`fa-circle-notch` while `searchLoading`), S2 parent search (`parentStudentLoading`), S3 school picker (`fa-circle-notch` while `searching`, which contradicts FR-41), S3 parent linker (`loading`), S4 school picker (a dropdown box with `fa-spinner fa-spin`), S13 picker (`x-show="loading"`); (b) on S2 and S3 a result row for a student already in the chips is dimmed (`opacity-40 cursor-not-allowed`). | Markup read on each page (the `x-show="searchLoading"`, `"parentStudentLoading"`, `"searching"`, `"loading"` blocks; the `:class="linkedStudents.find(...) ? 'opacity-40 cursor-not-allowed' : ''"` rows). Only the S2 student/teacher "Sekolah" picker has no loader, and no empty state either (AC-09.3 is right). | Add each loading indicator and the dimmed state to the FNs, FRs and §8. Correct FR-41 and the §8 "All pickers" row, and add E2E assertions (latency 400 ms). |
| AUD-M02-06 | **Major** | SRS FR-102, §7 #38 ("limit default 15, max 20"), FR-25 | The school-search contract is wrong. Without `limit` the API returns **20** rows, and `limit=50` returns 50 (no cap at 20). The S2 student/teacher picker and the S4 picker send no `limit`, so they show up to 20 rows, not 15. | `GET /api/schools/search?q=sekolah` → 20 items; `…&limit=50` → 50 items. S2 `searchStdSchool()` and S4 `fetchSchools()` send no `limit`. S13 sends `limit=15`; S3 and S5 send `limit=20`. | Default 20, no maximum of 20 (clients pass 15 or 20). Update FR-102, §7 #38, FR-25/52 and the seed note. Flag the difference from the M01 SRS §7 #20 contract to the Delivery Lead. |
| AUD-M02-07 | **Major** | URS FN-2.2.3, AC-19.3; SRS FR-59, E2E-31 | The S5 quota panel is missing its **progress bar** and its **colour state**. The panel is emerald while quota remains and red when it is full: border/background, label, value, bar and message all switch. Only the texts are specified. | Template `x-if="… quota.has_subscription"`: `div :class="quota.remaining > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'"`, a bar `:style="'width: ' + Math.min(100, Math.round(used/quota*100)) + '%'"` with `bg-emerald-500`/`bg-red-500`. BEA4603: "423 / 415", bar 100%, red, "Kuota penuh! …". | Add the bar (width = min(100, round(used/quota×100))%) and the two colour states to FN-2.2.3, AC-19.3, FR-59 and E2E-31. |
| AUD-M02-08 | **Major** | SRS FR-59 ("Errors are silent"), URS AC-22.2 ("A load failure shows nothing"), SRS FR-71, E2E-31/39 | Two error states are specified wrongly. (a) S5: when the quota fetch fails, the script sets `quota = {has_subscription:false}`, so the **"Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan." warning shows**. (b) S7: "Guru ini tiada kelas aktif." is `x-show="teacherId && classrooms.length === 0"`, so it **shows while the classrooms are loading and after a load failure** (the `catch` leaves the list empty). | `importForm().fetchQuota` catch block; S7 markup `<p x-show="teacherId && classrooms.length === 0">Guru ini tiada kelas aktif.</p>` and `loadClassrooms()` catch. | Specify both live behaviours and fix E2E-31 (`failNext` → warning) and E2E-39 (`failNext` → "Guru ini tiada kelas aktif."; the text is also visible during latency). |
| AUD-M02-09 | **Major** | URS FN-5.2.6, AC-27.4; SRS FR-86, §8 S13 row, E2E-49 | "Jumlah {years} tahun: RM …" is conditional: `template x-if="selectedPackage?.max_renewals > 0"`. It is **not shown for T5** (1 tahun). The docs show it for every package (AC-27.4 even lists "T5 1"). | S13 summary markup. Full + T4 + 100 → "100 pelajar × RM30.00/tahun", "RM3,000.00", "Jumlah 2 tahun: RM6,000.00". | Specify that the line shows only when the package term is more than 1 year (T4, D1_D6, T1_T3). Add a T5 case to E2E-49. See also AUD-M02-14. |
| AUD-M02-10 | **Major** | URS FN-5.3.11, AC-28.6; SRS FR-90, E2E-53; URS §7 | S14 "Tunjuk" per-page select defect, neither described nor listed. Without `?per_page` the list shows **50** rows, but the select displays **25** (the server marks `<option value="25" selected>`). Choosing "25" from that state fires no `change`, so it does nothing. This is a live defect (a wrong displayed state). The docs describe a working "default 50" select. | `/admin/school-subscriptions/14`: select value "25", text "Memaparkan 1-50 dari 150", 50 rows. `?per_page=50` → "50" selected, 50 rows. `?per_page=25` → "25", 25 rows. Screenshot `img/M02/s14-perpage-25-shows-50-1280.png`. | Decide under D9. Either add a DV (the select shows the effective size, 50) or replicate it (the select shows 25 with 50 rows). Update AC-28.6, FR-90 and E2E-53 to match. |
| AUD-M02-11 | **Major** | SRS §10 S3 row (1280 "Form with the Nota Keselamatan card beside it (2/3 + 1/3)"), §13 Q2 | Q2 resolved against the SRS. At 1280, S3 is a **single column**. One card holds the profile header (avatar, name, email, Daftar/Kemaskini) and the form at the full content width (911 px). "Nota Keselamatan" is a separate full-width card **below** it. The discovery §7 "2/3 + 1/3" is wrong. | Form card box x=305 w=911, bottom ≈1576; the "Nota Keselamatan" heading is at y=1649 in a `card bg-gradient-to-r from-blue-50 to-indigo-50` inside the `space-y-6` column. Screenshot `img/M02/s3-edit-layout-1280.png`. | SRS §10 S3: stacked at every width (the profile header inside the form card, the note card below it). Close Q2. Tell the Delivery Lead that the discovery §7 row is wrong. |
| AUD-M02-12 | Minor | SRS FR-82 ("over all subscriptions, INFERRED"), URS OQ-7 | "Jumlah Kuota Pelajar" is observable. It sums the quotas of **active** subscriptions only. | 5,738 = 1000×4 + 500 + 415 + 164 + 354 + 305 (the 9 "Aktif" rows). The sum of all 14 rows would be 7,833. | FR-82: the sum of `studentQuota` over active subscriptions (OBSERVED). Narrow OQ-7. |
| AUD-M02-13 | Minor | SRS FR-79, §8 S9 tooltips, URS FN-4.1.5, AC-24.4; SRS FR-80 (S10 switch default), FR-97 / URS FN-5.4.1 (print hiding), SRS FR-78 / BR-20 (S9 order), FR-06 (JPN badge) | These are labelled INFERRED but are observable. The inactive school toggle is `fa-toggle-off`, `title="Aktifkan"`, red styling (row BFT4001). The S10 "Sekolah Aktif" checkbox is checked by default. The S15 buttons sit in `.no-print` with `@media print { .no-print { display:none !important } }`. S9 is sorted by name (A→Z, "KOLEJ D PATINGGI…", "KOLEJ ISLAM…", …). The `jpn_officer` badge is `bg-slate-100 text-slate-700`. | Live DOM and stylesheet. | Relabel them as OBSERVED. The E2E stays the same. |
| AUD-M02-14 | Minor | SRS BR-33 ("S13 summary with a space 'RM 3,000.00'"), FR-86, URS AC-27.4, SRS E2E-49 | Copy: the S13 amounts have **no space**: "RM3,000.00", "RM6,000.00" (the markup is `RM<span x-text=…>`). | S13 summary markup and innerText. | Change to "RM3,000.00" / "Jumlah 2 tahun: RM6,000.00" everywhere. |
| AUD-M02-15 | Minor | SRS FR-72, URS AC-22.3, OQ-14 | The S7 help sample IC is "090101101234" (live copy: "Satu pelajar setiap baris, format: `NAMA, NOKP` &nbsp;(cth: `MUHAMMAD FULAN BIN FULAN, 090101101234`)"). The SRS uses 031215101234. The S4 and S5 samples are confirmed. | S7 `<code>` text. | Use "090101101234" in FR-72 and E2E-39. Close OQ-14. |
| AUD-M02-16 | Minor | URS FN-1.2.11, FN-1.2.7; SRS FR-28, FR-26, FR-74 | Displayed casing: "Sekolah Dipilih" and "Anak yang dipautkan:" carry `uppercase` (displayed "SEKOLAH DIPILIH", "ANAK YANG DIPAUTKAN:"). The S8 classes table headers display "KELAS", "SUBJEK", "CIKGU", "STATUS". | Class `uppercase` on both S2 labels; S8 `th` innerText in upper case. | State "displayed uppercase (CSS)" in the FRs. |
| AUD-M02-17 | Minor | SRS FR-88; URS FN-5.3.2 | The S14 usage bar changes colour: `bg-emerald-500` at 15% (record 14), `bg-red-500` at 100% (record 10, over quota). The colour rule is not specified. | Computed classes on both records. | Specify the bar colour (emerald under quota, red at 100%; the exact threshold is INFERRED). |
| AUD-M02-18 | Minor | SRS §10 S10/S11 row (breakpoint `md`) | The S10/S11 field grid is `grid-cols-1 sm:grid-cols-2`, so it has 2 columns from **640 px**, not `md`. | Form grid class on both pages. | Breakpoint `sm`. |
| AUD-M02-19 | Minor | URS §7 DV-M02-09 | This is a real contradiction, but it is latent. The public vernacular school "SEKOLAH JENIS KEBANGSAAN (TAMIL) BANGI" (BBD4051) is stored with type **SK**, so live already treats it as primary. The defect appears only if an admin saves an SJK(C)/SJK(T) school through S10/S11. It stays within D9 (contradictory rule). | `/admin/schools?search=bangi`: Jenis "SK". | Add this evidence to DV-09 and keep the DV. |
| AUD-M02-20 | Minor (Delivery Lead decision) | URS §7 "Explicitly not deviations" (generator warning), OQ-6 | The warning "Sekolah ini tiada kod KPM. Sila isi maklumat secara manual di bawah." points to fields that do not exist, and "Daftar Pengguna" stays disabled (`selectedRole === 'school_admin' && !generated`). This is a contradictory message and a dead end, which is arguably "broken" under D9 (contradictory rules / wrong labels). The writer kept it as "working". | S2 markup: the warning is under `x-show="!selectedSchool?.code"`, and there are no manual fields in the school-admin section. | The Delivery Lead decides: keep it (with the justification reworded) or add a DV (for example, drop "Sila isi maklumat secara manual di bawah."). This is the only "not a deviation" item the auditor questions. The others (English paginator, confirm policy, status wording, S5 Kembali → /admin, active-only search, S9 type filter, picker differences, tab suffixes, invoice basis, over-quota) were checked and do work. |
| AUD-M02-21 | Minor | (reported for the Delivery Lead; not under audit) | The discovery narrative §7 (S3 "2/3 form + 1/3") and §2.1 ("empty class slot for the active role … not visually distinct") are inaccurate. The slot holds `ring-2 ring-indigo-500`, which is masked by the card shadow. | See AUD-M02-02 and AUD-M02-11. | The discovery owner corrects them. The auditor did not edit them. |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9? | Note |
|---|---|---|---|
| DV-M02-01 | Yes. The S1 table is 1,447–1,964 px wide (it depends on the data) in a 911 px scroller at 1280. Td text is 14–16 px and badges are 9 px at 375. | Yes (layout, unreadable text) | — |
| DV-M02-02 | Yes. At 1280 **all 7** labels are truncated (`text-overflow: ellipsis`, scrollWidth > clientWidth). At 768 "Admin Sekolah" and "Pegawai PPD" are truncated. | Yes | The evidence lists only 3 labels; all 7 are cut at 1280 (screenshot). |
| DV-M02-03 | Yes. `?role=jpn_officer` → badge "jpn_officer" (slate). The filter select value falls back to "" ("Semua Peranan"). The S3 select has 7 options, with no JPN option. | Yes (wrong label, contradictory) | — |
| DV-M02-04 | Yes. On the student record, switching to Guru keeps Tahap/IC/Pakej visible (the x-show is `… \|\| 'student' === 'student'`, always true). On the parent record, switching to Pelajar keeps the Tahap section hidden and the linker visible. IC, package and school are server-rendered only for students. | Yes (the x-show clearly intends to follow the select; it contradicts "Perubahan peranan akan berkuat kuasa serta-merta") | The rebuild behaviour is an improvisation allowed by D9. |
| DV-M02-05 | Yes. The S6 table is 984/987 px in an `overflow-hidden` card (957 px at 1280, 340 px at 375). | Yes | — |
| DV-M02-06 | Yes. The S15 scrollWidth is 428 against clientWidth 360 at 375; there is no overflow at 768. | Yes | — |
| DV-M02-07 | Yes. S16 `max=5000`; S13/S14 `max=2000`. | Yes (contradictory) | — |
| DV-M02-08 | Yes. S13 "500 soalan/bulan"; S14 box "99999 soalan/bulan/pelajar", tile "99999/bulan"; upgrade text "Pemantauan (80 soalan/bulan)". | Yes | — |
| DV-M02-09 | Latent (AUD-M02-19) | Yes (contradictory) | — |
| **Missing** | The active stat-card ring is invisible (AUD-M02-02). The S14 per-page select shows 25 while listing 50 (AUD-M02-10). | Both are "visual bug / wrong displayed state" | These must be added (fix) or explicitly replicated. |

### Flows walked (up to, never including, the mutating click)

| Flow | Result |
|---|---|
| Create, per role (S2): default → each of the 8 roles; school-admin search → pick → generate; officer JPN → PPD; parent search → chips | The structure matches (role options including Pegawai JPN, `:name` bindings for the school-admin, officer and standard sections, "Daftar Pengguna" `:disabled="selectedRole === 'school_admin' && !generated"`, `generateCredentials()` returns without a code, Title Case = lower-case, then capitalise each space-separated word). **Deviations:** the reset scope (AUD-03), loaders and the dimmed state (AUD-05). Parent → child linking: chips post `linked_students[]`, and duplicates are ignored in `addLinkedStudent`. |
| Edit (S3), student and parent records | The profile card, the 7-option role select, the package block (3 options, PKSK badge "Tiada Akses"), the school chip → clear → state select with short labels, and the parent linker (title "Buang pautan", "Tiada pelajar dipautkan lagi") all match. The layout is per AUD-11 and non-reactivity per DV-04. |
| Toggle / Login As / delete confirm texts (DOM) | `@submit.prevent="if(confirm('Pasti untuk menukar status pengguna ini?')) { toggling = true; $el.submit(); }"` with the `fa-spinner fa-spin` swap. The impersonate form has `onsubmit="return confirm('Login sebagai …?')"`. The delete modal reads "Padam Pengguna? / Anda pasti mahu memadam pengguna ini? / Batal / Ya, Padam". The bulk modal reads "… Tindakan ini tidak boleh dibatalkan. … Ya, Padam Semua". The own row is per AUD-01. |
| Bulk import (S4) | The role cards are unchecked and not required. The picker is shown only for teacher/school_admin, rows "{name} ({code})" + state, "Dipilih: …", the placeholder becomes the chosen school, clear `fa-times`. The copy is confirmed. The default password is pre-filled (AUD-04). |
| Student import (S5), quota and subscription gates | BEA4603 → "423 / 415", "Kuota penuh! Sila tingkatkan kuota dahulu.", toggle "Pelajar Sedia Ada (423 orang)" fetched on first open, class filter optgroups Rendah/Menengah by `type === 'SK'`, class cards by `type === 'SK'`. The Import button is never disabled. The panel visuals and the error state are per AUD-07/08. |
| Comp students (S6–S8) | Bulk bar `x-show="selected.length > 0"`, 4 `name=action` buttons, "Batal pilihan" `selected = []`, no confirm. The table is clipped (DV-05). Create: 552 teacher options (551 + placeholder), class select `:disabled="!teacherId"`, date 2026-12-31 required, textarea 8 rows, required, monospace. Detail: labels, "OFF (tak boleh kumpul/claim)" rose, two forms with no confirm, class status "ACTIVE". |
| School CRUD (S9–S11) | The stats, filters, reset link (only when filtered), columns, 30/page, edit `fa-pen` "Edit", and toggle `fa-toggle-on` "Nyahaktif" / `fa-toggle-off` "Aktifkan" with no confirm all match. The S10/S11 fields, options, required flags, placeholders and buttons match. |
| Subscription lifecycle (S12–S15) | Create: basic is checked, the package radios are not required, quota 1–2000 default 100, summaries (AUD-09/14). Detail: forms cancel (`confirm('Adakah anda pasti mahu batalkan langganan ini?')`), quota PUT 1–2000 pre-filled, extend (presets 7/14/30/60/90/180/365, `days` 1–365, `onclick="return confirm('Lanjutkan tempoh langganan?')"`), upgrade (confirm text as documented; basic only; absent on the full record 10). The invoice: title, texts, totals "150 orang / RM30.00 / RM4,500.00", `window.print()`, `.no-print`. |

## Claims verified (62)

| # | Claim (doc) | Result |
|---|---|---|
| 1 | S1 tab "Pengurusan Pengguna - Admin Panel", header title | Correct |
| 2 | 7 stat cards, order, labels, `?role=` hrefs | Correct |
| 3 | Active card has no visible style (FR-02) | Correct as an observation, but D9-broken → AUD-02 |
| 4 | Filter "Peranan" options (live: 8 incl. "Semua Peranan", no JPN) | Correct |
| 5 | Filter label icons `fa-user-tag`, `fa-school`, `fa-toggle-on`, `fa-search` | Correct |
| 6 | "Sekolah" filter 61 options | Correct |
| 7 | Status options ""/Semua, 1 Aktif, 0 Tidak Aktif | Correct |
| 8 | Column headers, CSS uppercase | Correct |
| 9 | Role badge colours Pelajar blue, Guru purple, Ibu Bapa amber, Penaja emerald, Admin Sekolah teal, Pegawai PPD cyan, Admin red | Correct |
| 10 | `jpn_officer` badge raw code | Correct (colour slate, AUD-13) |
| 11 | Page 2 numbering starts at 26 | Correct |
| 12 | Pagination window 1–10 … 206 207, "Go to page n", "&laquo; Previous" | Correct |
| 13 | Tooltips "Edit", "Login As", "Padam", "Pakej" | Correct |
| 14 | "Login As" / "LA" responsive label | Correct |
| 15 | "Pakej" only on school_admin rows | Correct |
| 16 | Toggle confirm text and spinner | Correct |
| 17 | Every row has checkbox, Login As, Padam | **Incorrect** (AUD-01) |
| 18 | Delete / bulk modal texts | Correct |
| 19 | Empty state `colspan=10`, texts, no pagination, `search` kept | Correct |
| 20 | S2 role options incl. Pegawai JPN | Correct |
| 21 | Role change resets every section / only the active section submitted | **Incorrect** (AUD-03) |
| 22 | Standard fields: no `required`; phone maxlength 14 `inputmode=tel`; IC maxlength 14 `inputmode=numeric` | Correct |
| 23 | Student school rows "{name} ({type}, {state})", no empty state, no loader | Correct |
| 24 | Parent search: 300 ms debounce, "Tiada pelajar dijumpai", title "Buang", hint | Correct |
| 25 | Pickers show nothing while searching (§8) | **Incorrect** (AUD-05) |
| 26 | School-admin rows "{state} • {district} • {type}", code / "Tiada kod"; "Reset" title; generator disabled without code + warning | Correct |
| 27 | Generated: login = lower-case code + "@prestasiplus.my", "Salin" copy, toast 2 s | Correct |
| 28 | Officer JPN list (16 names) and PPD disabled `!selectedJpnId \|\| ppdLoading` | Correct |
| 29 | S3 role select 7 options, required, no JPN | Correct |
| 30 | S3 package options and PKSK badge "Tiada Akses", hint | Correct |
| 31 | S3 state select short labels "KL", "N. Sembilan", "P. Pinang" | Correct |
| 32 | S3 school picker has no loading indicator (FR-41) | **Incorrect** (AUD-05) |
| 33 | S3 parent linker texts and "Buang pautan" | Correct |
| 34 | S3 layout at 1280 = 2/3 + 1/3 (SRS §10) | **Incorrect** (AUD-11) |
| 35 | S4 default password field empty with placeholder | **Incorrect** (AUD-04) |
| 36 | S4 "Contoh: … ahmad@email.com, 0123456789, pass123" | Correct |
| 37 | S4 picker rows "{name} ({code})" + state, "Dipilih:", placeholder swap, clear `fa-times` | Correct |
| 38 | S5 "Contoh: … m-XXXXXXXX@moe-dl.edu.my, katalaluan123, 031215101234" | Correct |
| 39 | S5 class cards / filter switch on `type === 'SK'` | Correct |
| 40 | S5 quota panel texts only | **Incorrect** (bar and colours missing, AUD-07) |
| 41 | S5 quota fetch errors silent | **Incorrect** (AUD-08) |
| 42 | S5 existing students fetched on first open; 300 ms search; class change reloads | Correct |
| 43 | S5 "Kembali" → `/admin` | Correct |
| 44 | S6 headers, 50/page, AKTIF/OFF, "Syiling OFF: 90 / 90", bulk bar, no confirm | Correct |
| 45 | S6 empty "Tiada pelajar komplimen lagi. Daftar baru." | Correct |
| 46 | S7 date default 2026-12-31, textarea 8 rows required, classroom label "{name} ({class_code})" | Correct |
| 47 | S7 load failure shows nothing | **Incorrect** (AUD-08) |
| 48 | S7 help sample IC 031215101234 | **Incorrect** (AUD-15) |
| 49 | S8 labels, "OFF (tak boleh kumpul/claim)", buttons with no confirm | Correct |
| 50 | S9 stats "10,220 / 10,212 / 8", filter options (type SK/SMK only), placeholder | Correct |
| 51 | S9 toggle-off "Aktifkan" INFERRED | **Incorrect label** (observable, AUD-13) |
| 52 | S9 empty `colspan=9`, S12 empty `colspan=8` texts | Correct |
| 53 | S10/S11 fields, options, required, placeholders, Simpan/Kemaskini | Correct |
| 54 | S12 stats, status/level options, columns, no pagination | Correct |
| 55 | "Jumlah Kuota Pelajar" over all subscriptions | **Incorrect** (active only, AUD-12) |
| 56 | S13 tiers (basic default), 4 packages with years, quota 1–2000 default 100, picker `limit=15` | Correct |
| 57 | S13 "Jumlah {years} tahun" always shown; "RM 3,000.00" with a space | **Incorrect** (AUD-09, AUD-14) |
| 58 | School search default limit 15, max 20 | **Incorrect** (AUD-06) |
| 59 | S14 forms, confirm texts, presets, upgrade only on basic | Correct |
| 60 | S14 "Tunjuk" default 50 | **Incorrect** (AUD-10) |
| 61 | S14 full tiles "RM30.00", "RM15,000.00"; over quota "100% digunakan", "Baki: 0 pelajar"; note text | Correct |
| 62 | S15 texts, totals, buttons; S16 forms (t4/1, t5/2, max 5000 live), links | Correct |

## Coverage-matrix spot-check (hand, 30 rows)

S2-014, S2-021, S2-031, S2-057, S2-139, S3-017, S3-046, S3-052, S3-085, S4-029, S4-056, S5-022, S5-040, S6-004, S6-013, S7-008, S8-019, S8-025, S9-060, S11-020, S12-019, S13-029, S13-049, S14-010, S14-026, S14-063, S14-092, S15-031, S16-017, plus S1-036. All 30 map to the right Function. The exclusions (SHA 042–044 → M21; SHA global shell / M23 ranges) are justified. Content gaps found in this audit (the S5 quota bar, the picker spinners, the dimmed rows) are not missing inventory IDs: they are behaviours of elements that exist (for example S5-112–114 and the picker inputs) that the FN/FR text does not describe.

## Not verifiable read-only (correctly INFERRED / UNVERIFIED COPY in the docs)

These could not be checked without changing data:
- all POST outcomes and flash messages;
- impersonation;
- the non-admin view of M02 routes;
- the cancelled, expired and grace detail pages, and the "Tempoh Ihsan" badge;
- the S8 toggled labels;
- the S16 assigned state;
- import results;
- the xlsx template.

## Screenshots (masked, `docs/qa/audit/img/M02/`)

| File | Shows |
|---|---|
| `s1-active-card-ring-1280.png` | `?role=student`: the Pelajar card has `ring-2` but no visible ring; all 7 labels are truncated (DV-02). |
| `s3-edit-layout-1280.png` | S3 at 1280: single column, profile header inside the form card, "Nota Keselamatan" below (Q2). |
| `s14-perpage-25-shows-50-1280.png` | S14 record 14: "Tunjuk 25" while "Memaparkan 1-50 dari 150". |

---

## Round 2: targeted re-audit of URS/SRS v1.1 (2026-09-25)

**Scope.** I checked the v1.1 changes for AUD-M02-01 to AUD-M02-21, the new deviations DV-M02-10 to 12, the discovery corrections and DATA-M02-01. Where it mattered I checked against live again, on lane 3 with the same read-only and personal-data rules as round 1. The only live pages opened were the user list (`?role=admin` and the default list) and S5. No detail page was reopened. Items whose live evidence is unchanged since round 1 (the same markup and scripts) were checked against the round 1 evidence.

### Verdict: **PASS**

There are 0 Critical and 0 Major findings. All 21 round-1 findings are closed. There is 1 new Minor finding (AUD-M02-22), a stale cross-reference that does not block G1.

### Sanity checks (script)

| Check | Result |
|---|---|
| Content elements in URS §6 | 1,056/1,056, 0 missing, 0 extra |
| Matrix ↔ §3 FN "EL" columns | 0 inconsistencies |
| FN → FR | 153/153 |
| AC → E2E | 170/170. AC-M02-01.8 is new and is covered by E2E-11. |
| FR → E2E | 103/103. There are 62 E2E scenarios, all on 375/768/1280. |
| Dangling AC/FR references in E2E | 0 |
| Leftover stale claims | none: "Anda tidak boleh memadam", "default 15", "RM 3,000", "no visible style", "empty text field", "Errors are silent", "403 (self)", "load failure shows nothing" and "over all subscriptions, INFERRED" are all gone |
| DATA-M02-01 `role` | enum = the 8 live codes `student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin` (M01 v1.3). The M01-only `duta/seller/tuition_centre` are removed. **Correct.** |

### Finding status

| ID | Status | Evidence (docs v1.1 + live) |
|---|---|---|
| AUD-M02-01 | **Closed** | FN-1.1.12/13/15, AC-01.8 (new), AC-04.1/05.2/06.1, FR-11/13/14/15, BR-04, E2E-10/11. The self-delete refusal, its message and the 403 codes are removed. Live (re-checked): the own row is `cb:false, edit:true, la:false, del:false, toggle:true`, exactly as AC-01.8 and E2E-11 state. |
| AUD-M02-02 | **Closed** | DV-M02-10 added. FN-1.1.2, AC-02.4, FR-02 and E2E-05 specify a visible ring on the active card and no ring without a filter or for `jpn_officer`. Live: with no role filter, 0 cards carry `ring-2`; with `?role=jpn_officer`, none do (round 1). |
| AUD-M02-03 | **Closed** | FN-1.2.2, AC-08.3, FR-21 and E2E-13 describe the live `onRoleChange` scope, the kept values, `grade` submitted for every role, and the standard `school_id` submitted for every standard role. This matches the round-1 script evidence and the `FormData` keys. |
| AUD-M02-04 | **Closed** | FN-2.1.4, AC-18.4, FR-53 and E2E-28 say pre-filled (value = placeholder), not required. The value is still written only as `<default-password>`. |
| AUD-M02-05 | **Closed** | Loaders are now in AC-10.2, 11.2, 14.4, 18.3, 19.2, 27.2 and FR-26/27/41/42/52/58/84. The S2 student/teacher picker still has "no loading indicator" (FR-25), which is correct. Live re-check: S5 has `x-show="searching"` with a spinner icon. Dimmed already-linked rows are in FR-26/42. The §8 "All pickers" row now covers request errors only, with the S5/S7 exceptions. |
| AUD-M02-06 | **Closed** | FR-25/52/102, §7 #38 and AC-09.3/18.3/19.2 say default 20 with no maximum. M01 SRS v1.4 #20 is aligned too. See AUD-M02-22 for a leftover sentence. |
| AUD-M02-07 | **Closed** | FN-2.2.3, AC-19.3, FR-59 and E2E-31 now have the bar formula and the emerald/red classes, matching the round-1 template. |
| AUD-M02-08 | **Closed** | FN-2.2.3 and FR-59: a quota failure shows the no-subscription warning. FN-3.2.3, AC-22.2, FR-71 and E2E-39: "Guru ini tiada kelas aktif." shows while loading and after a failure. Both match the live scripts. |
| AUD-M02-09 | **Closed** | FN-5.2.6, AC-27.4, FR-86 and E2E-49 show "Jumlah n tahun" only when `maxRenewals > 0`, and E2E-49 includes "T5 → no Jumlah line". |
| AUD-M02-10 | **Closed** | DV-M02-11 added. FN-5.3.11, AC-28.6, FR-90 and E2E-53 have the select show the size in use (50 by default). |
| AUD-M02-11 | **Closed** | SRS §10 S3 is now a single column with the note card below, at every width. Q2 is closed. The discovery §7 row is corrected ("corrected after audit"). |
| AUD-M02-12 | **Closed** | FN-5.1.1, AC-26.1 and FR-82 now say the quotas of active subscriptions only (OBSERVED 5,738). OQ-7 is narrowed. |
| AUD-M02-13 | **Closed** | These are relabelled OBSERVED: FR-79 and FN-4.1.5 (red `fa-toggle-off` "Aktifkan"), FR-80 (S10 switch on by default), FR-97 and FN-5.4.1 (`.no-print`), FR-78 and BR-20 (sorted by name), FR-06 (JPN badge slate). |
| AUD-M02-14 | **Closed** | BR-33, FR-86, AC-27.4 and E2E-49 use "RM3,000.00" / "RM6,000.00" with no space. |
| AUD-M02-15 | **Closed** | FR-72, AC-22.3 and E2E-39 use "090101101234". OQ-14 is closed and the S4/S5 samples are confirmed. |
| AUD-M02-16 | **Closed** | FR-26 ("ANAK YANG DIPAUTKAN:"), FR-28 ("SEKOLAH DIPILIH") and FR-74 (KELAS / SUBJEK / CIKGU / STATUS) all say CSS upper case. |
| AUD-M02-17 | **Closed** | FN-5.3.2, AC-28.2 and FR-88 give the colours: emerald below 100%, red at 100% (threshold INFERRED). |
| AUD-M02-18 | **Closed** | FR-80 and SRS §10 S10/S11 give two columns from 640 px (`sm`). |
| AUD-M02-19 | **Closed** | The DV-M02-09 evidence now names BBD4051 stored as SK and marks the defect latent. |
| AUD-M02-20 | **Closed** | DV-M02-12 added (see the review below). FN-1.2.12, AC-11.4 and FR-29 use the proposed copy and cite the live text. OQ-6 is closed. |
| AUD-M02-21 | **Closed** | Discovery lines 69 (the ring exists but is hidden; all 7 labels truncate) and 536 (S3 single column) are marked "(corrected after audit)". |

### Review of the new deviations

| DV | Live defect real? | D9 fit | Specification check |
|---|---|---|---|
| DV-M02-10 | Yes. The active card has `ring-2 ring-indigo-500`, but its computed `box-shadow` is identical to the other cards. | Yes. D9 names "active state not shown" explicitly. | It changes only the active card, and there is no ring without a filter or for `jpn_officer`. Correct. |
| DV-M02-11 | Yes. Without `per_page` the select shows "25" with 50 rows. Choosing 25 fires no change. With `?per_page=n` it is correct. | Yes (a wrong displayed state, and a control that cannot be used in that state). | The fix is limited to the selected option. Page size, parameter and navigation are as live. Correct. |
| DV-M02-12 | Yes. The instruction points to manual fields that do not exist, and "Daftar Pengguna" stays disabled. | Yes (a wrong or contradictory instruction). | The first sentence and the icon, condition and disabled state are kept. The replacement "Sila kemaskini kod sekolah di halaman Sekolah terlebih dahulu." is actionable: S11 has "Kod Sekolah *", and the generator only needs a code. It is correctly marked **PROPOSED COPY**. The Delivery Lead should confirm the wording with the user at G1, because it is the only new BM copy in M02. |

### Spot-check of 12 edited passages

| # | Passage | Result |
|---|---|---|
| 1 | FR-15 / AC-01.8: the own row keeps "Aktif?" and "Edit" | Correct (live re-check) |
| 2 | FR-02: no ring for `jpn_officer` or without a filter | Correct |
| 3 | FR-21: the standard `school_id` is submitted for every standard role | Correct (`:name="isStandardRole ? 'school_id' : ''"`) |
| 4 | FR-25: the S2 student/teacher picker has no loader, up to 20 rows | Correct |
| 5 | FR-27: `fa-circle-notch` while `searchLoading` | Correct |
| 6 | FR-52: the S4 dropdown box with `fa-spinner fa-spin` | Correct |
| 7 | FR-58: the S5 spinner while searching | Correct (live re-check) |
| 8 | FR-59: bar formula, emerald/red classes, failure → warning | Correct |
| 9 | FR-71: the empty text while loading or after failure; classroom label "{name} ({classCode})" | Correct (live omits " (code)" when the code is empty; this is minor and implied) |
| 10 | FR-82: "counts over all subscriptions; totalQuota active only" | Correct (Aktif 9 / Tamat Tempoh 1 are status counts) |
| 11 | FR-88: bar `bg-emerald-500` / `bg-red-500` | Correct |
| 12 | FR-102 and §7 #38: default 20, no maximum, clients 15/20/none | Correct, but the trailing sentence is stale (AUD-M02-22) |

### New findings

| ID | Severity | Doc + section | What's wrong | Required fix |
|---|---|---|---|---|
| AUD-M02-22 | Minor | SRS FR-M02-102 (last clause) | The sentence still says "(M01 states 'limit ≤20'; §13 Q3)". M01 SRS v1.4 §7 #20 now states "defaults to 20 when omitted, with no enforced maximum", so the M01 limit mismatch no longer exists. | Drop that clause (or say "aligned in M01 v1.4"). |
