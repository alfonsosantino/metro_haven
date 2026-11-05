-- =====================================================================
-- METRO HAVEN — 002: per-suite pricing (base price covers N guests,
-- ₱250 per extra guest per night). Safe to re-run.
-- =====================================================================

alter table public.suites add column if not exists included_guests int not null default 2;
alter table public.suites add column if not exists extra_guest_fee numeric(10,2) not null default 250;

update public.suites set base_price = 1999, included_guests = 2, max_guests = 4, extra_guest_fee = 250 where id = 'ebony';
update public.suites set base_price = 2199, included_guests = 3, max_guests = 6, extra_guest_fee = 250 where id = 'cedar';
update public.suites set base_price = 4599, included_guests = 5, max_guests = 8, extra_guest_fee = 250 where id = 'willow';

-- Price for a stay: nights × (base + extra guests × fee). Infants are free and don't count.
create or replace function public.quote_price(p_suite text, p_checkin date, p_checkout date, p_adults int, p_children int)
returns numeric
language sql stable security definer set search_path = public as $$
  select (p_checkout - p_checkin) *
         (s.base_price + greatest(0, coalesce(p_adults,0) + coalesce(p_children,0) - s.included_guests) * s.extra_guest_fee)
  from public.suites s where s.id = p_suite;
$$;
revoke execute on function public.quote_price(text,date,date,int,int) from public;
grant execute on function public.quote_price(text,date,date,int,int) to anon, authenticated;

-- New "Book Now" requests get the quoted total filled in (admin can still edit it).
create or replace function public.set_quote_on_insert() returns trigger
language plpgsql as $$
begin
  if new.amount is null and new.status in ('pending','confirmed') then
    new.amount := public.quote_price(new.suite, new.checkin, new.checkout, new.adults, new.children);
  end if;
  return new;
end $$;
drop trigger if exists bookings_quote on public.bookings;
create trigger bookings_quote before insert on public.bookings
  for each row execute function public.set_quote_on_insert();

-- Fill in amounts for existing pending/confirmed bookings that don't have one yet.
update public.bookings set amount = public.quote_price(suite, checkin, checkout, adults, children)
where amount is null and status in ('pending','confirmed');
