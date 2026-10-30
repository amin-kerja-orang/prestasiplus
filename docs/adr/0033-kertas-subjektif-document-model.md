# ADR-0033: Kertas Subjektif is an editable rich document (paper + skema) with OCR review flags

Status: Proposed
Date: 2026-10-30
Decision source: D81 (upload -> OCR -> sunting -> terbit), FD-10.

## Context
.cloud stores Kertas 2/3/4 as page images (CLI-only import), unreadable on a phone. D81 replaces that with an editable document. It is not a question store (no DSKP, no marking), so it does not violate D11/D12; it gets its own owner module `kertas-subjektif`.

## Decision
1. Tables (migration 0104): `kertas_papers` (metadata + `status draft|published`, `published_at`), `kertas_documents` (one row per paper per role `paper|skema`, `content jsonb`, `content_version`, `processing_status none|processing|ready|failed`, `failure_code`, `source_file_id`, `page_count`, `engine`), `kertas_document_pages` (OCR/text result per page, bbox blocks, confidence), `kertas_document_sections` (block id, page, confidence, `flagged`, `reason`, `reviewed_at/by`). Page images and figures are `files` rows (new purposes `kertas_source_pdf`, `kertas_page`, `kertas_figure`).
2. `content` is a ProseMirror/TipTap-compatible JSON tree validated by a Zod schema in `packages/contract/src/kertas/document.ts`; raw HTML is never stored. Node set: `heading(level 1..3)`, `paragraph`, `bulletList/orderedList`, `table(row, headerCell, cell)`, `figure(fileId, width, height, caption)`, `math(latex, display)`, and inline `marks(value)` for "[3 markah]". Every top-level block has a stable `id`. Question numbering "1(a)(i)" is stored as text with a `numbering` attribute on the paragraph so it survives edits.
3. Review flags live in `kertas_document_sections` keyed by block id (not inside the content). A flagged block is resolved by `accept` or by any edit that changes the block hash (server compares). `Terbit` requires: not processing; document has at least one text or figure block; zero unresolved flags. Skema is optional.
4. Publish sets `status='published'`; a student sees the last published content only when the paper is published and flag `kertas-subjektif` is on. Re-upload while published creates the new document state as draft content only after confirm; the published view continues to read the content snapshot stored at publish (`kertas_documents.published_content`). The published snapshot is a second jsonb column so editing never leaks to students.
5. Attach to Simulasi (AC-14.8/14.25): `paper_sections.kertas_paper_id` (nullable FK) on a document Bahagian; the student paper embeds the published snapshot read-only.
6. Security: only Admin Pusat reads or writes drafts and their figures; files with purpose `kertas_figure` are readable by a pupil only when the owning paper is published and the flag is on.

## Consequences
- Editing is standard TipTap on the FE (the `RichText.vue` infrastructure); the server validates schema and size (max 1 MB content, 400 blocks).
- Optimistic concurrency by `content_version` (409 on mismatch; autosave sends the version).
- Follow-up (not in scope): convert sections to bank questions via intake review.
