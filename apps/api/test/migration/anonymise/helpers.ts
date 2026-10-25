import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DUMP_FORMAT } from '../../../src/migration/staging/readers'

export const TEST_KEY = 'unit-test-key-0000000000-not-a-secret'
export const OTHER_KEY = 'another-test-key-111111111-not-a-secret'

/** `apps/api/.migration-out` is git-ignored and inside the repository, so the output guard accepts it. */
const OUT_ROOT = fileURLToPath(new URL('../../../.migration-out/', import.meta.url))

export interface Scratch {
  /** A fresh path under `.migration-out` (the only place the tool may write). */
  out(name: string): string
  /** A fresh path outside the repository. */
  outside(name: string): string
  cleanup(): void
}

export function scratch(): Scratch {
  const base = join(OUT_ROOT, `be35-test-${randomBytes(4).toString('hex')}`)
  mkdirSync(base, { recursive: true })
  const outside = mkdtempSync(join(tmpdir(), 'pp-be35-'))
  return {
    out: (name) => join(base, name),
    outside: (name) => join(outside, name),
    cleanup() {
      rmSync(base, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    },
  }
}

export type Rows = Record<string, unknown>[]

/** Writes a `pp-staging-dump/1` directory. */
export function writeDump(dir: string, tables: Record<string, Rows>): void {
  mkdirSync(dir, { recursive: true })
  const manifest: Record<string, { rows: number; file?: string }> = {}
  for (const [name, rows] of Object.entries(tables)) {
    if (rows.length === 0) {
      manifest[name] = { rows: 0 }
      continue
    }
    manifest[name] = { rows: rows.length, file: `${name}.ndjson` }
    writeFileSync(join(dir, `${name}.ndjson`), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ format: DUMP_FORMAT, source: 'cloud', tables: manifest }))
}

export function readDump(dir: string): Record<string, Rows> {
  const out: Record<string, Rows> = {}
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { tables: Record<string, { rows: number; file?: string }> }
  for (const [name, entry] of Object.entries(manifest.tables)) {
    out[name] = entry.file
      ? readFileSync(join(dir, entry.file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
      : []
  }
  return out
}

/** All text of all files in a directory, for "grep the output" assertions. */
export function allText(dir: string): string {
  return readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
}

export function capture() {
  const lines: string[] = []
  return { lines, out: (l: string) => void lines.push(l), err: (l: string) => void lines.push(l), text: () => lines.join('\n') }
}

/**
 * Recognisable FAKE personal data. Nothing here is a real person: the names are made-up strings, the numbers
 * are patterned (1111, 0101) and the e-mail domains are reserved. They have the SHAPE of real values so the
 * leak scan and the patterns are exercised.
 */
export const PII = {
  name1: 'Qwertyus Plorbinski',
  name2: 'Zanthor Mikkelvane',
  name3: 'Brindle Oakhaven',
  email1: 'qwertyus.plorbinski@leak-check.invalid',
  email2: 'zanthor.m@leak-check.invalid',
  phone1: '011-1111 2222',
  phone2: '0113333 4444',
  ic1: '010101-01-0101',
  ic2: '020202-02-0202',
  username1: 'qplorbinski_7',
  username2: 'zanthor_m',
  googleId: '109876543210987654321',
  referral: 'RFQWERTY',
  bcryptHash1: '$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456',
  bcryptHash2: '$2y$10$zyxwvutsrqponmlkjihgfeZYXWVUTSRQPONMLKJIHGFEDCBA9876543',
  argonHash: '$argon2id$v=19$m=65536,t=4,p=1$c29tZXNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaGhhc2g',
  plainPassword: 'hunter2-plain-password',
  rememberToken: 'rt_ThisIsARememberTokenValue123456',
  inviteToken: 'inv_ThisIsAnInviteTokenValue654321',
  ticketSubject: 'Tolong baiki akaun anak saya qwertyus.plorbinski@leak-check.invalid',
  noteBody: 'Hubungi ibu saya di 011-1111 2222 selepas waktu sekolah',
  visitor: 'vis_abcdefghijklmnop12345',
  ip: '10.20.30.40',
  apiKey: 'sk-live-ThisIsASecretSettingValue000',
  schoolName: 'Sekolah Menengah Zorbaville',
} as const

export function piiTables(): Record<string, Rows> {
  return {
    schools: [
      { id: 1, name: PII.schoolName, code: 'ZRB1234', type: 'smk', state: 'negeri_a', district: 'daerah_a1', join_code: 'JOINZRB1', is_active: '1', created_at: '2026-01-01T00:00:00Z' },
    ],
    users: [
      { id: 1, name: PII.name1, email: PII.email1, phone: PII.phone1, ic: PII.ic1, username: PII.username1, password: PII.bcryptHash1, role: 'pelajar', school_id: 1, referral_code: PII.referral, remember_token: PII.rememberToken, parent_invite_token: PII.inviteToken, bio: 'Saya suka bola sepak dan membaca', is_active: '1', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: PII.name2, email: PII.email2, phone: PII.phone2, ic: PII.ic2, username: PII.username2, password: PII.bcryptHash2, role: 'guru', school_id: 1, is_active: '1', created_at: '2026-01-02T00:00:00Z' },
      // the same person as user 1, written differently: case-variant e-mail, other spacing and case in the name
      { id: 3, name: `  ${PII.name1.toUpperCase()} `, email: PII.email1.toUpperCase(), phone: '01111112222', ic: '010101010101', username: PII.username1, password: PII.argonHash, role: 'pelajar', school_id: 1, is_active: '1' },
      { id: 4, name: PII.name3, email: null, phone: null, ic: null, username: 'roster4', password: PII.plainPassword, role: 'pelajar', school_id: 1, is_active: '0' },
      { id: 5, name: PII.name3, email: '', phone: '', ic: '', username: 'roster5', password: '', role: 'pelajar', school_id: 99, is_active: '1' },
      { id: 6, name: 'Roster Six', email: null, phone: null, ic: null, username: 'roster6', password: null, role: 'pelajar', school_id: null, is_active: '1' },
    ],
    sponsors: [{ id: 1, organisation: PII.schoolName, category: 'korporat', status: 'aktif' }],
    foster_applications: [{ id: 1, category: 'a', status: 'baru' }],
    support_tickets: [{ id: 1, user_id: 1, subject: PII.ticketSubject, status: 'dibuka', admin_reply: null }],
    timeline_entries: [{ id: 1, user_id: 1, title: 'Nota peribadi', body: PII.noteBody, happened_on: '2026-01-02' }],
    audit_logs: [{ id: 1, user_id: 1, action: 'login', subject_type: 'user' }],
    chatbot_conversations: [{ id: 1, user_id: 1 }],
    settings: [{ id: 1, key: 'openai.api_key', value: PII.apiKey, group: 'ai' }],
    psychometric_results: [{ id: 1, user_id: 1 }],
    // the one jsonb free-text column in the PII fixture: scrubbed value by value, numbers and booleans kept
    game_rooms: [{ id: 1, state: { notes: 'Suka bersendirian', score: 7, flags: [true, 'cemas'] }, status: 'aktif' }],
  }
}

/** Every string a leak would show, in the forms it could appear. */
export function originalValues(): string[] {
  const values = Object.values(PII) as string[]
  const out = new Set<string>(values)
  for (const v of values) {
    out.add(v.toLowerCase())
    out.add(v.toUpperCase())
  }
  for (const digits of [PII.phone1, PII.phone2, PII.ic1, PII.ic2]) out.add(digits.replace(/\D/g, ''))
  out.add('01111112222')
  out.add('010101010101')
  out.add('Suka bersendirian')
  out.add('Saya suka bola sepak dan membaca')
  return [...out]
}
