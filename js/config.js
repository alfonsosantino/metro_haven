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
  get: async function (params) {
    const url = window.METRO_HAVEN_CONFIG.API_URL + "?" + new URLSearchParams(params).toString();
    const r = await fetch(url, { method: "GET" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Request failed");
    return j;
  },
  post: async function (body) {
    // text/plain avoids a CORS preflight, which Apps Script doesn't support
    const r = await fetch(window.METRO_HAVEN_CONFIG.API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Request failed");
    return j;
  }
};
