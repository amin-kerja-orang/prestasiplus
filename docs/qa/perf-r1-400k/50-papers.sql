-- 240 published curated papers (SPM subjects x kertas 1/2 x years), 3 sections x 12 placements of approved T4/T5 questions of the subject
begin;
create temp table pp on commit drop as
select row_number() over (order by s.id, k, y) pn, s.id subject_id, s.code scode, k kertas, y yr
  from subjects s join spm_subject_configs c on c.subject_id = s.id cross join generate_series(1, 2) k cross join generate_series(2016, 2025) y
 where s.code <> 'ADDMATH' or y >= 2021;
create temp table pids (pn bigint, id bigint) on commit drop;
with ins as (
  insert into papers (kind, title, subject_id, kertas, year, paper_code, level_scope, printed_duration_min, status, version, published_at)
  select 'pilihan', 'Kertas ' || scode || ' ' || kertas || ' ' || yr, subject_id, kertas, yr, scode || '/' || kertas, 't4_t5', 120, 'published', 1, now() from pp order by pn returning id
), n as (select id, row_number() over (order by id) pn from ins) insert into pids select pn, id from n;
create temp table sids (paper_id bigint, pos int, id bigint) on commit drop;
with ins as (
  insert into paper_sections (paper_id, position, label, rule_type, question_count, mark_budget, allowed_modes)
  select pids.id, g, 'Bahagian ' || chr(64 + g), 'all', 12, 12, '{}' from pids cross join generate_series(1, 3) g order by pids.id, g returning id, paper_id, position
) insert into sids select paper_id, position, id from ins;
insert into paper_placements (paper_section_id, question_id, pinned_version_no, position)
select sids.id, q.qid, 1, q.k
  from pp join pids using (pn) join sids on sids.paper_id = pids.id
  cross join lateral (
    select x.id qid, row_number() over () k
      from (select q.id from questions q join question_versions v on v.question_id = q.id and v.version_no = 1
             where v.subject_id = pp.subject_id and v.status = 'approved' and q.is_active and v.type = 'mcq' and v.education_level_id in (10, 11) and q.group_id is null
               and q.id >= (pp.pn * 7919 + sids.pos * 104729) % 300000 + 1
             order by q.id limit 12) x
  ) q;
commit;
select count(*) papers from papers; select count(*) placements from paper_placements;
