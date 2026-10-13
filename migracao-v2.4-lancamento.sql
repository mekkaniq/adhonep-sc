-- ADHONEP-SC claude v3.2 — proteção do formulário de cadastro para o LANÇAMENTO
-- Substitui a trava da v1.3 (que limitava a 40 pedidos/hora no site inteiro e bloquearia gente real num lançamento).
-- Idempotente. Rode uma vez no SQL Editor.
begin;

create or replace function public.adh_guard_access_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(new.email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Informe um e-mail válido.';
  end if;
  if length(trim(coalesce(new.full_name, ''))) < 3 or length(new.full_name) > 160 then
    raise exception 'Informe o nome completo.';
  end if;
  if length(trim(coalesce(new.justification, ''))) < 10 or length(new.justification) > 2000 then
    raise exception 'Descreva a justificativa (mínimo de 10 caracteres).';
  end if;
  if length(coalesce(new.city, '')) > 120 or length(coalesce(new.phone, '')) > 40 then
    raise exception 'Dados muito longos.';
  end if;
  new.email := v_email;
  new.status := 'pending';

  -- 1) E-mail repetido: bloqueia se já há pedido PENDENTE (qualquer data) ou APROVADO
  if exists (select 1 from public.access_requests r
             where lower(r.email) = v_email and r.status in ('pending','approved')) then
    raise exception 'Já existe uma solicitação para este e-mail. Aguarde o contato da diretoria.';
  end if;
  -- 2) Pedido rejeitado: só aceita outro depois de 7 dias
  if exists (select 1 from public.access_requests r
             where lower(r.email) = v_email and r.status = 'rejected' and r.created_at > now() - interval '7 days') then
    raise exception 'Seu pedido anterior foi analisado recentemente. Fale com a diretoria antes de enviar outro.';
  end if;
  -- 3) Limite por MINUTO e por HORA no site inteiro (só contra inundação/robôs; folgado para um lançamento)
  if (select count(*) from public.access_requests r where r.created_at > now() - interval '1 minute') >= 300 then
    raise exception 'Muitos pedidos neste momento. Aguarde 1 minuto e tente novamente.';
  end if;
  if (select count(*) from public.access_requests r where r.created_at > now() - interval '1 hour') >= 3000 then
    raise exception 'Muitos pedidos neste momento. Tente novamente mais tarde.';
  end if;
  return new;
end; $$;
revoke all on function public.adh_guard_access_request() from public, anon, authenticated;

-- índice para as consultas da trava ficarem rápidas sob carga
create index if not exists access_requests_email_status_idx on public.access_requests (lower(email), status);
create index if not exists access_requests_created_idx on public.access_requests (created_at);

drop trigger if exists access_requests_guard on public.access_requests;
create trigger access_requests_guard before insert on public.access_requests
  for each row execute function public.adh_guard_access_request();
commit;

select tgname from pg_trigger where tgname = 'access_requests_guard' and not tgisinternal;
