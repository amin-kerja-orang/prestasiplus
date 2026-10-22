import { INTAKE_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addAccount, bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

let t: WorkflowTestApp
let teacher: LoggedIn
let other: LoggedIn
let admin: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  await addAccount(t.db, 'guru.lain@demo.test', 'teacher', 'DEMO001')
  teacher = await loginAs(t, 'guru@demo.test')
  other = await loginAs(t, 'guru.lain@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

type Dup = { id: string; kind: string; scope: string; status: string; matchedQuestionId: string | null; matchedItemId: string | null; restricted: boolean; similarity: number | null }

async function run(who: LoggedIn, stems: string[]): Promise<{ batchId: string; ids: string[] }> {
  t.ai.paper = () => paper(stems.map((stem, i) => draft(t.codes, String(i + 1), { stem })))
  const { batchId } = await readyBatch(t, who)
  await extractAndRun(t, who, batchId)
  return { batchId, ids: (await itemsOf(who, batchId)).map((i) => i.id) }
}
const itemOf = async (who: LoggedIn, id: string) => (await who.agent.get(`/api/intake/items/${id}`)).body.data as { state: string; duplicates: Dup[] }

describe('automatic check (US-06)', () => {
  it('flags an identical question already in the bank as exact (open); the item is needs_review and nothing is decided', async () => {
    const stem = uniqueStem()
    const first = await run(teacher, [stem])
    expect((await post(teacher, `/intake/items/${first.ids[0]!}/accept`)).status).toBe(200)

    const second = await run(teacher, [stem])
    const item = await itemOf(teacher, second.ids[0]!)
    expect(item.state).toBe('needs_review')
    const d = item.duplicates.find((x) => x.scope === 'bank')!
    expect(d).toMatchObject({ kind: 'exact', status: 'open', similarity: 1, restricted: false })
    expect(d.matchedQuestionId).toBeTruthy()
    // Exact duplicates do not block accept (BE-10 submit enforces them); the item is not auto-rejected.
    expect((await post(teacher, `/intake/items/${second.ids[0]!}/accept`)).status).toBe(200)
  })

  it('withholds the bank question id from a Guru who does not own it', async () => {
    const stem = uniqueStem()
    const owner = await run(teacher, [stem])
    await post(teacher, `/intake/items/${owner.ids[0]!}/accept`)
    const foreign = await run(other, [stem])
    const d = (await itemOf(other, foreign.ids[0]!)).duplicates.find((x) => x.scope === 'bank')!
    expect(d.restricted).toBe(true)
    expect(d.matchedQuestionId).toBeNull()
    // An Admin Pusat can read the question, so the id is shown.
    const seen = (await itemOf(admin, foreign.ids[0]!)).duplicates.find((x) => x.scope === 'bank')!
    expect(seen.restricted).toBe(false)
    expect(seen.matchedQuestionId).toBeTruthy()
  })

  it('same text with different numbers is a variant (informational: the state stays generated); a one-word change is near', async () => {
    const base = uniqueStem()
    const first = await run(teacher, [`${base} apabila x ialah 12`])
    await post(teacher, `/intake/items/${first.ids[0]!}/accept`)

    const variant = await run(teacher, [`${base} apabila x ialah 47`])
    const v = await itemOf(teacher, variant.ids[0]!)
    expect(v.duplicates.find((x) => x.scope === 'bank')?.kind).toBe('variant')
    expect(v.state).toBe('generated')

    const words = base.split(' ')
    words[3] = 'berlainan'
    const near = await run(teacher, [`${words.join(' ')} apabila x ialah 12 dan`])
    const n = await itemOf(teacher, near.ids[0]!)
    const nd = n.duplicates.find((x) => x.scope === 'bank')
    expect(nd?.kind).toBe('near')
    expect(nd?.similarity).toBeGreaterThanOrEqual(0.85)
    expect(n.state).toBe('needs_review')
  })

  it('in one batch the later item carries the flag naming the earlier one', async () => {
    const stem = uniqueStem()
    const { ids } = await run(teacher, [stem, uniqueStem(), stem])
    const [a, , c] = ids as [string, string, string]
    const first = await itemOf(teacher, a)
    const third = await itemOf(teacher, c)
    expect(first.duplicates).toHaveLength(0)
    expect(third.duplicates).toHaveLength(1)
    expect(third.duplicates[0]).toMatchObject({ kind: 'exact', scope: 'batch', matchedItemId: a, status: 'open' })
    expect(third.state).toBe('needs_review')
  })
})

describe('decisions (AC-06.2, AC-06.3, AC-06.5)', () => {
  it('duplicate links the item to a bank question it may read; the state becomes duplicate; not_duplicate dismisses the entry', async () => {
    const stem = uniqueStem()
    const first = await run(teacher, [stem])
    await post(teacher, `/intake/items/${first.ids[0]!}/accept`)
    const second = await run(teacher, [stem])
    const item = await itemOf(teacher, second.ids[0]!)
    const found = item.duplicates.find((x) => x.scope === 'bank')!

    const linked = await post(teacher, `/intake/items/${second.ids[0]!}/duplicate`, { decision: 'duplicate', matchedQuestionId: found.matchedQuestionId, note: 'Sama dengan soalan sedia ada.' })
    expect(linked.status, JSON.stringify(linked.body)).toBe(200)
    expect(linked.body.data.state).toBe('duplicate')
    expect((linked.body.data.duplicates as Dup[]).find((x) => x.id === found.id)?.status).toBe('linked')
    expect(linked.body.data.events.some((e: { action: string }) => e.action === 'marked_duplicate')).toBe(true)

    const dismissed = await post(teacher, `/intake/items/${second.ids[0]!}/duplicate`, { decision: 'not_duplicate', duplicateId: found.id })
    expect(dismissed.status, JSON.stringify(dismissed.body)).toBe(200)
    expect((dismissed.body.data.duplicates as Dup[]).find((x) => x.id === found.id)?.status).toBe('dismissed')
    expect(dismissed.body.data.state).toBe('generated')
  })

  it('variant links without changing the state; a link to an item of the same batch creates the entry', async () => {
    const { ids } = await run(teacher, [uniqueStem(), uniqueStem()])
    const [a, b] = ids as [string, string]
    const res = await post(teacher, `/intake/items/${a}/duplicate`, { decision: 'variant', matchedItemId: b })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.state).toBe('generated')
    const entry = (res.body.data.duplicates as Dup[])[0]!
    expect(entry).toMatchObject({ kind: 'variant', status: 'linked', scope: 'batch', matchedItemId: b })
    expect(res.body.data.events.some((e: { action: string }) => e.action === 'linked_variant')).toBe(true)
  })

  it('an unknown, foreign-batch or unreadable target gets the identical 422 on the field', async () => {
    const { ids } = await run(teacher, [uniqueStem()])
    const elsewhere = await run(teacher, [uniqueStem()])
    const stem = uniqueStem()
    const theirs = await run(other, [stem])
    await post(other, `/intake/items/${theirs.ids[0]!}/accept`)
    const foreignQuestion = (await t.db.query<{ id: string }>(`select question_id::text id from intake_items where id = $1`, [theirs.ids[0]]))[0]!.id

    const responses = [
      await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'duplicate', matchedItemId: '987654321' }),
      await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'duplicate', matchedItemId: elsewhere.ids[0] }),
      await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'duplicate', matchedItemId: ids[0] }),
    ]
    const questions = [
      await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'duplicate', matchedQuestionId: '987654321' }),
      await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'duplicate', matchedQuestionId: foreignQuestion }),
    ]
    for (const r of responses) {
      expect(r.status).toBe(422)
      expect(r.body.error.fields.matchedItemId).toBe(INTAKE_MESSAGES.duplicateTargetNotFound)
    }
    for (const r of questions) {
      expect(r.status).toBe(422)
      expect(r.body.error.fields.matchedQuestionId).toBe(INTAKE_MESSAGES.duplicateTargetNotFound)
    }
    expect(questions[0]!.body.error).toEqual({ ...questions[1]!.body.error, requestId: questions[0]!.body.error.requestId })
    // Body shape rules.
    expect((await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'duplicate' })).status).toBe(422)
    expect((await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'not_duplicate' })).status).toBe(422)
    expect((await post(teacher, `/intake/items/${ids[0]!}/duplicate`, { decision: 'not_duplicate', duplicateId: '987654321' })).status).toBe(422)
  })
})
