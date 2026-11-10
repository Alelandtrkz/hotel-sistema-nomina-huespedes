-- v0.30: hora local de El Coca: Dia 08:00-20:00; Noche 20:00-08:00.
-- Las sesiones existentes y cerradas no se modifican.
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
  v_revision bigint;
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
  v_shift:=case when v_local::time>=time '08:00' and v_local::time<time '20:00' then 'dia' else 'noche' end;
  v_day:=case when v_local::time<time '08:00' then v_local::date-1 else v_local::date end;
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
  -- Invalida las revisiones de otros navegadores para forzar recarga antes de más cobros.
  update public.hotel_cloud_state set revision=revision+1,updated_at=now(),updated_by=(select auth.uid())
    where id='main' returning revision into v_revision;
  update public.hotel_cash_sessions set state_revision=v_revision where id=v_session.id returning * into v_session;
  return v_session;
end $$;
revoke all on function public.hotel_cash_open(text,numeric,text) from public,anon,authenticated;
grant execute on function public.hotel_cash_open(text,numeric,text) to authenticated;
