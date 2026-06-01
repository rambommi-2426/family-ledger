-- ============================================================
--  FAMILY LEDGER — wallet model
--  Run in Supabase > SQL Editor (safe to re-run; idempotent)
-- ============================================================

create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  display_name text not null,
  role         text not null check (role in ('provider','guardian','kid')),
  color        text default '#caff4d',
  upi_id       text,
  created_at   timestamptz default now()
);

create table if not exists transactions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  member_id      uuid not null references profiles(id) on delete cascade,
  from_member_id uuid references profiles(id) on delete set null,
  type           text not null check (type in ('income','expense')),
  amount         numeric not null check (amount > 0),
  category       text,
  note           text,
  method         text check (method in ('cash','bank','upi')),
  status         text default 'recorded',
  created_at     timestamptz default now()
);

create table if not exists schedules (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  to_member_id uuid not null references profiles(id) on delete cascade,
  amount       numeric not null check (amount > 0),
  cadence      text not null check (cadence in ('weekly','monthly')),
  anchor       int not null,
  next_due     date not null,
  active       boolean default true,
  created_at   timestamptz default now()
);

alter table transactions add column if not exists from_member_id uuid references profiles(id) on delete set null;
alter table transactions add column if not exists method text;

create index if not exists idx_txn_household on transactions(household_id);
create index if not exists idx_txn_member    on transactions(member_id);

create or replace function auth_household_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select household_id from profiles where id = auth.uid(); $$;
create or replace function auth_role() returns text
  language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid(); $$;

alter table households   enable row level security;
alter table profiles     enable row level security;
alter table transactions enable row level security;
alter table schedules    enable row level security;

drop policy if exists hh_select on households;
create policy hh_select on households for select using (id = auth_household_id());

drop policy if exists pr_select on profiles;
create policy pr_select on profiles for select using (id = auth.uid() or household_id = auth_household_id());
drop policy if exists pr_update on profiles;
create policy pr_update on profiles for update using (id = auth.uid());

drop policy if exists tx_select on transactions;
create policy tx_select on transactions for select using (
  household_id = auth_household_id()
  and ( auth_role() in ('provider','guardian') or member_id = auth.uid() )
);
drop policy if exists tx_insert on transactions;
create policy tx_insert on transactions for insert with check (
  household_id = auth_household_id() and (
    (type = 'expense' and member_id = auth.uid()) or
    (type = 'income'  and from_member_id = auth.uid() and auth_role() in ('provider','guardian')
       and member_id in (select id from profiles where household_id = auth_household_id()))
  )
);
drop policy if exists tx_modify on transactions;
create policy tx_modify on transactions for update using (member_id = auth.uid() or auth_role() in ('provider','guardian'));
drop policy if exists tx_delete on transactions;
create policy tx_delete on transactions for delete using (member_id = auth.uid() or auth_role() in ('provider','guardian'));

drop policy if exists sc_select on schedules;
create policy sc_select on schedules for select using (
  household_id = auth_household_id() and (auth_role() in ('provider','guardian') or to_member_id = auth.uid())
);
drop policy if exists sc_write on schedules;
create policy sc_write on schedules for all using (
  household_id = auth_household_id() and auth_role() in ('provider','guardian')
) with check (
  household_id = auth_household_id() and auth_role() in ('provider','guardian')
);

create or replace function create_household(p_name text, p_display_name text, p_role text, p_color text)
  returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then raise exception 'You already belong to a household'; end if;
  v_code := upper(substr(md5(random()::text),1,6));
  insert into households(name, join_code) values (p_name, v_code) returning id into v_id;
  insert into profiles(id, household_id, display_name, role, color)
    values (auth.uid(), v_id, p_display_name, p_role, p_color);
  return v_code;
end; $$;

create or replace function join_household(p_code text, p_display_name text, p_role text, p_color text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from households where upper(join_code) = upper(trim(p_code));
  if v_id is null then raise exception 'No household found for that code'; end if;
  insert into profiles(id, household_id, display_name, role, color)
    values (auth.uid(), v_id, p_display_name, p_role, p_color)
  on conflict (id) do update set household_id=excluded.household_id, display_name=excluded.display_name, role=excluded.role, color=excluded.color;
  return v_id;
end; $$;

alter publication supabase_realtime add table transactions;
