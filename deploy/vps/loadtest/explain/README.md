# Read-only EXPLAIN statements (latih-tubi-sample-perf diagnosis)

Rendered from the code at 74b6bcef with bind parameters inlined. Each file is `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` of a
SELECT the pupil path sends; none writes. Run against the database with psql, for example:

    docker exec -i <db container> psql -U <user> -d <db> -X -q < 01-latih-tubi-start-window-scan.sql
