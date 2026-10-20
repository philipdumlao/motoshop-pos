-- Run this in Supabase: SQL Editor > New query > Run
create table if not exists items (
  id text primary key,
  code text unique not null,
  name text not null,
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  stock integer not null default 0,
  low integer not null default 3
);
create table if not exists sales (
  id bigint primary key,
  ts bigint not null,
  parts jsonb not null default '[]',
  labor jsonb not null default '[]',
  rev numeric(12,2), cost numeric(12,2), lab numeric(12,2),
  cut numeric(12,2), mech numeric(12,2), total numeric(12,2),
  pp numeric(12,2), profit numeric(12,2), cash numeric(12,2)
);
create table if not exists settings (
  id integer primary key,
  cut numeric not null default 20,
  seq integer not null default 0
);
insert into settings (id) values (1) on conflict do nothing;

-- Only signed-in shop staff can read or write
alter table items enable row level security;
alter table sales enable row level security;
alter table settings enable row level security;
create policy "staff all" on items for all to authenticated using (true) with check (true);
create policy "staff all" on sales for all to authenticated using (true) with check (true);
create policy "staff all" on settings for all to authenticated using (true) with check (true);
