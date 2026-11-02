/**
 * METRO HAVEN — Booking backend (Google Apps Script + Google Sheets)
 * -----------------------------------------------------------------
 * Free, runs on your Google account. See backend/SETUP.md.
 *
 * Script properties (Project Settings → Script properties):
 *   ADMIN_KEY    = a long password for the admin dashboard   (required)
 *   OWNER_EMAIL  = where new-inquiry alerts are sent          (optional)
 */

const SHEET_NAME = 'Bookings';
const SUITES = { ebony: 'Ebony Suite', cedar: 'Cedar Suite', willow: 'Willow Suite' };
const MAX_GUESTS = { ebony: 4, cedar: 4, willow: 8 };
const HEADERS = ['id','created','updated','suite','checkin','checkout','nights','adults','children','infants',
                 'name','phone','email','message','status','amount','paid','notes','source'];
// status: pending | confirmed | declined | cancelled | blocked
const BLOCKING = ['confirmed', 'blocked'];

/* ---------- HTTP entry points ---------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'dates') return json_({ ok: true, dates: publicDates_() });
    return json_({ ok: true, service: 'Metro Haven bookings' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (_) { return json_({ ok: false, error: 'Bad request' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (body.action) {
      case 'inquire': return json_(inquire_(body));
      case 'status':  return json_(status_(body));
      case 'login':   admin_(body); return json_({ ok: true });
      case 'list':    admin_(body); return json_({ ok: true, rows: rows_() });
      case 'update':  admin_(body); return json_(update_(body));
      case 'create':  admin_(body); return json_(create_(body));
      default:        return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally { lock.releaseLock(); }
}

/* ---------- Public actions ---------- */

function inquire_(b) {
  if (b.website) return { ok: true, id: 'MH-000000' };           // honeypot: silently ignore bots
  const suite = String(b.suite || '');
  if (!SUITES[suite]) throw new Error('Please choose a suite.');
  const ci = date_(b.checkin), co = date_(b.checkout);
  if (!ci || !co || co <= ci) throw new Error('Please choose valid dates.');
  if (ci < today_()) throw new Error('Check-in date has already passed.');
  const adults = int_(b.adults, 1), children = int_(b.children, 0), infants = int_(b.infants, 0);
  if (adults < 1) throw new Error('At least 1 adult is required.');
  if (adults + children > MAX_GUESTS[suite]) throw new Error(SUITES[suite] + ' fits up to ' + MAX_GUESTS[suite] + ' guests.');
  const name = clean_(b.name, 80), phone = clean_(b.phone, 30), email = clean_(b.email, 120);
  if (!name) throw new Error('Please enter your name.');
  if (!phone && !email) throw new Error('Please enter a phone number or email.');
  if (overlaps_(suite, ci, co, null)) throw new Error('Sorry, those dates are no longer available.');

  const id = newId_();
  appendRow_({
    id, suite, checkin: iso_(ci), checkout: iso_(co), nights: nights_(ci, co),
    adults, children, infants, name, phone, email, message: clean_(b.message, 1000),
    status: 'pending', amount: '', paid: 'no', notes: '', source: 'website'
  });
  notifyOwner_(id, suite, ci, co, name, phone, email, adults, children, infants);
  return { ok: true, id };
}

function status_(b) {
  const id = clean_(b.id, 20).toUpperCase();
  const contact = clean_(b.contact, 120).toLowerCase().replace(/\s/g, '');
  if (!id || !contact) throw new Error('Enter your booking reference and phone or email.');
  const r = rows_().find(x => x.id === id);
  const phoneOk = r && r.phone && contact.replace(/\D/g, '').slice(-7) === String(r.phone).replace(/\D/g, '').slice(-7) && contact.replace(/\D/g, '').length >= 7;
  const emailOk = r && r.email && contact === String(r.email).toLowerCase();
  if (!r || !(phoneOk || emailOk)) throw new Error('No booking found with those details.');
  return { ok: true, booking: { id: r.id, suite: SUITES[r.suite], checkin: r.checkin, checkout: r.checkout, nights: r.nights, status: r.status } };
}

function publicDates_() {
  const out = { ebony: [], cedar: [], willow: [] };
  rows_().forEach(r => { if (BLOCKING.indexOf(r.status) > -1 && out[r.suite]) out[r.suite].push({ in: r.checkin, out: r.checkout }); });
  return out;
}

/* ---------- Admin actions ---------- */

function admin_(b) {
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key) throw new Error('ADMIN_KEY is not set in Script properties.');
  if (String(b.key || '') !== key) { Utilities.sleep(800); throw new Error('Wrong admin password.'); }
}

function update_(b) {
  const sh = sheet_(), data = sh.getDataRange().getValues();
  const idx = data.findIndex((row, i) => i > 0 && row[0] === b.id);
  if (idx < 1) throw new Error('Booking not found.');
  const cur = toObj_(data[idx]);
  const f = b.fields || {};
  const next = Object.assign({}, cur);
  ['status','amount','paid','notes','name','phone','email','message','adults','children','infants','source'].forEach(k => { if (k in f) next[k] = clean_(f[k], 1000); });
  if ('checkin' in f || 'checkout' in f || 'suite' in f) {
    const s = f.suite || cur.suite, ci = date_(f.checkin || cur.checkin), co = date_(f.checkout || cur.checkout);
    if (!SUITES[s] || !ci || !co || co <= ci) throw new Error('Invalid suite or dates.');
    next.suite = s; next.checkin = iso_(ci); next.checkout = iso_(co); next.nights = nights_(ci, co);
  }
  if (BLOCKING.indexOf(next.status) > -1 && overlaps_(next.suite, date_(next.checkin), date_(next.checkout), next.id))
    throw new Error('These dates overlap another confirmed booking or block.');
  next.updated = new Date();
  sh.getRange(idx + 1, 1, 1, HEADERS.length).setValues([HEADERS.map(h => next[h])]);
  return { ok: true };
}

function create_(b) {
  const f = b.fields || {};
  const suite = String(f.suite || '');
  if (!SUITES[suite]) throw new Error('Choose a suite.');
  const ci = date_(f.checkin), co = date_(f.checkout);
  if (!ci || !co || co <= ci) throw new Error('Choose valid dates.');
  const status = f.status === 'blocked' ? 'blocked' : (f.status || 'confirmed');
  if (BLOCKING.indexOf(status) > -1 && overlaps_(suite, ci, co, null)) throw new Error('These dates overlap another confirmed booking or block.');
  const id = newId_();
  appendRow_({
    id, suite, checkin: iso_(ci), checkout: iso_(co), nights: nights_(ci, co),
    adults: int_(f.adults, status === 'blocked' ? 0 : 1), children: int_(f.children, 0), infants: int_(f.infants, 0),
    name: clean_(f.name, 80), phone: clean_(f.phone, 30), email: clean_(f.email, 120), message: '',
    status, amount: clean_(f.amount, 20), paid: f.paid === 'yes' ? 'yes' : 'no', notes: clean_(f.notes, 1000), source: clean_(f.source, 30) || 'admin'
  });
  return { ok: true, id };
}

/* ---------- Sheet helpers ---------- */

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.getRange('E:F').setNumberFormat('@');   // keep dates as plain YYYY-MM-DD text
  }
  return sh;
}

function rows_() {
  const data = sheet_().getDataRange().getValues();
  return data.slice(1).filter(r => r[0]).map(toObj_);
}

function toObj_(row) {
  const o = {};
  HEADERS.forEach((h, i) => {
    let v = row[i];
    if (v instanceof Date) v = (h === 'checkin' || h === 'checkout') ? iso_(v) : v.toISOString();
    o[h] = v === undefined ? '' : v;
  });
  return o;
}

function appendRow_(o) {
  const now = new Date();
  o.created = now; o.updated = now;
  sheet_().appendRow(HEADERS.map(h => (o[h] === undefined ? '' : o[h])));
}

function overlaps_(suite, ci, co, ignoreId) {
  return rows_().some(r => r.suite === suite && r.id !== ignoreId && BLOCKING.indexOf(r.status) > -1 &&
    date_(r.checkin) < co && date_(r.checkout) > ci);
}

/* ---------- Utilities ---------- */

function notifyOwner_(id, suite, ci, co, name, phone, email, a, c, i) {
  const to = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL');
  if (!to) return;
  const body = [
    'New booking inquiry ' + id,
    SUITES[suite] + ': ' + iso_(ci) + ' → ' + iso_(co) + ' (' + nights_(ci, co) + ' nights)',
    'Guests: ' + a + ' adults, ' + c + ' children, ' + i + ' infants',
    'Name: ' + name, 'Phone: ' + (phone || '-'), 'Email: ' + (email || '-'),
    '', 'Open your admin dashboard to accept or decline.'
  ].join('\n');
  try { MailApp.sendEmail(to, 'Metro Haven — new inquiry ' + id, body); } catch (_) {}
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(v, max) { return String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max); }
function int_(v, d) { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(0, Math.min(n, 20)); }
function date_(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function iso_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function today_() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function nights_(a, b) { return Math.round((b - a) / 86400000); }
function newId_() {
  const ids = rows_().map(r => r.id);
  let id;
  do { id = 'MH-' + Math.floor(100000 + Math.random() * 900000); } while (ids.indexOf(id) > -1);
  return id;
}

/** Run once from the editor to create the sheet headers. */
function setup() { sheet_(); }
