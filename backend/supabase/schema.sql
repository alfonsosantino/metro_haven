-- =====================================================================
-- METRO HAVEN — Supabase database schema
-- Run once in Supabase → SQL Editor (safe to re-run).
-- =====================================================================

create extension if not exists btree_gist;

-- ---------- Suites ----------
create table if not exists public.suites (
  id          text primary key,
  name        text not null,
  location    text,
  max_guests  int  not null,
  base_price  numeric(10,2)
);

insert into public.suites (id, name, location, max_guests, base_price) values
  ('ebony',  'Ebony Suite',  'Tower 3 19th Flr', 4, 1999),
  ('cedar',  'Cedar Suite',  'Tower 1 2nd Flr',  4, 2199),
  ('willow', 'Willow Suite', 'Tower 1 5th Flr',  8, 4599)
on conflict (id) do update set name = excluded.name, location = excluded.location,
  max_guests = excluded.max_guests, base_price = excluded.base_price;

-- ---------- Bookings ----------
do $$ begin
  create type public.booking_status as enum ('pending','confirmed','declined','cancelled','blocked');
exception when duplicate_object then null; end $$;

create or replace function public.new_booking_id() returns text
language plpgsql volatile set search_path = public as $$
declare v text;
begin
  loop
    v := 'MH-' || (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from public.bookings where id = v);
  end loop;
  return v;
end $$;

create table if not exists public.bookings (
  id            text primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  suite         text not null references public.suites(id),
  checkin       date not null,
  checkout      date not null,
  nights        int generated always as (checkout - checkin) stored,
  adults        int  not null default 1 check (adults between 0 and 20),
  children      int  not null default 0 check (children between 0 and 20),
  infants       int  not null default 0 check (infants between 0 and 20),
  name          text,
  phone         text,
  email         text,
  message       text,
  status        public.booking_status not null default 'pending',
  amount        numeric(10,2),
  paid          boolean not null default false,
  notes         text,
  source        text not null default 'website',
  external_uid  text unique,            -- used by the Airbnb calendar sync
  constraint checkout_after_checkin check (checkout > checkin)
);
alter table public.bookings alter column id set default public.new_booking_id();

-- The database itself refuses two confirmed/blocked stays that overlap in the same suite.
do $$ begin
  alter table public.bookings add constraint no_double_booking
    exclude using gist (suite with =, daterange(checkin, checkout, '[)') with &&)
    where (status in ('confirmed','blocked'));
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists bookings_suite_dates on public.bookings (suite, checkin, checkout);
create index if not exists bookings_status on public.bookings (status);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------- Admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text,
  added_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Row Level Security ----------
alter table public.suites   enable row level security;
alter table public.bookings enable row level security;
alter table public.admins   enable row level security;

drop policy if exists "suites readable" on public.suites;
create policy "suites readable" on public.suites for select to anon, authenticated using (true);

drop policy if exists "admins manage bookings" on public.bookings;
create policy "admins manage bookings" on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins see self" on public.admins;
create policy "admins see self" on public.admins for select to authenticated
  using (user_id = auth.uid());

-- Guests never touch the bookings table directly — only through the functions below.
revoke all on public.bookings from anon;
revoke all on public.admins  from anon;

-- ---------- Public functions (used by the website) ----------
create or replace function public.manila_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Manila')::date $$;

-- Booked/blocked date ranges only (no guest details).
create or replace function public.public_booked_dates()
returns table (suite text, checkin date, checkout date)
language sql stable security definer set search_path = public as $$
  select b.suite, b.checkin, b.checkout
  from public.bookings b
  where b.status in ('confirmed','blocked') and b.checkout >= public.manila_today()
  order by b.checkin;
$$;

-- "Book Now" request from the website.
create or replace function public.create_inquiry(
  p_suite text, p_checkin date, p_checkout date,
  p_adults int, p_children int, p_infants int,
  p_name text, p_phone text, p_email text, p_message text,
  p_website text default ''
) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.suites; v_id text;
  v_name text := left(btrim(coalesce(p_name,'')), 80);
  v_phone text := left(btrim(coalesce(p_phone,'')), 30);
  v_email text := lower(left(btrim(coalesce(p_email,'')), 120));
begin
  if coalesce(p_website,'') <> '' then return 'MH-000000'; end if;          -- bot honeypot
  select * into s from public.suites where id = p_suite;
  if not found then raise exception 'Please choose a suite.'; end if;
  if p_checkin is null or p_checkout is null or p_checkout <= p_checkin then raise exception 'Please choose valid dates.'; end if;
  if p_checkin < public.manila_today() then raise exception 'Check-in date has already passed.'; end if;
  if p_checkout - p_checkin > 30 then raise exception 'For stays longer than 30 nights, please message us.'; end if;
  if coalesce(p_adults,0) < 1 then raise exception 'At least 1 adult is required.'; end if;
  if coalesce(p_infants,0) > 2 then raise exception 'Maximum of 2 infants.'; end if;
  if p_adults + coalesce(p_children,0) > s.max_guests then
    raise exception '% fits up to % guests.', s.name, s.max_guests; end if;
  if v_name = '' then raise exception 'Please enter your name.'; end if;
  if v_phone = '' and v_email = '' then raise exception 'Please enter a mobile number or email.'; end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please check your email address.'; end if;

  -- simple anti-spam: max 5 requests per contact per day, 200 per day overall
  if (select count(*) from public.bookings where source = 'website' and created_at > now() - interval '1 day'
        and ((v_phone <> '' and phone = v_phone) or (v_email <> '' and email = v_email))) >= 5
     or (select count(*) from public.bookings where source = 'website' and created_at > now() - interval '1 day') >= 200 then
    raise exception 'Too many requests. Please message us on Messenger instead.';
  end if;

  if exists (select 1 from public.bookings b where b.suite = p_suite and b.status in ('confirmed','blocked')
             and daterange(b.checkin, b.checkout, '[)') && daterange(p_checkin, p_checkout, '[)')) then
    raise exception 'Sorry, those dates are no longer available.';
  end if;

  insert into public.bookings (suite, checkin, checkout, adults, children, infants, name, phone, email, message, status, source)
  values (p_suite, p_checkin, p_checkout, p_adults, coalesce(p_children,0), coalesce(p_infants,0),
          v_name, nullif(v_phone,''), nullif(v_email,''), nullif(left(btrim(coalesce(p_message,'')),1000),''), 'pending', 'website')
  returning id into v_id;
  return v_id;
end $$;

-- "Check your booking" on the homepage: needs reference + matching phone or email.
create or replace function public.booking_status(p_id text, p_contact text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare b public.bookings; c text := lower(regexp_replace(coalesce(p_contact,''), '\s', '', 'g'));
        digits text := regexp_replace(c, '\D', '', 'g');
begin
  select * into b from public.bookings where id = upper(btrim(coalesce(p_id,'')));
  if not found
     or not (
       (b.email is not null and c = lower(b.email))
       or (b.phone is not null and length(digits) >= 7 and right(digits, 7) = right(regexp_replace(b.phone, '\D', '', 'g'), 7))
     ) then
    raise exception 'No booking found with those details.';
  end if;
  return json_build_object('id', b.id, 'suite', (select name from public.suites where id = b.suite),
    'checkin', b.checkin, 'checkout', b.checkout, 'nights', b.nights, 'status', b.status);
end $$;

revoke execute on function public.create_inquiry(text,date,date,int,int,int,text,text,text,text,text) from public;
revoke execute on function public.booking_status(text,text) from public;
revoke execute on function public.public_booked_dates() from public;
grant execute on function public.create_inquiry(text,date,date,int,int,int,text,text,text,text,text) to anon, authenticated;
grant execute on function public.booking_status(text,text) to anon, authenticated;
grant execute on function public.public_booked_dates() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.new_booking_id() from anon;
