-- Hotel Unicornio v0.7: invariant de unicidad para estadías activas del estado compartido.
-- Un mismo huésped puede ocupar varias habitaciones distintas.
-- Una habitación no puede tener dos estadías activas, aunque ambas sean del mismo huésped.
-- Este trigger no abre permisos RLS ni modifica huéspedes históricos.
create or replace function hotel_internal.enforce_unique_active_room()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog,pg_temp
as $hotel$
begin
  if jsonb_typeof(coalesce(new.data->'stays','[]'::jsonb)) <> 'array' then
    raise exception 'El listado de estadías debe ser un arreglo JSON.'
      using errcode='23514';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(new.data->'stays','[]'::jsonb)) st
    where st->>'status'='activa'
      and (nullif(btrim(st->>'roomId'),'') is null or nullif(btrim(st->>'guestId'),'') is null)
  ) then
    raise exception 'Una estadía activa necesita un cliente y una habitación válidos.'
      using errcode='23514';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(new.data->'stays','[]'::jsonb)) st
    where st->>'status'='activa'
    group by st->>'roomId'
    having count(*) > 1
  ) then
    raise exception 'Una habitación solo puede pertenecer a una estadía activa. Hay una habitación duplicada.'
      using errcode='23514';
  end if;
  return new;
end;
$hotel$;
revoke all on function hotel_internal.enforce_unique_active_room() from public,anon,authenticated;
drop trigger if exists hotel_cloud_state_unique_active_room on public.hotel_cloud_state;
create trigger hotel_cloud_state_unique_active_room
before insert or update of data on public.hotel_cloud_state
for each row execute function hotel_internal.enforce_unique_active_room();
