-- Hotel Unicornio v0.28 - módulos administrativos con aislamiento de datos sensibles.
-- Aplicar antes de desplegar admin.js. Ningún sueldo ni costo se guarda en hotel_cloud_state.
create table if not exists public.hotel_employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 3 and 150),
  job_title text not null check (length(btrim(job_title)) between 2 and 100),
  email text,
  phone text,
  document text,
  hire_date date,
  contract_type text not null default 'por_definir'
    check (contract_type in ('por_definir','indefinido','plazo_fijo','servicios','otro')),
  pay_day smallint not null default 5 check (pay_day between 1 and 28),
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary>=0),
  active boolean not null default true,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hotel_admin_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null default 'otros' check (category in
    ('compras','servicios','mantenimiento','limpieza','marketing','alquiler','otros')),
  description text not null check (length(btrim(description)) between 3 and 250),
  amount numeric(12,2) not null check (amount>0),
  status text not null default 'pendiente' check (status in ('pendiente','pagado')),
  payment_method text not null default 'sin_definir' check (payment_method in ('sin_definir','efectivo','transferencia','otro')),
  reference text,
  created_at timestamptz not null default now()
);
create table if not exists public.hotel_admin_product_costs (
  product_id text primary key,
  unit_cost numeric(12,4) not null check (unit_cost>=0),
  updated_at timestamptz not null default now()
);
create table if not exists public.hotel_admin_payroll (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hotel_employees(id),
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  base_amount numeric(12,2) not null check (base_amount>=0),
  additional_amount numeric(12,2) not null default 0 check (additional_amount>=0),
  deduction_amount numeric(12,2) not null default 0 check (deduction_amount>=0),
  employer_cost numeric(12,2) not null default 0 check (employer_cost>=0),
  net_amount numeric(12,2) generated always as (base_amount+additional_amount-deduction_amount) stored,
  status text not null default 'pendiente' check (status in ('pendiente','revisado','pagado')),
  paid_at timestamptz,
  payment_reference text,
  note text,
  created_at timestamptz not null default now(),
  unique(employee_id,period),
  constraint payroll_non_negative check (deduction_amount<=base_amount+additional_amount),
  constraint payroll_paid_reference check (status<>'pagado' or (paid_at is not null and length(btrim(coalesce(payment_reference,'')))>=3))
);
create table if not exists public.hotel_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  record_id text not null,
  operation text not null,
  happened_at timestamptz not null default now()
);
-- RLS y grants explícitos: usuario autenticado NO implica administración.
alter table public.hotel_employees enable row level security;
alter table public.hotel_admin_expenses enable row level security;
alter table public.hotel_admin_product_costs enable row level security;
alter table public.hotel_admin_payroll enable row level security;
alter table public.hotel_admin_audit enable row level security;
revoke all on public.hotel_employees, public.hotel_admin_expenses,
 public.hotel_admin_product_costs, public.hotel_admin_payroll, public.hotel_admin_audit from anon, authenticated;
grant select,insert,update on public.hotel_employees, public.hotel_admin_expenses,
 public.hotel_admin_product_costs, public.hotel_admin_payroll to authenticated;
grant select on public.hotel_admin_audit to authenticated;
-- La identidad administrativa procede de hotel_staff, no de metadata editables del usuario.
create policy "admin_employee_select" on public.hotel_employees for select to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_employee_insert" on public.hotel_employees for insert to authenticated
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_employee_update" on public.hotel_employees for update to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'))
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_expense_select" on public.hotel_admin_expenses for select to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_expense_insert" on public.hotel_admin_expenses for insert to authenticated
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_expense_update" on public.hotel_admin_expenses for update to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'))
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_cost_select" on public.hotel_admin_product_costs for select to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_cost_insert" on public.hotel_admin_product_costs for insert to authenticated
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_cost_update" on public.hotel_admin_product_costs for update to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'))
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_payroll_select" on public.hotel_admin_payroll for select to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_payroll_insert" on public.hotel_admin_payroll for insert to authenticated
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_payroll_update" on public.hotel_admin_payroll for update to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'))
 with check (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
create policy "admin_audit_select" on public.hotel_admin_audit for select to authenticated
 using (exists(select 1 from public.hotel_staff s where s.user_id=(select auth.uid()) and s.active and s.role='admin'));
-- Los movimientos son auditados en servidor, no a través de registros editables del navegador.
create schema if not exists private;
create or replace function private.hotel_admin_audit_write() returns trigger
 language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.hotel_admin_audit(actor_id,table_name,record_id,operation)
 values ((select auth.uid()),TG_TABLE_NAME,
   case when TG_OP='DELETE' then OLD.id::text else
     case when TG_TABLE_NAME='hotel_admin_product_costs' then NEW.product_id::text else NEW.id::text end
   end,TG_OP);
 return coalesce(NEW,OLD);
end $$;
revoke all on function private.hotel_admin_audit_write() from public, anon, authenticated;
create trigger hotel_employee_admin_audit after insert or update on public.hotel_employees
 for each row execute function private.hotel_admin_audit_write();
create trigger hotel_expense_admin_audit after insert or update on public.hotel_admin_expenses
 for each row execute function private.hotel_admin_audit_write();
create trigger hotel_cost_admin_audit after insert or update on public.hotel_admin_product_costs
 for each row execute function private.hotel_admin_audit_write();
create trigger hotel_payroll_admin_audit after insert or update on public.hotel_admin_payroll
 for each row execute function private.hotel_admin_audit_write();
-- Protege roles de pago: un comprobante marcado como pagado no se reescribe.
create or replace function private.hotel_paid_payroll_immutable() returns trigger
 language plpgsql set search_path = '' as $$
begin
 if OLD.status='pagado' then
   raise exception 'El rol de pago ya está pagado; registre un ajuste separado.';
 end if;
 return NEW;
end $$;
revoke all on function private.hotel_paid_payroll_immutable() from public, anon, authenticated;
create trigger hotel_paid_payroll_lock before update on public.hotel_admin_payroll
 for each row execute function private.hotel_paid_payroll_immutable();
