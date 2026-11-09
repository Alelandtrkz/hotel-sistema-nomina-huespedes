-- Ajuste del trigger para tablas con PK uuid o texto, sin referencias a campos inexistentes.
create or replace function private.hotel_admin_audit_write() returns trigger
 language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.hotel_admin_audit(actor_id,table_name,record_id,operation)
 values ((select auth.uid()),TG_TABLE_NAME,
   coalesce(to_jsonb(NEW)->>'id',to_jsonb(NEW)->>'product_id'),
   TG_OP);
 return NEW;
end $$;
revoke all on function private.hotel_admin_audit_write() from public, anon, authenticated;
