/* =========================================================
   METRO HAVEN — SITE SETTINGS (Supabase backend)
   The publishable key is meant to be public: the database only
   lets visitors do what the security rules allow.
   ========================================================= */
window.METRO_HAVEN_CONFIG = {
  SUPABASE_URL: "https://lkuhtroarhmiitkiigqz.supabase.co",
  SUPABASE_KEY: "sb_publishable_IG499FzQnFcJH_KOseuBgw_tKiJ_9RW"
};

/* ---------------------------------------------------------
   Small API helper used by the calendar, homepage and admin.
   Talks to Supabase's REST + Auth endpoints directly (no library).
   --------------------------------------------------------- */
(function () {
  const C = window.METRO_HAVEN_CONFIG;
  const SKEY = "mh_session";
  const OVERLAP = "These dates overlap another confirmed booking or blocked dates.";

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(SKEY) || sessionStorage.getItem(SKEY) || "null"); } catch (e) { return null; } },
    set(s, persist) { try { (persist ? localStorage : sessionStorage).setItem(SKEY, JSON.stringify(s)); } catch (e) {} },
    clear() { try { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY); } catch (e) {} },
    persisted() { try { return !!localStorage.getItem(SKEY); } catch (e) { return false; } }
  };

  async function req(path, opts) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    let r;
    try { r = await fetch(C.SUPABASE_URL + path, Object.assign({ signal: ctl.signal }, opts)); }
    catch (e) { throw new Error(e.name === "AbortError" ? "The booking service took too long to respond. Please try again." : "Couldn't reach the booking service. Please check your connection or message us on Messenger."); }
    finally { clearTimeout(t); }
    const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) {
      const code = j && (j.code || j.error_code);
      if (code === "23P01") throw new Error(OVERLAP);
      const msg = j && (j.message || j.msg || j.error_description || j.error);
      throw new Error(msg === "Invalid login credentials" ? "Wrong email or password." : (msg || "Request failed (" + r.status + ")"));
    }
    return j;
  }
  const headers = (token, extra) => Object.assign({ "apikey": C.SUPABASE_KEY, "Content-Type": "application/json" },
    token ? { "Authorization": "Bearer " + token } : {}, extra || {});
  const rpc = (name, args, token) => req("/rest/v1/rpc/" + name, { method: "POST", headers: headers(token), body: JSON.stringify(args || {}) });

  /* ---------- auth (admin) ---------- */
  async function token() {
    let s = store.get(); if (!s) return null;
    if (Date.now() / 1000 > s.expires_at - 60) {
      try {
        const j = await req("/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: s.refresh_token }) });
        const persist = store.persisted();
        s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + j.expires_in, email: j.user && j.user.email };
        store.clear(); store.set(s, persist);
      } catch (e) { store.clear(); return null; }
    }
    return s.access_token;
  }

  /* ---------- row mapping (database ⇄ dashboard) ---------- */
  const toRow = b => Object.assign({}, b, { created: b.created_at, paid: b.paid ? "yes" : "no", amount: b.amount == null ? "" : b.amount });
  function toDb(f) {
    const o = {};
    ["suite", "checkin", "checkout", "name", "phone", "email", "notes", "source", "status", "message"].forEach(k => { if (k in f) o[k] = f[k] === "" ? null : f[k]; });
    ["adults", "children", "infants"].forEach(k => { if (k in f) o[k] = parseInt(f[k], 10) || 0; });
    if ("amount" in f) o.amount = f.amount === "" || f.amount == null ? null : Number(f.amount);
    if ("paid" in f) o.paid = f.paid === true || f.paid === "yes";
    if (o.source === null) o.source = "admin";
    delete o.message; // guest message is read-only
    return o;
  }

  window.mhApi = {
    ready: () => !!(C.SUPABASE_URL && C.SUPABASE_KEY),

    /* public */
    async dates() {
      const rows = await rpc("public_booked_dates");
      const out = { ebony: [], cedar: [], willow: [] };
      (rows || []).forEach(r => { (out[r.suite] = out[r.suite] || []).push({ in: r.checkin, out: r.checkout }); });
      return out;
    },
    async inquire(p) {
      return rpc("create_inquiry", {
        p_suite: p.suite, p_checkin: p.checkin, p_checkout: p.checkout,
        p_adults: p.adults, p_children: p.children, p_infants: p.infants,
        p_name: p.name, p_phone: p.phone, p_email: p.email, p_message: p.message, p_website: p.website || ""
      });
    },
    async status(id, contact) { return rpc("booking_status", { p_id: id, p_contact: contact }); },

    /* admin */
    async signIn(email, password, persist) {
      const j = await req("/auth/v1/token?grant_type=password", { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
      const s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + j.expires_in, email: j.user && j.user.email };
      const ok = await rpc("is_admin", {}, s.access_token);
      if (ok !== true) { throw new Error("This account is not an admin."); }
      store.clear(); store.set(s, persist);
      return s.email;
    },
    async signOut() {
      const t = await token();
      if (t) { try { await req("/auth/v1/logout", { method: "POST", headers: headers(t) }); } catch (e) {} }
      store.clear();
    },
    async session() { const t = await token(); return t ? (store.get() || {}).email || "admin" : null; },
    async list() {
      const t = await token(); if (!t) throw new Error("Please sign in again.");
      const rows = await req("/rest/v1/bookings?select=*&order=created_at.desc", { headers: headers(t) });
      return rows.map(toRow);
    },
    async update(id, fields) {
      const t = await token(); if (!t) throw new Error("Please sign in again.");
      const rows = await req("/rest/v1/bookings?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: headers(t, { Prefer: "return=representation" }), body: JSON.stringify(toDb(fields)) });
      if (!rows || !rows.length) throw new Error("Booking not found or not allowed.");
      return toRow(rows[0]);
    },
    async create(fields) {
      const t = await token(); if (!t) throw new Error("Please sign in again.");
      const rows = await req("/rest/v1/bookings", { method: "POST", headers: headers(t, { Prefer: "return=representation" }), body: JSON.stringify(toDb(fields)) });
      return toRow(rows[0]);
    }
  };
})();
