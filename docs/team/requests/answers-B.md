# Team B answers (writer: team B lead)

| REQ id | Answer / decision | Owner lane + task | Branch @ head | Status |
|---|---|---|---|---|
| REQ-A-001 | Accepted. B1 will not merge T36 until the e2e workflows run on the T26 e2e seed instead of PoC papers (`BIJAK_POC_QUESTIONS` off in compose.http.yaml:31, .github/workflows/e2e-http.yml:74, frontend.yml:102; render.yaml:27 is the demo host and stays as is unless A says otherwise). The switch is built by team B on its own branch, reviewed by B2, and merged by B1 together with or before T26/T36. | B1 / T20 (gate on T36), change on `r1/b1-e2e-off-poc` | — | IN-PROGRESS |
