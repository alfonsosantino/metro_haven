-- =====================================================================
-- METRO HAVEN — 004: email the owner (metrohavensuites@gmail.com)
-- whenever a new "Book Now" request comes in. Safe to re-run.
-- =====================================================================

-- mail_payload now also answers for brand-new pending requests (type 'new').
create or replace function public.mail_payload(p_id text, p_token text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare b public.bookings; site text; kind text;
begin
  select * into b from public.bookings where id = p_id and pay_token = p_token;
  if not found then raise exception 'not found'; end if;
  if b.status = 'pending' and b.created_at > now() - interval '15 minutes' then kind := 'new';
  elsif b.email is null then raise exception 'not found';
  elsif b.status = 'confirmed' and b.approval_email_sent_at > now() - interval '15 minutes' then kind := 'approved';
  elsif b.status = 'declined' and b.decline_email_sent_at > now() - interval '15 minutes' then kind := 'declined';
  else raise exception 'nothing to send'; end if;
  select value into site from public.app_settings where key = 'site_url';
  return json_build_object('type', kind, 'to', b.email, 'name', b.name, 'id', b.id,
    'suite', (select name from public.suites where id = b.suite),
    'checkin', b.checkin, 'checkout', b.checkout, 'nights', b.nights,
    'adults', b.adults, 'children', b.children, 'infants', b.infants,
    'phone', case when kind = 'new' then b.phone end,
    'message', case when kind = 'new' then b.message end,
    'amount', case when kind = 'new' then b.amount end,
    'site_url', coalesce(site, ''),
    'pay_url', coalesce(site, '') || 'pay.html?ref=' || b.id || '&t=' || b.pay_token);
end $$;
revoke execute on function public.mail_payload(text,text) from public;
grant execute on function public.mail_payload(text,text) to anon;

create or replace function public.notify_owner_new() returns trigger
language plpgsql security definer set search_path = public as $$
declare url text;
begin
  if new.status = 'pending' and new.source = 'website' then
    select value into url from public.app_settings where key = 'mail_url';
    if url is not null then
      perform net.http_post(url := url,
        body := jsonb_build_object('id', new.id, 't', new.pay_token),
        headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 10000);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists bookings_notify_owner on public.bookings;
create trigger bookings_notify_owner after insert on public.bookings
  for each row execute function public.notify_owner_new();
