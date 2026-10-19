// OpenAPI breaking-change gate (BE-31, AC4), local twin of the `openapi-diff` job in
// .github/workflows/api.yml.
//
//   npm run contract:diff -w @pp/contract-tests                      base = origin/feature/v2-backend
//   npm run contract:diff -w @pp/contract-tests -- --base-ref origin/main
//   npm run contract:diff -w @pp/contract-tests -- --base a.json --head b.json
//   npm run contract:diff:samples -w @pp/contract-tests              the two demo diffs of the PR
//
// Tool: oasdiff (an `oasdiff` binary on PATH, else the pinned Docker image with a READ-ONLY mount
// of a temp copy of the two files). Exit 1 = breaking changes (severity ERR). In CI the failure is
// waived only when the PR carries the label `contract-breaking`.
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../..')
const HEAD_DEFAULT = resolve(ROOT, 'packages/contract/openapi.json')
const IMAGE = 'tufin/oasdiff:v1.34.0'
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}

/** Runs oasdiff on two files. Returns { code, out }. */
export function oasdiffBreaking(basePath, headPath) {
  const dir = mkdtempSync(join(tmpdir(), 'oasdiff-'))
  try {
    copyFileSync(basePath, join(dir, 'base.json'))
    copyFileSync(headPath, join(dir, 'head.json'))
    const local = spawnSync('oasdiff', ['--version'], { encoding: 'utf8' })
    const [cmd, args] = local.error
      ? [
          'docker',
          [
            'run',
            '--rm',
            '-v',
            `${dir}:/work:ro`,
            IMAGE,
            'breaking',
            '/work/base.json',
            '/work/head.json',
            '--fail-on',
            'ERR',
          ],
        ]
      : [
          'oasdiff',
          ['breaking', join(dir, 'base.json'), join(dir, 'head.json'), '--fail-on', 'ERR'],
        ]
    const r = spawnSync(cmd, args, { encoding: 'utf8' })
    if (r.error) throw new Error(`cannot run ${cmd}: ${r.error.message}`)
    return { code: r.status ?? 1, out: `${r.stdout}${r.stderr}`.trim() }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * openapi.json at the merge-base of HEAD and `ref`: a branch that is behind its base is compared
 * with the commit it forked from, so contract paths merged meanwhile do not count as removed.
 * (In CI the checkout is the PR merge commit, whose merge-base is the base tip.)
 */
function baseFromGit(ref) {
  const mb = spawnSync('git', ['merge-base', 'HEAD', ref], { cwd: ROOT, encoding: 'utf8' })
  if (mb.status !== 0) throw new Error(`git merge-base HEAD ${ref} failed: ${mb.stderr}`)
  const r = spawnSync('git', ['show', `${mb.stdout.trim()}:packages/contract/openapi.json`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.status !== 0)
    throw new Error(`git show ${ref}:packages/contract/openapi.json failed: ${r.stderr}`)
  const dir = mkdtempSync(join(tmpdir(), 'oasdiff-base-'))
  const file = join(dir, 'openapi.json')
  writeFileSync(file, r.stdout)
  return { file, dir }
}

if (process.argv.includes('--samples')) {
  const samples = resolve(HERE, '../diff-samples')
  const cases = [
    ['breaking-removed-field.json', 1],
    ['breaking-narrowed-enum.json', 1],
    ['breaking-optional-now-required.json', 1],
    ['additive.json', 0],
  ]
  let bad = 0
  for (const [file, expected] of cases) {
    const { code, out } = oasdiffBreaking(join(samples, 'base.json'), join(samples, file))
    const ok = code === expected
    if (!ok) bad++
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${file}: gate ${code === 0 ? 'passes' : 'fails'} (expected ${expected === 0 ? 'pass' : 'fail'})`,
    )
    console.log(
      out
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n'),
    )
  }
  process.exit(bad ? 1 : 0)
}

const fromCwd = (p) => (p ? resolve(process.env.INIT_CWD ?? process.cwd(), p) : undefined)
const head = fromCwd(arg('--head')) ?? HEAD_DEFAULT
let base = fromCwd(arg('--base'))
let tmp
if (!base) {
  const b = baseFromGit(arg('--base-ref') ?? 'origin/feature/v2-backend')
  base = b.file
  tmp = b.dir
}
try {
  const { code, out } = oasdiffBreaking(base, head)
  console.log(out)
  console.log(
    code === 0
      ? 'contract:diff ok: no breaking changes'
      : 'contract:diff FAILED: breaking changes (label the PR `contract-breaking` to waive)',
  )
  process.exitCode = code
} finally {
  if (tmp) rmSync(tmp, { recursive: true, force: true })
}
