# PrestasiPlus Rebuild — User Requirements Specification (URS)

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — Master |
| Version | 0.1 |
| Date | 2026-09-25 |
| Status | Draft |
| Author | product-analyst (agent) |
| Owner | Project owner (rosliamir16@gmail.com) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-25 | Initial master URS: scope, user classes, module index, global UR, glossary, ID convention, module template. |

---

## 1. Purpose

This document states **what the people who use PrestasiPlus need the system to do**, in user-facing terms, independent of implementation. It is the master index and shared reference for 26 per-module URS files (`docs/requirements/urs/Mxx-<slug>.md`), one per module on the project board.

Each module URS elaborates its module's user stories and acceptance criteria; this master document defines the things every module shares: scope, user classes, the requirement-ID scheme, the glossary, and requirements that apply system-wide (`UR-G-xx`).

## 2. Scope

**In scope for this phase (G1 — Requirements):**
- Requirements for a **front-end prototype** of all 26 modules cloned from the live system at `prestasiplus.my`, built with dummy data and no real backend.
- Requirements for **Playwright E2E test coverage** implied by the user stories (test scenarios are specified at SRS level, traced back to these requirements).

**Out of scope for this phase:**
- The public marketing/landing page of `prestasiplus.my` (not part of the rebuild).
- Any real backend, database, authentication provider, payment gateway, or AI provider — these are simulated in the prototype (see decisions D2 and D4 below) and will be specified in a later backend phase.
- Requirements discovery itself — module-by-module discovery (`docs/discovery/Mxx-*.md`) is run by a separate discovery agent and is a **source** for this document, not part of it.

**Scope decisions carried over from the tracker** (see reference below), binding on this document:

| # | Decision |
|---|---|
| D1 | Deliverable = FE prototype + dummy data + E2E tests for all 26 modules. No real backend yet. |
| D2 | Prototype talks to a mock data/service layer shaped like a future REST API, so a real backend can replace it later without a UI rewrite. |
| D3 | All 26 modules are in scope, including `DEV`-tagged items, Pusat AI, and "Killer Features" (Phase F — last, since nothing else depends on them). |
| D4 | AI features (M13, M25, parts of M06) are simulated with canned responses; payments (M19) are simulated with fake gateway states. No external services are called. |
| D5 | The SRS documents full system behaviour, including inferred server-side rules, so it can serve the later backend phase too. |

## 3. References

- `docs/TRACKER.md` — project tracker: scope decisions, 26-module board, route inventory, user roles, per-module G1 workflow, open questions.
- `docs/discovery/Mxx-<slug>.md` — per-module discovery notes and screenshots (source evidence for user stories; written by the discovery agent, not by this document).
- `docs/requirements/SRS.md` — master Software Requirements Specification (functional/non-functional detail derived from this URS).
- `docs/requirements/urs/Mxx-<slug>.md` — per-module URS files (see module index, §5).

## 4. System overview

PrestasiPlus is a Malaysian K-12 drill-and-practice education platform (UI in Bahasa Melayu) covering Darjah 1–6 (primary) and Tingkatan 1–5 (secondary), with roughly 128,989 questions across 31 subjects. In plain terms, the system:

- Lets **students** drill exam-style questions by subject/level/topic ("Latih Tubi"), sit SPM-focused practice and mock exams, track their own mastery and progress, earn gamified rewards, and get AI-assisted help (dictionary, essay marking, motivational tools).
- Lets **teachers** manage their classes, set questions/homework, monitor and report on student performance, run Kirkpatrick-style training evaluation, and get AI lesson-planning/marking assistance ("Cikgu Alesa").
- Lets **admins** manage the question bank, curriculum, users and schools, content (articles/notes/video), gamification and rewards economy, finance/subscriptions, marketplace, sponsorships, and system-wide settings/audit.
- Gives **district (PPD) and state (JPN) education officials** oversight dashboards, benchmarking, and early-warning reporting across schools in their area.
- Supports supporting programmes: an ambassador/referral programme ("Duta"), a sponsorship programme for underprivileged students ("Anak Angkat"), and a set of "special features" (wellbeing alerts, vision/goal-setting tools, an AI centre).

The system is organised into 26 modules (M01–M26) grouped into six build phases (see §5).

## 5. Module index

Phase order is the recommended build order (foundation first); it is not a priority ranking for requirements-writing, which proceeds module by module per the tracker's G1 workflow.

| ID | Module | Phase | Portal | URS file |
|---|---|---|---|---|
| M01 | Authentication & Account | A | Public / All | [urs/M01-authentication.md](urs/M01-authentication.md) |
| M02 | Users & Schools Management | A | Admin | [urs/M02-users-schools.md](urs/M02-users-schools.md) |
| M03 | Curriculum (Subjects, Levels, Topics) | A | Admin / Student | [urs/M03-curriculum.md](urs/M03-curriculum.md) |
| M04 | Question Bank | A | Admin / Student | [urs/M04-question-bank.md](urs/M04-question-bank.md) |
| M05 | Practice & Drills (Latih Tubi) | B | Student | [urs/M05-practice.md](urs/M05-practice.md) |
| M06 | SPM | B | Admin / Student | [urs/M06-spm.md](urs/M06-spm.md) |
| M07 | Premium PKSK | B | Admin / Student | [urs/M07-pksk.md](urs/M07-pksk.md) |
| M08 | Student Performance & Analytics | B | Student | [urs/M08-student-performance.md](urs/M08-student-performance.md) |
| M09 | Content (Articles, Notes, Video, Audio) | B | Admin / All | [urs/M09-content.md](urs/M09-content.md) |
| M10 | Teacher Portal — Class & Teaching | C | Teacher | [urs/M10-teacher-class.md](urs/M10-teacher-class.md) |
| M11 | Teacher Portal — Analytics & Reports | C | Teacher | [urs/M11-teacher-analytics.md](urs/M11-teacher-analytics.md) |
| M12 | Kirkpatrick Evaluation | C | Admin / Teacher | [urs/M12-kirkpatrick.md](urs/M12-kirkpatrick.md) |
| M13 | Cikgu Alesa (AI Teacher Assistant) | C | Teacher / Student | [urs/M13-cikgu-alesa.md](urs/M13-cikgu-alesa.md) |
| M14 | Gamification (Coins, Tokens, Challenges) | D | Admin / Student / Teacher | [urs/M14-gamification.md](urs/M14-gamification.md) |
| M15 | Rewards Shop & Redemption | D | Admin / Student / Teacher | [urs/M15-rewards-shop.md](urs/M15-rewards-shop.md) |
| M16 | Battle, Games & Competitions | D | Admin / Student | [urs/M16-battle-games.md](urs/M16-battle-games.md) |
| M17 | Admin Dashboard & Analytics | E | Admin | [urs/M17-admin-dashboard.md](urs/M17-admin-dashboard.md) |
| M18 | PPD & JPN (District/State) | E | PPD / JPN | [urs/M18-ppd-jpn.md](urs/M18-ppd-jpn.md) |
| M19 | Finance & Subscriptions | E | Admin / All | [urs/M19-finance.md](urs/M19-finance.md) |
| M20 | Marketplace | E | Admin / Seller / Student | [urs/M20-marketplace.md](urs/M20-marketplace.md) |
| M21 | Sponsorship & Anak Angkat | E | Admin / Public | [urs/M21-sponsorship.md](urs/M21-sponsorship.md) |
| M22 | Notifications & Support | E | Admin / All | [urs/M22-notifications-support.md](urs/M22-notifications-support.md) |
| M23 | System Administration | E | Admin | [urs/M23-system-admin.md](urs/M23-system-admin.md) |
| M24 | Ambassador Programme (Duta) | F | Admin / Duta | [urs/M24-duta.md](urs/M24-duta.md) |
| M25 | AI Centre (Pusat AI) | F | All | [urs/M25-ai-centre.md](urs/M25-ai-centre.md) |
| M26 | Vision & Special Features | F | All | [urs/M26-special-features.md](urs/M26-special-features.md) |

Status of each file (draft / in review / approved) is tracked in `docs/TRACKER.md` §3 (columns URS, SRS, G1), not duplicated here.

## 6. User classes

Roles as inventoried in `docs/TRACKER.md` §5. Discovery to date used a single admin account that can see every menu, so **only the admin role's existence is directly confirmed by login**; every role's specific permissions (what it can/cannot see or do) are inferred from menu structure, URL naming, and domain knowledge of Malaysian schooling, and must be verified module by module as each module's discovery/URS is written.

| Role | Description | Goals | Verified |
|---|---|---|---|
| Admin | Platform operator/staff; sees and manages every module via `/admin/*`. | Manage content, users, curriculum, question bank, finance, and monitor system health and academic outcomes platform-wide. | Partial — account access confirmed; full permission boundaries (e.g. sub-admin roles) not yet observed, inferred |
| Student (Pelajar) | K-12 learner, Darjah 1–6 or Tingkatan 1–5; primary end user. | Practice/drill questions, prepare for SPM, track own progress and mastery, earn rewards, get help. | No (inferred) |
| Teacher (Guru) | Subject/class teacher. | Manage class and students, set questions/homework, monitor class performance, evaluate training impact (Kirkpatrick), get AI lesson-planning help. | No (inferred) |
| Parent (Ibu Bapa) | Parent/guardian of a student. | Follow child's progress and wellbeing; referenced via "Parent Whisperer" AI tool and parent-guide content; no dedicated portal observed yet. | No (inferred) |
| PPD (District Education Office) | District-level education officer. | Oversight of schools in a district: usage stats, rankings, benchmarks, heat maps, early warnings. | No (inferred) |
| JPN (State Education Department) | State-level education officer. | Same as PPD but state-wide scope. | No (inferred) |
| Ambassador (Duta) | Student/teacher/volunteer promoting the platform. | Access ambassador academy/room, track referral/campaign progress. | No (inferred) |
| Seller | Marketplace vendor. | List and manage products sold to students/schools via the marketplace. | No (inferred) |
| Sponsor | Individual/organisation funding "Anak Angkat" (sponsored/adopted students). | Sponsor students, view impact of sponsorship. | No (inferred) |
| Tuition centre | External tuition centre partner. | Access a tuition-centre-specific area (`/pusat-tuisyen/*`); exact capabilities unconfirmed. | No (inferred) |

Verification happens per module: each module URS/SRS must confirm or correct the relevant rows in its **Actors** section, and flag corrections back to this table as an open question if the correction affects other modules.

## 7. Global user requirements (UR-G)

These apply to every module unless a module explicitly overrides one (override must be justified in that module's URS).

| ID | Requirement | Rationale |
|---|---|---|
| UR-G-01 | As any user, I want the entire UI in Bahasa Melayu, so that it matches the live system and is usable by Malaysian students/teachers/officials without translation. | Live system UI is BM throughout. |
| UR-G-02 | As a user on any device — phone, tablet, or desktop/laptop — I want the app's layout, navigation, and content to adapt cleanly to my screen size and orientation, so that I get a usable experience whether I'm a student practising on a phone between classes, a teacher checking a tablet in class, or an admin working at a desktop. | Students are the largest, most mobile-first user group, but teachers/admins/PPD/JPN commonly use tablets or desktops; the live system and its clone must work well across all of them. See NFR-RESP in SRS for concrete, testable breakpoints and behaviour. |
| UR-G-03 | As any user, I want the interface usable with a keyboard and screen reader, so that users with disabilities are not excluded. | Accessibility is a baseline expectation for an education platform; see NFR-02 in SRS. |
| UR-G-04 | As a user of any role, I want to see only the menus, pages, and actions relevant to my role, so that the app isn't confusing or exposing things I can't use. | Prototype must simulate role-based access even without a real backend (per D2). |
| UR-G-05 | As a logged-in user, I want to know who I am and be able to log out from any page, so that I trust the session and can leave safely on shared devices. | Common school/lab-computer usage pattern. |
| UR-G-06 | As a user, I want clear feedback when something is loading, empty, or has failed, so that I'm never staring at a blank or frozen screen. | Consistency requirement for the mock-data prototype (no real network variability yet, but UX must anticipate it). |
| UR-G-07 | As a user, I want form validation errors shown next to the field in BM, so that I can fix mistakes without guessing. | Consistency across ~210 routes/forms. |
| UR-G-08 | As a user with notifications, I want a single notification bell shared across the app, so that I don't miss updates regardless of which module triggered them. | `/notifikasi` is shared across M01 and M22. |
| UR-G-09 | As a user browsing a list/table (users, questions, reports, etc.), I want consistent search, filter, sort, and pagination behaviour, so that I can learn the pattern once and reuse it everywhere. | ~210 routes include many admin list screens. |
| UR-G-10 | As a stakeholder, I want the prototype's data and flows to be realistic (Malaysian names, subjects, levels, question content), so that reviewing the prototype feels like reviewing the real product. | Dummy data quality affects stakeholder review (G1/later gates). |
| UR-G-11 | As a QA engineer, I want every primary user flow covered by an automated E2E test, so that regressions are caught without manual re-testing of ~210 routes. | Deliverable per D1. |
| UR-G-12 | As a future backend developer, I want the mock data layer's shape to mirror a real REST API, so that swapping in a real backend later doesn't require a UI rewrite. | Per D2; detailed in SRS §7 (data & interface conventions). |

## 8. Glossary

Malaysian education / platform-specific terms seen across the tracker and discovery notes. Full definitions belong in each module's URS where a term is central to that module; this is the shared quick reference.

| Term | Meaning |
|---|---|
| SPM | *Sijil Pelajaran Malaysia* — Malaysia's national secondary-school leaving exam (like O-Levels), sat in Tingkatan 5. |
| PKSK | *Pentaksiran Kemasukan Sekolah Khusus* — the entrance assessment for special/residential schools (SBP, MRSM, SMKA); on the student side "Persediaan Kemasukan SBP / MRSM / SMKA". Premium track (module M07) at two levels: T1 (Tingkatan 1 entry, sat in Darjah 6) and T4 (Tingkatan 4 entry, sat in Tingkatan 3); 3 Bahagian, 15 domains. Confirmed in M07 discovery. |
| KBAT | *Kemahiran Berfikir Aras Tinggi* — Higher-Order Thinking Skills; a question/content category. |
| PBD | *Pentaksiran Bilik Darjah* — Classroom (formative) Assessment, a Malaysian MOE assessment approach; module M13 offers AI help for it. |
| RPH | *Rancangan Pengajaran Harian* — Daily Lesson Plan; teachers prepare this per lesson; M13 offers an AI generator. |
| PPD | *Pejabat Pendidikan Daerah* — District Education Office; oversees schools within a district. |
| JPN | *Jabatan Pendidikan Negeri* — State Education Department; oversees PPDs/schools within a state. |
| Darjah | Primary school year/grade, Darjah 1–6 (ages ~7–12). |
| Tingkatan | Secondary school year/grade, Tingkatan 1–5 (ages ~13–17). |
| Latih Tubi | Literally "drill practice" — repetitive exam-style question practice; core learning loop of the platform (module M05). |
| Duta | "Ambassador" — student/teacher/volunteer promoting the platform (module M24). |
| Anak Angkat | Literally "adopted child" — the platform's student sponsorship programme, pairing sponsors with underprivileged students (module M21). |
| Kirkpatrick levels | Kirkpatrick training-evaluation model: T1 Reaction, T2 Learning, T3 Behaviour, T4 Results — used here to evaluate teaching/training impact (module M12). |
| Peta Belajar | "Learning map" — a student-facing curriculum/topic navigation view (module M03). |
| Penguasaan | "Mastery" — a student's per-topic mastery level (module M05/M08). |
| Misi Harian | "Daily mission" — a gamified daily task (modules M05/M14). |
| Pembetulan | "Correction" — review/redo of previously wrong answers (module M05). |
| Prestasi | "Performance/achievement" — the student performance/analytics area (module M08); also the product name "PrestasiPlus". |
| Command Center | A live operations dashboard variant present for admin, teacher, and PPD portals (modules M10, M17, M18). |
| Headcount | Enrolment/attendance count view (module M08). |
| Cikgu | Informal/respectful Malay term for "teacher"; used as the AI assistant's persona name, "Cikgu Alesa" (module M13). |
| Tetapan / Settings | Personal or system settings screens (modules M01, M23). |
| IC number | *Kad Pengenalan* — Malaysian national identity card number; used as an alternate identity/password-reset credential (module M01). |
| PDPA | *Personal Data Protection Act 2010* — Malaysia's data protection law; relevant to any personal data handling (see SRS NFR). |
| Pusat Tuisyen | "Tuition centre" — an external partner entity/portal area (modules M22, M26). |
| Bilik Duta | "Ambassador room" — hub area for the Duta programme (module M24). |
| Cabutan | "Lucky draw" — a rewards redemption mechanic (module M15). |
| Kombo | "Combo/streak" — a gamification streak mechanic (module M14). |

## 9. Requirement ID convention

| Scope | Pattern | Example |
|---|---|---|
| Global user requirement (this document) | `UR-G-nn` | `UR-G-04` |
| Module user requirement | `UR-Mxx-nn` | `UR-M05-03` |
| Module user story | `US-Mxx-nn` | `US-M05-03` |
| Module acceptance criterion | `AC-Mxx-nn.m` (nn = story number, m = criterion index) | `AC-M05-03.2` |
| Epic | `EP-Mxx-n` | `EP-M01-2` |
| Feature (within an epic) | `FT-Mxx-n.n` | `FT-M01-2.3` |
| Function (within a feature) | `FN-Mxx-n.n.n` | `FN-M01-2.3.4` |
| Live UI element (from discovery inventory) | `EL-Mxx-<screen>-nnn` | `EL-M01-S2-014` |

IDs are stable once assigned: do not renumber existing IDs when adding new ones (append instead), so SRS/E2E traceability links never break.

## 10. Template for a module URS file

Every `docs/requirements/urs/Mxx-<slug>.md` uses this structure:

```markdown
# M<nn> — <Module Name> — User Requirements Specification

## 0. Document control
Version, date, status, source discovery doc link.

## 1. Overview
1-2 paragraphs: what this module is for, in plain terms, and which routes
(from docs/TRACKER.md §4) it covers.

## 2. Actors
Table: role | involvement in this module | verified (yes/no/inferred).
Confirm or correct the relevant rows from URS.md §6.

## 3. Functional breakdown (Epic → Feature → Function)
Hierarchy of everything the live module does, derived from the discovery
inventory — not from judgement:
- EP-Mxx-n  Epic: a user goal area (e.g. "Account access").
  - FT-Mxx-n.n  Feature: a screen or capability (e.g. "Login").
    - FN-Mxx-n.n.n  Function: one atomic behaviour (e.g. "Show/hide
      password toggle", "Remember me", "Link to reset via IC").
Every function lists: screen/route, live UI element IDs (EL-…) it covers,
roles, and source (OBSERVED / INFERRED).

## 4. User stories
US-Mxx-01, … "As a <role>, I want <capability>, so that <benefit>."
Each story belongs to one Feature (FT-…) and lists the Functions (FN-…) it
covers. MoSCoW priority.

### Acceptance criteria
Given/When/Then, IDs AC-Mxx-nn.m, one block per story, each criterion
independently testable/verifiable by QA. Use exact live BM copy.

## 5. UI expectations
Key screens/states expected (list view, detail/edit, empty state, etc.),
referencing discovery screenshots. Behavioural/content expectations only.

## 6. Coverage matrix (completeness proof)
Table: every live UI element from the discovery inventory
(`docs/discovery/inventory/Mxx/`) → the FN-… that covers it, or an
explicit reason it is excluded. Summary line: "N/N elements covered,
0 unmapped". A module cannot pass G1 with any unmapped element.

## 7. Fidelity deviations
Every place the rebuild intentionally behaves differently from the live
site (only allowed for: broken/404 links, visual/responsive defects,
contradictory rules that need one value). Table: live behaviour | rebuild
behaviour | reason | user decision. Anything not listed here MUST match
live behaviour.

## 8. Out of scope
Explicitly excluded behaviour for this module (e.g. real backend calls).

## 9. Open questions
Numbered list. Anything inferred rather than confirmed by discovery must
appear here if it materially affects behaviour, marked "(inferred)".
```

## 11. Open questions (master-level)

| # | Question | Status |
|---|---|---|
| UQ1 | Confirm PKSK's full expansion and purpose (see glossary) during M07 discovery/URS. | Closed — "Pentaksiran Kemasukan Sekolah Khusus" (M07 discovery) |
| UQ2 | Parent, PPD, JPN, Ambassador, Seller, Sponsor, and Tuition-centre role permissions are entirely inferred (no non-admin account available). Each module touching these roles must flag its own inferred rules; a follow-up pass with real role accounts (if ever available) should re-verify this table. | Open — tracked per module |
| UQ3 | Overlap/duplication flagged in the tracker (`/ranking` in both M08 and M16; `/admin/laporan` possibly M12 vs M17; `/admin/audit-log` vs `/admin/audit-logs`; `/admin/performance` system vs academic) must be resolved when those modules' discovery/URS are written. | Open — tracked in `docs/TRACKER.md` §4 |
