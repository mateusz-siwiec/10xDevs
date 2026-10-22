delete from exercise_secondary_muscle_groups
where muscle_group = 'BACK'
  and exercise_id = (select id from exercises where slug = 'hammer-curl');
