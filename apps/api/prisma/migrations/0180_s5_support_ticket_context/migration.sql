-- 0180_s5_support_ticket_context
-- Purpose: DM-32, card S7-T09 (requested by team-cc on issue 503). support_tickets gains the ticket context the admin list needs:
-- created_role (active role at creation), school_id (snapshot), admin_replied_by_id and admin_replied_at (single admin reply).
-- Expand only: four nullable columns, no default, no rewrite of existing rows by the DDL. Old code that ignores them keeps working.
-- Constraints are added NOT VALID then VALIDATEd (short lock). The role list is the one of ck_user_roles_role (0002_identity).
-- Backfill (same migration, idempotent, only fills NULLs): school_id from users.school_id; created_role from user_roles only when the
-- user has exactly one role, else it stays NULL (no guessing; the admin list shows "—"). A re-run changes nothing.
-- Reversible: the down step (below, as a comment) drops the index, the constraints and the columns.

ALTER TABLE "support_tickets" ADD COLUMN "created_role" TEXT;
ALTER TABLE "support_tickets" ADD COLUMN "school_id" BIGINT;
ALTER TABLE "support_tickets" ADD COLUMN "admin_replied_by_id" BIGINT;
ALTER TABLE "support_tickets" ADD COLUMN "admin_replied_at" TIMESTAMPTZ(6);

ALTER TABLE "support_tickets" ADD CONSTRAINT "ck_support_tickets_created_role"
  CHECK ("created_role" IS NULL OR "created_role" IN ('admin', 'school_admin', 'ppd_officer', 'teacher', 'student', 'parent', 'sponsor')) NOT VALID;
ALTER TABLE "support_tickets" VALIDATE CONSTRAINT "ck_support_tickets_created_role";

ALTER TABLE "support_tickets" ADD CONSTRAINT "fk_support_tickets_school_id"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "support_tickets" VALIDATE CONSTRAINT "fk_support_tickets_school_id";

ALTER TABLE "support_tickets" ADD CONSTRAINT "fk_support_tickets_admin_replied_by_id"
  FOREIGN KEY ("admin_replied_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "support_tickets" VALIDATE CONSTRAINT "fk_support_tickets_admin_replied_by_id";

CREATE INDEX "ix_support_tickets_role_status_created" ON "support_tickets" ("created_role", "status", "created_at" DESC);

-- Backfill (idempotent: touches only rows where the target is still NULL).
UPDATE "support_tickets" t
   SET "school_id" = u."school_id"
  FROM "users" u
 WHERE u."id" = t."user_id" AND t."school_id" IS NULL AND u."school_id" IS NOT NULL;

UPDATE "support_tickets" t
   SET "created_role" = r."role"
  FROM (
    SELECT "user_id", MIN("role") AS "role"
      FROM "user_roles"
     GROUP BY "user_id"
    HAVING COUNT(*) = 1
  ) r
 WHERE r."user_id" = t."user_id" AND t."created_role" IS NULL;

-- Down (manual):
--   DROP INDEX "ix_support_tickets_role_status_created";
--   ALTER TABLE "support_tickets" DROP CONSTRAINT "fk_support_tickets_admin_replied_by_id";
--   ALTER TABLE "support_tickets" DROP CONSTRAINT "fk_support_tickets_school_id";
--   ALTER TABLE "support_tickets" DROP CONSTRAINT "ck_support_tickets_created_role";
--   ALTER TABLE "support_tickets" DROP COLUMN "admin_replied_at", DROP COLUMN "admin_replied_by_id", DROP COLUMN "school_id", DROP COLUMN "created_role";
