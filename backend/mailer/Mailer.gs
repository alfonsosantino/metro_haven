/**
 * METRO HAVEN — Guest email sender (Google Apps Script, runs as metrohavensuites@gmail.com)
 * Supabase calls this when a booking is approved or declined.
 * No passwords stored here: it verifies each request by reading the booking back from Supabase.
 */
const BRAND = { name: 'Metro Haven', green: '#06302a', gold: '#c9a675', cream: '#fbf7f2' };

const SUPABASE_URL = 'https://lkuhtroarhmiitkiigqz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IG499FzQnFcJH_KOseuBgw_tKiJ_9RW'; // public key (same one the website uses)

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (_) { return out_({ ok: false }); }
  try {
    // Read the booking back from Supabase — only works with the booking's secret token,
    // and only right after the admin approved/declined it.
    const r = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/mail_payload', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { apikey: SUPABASE_KEY }, payload: JSON.stringify({ p_id: String(req.id || ''), p_token: String(req.t || '') })
    });
    if (r.getResponseCode() !== 200) return out_({ ok: false, error: 'not allowed' });
    const b = JSON.parse(r.getContentText());
    if (b.type === 'approved') sendApproved_(b);
    else if (b.type === 'declined') sendDeclined_(b);
    return out_({ ok: true });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doGet() { return out_({ ok: true, service: 'Metro Haven mailer' }); }

function sendApproved_(b) {
  const guests = Number(b.adults || 0) + Number(b.children || 0);
  const guestTxt = guests + ' guest' + (guests === 1 ? '' : 's') + (Number(b.infants) ? ', ' + b.infants + ' infant' + (b.infants == 1 ? '' : 's') : '');
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(b.pay_url);
  const subject = 'Your Booking Request Has Been Approved!';
  const text = [
    'Good news! Your booking request has been approved by the host!', '',
    'BOOKING DETAILS',
    '* Booking Reference: ' + b.id,
    '* Guest Name: ' + b.name,
    '* Check-in: ' + nice_(b.checkin) + ', 3:00 PM',
    '* Check-out: ' + nice_(b.checkout) + ', 12:00 NN',
    '* Number of Guests: ' + guestTxt, '',
    'PROCEED TO PAYMENT',
    'Open your booking payment page to select your preferred payment method and review optional add-ons, including pool access and additional guest fees:',
    b.pay_url, '',
    'Thank you for choosing Metro Haven! We look forward to hosting you.'
  ].join('\n');
  const rows = [['Booking Reference', b.id], ['Guest Name', b.name], ['Check-in', nice_(b.checkin) + ', 3:00 PM'],
                ['Check-out', nice_(b.checkout) + ', 12:00 NN'], ['Number of Guests', guestTxt]]
    .map(r => '<tr><td style="padding:6px 0;color:#5f6d68;font-size:14px">' + esc_(r[0]) + '</td><td style="padding:6px 0;text-align:right;font-weight:600;color:' + BRAND.green + ';font-size:14px">' + esc_(r[1]) + '</td></tr>').join('');
  const html = shell_(
    '<p style="font-size:22px;font-weight:700;color:' + BRAND.green + ';margin:0 0 6px">Good news!</p>' +
    '<p style="margin:0 0 20px;color:#1d2b27">Your booking request has been approved by the host!</p>' +
    h_('Booking details') + '<table width="100%" cellpadding="0" cellspacing="0">' + rows + '</table>' +
    h_('Proceed to payment') +
    '<p style="margin:0 0 14px;color:#1d2b27;font-size:14.5px">Scan the QR code below to access your booking payment page. You can select your preferred payment method and review optional add-ons, including pool access and additional guest fees.</p>' +
    '<div style="text-align:center"><img src="' + qr + '" width="200" height="200" alt="Payment page QR code" style="border:1px solid #e4d6c3;border-radius:12px"></div>' +
    '<div style="text-align:center;margin:16px 0 6px"><a href="' + esc_(b.pay_url) + '" style="display:inline-block;background:' + BRAND.green + ';color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:999px">Open payment page</a></div>' +
    '<p style="text-align:center;font-size:12.5px;color:#5f6d68;margin:0 0 18px">On your phone? Just tap the button.</p>' +
    '<p style="margin:18px 0 0;color:#1d2b27">Thank you for choosing Metro Haven! We look forward to hosting you.</p>');
  MailApp.sendEmail({ to: b.to, subject: subject, body: text, htmlBody: html, name: BRAND.name });
}

function sendDeclined_(b) {
  const site = b.site_url || '';
  const link = site + 'calendar.html';
  const subject = 'Update on Your Booking Request';
  const text = [
    'Hello!', '',
    'Thank you for considering Metro Haven. Unfortunately, your requested dates are unavailable. Please return to the booking page to view available units and alternative dates.',
    link, '',
    'We hope to host you soon!'
  ].join('\n');
  const html = shell_(
    '<p style="font-size:20px;font-weight:700;color:' + BRAND.green + ';margin:0 0 12px">Hello!</p>' +
    '<p style="margin:0 0 18px;color:#1d2b27">Thank you for considering Metro Haven. Unfortunately, your requested dates are unavailable. Please return to the booking page to view available units and alternative dates.</p>' +
    '<div style="text-align:center;margin:10px 0 18px"><a href="' + esc_(link) + '" style="display:inline-block;background:' + BRAND.green + ';color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:999px">View available dates</a></div>' +
    '<p style="margin:0;color:#1d2b27">We hope to host you soon!</p>');
  MailApp.sendEmail({ to: b.to, subject: subject, body: text, htmlBody: html, name: BRAND.name });
}

function shell_(inner) {
  return '<div style="background:' + BRAND.cream + ';padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4d6c3;border-radius:18px;overflow:hidden">' +
    '<div style="background:' + BRAND.green + ';padding:18px 24px;color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">METRO HAVEN<div style="font-size:12px;font-weight:400;color:' + BRAND.gold + ';letter-spacing:2px">your urban escape.</div></div>' +
    '<div style="padding:24px">' + inner + '</div>' +
    '<div style="padding:14px 24px;background:' + BRAND.cream + ';font-size:12px;color:#5f6d68">The Grass Residences, Quezon City · Check-in 3:00 PM · Check-out 12:00 NN</div>' +
    '</div></div>';
}
function h_(t) { return '<p style="margin:22px 0 8px;font-size:12px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;color:#a8834f">' + esc_(t) + '</p>'; }
function nice_(d) { const p = String(d).split('-'); const dt = new Date(+p[0], +p[1] - 1, +p[2]); return Utilities.formatDate(dt, 'Asia/Manila', 'EEE, MMM d, yyyy'); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run once from the editor to grant Gmail permission and send yourself a sample. */
function testSend() {
  const me = Session.getActiveUser().getEmail();
  sendApproved_({ to: me, id: 'MH-000000', name: 'Sample Guest', checkin: '2026-12-24', checkout: '2026-12-26', adults: 2, children: 0, infants: 0, pay_url: 'https://alfonsosantino.github.io/metro_haven/pay.html?ref=MH-000000&t=sample' });
  sendDeclined_({ to: me, site_url: 'https://alfonsosantino.github.io/metro_haven/' });
}
