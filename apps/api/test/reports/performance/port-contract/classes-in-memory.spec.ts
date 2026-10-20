import { InMemoryClasses } from '../fakes/in-memory-classes'
import { describeClassesReadPort, type ClassesHarness } from './classes-read.contract'

describeClassesReadPort('InMemoryClasses', async (seed) => {
  const port = new InMemoryClasses()
  const teacherName = new Map(seed.teachers.map((t) => [t.key, t.name]))
  for (const c of seed.classes) {
    port.add(
      {
        id: c.key,
        schoolId: c.school,
        kind: c.kind ?? 'classroom',
        name: c.name,
        teacherId: c.teacher,
        teacherName: c.teacher === null ? null : (teacherName.get(c.teacher) ?? null),
        subjectId: c.subject,
        subjectName: c.subject === null ? null : `Subjek ${c.subject}`,
        levelSlug: c.grade === 10 ? 't4' : 't5',
        classLevelSlug: c.grade === 10 ? 'tingkatan-4' : 'tingkatan-5',
        year: c.year,
        isActive: c.active,
      },
      c.members,
    )
  }
  const h: ClassesHarness = {
    port,
    classId: (k) => k,
    userId: (k) => k,
    schoolId: (k) => k,
    subject: (k) => ({ id: k, name: `Subjek ${k}` }),
    levelSlug: (g) => (g === 10 ? 't4' : 't5'),
    classLevelSlug: (g) => (g === 10 ? 'tingkatan-4' : 'tingkatan-5'),
  }
  return h
})
