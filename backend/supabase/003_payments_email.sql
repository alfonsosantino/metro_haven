-- =====================================================================
-- METRO HAVEN — 003: payment page, pool add-on, approval email hook.
-- Safe to re-run.
-- =====================================================================
create extension if not exists pg_net;

-- ---------- Payment fields on bookings ----------
alter table public.bookings add column if not exists pay_token text not null default replace(gen_random_uuid()::text, '-', '');
alter table public.bookings add column if not exists pool_guests int not null default 0 check (pool_guests between 0 and 20);
alter table public.bookings add column if not exists pool_days int not null default 0 check (pool_days between 0 and 60);
alter table public.bookings add column if not exists payment_method text;
alter table public.bookings add column if not exists payment_ref text;
alter table public.bookings add column if not exists payment_submitted_at timestamptz;
alter table public.bookings add column if not exists approval_email_sent_at timestamptz;

alter table public.suites add column if not exists pool_fee numeric(10,2) not null default 150;

-- ---------- Private settings (never readable from the website) ----------
create table if not exists public.app_settings (key text primary key, value text);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- ---------- Payment page (guest opens link from approval email) ----------
create or replace function public.get_payment(p_id text, p_token text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare b public.bookings; s public.suites;
begin
  select * into b from public.bookings where id = upper(btrim(coalesce(p_id,''))) and pay_token = coalesce(p_token,'');
  if not found then raise exception 'Payment link not found. Please check the link in your email.'; end if;
  if b.status not in ('confirmed') then raise exception 'This booking is not awaiting payment (status: %).', b.status; end if;
  select * into s from public.suites where id = b.suite;
  return json_build_object(
    'id', b.id, 'suite', s.name, 'location', s.location, 'name', b.name,
    'checkin', b.checkin, 'checkout', b.checkout, 'nights', b.nights,
    'adults', b.adults, 'children', b.children, 'infants', b.infants,
    'base_price', s.base_price, 'included_guests', s.included_guests, 'extra_guest_fee', s.extra_guest_fee,
    'stay_amount', coalesce(b.amount, public.quote_price(b.suite, b.checkin, b.checkout, b.adults, b.children)),
    'pool_fee', s.pool_fee, 'pool_guests', b.pool_guests, 'pool_days', b.pool_days,
    'paid', b.paid, 'payment_method', b.payment_method, 'payment_ref', b.payment_ref,
    'payment_submitted_at', b.payment_submitted_at);
end $$;

create or replace function public.submit_payment(p_id text, p_token text, p_method text, p_ref text, p_pool_guests int, p_pool_days int)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare b public.bookings; s public.suites; g int; d int;
begin
  select * into b from public.bookings where id = upper(btrim(coalesce(p_id,''))) and pay_token = coalesce(p_token,'') for update;
  if not found then raise exception 'Payment link not found.'; end if;
  if b.status <> 'confirmed' then raise exception 'This booking is not awaiting payment.'; end if;
  if b.paid then raise exception 'This booking is already marked as paid. Thank you!'; end if;
  if coalesce(p_method,'') not in ('gcash','bpi','maribank') then raise exception 'Please choose a payment method.'; end if;
  if length(btrim(coalesce(p_ref,''))) < 4 then raise exception 'Please enter the reference number from your payment receipt.'; end if;
  select * into s from public.suites where id = b.suite;
  g := least(greatest(coalesce(p_pool_guests,0),0), b.adults + b.children + b.infants);
  d := least(greatest(coalesce(p_pool_days,0),0), b.nights + 1);
  update public.bookings set payment_method = p_method, payment_ref = left(btrim(p_ref), 60),
    pool_guests = g, pool_days = case when g = 0 then 0 else d end, payment_submitted_at = now()
  where id = b.id;
  return json_build_object('ok', true, 'total',
    coalesce(b.amount,0) + g * (case when g = 0 then 0 else d end) * s.pool_fee);
end $$;

revoke execute on function public.get_payment(text,text) from public;
revoke execute on function public.submit_payment(text,text,text,text,int,int) from public;
grant execute on function public.get_payment(text,text) to anon, authenticated;
grant execute on function public.submit_payment(text,text,text,text,int,int) to anon, authenticated;

-- ---------- Guest emails: approved / declined ----------
-- Supabase pings the mailer with only the booking id + its secret token; the mailer then
-- reads the details back through mail_payload(). No shared password needed, and emails can
-- only go to the guest's own address, shortly after an approval/decline.
alter table public.bookings add column if not exists decline_email_sent_at timestamptz;

create or replace function public.mail_payload(p_id text, p_token text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare b public.bookings; site text; kind text;
begin
  select * into b from public.bookings where id = p_id and pay_token = p_token;
  if not found or b.email is null then raise exception 'not found'; end if;
  if b.status = 'confirmed' and b.approval_email_sent_at > now() - interval '15 minutes' then kind := 'approved';
  elsif b.status = 'declined' and b.decline_email_sent_at > now() - interval '15 minutes' then kind := 'declined';
  else raise exception 'nothing to send'; end if;
  select value into site from public.app_settings where key = 'site_url';
  return json_build_object('type', kind, 'to', b.email, 'name', b.name, 'id', b.id,
    'suite', (select name from public.suites where id = b.suite),
    'checkin', b.checkin, 'checkout', b.checkout, 'nights', b.nights,
    'adults', b.adults, 'children', b.children, 'infants', b.infants,
    'site_url', coalesce(site, ''),
    'pay_url', coalesce(site, '') || 'pay.html?ref=' || b.id || '&t=' || b.pay_token);
end $$;
revoke execute on function public.mail_payload(text,text) from public;
grant execute on function public.mail_payload(text,text) to anon;

create or replace function public.send_approval_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare url text; kind text;
begin
  if new.email is null or new.source <> 'website' or old.status is not distinct from new.status then return new; end if;
  if new.status = 'confirmed' and new.approval_email_sent_at is null then kind := 'approved';
  elsif new.status = 'declined' and new.decline_email_sent_at is null then kind := 'declined';
  else return new; end if;
  select value into url from public.app_settings where key = 'mail_url';
  if url is null then return new; end if;
  if kind = 'approved' then new.approval_email_sent_at := now(); else new.decline_email_sent_at := now(); end if;
  -- pg_net sends after this transaction commits, so the mailer sees the saved row
  perform net.http_post(url := url,
    body := jsonb_build_object('id', new.id, 't', new.pay_token),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 10000);
  return new;
end $$;
drop trigger if exists bookings_approval_email on public.bookings;
create trigger bookings_approval_email before update on public.bookings
  for each row execute function public.send_approval_email();
