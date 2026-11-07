-- Hotel Unicornio · esquema propuesto, NO APLICADO a Supabase todavía
-- Fuente: prototipo v0.2 y fotografías de recepción proporcionadas por el hotel.
-- Política: SIN acceso público a datos; trabajadores autorizados únicamente.
-- Antes de producción: revisar política de tratamiento y retención de PII, backups, capacitación.
-- Pasos pendientes: crear proyecto, aplicar esta migración, alta de primer administrador, conectar app.

create table if not exists public.hotel_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'recepcion' check (role in ('admin','recepcion','supervisor')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.hotel_staff enable row level security;
revoke all on public.hotel_staff from anon;
grant select on public.hotel_staff to authenticated;
create policy staff_can_read_self on public.hotel_staff
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_hotel_staff() returns boolean
language sql stable security invoker set search_path = public, pg_temp
as $$ select exists(select 1 from public.hotel_staff s
  where s.user_id = (select auth.uid()) and s.active = true) $$;
revoke execute on function public.is_hotel_staff() from public, anon;
grant execute on function public.is_hotel_staff() to authenticated;

create table if not exists public.hotel_rooms (
  id text primary key,
  number text not null unique,
  type text not null check (type in ('flex_aire','flex_ventilador','doble','triple','arrendada')),
  status text not null default 'disponible'
    check (status in ('disponible','ocupada','limpieza','arrendada')),
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_rates (
  type text primary key check (type in ('individual','matrimonial','individual_ventilador','matrimonial_ventilador','doble','triple')),
  price_without_breakfast numeric(10,2) not null check (price_without_breakfast >= 0),
  price_with_breakfast numeric(10,2) check (price_with_breakfast is null or price_with_breakfast >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_guests (
  id text primary key default gen_random_uuid()::text,
  document_type text not null default 'cedula' check (document_type in ('cedula','ruc','pasaporte','otro')),
  document text not null,
  first_name text not null,
  second_name text not null default '',
  last_name text not null,
  second_last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  provenance text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_guest_doc_unique unique(document_type,document),
  constraint hotel_guest_document_not_blank check (length(trim(document)) >= 3)
);

create table if not exists public.hotel_reservations (
  id text primary key default gen_random_uuid()::text,
  guest_id text references public.hotel_guests(id),
  contact_name text not null,
  contact_phone text not null default '',
  room_id text references public.hotel_rooms(id),
  room_type text not null,
  arrival_date date not null,
  departure_date date not null,
  pax integer not null default 1 check (pax > 0),
  breakfast boolean not null default false,
  nightly_price numeric(10,2) check (nightly_price is null or nightly_price >= 0),
  status text not null default 'pendiente'
    check (status in ('pendiente','confirmada','cancelada','ingresada','no_show')),
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_reservation_dates check (departure_date > arrival_date)
);

create table if not exists public.hotel_stays (
  id text primary key default gen_random_uuid()::text,
  guest_id text not null references public.hotel_guests(id),
  reservation_id text references public.hotel_reservations(id),
  room_id text not null references public.hotel_rooms(id),
  room_type text not null,
  arrival_date date not null,
  departure_date date not null,
  pax integer not null default 1 check (pax > 0),
  breakfast boolean not null default false,
  nightly_price numeric(10,2) not null default 0 check(nightly_price >= 0),
  room_total numeric(10,2) not null default 0 check(room_total >= 0),
  status text not null default 'activa' check (status in ('activa','finalizada','cancelada')),
  invoice_requested boolean not null default false,
  invoice_name text not null default '',
  invoice_document text not null default '',
  invoice_address text not null default '',
  invoice_email text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint hotel_stay_dates check (departure_date > arrival_date)
);

create table if not exists public.hotel_payments (
  id text primary key default gen_random_uuid()::text,
  stay_id text references public.hotel_stays(id),
  reservation_id text references public.hotel_reservations(id),
  amount numeric(10,2) not null check(amount > 0),
  method text not null check (method in ('efectivo','transferencia')),
  transfer_reference text,
  shift text not null default 'dia' check(shift in ('dia','noche')),
  paid_at timestamptz not null default now(),
  received_by uuid references auth.users(id),
  notes text not null default '',
  constraint hotel_payment_target check ((stay_id is not null) or (reservation_id is not null)),
  constraint hotel_payment_transfer check (method <> 'transferencia' or nullif(trim(transfer_reference),'') is not null)
);

create table if not exists public.hotel_products (
  id text primary key,
  category text not null check (category in ('bebidas','confiteria','aseo','helados','otros')),
  name text not null,
  unit_price numeric(10,2) check(unit_price is null or unit_price >= 0),
  stock integer check (stock is null or stock >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_sales (
  id text primary key default gen_random_uuid()::text,
  product_id text references public.hotel_products(id),
  stay_id text references public.hotel_stays(id),
  description text not null default '',
  quantity integer not null check(quantity > 0),
  unit_price numeric(10,2) not null check(unit_price >= 0),
  mode text not null check(mode in ('directa','habitacion')),
  method text check(method in ('efectivo','transferencia')),
  transfer_reference text,
  shift text not null default 'dia' check(shift in ('dia','noche')),
  sold_at timestamptz not null default now(),
  received_by uuid references auth.users(id),
  notes text not null default '',
  constraint hotel_sale_room check(mode <> 'habitacion' or stay_id is not null),
  constraint hotel_sale_direct_method check(mode <> 'directa' or method is not null)
);

create table if not exists public.hotel_stock_movements (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.hotel_products(id),
  kind text not null check(kind in ('conteo','reposicion','venta','merma','ajuste')),
  quantity integer not null,
  resulting_stock integer check(resulting_stock is null or resulting_stock >= 0),
  shift text not null default 'dia' check(shift in ('dia','noche')),
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.hotel_cash_movements (
  id text primary key default gen_random_uuid()::text,
  kind text not null check(kind in ('ingreso','gasto','retiro','fondo')),
  description text not null default '',
  amount numeric(10,2) not null check(amount > 0),
  method text not null default 'efectivo' check(method in ('efectivo','transferencia')),
  shift text not null default 'dia' check(shift in ('dia','noche')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.hotel_cash_closures (
  id text primary key default gen_random_uuid()::text,
  work_date date not null,
  shift text not null check(shift in ('dia','noche')),
  opening_cash numeric(10,2) not null default 0,
  expected_cash numeric(10,2) not null default 0,
  counted_cash numeric(10,2) not null default 0,
  transfer_total numeric(10,2) not null default 0,
  difference numeric(10,2) not null default 0,
  notes text not null default '',
  closed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint hotel_unique_closure unique(work_date, shift)
);

create table if not exists public.hotel_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Datos de referencia basados en el inventario físico. No se copian huéspedes ni transacciones.
insert into public.hotel_rooms(id,number,type,status) values
  ('room-01','01','flex_aire','disponible'),
  ('room-02','02','flex_aire','disponible'),
  ('room-10','10','flex_aire','disponible'),
  ('room-11','11','flex_aire','disponible'),
  ('room-14','14','flex_aire','disponible'),
  ('room-15','15','flex_aire','disponible'),
  ('room-16','16','flex_aire','disponible'),
  ('room-17','17','flex_aire','disponible'),
  ('room-18','18','flex_aire','disponible'),
  ('room-19','19','flex_aire','disponible'),
  ('room-20','20','flex_aire','disponible'),
  ('room-21','21','flex_aire','disponible'),
  ('room-22','22','flex_aire','disponible'),
  ('room-24','24','flex_aire','disponible'),
  ('room-25','25','flex_aire','disponible'),
  ('room-26','26','flex_aire','disponible'),
  ('room-27','27','flex_aire','disponible'),
  ('room-28','28','flex_aire','disponible'),
  ('room-29','29','flex_aire','disponible'),
  ('room-07','07','flex_ventilador','disponible'),
  ('room-08','08','flex_ventilador','disponible'),
  ('room-03','03','doble','disponible'),
  ('room-12','12','doble','disponible'),
  ('room-04','04','triple','disponible'),
  ('room-38','38','triple','disponible'),
  ('room-05','05','arrendada','arrendada'),
  ('room-06','06','arrendada','arrendada'),
  ('room-09','09','arrendada','arrendada'),
  ('room-13','13','arrendada','arrendada'),
  ('room-23','23','arrendada','arrendada'),
  ('room-30','30','arrendada','arrendada'),
  ('room-101','101','arrendada','arrendada'),
  ('room-102','102','arrendada','arrendada')
on conflict(id) do nothing;

insert into public.hotel_rates(type,price_without_breakfast,price_with_breakfast) values
  ('individual',20,25),
  ('matrimonial',29,39),
  ('individual_ventilador',17,null),
  ('matrimonial_ventilador',23,null),
  ('doble',30,45),
  ('triple',40,55)
on conflict(type) do nothing;

insert into public.hotel_settings(key,value) values
  ('child_rate','5'::jsonb),('extra_person_rate','10'::jsonb),('early_arrival_fee','10'::jsonb)
on conflict(key) do nothing;

insert into public.hotel_products(id,category,name,unit_price,stock) values
  ('producto-001','bebidas','Fuezte (nombre por confirmar)',0.60,NULL),
  ('producto-002','bebidas','Agua ½ litro',0.50,NULL),
  ('producto-003','bebidas','Agua 1 litro',1.00,NULL),
  ('producto-004','bebidas','Chupetes',0.25,NULL),
  ('producto-005','bebidas','Cola pequeña',0.50,NULL),
  ('producto-006','bebidas','Cola ½ litro',0.80,NULL),
  ('producto-007','bebidas','Cola 1 litro',1.75,NULL),
  ('producto-008','bebidas','Cola 3 litros',3.00,NULL),
  ('producto-009','bebidas','Güitig pequeña',0.50,NULL),
  ('producto-010','bebidas','Güitig ½ litro',0.75,NULL),
  ('producto-011','bebidas','Güitig 1 litro',1.50,NULL),
  ('producto-012','bebidas','Güitig 3 litros',3.00,NULL),
  ('producto-013','bebidas','Imperial',1.00,NULL),
  ('producto-014','bebidas','Monster',3.00,NULL),
  ('producto-015','bebidas','Sunny',0.60,NULL),
  ('producto-016','bebidas','Pony Malta pequeña',0.60,NULL),
  ('producto-017','bebidas','Pony Malta en lata',1.00,NULL),
  ('producto-018','bebidas','Sporade ½ litro',1.00,NULL),
  ('producto-019','bebidas','Sporade 1 litro',1.50,NULL),
  ('producto-020','bebidas','Power ½ litro',1.00,NULL),
  ('producto-021','bebidas','Power 1 litro',1.50,NULL),
  ('producto-022','bebidas','Mini Power',0.50,NULL),
  ('producto-023','bebidas','Saviloé',1.00,NULL),
  ('producto-024','bebidas','Vive 100',1.25,NULL),
  ('producto-025','bebidas','220V pequeño',0.75,NULL),
  ('producto-026','bebidas','220V',1.25,NULL),
  ('producto-027','bebidas','Gatorade',1.25,NULL),
  ('producto-028','bebidas','Horchata',0.60,NULL),
  ('producto-029','confiteria','Galleta Oreo grande',1.00,NULL),
  ('producto-030','confiteria','Jumbo maní mini',0.50,NULL),
  ('producto-031','confiteria','Galleta Marilín',1.00,NULL),
  ('producto-032','confiteria','Galleta Oreo pequeña',0.50,NULL),
  ('producto-033','confiteria','Galleta Ritz / Ricas',0.50,NULL),
  ('producto-034','confiteria','Chicles Agogo',0.25,NULL),
  ('producto-035','confiteria','Chicles Tumix',0.50,NULL),
  ('producto-036','confiteria','Chicles Kataboom',0.10,NULL),
  ('producto-037','confiteria','Galleta Festival',0.25,NULL),
  ('producto-038','confiteria','Chocolate Jet',0.75,NULL),
  ('producto-039','confiteria','Ducales',0.50,NULL),
  ('producto-040','confiteria','Grant Nuts',0.50,NULL),
  ('producto-041','confiteria','Tumix',0.50,NULL),
  ('producto-042','confiteria','Agogo',0.25,NULL),
  ('producto-043','confiteria','Katabook',0.10,NULL),
  ('producto-044','confiteria','Tosti Queso',0.30,NULL),
  ('producto-045','confiteria','Jumbo Mega',1.00,NULL),
  ('producto-046','confiteria','Chicles Next',0.30,NULL),
  ('producto-047','confiteria','Moto Moto',0.50,NULL),
  ('producto-048','confiteria','Tik Tak',1.00,NULL),
  ('producto-049','aseo','Pasta grande',1.50,NULL),
  ('producto-050','aseo','Pasta pequeña',1.25,NULL),
  ('producto-051','aseo','Cepillos',1.50,NULL),
  ('producto-052','aseo','Toallas íntimas',1.50,NULL),
  ('producto-053','aseo','Fosforera',0.50,NULL),
  ('producto-054','aseo','Shampú',0.50,NULL),
  ('producto-055','aseo','Prestobarba',0.50,NULL),
  ('producto-056','aseo','Gel',1.00,NULL),
  ('producto-057','aseo','Jabón',1.25,NULL),
  ('producto-058','helados','Helado de Coco',NULL,NULL),
  ('producto-059','helados','Helado de Mora',NULL,NULL),
  ('producto-060','helados','Helado de Taxo',NULL,NULL),
  ('producto-061','helados','Helado de Come bebé',NULL,NULL),
  ('producto-062','helados','Helado de Chocolate',NULL,NULL),
  ('producto-063','helados','Helado de Frutas',NULL,NULL),
  ('producto-064','helados','Helado de Chocobanana',NULL,NULL),
  ('producto-065','helados','Helado de Naranjilla',NULL,NULL),
  ('producto-066','helados','Helado de Piña',NULL,NULL),
  ('producto-067','helados','Helado de Guayul (revisar nombre)',NULL,NULL),
  ('producto-068','helados','Helado de Arazá',NULL,NULL),
  ('producto-069','helados','Helado de Mandarina',NULL,NULL),
  ('producto-070','helados','Helado de Fresa',NULL,NULL),
  ('producto-071','otros','Lavandería',NULL,NULL)
on conflict(id) do nothing;

-- RLS: cualquier trabajador con membresía activa puede consultar y operar.
-- No se permiten modificaciones de membresías vía API cliente ni acceso como anon.
do $policies$
declare t text;
begin
  foreach t in array array[
    'hotel_rooms','hotel_rates','hotel_guests','hotel_reservations',
    'hotel_stays','hotel_payments','hotel_products','hotel_sales',
    'hotel_stock_movements','hotel_cash_movements','hotel_cash_closures','hotel_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select, insert, update on public.%I to authenticated',t);
    execute format('create policy staff_read on public.%I for select to authenticated using ((select public.is_hotel_staff()))',t);
    execute format('create policy staff_insert on public.%I for insert to authenticated with check ((select public.is_hotel_staff()))',t);
    execute format('create policy staff_update on public.%I for update to authenticated using ((select public.is_hotel_staff())) with check ((select public.is_hotel_staff()))',t);
  end loop;
end $policies$;

-- Los movimientos de dinero e inventario son apend-only; correcciones como contramovimientos.
revoke update on public.hotel_payments, public.hotel_sales, public.hotel_stock_movements,
  public.hotel_cash_movements from authenticated;

-- Pendiente: operaciones atómicas (RPC/Edge Functions) para vender con stock, reservar
-- sin solapamientos entre reservas/estancias y cerrar turnos sin duplicaciones.
-- La interfaz pública actual no consulta estas tablas. Antes de producción integrar
-- login y permisos y probar RLS anon/auth con dos trabajadores diferentes.
