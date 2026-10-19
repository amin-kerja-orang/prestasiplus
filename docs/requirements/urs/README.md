# `docs/requirements/urs/` — module URS files

One file per module: **`Mxx-<slug>.md`**, e.g. `M05-practice.md`.

- `Mxx` — two-digit module number, matching `docs/TRACKER.md` §3 (module board) and `docs/requirements/URS.md` §5 (module index).
- `<slug>` — short kebab-case name, fixed per module (see the slug column in `docs/requirements/URS.md` §5 so links never break):

  `M01-authentication` · `M02-users-schools` · `M03-curriculum` · `M04-question-bank` · `M05-practice` · `M06-spm` · `M07-pksk` · `M08-student-performance` · `M09-content` · `M10-teacher-class` · `M11-teacher-analytics` · `M12-kirkpatrick` · `M13-cikgu-alesa` · `M14-gamification` · `M15-rewards-shop` · `M16-battle-games` · `M17-admin-dashboard` · `M18-ppd-jpn` · `M19-finance` · `M20-marketplace` · `M21-sponsorship` · `M22-notifications-support` · `M23-system-admin` · `M24-duta` · `M25-pusat-ai` · `M26-special-features`

Every file follows the template in `docs/requirements/URS.md` §10 (Overview, Actors, User stories + acceptance criteria, UI expectations, Out of scope, Open questions), and uses requirement IDs `UR-Mxx-nn` / `US-Mxx-nn` / `AC-Mxx-nn.m` per §9 of that document.

Do not create a URS file here until that module's discovery doc (`docs/discovery/Mxx-*.md`) exists — discovery is the evidence source for user stories.
