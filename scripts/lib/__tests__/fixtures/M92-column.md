# M92 fixture ("Provisional" column)

| Field  | Value                    |
| ------ | ------------------------ |
| Status | **Approved (G1)** — v1.2 |

## 12. E2E test scenarios

| ID         | Scenario                                                | FR          | AC    | Provisional      |
| ---------- | ------------------------------------------------------- | ----------- | ----- | ---------------- |
| E2E-M92-01 | Observed.                                               | FR-01       | AC-01 |                  |
| E2E-M92-02 | Unobserved.                                             | FR-02       | AC-02 | yes              |
| E2E-M92-03 | Observed.                                               | FR-03       | AC-03 | no               |
| E2E-M92-04 | Unobserved.                                             | FR-04       | AC-04 | yes (payer name) |
| E2E-M92-05 | **Provisional** marker in text, but the column says no. | FR-05       | AC-05 | no               |
| E2E-M92-06 | A scenario with an unescaped                            | pipe in it. | FR-06 | AC-06            | Yes |
| E2E-M92-07 | Odd value.                                              | FR-07       | AC-07 | maybe            |
