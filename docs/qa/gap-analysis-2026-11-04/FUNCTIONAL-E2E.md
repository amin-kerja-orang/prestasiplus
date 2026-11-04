# Functional E2E test — V3 admin question pipeline → pupil (2026-11-03)

Target: http://localhost:5193 (V3, branch feature/v3-bijak-r1 tip e34e0a52d), Playwright lane 2. Accounts: admin@demo.test, guru@demo.test, pelajar@demo.test, pelajar2@demo.test (Demo1234).
Test data left behind (marked QA): questions 1272 & 1273 (published), 1274 (pending), 1275 (archived), 1276 (teacher submission, pending); intake batches 1 (stuck) & 2; papers 6 (TERBIT, Mat K1, 40 questions), 7 & 8 (draft); one Bijak attempt by pelajar@demo.test.
V2 expected behaviour: docs/discovery/cloud-student-mechanism.md §3.0–3.7, BIJAK-SPM-cloud.md.

## Counts (PASS / PARTIAL / FAIL / BLOCKED)
F1 6/1/0/0 · F2 4/2/2/1 · F3 2/0/1/0 (+1 not tested) · F4 5/4/0/0 · F5 0/0/1/0 · F6 0/0/1/0 · F7 2/1/0/0 · F8 8/0/0/1 · F9 2/0/2/0 (+1 not tested)

## Main failures (by impact)
1. Imported / CSV / manual questions cannot be published without manual editing: the V3 publish gate requires DSKP unit + SP + thinking level + paper (V2 allows bank questions without a paper). CSV has no columns for them. The paper chosen at upload is not carried to the questions. (422 on POST /api/questions/:id/status)
2. PDF extraction stuck forever at "Sedang diproses", no error or timeout. On this stack JOBS_WORKER_ENABLED=false and OCR_ENGINE=none (intake-processing.service.ts, jobs.worker.ts).
3. All 8 contracts are "Spec"; "Disahkan" cannot be chosen in the UI (needs evidence + topic/KBAT quota). Every paper can only be published with an exception (checkbox + reason ≥5 chars + second Terbitkan button).
4. Teacher paper submission: POST /api/guru/question-papers = 503. Intake port defaults to UnavailablePaperIntake; nothing calls provideIntake (question-sets.ports.ts). Admin /admin/question-submissions shows "Fungsi ini belum tersedia dalam demo".
5. Two review queues disagree: Studio "Menunggu Semakan" = 3, Baris Gilir Semakan "Menunggu" = 0.
6. Tracking A and Kertas Subjektif admin = 404; SPM hub 2 lanes (V2: 6). Subjective papers cannot be built.
7. Jana set: count locked by contract, no Tahun/Negeri, no Jawab Semua / Pilih N control, Sejarah only Kertas 2.

Works end to end: F1 question (Studio create > review > publish) reaches pupil Latih Tubi and Soalan by Chapter (pelajar@ and pelajar2@); a Jana-set paper published with exception appears in Bijak SPM, can be sat, is marked correctly, Cuba Lagi creates a new attempt; one teacher-submitted question appears in Studio "Menunggu Semakan".

## F1 Create question (Studio)
| Step | V2 | V3 | Result | Evidence |
|---|---|---|---|---|
| Cipta baharu + fill | 4 steps, paper optional | Same + Subjek, Tahap, TP, Aras pemikiran; bar "5 belum lengkap" does not say what | PASS | /admin/studio/questions/create |
| Simpan draf | flash "Soalan draf disimpan..." | Same, POST /api/questions 201, id 1272 | PASS | network |
| Hantar semakan | flash | Same | PASS | UI |
| Terbitkan | blocks only basic violations | First 422: "Sila pilih sekurang-kurangnya satu SP DSKP", "Bahagian (a) belum ada aras pemikiran", "Sila pilih kertas untuk soalan SPM". After completing: "Soalan diterbitkan — kini boleh dijawab oleh pelajar." | PARTIAL | 422 then 200 |
| Served indicator | text only | "Dilihat murid di 5 daripada 6" | PASS | UI |
| Pupil Latih Tubi | appears | POST /api/practice/sessions 201 contains QA-F1, QA-F2 | PASS | response |
| Pupil Soalan by Chapter | appears | Index "1 bab, 1 soalan"; chapter page default T4 shows "0 soalan"; switch to T5 shows Bab 1 | PASS (odd) | UI |

## F2 Import
| Step | V2 | V3 | Result |
|---|---|---|---|
| Upload PDF | modal, immediate | form accepted, goes to /admin/spm/soalan/ekstrak/1 | PASS |
| Extract | immediate | stays "Sedang diproses" >2 min, no error; page polls 3 GET/2 s | FAIL (environment) |
| Review PDF items Terima/Tolak/Sunting | exists | cannot be tested | BLOCKED |
| Tulis Soalan Manual | (via Studio) | works; Terima creates draft #1273 | PASS |
| Manual: Terima | - | editor "Sedia dihantar" but Terima rejected: "Soalan 1: SP "12.1.1" tiada dalam senarai kurikulum..." (free-text SP validated late) | PARTIAL |
| Manual: after Terima | paper carried | batch 0 questions, "Hantar untuk semakan" disabled ("Tiada soalan"); chosen paper not carried (publish rejected "Sila pilih kertas...") | PARTIAL |
| CSV template | V2 stub | downloads; subject_id/education_level_id are raw IDs | PASS |
| CSV upload | drafts | "Import selesai: 2 soalan diimport, 0 gagal." (1274, 1275 Draf) | PASS |
| CSV wrong columns | - | "Fail CSV mesti mempunyai kolum question_text, correct_answer." (old success banner stays) | PASS |
| CSV question publishable? | can approve | no: 4 reasons (unit, SP, level, paper); CSV lacks these columns | FAIL |

## F3 Approve / archive
| Approve from Studio (1273) | works | PASS |
| Archive (1275) | dialog "Arkibkan soalan ini?", correct flash, "Pulihkan ke draf" | PASS |
| Two queues agree | one queue in V2 | Studio Menunggu=3 (1274, 1276, seed) vs Baris Gilir Semakan Menunggu=0 (only extract items) | FAIL |
| Legacy bank "Luluskan Hasil Tapisan / Arkib Semua" | buttons exist, not run | Not tested |

## F4 Build / publish paper
| Jana set | V2: Tajuk, Subjek, Bilangan 1-100, Tahun, Negeri | Only Subjek+Kertas; Bilangan readonly=40 by contract; pool 56; set #6 40 questions one click; only 5 subjects, Sejarah only Kertas 2 | PARTIAL |
| Mula kosong | empty sections A/B/C | empty set by contract (Mat K2 A/B/C quota 10/5/2) | PASS |
| Add / reorder / remove | exists | works, marks and "n/N dipilih" update | PASS |
| Section rule | Jawab Semua / Pilih N | no control; "Jawab semua soalan." from contract | PARTIAL |
| Incomplete paper block | list | "Bahagian A: Kurang 9 soalan (perlu 10, ada 1)" etc | PASS |
| Contract gate | block + exception box | "Kontrak Simulasi 1449/1 (versi 2) belum Disahkan (status: Spec); Terbit memerlukan kontrak Disahkan." + box | PASS |
| Publish with exception | tick box | box + reason ≥5 chars + second Terbitkan; "Diterbitkan dengan 1 pengecualian kontrak (direkodkan)."; all contracts Spec so always needed | PARTIAL |
| Pembina Kertas | Panel Pembina Set | /admin/spm/kertas: list, Kertas Baharu, editor, add from bank; paper #8 created | PASS |
| Two builders | one | same paper list/ids (1-7) and "Buka di Set Builder": overlapping, not conflicting | PARTIAL |

## F5 / F6 / F7
| F5 Tracking A | exists | /admin/spm/tracking-a = 404; SPM hub 2 lanes (V2: 6) | FAIL |
| F6 Kertas Subjektif | exists | /admin/kertas-subjektif and /admin/spm/kertas-subjektif = 404 | FAIL |
| F7 contract list | exists | 8 contracts, filters, "perlu semakan" | PASS |
| F7 editor | exists | exists; "4 masalah" (topic/KBAT quota) | PASS |
| F7 Disahkan | Draf/Spec/Disahkan options | Sumber only Draf/Spec; Disahkan via Pengesahan tab (evidence + conditions). 0 contracts Disahkan | PARTIAL |

## F8 Pupil
| F4 paper in Bijak SPM | "Percubaan SPM Matematik Kertas 1, 40 markah, 90 min" | PASS |
| Sit + submit | cover, Peperiksaan/Latihan mode, 40 questions, autosave, Hantar dialog (35 unanswered) | PASS |
| Result | "1/40", section marks, weak topics, per-question review; cos 60 correct = 1/2 marked correctly | PASS |
| Self-mark subjective | no subjective paper published; structured item "Tidak disajikan: jenis jawapan tidak dibenarkan dalam bahagian ini" | BLOCKED |
| Cuba lagi | new attempt (new URL) | PASS |
| F1 question in Latih Tubi / Chapter | see F1 | PASS |
| pelajar2 papers | sees both papers, "Belum cuba" | PASS |
| pelajar2 F1 question | Sejarah 50 questions (T5 26), chapter 1 has 1 question | PASS |

## F9 Teacher
| Teacher sends one question | POST /api/guru/questions 201, "Soalan berjaya dihantar untuk semakan." | PASS |
| Teacher sends paper (PDF) | POST /api/guru/question-papers 503; no success message; UnavailablePaperIntake, provideIntake never called | FAIL |
| Teacher Import CSV | button exists, not run | Not tested |
| Admin sees teacher question | 1276 in Studio Menunggu Semakan; not in Baris Gilir Semakan | PASS (Studio only) |
| Admin "Kiriman Guru" | /admin/question-submissions = "Fungsi ini belum tersedia dalam demo", not in menu | FAIL |

Relevant files: apps/api/src/modules/classes/question-sets/question-sets.ports.ts, apps/api/src/modules/intake/files/intake-processing.service.ts, apps/api/src/modules/jobs/jobs.worker.ts.
