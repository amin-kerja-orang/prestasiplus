# ADR-0034: OCR engine for Kertas Subjektif (PROPOSED, needs user approval)

Status: Proposed. Recommendation: Option A now behind a swappable port; Option C only as an admin-triggered per-page extra after a threat-model decision.
Date: 2026-10-30

## Context
AC-14.12/14.23: digital PDFs use the text layer first; scanned SPM trial papers in Bahasa Melayu need OCR good enough that the admin fixes isolated errors, not whole pages. Tables, maths and "1(a)(i)" numbering are the hard parts. Already in the repo: `modules/ocr` (pdfjs text layer + render, `TesseractEngine` with local `msa` + `eng` traineddata, worker pool, watchdog; default `OCR_ENGINE=none`), `jobs` queue, and the intake page pipeline. The AI adapter (BE-36 `ai-extraction`) is provider-agnostic with a monthly budget in sen, but intake deliberately sends providers local-OCR text only, never a page image (`intake-extraction-input.ts`, v2-threat-model rows 46 and 50).

## Options
| | A. Self-hosted Tesseract (msa+eng) + text layer first | B. Cloud OCR service (e.g. Google Document AI, Azure Document Intelligence, AWS Textract) | C. BE-36 adapter with a vision model |
|---|---|---|---|
| Accuracy on scanned BM exam papers | Known: good on clean 150-300 dpi printed text; weaker on skewed, photocopied, small print; no table or maths structure. To test: BM diacritic-free so `msa` model OK; real trial papers. | Known from vendor claims: strong printed text, tables and layout; BM is supported as Latin script. Handwriting not needed. To test on our papers. | Known: best at layout, tables and simple maths in practice; can drift or paraphrase (hallucination risk), non-deterministic. To test; must verify no "corrections". |
| Cost per page (estimate, verify price lists) | RM 0 (CPU only) | about US$1.5 per 1,000 pages plain OCR (about RM 0.007/page); layout/table models US$10-15 per 1,000 (about RM 0.05-0.07/page) | depends on model; image in + text out about 3-4k tokens, order RM 0.02-0.15 per page |
| Typical paper cost (30 pages paper + skema) | RM 0 | under RM 5 | under RM 10 |
| Ops/hosting | Already coded. Needs `OCR_ENGINE=tesseract`, `OCR_LANG_DIR` with the two traineddata files (a few to about 25 MB), CPU: about 3-8 s per page per worker (to measure), 2 workers default, memory watchdog exists | New vendor account, keys, network egress, retries, per-vendor client; no CPU | Reuses provider config, budget, retries, redaction; needs vision input support in the adapter (not present today: unverified, a change task) |
| Privacy | Fully local; nothing leaves the server | Page images leave to a third party and a region (exam content, no pupil data) | Same, and breaks the current rule "provider never receives a page image" (threat-model rows 46/50) |
| Quota interplay | None: separate job types, uses `OCR_WORKERS` pool; no AI budget, no intake daily page quota | None with AI quota; own cost control needed | Consumes the AI monthly budget (sen), warn at 80%, refuse at 100% (`AI_BUDGET_EXHAUSTED`); a 50-page upload may use a visible part of the cap |
| Tables / maths | Heuristic table detection from text-layer geometry; scans: tables become flagged "Jadual (imej)" figures; maths flagged | Tables native in layout models; maths not as LaTeX | Tables and simple LaTeX plausible |
| Risk | Quality ceiling; admin edit load on scans | Vendor lock, cost drift, data egress approval | Hallucination, budget, privacy rule change |

## Recommendation
**A for go-live**, through a `DocumentReader` port so B or C can replace the page-reading step without touching the document model, upload flow or review flags. Reasons: zero cost and zero new privacy surface; everything except the engine setting is already built; the feature is flag-OFF at go-live so quality can be measured first; text-layer PDFs (the usual state exam files) bypass OCR. Before turning the flag ON run a bake-off of A vs C on 5 real scanned papers (error count per page, minutes of admin editing). If A fails the bar, switch the reader to C (needs a user decision on the privacy rule and the budget) or B.

Per-page "Baca semula dengan AI" (option C as an admin click, not automatic) is a follow-up, not in this scope.

## Consequences
- Ops: set `OCR_ENGINE=tesseract` and ship traineddata in the API image (devops task).
- New env keys: `KERTAS_MAX_FILE_MB` (20), `KERTAS_MAX_PAGES` (40), `KERTAS_FLAG_CONFIDENCE` (75).
- No change to `ai-extraction` or the intake quota.
