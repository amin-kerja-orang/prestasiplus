# M27 inventory summary (2026-09-30)

| key | total | visible-default | states | route | status |
|---|---|---|---|---|---|
| S1-pilih-sekolah | 7 | 7 | 3 (375 / 768 / 1280) | /admin-sekolah/pilih-sekolah | 500 |
| S2-command-center | 7 | 7 | 3 | /admin-sekolah/command-center | 403 |
| S3-laporan-aktiviti | 7 | 7 | 3 | /admin-sekolah/laporan-aktiviti | 404 |

- 21 content elements, 9 captured states, 0 conditional / hidden / width-specific elements. Shell files: none (the three pages are standalone global error pages).
- Aliases (not re-inventoried): /admin-sekolah/monitoring = /admin/monitoring (M11 S2, inventory/M11/S2-monitoring.json), /admin-sekolah/kirkpatrick = /admin/kirkpatrick (M12 S1, inventory/M12/S1-overview.json). Identity: <main> text 16,437 and 3,969 characters, 0 differing characters.
- Route probe: 18 GETs (maxRedirects 0) in `_snapshot-2026-09-30.json` -> `probes`, also in `_crawl.json` -> `probes`. 8 x 302 to /admin-sekolah/pilih-sekolah, 1 x 403, 5 x 404 (+1 control), 1 x 500, 2 x 200 (aliases).
- Crawl: links on the inventoried pages are `/`, `/login`, `/latih-tubi`, `javascript:location.reload()`. The alias pages contain no `admin-sekolah` string.
- piiLeakCheck: 0 leaks in 9/9 states. Scripted scan of every M27 file (narrative, inventory, raw states, snapshot, crawl, job scripts) for e-mail, phone (+60 1x), IC (12 digits) and BIN/BINTI patterns: 0 hits each. No credentials in any file.
- Limits: the school-admin pages themselves are unrevealed (302 -> picker -> 500; 403; 404 for wrong hrefs). See narrative section 9.
- Raw state files in `_raw/M27/` were written from the values captured by `tools/run-state.js` (the MCP result was returned inline, not saved by the tool); they hold the same 7 elements per state.
