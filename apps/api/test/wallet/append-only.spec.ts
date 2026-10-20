import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { WalletRepository } from '../../src/modules/wallet/wallet.repository'

const MODULE_DIR = fileURLToPath(new URL('../../src/modules/wallet/', import.meta.url))
const sources = readdirSync(MODULE_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, text: readFileSync(join(MODULE_DIR, f), 'utf8') }))

/** Strip comments so a sentence about "update" in a doc comment is not a finding. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('coin_ledger is append-only in code (AC2)', () => {
  it('the repository surface has no method that updates, deletes or upserts a ledger row', () => {
    const methods = Object.getOwnPropertyNames(WalletRepository.prototype).filter((m) => m !== 'constructor')
    expect(methods).toContain('appendLedger')
    const ledgerMethods = methods.filter((m) => /ledger/i.test(m))
    expect(ledgerMethods.sort()).toEqual(['appendLedger', 'ledgerByKey', 'ledgerOf'])
    expect(methods.filter((m) => /^(update|delete|remove|upsert|patch|set|edit|rewrite)/i.test(m) && /ledger/i.test(m))).toEqual([])
  })

  it('no source file of the module writes coin_ledger except through create (Prisma) on the repository', () => {
    for (const { file, text } of sources) {
      const body = code(text)
      expect(body, file).not.toMatch(/coinLedger\s*\.\s*(update|updateMany|delete|deleteMany|upsert|createMany)\b/)
      expect(body, file).not.toMatch(/\b(UPDATE|DELETE\s+FROM|TRUNCATE)\s+"?coin_ledger/i)
      expect(body, file).not.toMatch(/\bINSERT\s+INTO\s+"?coin_ledger/i) // inserts go through appendLedger (Prisma create)
    }
    const repo = code(sources.find((s) => s.file === 'wallet.repository.ts')!.text)
    expect(repo.match(/coinLedger\s*\.\s*create\b/g)).toHaveLength(1)
  })

  it('nothing outside the module writes the wallet tables (ADR-0014)', () => {
    const SRC = fileURLToPath(new URL('../../src/', import.meta.url))
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) {
          if (p === MODULE_DIR.replace(/[\\/]+$/, '') || e.name === 'generated') continue
          walk(p)
        } else if (e.name.endsWith('.ts')) files.push(p)
      }
    }
    walk(SRC)
    const offenders = files.filter((f) => /\b(coinLedger|tokenMovement|sessionCredit|dailyLoginMark)\s*\.\s*(create|update|delete|upsert)|\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(coin_ledger|wallets|streaks|token_movements|session_credits|daily_login_marks)\b/i.test(code(readFileSync(f, 'utf8'))))
    expect(offenders).toEqual([])
  })
})
