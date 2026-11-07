-- S6-T14 (DM-73, INV-38, FR-GUR-8-6): one class name per teacher and academic year (case and edge-space insensitive).
-- Data step first (idempotent): inside each (teacher_id, academic_year, lower(btrim(name))) group of teacher classes
-- the lowest id keeps its name, the others become "<name> (2)", "<name> (3)" ... in id order; a suffix that would
-- collide with an existing name of the same teacher and year is skipped. The base is cut so the result stays within
-- the 255 character name check. A second run finds no duplicate and changes nothing.
-- Then the PARTIAL unique index (school classes and orphaned classes are excluded).
-- rollback: DROP INDEX "uq_classrooms_teacher_year_name"; (the renamed names stay).

DO $$
DECLARE
  r RECORD;
  k INTEGER;
  suffix TEXT;
  candidate TEXT;
BEGIN
  FOR r IN
    SELECT id, teacher_id, academic_year, btrim(name) AS base
      FROM (
        SELECT c.id, c.teacher_id, c.academic_year, c.name,
               row_number() OVER (PARTITION BY c.teacher_id, c.academic_year, lower(btrim(c.name)) ORDER BY c.id) AS rn
          FROM classrooms c
         WHERE c.kind = 'classroom' AND c.teacher_id IS NOT NULL
      ) d
     WHERE d.rn > 1
     ORDER BY id
  LOOP
    k := 2;
    LOOP
      suffix := ' (' || k || ')';
      candidate := left(r.base, 255 - char_length(suffix)) || suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM classrooms o
         WHERE o.kind = 'classroom' AND o.teacher_id = r.teacher_id AND o.academic_year = r.academic_year
           AND o.id <> r.id AND lower(btrim(o.name)) = lower(btrim(candidate))
      );
      k := k + 1;
    END LOOP;
    UPDATE classrooms SET name = candidate, updated_at = now() WHERE id = r.id;
  END LOOP;
END
$$;

CREATE UNIQUE INDEX "uq_classrooms_teacher_year_name"
  ON "classrooms" ("teacher_id", "academic_year", lower(btrim("name")))
  WHERE "kind" = 'classroom' AND "teacher_id" IS NOT NULL;
