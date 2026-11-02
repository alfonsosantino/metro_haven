/* =========================================================
   METRO HAVEN — SITE SETTINGS
   After deploying the Google Apps Script backend (see backend/SETUP.md),
   paste the Web app URL below, between the quotes.
   ========================================================= */
window.METRO_HAVEN_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycby75-Ib_epN_mun9gHriKczAxhpLu_GwznwwxRVzJQ3IqjnNYITG29pWL_OPUej27_qsQ/exec"   // e.g. "https://script.google.com/macros/s/AKfy.../exec"
};

/* Small helper used by the calendar, homepage and admin pages. */
window.mhApi = {
  ready: function () { return !!(window.METRO_HAVEN_CONFIG && window.METRO_HAVEN_CONFIG.API_URL); },
  _fetch: async function (url, opts) {
    // give up after 25s so the page never hangs if Google is unreachable
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
    try { return await fetch(url, Object.assign({ signal: ctl.signal }, opts)); }
    catch (e) { throw new Error(e.name === "AbortError" ? "The booking service took too long to respond. Please try again, or message us on Messenger." : "Couldn't reach the booking service. Please check your connection or message us on Messenger."); }
    finally { clearTimeout(t); }
  },
  get: async function (params) {
    const url = window.METRO_HAVEN_CONFIG.API_URL + "?" + new URLSearchParams(params).toString();
    const r = await this._fetch(url, { method: "GET" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Request failed");
    return j;
  },
  post: async function (body) {
    // text/plain avoids a CORS preflight, which Apps Script doesn't support
    const r = await this._fetch(window.METRO_HAVEN_CONFIG.API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Request failed");
    return j;
  }
};
