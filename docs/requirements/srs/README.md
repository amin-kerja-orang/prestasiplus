# `docs/requirements/srs/` — module SRS files

One file per module: **`Mxx-<slug>.md`**, e.g. `M05-practice.md`.

- `Mxx` — two-digit module number, matching `docs/TRACKER.md` §3 (module board) and `docs/requirements/SRS.md` §8 (module index).
- `<slug>` — short kebab-case name, identical to the matching file in `docs/requirements/urs/` (see the slug column in `docs/requirements/SRS.md` §8 so links never break):

  `M01-authentication` · `M02-users-schools` · `M03-curriculum` · `M04-question-bank` · `M05-practice` · `M06-spm` · `M07-pksk` · `M08-student-performance` · `M09-content` · `M10-teacher-class` · `M11-teacher-analytics` · `M12-kirkpatrick` · `M13-cikgu-alesa` · `M14-gamification` · `M15-rewards-shop` · `M16-battle-games` · `M17-admin-dashboard` · `M18-ppd-jpn` · `M19-finance` · `M20-marketplace` · `M21-sponsorship` · `M22-notifications-support` · `M23-system-admin` · `M24-duta` · `M25-pusat-ai` · `M26-special-features`

Every file follows the template in `docs/requirements/SRS.md` §10 (Scope, Screens & routes, Functional requirements, Business rules, Validation rules, Data entities & fields, Mock API endpoints, States & messages, Permissions matrix, Responsive behaviour, NFRs, E2E test scenarios, Open questions), and uses requirement IDs `FR-Mxx-nn` / `NFR-Mxx-nn` / `DATA-Mxx-nn` / `E2E-Mxx-nn` per §9 of that document.

A module's SRS file is written from its URS file (`docs/requirements/urs/Mxx-<slug>.md`) — every `FR-Mxx-nn` here must trace to a `UR-Mxx-nn`/`US-Mxx-nn` there (see traceability convention, SRS §11). E2E scenarios run on three Playwright viewport projects (mobile 375×812, tablet 768×1024, desktop 1280×800) per the global responsive NFR (SRS §6.2, NFR-RESP).
