#!/usr/bin/env node
// Dry run of the DM-77 reward catalogue merge (S7-T05, step 0 of U-OP-13). The merge itself is deferred by the product owner until the
// Kawalan Reward data is ready (#501), so this script is its only step: a report, never a write.
//
//   DATABASE_URL=... node scripts/ops/reward-catalogue-dry-run.mjs
//
// Reports the rows matched and unmatched between `syiling_rewards` and `rewards` (same title, trimmed and lower case), the costs that differ
// on matched rows (DM-77: the `rewards` value would be kept) and the `reward_claims` count.
//
// Read-only by construction: every statement runs inside one READ ONLY transaction that is rolled back, so the server refuses a write even
// if a statement here tried one. Prints counts and catalogue titles only: no pupil data is selected, and DATABASE_URL is never printed.
// Run on UAT by the designated UAT developer only.
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const TITLE_MATCH = 'lower(btrim(r.title)) = lower(btrim(s.name))'

/** Runs `work` in one READ ONLY transaction (one snapshot) and always rolls it back. */
export async function withReadOnlyClient(connectionString, work) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    return await work(client)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  }
}

const countOf = async (client, table) => Number((await client.query(`SELECT count(*)::bigint AS n FROM ${table}`)).rows[0].n)

/** The merge report. Selects catalogue columns and counts only. */
export async function readReport(client) {
  const pairs = (
    await client.query(`
      SELECT s.id::text AS syiling_id, s.name, s.cost_value_sen AS syiling_cost, r.id::text AS reward_id, r.title, r.cost_value_sen AS reward_cost
        FROM syiling_rewards s LEFT JOIN rewards r ON ${TITLE_MATCH}
       ORDER BY s.id, r.id`)
  ).rows
  const unmatchedRewards = (
    await client.query(`
      SELECT r.id::text AS id, r.title FROM rewards r
       WHERE NOT EXISTS (SELECT 1 FROM syiling_rewards s WHERE ${TITLE_MATCH}) ORDER BY r.id`)
  ).rows
  const claims = (
    await client.query(`
      SELECT count(*)::bigint AS total,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM rewards r WHERE ${TITLE_MATCH}))::bigint AS matched
        FROM reward_claims c JOIN syiling_rewards s ON s.id = c.reward_id`)
  ).rows[0]
  const matchCount = new Map()
  for (const p of pairs) if (p.reward_id !== null) matchCount.set(p.syiling_id, (matchCount.get(p.syiling_id) ?? 0) + 1)
  const matched = pairs.filter((p) => p.reward_id !== null)
  return {
    counts: {
      syilingRewards: await countOf(client, 'syiling_rewards'),
      rewards: await countOf(client, 'rewards'),
      rewardClaims: Number(claims.total),
      rewardRedemptions: await countOf(client, 'reward_redemptions'),
    },
    matched: matched.map((p) => ({ syilingId: p.syiling_id, rewardId: p.reward_id, title: p.title })),
    matchedSyilingRows: matchCount.size,
    ambiguous: [...matchCount].filter(([, n]) => n > 1).map(([id, n]) => ({ syilingId: id, title: pairs.find((p) => p.syiling_id === id).name, rewards: n })),
    unmatchedSyiling: pairs.filter((p) => p.reward_id === null).map((p) => ({ id: p.syiling_id, title: p.name })),
    unmatchedRewards: unmatchedRewards.map((r) => ({ id: r.id, title: r.title })),
    costDifferences: matched
      .filter((p) => p.syiling_cost !== p.reward_cost)
      .map((p) => ({ syilingId: p.syiling_id, rewardId: p.reward_id, title: p.title, syilingCostSen: p.syiling_cost, rewardCostSen: p.reward_cost })),
    claimsOfMatched: Number(claims.matched),
    claimsOfUnmatched: Number(claims.total) - Number(claims.matched),
  }
}

/** One line per fact; a title never breaks a line. */
export function renderReport(report) {
  const title = (t) => JSON.stringify(t.replace(/\s+/g, ' ').trim())
  const list = (rows, line) => (rows.length === 0 ? ['  (none)'] : rows.map((r) => `  ${line(r)}`))
  return [
    'Reward catalogue merge: dry run (DM-77). Read-only transaction, nothing was written. Merge status: awaiting data (#501).',
    '',
    'Row counts',
    `  syiling_rewards: ${report.counts.syilingRewards}`,
    `  rewards: ${report.counts.rewards}`,
    `  reward_claims: ${report.counts.rewardClaims}`,
    `  reward_redemptions: ${report.counts.rewardRedemptions}`,
    '',
    `Matched syiling_rewards (same trimmed lower-case title): ${report.matchedSyilingRows}`,
    ...list(report.matched, (m) => `syiling_rewards #${m.syilingId} = rewards #${m.rewardId} ${title(m.title)}`),
    '',
    `Matching more than one reward: ${report.ambiguous.length}`,
    ...list(report.ambiguous, (a) => `syiling_rewards #${a.syilingId} ${title(a.title)}: ${a.rewards} rewards`),
    '',
    `Unmatched syiling_rewards: ${report.unmatchedSyiling.length}`,
    ...list(report.unmatchedSyiling, (u) => `#${u.id} ${title(u.title)}`),
    '',
    `Unmatched rewards: ${report.unmatchedRewards.length}`,
    ...list(report.unmatchedRewards, (u) => `#${u.id} ${title(u.title)}`),
    '',
    `Cost differences on matched rows, in sen (DM-77 keeps the rewards value): ${report.costDifferences.length}`,
    ...list(report.costDifferences, (d) => `${title(d.title)}: syiling_rewards ${d.syilingCostSen}, rewards ${d.rewardCostSen}`),
    '',
    'reward_claims by match of their reward',
    `  matched: ${report.claimsOfMatched}`,
    `  unmatched: ${report.claimsOfUnmatched}`,
    '',
  ].join('\n')
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    process.stderr.write('DATABASE_URL is required.\n')
    return 2
  }
  process.stdout.write(renderReport(await withReadOnlyClient(url, readReport)))
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (err) => {
      process.stderr.write(`Dry run failed, nothing was written: ${err.message}\n`)
      process.exitCode = 1
    },
  )
}
