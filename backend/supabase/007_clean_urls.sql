-- =====================================================================
-- METRO HAVEN — 007: clean payment links (…/pay?ref=… instead of pay.html).
-- Old pay.html links keep working. Safe to re-run.
-- =====================================================================
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
    'pay_url', coalesce(site, '') || 'pay?ref=' || b.id || '&t=' || b.pay_token);
end $$;

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
    'checkin', b.checkin, 'checkout', b.checkout, 'nights', b.nights, 'status', b.status,
    'paid', b.paid, 'payment_submitted', b.payment_submitted_at is not null,
    'pay_path', case when b.status = 'confirmed' then 'pay?ref=' || b.id || '&t=' || b.pay_token end);
end $$;
