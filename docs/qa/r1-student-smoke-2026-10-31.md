# R1 student smoke test (Bijak SPM and other tests/quizzes), 2026-10-31

Naming: V1 = prestasiplus.my, V2 = prestasiplus.cloud (reference), V3 = this repo.
Stack: http://localhost:5192 (real API + DB, owned by another session; nothing rebuilt, restarted or reseeded).
Account: `murid4@demo.test` (Tingkatan 4, SMK Demo Satu). Browser: Microsoft Edge via Node Playwright (`channel: 'msedge'`) at 375 / 768 / 1280.
Reference docs: `docs/discovery/cloud-student-mechanism.md`, `docs/discovery/v2-parity/student.md`.
Scripts and screenshots: `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-prestasiplus\8858a3c7-b567-49a0-8982-aff5c522c55a\scratchpad\qa-student-smoke\` (screenshots in `shots\`; names below are relative to `shots\`).
Side effects: the demo account now has extra practice sessions, 3 Bijak attempts and extra coins.

## 1. Summary

| Activity | Result | One line |
|---|---|---|
| Bijak SPM (hub, cover, attempt, autosave, Hantar, Semakan) | PASS with gaps | 5 papers visible. MCQ, short text, numeric/working and essay widgets render. Autosave and resume work. No self-mark; text answers stay "perlu semakan". |
| Databank Soalan SPM | PASS | Count 5/10/20, check-answer, result with rewards. |
| Latih Tubi (`/practice`) | PASS | Level, difficulty, count, answer, result. |
| Latih Tubi SPM (`/spm/latih-tubi`) | PASS | Starts the 40-question Target SPM set (not run to the end). |
| Soalan by Chapter | FAIL | Page is empty: no subject or bab list, no empty-state message. |
| SPM Mock Kertas 1 / Kertas 2 (`/spm-mock`) | MISSING | Redirects to /dashboard (out of prototype scope). |
| Soalan Aku Salah (revision) | PASS | Lists only wrong answers and runs as a quiz. |
| Simulasi Kuiz | MISSING | `/simulasi/kuiz` redirects to /dashboard. |
| Soalan Berstruktur (extra) | PASS with defect | Stem rows shown as answer boxes. |
| Tracking A, Subjektif, Remedial (extra) | Hub only | Not run. |

Responsive: no horizontal page scroll on the 13 student screens checked at 375 and 768, nor on the quiz/attempt screens at 375/768/1280.

## 2. Bijak SPM (priority)

Papers visible to the student: YES, 5 (`GET /api/bijak/papers` and `/spm/bijak`). Demo/PoC papers are enabled on this stack: titles carry "(Contoh)" and the data is the PoC seed profile. The 5 papers are Matematik K1 Set A (10 Q, 75 min), Matematik K2 Set A (6 Q, 150 min), Sains K2 Contoh Pendek (5 Q, 60 min), Sejarah K2 Contoh Pendek (4 Q, 90 min) and Latihan Demo Matematik Bank Soalan (6 Q, 20 min). Subjects: MAT, SN, SEJ. History already had 2 attempts.

| Step | Result | Seen vs V2 | Network / console | Evidence |
|---|---|---|---|---|
| Hub / Kertas Pilihan list | PASS | Grouped by subject; cards show Kertas, markah, minit, year, last score, "Mula" or "Cuba lagi". Tabs "Kertas Pilihan" and "Jana Kertas". Subject/kertas filters. | none | bijak-hub-1280.png, r_spm_bijak-375.png |
| Cover | PASS | SULIT and code, subject, Kertas, minit, markah, soalan, numbered Arahan, per-Bahagian rule ("Jawab 1 daripada 2 soalan"), mode chooser (Mod Peperiksaan / Mod Latihan). No "Untuk Kegunaan Pemeriksa" grid seen. | none | bijak-cover-p3.png |
| Resume | PASS | Same as V2: "Masa berlalu setakat ini", Sambung / Mula Semula, "Mula semula?" confirm. | `POST /bijak/attempts` 200 (resume), 201 (new) | bijak-cover-resume.png |
| Start attempt | PASS | Full-screen runner, title, "Mod Peperiksaan", countdown (58:03 on a 60 min paper), Kombo counter. | `POST /bijak/attempts` 201 | bijak-attempt-p3-1280.png |
| Stimulus / diagram | PASS (inline SVG only) | "Rajah 1" SVG cell diagram with caption beside the question. Other stimulus kinds are not in the seed. | none | bijak-attempt-p3-1280.png |
| MCQ widget (Mat K1) | PASS | Options A-D with rendered fractions; pick survives reload. | `PUT /attempts/:id/answers` 200 | bijak-mcq-q1-375.png |
| Short text (Sains Q1) | PASS | One textarea per sub-part (a)(b)(c) with "[1 markah]". | PUT answers 200 | q1-p3-1280.png |
| Numeric / working (Sains Q3, Mat K2) | PASS | "Jalan kerja" steps, "Jawapan akhir" with live preview, "Tambah langkah", "Ambil gambar jalan kerja" (file input), decimal keypad. | PUT answers 200 | q3-p3-1280.png, math-q-768.png |
| Essay (Sejarah Q4) | PASS | Textarea with "3 patah perkataan, sasaran 100-200" counter and "Guru akan menilai esei ini mengikut band". | PUT answers 200 | q4-p4-768.png |
| Choose-N (Bahagian B pilih 1) | PASS | "0 / 1 soalan dipilih"; the second answered question shows "Tidak dikira" in the result. | picks in PUT | q4-p3-1280.png, result-p3-1280.png |
| Navigator / flag | PASS | Dots per Bahagian, Dijawab / Ditanda / Belum counts, Tanda soalan; "Peta 1/10" on mobile. | none | q1-p3-1280.png |
| Timer | PARTIAL | Countdown runs and survives reload. Amber warning at 5 min and auto-submit at 0 not tested. | none | n/a |
| Autosave and reload | PASS | Typed text, numeric steps and MCQ pick restored after reload; Mat K2 reopened on the last question. | PUT answers 200 per change | reload-p3-1280.png |
| Hantar | PASS | Dialog "Hantar jawapan anda sekarang?", "Belum dijawab: N soalan", "Ditanda: N", Kembali / Hantar. | `POST /attempts/:id/submit` 200 | hantar-p3-1280.png, mcq-hantar-375.png |
| Result (MCQ paper) | PASS | Score ring 3/10, Mata +30, Koin +6, marks per Bahagian, "Topik untuk disemak", per-question list. Q1 (picked C = 5/6) scored 1/1, so MCQ marking works. Fine at 375 and 768. | `GET /attempts/:id/result` 200 | mcq-result-375.png, result-mcq-768.png |
| Semakan (answer + scheme) | PASS | Expanded question shows "Pilihan anda / Jawapan betul" and "Skema Pemarkahan, N markah" with scheme points. | none | semakan-expanded-1280.png |
| Result (text/structured paper) | FAIL vs V2 | Sains K2: "Awak dapat 0/13 markah (sementara)", "6 bahagian belum dimarkah - perlu semakan". Keyword hint shown ("Isi yang dikehendaki tidak dikesan"). I submitted gibberish, so I did not test that a correct keyword answer earns marks. | none | result-p3-1280.png |
| Self-mark (stepper, `/semak`) | MISSING | No stepper or button on Semakan and no `/semak` call. V2 has one per part. | none | semakan-expanded-1280.png |
| Retry "Cuba lagi" | PARTIAL | Button exists and goes to the paper cover (mode chooser), not straight to a fresh sitting. | none | cuba-lagi-768.png |
| Sejarah Bijak SPM | PASS | `/spm/bijak/sejarah` lists attempts. | `GET /bijak/history` 200 | n/a |

## 3. Other activities

### Databank Soalan SPM (`/spm/tahun-lepas`)
| Step | Result | Seen vs V2 | Network | Evidence |
|---|---|---|---|---|
| Subject list | PASS | 25 SPM subjects with "N soalan dalam databank" and count chips 5/10/20. Biologi, Ekonomi, Geografi, Kimia show 0 soalan (not tested whether they can be started). | none | hub_spm_tahun-lepas.png |
| Start (count 5) | PASS | Tapping the count starts the quiz at once (no separate Mula). | `POST /practice/sessions` 201 | databank-q1-1280.png |
| Answer + check | PASS | Pick option, "Semak Jawapan", green correct / red wrong, "Salah" panel, "Lapor Soalan", "Soalan Seterusnya". Maths answer verified (xy=36, x=12 gives 3). | `POST /practice/sessions/:id/check-answer` 200 | databank-q1-checked-375.png |
| Result | PASS | "1 daripada 5", 20%, Mata +10, Koin +1, streak, "Ulang Lagi", "Semakan Semula Jawapan". OK at 375. | `POST .../submit` 200 | databank-final-375.png |

### Latih Tubi (`/practice`, `/practice/MATH`, `/spm/latih-tubi`)
| Step | Result | Seen | Network | Evidence |
|---|---|---|---|---|
| Subject list | PASS | Matematik 54 soalan; "Baki percubaan percuma: 45 soalan lagi". | none | practice-hub-1280.png |
| Setup | PASS | Tahap (Semua/T4/T5 with counts), Kesukaran (5 levels + Campuran), Bilangan 5/10/15/20, live "Ringkasan", "Mula Kuiz". | none | latihtubi-setup-1280.png |
| Answer, result | PASS | 10 Q at 375: result 2/10, Mata +20, Koin +2. | sessions 201, check-answer 200, submit 200 | latihtubi-final-375.png |
| Latih Tubi SPM | PASS (start only) | Setup T4/T5, Asas/Pertengahan/Sukar, "40 (Target SPM)"; runs 40 questions, answered 4. | sessions 201 | latihtubi-spm-setup-1280.png, spmlatihtubi-q1-1280.png |
| Free-trial quota | NOT TESTED | Dashboard shows "Percubaan Percuma, Baki 50/50"; behaviour at 0 was not tested. | | |

### Soalan by Chapter (`/practice/chapter`)
| Step | Result | Seen | Network | Evidence |
|---|---|---|---|---|
| Choose a bab | FAIL | Only the header "Mode Sistematik" and a "Latih Tubi Rawak" button. No subjects, bab or empty message. | `GET /practice/chapter-subjects` 200 with `data: []` | chapter-1280.png |
| Answer / result | BLOCKED | Cannot start. | | |

### SPM Mock Kertas 1 / Kertas 2 and Simulasi Kuiz
| Step | Result | Seen | Evidence |
|---|---|---|---|
| `/spm-mock` | MISSING | Redirects to /dashboard. FE route exists (`src/modules/m06-spm/routes/mock-exam.ts`) but `src/app/__tests__/prototype-scope.test.ts` asserts `/spm-mock` is out of scope for students; no menu entry. | hub_spm-mock.png |
| `/simulasi/kuiz` | MISSING | Redirects to /dashboard; no FE route (parity doc B17). | hub_simulasi_kuiz.png |

### Soalan Aku Salah (`/practice/revision`)
| Step | Result | Seen | Evidence |
|---|---|---|---|
| Empty state | PASS | "0 soalan perlu diulang kaji" before any wrong answer. | hub_practice_revision.png |
| After 4 wrong answers | PASS | "4 soalan perlu diulang kaji", Matematik "4 soalan salah"; dashboard chip shows 4; `GET /practice/revision` agrees. | revision-1280.png |
| Run + result | PASS | "Ulang Kaji - Matematik", "4 daripada 4 soalan salah", 4 questions then submit 200. | revision-final-1280.png |

### Extras glanced at
| Screen | Result | Note |
|---|---|---|
| Soalan Berstruktur `/latihan-berstruktur` | PASS with defect (B-06) | 3 sets listed; answer page loads. |
| Tracking A `/spm/ramalan` | Hub only | Matematik: 1 set, 40 soalan. Tracking A Bahasa: 0 set. |
| Remedial `/remedial/saya` | Hub only | "Tiada ujian remedial. Bagus - teruskan usaha!" |

## 4. Prioritised bug list

### P0 (blocks the activity or gives a wrong score)

**B-01 Soalan by Chapter is empty and cannot be started.** Suspected area: BE seed/curriculum nodes behind `practice/chapter-subjects`; FE chapter page also lacks an empty state.
- Steps: log in as murid4, open Soalan by Chapter (`/practice/chapter`).
- Expected (V2): subjects, then bab, then questions per bab (`/latih-tubi/bab`).
- Actual: header "Mode Sistematik" and one button "Latih Tubi Rawak". Nothing else, no "tiada data" message.
- Evidence: `GET /api/practice/chapter-subjects` returns 200 `{"data":[],"meta":{"totalItems":0}}`; chapter-1280.png. Matches the parity-doc note that curriculum nodes = 0.

### P1 (wrong vs V2 but usable, or whole feature missing)

**B-02 Bijak SPM text/structured answers cannot be self-marked; score stays provisional.** Area: FE m28-bijak-spm result page, BE has no `/semak` endpoint (parity B15).
- Steps: take Sains K2 (Contoh Pendek), answer, Hantar, open Semakan.
- Expected (V2): per-part self-mark stepper 0..N, score updates, recorded to practice.
- Actual: "0/13 markah (sementara)", "6 bahagian belum dimarkah - perlu semakan", no control to mark. A student can never finish a Kertas 2 paper with a final score.
- Evidence: result-p3-1280.png, semakan-expanded-1280.png. Not verified: whether a correct keyword answer is auto-credited.

**B-03 SPM Mock Kertas 1 and Kertas 2 not reachable.** Area: FE prototype-scope flag.
- Steps: open `/spm-mock`. Expected (V2): random MCQ 5/10/20/40 and `/spm-mock/kertas2`. Actual: redirect to /dashboard and no menu entry. Deliberately out of scope per `prototype-scope.test.ts`, so this needs a scope decision, not a code fix.

**B-04 Simulasi Kuiz does not exist.** Area: FE route and BE missing (parity B17).
- Steps: open `/simulasi/kuiz`. Expected (V2): quiz of random canonical MCQ parts, count 5/10/20/40, optional subject. Actual: redirect to /dashboard.

**B-05 Bijak "Cuba lagi" does not start a fresh sitting.** Area: FE m28 result page.
- Expected (V2): `POST /simulasi/{paper}/cuba-lagi` starts a new sitting, plus a "Lihat semakan lepas" link. Actual: returns to the paper cover and the student picks a mode and presses Mula again. Usable.

**B-06 Soalan Berstruktur renders stem rows as answer boxes.** Area: FE latihan-berstruktur page or BE projection of parent parts.
- Steps: `/latihan-berstruktur`, Matematik set 7, "Mula".
- Expected: only leaf sub-questions have answer boxes. Actual: parent rows "(a) Bagi fungsi f(x)..." and "(a).(i) Tentukan" show an answer textarea with "[0 markah]", and labels read "(a).(i).(A)". 6 boxes for 4 scored sub-parts.
- Evidence: berstruktur-run-1280.png.

### P2 (cosmetic or minor)

- **B-07** `/spm` hub shows "0 Tahun Tersedia" (`GET /spm/overview` returns `yearsAvailable: 0`); reads like a broken stat.
- **B-08** Databank and Latih Tubi SPM tiles for subjects with 0 questions (Biologi, Ekonomi, Geografi, Kimia and others) still show a "Mula" row; not tested whether it is disabled. Latih Tubi SPM also shows "Locked: 0/40".
- **B-09** Wrong-answer panel says "Salah" with a repeated "Salah" line and no explanation (V2 may be the same; not compared).
- **B-10** A Databank 5-question set can contain two near-identical stems (e.g. two "y berubah secara songsang" items with different numbers).
- **B-11** Every first page load logs `401 GET /api/session` in the console (pre-login probe). Harmless noise.

## 5. Not covered / caveats
- Timer amber warning and auto-submit at 0, Bijak Mod Latihan, essay band marking, photo upload, Jana Kertas tab.
- Sejarah Q2 widget (no textarea; not inspected).
- Quota behaviour of "Percubaan Percuma" at 0.
- Tracking A runs, Subjektif sets, Remedial with an assigned test.
- Only one demo account (Tingkatan 4) used.
- Environment: the stack refused connections for under a minute once (another session restarting it), and `GET /api/public/stats` returned 429 once when several browsers logged in at the same time. Neither is counted as a bug.
