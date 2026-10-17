# v2-bijak-spm: known limitations of the student prototype (module m28-bijak-spm)

Append to the "Known limitations" section of `v2-bijak-spm.md` when that file is on this branch
(it lives on `feature/student-prototype`; kept separate here to avoid an add/add merge conflict).

- **Semak cap vs UI.** The server allows at most 3 "Semak" per question per attempt (NFR-05) and
  then locks the answer. The UI locks a question's inputs after the first Semak, so the extra two
  checks are only reachable through the API.
- **Decimal comma vs thousands.** A comma or space followed by exactly three digits is read as a
  thousands grouping: `3,141` is 3141 and `1 000` is 1000. A decimal comma followed by exactly
  three digits is therefore ambiguous. `0,5` and `1,2345` stay decimal commas.
- **No offline e2e.** Offline autosave and offline resubmit (retry on `online` and every 30 s) are
  covered by unit tests against the mock server; there is no browser e2e that goes offline.
- Reward display (2 koin, 10 mata per mark) is not wired to M14; seeds are a proof-of-concept size.
