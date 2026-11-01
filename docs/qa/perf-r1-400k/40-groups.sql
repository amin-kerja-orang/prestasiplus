-- ~3% of approved MCQs of T4/T5/T1-T3 become members of stimulus groups of 2-3 (same subject and level, consecutive ids).
begin;
create temp table gm on commit drop as
select q.id qid, v.subject_id, v.education_level_id,
       row_number() over (partition by v.subject_id, v.education_level_id order by q.id) rn,
       count(*) over (partition by v.subject_id, v.education_level_id) cnt
  from questions q join question_versions v on v.question_id = q.id and v.version_no = 1
 where v.status = 'approved' and q.is_active and v.type = 'mcq' and v.number_label like 'PERF-%' and v.education_level_id >= 7;
create temp table gsel on commit drop as
select qid, subject_id, education_level_id, ((rn - 1) / 3) gidx, ((rn - 1) % 3) + 1 pos
  from gm where rn <= greatest(3, (cnt * 0.04)::int / 3 * 3) and (cnt * 0.04)::int >= 3;
create temp table gdef on commit drop as
select row_number() over (order by subject_id, education_level_id, gidx) gn, subject_id, education_level_id, gidx, count(*) members
  from gsel group by subject_id, education_level_id, gidx having count(*) >= 2;
create temp table gids (gn bigint, gid bigint, sid bigint) on commit drop;
with s as (
  insert into stimuli (kind, label, body_ms, caption, source_citation, reusable)
  select case gn % 4 when 0 then 'passage' when 1 then 'table' when 2 then 'diagram' else 'passage' end, 'Bahan ' || gn,
         'Bahan rangsangan nombor ' || gn || '. ' || repeat('Baca petikan ini dengan teliti sebelum menjawab. ', 4), 'Rajah ' || gn, 'Sumber ujian ' || gn, true
    from gdef order by gn returning id
), sn as (select id, row_number() over (order by id) gn from s),
g as (
  insert into stimulus_groups (label, scope) select 'Kumpulan ' || gn, 'section' from gdef order by gn returning id
), gn2 as (select id, row_number() over (order by id) gn from g),
link as (
  insert into stimulus_group_stimuli (group_id, stimulus_id, position) select gn2.id, sn.id, 1 from gn2 join sn using (gn) returning 1
)
insert into gids select gn2.gn, gn2.id, sn.id from gn2 join sn using (gn);
update questions q set group_id = gi.gid, group_position = s.pos::smallint
  from gsel s join gdef d on d.subject_id = s.subject_id and d.education_level_id = s.education_level_id and d.gidx = s.gidx join gids gi on gi.gn = d.gn
 where q.id = s.qid;
commit;
select count(*) groups from stimulus_groups; select count(*) grouped from questions where group_id is not null;
