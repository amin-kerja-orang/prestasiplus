-- T54 combos: where questions go (subject x level), weights per level group. Scratch table, dropped at the end.
drop table if exists perf_combos;
create table perf_combos as
with pop(code, w) as (values ('MATH',12),('BM',10),('BI',9),('SCI',9),('SEJ',8),('PI',6),('PHY',5),('CHEM',5),('BIO',5),('ADDMATH',4),('GEO',3),('EKON',3),('AKAUN',2),('PERNIAGA',2),('PM',3)),
raw as (
  select s.id subject_id, l.id level_id, l.code lvl, s.code scode,
         case when l.code like 'D%' then 'D' when l.code in ('T1','T2','T3') then 'M' else 'U' end grp,
         coalesce(p.w, 1) pop,
         (select array_agg(c.id order by c.id) from chapters c where c.subject_id = s.id and c.education_level_id = l.id) chapters,
         (select array_agg(n.id order by n.id) from curriculum_nodes n where n.subject_id = s.id and n.education_level_id = l.id and n.kind = 'unit') units
    from subjects s cross join education_levels l left join pop p on p.code = s.code
   where exists (select 1 from chapters c where c.subject_id = s.id and c.education_level_id = l.id)
      or exists (select 1 from curriculum_nodes n where n.subject_id = s.id and n.education_level_id = l.id and n.kind = 'unit')
),
w as (
  select r.*, (case grp when 'D' then 0.30 when 'M' then 0.25 else 0.45 end) * pop / sum(pop) over (partition by grp) weight from raw r
)
select subject_id, level_id, lvl, scode, grp, chapters, units, weight,
       coalesce(sum(weight) over (order by subject_id, level_id rows between unbounded preceding and 1 preceding), 0) lo,
       sum(weight) over (order by subject_id, level_id) hi
  from w;
update perf_combos set hi = 1.000001 where hi = (select max(hi) from perf_combos);
select grp, count(*) combos, round(sum(weight)::numeric,3) share from perf_combos group by grp;
