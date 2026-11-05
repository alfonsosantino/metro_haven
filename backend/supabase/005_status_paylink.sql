-- =====================================================================
-- METRO HAVEN — 005: "Check your booking" also returns the payment link
-- once a booking is confirmed (so guests don't depend on the email).
-- =====================================================================
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
    'pay_path', case when b.status = 'confirmed' then 'pay.html?ref=' || b.id || '&t=' || b.pay_token end);
end $$;
