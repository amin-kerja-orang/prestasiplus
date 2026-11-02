-- B3 T34-L1-residual: a reference-sheet picture (`imageFileId`) is named by its PUBLIC token only; the pupil read rule (path C) no longer matches
-- the internal decimal file id. One-off data fix: a decimal id on a stored sheet that names a `question_image` file becomes that file's public token.
-- A decimal id that names no such file is left as it is (the Terbit check reports it). Not reversible (the ids are not kept); the down step is a no-op.
UPDATE "papers" p
SET "reference_sheets" = (
  SELECT jsonb_agg(
           CASE
             WHEN jsonb_typeof(t.e) = 'object' AND jsonb_typeof(t.e -> 'imageFileId') = 'string' AND t.e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$' AND f."public_id" IS NOT NULL
               THEN jsonb_set(t.e, '{imageFileId}', to_jsonb(f."public_id"))
             ELSE t.e
           END
           ORDER BY t.ord)
  FROM jsonb_array_elements(p."reference_sheets") WITH ORDINALITY AS t(e, ord)
  LEFT JOIN "files" f
    ON f."purpose" = 'question_image'
   AND f."id" = (CASE WHEN jsonb_typeof(t.e) = 'object' AND jsonb_typeof(t.e -> 'imageFileId') = 'string' AND t.e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$' THEN (t.e ->> 'imageFileId')::bigint END)
)
WHERE jsonb_typeof(p."reference_sheets") = 'array'
  AND jsonb_array_length(p."reference_sheets") > 0
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(p."reference_sheets") x(e) WHERE jsonb_typeof(x.e) = 'object' AND jsonb_typeof(x.e -> 'imageFileId') = 'string' AND x.e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$');

UPDATE "blueprints" p
SET "reference_sheets" = (
  SELECT jsonb_agg(
           CASE
             WHEN jsonb_typeof(t.e) = 'object' AND jsonb_typeof(t.e -> 'imageFileId') = 'string' AND t.e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$' AND f."public_id" IS NOT NULL
               THEN jsonb_set(t.e, '{imageFileId}', to_jsonb(f."public_id"))
             ELSE t.e
           END
           ORDER BY t.ord)
  FROM jsonb_array_elements(p."reference_sheets") WITH ORDINALITY AS t(e, ord)
  LEFT JOIN "files" f
    ON f."purpose" = 'question_image'
   AND f."id" = (CASE WHEN jsonb_typeof(t.e) = 'object' AND jsonb_typeof(t.e -> 'imageFileId') = 'string' AND t.e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$' THEN (t.e ->> 'imageFileId')::bigint END)
)
WHERE jsonb_typeof(p."reference_sheets") = 'array'
  AND jsonb_array_length(p."reference_sheets") > 0
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(p."reference_sheets") x(e) WHERE jsonb_typeof(x.e) = 'object' AND jsonb_typeof(x.e -> 'imageFileId') = 'string' AND x.e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$');
