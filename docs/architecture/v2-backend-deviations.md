# Backend deviations log

Append-only. One row per deviation: date, card, contract/mock deviation, why, who agreed. Never reformat existing rows.

| Date | Card | Deviation | Why | Agreed by |
|---|---|---|---|---|
| 2026-10-19 | BE-18 | `POST /guru/command-center/remedial/cancel`: a repeat cancel answers 409 CONFLICT "Ujian remedial ini tidak aktif." (as the mock). This overrides card AC2 "cancel is idempotent". | The mock and its test assert 409; the card wording is the deviation. | LEAD (BE-18 review) |
