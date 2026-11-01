begin;
insert into source_papers (natural_key, subject_id, kertas, paper_code, year, exam_board, exam_type, source_kind, rights_status)
select 'perf:' || s.code || ':' || k || ':' || y || ':' || b || ':' || t, s.id, k::text, s.code || '/' || k, y, b, t, 'state_trial', 'school'
  from subjects s join spm_subject_configs c on c.subject_id = s.id
  cross join generate_series(1, 2) k cross join generate_series(2010, 2025) y
  cross join unnest(array['sbp','selangor_mpsm','mrsm','johor','perak','kedah','sabah']) b
  cross join unnest(array['sebenar','percubaan']) t;
create temp table sp_n on commit drop as
  select id, subject_id, kertas, paper_code, year, exam_board, exam_type,
         row_number() over (partition by subject_id order by id) rn, count(*) over (partition by subject_id) cnt
    from source_papers where natural_key like 'perf:%';
update question_versions v set source_paper_id = sp.id, paper_code = sp.paper_code, year = sp.year, exam_board = sp.exam_board, exam_type = sp.exam_type
  from sp_n sp
 where sp.subject_id = v.subject_id and sp.rn = 1 + (v.question_id % sp.cnt)
   and v.education_level_id in (10, 11) and v.number_label like 'PERF-%' and v.question_id % 100 < 45;
commit;
select count(*) source_papers from source_papers; select count(*) with_source from question_versions where source_paper_id is not null;
