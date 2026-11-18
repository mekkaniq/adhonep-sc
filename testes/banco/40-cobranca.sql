-- v3.25 · só é cobrado o capítulo que tem presidente com login; lançamento em 01/01/2027
do $$
declare r jsonb; qfim date := (date_trunc('quarter', now()) - interval '1 month')::date;
begin
  perform teste.confere('cobrança: visitante não vê a lista de capítulos com presidente', teste.tenta(null, 'select * from public.adh_capitulos_com_presidente()') like 'erro:%');
  perform teste.confere('cobrança: lista traz os capítulos com presidente (801 e 802)', teste.linhas(teste.tenta(teste.uid('dir_estadual'), 'select * from public.adh_capitulos_com_presidente()')) = 2);
  -- capítulo 802 sem presidente com login: não perde ponto mesmo depois do lançamento
  update public.adh_config set value = to_jsonb(date_trunc('quarter', qfim)::date::text) where key = 'lancamento';
  update public.user_roles set is_active = false where user_id = teste.uid('presidente2');
  delete from public.chapter_monthly_reports where ref_month = qfim;
  perform set_config('request.jwt.claims', json_build_object('sub', teste.uid('admin'), 'role', 'authenticated')::text, true);
  r := public.adh_ranking(qfim);
  perform teste.confere('cobrança: capítulo com presidente e sem relatório perde ponto',
    exists (select 1 from jsonb_array_elements(r->'chapters') x where (x->>'chapter_id')::int = 801 and (x->>'p_missing')::numeric < 0 and (x->>'report_due')::boolean));
  perform teste.confere('cobrança: capítulo SEM presidente com login não é cobrado',
    exists (select 1 from jsonb_array_elements(r->'chapters') x where (x->>'chapter_id')::int = 802 and (x->>'p_missing')::numeric = 0 and not (x->>'report_due')::boolean and not (x->>'has_president')::boolean));
  perform teste.confere('cobrança: lista passa a ter só o 801', teste.linhas(teste.tenta(teste.uid('dir_estadual'), 'select * from public.adh_capitulos_com_presidente()')) = 1);
  perform set_config('request.jwt.claims', '', true);
  update public.user_roles set is_active = true where user_id = teste.uid('presidente2');
  update public.adh_config set value = '"2027-01-01"' where key = 'lancamento';
end $$;
