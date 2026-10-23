// MIG-07: makes a SYNTHETIC "delta" dump from a synthetic pp-staging-dump/1 directory (changed, added and deleted rows).
//   node apps/api/scripts/rehearsal/mig07-make-delta.mjs <source dump dir> <new dump dir> [--delete <table>=<n> ...]
// Both directories belong OUTSIDE the repo (the rehearsal script refuses a dump inside it); this script refuses an output
// directory inside the repo (exit 2). It writes a fresh `SHA256SUMS` (sha256sum format, bytewise order, every file but itself)
// into the new directory; the source's file is never copied. The loader also wants the directory checksum sidecar
// (the formula of rehearsal-db.sh sha_check, directory form), which this script does not write:
//   ( cd <new dir> && find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum ) | sha256sum
//   -> put "<hex>  <name>" in <new dir>.sha256
// Never run this on an anonymised real dump: it only edits the shapes of the BE-35 generator.
// --delete <table>=<n> (repeatable, also --delete=<table>=<n>): after the standard edits, delete n MORE rows of <table> at the
//   source (a "breach" dump for the stop-and-roll-back rehearsal, e.g. --delete users=1200 so that deleted_at_source is above
//   5 % and 100 rows). Deterministic: the n rows of the source dump with the highest ids that are still there (a row this run added is never picked); in `users` a row with role
//   'admin' is never picked (the content owner stays). Refused (exit 2) when <table> is not in the manifest, has no numeric
//   `id`, or has fewer than n eligible rows (the output directory this run created is removed again). The rewritten manifest row count and the summary ("extraDeleted") follow.
// What it changes (the manifest keeps "synthetic": true; no anomalies.json is copied, it would be stale):
//   users             200 changed (name + newer updated_at), 100 added, 50 deleted
//   schools           10 changed, 5 added
//   practice_sessions 300 changed (correct + 1), 500 added, 200 deleted
//   coin_transactions 300 added
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const USAGE = 'usage: node mig07-make-delta.mjs <source dump dir> <new dump dir> [--delete <table>=<n> ...]'
const positional = []
const extraDeletes = [] // [table, n]
{
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    let a = args[i]
    if (a === '--delete' || a.startsWith('--delete=')) {
      if (a === '--delete') a = args[++i] ?? ''
      else a = a.slice('--delete='.length)
      const m = /^([a-z][a-z0-9_]*)=([1-9][0-9]*)$/.exec(a)
      if (!m) {
        console.error(`refusing: --delete wants <table>=<n> with n a positive integer\n${USAGE}`)
        process.exit(2)
      }
      extraDeletes.push([m[1], Number(m[2])])
    } else if (a.startsWith('--')) {
      console.error(`refusing: unknown option ${a.split('=')[0]}\n${USAGE}`)
      process.exit(2)
    } else positional.push(a)
  }
}
const [src, dst] = positional
if (!src || !dst || positional.length !== 2) {
  console.error(USAGE)
  process.exit(2)
}
const manifest0 = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'))
if (!manifest0.synthetic) {
  console.error('refusing: the source manifest is not marked "synthetic": true')
  process.exit(2)
}
// The repository root: the nearest ancestor of this script that holds `.git` (a directory, or a file in a worktree).
const repoRoot = (() => {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
})()
// Resolves symlinks of the deepest existing ancestor, so a link into the repo cannot get around the check.
const realish = (p) => {
  const abs = path.resolve(p)
  const tail = []
  let cur = abs
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(cur), ...tail.reverse())
    } catch {
      const up = path.dirname(cur)
      if (up === cur) return abs
      tail.push(path.basename(cur))
      cur = up
    }
  }
}
if (!repoRoot) {
  console.error('refusing: no .git ancestor of this script was found, so the "output directory is outside the repository" check cannot run')
  process.exit(2)
}
{
  const rel = path.relative(realish(repoRoot), realish(dst))
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    console.error(`refusing: the output directory is inside the repository (${repoRoot}); use a directory outside it`)
    process.exit(2)
  }
}
for (const [t] of extraDeletes) {
  if (!manifest0.tables?.[t]) {
    console.error(`refusing: --delete ${t}: no such table in the manifest`)
    process.exit(2)
  }
}
if (fs.existsSync(dst) && fs.readdirSync(dst).length > 0) {
  console.error('refusing: the output directory is not empty')
  process.exit(2)
}
fs.mkdirSync(dst, { recursive: true, mode: 0o700 })
const NEW = '2026-09-01T00:00:00Z'
const read = (t) => fs.readFileSync(path.join(src, `${t}.ndjson`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'))
const summary = {}
const write = (t, rows) => {
  fs.writeFileSync(path.join(dst, `${t}.ndjson`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n', { mode: 0o600 })
  manifest.tables[t] = { rows: rows.length, file: `${t}.ndjson` }
}
const apply = (t, { change, add, del, mutate, make }) => {
  const original = read(t)
  let rows = original.filter((r) => !del(r.id))
  const deleted = original.length - rows.length
  let changed = 0
  rows = rows.map((r) => {
    if (!change(r.id)) return r
    changed++
    return { ...mutate(r), updated_at: NEW }
  })
  const last = Math.max(...original.map((r) => r.id))
  for (let i = 1; i <= add; i++) rows.push(make(rows[0], last + i))
  write(t, rows)
  summary[t] = { before: original.length, changed, added: add, deleted, after: rows.length }
}
// Only the table files: not the source's SHA256SUMS or anomalies.json (both would be stale).
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith('.ndjson')) continue
  fs.copyFileSync(path.join(src, f), path.join(dst, f))
  fs.chmodSync(path.join(dst, f), 0o600)
}
apply('users', {
  change: (id) => id >= 15000 && id < 15200, del: (id) => id >= 17000 && id < 17050, add: 100,
  mutate: (r) => ({ ...r, name: `${r.name} (diubah)` }),
  make: (p, id) => ({ ...p, id, name: `Murid Contoh ${String(id).padStart(5, '0')}`, email: `pengguna${id}@contoh.invalid`, phone: `0000000${id}`, ic: String(id).padStart(12, '0'), username: `contoh${id}`, role: 'pelajar', school_id: 1 + (id % 300), referral_code: `RC${id}`, created_at: NEW, updated_at: NEW, last_login_at: NEW }),
})
apply('schools', {
  change: (id) => id <= 10, del: () => false, add: 5,
  mutate: (r) => ({ ...r, name: `${r.name} (diubah)` }),
  make: (p, id) => ({ ...p, id, name: `Sekolah Contoh ${id}`, code: `SC${id}`, join_code: `JOIN${id}`, created_at: NEW, updated_at: NEW }),
})
apply('practice_sessions', {
  change: (id) => id > 30000 && id <= 30300, del: (id) => id > 39800, add: 500,
  mutate: (r) => ({ ...r, correct: Math.min(r.total_questions, r.correct + 1) }),
  make: (p, id) => ({ ...p, id, user_id: 15000 + (id % 2000), client_uuid: `00000000-0000-4000-9000-${String(id).padStart(12, '0')}`, started_at: NEW, created_at: NEW, updated_at: NEW }),
})
apply('coin_transactions', {
  change: () => false, del: () => false, add: 300, mutate: (r) => r,
  make: (p, id) => ({ ...p, id, user_id: 15000 + (id % 2000), created_at: NEW, updated_at: NEW }),
})
// --delete <table>=<n>: n more rows gone at the source, the highest ids first (never an admin user).
for (const [t, n] of extraDeletes) {
  const entry = manifest.tables[t]
  if (!entry) {
    console.error(`refusing: --delete ${t}: no such table in the manifest`)
    process.exit(2)
  }
  const file = path.join(dst, `${t}.ndjson`)
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  if (rows.some((r) => !Number.isInteger(r.id))) {
    console.error(`refusing: --delete ${t}: the table has rows without a numeric id`)
    fs.rmSync(dst, { recursive: true, force: true }) // this run created it: leave nothing half-written
    process.exit(2)
  }
  const inSource = new Set(read(t).map((r) => r.id)) // rows added by this run never existed at the source, so they are not "deleted"
  const eligible = rows.filter((r) => inSource.has(r.id) && !(t === 'users' && r.role === 'admin')).sort((a, b) => b.id - a.id)
  if (eligible.length < n) {
    console.error(`refusing: --delete ${t}=${n}: only ${eligible.length} eligible rows`)
    fs.rmSync(dst, { recursive: true, force: true }) // this run created it: leave nothing half-written
    process.exit(2)
  }
  const gone = new Set(eligible.slice(0, n).map((r) => r.id))
  const kept = rows.filter((r) => !gone.has(r.id))
  write(t, kept)
  summary[t] = { ...(summary[t] ?? { before: rows.length, changed: 0, added: 0, deleted: 0 }), extraDeleted: n, after: kept.length }
}
fs.writeFileSync(path.join(dst, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
// Fresh `SHA256SUMS`, the same format as the generator: `<hex>  <file>`, bytewise order, every file but itself.
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const sums = fs.readdirSync(dst).filter((f) => f !== 'SHA256SUMS').sort(byName)
  .map((f) => `${createHash('sha256').update(fs.readFileSync(path.join(dst, f))).digest('hex')}  ${f}\n`)
fs.writeFileSync(path.join(dst, 'SHA256SUMS'), sums.join(''), { mode: 0o600 })
console.log(JSON.stringify(summary, null, 1))
