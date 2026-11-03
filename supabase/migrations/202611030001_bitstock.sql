-- Uma loja por projeto. A chave secreta fica apenas na API Next.js.
begin;
create table public.staff (
  id uuid primary key references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  authorized boolean not null default false
);
create table public.products (
  id uuid primary key,
  name text not null check (length(btrim(name)) between 1 and 120),
  code text not null check (length(btrim(code)) between 1 and 40),
  category text not null check (category in ('Computadores','Notebooks','Componentes','Periféricos','Armazenamento','Redes','Cabos e acessórios')),
  brand text not null default '', description text not null default '',
  quantity bigint not null check (quantity between 0 and 9007199254740991),
  minimum bigint not null check (minimum between 0 and 9007199254740991),
  cost bigint check (cost between 0 and 9007199254740991),
  price bigint check (price between 0 and 9007199254740991),
  expiry text not null default '', active boolean not null default true,
  "createdAt" timestamptz not null, "updatedAt" timestamptz not null
);
create unique index products_code_unique on public.products (lower(btrim(code)));
create table public.stock_movements (
  id uuid primary key, "productId" uuid not null references public.products(id),
  "productName" text not null, "productCode" text not null,
  type text not null check (type in ('entrada','saida')),
  quantity bigint not null check (quantity between 1 and 9007199254740991),
  before bigint not null check (before between 0 and 9007199254740991),
  after bigint not null check (after between 0 and 9007199254740991),
  reason text not null, note text not null default '', "user" text not null, date timestamptz not null,
  check (after = before + case when type = 'entrada' then quantity else -quantity end)
);
create index stock_movements_product on public.stock_movements ("productId", date desc);
create table public.service_orders (
  id uuid primary key, number text not null unique, equipment text not null, issue text not null,
  status text not null check (status in ('Recebido','Em manutenção','Aguardando devolução','Entregue')),
  "receivedAt" timestamptz not null, "deliveredAt" timestamptz, "user" text not null,
  check ((status = 'Entregue') = ("deliveredAt" is not null))
);
create table public.service_order_events (
  "orderId" uuid not null references public.service_orders(id), sequence integer not null,
  status text not null check (status in ('Recebido','Em manutenção','Aguardando devolução','Entregue')),
  date timestamptz not null, "user" text not null,
  primary key ("orderId", sequence)
);
create table public.app_state (id integer primary key check (id=1), revision bigint not null default 0);
insert into public.app_state(id) values (1);
create table public.operation_receipts (
  id uuid primary key, "userId" uuid not null references public.staff(id),
  fingerprint text not null, "createdAt" timestamptz not null default now()
);
-- Nenhuma tabela é acessível diretamente por anon/authenticated, mesmo com cadastro público.
alter table public.staff enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.service_orders enable row level security;
alter table public.service_order_events enable row level security;
alter table public.app_state enable row level security;
alter table public.operation_receipts enable row level security;
revoke all on public.staff, public.products, public.stock_movements, public.service_orders, public.service_order_events, public.app_state, public.operation_receipts from public, anon, authenticated;
grant select, insert, update on public.staff, public.products, public.stock_movements, public.service_orders, public.service_order_events, public.app_state, public.operation_receipts to service_role;

create function public.bitstock_snapshot(p_uid uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_name text; v_result jsonb;
begin
  select name into v_name from public.staff where id=p_uid and authorized for share;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  -- Uma única consulta mantém estado e revisão no mesmo snapshot do PostgreSQL.
  select jsonb_build_object('revision', a.revision, 'name', v_name, 'store', jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p."createdAt",p.id) from public.products p),'[]'::jsonb),
    'movements', coalesce((select jsonb_agg(to_jsonb(m) order by m.date,m.id) from public.stock_movements m),'[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) || jsonb_build_object('events', coalesce((
      select jsonb_agg(jsonb_build_object('status',e.status,'date',e.date,'user',e."user") order by e.sequence)
      from public.service_order_events e where e."orderId"=o.id),'[]'::jsonb)) order by o."receivedAt",o.id)
      from public.service_orders o),'[]'::jsonb)
  )) into v_result from public.app_state a where a.id=1;
  return v_result;
end; $$;

create function public.bitstock_commit(p_uid uuid,p_operation uuid,p_fingerprint text,p_revision bigint,p_store jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint; v_receipt public.operation_receipts;
begin
  -- O bloqueio da revisão serializa concorrência e protege o conjunto saldo/histórico.
  select revision into v_revision from public.app_state where id=1 for update;
  perform 1 from public.staff where id=p_uid and authorized for share;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_receipt from public.operation_receipts where id=p_operation;
  if found then
    if v_receipt."userId"<>p_uid or v_receipt.fingerprint<>p_fingerprint then raise exception 'OPERATION_CONFLICT'; end if;
    return 'duplicate';
  end if;
  if v_revision<>p_revision then return 'retry'; end if;
  if jsonb_typeof(p_store->'products')<>'array' or jsonb_typeof(p_store->'movements')<>'array' or jsonb_typeof(p_store->'orders')<>'array' then raise exception 'INVALID_STORE'; end if;
  insert into public.products select * from jsonb_populate_recordset(null::public.products,p_store->'products')
  on conflict(id) do update set name=excluded.name,code=excluded.code,category=excluded.category,brand=excluded.brand,description=excluded.description,
    quantity=excluded.quantity,minimum=excluded.minimum,cost=excluded.cost,price=excluded.price,expiry=excluded.expiry,active=excluded.active,"updatedAt"=excluded."updatedAt";
  insert into public.stock_movements select * from jsonb_populate_recordset(null::public.stock_movements,p_store->'movements') on conflict(id) do nothing;
  insert into public.service_orders select * from jsonb_populate_recordset(null::public.service_orders,p_store->'orders')
  on conflict(id) do update set status=excluded.status,"deliveredAt"=excluded."deliveredAt";
  insert into public.service_order_events ("orderId",sequence,status,date,"user")
    select (o->>'id')::uuid,e.ordinality::integer,e.value->>'status',(e.value->>'date')::timestamptz,e.value->>'user'
    from jsonb_array_elements(p_store->'orders') o cross join lateral jsonb_array_elements(o->'events') with ordinality e(value,ordinality)
    on conflict ("orderId",sequence) do nothing;
  insert into public.operation_receipts(id,"userId",fingerprint) values (p_operation,p_uid,p_fingerprint);
  update public.app_state set revision=revision+1 where id=1;
  return 'committed';
end; $$;
revoke execute on function public.bitstock_snapshot(uuid) from public,anon,authenticated;
revoke execute on function public.bitstock_commit(uuid,uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.bitstock_snapshot(uuid) to service_role;
grant execute on function public.bitstock_commit(uuid,uuid,text,bigint,jsonb) to service_role;
commit;
