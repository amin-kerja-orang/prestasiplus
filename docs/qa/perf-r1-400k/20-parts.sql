-- parts, options, keys for the versions with id in (:vlo, :vhi]  (PERF- labels only)
begin;
insert into question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms, marks, mode, word_min, word_max)
select v.id, null, 1, 1, case v.type when 'structured' then '(a)' else '1' end,
       case v.type when 'mcq' then 'Pilih jawapan yang betul.' when 'structured' then 'Selesaikan soalan berikut.' else 'Jawab soalan ini dengan lengkap.' end,
       case v.type when 'structured' then null when 'mcq' then 1 when 'short' then 2 else 5 end,
       case v.type when 'mcq' then 'mcq' when 'short' then case when v.id % 3 = 0 then 'numeric' else 'short_text' end when 'structured' then null else 'essay' end,
       case when v.type = 'essay' then 20 end, case when v.type = 'essay' then 120 end
  from question_versions v where v.id > :vlo and v.id <= :vhi and v.number_label like 'PERF-%';
insert into question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms, marks, mode)
select p.question_version_id, p.id, c.pos, 2, '(' || c.lbl || ')', 'Bahagian ' || c.lbl || ' soalan berstruktur.', c.marks, c.mode
  from question_parts p join question_versions v on v.id = p.question_version_id and v.type = 'structured'
  cross join (values (1, 'i', 2, 'numeric'), (2, 'ii', 3, 'short_text')) c(pos, lbl, marks, mode)
 where p.question_version_id > :vlo and p.question_version_id <= :vhi and p.depth = 1;
insert into part_options (part_id, label, body_ms, position)
select p.id, chr(64 + l.pos), 'Pilihan ' || chr(64 + l.pos) || ' bagi bahagian ' || p.id, l.pos
  from question_parts p join generate_series(1, 5) l(pos) on l.pos <= case when p.id % 33 = 0 then 5 else 4 end
 where p.mode = 'mcq' and p.question_version_id > :vlo and p.question_version_id <= :vhi;
insert into answer_keys (part_id, kind, content)
select p.id,
       case p.mode when 'mcq' then 'option' when 'essay' then 'points' else 'accepted' end,
       case p.mode
         when 'mcq' then jsonb_build_object('kind', 'option', 'correct', chr(65 + (p.id % 4)::int))
         when 'essay' then jsonb_build_object('kind', 'points', 'marks', p.marks,
              'groups', jsonb_build_array(jsonb_build_object('id', 'g1', 'anyN', p.marks, 'pointIds', jsonb_build_array('p1','p2','p3','p4','p5'), 'eachMarks', 1)),
              'points', jsonb_build_array(jsonb_build_object('id','p1','code','P','label','Isi 1','marks',1), jsonb_build_object('id','p2','code','P','label','Isi 2','marks',1),
                                          jsonb_build_object('id','p3','code','P','label','Isi 3','marks',1), jsonb_build_object('id','p4','code','P','label','Isi 4','marks',1),
                                          jsonb_build_object('id','p5','code','P','label','Isi 5','marks',1)))
         when 'numeric' then jsonb_build_object('kind', 'accepted', 'values', jsonb_build_array(jsonb_build_object('v', (p.id % 97)::int)))
         else jsonb_build_object('kind', 'accepted', 'values', jsonb_build_array('jawapan ' || (p.id % 53)))
       end
  from question_parts p where p.mode is not null and p.question_version_id > :vlo and p.question_version_id <= :vhi;
commit;
