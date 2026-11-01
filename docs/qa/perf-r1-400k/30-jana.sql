-- Jana-able ADDMATH pool for blueprint 3472/2: K=150 paper-style essay questions per quota unit (marks and TP in the section profile).
select setseed(0.77);
begin;
create temp table j on commit drop as
with bp as (
  select s.position, (l->'unit'->>'nodeId')::bigint unit_id
    from blueprints b join blueprint_sections s on s.blueprint_id = b.id,
         jsonb_array_elements(s.quota->'lines') l
   where b.code = '3472/2' and b.status = 'active'
), x as (
  select bp.position sec, bp.unit_id, g k from bp cross join generate_series(1, 150) g
)
select row_number() over (order by sec, unit_id, k) rn, x.*, n.education_level_id level_id, n.subject_id, lv.code lvl,
       case sec when 1 then 5 + (k % 5) else 10 end marks,
       case sec when 1 then 3 + (k % 3) when 2 then 4 + (k % 2) else 4 + (k % 3) end tp,
       true is_kbat
  from x join curriculum_nodes n on n.id = x.unit_id join education_levels lv on lv.id = n.education_level_id;
create temp table jq (rn bigint, qid bigint) on commit drop;
with ins as (
  insert into questions (live_version_no, latest_version_no, is_active, source_type, legacy_source, legacy_id)
  select 1, 1, true, 'manual', 'cloud', 'J' || rn from j order by rn returning id
), n as (select id, row_number() over (order by id) rn from ins) insert into jq select rn, id from n;
create temp table jv (vid bigint, qid bigint, marks int) on commit drop;
with ins as (
  insert into question_versions (question_id, version_no, status, type, stem_ms, number_label, language, subject_id, education_level_id, unit_node_id, form_origin, difficulty_tp, kbat, published_at, source_kind, year, exam_type)
  select q.qid, 1, 'approved', 'essay', 'Soalan Matematik Tambahan Kertas 2 bahagian ' || j.sec || ' nombor ' || j.rn, 'PERFJ-' || j.rn, 'ms', j.subject_id, j.level_id, j.unit_id,
         case j.lvl when 'T5' then 't5' else 't4' end, j.tp, case when j.is_kbat then 'menganalisis' end, now(), 'state_trial', 2015 + (j.rn % 10), 'percubaan'
    from j join jq q on q.rn = j.rn order by j.rn returning id, question_id
) insert into jv select i.id, i.question_id, j.marks from ins i join jq q on q.qid = i.question_id join j on j.rn = q.rn;
with p as (
  insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode, word_min, word_max)
  select vid, 1, 1, '1', 'Selesaikan dengan lengkap.', marks, 'essay', null, null from jv returning id, marks
)
insert into answer_keys (part_id, kind, content)
select p.id, 'points', jsonb_build_object('kind', 'points', 'marks', p.marks,
   'groups', jsonb_build_array(jsonb_build_object('id', 'g1', 'anyN', p.marks, 'pointIds', (select jsonb_agg('p' || g) from generate_series(1, p.marks) g), 'eachMarks', 1)),
   'points', (select jsonb_agg(jsonb_build_object('id', 'p' || g, 'code', 'P', 'label', 'Isi ' || g, 'marks', 1)) from generate_series(1, p.marks) g))
  from p;
commit;
select count(*) jana_questions from question_versions where number_label like 'PERFJ-%';
