# S8-T07 Accessibility and copy audit: final Verify checklist

- Card: S8-T07 (Verify, R1 build, V3), team-aa
- Base: `feature/v3-bijak-r1` at SHA 8f6beb60 (includes #706 S0-T06 and #709 S8-T03)
- Date: 2026-11-05
- Method: code reading plus unit/axe tests. No browser in this environment; visual checks are [UAT].
- Verdict: D01-D12 all fixed (12 of 12 Pass). 0 Major, 4 new Low findings (N1-N4). Visual checks pending UAT.

Paths: QD = `src/components/question-display`, PL = `src/shells/pembelajaran`.

## 1. D01-D12

| ID | Finding | Fix PR | Evidence (path:line) | Test | Result |
|---|---|---|---|---|---|
| D01 | Essay counter said the teacher grades by band | #709 | `QD/PartInput.vue:118-129` counter text is the helper output only; no "Guru akan" or "band" in `QD/*.vue` (grep: no match) | `s8t07-fixes.test.ts` "D01 essay never says the teacher grades by band; D02 uses the helpers" | Pass |
| D02 | Word counter / over / below-min copy off PRD 46:276,284-285 | #709 | `QD/copy.ts:68-81` (`wordCountLabel`, `wordTargetLabel` "{n} / {min}-{max} patah perkataan", `overLabel`, `shortLabel`); used at `PartInput.vue:125,126,136,145`, `EssayAnswer.vue:54,55,131` | `s8t07-fixes.test.ts` "D02 word target, over and short lines follow 46 2.2.1" and "EssayAnswer word hints (D02)" (below min, within, above max, never blocks) | Pass |
| D03 | "akan tersedia tidak lama lagi" placeholder for unknown kind | #709 | Branch removed: `PartInput.vue` has no "tersedia"; only a doc comment at `QD/AnswerWidget.vue:5` says it is never shown | `s8t07-fixes.test.ts` "D03 an unknown kind renders no notice" | Pass |
| D04 | Missing fallback caption gives empty alt / unnamed zoom button | #709 | `QD/copy.ts:36-44` (all 7 kinds incl. image, infographic, passage); `QD/StimulusFigure.vue:174` chain `alt ?? caption ?? label ?? title ?? kindFallbackCaption ?? qdCopy.figureFallback`; used as `aria-label` `:313` and modal title `:318` | `s8t07-fixes.test.ts` "D04 every stimulus kind has a fallback caption" and "D04 accessible name falls back to label, title, then the kind caption" | Pass |
| D05 | Zoom trigger `opacity:0` hides the focus outline | #709 | `QD/StimulusFigure.vue:311` `background: 'transparent'`, no opacity (grep `opacity`: no match) | `s8t07-fixes.test.ts` "D05 the zoom trigger is transparent, not opacity 0, so the focus ring shows"; ring itself [UAT] | Pass (ring [UAT]) |
| D06 | Account button 40px | #706 | `PL/PembelajaranLayout.vue:453` `size-11` | `shell-a11y.test.ts` "D06 account button is a 44px target (size-11)" | Pass |
| D07 | Nav rows 40px on touch | #706 | `PL/PembelajaranLayout.vue:236-237` `h-10 pointer-coarse:h-12` (both variants) | `shell-a11y.test.ts` "D07 nav link rows are h-10 on fine and pointer-coarse:h-12 on touch" | Pass |
| D08 | Bottom-nav labels 11px | #706 | `PL/PembelajaranLayout.vue:~552` `text-caption leading-tight` (no `text-[0.6875rem]`) | `shell-a11y.test.ts` "D08 bottom-nav labels use the 13px caption role (at least 12px)" | Pass |
| D09 | Live tab was a colour-only red dot | #706 | `PL/PembelajaranLayout.vue:556-561` dot `aria-hidden` plus `<span class="sr-only">{{ dsCopy.statusLive }}</span>`; `ds/copy.ts:63` `'LIVE'` | `shell-a11y.test.ts` "D09 live tab has sr-only text, not colour alone" | Pass (see N1) |
| D10 | "Tidak disajikan" vs "Tidak dihidangkan" contradiction | #709 | `QD/copy.ts:88-90` `Tidak disajikan kerana {reason}.`; used at `QD/NotServedNotice.vue:22`. Only a stale doc comment says "dihidangkan" (`NotServedNotice.vue:4`, N3) | `s8t07-fixes.test.ts` "D10 not-served line says disajikan" | Pass |
| D11 | Visibility fallback total 7 | #709 | `QD/VisibilityList.vue:31` `props.rows.length \|\| 6`; `QD/copy.ts:85` default `total = 6`. (`VisibilityList.vue:65` skeleton shows 7 placeholder rows; not copy, see N2) | `s8t07-fixes.test.ts` "D11 fallback total is 6" | Pass |
| D12 | Drawing photos labelled "Gambar jalan kerja" | #709 | `QD/PartInput.vue:278` `leaf.kind === 'drawing' ? 'Gambar jawapan lukisan' : 'Gambar jalan kerja'` | `s8t07-fixes.test.ts` "D12 the photo list label follows the leaf kind" | Pass |

## 2. Checklist

| Item | Scope | Result | Evidence |
|---|---|---|---|
| Every form control has a label | QD | Pass | McqOptions radios `aria-label` `McqOptions.vue:79`, group `:49`; TextAnswer `TextAnswer.vue:30`; EssayAnswer textarea `:104`, topic group `:73`, topic radios wrapped in `<label>` `:77`; PartInput textarea via `UFormField :label` `PartInput.vue:104`; MathField input/buttons `MathField.vue:246,264,277,338`. axe on McqOptions, TextAnswer, EssayAnswer, NavigatorPanel, PaperView: 0 violations (5 tests). PartInput, MathField, StimulusFigure, VisibilityList are not axe-covered (N4) |
| Every form control has a label | DS primitives used | Pass (code) | `UFormField`/`UInput`/`UTextarea` (Nuxt UI) bind label/aria; `src/ds` suite green; no raw unlabelled inputs in QD |
| Every form control has a label | PL shell | Pass | Account button, theme toggle and nav carry `aria-label`s; `shell-a11y.test.ts` and `pembelajaran-nav.test.ts` green |
| Focus visible | QD | Pass (code), ring [UAT] | MCQ/Essay rows `has-[:focus-visible]:outline-2 ... outline-primary` (`McqOptions.vue:57`, `EssayAnswer.vue:80`); D05 fixed; other controls are UButton defaults |
| Focus visible | PL | Pass (code), ring [UAT] | Skip link `sr-only focus:not-sr-only` `PembelajaranLayout.vue:268`; global ring scoped to `[data-personality]` [UAT] |
| Touch target 44px | QD | Pass (code) | `min-h-11` / `size-11` on MCQ, Essay, Navigator tile (`NavigatorPanel.vue:75`), flag button (`QuestionBlock.vue:107`), zoom, MathField keys, PartInput buttons, VisibilityList. MCQ letter badge `size-8` is decorative inside a 44px row |
| Touch target 44px | PL | Pass (code) | D06 `size-11`, D07 `pointer-coarse:h-12`. `size-10` at `:590` is a decorative avatar in the slide-over, not a control |
| Legend with colour keys | QD | Pass | `NavigatorPanel.vue:93-102` legend `ul` (`nav-legend`) lists Dijawab / Ditanda / Belum with the same glyphs as the tiles; counts line `:44` |
| Status not by colour alone (FR-MUR-QP-16) | NavigatorPanel | Pass | Per-state glyph `stateIcon` `NavigatorPanel.vue:34-37,83-89`, `aria-label "Soalan n, <state>"` `:76`, `aria-current` `:77`; current tile look [UAT] |
| Status not by colour alone | McqOptions | Pass | Verdict has icon plus "Betul"/"Salah" text `McqOptions.vue:118-129`; selection is native `:checked` plus filled letter badge `:83`; selected state without hue [UAT] |
| Status not by colour alone | NotServedNotice, VisibilityList, PL live tab | Pass | Text "Tidak disajikan..." / "Boleh dilihat" / "Tidak boleh dilihat"; live tab sr-only "LIVE" (sighted users still see only the dot, N1) |
| BM copy matches PRD (NFR-2) | `QD/copy.ts`, `src/ds/copy.ts` | See section 3 | 109 matched, 32 D94 |
| Responsive 375/768/1280 | QD, PL | [UAT] | See section 4 |

## 3. Copy comparison

Method: every string literal in `QD/copy.ts` (47) and `src/ds/copy.ts` (98) searched case-insensitively as a substring in `docs/prd/**` (script: `scratchpad/s8t07v/cmp.py`). Substring matching is generous (a short word can match by accident), so "matched" is an upper bound; the unmatched list is exact. Four code fragments caught by the regex (template pieces, a doc-comment fixture, `fillCopy`) are excluded from the lists.

- `question-display/copy.ts`: 47 literals, 30 matched, 14 real strings unmatched.
- `src/ds/copy.ts`: 98 literals, 79 matched, 18 real strings unmatched.
- Total matched 109; D94 "new copy, awaiting approval": 32 (below). The Delivery Lead approves (D94). No copy was changed.

D94, `QD/copy.ts`:
Tulis jawapan… · cth. 3.14… · Jawapan berangka · Tulis jawapan anda di sini… · Tulis karangan anda di sini… · Pilih satu tajuk · Pilih satu tajuk dahulu. · Rajah tidak dapat dimuatkan. · Muatkan rajah untuk meneruskan. · Rajah kekal dipapar · Petikan kekal dipapar semasa menjawab (with pin glyph) · Rajah kekal boleh dibuka semasa menjawab. · `Potongan: {label} {n} x {amount} (maks {cap})` · `Tidak disajikan kerana {reason}.` (the D10 wording)

D94, `src/ds/copy.ts`:
Lagi Penapis · Penapis aktif: · Buang penapis {name} · Menunjukkan {from}-{to} daripada {total} hasil · Menunjukkan 0 daripada 0 hasil · {n} / halaman · Baris setiap halaman · Tiada data dijumpai. · Cuba ubah atau set semula penapis. · tiada perubahan · Jejak navigasi · Seret fail ke sini atau klik untuk memilih · Jeda · Kedudukan audio · Kelajuan · Sedang berputar... · Petunjuk {title} · Data bagi {title}

Outside the two copy files and also not in PRD (from the original audit, not re-counted): component literals (Peta soalan, Langkah n, Tambah langkah, keypad and math-key arias, drawing instruction `PartInput.vue:173-176`) and shell strings (Menu penuh, Menu akaun, Tukar saiz menu). Near-mismatches from the audit (for example "Pilih satu tajuk" vs PRD "Pilih satu daripada {n} gesaan:") are unchanged; the lead decides the source.

## 4. Awaiting UAT (375 / 768 / 1280)

1. D05: zoom trigger focus ring visible (keyboard Tab on a loaded figure).
2. Navbar `UButton` size at 768 (40px?), friend-prompt close icon width.
3. Global focus ring scoped to `[data-personality]` covers the Pembelajaran root.
4. Contrast of warning / success / error / muted text, light and dark (jsdom cannot compute colour-contrast; the axe rule is off).
5. MCQ selected state distinguishable without hue; NavigatorPanel current tile (outline variant).
6. 44px at 375: choose-N row, zoom area; MathKeyboard key width at 320.
7. Bottom nav at 320/375 with caption-size labels (no wrap or overlap, D08); live dot position.
8. No horizontal page scroll on PaperView, Navigator and the attempt shell at all three widths.
9. Screen reader: essay counter `role=status` per keystroke; MathField toggle `aria-label` plus `aria-pressed`.
10. Drawing photo list label read correctly (D12).

## 5. Test run

Command: `npx vitest run --project unit src/components/question-display src/shells/pembelajaran src/ds`

```
Test Files  1 failed | 43 passed (44)
     Tests  488 passed (488)
 FAIL  |unit| src/components/question-display/__tests__/axe.test.ts
 Error: Failed to resolve import "vitest-axe" from ".../axe.test.ts". Does the file exist?
```

Cause: `package.json:116` declares `"vitest-axe": "0.1.0"` and `package-lock.json` lists it, but the shared `node_modules` at `/home/user/prestasiplus` was installed without it (environment, not a code defect; `npm ci` fixes it). The axe file was re-run alone with `vitest-axe@0.1.0` installed in the scratchpad and aliased through a temporary config (removed afterwards):

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

`s8t07-fixes.test.ts` and `shell-a11y.test.ts` are among the 43 passing files.

## 6. New defects

| ID | Severity | path:line | Finding | Proposed owner card |
|---|---|---|---|---|
| N1 | Low | `PL/PembelajaranLayout.vue:553-561` | Live mark is still a red dot for sighted users; the word "LIVE" is `sr-only` only. Meets the D09 audit option (sr-only text) but v2-shells:222 shows a visible "LIVE" badge. Confirm intent at UAT | S0-T06 follow-up |
| N2 | Low | `QD/VisibilityList.vue:65` | Loading skeleton renders 7 placeholder rows while the fixed total is 6 | S8-T03 follow-up |
| N3 | Low | `QD/NotServedNotice.vue:4` | Stale doc comment still says "Tidak dihidangkan" (D10 wording is "disajikan"); comment only | S8-T03 follow-up |
| N4 | Low (test gap) | `QD/__tests__/axe.test.ts` | axe does not cover PartInput, MathField, StimulusFigure, VisibilityList: the components with most controls and the D04/D05/D12 fixes | S8-T03 follow-up (test only) |

Carried notes, unchanged and not defects under D9: QuestionBlock MCQ uses group/`aria-pressed` while McqOptions uses a radiogroup (PRD 46:269); MathKeyboard visible vs accessible key names (WCAG 2.5.3); "Tiket Bantuan" shown for Murid (10-murid:197) to verify.
