-- SW7-01 (LEAD decision 6371548446 item 3, half AM, m10): a teacher class is attached to the teacher's own school when
-- `POST /guru/classes` gets no `schoolId`. A class with no school is invisible to the school admin (every school-admin
-- read filters on classrooms.school_id), so the teacher classes created before that default are given their owner's
-- CURRENT school here, the same best-available value 0018 used for its backfill.
--
-- One-off data change, no schema change. Idempotent: only rows whose school is still NULL are touched, so a re-run
-- changes nothing. It leaves alone
--   - school classes (`kind = 'school_class'`: owned by the school, no teacher),
--   - classes whose teacher has no school (nothing to copy; they stay NULL),
--   - classes whose teacher row is gone (teacher_id NULL after a delete: no join).
-- updated_at is not touched (precedent 0018: a backfill is not an edit by the owner).
-- Migrated classes (ETL) are covered by the same rule once loaded: the ETL fix is a separate hand-off (Amin1); run this
-- statement again after the load if a legacy class arrives without a school.
--
-- Not reversible: the previous NULL school is not recorded (and was the defect).

UPDATE "classrooms" c
SET "school_id" = u."school_id"
FROM "users" u
WHERE c."teacher_id" = u."id" AND c."school_id" IS NULL AND u."school_id" IS NOT NULL AND c."kind" = 'classroom';
