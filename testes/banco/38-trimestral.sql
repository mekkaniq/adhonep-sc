-- v3.23 · relatório trimestral, lançamento e alerta de mandato
insert into public.ranking_settings (key, label, value, sort_order)
select k, k, 1, 0 from unnest(array['w_chapter_event','w_support_event','cap_events','w_chapter_meeting','w_support_meeting','cap_meetings','w_prison','w_ontime','w_member','w_missing','w_open','w_react','w_inact','w_inact_follow']) k
on conflict do nothing;
do $$
declare r jsonb; qfim date := (date_trunc('quarter', now()) - interval '1 month')::date; res text;
begin
  -- configurações
  perform teste.confere('config: lançamento em 01/01/2027 (até dez/2026 ninguém é cobrado)', (select value #>> '{}' = '2027-01-01' from public.adh_config where key = 'lancamento'));
  perform teste.confere('config: alerta de mandato padrão 60 e 30 dias', (select value = '[60,30]'::jsonb from public.adh_config where key = 'alerta_mandato_dias'));
  perform teste.confere('config: visitante não lê', teste.tenta(null, 'select 1 from public.adh_config') like 'erro:%');
  perform teste.confere('config: sócio lê', teste.linhas(teste.tenta(teste.uid('socio'), 'select 1 from public.adh_config')) >= 2);
  perform teste.confere('config: ninguém grava direto na tabela (nem o administrador)', teste.tenta(teste.uid('admin'), 'update public.adh_config set value = ''[1]'' where key = ''alerta_mandato_dias''') like 'erro:%');
  perform teste.confere('config: diretor estadual muda o alerta de mandato', teste.tenta(teste.uid('dir_estadual'), 'select public.adh_config_set(''alerta_mandato_dias'', ''[30,90]'')') like 'linhas:%');
  perform teste.confere('config: presidente não muda o alerta de mandato', teste.bloqueou(teste.tenta(teste.uid('presidente'), 'select public.adh_config_set(''alerta_mandato_dias'', ''[10]'')')));
  perform teste.confere('config: diretor regional não muda o alerta de mandato', teste.bloqueou(teste.tenta(teste.uid('dir_regional'), 'select public.adh_config_set(''alerta_mandato_dias'', ''[10]'')')));
  perform teste.confere('config: prazo absurdo é recusado', teste.tenta(teste.uid('admin'), 'select public.adh_config_set(''alerta_mandato_dias'', ''[0]'')') like 'erro:%');
  perform teste.confere('config: só o administrador define o lançamento', teste.bloqueou(teste.tenta(teste.uid('dir_estadual'), 'select public.adh_config_set(''lancamento'', ''"2026-01-01"'')')));
  perform teste.confere('config: administrador define o lançamento', teste.tenta(teste.uid('admin'), 'select public.adh_config_set(''lancamento'', ''"2026-01-01"'')') like 'linhas:%');

  -- relatório por trimestre
  perform teste.confere('trimestral: relatório de mês que não fecha trimestre é recusado',
    teste.tenta(teste.uid('admin'), format('insert into public.chapter_monthly_reports (chapter_id, ref_month, status) values (802, %L, ''Entregue'')', (qfim - interval '1 month')::date)) like 'erro:%');
  perform teste.confere('trimestral: presidente envia o do trimestre (mar/jun/set/dez)',
    teste.linhas(teste.tenta(teste.uid('presidente'), format('insert into public.chapter_monthly_reports (chapter_id, ref_month, chapter_meetings, status) values (801, %L, 12, ''Entregue'')', qfim))) = 1);
  perform teste.confere('trimestral: 3 meses de reuniões cabem (até 120)',
    teste.linhas(teste.tenta(teste.uid('presidente'), format('insert into public.chapter_monthly_reports (chapter_id, ref_month, chapter_meetings, status) values (801, %L, 100, ''Entregue'')', qfim))) = 1);
  perform teste.confere('trimestral: trimestre que ainda não chegou ao último mês é recusado',
    teste.tenta(teste.uid('admin'), format('insert into public.chapter_monthly_reports (chapter_id, ref_month, status) values (802, %L, ''Entregue'')', (date_trunc('quarter', now()) + interval '5 months')::date)) like 'erro:%');

  -- Saúde por trimestre
  perform set_config('request.jwt.claims', json_build_object('sub', teste.uid('admin'), 'role', 'authenticated')::text, true);
  r := public.adh_ranking((qfim - interval '1 month')::date);
  perform teste.confere('saúde trimestral: qualquer mês vira o trimestre (chave = último mês)', (r->>'month')::date = qfim and (r->>'quarter_start')::date = date_trunc('quarter', qfim)::date, r->>'month');
  perform teste.confere('saúde trimestral: prazo é dia 5 do mês seguinte', (r->>'deadline')::date = (qfim + interval '1 month')::date + 4, r->>'deadline');
  update public.adh_config set value = null where key = 'lancamento';
  r := public.adh_ranking(qfim);
  perform teste.confere('antes do lançamento: ninguém perde ponto por relatório', (r->>'due') = 'false' and not exists (select 1 from jsonb_array_elements(r->'chapters') x where (x->>'p_missing')::numeric <> 0));
  update public.adh_config set value = to_jsonb(date_trunc('quarter', qfim)::date::text) where key = 'lancamento';
  r := public.adh_ranking(qfim);
  perform teste.confere('depois do lançamento: capítulo sem relatório vencido perde ponto',
    (r->>'due') = 'true' and exists (select 1 from jsonb_array_elements(r->'chapters') x where (x->>'chapter_id')::bigint = 802 and (x->>'p_missing')::numeric < 0), r::text);
  update public.adh_config set value = to_jsonb((date_trunc('quarter', qfim) + interval '1 day')::date::text) where key = 'lancamento';
  r := public.adh_ranking(qfim);
  perform teste.confere('trimestre que começou antes do lançamento não é cobrado', (r->>'due') = 'false');
  update public.adh_config set value = null where key = 'lancamento';
  perform set_config('request.jwt.claims', '', true);
end $$;
