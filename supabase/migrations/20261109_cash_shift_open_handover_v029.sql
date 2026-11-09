-- Hotel Unicornio v0.29: apertura y cierre de caja por sesión, con fondo de cambio incluido.
-- Sólo administradores autorizados; la caja se gestiona con RPC atómicas y auditables.
create table if not exists public.hotel_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  cashbox text not null default 'recepcion' check (cashbox = 'recepcion'),
  shift_date date not null,
  shift text not null check (shift in ('dia','noche')),
  status text not null default 'abierta' check (status in ('abierta','cerrada')),
  opened_at timestamptz not null default now(),
  opened_by uuid not null references auth.users(id),
  opening_operator text not null check(length(btrim(opening_operator)) between 2 and 120),
  opening_float numeric(12,2) not null check(opening_float>=0),
  expected_from_previous numeric(12,2),
  opening_variance numeric(12,2) not null default 0,
  opening_note text not null default '',
  previous_session_id uuid references public.hotel_cash_sessions(id),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  closing_operator text,
  cash_in numeric(12,2),
  transfer_in numeric(12,2),
  change_given numeric(12,2),
  other_out numeric(12,2),
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  variance numeric(12,2),
  next_float numeric(12,2),
  withdrawn numeric(12,2),
  close_note text not null default '',
  state_revision bigint,
  unique(cashbox,shift_date,shift),
  constraint cash_session_consistent_closure check (
    (status='abierta' and closed_at is null and next_float is null) or
    (status='cerrada' and closed_at is not null and next_float is not null and withdrawn is not null)
  ),
  constraint cash_session_close_nonnegative check (
    (cash_in is null or cash_in>=0) and (transfer_in is null or transfer_in>=0) and
    (change_given is null or change_given>=0) and (other_out is null or other_out>=0) and
    (counted_cash is null or counted_cash>=0) and (next_float is null or next_float>=0) and
    (withdrawn is null or withdrawn>=0)
  )
);
create unique index if not exists hotel_one_open_cashbox on public.hotel_cash_sessions(cashbox) where status='abierta';
create index if not exists hotel_cash_sessions_recent on public.hotel_cash_sessions(opened_at desc);

alter table public.hotel_cash_sessions enable row level security;
revoke all on public.hotel_cash_sessions from anon,authenticated;
grant select on public.hotel_cash_sessions to authenticated;
create policy "hotel_cash_admin_read" on public.hotel_cash_sessions for select to authenticated
  using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.role='admin' and s.active=true));

-- La aplicación no tiene GRANT INSERT/UPDATE/DELETE: sólo estos RPC verifican rol, dinero y unicidad.
create or replace function public.hotel_cash_open(
  p_operator text, p_counted numeric, p_note text default ''
) returns public.hotel_cash_sessions
language plpgsql security definer set search_path='' as $$
declare
  v_prev public.hotel_cash_sessions;
  v_session public.hotel_cash_sessions;
  v_local timestamp;
  v_day date;
  v_shift text;
  v_due numeric(12,2);
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.hotel_staff s
    where s.user_id=(select auth.uid()) and s.active=true and s.role='admin'
  ) then
    raise exception 'Acceso no autorizado a caja.' using errcode='42501';
  end if;
  if p_operator is null or length(btrim(p_operator)) not between 2 and 120 or
     p_counted is null or p_counted<0 or p_counted>1000000 or p_counted<>round(p_counted,2) or
     length(coalesce(p_note,''))>500 then
    raise exception 'Revise el responsable, el fondo contado y las observaciones.' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(83591,1);
  if exists (select 1 from public.hotel_cash_sessions where cashbox='recepcion' and status='abierta') then
    raise exception 'Ya existe una caja abierta. Ciérrela antes de iniciar otro turno.';
  end if;
  v_local:=now() at time zone 'America/Guayaquil';
  v_shift:=case when v_local::time>=time '07:30' and v_local::time<time '19:30' then 'dia' else 'noche' end;
  v_day:=case when v_local::time<time '07:30' then v_local::date-1 else v_local::date end;
  if exists(select 1 from public.hotel_cash_sessions
    where cashbox='recepcion' and shift_date=v_day and shift=v_shift) then
    raise exception 'Este turno ya tiene apertura y cierre registrados. Solicite revisión administrativa.';
  end if;
  select * into v_prev from public.hotel_cash_sessions
    where cashbox='recepcion' and status='cerrada' order by closed_at desc limit 1;
  v_due:=case when v_prev.id is null then null else v_prev.next_float end;
  if v_due is not null and p_counted<>v_due and length(btrim(coalesce(p_note,'')))<5 then
    raise exception 'Hay diferencia respecto al fondo entregado: describa la novedad (mínimo 5 caracteres).';
  end if;
  insert into public.hotel_cash_sessions
    (shift_date,shift,opened_by,opening_operator,opening_float,expected_from_previous,opening_variance,opening_note,previous_session_id)
  values(v_day,v_shift,(select auth.uid()),btrim(p_operator),p_counted,v_due,
    case when v_due is null then 0 else p_counted-v_due end,coalesce(btrim(p_note),''),
    v_prev.id)
  returning * into v_session;
  return v_session;
end $$;
revoke all on function public.hotel_cash_open(text,numeric,text) from public,anon,authenticated;
grant execute on function public.hotel_cash_open(text,numeric,text) to authenticated;

create or replace function public.hotel_cash_close(
  p_session_id uuid, p_operator text, p_counted numeric, p_next_float numeric,
  p_cash_in numeric, p_transfer_in numeric, p_change_given numeric, p_other_out numeric,
  p_expected_revision bigint, p_note text default ''
) returns public.hotel_cash_sessions
language plpgsql security definer set search_path='' as $$
declare
  v_session public.hotel_cash_sessions;
  v_revision bigint;
  v_expected numeric(12,2);
  v_out numeric(12,2);
  v_closed public.hotel_cash_sessions;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.hotel_staff s
    where s.user_id=(select auth.uid()) and s.active=true and s.role='admin'
  ) then
    raise exception 'Acceso no autorizado a caja.' using errcode='42501';
  end if;
  if p_session_id is null or p_operator is null or length(btrim(p_operator)) not between 2 and 120 or
    p_expected_revision is null or
    p_counted is null or p_next_float is null or p_cash_in is null or p_transfer_in is null or
    p_change_given is null or p_other_out is null or
    p_counted<0 or p_next_float<0 or p_cash_in<0 or p_transfer_in<0 or
    p_change_given<0 or p_other_out<0 or p_next_float>p_counted or
    greatest(p_counted,p_next_float,p_cash_in,p_transfer_in,p_change_given,p_other_out)>1000000 or
    p_counted<>round(p_counted,2) or p_next_float<>round(p_next_float,2) or
    p_cash_in<>round(p_cash_in,2) or p_transfer_in<>round(p_transfer_in,2) or
    p_change_given<>round(p_change_given,2) or p_other_out<>round(p_other_out,2) or
    length(coalesce(p_note,''))>500 then
    raise exception 'Revise el arqueo, el dinero entregado y los importes del cierre.' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(83591,1);
  select * into v_session from public.hotel_cash_sessions where id=p_session_id for update;
  if v_session.id is null or v_session.status<>'abierta' then
    raise exception 'Esta caja ya está cerrada o no existe. Actualice el sistema.';
  end if;
  -- Un cierre no puede basarse en cobros desactualizados por otro dispositivo.
  select revision into v_revision from public.hotel_cloud_state where id='main' for update;
  if v_revision is distinct from p_expected_revision then
    raise exception 'CONFLICTO_VERSION: hay cobros nuevos en otro equipo. Actualice antes de cerrar.';
  end if;
  -- Importante: se suma TODO el fondo de cambio recibido al iniciar.
  v_out:=p_change_given+p_other_out;
  v_expected:=v_session.opening_float+p_cash_in-v_out;
  if v_expected<0 then
    raise exception 'La caja no puede tener efectivo esperado negativo. Revise sus movimientos.';
  end if;
  if p_counted<>v_expected and length(btrim(coalesce(p_note,'')))<5 then
    raise exception 'Hay una diferencia de arqueo: escriba el motivo de la diferencia.';
  end if;
  update public.hotel_cash_sessions set
    status='cerrada',closed_at=now(),closed_by=(select auth.uid()),
    closing_operator=btrim(p_operator),cash_in=p_cash_in,transfer_in=p_transfer_in,
    change_given=p_change_given,other_out=p_other_out,expected_cash=v_expected,
    counted_cash=p_counted,variance=p_counted-v_expected,next_float=p_next_float,
    withdrawn=p_counted-p_next_float,close_note=coalesce(btrim(p_note),''),
    state_revision=p_expected_revision
  where id=v_session.id
  returning * into v_closed;
  return v_closed;
end $$;
revoke all on function public.hotel_cash_close(uuid,text,numeric,numeric,numeric,numeric,numeric,numeric,bigint,text) from public,anon,authenticated;
grant execute on function public.hotel_cash_close(uuid,text,numeric,numeric,numeric,numeric,numeric,numeric,bigint,text) to authenticated;
