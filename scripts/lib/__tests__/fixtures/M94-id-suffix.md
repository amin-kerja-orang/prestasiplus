# M94 fixture (id-cell suffix, bad cells)

| Field  | Value                       |
| ------ | --------------------------- |
| Status | Not approved — draft for G1 |

## 12. E2E test scenarios

| ID                        | Scenario                              | FR  | AC   | Projects       |
| ------------------------- | ------------------------------------- | --- | ---- | -------------- |
| E2E-M94-01                | Observed.                             | 01  | 01.1 | 375, 768, 1280 |
| E2E-M94-02 `@provisional` | Guest on `/admin/x` → `/login`.       | 05  | 02.1 | 375, 768, 1280 |
| E2E-M94-03 (provisional)  | Suffix in words.                      | 06  | 02.2 | 375, 768, 1280 |
| E2E-M94 -04               | Broken id cell.                       | 07  | 02.3 | 375            |
| see E2E-M94-05            | Broken id cell.                       | 08  | 02.4 | 375            |
| E2E-M95-01                | Another module's id in the id column. | 09  | 02.5 | 375            |
| E2E-M94-01                | Duplicate.                            | 10  | 02.6 | 375            |
