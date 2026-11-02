select setseed(:seed);
begin;
create temp table b_attrs on commit drop as
with rows as (select g as i from generate_series(:lo, :hi) g),
u as (select i, random() u1, random() u2, random() u3, random() u4, random() u5, random() u6, random() u7, random() u8 from rows),
pick as (
  select u.*, c.subject_id, c.level_id, c.lvl, c.scode, c.chapters, c.units
    from u join perf_combos c on u.u1 >= c.lo and u.u1 < c.hi
)
select row_number() over (order by i) rn, i, subject_id, level_id, lvl, scode,
       case when u2 < .85 then 'mcq' when u2 < .90 then 'short' when u2 < .92 then 'numeric' when u2 < .97 then 'structured' else 'essay' end kind,
       case when u3 < .90 then 'approved' when u3 < .94 then 'draft' when u3 < .97 then 'review' else 'archived' end status,
       (u4 < .03) held,
       case when chapters is null then null else chapters[1 + floor(u5 * cardinality(chapters))::int] end chapter_id,
       case when units is null then null else units[1 + floor(u6 * cardinality(units))::int] end unit_id,
       1 + (case when u7 < .10 then 0 when u7 < .30 then 1 when u7 < .60 then 2 when u7 < .80 then 3 when u7 < .95 then 4 else 5 end) tp,
       u8, u5, u6, u7
  from pick;
create temp table b_q (rn bigint, qid bigint) on commit drop;
with ins as (
  insert into questions (live_version_no, latest_version_no, is_active, source_type, legacy_source, legacy_id, created_at, updated_at)
  select case when status = 'approved' then 1 end, 1, not (status = 'approved' and held),
         case when u8 < .5 then 'excel' when u8 < .8 then 'pdf' else 'manual' end, 'cloud', 'P' || i,
         now() - (u5 * 730 || ' days')::interval, now() - (u6 * 300 || ' days')::interval
    from b_attrs order by i
  returning id
), n as (select id, row_number() over (order by id) rn from ins)
insert into b_q select n.rn, n.id from n;
insert into question_versions (question_id, version_no, status, type, stem_ms, number_label, language, explanation_ms, subject_id, education_level_id, unit_node_id, chapter_id,
                               form_origin, difficulty_tp, kbat, year, exam_type, exam_board, source_kind, published_at, tag_review)
select q.qid, 1, a.status,
       case a.kind when 'mcq' then 'mcq' when 'short' then 'short' when 'numeric' then 'short' when 'structured' then 'structured' else 'essay' end,
       'Soalan ' || a.scode || ' ' || a.lvl || ' nombor ' || a.i || ': ' || repeat('Pertimbangkan situasi berikut dan pilih jawapan yang paling tepat berdasarkan konsep yang dipelajari. ', 1 + (a.i % 3)),
       'PERF-' || a.i, 'ms', case when a.u7 < .3 then 'Penjelasan ringkas bagi soalan nombor ' || a.i || '.' end,
       a.subject_id, a.level_id, a.unit_id, a.chapter_id,
       case when a.lvl = 'T4' then 't4' when a.lvl = 'T5' then 't5' else 't1_t3' end, a.tp,
       case when a.lvl in ('T4','T5') and a.u7 > .85 then (array['mengaplikasi','menganalisis','menilai','mencipta'])[1 + (a.i % 4)] end,
       case when a.u6 < .4 then 2010 + (a.i % 16) end, case when a.u6 < .4 then (array['sebenar','percubaan','modul','topikal','latihan'])[1 + (a.i % 5)] end,
       case when a.u6 < .2 then (array['sbp','selangor_mpsm','mrsm'])[1 + (a.i % 3)] end,
       case when a.u8 < .3 then 'lpm_official' when a.u8 < .6 then 'state_trial' else 'school' end,
       case when a.status = 'approved' then now() - (a.u5 * 600 || ' days')::interval end,
       (a.u7 < .01)
  from b_attrs a join b_q q on q.rn = a.rn order by a.i;
commit;
