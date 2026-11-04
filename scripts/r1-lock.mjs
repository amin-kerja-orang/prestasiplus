#!/usr/bin/env node
// R1 lock tool: atomic claim/lock for parallel R1 teams, using plain git only (no gh, no API token).
// Alat kunci R1: tuntutan atomik untuk pasukan selari, guna git sahaja.
//
// A lock is the remote branch  refs/heads/r1-lock/<KEY>  on the remote (default origin). It points to an orphan
// commit with an EMPTY tree; the commit message is one JSON line {"key","team","session","card","note","at"}.
// Creating the ref is atomic on the server (push without force): the second team's push is rejected.
// It does NOT depend on the GitHub user, so two Claude accounts sharing one GitHub identity are still told apart
// by --team (or env R1_TEAM).
//
// Team token (S0-T01 fix): register-team on a NEW team creates a random token, stores ONLY its SHA-256 hex
// ("tokenHash") in the team lock, saves the token in this clone's git config (r1.teamToken.<team>) and prints it
// ONCE. Every other session of the team runs `join --team <t> --token <tok>` once (or sets env R1_TEAM_TOKEN, which
// wins over git config). register-team, acquire, heartbeat, heartbeat-all and release then need the matching token.
// list, mine, break and --help need none. A legacy team lock (no tokenHash) is still accepted; `claim-token` (or
// register-team by the recorded holder session) adds the hash and prints the token once.
//
// Usage (team names need 2+ chars after 'team-', e.g. team-alpha; run inside any clone of the repo; --team/--session may come from env R1_TEAM / R1_SESSION):
//   node scripts/r1-lock.mjs register-team --team team-aa --session lead              (prints the team token ONCE)
//   node scripts/r1-lock.mjs join --team team-aa --token <token>                      (each other session, once; or env R1_TEAM_TOKEN)
//   node scripts/r1-lock.mjs claim-token --team team-aa --session lead                (legacy team lock with no token hash)
//   node scripts/r1-lock.mjs acquire S1 --team team-aa --session s1                   (sector)
//   node scripts/r1-lock.mjs acquire S1-T03 --team team-aa --session s1 --card S1-T03 --note "mula"   (card; needs sector S1)
//   node scripts/r1-lock.mjs heartbeat S1-T03 --team team-aa --session s1
//   node scripts/r1-lock.mjs heartbeat-all --team team-aa --session s1
//   node scripts/r1-lock.mjs release S1-T03 --team team-aa --session s1
//   node scripts/r1-lock.mjs list                         (all locks: KEY | team | session | card | at | age | STALE)
//   node scripts/r1-lock.mjs mine --team team-aa           (locks held by the team)
//   node scripts/r1-lock.mjs break S1-T03 --owner [--stale-hours 24] [--force-owner]   (PRODUCT OWNER ONLY)
//   node scripts/r1-lock.mjs --self-test
//   node scripts/r1-lock.mjs --help                        (prints the lock cheat-sheet; same text as docs/plan/R1-START-HERE.md)
// Options: --remote <name> (default origin), --stale-hours <n> (default 24).
// KEY forms: team-<name> | S<n> | S<n>-T<nn>.   Team name: ^team-[a-z0-9-]{2,30}$
// Exit codes: 0 ok | 2 usage or setup error | 3 held by another team (pick another card or sector), or the team
//             token is missing or wrong (the team name belongs to a team whose token you do not have) |
//             4 you are not the holder, or your team does not hold the sector of that card.
// register-team: the team key is held by one session (the lead). The same team name from a DIFFERENT session
// is treated as a name clash (exit 3); pick another name. Other commands treat the same team as the holder.
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const TEAM_RE = /^team-[a-z0-9-]{2,30}$/
const SECTOR_RE = /^S(\d+)$/
const CARD_RE = /^S(\d+)-T\d{2}[a-z]?$/  // S1-T09a / S1-T09b are valid card keys (split cards)
const PREFIX = 'r1-lock/'
const IDENT = {
  GIT_AUTHOR_NAME: 'r1-lock', GIT_AUTHOR_EMAIL: 'r1-lock@invalid',
  GIT_COMMITTER_NAME: 'r1-lock', GIT_COMMITTER_EMAIL: 'r1-lock@invalid',
}
const TOKEN_KEY = (team) => `r1.teamToken.${team}`
const BOOL_FLAGS = new Set(['owner', 'force-owner', 'self-test', 'help'])

class Fail extends Error {
  constructor(code, msg) { super(msg); this.code = code }
}

// ---------- git helpers ----------
const git = (cwd, args, input) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input, env: { ...process.env, ...IDENT } })
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim(), status: r.status }
}
const refOf = (key) => `refs/heads/${PREFIX}${key}`
const trackOf = (remote, key) => `refs/remotes/${remote}/${PREFIX}${key}`

function assertRepo(cwd) {
  if (!git(cwd, ['rev-parse', '--git-dir']).ok) throw new Fail(2, 'Bukan repositori git / Not a git repository.')
}

function parseMsg(text) {
  try { return JSON.parse(text.split(/\r?\n/).find((l) => l.trim().startsWith('{')) ?? '') } catch { return {} }
}

function makeCommit(cwd, data, parent) {
  const tree = git(cwd, ['mktree'], '')
  if (!tree.ok || tree.out !== EMPTY_TREE) throw new Fail(2, `Gagal cipta pokok kosong / cannot create empty tree: ${tree.err}`)
  const args = ['commit-tree', EMPTY_TREE, ...(parent ? ['-p', parent] : []), '-m', JSON.stringify(data)]
  const c = git(cwd, args)
  if (!c.ok) throw new Fail(2, `Gagal cipta commit kunci / cannot create lock commit: ${c.err}`)
  return c.out
}

// Returns {sha, data} or null when the lock does not exist on the remote.
function readLock(cwd, remote, key) {
  const ls = git(cwd, ['ls-remote', remote, refOf(key)])
  if (!ls.ok) throw new Fail(2, `ls-remote ${remote} gagal / failed: ${ls.err}`)
  const sha = ls.out.split(/\s+/)[0]
  if (!sha) return null
  const f = git(cwd, ['fetch', '--quiet', remote, `+${refOf(key)}:${trackOf(remote, key)}`])
  if (!f.ok) throw new Fail(2, `fetch gagal / failed: ${f.err}`)
  const m = git(cwd, ['log', '-1', '--format=%B', sha])
  if (!m.ok) throw new Fail(2, `Tidak boleh baca kunci / cannot read lock: ${m.err}`)
  return { sha, data: parseMsg(m.out) }
}

function listLocks(cwd, remote) {
  const ls = git(cwd, ['ls-remote', remote, 'refs/heads/r1-lock/*'])
  if (!ls.ok) throw new Fail(2, `ls-remote ${remote} gagal / failed: ${ls.err}`)
  const entries = ls.out.split(/\r?\n/).filter(Boolean).map((l) => {
    const [sha, ref] = l.split(/\s+/)
    return { sha, key: ref.slice(`refs/heads/${PREFIX}`.length) }
  })
  if (entries.length) {
    const f = git(cwd, ['fetch', '--quiet', remote, `+refs/heads/r1-lock/*:refs/remotes/${remote}/r1-lock/*`])
    if (!f.ok) throw new Fail(2, `fetch gagal / failed: ${f.err}`)
  }
  return entries.map((e) => {
    const m = git(cwd, ['log', '-1', '--format=%B', e.sha])
    return { ...e, data: m.ok ? parseMsg(m.out) : {} }
  }).sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }))
}

const ageMs = (d) => { const t = Date.parse(d?.at ?? ''); return Number.isNaN(t) ? NaN : Date.now() - t }
const fmtAge = (ms) => {
  if (Number.isNaN(ms)) return '?'
  const m = Math.max(0, Math.floor(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
const isStale = (d, hours) => { const a = ageMs(d); return Number.isNaN(a) || a > hours * 3600000 }

// ---------- args ----------
function parseArgs(argv) {
  const flags = {}
  const pos = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const name = a.slice(2)
      if (BOOL_FLAGS.has(name)) flags[name] = true
      else {
        if (i + 1 >= argv.length) throw new Fail(2, `Bendera --${name} perlukan nilai / needs a value.`)
        flags[name] = argv[++i]
      }
    } else pos.push(a)
  }
  return { flags, pos }
}

function validKey(key) {
  if (!key) throw new Fail(2, 'KEY diperlukan / KEY required (team-<name> | S<n> | S<n>-T<nn>).')
  if (!(TEAM_RE.test(key) || SECTOR_RE.test(key) || CARD_RE.test(key)))
    throw new Fail(2, `KEY tidak sah / invalid KEY "${key}" (team-<name> | S<n> | S<n>-T<nn>).`)
  return key
}

function who(flags, env) {
  const team = flags.team ?? env.R1_TEAM
  const session = flags.session ?? env.R1_SESSION
  if (!team) throw new Fail(2, 'Perlukan --team atau env R1_TEAM / --team or R1_TEAM required.')
  if (!TEAM_RE.test(team)) throw new Fail(2, `Nama pasukan tidak sah / invalid team "${team}" (^team-[a-z0-9-]{2,30}$).`)
  return { team, session }
}
const needSession = (w) => {
  if (!w.session) throw new Fail(2, 'Perlukan --session atau env R1_SESSION / --session or R1_SESSION required.')
  return w
}

// ---------- commands ----------
function heldMsg(key, d) {
  return `Kunci ${key} dipegang oleh ${d.team ?? '?'} (sesi ${d.session ?? '?'}, kad ${d.card ?? '-'}, sejak/at ${d.at ?? '?'}). / Lock ${key} is held by another team.`
}

// ---------- team token ----------
const sha256 = (t) => createHash('sha256').update(t).digest('hex')
const newToken = () => randomBytes(24).toString('base64url')
const hashMatches = (token, hash) => {
  const a = Buffer.from(sha256(token), 'hex')
  const b = Buffer.from(String(hash ?? ''), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
// env R1_TEAM_TOKEN wins over the clone's git config.
function findToken(cwd, env, team) {
  if (env.R1_TEAM_TOKEN) return env.R1_TEAM_TOKEN
  const g = git(cwd, ['config', '--local', '--get', TOKEN_KEY(team)])
  return g.ok && g.out ? g.out : ''
}
function saveToken(cwd, team, token) {
  const r = git(cwd, ['config', '--local', TOKEN_KEY(team), token])
  if (!r.ok) throw new Fail(2, `Gagal simpan token dalam git config / cannot save token to git config: ${r.err}`)
}
// The ONLY place the token is printed (once, on creation).
function printToken(team, token) {
  console.log('Token pasukan dijana; dipaparkan SEKALI sahaja, simpan secara peribadi. / Team token generated; shown ONCE, keep it private.')
  console.log('Beri kepada setiap sesi pasukan anda sekali / give this to each session of your team once:')
  console.log(`  node scripts/r1-lock.mjs join --team ${team} --token ${token}`)
}
const tokenMsg = (team, why) => `${why} Pasukan ${team} dilindungi token; guna "join --team ${team} --token <token>" atau env R1_TEAM_TOKEN. / Team ${team} is token-protected; run "join --team ${team} --token <token>" or set env R1_TEAM_TOKEN.`

// Returns null when allowed, else the exit code (message already printed).
// No team lock, or a legacy team lock with no tokenHash: allowed (as before the token fix).
function requireToken(cwd, remote, w, env) {
  const cur = readLock(cwd, remote, w.team)
  if (!cur || !cur.data.tokenHash) return null
  const tok = findToken(cwd, env, w.team)
  if (!tok) { console.error(tokenMsg(w.team, 'Token pasukan tiada. / Team token missing.')); return 3 }
  if (!hashMatches(tok, cur.data.tokenHash)) { console.error(tokenMsg(w.team, 'Token pasukan salah. / Team token wrong.')); return 3 }
  return null
}

// Adds a tokenHash to a legacy team lock (force-with-lease on its current sha) and prints the token once.
function claimLegacy(cwd, remote, cur, w) {
  const token = newToken()
  const data = { ...cur.data, tokenHash: sha256(token), at: new Date().toISOString() }
  const sha = makeCommit(cwd, data, cur.sha)
  const p = git(cwd, ['push', '--quiet', `--force-with-lease=${refOf(w.team)}:${cur.sha}`, remote, `${sha}:${refOf(w.team)}`])
  if (!p.ok) throw new Fail(2, `Tuntut token gagal (mungkin berlumba) / claim-token failed (maybe a race): ${p.err}`)
  saveToken(cwd, w.team, token)
  console.log(`OK: token ditambah pada kunci pasukan lama ${w.team} / token added to legacy team lock.`)
  printToken(w.team, token)
  return 0
}

function registerTeam(cwd, remote, w, env, note) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = readLock(cwd, remote, w.team)
    if (!cur) {
      const token = newToken()
      const data = { key: w.team, team: w.team, session: w.session, card: '', note: note ?? '', at: new Date().toISOString(), tokenHash: sha256(token) }
      const sha = makeCommit(cwd, data, null)
      const p = git(cwd, ['push', '--quiet', remote, `${sha}:${refOf(w.team)}`])
      if (p.ok) {
        saveToken(cwd, w.team, token)
        console.log(`OK: kunci ${w.team} diperoleh oleh ${w.team} / lock acquired (team registered).`)
        printToken(w.team, token)
        return 0
      }
      continue  // lost a race: re-read and handle below
    }
    if (cur.data.tokenHash) {
      const denied = requireToken(cwd, remote, w, env)
      if (denied) return denied
      console.log(`Sudah didaftar oleh pasukan anda / already registered by your team: ${w.team}.`)
      return 0
    }
    // legacy lock (no tokenHash)
    if (cur.data.session !== w.session) {
      console.error(`Nama pasukan ${w.team} sudah didaftar oleh sesi lain (${cur.data.session}); pilih nama lain. / Team name already registered by another session; choose another name.`)
      return 3
    }
    return claimLegacy(cwd, remote, cur, w)
  }
  throw new Fail(2, 'Pendaftaran pasukan gagal / team registration failed.')
}

function doAcquire(cwd, remote, key, w, extra) {
  const data = { key, team: w.team, session: w.session, card: extra.card ?? '', note: extra.note ?? '', at: new Date().toISOString() }
  for (let attempt = 0; attempt < 3; attempt++) {
    const sha = makeCommit(cwd, data, null)
    const p = git(cwd, ['push', '--quiet', remote, `${sha}:${refOf(key)}`])
    if (p.ok) {
      console.log(`OK: kunci ${key} diperoleh oleh ${w.team} / lock acquired.`)
      return 0
    }
    const cur = readLock(cwd, remote, key)
    if (cur) {
      if (cur.data.team !== w.team) { console.error(heldMsg(key, cur.data)); return 3 }
      console.log(`Sudah dipegang oleh ${w.team} / already held by your team: ${key}.`)
      return 0
    }
    if (attempt === 2) throw new Fail(2, `Push kunci gagal / lock push failed: ${p.err}`)
  }
  return 2
}

function heartbeatOne(cwd, remote, key, w) {
  const cur = readLock(cwd, remote, key)
  if (!cur) throw new Fail(2, `Kunci ${key} tidak wujud / does not exist.`)
  if (cur.data.team !== w.team) { console.error(`Bukan pemegang / not the holder. ${heldMsg(key, cur.data)}`); return 4 }
  const data = { ...cur.data, session: TEAM_RE.test(key) ? cur.data.session : (w.session ?? cur.data.session), at: new Date().toISOString() }
  const sha = makeCommit(cwd, data, cur.sha)
  const p = git(cwd, ['push', '--quiet', `--force-with-lease=${refOf(key)}:${cur.sha}`, remote, `${sha}:${refOf(key)}`])
  if (!p.ok) throw new Fail(2, `Heartbeat gagal / failed: ${p.err}`)
  console.log(`OK: heartbeat ${key} (${data.at}).`)
  return 0
}

function deleteLock(cwd, remote, key, sha) {
  const p = git(cwd, ['push', '--quiet', `--force-with-lease=${refOf(key)}:${sha}`, remote, '--delete', `${PREFIX}${key}`])
  if (!p.ok) throw new Fail(2, `Padam kunci gagal / delete failed: ${p.err}`)
}

function printTable(rows, hours) {
  const head = ['KEY', 'team', 'session', 'card', 'at', 'age', 'STALE']
  const body = rows.map((r) => [r.key, r.data.team ?? '?', r.data.session ?? '?', r.data.card || '-', r.data.at ?? '?', fmtAge(ageMs(r.data)), isStale(r.data, hours) ? 'STALE' : ''])
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => String(b[i]).length)))
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join(' | ').trimEnd()
  console.log(line(head))
  console.log(widths.map((w) => '-'.repeat(w)).join('-+-'))
  for (const b of body) console.log(line(b))
  if (!body.length) console.log('(tiada kunci / no locks)')
}

// ---------- help ----------
const HELP = `R1 lock tool: the ONLY claim system for R1 sectors and cards (docs/plan/R1-START-HERE.md, decision 1).
A lock is the remote branch r1-lock/<KEY>; GitHub allows only one team to create it. GitHub users, assignees and
"/claim" comments mean nothing. The tool needs a git remote (default origin) with PUSH rights (a cloud session uses
the repository token its platform provides).

COMMANDS (--team and --session may come from env R1_TEAM and R1_SESSION)
  register-team --team team-amin --session S-1      once, from the lead session. Name: team-[a-z0-9-]{2,30}
                                                    prints the TEAM TOKEN once (only its SHA-256 is stored in the lock)
  join --team team-amin --token <token>             each other session of the team, once: stores the token in this clone's
                                                    git config (r1.teamToken.<team>). Or set env R1_TEAM_TOKEN (wins over git config)
  claim-token --team team-amin --session S-1        team registered BEFORE the token fix (lock has no hash): adds the hash and
                                                    prints the token once. With a hash already there it needs the token (else exit 3)
  list                                              all locks: KEY | team | session | card | at | age | STALE
  mine --team team-amin                             the locks of your team
  acquire S1 --team team-amin --session S-1         claim a sector
  acquire S1-T01 --team team-amin --session S-2     claim a card (your team must hold sector S1 first)
  heartbeat S1-T01 --team team-amin --session S-2   keep one lock fresh
  heartbeat-all --team team-amin --session S-1      keep all your locks fresh: run it every day
  release S1-T01 --team team-amin --session S-2     after the card PR is merged, or if you drop the card
  release S1 --team team-amin --session S-1         when the sector is finished or your team stops
  break <KEY> --owner [--stale-hours 24]            PRODUCT OWNER ONLY, only for a STALE lock
  --self-test                                       run the built-in tests
OPTIONS  --remote <name> (default origin)   --stale-hours <n> (default 24)   --note "<text>"   --help

EXIT CODES
  0  ok
  2  usage or setup error (bad key, missing --team/--session, not a git repository, no push rights)
  3  held by another team: pick another sector or card (or wait; ask in the pinned issue #503).
     Also: the team token is missing or wrong (get the token from your lead, then run join, or set R1_TEAM_TOKEN)
  4  you are not the holder, or your team does not hold the sector of that card (acquire the sector first)

TEAM TOKEN  register-team and acquire/heartbeat/heartbeat-all/release need the token of a team that has one. list, mine,
  break and --help need none. The lead gives the token to each session privately; never put it in an issue, PR or commit.

RULES (conventions the tool does not enforce)
  - Hold at most 3 sectors. Never hold a sector idle for more than 1 day.
  - S9 is the Delivery Lead's and is not claimable.
  - A lock with no heartbeat for 24 h is STALE (calendar hours, weekends included). Before a weekend or leave run
    heartbeat-all and write "[<team>/S-<k>] away until <date>" in issue #503. The product owner breaks a STALE lock
    only after 1 working day without an answer in #503.
  - After acquire, mirror the claim on the issue: label team:<team> and comment "[<team>/S-<k>] claimed".
`

function printHelp(stream = process.stdout) { stream.write(HELP) }

function main(argv, { cwd = process.cwd(), env = process.env } = {}) {
  const { flags, pos } = parseArgs(argv)
  const [cmd, key] = pos
  const remote = flags.remote ?? 'origin'
  const hours = flags['stale-hours'] === undefined ? 24 : Number(flags['stale-hours'])
  if (!(hours > 0)) throw new Fail(2, '--stale-hours mesti nombor > 0 / must be a number > 0.')
  if (flags.help) { printHelp(); return 0 }
  if (!cmd) { printHelp(process.stderr); throw new Fail(2, 'Arahan diperlukan / command required (see the help above): register-team | join | claim-token | acquire | heartbeat | heartbeat-all | release | list | mine | break.') }
  assertRepo(cwd)

  switch (cmd) {
    case 'register-team': {
      const w = needSession(who(flags, env))
      return registerTeam(cwd, remote, w, env, flags.note)
    }
    case 'join': {
      const w = who(flags, env)
      if (!flags.token) throw new Fail(2, 'Perlukan --token / --token required.')
      const cur = readLock(cwd, remote, w.team)
      if (!cur) throw new Fail(2, `Pasukan ${w.team} belum didaftar / not registered (lead runs register-team first).`)
      if (!cur.data.tokenHash) throw new Fail(2, `Pasukan ${w.team} belum ada token (didaftar sebelum pembetulan); lead jalankan claim-token. / No token yet (legacy registration); the lead runs claim-token.`)
      if (!hashMatches(flags.token, cur.data.tokenHash)) { console.error(tokenMsg(w.team, 'Token salah. / Wrong token.')); return 3 }
      saveToken(cwd, w.team, flags.token)
      console.log(`OK: token disimpan dalam git config (r1.teamToken.${w.team}) / token stored; you joined ${w.team}.`)
      return 0
    }
    case 'claim-token': {
      const w = needSession(who(flags, env))
      const cur = readLock(cwd, remote, w.team)
      if (!cur) throw new Fail(2, `Pasukan ${w.team} belum didaftar / not registered (use register-team).`)
      if (cur.data.tokenHash) {
        const denied = requireToken(cwd, remote, w, env)
        if (denied) return denied
        console.log('Token sudah wujud dan sepadan / token already exists and matches; nothing to do (the token is not shown again).')
        return 0
      }
      if (cur.data.session !== w.session) {
        console.error(`Hanya sesi pendaftar (${cur.data.session}) boleh tuntut token pasukan ${w.team}. / Only the recorded holder session may claim the token.`)
        return 3
      }
      return claimLegacy(cwd, remote, cur, w)
    }
    case 'acquire': {
      const w = needSession(who(flags, env))
      validKey(key)
      if (TEAM_RE.test(key) && key !== w.team) throw new Fail(2, 'Kunci pasukan hanya boleh didaftar oleh pasukan itu sendiri (guna register-team) / team key is only for your own team.')
      const denied = requireToken(cwd, remote, w, env)
      if (denied) return denied
      const c = key.match(CARD_RE)
      if (c) {
        const sec = readLock(cwd, remote, `S${c[1]}`)
        if (!sec || sec.data.team !== w.team) {
          console.error(`Kad ${key} perlu kunci sektor S${c[1]} dipegang oleh ${w.team}. ${sec ? heldMsg(`S${c[1]}`, sec.data) : `Sektor S${c[1]} belum dituntut / not claimed.`} / Card needs your team's sector lock.`)
          return 4
        }
      }
      return doAcquire(cwd, remote, key, w, { card: flags.card ?? (c ? key : ''), note: flags.note })
    }
    case 'heartbeat': {
      const w = needSession(who(flags, env))
      validKey(key)
      const denied = requireToken(cwd, remote, w, env)
      if (denied) return denied
      return heartbeatOne(cwd, remote, key, w)
    }
    case 'heartbeat-all': {
      const w = needSession(who(flags, env))
      const denied = requireToken(cwd, remote, w, env)
      if (denied) return denied
      const mine = listLocks(cwd, remote).filter((r) => r.data.team === w.team)
      if (!mine.length) { console.log(`Tiada kunci untuk ${w.team} / no locks.`); return 0 }
      let worst = 0
      for (const r of mine) worst = Math.max(worst, heartbeatOne(cwd, remote, r.key, w))
      return worst
    }
    case 'release': {
      const w = who(flags, env)
      validKey(key)
      const denied = requireToken(cwd, remote, w, env)
      if (denied) return denied
      const cur = readLock(cwd, remote, key)
      if (!cur) { console.log(`Kunci ${key} tidak wujud / does not exist (nothing to release).`); return 0 }
      if (cur.data.team !== w.team) { console.error(`Bukan pemegang / not the holder. ${heldMsg(key, cur.data)}`); return 4 }
      deleteLock(cwd, remote, key, cur.sha)
      console.log(`OK: kunci ${key} dilepaskan / released.`)
      return 0
    }
    case 'list': {
      printTable(listLocks(cwd, remote), hours)
      return 0
    }
    case 'mine': {
      const w = who(flags, env)
      printTable(listLocks(cwd, remote).filter((r) => r.data.team === w.team), hours)
      return 0
    }
    case 'break': {
      validKey(key)
      if (!flags.owner) throw new Fail(2, 'break memerlukan --owner / requires --owner.')
      console.error('AMARAN / WARNING: hanya pemilik produk (product owner) boleh memecahkan kunci. / Only the product owner may break a lock.')
      const cur = readLock(cwd, remote, key)
      if (!cur) { console.log(`Kunci ${key} tidak wujud / does not exist.`); return 0 }
      if (!isStale(cur.data, hours) && !flags['force-owner']) {
        console.error(`Kunci ${key} masih segar (umur ${fmtAge(ageMs(cur.data))}, had ${hours}j) / still fresh; refused. Guna --force-owner jika pasti. ${heldMsg(key, cur.data)}`)
        return 3
      }
      deleteLock(cwd, remote, key, cur.sha)
      console.log(`OK: kunci ${key} dipecahkan / broken (was ${cur.data.team}, at ${cur.data.at}).`)
      return 0
    }
    default:
      throw new Fail(2, `Arahan tidak dikenali / unknown command: ${cmd}`)
  }
}

// ---------- self-test ----------
async function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'r1-lock-'))
  const results = []
  try {
    const bare = join(root, 'remote.git')
    mkdirSync(bare)
    const must = (r, what) => { if (!r.ok) throw new Error(`setup ${what}: ${r.err}`) }
    must(git(root, ['init', '--bare', '--quiet', bare]), 'init bare')
    const clones = {}
    for (const n of ['a', 'b', 'c']) {
      const d = join(root, `clone-${n}`)
      must(git(root, ['clone', '--quiet', bare, d]), 'clone')
      // SAME git identity for both teams on purpose.
      must(git(d, ['config', 'user.name', 'Shared User']), 'cfg')
      must(git(d, ['config', 'user.email', 'shared@example.com']), 'cfg')
      clones[n] = d
    }
    const env = { ...process.env }
    delete env.R1_TEAM; delete env.R1_SESSION
    const cli = (n, args, extraEnv = {}) => {
      const r = spawnSync(process.execPath, [SELF, ...args], { cwd: clones[n], encoding: 'utf8', env: { ...env, ...extraEnv } })
      return { code: r.status, text: `${r.stdout}${r.stderr}` }
    }
    const cliAsync = (n, args) => new Promise((res) => {
      const p = spawn(process.execPath, [SELF, ...args], { cwd: clones[n], env })
      let text = ''
      p.stdout.on('data', (d) => { text += d }); p.stderr.on('data', (d) => { text += d })
      p.on('close', (code) => res({ code, text }))
    })
    const A = (cmd, ...r) => [cmd, ...r, '--team', 'team-aa', '--session', 'a1']
    const B = (cmd, ...r) => [cmd, ...r, '--team', 'team-bb', '--session', 'b1']
    const check = (name, ok, detail = '') => {
      results.push(ok)
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`)
    }
    const expect = (name, r, code, contains) =>
      check(name, r.code === code && (!contains || r.text.includes(contains)), `exit ${r.code} (want ${code}) ${r.text.trim()}`)

    expect('team-aa registers', cli('a', A('register-team')), 0)
    expect('team-bb registers', cli('b', B('register-team')), 0)
    expect('registration conflict (team-aa name from another session)', cli('b', ['register-team', '--team', 'team-aa', '--session', 'x9']), 3, 'team-aa')
    expect('registration idempotent for same session', cli('a', A('register-team')), 0)
    expect('invalid team name rejected', cli('a', ['register-team', '--team', 'Bad_Name', '--session', 'x']), 2)

    expect('team-aa acquires sector S1', cli('a', A('acquire', 'S1')), 0)
    expect('team-bb blocked on sector S1 (exit 3)', cli('b', B('acquire', 'S1')), 3, 'team-aa')
    expect('same team re-acquire is ok (exit 0)', cli('a', A('acquire', 'S1')), 0)

    const [r1, r2] = await Promise.all([cliAsync('a', A('acquire', 'S2')), cliAsync('b', B('acquire', 'S2'))])
    check('concurrent sector race S2: exactly one winner', [r1.code, r2.code].sort().join() === '0,3', `${r1.code},${r2.code}`)
    expect('loser of race is told who holds it', r1.code === 3 ? r1 : r2, 3, r1.code === 3 ? 'team-bb' : 'team-aa')

    expect('card needs sector: team-bb on S1-T01 (exit 4)', cli('b', B('acquire', 'S1-T01')), 4)
    expect('card needs sector: unclaimed S7-T01 (exit 4)', cli('a', A('acquire', 'S7-T01')), 4)
    expect('team-aa acquires card S1-T01', cli('a', A('acquire', 'S1-T01')), 0)
    expect('team-bb blocked on card S1-T01 (not sector holder, exit 4)', cli('b', B('acquire', 'S1-T01')), 4)

    expect('heartbeat by non-holder (exit 4)', cli('b', B('heartbeat', 'S1')), 4)
    const before = git(clones.a, ['ls-remote', 'origin', 'refs/heads/r1-lock/S1']).out.split(/\s+/)[0]
    expect('heartbeat by holder', cli('a', A('heartbeat', 'S1')), 0)
    const after = git(clones.a, ['ls-remote', 'origin', 'refs/heads/r1-lock/S1']).out.split(/\s+/)[0]
    const parent = git(clones.a, ['rev-parse', `${after}^`]).out
    check('heartbeat is a fast-forward child of the previous lock commit', after !== before && parent === before, `${before} -> ${after} parent ${parent}`)
    expect('heartbeat-all by team-aa', cli('a', A('heartbeat-all')), 0)
    const mine = cli('a', A('mine'))
    check('mine lists team-aa locks only', mine.code === 0 && mine.text.includes('S1-T01') && mine.text.includes('team-aa') && !mine.text.includes('team-bb'), mine.text)

    expect('release by non-holder (exit 4)', cli('b', B('release', 'S1')), 4)
    expect('release card by holder', cli('a', A('release', 'S1-T01')), 0)
    expect('release sector by holder', cli('a', A('release', 'S1')), 0)
    expect('re-acquire after release (team-bb gets S1)', cli('b', B('acquire', 'S1')), 0)

    // stale lock: team-aa holds S5 with an old `at`, written directly with git (fake timestamp).
    expect('team-aa acquires S5', cli('a', A('acquire', 'S5')), 0)
    const cur = readLock(clones.a, 'origin', 'S5')
    const old = new Date(Date.now() - 30 * 3600000).toISOString()
    must(git(clones.a, ['push', '--quiet', 'origin', '--delete', `${PREFIX}S5`]), 'delete S5')
    const stale = makeCommit(clones.a, { ...cur.data, at: old }, null)
    must(git(clones.a, ['push', '--quiet', 'origin', `${stale}:${refOf('S5')}`]), 'push stale S5')

    const lst = cli('b', ['list'])
    const staleLine = lst.text.split(/\r?\n/).find((l) => l.startsWith('S5 '))
    const freshLine = lst.text.split(/\r?\n/).find((l) => l.startsWith('S1 '))
    check('list shows STALE for old lock only', lst.code === 0 && /STALE/.test(staleLine ?? '') && !/STALE/.test(freshLine ?? ''), lst.text)
    expect('break without --owner refused (exit 2)', cli('b', ['break', 'S5']), 2)
    expect('break refuses a fresh lock (exit 3)', cli('b', ['break', 'S1', '--owner']), 3, 'segar')
    expect('break works on a stale lock', cli('b', ['break', 'S5', '--owner']), 0)
    check('S5 gone after break', !cli('b', ['list']).text.split(/\r?\n/).some((l) => l.startsWith('S5 ')))
    expect('break --force-owner on a fresh lock', cli('b', ['break', 'S1', '--owner', '--force-owner']), 0)
    expect('break refuses fresh S2 by default', cli('b', ['break', 'S2', '--owner']), 3)

    // ---- team token (S0-T01) ----
    const T = (cmd, ...r) => [cmd, ...r, '--team', 'team-tk', '--session', 'S-1']
    const reg = cli('a', T('register-team'))
    const token = (reg.text.match(/--token (\S+)/) ?? [])[1] ?? ''
    check('register-team new team prints a token once (exit 0)', reg.code === 0 && token.length >= 32 && reg.text.split(token).length === 2, reg.text)
    const tkLock = readLock(clones.a, 'origin', 'team-tk')
    const rawMsg = git(clones.a, ['log', '-1', '--format=%B', tkLock.sha]).out
    check('lock stores only the SHA-256 hash, not the token', tkLock.data.tokenHash === sha256(token) && !rawMsg.includes(token), rawMsg)
    check('token saved in the registering clone git config', findToken(clones.a, {}, 'team-tk') === token)
    expect('registering clone keeps working with git-config token', cli('a', T('acquire', 'S8')), 0)
    expect('original bug: second clone, same team + session S-1, no token (exit 3)', cli('c', T('register-team')), 3, 'token')
    expect('missing token: acquire (exit 3)', cli('c', T('acquire', 'S8')), 3, 'token')
    expect('missing token: heartbeat (exit 3)', cli('c', T('heartbeat', 'S8')), 3)
    expect('missing token: heartbeat-all (exit 3)', cli('c', T('heartbeat-all')), 3)
    expect('missing token: release (exit 3)', cli('c', T('release', 'S8')), 3)
    expect('wrong token via env (exit 3)', cli('c', T('acquire', 'S8'), { R1_TEAM_TOKEN: 'wrong-token' }), 3, 'salah')
    expect('list needs no token', cli('c', ['list']), 0, 'team-tk')
    expect('mine needs no token', cli('c', ['mine', '--team', 'team-tk']), 0, 'S8')
    expect('join with a wrong token (exit 3)', cli('c', ['join', '--team', 'team-tk', '--token', 'nope']), 3)
    check('wrong join stores nothing', findToken(clones.c, {}, 'team-tk') === '')
    expect('join with an invalid team name (exit 2)', cli('c', ['join', '--team', 'Bad_Name', '--token', 'x']), 2)
    expect('correct token via env R1_TEAM_TOKEN: heartbeat', cli('c', T('heartbeat', 'S8'), { R1_TEAM_TOKEN: token }), 0)
    expect('join with the correct token', cli('c', ['join', '--team', 'team-tk', '--token', token]), 0)
    check('join stores the token in git config', findToken(clones.c, {}, 'team-tk') === token)
    expect('correct token via git config: heartbeat-all', cli('c', T('heartbeat-all')), 0)
    expect('register-team again with token is idempotent', cli('c', T('register-team')), 0)
    expect('env token wins over a correct git config (wrong env, exit 3)', cli('c', T('heartbeat', 'S8'), { R1_TEAM_TOKEN: 'wrong-token' }), 3)
    git(clones.c, ['config', '--local', TOKEN_KEY('team-tk'), 'wrong-in-config'])
    expect('env token wins over a wrong git config (right env, ok)', cli('c', T('heartbeat', 'S8'), { R1_TEAM_TOKEN: token }), 0)
    expect('wrong git config token (exit 3)', cli('c', T('heartbeat', 'S8')), 3)
    expect('token holder releases S8', cli('a', T('release', 'S8')), 0)
    expect('break needs no token (force-owner on team key)', cli('b', ['break', 'team-tk', '--owner', '--force-owner']), 0)

    // legacy: team lock with no tokenHash, written directly (as registered before the fix)
    const legacy = (team, session) => {
      const c = makeCommit(clones.c, { key: team, team, session, card: '', note: '', at: new Date().toISOString() }, null)
      must(git(clones.c, ['push', '--quiet', 'origin', `${c}:${refOf(team)}`]), `push legacy ${team}`)
    }
    legacy('team-lg', 'l1')
    const L = (cmd, session, ...r) => [cmd, ...r, '--team', 'team-lg', '--session', session]
    expect('legacy lock without hash is accepted (acquire)', cli('a', L('acquire', 'l1', 'S6')), 0)
    expect('legacy: register-team from another session is a name clash (exit 3)', cli('a', L('register-team', 'l2')), 3)
    expect('legacy: claim-token from a non-holder session (exit 3)', cli('a', L('claim-token', 'l2')), 3)
    const cl = cli('c', L('claim-token', 'l1'))
    const lgToken = (cl.text.match(/--token (\S+)/) ?? [])[1] ?? ''
    check('legacy: claim-token by the holder adds the hash and prints the token', cl.code === 0 && lgToken.length >= 32 && readLock(clones.c, 'origin', 'team-lg').data.tokenHash === sha256(lgToken), cl.text)
    check('legacy: session of the team lock is preserved', readLock(clones.c, 'origin', 'team-lg').data.session === 'l1')
    expect('legacy after claim: no token now fails (exit 3)', cli('a', L('acquire', 'l1', 'S6')), 3)
    expect('legacy after claim: claim-token without token (exit 3)', cli('a', L('claim-token', 'l1')), 3)
    expect('legacy after claim: claim-token with token is a no-op', cli('c', L('claim-token', 'l1')), 0, 'sepadan')
    legacy('team-lh', 'h1')
    const rl = cli('c', ['register-team', '--team', 'team-lh', '--session', 'h1'])
    const lhToken = (rl.text.match(/--token (\S+)/) ?? [])[1] ?? ''
    check('legacy: register-team by the holder session claims the token', rl.code === 0 && lhToken.length >= 32 && readLock(clones.c, 'origin', 'team-lh').data.tokenHash === sha256(lhToken), rl.text)
  } catch (e) {
    results.push(false)
    console.log(`FAIL  self-test aborted: ${e.message}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  const failed = results.filter((x) => !x).length
  console.log(`\n${results.length - failed}/${results.length} PASS${failed ? `, ${failed} FAIL` : ''}`)
  return failed ? 1 : 0
}

// ---------- entry ----------
{
  const argv = process.argv.slice(2)
  try {
    if (argv.includes('--self-test')) process.exit(await selfTest())
    if (argv.includes('-h')) { printHelp(); process.exit(0) }
    process.exit(main(argv))
  } catch (e) {
    if (e instanceof Fail) { console.error(`RALAT / ERROR: ${e.message}`); process.exit(e.code) }
    console.error(e)
    process.exit(2)
  }
}
