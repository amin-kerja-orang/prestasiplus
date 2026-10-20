#!/usr/bin/env node
// npm audit gate (BE-33, AC6). Reads `npm audit --json` (auditReportVersion 2, npm 7+) from stdin or --file and
// fails (exit 1) on any HIGH or CRITICAL advisory that is not in the allow-list.
//
//   npm audit --omit=dev --json | node scripts/npm-audit-gate.mjs [--allowlist <file>] [--today YYYY-MM-DD]
//
// Allow-list (default .github/security/npm-audit-allowlist.json):
//   { "entries": [ { "id": "GHSA-xxxx-xxxx-xxxx", "package": "name", "reason": "why not exploitable here",
//                    "expires": "YYYY-MM-DD" } ] }
// Every entry needs id, package, reason and an ISO expires date. An expired entry fails the gate (even when no
// advisory uses it), so an exception can never go stale silently. Process: docs/ops/api-runbook.md section 14.
//
// Exit codes: 0 pass, 1 gate failed (unlisted advisory or bad/expired allow-list), 2 unusable input.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const GATED = new Set(['high', 'critical']);
const GHSA = /GHSA(?:-[0-9a-z]{4}){3}/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical id: GHSA-xxxx-xxxx-xxxx (prefix upper case, rest lower case); other ids unchanged. */
export function normId(id) {
  const t = String(id).trim();
  return /^ghsa-/i.test(t) ? `GHSA-${t.slice(5).toLowerCase()}` : t;
}

/** Advisory id of one `via` object: the GHSA id from its URL, else `npm:<source>`, else the title. */
export function advisoryId(via) {
  const m = typeof via.url === 'string' ? GHSA.exec(via.url) : null;
  if (m) return normId(m[0]);
  if (via.source !== undefined) return `npm:${via.source}`;
  return String(via.title ?? 'unknown');
}

/** All advisories (objects in `via`) at HIGH or CRITICAL. String `via` entries are transitive links; the root advisory is listed under its own package. */
export function gatedAdvisories(report) {
  const out = new Map();
  for (const [pkg, v] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      if (!GATED.has(String(via.severity).toLowerCase())) continue;
      const id = advisoryId(via);
      if (!out.has(id)) out.set(id, { id, package: via.name ?? pkg, severity: via.severity, title: via.title ?? '' });
    }
  }
  return [...out.values()];
}

/** Validate the allow-list. Returns { valid: Map(id -> entry), problems: string[] }. */
export function checkAllowlist(list, today) {
  const problems = [];
  const valid = new Map();
  const entries = Array.isArray(list?.entries) ? list.entries : null;
  if (!entries) return { valid, problems: ['allow-list must be an object with an "entries" array'] };
  entries.forEach((e, i) => {
    const label = `entry ${i + 1} (${e?.id ?? 'no id'})`;
    const missing = ['id', 'package', 'reason', 'expires'].filter((k) => typeof e?.[k] !== 'string' || e[k].trim() === '');
    if (missing.length) return problems.push(`${label}: missing ${missing.join(', ')}`);
    if (!ISO_DATE.test(e.expires) || Number.isNaN(Date.parse(`${e.expires}T00:00:00Z`))) {
      return problems.push(`${label}: expires must be an ISO date (YYYY-MM-DD)`);
    }
    if (e.expires < today) return problems.push(`${label}: expired on ${e.expires}; renew with a new reason or fix the dependency`);
    valid.set(normId(e.id), e);
  });
  return { valid, problems };
}

/** The gate. Pure: returns { code, lines }. */
export function runGate(report, allowlist, today) {
  const lines = [];
  const { valid, problems } = checkAllowlist(allowlist, today);
  const blocked = gatedAdvisories(report).filter((a) => !valid.has(a.id));
  const allowed = gatedAdvisories(report).filter((a) => valid.has(a.id));
  const meta = report.metadata?.vulnerabilities;
  if (meta) lines.push(`npm audit: ${['critical', 'high', 'moderate', 'low'].map((s) => `${s} ${meta[s] ?? 0}`).join(', ')}`);
  for (const a of allowed) lines.push(`allowed  ${a.id} ${a.package} (${a.severity}) until ${valid.get(a.id).expires}`);
  for (const p of problems) lines.push(`allow-list problem: ${p}`);
  for (const a of blocked) lines.push(`BLOCKED  ${a.id} ${a.package} (${a.severity}): ${a.title}`);
  const code = blocked.length || problems.length ? 1 : 0;
  lines.push(code ? 'npm-audit-gate: FAILED' : 'npm-audit-gate: passed');
  return { code, lines };
}

function parseArgs(argv) {
  const o = { allowlist: '.github/security/npm-audit-allowlist.json', file: null, today: new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (k === '--allowlist') o.allowlist = argv[i + 1];
    else if (k === '--file') o.file = argv[i + 1];
    else if (k === '--today') o.today = argv[i + 1];
    else throw new Error(`unknown option ${k}`);
  }
  if (!ISO_DATE.test(o.today ?? '')) throw new Error('--today must be YYYY-MM-DD');
  return o;
}

function main() {
  let opts;
  let report;
  let allowlist;
  try {
    opts = parseArgs(process.argv.slice(2));
    const raw = readFileSync(opts.file ?? 0, 'utf8');
    report = JSON.parse(raw);
    if (report.error) throw new Error(`npm audit returned an error: ${report.error.summary ?? report.error.code ?? 'unknown'}`);
    if (typeof report.vulnerabilities !== 'object') throw new Error('input is not an npm audit v2 report (no "vulnerabilities")');
    allowlist = JSON.parse(readFileSync(opts.allowlist, 'utf8'));
  } catch (err) {
    console.error(`npm-audit-gate: unusable input: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
  const { code, lines } = runGate(report, allowlist, opts.today);
  console.log(lines.join('\n'));
  process.exit(code);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
