# FB-069 WYSIWYG maths input: proposal measurements

Scratch prototype only. No code and no dependency was added to the repository. `mathlive` was installed outside
the repo and aliased in a scratch copy of the app. Screen: Bijak SPM, Mat K2 Set A, Soalan 1(a), "Langkah 1".

Screenshots (keypad open, light, key sequence a/b, 7, next, 3, x2, next, +, sin, 3, 0, degree):

- `FB-069-current-375.png`, `FB-069-current-1280.png`: today's plain input `(7)/(3)^2+sin(30°)` plus the stacked preview.
- `FB-069-wysiwyg-375.png`, `FB-069-wysiwyg-1280.png`: MathLive `<math-field>` driven by the same Casio keypad, the
  formula is edited in place (no separate preview strip, so the sheet's display row is empty).

Note on the sequence: in the current component `▶` after the denominator then `x²` gives `(7)/(3)^2`, which the
preview and the marker read as 7 over 3 squared. In WYSIWYG, `x²` pressed after leaving the fraction squares the whole
fraction, so the equivalent order is: a/b, 7, ▶, 3, x², ▶, +, sin, 3, 0, °. Students used to the current line will
need to learn this order (it follows how a Casio fx-570 behaves).

## Library

- `mathlive` 0.111.1, licence MIT (package.json `"license": "MIT"`; `LICENSE.txt` is the MIT permission text,
  copyright Arno Gourdol). Latest stable at the time of the check.
- Web component, no framework dependency; mounted lazily with `import('mathlive')` from `onMounted`.
- Own virtual keyboard disabled with `mathVirtualKeyboardPolicy = 'manual'`; context menu emptied (`menuItems = []`).

## Size

| Item | Raw | gzip -9 |
|---|---|---|
| Lazy chunk `mathlive.min-*.js` (vite build, split out of AttemptPage) | 801 KB | 216 KB |
| AttemptPage chunk (MathField incl. glue) | 46.8 KB | about the same as today |
| KaTeX woff2 fonts MathLive fetches for the sample (Main, Math-Italic, AMS) | about 70 KB | already compressed |
| Full font folder if copied to `public/` | 300 KB, 20 files | only used files are fetched |

The chunk is fetched the first time a MathField mounts, so every attempt page with a maths question pays about 216 KB
gzip once per session. On 3G that is a noticeable first-field delay (the field must show a placeholder or fall back to
the plain input until it is ready). Brotli was not available to measure. The app already ships KaTeX for the preview;
MathLive carries its own copy of the same fonts (could be pointed at the existing font files).

## Marker check: `latexToPlain(mathfield.value)` and the marker

Real values were produced by pressing the keypad keys in the prototype, then run through `latexToPlain`,
`numericValue`, `matchFinal` (tolerance 0.001) and `answersEquivalent`:

| Answer | `mathfield.value` | `latexToPlain` | Marker |
|---|---|---|---|
| fraction 3/4 | `\frac34` | `((3)/(4))` | match (0.75) |
| fraction with power 7/3^2 | `\frac{7}{3^2}` | `((7)/(3^(2)))` | match (7/9) |
| power 2^3 | `2^3` | `2^(3)` | match (8) |
| sqrt 16 | `\sqrt{16}` | `sqrt(16)` | match (4) |
| sin(30°) | `\sin\left(30\degree\right)` | `sin(30)` | match (0.5) |
| 2 x 10^3 | `2\times10^3` | `2*10^(3)` | match (2000) |
| negative -5 | `-5` | `-5` | match (-5) |
| negative power 2^-1 | `2^{-1}` | `2^(-1)` | match (0.5) |
| 2+3x4, 8÷2, 2π | `2+3\times4`, `8\div2`, `2\pi` | `2+3*4`, `8/2`, `2pi` | all match |
| 7/3^2 + sin(30°) | `\frac{7}{3^2}+\sin\left(30\degree\right)` | `((7)/(3^(2)))+sin(30)` | match (1.2778) |

All 11 sample answers (6 requested plus 5 extra) are accepted with no change to `domain/math-expr.ts`.

Two things to handle if this is built:

1. The degree key must insert `°` as typed text (MathLive stores `\degree`). If the key inserts `^{\circ}` the value is
   `sin(30^{\circ})`, `latexToPlain` turns it into `sin(30^())` and the marker says "unparseable". `\degree` is
   already ignored by `latexToPlain`.
2. An unfilled template leaves `\placeholder{}` in the value (`\frac{\placeholder{}}{\placeholder{}}`). It is
   unparseable (acceptable) but today's "has content" rule (empty `()/()` is not an answer) must be redone on the LaTeX
   value, otherwise an empty fraction counts as "answered" for the navigator and autosave.

Saved answers: answers already stored by the current component are LaTeX made by `plainToLatex`, for example
`\frac{7}{3^{2}}+sin(30°)`. They load into a math-field without error but `sin` shows as italic letters, not upright.
Reload needs a small migration (`sin` to `\sin`) or the step stays readable but not pretty.

## Behaviour and blockers found

- Mobile caret and focus (Chromium, touch emulation, 375): tapping the field focuses it and places the caret; keypad
  keys keep the focus in the field (value and caret stay correct after each key); tapping inside a formula moves the
  caret; Esc closes the keypad and keeps the focus. Not tested on a real iOS Safari or Android keyboard.
- The editable part has `inputmode="none"` (MathLive default), so the phone's own keyboard never opens on tap, even
  with the keypad closed. Today the plain input opens the normal keyboard when the keypad is closed. With MathLive the
  keypad toggle becomes the only way to type on a phone. There is no documented option to change this.
- Layout blocker, fixed in the prototype: a long answer made the field grow to 560 px inside a 299 px column (the
  fieldset's `min-width: min-content` followed the field). `contain: inline-size` on the wrapper plus `max-width:100%`
  fixed it; long lines then scroll inside the field with no page scroll (checked at 375).
- Dark theme: works with theme tokens only (`--ui-bg-elevated`, `--ui-text-highlighted`, `--ui-primary` mapped to the
  MathLive CSS variables `--caret-color`, `--selection-background-color`, ...). Dark renders at 375 and 1280
  were checked in scratch (not committed) and look correct. The fence highlight
  (`--contains-highlight-background-color`) is a light blue band; tune it in the real build.
- Preview strip: not needed any more (the field is the preview); the sheet's display row on mobile becomes empty
  (only "Tutup" stays), so its layout would be reworked.
- Accessibility: MathLive exposes a `textbox` role, takes the `aria-label` from the label and has built-in spoken text
  ("the fraction 7 over 3 squared. End fraction.", English only here). Whether it reads well with TalkBack/VoiceOver
  was not tested.
- Tests: the current keypad tests drive a plain `<input>`. MathLive does not work in jsdom, so component tests need a
  stub or a real-browser (Playwright) test. `applyKey` and the friendly-token keys in `lib/math-keys.ts` would stay
  only as a key to MathLive command map, so some logic and its tests would be replaced.
- Console: the dev server returned several 403 resource errors that also occur without MathLive (external requests in
  the sandbox); none came from MathLive.
