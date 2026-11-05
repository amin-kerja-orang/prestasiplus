import { InMemoryAnswerFacts } from '../fakes/in-memory-answer-facts'
import { describeAnswerFactsPort } from './answer-facts.contract'

describeAnswerFactsPort('InMemoryAnswerFacts', async (seed) => {
  const port = new InMemoryAnswerFacts()
  for (const p of seed.pupils) port.addPupil(p)
  for (const c of seed.chapters) port.addChapter(c.id, { name: c.name, dskpCode: c.dskpCode, subjectCode: `SUBJ${c.subjectId}`, levelId: c.levelCode === null ? null : `lv-${c.levelCode}` })
  for (const t of seed.topics) port.addTopic(t.id, { name: t.name, chapterId: t.chapterId })
  for (const a of seed.answers) port.add({ ...a, chapterId: a.chapterId ?? null, topicId: a.topicId ?? null })
  return port
})
