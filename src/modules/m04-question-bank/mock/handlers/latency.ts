/**
 * Mock latency of the M04 paths (SRS v1.16 §7 conventions, NFR-M04-02): default 300 ms, test
 * configurable. The mock core has no per-module latency setting, so the app / test bootstrap applies
 * these rules with `runtime.latency.set(ms, pattern)` (build-plan XR: F-06 follow-up); the AI
 * explanation endpoint additionally waits `m04.aiLatencyMs` (default 1.5 s) inside its handler.
 */

export const M04_LATENCY_MS = 300

/** Path patterns for `latency.set(M04_LATENCY_MS, pattern)`. */
export const M04_LATENCY_PATTERNS: readonly string[] = [
  '/api/questions',
  '/api/questions/*',
  '/api/guru/dskp/*',
  '/api/question-*',
  '/api/structured-questions*',
  '/api/diagram-audit*',
  '/api/master-notes*',
]
