import { beforeAll, it } from 'vitest'
import { practiceAnswers, practice } from '@/modules/m05-practice/mock'
import { bootDrill } from './drill-helpers'

beforeAll(async () => {
  await bootDrill()
}, 600_000)

const t = (label: string, f: () => unknown) => {
  const s = performance.now()
  const r = f()
  console.log(label, Math.round(performance.now() - s), 'ms', r)
}

it('probe', () => {
  t('all P user cold', () => practiceAnswers.groupCount('Q-ANS-P', 'userId').size)
  t('all P user warm', () => practiceAnswers.groupCount('Q-ANS-P', 'userId').size)
  t('week P user', () => practiceAnswers.groupCount('Q-ANS-P', 'userId', 'week').size)
  t('P count', () => [practiceAnswers.count('Q-ANS-P'), practiceAnswers.count('Q-ANS-P-CORRECT'), practiceAnswers.count('Q-ANS-P','today'), practiceAnswers.count('Q-ANS-P','week'), practiceAnswers.count('Q-ANS-P','month')])
  t('week facet', () => [...practiceAnswers.groupCount('Q-ANS-P', 'week')].sort((a,b)=>Number(a[0])-Number(b[0])).slice(-4))
  t('latest10 today', () => practiceAnswers.query('Q-ANS-P', { sort: [{ field: 'answeredAtMs', dir: 'desc' }, {field:'id', dir:'desc'}], page: 1, pageSize: 10 }, 'today').rows.map(r=>[r.id, r.userId, r.answeredAt, r.subjectId, r.isCorrect]))
  t('latest10 week', () => practiceAnswers.query('Q-ANS-P', { sort: [{ field: 'answeredAtMs', dir: 'desc' }, {field:'id', dir:'desc'}], page: 1, pageSize: 10 }, 'week').total)
  t('latest10 all', () => practiceAnswers.query('Q-ANS-P', { sort: [{ field: 'answeredAtMs', dir: 'desc' }, {field:'id', dir:'desc'}], page: 1, pageSize: 10 }).rows.length)
  t('match lastweek', () => practiceAnswers.query('Q-ANS-P', { match: (r) => r.answeredAtMs < 1790000000000, page:1, pageSize:1 }, 'month').total)
  t('sessions P', () => [practice.count('Q-SESS-P'), practice.count('Q-SESS-P','today'), practice.count('Q-SESS-P','week'), practice.count('Q-SESS-P','month')])
})
