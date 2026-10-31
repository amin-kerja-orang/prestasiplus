# Requests from team A (writer: team A lead)

| ID | To | Raised (MYT) | Unit / task | What is needed | Why / blocks | Status |
|---|---|---|---|---|---|---|
| REQ-A-001 | B (B1) | 2026-10-31 19:05 | T36 | Switch the e2e workflows off PoC papers before merging T36 (`BIJAK_POC_QUESTIONS` true at compose.http.yaml:31, render.yaml:27, .github/workflows/e2e-http.yml:74, frontend.yml:102); use the T26 e2e seed | After T36, PoC papers are not playable (403) | OPEN |
| REQ-A-002 | C (C3/C1/C2) | 2026-10-31 19:05 | H-C3…H-C8 on BOARD | FE follow-ups listed on BOARD (essay_choice label, Arkib button, Mula BM message, evidence drawer skema rule, own-stimuli StimulusStack, kuiz own stimuli) | API side is done on team A branches | OPEN |
| REQ-A-003 | C (C2) | 2026-10-31 19:10 | T11 kuiz / AC-R1-18.4 | Per-paper Kuiz (`GET /bijak/kuiz/papers/:id` paperPage + paperCheck in `kuiz.service.ts`) must not show a question that was archived after Terbit: follow the H-A13 rule (new sitting refused with "Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.", or drop the archived question with that note). Random Kuiz already excludes it (A2 T42 spec). | AC-R1-18.4: an archived (reported) question must leave the Kuiz; today the per-paper Kuiz still shows the pinned snapshot | OPEN |
