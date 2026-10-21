import { InMemoryPracticeRead } from '../fakes/in-memory-practice-read'
import { describePracticeReadPort } from './practice-read.contract'

describePracticeReadPort('InMemoryPracticeRead', async (seed) => {
  const port = new InMemoryPracticeRead()
  for (const p of seed.pupils) port.addPupil(p)
  for (const s of seed.sessions) port.addSession(s)
  for (const a of seed.answers) {
    const { userId, n, correct, ...over } = a
    port.addAnswers(userId, n, correct, over)
  }
  return port
})
