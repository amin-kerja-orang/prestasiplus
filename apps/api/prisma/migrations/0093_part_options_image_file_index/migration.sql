-- Question images: index on part_options.image_file_id for the pupil read rule of `question_image` files
-- (FilesService.canRead checks "is this file an option image of a live, published question" on every download).
-- Additive only (one index, no data change). Without it the check scans part_options for every image request.
--
-- Hand-written, like 0091: a partial index (WHERE image_file_id IS NOT NULL) cannot be expressed in schema.prisma, and
-- declaring it as @@index would make the next `prisma migrate dev` drop the WHERE clause, so schema.prisma is not changed.
-- The name is 29 characters (PostgreSQL truncates identifiers longer than 63 bytes).
--
-- Reversible: DROP INDEX "ix_part_options_image_file_id";

CREATE INDEX "ix_part_options_image_file_id" ON "part_options"("image_file_id") WHERE "image_file_id" IS NOT NULL;
